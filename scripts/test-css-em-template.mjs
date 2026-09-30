// A CRASE PERDIDA DENTRO DO CSS.
//
// O DEFEITO, QUE ACONTECEU TRÊS VEZES NUMA SESSÃO SÓ
// --------------------------------------------------
// Várias telas do jogo guardam o próprio CSS num template literal:
//
//   const CSS = <crase> .minha-classe { ... } <crase>;
//
// Comentar esse CSS é natural, e escrever um nome de classe entre crases
// dentro do comentário é igualmente natural — é assim que se cita código em
// todo lugar. Só que ali dentro a crase FECHA o literal. O resto do CSS passa
// a ser interpretado como JavaScript, o módulo inteiro deixa de carregar e a
// tela some do jogo.
//
// O pior é o modo como ele falha: `node --check` aceita o arquivo (o código
// que sobra costuma continuar sendo JS válido por acidente), o teste de nó
// passa, e o erro só aparece no navegador, como "Unexpected token" sem linha.
// Aconteceu em BattleCards.js, em SkillTreeUI.js e em RodaDosSelos.js.
//
// Este teste conta as crases de cada template literal atribuído a algo com
// CSS no nome. Se o número for ímpar em relação ao par de abertura e
// fechamento, alguém citou código dentro do comentário e derrubou a tela.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRASE = String.fromCharCode(96);

function arquivosJS(dir) {
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivosJS(p));
    else if (e.name.endsWith(".js")) saida.push(p);
  }
  return saida;
}

let ok = 0;
const problemas = [];

for (const arq of arquivosJS(path.join(RAIZ, "src"))) {
  const txt = fs.readFileSync(arq, "utf8");
  // Acha declarações do tipo `const ALGO_CSS = ` ou `const CSS = ` seguidas
  // de crase, e mede até onde o literal vai.
  const re = new RegExp(`const\\s+(\\w*CSS\\w*)\\s*=\\s*${CRASE}`, "g");
  let m;
  while ((m = re.exec(txt)) !== null) {
    const inicio = m.index + m[0].length;
    // O literal termina na PRIMEIRA crase não escapada. Se o CSS de verdade
    // continuar depois dela, a crase estava no meio do caminho.
    let fim = inicio;
    while (fim < txt.length) {
      if (txt[fim] === CRASE && txt[fim - 1] !== "\\") break;
      fim += 1;
    }
    const literal = txt.slice(inicio, fim);
    const depois = txt.slice(fim + 1, fim + 400);
    // Sinal de que o literal fechou cedo: logo após o fechamento aparece algo
    // que só existe em CSS (uma chave abrindo depois de um seletor, uma
    // propriedade com dois-pontos e ponto e vírgula), em vez de `;` ou `\n`.
    const fechouCedo = /^[^;]{0,80}(\{[^}]*:[^}]*;|^\s*[.#@][\w-]+\s*\{)/m.test(depois);
    // Sinal mais direto: o literal não contém nenhuma chave, ou seja, mal
    // começou — CSS de verdade sempre tem pelo menos uma regra.
    const literalVazio = !literal.includes("{");
    if (fechouCedo || literalVazio) {
      const linha = txt.slice(0, fim).split("\n").length;
      problemas.push(`${path.relative(RAIZ, arq)}:${linha} — ${m[1]} fecha cedo `
        + `(há crase dentro do bloco, provavelmente citando código num comentário)`);
    }
    ok += 1;
    re.lastIndex = fim + 1;
  }
}

if (problemas.length) {
  console.error("CSS em template literal quebrado:\n  " + problemas.join("\n  "));
  console.error("\nConserto: tire as crases de dentro do comentário. Escreva o"
    + "\nnome da classe sem citar, como .minha-classe, e não entre crases.");
  process.exit(1);
}

console.log(`✓ ${ok} blocos de CSS em template literal estão fechados no lugar certo.`);
console.log("\n1 verificação de CSS-em-template passou.");
