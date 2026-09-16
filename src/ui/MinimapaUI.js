// MINIMAPA — o "micro" do pedido. Canto superior esquerdo, logo abaixo da
// faixa de status, mostrando os arredores imediatos do jogador.
//
// POR QUE ELE NÃO EXISTIA E POR QUE FAZ FALTA. O jogo tinha um Atlas (uma
// pintura do mapa-múndi com hotspots) e nada mais: para saber onde estava, o
// jogador tinha de parar o jogo e abrir um modal. Num mundo de 224x176 tiles
// com 48 zonas, isso significa que 90% do tempo de exploração acontece sem
// nenhuma referência espacial — anda-se para um lado até reconhecer alguma
// coisa. O minimapa resolve isso sem tirar o jogador do jogo, que é a única
// forma de resolver.
//
// DECISÕES:
//
// • Recorte, não mundo inteiro. Mostra um raio fixo de tiles em volta do
//   herói. Um minimapa que mostra o mundo todo em 170px não mostra nada: cada
//   zona teria 3 pixels. O mundo inteiro é o OUTRO mapa (MapaMundoUI.js), e é
//   para ele que este aqui leva com um clique.
//
// • Redesenha por MUDANÇA, não por quadro. O jogo roda a 60fps; o minimapa só
//   muda quando o herói troca de tile ou algo aparece. Redesenhar 1.500
//   retângulos 60 vezes por segundo para mostrar a mesma imagem seria queimar
//   bateria de celular à toa.
//
// • Funciona na masmorra também, lendo a grade ativa — lá ele vale ainda mais,
//   porque um labirinto gerado por semente é exatamente onde alguém se perde.
import { corDoTile } from "../systems/MapaSystem.js";

// Quantos tiles de cada lado do herói aparecem. 13 (27 de largura) é o
// entorno imediato: a praça da vila, a entrada da floresta, o baú do outro
// lado da cerca. Com 21, como estava primeiro, o recorte alcançava três zonas
// vizinhas de uma vez — informação verdadeira e inútil, porque a essa escala
// cada tile vira 4 pixels e o jogador não reconhece nada. O mundo inteiro é
// trabalho do outro mapa.
const RAIO_TILES = 13;
const ID = "minimapa";

let estado = null;

// `obterContexto` é uma função que devolve o estado atual do mundo. Recebe-se
// uma função, e não os dados, porque o minimapa vive fora do loop do jogo e
// precisa perguntar "como está agora?" — main.js não fica empurrando estado.
export function montarMinimapa(obterContexto, aoAbrirMapa) {
  if (document.getElementById(ID)) return estado;

  const caixa = document.createElement("div");
  caixa.id = ID;
  caixa.className = "minimapa";
  caixa.innerHTML = `
    <button type="button" class="minimapa-tela" title="Abrir o mapa-múndi (U)" aria-label="Abrir o mapa-múndi">
      <canvas class="minimapa-canvas" width="176" height="140"></canvas>
      <span class="minimapa-lupa" aria-hidden="true">⛶</span>
    </button>
    <div class="minimapa-rodape">
      <span class="minimapa-zona"></span>
      <span class="minimapa-nivel"></span>
    </div>`;
  document.getElementById("app").appendChild(caixa);

  const canvas = caixa.querySelector(".minimapa-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  caixa.querySelector(".minimapa-tela").onclick = () => aoAbrirMapa && aoAbrirMapa();

  estado = { caixa, canvas, ctx, obterContexto, ultimaChave: "" };
  atualizarMinimapa();
  return estado;
}

export function minimapaVisivel() {
  return !!estado && !estado.caixa.classList.contains("hidden");
}

export function mostrarMinimapa(visivel) {
  if (estado) estado.caixa.classList.toggle("hidden", !visivel);
}

// Chamado pelo loop do jogo. Sai cedo quando nada mudou — é o que torna
// seguro chamá-lo a cada quadro.
export function atualizarMinimapa() {
  if (!estado) return;
  const ctx0 = estado.obterContexto && estado.obterContexto();
  if (!ctx0 || !ctx0.grid || !ctx0.player) return;

  const { grid, player, zonaNome, nivelTexto, nivelCor } = ctx0;
  const px = Math.round(player.x), py = Math.round(player.y);
  // A chave resume tudo que o desenho depende. Igual à anterior = nada a fazer.
  const chave = `${ctx0.mapaAtual}|${px},${py}|${player.dir}|${(ctx0.npcs || []).length}|${(ctx0.objetos || []).length}|${zonaNome}`;
  if (chave === estado.ultimaChave) return;
  estado.ultimaChave = chave;

  desenhar(estado.ctx, estado.canvas, ctx0, px, py);

  const elZona = estado.caixa.querySelector(".minimapa-zona");
  const elNivel = estado.caixa.querySelector(".minimapa-nivel");
  elZona.textContent = zonaNome || "";
  elNivel.textContent = nivelTexto || "";
  elNivel.style.color = nivelCor || "var(--hud-apagado, #c8b89a)";
}

function desenhar(ctx, canvas, dados, px, py) {
  const { grid, player, npcs = [], objetos = [] } = dados;
  const larguraTiles = RAIO_TILES * 2 + 1;
  const passo = canvas.width / larguraTiles;
  const alturaTiles = Math.ceil(canvas.height / passo);
  const meioY = Math.floor(alturaTiles / 2);

  ctx.fillStyle = "#0d0a12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tiles. Meio pixel a mais em cada retângulo evita a costura clara que
  // aparece entre células quando `passo` não é inteiro.
  for (let dy = -meioY; dy <= alturaTiles - meioY; dy += 1) {
    for (let dx = -RAIO_TILES; dx <= RAIO_TILES; dx += 1) {
      const tx = px + dx, ty = py + dy;
      if (ty < 0 || tx < 0 || ty >= grid.length || tx >= grid[0].length) continue;
      ctx.fillStyle = corDoTile(grid[ty][tx]);
      ctx.fillRect((dx + RAIO_TILES) * passo, (dy + meioY) * passo, passo + 0.5, passo + 0.5);
    }
  }

  const naTela = (tx, ty) => ({
    x: (tx - px + RAIO_TILES) * passo + passo / 2,
    y: (ty - py + meioY) * passo + passo / 2,
  });
  const dentro = (p) => p.x >= -4 && p.y >= -4 && p.x <= canvas.width + 4 && p.y <= canvas.height + 4;

  // Objetos primeiro, NPCs por cima, herói por último: se dois ocupam o mesmo
  // ponto, quem tem de aparecer é o mais importante.
  objetos.forEach((o) => {
    const p = naTela(o.x, o.y);
    if (!dentro(p)) return;
    const cor = o.aberto || o.coletado ? "#6b6055" : (o.tipo === "no" || o.recurso ? "#7ad17a" : "#f5c542");
    ponto(ctx, p.x, p.y, Math.max(2, passo * 0.42), cor, "#2a1f14");
  });

  npcs.forEach((n) => {
    const p = naTela(n.x, n.y);
    if (!dentro(p)) return;
    ponto(ctx, p.x, p.y, Math.max(2.2, passo * 0.46), "#6fb7ff", "#10243a");
  });

  // O herói é uma SETA, não um ponto: além de onde ele está, mostra para onde
  // ele olha — que é metade da orientação que um minimapa serve para dar.
  const c = naTela(px, py);
  seta(ctx, c.x, c.y, Math.max(4, passo * 0.85), player.dir || "baixo");

  // Moldura interna, para o mapa não sangrar na borda arredondada.
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function ponto(ctx, x, y, r, cor, borda) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = borda;
  ctx.stroke();
}

const ANGULO = { cima: -Math.PI / 2, baixo: Math.PI / 2, esquerda: Math.PI, direita: 0 };

function seta(ctx, x, y, tam, dir) {
  const a = ANGULO[dir] ?? Math.PI / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(tam, 0);
  ctx.lineTo(-tam * 0.7, -tam * 0.72);
  ctx.lineTo(-tam * 0.32, 0);
  ctx.lineTo(-tam * 0.7, tam * 0.72);
  ctx.closePath();
  ctx.fillStyle = "#f5a524";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#2a1c08";
  ctx.stroke();
  ctx.restore();
}

// Força o próximo `atualizarMinimapa` a redesenhar mesmo que a chave não
// tenha mudado — usado ao voltar de uma tela cheia, quando o canvas pode ter
// sido limpo pelo navegador.
export function invalidarMinimapa() {
  if (estado) estado.ultimaChave = "";
}
