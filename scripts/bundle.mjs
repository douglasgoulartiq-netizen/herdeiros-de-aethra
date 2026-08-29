// Bundlador manual (sem esbuild, sem acesso à internet no sandbox).
// Resolve o grafo de import/export ES modules deste projeto (apenas named
// imports/exports, sem default export, sem import * as, sem import()
// dinâmico — confirmado via grep) e gera um único arquivo JS sem módulos,
// usando IIFEs por módulo para evitar colisão de nomes entre arquivos
// (ex.: "const overlay" repetido em várias UIs).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENTRY = "src/main.js";

function resolveImportPath(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  let resolved = path.normalize(path.join(dir, importPath)).replace(/\\/g, "/");
  return resolved;
}

function safeKey(file) {
  return file.replace(/[^a-zA-Z0-9]/g, "_");
}

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(path.join(ROOT, file), "utf-8");
  const imports = []; // { source, names: [{imported, local}] }
  let body = src;

  // Extrai imports (podem ser multi-linha)
  body = body.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?/g, (m, names, source) => {
    const resolved = resolveImportPath(file, source);
    const parsed = names.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
      const asMatch = s.match(/^(\S+)\s+as\s+(\S+)$/);
      if (asMatch) return { imported: asMatch[1], local: asMatch[2] };
      return { imported: s, local: s };
    });
    imports.push({ source: resolved, names: parsed });
    return "";
  });

  // Remove "export " de declarações e coleta nomes exportados
  const exported = new Set();
  body = body.replace(/^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm, (m, kind, name) => {
    exported.add(name);
    return `${kind} ${name}`;
  });
  // export { A, B, C };  (re-export de nomes já declarados localmente)
  body = body.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (m, names) => {
    names.split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => {
      const asMatch = n.match(/^(\S+)\s+as\s+(\S+)$/);
      exported.add(asMatch ? asMatch[2] : n);
    });
    return "";
  });

  const mod = { file, imports, body, exported: [...exported] };
  cache.set(file, mod);
  return mod;
}

const order = [];
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const mod = load(file);
  for (const imp of mod.imports) visit(imp.source);
  order.push(file);
}
visit(ENTRY);

let out = "";
for (const file of order) {
  const mod = cache.get(file);
  if (file === ENTRY) continue; // entry vai ao final, fora de IIFE de export
  const key = safeKey(file);
  let importLines = "";
  for (const imp of mod.imports) {
    const srcKey = safeKey(imp.source);
    for (const { imported, local } of imp.names) {
      importLines += `  const ${local} = MOD_${srcKey}.${imported};\n`;
    }
  }
  const exportsObj = mod.exported.map((n) => `${n}`).join(", ");
  out += `const MOD_${key} = (function(){\n${importLines}${mod.body}\n  return { ${exportsObj} };\n})();\n\n`;
}

// Entry point (main.js): mesmo tratamento de imports, mas executado direto
const entryMod = cache.get(ENTRY);
let entryImportLines = "";
for (const imp of entryMod.imports) {
  const srcKey = safeKey(imp.source);
  for (const { imported, local } of imp.names) {
    entryImportLines += `const ${local} = MOD_${srcKey}.${imported};\n`;
  }
}
out += `${entryImportLines}${entryMod.body}\n`;

fs.mkdirSync("bundle", { recursive: true });
fs.writeFileSync("bundle/main.bundle.js", out);
console.log("Bundle gerado:", out.length, "bytes,", order.length, "módulos");
