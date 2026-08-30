// Tela de batalha ATB: desenha o time (até 3 personagens), inimigos, barras
// de iniciativa, log e ações. Quando mais de um membro do time fica pronto
// ao mesmo tempo, eles entram numa fila e agem um de cada vez.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo, comboDoisElementos } from "../systems/CombatSystem.js";
import { removerItem, sortearLoot } from "../systems/InventorySystem.js";
import { ganharXP, aplicarCrescimento, cryptoId, escolhaPendente } from "../systems/CharacterFactory.js";
import { concederPontosPorNivel, concederPontoHeranca } from "../systems/TalentSystem.js";
import { registrarAbate } from "../systems/QuestSystem.js";
import { adicionarFragmentos, checarConquistas } from "../systems/GachaSystem.js";
import { FRAGMENTOS } from "../data/economyConfig.js";
import { mostrarMensagem } from "./GameUI.js";
import { autoPlayState, registrarGanhosAuto } from "../systems/AutoPlayState.js";
import { garantirConfigAutoBatalha, escolherAcaoAutomatica, MODOS_AUTO_BATALHA, LABEL_MODO } from "../systems/AutoBattleAI.js";
import { relacaoElemental, infoElemento } from "../systems/ElementSystem.js";
import { alterarReputacao, aplicarCamaradagemNoCombatente, facaoDaZona, registrarDecisao } from "../systems/WorldStateSystem.js";
import { registrarAbateCompendio } from "../systems/CompendiumSystem.js";
import { formacaoParaBatalha } from "../systems/FormationSystem.js";
import { aplicarSinergiasFormacao } from "../systems/FormationSynergySystem.js";
import { aplicarSinergiaFaccao } from "../systems/FactionSynergySystem.js";
import { aplicarParesRelacionamento } from "../systems/RivalrySystem.js";
import { registrarProgressoDiario } from "../systems/DailyQuestSystem.js";
import { efeitosReduzidos } from "../systems/AccessibilitySystem.js";
import { animarDado, sleep, duracaoAnimacao } from "./DiceAnimation.js";
import { somDadoParou, somDano, somCura, somBloqueioOuErro, destravarAudio, somRuptura } from "./SoundFX.js";
// Mão de cards de batalha (ver src/ui/BattleCards.js e o trio
// BattleForecast/TacticalAdvisor/BattleSettings): substitui a antiga fileira
// de botões de texto do turno do jogador. Toda a decisão continua sendo do
// jogador — os cards preveem, destacam e explicam, nunca jogam sozinhos.
import { criarPainelDeCards } from "./BattleCards.js";
import { animacoesReduzidas, dadoSomenteImportante } from "../systems/BattleSettings.js";

// Tela de configuração da IA de auto-batalha (task #96) — reusa o mesmo
// #modal-overlay/#modal-conteudo de GameUI.js/SkillTreeUI.js/TalentTreeUI.js,
// mas fica funcional mesmo com a tela de batalha aberta (o overlay é um
// elemento de topo em index.html, por cima de qualquer "tela"). Só lê/
// escreve `personagem.autoBatalhaConfig` — nenhuma lógica de decisão mora
// aqui, isso é tudo AutoBattleAI.js.
function montarConfigAutoBatalha(personagem) {
  const overlay = document.getElementById("modal-overlay");
  const conteudo = document.getElementById("modal-conteudo");
  if (!overlay || !conteudo) return;
  const config = garantirConfigAutoBatalha(personagem);
  overlay.classList.remove("hidden");

  const regras = [
    { chave: "preservarUltimate", label: "Preservar a habilidade mais forte pros chefes", desc: "Só usa a habilidade de maior dano contra um chefe ou quando é o último inimigo — contra inimigos comuns, guarda ela." },
    { chave: "focarChefe", label: "Focar o chefe", desc: "Prioriza atacar o chefe da batalha, quando houver um vivo." },
    { chave: "eliminarSuporte", label: "Eliminar suporte primeiro", desc: "Prioriza inimigos de arquétipo Suporte (curam/buffam o grupo deles)." },
    { chave: "explorarFraquezaElemental", label: "Explorar fraqueza elemental", desc: "Prioriza o alvo mais fraco contra o elemento da habilidade mais forte disponível." },
    { chave: "priorizarCombo", label: "Priorizar reação/combo elemental", desc: "Se o alvo já está com um estado elemental que a habilidade disponível consegue reagir (ex.: Congelado + golpe físico = Estilhaçar), usa essa habilidade em vez de rolar aleatório." },
  ];

  conteudo.innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>⚙️ IA de Auto-Batalha</h2>
    <p style="opacity:0.85;font-size:0.85em;">Controla como o modo automático decide curar, atacar e escolher alvo — pra você e pra qualquer aliado convocado do gacha.</p>
    <div id="ia-modos"></div>
    <div id="ia-cura"></div>
    <div id="ia-regras"></div>
  `;
  conteudo.querySelector(".fechar").onclick = () => { overlay.classList.add("hidden"); conteudo.innerHTML = ""; };

  const painelModos = conteudo.querySelector("#ia-modos");
  painelModos.innerHTML = `<h3 style="margin-bottom:4px;">Modo</h3>`;
  MODOS_AUTO_BATALHA.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn" + (config.modo === m ? " ativo" : "");
    btn.textContent = LABEL_MODO[m];
    btn.onclick = () => { config.modo = m; montarConfigAutoBatalha(personagem); };
    painelModos.appendChild(btn);
  });

  const painelCura = conteudo.querySelector("#ia-cura");
  const limiarAtual = config.curarAbaixoDe != null ? Math.round(config.curarAbaixoDe * 100) : null;
  painelCura.innerHTML = `
    <h3 style="margin:10px 0 4px;">Curar quando HP cair abaixo de</h3>
    <p style="font-size:0.8em;opacity:0.8;">Deixe em branco pra usar o padrão do modo escolhido.</p>
    <input id="ia-cura-input" type="number" min="0" max="100" step="5" placeholder="padrão do modo" value="${limiarAtual ?? ""}" style="width:80px;padding:6px;border-radius:4px;border:2px solid #7a5c34;background:#241b14;color:#f1e9d8;" /> %
  `;
  painelCura.querySelector("#ia-cura-input").onchange = (e) => {
    const v = e.target.value.trim();
    config.curarAbaixoDe = v === "" ? null : Math.max(0, Math.min(100, Number(v))) / 100;
  };

  const painelRegras = conteudo.querySelector("#ia-regras");
  painelRegras.innerHTML = `<h3 style="margin:10px 0 4px;">Regras</h3>`;
  regras.forEach((r) => {
    const label = document.createElement("label");
    label.style.cssText = "display:block;margin:8px 0;padding:8px;border:1px solid #4a3a26;border-radius:6px;background:#241b14;cursor:pointer;";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !!config[r.chave];
    check.style.marginRight = "8px";
    check.onchange = () => { config[r.chave] = check.checked; };
    label.appendChild(check);
    label.appendChild(document.createTextNode(r.label));
    const desc = document.createElement("div");
    desc.style.cssText = "font-size:0.78em;opacity:0.75;margin-left:24px;";
    desc.textContent = r.desc;
    label.appendChild(desc);
    painelRegras.appendChild(label);
  });
}

// Papel de combate por classe (melhoria de jogabilidade, item 5 de
// 100_melhorias.md): só um rótulo informativo — não muda nenhuma regra,
// mecânica ou dado de `classes.json`, é a mesma linguagem de papéis
// (Defensor/Duelista/Atirador/Controlador/Suporte/Curandeiro/Especialista)
// já usada nas diretrizes de combate tático deste projeto.
// Fração da barra de ATB a partir da qual a intenção do inimigo já é fixada e
// mostrada ao jogador (ver loopATB/registrarIntencao). 0.85 dá uma janela de
// resposta perceptível sem "adivinhar" um plano com muita antecedência.
const LIMIAR_INTENCAO_ANTECIPADA = 0.85;

const PAPEL_POR_CLASSE = {
  guerreiro: { nome: "Defensor", icone: "🛡️" },
  mago: { nome: "Atirador", icone: "🎯" },
  ladino: { nome: "Especialista", icone: "🗡️" },
  clerigo: { nome: "Curandeiro", icone: "💚" },
  barbaro: { nome: "Duelista", icone: "⚔️" },
  patrulheiro: { nome: "Controlador", icone: "🏹" },
};
const REPUTACAO_POR_CHEFE = 20;

// `personagem` é sempre o personagem principal (dono do inventário/ouro).
// `membrosExtras` é um array com 0 a 3 personagens obtidos via gacha que
// estão no time ativo (objetos vivos, mutáveis — mudanças de HP/XP feitas
// aqui persistem automaticamente porque são as mesmas referências salvas
// em personagem.gacha.personagensObtidos). Time completo = até 4 (task #43).
export function iniciarBatalha(screenEl, imagens, dados, personagem, membrosExtras, monstrosDef, terrenoElemento, climaElemento, facaoZona, levasExtras, onFim) {
  const time = [personagem, ...(membrosExtras || [])].slice(0, 4);
  // Formação (task #43): cada membro do time entra na posição que o jogador
  // configurou (ver FormationSystem.js/GachaUI.js, aba Time) — "player" é o
  // id-sentinela do personagem principal, os demais usam o uid do gacha.
  const idsTime = time.map((p) => p.uid || "player");
  const posicoes = formacaoParaBatalha(personagem, idsTime);
  const combatentesTime = time.map((p, i) => {
    const combatente = criarCombatenteJogador(p, dados, posicoes[i].posicao);
    // Camaradagem regional (task #44): convocado do gacha cuja facção de
    // origem bate com a afiliação escolhida pelo personagem principal luta
    // um pouco melhor ao lado dele — sem efeito pro personagem principal em
    // si (ele não tem facaoId próprio) nem pra convocados de outra facção.
    return aplicarCamaradagemNoCombatente(combatente, p, personagem);
  });
  // Combos de formação: bônus tático quando duas classes específicas ficam
  // na mesma fileira (ver FormationSynergySystem.js) — aplicado uma vez, no
  // início da batalha, igual à camaradagem de facção logo acima.
  const sinergiasAtivas = aplicarSinergiasFormacao(combatentesTime);
  // Sinergia de facção (melhoria pós-backlog, ver FactionSynergySystem.js):
  // 3+ membros do time atual da mesma facção de origem rendem um bônus
  // tático extra pro time inteiro — aplicada uma vez, junto das sinergias
  // de formação acima, com o mesmo padrão de badge/log (ver `categoria` no
  // objeto retornado, usado no registrar() logo abaixo pra diferenciar o
  // texto sem precisar de dois loops).
  const sinergiaFaccao = aplicarSinergiaFaccao(combatentesTime, time, dados.worldStateVariables);
  if (sinergiaFaccao) sinergiasAtivas.push(sinergiaFaccao);
  // Rivalidade/Amizade entre convocados específicos (melhoria pós-backlog,
  // ver RivalrySystem.js): pares curados de personagens do gacha (por
  // rosterId, não por classe/facção agregada) que rendem bônus quando os
  // DOIS estão no time — aplicada junto das sinergias acima, com o mesmo
  // padrão de log (ver `categoria` usado no registrar() logo abaixo).
  const paresAtivos = aplicarParesRelacionamento(combatentesTime, time);
  sinergiasAtivas.push(...paresAtivos.map((p) => ({ ...p, categoria: p.tipo })));
  // New Game+ (melhoria pós-backlog): personagem.ngPlus escala hp/ataque/
  // defesa/recompensa de TODO monstro criado nesta batalha, incluindo levas
  // extras de horda (ver Batalha.ngPlus/avancarLeva em CombatSystem.js). 0
  // no jogo normal — comportamento idêntico a antes desta melhoria existir.
  const ngPlus = personagem.ngPlus || 0;
  // Modo História (melhoria pós-backlog, ver CombatSystem.js): reduz hp/
  // ataque/defesa de TODO monstro criado nesta batalha (mesmo alcance de
  // ngPlus acima), sem afetar XP/ouro — escolhido uma vez na criação de
  // personagem, comportamento idêntico a antes desta opção existir quando
  // desligado (false).
  const modoHistoria = !!personagem.modoHistoria;
  const inimigos = monstrosDef.map((m, i) => criarCombatenteInimigo(m, i, ngPlus, modoHistoria));
  // `terrenoElemento` (task #42): elemento dominante da zona/masmorra atual
  // (ver worldMap.js/main.js) — bônus de ataque desse elemento + resistência
  // para os inimigos (nativos do terreno), aplicado dentro de Batalha.
  // `climaElemento` (melhoria pós-backlog, ver WeatherSystem.js/main.js
  // climaAtual()): elemento favorecido pelo clima atual da zona — mesma
  // ideia do terreno, só que mais fraca e passageira, soma com ele.
  // `levasExtras` (task #47): ondas 2-5 de uma horda, se este encontro foi
  // sorteado como horda em main.js — vazio/undefined = combate comum.
  const batalha = new Batalha(combatentesTime, inimigos, dados.elements, terrenoElemento, levasExtras || [], ngPlus, climaElemento, modoHistoria, dados.elementalStates, dados.elementalReactions);
  const ROTULO_CATEGORIA_SINERGIA = { faccao: "de facção", rivalidade: "de rivalidade", amizade: "de amizade" };
  sinergiasAtivas.forEach((s) => batalha.registrar(`${s.icone} Sinergia ${ROTULO_CATEGORIA_SINERGIA[s.categoria] || "de formação"} ativa: ${s.nome}! ${s.descricao}`));

  let pausado = false;
  let intervalId = null;
  let alvoSelecionado = inimigos[0];
  let filaAcao = [];
  // Fila de inimigos prontos aguardando a prévia de intenção (telegraph)
  // antes de agir de fato — ver iniciarTelegrafo()/avancarFila() abaixo.
  let filaInimigos = [];
  let telegrafo = null; // { inimigo, plano } sendo exibido no momento, ou null
  let atacanteAtivo = null;
  let ultimoAutoAgendado = null;

  // ---------------------------------------------------------------------
  // MÃO DE CARDS (melhoria "cards de batalha"): estado da UI nova.
  // ---------------------------------------------------------------------
  // `intencoes`: inimigo -> { plano, faixa }. O plano é decidido UMA ÚNICA
  // VEZ, no instante em que o inimigo entra na fila, e reusado tanto pela
  // exibição da intenção quanto pelo telegraph e pela execução. Isso conserta
  // um problema real que existia antes: decidirAcao() tem sorteios (ex.: o
  // Ladrão rouba com 60% de chance), então chamá-la de novo para "mostrar a
  // intenção" poderia mostrar uma coisa e executar outra.
  let intencoes = new Map();
  // Prévia ativa na arena (barra-fantasma de HP): { alvo, previsao } ou null.
  let previaAtiva = null;
  // Card armado no momento — usado só para destacar alvos/área na arena.
  let cardArmado = null;
  let painelCards = null;
  const contextoTaticoEl = document.createElement("div");
  contextoTaticoEl.id = "batalha-contexto-tatico";
  // Orquestração de animação (melhoria de jogabilidade: golpes visíveis em
  // combate — ver orquestrarAcao() mais abaixo): trava resolverTurno() contra
  // cliques duplos enquanto uma ação ainda está sendo animada (dado rolando,
  // golpe acontecendo) — sem isso, um segundo clique durante a janela de ~1s
  // da animação poderia disparar uma segunda ação do mesmo turno.
  let turnoEmAndamento = false;
  // Só a primeiríssima renderArena() (abertura da tela de batalha) recebe a
  // animação de entrada dos cards — nas seguintes (a cada tick do ATB/ação)
  // os cards são recriados do zero, e repetir o fade/slide a cada ~140ms
  // pareceria uma falha visual, não uma entrada.
  let primeiraRenderizacao = true;
  // "Fx pendente": decidido em orquestrarAcao() a partir do resultado real
  // da última rolagem (crítico? qual elemento?) e consumido UMA VEZ pelo
  // próximo cardCombatente() daquele alvo específico — permite ao flash de
  // acerto (CSS, já existente) usar a cor do elemento do golpe e um destaque
  // extra em crítico, sem duplicar a lógica de "quem foi atingido" que já
  // existe via diff de HP (hpAnterior, ver comentário logo abaixo).
  let fxPendente = null; // { alvo, critico, corElemento } | null — `alvo` é a
  // REFERÊNCIA do objeto combatente (não `.id`: todo membro do time do
  // jogador compartilha o mesmo id fixo "player", ver criarCombatenteJogador
  // em CombatSystem.js — comparar por id confundiria qual dos até 4 membros
  // foi realmente atingido).

  // Rótulo/ícone/cor de cada tipo de efeito de status possível em
  // statusEffects (ver CombatSystem.js) — usado tanto pro ícone fixo exibido
  // enquanto o efeito está ativo (indicador recorrente) quanto pro texto
  // flutuante mostrado no instante em que o efeito é aplicado pela primeira
  // vez (ver statusAplicadosAnterior mais abaixo).
  const STATUS_INFO = {
    buff_defesa: { icone: "🛡️", label: "Defesa+", classe: "bom" },
    buff_ataque_proximo: { icone: "💢", label: "Fúria!", classe: "bom" },
    furia_debuff: { icone: "📉", label: "Defesa-", classe: "ruim" },
    debuff_velocidade: { icone: "🐌", label: "Lento", classe: "ruim" },
    condicao_veneno: { icone: "☠️", label: "Veneno", classe: "ruim" },
  };
  // Guarda, por combatente, o conjunto de tipos de status já vistos na
  // última renderização — permite detectar "este efeito acabou de aparecer
  // agora" (dispara o texto flutuante) sem alterar CombatSystem.js.
  const statusAnteriorPorCombatente = new Map();

  // Rótulo/ícone de cada tipo de plano possível em Batalha.decidirAcao(),
  // usado só pra exibir a prévia — não influencia a execução em si.
  const TELEGRAFO_INFO = {
    atacar: { icone: "⚔️", texto: "vai atacar" },
    curar: { icone: "💚", texto: "vai curar um aliado" },
    proteger: { icone: "🛡️", texto: "vai proteger um aliado" },
    envenenar: { icone: "☠️", texto: "vai aplicar veneno em" },
    conjurar: { icone: "🔮", texto: "vai conjurar uma magia em" },
    roubar: { icone: "💰", texto: "vai roubar ouro do grupo" },
    invocar: { icone: "👥", texto: "vai invocar um reforço" },
    hesitar: { icone: "😨", texto: "está hesitante e vai recuar" },
    nada: { icone: "⏳", texto: "está parado" },
    atordoado: { icone: "💫", texto: "está atordoado e vai perder o turno" },
  };
  function textoTelegrafo({ inimigo, plano }) {
    const info = TELEGRAFO_INFO[plano.tipo] || TELEGRAFO_INFO.atacar;
    const mostraAlvo = plano.alvo && ["atacar", "conjurar", "envenenar"].includes(plano.tipo);
    // Item 12 de 100_melhorias.md: deixa explícito que esta é a JANELA de
    // resposta do jogador antes do golpe acontecer — o telegraph já existia,
    // só faltava dizer isso em palavras, não só implicitamente pelo ícone.
    return `${info.icone} <b>${inimigo.nome}</b> ${info.texto}${mostraAlvo ? ` <b>${plano.alvo.nome}</b>` : ""}! <span class="janela-resposta">(sua vez de agir agora, antes do golpe)</span>`;
  }
  // Efeitos visuais de combate: números de dano/cura flutuantes, flash de
  // acerto e tremor da arena, derivados apenas da diferença de HP entre uma
  // renderização e a próxima — não exigem alterar o fluxo de eventos do
  // CombatSystem.js, então funcionam tanto para ataques do jogador quanto
  // da IA inimiga.
  const hpAnterior = new Map();
  // Mapeia cada OBJETO combatente pro seu <div> de card mais recente —
  // necessário pra animarGolpe()/quebra de postura acharem o elemento certo
  // (querySelector por `c.id` não serve: TODO membro do time do jogador usa
  // o mesmo id fixo "player", ver criarCombatenteJogador em
  // CombatSystem.js — só o combate em si distingue por referência de
  // objeto, nunca por id). Atualizado a cada cardCombatente(), igual a
  // hpAnterior acima.
  const elementoPorCombatente = new Map();

  // Painel de contexto (melhoria visual/UX aditiva): nome do terreno atual
  // (mesmo `terrenoElemento` já usado pelo bônus de combate em Batalha, só
  // reaproveitado pra exibição — nenhum cálculo novo) e um atalho pro Auto
  // batalha, porque o botão Automático original (#btn-auto) fica no HUD, que
  // é escondido durante o combate (ver dispararBatalha em main.js) e por
  // isso hoje não dá pra ligar/desligar o automático no meio de uma luta.
  const infoTerreno = terrenoElemento && dados.elements ? infoElemento(terrenoElemento, dados.elements) : null;
  screenEl.dataset.battleTerrain = terrenoElemento || "";

  screenEl.classList.remove("hidden");
  screenEl.innerHTML = `
    <div class="batalha-contexto">
      <span class="contexto-terreno" title="Elemento dominante deste terreno: afeta ataques e resistências (ver task #42)">${infoTerreno ? `${infoTerreno.icone || "🗺️"} ${infoTerreno.nome}` : "🗺️ Terreno neutro"}</span>
      <button id="btn-auto-batalha" class="${autoPlayState.ativo ? "ativo" : ""}" title="Liga/desliga o modo automático (mesmo do botão Automático fora do combate)">${autoPlayState.ativo ? "⏸ Auto" : "▶ Auto"}</button>
      <button id="btn-config-ia" title="Configura como a IA do modo automático decide (modo, cura, alvos, combos)">⚙️ IA</button>
    </div>
    ${batalha.totalLevas > 1 ? `<div id="batalha-horda-badge" class="horda-badge">🌊 Leva ${batalha.levaAtual}/${batalha.totalLevas}</div>` : ""}
    ${sinergiasAtivas.map((s) => `<div class="sinergia-badge" title="${s.descricao}">${s.icone} ${s.nome}</div>`).join("")}
    <div class="batalha-retratos" id="retratos-time"></div>
    <div class="batalha-arena" id="arena"></div>
    <div id="batalha-log"></div>
    <div id="batalha-acoes"></div>
  `;
  const arena = screenEl.querySelector("#arena");
  const logEl = screenEl.querySelector("#batalha-log");
  const acoesEl = screenEl.querySelector("#batalha-acoes");
  const retratosEl = screenEl.querySelector("#retratos-time");
  // Faixa de contexto tático (intenção inimiga, fase de chefe, linha do tempo
  // de iniciativa, dica de iniciante) — entra entre o log e as ações, que é
  // onde o olho já está quando chega a vez do jogador.
  screenEl.insertBefore(contextoTaticoEl, acoesEl);

  // Barra de retratos do time (redesenho de layout inspirado na composição
  // do print de referência que o usuário mandou: faixa de retratos no topo
  // com ordem de turno, em vez de só os cards de corpo inteiro na arena).
  // Puramente visual — não lê nem decide nada de novo, só espelha o mesmo
  // `combatentesTime` que já alimenta os cards da arena logo abaixo. Usa os
  // retratos HD (assets/sprites_hd/retrato_<raca>_<classe>.png, gerados por
  // scripts/gen_assets_hd.py); se por algum motivo faltar um arquivo pra
  // uma combinação, a própria tag <img> só fica sem imagem — nunca quebra a
  // tela de combate por causa disso.
  function renderBarraRetratos() {
    if (!retratosEl) return;
    retratosEl.innerHTML = combatentesTime.map((c) => {
      const ativo = atacanteAtivo && c === atacanteAtivo;
      const pronto = c.atb >= c.atbMax && c.vivo;
      const src = c.racaId && c.classeId ? `assets/sprites_hd/retrato_${c.racaId}_${c.classeId}.png` : "";
      const pctHp = Math.max(0, (c.hp / c.hpMax) * 100);
      return `
        <div class="retrato-card${ativo ? " ativo" : ""}${pronto ? " pronto" : ""}${!c.vivo ? " morto" : ""}" title="${c.nome}">
          ${src ? `<img src="${src}" alt="${c.nome}" />` : `<div class="retrato-vazio"></div>`}
          <div class="retrato-barra"><div class="retrato-barra-fill" style="width:${pctHp}%"></div></div>
        </div>`;
    }).join("");
  }

  // Sincroniza o botão Auto do painel de contexto (e o botão Automático do
  // HUD, se por acaso já estiver visível) com autoPlayState.ativo — mesmo
  // padrão usado em alternarModoAutomatico() (main.js), só espelhado aqui
  // pra funcionar mesmo com o HUD escondido durante a batalha.
  function sincronizarBotaoAutoBatalha() {
    const btn = screenEl.querySelector("#btn-auto-batalha");
    if (btn) {
      btn.classList.toggle("ativo", autoPlayState.ativo);
      btn.textContent = autoPlayState.ativo ? "⏸ Auto" : "▶ Auto";
    }
    const btnHud = document.getElementById("btn-auto");
    if (btnHud) {
      btnHud.classList.toggle("ativo", autoPlayState.ativo);
      btnHud.textContent = autoPlayState.ativo ? "⏸ Automático" : "▶ Automático (P)";
    }
  }
  const btnAutoBatalha = screenEl.querySelector("#btn-auto-batalha");
  if (btnAutoBatalha) {
    btnAutoBatalha.addEventListener("click", () => {
      autoPlayState.ativo = !autoPlayState.ativo;
      sincronizarBotaoAutoBatalha();
      // Reusa renderAcoes() (definida mais abaixo, function declaration —
      // já disponível aqui por hoisting) em vez de duplicar a lógica de
      // agendamento: se ligou o automático no meio do turno de alguém, ela
      // mesma agenda agirAutomaticamente() pra esse combatente (guardado
      // por "ultimoAutoAgendado", ver mais abaixo) sem esperar o próximo.
      if (typeof renderAcoes === "function") renderAcoes();
    });
  }
  const btnConfigIA = screenEl.querySelector("#btn-config-ia");
  if (btnConfigIA) btnConfigIA.addEventListener("click", () => montarConfigAutoBatalha(personagem));

  function imgFor(c) {
    return imagens[c.spriteKey];
  }

  // Prévia elemental: mostra o ícone do elemento do combatente e, para
  // inimigos, se o atacante ativo do momento tem vantagem/resistência
  // contra ele (baseado no elemento da arma equipada — habilidades com
  // elemento próprio podem mudar essa relação na hora de usar). Cobre os
  // 5 níveis possíveis: vantagem intensa, vantagem, resistência,
  // resistência intensa e imunidade total.
  const SUFIXO_RELACAO = {
    vantagem_intensa: { texto: " ✅✅", titulo: "Vantagem elemental intensa" },
    vantagem: { texto: " ✅", titulo: "Vantagem elemental" },
    resistencia: { texto: " 🛡️", titulo: "Resistência elemental" },
    resistencia_intensa: { texto: " 🛡️🛡️", titulo: "Resistência elemental intensa" },
    imune: { texto: " 🚫", titulo: "Imune a este elemento" },
  };
  function badgeElemento(c) {
    if (!dados.elements || !c.elemento || c.elemento === "fisico") return "";
    const el = infoElemento(c.elemento, dados.elements);
    if (!el) return "";
    let sufixo = "";
    if (!c.isPlayer && atacanteAtivo) {
      const relacao = relacaoElemental(atacanteAtivo.elemento, c.elemento, dados.elements);
      const info = SUFIXO_RELACAO[relacao];
      if (info) sufixo = `<span title="${info.titulo}">${info.texto}</span>`;
    }
    return ` <span class="badge-elemento" title="${el.nome}">${el.icone}${sufixo}</span>`;
  }

  // Camada fixa para os números de dano/cura flutuantes: diferente dos
  // cards dos combatentes (recriados a cada tick do ATB, a cada ~140ms,
  // para animar as barras de iniciativa), essa camada nunca é limpa —
  // senão o número desapareceria junto com o card antigo antes de terminar
  // a animação de subir e sumir.
  let fxLayer = null;
  function garantirFxLayer() {
    if (!fxLayer) {
      fxLayer = document.createElement("div");
      fxLayer.className = "fx-layer";
      arena.appendChild(fxLayer);
    } else {
      arena.appendChild(fxLayer); // reanexa ao final para ficar por cima das colunas recriadas
    }
    return fxLayer;
  }

  // Camada central pro dado d20 animado (ver animarDado, DiceAnimation.js) —
  // mesmo padrão da fx-layer acima: nunca é limpa nem recriada, só reanexada
  // ao final pra ficar por cima das colunas de combatentes recriadas a cada
  // render.
  let dadoLayer = null;
  function garantirDadoLayer() {
    if (!dadoLayer) {
      dadoLayer = document.createElement("div");
      dadoLayer.className = "dado-layer";
      arena.appendChild(dadoLayer);
    } else {
      arena.appendChild(dadoLayer);
    }
    return dadoLayer;
  }

  function renderArena() {
    // Horda (task #47): mantém o contador de leva atualizado a cada
    // renderização, já que avancarLeva() troca a onda por trás sem disparar
    // nenhum evento próprio — é o mesmo re-render que já roda a cada ação.
    const hordaBadge = document.getElementById("batalha-horda-badge");
    if (hordaBadge) hordaBadge.textContent = `🌊 Leva ${batalha.levaAtual}/${batalha.totalLevas}`;
    renderBarraRetratos();
    arena.querySelectorAll(":scope > .coluna-combatentes").forEach((el) => el.remove());
    const colTime = document.createElement("div");
    colTime.className = "coluna-combatentes";
    colTime.style.display = "flex";
    colTime.style.gap = "10px";
    colTime.style.flexWrap = "wrap";
    const colInimigos = document.createElement("div");
    colInimigos.className = "coluna-combatentes";
    colInimigos.style.display = "flex";
    colInimigos.style.gap = "16px";

    const comEfeito = [];
    const comStatusNovo = [];
    let indice = 0;
    combatentesTime.forEach((c) => {
      const r = cardCombatente(c, indice++);
      colTime.appendChild(r.div);
      if (r.deltaHp) comEfeito.push(r);
      if (r.statusNovos.length) comStatusNovo.push(r);
    });
    inimigos.forEach((i) => {
      const r = cardCombatente(i, indice++);
      colInimigos.appendChild(r.div);
      if (r.deltaHp) comEfeito.push(r);
      if (r.statusNovos.length) comStatusNovo.push(r);
    });
    arena.appendChild(colTime);
    arena.appendChild(colInimigos);
    garantirFxLayer();
    garantirDadoLayer();
    comEfeito.forEach(({ div, deltaHp, critico, relacao, ruptura }) => spawnFloatingText(div, deltaHp, critico, { relacao, ruptura }));
    comStatusNovo.forEach(({ div, statusNovos }) => statusNovos.forEach((tipo, i) => spawnStatusText(div, tipo, i)));
    // A entrada (fade/slide) só deve acontecer na abertura da tela — a
    // partir daqui os cards recriados nos próximos renders já entram "no
    // lugar", sem repetir a animação de entrada (ver comentário na
    // declaração de `primeiraRenderizacao`).
    primeiraRenderizacao = false;
    // Fx pendente (crítico/cor elemental) só vale pro card recriado
    // imediatamente após ser decidido em orquestrarAcao() — consome aqui pra
    // não "vazar" pro próximo tick do ATB, que não tem relação nenhuma com
    // aquele golpe específico.
    fxPendente = null;
    // Os cards da arena foram recriados do zero: a prévia (barra-fantasma,
    // marcação de área, elo de combo) precisa ser repintada nos elementos
    // novos, senão sumiria a cada tick do ATB.
    atualizarPreviaNaArena();
  }

  function cardCombatente(c, indice) {
    const div = document.createElement("div");
    const ehAtivo = atacanteAtivo && c === atacanteAtivo;
    const ehTelegrafado = telegrafo && telegrafo.inimigo === c;
    const hpAntes = hpAnterior.has(c) ? hpAnterior.get(c) : c.hp;
    const deltaHp = c.hp - hpAntes;
    hpAnterior.set(c, c.hp);
    // Acessibilidade (melhoria pós-backlog, ver AccessibilitySystem.js):
    // "reduzir efeitos" tira o flash de acerto e o tremor de tela (ver
    // sacudirArena logo abaixo) pra quem é sensível a isso — o resto do
    // combate (números flutuantes, barras, log) continua igual.
    const flashDesligado = efeitosReduzidos();
    // Fx pendente (ver orquestrarAcao()): crítico e cor elemental do último
    // golpe, consumidos uma única vez pelo alvo certo (comparado por
    // REFERÊNCIA de objeto — ver comentário na declaração de `fxPendente`).
    const fx = fxPendente && fxPendente.alvo === c ? fxPendente : null;
    const critico = !!(fx && fx.critico);
    const entrando = primeiraRenderizacao ? " entrada-combatente" : "";
    div.className = "combatente" + (!c.vivo ? " morto" : "") + (c.atb >= c.atbMax && c.vivo ? " pronto" : "") + (ehAtivo ? " ativo" : "") + (ehTelegrafado ? " telegrafando" + (telegrafo.inimigo.chefe ? " telegrafo-chefe" : "") : "") + (deltaHp < 0 && !flashDesligado ? " hit-flash" : "") + (deltaHp < 0 && critico && !flashDesligado ? " hit-flash-critico" : "") + (c.atordoado ? " atordoado" : "") + entrando;
    div.dataset.cid = c.id;
    if (entrando) div.style.setProperty("--entrada-atraso", `${Math.min(indice, 6) * 60}ms`);
    if (fx && fx.corElemento) div.style.setProperty("--flash-color", fx.corElemento);
    const img = imgFor(c);
    const frame = c.isPlayer ? 0 : (Math.floor(Date.now() / 500) % 2) * 64;
    const iconeTelegrafo = ehTelegrafado ? ` <span class="icone-telegrafo" title="${textoTelegrafo(telegrafo).replace(/<[^>]+>/g, "")}">${(TELEGRAFO_INFO[telegrafo.plano.tipo] || TELEGRAFO_INFO.atacar).icone}</span>` : "";
    const badgeFormacao = c.isPlayer ? ` <span class="badge-formacao" title="${c.posicao === "retaguarda" ? "Retaguarda: recebe menos dano físico enquanto a frente estiver de pé" : "Frente: absorve ataques físicos e é o alvo prioritário"}">${c.posicao === "retaguarda" ? "🛡️ Retaguarda" : "⚔️ Frente"}</span>` : "";
    // Papel de combate (item 5) e comportamento de IA nomeado (item 10, ver
    // enemyBehaviors.json — já existe com nome/descrição por arquétipo, só
    // não era mostrado em lugar nenhum da UI).
    const papel = c.isPlayer && c.classeId ? PAPEL_POR_CLASSE[c.classeId] : null;
    const badgePapel = papel ? ` <span class="badge-papel" title="Papel de combate: ${papel.nome}">${papel.icone} ${papel.nome}</span>` : "";
    const comportamento = !c.isPlayer && dados.enemyBehaviors ? dados.enemyBehaviors[c.arquetipo] : null;
    const badgeComportamento = comportamento ? ` <span class="badge-comportamento" title="${comportamento.descricao}">🧠 ${comportamento.nome}</span>` : "";
    // Ícones de status ativos (melhoria: indicador visual recorrente
    // enquanto o efeito dura, além do texto flutuante no instante em que
    // aparece — ver spawnStatusText/statusAnteriorPorCombatente).
    const tiposAtivos = [...new Set(c.statusEffects.map((s) => s.tipo))].filter((t) => STATUS_INFO[t]);
    const statusIconesHTML = tiposAtivos.length
      ? `<div class="status-icones">${tiposAtivos.map((t) => `<span class="status-icone status-${STATUS_INFO[t].classe}" title="${STATUS_INFO[t].label}">${STATUS_INFO[t].icone}</span>`).join("")}</div>`
      : "";
    div.innerHTML = `
      <div class="nome-c">${c.nome}${c.chefe ? " 👑" : ""}${c.solo && !c.chefe ? ` <span title="Reforçado por estar sozinho contra o time (task #46)">💪</span>` : ""}${c.emboscada ? ` <span title="Emboscada: moradores hostis por sua reputação ruim com esta região">🗡️ Emboscada</span>` : ""}${ehAtivo ? " ⬅" : ""}${iconeTelegrafo}${badgeElemento(c)}${c.atordoado ? ` <span class="badge-atordoado" title="Atordoado: perde o turno e recebe dano extra">💫 Atordoado</span>` : ""}</div>
      ${badgeFormacao || badgePapel || badgeComportamento ? `<div class="formacao-linha">${badgeFormacao}${badgePapel}${badgeComportamento}</div>` : ""}
      <div class="sprite-wrap"><canvas width="96" height="96" class="sprite-canvas"></canvas></div>
      <div class="barra"><div class="barra-fill hp" style="width:${Math.max(0, (c.hp / c.hpMax) * 100)}%"></div><div class="barra-fantasma"><div class="fantasma-max"></div><div class="fantasma-esperado"></div><div class="fantasma-min"></div></div></div>
      <div style="font-size:0.7em">${c.hp}/${c.hpMax} HP <span class="previa-hp-rotulo"></span></div>
      ${c.chefe && c.posturaMax ? `<div class="barra postura-barra" title="Postura: fraquezas elementais enchem mais rápido. Ao encher, o chefe fica atordoado."><div class="barra-fill postura${c.atordoado ? " cheia" : ""}" style="width:${Math.max(0, (c.postura / c.posturaMax) * 100)}%"></div></div>` : ""}
      ${c.isPlayer ? `<div class="barra"><div class="barra-fill mp" style="width:${Math.max(0, (c.mp / c.mpMax) * 100)}%"></div></div>` : ""}
      <div class="atb-barra"><div class="atb-fill" style="width:${Math.min(100, c.atb)}%"></div></div>
      ${statusIconesHTML}
      ${!c.isPlayer ? `<button data-id="${c.id}" class="btn-alvo" style="margin-top:4px;font-size:0.7em;padding:3px 6px;">${alvoSelecionado && alvoSelecionado.id === c.id ? "Alvo ✓" : "Selecionar"}</button>` : ""}
    `;
    const canvas = div.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (img) ctx.drawImage(img, frame, 0, 64, 64, 16, 16, 64, 64);
    if (!c.isPlayer) {
      // Item 66: trocar de alvo precisa recalcular a mão inteira na hora —
      // dano, fraqueza, combo, execução e recomendação mudam todos juntos.
      const selecionar = () => {
        if (alvoSelecionado === c) return;
        alvoSelecionado = c;
        renderArena();
        if (painelCards && atacanteAtivo && !telegrafo) painelCards.trocouAlvo(estadoParaCards());
      };
      const btn = div.querySelector(".btn-alvo");
      if (btn) btn.onclick = selecionar;
      // O card inteiro do inimigo também seleciona (área de toque muito
      // maior no celular, item 91) — o botão continua ali para quem usa
      // teclado/leitor de tela.
      const sprite = div.querySelector(".sprite-wrap");
      if (sprite) sprite.onclick = selecionar;
    }
    if (deltaHp < 0 && !flashDesligado) sacudirArena(critico);
    // Status recém-aplicados desde a última renderização deste combatente
    // específico — dispara o texto flutuante (spawnStatusText), nunca o
    // ícone fixo sozinho (esse já é redesenhado toda vez, ver acima).
    const anteriores = statusAnteriorPorCombatente.get(c) || new Set();
    const statusNovos = tiposAtivos.filter((t) => !anteriores.has(t));
    statusAnteriorPorCombatente.set(c, new Set(tiposAtivos));
    elementoPorCombatente.set(c, div);
    // `relacao`/`ruptura` viajam junto com o fx pendente pra que o número
    // flutuante possa se diferenciar (itens 38-40): um golpe que explorou
    // fraqueza, um que foi resistido e um que encheu postura não podem
    // parecer a mesma coisa na tela.
    return { div, deltaHp, critico, statusNovos, relacao: fx ? fx.relacao : null, ruptura: fx ? fx.ruptura : null };
  }

  // Posiciona um texto flutuante usando a posição real de um elemento na
  // tela (getBoundingClientRect), então funciona corretamente mesmo com o
  // layout flex/wrap variando conforme o tamanho do time e dos inimigos.
  // `origemEl` é normalmente o `.sprite-wrap` do card (dano/cura/status) ou
  // o próprio card (miss/bloqueio, chamados antes do card ter sprite-wrap
  // atualizado). Usa a fx-layer (nunca limpa) pra sobreviver à recriação dos
  // cards a cada tick do ATB.
  function posicionarFlutuante(el, origemEl, alturaFrac = 0.25) {
    if (!origemEl || !fxLayer) return false;
    const arenaRect = arena.getBoundingClientRect();
    const origemRect = origemEl.getBoundingClientRect();
    el.style.left = `${origemRect.left - arenaRect.left + origemRect.width / 2}px`;
    el.style.top = `${origemRect.top - arenaRect.top + origemRect.height * alturaFrac}px`;
    fxLayer.appendChild(el);
    return true;
  }

  // Número de dano/cura flutuante — crítico ganha destaque extra (maior,
  // dourado, leve giro) além do "+N"/"-N" normal.
  // Rótulo curto que acompanha o número quando o golpe teve uma natureza
  // diferente de "acertou e pronto" (itens 38-40): fraqueza, resistência e
  // ruptura precisam parecer coisas distintas, não a mesma cor vermelha.
  const ROTULO_GOLPE = {
    vantagem_intensa: { txt: "VULNERÁVEL!", cls: "vulneravel" },
    vantagem: { txt: "VULNERÁVEL", cls: "vulneravel" },
    resistencia: { txt: "RESISTIDO", cls: "resistido" },
    resistencia_intensa: { txt: "MUITO RESISTIDO", cls: "resistido" },
    imune: { txt: "IMUNE", cls: "resistido" },
  };

  function spawnFloatingText(cardDiv, deltaHp, critico = false, extras = {}) {
    const spriteWrap = cardDiv.querySelector(".sprite-wrap");
    const rotulo = deltaHp < 0 && extras.relacao ? ROTULO_GOLPE[extras.relacao] : null;
    const el = document.createElement("div");
    el.className = "dano-flutuante " + (deltaHp < 0 ? "dano" : "cura")
      + (critico && deltaHp < 0 ? " critico" : "")
      + (rotulo && !critico ? ` ${rotulo.cls}` : "");
    el.textContent = (deltaHp > 0 ? "+" : "") + deltaHp + (critico && deltaHp < 0 ? "!" : "");
    if (deltaHp < 0) somDano(critico); else if (deltaHp > 0) somCura();
    // Rótulo secundário (CRÍTICO! / VULNERÁVEL! / RESISTIDO) logo abaixo do
    // número, com um leve atraso pra não competir com ele na leitura.
    const textoSecundario = critico && deltaHp < 0 ? "CRÍTICO!" : rotulo ? rotulo.txt : null;
    if (textoSecundario) {
      const sub = document.createElement("div");
      sub.className = `dano-flutuante sub-rotulo ${critico ? "critico" : rotulo ? rotulo.cls : ""}`;
      sub.textContent = textoSecundario;
      if (posicionarFlutuante(sub, spriteWrap, 0.55)) setTimeout(() => sub.remove(), duracaoAnimacao(950));
    }
    // Ruptura acumulada neste golpe (item 16/41), como um terceiro texto
    // curto — só aparece quando houve ganho real de postura.
    if (extras.ruptura && extras.ruptura > 0) {
      const rup = document.createElement("div");
      rup.className = "dano-flutuante sub-rotulo ruptura";
      rup.textContent = `RUPTURA +${extras.ruptura}`;
      if (posicionarFlutuante(rup, spriteWrap, 0.8)) setTimeout(() => rup.remove(), duracaoAnimacao(1000));
    }
    // Item 84 de 100_melhorias.md: vibração tátil opcional em dano recebido/
    // crítico, só no celular (navigator.vibrate não existe em desktop) e só
    // se "reduzir efeitos" estiver desligado (mesma bandeira que já rege
    // tremor/flash — vibração é o mesmo tipo de estímulo). Padrões curtos
    // (não incomodam) e tudo dentro de try/catch: vibração nunca pode
    // quebrar o jogo em navegadores que implementam a API de forma diferente.
    if (deltaHp < 0 && !efeitosReduzidos()) {
      try { if (navigator.vibrate) navigator.vibrate(critico ? [30, 40, 30] : 25); } catch (e) { /* silencioso de propósito */ }
    }
    if (!posicionarFlutuante(el, spriteWrap)) return;
    setTimeout(() => el.remove(), duracaoAnimacao(900));
  }

  // "ESQUIVOU!"/"BLOQUEADO!" — chamado por animarGolpe() no instante em que
  // sabe que a rolagem errou/foi bloqueada, ANTES do próximo renderArena()
  // (então usa o card ainda visível daquele alvo, não um recém-recriado).
  function spawnMissText(cardDiv, texto) {
    const spriteWrap = cardDiv.querySelector(".sprite-wrap") || cardDiv;
    const el = document.createElement("div");
    el.className = "dano-flutuante miss";
    el.textContent = texto;
    somBloqueioOuErro();
    if (!posicionarFlutuante(el, spriteWrap)) return;
    setTimeout(() => el.remove(), duracaoAnimacao(900));
  }

  // Texto flutuante de status recém-aplicado (ex.: "☠️ Veneno") — `ordem`
  // espalha múltiplos status aplicados no mesmo instante um pouco à
  // esquerda/direita pra não empilhar exatamente um em cima do outro.
  function spawnStatusText(cardDiv, tipo, ordem = 0) {
    const info = STATUS_INFO[tipo];
    if (!info) return;
    const spriteWrap = cardDiv.querySelector(".sprite-wrap");
    const el = document.createElement("div");
    el.className = `dano-flutuante status-flutuante status-${info.classe}`;
    el.textContent = `${info.icone} ${info.label}`;
    el.style.setProperty("--desvio-x", `${(ordem % 2 === 0 ? -1 : 1) * (8 + ordem * 6)}px`);
    if (!posicionarFlutuante(el, spriteWrap, 0.05)) return;
    setTimeout(() => el.remove(), duracaoAnimacao(1100));
  }

  // =====================================================================
  // PRÉVIA VISUAL NA ARENA (itens 12, 13, 63, 64, 65, 67, 95)
  //
  // Desenha, sobre a barra de HP do alvo, o pedaço que o card em foco deve
  // arrancar — em três camadas: máximo (hachurado, o "e se der tudo certo"),
  // esperado (o centro da faixa) e mínimo (o piso). É a faixa de incerteza
  // do item 13 desenhada em vez de escrita.
  //
  // Não redesenha a arena: manipula direto os elementos já em tela. Isso é o
  // que permite a prévia acompanhar o mouse a 60fps sem recriar dezenas de
  // canvas a cada movimento (item 82/90).
  // =====================================================================
  function limparPreviaNaArena() {
    for (const el of elementoPorCombatente.values()) {
      el.classList.remove("com-previa", "alvo-na-area", "alvo-principal", "aliado-na-area", "origem-combo");
      const rotulo = el.querySelector(".previa-hp-rotulo");
      if (rotulo) { rotulo.textContent = ""; rotulo.className = "previa-hp-rotulo"; }
      const fantasma = el.querySelector(".barra-fantasma");
      if (fantasma) {
        fantasma.className = "barra-fantasma";
        fantasma.querySelectorAll("div").forEach((seg) => { seg.style.width = "0%"; seg.style.right = "0%"; });
      }
    }
  }

  function pintarFantasma(alvo, { min, esperado, max, cura = false }) {
    const el = elementoPorCombatente.get(alvo);
    if (!el) return;
    const fantasma = el.querySelector(".barra-fantasma");
    const rotulo = el.querySelector(".previa-hp-rotulo");
    if (!fantasma) return;
    const hpPct = Math.max(0, Math.min(100, (alvo.hp / alvo.hpMax) * 100));
    const emPct = (v) => Math.max(0, Math.min(100, (v / alvo.hpMax) * 100));
    fantasma.className = `barra-fantasma${cura ? " fantasma-cura" : ""}`;
    const segMax = fantasma.querySelector(".fantasma-max");
    const segEsp = fantasma.querySelector(".fantasma-esperado");
    const segMin = fantasma.querySelector(".fantasma-min");
    if (cura) {
      // Cura cresce a partir do fim da barra cheia, para a direita.
      const larguraMax = Math.min(emPct(max), 100 - hpPct);
      const larguraEsp = Math.min(emPct(esperado), 100 - hpPct);
      const larguraMin = Math.min(emPct(min), 100 - hpPct);
      [[segMax, larguraMax], [segEsp, larguraEsp], [segMin, larguraMin]].forEach(([seg, larg]) => {
        if (!seg) return;
        seg.style.right = `${Math.max(0, 100 - hpPct - larg)}%`;
        seg.style.width = `${larg}%`;
      });
    } else {
      [[segMax, emPct(max)], [segEsp, emPct(esperado)], [segMin, emPct(min)]].forEach(([seg, larg]) => {
        if (!seg) return;
        const largura = Math.min(larg, hpPct);
        seg.style.right = `${100 - hpPct}%`;
        seg.style.width = `${largura}%`;
      });
    }
    el.classList.add("com-previa");
    if (rotulo) {
      if (cura) {
        rotulo.className = "previa-hp-rotulo cura";
        rotulo.textContent = `→ ${Math.min(alvo.hpMax, alvo.hp + min)}–${Math.min(alvo.hpMax, alvo.hp + max)}`;
      } else {
        const restaMin = Math.max(0, alvo.hp - max);
        const restaMax = Math.max(0, alvo.hp - min);
        const morte = restaMax <= 0;
        rotulo.className = `previa-hp-rotulo${morte ? " morte" : ""}`;
        rotulo.textContent = morte ? "→ 0 ☠" : `→ ${restaMin}–${restaMax}`;
      }
    }
  }

  function atualizarPreviaNaArena() {
    limparPreviaNaArena();
    // Item 23/67: com um card armado, a arena baixa a intensidade de tudo
    // que NÃO é alvo daquele card — o alcance da ação fica visível no campo
    // sem precisar de nenhum overlay novo.
    arena.classList.toggle("arena-com-card-armado", !!cardArmado);
    if (!previaAtiva || !previaAtiva.previsao) return;
    const p = previaAtiva.previsao;

    if (p.area) {
      // Item 63/65: todos os alvos da área ficam marcados, cada um com sua
      // própria faixa na barra.
      for (const entrada of p.area.alvos) {
        const el = elementoPorCombatente.get(entrada.alvo);
        if (el) el.classList.add("alvo-na-area");
        pintarFantasma(entrada.alvo, { min: entrada.min, esperado: entrada.esperado, max: entrada.max });
      }
      // Item 64: fogo amigo. Hoje nenhuma ação do jogo atinge aliados, mas o
      // aviso já existe e dispara sozinho se alguma passar a atingir.
      for (const aliado of p.area.aliadosNaArea) {
        const el = elementoPorCombatente.get(aliado);
        if (el) el.classList.add("aliado-na-area");
      }
      return;
    }

    if (p.cura && atacanteAtivo) {
      pintarFantasma(atacanteAtivo, { min: p.cura.efetivaMin, esperado: p.cura.efetivaEsperada, max: p.cura.efetivaMax, cura: true });
      return;
    }

    const alvo = previaAtiva.alvo;
    if (!alvo || !alvo.vivo) return;
    const el = elementoPorCombatente.get(alvo);
    if (el) {
      el.classList.add("alvo-principal");
      // Item 95: quando o card encadeia uma reação/combo, o próprio alvo
      // ganha o elo visual — é dele que vem o estado que o card vai consumir.
      if (p.reacao || p.combo) el.classList.add("origem-combo");
    }
    if (p.dano && !p.dano.imune) {
      pintarFantasma(alvo, { min: p.dano.min, esperado: p.dano.esperado, max: p.dano.max });
    }
  }

  function sacudirArena(forte = false) {
    arena.classList.remove("shake", "shake-forte");
    // força reflow para reiniciar a animação CSS mesmo se já estava tremendo
    void arena.offsetWidth;
    arena.classList.add(forte ? "shake-forte" : "shake");
  }

  function renderLog() {
    logEl.innerHTML = batalha.log.map((l) => `<div>${l}</div>`).join("");
    logEl.scrollTop = logEl.scrollHeight;
  }

  // =====================================================================
  // TURNO DO JOGADOR — MÃO DE CARDS
  //
  // Antes: `acoesEl.innerHTML = ""` e uma fileira de <button> ("Atacar",
  // "Golpe Poderoso (10 MP) [2]"), com uma linha de texto de prévia de dano
  // por baixo de alguns deles.
  //
  // Agora: um painel de cards (ver BattleCards.js) que recebe o MESMO estado
  // de batalha e devolve os mesmos quatro caminhos de execução que existiam
  // antes (ataqueBasico / usarHabilidade / usarSoproElemental / defender /
  // fugir / itens), mais dois novos e conservadores (trocar de linha na
  // formação e o submenu de itens já existente). Nenhuma regra de combate
  // mudou aqui: `resolverTurno` continua sendo o único caminho para
  // executar uma ação, e o painel só decide QUAL função chamar.
  // =====================================================================

  function estadoParaCards() {
    return {
      batalha,
      jogador: atacanteAtivo,
      alvo: alvoSelecionado && alvoSelecionado.vivo ? alvoSelecionado : null,
      aliados: combatentesTime,
      inimigosVivos: inimigos.filter((i) => i.vivo),
      intencoes,
      temItens: personagem.inventario.some((i) => i.tipo === "consumivel"),
      reposicionarBloqueado: false,
    };
  }

  function garantirPainelCards() {
    if (painelCards) return painelCards;
    painelCards = criarPainelDeCards({
      acoesEl,
      contextoEl: contextoTaticoEl,
      dados,
      onJogar: executarCard,
      onAbrirItens: () => {
        const itensUsaveis = personagem.inventario.filter((i) => i.tipo === "consumivel");
        if (itensUsaveis.length) mostrarSubmenuItens(itensUsaveis);
      },
      onPreverAlvo: (alvo, previsao) => {
        previaAtiva = previsao ? { alvo, previsao } : null;
        atualizarPreviaNaArena();
      },
      onSelecionarCard: (card) => {
        cardArmado = card;
        atualizarPreviaNaArena();
      },
    });
    return painelCards;
  }

  // Traduz o card escolhido para a MESMA chamada de `batalha` que o botão
  // equivalente fazia antes. Cada ramo aqui existia literalmente na versão
  // com botões — nenhum ramo novo de regra foi criado.
  function executarCard(card, previsao) {
    const jogador = atacanteAtivo;
    if (!jogador) return;
    const alvo = alvoSelecionado;

    if (card.tipo === "ataque") {
      resolverTurno(() => batalha.ataqueBasico(jogador, alvo));
      return;
    }
    if (card.tipo === "habilidade") {
      const h = card.habilidade;
      const destino = ["cura", "buff_defesa", "buff_ataque", "fuga"].includes(h.tipo) ? jogador : alvo;
      resolverTurno(() => batalha.usarHabilidade(jogador, h, destino));
      return;
    }
    if (card.tipo === "sopro") {
      resolverTurno(() => batalha.usarSoproElemental(jogador));
      return;
    }
    if (card.tipo === "defender") {
      resolverTurno(() => {
        jogador.defendendo = true;
        batalha.registrar(`${jogador.nome} se prepara para defender: o próximo ataque inimigo só passa se o d20 do atacante superar sua defesa.`);
        jogador.primeiroTurno = false;
        jogador.atb = 0;
      });
      return;
    }
    if (card.tipo === "reposicionar") {
      // Trocar de linha na formação. Consome o turno como qualquer outra
      // ação (mesmo `primeiroTurno = false; atb = 0` de Defender) e só toca
      // em `posicao`, que já é lido por formacaoReducaoDano()/escolherAlvoIA()
      // — nada é persistido no personagem ao fim da batalha (finalizarBatalha
      // só copia hp/mp de volta), então a formação escolhida fora do combate
      // continua sendo a formação oficial do time.
      resolverTurno(() => {
        const destino = card.destino;
        jogador.posicao = destino;
        batalha.registrar(`${jogador.nome} muda de linha e assume a ${destino === "retaguarda" ? "retaguarda" : "frente"}.`);
        jogador.primeiroTurno = false;
        jogador.atb = 0;
      });
      return;
    }
    if (card.tipo === "fugir") {
      resolverTurno(() => batalha.fugir(jogador));
    }
  }

  function renderAcoes() {
    if (telegrafo) {
      // Durante o telegraph o jogador não age (o motor de turnos já garante
      // que uma vez pronta, a ação do jogador vem ANTES da do inimigo). O
      // que mudou: a intenção continua visível na faixa de contexto depois
      // daqui, então quando a vez do jogador chegar ele ainda vê o que vem.
      acoesEl.innerHTML = `<p class="telegrafo-inimigo">${textoTelegrafo(telegrafo)}</p>`;
      if (painelCards) painelCards.invalidar();
      renderContextoSemMao();
      return;
    }
    if (!atacanteAtivo) {
      acoesEl.innerHTML = "<p style='opacity:0.7'>Aguardando barra de iniciativa...</p>";
      if (painelCards) painelCards.invalidar();
      renderContextoSemMao();
      return;
    }
    if (!alvoSelecionado || !alvoSelecionado.vivo) {
      alvoSelecionado = inimigos.find((i) => i.vivo) || null;
    }
    garantirPainelCards().desenhar(estadoParaCards());

    // Modo automático: agenda a ação do combatente ativo sozinha, uma única
    // vez por combatente (evita agendar de novo a cada re-render do mesmo
    // turno). Inalterado — a IA de auto-batalha continua sendo AutoBattleAI.js
    // e NÃO usa o conselheiro tático dos cards: são dois sistemas
    // independentes de propósito (um joga, o outro só sugere ao humano).
    if (autoPlayState.ativo && ultimoAutoAgendado !== atacanteAtivo) {
      ultimoAutoAgendado = atacanteAtivo;
      const alvoDaVez = atacanteAtivo;
      setTimeout(() => {
        if (autoPlayState.ativo && atacanteAtivo === alvoDaVez) agirAutomaticamente();
      }, duracaoAnimacao(450));
    }
  }

  // A faixa de contexto (intenção/timeline/chefe) continua útil mesmo quando
  // não é a vez do jogador — é justamente aí que ele lê o que vem por aí.
  function renderContextoSemMao() {
    if (!painelCards) garantirPainelCards();
    const estado = estadoParaCards();
    if (!estado.jogador) estado.jogador = combatentesTime.find((c) => c.vivo) || combatentesTime[0];
    if (!estado.jogador) return;
    painelCards.desenharContextoApenas(estado);
  }

  // A decisão em si (qual alvo, curar ou não, qual habilidade) mora em
  // AutoBattleAI.js (task #96) — puro, testável sem DOM/Batalha. Esta
  // função só traduz a decisão pra chamadas reais de `batalha` e mantém a
  // mesma orquestração (`resolverTurno`) de antes.
  function agirAutomaticamente() {
    const jogador = atacanteAtivo;
    if (!jogador) return;
    const config = garantirConfigAutoBatalha(personagem);
    const inimigosVivos = inimigos.filter((i) => i.vivo);
    const decisao = escolherAcaoAutomatica(jogador, inimigosVivos, config, dados);
    alvoSelecionado = decisao.alvo || null;

    if (decisao.tipo === "curar") {
      resolverTurno(() => batalha.usarHabilidade(jogador, decisao.habilidade, jogador));
    } else if (decisao.tipo === "habilidade") {
      resolverTurno(() => batalha.usarHabilidade(jogador, decisao.habilidade, decisao.alvo));
    } else if (decisao.tipo === "ataque") {
      resolverTurno(() => batalha.ataqueBasico(jogador, decisao.alvo));
    } else {
      resolverTurno(() => batalha.fugir(jogador));
    }
  }

  function mostrarSubmenuItens(itens) {
    acoesEl.innerHTML = "";
    itens.forEach((item) => {
      const precisaAlvoAliado = !!(item.curaHP || item.curaMP || item.removeStatus);
      const btn = botao(item.nome, () => {
        if (precisaAlvoAliado) {
          const vivos = combatentesTime.filter((c) => c.vivo);
          if (vivos.length > 1) { mostrarSubmenuAlvoDoItem(item, itens); return; }
          resolverTurno(() => aplicarItemEmBatalha(item, vivos[0]));
          return;
        }
        resolverTurno(() => aplicarItemEmBatalha(item));
      });
      acoesEl.appendChild(btn);
    });
    acoesEl.appendChild(botao("Voltar", renderAcoes));
  }

  // Escolher em qual aliado vivo aplicar um item de cura/mana/remoção de
  // status — só aparece quando há mais de um aliado vivo (com um só, o item
  // é aplicado direto nele). `itensDoMenuAnterior` é só pra "Voltar" reabrir
  // a lista de itens em vez de ir direto pro menu principal de ações.
  function mostrarSubmenuAlvoDoItem(item, itensDoMenuAnterior) {
    acoesEl.innerHTML = "";
    const titulo = document.createElement("div");
    titulo.style.cssText = "width:100%;font-weight:bold;margin-bottom:4px;";
    titulo.textContent = `Usar ${item.nome} em:`;
    acoesEl.appendChild(titulo);
    combatentesTime.filter((c) => c.vivo).forEach((c) => {
      const btn = botao(`${c.nome} (${c.hp}/${c.hpMax} HP · ${c.mp}/${c.mpMax} MP)`, () => resolverTurno(() => aplicarItemEmBatalha(item, c)));
      acoesEl.appendChild(btn);
    });
    acoesEl.appendChild(botao("Voltar", () => mostrarSubmenuItens(itensDoMenuAnterior)));
  }

  function aplicarItemEmBatalha(item, alvoAliado) {
    const jogador = atacanteAtivo;
    const alvo = alvoAliado || jogador;
    const prefixo = alvo === jogador ? `${jogador.nome} usa ${item.nome}` : `${jogador.nome} usa ${item.nome} em ${alvo.nome}`;
    if (item.curaHP) { alvo.hp = Math.min(alvo.hpMax, alvo.hp + item.curaHP); batalha.registrar(`${prefixo} e recupera ${item.curaHP} HP.`); }
    if (item.curaMP) { alvo.mp = Math.min(alvo.mpMax, alvo.mp + item.curaMP); batalha.registrar(`${prefixo} e recupera ${item.curaMP} MP.`); }
    if (item.removeStatus) { alvo.statusEffects = []; batalha.registrar(`${prefixo} e remove efeitos negativos.`); }
    if (item.danoMagico && alvoSelecionado) {
      let dano = Math.max(1, item.danoMagico - Math.round(batalha.defesaEfetiva(alvoSelecionado) * 0.3));
      batalha.aplicarDano(alvoSelecionado, dano);
      batalha.registrar(`${jogador.nome} usa ${item.nome} causando ${dano} de dano em ${alvoSelecionado.nome}.`);
    }
    if (item.fugaGarantida) { batalha.resultado = "fuga"; batalha.terminada = true; batalha.registrar(`${jogador.nome} usa ${item.nome} e escapa com o time!`); }
    removerItem(personagem, item.uid);
    jogador.primeiroTurno = false;
    jogador.atb = 0;
  }

  function botao(texto, onClick, desabilitado = false) {
    const b = document.createElement("button");
    b.textContent = texto;
    b.disabled = desabilitado;
    b.onclick = () => { destravarAudio(); onClick(); };
    return b;
  }

  // Duração-base (ms) de cada trecho da animação de golpe — escalada por
  // duracaoAnimacao() (multiplicador de velocidade escolhido em
  // Acessibilidade, ver AccessibilitySystem.js/DiceAnimation.js), então
  // "instantâneo" continua mostrando cada etapa, só que quase sem demora.
  const DURACAO_LUNGE = 260; // avanço do atacante em direção ao alvo
  const DURACAO_PAUSA_IMPACTO = 90; // pequena pausa no ponto de impacto antes de voltar

  // Toca a animação de "golpe acontecendo": o card do ATACANTE avança em
  // direção ao time adversário e volta, e no momento do impacto mostra
  // ESQUIVOU/BLOQUEADO se for o caso (dano/cura acertados usam o número
  // flutuante já existente, disparado pelo renderArena() logo depois desta
  // função retornar). Usa os cards JÁ RENDERIZADOS (do estado anterior a
  // esta ação) porque roda ANTES do próximo renderArena() — é assim que dá
  // pra animar "o golpe acontecendo" em vez de só mostrar o resultado final.
  async function animarGolpe(atacante, alvo, { erro = false, bloqueado = false } = {}) {
    const elAtacante = elementoPorCombatente.get(atacante);
    const elAlvo = alvo ? elementoPorCombatente.get(alvo) : null;
    const classeLunge = atacante.isPlayer ? "golpe-jogador" : "golpe-inimigo";
    if (elAtacante) elAtacante.classList.add(classeLunge);
    await sleep(duracaoAnimacao(DURACAO_LUNGE));
    if (erro && elAlvo) spawnMissText(elAlvo, "ESQUIVOU!");
    else if (bloqueado && elAlvo) spawnMissText(elAlvo, "BLOQUEADO!");
    await sleep(duracaoAnimacao(DURACAO_PAUSA_IMPACTO));
    if (elAtacante) elAtacante.classList.remove(classeLunge);
  }

  // Orquestra UMA ação de combate completa: executa a lógica de jogo (`fn`,
  // síncrona — igual a antes desta melhoria existir, então HP/MP/log/etc.
  // já refletem o resultado real assim que `fn()` retorna) e SÓ DEPOIS anima
  // e renderiza, na ordem em que o jogador deve ver: 1) dado rolando (se
  // esta ação envolveu uma rolagem de d20 — ataque, habilidade ofensiva),
  // parando exatamente no valor que JÁ foi decidido por `fn()`; 2) o golpe
  // acontecendo (avanço do atacante, ESQUIVOU/BLOQUEADO); 3) só então
  // renderArena()/renderLog(), que é quando o flash de acerto, tremor de
  // tela, números flutuantes e barras animadas entram em cena (comparando
  // com o HP/status antes desta ação, ainda preservado em hpAnterior/
  // statusAnteriorPorCombatente). O jogador nunca vê o resultado "pular"
  // pronto na tela — cada etapa é visível por si só.
  async function orquestrarAcao(fn) {
    const seqRolagemAntes = batalha.rolagemSeq;
    const seqQuebraAntes = batalha.quebraSeq;
    // Fotografia do estado ANTES da ação, para o resumo pós-ação (item 97)
    // e para a barra de postura saber quanto de ruptura este golpe rendeu.
    const hpAntesPorAlvo = new Map(batalha.todos().map((c) => [c, c.hp]));
    const posturaAntesPorAlvo = new Map(batalha.todos().map((c) => [c, c.postura || 0]));
    const estadosAntes = new Map(batalha.todos().map((c) => [c, new Set(c.statusEffects.map((s) => s.estadoId || s.tipo))]));

    const resultado = fn();
    const rolagem = batalha.ultimaRolagem && batalha.ultimaRolagem.seq > seqRolagemAntes ? batalha.ultimaRolagem : null;

    // Item 71: o d20 aparecia em TODA rolagem, o que transformava um ataque
    // básico repetido em um segundo de espera a cada clique. Agora a
    // animação é reservada para o que merece atenção — crítico, falha
    // crítica, natural 20/1 e mecânica de chefe (quebra de postura). O
    // jogador que quiser ver todos os dados desliga isso nas configurações
    // da mão de cards.
    const naturalVinte = rolagem && rolagem.d === 20;
    const naturalUm = rolagem && rolagem.d === 1;
    const vaiQuebrarPostura = batalha.ultimaQuebra && batalha.ultimaQuebra.seq > seqQuebraAntes;
    const dadoImportante = !!(rolagem && (rolagem.critico || rolagem.erroTotal || naturalVinte || naturalUm || vaiQuebrarPostura));
    if (rolagem && (!dadoSomenteImportante() || dadoImportante)) {
      garantirDadoLayer();
      somDadoParou(rolagem.critico);
      await animarDado(dadoLayer, rolagem.d, { critico: rolagem.critico, fumble: rolagem.erroTotal });
    } else if (rolagem) {
      // Sem a animação completa, o som curto de rolagem continua marcando
      // que houve um dado — nunca "pula" o resultado em silêncio.
      somDadoParou(rolagem.critico);
    }
    // Itens 72/73: natural 20 e natural 1 ganham um momento próprio, curto.
    if (naturalVinte || naturalUm) {
      mostrarFaixaCentral(naturalVinte ? "NATURAL 20" : "NATURAL 1", naturalVinte ? "faixa-nat20" : "faixa-nat1");
      await sleep(duracaoAnimacao(280));
    }

    if (rolagem && rolagem.atacante && rolagem.alvo) {
      await animarGolpe(rolagem.atacante, rolagem.alvo, { erro: rolagem.erroTotal, bloqueado: rolagem.bloqueado });
      // Fx pendente (crítico + cor do elemento do golpe) pro próximo
      // cardCombatente() do alvo — ver declaração de `fxPendente` mais
      // acima. Só golpes que realmente acertaram (não erro/bloqueio)
      // ganham a cor elemental, senão um "erro" sem dano nenhum herdaria a
      // borda colorida por engano.
      const elementoAtacante = rolagem.atacante.elemento;
      const acertou = !rolagem.erroTotal && !rolagem.bloqueado;
      const elInfo = acertou && dados.elements ? infoElemento(elementoAtacante, dados.elements) : null;
      const relacao = acertou && dados.elements
        ? relacaoElemental(elementoAtacante, rolagem.alvo.elemento || "fisico", dados.elements)
        : null;
      const ganhoRuptura = Math.max(0, (rolagem.alvo.postura || 0) - (posturaAntesPorAlvo.get(rolagem.alvo) || 0));
      fxPendente = {
        alvo: rolagem.alvo,
        critico: rolagem.critico,
        corElemento: elInfo ? elInfo.cor : null,
        relacao: relacao && relacao !== "neutro" ? relacao : null,
        ruptura: ganhoRuptura,
      };
      // Hit-stop de crítico (item 42): pausa MUITO curta (90ms) — o
      // suficiente para o golpe "pesar", longe de travar o jogo.
      if (rolagem.critico && acertou && !animacoesReduzidas()) {
        arena.classList.remove("hit-stop");
        void arena.offsetWidth;
        arena.classList.add("hit-stop");
        await sleep(duracaoAnimacao(90));
        arena.classList.remove("hit-stop");
      }
    }
    // Quebra de postura (chefe atordoado nesta mesma ação): um momento
    // visual à parte, mais demorado e vistoso que o flash de acerto comum —
    // ver spawnMissText/renderArena logo depois pra ver o HP/postura já
    // atualizados.
    const quebra = batalha.ultimaQuebra && batalha.ultimaQuebra.seq > seqQuebraAntes ? batalha.ultimaQuebra : null;
    if (quebra && quebra.alvo) {
      const elQuebra = elementoPorCombatente.get(quebra.alvo);
      if (elQuebra) {
        elQuebra.classList.add("quebra-postura");
        spawnMissText(elQuebra, "💥 ATORDOADO!");
        setTimeout(() => elQuebra.classList.remove("quebra-postura"), duracaoAnimacao(700));
      }
      // Item 41: faixa "POSTURA ROMPIDA" no centro da arena + som próprio.
      mostrarFaixaCentral("POSTURA ROMPIDA", "faixa-ruptura");
      somRuptura();
      await sleep(duracaoAnimacao(500));
    }

    renderArena();
    renderLog();
    montarResumoPosAcao({ hpAntesPorAlvo, posturaAntesPorAlvo, estadosAntes, rolagem, quebra });
    return resultado;
  }

  // Faixa curta no centro da arena (POSTURA ROMPIDA, NATURAL 20, NATURAL 1).
  // Some sozinha; nunca bloqueia clique (pointer-events: none no CSS).
  function mostrarFaixaCentral(texto, classe) {
    if (animacoesReduzidas() && classe !== "faixa-ruptura") return;
    garantirFxLayer();
    if (!fxLayer) return;
    const el = document.createElement("div");
    el.className = classe;
    el.textContent = texto;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), duracaoAnimacao(900));
  }

  // Item 97: resumo do que acabou de acontecer, em 2-4 fichas que somem em
  // ~2s. Lido do DIFF de estado real (HP, postura, status), não de um texto
  // paralelo — então nunca diverge do que o motor fez.
  function montarResumoPosAcao({ hpAntesPorAlvo, posturaAntesPorAlvo, estadosAntes, rolagem, quebra }) {
    if (!painelCards) return;
    const partes = [];
    let maiorDano = 0;
    let alvoMaiorDano = null;
    let curaTotal = 0;
    for (const c of batalha.todos()) {
      const antes = hpAntesPorAlvo.get(c);
      if (antes == null) continue;
      const delta = c.hp - antes;
      if (delta < 0 && -delta > maiorDano) { maiorDano = -delta; alvoMaiorDano = c; }
      if (delta > 0) curaTotal += delta;
    }
    if (maiorDano > 0) partes.push({ txt: `DANO ${maiorDano}`, cls: "" });
    if (curaTotal > 0) partes.push({ txt: `CURA ${curaTotal}`, cls: "chip-vuln" });
    if (rolagem && rolagem.critico) partes.push({ txt: "CRÍTICO", cls: "chip-critico" });
    if (rolagem && rolagem.erroTotal) partes.push({ txt: "ERROU", cls: "chip-resist" });
    if (rolagem && rolagem.bloqueado) partes.push({ txt: "BLOQUEADO", cls: "chip-resist" });
    if (alvoMaiorDano) {
      const ganho = (alvoMaiorDano.postura || 0) - (posturaAntesPorAlvo.get(alvoMaiorDano) || 0);
      if (ganho > 0) partes.push({ txt: `RUPTURA +${ganho}`, cls: "chip-ruptura" });
      const antes = estadosAntes.get(alvoMaiorDano) || new Set();
      for (const s of alvoMaiorDano.statusEffects) {
        const chave = s.estadoId || s.tipo;
        if (antes.has(chave)) continue;
        const nome = (s.def && s.def.nome) || (STATUS_INFO[s.tipo] && STATUS_INFO[s.tipo].label) || null;
        if (nome) partes.push({ txt: nome.toUpperCase(), cls: "chip-status" });
      }
    }
    if (quebra) partes.push({ txt: "POSTURA ROMPIDA", cls: "chip-ruptura" });
    painelCards.mostrarResumo(partes.slice(0, 4));
  }

  async function resolverTurno(fn) {
    // Trava contra clique duplo/agendamento automático simultâneo enquanto
    // a animação da ação anterior ainda está rodando (ver declaração de
    // `turnoEmAndamento`).
    if (turnoEmAndamento) return;
    turnoEmAndamento = true;
    if (acoesEl) acoesEl.classList.add("acoes-bloqueadas");
    const atorDoTurno = atacanteAtivo;
    await orquestrarAcao(fn);
    batalha.tickCooldowns(atorDoTurno);
    batalha.aplicarStatusTick(atorDoTurno);
    filaAcao.shift();
    // Libera o agendamento automático: como há poucos membros no time, o
    // mesmo combatente (mesma referência de objeto) volta a ficar ativo em
    // turnos futuros, e sem isso o agendamento "uma vez por combatente" nunca
    // dispararia de novo para ele.
    ultimoAutoAgendado = null;
    turnoEmAndamento = false;
    if (acoesEl) acoesEl.classList.remove("acoes-bloqueadas");
    // Item 5: a recomendação nunca pode ser permanente. Depois de QUALQUER
    // ação (recarga que mudou, Éter gasto, status novo, inimigo que caiu), a
    // avaliação da mão é descartada — a próxima leitura recalcula do zero,
    // com o estado real.
    previaAtiva = null;
    cardArmado = null;
    if (painelCards) painelCards.invalidar();
    posAcao();
  }

  function posAcao() {
    renderArena();
    renderLog();
    if (batalha.verificarFim()) {
      finalizarBatalha();
      return;
    }
    avancarFila();
  }

  // Decide o próximo passo depois que uma ação termina (turno do jogador
  // resolvido, ou telegraph+execução de um inimigo concluído). Prioriza
  // turnos do JOGADOR sobre a fila de telegraph dos inimigos: se os dois
  // ficam prontos no mesmo instante, o jogador age primeiro — é essa ordem
  // que dá o "tempo pra reagir" pedido pro telegraph, porque deixa o
  // jogador clicar em Defender (ou curar, etc.) antes do golpe do inimigo
  // ser resolvido, em vez de só assistir o aviso passivamente. Só libera o
  // loop de ATB (pausado = false) quando não sobra nada pra fazer.
  function avancarFila() {
    atacanteAtivo = null;
    filaAcao = filaAcao.filter((c) => c.vivo);
    // Um inimigo enfileirado pode morrer (atacado pelo jogador) antes de sua
    // própria vez chegar — descarta essas entradas em vez de telegrafar uma
    // ação de um combatente já derrotado.
    //
    // Quando esse inimigo TINHA uma intenção anunciada, isso é exatamente a
    // promessa que o card de interrupção fez ao jogador ("abate o inimigo
    // antes do golpe"). Antes, a ação simplesmente sumia em silêncio; agora o
    // jogo diz que ela foi cancelada — sem isso, a única confirmação de que a
    // leitura tática estava certa seria o jogador reparar numa ausência.
    for (const morto of filaInimigos.filter((c) => !c.vivo)) {
      if (intencoes.has(morto)) {
        batalha.registrar(`⚡ ${morto.nome} cai antes de agir: a ação anunciada foi INTERROMPIDA!`);
        if (painelCards) painelCards.mostrarResumo([{ txt: "⚡ INTERROMPIDO", cls: "chip-ruptura" }]);
      }
      intencoes.delete(morto);
    }
    filaInimigos = filaInimigos.filter((c) => c.vivo);
    if (filaAcao.length) {
      // Estado elemental que controla o turno (hoje só Congelado — Caminhos
      // do Herdeiro, task #91): o membro do time perde a ação automaticamente,
      // igual à IA inimiga em decidirAcao()/"controlado_elemental".
      if (batalha.jogadorControladoPorEstado(filaAcao[0])) {
        batalha.perderTurnoJogadorPorEstado(filaAcao[0]);
        filaAcao.shift();
        renderArena();
        renderLog();
        avancarFila();
        return;
      }
      pausado = true;
      atacanteAtivo = filaAcao[0];
      renderAcoes();
      return;
    }
    if (filaInimigos.length) {
      pausado = true;
      iniciarTelegrafo(filaInimigos[0]);
      return;
    }
    pausado = false;
    renderAcoes();
  }

  // =====================================================================
  // INTENÇÃO INIMIGA (itens 20, 21, 44, 45)
  //
  // O plano de cada inimigo é decidido UMA ÚNICA VEZ — no instante em que
  // ele entra na fila, e não quando o telegraph aparece. Isso conserta um
  // problema real da versão anterior: `decidirAcao()` contém sorteios (o
  // arquétipo Ladrão rouba com 60% de chance, por exemplo), então chamá-la
  // uma vez para exibir e outra para executar podia mostrar uma intenção e
  // executar outra. Agora a intenção exibida é literalmente o plano que vai
  // rodar — e é isso que torna honesto tudo que a mão de cards diz sobre
  // "dano evitado", "melhor resposta" e "interrupção".
  // =====================================================================
  function registrarIntencao(inimigo) {
    if (!inimigo || !inimigo.vivo) return;
    const plano = batalha.decidirAcao(inimigo);
    const faixa = batalha.estimarDanoIntencao(inimigo, plano);
    intencoes.set(inimigo, { plano, faixa });
    if (painelCards) painelCards.invalidar();
  }

  function limparIntencoesObsoletas() {
    for (const inimigo of [...intencoes.keys()]) {
      if (!inimigo.vivo || (!filaInimigos.includes(inimigo) && !(telegrafo && telegrafo.inimigo === inimigo))) {
        intencoes.delete(inimigo);
      }
    }
  }

  // Uma ação telegrafada é CANCELADA quando o inimigo perde a capacidade de
  // agir antes de executá-la. Não é um sistema novo: são exatamente as três
  // condições que o motor de combate já respeita em decidirAcao() (morte,
  // atordoamento por quebra de postura, e controle por estado elemental —
  // hoje, Congelado). O que muda é que agora isso é VISÍVEL e previsível: a
  // mão de cards consegue prometer "este card interrompe" porque a promessa
  // é verificável aqui.
  function motivoDeInterrupcao(inimigo) {
    if (!inimigo.vivo) return { icone: "☠️", texto: "foi derrotado antes de agir" };
    if (inimigo.chefe && inimigo.atordoado) return { icone: "💫", texto: "teve a postura quebrada e perdeu a ação" };
    if (batalha.jogadorControladoPorEstado(inimigo)) return { icone: "🧊", texto: "está controlado e perdeu a ação" };
    return null;
  }

  // Prévia de intenção ("telegraph"): mostra o que o inimigo vai fazer (e em
  // quem) por um pequeno intervalo antes de executar de fato — dá ao
  // jogador uma janela pra reagir (ex.: usar Defender) antes do golpe.
  function iniciarTelegrafo(inimigo) {
    const registrada = intencoes.get(inimigo);
    let plano = registrada ? registrada.plano : batalha.decidirAcao(inimigo);
    // Guarda contra plano obsoleto: como a intenção agora é fixada antes de o
    // inimigo estar pronto, o alvo escolhido pode ter morrido no meio-tempo.
    // Sem isto, executarAcao() atacaria um combatente já derrotado (o
    // fallback do motor só cobre `plano.alvo` nulo, não um alvo morto).
    if (plano && plano.alvo && !plano.alvo.vivo) {
      plano = batalha.decidirAcao(inimigo);
      intencoes.set(inimigo, { plano, faixa: batalha.estimarDanoIntencao(inimigo, plano) });
    } else if (!registrada) {
      intencoes.set(inimigo, { plano, faixa: batalha.estimarDanoIntencao(inimigo, plano) });
    }
    telegrafo = { inimigo, plano };
    renderArena();
    renderAcoes();
    // Duração do telegraph também obedece a velocidade de animação de
    // combate escolhida em Acessibilidade (ver DiceAnimation.js) — em modo
    // automático já era mais curto de propósito, isso continua igual.
    const atraso = duracaoAnimacao(autoPlayState.ativo ? 450 : 900);
    setTimeout(async () => {
      telegrafo = null;
      // O inimigo já deve ter sido removido da fila, mas usa filter por
      // segurança caso a mesma referência apareça mais de uma vez.
      filaInimigos = filaInimigos.filter((c) => c !== inimigo);
      intencoes.delete(inimigo);
      if (painelCards) painelCards.invalidar();
      if (batalha.terminada) return;
      // INTERRUPÇÃO (itens 20/21): entre o telegraph aparecer e a ação sair,
      // o jogador pode ter mudado o quadro. Se o inimigo perdeu a capacidade
      // de agir nesse meio-tempo, a ação anunciada NÃO acontece — e o jogo
      // diz isso em voz alta, em vez de a ação simplesmente sumir.
      const interrupcao = motivoDeInterrupcao(inimigo);
      if (interrupcao) {
        if (inimigo.vivo) {
          batalha.registrar(`${interrupcao.icone} ${inimigo.nome} ${interrupcao.texto}: a ação anunciada foi INTERROMPIDA!`);
          // O turno perdido é consumido pelo próprio motor, com as mesmas
          // regras de sempre (ver executarAcao/"atordoado"/"controlado_elemental").
          batalha.executarAcao(inimigo, { tipo: inimigo.atordoado ? "atordoado" : "controlado_elemental", alvo: null });
          if (painelCards) painelCards.mostrarResumo([{ txt: "⚡ INTERROMPIDO", cls: "chip-ruptura" }]);
        }
        renderArena();
        renderLog();
      } else if (inimigo.vivo) {
        await orquestrarAcao(() => {
          batalha.executarAcao(inimigo, plano);
          batalha.tickCooldowns(inimigo);
          batalha.aplicarStatusTick(inimigo);
        });
      } else {
        renderArena();
        renderLog();
      }
      if (batalha.verificarFim()) {
        finalizarBatalha();
        return;
      }
      avancarFila();
    }, atraso);
  }

  function loopATB() {
    intervalId = setInterval(() => {
      if (pausado || batalha.terminada) return;
      const prontos = batalha.avancarATB(1.6);
      for (const c of prontos) {
        if (!c.vivo) continue;
        if (c.isPlayer) {
          if (!filaAcao.includes(c)) filaAcao.push(c);
        } else if (!filaInimigos.includes(c)) {
          filaInimigos.push(c);
          registrarIntencao(c);
        }
      }
      // Intenção ANTECIPADA (encontrado no teste de integração): registrar o
      // plano só quando o inimigo já está pronto era tarde demais — o loop de
      // ATB fica pausado durante o turno do jogador, então na prática ele
      // decidia sem nunca ver o que vinha. Agora a intenção é fixada quando a
      // barra do inimigo passa de 85%, o que dá ao jogador uma janela real
      // para responder (itens 21/45) sem mudar nada de quando ele age.
      for (const inimigo of inimigos) {
        if (!inimigo.vivo || intencoes.has(inimigo)) continue;
        if (inimigo.atb >= inimigo.atbMax * LIMIAR_INTENCAO_ANTECIPADA) registrarIntencao(inimigo);
      }
      limparIntencoesObsoletas();
      renderArena();
      renderLog();
      if (batalha.terminada) {
        clearInterval(intervalId);
        intervalId = null;
        finalizarBatalha();
        return;
      }
      if (!pausado && (filaInimigos.length || filaAcao.length)) avancarFila();
    }, 140);
  }

  function finalizarBatalha() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    // A mão de cards e a faixa de contexto não fazem sentido depois do fim —
    // e o listener global de "clique fora cancela a seleção" precisa sair
    // junto, senão sobreviveria à tela de batalha.
    if (painelCards) { painelCards.destruir(); painelCards = null; }
    intencoes.clear();
    previaAtiva = null;
    cardArmado = null;
    contextoTaticoEl.innerHTML = "";
    arena.classList.remove("arena-com-card-armado");
    time.forEach((membro, i) => {
      const c = combatentesTime[i];
      membro.hp = Math.max(0, Math.min(membro.hpMax, c.hp));
      membro.mp = Math.max(0, Math.min(membro.mpMax, c.mp));
    });

    // Ouro roubado por inimigos Ladrão durante a luta já foi perdido,
    // independente do resultado final da batalha (vitória não recupera).
    // Anexado direto ao HTML do log (em vez de batalha.registrar) porque o
    // último renderLog() já rodou antes de finalizarBatalha ser chamada.
    if (batalha.ouroRoubado > 0) {
      const roubado = Math.min(personagem.ouro, batalha.ouroRoubado);
      personagem.ouro -= roubado;
      if (roubado > 0) logEl.innerHTML += `<div>💰 Um Ladrão levou ${roubado} de ouro durante a batalha!</div>`;
    }

    if (batalha.resultado === "vitoria") {
      let totalXP = 0, totalOuro = 0, totalFragmentos = 0;
      const itensGanhos = [];
      let derrotouChefeMasmorra = false;
      let derrotouAlgumChefe = false;
      const nomesChefesDerrotados = [];
      // Horda (task #47): usa historicoInimigos (TODAS as ondas), não o
      // `inimigos` local (que só reflete a onda atual/última) — senão a
      // recompensa de uma horda de 5 ondas contaria só a última.
      batalha.historicoInimigos.forEach((i) => {
        totalXP += i.xp;
        totalOuro += Math.floor(i.ouroMin + Math.random() * (i.ouroMax - i.ouroMin + 1));
        registrarAbate(personagem, i.monstroId);
        const totalAbatesDesteMonstro = registrarAbateCompendio(personagem, i.monstroId);
        registrarProgressoDiario(personagem, "abate", 1);
        if (i.monstroId === "dragao_jovem") derrotouChefeMasmorra = true;
        if (i.chefe) {
          derrotouAlgumChefe = true;
          nomesChefesDerrotados.push(i.nome);
          // Caminhos do Herdeiro (task #92): 1º abate de um chefe qualquer
          // concede 1 ponto de Herança pro personagem principal — só na
          // primeira vez (repetir o mesmo chefe depois não gera ponto de
          // novo, pra não virar fazenda infinita de pontos). O NÓ de
          // herança específico (ver heritageTree.json) pode continuar
          // bloqueado até o gatilho narrativo dele bater, independente
          // desse ponto já existir na carteira do jogador.
          if (totalAbatesDesteMonstro === 1) concederPontoHeranca(personagem, { tipo: "chefe_derrotado", monstroId: i.monstroId, nome: i.nome });
        }
        const tabela = dados.lootTables[i.monstroId];
        if (tabela && Math.random() < tabela.chanceDrop) {
          const item = sortearLoot(tabela.pool, dados.items.itens);
          if (item) itensGanhos.push(item);
        }
        if (personagem.tracoId === "ganancioso" && tabela && Math.random() < 0.5) {
          const item2 = sortearLoot(tabela.pool, dados.items.itens);
          if (item2) itensGanhos.push(item2);
        }
      });
      personagem.ouro += totalOuro;
      itensGanhos.forEach((item) => personagem.inventario.push({ ...item, uid: cryptoId() }));
      registrarProgressoDiario(personagem, "vitoria", 1);

      time.forEach((membro) => {
        const { ganho, subiuNivel } = ganharXP(membro, totalXP);
        subiuNivel.forEach((novoNivel) => { aplicarCrescimento(membro, dados); concederPontosPorNivel(membro, novoNivel); });
        // Resumo do automático (item 16): só o personagem principal, pra não
        // somar XP do time de gacha em cima do XP do protagonista (números
        // que o jogador não consegue comparar diretamente com nada na UI).
        if (autoPlayState.ativo && membro === combatentesTime[0]) registrarGanhosAuto({ xp: ganho });
      });

      if (derrotouChefeMasmorra) totalFragmentos += FRAGMENTOS.RECOMPENSA_CHEFE_MASMORRA;
      if (Math.random() < FRAGMENTOS.CHANCE_BONUS_EVENTO_POS_BATALHA) {
        totalFragmentos += FRAGMENTOS.BONUS_EVENTO_VALOR;
        batalha.registrar(`Evento especial! +${FRAGMENTOS.BONUS_EVENTO_VALOR} Fragmentos de Aethra.`);
      }
      if (totalFragmentos > 0) adicionarFragmentos(personagem, totalFragmentos);
      checarConquistas(personagem, { venceuBatalha: true, derrotouDragao: derrotouChefeMasmorra, explorouMasmorra: derrotouChefeMasmorra });

      // Mundo reativo: derrotar um chefe é uma ameaça a menos pra vila —
      // reputação sobe bem mais do que uma missão comum (ver
      // WorldStateSystem.js). Consequência persistente, refletida depois em
      // preços de loja e saudações de NPC (ver GameUI.js).
      let msgReputacao = "";
      if (derrotouAlgumChefe) {
        alterarReputacao(personagem, "vila", REPUTACAO_POR_CHEFE, dados.worldStateVariables);
        msgReputacao = ` (+${REPUTACAO_POR_CHEFE} reputação com a vila)`;
        // Regionalidade (task #44): também sobe reputação com a facção dona
        // da zona/masmorra onde o chefe caiu — livrar o território de uma
        // ameaça importa mais pra quem vive perto dela do que pra vila.
        if (facaoZona && facaoZona !== "vila") {
          alterarReputacao(personagem, facaoZona, REPUTACAO_POR_CHEFE, dados.worldStateVariables);
          const nomeFaccao = (dados.worldStateVariables.facoes || []).find((f) => f.id === facaoZona);
          if (nomeFaccao) msgReputacao += ` (+${REPUTACAO_POR_CHEFE} reputação com ${nomeFaccao.nome})`;
        }
        registrarDecisao(personagem, { icone: "⚔️", titulo: `Chefe derrotado: ${nomesChefesDerrotados.join(", ")}`, texto: `Você livrou a região de uma ameaça${msgReputacao}.` });
      }

      acoesEl.innerHTML = "";
      logEl.innerHTML += `<div><b>VITÓRIA!</b> +${totalXP} XP (todo o time), +${totalOuro} ouro${totalFragmentos ? `, +${totalFragmentos} Fragmentos de Aethra` : ""}${itensGanhos.length ? `, itens: ${itensGanhos.map((i) => i.nome).join(", ")}` : ""}${msgReputacao}</div>`;
      if (escolhaPendente(personagem, dados)) {
        logEl.innerHTML += `<div>🌟 Nova escolha de habilidade disponível! Abra o menu Habilidades (T).</div>`;
      }
      logEl.scrollTop = logEl.scrollHeight;
      const btn = botao("Continuar", () => { screenEl.classList.add("hidden"); onFim("vitoria"); });
      btn.className = "primario";
      acoesEl.appendChild(btn);
      agendarContinuarAutomatico(btn);
    } else if (batalha.resultado === "fuga") {
      acoesEl.innerHTML = "";
      const btn = botao("Continuar", () => { screenEl.classList.add("hidden"); onFim("fuga"); });
      acoesEl.appendChild(btn);
      agendarContinuarAutomatico(btn);
    } else {
      // Derrota: o time nunca "acaba a aventura" — apenas volta à vila (com
      // HP mínimo e uma pequena perda de ouro) e o jogo continua normalmente,
      // inclusive no modo automático, que segue andando sozinho depois.
      time.forEach((membro) => { membro.hp = Math.max(1, Math.round(membro.hpMax * 0.25)); });
      const ouroPerdido = Math.floor(personagem.ouro * 0.15);
      personagem.ouro -= ouroPerdido;
      acoesEl.innerHTML = "";
      logEl.innerHTML += `<div><b>DERROTA...</b> O time foi resgatado e voltou à vila, perdendo ${ouroPerdido} de ouro.</div>`;
      const btn = botao("Voltar à vila", () => { screenEl.classList.add("hidden"); onFim("derrota"); });
      btn.className = "perigo";
      acoesEl.appendChild(btn);
      agendarContinuarAutomatico(btn);
    }
  }

  function agendarContinuarAutomatico(btn) {
    if (!autoPlayState.ativo) return;
    setTimeout(() => {
      if (autoPlayState.ativo && !screenEl.classList.contains("hidden")) btn.click();
    }, duracaoAnimacao(900));
  }

  renderArena();
  renderLog();
  renderAcoes();
  loopATB();
}
