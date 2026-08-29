// Desenha o mapa em tiles e as entidades (jogador, NPCs, objetos) no canvas.
import { TILE_SIZE } from "../data/worldMap.js";

const TILE_ORDER = [
  "grass", "grass_detail", "path", "water", "tree", "wall_stone",
  "dungeon_floor", "dungeon_wall", "sand", "tall_grass", "village_floor", "bush",
];

export class Renderer {
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
      const dx = o.x * TILE_SIZE - cam.x;
      const dy = o.y * TILE_SIZE - cam.y;
      if (dx < -TILE_SIZE || dy < -TILE_SIZE || dx > this.canvas.width || dy > this.canvas.height) return;
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

  // Marcador de "chefe se recuperando" (melhoria de jogabilidade #1): um
  // círculo esmaecido no lugar exato onde o chefe estava, com um anel que
  // esvazia conforme o cooldown passa (ver RESPAWN_CHEFE_MS/chefeDisponivel
  // em main.js) e um ícone de ampulheta — não depende de nenhum sprite
  // novo, só formas simples de canvas, então funciona em qualquer
  // implantação sem asset adicional.
  desenharChefeRecuperando(o, dx, dy) {
    const ctx = this.ctx;
    const cx = dx + TILE_SIZE / 2;
    const cy = dy + TILE_SIZE / 2;
    const raio = TILE_SIZE * 0.32;
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
    ctx.lineWidth = 4;
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
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⏳", cx, cy + 1);
    ctx.restore();
  }
}

export { TILE_ORDER };
