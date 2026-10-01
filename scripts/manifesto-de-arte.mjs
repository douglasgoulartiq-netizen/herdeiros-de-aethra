// MANIFESTO DE ARTE — o que exatamente falta desenhar, arquivo por arquivo.
//
// POR QUE ESTA FERRAMENTA EXISTE
// ------------------------------
// test-sprites reprova dizendo "24 de 60 sem folha de caminhada" e lista as
// seis primeiras. Isso é o suficiente para saber que há dívida, e insuficiente
// para alguém PRODUZIR a arte: falta o caminho exato de cada arquivo, o
// tamanho que ele precisa ter, e o que ele representa.
//
// Enquanto a lista não existe, a dívida de arte é uma frase. Com a lista, ela
// vira uma fila de trabalho que dá para dividir, estimar e ir riscando.
//
// O QUE ELE NÃO FAZ, DE PROPÓSITO
// -------------------------------
// Ele não desenha nada e não inventa descrição de estilo. A direção de arte
// do jogo está em briefings-arte/, escrita por quem decide isso; repetir um
// resumo dela aqui criaria uma segunda fonte de verdade que envelhece sozinha.
// Este arquivo responde "o quê e onde", não "como".
//
// Também não marca como dívida a arte que o jogo já resolve em tempo de
// execução sem ninguém perceber: as quatro classes novas têm fallback
// explícito (classArtFallbacks.js) e aparecem corretas na tela hoje,
// emprestando a arte de guerreiro, ladino, clérigo e mago. É dívida real —
// um paladino parece um guerreiro — mas é dívida de IDENTIDADE, não de
// funcionamento, e a diferença muda a urgência. A coluna EMPRESTA diz de
// quem cada um está pegando emprestado enquanto a arte própria não vem.
//
// Uso:  node scripts/manifesto-de-arte.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { classArtFallback } from "../src/data/classArtFallbacks.js";
import { GACHA_FINAL_ART } from "../src/data/gachaFinalArt.js";

const raiz = new URL("../", import.meta.url);
const ler = (p) => JSON.parse(readFileSync(new URL(p, raiz)));
const existe = (p) => existsSync(new URL(p, raiz));

const classes = ler("src/data/classes.json");
const racas = ler("src/data/races.json");
const roster = ler("src/data/gachaRoster.json");

// Cada família é um USO diferente da mesma personagem, com um contrato de
// tamanho próprio. Os tamanhos vêm do que o jogo já exige em código:
// a folha de caminhada é desenhada no mapa, onde o tile tem 64; a arena pede
// 192 (ver o comentário de loader.js e briefings-arte/00_CONTRATO_TECNICO.md).
//
// Os nomes de arquivo abaixo são os MESMOS que scripts/test-sprites.mjs
// cobra — `pc_`, `pcb_` e `retrato_`, cada um na sua pasta. Essa coincidência
// não é decorativa: se este manifesto inventasse um padrão próprio, ele
// listaria arquivos que o jogo nunca vai procurar, e alguém desenharia 140
// imagens que não aparecem em lugar nenhum.
const FAMILIAS = [
  {
    id: "caminhada",
    titulo: "Folha de caminhada (mapa)",
    spec: "folha de animação, quadro de 64×64",
    pasta: "assets/sprites",
    nome: (r, c) => `pc_${r}_${c}`,
    onde: "o herói andando pelo mundo",
  },
  {
    id: "batalha",
    titulo: "Sprite de batalha (arena)",
    spec: "quadro único de 192×192",
    pasta: "assets/sprites",
    nome: (r, c) => `pcb_${r}_${c}`,
    onde: "o herói na arena de combate",
  },
  {
    id: "retrato",
    titulo: "Retrato",
    spec: "64×64",
    pasta: "assets/sprites_hd",
    nome: (r, c) => `retrato_${r}_${c}`,
    onde: "barra de ordem de turno, ficha e tela de time",
  },
];

const faltando = [];

// --- herói principal: toda combinação raça × classe --------------------
for (const r of racas) {
  for (const c of classes) {
    // O fallback raciocina sobre a chave `pc_<raca>_<classe>`; o que ele
    // devolve é a chave da classe EMPRESTADA, e daí cada família monta o
    // próprio nome de arquivo.
    const emprestada = classArtFallback(`pc_${r.id}_${c.id}`);
    const classeEmprestada = emprestada ? emprestada.replace(`pc_${r.id}_`, "") : null;
    for (const f of FAMILIAS) {
      const caminho = `${f.pasta}/${f.nome(r.id, c.id)}.png`;
      if (existe(caminho)) continue;
      const alternativa = classeEmprestada ? `${f.pasta}/${f.nome(r.id, classeEmprestada)}.png` : null;
      faltando.push({
        familia: f.id, caminho, spec: f.spec, onde: f.onde,
        assunto: `${r.nome} ${c.nome}`,
        // Só conta como empréstimo se o arquivo emprestado EXISTE. Dizer que
        // o paladino empresta do guerreiro quando o guerreiro também não tem
        // seria prometer uma rede que não está lá.
        empresta: alternativa && existe(alternativa) ? alternativa : null,
      });
    }
  }
}

// --- convocados do gacha -----------------------------------------------
for (const p of roster) {
  if (!p.sprite) { faltando.push({ familia: "convocado", caminho: "(sem campo sprite)", assunto: p.nome, spec: "—", onde: "invocação", empresta: null }); continue; }
  const caminho = `assets/sprites/${p.sprite}`;
  if (existe(caminho)) continue;
  const chave = String(p.sprite).replace(/\.png$/i, "");
  // ARTE EXCLUSIVA EM OUTRA PASTA, e não dívida.
  //
  // A segunda leva do gacha (variantes 5 a 8 das classes novas) tem arte
  // própria em assets/arte_v2, resolvida por gachaFinalArt.js em vez do
  // caminho convencional. A primeira versão deste manifesto não sabia disso e
  // listou as 16 como "não aparecem de jeito nenhum" — teria mandado alguém
  // desenhar imagens que já existem. Um manifesto que mente sobre a fila é
  // pior do que nenhum.
  if (GACHA_FINAL_ART[chave] && existe(GACHA_FINAL_ART[chave])) continue;
  const empresta = classArtFallback(chave);
  faltando.push({
    familia: "convocado", caminho, spec: "retrato de convocado",
    onde: "tela de invocação, time e batalha",
    assunto: `${p.nome} — ${p.raridade} · ${p.classeId}`,
    empresta: empresta && existe(`assets/sprites/${empresta}.png`) ? `assets/sprites/${empresta}.png` : null,
  });
}

// --- saída ---------------------------------------------------------------
const porFamilia = {};
for (const x of faltando) (porFamilia[x.familia] = porFamilia[x.familia] || []).push(x);

const comEmprestimo = faltando.filter((x) => x.empresta).length;
const nomeFamilia = (id) => (FAMILIAS.find((f) => f.id === id) || { titulo: "Convocados do gacha" }).titulo;

const md = `# Manifesto de arte — o que falta desenhar

**${faltando.length} arquivos**, dos quais **${comEmprestimo} já aparecem na tela** emprestando arte de outra classe, e **${faltando.length - comEmprestimo} não aparecem de jeito nenhum**.

A diferença importa para priorizar: o que empresta está errado de identidade (um paladino com cara de guerreiro); o que não empresta está errado de funcionamento.

${Object.entries(porFamilia).map(([id, itens]) => `## ${nomeFamilia(id)} — ${itens.length}

${itens[0].spec !== "—" ? `Contrato: ${itens[0].spec}. Aparece em: ${itens[0].onde}.\n` : ""}
| Arquivo | Assunto | Empresta de |
|---|---|---|
${itens.map((x) => `| \`${x.caminho}\` | ${x.assunto} | ${x.empresta ? `\`${x.empresta}\`` : "**nada**"} |`).join("\n")}`).join("\n\n")}

## Como usar esta lista

Cada linha é um arquivo. Produzir o arquivo no caminho indicado, com o tamanho do contrato, faz a linha sumir daqui e faz \`test-sprites\` e \`test_gacha_100\` andarem sozinhos — nenhum código precisa mudar, porque o fallback só entra quando o arquivo próprio não existe.

A direção de arte (paleta, silhueta, enquadramento) está em \`briefings-arte/\` e não é repetida aqui de propósito: duas descrições do mesmo estilo divergem com o tempo, e a de lá é a que vale.

Gerado por \`scripts/manifesto-de-arte.mjs\` — rode de novo depois de acrescentar arte para ver a fila encolher.
`;

writeFileSync(new URL("reports/manifesto-de-arte.md", raiz), md);
writeFileSync(new URL("reports/manifesto-de-arte.json", raiz), JSON.stringify({ total: faltando.length, comEmprestimo, faltando }, null, 2));
console.log(`${faltando.length} arquivos de arte faltando (${comEmprestimo} com empréstimo, ${faltando.length - comEmprestimo} sem nada).`);
for (const [id, itens] of Object.entries(porFamilia)) console.log(`  ${nomeFamilia(id).padEnd(32)} ${itens.length}`);
console.log("gravado em reports/manifesto-de-arte.md");
