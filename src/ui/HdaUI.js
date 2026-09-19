// Componentes de interface compartilhados por todas as telas do jogo.
//
// Regra que rege este arquivo (item 84 do briefing): desktop e celular
// COMPARTILHAM lógica, dados e ações. O que muda é a composição. Por isso não
// existe aqui nenhuma bifurcação de regra de jogo — só de layout, densidade e
// navegação. `abrirTela()` devolve a mesma estrutura nos dois formatos; quem
// decide se os detalhes viram painel lateral ou bottom sheet é o CSS, e quem
// decide se as abas viram faixa ou seletor é uma única função (`montarAbas`).
//
// O componente central é a CASCA DE TELA em três faixas:
//
//     ┌──────────────────────────────┐
//     │ cabeçalho   (fixo)           │  título, subtítulo, fechar
//     ├──────────────────────────────┤
//     │ abas        (fixo, opcional) │  nunca vira torre vertical
//     ├──────────────────────────────┤
//     │ corpo       (ROLA)           │  a única região com scroll
//     ├──────────────────────────────┤
//     │ ações       (fixo, opcional) │  EQUIPAR / CRIAR / INVOCAR
//     └──────────────────────────────┘
//
// Antes desta refatoração as quatro faixas eram um bloco rolável só, o que
// fazia a ação principal sair de vista assim que a lista crescia — o problema
// nº 1 da auditoria.
import { INTERVALO_CAIXA_TEXTO_MS } from "../systems/AutoPlayState.js";
import { somInterfaceAbrir, somInterfaceFechar, somTrocarAba } from "./SoundFX.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

// O modal e o mundo dividem o mesmo #app. Enquanto uma janela estiver
// aberta, o foco deve pertencer somente a ela: além de ser previsível para
// teclado, isso impede leitores de tela e controles por switch de alcançarem
// o HUD/canvas que continuam visíveis atrás da camada.
let modalAtivo = false;
let focoAntesDoModal = null;
let acaoFecharModalAtual = null;
let quadroFocoModal = 0;
const inertAnterior = new Map();

const SELETOR_FOCAVEL = [
  "button:not([disabled])", "[href]", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function modalEstaAberto() {
  const camada = overlay();
  return !!camada && !camada.classList.contains("hidden");
}

function elementoEstaVisivel(el) {
  if (!el || el.hidden || el.closest("[hidden], [aria-hidden='true']")) return false;
  const estilo = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  return !estilo || (estilo.display !== "none" && estilo.visibility !== "hidden");
}

function focaveisDentro(raiz) {
  return [...(raiz?.querySelectorAll(SELETOR_FOCAVEL) || [])].filter(elementoEstaVisivel);
}

function tornarMundoInerte() {
  if (typeof HTMLElement === "undefined" || !("inert" in HTMLElement.prototype)) return;
  const camada = overlay();
  const app = camada?.parentElement;
  const alvos = [
    ...(app ? [...app.children].filter((el) => el !== camada) : []),
    ...document.querySelectorAll("body > .hda-navbar"),
  ];
  for (const el of alvos) {
    if (inertAnterior.has(el)) continue;
    inertAnterior.set(el, el.inert);
    el.inert = true;
  }
}

function restaurarMundo() {
  for (const [el, valor] of inertAnterior) {
    if (el.isConnected) el.inert = valor;
  }
  inertAnterior.clear();
}

function associarTituloAoDialogo() {
  const raiz = conteudo();
  if (!raiz) return null;
  raiz.setAttribute("role", "dialog");
  raiz.setAttribute("aria-modal", "true");
  raiz.setAttribute("tabindex", "-1");
  const titulo = raiz.querySelector(".hda-modal-cab h2, h1, h2, h3");
  if (titulo) {
    if (!titulo.id) titulo.id = "hda-modal-titulo";
    titulo.setAttribute("tabindex", "-1");
    raiz.setAttribute("aria-labelledby", titulo.id);
    raiz.removeAttribute("aria-label");
  } else {
    raiz.removeAttribute("aria-labelledby");
    raiz.setAttribute("aria-label", "Janela do jogo");
  }
  return titulo;
}

function focarInicioDoModal() {
  if (!modalEstaAberto()) return;
  const raiz = conteudo();
  const titulo = associarTituloAoDialogo();
  const alvo = raiz?.querySelector("[autofocus], .hda-fechar, .fechar")
    || focaveisDentro(raiz)[0]
    || titulo
    || raiz;
  alvo?.focus?.({ preventScroll: true });
}

function ativarModal(acaoFechar = null) {
  const camada = overlay();
  if (!camada) return;
  if (!modalAtivo) {
    const ativo = document.activeElement;
    focoAntesDoModal = ativo && ativo !== document.body ? ativo : null;
  }
  modalAtivo = true;
  if (acaoFechar) acaoFecharModalAtual = acaoFechar;
  camada.setAttribute("aria-hidden", "false");
  associarTituloAoDialogo();
  tornarMundoInerte();
  if (quadroFocoModal) cancelAnimationFrame(quadroFocoModal);
  quadroFocoModal = requestAnimationFrame(() => {
    quadroFocoModal = 0;
    focarInicioDoModal();
  });
}

function desativarModal() {
  if (!modalAtivo && !inertAnterior.size) return;
  const origem = focoAntesDoModal;
  modalAtivo = false;
  focoAntesDoModal = null;
  acaoFecharModalAtual = null;
  if (quadroFocoModal) cancelAnimationFrame(quadroFocoModal);
  quadroFocoModal = 0;
  overlay()?.setAttribute("aria-hidden", "true");
  restaurarMundo();
  requestAnimationFrame(() => {
    if (!modalEstaAberto() && origem?.isConnected && !origem.disabled && !origem.inert) {
      origem.focus({ preventScroll: true });
    }
  });
}

// Largura-alvo por densidade de conteúdo. Uma tela de leitura (Acessibilidade)
// não deve esticar até 1400px; uma grade de itens deve.
export const LARGURA = {
  leitura: "820px",     // texto corrido, formulários
  media: "1040px",      // listas com detalhe
  larga: "1320px",      // grades densas (inventário, bestiário, gacha)
  cheia: "min(1600px, 96vw)", // mapas e árvores
};

// Limite entre as duas composições. Casado com o `@media (max-width: 719px)`
// de hda-ui.css — mudar um exige mudar o outro.
export const LIMITE_MOBILE = 720;
export const LIMITE_DUAS_COLUNAS = 900;

export function ehMobile() {
  return typeof window !== "undefined" && window.innerWidth < LIMITE_MOBILE;
}
export function cabeDuasColunas() {
  return typeof window !== "undefined" && window.innerWidth >= LIMITE_DUAS_COLUNAS;
}

// ---------------------------------------------------------------------
// CASCA DE TELA
// ---------------------------------------------------------------------

/**
 * Abre uma tela dentro do modal padrão do jogo, já em três faixas.
 *
 * @param {object} o
 * @param {string} o.titulo      Texto do cabeçalho.
 * @param {string} [o.subtitulo] Chip à direita do título (ouro, saldo, nível).
 * @param {string} [o.largura]   Uma das constantes de LARGURA.
 * @param {string} [o.classe]    Classe extra no #modal-conteudo.
 * @param {boolean}[o.corpoSemPadding]
 * @param {Function}[o.aoFechar]
 * @returns {{raiz, cabecalho, corpo, definirAbas, definirAcoes, definirSubtitulo, fechar}}
 */
export function abrirTela({ titulo, subtitulo = "", largura = LARGURA.media, classe = "", corpoSemPadding = false, aoFechar = null } = {}) {
  const estavaAberta = modalEstaAberto();
  const raiz = conteudo();
  overlay().classList.remove("hidden");
  delete raiz.dataset.autoAvancarEm;
  delete raiz.dataset.interacao;
  raiz.className = `hda-modal ${classe}`.trim();
  raiz.style.setProperty("--hda-modal-larg", largura);
  raiz.innerHTML = `
    <header class="hda-modal-cab">
      <h2 id="hda-modal-titulo" tabindex="-1" title="${escapar(titulo)}">${escapar(titulo)}</h2>
      ${subtitulo ? `<span class="hda-modal-sub">${subtitulo}</span>` : ""}
      <button type="button" class="hda-fechar fechar" aria-label="Fechar" title="Fechar (Esc)">✕</button>
    </header>
    <div class="hda-modal-corpo${corpoSemPadding ? " sem-pad" : ""}" id="modal-corpo"></div>
  `;
  const corpo = raiz.querySelector("#modal-corpo");
  const cabecalho = raiz.querySelector(".hda-modal-cab");
  const fechar = () => { fecharTela(); if (aoFechar) aoFechar(); };
  raiz.querySelector(".hda-fechar").onclick = fechar;
  ativarModal(fechar);
  if (!estavaAberta) somInterfaceAbrir();

  return {
    raiz, cabecalho, corpo, fechar,
    definirSubtitulo(html) {
      let el = cabecalho.querySelector(".hda-modal-sub");
      if (!el) {
        el = document.createElement("span");
        el.className = "hda-modal-sub";
        cabecalho.insertBefore(el, cabecalho.querySelector(".hda-fechar"));
      }
      el.innerHTML = html;
    },
    // Abas fixas logo abaixo do cabeçalho (nunca dentro do corpo rolável).
    definirAbas(abas, aoTrocar, ativa) {
      const antiga = raiz.querySelector(".hda-tabs, .hda-tabs-wrap");
      if (antiga) antiga.remove();
      const el = montarAbas(abas, aoTrocar, ativa);
      raiz.insertBefore(el, corpo);
      return el;
    },
    // Barra de ações fixa no rodapé. É o que garante o item 6: EQUIPAR,
    // CRIAR, INVOCAR e CONFIRMAR nunca dependem de rolagem.
    definirAcoes(botoes, infoHTML = "") {
      let rodape = raiz.querySelector(".hda-acoes");
      if (!botoes || !botoes.length) { if (rodape) rodape.remove(); return null; }
      if (!rodape) {
        rodape = document.createElement("footer");
        rodape.className = "hda-acoes";
        raiz.appendChild(rodape);
      }
      rodape.innerHTML = infoHTML ? `<span class="hda-acoes-info">${infoHTML}</span>` : "";
      for (const b of botoes) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b.rotulo;
        if (b.classe) btn.className = b.classe;
        if (b.titulo) btn.title = b.titulo;
        btn.disabled = !!b.desabilitado;
        btn.onclick = b.onClick;
        rodape.appendChild(btn);
      }
      return rodape;
    },
  };
}

export function fecharTela() {
  const estavaAberta = modalEstaAberto();
  fecharSheet(true);
  const camada = overlay();
  camada.classList.add("hidden");
  camada.setAttribute("aria-hidden", "true");
  const raiz = conteudo();
  delete raiz.dataset.autoAvancarEm;
  delete raiz.dataset.interacao;
  raiz.className = "";
  raiz.removeAttribute("style");
  raiz.innerHTML = "";
  desativarModal();
  if (estavaAberta) somInterfaceFechar();
}

// Interações narrativas abertas durante a exploração recebem um relógio
// único. O automático só aciona o botão preferencial depois de quatro
// segundos; menus de configuração não recebem a marca e continuam podendo
// ficar abertos enquanto o herói explora.
export function marcarInteracaoAutomatica(corpoOuRaiz, atrasoMs = INTERVALO_CAIXA_TEXTO_MS) {
  const raiz = corpoOuRaiz && (corpoOuRaiz.closest?.("#modal-conteudo") || corpoOuRaiz);
  if (!raiz) return;
  raiz.dataset.interacao = "true";
  raiz.dataset.autoAvancarEm = String(Date.now() + Math.max(0, atrasoMs));
}

export function interacaoAutomaticaPronta() {
  const raiz = conteudo();
  if (!raiz || raiz.dataset.interacao !== "true") return true;
  return Date.now() >= Number(raiz.dataset.autoAvancarEm || 0);
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}


// ---------------------------------------------------------------------
// ABAS
// ---------------------------------------------------------------------

/**
 * Faixa de abas que nunca vira torre vertical.
 *
 * A regra de decisão vem direto do item 15: no celular, até 5 abas cabem numa
 * faixa rolável com folga; acima disso, uma faixa exigiria arrastar para
 * DESCOBRIR que existem funções — e descobrir função por acidente é
 * exatamente o que o briefing proíbe. Então acima de 5 abas o celular recebe
 * um seletor, que mostra a lista inteira de uma vez.
 *
 * @param {Array<{id, rotulo, icone?}>} abas
 */
export function montarAbas(abas, aoTrocar, ativa = null, { sub = false } = {}) {
  let atual = abas.some((a) => a.id === ativa) ? ativa : abas[0]?.id;
  const nav = document.createElement("div");
  nav.className = `hda-tabs${sub ? " hda-subtabs" : ""}${abas.length > 5 ? " hda-tabs-muitas" : ""}`;
  nav.dataset.abaAtiva = atual || "";

  // Os dois controles ficam no DOM o tempo inteiro. O CSS decide qual deles
  // aparece em cada largura; assim girar o aparelho não exige remontar a tela
  // nem perde a aba que o jogador estava usando.
  const sel = document.createElement("select");
  sel.className = "hda-tabs-select";
  sel.setAttribute("aria-label", "Seção");
  sel.innerHTML = abas.map((a) => `<option value="${a.id}"${a.id === atual ? " selected" : ""}>${a.icone ? `${a.icone} ` : ""}${a.rotulo}</option>`).join("");
  nav.appendChild(sel);

  const faixa = document.createElement("div");
  faixa.className = "hda-tabs-faixa";
  faixa.setAttribute("role", "tablist");
  for (const a of abas) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(a.id === atual));
    b.dataset.abaId = a.id;
    b.className = a.id === atual ? "ativa" : "";
    b.textContent = a.icone ? `${a.icone} ${a.rotulo}` : a.rotulo;
    faixa.appendChild(b);
  }
  nav.appendChild(faixa);

  const selecionar = (id, notificar = true) => {
    if (!abas.some((a) => a.id === id)) return;
    if (id === atual) return;
    atual = id;
    nav.dataset.abaAtiva = id;
    sel.value = id;
    faixa.querySelectorAll("[role='tab']").forEach((b) => {
      const selecionada = b.dataset.abaId === id;
      b.classList.toggle("ativa", selecionada);
      b.setAttribute("aria-selected", String(selecionada));
    });
    if (notificar) {
      somTrocarAba();
      aoTrocar(id);
    }
  };
  sel.onchange = () => selecionar(sel.value);
  faixa.querySelectorAll("[role='tab']").forEach((b) => {
    b.onclick = () => selecionar(b.dataset.abaId);
  });

  // A aba ativa entra visível mesmo que a faixa esteja rolada.
  requestAnimationFrame(() => {
    const at = faixa.querySelector(".ativa");
    if (at && faixa.scrollWidth > faixa.clientWidth) at.scrollIntoView({ inline: "center", block: "nearest" });
  });
  return nav;
}

// ---------------------------------------------------------------------
// PAINEL CONTEXTUAL — bottom sheet no celular, painel lateral no desktop
// ---------------------------------------------------------------------

let sheetAberto = null;

/**
 * Abre o painel de detalhes. É o MESMO componente nos dois formatos (item 47):
 * o CSS o posiciona embaixo no celular e à direita no desktop. Nenhuma tela
 * precisa saber em qual formato está.
 */
export function abrirSheet({ titulo, corpoHTML, acoes = [], aoFechar = null } = {}) {
  fecharSheet(true);
  const fundo = document.createElement("div");
  fundo.className = "hda-sheet-fundo";
  const el = document.createElement("aside");
  el.className = "hda-sheet";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", titulo || "Detalhes");
  el.innerHTML = `
    <div class="hda-sheet-pega" aria-hidden="true"></div>
    <div class="hda-sheet-cab"><h3>${titulo || ""}</h3><button type="button" class="hda-fechar" aria-label="Fechar detalhes">✕</button></div>
    <div class="hda-sheet-corpo">${corpoHTML || ""}</div>
  `;
  if (acoes.length) {
    const rodape = document.createElement("div");
    rodape.className = "hda-sheet-acoes";
    for (const a of acoes) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.rotulo;
      if (a.classe) b.className = a.classe;
      b.disabled = !!a.desabilitado;
      if (a.titulo) b.title = a.titulo;
      b.onclick = a.onClick;
      rodape.appendChild(b);
    }
    el.appendChild(rodape);
  }
  document.body.appendChild(fundo);
  document.body.appendChild(el);
  const fechar = () => { fecharSheet(); if (aoFechar) aoFechar(); };
  el.querySelector(".hda-fechar").onclick = fechar;
  fundo.onclick = fechar;
  sheetAberto = { el, fundo };
  somInterfaceAbrir();
  return { el, corpo: el.querySelector(".hda-sheet-corpo"), fechar };
}

export function fecharSheet(silencioso = false) {
  if (!sheetAberto) return;
  sheetAberto.el.remove();
  sheetAberto.fundo.remove();
  sheetAberto = null;
  if (!silencioso) somInterfaceFechar();
}

export function sheetEstaAberto() { return !!sheetAberto; }

// ---------------------------------------------------------------------
// NAVEGAÇÃO INFERIOR (celular)
// ---------------------------------------------------------------------

let navbarEl = null;

/**
 * Barra de navegação inferior com POUCOS destinos (item 44). Só existe no
 * celular; no desktop os mesmos destinos continuam no HUD lateral, que tem
 * largura de sobra. Uma única fonte de verdade para os dois: a lista de hubs
 * passada aqui é a mesma que monta os botões do HUD.
 */
export function montarNavbar(destinos, aoEscolher) {
  removerNavbar();
  const nav = document.createElement("nav");
  nav.className = "hda-navbar";
  nav.setAttribute("aria-label", "Navegação principal");
  for (const d of destinos) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.destino = d.id;
    b.innerHTML = `<span class="hda-nav-icone" aria-hidden="true">${d.icone}</span><span class="hda-nav-rotulo">${d.rotulo}</span>`;
    b.onclick = () => aoEscolher(d.id, b);
    nav.appendChild(b);
  }
  document.body.appendChild(nav);
  navbarEl = nav;
  return nav;
}

export function removerNavbar() {
  if (navbarEl) { navbarEl.remove(); navbarEl = null; }
}

export function marcarNavbarAtiva(id) {
  if (!navbarEl) return;
  navbarEl.querySelectorAll("button").forEach((b) => {
    const ativa = b.dataset.destino === id;
    b.classList.toggle("ativa", ativa);
    if (ativa) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

// ---------------------------------------------------------------------
// GRADE E LISTAS
// ---------------------------------------------------------------------

/**
 * Grade cujo número de colunas é calculado pelo CSS a partir da largura
 * disponível (item 68) — nunca uma contagem fixa que estoure a viewport.
 * `min(100%, col)` garante que, a 320px, a coluna encolhe em vez de vazar.
 */
export function criarGrade({ densidade = "", coluna = null } = {}) {
  const el = document.createElement("div");
  el.className = `hda-grid ${densidade}`.trim();
  if (coluna) el.style.setProperty("--hda-col", coluna);
  return el;
}

/** Divide o corpo em colunas no desktop e coluna única no celular. */
export function criarSplit({ colunas = "duas" } = {}) {
  const el = document.createElement("div");
  el.className = `hda-split ${colunas}`;
  return el;
}

// ---------------------------------------------------------------------
// TECLADO
// ---------------------------------------------------------------------

// Teclado do modal compartilhado. O listener roda na captura para o Escape
// não chegar também ao atalho global de main.js e fechar duas camadas.
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (ev) => {
    if (!modalEstaAberto()) return;

    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (sheetAberto) { fecharSheet(); return; }
      const raiz = conteudo();
      // Fluxos realmente inadiáveis podem declarar o bloqueio sem criar uma
      // segunda implementação de modal. Fora disso, Esc é sempre uma saída.
      if (raiz?.dataset.escapeBloqueado === "true" || raiz?.querySelector("[data-escape-bloqueado='true']")) return;
      const acao = acaoFecharModalAtual;
      if (acao) acao();
      else {
        const botaoFechar = raiz?.querySelector(".hda-fechar, .fechar");
        if (botaoFechar) botaoFechar.click();
        else fecharTela();
      }
      return;
    }

    if (ev.key !== "Tab") return;
    const raiz = sheetAberto?.el || conteudo();
    const focaveis = focaveisDentro(raiz);
    if (!focaveis.length) {
      ev.preventDefault();
      raiz?.focus?.({ preventScroll: true });
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const fora = !raiz.contains(document.activeElement);
    if (ev.shiftKey && (fora || document.activeElement === primeiro)) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && (fora || document.activeElement === ultimo)) {
      ev.preventDefault();
      primeiro.focus();
    }
  }, true);

  // Algumas telas antigas ainda preenchem #modal-conteudo diretamente. O
  // observador aplica o mesmo contrato de foco/semântica a elas sem tocar em
  // cada componente e também garante limpeza se alguma fechar a camada sem
  // passar por fecharTela().
  const camada = overlay();
  if (camada) {
    camada.setAttribute("aria-hidden", camada.classList.contains("hidden") ? "true" : "false");
    new MutationObserver(() => {
      if (modalEstaAberto()) ativarModal();
      else desativarModal();
    }).observe(camada, { attributes: true, attributeFilter: ["class"] });
  }
}
