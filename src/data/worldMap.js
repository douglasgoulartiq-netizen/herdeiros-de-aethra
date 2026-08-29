// Define os mapas do mundo aberto e da masmorra, além dos objetos posicionados neles.
export const TILE = {
  GRASS: 0, GRASS_DETAIL: 1, PATH: 2, WATER: 3, TREE: 4, WALL: 5,
  DUNGEON_FLOOR: 6, DUNGEON_WALL: 7, SAND: 8, TALL_GRASS: 9, VILLAGE_FLOOR: 10, BUSH: 11,
};
export const TILE_SIZE = 64;
export const SOLID_TILES = new Set([TILE.TREE, TILE.WALL, TILE.WATER, TILE.DUNGEON_WALL, TILE.BUSH]);

// Mapa legado tile -> nome de bioma, usado pelo sistema de encontro aleatório
// original (baseado só no tile pisado). Mantido por compatibilidade; o novo
// sistema de zonas (ZONAS / zonaNoPonto) é a fonte de verdade recomendada
// para escolher o pool de monstros por região.
export const ENCOUNTER_BIOMA = {
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
export const OVERWORLD_W = 106;
export const OVERWORLD_H = 72;

// Limites das colunas/linhas da grade de regiões (geometria, não exportado).
const COL_X = [0, 16, 34, 52, 70, 88, 106];
const ROW_Y = [0, 22, 40, 58, 72];
const ROW_COLS = [6, 6, 6, 4]; // quantas colunas existem em cada linha

export const ZONAS = [
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
export function zonaNoPonto(x, y) {
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

export function buildOverworld() {
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

export const DUNGEON_W = 18;
export const DUNGEON_H = 12;

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

export function buildDungeon() {
  return buildMasmorraRamificada(DUNGEON_W, DUNGEON_H, [
    DUNGEON_SPAWN,
    ...CHESTS_DUNGEON.map(({ x, y }) => ({ x, y })),
    BOSS_TILE,
    { x: DUNGEON_EXIT_ZONE.x0, y: DUNGEON_EXIT_ZONE.y0 },
  ]);
}

// --- Segunda masmorra: Covil das Cinzas (sob a zona "covil_do_dragao") ---
export const DUNGEON2_W = 16;
export const DUNGEON2_H = 10;

export function buildDungeon2() {
  return buildMasmorraRamificada(DUNGEON2_W, DUNGEON2_H, [
    DUNGEON2_SPAWN,
    ...CHESTS_DUNGEON2.map(({ x, y }) => ({ x, y })),
    BOSS_TILE2,
    { x: DUNGEON2_EXIT_ZONE.x0, y: DUNGEON2_EXIT_ZONE.y0 },
  ]);
}

// --- Objetos do mundo aberto ---
export const CHESTS_OVERWORLD = [
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

export const NODES_OVERWORLD = [
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

export const NPC_POSICOES = {
  npc_fazendeiro: { x: 4, y: 4 },
  npc_cacador: { x: 10, y: 9 },
  npc_anciao: { x: 3, y: 11 },
  npc_guarda: { x: 13, y: 3 },
  npc_mercador: { x: 8, y: 11 },
};

export const DUNGEON_ENTRANCE = { x: 31, y: 16 };
export const DUNGEON_SPAWN = { x: 4, y: 6 };
export const DUNGEON_EXIT_ZONE = { x0: 1, y0: 1, x1: 1, y1: 1 };

export const CHESTS_DUNGEON = [
  { id: "bau_dungeon1", x: 14, y: 8, tier: "bau_epico", aberto: false },
  // Baú secreto: fica escondido numa das ramificações do labirinto (a
  // posição exata do desvio muda a cada visita, já que a masmorra é
  // reconstruída sempre que o jogador entra) — recompensa quem explora além
  // da rota direta até o chefe.
  { id: "bau_dungeon1_secreto", x: 3, y: 9, tier: "bau_epico", aberto: false },
];

export const BOSS_TILE = { x: 15, y: 2, monstroId: "dragao_jovem" };

// Segunda masmorra (Covil das Cinzas), sob a zona "covil_do_dragao".
export const DUNGEON2_ENTRANCE = { x: 44, y: 68 };
export const DUNGEON2_SPAWN = { x: 2, y: 5 };
export const DUNGEON2_EXIT_ZONE = { x0: 1, y0: 1, x1: 1, y1: 1 };

export const CHESTS_DUNGEON2 = [
  { id: "bau_dungeon2_1", x: 12, y: 6, tier: "bau_lendario", aberto: false },
  // Baú secreto numa ramificação do labirinto — mesma ideia do da primeira
  // masmorra.
  { id: "bau_dungeon2_secreto", x: 3, y: 7, tier: "bau_epico", aberto: false },
];

export const BOSS_TILE2 = { x: 13, y: 2, monstroId: "arauto_das_cinzas" };
