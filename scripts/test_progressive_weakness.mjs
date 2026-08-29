// Regressão para a fraqueza elemental revelada progressivamente no
// compêndio (melhoria de jogabilidade pós-backlog original, ver
// CompendiumSystem.js: ABATES_PARA_REVELAR_FRAQUEZA/calcularFraquezas).
// Monstro é "descoberto" (nome/elemento próprio visíveis) já no 1º abate —
// igual a antes desta melhoria — mas a fraqueza ELEMENTAL EXATA só aparece
// depois de mais abates do mesmo tipo.
import {
  registrarAbateCompendio, bestiarioParaCompendio, calcularFraquezas, ABATES_PARA_REVELAR_FRAQUEZA,
} from "../src/systems/CompendiumSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const monsters = JSON.parse(fs.readFileSync(new URL("../src/data/monsters.json", import.meta.url)));
const compendium = JSON.parse(fs.readFileSync(new URL("../src/data/compendium.json", import.meta.url)));
const elements = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));
const dados = { monsters, compendium, elements };

function personagem() {
  return { compendio: { abates: {} } };
}

// --- calcularFraquezas: pura função sobre a matriz elemental ---
{
  check("fogo é fraqueza de gelo (vantagem_intensa)", calcularFraquezas("gelo", elements).includes("fogo"));
  check("fraqueza intensa vem antes de fraqueza normal na lista", (() => {
    const lista = calcularFraquezas("gelo", elements);
    return lista.indexOf("fogo") <= lista.indexOf(lista.find((e) => e !== "fogo") || "fogo");
  })());
  check("elemento nunca lista a si mesmo como sua própria fraqueza", !calcularFraquezas("fogo", elements).includes("fogo"));
  check("físico nunca aparece como fraqueza de ninguém", elements.elementos.every((e) => !calcularFraquezas(e.id, elements).includes("fisico")));
  check("sem dadosElementos, retorna lista vazia (não quebra)", calcularFraquezas("fogo", null).length === 0);
  check("sem elementoDefensor, retorna lista vazia (não quebra)", calcularFraquezas(null, elements).length === 0);
}

// --- bestiarioParaCompendio: descoberta (1 abate) != fraqueza revelada (N abates) ---
{
  const p = personagem();
  const monstroTeste = monsters.find((m) => m.elemento && m.elemento !== "fisico") || monsters[0];
  registrarAbateCompendio(p, monstroTeste.id); // só 1 abate
  const entrada = bestiarioParaCompendio(p, dados).find((m) => m.id === monstroTeste.id);
  check("1 abate já descobre o monstro (nome/elemento visíveis)", entrada.descoberto === true && entrada.nome === monstroTeste.nome);
  check("1 abate NÃO é suficiente pra revelar a fraqueza (a menos que o limiar seja 1)", ABATES_PARA_REVELAR_FRAQUEZA <= 1 || entrada.fraquezaRevelada === false);
  check("fraquezas fica null enquanto não revelada", entrada.fraquezas === null);
  check("abatesFaltandoFraqueza reflete quanto falta", entrada.abatesFaltandoFraqueza === ABATES_PARA_REVELAR_FRAQUEZA - 1);
}

// --- bestiarioParaCompendio: depois de ABATES_PARA_REVELAR_FRAQUEZA abates, revela a lista real ---
{
  const p = personagem();
  const monstroTeste = monsters.find((m) => m.elemento && m.elemento !== "fisico") || monsters[0];
  for (let i = 0; i < ABATES_PARA_REVELAR_FRAQUEZA; i++) registrarAbateCompendio(p, monstroTeste.id);
  const entrada = bestiarioParaCompendio(p, dados).find((m) => m.id === monstroTeste.id);
  check(`exatamente ${ABATES_PARA_REVELAR_FRAQUEZA} abates já revela a fraqueza`, entrada.fraquezaRevelada === true);
  check("abatesFaltandoFraqueza fica null quando já revelada", entrada.abatesFaltandoFraqueza === null);
  const esperado = calcularFraquezas(monstroTeste.elemento, elements);
  check("lista de fraquezas revelada bate com calcularFraquezas do elemento real do monstro", JSON.stringify(entrada.fraquezas) === JSON.stringify(esperado));
}

// --- monstro nunca abatido: nem descoberto nem fraqueza aparecem ---
{
  const p = personagem();
  const nuncaVisto = monsters.find((m) => true);
  const entrada = bestiarioParaCompendio(p, dados).find((m) => m.id === nuncaVisto.id);
  check("monstro nunca abatido não está descoberto", entrada.descoberto === false);
  check("monstro nunca abatido não tem fraqueza revelada", entrada.fraquezaRevelada === false);
  check("monstro nunca abatido não vaza a lista de fraquezas (fica null)", entrada.fraquezas === null);
  check("monstro nunca abatido não vaza abatesFaltandoFraqueza (fica null, não um número)", entrada.abatesFaltandoFraqueza === null);
}

// --- monstro de elemento físico (sem fraqueza elemental real) não quebra, mesmo revelado ---
{
  const p = personagem();
  const monstroFisico = monsters.find((m) => !m.elemento || m.elemento === "fisico");
  if (monstroFisico) {
    for (let i = 0; i < ABATES_PARA_REVELAR_FRAQUEZA; i++) registrarAbateCompendio(p, monstroFisico.id);
    const entrada = bestiarioParaCompendio(p, dados).find((m) => m.id === monstroFisico.id);
    check("monstro físico revelado tem fraquezas como lista vazia (não null, não erro)", Array.isArray(entrada.fraquezas) && entrada.fraquezas.length === 0);
  } else {
    check("(nenhum monstro puramente físico nos dados atuais — teste pulado sem falhar)", true);
  }
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
