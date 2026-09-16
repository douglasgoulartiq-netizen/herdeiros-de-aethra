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
import { TILE_SIZE, TILES_BASE, TILE_FALLBACK } from "../data/worldMap.js";
import { PROPS, propsVisiveis, caixaDoProp } from "../data/propRegistry.js";
import { MisturaDeTerreno } from "./TerrainBlend.js";

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
// Abaixo desta largura de CSS px o aparelho é tratado como tela pequena.
const LIMIAR_TELA_PEQUENA = 560;
// Teto do devicePixelRatio: acima de 3 o custo de preencher a tela cresce
// mais rápido que o ganho visual, e é onde celular antigo começa a engasgar.
const DPR_MAXIMO = 3;

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

  camera(playerPx, mapaWpx, mapaHpx) {
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    let cx = playerPx.x - vw / 2;
    let cy = playerPx.y - vh / 2;
    // Mapa menor que a tela (masmorra pequena no celular deitado): centraliza
    // em vez de grudar no canto.
    cx = mapaWpx <= vw ? (mapaWpx - vw) / 2 : Math.max(0, Math.min(cx, mapaWpx - vw));
    cy = mapaHpx <= vh ? (mapaHpx - vh) / 2 : Math.max(0, Math.min(cy, mapaHpx - vh));
    return { x: cx, y: cy };
  }

  // Desenha um prop de cenário. Devolve false quando a arte não está
  // disponível (arquivo ausente → placeholder de 32px), pra quem chama poder
  // simplesmente pular: o tile embaixo já foi desenhado e a colisão não
  // depende disto.
  desenharProp(prop, cam) {
    const meta = PROPS[prop.id];
    if (!meta) return false;
    const img = this.imagens[`prop_${prop.id}`];
    const larguraEsperada = meta.larguraTiles * TILE_SIZE;
    if (!img || img.width < larguraEsperada) return false;
    const caixa = caixaDoProp(prop);
    const T = this.tilePx;
    const dx = Math.round(caixa.tx * T - cam.x);
    const dy = Math.round(caixa.ty * T - cam.y);
    const w = Math.round(caixa.larguraTiles * T);
    const h = Math.round(caixa.alturaTiles * T);
    if (dx > this.canvas.width || dy > this.canvas.height || dx + w < 0 || dy + h < 0) return true;
    this.ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, w, h);
    return true;
  }

  desenhar({ grid, player, npcs, objetos, mostrarPronto, props, tema, pet }) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const mapaWpx = grid[0].length * T;
    const mapaHpx = grid.length * T;
    const playerPx = { x: player.x * T + T / 2, y: player.y * T + T / 2 };
    const cam = this.camera(playerPx, mapaWpx, mapaHpx);

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const colStart = Math.max(0, Math.floor(cam.x / T));
    const rowStart = Math.max(0, Math.floor(cam.y / T));
    const colEnd = Math.min(grid[0].length - 1, Math.ceil((cam.x + this.canvas.width) / T));
    const rowEnd = Math.min(grid.length - 1, Math.ceil((cam.y + this.canvas.height) / T));

    for (let ty = rowStart; ty <= rowEnd; ty++) {
      for (let tx = colStart; tx <= colEnd; tx++) {
        const dx = Math.round(tx * T - cam.x);
        const dy = Math.round(ty * T - cam.y);
        const { folha, coluna } = this.folhaDoTile(grid[ty][tx]);
        if (!folha) continue;
        ctx.drawImage(folha, coluna * this.tilesetTileW, 0, this.tilesetTileW, this.tilesetTileW, dx, dy, T, T);
        // Franja do vizinho de prioridade maior, por cima da borda deste tile
        // (ver TerrainBlend.js). Sai de graça no miolo: a função devolve na
        // primeira comparação quando não há fronteira.
        this.mistura.desenharFranjas(ctx, grid, tx, ty, dx, dy, T);
      }
    }

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
      if (item.tipo === "prop") { this.desenharProp(item.dado, cam); continue; }
      if (item.tipo === "objeto") { this.desenharObjeto(item.dado, cam); continue; }
      if (item.tipo === "npc") { this.desenharNpc(item.dado, cam); continue; }
      if (item.tipo === "pet") { this.desenharPet(item.dado, cam); continue; }
      this.desenharJogador(item.dado, playerPx, cam);
    }

    if (mostrarPronto) this.desenharDicaDeInteracao(mostrarPronto);
  }

  desenharObjeto(o, cam) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const dx = Math.round(o.x * T - cam.x);
    const dy = Math.round(o.y * T - cam.y);
    if (dx < -T || dy < -T || dx > this.canvas.width || dy > this.canvas.height) return;
    // Chefe em cooldown (melhoria de jogabilidade #1, ver main.js
    // objetosAtivos()): não tem sprite próprio — desenhado só com formas
    // de canvas (um anel "esvaziando" + relógio de areia), pra deixar
    // claro que o chefe ainda vai voltar e quanto falta, sem precisar de
    // nenhum asset novo.
    if (o.tipo === "chefe_recuperando") {
      this.desenharChefeRecuperando(o, dx, dy);
      return;
    }
    const img = this.imagens[o.imgKey];
    if (!img) return;
    ctx.drawImage(img, dx, dy, T, T);
  }

  desenharNpc(n, cam) {
    const ctx = this.ctx;
    const T = this.tilePx;
    const img = this.imagens[n.id] || this.imagens.npc_marker;
    const dx = Math.round(n.x * T - cam.x);
    const dy = Math.round(n.y * T - cam.y);
    if (dx < -T || dy < -T || dx > this.canvas.width || dy > this.canvas.height) return;
    if (img) ctx.drawImage(img, dx, dy, T, T);
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
    let ny = Math.max(12 * this.escala, dy - 4 * this.escala);
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
    const dy = Math.round(pet.y * T - cam.y + (T - tam) * 0.85);
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
    const dx = playerPx.x - cam.x - T / 2;
    const dy = playerPx.y - cam.y - T * 0.75;
    ctx.save();
    if (player.dir === "esquerda") {
      ctx.translate(dx + T, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, 0, TILE_SIZE, TILE_SIZE, 0, 0, T, T);
    } else {
      ctx.drawImage(sheet, sx, 0, TILE_SIZE, TILE_SIZE, dx, dy, T, T);
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
