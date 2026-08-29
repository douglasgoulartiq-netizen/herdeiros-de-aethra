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
import { somDadoParou, somDano, somCura, somBloqueioOuErro, destravarAudio } from "./SoundFX.js";

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
    comEfeito.forEach(({ div, deltaHp, critico }) => spawnFloatingText(div, deltaHp, critico));
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
      <div class="barra"><div class="barra-fill hp" style="width:${Math.max(0, (c.hp / c.hpMax) * 100)}%"></div></div>
      <div style="font-size:0.7em">${c.hp}/${c.hpMax} HP</div>
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
      const btn = div.querySelector(".btn-alvo");
      if (btn) btn.onclick = () => { alvoSelecionado = c; renderArena(); };
    }
    if (deltaHp < 0 && !flashDesligado) sacudirArena(critico);
    // Status recém-aplicados desde a última renderização deste combatente
    // específico — dispara o texto flutuante (spawnStatusText), nunca o
    // ícone fixo sozinho (esse já é redesenhado toda vez, ver acima).
    const anteriores = statusAnteriorPorCombatente.get(c) || new Set();
    const statusNovos = tiposAtivos.filter((t) => !anteriores.has(t));
    statusAnteriorPorCombatente.set(c, new Set(tiposAtivos));
    elementoPorCombatente.set(c, div);
    return { div, deltaHp, critico, statusNovos };
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
  function spawnFloatingText(cardDiv, deltaHp, critico = false) {
    const spriteWrap = cardDiv.querySelector(".sprite-wrap");
    const el = document.createElement("div");
    el.className = "dano-flutuante " + (deltaHp < 0 ? "dano" : "cura") + (critico && deltaHp < 0 ? " critico" : "");
    el.textContent = (deltaHp > 0 ? "+" : "") + deltaHp + (critico && deltaHp < 0 ? "!" : "");
    if (deltaHp < 0) somDano(critico); else if (deltaHp > 0) somCura();
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

  function renderAcoes() {
    acoesEl.innerHTML = "";
    if (telegrafo) {
      acoesEl.innerHTML = `<p class="telegrafo-inimigo">${textoTelegrafo(telegrafo)}</p>`;
      return;
    }
    if (!atacanteAtivo) {
      acoesEl.innerHTML = "<p style='opacity:0.7'>Aguardando barra de iniciativa...</p>";
      return;
    }
    const jogador = atacanteAtivo;
    if (!alvoSelecionado || !alvoSelecionado.vivo) {
      alvoSelecionado = inimigos.find((i) => i.vivo) || null;
    }

    const nomeAtivo = document.createElement("div");
    nomeAtivo.style.cssText = "width:100%;font-weight:bold;margin-bottom:4px;";
    nomeAtivo.textContent = `Ação de: ${jogador.nome}`;
    acoesEl.appendChild(nomeAtivo);

    // Prévia de combo elemental (melhoria de jogabilidade, ver
    // COMBOS_ELEMENTAIS/verificarComboElemental em CombatSystem.js): se um
    // ALIADO diferente do combatente ativo foi o último a acertar o alvo
    // selecionado, e o elemento dele combina com o elemento de `jogador`,
    // avisa ANTES de confirmar o ataque — sem isso, o combo só aparecia no
    // log depois do golpe já ter sido resolvido.
    if (alvoSelecionado && batalha.ultimoAtaqueAliado && batalha.ultimoAtaqueAliado.alvo === alvoSelecionado && batalha.ultimoAtaqueAliado.atacante !== jogador) {
      const combo = comboDoisElementos(batalha.ultimoAtaqueAliado.elemento, jogador.elemento);
      if (combo) {
        const previa = document.createElement("p");
        previa.className = "combo-preview";
        previa.title = "Atacar este alvo agora encadeia o combo elemental.";
        previa.innerHTML = `${combo.icone} Combo pronto contra <b>${alvoSelecionado.nome}</b>: <b>${combo.nome}</b>!`;
        acoesEl.appendChild(previa);
      }
    }

    // Prévia de dano (item 1 de 100_melhorias.md): mostra uma FAIXA (não o
    // valor exato — isso continua vindo só da rolagem real) calculada por
    // estimarFaixaDano(), que nunca decide o resultado, só lê o mesmo estado
    // que rolarAtaque() já leria. Some sozinha se o alvo morrer/for trocado.
    function elementoPreviaTexto(faixa) {
      if (!faixa) return "";
      if (faixa.imune) return ` <span class="dano-estimado imune">Alvo imune a este elemento — 0 de dano.</span>`;
      const relacaoTxt = { vantagem_intensa: " (vantagem elemental intensa)", vantagem: " (vantagem elemental)", resistencia: " (resistência elemental)", resistencia_intensa: " (resistência elemental intensa)" }[faixa.relacaoElemental] || "";
      return ` <span class="dano-estimado" title="Faixa estimada de dano contra o alvo selecionado; crítico dobra o valor.">🎯 ${faixa.min}–${faixa.max}${relacaoTxt} <span class="dano-estimado-critico">(crítico: ${faixa.minCritico}–${faixa.maxCritico})</span></span>`;
    }

    const btnAtacar = botao("Atacar", () => resolverTurno(() => batalha.ataqueBasico(jogador, alvoSelecionado)));
    acoesEl.appendChild(btnAtacar);
    if (alvoSelecionado && alvoSelecionado.vivo) {
      const previaAtacar = document.createElement("p");
      previaAtacar.className = "linha-previa-dano";
      previaAtacar.innerHTML = elementoPreviaTexto(batalha.estimarFaixaDano(jogador, alvoSelecionado));
      acoesEl.appendChild(previaAtacar);
    }

    jogador.habilidades.forEach((h) => {
      const desabilitado = h.cooldownAtual > 0 || jogador.mp < h.custoMP;
      const btn = botao(`${h.nome}${h.custoMP ? ` (${h.custoMP} MP)` : ""}${h.cooldownAtual > 0 ? ` [${h.cooldownAtual}]` : ""}`,
        () => resolverTurno(() => {
          const alvo = h.tipo === "cura" || h.tipo === "buff_defesa" || h.tipo === "buff_ataque" || h.tipo === "fuga" ? jogador : alvoSelecionado;
          batalha.usarHabilidade(jogador, h, alvo);
        }), desabilitado);
      acoesEl.appendChild(btn);
      // Só habilidades cuja fórmula é a mesma de rolarAtaque() (física) têm
      // prévia confiável — dano_magico usa outra fórmula (INT direto) e não
      // é replicada aqui só pra evitar mostrar um número que pode divergir.
      if (!desabilitado && alvoSelecionado && alvoSelecionado.vivo && ["dano_fisico", "dano_fisico_des", "dano_ignora_defesa"].includes(h.tipo)) {
        const opts = { multiplicador: h.multiplicador, elementoAtacante: h.elemento };
        if (h.tipo === "dano_fisico_des") opts.atributoForcado = "DES";
        if (h.tipo === "dano_ignora_defesa") { opts.ignoraDefesa = 999; opts.respeitaFormacao = false; }
        const previaHab = document.createElement("p");
        previaHab.className = "linha-previa-dano";
        previaHab.innerHTML = elementoPreviaTexto(batalha.estimarFaixaDano(jogador, alvoSelecionado, opts));
        acoesEl.appendChild(previaHab);
      }
    });

    if (jogador.racaId === "draconato" && !jogador.sopro_usado) {
      // Item 4 de 100_melhorias.md: prévia de quem será atingido por uma
      // habilidade em área, antes de confirmar — Sopro Elemental atinge
      // todos os inimigos vivos (ver usarSoproElemental em CombatSystem.js).
      const vivosAgora = inimigos.filter((i) => i.vivo);
      if (vivosAgora.length) {
        const previaArea = document.createElement("p");
        previaArea.className = "linha-previa-dano";
        previaArea.innerHTML = `<span class="dano-estimado" title="Sopro Elemental atinge todos os inimigos vivos de uma vez.">💨 Atinge: ${vivosAgora.map((i) => i.nome).join(", ")}</span>`;
        acoesEl.appendChild(previaArea);
      }
      acoesEl.appendChild(botao("Sopro Elemental (área)", () => resolverTurno(() => batalha.usarSoproElemental(jogador))));
    }

    // Pedido do jogador: usar poções/itens de cura em QUALQUER aliado vivo,
    // não só no personagem principal — o estoque de itens continua sendo
    // sempre o do principal (`personagem.inventario`, mochila compartilhada
    // do time), mas agora "Usar Item" aparece no turno de qualquer
    // combatente do time, e itens de cura/remoção de status pedem em qual
    // aliado aplicar quando há mais de um vivo (ver mostrarSubmenuItens/
    // mostrarSubmenuAlvoDoItem abaixo).
    {
      const itensUsaveis = personagem.inventario.filter((i) => i.tipo === "consumivel");
      if (itensUsaveis.length) {
        const btnItem = botao("Usar Item", () => mostrarSubmenuItens(itensUsaveis));
        acoesEl.appendChild(btnItem);
      }
    }

    acoesEl.appendChild(botao("Defender", () => resolverTurno(() => {
      jogador.defendendo = true;
      batalha.registrar(`${jogador.nome} se prepara para defender: o próximo ataque inimigo só passa se o d20 do atacante superar sua defesa.`);
      jogador.primeiroTurno = false;
      jogador.atb = 0;
    })));

    // Item 15 de 100_melhorias.md: só a ação irreversível de risco real
    // (encerra a batalha pro time todo) pede uma confirmação — Atacar/
    // Defender continuam com 1 clique, como já era, porque são reversíveis
    // e frequentes. Confirmação inline (2 cliques), sem modal, pra não
    // travar teclado/toque.
    let fugirPendenteConfirmacao = false;
    const btnFugir = botao(fugirPendenteConfirmacao ? "Confirmar fuga?" : "Fugir (time todo)", () => {
      if (!fugirPendenteConfirmacao) {
        fugirPendenteConfirmacao = true;
        btnFugir.textContent = "Confirmar fuga?";
        btnFugir.classList.add("perigo");
        return;
      }
      resolverTurno(() => batalha.fugir(jogador));
    });
    acoesEl.appendChild(btnFugir);

    // Modo automático: agenda a ação do combatente ativo sozinha, uma única
    // vez por combatente (evita agendar de novo a cada re-render do mesmo turno).
    if (autoPlayState.ativo && ultimoAutoAgendado !== atacanteAtivo) {
      ultimoAutoAgendado = atacanteAtivo;
      const alvoDaVez = atacanteAtivo;
      setTimeout(() => {
        if (autoPlayState.ativo && atacanteAtivo === alvoDaVez) agirAutomaticamente();
      }, duracaoAnimacao(450));
    }
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
    const resultado = fn();
    const rolagem = batalha.ultimaRolagem && batalha.ultimaRolagem.seq > seqRolagemAntes ? batalha.ultimaRolagem : null;

    if (rolagem) {
      garantirDadoLayer();
      somDadoParou(rolagem.critico);
      await animarDado(dadoLayer, rolagem.d, { critico: rolagem.critico, fumble: rolagem.erroTotal });
    }
    if (rolagem && rolagem.atacante && rolagem.alvo) {
      await animarGolpe(rolagem.atacante, rolagem.alvo, { erro: rolagem.erroTotal, bloqueado: rolagem.bloqueado });
      // Fx pendente (crítico + cor do elemento do golpe) pro próximo
      // cardCombatente() do alvo — ver declaração de `fxPendente` mais
      // acima. Só golpes que realmente acertaram (não erro/bloqueio)
      // ganham a cor elemental, senão um "erro" sem dano nenhum herdaria a
      // borda colorida por engano.
      const elementoAtacante = rolagem.atacante.elemento;
      const elInfo = !rolagem.erroTotal && !rolagem.bloqueado && dados.elements ? infoElemento(elementoAtacante, dados.elements) : null;
      fxPendente = { alvo: rolagem.alvo, critico: rolagem.critico, corElemento: elInfo ? elInfo.cor : null };
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
      await sleep(duracaoAnimacao(500));
    }

    renderArena();
    renderLog();
    return resultado;
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

  // Prévia de intenção ("telegraph"): mostra o que o inimigo vai fazer (e em
  // quem) por um pequeno intervalo antes de executar de fato — dá ao
  // jogador uma janela pra reagir (ex.: usar Defender) antes do golpe.
  function iniciarTelegrafo(inimigo) {
    const plano = batalha.decidirAcao(inimigo);
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
      if (batalha.terminada) return;
      if (inimigo.vivo) {
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
        }
      }
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
