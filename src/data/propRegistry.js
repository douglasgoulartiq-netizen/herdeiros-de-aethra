// Props: os objetos de cenário que NÃO cabem num tile.
//
// O PROBLEMA QUE ISTO RESOLVE
// ---------------------------
// Até aqui tudo no mapa tinha 1 tile — a árvore, a casa, a rocha e o
// personagem ocupavam exatamente o mesmo quadrado. É por isso que o mapa não
// lia como um mundo: uma "cidade" era um bloco de quadradinhos do tamanho do
// herói, e uma "floresta" era o mesmo quadradinho verde repetido. Nada tinha
// escala.
//
// A separação que o sistema faz é esta, e é a ideia inteira do arquivo:
//
//   COLISÃO   fica no GRID DE TILES, exatamente como sempre esteve.
//             TILE.TREE continua sendo um tile sólido de 1x1 — o TRONCO.
//             Nenhum save muda, nenhuma zona muda, nenhum caminho existente
//             deixa de funcionar.
//
//   VISUAL    vem daqui. Sobre aquele mesmo tile o Renderer desenha um PROP
//             de 3x4 tiles, ancorado na base. A copa avança por cima dos
//             tiles vizinhos (que continuam andáveis) e o jogador passa POR
//             TRÁS dela — é o y-sort do Renderer que resolve quem cobre quem.
//
// Ou seja: a árvore vira 3-5x o personagem sem que uma única colisão mude.
//
// DENSIDADE
// ---------
// Se cada tile de floresta virasse uma árvore de 4x5, uma mata de 10x10 seria
// 100 copas sobrepostas — caro de desenhar e ilegível. Então nem todo tile de
// árvore recebe prop: um hash determinístico de (x,y) escolhe quais recebem, e
// como cada copa cobre 2-4 tiles, a mata fecha mesmo assim. O hash é puro, sem
// Math.random(), então o mesmo mundo desenha igual em qualquer máquina e em
// qualquer recarregamento — a mesma regra que vale para a geração do mundo.
import { TILE } from "./worldMap.js";

// Espelho de assets/props/manifesto.json. Mora aqui em vez de ser buscado por
// fetch porque é metadado de ARTE (muda junto com o PNG, no mesmo commit) e
// porque o Renderer precisa dele no primeiro quadro, sem esperar rede.
//
//   larguraTiles/alturaTiles  tamanho do prop em tiles
//   ancoraX/ancoraY           qual tile DENTRO do prop fica em cima do tile
//                             de origem (a base do tronco, a soleira da porta)
//   colisao                   retângulo de tiles, RELATIVO à âncora, que a
//                             coisa realmente ocupa no chão. MEDIDO DA ARTE
//                             pelo gerador (medir_colisao em gerar-props.py):
//                             é a parede, não o telhado; é o tronco, não a
//                             copa. Uma casa de arte 6x6 tem colisão 6x2,
//                             uma árvore de 4x5 tem colisão 1x1.
export const PROPS = {
  arvore_p:    { larguraTiles: 2, alturaTiles: 3, ancoraX: 1, ancoraY: 2, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  arvore_m:    { larguraTiles: 3, alturaTiles: 4, ancoraX: 1, ancoraY: 3, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  arvore_g:    { larguraTiles: 4, alturaTiles: 5, ancoraX: 2, ancoraY: 4, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  pinheiro:    { larguraTiles: 2, alturaTiles: 4, ancoraX: 1, ancoraY: 3, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  arbusto:     { larguraTiles: 1, alturaTiles: 2, ancoraX: 0, ancoraY: 1, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  rocha_p:     { larguraTiles: 1, alturaTiles: 1, ancoraX: 0, ancoraY: 0, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  rocha_g:     { larguraTiles: 2, alturaTiles: 2, ancoraX: 1, ancoraY: 1, colisao: { x0: -1, y0: 0, x1: 0, y1: 0 } },
  penhasco:    { larguraTiles: 2, alturaTiles: 2, ancoraX: 1, ancoraY: 1, colisao: { x0: -1, y0: 0, x1: 0, y1: 0 } },
  casa_p:      { larguraTiles: 4, alturaTiles: 4, ancoraX: 2, ancoraY: 3, colisao: { x0: -2, y0: -1, x1: 1, y1: 0 } },
  casa_g:      { larguraTiles: 6, alturaTiles: 6, ancoraX: 3, ancoraY: 5, colisao: { x0: -3, y0: -1, x1: 2, y1: 0 } },
  casa_elfica: { larguraTiles: 5, alturaTiles: 5, ancoraX: 2, ancoraY: 4, colisao: { x0: -2, y0: -1, x1: 2, y1: 0 } },
  templo:      { larguraTiles: 8, alturaTiles: 7, ancoraX: 4, ancoraY: 6, colisao: { x0: -4, y0: -2, x1: 3, y1: 0 } },
  poste:       { larguraTiles: 1, alturaTiles: 2, ancoraX: 0, ancoraY: 1, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  placa:       { larguraTiles: 1, alturaTiles: 2, ancoraX: 0, ancoraY: 1, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  cerca:       { larguraTiles: 1, alturaTiles: 1, ancoraX: 0, ancoraY: 0, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  ponte:       { larguraTiles: 1, alturaTiles: 1, ancoraX: 0, ancoraY: 0, colisao: { x0: 0, y0: 0, x1: 0, y1: 0 } },
};

// Tiles que um prop POSICIONADO À MÃO ocupa no chão. Quem constrói uma cidade
// usa isto para pintar a colisão embaixo da casa: a arte fica no props, a
// parede fica no grid, e o jogador continua batendo em tile — exatamente como
// batia antes de props existirem. Nenhum sistema de colisão novo.
export function tilesDeColisao(prop) {
  const meta = PROPS[prop.id];
  if (!meta) return [];
  const { x0, y0, x1, y1 } = meta.colisao;
  const tiles = [];
  for (let dy = y0; dy <= y1; dy += 1) {
    for (let dx = x0; dx <= x1; dx += 1) tiles.push({ x: prop.x + dx, y: prop.y + dy });
  }
  return tiles;
}

export const IDS_DE_PROP = Object.keys(PROPS);

// Hash inteiro de 32 bits de (x, y, sal). Determinístico e barato: é chamado
// uma vez por tile visível, a cada quadro. Sem estado, sem alocação.
export function hashProp(x, y, sal = 0) {
  let h = (x * 374761393 + y * 668265263 + sal * 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// Sorteia um item de uma tabela de pesos usando o hash. `tabela` é
// [[id, peso], ...]; a soma dos pesos não precisa ser 100.
function porPeso(tabela, h) {
  let total = 0;
  for (const [, peso] of tabela) total += peso;
  let alvo = h % total;
  for (const [id, peso] of tabela) {
    alvo -= peso;
    if (alvo < 0) return id;
  }
  return tabela[0][0];
}

// Quantos por cento dos tiles de cada tipo viram prop desenhado. O resto do
// tile continua sólido (colisão) mas fica coberto pelas copas vizinhas.
const DENSIDADE = {
  [TILE.TREE]: 62,
  [TILE.BUSH]: 78,
  [TILE.WALL]: 70,
};

// Variantes por tile. Floresta é misturada de propósito: três tamanhos de
// árvore mais o pinheiro dão silhueta irregular, que é o oposto de "grama
// verde + a mesma árvore repetida".
const VARIANTES = {
  [TILE.TREE]: [["arvore_m", 38], ["arvore_p", 30], ["arvore_g", 22], ["pinheiro", 10]],
  [TILE.BUSH]: [["arbusto", 100]],
  [TILE.WALL]: [["rocha_g", 40], ["rocha_p", 34], ["penhasco", 26]],
};

// Temas de região: a MESMA floresta muda de cara conforme onde está, sem
// precisar de tile novo. Usado a partir do PASS 3 (Altaverde) — quem não
// passa tema nenhum continua no comportamento padrão.
export const TEMAS = {
  // Altaverde: mata fechada e frondosa, quase sem conífera.
  bosque:   { [TILE.TREE]: [["arvore_g", 40], ["arvore_m", 38], ["arvore_p", 20], ["pinheiro", 2]] },
  // Morranvell: encosta fria, pinheiro dominante e árvore pequena.
  montanha: { [TILE.TREE]: [["pinheiro", 62], ["arvore_p", 28], ["arvore_m", 10]] },
  // Beira de estrada e arredores de vila: árvore esparsa, arbusto frequente.
  campo:    { [TILE.TREE]: [["arvore_m", 40], ["arvore_p", 46], ["arvore_g", 14]] },
};

// Qual prop (se algum) fica em cima deste tile. Devolve null quando o tile
// não gera prop OU quando o sorteio de densidade não o escolheu — nos dois
// casos o tile continua desenhado normalmente e continua com a mesma colisão.
export function propDoTile(tile, x, y, tema = null) {
  const densidade = DENSIDADE[tile];
  if (densidade === undefined) return null;
  if (hashProp(x, y, 1) % 100 >= densidade) return null;
  const porTema = tema && TEMAS[tema] && TEMAS[tema][tile];
  const tabela = porTema || VARIANTES[tile];
  if (!tabela) return null;
  return porPeso(tabela, hashProp(x, y, 2));
}

// Reúne os props visíveis na janela da câmera.
//
// `extras` são props POSICIONADOS À MÃO no mapa (`mapa.props`), que é como as
// cidades do PASS 3 são montadas: um prédio não é um tile sorteado, é um
// prédio que alguém pôs num lugar. Eles não dependem do tile embaixo e
// aparecem mesmo sobre chão de vila.
//
// A janela é alargada porque um prop alto ancorado ABAIXO da borda de baixo
// ainda desenha dentro da tela — cortar pela borda exata faria copas
// aparecerem e sumirem quando a câmera anda.
export function propsVisiveis(grid, janela, extras = [], tema = null) {
  const { col0, col1, lin0, lin1 } = janela;
  const lista = [];
  const alturaMax = 8; // maior alturaTiles do manifesto (templo)
  const larguraMax = 8;
  const x0 = Math.max(0, col0 - larguraMax);
  const x1 = Math.min(grid[0].length - 1, col1 + larguraMax);
  const y0 = Math.max(0, lin0 - 1);
  const y1 = Math.min(grid.length - 1, lin1 + alturaMax);

  for (let y = y0; y <= y1; y++) {
    const linha = grid[y];
    for (let x = x0; x <= x1; x++) {
      const id = propDoTile(linha[x], x, y, tema);
      if (id) lista.push({ id, x, y });
    }
  }
  for (const p of extras) {
    if (p.x >= x0 - larguraMax && p.x <= x1 + larguraMax && p.y >= y0 && p.y <= y1 + alturaMax) {
      lista.push(p);
    }
  }
  return lista;
}

// Onde o prop é desenhado, em TILES, e qual é a linha da sua base — que é o
// número que o y-sort compara. A base é o tile de origem: é onde a coisa
// toca o chão, então é por ele que se decide se o jogador está na frente ou
// atrás dela.
export function caixaDoProp(prop) {
  const meta = PROPS[prop.id];
  if (!meta) return null;
  return {
    tx: prop.x - meta.ancoraX,
    ty: prop.y - meta.ancoraY,
    larguraTiles: meta.larguraTiles,
    alturaTiles: meta.alturaTiles,
    baseY: prop.y,
  };
}
