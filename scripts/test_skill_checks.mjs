// Smoke test para task #33: testes de perícia (d20) fora de combate.
import { realizarTeste, possuiPericia, bonusProficiencia, testesDoContexto, testeJaFeito, marcarTesteFeito } from "../src/systems/SkillCheckSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const backgrounds = JSON.parse(fs.readFileSync(new URL("../src/data/backgrounds.json", import.meta.url)));
const skillChecks = JSON.parse(fs.readFileSync(new URL("../src/data/skillChecks.json", import.meta.url)));
const dados = { backgrounds };

function personagem(antecedenteId, nivel = 1) {
  return { antecedenteId, nivel, atributos: { FOR: 10, DES: 14, CON: 12, INT: 16 }, equipamento: {} };
}

// --- possuiPericia bate exatamente com o antecedente ---
check("criminoso possui Furtividade", possuiPericia(personagem("criminoso"), dados, "Furtividade"));
check("criminoso NÃO possui Persuasão", !possuiPericia(personagem("criminoso"), dados, "Persuasão"));
check("nobre possui Persuasão", possuiPericia(personagem("nobre"), dados, "Persuasão"));

// --- bonusProficiencia cresce com o nível, mas devagar ---
check("bonus nível 1 = 2", bonusProficiencia(personagem("nobre", 1)) === 2);
check("bonus nível 8 = 4", bonusProficiencia(personagem("nobre", 8)) === 4);

// --- realizarTeste: distribuição de sucesso é maior pra quem é proficiente ---
{
  const N = 3000;
  let sucessosProficiente = 0, sucessosNao = 0;
  for (let i = 0; i < N; i++) {
    const rProf = realizarTeste(personagem("criminoso"), dados, { pericia: "Furtividade", atributo: "DES", dificuldade: 15 });
    if (rProf.sucesso) sucessosProficiente++;
    const rNao = realizarTeste(personagem("nobre"), dados, { pericia: "Furtividade", atributo: "DES", dificuldade: 15 });
    if (rNao.sucesso) sucessosNao++;
  }
  console.log(`Taxa de sucesso proficiente: ${(100 * sucessosProficiente / N).toFixed(1)}% | não-proficiente: ${(100 * sucessosNao / N).toFixed(1)}%`);
  check("proficiente tem taxa de sucesso maior", sucessosProficiente > sucessosNao);
}

// --- estrutura do total: d + modAtributo + bonusPericia ---
{
  const p = personagem("criminoso");
  const r = realizarTeste(p, dados, { pericia: "Furtividade", atributo: "DES", dificuldade: 10 });
  const modEsperado = Math.floor(14 / 2); // DES 14 -> +7
  check("modAtributo calculado corretamente (DES 14 -> +7)", r.modAtributo === modEsperado);
  check("total = d + modAtributo + bonusPericia", r.total === r.d + r.modAtributo + r.bonusPericia);
  check("proficiente = true pra Furtividade com antecedente criminoso", r.proficiente === true);
}

// --- teste único por personagem ---
{
  const p = personagem("nobre");
  check("teste ainda não feito inicialmente", !testeJaFeito(p, "guarda_segredo_tesouro"));
  marcarTesteFeito(p, "guarda_segredo_tesouro");
  check("teste marcado como feito", testeJaFeito(p, "guarda_segredo_tesouro"));
}

// --- skillChecks.json tem entradas nos 3 contextos esperados ---
check("existe teste contexto npc", testesDoContexto(skillChecks, "npc").length > 0);
check("existe teste contexto bau", testesDoContexto(skillChecks, "bau").length > 0);
check("existe teste contexto no", testesDoContexto(skillChecks, "no").length > 0);
check("filtro por npcId funciona", testesDoContexto(skillChecks, "npc", { npcId: "npc_guarda" }).length > 0);
check("filtro por npcId exclui outros NPCs", testesDoContexto(skillChecks, "npc", { npcId: "npc_mercador" }).length === 0);

// --- toda perícia referenciada em skillChecks.json existe em algum antecedente ---
const periciasValidas = new Set(backgrounds.map((b) => b.pericia));
let periciaInvalida = false;
skillChecks.forEach((sc) => {
  if (!periciasValidas.has(sc.pericia)) {
    console.log(`FALHA: perícia "${sc.pericia}" (teste ${sc.id}) não existe em nenhum antecedente`);
    periciaInvalida = true;
  }
});
check("todas as perícias em skillChecks.json existem em backgrounds.json", !periciaInvalida);

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
