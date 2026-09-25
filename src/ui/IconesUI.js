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
  ".companhia-selos > span",
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

// Lightweight vector glyphs share a single silver/crystal line weight.
// Original text remains for existing text-based integrations and fallbacks.
const TRACOS_ARCANOS = {
  '🎒':'M6 8h12v12H6z M9 8V5h6v3 M8 12h8v5H8z',
  '🛡':'M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6z M12 7v9',
  '⚔':'m5 3 13 13-2 2L3 5z M14 20l6-6 M5 21l4-4 M3 14l7 7 M16 3l5 2-9 9',
  '✨':'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  '🔮':'M18 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M8 17l-2 4h12l-2-4 M12 6v8 M9 10h6',
  '👤':'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3c0-6 16-6 16 0v3z',
  '📜':'M6 3h13v15H8V6H3V3z M8 18v3h13v-3 M11 7h5 M11 11h5 M11 15h3',
  '🗺':'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
  '⚙':'m12 3 3 3h4v4l2 2-2 3v4h-4l-3 2-3-2H5v-4l-2-3 2-2V6h4z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  '💍':'M17 15a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M8 4l4-2 4 2-4 6z',
  '×':'m6 6 12 12 M18 6 6 18',
};

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
  const traco = TRACOS_ARCANOS[glifo.replace(/\uFE0F/g, '')];
  if (traco) {
    moldura.classList.add('arc-icone-vetor');
    moldura.innerHTML = `<span class="arc-glifo-original">${glifo}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="${traco}"/></svg>`;
  } else moldura.textContent = glifo;
  no.replaceWith(moldura, document.createTextNode(resto ? ` ${resto.trimStart()}` : ""));
}

function aprimorar(el) {
  // A moldura também é um <span>. Nunca processá-la de novo: seletores
  // amplos de outras telas poderiam criar uma corrente infinita de ícones.
  if (!(el instanceof HTMLElement) || el.classList.contains("hda-icone") || el.dataset.hdaIconeOk === "1") return;
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
const pendentes = new Set();
let agendado = false;
function processarPendentes() {
  agendado = false;
  // Não fazer varredura de uma tela inteira dentro do mesmo clique que a
  // abriu. O acabamento dos ícones é secundário à resposta do botão.
  const lote = [...pendentes].slice(0, 20);
  for (const no of lote) {
    pendentes.delete(no);
    if (no.isConnected) varrer(no);
  }
  if (pendentes.size) agendar();
}
function agendar() {
  if (agendado) return;
  agendado = true;
  if ("requestIdleCallback" in window) requestIdleCallback(processarPendentes, { timeout: 500 });
  else setTimeout(processarPendentes, 16);
}
new MutationObserver((mudancas) => {
  for (const mudanca of mudancas) {
    for (const no of mudanca.addedNodes) {
      if (no.nodeType !== Node.ELEMENT_NODE) continue;
      // Uma tela inserida de uma vez já inclui seus filhos. Ignorar entradas
      // descendentes do mesmo lote evita varrê-la repetidamente.
      if ([...pendentes].some((pai) => pai.contains(no))) continue;
      for (const outro of pendentes) if (no.contains(outro)) pendentes.delete(outro);
      pendentes.add(no);
    }
  }
  if (pendentes.size) agendar();
}).observe(document.body, { childList: true, subtree: true });
