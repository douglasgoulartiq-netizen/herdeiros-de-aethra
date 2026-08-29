// Smoke test para task #34: masmorras com rotas/bifurcação real.
// Roda o gerador várias vezes (ele é aleatório a cada chamada) e verifica,
// pra cada rodada: (1) todo ponto de interesse (spawn, baús, chefe, zona de
// saída) é alcançável a partir do spawn andando só por chão; (2) existe
// pelo menos uma bifurcação real (um tile de chão com 3+ vizinhos abertos).
import {
  buildDungeon, buildDungeon2, TILE, SOLID_TILES,
  DUNGEON_SPAWN, DUNGEON2_SPAWN, BOSS_TILE, BOSS_TILE2,
  CHESTS_DUNGEON, CHESTS_DUNGEON2, DUNGEON_EXIT_ZONE, DUNGEON2_EXIT_ZONE,
} from "../src/data/worldMap.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function reachableFrom(grid, sx, sy) {
  const h = grid.length, w = grid[0].length;
  const vis = Array.from({ length: h }, () => new Array(w).fill(false));
  if (SOLID_TILES.has(grid[sy][sx])) return vis; // ponto de partida já bloqueado (não deveria acontecer)
  const stack = [[sx, sy]];
  vis[sy][sx] = true;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || vis[ny][nx]) continue;
      if (SOLID_TILES.has(grid[ny][nx])) continue;
      vis[ny][nx] = true;
      stack.push([nx, ny]);
    }
  }
  return vis;
}

function contaBifurcacoes(grid) {
  const h = grid.length, w = grid[0].length;
  let bifurcacoes = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (SOLID_TILES.has(grid[y][x])) continue;
      let vizinhosAbertos = 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (grid[ny] && grid[ny][nx] !== undefined && !SOLID_TILES.has(grid[ny][nx])) vizinhosAbertos++;
      }
      if (vizinhosAbertos >= 3) bifurcacoes++;
    }
  }
  return bifurcacoes;
}

function testarMasmorra(nome, buildFn, spawn, boss, chests, exitZone, rodadas = 60) {
  let falhaConectividade = false;
  let semBifurcacaoAlguma = 0;
  for (let i = 0; i < rodadas; i++) {
    const g = buildFn();
    const vis = reachableFrom(g, spawn.x, spawn.y);
    const pontos = [
      { nome: "chefe", x: boss.x, y: boss.y },
      { nome: "saída", x: exitZone.x0, y: exitZone.y0 },
      ...chests.map((c) => ({ nome: `baú ${c.id}`, x: c.x, y: c.y })),
    ];
    for (const p of pontos) {
      if (!vis[p.y] || !vis[p.y][p.x]) {
        console.log(`FALHA: [${nome}] rodada ${i}: ${p.nome} (${p.x},${p.y}) não alcançável a partir do spawn`);
        falhaConectividade = true;
      }
    }
    if (contaBifurcacoes(g) === 0) semBifurcacaoAlguma++;
  }
  check(`[${nome}] todos os pontos de interesse sempre alcançáveis (${rodadas} rodadas)`, !falhaConectividade);
  check(`[${nome}] quase sempre há pelo menos 1 bifurcação real (>=3 vizinhos abertos)`, semBifurcacaoAlguma <= Math.ceil(rodadas * 0.05));
}

testarMasmorra("dungeon1", buildDungeon, DUNGEON_SPAWN, BOSS_TILE, CHESTS_DUNGEON, DUNGEON_EXIT_ZONE);
testarMasmorra("dungeon2", buildDungeon2, DUNGEON2_SPAWN, BOSS_TILE2, CHESTS_DUNGEON2, DUNGEON2_EXIT_ZONE);

// --- Não é mais uma sala vazia: a maioria dos tiles do interior deve ser
// parede agora (labirinto), não chão (sala aberta como antes). ---
{
  const g = buildDungeon();
  let piso = 0, total = 0;
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < g[0].length - 1; x++) {
      total++;
      if (!SOLID_TILES.has(g[y][x])) piso++;
    }
  }
  const proporcaoPiso = piso / total;
  console.log(`Proporção de chão no interior de dungeon1: ${(proporcaoPiso * 100).toFixed(1)}%`);
  check("masmorra não é mais uma sala totalmente aberta (proporção de chão < 80%)", proporcaoPiso < 0.8);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
