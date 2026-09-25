// Observe real actions and rewards; no simulated inventory or combat.
let dispose = null;
let battleActive = false;
export function tutorialAberto() { return !!dispose; }
export function registrarCombateTutorial(personagem, resultado) {
  const s = personagem?.tutorialMissao;
  if (s?.status !== 'em_andamento') return;
  battleActive = resultado === 'inicio';
  if (resultado === 'vitoria' && s.etapa === 'batalhas') s.vitorias = Math.min(2, s.vitorias + 1);
}
export function abrirTutorialInicial(personagem, dados = {}, { oferecer = false, aoEncerrar = null, iniciarEncontro = null } = {}) {
  if (dispose) return Promise.resolve({status:'ja_aberto'});
  if (oferecer && ['concluido','pulado'].includes(personagem.tutorialMissao?.status)) return Promise.resolve({status:'ignorado'});
  const s = personagem.tutorialMissao ||= {status:'em_andamento',etapa:'invocar',vitorias:0};
  s.status = 'em_andamento';
  battleActive = !!document.querySelector('#screen-batalha:not(.hidden)');
  personagem.missoesAtivas ||= [];
  personagem.missoesConcluidas ||= [];
  if (!personagem.missoesAtivas.some(m => m.id === 'tutorial_companhia') && !personagem.missoesConcluidas.includes('tutorial_companhia')) {
    personagem.missoesAtivas.unshift({id:'tutorial_companhia',progresso:0});
    personagem.missaoRastreadaId = 'tutorial_companhia';
  }
  if (!s.suprimentos && personagem.gacha?.beginner) {
    personagem.gacha.beginner.gratisRestantes = Math.max(personagem.gacha.beginner.gratisRestantes, Math.max(0,3-personagem.gacha.personagensObtidos.length));
    s.suprimentos = true;
  }
  const guide = document.createElement('aside');
  guide.className = 'missao-guia';
  guide.setAttribute('aria-label','Primeira missão: Uma companhia para Aethra');
  const title = document.createElement('strong');
  title.textContent = 'Primeira missão · Uma companhia para Aethra';
  const copy = document.createElement('p');
  copy.setAttribute('aria-live','polite');
  const action = document.createElement('button');
  const skip = document.createElement('button');
  skip.textContent = 'Pular orientação';
  guide.append(title,copy,action,skip);
  document.body.append(guide);
  let marked = null, signature = '', busy = false;
  const visible = el => !!el && el.getClientRects().length > 0 && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const button = pattern => [...document.querySelectorAll('button,[role="tab"]')].find(el => !guide.contains(el) && visible(el) && pattern.test(el.textContent.trim()));
  const select = selector => [...document.querySelectorAll(selector)].find(visible);
  const close = () => select('#modal-conteudo button[aria-label="Fechar"], #modal-conteudo .fechar');
  const finish = status => {
    s.status = status;
    if (status === 'concluido') {
      personagem.missoesAtivas = personagem.missoesAtivas.filter(m => m.id !== 'tutorial_companhia');
      if (!personagem.missoesConcluidas.includes('tutorial_companhia')) personagem.missoesConcluidas.push('tutorial_companhia');
      if (personagem.missaoRastreadaId === 'tutorial_companhia') personagem.missaoRastreadaId = null;
    }
    clearInterval(timer);
    marked?.classList.remove('missao-guia-alvo');
    guide.remove(); dispose = null;
    aoEncerrar?.(status);
  };
  skip.onclick = () => finish('pulado');
  dispose = () => finish('pausado');
  function update() {
    const g = personagem.gacha;
    if (s.etapa === 'invocar' && g?.personagensObtidos?.length >= 3) s.etapa = 'formar';
    if (s.etapa === 'formar' && g?.timeAtivo?.length >= 3) s.etapa = 'batalhas';
    if (s.vitorias >= 2) s.etapa = 'concluir';
    const quest = personagem.missoesAtivas.find(m => m.id === 'tutorial_companhia');
    if (quest) quest.progresso = Math.min(3,g?.personagensObtidos?.length || 0) + s.vitorias;
    let target = null, text = '', launch = false;
    if (s.etapa === 'invocar') {
      text = `Vamos reunir três companheiros reais (${Math.min(3,g?.personagensObtidos?.length || 0)}/3). Abra Invocar, escolha Iniciante e use as invocações gratuitas. Eles ficam na sua coleção.`;
      const beginner = select('#gacha-tab-iniciante');
      target = beginner && beginner.getAttribute('aria-selected') !== 'true' ? beginner : select('.btn-puxar') || button(/^Invocar heróis/) || select('#hud-hub-invocar') || button(/^Invocar$/i) || close();
    } else if (s.etapa === 'formar') {
      text = `Escolha Companhia → Formação e companheiros. Coloque três aliados no time (${g?.timeAtivo?.length || 0}/3). O poder mostrado é o do seu grupo real; elementos e funções também importam.`;
      target = button(/^Colocar no time$/) || button(/Formação e companheiros/) || button(/^🛡️ Formação$/) || close() || button(/^Heróis/) || select('#hud-hub-personagem') || button(/^Companhia$/i);
    } else if (s.etapa === 'batalhas') {
      text = battleActive
        ? 'Batalha real: leia a intenção do inimigo, escolha um card e confirme o alvo. Habilidades gastam Éter; defender ajuda a sobreviver. O d20 define erro, acerto ou crítico; equipamento e atributos influenciam o dano.'
        : `Time pronto! Vitórias da missão: ${s.vitorias}/2. Enfrente a primeira patrulha. Você mantém XP, ouro e itens. Se perder ou fugir, pode tentar novamente.`;
      target = battleActive ? button(/^Continuar$/) || select('.detalhe-confirmar:not(:disabled)') || select('.carta-batalha[aria-pressed="true"]') || select('.carta-batalha:not(:disabled)') || select('.btn-alvo') : close();
      launch = !battleActive && !target && !!iniciarEncontro;
    } else text = 'Duas vitórias conquistadas! Continue em Jornada para acompanhar missões; em Companhia você equipa itens e evolui habilidades. Seu time e recompensas estão com você.';
    if (copy.textContent !== text) copy.textContent = text;
    if (marked !== target) {
      marked?.classList.remove('missao-guia-alvo'); marked = target;
      marked?.classList.add('missao-guia-alvo');
      marked?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    action.hidden = !launch && s.etapa !== 'concluir';
    action.textContent = s.etapa === 'concluir' ? 'Concluir primeira missão' : 'Iniciar patrulha';
    action.onclick = () => {
      if (s.etapa === 'concluir') return finish('concluido');
      if (!busy && launch) { busy = true; iniciarEncontro(s.vitorias); setTimeout(() => {busy=false;},1000); }
    };
    guide.classList.toggle('guia-no-topo', battleActive || (!!target && target.getBoundingClientRect().top > innerHeight/2));
    const next = `${s.etapa}:${s.vitorias}`;
    if (next !== signature) { signature = next; aoEncerrar?.('progresso'); }
  }
  const timer = setInterval(update,500);
  update();
  return Promise.resolve({status:'em_andamento'});
}
