const MOD_src_data_loader_js = (function(){
// Carrega todos os arquivos JSON de dados do jogo.
const ARQUIVOS = [
  "races", "classes", "backgrounds", "traits", "items",
  "monsters", "lootTables", "quests", "npcs", "recipes", "gachaRoster", "skillTrees",
  "elements", "enemyBehaviors", "skillChecks", "worldStateVariables", "compendium",
  "affinities", "explorationEvents", "travelingMerchant",
];

// Fallback por arquivo: usado quando o JSON não pode ser buscado (ex.: ainda
// não publicado nesta implantação). Mantém o jogo jogável mesmo com dados
// parciais, em vez de travar o boot inteiro.
const FALLBACK = {
  races: [], classes: [], backgrounds: [], traits: [], monsters: [],
  quests: [], npcs: [], recipes: [], gachaRoster: [],
  items: { raridades: [], itens: [] },
  lootTables: {}, skillTrees: {}, enemyBehaviors: {},
  elements: { elementos: [], matriz: {}, multiplicadores: {} },
  skillChecks: [],
  worldStateVariables: { facoes: [], tiers: [] },
  compendium: [],
  affinities: {},
  explorationEvents: [],
  travelingMerchant: [],
};

async function carregarDados() {
  const entradas = await Promise.all(
    ARQUIVOS.map(async (nome) => {
      try {
        const resp = await fetch(`./src/data/${nome}.json`);
        if (!resp.ok) throw new Error(`Falha ao carregar ${nome}.json`);
        return [nome, await resp.json()];
      } catch (e) {
        console.warn(`[loader] usando fallback para ${nome}.json:`, e.message);
        return [nome, FALLBACK[nome]];
      }
    })
  );
  const dados = Object.fromEntries(entradas);
  window.__QUESTS__ = dados.quests; // usado por QuestSystem.js
  return dados;
}

// Placeholder gerado em canvas: usado quando um sprite não pode ser
// carregado (ex.: hospedagem que não inclui todos os assets binários).
// Nunca deve impedir o boot do jogo — apenas substitui visualmente.
function criarImagemPlaceholder() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#5b4636";
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = "#e0c080";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
  }
  return canvas;
}

async function carregarImagem(caminho) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(criarImagemPlaceholder());
    img.src = caminho;
  });
}

async function carregarTodasImagens(dados) {
  const cache = {};
  const jobs = [];

  jobs.push(["tileset", "assets/tiles/tileset.png"]);
  jobs.push(["bau_fechado", "assets/sprites/bau_fechado.png"]);
  jobs.push(["bau_aberto", "assets/sprites/bau_aberto.png"]);
  jobs.push(["npc_marker", "assets/sprites/npc_marker.png"]);
  jobs.push(["entrada_masmorra", "assets/sprites/entrada_masmorra.png"]);
  ["erva", "minerio", "madeira"].forEach((k) => jobs.push([`no_${k}`, `assets/sprites/no_${k}.png`]));

  dados.races.forEach((r) => {
    dados.classes.forEach((c) => {
      const key = `pc_${r.id}_${c.id}`;
      jobs.push([key, `assets/sprites/${key}.png`]);
    });
  });
  dados.monsters.forEach((m) => jobs.push([m.sprite, `assets/sprites/${m.sprite}.png`]));
  (dados.gachaRoster || []).forEach((p) => {
    const key = `gacha_${p.id}`;
    jobs.push([key, `assets/sprites/${key}.png`]);
  });
  (dados.npcs || []).forEach((n) => {
    if (n.sprite) jobs.push([n.id, `assets/sprites/${n.sprite}`]);
  });

  const icones = new Set(dados.items.itens.map((i) => i.icone));
  icones.forEach((ic) => jobs.push([`icon_${ic}`, `assets/icons/${ic}.png`]));

  await Promise.all(
    jobs.map(async ([key, path]) => {
      cache[key] = await carregarImagem(path);
    })
  );
  return cache;
}

  return { carregarDados, carregarImagem, carregarTodasImagens };
})();

const MOD_src_data_worldMap_js = (function(){
// Define os mapas do mundo aberto e da masmorra, além dos objetos posicionados neles.
const TILE = {
  GRASS: 0, GRASS_DETAIL: 1, PATH: 2, WATER: 3, TREE: 4, WALL: 5,
  DUNGEON_FLOOR: 6, DUNGEON_WALL: 7, SAND: 8, TALL_GRASS: 9, VILLAGE_FLOOR: 10, BUSH: 11,
};
const TILE_SIZE = 64;
const SOLID_TILES = new Set([TILE.TREE, TILE.WALL, TILE.WATER, TILE.DUNGEON_WALL, TILE.BUSH]);

// Mapa legado tile -> nome de bioma, usado pelo sistema de encontro aleatório
// original (baseado só no tile pisado). Mantido por compatibilidade; o novo
// sistema de zonas (ZONAS / zonaNoPonto) é a fonte de verdade recomendada
// para escolher o pool de monstros por região.
const ENCOUNTER_BIOMA = {
  [TILE.TALL_GRASS]: "floresta",
  [TILE.DUNGEON_FLOOR]: "masmorra",
  [TILE.PATH]: "estrada",
  [TILE.SAND]: "deserto",
};

function grid(w, h, fill) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

function fillRect(g, x0, y0, x1, y1, tile) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (g[y] && g[y][x] !== undefined) g[y][x] = tile;
  }
}

function scatter(g, x0, y0, x1, y1, tile, density, avoid) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!g[y] || g[y][x] === undefined) continue;
    if (avoid && avoid.has(g[y][x])) continue;
    if (Math.random() < density) g[y][x] = tile;
  }
}

// ---------------------------------------------------------------------------
// Mundo aberto expandido: 22 zonas nomeadas ligadas por estradas, crescendo
// a partir da vila (canto superior esquerdo, onde NPCs/baús originais já
// estavam posicionados) em uma grade de regiões 6 colunas x 4 linhas
// (a última linha usa só 4 colunas). Cada zona é descrita por uma bounding
// box no grid grande, faixa de nível sugerida, monstros que podem aparecer
// nela e pontos de interesse (baú / nó de coleta / marco nomeado).
// ---------------------------------------------------------------------------
const OVERWORLD_W = 106;
const OVERWORLD_H = 72;

// Limites das colunas/linhas da grade de regiões (geometria, não exportado).
const COL_X = [0, 16, 34, 52, 70, 88, 106];
const ROW_Y = [0, 22, 40, 58, 72];
const ROW_COLS = [6, 6, 6, 4]; // quantas colunas existem em cada linha

const ZONAS = [
  {
    id: "vila", nome: "Vila de Aethra",
    x0: 0, y0: 0, x1: 15, y1: 21,
    nivelSugerido: [1, 2],
    elementoDominante: null, // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    descricao: "Vila natal do herói, segura e sem encontros aleatórios.",
    monstros: [],
    pontosDeInteresse: [
      { tipo: "marco", nome: "Praça da Vila", x: 8, y: 6 },
    ],
  },
  {
    id: "floresta", nome: "Floresta Sussurrante",
    x0: 16, y0: 0, x1: 33, y1: 21,
    nivelSugerido: [1, 3],
    elementoDominante: "natureza", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 20, y: 17, monstroId: "guardiao_das_raizes" }, // task #45: chefe obrigatório da zona
    descricao: "Bosque claro logo às portas da vila, com um pequeno lago.",
    monstros: ["slime", "morcego", "lobo", "goblin", "rato_gigante", "abelha_titan"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú Raro do Lago", refId: "bau3", x: 30, y: 8 },
      { tipo: "no", nome: "Veio de Minério", refId: "no3", x: 27, y: 10 },
      { tipo: "marco", nome: "Lago Espelhado", x: 27, y: 3 },
    ],
  },
  {
    id: "bosque_sombrio", nome: "Bosque Sombrio",
    x0: 34, y0: 0, x1: 51, y1: 21,
    nivelSugerido: [3, 5],
    elementoDominante: "sombrio", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 44, y: 4, monstroId: "devoradora_de_sombras" }, // task #45: chefe obrigatório da zona
    descricao: "Mata densa e escura onde bandidos e lobos sombrios rondam.",
    monstros: ["lobo", "goblin", "bandido", "lobo_sombrio", "aranha_gigante", "corvo_ceifador"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú Escondido", refId: "bau4", x: 40, y: 8 },
      { tipo: "no", nome: "Ervas do Bosque", refId: "no6", x: 45, y: 14 },
    ],
  },
  {
    id: "colinas_douradas", nome: "Colinas Douradas",
    x0: 52, y0: 0, x1: 69, y1: 21,
    nivelSugerido: [4, 6],
    elementoDominante: "radiante", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 65, y: 3, monstroId: "paladino_do_sol_poente" }, // task #45: chefe obrigatório da zona
    descricao: "Colinas ensolaradas cortadas por trilhas de pastores.",
    monstros: ["goblin", "bandido", "harpia", "touro_selvagem", "wisp_radiante", "sentinela_dourada"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú da Colina", refId: "bau5", x: 58, y: 6 },
      { tipo: "no", nome: "Afloramento Mineral", refId: "no7", x: 63, y: 15 },
    ],
  },
  {
    id: "pantano_negro", nome: "Pântano Negro",
    x0: 70, y0: 0, x1: 87, y1: 21,
    nivelSugerido: [5, 7],
    elementoDominante: "veneno", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 78, y: 4, monstroId: "bruxa_do_lodo_eterno" }, // task #45: chefe obrigatório da zona
    descricao: "Águas paradas e lodo venenoso; poucos voltam sem lama nas botas.",
    monstros: ["sapo_venenoso", "lodo_negro", "aranha_gigante"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú Afundado", refId: "bau6", x: 75, y: 14 },
      { tipo: "no", nome: "Ervas Pantanosas", refId: "no8", x: 82, y: 7 },
    ],
  },
  {
    id: "costa_aurora", nome: "Costa da Aurora",
    x0: 88, y0: 0, x1: 105, y1: 21,
    nivelSugerido: [6, 8],
    elementoDominante: "agua", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 92, y: 4, monstroId: "capita_mare_negra" }, // task #45: chefe obrigatório da zona
    descricao: "Praia rochosa batida por ventos e naufrágios antigos.",
    monstros: ["caranguejo_gigante", "pirata_naufrago", "morcego"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú do Naufrágio", refId: "bau7", x: 95, y: 16 },
      { tipo: "no", nome: "Depósito Mineral", refId: "no9", x: 100, y: 6 },
      { tipo: "marco", nome: "Farol Afogado", x: 98, y: 10 },
    ],
  },
  {
    id: "charco_fetido", nome: "Charco Fétido",
    x0: 0, y0: 22, x1: 15, y1: 39,
    nivelSugerido: [3, 5],
    elementoDominante: "veneno", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 4, y: 27, monstroId: "tirano_do_charco" }, // task #45: chefe obrigatório da zona
    descricao: "Brejo nos limites sul da vila, cheio de zumbido de insetos.",
    monstros: ["slime", "sapo_venenoso", "aranha_gigante"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú do Brejo", refId: "bau8", x: 6, y: 34 },
      { tipo: "no", nome: "Ervas do Charco", refId: "no10", x: 11, y: 26 },
    ],
  },
  {
    id: "vale_pedras", nome: "Vale das Pedras Cinzentas",
    x0: 16, y0: 22, x1: 33, y1: 39,
    nivelSugerido: [4, 6],
    elementoDominante: "terra", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 30, y: 35, monstroId: "colosso_das_pedras_cinzentas" }, // task #45: chefe obrigatório da zona
    descricao: "Vale rochoso cortado por trilhas antigas de comerciantes.",
    monstros: ["bandido", "goblin", "harpia", "cristal_ecoante"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú entre Pedras", refId: "bau9", x: 22, y: 36 },
      { tipo: "no", nome: "Veio de Ferro", refId: "no11", x: 29, y: 25 },
      { tipo: "marco", nome: "Pedra Rúnica Antiga", x: 24, y: 32 },
    ],
  },
  {
    id: "floresta_ancestral", nome: "Floresta Ancestral",
    x0: 34, y0: 22, x1: 51, y1: 39,
    nivelSugerido: [6, 8],
    elementoDominante: "natureza", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 44, y: 37, monstroId: "matriarca_ursina" }, // task #45: chefe obrigatório da zona
    descricao: "Árvores milenares guardadas por ursos e druidas corrompidos.",
    monstros: ["urso_ancestral", "orc_selvagem", "druida_corrompido", "lobo_sombrio"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú entre Raízes", refId: "bau10", x: 39, y: 34 },
      { tipo: "no", nome: "Tronco Ancestral", refId: "no12", x: 46, y: 26 },
    ],
  },
  {
    id: "planicie_ventosa", nome: "Planície Ventosa",
    x0: 52, y0: 22, x1: 69, y1: 39,
    nivelSugerido: [6, 9],
    elementoDominante: "vento", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 56, y: 30, monstroId: "grifo_alfa_dos_ventos" }, // task #45: chefe obrigatório da zona
    descricao: "Campos abertos varridos pelo vento, domínio de grifos jovens.",
    monstros: ["touro_selvagem", "harpia", "grifo_jovem", "gralha_tempestuosa"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú da Planície", refId: "bau11", x: 60, y: 25 },
      { tipo: "no", nome: "Ervas do Vento", refId: "no13", x: 65, y: 35 },
    ],
  },
  {
    id: "deserto_karn", nome: "Deserto de Karn",
    x0: 70, y0: 22, x1: 87, y1: 39,
    nivelSugerido: [8, 10],
    elementoDominante: "fogo", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 74, y: 28, monstroId: "rainha_escorpiao_de_karn" }, // task #45: chefe obrigatório da zona
    descricao: "Dunas escaldantes onde escorpiões gigantes espreitam sob a areia.",
    monstros: ["escorpiao_gigante", "necromante_errante", "bandido", "verme_das_dunas"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú Soterrado", refId: "bau12", x: 78, y: 35 },
      { tipo: "no", nome: "Veio Élfico", refId: "no14", x: 83, y: 26 },
    ],
  },
  {
    id: "recife_tempestades", nome: "Recife das Tempestades",
    x0: 88, y0: 22, x1: 105, y1: 39,
    nivelSugerido: [9, 11],
    elementoDominante: "raio", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 101, y: 30, monstroId: "serpente_da_tempestade_eterna" }, // task #45: chefe obrigatório da zona
    descricao: "Recifes castigados por tempestades constantes e serpentes marinhas.",
    monstros: ["serpente_marinha", "caranguejo_gigante", "pirata_naufrago", "arraia_relampago", "enguia_eletrica"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú do Recife", refId: "bau13", x: 93, y: 26 },
      { tipo: "no", nome: "Depósito do Recife", refId: "no15", x: 99, y: 35 },
    ],
  },
  {
    id: "terras_esquecidas", nome: "Terras Esquecidas",
    x0: 0, y0: 40, x1: 15, y1: 57,
    nivelSugerido: [6, 8],
    elementoDominante: "sombrio", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 4, y: 48, monstroId: "cavaleiro_caido_de_aethra" }, // task #45: chefe obrigatório da zona
    descricao: "Campos abandonados com fundações de casas há muito caídas.",
    monstros: ["esqueleto", "druida_corrompido", "bandido"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú das Fundações", refId: "bau14", x: 7, y: 52 },
      { tipo: "no", nome: "Ervas Selvagens", refId: "no16", x: 12, y: 44 },
    ],
  },
  {
    id: "caverna_eco", nome: "Caverna do Eco",
    x0: 16, y0: 40, x1: 33, y1: 57,
    nivelSugerido: [8, 10],
    elementoDominante: "terra", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 24, y: 50, monstroId: "troll_anciao_do_eco" }, // task #45: chefe obrigatório da zona
    descricao: "Encostas rochosas com uma boca de caverna que ecoa gemidos.",
    monstros: ["esqueleto", "troll_das_cavernas", "aranha_gigante"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú da Gruta", refId: "bau15", x: 20, y: 54 },
      { tipo: "no", nome: "Veio da Caverna", refId: "no17", x: 28, y: 44 },
    ],
  },
  {
    id: "ruinas_aethra", nome: "Ruínas de Aethra Antiga",
    x0: 34, y0: 40, x1: 51, y1: 57,
    nivelSugerido: [9, 11],
    elementoDominante: "arcano", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 41, y: 49, monstroId: "guardiao_arcano_das_ruinas" }, // task #45: chefe obrigatório da zona
    descricao: "Restos de uma cidade élfica tomada por vegetação e necromantes.",
    monstros: ["esqueleto", "necromante_errante", "gargula", "sentinela_arcana", "espectro_arcano"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú das Ruínas", refId: "bau16", x: 44, y: 44 },
      { tipo: "no", nome: "Ervas das Ruínas", refId: "no18", x: 38, y: 53 },
      { tipo: "marco", nome: "Círculo de Colunas Caídas", x: 40, y: 48 },
    ],
  },
  {
    id: "bosque_petrificado", nome: "Bosque Petrificado",
    x0: 52, y0: 40, x1: 69, y1: 57,
    nivelSugerido: [10, 12],
    elementoDominante: "terra", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 60, y: 48, monstroId: "rei_petrificado" }, // task #45: chefe obrigatório da zona
    descricao: "Árvores transformadas em pedra por magia esquecida.",
    monstros: ["golem_de_pedra", "gargula", "orc_selvagem"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú Petrificado", refId: "bau17", x: 56, y: 53 },
      { tipo: "no", nome: "Madeira Fossilizada", refId: "no19", x: 64, y: 44 },
    ],
  },
  {
    id: "deserto_ardente", nome: "Deserto Ardente",
    x0: 70, y0: 40, x1: 87, y1: 57,
    nivelSugerido: [11, 13],
    elementoDominante: "fogo", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 78, y: 48, monstroId: "senhor_das_chamas_errantes" }, // task #45: chefe obrigatório da zona
    descricao: "Areias tão quentes que tremulam, lar de escorpiões e mortos-vivos.",
    monstros: ["escorpiao_gigante", "necromante_errante", "golem_de_pedra"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú das Dunas", refId: "bau18", x: 74, y: 44 },
      { tipo: "no", nome: "Veio Ardente", refId: "no20", x: 81, y: 53 },
    ],
  },
  {
    id: "falesias_fim", nome: "Falésias do Fim",
    x0: 88, y0: 40, x1: 105, y1: 57,
    nivelSugerido: [12, 14],
    elementoDominante: "vento", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 97, y: 48, monstroId: "matriarca_wyvern_das_falesias" }, // task #45: chefe obrigatório da zona
    descricao: "Penhascos altíssimos onde wyverns fazem seus ninhos.",
    monstros: ["wyvern", "serpente_marinha", "grifo_jovem"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú da Falésia", refId: "bau19", x: 92, y: 44 },
      { tipo: "no", nome: "Depósito da Falésia", refId: "no21", x: 100, y: 53 },
    ],
  },
  {
    id: "pantano_bruma", nome: "Pântano da Bruma",
    x0: 0, y0: 58, x1: 15, y1: 71,
    nivelSugerido: [10, 12],
    elementoDominante: "gelo", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 12, y: 68, monstroId: "matriarca_da_bruma_eterna" }, // task #45: chefe obrigatório da zona
    descricao: "Névoa perpétua esconde trolls e limos rastejantes.",
    monstros: ["lodo_negro", "sapo_venenoso", "troll_das_cavernas", "lobo_gelido", "bruxa_da_bruma"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú na Bruma", refId: "bau20", x: 9, y: 66 },
      { tipo: "no", nome: "Ervas da Bruma", refId: "no22", x: 5, y: 62 },
    ],
  },
  {
    id: "montanha_sombria", nome: "Montanha Sombria",
    x0: 16, y0: 58, x1: 33, y1: 71,
    nivelSugerido: [13, 15],
    elementoDominante: "sombrio", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 22, y: 65, monstroId: "senhor_sombrio_da_montanha" }, // task #45: chefe obrigatório da zona
    descricao: "Picos escuros habitados por golens e trolls de caverna.",
    monstros: ["wyvern", "golem_de_pedra", "troll_das_cavernas"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú do Penhasco", refId: "bau21", x: 28, y: 62 },
      { tipo: "no", nome: "Veio da Montanha", refId: "no23", x: 20, y: 67 },
      { tipo: "marco", nome: "Passagem do Vento Uivante", x: 25, y: 60 },
    ],
  },
  {
    id: "covil_do_dragao", nome: "Covil do Dragão",
    x0: 34, y0: 58, x1: 51, y1: 71,
    nivelSugerido: [14, 16],
    elementoDominante: "fogo", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 38, y: 60, monstroId: "dragao_anciao_das_cinzas" }, // task #45: chefe obrigatório da zona
    descricao: "Terra arrasada e cinzenta que esconde a segunda masmorra do reino.",
    monstros: ["gargula", "wyvern", "senhor_da_cinza"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú do Covil", refId: "bau22", x: 48, y: 68 },
      { tipo: "no", nome: "Veio de Cinzas", refId: "no24", x: 50, y: 64 },
      { tipo: "marco", nome: "Entrada do Covil das Cinzas", x: 44, y: 68 },
    ],
  },
  {
    id: "confins_aethra", nome: "Confins de Aethra",
    x0: 52, y0: 58, x1: 69, y1: 71,
    nivelSugerido: [15, 18],
    elementoDominante: "arcano", // terreno: bônus de ataque desse elemento, resistência para inimigos nativos (task #42)
    chefe: { x: 63, y: 64, monstroId: "imperador_arcano_dos_confins" }, // task #45: chefe obrigatório da zona
    descricao: "A fronteira final do reino conhecido, onde só os mais fortes sobrevivem.",
    monstros: ["senhor_da_cinza", "wyvern", "golem_de_pedra", "gargula", "construto_arcano", "carrasco_de_cinzas"],
    pontosDeInteresse: [
      { tipo: "bau", nome: "Baú Lendário dos Confins", refId: "bau23", x: 65, y: 66 },
      { tipo: "no", nome: "Veio Final", refId: "no25", x: 56, y: 62 },
      { tipo: "marco", nome: "Trono de Cinzas", x: 60, y: 60 },
    ],
  },
];

// Retorna a zona (objeto de ZONAS) que contém o ponto (x, y) no grid do
// mundo aberto, ou null se nenhuma zona cobrir o ponto.
function zonaNoPonto(x, y) {
  for (const z of ZONAS) {
    if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
  }
  return null;
}

function zonaBBox(id) {
  const z = ZONAS.find((zz) => zz.id === id);
  return { x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 };
}

// Receitas de terreno por zona (não exportado — usado só por buildOverworld).
// Cada entrada descreve o tile-base preenchendo toda a bbox da zona e uma
// lista de decorações aplicadas por cima via scatter (tile, densidade, evitar).
const TERRENOS = {
  bosque_sombrio: { base: TILE.TALL_GRASS, decos: [[TILE.TREE, 0.22, []], [TILE.BUSH, 0.08, [TILE.TREE]]] },
  colinas_douradas: { base: TILE.GRASS, decos: [[TILE.GRASS_DETAIL, 0.15, []], [TILE.WALL, 0.04, [TILE.GRASS_DETAIL]]] },
  pantano_negro: { base: TILE.TALL_GRASS, decos: [[TILE.WATER, 0.18, []], [TILE.BUSH, 0.05, [TILE.WATER]]] },
  costa_aurora: { base: TILE.SAND, decos: [[TILE.WATER, 0.22, []], [TILE.BUSH, 0.03, [TILE.WATER]]] },
  charco_fetido: { base: TILE.TALL_GRASS, decos: [[TILE.WATER, 0.16, []], [TILE.SAND, 0.05, [TILE.WATER]]] },
  vale_pedras: { base: TILE.GRASS, decos: [[TILE.WALL, 0.09, []], [TILE.GRASS_DETAIL, 0.05, [TILE.WALL]]] },
  floresta_ancestral: { base: TILE.TALL_GRASS, decos: [[TILE.TREE, 0.28, []], [TILE.BUSH, 0.1, [TILE.TREE]]] },
  planicie_ventosa: { base: TILE.GRASS, decos: [[TILE.GRASS_DETAIL, 0.12, []], [TILE.TREE, 0.03, [TILE.GRASS_DETAIL]]] },
  deserto_karn: { base: TILE.SAND, decos: [[TILE.WALL, 0.05, []], [TILE.TALL_GRASS, 0.02, [TILE.WALL]]] },
  recife_tempestades: { base: TILE.SAND, decos: [[TILE.WATER, 0.26, []], [TILE.WALL, 0.05, [TILE.WATER]]] },
  terras_esquecidas: { base: TILE.GRASS, decos: [[TILE.VILLAGE_FLOOR, 0.05, []], [TILE.BUSH, 0.07, [TILE.VILLAGE_FLOOR]]] },
  caverna_eco: { base: TILE.GRASS, decos: [[TILE.WALL, 0.22, []], [TILE.DUNGEON_FLOOR, 0.03, [TILE.WALL]]] },
  ruinas_aethra: { base: TILE.GRASS, decos: [[TILE.VILLAGE_FLOOR, 0.12, []], [TILE.BUSH, 0.08, [TILE.VILLAGE_FLOOR]], [TILE.WALL, 0.05, [TILE.VILLAGE_FLOOR, TILE.BUSH]]] },
  bosque_petrificado: { base: TILE.SAND, decos: [[TILE.TREE, 0.18, []], [TILE.WALL, 0.1, [TILE.TREE]]] },
  deserto_ardente: { base: TILE.SAND, decos: [[TILE.WALL, 0.07, []]] },
  falesias_fim: { base: TILE.GRASS, decos: [[TILE.WALL, 0.18, []], [TILE.WATER, 0.1, [TILE.WALL]]] },
  pantano_bruma: { base: TILE.TALL_GRASS, decos: [[TILE.WATER, 0.2, []], [TILE.BUSH, 0.08, [TILE.WATER]]] },
  montanha_sombria: { base: TILE.GRASS, decos: [[TILE.WALL, 0.24, []], [TILE.TREE, 0.05, [TILE.WALL]]] },
  covil_do_dragao: { base: TILE.SAND, decos: [[TILE.WALL, 0.12, []], [TILE.DUNGEON_FLOOR, 0.02, [TILE.WALL]]] },
  confins_aethra: { base: TILE.TALL_GRASS, decos: [[TILE.WALL, 0.14, []], [TILE.SAND, 0.08, [TILE.WALL]]] },
};

function pintarZonaGenerica(g, id) {
  const b = zonaBBox(id);
  const receita = TERRENOS[id];
  if (!receita) return;
  fillRect(g, b.x0, b.y0, b.x1, b.y1, receita.base);
  for (const [tile, densidade, avoidTiles] of receita.decos) {
    scatter(g, b.x0, b.y0, b.x1, b.y1, tile, densidade, new Set(avoidTiles));
  }
}

// Liga cada par de zonas vizinhas na grade de regiões com uma faixa de
// estrada (PATH), garantindo que o mapa inteiro seja acessível a pé a
// partir da vila. Sobrescreve qualquer decoração sólida no caminho.
function carvearEstradas(g) {
  // Conexões horizontais (entre colunas vizinhas, dentro da mesma linha).
  for (let row = 0; row < ROW_COLS.length; row++) {
    const yMid = Math.floor((ROW_Y[row] + ROW_Y[row + 1] - 1) / 2);
    for (let col = 0; col < ROW_COLS[row] - 1; col++) {
      const xBorder = COL_X[col + 1];
      fillRect(g, xBorder - 2, yMid - 1, xBorder + 1, yMid + 1, TILE.PATH);
    }
  }
  // Conexões verticais (entre linhas vizinhas, dentro da mesma coluna).
  for (let row = 0; row < ROW_COLS.length - 1; row++) {
    const colsAqui = Math.min(ROW_COLS[row], ROW_COLS[row + 1]);
    for (let col = 0; col < colsAqui; col++) {
      const xMid = Math.floor((COL_X[col] + COL_X[col + 1] - 1) / 2);
      const yBorder = ROW_Y[row + 1];
      fillRect(g, xMid - 1, yBorder - 2, xMid + 1, yBorder + 1, TILE.PATH);
    }
  }
}

function buildOverworld() {
  const g = grid(OVERWORLD_W, OVERWORLD_H, TILE.GRASS);

  // Vila
  fillRect(g, 0, 0, 15, 13, TILE.VILLAGE_FLOOR);
  scatter(g, 0, 0, 15, 13, TILE.BUSH, 0.02, new Set());

  // Caminho ligando a vila à floresta
  fillRect(g, 15, 6, 19, 6, TILE.PATH);
  fillRect(g, 15, 5, 15, 7, TILE.PATH);

  // Floresta
  fillRect(g, 16, 0, 33, 21, TILE.TALL_GRASS);
  fillRect(g, 15, 6, 19, 6, TILE.PATH); // garante o caminho sobre a floresta
  scatter(g, 16, 0, 33, 21, TILE.TREE, 0.12, new Set([TILE.PATH]));
  scatter(g, 16, 0, 33, 21, TILE.GRASS_DETAIL, 0.06, new Set([TILE.TREE, TILE.PATH]));

  // Lago
  fillRect(g, 25, 2, 29, 5, TILE.WATER);

  // Área de areia perto da entrada da masmorra
  fillRect(g, 28, 15, 33, 20, TILE.SAND);
  fillRect(g, 15, 6, 19, 6, TILE.PATH);

  // Limpa arvores em volta da vila para nao bloquear a saida
  fillRect(g, 15, 6, 20, 6, TILE.PATH);

  // As 20 novas zonas (tudo além de vila/floresta)
  for (const id of Object.keys(TERRENOS)) pintarZonaGenerica(g, id);

  // Estradas conectando todas as regiões da grade, garantindo acesso a
  // partir da vila a qualquer zona do mapa expandido.
  carvearEstradas(g);

  // Garante que baús, nós de coleta e as entradas de masmorra nunca caiam
  // em um tile sólido.
  const pontosLivres = [
    ...CHESTS_OVERWORLD, ...NODES_OVERWORLD, DUNGEON_ENTRANCE, DUNGEON2_ENTRANCE,
  ];
  pontosLivres.forEach(({ x, y }) => {
    if (g[y] && SOLID_TILES.has(g[y][x])) g[y][x] = TILE.GRASS;
  });

  return g;
}

const DUNGEON_W = 18;
const DUNGEON_H = 12;

// Gera uma masmorra com corredores ramificados de verdade — várias rotas e
// desvios até o chefe, em vez de uma sala única com paredes decorativas
// (o que existia antes). Usa um labirinto por busca em profundidade
// aleatória ("recursive backtracker") numa grade de células em coordenadas
// ímpares dentro de [1, w-2] x [1, h-2]: cada célula vira 1 tile de chão, e
// a carva sempre visita TODAS as células (é uma árvore geradora do grafo de
// células), então qualquer duas células ficam sempre conectadas — a
// ramificação real vem do fato de que toda célula com mais de um vizinho
// aberto é um ponto de bifurcação onde o jogador precisa escolher um
// caminho, e a maioria das folhas vira um beco sem saída (ótimo lugar pra
// esconder um baú bônus).
//
// `pontosDeInteresse` é uma lista de { x, y } (spawn, chefe, baús, zona de
// saída) que PRECISAM ficar acessíveis mesmo que não caiam exatamente numa
// célula ímpar do labirinto — cada um é forçado a virar chão e, se preciso,
// ligado à célula do labirinto mais próxima por um corredor reto em L.
function buildMasmorraRamificada(w, h, pontosDeInteresse) {
  const g = grid(w, h, TILE.DUNGEON_WALL);
  const cellCols = Math.max(1, Math.floor((w - 2) / 2) + 1);
  const cellRows = Math.max(1, Math.floor((h - 2) / 2) + 1);
  const cellX = (cx) => 1 + cx * 2;
  const cellY = (cy) => 1 + cy * 2;
  const visitado = grid(cellCols, cellRows, false);

  function carve(cx, cy) {
    visitado[cy][cx] = true;
    g[cellY(cy)][cellX(cx)] = TILE.DUNGEON_FLOOR;
    const direcoes = [[0, -1], [0, 1], [-1, 0], [1, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of direcoes) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cellCols || ny >= cellRows || visitado[ny][nx]) continue;
      g[cellY(cy) + dy][cellX(cx) + dx] = TILE.DUNGEON_FLOOR; // abre a parede entre as duas células
      carve(nx, ny);
    }
  }
  carve(0, 0);

  const numaCelula = (x, y) => (x - 1) >= 0 && (x - 1) % 2 === 0 && (y - 1) >= 0 && (y - 1) % 2 === 0
    && (x - 1) / 2 < cellCols && (y - 1) / 2 < cellRows;

  function conectar(x, y) {
    if (!g[y] || g[y][x] === undefined) return;
    g[y][x] = TILE.DUNGEON_FLOOR;
    if (numaCelula(x, y)) return;
    // Ponto fora da grade de células do labirinto (ex.: um chefe/baú
    // posicionado num tile par) — acha a célula já esculpida mais próxima e
    // cava um corredor reto em L até ela, garantindo que nunca fique isolado
    // atrás de uma parede.
    let melhor = null, melhorDist = Infinity;
    for (let cy = 0; cy < cellRows; cy++) {
      for (let cx = 0; cx < cellCols; cx++) {
        const fx = cellX(cx), fy = cellY(cy);
        const d = Math.abs(fx - x) + Math.abs(fy - y);
        if (d < melhorDist) { melhorDist = d; melhor = { fx, fy }; }
      }
    }
    if (!melhor) return;
    let cx2 = x;
    const passoX = melhor.fx > cx2 ? 1 : -1;
    while (cx2 !== melhor.fx) { if (g[y][cx2] !== undefined) g[y][cx2] = TILE.DUNGEON_FLOOR; cx2 += passoX; }
    let cy2 = y;
    const passoY = melhor.fy > cy2 ? 1 : -1;
    while (cy2 !== melhor.fy) { if (g[cy2] && g[cy2][melhor.fx] !== undefined) g[cy2][melhor.fx] = TILE.DUNGEON_FLOOR; cy2 += passoY; }
  }

  pontosDeInteresse.forEach(({ x, y }) => conectar(x, y));
  return g;
}

function buildDungeon() {
  return buildMasmorraRamificada(DUNGEON_W, DUNGEON_H, [
    DUNGEON_SPAWN,
    ...CHESTS_DUNGEON.map(({ x, y }) => ({ x, y })),
    BOSS_TILE,
    { x: DUNGEON_EXIT_ZONE.x0, y: DUNGEON_EXIT_ZONE.y0 },
  ]);
}

// --- Segunda masmorra: Covil das Cinzas (sob a zona "covil_do_dragao") ---
const DUNGEON2_W = 16;
const DUNGEON2_H = 10;

function buildDungeon2() {
  return buildMasmorraRamificada(DUNGEON2_W, DUNGEON2_H, [
    DUNGEON2_SPAWN,
    ...CHESTS_DUNGEON2.map(({ x, y }) => ({ x, y })),
    BOSS_TILE2,
    { x: DUNGEON2_EXIT_ZONE.x0, y: DUNGEON2_EXIT_ZONE.y0 },
  ]);
}

// --- Objetos do mundo aberto ---
const CHESTS_OVERWORLD = [
  { id: "bau1", x: 18, y: 10, tier: "bau_comum", aberto: false },
  { id: "bau2", x: 23, y: 4, tier: "bau_comum", aberto: false },
  { id: "bau3", x: 30, y: 8, tier: "bau_raro", aberto: false },
  { id: "bau4", x: 40, y: 8, tier: "bau_comum", aberto: false },
  { id: "bau5", x: 58, y: 6, tier: "bau_comum", aberto: false },
  { id: "bau6", x: 75, y: 14, tier: "bau_raro", aberto: false },
  { id: "bau7", x: 95, y: 16, tier: "bau_raro", aberto: false },
  { id: "bau8", x: 6, y: 34, tier: "bau_comum", aberto: false },
  { id: "bau9", x: 22, y: 36, tier: "bau_comum", aberto: false },
  { id: "bau10", x: 39, y: 34, tier: "bau_raro", aberto: false },
  { id: "bau11", x: 60, y: 25, tier: "bau_comum", aberto: false },
  { id: "bau12", x: 78, y: 35, tier: "bau_raro", aberto: false },
  { id: "bau13", x: 93, y: 26, tier: "bau_epico", aberto: false },
  { id: "bau14", x: 7, y: 52, tier: "bau_comum", aberto: false },
  { id: "bau15", x: 20, y: 54, tier: "bau_raro", aberto: false },
  { id: "bau16", x: 44, y: 44, tier: "bau_raro", aberto: false },
  { id: "bau17", x: 56, y: 53, tier: "bau_epico", aberto: false },
  { id: "bau18", x: 74, y: 44, tier: "bau_raro", aberto: false },
  { id: "bau19", x: 92, y: 44, tier: "bau_epico", aberto: false },
  { id: "bau20", x: 9, y: 66, tier: "bau_raro", aberto: false },
  { id: "bau21", x: 28, y: 62, tier: "bau_epico", aberto: false },
  { id: "bau22", x: 48, y: 68, tier: "bau_epico", aberto: false },
  { id: "bau23", x: 65, y: 66, tier: "bau_lendario", aberto: false },
];

const NODES_OVERWORLD = [
  { id: "no1", x: 20, y: 12, tipo: "erva", disponivel: true },
  { id: "no2", x: 24, y: 14, tipo: "erva", disponivel: true },
  { id: "no3", x: 27, y: 10, tipo: "minerio", disponivel: true },
  { id: "no4", x: 19, y: 16, tipo: "madeira", disponivel: true },
  { id: "no5", x: 31, y: 5, tipo: "minerio", disponivel: true },
  { id: "no6", x: 45, y: 14, tipo: "erva", disponivel: true },
  { id: "no7", x: 63, y: 15, tipo: "minerio", disponivel: true },
  { id: "no8", x: 82, y: 7, tipo: "erva", disponivel: true },
  { id: "no9", x: 100, y: 6, tipo: "minerio", disponivel: true },
  { id: "no10", x: 11, y: 26, tipo: "erva", disponivel: true },
  { id: "no11", x: 29, y: 25, tipo: "minerio", disponivel: true },
  { id: "no12", x: 46, y: 26, tipo: "madeira", disponivel: true },
  { id: "no13", x: 65, y: 35, tipo: "erva", disponivel: true },
  { id: "no14", x: 83, y: 26, tipo: "minerio", disponivel: true },
  { id: "no15", x: 99, y: 35, tipo: "minerio", disponivel: true },
  { id: "no16", x: 12, y: 44, tipo: "erva", disponivel: true },
  { id: "no17", x: 28, y: 44, tipo: "minerio", disponivel: true },
  { id: "no18", x: 38, y: 53, tipo: "erva", disponivel: true },
  { id: "no19", x: 64, y: 44, tipo: "madeira", disponivel: true },
  { id: "no20", x: 81, y: 53, tipo: "minerio", disponivel: true },
  { id: "no21", x: 100, y: 53, tipo: "minerio", disponivel: true },
  { id: "no22", x: 5, y: 62, tipo: "erva", disponivel: true },
  { id: "no23", x: 20, y: 67, tipo: "minerio", disponivel: true },
  { id: "no24", x: 50, y: 64, tipo: "minerio", disponivel: true },
  { id: "no25", x: 56, y: 62, tipo: "minerio", disponivel: true },
];

const NPC_POSICOES = {
  npc_fazendeiro: { x: 4, y: 4 },
  npc_cacador: { x: 10, y: 9 },
  npc_anciao: { x: 3, y: 11 },
  npc_guarda: { x: 13, y: 3 },
  npc_mercador: { x: 8, y: 11 },
};

const DUNGEON_ENTRANCE = { x: 31, y: 16 };
const DUNGEON_SPAWN = { x: 4, y: 6 };
const DUNGEON_EXIT_ZONE = { x0: 1, y0: 1, x1: 1, y1: 1 };

const CHESTS_DUNGEON = [
  { id: "bau_dungeon1", x: 14, y: 8, tier: "bau_epico", aberto: false },
  // Baú secreto: fica escondido numa das ramificações do labirinto (a
  // posição exata do desvio muda a cada visita, já que a masmorra é
  // reconstruída sempre que o jogador entra) — recompensa quem explora além
  // da rota direta até o chefe.
  { id: "bau_dungeon1_secreto", x: 3, y: 9, tier: "bau_epico", aberto: false },
];

const BOSS_TILE = { x: 15, y: 2, monstroId: "dragao_jovem" };

// Segunda masmorra (Covil das Cinzas), sob a zona "covil_do_dragao".
const DUNGEON2_ENTRANCE = { x: 44, y: 68 };
const DUNGEON2_SPAWN = { x: 2, y: 5 };
const DUNGEON2_EXIT_ZONE = { x0: 1, y0: 1, x1: 1, y1: 1 };

const CHESTS_DUNGEON2 = [
  { id: "bau_dungeon2_1", x: 12, y: 6, tier: "bau_lendario", aberto: false },
  // Baú secreto numa ramificação do labirinto — mesma ideia do da primeira
  // masmorra.
  { id: "bau_dungeon2_secreto", x: 3, y: 7, tier: "bau_epico", aberto: false },
];

const BOSS_TILE2 = { x: 13, y: 2, monstroId: "arauto_das_cinzas" };

  return { TILE, TILE_SIZE, SOLID_TILES, ENCOUNTER_BIOMA, OVERWORLD_W, OVERWORLD_H, ZONAS, zonaNoPonto, buildOverworld, DUNGEON_W, DUNGEON_H, buildDungeon, DUNGEON2_W, DUNGEON2_H, buildDungeon2, CHESTS_OVERWORLD, NODES_OVERWORLD, NPC_POSICOES, DUNGEON_ENTRANCE, DUNGEON_SPAWN, DUNGEON_EXIT_ZONE, CHESTS_DUNGEON, BOSS_TILE, DUNGEON2_ENTRANCE, DUNGEON2_SPAWN, DUNGEON2_EXIT_ZONE, CHESTS_DUNGEON2, BOSS_TILE2 };
})();

const MOD_src_render_Renderer_js = (function(){
  const TILE_SIZE = MOD_src_data_worldMap_js.TILE_SIZE;
// Desenha o mapa em tiles e as entidades (jogador, NPCs, objetos) no canvas.


const TILE_ORDER = [
  "grass", "grass_detail", "path", "water", "tree", "wall_stone",
  "dungeon_floor", "dungeon_wall", "sand", "tall_grass", "village_floor", "bush",
];

class Renderer {
  constructor(canvas, imagens) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.imagens = imagens;
    this.tilesetTileW = 64; // cada tile no tileset ja esta em 64x64 (upscale do gerador)
  }

  camera(playerPx, mapaWpx, mapaHpx) {
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    let cx = playerPx.x - vw / 2;
    let cy = playerPx.y - vh / 2;
    cx = Math.max(0, Math.min(cx, Math.max(0, mapaWpx - vw)));
    cy = Math.max(0, Math.min(cy, Math.max(0, mapaHpx - vh)));
    return { x: cx, y: cy };
  }

  desenhar({ grid, player, npcs, objetos, mostrarPronto }) {
    const ctx = this.ctx;
    const mapaWpx = grid[0].length * TILE_SIZE;
    const mapaHpx = grid.length * TILE_SIZE;
    const playerPx = { x: player.x * TILE_SIZE + TILE_SIZE / 2, y: player.y * TILE_SIZE + TILE_SIZE / 2 };
    const cam = this.camera(playerPx, mapaWpx, mapaHpx);

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const tileset = this.imagens.tileset;
    const colStart = Math.max(0, Math.floor(cam.x / TILE_SIZE));
    const rowStart = Math.max(0, Math.floor(cam.y / TILE_SIZE));
    const colEnd = Math.min(grid[0].length - 1, Math.ceil((cam.x + this.canvas.width) / TILE_SIZE));
    const rowEnd = Math.min(grid.length - 1, Math.ceil((cam.y + this.canvas.height) / TILE_SIZE));

    for (let ty = rowStart; ty <= rowEnd; ty++) {
      for (let tx = colStart; tx <= colEnd; tx++) {
        const idx = grid[ty][tx];
        const sx = idx * this.tilesetTileW;
        const dx = tx * TILE_SIZE - cam.x;
        const dy = ty * TILE_SIZE - cam.y;
        ctx.drawImage(tileset, sx, 0, this.tilesetTileW, this.tilesetTileW, dx, dy, TILE_SIZE, TILE_SIZE);
      }
    }

    // objetos (baus, nos de coleta, entrada de masmorra)
    objetos.forEach((o) => {
      const img = this.imagens[o.imgKey];
      if (!img) return;
      const dx = o.x * TILE_SIZE - cam.x;
      const dy = o.y * TILE_SIZE - cam.y;
      if (dx < -TILE_SIZE || dy < -TILE_SIZE || dx > this.canvas.width || dy > this.canvas.height) return;
      ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
    });

    // npcs
    (npcs || []).forEach((n) => {
      const img = this.imagens[n.id] || this.imagens.npc_marker;
      const dx = n.x * TILE_SIZE - cam.x;
      const dy = n.y * TILE_SIZE - cam.y;
      ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#f1e9d8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.nome, dx + TILE_SIZE / 2, dy - 4);
    });

    // jogador (spritesheet 4 frames de 64x64: idle, walk1, idle, walk2)
    const sheet = this.imagens[player.spriteKey];
    if (sheet) {
      const frame = player.frame || 0;
      const sx = frame * 64;
      const dx = playerPx.x - cam.x - 32;
      const dy = playerPx.y - cam.y - 48;
      ctx.save();
      if (player.dir === "esquerda") {
        ctx.translate(dx + 64, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, sx, 0, 64, 64, 0, 0, 64, 64);
      } else {
        ctx.drawImage(sheet, sx, 0, 64, 64, dx, dy, 64, 64);
      }
      ctx.restore();
    }

    if (mostrarPronto) {
      ctx.fillStyle = "rgba(245,165,36,0.9)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(mostrarPronto, this.canvas.width / 2, 28);
    }
  }
}


  return { Renderer, TILE_ORDER };
})();

const MOD_src_systems_AffinitySystem_js = (function(){
// Sistema de Afinidade racial de classe (task #41): cada raça tem afinidade
// natural com 1 ou mais classes (ver src/data/affinities.json) — quando a
// combinação raça+classe do personagem bate com essa lista, ele ganha um
// bônus de combate extra, sempre no mesmo formato de bonusArvore() em
// CharacterFactory.js (FOR/DES/CON/INT/hpMaxPercent/mpMaxPercent/
// critChance/defesaFlat), somado exatamente do mesmo jeito. Fora da
// combinação, nenhum bônus — afinidade é sempre uma vantagem opcional a
// considerar na escolha de classe, nunca uma penalidade pra quem escolhe
// outra coisa.
const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

// Retorna a entrada de afinidade (classesAfins/bonus/texto) da raça, só se a
// classe informada estiver na lista de afins dela — ou null.
function afinidadeDe(racaId, classeId, dadosAfinidades) {
  const entrada = dadosAfinidades && dadosAfinidades[racaId];
  if (!entrada || !Array.isArray(entrada.classesAfins) || !entrada.classesAfins.includes(classeId)) return null;
  return entrada;
}

// Bônus pronto pra somar em atributosEfetivos/defesaTotal/calcularHpMax/
// calcularMpMax/critBonusTotal (CharacterFactory.js) — sempre retorna um
// objeto completo (todos os campos zerados quando não há afinidade), igual
// ao contrato de bonusArvore().
function bonusAfinidade(personagem, dados) {
  if (!dados || !dados.affinities) return { ...BONUS_VAZIO };
  const entrada = afinidadeDe(personagem.racaId, personagem.classeId, dados.affinities);
  if (!entrada) return { ...BONUS_VAZIO };
  return { ...BONUS_VAZIO, ...entrada.bonus };
}

// Versão "para UI": texto pronto pra exibir (cartas de criação, coleção do
// gacha, etc.) — null quando a combinação não tem afinidade.
function infoAfinidade(racaId, classeId, dadosAfinidades) {
  const entrada = afinidadeDe(racaId, classeId, dadosAfinidades);
  if (!entrada) return null;
  return { texto: entrada.texto, bonus: entrada.bonus };
}

  return { afinidadeDe, bonusAfinidade, infoAfinidade };
})();

const MOD_src_systems_BondSystem_js = (function(){
// Vínculo de campanheirismo (melhoria de jogabilidade pós-backlog original):
// cenas narrativas curtas entre o herói (personagem principal) e cada
// convocado do gacha, desbloqueadas por marcos de NÍVEL do próprio
// convocado (ver LIMIARES_VINCULO) — 3 tiers ao todo. Cada cena oferece uma
// escolha de TOM (mais caloroso ou mais reservado) que é só narrativa: as
// duas opções concedem exatamente o mesmo bônus mecânico, nunca uma
// vantagem de poder por "escolher certo" (guardrail do jogo: não
// recompensar somente poder bruto; oferecer expressão, sinergia, descoberta
// e história). O bônus acumulado entra na mesma composição de bonusTotal()
// usada por árvore de habilidades e afinidade racial (ver
// CharacterFactory.js) — vale automaticamente em atributos/defesa/HP/MP/
// crítico sem duplicar nenhuma lógica de aplicação, só precisa registrar a
// escolha (ver bonusVinculo, importado por CharacterFactory.js).
//
// Diferente de AffinitySystem.js (afinidade RAÇA+CLASSE, estático, nunca
// evolui) e de AwakeningSystem.js (Despertar de Arma Secreta — narrativa
// sobre o EQUIPAMENTO do convocado, não sobre a relação dele com o herói):
// vínculo é sobre a relação interpessoal, evolui com o tempo jogado, e é o
// único desses três sistemas que dá ao jogador uma escolha real (de tom,
// não de poder).
//
// IMPORTANTE: este arquivo nunca importa de CharacterFactory.js (só o
// contrário acontece) — evita import circular, já que CharacterFactory.js
// importa bonusVinculo daqui pra somar em bonusTotal(). O recálculo de
// hp/mpMax após um tier ser completado (quando o bônus inclui
// hpMaxPercent/mpMaxPercent) é responsabilidade de quem chama
// escolherTomVinculo (ver BondUI.js), exatamente como aplicarEscolhaArvore
// faz internamente em CharacterFactory.js pro ramo passivo da árvore.

const LIMIARES_VINCULO = [3, 7, 12];

const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

const BONUS_POR_TIER = [
  { ...BONUS_VAZIO, CON: 1 },
  { ...BONUS_VAZIO, critChance: 0.02 },
  { ...BONUS_VAZIO, hpMaxPercent: 0.03 },
];

const TOM_CALOROSO = "caloroso";
const TOM_RESERVADO = "reservado";

// 6 classes x 3 tiers = 18 cenas. `texto`/`resposta` usam os placeholders
// {nome} (convocado) e {heroi} (personagem principal), substituídos em
// cenaVinculo() na hora de exibir — nunca guardados já resolvidos, pra não
// precisar reprocessar nada se o jogador trocar de personagem principal
// (ex.: New Game+).
const TEMPLATES_VINCULO = {
  guerreiro: [
    {
      titulo: "Primeiras Impressões",
      texto: "{nome} limpa a lâmina em silêncio depois da batalha e nota que {heroi} ainda está por perto. \"Lutou bem hoje\", diz, sem tirar os olhos da lâmina. É o tipo de elogio que não se repete fácil.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Retribuir o elogio", resposta: "{heroi} sorri e devolve o elogio sem cerimônia — {nome} pisca, pega de surpresa, e um sorriso pequeno escapa antes que consiga escondê-lo." },
        { id: TOM_RESERVADO, rotulo: "Só acenar com a cabeça", resposta: "{heroi} aceita o elogio com um aceno simples. {nome} entende — palavras não são o forte de nenhum dos dois — e volta a cuidar da arma, satisfeita(o) com o silêncio compartilhado." },
      ],
    },
    {
      titulo: "A Cicatriz",
      texto: "Enquanto descansam no acampamento, {nome} mostra uma cicatriz antiga no braço. \"Foi o preço de uma lição que não esqueci\", diz, sem entrar em detalhes — mas os olhos dizem que a história pesa.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Perguntar o que aconteceu", resposta: "{nome} hesita, depois conta a história inteira, aliviada(o) por finalmente dividir o peso com alguém — o vínculo entre os dois fica mais forte que qualquer armadura." },
        { id: TOM_RESERVADO, rotulo: "Respeitar o silêncio", resposta: "{heroi} não insiste. {nome} agradece com um olhar — algumas histórias só se contam quando a pessoa certa souber esperar." },
      ],
    },
    {
      titulo: "Lado a Lado",
      texto: "\"Já lutei sozinha(o) a vida toda\", diz {nome}, olhando o acampamento movimentado ao redor. \"Não esperava que lutar ao lado de alguém fizesse tanta diferença.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que confia plenamente nela(e)", resposta: "{nome} baixa a guarda pela primeira vez desde que se conheceram — não é fraqueza, é a confiança que só se constrói em combate de verdade." },
        { id: TOM_RESERVADO, rotulo: "Deixar as ações falarem por si", resposta: "{heroi} não precisa dizer nada — {nome} já viu o suficiente em batalha pra saber que pode contar com ele(a), e isso basta." },
      ],
    },
  ],
  mago: [
    {
      titulo: "Uma Pergunta Curiosa",
      texto: "{nome} folheia um grimório à luz da fogueira e, sem levantar os olhos, pergunta: \"{heroi}, você já se perguntou por que a magia obedece a certas regras e não outras?\" É óbvio que a pergunta é só um pretexto pra puxar assunto.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Sentar e conversar sobre o assunto", resposta: "{nome} se anima como raramente acontece, e a conversa se estende noite adentro — {heroi} entende que, pra ela(e), curiosidade compartilhada é a forma mais sincera de amizade." },
        { id: TOM_RESERVADO, rotulo: "Responder rápido e voltar ao que fazia", resposta: "{nome} aceita a resposta breve sem se ofender, mas anota mentalmente o assunto pra outra hora — a curiosidade dela(e) não desiste fácil." },
      ],
    },
    {
      titulo: "O Feitiço que Deu Errado",
      texto: "{nome} confessa, meio sem graça, um feitiço que saiu terrivelmente errado nos primeiros estudos. \"Quase incendiei a própria biblioteca\", admite, tentando (e falhando) parecer indiferente.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Rir junto e pedir mais detalhes", resposta: "{nome} relaxa ao ver que {heroi} não vai julgá-la(o) por isso, e a história vira uma das piadas favoritas do grupo." },
        { id: TOM_RESERVADO, rotulo: "Elogiar o quanto ela(e) evoluiu desde então", resposta: "{nome} aceita o elogio com um aceno modesto — vindo de {heroi}, o reconhecimento vale mais do que qualquer risada." },
      ],
    },
    {
      titulo: "Teoria e Prática",
      texto: "\"Estudei magia a vida toda em livros\", diz {nome}, guardando o grimório. \"Mas foi lutando ao seu lado que finalmente entendi o que ela realmente é.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que aprendeu igualmente com ela(e)", resposta: "{nome} sorri, genuinamente tocada(o) — a troca de conhecimento virou, sem que nenhum dos dois notasse, uma amizade de verdade." },
        { id: TOM_RESERVADO, rotulo: "Concordar em poucas palavras", resposta: "{nome} não precisa de mais que isso — o respeito mútuo entre os dois já fala por si." },
      ],
    },
  ],
  ladino: [
    {
      titulo: "Um Teste de Confiança",
      texto: "{nome} devolve, sem dizer nada, uma bolsa de moedas que \"esqueceu\" de roubar de {heroi} na primeira noite. \"Só queria ver se você notaria\", diz com um sorriso torto.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Rir da brincadeira", resposta: "{nome} relaxa os ombros — {heroi} passou no teste sem nem saber que estava sendo testado(a), e isso conta mais do que qualquer palavra." },
        { id: TOM_RESERVADO, rotulo: "Avisar que da próxima vez não vai rir", resposta: "{nome} solta uma risada curta, genuinamente impressionada(o) — respeito de quem não se deixa levar é raro." },
      ],
    },
    {
      titulo: "Regras Próprias",
      texto: "\"Nunca confiei em ninguém que não tivesse provado o valor primeiro\", diz {nome}, observando {heroi} de esguelha. \"Você ainda não me deu motivo pra duvidar. É... incomum.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que a confiança é mútua", resposta: "{nome} desvia o olhar, sem graça — não está acostumada(o) a esse tipo de sinceridade, mas guarda a frase com mais carinho do que admite." },
        { id: TOM_RESERVADO, rotulo: "Deixar por isso mesmo, sem grandes declarações", resposta: "{nome} aprecia exatamente esse estilo — nenhum dos dois precisa de discursos pra saber onde estão." },
      ],
    },
    {
      titulo: "Sem Truques",
      texto: "{nome} guarda as ferramentas de arrombamento pela primeira vez sem checar se {heroi} está olhando. \"Não preciso mais fingir por perto de você\", admite, quase sem querer.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que sempre pôde ser ela(e) mesma(o)", resposta: "{nome} fica quieta(o) por um instante — é o tipo de coisa que ninguém tinha dito antes, e o silêncio depois diz tudo." },
        { id: TOM_RESERVADO, rotulo: "Só sorrir de volta", resposta: "{nome} entende o sorriso melhor do que entenderia qualquer discurso — entre os dois, isso já basta." },
      ],
    },
  ],
  clerigo: [
    {
      titulo: "Uma Bênção Silenciosa",
      texto: "Antes da batalha, {nome} sussurra uma prece breve — não só pela vitória, mas por {heroi}, especificamente. Percebe que foi ouvida(o) e fica visivelmente sem graça.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Agradecer pela preocupação", resposta: "{nome} sorri, aliviada(o) — cuidar dos outros é natural para ela(e), mas ser notada(o) por isso ainda a(o) emociona um pouco." },
        { id: TOM_RESERVADO, rotulo: "Fingir não ter ouvido, por respeito", resposta: "{nome} aprecia o gesto discreto de {heroi} — algumas devoções são mais sinceras quando ninguém precisa comentar sobre elas." },
      ],
    },
    {
      titulo: "Dúvidas de Fé",
      texto: "\"Às vezes me pergunto se estou realmente curando por fé ou só por hábito\", confessa {nome}, olhando as próprias mãos. É raro vê-la(o) tão insegura(o).",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Garantir que a fé dela(e) sempre ajudou o grupo", resposta: "{nome} respira fundo, visivelmente aliviada(o) — às vezes só precisava ouvir isso de alguém em quem confia." },
        { id: TOM_RESERVADO, rotulo: "Dizer que as dúvidas fazem parte da fé de verdade", resposta: "{nome} pondera a frase por um longo momento antes de assentir devagar — talvez {heroi} tenha razão." },
      ],
    },
    {
      titulo: "Um Propósito Renovado",
      texto: "\"Vim pra este caminho pra servir a um ideal\", diz {nome}. \"Não esperava que servir ao seu lado desse a esse ideal um rosto de verdade.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que a fé dela(e) também guia {heroi}", resposta: "{nome} segura a mão de {heroi} por um instante, em silêncio — é o tipo de gratidão que não cabe em palavras." },
        { id: TOM_RESERVADO, rotulo: "Aceitar as palavras com um aceno solene", resposta: "{nome} entende o gesto contido de {heroi} como o que é: um respeito profundo, dito à sua própria maneira." },
      ],
    },
  ],
  barbaro: [
    {
      titulo: "Um Desafio Amistoso",
      texto: "{nome} bate o peito e desafia {heroi} pra um teste de força — \"só pra ver do que você é feita(o)\", diz com um sorriso largo. Claramente não é sobre vencer.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Topar o desafio de bom grado", resposta: "{nome} solta uma gargalhada, seja lá quem vencer — o que importa é que {heroi} não recuou." },
        { id: TOM_RESERVADO, rotulo: "Recusar com educação, mas elogiar a força dela(e)", resposta: "{nome} respeita a recusa sem ressentimento — força também é saber escolher suas batalhas." },
      ],
    },
    {
      titulo: "Fúria e Controle",
      texto: "\"Nem sempre foi fácil segurar a fúria\", admite {nome}, olhando as mãos calejadas. \"Lutar ao seu lado me ajudou a entender quando soltá-la e quando guardá-la.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que confia no controle dela(e)", resposta: "{nome} se ergue um pouco mais orgulhosa(o) — vindo de {heroi}, essa confiança pesa mais do que qualquer vitória." },
        { id: TOM_RESERVADO, rotulo: "Concordar sem alarde", resposta: "{nome} aprecia que {heroi} não faça drama disso — só reconhece o esforço, e é o suficiente." },
      ],
    },
    {
      titulo: "A Alcateia",
      texto: "\"Minha gente diz que a força de um guerreiro se mede pela alcateia que ele escolhe\", diz {nome}. \"Escolhi bem, ao que parece.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que também escolheu bem", resposta: "{nome} solta um grito de guerra animado — é a forma dela(e) de dizer \"eu também\", alto o bastante pro acampamento inteiro ouvir." },
        { id: TOM_RESERVADO, rotulo: "Bater o punho no peito, em sinal de respeito", resposta: "{nome} retribui o gesto na mesma moeda — entre guerreiros, esse é o cumprimento que mais vale." },
      ],
    },
  ],
  patrulheiro: [
    {
      titulo: "Trilha Compartilhada",
      texto: "{nome} aponta pegadas quase invisíveis no chão e ensina {heroi} a lê-las. \"A trilha conta histórias, se você souber prestar atenção\", diz, claramente orgulhosa(o) do próprio ofício.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Pedir pra aprender mais", resposta: "{nome} se ilumina — poucas coisas a(o) deixam tão feliz quanto compartilhar o que sabe com alguém interessado de verdade." },
        { id: TOM_RESERVADO, rotulo: "Observar em silêncio e aprender fazendo", resposta: "{nome} aprova o silêncio atento de {heroi} — é assim que ela(e) mesma(o) aprendeu, olhando e fazendo." },
      ],
    },
    {
      titulo: "Raízes",
      texto: "\"A estrada é minha casa há tanto tempo que esqueci como é ficar parada(o)\", admite {nome}, olhando o horizonte. \"Viajar com vocês... é o mais perto de um lar que tive em anos.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que ela(e) sempre terá um lugar no grupo", resposta: "{nome} sorri de um jeito que raramente se permite — a estrada continua sendo casa, mas agora tem companhia de verdade." },
        { id: TOM_RESERVADO, rotulo: "Deixar a paisagem falar por si, em silêncio companheiro", resposta: "{nome} aprecia o silêncio tanto quanto apreciaria qualquer palavra — algumas companhias não precisam de discurso." },
      ],
    },
    {
      titulo: "Um Novo Horizonte",
      texto: "\"Rastreei quase todo tipo de criatura que existe\", diz {nome}, guardando o arco. \"Mas nunca imaginei que rastrear um caminho ao seu lado valeria tanto a pena.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que pretende seguir esse caminho junto dela(e)", resposta: "{nome} assente devagar, os olhos brilhando — é uma promessa que os dois pretendem cumprir." },
        { id: TOM_RESERVADO, rotulo: "Só continuar caminhando ao lado dela(e)", resposta: "{nome} entende: algumas promessas se fazem andando, não falando — e isso já diz tudo." },
      ],
    },
  ],
};

function preencherPlaceholders(texto, nome, heroi) {
  return texto.replaceAll("{nome}", nome).replaceAll("{heroi}", heroi);
}

function garantirVinculo(instancia) {
  if (!instancia.vinculo) instancia.vinculo = { tier: 0, escolhas: [] };
  if (typeof instancia.vinculo.tier !== "number") instancia.vinculo.tier = 0;
  if (!Array.isArray(instancia.vinculo.escolhas)) instancia.vinculo.escolhas = [];
  return instancia.vinculo;
}

// Soma de todos os tiers já completados — mesmo formato de bonusArvore/
// bonusAfinidade em CharacterFactory.js, pronto pra entrar em bonusTotal().
// Só convocados do gacha têm `.vinculo` — o personagem principal nunca tem,
// então essa função sempre retorna o bônus vazio pra ele (comportamento
// idêntico a antes deste sistema existir).
function bonusVinculo(personagem) {
  const v = personagem && personagem.vinculo;
  if (!v || !v.tier) return { ...BONUS_VAZIO };
  const total = { ...BONUS_VAZIO };
  for (let i = 0; i < v.tier && i < BONUS_POR_TIER.length; i++) {
    Object.keys(total).forEach((k) => { total[k] += BONUS_POR_TIER[i][k] || 0; });
  }
  return total;
}

// Tier da próxima cena disponível (0, 1 ou 2), ou null se o nível do
// convocado ainda não chegou lá ou se já viu todas as cenas.
function proximoTierDisponivel(instancia) {
  const v = garantirVinculo(instancia);
  if (v.tier >= LIMIARES_VINCULO.length) return null;
  return (instancia.nivel || 1) >= LIMIARES_VINCULO[v.tier] ? v.tier : null;
}

// Monta a cena disponível agora (com os placeholders já resolvidos) pra
// UI exibir, ou null se não há nenhuma pendente. Nunca muta nada — só
// escolherTomVinculo aplica de fato a escolha.
function cenaVinculo(instancia, personagem) {
  const tier = proximoTierDisponivel(instancia);
  if (tier === null) return null;
  const porClasse = TEMPLATES_VINCULO[instancia.classeId];
  if (!porClasse || !porClasse[tier]) return null;
  const bruto = porClasse[tier];
  const nome = instancia.nome;
  const heroi = (personagem && personagem.nome) || "o herói";
  return {
    tier,
    titulo: bruto.titulo,
    texto: preencherPlaceholders(bruto.texto, nome, heroi),
    escolhas: bruto.escolhas.map((e) => ({ ...e, resposta: preencherPlaceholders(e.resposta, nome, heroi) })),
    bonus: BONUS_POR_TIER[tier],
  };
}

// Aplica a escolha de tom: avança o tier (a próxima cena só libera no
// próximo marco de nível) e registra a escolha (só pra histórico/flavor —
// nunca lida de volta pra decidir bônus, já que os dois tons dão o mesmo).
// NÃO recalcula hp/mpMax aqui de propósito (ver nota do arquivo) — quem
// chama isso e tem acesso a `dados` (BondUI.js) faz esse recálculo depois,
// igual ao padrão já usado por aplicarEscolhaArvore/despertar.
function escolherTomVinculo(instancia, tomId) {
  const tier = proximoTierDisponivel(instancia);
  if (tier === null) return { ok: false };
  const v = garantirVinculo(instancia);
  v.escolhas.push({ tier, tom: tomId });
  v.tier = tier + 1;
  return { ok: true, tier, bonus: BONUS_POR_TIER[tier] };
}

// Resumo pronto pra exibir num card da coleção (GachaUI.js), no mesmo
// espírito de estadoDespertarResumo (AwakeningUI.js).
function resumoVinculoParaCard(instancia) {
  const v = garantirVinculo(instancia);
  if (v.tier >= LIMIARES_VINCULO.length) return { texto: "💞 Vínculo completo", classe: "vinculo-completo" };
  const proximoNivel = LIMIARES_VINCULO[v.tier];
  if ((instancia.nivel || 1) >= proximoNivel) return { texto: "💬 Cena de vínculo disponível!", classe: "vinculo-disponivel" };
  return { texto: `🔒 Vínculo no Nv. ${proximoNivel}`, classe: "vinculo-bloqueado" };
}

  return { LIMIARES_VINCULO, garantirVinculo, bonusVinculo, proximoTierDisponivel, cenaVinculo, escolherTomVinculo, resumoVinculoParaCard };
})();

const MOD_src_systems_SetBonusSystem_js = (function(){
// Sets de equipamento (melhoria de jogabilidade pós-backlog original): um
// pequeno número de peças de armadura/acessório já existentes em
// items.json formam conjuntos temáticos — vestir 2 (ou, em alguns casos, o
// conjunto inteiro) dá um bônus extra, além do que cada peça já dá sozinha.
// Cria uma razão pra escolher um "visual"/tema de build em vez de só pegar
// sempre o item com o maior número (guardrail do jogo: oferecer expressão,
// sinergia e descoberta, não só poder bruto).
//
// Mesmo formato de bonusArvore/bonusAfinidade/bonusVinculo
// (CharacterFactory.js), somado exatamente do mesmo jeito dentro de
// bonusTotal() — vale automaticamente em atributos/defesa/HP/MP/crítico sem
// duplicar nenhuma lógica de aplicação em batalha/forja/etc.
//
// Diferente dos outros três bônus (árvore/afinidade/vínculo, todos ganhos
// permanentemente e independentes do que está equipado agora), o bônus de
// conjunto depende do EQUIPAMENTO ATUAL — pode ligar e desligar a qualquer
// momento que o jogador troca de peça, então é recalculado toda vez, nunca
// "guardado" no personagem.
//
// IMPORTANTE: este arquivo nunca importa de CharacterFactory.js (só o
// contrário acontece) — mesmo cuidado de import circular de BondSystem.js.

const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

// Cada conjunto lista os IDs de item (ver items.json) que contam pra ele e
// os "degraus" de bônus por quantidade de peças vestidas — os bônus de
// degraus diferentes SOMAM entre si (vestir o conjunto inteiro dá o bônus
// de 2 peças E o de peça completa ao mesmo tempo), no espírito de sets de
// RPG onde cada limiar é um bônus adicional, não substituto.
const SETS_DE_EQUIPAMENTO = [
  {
    id: "andarilho",
    nome: "Conjunto do Andarilho",
    pecas: ["armadura_comum", "elmo_comum", "botas_comum", "escudo_comum"],
    tiers: [
      { pecas: 2, bonus: { ...BONUS_VAZIO, DES: 1 } },
      { pecas: 4, bonus: { ...BONUS_VAZIO, defesaFlat: 2 } },
    ],
  },
  {
    id: "vigilante_elfico",
    nome: "Conjunto do Vigilante Élfico",
    pecas: ["armadura_epico", "elmo_epico", "botas_epico"],
    tiers: [
      { pecas: 2, bonus: { ...BONUS_VAZIO, critChance: 0.03 } },
      { pecas: 3, bonus: { ...BONUS_VAZIO, DES: 2 } },
    ],
  },
  {
    id: "guardiao_eterno",
    nome: "Conjunto do Guardião Eterno",
    pecas: ["armadura_lendario", "elmo_lendario", "botas_lendario", "escudo_lendario"],
    tiers: [
      { pecas: 2, bonus: { ...BONUS_VAZIO, hpMaxPercent: 0.04 } },
      { pecas: 4, bonus: { ...BONUS_VAZIO, defesaFlat: 4 } },
    ],
  },
];

// Quantas peças de um conjunto específico o personagem tem equipadas agora
// (olha só personagem.equipamento — os 7 slots fixos, nunca a mochila).
function pecasEquipadasDoConjunto(personagem, setDef) {
  if (!personagem || !personagem.equipamento) return 0;
  return Object.values(personagem.equipamento).filter((item) => item && setDef.pecas.includes(item.id)).length;
}

// Os degraus (tiers) já alcançados de um conjunto específico, na ordem
// definida em SETS_DE_EQUIPAMENTO.
function tiersAtivosDoConjunto(personagem, setDef) {
  const n = pecasEquipadasDoConjunto(personagem, setDef);
  return setDef.tiers.filter((t) => n >= t.pecas);
}

// Soma o bônus de TODOS os conjuntos ativos agora — pronto pra entrar em
// bonusTotal() (CharacterFactory.js), mesmo contrato de bonusArvore/
// bonusAfinidade/bonusVinculo.
function bonusConjunto(personagem) {
  const total = { ...BONUS_VAZIO };
  if (!personagem || !personagem.equipamento) return total;
  for (const setDef of SETS_DE_EQUIPAMENTO) {
    tiersAtivosDoConjunto(personagem, setDef).forEach((t) => {
      Object.keys(total).forEach((k) => { total[k] += t.bonus[k] || 0; });
    });
  }
  return total;
}

// Resumo de cada conjunto pronto pra UI (Inventário — ver GameUI.js): só
// lista conjuntos com pelo menos 1 peça equipada, pra não poluir a tela com
// conjuntos totalmente irrelevantes pro personagem atual.
function conjuntosParaExibir(personagem) {
  return SETS_DE_EQUIPAMENTO
    .map((setDef) => {
      const equipadas = pecasEquipadasDoConjunto(personagem, setDef);
      if (equipadas === 0) return null;
      const tiersAtivos = tiersAtivosDoConjunto(personagem, setDef);
      const proximoTier = setDef.tiers.find((t) => t.pecas > equipadas) || null;
      return {
        id: setDef.id,
        nome: setDef.nome,
        equipadas,
        total: setDef.pecas.length,
        tiersAtivos: tiersAtivos.length,
        proximoTierEm: proximoTier ? proximoTier.pecas : null,
      };
    })
    .filter(Boolean);
}

  return { SETS_DE_EQUIPAMENTO, pecasEquipadasDoConjunto, tiersAtivosDoConjunto, bonusConjunto, conjuntosParaExibir };
})();

const MOD_src_systems_CharacterFactory_js = (function(){
  const bonusAfinidade = MOD_src_systems_AffinitySystem_js.bonusAfinidade;
  const bonusVinculo = MOD_src_systems_BondSystem_js.bonusVinculo;
  const bonusConjunto = MOD_src_systems_SetBonusSystem_js.bonusConjunto;
// Cria e evolui personagens jogáveis a partir dos dados de raça/classe/antecedente.




function xpParaNivel(nivel) {
  return Math.round(30 * Math.pow(nivel, 1.5));
}

function criarPersonagem({ nome, raca, classe, antecedente, traco }, dados) {
  const r = dados.races.find((x) => x.id === raca);
  const c = dados.classes.find((x) => x.id === classe);
  const b = dados.backgrounds.find((x) => x.id === antecedente);
  const t = dados.traits.find((x) => x.id === traco);

  const atributos = { FOR: c.atributosBase.FOR, DES: c.atributosBase.DES, CON: c.atributosBase.CON, INT: c.atributosBase.INT };
  Object.entries(r.bonus).forEach(([k, v]) => (atributos[k] += v));

  const hpMax = c.vidaBase + atributos.CON * 3;
  const mpMax = c.manaBase + atributos.INT * 2;

  let ouro = b.ouroInicial;
  if (traco === "ganancioso") ouro = Math.round(ouro * 0.8);

  const inventario = [];
  if (b.itemInicial) {
    const item = dados.items.itens.find((i) => i.id === b.itemInicial);
    if (item) inventario.push({ ...item, uid: cryptoId() });
  }

  const personagem = {
    nome,
    racaId: raca,
    classeId: classe,
    antecedenteId: antecedente,
    tracoId: traco,
    racaNome: r.nome,
    classeNome: c.nome,
    classeIcone: c.icone || "", // task #41: classe evidente na HUD
    descricaoTraco: t.descricao,
    nivel: 1,
    xp: 0,
    xpProximo: xpParaNivel(1),
    atributos,
    hpMax,
    hp: hpMax,
    mpMax,
    mp: mpMax,
    ouro,
    inventario,
    equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
    habilidades: c.habilidades.map((h) => ({ ...h, cooldownAtual: 0 })),
    missoesAtivas: [],
    missoesConcluidas: [],
    spriteKey: `pc_${raca}_${classe}`,
    biomaVisitados: [],
    arvore: { escolhas: [] },
    ngPlus: 0, // New Game+ (melhoria pós-backlog original, ver NewGamePlusSystem.js)
    // Modo História (melhoria pós-backlog): escolhido na criação de
    // personagem (ver CharacterCreationUI.js) — reduz hp/ataque/defesa dos
    // monstros (ver CombatSystem.js: MODO_HISTORIA_REDUCAO) sem reduzir
    // XP/ouro, pro contrário exato de NG+ (que deixa mais difícil E rende
    // mais). Default false = comportamento idêntico a antes desta opção
    // existir.
    modoHistoria: false,
  };
  return personagem;
}

// --- Árvore de habilidades ---------------------------------------------
// Cada classe tem 4 "tiers" (níveis 3/6/9/12), cada um com 2 opções (ramo
// ofensivo: sempre uma nova habilidade ativa de ataque; ramo de suporte:
// um bônus passivo permanente ou, em algumas classes, uma habilidade de
// apoio). O jogador escolhe uma opção por tier — a outra fica de fora.

function bonusArvore(personagem, dados) {
  const bonus = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };
  const arvore = (dados && dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  escolhas.forEach((nodeId) => {
    const node = arvore.find((n) => n.id === nodeId);
    if (node && node.tipoConcedido === "passiva" && node.efeito && node.efeito.atributo in bonus) {
      bonus[node.efeito.atributo] += node.efeito.valor;
    }
  });
  return bonus;
}

// Soma o bônus da árvore de habilidades (bonusArvore) com o bônus de
// afinidade racial de classe (task #41, AffinitySystem.js), o bônus de
// vínculo de campanheirismo (melhoria pós-backlog, BondSystem.js — só
// convocados do gacha têm, o principal fica com bônus vazio) e o bônus de
// conjunto de equipamento (melhoria pós-backlog, SetBonusSystem.js — muda a
// qualquer momento que o equipamento mudar, nunca é "guardado") — mesmo
// formato dos quatro, então basta somar campo a campo. Usado por todas as
// funções abaixo, pra cada um desses bônus valer nos mesmos lugares
// (atributos, defesa, HP/MP máximo, chance de crítico) sem duplicar a
// lógica de leitura em cada uma.
function bonusTotal(personagem, dados) {
  const arv = bonusArvore(personagem, dados);
  const afin = bonusAfinidade(personagem, dados);
  const vinc = bonusVinculo(personagem);
  const conj = bonusConjunto(personagem);
  const total = {};
  for (const k of Object.keys(arv)) total[k] = arv[k] + (afin[k] || 0) + (vinc[k] || 0) + (conj[k] || 0);
  return total;
}

// Retorna o próximo tier ainda não decidido cujo nível já foi atingido
// (ou null se não há nada pendente ainda). Os tiers são avaliados em ordem
// de nível, então nunca pula um tier anterior ainda não resolvido.
function escolhaPendente(personagem, dados) {
  const arvore = (dados && dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  if (!arvore.length) return null;
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  const tiers = [...new Set(arvore.map((n) => n.tier))].sort((a, b) => a - b);
  for (const tier of tiers) {
    const opcoes = arvore.filter((n) => n.tier === tier);
    if (opcoes.some((n) => escolhas.includes(n.id))) continue;
    const nivelRequerido = opcoes[0].nivelRequerido;
    if (personagem.nivel >= nivelRequerido) return { tier, nivelRequerido, opcoes };
    return null;
  }
  return null;
}

function aplicarEscolhaArvore(personagem, dados, nodeId) {
  const arvore = (dados && dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  const node = arvore.find((n) => n.id === nodeId);
  if (!node) return { ok: false };
  if (!personagem.arvore) personagem.arvore = { escolhas: [] };
  if (personagem.arvore.escolhas.includes(nodeId)) return { ok: false };
  personagem.arvore.escolhas.push(nodeId);
  if (node.tipoConcedido === "ativa" && node.habilidade) {
    const jaTem = personagem.habilidades.some((h) => h.id === node.habilidade.id);
    if (!jaTem) personagem.habilidades.push({ ...node.habilidade, cooldownAtual: 0 });
  } else {
    personagem.hpMax = calcularHpMax(personagem, dados);
    personagem.mpMax = calcularMpMax(personagem, dados);
    personagem.hp = Math.min(personagem.hpMax, personagem.hp);
    personagem.mp = Math.min(personagem.mpMax, personagem.mp);
  }
  return { ok: true, node };
}

function calcularHpMax(personagem, dados) {
  const c = dados.classes.find((x) => x.id === personagem.classeId);
  if (!c) return personagem.hpMax || 1;
  const bonus = bonusTotal(personagem, dados);
  const conEfetivo = personagem.atributos.CON + (bonus.CON || 0);
  return Math.round((c.vidaBase + conEfetivo * 3) * (1 + (bonus.hpMaxPercent || 0)));
}

function calcularMpMax(personagem, dados) {
  const c = dados.classes.find((x) => x.id === personagem.classeId);
  if (!c) return personagem.mpMax || 0;
  const bonus = bonusTotal(personagem, dados);
  const intEfetivo = personagem.atributos.INT + (bonus.INT || 0);
  return Math.round((c.manaBase + intEfetivo * 2) * (1 + (bonus.mpMaxPercent || 0)));
}

function critBonusTotal(personagem, dados) {
  if (!dados) return 0;
  return bonusTotal(personagem, dados).critChance || 0;
}

function atributosEfetivos(personagem, dados) {
  const a = { ...personagem.atributos };
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.bonusAtributo) {
      Object.entries(item.bonusAtributo).forEach(([k, v]) => (a[k] = (a[k] || 0) + v));
    }
  });
  if (dados) {
    const bonus = bonusTotal(personagem, dados);
    ["FOR", "DES", "CON", "INT"].forEach((k) => { a[k] = (a[k] || 0) + (bonus[k] || 0); });
  }
  return a;
}

function defesaTotal(personagem, dados) {
  let def = Math.floor(personagem.atributos.CON / 2);
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.defesa) def += item.defesa;
  });
  if (dados) def += bonusTotal(personagem, dados).defesaFlat || 0;
  return def;
}

function velocidadeTotal(personagem, dados) {
  const a = atributosEfetivos(personagem, dados);
  let vel = a.DES;
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.bonusVelocidade) vel += item.bonusVelocidade;
  });
  if (personagem.racaId === "elfo") vel += 2;
  return vel;
}

function ataqueBase(personagem, dados) {
  const item = personagem.equipamento.arma;
  const a = atributosEfetivos(personagem, dados);
  if (item) {
    const atrib = a[item.atributo] || 0;
    return { dano: item.dano + atrib, atributo: item.atributo, bonusCritico: item.bonusCritico || 0 };
  }
  return { dano: 2 + a.FOR, atributo: "FOR", bonusCritico: 0 };
}

function ganharXP(personagem, xp) {
  let ganho = xp;
  if (personagem.racaId === "humano") ganho = Math.round(ganho * 1.05);
  personagem.xp += ganho;
  const subiuNivel = [];
  while (personagem.xp >= personagem.xpProximo) {
    personagem.xp -= personagem.xpProximo;
    personagem.nivel += 1;
    personagem.xpProximo = xpParaNivel(personagem.nivel);
    subiuNivel.push(personagem.nivel);
  }
  return { ganho, subiuNivel };
}

function aplicarCrescimento(personagem, dados) {
  const c = dados.classes.find((x) => x.id === personagem.classeId);
  Object.entries(c.crescimento).forEach(([k, v]) => (personagem.atributos[k] += v));
  const hpAntigo = personagem.hpMax;
  personagem.hpMax = calcularHpMax(personagem, dados);
  personagem.mpMax = calcularMpMax(personagem, dados);
  personagem.hp += personagem.hpMax - hpAntigo;
  personagem.mp = personagem.mpMax;
}

function cryptoId() {
  return "id_" + Math.random().toString(36).slice(2, 10);
}

  return { xpParaNivel, criarPersonagem, bonusArvore, bonusTotal, escolhaPendente, aplicarEscolhaArvore, calcularHpMax, calcularMpMax, critBonusTotal, atributosEfetivos, defesaTotal, velocidadeTotal, ataqueBase, ganharXP, aplicarCrescimento, cryptoId };
})();

const MOD_src_ui_CharacterCreationUI_js = (function(){
  const criarPersonagem = MOD_src_systems_CharacterFactory_js.criarPersonagem;
  const infoAfinidade = MOD_src_systems_AffinitySystem_js.infoAfinidade;
// Tela de criação de personagem em etapas (nome, raça, classe, antecedente, traço, resumo).



const ETAPAS = ["nome", "raca", "classe", "antecedente", "traco", "resumo"];

function montarCriacaoPersonagem(container, dados, onFinalizar) {
  const estado = { nome: "", raca: null, classe: null, antecedente: null, traco: null, etapaIdx: 0, modoHistoria: false };

  function render() {
    const etapa = ETAPAS[estado.etapaIdx];
    container.innerHTML = "";
    const painel = document.createElement("div");
    painel.className = "painel-criacao";

    const titulo = document.createElement("h2");
    titulo.className = "passo-titulo";
    painel.appendChild(titulo);
    container.appendChild(painel);

    if (etapa === "nome") {
      titulo.textContent = "Como se chama seu herói?";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Digite um nome...";
      input.value = estado.nome;
      input.style.cssText = "font-size:1.1em;padding:10px;width:280px;border-radius:4px;border:2px solid #7a5c34;background:#241b14;color:#f1e9d8;";
      painel.appendChild(input);
      painel.appendChild(document.createElement("br"));
      const btn = document.createElement("button");
      btn.className = "primario";
      btn.textContent = "Avançar";
      btn.style.marginTop = "16px";
      btn.onclick = () => {
        estado.nome = input.value.trim() || "Aventureiro";
        estado.etapaIdx++;
        render();
      };
      painel.appendChild(btn);
    } else if (etapa === "raca") {
      titulo.textContent = "Escolha sua Raça";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.races.forEach((r) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.raca === r.id ? " selecionada" : "");
        const bonusTxt = Object.entries(r.bonus).map(([k, v]) => `+${v} ${k}`).join(", ");
        card.innerHTML = `<h3>${r.nome}</h3><p>${r.descricao}</p><p><b>${bonusTxt}</b></p><p>${r.descricaoTraco}</p>`;
        card.onclick = () => { estado.raca = r.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.raca);
    } else if (etapa === "classe") {
      titulo.textContent = "Escolha sua Classe";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.classes.forEach((c) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.classe === c.id ? " selecionada" : "");
        const habsHTML = c.habilidades.map((h) => `<div class="habilidade-inicial"><b>${h.nome}</b> — ${h.descricao}</div>`).join("");
        // Afinidade racial de classe (task #41): mostra se a raça já
        // escolhida na etapa anterior tem afinidade com esta classe —
        // decisão informada, nunca uma restrição (todas as classes
        // continuam disponíveis pra qualquer raça).
        const afinidade = infoAfinidade(estado.raca, c.id, dados.affinities);
        card.innerHTML = `
          <h3>${c.icone || ""} ${c.nome}</h3>
          <p>${c.descricao || ""}</p>
          <p>Vida base: ${c.vidaBase} | Mana base: ${c.manaBase}</p>
          ${afinidade ? `<p class="badge-afinidade" title="${afinidade.texto}">🔗 Afinidade com sua raça!</p>` : ""}
          <div class="habilidades-iniciais-lista">${habsHTML}</div>
        `;
        card.onclick = () => { estado.classe = c.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.classe);
    } else if (etapa === "antecedente") {
      titulo.textContent = "Escolha seu Antecedente";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.backgrounds.forEach((b) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.antecedente === b.id ? " selecionada" : "");
        card.innerHTML = `<h3>${b.nome}</h3><p>${b.descricao}</p><p>Perícia: ${b.pericia}</p><p>Início: ${b.ouroInicial} ouro</p>`;
        card.onclick = () => { estado.antecedente = b.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.antecedente);
    } else if (etapa === "traco") {
      titulo.textContent = "Escolha um Traço de Personalidade";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.traits.forEach((t) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.traco === t.id ? " selecionada" : "");
        card.innerHTML = `<h3>${t.nome}</h3><p>${t.descricao}</p>`;
        card.onclick = () => { estado.traco = t.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.traco);
    } else if (etapa === "resumo") {
      titulo.textContent = `Resumo de ${estado.nome}`;
      const personagem = criarPersonagem(estado, dados);
      personagem.modoHistoria = estado.modoHistoria;
      const afinidadeResumo = infoAfinidade(estado.raca, estado.classe, dados.affinities);
      const resumo = document.createElement("div");
      resumo.innerHTML = `
        <p>${dados.classes.find((c) => c.id === estado.classe).icone || ""} ${dados.races.find((r) => r.id === estado.raca).nome} ${dados.classes.find((c) => c.id === estado.classe).nome},
        antecedente ${dados.backgrounds.find((b) => b.id === estado.antecedente).nome}.</p>
        ${afinidadeResumo ? `<p class="badge-afinidade">🔗 ${afinidadeResumo.texto}</p>` : ""}
        <div class="stat-row"><span>Força</span><span>${personagem.atributos.FOR}</span></div>
        <div class="stat-row"><span>Destreza</span><span>${personagem.atributos.DES}</span></div>
        <div class="stat-row"><span>Constituição</span><span>${personagem.atributos.CON}</span></div>
        <div class="stat-row"><span>Inteligência</span><span>${personagem.atributos.INT}</span></div>
        <div class="stat-row"><span>HP máximo</span><span>${personagem.hpMax}</span></div>
        <div class="stat-row"><span>MP máximo</span><span>${personagem.mpMax}</span></div>
        <div class="stat-row"><span>Ouro inicial</span><span>${personagem.ouro}</span></div>
        <p><i>${personagem.descricaoTraco}</i></p>
      `;
      painel.appendChild(resumo);
      // Modo História (melhoria pós-backlog): opção de dificuldade mais
      // leve, oferecida uma única vez aqui no resumo final — reduz hp/
      // ataque/defesa dos monstros (ver CombatSystem.js:
      // MODO_HISTORIA_REDUCAO) sem reduzir XP/ouro, pra quem quer focar na
      // narrativa/exploração. Desmarcada por padrão = jogo normal.
      const labelModoHistoria = document.createElement("label");
      labelModoHistoria.style.cssText = "display:block;margin:14px 0;padding:10px;border:1px solid #7a5c34;border-radius:6px;background:#241b14;cursor:pointer;";
      const checkModoHistoria = document.createElement("input");
      checkModoHistoria.type = "checkbox";
      checkModoHistoria.id = "check-modo-historia";
      checkModoHistoria.checked = estado.modoHistoria;
      checkModoHistoria.style.marginRight = "8px";
      checkModoHistoria.onchange = () => {
        estado.modoHistoria = checkModoHistoria.checked;
        personagem.modoHistoria = estado.modoHistoria;
      };
      labelModoHistoria.appendChild(checkModoHistoria);
      labelModoHistoria.appendChild(document.createTextNode("📖 Modo História — monstros mais fracos (hp/ataque/defesa reduzidos), sem afetar XP/ouro. Ideal pra focar na narrativa e exploração."));
      painel.appendChild(labelModoHistoria);
      const btnVoltar = document.createElement("button");
      btnVoltar.textContent = "Voltar";
      btnVoltar.onclick = () => { estado.etapaIdx--; render(); };
      const btnIniciar = document.createElement("button");
      btnIniciar.className = "primario";
      btnIniciar.textContent = "Começar Aventura!";
      btnIniciar.onclick = () => onFinalizar(personagem);
      painel.appendChild(document.createElement("br"));
      painel.appendChild(btnVoltar);
      painel.appendChild(btnIniciar);
    }
  }

  function adicionarNavegacao(painel, estado, render, temSelecao) {
    painel.appendChild(document.createElement("br"));
    if (estado.etapaIdx > 0) {
      const btnVoltar = document.createElement("button");
      btnVoltar.textContent = "Voltar";
      btnVoltar.onclick = () => { estado.etapaIdx--; render(); };
      painel.appendChild(btnVoltar);
    }
    const btnAvancar = document.createElement("button");
    btnAvancar.className = "primario";
    btnAvancar.textContent = "Avançar";
    btnAvancar.disabled = !temSelecao();
    btnAvancar.onclick = () => { estado.etapaIdx++; render(); };
    painel.appendChild(btnAvancar);
  }

  render();
}

  return { montarCriacaoPersonagem };
})();

const MOD_src_systems_InventorySystem_js = (function(){
  const cryptoId = MOD_src_systems_CharacterFactory_js.cryptoId;
// Gerencia inventário, equipamento e comércio.


const RARITY_COLORS = {
  comum: "#b0b0b0",
  incomum: "#4caf50",
  raro: "#3d8bfd",
  epico: "#a855f7",
  lendario: "#f5a524",
};

const RARITY_LABEL = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

function adicionarItem(personagem, itemBase, quantidade = 1) {
  for (let i = 0; i < quantidade; i++) {
    personagem.inventario.push({ ...itemBase, uid: cryptoId() });
  }
}

function removerItem(personagem, uid) {
  const idx = personagem.inventario.findIndex((i) => i.uid === uid);
  if (idx >= 0) return personagem.inventario.splice(idx, 1)[0];
  return null;
}

function removerPorId(personagem, itemId, quantidade = 1) {
  let restante = quantidade;
  for (let i = personagem.inventario.length - 1; i >= 0 && restante > 0; i--) {
    if (personagem.inventario[i].id === itemId) {
      personagem.inventario.splice(i, 1);
      restante -= 1;
    }
  }
  return restante === 0;
}

function contarItem(personagem, itemId) {
  return personagem.inventario.filter((i) => i.id === itemId).length;
}

const SLOT_POR_TIPO = { arma: "arma", armadura: null, acessorio: null };

function slotDoItem(item) {
  if (item.tipo === "arma") return "arma";
  if (item.tipo === "armadura") {
    return { peito: "peito", cabeca: "cabeca", pes: "pes", escudo: "escudo" }[item.slot] || null;
  }
  if (item.tipo === "acessorio") {
    return { anel: "anel", amuleto: "amuleto" }[item.slot] || null;
  }
  return null;
}

function equiparItem(personagem, uid) {
  const item = personagem.inventario.find((i) => i.uid === uid);
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const slot = slotDoItem(item);
  if (!slot) return { ok: false, msg: "Este item não pode ser equipado." };
  const anterior = personagem.equipamento[slot];
  personagem.equipamento[slot] = item;
  removerItem(personagem, uid);
  if (anterior) personagem.inventario.push(anterior);
  return { ok: true };
}

function desequiparItem(personagem, slot) {
  const item = personagem.equipamento[slot];
  if (!item) return { ok: false };
  personagem.equipamento[slot] = null;
  personagem.inventario.push(item);
  return { ok: true };
}

function usarConsumivel(personagem, uid) {
  const item = personagem.inventario.find((i) => i.uid === uid);
  if (!item || item.tipo !== "consumivel") return { ok: false, msg: "Não é possível usar este item." };
  let msg = "";
  if (item.curaHP) {
    personagem.hp = Math.min(personagem.hpMax, personagem.hp + item.curaHP);
    msg = `Recuperou ${item.curaHP} de HP.`;
  }
  if (item.curaMP) {
    personagem.mp = Math.min(personagem.mpMax, personagem.mp + item.curaMP);
    msg = `Recuperou ${item.curaMP} de MP.`;
  }
  if (item.removeStatus) {
    personagem.statusEffects = [];
    msg = "Efeitos negativos removidos.";
  }
  removerItem(personagem, uid);
  return { ok: true, msg };
}

function venderItem(personagem, uid) {
  const item = removerItem(personagem, uid);
  if (!item) return 0;
  const valor = Math.max(1, Math.round((item.valor || 1) * 0.5));
  personagem.ouro += valor;
  return valor;
}

// `multiplicadorPreco` (padrão 1 = preço normal) permite que a loja reflita
// a reputação do personagem com a vila (ver WorldStateSystem.js) sem esse
// módulo precisar conhecer nada sobre reputação — só recebe o número já
// calculado e aplica no preço final.
function comprarItem(personagem, itemBase, multiplicadorPreco = 1) {
  const preco = Math.max(1, Math.round(itemBase.valor * multiplicadorPreco));
  if (personagem.ouro < preco) return { ok: false, msg: "Ouro insuficiente." };
  personagem.ouro -= preco;
  adicionarItem(personagem, itemBase, 1);
  return { ok: true, preco };
}

function sortearRaridade(raridades, bonusRaroPercent = 0) {
  const pesos = raridades.map((r) => (r.ordem >= 2 ? r.peso * (1 + bonusRaroPercent) : r.peso));
  const total = pesos.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < raridades.length; i++) {
    if (roll < pesos[i]) return raridades[i].id;
    roll -= pesos[i];
  }
  return raridades[0].id;
}

function sortearLoot(pool, itemsCatalog) {
  const total = pool.reduce((a, p) => a + p.peso, 0);
  let roll = Math.random() * total;
  for (const p of pool) {
    if (roll < p.peso) return itemsCatalog.find((i) => i.id === p.itemId) || null;
    roll -= p.peso;
  }
  return null;
}

  return { RARITY_COLORS, RARITY_LABEL, adicionarItem, removerItem, removerPorId, contarItem, equiparItem, desequiparItem, usarConsumivel, venderItem, comprarItem, sortearRaridade, sortearLoot };
})();

const MOD_src_systems_CraftingSystem_js = (function(){
  const contarItem = MOD_src_systems_InventorySystem_js.contarItem;
  const removerPorId = MOD_src_systems_InventorySystem_js.removerPorId;
  const adicionarItem = MOD_src_systems_InventorySystem_js.adicionarItem;
// Combina materiais coletados em itens, usando receitas de forja/alquimia.


function receitaDisponivel(personagem, receita) {
  return receita.ingredientes.every((ing) => contarItem(personagem, ing.itemId) >= ing.quantidade);
}

function craftar(personagem, receita, itemsCatalog) {
  if (!receitaDisponivel(personagem, receita)) return { ok: false, msg: "Materiais insuficientes." };
  receita.ingredientes.forEach((ing) => removerPorId(personagem, ing.itemId, ing.quantidade));
  const resultado = itemsCatalog.find((i) => i.id === receita.resultadoId);
  if (resultado) adicionarItem(personagem, resultado, 1);
  return { ok: true, item: resultado };
}

  return { receitaDisponivel, craftar };
})();

const MOD_src_systems_EnchantSystem_js = (function(){
  const contarItem = MOD_src_systems_InventorySystem_js.contarItem;
  const removerPorId = MOD_src_systems_InventorySystem_js.removerPorId;
// Encantamento/aprimoramento de equipamento (melhoria de jogabilidade
// pós-backlog original): gasta ouro + materiais (minério, gema, os drops
// exclusivos de chefe já existem no inventário como "material" comum, ver
// task #45) pra subir o poder de um item já forjado/encontrado, em vez de
// só trocar por um item melhor. Funciona tanto com o item equipado quanto
// ainda no inventário — encontra pelo mesmo `uid` usado no resto do jogo.
//
// Guarda um snapshot do valor ORIGINAL (danoBase/defesaBase/bonusAtributoBase)
// na primeira vez que o item é aprimorado, e recalcula o valor atual a
// partir dele a cada nível — assim nunca acumula erro de arredondamento
// aplicando percentual em cima de percentual. Usa Math.ceil (nunca
// Math.round) pra garantir que mesmo um item com stat base baixo (ex.:
// defesa 2) sinta um ganho visível a cada nível — mesma lição aprendida no
// reforço de monstro solo (task #46).


const MAX_NIVEL_APRIMORAMENTO = 5;
const GANHO_POR_NIVEL = 0.08; // +8% do stat base por nível, cumulativo a partir do original

// Custo pra ir do nível atual (índice) pro próximo. CUSTO_POR_NIVEL[0] =
// custo de +0 -> +1, [4] = custo de +4 -> +5 (máximo).
const CUSTO_POR_NIVEL = [
  { ouro: 15, materiais: [{ itemId: "minerio", quantidade: 2 }, { itemId: "madeira", quantidade: 1 }] },
  { ouro: 35, materiais: [{ itemId: "minerio", quantidade: 3 }, { itemId: "gema", quantidade: 1 }] },
  { ouro: 70, materiais: [{ itemId: "minerio_raro", quantidade: 2 }, { itemId: "gema", quantidade: 2 }] },
  { ouro: 130, materiais: [{ itemId: "minerio_raro", quantidade: 3 }, { itemId: "erva_rara", quantidade: 2 }] },
  { ouro: 220, materiais: [{ itemId: "gema_rara", quantidade: 1 }, { itemId: "minerio_raro", quantidade: 4 }] },
];

// Só arma/armadura/acessório têm um stat pra escalar — consumíveis e
// materiais nunca aparecem aqui (nem equipados, nem no inventário).
function itemPodeSerAprimorado(item) {
  return !!item && ["arma", "armadura", "acessorio"].includes(item.tipo);
}

function nivelAprimoramento(item) {
  return (item && item.aprimoramento) || 0;
}

// null quando já está no nível máximo (nada mais pra comprar).
function custoProximoNivel(item) {
  const nivel = nivelAprimoramento(item);
  if (nivel >= MAX_NIVEL_APRIMORAMENTO) return null;
  return CUSTO_POR_NIVEL[nivel];
}

function podeAprimorar(personagem, item) {
  if (!itemPodeSerAprimorado(item)) return { ok: false, msg: "Este item não pode ser aprimorado." };
  const custo = custoProximoNivel(item);
  if (!custo) return { ok: false, msg: "Item já está no nível máximo de aprimoramento (+" + MAX_NIVEL_APRIMORAMENTO + ")." };
  if (personagem.ouro < custo.ouro) return { ok: false, msg: "Ouro insuficiente." };
  const faltando = custo.materiais.filter((m) => contarItem(personagem, m.itemId) < m.quantidade);
  if (faltando.length) return { ok: false, msg: "Materiais insuficientes." };
  return { ok: true, custo };
}

// Acha o item pelo uid tanto no inventário quanto nos slots de equipamento
// (um item aprimorável só pode estar em um dos dois lugares por vez).
function encontrarItemPorUid(personagem, uid) {
  const noInventario = personagem.inventario.find((i) => i.uid === uid);
  if (noInventario) return noInventario;
  for (const slot of Object.keys(personagem.equipamento)) {
    const equipado = personagem.equipamento[slot];
    if (equipado && equipado.uid === uid) return equipado;
  }
  return null;
}

function recalcularStats(item, novoNivel) {
  const mult = 1 + GANHO_POR_NIVEL * novoNivel;
  if (typeof item.dano === "number") {
    if (item.danoBase === undefined) item.danoBase = item.dano;
    item.dano = Math.ceil(item.danoBase * mult);
  }
  if (typeof item.defesa === "number") {
    if (item.defesaBase === undefined) item.defesaBase = item.defesa;
    item.defesa = Math.ceil(item.defesaBase * mult);
  }
  if (item.bonusAtributo && typeof item.bonusAtributo === "object") {
    if (!item.bonusAtributoBase) item.bonusAtributoBase = { ...item.bonusAtributo };
    Object.keys(item.bonusAtributoBase).forEach((attr) => {
      item.bonusAtributo[attr] = Math.ceil(item.bonusAtributoBase[attr] * mult);
    });
  }
  if (!item.nomeBase) item.nomeBase = item.nome;
  item.nome = `${item.nomeBase} +${novoNivel}`;
}

// Aprimora o item de `uid` em 1 nível, consumindo ouro + materiais. Muta o
// item em-lugar (o mesmo objeto continua equipado/no inventário depois),
// então nenhum outro sistema (equipar, defesaTotal, ataqueBase) precisa
// saber que aprimoramento existe — eles já leem item.dano/item.defesa
// diretamente.
function aprimorarItem(personagem, uid) {
  const item = encontrarItemPorUid(personagem, uid);
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const checagem = podeAprimorar(personagem, item);
  if (!checagem.ok) return checagem;

  const { custo } = checagem;
  personagem.ouro -= custo.ouro;
  custo.materiais.forEach((m) => removerPorId(personagem, m.itemId, m.quantidade));

  const novoNivel = nivelAprimoramento(item) + 1;
  item.aprimoramento = novoNivel;
  recalcularStats(item, novoNivel);

  return { ok: true, item, novoNivel };
}

  return { MAX_NIVEL_APRIMORAMENTO, GANHO_POR_NIVEL, CUSTO_POR_NIVEL, itemPodeSerAprimorado, nivelAprimoramento, custoProximoNivel, podeAprimorar, encontrarItemPorUid, aprimorarItem };
})();

const MOD_src_systems_QuestSystem_js = (function(){
// Controla o progresso e conclusão de missões.
function iniciarMissao(personagem, questDef) {
  if (personagem.missoesAtivas.some((m) => m.id === questDef.id)) return false;
  if (personagem.missoesConcluidas.includes(questDef.id)) return false;
  personagem.missoesAtivas.push({ id: questDef.id, progresso: 0 });
  return true;
}

function registrarAbate(personagem, monstroId) {
  const eventos = [];
  personagem.missoesAtivas.forEach((m) => {
    const def = window.__QUESTS__.find((q) => q.id === m.id);
    if (def && def.tipo === "matar" && def.alvo === monstroId && m.progresso < def.quantidade) {
      m.progresso += 1;
      eventos.push({ questId: m.id, progresso: m.progresso, meta: def.quantidade });
    }
  });
  return eventos;
}

function missaoPronta(personagem, questDef) {
  const m = personagem.missoesAtivas.find((x) => x.id === questDef.id);
  if (!m) return false;
  if (questDef.tipo === "matar") return m.progresso >= questDef.quantidade;
  if (questDef.tipo === "coletar") {
    const qtd = personagem.inventario.filter((i) => i.id === questDef.itemAlvo).length;
    return qtd >= questDef.quantidade;
  }
  if (questDef.tipo === "explorar") return m.progresso >= 1;
  return false;
}

function concluirMissao(personagem, questDef, itemsCatalog) {
  const idx = personagem.missoesAtivas.findIndex((m) => m.id === questDef.id);
  if (idx < 0) return { ok: false };
  if (questDef.tipo === "coletar") {
    let restante = questDef.quantidade;
    for (let i = personagem.inventario.length - 1; i >= 0 && restante > 0; i--) {
      if (personagem.inventario[i].id === questDef.itemAlvo) {
        personagem.inventario.splice(i, 1);
        restante -= 1;
      }
    }
  }
  personagem.missoesAtivas.splice(idx, 1);
  personagem.missoesConcluidas.push(questDef.id);
  personagem.ouro += questDef.recompensaOuro;
  const itemRecompensa = itemsCatalog.find((i) => i.id === questDef.recompensaItemId);
  return {
    ok: true, ouro: questDef.recompensaOuro, xp: questDef.recompensaXP,
    item: itemRecompensa, fragmentos: questDef.recompensaFragmentos || 0,
  };
}

function marcarExploracao(personagem, localId) {
  personagem.missoesAtivas.forEach((m) => {
    const def = window.__QUESTS__.find((q) => q.id === m.id);
    if (def && def.tipo === "explorar" && def.localAlvo === localId) {
      m.progresso = 1;
    }
  });
}

  return { iniciarMissao, registrarAbate, missaoPronta, concluirMissao, marcarExploracao };
})();

const MOD_src_systems_DailyQuestSystem_js = (function(){
// Missões diárias leves (melhoria de jogabilidade pós-backlog original): 3
// objetivos simples, sempre os mesmos, que resetam sozinhos à meia-noite (na
// primeira ação do dia, sem precisar de relógio de servidor) e dão uma
// recompensa pequena de ouro + Fragmentos de Aethra ao completar cada um.
//
// Diferente do "Desafio Diário" que já existe em GachaSystem.js/GachaUI.js
// (um cronômetro de 24h que acumula "cargas" resgatáveis sem exigir jogar,
// puramente baseado em tempo) — este sistema exige uma AÇÃO real no dia
// (matar, coletar, vencer uma batalha) e vive na tela de Missões, ao lado
// das missões normais de NPC, não na tela de Time/Gacha. Os dois sistemas
// são independentes e não se sobrepõem.
const TEMPLATES_DIARIOS = [
  { id: "diaria_cacada", nome: "Caçada do Dia", icone: "⚔️", tipo: "abate", meta: 5, descricao: "Derrote 5 monstros em batalhas.", recompensaOuro: 15, recompensaFragmentos: 15 },
  { id: "diaria_coleta", nome: "Coleta do Dia", icone: "🌿", tipo: "coleta", meta: 3, descricao: "Colete 3 recursos de nós espalhados pelo mundo.", recompensaOuro: 15, recompensaFragmentos: 15 },
  { id: "diaria_vitoria", nome: "Vitória do Dia", icone: "🏆", tipo: "vitoria", meta: 1, descricao: "Vença 1 batalha.", recompensaOuro: 15, recompensaFragmentos: 15 },
];

// Identificador do "dia" pra decidir quando resetar — só precisa ser
// estável dentro do mesmo dia e diferente no dia seguinte; toISOString()
// (UTC) evita qualquer dependência de fuso horário do navegador do jogador.
function diaAtualId() {
  return new Date().toISOString().slice(0, 10);
}

// Garante que personagem.missoesDiarias existe e é do dia de hoje — se for
// de um dia anterior (ou não existir ainda), gera progresso zerado pros 3
// templates. Idempotente: chamar de novo no mesmo dia não reseta nada.
function garantirMissoesDiarias(personagem) {
  const hoje = diaAtualId();
  if (personagem.missoesDiarias && personagem.missoesDiarias.dia === hoje) return personagem.missoesDiarias;
  personagem.missoesDiarias = {
    dia: hoje,
    progresso: TEMPLATES_DIARIOS.map((t) => ({ id: t.id, atual: 0, concluida: false, coletada: false })),
  };
  return personagem.missoesDiarias;
}

function progressoDe(personagem, templateId) {
  garantirMissoesDiarias(personagem);
  return personagem.missoesDiarias.progresso.find((p) => p.id === templateId) || null;
}

// Chamado pelos pontos de gancho do jogo (abate em BattleUI.js, coleta de
// nó e vitória de batalha em main.js) sempre que a AÇÃO correspondente
// acontece — nunca precisa saber se existe uma missão diária daquele tipo
// hoje; se não existir (não deveria acontecer, os 3 templates cobrem os 3
// tipos sempre), simplesmente não faz nada.
function registrarProgressoDiario(personagem, tipo, quantidade = 1) {
  garantirMissoesDiarias(personagem);
  TEMPLATES_DIARIOS.filter((t) => t.tipo === tipo).forEach((t) => {
    const p = progressoDe(personagem, t.id);
    if (!p || p.concluida) return;
    p.atual = Math.min(t.meta, p.atual + quantidade);
    if (p.atual >= t.meta) p.concluida = true;
  });
}

// Lista pronta pra UI: cada template junto do progresso do dia.
function missoesDiariasParaExibir(personagem) {
  garantirMissoesDiarias(personagem);
  return TEMPLATES_DIARIOS.map((t) => ({ template: t, ...progressoDe(personagem, t.id) }));
}

// Resgata a recompensa de uma missão diária concluída (uma vez só por dia,
// por template — `coletada` trava um segundo resgate). Ouro é aplicado
// direto aqui (mesmo padrão de QuestSystem.concluirMissao); Fragmentos de
// Aethra volta no retorno pra quem chamar aplicar via adicionarFragmentos
// (GachaSystem.js), seguindo o mesmo padrão já usado pelas missões de NPC.
function coletarRecompensaDiaria(personagem, templateId) {
  const t = TEMPLATES_DIARIOS.find((x) => x.id === templateId);
  const p = progressoDe(personagem, templateId);
  if (!t || !p) return { ok: false, msg: "Missão diária desconhecida." };
  if (!p.concluida) return { ok: false, msg: "Ainda não concluída." };
  if (p.coletada) return { ok: false, msg: "Recompensa já resgatada hoje." };
  p.coletada = true;
  personagem.ouro += t.recompensaOuro;
  return { ok: true, ouro: t.recompensaOuro, fragmentos: t.recompensaFragmentos };
}

  return { TEMPLATES_DIARIOS, garantirMissoesDiarias, registrarProgressoDiario, missoesDiariasParaExibir, coletarRecompensaDiaria };
})();

const MOD_src_data_economyConfig_js = (function(){
// Configuração da economia de invocação (gacha) — "Fragmentos de Aethra".
// Todos os valores ficam centralizados aqui de propósito: para ajustar preços,
// probabilidades ou recompensas basta editar este arquivo, sem mexer no resto
// do código. Os valores abaixo são o cenário "equilibrado", escolhido a partir
// de uma simulação de Monte Carlo com 1.000.000+ jogadores simulados por perfil
// (ver scripts/gacha_sim/relatorio_economia.md para o relatório completo com os
// três cenários — conservador, equilibrado e generoso — e a justificativa).
//
// IMPORTANTE: preço, probabilidades e pity são SEMPRE os mesmos para todo
// mundo — nunca personalizados por jogador.

const CUSTO_INVOCACAO = 100; // 1 invocação = 100 Fragmentos de Aethra
const CUSTO_PACOTE_10 = CUSTO_INVOCACAO * 10; // sem desconto — a vantagem é a garantia de raridade embutida

// Chances base por invocação (somam 100%). Usadas sempre que o pity suave/duro
// não estiver sobrescrevendo o resultado.
const CHANCES_BASE = {
  lendario: 0.007,
  epico: 0.06,
  raro: 0.15,
  incomum: 0.33,
  comum: 0.453,
};

const ORDEM_RARIDADE = ["comum", "incomum", "raro", "epico", "lendario"];

// Pity suave: a partir da invocação 40 (contando desde a última Lendária),
// a chance de Lendária DESSA invocação é sobrescrita pela curva abaixo.
// Na invocação 50 é garantia total (pity duro).
const CURVA_PITY_SUAVE = {
  40: 0.08, 41: 0.14, 42: 0.20, 43: 0.27, 44: 0.35, 45: 0.45,
  46: 0.57, 47: 0.70, 48: 0.82, 49: 0.92, 50: 1.0,
};
const PITY_DURO = 50;
const PITY_SUAVE_INICIO = 40;

const GARANTIA_RARO_A_CADA = 10; // toda 10ª invocação garante Raro ou melhor
const GARANTIA_EPICO_A_CADA = 25; // toda 25ª invocação garante Épico ou melhor

// Banner iniciante: teto fixo de 40 invocações totais, some para sempre depois
// que o jogador atinge o teto. As 10 primeiras são de graça durante o tutorial.
const BANNER_INICIANTE = {
  TETO_TOTAL: 40,
  GRATIS_NO_INICIO: 10,
  GARANTIA_RARO_ATE: 10,
  GARANTIA_EPICO_ATE: 20,
  GARANTIA_LENDARIO_ATE: 40,
};

// Conversão de duplicatas (task #38): a primeira cópia de um personagem
// sempre o desbloqueia; a partir da 2ª cópia do MESMO personagem, ela vira
// XP aplicado direto NELE (em vez de Fragmentos de Aethra genéricos) — evita
// "perda total" da puxada e, mais importante, faz duplicatas acelerarem
// diretamente o personagem que o jogador já escolheu investir, reforçando a
// escolha em vez de só devolver moeda pra puxar de novo. Escala com a
// raridade na mesma proporção que a antiga VALOR_DUPLICATA tinha.
const XP_DUPLICATA = {
  comum: 25,
  incomum: 40,
  raro: 70,
  epico: 130,
  lendario: 250,
};

// Personagem em destaque do banner de evento atual (fixo por enquanto — o
// jogo não tem calendário de eventos rotativos, então mantemos um banner de
// evento permanente com este personagem lendário em destaque).
const EVENTO_FEATURED_ID = "nyxandra_voz_da_tempestade";

// --- Fontes de Fragmentos (distribuição pedida: 30% missões/progressão,
// 20% diário/recorrente, 20% masmorras/desafios, 10% exploração,
// 10% conquistas, 10% eventos) ---
//
// Conteúdo de missões/exploração/conquistas é finito no jogo atual, então
// essas três fontes são bônus ÚNICOS (recebidos uma vez, ao cumprir cada
// coisa), enquanto diário/masmorra/evento são recorrentes para sempre.
// Isso é uma simplificação deliberada e está documentada no relatório da
// simulação — a proporção 30/20/20/10/10/10 vale para as primeiras semanas
// de um jogador ativo, quando todas as seis fontes ainda estão disponíveis.
const FRAGMENTOS = {
  // Recorrente: desafio diário. Não obriga login diário — o jogador acumula
  // até 7 "cargas" não resgatadas, então nunca perde progresso por faltar um dia.
  DESAFIO_DIARIO_RECOMPENSA: 45,
  DESAFIO_DIARIO_MAX_ACUMULO: 7,
  DESAFIO_DIARIO_INTERVALO_MS: 24 * 60 * 60 * 1000,

  // Recorrente: missão semanal (sempre disponível, reseta a cada 7 dias).
  MISSAO_SEMANAL_RECOMPENSA: 300,
  MISSAO_SEMANAL_INTERVALO_MS: 7 * 24 * 60 * 60 * 1000,

  // Recorrente: masmorras/desafios — recompensa ao derrotar o chefe da masmorra.
  RECOMPENSA_CHEFE_MASMORRA: 150,

  // Recorrente: evento — pequena chance de bônus após vencer uma batalha.
  CHANCE_BONUS_EVENTO_POS_BATALHA: 0.08,
  BONUS_EVENTO_VALOR: 60,

  // Único: recompensa de progressão embutida nas 5 missões principais do jogo
  // (ver quests.json → campo recompensaFragmentos de cada missão).

  // Único: primeira vez que cada baú/nó de coleta é usado (exploração).
  EXPLORACAO_BAU_RECOMPENSA: 40,
  EXPLORACAO_NO_RECOMPENSA: 20,

  // Único: conquistas (marcos de progresso).
  CONQUISTAS: {
    primeira_vitoria: { nome: "Primeira Vitória", valor: 50 },
    nivel_5: { nome: "Nível 5", valor: 80 },
    primeira_missao: { nome: "Primeira Missão Concluída", valor: 40 },
    todas_missoes: { nome: "Todas as Missões Concluídas", valor: 150 },
    masmorra_concluida: { nome: "Explorador da Masmorra", valor: 60 },
    dragao_derrotado: { nome: "Matador de Dragões", valor: 120 },
    colecao_5: { nome: "Colecionador: 5 personagens", valor: 60 },
    colecao_12: { nome: "Colecionador: 12 personagens", valor: 100 },
  },
};

// Renda semanal alvo por perfil (referência da simulação — não é aplicada
// diretamente no código, é usada para calibrar os valores acima).
const RENDA_SEMANAL_REFERENCIA = {
  casual: { early: 600, steady: 600 },
  ativo: { early: 1000, steady: 800 },
  dedicado: { early: 1400, steady: 1150 },
};

  return { CUSTO_INVOCACAO, CUSTO_PACOTE_10, CHANCES_BASE, ORDEM_RARIDADE, CURVA_PITY_SUAVE, PITY_DURO, PITY_SUAVE_INICIO, GARANTIA_RARO_A_CADA, GARANTIA_EPICO_A_CADA, BANNER_INICIANTE, XP_DUPLICATA, EVENTO_FEATURED_ID, FRAGMENTOS, RENDA_SEMANAL_REFERENCIA };
})();

const MOD_src_systems_GachaSystem_js = (function(){
  const CHANCES_BASE = MOD_src_data_economyConfig_js.CHANCES_BASE;
  const ORDEM_RARIDADE = MOD_src_data_economyConfig_js.ORDEM_RARIDADE;
  const CURVA_PITY_SUAVE = MOD_src_data_economyConfig_js.CURVA_PITY_SUAVE;
  const PITY_DURO = MOD_src_data_economyConfig_js.PITY_DURO;
  const PITY_SUAVE_INICIO = MOD_src_data_economyConfig_js.PITY_SUAVE_INICIO;
  const GARANTIA_RARO_A_CADA = MOD_src_data_economyConfig_js.GARANTIA_RARO_A_CADA;
  const GARANTIA_EPICO_A_CADA = MOD_src_data_economyConfig_js.GARANTIA_EPICO_A_CADA;
  const BANNER_INICIANTE = MOD_src_data_economyConfig_js.BANNER_INICIANTE;
  const EVENTO_FEATURED_ID = MOD_src_data_economyConfig_js.EVENTO_FEATURED_ID;
  const CUSTO_INVOCACAO = MOD_src_data_economyConfig_js.CUSTO_INVOCACAO;
  const xpParaNivel = MOD_src_systems_CharacterFactory_js.xpParaNivel;
  const ganharXP = MOD_src_systems_CharacterFactory_js.ganharXP;
  const aplicarCrescimento = MOD_src_systems_CharacterFactory_js.aplicarCrescimento;
  const FRAGMENTOS = MOD_src_data_economyConfig_js.FRAGMENTOS;
  const XP_DUPLICATA = MOD_src_data_economyConfig_js.XP_DUPLICATA;
// Sistema de invocação (gacha): banners, pity suave/duro, garantias de
// raridade e a mecânica de personagem em destaque do banner de evento.
// As regras (probabilidades, pity, garantias) são sempre as mesmas para
// todo mundo — nunca personalizadas por jogador. Todos os números vêm de
// src/data/economyConfig.js.




// Time completo = personagem principal (sempre presente) + até
// MAX_CONVOCADOS_GACHA convocados do gacha (era 2, agora 3 — time de até 4
// no total, ver task #43 do backlog e FormationSystem.js pra posicionamento).
const MAX_CONVOCADOS_GACHA = 3;

function estadoGachaInicial() {
  return {
    fragmentos: 0,
    pity: {
      permanente: { desdeUltimoLendario: 0, contadorRaro: 0, contadorEpico: 0 },
      evento: { desdeUltimoLendario: 0, contadorRaro: 0, contadorEpico: 0, garantiaFeaturedPendente: false },
    },
    beginner: { pullsUsados: 0, gratisRestantes: BANNER_INICIANTE.GRATIS_NO_INICIO, melhorRaridadeIdx: -1, concluido: false },
    personagensObtidos: [],
    duplicatas: {}, // rosterId -> contagem de cópias extras já convertidas
    // Histórico das últimas invocações, mais recente por último — usado pelo
    // Compêndio (task #37, ver CompendiumSystem.js/CompendiumUI.js) pra
    // mostrar um log de puxadas. Limitado em HISTORICO_INVOCACOES_MAX pra
    // não crescer sem limite no save.
    historicoInvocacoes: [],
    timeAtivo: [],
    conquistas: [],
    ultimoDesafioDiarioClaim: null,
    desafiosDiariosAcumulados: 1,
    ultimaMissaoSemanalClaim: null,
  };
}

function garantirEstadoGacha(personagem) {
  if (!personagem.gacha) personagem.gacha = estadoGachaInicial();
  return personagem.gacha;
}

function idxRaridade(r) {
  return ORDEM_RARIDADE.indexOf(r);
}

function rolarRaridadeBase(chanceLendarioOverride) {
  const pLeg = chanceLendarioOverride ?? CHANCES_BASE.lendario;
  if (Math.random() < pLeg) return "lendario";
  const resto = { epico: CHANCES_BASE.epico, raro: CHANCES_BASE.raro, incomum: CHANCES_BASE.incomum, comum: CHANCES_BASE.comum };
  const total = Object.values(resto).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rar, peso] of Object.entries(resto)) {
    if (r < peso) return rar;
    r -= peso;
  }
  return "comum";
}

// Executa uma invocação em uma categoria de pity ("permanente" ou "evento")
// e devolve a raridade sorteada, já aplicando pity suave/duro e as garantias
// de raro/épico a cada N invocações.
function rolarComPity(pityState) {
  pityState.desdeUltimoLendario += 1;
  pityState.contadorRaro += 1;
  pityState.contadorEpico += 1;

  let raridade;
  const n = pityState.desdeUltimoLendario;
  if (n >= PITY_DURO) {
    raridade = "lendario";
  } else if (n >= PITY_SUAVE_INICIO) {
    raridade = rolarRaridadeBase(CURVA_PITY_SUAVE[n] ?? 1);
  } else {
    raridade = rolarRaridadeBase();
  }

  if (pityState.contadorEpico >= GARANTIA_EPICO_A_CADA && idxRaridade(raridade) < idxRaridade("epico")) {
    raridade = "epico";
  } else if (pityState.contadorRaro >= GARANTIA_RARO_A_CADA && idxRaridade(raridade) < idxRaridade("raro")) {
    raridade = "raro";
  }

  if (raridade === "lendario") pityState.desdeUltimoLendario = 0;
  if (idxRaridade(raridade) >= idxRaridade("raro")) pityState.contadorRaro = 0;
  if (idxRaridade(raridade) >= idxRaridade("epico")) pityState.contadorEpico = 0;

  return raridade;
}

// Se o roster não tiver ninguém na raridade sorteada (roster incompleto ou
// de teste), cai para a raridade mais próxima disponível em vez de quebrar.
function personagemAleatorioDaRaridade(roster, raridade) {
  let opcoes = roster.filter((p) => p.raridade === raridade);
  if (!opcoes.length) {
    const ordenadoPorProximidade = [...ORDEM_RARIDADE].sort(
      (a, b) => Math.abs(idxRaridade(a) - idxRaridade(raridade)) - Math.abs(idxRaridade(b) - idxRaridade(raridade))
    );
    for (const r of ordenadoPorProximidade) {
      opcoes = roster.filter((p) => p.raridade === r);
      if (opcoes.length) break;
    }
  }
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

// Cria a instância "jogável" de um personagem de gacha a partir da definição
// do roster — formato compatível com o usado pelo CharacterFactory (nivel,
// xp, atributos, hp/mp, equipamento vazio) para poder entrar em batalha e
// evoluir junto com o time.
function instanciarPersonagemGacha(defRoster) {
  return {
    uid: "gacha_" + Math.random().toString(36).slice(2, 10),
    rosterId: defRoster.id,
    nome: defRoster.nome,
    raridade: defRoster.raridade,
    racaId: defRoster.racaId,
    classeId: defRoster.classeId,
    facaoId: defRoster.facaoId || null, // task #44: região/facção de origem
    descricao: defRoster.descricao,
    nivel: 1,
    xp: 0,
    xpProximo: xpParaNivel(1),
    atributos: { ...defRoster.atributos },
    hpMax: defRoster.hpMax,
    hp: defRoster.hpMax,
    mpMax: defRoster.mpMax,
    mp: defRoster.mpMax,
    equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
    habilidades: [{ ...defRoster.habilidade, cooldownAtual: 0 }],
    spriteKey: `gacha_${defRoster.id}`,
    ehGacha: true,
  };
}

const HISTORICO_INVOCACOES_MAX = 100;

// Compêndio (task #37): anexa uma entrada compacta ao log de invocações do
// jogador. Só este arquivo escreve em historicoInvocacoes — CompendiumSystem.js
// apenas lê. Corta o histórico mais antigo além do teto pra não inflar o save.
function registrarHistoricoInvocacao(personagem, defRoster, banner, duplicata, featured) {
  const g = garantirEstadoGacha(personagem);
  g.historicoInvocacoes.push({
    rosterId: defRoster.id,
    nome: defRoster.nome,
    raridade: defRoster.raridade,
    banner,
    duplicata,
    featured: !!featured,
    data: Date.now(),
  });
  if (g.historicoInvocacoes.length > HISTORICO_INVOCACOES_MAX) {
    g.historicoInvocacoes.splice(0, g.historicoInvocacoes.length - HISTORICO_INVOCACOES_MAX);
  }
}

// Se o jogador já possui esse personagem, a nova cópia é convertida em XP
// (task #38) aplicado direto na instância já possuída, em vez de virar uma
// segunda unidade solta ou Fragmentos genéricos. `dados` é opcional — sem
// ele o XP ainda é somado, só não recalcula atributos/HP/MP de quem subiu
// de nível nesse momento (mesma regra frouxa que despertar() usa).
function registrarObtido(personagem, defRoster, banner = "?", featured = false, dados = null) {
  const g = garantirEstadoGacha(personagem);
  const instanciaExistente = g.personagensObtidos.find((p) => p.rosterId === defRoster.id);
  if (instanciaExistente) {
    g.duplicatas[defRoster.id] = (g.duplicatas[defRoster.id] || 0) + 1;
    const valorXP = XP_DUPLICATA[defRoster.raridade] || 0;
    let subiuNivel = [];
    if (valorXP > 0) {
      const r = ganharXP(instanciaExistente, valorXP);
      subiuNivel = r.subiuNivel;
      if (dados) subiuNivel.forEach(() => aplicarCrescimento(instanciaExistente, dados));
    }
    registrarHistoricoInvocacao(personagem, defRoster, banner, true, featured);
    return { duplicata: true, xpConvertido: valorXP, subiuNivel, instancia: instanciaExistente };
  }
  const instancia = instanciarPersonagemGacha(defRoster);
  g.personagensObtidos.push(instancia);
  if (g.timeAtivo.length < MAX_CONVOCADOS_GACHA) g.timeAtivo.push(instancia.uid);
  registrarHistoricoInvocacao(personagem, defRoster, banner, false, featured);
  return { duplicata: false, instancia };
}

function invocarPermanente(personagem, roster, dados = null) {
  const g = garantirEstadoGacha(personagem);
  if (g.fragmentos < CUSTO_INVOCACAO) return { ok: false, motivo: "sem_fragmentos" };
  g.fragmentos -= CUSTO_INVOCACAO;
  const raridade = rolarComPity(g.pity.permanente);
  const def = personagemAleatorioDaRaridade(roster, raridade);
  const r = registrarObtido(personagem, def, "permanente", false, dados);
  return { ok: true, raridade, def, instancia: r.instancia, duplicata: r.duplicata, xpConvertido: r.xpConvertido, subiuNivelDuplicata: r.subiuNivel, featured: false };
}

function invocarEvento(personagem, roster, dados = null) {
  const g = garantirEstadoGacha(personagem);
  if (g.fragmentos < CUSTO_INVOCACAO) return { ok: false, motivo: "sem_fragmentos" };
  g.fragmentos -= CUSTO_INVOCACAO;
  const raridade = rolarComPity(g.pity.evento);
  let def, featured = false;
  if (raridade === "lendario") {
    const featuredDef = roster.find((p) => p.id === EVENTO_FEATURED_ID);
    if (g.pity.evento.garantiaFeaturedPendente) {
      g.pity.evento.garantiaFeaturedPendente = false;
      def = featuredDef;
      featured = true;
    } else if (Math.random() < 0.5) {
      def = featuredDef;
      featured = true;
    } else {
      def = personagemAleatorioDaRaridade(roster, "lendario");
      g.pity.evento.garantiaFeaturedPendente = true;
    }
  } else {
    def = personagemAleatorioDaRaridade(roster, raridade);
  }
  const r = registrarObtido(personagem, def, "evento", featured, dados);
  return { ok: true, raridade, def, instancia: r.instancia, duplicata: r.duplicata, xpConvertido: r.xpConvertido, subiuNivelDuplicata: r.subiuNivel, featured };
}

function invocarIniciante(personagem, roster, dados = null) {
  const g = garantirEstadoGacha(personagem);
  if (g.beginner.concluido || g.beginner.pullsUsados >= BANNER_INICIANTE.TETO_TOTAL) {
    return { ok: false, motivo: "banner_esgotado" };
  }
  const gratis = g.beginner.gratisRestantes > 0;
  if (!gratis && g.fragmentos < CUSTO_INVOCACAO) return { ok: false, motivo: "sem_fragmentos" };
  if (gratis) g.beginner.gratisRestantes -= 1;
  else g.fragmentos -= CUSTO_INVOCACAO;

  g.beginner.pullsUsados += 1;
  const n = g.beginner.pullsUsados;
  let raridade = rolarRaridadeBase();

  if (n >= BANNER_INICIANTE.GARANTIA_LENDARIO_ATE && g.beginner.melhorRaridadeIdx < idxRaridade("lendario")) {
    raridade = "lendario";
  } else if (n >= BANNER_INICIANTE.GARANTIA_EPICO_ATE && g.beginner.melhorRaridadeIdx < idxRaridade("epico") && idxRaridade(raridade) < idxRaridade("epico")) {
    raridade = "epico";
  } else if (n >= BANNER_INICIANTE.GARANTIA_RARO_ATE && g.beginner.melhorRaridadeIdx < idxRaridade("raro") && idxRaridade(raridade) < idxRaridade("raro")) {
    raridade = "raro";
  }
  if (idxRaridade(raridade) > g.beginner.melhorRaridadeIdx) g.beginner.melhorRaridadeIdx = idxRaridade(raridade);

  const def = personagemAleatorioDaRaridade(roster, raridade);
  const r = registrarObtido(personagem, def, "iniciante", false, dados);
  if (g.beginner.pullsUsados >= BANNER_INICIANTE.TETO_TOTAL) g.beginner.concluido = true;
  return { ok: true, raridade, def, instancia: r.instancia, duplicata: r.duplicata, xpConvertido: r.xpConvertido, subiuNivelDuplicata: r.subiuNivel, featured: false };
}

function definirTimeAtivo(personagem, uids) {
  const g = garantirEstadoGacha(personagem);
  g.timeAtivo = uids.slice(0, MAX_CONVOCADOS_GACHA).filter((uid) => g.personagensObtidos.some((p) => p.uid === uid));
}

function membrosDoTime(personagem) {
  const g = garantirEstadoGacha(personagem);
  return g.timeAtivo
    .map((uid) => g.personagensObtidos.find((p) => p.uid === uid))
    .filter(Boolean)
    .slice(0, MAX_CONVOCADOS_GACHA);
}

function adicionarFragmentos(personagem, valor) {
  const g = garantirEstadoGacha(personagem);
  g.fragmentos += Math.max(0, Math.round(valor));
  return g.fragmentos;
}

// Conquistas: marcos de progresso que pagam Fragmentos uma única vez cada.
// `condicoes` é um objeto com os sinais atuais do jogo (ver checarConquistas
// nas chamadas em main.js/BattleUI.js) usado para decidir quais conquistas
// acabaram de ser cumpridas.
function checarConquistas(personagem, eventosAgora = {}) {
  const g = garantirEstadoGacha(personagem);
  const novas = [];
  const tentar = (id, cumprida) => {
    if (cumprida && !g.conquistas.includes(id)) {
      g.conquistas.push(id);
      const def = FRAGMENTOS.CONQUISTAS[id];
      if (def) {
        adicionarFragmentos(personagem, def.valor);
        novas.push({ id, ...def });
      }
    }
  };
  if (eventosAgora.venceuBatalha) tentar("primeira_vitoria", true);
  tentar("nivel_5", personagem.nivel >= 5);
  tentar("primeira_missao", personagem.missoesConcluidas.length >= 1);
  tentar("todas_missoes", personagem.missoesConcluidas.length >= 5);
  if (eventosAgora.explorouMasmorra) tentar("masmorra_concluida", true);
  if (eventosAgora.derrotouDragao) tentar("dragao_derrotado", true);
  tentar("colecao_5", g.personagensObtidos.length >= 5);
  tentar("colecao_12", g.personagensObtidos.length >= 12);
  return novas;
}

// Desafio diário: acumula até um teto sem exigir login todo dia. Chamar ao
// abrir a tela de gacha/HUD para atualizar o número de "cargas" disponíveis.
function atualizarDesafioDiario(personagem) {
  const g = garantirEstadoGacha(personagem);
  const agora = Date.now();
  if (!g.ultimoDesafioDiarioClaim) {
    g.ultimoDesafioDiarioClaim = agora;
    return g;
  }
  const decorrido = agora - g.ultimoDesafioDiarioClaim;
  const ciclos = Math.floor(decorrido / FRAGMENTOS.DESAFIO_DIARIO_INTERVALO_MS);
  if (ciclos > 0) {
    g.desafiosDiariosAcumulados = Math.min(
      FRAGMENTOS.DESAFIO_DIARIO_MAX_ACUMULO,
      g.desafiosDiariosAcumulados + ciclos
    );
    g.ultimoDesafioDiarioClaim = agora;
  }
  return g;
}

function resgatarDesafioDiario(personagem) {
  const g = garantirEstadoGacha(personagem);
  atualizarDesafioDiario(personagem);
  if (g.desafiosDiariosAcumulados <= 0) return { ok: false };
  g.desafiosDiariosAcumulados -= 1;
  adicionarFragmentos(personagem, FRAGMENTOS.DESAFIO_DIARIO_RECOMPENSA);
  return { ok: true, valor: FRAGMENTOS.DESAFIO_DIARIO_RECOMPENSA };
}

function podeResgatarMissaoSemanal(personagem) {
  const g = garantirEstadoGacha(personagem);
  if (!g.ultimaMissaoSemanalClaim) return true;
  return Date.now() - g.ultimaMissaoSemanalClaim >= FRAGMENTOS.MISSAO_SEMANAL_INTERVALO_MS;
}

function resgatarMissaoSemanal(personagem) {
  const g = garantirEstadoGacha(personagem);
  if (!podeResgatarMissaoSemanal(personagem)) return { ok: false };
  g.ultimaMissaoSemanalClaim = Date.now();
  adicionarFragmentos(personagem, FRAGMENTOS.MISSAO_SEMANAL_RECOMPENSA);
  return { ok: true, valor: FRAGMENTOS.MISSAO_SEMANAL_RECOMPENSA };
}

  return { MAX_CONVOCADOS_GACHA, estadoGachaInicial, instanciarPersonagemGacha, invocarPermanente, invocarEvento, invocarIniciante, definirTimeAtivo, membrosDoTime, adicionarFragmentos, checarConquistas, atualizarDesafioDiario, resgatarDesafioDiario, podeResgatarMissaoSemanal, resgatarMissaoSemanal };
})();

const MOD_src_systems_SkillCheckSystem_js = (function(){
  const atributosEfetivos = MOD_src_systems_CharacterFactory_js.atributosEfetivos;
// Testes de perícia (d20) fora de combate — pontos de decisão no mundo
// (diálogos de NPC, baús, coleta de recursos), lidos de
// src/data/skillChecks.json. Antes deste sistema, o campo "pericia" de
// cada antecedente (src/data/backgrounds.json) era só texto de sabor; agora
// ele concede um bônus de proficiência real quando bate com a perícia
// exigida pelo teste.
//
// Convenção deste sistema (diferente do d20 puro do combate, ver
// CombatSystem.js): segue o modelo clássico de teste de perícia —
// d20 + modificador de atributo (+ proficiência, se aplicável) comparado
// contra uma dificuldade (DC). Natural 20 é sucesso automático; natural 1 é
// falha automática; os dois nunca se misturam com combate.


function d20Pericia() {
  return Math.floor(Math.random() * 20) + 1;
}

// Bônus de proficiência: cresce lentamente com o nível, igual à ideia geral
// de "personagens experientes são melhores no que sabem fazer" sem virar o
// fator dominante do teste (o d20 continua sendo a maior fatia do resultado).
function bonusProficiencia(personagem) {
  return 2 + Math.floor((personagem.nivel || 1) / 4);
}

function possuiPericia(personagem, dados, nomePericia) {
  const bg = (dados.backgrounds || []).find((b) => b.id === personagem.antecedenteId);
  return !!bg && bg.pericia === nomePericia;
}

// Executa um teste de perícia e retorna o resultado completo (pra UI exibir
// o "d20 + modificadores = total vs dificuldade", como uma mesa de RPG).
function realizarTeste(personagem, dados, { pericia, atributo, dificuldade }) {
  const d = d20Pericia();
  const atributos = atributosEfetivos(personagem, dados);
  const modAtributo = Math.floor((atributos[atributo] ?? 10) / 2);
  const proficiente = possuiPericia(personagem, dados, pericia);
  const bonusPericiaValor = proficiente ? bonusProficiencia(personagem) : 0;
  const total = d + modAtributo + bonusPericiaValor;
  const critico = d === 20;
  const falhaCritica = d === 1;
  const sucesso = critico || (!falhaCritica && total >= dificuldade);
  return { d, modAtributo, bonusPericia: bonusPericiaValor, proficiente, total, dificuldade, sucesso, critico, falhaCritica };
}

// Filtra os testes disponíveis num contexto (ex.: "npc", "bau", "no"),
// opcionalmente restritos a um NPC específico.
function testesDoContexto(dadosSkillChecks, contexto, filtro = {}) {
  return (dadosSkillChecks || []).filter((sc) => {
    if (sc.contexto !== contexto) return false;
    if (filtro.npcId && sc.npcId !== filtro.npcId) return false;
    return true;
  });
}

function testeJaFeito(personagem, testeId) {
  return (personagem.testesPericiaFeitos || []).includes(testeId);
}

function marcarTesteFeito(personagem, testeId) {
  if (!personagem.testesPericiaFeitos) personagem.testesPericiaFeitos = [];
  if (!personagem.testesPericiaFeitos.includes(testeId)) personagem.testesPericiaFeitos.push(testeId);
}

  return { d20Pericia, bonusProficiencia, possuiPericia, realizarTeste, testesDoContexto, testeJaFeito, marcarTesteFeito };
})();

const MOD_src_systems_WorldStateSystem_js = (function(){
// Mundo reativo: reputação por facção + flags de escolhas persistentes.
// Tudo fica em personagem.estadoDoMundo — como o objeto `personagem` inteiro
// já é serializado no save (ver SaveSystem.js/estadoAtualParaSalvar em
// main.js), isso persiste automaticamente sem precisar de nenhum campo novo
// no contrato de save. Antes deste sistema, a única "escolha" persistente
// do jogo era a árvore de habilidades — agora ações no mundo (completar
// missões, testes de perícia bem-sucedidos com NPCs) deixam consequência:
// preços na loja mudam, e diálogos refletem como a vila te vê.
//
// Os dados de facções/tiers (src/data/worldStateVariables.json) chegam via
// `dadosWorldState`/`dados.worldState`, carregados pelo loader.js — igual a
// todo outro dado do jogo (nunca import direto de JSON, pra manter o padrão
// "sem build step" do projeto, servido por fetch()).

function estadoDoMundoInicial() {
  return { reputacao: {}, flags: {} };
}

function garantirEstadoDoMundo(personagem) {
  if (!personagem.estadoDoMundo) personagem.estadoDoMundo = estadoDoMundoInicial();
  if (!personagem.estadoDoMundo.reputacao) personagem.estadoDoMundo.reputacao = {};
  if (!personagem.estadoDoMundo.flags) personagem.estadoDoMundo.flags = {};
  return personagem.estadoDoMundo;
}

function getReputacao(personagem, facaoId) {
  return garantirEstadoDoMundo(personagem).reputacao[facaoId] || 0;
}

// Altera a reputação com uma facção, respeitando os limites min/max
// definidos em worldStateVariables.json (sem eles, usa -100/100). Retorna o
// novo valor.
function alterarReputacao(personagem, facaoId, delta, dadosWorldState) {
  const estado = garantirEstadoDoMundo(personagem);
  const facao = ((dadosWorldState && dadosWorldState.facoes) || []).find((f) => f.id === facaoId);
  const min = facao ? facao.min : -100;
  const max = facao ? facao.max : 100;
  const atual = estado.reputacao[facaoId] || 0;
  const novo = Math.max(min, Math.min(max, atual + delta));
  estado.reputacao[facaoId] = novo;
  return novo;
}

// Encontra o tier (faixa nomeada) correspondente a um valor de reputação —
// usado pra decidir desconto na loja e a saudação de diálogo.
function tierDaReputacao(valor, dadosWorldState) {
  const tiers = [...((dadosWorldState && dadosWorldState.tiers) || [])].sort((a, b) => b.min - a.min);
  return tiers.find((t) => valor >= t.min) || tiers[tiers.length - 1] || null;
}

function definirFlag(personagem, flagId, valor = true) {
  garantirEstadoDoMundo(personagem).flags[flagId] = valor;
}

function temFlag(personagem, flagId) {
  return !!garantirEstadoDoMundo(personagem).flags[flagId];
}

// --- Diário de decisões (melhoria pós-backlog) --------------------------
// Registro cronológico de escolhas narrativas importantes — tom escolhido
// numa cena de vínculo (BondUI.js), opção tomada num evento de exploração
// (ExplorationEventUI.js), teste de perícia tentado com um NPC (GameUI.js),
// chefe derrotado (BattleUI.js), facção escolhida (CompendiumUI.js) — pra o
// jogador poder reler depois o que já viveu e o que isso rendeu (ver
// DecisionJournalUI.js). Puramente informativo: NENHUMA lógica de jogo lê
// `estadoDoMundo.decisoes` de volta, só a UI — bem diferente de
// reputacao/flags, que são lidos por várias outras mecânicas (loja,
// emboscada, camaradagem). Guardado dentro de estadoDoMundo pelo mesmo
// motivo que reputação/flags: persiste no save automaticamente, sem
// precisar de um campo novo no contrato de save.
//
// `momento` é um contador monotônico (não timestamp de verdade) só pra
// garantir ordem estável mesmo se duas decisões acontecerem no mesmo tick —
// evita depender de Date.now() dentro de lógica de jogo testável em Node.
const MAX_DECISOES_REGISTRADAS = 40;

function registrarDecisao(personagem, { icone = "📜", titulo, texto }) {
  const estado = garantirEstadoDoMundo(personagem);
  if (!Array.isArray(estado.decisoes)) estado.decisoes = [];
  if (typeof estado.proximoMomentoDecisao !== "number") estado.proximoMomentoDecisao = 0;
  estado.decisoes.push({ icone, titulo, texto, momento: estado.proximoMomentoDecisao++ });
  // Nunca deixa o registro crescer sem limite num save de longa duração —
  // as mais antigas saem primeiro (FIFO), igual a um diário de papel que só
  // guarda as últimas páginas.
  if (estado.decisoes.length > MAX_DECISOES_REGISTRADAS) estado.decisoes.shift();
}

// Mais recente primeiro, pra UI não precisar inverter nada.
function decisoesRegistradas(personagem) {
  return [...(garantirEstadoDoMundo(personagem).decisoes || [])].reverse();
}

// Resumo da reputação ATUAL com toda facção que o personagem já afetou
// (valor != 0) — a "consequência que ainda vale hoje" de escolhas antigas,
// complementando o registro cronológico acima (que só mostra o que
// aconteceu, não o placar atual). Facções nunca tocadas (reputação 0, nunca
// alterada) ficam de fora pra não poluir o diário com uma lista de 11
// facções zeradas logo no início do jogo.
function reputacoesParaExibir(personagem, dadosWorldState) {
  const estado = garantirEstadoDoMundo(personagem);
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  return facoes
    .map((f) => ({ facaoId: f.id, nome: f.nome, icone: f.icone || "", valor: estado.reputacao[f.id] || 0, tier: tierDaReputacao(estado.reputacao[f.id] || 0, dadosWorldState) }))
    .filter((r) => r.valor !== 0);
}

// Multiplicador de preço de loja pra aplicar em cima do valor base do item,
// derivado do tier de reputação com a facção "vila" (1 = preço normal,
// <1 = desconto, >1 = preço mais alto pra quem é malvisto/hostil).
// `facaoId` (melhoria pós-backlog, mercador itinerante — ver
// TravelingMerchantSystem.js): por padrão continua "vila" (comportamento
// idêntico a antes desta opção existir, usado pela loja fixa da vila em
// GameUI.js), mas aceita qualquer outra facção — o mercador itinerante usa
// a facção REGIONAL da zona onde aparece, não a reputação com a vila.
function multiplicadorPrecoLoja(personagem, dadosWorldState, facaoId = "vila") {
  const rep = getReputacao(personagem, facaoId);
  const tier = tierDaReputacao(rep, dadosWorldState);
  const desconto = tier ? tier.descontoLoja || 0 : 0;
  return Math.max(0.5, 1 - desconto);
}

// Emboscada regional (melhoria de jogabilidade pós-backlog original):
// consequência visível de reputação muito negativa com a facção regional da
// zona atual — moradores que te veem como inimigo armam emboscadas nos
// encontros aleatórios daquele território (ver EncounterSystem.js:
// reforcarEmboscada, aplicado em main.js). Reaproveita os mesmos tiers já
// usados pro desconto de loja (malvisto/hostil) em vez de criar uma escala
// paralela — ambos são "consequência de reputação ruim", só que um é
// econômico (preço) e o outro é de combate (emboscada).
const TIERS_HOSTIS_EMBOSCADA = new Set(["malvisto", "hostil"]);
const CHANCE_EMBOSCADA = 0.35;

function deveEmboscar(personagem, facaoId, dadosWorldState) {
  if (!facaoId) return false;
  const rep = getReputacao(personagem, facaoId);
  const tier = tierDaReputacao(rep, dadosWorldState);
  if (!tier || !TIERS_HOSTIS_EMBOSCADA.has(tier.id)) return false;
  return Math.random() < CHANCE_EMBOSCADA;
}

// --- Facções regionais (task #44) ---------------------------------------
// 10 facções ligadas a regiões do mundo aberto (ver worldStateVariables.json
// campo `zonas` de cada facção — os ids batem com ZONAS/worldMap.js), além
// da facção "vila" já existente (essa continua sendo só "simpatia popular",
// sem `zonas` — é tratada à parte). Dá regionalidade ao mapa (cada bioma
// pertence a um povo com identidade própria) e aos personagens (cada um,
// incluindo o principal, pode se afiliar a uma facção — ver
// afiliarFaccao/facaoAfiliada).

function facaoDaZona(zonaId, dadosWorldState) {
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  const f = facoes.find((f) => Array.isArray(f.zonas) && f.zonas.includes(zonaId));
  return f ? f.id : null;
}

function facaoInfo(facaoId, dadosWorldState) {
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  return facoes.find((f) => f.id === facaoId) || null;
}

// Afiliação é uma escolha pessoal do personagem (guardada em
// estadoDoMundo, então persiste no save automaticamente igual ao resto do
// mundo reativo) — diferente de reputação, que é numérica e sobe/desce.
// Pode ser trocada livremente (não é uma escolha permanente tipo árvore de
// habilidades): afiliação é sobre identidade/alianças atuais, não histórico.
function afiliarFaccao(personagem, facaoId) {
  garantirEstadoDoMundo(personagem).facaoAfiliada = facaoId;
}

function facaoAfiliada(personagem) {
  return garantirEstadoDoMundo(personagem).facaoAfiliada || null;
}

// "Camaradagem regional" (task #44): quando um convocado do gacha tem a
// MESMA facção que o personagem principal escolheu, o vínculo regional
// rende um pequeno bônus de combate — mesmo formato aditivo usado por
// bonusArvore/bonusAfinidade em CharacterFactory.js (FOR/DES/CON/INT/
// hpMaxPercent/mpMaxPercent/critChance/defesaFlat), somado do mesmo jeito.
// `personagemPrincipal` é sempre quem definiu a afiliação (só o herói
// escolhe facção pra si mesmo); convocados do gacha só "concordam" ou não
// com ela através do próprio `facaoId` de nascença (ver gachaRoster.json).
const BONUS_CAMARADAGEM = { FOR: 0, DES: 0, CON: 1, INT: 0, hpMaxPercent: 0.02, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };
const BONUS_VAZIO_FACCAO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

function bonusCamaradagemFaccao(personagem, personagemPrincipal) {
  const minhaAfiliacao = facaoAfiliada(personagemPrincipal);
  if (!minhaAfiliacao || !personagem.facaoId || personagem.facaoId !== minhaAfiliacao) return { ...BONUS_VAZIO_FACCAO };
  return { ...BONUS_CAMARADAGEM };
}

// Aplica o bônus de camaradagem direto num combatente já montado (ver
// CombatSystem.js criarCombatenteJogador) — feito assim, em vez de
// encaixado dentro de bonusArvore/bonusAfinidade em CharacterFactory.js,
// porque camaradagem depende da afiliação ATUAL do personagem principal e
// de QUEM está no time agora: pode mudar entre batalhas sem o personagem
// subir de nível, então não daria pra esperar o próximo recálculo de
// hpMax/mpMax (que só acontece em ganharXP/aplicarCrescimento). Mutação é
// segura aqui porque `combatente` é um objeto efêmero, recriado do zero a
// cada batalha (nunca é o `personagem`/instância salva).
function aplicarCamaradagemNoCombatente(combatente, membro, personagemPrincipal) {
  const bonus = bonusCamaradagemFaccao(membro, personagemPrincipal);
  if (Object.values(bonus).every((v) => !v)) return combatente;
  combatente.atributos.FOR = (combatente.atributos.FOR || 0) + bonus.FOR;
  combatente.atributos.DES = (combatente.atributos.DES || 0) + bonus.DES;
  combatente.atributos.CON = (combatente.atributos.CON || 0) + bonus.CON;
  combatente.atributos.INT = (combatente.atributos.INT || 0) + bonus.INT;
  combatente.defesa += bonus.defesaFlat;
  combatente.critBonus = (combatente.critBonus || 0) + bonus.critChance;
  if (bonus.hpMaxPercent) {
    const novoHpMax = Math.round(combatente.hpMax * (1 + bonus.hpMaxPercent));
    combatente.hp = Math.round(combatente.hp * (novoHpMax / combatente.hpMax));
    combatente.hpMax = novoHpMax;
  }
  if (bonus.mpMaxPercent) {
    const novoMpMax = Math.round(combatente.mpMax * (1 + bonus.mpMaxPercent));
    combatente.mp = combatente.mpMax > 0 ? Math.round(combatente.mp * (novoMpMax / combatente.mpMax)) : combatente.mp;
    combatente.mpMax = novoMpMax;
  }
  return combatente;
}

  return { estadoDoMundoInicial, garantirEstadoDoMundo, getReputacao, alterarReputacao, tierDaReputacao, definirFlag, temFlag, registrarDecisao, decisoesRegistradas, reputacoesParaExibir, multiplicadorPrecoLoja, deveEmboscar, facaoDaZona, facaoInfo, afiliarFaccao, facaoAfiliada, bonusCamaradagemFaccao, aplicarCamaradagemNoCombatente };
})();

const MOD_src_systems_FastTravelSystem_js = (function(){
// Viagem rápida entre zonas exploradas (melhoria de jogabilidade pós-backlog
// original): cada zona do mundo aberto (ver worldMap.js: ZONAS) que o
// personagem já pisou fica disponível pra teleporte instantâneo — evita
// atravessar o mapa de novo só pra voltar numa área já limpa. A Vila (ponto
// de partida seguro) está sempre disponível, mesmo antes de qualquer
// movimento, e masmorras nunca entram na lista (viagem rápida só cobre o
// mundo aberto — entrar numa masmorra continua exigindo achar a entrada).
//
// Reaproveita o campo `biomaVisitados` já existente em CharacterFactory.js
// (declarado desde antes, mas nunca lido em lugar nenhum) em vez de criar um
// campo novo — cada zona do mundo aberto É um bioma no sentido do jogo, e o
// nome já bate com "zonas por onde o personagem passou".
const ZONA_INICIAL_SEMPRE_DISPONIVEL = "vila";

// Marca uma zona como visitada (idempotente — não duplica). Chamado pelo
// main.js sempre que verificarMudancaDeZona() detecta uma zona nova.
function marcarZonaVisitada(personagem, zonaId) {
  if (!personagem.biomaVisitados) personagem.biomaVisitados = [];
  if (!zonaId || personagem.biomaVisitados.includes(zonaId)) return;
  personagem.biomaVisitados.push(zonaId);
}

function zonaFoiVisitada(personagem, zonaId) {
  if (zonaId === ZONA_INICIAL_SEMPRE_DISPONIVEL) return true;
  return !!(personagem.biomaVisitados && personagem.biomaVisitados.includes(zonaId));
}

// Lista, na mesma ordem de ZONAS (worldMap.js), as zonas disponíveis pra
// viagem rápida a partir do progresso do personagem.
function zonasDisponiveisParaViagem(personagem, ZONAS) {
  return ZONAS.filter((z) => zonaFoiVisitada(personagem, z.id));
}

// Ponto de chegada "ideal" de uma zona: o primeiro marco (pontosDeInteresse
// tipo "marco") se existir — são posições escolhidas à mão, então já ficam
// em terreno andável — senão o centro da bounding box da zona. Retorna
// coordenadas de grid puras; quem chama é responsável por checar colisão
// contra o grid real (este módulo não depende do grid renderizado, pra
// continuar testável sem montar o mundo inteiro).
function pontoDeChegada(zona) {
  const marco = (zona.pontosDeInteresse || []).find((p) => p.tipo === "marco");
  if (marco) return { x: marco.x, y: marco.y };
  return { x: Math.floor((zona.x0 + zona.x1) / 2), y: Math.floor((zona.y0 + zona.y1) / 2) };
}

  return { ZONA_INICIAL_SEMPRE_DISPONIVEL, marcarZonaVisitada, zonaFoiVisitada, zonasDisponiveisParaViagem, pontoDeChegada };
})();

const MOD_src_systems_AccessibilitySystem_js = (function(){
// Configurações de acessibilidade (melhoria de jogabilidade pós-backlog
// original): preferências do JOGADOR, não do personagem — persistem
// separadas do save de progresso (chave própria no localStorage), então
// sobrevivem a Nova Aventura, New Game+ e até apagar o save. Cobre 4 eixos
// concretos: velocidade das mensagens na tela, tremor/flash de tela em
// combate, tamanho de fonte e alto contraste.
//
// Funções puras (mesclarConfig/multiplicadorVelocidadeMensagem/etc.) nunca
// tocam localStorage — só carregarConfigAcessibilidade/
// salvarConfigAcessibilidade fazem isso, e sempre com guarda de
// disponibilidade (localStorage pode não existir: testes Node, modo
// privado do navegador, etc.) — sem ele, a preferência ainda funciona
// dentro da sessão atual (cache em memória), só não persiste entre
// recarregamentos. Isso também é o que torna este sistema testável em Node
// sem precisar de um DOM/localStorage de mentira.

const CHAVE_LOCALSTORAGE = "rpg_pt_acessibilidade_v1";

// Multiplicador aplicado à duração padrão das mensagens (ver
// mostrarMensagem em GameUI.js) — "lenta" dá mais tempo pra ler, "rápida"
// tira as mensagens da tela mais cedo pra quem já conhece o jogo.
const VELOCIDADES_MENSAGEM = { lenta: 1.6, normal: 1, rapida: 0.55 };
const TAMANHOS_FONTE = ["normal", "grande", "gigante"];

const PADRAO = {
  velocidadeMensagem: "normal",
  reduzirEfeitos: false,
  tamanhoFonte: "normal",
  altoContraste: false,
};

let cache = null;

function localStorageDisponivel() {
  return typeof localStorage !== "undefined";
}

// Mescla um objeto parcial de configuração por cima do padrão, ignorando
// qualquer chave desconhecida e qualquer valor fora do domínio esperado
// (ex.: velocidadeMensagem: "turbo" não é uma opção válida) — nunca deixa a
// configuração final num estado inconsistente por causa de um save/valor
// corrompido ou de uma versão futura/antiga do jogo.
function mesclarConfig(parcial) {
  const p = parcial || {};
  return {
    velocidadeMensagem: p.velocidadeMensagem in VELOCIDADES_MENSAGEM ? p.velocidadeMensagem : PADRAO.velocidadeMensagem,
    reduzirEfeitos: typeof p.reduzirEfeitos === "boolean" ? p.reduzirEfeitos : PADRAO.reduzirEfeitos,
    tamanhoFonte: TAMANHOS_FONTE.includes(p.tamanhoFonte) ? p.tamanhoFonte : PADRAO.tamanhoFonte,
    altoContraste: typeof p.altoContraste === "boolean" ? p.altoContraste : PADRAO.altoContraste,
  };
}

function carregarConfigAcessibilidade() {
  if (cache) return cache;
  if (localStorageDisponivel()) {
    try {
      const raw = localStorage.getItem(CHAVE_LOCALSTORAGE);
      cache = raw ? mesclarConfig(JSON.parse(raw)) : mesclarConfig(null);
    } catch (e) {
      cache = mesclarConfig(null);
    }
  } else {
    cache = mesclarConfig(null);
  }
  return cache;
}

function salvarConfigAcessibilidade(config) {
  cache = mesclarConfig(config);
  if (localStorageDisponivel()) {
    try { localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(cache)); } catch (e) { /* modo privado, cota etc. — segue só em memória */ }
  }
  return cache;
}

function atualizarConfigAcessibilidade(parcial) {
  return salvarConfigAcessibilidade({ ...carregarConfigAcessibilidade(), ...parcial });
}

function multiplicadorVelocidadeMensagem() {
  return VELOCIDADES_MENSAGEM[carregarConfigAcessibilidade().velocidadeMensagem] || 1;
}

function efeitosReduzidos() {
  return carregarConfigAcessibilidade().reduzirEfeitos;
}

// Só pra testes: reseta o cache em memória (localStorage real não existe em
// Node, então não há nada pra limpar lá) — cada bloco de teste começa do
// zero em vez de herdar o estado de um bloco anterior.
function _resetParaTeste() {
  cache = null;
}

  return { VELOCIDADES_MENSAGEM, TAMANHOS_FONTE, mesclarConfig, carregarConfigAcessibilidade, salvarConfigAcessibilidade, atualizarConfigAcessibilidade, multiplicadorVelocidadeMensagem, efeitosReduzidos, _resetParaTeste };
})();

const MOD_src_ui_GameUI_js = (function(){
  const RARITY_COLORS = MOD_src_systems_InventorySystem_js.RARITY_COLORS;
  const RARITY_LABEL = MOD_src_systems_InventorySystem_js.RARITY_LABEL;
  const equiparItem = MOD_src_systems_InventorySystem_js.equiparItem;
  const desequiparItem = MOD_src_systems_InventorySystem_js.desequiparItem;
  const usarConsumivel = MOD_src_systems_InventorySystem_js.usarConsumivel;
  const venderItem = MOD_src_systems_InventorySystem_js.venderItem;
  const comprarItem = MOD_src_systems_InventorySystem_js.comprarItem;
  const receitaDisponivel = MOD_src_systems_CraftingSystem_js.receitaDisponivel;
  const craftar = MOD_src_systems_CraftingSystem_js.craftar;
  const itemPodeSerAprimorado = MOD_src_systems_EnchantSystem_js.itemPodeSerAprimorado;
  const nivelAprimoramento = MOD_src_systems_EnchantSystem_js.nivelAprimoramento;
  const custoProximoNivel = MOD_src_systems_EnchantSystem_js.custoProximoNivel;
  const podeAprimorar = MOD_src_systems_EnchantSystem_js.podeAprimorar;
  const aprimorarItem = MOD_src_systems_EnchantSystem_js.aprimorarItem;
  const MAX_NIVEL_APRIMORAMENTO = MOD_src_systems_EnchantSystem_js.MAX_NIVEL_APRIMORAMENTO;
  const iniciarMissao = MOD_src_systems_QuestSystem_js.iniciarMissao;
  const missaoPronta = MOD_src_systems_QuestSystem_js.missaoPronta;
  const concluirMissao = MOD_src_systems_QuestSystem_js.concluirMissao;
  const missoesDiariasParaExibir = MOD_src_systems_DailyQuestSystem_js.missoesDiariasParaExibir;
  const coletarRecompensaDiaria = MOD_src_systems_DailyQuestSystem_js.coletarRecompensaDiaria;
  const ganharXP = MOD_src_systems_CharacterFactory_js.ganharXP;
  const aplicarCrescimento = MOD_src_systems_CharacterFactory_js.aplicarCrescimento;
  const cryptoId = MOD_src_systems_CharacterFactory_js.cryptoId;
  const escolhaPendente = MOD_src_systems_CharacterFactory_js.escolhaPendente;
  const adicionarFragmentos = MOD_src_systems_GachaSystem_js.adicionarFragmentos;
  const checarConquistas = MOD_src_systems_GachaSystem_js.checarConquistas;
  const testesDoContexto = MOD_src_systems_SkillCheckSystem_js.testesDoContexto;
  const testeJaFeito = MOD_src_systems_SkillCheckSystem_js.testeJaFeito;
  const marcarTesteFeito = MOD_src_systems_SkillCheckSystem_js.marcarTesteFeito;
  const realizarTeste = MOD_src_systems_SkillCheckSystem_js.realizarTeste;
  const getReputacao = MOD_src_systems_WorldStateSystem_js.getReputacao;
  const alterarReputacao = MOD_src_systems_WorldStateSystem_js.alterarReputacao;
  const tierDaReputacao = MOD_src_systems_WorldStateSystem_js.tierDaReputacao;
  const multiplicadorPrecoLoja = MOD_src_systems_WorldStateSystem_js.multiplicadorPrecoLoja;
  const registrarDecisao = MOD_src_systems_WorldStateSystem_js.registrarDecisao;
  const zonaFoiVisitada = MOD_src_systems_FastTravelSystem_js.zonaFoiVisitada;
  const conjuntosParaExibir = MOD_src_systems_SetBonusSystem_js.conjuntosParaExibir;
  const multiplicadorVelocidadeMensagem = MOD_src_systems_AccessibilitySystem_js.multiplicadorVelocidadeMensagem;
// Telas de inventário, missões, loja, forja, diálogo e HUD (tudo em DOM/HTML).













const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

function abrirModalBase(titulo) {
  overlay().classList.remove("hidden");
  conteudo().innerHTML = `<button class="fechar">Fechar (Esc)</button><h2>${titulo}</h2><div id="modal-corpo"></div>`;
  conteudo().querySelector(".fechar").onclick = fecharModal;
  return conteudo().querySelector("#modal-corpo");
}

function mostrarMensagem(texto, duracaoMs = 2200) {
  const el = document.getElementById("mensagem-topo");
  el.textContent = texto;
  el.classList.remove("hidden");
  clearTimeout(mostrarMensagem._t);
  // Acessibilidade (melhoria pós-backlog, ver AccessibilitySystem.js):
  // velocidade de mensagens é uma preferência do jogador, não do
  // personagem — multiplicador 1 (padrão) mantém o comportamento idêntico
  // a antes deste sistema existir.
  mostrarMensagem._t = setTimeout(() => el.classList.add("hidden"), Math.round(duracaoMs * multiplicadorVelocidadeMensagem()));
}

function atualizarHUD(personagem) {
  document.getElementById("hud-hp").style.width = `${Math.max(0, (personagem.hp / personagem.hpMax) * 100)}%`;
  document.getElementById("hud-mp").style.width = `${Math.max(0, (personagem.mp / personagem.mpMax) * 100)}%`;
  document.getElementById("hud-xp").style.width = `${Math.max(0, (personagem.xp / personagem.xpProximo) * 100)}%`;
  const fragmentos = personagem.gacha ? personagem.gacha.fragmentos : 0;
  // New Game+ (melhoria pós-backlog original): selo visível só quando o
  // personagem está numa run de NG+ (ngPlus > 0) — jogo normal fica igual a
  // antes desta melhoria existir.
  const seloNgPlus = personagem.ngPlus > 0 ? ` <span class="badge-ng-plus" title="New Game+: monstros mais fortes e valem mais XP/ouro">🔥 NG+${personagem.ngPlus}</span>` : "";
  // Modo História (melhoria pós-backlog): selo visível só quando ligado —
  // mesmo padrão do selo de NG+ acima, jogo normal fica igual a antes desta
  // melhoria existir.
  const seloModoHistoria = personagem.modoHistoria ? ` <span class="badge-modo-historia" title="Modo História: monstros mais fracos, XP/ouro normais">📖 Modo História</span>` : "";
  document.getElementById("hud-info").innerHTML =
    `<b>${personagem.nome}</b> - Nv. ${personagem.nivel} ${personagem.classeIcone || ""} ${personagem.classeNome}${seloNgPlus}${seloModoHistoria}<br/>HP ${personagem.hp}/${personagem.hpMax} · MP ${personagem.mp}/${personagem.mpMax} · Ouro: ${personagem.ouro} · Fragmentos: ${fragmentos}`;
}

function itemCardHTML(item, extraBotoesHTML = "") {
  const cor = RARITY_COLORS[item.raridade] || "#888";
  return `
    <div class="card">
      <span class="icon-frame" style="border-color:${cor}"><img src="assets/icons/${item.icone}.png" /></span>
      <div class="info">
        <div class="nome">${item.nome} <span class="raridade-badge" style="background:${cor}">${RARITY_LABEL[item.raridade]}</span></div>
        <div class="desc">${item.descricao || ""}</div>
      </div>
      <div>${extraBotoesHTML}</div>
    </div>`;
}

// Ordem fixa dos 7 slots de equipamento — sempre renderizados, vazios ou
// não, pra virar um painel visual estável em vez de uma lista que só mostra
// o que está preenchido (task #39).
const SLOTS_EQUIPAMENTO = [
  { slot: "arma", label: "Arma", icone: "⚔️" },
  { slot: "peito", label: "Peito", icone: "🛡️" },
  { slot: "cabeca", label: "Cabeça", icone: "🪖" },
  { slot: "pes", label: "Pés", icone: "👢" },
  { slot: "escudo", label: "Escudo", icone: "🔰" },
  { slot: "anel", label: "Anel", icone: "💍" },
  { slot: "amuleto", label: "Amuleto", icone: "📿" },
];

function slotEquipadoHTML({ slot, label, icone }, item) {
  if (!item) {
    return `
      <div class="equip-slot vazio" data-slot="${slot}">
        <span class="equip-slot-icone">${icone}</span>
        <div class="equip-slot-label">${label}</div>
        <div class="equip-slot-vazio-texto">Vazio</div>
      </div>`;
  }
  const cor = RARITY_COLORS[item.raridade] || "#888";
  return `
    <div class="equip-slot preenchido" data-slot="${slot}" style="border-color:${cor}">
      <span class="icon-frame" style="border-color:${cor}"><img src="assets/icons/${item.icone}.png" /></span>
      <div class="equip-slot-label">${label}</div>
      <div class="equip-slot-item-nome">${item.nome}</div>
      <button data-slot="${slot}" class="btn-desequipar">Remover</button>
    </div>`;
}

// Agrupa itens idênticos (mesmo `id`) da mochila numa única pilha visual —
// a mochila em si continua guardando um objeto por unidade (cada um com seu
// próprio uid, ver InventorySystem.js), isso é só apresentação (task #39).
// Exportada (e não só usada internamente) pra dar pra testar a lógica de
// agrupamento sem precisar de DOM — ver scripts/test_inventory_ui.mjs.
function empilharInventario(inventario) {
  const pilhas = new Map();
  inventario.forEach((item) => {
    if (!pilhas.has(item.id)) pilhas.set(item.id, { item, uids: [] });
    pilhas.get(item.id).uids.push(item.uid);
  });
  return [...pilhas.values()];
}

function montarInventario(personagem, onMudar) {
  const corpo = abrirModalBase("Inventário");

  const equipDiv = document.createElement("div");
  equipDiv.innerHTML = "<h3>Equipado</h3>";
  const gridEquip = document.createElement("div");
  gridEquip.className = "equip-slots-grid";
  gridEquip.innerHTML = SLOTS_EQUIPAMENTO.map((s) => slotEquipadoHTML(s, personagem.equipamento[s.slot])).join("");
  equipDiv.appendChild(gridEquip);
  corpo.appendChild(equipDiv);

  // Conjuntos de equipamento (melhoria pós-backlog, ver SetBonusSystem.js):
  // mostra o progresso de cada conjunto com pelo menos 1 peça equipada, pra
  // o jogador saber que vestir peças combinando dá um bônus extra.
  const conjuntosAtivos = conjuntosParaExibir(personagem);
  if (conjuntosAtivos.length) {
    const conjDiv = document.createElement("div");
    conjDiv.innerHTML = "<h3>Conjuntos</h3>";
    conjuntosAtivos.forEach((c) => {
      const p = document.createElement("p");
      p.className = "desc conjunto-resumo" + (c.tiersAtivos > 0 ? " conjunto-ativo" : "");
      const statusTexto = c.proximoTierEm
        ? `${c.equipadas}/${c.total} peças — vista mais ${c.proximoTierEm - c.equipadas} pra ativar o próximo bônus`
        : `${c.equipadas}/${c.total} peças — todos os bônus ativos!`;
      p.textContent = `${c.nome}: ${statusTexto}`;
      conjDiv.appendChild(p);
    });
    corpo.appendChild(conjDiv);
  }

  const invDiv = document.createElement("div");
  invDiv.innerHTML = "<h3>Mochila</h3>";
  if (personagem.inventario.length === 0) invDiv.innerHTML += "<p>Vazia.</p>";
  const pilhas = empilharInventario(personagem.inventario);
  pilhas.forEach(({ item, uids }) => {
    const qtd = uids.length;
    const primeiroUid = uids[0];
    let botoes = "";
    if (item.tipo === "arma" || item.tipo === "armadura" || item.tipo === "acessorio") {
      botoes = `<button data-uid="${primeiroUid}" class="btn-equipar">Equipar</button>`;
    } else if (item.tipo === "consumivel") {
      botoes = `<button data-uid="${primeiroUid}" class="btn-usar">Usar</button>`;
    }
    const precoUnitario = Math.max(1, Math.round((item.valor || 1) * 0.5));
    botoes += ` <button data-uid="${primeiroUid}" class="btn-vender">Vender (${precoUnitario}o)</button>`;
    if (qtd > 1) {
      botoes += ` <button data-id="${item.id}" class="btn-vender-tudo">Vender Tudo (x${qtd}, ${precoUnitario * qtd}o)</button>`;
    }
    const nomeComQtd = qtd > 1 ? `${item.nome} <span class="stack-badge">x${qtd}</span>` : item.nome;
    const div = document.createElement("div");
    div.innerHTML = itemCardHTML({ ...item, nome: nomeComQtd }, botoes);
    invDiv.appendChild(div);
  });
  corpo.appendChild(invDiv);

  corpo.querySelectorAll(".btn-equipar").forEach((b) => b.onclick = () => {
    equiparItem(personagem, b.dataset.uid);
    onMudar(); montarInventario(personagem, onMudar);
  });
  corpo.querySelectorAll(".btn-desequipar").forEach((b) => b.onclick = () => {
    desequiparItem(personagem, b.dataset.slot);
    onMudar(); montarInventario(personagem, onMudar);
  });
  corpo.querySelectorAll(".btn-usar").forEach((b) => b.onclick = () => {
    const r = usarConsumivel(personagem, b.dataset.uid);
    if (r.msg) mostrarMensagem(r.msg);
    onMudar(); montarInventario(personagem, onMudar);
  });
  corpo.querySelectorAll(".btn-vender").forEach((b) => b.onclick = () => {
    const valor = venderItem(personagem, b.dataset.uid);
    mostrarMensagem(`Vendido por ${valor} de ouro.`);
    onMudar(); montarInventario(personagem, onMudar);
  });
  corpo.querySelectorAll(".btn-vender-tudo").forEach((b) => b.onclick = () => {
    const pilha = pilhas.find((p) => p.item.id === b.dataset.id);
    let total = 0;
    if (pilha) pilha.uids.forEach((uid) => { total += venderItem(personagem, uid); });
    mostrarMensagem(`Vendidos ${pilha ? pilha.uids.length : 0} itens por ${total} de ouro no total.`);
    onMudar(); montarInventario(personagem, onMudar);
  });
}

// Missões diárias leves (melhoria de jogabilidade pós-backlog original, ver
// DailyQuestSystem.js): sempre os mesmos 3 objetivos, resetam sozinhos a
// cada dia. Fica no topo da tela de Missões, separado das missões de NPC —
// não precisa aceitar nada, o progresso já conta sozinho a partir do
// momento em que o personagem existe.
function montarMissoesDiarias(corpo, personagem, onMudar) {
  const bloco = document.createElement("div");
  bloco.innerHTML = "<h3>📅 Missões Diárias</h3><p class=\"desc\">Resetam todo dia. Progresso conta sozinho enquanto você joga normalmente.</p>";
  missoesDiariasParaExibir(personagem).forEach(({ template, atual, meta, concluida, coletada }) => {
    const div = document.createElement("div");
    div.className = "card";
    const statusTxt = coletada
      ? "Recompensa já resgatada hoje. ✅"
      : `Progresso: ${atual}/${meta}${concluida ? " — pronta pra resgatar!" : ""}`;
    div.innerHTML = `<div class="info"><div class="nome">${template.icone} ${template.nome}</div>
        <div class="desc">${template.descricao}</div>
        <div class="desc">${statusTxt} · Recompensa: ${template.recompensaOuro}o + ${template.recompensaFragmentos} Fragmentos</div></div>
      <div><button ${concluida && !coletada ? "" : "disabled"} data-id="${template.id}" class="btn-resgatar-diaria">Resgatar</button></div>`;
    bloco.appendChild(div);
  });
  corpo.appendChild(bloco);
  bloco.querySelectorAll(".btn-resgatar-diaria").forEach((b) => b.onclick = () => {
    const res = coletarRecompensaDiaria(personagem, b.dataset.id);
    if (res.ok) {
      if (res.fragmentos) adicionarFragmentos(personagem, res.fragmentos);
      mostrarMensagem(`Recompensa diária resgatada: +${res.ouro} ouro, +${res.fragmentos} Fragmentos de Aethra!`);
    } else {
      mostrarMensagem(res.msg);
    }
    onMudar();
  });
}

function montarMissoes(personagem, dados) {
  const corpo = abrirModalBase("Missões");
  montarMissoesDiarias(corpo, personagem, () => montarMissoes(personagem, dados));
  const hSeparador = document.createElement("h3");
  hSeparador.textContent = "Missões de NPCs";
  corpo.appendChild(hSeparador);
  if (personagem.missoesAtivas.length === 0 && personagem.missoesConcluidas.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Nenhuma missão aceita ainda. Converse com os NPCs da vila!";
    corpo.appendChild(p);
    return;
  }
  personagem.missoesAtivas.forEach((m) => {
    const def = dados.quests.find((q) => q.id === m.id);
    const meta = def.quantidade || 1;
    const pronto = missaoPronta(personagem, def);
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">${def.nome} ${pronto ? "✅" : ""}</div>
      <div class="desc">${def.descricao}</div>
      <div class="desc">Progresso: ${m.progresso}/${meta}</div></div>`;
    corpo.appendChild(div);
  });
  if (personagem.missoesConcluidas.length) {
    const h = document.createElement("h3");
    h.textContent = "Concluídas";
    corpo.appendChild(h);
    personagem.missoesConcluidas.forEach((id) => {
      const def = dados.quests.find((q) => q.id === id);
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<div class="info"><div class="nome">${def.nome}</div></div>`;
      corpo.appendChild(div);
    });
  }
}

// Aprimoramento de equipamento (melhoria de jogabilidade pós-backlog
// original, ver EnchantSystem.js): lista todo item aprimorável — equipado
// OU ainda na mochila — com o custo do próximo nível e um botão pra gastar.
// Reaproveita o mesmo `uid` usado por equipar/desequipar/vender, então
// funciona nos dois lugares sem duplicar lógica de busca.
function itensAprimoraveis(personagem) {
  const equipados = Object.values(personagem.equipamento).filter(Boolean);
  const daMochila = personagem.inventario.filter(itemPodeSerAprimorado);
  return [...equipados, ...daMochila].filter(itemPodeSerAprimorado);
}

function custoTextoAprimoramento(custo, dados) {
  const materiaisTxt = custo.materiais.map((m) => {
    const item = dados.items.itens.find((x) => x.id === m.itemId);
    return `${item ? item.nome : m.itemId} x${m.quantidade}`;
  }).join(", ");
  return `${custo.ouro}o + ${materiaisTxt}`;
}

function montarAprimoramento(corpo, personagem, dados, onMudar) {
  const bloco = document.createElement("div");
  bloco.innerHTML = "<h3>⚒️ Aprimorar Equipamento</h3><p class=\"desc\">Gasta ouro e materiais pra fortalecer um item que você já tem, em vez de descartá-lo por um melhor. Máximo +" + MAX_NIVEL_APRIMORAMENTO + ".</p>";
  const itens = itensAprimoraveis(personagem);
  if (!itens.length) {
    bloco.innerHTML += "<p>Nenhum item aprimorável equipado ou na mochila.</p>";
  }
  itens.forEach((item) => {
    const nivel = nivelAprimoramento(item);
    const custo = custoProximoNivel(item);
    const check = podeAprimorar(personagem, item);
    const div = document.createElement("div");
    div.className = "card";
    const statusTxt = custo
      ? `Nível +${nivel} → +${nivel + 1} · Custo: ${custoTextoAprimoramento(custo, dados)}`
      : `Nível máximo (+${MAX_NIVEL_APRIMORAMENTO}) atingido.`;
    div.innerHTML = `<div class="info"><div class="nome">${item.nome}</div><div class="desc">${statusTxt}</div></div>
      <div><button ${check.ok ? "" : "disabled"} title="${!check.ok ? check.msg : ""}" data-uid="${item.uid}" class="btn-aprimorar">Aprimorar</button></div>`;
    bloco.appendChild(div);
  });
  corpo.appendChild(bloco);
  bloco.querySelectorAll(".btn-aprimorar").forEach((b) => b.onclick = () => {
    const res = aprimorarItem(personagem, b.dataset.uid);
    if (res.ok) mostrarMensagem(`${res.item.nome} aprimorado!`);
    else mostrarMensagem(res.msg);
    onMudar(); montarForja(personagem, dados, onMudar);
  });
}

function montarForja(personagem, dados, onMudar) {
  const corpo = abrirModalBase("Forja & Alquimia");
  const receitasBloco = document.createElement("div");
  receitasBloco.innerHTML = "<h3>🔨 Receitas</h3>";
  if (dados.recipes.length === 0) receitasBloco.innerHTML += "<p>Nenhuma receita conhecida.</p>";
  dados.recipes.forEach((r) => {
    const disponivel = receitaDisponivel(personagem, r);
    const ingredientesTxt = r.ingredientes.map((i) => {
      const item = dados.items.itens.find((x) => x.id === i.itemId);
      return `${item ? item.nome : i.itemId} x${i.quantidade}`;
    }).join(", ");
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">${r.nome}</div><div class="desc">Requer: ${ingredientesTxt}</div></div>
      <div><button ${disponivel ? "" : "disabled"} data-id="${r.id}" class="btn-craft">Criar</button></div>`;
    receitasBloco.appendChild(div);
  });
  corpo.appendChild(receitasBloco);
  corpo.querySelectorAll(".btn-craft").forEach((b) => b.onclick = () => {
    const receita = dados.recipes.find((r) => r.id === b.dataset.id);
    const res = craftar(personagem, receita, dados.items.itens);
    if (res.ok) mostrarMensagem(`Você criou: ${res.item.nome}!`);
    onMudar(); montarForja(personagem, dados, onMudar);
  });

  montarAprimoramento(corpo, personagem, dados, onMudar);
}

// Viagem rápida (melhoria de jogabilidade pós-backlog original, ver
// FastTravelSystem.js): lista toda zona do mundo aberto já visitada
// (`ZONAS`, a lista completa, vem de worldMap.js — filtra aqui em vez de
// receber já filtrada pra poder mostrar as zonas ainda não exploradas como
// bloqueadas "???" em vez de simplesmente omiti-las, dando ao jogador uma
// noção de quanto do mapa falta visitar). `zonaAtualId` desabilita o botão
// da zona onde o personagem já está.
function montarViagemRapida(personagem, ZONAS, zonaAtualId, onViajar) {
  const corpo = abrirModalBase("🧭 Viagem Rápida");
  const intro = document.createElement("p");
  intro.className = "desc";
  intro.textContent = "Teleporte instantâneo para qualquer zona do mundo aberto que você já visitou.";
  corpo.appendChild(intro);

  ZONAS.forEach((zona) => {
    const visitada = zonaFoiVisitada(personagem, zona.id);
    const div = document.createElement("div");
    div.className = "card";
    if (!visitada) {
      div.innerHTML = `<div class="info"><div class="nome">??? </div><div class="desc">Zona ainda não explorada.</div></div>`;
      corpo.appendChild(div);
      return;
    }
    const aqui = zona.id === zonaAtualId;
    div.innerHTML = `<div class="info"><div class="nome">${zona.nome}${aqui ? " (você está aqui)" : ""}</div><div class="desc">${zona.descricao || ""}</div></div>
      <div><button ${aqui ? "disabled" : ""} data-id="${zona.id}" class="btn-viajar">Viajar</button></div>`;
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-viajar").forEach((b) => b.onclick = () => onViajar(b.dataset.id));
}

function montarLoja(personagem, dados, onMudar) {
  // Reputação com a vila (mundo reativo, ver WorldStateSystem.js) muda o
  // preço de tudo na loja: quem ajudou a vila paga menos, quem é malvisto
  // paga mais — uma consequência tangível e recorrente das escolhas do
  // jogador, não só um texto de sabor.
  const multPreco = multiplicadorPrecoLoja(personagem, dados.worldStateVariables);
  const tierAtual = tierDaReputacao(getReputacao(personagem, "vila"), dados.worldStateVariables);
  const tituloDesconto = multPreco !== 1 ? ` (${multPreco < 1 ? "-" : "+"}${Math.abs(Math.round((1 - multPreco) * 100))}% por reputação: ${tierAtual ? tierAtual.nome : ""})` : "";
  const corpo = abrirModalBase(`Mercador — Seu ouro: ${personagem.ouro}${tituloDesconto}`);
  const catalogo = dados.items.itens.filter((i) => i.raridade === "comum" || i.raridade === "incomum").slice(0, 24);
  catalogo.forEach((item) => {
    const precoFinal = Math.max(1, Math.round(item.valor * multPreco));
    const div = document.createElement("div");
    div.innerHTML = itemCardHTML(item, `<button data-id="${item.id}" class="btn-comprar">Comprar (${precoFinal}o)</button>`);
    corpo.appendChild(div);
  });
  corpo.querySelectorAll(".btn-comprar").forEach((b) => b.onclick = () => {
    const item = dados.items.itens.find((i) => i.id === b.dataset.id);
    const r = comprarItem(personagem, item, multPreco);
    if (!r.ok) mostrarMensagem(r.msg);
    else mostrarMensagem(`Comprou: ${item.nome} (${r.preco}o)!`);
    onMudar(); montarLoja(personagem, dados, onMudar);
  });
}

// Ganhos de reputação com a facção "vila" — pequenos e nunca negativos, pra
// recompensar ajudar sem punir o jogador por simplesmente jogar (ver
// princípio de design: consequências viram novas rotas/benefícios, não
// bloqueios).
const REPUTACAO_POR_TESTE_SUCESSO = 3;
const REPUTACAO_POR_MISSAO = 5;

function montarDialogo(npc, dados, personagem, onMudar) {
  const corpo = abrirModalBase(npc.nome);
  const p = document.createElement("p");
  p.textContent = npc.dialogo;
  corpo.appendChild(p);

  // Mundo reativo: a reputação com a vila muda a saudação de cada NPC — uma
  // consequência visível, recorrente, das missões e testes de perícia que o
  // jogador já resolveu (ver WorldStateSystem.js).
  const tierRep = tierDaReputacao(getReputacao(personagem, "vila"), dados.worldStateVariables);
  if (tierRep && tierRep.saudacao) {
    const saud = document.createElement("p");
    saud.style.cssText = "opacity:0.85;font-style:italic;";
    saud.textContent = `"${tierRep.saudacao}" (Reputação: ${tierRep.nome})`;
    corpo.appendChild(saud);
  }

  if (npc.id === "npc_mercador") {
    const btn = document.createElement("button");
    btn.className = "primario";
    btn.textContent = "Ver itens à venda";
    btn.onclick = () => montarLoja(personagem, dados, onMudar);
    corpo.appendChild(btn);
    return;
  }

  // Testes de perícia (d20) oferecidos por este NPC — ver skillChecks.json.
  // Cada um pode ser tentado uma única vez por personagem quando marcado
  // como "unicoPorPersonagem", pra não virar uma fonte infinita de ouro.
  const testes = testesDoContexto(dados.skillChecks, "npc", { npcId: npc.id })
    .filter((t) => !t.unicoPorPersonagem || !testeJaFeito(personagem, t.id));
  testes.forEach((teste) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">🎲 ${teste.pericia}</div><div class="desc">${teste.textoOferta}</div></div>
      <div><button class="btn-teste-pericia" data-id="${teste.id}">Tentar</button></div>`;
    corpo.appendChild(div);
  });
  corpo.querySelectorAll(".btn-teste-pericia").forEach((b) => b.onclick = () => {
    const teste = testes.find((t) => t.id === b.dataset.id);
    const r = realizarTeste(personagem, dados, teste);
    if (teste.unicoPorPersonagem) marcarTesteFeito(personagem, teste.id);
    const rolagemTxt = `[d20: ${r.d}${r.modAtributo ? ` +${r.modAtributo} atributo` : ""}${r.proficiente ? ` +${r.bonusPericia} perícia` : ""} = ${r.total} vs. DC ${r.dificuldade}]`;
    if (r.sucesso) {
      if (teste.recompensaOuroSucesso) personagem.ouro += teste.recompensaOuroSucesso;
      alterarReputacao(personagem, "vila", REPUTACAO_POR_TESTE_SUCESSO, dados.worldStateVariables);
      mostrarMensagem(`✅ Sucesso! ${teste.textoSucesso} ${rolagemTxt}${teste.recompensaOuroSucesso ? ` (+${teste.recompensaOuroSucesso} ouro)` : ""} (+${REPUTACAO_POR_TESTE_SUCESSO} reputação)`, 4200);
      registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: teste.textoSucesso });
    } else {
      mostrarMensagem(`❌ Falha. ${teste.textoFalha} ${rolagemTxt}`, 4200);
      registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: teste.textoFalha });
    }
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar);
  });

  const quests = dados.quests.filter((q) => q.npcId === npc.id);
  quests.forEach((q) => {
    const jaAtiva = personagem.missoesAtivas.some((m) => m.id === q.id);
    const jaConcluida = personagem.missoesConcluidas.includes(q.id);
    const div = document.createElement("div");
    div.className = "card";
    if (jaConcluida) {
      div.innerHTML = `<div class="info"><div class="nome">${q.nome} (concluída)</div></div>`;
    } else if (jaAtiva) {
      const pronto = missaoPronta(personagem, q);
      div.innerHTML = `<div class="info"><div class="nome">${q.nome}</div><div class="desc">${q.descricao}</div></div>
        <div><button ${pronto ? "" : "disabled"} class="btn-entregar" data-id="${q.id}">${pronto ? "Entregar" : "Em progresso"}</button></div>`;
    } else {
      div.innerHTML = `<div class="info"><div class="nome">${q.nome}</div><div class="desc">${q.descricao}</div>
        <div class="desc">Recompensa: ${q.recompensaOuro} ouro, ${q.recompensaXP} XP</div></div>
        <div><button class="btn-aceitar" data-id="${q.id}">Aceitar</button></div>`;
    }
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-aceitar").forEach((b) => b.onclick = () => {
    const q = dados.quests.find((x) => x.id === b.dataset.id);
    iniciarMissao(personagem, q);
    mostrarMensagem(`Missão aceita: ${q.nome}`);
    montarDialogo(npc, dados, personagem, onMudar);
  });
  corpo.querySelectorAll(".btn-entregar").forEach((b) => b.onclick = () => {
    const q = dados.quests.find((x) => x.id === b.dataset.id);
    const r = concluirMissao(personagem, q, dados.items.itens);
    if (r.ok) {
      if (r.item) {
        personagem.inventario.push({ ...r.item, uid: cryptoId() });
      }
      const { subiuNivel } = ganharXP(personagem, r.xp);
      subiuNivel.forEach(() => aplicarCrescimento(personagem, dados));
      if (r.fragmentos) adicionarFragmentos(personagem, r.fragmentos);
      checarConquistas(personagem, {});
      alterarReputacao(personagem, "vila", REPUTACAO_POR_MISSAO, dados.worldStateVariables);
      let msg = `Missão concluída! +${r.ouro} ouro, +${r.xp} XP${r.fragmentos ? `, +${r.fragmentos} Fragmentos de Aethra` : ""}${r.item ? `, item: ${r.item.nome}` : ""} (+${REPUTACAO_POR_MISSAO} reputação com a vila)`;
      if (escolhaPendente(personagem, dados)) msg += " · 🌟 Nova escolha de habilidade disponível (T)!";
      mostrarMensagem(msg);
    }
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar);
  });
}

  return { fecharModal, abrirModalBase, mostrarMensagem, atualizarHUD, itemCardHTML, empilharInventario, montarInventario, montarMissoes, montarForja, montarViagemRapida, montarLoja, montarDialogo };
})();

const MOD_src_systems_ElementSystem_js = (function(){
// Matriz de força/fraqueza elemental, lida inteiramente dos dados
// (src/data/elements.json) — nenhum multiplicador fica espalhado no código.
// Elemento "fisico" (ou ausente) nunca tem vantagem/resistência: dano
// continua neutro, igual ao comportamento de antes deste sistema existir.
//
// Níveis possíveis (do mais forte pro mais fraco pro atacante):
//   "vantagem_intensa" > "vantagem" > "neutro" > "resistencia" > "resistencia_intensa" > "imune"
// "imune" é sempre o mesmo elemento atacando o mesmo elemento (ex.: fogo
// contra um inimigo de elemento fogo) — não precisa ser listado em
// elements.json, é resolvido aqui antes de consultar a matriz.

function relacaoElemental(elementoAtacante, elementoDefensor, dadosElementos) {
  if (!dadosElementos || !elementoAtacante || !elementoDefensor) return "neutro";
  if (elementoAtacante === "fisico" || elementoDefensor === "fisico") return "neutro";
  if (elementoAtacante === elementoDefensor) return "imune";
  const entrada = dadosElementos.matriz[elementoAtacante];
  if (!entrada) return "neutro";
  if (entrada.forteIntensa && entrada.forteIntensa.includes(elementoDefensor)) return "vantagem_intensa";
  if (entrada.forte && entrada.forte.includes(elementoDefensor)) return "vantagem";
  if (entrada.fracoIntensa && entrada.fracoIntensa.includes(elementoDefensor)) return "resistencia_intensa";
  if (entrada.fraco && entrada.fraco.includes(elementoDefensor)) return "resistencia";
  return "neutro";
}

function multiplicadorElemental(elementoAtacante, elementoDefensor, dadosElementos) {
  const relacao = relacaoElemental(elementoAtacante, elementoDefensor, dadosElementos);
  if (!dadosElementos) return 1;
  return dadosElementos.multiplicadores[relacao] ?? 1;
}

function infoElemento(elementoId, dadosElementos) {
  if (!dadosElementos) return null;
  return dadosElementos.elementos.find((e) => e.id === elementoId) || null;
}

  return { relacaoElemental, multiplicadorElemental, infoElemento };
})();

const MOD_src_systems_EnemyAI_js = (function(){
// Arquétipos de comportamento dos inimigos: decidem alvo e se um inimigo
// covarde deve hesitar em vez de atacar. Puramente sobre o espaço de ação
// que já existe (ataque básico + fuga individual) — não inventa mecânicas
// novas de combate. Nunca lê nada que o jogador ainda não confirmou: só
// enxerga o estado atual do time (hp/defesa/ataque/atb), igual à IA aleatória
// que já existia.
//
// Arquétipos com comportamento próprio: Agressor, Caçador, Atirador,
// Fanático, Comandante, Covarde (mira quem atacar quando decide atacar) e,
// numa segunda leva, Defensor, Controlador, Suporte, Conjurador, Ladrão e
// Invocador — estes seis ganharam habilidades novas de monstro (curar
// aliado, invocar reforço, roubar ouro, aplicar condição de veneno,
// proteger aliado, conjurar magia) implementadas em CombatSystem.js
// (Batalha.acaoEspecialArquetipo e métodos relacionados: curarAliado,
// protegerAliado, envenenar, conjurarAtaque, roubar, invocar). Quando a
// condição da ação especial não se aplica (ex.: Suporte sem ninguém para
// curar), o inimigo cai para um ataque básico mirado pelas regras abaixo.

function escolherAlvoPorArquetipo(timeVivo, arquetipo) {
  if (!timeVivo.length) return null;
  switch (arquetipo) {
    case "agressor":
    case "suporte": // sem cura disponível, foca o mais ferido
      return timeVivo.reduce((pior, atual) => (atual.hp < pior.hp ? atual : pior));
    case "cacador":
    case "conjurador": // magia pune o mais frágil
    case "ladrao": // alvo fácil quando não há mais o que roubar
      return timeVivo.reduce((pior, atual) => (atual.defesa < pior.defesa ? atual : pior));
    case "atirador":
      return timeVivo.reduce((pior, atual) => ((atual.ataque?.dano || 0) > (pior.ataque?.dano || 0) ? atual : pior));
    case "fanatico":
      return timeVivo.reduce((pior, atual) => (atual.hp > pior.hp ? atual : pior));
    case "comandante":
    case "controlador": // controla o ritmo mirando quem está prestes a agir
    case "invocador":
      return timeVivo.reduce((pior, atual) => (atual.atb > pior.atb ? atual : pior));
    case "defensor":
    case "covarde":
    case "aleatorio":
    default:
      return timeVivo[Math.floor(Math.random() * timeVivo.length)];
  }
}

// Um Covarde hesita (não ataca neste turno) quando algum aliado já morreu
// ou o próprio HP está crítico. Não sai da batalha (evitaria mexer no
// tracking de loot/XP no fim da luta) — só perde a vez, o que já transmite
// bem a ideia de "recuar".
function deveHesitar(inimigo, todosInimigos, arquetipo) {
  if (arquetipo !== "covarde") return false;
  const aliadoCaiu = todosInimigos.some((i) => i !== inimigo && !i.vivo);
  const hpCritico = inimigo.hp / inimigo.hpMax < 0.3;
  return aliadoCaiu || hpCritico;
}

// Gera a "intenção" mostrada ao jogador antes do inimigo agir — informação
// suficiente para planejar (alvo, tipo, elemento, perigo aproximado), sem
// necessariamente revelar o dano exato.
function gerarIntencao(inimigo, alvo, arquetipo, dadosBehaviors) {
  const def = (dadosBehaviors && dadosBehaviors[arquetipo]) || dadosBehaviors?.aleatorio;
  const perigo = inimigo.chefe ? "alto" : inimigo.atributos.FOR >= 12 ? "medio" : "baixo";
  return {
    arquetipo,
    arquetipoNome: def?.nome || "Instável",
    alvoNome: alvo ? alvo.nome : null,
    tipo: "ataque",
    elemento: inimigo.elemento || "fisico",
    perigo,
  };
}

  return { escolherAlvoPorArquetipo, deveHesitar, gerarIntencao };
})();

const MOD_src_data_featureFlags_js = (function(){
// Flags para os sistemas novos (aditivos) do jogo. Cada flag pode ser
// desligada individualmente durante testes sem remover nenhum código —
// com a flag desligada, o sistema correspondente se comporta exatamente
// como antes de existir (fallback para o comportamento original).
const FLAGS = {
  elementos: true, // matriz de força/fraqueza elemental no dano de combate
  iaInimigos: true, // arquétipos de comportamento + intenção antes do ataque
  ameacaPreCombate: true, // classificação de ameaça (Trivial..Mortal) antes da batalha
  terreno: true, // bônus de ataque elemental por zona/masmorra + resistência de inimigos nativos (task #42)
};

  return { FLAGS };
})();

const MOD_src_systems_CombatSystem_js = (function(){
  const atributosEfetivos = MOD_src_systems_CharacterFactory_js.atributosEfetivos;
  const defesaTotal = MOD_src_systems_CharacterFactory_js.defesaTotal;
  const velocidadeTotal = MOD_src_systems_CharacterFactory_js.velocidadeTotal;
  const ataqueBase = MOD_src_systems_CharacterFactory_js.ataqueBase;
  const critBonusTotal = MOD_src_systems_CharacterFactory_js.critBonusTotal;
  const relacaoElemental = MOD_src_systems_ElementSystem_js.relacaoElemental;
  const multiplicadorElemental = MOD_src_systems_ElementSystem_js.multiplicadorElemental;
  const escolherAlvoPorArquetipo = MOD_src_systems_EnemyAI_js.escolherAlvoPorArquetipo;
  const deveHesitar = MOD_src_systems_EnemyAI_js.deveHesitar;
  const FLAGS = MOD_src_data_featureFlags_js.FLAGS;
// Sistema de batalha ATB (Active Time Battle) com regras inspiradas em d20.





// Task #43 (formação): só estes arquétipos são "bloqueados" pela frente do
// time — os demais (à distância, mágicos ou furtivos) alcançam a retaguarda
// livremente. Ver escolherAlvoIA().
const ARQUETIPOS_RESPEITAM_FORMACAO = new Set(["agressor", "fanatico", "aleatorio", "covarde"]);

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

// `posicao` ("frente" | "retaguarda", ver FormationSystem.js) vem já
// resolvida de fora — este módulo só guarda e reage a ela, nunca decide
// posição sozinho.
function criarCombatenteJogador(personagem, dados, posicao = "frente") {
  return {
    id: "player",
    nome: personagem.nome,
    isPlayer: true,
    hp: personagem.hp,
    hpMax: personagem.hpMax,
    mp: personagem.mp,
    mpMax: personagem.mpMax,
    atributos: atributosEfetivos(personagem, dados),
    defesa: defesaTotal(personagem, dados),
    velocidade: velocidadeTotal(personagem, dados),
    ataque: ataqueBase(personagem, dados),
    critBonus: critBonusTotal(personagem, dados),
    elemento: (personagem.equipamento.arma && personagem.equipamento.arma.elemento) || "fisico",
    habilidades: personagem.habilidades.map((h) => ({ ...h, cooldownAtual: 0 })),
    tracoId: personagem.tracoId,
    racaId: personagem.racaId,
    classeId: personagem.classeId,
    sorteUsada: false,
    primeiroTurno: true,
    atb: 0,
    atbMax: 100,
    statusEffects: [],
    spriteKey: personagem.spriteKey,
    sopro_usado: false,
    defendendo: false,
    posicao,
    vivo: true,
  };
}

// New Game+ (melhoria de jogabilidade pós-backlog original): cada nível de
// NG+ escala hp/ataque/defesa dos monstros pra cima e a recompensa (xp/ouro)
// junto — reinicia a aventura mais desafiadora, mas justa (quem enfrenta
// monstro mais forte também ganha mais por ele). Velocidade fica de fora de
// propósito: escalar iniciativa também tornaria o ATB do jogador cada vez
// mais irrelevante a cada ciclo, em vez de só "mais duro de matar".
const NG_PLUS_ESCALA_POR_NIVEL = 0.22;

function multiplicadorNgPlus(ngPlus) {
  return 1 + NG_PLUS_ESCALA_POR_NIVEL * Math.max(0, ngPlus || 0);
}

// Modo História (melhoria pós-backlog): opção de dificuldade mais leve,
// escolhida uma vez na criação de personagem (ver CharacterCreationUI.js/
// CharacterFactory.js: personagem.modoHistoria) pra quem quer focar na
// narrativa e exploração sem a pressão do combate padrão. Reduz só hp/
// ataque/defesa dos monstros — de propósito NÃO reduz XP/ouro (ver
// `multRecompensa` abaixo, que ignora modoHistoria), pra não punir
// economicamente quem escolhe jogar assim. É o contrário exato de NG+
// (que fica mais difícil E rende mais); os dois multiplicadores compõem
// entre si caso um save NG+ também tenha modoHistoria ligado.
const MODO_HISTORIA_REDUCAO = 0.3;

function multiplicadorModoHistoria(modoHistoria) {
  return modoHistoria ? 1 - MODO_HISTORIA_REDUCAO : 1;
}

function criarCombatenteInimigo(monstroDef, idx, ngPlus = 0, modoHistoria = false) {
  // `multRecompensa` só reflete NG+ (recompensa nunca cai por causa do Modo
  // História); `multEstat` soma os dois efeitos pra hp/ataque/defesa.
  const multRecompensa = multiplicadorNgPlus(ngPlus);
  const multEstat = multRecompensa * multiplicadorModoHistoria(modoHistoria);
  const hpEscalado = Math.max(1, Math.round(monstroDef.hp * multEstat));
  const atkEscalado = Math.max(1, Math.round(monstroDef.atk * multEstat));
  const defesaEscalada = Math.max(0, Math.round(monstroDef.defesa * multEstat));
  return {
    id: `${monstroDef.id}_${idx}`,
    monstroId: monstroDef.id,
    nome: monstroDef.nome,
    isPlayer: false,
    hp: hpEscalado,
    hpMax: hpEscalado,
    mp: 0,
    mpMax: 0,
    atributos: { FOR: atkEscalado, DES: monstroDef.vel, CON: defesaEscalada * 2, INT: atkEscalado },
    defesa: defesaEscalada,
    velocidade: monstroDef.vel,
    ataque: { dano: atkEscalado, atributo: "FOR", bonusCritico: 0 },
    elemento: monstroDef.elemento || "fisico",
    habilidades: [],
    sorteUsada: false,
    primeiroTurno: true,
    atb: Math.random() * 40,
    atbMax: 100,
    statusEffects: [],
    spriteKey: monstroDef.sprite,
    chefe: !!monstroDef.chefe,
    solo: !!monstroDef.solo, // task #46: monstro reforçado por estar sozinho contra o time
    emboscada: !!monstroDef.emboscada, // melhoria pós-backlog: atacante extra por reputação regional negativa (ver EncounterSystem.js)
    // Barra de quebra (melhoria pós-backlog): só chefes acumulam postura.
    postura: 0,
    posturaMax: monstroDef.chefe ? POSTURA_MAX_CHEFE : 0,
    atordoado: false,
    arquetipo: monstroDef.arquetipo || "aleatorio",
    defendendo: false,
    // Estado das ações especiais dos arquétipos Ladrão/Invocador — cada um só
    // usa sua habilidade única uma vez por batalha, depois volta a atacar.
    jaRoubou: false,
    jaInvocou: false,
    // Definição opcional (src/data/monsters.json: campo "invocacao") do
    // reforço que um Invocador chama à batalha; sem ela, invocar() usa um
    // clone enfraquecido do próprio invocador.
    invocacaoDef: monstroDef.invocacao || null,
    vivo: true,
    // Recompensa também escala com NG+ (só NG+ — ver multRecompensa acima).
    xp: Math.max(1, Math.round(monstroDef.xp * multRecompensa)),
    ouroMin: Math.max(0, Math.round(monstroDef.ouroMin * multRecompensa)),
    ouroMax: Math.max(0, Math.round(monstroDef.ouroMax * multRecompensa)),
  };
}

// Barra de quebra/exposição de chefe (melhoria de jogabilidade pós-backlog
// original): acertar a fraqueza elemental do chefe enche a postura dele mais
// rápido que um golpe neutro; ao encher, o chefe fica ATORDOADO — perde a
// próxima ação e recebe dano bônus enquanto durar. Só chefes (`chefe:true`)
// têm `posturaMax` definido; monstros comuns ficam com posturaMax:0 e nunca
// acumulam nada (ver acumularQuebra). Só o time do jogador enche a barra.
const POSTURA_MAX_CHEFE = 100;
const GANHO_QUEBRA_POR_RELACAO = {
  vantagem_intensa: 30,
  vantagem: 18,
  neutro: 8,
  resistencia: 3,
  resistencia_intensa: 1,
  imune: 0,
};
const BONUS_DANO_ATORDOADO = 1.35;

// Terreno (task #42): elemento dominante do bioma/masmorra deixa esse
// elemento mais forte para QUALQUER atacante (ex.: fogo no deserto), mas dá
// resistência aos inimigos do encontro contra esse mesmo elemento — eles são
// nativos do terreno, então já se adaptaram a ele. As duas coisas juntas se
// cancelam parcialmente quando o jogador ataca um inimigo local com o
// elemento do terreno (ligeira desvantagem, ~0.96x), incentivando variar o
// elemento contra a fauna nativa e recompensando esse elemento em qualquer
// outra situação (chefes de fora do bioma, PvE geral). Aditivo sobre a
// matriz elemental (ElementSystem.js) — nunca a substitui.
const BONUS_ATAQUE_TERRENO = 1.2;
const RESISTENCIA_TERRENO_INIMIGO = 0.8;

// Clima (melhoria de jogabilidade pós-backlog original, ver WeatherSystem.js):
// mesma ideia do terreno acima, mas mais fraca de propósito — o terreno é
// permanente/estrutural do bioma, o clima é passageiro (muda a cada poucos
// minutos reais). Os dois multiplicadores SOMAM quando o elemento do clima
// bate com o do terreno (ex.: chuva — água — no meio de um pântano de água),
// em vez de um substituir o outro.
const BONUS_ATAQUE_CLIMA = 1.1;
const RESISTENCIA_CLIMA_INIMIGO = 0.9;

// Combo elemental entre aliados (melhoria de jogabilidade pós-backlog
// original): quando um aliado acerta um inimigo, e o PRÓXIMO golpe aliado
// que acerta O MESMO inimigo vem de um companheiro DIFERENTE com um
// elemento complementar (ver COMBOS_ELEMENTAIS), esse golpe ganha dano
// bônus e um aviso especial no log — recompensa focar o mesmo alvo com um
// time elementalmente variado, em vez de só "quem bate mais forte".
// Aditivo sobre a matriz de vantagem/resistência elemental
// (ElementSystem.js) — nunca a substitui, e continua valendo mesmo contra
// um alvo elementalmente neutro/resistente ao golpe. Gira em janela livre
// (não expira sozinho por tempo/turnos) — só é "consumido" quando um novo
// golpe aliado no mesmo alvo o encadeia ou quebra o combo (alvo muda, ou o
// MESMO aliado ataca de novo antes de outro companheiro entrar). Isso
// significa que dois aliados alternando golpes complementares no mesmo alvo
// mantêm o bônus continuamente — intencional: recompensa a decisão tática
// de manter o time focando o mesmo inimigo, não é "grátis" o tempo todo.
const BONUS_DANO_COMBO = 1.3;
const COMBOS_ELEMENTAIS = [
  { par: ["fogo", "vento"], nome: "Labareda ao Vento", icone: "🔥🌪️" },
  { par: ["agua", "raio"], nome: "Corrente Elétrica", icone: "💧⚡" },
  { par: ["gelo", "terra"], nome: "Terra Congelada", icone: "❄️⛰️" },
  { par: ["natureza", "veneno"], nome: "Floração Tóxica", icone: "🌿☠️" },
  { par: ["radiante", "arcano"], nome: "Luz Arcana", icone: "✨🔮" },
  { par: ["sombrio", "veneno"], nome: "Corrupção Sombria", icone: "🌑☠️" },
];

function comboDoisElementos(elementoA, elementoB) {
  if (!elementoA || !elementoB || elementoA === elementoB) return null;
  return COMBOS_ELEMENTAIS.find((c) => (c.par[0] === elementoA && c.par[1] === elementoB) || (c.par[0] === elementoB && c.par[1] === elementoA)) || null;
}

class Batalha {
  // `time` é um array de 1 a 4 combatentes do jogador (criados via
  // criarCombatenteJogador), sempre com o personagem principal em time[0].
  // `dadosElementos` é o conteúdo de src/data/elements.json (opcional — sem
  // ele, ou com FLAGS.elementos desligada, o dano continua neutro, igual a
  // antes deste sistema existir).
  // `terrenoElemento` (task #42): id do elemento dominante do terreno atual
  // (ex.: "fogo" no deserto) ou null/undefined fora de zonas com terreno
  // definido — ver terrenoElementoAtual() em main.js.
  // `levasExtras` (task #47, hordas): array de arrays de monstroDef pras
  // ondas 2 em diante — `inimigos` (parâmetro) é sempre só a 1ª onda. Vazio
  // (padrão) = combate comum de 1 onda só, comportamento idêntico a antes
  // desta task existir.
  // `ngPlus` (New Game+, melhoria pós-backlog): nível de New Game+ do
  // personagem — 0 no jogo normal. Só afeta INIMIGOS NOVOS criados durante
  // a própria batalha (leva extra de horda, ver avancarLeva()); os
  // `inimigos` da 1ª onda já chegam prontos (escalados por quem chamou
  // criarCombatenteInimigo antes de montar a Batalha, ver BattleUI.js).
  // `climaElemento` (melhoria pós-backlog, ver WeatherSystem.js): elemento
  // favorecido pelo clima ATUAL da zona (ex.: "agua" durante chuva), ou
  // null fora do mundo aberto / com céu limpo — ver climaAtual() em main.js.
  // `modoHistoria` (melhoria pós-backlog): igual a `ngPlus` acima, só afeta
  // inimigos NOVOS criados durante a própria batalha (leva extra de horda,
  // ver avancarLeva()) — a 1ª onda já chega escalada de quem chamou
  // criarCombatenteInimigo antes de montar a Batalha (ver BattleUI.js).
  constructor(time, inimigos, dadosElementos = null, terrenoElemento = null, levasExtras = [], ngPlus = 0, climaElemento = null, modoHistoria = false) {
    this.time = time;
    this.inimigos = inimigos;
    this.dadosElementos = dadosElementos;
    this.terrenoElemento = terrenoElemento || null;
    this.climaElemento = climaElemento || null;
    this.ngPlus = ngPlus || 0;
    this.modoHistoria = !!modoHistoria;
    this.log = [];
    this.terminada = false;
    this.resultado = null; // 'vitoria' | 'derrota' | 'fuga'
    // Ouro roubado por inimigos Ladrão ao longo da batalha — a UI (BattleUI)
    // deduz esse total do ouro real do personagem ao encerrar o combate,
    // qualquer que seja o resultado (o furto já aconteceu, vitória não
    // devolve o que foi roubado).
    this.ouroRoubado = 0;
    // Hordas (task #47): `this.inimigos` só guarda a onda ATUAL (pra IA,
    // alvo e renderização olharem só quem está na arena agora — ver
    // avancarLeva()); `historicoInimigos` acumula TODOS os inimigos de
    // TODAS as ondas, já derrotados ou não, pra recompensa final (XP/ouro/
    // loot/compêndio em BattleUI.js) somar a horda inteira, não só a última
    // onda.
    this.levasRestantes = [...levasExtras];
    this.historicoInimigos = [...inimigos];
    this.levaAtual = 1;
    this.totalLevas = 1 + levasExtras.length;
    // Combo elemental entre aliados (melhoria pós-backlog, ver
    // COMBOS_ELEMENTAIS acima): guarda o ÚLTIMO golpe aliado que acertou um
    // inimigo, pra saber se o PRÓXIMO golpe aliado forma um combo. Guarda
    // as referências dos objetos combatente em si (não `.id`) porque todo
    // combatente do time do jogador usa o mesmo id fixo "player"
    // (ver criarCombatenteJogador) — comparar por `.id` não distinguiria
    // dois membros diferentes do time.
    this.ultimoAtaqueAliado = null;
  }

  todos() {
    return [...this.time, ...this.inimigos];
  }

  timeVivo() {
    return this.time.filter((c) => c.vivo);
  }

  inimigosVivos() {
    return this.inimigos.filter((i) => i.vivo);
  }

  registrar(msg) {
    this.log.push(msg);
    if (this.log.length > 60) this.log.shift();
  }

  aplicarStatusTick(c) {
    c.statusEffects = c.statusEffects.filter((s) => {
      // Condição aplicada pelo arquétipo Controlador: dano gradual baseado
      // em porcentagem do HP máximo, a cada tick, enquanto durar.
      if (s.tipo === "condicao_veneno" && c.vivo) {
        const dano = Math.max(1, Math.round(c.hpMax * s.valor));
        this.aplicarDano(c, dano);
        this.registrar(`${c.nome} sofre ${dano} de dano por veneno!`);
      }
      s.duracao -= 1;
      return s.duracao > 0 && c.vivo;
    });
  }

  modificadorVelocidade(c) {
    let vel = c.velocidade;
    if (c.isPlayer && c.tracoId === "corajoso" && c.hp / c.hpMax <= 0.3) vel += 3;
    const debuff = c.statusEffects.find((s) => s.tipo === "debuff_velocidade");
    if (debuff) vel *= 1 - debuff.valor;
    return Math.max(1, vel);
  }

  avancarATB(incremento) {
    const prontos = [];
    for (const c of this.todos()) {
      if (!c.vivo) continue;
      c.atb += this.modificadorVelocidade(c) * incremento;
      if (c.atb >= c.atbMax) prontos.push(c);
    }
    prontos.sort((a, b) => b.atb - a.atb);
    return prontos;
  }

  defesaEfetiva(c) {
    let def = c.defesa;
    if (c.primeiroTurno && c.isPlayer && c.tracoId === "cauteloso") def = Math.round(def * 1.2);
    const buff = c.statusEffects.find((s) => s.tipo === "buff_defesa");
    if (buff) def = Math.round(def * (1 + buff.valor));
    const furiaDebuff = c.statusEffects.find((s) => s.tipo === "furia_debuff");
    if (furiaDebuff) def = Math.round(def * (1 - furiaDebuff.valor));
    return def;
  }

  // Enche a postura do chefe alvo quando o JOGADOR o acerta — o ganho
  // depende da relação elemental do golpe (fraqueza enche muito mais rápido
  // que um golpe neutro ou contra resistência). Ao encher, atordoa o chefe:
  // a próxima decidirAcao() dele vira um turno perdido (ver decidirAcao/
  // executarAcao) e ele recebe BONUS_DANO_ATORDOADO enquanto durar (ver
  // rolarAtaque). Não acumula nada enquanto já está atordoado (evita re-
  // disparar o estado antes do turno perdido ser consumido).
  acumularQuebra(atacante, alvo, relacao) {
    if (!atacante || !atacante.isPlayer || !alvo || alvo.isPlayer) return;
    if (!alvo.chefe || !alvo.vivo || alvo.atordoado || !alvo.posturaMax) return;
    const ganho = GANHO_QUEBRA_POR_RELACAO[relacao] ?? GANHO_QUEBRA_POR_RELACAO.neutro;
    if (ganho <= 0) return;
    alvo.postura = Math.min(alvo.posturaMax, alvo.postura + ganho);
    if (alvo.postura >= alvo.posturaMax) {
      alvo.atordoado = true;
      this.registrar(`💥 ${alvo.nome} perde a postura e fica ATORDOADO! Vai perder a próxima ação e sofrer dano extra.`);
    }
  }

  registrarReacaoElemental(relacao) {
    if (relacao === "vantagem_intensa") this.registrar("🔥🔥 Vantagem elemental INTENSA! Dano muito ampliado.");
    else if (relacao === "vantagem") this.registrar("🔥 Vantagem elemental! Dano ampliado.");
    else if (relacao === "resistencia_intensa") this.registrar("🛡️🛡️ Resistência elemental INTENSA. Dano bastante reduzido.");
    else if (relacao === "resistencia") this.registrar("🛡️ Resistência elemental. Dano reduzido.");
    else if (relacao === "imune") this.registrar("🚫 Imunidade elemental! O ataque não causa dano.");
  }

  // Resolução unificada de d20 para qualquer ação de combate (ataque físico,
  // habilidade, magia). O d20 PURO decide crítico (>16) / erro total (<4) /
  // acerto normal (4-16) — atributos e defesa nunca alteram essa faixa, só a
  // quantidade de dano depois. Também resolve o bloqueio de "Defender": se o
  // alvo estiver com `defendendo` ativo, compara o d20 do atacante contra um
  // limiar de defesa (10 + metade da defesa efetiva do alvo); rolagem menor
  // que o limiar = ataque bloqueado. O flag `defendendo` é consumido aqui,
  // então só protege contra a próxima ação recebida.
  resolverAcaoD20(atacante, alvo) {
    let d = d20();
    if (d < 4 && atacante.isPlayer && atacante.tracoId === "sortudo" && !atacante.sorteUsada) {
      atacante.sorteUsada = true;
      d = d20();
      this.registrar(`${atacante.nome} usa a sorte de Halfling e re-rola o dado!`);
    }
    let bloqueado = false;
    if (alvo && alvo.defendendo) {
      const limiar = 10 + Math.floor(this.defesaEfetiva(alvo) / 2);
      if (d < limiar) bloqueado = true;
      alvo.defendendo = false;
    }
    return { d, critico: d > 16, erroTotal: d < 4, bloqueado };
  }

  // `respeitaFormacao` (task #43): ataques físicos "normais" são reduzidos
  // contra um alvo na retaguarda ENQUANTO houver algum aliado dele vivo na
  // frente (a frente "absorve" parte do golpe); ataques que já ignoram
  // defesa (dano_ignora_defesa) ou magia não respeitam formação — a
  // convenção é que só o embate físico direto é bloqueável por
  // posicionamento, igual ao doc de design (terreno/posição > estatística).
  formacaoReducaoDano(alvo) {
    if (!alvo.isPlayer || alvo.posicao !== "retaguarda") return 1;
    const frenteViva = this.time.some((c) => c !== alvo && c.posicao === "frente" && c.vivo);
    return frenteViva ? 0.75 : 1;
  }

  // Terreno (task #42): ver comentário de BONUS_ATAQUE_TERRENO/
  // RESISTENCIA_TERRENO_INIMIGO acima. `elementoAtacante` é o elemento
  // efetivo do golpe (arma/habilidade); `alvo` é o combatente que recebe o
  // dano.
  multiplicadorTerreno(elementoAtacante, alvo) {
    if (!FLAGS.terreno || !this.terrenoElemento || !elementoAtacante) return 1;
    if (elementoAtacante !== this.terrenoElemento) return 1;
    let mult = BONUS_ATAQUE_TERRENO;
    if (!alvo.isPlayer) mult *= RESISTENCIA_TERRENO_INIMIGO;
    return mult;
  }

  // Clima (melhoria pós-backlog, ver WeatherSystem.js/BONUS_ATAQUE_CLIMA
  // acima): mesma lógica do terreno, só que mais fraca e lida de
  // `this.climaElemento` em vez de `this.terrenoElemento` — reaproveita a
  // mesma FLAGS.terreno (mesma categoria de "efeito ambiental elemental",
  // não faz sentido ligar um e desligar o outro separadamente).
  multiplicadorClima(elementoAtacante, alvo) {
    if (!FLAGS.terreno || !this.climaElemento || !elementoAtacante) return 1;
    if (elementoAtacante !== this.climaElemento) return 1;
    let mult = BONUS_ATAQUE_CLIMA;
    if (!alvo.isPlayer) mult *= RESISTENCIA_CLIMA_INIMIGO;
    return mult;
  }

  // Combo elemental entre aliados (ver COMBOS_ELEMENTAIS acima). Só golpes
  // de ALIADO contra INIMIGO participam (nunca golpe de inimigo, nem golpe
  // aliado em outro aliado como cura/buff) — chamado só a partir de um
  // golpe que já ACERTOU (erro total/bloqueio nunca chegam aqui). Sempre
  // atualiza `this.ultimoAtaqueAliado` no final, mesmo sem formar combo,
  // pra esse golpe virar a referência do PRÓXIMO possível combo.
  verificarComboElemental(atacante, alvo, elementoAtacante) {
    if (!FLAGS.elementos || !this.dadosElementos || !atacante.isPlayer || alvo.isPlayer) return { multiplicador: 1, combo: null };
    const anterior = this.ultimoAtaqueAliado;
    let resultado = { multiplicador: 1, combo: null };
    if (anterior && anterior.alvo === alvo && anterior.atacante !== atacante) {
      const combo = comboDoisElementos(anterior.elemento, elementoAtacante);
      if (combo) resultado = { multiplicador: BONUS_DANO_COMBO, combo };
    }
    this.ultimoAtaqueAliado = { atacante, alvo, elemento: elementoAtacante };
    return resultado;
  }

  rolarAtaque(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true } = {}) {
    const { critico: criticoBase, erroTotal, bloqueado } = this.resolverAcaoD20(atacante, alvo);
    let critico = criticoBase;
    const alvoDef = this.defesaEfetiva(alvo);
    // Bônus de crítico da árvore de habilidades: chance extra de crítico
    // (não se aplica a um erro total natural).
    if (!critico && !erroTotal && atacante.critBonus && Math.random() < atacante.critBonus) critico = true;

    if (erroTotal) {
      this.registrar(`${atacante.nome} erra completamente o ataque!`);
      return { acertou: false, critico: false, dano: 0, relacaoElemental: "neutro" };
    }
    if (bloqueado) {
      this.registrar(`${alvo.nome} se defende e bloqueia o ataque de ${atacante.nome}!`);
      return { acertou: false, critico: false, dano: 0, relacaoElemental: "neutro", bloqueado: true };
    }

    const atributo = atributoForcado || atacante.ataque.atributo;
    const baseAtributo = atacante.atributos[atributo] || 0;
    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) {
      base *= 1 + furiaBuff.valor;
      atacante.statusEffects = atacante.statusEffects.filter((s) => s !== furiaBuff);
      this.registrar(`${atacante.nome} canaliza a fúria em seu ataque!`);
    }
    const variancia = 0.85 + Math.random() * 0.3;
    let dano = base * variancia;
    if (critico) dano *= 2;
    if (atacante.racaId === "orc" && atacante.hp / atacante.hpMax <= 0.3) dano *= 1.3;
    const elemResolvido = elementoAtacante || atacante.elemento || "fisico";
    let relacao = "neutro";
    if (FLAGS.elementos && this.dadosElementos) {
      const elemDef = alvo.elemento || "fisico";
      relacao = relacaoElemental(elemResolvido, elemDef, this.dadosElementos);
      dano *= multiplicadorElemental(elemResolvido, elemDef, this.dadosElementos);
    }
    dano *= this.multiplicadorTerreno(elemResolvido, alvo);
    dano *= this.multiplicadorClima(elemResolvido, alvo);
    const combo = this.verificarComboElemental(atacante, alvo, elemResolvido);
    dano *= combo.multiplicador;
    const defReduzida = Math.max(0, alvoDef - ignoraDefesa);
    dano = Math.max(1, Math.round(dano - defReduzida * 0.5));
    if (respeitaFormacao) dano = Math.max(1, Math.round(dano * this.formacaoReducaoDano(alvo)));
    // Chefe atordoado (barra de quebra): dano bônus enquanto durar.
    if (alvo.chefe && alvo.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
    // Imunidade elemental anula o dano por completo — sobrepõe o piso de 1
    // de dano usado no restante do cálculo.
    if (relacao === "imune") dano = 0;

    return { acertou: true, critico, dano, relacaoElemental: relacao, combo: combo.combo };
  }

  aplicarDano(alvo, dano) {
    alvo.hp = Math.max(0, alvo.hp - dano);
    if (alvo.hp <= 0) {
      alvo.vivo = false;
      this.registrar(`${alvo.nome} foi derrotado!`);
    }
  }

  ataqueBasico(atacante, alvo) {
    const r = this.rolarAtaque(atacante, alvo);
    if (r.acertou) {
      this.aplicarDano(alvo, r.dano);
      this.registrar(`${atacante.nome} ataca ${alvo.nome} e causa ${r.dano} de dano${r.critico ? " (CRÍTICO!)" : ""}.`);
      this.registrarReacaoElemental(r.relacaoElemental);
      this.acumularQuebra(atacante, alvo, r.relacaoElemental);
      if (r.combo) this.registrar(`${r.combo.icone} Combo Elemental: ${r.combo.nome}! O golpe em equipe amplia o dano.`);
    }
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return r;
  }

  usarHabilidade(atacante, habilidade, alvoOuAlvos) {
    if (atacante.mp < habilidade.custoMP) {
      this.registrar(`${atacante.nome} não tem mana suficiente para ${habilidade.nome}.`);
      return { ok: false };
    }
    if (habilidade.cooldownAtual > 0) {
      this.registrar(`${habilidade.nome} ainda está recarregando.`);
      return { ok: false };
    }
    atacante.mp -= habilidade.custoMP;
    habilidade.cooldownAtual = habilidade.cooldown + 1;

    const eventos = [];
    switch (habilidade.tipo) {
      case "dano_fisico":
      case "dano_fisico_des": {
        const attr = habilidade.tipo === "dano_fisico_des" ? "DES" : null;
        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, atributoForcado: attr, elementoAtacante: habilidade.elemento });
        if (r.acertou) { this.aplicarDano(alvoOuAlvos, r.dano); this.registrarReacaoElemental(r.relacaoElemental); this.acumularQuebra(atacante, alvoOuAlvos, r.relacaoElemental); }
        this.registrar(`${atacante.nome} usa ${habilidade.nome}${r.acertou ? ` e causa ${r.dano} de dano` : " mas erra"}!`);
        if (r.combo) this.registrar(`${r.combo.icone} Combo Elemental: ${r.combo.nome}! O golpe em equipe amplia o dano.`);
        eventos.push({ tipo: "dano", alvo: alvoOuAlvos.id, valor: r.dano, critico: r.critico });
        break;
      }
      case "dano_ignora_defesa": {
        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, ignoraDefesa: 999, elementoAtacante: habilidade.elemento, respeitaFormacao: false });
        if (r.acertou) { this.aplicarDano(alvoOuAlvos, r.dano); this.registrarReacaoElemental(r.relacaoElemental); this.acumularQuebra(atacante, alvoOuAlvos, r.relacaoElemental); }
        this.registrar(`${atacante.nome} usa ${habilidade.nome}, ignorando parte da defesa!`);
        if (r.combo) this.registrar(`${r.combo.icone} Combo Elemental: ${r.combo.nome}! O golpe em equipe amplia o dano.`);
        eventos.push({ tipo: "dano", alvo: alvoOuAlvos.id, valor: r.dano, critico: r.critico });
        break;
      }
      case "dano_magico": {
        const { critico, erroTotal, bloqueado } = this.resolverAcaoD20(atacante, alvoOuAlvos);
        if (erroTotal) {
          this.registrar(`${atacante.nome} conjura ${habilidade.nome} mas o feitiço falha!`);
        } else if (bloqueado) {
          this.registrar(`${alvoOuAlvos.nome} se defende e bloqueia o feitiço ${habilidade.nome} de ${atacante.nome}!`);
        } else {
          let dano = (atacante.atributos.INT * habilidade.multiplicador) * (0.85 + Math.random() * 0.3);
          if (critico) dano *= 2;
          let relacao = "neutro";
          const elemAtqMagico = habilidade.elemento || atacante.elemento || "fisico";
          if (FLAGS.elementos && this.dadosElementos) {
            const elemDef = alvoOuAlvos.elemento || "fisico";
            relacao = relacaoElemental(elemAtqMagico, elemDef, this.dadosElementos);
            dano *= multiplicadorElemental(elemAtqMagico, elemDef, this.dadosElementos);
          }
          dano *= this.multiplicadorTerreno(elemAtqMagico, alvoOuAlvos);
          dano *= this.multiplicadorClima(elemAtqMagico, alvoOuAlvos);
          const combo = this.verificarComboElemental(atacante, alvoOuAlvos, elemAtqMagico);
          dano *= combo.multiplicador;
          dano = Math.max(1, Math.round(dano - this.defesaEfetiva(alvoOuAlvos) * 0.3));
          if (alvoOuAlvos.chefe && alvoOuAlvos.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
          if (relacao === "imune") dano = 0;
          this.aplicarDano(alvoOuAlvos, dano);
          this.registrar(`${atacante.nome} conjura ${habilidade.nome} e causa ${dano} de dano mágico${critico ? " (CRÍTICO!)" : ""}!`);
          this.registrarReacaoElemental(relacao);
          this.acumularQuebra(atacante, alvoOuAlvos, relacao);
          if (combo.combo) this.registrar(`${combo.combo.icone} Combo Elemental: ${combo.combo.nome}! O golpe em equipe amplia o dano.`);
          eventos.push({ tipo: "dano", alvo: alvoOuAlvos.id, valor: dano, critico });
        }
        break;
      }
      case "cura": {
        const cura = Math.round(atacante.atributos.INT * habilidade.multiplicador * (0.9 + Math.random() * 0.2));
        atacante.hp = Math.min(atacante.hpMax, atacante.hp + cura);
        this.registrar(`${atacante.nome} usa ${habilidade.nome} e recupera ${cura} de HP.`);
        eventos.push({ tipo: "cura", alvo: atacante.id, valor: cura });
        break;
      }
      case "buff_defesa": {
        atacante.statusEffects.push({ tipo: "buff_defesa", duracao: habilidade.duracao + 1, valor: habilidade.valor });
        this.registrar(`${atacante.nome} usa ${habilidade.nome} e fica mais resistente!`);
        break;
      }
      case "buff_ataque": {
        atacante.statusEffects.push({ tipo: "buff_ataque_proximo", duracao: 2, valor: habilidade.valor });
        atacante.statusEffects.push({ tipo: "furia_debuff", duracao: habilidade.duracao + 1, valor: 0.2 });
        this.registrar(`${atacante.nome} entra em fúria!`);
        break;
      }
      case "debuff_velocidade": {
        alvoOuAlvos.statusEffects.push({ tipo: "debuff_velocidade", duracao: habilidade.duracao + 1, valor: habilidade.valor });
        this.registrar(`${atacante.nome} usa ${habilidade.nome} em ${alvoOuAlvos.nome}, reduzindo sua velocidade!`);
        break;
      }
      case "fuga": {
        this.resultado = "fuga";
        this.terminada = true;
        this.registrar(`${atacante.nome} foge com segurança da batalha!`);
        break;
      }
      default:
        break;
    }
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return { ok: true, eventos };
  }

  usarSoproElemental(atacante) {
    if (atacante.sopro_usado || atacante.racaId !== "draconato") return { ok: false };
    atacante.sopro_usado = true;
    let total = 0;
    for (const inimigo of this.inimigosVivos()) {
      let dano = Math.round(atacante.atributos.INT * 1.6 * (0.85 + Math.random() * 0.3));
      dano = Math.max(1, dano - Math.round(this.defesaEfetiva(inimigo) * 0.3));
      if (inimigo.chefe && inimigo.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
      this.aplicarDano(inimigo, dano);
      this.acumularQuebra(atacante, inimigo, "neutro");
      total += dano;
    }
    this.registrar(`${atacante.nome} solta um Sopro Elemental, causando dano em todos os inimigos!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return { ok: true, totalDano: total };
  }

  fugir(iniciador) {
    const chance = 0.5 + iniciador.velocidade * 0.02;
    if (Math.random() < chance) {
      this.resultado = "fuga";
      this.terminada = true;
      this.registrar(`${iniciador.nome} conseguiu fugir com o time!`);
      return true;
    }
    this.registrar(`${iniciador.nome} tentou fugir, mas não conseguiu!`);
    iniciador.atb = 0;
    return false;
  }

  // Escolhe o alvo pelo arquétipo do inimigo (ver EnemyAI.js). Com
  // FLAGS.iaInimigos desligada, ou sem arquétipo definido, cai exatamente
  // no comportamento original: alvo aleatório entre o time vivo.
  //
  // Formação (task #43): arquétipos "de combate corpo a corpo" (ver
  // ARQUETIPOS_RESPEITAM_FORMACAO) só conseguem mirar quem está na frente
  // enquanto houver alguém lá — a retaguarda fica fora de alcance pra eles.
  // Arquétipos à distância/mágicos/furtivos (atirador, caçador, conjurador,
  // controlador, comandante, invocador, ladrão) ignoram formação e miram
  // qualquer um, reforçando a identidade que cada um já tinha.
  escolherAlvoIA(inimigo) {
    let vivos = this.timeVivo();
    if (!vivos.length) return null;
    if (!FLAGS.iaInimigos) return vivos[Math.floor(Math.random() * vivos.length)];
    const arquetipo = inimigo.arquetipo || "aleatorio";
    if (ARQUETIPOS_RESPEITAM_FORMACAO.has(arquetipo)) {
      const frente = vivos.filter((c) => c.posicao === "frente");
      if (frente.length) vivos = frente;
    }
    return escolherAlvoPorArquetipo(vivos, arquetipo);
  }

  // `decidirAcao` e `executarAcao` ficam separados (em vez de um único
  // iaInimigoAgir monolítico) para permitir a prévia de intenção
  // ("telegraph"): a UI pode chamar decidirAcao() pra saber e mostrar o que
  // o inimigo VAI fazer antes de fato executar, sem re-rolar nada — a
  // decisão (incluindo os dados dos arquétipos com chance, como o Ladrão)
  // é tomada uma única vez e só então aplicada com executarAcao().
  iaInimigoAgir(inimigo) {
    const plano = this.decidirAcao(inimigo);
    this.executarAcao(inimigo, plano);
  }

  // Decide o que o inimigo vai fazer neste turno, sem alterar nenhum estado
  // de batalha (sem dano, cura, flags consumidas etc.) — seguro pra ser
  // chamado só pra exibir a intenção ao jogador.
  decidirAcao(inimigo) {
    const vivos = this.timeVivo();
    if (!vivos.length) return { tipo: "nada", alvo: null };
    // Barra de quebra: chefe atordoado perde a ação inteira deste turno —
    // isso tem prioridade sobre hesitar/arquétipo especial/ataque comum.
    if (inimigo.chefe && inimigo.atordoado) {
      return { tipo: "atordoado", alvo: null };
    }
    if (FLAGS.iaInimigos && deveHesitar(inimigo, this.inimigos, inimigo.arquetipo)) {
      return { tipo: "hesitar", alvo: null };
    }
    if (FLAGS.iaInimigos) {
      const especial = this.decidirAcaoEspecialArquetipo(inimigo);
      if (especial) return especial;
    }
    const alvo = this.escolherAlvoIA(inimigo) || vivos[Math.floor(Math.random() * vivos.length)];
    return { tipo: "atacar", alvo };
  }

  // Aplica de fato um plano retornado por decidirAcao(). Cada `case` chama
  // exatamente o método que a versão anterior (monolítica) chamava, então o
  // comportamento de jogo não muda — só a decisão do alvo é separada da
  // execução.
  executarAcao(inimigo, plano) {
    switch (plano.tipo) {
      case "atordoado":
        this.registrar(`💫 ${inimigo.nome} está atordoado e perde o turno!`);
        // Consome o turno perdido e reseta a postura — o chefe volta a
        // acumular quebra do zero na sequência.
        inimigo.atordoado = false;
        inimigo.postura = 0;
        inimigo.primeiroTurno = false;
        inimigo.atb = 0;
        return;
      case "hesitar":
        this.registrar(`${inimigo.nome} hesita e recua, não ataca neste turno!`);
        inimigo.primeiroTurno = false;
        inimigo.atb = 0;
        return;
      case "curar":
        this.curarAliado(inimigo, plano.alvo);
        return;
      case "proteger":
        this.protegerAliado(inimigo, plano.alvo);
        return;
      case "envenenar":
        this.envenenar(inimigo, plano.alvo);
        return;
      case "conjurar":
        this.conjurarAtaque(inimigo, plano.alvo);
        return;
      case "roubar":
        this.roubar(inimigo);
        return;
      case "invocar":
        this.invocar(inimigo);
        return;
      case "nada":
        return;
      case "atacar":
      default: {
        const alvo = plano.alvo || this.timeVivo()[Math.floor(Math.random() * this.timeVivo().length)];
        if (alvo) this.ataqueBasico(inimigo, alvo);
        return;
      }
    }
  }

  // Tenta decidir (sem executar) a ação única do arquétipo do inimigo
  // (curar, proteger, envenenar, conjurar, roubar, invocar). Retorna o plano
  // `{ tipo, alvo }` se a ação especial se aplica, ou `null` para cair no
  // ataque básico normal (ex.: Suporte sem ninguém ferido para curar). Cada
  // arquétipo aqui foi pensado para nunca "travar" o inimigo — sempre existe
  // um caminho de volta ao ataque comum.
  decidirAcaoEspecialArquetipo(inimigo) {
    const aliadosVivos = this.inimigosVivos();
    switch (inimigo.arquetipo) {
      case "suporte": {
        const alvoCura = aliadosVivos
          .filter((a) => a !== inimigo && a.hp / a.hpMax < 0.7)
          .sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
        if (!alvoCura) return null;
        return { tipo: "curar", alvo: alvoCura };
      }
      case "defensor": {
        const alvoProteger = aliadosVivos.filter((a) => a !== inimigo).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] || inimigo;
        const jaProtegido = alvoProteger.statusEffects.some((s) => s.tipo === "buff_defesa");
        if (jaProtegido) return null;
        return { tipo: "proteger", alvo: alvoProteger };
      }
      case "controlador": {
        const vivosTime = this.timeVivo();
        const alvo = escolherAlvoPorArquetipo(vivosTime, "cacador");
        if (!alvo || alvo.statusEffects.some((s) => s.tipo === "condicao_veneno")) return null;
        return { tipo: "envenenar", alvo };
      }
      case "conjurador": {
        const alvo = this.escolherAlvoIA(inimigo);
        if (!alvo) return null;
        return { tipo: "conjurar", alvo };
      }
      case "ladrao": {
        if (inimigo.jaRoubou || Math.random() >= 0.6) return null;
        return { tipo: "roubar", alvo: null };
      }
      case "invocador": {
        if (inimigo.jaInvocou || this.inimigos.length >= 6) return null;
        return { tipo: "invocar", alvo: null };
      }
      default:
        return null;
    }
  }

  // Suporte: cura o aliado mais ferido.
  curarAliado(atacante, alvo) {
    const poder = atacante.atributos.INT || atacante.atributos.FOR || 0;
    const cura = Math.max(1, Math.round(alvo.hpMax * 0.22 + poder * 0.6));
    alvo.hp = Math.min(alvo.hpMax, alvo.hp + cura);
    this.registrar(`${atacante.nome} conjura cura em ${alvo.nome}, recuperando ${cura} de HP!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Defensor: aumenta a defesa do aliado mais vulnerável (ou de si mesmo,
  // se estiver sozinho) reaproveitando o mesmo status "buff_defesa" que já
  // existe para as habilidades do jogador.
  protegerAliado(atacante, alvo) {
    alvo.statusEffects.push({ tipo: "buff_defesa", duracao: 3, valor: 0.5 });
    const quem = alvo === atacante ? "a si mesmo" : alvo.nome;
    this.registrar(`${atacante.nome} protege ${quem}, aumentando a defesa!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Controlador: aplica uma condição de veneno (dano ao longo do tempo,
  // resolvida em aplicarStatusTick) em vez de atacar diretamente.
  envenenar(atacante, alvo) {
    alvo.statusEffects.push({ tipo: "condicao_veneno", duracao: 3, valor: 0.08 });
    this.registrar(`${atacante.nome} aplica uma condição debilitante em ${alvo.nome}: veneno!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Conjurador: ataque mágico que ignora parte da defesa do alvo, sempre
  // usado no lugar do ataque básico (reforça a identidade de "só conjura").
  conjurarAtaque(atacante, alvo) {
    const r = this.rolarAtaque(atacante, alvo, {
      multiplicador: 1.3,
      ignoraDefesa: Math.round(this.defesaEfetiva(alvo) * 0.4),
      elementoAtacante: atacante.elemento,
      respeitaFormacao: false,
    });
    if (r.acertou) {
      this.aplicarDano(alvo, r.dano);
      this.registrar(`${atacante.nome} conjura uma magia em ${alvo.nome}, causando ${r.dano} de dano${r.critico ? " (CRÍTICO!)" : ""}!`);
      this.registrarReacaoElemental(r.relacaoElemental);
    }
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Ladrão: rouba ouro do grupo (creditado ao final da batalha pela UI, ver
  // `ouroRoubado`) uma única vez por combate — depois volta a atacar.
  roubar(atacante) {
    const valor = 5 + Math.floor(Math.random() * 16);
    this.ouroRoubado += valor;
    atacante.jaRoubou = true;
    this.registrar(`${atacante.nome} rouba ${valor} de ouro da bolsa do grupo!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Invocador: chama um reforço para a batalha (usa `invocacaoDef`, vindo
  // do campo opcional "invocacao" em monsters.json, ou um clone enfraquecido
  // de si mesmo como fallback) — uma única vez por combate.
  invocar(atacante) {
    const base = atacante.invocacaoDef || {
      id: `${atacante.monstroId}_convocado`,
      nome: `Invocação de ${atacante.nome}`,
      hp: Math.max(6, Math.round(atacante.hpMax * 0.4)),
      atk: Math.max(2, Math.round((atacante.ataque?.dano || 4) * 0.6)),
      vel: atacante.velocidade,
      defesa: Math.max(0, Math.round(atacante.defesa * 0.6)),
      elemento: atacante.elemento,
      sprite: atacante.spriteKey,
      xp: Math.max(1, Math.round((atacante.xp || 4) * 0.3)),
      ouroMin: 0,
      ouroMax: 1,
    };
    const novo = criarCombatenteInimigo(base, this.inimigos.length);
    novo.atb = 15; // não age no mesmo instante em que é convocado
    this.inimigos.push(novo);
    atacante.jaInvocou = true;
    this.registrar(`${atacante.nome} invoca ${novo.nome} para a batalha!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  tickCooldowns(c) {
    c.habilidades.forEach((h) => {
      if (h.cooldownAtual > 0) h.cooldownAtual -= 1;
    });
  }

  verificarFim() {
    if (this.timeVivo().length === 0) {
      this.terminada = true;
      this.resultado = "derrota";
    } else if (this.inimigosVivos().length === 0) {
      if (this.levasRestantes.length > 0) {
        this.avancarLeva();
      } else {
        this.terminada = true;
        this.resultado = "vitoria";
      }
    }
    return this.terminada;
  }

  // Horda (task #47): a onda atual foi limpa e ainda sobram ondas — troca
  // `this.inimigos` pela próxima onda (mutação in-place via length=0+push,
  // não reatribuição: BattleUI.js guarda a MESMA referência de array numa
  // constante local, então só mutar in-place propaga a nova onda pra
  // renderização/alvo/ATB sem precisar de nenhum código novo lá). O time
  // NÃO recupera HP/MP entre ondas — é o que torna a horda um desafio de
  // resistência, não só "mais um combate".
  avancarLeva() {
    const defsProximaLeva = this.levasRestantes.shift();
    this.levaAtual += 1;
    const novosInimigos = defsProximaLeva.map((m, i) => criarCombatenteInimigo(m, `l${this.levaAtual}_${i}`, this.ngPlus, this.modoHistoria));
    this.inimigos.length = 0;
    this.inimigos.push(...novosInimigos);
    this.historicoInimigos.push(...novosInimigos);
    this.registrar(`🌊 Uma nova leva de inimigos aparece! (Leva ${this.levaAtual}/${this.totalLevas})`);
  }
}

  return { d20, criarCombatenteJogador, NG_PLUS_ESCALA_POR_NIVEL, MODO_HISTORIA_REDUCAO, criarCombatenteInimigo, Batalha };
})();

const MOD_src_systems_AutoPlayState_js = (function(){
// Estado global (singleton) do modo automático — compartilhado entre
// main.js (exploração/mundo) e BattleUI.js (batalha), já que módulos ES
// exportam a MESMA instância do objeto para todo mundo que os importa.
const autoPlayState = {
  ativo: false,
};

  return { autoPlayState };
})();

const MOD_src_systems_CompendiumSystem_js = (function(){
  const relacaoElemental = MOD_src_systems_ElementSystem_js.relacaoElemental;
// Compêndio: bestiário com registro de abates, lista de missões (concluídas
// ou não) e histórico de invocações — task #37 do backlog. Esta camada é
// só de OBSERVAÇÃO/leitura sobre eventos que outros sistemas já disparam:
// - abates: BattleUI.js chama registrarAbateCompendio() logo ao lado da
//   chamada já existente pra QuestSystem.registrarAbate(), no mesmo loop de
//   fim de batalha — não duplica lógica de progresso de missão, só soma um
//   contador próprio por monstro.
// - missões: não tem estado próprio aqui — deriva de personagem.missoesConcluidas
//   (já mantido por QuestSystem.js) cruzado com dados.quests.
// - invocações: não tem estado próprio aqui — deriva de
//   personagem.gacha.historicoInvocacoes, que GachaSystem.js já escreve
//   sozinho a cada invocarPermanente/invocarEvento/invocarIniciante.
// Nada neste arquivo decide se algo aconteceu no jogo; ele só expõe os dados
// de um jeito conveniente pra CompendiumUI.js.



// Fraqueza elemental progressiva (melhoria de jogabilidade pós-backlog
// original): descobrir um monstro (1º abate) já revela nome/nível/bioma/
// elemento PRÓPRIO dele, mas a fraqueza elemental EXATA (o que causar mais
// dano nele) só aparece depois de um número maior de abates — recompensa
// quem realmente "estuda" o monstro em vez de só encontrá-lo uma vez, e dá
// um motivo a mais pra caçar o mesmo tipo repetidas vezes.
const ABATES_PARA_REVELAR_FRAQUEZA = 3;

// Todo elemento cujo ataque causa "vantagem"/"vantagem_intensa" contra
// `elementoDefensor` — ou seja, a fraqueza do defensor do ponto de vista de
// quem ataca. Intensas primeiro (a fraqueza "de verdade"), depois as
// normais. Físico nunca entra (ElementSystem trata físico como sempre
// neutro) e o próprio elemento nunca aparece (seria imunidade, não fraqueza).
function calcularFraquezas(elementoDefensor, dadosElementos) {
  if (!elementoDefensor || !dadosElementos) return [];
  const intensas = [];
  const normais = [];
  (dadosElementos.elementos || []).forEach((el) => {
    if (el.id === "fisico" || el.id === elementoDefensor) return;
    const relacao = relacaoElemental(el.id, elementoDefensor, dadosElementos);
    if (relacao === "vantagem_intensa") intensas.push(el.id);
    else if (relacao === "vantagem") normais.push(el.id);
  });
  return [...intensas, ...normais];
}

function garantirCompendio(personagem) {
  if (!personagem.compendio) personagem.compendio = { abates: {} };
  return personagem.compendio;
}

function registrarAbateCompendio(personagem, monstroId) {
  const c = garantirCompendio(personagem);
  c.abates[monstroId] = (c.abates[monstroId] || 0) + 1;
  return c.abates[monstroId];
}

function totalAbates(personagem, monstroId) {
  const c = garantirCompendio(personagem);
  return c.abates[monstroId] || 0;
}

function jaEncontrado(personagem, monstroId) {
  return totalAbates(personagem, monstroId) > 0;
}

// Junta cada entrada de dados.compendium (lore) com dados.monsters (stats) e
// o progresso do jogador (abates), pronta pra CompendiumUI.js renderizar.
function bestiarioParaCompendio(personagem, dados) {
  const lorePorId = Object.fromEntries((dados.compendium || []).map((e) => [e.id, e]));
  return dados.monsters.map((m) => {
    const lore = lorePorId[m.id];
    const abates = totalAbates(personagem, m.id);
    const descoberto = abates > 0;
    // Fraqueza elemental progressiva: só revelada depois de
    // ABATES_PARA_REVELAR_FRAQUEZA abates, mesmo que o monstro já esteja
    // "descoberto" (que só exige 1). Enquanto não revelada, a UI mostra
    // quantos abates faltam em vez do elemento exato.
    const fraquezaRevelada = abates >= ABATES_PARA_REVELAR_FRAQUEZA;
    return {
      id: m.id,
      // Enquanto não descoberto, nome e stats ficam escondidos também — só o
      // teaser (que já é escrito de forma vaga, sem entregar o nome) aparece.
      // Isso é o que faz o bestiário funcionar como bestiário de verdade.
      nome: descoberto ? m.nome : "???",
      nivel: descoberto ? m.nivel : null,
      bioma: descoberto ? m.bioma : null,
      elemento: descoberto ? m.elemento : null,
      arquetipo: descoberto ? m.arquetipo : null,
      chefe: !!m.chefe,
      abates,
      descoberto,
      fraquezaRevelada: descoberto && fraquezaRevelada,
      fraquezas: descoberto && fraquezaRevelada ? calcularFraquezas(m.elemento, dados.elements) : null,
      abatesFaltandoFraqueza: descoberto && !fraquezaRevelada ? Math.max(0, ABATES_PARA_REVELAR_FRAQUEZA - abates) : null,
      teaser: lore ? lore.teaser : "???",
      lore: descoberto && lore ? lore.lore : null,
    };
  });
}

function progressoBestiario(personagem, dados) {
  const total = dados.monsters.length;
  const descobertos = dados.monsters.filter((m) => totalAbates(personagem, m.id) > 0).length;
  return { descobertos, total, percentual: total ? Math.round((descobertos / total) * 100) : 0 };
}

function missoesParaCompendio(personagem, dados) {
  return dados.quests.map((q) => ({
    ...q,
    concluida: personagem.missoesConcluidas.includes(q.id),
    ativa: personagem.missoesAtivas.some((m) => m.id === q.id),
  }));
}

// Mais recente primeiro — historicoInvocacoes já é gravado em ordem
// cronológica crescente por GachaSystem.js.
function historicoInvocacoes(personagem) {
  const g = personagem.gacha;
  if (!g || !g.historicoInvocacoes) return [];
  return [...g.historicoInvocacoes].reverse();
}

  return { ABATES_PARA_REVELAR_FRAQUEZA, calcularFraquezas, garantirCompendio, registrarAbateCompendio, totalAbates, jaEncontrado, bestiarioParaCompendio, progressoBestiario, missoesParaCompendio, historicoInvocacoes };
})();

const MOD_src_systems_FormationSystem_js = (function(){
// Grade de formação (task #43): posiciona cada membro do time (personagem
// principal + até 3 convocados do gacha, ver GachaSystem.js) em "frente" ou
// "retaguarda". Isso afeta quem os inimigos preferem mirar e quanto dano
// físico um alvo na retaguarda recebe (ver CombatSystem.js). Não é uma
// mecânica de posição livre no espaço — só duas fileiras, 2 vagas cada.
const POSICOES = ["frente", "retaguarda"];
const VAGAS_POR_POSICAO = 2;

// Guarda a formação em personagem.formacao = { [idCombatente]: "frente"|"retaguarda" }.
// idCombatente é "player" pro personagem principal, ou o uid do personagem de
// gacha — os mesmos ids usados pelos combatentes em CombatSystem.js.
function garantirFormacao(personagem) {
  if (!personagem.formacao) personagem.formacao = {};
  return personagem.formacao;
}

// Posição padrão quando o jogador nunca configurou: os 2 primeiros do time
// (na ordem principal -> convocados) vão pra frente, o resto pra retaguarda.
// `idsTime` é a lista ordenada de ids que vão pra batalha (ex.: ["player",
// uid1, uid2, uid3]).
function posicaoDe(personagem, idCombatente, idsTime) {
  const f = garantirFormacao(personagem);
  if (f[idCombatente]) return f[idCombatente];
  const idx = idsTime.indexOf(idCombatente);
  return idx >= 0 && idx < VAGAS_POR_POSICAO ? "frente" : "retaguarda";
}

// Define a posição de um combatente, respeitando o teto de 2 vagas por
// fileira — se a fileira de destino já estiver cheia, troca de lugar com
// quem está lá (nunca deixa mais de 2 na mesma fileira nem perde ninguém).
function definirPosicao(personagem, idCombatente, novaPosicao, idsTime) {
  if (!POSICOES.includes(novaPosicao)) return { ok: false };
  const f = garantirFormacao(personagem);
  // Garante que todo mundo no time já tem uma posição resolvida (default
  // aplicado) antes de mexer, senão a contagem de vagas fica incorreta.
  idsTime.forEach((id) => { f[id] = posicaoDe(personagem, id, idsTime); });

  const posicaoAtual = f[idCombatente];
  if (posicaoAtual === novaPosicao) return { ok: true };

  const ocupantesDestino = idsTime.filter((id) => id !== idCombatente && f[id] === novaPosicao);
  if (ocupantesDestino.length >= VAGAS_POR_POSICAO) {
    // Troca de lugar com o último ocupante da fileira de destino.
    const trocaCom = ocupantesDestino[ocupantesDestino.length - 1];
    f[trocaCom] = posicaoAtual;
  }
  f[idCombatente] = novaPosicao;
  return { ok: true };
}

// Monta a lista de { id, posicao } pra cada membro do time, pronta pra
// CombatSystem.js aplicar em criarCombatenteJogador(). `idsTime` já vem na
// ordem principal -> convocados (ver BattleUI.js).
function formacaoParaBatalha(personagem, idsTime) {
  return idsTime.map((id) => ({ id, posicao: posicaoDe(personagem, id, idsTime) }));
}

  return { POSICOES, VAGAS_POR_POSICAO, garantirFormacao, posicaoDe, definirPosicao, formacaoParaBatalha };
})();

const MOD_src_systems_FormationSynergySystem_js = (function(){
// Combos de formação (melhoria de jogabilidade pós-backlog original):
// quando duas classes específicas ficam na MESMA fileira (frente ou
// retaguarda, ver FormationSystem.js — o modelo atual só tem 2 fileiras de
// até 2 vagas cada, sem posição esquerda/direita), o time ganha um bônus
// tático. Cada fileira só cabe 2 combatentes, então no máximo 1 sinergia
// fica ativa por fileira — o time inteiro pode ter até 2 sinergias
// simultâneas (uma por fileira).
//
// Efêmero por batalha, seguindo o mesmo padrão da camaradagem de facção
// (task #44, ver WorldStateSystem.aplicarCamaradagemNoCombatente): aplicado
// direto no `combatente` já montado em BattleUI.js, nunca no `personagem`
// salvo, porque depende de QUEM está em QUAL fileira agora — pode mudar
// entre batalhas sem o personagem subir de nível.

function bonusPercentualHabilidade(combatente, tipoAlvo, percent) {
  (combatente.habilidades || []).forEach((h) => {
    if (h.tipo !== tipoAlvo) return;
    if (typeof h.multiplicador === "number") h.multiplicador = Math.round(h.multiplicador * (1 + percent) * 100) / 100;
    else if (typeof h.valor === "number") h.valor = Math.round(h.valor * (1 + percent) * 100) / 100;
  });
}

function bonusDefesaPercent(combatente, percent) {
  combatente.defesa = Math.round(combatente.defesa * (1 + percent));
}

function bonusVelPercent(combatente, percent) {
  combatente.velocidade = Math.round(combatente.velocidade * (1 + percent));
}

const SINERGIAS_FORMACAO = [
  {
    id: "escudo_e_fe",
    classes: ["guerreiro", "clerigo"],
    nome: "Escudo e Fé",
    icone: "🛡️✨",
    descricao: "Guerreiro + Clérigo na mesma fileira: +20% de cura pro Clérigo, +8% de defesa pro Guerreiro.",
    aplicar(cGuerreiro, cClerigo) {
      bonusDefesaPercent(cGuerreiro, 0.08);
      bonusPercentualHabilidade(cClerigo, "cura", 0.2);
    },
  },
  {
    id: "emboscada_coordenada",
    classes: ["ladino", "patrulheiro"],
    nome: "Emboscada Coordenada",
    icone: "🗡️🏹",
    descricao: "Ladino + Patrulheiro na mesma fileira: +12% de chance de crítico pros dois.",
    aplicar(cLadino, cPatrulheiro) {
      cLadino.critBonus = (cLadino.critBonus || 0) + 0.12;
      cPatrulheiro.critBonus = (cPatrulheiro.critBonus || 0) + 0.12;
    },
  },
  {
    id: "convergencia_arcana",
    classes: ["mago", "clerigo"],
    nome: "Convergência Arcana",
    icone: "🔮✨",
    descricao: "Mago + Clérigo na mesma fileira: +10% de dano mágico e +10% de cura.",
    aplicar(cMago, cClerigo) {
      bonusPercentualHabilidade(cMago, "dano_magico", 0.1);
      bonusPercentualHabilidade(cClerigo, "cura", 0.1);
    },
  },
  {
    id: "linha_de_frente_brutal",
    classes: ["barbaro", "guerreiro"],
    nome: "Linha de Frente Brutal",
    icone: "🪓⚔️",
    descricao: "Bárbaro + Guerreiro na mesma fileira: +10% de defesa pros dois.",
    aplicar(cBarbaro, cGuerreiro) {
      bonusDefesaPercent(cBarbaro, 0.1);
      bonusDefesaPercent(cGuerreiro, 0.1);
    },
  },
  {
    id: "tiro_encantado",
    classes: ["patrulheiro", "mago"],
    nome: "Tiro Encantado",
    icone: "🏹🔮",
    descricao: "Patrulheiro + Mago na mesma fileira: +8% de dano nas habilidades ofensivas dos dois.",
    aplicar(cPatrulheiro, cMago) {
      bonusPercentualHabilidade(cPatrulheiro, "dano_fisico_des", 0.08);
      bonusPercentualHabilidade(cMago, "dano_magico", 0.08);
    },
  },
  {
    id: "furia_silenciosa",
    classes: ["barbaro", "ladino"],
    nome: "Fúria Silenciosa",
    icone: "🪓🗡️",
    descricao: "Bárbaro + Ladino na mesma fileira: +10% de velocidade pros dois.",
    aplicar(cBarbaro, cLadino) {
      bonusVelPercent(cBarbaro, 0.1);
      bonusVelPercent(cLadino, 0.1);
    },
  },
];

// Acha, pra uma fileira já filtrada (array de itens com .classeId), a
// primeira sinergia cujas duas classes estão ambas presentes — usado tanto
// pela aplicação real quanto pela prévia, pra nunca divergir uma da outra.
function sinergiaDaFileira(membrosClasses) {
  for (const sinergia of SINERGIAS_FORMACAO) {
    const [classeA, classeB] = sinergia.classes;
    const temA = membrosClasses.includes(classeA);
    const temB = membrosClasses.includes(classeB);
    if (temA && temB && classeA !== classeB) return sinergia;
  }
  return null;
}

// Aplica as sinergias ativas num time já montado (array de combatentes com
// .classeId e .posicao definidos, ver CombatSystem.criarCombatenteJogador)
// — chamado uma vez, na montagem da batalha (ver BattleUI.js). Retorna a
// lista de sinergias que entraram em efeito, pra UI mostrar um aviso.
function aplicarSinergiasFormacao(combatentesTime) {
  const ativas = [];
  for (const fileira of ["frente", "retaguarda"]) {
    const membros = combatentesTime.filter((c) => c.isPlayer && c.posicao === fileira);
    if (membros.length < 2) continue;
    const sinergia = sinergiaDaFileira(membros.map((m) => m.classeId));
    if (!sinergia) continue;
    const [classeA, classeB] = sinergia.classes;
    const cA = membros.find((c) => c.classeId === classeA);
    const cB = membros.find((c) => c.classeId === classeB && c !== cA);
    if (cA && cB) {
      sinergia.aplicar(cA, cB);
      ativas.push(sinergia);
    }
  }
  return ativas;
}

// Prévia (sem mutar nada) usada pela UI de formação (GachaUI.js) pra
// mostrar quais sinergias estão ativas com a formação atual, antes mesmo de
// entrar em batalha. Recebe uma lista de { classeId, posicao } (um item por
// membro do time, já com a posição resolvida via FormationSystem.posicaoDe).
function sinergiasAtivasPreview(membrosComClasseEPosicao) {
  const ativas = [];
  for (const fileira of ["frente", "retaguarda"]) {
    const membros = membrosComClasseEPosicao.filter((m) => m.posicao === fileira);
    if (membros.length < 2) continue;
    const sinergia = sinergiaDaFileira(membros.map((m) => m.classeId));
    if (sinergia) ativas.push(sinergia);
  }
  return ativas;
}

  return { SINERGIAS_FORMACAO, aplicarSinergiasFormacao, sinergiasAtivasPreview };
})();

const MOD_src_systems_FactionSynergySystem_js = (function(){
// Sinergia de facção em batalha (melhoria de jogabilidade pós-backlog
// original): quando 3 ou mais membros do time atual vêm da MESMA facção de
// origem (personagem.facaoId, ver gachaRoster.json), o grupo luta com mais
// coordenação — pequeno bônus tático que vale pra TODO o time nesta
// batalha, não só quem é da facção (diferente da camaradagem regional,
// task #44, ver WorldStateSystem.aplicarCamaradagemNoCombatente, que só
// beneficia CADA convocado individualmente e depende da afiliação pessoal
// que o jogador escolheu). Aqui o requisito é só sobre quem está no time
// agora, entre si — não depende de nenhuma escolha de afiliação prévia,
// então dá pra ativar com qualquer facção, inclusive uma que o jogador
// nunca visitou.
//
// O time tem no máximo 4 (personagem principal + até 3 convocados do
// gacha, ver BattleUI.js/FormationSystem.js). O personagem principal nunca
// tem facaoId próprio — só convocados nascem com uma —, então o limiar de
// 3 só é alcançável quando os 3 convocados do time inteiro vêm da mesma
// facção: recompensa deliberada por montar um time temático em vez de só
// pegar os convocados com melhor status individual.
//
// Efêmero por batalha, seguindo o mesmo padrão de
// WorldStateSystem.aplicarCamaradagemNoCombatente/FormationSynergySystem:
// muta direto os `combatente`s já montados (nunca o `personagem` salvo),
// porque depende de QUEM está no time agora, podendo mudar entre batalhas
// sem ninguém subir de nível.

const LIMIAR_SINERGIA_FACCAO = 3;

const BONUS_SINERGIA_FACCAO = { FOR: 1, DES: 1, CON: 0, INT: 1, defesaFlat: 1, critChance: 0.03 };

// Acha a facção com mais membros no time atual, entre quem TEM facaoId
// (convocados do gacha; o personagem principal nunca conta) e quantos são.
// `membros` é um array de objetos com `.facaoId` (personagens de verdade ou
// só a projeção mínima usada pela prévia da UI de formação) — não são
// combatentes montados, que não carregam facaoId (ver criarCombatenteJogador
// em CombatSystem.js).
function facaoDominanteDoTime(membros) {
  const contagem = {};
  for (const m of membros || []) {
    if (!m || !m.facaoId) continue;
    contagem[m.facaoId] = (contagem[m.facaoId] || 0) + 1;
  }
  let melhorId = null;
  let melhorCount = 0;
  for (const [id, count] of Object.entries(contagem)) {
    if (count > melhorCount) {
      melhorId = id;
      melhorCount = count;
    }
  }
  return melhorCount > 0 ? { facaoId: melhorId, count: melhorCount } : null;
}

function infoSinergiaFaccao(dominante, dadosWorldState) {
  if (!dominante) return null;
  const facao = ((dadosWorldState && dadosWorldState.facoes) || []).find((f) => f.id === dominante.facaoId);
  const nomeFaccao = facao ? facao.nome : dominante.facaoId;
  return {
    categoria: "faccao",
    facaoId: dominante.facaoId,
    count: dominante.count,
    icone: (facao && facao.icone) || "🤝",
    nome: `Unidade dos ${nomeFaccao}`,
    descricao: `${dominante.count} membros do time são da facção ${nomeFaccao}: +1 FOR, +1 DES, +1 INT, +1 de defesa e +3% de crítico pro time inteiro nesta batalha.`,
  };
}

// Prévia (sem mutar nada), usada pela UI de formação (GachaUI.js) pra
// mostrar se a sinergia de facção está ativa com o time atual, antes mesmo
// de entrar em batalha — mesmo espírito de sinergiasAtivasPreview em
// FormationSynergySystem.js.
function sinergiaFaccaoPreview(membros, dadosWorldState) {
  const dominante = facaoDominanteDoTime(membros);
  if (!dominante || dominante.count < LIMIAR_SINERGIA_FACCAO) return null;
  return infoSinergiaFaccao(dominante, dadosWorldState);
}

// Aplica o bônus no time inteiro já montado (array de combatentes, ver
// CombatSystem.criarCombatenteJogador) quando 3+ dos `timePersonagens`
// (mesma ordem/tamanho de `combatentesTime`, ver BattleUI.js) compartilham
// a mesma facaoId. Retorna a sinergia ativa (pra UI mostrar o aviso, igual
// às sinergias de formação) ou null se não atingiu o limiar.
function aplicarSinergiaFaccao(combatentesTime, timePersonagens, dadosWorldState) {
  const dominante = facaoDominanteDoTime(timePersonagens);
  if (!dominante || dominante.count < LIMIAR_SINERGIA_FACCAO) return null;
  for (const combatente of combatentesTime || []) {
    if (!combatente.isPlayer) continue;
    combatente.atributos.FOR = (combatente.atributos.FOR || 0) + BONUS_SINERGIA_FACCAO.FOR;
    combatente.atributos.DES = (combatente.atributos.DES || 0) + BONUS_SINERGIA_FACCAO.DES;
    combatente.atributos.CON = (combatente.atributos.CON || 0) + BONUS_SINERGIA_FACCAO.CON;
    combatente.atributos.INT = (combatente.atributos.INT || 0) + BONUS_SINERGIA_FACCAO.INT;
    combatente.defesa += BONUS_SINERGIA_FACCAO.defesaFlat;
    combatente.critBonus = (combatente.critBonus || 0) + BONUS_SINERGIA_FACCAO.critChance;
  }
  return infoSinergiaFaccao(dominante, dadosWorldState);
}

  return { LIMIAR_SINERGIA_FACCAO, facaoDominanteDoTime, sinergiaFaccaoPreview, aplicarSinergiaFaccao };
})();

const MOD_src_systems_RivalrySystem_js = (function(){
// Rivalidade/Amizade entre convocados específicos (melhoria de jogabilidade
// pós-backlog original): pares curados de personagens do gacha com uma
// relação pessoal predefinida (ver gachaRoster.json — identificados pelo
// `rosterId` de cada um, não pelo uid da instância, já que o mesmo par narra
// a mesma história não importa qual cópia específica o jogador tenha) que
// rendem um bônus tático quando os DOIS estão no time ativo ao mesmo tempo.
// Mesmo espírito de FormationSynergySystem.js (par de CLASSES na mesma
// fileira) e FactionSynergySystem.js (3+ da mesma FACÇÃO agregada), mas
// aqui o requisito é sobre QUEM especificamente está no time — dois
// personagens nomeados, em qualquer fileira.
//
// Rivalidade x Amizade têm identidades mecânicas diferentes de propósito:
// rivalidade é uma TROCA (bônus ofensivo/crítico às custas de um pouco de
// defesa — competir um com o outro tira o foco da guarda), enquanto
// amizade é puramente aditiva/de suporte (cobrem um ao outro, sem custo).
// Um convocado pode participar de mais de um par ativo ao mesmo tempo — a
// tabela é pequena o bastante pra não precisar de exclusividade.
//
// Efêmero por batalha, seguindo o mesmo padrão de
// WorldStateSystem.aplicarCamaradagemNoCombatente/FormationSynergySystem/
// FactionSynergySystem: muta direto os `combatente`s já montados em
// BattleUI.js, nunca o `personagem`/instância salva, porque depende de QUEM
// está no time AGORA — pode mudar entre batalhas sem ninguém subir de nível.

const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

const PARES_RELACIONAMENTO = [
  {
    id: "rivalidade_folha_cinzas",
    tipo: "rivalidade",
    rosterIds: ["ashryn_folhaferrea", "zephyrion_furia_draconiana"],
    nome: "Rivalidade: Folha Verde vs. Cinzas",
    icone: "🔥",
    descricao: "Ashryn Folhaférrea e Zephyrion Fúria Draconiana competem pra provar quem é o bárbaro mais implacável: +8% de crítico pros dois, mas -1 de defesa (a competição fala mais alto que a cautela).",
    bonus: { ...BONUS_VAZIO, critChance: 0.08, defesaFlat: -1 },
  },
  {
    id: "rivalidade_forja",
    tipo: "rivalidade",
    rosterIds: ["kaethrys_escamas_de_aco", "grimnir_punho_de_granito"],
    nome: "Rivalidade: Forjados na Disputa",
    icone: "⚒️",
    descricao: "Kaethrys Escamas de Aço e Grimnir Punho de Granito disputam quem golpeia mais forte desde os tempos de forja: +2 de Força pros dois, mas -2 de defesa.",
    bonus: { ...BONUS_VAZIO, FOR: 2, defesaFlat: -2 },
  },
  {
    id: "amizade_raizes",
    tipo: "amizade",
    rosterIds: ["rowan_trilhaverde", "lyanthe_orvalho_sagrado"],
    nome: "Amizade: Raízes da Mesma Floresta",
    icone: "🌿",
    descricao: "Rowan Trilhaverde e Lyanthe Orvalho Sagrado cresceram juntos entre os Guardiões da Folha Verde: +6% de HP máximo e +1 de defesa pros dois.",
    bonus: { ...BONUS_VAZIO, hpMaxPercent: 0.06, defesaFlat: 1 },
  },
  {
    id: "amizade_arquivo",
    tipo: "amizade",
    rosterIds: ["brokk_runamente", "wyn_faisca_curiosa"],
    nome: "Amizade: Arquivo Compartilhado",
    icone: "📚",
    descricao: "Brokk Runamente e Wyn Faísca Curiosa dividem anotações e feitiços há anos na Ordem dos Arquivistas: +8% de MP máximo e +1 de Inteligência pros dois.",
    bonus: { ...BONUS_VAZIO, mpMaxPercent: 0.08, INT: 1 },
  },
];

// Acha, entre `membros` (array de objetos com `.rosterId` — convocados do
// gacha; o personagem principal nunca tem rosterId próprio, então nunca
// entra num par), todos os pares da tabela acima cujos DOIS lados estão
// presentes no time atual.
function paresAtivosNoTime(membros) {
  const idsPresentes = new Set((membros || []).filter((m) => m && m.rosterId).map((m) => m.rosterId));
  return PARES_RELACIONAMENTO.filter((par) => par.rosterIds.every((id) => idsPresentes.has(id)));
}

function aplicarBonusAoCombatente(c, bonus) {
  c.atributos.FOR = (c.atributos.FOR || 0) + bonus.FOR;
  c.atributos.DES = (c.atributos.DES || 0) + bonus.DES;
  c.atributos.CON = (c.atributos.CON || 0) + bonus.CON;
  c.atributos.INT = (c.atributos.INT || 0) + bonus.INT;
  c.defesa = Math.max(0, c.defesa + bonus.defesaFlat);
  c.critBonus = (c.critBonus || 0) + bonus.critChance;
  if (bonus.hpMaxPercent) {
    const novoHpMax = Math.max(1, Math.round(c.hpMax * (1 + bonus.hpMaxPercent)));
    c.hp = Math.round(c.hp * (novoHpMax / c.hpMax));
    c.hpMax = novoHpMax;
  }
  if (bonus.mpMaxPercent && c.mpMax > 0) {
    const novoMpMax = Math.round(c.mpMax * (1 + bonus.mpMaxPercent));
    c.mp = Math.round(c.mp * (novoMpMax / c.mpMax));
    c.mpMax = novoMpMax;
  }
}

// Aplica os pares ativos num time já montado (array de combatentes, ver
// CombatSystem.criarCombatenteJogador) — chamado uma vez, na montagem da
// batalha (ver BattleUI.js), igual a aplicarSinergiasFormacao/
// aplicarSinergiaFaccao. `combatentesTime` e `timePersonagens` andam em
// paralelo (mesma ordem/tamanho — ver BattleUI.js), já que o combatente
// montado não carrega rosterId (só o objeto original tem). Retorna a lista
// de pares que entraram em efeito, pra UI mostrar um aviso.
function aplicarParesRelacionamento(combatentesTime, timePersonagens) {
  const ativos = paresAtivosNoTime(timePersonagens);
  ativos.forEach((par) => {
    par.rosterIds.forEach((rosterId) => {
      const idx = (timePersonagens || []).findIndex((p) => p && p.rosterId === rosterId);
      const combatente = idx >= 0 ? combatentesTime[idx] : null;
      if (combatente) aplicarBonusAoCombatente(combatente, par.bonus);
    });
  });
  return ativos;
}

// Prévia (sem mutar nada), usada pela UI de formação (GachaUI.js) pra
// mostrar quais pares estão ativos com o time atual, antes mesmo de entrar
// em batalha — mesmo espírito de sinergiasAtivasPreview/sinergiaFaccaoPreview.
function paresRelacionamentoPreview(membros) {
  return paresAtivosNoTime(membros);
}

  return { PARES_RELACIONAMENTO, paresAtivosNoTime, aplicarParesRelacionamento, paresRelacionamentoPreview };
})();

const MOD_src_ui_BattleUI_js = (function(){
  const Batalha = MOD_src_systems_CombatSystem_js.Batalha;
  const criarCombatenteJogador = MOD_src_systems_CombatSystem_js.criarCombatenteJogador;
  const criarCombatenteInimigo = MOD_src_systems_CombatSystem_js.criarCombatenteInimigo;
  const removerItem = MOD_src_systems_InventorySystem_js.removerItem;
  const sortearLoot = MOD_src_systems_InventorySystem_js.sortearLoot;
  const ganharXP = MOD_src_systems_CharacterFactory_js.ganharXP;
  const aplicarCrescimento = MOD_src_systems_CharacterFactory_js.aplicarCrescimento;
  const cryptoId = MOD_src_systems_CharacterFactory_js.cryptoId;
  const escolhaPendente = MOD_src_systems_CharacterFactory_js.escolhaPendente;
  const registrarAbate = MOD_src_systems_QuestSystem_js.registrarAbate;
  const adicionarFragmentos = MOD_src_systems_GachaSystem_js.adicionarFragmentos;
  const checarConquistas = MOD_src_systems_GachaSystem_js.checarConquistas;
  const FRAGMENTOS = MOD_src_data_economyConfig_js.FRAGMENTOS;
  const mostrarMensagem = MOD_src_ui_GameUI_js.mostrarMensagem;
  const autoPlayState = MOD_src_systems_AutoPlayState_js.autoPlayState;
  const relacaoElemental = MOD_src_systems_ElementSystem_js.relacaoElemental;
  const infoElemento = MOD_src_systems_ElementSystem_js.infoElemento;
  const alterarReputacao = MOD_src_systems_WorldStateSystem_js.alterarReputacao;
  const aplicarCamaradagemNoCombatente = MOD_src_systems_WorldStateSystem_js.aplicarCamaradagemNoCombatente;
  const facaoDaZona = MOD_src_systems_WorldStateSystem_js.facaoDaZona;
  const registrarDecisao = MOD_src_systems_WorldStateSystem_js.registrarDecisao;
  const registrarAbateCompendio = MOD_src_systems_CompendiumSystem_js.registrarAbateCompendio;
  const formacaoParaBatalha = MOD_src_systems_FormationSystem_js.formacaoParaBatalha;
  const aplicarSinergiasFormacao = MOD_src_systems_FormationSynergySystem_js.aplicarSinergiasFormacao;
  const aplicarSinergiaFaccao = MOD_src_systems_FactionSynergySystem_js.aplicarSinergiaFaccao;
  const aplicarParesRelacionamento = MOD_src_systems_RivalrySystem_js.aplicarParesRelacionamento;
  const registrarProgressoDiario = MOD_src_systems_DailyQuestSystem_js.registrarProgressoDiario;
  const efeitosReduzidos = MOD_src_systems_AccessibilitySystem_js.efeitosReduzidos;
// Tela de batalha ATB: desenha o time (até 3 personagens), inimigos, barras
// de iniciativa, log e ações. Quando mais de um membro do time fica pronto
// ao mesmo tempo, eles entram numa fila e agem um de cada vez.


















const TIPOS_OFENSIVOS = ["dano_fisico", "dano_magico", "dano_fisico_des", "dano_ignora_defesa", "debuff_velocidade"];
const REPUTACAO_POR_CHEFE = 20;

// `personagem` é sempre o personagem principal (dono do inventário/ouro).
// `membrosExtras` é um array com 0 a 3 personagens obtidos via gacha que
// estão no time ativo (objetos vivos, mutáveis — mudanças de HP/XP feitas
// aqui persistem automaticamente porque são as mesmas referências salvas
// em personagem.gacha.personagensObtidos). Time completo = até 4 (task #43).
function iniciarBatalha(screenEl, imagens, dados, personagem, membrosExtras, monstrosDef, terrenoElemento, climaElemento, facaoZona, levasExtras, onFim) {
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
  const batalha = new Batalha(combatentesTime, inimigos, dados.elements, terrenoElemento, levasExtras || [], ngPlus, climaElemento, modoHistoria);
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
    return `${info.icone} <b>${inimigo.nome}</b> ${info.texto}${mostraAlvo ? ` <b>${plano.alvo.nome}</b>` : ""}!`;
  }
  // Efeitos visuais de combate: números de dano/cura flutuantes, flash de
  // acerto e tremor da arena, derivados apenas da diferença de HP entre uma
  // renderização e a próxima — não exigem alterar o fluxo de eventos do
  // CombatSystem.js, então funcionam tanto para ataques do jogador quanto
  // da IA inimiga.
  const hpAnterior = new Map();

  screenEl.classList.remove("hidden");
  screenEl.innerHTML = `
    ${batalha.totalLevas > 1 ? `<div id="batalha-horda-badge" class="horda-badge">🌊 Leva ${batalha.levaAtual}/${batalha.totalLevas}</div>` : ""}
    ${sinergiasAtivas.map((s) => `<div class="sinergia-badge" title="${s.descricao}">${s.icone} ${s.nome}</div>`).join("")}
    <div class="batalha-arena" id="arena"></div>
    <div id="batalha-log"></div>
    <div id="batalha-acoes"></div>
  `;
  const arena = screenEl.querySelector("#arena");
  const logEl = screenEl.querySelector("#batalha-log");
  const acoesEl = screenEl.querySelector("#batalha-acoes");

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

  function renderArena() {
    // Horda (task #47): mantém o contador de leva atualizado a cada
    // renderização, já que avancarLeva() troca a onda por trás sem disparar
    // nenhum evento próprio — é o mesmo re-render que já roda a cada ação.
    const hordaBadge = document.getElementById("batalha-horda-badge");
    if (hordaBadge) hordaBadge.textContent = `🌊 Leva ${batalha.levaAtual}/${batalha.totalLevas}`;
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
    combatentesTime.forEach((c) => {
      const r = cardCombatente(c);
      colTime.appendChild(r.div);
      if (r.deltaHp) comEfeito.push(r);
    });
    inimigos.forEach((i) => {
      const r = cardCombatente(i);
      colInimigos.appendChild(r.div);
      if (r.deltaHp) comEfeito.push(r);
    });
    arena.appendChild(colTime);
    arena.appendChild(colInimigos);
    garantirFxLayer();
    comEfeito.forEach(({ div, deltaHp }) => spawnFloatingText(div, deltaHp));
  }

  function cardCombatente(c) {
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
    div.className = "combatente" + (!c.vivo ? " morto" : "") + (c.atb >= c.atbMax && c.vivo ? " pronto" : "") + (ehAtivo ? " ativo" : "") + (ehTelegrafado ? " telegrafando" : "") + (deltaHp < 0 && !flashDesligado ? " hit-flash" : "") + (c.atordoado ? " atordoado" : "");
    const img = imgFor(c);
    const frame = c.isPlayer ? 0 : (Math.floor(Date.now() / 500) % 2) * 64;
    const iconeTelegrafo = ehTelegrafado ? ` <span class="icone-telegrafo" title="${textoTelegrafo(telegrafo).replace(/<\/?b>/g, "")}">${(TELEGRAFO_INFO[telegrafo.plano.tipo] || TELEGRAFO_INFO.atacar).icone}</span>` : "";
    const badgeFormacao = c.isPlayer ? ` <span class="badge-formacao" title="${c.posicao === "retaguarda" ? "Retaguarda: recebe menos dano físico enquanto a frente estiver de pé" : "Frente: absorve ataques físicos e é o alvo prioritário"}">${c.posicao === "retaguarda" ? "🛡️ Retaguarda" : "⚔️ Frente"}</span>` : "";
    div.innerHTML = `
      <div class="nome-c">${c.nome}${c.chefe ? " 👑" : ""}${c.solo && !c.chefe ? ` <span title="Reforçado por estar sozinho contra o time (task #46)">💪</span>` : ""}${c.emboscada ? ` <span title="Emboscada: moradores hostis por sua reputação ruim com esta região">🗡️ Emboscada</span>` : ""}${ehAtivo ? " ⬅" : ""}${iconeTelegrafo}${badgeElemento(c)}${c.atordoado ? ` <span class="badge-atordoado" title="Atordoado: perde o turno e recebe dano extra">💫 Atordoado</span>` : ""}</div>
      ${badgeFormacao ? `<div class="formacao-linha">${badgeFormacao}</div>` : ""}
      <div class="sprite-wrap"><canvas width="96" height="96" class="sprite-canvas"></canvas></div>
      <div class="barra"><div class="barra-fill hp" style="width:${Math.max(0, (c.hp / c.hpMax) * 100)}%"></div></div>
      <div style="font-size:0.7em">${c.hp}/${c.hpMax} HP</div>
      ${c.chefe && c.posturaMax ? `<div class="barra postura-barra" title="Postura: fraquezas elementais enchem mais rápido. Ao encher, o chefe fica atordoado."><div class="barra-fill postura${c.atordoado ? " cheia" : ""}" style="width:${Math.max(0, (c.postura / c.posturaMax) * 100)}%"></div></div>` : ""}
      ${c.isPlayer ? `<div class="barra"><div class="barra-fill mp" style="width:${Math.max(0, (c.mp / c.mpMax) * 100)}%"></div></div>` : ""}
      <div class="atb-barra"><div class="atb-fill" style="width:${Math.min(100, c.atb)}%"></div></div>
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
    if (deltaHp < 0 && !flashDesligado) sacudirArena();
    return { div, deltaHp };
  }

  // Posiciona o número flutuante usando a posição real do card na tela
  // (getBoundingClientRect), então funciona corretamente mesmo com o
  // layout flex/wrap variando conforme o tamanho do time e dos inimigos.
  function spawnFloatingText(cardDiv, deltaHp) {
    const spriteWrap = cardDiv.querySelector(".sprite-wrap");
    if (!spriteWrap || !fxLayer) return;
    const arenaRect = arena.getBoundingClientRect();
    const wrapRect = spriteWrap.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "dano-flutuante " + (deltaHp < 0 ? "dano" : "cura");
    el.textContent = (deltaHp > 0 ? "+" : "") + deltaHp;
    el.style.left = `${wrapRect.left - arenaRect.left + wrapRect.width / 2}px`;
    el.style.top = `${wrapRect.top - arenaRect.top + wrapRect.height * 0.25}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function sacudirArena() {
    arena.classList.remove("shake");
    // força reflow para reiniciar a animação CSS mesmo se já estava tremendo
    void arena.offsetWidth;
    arena.classList.add("shake");
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

    const btnAtacar = botao("Atacar", () => resolverTurno(() => batalha.ataqueBasico(jogador, alvoSelecionado)));
    acoesEl.appendChild(btnAtacar);

    jogador.habilidades.forEach((h) => {
      const desabilitado = h.cooldownAtual > 0 || jogador.mp < h.custoMP;
      const btn = botao(`${h.nome}${h.custoMP ? ` (${h.custoMP} MP)` : ""}${h.cooldownAtual > 0 ? ` [${h.cooldownAtual}]` : ""}`,
        () => resolverTurno(() => {
          const alvo = h.tipo === "cura" || h.tipo === "buff_defesa" || h.tipo === "buff_ataque" || h.tipo === "fuga" ? jogador : alvoSelecionado;
          batalha.usarHabilidade(jogador, h, alvo);
        }), desabilitado);
      acoesEl.appendChild(btn);
    });

    if (jogador.racaId === "draconato" && !jogador.sopro_usado) {
      acoesEl.appendChild(botao("Sopro Elemental (área)", () => resolverTurno(() => batalha.usarSoproElemental(jogador))));
    }

    if (jogador === combatentesTime[0]) {
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

    acoesEl.appendChild(botao("Fugir (time todo)", () => resolverTurno(() => batalha.fugir(jogador))));

    // Modo automático: agenda a ação do combatente ativo sozinha, uma única
    // vez por combatente (evita agendar de novo a cada re-render do mesmo turno).
    if (autoPlayState.ativo && ultimoAutoAgendado !== atacanteAtivo) {
      ultimoAutoAgendado = atacanteAtivo;
      const alvoDaVez = atacanteAtivo;
      setTimeout(() => {
        if (autoPlayState.ativo && atacanteAtivo === alvoDaVez) agirAutomaticamente();
      }, 450);
    }
  }

  function escolherAlvoAutomatico() {
    const vivos = inimigos.filter((i) => i.vivo);
    if (!vivos.length) return null;
    return vivos.reduce((menor, atual) => (atual.hp < menor.hp ? atual : menor), vivos[0]);
  }

  function agirAutomaticamente() {
    const jogador = atacanteAtivo;
    if (!jogador) return;
    alvoSelecionado = escolherAlvoAutomatico();

    const curaDisponivel = jogador.habilidades.find((h) => h.tipo === "cura" && h.cooldownAtual === 0 && jogador.mp >= h.custoMP);
    if (jogador.hp / jogador.hpMax < 0.35 && curaDisponivel) {
      resolverTurno(() => batalha.usarHabilidade(jogador, curaDisponivel, jogador));
      return;
    }
    const ofensiva = jogador.habilidades.find((h) => TIPOS_OFENSIVOS.includes(h.tipo) && h.cooldownAtual === 0 && jogador.mp >= h.custoMP);
    if (ofensiva && alvoSelecionado && Math.random() < 0.7) {
      resolverTurno(() => batalha.usarHabilidade(jogador, ofensiva, alvoSelecionado));
      return;
    }
    if (alvoSelecionado) {
      resolverTurno(() => batalha.ataqueBasico(jogador, alvoSelecionado));
    } else {
      resolverTurno(() => batalha.fugir(jogador));
    }
  }

  function mostrarSubmenuItens(itens) {
    acoesEl.innerHTML = "";
    itens.forEach((item) => {
      const btn = botao(item.nome, () => resolverTurno(() => aplicarItemEmBatalha(item)));
      acoesEl.appendChild(btn);
    });
    acoesEl.appendChild(botao("Voltar", renderAcoes));
  }

  function aplicarItemEmBatalha(item) {
    const jogador = atacanteAtivo;
    if (item.curaHP) { jogador.hp = Math.min(jogador.hpMax, jogador.hp + item.curaHP); batalha.registrar(`${jogador.nome} usa ${item.nome} e recupera ${item.curaHP} HP.`); }
    if (item.curaMP) { jogador.mp = Math.min(jogador.mpMax, jogador.mp + item.curaMP); batalha.registrar(`${jogador.nome} usa ${item.nome} e recupera ${item.curaMP} MP.`); }
    if (item.removeStatus) { jogador.statusEffects = []; batalha.registrar(`${jogador.nome} usa ${item.nome} e remove efeitos negativos.`); }
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
    b.onclick = onClick;
    return b;
  }

  function resolverTurno(fn) {
    fn();
    batalha.tickCooldowns(atacanteAtivo);
    batalha.aplicarStatusTick(atacanteAtivo);
    filaAcao.shift();
    // Libera o agendamento automático: como há poucos membros no time, o
    // mesmo combatente (mesma referência de objeto) volta a ficar ativo em
    // turnos futuros, e sem isso o agendamento "uma vez por combatente" nunca
    // dispararia de novo para ele.
    ultimoAutoAgendado = null;
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
    const atraso = autoPlayState.ativo ? 450 : 900;
    setTimeout(() => {
      telegrafo = null;
      // O inimigo já deve ter sido removido da fila, mas usa filter por
      // segurança caso a mesma referência apareça mais de uma vez.
      filaInimigos = filaInimigos.filter((c) => c !== inimigo);
      if (batalha.terminada) return;
      if (inimigo.vivo) {
        batalha.executarAcao(inimigo, plano);
        batalha.tickCooldowns(inimigo);
        batalha.aplicarStatusTick(inimigo);
      }
      renderArena();
      renderLog();
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
        registrarAbateCompendio(personagem, i.monstroId);
        registrarProgressoDiario(personagem, "abate", 1);
        if (i.monstroId === "dragao_jovem") derrotouChefeMasmorra = true;
        if (i.chefe) { derrotouAlgumChefe = true; nomesChefesDerrotados.push(i.nome); }
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
        const { subiuNivel } = ganharXP(membro, totalXP);
        subiuNivel.forEach(() => aplicarCrescimento(membro, dados));
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
    }, 900);
  }

  renderArena();
  renderLog();
  renderAcoes();
  loopATB();
}

  return { iniciarBatalha };
})();

const MOD_src_systems_AwakeningSystem_js = (function(){
  const calcularHpMax = MOD_src_systems_CharacterFactory_js.calcularHpMax;
  const calcularMpMax = MOD_src_systems_CharacterFactory_js.calcularMpMax;
// Despertar de Arma Secreta: consequência narrativa E mecânica de investir
// em um personagem do gacha até um nível alto o bastante — cada entrada do
// roster (src/data/gachaRoster.json) tem um campo aditivo "despertar" (nível
// exigido, nome da arma secreta, narrativa, bônus de atributos e bônus na
// habilidade assinatura). Isso NUNCA muda invocação/raridade/duplicatas —
// só dá aos personagens que o jogador realmente desenvolveu uma progressão
// extra e um momento narrativo, reaproveitando o padrão visual já existente
// (ver AwakeningUI.js).


function definicaoDespertar(instancia, roster) {
  const def = roster.find((p) => p.id === instancia.rosterId);
  return (def && def.despertar) || null;
}

function podeDespertar(instancia, roster) {
  if (!instancia || instancia.desperto) return false;
  const def = definicaoDespertar(instancia, roster);
  if (!def) return false;
  return instancia.nivel >= def.nivelRequerido;
}

// Aplica o Despertar de forma permanente: soma o bônus de atributos, ajusta
// HP/MP máximos de acordo (igual a aplicarCrescimento em CharacterFactory.js
// — preserva a proporção de HP/MP atual em vez de curar/esvaziar à toa) e
// reforça a habilidade assinatura (multiplicador ou valor, o que existir).
// Marca `instancia.desperto = true` pra nunca poder repetir.
function despertar(instancia, roster, dados) {
  if (!podeDespertar(instancia, roster)) return { ok: false };
  const def = definicaoDespertar(instancia, roster);

  Object.entries(def.bonusAtributos).forEach(([attr, valor]) => {
    instancia.atributos[attr] = (instancia.atributos[attr] || 0) + valor;
  });

  if (dados) {
    const hpAntigo = instancia.hpMax;
    const mpAntigo = instancia.mpMax;
    instancia.hpMax = calcularHpMax(instancia, dados);
    instancia.mpMax = calcularMpMax(instancia, dados);
    instancia.hp = Math.min(instancia.hpMax, instancia.hp + (instancia.hpMax - hpAntigo));
    instancia.mp = Math.min(instancia.mpMax, instancia.mp + (instancia.mpMax - mpAntigo));
  }

  const habilidade = instancia.habilidades && instancia.habilidades[0];
  if (habilidade) {
    if (typeof habilidade.multiplicador === "number") habilidade.multiplicador += def.bonusHabilidadeMultiplicador;
    else if (typeof habilidade.valor === "number") habilidade.valor += def.bonusHabilidadeMultiplicador;
  }

  instancia.desperto = true;
  return { ok: true, def };
}

  return { definicaoDespertar, podeDespertar, despertar };
})();

const MOD_src_ui_AwakeningUI_js = (function(){
  const podeDespertar = MOD_src_systems_AwakeningSystem_js.podeDespertar;
  const despertar = MOD_src_systems_AwakeningSystem_js.despertar;
  const definicaoDespertar = MOD_src_systems_AwakeningSystem_js.definicaoDespertar;
  const RARITY_COLORS = MOD_src_systems_InventorySystem_js.RARITY_COLORS;
  const RARITY_LABEL = MOD_src_systems_InventorySystem_js.RARITY_LABEL;
// Tela de Despertar de Arma Secreta: mostra o momento narrativo e aplica o
// bônus permanente de um personagem do gacha que já atingiu o nível exigido.
// Reaproveita o padrão visual das outras telas de modal (overlay único,
// cards com borda colorida por raridade — ver GachaUI.js/SkillTreeUI.js).



const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

// Chamado pelas telas de coleção (GachaUI.js) pra indicar, num card, se o
// personagem já pode despertar ou já despertou — usado tanto na renderização
// da coleção quanto em qualquer outro lugar que liste personagens do gacha.
function estadoDespertarResumo(instancia, roster) {
  if (instancia.desperto) return { texto: "✨ Despertado", classe: "despertar-feito" };
  const def = definicaoDespertar(instancia, roster);
  if (!def) return null;
  if (podeDespertar(instancia, roster)) return { texto: "🌟 Despertar disponível!", classe: "despertar-disponivel" };
  return { texto: `🔒 Despertar no Nv. ${def.nivelRequerido}`, classe: "despertar-bloqueado" };
}

// `aoVoltar` é um callback sem argumentos que devolve o jogador pra tela que
// chamou (normalmente a aba Coleção do GachaUI) — mantém a navegação simples
// sem empilhar modais, já que só existe um overlay compartilhado no jogo.
function montarDespertar(personagem, dados, uid, onMudar, aoVoltar) {
  const roster = dados.gachaRoster;
  const g = personagem.gacha;
  const instancia = g.personagensObtidos.find((p) => p.uid === uid);

  overlay().classList.remove("hidden");
  if (!instancia) {
    conteudo().innerHTML = `<button class="fechar">Fechar (Esc)</button><p>Personagem não encontrado.</p>`;
    conteudo().querySelector(".fechar").onclick = fecharModalLocal;
    return;
  }

  const def = definicaoDespertar(instancia, roster);
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <button class="btn-voltar-despertar" style="margin-bottom:8px;">← Voltar à Coleção</button>
    <h2>Despertar de Arma Secreta</h2>
    <div id="despertar-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelector(".btn-voltar-despertar").onclick = () => (aoVoltar ? aoVoltar() : fecharModalLocal());

  const corpo = conteudo().querySelector("#despertar-corpo");

  if (!def) {
    corpo.innerHTML = `<p>${instancia.nome} ainda não possui um Despertar de Arma Secreta definido.</p>`;
    return;
  }

  const badge = `<span class="raridade-badge" style="background:${RARITY_COLORS[instancia.raridade]}">${RARITY_LABEL[instancia.raridade]}</span>`;

  if (instancia.desperto) {
    corpo.innerHTML = `
      <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
        <div class="nome">${instancia.nome} ${badge} — ✨ ${def.nomeArma}</div>
        <div class="desc" style="margin-top:6px;font-style:italic;">${def.narrativa}</div>
        <div class="desc" style="margin-top:10px;color:#4ecb71;">Este personagem já despertou. Os bônus abaixo são permanentes:</div>
        <ul style="margin:6px 0 0 18px;font-size:0.85em;color:#c8b89a;">
          ${Object.entries(def.bonusAtributos).map(([attr, v]) => `<li>+${v} ${attr}</li>`).join("")}
          <li>+${Math.round(def.bonusHabilidadeMultiplicador * 100)}% de força na habilidade "${instancia.habilidades[0]?.nome || ""}"</li>
        </ul>
      </div>
    `;
    return;
  }

  const elegivel = podeDespertar(instancia, roster);
  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
      <div class="nome">${instancia.nome} ${badge} — Nv. ${instancia.nivel}</div>
      <div class="desc" style="margin-top:4px;">Arma Secreta: <strong>${def.nomeArma}</strong> (desperta no Nv. ${def.nivelRequerido})</div>
      ${elegivel
        ? `<div class="desc" style="margin-top:8px;font-style:italic;">${def.narrativa}</div>`
        : `<div class="desc" style="margin-top:8px;opacity:0.7;">Continue desenvolvendo ${instancia.nome} em batalha. Faltam ${Math.max(0, def.nivelRequerido - instancia.nivel)} nível(is) para o Despertar.</div>`}
      <div class="desc" style="margin-top:10px;">Ao despertar, ${instancia.nome} ganha permanentemente:</div>
      <ul style="margin:6px 0 0 18px;font-size:0.85em;color:#c8b89a;">
        ${Object.entries(def.bonusAtributos).map(([attr, v]) => `<li>+${v} ${attr}</li>`).join("")}
        <li>+${Math.round(def.bonusHabilidadeMultiplicador * 100)}% de força na habilidade "${instancia.habilidades[0]?.nome || ""}"</li>
      </ul>
      <button class="btn-despertar" style="margin-top:12px;" ${elegivel ? "" : "disabled"}>${elegivel ? "✨ Despertar Arma Secreta" : "Ainda não disponível"}</button>
    </div>
  `;

  const btn = corpo.querySelector(".btn-despertar");
  if (elegivel) {
    btn.onclick = () => {
      const r = despertar(instancia, roster, dados);
      if (r.ok) {
        onMudar();
        montarDespertar(personagem, dados, uid, onMudar, aoVoltar);
      }
    };
  }
}

  return { estadoDespertarResumo, montarDespertar };
})();

const MOD_src_ui_BondUI_js = (function(){
  const LIMIARES_VINCULO = MOD_src_systems_BondSystem_js.LIMIARES_VINCULO;
  const garantirVinculo = MOD_src_systems_BondSystem_js.garantirVinculo;
  const cenaVinculo = MOD_src_systems_BondSystem_js.cenaVinculo;
  const escolherTomVinculo = MOD_src_systems_BondSystem_js.escolherTomVinculo;
  const resumoVinculoParaCard = MOD_src_systems_BondSystem_js.resumoVinculoParaCard;
  const calcularHpMax = MOD_src_systems_CharacterFactory_js.calcularHpMax;
  const calcularMpMax = MOD_src_systems_CharacterFactory_js.calcularMpMax;
  const RARITY_COLORS = MOD_src_systems_InventorySystem_js.RARITY_COLORS;
  const RARITY_LABEL = MOD_src_systems_InventorySystem_js.RARITY_LABEL;
  const registrarDecisao = MOD_src_systems_WorldStateSystem_js.registrarDecisao;
// Tela de Vínculo de Campanheirismo: mostra a cena narrativa disponível de
// um convocado do gacha (ou o histórico de escolhas já feitas) e aplica a
// escolha de tom. Reaproveita o padrão visual das outras telas de modal —
// mesmo espírito de AwakeningUI.js (Despertar de Arma Secreta).





const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}


// `aoVoltar` funciona igual ao de montarDespertar: devolve o jogador pra
// tela que chamou (normalmente a aba Coleção do GachaUI), sem empilhar
// modais.
function montarVinculo(personagem, dados, uid, onMudar, aoVoltar) {
  const g = personagem.gacha;
  const instancia = g.personagensObtidos.find((p) => p.uid === uid);

  overlay().classList.remove("hidden");
  if (!instancia) {
    conteudo().innerHTML = `<button class="fechar">Fechar (Esc)</button><p>Personagem não encontrado.</p>`;
    conteudo().querySelector(".fechar").onclick = fecharModalLocal;
    return;
  }

  const vinculo = garantirVinculo(instancia);
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <button class="btn-voltar-vinculo" style="margin-bottom:8px;">← Voltar à Coleção</button>
    <h2>Vínculo de Campanheirismo</h2>
    <div id="vinculo-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelector(".btn-voltar-vinculo").onclick = () => (aoVoltar ? aoVoltar() : fecharModalLocal());

  const corpo = conteudo().querySelector("#vinculo-corpo");
  const badge = `<span class="raridade-badge" style="background:${RARITY_COLORS[instancia.raridade]}">${RARITY_LABEL[instancia.raridade]}</span>`;

  const cena = cenaVinculo(instancia, personagem);
  const progresso = `${Math.min(vinculo.tier, LIMIARES_VINCULO.length)}/${LIMIARES_VINCULO.length} cenas vistas`;

  if (!cena) {
    // Sem cena disponível agora: mostra progresso + histórico de escolhas
    // já feitas (puro flavor — os dois tons davam o mesmo bônus mecânico).
    const faltamTudo = vinculo.tier >= LIMIARES_VINCULO.length;
    const proximoNivel = !faltamTudo ? LIMIARES_VINCULO[vinculo.tier] : null;
    corpo.innerHTML = `
      <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
        <div class="nome">${instancia.nome} ${badge} — Nv. ${instancia.nivel}</div>
        <div class="desc" style="margin-top:6px;">${progresso}</div>
        ${faltamTudo
          ? `<div class="desc" style="margin-top:8px;color:#4ecb71;">Vínculo completo — vocês já dividiram tudo que havia pra dividir por enquanto.</div>`
          : `<div class="desc" style="margin-top:8px;opacity:0.7;">Continue levando ${instancia.nome} em batalha. A próxima cena libera no Nv. ${proximoNivel} (faltam ${Math.max(0, proximoNivel - instancia.nivel)} nível(is)).</div>`}
        ${vinculo.escolhas.length ? `
          <div class="desc" style="margin-top:10px;">Momentos já vividos:</div>
          <ul style="margin:6px 0 0 18px;font-size:0.85em;color:#c8b89a;">
            ${vinculo.escolhas.map((e) => `<li>Cena ${e.tier + 1}: tom ${e.tom === "caloroso" ? "caloroso 💛" : "reservado 🩶"}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
    `;
    return;
  }

  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
      <div class="nome">${instancia.nome} ${badge} — Nv. ${instancia.nivel}</div>
      <div class="desc" style="margin-top:4px;">${progresso}</div>
      <div class="desc" style="margin-top:10px;font-weight:bold;">${cena.titulo}</div>
      <div class="desc" style="margin-top:6px;font-style:italic;">${cena.texto}</div>
      <div id="vinculo-escolhas" style="display:flex;flex-direction:column;gap:6px;margin-top:12px;width:100%;"></div>
    </div>
  `;
  const escolhasEl = corpo.querySelector("#vinculo-escolhas");
  cena.escolhas.forEach((e) => {
    const btn = document.createElement("button");
    btn.textContent = e.rotulo;
    btn.onclick = () => {
      const r = escolherTomVinculo(instancia, e.id);
      if (!r.ok) return;
      registrarDecisao(personagem, { icone: "💛", titulo: `Vínculo com ${instancia.nome}`, texto: `${cena.titulo}: ${e.resposta}` });
      // Recalcula hp/mpMax se o tier concluído trouxe hpMaxPercent/
      // mpMaxPercent (só o 3º tier tem, ver BONUS_POR_TIER em
      // BondSystem.js) — mesmo padrão de aplicarEscolhaArvore/despertar,
      // que fazem esse recálculo explícito depois de mudar o bônus
      // permanente, já que hp/mpMax não são recalculados sozinhos.
      if (r.bonus.hpMaxPercent || r.bonus.mpMaxPercent) {
        const hpAntigo = instancia.hpMax;
        const mpAntigo = instancia.mpMax;
        instancia.hpMax = calcularHpMax(instancia, dados);
        instancia.mpMax = calcularMpMax(instancia, dados);
        instancia.hp = Math.min(instancia.hpMax, instancia.hp + (instancia.hpMax - hpAntigo));
        instancia.mp = Math.min(instancia.mpMax, instancia.mp + (instancia.mpMax - mpAntigo));
      }
      corpo.innerHTML = `
        <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
          <div class="nome">${instancia.nome} ${badge}</div>
          <div class="desc" style="margin-top:8px;font-style:italic;">${e.resposta}</div>
          <button class="btn-continuar-vinculo" style="margin-top:12px;">Continuar</button>
        </div>
      `;
      corpo.querySelector(".btn-continuar-vinculo").onclick = () => {
        onMudar();
        montarVinculo(personagem, dados, uid, onMudar, aoVoltar);
      };
    };
    escolhasEl.appendChild(btn);
  });
}

  return { montarVinculo, resumoVinculoParaCard };
})();

const MOD_src_systems_TeamProfileSystem_js = (function(){
  const definirTimeAtivo = MOD_src_systems_GachaSystem_js.definirTimeAtivo;
  const garantirFormacao = MOD_src_systems_FormationSystem_js.garantirFormacao;
  const posicaoDe = MOD_src_systems_FormationSystem_js.posicaoDe;
// Perfis de time salvos (melhoria de jogabilidade pós-backlog original):
// até MAX_PERFIS_DE_TIME configurações nomeadas de time + formação, pra
// trocar rápido entre builds sem remontar tudo manualmente toda vez (ver
// GachaUI.js, aba Time). Guarda em personagem.perfisDeTime — um array de
// slots fixos (índice = número do slot), cada um `null` (vazio) ou
// `{ nome, timeAtivo, formacao }` — persiste no save automaticamente junto
// do resto do personagem, igual a todo outro estado ad-hoc deste projeto
// (nenhum campo novo no contrato de save.js).
//
// Reaproveita definirTimeAtivo (GachaSystem.js) pra CARREGAR um time — ela
// já filtra uids que não existem mais em personagensObtidos e respeita o
// teto de MAX_CONVOCADOS_GACHA, então um perfil salvo nunca consegue
// restaurar um time inválido, mesmo que o roster do jogador tenha mudado
// entre salvar e carregar o perfil.



const MAX_PERFIS_DE_TIME = 3;

function garantirPerfisDeTime(personagem) {
  if (!Array.isArray(personagem.perfisDeTime)) personagem.perfisDeTime = [];
  return personagem.perfisDeTime;
}

function slotValido(slot) {
  return Number.isInteger(slot) && slot >= 0 && slot < MAX_PERFIS_DE_TIME;
}

// Captura o time ativo ATUAL (personagem.gacha.timeAtivo) e a formação de
// cada membro dele (personagem.formacao) num slot — sobrescreve o que
// estava salvo ali antes, se houver.
function salvarPerfilDeTime(personagem, slot, nome) {
  if (!slotValido(slot)) return { ok: false };
  const perfis = garantirPerfisDeTime(personagem);
  const timeAtivo = [...((personagem.gacha && personagem.gacha.timeAtivo) || [])];
  const idsTime = ["player", ...timeAtivo];
  const formacaoDoTime = {};
  idsTime.forEach((id) => { formacaoDoTime[id] = posicaoDe(personagem, id, idsTime); });
  const nomeFinal = (nome && nome.trim()) ? nome.trim().slice(0, 30) : `Perfil ${slot + 1}`;
  perfis[slot] = { nome: nomeFinal, timeAtivo, formacao: formacaoDoTime };
  return { ok: true, perfil: perfis[slot] };
}

// Restaura o time ativo e a formação salvos num slot. Nunca falha por causa
// de um uid que não existe mais (definirTimeAtivo já filtra); só falha se o
// slot for inválido ou estiver vazio.
function carregarPerfilDeTime(personagem, slot) {
  if (!slotValido(slot)) return { ok: false };
  const perfis = garantirPerfisDeTime(personagem);
  const perfil = perfis[slot];
  if (!perfil) return { ok: false };
  definirTimeAtivo(personagem, perfil.timeAtivo || []);
  const formacaoAtual = garantirFormacao(personagem);
  const idsRestaurados = ["player", ...(personagem.gacha.timeAtivo || [])];
  idsRestaurados.forEach((id) => {
    if (perfil.formacao && perfil.formacao[id]) formacaoAtual[id] = perfil.formacao[id];
  });
  return { ok: true, perfil };
}

function apagarPerfilDeTime(personagem, slot) {
  if (!slotValido(slot)) return { ok: false };
  const perfis = garantirPerfisDeTime(personagem);
  if (!perfis[slot]) return { ok: false };
  perfis[slot] = null;
  return { ok: true };
}

// Sempre retorna um array de tamanho fixo MAX_PERFIS_DE_TIME (com `null`
// nos slots vazios), pronto pra UI iterar sem se preocupar com buracos.
function perfisParaExibir(personagem) {
  const perfis = garantirPerfisDeTime(personagem);
  return Array.from({ length: MAX_PERFIS_DE_TIME }, (_, i) => perfis[i] || null);
}

  return { MAX_PERFIS_DE_TIME, garantirPerfisDeTime, salvarPerfilDeTime, carregarPerfilDeTime, apagarPerfilDeTime, perfisParaExibir };
})();

const MOD_src_ui_GachaUI_js = (function(){
  const invocarPermanente = MOD_src_systems_GachaSystem_js.invocarPermanente;
  const invocarEvento = MOD_src_systems_GachaSystem_js.invocarEvento;
  const invocarIniciante = MOD_src_systems_GachaSystem_js.invocarIniciante;
  const definirTimeAtivo = MOD_src_systems_GachaSystem_js.definirTimeAtivo;
  const resgatarDesafioDiario = MOD_src_systems_GachaSystem_js.resgatarDesafioDiario;
  const resgatarMissaoSemanal = MOD_src_systems_GachaSystem_js.resgatarMissaoSemanal;
  const podeResgatarMissaoSemanal = MOD_src_systems_GachaSystem_js.podeResgatarMissaoSemanal;
  const atualizarDesafioDiario = MOD_src_systems_GachaSystem_js.atualizarDesafioDiario;
  const checarConquistas = MOD_src_systems_GachaSystem_js.checarConquistas;
  const MAX_CONVOCADOS_GACHA = MOD_src_systems_GachaSystem_js.MAX_CONVOCADOS_GACHA;
  const CUSTO_INVOCACAO = MOD_src_data_economyConfig_js.CUSTO_INVOCACAO;
  const CUSTO_PACOTE_10 = MOD_src_data_economyConfig_js.CUSTO_PACOTE_10;
  const EVENTO_FEATURED_ID = MOD_src_data_economyConfig_js.EVENTO_FEATURED_ID;
  const BANNER_INICIANTE = MOD_src_data_economyConfig_js.BANNER_INICIANTE;
  const RARITY_COLORS = MOD_src_systems_InventorySystem_js.RARITY_COLORS;
  const RARITY_LABEL = MOD_src_systems_InventorySystem_js.RARITY_LABEL;
  const estadoDespertarResumo = MOD_src_ui_AwakeningUI_js.estadoDespertarResumo;
  const montarDespertar = MOD_src_ui_AwakeningUI_js.montarDespertar;
  const resumoVinculoParaCard = MOD_src_ui_BondUI_js.resumoVinculoParaCard;
  const montarVinculo = MOD_src_ui_BondUI_js.montarVinculo;
  const posicaoDe = MOD_src_systems_FormationSystem_js.posicaoDe;
  const definirPosicao = MOD_src_systems_FormationSystem_js.definirPosicao;
  const sinergiasAtivasPreview = MOD_src_systems_FormationSynergySystem_js.sinergiasAtivasPreview;
  const sinergiaFaccaoPreview = MOD_src_systems_FactionSynergySystem_js.sinergiaFaccaoPreview;
  const paresRelacionamentoPreview = MOD_src_systems_RivalrySystem_js.paresRelacionamentoPreview;
  const infoAfinidade = MOD_src_systems_AffinitySystem_js.infoAfinidade;
  const facaoAfiliada = MOD_src_systems_WorldStateSystem_js.facaoAfiliada;
  const facaoInfo = MOD_src_systems_WorldStateSystem_js.facaoInfo;
  const perfisParaExibir = MOD_src_systems_TeamProfileSystem_js.perfisParaExibir;
  const salvarPerfilDeTime = MOD_src_systems_TeamProfileSystem_js.salvarPerfilDeTime;
  const carregarPerfilDeTime = MOD_src_systems_TeamProfileSystem_js.carregarPerfilDeTime;
  const apagarPerfilDeTime = MOD_src_systems_TeamProfileSystem_js.apagarPerfilDeTime;
// Tela de invocação (gacha): puxar personagens, ver coleção e montar o time.













const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

function badge(raridade) {
  return `<span class="raridade-badge" style="background:${RARITY_COLORS[raridade]}">${RARITY_LABEL[raridade]}</span>`;
}

function montarGacha(personagem, dados, onMudar, abaInicial = "invocar") {
  const roster = dados.gachaRoster;
  atualizarDesafioDiario(personagem);
  const g = personagem.gacha;

  overlay().classList.remove("hidden");
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Invocação — Fragmentos de Aethra: <span id="gacha-saldo">${g.fragmentos}</span></h2>
    <div id="gacha-tabs" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <button data-tab="invocar">Invocar</button>
      <button data-tab="colecao">Coleção (${g.personagensObtidos.length})</button>
      <button data-tab="time">Time</button>
      <button data-tab="recompensas">Recompensas</button>
    </div>
    <div id="gacha-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModal;
  conteudo().querySelectorAll("#gacha-tabs button").forEach((b) => {
    b.onclick = () => montarGacha(personagem, dados, onMudar, b.dataset.tab);
  });

  const corpo = conteudo().querySelector("#gacha-corpo");
  if (abaInicial === "colecao") renderColecao(corpo, personagem, onMudar, dados);
  else if (abaInicial === "time") renderTime(corpo, personagem, dados, onMudar);
  else if (abaInicial === "recompensas") renderRecompensas(corpo, personagem, dados, onMudar);
  else renderInvocar(corpo, personagem, roster, dados, onMudar);
}

function atualizarSaldo(personagem) {
  const el = document.getElementById("gacha-saldo");
  if (el) el.textContent = personagem.gacha.fragmentos;
}

function renderInvocar(corpo, personagem, roster, dados, onMudar) {
  const g = personagem.gacha;
  const featured = roster.find((p) => p.id === EVENTO_FEATURED_ID);

  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Banner Permanente</div>
      <div class="desc">Todos os personagens do roster. Pity: garante Lendário em até 50 invocações (fica mais provável a partir da 40ª).</div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button class="btn-puxar" data-banner="permanente" data-qtd="1">Invocar (${CUSTO_INVOCACAO})</button>
        <button class="btn-puxar" data-banner="permanente" data-qtd="10">Invocar x10 (${CUSTO_PACOTE_10})</button>
      </div>
    </div>
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Banner de Evento — em destaque: ${featured ? featured.nome : "?"} ${featured ? badge(featured.raridade) : ""}</div>
      <div class="desc">Ao sair um Lendário deste banner, 50% de chance de ser o personagem em destaque. Se perder o 50/50, o próximo Lendário deste banner é garantido ser ele.</div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button class="btn-puxar" data-banner="evento" data-qtd="1">Invocar (${CUSTO_INVOCACAO})</button>
        <button class="btn-puxar" data-banner="evento" data-qtd="10">Invocar x10 (${CUSTO_PACOTE_10})</button>
      </div>
    </div>
    ${!g.beginner.concluido ? `
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Banner Iniciante — ${g.beginner.pullsUsados}/${BANNER_INICIANTE.TETO_TOTAL} usadas${g.beginner.gratisRestantes > 0 ? ` (${g.beginner.gratisRestantes} grátis!)` : ""}</div>
      <div class="desc">Só para quem está começando: Raro+ garantido até a 10ª, Épico+ até a 20ª, Lendário garantido até a 40ª. Desaparece para sempre depois disso.</div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button class="btn-puxar" data-banner="iniciante" data-qtd="1">${g.beginner.gratisRestantes > 0 ? "Invocar (grátis)" : `Invocar (${CUSTO_INVOCACAO})`}</button>
      </div>
    </div>` : ""}
    <div id="gacha-resultado"></div>
  `;

  corpo.querySelectorAll(".btn-puxar").forEach((b) => {
    b.onclick = () => {
      const banner = b.dataset.banner;
      const qtd = Number(b.dataset.qtd);
      const resultados = [];
      for (let i = 0; i < qtd; i++) {
        let r;
        if (banner === "permanente") r = invocarPermanente(personagem, roster, dados);
        else if (banner === "evento") r = invocarEvento(personagem, roster, dados);
        else r = invocarIniciante(personagem, roster, dados);
        if (!r.ok) { resultados.push(r); break; }
        resultados.push(r);
      }
      checarConquistas(personagem, {});
      atualizarSaldo(personagem);
      onMudar();
      renderInvocar(corpo, personagem, roster, dados, onMudar);
      mostrarResultado(corpo, resultados, dados);
    };
  });
}

function mostrarResultado(corpo, resultados, dados) {
  const div = document.getElementById("gacha-resultado");
  if (!div) return;
  const falhas = resultados.filter((r) => !r.ok);
  const sucessos = resultados.filter((r) => r.ok);
  div.innerHTML = `
    <h3>Resultado</h3>
    ${falhas.length ? `<p style="color:#e0574a;">${falhas[0].motivo === "sem_fragmentos" ? "Fragmentos de Aethra insuficientes." : "Este banner já se esgotou para você."}</p>` : ""}
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${sucessos.map((r) => {
        const classeInfo = (dados && dados.classes || []).find((c) => c.id === r.def.classeId);
        return `
        <div class="card" style="flex-direction:column;width:130px;align-items:center;border-color:${RARITY_COLORS[r.raridade]}">
          <div class="nome" style="text-align:center;">${r.def.nome}${r.featured ? " ⭐" : ""}</div>
          ${badge(r.raridade)}
          ${classeInfo ? `<div class="desc classe-evidente" style="text-align:center;">${classeInfo.icone} ${classeInfo.nome}</div>` : ""}
          ${r.duplicata ? `<div class="desc" style="text-align:center;">Duplicata → +${r.xpConvertido} XP para ${r.def.nome}${r.subiuNivelDuplicata && r.subiuNivelDuplicata.length ? ` (subiu para Nv. ${r.subiuNivelDuplicata[r.subiuNivelDuplicata.length - 1]}!)` : ""}</div>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
}

function renderColecao(corpo, personagem, onMudar, dados) {
  const g = personagem.gacha;
  if (!g.personagensObtidos.length) {
    corpo.innerHTML = "<p>Você ainda não invocou nenhum personagem. Vá para a aba Invocar!</p>";
    return;
  }
  corpo.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;"></div>`;
  const grid = corpo.firstElementChild;
  g.personagensObtidos.forEach((p) => {
    const noTime = g.timeAtivo.includes(p.uid);
    const resumoDespertar = estadoDespertarResumo(p, dados.gachaRoster);
    const resumoVinculo = resumoVinculoParaCard(p);
    const habilidade = p.habilidades[0];
    // Classe/raça evidentes (task #41): nome + ícone da classe, nome da
    // raça, e a afinidade racial de classe quando ela existe pra essa
    // combinação (ver AffinitySystem.js/affinities.json).
    const classeInfo = (dados.classes || []).find((c) => c.id === p.classeId);
    const racaInfo = (dados.races || []).find((r) => r.id === p.racaId);
    const afinidade = infoAfinidade(p.racaId, p.classeId, dados.affinities);
    // Facção regional (task #44): mostra a facção de origem do convocado e
    // sinaliza quando ela bate com a afiliação do personagem principal
    // (camaradagem regional ativa em batalha).
    const faccaoInfo = p.facaoId ? facaoInfo(p.facaoId, dados.worldStateVariables) : null;
    const camaradagemAtiva = faccaoInfo && facaoAfiliada(personagem) === p.facaoId;
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:190px;align-items:center;border-color:${RARITY_COLORS[p.raridade]};cursor:pointer;`;
    div.innerHTML = `
      <div class="nome" style="text-align:center;">${p.nome}${noTime ? " 🛡️" : ""}</div>
      ${badge(p.raridade)}
      <div class="desc classe-evidente" style="text-align:center;font-size:1.05em;">${classeInfo ? `${classeInfo.icone} <b>${classeInfo.nome}</b>` : p.classeId}${racaInfo ? ` · ${racaInfo.nome}` : ""}</div>
      ${faccaoInfo ? `<div class="desc" style="text-align:center;">${faccaoInfo.icone || ""} ${faccaoInfo.nome}</div>` : ""}
      <div class="desc" style="text-align:center;">Nv. ${p.nivel}</div>
      <div class="desc" style="text-align:center;">HP ${p.hp}/${p.hpMax} · MP ${p.mp}/${p.mpMax}</div>
      ${afinidade ? `<div class="desc badge-afinidade" style="text-align:center;margin-top:4px;" title="${afinidade.texto}">🔗 Afinidade racial ativa</div>` : ""}
      ${camaradagemAtiva ? `<div class="desc badge-afinidade" style="text-align:center;">🤝 Camaradagem regional ativa</div>` : ""}
      ${p.descricao ? `<div class="desc" style="text-align:center;margin-top:4px;font-style:italic;">${p.descricao}</div>` : ""}
      ${habilidade ? `<div class="desc" style="text-align:center;margin-top:4px;"><b>${habilidade.nome}</b> — ${habilidade.descricao}</div>` : ""}
      ${resumoDespertar ? `<div class="desc despertar-tag ${resumoDespertar.classe}" style="text-align:center;margin-top:4px;">${resumoDespertar.texto}</div>` : ""}
      <div class="desc vinculo-tag ${resumoVinculo.classe}" style="text-align:center;margin-top:4px;">${resumoVinculo.texto}</div>
      <button class="btn-vinculo-card" style="margin-top:6px;">💬 Vínculo</button>
    `;
    // Reabre a tela de gacha inteira (aba Coleção) em vez de reusar `corpo`
    // diretamente: montarDespertar()/montarVinculo() substituem todo o
    // #modal-conteudo, então o nó `corpo` capturado aqui ficaria desanexado
    // do DOM depois disso.
    div.onclick = () => montarDespertar(personagem, dados, p.uid, onMudar, () => montarGacha(personagem, dados, onMudar, "colecao"));
    // Botão de Vínculo fica DENTRO do card clicável de Despertar — precisa
    // parar a propagação do clique, senão os dois modais tentariam abrir ao
    // mesmo tempo (o card inteiro também tem onclick pro Despertar).
    div.querySelector(".btn-vinculo-card").onclick = (ev) => {
      ev.stopPropagation();
      montarVinculo(personagem, dados, p.uid, onMudar, () => montarGacha(personagem, dados, onMudar, "colecao"));
    };
    grid.appendChild(div);
  });
}

// Grade de formação (task #43): mostra o time ativo (principal + convocados)
// já posicionado em frente/retaguarda, com botões pra trocar a posição de
// cada um. "player" é o id-sentinela do personagem principal — o mesmo usado
// por BattleUI.js/FormationSystem.js na hora de montar a batalha de verdade.
function renderFormacao(corpo, personagem, dados, onMudar) {
  const g = personagem.gacha;
  const membrosAtivos = [
    { id: "player", nome: personagem.nome, raridade: null, classeId: personagem.classeId, facaoId: null, rosterId: null },
    ...g.timeAtivo.map((uid) => g.personagensObtidos.find((p) => p.uid === uid)).filter(Boolean)
      .map((p) => ({ id: p.uid, nome: p.nome, raridade: p.raridade, classeId: p.classeId, facaoId: p.facaoId, rosterId: p.rosterId })),
  ];
  const idsTime = membrosAtivos.map((m) => m.id);

  const bloco = document.createElement("div");
  bloco.innerHTML = `
    <h3>Formação</h3>
    <p class="desc">Frente absorve os golpes físicos e é alvo prioritário de inimigos corpo a corpo. Retaguarda recebe menos dano físico enquanto a frente estiver de pé — mas magia e ataques à distância ignoram a formação.</p>
    <div class="formacao-grade"></div>
  `;
  const gradeEl = bloco.querySelector(".formacao-grade");
  ["frente", "retaguarda"].forEach((posicaoFileira) => {
    const coluna = document.createElement("div");
    coluna.className = "formacao-fileira";
    coluna.innerHTML = `<div class="formacao-fileira-titulo">${posicaoFileira === "frente" ? "⚔️ Frente" : "🛡️ Retaguarda"}</div>`;
    membrosAtivos
      .filter((m) => posicaoDe(personagem, m.id, idsTime) === posicaoFileira)
      .forEach((m) => {
        const chip = document.createElement("div");
        chip.className = "formacao-chip";
        if (m.raridade) chip.style.borderColor = RARITY_COLORS[m.raridade];
        // Classe evidente (task #41): ícone da classe ao lado do nome.
        const classeIcone = ((dados.classes || []).find((c) => c.id === m.classeId) || {}).icone || "";
        chip.innerHTML = `<span>${classeIcone} ${m.nome}</span><button class="btn-trocar-posicao" data-id="${m.id}">Trocar</button>`;
        chip.querySelector(".btn-trocar-posicao").onclick = () => {
          const novaPosicao = posicaoFileira === "frente" ? "retaguarda" : "frente";
          definirPosicao(personagem, m.id, novaPosicao, idsTime);
          onMudar();
          // Re-renderiza a aba Time inteira (não só o bloco de formação):
          // renderFormacao() sempre um <div> novo dentro de `corpo` sem
          // limpar o anterior, então chamar só ela de novo empilharia
          // grades duplicadas. renderTime() já limpa corpo.innerHTML antes
          // de reconstruir tudo — mesmo padrão usado no resto do arquivo.
          renderTime(corpo, personagem, dados, onMudar);
        };
        coluna.appendChild(chip);
      });
    gradeEl.appendChild(coluna);
  });
  // Combos de formação: mostra quais sinergias estão ativas com a formação
  // atual, antes mesmo de entrar em batalha (ver FormationSynergySystem.js).
  const membrosComPosicao = membrosAtivos.map((m) => ({ classeId: m.classeId, posicao: posicaoDe(personagem, m.id, idsTime) }));
  const sinergias = sinergiasAtivasPreview(membrosComPosicao);
  const sinergiasEl = document.createElement("div");
  sinergiasEl.className = "sinergias-preview";
  sinergiasEl.innerHTML = sinergias.length
    ? sinergias.map((s) => `<p class="sinergia-preview-item" title="${s.descricao}">${s.icone} <b>${s.nome}</b> ativa</p>`).join("")
    : `<p class="desc">Nenhuma sinergia de formação ativa. Coloque duas classes que combinam (ex.: Guerreiro + Clérigo) na mesma fileira pra ativar um bônus tático.</p>`;
  bloco.appendChild(sinergiasEl);
  // Sinergia de facção (melhoria pós-backlog, ver FactionSynergySystem.js):
  // mesmo espírito da prévia de combos de formação acima, mas avisando se 3+
  // convocados do time atual vêm da mesma facção de origem.
  const sinergiaFaccao = sinergiaFaccaoPreview(membrosAtivos, dados.worldStateVariables);
  const sinergiaFaccaoEl = document.createElement("div");
  sinergiaFaccaoEl.className = "sinergias-preview";
  sinergiaFaccaoEl.innerHTML = sinergiaFaccao
    ? `<p class="sinergia-preview-item" title="${sinergiaFaccao.descricao}">${sinergiaFaccao.icone} <b>${sinergiaFaccao.nome}</b> ativa</p>`
    : `<p class="desc">Nenhuma sinergia de facção ativa. Convoque 3 personagens da mesma facção de origem pro time pra ativar um bônus tático pro grupo inteiro.</p>`;
  bloco.appendChild(sinergiaFaccaoEl);
  // Rivalidade/Amizade entre convocados específicos (melhoria pós-backlog,
  // ver RivalrySystem.js): mesmo espírito das prévias acima, mas por pares
  // curados de personagens nomeados, não por classe/facção agregada.
  const paresRelacionamento = paresRelacionamentoPreview(membrosAtivos);
  const paresEl = document.createElement("div");
  paresEl.className = "sinergias-preview";
  paresEl.innerHTML = paresRelacionamento.length
    ? paresRelacionamento.map((p) => `<p class="sinergia-preview-item" title="${p.descricao}">${p.icone} <b>${p.nome}</b> ativa</p>`).join("")
    : `<p class="desc">Nenhuma rivalidade/amizade ativa. Alguns convocados têm uma história pessoal entre si — leve os dois pro time pra ativar o bônus.</p>`;
  bloco.appendChild(paresEl);
  corpo.appendChild(bloco);

  // Perfis de time salvos (melhoria pós-backlog, ver TeamProfileSystem.js):
  // até 3 configurações nomeadas de time+formação, pra trocar rápido entre
  // builds sem remontar tudo manualmente toda vez.
  const perfisDiv = document.createElement("div");
  perfisDiv.innerHTML = `<h3>Perfis de Time</h3><p class="desc">Salve até ${perfisParaExibir(personagem).length} times com formação pra trocar rápido depois.</p>`;
  perfisParaExibir(personagem).forEach((perfil, slot) => {
    const linha = document.createElement("div");
    linha.className = "card perfil-time-linha";
    linha.style.cssText = "flex-direction:column;align-items:flex-start;gap:6px;width:100%;";
    if (perfil) {
      linha.innerHTML = `
        <div class="nome">${perfil.nome}</div>
        <div class="desc">${perfil.timeAtivo.length + 1} membro(s) no time</div>
        <div style="display:flex;gap:6px;">
          <button class="btn-carregar-perfil" data-slot="${slot}">Carregar</button>
          <button class="btn-apagar-perfil" data-slot="${slot}">Apagar</button>
        </div>
      `;
    } else {
      linha.innerHTML = `
        <div class="nome">Slot ${slot + 1} vazio</div>
        <div style="display:flex;gap:6px;align-items:center;width:100%;">
          <input type="text" class="input-nome-perfil" placeholder="Nome do time (opcional)" maxlength="30" style="flex:1;" />
          <button class="btn-salvar-perfil" data-slot="${slot}">Salvar time atual aqui</button>
        </div>
      `;
    }
    perfisDiv.appendChild(linha);
  });
  corpo.appendChild(perfisDiv);

  perfisDiv.querySelectorAll(".btn-salvar-perfil").forEach((b) => {
    b.onclick = () => {
      const input = b.closest(".perfil-time-linha").querySelector(".input-nome-perfil");
      salvarPerfilDeTime(personagem, Number(b.dataset.slot), input ? input.value : "");
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
  });
  perfisDiv.querySelectorAll(".btn-carregar-perfil").forEach((b) => {
    b.onclick = () => {
      carregarPerfilDeTime(personagem, Number(b.dataset.slot));
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
  });
  perfisDiv.querySelectorAll(".btn-apagar-perfil").forEach((b) => {
    b.onclick = () => {
      apagarPerfilDeTime(personagem, Number(b.dataset.slot));
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
  });
}

function renderTime(corpo, personagem, dados, onMudar) {
  const g = personagem.gacha;
  corpo.innerHTML = `
    <p>Seu personagem principal (${personagem.nome}) está sempre no time. Escolha até ${MAX_CONVOCADOS_GACHA} personagens invocados para completar o time de ${MAX_CONVOCADOS_GACHA + 1}.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  renderFormacao(corpo, personagem, dados, onMudar);
  if (!g.personagensObtidos.length) {
    grid.innerHTML = "<p>Invoque personagens na aba Invocar para montar seu time.</p>";
    return;
  }
  g.personagensObtidos.forEach((p) => {
    const selecionado = g.timeAtivo.includes(p.uid);
    const classeInfo = (dados.classes || []).find((c) => c.id === p.classeId);
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:150px;align-items:center;border-color:${RARITY_COLORS[p.raridade]}${selecionado ? ";box-shadow:0 0 0 3px #f5a524" : ""}`;
    div.innerHTML = `
      <div class="nome" style="text-align:center;">${p.nome}</div>
      ${badge(p.raridade)}
      <div class="desc classe-evidente">${classeInfo ? `${classeInfo.icone} ${classeInfo.nome}` : p.classeId}</div>
      <div class="desc">Nv. ${p.nivel}</div>
      <button class="btn-time" data-uid="${p.uid}" style="margin-top:6px;">${selecionado ? "Remover do time" : "Colocar no time"}</button>
    `;
    div.querySelector(".btn-time").onclick = () => {
      let novoTime = [...g.timeAtivo];
      if (selecionado) novoTime = novoTime.filter((uid) => uid !== p.uid);
      else if (novoTime.length < MAX_CONVOCADOS_GACHA) novoTime.push(p.uid);
      else { alert(`O time já tem ${MAX_CONVOCADOS_GACHA} personagens convocados além do principal. Remova um antes de adicionar outro.`); return; }
      definirTimeAtivo(personagem, novoTime);
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
    grid.appendChild(div);
  });
}

function renderRecompensas(corpo, personagem, dados, onMudar) {
  const g = personagem.gacha;
  const podeSemanal = podeResgatarMissaoSemanal(personagem);
  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Desafio Diário — ${g.desafiosDiariosAcumulados} carga(s) acumulada(s)</div>
      <div class="desc">Não precisa jogar todo dia: acumula até ${7} cargas para você resgatar quando quiser.</div>
      <button id="btn-diario" style="margin-top:6px;" ${g.desafiosDiariosAcumulados > 0 ? "" : "disabled"}>Resgatar</button>
    </div>
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Missão Semanal</div>
      <div class="desc">Uma grande recompensa de Fragmentos, disponível a cada 7 dias.</div>
      <button id="btn-semanal" style="margin-top:6px;" ${podeSemanal ? "" : "disabled"}>${podeSemanal ? "Resgatar" : "Já resgatada esta semana"}</button>
    </div>
  `;
  corpo.querySelector("#btn-diario").onclick = () => {
    const r = resgatarDesafioDiario(personagem);
    if (r.ok) { atualizarSaldo(personagem); onMudar(); renderRecompensas(corpo, personagem, dados, onMudar); }
  };
  corpo.querySelector("#btn-semanal").onclick = () => {
    const r = resgatarMissaoSemanal(personagem);
    if (r.ok) { atualizarSaldo(personagem); onMudar(); renderRecompensas(corpo, personagem, dados, onMudar); }
  };
}

  return { montarGacha };
})();

const MOD_src_ui_SkillTreeUI_js = (function(){
  const escolhaPendente = MOD_src_systems_CharacterFactory_js.escolhaPendente;
  const aplicarEscolhaArvore = MOD_src_systems_CharacterFactory_js.aplicarEscolhaArvore;
// Tela da árvore de habilidades: mostra os nós já desbloqueados, a escolha
// pendente (se houver, com botões para o jogador decidir entre o ramo
// ofensivo e o ramo de suporte) e os próximos tiers ainda bloqueados.


const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

function cardNo(node, extraHTML = "") {
  const ramoLabel = node.ramo === "ofensiva" ? "⚔️ Ofensiva" : "🛡️ Suporte";
  return `
    <div class="card" style="align-items:flex-start;">
      <div class="info">
        <div class="nome">${node.nome} <span style="font-size:0.7em;opacity:0.75">(${ramoLabel})</span></div>
        <div class="desc">${node.descricao}</div>
      </div>
      <div>${extraHTML}</div>
    </div>`;
}

function montarArvoreHabilidades(personagem, dados, onMudar) {
  overlay().classList.remove("hidden");
  const arvore = (dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  const pendente = escolhaPendente(personagem, dados);
  const classeDef = (dados.classes || []).find((c) => c.id === personagem.classeId);

  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Árvore de Habilidades — ${personagem.classeNome}</h2>
    ${classeDef && classeDef.descricao ? `<p style="opacity:0.85;font-style:italic;">${classeDef.descricao}</p>` : ""}
    <div id="modal-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  const corpo = conteudo().querySelector("#modal-corpo");

  if (pendente) {
    const bloco = document.createElement("div");
    bloco.innerHTML = `<h3 style="color:#f5a524;">🌟 Escolha disponível (Nível ${pendente.nivelRequerido})</h3><p style="font-size:0.85em;opacity:0.85">Escolha um dos dois caminhos abaixo. A escolha é permanente.</p>`;
    pendente.opcoes.forEach((node) => {
      const div = document.createElement("div");
      div.innerHTML = cardNo(node, `<button class="btn-escolha-habilidade primario" data-node-id="${node.id}">Escolher</button>`);
      bloco.appendChild(div);
    });
    corpo.appendChild(bloco);
    corpo.querySelectorAll(".btn-escolha-habilidade").forEach((b) => {
      b.onclick = () => {
        const r = aplicarEscolhaArvore(personagem, dados, b.dataset.nodeId);
        if (r.ok) onMudar();
        montarArvoreHabilidades(personagem, dados, onMudar);
      };
    });
  }

  const tiers = [...new Set(arvore.map((n) => n.tier))].sort((a, b) => a - b);
  if (tiers.length) {
    const h = document.createElement("h3");
    h.textContent = "Progresso";
    corpo.appendChild(h);
  }
  tiers.forEach((tier) => {
    const opcoes = arvore.filter((n) => n.tier === tier);
    const escolhido = opcoes.find((n) => escolhas.includes(n.id));
    const nivelRequerido = opcoes[0].nivelRequerido;
    const div = document.createElement("div");
    if (escolhido) {
      div.innerHTML = cardNo(escolhido, `<span style="color:#4ecb71;font-size:0.8em;">✅ Desbloqueado</span>`);
    } else if (personagem.nivel >= nivelRequerido) {
      // já coberto pelo bloco de escolha pendente acima
      return;
    } else {
      div.innerHTML = `<div class="card" style="opacity:0.55;"><div class="info"><div class="nome">🔒 Tier ${tier}</div>
        <div class="desc">Disponível no nível ${nivelRequerido}: ${opcoes.map((o) => o.nome).join(" ou ")}</div></div></div>`;
    }
    corpo.appendChild(div);
  });

  if (!arvore.length) {
    corpo.innerHTML += "<p>Esta classe ainda não possui árvore de habilidades.</p>";
  }
}

  return { montarArvoreHabilidades };
})();

const MOD_src_ui_CompendiumUI_js = (function(){
  const bestiarioParaCompendio = MOD_src_systems_CompendiumSystem_js.bestiarioParaCompendio;
  const progressoBestiario = MOD_src_systems_CompendiumSystem_js.progressoBestiario;
  const missoesParaCompendio = MOD_src_systems_CompendiumSystem_js.missoesParaCompendio;
  const historicoInvocacoes = MOD_src_systems_CompendiumSystem_js.historicoInvocacoes;
  const RARITY_COLORS = MOD_src_systems_InventorySystem_js.RARITY_COLORS;
  const RARITY_LABEL = MOD_src_systems_InventorySystem_js.RARITY_LABEL;
  const getReputacao = MOD_src_systems_WorldStateSystem_js.getReputacao;
  const tierDaReputacao = MOD_src_systems_WorldStateSystem_js.tierDaReputacao;
  const facaoAfiliada = MOD_src_systems_WorldStateSystem_js.facaoAfiliada;
  const afiliarFaccao = MOD_src_systems_WorldStateSystem_js.afiliarFaccao;
  const registrarDecisao = MOD_src_systems_WorldStateSystem_js.registrarDecisao;
  const infoElemento = MOD_src_systems_ElementSystem_js.infoElemento;
// Tela do Compêndio: bestiário (com registro de abates), lista de missões,
// histórico de invocações (task #37) e facções regionais (task #44). As
// primeiras três abas só leem dados de outros sistemas; a aba Facções é a
// única que altera estado do jogo (afiliação é uma escolha do jogador).





const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

const BIOMA_LABEL = { floresta: "Floresta", estrada: "Estrada", masmorra: "Masmorra", deserto: "Deserto", aguas: "Águas" };
const ELEMENTO_LABEL = { fogo: "Fogo", agua: "Água", gelo: "Gelo", natureza: "Natureza", sombrio: "Sombrio", radiante: "Radiante", vento: "Vento", terra: "Terra", raio: "Raio", arcano: "Arcano", veneno: "Veneno" };

function montarCompendio(personagem, dados, abaInicial = "bestiario") {
  overlay().classList.remove("hidden");
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Compêndio</h2>
    <div id="compendio-tabs" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <button data-tab="bestiario">Bestiário</button>
      <button data-tab="missoes">Missões</button>
      <button data-tab="invocacoes">Invocações</button>
      <button data-tab="faccoes">Facções</button>
    </div>
    <div id="compendio-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelectorAll("#compendio-tabs button").forEach((b) => {
    b.onclick = () => montarCompendio(personagem, dados, b.dataset.tab);
  });

  const corpo = conteudo().querySelector("#compendio-corpo");
  if (abaInicial === "missoes") renderMissoes(corpo, personagem, dados);
  else if (abaInicial === "invocacoes") renderInvocacoes(corpo, personagem, dados);
  else if (abaInicial === "faccoes") renderFaccoes(corpo, personagem, dados);
  else renderBestiario(corpo, personagem, dados);
}

function renderBestiario(corpo, personagem, dados) {
  const bestiario = bestiarioParaCompendio(personagem, dados);
  const progresso = progressoBestiario(personagem, dados);

  corpo.innerHTML = `
    <p>Descobertos: ${progresso.descobertos}/${progresso.total} (${progresso.percentual}%). Derrote um monstro pela primeira vez para revelar sua entrada — a fraqueza elemental exata só aparece depois de mais abates do mesmo tipo.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  bestiario.forEach((m) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:190px;align-items:flex-start;${m.chefe ? "border-color:#f5a524;" : ""}${!m.descoberto ? "opacity:0.55;" : ""}`;
    if (m.descoberto) {
      // Fraqueza elemental progressiva (melhoria pós-backlog original): só
      // aparece depois de ABATES_PARA_REVELAR_FRAQUEZA abates — antes disso,
      // mostra quantos faltam em vez do elemento exato, pra dar um motivo a
      // mais pra caçar o mesmo monstro de novo.
      let fraquezaHTML;
      if (m.fraquezaRevelada) {
        const nomes = (m.fraquezas || []).map((elId) => {
          const info = infoElemento(elId, dados.elements);
          return info ? `${info.icone} ${info.nome}` : elId;
        });
        fraquezaHTML = nomes.length ? `Fraqueza: ${nomes.join(", ")}` : "Fraqueza: nenhuma conhecida";
      } else {
        fraquezaHTML = `Fraqueza: ??? (mais ${m.abatesFaltandoFraqueza} abate${m.abatesFaltandoFraqueza === 1 ? "" : "s"} para revelar)`;
      }
      div.innerHTML = `
        <div class="nome">${m.nome}${m.chefe ? " 👑" : ""}</div>
        <div class="desc">Nv. ${m.nivel} · ${(m.bioma || []).map((b) => BIOMA_LABEL[b] || b).join(", ")}${m.elemento ? ` · ${ELEMENTO_LABEL[m.elemento] || m.elemento}` : ""}</div>
        <div class="desc" style="margin-top:4px;">Abates: ${m.abates}</div>
        <div class="desc" style="margin-top:4px;">${fraquezaHTML}</div>
        <div class="desc" style="margin-top:6px;font-style:italic;">${m.lore}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="nome">???</div>
        <div class="desc" style="margin-top:4px;font-style:italic;">${m.teaser}</div>
      `;
    }
    grid.appendChild(div);
  });
}

function renderMissoes(corpo, personagem, dados) {
  const missoes = missoesParaCompendio(personagem, dados);
  const concluidas = missoes.filter((q) => q.concluida).length;

  corpo.innerHTML = `
    <p>Concluídas: ${concluidas}/${missoes.length}.</p>
    <div style="display:flex;flex-direction:column;gap:6px;"></div>
  `;
  const lista = corpo.lastElementChild;
  missoes.forEach((q) => {
    const status = q.concluida ? "✅ Concluída" : q.ativa ? "🕒 Em andamento" : "🔒 Não iniciada";
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `align-items:flex-start;${q.concluida ? "" : "opacity:0.75;"}`;
    div.innerHTML = `
      <div class="info">
        <div class="nome">${q.nome} <span style="font-size:0.75em;opacity:0.85">— ${status}</span></div>
        <div class="desc">${q.descricao}</div>
        <div class="desc" style="margin-top:2px;">Recompensa: ${q.recompensaOuro} ouro, ${q.recompensaXP} XP${q.recompensaFragmentos ? `, ${q.recompensaFragmentos} Fragmentos` : ""}</div>
      </div>
    `;
    lista.appendChild(div);
  });
}

function renderInvocacoes(corpo, personagem, dados) {
  const historico = historicoInvocacoes(personagem);
  const BANNER_LABEL = { permanente: "Permanente", evento: "Evento", iniciante: "Iniciante" };

  if (!historico.length) {
    corpo.innerHTML = "<p>Nenhuma invocação registrada ainda. Vá até a tela de Time (G) para invocar.</p>";
    return;
  }

  corpo.innerHTML = `<p>Últimas ${historico.length} invocações (mais recente primeiro):</p><div style="display:flex;flex-direction:column;gap:4px;"></div>`;
  const lista = corpo.lastElementChild;
  historico.forEach((h) => {
    const data = new Date(h.data);
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `align-items:center;border-color:${RARITY_COLORS[h.raridade] || "#4a3a26"};padding:6px 10px;`;
    div.innerHTML = `
      <div class="info" style="display:flex;align-items:center;gap:8px;">
        <span class="raridade-badge" style="background:${RARITY_COLORS[h.raridade]}">${RARITY_LABEL[h.raridade] || h.raridade}</span>
        <span class="nome">${h.nome}${h.featured ? " ⭐" : ""}${h.duplicata ? " (duplicata)" : ""}</span>
        <span class="desc">Banner ${BANNER_LABEL[h.banner] || h.banner} — ${data.toLocaleDateString()} ${data.toLocaleTimeString()}</span>
      </div>
    `;
    lista.appendChild(div);
  });
}

// Facções regionais (task #44): reputação de cada facção (numérica, sobe
// derrotando chefes na região dela e por ações que ainda vierem a afetá-la)
// + afiliação (escolha pessoal do jogador, ver WorldStateSystem.js). "Vila"
// fica de fora daqui — ela já tem tela própria de reputação implícita nos
// preços da loja/diálogo, e não é uma das 10 facções regionais afiliáveis.
function renderFaccoes(corpo, personagem, dados) {
  const facoes = (dados.worldStateVariables.facoes || []).filter((f) => f.id !== "vila");
  const afiliacaoAtual = facaoAfiliada(personagem);

  corpo.innerHTML = `
    <p>Cada região do mundo tem seu próprio povo. Afilie-se a uma facção — convocados do gacha originários dela lutam com mais força ao seu lado (camaradagem regional). Derrotar chefes no território de uma facção sobe sua reputação com ela.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  facoes.forEach((f) => {
    const rep = getReputacao(personagem, f.id);
    const tier = tierDaReputacao(rep, dados.worldStateVariables);
    const afiliado = afiliacaoAtual === f.id;
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:220px;align-items:flex-start;${afiliado ? "border-color:#f5a524;box-shadow:0 0 0 2px #f5a524;" : ""}`;
    div.innerHTML = `
      <div class="nome">${f.icone || ""} ${f.nome}${afiliado ? " ⭐ Afiliado" : ""}</div>
      <div class="desc" style="margin-top:4px;">${f.descricao}</div>
      <div class="desc" style="margin-top:6px;">Reputação: ${rep}${tier ? ` (${tier.nome})` : ""}</div>
      <button class="btn-afiliar" style="margin-top:8px;" ${afiliado ? "disabled" : ""}>${afiliado ? "Facção atual" : "Afiliar-se"}</button>
    `;
    div.querySelector(".btn-afiliar").onclick = () => {
      afiliarFaccao(personagem, f.id);
      registrarDecisao(personagem, { icone: f.icone || "🤝", titulo: `Afiliação: ${f.nome}`, texto: `Você declarou lealdade a ${f.nome}.` });
      montarCompendio(personagem, dados, "faccoes");
    };
    grid.appendChild(div);
  });
}

  return { montarCompendio };
})();

const MOD_src_systems_ThreatSystem_js = (function(){
// Classificação de ameaça de um encontro a partir da diferença entre o
// nível médio do grupo e o nível médio dos inimigos — puramente informativa,
// não altera nenhuma regra de combate ou recompensa.

const FAIXAS = [
  { min: 4, max: Infinity, id: "trivial", nome: "Trivial", cor: "#7a8a7a", icone: "💤" },
  { min: 2, max: 3, id: "favoravel", nome: "Favorável", cor: "#6fcf5c", icone: "🙂" },
  { min: -2, max: 1, id: "equilibrada", nome: "Equilibrada", cor: "#f5e34e", icone: "⚖️" },
  { min: -5, max: -3, id: "perigosa", nome: "Perigosa", cor: "#f5a524", icone: "⚠️" },
  { min: -Infinity, max: -6, id: "mortal", nome: "Mortal", cor: "#e05555", icone: "💀" },
];

function nivelMedio(personagens) {
  if (!personagens.length) return 1;
  return personagens.reduce((soma, p) => soma + (p.nivel || 1), 0) / personagens.length;
}

function classificarAmeaca(nivelGrupo, nivelInimigos) {
  const diff = nivelGrupo - nivelInimigos; // positivo = grupo mais forte
  const faixa = FAIXAS.find((f) => diff >= f.min && diff <= f.max) || FAIXAS[2];
  return { id: faixa.id, nome: faixa.nome, cor: faixa.cor, icone: faixa.icone, diferenca: Math.round(diff * 10) / 10 };
}

// `personagens`: array de personagens do time ativo. `monstrosDef`: array de
// definições de monstros (src/data/monsters.json) do encontro.
function avaliarEncontro(personagens, monstrosDef) {
  const nivelGrupo = nivelMedio(personagens);
  const nivelInimigos = nivelMedio(monstrosDef.map((m) => ({ nivel: m.nivel })));
  const ameaca = classificarAmeaca(nivelGrupo, nivelInimigos);
  const elementosDetectados = [...new Set(monstrosDef.map((m) => m.elemento || "fisico"))];
  const temChefe = monstrosDef.some((m) => m.chefe);
  return {
    ameaca,
    quantidade: monstrosDef.length,
    elementosDetectados,
    temChefe,
    podeFugir: true, // fuga sempre disponível nesta versão (chance baseada em velocidade, ver CombatSystem.fugir)
  };
}

  return { nivelMedio, classificarAmeaca, avaliarEncontro };
})();

const MOD_src_ui_ThreatUI_js = (function(){
  const avaliarEncontro = MOD_src_systems_ThreatSystem_js.avaliarEncontro;
  const relacaoElemental = MOD_src_systems_ElementSystem_js.relacaoElemental;
  const fecharModal = MOD_src_ui_GameUI_js.fecharModal;
// Tela de ameaça pré-combate: mostra classificação (Trivial..Mortal),
// quantidade de inimigos, elementos detectados e se há chefe, antes de
// confirmar a entrada em batalha. O jogador pode lutar ou evitar o combate.




const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

const SUFIXO_RELACAO_AMEACA = {
  vantagem_intensa: { texto: "✅✅", titulo: "Sua arma tem vantagem intensa contra este elemento" },
  vantagem: { texto: "✅", titulo: "Sua arma tem vantagem contra este elemento" },
  resistencia: { texto: "🛡️", titulo: "Sua arma sofre resistência deste elemento" },
  resistencia_intensa: { texto: "🛡️🛡️", titulo: "Sua arma sofre resistência intensa deste elemento" },
  imune: { texto: "🚫", titulo: "Este inimigo é imune ao elemento da sua arma" },
};

function mostrarAmeaca(monstrosDef, personagens, dados, onLutar, onFugir, terrenoElemento = null, totalOndasExtras = 0) {
  const info = avaliarEncontro(personagens, monstrosDef);
  overlay().classList.remove("hidden");
  // Elemento da arma do personagem principal, usado só para dar uma prévia
  // de vantagem/resistência/imunidade contra os elementos detectados —
  // puramente informativo, não altera a IA nem o combate em si.
  const elementoArma = (personagens[0] && personagens[0].equipamento && personagens[0].equipamento.arma && personagens[0].equipamento.arma.elemento) || "fisico";
  const elementosHtml = info.elementosDetectados
    .map((elId) => {
      const el = (dados.elements && dados.elements.elementos || []).find((e) => e.id === elId);
      if (!el) return "";
      let sufixo = "";
      if (dados.elements && elementoArma !== "fisico" && elId !== "fisico") {
        const relacao = relacaoElemental(elementoArma, elId, dados.elements);
        const s = SUFIXO_RELACAO_AMEACA[relacao];
        if (s) sufixo = `<span title="${s.titulo}">${s.texto}</span>`;
      }
      return `<span title="${el.nome}" style="font-size:1.2em;margin-right:4px;">${el.icone}${sufixo}</span>`;
    })
    .join("");
  const nomesInimigos = [...new Set(monstrosDef.map((m) => m.nome))].join(", ");
  // Terreno (task #42): badge informativo mostrando o elemento dominante do
  // bioma/masmorra atual — o mesmo elemento fica mais forte para qualquer
  // atacante, mas os inimigos daqui têm resistência a ele (ver CombatSystem.js).
  const terrenoEl = terrenoElemento && dados.elements
    ? (dados.elements.elementos || []).find((e) => e.id === terrenoElemento)
    : null;
  const terrenoHtml = terrenoEl
    ? `<p title="Terreno: ${terrenoEl.nome} fica mais forte aqui, mas os inimigos locais resistem a ele.">🗺️ Terreno: ${terrenoEl.icone} ${terrenoEl.nome}</p>`
    : "";
  // Horda (task #47): avisa ANTES de entrar, já que é um desafio de
  // resistência sem cura entre ondas — o jogador precisa saber que não é
  // um combate comum antes de confirmar.
  const totalOndas = 1 + totalOndasExtras;
  const hordaHtml = totalOndasExtras > 0
    ? `<p style="color:#f5a524;font-weight:bold;" title="O time não recupera HP/MP entre as ondas.">🌊 HORDA! ${totalOndas} ondas de inimigos, sem descanso entre elas.</p>`
    : "";

  const temSolo = monstrosDef.length === 1 && monstrosDef[0].solo;
  // Fala do chefe (task #45): personalidade própria mostrada antes do
  // combate, só quando o encontro é exatamente o chefe único da zona (não
  // aparece em encontros comuns/hordas, que não têm o campo "fala").
  const falaChefe = monstrosDef.length === 1 && monstrosDef[0].chefe && monstrosDef[0].fala
    ? `<p style="font-style:italic;opacity:0.9;margin:8px 0;border-left:3px solid ${info.ameaca.cor};padding-left:8px;">${monstrosDef[0].fala}</p>`
    : "";
  conteudo().innerHTML = `
    <h2 style="color:${info.ameaca.cor};">${info.ameaca.icone} Ameaça: ${info.ameaca.nome}${info.temChefe ? " · 👑 Chefe" : ""}${temSolo ? " · 💪 Reforçado" : ""}</h2>
    <div id="modal-corpo">
      <p>${nomesInimigos}</p>
      ${falaChefe}
      <p>Inimigos detectados${totalOndasExtras > 0 ? " (1ª onda)" : ""}: <b>${info.quantidade}</b></p>
      ${hordaHtml}
      ${elementosHtml ? `<p>Elementos: ${elementosHtml}</p>` : ""}
      ${terrenoHtml}
      <p style="font-size:0.8em;opacity:0.75">Diferença de nível em relação ao grupo: ${info.ameaca.diferenca > 0 ? "+" : ""}${info.ameaca.diferenca}</p>
      <div style="margin-top:10px;">
        <button class="btn-lutar primario">⚔️ Lutar</button>
        <button class="btn-fugir-ameaca">Evitar o combate</button>
      </div>
    </div>
  `;
  conteudo().querySelector(".btn-lutar").onclick = () => { fecharModal(); onLutar(); };
  conteudo().querySelector(".btn-fugir-ameaca").onclick = () => { fecharModal(); if (onFugir) onFugir(); };
}

  return { mostrarAmeaca };
})();

const MOD_src_systems_EncounterSystem_js = (function(){
// --- Reforço de monstro solo (task #46) -----------------------------------
// Desde que o time passou a ter até 4 personagens (task #43), uma luta
// contra 1 monstro só ficou raso demais — o grupo inteiro cerca um único
// alvo sem nenhuma pressão de verdade. Quando o sorteio dá exatamente 1
// inimigo, ele entra na batalha reforçado (mais vida, ataque e defesa) pra
// compensar estar em desvantagem numérica de até 4 pra 1 — e a recompensa
// (XP/ouro) sobe junto, proporcional ao reforço, pra continuar valendo a
// pena. Nunca mexe no `monstros.json` original: sempre um clone raso, então
// o mesmo monstro em grupo (2-3) continua com os stats normais.
const SOLO_MULT = { hp: 1.6, atk: 1.25, defesa: 1.15, xp: 1.3, ouro: 1.3 };

function reforcarMonstroSolo(monstroDef) {
  // Math.ceil (nunca Math.round) em todo campo escalado: com stats baixos
  // de monstro inicial (ex.: defesa 2, ouroMin 1), um multiplicador de 15-
  // 30% arredondado pra baixo vira "+0" na prática — o reforço precisa ser
  // sempre perceptível, mesmo no early game.
  return {
    ...monstroDef,
    hp: Math.ceil(monstroDef.hp * SOLO_MULT.hp),
    atk: Math.ceil(monstroDef.atk * SOLO_MULT.atk),
    defesa: Math.ceil(monstroDef.defesa * SOLO_MULT.defesa),
    xp: Math.ceil(monstroDef.xp * SOLO_MULT.xp),
    ouroMin: Math.ceil(monstroDef.ouroMin * SOLO_MULT.ouro),
    ouroMax: Math.ceil(monstroDef.ouroMax * SOLO_MULT.ouro),
    solo: true, // sinaliza pra UI (ThreatUI/BattleUI) que este é um monstro reforçado
  };
}

// --- Emboscada por reputação regional (melhoria pós-backlog original) ----
// Consequência visível de reputação muito negativa com a facção regional da
// zona (ver WorldStateSystem.js: deveEmboscar) — moradores hostis reforçam
// o encontro aleatório com um atacante extra vindo do mesmo pool da zona.
// Multiplicador mais leve que o reforço de monstro solo (task #46): aqui o
// "reforço" principal já é o número extra de inimigos, o multiplicador só
// dá um empurrão a mais pra sentir que é gente de verdade emboscando, não
// só um bicho a mais no grupo.
const EMBOSCADA_MULT = { hp: 1.15, atk: 1.1, xp: 1.15, ouro: 1.15 };

function reforcarEmboscada(monstroDef) {
  return {
    ...monstroDef,
    hp: Math.ceil(monstroDef.hp * EMBOSCADA_MULT.hp),
    atk: Math.ceil(monstroDef.atk * EMBOSCADA_MULT.atk),
    xp: Math.ceil(monstroDef.xp * EMBOSCADA_MULT.xp),
    ouroMin: Math.ceil(monstroDef.ouroMin * EMBOSCADA_MULT.ouro),
    ouroMax: Math.ceil(monstroDef.ouroMax * EMBOSCADA_MULT.ouro),
    emboscada: true, // sinaliza pra UI (ThreatUI/BattleUI) que este é um atacante de emboscada
  };
}

// Decide encontros aleatórios ao caminhar em terreno selvagem, e sorteia loot.
function sortearEncontro(bioma, monstros) {
  const candidatos = monstros.filter((m) => m.bioma.includes(bioma) && !m.chefe);
  if (candidatos.length === 0) return [];
  const qtdInimigos = Math.random() < 0.7 ? 1 : Math.random() < 0.85 ? 2 : 3;
  if (qtdInimigos === 1) return [reforcarMonstroSolo(candidatos[Math.floor(Math.random() * candidatos.length)])];
  const grupo = [];
  for (let i = 0; i < qtdInimigos; i++) {
    grupo.push(candidatos[Math.floor(Math.random() * candidatos.length)]);
  }
  return grupo;
}

function deveDispararEncontro(chancePorPasso = 0.045) {
  return Math.random() < chancePorPasso;
}

// Como sortearEncontro, mas recebe a lista de monstros já filtrada (usado
// pelo sistema de zonas, onde cada zona já define seu próprio pool).
function sortearEncontroDeLista(candidatos) {
  const vivos = candidatos.filter((m) => !m.chefe);
  if (vivos.length === 0) return [];
  const qtdInimigos = Math.random() < 0.7 ? 1 : Math.random() < 0.85 ? 2 : 3;
  if (qtdInimigos === 1) return [reforcarMonstroSolo(vivos[Math.floor(Math.random() * vivos.length)])];
  const grupo = [];
  for (let i = 0; i < qtdInimigos; i++) {
    grupo.push(vivos[Math.floor(Math.random() * vivos.length)]);
  }
  return grupo;
}

// --- Hordas de monstros (task #47) ---------------------------------------
// Quando um encontro aleatório dispara, há uma chance pequena dele virar
// uma HORDA: em vez de 1 grupo só, o combate acontece em ondas sucessivas —
// a próxima só aparece depois que a anterior é derrotada por completo (ver
// Batalha.avancarLeva() em CombatSystem.js). O time não recupera HP/MP
// entre levas, então é um desafio de resistência, bem mais puxado que um
// encontro comum — mas o loot/XP final soma TODAS as levas.
function deveSerHorda(chance = 0.10) {
  return Math.random() < chance;
}

// Sorteia N levas (grupos) a partir do mesmo pool de candidatos da zona —
// cada leva usa a mesma lógica de sortearEncontroDeLista (1-3 inimigos,
// nunca chefes). Levas vazias (pool sem candidatos válidos) são descartadas
// em vez de gerar uma onda "vazia" que pularia direto pra próxima.
function sortearLevasHorda(candidatos, numLevas = 5) {
  const levas = [];
  for (let i = 0; i < numLevas; i++) {
    const leva = sortearEncontroDeLista(candidatos);
    if (leva.length) levas.push(leva);
  }
  return levas;
}

  return { reforcarMonstroSolo, reforcarEmboscada, sortearEncontro, deveDispararEncontro, sortearEncontroDeLista, deveSerHorda, sortearLevasHorda };
})();

const MOD_src_systems_SaveSystem_js = (function(){
// Salva e carrega o progresso do jogador no localStorage do navegador.
const SAVE_KEY = "rpg_pt_save_v1";

function salvarJogo(estado) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(estado));
    return true;
  } catch (e) {
    console.error("Falha ao salvar:", e);
    return false;
  }
}

function carregarJogo() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Falha ao carregar:", e);
    return null;
  }
}

function existeSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

function apagarSave() {
  localStorage.removeItem(SAVE_KEY);
}

  return { salvarJogo, carregarJogo, existeSave, apagarSave };
})();

const MOD_src_systems_CloudSave_js = (function(){
// Login com Google (Supabase Auth) e salvamento automático na nuvem.
// Implementado com fetch puro (sem SDK) para o jogo continuar 100% independente de CDNs externos.
const SUPABASE_URL = "https://qimennnhincqtygrvcwu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVubm5oaW5jcXR5Z3J2Y3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMjQ5NzQsImV4cCI6MjEwMjYwMDk3NH0.Nsxz-aT2GeVgF0STQ-oBmNZjToI6dxqTCdbzFSfW144";

const TOKEN_KEY = "rpg_pt_auth_v1";

function lerTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch {
    return null;
  }
}

function salvarTokens(t) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

function limparTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

function decodificarJWT(jwt) {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function iniciarLoginGoogle() {
  const redirect = window.location.origin + window.location.pathname;
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
  window.location.href = url;
}

// Processa o retorno do login (o Supabase redireciona de volta com os tokens no #hash da URL).
function processarRetornoLogin() {
  if (!window.location.hash.includes("access_token")) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const tokens = {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_at: Date.now() + (parseInt(params.get("expires_in") || "3600", 10) * 1000),
  };
  salvarTokens(tokens);
  history.replaceState(null, "", window.location.pathname);
  return true;
}

async function renovarTokenSeNecessario() {
  const t = lerTokens();
  if (!t) return null;
  if (Date.now() < t.expires_at - 30000) return t;
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: t.refresh_token }),
    });
    if (!resp.ok) { limparTokens(); return null; }
    const dados = await resp.json();
    const novo = {
      access_token: dados.access_token,
      refresh_token: dados.refresh_token,
      expires_at: Date.now() + (dados.expires_in || 3600) * 1000,
    };
    salvarTokens(novo);
    return novo;
  } catch {
    return null;
  }
}

async function usuarioAtual() {
  const t = await renovarTokenSeNecessario();
  if (!t) return null;
  const payload = decodificarJWT(t.access_token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, nome: payload.user_metadata?.full_name || payload.email };
}

async function sair() {
  const t = lerTokens();
  if (t) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t.access_token}` },
      });
    } catch { /* ignora falha de rede ao sair */ }
  }
  limparTokens();
}

async function salvarNaNuvem(estado) {
  const t = await renovarTokenSeNecessario();
  if (!t) return { ok: false, motivo: "nao_logado" };
  const payload = decodificarJWT(t.access_token);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/saves`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${t.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: payload.sub, dados: estado, atualizado_em: new Date().toISOString() }),
  });
  return { ok: resp.ok };
}

async function carregarDaNuvem() {
  const t = await renovarTokenSeNecessario();
  if (!t) return null;
  const payload = decodificarJWT(t.access_token);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/saves?user_id=eq.${payload.sub}&select=dados`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t.access_token}` },
  });
  if (!resp.ok) return null;
  const linhas = await resp.json();
  return linhas.length ? linhas[0].dados : null;
}

function estaLogado() {
  return !!lerTokens();
}

  return { iniciarLoginGoogle, processarRetornoLogin, usuarioAtual, sair, salvarNaNuvem, carregarDaNuvem, estaLogado };
})();

const MOD_src_systems_NewGamePlusSystem_js = (function(){
// New Game+ (melhoria de jogabilidade pós-backlog original): reinicia a
// aventura do zero (novo personagem, novo mundo — nível 1, sem itens, sem
// missões, sem exploração salva) mas preserva o roster de invocação (ver
// GachaSystem.js: personagem.gacha guarda personagens obtidos, Fragmentos
// de Aethra, pity e conquistas) e aumenta um contador que escala o desafio
// dos monstros na batalha (ver CombatSystem.js: NG_PLUS_ESCALA_POR_NIVEL /
// criarCombatenteInimigo). Só fica disponível depois de derrotar o chefe
// final ao menos uma vez — ver elegivelParaNgPlus.
function elegivelParaNgPlus(salvo) {
  return !!(
    salvo &&
    salvo.personagem &&
    salvo.personagem.gacha &&
    Array.isArray(salvo.personagem.gacha.conquistas) &&
    salvo.personagem.gacha.conquistas.includes("dragao_derrotado")
  );
}

// Recebe o personagem RECÉM-CRIADO (nível 1, via CharacterFactory.js) e o
// personagem do save anterior, de onde vem o roster/progresso do gacha a
// preservar. Muta e retorna o personagem novo (mesmo padrão de
// aplicarCrescimento/aplicarEscolhaArvore em CharacterFactory.js).
function aplicarNewGamePlus(personagemNovo, personagemAntigo) {
  personagemNovo.gacha = personagemAntigo.gacha;
  personagemNovo.ngPlus = (personagemAntigo.ngPlus || 0) + 1;
  return personagemNovo;
}

  return { elegivelParaNgPlus, aplicarNewGamePlus };
})();

const MOD_src_systems_WeatherSystem_js = (function(){
// Eventos de clima e hora do dia por zona (melhoria de jogabilidade
// pós-backlog original): variações periódicas derivadas do relógio real
// (Date.now()) combinado com o id da zona — não precisa de nenhum estado
// novo salvo/carregado (SaveSystem.js não muda em nada), e cada zona pode
// estar com um clima diferente no mesmo instante. Determinístico dentro do
// mesmo período: duas chamadas próximas no tempo pra mesma zona sempre dão
// o mesmo resultado (importante pra UI não "piscar" a cada re-render).
//
// Interage com o terreno elemental (task #42, ver CombatSystem.js
// multiplicadorTerreno/multiplicadorClima): enquanto durar, o elemento do
// clima também ganha um bônus de ataque — mais fraco que o bônus do terreno
// fixo do bioma (o terreno é permanente/estrutural, o clima é passageiro) —
// e os dois somam quando coincidem (ex.: chuva numa zona de água já forte
// fica ainda mais forte; chuva n uma zona de fogo esfria um pouco a
// vantagem do bioma sem removê-la).
const DURACAO_CLIMA_MS = 5 * 60 * 1000; // cada "rodada" de clima dura 5 minutos reais
const DURACAO_HORA_DIA_MS = 4 * 60 * 1000; // manhã/tarde/noite, 4 min reais cada — ciclo completo de 12 min

const TIPOS_CLIMA = [
  { id: "limpo", nome: "Céu Limpo", icone: "☀️", elementoBonus: null, peso: 40 },
  { id: "chuva", nome: "Chuva", icone: "🌧️", elementoBonus: "agua", peso: 15 },
  { id: "nevasca", nome: "Nevasca", icone: "❄️", elementoBonus: "gelo", peso: 10 },
  { id: "tempestade", nome: "Tempestade", icone: "⛈️", elementoBonus: "raio", peso: 10 },
  { id: "neblina", nome: "Neblina", icone: "🌫️", elementoBonus: "sombrio", peso: 10 },
  { id: "vento_forte", nome: "Vento Forte", icone: "🌬️", elementoBonus: "vento", peso: 15 },
];

const HORAS_DIA = [
  { id: "manha", nome: "Manhã", icone: "🌅" },
  { id: "tarde", nome: "Tarde", icone: "🌇" },
  { id: "noite", nome: "Noite", icone: "🌙" },
];

// Hash simples e determinístico de string -> inteiro positivo, só pra
// espalhar zonas diferentes em "sorteios" diferentes a partir do mesmo
// relógio, sem depender de nenhuma biblioteca externa.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// `agora` é injetável (testabilidade determinística) — em produção, o
// chamador sempre passa Date.now() (nunca lido diretamente aqui dentro).
function climaAtualDaZona(zonaId, agora) {
  if (!zonaId) return TIPOS_CLIMA[0];
  const periodo = Math.floor(agora / DURACAO_CLIMA_MS);
  const semente = hashString(`${zonaId}:${periodo}`);
  const pesoTotal = TIPOS_CLIMA.reduce((s, c) => s + c.peso, 0);
  let alvo = semente % pesoTotal;
  for (const clima of TIPOS_CLIMA) {
    if (alvo < clima.peso) return clima;
    alvo -= clima.peso;
  }
  return TIPOS_CLIMA[0];
}

function horaDoDiaAtual(agora) {
  const periodo = Math.floor(agora / DURACAO_HORA_DIA_MS) % HORAS_DIA.length;
  return HORAS_DIA[periodo];
}

  return { DURACAO_CLIMA_MS, DURACAO_HORA_DIA_MS, TIPOS_CLIMA, HORAS_DIA, climaAtualDaZona, horaDoDiaAtual };
})();

const MOD_src_ui_AccessibilityUI_js = (function(){
  const abrirModalBase = MOD_src_ui_GameUI_js.abrirModalBase;
  const VELOCIDADES_MENSAGEM = MOD_src_systems_AccessibilitySystem_js.VELOCIDADES_MENSAGEM;
  const TAMANHOS_FONTE = MOD_src_systems_AccessibilitySystem_js.TAMANHOS_FONTE;
  const carregarConfigAcessibilidade = MOD_src_systems_AccessibilitySystem_js.carregarConfigAcessibilidade;
  const atualizarConfigAcessibilidade = MOD_src_systems_AccessibilitySystem_js.atualizarConfigAcessibilidade;
// Tela de Acessibilidade: preferências do JOGADOR (não do personagem), ver
// AccessibilitySystem.js. Reaproveita o modal genérico de GameUI.js
// (abrirModalBase) — funciona tanto na tela inicial (antes de criar
// personagem) quanto durante o jogo (HUD), já que não depende de
// `personagem`/`dados`.



const LABEL_VELOCIDADE = { lenta: "Lenta (mais tempo pra ler)", normal: "Normal", rapida: "Rápida" };
const LABEL_FONTE = { normal: "Normal", grande: "Grande", gigante: "Gigante" };

// Aplica as classes visuais no <body> de acordo com a config atual —
// chamada no boot() (main.js) e de novo toda vez que a config muda aqui,
// pra valer na hora sem precisar recarregar a página. Exportada separada de
// montarAcessibilidade() porque main.js precisa dela ANTES de qualquer
// modal existir (aplicação inicial no carregamento do jogo).
function aplicarClassesAcessibilidade() {
  const config = carregarConfigAcessibilidade();
  document.body.classList.remove("fonte-grande", "fonte-gigante", "alto-contraste");
  if (config.tamanhoFonte === "grande") document.body.classList.add("fonte-grande");
  else if (config.tamanhoFonte === "gigante") document.body.classList.add("fonte-gigante");
  if (config.altoContraste) document.body.classList.add("alto-contraste");
}

function montarAcessibilidade() {
  const corpo = abrirModalBase("Acessibilidade");
  const config = carregarConfigAcessibilidade();
  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;gap:12px;width:100%;">
      <label style="width:100%;">Velocidade das mensagens na tela
        <select id="acc-velocidade" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(VELOCIDADES_MENSAGEM).map((v) => `<option value="${v}" ${config.velocidadeMensagem === v ? "selected" : ""}>${LABEL_VELOCIDADE[v] || v}</option>`).join("")}
        </select>
      </label>
      <label style="width:100%;">Tamanho da fonte
        <select id="acc-fonte" style="display:block;margin-top:4px;width:100%;">
          ${TAMANHOS_FONTE.map((t) => `<option value="${t}" ${config.tamanhoFonte === t ? "selected" : ""}>${LABEL_FONTE[t] || t}</option>`).join("")}
        </select>
      </label>
      <label><input type="checkbox" id="acc-efeitos" ${config.reduzirEfeitos ? "checked" : ""}/> Reduzir tremor de tela e flash de dano em combate</label>
      <label><input type="checkbox" id="acc-contraste" ${config.altoContraste ? "checked" : ""}/> Alto contraste</label>
      <p class="desc">As mudanças valem imediatamente e ficam salvas neste dispositivo — inclusive numa Nova Aventura ou New Game+.</p>
    </div>
  `;
  corpo.querySelector("#acc-velocidade").onchange = (e) => { atualizarConfigAcessibilidade({ velocidadeMensagem: e.target.value }); };
  corpo.querySelector("#acc-fonte").onchange = (e) => { atualizarConfigAcessibilidade({ tamanhoFonte: e.target.value }); aplicarClassesAcessibilidade(); };
  corpo.querySelector("#acc-efeitos").onchange = (e) => { atualizarConfigAcessibilidade({ reduzirEfeitos: e.target.checked }); };
  corpo.querySelector("#acc-contraste").onchange = (e) => { atualizarConfigAcessibilidade({ altoContraste: e.target.checked }); aplicarClassesAcessibilidade(); };
}

  return { aplicarClassesAcessibilidade, montarAcessibilidade };
})();

const MOD_src_systems_ExplorationEventSystem_js = (function(){
  const alterarReputacao = MOD_src_systems_WorldStateSystem_js.alterarReputacao;
// Eventos aleatórios de exploração (melhoria pós-backlog): pequenos
// encontros NÃO-combate ao caminhar pelo mundo aberto — viajante perdido,
// santuário esquecido, ruína a vasculhar, sinal de perigo, achado no
// caminho — pra dar textura ao mundo sem que TODO passo arriscado vire uma
// luta. Alguns reaproveitam o teste de perícia d20 (ver SkillCheckSystem.js,
// contexto "exploracao" em skillChecks.json) pro mesmo sabor de mesa de RPG
// já usado em NPCs/baús/coleta; outros (src/data/explorationEvents.json) são
// escolhas simples (ajudar/ignorar, achado instantâneo) sem d20 nenhum.
// Rola numa chance BEM menor e independente do encontro de monstro (ver
// EncounterSystem.js/main.js: verificarEncontroAleatorio) — os dois nunca
// disparam no mesmo passo, pra não empilhar interrupções uma em cima da
// outra.


function deveDispararEventoExploracao(chancePorPasso = 0.018) {
  return Math.random() < chancePorPasso;
}

// Une os dois "bancos" de eventos — escolha/achado (explorationEvents.json)
// e teste de perícia (skillChecks.json, contexto "exploracao") — num único
// sorteio, pra quem chama não precisar saber de onde cada evento veio, só o
// `tipo` já resolvido no objeto sorteado ("escolha" | "achado" |
// "teste_pericia").
function sortearEventoExploracao(dadosEventos, dadosSkillChecks) {
  const testes = (dadosSkillChecks || [])
    .filter((sc) => sc.contexto === "exploracao")
    .map((sc) => ({ ...sc, tipo: "teste_pericia" }));
  const pool = [...(dadosEventos || []), ...testes];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Algumas opções de evento (ex.: doar ouro num santuário) exigem um valor
// mínimo em caixa — a UI usa isto pra decidir se mostra o botão habilitado,
// ANTES do jogador clicar (nunca deixa clicar e falhar silenciosamente).
function opcaoDisponivel(opcao, personagem) {
  if (opcao.custoOuroMinimo && personagem.ouro < opcao.custoOuroMinimo) return false;
  return true;
}

// Aplica a consequência de uma opção de evento tipo "escolha" (ver
// explorationEvents.json). Muta `personagem` (ouro/reputação com a facção
// do território atual, se aplicável) e retorna o texto de resultado + o
// delta de ouro aplicado, pra UI mostrar como mensagem. `ok:false` sem
// mutar nada quando a opção não existe ou não está disponível (custo
// mínimo não atingido — ver opcaoDisponivel).
function aplicarEscolhaEvento(personagem, evento, opcaoId, dadosWorldState, facaoId = "vila") {
  const opcao = (evento.opcoes || []).find((o) => o.id === opcaoId);
  if (!opcao) return { ok: false };
  if (!opcaoDisponivel(opcao, personagem)) return { ok: false };
  // Opção "sorte" (ex.: "Pegadas Estranhas"/investigar): risco leve
  // resolvido por sorteio puro, não por teste de perícia — não representa
  // uma habilidade do personagem, só acaso de estar no lugar certo/errado
  // na hora certa. Nunca deixa o ouro ficar negativo.
  if (opcao.sorte) {
    const sucesso = Math.random() < (opcao.chanceSucesso ?? 0.5);
    const ouroDelta = sucesso ? (opcao.ouroSucesso || 0) : (opcao.ouroFalha || 0);
    personagem.ouro = Math.max(0, personagem.ouro + ouroDelta);
    return { ok: true, sucesso, texto: sucesso ? opcao.textoSucesso : opcao.textoFalha, ouroDelta };
  }
  const ouroDelta = opcao.ouro || 0;
  personagem.ouro = Math.max(0, personagem.ouro + ouroDelta);
  if (opcao.reputacaoFaccao) alterarReputacao(personagem, facaoId, opcao.reputacaoFaccao, dadosWorldState);
  return { ok: true, texto: opcao.textoResultado, ouroDelta };
}

// Aplica um evento tipo "achado" (ver explorationEvents.json): recompensa
// instantânea, sem escolha nenhuma — só flavor text + ouro.
function aplicarAchadoEvento(personagem, evento) {
  const ouroDelta = evento.ouro || 0;
  personagem.ouro += ouroDelta;
  return { texto: evento.textoResultado, ouroDelta };
}

// Aplica o resultado de um teste de perícia de exploração (ver
// SkillCheckSystem.js: realizarTeste — chamado por quem invoca esta
// função, não aqui, pra este módulo não duplicar a lógica de d20). Só
// concede recompensa em caso de sucesso, igual ao padrão já usado pelos
// testes de NPC/baú/coleta.
function aplicarResultadoTesteExploracao(personagem, teste, resultado) {
  let ouroDelta = 0;
  if (resultado.sucesso && teste.recompensaOuroSucesso) {
    ouroDelta = teste.recompensaOuroSucesso;
    personagem.ouro += ouroDelta;
  }
  return { texto: resultado.sucesso ? teste.textoSucesso : teste.textoFalha, ouroDelta };
}

  return { deveDispararEventoExploracao, sortearEventoExploracao, opcaoDisponivel, aplicarEscolhaEvento, aplicarAchadoEvento, aplicarResultadoTesteExploracao };
})();

const MOD_src_ui_ExplorationEventUI_js = (function(){
  const abrirModalBase = MOD_src_ui_GameUI_js.abrirModalBase;
  const fecharModal = MOD_src_ui_GameUI_js.fecharModal;
  const mostrarMensagem = MOD_src_ui_GameUI_js.mostrarMensagem;
  const realizarTeste = MOD_src_systems_SkillCheckSystem_js.realizarTeste;
  const opcaoDisponivel = MOD_src_systems_ExplorationEventSystem_js.opcaoDisponivel;
  const aplicarEscolhaEvento = MOD_src_systems_ExplorationEventSystem_js.aplicarEscolhaEvento;
  const aplicarAchadoEvento = MOD_src_systems_ExplorationEventSystem_js.aplicarAchadoEvento;
  const aplicarResultadoTesteExploracao = MOD_src_systems_ExplorationEventSystem_js.aplicarResultadoTesteExploracao;
  const registrarDecisao = MOD_src_systems_WorldStateSystem_js.registrarDecisao;
// UI dos eventos aleatórios de exploração (melhoria pós-backlog, ver
// ExplorationEventSystem.js). Segue o mesmo padrão visual/estrutural de
// mostrarAmeaca (ThreatUI.js): um modal simples com o texto do evento e
// botões de ação, fechado ao resolver — sem nenhuma tela nova, reaproveita
// o modal-overlay já usado por inventário/missões/forja/etc.





// `onFim` é chamado sempre que o evento se resolve (escolha feita, teste
// tentado, ou achado coletado) — o chamador (main.js) usa isso pra
// atualizar o HUD e retomar o salvamento automático normalmente, igual ao
// callback de mostrarAmeaca.
function mostrarEventoExploracao(evento, personagem, dados, facaoId, onFim) {
  const corpo = abrirModalBase(`${evento.icone || "❔"} ${evento.titulo}`);
  const p = document.createElement("p");
  p.textContent = evento.texto;
  corpo.appendChild(p);

  if (evento.tipo === "achado") {
    const btn = document.createElement("button");
    btn.className = "primario btn-evento-tentar";
    btn.textContent = "Recolher";
    btn.onclick = () => {
      const r = aplicarAchadoEvento(personagem, evento);
      mostrarMensagem(`${evento.icone || "❔"} ${r.texto}${r.ouroDelta ? ` (+${r.ouroDelta} ouro)` : ""}`, 4000);
      fecharModal();
      onFim();
    };
    corpo.appendChild(btn);
    return;
  }

  if (evento.tipo === "teste_pericia") {
    const infoTeste = document.createElement("p");
    infoTeste.innerHTML = `<i>🎲 ${evento.pericia} — ${evento.textoOferta}</i>`;
    corpo.appendChild(infoTeste);

    const btnTentar = document.createElement("button");
    btnTentar.className = "primario btn-evento-tentar";
    btnTentar.textContent = "Tentar";
    btnTentar.onclick = () => {
      const resultado = realizarTeste(personagem, dados, evento);
      const r = aplicarResultadoTesteExploracao(personagem, evento, resultado);
      const rolagemTxt = `[d20: ${resultado.d}${resultado.modAtributo ? ` +${resultado.modAtributo} atributo` : ""}${resultado.proficiente ? ` +${resultado.bonusPericia} perícia` : ""} = ${resultado.total} vs. DC ${resultado.dificuldade}]`;
      const icone = resultado.sucesso ? "✅" : "❌";
      mostrarMensagem(`${icone} ${r.texto} ${rolagemTxt}${r.ouroDelta ? ` (+${r.ouroDelta} ouro)` : ""}`, 4500);
      registrarDecisao(personagem, { icone: evento.icone || "🎲", titulo: evento.titulo, texto: r.texto });
      fecharModal();
      onFim();
    };
    corpo.appendChild(btnTentar);

    const btnIgnorar = document.createElement("button");
    btnIgnorar.textContent = "Deixar pra lá";
    btnIgnorar.onclick = () => { fecharModal(); onFim(); };
    corpo.appendChild(btnIgnorar);
    return;
  }

  // tipo "escolha": uma opção por botão, na ordem definida em
  // explorationEvents.json — a 1ª opção (geralmente a mais "engajada": ajudar/
  // investigar/doar) recebe a classe btn-evento-tentar, igual ao botão
  // "Tentar" do teste de perícia acima, pro modo automático (ver
  // tickAutoPlay em main.js) sempre ter uma ação preferencial a clicar em
  // vez de simplesmente fechar o modal.
  (evento.opcoes || []).forEach((opcao, idx) => {
    const disponivel = opcaoDisponivel(opcao, personagem);
    const btn = document.createElement("button");
    if (idx === 0) btn.className = "primario btn-evento-tentar";
    btn.textContent = opcao.rotulo + (opcao.custoOuroMinimo && !disponivel ? ` (precisa de ${opcao.custoOuroMinimo} ouro)` : "");
    btn.disabled = !disponivel;
    btn.onclick = () => {
      const r = aplicarEscolhaEvento(personagem, evento, opcao.id, dados.worldStateVariables, facaoId);
      if (!r.ok) return;
      const icone = r.sucesso === false ? "❌" : r.sucesso === true ? "✅" : (evento.icone || "❔");
      mostrarMensagem(`${icone} ${r.texto}${r.ouroDelta ? ` (${r.ouroDelta > 0 ? "+" : ""}${r.ouroDelta} ouro)` : ""}`, 4200);
      registrarDecisao(personagem, { icone: evento.icone || "❔", titulo: evento.titulo, texto: r.texto });
      fecharModal();
      onFim();
    };
    corpo.appendChild(btn);
  });
}

  return { mostrarEventoExploracao };
})();

const MOD_src_ui_DecisionJournalUI_js = (function(){
  const abrirModalBase = MOD_src_ui_GameUI_js.abrirModalBase;
  const decisoesRegistradas = MOD_src_systems_WorldStateSystem_js.decisoesRegistradas;
  const reputacoesParaExibir = MOD_src_systems_WorldStateSystem_js.reputacoesParaExibir;
  const facaoAfiliada = MOD_src_systems_WorldStateSystem_js.facaoAfiliada;
  const facaoInfo = MOD_src_systems_WorldStateSystem_js.facaoInfo;
// Diário de Decisões (melhoria pós-backlog): tela que reúne as escolhas
// narrativas importantes já feitas (vínculo, eventos de exploração, testes
// de perícia com NPCs, chefes derrotados, facção escolhida) e a
// consequência que elas ainda têm HOJE (reputação atual por facção) — ver
// WorldStateSystem.js: registrarDecisao/decisoesRegistradas/
// reputacoesParaExibir. Reaproveita o modal padrão (abrirModalBase), igual
// a toda outra tela secundária do jogo.



function montarDiarioDeDecisoes(personagem, dados) {
  const corpo = abrirModalBase("📖 Diário de Decisões");

  const afiliacaoId = facaoAfiliada(personagem);
  if (afiliacaoId) {
    const f = facaoInfo(afiliacaoId, dados.worldStateVariables);
    const p = document.createElement("p");
    p.innerHTML = `<b>Afiliação atual:</b> ${f ? `${f.icone || ""} ${f.nome}` : afiliacaoId}`;
    corpo.appendChild(p);
  }

  const tituloRep = document.createElement("h3");
  tituloRep.textContent = "Reputação com o mundo";
  corpo.appendChild(tituloRep);

  const reputacoes = reputacoesParaExibir(personagem, dados.worldStateVariables);
  if (!reputacoes.length) {
    const vazio = document.createElement("p");
    vazio.style.opacity = "0.7";
    vazio.textContent = "Suas ações ainda não deixaram marca em nenhuma facção.";
    corpo.appendChild(vazio);
  } else {
    const listaRep = document.createElement("div");
    listaRep.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;";
    reputacoes.forEach((r) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cssText = "flex-direction:column;align-items:flex-start;min-width:160px;";
      card.innerHTML = `<div class="nome">${r.icone} ${r.nome}</div><div class="desc">Reputação: ${r.valor > 0 ? "+" : ""}${r.valor}${r.tier ? ` (${r.tier.nome})` : ""}</div>`;
      listaRep.appendChild(card);
    });
    corpo.appendChild(listaRep);
  }

  const tituloDecisoes = document.createElement("h3");
  tituloDecisoes.textContent = "Momentos vividos";
  corpo.appendChild(tituloDecisoes);

  const decisoes = decisoesRegistradas(personagem);
  if (!decisoes.length) {
    const vazio = document.createElement("p");
    vazio.style.opacity = "0.7";
    vazio.textContent = "Nenhuma decisão marcante registrada ainda — explore o mundo, converse com NPCs e viva cenas de vínculo com seu time.";
    corpo.appendChild(vazio);
    return;
  }

  const lista = document.createElement("div");
  lista.style.cssText = "display:flex;flex-direction:column;gap:8px;";
  decisoes.forEach((d) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "flex-direction:column;align-items:flex-start;";
    card.innerHTML = `<div class="nome">${d.icone} ${d.titulo}</div><div class="desc">${d.texto}</div>`;
    lista.appendChild(card);
  });
  corpo.appendChild(lista);
}

  return { montarDiarioDeDecisoes };
})();

const MOD_src_systems_TravelingMerchantSystem_js = (function(){
// Mercador Itinerante (melhoria de jogabilidade pós-backlog original): NPC
// que aparece TEMPORARIAMENTE durante a exploração (mesmo gatilho de
// encontro aleatório dos eventos de exploração, ver
// ExplorationEventSystem.js/main.js: verificarEncontroAleatorio — chance
// independente e ainda menor, só rola quando NEM o combate NEM um evento
// de exploração dispararam no mesmo passo), vendendo um catálogo EXCLUSIVO
// de itens (src/data/travelingMerchant.json) que NUNCA aparece na loja fixa
// da vila (essa só vende comum/incomum, ver GameUI.montarLoja — todo item
// deste catálogo é raro+, então a única forma de comprá-los é topando com
// o mercador). Preço reage à reputação REGIONAL da zona onde ele aparece,
// não à reputação com a vila — reaproveita
// WorldStateSystem.multiplicadorPrecoLoja(personagem, dadosWorldState,
// facaoId), que passou a aceitar facção como parâmetro por causa desta
// melhoria. Cada aparição só oferece um SUBCONJUNTO aleatório do catálogo
// (nunca tudo de uma vez), pra dar sensação de estoque limitado — nada é
// reservado entre aparições, é só sorteado de novo a cada vez.

const TAMANHO_ESTOQUE_PADRAO = 3;

function deveAparecerMercador(chancePorPasso = 0.01) {
  return Math.random() < chancePorPasso;
}

// Sorteia `tamanho` itens distintos do catálogo completo, sem repetir —
// se o catálogo tiver menos itens que `tamanho`, devolve o catálogo
// inteiro embaralhado (nunca gera itens duplicados nem inventa itens).
function sortearEstoqueMercador(catalogo, tamanho = TAMANHO_ESTOQUE_PADRAO) {
  const embaralhado = [...(catalogo || [])];
  for (let i = embaralhado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
  }
  return embaralhado.slice(0, Math.min(tamanho, embaralhado.length));
}

  return { deveAparecerMercador, sortearEstoqueMercador };
})();

const MOD_src_ui_TravelingMerchantUI_js = (function(){
  const abrirModalBase = MOD_src_ui_GameUI_js.abrirModalBase;
  const mostrarMensagem = MOD_src_ui_GameUI_js.mostrarMensagem;
  const itemCardHTML = MOD_src_ui_GameUI_js.itemCardHTML;
  const comprarItem = MOD_src_systems_InventorySystem_js.comprarItem;
  const multiplicadorPrecoLoja = MOD_src_systems_WorldStateSystem_js.multiplicadorPrecoLoja;
  const tierDaReputacao = MOD_src_systems_WorldStateSystem_js.tierDaReputacao;
  const getReputacao = MOD_src_systems_WorldStateSystem_js.getReputacao;
// UI do Mercador Itinerante (melhoria pós-backlog, ver
// TravelingMerchantSystem.js). Reaproveita o mesmo modal/cartão de item da
// loja fixa da vila (ver GameUI.js: abrirModalBase/itemCardHTML/
// comprarItem), só muda o texto de abertura e a facção usada pro cálculo
// de desconto/sobretaxa por reputação (regional, não "vila").




// `onMudar` é chamado a cada compra (não ao fechar) — o chamador (main.js)
// usa isso pra atualizar o HUD (ouro gasto), igual ao onMudar de
// montarLoja/montarInventario. O modal continua aberto pra comprar mais de
// um item na mesma aparição, fechando só pelo botão "Fechar (Esc)" padrão.
function mostrarMercadorItinerante(estoque, personagem, dados, facaoId, onMudar) {
  const multPreco = multiplicadorPrecoLoja(personagem, dados.worldStateVariables, facaoId);
  const tierAtual = tierDaReputacao(getReputacao(personagem, facaoId), dados.worldStateVariables);
  const facaoInfo = ((dados.worldStateVariables && dados.worldStateVariables.facoes) || []).find((f) => f.id === facaoId);
  const nomeFaccao = facaoInfo ? facaoInfo.nome : facaoId;
  const tituloDesconto = multPreco !== 1 ? ` (${multPreco < 1 ? "-" : "+"}${Math.abs(Math.round((1 - multPreco) * 100))}% por reputação com ${nomeFaccao}: ${tierAtual ? tierAtual.nome : ""})` : "";
  const corpo = abrirModalBase(`🧳 Mercador Itinerante — Seu ouro: ${personagem.ouro}${tituloDesconto}`);

  const intro = document.createElement("p");
  intro.textContent = "Um mercador de passagem armou sua barraca por aqui. O estoque é curto — ele não promete voltar tão cedo, e o que não for vendido hoje vai com ele.";
  corpo.appendChild(intro);

  estoque.forEach((item) => {
    const precoFinal = Math.max(1, Math.round(item.valor * multPreco));
    const div = document.createElement("div");
    div.innerHTML = itemCardHTML(item, `<button data-id="${item.id}" class="btn-comprar-mercador">Comprar (${precoFinal}o)</button>`);
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-comprar-mercador").forEach((b) => b.onclick = () => {
    const item = estoque.find((i) => i.id === b.dataset.id);
    const r = comprarItem(personagem, item, multPreco);
    if (!r.ok) mostrarMensagem(r.msg);
    else mostrarMensagem(`Comprou: ${item.nome} (${r.preco}o)!`);
    onMudar();
    mostrarMercadorItinerante(estoque, personagem, dados, facaoId, onMudar);
  });
}

  return { mostrarMercadorItinerante };
})();

const carregarDados = MOD_src_data_loader_js.carregarDados;
const carregarTodasImagens = MOD_src_data_loader_js.carregarTodasImagens;
const SOLID_TILES = MOD_src_data_worldMap_js.SOLID_TILES;
const zonaNoPonto = MOD_src_data_worldMap_js.zonaNoPonto;
const ZONAS = MOD_src_data_worldMap_js.ZONAS;
const buildOverworld = MOD_src_data_worldMap_js.buildOverworld;
const buildDungeon = MOD_src_data_worldMap_js.buildDungeon;
const buildDungeon2 = MOD_src_data_worldMap_js.buildDungeon2;
const OVERWORLD_W = MOD_src_data_worldMap_js.OVERWORLD_W;
const OVERWORLD_H = MOD_src_data_worldMap_js.OVERWORLD_H;
const DUNGEON_W = MOD_src_data_worldMap_js.DUNGEON_W;
const DUNGEON_H = MOD_src_data_worldMap_js.DUNGEON_H;
const DUNGEON2_W = MOD_src_data_worldMap_js.DUNGEON2_W;
const DUNGEON2_H = MOD_src_data_worldMap_js.DUNGEON2_H;
const CHESTS_OVERWORLD = MOD_src_data_worldMap_js.CHESTS_OVERWORLD;
const NODES_OVERWORLD = MOD_src_data_worldMap_js.NODES_OVERWORLD;
const NPC_POSICOES = MOD_src_data_worldMap_js.NPC_POSICOES;
const DUNGEON_ENTRANCE = MOD_src_data_worldMap_js.DUNGEON_ENTRANCE;
const DUNGEON_SPAWN = MOD_src_data_worldMap_js.DUNGEON_SPAWN;
const DUNGEON_EXIT_ZONE = MOD_src_data_worldMap_js.DUNGEON_EXIT_ZONE;
const CHESTS_DUNGEON = MOD_src_data_worldMap_js.CHESTS_DUNGEON;
const BOSS_TILE = MOD_src_data_worldMap_js.BOSS_TILE;
const DUNGEON2_ENTRANCE = MOD_src_data_worldMap_js.DUNGEON2_ENTRANCE;
const DUNGEON2_SPAWN = MOD_src_data_worldMap_js.DUNGEON2_SPAWN;
const DUNGEON2_EXIT_ZONE = MOD_src_data_worldMap_js.DUNGEON2_EXIT_ZONE;
const CHESTS_DUNGEON2 = MOD_src_data_worldMap_js.CHESTS_DUNGEON2;
const BOSS_TILE2 = MOD_src_data_worldMap_js.BOSS_TILE2;
const Renderer = MOD_src_render_Renderer_js.Renderer;
const montarCriacaoPersonagem = MOD_src_ui_CharacterCreationUI_js.montarCriacaoPersonagem;
const atualizarHUD = MOD_src_ui_GameUI_js.atualizarHUD;
const mostrarMensagem = MOD_src_ui_GameUI_js.mostrarMensagem;
const montarInventario = MOD_src_ui_GameUI_js.montarInventario;
const montarMissoes = MOD_src_ui_GameUI_js.montarMissoes;
const montarForja = MOD_src_ui_GameUI_js.montarForja;
const montarDialogo = MOD_src_ui_GameUI_js.montarDialogo;
const fecharModal = MOD_src_ui_GameUI_js.fecharModal;
const montarViagemRapida = MOD_src_ui_GameUI_js.montarViagemRapida;
const iniciarBatalha = MOD_src_ui_BattleUI_js.iniciarBatalha;
const montarGacha = MOD_src_ui_GachaUI_js.montarGacha;
const montarArvoreHabilidades = MOD_src_ui_SkillTreeUI_js.montarArvoreHabilidades;
const montarCompendio = MOD_src_ui_CompendiumUI_js.montarCompendio;
const mostrarAmeaca = MOD_src_ui_ThreatUI_js.mostrarAmeaca;
const escolhaPendente = MOD_src_systems_CharacterFactory_js.escolhaPendente;
const aplicarEscolhaArvore = MOD_src_systems_CharacterFactory_js.aplicarEscolhaArvore;
const FLAGS = MOD_src_data_featureFlags_js.FLAGS;
const sortearEncontroDeLista = MOD_src_systems_EncounterSystem_js.sortearEncontroDeLista;
const deveDispararEncontro = MOD_src_systems_EncounterSystem_js.deveDispararEncontro;
const deveSerHorda = MOD_src_systems_EncounterSystem_js.deveSerHorda;
const sortearLevasHorda = MOD_src_systems_EncounterSystem_js.sortearLevasHorda;
const reforcarEmboscada = MOD_src_systems_EncounterSystem_js.reforcarEmboscada;
const sortearLoot = MOD_src_systems_InventorySystem_js.sortearLoot;
const marcarExploracao = MOD_src_systems_QuestSystem_js.marcarExploracao;
const salvarJogo = MOD_src_systems_SaveSystem_js.salvarJogo;
const carregarJogo = MOD_src_systems_SaveSystem_js.carregarJogo;
const existeSave = MOD_src_systems_SaveSystem_js.existeSave;
const iniciarLoginGoogle = MOD_src_systems_CloudSave_js.iniciarLoginGoogle;
const processarRetornoLogin = MOD_src_systems_CloudSave_js.processarRetornoLogin;
const usuarioAtual = MOD_src_systems_CloudSave_js.usuarioAtual;
const sair = MOD_src_systems_CloudSave_js.sair;
const salvarNaNuvem = MOD_src_systems_CloudSave_js.salvarNaNuvem;
const carregarDaNuvem = MOD_src_systems_CloudSave_js.carregarDaNuvem;
const estadoGachaInicial = MOD_src_systems_GachaSystem_js.estadoGachaInicial;
const membrosDoTime = MOD_src_systems_GachaSystem_js.membrosDoTime;
const adicionarFragmentos = MOD_src_systems_GachaSystem_js.adicionarFragmentos;
const checarConquistas = MOD_src_systems_GachaSystem_js.checarConquistas;
const FRAGMENTOS = MOD_src_data_economyConfig_js.FRAGMENTOS;
const testesDoContexto = MOD_src_systems_SkillCheckSystem_js.testesDoContexto;
const realizarTeste = MOD_src_systems_SkillCheckSystem_js.realizarTeste;
const autoPlayState = MOD_src_systems_AutoPlayState_js.autoPlayState;
const facaoDaZona = MOD_src_systems_WorldStateSystem_js.facaoDaZona;
const deveEmboscar = MOD_src_systems_WorldStateSystem_js.deveEmboscar;
const marcarZonaVisitada = MOD_src_systems_FastTravelSystem_js.marcarZonaVisitada;
const pontoDeChegada = MOD_src_systems_FastTravelSystem_js.pontoDeChegada;
const registrarProgressoDiario = MOD_src_systems_DailyQuestSystem_js.registrarProgressoDiario;
const elegivelParaNgPlus = MOD_src_systems_NewGamePlusSystem_js.elegivelParaNgPlus;
const aplicarNewGamePlus = MOD_src_systems_NewGamePlusSystem_js.aplicarNewGamePlus;
const climaAtualDaZona = MOD_src_systems_WeatherSystem_js.climaAtualDaZona;
const horaDoDiaAtual = MOD_src_systems_WeatherSystem_js.horaDoDiaAtual;
const montarAcessibilidade = MOD_src_ui_AccessibilityUI_js.montarAcessibilidade;
const aplicarClassesAcessibilidade = MOD_src_ui_AccessibilityUI_js.aplicarClassesAcessibilidade;
const deveDispararEventoExploracao = MOD_src_systems_ExplorationEventSystem_js.deveDispararEventoExploracao;
const sortearEventoExploracao = MOD_src_systems_ExplorationEventSystem_js.sortearEventoExploracao;
const mostrarEventoExploracao = MOD_src_ui_ExplorationEventUI_js.mostrarEventoExploracao;
const montarDiarioDeDecisoes = MOD_src_ui_DecisionJournalUI_js.montarDiarioDeDecisoes;
const deveAparecerMercador = MOD_src_systems_TravelingMerchantSystem_js.deveAparecerMercador;
const sortearEstoqueMercador = MOD_src_systems_TravelingMerchantSystem_js.sortearEstoqueMercador;
const mostrarMercadorItinerante = MOD_src_ui_TravelingMerchantUI_js.mostrarMercadorItinerante;

































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
  personagem = salvo.personagem;
  if (!personagem.gacha) personagem.gacha = estadoGachaInicial();
  if (!personagem.arvore) personagem.arvore = { escolhas: [] };
  if (!personagem.biomaVisitados) personagem.biomaVisitados = []; // viagem rápida: saves antigos sem o campo
  if (!personagem.ngPlus) personagem.ngPlus = 0; // New Game+: saves antigos sem o campo (jogo normal = NG+0)
  if (personagem.modoHistoria === undefined) personagem.modoHistoria = false; // Modo História: saves antigos sem o campo (jogo normal = desligado)
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

async function salvarProgresso({ silencioso = false } = {}) {
  const estado = estadoAtualParaSalvar();
  const okLocal = salvarJogo(estado);
  let msg = okLocal ? "Jogo salvo com sucesso!" : "Falha ao salvar localmente.";
  if (usuarioLogado) {
    const r = await salvarNaNuvem(estado);
    msg = r.ok ? "Jogo salvo (local + nuvem)!" : "Salvo localmente, mas falhou ao sincronizar com a nuvem.";
  }
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
    ZONAS.forEach((z) => {
      if (!z.chefe) return;
      const bossMonstro = dados.monsters.find((mm) => mm.id === z.chefe.monstroId);
      objetos.push({ x: z.chefe.x, y: z.chefe.y, imgKey: bossMonstro ? bossMonstro.sprite : "mob_dragao_jovem", ref: z.chefe, tipo: "chefe" });
    });
  } else {
    const masmorra = MASMORRAS[mundo.mapaAtual];
    if (masmorra) {
      (mundo[masmorra.chestsKey] || (mundo[masmorra.chestsKey] = masmorra.chests.map((c) => ({ ...c })))).forEach((c) =>
        objetos.push({ x: c.x, y: c.y, imgKey: c.aberto ? "bau_aberto" : "bau_fechado", ref: c, tipo: "bau" }));
      const bossMonstro = dados.monsters.find((mm) => mm.id === masmorra.boss.monstroId);
      objetos.push({ x: masmorra.boss.x, y: masmorra.boss.y, imgKey: bossMonstro ? bossMonstro.sprite : "mob_dragao_jovem", ref: masmorra.boss, tipo: "chefe" });
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
  } else if (e.key.toLowerCase() === "c") {
    if (podeJogarNoMundo()) onHudAction("compendio");
  } else if (e.key.toLowerCase() === "v") {
    if (podeJogarNoMundo()) onHudAction("viagem");
  } else if (e.key.toLowerCase() === "d") {
    if (podeJogarNoMundo()) onHudAction("diario");
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
function iniciarEncontroComAmeaca(monstrosDef, levasExtras = []) {
  if (!FLAGS.ameacaPreCombate) { dispararBatalha(monstrosDef, levasExtras); return; }
  const time = [personagem, ...membrosDoTime(personagem)];
  mostrarAmeaca(monstrosDef, time, dados, () => dispararBatalha(monstrosDef, levasExtras), () => mostrarMensagem("Você evitou o combate."), terrenoElementoAtual(), levasExtras.length);
}

function dispararBatalha(monstrosDef, levasExtras = []) {
  document.getElementById("hud").classList.add("hidden");
  const tela = document.getElementById("screen-batalha");
  const membrosExtras = membrosDoTime(personagem);
  const clima = climaAtual();
  iniciarBatalha(tela, imagens, dados, personagem, membrosExtras, monstrosDef, terrenoElementoAtual(), clima ? clima.elementoBonus : null, facaoAtual(), levasExtras, (resultado) => {
    document.getElementById("hud").classList.remove("hidden");
    atualizarHUD(personagem);
    if (resultado === "derrota") {
      // A aventura nunca termina: o time é resgatado e volta para a vila.
      mundo.mapaAtual = "overworld";
      mundo.player.x = 5; mundo.player.y = 5;
    }
    if (personagem.hp <= 0) personagem.hp = 1;
    if (resultado === "vitoria") autoSalvarSeAutomatico();
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
    const zonaChefe = ZONAS.find((z) => z.chefe && perto(z.chefe.x, z.chefe.y));
    if (zonaChefe) return { tipo: "chefe", ref: zonaChefe.chefe };
  } else {
    const masmorra = MASMORRAS[mundo.mapaAtual];
    if (!masmorra) return null;
    const bau = (mundo[masmorra.chestsKey] || []).find((c) => !c.aberto && perto(c.x, c.y));
    if (bau) return { tipo: "bau", ref: bau };
    if (perto(masmorra.boss.x, masmorra.boss.y)) return { tipo: "chefe", ref: masmorra.boss };
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
    iniciarEncontroComAmeaca([def]);
  }
}

function onHudAction(action) {
  if (action === "inventario") montarInventario(personagem, () => atualizarHUD(personagem));
  else if (action === "missoes") montarMissoes(personagem, dados);
  else if (action === "forja") montarForja(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "salvar") salvarProgresso();
  else if (action === "gacha") montarGacha(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "arvore") montarArvoreHabilidades(personagem, dados, () => atualizarHUD(personagem));
  else if (action === "compendio") montarCompendio(personagem, dados);
  else if (action === "viagem") abrirViagemRapida();
  else if (action === "auto") alternarModoAutomatico();
  else if (action === "acessibilidade") montarAcessibilidade();
  else if (action === "diario") montarDiarioDeDecisoes(personagem, dados);
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

function alternarModoAutomatico() {
  if (!personagem) return;
  autoPlayState.ativo = !autoPlayState.ativo;
  const btn = document.getElementById("btn-auto");
  if (btn) {
    btn.classList.toggle("ativo", autoPlayState.ativo);
    btn.textContent = autoPlayState.ativo ? "⏸ Automático" : "▶ Automático (P)";
  }
  if (autoPlayState.ativo) {
    mostrarMensagem("Modo automático ativado — a aventura continua sozinha.");
    if (!intervaloAuto) intervaloAuto = setInterval(tickAutoPlay, 380);
  } else {
    mostrarMensagem("Modo automático desativado.");
  }
}

function autoSalvarSeAutomatico() {
  if (autoPlayState.ativo && personagem) salvarProgresso({ silencioso: true });
}

function tickAutoPlay() {
  if (!autoPlayState.ativo || !personagem) return;
  const emBatalha = !document.getElementById("screen-batalha").classList.contains("hidden");
  if (emBatalha) return; // a própria batalha se resolve sozinha (ver BattleUI.js)

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

