// ESCOLHER UM ELEMENTO NA CRIAÇÃO É UMA ESCOLHA JUSTA?
//
// A PERGUNTA, E POR QUE A MATRIZ SOZINHA NÃO RESPONDE
// ---------------------------------------------------
// A matriz simétrica (scripts/gerar-matriz-simetrica.mjs) deixou os onze
// elementos com exatamente 2 forças e 2 fraquezas cada. Estrutura perfeita.
// E mesmo assim a vantagem média de cada elemento contra o bestiário quase
// não mudou: variação de no máximo 4,1%, dispersão igual.
//
// Porque o que o jogador enfrenta não é "um elemento sorteado". É o
// BESTIÁRIO, e ele não é uniforme. Dois efeitos se somam:
//
//   1. FREQUÊNCIA. Ser forte contra gelo vale pouco se existem 4 monstros de
//      gelo; ser fraco contra terra dói muito porque existem 13.
//   2. IMUNIDADE DE MESMO ELEMENTO. Atacar o próprio elemento dá ×0 — a
//      regra mais dura do sistema, que sobrepõe tudo. Um herói de terra
//      causa ZERO contra 14,1% do bestiário; um de radiante, contra 3,3%.
//
// Esta ferramenta mede a justiça PRÁTICA e compara cenários, para a decisão
// sair de número e não de intuição. Ela não altera nada.
//
// A MEDIDA. Para cada elemento de herói, a média do multiplicador elemental
// contra os 92 monstros. 1,0 seria "nem ajuda nem atrapalha". O que importa
// não é o valor absoluto — é a DISTÂNCIA entre o melhor e o pior elemento:
// é ela que diz o quanto a escolha da criação já decide o jogo sozinha.
//
// Uso:  node tests/justica-elemental.mjs
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { relacaoElemental, elementoFisicoEfetivo } from "../src/systems/ElementSystem.js";

const dataDir = new URL("../src/data/", import.meta.url);
const elementos = JSON.parse(readFileSync(new URL("elements.json", dataDir)));
const monstros = JSON.parse(readFileSync(new URL("monsters.json", dataDir)));

const ELEMENTOS_DE_HEROI = elementos.elementos.map((e) => e.id).filter((id) => id !== "fisico");
const nome = Object.fromEntries(elementos.elementos.map((e) => [e.id, e.nome]));

// DUAS CONTAS, PORQUE O JOGO TEM DUAS REGRAS — e eu errei isto na primeira
// versão desta ferramenta.
//
// `elementoFisicoEfetivo` (ElementSystem) já resolve o impasse de dano zero
// para GOLPES FÍSICOS: quando o elemento daria imunidade, ele cai para
// "fisico", que é neutro contra tudo. Então um herói de terra com arma de
// terra NÃO causa zero num monstro de terra — causa dano neutro.
//
// Só a MAGIA continua podendo ser anulada, e isso é decisão de desenho
// declarada no próprio comentário de lá: "uma bola de fogo num inimigo de
// fogo ainda causa 0, e isso continua sendo uma decisão tática de verdade".
//
// Medir as duas com a mesma régua, como eu fiz antes, inventa um problema
// que o jogo não tem para metade das classes.
function medir(dados, bestiario, { imunidade = null, fisico = false } = {}) {
  const linhas = ELEMENTOS_DE_HEROI.map((heroi) => {
    let soma = 0;
    let zeros = 0;
    for (const m of bestiario) {
      const alvo = m.elemento || "fisico";
      let rel = relacaoElemental(heroi, alvo, dados);
      // Golpe físico: a imunidade vira recuo para "fisico" (neutro).
      if (fisico && rel === "imune") rel = relacaoElemental(elementoFisicoEfetivo(heroi, alvo, dados, rel), alvo, dados);
      // `imunidade` substitui o ×0 por outro valor, para medir o cenário em
      // que a regra de mesmo-elemento deixa de ser absoluta para a magia.
      const mult = rel === "imune" && imunidade !== null ? imunidade : dados.multiplicadores[rel];
      if (mult === 0) zeros += 1;
      soma += mult;
    }
    return { heroi, media: soma / bestiario.length, zeros };
  });
  const medias = linhas.map((l) => l.media);
  const melhor = Math.max(...medias);
  const pior = Math.min(...medias);
  const m = medias.reduce((s, x) => s + x, 0) / medias.length;
  const desvio = Math.sqrt(medias.reduce((s, x) => s + (x - m) ** 2, 0) / medias.length);
  return { linhas, melhor, pior, amplitude: melhor - pior, desvio, vantagemRelativa: melhor / pior };
}

// Contagem por elemento, e quanto faltaria para uma distribuição uniforme.
const contagem = {};
for (const m of monstros) { const e = m.elemento || "fisico"; contagem[e] = (contagem[e] || 0) + 1; }
const elementais = monstros.length - (contagem.fisico || 0);
const alvoUniforme = elementais / ELEMENTOS_DE_HEROI.length;
const desvioDaUniforme = ELEMENTOS_DE_HEROI.reduce((s, id) => s + Math.abs((contagem[id] || 0) - alvoUniforme), 0) / 2;

const cenarios = [
  { id: "fisico", rotulo: "GOLPE FÍSICO, hoje (imunidade já recua para neutro)", r: medir(elementos, monstros, { fisico: true }) },
  { id: "magia", rotulo: "MAGIA, hoje (imunidade ×0 de verdade)", r: medir(elementos, monstros) },
  { id: "magia050", rotulo: "MAGIA, se a imunidade virasse ×0,5", r: medir(elementos, monstros, { imunidade: 0.5 }) },
];

// Cenário de bestiário perfeitamente uniforme: não é uma proposta, é o TETO
// teórico. Serve para separar "quanto do problema é a distribuição" de
// "quanto é a regra de imunidade".
const uniforme = [];
for (let i = 0; i < elementais; i += 1) uniforme.push({ elemento: ELEMENTOS_DE_HEROI[i % ELEMENTOS_DE_HEROI.length] });
for (let i = 0; i < (contagem.fisico || 0); i += 1) uniforme.push({ elemento: "fisico" });
cenarios.push({ id: "uniformeFisico", rotulo: "GOLPE FÍSICO, bestiário uniforme (teto teórico)", r: medir(elementos, uniforme, { fisico: true }) });
cenarios.push({ id: "uniformeMagia", rotulo: "MAGIA, bestiário uniforme (teto teórico)", r: medir(elementos, uniforme) });

const pct = (x) => `${(x * 100).toFixed(1)}%`;
let md = `# Justiça elemental — escolher um elemento é uma escolha justa?

A matriz está simétrica: os onze elementos têm exatamente 2 forças e 2 fraquezas cada. Mesmo assim a escolha do elemento na criação do herói **não** é neutra, porque o que o jogador enfrenta não é um elemento sorteado — é o bestiário, e ele não é uniforme.

${monstros.length} monstros. ${elementais} com elemento, ${contagem.fisico || 0} físicos (neutros dos dois lados).

## Distribuição do bestiário

| Elemento | Monstros | % | Imunidades que um herói desse elemento enfrenta |
|---|---:|---:|---:|
${ELEMENTOS_DE_HEROI.map((id) => {
  const n = contagem[id] || 0;
  return `| ${nome[id]} | ${n} | ${pct(n / monstros.length)} | ${n} monstro(s) em que causa zero |`;
}).join("\n")}

Uma distribuição uniforme daria ${alvoUniforme.toFixed(1)} monstros por elemento. Para chegar lá seria preciso trocar o elemento de **${Math.round(desvioDaUniforme)} monstros** — e aí é que está o problema: trolls, golens e gárgulas *são* terra. Uniformizar à força custaria a ficção do bestiário.

## Cenários medidos

Multiplicador elemental médio de cada herói contra o bestiário inteiro. O número que importa é a **amplitude** — a distância entre o melhor e o pior elemento. É ela que diz o quanto a escolha da criação decide o jogo sozinha.

| Cenário | Melhor | Pior | Amplitude | Pior→melhor | Desvio |
|---|---:|---:|---:|---:|---:|
${cenarios.map((c) => `| ${c.rotulo} | ${c.r.melhor.toFixed(3)} | ${c.r.pior.toFixed(3)} | **${c.r.amplitude.toFixed(3)}** | ${((c.r.vantagemRelativa - 1) * 100).toFixed(1)}% | ${c.r.desvio.toFixed(4)} |`).join("\n")}

## Por elemento, hoje e com a imunidade suavizada

| Elemento | Golpe físico | Magia | Monstros do mesmo elemento |
|---|---:|---:|---:|
${ELEMENTOS_DE_HEROI.map((id) => {
  const a = cenarios[0].r.linhas.find((l) => l.heroi === id);
  const b = cenarios[1].r.linhas.find((l) => l.heroi === id);
  return `| ${nome[id]} | ${a.media.toFixed(3)} | ${b.media.toFixed(3)} | ${contagem[id] || 0} |`;
}).join("\n")}

## Limites

Mede só a relação elemental contra a lista de monstros, sem peso por frequência de encontro, por zona ou por nível — um monstro raro de fim de jogo conta igual a um lobo do primeiro mapa. Não mede essência, sintonia, terreno nem clima, que também mexem no dano. Serve para comparar cenários entre si, não para prever dano real.
`;

mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
writeFileSync(new URL("../reports/justica-elemental.md", import.meta.url), md);
writeFileSync(new URL("../reports/justica-elemental.json", import.meta.url), JSON.stringify({ contagem, alvoUniforme, trocasParaUniforme: Math.round(desvioDaUniforme), cenarios }, null, 2));
console.log(md);

// QUAIS POUCOS MONSTROS RENDEM MAIS?
//
// Nivelar o bestiário inteiro exige trocar ~14 elementos, e isso custa a
// ficção: um troll das cavernas É terra. Mas a melhora não é linear — alguns
// remanejamentos valem muito mais que outros, porque tiram de um elemento
// superlotado E alimentam um escasso ao mesmo tempo.
//
// Esta busca é gulosa e declarada: a cada passo escolhe o único
// remanejamento que mais reduz a amplitude, e só considera mover DE um
// elemento com excesso PARA um com falta. O resultado é uma lista ordenada
// por ganho — a ficção de cada linha continua sendo decisão humana, e por
// isso os nomes aparecem.
// A busca otimiza o caso da MAGIA, que é onde a injustiça existe de verdade.
function amplitudeDe(bestiario) {
  return medir(elementos, bestiario).amplitude;
}

const PASSOS = 8;
let atual = monstros.map((m) => ({ nome: m.nome, elemento: m.elemento || "fisico", chefe: !!m.chefe }));
const sugestoes = [];
for (let passo = 0; passo < PASSOS; passo += 1) {
  const cont = {};
  for (const m of atual) cont[m.elemento] = (cont[m.elemento] || 0) + 1;
  const excesso = ELEMENTOS_DE_HEROI.filter((e) => (cont[e] || 0) > alvoUniforme);
  const falta = ELEMENTOS_DE_HEROI.filter((e) => (cont[e] || 0) < alvoUniforme);
  let melhor = null;
  for (let i = 0; i < atual.length; i += 1) {
    if (!excesso.includes(atual[i].elemento)) continue;
    for (const destino of falta) {
      const copia = atual.map((m, j) => (j === i ? { ...m, elemento: destino } : m));
      const amp = amplitudeDe(copia);
      if (!melhor || amp < melhor.amp) melhor = { i, destino, amp, de: atual[i].elemento, nome: atual[i].nome, chefe: atual[i].chefe };
    }
  }
  if (!melhor) break;
  sugestoes.push({ ...melhor, passo: passo + 1 });
  atual = atual.map((m, j) => (j === melhor.i ? { ...m, elemento: melhor.destino } : m));
}

let md2 = `\n## Os poucos que rendem mais\n\nBusca gulosa: a cada passo, o único remanejamento que mais reduz a amplitude, movendo de um elemento com excesso para um com falta. A ficção de cada linha é decisão sua — por isso os nomes estão aqui.\n\n| # | Monstro | De | Para | Amplitude depois |\n|---:|---|---|---|---:|\n`;
md2 += sugestoes.map((s) => `| ${s.passo} | ${s.nome}${s.chefe ? " (chefe)" : ""} | ${nome[s.de]} | ${nome[s.destino]} | ${s.amp.toFixed(3)} |`).join("\n");
md2 += `\n\nPartindo de ${cenarios[0].r.amplitude.toFixed(3)}. Os primeiros passos rendem muito mais que os últimos — vale parar onde a ficção começar a doer.\n`;
console.log(md2);
writeFileSync(new URL("../reports/justica-elemental.md", import.meta.url), md + md2);
