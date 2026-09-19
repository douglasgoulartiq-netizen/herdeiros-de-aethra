const SELETORES = [
  "#hud-buttons button",
  "#modal-conteudo button",
  ".hda-tabs button",
  ".tela-party button",
  ".gacha-conteudo button",
  ".tela-gacha button",
  ".tela-missoes button",
  ".missao-card button",
  "#screen-batalha button",
  ".status-icone",
  ".status-mais",
  ".intencao-chip",
  ".tl-chip",
  ".companhia-selos span",
  ".tela-party .nome",
  ".gacha-conteudo .nome",
  ".tela-gacha .nome",
  ".missao-card .nome",
  ".caminho-mobile-legenda span",
  ".formacao-fileira-titulo",
  ".detalhe-titulo"
].join(",");

const NOMES = new Map([
  ["⚙", "Configurações"], ["×", "Fechar"], ["✕", "Fechar"], ["❌", "Fechar"],
  ["+", "Adicionar"], ["➕", "Adicionar"], ["−", "Remover"], ["-", "Remover"],
  ["🎯", "Selecionar alvo"], ["🎒", "Equipamentos"], ["🛡", "Defesa"],
  ["⚔", "Ataque"], ["✨", "Habilidade"], ["🗺", "Mapa"], ["📜", "Missões"],
  ["👤", "Personagem"], ["🔮", "Invocação"], ["▶", "Iniciar"], ["🔒", "Bloqueado"]
]);

const somenteIcone = /^[\p{Extended_Pictographic}\p{Symbol}\p{Punctuation}\uFE0F\u200D\s]+$/u;
const iconeInicial = /^(\p{Extended_Pictographic}|[✦✧✓✔×✕+➕−▲▼◀▶⚔⚙☰])(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*\s*/u;

function glifoCanonico(glifo) {
  const limpo = glifo.trim().replace(/\uFE0F/g, "");
  if (["✕", "❌"].includes(limpo)) return "×";
  if (limpo === "➕") return "+";
  if (limpo === "-") return "−";
  return glifo.trim();
}

function nomeDoIcone(glifo) {
  const base = glifoCanonico(glifo).replace(/\uFE0F/g, "");
  return NOMES.get(base) || "Ação";
}

function envolverIconeInicial(el) {
  if (el.querySelector(":scope > .hda-icone")) return;
  const no = [...el.childNodes].find((item) => item.nodeType === Node.TEXT_NODE && item.textContent.trim());
  if (!no) return;
  const achado = no.textContent.match(iconeInicial);
  if (!achado) return;

  const glifo = glifoCanonico(achado[0]);
  const resto = no.textContent.slice(achado[0].length);
  const moldura = document.createElement("span");
  moldura.className = `hda-icone${glifo === "×" ? " hda-icone--fechar" : ""}`;
  moldura.setAttribute("aria-hidden", "true");
  moldura.textContent = glifo;
  no.replaceWith(moldura, document.createTextNode(resto ? ` ${resto.trimStart()}` : ""));
}

function aprimorar(el) {
  if (!(el instanceof HTMLElement) || el.dataset.hdaIconeOk === "1") return;
  envolverIconeInicial(el);

  const texto = el.textContent.trim();
  if ((el.matches("button, [role='button']") || el.tabIndex >= 0) && texto && somenteIcone.test(texto)) {
    el.classList.add("hda-botao-icone");
    if (!el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", el.getAttribute("title") || nomeDoIcone(texto));
    }
  }
  el.dataset.hdaIconeOk = "1";
}

function varrer(raiz = document) {
  if (raiz instanceof HTMLElement && raiz.matches(SELETORES)) aprimorar(raiz);
  raiz.querySelectorAll?.(SELETORES).forEach(aprimorar);
}

varrer();
new MutationObserver((mudancas) => {
  for (const mudanca of mudancas) {
    mudanca.addedNodes.forEach((no) => {
      if (no.nodeType === Node.ELEMENT_NODE) varrer(no);
    });
  }
}).observe(document.body, { childList: true, subtree: true });
