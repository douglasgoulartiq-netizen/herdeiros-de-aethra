// SEMENTE DO MUNDO — a base de toda a ETAPA 1.
//
// O problema que este arquivo resolve: até agora `buildOverworld()` e as duas
// masmorras usavam `Math.random()` cru, e o mapa era reconstruído do zero a
// cada carregamento. Isso significa que o mundo do jogador NÃO EXISTIA entre
// duas sessões — a floresta que ele atravessou ontem tinha outras árvores
// hoje, a fogueira mudava de lugar, e o save guardava a posição do jogador
// num mapa que nunca mais voltaria a existir. Sem uma semente não dá pra ter
// chunk (o vizinho precisa ser sempre o mesmo vizinho), nem rio contínuo, nem
// estrada que persiste, nem descoberta de mapa que faça sentido.
//
// A partir daqui, MUNDO = f(semente). A mesma semente sempre devolve o mesmo
// mundo, tile por tile, em qualquer máquina e em qualquer ordem de chamada.
//
// Uma decisão importante: cada gerador puxa de um FLUXO PRÓPRIO, derivado da
// semente do mundo mais um rótulo ("overworld", "dungeon1", ...). Se todos
// compartilhassem um único fluxo, acrescentar uma decoração nova no mundo
// aberto deslocaria o fluxo e mudaria o labirinto das masmorras junto — e o
// mapa de todo mundo mudaria a cada patch. Com rótulos, mexer no overworld
// mexe só no overworld.

// Semente atribuída a saves criados ANTES desta task (ver a migração v2->v3
// em SaveSystem.js). Precisa ser um valor fixo e nunca mais mudar: é o mundo
// que esses jogadores vão receber de agora em diante. Valor obtido de
// hashTexto("aethra-legado") e escrito à mão de propósito — se um dia a
// função de hash mudar, esta constante NÃO pode mudar junto
// (scripts/test-mundo-semente.mjs trava as duas).
export const SEMENTE_LEGADO = 2055586687;

// FNV-1a de 32 bits. Serve pra dois usos: transformar a semente digitada pelo
// jogador ("aethra", "meu mundo") em número, e derivar sub-sementes por
// rótulo.
export function hashTexto(txt) {
  let h = 0x811c9dc5;
  const s = String(txt);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    // h *= 16777619 em aritmética de 32 bits sem estourar o double
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Aceita número, string ou nada e devolve sempre um uint32 utilizável.
// `0` é semente válida; só `undefined`/`null`/vazio caem no legado.
export function normalizarSemente(valor) {
  if (valor === undefined || valor === null || valor === "") return SEMENTE_LEGADO;
  if (typeof valor === "number" && Number.isFinite(valor)) return Math.abs(Math.trunc(valor)) >>> 0;
  const txt = String(valor).trim();
  if (/^\d+$/.test(txt)) return (Number(txt) >>> 0);
  return hashTexto(txt.toLowerCase());
}

// Semente nova pra um jogo novo. É o ÚNICO lugar do sistema de mundo em que
// Math.random() continua sendo legítimo: aqui ele escolhe qual mundo o
// jogador vai receber, uma vez só; dali em diante tudo é determinístico.
export function novaSemente() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

// Sub-semente por rótulo: derivarSemente(s, "dungeon1") sempre devolve o
// mesmo número pra mesma semente, e um número sem relação aparente com
// derivarSemente(s, "overworld").
export function derivarSemente(semente, rotulo) {
  return hashTexto(`${normalizarSemente(semente)}::${rotulo}`);
}

// mulberry32 — gerador pequeno, rápido e de qualidade bem melhor que o
// clássico "seno de um contador". Período de 2^32, passa nos testes de
// avalanche pra este uso (decoração de mapa, não criptografia).
export function criarPRNG(semente) {
  let a = normalizarSemente(semente) >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Atalho: PRNG do fluxo `rotulo` do mundo `semente`.
export function prngDe(semente, rotulo) {
  return criarPRNG(derivarSemente(semente, rotulo));
}

// Fisher-Yates de verdade. O código antigo embaralhava com
// `.sort(() => Math.random() - 0.5)`, que além de não ser semeável é
// enviesado — o comparador é inconsistente e o resultado depende do
// algoritmo de ordenação do motor.
export function embaralhar(lista, rnd) {
  for (let i = lista.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp;
  }
  return lista;
}

// Inteiro em [min, max], inclusivo dos dois lados.
export function inteiro(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

// Semente legível pro jogador: 32 bits em base 36 dão no máximo 7 caracteres
// ("1Z141Z3"), curto o bastante pra ditar por telefone.
export function formatarSemente(semente) {
  return normalizarSemente(semente).toString(36).toUpperCase();
}

// Inverso de formatarSemente para o texto que o jogador digitar. Um código
// em base 36 volta ao número original; qualquer outra frase vira hash, então
// "floresta bonita" também é uma semente válida.
export function lerSemente(texto) {
  const txt = String(texto || "").trim();
  if (!txt) return novaSemente();
  if (/^[0-9A-Za-z]{1,7}$/.test(txt)) {
    const n = parseInt(txt, 36);
    if (Number.isFinite(n) && n > 0 && String(n.toString(36)).toUpperCase() === txt.toUpperCase()) return n >>> 0;
  }
  return normalizarSemente(txt);
}
