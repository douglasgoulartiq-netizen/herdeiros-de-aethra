// DE ONDE VEM ESTE MATERIAL?
//
// O DEFEITO QUE ISTO RESOLVE
// --------------------------
// A forja diz o que falta e não diz onde achar. O jogador abre "Forjar Lâmina
// Élfica", lê "Minério Élfico 0/2", fecha a tela e não tem nenhuma pista do
// que fazer em seguida. O jogo SABE a resposta — está em lootTables.json e na
// lista de recursos de cada zona — e simplesmente não conta.
//
// Isso é pior do que parece porque a forja é onde o jogador vai quando quer
// progredir de propósito, e não por acaso. Mandar ele de volta ao mundo sem
// direção transforma a única tela de intenção do jogo num beco.
//
// A REGRA DE REDAÇÃO
// ------------------
// Nunca inventar. Só sai o que está no dado:
//   - recurso de zona   -> "colhido em <zonas>"
//   - queda de monstro  -> "cai de <monstros>", e onde esses monstros vivem
//   - nada encontrado   -> devolve null, e quem chama não escreve nada. Uma
//                         linha vazia é melhor do que uma pista errada.
//
// Os nomes são os que o jogador lê na tela (zona.nome, monstro.nome), nunca
// ids. Limita a três de cada, porque uma lista de dez lugares não é dica, é
// ruído — e o que importa é ter PARA ONDE IR, não o mapa completo.
import { ZONAS_MUNDO } from "../data/world/zones.js";

const MAX = 3;

// zona.id -> zona, e as listas invertidas. Calculado uma vez: ZONAS_MUNDO é
// estático e não muda durante a partida.
let indice = null;
function construirIndice() {
  const zonasPorRecurso = new Map();
  const zonasPorMonstro = new Map();
  for (const z of ZONAS_MUNDO) {
    for (const r of z.recursos || []) {
      if (!zonasPorRecurso.has(r)) zonasPorRecurso.set(r, []);
      zonasPorRecurso.get(r).push(z);
    }
    for (const m of z.monstros || []) {
      if (!zonasPorMonstro.has(m)) zonasPorMonstro.set(m, []);
      zonasPorMonstro.get(m).push(z);
    }
    if (z.chefe?.monstroId) {
      const id = z.chefe.monstroId;
      if (!zonasPorMonstro.has(id)) zonasPorMonstro.set(id, []);
      zonasPorMonstro.get(id).push(z);
    }
  }
  return { zonasPorRecurso, zonasPorMonstro };
}

function nomeDaZona(z) { return z.nome || z.id; }

// Quem derruba este item, segundo lootTables.json.
//
// NEM TODA TABELA DE LOOT É DE MONSTRO. lootTables.json também guarda as
// tabelas dos BAÚS (bau_comum, bau_raro, bau_epico, bau_lendario). Tratar
// tudo como criatura fazia a dica sair "cai de bau raro" — que não é nome de
// bicho nem lugar para ir. Foi o teste que pegou isso.
//
// Baú continua sendo origem legítima, só que com outra frase, e separada:
// não se caça um baú, se procura.
function quemDerruba(itemId, lootTables, ehMonstro) {
  const monstros = []; const baus = [];
  for (const [chave, tabela] of Object.entries(lootTables || {})) {
    if (!(tabela?.pool || []).some((p) => p.itemId === itemId)) continue;
    if (ehMonstro(chave)) monstros.push(chave);
    else if (/^bau_/.test(chave)) baus.push(chave);
  }
  return { monstros, baus };
}

const NOME_DO_BAU = {
  bau_comum: "baús comuns", bau_raro: "baús raros",
  bau_epico: "baús épicos", bau_lendario: "baús lendários",
};

/**
 * Devolve { texto, zonas, monstros } ou null quando o jogo não sabe a origem.
 * `dados` é o catálogo do loader (precisa de monsters e lootTables).
 */
export function origemDoItem(itemId, dados) {
  if (!itemId || !dados) return null;
  if (!indice) indice = construirIndice();

  const porIdMonstro = new Map((dados.monsters || []).map((m) => [m.id, m]));
  const zonasDeColheita = indice.zonasPorRecurso.get(itemId) || [];
  const { monstros: monstrosIds, baus } = quemDerruba(itemId, dados.lootTables, (id) => porIdMonstro.has(id));
  const nomeDoMonstro = (id) => porIdMonstro.get(id)?.nome || id.replace(/_/g, " ");

  // Onde esses monstros vivem — é a informação acionável, mais do que o nome
  // da criatura. "Cai de rato gigante" não ajuda quem não sabe onde há ratos.
  const zonasDeCaca = [];
  const vistas = new Set();
  for (const id of monstrosIds) {
    for (const z of indice.zonasPorMonstro.get(id) || []) {
      if (vistas.has(z.id)) continue;
      vistas.add(z.id); zonasDeCaca.push(z);
    }
  }

  // UMA FONTE, NÃO TODAS.
  //
  // Erva tem nó de colheita em três zonas E cai de slime, morcego e aranha em
  // outras três. Dizer tudo produz três linhas para UM ingrediente — e uma
  // receita tem vários. Medido no celular de 390px: a dica completa da erva
  // ocupava três linhas, a da gema mais duas.
  //
  // Quando existe nó, ele é a resposta: é fonte fixa, repetível e no mapa. A
  // queda vira detalhe, e detalhe que o jogador não pediu é ruído. Sem nó, a
  // queda é a única resposta e aí ela aparece inteira, com onde caçar — que é
  // a parte acionável ("cai de rato gigante" não ajuda quem não sabe onde há
  // ratos).
  let texto = null;
  if (zonasDeColheita.length) {
    texto = `colhido em ${zonasDeColheita.slice(0, MAX).map(nomeDaZona).join(", ")}`;
  } else if (monstrosIds.length) {
    const quem = monstrosIds.slice(0, MAX).map(nomeDoMonstro).join(", ");
    const onde = zonasDeCaca.slice(0, MAX).map(nomeDaZona).join(", ");
    texto = onde ? `cai de ${quem} — ${onde}` : `cai de ${quem}`;
  } else if (baus.length) {
    // Última fonte, e a menos acionável: não se caça um baú, se procura.
    texto = `encontrado em ${baus.slice(0, MAX).map((b) => NOME_DO_BAU[b] || "baús").join(", ")}`;
  }
  if (!texto) return null;

  return {
    texto,
    zonas: [...zonasDeColheita, ...zonasDeCaca].map((z) => z.id),
    monstros: monstrosIds,
  };
}

// Só para teste: força reconstruir o índice depois de mexer em ZONAS_MUNDO.
export function limparIndiceDeOrigem() { indice = null; }
