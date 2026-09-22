// Salva e carrega o progresso do jogador no localStorage do navegador.
//
// Versionamento e migração (task #97): antes desta task, cada sistema novo
// que precisava de um campo novo em `personagem` (gacha, árvore de
// habilidades antiga, viagem rápida, NG+, Modo História, e depois Caminhos
// do Herdeiro e a config de IA de auto-batalha) espalhava seu próprio
// `if (!personagem.campo) personagem.campo = valorPadrao` em
// aplicarEstadoSalvo() (main.js) — funcionava, mas cada campo novo exigia
// lembrar de mexer nesse if solto, sem nenhum registro de "que versão do
// save tem o quê". Esses `garantir*` continuam existindo em cada sistema
// (TalentSystem.js/AutoBattleAI.js/etc.) como cinto de segurança — cobrem
// também um personagem criado fora de um load, como um convocado novo do
// gacha —, mas agora TODO save carregado (local ou da nuvem) passa primeiro
// por `migrarSave()`, então o formato mais atual do jogo já está garantido
// antes de qualquer tela usar o save.
import { garantirEstadoCaminho } from "./TalentSystem.js";
import { garantirConfigAutoBatalha } from "./AutoBattleAI.js";
import { estadoGachaInicial } from "./GachaSystem.js";
import { SEMENTE_LEGADO } from "./WorldSeed.js";
import { zonaNoPonto, OVERWORLD_SPAWN, OVERWORLD_W, OVERWORLD_H } from "../data/worldMap.js";
import { macroDaZona } from "../data/worldHierarchy.js";
import { NIVEL_MAXIMO_PERSONAGEM, xpParaNivel } from "./CharacterFactory.js";

const SAVE_KEY = "rpg_pt_save_v1";
const SLOT_PREFIXO = "rpg_pt_save_slot_";
const SLOT_ATIVO_KEY = "rpg_pt_save_slot_ativo";
export const TOTAL_SLOTS_SAVE = 4;

export function slotAtivo() {
  const n = Number(localStorage.getItem(SLOT_ATIVO_KEY) || 1);
  return n >= 1 && n <= TOTAL_SLOTS_SAVE ? n : 1;
}

export function selecionarSlot(numero) {
  const n = Math.max(1, Math.min(TOTAL_SLOTS_SAVE, Number(numero) || 1));
  localStorage.setItem(SLOT_ATIVO_KEY, String(n));
  return n;
}

function chaveDoSlot(numero) { return `${SLOT_PREFIXO}${numero}`; }

function migrarSaveLegadoParaSlots() {
  const antigo = localStorage.getItem(SAVE_KEY);
  if (antigo && !localStorage.getItem(chaveDoSlot(1))) localStorage.setItem(chaveDoSlot(1), antigo);
  // Depois de migrado, o save antigo não pode ressuscitar quando o jogador
  // apagar o Slot 1. A chave única deixa de ser fonte de verdade.
  if (antigo) localStorage.removeItem(SAVE_KEY);
}

export function listarSlots() {
  migrarSaveLegadoParaSlots();
  return Array.from({ length: TOTAL_SLOTS_SAVE }, (_, i) => {
    const numero = i + 1;
    try {
      const raw = localStorage.getItem(chaveDoSlot(numero));
      if (!raw) return { numero, vazio: true };
      const salvo = migrarSave(JSON.parse(raw));
      const p = salvo.personagem || {};
      return { numero, vazio: false, nome: p.nome || "Herdeiro", nivel: p.nivel || 1,
        classeId: p.classeId || "", racaId: p.racaId || "", atualizadoEm: salvo.salvoEm || null,
        missoesConcluidas: Array.isArray(p.missoesConcluidas) ? p.missoesConcluidas.length : 0,
        areasDescobertas: Array.isArray(p.biomaVisitados) ? p.biomaVisitados.length : 0,
        zonaAtualId: salvo.mundo?.zonaAtualId || "",
        ngPlus: Number(p.ngPlus) || 0 };
    } catch (_) { return { numero, vazio: true, corrompido: true }; }
  });
}

// Versão do FORMATO de save (não é versão do jogo) — sobe 1 sempre que um
// campo novo precisa de valor padrão pra um save antigo carregar sem
// quebrar. Cada migração vira uma função NOVA no array MIGRACOES abaixo,
// nunca uma edição numa já existente — o histórico de migrações fica
// preservado e legível, igual um changelog.
export const SAVE_VERSION = 10;

// Versão do LAYOUT do mundo. Diferente de saveVersion: esta sobe quando o
// mapa muda de forma a ponto de uma coordenada antiga não querer dizer mais
// nada. A ETAPA 2 trocou um mundo de 106x72 com 22 zonas retangulares por um
// de 224x176 com 48 territórios orgânicos — a posição (30, 50) existia nos
// dois e apontava para lugares sem nenhuma relação.
export const LAYOUT_MUNDO = 4;

// Mapas que existem hoje. Um `mapaAtual` fora desta lista num save antigo
// significa mapa removido do jogo: o jogador volta pra superfície em vez de
// ficar preso num mapa que não é mais construído.
const MAPAS_CONHECIDOS = new Set(["overworld", "dungeon1", "dungeon2"]);

// Estado de repouso das variáveis regionais da ETAPA 3. "Repouso" é o mundo
// antes de o jogador mexer nele: a vila comendo, o recife vivo, o Coração do
// Vale frio, as passarelas de Thalgor inteiras. Um save que não tem essas chaves não é um
// save de um mundo em crise — é um save de antes de a crise existir.
export const WORLD_STATE_REGIONAL_PADRAO = {
  vila_aethra_estado: "provida",
  recife_estado: "vivo",
  coracao_petrificado_estado: "frio",
  thalgor_passarelas: "inteiras",
  titas_acampamento: "normal",
  maris_doca: "normal",
};

// MIGRACOES[i] leva um save da versão i pra i+1. `salvo.saveVersion`
// ausente conta como versão 0 (o formato mais antigo que existe, de antes
// desta task — sem gacha/árvore/viagem rápida/NG+/Modo História
// garantidos). Cada função deve ser SEGURA de rodar de novo (só preenche o
// que falta, nunca sobrescreve o que já existe), então mesmo que algo
// interrompa o carregamento no meio, rodar a migração de novo do início
// nunca perde ou duplica nada.
const MIGRACOES = [
  // v0 -> v1: os campos que já eram garantidos "na unha" em
  // aplicarEstadoSalvo() antes desta task existir.
  (salvo) => {
    const p = salvo.personagem;
    if (!p.gacha) p.gacha = estadoGachaInicial();
    if (!p.arvore) p.arvore = { escolhas: [] };
    if (!p.biomaVisitados) p.biomaVisitados = []; // viagem rápida: saves antigos sem o campo
    if (!p.ngPlus) p.ngPlus = 0; // New Game+: saves antigos sem o campo (jogo normal = NG+0)
    if (p.modoHistoria === undefined) p.modoHistoria = false; // Modo História: saves antigos sem o campo (desligado)
    // Masmorra única virou dungeon1/dungeon2 (task #47) — um save de antes
    // dessa mudança guarda só "masmorra" como mapaAtual.
    if (salvo.mundo && salvo.mundo.mapaAtual === "masmorra") salvo.mundo.mapaAtual = "dungeon1";
  },
  // v1 -> v2: Caminhos do Herdeiro (talentos/pontos/subclasse/herança/
  // presets, tasks #92-95) e a config de IA de auto-batalha (task #96).
  // Cobre o personagem principal E cada convocado do gacha já obtido —
  // qualquer um deles pode ganhar pontos de talento em combate de verdade
  // (ver concederPontosPorNivel em BattleUI.js, chamado pra todo `membro`
  // do time, não só o principal), então cada um precisa do próprio estado.
  (salvo) => {
    const p = salvo.personagem;
    garantirEstadoCaminho(p);
    garantirConfigAutoBatalha(p);
    ((p.gacha && p.gacha.personagensObtidos) || []).forEach((convocado) => garantirEstadoCaminho(convocado));
  },
  // v2 -> v3: semente do mundo (ETAPA 1, task #34). Até aqui o mapa era
  // sorteado do zero a cada carregamento — o save guardava a posição do
  // jogador num mundo que nunca mais voltaria a existir. Agora o mundo é
  // função da semente, e um save antigo não tem nenhuma.
  //
  // Todos eles recebem a MESMA semente, SEMENTE_LEGADO, e isso é
  // intencional: qualquer valor serve pra tornar o mundo estável dali em
  // diante, mas um valor único e fixo faz com que dois jogadores antigos
  // conversando sobre "a floresta com o lago na diagonal" estejam falando do
  // mesmo lugar. Este número não pode mudar nunca mais — é o mundo dessas
  // pessoas.
  (salvo) => {
    if (!salvo.mundo) salvo.mundo = {};
    if (!salvo.mundo.semente) salvo.mundo.semente = SEMENTE_LEGADO;
  },
  // v3 -> v4: a nova geografia (ETAPA 1, task #37). O save passa a carregar
  // a posição do jogador na HIERARQUIA — em que mapa, em que zona, em que
  // macro-região —, além de onde ele já esteve, e passa a ser conferido
  // contra o mundo que existe hoje em vez de acreditar no que está escrito.
  //
  // As três consertadas que valem por si só, mesmo pra quem nunca vai ver a
  // ETAPA 2:
  //
  //   • mapa que não existe mais → volta pra superfície, em vez de o jogo
  //     tentar construir uma grade nula e travar na tela preta;
  //   • posição fora dos limites do mapa → volta pro spawn. Antes de haver
  //     onde conferir isso, um save com coordenada estragada empurrava o
  //     erro pra dentro do render;
  //   • zona salva que não bate com a posição salva → a POSIÇÃO ganha. Ela
  //     é o dado primário; a zona é derivada dela, e derivado desatualizado
  //     se recalcula em vez de mandar no jogo.
  (salvo) => {
    const m = salvo.mundo || (salvo.mundo = {});
    if (!MAPAS_CONHECIDOS.has(m.mapaAtual)) m.mapaAtual = "overworld";
    if (!m.player || !Number.isFinite(m.player.x) || !Number.isFinite(m.player.y)) {
      m.player = { ...OVERWORLD_SPAWN, dir: "baixo", frame: 0, ultimoMovimento: 0 };
    }
    // Fora dos limites só dá pra conferir no mundo aberto: o tamanho das
    // masmorras é conhecido, mas quem cuida de jogador dentro de parede lá é
    // reposicionarSePresoEmParede(), com a grade já construída em mãos.
    if (m.mapaAtual === "overworld") {
      const forax = m.player.x < 0 || m.player.x >= OVERWORLD_W;
      const foray = m.player.y < 0 || m.player.y >= OVERWORLD_H;
      if (forax || foray) { m.player.x = OVERWORLD_SPAWN.x; m.player.y = OVERWORLD_SPAWN.y; }
      const zona = zonaNoPonto(m.player.x, m.player.y);
      // Sem zona no ponto = o jogador está no vão sem região do canto
      // inferior direito (ver AREA_SEM_ZONA em worldHierarchy.js). Não dá
      // pra deixar: sem zona não há pool de monstros, nem clima, nem
      // descanso. Volta pro spawn.
      if (!zona) { m.player.x = OVERWORLD_SPAWN.x; m.player.y = OVERWORLD_SPAWN.y; }
      const zonaFinal = zonaNoPonto(m.player.x, m.player.y);
      m.zonaAtualId = zonaFinal ? zonaFinal.id : "vila";
      const macro = macroDaZona(m.zonaAtualId);
      m.macroAtualId = macro ? macro.id : null;
    } else {
      if (!m.zonaAtualId) m.zonaAtualId = "vila";
      if (m.macroAtualId === undefined) {
        const macro = macroDaZona(m.zonaAtualId);
        m.macroAtualId = macro ? macro.id : null;
      }
    }
    if (!Array.isArray(m.chests)) m.chests = [];
    if (!Array.isArray(m.nodes)) m.nodes = [];

    // Descoberta de macro-região derivada das zonas que o jogador já pisou —
    // nada é concedido de graça, e quem já andou meio mundo não recomeça o
    // Atlas zerado.
    const p = salvo.personagem;
    if (!Array.isArray(p.macrosDescobertas)) p.macrosDescobertas = [];
    const visitadas = Array.isArray(p.biomaVisitados) ? p.biomaVisitados : [];
    [...visitadas, m.zonaAtualId, "vila"].forEach((zid) => {
      const macro = macroDaZona(zid);
      if (macro && !p.macrosDescobertas.includes(macro.id)) p.macrosDescobertas.push(macro.id);
    });
  },
  // v4 -> v5: o mundo da ETAPA 2.
  //
  // Esta é a migração mais delicada da série, porque é a única em que a
  // COORDENADA SALVA DEIXA DE FAZER SENTIDO. O mapa era 106x72 com 22 zonas
  // retangulares; virou 224x176 com 48 territórios orgânicos. A posição
  // (30, 50) existe nos dois mundos e aponta para lugares que não têm nada a
  // ver um com o outro — pior, no mundo novo ela pode ser o fundo de um lago.
  //
  // Não existe conversão honesta entre os dois. O que existe é uma escolha, e
  // a escolha é: quem estava no mundo antigo VOLTA PARA CASA. Nível,
  // inventário, time, talentos, reputação e missões são do personagem e
  // atravessam intactos. O que se perde é onde ele tinha parado, que é a
  // menor coisa que dá pra perder aqui.
  //
  // Os baús também são refeitos: os ids antigos (bau1..bau23) não existem no
  // mundo novo, onde cada um é `bau_<zona>_<n>`. Manter a lista velha faria o
  // jogo desenhar 23 baús em coordenadas do mapa antigo, vários dentro de
  // pedra. Zerada, ela é repovoada pelo gerador no primeiro boot.
  (salvo) => {
    const m = salvo.mundo || (salvo.mundo = {});
    const p = salvo.personagem;
    if (m.layoutMundo !== LAYOUT_MUNDO) {
      m.layoutMundo = LAYOUT_MUNDO;
      m.mapaAtual = "overworld";
      m.player = { ...OVERWORLD_SPAWN, dir: "baixo", frame: 0, ultimoMovimento: 0 };
      m.zonaAtualId = "vila";
      const macroInicial = macroDaZona("vila");
      m.macroAtualId = macroInicial ? macroInicial.id : null;
      m.chests = [];
      m.nodes = [];
      m.chestsDungeon = [];
      m.chestsDungeon2 = [];
      // Marca pro jogo poder AVISAR, em vez de o jogador ser teleportado pra
      // vila sem explicação e achar que perdeu o progresso.
      m.mundoRefeito = true;
    }
    // Névoa de guerra (item 26). Um save antigo não tem nenhuma, e as zonas
    // que ele já visitou entram como DESCOBERTAS — quem andou meio mundo não
    // recomeça com o mapa apagado. Nada além disso é revelado.
    if (!p.nevoa || typeof p.nevoa !== "object") p.nevoa = {};
    if (!p.nevoa.zonas) p.nevoa.zonas = {};
    if (!p.nevoa.locais) p.nevoa.locais = {};
    const jaVistas = Array.isArray(p.biomaVisitados) ? p.biomaVisitados : [];
    [...jaVistas, "vila"].forEach((zid) => {
      if (!p.nevoa.zonas[zid]) p.nevoa.zonas[zid] = "descoberto";
    });
  },
  // v5 -> v6: o mundo habitado da ETAPA 3.
  //
  // Ao contrário da v5, esta migração NÃO mexe em coordenada nenhuma. A
  // geografia da ETAPA 2 continua idêntica — as regiões, zonas, cidades,
  // estradas, POIs, masmorras e chunks são os mesmos, e um save da v5 abre no
  // exato lugar onde parou. O que muda é que agora existe gente, bicho com
  // horário e quest regional, e o save precisa de três gavetas novas:
  //
  //   personagem.npcs             memória por NPC (conhecido, conversas,
  //                               favor, e o que aquele NPC guarda de você)
  //   personagem.questsRegionais  estado de cada passo das 17 linhas
  //   personagem.eventosRegionais eventos ativos e os já resolvidos
  //
  // Todas as três nascem no estado de quem nunca conheceu ninguém, e é isso
  // que se quer: um save antigo não deve começar com relação nenhuma
  // inventada. A única exceção é o World State regional, que recebe os
  // valores de repouso das regiões (vila provida, recife vivo, Coração frio)
  // — sem eles, as falas condicionais dos NPCs cairiam todas no estado
  // "base" mesmo em regiões cuja história já deveria estar em repouso.
  (salvo) => {
    const p = salvo.personagem;
    if (!p.npcs || typeof p.npcs !== "object") p.npcs = {};
    if (!p.questsRegionais || typeof p.questsRegionais !== "object") p.questsRegionais = {};
    if (!p.eventosRegionais || typeof p.eventosRegionais !== "object") {
      p.eventosRegionais = { ativos: [], encerrados: [] };
    }
    if (!Array.isArray(p.eventosRegionais.ativos)) p.eventosRegionais.ativos = [];
    if (!Array.isArray(p.eventosRegionais.encerrados)) p.eventosRegionais.encerrados = [];

    const m = salvo.mundo || (salvo.mundo = {});
    if (!m.worldStateRegional || typeof m.worldStateRegional !== "object") {
      m.worldStateRegional = {};
    }
    Object.entries(WORLD_STATE_REGIONAL_PADRAO).forEach(([chave, valor]) => {
      if (m.worldStateRegional[chave] === undefined) m.worldStateRegional[chave] = valor;
    });
  },
  // v6 -> v7: versão carimbada sem migração própria. Até a v7 este array
  // terminava na v5 -> v6 e o save já saía com saveVersion 7; as migrações
  // acrescentadas depois caíram um índice antes do lugar. A regra do laço em
  // migrarSave é MIGRACOES[v] levar um save da versão v para a v + 1 — sem
  // esta posição, a da malha 4x (v9 -> v10) nunca rodava para um save v9, e o
  // herói abria na coordenada do mapa 2x, em outro canto do mundo. Vazia de
  // propósito: só realinha a série (as migrações seguintes são idempotentes).
  () => {},
  // v7 -> v8: tutorial inicial opcional e repetível. Saves antigos não são
  // interrompidos ao carregar: o estado nasce disponível no menu Mais; só
  // um personagem recém-criado recebe a oferta automática em main.js.
  (salvo) => {
    const p = salvo.personagem;
    if (!p.tutorialInicial || typeof p.tutorialInicial !== "object") {
      p.tutorialInicial = { status: "nao_iniciado", etapa: 0, versao: 1 };
    }
  },
  // v8 -> v9: progressão curta até o nível 25. Saves experimentais que já
  // passaram desse teto são normalizados sem perder inventário ou roster.
  (salvo) => {
    const p = salvo.personagem;
    [p, ...((p.gacha && p.gacha.personagensObtidos) || [])].forEach((membro) => {
      if ((membro.nivel || 1) >= NIVEL_MAXIMO_PERSONAGEM) {
        membro.nivel = NIVEL_MAXIMO_PERSONAGEM;
        membro.xp = 0;
        membro.xpProximo = xpParaNivel(NIVEL_MAXIMO_PERSONAGEM);
      }
    });
  },
  // v9 -> v10: a malha dobra nos dois eixos. Mantemos o lugar aproximado
  // do herói e o estado dos baús/nós; as posições dos objetos são refeitas
  // pelo gerador no carregamento, com os mesmos ids.
  //
  // O fator depende do mapa em que a coordenada foi salva: layout 3 é o mapa
  // 2x (448x352), então dobra; layout 2 é o desenho-base da ETAPA 2
  // (224x176), então quadruplica. Números fixos de propósito: esta migração
  // leva ao mapa 4x, e continua levando mesmo que a escala mude de novo.
  (salvo) => {
    const m = salvo.mundo || (salvo.mundo = {});
    if (m.layoutMundo === LAYOUT_MUNDO) return;
    const fator = m.layoutMundo === 2 ? 4 : 2;
    if (m.mapaAtual === "overworld" && m.player) {
      m.player.x = Math.max(0, Math.min(OVERWORLD_W - 1, Math.round((Number(m.player.x) || 0) * fator)));
      m.player.y = Math.max(0, Math.min(OVERWORLD_H - 1, Math.round((Number(m.player.y) || 0) * fator)));
      const zona = zonaNoPonto(m.player.x, m.player.y);
      if (zona) m.zonaAtualId = zona.id;
    }
    m.layoutMundo = LAYOUT_MUNDO;
  },
];

// Migra um save carregado pro formato atual — idempotente (rodar duas vezes
// no mesmo save não muda nada da segunda vez em diante, porque só roda as
// migrações a partir de `salvo.saveVersion` e cada uma só preenche o que
// falta). Retorna o mesmo objeto `salvo`, já mutado e com
// `saveVersion === SAVE_VERSION`.
export function migrarSave(salvo) {
  if (!salvo || !salvo.personagem) return salvo;
  const versaoInicial = salvo.saveVersion || 0;
  for (let v = versaoInicial; v < MIGRACOES.length; v++) {
    MIGRACOES[v](salvo);
  }
  salvo.saveVersion = SAVE_VERSION;
  return salvo;
}

export function salvarJogo(estado, numeroSlot = slotAtivo()) {
  try {
    // Migra (não só carimba o número): na prática `estado` já vem do
    // `personagem`/`mundo` vivos, que só existem em memória depois de
    // migrarSave() já ter rodado no load — mas chamar de novo aqui garante
    // que o QUE FOI ESCRITO no save realmente tem a versão que ele afirma
    // ter, mesmo que algum caminho futuro chame salvarJogo() direto com um
    // objeto que ainda não passou por um load (ex.: um save importado, ou
    // um teste). Idempotente e barato — nunca reescreve o que já existe.
    migrarSave(estado);
    estado.salvoEm = Date.now();
    localStorage.setItem(chaveDoSlot(selecionarSlot(numeroSlot)), JSON.stringify(estado));
    return true;
  } catch (e) {
    console.error("Falha ao salvar:", e);
    return false;
  }
}

export function carregarJogo(numeroSlot = slotAtivo()) {
  try {
    migrarSaveLegadoParaSlots();
    const raw = localStorage.getItem(chaveDoSlot(numeroSlot));
    if (!raw) return null;
    return migrarSave(JSON.parse(raw));
  } catch (e) {
    console.error("Falha ao carregar:", e);
    return null;
  }
}

export function existeSave(numeroSlot = slotAtivo()) {
  migrarSaveLegadoParaSlots();
  return localStorage.getItem(chaveDoSlot(numeroSlot)) !== null;
}

export function apagarSave(numeroSlot = slotAtivo()) {
  localStorage.removeItem(chaveDoSlot(numeroSlot));
}
