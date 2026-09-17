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
  ".card[role=button]",
  ".card[data-cursor-opcao]",
  ".opcao-card",
  ".hda-aba",
  "button:not([disabled])",
  "[role=button]:not([aria-disabled=true])",
  "a[href]",
].join(",");

const RAIZES = ["#tutorial-camada", "#cutscene-camada", ".hda-sheet", "#modal-conteudo", "#screen-criacao:not(.hidden)", "#screen-boot:not(.hidden)"];

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
  // `onclick` atribuído por JavaScript não aparece em seletor CSS. Algumas
  // grades antigas usam exatamente esse padrão; incluí-las aqui é o que
  // fecha a lacuna entre “clicável com mouse” e “jogável por teclado”.
  const candidatas = new Set([
    ...raiz.querySelectorAll(SELETOR_OPCOES),
    ...[...raiz.querySelectorAll("*")].filter((el) => typeof el.onclick === "function"),
  ]);
  const brutas = [...candidatas]
    .filter((el) => !el.closest(IGNORAR))
    .filter((el) => !el.disabled)
    .filter(visivel);

  return brutas.sort((a, b) => {
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

function raizAtiva(seletorPersonalizado) {
  if (seletorPersonalizado && seletorPersonalizado !== "#modal-conteudo") {
    const r = document.querySelector(seletorPersonalizado);
    return r && visivel(r) ? r : null;
  }
  return RAIZES.map((s) => document.querySelector(s)).find((r) => r && visivel(r)) || null;
}

function vizinhoEspacial(atual, opcoes, tecla) {
  // Telas com grupos de controles muito diferentes (slots, ações e login)
  // podem declarar um vizinho intencional. Isso evita que a matemática de
  // distância pule para um botão visualmente próximo, mas semanticamente
  // errado — por exemplo, Slot 1 -> login em vez de Slot 1 -> Novo jogo.
  const atributo = {
    ArrowRight: "navRight",
    ArrowLeft: "navLeft",
    ArrowDown: "navDown",
    ArrowUp: "navUp",
  }[tecla];
  const seletorExplicito = atributo ? atual.dataset[atributo] : null;
  if (seletorExplicito) {
    const explicito = document.querySelector(seletorExplicito);
    if (explicito && opcoes.includes(explicito) && visivel(explicito)) return explicito;
  }
  const r = atual.getBoundingClientRect();
  const origem = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const candidatos = opcoes.filter((el) => {
    if (el === atual) return false;
    const c = el.getBoundingClientRect();
    const x = c.left + c.width / 2, y = c.top + c.height / 2;
    if (tecla === "ArrowRight") return x > origem.x + 3;
    if (tecla === "ArrowLeft") return x < origem.x - 3;
    if (tecla === "ArrowDown") return y > origem.y + 3;
    return y < origem.y - 3;
  });
  candidatos.sort((a, b) => {
    const pontuar = (el) => {
      const c = el.getBoundingClientRect();
      const dx = c.left + c.width / 2 - origem.x;
      const dy = c.top + c.height / 2 - origem.y;
      const principal = tecla === "ArrowLeft" || tecla === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
      const lateral = tecla === "ArrowLeft" || tecla === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
      return principal + lateral * 2.2;
    };
    return pontuar(a) - pontuar(b);
  });
  return candidatos[0] || null;
}

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

    const raiz = raizAtiva(seletorRaiz);
    if (!raiz || !visivel(raiz)) return;
    // A batalha cuida do próprio cursor.
    if (raiz.querySelector(".carta-batalha")) return;

    const direcao = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(ev.key) ? ev.key : null;
    const ehEspaco = ev.key === " " || ev.key === "Spacebar";
    const ehEnter = ev.key === "Enter";
    if (!direcao && !ehEspaco && !ehEnter) return;

    const opcoes = opcoesDe(raiz);
    if (!opcoes.length) return;

    const atual = opcoes.indexOf(document.activeElement);

    if (direcao) {
      ev.preventDefault();
      limparMarca(raiz);
      // Regra 1: sem cursor, a seta ENTRA na lista.
      const proximo = atual === -1 ? opcoes[0] : vizinhoEspacial(opcoes[atual], opcoes, direcao);
      focar(proximo || opcoes[atual === -1 ? 0 : atual]);
      return;
    }

    // Espaço ou Enter.
    ev.preventDefault();
    if (atual === -1) { limparMarca(raiz); focar(opcoes[0]); return; }
    opcoes[atual].click();
  });
}
