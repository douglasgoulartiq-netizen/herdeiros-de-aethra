// Regressão para task #48: expansão do bestiário/enciclopédia com 16
// monstros novos (29 -> 45), preenchendo lacunas elementais que existiam
// desde o sistema de terreno (task #42) — nenhum monstro usava gelo, raio,
// radiante ou arcano antes disso.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const monstros = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/monsters.json"), "utf-8"));
const compendio = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/compendium.json"), "utf-8"));
const worldMapSrc = fs.readFileSync(path.join(ROOT, "src/data/worldMap.js"), "utf-8");

const NOVOS = [
  "rato_gigante", "abelha_titan", "corvo_ceifador", "cristal_ecoante",
  "wisp_radiante", "sentinela_dourada", "gralha_tempestuosa", "verme_das_dunas",
  "arraia_relampago", "enguia_eletrica", "sentinela_arcana", "espectro_arcano",
  "lobo_gelido", "bruxa_da_bruma", "construto_arcano", "carrasco_de_cinzas",
];

// >= 45 (não ===) porque tasks futuras (ex.: #45, chefes de zona) também
// acrescentam entradas a monsters.json depois desta.
check(`monsters.json cresceu para pelo menos 45 entradas (29 originais + 16 novas desta task)`, monstros.length >= 45);

const porId = Object.fromEntries(monstros.map((m) => [m.id, m]));
for (const id of NOVOS) {
  const m = porId[id];
  check(`monstro novo "${id}" existe em monsters.json`, !!m);
  if (!m) continue;
  check(`"${id}" tem nivel/hp/atk/defesa/vel/xp/ouro válidos`,
    m.nivel > 0 && m.hp > 0 && m.atk > 0 && m.defesa >= 0 && m.vel > 0 && m.xp > 0 && m.ouroMin >= 0 && m.ouroMax >= m.ouroMin);
  check(`"${id}" tem arquetipo e bioma definidos`, typeof m.arquetipo === "string" && Array.isArray(m.bioma) && m.bioma.length > 0);
  check(`"${id}" tem sprite mob_${id}.png no disco`, fs.existsSync(path.join(ROOT, "assets/sprites", `mob_${id}.png`)));
}

// --- preenche as lacunas elementais que o sistema de terreno (task #42) deixou ---
{
  const elementosNovos = new Set(monstros.filter((m) => NOVOS.includes(m.id)).map((m) => m.elemento).filter(Boolean));
  check("bestiário agora tem monstro(s) de elemento gelo", elementosNovos.has("gelo"));
  check("bestiário agora tem monstro(s) de elemento raio", elementosNovos.has("raio"));
  check("bestiário agora tem monstro(s) de elemento radiante", elementosNovos.has("radiante"));
  check("bestiário agora tem monstro(s) de elemento arcano", elementosNovos.has("arcano"));
}

// --- todo monstro (velho e novo) tem entrada correspondente no compêndio ---
{
  const idsCompendio = new Set(compendio.map((c) => c.id));
  const semCompendio = monstros.filter((m) => !idsCompendio.has(m.id)).map((m) => m.id);
  check(`todos os ${monstros.length} monstros têm entrada em compendium.json (faltando: ${semCompendio.join(", ") || "nenhum"})`, semCompendio.length === 0);
  const semTeaserOuLore = compendio.filter((c) => !c.teaser || !c.lore);
  check("toda entrada do compêndio tem teaser e lore não vazios", semTeaserOuLore.length === 0);
}

// --- invocadores novos (espectro_arcano, bruxa_da_bruma) têm invocacao válida ---
{
  const espectro = porId["espectro_arcano"];
  const bruxa = porId["bruxa_da_bruma"];
  check("espectro_arcano (invocador) tem campo invocacao com stats", !!espectro.invocacao && espectro.invocacao.hp > 0);
  check("bruxa_da_bruma (invocador) tem campo invocacao com stats", !!bruxa.invocacao && bruxa.invocacao.hp > 0);
}

// --- worldMap.js: cada monstro novo foi posicionado em pelo menos 1 zona ---
{
  const naoPosicionados = NOVOS.filter((id) => !worldMapSrc.includes(`"${id}"`));
  check(`todo monstro novo aparece em ao menos uma zona de worldMap.js (faltando: ${naoPosicionados.join(", ") || "nenhum"})`, naoPosicionados.length === 0);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
