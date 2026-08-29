// Mercador Itinerante (melhoria de jogabilidade pós-backlog original): NPC
// que aparece TEMPORARIAMENTE durante a exploração (mesmo gatilho de
// encontro aleatório dos eventos de exploração, ver
// ExplorationEventSystem.js/main.js: verificarEncontroAleatorio — chance
// independente e ainda menor, só rola quando NEM o combate NEM um evento
// de exploração dispararam no mesmo passo), vendendo um catálogo EXCLUSIVO
// de itens (src/data/travelingMerchant.json) que NUNCA aparece na loja fixa
// da vila (essa só vende comum/incomum, ver GameUI.montarLoja — todo item
// deste catálogo é raro+, então a única forma de comprá-los é topando com
// o mercador). Preço reage à reputação REGIONAL da zona onde ele aparece,
// não à reputação com a vila — reaproveita
// WorldStateSystem.multiplicadorPrecoLoja(personagem, dadosWorldState,
// facaoId), que passou a aceitar facção como parâmetro por causa desta
// melhoria. Cada aparição só oferece um SUBCONJUNTO aleatório do catálogo
// (nunca tudo de uma vez), pra dar sensação de estoque limitado — nada é
// reservado entre aparições, é só sorteado de novo a cada vez.

const TAMANHO_ESTOQUE_PADRAO = 3;

export function deveAparecerMercador(chancePorPasso = 0.01) {
  return Math.random() < chancePorPasso;
}

// Sorteia `tamanho` itens distintos do catálogo completo, sem repetir —
// se o catálogo tiver menos itens que `tamanho`, devolve o catálogo
// inteiro embaralhado (nunca gera itens duplicados nem inventa itens).
export function sortearEstoqueMercador(catalogo, tamanho = TAMANHO_ESTOQUE_PADRAO) {
  const embaralhado = [...(catalogo || [])];
  for (let i = embaralhado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
  }
  return embaralhado.slice(0, Math.min(tamanho, embaralhado.length));
}
