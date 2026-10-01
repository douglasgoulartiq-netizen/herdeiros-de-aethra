// Regressão para task #49: expandir o roster de gacha de 24 para 100
// personagens, mantendo a taxonomia de 5 raridades e pelo menos 10% de
// lendários. As quatro classes novas levaram o elenco a 132, então 100
// virou PISO e a cota de lendários virou proporção — o que esta regressão
// protege é o elenco não encolher, não repetir e não perder a taxonomia.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { criarCombatenteJogador } from "../src/systems/CombatSystem.js";
import { instanciarPersonagemGacha } from "../src/systems/GachaSystem.js";
import { GACHA_FINAL_ART } from "../src/data/gachaFinalArt.js";

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

// O número deixou de ser 100 exato quando as quatro classes novas trouxeram
// 32 convocados. Travar em "exatamente 100" transformava CRESCER o elenco em
// falha, que é o contrário do que esta regressão quer proteger: ela existe
// para o elenco não ENCOLHER nem repetir. O piso continua 100.
const PISO_ELENCO = 100;
check(`roster tem pelo menos ${PISO_ELENCO} personagens (encontrado ${roster.length})`, roster.length >= PISO_ELENCO);

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
// A proporção é a regra, não o número absoluto: um elenco maior precisa de
// mais lendários para a raridade continuar significando a mesma coisa.
const minLendarios = Math.ceil(roster.length * 0.1);
check(`pelo menos 10% dos ${roster.length} são lendários (>=${minLendarios}, encontrado ${contagem.lendario})`, contagem.lendario >= minLendarios);
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
  // DOIS CAMINHOS LEGÍTIMOS, não um.
  //
  // Esta checagem só conhecia assets/sprites, e por isso reprovava os 16
  // convocados da segunda leva, cuja arte EXCLUSIVA vive em assets/arte_v2 e
  // é resolvida por gachaFinalArt.js. A arte existe e aparece no jogo; era a
  // checagem que estava desatualizada em relação ao jogo.
  //
  // O que ela continua cobrando — e tem de cobrar — é que todo convocado
  // tenha arte EM ALGUM lugar que o jogo saiba encontrar. Quem não tem some
  // da tela, e isso segue sendo falha.
  else if (!fs.existsSync(path.join(ROOT, "assets/sprites", p.sprite))
        && !(GACHA_FINAL_ART[p.sprite.replace(/\.png$/i, "")]
             && fs.existsSync(path.join(ROOT, GACHA_FINAL_ART[p.sprite.replace(/\.png$/i, "")]))))
    semCampo.push(`${p.id}: sprite "${p.sprite}" não existe nem em assets/sprites nem na arte exclusiva`);
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
  check("toda raça tem pelo menos 5 personagens no roster", Object.values(contagemRaca).every((n) => n >= 5));
  check("toda classe tem pelo menos 5 personagens no roster", Object.values(contagemClasse).every((n) => n >= 5));
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
