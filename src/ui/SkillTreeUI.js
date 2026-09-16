// TELA DA ÁRVORE DE HABILIDADES — 3 ramos lado a lado, 6 degraus cada.
//
// O que a tela precisa deixar óbvio, em ordem de importância:
//   1. quantos pontos você tem agora (é a moeda; some do topo e a tela vira
//      um catálogo bonito e inútil);
//   2. por que um nó específico está fechado — e o motivo COMPLETO, não o
//      primeiro obstáculo. "Falta nível 12 e INT 10" numa linha evita o
//      jogador subir dois níveis para descobrir que ainda falta o atributo;
//   3. quanto você já investiu em cada ramo, porque os nós finais exigem 7
//      pontos NO MESMO ramo e essa é a decisão real da tela.
//
// Todo o CSS vive aqui embaixo, injetado uma vez. É a única tela do jogo com
// layout de três colunas e nada mais reusa essas classes — mantê-lo junto do
// componente evita mais um arquivo global que ninguém sabe quem usa.

import {
  arvoreDaClasse, ramosDaClasse, avaliarArvore, escolherNo, resetarArvore,
  pontosTotais, pontosGastos, pontosDisponiveis, pontosNoRamo, custoDoNo,
  custoDeReset, descreverConcessao, garantirEstadoArvore,
} from "../systems/SkillTreeSystem.js";
import { descreverMarca } from "../systems/RecursoClasseSystem.js";
import {
  LIMITE_CARDS, garantirLoadout, habilidadesEquipadas, habilidadesNaReserva,
  alternarCard, moverCard,
} from "../systems/LoadoutSystem.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

const CSS_ID = "css-arvore-habilidades";
const CSS = `
.arv-topo { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;
  background:rgba(0,0,0,0.28); border:1px solid rgba(255,255,255,0.12); border-radius:10px;
  padding:10px 12px; margin-bottom:10px; position:sticky; top:0; z-index:3; backdrop-filter:blur(4px); }
.arv-pontos { font-size:1.15em; font-weight:700; }
.arv-pontos b { color:#f5a524; font-size:1.35em; }
.arv-sub { opacity:0.75; font-size:0.82em; }
.arv-reset { background:#5a2230; border:1px solid #a04456; color:#ffd9e0; border-radius:8px;
  padding:7px 12px; cursor:pointer; font-size:0.85em; }
.arv-reset:disabled { opacity:0.45; cursor:not-allowed; }
.arv-grade { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; align-items:start; }
.arv-ramo { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
  border-radius:10px; padding:8px; min-width:0; }
.arv-ramo-cab { display:flex; align-items:baseline; gap:6px; margin-bottom:2px; }
.arv-ramo-nome { font-weight:700; font-size:1.02em; }
.arv-ramo-inv { margin-left:auto; font-size:0.78em; color:#f5a524; white-space:nowrap; }
.arv-ramo-desc { font-size:0.76em; opacity:0.7; margin-bottom:8px; line-height:1.3; }
.arv-no { border:1px solid rgba(255,255,255,0.12); border-left-width:4px; border-radius:8px;
  padding:7px 9px; margin-bottom:6px; background:rgba(0,0,0,0.22); }
.arv-no.escolhido { border-left-color:#4ecb71; background:rgba(78,203,113,0.1); }
.arv-no.disponivel { border-left-color:#f5a524; background:rgba(245,165,36,0.1); cursor:pointer; }
.arv-no.disponivel:hover { background:rgba(245,165,36,0.2); }
.arv-no.bloqueado { border-left-color:rgba(255,255,255,0.15); opacity:0.55; }
.arv-no-cab { display:flex; gap:6px; align-items:baseline; }
.arv-no-nome { font-weight:600; font-size:0.92em; overflow-wrap:anywhere; }
.arv-no-custo { margin-left:auto; font-size:0.74em; white-space:nowrap; opacity:0.85;
  border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:1px 7px; }
.arv-no-desc { font-size:0.78em; opacity:0.85; line-height:1.35; margin-top:3px; overflow-wrap:anywhere; }
.arv-no-tipo { font-size:0.7em; opacity:0.62; margin-top:3px; text-transform:uppercase; letter-spacing:0.04em; }
.arv-no-trava { font-size:0.75em; color:#ff9a9a; margin-top:4px; line-height:1.3; }
.arv-no-ok { font-size:0.75em; color:#4ecb71; margin-top:4px; }
.arv-legenda { margin-top:10px; font-size:0.78em; opacity:0.72; line-height:1.45; }
@media (max-width:900px) { .arv-grade { grid-template-columns:1fr; } }

/* --- Abas: Árvore | Cards de batalha --- */
.arv-abas { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }
.arv-aba { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);
  color:inherit; border-radius:8px 8px 0 0; padding:7px 14px; cursor:pointer; font-size:0.9em; }
.arv-aba.ativa { background:rgba(245,165,36,0.18); border-color:#f5a524; font-weight:700; }
.ld-colunas { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; align-items:start; }
.ld-caixa { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
  border-radius:10px; padding:9px; min-width:0; }
.ld-caixa h3 { margin:0 0 3px; font-size:1em; }
.ld-caixa .ld-ajuda { font-size:0.76em; opacity:0.7; margin-bottom:8px; line-height:1.35; }
.ld-slot { border:1px solid rgba(255,255,255,0.12); border-left-width:4px; border-radius:8px;
  padding:7px 9px; margin-bottom:6px; background:rgba(0,0,0,0.22); display:flex; gap:8px; align-items:flex-start; }
.ld-slot.equipada { border-left-color:#4ecb71; background:rgba(78,203,113,0.1); }
.ld-slot.reserva { border-left-color:rgba(255,255,255,0.18); }
.ld-slot.vazio { border-left-color:rgba(255,255,255,0.1); opacity:0.5; font-style:italic; justify-content:center; }
.ld-corpo { flex:1; min-width:0; }
.ld-nome { font-weight:600; font-size:0.92em; overflow-wrap:anywhere; }
.ld-meta { font-size:0.74em; opacity:0.72; margin-top:2px; }
.ld-desc { font-size:0.78em; opacity:0.85; margin-top:3px; line-height:1.35; overflow-wrap:anywhere; }
.ld-bts { display:flex; flex-direction:column; gap:3px; }
.ld-bt { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:inherit;
  border-radius:6px; padding:2px 7px; cursor:pointer; font-size:0.8em; line-height:1.3; }
.ld-bt:hover { background:rgba(255,255,255,0.18); }
.ld-bt:disabled { opacity:0.3; cursor:not-allowed; }
.ld-aviso { font-size:0.8em; color:#ffcf8a; margin-top:6px; min-height:1.2em; }
@media (max-width:900px) { .ld-colunas { grid-template-columns:1fr; } }
`;

function garantirCSS() {
  if (document.getElementById(CSS_ID)) return;
  const el = document.createElement("style");
  el.id = CSS_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

const escapar = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function htmlNo(entrada) {
  const { no, estado, motivos } = entrada;
  const custo = custoDoNo(no);
  const req = no.requisito
    ? ` · exige ${Object.entries(no.requisito).map(([k, v]) => `${k} ${v}`).join(", ")}`
    : "";
  const rodape =
    estado === "escolhido" ? `<div class="arv-no-ok">✅ desbloqueado</div>`
      : estado === "disponivel" ? `<div class="arv-no-ok">▸ clique para desbloquear</div>`
        : `<div class="arv-no-trava">🔒 falta ${escapar(motivos.join(" · "))}</div>`;
  return `
    <div class="arv-no ${estado}" data-no="${no.id}" title="${escapar(no.descricao)}">
      <div class="arv-no-cab">
        <span class="arv-no-nome">${escapar(no.nome)}</span>
        <span class="arv-no-custo">${custo} pt${custo > 1 ? "s" : ""}</span>
      </div>
      <div class="arv-no-desc">${escapar(no.descricao)}</div>
      <div class="arv-no-tipo">${escapar(descreverConcessao(no))} · nível ${no.nivelRequerido}${req}</div>
      ${rodape}
    </div>`;
}

// --- Aba "Cards de batalha" -------------------------------------------------
//
// Depois da árvore nova um personagem chega a 9 habilidades ativas, e a mão
// de cards da batalha virou uma lista de nove opções — o card fica estreito
// demais para o texto caber e o turno vira leitura, não decisão. Aqui o
// jogador escolhe as 4 que viram card. Ver LoadoutSystem.js.

function metaDaHabilidade(h) {
  const partes = [];
  if (h.custoMP) partes.push(`${h.custoMP} de Éter`); else partes.push("sem custo");
  if (h.cooldown) partes.push(`recarga ${h.cooldown}`);
  if (h.elemento) partes.push(h.elemento);
  const AREA = { dano_area: "atinge todos", cura_area: "cura o time", buff_time: "reforça o time", debuff_area: "atinge todos" };
  if (AREA[h.tipo]) partes.push(AREA[h.tipo]);
  return partes.join(" · ");
}

function htmlSlotEquipado(h, i, total) {
  return `
    <div class="ld-slot equipada">
      <div class="ld-corpo">
        <div class="ld-nome">${i + 1}. ${escapar(h.nome)}</div>
        <div class="ld-meta">${escapar(metaDaHabilidade(h))}</div>
        <div class="ld-desc">${escapar(h.descricao || "")}</div>
      </div>
      <div class="ld-bts">
        <button class="ld-bt" data-mover="${escapar(h.id)}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Subir">▲</button>
        <button class="ld-bt" data-mover="${escapar(h.id)}" data-dir="1" ${i === total - 1 ? "disabled" : ""} title="Descer">▼</button>
        <button class="ld-bt" data-alternar="${escapar(h.id)}" title="Tirar da mão">✕</button>
      </div>
    </div>`;
}

function htmlSlotReserva(h, cheio) {
  return `
    <div class="ld-slot reserva">
      <div class="ld-corpo">
        <div class="ld-nome">${escapar(h.nome)}</div>
        <div class="ld-meta">${escapar(metaDaHabilidade(h))}</div>
        <div class="ld-desc">${escapar(h.descricao || "")}</div>
      </div>
      <div class="ld-bts">
        <button class="ld-bt" data-alternar="${escapar(h.id)}" ${cheio ? "disabled" : ""} title="${cheio ? "A mão já está cheia" : "Pôr na mão"}">＋</button>
      </div>
    </div>`;
}

function painelCards(personagem) {
  const equipadas = habilidadesEquipadas(personagem);
  const reserva = habilidadesNaReserva(personagem);
  const cheio = equipadas.length >= LIMITE_CARDS;
  const vazios = Math.max(0, LIMITE_CARDS - equipadas.length);
  return `
    <div class="ld-colunas">
      <div class="ld-caixa">
        <h3>🃏 Na mão — ${equipadas.length}/${LIMITE_CARDS}</h3>
        <div class="ld-ajuda">Só estas viram card na batalha, nesta ordem. A ordem também é a que o cursor do teclado percorre.</div>
        ${equipadas.map((h, i) => htmlSlotEquipado(h, i, equipadas.length)).join("")}
        ${Array.from({ length: vazios }, () => `<div class="ld-slot vazio">slot livre</div>`).join("")}
      </div>
      <div class="ld-caixa">
        <h3>📦 Guardadas — ${reserva.length}</h3>
        <div class="ld-ajuda">Continuam suas; só não entram na mão desta luta. Troque quando quiser, fora da batalha.</div>
        ${reserva.length ? reserva.map((h) => htmlSlotReserva(h, cheio)).join("") : `<div class="ld-slot vazio">nenhuma sobrando</div>`}
      </div>
    </div>
    <div class="ld-aviso"></div>
    <div class="arv-legenda">
      Quatro cards é o que cabe legível na dock em qualquer largura de tela — e ainda dá resposta
      para as quatro situações da luta: bater forte, bater em área, se proteger e curar.
    </div>`;
}

// Qual aba está aberta. Módulo-level porque a tela se redesenha inteira a
// cada clique (é o jeito mais simples de manter estado e tela em sincronia)
// e trocar de aba não pode zerar quando o jogador compra um nó.
let abaAtual = "arvore";

export function montarArvoreHabilidades(personagem, dados, onMudar, aba = null) {
  garantirCSS();
  garantirEstadoArvore(personagem);
  garantirLoadout(personagem);
  if (aba) abaAtual = aba;
  overlay().classList.remove("hidden");

  const nos = arvoreDaClasse(personagem, dados);
  const ramos = ramosDaClasse(personagem, dados);
  const avaliacao = avaliarArvore(personagem, dados);
  const porId = new Map(avaliacao.map((e) => [e.no.id, e]));

  const disponiveis = pontosDisponiveis(personagem, dados);
  const gastos = pontosGastos(personagem, dados);
  const total = pontosTotais(personagem);
  const custoReset = custoDeReset(personagem);
  const podeResetar = gastos > 0 && (personagem.ouro || 0) >= custoReset;

  const colunas = ramos.map((ramo) => {
    const doRamo = nos.filter((n) => n.ramo === ramo.id).sort((a, b) => a.tier - b.tier);
    const investido = pontosNoRamo(personagem, dados, ramo.id);
    return `
      <div class="arv-ramo">
        <div class="arv-ramo-cab">
          <span>${ramo.icone || "◆"}</span>
          <span class="arv-ramo-nome">${escapar(ramo.nome)}</span>
          <span class="arv-ramo-inv">${investido}/10 pts</span>
        </div>
        <div class="arv-ramo-desc">${escapar(ramo.descricao || "")}</div>
        ${doRamo.map((n) => htmlNo(porId.get(n.id))).join("")}
      </div>`;
  }).join("");

  const marcas = (personagem.arvore.marcas || []).map((m) => `<div>${escapar(descreverMarca(m, personagem, null, {}).replace(/ — (ATIVA|inativa).*/, ""))} — ${escapar(m.descricao)}</div>`).join("");

  const painelArvore = `
    <div class="arv-topo">
      <div>
        <div class="arv-pontos"><b>${disponiveis}</b> ponto${disponiveis === 1 ? "" : "s"} disponíve${disponiveis === 1 ? "l" : "is"}</div>
        <div class="arv-sub">${gastos} de ${total} gastos · a árvore inteira custa 30 — você nunca compra tudo</div>
      </div>
      <button class="arv-reset" ${podeResetar ? "" : "disabled"} title="${gastos ? `Custa ${custoReset} de ouro (você tem ${personagem.ouro || 0})` : "Você ainda não gastou nenhum ponto"}">
        ↺ Redistribuir · ${custoReset} ouro
      </button>
    </div>
    <div class="arv-grade">${colunas}</div>
    ${marcas ? `<div class="arv-legenda"><b>Suas marcas de classe:</b><br>${marcas}</div>` : ""}
    <div class="arv-legenda">
      Cada nível dá 1 ponto. Os nós finais de cada ramo exigem <b>7 pontos naquele mesmo ramo</b> —
      espalhar pontos pelos três ramos nunca chega ao fim de nenhum.
      Os requisitos de atributo do ramo híbrido contam equipamento: um amuleto pode abrir um nó.
    </div>`;

  const naMao = habilidadesEquipadas(personagem).length;
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Habilidades — ${escapar(personagem.classeNome)}</h2>
    <div class="arv-abas">
      <button class="arv-aba ${abaAtual === "arvore" ? "ativa" : ""}" data-aba="arvore">🌳 Árvore${disponiveis > 0 ? ` · ${disponiveis} pt` : ""}</button>
      <button class="arv-aba ${abaAtual === "cards" ? "ativa" : ""}" data-aba="cards">🃏 Cards de batalha · ${naMao}/${LIMITE_CARDS}</button>
    </div>
    ${abaAtual === "cards" ? painelCards(personagem) : painelArvore}
  `;

  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelectorAll(".arv-aba").forEach((b) => {
    b.onclick = () => montarArvoreHabilidades(personagem, dados, onMudar, b.dataset.aba);
  });

  // Aba de cards: ligar/desligar e reordenar. Um clique recusado escreve o
  // motivo em vez de simplesmente não fazer nada — "cliquei e não aconteceu"
  // é o pior retorno possível numa tela de configuração.
  const aviso = conteudo().querySelector(".ld-aviso");
  conteudo().querySelectorAll("[data-alternar]").forEach((b) => {
    b.onclick = () => {
      const r = alternarCard(personagem, b.dataset.alternar);
      if (!r.ok) { if (aviso) aviso.textContent = `⚠️ ${r.motivo}`; return; }
      onMudar();
      montarArvoreHabilidades(personagem, dados, onMudar);
    };
  });
  conteudo().querySelectorAll("[data-mover]").forEach((b) => {
    b.onclick = () => {
      if (moverCard(personagem, b.dataset.mover, Number(b.dataset.dir)).ok) {
        montarArvoreHabilidades(personagem, dados, onMudar);
      }
    };
  });

  conteudo().querySelectorAll(".arv-no.disponivel").forEach((el) => {
    el.onclick = () => {
      const r = escolherNo(personagem, dados, el.dataset.no);
      if (r.ok) onMudar();
      montarArvoreHabilidades(personagem, dados, onMudar);
    };
  });

  const btnReset = conteudo().querySelector(".arv-reset");
  if (btnReset && podeResetar) {
    btnReset.onclick = () => {
      // Confirmação em duas etapas no próprio botão: um `confirm()` nativo
      // trava a tela inteira do jogo e some no celular.
      if (btnReset.dataset.confirmando !== "1") {
        btnReset.dataset.confirmando = "1";
        btnReset.textContent = `Confirmar? Devolve ${gastos} pts por ${custoReset} ouro`;
        return;
      }
      const r = resetarArvore(personagem, dados);
      if (r.ok) onMudar();
      montarArvoreHabilidades(personagem, dados, onMudar);
    };
  }
}
