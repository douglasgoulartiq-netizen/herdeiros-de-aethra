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
// Esta ferramenta compara a INCLINAÇÃO de cada classe (participação com 6
// inimigos menos participação com 1) entre os níveis medidos. Negativa é
// alvo único, positiva é multidão, perto de zero é generalista — o defeito.
//
// O QUE MUDOU NESTA VERSÃO
// ------------------------
// Antes ela exigia exatamente três níveis fixos (5, 15 e 25) e parava aí.
// Três pontos dizem QUE a classe muda de identidade, e não dizem ONDE —
// e "onde" é a pergunta cara, porque é ela que aponta a compra de talento ou
// o card que entrou no loadout e virou a classe do avesso.
//
// Agora ela lê TODOS os relatórios por nível que existirem na pasta, em
// qualquer quantidade, e aponta o DEGRAU exato em que cada classe atravessa
// uma fronteira. Com três arquivos o resultado é o de antes; com dez, ela
// responde a pergunta cara.
//
// Como gerar os relatórios (um por nível):
//   for n in 5 9 13 17 21 25; do HDA_NIVEIS=$n node tests/matriz-de-nicho.mjs; done
//
// Leituras com HDA_VARIANTE (pressão, time alternativo, ordem reversa) têm
// nome próprio e NÃO entram aqui: comparar um nível sob pressão com outro sem
// mediria duas coisas ao mesmo tempo e atribuiria a diferença ao nível.
//
// O arquivo sem sufixo (matriz-de-nicho.json) é o consolidado de vários
// níveis e NÃO entra aqui — misturá-lo com as leituras por nível somaria
// coisas de naturezas diferentes. Ele só é lido quando nenhum arquivo por
// nível existe, para a ferramenta continuar dizendo algo em vez de só falhar.
//
// Uso:  node scripts/comparar-nicho-por-nivel.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const base = new URL("../reports/", import.meta.url);

// Descobre as leituras por nível pelo nome do arquivo, em vez de exigir uma
// lista fixa: acrescentar um nível novo passa a ser só rodar a matriz.
const arquivos = readdirSync(base)
  .map((f) => ({ f, m: /^matriz-de-nicho-n(\d+)\.json$/.exec(f) }))
  .filter((x) => x.m)
  .map((x) => ({ arquivo: x.f, nivel: Number(x.m[1]) }));

const fontes = arquivos.sort((a, b) => a.nivel - b.nivel);

if (fontes.length < 2) {
  const consolidado = new URL("matriz-de-nicho.json", base);
  console.error(`preciso de pelo menos DOIS relatórios por nível; achei ${fontes.length}.`);
  console.error("gere com:  for n in 5 9 13 17 21 25; do HDA_NIVEIS=$n node tests/matriz-de-nicho.mjs; done");
  if (existsSync(consolidado)) console.error("(o consolidado matriz-de-nicho.json existe, mas mistura níveis e não serve aqui)");
  process.exit(1);
}

const LIMITE = 0.06;
const nichoDe = (x) => (x <= -LIMITE ? "alvo único" : x >= LIMITE ? "multidão" : "generalista");

const dados = fontes.map((f) => ({
  nivel: f.nivel,
  linhas: JSON.parse(readFileSync(new URL(f.arquivo, base))).linhas,
}));
const classes = dados[0].linhas.map((l) => l.nome);

const linhas = classes.map((nome) => {
  const por = dados.map((d) => {
    const l = d.linhas.find((x) => x.nome === nome);
    return { nivel: d.nivel, inclinacao: l ? l.inclinacao : null };
  });
  const nichos = por.map((p) => (p.inclinacao === null ? "—" : nichoDe(p.inclinacao)));

  // ONDE a classe vira outra coisa. Uma travessia é o par de níveis vizinhos
  // em que a classificação muda — e é só isso que a medida permite afirmar:
  // ela aconteceu ENTRE os dois, não exatamente num deles. Medir mais níveis
  // estreita o intervalo; nenhuma conta o estreita sozinha.
  const travessias = [];
  for (let i = 1; i < nichos.length; i += 1) {
    if (nichos[i] !== nichos[i - 1] && nichos[i] !== "—" && nichos[i - 1] !== "—") {
      travessias.push({ de: por[i - 1].nivel, ate: por[i].nivel, antes: nichos[i - 1], depois: nichos[i] });
    }
  }
  return { nome, por, nichos, travessias, estavel: travessias.length === 0 };
});

const instaveis = linhas.filter((l) => !l.estavel);
const num = (x) => (x === null ? "—" : (100 * x).toFixed(1));
const niveis = dados.map((d) => d.nivel);
const passo = niveis.length > 1 ? Math.min(...niveis.slice(1).map((n, i) => n - niveis[i])) : 0;

const md = `# O nicho se sustenta ao longo do jogo?

Todo o balanceamento de nicho foi medido e calibrado no **nível 25**. A maior parte de uma partida acontece antes disso. Esta é a mesma matriz rodada em ${niveis.length} níveis: ${niveis.join(", ")}.

**Inclinação** = participação no dano com 6 inimigos menos participação com 1. Negativa é especialista em alvo único, positiva em multidão, entre ${-LIMITE * 100} e ${LIMITE * 100} é generalista — que é o defeito que o trabalho de nicho existe para corrigir.

| Classe | ${niveis.map((n) => `Nível ${n}`).join(" | ")} | Mantém o nicho? |
|---|${niveis.map(() => "---").join("|")}|---|
${linhas.map((l) => `| ${l.nome} | ${l.por.map((p, i) => `${num(p.inclinacao)} · ${l.nichos[i]}`).join(" | ")} | ${l.estavel ? "sim" : "**não**"} |`).join("\n")}

## A leitura

**${instaveis.length} de ${linhas.length} classes mudam de nicho conforme o nível.**${linhas.filter((l) => l.estavel).length ? ` Só ${linhas.filter((l) => l.estavel).map((l) => l.nome).join(", ")} mantêm a mesma identidade do começo ao fim.` : ""}

## Onde cada uma vira outra coisa

${instaveis.length
  ? instaveis.map((l) => `- **${l.nome}**: ${l.travessias.map((t) => `${t.antes} → ${t.depois} entre os níveis ${t.de} e ${t.ate}`).join("; depois ")}.`).join("\n")
  : "- nenhuma classe atravessa fronteira nos níveis medidos."}

${passo > 1 ? `O intervalo de cada travessia é de ${passo} níveis, que é o espaçamento das medições — a classe vira outra coisa em algum ponto ali dentro, e esta ferramenta não aperta mais que isso. Para fechar o cerco, meça os níveis intermediários do intervalo que interessa.` : "As medições são de nível em nível, então cada travessia está localizada no degrau exato."}

## A causa provável, e o que falta medir

A árvore é comprada por nível, e só 4 habilidades entram na luta. Então o que a classe É em cada nível depende de quais nós já foram comprados e de quais 4 cards cabem — e isso muda de forma descontínua a cada compra. Não é gradual.

O passo seguinte é olhar, nos níveis da travessia, QUAL habilidade entrou no loadout e qual saiu. Esta ferramenta localiza o degrau; não diz ainda qual card o causou.

## Limites

Time fixo, equipamento sintético de orçamento igual, IA automática, no cenário padrão. Uma leitura sob pressão (HDA_PRESSAO / HDA_VIDA_INICIAL) grava com HDA_VARIANTE e é comparada à parte. A inclinação é uma diferença entre duas médias ruidosas: perto do limite de ${LIMITE * 100} pontos, a classificação pode trocar por ruído, e por isso a leitura acima destaca as travessias, não a casa decimal.
`;

writeFileSync(new URL("nicho-por-nivel.md", base), md);
writeFileSync(new URL("nicho-por-nivel.json", base), JSON.stringify({ limite: LIMITE, niveis, linhas }, null, 2));
console.log(md);
