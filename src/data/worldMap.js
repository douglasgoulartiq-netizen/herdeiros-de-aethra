// Define os mapas do mundo aberto e da masmorra, além dos objetos posicionados neles.
//
// GERAÇÃO DETERMINÍSTICA (ETAPA 1, task #34): tudo aqui é função da semente
// do mundo. `buildOverworld(semente)` chamada duas vezes com a mesma semente
// devolve grades idênticas tile por tile, e cada gerador tem seu próprio
// fluxo de aleatoriedade (ver WorldSeed.js), então mexer no mundo aberto não
// muda o labirinto das masmorras. Nenhuma função deste arquivo chama
// `Math.random()`.
import { prngDe, embaralhar, SEMENTE_LEGADO } from "../systems/WorldSeed.js";
import {
  resumoDasZonas, zonaIndiceNoPonto, fronteirasDasZonas,
} from "./world/WorldLayout.js";
import { MASMORRAS_MUNDO } from "./world/settlements.js";
import { CODEX_MAP_W, CODEX_MAP_H } from "./world/codexGeography.js";

export const TILE = {
  GRASS: 0, GRASS_DETAIL: 1, PATH: 2, WATER: 3, TREE: 4, WALL: 5,
  DUNGEON_FLOOR: 6, DUNGEON_WALL: 7, SAND: 8, TALL_GRASS: 9, VILLAGE_FLOOR: 10, BUSH: 11,
  // --- Paleta estendida (ETAPA 2) ------------------------------------------
  // As doze primeiras são a arte que o projeto já tinha, e continuam com
  // exatamente os mesmos índices — nenhum save, nenhuma zona e nenhum sprite
  // muda de significado.
  //
  // As doze seguintes existem porque a ETAPA 2 pede que cada macro-região
  // seja reconhecível SEM LER O NOME, e com doze tiles isso não fecha:
  // Morranvell e Altaverde acabariam sendo a mesma grama com outra densidade
  // de árvore. Elas moram numa folha SEPARADA (assets/tiles/tileset_extra.png)
  // justamente pra não sobrescrever a arte do jogador: quem não copiar o
  // arquivo novo continua jogando, e cada tile novo cai no equivalente antigo
  // mais próximo (ver TILE_FALLBACK e o Renderer).
  SNOW: 12,        // Morranvell — neve firme, pisável
  ICE: 13,         // lago congelado; pisável, mas é gelo
  LAVA: 14,        // Vulkor — sólido: encostar não é uma mecânica deste jogo
  ASH: 15,         // chão de cinzas e basalto
  MARSH: 16,       // Thalgor — lama pisável (a água parada continua WATER)
  COBBLE: 17,      // calçada de cidade
  BRIDGE: 18,      // tabuleiro de ponte sobre água
  FARM: 19,        // lavoura ao redor de cidade
  BUILDING: 20,    // parede de construção — sólido
  CRYSTAL: 21,     // Ruínas de Aethra / anomalia do Véu — sólido
  DEEP_WATER: 22,  // mar aberto — sólido, é o limite do mundo
  BONE: 23,        // Vale dos Titãs — osso de Titã aflorando
};
export const TILE_SIZE = 64;
// Quantos tiles existem na folha original. Índice >= este número vem da folha
// estendida, no offset (indice - TILES_BASE).
export const TILES_BASE = 12;
export const TILES_TOTAL = 24;

// Para quem não tiver a folha estendida: o tile antigo mais parecido. Nunca é
// usado pela lógica — só pelo desenho, e só quando a arte nova falta.
export const TILE_FALLBACK = {
  [TILE.SNOW]: TILE.GRASS_DETAIL,
  [TILE.ICE]: TILE.WATER,
  [TILE.LAVA]: TILE.WALL,
  [TILE.ASH]: TILE.SAND,
  [TILE.MARSH]: TILE.TALL_GRASS,
  [TILE.COBBLE]: TILE.VILLAGE_FLOOR,
  [TILE.BRIDGE]: TILE.PATH,
  [TILE.FARM]: TILE.GRASS_DETAIL,
  [TILE.BUILDING]: TILE.WALL,
  [TILE.CRYSTAL]: TILE.WALL,
  [TILE.DEEP_WATER]: TILE.WATER,
  [TILE.BONE]: TILE.SAND,
};

export const SOLID_TILES = new Set([
  // Água rasa pode ser explorada a pé; DEEP_WATER continua sendo o limite.
  // Isso preserva o papel das praias como transição e permite realmente
  // entrar no mar sem deixar o jogador atravessar o oceano inteiro.
  TILE.TREE, TILE.WALL, TILE.DUNGEON_WALL, TILE.BUSH,
  TILE.LAVA, TILE.BUILDING, TILE.CRYSTAL, TILE.DEEP_WATER,
]);

// Tiles que são ÁGUA para efeito de travessia: é onde uma ponte precisa
// existir para uma estrada passar. ICE não entra — gelo já se atravessa a pé,
// e é por isso que ele existe como tile separado.
export const TILES_AGUA = new Set([TILE.WATER, TILE.DEEP_WATER]);

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

// `rnd` é obrigatório: é o fluxo semeado do mapa que está sendo construído.
// A varredura é sempre na mesma ordem (linha a linha, coluna a coluna) e
// consome exatamente um número por tile candidato — é isso que faz duas
// gerações com a mesma semente coincidirem tile por tile.
function scatter(g, x0, y0, x1, y1, tile, density, avoid, rnd) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!g[y] || g[y][x] === undefined) continue;
    if (avoid && avoid.has(g[y][x])) continue;
    if (rnd() < density) g[y][x] = tile;
  }
}


// ---------------------------------------------------------------------------
// O MUNDO (ETAPA 2)
// ---------------------------------------------------------------------------
// O mundo cresceu de 106x72 (7.632 tiles) para 224x176 (39.424). Não é
// tamanho por tamanho: com 22 zonas espremidas em 7.632 tiles, o item 21 do
// pedido ("não amontoar caverna + cidade + chefe + baú + templo em 20
// segundos de caminhada") era impossível de cumprir — não havia distância
// disponível —, e uma capital com distritos não caberia: a Vila inteira
// ocupava 16x14 tiles.
export const OVERWORLD_W = CODEX_MAP_W;
export const OVERWORLD_H = CODEX_MAP_H;

// Onde o jogador nasce. Ajustado pelo gerador para a praça da Vila de Aethra
// assim que o mundo é construído (ver WorldBuilder.js) — o valor abaixo é só
// o ponto de partida da busca.
export const OVERWORLD_SPAWN = { x: 92, y: 92 };

// ZONAS — a lista que o resto do jogo consome desde sempre.
//
// O CONTEÚDO continua sendo o mesmo tipo de objeto (id, nome, monstros,
// elementoDominante, descrição, caixa delimitadora), mas a ORIGEM mudou: em
// vez de quatro números escritos à mão numa grade 6x4, cada zona agora é um
// território orgânico calculado a partir de centro, peso e forma (ver
// src/data/world/WorldLayout.js). A caixa x0/y0/x1/y1 deixou de DEFINIR a
// zona e passou a ser um RESUMO dela, medido do território real — ela ainda
// existe porque a câmera do Atlas e a viagem rápida querem um retângulo.
//
// `nivelSugerido` foi preenchido com a faixa de perigo declarada em
// zones.js: o campo existia desde a ETAPA 1 e nunca era lido; agora ao menos
// diz a verdade.
export const ZONAS = resumoDasZonas(OVERWORLD_W, OVERWORLD_H).map((z) => ({
  ...z,
  nivelSugerido: z.perigo,
  monstros: z.monstros || [],
  pontosDeInteresse: [],
}));

const ZONA_POR_INDICE = ZONAS;

// Zona que contém o ponto — agora pela POSSE real do tile, não pela caixa.
// A diferença importa: com territórios orgânicos, duas caixas se sobrepõem, e
// responder pela caixa daria a zona errada perto de toda fronteira.
export function zonaNoPonto(x, y) {
  const i = zonaIndiceNoPonto(x, y, OVERWORLD_W, OVERWORLD_H);
  return i < 0 ? null : ZONA_POR_INDICE[i];
}

export const zonaPorId = (id) => ZONAS.find((z) => z.id === id) || null;

// Vizinhança real entre zonas, medida na fronteira do mapa de posse.
export function vizinhasDaZonaMundo(zonaId) {
  return (fronteirasDasZonas(OVERWORLD_W, OVERWORLD_H).get(zonaId) || []).map((v) => v.id);
}

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
function buildMasmorraRamificada(w, h, pontosDeInteresse, rnd) {
  const g = grid(w, h, TILE.DUNGEON_WALL);
  const cellCols = Math.max(1, Math.floor((w - 2) / 2) + 1);
  const cellRows = Math.max(1, Math.floor((h - 2) / 2) + 1);
  const cellX = (cx) => 1 + cx * 2;
  const cellY = (cy) => 1 + cy * 2;
  const visitado = grid(cellCols, cellRows, false);

  function carve(cx, cy) {
    visitado[cy][cx] = true;
    g[cellY(cy)][cellX(cx)] = TILE.DUNGEON_FLOOR;
    // Fisher-Yates semeado. Antes era `.sort(() => Math.random() - 0.5)`,
    // que além de não ser semeável é enviesado: o comparador é inconsistente
    // e o resultado depende do algoritmo de ordenação do motor.
    const direcoes = embaralhar([[0, -1], [0, 1], [-1, 0], [1, 0]], rnd);
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

export function buildDungeon(semente = SEMENTE_LEGADO) {
  return buildMasmorraRamificada(DUNGEON_W, DUNGEON_H, [
    DUNGEON_SPAWN,
    ...CHESTS_DUNGEON.map(({ x, y }) => ({ x, y })),
    BOSS_TILE,
    { x: DUNGEON_EXIT_ZONE.x0, y: DUNGEON_EXIT_ZONE.y0 },
  ], prngDe(semente, "dungeon1"));
}

// --- Segunda masmorra: Covil das Cinzas (sob a zona "covil_do_dragao") ---

export function buildDungeon2(semente = SEMENTE_LEGADO) {
  return buildMasmorraRamificada(DUNGEON2_W, DUNGEON2_H, [
    DUNGEON2_SPAWN,
    ...CHESTS_DUNGEON2.map(({ x, y }) => ({ x, y })),
    BOSS_TILE2,
    { x: DUNGEON2_EXIT_ZONE.x0, y: DUNGEON2_EXIT_ZONE.y0 },
  ], prngDe(semente, "dungeon2"));
}


// ---------------------------------------------------------------------------
// MASMORRAS — o interior
// ---------------------------------------------------------------------------
// As medidas e o conteúdo agora vêm de src/data/world/settlements.js
// (MASMORRAS_MUNDO), pra não existirem dois lugares dizendo qual é o tamanho
// do Covil das Cinzas. A BOCA de cada uma fica no mundo aberto e é escolhida
// pelo gerador dentro da zona declarada — nunca num tile solto.
const DEF1 = MASMORRAS_MUNDO[0];
const DEF2 = MASMORRAS_MUNDO[1];

export const DUNGEON_W = DEF1.largura;
export const DUNGEON_H = DEF1.altura;
export const DUNGEON2_W = DEF2.largura;
export const DUNGEON2_H = DEF2.altura;

export const DUNGEON_SPAWN = { x: 3, y: 3 };
export const DUNGEON_EXIT_ZONE = { x0: 1, y0: 1, x1: 1, y1: 1 };
export const CHESTS_DUNGEON = [
  { id: "bau_dungeon1", x: DUNGEON_W - 5, y: DUNGEON_H - 4, tier: "bau_epico", aberto: false },
  // Baú secreto numa das ramificações do labirinto — a posição do desvio muda
  // a cada semente, então quem explora além da rota direta é recompensado.
  { id: "bau_dungeon1_secreto", x: 3, y: DUNGEON_H - 3, tier: "bau_epico", aberto: false },
];
export const BOSS_TILE = { x: DUNGEON_W - 3, y: 2, monstroId: DEF1.chefe };

export const DUNGEON2_SPAWN = { x: 2, y: 3 };
export const DUNGEON2_EXIT_ZONE = { x0: 1, y0: 1, x1: 1, y1: 1 };
export const CHESTS_DUNGEON2 = [
  { id: "bau_dungeon2_1", x: DUNGEON2_W - 4, y: DUNGEON2_H - 4, tier: "bau_lendario", aberto: false },
  { id: "bau_dungeon2_secreto", x: 3, y: DUNGEON2_H - 3, tier: "bau_epico", aberto: false },
];
export const BOSS_TILE2 = { x: DUNGEON2_W - 3, y: 2, monstroId: DEF2.chefe };
