// Regressão para task #49: expandir o roster de gacha de 24 para 100
// personagens, mantendo a taxonomia de 5 raridades e pelo menos 10% (>=10)
// de lendários dentro dos 100.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { criarCombatenteJogador } from "../src/systems/CombatSystem.js";
import { instanciarPersonagemGacha } from "../src/systems/GachaSystem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const roster = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/gachaRoster.json"), "utf-8"));
const classes = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/classes.json"), "utf-8"));
const racas = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/races.json"), "utf-8"));
const worldState = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/worldStateVariables.json"), "utf-8"));
const classeIds = new Set(classes.map((c) => c.id));
const racaIds = new Set(racas.map((r) => r.id));
const facaoIds = new Set(worldState.facoes.map((f) => f.id));

check(`roster tem exatamente 100 personagens (encontrado ${roster.length})`, roster.length === 100);

const ids = roster.map((p) => p.id);
check("nenhum id duplicado no roster", new Set(ids).size === ids.length);
const nomes = roster.map((p) => p.nome);
check("nenhum nome duplicado no roster", new Set(nomes).size === nomes.length);

const RARIDADES = ["comum", "incomum", "raro", "epico", "lendario"];
const contagem = Object.fromEntries(RARIDADES.map((r) => [r, 0]));
for (const p of roster) {
  check(`"${p.id}": raridade "${p.raridade}" é uma das 5 raridades válidas`, RARIDADES.includes(p.raridade));
  contagem[p.raridade] = (contagem[p.raridade] || 0) + 1;
}
console.log("Distribuição por raridade:", JSON.stringify(contagem));
check(`pelo menos 10% (>=10) dos 100 são lendários (encontrado ${contagem.lendario})`, contagem.lendario >= 10);
check("todas as 5 raridades têm pelo menos 1 personagem", RARIDADES.every((r) => contagem[r] > 0));

let semCampo = [];
for (const p of roster) {
  if (!classeIds.has(p.classeId)) semCampo.push(`${p.id}: classeId inválido (${p.classeId})`);
  if (!racaIds.has(p.racaId)) semCampo.push(`${p.id}: racaId inválido (${p.racaId})`);
  if (p.facaoId && !facaoIds.has(p.facaoId)) semCampo.push(`${p.id}: facaoId inválido (${p.facaoId})`);
  if (!p.atributos || !p.hpMax || !p.mpMax) semCampo.push(`${p.id}: atributos/hpMax/mpMax ausentes`);
  if (!p.habilidade || !p.habilidade.id || !p.habilidade.tipo) semCampo.push(`${p.id}: habilidade incompleta`);
  if (!p.despertar || !p.despertar.nomeArma || !p.despertar.bonusAtributos) semCampo.push(`${p.id}: despertar ausente/incompleto`);
  if (!p.sprite) semCampo.push(`${p.id}: sprite ausente`);
  else if (!fs.existsSync(path.join(ROOT, "assets/sprites", p.sprite))) semCampo.push(`${p.id}: sprite "${p.sprite}" não existe no disco`);
}
check(`todo personagem tem racaId/classeId/facaoId válidos e campos obrigatórios completos (problemas: ${semCampo.length})`, semCampo.length === 0);
if (semCampo.length) semCampo.slice(0, 10).forEach((s) => console.log("  - " + s));

// --- distribuição por raça/classe é razoavelmente equilibrada (nenhuma combinação ausente) ---
{
  const RACAS = [...racaIds];
  const CLASSES = [...classeIds];
  const contagemRaca = Object.fromEntries(RACAS.map((r) => [r, 0]));
  const contagemClasse = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  roster.forEach((p) => { contagemRaca[p.racaId]++; contagemClasse[p.classeId]++; });
  check("toda raça tem pelo menos 5 personagens no roster de 100", Object.values(contagemRaca).every((n) => n >= 5));
  check("toda classe tem pelo menos 5 personagens no roster de 100", Object.values(contagemClasse).every((n) => n >= 5));
}

// --- um personagem novo funciona de ponta a ponta: gacha -> combatente ---
{
  const novoLendario = roster.find((p) => p.raridade === "lendario" && p.id.startsWith("novo_"));
  check("existe pelo menos 1 personagem novo lendário (id começa com novo_)", !!novoLendario);
  if (novoLendario) {
    const instancia = instanciarPersonagemGacha(novoLendario);
    check("instanciarPersonagemGacha aceita um personagem novo sem quebrar", instancia.raridade === "lendario" && instancia.facaoId === novoLendario.facaoId);
    const dadosFake = { classes, tree: { arvores: {} } };
    let combatente;
    let erro = null;
    try {
      combatente = criarCombatenteJogador(instancia, dadosFake, "frente");
    } catch (e) { erro = e; }
    check("criarCombatenteJogador monta um combatente válido a partir do personagem novo (sem lançar erro)", !erro && combatente && combatente.hpMax > 0);
  }
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
