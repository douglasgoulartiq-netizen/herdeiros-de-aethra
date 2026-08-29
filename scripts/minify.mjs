// Minificador conservador para JS: remove comentários e espaços em branco
// supérfluos sem juntar linhas (evita riscos de ASI). Feito à mão porque
// não há acesso à internet para instalar esbuild/terser neste sandbox.
import fs from "node:fs";

function minifyJs(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let lineHasCode = false; // se a linha atual já tem código emitido
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // Comentário de linha
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // Comentário de bloco
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // String simples/dupla
    if (c === '"' || c === "'") {
      const quote = c;
      let s = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { s += src[i] + src[i + 1]; i += 2; continue; }
        s += src[i]; i++;
      }
      s += src[i]; i++;
      out += s; lineHasCode = true;
      continue;
    }
    // Template literal
    if (c === "`") {
      let s = c;
      i++;
      let depth = 0;
      while (i < n) {
        if (src[i] === "\\") { s += src[i] + src[i + 1]; i += 2; continue; }
        if (src[i] === "$" && src[i + 1] === "{") { depth++; s += "${"; i += 2; continue; }
        if (depth > 0 && src[i] === "}") { depth--; s += "}"; i++; continue; }
        if (depth === 0 && src[i] === "`") { s += "`"; i++; break; }
        s += src[i]; i++;
      }
      out += s; lineHasCode = true;
      continue;
    }
    // Regex literal (heurística: '/' após operador/abre-parênteses/etc, não após identificador/número/fecha)
    if (c === "/" && c2 !== "/" && c2 !== "*") {
      const prevNonSpace = out.replace(/\s+$/, "").slice(-1);
      const regexAllowed = !/[A-Za-z0-9_$)\]]/.test(prevNonSpace);
      if (regexAllowed) {
        let s = c; i++;
        let inClass = false;
        while (i < n) {
          if (src[i] === "\\") { s += src[i] + src[i + 1]; i += 2; continue; }
          if (src[i] === "[") inClass = true;
          if (src[i] === "]") inClass = false;
          if (!inClass && src[i] === "/") { s += "/"; i++; break; }
          if (src[i] === "\n") break; // não é regex válido, aborta heurística
          s += src[i]; i++;
        }
        out += s; lineHasCode = true;
        continue;
      }
    }
    if (c === "\n") {
      // remove espaço em branco à direita já emitido
      out = out.replace(/[ \t]+$/, "");
      out += "\n";
      lineHasCode = false;
      i++;
      // pula linhas em branco extras e espaços/indentação da próxima linha
      while (i < n && (src[i] === " " || src[i] === "\t")) i++;
      while (i < n && src[i] === "\n") i++;
      continue;
    }
    if ((c === " " || c === "\t")) {
      // colapsa espaços múltiplos em um só (fora de strings, já tratado acima)
      if (lineHasCode && out.slice(-1) !== " ") out += " ";
      i++;
      continue;
    }
    out += c; lineHasCode = true; i++;
  }
  return out.trim() + "\n";
}

function minifyJson(src) {
  return JSON.stringify(JSON.parse(src));
}

const [, , mode, inPath, outPath] = process.argv;
const src = fs.readFileSync(inPath, "utf-8");
const result = mode === "json" ? minifyJson(src) : minifyJs(src);
fs.writeFileSync(outPath, result);
console.log(`${inPath}: ${src.length} -> ${result.length} bytes`);
