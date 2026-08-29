// Script de verificação: roda buildOverworld()/buildDungeon()/buildDungeon2(),
// confere dimensões, bounding boxes das zonas, conectividade básica (flood
// fill a partir da vila) e referências cruzadas com monsters/lootTables/quests.
import fs from "node:fs";
import {
  TILE, OVERWORLD_W, OVERWORLD_H, DUNGEON_W, DUNGEON_H, DUNGEON2_W, DUNGEON2_H,
  buildOverworld, buildDungeon, buildDungeon2, ZONAS, zonaNoPonto,
  CHESTS_OVERWORLD, NODES_OVERWORLD, NPC_POSICOES, DUNGEON_ENTRANCE, DUNGEON2_ENTRANCE,
  SOLID_TILES,
} from "../src/data/worldMap.js";

let falhas = 0;
function checar(cond, msg) {
  if (!cond) { console.error("FALHA:", msg); falhas++; }
  else console.log("ok:", msg);
}

const overworld = buildOverworld();
checar(overworld.length === OVERWORLD_H, `overworld tem ${overworld.length} linhas (esperado ${OVERWORLD_H})`);
checar(overworld.every((row) => row.length === OVERWORLD_W), `todas as linhas do overworld têm ${OVERWORLD_W} colunas`);

const dungeon = buildDungeon();
checar(dungeon.length === DUNGEON_H && dungeon.every((r) => r.length === DUNGEON_W), "dungeon1 tem dimensões corretas");

const dungeon2 = buildDungeon2();
checar(dungeon2.length === DUNGEON2_H && dungeon2.every((r) => r.length === DUNGEON2_W), "dungeon2 tem dimensões corretas");

checar(ZONAS.length >= 22, `ZONAS tem ${ZONAS.length} zonas (>= 22)`);

for (const z of ZONAS) {
  const dentro = z.x0 >= 0 && z.y0 >= 0 && z.x1 < OVERWORLD_W && z.y1 < OVERWORLD_H && z.x0 <= z.x1 && z.y0 <= z.y1;
  checar(dentro, `zona ${z.id} bbox dentro do grid (${z.x0},${z.y0})-(${z.x1},${z.y1})`);
}

// Nenhuma zona deve se sobrepor a outra (checagem simples por amostragem de cantos+centro)
let sobreposicoes = 0;
for (let i = 0; i < ZONAS.length; i++) {
  for (let j = i + 1; j < ZONAS.length; j++) {
    const a = ZONAS[i], b = ZONAS[j];
    const overlap = a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
    if (overlap) { sobreposicoes++; console.error("FALHA: sobreposição entre", a.id, "e", b.id); }
  }
}
checar(sobreposicoes === 0, "nenhuma zona se sobrepõe a outra");

// zonaNoPonto funciona para o centro de cada zona
for (const z of ZONAS) {
  const cx = Math.floor((z.x0 + z.x1) / 2);
  const cy = Math.floor((z.y0 + z.y1) / 2);
  const achada = zonaNoPonto(cx, cy);
  checar(achada && achada.id === z.id, `zonaNoPonto(${cx},${cy}) retorna ${z.id}`);
}
checar(zonaNoPonto(-1, -1) === null, "zonaNoPonto fora do grid retorna null");

// Flood fill de conectividade a partir da vila (0-15,0-13 é chão de vila).
function floodFill(g, sx, sy) {
  const h = g.length, w = g[0].length;
  const visitado = Array.from({ length: h }, () => new Array(w).fill(false));
  const pilha = [[sx, sy]];
  visitado[sy][sx] = true;
  let count = 0;
  while (pilha.length) {
    const [x, y] = pilha.pop();
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (visitado[ny][nx]) continue;
      if (SOLID_TILES.has(g[ny][nx])) continue;
      visitado[ny][nx] = true;
      pilha.push([nx, ny]);
    }
  }
  return { count, visitado };
}

const { count, visitado } = floodFill(overworld, 8, 6);
const totalTiles = OVERWORLD_W * OVERWORLD_H;
console.log(`flood fill a partir da vila alcançou ${count} de ${totalTiles} tiles`);
checar(count > totalTiles * 0.5, "flood fill alcança mais da metade do mapa (mundo bem conectado)");

// Cada zona deve ter pelo menos um tile alcançável a partir da vila (checa o centro
// ou, se sólido, varre a bbox procurando um tile andável alcançado).
let zonasInalcancaveis = [];
for (const z of ZONAS) {
  let achou = false;
  for (let y = z.y0; y <= z.y1 && !achou; y++) {
    for (let x = z.x0; x <= z.x1 && !achou; x++) {
      if (visitado[y][x]) achou = true;
    }
  }
  if (!achou) zonasInalcancaveis.push(z.id);
}
checar(zonasInalcancaveis.length === 0, `todas as zonas têm algum tile alcançável a partir da vila (inalcançáveis: ${zonasInalcancaveis.join(", ") || "nenhuma"})`);

// Pontos fixos (baús, nós, NPCs, entradas de masmorra) nunca em tile sólido
for (const c of CHESTS_OVERWORLD) checar(!SOLID_TILES.has(overworld[c.y][c.x]), `baú ${c.id} não está em tile sólido`);
for (const n of NODES_OVERWORLD) checar(!SOLID_TILES.has(overworld[n.y][n.x]), `nó ${n.id} não está em tile sólido`);
for (const [id, p] of Object.entries(NPC_POSICOES)) checar(!SOLID_TILES.has(overworld[p.y][p.x]), `npc ${id} não está em tile sólido`);
checar(!SOLID_TILES.has(overworld[DUNGEON_ENTRANCE.y][DUNGEON_ENTRANCE.x]), "entrada da masmorra 1 não está em tile sólido");
checar(!SOLID_TILES.has(overworld[DUNGEON2_ENTRANCE.y][DUNGEON2_ENTRANCE.x]), "entrada da masmorra 2 não está em tile sólido");

// Referência cruzada: monstros citados em ZONAS existem em monsters.json
const monsters = JSON.parse(fs.readFileSync(new URL("../src/data/monsters.json", import.meta.url)));
const monsterIds = new Set(monsters.map((m) => m.id));
for (const z of ZONAS) {
  for (const mid of z.monstros) {
    checar(monsterIds.has(mid), `monstro '${mid}' referenciado pela zona ${z.id} existe em monsters.json`);
  }
}

// Referência cruzada: lootTables.json cobre todo monstro (exceto os que não têm tabela = ok)
const loot = JSON.parse(fs.readFileSync(new URL("../src/data/lootTables.json", import.meta.url)));
for (const m of monsters) {
  checar(!!loot[m.id], `monstro '${m.id}' tem entrada em lootTables.json`);
}

// Referência cruzada: itens usados em lootTables e quests existem em items.json
const itemsData = JSON.parse(fs.readFileSync(new URL("../src/data/items.json", import.meta.url)));
const itemIds = new Set(itemsData.itens.map((i) => i.id));
for (const [tabelaId, tabela] of Object.entries(loot)) {
  for (const entrada of tabela.pool) {
    checar(itemIds.has(entrada.itemId), `item '${entrada.itemId}' (tabela ${tabelaId}) existe em items.json`);
  }
}

const quests = JSON.parse(fs.readFileSync(new URL("../src/data/quests.json", import.meta.url)));
const npcs = JSON.parse(fs.readFileSync(new URL("../src/data/npcs.json", import.meta.url)));
const npcIds = new Set(npcs.map((n) => n.id));
for (const q of quests) {
  checar(npcIds.has(q.npcId), `quest ${q.id} aponta para npcId '${q.npcId}' existente`);
  if (q.recompensaItemId) checar(itemIds.has(q.recompensaItemId), `quest ${q.id} recompensaItemId '${q.recompensaItemId}' existe`);
  if (q.tipo === "matar") checar(monsterIds.has(q.alvo), `quest ${q.id} alvo '${q.alvo}' existe em monsters.json`);
  if (q.tipo === "coletar") checar(itemIds.has(q.itemAlvo), `quest ${q.id} itemAlvo '${q.itemAlvo}' existe em items.json`);
  checar(typeof q.recompensaFragmentos === "number" && q.recompensaFragmentos > 0, `quest ${q.id} tem recompensaFragmentos válido`);
}

console.log("\n===", falhas === 0 ? "TODAS AS VERIFICAÇÕES PASSARAM" : `${falhas} FALHA(S) ENCONTRADA(S)`, "===");
process.exit(falhas === 0 ? 0 : 1);
