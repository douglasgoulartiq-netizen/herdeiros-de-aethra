// CARDS DE BATALHA (loadout) — motor PURO, sem DOM.
//
// POR QUE ISTO EXISTE
// -------------------
// Enquanto uma classe tinha 2 ou 3 habilidades, mostrar todas na mão era o
// certo. Depois da árvore nova, um personagem pode chegar a 8 ou 9 ativas
// (habilidade inicial + até 8 nós de ramo), e um convocado lendário do gacha
// chega a 4. A mão de cards virou uma lista de compras: o jogador lê nove
// cards para decidir um turno, e o card fica estreito demais para caber a
// informação de cada um.
//
// Mais opções não é mais profundidade. Profundidade é ter que ESCOLHER antes
// da luta o que vai poder usar durante a luta.
//
// A REGRA: 4 cards. Nem mais, nem menos, e escolhidos fora da batalha.
//
// Quatro porque é o que cabe legível na dock da tela de batalha em qualquer
// largura (ver battle-cards.css), e porque com quatro o jogador ainda tem
// resposta para as quatro situações do jogo: bater forte, bater em área,
// se proteger e curar. Com três, alguma situação fica sem resposta.
//
// COMPATIBILIDADE: `personagem.cards` não existe em nenhum save antigo.
// `garantirLoadout` cria a lista na primeira leitura pegando as 4 primeiras
// habilidades — que é exatamente o que o jogo mostrava antes —, então um save
// antigo entra sem nenhuma mudança perceptível de comportamento.

export const LIMITE_CARDS = 4;

// Backfill defensivo, mesmo padrão de garantirEstadoArvore/garantirCompendio.
// Também PODA ids de habilidades que o personagem não tem mais (respec da
// árvore remove ativas): sem isso, um reset deixaria um card fantasma.
export function garantirLoadout(personagem) {
  if (!personagem) return [];
  const disponiveis = (personagem.habilidades || []).map((h) => h.id);
  if (!Array.isArray(personagem.cards)) {
    personagem.cards = disponiveis.slice(0, LIMITE_CARDS);
    return personagem.cards;
  }
  personagem.cards = personagem.cards.filter((id) => disponiveis.includes(id)).slice(0, LIMITE_CARDS);

  // COMPLETAR SLOT VAZIO — mas só enquanto o jogador não tiver mexido.
  //
  // A primeira versão completava sempre, e isso quebrava a tela inteira:
  // tirar um card chamava garantirLoadout na renderização seguinte, que
  // recolocava a habilidade removida, e o clique parecia não ter efeito.
  // Medido pelo teste: "tirar um card" devolvia a mão cheia de novo.
  //
  // `cardsAjustado` marca que a escolha passou a ser do JOGADOR. Antes
  // disso (save antigo, personagem novo, habilidade recém-ganha na árvore)
  // completar é o certo — é o comportamento que o jogo sempre teve. Depois
  // disso, slot vazio é uma decisão dele e ninguém preenche por cima.
  if (!personagem.cardsAjustado) {
    for (const id of disponiveis) {
      if (personagem.cards.length >= LIMITE_CARDS) break;
      if (!personagem.cards.includes(id)) personagem.cards.push(id);
    }
  }
  return personagem.cards;
}

// As habilidades que viram card, na ordem escolhida pelo jogador.
export function habilidadesEquipadas(personagem) {
  const ids = garantirLoadout(personagem);
  const porId = new Map((personagem.habilidades || []).map((h) => [h.id, h]));
  return ids.map((id) => porId.get(id)).filter(Boolean);
}

// As que existem mas ficaram de fora — a tela precisa das duas listas.
export function habilidadesNaReserva(personagem) {
  const ids = new Set(garantirLoadout(personagem));
  return (personagem.habilidades || []).filter((h) => !ids.has(h.id));
}

export function estaEquipada(personagem, id) {
  return garantirLoadout(personagem).includes(id);
}

// Liga/desliga um card. Devolve sempre `{ ok, motivo }` para a tela poder
// explicar a recusa em vez de simplesmente não reagir ao clique.
export function alternarCard(personagem, id) {
  const cards = garantirLoadout(personagem);
  const tem = (personagem.habilidades || []).some((h) => h.id === id);
  if (!tem) return { ok: false, motivo: "esta habilidade não é deste personagem" };
  const pos = cards.indexOf(id);
  if (pos >= 0) {
    if (cards.length <= 1) return { ok: false, motivo: "é preciso manter ao menos um card" };
    cards.splice(pos, 1);
    // A partir daqui a mão é escolha do jogador — ver garantirLoadout.
    personagem.cardsAjustado = true;
    return { ok: true, equipada: false };
  }
  if (cards.length >= LIMITE_CARDS) {
    return { ok: false, motivo: `já são ${LIMITE_CARDS} cards — tire um antes de pôr outro` };
  }
  cards.push(id);
  return { ok: true, equipada: true };
}

// Troca a ordem de dois cards. A ordem importa: é a ordem em que os cards
// aparecem na mão, e o cursor de teclado (barra de espaço) anda por ela.
export function moverCard(personagem, id, direcao) {
  const cards = garantirLoadout(personagem);
  const i = cards.indexOf(id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= cards.length) return { ok: false };
  [cards[i], cards[j]] = [cards[j], cards[i]];
  return { ok: true };
}
