import { carregarDados, carregarTodasImagens } from "./data/loader.js";
import { criarMemoriaNpcAuto } from "./systems/AutoNpcMemory.js";
import { atualizarBotaoAutoFixo } from "./ui/AutoToggleUI.js";
import {
  TILE, SOLID_TILES, zonaNoPonto, ZONAS, OVERWORLD_W, OVERWORLD_H,
  buildDungeon, buildDungeon2, DUNGEON_W, DUNGEON_H, DUNGEON2_W, DUNGEON2_H,
  DUNGEON_SPAWN, DUNGEON_EXIT_ZONE, CHESTS_DUNGEON, BOSS_TILE,
  DUNGEON2_SPAWN, DUNGEON2_EXIT_ZONE, CHESTS_DUNGEON2, BOSS_TILE2,
  OVERWORLD_SPAWN,
} from "./data/worldMap.js";
// ETAPA 2: o mundo aberto deixou de ser um punhado de constantes escritas à
// mão e passou a ser CONSTRUÍDO a partir dos dados de src/data/world/ — baú,
// nó, POI, assentamento, boca de masmorra e chefe saem todos daqui, cada um
// num tile andável da própria zona. Ver src/systems/WorldBuilder.js.
import { mundoDaSemente, bausEscondidosDoMundo } from "./systems/WorldBuilder.js";
import { aplicarIdentidadeRetroativa, recompensaDescoberta, multOuroBau, multFragmentosExploracao, chanceColheitaExtra, bonusPrioridadeAuto } from "./systems/IdentidadeSystem.js";
import { ganharXP, aplicarCrescimento } from "./systems/CharacterFactory.js";
import { verificarDestino, registrarColeta, textoRecompensa, textoObjetivo } from "./systems/DestinoSystem.js";
import { concederPontosPorNivel } from "./systems/TalentSystem.js";
import { ROTAS_MARITIMAS } from "./data/world/routes.js";
import { Renderer, propOcluiJogador } from "./render/Renderer.js";
import { ligarAjusteDeViewport, pedirTelaCheiaNoPrimeiroGesto, alternarTelaCheia, emTelaCheia, suportaTelaCheia } from "./systems/ViewportSystem.js";
import { montarCriacaoPersonagem, MOTIVACOES_CRIACAO } from "./ui/CharacterCreationUI.js";
import { atualizarHUD, atualizarIndicadorRecomendacaoTime, mostrarMensagem, notificarSucesso, montarInventario, montarMissoes, montarForja, montarDialogo, fecharModal, montarViagemRapida, montarNavegacao, entregarMissao } from "./ui/GameUI.js";
import { iniciarBatalha } from "./ui/BattleUI.js";
import { montarGacha } from "./ui/GachaUI.js";
import { montarArvoreHabilidades } from "./ui/SkillTreeUI.js";
import { montarCaminhoHerdeiro } from "./ui/TalentTreeUI.js";
import { montarCompendio } from "./ui/CompendiumUI.js";
import { montarAtlas } from "./ui/AtlasUI.js";
import { mostrarDesafioAmeaca } from "./ui/ThreatUI.js";
import { interacaoAutomaticaPronta } from "./ui/HdaUI.js";
import { celebrarRecompensa } from "./ui/RewardCelebrationUI.js";
import { destravarAudio } from "./ui/SoundFX.js";
import { escolhaAutomatica, escolherNo } from "./systems/SkillTreeSystem.js";
import {
  garantirEstadoMasmorras, progressoDaMasmorra, masmorraEmEspera,
  marcarMasmorraLimpa, textoDeEspera,
} from "./systems/DungeonSystem.js";
import { FLAGS } from "./data/featureFlags.js";
import { sortearEncontroDeLista, deveDispararEncontro, deveSerHorda, sortearLevasHorda, reforcarEmboscada, reforcarAgressaoNoturna, chanceAjustadaPeloGrupo, iniciarTregua } from "./systems/EncounterSystem.js";
import { sortearLoot, descansar, usarConsumivel } from "./systems/InventorySystem.js";
import { marcarExploracao } from "./systems/QuestSystem.js";
import { salvarJogo, carregarJogo, existeSave, migrarSave, LAYOUT_MUNDO, listarSlots, selecionarSlot, slotAtivo, apagarSave } from "./systems/SaveSystem.js";
import { iniciarLoginGoogle, processarRetornoLogin, usuarioAtual, sair, salvarNaNuvem, carregarDaNuvem } from "./systems/CloudSave.js";
import { estadoGachaInicial, membrosDoTime, adicionarFragmentos, checarConquistas } from "./systems/GachaSystem.js";
import {
  garantirEstadoDePets, petAtivo, alvosDoPet, idDaFonte, rumoAte,
  fatorDeTregua, INTERVALO_ACAO_MS,
} from "./systems/PetSystem.js";
import { FRAGMENTOS } from "./data/economyConfig.js";
import { testesDoContexto, realizarTeste } from "./systems/SkillCheckSystem.js";
import { autoPlayState, zerarResumoAuto, registrarResultadoBatalhaAuto, registrarGanhosAuto, textoResumoAuto } from "./systems/AutoPlayState.js";
import { autoEquiparSlotsVazios, textoAcoesEquipamento } from "./systems/AutoEquipSystem.js";
import { decidirPassoExploracao, PRIORIDADE } from "./systems/AutoExploreAI.js";
import { facaoDaZona, deveEmboscar, registrarDecisao } from "./systems/WorldStateSystem.js";
import { marcarZonaVisitada, marcarMacroVisitada, pontoDeChegada, pontosDeViagemDisponiveis } from "./systems/FastTravelSystem.js";
import {
  NEVOA, garantirNevoa, estadoDaZona, aoEntrarNaZona, verificarLandmarks,
  reavaliarDominio, resumoNevoa, promoverLocal, estadoDoLocal,
} from "./systems/FogOfWarSystem.js";
import { novaSemente, normalizarSemente, formatarSemente, lerSemente } from "./systems/WorldSeed.js";
import { macroDaZona, zonaPorId, trilha, INTERIORES, resumoHierarquia, vizinhasDaZona } from "./data/worldHierarchy.js";
import {
  gradeDeChunks, criarIndice, objetosPerto, objetosNoRaioDeTiles,
  chunksAtivos, diferencaDeChunks, estatisticasDoIndice,
} from "./systems/ChunkSystem.js";
import { registrarProgressoDiario } from "./systems/DailyQuestSystem.js";
import { elegivelParaNgPlus, aplicarNewGamePlus } from "./systems/NewGamePlusSystem.js";
import { climaAtualDaZona, horaDoDiaAtual, ehNoite } from "./systems/WeatherSystem.js";
import { posicionarNpcs } from "./systems/NpcPlacement.js";
import {
  garantirMemoriaNpcs, registrarConversa, registrarEncontroRecorrente,
  memoriaParaSave, carregarMemoriaDoSave,
} from "./systems/NpcSystem.js";
import {
  garantirQuestsRegionais, questsRegionaisParaSave, carregarQuestsRegionaisDoSave,
  podeInvestigarElric, investigarElric,
  registrarConversaAltaverde, podeExaminarPortaAltaverde, examinarPortaAltaverde,
  questsOferecidasPor, progressoObjetivoRegional,
} from "./systems/RegionalQuestSystem.js";
// Cenas: o prólogo (uma vez, em jogo novo) e as aberturas de questline
// regional (disparadas de dentro do diálogo do NPC, em GameUI.js).
import { reproduzirCutscene, cutsceneAberta } from "./ui/CutsceneUI.js";
import { abrirTutorialInicial, tutorialAberto, registrarCombateTutorial } from "./ui/LiveTutorialUI.js";
import { melhorRecomendacaoTime, chaveDaRecomendacao } from "./systems/CombatPowerSystem.js";
import { cutscenePorId } from "./systems/CutsceneSystem.js";
// Mapas: o minimapa do HUD (arredores, canto superior esquerdo) e o
// mapa-múndi inteiro (regiões, zonas e níveis). Ver MapaSystem.js para a
// camada de dados que os dois compartilham.
import { montarMinimapa, atualizarMinimapa } from "./ui/MinimapaUI.js";
import { montarMapaMundo } from "./ui/MapaMundoUI.js";
import { preencherPainelEstado } from "./ui/PainelEstadoUI.js";
import { faixaDeNivel, ameacaRelativa, zonaDoMundoPorId } from "./systems/MapaSystem.js";
// Cartões de decisão: o jogo passa a CONTAR o que já sabia (item melhor na
// mochila, habilidade destravada, material suficiente para forjar). Ver
// GatilhosCartao.js para a lista do que pode interromper o jogador.
import { iniciarCartoes, mostrarProximo, registrarAoSubirNivel, celebrarNivel } from "./ui/CartaoUI.js";
import { enfileirar, tiquear, GANHO_MINIMO_PADRAO } from "./systems/CartaoSystem.js";
import { gatilhosDoMomento } from "./systems/GatilhosCartao.js";
import {
  reavaliar as reavaliarEventos, aplicarNoWorldState, eventosAtivos as listarEventosAtivos,
  efeitosNaZona, eventosParaSave, carregarEventosDoSave, garantirEventos,
  resumoDosEventos,
} from "./systems/RegionalEventSystem.js";
import { montarAcessibilidade, aplicarClassesAcessibilidade } from "./ui/AccessibilityUI.js";
import { limiteHpAutoPlay, multiplicadorVelocidadeAutoExploracao, pararAutoAntesDoChefe, autoCuidarDoTime } from "./systems/AccessibilitySystem.js";
import { planejarCuidado, textoCuidado, deveEvitarEncontro } from "./systems/AutoCareSystem.js";
import { gerarPontosDescanso, gerarPontoDescansoMasmorra, podeDescansar } from "./systems/RestSystem.js";
import { registrarEvento, resumoTelemetria } from "./systems/TelemetrySystem.js";
import { deveDispararEventoExploracao, sortearEventoExploracao } from "./systems/ExplorationEventSystem.js";
import { mostrarEventoExploracao } from "./ui/ExplorationEventUI.js";
import { montarDiarioDeDecisoes } from "./ui/DecisionJournalUI.js";
import { deveAparecerMercador, sortearEstoqueMercador } from "./systems/TravelingMerchantSystem.js";
import { mostrarMercadorItinerante } from "./ui/TravelingMerchantUI.js";
import { ligarCursorTeclado } from "./ui/CursorTeclado.js";
import { montarParty } from "./ui/PartyUI.js";
import { missaoRastreada, progressoDaMissao, textoObjetivoMissao, ehMissaoPrincipal, missaoPronta, entregaImediata } from "./systems/QuestSystem.js";

// Libera o sintetizador no primeiro gesto em qualquer tela. O evento é
// único e passivo: não interfere em botões, movimento ou rolagem.
document.addEventListener("pointerdown", destravarAudio, { once: true, passive: true });

let usuarioLogado = null;
let intervaloAutoSave = null;
let intervaloClima = null; // melhoria pós-backlog: refresh periódico do indicador de clima/hora do dia
let intervaloPet = null;   // relógio do companheiro de mapa (ver PetSystem.js)

const canvas = document.getElementById("game-canvas");
let renderer, imagens, dados;
// Recalcula o enquadramento do canvas e as áreas ocupadas por HUD e
// controles. Guardado porque precisa ser chamado de novo quando o HUD e os
// controles APARECEM (ao começar a jogar): até esse momento eles não têm
// tamanho, e a dica de interação seria posicionada sobre um rodapé que ainda
// não existia — foi assim que ela nasceu em cima do direcional.
let ajustarViewport = null;
let personagem = null;
let cacheRecomendacaoTime = { assinatura: null, valor: null };

function assinaturaDoTime() {
  if (!personagem?.gacha) return "sem-time";
  const resumir = (m) => [m.uid || "player", m.nivel, m.hpMax, m.mpMax, m.classeId, m.facaoId,
    m.atributos, Object.values(m.equipamento || {}).map((i) => i ? [i.uid || i.id, i.nivelForja || 0] : null)];
  return JSON.stringify({ ativo: personagem.gacha.timeAtivo, formacao: personagem.formacao, membros: [personagem, ...personagem.gacha.personagensObtidos].map(resumir) });
}

function atualizarInterfacePrincipal() {
  if (!personagem) return;
  atualizarBotaoAutoFixo(alternarModoAutomatico);
  entregarDestinoPessoal();
  atualizarHUD(personagem);
  const assinatura = assinaturaDoTime();
  if (cacheRecomendacaoTime.assinatura !== assinatura) {
    cacheRecomendacaoTime = { assinatura, valor: melhorRecomendacaoTime(personagem, dados || {}) };
  }
  atualizarIndicadorRecomendacaoTime(personagem, cacheRecomendacaoTime.valor, chaveDaRecomendacao(cacheRecomendacaoTime.valor));
}

const mundo = {
  mapaAtual: "overworld",
  // Semente do mundo (task #34). É ela, e não a grade, que vai pro save: o
  // mapa inteiro é reconstruído a partir dela no boot, idêntico tile por
  // tile. Definida em iniciarMundo() — jogo novo sorteia uma, save antigo
  // recebe SEMENTE_LEGADO na migração v2->v3 (ver SaveSystem.js).
  semente: null,
  grid: null,
  gridDungeon: null,
  player: { x: 6, y: 5, dir: "baixo", frame: 0, ultimoMovimento: 0 },
  chests: [],
  nodes: [],
};

async function boot() {
  registrarEvento("sessao_inicio");
  window.addEventListener("beforeunload", () => registrarEvento("sessao_fim"));
  // Item 98 de 100_melhorias.md: telemetria mínima 100% local (nada sai do
  // navegador) — HDA_TELEMETRIA() no console mostra o resumo, igual ao
  // padrão HDA_PLAYTEST()/HDA_COMMUNITY_REPORT() de outras cópias do jogo.
  window.HDA_TELEMETRIA = () => { const r = resumoTelemetria(); console.log(r); return r; };
  // Diagnóstico de enquadramento — quantos tiles cabem na tela agora e com
  // que tamanho. É o que o teste de celular lê pra saber se o jogador enxerga
  // o bastante à frente (ver scripts/test-mobile-retrato.mjs).
  window.HDA_TELA = () => {
    if (!renderer) return null;
    const t = renderer.tilesVisiveis();
    return { ...t, tilePx: renderer.tilePx, escala: +renderer.escala.toFixed(2) };
  };
  // Personagem vivo, para verificação automatizada. Mesmo padrão dos outros
  // ganchos de diagnóstico: só leitura, nada do jogo depende dele. Usado por
  // scripts/ver-retratos-gacha.mjs para montar um estado real de coleção em
  // vez de forjar objetos de personagem à mão.
  window.HDA_PERSONAGEM = () => personagem;
  // Setas andam entre as opções da janela aberta, barra de espaço seleciona.
  // Ligado uma vez, no boot: o cursor descobre sozinho o que está na tela, e
  // sai do caminho quando a batalha (que tem cursor próprio) está aberta.
  ligarCursorTeclado();
  // Diagnóstico da geografia (ETAPA 1) — mesmo padrão do HDA_TELEMETRIA():
  // mostra a semente do mundo, onde o jogador está na hierarquia inteira e o
  // retrato da estrutura (quantas macro-regiões, quantas derivadas, quanto
  // mapa ainda está sem zona).
  window.HDA_MUNDO = () => {
    const indice = mundo.indices && mundo.indices[mundo.mapaAtual];
    const r = {
      semente: mundo.semente, sementeLegivel: formatarSemente(mundo.semente),
      mapaAtual: mundo.mapaAtual,
      onde: mundo.mapaAtual === "overworld" ? trilha(mundo.player.x, mundo.player.y) : mundo.mapaAtual,
      ...resumoHierarquia(),
      // Posição crua: os testes precisam saber SE o personagem andou, e
      // `onde` é texto de trilha — igual pra tiles vizinhos.
      jogadorX: mundo.player.x, jogadorY: mundo.player.y,
      chunksCarregados: mundo.chunksAtivos ? [...mundo.chunksAtivos].join(" ") : "—",
      indice: indice ? estatisticasDoIndice(indice) : null,
      objetosDesenhados: objetosAtivos().length,
      // Baús do mundo aberto que este herói enxerga — os escondidos só
      // existem para o Elfo (traço racial "Olhos da Floresta").
      baus: (mundo.chests || []).length,
      bausEscondidos: (mundo.chests || []).filter((c) => c.escondido).length,
      // Estado das masmorras: quantos baús faltam, se o chefe está de pé e
      // se o lugar está em espera depois de concluído (ver DungeonSystem.js).
      // Só leitura — é o que permite a um teste afirmar "o automático
      // concluiu a masmorra" em vez de "o automático andou bastante".
      masmorras: Object.fromEntries(Object.entries(MASMORRAS).map(([id, m]) => {
        const prog = progressoDaMasmorra(mundo, m, () => chefeDaMasmorraDisponivel(m));
        return [id, { ...prog, emEspera: masmorraEmEspera(mundo, id), entrada: { ...m.entrance } }];
      })),
    };
    console.log(r);
    return r;
  };
  // Gancho só de teste, no mesmo espírito de HDA_MUNDO/HDA_PERSONAGEM: põe o
  // personagem num ponto do mapa. Sem isso, um teste que quer verificar a
  // masmorra teria de esperar o automático ATRAVESSAR o mundo aberto até a
  // entrada — centenas de passos de caminhada que não são o que está sendo
  // testado. Não muda nada em nenhuma partida: é uma função a mais no
  // `window`, nunca chamada pelo jogo.
  window.HDA_TELEPORTE = (x, y) => {
    mundo.player.x = x;
    mundo.player.y = y;
    marcarTeleporteVisual();
    atualizarChunksAtivos();
    return { x: mundo.player.x, y: mundo.player.y, mapa: mundo.mapaAtual };
  };
  // Ganchos de diagnóstico da reconstrução do mapa (PASS 2): dão acesso à
  // grade ativa e ao renderer pra um teste poder conferir enquadramento e
  // camada de props sem depender de olhar a imagem.
  // Posição VISUAL do herói (a interpolada), sem console.log: um medidor de
  // fluidez precisa ler isto a cada quadro, e HDA_MUNDO imprime no console.
  // Só de teste: move a posição LÓGICA sem declarar teleporte, para a
  // posição visual ter de alcançá-la. É assim que se mede se a caminhada
  // depende ou não da taxa de quadros.
  window.HDA_TELEPORTE_LOGICO = (x, y) => {
    mundo.player.x = Math.round(x);
    mundo.player.y = Math.round(y);
    return { x: mundo.player.x, y: mundo.player.y };
  };
  window.HDA_RENDER_POS = () => ({ x: mundo.player.renderX, y: mundo.player.renderY, frame: mundo.player.frame });
  window.HDA_GRID = () => gridAtiva();
  window.HDA_PROPS = () => propsAtivos();
  window.HDA_NPCS = () => npcsAtivos();
  window.HDA_ASSENTAMENTOS = () => (mundo.gerado?.assentamentos || []);
  // Só de teste: a LISTA DE ALVOS que o modo automático está enxergando
  // agora, já pontuada. Sem isto, depurar "por que o herói não sai do lugar"
  // é adivinhação — a decisão mora dentro de uma função privada que roda
  // dezenas de vezes por segundo.
  window.HDA_AUTO_ALVOS = () => {
    const alvos = alvosAutoExploracao();
    const px = mundo.player.x; const py = mundo.player.y;
    return alvos.map((a) => ({
      tipo: a.tipo, x: a.x, y: a.y,
      dist: Math.round(Math.hypot(a.x - px, a.y - py)),
      prioridade: a.prioridade,
      peso: a.pesoDistancia,
      missaoId: a.missaoId || null,
      patrulhando: !!a.patrulhando,
    })).sort((u, v) => v.prioridade - u.prioridade);
  };
  window.HDA_AUTO_MISSOES = () => (personagem.missoesAtivas || []).map((m) => {
    const def = (dados.quests || []).find((q) => q.id === m.id);
    if (!def) return { id: m.id, def: null };
    const d = destinoDeMissao(def);
    return { id: m.id, tipo: def.tipo, regiao: def.regiao, mapaAlvo: def.mapaAlvo,
      destino: d ? { x: d.x, y: d.y, mapa: d.mapa, pronto: !!d.pronto, patrulhando: !!d.patrulhando } : null };
  });
  // Só de teste: a mesma regra de oclusão que o renderer usa, exposta para
  // um teste poder encontrar uma posição que de fato fica atrás da copa.
  window.HDA_OCLUI = (prop, jogador) => propOcluiJogador(prop, jogador);
  window.HDA_RENDERER = () => renderer;
  // Gancho só de teste, no mesmo espírito de HDA_TELEPORTE: abre uma batalha
  // com os monstros pedidos (ids do monsters.json), no lugar onde o herói
  // está. Sem ele, testar uma regra de batalha no navegador dependia de
  // andar a esmo até um encontro aleatório. Nunca chamado pelo jogo.
  window.HDA_BATALHA = (ids = []) => {
    const defs = ids.map((id) => (dados.monsters || []).find((m) => m.id === id)).filter(Boolean);
    if (!defs.length || !personagem) return false;
    dispararBatalha(defs);
    return true;
  };
  processarRetornoLogin();
  // Acessibilidade (melhoria pós-backlog, ver AccessibilitySystem.js):
  // aplica a preferência salva (tamanho de fonte/alto contraste) já no
  // carregamento, antes de qualquer tela aparecer — sem isso o jogador
  // veria um "flash" da aparência padrão antes de trocar pra preferida.
  aplicarClassesAcessibilidade();
  document.getElementById("btn-acessibilidade").onclick = () => montarAcessibilidade(personagem, () => personagem && atualizarHUD(personagem));
  dados = await carregarDados();
  imagens = await carregarTodasImagens(dados);
  renderer = new Renderer(canvas, imagens);
  // Tela cheia (ETAPA 2): o canvas acompanha a viewport de verdade — barra de
  // endereço recolhendo, rotação, teclado abrindo. Ver ViewportSystem.js.
  ajustarViewport = ligarAjusteDeViewport(renderer);
  // Tela cheia de navegador + trava de retrato só podem ser pedidas dentro de
  // um gesto do jogador, então ficam penduradas no botão que começa o jogo.
  pedirTelaCheiaNoPrimeiroGesto([
    document.getElementById("btn-novo-jogo"),
    document.getElementById("btn-continuar"),
    document.getElementById("btn-ng-plus"),
  ]);

  document.getElementById("btn-novo-jogo").onclick = () => iniciarCriacao();
  montarSlotsDeSave();
  if (existeSave()) {
    // New Game+ (melhoria pós-backlog original): só oferece o botão se o
    // save existente já derrotou o chefe final ao menos uma vez (ver
    // NewGamePlusSystem.js) — evita reiniciar "por engano" cedo demais.
    const salvoAtual = carregarJogo();
    if (elegivelParaNgPlus(salvoAtual)) {
      const btnNg = document.getElementById("btn-ng-plus");
      const proximoNivel = (salvoAtual.personagem.ngPlus || 0) + 1;
      btnNg.textContent = `Nova Jornada+ (NG+${proximoNivel})`;
      btnNg.classList.remove("hidden");
      btnNg.onclick = () => iniciarCriacaoNgPlus(salvoAtual);
    }
  }

  await atualizarPainelLogin();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // Navegação por hubs: uma definição só (ver HUBS em GameUI.js) alimenta a
  // coluna agrupada do desktop e a barra inferior do celular.
  montarNavegacao(onHudAction);
  const atualizarOrientacaoMobile = () => {
    const paisagem = window.innerWidth > window.innerHeight;
    document.body.classList.toggle("mobile-paisagem", paisagem);
    document.body.classList.toggle("mobile-retrato", !paisagem);
  };
  atualizarOrientacaoMobile();
  let larguraAnterior = window.innerWidth;
  let alturaAnterior = window.innerHeight;
  let resizePendente = 0;
  window.addEventListener("resize", () => {
    atualizarOrientacaoMobile();
    if (resizePendente) cancelAnimationFrame(resizePendente);
    resizePendente = requestAnimationFrame(() => {
      resizePendente = 0;
      const largura = window.innerWidth;
      const altura = window.innerHeight;
      // Barras de endereço/teclado virtual mudam só a altura. Não recriar
      // botões e listeners durante cada pixel desse ajuste no celular.
      if (largura !== larguraAnterior || (largura > altura) !== (larguraAnterior > alturaAnterior)) {
        montarNavegacao(onHudAction);
        atualizarInterfacePrincipal();
      }
      larguraAnterior = largura;
      alturaAnterior = altura;
    });
  });
  document.addEventListener("hda:abrir-mapa-missao", () => abrirMapaMundo());
  // Em celular, trocar de aplicativo ou apagar a tela não pode custar
  // progresso. As animações também param enquanto a página está oculta.
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("app-em-segundo-plano", document.hidden);
    if (document.hidden && personagem) salvarProgresso({ silencioso: true });
  });
  // (o clique de cada botão já é ligado por montarNavegacao, que é quem os cria)
  configurarControlesToque();
}

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[caractere]);
}

function rotuloDeId(id, reserva = "Aventureiro") {
  if (!id) return reserva;
  return String(id).replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, (letra) => letra.toUpperCase());
}

function dataDoSave(timestamp) {
  const data = new Date(Number(timestamp));
  if (!timestamp || Number.isNaN(data.getTime())) return { texto: "Data não registrada", iso: "" };
  return {
    texto: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data),
    iso: data.toISOString(),
  };
}

function confirmarExclusaoSlot(info) {
  const dialogo = document.createElement("dialog");
  dialogo.className = "dialogo-excluir-save";
  dialogo.setAttribute("aria-labelledby", "excluir-save-titulo");
  dialogo.setAttribute("aria-describedby", "excluir-save-descricao");
  const nome = escaparHtml(info?.nome || `Slot ${info?.numero || ""}`);
  dialogo.innerHTML = `
    <form method="dialog">
      <span class="dialogo-save-icone" aria-hidden="true">⚠</span>
      <h2 id="excluir-save-titulo">Excluir esta jornada?</h2>
      <p id="excluir-save-descricao"><b>${nome}</b> será removido deste dispositivo. Esta ação não pode ser desfeita.</p>
      <div class="dialogo-save-acoes">
        <button value="cancelar" class="dialogo-save-cancelar" autofocus>Cancelar</button>
        <button value="excluir" class="perigo dialogo-save-confirmar">Excluir definitivamente</button>
      </div>
    </form>`;
  dialogo.addEventListener("keydown", (evento) => {
    const botoes = [...dialogo.querySelectorAll("button")];
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(evento.key)) {
      evento.preventDefault();
      evento.stopPropagation();
      const atual = Math.max(0, botoes.indexOf(document.activeElement));
      const passo = evento.key === "ArrowLeft" || evento.key === "ArrowUp" ? -1 : 1;
      botoes[(atual + passo + botoes.length) % botoes.length]?.focus();
    } else if (evento.key === "Enter" || evento.key === " " || evento.key === "Spacebar") {
      // O botão focado mantém sua ação nativa; só impede o cursor global da
      // tela inicial de acionar algum controle que ficou atrás do diálogo.
      evento.stopPropagation();
    }
  });
  document.body.appendChild(dialogo);
  dialogo.addEventListener("close", () => {
    const deveExcluir = dialogo.returnValue === "excluir";
    dialogo.remove();
    if (deveExcluir) apagarSave(info.numero);
    montarSlotsDeSave({ focarSlot: info.numero });
  }, { once: true });
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else {
    const deveExcluir = window.confirm(`Excluir a jornada de ${info?.nome || "este personagem"}? Esta ação não pode ser desfeita.`);
    dialogo.remove();
    if (deveExcluir) apagarSave(info.numero);
    montarSlotsDeSave({ focarSlot: info.numero });
  }
}

function montarSlotsDeSave({ focarSlot = null } = {}) {
  const raiz = document.getElementById("save-slots");
  if (!raiz) return;
  const ativo = slotAtivo();
  const slots = listarSlots();
  raiz.innerHTML = `
    <div class="slots-cabecalho">
      <div><span class="slots-sobrelinha">Arquivo de jornadas</span><h2 class="slots-titulo">Escolha seu herdeiro</h2></div>
      <span class="slots-ajuda">4 espaços independentes</span>
    </div>
    <div class="slots-grade">${slots.map((s) => {
      const selecionado = s.numero === ativo;
      const estado = s.corrompido ? "indisponível" : s.vazio ? "livre" : "em andamento";
      const data = dataDoSave(s.atualizadoEm);
      const nome = s.corrompido ? "Dados indisponíveis" : s.vazio ? "Nova jornada" : escaparHtml(s.nome);
      const identidade = s.vazio
        ? (s.corrompido ? "Exclua os dados inválidos para reutilizar este espaço." : "Um novo destino aguarda seu personagem.")
        : `Nv. ${s.nivel} · ${rotuloDeId(s.racaId)} · ${rotuloDeId(s.classeId)}`;
      const progresso = s.vazio ? "Sem progresso" : `${s.missoesConcluidas} missões · ${s.areasDescobertas} áreas${s.ngPlus ? ` · NG+${s.ngPlus}` : ""}`;
      const descricao = s.vazio ? identidade : `${identidade}. ${progresso}. Último save: ${data.texto}.`;
      return `
        <article class="save-slot-card ${s.vazio ? "vazio" : "ocupado"}${s.corrompido ? " corrompido" : ""}${selecionado ? " ativo" : ""}" data-slot-card="${s.numero}">
          <button type="button" id="save-slot-${s.numero}" class="save-slot" data-slot="${s.numero}"
            aria-pressed="${selecionado}" aria-label="Slot ${s.numero}: ${escaparHtml(descricao)}">
            <span class="slot-topo"><span class="slot-numero">${s.numero}</span><span class="slot-estado">${estado}</span></span>
            <span class="slot-info">
              <b>${nome}</b>
              <small class="slot-identidade">${identidade}</small>
              <small class="slot-progresso">${progresso}</small>
              ${s.vazio ? "" : `<time datetime="${data.iso}">Salvo em ${data.texto}</time>`}
            </span>
            <span class="slot-chamada">${selecionado ? "✓ Selecionado" : (s.vazio ? "Usar este espaço" : "Selecionar jornada")}</span>
          </button>
          ${s.vazio && !s.corrompido ? "" : `<button type="button" id="apagar-save-slot-${s.numero}" class="slot-apagar" data-apagar="${s.numero}" aria-label="Excluir ${nome} do Slot ${s.numero}"><span aria-hidden="true">⌫</span> Excluir</button>`}
        </article>`;
    }).join("")}</div>
    <p class="slot-instrucao">Use as setas para navegar e Enter para selecionar.</p>`;
  raiz.querySelectorAll(".save-slot").forEach((btn) => btn.onclick = () => {
    selecionarSlot(Number(btn.dataset.slot));
    montarSlotsDeSave({ focarSlot: Number(btn.dataset.slot) });
  });
  raiz.querySelectorAll("[data-apagar]").forEach((btn) => btn.onclick = (ev) => {
    ev.stopPropagation();
    const n = Number(btn.dataset.apagar);
    const info = slots.find((s) => s.numero === n);
    confirmarExclusaoSlot(info);
  });
  const selecionado = slots.find((s) => s.numero === slotAtivo());
  const tem = !!selecionado && !selecionado.vazio && !selecionado.corrompido;
  const continuar = document.getElementById("btn-continuar");
  const novo = document.getElementById("btn-novo-jogo");
  continuar.classList.toggle("hidden", !tem);
  continuar.classList.toggle("primario", tem);
  continuar.textContent = tem ? `Continuar com ${selecionado.nome}` : "Continuar aventura";
  continuar.onclick = () => continuarJogo();
  novo.classList.toggle("primario", !tem);
  novo.classList.toggle("secundario", tem);
  novo.textContent = tem ? `Recomeçar o Slot ${slotAtivo()}` : `Criar personagem no Slot ${slotAtivo()}`;
  novo.onclick = () => {
    if (tem && !window.confirm(`O Slot ${slotAtivo()} já tem uma jornada. Deseja substituí-la por um novo personagem?`)) return;
    iniciarCriacao();
  };
  const ng = document.getElementById("btn-ng-plus");
  ng.classList.add("hidden");
  if (tem) {
    const salvoAtual = carregarJogo();
    if (elegivelParaNgPlus(salvoAtual)) {
      const proximoNivel = (salvoAtual.personagem.ngPlus || 0) + 1;
      ng.textContent = `Nova Jornada+ (NG+${proximoNivel})`;
      ng.classList.remove("hidden");
      ng.onclick = () => iniciarCriacaoNgPlus(salvoAtual);
    }
  }
  configurarNavegacaoBoot();
  if (focarSlot !== null) requestAnimationFrame(() => document.getElementById(`save-slot-${focarSlot}`)?.focus());
}

function configurarNavegacaoBoot() {
  const slots = [...document.querySelectorAll("#save-slots .save-slot")];
  const novo = document.getElementById("btn-novo-jogo");
  const continuar = document.getElementById("btn-continuar");
  const ng = document.getElementById("btn-ng-plus");
  const acessibilidade = document.getElementById("btn-acessibilidade");
  const login = document.querySelector("#painel-login button");
  const principal = continuar && !continuar.classList.contains("hidden") ? continuar : novo;
  const acoes = [novo, continuar, ng].filter((el) => el && !el.classList.contains("hidden"));
  const compacto = window.matchMedia("(max-width: 720px)").matches;

  slots.forEach((slot, indice) => {
    const anterior = compacto && indice % 2 === 0 ? slots[indice + 1] : slots[(indice - 1 + slots.length) % slots.length];
    const proximo = compacto && indice % 2 === 1 ? slots[indice - 1] : slots[(indice + 1) % slots.length];
    slot.dataset.navLeft = `#${anterior.id}`;
    slot.dataset.navRight = `#${proximo.id}`;
    const abaixo = compacto ? slots[indice + 2] : null;
    const excluir = slot.closest(".save-slot-card")?.querySelector(".slot-apagar");
    if (abaixo) slot.dataset.navDown = `#${abaixo.id}`;
    else if (excluir) slot.dataset.navDown = `#${excluir.id}`;
    else if (principal) slot.dataset.navDown = `#${principal.id}`;
    if (compacto && indice >= 2) slot.dataset.navUp = `#${slots[indice - 2].id}`;
    if (excluir) {
      excluir.dataset.navUp = `#${slot.id}`;
      if (principal) excluir.dataset.navDown = `#${principal.id}`;
    }
  });
  acoes.forEach((acao, indice) => {
    const slotSelecionado = slots.find((s) => s.getAttribute("aria-pressed") === "true") || slots[0];
    const excluirSelecionado = slotSelecionado?.closest(".save-slot-card")?.querySelector(".slot-apagar");
    const anterior = acoes[indice - 1] || excluirSelecionado || slotSelecionado;
    const proxima = acoes[indice + 1] || acessibilidade;
    if (anterior) acao.dataset.navUp = `#${anterior.id}`;
    if (proxima) acao.dataset.navDown = `#${proxima.id}`;
  });
  if (acessibilidade) {
    const anterior = acoes.at(-1) || slots[0];
    if (anterior) acessibilidade.dataset.navUp = `#${anterior.id}`;
    if (login) acessibilidade.dataset.navDown = `#${login.id}`;
  }
  if (login) {
    login.dataset.navUp = "#btn-acessibilidade";
    login.dataset.navDown = `#${slots.find((s) => s.getAttribute("aria-pressed") === "true")?.id || slots[0]?.id}`;
  }
}

async function atualizarPainelLogin() {
  usuarioLogado = await usuarioAtual();
  const painel = document.getElementById("painel-login");
  if (usuarioLogado) {
    painel.innerHTML = `
      <p style="font-size:0.85em;color:#c8b89a;">Conectado como <b>${usuarioLogado.nome}</b> — seu progresso é salvo automaticamente na nuvem.</p>
      <button id="btn-sair">Sair da conta</button>
    `;
    document.getElementById("btn-sair").onclick = async () => { await sair(); usuarioLogado = null; atualizarPainelLogin(); };

    const dadosNuvem = await carregarDaNuvem();
    if (dadosNuvem) {
      const btnContinuar = document.getElementById("btn-continuar");
      btnContinuar.classList.remove("hidden");
      btnContinuar.textContent = "Continuar Aventura (nuvem)";
      btnContinuar.onclick = () => continuarDaNuvem(dadosNuvem);
    }
  } else {
    painel.innerHTML = `<button id="btn-google" class="primario">Entrar com Google (salvar na nuvem)</button>`;
    document.getElementById("btn-google").onclick = () => iniciarLoginGoogle();
  }
  configurarNavegacaoBoot();
}

function iniciarCriacao() {
  document.getElementById("screen-boot").classList.add("hidden");
  const tela = document.getElementById("screen-criacao");
  tela.classList.remove("hidden");
  montarCriacaoPersonagem(tela, dados, async (p) => {
    personagem = p;
    personagem.gacha = estadoGachaInicial();
    // Primeira página do Diário de Decisões: de onde o herói vem e o que o
    // move. É a motivação escolhida na criação, registrada onde o jogador
    // relê as próprias escolhas.
    const motivacao = MOTIVACOES_CRIACAO.find((m) => m.id === personagem.motivacaoId);
    const origem = (dados.backgrounds || []).find((b) => b.id === personagem.antecedenteId);
    const povo = ((dados.worldStateVariables && dados.worldStateVariables.facoes) || []).find((f) => f.id === personagem.faccaoOrigemId);
    if (motivacao) {
      registrarDecisao(personagem, {
        icone: motivacao.icone,
        titulo: `O que te move: ${motivacao.nome}`,
        texto: `${origem ? `${origem.nome}` : "Herdeiro"}${povo ? `, gente de ${povo.nome}` : ""}. "${motivacao.descricao}"`,
      });
    }
    tela.classList.add("hidden");
    // O PRÓLOGO roda aqui, entre a criação e o primeiro frame do mundo: é o
    // único momento em que o jogador já tem um personagem (o texto da cena
    // interpola nome/raça/classe) e ainda não tem nada para fazer, então a
    // cena não interrompe nada. A escolha do fim da cena mexe em reputação e
    // flag do próprio `personagem`, que só depois é passado a iniciarMundo()
    // — por isso o await, e por isso esta chamada vem ANTES e não depois.
    //
    // Só em jogo novo: continuarJogo()/continuarDaNuvem() não passam por
    // aqui, então quem carrega um save nunca reassiste ao prólogo.
    await reproduzirCutscene(cutscenePorId("prologo"), personagem, dados);
    iniciarMundo();
    await abrirTutorialInicial(personagem, dados, {
      oferecer: true,
      iniciarEncontro: iniciarPatrulhaTutorial,
      aoEncerrar: () => salvarProgresso({ silencioso: true }),
    });
  });
}

// New Game+ (melhoria de jogabilidade pós-backlog original, ver
// NewGamePlusSystem.js): mesma tela de criação de personagem de uma
// aventura nova — o personagem, nível e mundo reiniciam do zero —, mas ao
// final o roster de invocação (gacha) do save anterior é preservado e o
// contador de NG+ sobe, escalando monstros/recompensas em toda batalha daí
// em diante (ver CombatSystem.js).
function iniciarCriacaoNgPlus(salvoAntigo) {
  document.getElementById("screen-boot").classList.add("hidden");
  const tela = document.getElementById("screen-criacao");
  tela.classList.remove("hidden");
  montarCriacaoPersonagem(tela, dados, (p) => {
    personagem = aplicarNewGamePlus(p, salvoAntigo.personagem);
    tela.classList.add("hidden");
    iniciarMundo();
    mostrarMensagem(`🔥 New Game+${personagem.ngPlus} iniciado! Monstros mais fortes (e valem mais XP/ouro) — seu roster de invocação continua com você.`, 4500);
  });
}

function continuarJogo() {
  const salvo = carregarJogo();
  if (!salvo) return mostrarMensagem("Não foi possível carregar o save.");
  aplicarEstadoSalvo(salvo);
}

function continuarDaNuvem(salvo) {
  aplicarEstadoSalvo(salvo);
}

function aplicarEstadoSalvo(salvo) {
  // migrarSave() (task #97) já roda dentro de carregarJogo() pro caminho
  // local — chamar de novo aqui é barato e idempotente, e é o que garante
  // que um save vindo da NUVEM (continuarDaNuvem(), que nunca passa por
  // carregarJogo()) também recebe todos os campos/migrações antes de
  // qualquer tela usar `personagem`. Substitui os `if (!campo) ...` soltos
  // que existiam aqui antes — ver SaveSystem.js pro pipeline versionado.
  migrarSave(salvo);
  personagem = salvo.personagem;
  mundo.mapaAtual = salvo.mundo.mapaAtual;
  // Semente do mundo (task #34): a migração v2->v3 garante que todo save
  // tenha uma, então normalizarSemente() aqui é cinto de segurança pra um
  // save vindo da nuvem gravado por uma versão antiga do jogo.
  mundo.semente = normalizarSemente(salvo.mundo.semente);
  mundo.player = salvo.mundo.player;
  mundo.chests = salvo.mundo.chests;
  mundo.nodes = salvo.mundo.nodes;
  mundo.zonaAtualId = salvo.mundo.zonaAtualId || "vila";
  // Macro-região atual (task #37): a migração v3->v4 já garantiu que ela
  // bate com a zona, que por sua vez bate com a posição salva.
  mundo.macroAtualId = salvo.mundo.macroAtualId || (macroDaZona(mundo.zonaAtualId) || {}).id || null;
  // Mescla por id em vez de substituir o array inteiro: um save antigo não
  // tem os baús secretos adicionados nas masmorras (ver worldMap.js), então
  // qualquer baú novo que exista na definição atual mas não no save vira um
  // baú fechado adicionado ao array salvo, em vez de simplesmente sumir.
  if (salvo.mundo.chestsDungeon) mundo.chestsDungeon = mesclarBaus(salvo.mundo.chestsDungeon, CHESTS_DUNGEON);
  if (salvo.mundo.chestsDungeon2) mundo.chestsDungeon2 = mesclarBaus(salvo.mundo.chestsDungeon2, CHESTS_DUNGEON2);
  // Mundo habitado (ETAPA 3). A memória dos NPCs, o estado das questlines e
  // os eventos regionais viajam dentro de `personagem` e por isso já vieram
  // no save — o que se faz aqui é validá-los contra o conteúdo atual, para
  // que um NPC ou uma quest removida do jogo não deixe lixo no save de quem
  // continua jogando. O World State regional fica em `mundo` porque é do
  // mundo, não do herdeiro.
  carregarMemoriaDoSave(personagem, salvo.personagem.npcs);
  carregarQuestsRegionaisDoSave(personagem, salvo.personagem.questsRegionais);
  carregarEventosDoSave(personagem, salvo.personagem.eventosRegionais);
  mundo.worldStateRegional = { ...(salvo.mundo.worldStateRegional || {}) };
  cacheNpcs = { periodo: null, semente: null, lista: [] };
  document.getElementById("screen-boot").classList.add("hidden");
  iniciarMundo(true);
  // O mundo mudou de forma debaixo deste save (ETAPA 2): o jogador foi
  // trazido de volta à vila porque a coordenada antiga não aponta mais pro
  // mesmo lugar. Avisar é o mínimo — sem isso ele acha que perdeu progresso.
  if (salvo.mundo && salvo.mundo.mundoRefeito) {
    delete salvo.mundo.mundoRefeito;
    mostrarMensagem("🗺️ Aethra foi remapeada e ficou muito maior. Seu herdeiro voltou à Vila; nível, itens e time continuam intactos.", 7000);
  }
  // As escolhas da criação passaram a ter efeito (elemento, facção de
  // origem). Um herói de antes recebe o pacote uma vez — e fica sabendo.
  const ganhosIdentidade = aplicarIdentidadeRetroativa(personagem, dados);
  if (ganhosIdentidade.length) {
    mostrarMensagem(`✨ Suas escolhas de criação agora pesam no jogo: ${ganhosIdentidade.join(", ")}.`, 6500);
  }
}

function mesclarBaus(salvos, definicaoAtual) {
  const idsExistentes = new Set(salvos.map((c) => c.id));
  const novos = definicaoAtual.filter((c) => !idsExistentes.has(c.id)).map((c) => ({ ...c }));
  return novos.length ? [...salvos, ...novos] : salvos;
}

function estadoAtualParaSalvar() {
  return {
    personagem,
    mundo: {
      mapaAtual: mundo.mapaAtual, semente: mundo.semente, layoutMundo: LAYOUT_MUNDO,
      player: mundo.player, chests: mundo.chests, nodes: mundo.nodes,
      zonaAtualId: mundo.zonaAtualId, macroAtualId: mundo.macroAtualId,
      chestsDungeon: mundo.chestsDungeon, chestsDungeon2: mundo.chestsDungeon2,
      worldStateRegional: mundo.worldStateRegional || {},
    },
  };
}

// Indicador "Salvo às HH:MM" (melhoria de jogabilidade #17): atualizado em
// TODO salvamento bem-sucedido, manual ou automático (silencioso ou não) —
// dá ao jogador uma confirmação visual persistente de que o progresso está
// seguro, sem precisar abrir mensagens toda vez que o auto-save silencioso
// roda (a cada 45s, ver intervaloAutoSave).
function marcarIndicadorSalvo() {
  const el = document.getElementById("hud-salvo");
  if (!el) return;
  const agora = new Date();
  const hh = String(agora.getHours()).padStart(2, "0");
  const mm = String(agora.getMinutes()).padStart(2, "0");
  el.textContent = `💾 Salvo às ${hh}:${mm}`;
  el.classList.remove("hidden");
}

async function salvarProgresso({ silencioso = false } = {}) {
  // Poda antes de gravar: só vão para o disco os NPCs que o jogador de fato
  // conheceu e os passos de quest que saíram do padrão. Sem isso, um save
  // novo carregaria cem fichas vazias de memória e sessenta e cinco quests
  // "indisponível" — dados que o próprio conteúdo já sabe recriar.
  if (personagem) {
    personagem.npcs = memoriaParaSave(personagem);
    personagem.questsRegionais = questsRegionaisParaSave(personagem);
    personagem.eventosRegionais = eventosParaSave(personagem);
  }
  const estado = estadoAtualParaSalvar();
  const okLocal = salvarJogo(estado);
  let msg = okLocal ? "Jogo salvo com sucesso!" : "Falha ao salvar localmente.";
  if (usuarioLogado) {
    const r = await salvarNaNuvem(estado);
    msg = r.ok ? "Jogo salvo (local + nuvem)!" : "Salvo localmente, mas falhou ao sincronizar com a nuvem.";
  }
  if (okLocal) marcarIndicadorSalvo();
  if (!silencioso) mostrarMensagem(msg);
}

// Registro das masmorras do mundo (permite ter mais de uma sem duplicar
// toda a lógica de transição/objetos/encontros).
// Registro das masmorras. O que descreve o INTERIOR (tamanho, pool de
// monstros, chefe, elemento, facção) vem dos dados do mundo
// (src/data/world/settlements.js → MASMORRAS_MUNDO); o que descreve a BOCA
// (`entrance`) é preenchido pelo gerador em iniciarMundo(), porque depende do
// terreno gerado — item 19 do pedido: a entrada tem que estar ligada ao
// território, não largada numa coordenada fixa que pode virar parede.
const MASMORRAS = {
  dungeon1: {
    build: buildDungeon, entrance: { x: 0, y: 0 }, spawn: DUNGEON_SPAWN,
    exitZone: DUNGEON_EXIT_ZONE, chests: CHESTS_DUNGEON, boss: BOSS_TILE,
    gridKey: "gridDungeon", chestsKey: "chestsDungeon", descansoKey: "descansoDungeon",
    monstros: ["esqueleto", "aranha_gigante", "morcego", "rato_gigante"],
    elementoDominante: "sombrio",
    facaoId: "ordem_dos_arquivistas",
  },
  dungeon2: {
    build: buildDungeon2, entrance: { x: 0, y: 0 }, spawn: DUNGEON2_SPAWN,
    exitZone: DUNGEON2_EXIT_ZONE, chests: CHESTS_DUNGEON2, boss: BOSS_TILE2,
    gridKey: "gridDungeon2", chestsKey: "chestsDungeon2", descansoKey: "descansoDungeon2",
    monstros: ["gargula", "wyvern", "senhor_da_cinza", "necromante_errante", "troll_das_cavernas", "golem_de_pedra"],
    elementoDominante: "fogo",
    facaoId: "legiao_das_cinzas",
  },
};

// RECOMPENSA NA HORA.
//
// Percorre as missões ativas e entrega as que já estão prontas, sem exigir a
// volta ao ofertante. Chamada nos dois momentos em que um objetivo pode ser
// cumprido: ao fim de uma batalha (missões de matar) e ao mudar a mochila
// (missões de coletar).
//
// Três cuidados que o torna seguro chamar de qualquer lugar:
//   - `entregandoMissoes` impede reentrada. `entregarMissao` é assíncrona
//     (pode abrir cutscene) e mexe em `missoesAtivas`; sem a trava, um
//     segundo disparo no meio do primeiro entregaria a mesma missão duas
//     vezes, pagando em dobro.
//   - a lista é copiada antes do laço, porque `concluirMissao` remove itens
//     de `missoesAtivas` enquanto iteramos.
//   - entrega UMA por vez e reavalia: concluir uma missão de coletar consome
//     os itens do inventário e pode desfazer a prontidão de outra que pedia
//     o mesmo item.
let entregandoMissoes = false;
async function entregarMissoesProntas() {
  if (entregandoMissoes || !personagem || !dados?.quests) return;
  entregandoMissoes = true;
  try {
    let entregouAlguma = true;
    while (entregouAlguma) {
      entregouAlguma = false;
      for (const ativa of [...(personagem.missoesAtivas || [])]) {
        const def = dados.quests.find((q) => q.id === ativa.id);
        if (!def || !entregaImediata(def)) continue;
        if (!missaoPronta(personagem, def)) continue;
        await entregarMissao(def, personagem, dados, atualizarInterfacePrincipal);
        entregouAlguma = true;
        break;
      }
    }
  } finally {
    entregandoMissoes = false;
  }
}

function destinoDaMissaoRastreada({ paraMapaMundo = false } = {}) {
  if (!personagem || !dados?.quests) return null;
  const rastreada = missaoRastreada(personagem, dados.quests);
  if (!rastreada) return null;
  return destinoDeMissao(rastreada.def, { paraMapaMundo });
}

// Para onde ir por causa de UMA missão. Era interno ao rastreador; virou
// função de missão qualquer porque o modo automático passou a navegar por
// todas as missões ativas, não só pela rastreada (ver
// alvosDasMissoesAutomaticas). A bússola do HUD continua lendo só a
// rastreada, pelo invólucro acima.
function destinoDeMissao(def, { paraMapaMundo = false } = {}) {
  if (!personagem || !def) return null;
  const progresso = progressoDaMissao(personagem, def);

  // MISSÃO DE ENTREGA: o destino é o DESTINATÁRIO desde o primeiro passo —
  // o pacote já está na mochila quando a missão começa, então não existe
  // "fase de objetivo" separada da "fase de entrega".
  if (def.tipo === "entregar" && def.npcDestino) {
    const destinatario = npcsPosicionados().find((n) => n.id === def.npcDestino);
    if (destinatario) {
      return {
        id: def.id, x: destinatario.x, y: destinatario.y, mapa: "overworld",
        nome: `Entregar: ${def.nome}`, texto: textoObjetivoMissao(def), pronto: progresso.pronto,
      };
    }
    return null;
  }

  // Objetivo cumprido: a direção correta deixa de ser a área da tarefa e
  // passa a ser quem recebe a entrega.
  if (progresso.pronto) {
    if (!paraMapaMundo && mundo.mapaAtual !== "overworld") {
      const saida = MASMORRAS[mundo.mapaAtual]?.exitZone;
      if (saida) return { id: def.id, x: saida.x0, y: saida.y0, mapa: mundo.mapaAtual, nome: "Voltar para entregar", texto: "Saia da masmorra e volte ao responsável.", pronto: true };
    }
    const npc = npcsPosicionados().find((n) => n.id === def.npcId);
    if (npc) return { id: def.id, x: npc.x, y: npc.y, mapa: "overworld", nome: `Entregar: ${def.nome}`, texto: "Volte ao responsável pela missão.", pronto: true };
  }

  const mapaAlvo = def.mapaAlvo || "overworld";
  if (paraMapaMundo && mapaAlvo !== "overworld") {
    const entrada = MASMORRAS[mapaAlvo]?.entrance;
    return entrada ? { id: def.id, ...entrada, mapa: "overworld", nome: def.nome, texto: textoObjetivoMissao(def) } : null;
  }
  if (mundo.mapaAtual !== mapaAlvo) {
    if (mundo.mapaAtual !== "overworld") {
      const saida = MASMORRAS[mundo.mapaAtual]?.exitZone;
      return saida ? { id: def.id, x: saida.x0, y: saida.y0, mapa: mundo.mapaAtual, nome: "Voltar à superfície", texto: textoObjetivoMissao(def) } : null;
    }
    const entrada = MASMORRAS[mapaAlvo]?.entrance;
    if (entrada) return { id: def.id, ...entrada, mapa: "overworld", nome: def.nome, texto: textoObjetivoMissao(def) };
  }
  if (mapaAlvo !== "overworld") {
    const m = MASMORRAS[mapaAlvo];
    const alvo = def.tipo === "matar" ? m?.boss : m?.exitZone;
    return alvo ? { id: def.id, x: alvo.x ?? alvo.x0, y: alvo.y ?? alvo.y0, mapa: mapaAlvo, nome: def.nome, texto: textoObjetivoMissao(def) } : null;
  }

  const zonaId = def.zonaAlvo || def.regiao;
  const no = def.tipo === "coletar" ? mundo.nodes.find((n) => n.disponivel && n.zonaId === zonaId) : null;
  const chefe = def.tipo === "matar" ? mundo.gerado?.chefes?.find((c) => c.zonaId === zonaId && c.monstroId === def.alvo) : null;
  const zona = zonaPorId(zonaId);
  // CAÇAR NÃO É CHEGAR NUM LUGAR.
  //
  // O DEFEITO, MEDIDO: com o automático ligado numa partida nova, o herói
  // visitou 11 tiles em 45 segundos e terminou no nível 1. O motivo é este
  // trecho: uma missão de MATAR virava "o centro da zona", e o herói já
  // começa dentro da zona da primeira missão. Destino a distância zero =
  // chegou = nada mais a fazer, e o automático caía no andar aleatório, que
  // orbita meia dúzia de casas.
  //
  // Mas encontro aleatório é sorteado POR PASSO DADO (EncounterSystem). Para
  // matar dois ratos é preciso ATRAVESSAR a zona, não parar no meio dela.
  //
  // Então, quando o objetivo ainda não está cumprido e o herói já está na
  // zona certa, o destino passa a ser a borda OPOSTA à posição dele. Ao
  // chegar lá, o lado oposto inverte sozinho e o herói volta varrendo — uma
  // patrulha de vaivém, sem sorteio novo e sem estado a guardar.
  if (!no && !chefe && zona && def.tipo === "matar" && !progresso.pronto) {
    const patrulha = pontoDePatrulha(zona);
    if (patrulha) {
      return {
        id: def.id, x: patrulha.x, y: patrulha.y, mapa: "overworld",
        nome: def.nome, texto: textoObjetivoMissao(def), patrulhando: true,
      };
    }
  }
  const alvo = no || chefe || (zona ? pontoDeChegada(zona) : null);
  // `chegadaSimples` marca o destino que é só "o ponto de chegada da zona":
  // não há nó de recurso, não há chefe, não há patrulha. Para a BÚSSOLA isso
  // continua sendo a melhor resposta possível ("é por ali"). Para a IA do
  // automático, não é: chegar lá não muda nada, e um destino que não muda
  // nada a distância zero trava a lista de alvos para sempre (ver
  // `alvoDeUmaMissaoAutomatica`). A flag deixa os dois lados lerem o mesmo
  // destino com expectativas diferentes.
  return alvo ? { id: def.id, x: alvo.x, y: alvo.y, mapa: "overworld", nome: def.nome,
    texto: textoObjetivoMissao(def), chegadaSimples: !no && !chefe } : null;
}

// O ponto de patrulha: o canto da zona mais LONGE do herói, recuado da borda
// para não escolher um tile de fronteira que pode estar em água ou em rocha.
//
// Só vale quando o herói já está dentro da zona. Fora dela, o destino
// continua sendo o ponto de chegada — ir até lá já é o trabalho.
const RECUO_PATRULHA = 3;
function pontoDePatrulha(zona) {
  if (zona.x0 == null || zona.x1 == null) return null;
  const { x, y } = mundo.player;
  const dentro = x >= zona.x0 && x <= zona.x1 && y >= zona.y0 && y <= zona.y1;
  if (!dentro) return null;
  const larg = zona.x1 - zona.x0; const alt = zona.y1 - zona.y0;
  // Zona pequena demais não comporta patrulha: o vaivém viraria tremor.
  if (larg < RECUO_PATRULHA * 3 || alt < RECUO_PATRULHA * 3) return null;
  const meioX = (zona.x0 + zona.x1) / 2; const meioY = (zona.y0 + zona.y1) / 2;
  return {
    x: x <= meioX ? zona.x1 - RECUO_PATRULHA : zona.x0 + RECUO_PATRULHA,
    y: y <= meioY ? zona.y1 - RECUO_PATRULHA : zona.y0 + RECUO_PATRULHA,
  };
}

function atualizarGuiaMissao() {
  let guia = document.getElementById("guia-missao");
  const destino = destinoDaMissaoRastreada();
  if (!destino || destino.id === 'tutorial_companhia' || destino.mapa !== mundo.mapaAtual || !personagem) {
    if (guia) guia.classList.add("hidden");
    return;
  }
  if (!guia) {
    guia = document.createElement("button");
    guia.id = "guia-missao";
    guia.type = "button";
    guia.title = "Abrir missões (M)";
    guia.onclick = () => onHudAction("missoes");
    document.getElementById("app").appendChild(guia);
  }
  const dx = destino.x - mundo.player.x, dy = destino.y - mundo.player.y;
  const seta = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "→" : "←") : (dy > 0 ? "↓" : "↑");
  const distancia = Math.round(Math.hypot(dx, dy));
  const chave = `${destino.id}:${seta}:${distancia}:${destino.pronto ? 1 : 0}`;
  if (guia.dataset.chave !== chave) {
    guia.innerHTML = `<span class="guia-seta">${seta}</span><span><b>${destino.nome}</b><small>${destino.pronto ? "Entregar" : `${distancia} passos`}</small></span>`;
    guia.dataset.chave = chave;
  }
  guia.classList.remove("hidden");
}

// Elemento dominante do terreno onde o jogador está agora (zona do overworld
// ou masmorra atual) — usado para o bônus/resistência de terreno no combate
// (task #42). `null` quando a zona não define elemento (ex.: vila, segura).
function terrenoElementoAtual() {
  if (mundo.mapaAtual === "overworld") {
    const zona = zonaNoPonto(mundo.player.x, mundo.player.y);
    return zona ? zona.elementoDominante || null : null;
  }
  const masmorra = MASMORRAS[mundo.mapaAtual];
  return masmorra ? masmorra.elementoDominante || null : null;
}

// Facção regional dona da zona/masmorra onde o jogador está agora (task
// #44) — usada pra dar reputação regional (além da vila) ao derrotar um
// chefe, e pra futura UI mostrar "você está em território de X".
function facaoAtual() {
  if (mundo.mapaAtual === "overworld") {
    const zona = zonaNoPonto(mundo.player.x, mundo.player.y);
    return zona ? facaoDaZona(zona.id, dados.worldStateVariables) : null;
  }
  const masmorra = MASMORRAS[mundo.mapaAtual];
  return masmorra ? masmorra.facaoId || null : null;
}

// Clima atual da zona onde o jogador está (melhoria pós-backlog original,
// ver WeatherSystem.js) — só existe no mundo aberto, fora da vila (segura,
// sem eventos de clima, igual ela já é sem elementoDominante de terreno).
// Retorna o objeto do clima inteiro (id/nome/icone/elementoBonus), não só o
// elemento, pra dar pra UI mostrar nome/ícone sem recalcular nada.
function climaAtual() {
  if (mundo.mapaAtual !== "overworld") return null;
  const zona = zonaNoPonto(mundo.player.x, mundo.player.y);
  if (!zona || zona.id === "vila") return null;
  return climaAtualDaZona(zona.id, Date.now(), altitudeNoPonto(mundo.player.x, mundo.player.y));
}

function altitudeNoPonto(x, y) {
  return mundo.gerado?.alturas?.[Math.floor(y) * OVERWORLD_W + Math.floor(x)] || 0;
}

// Faixa de lugar e ambiente da HUD — chamada ao entrar/trocar de zona e
// periodicamente (o clima muda sozinho com o relógio real, mesmo com o
// jogador parado).
//
// Com a hierarquia (task #35) ela deixou de ser só clima e passou a
// responder "onde eu estou", no formato macro-região › zona:
//
//   Costa da Maré › Costa da Aurora · 🌧️ Chuva · ☀️ Dia
//
// A macro-região só aparece quando ela existe no atlas do mapa-múndi; para
// as sete zonas cuja macro é derivada da própria zona (ver
// worldHierarchy.js), repetir o nome duas vezes não informaria nada. Na
// vila e dentro das masmorras não há clima, mas o lugar aparece do mesmo
// jeito — antes desta task a faixa ficava simplesmente vazia lá.
function atualizarIndicadorClima() {
  const el = document.getElementById("hud-clima");
  if (!el) return;
  const partes = [];
  if (mundo.mapaAtual === "overworld") {
    const zona = zonaNoPonto(mundo.player.x, mundo.player.y);
    if (zona) {
      const macro = macroDaZona(zona.id);
      partes.push(macro && !macro.derivado ? `${macro.nome} › ${zona.nome}` : zona.nome);
    }
  } else {
    const interior = INTERIORES.find((i) => i.id === mundo.mapaAtual);
    if (interior) {
      // BUG ANTIGO, achado pelo teste da masmorra: aqui lia
      // `interior.entrada.x`, mas INTERIORES não tem `entrada` — a
      // coordenada da boca foi tirada de lá de propósito (ver o comentário
      // em worldHierarchy.js) e sobrou `boca`, que é TEXTO descritivo.
      // Resultado: toda vez que o jogador estava dentro de uma masmorra,
      // este trecho lançava TypeError — inclusive no timer de 15s do clima —
      // e a barra de localização nunca mostrava o nome da masmorra.
      // A zona vem direto de `zonaId`, que é o dado certo e sempre existe.
      const zonaEntrada = zonaPorId(interior.zonaId);
      partes.push(zonaEntrada ? `${zonaEntrada.nome} › ${interior.nome}` : interior.nome);
    }
  }
  const clima = climaAtual();
  if (clima) partes.push(`${clima.icone} ${clima.nome}`);
  const hora = horaDoDiaAtual(Date.now());
  partes.push(`${hora.icone} ${hora.nome} ${hora.rotulo}`);
  el.textContent = partes.join(" · ");

  // EVENTO REGIONAL NA ZONA ATUAL.
  //
  // O evento já gritava uma vez, no instante em que abria (o `mostrarMensagem`
  // com o `aviso`, em reavaliarMundoVivo). Depois disso ele sumia da tela e
  // continuava valendo por horas de jogo: a loja seguia 35% mais cara, a caça
  // seguia fora da mata, e o jogador não tinha como saber que aquilo ainda
  // estava em vigor — nem a que atribuí-lo. Este selo é a permanência que
  // faltava, e some sozinho quando o evento encerra.
  const evs = personagem ? resumoDosEventos(personagem, mundo.zonaAtualId).filter((e) => e.aqui) : [];
  let selo = document.getElementById("hud-evento");
  if (!evs.length) { if (selo) selo.remove(); return; }
  if (!selo) {
    selo = document.createElement("div");
    selo.id = "hud-evento";
    selo.className = "hud-evento";
    // Abre o painel "Como você está", que é onde a lista completa mora — em
    // vez de inventar uma tela nova para três linhas de texto.
    selo.onclick = () => abrirPainelEstado();
    el.parentElement.appendChild(selo);
  }
  selo.textContent = evs.length === 1 ? `⚠ ${evs[0].nome}` : `⚠ ${evs.length} eventos aqui`;
  selo.title = evs.map((e) => `${e.nome} — ${e.aviso}${e.efeitos.length ? `\n   ${e.efeitos.join(" · ")}` : ""}`).join("\n\n")
    + "\n\nClique (ou tecla K) para ver tudo.";
}

// Semente escolhida pelo jogador na URL: index.html?semente=XVZ66N (o código
// que HDA_MUNDO() mostra) ou ?semente=floresta bonita — qualquer texto vale,
// vira semente por hash. Só vale pra JOGO NOVO: um save carregado traz a
// semente dele e ninguém troca o mundo de alguém pelo meio.
//
// Existe por dois motivos, os dois consequência direta do mundo virar função
// da semente: dá pra combinar um mundo com outra pessoa passando um link, e
// dá pra escrever teste que depende do mapa sem ficar na mão da sorte.
function sementeDaURL() {
  try {
    const bruto = new URLSearchParams(window.location.search).get("semente");
    return bruto ? lerSemente(bruto) : null;
  } catch (e) {
    return null;
  }
}

// Baús do mundo aberto que ESTE herói enxerga. Os comuns valem para todos;
// os escondidos só aparecem para o Elfo — é o traço racial "Olhos da
// Floresta" (ver bausEscondidosDoMundo em WorldBuilder.js). Um save de elfo
// guarda os escondidos abertos pelo id, igual aos comuns.
function bausDoMundoParaHeroi() {
  const comuns = mundo.gerado.baus || [];
  if (!personagem || personagem.racaId !== "elfo") return comuns;
  return [...comuns, ...bausEscondidosDoMundo(mundo.gerado, mundo.semente)];
}

function iniciarMundo(jaCarregado = false) {
  // A semente precisa existir ANTES de construir qualquer grade. Jogo novo
  // sorteia uma (único Math.random() de mundo que sobrou, e ele roda uma vez
  // na vida do save); um save carregado já trouxe a dele por
  // aplicarEstadoSalvo(), e um save de antes desta task recebeu
  // SEMENTE_LEGADO na migração.
  if (!mundo.semente) mundo.semente = jaCarregado ? normalizarSemente(null) : (sementeDaURL() || novaSemente());
  // O MUNDO INTEIRO de uma vez: grade, assentamentos, estradas, pontes, rios,
  // POIs, landmarks, bocas de masmorra, baús, nós, chefes e vagas de NPC.
  mundo.gerado = mundoDaSemente(mundo.semente);
  mundo.grid = mundo.gerado.grid;
  if (jaCarregado) {
    // Objetos persistem pelo id, nunca pela coordenada de uma malha antiga.
    const bausSalvos = new Map((mundo.chests || []).map((c) => [c.id, c]));
    const nosSalvos = new Map((mundo.nodes || []).map((n) => [n.id, n]));
    mundo.chests = bausDoMundoParaHeroi().map((c) => ({ ...c, aberto: !!bausSalvos.get(c.id)?.aberto }));
    mundo.nodes = mundo.gerado.nos.map((n) => ({ ...n, disponivel: nosSalvos.get(n.id)?.disponivel ?? true }));
  }
  // Arte das construções (casa, templo). Vem do mundo gerado, não do save: é
  // função da semente, igual à grade. Nenhum save antigo precisa migrar — quem
  // carregar uma partida velha recebe os prédios junto com o mesmo mapa que
  // já tinha, porque a semente é a mesma.
  mundo.props = mundo.gerado.props || [];
  mundo.gridDungeon = buildDungeon(mundo.semente);
  mundo.gridDungeon2 = buildDungeon2(mundo.semente);
  // Bocas de masmorra escolhidas no terreno gerado.
  mundo.gerado.masmorras.forEach((m) => {
    if (MASMORRAS[m.id]) MASMORRAS[m.id].entrance = { ...m.entrada };
  });
  if (!jaCarregado) {
    mundo.mapaAtual = "overworld";
    mundo.player = { ...mundo.gerado.spawn, dir: "baixo", frame: 0, ultimoMovimento: 0 };
    mundo.chests = bausDoMundoParaHeroi().map((c) => ({ ...c }));
    mundo.nodes = mundo.gerado.nos.map((n) => ({ ...n }));
    mundo.zonaAtualId = "vila";
  } else if (mundo.mapaAtual === "masmorra") {
    mundo.mapaAtual = "dungeon1"; // migração de saves antigos (uma só masmorra)
  }
  // Fogueiras (pontos de descanso): calculadas da grade recém-construída,
  // nunca salvas — o mapa é regerado a cada carregamento, então salvar
  // coordenada seria salvar um ponto que pode virar parede no boot seguinte.
  // Ver RestSystem.js.
  gerarTodosPontosDescanso();
  // Índice espacial dos objetos (task #36) — depende das grades e das
  // fogueiras, então vem depois das duas.
  construirIndicesDeChunk();

  if (jaCarregado) reposicionarSePresoEmParede();
  document.getElementById("hud").classList.remove("hidden");
  // Minimapa: montado uma vez por sessão (a função sai cedo se já existir) e
  // atualizado dentro de loopRender. Vem depois do HUD ficar visível porque
  // se ancora na altura da faixa de status.
  montarMinimapa(contextoDoMinimapa, abrirMapaMundo);
  // Cartões: a casca é montada uma vez; o que aparece nela é decidido pelos
  // gatilhos. `onAcao` existe para o HUD refletir na hora o que o botão do
  // cartão fez (equipar muda HP/defesa).
  iniciarCartoes({
    personagem, dados,
    onAcao: ({ retorno }) => { atualizarInterfacePrincipal(); if (retorno) mostrarMensagem(retorno, 3200); },
  });
  // Depois da animação de nível, os gatilhos de "o que abriu com isso".
  registrarAoSubirNivel((novoNivel, nivelAnterior) => verificarCartoes("nivel", 250, { nivelAnterior }));
  // Agora que HUD, barra de navegação e controles existem na tela, o
  // enquadramento é recalculado com os tamanhos reais deles.
  if (ajustarViewport) ajustarViewport();
  atualizarInterfacePrincipal();
  requestAnimationFrame(loopRender);

  if (!jaCarregado) {
    mostrarMensagem("🧭 Sua primeira missão é reunir uma companhia e proteger os arredores.", 4200);
  }

  if (intervaloAutoSave) clearInterval(intervaloAutoSave);
  if (jaCarregado && personagem.tutorialMissao?.status === 'em_andamento') {
    abrirTutorialInicial(personagem, dados, { iniciarEncontro: iniciarPatrulhaTutorial, aoEncerrar: () => salvarProgresso({ silencioso: true }) });
  }
  if (usuarioLogado) {
    intervaloAutoSave = setInterval(() => salvarProgresso({ silencioso: true }), 45000);
  }

  // Clima/hora do dia (melhoria pós-backlog original): muda sozinho com o
  // relógio real, então precisa de um refresh periódico além dos gatilhos
  // por movimento (verificarMudancaDeZona) — senão ficaria preso no clima de
  // quando o jogador entrou na zona, mesmo minutos depois.
  atualizarIndicadorClima();
  if (intervaloClima) clearInterval(intervaloClima);
  intervaloClima = setInterval(() => { atualizarIndicadorClima(); reavaliarMundoVivo(); }, 15000);
  // Relógio do pet: ele age sozinho a cada poucos segundos, não a cada
  // quadro. Um pet que agisse por quadro limparia a clareira antes de o
  // jogador chegar nela — o companheiro tem de trabalhar À VISTA, senão o
  // jogo só mostra um número subindo.
  if (intervaloPet) clearInterval(intervaloPet);
  intervaloPet = setInterval(tickDoPet, INTERVALO_ACAO_MS);
}

// O PET AGINDO NO MAPA.
//
// Quem decide o que ele alcança é o PetSystem (função pura, testável). Quem
// EXECUTA é aqui, chamando abrirBau/coletarNo — as mesmas funções da tecla E.
// É a razão de aquelas duas terem saído de dentro de interagir().
function tickDoPet() {
  if (!personagem || !mundo || !dados || !dados.pets) return;
  if (document.body.classList.contains("com-tutorial")) return;
  if (mundo.emBatalha || document.getElementById("screen-batalha")?.classList.contains("hidden") === false) return;
  const def = petAtivo(personagem, dados.pets);
  if (!def) return;
  const indice = indiceAtivo();
  if (!indice) return;

  const estado = garantirEstadoDePets(personagem);
  if (!Array.isArray(estado.revelados)) estado.revelados = [];
  const jaRevelados = new Set(estado.revelados);
  const fontes = objetosPerto(indice, mundo.player.x, mundo.player.y);
  const alvos = alvosDoPet(def, mundo.player, fontes, jaRevelados);

  for (const f of alvos.coletar) {
    if (f.tipo === "bau") abrirBau(f, def.nome);
    else if (f.tipo === "no") coletarNo(f, def.nome);
  }
  for (const r of alvos.revelar) {
    estado.revelados.push(r.id);
    const nome = (r.fonte.ref && (r.fonte.ref.nome || r.fonte.ref.monstroId)) || r.fonte.tipo;
    const passos = Math.max(Math.abs(r.fonte.x - mundo.player.x), Math.abs(r.fonte.y - mundo.player.y));
    mostrarMensagem(`🐾 ${def.nome} farejou: ${nome} — ${passos} passos ao ${rumoAte(mundo.player, r.fonte)}.`, 3600);
  }
}

// Salvaguarda de migração: como as masmorras são reconstruídas do zero a
// cada carregamento (o layout do labirinto nunca é salvo, só o mapa atual e
// a posição), um save antigo pode ter o jogador parado exatamente onde
// agora existe uma parede do novo labirinto ramificado. Detecta isso e
// reposiciona no ponto de spawn do mapa atual, em vez de deixar o jogador
// preso.
function reposicionarSePresoEmParede() {
  const grid = gridAtiva();
  const p = mundo.player;
  if (!grid || !p || !grid[p.y] || grid[p.y][p.x] === undefined) return;
  if (!SOLID_TILES.has(grid[p.y][p.x])) return;
  const spawn = mundo.mapaAtual === "overworld"
    ? (mundo.gerado ? mundo.gerado.spawn : OVERWORLD_SPAWN)
    : (MASMORRAS[mundo.mapaAtual] ? MASMORRAS[mundo.mapaAtual].spawn : OVERWORLD_SPAWN);
  mundo.player.x = spawn.x;
  mundo.player.y = spawn.y;
  marcarTeleporteVisual();
}

// Uma fogueira por região perigosa do mundo aberto e uma por masmorra. As
// cidades ficam de fora de propósito: elas já são ponto de descanso
// inteiras (ver ehZonaDeDescanso em RestSystem.js).
function gerarTodosPontosDescanso() {
  const bloqueadoEm = (grid) => (x, y) => !grid[y] || grid[y][x] === undefined || SOLID_TILES.has(grid[y][x]);
  mundo.pontosDescanso = gerarPontosDescanso(ZONAS, OVERWORLD_W, OVERWORLD_H, bloqueadoEm(mundo.grid));
  Object.entries(MASMORRAS).forEach(([id, m]) => {
    const grid = mundo[m.gridKey];
    if (!grid) return;
    const ponto = gerarPontoDescansoMasmorra(
      id, m.spawn, grid[0].length, grid.length, bloqueadoEm(grid),
      [...m.chests.map(({ x, y }) => ({ x, y })), m.boss, { x: m.exitZone.x0, y: m.exitZone.y0 }]
    );
    mundo[m.descansoKey] = ponto ? [ponto] : [];
  });
}

// Pontos de descanso do mapa em que o jogador está agora.
function pontosDescansoAtuais() {
  if (mundo.mapaAtual === "overworld") return mundo.pontosDescanso || [];
  const m = MASMORRAS[mundo.mapaAtual];
  return (m && mundo[m.descansoKey]) || [];
}

function gridAtiva() {
  if (mundo.mapaAtual === "overworld") return mundo.grid;
  const masmorra = MASMORRAS[mundo.mapaAtual];
  return masmorra ? mundo[masmorra.gridKey] : mundo.grid;
}

function alturasAtivas() {
  return mundo.mapaAtual === "overworld" ? (mundo.gerado?.alturas || null) : null;
}

// Props POSICIONADOS À MÃO no mapa atual (casas de uma cidade, ponte, poste).
// São diferentes dos props derivados do tile (árvore, rocha), que o
// propRegistry sorteia sozinho a partir do grid — estes são colocados por
// quem monta o mapa. Masmorra não tem: o interior é desenhado só por tiles.
function propsAtivos() {
  if (mundo.mapaAtual !== "overworld") return [];
  return mundo.props || [];
}

// Tema visual da região onde o jogador está: muda a MISTURA de árvores sem
// trocar um tile sequer (mata fechada em Altaverde, pinheiro em Morranvell).
// Ver TEMAS em propRegistry.js.
function temaAtivo() {
  if (mundo.mapaAtual !== "overworld") return null;
  const zona = zonaNoPonto(mundo.player.x, mundo.player.y);
  return (zona && zona.tema) || null;
}

// Tempo que um chefe some do mapa depois de derrotado, antes de "renascer"
// no mesmo ponto — evita que o modo automático entre direto de novo na
// mesma batalha assim que vence (bug reportado: chefe reengajava sem pausa).
const RESPAWN_CHEFE_MS = 30000;
function chefeDisponivel(ref) {
  return !ref.derrotadoEm || (Date.now() - ref.derrotadoEm) >= RESPAWN_CHEFE_MS;
}

// CHEFE DE MASMORRA NÃO SEGUE O RELÓGIO DE CHEFE DE CAMPO.
//
// Bug medido no teste da masmorra: `RESPAWN_CHEFE_MS` é 30 segundos, e uma
// incursão completa (matar o chefe e achar os dois baús no labirinto) leva
// mais que isso. O chefe voltava a contar como VIVO enquanto o jogador ainda
// estava lá dentro, e a masmorra nunca fechava — era uma corrida contra um
// cronômetro que não devia estar correndo.
//
// A regra certa: dentro de uma incursão, chefe derrotado fica derrotado. Ele
// só volta quando a masmorra sai da espera e uma incursão NOVA começa (ver
// prepararIncursao, chamada na entrada).
function chefeDaMasmorraDisponivel(m) {
  return !m.boss.derrotadoEm;
}

// Uma incursão nova começa do zero: baús fechados e chefe de pé. Chamada só
// quando a masmorra já saiu da espera — é o que faz "voltar depois" valer a
// pena em vez de encontrar um lugar vazio.
function prepararIncursao(id, m) {
  if (masmorraEmEspera(mundo, id)) return;
  const limpas = garantirEstadoMasmorras(mundo);
  if (!limpas[id]) return;          // nunca foi concluída: nada a reiniciar
  delete limpas[id];
  m.boss.derrotadoEm = null;
  mundo[m.chestsKey] = m.chests.map((c) => ({ ...c, aberto: false }));
  construirIndicesDeChunk();
}

// --- ÍNDICE DE OBJETOS POR CHUNK (task #36) -------------------------------
//
// Antes desta task, objetosAtivos() era chamada a cada quadro e reconstruía
// a lista do mundo inteiro do zero — inclusive um `dados.monsters.find()`
// por chefe de zona (21 chefes x ~50 monstros = mais de mil comparações),
// sessenta vezes por segundo, pra desenhar os cinco ou seis objetos que
// cabem na tela.
//
// Agora cada mapa tem um índice espacial construído UMA VEZ (ver
// ChunkSystem.js). O índice guarda REFERÊNCIAS aos objetos do jogo, nunca
// cópias: o baú aberto continua sendo o mesmo objeto indexado, então nada
// fica desatualizado e não existe invalidação pra esquecer. O que muda a
// cada quadro é só a leitura do estado (aberto / disponível / chefe em
// descanso), e só dos objetos dos chunks ao redor do jogador.
//
// `camada` existe pra preservar a ordem de desenho que a versão antiga
// tinha de graça pela ordem dos pushes: fogueira é cenário e vai por baixo
// de baú e chefe quando dois caem no mesmo tile.
const CAMADA_CENARIO = 0;
const CAMADA_OBJETO = 1;

function garantirBausMasmorra(masmorra) {
  if (!mundo[masmorra.chestsKey]) mundo[masmorra.chestsKey] = masmorra.chests.map((c) => ({ ...c }));
  return mundo[masmorra.chestsKey];
}

// Sprite do chefe resolvido UMA vez, na indexação, em vez de a cada quadro.
function spriteDoChefe(monstroId) {
  const m = dados.monsters.find((mm) => mm.id === monstroId);
  return m ? m.sprite : "mob_dragao_jovem";
}

function fontesDoMapa(mapaId) {
  const fontes = [];
  const descanso = mapaId === "overworld"
    ? (mundo.pontosDescanso || [])
    : (MASMORRAS[mapaId] ? (mundo[MASMORRAS[mapaId].descansoKey] || []) : []);
  descanso.forEach((f) => fontes.push({ x: f.x, y: f.y, tipo: "descanso", ref: f, imgKey: "fogueira", camada: CAMADA_CENARIO }));

  if (mapaId === "overworld") {
    mundo.chests.forEach((c) => fontes.push({ x: c.x, y: c.y, tipo: "bau", ref: c, camada: CAMADA_OBJETO }));
    mundo.nodes.forEach((n) => fontes.push({ x: n.x, y: n.y, tipo: "no", ref: n, camada: CAMADA_OBJETO }));
    Object.values(MASMORRAS).forEach((m) => fontes.push({
      x: m.entrance.x, y: m.entrance.y, tipo: "entrada", ref: m.entrance, imgKey: "entrada_masmorra", camada: CAMADA_OBJETO,
    }));
    // Chefe obrigatório de cada zona (task #45): ponto fixo dentro da zona,
    // sempre lá, sem sorteio. Some do mapa por RESPAWN_CHEFE_MS depois de
    // derrotado — mas continua indexado, porque some por ESTADO e não por
    // posição, e volta sozinho quando o tempo passa.
    (mundo.gerado ? mundo.gerado.chefes : []).forEach((c) => {
      fontes.push({ x: c.x, y: c.y, tipo: "chefe", ref: c, imgKey: spriteDoChefe(c.monstroId), camada: CAMADA_OBJETO });
    });
    // NPCs no lugar em que a ficha deles diz que estão AGORA (ETAPA 3).
    //
    // Antes, os cinco NPCs eram encaixados nas dez vagas que o gerador abre ao
    // redor da praça da vila, na ordem do array — o campo `regiao` da ficha
    // era decorativo. Com cem NPCs isso empilharia o mundo inteiro numa praça
    // só. Agora quem decide é a rotina de cada um (ver NpcPlacement.js), e a
    // lista é recalculada quando o período do dia vira, não a cada quadro.
    npcsPosicionados().forEach((n) => {
      fontes.push({ x: n.x, y: n.y, tipo: "npc", ref: n, camada: CAMADA_OBJETO });
    });
    // POIs, landmarks e assentamentos do mundo gerado (ETAPA 2): entram no
    // índice como qualquer outro objeto, então já ganham de graça o
    // carregamento por chunk e o desenho por proximidade.
    (mundo.gerado ? mundo.gerado.pois : []).forEach((p) => fontes.push({
      x: p.x, y: p.y, tipo: "poi", ref: p, imgKey: "npc_marker", camada: CAMADA_OBJETO,
    }));
    (mundo.gerado ? mundo.gerado.landmarks : []).forEach((l) => fontes.push({
      x: l.x, y: l.y, tipo: "landmark", ref: l, imgKey: "npc_marker", camada: CAMADA_CENARIO,
    }));
  } else {
    const masmorra = MASMORRAS[mapaId];
    if (masmorra) {
      garantirBausMasmorra(masmorra).forEach((c) => fontes.push({ x: c.x, y: c.y, tipo: "bau", ref: c, camada: CAMADA_OBJETO }));
      fontes.push({
        x: masmorra.boss.x, y: masmorra.boss.y, tipo: "chefe", ref: masmorra.boss,
        imgKey: spriteDoChefe(masmorra.boss.monstroId), camada: CAMADA_OBJETO,
      });
      // A saída da masmorra sempre funcionou, mas era um tile 1x1 sem marca
      // visual no meio do labirinto — indistinguível de "não ter saída".
      // Reaproveita o sprite da entrada (mesma ideia de portal, os dois
      // sentidos) e é interagível com E, além do botão do HUD.
      fontes.push({
        x: masmorra.exitZone.x0, y: masmorra.exitZone.y0, tipo: "saida", ref: masmorra,
        imgKey: "entrada_masmorra", camada: CAMADA_OBJETO,
      });
    }
  }
  return fontes;
}

// --- NPCs do mundo habitado (ETAPA 3) --------------------------------------
// A lista de NPCs posicionados é CACHEADA por período do dia. Recalcular os
// cem a cada quadro seria caro e inútil: nada na rotina muda dentro de um
// período. Quando o período vira (a cada 4 minutos reais, pelo WeatherSystem),
// `npcsPosicionados()` percebe sozinho e refaz — e como as posições entram no
// índice de chunks, refazer também exige reindexar o mundo aberto.
let cacheNpcs = { periodo: null, semente: null, lista: [] };

function contextoDeNpc() {
  return {
    personagem,
    agora: Date.now(),
    zonaId: mundo.zonaAtualId,
    worldState: (mundo.worldStateRegional = mundo.worldStateRegional || {}),
    eventosAtivos: personagem ? listarEventosAtivos(personagem) : [],
    regiaoAtual: mundo.macroAtualId,
    dadosWorldState: dados.worldStateVariables,
    visitados: (personagem && personagem.biomaVisitados) || [],
    time: personagem ? [personagem, ...membrosDoTime(personagem)] : [],
  };
}

function npcsPosicionados() {
  if (!mundo.gerado) return [];
  const periodo = horaDoDiaAtual(Date.now()).id;
  const chave = `${periodo}:${mundo.semente}:${(personagem && Object.keys(personagem.questsRegionais || {}).length) || 0}`;
  if (cacheNpcs.periodo === chave) return cacheNpcs.lista;
  const { npcs, ambientes = [], semLugar } = posicionarNpcs(mundo.gerado, contextoDeNpc());
  if (semLugar.length) console.warn("NPCs sem lugar no mapa:", semLugar);
  cacheNpcs = { periodo: chave, semente: mundo.semente, lista: [...npcs, ...ambientes] };
  return cacheNpcs.lista;
}

// Chamado pelo mesmo intervalo que atualiza o indicador de clima: se o período
// virou, os NPCs mudaram de lugar e o índice precisa saber.
function reavaliarMundoVivo() {
  if (!personagem || !mundo.gerado) return;
  if (document.body.classList.contains("com-tutorial")) return;
  const periodoAntes = cacheNpcs.periodo;
  const resultado = reavaliarEventos(personagem, contextoDeNpc());
  if (resultado.abriram.length || resultado.fecharam.length) {
    aplicarNoWorldState(mundo.worldStateRegional, resultado);
    resultado.abriram.forEach((ev) => mostrarMensagem(`⚠ ${ev.nome}: ${ev.aviso}`, 6000));
  }
  npcsPosicionados();
  if (cacheNpcs.periodo !== periodoAntes && mundo.mapaAtual === "overworld") {
    mundo.indices.overworld = criarIndice(gradeDeChunks(OVERWORLD_W, OVERWORLD_H), fontesDoMapa("overworld"));
  }
}

// Reconstrói os três índices (mundo aberto e as duas masmorras). Chamado em
// iniciarMundo(), depois das grades e das fogueiras — que é de onde as
// posições saem.
function construirIndicesDeChunk() {
  mundo.indices = {};
  mundo.indices.overworld = criarIndice(gradeDeChunks(OVERWORLD_W, OVERWORLD_H), fontesDoMapa("overworld"));
  Object.entries(MASMORRAS).forEach(([id]) => {
    const grid = mundo[MASMORRAS[id].gridKey];
    if (!grid) return;
    mundo.indices[id] = criarIndice(gradeDeChunks(grid[0].length, grid.length), fontesDoMapa(id));
  });
  mundo.chunksAtivos = null;
  atualizarChunksAtivos();
}

const indiceAtivo = () => (mundo.indices && mundo.indices[mundo.mapaAtual]) || null;

// Recalcula o conjunto de chunks carregados ao redor do jogador. Hoje o
// resultado só alimenta o diagnóstico HDA_MUNDO(); o valor de verdade é o
// gancho: quando a ETAPA 2 tiver conteúdo gerado por chunk, é aqui que
// "carregar o que entrou / descarregar o que saiu" se pendura, e nada mais
// no jogo precisa saber disso.
function atualizarChunksAtivos() {
  const indice = indiceAtivo();
  if (!indice) return { entrando: [], saindo: [], mudou: false };
  const atuais = chunksAtivos(mundo.player.x, mundo.player.y, indice.grade);
  const dif = diferencaDeChunks(mundo.chunksAtivos, atuais);
  mundo.chunksAtivos = atuais;
  return dif;
}

// Converte uma fonte indexada no objeto de desenho que o Renderer espera.
// Devolve null pro que não deve aparecer agora (nó já coletado).
function fonteParaDesenho(f) {
  if (f.tipo === "bau") return { x: f.x, y: f.y, imgKey: f.ref.aberto ? "bau_aberto" : "bau_fechado", ref: f.ref, tipo: "bau", camada: f.camada };
  if (f.tipo === "no") return f.ref.disponivel ? { x: f.x, y: f.y, imgKey: `no_${f.ref.tipo}`, ref: f.ref, tipo: "no", camada: f.camada } : null;
  if (f.tipo === "npc") return null; // NPCs vão pela lista própria do Renderer
  if (f.tipo === "chefe" && !chefeDisponivel(f.ref)) {
    // Marcador de "chefe se recuperando": sem sprite, desenhado só com
    // formas de canvas pelo Renderer, que calcula o tempo restante sozinho a
    // partir de derrotadoEm/RESPAWN_CHEFE_MS.
    return { x: f.x, y: f.y, tipo: "chefe_recuperando", ref: f.ref, respawnMs: RESPAWN_CHEFE_MS, camada: f.camada };
  }
  return { x: f.x, y: f.y, imgKey: f.imgKey, ref: f.ref, tipo: f.tipo, camada: f.camada };
}

function objetosAtivos() {
  const indice = indiceAtivo();
  if (!indice) return [];
  const objetos = [];
  for (const f of objetosPerto(indice, mundo.player.x, mundo.player.y)) {
    const o = fonteParaDesenho(f);
    if (o) objetos.push(o);
  }
  // Cenário por baixo, objetos por cima — a garantia que a ordem dos pushes
  // dava antes. Ordenação estável, então dentro da mesma camada a ordem
  // continua sendo a de inserção no índice.
  objetos.sort((a, b) => a.camada - b.camada);
  return objetos;
}

// NPCs do mapa atual, também vindos do índice (só os chunks perto) — a
// lista era remontada com spread a cada quadro.
function npcsAtivos() {
  const indice = indiceAtivo();
  if (!indice || mundo.mapaAtual !== "overworld") return [];
  return objetosPerto(indice, mundo.player.x, mundo.player.y)
    .filter((f) => f.tipo === "npc")
    .map((f) => {
      const npc = { ...f.ref, x: f.x, y: f.y };
      if (!npc.ambulante) return npc;
      return passearNpc(npc, f.x, f.y);
    });
}

// CAMINHADA DOS NPCs AMBULANTES.
//
// O QUE HAVIA. Duas senoides somadas à posição: `x += sin(t)*0.34`,
// `y += sin(t*0.63)*0.22`. Não é caminhada, é balanço — o corpo desliza de um
// lado para o outro sem nunca ir a lugar nenhum, sem olhar para onde vai e
// sem mexer as pernas, porque nada disso estava ligado ao deslocamento.
//
// O QUE PASSA A HAVER. Cada ambulante ganha um destino curto perto do próprio
// posto, caminha até lá numa linha, para um tempo e escolhe outro. A direção
// do sprite vem do vetor andado e a pose vem da distância percorrida — as
// mesmas duas regras do herói, então NPC e jogador se movem com a mesma
// linguagem.
//
// DUAS TRAVAS QUE IMPORTAM:
//
// O raio é pequeno (1,5 tile do posto) porque a posição LÓGICA do NPC, a que
// o índice espacial e a interação usam, continua sendo o posto. Um passeio
// grande faria o jogador andar até o sprite e a tecla de interação não
// responder — o boneco estaria longe de onde o jogo acha que ele está.
//
// O destino é sorteado UMA vez por trecho, não a cada quadro. Recalcular rota
// por quadro para cada NPC da tela era justamente o custo que você pediu para
// evitar; aqui cada NPC decide a cada poucos segundos.
const PASSEIO_NPC = {
  raio: 1.5,          // até onde o sprite se afasta do posto
  velocidade: 0.0016, // tiles por milissegundo (~1,6 tile/s, mais lento que o herói)
  pausaMin: 1200,
  pausaMax: 4200,
  distanciaPorPose: 0.3,
};
const passeios = new Map();

function passearNpc(npc, postoX, postoY) {
  const agora = Date.now();
  let e = passeios.get(npc.id);
  if (!e || e.postoX !== postoX || e.postoY !== postoY) {
    // Posto novo (a rotina do dia moveu o NPC): recomeça deste lugar.
    e = { postoX, postoY, x: postoX, y: postoY, alvoX: postoX, alvoY: postoY,
          pausaAte: agora + Math.random() * PASSEIO_NPC.pausaMax, dist: 0, dir: npc.dir || "baixo", ultimo: agora };
    passeios.set(npc.id, e);
  }
  const dt = Math.min(agora - e.ultimo, 100);
  e.ultimo = agora;

  const dx = e.alvoX - e.x;
  const dy = e.alvoY - e.y;
  const falta = Math.hypot(dx, dy);

  if (falta < 0.04) {
    // Chegou. Fica parado o tempo da pausa e então escolhe outro destino.
    e.x = e.alvoX; e.y = e.alvoY;
    if (agora >= e.pausaAte) {
      const ang = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * PASSEIO_NPC.raio;
      const cx = postoX + Math.cos(ang) * r;
      const cy = postoY + Math.sin(ang) * r;
      // Respeita o cenário: destino em cima de parede, água ou árvore é
      // descartado e o NPC simplesmente espera mais um pouco.
      const grid = gridAtiva();
      if (grid && !estaBloqueado(Math.round(cx), Math.round(cy), grid)) {
        e.alvoX = cx; e.alvoY = cy;
      } else {
        e.pausaAte = agora + 600;
      }
      e.pausaAte = Math.max(e.pausaAte, agora + PASSEIO_NPC.pausaMin + Math.random() * (PASSEIO_NPC.pausaMax - PASSEIO_NPC.pausaMin));
    }
    npc.x = e.x; npc.y = e.y; npc.dir = e.dir; npc.frame = 0;
    npc.andando = false;
    npc.fasePasso = e.dist / PASSEIO_NPC.distanciaPorPose;
    return npc;
  }

  // Andando: passo proporcional ao tempo, nunca ultrapassando o destino.
  const passo = Math.min(falta, PASSEIO_NPC.velocidade * dt);
  e.x += (dx / falta) * passo;
  e.y += (dy / falta) * passo;
  e.dist += passo;
  // Direção pelo vetor REAL do passo, como no herói: o eixo dominante manda,
  // e o horizontal ganha o empate porque só existem quatro folhas.
  e.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "esquerda" : "direita") : (dy < 0 ? "cima" : "baixo");
  npc.x = e.x; npc.y = e.y; npc.dir = e.dir;
  npc.frame = Math.floor(e.dist / PASSEIO_NPC.distanciaPorPose) % 4;
  // Fase contínua do passo, em "poses": o desenho usa isto para o balanço
  // acompanhar a distância andada em vez do relógio.
  npc.fasePasso = e.dist / PASSEIO_NPC.distanciaPorPose;
  npc.andando = true;
  return npc;
}

// Suaviza o deslocamento visual do jogador entre tiles. O movimento LÓGICO
// continua encaixado na grade e é ele que toda a regra do jogo usa — colisão,
// encontro, zona, chunk. Isto aqui muda só a posição usada para desenhar.
//
// `dtSegurado` é o tempo desde o quadro anterior, já limitado por quem chama
// (ver loopRender). O limite existe para o caso de a aba voltar do segundo
// plano depois de minutos: sem ele, um dt gigante faria alfa ≈ 1 e o herói
// apareceria de uma vez no destino — o mesmo salto que esta função existe
// para evitar.
function atualizarPosicaoRenderizada(dtSegurado = 16.7) {
  const p = mundo.player;
  if (p.renderX === undefined || p.renderY === undefined) {
    p.renderX = p.x;
    p.renderY = p.y;
    return;
  }
  const distX = p.x - p.renderX;
  const distY = p.y - p.renderY;
  const dist = Math.hypot(distX, distY);

  // TELEPORTE é declarado, não adivinhado.
  //
  // O código anterior tratava "distância maior que 1,01 tile" como teleporte.
  // Isso confundia duas coisas que não têm nada a ver: uma troca de mapa (que
  // É um salto) e um quadro demorado (que não é). Ao voltar de uma aba em
  // segundo plano, ou depois de um engasgo de 200ms, a posição lógica já
  // tinha avançado mais de um tile e o herói PISCAVA para o lugar novo — o
  // atraso de renderização virava teleporte.
  //
  // Agora quem teleporta avisa (ver marcarTeleporteVisual): mudança de mapa,
  // viagem rápida, resgate após derrota, carregar save e o gancho de teste.
  // Fora esses casos a posição visual sempre PERSEGUE a lógica, por mais
  // atrasada que esteja, e a colisão nunca é afetada — quem anda é `p.x/p.y`,
  // isto aqui é só o desenho.
  if (p.teleportePendente) {
    p.teleportePendente = false;
    p.renderX = p.x;
    p.renderY = p.y;
    p.distAndada = 0;
    p.frame = 0;
    return;
  }

  if (dist > 0.0015) {
    // VELOCIDADE CONSTANTE — é o que separa caminhar de saltitar.
    //
    // Duas versões atrás isto era `renderX += distX * 0.35`: 35% do que falta
    // A CADA QUADRO, o que fazia a caminhada depender da taxa de quadros.
    // Consertei aquilo com a suavização exponencial por tempo
    // (alfa = 1 - e^(-dt/τ), τ = 55ms), que resolveu a dependência de FPS mas
    // MANTEVE o defeito de fundo, e é ele que produz a sensação de pulo:
    //
    //   exponencial = velocidade máxima no começo do tile e quase zero no
    //   fim. Com τ=55ms e um passo a cada 130ms, sobra e^(-130/55) ≈ 9% do
    //   tile quando o passo seguinte dispara — ou seja, o herói ARRANCA,
    //   desacelera até quase parar, arranca de novo. Sete vezes por segundo.
    //   Esse arranca-e-para é exatamente a leitura de "pulando de tile em
    //   tile", por mais bem animado que o sprite esteja.
    //
    // Gente andando não faz isso: a velocidade do quadril é praticamente
    // constante. Então a posição visual agora persegue a lógica em VELOCIDADE
    // CONSTANTE, calibrada para cobrir um passo exatamente no tempo que o
    // jogo leva para permitir o próximo (ver cadenciaPasso/comprimentoPasso
    // em `mover`, que já embutem o atraso do terreno e o custo da diagonal —
    // na água o passo é mais lento, e o desenho acompanha em vez de chegar
    // antes e ficar esperando).
    const cadencia = p.cadenciaPasso || COOLDOWN_MOVIMENTO;
    const passo = p.comprimentoPasso || 1;
    const v0 = passo / cadencia; // tiles por milissegundo
    // Correção proporcional ao atraso. Em regime o herói mantém um passo de
    // distância da posição lógica e anda liso; se perder quadros, acelera até
    // 2,2× para recuperar (nunca teleporta — isso é trabalho do
    // marcarTeleporteVisual); se estiver adiantado, freia em vez de travar.
    // A correção age só sobre o atraso EXCEDENTE — o que passa de um passo.
    // (Primeira tentativa minha corrigia sobre a distância inteira. Não
    // funciona, e a medição pegou: logo depois do passo falta um tile e o
    // fator ia a 1, no fim do tile faltava quase nada e o fator caía ao piso;
    // o herói voltava a acelerar-e-frear, só que por outro motivo. Pico/média
    // ficou em 2,0, praticamente igual à exponencial que eu tinha saído.)
    // Sem atraso excedente o fator é exatamente 1: velocidade constante.
    const excesso = Math.max(0, dist - passo) / passo;
    const fator = 1 + Math.min(1.2, excesso);
    const avanco = Math.min(dist, v0 * fator * dtSegurado);
    p.renderX += (distX / dist) * avanco;
    p.renderY += (distY / dist) * avanco;

    // PASSO PELA DISTÂNCIA, não pelo relógio.
    //
    // O frame vinha de `performance.now() / 92`: as pernas andavam no mesmo
    // ritmo com o herói atravessando pântano (1,18× mais devagar), água
    // (1,55×) ou na diagonal (1,41×) — e continuavam andando enquanto ele
    // estava parado esbarrando numa parede. Somando o deslocamento REAL, o
    // pé acompanha o chão em qualquer terreno, e um herói bloqueado não
    // percorre distância nenhuma, logo não anima.
    p.distAndada = (p.distAndada || 0) + Math.hypot(p.renderX - (p.ultimoRenderX ?? p.renderX), p.renderY - (p.ultimoRenderY ?? p.renderY));
    p.frame = Math.floor(p.distAndada / DISTANCIA_POR_POSE) % 4;
    // Fase CONTÍNUA do passo, em poses. O `frame` inteiro escolhe o desenho;
    // esta fração é o que dá peso ao corpo entre um desenho e o outro (ver
    // desenharJogador no Renderer).
    p.fasePasso = p.distAndada / DISTANCIA_POR_POSE;
    p.andando = true;

    // O antigo "encostar no destino" (snap abaixo de 0,01 tile) saiu junto
    // com a exponencial: ele existia porque a exponencial nunca chega a zero
    // e o herói ficava deslizando um décimo de pixel para sempre. Com
    // velocidade constante a chegada é exata (ver `avanco >= dist` acima), e
    // um snap agora só reintroduziria um micro-tranco de 0,6px no fim de cada
    // passo — bem o tipo de coisa que o olho lê como tropeço.
  } else if (Date.now() - (p.ultimoMovimento || 0) < (p.cadenciaPasso || COOLDOWN_MOVIMENTO) * 1.5) {
    // ALCANÇOU A POSIÇÃO LÓGICA, MAS AINDA ESTÁ ANDANDO.
    //
    // Com velocidade constante o desenho às vezes chega ao destino alguns
    // milissegundos antes de o jogo liberar o passo seguinte. Sem este ramo,
    // esses poucos milissegundos caíam no "parou" lá embaixo, que zera
    // distAndada e devolve a pose de descanso — uma piscada de pose a cada
    // tile, sete vezes por segundo. Enquanto o último passo é recente o
    // ciclo continua de onde estava; só a distância percorrida (e portanto a
    // pose) fica de fato parada nesse intervalo curtíssimo.
    p.renderX = p.x;
    p.renderY = p.y;
    p.andando = true;
  } else {
    // Parou de verdade: fecha o passo em vez de cortar no meio. A pose 0 é o
    // descanso; vindo de 1 ou 3 (pernas abertas) o corpo passa pela 2 antes,
    // o que lê como "terminou de pisar" em lugar de um corte seco.
    p.renderX = p.x;
    p.renderY = p.y;
    p.distAndada = 0;
    p.frame = p.frame === 1 || p.frame === 3 ? 2 : 0;
    p.andando = false;
  }
  p.ultimoRenderX = p.renderX;
  p.ultimoRenderY = p.renderY;
}

// Quanto o herói precisa percorrer para trocar de pose. Um tile inteiro
// cobre as quatro poses do ciclo, então cada pose vale um quarto de tile —
// é o que faz o pé "grudar" no chão em vez de patinar.
const DISTANCIA_POR_POSE = 0.25;

// Quem muda o herói de lugar de propósito chama isto. Uma linha em cada
// transição, e o desenho nunca mais confunde salto com engasgo.
function marcarTeleporteVisual() {
  if (mundo && mundo.player) mundo.player.teleportePendente = true;
  // A câmera perde a antecipação junto: sem isto ela escorregaria da direção
  // anterior para a nova depois do salto, o que lê como um puxão.
  renderer?.reiniciarCamera?.();
}

// O PET SEGUE PELO RASTRO, não por uma conta de perseguição.
//
// Guardar as últimas posições desenhadas do jogador e pôr o bicho algumas
// casas atrás custa quase nada e resolve sozinho tudo o que uma perseguição
// teria de tratar à mão: ele contorna a mesma parede que você contornou,
// atravessa a mesma ponte, e nunca fica preso numa quina — porque só anda
// onde você já andou.
const RASTRO_MAXIMO = 14;
const ATRASO_DO_PET = 8;   // quantas posições atrás o companheiro caminha
const rastroDoJogador = [];

function atualizarRastro() {
  const p = mundo.player;
  const ultimo = rastroDoJogador[rastroDoJogador.length - 1];
  if (ultimo && Math.abs(ultimo.x - p.renderX) < 0.05 && Math.abs(ultimo.y - p.renderY) < 0.05) return;
  // Teleporte (trocar de mapa, derrota): o rastro é jogado fora, senão o pet
  // vem "andando" do outro lado do mundo atravessando tudo.
  if (ultimo && Math.hypot(ultimo.x - p.renderX, ultimo.y - p.renderY) > 3) rastroDoJogador.length = 0;
  rastroDoJogador.push({ x: p.renderX, y: p.renderY, dir: p.dir });
  if (rastroDoJogador.length > RASTRO_MAXIMO) rastroDoJogador.shift();
}

function petParaDesenho() {
  if (!dados || !dados.pets) return null;
  const def = petAtivo(personagem, dados.pets);
  if (!def) return null;
  const alvo = rastroDoJogador[Math.max(0, rastroDoJogador.length - 1 - ATRASO_DO_PET)];
  const pos = alvo || { x: mundo.player.renderX, y: mundo.player.renderY, dir: mundo.player.dir };
  return {
    spriteKey: `pet_${def.id}`,
    x: pos.x, y: pos.y, dir: pos.dir,
    // Dois quadros, alternados pelo relógio: o bicho continua se mexendo
    // parado, que é o que faz ele parecer vivo em vez de colado no chão.
    frame: Math.floor(Date.now() / 320) % 2,
  };
}

let ultimoQuadroMundo = 0;
let ultimoInstante = 0;
let acumuladoInterface = 0;
let cacheObjetivoMissao = null;

// TRÊS RITMOS, NÃO UM.
//
// Antes havia um limitador só: 33ms sempre, 120ms com painel aberto. Medido
// no build anterior, a 1280x720: o jogo ficava preso em 32 FPS mesmo PARADO,
// caía para 21,9 FPS com o automático andando (5 quadros acima de 100ms), e
// com a mochila aberta o mundo desenhava a ~8 FPS enquanto o navegador
// sobrava ocioso a 60 — que é exatamente o "personagem dando saltos ao
// fundo" ao abrir um painel.
//
// A causa não era o desenho ser caro: era tudo estar amarrado no mesmo
// relógio. Agora são três coisas separadas, cada uma no seu ritmo:
//
//   MOVIMENTO VISUAL — todo quadro. É barato (duas multiplicações) e é o
//   que os olhos leem como fluidez. Nunca é limitado.
//
//   DESENHO DO CENÁRIO — todo quadro com o mundo à vista; com um painel
//   aberto, a cada 33ms. O painel cobre a maior parte da tela, então 30 FPS
//   ao fundo é suficiente — mas 30, não 8.
//
//   INTERFACE (bússola de missão, botão de ação, minimapa) — a cada 100ms.
//   `destinoDaMissaoRastreada()` percorre as missões ativas, procura o NPC
//   entre os posicionados e calcula progresso; fazia isso 30 vezes por
//   segundo para um losango que se move um pixel. `atualizarGuiaMissao()`
//   ainda mexia no DOM junto. Dez vezes por segundo ninguém percebe
//   diferença, e o quadro fica livre.
const INTERVALO_DESENHO_COM_PAINEL = 33;
const INTERVALO_INTERFACE_MS = 100;
// Teto do passo de tempo. Um quadro de 250ms é engasgo; tratar um de 4
// segundos (aba em segundo plano) como tempo real faria o herói cruzar o
// mapa de uma vez.
const DT_MAXIMO_MS = 100;

function loopRender(agora = performance.now()) {
  const dtBruto = ultimoInstante ? agora - ultimoInstante : 16.7;
  ultimoInstante = agora;
  const dt = Math.min(dtBruto, DT_MAXIMO_MS);

  // 1. MOVIMENTO VISUAL — sempre, em todo quadro.
  mundo.player.spriteKey = personagem.spriteKey;
  atualizarPosicaoRenderizada(dt);
  atualizarRastro();

  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");
  if (modalAberto && agora - ultimoQuadroMundo < INTERVALO_DESENHO_COM_PAINEL) {
    requestAnimationFrame(loopRender);
    return;
  }
  ultimoQuadroMundo = agora;

  // 2. INTERFACE — no seu próprio relógio, mais lento.
  acumuladoInterface += dt;
  const atualizarUI = acumuladoInterface >= INTERVALO_INTERFACE_MS || cacheObjetivoMissao === null;
  if (atualizarUI) acumuladoInterface = 0;

  const grid = gridAtiva();
  const contextoAcao = contextoInteracaoProxima();
  if (atualizarUI) {
    atualizarBotaoAcaoTouch(contextoAcao);
    cacheObjetivoMissao = destinoDaMissaoRastreada();
  }
  renderer.desenhar({
    grid,
    alturas: alturasAtivas(),
    player: { ...mundo.player, x: mundo.player.renderX, y: mundo.player.renderY, horaNoite: ehNoite(Date.now()), lanternaNivel: personagem?.lanternaNivel || 1 },
    npcs: npcsAtivos(),
    objetos: objetosAtivos(),
    props: propsAtivos(),
    tema: temaAtivo(),
    pet: petParaDesenho(),
    objetivoMissao: cacheObjetivoMissao,
    // No celular o próprio botão contextual conta a ação; repetir uma tarja
    // no canvas cobria o herói. Teclado mantém a dica completa.
    mostrarPronto: document.body.classList.contains("touch") ? null : contextoAcao.textoTeclado,
    hora: horaDoDiaAtual(Date.now()),
    climaId: climaAtual()?.id || null,
    // Tempo desde o quadro anterior: a antecipação da câmera e o desbotar da
    // oclusão precisam dele para serem independentes da taxa de quadros.
    dt,
  });
  // O minimapa sai cedo sozinho quando nada mudou (ver MinimapaUI:
  // `ultimaChave`), então chamá-lo a cada quadro custa uma comparação de
  // string — e é o que garante que ele nunca fica atrasado em relação ao
  // mundo desenhado logo acima.
  if (atualizarUI) {
    atualizarMinimapa();
    atualizarGuiaMissao();
  }
  requestAnimationFrame(loopRender);
}

// O que o minimapa precisa saber do mundo, montado sob demanda. Uma função em
// vez de um objeto porque o minimapa vive fora do loop e pergunta "como está
// agora?" — assim main.js não precisa empurrar estado a cada quadro.
function contextoDoMinimapa() {
  if (!personagem || !mundo.grid) return null;
  const zona = mundo.mapaAtual === "overworld" ? zonaDoMundoPorId(mundo.zonaAtualId) : null;
  const masmorra = mundo.mapaAtual !== "overworld" ? MASMORRAS[mundo.mapaAtual] : null;
  const nivel = zona ? faixaDeNivel(zona) : null;
  const ameaca = zona ? ameacaRelativa(zona, personagem.nivel) : null;
  return {
    mapaAtual: mundo.mapaAtual,
    grid: gridAtiva(),
    player: mundo.player,
    npcs: npcsAtivos(),
    objetos: objetosAtivos(),
    objetivoMissao: cacheObjetivoMissao,
    zonaNome: zona ? zona.nome : (masmorra ? masmorra.nome || "Masmorra" : ""),
    nivelTexto: nivel ? nivel.texto : "",
    nivelCor: ameaca ? ameaca.cor : null,
  };
}

function estaBloqueado(x, y, grid) {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return true;
  return SOLID_TILES.has(grid[y][x]);
}

function podeJogarNoMundo() {
  if (!personagem) return false;
  if (document.body.classList.contains("com-tutorial")) return false;
  if (document.body.classList.contains("com-cutscene")) return false;
  if (document.body.classList.contains("desafio-encontro-ativo")) return false;
  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");
  if (modalAberto) return false;
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) return false;
  return true;
}

function tentarMover(dx, dy) {
  if (!podeJogarNoMundo()) return;
  mover(dx, dy);
}

// TECLADO EM OITO DIREÇÕES.
//
// Antes, cada seta chamava `mover` sozinha e a repetição vinha do autorepeat
// do sistema — que dispara UMA tecla por vez. Segurar ↑ e → ao mesmo tempo
// produzia uma sequência alternada de passos retos, nunca uma diagonal.
//
// Agora as teclas seguradas ficam num conjunto e um único relógio lê a SOMA
// delas. ↑+→ vira (1,-1) de verdade, e soltar uma das duas volta ao passo
// reto no mesmo instante, sem esperar o autorepeat recomeçar.
//
// Setas, WASD e o teclado numérico (incluindo as diagonais 1/3/7/9, que é
// como muitos roguelikes se jogam) chegam todos aqui.
const VETOR_POR_TECLA = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};
// "w" e "a" já são atalhos de painel? Não: os atalhos usados são
// i/m/q/f/s/y/g/t/h/c/v/d/u/k/r/p (ver onKeyDown). WASD colide com "s"
// (salvar) e "d" (diário), então WASD fica de fora por enquanto — as setas e
// o numérico cobrem as oito direções sem ambiguidade.
delete VETOR_POR_TECLA.w; delete VETOR_POR_TECLA.a;
delete VETOR_POR_TECLA.s; delete VETOR_POR_TECLA.d;

function normalizarTeclaMovimento(chave) {
  return chave;
}

const teclasSeguradas = new Set();
let relogioMovimentoTeclado = null;

function vetorDasTeclas() {
  let dx = 0, dy = 0;
  for (const k of teclasSeguradas) {
    const v = VETOR_POR_TECLA[k];
    if (!v) continue;
    dx += v[0]; dy += v[1];
  }
  // Duas teclas opostas se anulam; mais de uma no mesmo eixo não acelera.
  return [Math.sign(dx), Math.sign(dy)];
}

function passoDoTeclado() {
  const [dx, dy] = vetorDasTeclas();
  if (!dx && !dy) { pararMovimentoTeclado(); return; }
  tentarMover(dx, dy);
}

function pressionarTeclaDeMovimento(chave) {
  teclasSeguradas.add(chave);
  passoDoTeclado();
  if (!relogioMovimentoTeclado) {
    // Mais rápido que o cooldown do passo de propósito: `mover` é quem
    // decide se já passou tempo suficiente, e um relógio mais lento perderia
    // o instante em que a segunda tecla entra numa diagonal.
    relogioMovimentoTeclado = setInterval(passoDoTeclado, 40);
  }
}

function pararMovimentoTeclado() {
  clearInterval(relogioMovimentoTeclado);
  relogioMovimentoTeclado = null;
}

function onKeyUp(e) {
  teclasSeguradas.delete(normalizarTeclaMovimento(e.key));
  if (!teclasSeguradas.size) pararMovimentoTeclado();
}
// Sair da aba com a tecla pressionada deixava o herói andando sozinho para
// sempre: o keyup acontece fora da janela e nunca chega.
window.addEventListener("blur", () => { teclasSeguradas.clear(); pararMovimentoTeclado(); });

function tentarInteragir() {
  if (!podeJogarNoMundo()) return;
  interagir();
}

function onKeyDown(e) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "") || e.target?.isContentEditable) return;
  if (!personagem) return;
  if (e.key === "F1") {
    e.preventDefault();
    if (!document.body.classList.contains("com-tutorial")) onHudAction("tutorial");
    return;
  }
  if (e.key === "Escape") { fecharModal(); return; }

  if (VETOR_POR_TECLA[normalizarTeclaMovimento(e.key)]) {
    e.preventDefault();
    pressionarTeclaDeMovimento(normalizarTeclaMovimento(e.key));
  } else if (e.key.toLowerCase() === "e") {
    tentarInteragir();
  } else if (e.key.toLowerCase() === "i") {
    if (podeJogarNoMundo()) onHudAction("equipamento");
  } else if (e.key.toLowerCase() === "m") {
    if (podeJogarNoMundo()) onHudAction("missoes");
  } else if (e.key.toLowerCase() === "q") {
    if (podeJogarNoMundo()) onHudAction("missoes");
  } else if (e.key.toLowerCase() === "f") {
    if (podeJogarNoMundo()) onHudAction("forja");
  } else if (e.key.toLowerCase() === "s") {
    if (podeJogarNoMundo()) onHudAction("salvar");
  } else if (e.key.toLowerCase() === "y") {
    if (podeJogarNoMundo()) onHudAction("party");
  } else if (e.key.toLowerCase() === "g") {
    if (podeJogarNoMundo()) onHudAction("gacha");
  } else if (e.key.toLowerCase() === "t") {
    if (podeJogarNoMundo()) onHudAction("arvore");
  } else if (e.key.toLowerCase() === "h") {
    if (podeJogarNoMundo()) onHudAction("caminhos");
  } else if (e.key.toLowerCase() === "c") {
    if (podeJogarNoMundo()) onHudAction("compendio");
  } else if (e.key.toLowerCase() === "v") {
    if (podeJogarNoMundo()) onHudAction("viagem");
  } else if (e.key.toLowerCase() === "d") {
    if (podeJogarNoMundo()) onHudAction("diario");
  } else if (e.key.toLowerCase() === "u") {
    // U passou a abrir o MAPA (o instrumento) em vez do Atlas (a ilustração):
    // é o mapa que se consulta no meio da exploração, dezenas de vezes por
    // sessão. O Atlas continua na aba Jornada, sem atalho.
    if (podeJogarNoMundo()) onHudAction("mapa");
  } else if (e.key.toLowerCase() === "k") {
    if (podeJogarNoMundo()) onHudAction("estado");
  } else if (e.key.toLowerCase() === "r") {
    if (podeJogarNoMundo()) onHudAction("descansar");
  } else if (e.key.toLowerCase() === "p") {
    onHudAction("auto");
  }
}

// O ANALÓGICO DE OITO DIREÇÕES.
//
// O direcional anterior eram quatro botões numa cruz: só dava para andar
// reto, e num aparelho de 360px ele ocupava 44vw. Este é um analógico —
// encosta em qualquer ponto do círculo, ou encosta no meio e arrasta, e o
// herói anda naquela direção enquanto o dedo estiver na tela.
//
// Três decisões que valem explicar:
//
// ZONA MORTA de 28% do raio. Sem ela, o menor tremor do polegar no centro
// dispara um passo — e o centro é exatamente onde o dedo pousa. Dentro da
// zona morta o herói fica parado e a manete volta ao meio.
//
// OITO SETORES DE 45°, e não um vetor contínuo. O mundo é uma grade: só
// existem oito passos possíveis. Arredondar o ângulo para o setor mais
// próximo é o que faz o controle parecer preciso — um vetor contínuo teria de
// ser arredondado de qualquer jeito, mas no lugar errado, e a diagonal
// escaparia para os lados perto dos 45°.
//
// PONTEIRO, não toque. `pointerdown/move/up` cobre dedo, caneta e mouse com
// um código só, e `setPointerCapture` garante que arrastar para FORA do
// círculo continue funcionando — sem isso, o passo morre no instante em que o
// polegar cruza a borda, que é justamente quando o jogador está empurrando
// mais forte numa direção.
const ZONA_MORTA_ANALOGICO = 0.28;
const NOMES_DIRECAO = ["direita", "baixo-direita", "baixo", "baixo-esquerda", "esquerda", "cima-esquerda", "cima", "cima-direita"];

function configurarAnalogico() {
  const base = document.getElementById("touch-dpad");
  if (!base) return;
  const manete = base.querySelector(".anlg-manete");
  const leitura = base.querySelector(".anlg-leitura");
  let vetor = [0, 0];
  let relogio = null;
  let ponteiro = null;

  const aplicar = () => { if (vetor[0] || vetor[1]) tentarMover(vetor[0], vetor[1]); };

  const soltar = () => {
    vetor = [0, 0];
    clearInterval(relogio); relogio = null;
    base.classList.remove("anlg-ativo");
    base.style.removeProperty("--anlg-x");
    base.style.removeProperty("--anlg-y");
    base.removeAttribute("data-direcao");
    if (leitura) leitura.textContent = "";
    if (manete) manete.style.transform = "";
  };

  const atualizar = (ev) => {
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const raio = Math.min(r.width, r.height) / 2;
    const px = ev.clientX - cx;
    const py = ev.clientY - cy;
    const dist = Math.hypot(px, py);

    if (dist < raio * ZONA_MORTA_ANALOGICO) {
      vetor = [0, 0];
      base.removeAttribute("data-direcao");
      if (manete) manete.style.transform = "";
      base.style.setProperty("--anlg-x", "0px");
      base.style.setProperty("--anlg-y", "0px");
      return;
    }
    // Setor de 45°: +22,5° desloca a fronteira para o meio de cada fatia, de
    // modo que "direita" cubra de -22,5° a +22,5° em vez de 0° a 45°.
    const ang = Math.atan2(py, px);
    const setor = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    const passo = [
      [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
    ][setor];
    vetor = passo;
    base.dataset.direcao = NOMES_DIRECAO[setor];
    if (leitura) leitura.textContent = NOMES_DIRECAO[setor];
    // A manete acompanha o dedo, mas presa ao aro: passar disso faria o
    // controle parecer quebrado quando o polegar desliza para longe.
    const limite = Math.min(dist, raio * 0.62);
    const ux = Math.cos(ang) * limite;
    const uy = Math.sin(ang) * limite;
    base.style.setProperty("--anlg-x", `${ux.toFixed(1)}px`);
    base.style.setProperty("--anlg-y", `${uy.toFixed(1)}px`);
    if (manete) manete.style.transform = `translate(calc(-50% + ${ux.toFixed(1)}px), calc(-50% + ${uy.toFixed(1)}px))`;
  };

  base.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    ponteiro = ev.pointerId;
    try { base.setPointerCapture(ponteiro); } catch { /* navegador sem captura: segue com os eventos soltos */ }
    base.classList.add("anlg-ativo");
    atualizar(ev);
    aplicar();
    clearInterval(relogio);
    // Mais rápido que o cooldown de propósito: quem decide se já pode dar o
    // próximo passo é `mover`, que conhece o atraso do terreno e o custo da
    // diagonal. Um relógio lento perderia o momento certo.
    relogio = setInterval(aplicar, 40);
  });
  base.addEventListener("pointermove", (ev) => {
    if (ponteiro === null || ev.pointerId !== ponteiro) return;
    ev.preventDefault();
    atualizar(ev);
  });
  const fim = (ev) => {
    if (ponteiro === null || (ev && ev.pointerId !== ponteiro)) return;
    ponteiro = null;
    soltar();
  };
  base.addEventListener("pointerup", fim);
  base.addEventListener("pointercancel", fim);
  base.addEventListener("lostpointercapture", fim);
  // Sair da aba com o dedo na tela deixaria o herói andando sozinho.
  window.addEventListener("blur", soltar);

  // TECLADO. O analógico é um `role="application"` focável: quem navega por
  // teclado usa as mesmas setas do jogo aqui dentro, sem cair na navegação
  // por Tab do navegador.
  base.addEventListener("keydown", (ev) => {
    const v = VETOR_POR_TECLA[ev.key];
    if (!v) return;
    ev.preventDefault();
    pressionarTeclaDeMovimento(ev.key);
  });
  base.addEventListener("keyup", (ev) => {
    if (VETOR_POR_TECLA[ev.key]) { teclasSeguradas.delete(ev.key); if (!teclasSeguradas.size) pararMovimentoTeclado(); }
  });
}

function configurarControlesToque() {
  const ehToque = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (ehToque) {
    document.body.classList.add("touch");
    document.getElementById("touch-controls").classList.remove("hidden");
  }

  configurarAnalogico();

  const btnAcao = document.getElementById("touch-acao");
  const acionar = (ev) => {
    ev.preventDefault();
    btnAcao.classList.add("pressionado");
    setTimeout(() => btnAcao.classList.remove("pressionado"), 120);
    tentarInteragir();
  };
  btnAcao.addEventListener("touchstart", acionar, { passive: false });
  btnAcao.addEventListener("mousedown", acionar);
}

const COOLDOWN_MOVIMENTO = 130;
// A diagonal percorre √2 tiles de distância real. Sem este custo, andar na
// diagonal seria 41% mais rápido que andar reto — e como encontro aleatório,
// streaming de chunks e descoberta de zona são verificados POR PASSO, a
// diagonal viraria a única forma sensata de viajar. Com o custo, escolher a
// diagonal é escolher o caminho mais curto, não uma velocidade maior.
const CUSTO_DIAGONAL = Math.SQRT2;

// CANTO DE PAREDE. Andar na diagonal entre dois blocos sólidos seria
// atravessar a quina — o herói passaria por uma fresta que não existe, entre
// duas árvores encostadas. A regra: a diagonal exige que PELO MENOS UM dos
// dois vizinhos ortogonais esteja livre. Com os dois bloqueados é uma quina
// fechada e o passo é recusado; com um livre o herói contorna, que é o que a
// vista de cima sugere.
//
// Esta função é a mesma regra que a IA de exploração usa (ver
// AutoExploreAI.diagonalPermitida). As duas TÊM de concordar: se o caminho
// planejado incluir um passo que `mover` recusa, o automático fica parado
// empurrando a parede para sempre.
function diagonalBloqueadaPorQuina(x, y, dx, dy, grid) {
  if (dx === 0 || dy === 0) return false;
  return estaBloqueado(x + dx, y, grid) && estaBloqueado(x, y + dy, grid);
}

function mover(dx, dy) {
  if (!dx && !dy) return;
  const agora = Date.now();
  const tileAtual = gridAtiva()?.[mundo.player.y]?.[mundo.player.x];
  const atrasoTerreno = tileAtual === TILE.WATER ? 1.55 : tileAtual === TILE.SAND || tileAtual === TILE.MARSH ? 1.18 : 1;
  const atrasoDiagonal = dx && dy ? CUSTO_DIAGONAL : 1;
  if (agora - mundo.player.ultimoMovimento < COOLDOWN_MOVIMENTO * atrasoTerreno * atrasoDiagonal) return;
  const grid = gridAtiva();
  const nx = mundo.player.x + dx;
  const ny = mundo.player.y + dy;
  // Na diagonal o sprite olha para o lado: só existem quatro folhas de
  // caminhada, e "esquerda/direita" lê melhor que "cima/baixo" num passo
  // que tem as duas componentes.
  if (dx < 0) mundo.player.dir = "esquerda";
  else if (dx > 0) mundo.player.dir = "direita";
  else if (dy < 0) mundo.player.dir = "cima";
  else if (dy > 0) mundo.player.dir = "baixo";

  if (estaBloqueado(nx, ny, grid)) return;
  if (diagonalBloqueadaPorQuina(mundo.player.x, mundo.player.y, dx, dy, grid)) return;
  mundo.player.x = nx;
  mundo.player.y = ny;
  mundo.player.ultimoMovimento = agora;
  // RITMO DESTE PASSO, para o desenho andar na mesma velocidade que a regra.
  //
  // Duas coisas entram aqui. A primeira é o limite teórico, que já embute o
  // atraso do terreno e o custo da diagonal: sem ele a posição visual usaria
  // sempre o ritmo de terra firme e chegaria antes do tempo na água e no
  // pântano — e chegar antes significa ficar parado esperando o passo
  // seguinte, que é exatamente o arranca-e-para que estamos tirando.
  //
  // A segunda é o ritmo REAL. O limite é 130ms, mas quem chama `mover` é um
  // relógio de 40ms (teclado e analógico), então o passo sai no primeiro tique
  // depois do limite: na prática 130 a 170ms, com média perto de 150. Calibrar
  // o desenho pelos 130 teóricos faria o herói cobrir o tile e esperar ~20ms
  // parado, toda vez — de novo um arranca-e-para, agora pequeno, mas foi o que
  // a medição pegou (5% dos quadros com velocidade zero).
  //
  // Então o desenho segue o ritmo OBSERVADO, suavizado. Nada disso mexe na
  // velocidade do jogo: `mover` continua obedecendo ao mesmo limite de sempre,
  // e o que se ajusta é só a velocidade do desenho para caber no tempo que o
  // passo de fato leva.
  const limitePasso = COOLDOWN_MOVIMENTO * atrasoTerreno * atrasoDiagonal;
  const intervalo = agora - (mundo.player.ultimoPassoEm || 0);
  if (intervalo > 0 && intervalo <= limitePasso * 2) {
    mundo.player.ritmoObservado = mundo.player.ritmoObservado
      ? mundo.player.ritmoObservado * 0.72 + intervalo * 0.28
      : intervalo;
  }
  mundo.player.ultimoPassoEm = agora;
  mundo.player.cadenciaPasso = Math.max(limitePasso, mundo.player.ritmoObservado || limitePasso);
  mundo.player.comprimentoPasso = Math.hypot(dx, dy);
  // (Saiu daqui um `player.frame = frame === 1 ? 3 : 1`. Ele forçava a pose no
  // instante do passo, competindo com a pose calculada pela distância
  // percorrida a cada quadro — duas fontes para a mesma coisa, e a do passo
  // pulava direto entre as duas poses de apoio, sem passar pela passagem.
  // Agora quem manda na pose é só a distância.)

  verificarTransicaoMasmorra(nx, ny);
  verificarMudancaDeZona(nx, ny);
  // Streaming de chunks (task #36): recalculado a cada passo, não a cada
  // quadro. verificarTransicaoMasmorra() pode ter trocado o mapa inteiro
  // logo acima, então esta chamada vem depois dela de propósito.
  atualizarChunksAtivos();
  verificarEncontroAleatorio(grid, nx, ny);
}

function verificarMudancaDeZona(x, y) {
  if (mundo.mapaAtual !== "overworld") return;
  const zona = zonaNoPonto(x, y);
  if (zona && zona.id !== mundo.zonaAtualId) {
    mundo.zonaAtualId = zona.id;
    // Hierarquia (task #35): trocar de MACRO-REGIÃO é um acontecimento maior
    // que trocar de zona — é sair da Costa da Maré e entrar em Sombralith.
    // Anunciado antes, com o subtítulo canônico do atlas e mais tempo na
    // tela. Macro derivada não é anunciada: o nome dela é o nome da própria
    // zona, então a mensagem seria a mesma frase duas vezes.
    const macro = macroDaZona(zona.id);
    const entrouEmMacro = macro && macro.id !== mundo.macroAtualId && !macro.derivado;
    if (macro) mundo.macroAtualId = macro.id;
    const clima = zona.id === "vila" ? null : climaAtualDaZona(zona.id, Date.now(), altitudeNoPonto(x, y));
    // Uma mensagem só: mostrarMensagem() substitui a anterior na hora, então
    // duas chamadas seguidas fariam a primeira nunca ser lida.
    const texto = [
      entrouEmMacro ? `🗺️ ${macro.nome}` : null,
      `📍 ${zona.nome}`,
      clima ? `${clima.icone} ${clima.nome}` : null,
    ].filter(Boolean).join(" · ");
    mostrarMensagem(texto, entrouEmMacro ? 3400 : 2600);
    atualizarIndicadorClima();
  }
  // Viagem rápida (melhoria pós-backlog): pisar numa zona a marca como
  // disponível pra teleporte depois, mesmo que o jogador só tenha passado
  // por ela sem ficar (marcarZonaVisitada é idempotente).
  if (zona) {
    marcarZonaVisitada(personagem, zona.id);
    // E a macro-região correspondente entra no que este herdeiro já
    // conhece de Aethra (task #37) — sempre derivado de zona pisada.
    const macroZona = macroDaZona(zona.id);
    if (macroZona) marcarMacroVisitada(personagem, macroZona.id);
    // Névoa de guerra (ETAPA 2): pisar DESCOBRE a zona e põe as vizinhas em
    // RUMOR. Só isso — nada é revelado de graça.
    aoEntrarNaZona(personagem, zona.id, vizinhasDaZona(zona.id));
  }
  // Marco visível de longe põe a zona dele em rumor, de onde quer que se
  // esteja. É o vulcão no horizonte: você ainda não foi, mas já sabe que
  // existe e para que lado fica (itens 10 e 26).
  if (mundo.gerado) {
    verificarLandmarks(personagem, x, y, mundo.gerado.landmarks).forEach((l) => {
      mostrarMensagem(`👁️ Você avista ao longe: ${l.nome}`, 3000);
    });
    // Lugares só viram DESCOBERTOS quando o herói realmente chega perto.
    // O automático usa exatamente este registro para escolher o próximo
    // destino, então não repete cidades e marcos que já foram explorados.
    const visitaveis = [
      ...(mundo.gerado.assentamentos || []).map((a) => ({ ...a, alcanceDescoberta: Math.max(3, a.praca || 2) })),
      ...(mundo.gerado.pois || []).map((p) => ({ ...p, alcanceDescoberta: 2 })),
      ...(mundo.gerado.landmarks || []).map((l) => ({ ...l, alcanceDescoberta: 3 })),
    ];
    const novidades = visitaveis.filter((l) => Math.max(Math.abs(l.x - x), Math.abs(l.y - y)) <= l.alcanceDescoberta)
      .filter((l) => promoverLocal(personagem, l.id, NEVOA.DESCOBERTO));
    if (novidades.length) {
      // Motivação Descoberta: cada lugar novo rende XP e Fragmentos.
      const premio = recompensaDescoberta(personagem);
      if (premio) {
        const xp = premio.xp * novidades.length;
        const fragmentos = premio.fragmentos * novidades.length;
        const nivelAntes = personagem.nivel;
        const { subiuNivel } = ganharXP(personagem, xp);
        subiuNivel.forEach((novoNivel) => { aplicarCrescimento(personagem, dados); concederPontosPorNivel(personagem, novoNivel); });
        if (subiuNivel.length) celebrarNivel(subiuNivel[subiuNivel.length - 1], nivelAntes);
        adicionarFragmentos(personagem, fragmentos);
        mostrarMensagem(`🧭 Lugar descoberto: ${novidades[0].nome} — 🗺️ Descoberta: +${xp} XP, +${fragmentos} Fragmentos`, 3600);
      } else {
        mostrarMensagem(`🧭 Lugar descoberto: ${novidades[0].nome}`, 3000);
      }
    }
  }
}

const NOME_DA_MASMORRA = { dungeon1: "A masmorra antiga", dungeon2: "O Covil das Cinzas" };
function nomeDaMasmorra(id) { return NOME_DA_MASMORRA[id] || "A masmorra"; }

// Chamado depois de QUALQUER coisa que possa concluir a masmorra: abrir o
// último baú, derrotar o chefe. Registra a conclusão uma única vez e avisa.
//
// Fica num lugar só, e é chamado de dois pontos, porque a ordem entre baú e
// chefe não é fixa: quem termina por último é que fecha a masmorra.
function checarConclusaoDaMasmorra() {
  const id = mundo.mapaAtual;
  const m = MASMORRAS[id];
  if (!m) return false;
  const prog = progressoDaMasmorra(mundo, m, () => chefeDaMasmorraDisponivel(m));
  if (!prog.completa) return false;
  if (!marcarMasmorraLimpa(mundo, id)) return false;
  const noAutomatico = autoPlayState.ativo;
  notificarSucesso(
    `🏆 ${nomeDaMasmorra(id)} está limpa — ${prog.bausTotal} baús e o chefe.` +
    (noAutomatico ? " Voltando à superfície…" : " A saída está liberada quando você quiser."),
    4200,
  );
  return noAutomatico;
}

// A saída não pode acontecer no meio da tela de batalha: `sairDaMasmorra`
// recusa (com razão) enquanto a batalha está aberta, e o chefe morre COM a
// tela ainda aberta — o jogador ainda vai clicar em "Continuar". Então a
// saída fica pendente e tenta de novo até a tela fechar.
// VAIVÉM DE MASMORRA — a trava que faltava.
//
// Sair de uma masmorra devolve o herói a `entrance.x - 1`: uma casa da
// porta. No tick seguinte, a entrada volta à lista de alvos valendo 90 a
// UMA casa de distância (pontuação 89) — nenhum baú do outro lado do mapa
// chega perto disso. O automático reentrava na hora. Lá dentro, qualquer
// missão do mundo externo vira "volte à superfície" (132), ele caminhava
// até a saída, saía… e reentrava. Medido: 9 travessias em 40 segundos, sem
// nada sendo concluído.
//
// `masmorraEmEspera` não cobria o caso, porque só vale para masmorra
// CONCLUÍDA — o vaivém acontecia justamente com a masmorra pela metade.
//
// A carência resolve a causa sem esconder o sintoma: a masmorra que o herói
// acabou de deixar para de ser alvo automático por um tempo, e volta a
// valer assim que ele se afasta de verdade (12 casas) ou o prazo vence. O
// jogador pisando na porta continua entrando na hora — isto não bloqueia a
// transição, só a INTENÇÃO da IA.
const CARENCIA_REENTRADA_MS = 45000;
const DISTANCIA_QUE_LIBERA_REENTRADA = 12;
let masmorraDeixadaAgora = { id: null, em: 0 };

function registrarSaidaDeMasmorra(id) {
  if (id && id !== "overworld") masmorraDeixadaAgora = { id, em: Date.now() };
}

function masmorraAceitaEntradaAutomatica(id) {
  if (masmorraEmEspera(mundo, id)) return false;
  if (masmorraDeixadaAgora.id !== id) return true;
  if (Date.now() - masmorraDeixadaAgora.em >= CARENCIA_REENTRADA_MS) {
    masmorraDeixadaAgora = { id: null, em: 0 };
    return true;
  }
  const entrada = MASMORRAS[id]?.entrance;
  if (entrada) {
    const longe = Math.max(Math.abs(mundo.player.x - entrada.x), Math.abs(mundo.player.y - entrada.y));
    if (longe >= DISTANCIA_QUE_LIBERA_REENTRADA) {
      masmorraDeixadaAgora = { id: null, em: 0 };
      return true;
    }
  }
  return false;
}

let saidaDeMasmorraPendente = false;
function agendarSaidaDaMasmorra() {
  saidaDeMasmorraPendente = true;
  tentarSaidaPendente();
}
function tentarSaidaPendente() {
  if (!saidaDeMasmorraPendente) return;
  if (mundo.mapaAtual === "overworld") { saidaDeMasmorraPendente = false; return; }
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) { setTimeout(tentarSaidaPendente, 600); return; }
  saidaDeMasmorraPendente = false;
  sairDaMasmorra();
}

function verificarTransicaoMasmorra(x, y) {
  if (mundo.mapaAtual === "overworld") {
    for (const [id, m] of Object.entries(MASMORRAS)) {
      if (x === m.entrance.x && y === m.entrance.y) {
        // Masmorra recém-concluída fica em silêncio por um tempo, igual a um
        // chefe derrotado (ver DungeonSystem.js). Sem isto, "limpei a
        // masmorra" nunca era um evento: dava para reentrar no segundo
        // seguinte e o lugar estava idêntico.
        if (masmorraEmEspera(mundo, id)) {
          mostrarMensagem(textoDeEspera(mundo, id, nomeDaMasmorra(id)), 3200);
          return;
        }
        // Saiu da espera: a masmorra volta cheia (baús fechados, chefe de pé).
        prepararIncursao(id, m);
        mundo.mapaAtual = id;
        mundo.player.x = m.spawn.x;
        mundo.player.y = m.spawn.y;
        marcarTeleporteVisual();
        marcarExploracao(personagem, "entrada_masmorra");
        mostrarMensagem(id === "dungeon2" ? "Você entra no Covil das Cinzas..." : "Você entra na masmorra antiga...");
        return;
      }
    }
  } else {
    const m = MASMORRAS[mundo.mapaAtual];
    if (m && x >= m.exitZone.x0 && x <= m.exitZone.x1 && y >= m.exitZone.y0 && y <= m.exitZone.y1) {
      registrarSaidaDeMasmorra(mundo.mapaAtual);
      mundo.mapaAtual = "overworld";
      mundo.player.x = m.entrance.x - 1;
      mundo.player.y = m.entrance.y;
      marcarTeleporteVisual();
      mostrarMensagem("Você retorna à superfície.");
    }
  }
}

function verificarEncontroAleatorio(grid, x, y) {
  let idsCandidatos;
  let chance;
  if (mundo.mapaAtual === "overworld") {
    const zona = zonaNoPonto(x, y);
    if (!zona || !zona.monstros.length) return;
    idsCandidatos = zona.monstros;
    chance = 0.045;
  } else {
    const masmorra = MASMORRAS[mundo.mapaAtual];
    if (!masmorra) return;
    idsCandidatos = masmorra.monstros;
    chance = 0.06;
  }
  // A chance cai conforme o grupo cresce (ver chanceAjustadaPeloGrupo): o
  // que fica constante é o número de MONSTROS por passo, não o de lutas.
  // Pet de trégua (Lebre, Javali): o bicho vai à frente e o que estava à
  // espreita muda de ideia. Multiplica a chance já ajustada pelo grupo, em
  // vez de somar — assim ele vale o mesmo em qualquer nível.
  const noite = mundo.mapaAtual === "overworld" && ehNoite(Date.now());
  const chanceFinal = chanceAjustadaPeloGrupo(chance, personagem.nivel) * (noite ? 1.55 : 1) * fatorDeTregua(personagem, dados.pets);
  if (deveDispararEncontro(chanceFinal)) {
    const candidatosBase = idsCandidatos.map((id) => dados.monsters.find((m) => m.id === id)).filter(Boolean);
    const candidatos = noite ? candidatosBase.map(reforcarAgressaoNoturna) : candidatosBase;
    // Horda (task #47): 10% dos encontros disparados viram horda — 5 ondas
    // sucessivas do mesmo pool da zona, em vez de 1 grupo só. A "ameaça"
    // pré-combate mostra só a 1ª onda (as próximas só se revelam limpando a
    // anterior), mas leva junto as ondas 2-5 pra Batalha já saber delas.
    if (deveSerHorda(noite ? 0.28 : 0.10)) {
      const levas = sortearLevasHorda(candidatos, 5);
      if (levas.length) {
        levas[0] = aplicarEmboscadaSeAplicavel(levas[0], candidatos);
        iniciarEncontroComAmeaca(levas[0], levas.slice(1));
      }
      return;
    }
    const grupo = aplicarEmboscadaSeAplicavel(sortearEncontroDeLista(candidatos, personagem.nivel), candidatos);
    if (grupo.length) iniciarEncontroComAmeaca(grupo);
    return;
  }
  // Eventos aleatórios de exploração (melhoria pós-backlog, ver
  // ExplorationEventSystem.js/ExplorationEventUI.js): viajante perdido,
  // santuário, ruína, sinal de perigo, achado — só rola quando o encontro
  // de monstro acima NÃO disparou neste passo (chance bem menor e
  // independente), pra nunca empilhar duas interrupções no mesmo passo.
  if (deveDispararEventoExploracao()) {
    const evento = sortearEventoExploracao(dados.explorationEvents, dados.skillChecks, personagem);
    if (evento) mostrarEventoExploracao(evento, personagem, dados, facaoAtual() || "vila", atualizarInterfacePrincipal);
    return;
  }
  // Mercador Itinerante (melhoria pós-backlog, ver
  // TravelingMerchantSystem.js/TravelingMerchantUI.js): vende um catálogo
  // EXCLUSIVO de itens (nunca aparece na loja fixa da vila) — só rola
  // quando NEM o combate NEM o evento de exploração acima dispararam neste
  // passo, com uma chance ainda menor (é pra ser raro topar com ele).
  if (deveAparecerMercador()) {
    const estoque = sortearEstoqueMercador(dados.travelingMerchant);
    if (estoque.length) mostrarMercadorItinerante(estoque, personagem, dados, facaoAtual() || "vila", atualizarInterfacePrincipal);
  }
}

// Emboscada regional (melhoria pós-backlog original): consequência visível
// de reputação muito negativa com a facção regional da zona atual (ver
// WorldStateSystem.js: deveEmboscar) — reforça o grupo do encontro com um
// atacante extra do mesmo pool, vindo dos próprios moradores hostis daquele
// território. `grupo` vazio (pool sem candidatos) passa direto, sem risco
// de gerar uma emboscada "vazia".
function aplicarEmboscadaSeAplicavel(grupo, candidatos) {
  if (!grupo.length) return grupo;
  if (!deveEmboscar(personagem, facaoAtual(), dados.worldStateVariables)) return grupo;
  const extra = candidatos[Math.floor(Math.random() * candidatos.length)];
  if (!extra) return grupo;
  mostrarMensagem("⚔️ Moradores hostis armam uma emboscada contra você!", 3200);
  return [...grupo, reforcarEmboscada(extra)];
}

// Mostra a classificação de ameaça (Trivial..Mortal) antes de entrar em
// batalha, com opção de evitar o combate. Com FLAGS.ameacaPreCombate
// desligada, pula direto para dispararBatalha — comportamento idêntico ao
// que já existia antes deste sistema. `levasExtras` (task #47): ondas 2-5
// de uma horda, ou vazio pra um encontro comum.
function iniciarEncontroComAmeaca(monstrosDef, levasExtras = [], onVitoria) {
  const timeAtual = [personagem, ...membrosDoTime(personagem)];
  // Recusa de encontro Mortal (escolha do jogador: só Mortal, "Perigosa" o
  // automático continua encarando). Vale só pro encontro ALEATÓRIO — chefe
  // já foi filtrado na escolha de alvo por chefeMortalDemais(), justamente
  // pra não virar um vai-e-volta na frente dele.
  if (
    autoPlayState.ativo &&
    autoCuidarDoTime() &&
    !monstrosDef.some((m) => m && m.chefe) &&
    deveEvitarEncontro(timeAtual, monstrosDef)
  ) {
    mostrarMensagem("💀 Automático evitou um encontro Mortal — inimigos muito acima do time.", 3200);
    return;
  }
  // Painéis de configuração podem permanecer abertos enquanto o automático
  // explora. Uma luta aceita é a única interrupção forte: fecha o painel
  // antes da tela de ameaça/batalha para não deixar interfaces competindo.
  // Encontro Mortal evitado acima não fecha nada.
  if (autoPlayState.ativo && !document.getElementById("modal-overlay").classList.contains("hidden")) {
    fecharModal();
  }
  if (!FLAGS.ameacaPreCombate) { dispararBatalha(monstrosDef, levasExtras, onVitoria); return; }
  const time = timeAtual;
  mostrarDesafioAmeaca(monstrosDef, time, dados, () => dispararBatalha(monstrosDef, levasExtras, onVitoria), () => mostrarMensagem("Você fugiu antes que o combate começasse."), terrenoElementoAtual(), levasExtras.length);
}

function iniciarPatrulhaTutorial(indice) {
  if (!document.getElementById('screen-batalha').classList.contains('hidden')) return;
  const inimigo = dados.monsters.find(m => m.id === (indice ? 'morcego' : 'slime'));
  if (!inimigo) return;
  fecharModal();
  dispararBatalha([inimigo]);
}

function dispararBatalha(monstrosDef, levasExtras = [], onVitoria) {
  registrarCombateTutorial(personagem, 'inicio');
  document.getElementById("hud").classList.add("hidden");
  const tela = document.getElementById("screen-batalha");
  tela.classList.remove("hda-batalha-saida");
  tela.classList.add("hda-batalha-entrada");
  setTimeout(() => tela.classList.remove("hda-batalha-entrada"), 380);
  const membrosExtras = membrosDoTime(personagem);
  const clima = climaAtual();
  // Snapshot de ouro pra alimentar o resumo do automático (item 16) — ouro
  // só cresce/diminui por soma direta (nunca "dá a volta"), então diferença
  // simples é segura. XP é registrado à parte, direto em BattleUI.js (ver
  // ganharXP), porque `personagem.xp` reinicia a cada level up e uma
  // diferença aqui pegaria esse reinício como perda de XP.
  const ouroAntes = personagem.ouro;
  // Item 98 de 100_melhorias.md: início/duração/composição/resultado de
  // cada batalha, só ids e números — nunca nome digitado pelo jogador além
  // do que já é local ao dispositivo dele mesmo.
  const inicioBatalhaMs = Date.now();
  registrarEvento("batalha_inicio", { composicao: [personagem.classeId, ...membrosExtras.map((m) => m.classeId)], nInimigos: monstrosDef.length, ehChefe: monstrosDef.some((m) => m.chefe) });
  // Contexto do cenário: ids REAIS do lugar onde a batalha começou (zona,
  // masmorra, tile pisado, clima). A tela de batalha usa isso pra desenhar o
  // chão com os tiles do próprio mapa e escrever o cabeçalho — nunca inventa
  // região; sem esses dados ela cai em "Campo Aberto".
  const zonaDaBatalha = mundo.mapaAtual === "overworld" ? zonaNoPonto(mundo.player.x, mundo.player.y) : null;
  const gridDaBatalha = gridAtiva();
  const linhaTile = gridDaBatalha && gridDaBatalha[mundo.player.y];
  const contextoCenario = {
    mapaAtual: mundo.mapaAtual,
    zonaId: zonaDaBatalha ? zonaDaBatalha.id : null,
    zonaNome: zonaDaBatalha ? zonaDaBatalha.nome : null,
    zonaDescricao: zonaDaBatalha ? zonaDaBatalha.descricao : null,
    tile: linhaTile ? linhaTile[mundo.player.x] : null,
    climaNome: clima ? clima.nome : null,
    climaIcone: clima ? clima.icone : null,
  };
  iniciarBatalha(tela, imagens, dados, personagem, membrosExtras, monstrosDef, terrenoElementoAtual(), clima ? clima.elementoBonus : null, facaoAtual(), levasExtras, (resultado) => {
    registrarCombateTutorial(personagem, resultado);
    tela.classList.add("hda-batalha-saida");
    setTimeout(() => tela.classList.remove("hda-batalha-saida"), 300);
    document.getElementById("hud").classList.remove("hidden");
    atualizarInterfacePrincipal();
    // Trégua: alguns passos sem sorteio de encontro logo depois da luta
    // (ver EncounterSystem.js). Sem ela, com os grupos maiores, sair de uma
    // batalha e cair na próxima dois passos adiante fazia a masmorra virar
    // um corredor de combate — medido: 86% dos ticks com a tela de batalha
    // aberta e 59 casas visitadas em 443 ticks.
    iniciarTregua();
    // Momento "calmo": a luta acabou, o jogador está de volta ao mundo e tem
    // loot novo na mochila. É a hora certa de sugerir o que fazer com ele
    // (forjar, aprimorar, trocar) — nunca no meio do combate. Vitória apenas:
    // depois de uma derrota o jogador quer voltar a jogar, não ler conselho.
    if (resultado !== "derrota") verificarCartoes("calmo", 2600);
    // RECOMPENSA NA HORA: o abate que fecha a missão paga a missão. Antes, o
    // herói matava o terceiro slime e tinha de atravessar o mapa de volta até
    // o Tobias para receber — num mundo 4× isso são minutos de caminhada
    // entre cumprir o objetivo e sentir que cumpriu.
    if (resultado !== "derrota") entregarMissoesProntas();
    registrarEvento("batalha_fim", { resultado, duracaoMs: Date.now() - inicioBatalhaMs, causa: resultado === "derrota" ? "hp_zerado" : null });
    if (Math.max(0, personagem.ouro - ouroAntes) > 0) registrarEvento("moeda", { fonte: "batalha", valor: Math.max(0, personagem.ouro - ouroAntes) });
    if (autoPlayState.ativo) {
      registrarResultadoBatalhaAuto(resultado);
      registrarGanhosAuto({ ouro: Math.max(0, personagem.ouro - ouroAntes) });
    }
    // Sincroniza o botão Automático do HUD (agora visível de novo) com o
    // estado de autoPlayState.ativo — pode ter sido ligado/desligado pelo
    // atalho "Auto" da própria tela de batalha (ver BattleUI.js), que o HUD
    // não via porque fica escondido durante o combate. Se foi ligado assim
    // (sem passar por alternarModoAutomatico(), que também liga o intervalo
    // de exploração automática), retoma o intervalo aqui pra continuar
    // explorando sozinho depois da luta, igual já acontecia antes.
    const btnAuto = document.getElementById("btn-auto");
    if (btnAuto) {
      btnAuto.classList.toggle("ativo", autoPlayState.ativo);
      btnAuto.textContent = autoPlayState.ativo ? "⏸ Automático" : "▶ Automático (P)";
    }
    if (autoPlayState.ativo && !intervaloAuto) { if (!ligadoAutoEm) ligadoAutoEm = Date.now(); agendarProximoTickAuto(); }
    if (resultado === "derrota") {
      // A aventura nunca termina: o time é resgatado e volta ao assentamento
      // habitado mais próximo do ponto onde caiu (em vez de sempre reaparecer
      // na Vila de Aethra).
      const queda = { x: mundo.player.x, y: mundo.player.y };
      mundo.mapaAtual = "overworld";
      const assentamentos = mundo.gerado?.assentamentos || [];
      const vilaMaisProxima = assentamentos
        .filter((a) => ["VILA", "ALDEIA", "POSTO", "CIDADE"].includes(String(a.categoria || "").toUpperCase()))
        .sort((a, b) => ((a.x - queda.x) ** 2 + (a.y - queda.y) ** 2) - ((b.x - queda.x) ** 2 + (b.y - queda.y) ** 2))[0];
      const casa = vilaMaisProxima ? { x: vilaMaisProxima.x, y: vilaMaisProxima.y } : (mundo.gerado ? mundo.gerado.spawn : OVERWORLD_SPAWN);
      mundo.player.x = casa.x; mundo.player.y = casa.y;
      marcarTeleporteVisual();
      atualizarChunksAtivos();
      mostrarMensagem(`🛟 Você foi resgatado e voltou para ${vilaMaisProxima?.nome || "a Vila de Aethra"}.`, 4200);
    }
    if (personagem.hp <= 0) personagem.hp = 1;
    if (resultado === "vitoria") {
      autoSalvarSeAutomatico();
      if (onVitoria) onVitoria();
    }
  }, contextoCenario);
}

// Ordem de prioridade quando há mais de uma coisa encostada. A fogueira é
// a última de propósito: com um baú e uma fogueira lado a lado, o jogador
// quer abrir o baú. A saída da masmorra vem antes da fogueira e depois do
// resto, igual era antes do índice existir.
const PRIORIDADE_INTERACAO = ["bau", "no", "npc", "chefe", "saida", "descanso"];

const ACAO_TOUCH_POR_TIPO = {
  bau: { icone: "🎁", rotulo: "Abrir" },
  no: { icone: "⛏️", rotulo: "Coletar" },
  npc: { icone: "💬", rotulo: "Conversar" },
  chefe: { icone: "⚔️", rotulo: "Enfrentar" },
  saida: { icone: "🚪", rotulo: "Sair" },
  descanso: { icone: "🔥", rotulo: "Descansar" },
  examinar: { icone: "🔎", rotulo: "Examinar" },
  nenhuma: { icone: "✦", rotulo: "Ação" },
};

// Traduz o objeto de mundo em linguagem de ação. É intencionalmente separado
// de interagir(): consultar o rótulo a cada frame nunca executa nem altera a
// interação, portanto o automático continua com o mesmo fluxo.
function contextoInteracaoProxima() {
  const alvo = objetoInteragivelProximo();
  let tipo = alvo?.tipo || "nenhuma";
  let textoTeclado = alvo ? `Pressione E para ${ACAO_TOUCH_POR_TIPO[tipo]?.rotulo.toLowerCase() || "interagir"}` : null;
  if (!alvo) {
    const local = localDaInvestigacao();
    if (podeInvestigarElric(personagem, local) || podeExaminarPortaAltaverde(personagem, local)) {
      tipo = "examinar";
      textoTeclado = "Pressione E para examinar";
    }
  }
  return { tipo, textoTeclado, ...(ACAO_TOUCH_POR_TIPO[tipo] || ACAO_TOUCH_POR_TIPO.nenhuma) };
}

let ultimaAcaoTouch = "";
function atualizarBotaoAcaoTouch(contexto) {
  const btn = document.getElementById("touch-acao");
  if (!btn) return;
  const chave = `${contexto.tipo}:${contexto.icone}:${contexto.rotulo}`;
  if (chave === ultimaAcaoTouch) return;
  ultimaAcaoTouch = chave;
  btn.dataset.acao = contexto.tipo;
  btn.setAttribute("aria-label", contexto.tipo === "nenhuma" ? "Ação contextual; aproxime-se de algo" : contexto.rotulo);
  const icone = btn.querySelector(".touch-acao-icone");
  const rotulo = btn.querySelector(".touch-acao-rotulo");
  if (icone) icone.textContent = contexto.icone;
  if (rotulo) rotulo.textContent = contexto.rotulo;
}

// Agora consulta só os chunks que o quadrado de raio 1 encosta (ver
// ChunkSystem.js), em vez de varrer as listas inteiras do mundo. A ordem de
// prioridade acima é aplicada explicitamente — antes ela era implícita na
// sequência dos `if`s, o que dava no mesmo mas não estava escrito em lugar
// nenhum.
function objetoInteragivelProximo() {
  const indice = indiceAtivo();
  if (!indice) return null;
  const p = mundo.player;
  let melhor = null;
  let melhorPeso = Infinity;
  for (const f of objetosNoRaioDeTiles(indice, p.x, p.y, 1)) {
    if (f.tipo === "bau" && f.ref.aberto) continue;
    if (f.tipo === "no" && !f.ref.disponivel) continue;
    if (f.tipo === "chefe" && !chefeDisponivel(f.ref)) continue;
    if (f.tipo === "entrada") continue; // entrada de masmorra é por pisar em cima, não por E
    const peso = PRIORIDADE_INTERACAO.indexOf(f.tipo);
    if (peso === -1 || peso >= melhorPeso) continue;
    melhorPeso = peso;
    melhor = { tipo: f.tipo, ref: f.ref };
  }
  return melhor;
}

// Equipamento automático (pedido do jogador): chamado depois de QUALQUER
// entrada de item na mochila. Só preenche slot vazio — nunca substitui
// peça que o jogador escolheu (pra isso existe o botão "⚡ Otimizar" no
// inventário). Silencioso quando não há nada a vestir, porque é chamado o
// tempo todo; só avisa na tela quando realmente equipou alguma coisa.
// O equipamento em si é aplicado NA HORA (o estado do jogo nunca fica
// pendurado num timer), mas o aviso na tela espera um instante: quem
// chamou isto acabou de mostrar "Baú aberto! Você encontrou: X", e
// sobrescrever essa mensagem no mesmo frame faria o jogador nunca ler o
// que ganhou.
function equiparAutomatico(atrasoAviso = 1200) {
  if (!personagem) return [];
  const time = [personagem, ...membrosDoTime(personagem)];
  const acoes = autoEquiparSlotsVazios(personagem, time, dados);
  // Slot VAZIO continua sendo preenchido sozinho (não desfaz escolha nenhuma).
  // O que é novo é o passo seguinte: propor a TROCA de uma peça já equipada,
  // que nunca acontece sozinha — vira cartão e o jogador decide.
  verificarCartoes("item", atrasoAviso);
  if (!acoes.length) return acoes;
  atualizarInterfacePrincipal();
  const texto = `🎽 Equipado: ${textoAcoesEquipamento(acoes, personagem)}`;
  if (atrasoAviso > 0) setTimeout(() => mostrarMensagem(texto, 3000), atrasoAviso);
  else mostrarMensagem(texto, 3000);
  return acoes;
}

// PONTO ÚNICO de entrada dos cartões. Recebe o momento ("item", "nivel",
// "calmo") e deixa GatilhosCartao decidir o que cabe ali. O atraso existe
// pelo mesmo motivo do aviso de auto-equipar: quem chamou isto acabou de
// mostrar "Você encontrou X", e um cartão no mesmo quadro cobriria a leitura.
function verificarCartoes(momento, atraso = 900, extras = {}) {
  if (!personagem || !dados) return;
  tiquear(personagem);
  const rodar = () => {
    const time = [personagem, ...membrosDoTime(personagem)];
    const cartoes = gatilhosDoMomento(momento, {
      personagem, time, dados,
      minimo: GANHO_MINIMO_PADRAO,
      ...extras,
      abrir: {
        arvore: () => onHudAction("arvore"),
        caminhos: () => onHudAction("caminhos"),
        forja: (aba) => montarForja(personagem, dados, atualizarInterfacePrincipal, aba),
      },
    });
    cartoes.forEach((c) => enfileirar(personagem, c));
    if (cartoes.length) mostrarProximo();
  };
  if (atraso > 0) setTimeout(rodar, atraso); else rodar();
}


// ABRIR UM BAÚ e COLHER UM NÓ saíram de dentro de interagir().
//
// Não é arrumação: o pet de coleta precisa fazer exatamente a MESMA coisa que
// a tecla E faz — sortear no loot table, rolar o teste de perícia, dar os
// Fragmentos de exploração, registrar o progresso diário, checar se a
// masmorra terminou, salvar. Copiar isso para o sistema de pets criaria dois
// caminhos para "um baú foi aberto", e o dia em que um deles ganhasse mais um
// efeito o outro ficaria para trás em silêncio.
//
// `porQuem` só muda o texto do aviso: "Baú aberto!" quando foi você, "🐾 O
// Ratão Farejador abriu um baú" quando foi o bicho.
function abrirBau(alvo, porQuem = null) {
  alvo.ref.aberto = true;
  const tabela = dados.lootTables[alvo.ref.tier];
  let msgFragmentos = "";
  if (!personagem.locaisExplorados) personagem.locaisExplorados = [];
  // Interesse Exploração: +10% de Fragmentos de baús e nós.
  const fragmentosBau = Math.round(FRAGMENTOS.EXPLORACAO_BAU_RECOMPENSA * multFragmentosExploracao(personagem));
  if (!personagem.locaisExplorados.includes(alvo.ref.id)) {
    personagem.locaisExplorados.push(alvo.ref.id);
    adicionarFragmentos(personagem, fragmentosBau);
    msgFragmentos = ` (+${fragmentosBau} Fragmentos de Aethra)`;
  }
  let msgTeste = "";
  if (tabela) {
    const abencoado = (personagem.bausAbençoados || 0) > 0;
    if (abencoado) personagem.bausAbençoados -= 1;
    const quantidadeBase = alvo.ref.tier === "bau_lendario" ? 3 : alvo.ref.tier === "bau_epico" ? 3 : 2;
    const itensGanhos = [];
    for (let i = 0; i < quantidadeBase + (abencoado ? 1 : 0); i += 1) {
      const sorteado = sortearLoot(tabela.pool, dados.items.itens);
      if (sorteado) itensGanhos.push(sorteado);
    }
    const item = itensGanhos[0];
    if (item) {
      itensGanhos.forEach((ganho) => personagem.inventario.push({ ...ganho, uid: "id_" + Math.random().toString(36).slice(2, 10) }));
      // Teste de perícia opcional (Furtividade): sucesso encontra um item
      // extra no mesmo baú — ver skillChecks.json, contexto "bau".
      const [testeBau] = testesDoContexto(dados.skillChecks, "bau");
      if (testeBau && testeBau.bonusLootSucesso) {
        const r = realizarTeste(personagem, dados, testeBau);
        if (r.sucesso) {
          const extra = sortearLoot(tabela.pool, dados.items.itens);
          if (extra) {
            personagem.inventario.push({ ...extra, uid: "id_" + Math.random().toString(36).slice(2, 10) });
            itensGanhos.push(extra);
            msgTeste = ` 🎲 ${testeBau.textoSucesso} (+${extra.nome})`;
          }
        }
      }
      // Baú também pode conter o item que fecha uma missão de coleta.
      entregarMissoesProntas();
      const ouroBase = { bau_comum: 45, bau_raro: 90, bau_epico: 170, bau_lendario: 300 }[alvo.ref.tier] || 45;
      // Interesse Tesouros: +10% de ouro em baús.
      const ouroGanho = Math.round(ouroBase * (1 + Math.max(0, (personagem.nivel || 1) - 1) * 0.08) * (abencoado ? 1.35 : 1) * multOuroBau(personagem));
      personagem.ouro = (personagem.ouro || 0) + ouroGanho;
      const abertura = porQuem ? `🐾 ${porQuem} abriu um baú e trouxe:`
        : alvo.ref.escondido ? "👁️ Olhos da Floresta: um baú escondido! Você encontrou:"
        : "Baú aberto! Você encontrou:";
      mostrarMensagem(`${abertura} ${itensGanhos.length} itens e ${ouroGanho} de ouro${msgFragmentos}${msgTeste}`, 3600);
      celebrarRecompensa({
        titulo: alvo.ref.tier === "bau_lendario" ? "Tesouro lendário!" : alvo.ref.escondido ? "Baú escondido!" : "Tesouro conquistado!",
        itens: itensGanhos,
        ouro: ouroGanho,
        fragmentos: msgFragmentos ? fragmentosBau : 0,
        abencoado,
      });
    }
  }
  equiparAutomatico(msgTeste ? 4400 : 2400);
  // Este baú pode ter sido o último que faltava — e o chefe já estar
  // morto. A ordem entre baú e chefe não é fixa, então os dois caminhos
  // perguntam a mesma coisa a `checarConclusaoDaMasmorra`.
  if (checarConclusaoDaMasmorra()) agendarSaidaDaMasmorra();
  autoSalvarSeAutomatico();
}

function coletarNo(alvo, porQuem = null) {
  const itemMaterial = dados.items.itens.find((i) => i.id === alvo.ref.tipo);
  let quantidade = 1;
  let msgTeste = "";
  // Teste de perícia opcional (Sobrevivência): sucesso dobra a coleta —
  // ver skillChecks.json, contexto "no".
  const [testeNo] = testesDoContexto(dados.skillChecks, "no");
  if (testeNo && testeNo.bonusColetaSucesso) {
    const r = realizarTeste(personagem, dados, testeNo);
    if (r.sucesso) { quantidade = 2; msgTeste = ` 🎲 ${testeNo.textoSucesso}`; }
  }
  // Interesse Natureza: 10% de chance de colher 1 a mais.
  if (itemMaterial && Math.random() < chanceColheitaExtra(personagem)) {
    quantidade += 1;
    msgTeste += " 🌿 Olho de quem gosta da natureza: +1.";
  }
  if (itemMaterial) {
    registrarColeta(personagem); // contador do destino pessoal (DestinoSystem.js)
    for (let i = 0; i < quantidade; i++) {
      personagem.inventario.push({ ...itemMaterial, uid: "id_" + Math.random().toString(36).slice(2, 10) });
    }
    const colheita = porQuem ? `🐾 ${porQuem} colheu:` : "Você coletou:";
    mostrarMensagem(`${colheita} ${itemMaterial.nome}${quantidade > 1 ? ` x${quantidade}` : ""}!${msgTeste}`, msgTeste ? 4200 : 2200);
    registrarProgressoDiario(personagem, "coleta", quantidade);
    // A última gema entrou na mochila: a missão de coleta fecha aqui mesmo,
    // sem a viagem de volta (ver entregarMissoesProntas).
    entregarMissoesProntas();
  }
  if (!personagem.locaisExplorados) personagem.locaisExplorados = [];
  if (!personagem.locaisExplorados.includes(alvo.ref.id)) {
    personagem.locaisExplorados.push(alvo.ref.id);
    adicionarFragmentos(personagem, Math.round(FRAGMENTOS.EXPLORACAO_NO_RECOMPENSA * multFragmentosExploracao(personagem)));
  }
  alvo.ref.disponivel = false;
  setTimeout(() => { alvo.ref.disponivel = true; }, 25000);
  // Nó de coleta só dá material (erva/minério/madeira), que não é
  // equipável — a chamada fica aqui mesmo assim porque forja e receitas
  // podem transformar isso em peça, e o custo de não achar nada é zero.
  equiparAutomatico(msgTeste ? 4400 : 2400);
  autoSalvarSeAutomatico();
}

function localDaInvestigacao() {
  return { mapaAtual: mundo.mapaAtual, zonaId: mundo.zonaAtualId, x: mundo.player.x, y: mundo.player.y };
}

function interagir() {
  const alvo = objetoInteragivelProximo();
  if (!alvo) {
    const pista = podeExaminarPortaAltaverde(personagem, localDaInvestigacao())
      ? examinarPortaAltaverde(personagem, localDaInvestigacao())
      : investigarElric(personagem, localDaInvestigacao());
    if (pista.ok) mostrarMensagem(pista.texto, 7000);
    return;
  }
  if (alvo.tipo === "bau") {
    abrirBau(alvo);
  } else if (alvo.tipo === "no") {
    coletarNo(alvo);
  } else if (alvo.tipo === "npc") {
    registrarConversaAltaverde(personagem, alvo.ref.id);
    // Conversar deixa marca: o NPC passa a estar em `personagem.npcs` e conta
    // as conversas. É a memória do item 8, e é o que vai para o save.
    if (alvo.ref.regiaoId) {
      registrarConversa(personagem, alvo.ref.id);
      if (Array.isArray(alvo.ref.recorrente) && alvo.ref.regiaoId !== mundo.macroAtualId) {
        registrarEncontroRecorrente(personagem, alvo.ref.id, mundo.macroAtualId);
      }
    }
    montarDialogo(alvo.ref, dados, personagem, atualizarInterfacePrincipal, contextoDeNpc());
  } else if (alvo.tipo === "chefe") {
    const def = dados.monsters.find((m) => m.id === alvo.ref.monstroId);
    // Ao vencer, o chefe some do mapa por RESPAWN_CHEFE_MS antes de renascer —
    // impede que o modo automático reengaje o mesmo chefe na sequência.
    iniciarEncontroComAmeaca([def], [], () => {
      alvo.ref.derrotadoEm = Date.now();
      // O chefe pode ter sido a última coisa que faltava aqui dentro.
      if (checarConclusaoDaMasmorra()) agendarSaidaDaMasmorra();
    });
  } else if (alvo.tipo === "descanso") {
    descansarTime();
  } else if (alvo.tipo === "saida") {
    sairDaMasmorra();
  }
}

// Correção de bug reportado pelo jogador ("entrar numa caverna e não ter
// opção de sair"): a masmorra sempre teve uma saída funcional
// (verificarTransicaoMasmorra(), mais abaixo, dispara ao PISAR no tile de
// m.exitZone), só que sem nenhuma forma de achar/usar isso sem sorte — sem
// marca visual, sem prompt de interação, e Viagem Rápida/Atlas recusam
// funcionar dentro de masmorra de propósito (ver abrirViagemRapida()/
// abrirAtlas()). Esta função dá uma saída garantida e óbvia, sem depender
// de encontrar nenhum tile: botão "Sair da Masmorra" no HUD (sempre visível,
// mesmo padrão de abrirViagemRapida — funciona ou avisa por que não) e
// também chamada por interagir() quando o jogador acha e usa o marcador
// visual da saída (ver objetosAtivos()/objetoInteragivelProximo() acima).
function sairDaMasmorra() {
  if (mundo.mapaAtual === "overworld") { mostrarMensagem("Você já está na superfície."); return; }
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) { mostrarMensagem("Termine ou fuja da batalha antes de sair da masmorra."); return; }
  const m = MASMORRAS[mundo.mapaAtual];
  if (!m) return;
  registrarSaidaDeMasmorra(mundo.mapaAtual);
  mundo.mapaAtual = "overworld";
  mundo.player.x = m.entrance.x - 1;
  mundo.player.y = m.entrance.y;
  marcarTeleporteVisual();
  atualizarChunksAtivos();
  mostrarMensagem("Você retorna à superfície.");
}

const estadosCompanhia = new WeakMap();
document.addEventListener("hda-navegar", (evento) => {
  if (personagem) onHudAction(evento.detail);
});
function abrirCompanhia(aba) {
  let estado = estadosCompanhia.get(personagem);
  if (!estado) {
    estado = { membroIdx: 0, filtro: "todos", busca: "", uidSelecionado: null };
    estadosCompanhia.set(personagem, estado);
  }
  estado.aba = aba;
  estado.abrirEvolucao = () => abrirProgressaoDoHeroi();
  estado.abrirForja = () => onHudAction("forja");
  estado.montarResumo = (corpo, ativo) => preencherPainelEstado(corpo, ativo, dados, contextoEstado());
  montarParty(personagem, [personagem, ...membrosDoTime(personagem)], dados, atualizarInterfacePrincipal, estado);
}

function onHudAction(action) {
  // O `contexto` ({ dados, time }) é o que liga o painel de equipamento
  // automático dentro da tela — sem ele o inventário abre igual a antes.
  if (action === "inventario" || action === "equipamento") abrirCompanhia("mochila");
  else if (action === "party") abrirCompanhia("time");
  else if (action === "missoes") montarMissoes(personagem, dados);
  else if (action === "forja") montarForja(personagem, dados, atualizarInterfacePrincipal);
  else if (action === "salvar") salvarProgresso();
  else if (action === "gacha") montarGacha(personagem, dados, atualizarInterfacePrincipal);
  else if (action === "colecao" || action === "pets") montarGacha(personagem, dados, atualizarInterfacePrincipal, action);
  else if (action === "historico") montarCompendio(personagem, dados, "invocacoes");
  else if (action === "arquivo_missoes") montarCompendio(personagem, dados, "missoes");
  else if (action === "arvore") abrirProgressaoDoHeroi("habilidades");
  else if (action === "caminhos") abrirProgressaoDoHeroi("heranca");
  else if (action === "compendio") montarCompendio(personagem, dados);
  else if (action === "viagem") abrirViagemRapida();
  else if (action === "atlas") abrirAtlas();
  else if (action === "mapa") abrirMapaMundo();
  else if (action === "estado") abrirCompanhia("ficha");
  else if (action === "auto") alternarModoAutomatico();
  else if (action === "acessibilidade") montarAcessibilidade(personagem, () => atualizarHUD(personagem));
  else if (action === "diario") montarDiarioDeDecisoes(personagem, dados);
  else if (action === "descansar") descansarTime();
  else if (action === "sair_masmorra") sairDaMasmorra();
  else if (action === "tutorial") abrirTutorialInicial(personagem, dados, { iniciarEncontro: iniciarPatrulhaTutorial, aoEncerrar: () => salvarProgresso({ silencioso: true }) });
}

// Habilidades de classe, cards equipados e Herança pertencem à mesma etapa
// de progressão. As duas UIs continuam independentes por dentro, mas agora
// compartilham uma navegação única e preservam o mesmo callback de mudança.
function abrirProgressaoDoHeroi(secao = "habilidades") {
  const aoMudar = atualizarInterfacePrincipal;
  const abrirHabilidades = () => montarArvoreHabilidades(personagem, dados, aoMudar, null, { abrirHeranca });
  const abrirHeranca = () => montarCaminhoHerdeiro(personagem, dados, aoMudar, { abrirHabilidades });
  if (secao === "heranca") abrirHeranca();
  else abrirHabilidades();
}

// Descansar (pedido do jogador): restaura HP e MP máximos do time inteiro
// (principal + convocados do gacha) de uma vez, fora de batalha — só
// aparece no HUD, que já fica escondido durante batalha (ver início/fim de
// batalha mais abaixo), então não precisa de guarda extra aqui.
// Descansar deixou de valer em qualquer lugar (pedido do jogador): só numa
// cidade ou ao lado de uma fogueira. Ver RestSystem.js pro porquê — enquanto
// era grátis em qualquer canto, poção não tinha razão de existir e o mundo
// aberto não tinha risco nenhum. Devolve true quando descansou de verdade,
// pra quem chamou saber se precisa tratar a recusa.
function descansarTime({ silencioso = false } = {}) {
  const permissao = podeDescansar({
    zona: mundo.mapaAtual === "overworld" ? zonaNoPonto(mundo.player.x, mundo.player.y) : null,
    pontos: pontosDescansoAtuais(),
    assentamentos: mundo.mapaAtual === "overworld" ? (mundo.gerado?.assentamentos || []) : [],
    x: mundo.player.x,
    y: mundo.player.y,
  });
  if (!permissao.ok) {
    if (!silencioso) mostrarMensagem(`🚫 ${permissao.motivo}`, 4200);
    return false;
  }
  const time = [personagem, ...membrosDoTime(personagem)];
  descansar(time);
  atualizarInterfacePrincipal();
  if (!silencioso) mostrarMensagem(`💤 ${permissao.motivo} HP e MP restaurados.`, 3200);
  return true;
}

// --- Viagem rápida (melhoria de jogabilidade pós-backlog original) --------
// Só disponível no mundo aberto (não faz sentido dentro de masmorra — a
// lista de zonas nem cobre masmorras, ver FastTravelSystem.js). Teleporta
// pro ponto de chegada "ideal" da zona (marco andável ou centro da bbox);
// se por acaso esse ponto cair num tile sólido (bbox central em cima de
// água/árvore/parede em alguma zona), procura em espiral o tile andável
// mais próximo antes de desistir e usar o ponto bruto mesmo assim.
function abrirViagemRapida() {
  if (mundo.mapaAtual !== "overworld") {
    mostrarMensagem("Viagem rápida só funciona no mundo aberto.");
    return;
  }
  // Destinos = LUGARES já descobertos (item 27), não zonas. A contagem do
  // que falta vem do total de pontos declarados menos os liberados, pra o
  // jogador saber que o mapa continua.
  const todos = (mundo.gerado ? mundo.gerado.assentamentos : []).filter((a) => a.viagemRapida);
  const destinos = pontosDeViagemDisponiveis(personagem, mundo.gerado ? mundo.gerado.assentamentos : [], (z) => estadoDaZona(personagem, z));
  const assentamentos = mundo.gerado?.assentamentos || [];
  const barcos = ROTAS_MARITIMAS.flatMap((rota) => [
    { origemId: rota.de, destinoId: rota.para },
    { origemId: rota.para, destinoId: rota.de },
  ].map((sentido) => {
    const origem = assentamentos.find((a) => a.id === sentido.origemId);
    const destino = assentamentos.find((a) => a.id === sentido.destinoId);
    if (!origem || !destino || Math.hypot(mundo.player.x - origem.x, mundo.player.y - origem.y) > origem.raio + 4) return null;
    return { ...rota, origem: origem.nome, destino: destino.nome, destinoId: destino.id };
  }).filter(Boolean));
  montarViagemRapida(personagem, destinos, mundo.zonaAtualId, (id) => viajarParaPonto(id), todos.length - destinos.length,
    barcos, (rota) => {
      if (personagem.ouro < rota.custo) { mostrarMensagem(`Faltam ${rota.custo - personagem.ouro} moedas para a travessia.`, 3200); return; }
      personagem.ouro -= rota.custo;
      viajarParaPonto(rota.destinoId);
      atualizarInterfacePrincipal();
      mostrarMensagem(`⛵ ${rota.nome}: chegada a ${rota.destino}. −${rota.custo} moedas.`, 3600);
    });
}

// Atlas do Mapa-Múndi (mitologia): mesma restrição da viagem rápida — só
// faz sentido no mundo aberto, e viajar a partir de lá reaproveita
// viajarParaZona() (mesmo teleporte + busca de tile andável já usados pela
// Viagem Rápida comum), sem duplicar lógica de movimento.
function abrirAtlas() {
  if (mundo.mapaAtual !== "overworld") {
    mostrarMensagem("O Atlas só pode ser consultado no mundo aberto.");
    return;
  }
  montarAtlas(personagem, ZONAS, mundo.zonaAtualId, (zonaId) => { fecharModal(); viajarParaZona(zonaId); });
}

// O MAPA (tecla U, clique no minimapa, aba Jornada). Diferente do Atlas, que
// é a pintura de lore com hotspots: este é desenhado do mapa de posse real,
// mostra os níveis das regiões e respeita a névoa de guerra. Os dois
// coexistem de propósito — um é ilustração, o outro é instrumento.
// O painel "Como você está" (tecla K). Junta num lugar só o que sete sistemas
// calculavam em silêncio — ver PainelEstadoUI.js. O contexto de mundo (clima,
// hora, zona, eventos ativos) é montado aqui porque só main.js tem acesso a
// `mundo`; a tela não sabe nada sobre o mapa.
function abrirPainelEstado() {
  if (personagem) abrirCompanhia("ficha");
}

function contextoEstado() {
  if (!personagem) return;
  const zona = mundo.mapaAtual === "overworld" ? zonaDoMundoPorId(mundo.zonaAtualId) : null;
  const nivelZona = zona ? faixaDeNivel(zona) : null;
  return {
    time: [personagem, ...membrosDoTime(personagem)],
    clima: climaAtualDaZona(mundo.zonaAtualId, Date.now(), altitudeNoPonto(mundo.player.x, mundo.player.y)),
    hora: horaDoDiaAtual(Date.now()),
    zonaNome: zona ? zona.nome : null,
    zonaNivel: nivelZona ? nivelZona.texto : null,
    // `listarEventosAtivos` devolve IDs crus; o painel mostrava
    // "ev_tempestade_eter_altaverde" ao jogador. `resumoDosEventos` traduz.
    eventosAtivos: resumoDosEventos(personagem, mundo.zonaAtualId),
  };
}

function abrirMapaMundo() {
  if (!personagem) return;
  montarMapaMundo(personagem, {
    mapaAtual: mundo.mapaAtual,
    zonaAtualId: mundo.zonaAtualId,
    jogador: mundo.player,
    objetivoMissao: destinoDaMissaoRastreada({ paraMapaMundo: true }),
    onViajar: (zonaId) => viajarParaZona(zonaId),
  });
}

function encontrarTileAndavelProximo(grid, x, y, raioMax = 6) {
  if (!estaBloqueado(x, y, grid)) return { x, y };
  for (let raio = 1; raio <= raioMax; raio++) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue; // só o anel deste raio
        const nx = x + dx, ny = y + dy;
        if (grid[ny] && grid[ny][nx] !== undefined && !estaBloqueado(nx, ny, grid)) return { x: nx, y: ny };
      }
    }
  }
  return { x, y }; // não achou nada livre por perto — usa o ponto bruto mesmo assim
}

// Viagem para um PONTO (cidade, porto, posto). O teleporte em si continua
// sendo o mesmo de sempre — achar o tile andável mais próximo do alvo —, o
// que mudou é o alvo: a praça de um lugar, e não o centro geométrico de uma
// área.
function viajarParaPonto(pontoId) {
  const ponto = (mundo.gerado ? mundo.gerado.assentamentos : []).find((a) => a.id === pontoId);
  if (!ponto) return;
  const destino = encontrarTileAndavelProximo(mundo.grid, ponto.x, ponto.y);
  mundo.player.x = destino.x;
  mundo.player.y = destino.y;
  marcarTeleporteVisual();
  atualizarChunksAtivos();
  const zona = zonaNoPonto(destino.x, destino.y);
  if (zona) mundo.zonaAtualId = zona.id;
  fecharModal();
  mostrarMensagem(`🧭 Viagem rápida: ${ponto.nome}`, 2600);
  verificarMudancaDeZona(destino.x, destino.y);
}

function viajarParaZona(zonaId) {
  const zona = ZONAS.find((z) => z.id === zonaId);
  if (!zona) return;
  if (zonaId === mundo.zonaAtualId) { mostrarMensagem(`Você já está em ${zona.nome}.`); return; }
  const alvo = pontoDeChegada(zona);
  const destino = encontrarTileAndavelProximo(mundo.grid, alvo.x, alvo.y);
  mundo.player.x = destino.x;
  mundo.player.y = destino.y;
  marcarTeleporteVisual();
  atualizarChunksAtivos();
  mundo.zonaAtualId = zona.id;
  fecharModal();
  mostrarMensagem(`🧭 Viagem rápida: ${zona.nome}`, 2600);
}

// --- Modo automático -------------------------------------------------------
// Explora o mapa sozinho, interage com o que encontra (baús, nós, NPCs —
// aceitando/entregando missões automaticamente), entra em batalhas e deixa
// o combate se resolver sozinho (ver BattleUI.js), e nunca trava: mesmo
// numa derrota, o time só volta pra vila e a aventura continua.
let intervaloAuto = null;
let direcaoAuto = null;
let ultimoNpcInteragido = null;
// NPCs com quem o automático conversou há pouco. A trava de um NPC só
// (`ultimoNpcInteragido`) não bastava na praça da vila, onde o herói nasce
// cercado de 4–6 NPCs: ele falava com A, depois B, e A voltava a valer —
// um rodízio sem fim, sem nunca sair da vila. Cada NPC agora espera
// ESPERA_NPC_AUTO_MS antes de voltar a ser alvo do automático.
const npcsConversadosAuto = new Map();
const memoriaNpcAuto = criarMemoriaNpcAuto();
const ESPERA_NPC_AUTO_MS = 90000;
const npcConversadoHaPouco = (id) => {
  const quando = npcsConversadosAuto.get(id);
  return quando !== undefined && Date.now() - quando < ESPERA_NPC_AUTO_MS;
};
let ligadoAutoEm = null; // item 22 de 100_melhorias.md: timestamp de quando o automático ligou

function alternarModoAutomatico() {
  if (!personagem) return;
  autoPlayState.ativo = !autoPlayState.ativo;
  atualizarBotaoAutoFixo(alternarModoAutomatico);
  const btn = document.getElementById("btn-auto");
  if (btn) {
    btn.classList.toggle("ativo", autoPlayState.ativo);
    btn.textContent = autoPlayState.ativo ? "⏸ Automático" : "▶ Automático (P)";
  }
  if (autoPlayState.ativo) {
    zerarResumoAuto(); // item 16 de 100_melhorias.md: começa a contar do zero a cada vez que liga
    ligadoAutoEm = Date.now(); // item 22: pra calcular tempo total em automático ao desligar
    mostrarMensagem("Modo automático ativado — a aventura continua sozinha.");
    if (!intervaloAuto) agendarProximoTickAuto();
  } else {
    const segundos = ligadoAutoEm ? Math.round((Date.now() - ligadoAutoEm) / 1000) : 0;
    const tempoTxt = segundos >= 60 ? `${Math.floor(segundos / 60)}min ${segundos % 60}s` : `${segundos}s`;
    mostrarMensagem(`Modo automático desativado depois de ${tempoTxt}. Resumo: ${textoResumoAuto()}.`, 5200);
  }
}

// Item 21 de 100_melhorias.md: o automático fora de combate se
// autoagenda (em vez de um setInterval de intervalo fixo) pra reagir na
// hora se o jogador mudar "Velocidade do automático" nas opções de
// acessibilidade enquanto já está rodando, sem precisar desligar e
// religar. 380ms é o mesmo intervalo-base de sempre (multiplicador 1 =
// comportamento idêntico a antes desta opção existir).
function agendarProximoTickAuto() {
  const intervalo = Math.max(80, Math.round(380 * multiplicadorVelocidadeAutoExploracao()));
  intervaloAuto = setTimeout(() => {
    tickAutoPlay();
    if (autoPlayState.ativo) agendarProximoTickAuto();
    else intervaloAuto = null;
  }, intervalo);
}

function autoSalvarSeAutomatico() {
  if (autoPlayState.ativo && personagem) salvarProgresso({ silencioso: true });
}

// Segurança do modo automático (melhoria de jogabilidade #2): interrompe o
// modo automático sozinho quando o HP médio do time cai abaixo do limiar
// escolhido em Acessibilidade (ver AccessibilitySystem.js/
// LIMIARES_HP_AUTOPLAY) — "desligado" (0) nunca interrompe, idêntico ao
// comportamento de antes desta opção existir. Roda FORA de batalha (a
// própria BattleUI.js se resolve sozinha durante o combate em si; aqui só
// evita que o automático ENTRE em outra briga logo depois com o time já
// combalido).
// Autocuidado do automático (ver AutoCareSystem.js pra regra e pro porquê
// de poção vir antes de descanso). Aplica UMA ação por tick e devolve true
// quando fez algo — aí o tick termina aqui: curar É a jogada daquele
// quadro, e o passo seguinte já enxerga o time melhor.
function cuidarDoTimeAutomatico() {
  if (!autoCuidarDoTime() || !personagem) return false;
  const time = [personagem, ...membrosDoTime(personagem)];
  const plano = planejarCuidado(personagem, time);
  if (!plano) return false;

  if (plano.tipo === "pocao") {
    // usarConsumivel devolve {ok:false} se o item sumiu entre planejar e
    // aplicar (venda pela loja aberta noutro tick, por exemplo) — nesse
    // caso não faz nada e deixa o próximo tick replanejar com a mochila
    // real, em vez de mentir "usou poção" numa mensagem.
    if (!usarConsumivel(personagem, plano.item.uid, plano.alvo).ok) return false;
  } else if (plano.tipo === "descanso") {
    // Descanso agora tem lugar (cidade ou fogueira). Se não dá pra descansar
    // AQUI, o cuidado não acontece neste tick — e é de propósito: devolver
    // false deixa o tick seguir pro passo de exploração, que já vai ter a
    // fogueira mais próxima no topo da lista de alvos (ver
    // alvosAutoExploracao). Ou seja, o automático CAMINHA até o descanso em
    // vez de ficar parado repetindo que não consegue.
    if (!descansarTime({ silencioso: true })) return false;
  } else {
    return false; // sem_recurso: quem decide é a regra de parada abaixo
  }

  atualizarInterfacePrincipal();
  mostrarMensagem(textoCuidado(plano, personagem), 2200);
  autoSalvarSeAutomatico();
  return true;
}

// Chefe fora do alcance do time: mesma régua da tela de ameaça
// (ThreatSystem), aplicada ANTES de escolher o alvo. Tratar o chefe aqui, e
// não na hora de entrar na luta, é o que impede o automático de andar até
// ele, recusar, andar de volta e repetir pra sempre — encontro aleatório
// pode ser recusado à vontade porque ele não fica parado no mapa esperando.
// O time está ferido e sem poção? Então a fogueira/cidade mais próxima vira
// o destino do automático. Usa o MESMO planejador do autocuidado pra não
// existirem duas regras de "está na hora de descansar" que possam divergir.
function precisaIrDescansar() {
  if (!autoCuidarDoTime() || !personagem) return false;
  const plano = planejarCuidado(personagem, [personagem, ...membrosDoTime(personagem)]);
  return !!plano && plano.tipo === "descanso";
}

function chefeMortalDemais(ref) {
  if (!autoCuidarDoTime() || !ref || !ref.monstroId || !personagem) return false;
  const def = dados.monsters.find((m) => m.id === ref.monstroId);
  if (!def) return false;
  return deveEvitarEncontro([personagem, ...membrosDoTime(personagem)], [def]);
}

function autoPlayDevePararPorHpBaixo() {
  const limite = limiteHpAutoPlay();
  if (limite <= 0 || !personagem) return false;
  const membros = [personagem, ...membrosDoTime(personagem)];
  if (!membros.length) return false;
  const fracaoMedia = membros.reduce((soma, m) => soma + (m.hpMax ? m.hp / m.hpMax : 1), 0) / membros.length;
  return fracaoMedia < limite;
}

// Uma ação por vez no roteiro da orientação. Mais lento que o tick de 380 ms
// porque cada passo abre painel, invoca ou monta time — coisas que levam
// alguns quadros para aparecer na tela.
const INTERVALO_ORIENTACAO_AUTO_MS = 1100;
let ultimaAcaoOrientacao = 0;

// Por que este passo a passo explícito, e não "clicar no que a orientação
// destacar":
//
// A primeira versão desta correção fazia exatamente isso — clicava em
// `.missao-guia-alvo`. Parecia elegante (segue o mesmo roteiro que o
// jogador vê) e não funcionou: o destaque da etapa "invocar" é
// `#hud-hub-invocar`, que é um BOTÃO DE ALTERNÂNCIA. O primeiro clique
// abria o painel, o segundo fechava, e a orientação continuava apontando
// para ele porque o passo nunca avançava. Medido: 22 cliques em 25 s,
// zero heróis invocados. Clicar no destaque é seguro para o humano, que
// olha a tela; para um laço automático, todo alvo que alterna é um ciclo.
//
// Então o automático persegue o OBJETIVO de cada etapa com controles que
// só empurram numa direção: invocar (grátis) até três heróis, colocar três
// no time, fechar o painel e iniciar a patrulha. As duas vitórias vêm da
// IA de combate, que já existe. "Pular orientação" nunca é clicado — pular
// descartaria as recompensas da missão.
function conduzirOrientacaoAutomatica() {
  const cartao = document.querySelector(".missao-guia");
  if (!cartao || !personagem) return;
  const agora = Date.now();
  if (agora - ultimaAcaoOrientacao < INTERVALO_ORIENTACAO_AUTO_MS) return;
  const visivel = (el) => !!el && !el.hidden && !el.disabled && el.getClientRects().length > 0;
  const noModal = (sel) => [...document.querySelectorAll(sel)].find(visivel) || null;
  const agir = (el) => { ultimaAcaoOrientacao = agora; el.click(); autoSalvarSeAutomatico(); return true; };
  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");

  const gacha = personagem.gacha || {};
  const heroisObtidos = (gacha.personagensObtidos || []).length;
  const noTime = (gacha.timeAtivo || []).length;

  // 1) Três companheiros, usando só as invocações GRÁTIS de iniciante. Se as
  //    grátis acabarem, o automático não gasta o ouro do jogador: segue para
  //    a etapa seguinte com o que tem.
  if (heroisObtidos < 3) {
    const puxar = noModal(".btn-puxar");
    if (puxar) return void agir(puxar);
    const abaIniciante = document.querySelector("#gacha-tab-iniciante");
    if (visivel(abaIniciante) && !abaIniciante.classList.contains("ativa")) return void agir(abaIniciante);
    if (!visivel(abaIniciante)) { ultimaAcaoOrientacao = agora; onHudAction("gacha"); return; }
    return; // aba certa aberta, sem invocação grátis disponível: deixa fluir
  }

  // 2) Três aliados no time. `.btn-time` é a MESMA classe para "Colocar no
  //    time" e "Remover do time" — o botão troca de rótulo no lugar. Clicar
  //    pela classe tirava do time quem tinha acabado de entrar; medido:
  //    o contador oscilando 1 → 0 → 1 por minutos. Por isso o filtro é pelo
  //    rótulo, e só a direção "colocar" interessa.
  if (noTime < 3) {
    const colocar = [...document.querySelectorAll(".btn-time")]
      .find((b) => visivel(b) && /colocar/i.test(b.textContent || ""));
    if (colocar) return void agir(colocar);
    ultimaAcaoOrientacao = agora;
    onHudAction("party");
    return;
  }

  // 3) Com o time pronto, o painel precisa SAIR da tela: enquanto houver um
  //    modal aberto a orientação aponta para o "fechar" e o botão "Iniciar
  //    patrulha" continua escondido.
  if (modalAberto) {
    const fechar = noModal("#modal-conteudo .fechar, #modal-conteudo [aria-label='Fechar']");
    if (fechar) return void agir(fechar);
    ultimaAcaoOrientacao = agora;
    fecharModal();
    return;
  }

  // 4) "Iniciar patrulha" e "Concluir primeira missão" são o mesmo botão do
  //    cartão, e nenhum dos dois alterna. É o único clique que o automático
  //    dá no próprio cartão.
  const acao = cartao.querySelector("button");
  if (visivel(acao)) return void agir(acao);

  // 5) Etapa das batalhas sem nada a clicar: o mundo continua. O herói
  //    explora e luta normalmente, e cada vitória conta para a missão (ver
  //    registrarCombateTutorial) — era exatamente isto que o `return` antigo
  //    impedia.
  autoAndar();
}

// QUEM PULA A ORIENTAÇÃO E LIGA O AUTOMÁTICO JOGAVA O JOGO INTEIRO SOZINHO.
//
// O DEFEITO, MEDIDO: sete minutos de automático numa partida nova em que a
// orientação foi pulada — nível 1 → 5, cinco missões concluídas, a Masmorra
// Antiga limpa, e `gacha.timeAtivo.length` = 0 o tempo todo. O herói fez tudo
// isso lutando sozinho, com três slots de time vazios e as invocações grátis
// de iniciante intocadas.
//
// A causa: montar o time só existia DENTRO de `conduzirOrientacaoAutomatica`,
// que por sua vez só roda enquanto o cartão `.missao-guia` está na tela. Pular
// a orientação apagava o cartão e, com ele, a única rotina que sabia invocar.
//
// Aqui a mesma sequência (invocar grátis → colocar no time → fechar o painel)
// roda sem depender do cartão. Duas travas para não repetir o defeito que o
// automático já teve de abrir e fechar modal em laço:
//   - ORÇAMENTO de tentativas: sem invocação grátis sobrando, o automático
//     desiste de vez na sessão em vez de reabrir o painel para sempre. Ele
//     nunca gasta o ouro do jogador com isso.
//   - o mesmo INTERVALO_ORIENTACAO_AUTO_MS da orientação, para os cliques não
//     atropelarem a animação de abertura do painel.
const ORCAMENTO_MONTAR_TIME = 40;
let tentativasMontarTime = 0;

function montarTimeSemOrientacao() {
  if (!personagem || tentativasMontarTime >= ORCAMENTO_MONTAR_TIME) return false;
  const gacha = personagem.gacha || {};
  const heroisObtidos = (gacha.personagensObtidos || []).length;
  const noTime = (gacha.timeAtivo || []).length;
  if (heroisObtidos >= 3 && noTime >= 3) return false;

  const agora = Date.now();
  if (agora - ultimaAcaoOrientacao < INTERVALO_ORIENTACAO_AUTO_MS) return true;
  const visivel = (el) => !!el && !el.hidden && !el.disabled && el.getClientRects().length > 0;
  const agir = (el) => { tentativasMontarTime += 1; ultimaAcaoOrientacao = agora; el.click(); autoSalvarSeAutomatico(); return true; };
  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");

  if (heroisObtidos < 3) {
    const puxar = [...document.querySelectorAll(".btn-puxar")].find(visivel);
    if (puxar) return agir(puxar);
    const abaIniciante = document.querySelector("#gacha-tab-iniciante");
    if (visivel(abaIniciante) && !abaIniciante.classList.contains("ativa")) return agir(abaIniciante);
    if (!visivel(abaIniciante)) { tentativasMontarTime += 1; ultimaAcaoOrientacao = agora; onHudAction("gacha"); return true; }
    // Painel certo aberto e nenhuma invocação grátis: acabou o que era de
    // graça. Fecha e segue jogando com quem já tem.
    tentativasMontarTime = ORCAMENTO_MONTAR_TIME;
    if (modalAberto) fecharModal();
    return true;
  }

  if (noTime < 3) {
    // `.btn-time` é a MESMA classe de "Colocar no time" e "Remover do time":
    // filtrar pela classe tirava do time quem tinha acabado de entrar.
    const colocar = [...document.querySelectorAll(".btn-time")]
      .find((b) => visivel(b) && /colocar/i.test(b.textContent || ""));
    if (colocar) return agir(colocar);
    if (!document.querySelector(".btn-time")) { tentativasMontarTime += 1; ultimaAcaoOrientacao = agora; onHudAction("party"); return true; }
    tentativasMontarTime = ORCAMENTO_MONTAR_TIME;
  }

  // Time pronto (ou orçamento esgotado): o painel não pode ficar por cima do
  // mundo enquanto o automático caminha.
  if (modalAberto) { ultimaAcaoOrientacao = agora; fecharModal(); return true; }
  return false;
}

function tickAutoPlay() {
  if (!autoPlayState.ativo || !personagem) return;
  // Cena de história e tutorial são leitura: o automático espera o jogador
  // terminar. Sem esta trava ele seguia andando, aceitando diálogos e até
  // entrando em luta POR BAIXO da cena, que continuava aberta por cima de tudo.
  if (cutsceneAberta()) {
    // Com o automático ligado, a cena liga o avanço automático DELA (uma vez
    // por cena: se o jogador desligar, fica desligado). Cena com decisão para
    // na escolha — decidir continua sendo do jogador.
    const btnAutoCena = document.getElementById("cutscene-auto");
    if (btnAutoCena && !btnAutoCena.dataset.ligadoPeloAuto) {
      btnAutoCena.dataset.ligadoPeloAuto = "1";
      if (btnAutoCena.getAttribute("aria-pressed") !== "true") btnAutoCena.click();
    }
    return;
  }
  if (document.body.classList.contains("desafio-encontro-ativo") || document.querySelector(".rolagem-camada")) return;
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) return; // a própria batalha se resolve sozinha (ver BattleUI.js)

  // ORIENTAÇÃO ABERTA: o automático CUMPRE a primeira missão em vez de
  // ficar parado esperando.
  //
  // Antes era `if (tutorialAberto()) return;`. Como o cartão de orientação
  // fica de pé durante toda a primeira missão (invocar → formar → duas
  // batalhas → concluir), ligar o automático numa partida nova não fazia
  // absolutamente nada: o herói não andava, não invocava, não lutava. Quem
  // não descobrisse sozinho o botão "Pular orientação" concluía que o modo
  // automático estava quebrado.
  //
  // A orientação já calcula, a cada 500 ms, qual é o ÚNICO controle certo
  // do passo atual e o destaca com `.missao-guia-alvo`. O automático agora
  // clica exatamente nesse controle — ou seja, segue o próprio roteiro que
  // o jogo está mostrando ao jogador, sem uma segunda máquina de estados
  // que poderia divergir dele. O botão de ação do cartão ("Iniciar
  // patrulha", "Concluir primeira missão") vem primeiro por ser o que faz
  // a etapa avançar.
  //
  // A batalha já saiu acima: durante a luta, quem joga é a IA de combate, e
  // o cartão só descreve o que está acontecendo.
  if (tutorialAberto()) return conduzirOrientacaoAutomatica();
  if (montarTimeSemOrientacao()) return;

  // Os menus laterais são uma camada de configuração, não uma pausa. Enquanto
  // um deles está expandido o herói continua viajando, porém não conversa,
  // coleta nem abre outra interface por cima do que o jogador está ajustando.
  // `mover()` ainda detecta encontros normalmente; a própria entrada na luta
  // é o único fluxo autorizado a recolher o painel.
  const painelLateralAberto = !!document.querySelector(
    ".hud-aba.ativa:not(.hud-aba-auto), .hud-aba[aria-expanded='true']:not(.hud-aba-auto)",
  );
  if (painelLateralAberto) {
    autoAndar({ somenteExploracao: true });
    return;
  }

  // Cuidar vem ANTES de qualquer outra coisa: não adianta abrir baú com o
  // time em pé de guerra. Com a opção ligada (padrão) isso na prática torna
  // a parada por HP baixo logo abaixo inalcançável — de propósito: quem
  // quer que o automático PARE em vez de se curar desliga o autocuidado em
  // Acessibilidade e recupera exatamente o comportamento antigo.
  if (cuidarDoTimeAutomatico()) return;

  if (autoPlayDevePararPorHpBaixo()) {
    alternarModoAutomatico();
    mostrarMensagem("⏸ Automático interrompido: HP do time baixo. Cure o time (poções, descanso na vila) antes de continuar.", 4600);
    return;
  }

  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");
  if (modalAberto) {
    // Caixas narrativas ficam legíveis por quatro segundos. Durante esse
    // período nenhum outro clique automático, evento ou desafio as substitui.
    if (!interacaoAutomaticaPronta()) return;
    const modalRaiz = document.getElementById("modal-conteudo") || document;
    // Entrega vem antes de aceitar outra missão no mesmo NPC. Assim uma
    // recompensa pronta nunca fica escondida atrás de uma nova oferta.
    const entregarRegional = modalRaiz.querySelector(".btn-qr-concluir:not([disabled]):not(.primario):not([data-auto-tentada])");
    if (entregarRegional) { entregarRegional.dataset.autoTentada = 'true'; entregarRegional.click(); autoSalvarSeAutomatico(); return; }
    const entregar = modalRaiz.querySelector(".btn-entregar:not([disabled]):not([data-auto-tentada])");
    if (entregar) { entregar.dataset.autoTentada = 'true'; entregar.click(); autoSalvarSeAutomatico(); return; }

    // Decisões com duas consequências não devem ser escolhidas às cegas. O
    // automático para exatamente neste ponto e deixa o jogador selecionar o
    // desfecho; aceitar e concluir todos os passos sem decisão continua
    // automático depois que a escolha for feita.
    const decisaoRegional = modalRaiz.querySelector(".btn-qr-concluir.primario:not([disabled])");
    if (decisaoRegional) {
      alternarModoAutomatico();
      mostrarMensagem("⏸ Automático pausado: esta missão pede uma escolha narrativa.", 5200);
      return;
    }

    // ACEITA TUDO O QUE ESTE NPC TEM, NA MESMA VISITA.
    //
    // O LOOP QUE ISTO QUEBRA, medido: com o automático ligado numa partida
    // nova, o herói ficou 45 segundos em 11 tiles, todos ao redor da praça.
    // O mecanismo era um ciclo que se realimentava:
    //
    //   1. o automático abre o diálogo e aceita UMA oferta, depois `return`;
    //   2. aceitar muda `estadoDasMissoesDoNpc` (aquela missão vai de
    //      "oferta" para "ativa");
    //   3. `memoriaNpcAuto` é indexada por esse estado — mudou o estado,
    //      a visita anterior deixa de contar e o NPC volta a ser alvo;
    //   4. o NPC está a duas casas e vence qualquer objetivo distante na
    //      régua de pontuação (prioridade − distância), então o herói volta;
    //   5. volta ao passo 1, com uma oferta a menos e nenhum passo dado.
    //
    // A Guarda Helena sozinha tinha QUATRO botões "Aceitar" abertos ao mesmo
    // tempo: quatro voltas à praça antes de o herói poder ir a lugar nenhum.
    //
    // Esvaziando as ofertas de uma vez, o estado do NPC assenta numa visita
    // só e a memória volta a valer. O laço tem teto porque cada clique
    // remonta o diálogo: sem o limite, um botão que reaparece sempre travaria
    // o quadro.
    const LIMITE_OFERTAS = 12;
    let aceitou = false;
    for (let i = 0; i < LIMITE_OFERTAS; i += 1) {
      const raiz = document.getElementById("modal-conteudo") || modalRaiz;
      const aceitar = raiz.querySelector(".btn-aceitar:not([disabled]):not([data-auto-tentada]), .btn-qr-aceitar:not([disabled]):not([data-auto-tentada])");
      if (!aceitar) break;
      aceitar.dataset.autoTentada = "true";
      aceitar.click();
      aceitou = true;
    }
    if (aceitou) { autoSalvarSeAutomatico(); return; }
    const escolha = document.querySelector(".btn-escolha-habilidade");
    if (escolha) { escolha.click(); autoSalvarSeAutomatico(); return; }
    // Evento aleatório de exploração (melhoria pós-backlog): o modo
    // automático sempre tenta a opção "engajada" (ajudar/investigar/tentar
    // o teste de perícia) em vez de simplesmente fechar o modal — igual à
    // tela de ameaça, que sempre luta, pra nunca travar esperando decisão
    // manual. Só cai no fecharModal() genérico abaixo se o botão estiver
    // desabilitado (ex.: sem ouro pro custo mínimo do santuário).
    const eventoExploracao = document.querySelector(".btn-evento-tentar:not([disabled])");
    if (eventoExploracao) { eventoExploracao.click(); autoSalvarSeAutomatico(); return; }
    // Tela de ameaça pré-combate: o modo automático sempre luta (nunca
    // evita combate sozinho), senão nunca ganharia XP nem avançaria.
    const lutar = document.querySelector(".btn-lutar");
    if (lutar) { lutar.click(); return; }
    // Diálogo puramente informativo (ou interação sem ação disponível):
    // depois dos mesmos quatro segundos, fecha de fato. Antes ele ficava
    // preso na tela enquanto o herói continuava andando por baixo.
    const interacaoNarrativa = document.querySelector("#modal-conteudo[data-interacao='true']");
    if (interacaoNarrativa) {
      const npcId = interacaoNarrativa.querySelector('[data-npc-dialogo]')?.dataset.npcDialogo;
      if (npcId) memoriaNpcAuto.registrar(personagem, npcId, estadoDasMissoesDoNpc(npcId));
      fecharModal();
      autoAndar();
      return;
    }
    // Inventário, árvore, Herança e demais painéis de configuração ficam
    // abertos enquanto o mundo anda ao fundo. Nesse estado o automático
    // busca lugares ainda não visitados, sem substituir o painel por diálogos,
    // baús ou lojas. Um encontro aleatório chama iniciarEncontroComAmeaca(),
    // que fecha o painel e entrega a tela ao combate.
    autoAndar({ somenteExploracao: true });
    return;
  }

  // Pontos de árvore parados: o automático gasta sozinho para nunca travar
  // esperando uma decisão manual. A versão anterior sorteava entre as duas
  // opções do tier; com 3 ramos e nós finais que exigem 7 pontos NO MESMO
  // ramo, sortear garantiria três ramos rasos e nenhum nó final. Por isso
  // `escolhaAutomatica` aprofunda sempre o ramo já mais investido.
  const proximoNo = escolhaAutomatica(personagem, dados);
  if (proximoNo) {
    const r = escolherNo(personagem, dados, proximoNo.id);
    if (r.ok) {
      atualizarInterfacePrincipal();
      mostrarMensagem(`🌟 Ponto de habilidade gasto: ${proximoNo.nome} (restam ${r.pontosRestantes})`);
      autoSalvarSeAutomatico();
    }
    return;
  }

  const alvo = objetoInteragivelProximo();
  if (alvo) {
    // Item 23 de 100_melhorias.md: quem ligou "parar antes do chefe" nas
    // opções de acessibilidade prefere decidir manualmente a entrar direto
    // numa luta que pode ser mais dura — desligado (padrão) mantém o
    // automático sempre lutando, igual sempre foi.
    if (alvo.tipo === "chefe" && pararAutoAntesDoChefe()) {
      alternarModoAutomatico();
      mostrarMensagem("⏸ Automático parou: um chefe está por perto. Continue manualmente quando quiser enfrentá-lo.", 5000);
      return;
    }
    // FOGUEIRA: mesma armadilha do NPC, e ela passou batido.
    //
    // Baú e nó de recurso somem depois de usados, então o automático nunca
    // volta neles. NPC não some — por isso existe a trava `ultimoNpcInteragido`
    // logo abaixo. A FOGUEIRA também não some, e ficou sem trava nenhuma:
    // chegando perto de uma, `objetoInteragivelProximo()` a devolvia todo
    // tick, `tentarInteragir()` descansava (mesmo de HP cheio, porque
    // descansar de novo é permitido), o tick terminava ali e `autoAndar()`
    // nunca era chamado. Resultado medido: 44 ticks seguidos parado na
    // mesma casa, com o time de HP cheio.
    //
    // A trava certa aqui não é "já usei esta fogueira" e sim "descansar
    // ainda mudaria alguma coisa?". Com o time inteiro, não muda nada — então
    // o automático passa direto e continua explorando. Isso se resolve
    // sozinho: depois de descansar, o time fica cheio e a condição vira
    // falsa no tick seguinte, sem precisar guardar estado nenhum.
    //
    // Vale só para o automático. No manual, apertar E numa fogueira continua
    // descansando quando o jogador quiser, mesmo de HP cheio.
    if (alvo.tipo === "descanso" && !precisaIrDescansar()) { autoAndar(); return; }

    // NPCs não desaparecem depois de conversar (diferente de baús/nós), então
    // sem essa trava o modo automático ficaria preso conversando pra sempre
    // com o mesmo NPC em vez de seguir explorando. Só conversa de novo depois
    // de se afastar (o alvo deixa de ser encontrado e a trava é liberada).
    if (alvo.tipo === "npc") {
      const eMissao = npcEObjetivoDeMissao(alvo.ref.id);
      const estadoNpc = estadoDasMissoesDoNpc(alvo.ref.id);
      if (memoriaNpcAuto.visitado(personagem, alvo.ref.id, estadoNpc)) { autoAndar(); return; }
      if (!eMissao && (alvo.ref.id === ultimoNpcInteragido || npcConversadoHaPouco(alvo.ref.id))) { autoAndar(); return; }
      ultimoNpcInteragido = alvo.ref.id;
      npcsConversadosAuto.set(alvo.ref.id, Date.now());
      memoriaNpcAuto.registrar(personagem, alvo.ref.id, estadoNpc);
    } else {
      ultimoNpcInteragido = null;
    }
    tentarInteragir();
    return;
  }
  // Alguns objetivos regionais são pontos de investigação sem um sprite
  // interagível. Quando o caminho já trouxe o herói até a área, a IA usa a
  // mesma tecla E do jogador em vez de simplesmente andar de novo.
  const localAuto = localDaInvestigacao();
  if (podeInvestigarElric(personagem, localAuto) || podeExaminarPortaAltaverde(personagem, localAuto)) {
    tentarInteragir();
    autoSalvarSeAutomatico();
    return;
  }
  ultimoNpcInteragido = null;
  autoAndar();
}

// Pontos de interesse do mapa atual, no formato que AutoExploreAI.js
// espera ({x, y, tipo, prioridade}). Este é o único lugar que conhece
// baús/nós/masmorras — o pathfinding não sabe o que é nada disso.
//
// Duas travas anti-loop importantes:
//   - a ENTRADA de masmorra só entra na lista se aquela masmorra ainda tem
//     algo dentro (baú fechado ou chefe disponível). Sem isso o automático
//     entraria e sairia da mesma masmorra vazia pra sempre.
//   - a SAÍDA só entra quando não sobrou mais nada a fazer lá dentro, e com
//     prioridade mínima — é a válvula de escape, não um destino.
function masmorraTemAlgoAFazer(id, m) {
  // Em espera depois de concluída, ou recém-deixada (ver
  // masmorraAceitaEntradaAutomatica): não é destino do automático agora.
  if (!masmorraAceitaEntradaAutomatica(id)) return false;
  // `garantirBausMasmorra` é o MESMO acessor que o índice de chunks usa. Ler
  // `mundo[m.chestsKey]` direto devolvia `undefined` numa partida nova (a
  // lista é criada preguiçosamente), e com isso "a masmorra ainda tem baú?"
  // respondia NÃO desde sempre.
  const baus = garantirBausMasmorra(m);
  if (baus.some((c) => !c.aberto)) return true;
  return chefeDaMasmorraDisponivel(m) && !pararAutoAntesDoChefe() && !chefeMortalDemais(m.boss);
}

// DESTINO PESSOAL (ver DestinoSystem.js): a tarefa do contato de origem e os
// passos da motivação andam sozinhos com o que o jogador já faz. Conferido a
// cada atualização da interface — é barato, são só contadores — e entregue
// aqui porque o XP passa pelo fluxo normal de subir de nível.
function entregarDestinoPessoal() {
  const concluidos = verificarDestino(personagem, dados);
  concluidos.forEach((c) => {
    if (c.xp) {
      const nivelAntes = personagem.nivel;
      const { subiuNivel } = ganharXP(personagem, c.xp);
      subiuNivel.forEach((novoNivel) => { aplicarCrescimento(personagem, dados); concederPontosPorNivel(personagem, novoNivel); });
      if (subiuNivel.length) celebrarNivel(subiuNivel[subiuNivel.length - 1], nivelAntes);
    }
    const premio = textoRecompensa(c.recompensa, dados);
    registrarDecisao(personagem, { icone: c.icone, titulo: `Caminho pessoal: ${c.titulo}`, texto: `${textoObjetivo(c.objetivo)} — concluído. ${premio}.` });
    notificarSucesso(`${c.icone} ${c.titulo} — concluído! ${premio}`, 5200);
  });
}

// Quantos níveis acima do herói uma zona pode estar para o automático ir até
// ela sozinho (ver o filtro no fim da parte do mundo aberto, abaixo).
const FOLGA_NIVEL_AUTO = 3;

// Missões são o plano de navegação mais importante do automático. Antes a
// IA só recebia baús, nós e NPCs genéricos; por isso ela podia aceitar uma
// missão e depois passar minutos explorando sem voltar ao objetivo ou ao
// responsável. Estes pequenos adaptadores transformam o estado narrativo em
// pontos de interesse, sem colocar regra de missão dentro do pathfinding.
function prioridadeMissaoNoNpc(npcId) {
  if (!personagem || !dados) return 0;
  let prioridade = 0;

  // Missões comuns: história principal e entrega pronta têm precedência.
  // Numa missão de entrega quem importa é o DESTINATÁRIO — é ele que fecha a
  // missão, e sem esta linha o automático levava o pacote para sempre.
  dados.quests.filter((q) => q.npcId === npcId || q.npcDestino === npcId).forEach((q) => {
    const ativa = personagem.missoesAtivas?.find((m) => m.id === q.id);
    const concluida = personagem.missoesConcluidas?.includes(q.id);
    if (concluida) return;
    if (q.npcDestino === npcId && q.npcId !== npcId) {
      // Só vale como destino depois de a missão ser aceita; antes disso este
      // NPC não tem nada a ver com ela.
      if (ativa && progressoDaMissao(personagem, q).pronto) prioridade = Math.max(prioridade, PRIORIDADE.missaoEntrega);
      return;
    }
    if (ativa) {
      const pronto = progressoDaMissao(personagem, q).pronto;
      prioridade = Math.max(prioridade, pronto ? PRIORIDADE.missaoEntrega : 0);
      return;
    }
    prioridade = Math.max(prioridade, ehMissaoPrincipal(q) ? PRIORIDADE.missaoOferta + 14 : PRIORIDADE.missaoOferta);
  });

  // Questlines regionais usam outro estado, mas a intenção é a mesma:
  // aceitar um passo disponível e entregar um passo pronto no NPC correto.
  questsOferecidasPor(personagem, npcId).forEach(({ quest, estado }) => {
    if (estado === "ativa") {
      const pronta = progressoObjetivoRegional(personagem, quest.id).pronto;
      // Decisões narrativas não são escolhidas pela IA. O NPC ainda recebe
      // foco para que o automático pare no ponto certo e peça a decisão.
      prioridade = Math.max(prioridade, pronta ? PRIORIDADE.missaoEntrega : 0);
    } else if (estado === "disponivel") {
      prioridade = Math.max(prioridade, PRIORIDADE.missaoOferta);
    }
  });
  return prioridade;
}

function estadoDasMissoesDoNpc(npcId) {
  const comuns = (dados.quests || []).filter(q => q.npcId === npcId).map(q => {
    if (personagem.missoesConcluidas?.includes(q.id)) return `${q.id}:concluida`;
    if (personagem.missoesAtivas?.some(m => m.id === q.id)) {
      return `${q.id}:${progressoDaMissao(personagem, q).pronto ? 'entregar' : 'ativa'}`;
    }
    return `${q.id}:oferta`;
  });
  const regionais = questsOferecidasPor(personagem, npcId).map(({ quest, estado }) =>
    `${quest.id}:${estado}:${estado === 'ativa' && progressoObjetivoRegional(personagem, quest.id).pronto ? 'entregar' : ''}`);
  return [...comuns, ...regionais].sort().join('|');
}

function npcEObjetivoDeMissao(npcId) {
  // Só oferta ou entrega libera uma nova conversa imediata.
  return prioridadeMissaoNoNpc(npcId) > PRIORIDADE.npc;
}

// UM DESTINO JÁ ALCANÇADO QUE NÃO MUDA NADA TRAVAVA A LISTA INTEIRA.
//
// O DEFEITO, MEDIDO: 60 segundos de automático numa partida nova, e o herói
// visitou TRÊS tiles — 183,195 / 182,194 / 182,196. O sorteio de alvos
// (HDA_AUTO_ALVOS) explicou por quê:
//
//   missao tutorial_companhia   dist 1    prioridade 132   <- vencedor eterno
//   missao q4_mercador...       dist 91   prioridade 132
//
// `tutorial_companhia` é `tipo: "tutorial"` — não tem lugar nenhum no mundo.
// Sem nó, sem chefe e sem patrulha, `destinoDeMissao` caía no último recurso
// e devolvia o ponto de chegada da zona "vila", que é exatamente onde o herói
// começa. Distância 1 e prioridade máxima: a régua prioridade − distância
// elegia esse alvo em todo tick, para sempre. `q3_colar_perdido` (coletar
// "gema" na vila, onde não há nó de gema) tinha a mesma forma.
//
// A CORREÇÃO NÃO É POR MISSÃO. Consertar só essas duas no JSON deixaria a
// armadilha armada para a próxima missão que nascer com essa forma. O que se
// conserta aqui é a regra: quando o herói CHEGA num destino de "chegada
// simples" e o progresso da missão não mexe, aquele destino está esgotado e
// sai da lista — até que o progresso mude.
//
// Por que a assinatura de progresso, e não um raio de distância: o teste de
// distância sozinho produz vaivém. O herói larga o alvo esgotado, anda cinco
// casas rumo ao próximo, o alvo velho volta a estar a 5 de distância com
// prioridade 132 e vence de novo o que está a 86. Com a assinatura, o alvo
// só reabre quando algo REAL aconteceu (um rato a menos, uma gema a mais,
// objetivo cumprido) — e aí reabre como entrega, que é o que se quer.
const RAIO_ALVO_ALCANCADO = 4;
const missoesEsgotadasAuto = new Map();

function assinaturaDeProgresso(def) {
  const p = progressoDaMissao(personagem, def);
  return `${p.atual}/${p.meta}:${p.pronto ? 1 : 0}`;
}

function missaoEsgotadaParaOAutomatico(def, destino) {
  if (!destino?.chegadaSimples || destino.pronto) return false;
  const assinatura = assinaturaDeProgresso(def);
  const guardada = missoesEsgotadasAuto.get(def.id);
  if (guardada === assinatura) return true;
  // Mudou o progresso desde que esgotamos: o alvo volta a valer.
  if (guardada !== undefined) missoesEsgotadasAuto.delete(def.id);
  const perto = Math.hypot(destino.x - mundo.player.x, destino.y - mundo.player.y) <= RAIO_ALVO_ALCANCADO;
  if (!perto) return false;
  missoesEsgotadasAuto.set(def.id, assinatura);
  return true;
}

const patrulhasAutomaticas = new WeakMap();

function alvoDeUmaMissaoAutomatica(def) {
  // Missão de tutorial se cumpre invocando, montando time e lutando — não
  // andando. Ela nunca é destino de navegação.
  if (def?.tipo === "tutorial") return null;
  // Caça comum não é interação com o centro da região. Use o mesmo pool
  // de monstros de verificarEncontroAleatorio; chefes mantêm alvo próprio.
  const monstro = dados.monsters.find(m => m.id === def.alvo);
  if (def.tipo === 'matar' && monstro && !monstro.chefe &&
      !progressoDaMissao(personagem, def).pronto &&
      mundo.mapaAtual === (def.mapaAlvo || 'overworld')) {
    let memorias = patrulhasAutomaticas.get(personagem);
    if (!memorias) { memorias = new Map(); patrulhasAutomaticas.set(personagem, memorias); }
    const chave = `${mundo.mapaAtual}:${def.id}`;
    if (!memorias.has(chave)) memorias.set(chave, {});
    const zonaPreferida = zonaPorId(def.zonaAlvo || def.regiao);
    const zonaValida = zonaPreferida?.monstros?.includes(def.alvo) ? zonaPreferida.id : null;
    return {
      tipo: 'missao', missaoId: def.id, prioridade: PRIORIDADE.missaoObjetivo,
      pesoDistancia: 0.8, estadoPatrulha: memorias.get(chave),
      patrulha: (x, y) => {
        if (mundo.mapaAtual !== 'overworld') return !!MASMORRAS[mundo.mapaAtual]?.monstros?.includes(def.alvo);
        const zona = zonaNoPonto(x, y);
        return !!zona?.monstros?.includes(def.alvo) && (!zonaValida || zona.id === zonaValida) &&
          (zona.perigo?.[0] || 0) <= (personagem.nivel || 1) + FOLGA_NIVEL_AUTO;
      },
    };
  }
  const destino = destinoDeMissao(def);
  if (!destino || destino.mapa !== mundo.mapaAtual) return null;
  if (missaoEsgotadaParaOAutomatico(def, destino)) return null;
  // A failed/unchanged hand-in must not keep navigation parked at that NPC.
  if (destino.pronto && mundo.mapaAtual === 'overworld' && def?.npcId &&
      memoriaNpcAuto.visitado(personagem, def.npcId, estadoDasMissoesDoNpc(def.npcId))) return null;
  // Objetivo dentro de masmorra em silêncio (ou recém-deixada) não é destino:
  // andar até a entrada só para levar "volte mais tarde" na cara é a receita
  // do vaivém que o item 3 abaixo corrige.
  const mapaAlvo = def?.mapaAlvo;
  if (!destino.pronto && mundo.mapaAtual === "overworld" && mapaAlvo && mapaAlvo !== "overworld"
      && !masmorraAceitaEntradaAutomatica(mapaAlvo)) return null;
  return {
    x: destino.x,
    y: destino.y,
    tipo: "missao",
    prioridade: destino.pronto ? PRIORIDADE.missaoEntrega : PRIORIDADE.missaoObjetivo,
    pesoDistancia: destino.pronto ? 0.65 : 0.8,
    // Entradas de masmorra são transições por pisar no tile; chefes, baús e
    // NPCs continuam sendo interagidos quando chegamos a uma casa de distância.
    exigeMesmoTile: !destino.pronto && mapaAlvo && mapaAlvo !== "overworld" && mundo.mapaAtual === "overworld",
    missaoId: destino.id,
  };
}

// TODAS as missões ativas viram alvo, não só a rastreada.
//
// O defeito que isto conserta: a navegação automática lia
// `destinoDaMissaoRastreada()`, então só existia UM objetivo de missão por
// vez. Aceitar uma missão nova no caminho trocava o rastreador
// (QuestSystem.iniciarMissao) e o herói abandonava o que estava quase
// terminando para atravessar o mapa atrás da recém-aceita — e, ao chegar
// perto de outro ofertante, trocava de novo. Medido: o herói ia e voltava
// entre duas zonas sem concluir nenhuma das duas.
//
// Com a lista completa, a régua de pontuação (prioridade − distância)
// resolve sozinha: uma entrega pronta vale 178 e uma coleta em curso 132,
// então o que está perto e maduro sai primeiro, sem depender de qual missão
// está com a bússola. O rastreador volta a ser o que o nome diz — a escolha
// do JOGADOR sobre o que a bússola do HUD aponta — e não o trilho da IA.
//
// Deduplicação por tile: dentro de uma masmorra, toda missão do mundo
// externo aponta para a MESMA saída. Sem isto, dez missões ativas virariam
// dez alvos idênticos empilhados.
function alvosDasMissoesAutomaticas() {
  if (!personagem || !dados?.quests) return [];
  const porTile = new Map();
  for (const ativa of personagem.missoesAtivas || []) {
    const def = dados.quests.find((q) => q.id === ativa.id);
    if (!def) continue;
    const alvo = alvoDeUmaMissaoAutomatica(def);
    if (!alvo) continue;
    const chave = alvo.patrulha ? `patrulha:${alvo.missaoId}` : `${alvo.x},${alvo.y}`;
    const anterior = porTile.get(chave);
    if (!anterior || alvo.prioridade > anterior.prioridade) porTile.set(chave, alvo);
  }
  return [...porTile.values()];
}

function alvosAutoExploracao({ somenteExploracao = false } = {}) {
  const alvos = [];
  alvos.push(...alvosDasMissoesAutomaticas());
  // Ferido e sem poção: a fogueira entra na lista com a maior prioridade de
  // todas. Fora desse caso ela nem aparece — não faz sentido o automático
  // ir descansar de HP cheio.
  if (precisaIrDescansar()) {
    pontosDescansoAtuais().forEach((f) => alvos.push({ x: f.x, y: f.y, tipo: "descanso", prioridade: PRIORIDADE.descanso }));
    if (mundo.mapaAtual === "overworld") {
      (mundo.gerado?.assentamentos || []).filter((a) => a.categoria !== "ACAMPAMENTO").forEach((a) => {
        const d = a.descanso || a;
        alvos.push({ x: d.x, y: d.y, tipo: "descanso", prioridade: PRIORIDADE.descanso, pesoDistancia: .35 });
      });
    }
  }
  if (mundo.mapaAtual === "overworld") {
    mundo.chests.forEach((c) => { if (!c.aberto) alvos.push({ x: c.x, y: c.y, tipo: "bau", prioridade: PRIORIDADE.bau }); });
    mundo.nodes.forEach((n) => { if (n.disponivel) alvos.push({ x: n.x, y: n.y, tipo: "no", prioridade: PRIORIDADE.no }); });
    Object.entries(MASMORRAS).forEach(([id, m]) => {
      if (!masmorraTemAlgoAFazer(id, m)) return;
      alvos.push({ x: m.entrance.x, y: m.entrance.y, tipo: "entrada", prioridade: PRIORIDADE.entrada, exigeMesmoTile: true });
    });
    if (!pararAutoAntesDoChefe()) {
      (mundo.gerado ? mundo.gerado.chefes : []).forEach((c) => {
        if (chefeDisponivel(c) && !chefeMortalDemais(c)) alvos.push({ x: c.x, y: c.y, tipo: "chefe", prioridade: PRIORIDADE.chefe });
      });
    }
    // Intenção de exploração: lugares ainda não visitados entram como alvo
    // persistente. A distância pesa menos aqui, para o herói aceitar uma
    // viagem longa, mas baús e masmorras no caminho continuam prioritários.
    const locais = [
      ...(mundo.gerado?.assentamentos || []),
      ...(mundo.gerado?.pois || []),
      ...(mundo.gerado?.landmarks || []),
    ];
    locais.filter((l) => ![NEVOA.DESCOBERTO, NEVOA.DOMINADO].includes(estadoDoLocal(personagem, l.id)))
      .forEach((l) => alvos.push({
        x: l.x, y: l.y, tipo: "explorar", prioridade: PRIORIDADE.explorar,
        pesoDistancia: .18, exigeMesmoTile: false, localId: l.id,
      }));
    ZONAS.filter((z) => ![NEVOA.DESCOBERTO, NEVOA.DOMINADO].includes(estadoDaZona(personagem, z.id)))
      .forEach((z) => {
        const p = pontoDeChegada(z);
        alvos.push({ x: p.x, y: p.y, tipo: "explorar", prioridade: PRIORIDADE.explorar - 4, pesoDistancia: .16, exigeMesmoTile: true, zonaId: z.id });
      });
    // NPC já conversado nesta parada vira alvo inválido — mesma trava que
    // tickAutoPlay() usa pra não ficar preso num diálogo em looping. As
    // posições vêm das vagas que o gerador abriu na praça da vila.
    const vagasAuto = (mundo.gerado && mundo.gerado.vagasNpc) || [];
    const npcsMapa = npcsPosicionados();
    dados.npcs.forEach((n, i) => {
      if (memoriaNpcAuto.visitado(personagem, n.id, estadoDasMissoesDoNpc(n.id))) return;
      const prioridadeMissao = prioridadeMissaoNoNpc(n.id);
      // Um NPC com missão pode voltar a ser procurado mesmo que tenha sido
      // visitado há pouco: a conversa pode ter acabado de abrir a entrega ou
      // o próximo passo da linha narrativa.
      if (!prioridadeMissao && (n.id === ultimoNpcInteragido || npcConversadoHaPouco(n.id))) return;
      const pos = npcsMapa.find((p) => p.id === n.id) || vagasAuto[i % Math.max(1, vagasAuto.length)];
      if (pos) alvos.push({
        x: pos.x,
        y: pos.y,
        tipo: "npc",
        prioridade: prioridadeMissao || PRIORIDADE.npc,
        pesoDistancia: prioridadeMissao ? 0.72 : undefined,
        missaoNpc: !!prioridadeMissao,
      });
    });
    // O automático não leva o time para zona muito acima do nível dele. Sem
    // este filtro, um herói nível 1 ia em ~2 minutos atrás de baú e de lugar
    // novo até zonas Nv. 13–15 — e morria lá. Alvo em zona cujo perigo mínimo
    // passa do nível do herói + FOLGA_NIVEL_AUTO fica de fora e volta a valer
    // quando o time sobe. Descanso e NPC ficam sempre (são a saída do perigo).
    const tetoDeNivel = (personagem?.nivel || 1) + FOLGA_NIVEL_AUTO;
    const perigoMinimo = (alvo) => {
      if (alvo.patrulha) return 0; // o predicado já restringe cada tile por nível
      const z = alvo.zonaId ? ZONAS.find((zz) => zz.id === alvo.zonaId) : zonaNoPonto(alvo.x, alvo.y);
      return z && Array.isArray(z.perigo) ? z.perigo[0] : 0;
    };
    const dentroDoNivel = alvos.filter((alvo) => alvo.tipo === "descanso" || alvo.tipo === "npc" || perigoMinimo(alvo) <= tetoDeNivel);
    alvos.length = 0;
    alvos.push(...dentroDoNivel);
  } else {
    const m = MASMORRAS[mundo.mapaAtual];
    if (!m) return alvos;
    garantirBausMasmorra(m).forEach((c) => { if (!c.aberto) alvos.push({ x: c.x, y: c.y, tipo: "bau", prioridade: PRIORIDADE.bau }); });
    if (chefeDaMasmorraDisponivel(m) && !pararAutoAntesDoChefe() && !chefeMortalDemais(m.boss)) {
      alvos.push({ x: m.boss.x, y: m.boss.y, tipo: "chefe", prioridade: PRIORIDADE.chefe });
    }
    if (!alvos.length) {
      alvos.push({ x: m.exitZone.x0, y: m.exitZone.y0, tipo: "saida", prioridade: PRIORIDADE.saida, exigeMesmoTile: true });
    }
  }
  // Interesses do herói pesam no que o automático escolhe (ver
  // IdentidadeSystem.bonusPrioridadeAuto): quem gosta de tesouros puxa para
  // baú, quem gosta de natureza para nó, quem gosta de histórias para NPC.
  // Um empurrão de 8 a 12 pontos numa régua em que o descanso vale 140 —
  // muda a ordem entre alvos parecidos, nunca passa por cima de descanso.
  alvos.forEach((alvo) => { alvo.prioridade += bonusPrioridadeAuto(personagem, alvo.tipo); });
  return somenteExploracao ? alvos.filter((alvo) => alvo.tipo === "explorar" || alvo.patrulha) : alvos;
}

// Passeio aleatório de antes — continua existindo como PLANO B, pra quando
// não há nenhum alvo alcançável (mapa já limpo, ou tudo atrás de água).
// Nesse caso andar a esmo é de fato o comportamento certo: é assim que o
// automático encontra encontros aleatórios e ganha XP.
function autoAndarAleatorio() {
  const grid = gridAtiva();
  const direcoes = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  if (direcaoAuto) {
    const [dx, dy] = direcaoAuto;
    const nx = mundo.player.x + dx, ny = mundo.player.y + dy;
    if (!estaBloqueado(nx, ny, grid) && Math.random() < 0.75) {
      mover(dx, dy);
      return;
    }
  }
  const opcoes = direcoes.filter(([dx, dy]) => !estaBloqueado(mundo.player.x + dx, mundo.player.y + dy, grid));
  if (!opcoes.length) return;
  direcaoAuto = opcoes[Math.floor(Math.random() * opcoes.length)];
  mover(...direcaoAuto);
}

function autoAndar({ somenteExploracao = false } = {}) {
  const grid = gridAtiva();
  const decisao = decidirPassoExploracao({
    origem: { x: mundo.player.x, y: mundo.player.y },
    alvos: alvosAutoExploracao({ somenteExploracao }),
    // Dimensões tiradas da própria grade, não das constantes por mapa —
    // assim overworld/dungeon1/dungeon2 usam o mesmo caminho de código e
    // uma masmorra nova funciona sem tocar aqui.
    largura: grid[0].length,
    altura: grid.length,
    bloqueado: (x, y) => estaBloqueado(x, y, grid),
  });
  if (decisao) {
    // Guarda a direção também no modo dirigido: se o alvo sumir no tick
    // seguinte (outro jogador não existe, mas um baú pode ter respawnado
    // ou o chefe entrado em cooldown), o plano B continua de onde parou em
    // vez de dar um passo pra trás.
    direcaoAuto = decisao.passo;
    // Movimento automático não passa pelo bloqueio de input manual dos
    // modais. A batalha continua sendo bloqueada acima e mover() ainda
    // aplica colisão, terreno, transições e encontros normalmente.
    mover(decisao.passo[0], decisao.passo[1]);
    return;
  }
  autoAndarAleatorio();
}

boot();
