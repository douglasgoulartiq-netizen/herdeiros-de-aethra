// Tela de batalha ATB: desenha o time (até 3 personagens), inimigos, barras
// de iniciativa, log e ações. Quando mais de um membro do time fica pronto
// ao mesmo tempo, eles entram numa fila e agem um de cada vez.
// Retratos da barra de ordem de turno: o caminho vem do registro de assets
// (src/data/assetRegistry.js), com cadeia de fallback resolvida por
// ligarCadeias — ver o comentário em renderTimeline().
import { devolverOleoAoPersonagem, sincronizarElemento } from "../systems/WeaponOilSystem.js";
import { imgHtml, ligarCadeias } from "../systems/AssetResolver.js";
import { USOS } from "../data/assetRegistry.js";
import { aplicarBonusDePet } from "../systems/PetSystem.js";
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo, comboDoisElementos, ESTADOS_RUINS } from "../systems/CombatSystem.js";
import { removerItem, sortearLoot, rolarQuedas } from "../systems/InventorySystem.js";
import { ganharXP, aplicarCrescimento, cryptoId } from "../systems/CharacterFactory.js";
import { temCompraDisponivel } from "../systems/SkillTreeSystem.js";
import { concederPontosPorNivel, concederPontoHeranca } from "../systems/TalentSystem.js";
import { registrarAbate } from "../systems/QuestSystem.js";
import { adicionarFragmentos, checarConquistas, concederXPReservas } from "../systems/GachaSystem.js";
import { FRAGMENTOS } from "../data/economyConfig.js";
import { mostrarMensagem } from "./GameUI.js";
// Animação de subir de nível + gatilho dos cartões (ver CartaoUI.js). Vive lá,
// e não em main.js, porque main importa esta tela — o contrário seria um ciclo.
import { celebrarNivel, pausarCartoes, retomarCartoes } from "./CartaoUI.js";
import { autoPlayState, registrarGanhosAuto } from "../systems/AutoPlayState.js";
import { garantirConfigAutoBatalha, escolherAcaoAutomatica, MODOS_AUTO_BATALHA, LABEL_MODO } from "../systems/AutoBattleAI.js";
import { autoEquiparSlotsVazios, textoAcoesEquipamento } from "../systems/AutoEquipSystem.js";
import { montarPalco, pintarCabecalho, MAX_SLOTS_INIMIGO, MAX_SLOTS_HEROI } from "./BattleStage.js";
import { descreverCenario } from "../systems/BattleTerrainSystem.js";
import { relacaoElemental, infoElemento } from "../systems/ElementSystem.js";
import { alterarReputacao, aplicarCamaradagemNoCombatente, facaoDaZona, registrarDecisao } from "../systems/WorldStateSystem.js";
import { registrarAbateCompendio } from "../systems/CompendiumSystem.js";
import { formacaoParaBatalha } from "../systems/FormationSystem.js";
import { aplicarSinergiasFormacao } from "../systems/FormationSynergySystem.js";
import { aplicarSinergiaFaccao } from "../systems/FactionSynergySystem.js";
import { aplicarParesRelacionamento } from "../systems/RivalrySystem.js";
import { registrarProgressoDiario } from "../systems/DailyQuestSystem.js";
import { efeitosReduzidos, vibracaoAtiva } from "../systems/AccessibilitySystem.js";
import { criarApresentacaoCombate, avisoDePlano, mostrarEstadoCombate, tempoAviso, resumoEstados } from './CombatPresentation.js';
import { animarDado, sleep, duracaoAnimacao } from "./DiceAnimation.js";
import { somDadoParou, somDano, somCura, somBloqueioOuErro, destravarAudio, somRuptura, somEntradaChefe } from "./SoundFX.js";
// Mão de cards de batalha (ver src/ui/BattleCards.js e o trio
// BattleForecast/TacticalAdvisor/BattleSettings): substitui a antiga fileira
// de botões de texto do turno do jogador. Toda a decisão continua sendo do
// jogador — os cards preveem, destacam e explicam, nunca jogam sozinhos.
import { criarPainelDeCards } from "./BattleCards.js";
// Marcas de classe (RecursoClasseSystem): bônus CONDICIONAIS reavaliados a
// cada golpe. O log só avisava depois do golpe — tarde demais para a jogada.
import { bonusDeMarcas } from "../systems/RecursoClasseSystem.js";
import { animacoesReduzidas, dadoSomenteImportante } from "../systems/BattleSettings.js";
// Letreiros de reação elemental / virada de fase / fúria do chefe. Ela se
// liga sozinha ao barramento de EventosVisuais.js — esta tela só a monta e a
// desmonta junto com a batalha. Ver RevelacoesCombate.js.
import { iniciarRevelacoes, anunciarFaixa } from "./RevelacoesCombate.js";
// Dano por turno e turno perdido chegam pelo barramento porque o tique de
// status roda fora do fluxo de `animarGolpe` — ver EventosVisuais.js.
import { ouvir, EVENTO } from "../systems/EventosVisuais.js";
// `nomeDaFase` existia no BossPhaseSystem desde o começo e nenhuma tela a
// chamava: o chefe mudava de fase e o card continuava idêntico.
import { nomeDaFase } from "../systems/BossPhaseSystem.js";

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
    { chave: "usarArea", label: "Usar golpe em área", desc: "Compara o dano esperado (multiplicador × número de alvos) com o melhor golpe de alvo único e escolhe o que rende mais. Também atrasa a horda com debuff em área quando há 3 ou mais inimigos." },
    { chave: "cuidarDosAliados", label: "Cuidar do time, não só de si", desc: "Cura o grupo quando dois aliados estão feridos — ou quando um está em estado crítico —, em vez de olhar só o próprio HP." },
    { chave: "bufarTime", label: "Reforçar o time antes de trocar golpe", desc: "Usa buff de grupo enquanto ninguém está reforçado. Na prática isso acontece no começo da luta e sempre que o reforço expira." },
    { chave: "defenderSobPressao", label: "Defender quando encurralado", desc: "Em estado crítico, sem cura própria e com um aliado capaz de curar no turno seguinte, levanta a guarda para comprar esse turno em vez de trocar golpe." },
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
// `contextoCenario` (opcional): { mapaAtual, zonaId, zonaNome, zonaDescricao,
// tile, climaNome, climaIcone } — ids REAIS do jogo, usados só para desenhar
// o cenário e o cabeçalho. Sem ele a batalha acontece em "Campo Aberto", o
// cenário neutro, e nada mais muda.
export function iniciarBatalha(screenEl, imagens, dados, personagem, membrosExtras, monstrosDef, terrenoElemento, climaElemento, facaoZona, levasExtras, onFim, contextoCenario = {}) {
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
    // Bônus do pet ativo (ver PetSystem.js): vale para TODO o time, no mesmo
    // ponto e do mesmo jeito que a camaradagem de facção — um modificador
    // aplicado ao combatente já montado, uma vez, no início da batalha.
    aplicarBonusDePet(combatente, personagem, dados.pets);
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
  if (inimigos.some((i) => i.chefe)) somEntradaChefe();
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
    // Óleo de arma (WeaponOilSystem.js): sem o ícone o jogador untava a
    // lâmina e não tinha como saber que ainda estava valendo.
    oleo_arma: { icone: "🫙", label: "Arma untada", classe: "bom" },
  };

  // FICHA DE EFEITOS DO CARD — o que realmente está valendo num combatente.
  //
  // O QUE ISTO CONSERTA (auditoria de combate, itens 1, 2 e 4)
  // ----------------------------------------------------------
  // A linha de ícones antiga tinha três furos, e os três eram graves:
  //
  //  1. Ela mapeava `statusEffects` por TIPO e filtrava por `STATUS_INFO`.
  //     Como `estado_elemental` não está nessa tabela — e não PODE estar, são
  //     nove estados diferentes com o mesmo tipo — os nove estados elementais
  //     do jogo eram invisíveis. Molhado (+40% de gelo recebido), Congelado
  //     (perde o turno), Incendiado (6% do HP por turno), Exposto (−25% de
  //     defesa): nenhum deles aparecia em lugar nenhum da tela.
  //
  //  2. Nenhum ícone dizia quantos turnos faltavam. "Ataco o congelado agora
  //     ou ele descongela antes?" é A decisão do combate e o dado não estava
  //     na tela.
  //
  //  3. "Defender" não é um `statusEffect` — é um booleano solto no
  //     combatente. O buff mais forte de um turno (bloqueia o golpe inteiro)
  //     não tinha ícone nenhum.
  //
  // A ficha resolve os três de uma vez: percorre os EFEITOS, não os tipos,
  // lê o `def` do estado elemental (que já traz nome, ícone e descrição
  // escritos em elementalStates.json) e carrega a duração de cada um.
  function fichaDeEfeitos(c) {
    const lista = [];
    if (c.defendendo) {
      lista.push({
        chave: "guarda", icone: "🛡️", label: "Em guarda", classe: "guarda", turnos: null,
        titulo: "Em guarda: o próximo golpe recebido é bloqueado por inteiro se a rolagem do atacante for baixa. Some assim que for usado.",
      });
    }
    for (const s of c.statusEffects || []) {
      if (s.tipo === "estado_elemental" && s.def) {
        lista.push({
          chave: `estado-${s.def.id}`, icone: s.def.icone || "✨", label: s.def.nome,
          classe: "elemental", estadoId: s.def.id, turnos: s.duracao,
          titulo: `${s.def.nome} — ${s.def.descricao || ""}`,
        });
      } else if (STATUS_INFO[s.tipo]) {
        const info = STATUS_INFO[s.tipo];
        lista.push({
          chave: s.tipo, icone: info.icone, label: info.label,
          classe: info.classe, turnos: s.duracao, titulo: info.label,
        });
      }
    }
    return lista;
  }

  // Espelho das cores de aura definidas em efeitos-combate.css. Existe em JS
  // porque a marca elemental (o ícone que sobe do impacto) é criada fora de
  // um `.combatente`, então não herda a variável da folha de estilo.
  const COR_DO_ESTADO = {
    molhado: "#4a9fd8", congelado: "#8fd8e8", incendiado: "#e0602a",
    exposto: "#e0b24a", corrompido: "#8b5ac8", enraizado: "#6fa84a",
    eletrizado: "#f0d848", instavel: "#d858c8", precisao_reduzida: "#9aa4ae",
  };

  // A aura desenhada em volta do sprite: o PRIMEIRO estado elemental ativo.
  // Só um, porque o motor também só permite um por vez
  // (ElementalReactionSystem: aplicar outro substitui o anterior).
  function auraDoCard(c) {
    const est = (c.statusEffects || []).find((s) => s.tipo === "estado_elemental" && s.def);
    return est ? ` aura-estado aura-${est.def.id}` : "";
  }
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
  // Leva da horda no render anterior — null antes do primeiro render, para a
  // abertura da batalha não ser confundida com a virada de uma onda.
  let levaAnterior = null;
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

  // ---------------------------------------------------------------------
  // PALCO FIXO (ver BattleStage.js pro diagnóstico do deslocamento antigo).
  // O esqueleto é montado UMA vez por batalha; daqui pra frente só o
  // conteúdo dentro dos slots muda. `cenario` sai dos ids reais do jogo —
  // zona, masmorra, tile pisado, elemento de terreno e clima.
  // ---------------------------------------------------------------------
  const cenario = descreverCenario({
    ...contextoCenario,
    elementoTerreno: terrenoElemento || null,
    elementoClima: climaElemento || null,
    nomeElemento: (id) => { const e = infoElemento(id, dados.elements); return e ? e.nome : id; },
    iconeElemento: (id) => { const e = infoElemento(id, dados.elements); return e ? e.icone : ""; },
  });
  screenEl.dataset.battleTerrain = terrenoElemento || "";
  const palco = montarPalco(screenEl, { cenario, imagens, autoAtivo: autoPlayState.ativo });
  // A camada dos letreiros vive DENTRO do campo (não do screenEl) para
  // herdar o recorte do campo e nunca escapar por cima da mão de cards.
  // ENTRADA NA BATALHA.
  //
  // O corte era seco: o mundo sumia e a batalha aparecia no mesmo quadro. É
  // o momento de maior tensão do loop do jogo — o encontro — e o único que
  // não tinha nenhuma passagem. Meio segundo de escuro dá peso ao encontro e
  // cobre o instante feio em que os cards ainda não foram montados.
  //
  // O véu é pintado sobre a tela de batalha, não sobre o mundo: quando ele
  // abre, o que aparece por baixo já está pronto.
  if (!efeitosReduzidos()) {
    const veu = document.createElement("div");
    veu.className = "veu-entrada-batalha";
    screenEl.appendChild(veu);
    setTimeout(() => veu.remove(), duracaoAnimacao(620));
  }

  // Os cartões de sugestão somem enquanto a luta dura — ver pausarCartoes.
  pausarCartoes();
  // Marca o app como "em batalha". Serve para as camadas do MUNDO que não
  // sabem que existe uma luta acontecendo — hoje a mensagem de topo, que
  // continuava sendo desenhada no alto da tela e caía bem em cima do card do
  // inimigo (ver batalha-layout.css). Uma classe, e não um `:has()`, porque
  // isto precisa ser ligado e desligado em momentos exatos, não deduzido.
  document.getElementById("app")?.classList.add("em-batalha");
  // No BODY também: a pilha de notificações é anexada a `document.body`
  // (ver garantirPilha em Notificacoes.js), não a #app — então um seletor
  // ancorado em #app nunca a alcançava, e as regras de reposicionamento em
  // batalha não faziam nada. Descoberto medindo: o aviso continuava caindo
  // em cima da mão de cards.
  document.body.classList.add("em-batalha");

  const pararRevelacoes = iniciarRevelacoes(palco.campoEl);

  // DANO POR TURNO (veneno, incendiado) — item 3 da auditoria.
  //
  // O tique de status roda em `aplicarStatusTick`, fora do caminho que
  // desenha números flutuantes. Resultado: 8% do HP máximo por turno de
  // veneno, e 6% de incendiado, saíam só como linha de log. Numa luta de
  // seis rodadas isso é metade da barra de vida do herói, invisível.
  const pararOuvintesDeStatus = [
    ouvir(EVENTO.DANO_PERIODICO, ({ combatente, dano, icone, nome }) => {
      const card = elementoPorCombatente.get(combatente);
      if (!card) return;
      spawnDanoPeriodico(card, dano, icone, nome);
    }),
    ouvir(EVENTO.TURNO_PERDIDO, ({ combatente, icone, nome }) => {
      const card = elementoPorCombatente.get(combatente);
      if (!card) return;
      // Item 5: o gelo racha em cima do sprite. Antes o turno era pulado em
      // silêncio e o jogador só via o inimigo "não fazer nada".
      const sprite = card.querySelector(".sprite-wrap");
      if (sprite && !animacoesReduzidas()) {
        const gelo = document.createElement("div");
        gelo.className = "prisao-turno";
        gelo.textContent = icone;
        sprite.appendChild(gelo);
        setTimeout(() => gelo.remove(), duracaoAnimacao(900));
      }
      spawnMissText(card, `${icone} ${nome} — perde o turno`);
    }),

    // ROUBO DE VIDA — item 8. Só existia como linha de log: o jogador batia,
    // a própria barra subia, e nada ligava as duas coisas. As partículas
    // fazem a ligação viajar pela tela, do alvo até quem roubou.
    ouvir(EVENTO.DRENO, ({ atacante, alvo, cura }) => {
      const de = elementoPorCombatente.get(alvo);
      const para = elementoPorCombatente.get(atacante);
      if (!de || !para) return;
      viajarParticulas(de, para, "dreno", 6);
    }),

    // ECO — item 9. O golpe se repetia e dois números saíam em sequência: o
    // jogador lia como bug. A faixa nomeia o efeito e o card do atacante
    // avança uma segunda vez, translúcido, como um fantasma do primeiro golpe.
    ouvir(EVENTO.ECO, ({ atacante }) => {
      const card = elementoPorCombatente.get(atacante);
      if (!card) return;
      mostrarFaixaCentral("ECO", "faixa-eco");
      if (animacoesReduzidas()) return;
      card.classList.remove("eco-fantasma");
      void card.offsetWidth;
      card.classList.add("eco-fantasma");
      setTimeout(() => card.classList.remove("eco-fantasma"), duracaoAnimacao(520));
    }),

    // MARCA ELEMENTAL — item 11. É o gesto que acende todo o sistema de
    // reações (molhar agora para conduzir depois) e acontecia em silêncio.
    ouvir(EVENTO.MARCA_ELEMENTAL, ({ alvo, estadoId, icone }) => {
      const card = elementoPorCombatente.get(alvo);
      if (!card || animacoesReduzidas()) return;
      const sprite = card.querySelector(".sprite-wrap");
      if (!sprite) return;
      const marca = document.createElement("div");
      marca.className = "marca-elemental";
      // A cor vem das MESMAS variáveis das auras, mas tem de ser posta AQUI:
      // as regras `--aura-cor` valem para `.combatente.aura-X`, e este
      // elemento não é um combatente — nem o card dele tem a aura ainda,
      // porque o estado acabou de ser aplicado e o card só ganha a classe no
      // render seguinte. Sem isto, os nove estados brilhavam no mesmo azul.
      marca.style.setProperty("--aura-cor", COR_DO_ESTADO[estadoId] || "#7ab5e0");
      marca.textContent = icone;
      sprite.appendChild(marca);
      setTimeout(() => marca.remove(), duracaoAnimacao(820));
    }),

    // COMBO ENTRE ALIADOS — item 17. O badge "COMBO!" existia na carta, antes
    // de jogar. Faltava o momento: nada ligava, na arena, quem preparou a
    // quem fechou.
    ouvir(EVENTO.COMBO, ({ primeiro, segundo }) => {
      const a = elementoPorCombatente.get(primeiro);
      const bq = elementoPorCombatente.get(segundo);
      if (!a || !bq || animacoesReduzidas()) return;
      ligarCards(a, bq);
    }),
  ];
  pintarCabecalho(palco, cenario);

  const campoEl = palco.campoEl;
  const arena = campoEl;                 // nome antigo, mesmo elemento
  const logEl = palco.logListaEl;
  const acoesEl = palco.dockEl;
  const timelineEl = palco.timelineEl;

  // Badges de horda e sinergia viraram OVERLAYS absolutos dentro do campo —
  // antes eram divs no fluxo, e aparecer/sumir empurrava a tela inteira.
  palco.overlaysEl.innerHTML = `
    ${batalha.totalLevas > 1 ? `<div id="batalha-horda-badge" class="horda-badge">🌊 Leva ${batalha.levaAtual}/${batalha.totalLevas}</div>` : ""}
    ${sinergiasAtivas.map((s) => `<div class="sinergia-badge" title="${s.descricao}">${s.icone} ${s.nome}</div>`).join("")}
  `;
  // Contexto tático (intenção inimiga, fase de chefe, dica de iniciante) tem
  // FAIXA PRÓPRIA no grid, entre a infobar e o dock, com altura limitada no
  // CSS. Antes era um irmão solto no fluxo: quando o texto crescia, empurrava
  // a mão de cards pra fora. Dentro do dock também não podia ficar — a mão
  // de cards limpa os filhos do dock a cada render.
  // Mora DENTRO do campo, colado na borda de baixo: assim ele flutua sobre o
  // cenário sem tapar a ordem de turno da infobar e sem ocupar faixa nenhuma
  // do grid. (Como sobreposição, pode crescer e encolher à vontade — é o que
  // o teste de layout shift permite a ele e proíbe às áreas estruturais.)
  palco.overlaysEl.appendChild(contextoTaticoEl);
  // O log nasce fechado em qualquer largura: como o painel é absoluto, abrir
  // não custa espaço nenhum, então a escolha é do jogador e não do tamanho
  // da tela. A preferência dura a batalha inteira.
  palco.alternarLog(false);

  // Barra de retratos do time (redesenho de layout inspirado na composição
  // do print de referência que o usuário mandou: faixa de retratos no topo
  // com ordem de turno, em vez de só os cards de corpo inteiro na arena).
  // Puramente visual — não lê nem decide nada de novo, só espelha o mesmo
  // `combatentesTime` que já alimenta os cards da arena logo abaixo. Usa os
  // retratos HD (assets/sprites_hd/retrato_<raca>_<classe>.png, gerados por
  // scripts/gen_assets_hd.py); se por algum motivo faltar um arquivo pra
  // uma combinação, a própria tag <img> só fica sem imagem — nunca quebra a
  // tela de combate por causa disso.
  // ORDEM DE TURNO compacta (item 48/49 do pedido): retratos/ícones em vez
  // de nomes, porque nome muda de largura e a barra inteira "respirava" a
  // cada troca. Cada item tem tamanho fixo (26px no CSS) e o nome vai no
  // title — a largura da timeline não depende mais de quem está lutando.
  //
  // A ordem é a MESMA que o ATB vai usar: quem está mais perto de encher a
  // barra aparece primeiro. Não é uma previsão nova nem um sistema paralelo,
  // é só uma leitura do estado que o CombatSystem já mantém.
  function renderTimeline() {
    if (!timelineEl) return;
    const vivos = [...combatentesTime, ...inimigos].filter((c) => c.vivo);
    const faltando = (c) => (c.atbMax - Math.min(c.atb, c.atbMax)) / Math.max(1, c.velocidade || 1);
    const ordem = vivos.slice().sort((a, b) => {
      if (atacanteAtivo === a) return -1;
      if (atacanteAtivo === b) return 1;
      return faltando(a) - faltando(b);
    }).slice(0, 8);

    timelineEl.innerHTML = ordem.map((c, i) => {
      const ativo = atacanteAtivo && c === atacanteAtivo;
      // O caminho vem do registro de assets, não montado à mão aqui. A versão
      // anterior cravava `assets/sprites_hd/retrato_<raça>_<classe>.png` — e
      // como a pasta sprites_hd/ nunca existiu, as 36 combinações davam 404 em
      // silêncio (<img> quebrada não derruba nada) e a barra de turno ficava
      // sem rosto nenhum. O registro devolve a lista em ordem de preferência e
      // ligarCadeias cai para a próxima quando uma falha, então o INIMIGO
      // também ganha rosto: o retrato genérico da família dele.
      // O combatente guarda a chave em `spriteKey`; o registro espera `sprite`
      // (o nome do campo no monsters.json). Traduzir aqui, num descritor
      // explícito, é mais honesto do que fazer o registro adivinhar.
      const descritor = c.isPlayer && c.racaId && c.classeId
        ? { racaId: c.racaId, classeId: c.classeId }
        : { sprite: c.spriteKey };
      const img = imgHtml(descritor, USOS.RETRATO, { lazy: false });
      const conteudo = img || `<span aria-hidden="true">${c.isPlayer ? "🙂" : "👹"}</span>`;
      const seta = i < ordem.length - 1 ? `<span class="tl-seta" aria-hidden="true">›</span>` : "";
      const pctHp = Math.round(Math.max(0, (c.hp / c.hpMax) * 100));
      return `<span class="tl-item${ativo ? " tl-ativo" : ""}${c.isPlayer ? "" : " tl-inimigo"}" title="${c.nome} — ${pctHp}% HP${ativo ? " (turno atual)" : ""}">${conteudo}</span>${seta}`;
    }).join("");
    // Sem isto a cadeia de fallback não roda: a <img> ficaria no primeiro
    // candidato e um 404 voltaria a ser um quadrado vazio.
    ligarCadeias(timelineEl);
  
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
    // O herói tem DUAS artes: a folha de caminhada de 64 px, que o mapa usa, e
    // a peça de batalha de 192 (`pcb_<raça>_<classe>`). Aqui a de batalha vem
    // primeiro — sem isso o jogador ficava sendo o único boneco de 16 px
    // lógicos numa arena onde monstro e convocado já têm 192.
    // O `||` é a rede de segurança: numa publicação antiga, sem os arquivos
    // pcb_*, cai na folha de sempre e a batalha continua desenhando.
    if (c.isPlayer && c.racaId && c.classeId) {
      const batalha = imagens[`pcb_${c.racaId}_${c.classeId}`];
      if (batalha && batalha.width >= 96) return batalha;
    }
    return imagens[`mb_${c.spriteKey}`] || imagens[c.spriteKey];
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
  // As camadas de efeito vêm do palco: são absolutas dentro do campo e nunca
  // são limpas nem recriadas, então um número flutuante sobrevive à troca do
  // card que o originou (e não participa do layout de ninguém).
  const fxLayer = palco.fxLayer;
  const dadoLayer = palco.dadoLayer;
  const garantirFxLayer = () => fxLayer;
  const garantirDadoLayer = () => dadoLayer;

  // -------------------------------------------------------------------
  // LIGAÇÃO COMBATENTE -> SLOT
  // -------------------------------------------------------------------
  // Cada combatente recebe UM lugar quando entra na luta e fica nele até o
  // fim. Morrer NÃO devolve o slot: o card só apaga. É essa reserva que
  // impede o vizinho de correr para o buraco — o "matar um monstro
  // reposiciona a interface inteira" do pedido.
  const slotDe = new Map();
  function atribuirSlots() {
    // Poda: uma leva nova de horda troca o conteúdo de `inimigos` por
    // objetos completamente novos (ver avancarLeva em CombatSystem.js).
    // Quem saiu da luta devolve o lugar. Dentro da MESMA leva ninguém
    // devolve nada, nem morrendo, que é justamente o ponto.
    const presentes = new Set([...combatentesTime, ...inimigos]);
    [...slotDe.keys()].forEach((c) => { if (!presentes.has(c)) slotDe.delete(c); });

    // Centraliza a formação DENTRO da grade fixa: 3 inimigos em 6 lugares
    // ficam nos lugares 1-3, não 0-2. O deslocamento é calculado UMA VEZ,
    // na entrada da leva — durante a luta os âncoras não mudam, nem quando
    // alguém morre. É a "leve regra de composição" que o pedido permite,
    // sem abrir mão da previsibilidade.
    const inicioHerois = Math.max(0, Math.floor((MAX_SLOTS_HEROI - combatentesTime.length) / 2));
    combatentesTime.forEach((c, i) => {
      const idx = inicioHerois + i;
      if (!slotDe.has(c) && idx < MAX_SLOTS_HEROI) slotDe.set(c, palco.slotsHerois[idx]);
    });
    const ocupados = new Set([...slotDe.values()]);
    const inimigosSemLugar = inimigos.filter((c) => !slotDe.has(c));
    const inicioInimigos = ocupados.size === combatentesTime.length
      ? Math.max(0, Math.floor((MAX_SLOTS_INIMIGO - inimigosSemLugar.length) / 2))
      : 0;
    let proximoInimigo = inicioInimigos;
    inimigos.forEach((c) => {
      if (slotDe.has(c)) return;
      const preferido = palco.slotsInimigos[proximoInimigo];
      const livre = preferido && !ocupados.has(preferido)
        ? preferido
        : palco.slotsInimigos.find((sl) => !ocupados.has(sl));
      proximoInimigo += 1;
      // Encontro maior que MAX_SLOTS_INIMIGO: o excedente não entra na
      // fileira. Preferível a deformar o campo — e hoje o maior encontro
      // possível (horda de 5 + emboscada) cabe nos 6 lugares.
      if (!livre) return;
      ocupados.add(livre);
      slotDe.set(c, livre);
    });

    const usados = new Set([...slotDe.values()]);
    [...palco.slotsHerois, ...palco.slotsInimigos].forEach((sl) => {
      sl.dataset.ocupado = usados.has(sl) ? "1" : "0";
      if (!usados.has(sl)) sl.replaceChildren();
    });
  }

  function renderArena() {
    // Horda (task #47): mantém o contador de leva atualizado a cada
    // renderização, já que avancarLeva() troca a onda por trás sem disparar
    // nenhum evento próprio — é o mesmo re-render que já roda a cada ação.
    const hordaBadge = document.getElementById("batalha-horda-badge");
    if (hordaBadge) hordaBadge.textContent = `🌊 Leva ${batalha.levaAtual}/${batalha.totalLevas}`;
    // ENTRADA DA NOVA LEVA (item 18 da auditoria). A onda anterior sumia e a
    // próxima aparecia no MESMO quadro: sem faixa, sem entrada, sem nada. O
    // jogador tinha a impressão de que os inimigos mortos "voltaram".
    // `primeiraRenderizacao` cuida da primeira leva; daqui para a frente é
    // esta comparação que detecta a virada.
    if (levaAnterior !== null && batalha.levaAtual !== levaAnterior) {
      primeiraRenderizacao = true; // reusa a animação de entrada escalonada
      mostrarFaixaCentral(`LEVA ${batalha.levaAtual} DE ${batalha.totalLevas}`, "faixa-leva");
    }
    levaAnterior = batalha.levaAtual;
    renderTimeline();
    atribuirSlots();

    const comEfeito = [];
    const comStatusNovo = [];
    let indice = 0;
    [...combatentesTime, ...inimigos].forEach((c) => {
      const slot = slotDe.get(c);
      if (!slot) return;
      const r = cardCombatente(c, indice++);
      // O card vai no MESMO slot de sempre. Como o slot tira o tamanho do
      // grid do campo (nunca do conteúdo), trocar o miolo do card não move
      // um pixel de nada — nem dele, nem dos vizinhos.
      slot.replaceChildren(r.div);
      if (r.deltaHp) comEfeito.push(r);
      if (r.statusNovos.length) comStatusNovo.push(r);
    });
    comEfeito.forEach(({ div, deltaHp, critico, relacao, ruptura, selos, corElemento }) => spawnFloatingText(div, deltaHp, critico, { relacao, ruptura, selos, corElemento }));
    comStatusNovo.forEach(({ div, statusNovos }) => statusNovos.forEach((efeito, i) => spawnStatusText(div, efeito, i)));
    // A entrada (fade/slide) só deve acontecer na abertura da tela — a
    // partir daqui os cards recriados nos próximos renders já entram "no
    // lugar", sem repetir a animação de entrada (ver comentário na
    // declaração de `primeiraRenderizacao`).
    // A linha do chão do cenário é MEDIDA a partir dos sprites (ver
    // medirHorizonte em BattleStage.js). No primeiro desenho do palco os
    // cards ainda não existiam, então ela usou o padrão; agora que existem,
    // o cenário se realinha a eles — e é isto que faz os personagens
    // pisarem no chão em vez de flutuar sobre o fundo.
    if (primeiraRenderizacao && palco && typeof palco.redesenharCena === "function") {
      requestAnimationFrame(() => palco.redesenharCena());
    }
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
    // MORTE (item 18): o card simplesmente passava a ser desenhado em cinza.
    // Não havia queda, não havia dissolução — o combatente que o jogador
    // acabou de derrubar não tinha nenhum momento na tela, e num combate por
    // ATB (em que os cards se redesenham a cada 140ms) a troca de estilo é
    // literalmente imperceptível.
    const morreuAgora = hpAntes > 0 && c.hp <= 0;
    hpAnterior.set(c, c.hp);
    // Acessibilidade (melhoria pós-backlog, ver AccessibilitySystem.js):
    // "reduzir efeitos" tira o flash de acerto e o tremor de tela (ver
    // sacudirArena logo abaixo) pra quem é sensível a isso — o resto do
    // combate (números flutuantes, barras, log) continua igual.
    const flashDesligado = animacoesReduzidas();
    // Fx pendente (ver orquestrarAcao()): crítico e cor elemental do último
    // golpe, consumidos uma única vez pelo alvo certo (comparado por
    // REFERÊNCIA de objeto — ver comentário na declaração de `fxPendente`).
    const fx = fxPendente && fxPendente.alvo === c ? fxPendente : null;
    const critico = !!(fx && fx.critico);
    const entrando = primeiraRenderizacao ? " entrada-combatente" : "";
    // PORTE DO COMBATENTE (melhoria visual: escala por perigo).
    //
    // Um chefe de 808 de vida e um morcego de 16 ocupavam exatamente os
    // mesmos 68 pixels. Tamanho é a forma mais direta de dizer "isto é
    // perigoso" — mais rápida que ler um número, e é o que todo RPG usa —
    // e o dado para calculá-lo já existia inteiro: `chefe`, `solo` e a
    // escala da região.
    //
    // A conta é deliberadamente contida (0,82 a 1,55): passar disso quebra a
    // fileira, porque o slot tem largura fixa e o sprite começaria a invadir
    // o vizinho. O crescimento sai do CHÃO (transform-origin bottom), senão
    // o bicho maior flutuaria acima da linha em que o menor pisa.
    const porte = (() => {
      if (c.isPlayer) return 1;
      let p = 1;
      if (c.chefe) p = 1.55;
      else if (c.solo) p = 1.18;
      else {
        // Reforço da região: um lobo de zona avançada é visivelmente maior
        // que o lobo da mesma espécie perto da vila.
        const e = c.escalaNivel;
        if (e && e.hp) p = 1 + Math.min(0.22, (e.hp - 1) * 0.35);
      }
      return Math.max(0.82, Math.min(1.55, p));
    })();

    if (porte !== 1) div.style.setProperty("--porte", String(porte));
    // Acima de 1,25 o sprite sobe o bastante para invadir a linha de selos
    // (Fase, escala) que fica acima dele — visto em teste com um chefe a
    // 1,55: o "FASE 1 · DOMÍNIO" ficava atrás do bicho. Nesse caso os selos
    // mudam de lado, para baixo do sprite. Ver batalha-layout.css.
    const porteGrande = porte >= 1.25;
    div.className = "combatente" + (porteGrande ? " porte-grande" : "") + auraDoCard(c) + (c.defendendo ? " em-guarda" : "") + (!c.vivo ? " morto" : "") + (c.atb >= c.atbMax && c.vivo ? " pronto" : "") + (ehAtivo ? " ativo" : "") + (ehTelegrafado ? " telegrafando" + (telegrafo.inimigo.chefe ? " telegrafo-chefe" : "") : "") + (deltaHp < 0 && !flashDesligado ? " hit-flash" : "") + (deltaHp < 0 && critico && !flashDesligado ? " hit-flash-critico" : "") + (c.atordoado ? " atordoado" : "") + entrando;
    div.dataset.cid = c.id;
    div.classList.toggle('alvo-confirmado', c === alvoSelecionado && !c.isPlayer);
    const planoVisual = telegrafo?.plano;
    const avisoVisual = avisoDePlano(planoVisual, c);
    div.classList.toggle('aviso-alvo', !!avisoVisual);
    if (avisoVisual) div.dataset.aviso = avisoVisual;
    div.classList.toggle('combate-conforto', animacoesReduzidas());
    if (entrando) div.style.setProperty("--entrada-atraso", `${Math.min(indice, 6) * 60}ms`);
    if (fx && fx.corElemento) div.style.setProperty("--flash-color", fx.corElemento);
    const img = imgFor(c);
    // Quadro de animação: as folhas do herói e do pet são tiras horizontais de
    // quadros QUADRADOS, então o lado do quadro é a ALTURA da imagem — não 64
    // cravado. Os sprites de monstro do pacote de arte são 192x192 de um
    // quadro só (briefings-arte/00_CONTRATO_TECNICO.md); com o 64 fixo que
    // existia aqui a batalha recortava o canto superior esquerdo e o jogador
    // via um pedaço da pata do bicho em vez do bicho.
    const ladoQuadro = img && img.height ? img.height : 64;
    const quadros = img && img.width ? Math.max(1, Math.round(img.width / ladoQuadro)) : 1;
    const frame = (c.isPlayer || quadros <= 1)
      ? 0
      : (Math.floor(Date.now() / 500) % quadros) * ladoQuadro;
    const iconeTelegrafo = ehTelegrafado ? ` <span class="icone-telegrafo" title="${textoTelegrafo(telegrafo).replace(/<[^>]+>/g, "")}">${(TELEGRAFO_INFO[telegrafo.plano.tipo] || TELEGRAFO_INFO.atacar).icone}</span>` : "";
    const badgeFormacao = c.isPlayer ? ` <span class="badge-formacao" title="${c.posicao === "retaguarda" ? "Retaguarda: recebe menos dano físico enquanto a frente estiver de pé" : "Frente: absorve ataques físicos e é o alvo prioritário"}">${c.posicao === "retaguarda" ? "🛡️ Retaguarda" : "⚔️ Frente"}</span>` : "";
    // Papel de combate (item 5) e comportamento de IA nomeado (item 10, ver
    // enemyBehaviors.json — já existe com nome/descrição por arquétipo, só
    // não era mostrado em lugar nenhum da UI).
    const papel = c.isPlayer && c.classeId ? PAPEL_POR_CLASSE[c.classeId] : null;
    const badgePapel = papel ? ` <span class="badge-papel" title="Papel de combate: ${papel.nome}">${papel.icone} ${papel.nome}</span>` : "";
    const comportamento = !c.isPlayer && dados.enemyBehaviors ? dados.enemyBehaviors[c.arquetipo] : null;
    const badgeComportamento = comportamento ? ` <span class="badge-comportamento" title="${comportamento.descricao}">🧠 ${comportamento.nome}</span>` : "";
    // SELO DE ESCALA (ver EscalaSystem.js e o campo `escala` gravado em
    // criarCombatenteInimigo). Só aparece quando o reforço é grande o
    // bastante para o jogador sentir — abaixo de 8% seria ruído numérico
    // num card que já tem muita coisa.
    const escN = !c.isPlayer ? c.escalaNivel : null;
    const pctEscala = escN ? Math.round((escN.atk - 1) * 100) : 0;
    const badgeEscala = pctEscala >= 8
      ? ` <span class="badge-escala" title="Reforço da região${c.nivelMonstro ? ` (nível ${c.nivelMonstro})` : ""}: criaturas longe da vila são mais fortes que as da mesma espécie perto dela — +${pctEscala}% de ataque, +${Math.round((escN.hp - 1) * 100)}% de vida, +${Math.round((escN.defesa - 1) * 100)}% de defesa. O bônus de chefe é à parte.">🌍 +${pctEscala}%</span>`
      : "";
    // FASE ATUAL DO CHEFE. A luta muda em 66% e 33% de HP e o card não
    // dizia em qual dessas partes ela está.
    const faseAtual = c.chefe ? (c.faseAtual || 1) : 0;
    const badgeFase = faseAtual
      ? ` <span class="badge-fase fase-${faseAtual}" title="Fase ${faseAtual} de 3. A cada 66% e 33% da vida do chefe a luta muda: ele bate mais forte, age mais rápido e, da fase 2 em diante, usa a habilidade própria dele.">Fase ${faseAtual}<span class="so-desktop"> · ${nomeDaFase(faseAtual)}</span></span>` : "";
    // MARCA DE CLASSE ARMADA (item 12 da auditoria).
    //
    // As marcas são bônus condicionais — "HP próprio abaixo de 30%", "alvo
    // debilitado", "aliado ferido" — reavaliados a cada golpe. O único sinal
    // era uma linha de log escrita DEPOIS do golpe, e o jogador precisa saber
    // ANTES: é exatamente essa informação que decide se ele ataca agora ou
    // espera um turno. Avaliada contra o alvo SELECIONADO, que é justamente
    // quem ele está considerando atacar.
    let badgeMarca = "";
    if (c.isPlayer && c.vivo) {
      try {
        const alvoRef = alvoSelecionado && alvoSelecionado.vivo ? alvoSelecionado : (inimigos.find((i) => i.vivo) || null);
        const m = bonusDeMarcas(c, alvoRef, batalha.ctxMarcas(c));
        if (m.ativas && m.ativas.length) {
          const nomes = m.ativas.map((x) => `${x.icone || "◈"} ${x.nome}`).join(" · ");
          badgeMarca = ` <span class="badge-marca-armada" title="Condição atendida agora: ${nomes}. Atacar neste momento aproveita o bônus; esperar pode perdê-lo.">◈ Armado</span>`;
        }
      } catch (e) { /* marca é enfeite informativo — nunca pode derrubar o render */ }
    }
    const badgeFuria = c.enfurecido
      ? ` <span class="badge-furia" title="Enfurecido: quebrar a postura dele de novo custa muito mais, e os golpes dele doem +35%.">😤</span>` : "";
    // Ícones de status ativos (melhoria: indicador visual recorrente
    // enquanto o efeito dura, além do texto flutuante no instante em que
    // aparece — ver spawnStatusText/statusAnteriorPorCombatente).
    // Efeitos ativos, um por EFEITO (não por tipo) — ver fichaDeEfeitos.
    const efeitos = fichaDeEfeitos(c);
    const tiposAtivos = efeitos.map((e) => e.chave);
    const resumoStatus = resumoEstados(efeitos);
    const statusIconesHTML = efeitos.length
      ? `<div class="status-icones">${resumoStatus.visiveis.map((e) => {
          // O contador de turnos é a informação que faltava. `ultimo` marca o
          // turno final — o ícone pisca em vermelho, porque "acaba agora" e
          // "acaba daqui a três" mudam completamente a jogada certa.
          const ultimo = e.turnos !== null && e.turnos !== undefined && e.turnos <= 1;
          const cont = (e.turnos !== null && e.turnos !== undefined)
            ? `<b class="status-turnos${ultimo ? " ultimo" : ""}">${Math.max(0, e.turnos)}</b>` : "";
          const dataEstado = e.estadoId ? ` data-estado="${e.estadoId}"` : "";
          return `<span class="status-icone status-${e.classe}${ultimo ? " expirando" : ""}"${dataEstado} title="${String(e.titulo).replace(/"/g, "&quot;")}${e.turnos ? ` (${e.turnos} turno${e.turnos > 1 ? "s" : ""})` : ""}">${e.icone}${cont}</span>`;
        }).join("")}${resumoStatus.restantes ? `<button type="button" class="status-mais" aria-label="Ver todos os estados">+${resumoStatus.restantes}</button>` : ''}</div>`
      : "";
    div.innerHTML = `
      <div class="nome-c">${c.nome}${c.chefe ? " 👑" : ""}${c.solo && !c.chefe ? ` <span title="Reforçado por estar sozinho contra o time (task #46)">💪</span>` : ""}${c.emboscada ? ` <span title="Emboscada: moradores hostis por sua reputação ruim com esta região">🗡️ Emboscada</span>` : ""}${ehAtivo ? " ⬅" : ""}${iconeTelegrafo}${badgeElemento(c)}${c.atordoado ? ` <span class="badge-atordoado" title="Atordoado: perde o turno e recebe dano extra">💫 Atordoado</span>` : ""}</div>
      ${badgeFormacao || badgePapel || badgeComportamento ? `<div class="formacao-linha">${badgeFormacao}${badgePapel}${badgeComportamento}</div>` : ""}
      ${badgeEscala || badgeFase || badgeMarca ? `<div class="selos-linha">${badgeEscala}${badgeFase}${badgeFuria}${badgeMarca}</div>` : ""}
      <div class="combatente-sinais" aria-hidden="true">
        <span class="sinal-combate sinal-turno">▶ TURNO</span>
        <span class="sinal-combate sinal-alvo">◎ ALVO</span>
        <span class="sinal-combate sinal-area">◌ ÁREA</span>
        <span class="sinal-combate sinal-aliado-area">⚠ ALIADO</span>
      </div>
      <div class="sprite-wrap"><canvas width="192" height="192" class="sprite-canvas"></canvas></div>
      <div class="barra"><div class="barra-fill hp" style="width:${Math.max(0, (c.hp / c.hpMax) * 100)}%"></div><div class="barra-fantasma"><div class="fantasma-max"></div><div class="fantasma-esperado"></div><div class="fantasma-min"></div></div></div>
      <div style="font-size:0.7em">${c.hp}/${c.hpMax} HP <span class="previa-hp-rotulo"></span></div>
      ${c.chefe && c.posturaMax ? `<div class="barra postura-barra" title="Postura: fraquezas elementais enchem mais rápido. Ao encher, o chefe fica atordoado."><div class="barra-fill postura${c.atordoado ? " cheia" : ""}" style="width:${Math.max(0, (c.postura / c.posturaMax) * 100)}%"></div></div>` : ""}
      ${c.isPlayer ? `<div class="barra"><div class="barra-fill mp" style="width:${Math.max(0, (c.mp / c.mpMax) * 100)}%"></div></div>` : ""}
      <div class="atb-barra"><div class="atb-fill" style="width:${Math.min(100, c.atb)}%"></div></div>
      ${statusIconesHTML}
      ${!c.isPlayer ? `<button data-id="${c.id}" class="btn-alvo" aria-pressed="${alvoSelecionado && alvoSelecionado.id === c.id}" style="margin-top:4px;font-size:0.7em;padding:3px 6px;">${alvoSelecionado && alvoSelecionado.id === c.id ? "◎ Alvo atual" : "Selecionar alvo"}</button>` : ""}
    `;
    div.querySelectorAll('.status-icone').forEach(icone => {
      icone.tabIndex = 0;
      icone.setAttribute('role', 'button');
      icone.setAttribute('aria-label', icone.title);
      icone.onclick = e => { e.stopPropagation(); mostrarEstadoCombate(arena, icone.title); };
      icone.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); mostrarEstadoCombate(arena, icone.title); } };
    });
    const maisStatus = div.querySelector('.status-mais');
    if (maisStatus) maisStatus.onclick = e => { e.stopPropagation(); mostrarEstadoCombate(arena, `${c.nome}\n${resumoStatus.descricao}`); };
    const canvas = div.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    // O canvas tem 192 de lado porque o slot no celular tem 62-68 px de CSS e
    // o aparelho renderiza com DPR 3: com os 96 antigos, o pior caso já saía
    // borrado antes de qualquer arte nova. 192 cobre esse caso quase 1:1.
    // Fonte de 192 desenha 1:1; folha de 64 sobe por fator 3 — as duas escalas
    // são inteiras, que é o que mantém o pixel nítido (regra 4 do contrato).
    if (img) ctx.drawImage(img, frame, 0, ladoQuadro, ladoQuadro, 0, 0, 192, 192);
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
    if (morreuAgora && !animacoesReduzidas()) {
      div.classList.add("tombando");
      // A classe sai sozinha: o card continua existindo como `.morto` (o slot
      // é reservado até o fim da leva, de propósito), e sem a remoção a
      // animação reiniciaria a cada tique do ATB.
      setTimeout(() => div.classList.remove("tombando"), duracaoAnimacao(760));
    }
    // CURA (item 19): antes era só o `+N` verde — o mesmo texto do dano com
    // outra cor. Uma cura de 8 e uma de 60 pareciam a mesma coisa. O pilar
    // cresce com a FRAÇÃO do HP recuperada, que é o que o jogador de fato
    // quer saber ("isso me tirou do vermelho?").
    if (deltaHp > 0 && !flashDesligado) {
      const frac = Math.min(1, deltaHp / Math.max(1, c.hpMax));
      const sw = div.querySelector(".sprite-wrap");
      if (sw) {
        const pilar = document.createElement("div");
        pilar.className = "pilar-cura";
        pilar.style.setProperty("--forca", String(0.45 + frac * 1.6));
        sw.appendChild(pilar);
        setTimeout(() => pilar.remove(), duracaoAnimacao(820));
      }
    }
    // Status recém-aplicados desde a última renderização deste combatente
    // específico — dispara o texto flutuante (spawnStatusText), nunca o
    // ícone fixo sozinho (esse já é redesenhado toda vez, ver acima).
    const anteriores = statusAnteriorPorCombatente.get(c) || new Set();
    // Carrega o EFEITO inteiro (ícone, rótulo, tom), não só a chave: com os
    // estados elementais a chave sozinha não basta — `estado-molhado` não
    // está em STATUS_INFO, o nome e o ícone vêm do `def` do próprio estado.
    const statusNovos = efeitos.filter((e) => !anteriores.has(e.chave));
    statusAnteriorPorCombatente.set(c, new Set(tiposAtivos));
    elementoPorCombatente.set(c, div);
    // `relacao`/`ruptura` viajam junto com o fx pendente pra que o número
    // flutuante possa se diferenciar (itens 38-40): um golpe que explorou
    // fraqueza, um que foi resistido e um que encheu postura não podem
    // parecer a mesma coisa na tela.
    return { div, deltaHp, critico, statusNovos, relacao: fx ? fx.relacao : null, ruptura: fx ? fx.ruptura : null, selos: fx ? fx.selos : null, corElemento: fx ? fx.corElemento : null };
  }

  // Posiciona um texto flutuante usando a posição real de um elemento na
  // tela (getBoundingClientRect), então funciona corretamente mesmo com o
  // layout flex/wrap variando conforme o tamanho do time e dos inimigos.
  // `origemEl` é normalmente o `.sprite-wrap` do card (dano/cura/status) ou
  // o próprio card (miss/bloqueio, chamados antes do card ter sprite-wrap
  // atualizado). Usa a fx-layer (nunca limpa) pra sobreviver à recriação dos
  // cards a cada tick do ATB.
  // ALTURAS DOS TEXTOS FLUTUANTES, em fração da altura do sprite.
  //
  // Todas NEGATIVAS de propósito: o texto sai ACIMA do sprite, não em cima
  // dele. Antes o número de dano saía a 0,25 e o "ESQUIVOU!" no meio do
  // corpo — num jogo em que o sprite é a arte, tapar o personagem para
  // dizer o que aconteceu com ele é a troca errada.
  //
  // A ordem de cima para baixo é: selos → rótulo → número → sprite. Quem
  // olha lê o número primeiro (é o maior e o mais perto) e a explicação
  // acima dele, sem nada encostar no personagem.
  const ALTURA_NUMERO = -0.30;
  const ALTURA_ROTULO = -0.60;
  const ALTURA_SELO = -0.86;
  const PASSO_SELO = -0.26;
  const ALTURA_MISS = -0.34;
  const ALTURA_PERIODICO = -0.18;
  // O texto do status novo sai um degrau acima do rótulo do golpe — e não
  // mais longe que isso. Numa primeira versão ele saía a −1,12 e acabava
  // parando na pista de anúncios, a quase cem pixels do card: um "Corrompido
  // 3" solto no meio do campo, que não parecia pertencer a ninguém. O desvio
  // lateral (--desvio-x, já existente) é o que o separa do rótulo quando os
  // dois saem do mesmo golpe, que é o caso comum.
  const ALTURA_STATUS = -0.74;

  function posicionarFlutuante(el, origemEl, alturaFrac = ALTURA_NUMERO) {
    if (!origemEl || !fxLayer) return false;
    const arenaRect = arena.getBoundingClientRect();
    const origemRect = origemEl.getBoundingClientRect();
    el.style.left = `${origemRect.left - arenaRect.left + origemRect.width / 2}px`;
    // Teto: com as alturas negativas acima, um card na primeira fileira pode
    // empurrar o texto para fora do campo — e um número de dano invisível é
    // pior que um número mal colocado. 4px do topo é o piso.
    const topo = origemRect.top - arenaRect.top + origemRect.height * alturaFrac;
    el.style.top = `${Math.max(4, topo)}px`;
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
    // Estilhaços na cor do elemento — só quando houve VANTAGEM, porque é aí
    // que a informação vale: um golpe neutro com partículas coloridas seria
    // enfeite e diluiria o sinal justamente nos golpes que importam.
    if (deltaHp < 0 && extras.corElemento
        && (extras.relacao === "vantagem" || extras.relacao === "vantagem_intensa")) {
      estilhacarElemento(cardDiv, extras.corElemento, extras.relacao === "vantagem_intensa");
    }
    // Rótulo secundário (CRÍTICO! / VULNERÁVEL! / RESISTIDO) logo abaixo do
    // número, com um leve atraso pra não competir com ele na leitura.
    const textoSecundario = critico && deltaHp < 0 ? "CRÍTICO!" : rotulo ? rotulo.txt : null;
    if (textoSecundario) {
      const sub = document.createElement("div");
      sub.className = `dano-flutuante sub-rotulo ${critico ? "critico" : rotulo ? rotulo.cls : ""}`;
      sub.textContent = textoSecundario;
      if (posicionarFlutuante(sub, spriteWrap, ALTURA_ROTULO)) setTimeout(() => sub.remove(), duracaoAnimacao(950));
    }
    // Ruptura acumulada neste golpe (item 16/41), como um terceiro texto
    // curto — só aparece quando houve ganho real de postura.
    if (extras.ruptura && extras.ruptura > 0) {
      const rup = document.createElement("div");
      rup.className = "dano-flutuante sub-rotulo ruptura";
      rup.textContent = `RUPTURA +${extras.ruptura}`;
      if (posicionarFlutuante(rup, spriteWrap, ALTURA_ROTULO + PASSO_SELO)) setTimeout(() => rup.remove(), duracaoAnimacao(1000));
    }
    // SELOS DO GOLPE — a explicação do número, colada nele.
    //
    // Empilhados abaixo do rótulo de relação elemental, um por linha, com
    // atraso escalonado para entrarem em cascata em vez de todos de uma vez.
    // Teto de 3: um golpe pode acumular seis multiplicadores, e seis linhas
    // de texto em cima do inimigo escondem a própria luta — os três primeiros
    // são os de maior impacto, porque `selos` já sai na ordem em que os
    // multiplicadores acontecem (item > traço > marca > ambiente > postura).
    if (Array.isArray(extras.selos) && extras.selos.length && deltaHp < 0) {
      extras.selos.slice(0, 3).forEach((selo, i) => {
        const sel = document.createElement("div");
        sel.className = `dano-flutuante selo-golpe selo-${selo.tom || "bom"}`;
        sel.textContent = selo.rotulo;
        if (!posicionarFlutuante(sel, spriteWrap, ALTURA_SELO + i * PASSO_SELO)) return;
        sel.style.animationDelay = `${i * 70}ms`;
        setTimeout(() => sel.remove(), duracaoAnimacao(1150 + i * 70));
      });
    }

    // Item 84 de 100_melhorias.md: vibração tátil opcional em dano recebido/
    // crítico, só no celular (navigator.vibrate não existe em desktop) e só
    // se "reduzir efeitos" estiver desligado (mesma bandeira que já rege
    // tremor/flash — vibração é o mesmo tipo de estímulo). Padrões curtos
    // (não incomodam) e tudo dentro de try/catch: vibração nunca pode
    // quebrar o jogo em navegadores que implementam a API de forma diferente.
    if (deltaHp < 0 && !animacoesReduzidas()) {
      try { if (vibracaoAtiva() && navigator.vibrate) navigator.vibrate(critico ? [30, 40, 30] : 25); } catch (e) { /* silencioso de propósito */ }
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
    // Sai acima do card. Antes era desenhado no meio do corpo, com a fonte
    // grande o bastante para cobrir o personagem inteiro.
    somBloqueioOuErro();
    if (!posicionarFlutuante(el, spriteWrap, ALTURA_MISS)) return;
    setTimeout(() => el.remove(), duracaoAnimacao(900));
  }

  // Texto flutuante de status recém-aplicado (ex.: "☠️ Veneno") — `ordem`
  // espalha múltiplos status aplicados no mesmo instante um pouco à
  // esquerda/direita pra não empilhar exatamente um em cima do outro.
  // Partículas viajando de um card a outro, na fx-layer (que nunca é limpa,
  // então a viagem sobrevive à recriação dos cards a cada tique do ATB).
  // Usada pelo roubo de vida: o sangue sai do alvo e entra em quem bateu.
  function viajarParticulas(cardDe, cardPara, classe, quantas = 6) {
    if (!fxLayer || animacoesReduzidas()) return;
    const arenaRect = arena.getBoundingClientRect();
    const r1 = (cardDe.querySelector(".sprite-wrap") || cardDe).getBoundingClientRect();
    const r2 = (cardPara.querySelector(".sprite-wrap") || cardPara).getBoundingClientRect();
    const x1 = r1.left - arenaRect.left + r1.width / 2;
    const y1 = r1.top - arenaRect.top + r1.height / 2;
    const x2 = r2.left - arenaRect.left + r2.width / 2;
    const y2 = r2.top - arenaRect.top + r2.height / 2;
    for (let i = 0; i < quantas; i += 1) {
      const el = document.createElement("div");
      el.className = `particula-viajante ${classe}`;
      el.style.left = `${x1}px`;
      el.style.top = `${y1}px`;
      // Cada partícula sai com um desvio próprio, senão as seis viajariam
      // exatamente sobrepostas e pareceriam uma só.
      el.style.setProperty("--dx", `${x2 - x1 + (Math.random() * 18 - 9)}px`);
      el.style.setProperty("--dy", `${y2 - y1 + (Math.random() * 18 - 9)}px`);
      el.style.animationDelay = `${i * 45}ms`;
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), duracaoAnimacao(700 + i * 45));
    }
  }

  // Linha de energia ligando dois cards — o combo elemental entre aliados.
  // Desenhada como um retângulo fino girado, porque uma linha SVG exigiria
  // uma camada de svg própria só para isto.
  function ligarCards(cardA, cardB) {
    if (!fxLayer) return;
    const arenaRect = arena.getBoundingClientRect();
    const r1 = (cardA.querySelector(".sprite-wrap") || cardA).getBoundingClientRect();
    const r2 = (cardB.querySelector(".sprite-wrap") || cardB).getBoundingClientRect();
    const x1 = r1.left - arenaRect.left + r1.width / 2;
    const y1 = r1.top - arenaRect.top + r1.height / 2;
    const x2 = r2.left - arenaRect.left + r2.width / 2;
    const y2 = r2.top - arenaRect.top + r2.height / 2;
    const comp = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const el = document.createElement("div");
    el.className = "elo-combo";
    el.style.left = `${x1}px`;
    el.style.top = `${y1}px`;
    el.style.width = `${comp}px`;
    el.style.transform = `rotate(${ang}deg)`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), duracaoAnimacao(900));
  }

  // Partículas do elemento no ponto de impacto — item 16.
  //
  // A vantagem elemental vale até ×1,5 e o rótulo "VULNERÁVEL!" já existia,
  // mas o FLASH era o mesmo branco para tudo: a cor do elemento entrava só
  // como uma sombra fraca atrás do sprite. Aqui o elemento aparece de fato,
  // e é o que faz o jogador associar "usei fogo contra planta" ao número
  // grande, sem precisar ler palavra nenhuma.
  function estilhacarElemento(cardDiv, cor, forte) {
    if (!fxLayer || !cor || animacoesReduzidas()) return;
    const arenaRect = arena.getBoundingClientRect();
    const r = (cardDiv.querySelector(".sprite-wrap") || cardDiv).getBoundingClientRect();
    const cx = r.left - arenaRect.left + r.width / 2;
    const cy = r.top - arenaRect.top + r.height / 2;
    const quantas = forte ? 10 : 6;
    for (let i = 0; i < quantas; i += 1) {
      const el = document.createElement("div");
      el.className = "estilhaco-elemental";
      const ang = (Math.PI * 2 * i) / quantas + Math.random() * 0.4;
      const dist = (forte ? 42 : 28) + Math.random() * 16;
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      el.style.background = cor;
      el.style.boxShadow = `0 0 8px ${cor}`;
      el.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      el.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), duracaoAnimacao(560));
    }
  }

  // Número de dano por turno. Deliberadamente DIFERENTE do número de golpe:
  // sai do lado, mais devagar e com o ícone da fonte junto, para o jogador
  // ler "isto não foi um ataque, isto é o veneno correndo".
  function spawnDanoPeriodico(cardDiv, dano, icone, nome) {
    const spriteWrap = cardDiv.querySelector(".sprite-wrap") || cardDiv;
    const el = document.createElement("div");
    el.className = "dano-flutuante dano-periodico";
    el.innerHTML = `<span class="dp-icone">${icone}</span> −${dano}`;
    el.title = nome;
    if (!posicionarFlutuante(el, spriteWrap, ALTURA_PERIODICO)) return;
    setTimeout(() => el.remove(), duracaoAnimacao(1250));
  }

  // `efeito` é uma entrada de fichaDeEfeitos. Recebe o objeto inteiro em vez
  // do tipo porque os estados elementais não cabem numa tabela por tipo — os
  // nove compartilham o tipo `estado_elemental` e se distinguem pelo `def`.
  function spawnStatusText(cardDiv, efeito, ordem = 0) {
    if (!efeito || !efeito.icone) return;
    const spriteWrap = cardDiv.querySelector(".sprite-wrap");
    const el = document.createElement("div");
    el.className = `dano-flutuante status-flutuante status-${efeito.classe}`;
    // O ANEL que sobe (buff) ou desce (debuff) no card — item 6 da auditoria.
    // Ganhar +50% de defesa e levar −40% de velocidade apareciam exatamente
    // iguais na tela: o mesmo texto cinza, na mesma posição.
    const bom = efeito.classe === "bom" || efeito.classe === "guarda";
    const anel = document.createElement("div");
    anel.className = `anel-efeito ${bom ? "anel-bom" : "anel-ruim"}`;
    if (spriteWrap && !animacoesReduzidas()) {
      spriteWrap.appendChild(anel);
      setTimeout(() => anel.remove(), duracaoAnimacao(760));
    }
    el.textContent = `${efeito.icone} ${efeito.label}${efeito.turnos ? ` ${efeito.turnos}` : ""}`;
    el.style.setProperty("--desvio-x", `${(ordem % 2 === 0 ? -1 : 1) * (8 + ordem * 6)}px`);
    if (!posicionarFlutuante(el, spriteWrap, ALTURA_STATUS)) return;
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

  // Tremor de tela: aplicado no CANVAS do cenário, não no campo. Sacudir o
  // campo moveria os slots — exatamente o que não pode acontecer. O cenário
  // treme, os combatentes ficam onde estão.
  function sacudirArena(forte = false) {
    const alvo = palco.cenaCanvas;
    alvo.classList.remove("shake", "shake-forte");
    // força reflow para reiniciar a animação CSS mesmo se já estava tremendo
    void alvo.offsetWidth;
    alvo.classList.add(forte ? "shake-forte" : "shake");
  }

  function renderLog() {
    logEl.innerHTML = batalha.log.map((l) => `<div>${l}</div>`).join("");
    logEl.scrollTop = logEl.scrollHeight;
    // Com o registro recolhido (celular), a ÚLTIMA linha continua visível no
    // próprio resumo — o jogador nunca perde o que acabou de acontecer só
    // porque o histórico está fechado.
    // A última linha fica sempre visível no próprio botão do log, aberto ou
    // fechado — o jogador nunca perde o que acabou de acontecer.
    if (palco.logUltimaEl) {
      const ultima = batalha.log[batalha.log.length - 1] || "Registro de combate";
      palco.logUltimaEl.textContent = ultima.replace(/<[^>]+>/g, "");
    }
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
      resolverTurno(() => batalha.usarHabilidade(jogador, h, destino), { habilidade: h, ator: jogador, alvo: destino });
      return;
    }
    if (card.tipo === "sopro") {
      resolverTurno(() => batalha.usarSoproElemental(jogador), { tipo: 'sopro', nome: 'Sopro elemental', ator: jogador });
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
    // Limpo na entrada: os dois ramos abaixo que não têm mão põem a classe
    // de volta. Assim ela nunca fica presa num estado em que a mão existe.
    acoesEl.classList.remove("dock-sem-mao");
    if (telegrafo) {
      // Durante o telegraph o jogador não age (o motor de turnos já garante
      // que uma vez pronta, a ação do jogador vem ANTES da do inimigo). O
      // que mudou: a intenção continua visível na faixa de contexto depois
      // daqui, então quando a vez do jogador chegar ele ainda vê o que vem.
      acoesEl.innerHTML = `<p class="telegrafo-inimigo">${textoTelegrafo(telegrafo)}</p>`;
      acoesEl.classList.add("dock-sem-mao");
      if (painelCards) painelCards.invalidar();
      renderContextoSemMao();
      return;
    }
    if (!atacanteAtivo) {
      // DOCK SEM MÃO. Ele reserva ~27% da altura da tela e ficava preto e
      // vazio em metade do combate — todo turno inimigo, toda espera de ATB.
      // A classe troca o conteúdo, mas conserva a altura da mão: o campo e
      // os personagens não pulam entre turnos.
      acoesEl.innerHTML = "<p class='dock-espera'>Aguardando barra de iniciativa…</p>";
      acoesEl.classList.add("dock-sem-mao");
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
    // O TIME viaja junto com a decisão (ver AutoBattleAI.js): sem ele a IA
    // só consegue olhar o próprio HP, e foi por isso que um clérigo com o
    // grupo inteiro ferido atacava em vez de curar.
    const decisao = escolherAcaoAutomatica(jogador, inimigosVivos, config, dados, {
      aliados: combatentesTime.filter((c) => c.vivo),
    });
    alvoSelecionado = decisao.alvo || null;

    // Cura de grupo, buff de time e debuff em área não escolhem alvo: o
    // motor resolve sobre `timeVivo()`/`inimigosVivos()` (ver CombatSystem).
    // O alvo passado existe só porque `usarHabilidade` exige um.
    if (decisao.tipo === "curar" || decisao.tipo === "curar_time" || decisao.tipo === "buff_time") {
      resolverTurno(() => batalha.usarHabilidade(jogador, decisao.habilidade, jogador), { habilidade: decisao.habilidade, ator: jogador, alvo: jogador });
    } else if (decisao.tipo === "habilidade" || decisao.tipo === "area" || decisao.tipo === "debuff_area") {
      resolverTurno(() => batalha.usarHabilidade(jogador, decisao.habilidade, decisao.alvo), { habilidade: decisao.habilidade, ator: jogador, alvo: decisao.alvo });
    } else if (decisao.tipo === "defender") {
      // Mesma execução do card "Defender" do jogador humano — inclusive
      // consumir o turno (`primeiroTurno`/`atb`), senão a IA defenderia e
      // agiria de novo no mesmo instante, para sempre.
      resolverTurno(() => {
        jogador.defendendo = true;
        batalha.registrar(`${jogador.nome} se encolhe atrás da guarda: sem cura e sem Éter, defender é a melhor jogada.`);
        jogador.primeiroTurno = false;
        jogador.atb = 0;
      });
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
    if (item.removeStatus) {
      // BUG (auditoria de combate): isto era `alvo.statusEffects = []` — a
      // poção limpava o array INTEIRO. O jogador gastava um turno enfurecendo
      // (buff_ataque_proximo), tomava veneno, usava o antídoto, e perdia a
      // fúria, a guarda e o óleo de arma junto. A mensagem dizia "remove
      // efeitos negativos"; o código removia tudo.
      const antes = alvo.statusEffects.length;
      alvo.statusEffects = alvo.statusEffects.filter((s) => !ESTADOS_RUINS.has(s.tipo));
      const tirou = antes - alvo.statusEffects.length;
      batalha.registrar(tirou
        ? `${prefixo} e remove ${tirou} efeito${tirou > 1 ? "s" : ""} negativo${tirou > 1 ? "s" : ""}.`
        : `${prefixo}, mas não havia efeito negativo nenhum para remover.`);
      sincronizarElemento(alvo);
    }
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
  let apresentacaoCombate = null;
  let apresentandoAcao = false;
  async function orquestrarAcao(fn, acaoVisual = {}) {
    apresentandoAcao = true;
    try {
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
      await animarDado(dadoLayer, rolagem.d, { critico: rolagem.critico, fumble: rolagem.erroTotal, duracaoTotalMs: animacoesReduzidas() ? 160 : 900 });
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
      // Fx pendente (crítico + cor do elemento do golpe) pro próximo
      // cardCombatente() do alvo — ver declaração de `fxPendente` mais
      // acima. Só golpes que realmente acertaram (não erro/bloqueio)
      // ganham a cor elemental, senão um "erro" sem dano nenhum herdaria a
      // borda colorida por engano.
      const elementoAtacante = acaoVisual.habilidade?.elemento || rolagem.atacante.elemento;
      const acertou = !rolagem.erroTotal && !rolagem.bloqueado;
      const elInfo = acertou && dados.elements ? infoElemento(elementoAtacante, dados.elements) : null;
      const relacao = acertou && dados.elements
        ? relacaoElemental(elementoAtacante, rolagem.alvo.elemento || "fisico", dados.elements)
        : null;
      const ganhoRuptura = Math.max(0, (rolagem.alvo.postura || 0) - (posturaAntesPorAlvo.get(rolagem.alvo) || 0));
      // SELOS deste golpe (ver `selos` em CombatSystem.rolarAtaque). O `seq`
      // é conferido porque `ultimosSelos` é um campo só, reescrito a cada
      // golpe — sem a conferência, um golpe que não produziu selo nenhum
      // herdaria os selos do golpe anterior.
      const selosDoGolpe = (batalha.ultimosSelos && batalha.ultimosSelos.seq === rolagem.seq)
        ? batalha.ultimosSelos.selos : null;
      fxPendente = {
        alvo: rolagem.alvo,
        critico: rolagem.critico,
        corElemento: elInfo ? elInfo.cor : null,
        relacao: relacao && relacao !== "neutro" ? relacao : null,
        ruptura: ganhoRuptura,
        selos: selosDoGolpe,
      };
      // Hit-stop de crítico (item 42): pausa MUITO curta (90ms) — o
      // suficiente para o golpe "pesar", longe de travar o jogo.
    }
    if (!apresentacaoCombate) apresentacaoCombate = criarApresentacaoCombate(arena, c => elementoPorCombatente.get(c));
    const alterados = batalha.todos().filter(c => c.hp !== hpAntesPorAlvo.get(c) || c.statusEffects.some(s => !estadosAntes.get(c)?.has(s.estadoId || s.tipo)));
    const atorVisual = acaoVisual.ator || rolagem?.atacante || atacanteAtivo;
    const alvosVisuais = alterados.length ? alterados : [acaoVisual.alvo || rolagem?.alvo || atorVisual].filter(Boolean);
    const visual = { ...acaoVisual, erro: !!rolagem?.erroTotal, bloqueado: !!rolagem?.bloqueado, alvoRolagem: rolagem?.alvo,
      resultados: new Map(batalha.todos().map(c => [c, { dano: Math.max(0, (hpAntesPorAlvo.get(c) ?? c.hp) - c.hp), cura: Math.max(0, c.hp - (hpAntesPorAlvo.get(c) ?? c.hp)) }])),
      critico: !!rolagem?.critico && !rolagem?.erroTotal && !rolagem?.bloqueado };
    if (!visual.habilidade && !rolagem && alterados.some(c => c.hp > hpAntesPorAlvo.get(c))) visual.tipo = 'cura';
    else if (!visual.habilidade && !rolagem && atorVisual?.defendendo) visual.tipo = 'defesa';
    await apresentacaoCombate.executar({ ator: atorVisual, alvos: alvosVisuais, acao: visual, impacto: () => {
      renderArena(); renderLog();
      if (rolagem?.erroTotal || rolagem?.bloqueado) {
        const el = elementoPorCombatente.get(rolagem.alvo);
        if (el) spawnMissText(el, rolagem.erroTotal ? 'ESQUIVOU!' : 'BLOQUEADO!');
      }
    } });
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
    } finally { apresentandoAcao = false; }
  }

  // Faixa curta no centro da arena (POSTURA ROMPIDA, NATURAL 20, NATURAL 1).
  // Some sozinha; nunca bloqueia clique (pointer-events: none no CSS).
  function mostrarFaixaCentral(texto, classe) {
    if (animacoesReduzidas() && classe !== "faixa-ruptura") return;
    // A faixa entra pela MESMA fila dos letreiros de revelação, na pista de
    // anúncios. Antes ela era desenhada na fx-layer a 34-40% da altura do
    // campo — ou seja, em cima da fileira de inimigos — e podia coincidir
    // com um letreiro no mesmo instante. Passando pela fila, uma espera a
    // outra e nenhuma das duas sai da pista.
    if (anunciarFaixa(texto, classe)) return;
    // Sem batalha montada (ou com a camada já desmontada), cai no caminho
    // antigo em vez de sumir com o aviso.
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

  async function resolverTurno(fn, acaoVisual = {}) {
    // Trava contra clique duplo/agendamento automático simultâneo enquanto
    // a animação da ação anterior ainda está rodando (ver declaração de
    // `turnoEmAndamento`).
    if (turnoEmAndamento) return;
    turnoEmAndamento = true;
    if (acoesEl) acoesEl.classList.add("acoes-bloqueadas");
    const atorDoTurno = atacanteAtivo;
    await orquestrarAcao(fn, acaoVisual);
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
    const atraso = tempoAviso(autoPlayState.ativo, !!inimigo.chefe, duracaoAnimacao(1000) / 1000);
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
        }, { ...plano, ator: inimigo });
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
      if (pausado || batalha.terminada || apresentandoAcao) return;
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
    // Sem isto, os ouvintes desta batalha continuariam vivos e a PRÓXIMA
    // luta desenharia letreiros duplicados — um por batalha já encerrada.
    if (pararRevelacoes) pararRevelacoes();
    pararOuvintesDeStatus.forEach((fn) => fn && fn());
    // O palco cria um ResizeObserver preso ao campo. A batalha seguinte
    // reescreve o innerHTML da tela, então sem isto sobrava um observador
    // vivo apontando para um campo já destacado do documento — um por luta.
    if (palco && typeof palco.destruir === "function") palco.destruir();
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
      // Saldo do óleo de arma volta para o personagem: o combatente morre com
      // a tela, então sem isto o óleo ou seria eterno (5 turnos por luta, para
      // sempre) ou sumiria no fim da primeira batalha.
      devolverOleoAoPersonagem(membro, c);
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
        // `rolarQuedas` já testa a chance E respeita `quedas` (chefe cai 2x).
        itensGanhos.push(...rolarQuedas(tabela, dados.items.itens));
        if (personagem.tracoId === "ganancioso" && tabela && Math.random() < 0.5) {
          const item2 = sortearLoot(tabela.pool, dados.items.itens);
          if (item2) itensGanhos.push(item2);
        }
      });
      personagem.ouro += totalOuro;
      itensGanhos.forEach((item) => personagem.inventario.push({ ...item, uid: cryptoId() }));
      registrarProgressoDiario(personagem, "vitoria", 1);
      // Equipamento automático (pedido do jogador): loot de batalha é a
      // principal fonte de peça nova, então é aqui que preencher slot
      // vazio mais rende. Só mexe em slot `null` — nunca troca o que o
      // jogador escolheu. As peças vestidas entram no resumo de vitória
      // logo abaixo, em vez de virar mais uma mensagem solta na tela.
      const equipadasAuto = autoEquiparSlotsVazios(personagem, time, dados);

      time.forEach((membro) => {
        const nivelAntes = membro.nivel;
        const { ganho, subiuNivel } = ganharXP(membro, totalXP);
        subiuNivel.forEach((novoNivel) => { aplicarCrescimento(membro, dados); concederPontosPorNivel(membro, novoNivel); });
        // A celebração é SÓ do personagem principal e SÓ do último nível
        // alcançado: um convocado do gacha subindo não merece parar a tela, e
        // subir dois níveis de uma vez não deve tocar a animação duas vezes.
        // O atraso deixa a tela de vitória aparecer primeiro — a animação
        // entra por cima dela, que é onde o jogador já está olhando.
        if (membro === personagem && subiuNivel.length) {
          setTimeout(() => celebrarNivel(subiuNivel[subiuNivel.length - 1], nivelAntes), 900);
        }
        // Resumo do automático (item 16): só o personagem principal, pra não
        // somar XP do time de gacha em cima do XP do protagonista (números
        // que o jogador não consegue comparar diretamente com nada na UI).
        if (autoPlayState.ativo && membro === combatentesTime[0]) registrarGanhosAuto({ xp: ganho });
      });
      // A coleção inteira cresce junto da jornada. Reservas recebem uma
      // fração menor, mantendo vantagem clara para quem realmente combateu.
      concederXPReservas(personagem, totalXP, dados).forEach(({ membro, subiuNivel }) => {
        subiuNivel.forEach((novoNivel) => concederPontosPorNivel(membro, novoNivel));
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
      if (equipadasAuto.length) {
        logEl.innerHTML += `<div>🎽 Equipado automaticamente: ${textoAcoesEquipamento(equipadasAuto, personagem)}</div>`;
      }
      if (temCompraDisponivel(personagem, dados)) {
        logEl.innerHTML += `<div>🌟 Você tem pontos de habilidade para gastar! Abra a Árvore (T).</div>`;
      }
      logEl.scrollTop = logEl.scrollHeight;
      const btn = botao("Continuar", () => { screenEl.classList.add("hidden"); onFim("vitoria"); document.getElementById("app")?.classList.remove("em-batalha"); document.body.classList.remove("em-batalha"); retomarCartoes(); });
      btn.className = "primario";
      acoesEl.appendChild(btn);
      agendarContinuarAutomatico(btn);
    } else if (batalha.resultado === "fuga") {
      acoesEl.innerHTML = "";
      const btn = botao("Continuar", () => { screenEl.classList.add("hidden"); onFim("fuga"); document.getElementById("app")?.classList.remove("em-batalha"); document.body.classList.remove("em-batalha"); retomarCartoes(); });
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
      const btn = botao("Voltar à vila", () => { screenEl.classList.add("hidden"); onFim("derrota"); document.getElementById("app")?.classList.remove("em-batalha"); document.body.classList.remove("em-batalha"); retomarCartoes(); });
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

  // Alça de INSPEÇÃO devolvida pra quem chamou. Não é usada pelo jogo (o
  // main.js ignora o retorno) — existe pra o teste de layout shift
  // (scripts/test-batalha-layout.mjs) conseguir forçar troca de personagem
  // ativo, morte de um monstro específico e enchente de log sem depender de
  // clicar em pixel, que seria frágil. Só expõe o que já existe; não abre
  // nenhum caminho novo pra alterar regra de combate.
  return {
    combatentesTime,
    inimigos,
    batalha,
    trocarAtivo() {
      const vivos = combatentesTime.filter((c) => c.vivo);
      if (!vivos.length) return null;
      const atual = vivos.indexOf(atacanteAtivo);
      atacanteAtivo = vivos[(atual + 1) % vivos.length];
      renderArena();
      renderAcoes();
      return atacanteAtivo.nome;
    },
    matarInimigo(indice) {
      const alvo = inimigos.filter((i) => i.vivo)[indice];
      if (!alvo) return false;
      alvo.hp = 0;
      alvo.vivo = false;
      renderArena();
      return true;
    },
    encherLog(n) {
      for (let i = 0; i < n; i += 1) batalha.log.push(`linha de teste ${i + 1}`);
      renderLog();
    },
    // Força o caminho de render REAL sem passar por uma ação. Existe para o
    // medidor de deslocamento (scripts/medir-layout-batalha.mjs) poder mexer
    // no estado já exposto acima — hp, statusEffects, vivo, atb — e ver a
    // tela reagir exatamente como reagiria numa batalha de verdade, em vez
    // de o teste medir um render sintético que não prova nada.
    render() {
      renderTimeline();
      renderArena();
      renderLog();
      renderAcoes();
    },
  };
}
