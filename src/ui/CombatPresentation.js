import { animacoesReduzidas } from '../systems/BattleSettings.js';
import { duracaoAnimacao } from './DiceAnimation.js';

export function tempoAviso(automatico, chefe, multiplicador = 1) {
  // A velocidade dos efeitos não pode tornar o aviso ilegível.
  const base = automatico ? 500 : chefe ? 1200 : 950;
  const fator = Number.isFinite(multiplicador) ? Math.max(0, multiplicador) : 1;
  return Math.max(automatico ? 350 : 800, Math.min(2000, base * fator));
}

// As cinco fases de uma ação, em tempo.
//
//   preparo  — antecipação + execução, até o contato (58% do total)
//   pausa    — o HIT-STOP: o quadro congela no instante do impacto
//   retorno  — resultado lido e corpo voltando ao lugar (o resto)
//
// O hit-stop é a parte nova. Antes ele existia só no crítico (90ms) e o
// golpe comum ia direto do contato para o recuo, sem um instante de parada.
// Parar o tempo por poucos quadros no contato é o jeito mais barato que a
// animação conhece de dar PESO a um golpe: nada é desenhado a mais, nenhuma
// partícula, nenhum brilho — o que informa a força é o tempo. Por isso ele
// entra para todo golpe, curto (55ms) no comum e mais longo (110ms) no
// crítico, e some inteiro no modo reduzido, onde o jogador pediu menos
// movimento e não menos clareza.
export function temposDaAcao(perfil, reduzido, critico) {
  const total = reduzido ? 140 : perfil.duracao;
  const pausa = reduzido ? 0 : critico ? 110 : 55;
  // O retorno nunca some: sem um mínimo, uma ação curta com hit-stop longo
  // terminaria no mesmo quadro do impacto e o corpo saltaria de volta.
  // No modo reduzido não há hit-stop, e o retorno fica exatamente com os 42%
  // — o piso só existe para o caso com pausa, e nunca chega a valer com as
  // durações atuais (a menor dá 108ms). É guarda, não regra.
  return { preparo: total * .58, pausa, retorno: pausa ? Math.max(70, total * .42 - pausa) : total * .42 };
}

// Forma e texto acompanham a cor: a leitura não depende de distinguir tons.
export const ELEMENTOS_VISUAIS = {
  fogo: ['#edaa69', 'Chama', '✦'], gelo: ['#9bdbe7', 'Gelo', '❄'],
  raio: ['#e9d886', 'Raio', 'ϟ'], natureza: ['#8ad6a5', 'Natureza', '❧'],
  vento: ['#b2e4dc', 'Vento', '≋'], arcano: ['#c9b1ef', 'Éter', '◇'],
  luz: ['#f1dfac', 'Luz', '✧'], sombra: ['#b9a6d7', 'Sombra', '◈'],
  fisico: ['#d7dfe8', 'Físico', '╱'], cura: ['#90d8ae', 'Cura', '+'],
  defesa: ['#9cbfea', 'Proteção', '⬡'],
  agua: ['#8dc8ef', 'Água', '≈'], terra: ['#d1b48b', 'Terra', '▲'],
  radiante: ['#f1dfac', 'Radiante', '☼'], sombrio: ['#b9a6d7', 'Sombrio', '◐'],
  veneno: ['#bdd58a', 'Veneno', '⊙'],
};

export function perfilVisual(acao = {}, ator = {}) {
  const h = acao.habilidade || acao.hab || {};
  const tipo = h.tipo || h.efeito?.tipo || acao.tipo || 'ataque';
  const cura = /cura/.test(tipo);
  const defesa = /buff|defen|proteg|guarda/.test(tipo);
  const elemento = cura ? 'cura' : defesa ? 'defesa' : h.elemento || acao.elemento || ator.elemento || 'fisico';
  const paleta = ELEMENTOS_VISUAIS[elemento] || ELEMENTOS_VISUAIS.arcano;
  return { elemento, cor: paleta[0], simbolo: paleta[2],
    nome: h.nome || acao.nome || (cura ? 'Cura' : defesa ? 'Defesa' : tipo === 'ataque' || tipo === 'atacar' ? 'Ataque' : paleta[1]),
    suporte: cura || defesa, magia: cura || defesa || /magico|conjur|sopro/.test(tipo) || (!/fisico/.test(tipo) && elemento !== 'fisico'),
    duracao: acao.hab ? 1100 : tipo === 'ataque' || tipo === 'atacar' ? 520 : 880 };
}

// Avisos descrevem o plano real, inclusive cura e guarda de um inimigo.
export function avisoDePlano(plano, combatente) {
  if (!plano || !combatente?.vivo) return '';
  const tipo = plano.hab?.efeito?.tipo || plano.tipo;
  // GOLPE ANUNCIADO. É o aviso mais importante da tela: o chefe gastou o
  // turno dele avisando, e este texto é o que transforma isso em decisão.
  // Vem antes de tudo, inclusive de "área", porque um carregado em área é
  // antes de mais nada um carregado.
  if (tipo === 'carregar') {
    if (plano.descarregar) return '';
    return plano.alvo && plano.alvo === combatente
      ? `⚠️ ALVO MARCADO · ${plano.hab?.nome || 'golpe'} no próximo turno`
      : `⚠️ CARREGANDO · ${plano.hab?.nome || 'golpe'} no próximo turno`;
  }
  if (tipo === 'maldicao' && combatente.isPlayer) return 'MALDIÇÃO · O time inteiro';
  if (tipo === 'area' && combatente.isPlayer) return 'ÁREA · Ataque iminente';
  if (plano.alvo !== combatente) return '';
  if (/cura/.test(tipo)) return 'CURA · Alvo aliado';
  if (/proteg|guarda/.test(tipo)) return 'PROTEÇÃO · Alvo aliado';
  return 'ALVO · Ataque iminente';
}

export function mostrarEstadoCombate(arena, descricao) {
  arena.querySelector('.combate-estado-detalhe')?.remove();
  const painel = document.createElement('div');
  painel.className = 'combate-estado-detalhe';
  painel.setAttribute('role', 'status');
  const texto = document.createElement('span'); texto.textContent = descricao;
  const fechar = document.createElement('button'); fechar.textContent = 'Fechar detalhe';
  fechar.type = 'button'; fechar.onclick = () => painel.remove();
  painel.append(texto, fechar); arena.append(painel);
}

export function resumoEstados(efeitos) {
  const ordenados = [...efeitos].sort((a,b) => (a.turnos ?? Infinity) - (b.turnos ?? Infinity));
  return { visiveis: ordenados.slice(0,2), restantes: Math.max(0,ordenados.length-2),
    descricao: ordenados.map(e => `${e.label || e.chave}: ${e.titulo}${e.turnos != null ? ` · ${e.turnos} turno(s)` : ''}`).join('\n') };
}

export function resumoImpacto(alvos, resultados) {
  return alvos.map(alvo => {
    const r = resultados?.get(alvo);
    if (!r) return null;
    if (r.dano > 0) return `${alvo.nome}: −${r.dano} HP`;
    if (r.cura > 0) return `${alvo.nome}: +${r.cura} HP`;
    return null;
  }).filter(Boolean).join(' · ');
}

// Uma instância por batalha. Pular encerra somente a apresentação, nunca a regra.
export function criarApresentacaoCombate(arena, elementoDe) {
  const faixa = document.createElement('div');
  faixa.className = 'combate-leitura';
  const texto = document.createElement('span');
  texto.setAttribute('role', 'status'); texto.setAttribute('aria-live', 'polite');
  const pular = document.createElement('button');
  pular.type = 'button'; pular.textContent = 'Pular efeito'; pular.hidden = true;
  faixa.append(texto, pular);
  // A narração usa a barra fixa de informações; no centro da arena ela
  // escondia projéteis, números de dano e combatentes.
  const tela = arena.closest?.('.bt-screen') || arena.parentElement || arena;
  (tela.querySelector('#bt-legenda-acao') || arena).append(faixa);
  let finalizarEspera = null, pulou = false;
  const animacoes = new Set();
  pular.onclick = () => { pulou = true; for (const a of animacoes) a.cancel(); finalizarEspera?.(); };
  const esperar = ms => new Promise(resolve => {
    if (pulou || !arena.isConnected) return resolve();
    const timer = setTimeout(fim, ms);
    function fim() { clearTimeout(timer); finalizarEspera = null; resolve(); }
    finalizarEspera = fim;
  });
  function mover(el, frames, ms) {
    if (!el?.animate) return;
    const anim = el.animate(frames, { duration: ms, easing: 'ease-out', fill: 'none' });
    animacoes.add(anim); anim.finished.catch(() => {}).finally(() => animacoes.delete(anim));
  }
  function ponto(el) {
    const r = (el?.querySelector('.sprite-wrap') || el)?.getBoundingClientRect();
    const base = arena.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top } : null;
  }
  async function executar({ ator, alvos = [], acao = {}, impacto }) {
    pulou = false;
    const perfil = perfilVisual(acao, ator);
    const reduzido = animacoesReduzidas();
    arena.classList.toggle('combate-conforto', reduzido);
    arena.classList.add('combate-em-acao');
    // Marca a intenção visual da ação para que cada habilidade possa ter uma
    // leitura própria sem criar uma animação por personagem. A classe é
    // removida no finally, portanto nunca fica presa no próximo turno.
    arena.classList.add(acao.habilidade || acao.hab ? 'acao-habilidade' : 'acao-auto');
    arena.classList.add(perfil.suporte ? 'acao-suporte' : 'acao-ofensiva');
    if (acao.critico) arena.classList.add('acao-critica');
    arena.classList.add(`acao-elemento-${perfil.elemento}`);
    const nodes = [];
    const atacante = elementoDe(ator);
    arena.querySelector('.combate-estado-detalhe')?.remove();
    const tempos = temposDaAcao(perfil, reduzido, acao.critico);
    const preparo = duracaoAnimacao(tempos.preparo);
    const retorno = duracaoAnimacao(tempos.retorno);
    const total = preparo + retorno;
    texto.textContent = `${ator?.nome || 'Ação'} · ${perfil.nome} → ${alvos.map(a => a.nome).join(', ') || 'Próprio personagem'}`;
    pular.hidden = reduzido;
    try {
      atacante?.classList.add('acao-origem');
      for (const alvo of alvos) elementoDe(alvo)?.classList.add(perfil.suporte ? 'acao-beneficio' : 'acao-destino');
      const origem = ponto(atacante);
      const primeiroDestino = ponto(elementoDe(alvos[0]));
      const direcaoX = (primeiroDestino?.x ?? 0) - (origem?.x ?? 0);
      const direcaoY = (primeiroDestino?.y ?? 0) - (origem?.y ?? 0);
      const distancia = Math.max(1, Math.hypot(direcaoX, direcaoY));
      if (!reduzido) {
        const sprite = atacante?.querySelector('.sprite-canvas');
        // ----------------------------------------------------------------
        // AS FASES DO GOLPE, SEPARADAS.
        //
        // ANTES era um movimento só: três quadros-chave distribuídos
        // igualmente ao longo de toda a ação — sai do lugar, chega adiante,
        // volta — com uma única suavização. O corpo derivava para a frente e
        // voltava. Não havia antecipação, não havia golpe: havia deriva. E
        // como os quadros-chave eram igualmente espaçados, o ponto mais
        // adiantado do atacante caía no MEIO da animação, enquanto o dano
        // acontece aos 58% — o corpo já estava voltando quando o número
        // aparecia.
        //
        // AGORA os quadros-chave têm posição declarada (`offset`), e ela é
        // calculada a partir do instante real do contato:
        //
        //   0            → parado
        //   0,55·contato → ANTECIPAÇÃO: recua um pouco, devagar. É o que
        //                  avisa o olho de que um golpe vem — sem ela, o
        //                  ataque começa do nada e lê como teletransporte.
        //   contato      → EXECUÇÃO: avança de uma vez, rápido, e chega ao
        //                  ponto mais adiantado EXATAMENTE quando impacto()
        //                  aplica o dano.
        //   contato+     → segura a pose do impacto pela duração do hit-stop
        //   1            → RETORNO: volta ao lugar, mais devagar que o golpe
        //
        // Nenhum efeito novo entra em cena: é o mesmo sprite, no mesmo
        // caminho, com o tempo distribuído do jeito que um golpe distribui.
        // ----------------------------------------------------------------
        const ux = direcaoX / distancia;
        const uy = direcaoY / distancia;
        // A linha do tempo real é preparo → impacto → hit-stop → retorno, e a
        // animação cobre os três trechos. As frações abaixo são medidas sobre
        // ESSE total, senão o ponto mais adiantado do golpe não cairia no
        // mesmo instante em que o dano é aplicado.
        const pausaMs = duracaoAnimacao(tempos.pausa);
        const duracaoGolpe = Math.max(1, total + pausaMs);
        const contato = Math.min(.92, preparo / duracaoGolpe);
        const fimPausa = Math.min(.97, (preparo + pausaMs) / duracaoGolpe);
        const golpe = [
          { transform: 'translate(0,0) rotate(0deg)', offset: 0, easing: 'ease-in-out' },
          { transform: `translate(${-ux * 5}px,${-uy * 5}px) rotate(${ux >= 0 ? 2.5 : -2.5}deg)`, offset: contato * .55, easing: 'cubic-bezier(.15,.85,.25,1)' },
          { transform: `translate(${ux * 15}px,${uy * 15}px) rotate(${ux >= 0 ? -4 : 4}deg)`, offset: contato, easing: 'linear' },
          { transform: `translate(${ux * 15}px,${uy * 15}px) rotate(${ux >= 0 ? -4 : 4}deg)`, offset: fimPausa, easing: 'ease-in-out' },
          { transform: 'translate(0,0) rotate(0deg)', offset: 1 },
        ];
        // Magia não avança: ela junta e solta. A antecipação é o recolher —
        // encolhe e escurece de leve antes do clarão, e o clarão cai no
        // contato, não no meio.
        const conjuro = [
          { transform: 'scale(1)', filter: 'brightness(1)', offset: 0, easing: 'ease-in-out' },
          { transform: 'scale(.975)', filter: 'brightness(.92)', offset: contato * .55, easing: 'cubic-bezier(.15,.85,.25,1)' },
          { transform: 'scale(1.035)', filter: 'brightness(1.2)', offset: contato, easing: 'linear' },
          { transform: 'scale(1.035)', filter: 'brightness(1.2)', offset: fimPausa, easing: 'ease-in-out' },
          { transform: 'scale(1)', filter: 'brightness(1)', offset: 1 },
        ];
        mover(sprite, perfil.magia ? conjuro : golpe, duracaoGolpe);
        for (const alvo of alvos.slice(0, 6)) {
          const dest = ponto(elementoDe(alvo));
          if (!dest) continue;
          const fx = document.createElement('span');
          fx.className = `combate-trajeto elemento-${perfil.elemento}`;
          fx.style.setProperty('--fx-cor', perfil.cor);
          fx.textContent = perfil.simbolo;
          fx.setAttribute('aria-hidden', 'true');
          fx.style.left = `${dest.x}px`; fx.style.top = `${dest.y}px`;
          arena.append(fx); nodes.push(fx);
          // O efeito também espera a antecipação. A magia fica reunida na
          // mão do conjurador durante o recolher e só viaja na execução; o
          // corte só nasce quando o corpo avança. Antes os dois começavam no
          // quadro zero, ou seja: o golpe visual saía antes do golpe.
          const inicioDaExecucao = .55;
          const partida = `translate(${(origem?.x ?? dest.x) - dest.x}px,${(origem?.y ?? dest.y) - dest.y}px)`;
          mover(fx, perfil.magia
            ? [{ transform: `${partida} scale(.45)`, opacity: .18, offset: 0, easing: 'ease-in-out' },
              { transform: `${partida} scale(.6)`, opacity: .5, offset: inicioDaExecucao, easing: 'cubic-bezier(.3,.7,.2,1)' },
              { transform: 'translate(0,0) scale(1)', opacity: .75, offset: 1 }]
            : [{ transform: 'rotate(-40deg) scale(.2)', opacity: 0, offset: 0 },
              { transform: 'rotate(-40deg) scale(.2)', opacity: 0, offset: inicioDaExecucao, easing: 'cubic-bezier(.2,.9,.2,1)' },
              { transform: 'rotate(20deg) scale(1.4)', opacity: .75, offset: 1 }],
          preparo);
        }
      }
      await esperar(preparo);
      nodes.forEach(n => n.remove());
      impacto(); // HP, números e status aparecem no contato, uma única vez.
      const resumo = resumoImpacto(alvos, acao.resultados);
      if (resumo) texto.textContent = `${perfil.nome} · ${resumo}`;
      elementoDe(ator)?.classList.add('acao-origem');
      for (const alvo of alvos) elementoDe(alvo)?.classList.add(perfil.suporte ? 'acao-beneficio' : 'acao-destino');
      if (tempos.pausa && !pulou) await esperar(duracaoAnimacao(tempos.pausa));
      if (!reduzido && !pulou) for (const alvo of alvos.slice(0, 6)) {
        const el = elementoDe(alvo);
        const dest = ponto(el);
        const resultadoAlvo = acao.resultados?.get(alvo);
        const atingido = resultadoAlvo ? resultadoAlvo.dano > 0 : !acao.erro && !acao.bloqueado;
        if (dest && (atingido || perfil.suporte)) {
          const anel = document.createElement('span');
          anel.className = `combate-impacto elemento-${perfil.elemento}`;
          anel.setAttribute('aria-hidden', 'true');
          anel.style.cssText = `left:${dest.x}px;top:${dest.y}px;--fx-cor:${perfil.cor}`;
          arena.append(anel); nodes.push(anel);
          mover(anel, [{ transform: 'scale(.45)', opacity: .65 }, { transform: 'scale(1.2)', opacity: 0 }], retorno);
        }
        const pose = perfil.suporte ? [{ opacity: .85 }, { opacity: 1 }] : atingido
          ? [{ transform: 'translateX(0)' }, { transform: 'translateX(4px) rotate(2deg)' }, { transform: 'translateX(0)' }]
          : [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(0)' }];
        const esquivou = acao.erro && (!acao.alvoRolagem || acao.alvoRolagem === alvo);
        if (alvo.vivo !== false && (atingido || perfil.suporte || esquivou)) mover(el?.querySelector('.sprite-canvas'), pose, retorno);
      }
      await esperar(retorno);
    } finally {
      nodes.forEach(n => n.remove());
      animacoes.forEach(a => a.cancel()); animacoes.clear();
      arena.querySelectorAll('.acao-origem,.acao-destino,.acao-beneficio').forEach(el => el.classList.remove('acao-origem','acao-destino','acao-beneficio'));
      arena.classList.remove('combate-em-acao','acao-habilidade','acao-auto','acao-suporte','acao-ofensiva','acao-critica',`acao-elemento-${perfil.elemento}`); pular.hidden = true;
    }
  }
  return { executar };
}
