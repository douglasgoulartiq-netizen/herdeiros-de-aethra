// Transição entre terrenos: tira o degrau de 90 graus da fronteira.
//
// O PROBLEMA
// ----------
// Cada tile é pintado inteiro de um terreno só. A fronteira entre grama e
// areia era, literalmente, a borda do quadrado — uma escada perfeita de 90
// graus atravessando o mapa. Na captura da costa é o que mais denuncia "mapa
// gerado", mais até que a densidade da vegetação: praia de verdade não tem
// quina.
//
// A CORREÇÃO, E O QUE ELA NÃO TOCA
// --------------------------------
// Nada muda no grid. O tile continua sendo o mesmo índice, a colisão continua
// vindo de SOLID_TILES, nenhum save é migrado, nenhuma zona muda de forma. O
// que muda é só o DESENHO: quando um vizinho é de terreno com PRIORIDADE
// maior, a textura dele é composta sobre a borda deste tile, recortada por uma
// das máscaras de assets/tiles/mascaras.png.
//
// O QUE É GUARDADO, E POR QUE NÃO É O TILE INTEIRO
// ------------------------------------------------
// A primeira versão guardava o TILE COMPOSTO, com a chave sendo a combinação
// "tile do meio + quais vizinhos invadem + de quais terrenos". Parecia ótimo:
// um drawImage por tile, igual a antes. Medindo o mundo inteiro, porém, deram
// 5.016 combinações distintas — o dobro do teto que eu tinha posto. Passado o
// teto, os tiles excedentes voltariam a ser desenhados lisos, e a costa
// readquiria a quina justamente nas regiões visitadas por último. Um cache que
// só funciona no começo da partida não é um cache, é uma armadilha.
//
// Agora o que se guarda é a PEÇA DE FRANJA: uma direção, um terreno, uma
// variante. O espaço é o produto de três números pequenos (8 x 24 x 3), então
// é limitado por construção — e no mundo real fica em algumas dezenas. O preço
// é desenhar de uma a três imagens a mais nos tiles de FRONTEIRA, que são um
// terço do mapa e uma fração da tela. Medido: 60 quadros por segundo na vila,
// na costa, na mata fechada e na capital, iguais aos de antes da mistura.
import { TILE, TILE_SIZE } from "../data/worldMap.js";

// Quem avança sobre quem. Número maior = desenhado por cima.
//
// A ordem não é estética, é física: a água é o fundo do vale e nada avança
// para dentro dela por baixo; a areia é o que a água deposita na margem, e por
// isso avança sobre a água; a vegetação avança sobre a areia; e o que o homem
// construiu — caminho, calçada, lavoura — avança sobre a vegetação, porque foi
// aberto em cima dela.
const PRIORIDADE = {
  [TILE.DEEP_WATER]: 0,
  [TILE.WATER]: 1,
  [TILE.ICE]: 2,
  [TILE.LAVA]: 2,
  [TILE.MARSH]: 3,
  [TILE.SAND]: 4,
  [TILE.BONE]: 5,
  [TILE.ASH]: 5,
  [TILE.SNOW]: 6,
  [TILE.GRASS]: 7,
  [TILE.TREE]: 7,          // o chão sob a árvore é grama; o prop vem por cima
  [TILE.BUSH]: 7,
  [TILE.GRASS_DETAIL]: 8,
  [TILE.TALL_GRASS]: 8,
  [TILE.WALL]: 9,          // afloramento de pedra
  [TILE.CRYSTAL]: 9,
  [TILE.FARM]: 10,
  [TILE.PATH]: 11,
  [TILE.BRIDGE]: 12,
  [TILE.COBBLE]: 13,
  [TILE.VILLAGE_FLOOR]: 13,
  [TILE.BUILDING]: 14,
};

// Masmorra fica de fora de propósito: ali a parede é alvenaria e o encontro
// com o piso é uma quina de verdade. Suavizar seria errado, não bonito.
const FORA = new Set([TILE.DUNGEON_FLOOR, TILE.DUNGEON_WALL]);

// Ordem das máscaras na folha. NÃO reordenar: é o índice da coluna.
const DIRECOES = ["N", "S", "L", "O", "NE", "NO", "SE", "SO"];
const COLUNA = Object.fromEntries(DIRECOES.map((d, i) => [d, i]));

// Variantes: uma LINHA da folha por variante (ver gerar-mascaras.py). Com uma
// máscara só por direção, uma costa de trinta tiles repetia a MESMA onda
// trinta vezes — o degrau de 90 graus virava um pente regular, que denuncia a
// grade do mesmo jeito. A variante sai de um hash de (x, y) e é sorteada uma
// vez por TILE, valendo para as oito direções dele.
export const VARIANTES = 3;
export function varianteDoTile(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) % VARIANTES;
}

// Deslocamento de cada direção, e — para as diagonais — as duas laterais que a
// tornam redundante.
const VIZINHOS = [
  { dir: "N", dx: 0, dy: -1, diagonal: false },
  { dir: "S", dx: 0, dy: 1, diagonal: false },
  { dir: "L", dx: 1, dy: 0, diagonal: false },
  { dir: "O", dx: -1, dy: 0, diagonal: false },
  { dir: "NE", dx: 1, dy: -1, diagonal: true, lados: ["N", "L"] },
  { dir: "NO", dx: -1, dy: -1, diagonal: true, lados: ["N", "O"] },
  { dir: "SE", dx: 1, dy: 1, diagonal: true, lados: ["S", "L"] },
  { dir: "SO", dx: -1, dy: 1, diagonal: true, lados: ["S", "O"] },
];

export function prioridadeDoTile(tile) {
  const p = PRIORIDADE[tile];
  return p === undefined ? 7 : p;
}

// Quais vizinhos invadem este tile, e de que terreno.
//
// Devolve null quando não há transição — o caso da esmagadora maioria dos
// tiles, e o que mantém o custo baixo. `saida` é um array reaproveitado por
// quem chama: esta função roda para cada tile visível a cada quadro, e alocar
// aqui seria lixo para o coletor sessenta vezes por segundo.
export function invasoresDoTile(grid, x, y, saida = []) {
  saida.length = 0;
  const base = grid[y][x];
  if (FORA.has(base)) return null;
  const pBase = prioridadeDoTile(base);

  for (let i = 0; i < VIZINHOS.length; i += 1) {
    const v = VIZINHOS[i];
    const linha = grid[y + v.dy];
    if (!linha) continue;
    const viz = linha[x + v.dx];
    if (viz === undefined || viz === base) continue;
    if (FORA.has(viz)) continue;
    if (prioridadeDoTile(viz) <= pBase) continue;
    // Diagonal só entra quando NENHUMA das duas laterais já traz o mesmo
    // terreno: se traz, a lateral já cobriu aquele canto e a diagonal só
    // engrossaria a franja. Sem esta regra o encontro de três terrenos ganha
    // um caroço na quina. Como as quatro laterais são testadas primeiro (é a
    // ordem de VIZINHOS), a esta altura `saida` já as contém.
    if (v.diagonal) {
      let coberto = false;
      for (let k = 0; k < saida.length; k += 1) {
        if (saida[k].tile === viz && v.lados.indexOf(saida[k].dir) >= 0) { coberto = true; break; }
      }
      if (coberto) continue;
    }
    saida.push({ dir: v.dir, tile: viz });
  }
  if (!saida.length) return null;
  // Prioridade crescente: o terreno mais "de cima" é composto por último.
  saida.sort((a, b) => prioridadeDoTile(a.tile) - prioridadeDoTile(b.tile));
  return saida;
}

export class MisturaDeTerreno {
  // `recorte(tile)` devolve { folha, coluna } — é o mesmo folhaDoTile() do
  // Renderer, injetado para não duplicar a lógica de folha estendida e de
  // fallback de tile ausente.
  constructor(mascaras, recorte) {
    this.mascaras = mascaras;
    this.recorte = recorte;
    this.pecas = new Map();
    this.rascunho = null;
    this.scratch = [];
    // Se a folha de máscaras faltar (implantação antiga sem o arquivo),
    // carregarImagem devolve um placeholder de 32px: a mistura simplesmente
    // não liga e a fronteira volta a ser dura — exatamente como era antes.
    this.ativa = !!(mascaras
      && mascaras.width >= DIRECOES.length * TILE_SIZE
      && mascaras.height >= VARIANTES * TILE_SIZE);
  }

  // Peça de franja: a textura de um terreno recortada por uma máscara.
  // Guardada por (direção, terreno, variante) — no máximo 8 x 24 x 3 peças,
  // limite que existe por construção e não por um teto escolhido à mão.
  peca(dir, tile, variante) {
    const chave = `${dir}|${tile}|${variante}`;
    const guardada = this.pecas.get(chave);
    if (guardada !== undefined) return guardada;

    const arte = this.recorte(tile);
    let tela = null;
    if (arte && arte.folha && typeof document !== "undefined") {
      const T = TILE_SIZE;
      tela = document.createElement("canvas");
      tela.width = T;
      tela.height = T;
      const g = tela.getContext("2d");
      g.imageSmoothingEnabled = false;
      // Recorte por máscara: desenha a forma e troca para "source-in", que
      // faz a textura aparecer só onde a máscara é opaca. É a razão de UMA
      // máscara servir para qualquer par de terrenos — quem dá a cor é sempre
      // a textura real do vizinho, não uma cor escrita à mão.
      g.drawImage(this.mascaras, COLUNA[dir] * T, variante * T, T, T, 0, 0, T, T);
      g.globalCompositeOperation = "source-in";
      g.drawImage(arte.folha, arte.coluna * T, 0, T, T, 0, 0, T, T);
    }
    this.pecas.set(chave, tela);
    return tela;
  }

  // Desenha as franjas sobre o tile que o Renderer já pintou. Não desenha
  // nada — e não custa nada — nos tiles de miolo.
  desenharFranjas(ctx, grid, x, y, dx, dy, T) {
    if (!this.ativa) return 0;
    const invasores = invasoresDoTile(grid, x, y, this.scratch);
    if (!invasores) return 0;
    const variante = varianteDoTile(x, y);
    let desenhadas = 0;
    for (let i = 0; i < invasores.length; i += 1) {
      const p = this.peca(invasores[i].dir, invasores[i].tile, variante);
      if (!p) continue;
      ctx.drawImage(p, 0, 0, TILE_SIZE, TILE_SIZE, dx, dy, T, T);
      desenhadas += 1;
    }
    return desenhadas;
  }

  // Diagnóstico: quantas peças distintas o mundo pediu até agora.
  estatisticas() {
    return { ativa: this.ativa, pecas: this.pecas.size };
  }
}
