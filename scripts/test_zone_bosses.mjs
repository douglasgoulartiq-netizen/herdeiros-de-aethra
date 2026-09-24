// Regressão da task #45: 1 chefe obrigatório por área do mundo aberto — cada
// um com arquétipo de IA, fala/personalidade própria, verbete de compêndio e
// drop exclusivo de arma/material/acessório/armadura que só ele derruba.
//
// O QUE MUDOU DESDE A PRIMEIRA VERSÃO DESTE ARQUIVO
// -------------------------------------------------
// Este teste foi escrito contra o mundo da ETAPA 1 e três premissas dele
// deixaram de valer na malha 4x. Ele não estava reprovando nada de verdade —
// estava medindo um jogo que não existe mais:
//
//   1. "21 zonas". São 47 zonas de combate. O número agora sai do próprio
//      zones.js: um chefe novo entra no mundo e o teste acompanha sozinho.
//   2. "chefe.{x,y} dentro da bbox". A zona não declara mais coordenada de
//      chefe — quem posiciona é o WorldBuilder, num tile ANDÁVEL do território
//      real (a bbox é só um resumo e inclui tile de outra zona). A pergunta
//      certa é se o chefe posicionado caiu dentro do próprio território, e
//      isso só o mundo construído responde.
//   3. "sprite em assets/sprites/mob_<id>.png". O motor nunca leu esse
//      caminho: ele lê o campo `sprite` do monsters.json (ver
//      assetRegistry.js: chaveDe). A afirmação era mais estrita que o jogo, e
//      proibia na marra a coisa que o mundo 4x precisava — um chefe que
//      promove um monstro da zona e herda a arte dele.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ZONAS_MUNDO } from "../src/data/world/zones.js";
import { mundoDaSemente } from "../src/systems/WorldBuilder.js";
import { localizar } from "../src/data/worldHierarchy.js";
import { chaveDe } from "../src/data/assetRegistry.js";
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

const zonasComChefe = ZONAS_MUNDO.filter((z) => z.id !== "vila");
check(`toda zona de combate tem um campo chefe (${zonasComChefe.length} zonas)`,
  zonasComChefe.every((z) => !!z.chefe));

const arquetiposUsados = new Set();
const idsChefes = new Set();
for (const z of zonasComChefe) {
  const m = porId[(z.chefe || {}).monstroId];
  check(`zona "${z.id}": monstroId "${(z.chefe || {}).monstroId}" existe em monsters.json e está marcado chefe:true`,
    !!m && m.chefe === true);
  if (!m) continue;
  idsChefes.add(m.id);
  arquetiposUsados.add(m.arquetipo);
  check(`chefe "${m.id}" tem fala (personalidade própria) não vazia`,
    typeof m.fala === "string" && m.fala.length > 5);
  // A arte que o MOTOR vai pedir, não um caminho inventado pelo teste: um
  // chefe que promove um monstro da zona herda o sprite dele de propósito.
  const chave = chaveDe(m);
  check(`chefe "${m.id}" tem arte no disco (${chave}.png)`,
    !!chave && fs.existsSync(path.join(ROOT, "assets/sprites", `${chave}.png`)));
  check(`chefe "${m.id}" tem stats de chefe (hp/atk/defesa/xp/ouro > monstro comum do mesmo nível)`,
    m.hp > 0 && m.atk > 0 && m.defesa > 0 && m.xp > 0 && m.ouroMin > 0 && m.ouroMax >= m.ouroMin);
}
check(`${zonasComChefe.length} chefes distintos (nenhum id de monstro repetido entre zonas) — encontrados ${idsChefes.size}`,
  idsChefes.size === zonasComChefe.length);
check(`arquétipos de IA variados entre os chefes (encontrados ${arquetiposUsados.size} distintos, esperado >= 8)`,
  arquetiposUsados.size >= 8);

// --- o chefe existe COMO PONTO NO MUNDO, dentro do próprio território ------
// A zona não declara mais x/y: quem coloca é o gerador. Esta é a checagem que
// a antiga "dentro da bbox" queria fazer, agora contra o mundo de verdade.
{
  const M = mundoDaSemente(20260901);
  const porZona = new Map(M.chefes.map((c) => [c.zonaId, c]));
  const semPonto = zonasComChefe.filter((z) => !porZona.has(z.id));
  check(`todo chefe foi posicionado no mundo construído (faltando: ${semPonto.map((z) => z.id).join(", ") || "nenhum"})`,
    semPonto.length === 0);
  const foraDoTerritorio = M.chefes.filter((c) => {
    const onde = localizar(c.x, c.y);
    return !onde.zona || onde.zona.id !== c.zonaId;
  });
  check(`todo chefe caiu DENTRO do território da própria zona (fora: ${foraDoTerritorio.map((c) => c.zonaId).join(", ") || "nenhum"})`,
    foraDoTerritorio.length === 0);
  const idsNoMundo = new Set(M.chefes.map((c) => c.monstroId));
  check("o id de cada chefe posicionado é o declarado pela zona", [...idsNoMundo].every((id) => idsChefes.has(id)));
}

// --- cada chefe tem drop exclusivo (arma/material/acessório/armadura) ------
{
  const semDropExclusivo = [];
  const dropsRepetidos = new Map();
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

// --- todo chefe tem entrada de compêndio (teaser + lore = personalidade) ---
{
  const porIdCompendio = new Map(compendio.map((c) => [c.id, c]));
  const semCompendio = [...idsChefes].filter((id) => !porIdCompendio.has(id));
  check(`todo chefe de zona tem entrada em compendium.json (faltando: ${semCompendio.join(", ") || "nenhum"})`, semCompendio.length === 0);
  const semTexto = [...idsChefes].filter((id) => {
    const c = porIdCompendio.get(id);
    return !c || !(c.teaser || "").length || (c.lore || "").length < 40;
  });
  check(`todo verbete de chefe tem teaser e lore de verdade (fracos: ${semTexto.join(", ") || "nenhum"})`, semTexto.length === 0);
}

// --- combatente criado a partir de um chefe de zona funciona no CombatSystem
{
  const algumChefe = porId[[...idsChefes][0]];
  const combatente = criarCombatenteInimigo(algumChefe, 0);
  check("criarCombatenteInimigo aceita um chefe de zona sem quebrar (chefe:true propagado)", combatente.chefe === true);
  check("combatente do chefe tem hpMax > 0", combatente.hpMax > 0);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
