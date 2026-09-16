// REQUISITO DE ATRIBUTO — motor PURO, sem DOM.
//
// POR QUE ISTO EXISTE
// -------------------
// Nenhuma arma do jogo pedia atributo nenhum (conferido: zero ocorrências de
// requisito no items.json e no InventorySystem). Consequência: distribuir
// atributo nunca foi decisão. O guerreiro sobe FOR porque sim, e qualquer
// arma cabe na mão de qualquer um.
//
// A REGRA ESCOLHIDA: equipa, mas com penalidade.
//
// A alternativa — bloquear — é mais fácil de balancear, e foi recusada de
// propósito: ela transforma o lendário que você achou cedo em peso morto na
// mochila, e "achei uma coisa incrível que ainda não sei usar direito" é uma
// sensação melhor do que "achei uma coisa que não posso tocar". Com
// penalidade, o item é usável desde o primeiro instante e melhora conforme
// o personagem cresce até o requisito — a progressão fica visível.
//
// A penalidade é PROPORCIONAL ao que falta, nunca um degrau. Faltando 1
// ponto o item é quase perfeito; faltando 10 ele é quase inútil. Isso evita
// o efeito de fronteira em que subir um ponto de atributo dobra o dano.

// Quanto cada ponto faltante custa. Medido contra a faixa de dano do jogo:
// 6% por ponto significa que faltar 5 tira ~26% do dano, o que dói sem
// inutilizar. O piso existe para o item nunca virar zero.
export const PENALIDADE_POR_PONTO = 0.06;
export const PENALIDADE_MAXIMA = 0.6; // no pior caso, 40% do dano original
// Acerto sofre menos que o dano: uma arma pesada demais erra mais, mas o
// jogador ainda precisa sentir que está jogando, não sorteando.
export const PENALIDADE_ACERTO_POR_PONTO = 0.03;
export const PENALIDADE_ACERTO_MAXIMA = 0.3;

// O requisito declarado de um item, ou null. Formato no items.json:
//   "requisito": { "FOR": 24 }
export function requisitoDe(item) {
  if (!item || !item.requisito) return null;
  const entradas = Object.entries(item.requisito).filter(([, v]) => Number(v) > 0);
  return entradas.length ? Object.fromEntries(entradas) : null;
}

// Quanto falta para cumprir. Devolve 0 quando cumpre (ou quando não há
// requisito), e a soma do que falta quando não cumpre.
export function faltaPara(personagem, item) {
  const req = requisitoDe(item);
  if (!req || !personagem) return 0;
  const attrs = personagem.atributos || {};
  return Object.entries(req)
    .reduce((soma, [attr, minimo]) => soma + Math.max(0, minimo - (attrs[attr] || 0)), 0);
}

export function cumpreRequisito(personagem, item) {
  return faltaPara(personagem, item) === 0;
}

// A penalidade aplicada. Sempre a mesma forma, com 1 (sem penalidade) quando
// não há requisito — assim quem chama nunca testa null.
export function penalidadeDe(personagem, item) {
  const falta = faltaPara(personagem, item);
  if (falta <= 0) return { falta: 0, dano: 1, acerto: 1, penalizado: false };
  return {
    falta,
    dano: 1 - Math.min(PENALIDADE_MAXIMA, falta * PENALIDADE_POR_PONTO),
    acerto: 1 - Math.min(PENALIDADE_ACERTO_MAXIMA, falta * PENALIDADE_ACERTO_POR_PONTO),
    penalizado: true,
  };
}

// A penalidade de TUDO que o personagem está usando. Hoje só a arma entra no
// cálculo de dano, mas a função já soma o conjunto para não precisar mudar de
// forma quando armadura pesada também pedir requisito.
export function penalidadeEquipada(personagem) {
  if (!personagem || !personagem.equipamento) return { dano: 1, acerto: 1, penalizado: false, itens: [] };
  const itens = [];
  let dano = 1; let acerto = 1;
  Object.values(personagem.equipamento).forEach((item) => {
    const p = penalidadeDe(personagem, item);
    if (!p.penalizado) return;
    itens.push({ item, ...p });
    dano *= p.dano;
    acerto *= p.acerto;
  });
  return { dano, acerto, penalizado: itens.length > 0, itens };
}

// Texto para a tela. Curto e específico: diz o que falta e o quanto custa.
export function textoRequisito(personagem, item) {
  const req = requisitoDe(item);
  if (!req) return null;
  const partes = Object.entries(req).map(([a, v]) => `${a} ${v}`);
  const p = penalidadeDe(personagem, item);
  if (!p.penalizado) return { ok: true, texto: `Requer ${partes.join(", ")} — você cumpre.` };
  const attrs = (personagem && personagem.atributos) || {};
  const faltando = Object.entries(req)
    .filter(([a, v]) => (attrs[a] || 0) < v)
    .map(([a, v]) => `${a} ${attrs[a] || 0}/${v}`);
  return {
    ok: false,
    texto: `Requer ${partes.join(", ")} — falta ${faltando.join(", ")}. `
      + `Dano −${Math.round((1 - p.dano) * 100)}%, acerto −${Math.round((1 - p.acerto) * 100)}%.`,
  };
}
