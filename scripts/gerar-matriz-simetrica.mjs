// TODOS OS ELEMENTOS COM O MESMO PESO: 2 FORÇAS E 2 FRAQUEZAS, CADA UMA.
//
// O DEFEITO, MEDIDO NA MATRIZ ATUAL
// ---------------------------------
// Os doze elementos não são equivalentes, e a diferença é grande:
//
//   fogo, água, gelo, natureza, terra   2 bônus / 2 penalidades  (núcleo completo)
//   raio, vento, radiante               1 / 1
//   sombrio                             1 / 0   <- só força, nenhuma fraqueza
//   veneno                              0 / 1   <- só fraqueza, nenhuma força
//   arcano                              0 / 0   <- nenhuma relação
//
// Escolher sombrio é objetivamente melhor que escolher veneno, e escolher
// arcano é escolher não ter elemento. Enquanto o elemento era cosmético isso
// passava; se ele vai definir as habilidades da classe, vira desequilíbrio.
//
// A CONSTRUÇÃO
// ------------
// Em vez de escrever listas e conferir depois, o esquema sai de DUAS
// PERMUTAÇÕES sobre os elementos:
//
//   DOMINA  (×1,5)  cada elemento vence um, e perde feio para exatamente um
//   PRESSIONA (×1,25) cada elemento leva vantagem sobre um, e sofre de um
//
// Uma permutação, por definição, usa cada elemento exatamente uma vez como
// origem e uma vez como destino. Então o equilíbrio não é uma meta a
// verificar: é consequência da forma. Se a tabela é permutação, o resultado
// É 1/1/1/1 para todo mundo, e o teste abaixo prova isso.
//
// RECIPROCIDADE. O motor lê só a linha do ATACANTE (ver
// ElementSystem.relacaoElemental), então cada par precisa ser gravado dos
// dois lados:
//
//   A domina B      ->  A.forteIntensa += B   e   B.fracoIntensa += A
//   A pressiona C   ->  A.forte        += C   e   C.fraco        += A
//
// Sem a segunda metade, B atacaria A em neutro e o confronto seria mentira
// em metade das vezes.
//
// FÍSICO FICA DE FORA, e não por escolha: `relacaoElemental` devolve "neutro"
// assim que um dos dois lados é `fisico`, antes de olhar a matriz. Qualquer
// entrada que ele tivesse seria código morto. Sobram 11 elementos.
//
// DUAS RESTRIÇÕES, e a segunda eu só descobri porque a prova reprovou a
// primeira versão:
//
//   1. ninguém domina E pressiona o mesmo alvo;
//   2. se A domina B, B não pode pressionar A.
//
// A segunda é a sutil. Na primeira tentativa `veneno` dominava `natureza` e
// `natureza` pressionava `veneno`: a linha do veneno ficava com natureza em
// forteIntensa E em fraco ao mesmo tempo. `relacaoElemental` resolveria pela
// ordem dos `if` e a segunda entrada viraria código morto — sem erro, sem
// aviso, só um confronto que não faz o que a tabela diz.
//
// A FICÇÃO É SUA. A matemática está resolvida pela forma: QUALQUER par de
// permutações válidas dá 1/1/1/1. Então a ordem abaixo é decisão criativa e
// pode ser trocada à vontade sem quebrar nada — troque os pares, rode de
// novo, e o equilíbrio continua exato.
//
// Uso:  node scripts/gerar-matriz-simetrica.mjs            (simulação + prova)
//       node scripts/gerar-matriz-simetrica.mjs --escrever
import fs from "node:fs";

const ARQUIVO = new URL("../src/data/elements.json", import.meta.url);

// Quem cada elemento DOMINA (×1,5). Lido "A esmaga B".
export const DOMINA = {
  agua: "fogo",          // apaga
  fogo: "gelo",          // derrete
  gelo: "vento",         // congela a corrente
  vento: "veneno",       // dispersa a névoa
  veneno: "natureza",    // corrompe o que é vivo
  natureza: "terra",     // a raiz rompe a rocha
  terra: "raio",         // aterra a descarga
  raio: "agua",          // a água conduz
  radiante: "sombrio",   // a luz dissipa
  sombrio: "arcano",     // a sombra corrompe a trama
  arcano: "radiante",    // a trama desfaz a manifestação
};

// Quem cada elemento PRESSIONA (×1,25). Vantagem menor, alvo diferente.
export const PRESSIONA = {
  fogo: "natureza",      // queima a mata
  agua: "terra",         // erode
  gelo: "veneno",        // o frio retarda o veneno
  natureza: "agua",      // a raiz bebe
  terra: "fogo",         // sufoca a chama
  raio: "arcano",        // sobrecarrega a trama
  veneno: "radiante",    // mancha o que é puro
  radiante: "gelo",      // a luz derrete
  vento: "sombrio",      // varre a escuridão
  sombrio: "raio",       // a sombra engole a faísca
  arcano: "vento",       // a trama comanda o ar
};

export const ELEMENTOS_DO_CICLO = Object.keys(DOMINA);

// --- Construção ----------------------------------------------------------

export function construirMatriz() {
  const m = {};
  for (const id of ELEMENTOS_DO_CICLO) {
    m[id] = { forteIntensa: [], forte: [], fracoIntensa: [], fraco: [] };
  }
  for (const [a, b] of Object.entries(DOMINA)) {
    m[a].forteIntensa.push(b);
    m[b].fracoIntensa.push(a);
  }
  for (const [a, c] of Object.entries(PRESSIONA)) {
    m[a].forte.push(c);
    m[c].fraco.push(a);
  }
  return m;
}

// --- Prova ---------------------------------------------------------------
//
// Não é "conferir se ficou bom": é provar as propriedades que a construção
// promete. Se alguma falhar, as tabelas acima não são permutações válidas e
// o script não grava nada.
export function provar(m) {
  const erros = [];
  const n = ELEMENTOS_DO_CICLO.length;

  const ehPermutacao = (tabela, nome) => {
    const origens = Object.keys(tabela);
    const destinos = Object.values(tabela);
    if (origens.length !== n) erros.push(`${nome}: ${origens.length} origens, esperado ${n}`);
    if (new Set(destinos).size !== n) {
      const vistos = new Set();
      const repetidos = destinos.filter((d) => (vistos.has(d) ? true : (vistos.add(d), false)));
      erros.push(`${nome}: destino repetido — ${[...new Set(repetidos)].join(", ")}`);
    }
    const fora = destinos.filter((d) => !ELEMENTOS_DO_CICLO.includes(d));
    if (fora.length) erros.push(`${nome}: destino fora do ciclo — ${fora.join(", ")}`);
    for (const [a, b] of Object.entries(tabela)) if (a === b) erros.push(`${nome}: ${a} aponta para si mesmo`);
  };
  ehPermutacao(DOMINA, "DOMINA");
  ehPermutacao(PRESSIONA, "PRESSIONA");

  for (const id of ELEMENTOS_DO_CICLO) {
    if (DOMINA[id] === PRESSIONA[id]) erros.push(`${id}: domina e pressiona o mesmo alvo (${DOMINA[id]})`);
    // Aresta recíproca: se A domina B, B pressionar A poria o mesmo elemento
    // em duas listas da linha de A.
    const alvo = PRESSIONA[id];
    if (alvo && DOMINA[alvo] === id) {
      erros.push(`${id} pressiona ${alvo}, mas ${alvo} domina ${id} — as duas relações caem na mesma linha`);
    }
  }

  for (const id of ELEMENTOS_DO_CICLO) {
    const e = m[id];
    const contagem = [e.forteIntensa.length, e.forte.length, e.fracoIntensa.length, e.fraco.length];
    if (contagem.join(",") !== "1,1,1,1") {
      erros.push(`${id}: ${contagem.join("/")} em vez de 1/1/1/1`);
    }
    // Ninguém pode aparecer em duas listas do mesmo elemento: seria relação
    // ambígua, e `relacaoElemental` resolveria pela ordem do `if`, em silêncio.
    const todos = [...e.forteIntensa, ...e.forte, ...e.fracoIntensa, ...e.fraco];
    if (new Set(todos).size !== todos.length) erros.push(`${id}: alvo repetido entre as listas`);
    if (todos.includes(id)) erros.push(`${id}: aparece na própria linha`);
  }

  return erros;
}

// --- Execução ------------------------------------------------------------

const arquivo = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
const nova = construirMatriz();
const erros = provar(nova);

if (erros.length) {
  console.error("As tabelas não formam um esquema válido — NADA foi gravado:");
  erros.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

// físico continua na matriz, vazio, porque o arquivo lista todos os elementos
// e uma chave faltando seria lida como "elemento desconhecido" em outro lugar.
const completa = { fisico: { forteIntensa: [], forte: [], fracoIntensa: [], fraco: [] }, ...nova };

const M = arquivo.multiplicadores;
const nomes = Object.fromEntries(arquivo.elementos.map((e) => [e.id, e.nome]));
const antes = arquivo.matriz;

console.log("ESQUEMA SIMÉTRICO — 11 elementos, 1/1/1/1 cada, provado.\n");
console.log("elemento     domina (x1,5)   pressiona (x1,25)   sofre de (x0,5)   cede a (x0,75)");
for (const id of ELEMENTOS_DO_CICLO) {
  const e = completa[id];
  console.log(
    nomes[id].padEnd(12),
    nomes[e.forteIntensa[0]].padEnd(15),
    nomes[e.forte[0]].padEnd(19),
    nomes[e.fracoIntensa[0]].padEnd(17),
    nomes[e.fraco[0]],
  );
}

const conta = (e) => (e ? (e.forteIntensa || []).length + (e.forte || []).length + (e.fracoIntensa || []).length + (e.fraco || []).length : 0);
console.log("\nrelações por elemento, antes -> depois:");
for (const el of arquivo.elementos) {
  const a = conta(antes[el.id]);
  const d = conta(completa[el.id]);
  const marca = el.id === "fisico" ? "  (neutro por desenho)" : a === d ? "" : "  <-";
  console.log(`  ${el.nome.padEnd(12)} ${String(a).padStart(2)} -> ${String(d).padStart(2)}${marca}`);
}

if (process.argv.includes("--escrever")) {
  arquivo.matriz = completa;
  arquivo._comentario_niveis =
    "Cada elemento tem 4 listas, TODAS lidas da linha do ATACANTE: forteIntensa (x1,5 ao atacar o listado), "
    + "forte (x1,25), fracoIntensa (x0,5) e fraco (x0,75). NAO e resistencia ao sofrer — o motor "
    + "(ElementSystem.relacaoElemental) consulta apenas a linha de quem ataca. Cada par e gravado dos dois "
    + "lados. Ataque e defesa do MESMO elemento sao sempre imunidade total, sobrepondo a matriz. `fisico` e "
    + "neutro dos dois lados, antes da matriz. Gerado por scripts/gerar-matriz-simetrica.mjs — edite as "
    + "permutacoes la e rode de novo, nao edite esta matriz a mao.";
  fs.writeFileSync(ARQUIVO, `${JSON.stringify(arquivo, null, 2)}\n`, "utf8");
  console.log("\ngravado em src/data/elements.json (e o comentário errado foi corrigido junto).");
} else {
  fs.writeFileSync(new URL("../reports/matriz-simetrica.json", import.meta.url), `${JSON.stringify(completa, null, 2)}\n`, "utf8");
  console.log("\n(simulação — use --escrever) proposta salva em reports/matriz-simetrica.json");
}
