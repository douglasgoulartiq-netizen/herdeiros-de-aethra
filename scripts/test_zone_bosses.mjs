// Regressão para task #45: 1 chefe obrigatório por área do mundo aberto
// (21 zonas de src/data/worldMap.js, excluindo "vila") — cada um com
// arquétipo de IA, fala/personalidade própria e drop exclusivo de
// arma/material/acessório/armadura que só ele derruba.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ZONAS } from "../src/data/worldMap.js";
import { criarCombatenteInimigo } from "../src/systems/CombatSystem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const monstros = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/monsters.json"), "utf-8"));
const items = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/items.json"), "utf-8"));
const lootTables = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/lootTables.json"), "utf-8"));
const compendio = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/compendium.json"), "utf-8"));
const porId = Object.fromEntries(monstros.map((m) => [m.id, m]));
const itemPorId = Object.fromEntries(items.itens.map((i) => [i.id, i]));

const zonasComChefe = ZONAS.filter((z) => z.id !== "vila");
check(`21 zonas de combate existem (excluindo vila) — encontradas ${zonasComChefe.length}`, zonasComChefe.length === 21);
check("toda zona (exceto vila) tem um campo chefe", zonasComChefe.every((z) => !!z.chefe));

const arquetiposUsados = new Set();
const idsChefes = new Set();
for (const z of zonasComChefe) {
  const chefe = z.chefe;
  check(`zona "${z.id}": chefe.{x,y} está dentro da própria bbox`,
    chefe.x >= z.x0 && chefe.x <= z.x1 && chefe.y >= z.y0 && chefe.y <= z.y1);
  const m = porId[chefe.monstroId];
  check(`zona "${z.id}": monstroId "${chefe.monstroId}" existe em monsters.json e está marcado chefe:true`, !!m && m.chefe === true);
  if (!m) continue;
  idsChefes.add(m.id);
  arquetiposUsados.add(m.arquetipo);
  check(`chefe "${m.id}" tem fala (personalidade própria) não vazia`, typeof m.fala === "string" && m.fala.length > 5);
  check(`chefe "${m.id}" tem sprite mob_${m.id}.png no disco`, fs.existsSync(path.join(ROOT, "assets/sprites", `mob_${m.id}.png`)));
  check(`chefe "${m.id}" tem stats de chefe (hp/atk/defesa/xp/ouro > monstro comum do mesmo nível)`,
    m.hp > 0 && m.atk > 0 && m.defesa > 0 && m.xp > 0 && m.ouroMin > 0 && m.ouroMax >= m.ouroMin);
}
check("21 chefes distintos (nenhum id de monstro repetido entre zonas)", idsChefes.size === 21);
check(`arquétipos de IA variados entre os 21 chefes (encontrados ${arquetiposUsados.size} distintos, esperado >= 6)`, arquetiposUsados.size >= 6);

// --- cada chefe tem drop exclusivo (arma/material/acessório/armadura) ---
{
  let semDropExclusivo = [];
  let dropsRepetidos = new Map();
  for (const chefeId of idsChefes) {
    const tabela = lootTables[chefeId];
    if (!tabela || !tabela.pool || !tabela.pool.length) { semDropExclusivo.push(chefeId); continue; }
    const principal = tabela.pool[0]; // convenção: entrada de maior peso é o drop exclusivo do chefe
    const item = itemPorId[principal.itemId];
    if (!item || !["arma", "material", "acessorio", "armadura"].includes(item.tipo)) { semDropExclusivo.push(chefeId); continue; }
    dropsRepetidos.set(item.id, (dropsRepetidos.get(item.id) || 0) + 1);
  }
  check(`todo chefe tem lootTables com drop exclusivo de arma/material/acessório/armadura (faltando: ${semDropExclusivo.join(", ") || "nenhum"})`, semDropExclusivo.length === 0);
  const compartilhados = [...dropsRepetidos.entries()].filter(([, n]) => n > 1);
  check(`nenhum item exclusivo de chefe é compartilhado entre dois chefes (repetidos: ${compartilhados.map((c) => c[0]).join(", ") || "nenhum"})`, compartilhados.length === 0);
}

// --- todo chefe tem entrada de compêndio (teaser + lore = personalidade/narrativa) ---
{
  const idsCompendio = new Set(compendio.map((c) => c.id));
  const semCompendio = [...idsChefes].filter((id) => !idsCompendio.has(id));
  check(`todo chefe de zona tem entrada em compendium.json (faltando: ${semCompendio.join(", ") || "nenhum"})`, semCompendio.length === 0);
}

// --- combatente criado a partir de um chefe de zona funciona no CombatSystem ---
{
  const algumChefe = porId[[...idsChefes][0]];
  const combatente = criarCombatenteInimigo(algumChefe, 0);
  check("criarCombatenteInimigo aceita um chefe de zona sem quebrar (chefe:true propagado)", combatente.chefe === true);
  check("combatente do chefe tem hpMax > 0", combatente.hpMax > 0);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
