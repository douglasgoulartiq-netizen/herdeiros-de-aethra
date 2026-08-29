import { carregarDados, carregarTodasImagens } from "./data/loader.js";
import {
  SOLID_TILES, zonaNoPonto, ZONAS,
  buildOverworld, buildDungeon, buildDungeon2, OVERWORLD_W, OVERWORLD_H, DUNGEON_W, DUNGEON_H,
  DUNGEON2_W, DUNGEON2_H,
  CHESTS_OVERWORLD, NODES_OVERWORLD, NPC_POSICOES, DUNGEON_ENTRANCE, DUNGEON_SPAWN,
  DUNGEON_EXIT_ZONE, CHESTS_DUNGEON, BOSS_TILE,
  DUNGEON2_ENTRANCE, DUNGEON2_SPAWN, DUNGEON2_EXIT_ZONE, CHESTS_DUNGEON2, BOSS_TILE2,
} from "./data/worldMap.js";
import { Renderer } from "./render/Renderer.js";
import { montarCriacaoPersonagem } from "./ui/CharacterCreationUI.js";
import { atualizarHUD, mostrarMensagem, montarInventario, montarMissoes, montarForja, montarDialogo, fecharModal, montarViagemRapida } from "./ui/GameUI.js";
import { iniciarBatalha } from "./ui/BattleUI.js";
import { montarGacha } from "./ui/GachaUI.js";
import { montarArvoreHabilidades } from "./ui/SkillTreeUI.js";
import { montarCaminhoHerdeiro } from "./ui/TalentTreeUI.js";
import { montarCompendio } from "./ui/CompendiumUI.js";
import { montarAtlas } from "./ui/AtlasUI.js";
import { mostrarAmeaca } from "./ui/ThreatUI.js";
import { escolhaPendente, aplicarEscolhaArvore } from "./systems/CharacterFactory.js";
import { FLAGS } from "./data/featureFlags.js";
import { sortearEncontroDeLista, deveDispararEncontro, deveSerHorda, sortearLevasHorda, reforcarEmboscada } from "./systems/EncounterSystem.js";
import { sortearLoot, descansar } from "./systems/InventorySystem.js";
import { marcarExploracao } from "./systems/QuestSystem.js";
import { salvarJogo, carregarJogo, existeSave, migrarSave } from "./systems/SaveSystem.js";
import { iniciarLoginGoogle, processarRetornoLogin, usuarioAtual, sair, salvarNaNuvem, carregarDaNuvem } from "./systems/CloudSave.js";
import { estadoGachaInicial, membrosDoTime, adicionarFragmentos, checarConquistas } from "./systems/GachaSystem.js";
import { FRAGMENTOS } from "./data/economyConfig.js";
import { testesDoContexto, realizarTeste } from "./systems/SkillCheckSystem.js";
import { autoPlayState, zerarResumoAuto, registrarResultadoBatalhaAuto, registrarGanhosAuto, textoResumoAuto } from "./systems/AutoPlayState.js";
import { facaoDaZona, deveEmboscar } from "./systems/WorldStateSystem.js";
import { marcarZonaVisitada, pontoDeChegada } from "./systems/FastTravelSystem.js";
import { registrarProgressoDiario } from "./systems/DailyQuestSystem.js";
import { elegivelParaNgPlus, aplicarNewGamePlus } from "./systems/NewGamePlusSystem.js";
import { climaAtualDaZona, horaDoDiaAtual } from "./systems/WeatherSystem.js";
import { montarAcessibilidade, aplicarClassesAcessibilidade } from "./ui/AccessibilityUI.js";
import { limiteHpAutoPlay, multiplicadorVelocidadeAutoExploracao, pararAutoAntesDoChefe } from "./systems/AccessibilitySystem.js";
import { registrarEvento, resumoTelemetria } from "./systems/TelemetrySystem.js";
import { deveDispararEventoExploracao, sortearEventoExploracao } from "./systems/ExplorationEventSystem.js";
import { mostrarEventoExploracao } from "./ui/ExplorationEventUI.js";
import { montarDiarioDeDecisoes } from "./ui/DecisionJournalUI.js";
import { deveAparecerMercador, sortearEstoqueMercador } from "./systems/TravelingMerchantSystem.js";
import { mostrarMercadorItinerante } from "./ui/TravelingMerchantUI.js";

let usuarioLogado = null;
let intervaloAutoSave = null;
let intervaloClima = null; // melhoria pós-backlog: refresh periódico do indicador de clima/hora do dia

const canvas = document.getElementById("game-canvas");
let renderer, imagens, dados;
let personagem = null;

const mundo = {
  mapaAtual: "overworld",
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
  processarRetornoLogin();
  // Acessibilidade (melhoria pós-backlog, ver AccessibilitySystem.js):
  // aplica a preferência salva (tamanho de fonte/alto contraste) já no
  // carregamento, antes de qualquer tela aparecer — sem isso o jogador
  // veria um "flash" da aparência padrão antes de trocar pra preferida.
  aplicarClassesAcessibilidade();
  document.getElementById("btn-acessibilidade").onclick = () => montarAcessibilidade();
  dados = await carregarDados();
  imagens = await carregarTodasImagens(dados);
  renderer = new Renderer(canvas, imagens);

  document.getElementById("btn-novo-jogo").onclick = () => iniciarCriacao();
  if (existeSave()) {
    document.getElementById("btn-continuar").classList.remove("hidden");
    document.getElementById("btn-continuar").onclick = () => continuarJogo();
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
  document.querySelectorAll("#hud-buttons button").forEach((b) => {
    b.addEventListener("click", () => onHudAction(b.dataset.action));
  });
  configurarControlesToque();
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
}

function iniciarCriacao() {
  document.getElementById("screen-boot").classList.add("hidden");
  const tela = document.getElementById("screen-criacao");
  tela.classList.remove("hidden");
  montarCriacaoPersonagem(tela, dados, (p) => {
    personagem = p;
    personagem.gacha = estadoGachaInicial();
    tela.classList.add("hidden");
    iniciarMundo();
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
  mundo.player = salvo.mundo.player;
  mundo.chests = salvo.mundo.chests;
  mundo.nodes = salvo.mundo.nodes;
  mundo.zonaAtualId = salvo.mundo.zonaAtualId || "vila";
  // Mescla por id em vez de substituir o array inteiro: um save antigo não
  // tem os baús secretos adicionados nas masmorras (ver worldMap.js), então
  // qualquer baú novo que exista na definição atual mas não no save vira um
  // baú fechado adicionado ao array salvo, em vez de simplesmente sumir.
  if (salvo.mundo.chestsDungeon) mundo.chestsDungeon = mesclarBaus(salvo.mundo.chestsDungeon, CHESTS_DUNGEON);
  if (salvo.mundo.chestsDungeon2) mundo.chestsDungeon2 = mesclarBaus(salvo.mundo.chestsDungeon2, CHESTS_DUNGEON2);
  document.getElementById("screen-boot").classList.add("hidden");
  iniciarMundo(true);
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
      mapaAtual: mundo.mapaAtual, player: mundo.player, chests: mundo.chests, nodes: mundo.nodes,
      zonaAtualId: mundo.zonaAtualId, chestsDungeon: mundo.chestsDungeon, chestsDungeon2: mundo.chestsDungeon2,
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
const MASMORRAS = {
  dungeon1: {
    build: buildDungeon, entrance: DUNGEON_ENTRANCE, spawn: DUNGEON_SPAWN,
    exitZone: DUNGEON_EXIT_ZONE, chests: CHESTS_DUNGEON, boss: BOSS_TILE,
    gridKey: "gridDungeon", chestsKey: "chestsDungeon", monstros: ["esqueleto", "aranha_gigante"],
    elementoDominante: "sombrio", // terreno: masmorra antiga tomada por mortos-vivos (task #42)
    facaoId: "ordem_dos_arquivistas", // regionalidade: ruína antiga infestada de mortos-vivos (task #44)
  },
  dungeon2: {
    build: buildDungeon2, entrance: DUNGEON2_ENTRANCE, spawn: DUNGEON2_SPAWN,
    exitZone: DUNGEON2_EXIT_ZONE, chests: CHESTS_DUNGEON2, boss: BOSS_TILE2,
    gridKey: "gridDungeon2", chestsKey: "chestsDungeon2",
    monstros: ["gargula", "wyvern", "senhor_da_cinza", "necromante_errante", "troll_das_cavernas", "golem_de_pedra"],
    elementoDominante: "fogo", // terreno: Covil das Cinzas (task #42)
    facaoId: "legiao_das_cinzas", // regionalidade: mesma facção do Covil do Dragão (task #44)
  },
};

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
  return climaAtualDaZona(zona.id, Date.now());
}

// Atualiza o indicador de clima/hora do dia da HUD (melhoria pós-backlog
// original) — chamado ao entrar/trocar de zona e periodicamente (o clima
// muda sozinho com o relógio real, mesmo parado no lugar). Some (fica
// vazio) na vila e dentro de masmorras, onde não há clima.
function atualizarIndicadorClima() {
  const el = document.getElementById("hud-clima");
  if (!el) return;
  const clima = climaAtual();
  const hora = horaDoDiaAtual(Date.now());
  el.textContent = clima ? `${clima.icone} ${clima.nome} · ${hora.icone} ${hora.nome}` : "";
}

function iniciarMundo(jaCarregado = false) {
  mundo.grid = buildOverworld();
  mundo.gridDungeon = buildDungeon();
  mundo.gridDungeon2 = buildDungeon2();
  if (!jaCarregado) {
    mundo.mapaAtual = "overworld";
    mundo.player = { x: 5, y: 5, dir: "baixo", frame: 0, ultimoMovimento: 0 };
    mundo.chests = CHESTS_OVERWORLD.map((c) => ({ ...c }));
    mundo.nodes = NODES_OVERWORLD.map((n) => ({ ...n }));
    mundo.zonaAtualId = "vila";
  } else if (mundo.mapaAtual === "masmorra") {
    mundo.mapaAtual = "dungeon1"; // migração de saves antigos (uma só masmorra)
  }
  if (jaCarregado) reposicionarSePresoEmParede();
  document.getElementById("hud").classList.remove("hidden");
  atualizarHUD(personagem);
  requestAnimationFrame(loopRender);

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
  intervaloClima = setInterval(atualizarIndicadorClima, 15000);
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
    ? { x: 5, y: 5 }
    : (MASMORRAS[mundo.mapaAtual] ? MASMORRAS[mundo.mapaAtual].spawn : { x: 5, y: 5 });
  mundo.player.x = spawn.x;
  mundo.player.y = spawn.y;
}

function gridAtiva() {
  if (mundo.mapaAtual === "overworld") return mundo.grid;
  const masmorra = MASMORRAS[mundo.mapaAtual];
  return masmorra ? mundo[masmorra.gridKey] : mundo.grid;
}

// Tempo que um chefe some do mapa depois de derrotado, antes de "renascer"
// no mesmo ponto — evita que o modo automático entre direto de novo na
// mesma batalha assim que vence (bug reportado: chefe reengajava sem pausa).
const RESPAWN_CHEFE_MS = 30000;
function chefeDisponivel(ref) {
  return !ref.derrotadoEm || (Date.now() - ref.derrotadoEm) >= RESPAWN_CHEFE_MS;
}

function objetosAtivos() {
  const objetos = [];
  if (mundo.mapaAtual === "overworld") {
    mundo.chests.forEach((c) => objetos.push({ x: c.x, y: c.y, imgKey: c.aberto ? "bau_aberto" : "bau_fechado", ref: c, tipo: "bau" }));
    mundo.nodes.forEach((n) => { if (n.disponivel) objetos.push({ x: n.x, y: n.y, imgKey: `no_${n.tipo}`, ref: n, tipo: "no" }); });
    Object.values(MASMORRAS).forEach((m) => {
      objetos.push({ x: m.entrance.x, y: m.entrance.y, imgKey: "entrada_masmorra", ref: m.entrance, tipo: "entrada" });
    });
    // Chefe obrigatório de cada zona do mundo aberto (task #45) — parado num
    // ponto fixo dentro da própria zona, igual à entrada de masmorra: sempre
    // visível e sempre lá, sem sorteio, diferente dos encontros aleatórios.
    // Some do mapa por RESPAWN_CHEFE_MS depois de derrotado (ver chefeDisponivel).
    ZONAS.forEach((z) => {
      if (!z.chefe) return;
      if (!chefeDisponivel(z.chefe)) {
        // Marcador visual de "chefe se recuperando" (melhoria de jogabilidade
        // #1): enquanto o chefe está em cooldown ele NÃO aparece mais como
        // objeto interagível (chefeDisponivel() já barra isso em
        // objetoInteragivelProximo(), sem mudança nenhuma ali) — mas o ponto
        // no mapa não devia simplesmente sumir sem explicação, então
        // continua sendo desenhado, só que com um `tipo` puramente visual
        // que o Renderer trata como "sumido, recuperando" (sem sprite, sem
        // texto de interação). Renderer.js calcula o tempo restante sozinho
        // a partir de `derrotadoEm`/RESPAWN_CHEFE_MS pra não precisar
        // recalcular e repassar isso a cada frame.
        objetos.push({ x: z.chefe.x, y: z.chefe.y, tipo: "chefe_recuperando", ref: z.chefe, respawnMs: RESPAWN_CHEFE_MS });
        return;
      }
      const bossMonstro = dados.monsters.find((mm) => mm.id === z.chefe.monstroId);
      objetos.push({ x: z.chefe.x, y: z.chefe.y, imgKey: bossMonstro ? bossMonstro.sprite : "mob_dragao_jovem", ref: z.chefe, tipo: "chefe" });
    });
  } else {
    const masmorra = MASMORRAS[mundo.mapaAtual];
    if (masmorra) {
      (mundo[masmorra.chestsKey] || (mundo[masmorra.chestsKey] = masmorra.chests.map((c) => ({ ...c })))).forEach((c) =>
        objetos.push({ x: c.x, y: c.y, imgKey: c.aberto ? "bau_aberto" : "bau_fechado", ref: c, tipo: "bau" }));
      if (chefeDisponivel(masmorra.boss)) {
        const bossMonstro = dados.monsters.find((mm) => mm.id === masmorra.boss.monstroId);
        objetos.push({ x: masmorra.boss.x, y: masmorra.boss.y, imgKey: bossMonstro ? bossMonstro.sprite : "mob_dragao_jovem", ref: masmorra.boss, tipo: "chefe" });
      } else {
        // Ver comentário equivalente na ramificação do overworld acima.
        objetos.push({ x: masmorra.boss.x, y: masmorra.boss.y, tipo: "chefe_recuperando", ref: masmorra.boss, respawnMs: RESPAWN_CHEFE_MS });
      }
      // Correção de bug reportado: a saída da masmorra (m.exitZone) sempre
      // funcionou (ver verificarTransicaoMasmorra abaixo), mas era um tile
      // 1x1 sem nenhuma marca visual no meio do labirinto gerado — pro
      // jogador isso é indistinguível de "não ter saída". Reaproveita o
      // mesmo sprite da entrada (mesma ideia de "portal", os dois sentidos)
      // só pra ficar visível e virar um objeto interagível de verdade (ver
      // objetoInteragivelProximo()/interagir() abaixo) — além do botão
      // "Sair da Masmorra" no HUD, que não depende de achar esse tile.
      objetos.push({ x: masmorra.exitZone.x0, y: masmorra.exitZone.y0, imgKey: "entrada_masmorra", ref: masmorra, tipo: "saida" });
    }
  }
  return objetos;
}

function npcsAtivos() {
  if (mundo.mapaAtual !== "overworld") return [];
  return dados.npcs.map((n) => ({ ...n, x: NPC_POSICOES[n.id].x, y: NPC_POSICOES[n.id].y }));
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
  } else if (dist > 0.001) {
    p.renderX += distX * 0.35;
    p.renderY += distY * 0.35;
    if (Math.abs(p.x - p.renderX) < 0.02) p.renderX = p.x;
    if (Math.abs(p.y - p.renderY) < 0.02) p.renderY = p.y;
  }
}

function loopRender() {
  const grid = gridAtiva();
  mundo.player.spriteKey = personagem.spriteKey;
  atualizarPosicaoRenderizada();
  renderer.desenhar({
    grid,
    player: { ...mundo.player, x: mundo.player.renderX, y: mundo.player.renderY },
    npcs: npcsAtivos(),
    objetos: objetosAtivos(),
    mostrarPronto: objetoInteragivelProximo() ? "Pressione E para interagir" : null,
  });
  requestAnimationFrame(loopRender);
}

function estaBloqueado(x, y, grid) {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return true;
  return SOLID_TILES.has(grid[y][x]);
}

function podeJogarNoMundo() {
  if (!personagem) return false;
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
  if (!personagem) return;
  if (e.key === "Escape") { fecharModal(); return; }

  const teclasMovimento = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (teclasMovimento[e.key]) {
    tentarMover(...teclasMovimento[e.key]);
  } else if (e.key.toLowerCase() === "e") {
    tentarInteragir();
  } else if (e.key.toLowerCase() === "i") {
    if (podeJogarNoMundo()) onHudAction("inventario");
  } else if (e.key.toLowerCase() === "m") {
    if (podeJogarNoMundo()) onHudAction("missoes");
  } else if (e.key.toLowerCase() === "f") {
    if (podeJogarNoMundo()) onHudAction("forja");
  } else if (e.key.toLowerCase() === "s") {
    if (podeJogarNoMundo()) onHudAction("salvar");
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
    if (podeJogarNoMundo()) onHudAction("atlas");
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
  if (agora - mundo.player.ultimoMovimento < COOLDOWN_MOVIMENTO) return;
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
  verificarEncontroAleatorio(grid, nx, ny);
}

function verificarMudancaDeZona(x, y) {
  if (mundo.mapaAtual !== "overworld") return;
  const zona = zonaNoPonto(x, y);
  if (zona && zona.id !== mundo.zonaAtualId) {
    mundo.zonaAtualId = zona.id;
    const clima = zona.id === "vila" ? null : climaAtualDaZona(zona.id, Date.now());
    mostrarMensagem(clima ? `📍 ${zona.nome} · ${clima.icone} ${clima.nome}` : `📍 ${zona.nome}`, 2600);
    atualizarIndicadorClima();
  }
  // Viagem rápida (melhoria pós-backlog): pisar numa zona a marca como
  // disponível pra teleporte depois, mesmo que o jogador só tenha passado
  // por ela sem ficar (marcarZonaVisitada é idempotente).
  if (zona) marcarZonaVisitada(personagem, zona.id);
}

function verificarTransicaoMasmorra(x, y) {
  if (mundo.mapaAtual === "overworld") {
    for (const [id, m] of Object.entries(MASMORRAS)) {
      if (x === m.entrance.x && y === m.entrance.y) {
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
  if (deveDispararEncontro(chance)) {
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
    const grupo = aplicarEmboscadaSeAplicavel(sortearEncontroDeLista(candidatos), candidatos);
    if (grupo.length) iniciarEncontroComAmeaca(grupo);
    return;
  }
  // Eventos aleatórios de exploração (melhoria pós-backlog, ver
  // ExplorationEventSystem.js/ExplorationEventUI.js): viajante perdido,
  // santuário, ruína, sinal de perigo, achado — só rola quando o encontro
  // de monstro acima NÃO disparou neste passo (chance bem menor e
  // independente), pra nunca empilhar duas interrupções no mesmo passo.
  if (deveDispararEventoExploracao()) {
    const evento = sortearEventoExploracao(dados.explorationEvents, dados.skillChecks);
    if (evento) mostrarEventoExploracao(evento, personagem, dados, facaoAtual() || "vila", () => atualizarHUD(personagem));
    return;
  }
  // Mercador Itinerante (melhoria pós-backlog, ver
  // TravelingMerchantSystem.js/TravelingMerchantUI.js): vende um catálogo
  // EXCLUSIVO de itens (nunca aparece na loja fixa da vila) — só rola
  // quando NEM o combate NEM o evento de exploração acima dispararam neste
  // passo, com uma chance ainda menor (é pra ser raro topar com ele).
  if (deveAparecerMercador()) {
    const estoque = sortearEstoqueMercador(dados.travelingMerchant);
    if (estoque.length) mostrarMercadorItinerante(estoque, personagem, dados, facaoAtual() || "vila", () => atualizarHUD(personagem));
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
  if (!FLAGS.ameacaPreCombate) { dispararBatalha(monstrosDef, levasExtras, onVitoria); return; }
  const time = [personagem, ...membrosDoTime(personagem)];
  mostrarAmeaca(monstrosDef, time, dados, () => dispararBatalha(monstrosDef, levasExtras, onVitoria), () => mostrarMensagem("Você evitou o combate."), terrenoElementoAtual(), levasExtras.length);
}

function dispararBatalha(monstrosDef, levasExtras = [], onVitoria) {
  document.getElementById("hud").classList.add("hidden");
  const tela = document.getElementById("screen-batalha");
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
  iniciarBatalha(tela, imagens, dados, personagem, membrosExtras, monstrosDef, terrenoElementoAtual(), clima ? clima.elementoBonus : null, facaoAtual(), levasExtras, (resultado) => {
    document.getElementById("hud").classList.remove("hidden");
    atualizarHUD(personagem);
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
      // A aventura nunca termina: o time é resgatado e volta para a vila.
      mundo.mapaAtual = "overworld";
      mundo.player.x = 5; mundo.player.y = 5;
    }
    if (personagem.hp <= 0) personagem.hp = 1;
    if (resultado === "vitoria") {
      autoSalvarSeAutomatico();
      if (onVitoria) onVitoria();
    }
  });
}

function objetoInteragivelProximo() {
  const p = mundo.player;
  const perto = (ox, oy) => Math.max(Math.abs(ox - p.x), Math.abs(oy - p.y)) <= 1;
  if (mundo.mapaAtual === "overworld") {
    const bau = mundo.chests.find((c) => !c.aberto && perto(c.x, c.y));
    if (bau) return { tipo: "bau", ref: bau };
    const no = mundo.nodes.find((n) => n.disponivel && perto(n.x, n.y));
    if (no) return { tipo: "no", ref: no };
    const npc = dados.npcs.find((n) => perto(NPC_POSICOES[n.id].x, NPC_POSICOES[n.id].y));
    if (npc) return { tipo: "npc", ref: npc };
    const zonaChefe = ZONAS.find((z) => z.chefe && chefeDisponivel(z.chefe) && perto(z.chefe.x, z.chefe.y));
    if (zonaChefe) return { tipo: "chefe", ref: zonaChefe.chefe };
  } else {
    const masmorra = MASMORRAS[mundo.mapaAtual];
    if (!masmorra) return null;
    const bau = (mundo[masmorra.chestsKey] || []).find((c) => !c.aberto && perto(c.x, c.y));
    if (bau) return { tipo: "bau", ref: bau };
    if (chefeDisponivel(masmorra.boss) && perto(masmorra.boss.x, masmorra.boss.y)) return { tipo: "chefe", ref: masmorra.boss };
    // Correção de bug: saída interagível (ver objetosAtivos() acima) — "E"
    // perto do marcador também leva de volta à superfície, sem precisar
    // pisar exatamente no tile central de exitZone.
    if (perto(masmorra.exitZone.x0, masmorra.exitZone.y0)) return { tipo: "saida", ref: masmorra };
  }
  return null;
}

function interagir() {
  const alvo = objetoInteragivelProximo();
  if (!alvo) return;
  if (alvo.tipo === "bau") {
    alvo.ref.aberto = true;
    const tabela = dados.lootTables[alvo.ref.tier];
    let msgFragmentos = "";
    if (!personagem.locaisExplorados) personagem.locaisExplorados = [];
    if (!personagem.locaisExplorados.includes(alvo.ref.id)) {
      personagem.locaisExplorados.push(alvo.ref.id);
      adicionarFragmentos(personagem, FRAGMENTOS.EXPLORACAO_BAU_RECOMPENSA);
      msgFragmentos = ` (+${FRAGMENTOS.EXPLORACAO_BAU_RECOMPENSA} Fragmentos de Aethra)`;
    }
    let msgTeste = "";
    if (tabela) {
      const item = sortearLoot(tabela.pool, dados.items.itens);
      if (item) {
        personagem.inventario.push({ ...item, uid: "id_" + Math.random().toString(36).slice(2, 10) });
        // Teste de perícia opcional (Furtividade): sucesso encontra um item
        // extra no mesmo baú — ver skillChecks.json, contexto "bau".
        const [testeBau] = testesDoContexto(dados.skillChecks, "bau");
        if (testeBau && testeBau.bonusLootSucesso) {
          const r = realizarTeste(personagem, dados, testeBau);
          if (r.sucesso) {
            const extra = sortearLoot(tabela.pool, dados.items.itens);
            if (extra) {
              personagem.inventario.push({ ...extra, uid: "id_" + Math.random().toString(36).slice(2, 10) });
              msgTeste = ` 🎲 ${testeBau.textoSucesso} (+${extra.nome})`;
            }
          }
        }
        mostrarMensagem(`Baú aberto! Você encontrou: ${item.nome}${msgFragmentos}${msgTeste}`, msgTeste ? 4200 : 2200);
      }
    }
    autoSalvarSeAutomatico();
  } else if (alvo.tipo === "no") {
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
    if (itemMaterial) {
      for (let i = 0; i < quantidade; i++) {
        personagem.inventario.push({ ...itemMaterial, uid: "id_" + Math.random().toString(36).slice(2, 10) });
      }
      mostrarMensagem(`Você coletou: ${itemMaterial.nome}${quantidade > 1 ? ` x${quantidade}` : ""}!${msgTeste}`, msgTeste ? 4200 : 2200);
      registrarProgressoDiario(personagem, "coleta", quantidade);
    }
    if (!personagem.locaisExplorados) personagem.locaisExplorados = [];
    if (!personagem.locaisExplorados.includes(alvo.ref.id)) {
      personagem.locaisExplorados.push(alvo.ref.id);
      adicionarFragmentos(personagem, FRAGMENTOS.EXPLORACAO_NO_RECOMPENSA);
    }
    alvo.ref.disponivel = false;
    setTimeout(() => { alvo.ref.disponivel = true; }, 25000);
    autoSalvarSeAutomatico();
  } else if (alvo.tipo === "npc") {
    montarDialogo(alvo.ref, dados, personagem, () => atualizarHUD(personagem));
  } else if (alvo.tipo === "chefe") {
    const def = dados.monsters.find((m) => m.id === alvo.ref.monstroId);
    // Ao vencer, o chefe some do mapa por RESPAWN_CHEFE_MS antes de renascer —
    // impede que o modo automático reengaje o mesmo chefe na sequência.
    iniciarEncontroComAmeaca([def], [], () => { alvo.ref.derrotadoEm = Date.now(); });
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
  mostrarMensagem("Você retorna à superfície.");
}

function onHudAction(action) {
  if (action === "inventario") montarInventario(personagem, () => atualizarHUD(personagem));
  else if (action === "missoes") montarMissoes(personagem, dados);
  else if (action === "forja") montarForja(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "salvar") salvarProgresso();
  else if (action === "gacha") montarGacha(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "arvore") montarArvoreHabilidades(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "caminhos") montarCaminhoHerdeiro(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "compendio") montarCompendio(personagem, dados);
  else if (action === "viagem") abrirViagemRapida();
  else if (action === "atlas") abrirAtlas();
  else if (action === "auto") alternarModoAutomatico();
  else if (action === "acessibilidade") montarAcessibilidade();
  else if (action === "diario") montarDiarioDeDecisoes(personagem, dados);
  else if (action === "descansar") descansarTime();
  else if (action === "sair_masmorra") sairDaMasmorra();
}

// Descansar (pedido do jogador): restaura HP e MP máximos do time inteiro
// (principal + convocados do gacha) de uma vez, fora de batalha — só
// aparece no HUD, que já fica escondido durante batalha (ver início/fim de
// batalha mais abaixo), então não precisa de guarda extra aqui.
function descansarTime() {
  const time = [personagem, ...membrosDoTime(personagem)];
  descansar(time);
  atualizarHUD(personagem);
  mostrarMensagem("💤 O time descansou e recuperou todo o HP e MP.");
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
  montarViagemRapida(personagem, ZONAS, mundo.zonaAtualId, (zonaId) => viajarParaZona(zonaId));
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

function viajarParaZona(zonaId) {
  const zona = ZONAS.find((z) => z.id === zonaId);
  if (!zona) return;
  if (zonaId === mundo.zonaAtualId) { mostrarMensagem(`Você já está em ${zona.nome}.`); return; }
  const alvo = pontoDeChegada(zona);
  const destino = encontrarTileAndavelProximo(mundo.grid, alvo.x, alvo.y);
  mundo.player.x = destino.x;
  mundo.player.y = destino.y;
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
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) return; // a própria batalha se resolve sozinha (ver BattleUI.js)

  if (autoPlayDevePararPorHpBaixo()) {
    alternarModoAutomatico();
    mostrarMensagem("⏸ Automático interrompido: HP do time baixo. Cure o time (poções, descanso na vila) antes de continuar.", 4600);
    return;
  }

  const modalAberto = !document.getElementById("modal-overlay").classList.contains("hidden");
  if (modalAberto) {
    const aceitar = document.querySelector(".btn-aceitar");
    if (aceitar) { aceitar.click(); autoSalvarSeAutomatico(); return; }
    const entregar = document.querySelector(".btn-entregar:not([disabled])");
    if (entregar) { entregar.click(); autoSalvarSeAutomatico(); return; }
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
    fecharModal();
    return;
  }

  // Escolha de árvore de habilidade pendente: resolve sozinho (escolhe um
  // dos dois ramos ao acaso) para nunca travar o modo automático esperando
  // uma decisão manual.
  const pendente = escolhaPendente(personagem, dados);
  if (pendente) {
    const escolhido = pendente.opcoes[Math.floor(Math.random() * pendente.opcoes.length)];
    const r = aplicarEscolhaArvore(personagem, dados, escolhido.id);
    if (r.ok) {
      atualizarHUD(personagem);
      mostrarMensagem(`🌟 Habilidade escolhida automaticamente: ${escolhido.nome}`);
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
    // NPCs não desaparecem depois de conversar (diferente de baús/nós), então
    // sem essa trava o modo automático ficaria preso conversando pra sempre
    // com o mesmo NPC em vez de seguir explorando. Só conversa de novo depois
    // de se afastar (o alvo deixa de ser encontrado e a trava é liberada).
    if (alvo.tipo === "npc") {
      if (alvo.ref.id === ultimoNpcInteragido) { autoAndar(); return; }
      ultimoNpcInteragido = alvo.ref.id;
    } else {
      ultimoNpcInteragido = null;
    }
    tentarInteragir();
    return;
  }
  ultimoNpcInteragido = null;
  autoAndar();
}

function autoAndar() {
  const grid = gridAtiva();
  const direcoes = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  if (direcaoAuto) {
    const [dx, dy] = direcaoAuto;
    const nx = mundo.player.x + dx, ny = mundo.player.y + dy;
    if (!estaBloqueado(nx, ny, grid) && Math.random() < 0.75) {
      tentarMover(dx, dy);
      return;
    }
  }
  const opcoes = direcoes.filter(([dx, dy]) => !estaBloqueado(mundo.player.x + dx, mundo.player.y + dy, grid));
  if (!opcoes.length) return;
  direcaoAuto = opcoes[Math.floor(Math.random() * opcoes.length)];
  tentarMover(...direcaoAuto);
}

boot();
