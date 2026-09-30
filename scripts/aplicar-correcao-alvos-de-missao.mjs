// AS MISSÕES DE MATAR APONTAVAM PARA ONDE O BICHO NÃO VIVE.
//
// O DEFEITO, MEDIDO
// -----------------
// O modo automático foi ligado numa partida nova e, em 45 segundos, o herói
// visitou 11 tiles — todos num raio de 3 casas do início — e terminou no
// nível 1. A causa não estava na IA: estava no dado.
//
//   q1_ratos_no_celeiro   matar 2 rato_gigante   aponta para a zona "vila"
//   q6_javalis_no_pomar   matar 3 javali         aponta para "bosque_sombrio"
//
// A zona "vila" tem `monstros: []` e a própria descrição diz "Sem encontros
// aleatórios" — é a vila inicial, segura de propósito. E `bosque_sombrio` não
// tem javali na lista. Ou seja: a PRIMEIRA missão de caça do jogo manda o
// jogador caçar num lugar onde a caça não existe, e a segunda também.
//
// Isso não trava só o automático. Um jogador humano que siga a bússola chega
// ao celeiro, anda em volta e não encontra rato nenhum.
//
// AS DUAS CORREÇÕES SÃO DIFERENTES DE PROPÓSITO
// ---------------------------------------------
// `q6` — o texto do Tobias diz, com todas as letras, "Javali do Bosque
// Sombrio". A ficção já afirmou que existe javali ali; quem não soube foi a
// lista de monstros da zona. Então o conserto é no MUNDO: o javali entra em
// bosque_sombrio. Mudar a zona da missão contradiria o que o NPC fala.
//
// `q1` — o texto diz celeiro, e celeiro é na vila. Mas pôr encontro aleatório
// na vila inicial desfaz uma decisão de desenho (é o único lugar seguro do
// jogo, e é onde o tutorial acontece). Então o conserto é na MISSÃO: os ratos
// se caçam na orla da floresta, que é vizinha da vila e onde rato_gigante de
// fato vive. O texto do Tobias continua igual — ele fala do prejuízo no
// celeiro, não de onde o herói deve procurar.
//
// Uso:  node scripts/aplicar-correcao-alvos-de-missao.mjs            (simulação)
//       node scripts/aplicar-correcao-alvos-de-missao.mjs --escrever
import fs from "node:fs";

const QUESTS = new URL("../src/data/quests.json", import.meta.url);
const ZONAS = new URL("../src/data/world/zones.js", import.meta.url);

// missão -> zona nova (e o texto que diz ao jogador onde procurar)
export const REDIRECIONAR = {
  q1_ratos_no_celeiro: {
    regiao: "floresta",
    objetivoTexto: "Cace 2 ratos gigantes na orla da Floresta Sussurrante — foi de lá que eles vieram para o celeiro.",
  },
  // MESMO DEFEITO, ENCONTRADO PELO TESTE NOVO. Doran pede duas gemas e diz,
  // no próprio texto, que a mulher dele "as perdeu na FLORESTA". A missão
  // apontava para "vila", que não tem monstro nenhum — e gema vem de derrota
  // (rato_gigante, entre outros), não de nó de recurso. Na floresta existe
  // rato_gigante; a correção é alinhar a missão ao que o texto já dizia.
  q3_colar_perdido: {
    regiao: "floresta",
    objetivoTexto: "Recupere 2 gemas na Floresta Sussurrante — foi ali que ela as perdeu.",
  },
};

// zona -> monstros que faltavam na lista dela
export const POVOAR = {
  bosque_sombrio: ["javali"],
};

// monstro -> itens que passam a cair dele (itemId + peso na pool)
//
// `q8_minerio_do_deserto`: Baltazar encomenda "minério élfico, do Deserto de
// Karn" com todas as letras. A ficção já afirmou que o minério élfico sai
// dali; quem não soube foi o jogo — `minerio_raro` só caía de `dragao_jovem`,
// que é chefe de masmorra e não pisa no deserto. Resultado: a missão era
// impossível de cumprir na região que ela própria indica.
//
// POR QUE NO LOOT E NÃO NOS RECURSOS DA ZONA. A primeira tentativa foi
// acrescentar "minerio_raro" aos `recursos` de deserto_karn. Funciona — e
// derruba `test-mundo-semente`: a lista de recursos alimenta o gerador de
// nós, então mexer nela desloca todo o fluxo de números aleatórios e o mundo
// inteiro sai diferente. Numa das 12 sementes do teste, dois nós de
// costa_aurora caíram em terreno inalcançável. Esse é um defeito ANTIGO do
// gerador (o próprio WorldBuilder comenta que "sempre permitiu nó em lago"),
// e não cabe consertá-lo de carona numa correção de missão — mas também não
// se publica uma mudança que deixa um teste verde vermelho.
//
// A tabela de loot não passa perto do gerador de mundo. E a ficção fica
// melhor: `verme_das_dunas` vive em deserto_karn e JÁ derruba "minerio"
// (Minério de Ferro) com peso 18. O verme que revira a areia trazendo ferro
// à superfície é exatamente o que traria o minério élfico junto — com peso
// menor, 8, o mesmo que o dragão, porque continua sendo o material raro.
export const ACRESCENTAR_LOOT = {
  verme_das_dunas: [{ itemId: "minerio_raro", peso: 8 }],
};

const dados = JSON.parse(fs.readFileSync(QUESTS, "utf8"));
const lista = Array.isArray(dados) ? dados : Object.values(dados)[0];

let missoes = 0;
for (const q of lista) {
  const novo = REDIRECIONAR[q.id];
  if (!novo) continue;
  if (q.regiao === novo.regiao && q.objetivoTexto === novo.objetivoTexto) continue;
  q.regiao = novo.regiao;
  q.objetivoTexto = novo.objetivoTexto;
  missoes += 1;
}

// O zones.js é código, não JSON: a edição é textual e cirúrgica — acha a
// linha `monstros: [...]` da zona pedida e acrescenta o que falta.
let fonte = fs.readFileSync(ZONAS, "utf8");
let zonasMexidas = 0;

function povoar(tabela, campo) {
  for (const [zonaId, novos] of Object.entries(tabela)) {
    const i = fonte.indexOf(`id: "${zonaId}"`);
    if (i < 0) { console.error(`zona não encontrada: ${zonaId}`); process.exitCode = 1; continue; }
    const marca = `${campo}: [`;
    const j = fonte.indexOf(marca, i);
    if (j < 0 || j > i + 700) { console.error(`lista "${campo}" não encontrada em ${zonaId}`); process.exitCode = 1; continue; }
    const fim = fonte.indexOf("]", j);
    const atual = fonte.slice(j + marca.length, fim);
    const jaTem = atual.split(",").map((s) => s.trim().replace(/"/g, ""));
    const faltam = novos.filter((m) => !jaTem.includes(m));
    if (!faltam.length) continue;
    const insercao = `${atual.trim() ? `${atual}, ` : ""}${faltam.map((m) => `"${m}"`).join(", ")}`;
    fonte = fonte.slice(0, j + marca.length) + insercao + fonte.slice(fim);
    zonasMexidas += 1;
  }
}

povoar(POVOAR, "monstros");

// lootTables.json é JSON puro: edição estruturada, sem cirurgia textual.
const LOOT = new URL("../src/data/lootTables.json", import.meta.url);
const loot = JSON.parse(fs.readFileSync(LOOT, "utf8"));
let lootMexido = 0;
for (const [monstroId, entradas] of Object.entries(ACRESCENTAR_LOOT)) {
  const tabela = loot[monstroId];
  if (!tabela) { console.error(`monstro sem tabela de loot: ${monstroId}`); process.exitCode = 1; continue; }
  tabela.pool = tabela.pool || [];
  for (const e of entradas) {
    if (tabela.pool.some((p) => p.itemId === e.itemId)) continue;
    tabela.pool.push({ itemId: e.itemId, peso: e.peso });
    lootMexido += 1;
  }
}

if (process.argv.includes("--escrever")) {
  fs.writeFileSync(QUESTS, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  fs.writeFileSync(ZONAS, fonte, "utf8");
  fs.writeFileSync(LOOT, `${JSON.stringify(loot, null, 2)}\n`, "utf8");
  console.log(`gravado: ${missoes} missão(ões) redirecionada(s), ${zonasMexidas} zona(s) povoada(s), ${lootMexido} entrada(s) de loot`);
} else {
  console.log(`(simulação — use --escrever) ${missoes} missão(ões), ${zonasMexidas} zona(s), ${lootMexido} loot`);
}
