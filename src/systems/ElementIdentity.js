// Identidade visual dos elementos de Aethra (camada de APRESENTAÇÃO).
//
// src/data/elements.json continua sendo a única fonte de verdade das REGRAS
// (matriz de vantagem/resistência, multiplicadores) e dos nomes "de sistema"
// usados no log e no compêndio. Este módulo só acrescenta, por cima disso, o
// vocabulário do mundo (Chama, Maré, Geada, Vida, Terra, Vendaval, Éter,
// Umbral), a runa de cada elemento e a paleta usada pelos cards de batalha —
// nada aqui altera dano, relação elemental nem qualquer decisão de combate.
//
// Por que uma camada separada em vez de mexer em elements.json: aquele
// arquivo é lido por CombatSystem/ElementSystem/CompendiumSystem e por saves
// antigos; trocar `nome` lá renomearia o elemento no jogo inteiro (log,
// compêndio, itens) de uma vez só. Aqui, o nome de mundo aparece só onde a
// linguagem visual dos cards manda, e o restante do jogo continua idêntico.
//
// Regra de acessibilidade (item 29 do pedido): a cor NUNCA é o único sinal.
// Todo elemento tem, além da cor, uma runa, um ícone e uma classe CSS que
// muda borda/textura — quem não distingue as cores continua distinguindo os
// cards.

// `classe` vira `elem-<classe>` no card (ver src/battle-cards.css).
// `runa`: glifo rúnico do elemento, aceso quando o card é recomendado
// (item 94). `nomeMundo`: como Aethra chama o elemento.
const IDENTIDADES = {
  fisico: {
    classe: "fisico", nomeMundo: "Aço", runa: "ᛏ", icone: "⚔️",
    cor: "#cfc4ad", corForte: "#ffffff", corFraca: "#6b6455",
  },
  fogo: {
    classe: "chama", nomeMundo: "Chama", runa: "ᚲ", icone: "🔥",
    cor: "#ff7a3d", corForte: "#ffb066", corFraca: "#a33c14",
  },
  agua: {
    classe: "mare", nomeMundo: "Maré", runa: "ᛚ", icone: "💧",
    cor: "#4fa3ff", corForte: "#8fc8ff", corFraca: "#1d4d8c",
  },
  gelo: {
    classe: "geada", nomeMundo: "Geada", runa: "ᛁ", icone: "❄️",
    cor: "#a7ecff", corForte: "#e6fbff", corFraca: "#3f7d96",
  },
  natureza: {
    classe: "vida", nomeMundo: "Vida", runa: "ᛒ", icone: "🌿",
    cor: "#6fcf5c", corForte: "#a8f096", corFraca: "#2f6b26",
  },
  terra: {
    classe: "terra", nomeMundo: "Terra", runa: "ᚦ", icone: "⛰️",
    cor: "#c9a068", corForte: "#e8c896", corFraca: "#6b4f2a",
  },
  vento: {
    classe: "vendaval", nomeMundo: "Vendaval", runa: "ᚹ", icone: "🌪️",
    cor: "#a9ecdd", corForte: "#dcfff6", corFraca: "#3f7a6d",
  },
  arcano: {
    classe: "eter", nomeMundo: "Éter", runa: "ᚨ", icone: "🔮",
    cor: "#c58aff", corForte: "#e6c9ff", corFraca: "#5f2f96",
  },
  sombrio: {
    classe: "umbral", nomeMundo: "Umbral", runa: "ᛜ", icone: "🌑",
    cor: "#9a6bf0", corForte: "#c2a2ff", corFraca: "#3a1f66",
  },
  raio: {
    classe: "raio", nomeMundo: "Raio", runa: "ᛊ", icone: "⚡",
    cor: "#f5e34e", corForte: "#fff5a8", corFraca: "#8a7a14",
  },
  radiante: {
    classe: "radiante", nomeMundo: "Radiante", runa: "ᛞ", icone: "✨",
    cor: "#fff3b0", corForte: "#fffbe0", corFraca: "#8a7d3f",
  },
  veneno: {
    classe: "veneno", nomeMundo: "Veneno", runa: "ᛦ", icone: "☠️",
    cor: "#9fd14f", corForte: "#cdf08f", corFraca: "#4c6b1f",
  },
};

const PADRAO = IDENTIDADES.fisico;

export function identidadeElemento(elementoId) {
  return IDENTIDADES[elementoId] || PADRAO;
}

// Nome que aparece nos cards. Se `dadosElementos` for passado, o nome de
// sistema (elements.json) entra como parênteses só quando difere do nome de
// mundo — assim quem já conhece "Fogo" não se perde ao ver "Chama".
export function nomeElemento(elementoId, dadosElementos = null) {
  const id = identidadeElemento(elementoId);
  if (!dadosElementos || !dadosElementos.elementos) return id.nomeMundo;
  const sistema = dadosElementos.elementos.find((e) => e.id === elementoId);
  if (!sistema || sistema.nome === id.nomeMundo) return id.nomeMundo;
  return `${id.nomeMundo} (${sistema.nome})`;
}

export function classeElemento(elementoId) {
  return `elem-${identidadeElemento(elementoId).classe}`;
}

// Rótulo curto usado nas badges dos cards: runa + ícone + nome de mundo.
export function selo(elementoId) {
  const id = identidadeElemento(elementoId);
  return `${id.icone} ${id.nomeMundo}`;
}

// Relação elemental → rótulo/ícone/classe exibidos no card (itens 7 e 8 do
// pedido). Separado de ElementSystem.js de propósito: lá mora a regra, aqui
// só a forma de mostrá-la.
export const ROTULO_RELACAO = {
  vantagem_intensa: { texto: "VULNERÁVEL", icone: "↑↑", classe: "rel-vuln-forte", tom: "bom" },
  vantagem: { texto: "VULNERÁVEL", icone: "↑", classe: "rel-vuln", tom: "bom" },
  neutro: null,
  resistencia: { texto: "RESISTENTE", icone: "↓", classe: "rel-resist", tom: "ruim" },
  resistencia_intensa: { texto: "MUITO RESISTENTE", icone: "↓↓", classe: "rel-resist-forte", tom: "ruim" },
  imune: { texto: "IMUNE", icone: "🚫", classe: "rel-imune", tom: "ruim" },
};

export function rotuloRelacao(relacao) {
  return ROTULO_RELACAO[relacao] || null;
}
