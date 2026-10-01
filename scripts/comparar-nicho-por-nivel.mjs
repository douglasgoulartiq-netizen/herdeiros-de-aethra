// O NICHO DE UMA CLASSE SE SUSTENTA AO LONGO DO JOGO?
//
// POR QUE ESTA PERGUNTA
// ---------------------
// Todo o trabalho de nicho — o ladino deixar de ser generalista, o mago ser
// o especialista em multidão, as habilidades de robustez — foi medido e
// calibrado no NÍVEL 25, que é o teto. E a maior parte de uma partida
// acontece antes disso. Um balanço que só vale no último nível não é
// balanço: é um retrato do fim do jogo.
//
// Esta ferramenta roda a matriz de nicho em três níveis e compara a
// INCLINAÇÃO de cada classe (participação com 6 inimigos menos participação
// com 1). Negativa é alvo único, positiva é multidão, perto de zero é
// generalista — o defeito.
//
// Pré-requisito: os três relatórios têm de existir. Para gerar:
//   HDA_NIVEIS=5  node tests/matriz-de-nicho.mjs
//   HDA_NIVEIS=15 node tests/matriz-de-nicho.mjs
//   node tests/matriz-de-nicho.mjs            (grava o consolidado 5,15,25)
//
// Uso:  node scripts/comparar-nicho-por-nivel.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const base = new URL("../reports/", import.meta.url);
const fontes = [
  { nivel: 5, arquivo: "matriz-de-nicho-n5.json" },
  { nivel: 15, arquivo: "matriz-de-nicho-n15.json" },
  { nivel: 25, arquivo: "matriz-de-nicho.json" },
];

const faltando = fontes.filter((f) => !existsSync(new URL(f.arquivo, base)));
if (faltando.length) {
  console.error(`faltam relatórios: ${faltando.map((f) => f.arquivo).join(", ")}`);
  console.error("gere com HDA_NIVEIS=<n> node tests/matriz-de-nicho.mjs");
  process.exit(1);
}

const LIMITE = 0.06;
const nichoDe = (x) => (x <= -LIMITE ? "alvo único" : x >= LIMITE ? "multidão" : "generalista");

const dados = fontes.map((f) => ({ nivel: f.nivel, linhas: JSON.parse(readFileSync(new URL(f.arquivo, base))).linhas }));
const classes = dados[0].linhas.map((l) => l.nome);

const linhas = classes.map((nome) => {
  const por = dados.map((d) => {
    const l = d.linhas.find((x) => x.nome === nome);
    return { nivel: d.nivel, inclinacao: l ? l.inclinacao : null };
  });
  const nichos = por.map((p) => (p.inclinacao === null ? "—" : nichoDe(p.inclinacao)));
  return { nome, por, nichos, estavel: new Set(nichos).size === 1 };
});

const instaveis = linhas.filter((l) => !l.estavel);
const num = (x) => (x === null ? "—" : (100 * x).toFixed(1));

const md = `# O nicho se sustenta ao longo do jogo?

Todo o balanceamento de nicho foi medido e calibrado no **nível 25**. A maior parte de uma partida acontece antes disso. Esta é a mesma matriz rodada em três níveis.

**Inclinação** = participação no dano com 6 inimigos menos participação com 1. Negativa é especialista em alvo único, positiva em multidão, entre ${-LIMITE * 100} e ${LIMITE * 100} é generalista — que é o defeito que o trabalho de nicho existe para corrigir.

| Classe | Nível 5 | Nível 15 | Nível 25 | Mantém o nicho? |
|---|---|---|---|---|
${linhas.map((l) => `| ${l.nome} | ${num(l.por[0].inclinacao)} · ${l.nichos[0]} | ${num(l.por[1].inclinacao)} · ${l.nichos[1]} | ${num(l.por[2].inclinacao)} · ${l.nichos[2]} | ${l.estavel ? "sim" : "**não**"} |`).join("\n")}

## A leitura

**${instaveis.length} de ${linhas.length} classes mudam de nicho conforme o nível.** Só ${linhas.filter((l) => l.estavel).map((l) => l.nome).join(" e ")} mantêm a mesma identidade nos três.

Alguns casos são inversões completas, não oscilação de borda:

${instaveis.slice(0, 4).map((l) => `- **${l.nome}**: ${l.nichos[0]} no 5 → ${l.nichos[1]} no 15 → ${l.nichos[2]} no 25.`).join("\n")}

Isso quer dizer que o nicho que calibramos é o nicho do fim do jogo. Um jogador que passe a maior parte da campanha entre os níveis 5 e 15 encontra classes com identidade diferente da que o desenho pretende — e um ajuste feito no 25 pode piorar o 15 sem que ninguém perceba.

## A causa provável, e o que falta medir

A árvore é comprada por nível, e só 4 habilidades entram na luta. Então o que a classe É em cada nível depende de quais nós já foram comprados e de quais 4 cards cabem — e isso muda de forma descontínua a cada compra. Não é gradual.

Confirmar isso exige medir nível a nível, não em três pontos, e olhar qual habilidade entra no loadout em cada degrau. Esta ferramenta mostra que o problema existe; não mostra ainda em que nível exato cada classe vira outra coisa.

## Limites

Três níveis, time fixo, equipamento sintético de orçamento igual, IA automática. A inclinação é uma diferença entre duas médias ruidosas: perto do limite de ${LIMITE * 100} pontos, a classificação pode trocar por ruído, e por isso a leitura acima destaca as inversões grandes, não as de borda.
`;

writeFileSync(new URL("nicho-por-nivel.md", base), md);
writeFileSync(new URL("nicho-por-nivel.json", base), JSON.stringify({ limite: LIMITE, linhas }, null, 2));
console.log(md);
