// Smoke test para task #30: níveis "intensa" + imunidade no sistema elemental.
import { relacaoElemental, multiplicadorElemental } from "../src/systems/ElementSystem.js";
import fs from "node:fs";

const dados = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

// Mesmo elemento = sempre imune, mesmo sem entrada na matriz.
check("fogo vs fogo = imune", relacaoElemental("fogo", "fogo", dados) === "imune");
check("multiplicador imune = 0", multiplicadorElemental("fogo", "fogo", dados) === 0);
check("arcano vs arcano = imune", relacaoElemental("arcano", "arcano", dados) === "imune");

// Tiers intensos vs normais.
check("fogo vs gelo = vantagem_intensa", relacaoElemental("fogo", "gelo", dados) === "vantagem_intensa");
check("multiplicador vantagem_intensa = 1.5", multiplicadorElemental("fogo", "gelo", dados) === 1.5);
check("fogo vs natureza = vantagem (normal)", relacaoElemental("fogo", "natureza", dados) === "vantagem");
check("multiplicador vantagem = 1.25", multiplicadorElemental("fogo", "natureza", dados) === 1.25);

check("fogo vs agua = resistencia_intensa", relacaoElemental("fogo", "agua", dados) === "resistencia_intensa");
check("multiplicador resistencia_intensa = 0.5", multiplicadorElemental("fogo", "agua", dados) === 0.5);
check("fogo vs terra = resistencia (normal)", relacaoElemental("fogo", "terra", dados) === "resistencia");
check("multiplicador resistencia = 0.75", multiplicadorElemental("fogo", "terra", dados) === 0.75);

// Físico nunca participa da matriz elemental (comportamento preservado).
check("fisico vs fogo = neutro", relacaoElemental("fisico", "fogo", dados) === "neutro");
check("fogo vs fisico = neutro", relacaoElemental("fogo", "fisico", dados) === "neutro");

// Nenhum elemento deve listar a si mesmo nas 4 listas (a imunidade já cobre
// isso automaticamente — evita dupla contagem/confusão nos dados).
let autoReferencia = false;
for (const [elId, entrada] of Object.entries(dados.matriz)) {
  for (const lista of ["forteIntensa", "forte", "fracoIntensa", "fraco"]) {
    if ((entrada[lista] || []).includes(elId)) {
      console.log(`FALHA: ${elId}.${lista} contém a si mesmo`);
      autoReferencia = true;
    }
  }
}
check("nenhum elemento lista a si mesmo na matriz", !autoReferencia);

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
