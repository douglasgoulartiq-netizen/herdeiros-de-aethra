// A ARTE NOVA TEM QUE NASCER NA GRADE DO JOGO.
//
// O QUE ESTE TESTE PROTEGE
// ------------------------
// O jogo é pixel art numa grade de 4 px com alfa binário. Medido no projeto
// inteiro, por blocos NxN de cor constante:
//
//   pasta            grade 4   grade 1   borda macia (mediana)
//   icons                207         0     0,0%
//   sprites              253        43     0,0%
//   props + cidades       21         6     ~2%
//   tiles                  3         0     0,0%
//   arte_v2                0        66     6,5%     <- a exceção
//
// São 484 arquivos na grade contra 115 fora dela, e as 66 criaturas do
// arte_v2 são o grosso da exceção. (sprites_hd não entra na conta: 64x64
// nativo não tem grade a conferir.)
//
// Isso é dívida, e dívida se paga aos poucos. O que NÃO se pode é aumentá-la
// em silêncio: faltam 26 artes de chefe, e gerá-las com o pipeline antigo
// somaria 26 arquivos fora do padrão sem ninguém notar — porque a cadeia de
// fallback do assetRegistry faz a falta ser invisível.
//
// COMO ESTE TESTE FUNCIONA
// ------------------------
// Ele varre as pastas de arte, mede a grade de cada arquivo e FALHA se achar
// um fora da grade que não esteja declarado em GRADE-DIVIDA.json.
//
// O manifesto é a lista da dívida conhecida, não uma lista de exceções
// permanentes: conformar um arquivo e tirar o nome dele da lista é como o
// número cai. Acrescentar um nome novo à lista é um ato deliberado, visível
// no diff, que alguém precisa justificar na revisão.
//
// Uso:  node scripts/test-arte-grade.mjs
//       node scripts/test-arte-grade.mjs --detalhe
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRADE = 4;
const MANIFESTO = path.join(RAIZ, "assets/arte_v2/GRADE-DIVIDA.json");

// Pastas que o jogo desenha como pixel art. sprites_hd fica de fora: são
// 64x64 em resolução nativa, e em resolução nativa não existe grade.
const PASTAS = ["assets/arte_v2", "assets/icons", "assets/tiles", "assets/props", "assets/sprites"];

// --- leitor de PNG sem dependência ------------------------------------
//
// O projeto não tem package.json, então não há como pedir `sharp`. São só
// 8 bits, cor 6 (RGBA), sem entrelace — 707 dos 714 arquivos de arte. Os
// outros 7 são paleta (cor 3) e este teste os pula, dizendo quais são.
function lerPNG(arquivo) {
  const b = fs.readFileSync(arquivo);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`não é PNG: ${arquivo}`);
  const largura = b.readUInt32BE(16);
  const altura = b.readUInt32BE(20);
  const bits = b[24]; const cor = b[25]; const entrelace = b[28];
  if (bits !== 8 || cor !== 6 || entrelace !== 0) return { largura, altura, cor, px: null };

  const pedacos = [];
  let i = 8;
  while (i < b.length) {
    const tam = b.readUInt32BE(i);
    const tipo = b.toString("ascii", i + 4, i + 8);
    if (tipo === "IDAT") pedacos.push(b.subarray(i + 8, i + 8 + tam));
    if (tipo === "IEND") break;
    i += tam + 12;
  }
  const cru = zlib.inflateSync(Buffer.concat(pedacos));

  // Desfaz os filtros por linha do PNG (spec 9.2). bpp = 4 em RGBA 8 bits.
  const bpp = 4;
  const passo = largura * bpp;
  const px = Buffer.alloc(altura * passo);
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[y * (passo + 1)];
    const linha = cru.subarray(y * (passo + 1) + 1, y * (passo + 1) + 1 + passo);
    const saida = px.subarray(y * passo, (y + 1) * passo);
    const acima = y ? px.subarray((y - 1) * passo, y * passo) : null;
    for (let x = 0; x < passo; x += 1) {
      const a = x >= bpp ? saida[x - bpp] : 0;
      const c = acima ? acima[x] : 0;
      const d = acima && x >= bpp ? acima[x - bpp] : 0;
      let v = linha[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += c;
      else if (filtro === 3) v += (a + c) >> 1;
      else if (filtro === 4) {
        const p = a + c - d;
        const pa = Math.abs(p - a); const pb = Math.abs(p - c); const pc = Math.abs(p - d);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? c : d);
      }
      saida[x] = v & 0xff;
    }
  }
  return { largura, altura, cor, px };
}

// Está na grade N? Todo bloco NxN é de uma cor só.
function naGrade(px, w, h, n) {
  if (w % n || h % n) return false;
  for (let by = 0; by < h; by += n) {
    for (let bx = 0; bx < w; bx += n) {
      const i0 = (by * w + bx) * 4;
      for (let dy = 0; dy < n; dy += 1) {
        for (let dx = 0; dx < n; dx += 1) {
          const i = ((by + dy) * w + bx + dx) * 4;
          if (px[i] !== px[i0] || px[i + 1] !== px[i0 + 1]
            || px[i + 2] !== px[i0 + 2] || px[i + 3] !== px[i0 + 3]) return false;
        }
      }
    }
  }
  return true;
}

function bordaMacia(px) {
  let macios = 0; let opacos = 0;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] > 7) { opacos += 1; if (px[i] < 248) macios += 1; }
  }
  return opacos ? macios / opacos : 0;
}

// --- varredura ---------------------------------------------------------
const divida = new Set(fs.existsSync(MANIFESTO) ? JSON.parse(fs.readFileSync(MANIFESTO, "utf8")).fora_da_grade : []);
const foraDaGrade = [];
const semSuporte = [];
let naGradeOk = 0;
let total = 0;

for (const pasta of PASTAS) {
  const abs = path.join(RAIZ, pasta);
  if (!fs.existsSync(abs)) continue;
  const pilha = [abs];
  while (pilha.length) {
    const atual = pilha.pop();
    for (const e of fs.readdirSync(atual, { withFileTypes: true })) {
      const p = path.join(atual, e.name);
      if (e.isDirectory()) { pilha.push(p); continue; }
      if (!e.name.endsWith(".png")) continue;
      const rel = path.relative(RAIZ, p).replace(/\\/g, "/");
      const img = lerPNG(p);
      if (!img.px) { semSuporte.push(rel); continue; }
      total += 1;
      if (naGrade(img.px, img.largura, img.altura, GRADE)) { naGradeOk += 1; continue; }
      foraDaGrade.push({ rel, dim: `${img.largura}x${img.altura}`, macia: (bordaMacia(img.px) * 100).toFixed(1) });
    }
  }
}

const novos = foraDaGrade.filter((f) => !divida.has(f.rel));
const pagos = [...divida].filter((d) => !foraDaGrade.some((f) => f.rel === d));

console.log(`${total} arquivos medidos · ${naGradeOk} na grade de ${GRADE} px · ${foraDaGrade.length} fora`);
console.log(`dívida declarada: ${divida.size}`);
if (semSuporte.length) console.log(`(${semSuporte.length} em paleta, não medidos: ${semSuporte.slice(0, 3).join(", ")}${semSuporte.length > 3 ? "…" : ""})`);

if (pagos.length) {
  console.log(`\n✓ ${pagos.length} arquivo(s) saíram da dívida — tire o nome de GRADE-DIVIDA.json:`);
  pagos.forEach((p) => console.log(`   ${p}`));
}

if (process.argv.includes("--detalhe")) {
  console.log("\nfora da grade:");
  foraDaGrade.forEach((f) => console.log(`   ${f.dim.padEnd(9)} borda ${String(f.macia).padStart(5)}%  ${f.rel}`));
}

if (novos.length) {
  console.error(`\n✗ ${novos.length} arquivo(s) NOVOS fora da grade de ${GRADE} px:`);
  novos.forEach((f) => console.error(`   ${f.dim.padEnd(9)} borda ${f.macia}%  ${f.rel}`));
  console.error("\nGere de novo com tools/import-boss-art.ps1 (vizinho mais próximo + alfa binário).");
  console.error("Se for dívida aceita de propósito, acrescente o caminho a assets/arte_v2/GRADE-DIVIDA.json.");
}
assert.equal(novos.length, 0, "há arte nova fora da grade do jogo");
console.log(`\n✓ nenhuma arte nova fora da grade.`);
