// Desenha o mapa em tiles e as entidades (jogador, NPCs, objetos) no canvas.
//
// TELA CHEIA E ZOOM (mobile, ETAPA 2)
// -----------------------------------
// Até aqui o canvas era 960x640 fixo, com `max-width:100vw; max-height:100vh`
// no CSS. No desktop passava despercebido; no celular em pé era o problema
// inteiro: num aparelho de 390x844 o navegador encolhia os 960x640 até caber
// na largura, e o jogo virava uma FAIXA de 390x260 no meio da tela, com 580px
// de barra preta. Pior: o encolhimento era feito pelo navegador em cima de um
// canvas de 960 pixels, então tudo saía borrado — arte de pixel esticada por
// um fator quebrado.
//
// Agora o canvas ocupa a viewport inteira e é o RENDERER que decide a escala:
//
//   • a memória do canvas é dimensionada em pixels de verdade do aparelho
//     (devicePixelRatio), então nada é reescalado depois — pixel art fica
//     nítida em tela retina;
//   • `tilePx` (o tamanho de um tile NA TELA) é calculado no
//     redimensionamento, não fixo em 64. No celular ele enquadra ~10 tiles no
//     lado menor, que é o que dá pra jogar em pé; no desktop continua 64,
//     então quem já jogava não sente diferença — a janela maior só mostra
//     mais mundo.
//
// Todo o desenho passou a usar `this.tilePx` no lugar da constante TILE_SIZE.
// TILE_SIZE continua sendo o tamanho do tile NA ARTE (o recorte no tileset),
// que é outra coisa e não muda.
import { TILE, TILE_SIZE, TILES_BASE, TILE_FALLBACK } from "../data/worldMap.js";
import { PROPS, propsVisiveis, caixaDoProp } from "../data/propRegistry.js";
import { MisturaDeTerreno } from "./TerrainBlend.js";
import { escalaChefeMapa, imagemOficialMonstro } from "../systems/MonsterVisualSystem.js";

const TILE_ORDER = [
  "grass", "grass_detail", "path", "water", "tree", "wall_stone",
  "dungeon_floor", "dungeon_wall", "sand", "tall_grass", "village_floor", "bush",
];

// ENQUADRAMENTO DA CÂMERA
// -----------------------
// Antes: 10 tiles no lado menor em tela pequena, e 64px fixos no desktop. Num
// desktop de 1280x720 isso dava 11 tiles de altura — o personagem ocupava
// quase 9% da altura da tela, e o mundo cabia numa sala. A cidade "grande"
// nunca aparecia inteira porque a câmera estava colada no herói.
//
// Agora o enquadramento sai de duas restrições ao mesmo tempo:
//
//   ALVO_ALTURA_TILES   quantos tiles caber na ALTURA. É o número que define o
//                       tamanho aparente do personagem: 1/15 ≈ 6,7% da altura,
//                       dentro da faixa de 5-8% pedida.
//   MIN_LARGURA_TILES   piso de tiles na LARGURA, pro celular em pé não virar
//                       um túnel onde o monstro encosta antes de aparecer.
//
// Vale a MENOR das duas escalas, então nenhuma das duas é violada. Desktop
// 1280x720 → tile 48px, 15x26 tiles. Celular 390x844 → tile 30px, 13x28.
export const ALVO_ALTURA_TILES = 15;
export const MIN_LARGURA_TILES = 13;
// Piso absoluto do tile em CSS px: abaixo disso a arte de 64px vira sopa.
const TILE_CSS_MINIMO = 26;
// Mantido por compatibilidade com o teste de enquadramento e com quem
// importava a constante; hoje o valor efetivo sai de MIN_LARGURA_TILES.
export const TILES_NO_LADO_MENOR = MIN_LARGURA_TILES;
export const ALTURA_VISUAL_MAX = 8;
export const PROJECAO_ALTURA_POR_NIVEL = 0.24;
export const alturaVisualEmPersonagens = (nivel) => {
  const n = Math.max(0, Math.min(ALTURA_VISUAL_MAX, Number(nivel) || 0));
  // O mapa conserva oito NÍVEIS reais, mas a perspectiva superior comprime
  // cada nível. A curva quadrática antiga fazia o último degrau quase duas
  // vezes maior que um personagem e gerava blocos marrons gigantes.
  return n * PROJECAO_ALTURA_POR_NIVEL;
};
export const ALTURA_PROJETADA_MAXIMA = alturaVisualEmPersonagens(ALTURA_VISUAL_MAX);
// Abaixo desta largura de CSS px o aparelho é tratado como tela pequena.
const LIMIAR_TELA_PEQUENA = 560;
// Teto do devicePixelRatio: acima de 3 o custo de preencher a tela cresce
// mais rápido que o ganho visual, e é onde celular antigo começa a engasgar.
const DPR_MAXIMO = 3;

// Em retrato, centralizar o herói matematicamente desperdiça metade da tela
// atrás dele. Este deslocamento puro põe mais mundo na direção do passo sem
// jogar o personagem sob o HUD/controles. Desktop e paisagem continuam com a
// câmera central de antes.
export function deslocamentoCameraDirecional(direcao, largura, altura, tilePx, telaPequena = true) {
  if (!telaPequena || largura >= altura) return { x: 0, y: 0 };
  const vertical = Math.min(tilePx * 2.15, altura * .105);
  const horizontal = Math.min(tilePx * 1.25, largura * .095);
  if (direcao === "cima") return { x: 0, y: -vertical };
  if (direcao === "baixo") return { x: 0, y: vertical };
  if (direcao === "esquerda") return { x: -horizontal, y: 0 };
  if (direcao === "direita") return { x: horizontal, y: 0 };
  return { x: 0, y: 0 };
}

// Altura VISUAL: não altera grid, colisão nem navegação. Serve apenas para
// desenhar degraus de luz/sombra nas fronteiras entre água, chão, vegetação
// e paredões, quebrando o aspecto de tabuleiro totalmente plano.
export function nivelVisualDoTile(tile) {
  if (tile === TILE.DEEP_WATER) return -3;
  if (tile === TILE.WATER) return -2;
  if (tile === TILE.SAND || tile === TILE.MARSH) return -1;
  if ([TILE.SNOW, TILE.ICE, TILE.ASH, TILE.BONE].includes(tile)) return 1;
  if (tile === TILE.TREE || tile === TILE.BUSH || tile === TILE.TALL_GRASS) return 1;
  if ([TILE.WALL, TILE.DUNGEON_WALL, TILE.BUILDING, TILE.CRYSTAL, TILE.LAVA].includes(tile)) return 2;
  return 0;
}

export function propOcluiJogador(prop, player) {
  if (!prop || !player || !/^(arvore_|pinheiro)/.test(prop.id || "")) return false;
  const caixa = caixaDoProp(prop);
  if (!caixa) return false;
  const px = player.x + 0.5;
  const peJogador = player.y + PE_NA_CELULA;
  const atrasDaBase = peJogador < prop.y + 0.5;
  const dentroDaCopa = px >= caixa.tx + 0.12 && px <= caixa.tx + caixa.larguraTiles - 0.12
    && player.y >= caixa.ty - 0.2 && player.y <= prop.y;
  return atrasDaBase && dentroDaCopa;
}

// CAMADA DE PROFUNDIDADE (y-sort)
// -------------------------------
// Props, NPCs, objetos e jogador entram numa fila só, ordenada pela linha em
// que TOCAM O CHÃO. É isso que faz o jogador passar POR TRÁS da copa de uma
// árvore ao andar acima dela, e aparecer na frente do tronco ao andar abaixo.
// Sem esta etapa o mundo volta a ser um mosaico chapado, por maior que a
// árvore seja desenhada — a escala só é percebida quando as coisas se
// sobrepõem na ordem certa.
//
// As frações são onde cada coisa PISA dentro do próprio tile. Quem ocupa a
// célula inteira (jogador, NPC, objeto) pisa em +0,9; um prop é ancorado pela
// base e pisa no meio da célula (+0,5), pra que quem está na MESMA linha de um
// tronco apareça na frente dele.
//
// Jogador e NPC usam o MESMO valor de propósito, embora o sprite do jogador
// seja desenhado um quarto de tile mais alto: esse recuo é enquadramento do
// sprite, não posição no mundo. Dar a ele um pé "mais alto" fazia o jogador
// sumir atrás de um NPC parado ao lado — foi o que o teste de props pegou.
//
// `ordem` é só o desempate dentro da MESMA linha, e preserva a hierarquia
// antiga: cenário (camada 0) embaixo, objeto e NPC em cima, jogador por
// último.
//
// Função pura e exportada de propósito: é o que o teste de props verifica sem
// precisar comparar pixels de screenshot.
const PE_NA_CELULA = 0.9;
export function filaDeProfundidade({ props = [], objetos = [], npcs = [], player, pet = null }) {
  const fila = [];
  for (const prop of props) fila.push({ baseY: prop.y + 0.5, ordem: 1, tipo: "prop", dado: prop });
  for (const o of objetos) {
    const cenario = o.camada === 0;
    fila.push({ baseY: o.y + (cenario ? 0.1 : PE_NA_CELULA), ordem: cenario ? 0 : 2, tipo: "objeto", dado: o });
  }
  for (const n of npcs || []) fila.push({ baseY: n.y + PE_NA_CELULA, ordem: 2, tipo: "npc", dado: n });
  // O companheiro entra na MESMA fila: ele passa atrás da árvore e na frente
  // da casa igual a todo o resto. `ordem` 2 põe ele sob o jogador num empate,
  // porque quem você controla nunca pode ficar escondido atrás do bicho.
  if (pet) fila.push({ baseY: pet.y + PE_NA_CELULA, ordem: 2, tipo: "pet", dado: pet });
  if (player) fila.push({ baseY: player.y + PE_NA_CELULA, ordem: 3, tipo: "jogador", dado: player });
  fila.sort((a, b) => (a.baseY - b.baseY) || (a.ordem - b.ordem));
  return fila;
}

export class Renderer {
  constructor(canvas, imagens) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.imagens = imagens;
    this.tilesetTileW = TILE_SIZE; // cada tile no tileset já está em 64x64 (upscale do gerador)
    this.tilePx = TILE_SIZE;
    this.escala = 1;
    // Transição entre terrenos: compõe a franja do vizinho de prioridade
    // maior sobre a borda deste tile, e guarda o resultado assado. Ver
    // TerrainBlend.js — nada aqui muda o grid nem a colisão.
    this.mistura = new MisturaDeTerreno(imagens.mascaras, (t) => this.folhaDoTile(t));
    this.redimensionar();
  }

  // Ajusta a memória do canvas ao tamanho real que ele ocupa na página e
  // recalcula o zoom. Chamado no boot, em `resize`, e na troca de orientação.
  // Devolve true quando algo mudou de fato — quem chama usa isso pra não
  // redesenhar à toa.
  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAXIMO);
    const larguraCss = this.canvas.clientWidth || this.canvas.width || 960;
    const alturaCss = this.canvas.clientHeight || this.canvas.height || 640;
    const larguraPx = Math.max(1, Math.round(larguraCss * dpr));
    const alturaPx = Math.max(1, Math.round(alturaCss * dpr));

    const menorLadoCss = Math.min(larguraCss, alturaCss);
    // A menor das duas escalas satisfaz as duas restrições de uma vez: nunca
    // mais que ALVO_ALTURA_TILES na vertical, nunca menos que
    // MIN_LARGURA_TILES na horizontal. O piso evita que uma janela minúscula
    // reduza o tile a um borrão.
    const tileCss = Math.max(
      TILE_CSS_MINIMO,
      Math.min(alturaCss / ALVO_ALTURA_TILES, larguraCss / MIN_LARGURA_TILES),
    );
    // Arredondar em pixel de aparelho (e não em CSS px) é o que mantém a arte
    // alinhada à grade física da tela: um tile de 117px de aparelho recorta
    // sempre nos mesmos pixels, sem a linha de costura que aparece quando o
    // destino cai em 116,66px.
    const tilePx = Math.max(8, Math.round(tileCss * dpr));

    const mudou = larguraPx !== this.canvas.width || alturaPx !== this.canvas.height || tilePx !== this.tilePx;
    this.telaPequena = menorLadoCss < LIMIAR_TELA_PEQUENA;
    if (!mudou) return false;
    this.canvas.width = larguraPx;
    this.canvas.height = alturaPx;
    this.tilePx = tilePx;
    // Quanto o mundo cresceu em relação ao tamanho de referência — usado pra
    // texto e formas desenhadas à mão não ficarem microscópicas no celular.
    this.escala = tilePx / TILE_SIZE;
    this.ctx.imageSmoothingEnabled = false;
    return true;
  }

  // Quantos tiles cabem na tela agora. Útil pra diagnóstico e pro teste de
  // enquadramento.
  tilesVisiveis() {
    return {
      largura: this.canvas.width / this.tilePx,
      altura: this.canvas.height / this.tilePx,
    };
  }

  // Em que folha de arte mora um índice de tile, e em que coluna dela.
  //
  // Índice < 12: a folha original do jogo, coluna = índice. Índice >= 12: a
  // folha estendida da ETAPA 2, coluna = índice - 12. Se a folha estendida
  // não estiver instalada (o jogador não copiou o arquivo novo), cai no tile
  // antigo equivalente — neve vira grama clara, lava vira pedra — em vez de
  // desenhar de fora da imagem e deixar buraco preto no mapa.
  //
  // A checagem de largura é o que separa "folha ausente" de "folha presente":
  // carregarImagem() devolve um placeholder de 32x32 quando o arquivo falta,
  // e recortar 64px dele daria um quadrado vazio.
  folhaDoTile(indice) {
    if (indice < TILES_BASE) return { folha: this.imagens.tileset, coluna: indice };
    const extra = this.imagens.tileset_extra;
    const colunaExtra = indice - TILES_BASE;
    if (extra && extra.width >= (colunaExtra + 1) * this.tilesetTileW) {
      return { folha: extra, coluna: colunaExtra };
    }
    const equivalente = TILE_FALLBACK[indice];
    return { folha: this.imagens.tileset, coluna: equivalente === undefined ? 0 : equivalente };
  }

  camera(playerPx, mapaWpx, mapaHpx, margemTopo = 0, direcao = null) {
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    const olhar = deslocamentoCameraDirecional(direcao, vw, vh, this.tilePx, this.telaPequena);
    let cx = playerPx.x + olhar.x - vw / 2;
    let cy = playerPx.y + olhar.y - vh / 2;
    // Mapa menor que a tela (masmorra pequena no celular deitado): centraliza
    // em vez de grudar no canto.
    cx = mapaWpx <= vw ? (mapaWpx - vw) / 2 : Math.max(0, Math.min(cx, mapaWpx - vw));
    cy = mapaHpx <= vh ? (mapaHpx - vh) / 2 : Math.max(-margemTopo, Math.min(cy, mapaHpx - vh));
    return { x: cx, y: cy };
  }

  // Desenha um prop de cenário. Devolve false quando a arte não está
  // disponível (arquivo ausente → placeholder de 32px), pra quem chama poder
  // simplesmente pular: o tile embaixo já foi desenhado e a colisão não
  // depende disto.
  desenharProp(prop, cam, player = null) {
    const meta = PROPS[prop.id];
    if (!meta) return false;
    const img = this.imagens[`prop_${prop.id}`];
    const larguraEsperada = meta.larguraTiles * TILE_SIZE;
    if (!img || img.width < larguraEsperada) return false;
    const caixa = caixaDoProp(prop);
    const T = this.tilePx;
    const dx = Math.round(caixa.tx * T - cam.x);
    const dy = Math.round(caixa.ty * T - cam.y + this.deslocamentoAltura(prop.x, prop.y));
    const w = Math.round(caixa.larguraTiles * T);
    const h = Math.round(caixa.alturaTiles * T);
    if (dx > this.canvas.width || dy > this.canvas.height || dx + w < 0 || dy + h < 0) return true;
    const transparente = propOcluiJogador(prop, player);
    this.ctx.save();
    if (transparente) this.ctx.globalAlpha = 0.42;
    this.ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, w, h);
    if (prop.id && /(lanterna|poste|tocha|fogueira|pousada|portao|ponte)/i.test(prop.id) && this.horaAtual?.ehNoite) {
      const lx = dx + w * .5, ly = dy + h * .28, r = T * 1.35;
      const grad = this.ctx.createRadialGradient(lx, ly, 1, lx, ly, r);
      grad.addColorStop(0, "rgba(255,220,125,.52)"); grad.addColorStop(1, "rgba(255,160,45,0)");
      this.ctx.fillStyle = grad; this.ctx.beginPath(); this.ctx.arc(lx, ly, r, 0, Math.PI * 2); this.ctx.fill();
    }
    if (transparente) {
      // Contorno luminoso discreto mantém a árvore legível ao mesmo tempo em
      // que revela claramente o personagem passando por trás dela.
      this.ctx.globalAlpha = 0.34;
      this.ctx.strokeStyle = "#d9efb0";
      this.ctx.lineWidth = Math.max(1, Math.round(this.escala));
      this.ctx.strokeRect(dx + 1, dy + 1, Math.max(1, w - 2), Math.max(1, h - 2));
    }
    this.ctx.restore();
    return true;
  }

  nivelAltura(tx, ty) {
    const grid = this.gridAtual;
    if (!grid?.[ty] || grid[ty][tx] === undefined) return 0;
    if (this.alturasAtual?.length === grid.length * grid[0].length) {
      return this.alturasAtual[ty * grid[0].length + tx];
    }
    // Masmorras e mapas antigos continuam com o relevo discreto anterior.
    return nivelVisualDoTile(grid[ty][tx]) * 0.075;
  }

  nivelAlturaInterpolado(x, y) {
    const grid = this.gridAtual;
    if (!grid?.length || !grid[0]?.length) return 0;
    const maxX = grid[0].length - 1; const maxY = grid.length - 1;
    const px = Math.max(0, Math.min(maxX, x));
    const py = Math.max(0, Math.min(maxY, y));
    const x0 = Math.floor(px); const y0 = Math.floor(py);
    const x1 = Math.min(maxX, x0 + 1); const y1 = Math.min(maxY, y0 + 1);
    const fx = px - x0; const fy = py - y0;
    const cima = this.nivelAltura(x0, y0) * (1 - fx) + this.nivelAltura(x1, y0) * fx;
    const baixo = this.nivelAltura(x0, y1) * (1 - fx) + this.nivelAltura(x1, y1) * fx;
    return cima * (1 - fy) + baixo * fy;
  }

  desenharRelevoTile(grid, tx, ty, dx, dy, T) {
    const atual = this.nivelAltura(tx, ty);
    const direita = tx + 1 < grid[ty].length ? this.nivelAltura(tx + 1, ty) : atual;
    const baixo = ty + 1 < grid.length ? this.nivelAltura(tx, ty + 1) : atual;
    const esp = Math.max(2, Math.round(T * 0.085));
    const ctx = this.ctx;
    if (atual > direita) {
      ctx.fillStyle = `rgba(18,12,10,${Math.min(0.42, 0.14 + (atual - direita) * 0.09)})`;
      ctx.fillRect(dx + T - esp, dy + esp, esp, T - esp);
    }
    if (atual > baixo) {
      ctx.fillStyle = `rgba(16,10,8,${Math.min(0.48, 0.16 + (atual - baixo) * 0.1)})`;
      ctx.fillRect(dx, dy + T - esp, T, esp);
      ctx.fillStyle = "rgba(255,238,190,0.09)";
      ctx.fillRect(dx, dy, T, Math.max(1, Math.round(esp * 0.5)));
    }
  }

  // Cada nível desloca o chão verticalmente. Como câmera, objetos e atores
  // usam a mesma função, a grade lógica não muda, mas o olho percebe a subida
  // da planície para a montanha e a descida grama → areia → água.
  deslocamentoAltura(x, y) {
    return -alturaVisualEmPersonagens(this.nivelAlturaInterpolado(x, y)) * this.tilePx;
  }

  // Pequenos grãos, lascas e tufos quebram o aspecto de quadrado ampliado.
  // A posição é derivada das coordenadas, portanto não pisca entre frames.
  desenharMicroTexturaTerreno(tile, tx, ty, dx, dy, T) {
    const ctx = this.ctx;
    const agua = tile === TILE.WATER || tile === TILE.DEEP_WATER;
    const neve = tile === TILE.SNOW || tile === TILE.ICE;
    const areia = tile === TILE.SAND;
    const estrada = tile === TILE.PATH || tile === TILE.COBBLE || tile === TILE.VILLAGE_FLOOR;
    const rocha = [TILE.WALL, TILE.ASH, TILE.BONE, TILE.CRYSTAL].includes(tile);
    const natural = agua || neve || areia || estrada || rocha
      || [TILE.GRASS, TILE.GRASS_DETAIL, TILE.TALL_GRASS, TILE.MARSH].includes(tile);
    if (!natural) return;
    let s = ((tx * 73856093) ^ (ty * 19349663) ^ (tile * 83492791)) >>> 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const px = Math.max(1, Math.round(T * .025));
    const quantidade = agua ? 3 : estrada ? 7 : 6;
    ctx.save();
    ctx.globalAlpha = agua ? .22 : .18;
    ctx.fillStyle = agua ? "#bde8ee" : neve ? "#d9eff4" : areia ? "#6f4c2d"
      : estrada ? "#5a4029" : rocha ? "#c3b596" : "#244d2b";
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = px;
    for (let i = 0; i < quantidade; i += 1) {
      const x = Math.round(dx + T * (.1 + rnd() * .8));
      const y = Math.round(dy + T * (.12 + rnd() * .76));
      if (agua) {
        ctx.beginPath(); ctx.moveTo(x - T * .07, y); ctx.lineTo(x + T * (.05 + rnd() * .08), y); ctx.stroke();
      } else if (!areia && !estrada && !rocha && rnd() > .55) {
        ctx.fillRect(x, y - px * 2, px, px * 3);
        ctx.fillRect(x - px, y - px, px, px);
      } else {
        const w = px * (1 + Math.round(rnd() * 2));
        ctx.fillRect(x, y, w, px);
      }
    }
    ctx.restore();
  }

  desenharDetalheEstrada(grid, tx, ty, dx, dy, T) {
    const tile = grid[ty][tx];
    if (tile !== TILE.PATH && tile !== TILE.COBBLE) return;
    const estrada = (x, y) => !!grid[y] && [TILE.PATH, TILE.COBBLE, TILE.BRIDGE, TILE.VILLAGE_FLOOR].includes(grid[y][x]);
    const horizontal = Number(estrada(tx - 1, ty)) + Number(estrada(tx + 1, ty))
      >= Number(estrada(tx, ty - 1)) + Number(estrada(tx, ty + 1));
    const ctx = this.ctx;
    ctx.save();
    if (tile === TILE.PATH) {
      ctx.strokeStyle = "rgba(73,49,27,.32)";
      ctx.lineWidth = Math.max(1, Math.round(T * 0.045));
      ctx.setLineDash([Math.max(2, T * .18), Math.max(2, T * .12)]);
      for (const faixa of [.33, .67]) {
        ctx.beginPath();
        if (horizontal) { ctx.moveTo(dx, dy + T * faixa); ctx.lineTo(dx + T, dy + T * faixa); }
        else { ctx.moveTo(dx + T * faixa, dy); ctx.lineTo(dx + T * faixa, dy + T); }
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "rgba(234,218,176,.16)";
      ctx.lineWidth = Math.max(1, Math.round(T * .025));
      ctx.strokeRect(dx + 1, dy + 1, T - 2, T - 2);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  desenharFacesDeAltitude(faces, T) {
    const ctx = this.ctx;
    for (const f of faces) {
      const h = Math.max(0, f.diferenca * T);
      if (h < 1) continue;
      const estrada = [TILE.PATH, TILE.COBBLE, TILE.BRIDGE].includes(f.tile)
        && [TILE.PATH, TILE.COBBLE, TILE.BRIDGE].includes(f.tileBaixo);
      const neve = f.tile === TILE.SNOW || f.tile === TILE.ICE;
      const areia = f.tile === TILE.SAND;
      const cinza = f.tile === TILE.ASH || f.tile === TILE.LAVA;
      const cores = estrada ? ["#9a815f", "#514331"]
        : neve ? ["#8e9b9b", "#505d61"]
          : areia ? ["#a1774e", "#62442f"]
            : cinza ? ["#68665f", "#343532"] : ["#706b52", "#3f4132"];
      const grad = ctx.createLinearGradient(0, f.y, 0, f.y + h);
      grad.addColorStop(0, cores[0]);
      grad.addColorStop(.55, cores[1]);
      grad.addColorStop(1, "#262820");
      ctx.fillStyle = grad;
      ctx.fillRect(f.x, f.y, T, h + 1);
      ctx.strokeStyle = estrada ? "rgba(230,210,166,.38)" : "rgba(224,218,178,.16)";
      ctx.lineWidth = Math.max(1, Math.round(T * .025));
      const passos = Math.max(2, Math.round(h / Math.max(4, T * (estrada ? .09 : .13))));
      for (let i = 1; i <= passos; i += 1) {
        const y = f.y + h * i / passos;
        ctx.beginPath(); ctx.moveTo(f.x, y); ctx.lineTo(f.x + T, y); ctx.stroke();
      }
      if (!estrada) {
        // Lascas pequenas e rachaduras substituem a parede lisa de uma cor.
        const lascas = Math.max(3, Math.round(T / 10));
        for (let i = 0; i < lascas; i += 1) {
          const px = f.x + ((f.tx * 17 + i * 23) % Math.max(2, T - 5));
          const py = f.y + ((f.tx * 11 + i * 13) % Math.max(2, h));
          ctx.fillStyle = i % 2 ? "rgba(245,232,188,.12)" : "rgba(12,15,10,.22)";
          ctx.fillRect(px, py, Math.max(1, Math.round(T * .045)), Math.max(1, Math.round(T * .025)));
        }
      }
    }
  }

  desenhar({ grid, alturas = null, player, npcs, objetos, mostrarPronto, props, tema, pet, objetivoMissao = null, hora = null, climaId = null }) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const mapaWpx = grid[0].length * T;
    const mapaHpx = grid.length * T;
    this.gridAtual = grid;
    this.alturasAtual = alturas;
    this.horaAtual = hora;
    const playerPx = { x: player.x * T + T / 2, y: player.y * T + T / 2 + this.deslocamentoAltura(player.x, player.y) };
    const margemTopo = alturas ? Math.ceil(ALTURA_PROJETADA_MAXIMA + 1) * T : 0;
    const cam = this.camera(playerPx, mapaWpx, mapaHpx, margemTopo, player.dir);

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const colStart = Math.max(0, Math.floor(cam.x / T));
    const rowStart = Math.max(0, Math.floor(cam.y / T) - (alturas ? Math.ceil(ALTURA_PROJETADA_MAXIMA) + 1 : 0));
    const colEnd = Math.min(grid[0].length - 1, Math.ceil((cam.x + this.canvas.width) / T));
    const rowEnd = Math.min(grid.length - 1, Math.ceil((cam.y + this.canvas.height) / T) + 1);

    const facesAltitude = [];

    for (let ty = rowStart; ty <= rowEnd; ty++) {
      for (let tx = colStart; tx <= colEnd; tx++) {
        const dx = Math.round(tx * T - cam.x);
        const dyBase = Math.round(ty * T - cam.y);
        const dy = Math.round(dyBase + this.deslocamentoAltura(tx, ty));
        const { folha, coluna } = this.folhaDoTile(grid[ty][tx]);
        if (!folha) continue;
        ctx.drawImage(folha, coluna * this.tilesetTileW, 0, this.tilesetTileW, this.tilesetTileW, dx, dy, T, T);
        // Franja do vizinho de prioridade maior, por cima da borda deste tile
        // (ver TerrainBlend.js). Sai de graça no miolo: a função devolve na
        // primeira comparação quando não há fronteira.
        this.mistura.desenharFranjas(ctx, grid, tx, ty, dx, dy, T);
        this.desenharMicroTexturaTerreno(grid[ty][tx], tx, ty, dx, dy, T);
        this.desenharDetalheEstrada(grid, tx, ty, dx, dy, T);
        this.desenharRelevoTile(grid, tx, ty, dx, dy, T);
        if (alturas && ty + 1 < grid.length) {
          const nivelAtual = this.nivelAltura(tx, ty);
          const nivelAbaixo = this.nivelAltura(tx, ty + 1);
          const diferenca = alturaVisualEmPersonagens(nivelAtual) - alturaVisualEmPersonagens(nivelAbaixo);
          const tileAbaixo = grid[ty + 1][tx];
          if (diferenca > 0) facesAltitude.push({ x: dx, y: dy + T, diferenca, tile: grid[ty][tx], tileBaixo: tileAbaixo, tx });
        }
      }
    }

    // As faces vêm depois dos tampos para que um paredão de oito níveis não
    // seja apagado pelas fileiras de terreno desenhadas logo abaixo.
    this.desenharFacesDeAltitude(facesAltitude, T);
    this.desenharRastroMissao(objetivoMissao, player, cam);

    const janela = { col0: colStart, col1: colEnd, lin0: rowStart, lin1: rowEnd };
    const fila = filaDeProfundidade({
      props: propsVisiveis(grid, janela, props || [], tema),
      objetos, npcs, player, pet,
    });

    // Os nomes dos NPCs são informação útil, mas vários moradores costumam
    // ficar lado a lado na vila. Guarda as caixas já usadas neste frame para
    // empurrar ou ocultar rótulos que colidiriam.
    this.rotulosNpc = [];

    for (const item of fila) {
      if (item.tipo === "prop") { this.desenharProp(item.dado, cam, player); continue; }
      if (item.tipo === "objeto") { this.desenharObjeto(item.dado, cam); continue; }
      if (item.tipo === "npc") { this.desenharNpc(item.dado, cam); continue; }
      if (item.tipo === "pet") { this.desenharPet(item.dado, cam); continue; }
      this.desenharJogador(item.dado, playerPx, cam);
    }

    this.desenharAmbienteHorario(player, cam, hora, climaId);
    if (mostrarPronto) this.desenharDicaDeInteracao(mostrarPronto);
  }

  desenharAmbienteHorario(player, cam, hora, climaId) {
    if (!hora) return;
    const h = hora.horaDecimal ?? hora.hora;
    const crepusculo = (h >= 5 && h < 7) ? (7 - h) / 2 : (h >= 18 && h < 20) ? (h - 18) / 2 : 0;
    const ctx = this.ctx;
    if (crepusculo > 0) {
      ctx.save(); ctx.fillStyle = `rgba(218,112,67,${(crepusculo * .16).toFixed(3)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); ctx.restore();
    }
    const intensidade = hora.escuridao ?? (hora.ehNoite ? 1 : 0);
    if (intensidade <= 0) return;
    const T = this.tilePx;
    const x = player.x * T + T / 2 - cam.x;
    const y = player.y * T + T / 2 + this.deslocamentoAltura(player.x, player.y) - cam.y;
    const alcance = T * (3.9 + Math.min(2, player.lanternaNivel || 1) * .45);
    ctx.save(); ctx.globalAlpha = intensidade; ctx.fillStyle = "rgba(5,9,26,.58)"; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const luz = ctx.createRadialGradient(x, y, T * .4, x, y, alcance);
    luz.addColorStop(0, "rgba(255,224,145,.44)"); luz.addColorStop(.34, "rgba(255,193,87,.16)"); luz.addColorStop(1, "rgba(255,193,87,0)");
    ctx.fillStyle = luz; ctx.fillRect(x - alcance, y - alcance, alcance * 2, alcance * 2);
    if (climaId === "neblina" || climaId === "chuva" || climaId === "nevasca") {
      ctx.fillStyle = climaId === "nevasca" ? "rgba(220,240,255,.08)" : "rgba(190,205,230,.055)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (climaId !== "nevasca") {
      const tempo = Date.now() / 700; ctx.fillStyle = "rgba(255,226,125,.72)";
      for (let i = 0; i < 12; i++) {
        const px = (i * 97 + Math.floor(tempo * (i % 3 + 1) * 8)) % Math.max(1, this.canvas.width);
        const py = (i * 53 + Math.floor(tempo * (i % 2 + 1) * 5)) % Math.max(1, this.canvas.height);
        ctx.globalAlpha = Math.max(.08, .35 + Math.sin(tempo + i) * .25);
        ctx.beginPath(); ctx.arc(px, py, Math.max(1, T * .035), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  desenharRastroMissao(objetivo, player, cam) {
    if (!objetivo) return;
    const ctx = this.ctx;
    const T = this.tilePx;
    const inicio = {
      x: player.x * T + T / 2 - cam.x,
      y: player.y * T + T * .72 + this.deslocamentoAltura(player.x, player.y) - cam.y,
    };
    const alvo = {
      x: objetivo.x * T + T / 2 - cam.x,
      y: objetivo.y * T + T * .65 + this.deslocamentoAltura(objetivo.x, objetivo.y) - cam.y,
    };
    const dx = alvo.x - inicio.x, dy = alvo.y - inicio.y;
    const dist = Math.hypot(dx, dy);
    if (dist < T * .45) return;
    const alvoVisivel = alvo.x >= 0 && alvo.y >= 0 && alvo.x <= this.canvas.width && alvo.y <= this.canvas.height;
    const limite = alvoVisivel ? Math.max(0, dist - T * .36) : Math.min(dist, Math.max(this.canvas.width, this.canvas.height) * .44);
    const fim = { x: inicio.x + dx / dist * limite, y: inicio.y + dy / dist * limite };
    ctx.save();
    ctx.lineCap = "round";
    ctx.setLineDash([Math.max(5, T * .13), Math.max(7, T * .2)]);
    ctx.lineDashOffset = -(Date.now() / 55) % (T * .33);
    ctx.lineWidth = Math.max(2, T * .045);
    ctx.strokeStyle = "rgba(255,211,93,.68)";
    ctx.shadowColor = "rgba(255,174,46,.58)";
    ctx.shadowBlur = Math.max(5, T * .11);
    ctx.beginPath(); ctx.moveTo(inicio.x, inicio.y); ctx.lineTo(fim.x, fim.y); ctx.stroke();
    ctx.setLineDash([]);
    const angulo = Math.atan2(dy, dx);
    // O destino visível já tem o selo de chão abaixo. Desenhar também uma
    // ponta de seta no mesmo ponto criava dois sinais para um único objetivo.
    if (!alvoVisivel) {
      ctx.translate(fim.x, fim.y); ctx.rotate(angulo);
      ctx.fillStyle = "#ffe27a";
      ctx.strokeStyle = "rgba(34,20,7,.92)";
      ctx.lineWidth = Math.max(1.5, T * .025);
      ctx.beginPath(); ctx.moveTo(T * .18, 0); ctx.lineTo(-T * .11, -T * .12); ctx.lineTo(-T * .06, 0); ctx.lineTo(-T * .11, T * .12); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // Se o objetivo está dentro da câmera, ele recebe um selo pulsante no
    // chão. Fora dela, a seta acima continua indicando a direção correta.
    if (alvoVisivel) {
      const pulso = .82 + Math.sin(Date.now() / 210) * .12;
      ctx.save();
      ctx.strokeStyle = "#ffe27a";
      ctx.lineWidth = Math.max(2, T * .04);
      ctx.shadowColor = "#ffb12e"; ctx.shadowBlur = T * .16;
      ctx.beginPath(); ctx.ellipse(alvo.x, alvo.y, T * .31 * pulso, T * .13 * pulso, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff1ad"; ctx.font = `bold ${Math.round(T * .32)}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText("!", alvo.x, alvo.y - T * .25);
      ctx.restore();
    }
  }

  desenharObjeto(o, cam) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const dx = Math.round(o.x * T - cam.x);
    const dy = Math.round(o.y * T - cam.y + this.deslocamentoAltura(o.x, o.y));
    // O chefe ocupa quatro vezes a altura visual de um civil, mas continua
    // usando exatamente um tile lógico. Assim ele parece uma ameaça regional
    // sem alterar colisão, pathfinding nem a distância que inicia o encontro.
    const ehChefe = o.tipo === "chefe";
    const margem = ehChefe ? T * 4.35 : T;
    if (dx < -margem || dy < -margem || dx > this.canvas.width + margem || dy > this.canvas.height + margem) return;
    // Chefe em cooldown (melhoria de jogabilidade #1, ver main.js
    // objetosAtivos()): não tem sprite próprio — desenhado só com formas
    // de canvas (um anel "esvaziando" + relógio de areia), pra deixar
    // claro que o chefe ainda vai voltar e quanto falta, sem precisar de
    // nenhum asset novo.
    if (o.tipo === "chefe_recuperando") {
      this.desenharChefeRecuperando(o, dx, dy);
      return;
    }
    const img = ehChefe ? imagemOficialMonstro(this.imagens, o.imgKey) : this.imagens[o.imgKey];
    if (!img) return;
    if (!ehChefe) {
      ctx.drawImage(img, dx, dy, T, T);
      return;
    }

    const escala = escalaChefeMapa(o.ref);
    const tam = T * escala;
    const escalaSombra = escala / 4.32;
    const px = dx + T / 2 - tam / 2;
    const py = dy + T - tam;
    ctx.save();
    // Sombra e selo territorial ficam no tile real. O sprite cresce somente
    // para cima e para os lados, mantendo os pés no ponto do encontro.
    ctx.fillStyle = "rgba(12,7,13,.58)";
    ctx.beginPath();
    ctx.ellipse(dx + T / 2, dy + T * .9, T * 1.02 * escalaSombra, T * .27 * escalaSombra, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(245,165,36,.82)";
    ctx.lineWidth = Math.max(2, Math.round(this.escala * 2));
    ctx.beginPath();
    ctx.ellipse(dx + T / 2, dy + T * .88, T * .82 * escalaSombra, T * .21 * escalaSombra, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.imageSmoothingEnabled = false;
    ctx.filter = "drop-shadow(0 7px 5px rgba(0,0,0,.72)) drop-shadow(0 0 7px rgba(245,165,36,.34))";
    // Mesmo recorte quadrado da batalha; o fallback pode ser uma spritesheet.
    const lado = Math.min(img.width, img.height);
    ctx.drawImage(img, 0, 0, lado, lado, px, py, tam, tam);
    ctx.filter = "none";
    ctx.fillStyle = "#ffd46a";
    ctx.strokeStyle = "rgba(28,14,8,.9)";
    ctx.lineWidth = Math.max(2, Math.round(this.escala * 2));
    ctx.font = `bold ${Math.round(T * .58)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("♛", dx + T / 2, py + T * .25);
    ctx.fillText("♛", dx + T / 2, py + T * .25);
    ctx.restore();
  }

  desenharNpc(n, cam) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const img = this.imagens[n.spriteKey] || this.imagens[n.id] || this.imagens.npc_marker;
    const dx = Math.round(n.x * T - cam.x);
    const dy = Math.round(n.y * T - cam.y + this.deslocamentoAltura(n.x, n.y));
    if (dx < -T || dy < -T || dx > this.canvas.width || dy > this.canvas.height) return;
    // Os novos civis têm silhueta e nível de detalhe próximos aos heróis.
    // Um pouco mais de presença para os importantes, mantendo figurantes
    // abaixo do protagonista para preservar a hierarquia visual.
    const tam = Math.round(T * (n.ambiente ? 1.08 : 1.15));
    const px = Math.round(dx - (tam - T) / 2);
    const py = Math.round(dy - (tam - T));
    // Sombra curta e pés na mesma linha do tile: o personagem pertence ao
    // chão em vez de parecer um adesivo flutuando sobre a cidade.
    ctx.save();
    ctx.globalAlpha = n.ambiente ? .24 : .34;
    ctx.fillStyle = "#0b0a08";
    ctx.beginPath();
    ctx.ellipse(dx + T / 2, dy + T * .88, T * .27, T * .08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (img) {
      const passo = n.ambulante ? Math.sin(Date.now() / 135) * T * .018 : 0;
      ctx.drawImage(img, px, py + passo, tam, tam);
    }

    // Missão ou função do NPC, sempre acima da cabeça. Um único marcador é
    // muito mais legível que nomes, cargos e balões competindo entre si.
    if (n.marcador?.icone) {
      const raio = Math.max(8 * this.escala, T * .16);
      const mx = dx + T / 2;
      const my = py - raio * .72;
      ctx.save();
      ctx.fillStyle = "rgba(17,14,22,.94)";
      ctx.strokeStyle = n.marcador.cor || "#ffd45a";
      ctx.lineWidth = Math.max(1, Math.round(this.escala * 1.5));
      ctx.beginPath(); ctx.arc(mx, my, raio, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = n.marcador.cor || "#ffd45a";
      ctx.font = `bold ${Math.round(13 * this.escala)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(n.marcador.icone, mx, my + this.escala);
      ctx.restore();
    }
    if (n.mostrarNome === false) return;
    ctx.fillStyle = "#f1e9d8";
    ctx.font = `${Math.round(12 * this.escala)}px sans-serif`;
    ctx.textAlign = "center";
    // O nome é preso dentro da tela: um NPC na beirada direita tinha o nome
    // cortado ao meio ("Caçado"), e num celular em pé a beirada está sempre
    // perto. Empurrar o texto para dentro custa nada e resolve.
    const meia = ctx.measureText(n.nome).width / 2 + 4;
    const baseX = Math.min(Math.max(dx + T / 2, meia), this.canvas.width - meia);
    const largura = meia * 2;
    let nx = baseX;
    const recuoMarcador = n.marcador?.icone ? Math.max(18 * this.escala, T * .34) : 0;
    let ny = Math.max(12 * this.escala, py - 4 * this.escala - recuoMarcador);
    const colide = (x, y) => this.rotulosNpc.some((r) =>
      Math.abs(x - r.x) < (largura + r.w) / 2 && Math.abs(y - r.y) < 16 * this.escala);
    if (colide(nx, ny)) {
      const alternativas = [
        [baseX, ny - 16 * this.escala],
        [Math.min(this.canvas.width - meia, baseX + largura * 0.65), ny],
        [Math.max(meia, baseX - largura * 0.65), ny],
      ];
      const livre = alternativas.find(([x, y]) => !colide(x, y));
      if (livre) [nx, ny] = livre;
      else return; // o nome continua acessível ao aproximar/interagir
    }
    this.rotulosNpc.push({ x: nx, y: ny, w: largura });
    ctx.fillText(n.nome, nx, ny);
  }

  // Companheiro de mapa. Folha de 2 quadros de 64x64, desenhado a 70% do
  // tile: é o tamanho que faz ele ler como bicho de companhia e não como um
  // segundo personagem disputando a atenção.
  desenharPet(pet, cam) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const folha = this.imagens[pet.spriteKey];
    if (!folha || folha.width < TILE_SIZE * 2) return;
    const tam = Math.round(T * 0.7);
    const dx = Math.round(pet.x * T - cam.x + (T - tam) / 2);
    const dy = Math.round(pet.y * T - cam.y + (T - tam) * 0.85 + this.deslocamentoAltura(pet.x, pet.y));
    const sx = (pet.frame || 0) * TILE_SIZE;
    ctx.save();
    if (pet.dir === "esquerda") {
      ctx.translate(dx + tam, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(folha, sx, 0, TILE_SIZE, TILE_SIZE, 0, 0, tam, tam);
    } else {
      ctx.drawImage(folha, sx, 0, TILE_SIZE, TILE_SIZE, dx, dy, tam, tam);
    }
    ctx.restore();
  }

  // Jogador (spritesheet 4 frames de 64x64: idle, walk1, idle, walk2).
  desenharJogador(player, playerPx, cam) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const sheet = this.imagens[player.spriteKey];
    if (!sheet) return;
    const frame = player.frame || 0;
    const sx = frame * TILE_SIZE;
    const tam = Math.round(T * 1.14);
    const dx = playerPx.x - cam.x - tam / 2;
    // Aumenta a leitura sem mudar a base: os pés continuam no mesmo ponto
    // lógico, enquanto roupa, cabelo e equipamento ganham mais pixels.
    const dy = playerPx.y - cam.y - tam * 0.78;
    ctx.save();
    if (player.horaNoite) {
      const lx = playerPx.x - cam.x + (player.dir === "esquerda" ? -tam * .34 : tam * .34);
      const ly = playerPx.y - cam.y - tam * .24;
      const raio = T * .72;
      const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, raio);
      glow.addColorStop(0, "rgba(255,242,170,.8)"); glow.addColorStop(.28, "rgba(255,185,75,.28)"); glow.addColorStop(1, "rgba(255,185,75,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly, raio, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6b3e21"; ctx.fillRect(lx - T * .06, ly - T * .08, T * .12, T * .25);
      ctx.fillStyle = "#ffe99b"; ctx.beginPath(); ctx.arc(lx, ly - T * .11, T * .1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = .36;
    ctx.fillStyle = "#070706";
    ctx.beginPath();
    ctx.ellipse(playerPx.x - cam.x, playerPx.y - cam.y + T * .29, T * .3, T * .085, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (player.dir === "esquerda" || player.dir === "direita") {
      // Perfil lateral: estreita a silhueta sem reduzir a altura e espelha
      // para a esquerda. Como todas as combinações raça/classe passam por
      // este renderer, as quatro direções funcionam para o elenco inteiro.
      const larguraPerfil = tam * .84;
      const px = dx + (tam - larguraPerfil) / 2;
      ctx.save();
      if (player.dir === "esquerda") {
        ctx.translate(px + larguraPerfil, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, sx, 0, TILE_SIZE, TILE_SIZE, 0, 0, larguraPerfil, tam);
      } else {
        ctx.drawImage(sheet, sx, 0, TILE_SIZE, TILE_SIZE, px, dy, larguraPerfil, tam);
      }
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, 0, TILE_SIZE, TILE_SIZE, dx, dy, tam, tam);
      if (player.dir === "cima") {
        // As folhas originais trazem a pose frontal. Esta leitura traseira
        // cobre rosto/peito com nuca, ombreiras e capa específicos da classe,
        // preservando arma, animação e identidade racial do sprite-base.
        const chave = String(player.spriteKey || "");
        const cor = chave.includes("mago") ? "#294d87"
          : chave.includes("clerigo") ? "#d6c7a0"
            : chave.includes("patrulheiro") ? "#315c43"
              : chave.includes("ladino") ? "#352b4c"
                : chave.includes("barbaro") ? "#6f302d" : "#443e55";
        ctx.fillStyle = "rgba(13,12,18,.82)";
        ctx.beginPath();
        ctx.ellipse(dx + tam * .5, dy + tam * .27, tam * .14, tam * .15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.moveTo(dx + tam * .31, dy + tam * .37);
        ctx.quadraticCurveTo(dx + tam * .5, dy + tam * .28, dx + tam * .69, dy + tam * .37);
        ctx.lineTo(dx + tam * .64, dy + tam * .73);
        ctx.quadraticCurveTo(dx + tam * .5, dy + tam * .82, dx + tam * .36, dy + tam * .73);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(224,210,172,.48)";
        ctx.lineWidth = Math.max(1, T * .018);
        ctx.beginPath();
        ctx.moveTo(dx + tam * .5, dy + tam * .4);
        ctx.lineTo(dx + tam * .5, dy + tam * .7);
        ctx.stroke();
      }
    }
    const tile = this.gridAtual?.[Math.floor(player.y)]?.[Math.floor(player.x)];
    if (tile === TILE.WATER) {
      // Água rasa cobre os pés e cria ondas: deixa claro que o herói entrou
      // na água, em vez de parecer apenas que caminhou sobre outro piso.
      ctx.globalAlpha = .62;
      ctx.fillStyle = "#5fc7da";
      ctx.fillRect(dx + tam * .18, dy + tam * .79, tam * .64, Math.max(2, T * .08));
      ctx.strokeStyle = "#d7fbff";
      ctx.lineWidth = Math.max(1, T * .025);
      ctx.beginPath(); ctx.arc(dx + tam * .5, dy + tam * .84, T * .32, 0, Math.PI); ctx.stroke();
    }
    ctx.restore();
  }

  // "Pressione E para interagir".
  //
  // No desktop ela fica no topo, como sempre foi. No celular NÃO pode ficar:
  // ali em cima moram as barras e o nome do lugar, e o texto era desenhado
  // POR BAIXO deles — saía embaralhado com o HUD. E o topo é o lugar errado
  // de qualquer forma: quem vai tocar o botão está olhando para baixo.
  // Então em tela pequena ela desce para a faixa livre entre o direcional e o
  // botão de ação, com uma tarja atrás para ser legível sobre qualquer chão.
  desenharDicaDeInteracao(texto) {
    const ctx = this.ctx;
    const cssParaCanvas = this.canvas.height / Math.max(1, this.canvas.clientHeight || this.canvas.height);
    const corpo = Math.round((this.telaPequena ? 15 : 14) * this.escala);
    ctx.save();
    ctx.font = `bold ${corpo}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = this.canvas.width / 2;
    const y = this.telaPequena
      ? this.canvas.height - Math.round((this.recuoRodapeCss || 96) * cssParaCanvas)
      : Math.round((this.recuoTopoCss || 0) * cssParaCanvas + 30 * this.escala);
    const larguraTexto = ctx.measureText(texto).width;
    ctx.fillStyle = "rgba(20,15,12,0.72)";
    const padX = 12 * this.escala;
    const padY = 7 * this.escala;
    ctx.fillRect(x - larguraTexto / 2 - padX, y - corpo / 2 - padY, larguraTexto + padX * 2, corpo + padY * 2);
    ctx.fillStyle = "rgba(245,165,36,0.95)";
    ctx.fillText(texto, x, y);
    ctx.restore();
  }

  // Marcador de "chefe se recuperando" (melhoria de jogabilidade #1): um
  // círculo esmaecido no lugar exato onde o chefe estava, com um anel que
  // esvazia conforme o cooldown passa (ver RESPAWN_CHEFE_MS/chefeDisponivel
  // em main.js) e um ícone de ampulheta — não depende de nenhum sprite
  // novo, só formas simples de canvas, então funciona em qualquer
  // implantação sem asset adicional.
  desenharChefeRecuperando(o, dx, dy) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const cx = dx + T / 2;
    const cy = dy + T / 2;
    const raio = T * 0.32;
    const derrotadoEm = o.ref && o.ref.derrotadoEm;
    const decorridoMs = derrotadoEm ? Date.now() - derrotadoEm : o.respawnMs;
    const fracaoRestante = Math.max(0, Math.min(1, 1 - decorridoMs / (o.respawnMs || 1)));

    ctx.save();
    // Base esmaecida (silhueta do chefe "apagado" — sem sprite disponível
    // aqui, só uma sombra translúcida) + anel de progresso do cooldown.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#1a1420";
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, 4 * this.escala);
    ctx.strokeStyle = "#4a3a26";
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.stroke();
    // Anel dourado "esvaziando" no sentido horário conforme o cooldown
    // passa — começa cheio (chefe acabou de cair) e some quando disponível
    // de novo (chefeDisponivel() volta a true no mesmo instante).
    ctx.strokeStyle = "#f5a524";
    ctx.beginPath();
    ctx.arc(cx, cy, raio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fracaoRestante);
    ctx.stroke();
    ctx.fillStyle = "rgba(241,233,216,0.85)";
    ctx.font = `bold ${Math.round(16 * this.escala)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⏳", cx, cy + 1);
    ctx.restore();
  }
}

export { TILE_ORDER };
