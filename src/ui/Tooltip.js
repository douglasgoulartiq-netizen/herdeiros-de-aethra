// TOOLTIP DE HOVER — uma caixa flutuante para qualquer coisa que tenha
// descrição: item, habilidade, passiva, marca de classe, slot de equipamento.
//
// POR QUE ISTO EXISTE
// -------------------
// O jogo já escrevia a informação em vários lugares — só que sempre atrás de
// um CLIQUE. Para saber o que uma espada faz era preciso selecioná-la e ler o
// painel; para saber o que uma habilidade faz, abrir a árvore. O atributo
// `title` do HTML existia em alguns pontos, mas ele mostra texto puro, demora
// ~1,5s para aparecer e não cabe uma ficha inteira.
//
// Aqui a informação vem no HOVER, formatada, e some sozinha.
//
// COMO SE USA — dois passos, sempre os mesmos:
//   1. o elemento declara O QUE ele é:  data-tip-item="<uid|id>"  /
//      data-tip-hab="<id>"  /  data-tip-texto="..."  (texto solto)
//   2. depois de montar o HTML, chama-se `ligarTooltips(raiz, catalogo)`,
//      onde `catalogo` sabe resolver id → objeto.
//
// O HTML da ficha NUNCA vai dentro de um atributo: o atributo carrega só o
// id. Isso evita escapar HTML dentro de HTML (fonte clássica de tela
// quebrada) e deixa a ficha ser montada com o dado vivo do personagem — a
// mesma espada mostra requisito cumprido para um membro e penalidade para
// outro.

import { RARITY_COLORS, RARITY_LABEL } from "../systems/InventorySystem.js";
import { descreverEfeitos } from "../systems/ItemEffectSystem.js";
import { textoRequisito, penalidadeDe } from "../systems/RequisitoSystem.js";

const ID_CAIXA = "hda-tooltip";
const ID_CSS = "css-hda-tooltip";
const ATRASO_MS = 90;      // curto o suficiente para parecer instantâneo
const MARGEM = 14;          // distância do cursor
const CSS = `
#${ID_CAIXA} {
  position: fixed; z-index: 9999; max-width: 320px; pointer-events: none;
  background: #1b1510f2; border: 1px solid #7a5c34; border-radius: 10px;
  padding: 9px 11px; color: #f1e9d8; font-size: 0.82rem; line-height: 1.4;
  box-shadow: 0 8px 26px #000a; opacity: 0; transform: translateY(4px);
  transition: opacity .12s ease, transform .12s ease;
}
#${ID_CAIXA}.visivel { opacity: 1; transform: translateY(0); }
#${ID_CAIXA} .tt-nome { font-weight: 700; font-size: 0.92rem; margin-bottom: 2px; overflow-wrap: anywhere; }
#${ID_CAIXA} .tt-sub { font-size: 0.74rem; opacity: 0.72; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
#${ID_CAIXA} .tt-desc { opacity: 0.9; margin-bottom: 5px; overflow-wrap: anywhere; }
#${ID_CAIXA} .tt-linha { display: flex; justify-content: space-between; gap: 12px; }
#${ID_CAIXA} .tt-linha b { color: #ffd88a; font-weight: 600; }
#${ID_CAIXA} .tt-efeito { color: #9fe8ff; margin-top: 3px; }
#${ID_CAIXA} .tt-aviso { color: #ff9a9a; margin-top: 4px; }
#${ID_CAIXA} .tt-ok { color: #4ecb71; margin-top: 4px; }
#${ID_CAIXA} hr { border: 0; border-top: 1px solid #ffffff1f; margin: 6px 0; }
@media (hover: none) { #${ID_CAIXA} { display: none; } }
`;

function garantirCSS() {
  if (document.getElementById(ID_CSS)) return;
  const el = document.createElement("style");
  el.id = ID_CSS;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function caixa() {
  let el = document.getElementById(ID_CAIXA);
  if (!el) {
    garantirCSS();
    el = document.createElement("div");
    el.id = ID_CAIXA;
    el.setAttribute("role", "tooltip");
    document.body.appendChild(el);
  }
  return el;
}

const escapar = (t) => String(t == null ? "" : t)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// --- Fichas ---------------------------------------------------------------

// Os campos de número de um item, com o rótulo que o jogador entende. Vêm do
// items.json de verdade — a mesma lista que PartyUI usa para comparar poder.
const CAMPOS = [
  ["dano", "Dano"], ["danoMagico", "Dano mágico"], ["defesa", "Defesa"],
  ["bonusCritico", "Crítico"], ["bonusVelocidade", "Velocidade"], ["bonusCura", "Cura"],
  ["curaHP", "Recupera HP"], ["curaMP", "Recupera Éter"],
];

export function fichaDeItem(item, personagem = null) {
  if (!item) return "";
  const cor = RARITY_COLORS[item.raridade] || "#c9c9c9";
  const linhas = [];
  for (const [campo, rotulo] of CAMPOS) {
    if (item[campo]) linhas.push(`<div class="tt-linha"><span>${rotulo}</span><b>${item[campo] > 0 ? "+" : ""}${item[campo]}</b></div>`);
  }
  if (item.bonusAtributo) {
    for (const [k, v] of Object.entries(item.bonusAtributo)) {
      linhas.push(`<div class="tt-linha"><span>${k}</span><b>+${v}</b></div>`);
    }
  }
  if (item.elemento) linhas.push(`<div class="tt-linha"><span>Elemento</span><b>${escapar(item.elemento)}</b></div>`);
  if (item.valor) linhas.push(`<div class="tt-linha"><span>Valor</span><b>🪙 ${item.valor}</b></div>`);

  const efeitos = descreverEfeitos(item) || [];
  const efeitosHtml = efeitos.map((e) => `<div class="tt-efeito">◆ ${escapar(e)}</div>`).join("");

  // Requisito avaliado CONTRA QUEM ESTÁ OLHANDO: a mesma peça mostra "cumpre"
  // para um membro e a penalidade exata para outro. É a informação que decide
  // em quem vestir, e ela não existe sem o personagem.
  let reqHtml = "";
  if (personagem && item.requisito) {
    const req = textoRequisito(personagem, item);
    const pen = penalidadeDe(personagem, item);
    reqHtml = req && !req.ok
      ? `<div class="tt-aviso">⚠ ${escapar(req.texto)} — −${Math.round((1 - pen.dano) * 100)}% de dano e −${Math.round((1 - pen.acerto) * 100)}% de acerto</div>`
      : `<div class="tt-ok">✅ ${escapar((req && req.texto) || "requisito cumprido")}</div>`;
  }

  return `
    <div class="tt-nome" style="color:${cor}">${escapar(item.nome)}</div>
    <div class="tt-sub">${escapar(RARITY_LABEL[item.raridade] || item.raridade || "")}${item.tipo ? ` · ${escapar(item.tipo)}` : ""}${item.slot ? ` · ${escapar(item.slot)}` : ""}</div>
    ${item.descricao ? `<div class="tt-desc">${escapar(item.descricao)}</div>` : ""}
    ${linhas.length ? `${linhas.join("")}` : ""}
    ${efeitosHtml}
    ${reqHtml}`;
}

const ROTULO_TIPO = {
  dano_fisico: "Dano físico", dano_fisico_des: "Dano físico (Destreza)",
  dano_magico: "Dano mágico", dano_ignora_defesa: "Ignora defesa",
  dano_area: "Dano em ÁREA", cura: "Cura", cura_area: "Cura o TIME",
  buff_defesa: "Reforço de defesa", buff_ataque: "Reforço de ataque",
  buff_time: "Reforça o TIME", debuff_velocidade: "Atrasa o alvo",
  debuff_area: "Atrasa TODOS", fuga: "Fuga",
};

export function fichaDeHabilidade(h) {
  if (!h) return "";
  const linhas = [];
  linhas.push(`<div class="tt-linha"><span>Custo</span><b>${h.custoMP ? `${h.custoMP} de Éter` : "sem custo"}</b></div>`);
  if (h.cooldown) linhas.push(`<div class="tt-linha"><span>Recarga</span><b>${h.cooldown} turno${h.cooldown > 1 ? "s" : ""}</b></div>`);
  if (h.multiplicador) linhas.push(`<div class="tt-linha"><span>Potência</span><b>${Math.round(h.multiplicador * 100)}%</b></div>`);
  if (h.elemento) linhas.push(`<div class="tt-linha"><span>Elemento</span><b>${escapar(h.elemento)}</b></div>`);
  if (h.duracao) linhas.push(`<div class="tt-linha"><span>Duração</span><b>${h.duracao} turnos</b></div>`);
  return `
    <div class="tt-nome">${escapar(h.nome)}</div>
    <div class="tt-sub">${escapar(ROTULO_TIPO[h.tipo] || h.tipo || "habilidade")}</div>
    ${h.descricao ? `<div class="tt-desc">${escapar(h.descricao)}</div>` : ""}
    ${linhas.join("")}`;
}

export function fichaDePassiva(p) {
  if (!p) return "";
  return `
    <div class="tt-nome">${escapar(p.icone || "◆")} ${escapar(p.nome)}</div>
    <div class="tt-sub">Passiva · ${p.efeito && p.efeito.escopo === "time" ? "todo o time" : "só você"}</div>
    <div class="tt-desc">${escapar(p.descricao || "")}</div>`;
}

// --- Ligação --------------------------------------------------------------

let alvoAtual = null;
let timer = null;

function esconder() {
  if (timer) { clearTimeout(timer); timer = null; }
  alvoAtual = null;
  const c = document.getElementById(ID_CAIXA);
  if (c) c.classList.remove("visivel");
}

function posicionar(ev) {
  const c = caixa();
  const r = c.getBoundingClientRect();
  // Encosta no cursor, mas nunca sai da tela: quando não cabe à direita vai
  // para a esquerda; quando não cabe embaixo, sobe. Sem isso a ficha some
  // pela borda justamente nos itens da última coluna da grade.
  let x = ev.clientX + MARGEM;
  let y = ev.clientY + MARGEM;
  if (x + r.width > window.innerWidth - 8) x = Math.max(8, ev.clientX - r.width - MARGEM);
  if (y + r.height > window.innerHeight - 8) y = Math.max(8, ev.clientY - r.height - MARGEM);
  c.style.left = `${x}px`;
  c.style.top = `${y}px`;
}

export function mostrarTooltip(html, ev) {
  if (!html) return;
  const c = caixa();
  c.innerHTML = html;
  c.classList.add("visivel");
  posicionar(ev);
}

// `catalogo` resolve os ids declarados nos atributos:
//   { item: (chave) => item, habilidade: (id) => hab, passiva: (id) => p,
//     personagem: <personagem para avaliar requisito> }
//
// Delegação num listener só na raiz (em vez de um por elemento): a grade da
// mochila pode ter centenas de ladrilhos e é redesenhada a cada tecla da
// busca — pendurar listener em cada um seria caro e vazaria a cada redesenho.
export function ligarTooltips(raiz, catalogo = {}) {
  if (!raiz || raiz.__tooltipLigado) return;
  raiz.__tooltipLigado = true;
  garantirCSS();

  const resolver = (el) => {
    if (el.dataset.tipTexto) return `<div class="tt-desc">${escapar(el.dataset.tipTexto)}</div>`;
    if (el.dataset.tipItem && catalogo.item) return fichaDeItem(catalogo.item(el.dataset.tipItem), catalogo.personagem || null);
    if (el.dataset.tipHab && catalogo.habilidade) return fichaDeHabilidade(catalogo.habilidade(el.dataset.tipHab));
    if (el.dataset.tipPassiva && catalogo.passiva) return fichaDePassiva(catalogo.passiva(el.dataset.tipPassiva));
    return "";
  };

  raiz.addEventListener("mouseover", (ev) => {
    const el = ev.target.closest("[data-tip-item],[data-tip-hab],[data-tip-passiva],[data-tip-texto]");
    if (!el || el === alvoAtual) return;
    alvoAtual = el;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (alvoAtual !== el) return;
      const html = resolver(el);
      if (html) mostrarTooltip(html, ev);
    }, ATRASO_MS);
  });
  raiz.addEventListener("mousemove", (ev) => {
    const c = document.getElementById(ID_CAIXA);
    if (c && c.classList.contains("visivel")) posicionar(ev);
  });
  raiz.addEventListener("mouseout", (ev) => {
    const el = ev.target.closest("[data-tip-item],[data-tip-hab],[data-tip-passiva],[data-tip-texto]");
    if (el && el === alvoAtual) esconder();
  });
  // Rolar, clicar ou sair da janela some com a ficha: uma caixa flutuante
  // esquecida por cima da tela é pior que não ter tooltip nenhuma.
  raiz.addEventListener("scroll", esconder, true);
  raiz.addEventListener("click", esconder);
  window.addEventListener("blur", esconder);
}

export function fecharTooltip() { esconder(); }
