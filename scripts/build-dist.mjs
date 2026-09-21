// Publicação estática: um módulo JS compacto, CSS minificado, dados e artes.
// O navegador de desenvolvimento continua usando os módulos originais.
import fs from "node:fs";
import path from "node:path";
import { build, transform } from "esbuild";

const raiz = path.resolve(import.meta.dirname, "..");
const saida = path.join(raiz, "dist");
const src = path.join(raiz, "src");
if (saida === raiz || !saida.startsWith(`${raiz}${path.sep}`)) {
  throw new Error("Destino de build inválido");
}

// O resolvedor virtual contorna uma falha do binário esbuild no caminho
// Windows/OneDrive desta máquina. Também impede importar fora do projeto.
const moduloLocal = {
  name: "modulos-locais",
  setup(api) {
    api.onResolve({ filter: /^entrada-do-jogo$/ }, () => ({
      path: path.join(src, "entrada-virtual.js"), namespace: "hda-local",
    }));
    api.onResolve({ filter: /^\./, namespace: "hda-local" }, (args) => {
      const arquivo = path.resolve(path.dirname(args.importer), args.path);
      const destino = path.extname(arquivo) ? arquivo : `${arquivo}.js`;
      if (!destino.startsWith(`${src}${path.sep}`)) {
        return { errors: [{ text: `Importação fora de src: ${args.path}` }] };
      }
      return { path: destino, namespace: "hda-local" };
    });
    api.onLoad({ filter: /.*/, namespace: "hda-local" }, (args) => ({
      contents: args.path.endsWith("entrada-virtual.js")
        ? 'import "./main.js"; import "./ui/IconesUI.js";'
        : fs.readFileSync(args.path, "utf8"),
      loader: path.extname(args.path) === ".json" ? "json" : "js",
    }));
  },
};

// Monta tudo em memória antes de substituir dist: um erro de compilação
// nunca deixa uma publicação parcial no diretório de saída.
const bundle = await build({ entryPoints: ["entrada-do-jogo"], bundle: true,
  minify: true, format: "esm", write: false, plugins: [moduloLocal] });
const htmlOriginal = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const padraoCss = /<link rel="stylesheet" href="src\/([^"/]+\.css)" \/>/g;
const folhas = [...htmlOriginal.matchAll(padraoCss)].map((achado) => achado[1]);
if (folhas.length !== fs.readdirSync(src).filter((arquivo) => arquivo.endsWith(".css")).length) {
  throw new Error("Há estilo fora da ordem declarada no index.html");
}
const cssFonte = folhas.map((nome) => fs.readFileSync(path.join(src, nome), "utf8")).join("\n");
const css = (await transform(cssFonte, { loader: "css", minify: true })).code;

fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(path.join(saida, "src", "data"), { recursive: true });
fs.writeFileSync(path.join(saida, "src", "bundle.js"), bundle.outputFiles[0].contents);
fs.writeFileSync(path.join(saida, "src", "bundle.css"), css);
for (const nome of fs.readdirSync(path.join(src, "data")).filter((f) => f.endsWith(".json"))) {
  fs.copyFileSync(path.join(src, "data", nome), path.join(saida, "src", "data", nome));
}
fs.cpSync(path.join(raiz, "assets"), path.join(saida, "assets"), { recursive: true });

let primeiraFolha = true;
const html = htmlOriginal
  .replace(padraoCss, () => {
    if (!primeiraFolha) return "";
    primeiraFolha = false;
    return '<link rel="stylesheet" href="src/bundle.css" />';
  })
  .replace('<script type="module" src="src/main.js"></script>', '<script type="module" src="src/bundle.js"></script>')
  .replace('<script type="module" src="src/ui/IconesUI.js"></script>', "");
if (!html.includes('src="src/bundle.js"') || html.includes('src="src/ui/IconesUI.js"')) {
  throw new Error("Entradas de script inesperadas no index.html");
}
fs.writeFileSync(path.join(saida, "index.html"), html);
console.log(`dist pronto: JS ${(bundle.outputFiles[0].contents.length / 1024).toFixed(0)} KiB, CSS ${(Buffer.byteLength(css) / 1024).toFixed(0)} KiB (${folhas.length} folhas reunidas), ${fs.readdirSync(path.join(saida, "src", "data")).length} arquivos de dados.`);
