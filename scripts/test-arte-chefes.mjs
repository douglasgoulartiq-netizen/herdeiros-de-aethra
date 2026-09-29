// COBERTURA DA ARTE DOS CHEFES — e o relatório de quem ainda falta.
//
// POR QUE ESTE TESTE EXISTE
// -------------------------
// A pasta assets/arte_v2 cobre 23 dos 49 chefes do jogo. Os outros 26 caem no
// sprite antigo pela cadeia de fallback do assetRegistry, o que NÃO quebra
// nada — e é exatamente esse o problema: a falta é invisível. Ninguém percebe
// que metade dos chefes tem arte de outra geração até comparar dois lado a
// lado numa batalha.
//
// Este arquivo faz duas coisas diferentes, de propósito:
//
//   FALHA   quando o pipeline está quebrado — um prompt sem chefe, um chefe
//           sem prompt, uma peça com tamanho errado, uma peça sem o ícone par.
//   RELATA  quantos chefes já têm arte, sem falhar por isso. O trabalho é
//           incremental: cada peça que entra sobe o número, e o teste não
//           pode ficar vermelho durante as 26 rodadas.
//
// Uso:  node scripts/test-arte-chefes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), "utf8"));
const V2 = path.join(RAIZ, "assets/arte_v2");

let ok = 0;
const check = (nome, cond) => {
  if (!cond) throw new Error(`FALHOU: ${nome}`);
  ok += 1; console.log(`✓ ${nome}`);
};

// Lado do PNG, lido do cabeçalho IHDR — sem dependência de imagem.
function lado(arquivo) {
  const b = fs.readFileSync(arquivo);
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) return null;
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

const monstros = (() => { const d = ler("src/data/monsters.json"); return Array.isArray(d) ? d : Object.values(d)[0]; })();
const chefes = monstros.filter((m) => m && m.chefe);
const chaveDe = (m) => m.sprite || `mob_${m.id}`;
const prompts = ler("assets/arte_v2/prompts-chefes.json");
const arquivos = new Set(fs.readdirSync(V2));

// --- O PIPELINE ESTÁ ÍNTEGRO ----------------------------------------------
check(`o jogo tem chefes para cobrir (${chefes.length})`, chefes.length >= 40);
check("o arquivo de prompts declara base, primeiro prompt e variantes",
  !!prompts.basePrompt && !!prompts.firstPrompt && Array.isArray(prompts.variantes));

const declarados = prompts.variantes.map(([id]) => id);
check("nenhum prompt de chefe está repetido", new Set(declarados).size === declarados.length);
check("todo prompt tem id de sprite e texto de assunto",
  prompts.variantes.every(([id, txt]) => /^mob_[a-z0-9_]+$/.test(id) && typeof txt === "string" && txt.length > 60));

const chavesDeChefe = new Set(chefes.map(chaveDe));
const promptSemChefe = declarados.filter((id) => !chavesDeChefe.has(id));
check(`todo prompt aponta para um chefe que existe${promptSemChefe.length ? ` — ${promptSemChefe.join(", ")}` : ""}`,
  promptSemChefe.length === 0);

// A regra central: se um chefe não tem arte e não tem prompt, ele foi
// esquecido — e é exatamente esse esquecimento que o teste existe para pegar.
const semArte = chefes.filter((m) => !arquivos.has(`${chaveDe(m)}.png`));
const semPrompt = semArte.filter((m) => !declarados.includes(chaveDe(m)));
check(`todo chefe sem arte tem um prompt escrito${semPrompt.length ? ` — ${semPrompt.map(chaveDe).join(", ")}` : ""}`,
  semPrompt.length === 0);

// --- AS PEÇAS QUE JÁ EXISTEM ESTÃO NO CONTRATO ----------------------------
// assetRegistry.js: combate 256 para chefe, 192 para comum; retrato 64.
const erradas = []; const semIcone = [];
for (const m of chefes) {
  const k = chaveDe(m);
  if (!arquivos.has(`${k}.png`)) continue;
  const d = lado(path.join(V2, `${k}.png`));
  if (!d || d.largura !== d.altura || (d.largura !== 256 && d.largura !== 192)) {
    erradas.push(`${k} (${d ? `${d.largura}x${d.altura}` : "ilegível"})`);
  }
  if (!arquivos.has(`${k}_icon.png`)) { semIcone.push(k); continue; }
  const i = lado(path.join(V2, `${k}_icon.png`));
  if (!i || i.largura !== 64 || i.altura !== 64) erradas.push(`${k}_icon (${i ? `${i.largura}x${i.altura}` : "ilegível"})`);
}
check(`toda peça de chefe é quadrada e de 256 ou 192${erradas.length ? ` — ${erradas.join(", ")}` : ""}`,
  erradas.length === 0);
check(`toda peça de chefe tem o ícone de 64 correspondente${semIcone.length ? ` — ${semIcone.join(", ")}` : ""}`,
  semIcone.length === 0);

// --- RELATÓRIO (não falha) -------------------------------------------------
const comArte = chefes.length - semArte.length;
const pct = Math.round((comArte / chefes.length) * 100);
console.log(`\n${ok} verificacoes do pipeline de arte de chefe passaram.`);
console.log(`\nCOBERTURA: ${comArte}/${chefes.length} chefes com arte_v2 (${pct}%). Faltam ${semArte.length}.`);
if (semArte.length) {
  console.log("\nProximos, do mais visto ao menos visto (nivel mais baixo primeiro —");
  console.log("o chefe de nivel 4 e visto por todo jogador; o de nivel 20, por poucos):");
  for (const m of [...semArte].sort((a, b) => a.nivel - b.nivel)) {
    console.log(`  nv${String(m.nivel).padStart(2)}  ${chaveDe(m).padEnd(34)} ${m.nome}`);
  }
  console.log("\nComo gerar: ver assets/arte_v2/CHEFES.md");
}
