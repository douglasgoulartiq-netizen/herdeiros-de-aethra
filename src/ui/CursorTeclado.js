// CURSOR POR TECLADO NOS MENUS.
//
// O pedido, nas palavras do jogador: "como se eu entrasse em uma caixa e
// pudesse usar o cursor para mexer nas opções e a barra de espaço para
// poder selecionar".
//
// É isso e nada mais: as setas andam entre as opções da janela aberta, a
// barra de espaço aciona a opção sob o cursor, Esc fecha. Vale para
// inventário, loja, gacha, coleção — qualquer coisa que abra dentro do
// #modal-conteudo.
//
// POR QUE NÃO BASTA O TAB DO NAVEGADOR
// ------------------------------------
// Tab existe e funciona, mas percorre TUDO — botões do cabeçalho, abas,
// filtros, o botão de fechar — na ordem do documento. Numa coleção com 100
// convocados isso é inutilizável. Aqui o cursor anda só entre as OPÇÕES da
// tela, na ordem visual, e dá a volta no fim da lista.
//
// DUAS REGRAS QUE EVITAM ESTRAGO
//   1. Se nada está sob o cursor, a primeira seta (ou o primeiro espaço)
//      ENTRA na lista em vez de acionar. Ninguém compra nada sem ver.
//   2. Campo de texto em foco desliga tudo: a barra de espaço volta a ser
//      espaço, como tem que ser.
//
// A batalha tem cursor próprio (BattleCards.js) porque lá o cursor precisa
// abrir a previsão da carta enquanto anda. Este módulo não se mete com ela.

// O que conta como "opção" numa janela. A ordem do seletor não importa: a
// lista final é reordenada pela posição na tela.
const SELETOR_OPCOES = [
  ".card",
  ".opcao-card",
  ".hda-aba",
  "button:not([disabled])",
  "[role=button]:not([aria-disabled=true])",
  "a[href]",
].join(",");

// Elementos que aparecem em toda janela e não são "opções" no sentido do
// cursor — pular o X de fechar evita que a primeira seta caia nele.
const IGNORAR = [
  ".hda-fechar",
  ".modal-fechar",
  "[data-cursor-ignorar]",
].join(",");

function visivel(el) {
  if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

// As opções da janela, na ordem em que os olhos as encontram: de cima para
// baixo, e da esquerda para a direita dentro da mesma faixa. Sem isso, uma
// grade de cards navegaria na ordem do HTML, que nem sempre é a visual.
export function opcoesDe(raiz) {
  if (!raiz) return [];
  const brutas = [...raiz.querySelectorAll(SELETOR_OPCOES)]
    .filter((el) => !el.closest(IGNORAR))
    .filter((el) => !el.disabled)
    .filter(visivel);

  // Um card clicável costuma conter botões próprios. Manter os dois faria o
  // cursor parar duas vezes no mesmo lugar; fica o de fora.
  const semAninhados = brutas.filter((el, _, todos) => !todos.some((o) => o !== el && o.contains(el)));

  return semAninhados.sort((a, b) => {
    const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
    // 24px de tolerância: dois cards da mesma linha raramente têm o mesmo
    // topo exato, e comparar y cru embaralharia a linha inteira.
    if (Math.abs(ra.top - rb.top) > 24) return ra.top - rb.top;
    return ra.left - rb.left;
  });
}

function focar(el) {
  if (!el) return;
  if (!el.hasAttribute("tabindex") && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
    el.setAttribute("tabindex", "-1");
  }
  try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
  el.classList.add("cursor-teclado");
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function limparMarca(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll(".cursor-teclado").forEach((e) => e.classList.remove("cursor-teclado"));
}

let ligado = false;

// Liga o cursor no jogo inteiro. Idempotente — chamar duas vezes não
// duplica o listener.
export function ligarCursorTeclado(seletorRaiz = "#modal-conteudo") {
  if (ligado || typeof document === "undefined") return;
  ligado = true;

  document.addEventListener("keydown", (ev) => {
    const alvo = ev.target;
    // Regra 2: digitando, o teclado é do campo.
    if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
    if (alvo && alvo.isContentEditable) return;
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

    const raiz = document.querySelector(seletorRaiz);
    if (!raiz || !visivel(raiz)) return;
    // A batalha cuida do próprio cursor.
    if (raiz.querySelector(".carta-batalha")) return;

    const PASSOS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const passo = PASSOS[ev.key];
    const ehEspaco = ev.key === " " || ev.key === "Spacebar";
    if (!passo && !ehEspaco) return;

    const opcoes = opcoesDe(raiz);
    if (!opcoes.length) return;

    const atual = opcoes.indexOf(document.activeElement);

    if (passo) {
      ev.preventDefault();
      limparMarca(raiz);
      // Regra 1: sem cursor, a seta ENTRA na lista.
      const i = atual === -1
        ? (passo > 0 ? 0 : opcoes.length - 1)
        : (atual + passo + opcoes.length) % opcoes.length;
      focar(opcoes[i]);
      return;
    }

    // Espaço.
    ev.preventDefault();
    if (atual === -1) { limparMarca(raiz); focar(opcoes[0]); return; }
    opcoes[atual].click();
  });
}
