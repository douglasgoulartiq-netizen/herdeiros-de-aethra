import { carregarDados, carregarTodasImagens } from "./data/loader.js";
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
import { Renderer } from "./render/Renderer.js";
import { ligarAjusteDeViewport, pedirTelaCheiaNoPrimeiroGesto, alternarTelaCheia, emTelaCheia, suportaTelaCheia } from "./systems/ViewportSystem.js";
import { montarCriacaoPersonagem, MOTIVACOES_CRIACAO } from "./ui/CharacterCreationUI.js";
import { atualizarHUD, atualizarIndicadorRecomendacaoTime, mostrarMensagem, notificarSucesso, montarInventario, montarMissoes, montarForja, montarDialogo, fecharModal, montarViagemRapida, montarNavegacao } from "./ui/GameUI.js";
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
import { sortearEncontroDeLista, deveDispararEncontro, deveSerHorda, sortearLevasHorda, reforcarEmboscada, chanceAjustadaPeloGrupo, iniciarTregua } from "./systems/EncounterSystem.js";
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
import { climaAtualDaZona, horaDoDiaAtual } from "./systems/WeatherSystem.js";
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
import { abrirTutorialInicial, tutorialAberto } from "./ui/TutorialUI.js";
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
import { missaoRastreada, progressoDaMissao, textoObjetivoMissao, ehMissaoPrincipal } from "./systems/QuestSystem.js";

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
    atualizarChunksAtivos();
    return { x: mundo.player.x, y: mundo.player.y, mapa: mundo.mapaAtual };
  };
  // Ganchos de diagnóstico da reconstrução do mapa (PASS 2): dão acesso à
  // grade ativa e ao renderer pra um teste poder conferir enquadramento e
  // camada de props sem depender de olhar a imagem.
  window.HDA_GRID = () => gridAtiva();
  window.HDA_PROPS = () => propsAtivos();
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

function destinoDaMissaoRastreada({ paraMapaMundo = false } = {}) {
  if (!personagem || !dados?.quests) return null;
  const rastreada = missaoRastreada(personagem, dados.quests);
  if (!rastreada) return null;
  const { def } = rastreada;
  const progresso = progressoDaMissao(personagem, def);

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
  const alvo = no || chefe || (zonaPorId(zonaId) ? pontoDeChegada(zonaPorId(zonaId)) : null);
  return alvo ? { id: def.id, x: alvo.x, y: alvo.y, mapa: "overworld", nome: def.nome, texto: textoObjetivoMissao(def) } : null;
}

function atualizarGuiaMissao() {
  let guia = document.getElementById("guia-missao");
  const destino = destinoDaMissaoRastreada();
  if (!destino || destino.mapa !== mundo.mapaAtual || !personagem) {
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
  if (clima) {
    const hora = horaDoDiaAtual(Date.now());
    partes.push(`${clima.icone} ${clima.nome}`, `${hora.icone} ${hora.nome}`);
  }
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
    mostrarMensagem("🧭 Você está na Vila de Aethra. Aproxime-se de um morador e pressione E para conversar; as setas movem seu herdeiro.", 6200);
  }

  if (intervaloAutoSave) clearInterval(intervaloAutoSave);
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
      const fase = Date.now() / 920 + [...npc.id].reduce((s, c) => s + c.charCodeAt(0), 0);
      // Passeio curto ao redor do posto lógico. Interação continua centrada
      // no posto e a oscilação fica abaixo de meio tile, então ninguém entra
      // em casa nem desaparece do índice espacial.
      npc.x += Math.sin(fase) * .34;
      npc.y += Math.sin(fase * .63) * .22;
      return npc;
    });
}

// Suaviza o deslocamento visual do jogador entre tiles (o movimento lógico
// continua "encaixado" no grid, usado por toda a lógica do jogo — isso só
// afeta a posição usada para desenhar, dando uma sensação de deslize em vez
// de um "pulo" seco a cada tile). Teleportes (trocar de mapa, derrota etc.)
// são detectados por uma distância grande e resolvidos instantaneamente,
// sem deslizar pela tela inteira.
function atualizarPosicaoRenderizada() {
  const p = mundo.player;
  if (p.renderX === undefined || p.renderY === undefined) {
    p.renderX = p.x;
    p.renderY = p.y;
    return;
  }
  const distX = p.x - p.renderX;
  const distY = p.y - p.renderY;
  const dist = Math.hypot(distX, distY);
  if (dist > 1.01) {
    p.renderX = p.x;
    p.renderY = p.y;
    p.frame = 0;
  } else if (dist > 0.001) {
    // Quatro poses durante toda a interpolação. O código antigo mudava o
    // frame uma vez por tile; como a posição era suavizada, o corpo inteiro
    // deslizava parado e parecia flutuar.
    p.frame = Math.floor(performance.now() / 92) % 4;
    p.renderX += distX * 0.35;
    p.renderY += distY * 0.35;
    if (Math.abs(p.x - p.renderX) < 0.02) p.renderX = p.x;
    if (Math.abs(p.y - p.renderY) < 0.02) p.renderY = p.y;
  } else {
    p.frame = 0;
  }
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
function loopRender(agora = performance.now()) {
  // O mundo segue vivo sob as janelas, mas não precisa redesenhar dezenas de
  // camadas a 60 FPS enquanto o jogador lê inventário/árvore. Este limite
  // reserva a thread principal para os cliques e a rolagem dos painéis.
  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");
  const intervalo = modalAberto ? 120 : 33;
  if (agora - ultimoQuadroMundo < intervalo) {
    requestAnimationFrame(loopRender);
    return;
  }
  ultimoQuadroMundo = agora;
  const grid = gridAtiva();
  mundo.player.spriteKey = personagem.spriteKey;
  atualizarPosicaoRenderizada();
  atualizarRastro();
  const contextoAcao = contextoInteracaoProxima();
  atualizarBotaoAcaoTouch(contextoAcao);
  renderer.desenhar({
    grid,
    alturas: alturasAtivas(),
    player: { ...mundo.player, x: mundo.player.renderX, y: mundo.player.renderY },
    npcs: npcsAtivos(),
    objetos: objetosAtivos(),
    props: propsAtivos(),
    tema: temaAtivo(),
    pet: petParaDesenho(),
    objetivoMissao: destinoDaMissaoRastreada(),
    // No celular o próprio botão contextual conta a ação; repetir uma tarja
    // no canvas cobria o herói. Teclado mantém a dica completa.
    mostrarPronto: document.body.classList.contains("touch") ? null : contextoAcao.textoTeclado,
  });
  // O minimapa sai cedo sozinho quando nada mudou (ver MinimapaUI:
  // `ultimaChave`), então chamá-lo a cada quadro custa uma comparação de
  // string — e é o que garante que ele nunca fica atrasado em relação ao
  // mundo desenhado logo acima.
  atualizarMinimapa();
  atualizarGuiaMissao();
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
    objetivoMissao: destinoDaMissaoRastreada(),
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

  const teclasMovimento = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (teclasMovimento[e.key]) {
    e.preventDefault();
    tentarMover(...teclasMovimento[e.key]);
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

function configurarControlesToque() {
  const ehToque = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (ehToque) {
    document.body.classList.add("touch");
    document.getElementById("touch-controls").classList.remove("hidden");
  }

  const direcoes = [
    ["touch-up", 0, -1], ["touch-down", 0, 1], ["touch-left", -1, 0], ["touch-right", 1, 0],
  ];
  direcoes.forEach(([id, dx, dy]) => {
    const btn = document.getElementById(id);
    let intervalo = null;
    const iniciar = (ev) => {
      ev.preventDefault();
      btn.classList.add("pressionado");
      tentarMover(dx, dy);
      clearInterval(intervalo);
      intervalo = setInterval(() => tentarMover(dx, dy), COOLDOWN_MOVIMENTO);
    };
    const parar = (ev) => {
      if (ev) ev.preventDefault();
      clearInterval(intervalo);
      btn.classList.remove("pressionado");
    };
    btn.addEventListener("touchstart", iniciar, { passive: false });
    btn.addEventListener("touchend", parar);
    btn.addEventListener("touchcancel", parar);
    btn.addEventListener("mousedown", iniciar);
    window.addEventListener("mouseup", parar);
  });

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
function mover(dx, dy) {
  const agora = Date.now();
  const tileAtual = gridAtiva()?.[mundo.player.y]?.[mundo.player.x];
  const atrasoTerreno = tileAtual === TILE.WATER ? 1.55 : tileAtual === TILE.SAND || tileAtual === TILE.MARSH ? 1.18 : 1;
  if (agora - mundo.player.ultimoMovimento < COOLDOWN_MOVIMENTO * atrasoTerreno) return;
  const grid = gridAtiva();
  const nx = mundo.player.x + dx;
  const ny = mundo.player.y + dy;
  if (dx < 0) mundo.player.dir = "esquerda";
  else if (dx > 0) mundo.player.dir = "direita";
  else if (dy < 0) mundo.player.dir = "cima";
  else if (dy > 0) mundo.player.dir = "baixo";

  if (estaBloqueado(nx, ny, grid)) return;
  mundo.player.x = nx;
  mundo.player.y = ny;
  mundo.player.ultimoMovimento = agora;
  mundo.player.frame = mundo.player.frame === 1 ? 3 : 1;

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
        marcarExploracao(personagem, "entrada_masmorra");
        mostrarMensagem(id === "dungeon2" ? "Você entra no Covil das Cinzas..." : "Você entra na masmorra antiga...");
        return;
      }
    }
  } else {
    const m = MASMORRAS[mundo.mapaAtual];
    if (m && x >= m.exitZone.x0 && x <= m.exitZone.x1 && y >= m.exitZone.y0 && y <= m.exitZone.y1) {
      mundo.mapaAtual = "overworld";
      mundo.player.x = m.entrance.x - 1;
      mundo.player.y = m.entrance.y;
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
  const chanceFinal = chanceAjustadaPeloGrupo(chance, personagem.nivel) * fatorDeTregua(personagem, dados.pets);
  if (deveDispararEncontro(chanceFinal)) {
    const candidatos = idsCandidatos.map((id) => dados.monsters.find((m) => m.id === id)).filter(Boolean);
    // Horda (task #47): 10% dos encontros disparados viram horda — 5 ondas
    // sucessivas do mesmo pool da zona, em vez de 1 grupo só. A "ameaça"
    // pré-combate mostra só a 1ª onda (as próximas só se revelam limpando a
    // anterior), mas leva junto as ondas 2-5 pra Batalha já saber delas.
    if (deveSerHorda()) {
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

function dispararBatalha(monstrosDef, levasExtras = [], onVitoria) {
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
  mundo.mapaAtual = "overworld";
  mundo.player.x = m.entrance.x - 1;
  mundo.player.y = m.entrance.y;
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
  else if (action === "tutorial") abrirTutorialInicial(personagem, dados, { aoEncerrar: () => salvarProgresso({ silencioso: true }) });
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
const ESPERA_NPC_AUTO_MS = 90000;
const npcConversadoHaPouco = (id) => {
  const quando = npcsConversadosAuto.get(id);
  return quando !== undefined && Date.now() - quando < ESPERA_NPC_AUTO_MS;
};
let ligadoAutoEm = null; // item 22 de 100_melhorias.md: timestamp de quando o automático ligou

function alternarModoAutomatico() {
  if (!personagem) return;
  autoPlayState.ativo = !autoPlayState.ativo;
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
  if (tutorialAberto()) return;
  if (document.body.classList.contains("desafio-encontro-ativo") || document.querySelector(".rolagem-camada")) return;
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) return; // a própria batalha se resolve sozinha (ver BattleUI.js)

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
    const entregarRegional = modalRaiz.querySelector(".btn-qr-concluir:not([disabled]):not(.primario)");
    if (entregarRegional) { entregarRegional.click(); autoSalvarSeAutomatico(); return; }
    const entregar = modalRaiz.querySelector(".btn-entregar:not([disabled])");
    if (entregar) { entregar.click(); autoSalvarSeAutomatico(); return; }

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

    const aceitar = modalRaiz.querySelector(".btn-aceitar, .btn-qr-aceitar");
    if (aceitar) { aceitar.click(); autoSalvarSeAutomatico(); return; }
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
      if (!eMissao && (alvo.ref.id === ultimoNpcInteragido || npcConversadoHaPouco(alvo.ref.id))) { autoAndar(); return; }
      ultimoNpcInteragido = alvo.ref.id;
      npcsConversadosAuto.set(alvo.ref.id, Date.now());
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
  // Em espera depois de concluída: não há o que fazer lá, nem entrar dá.
  if (masmorraEmEspera(mundo, id)) return false;
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
  dados.quests.filter((q) => q.npcId === npcId).forEach((q) => {
    const ativa = personagem.missoesAtivas?.find((m) => m.id === q.id);
    const concluida = personagem.missoesConcluidas?.includes(q.id);
    if (concluida) return;
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

function npcEObjetivoDeMissao(npcId) {
  // Só oferta ou entrega libera uma nova conversa imediata.
  return prioridadeMissaoNoNpc(npcId) > PRIORIDADE.npc;
}

function alvoDaMissaoAutomatica() {
  const destino = destinoDaMissaoRastreada();
  if (!destino || destino.mapa !== mundo.mapaAtual) return null;
  const def = dados?.quests?.find((q) => q.id === destino.id);
  return {
    x: destino.x,
    y: destino.y,
    tipo: "missao",
    prioridade: destino.pronto ? PRIORIDADE.missaoEntrega : PRIORIDADE.missaoObjetivo,
    pesoDistancia: destino.pronto ? 0.65 : 0.8,
    // Entradas de masmorra são transições por pisar no tile; chefes, baús e
    // NPCs continuam sendo interagidos quando chegamos a uma casa de distância.
    exigeMesmoTile: !destino.pronto && def?.mapaAlvo && def.mapaAlvo !== "overworld" && mundo.mapaAtual === "overworld",
    missaoId: destino.id,
  };
}

function alvosAutoExploracao({ somenteExploracao = false } = {}) {
  const alvos = [];
  const alvoMissao = alvoDaMissaoAutomatica();
  if (alvoMissao) alvos.push(alvoMissao);
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
  return somenteExploracao ? alvos.filter((alvo) => alvo.tipo === "explorar") : alvos;
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
