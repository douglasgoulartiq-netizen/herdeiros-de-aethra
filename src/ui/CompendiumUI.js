// Tela do Compêndio: bestiário (com registro de abates), lista de missões,
// histórico de invocações (task #37) e facções regionais (task #44). As
// primeiras três abas só leem dados de outros sistemas; a aba Facções é a
// única que altera estado do jogo (afiliação é uma escolha do jogador).
import {
  bestiarioParaCompendio, progressoBestiario, missoesParaCompendio, historicoInvocacoes,
} from "../systems/CompendiumSystem.js";
import { RARITY_COLORS, RARITY_LABEL } from "../systems/InventorySystem.js";
import { getReputacao, tierDaReputacao, facaoAfiliada, afiliarFaccao, registrarDecisao } from "../systems/WorldStateSystem.js";
import { infoElemento } from "../systems/ElementSystem.js";
import { capitulosParaCompendio, progressoMitologia } from "../systems/MythologySystem.js";

import { abrirTela, LARGURA, criarGrade, abrirSheet } from "./HdaUI.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

const BIOMA_LABEL = { floresta: "Floresta", estrada: "Estrada", masmorra: "Masmorra", deserto: "Deserto", aguas: "Águas" };
const ELEMENTO_LABEL = { fogo: "Fogo", agua: "Água", gelo: "Gelo", natureza: "Natureza", sombrio: "Sombrio", radiante: "Radiante", vento: "Vento", terra: "Terra", raio: "Raio", arcano: "Arcano", veneno: "Veneno" };

export function montarCompendio(personagem, dados, abaInicial = "bestiario") {
  const tela = abrirTela({
    titulo: "Compêndio",
    largura: LARGURA.larga,
    classe: "tela-compendio",
  });
  tela.definirAbas([
    { id: "bestiario", rotulo: "Bestiário", icone: "🐉" },
    { id: "missoes", rotulo: "Missões", icone: "📜" },
    { id: "invocacoes", rotulo: "Invocações", icone: "✨" },
    { id: "faccoes", rotulo: "Facções", icone: "🏳️" },
    { id: "mitologia", rotulo: "Mitologia", icone: "📖" },
  ], (id) => montarCompendio(personagem, dados, id), abaInicial);

  const corpo = tela.corpo;
  corpo.id = "compendio-corpo";
  if (abaInicial === "missoes") renderMissoes(corpo, personagem, dados);
  else if (abaInicial === "invocacoes") renderInvocacoes(corpo, personagem, dados);
  else if (abaInicial === "faccoes") renderFaccoes(corpo, personagem, dados);
  else if (abaInicial === "mitologia") renderMitologia(corpo, personagem, dados);
  else renderBestiario(corpo, personagem, dados, tela);
}

// Códice da Mitologia (pedido: integrar o livro de mitologia como conteúdo
// desbloqueável, opção "Códice desbloqueável" — aditivo, sem tocar em
// facções/itens/missões já existentes). Capítulos ficam bloqueados até o
// personagem cumprir a condição de progressão (ver mythologyCodex.js).
function renderMitologia(corpo, personagem, dados) {
  const capitulos = capitulosParaCompendio(personagem);
  const progresso = progressoMitologia(personagem);

  corpo.innerHTML = `
    <p>Capítulos descobertos: ${progresso.desbloqueados}/${progresso.total} (${progresso.percentual}%). O Códice se revela conforme você progride — nível, exploração, missões e abates.</p>
    <div style="display:flex;flex-direction:column;gap:8px;"></div>
  `;
  const lista = corpo.lastElementChild;
  capitulos.forEach((cap) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = "flex-direction:column;align-items:flex-start;width:100%;";
    if (cap.desbloqueado) {
      const epigrafeHTML = cap.epigrafe ? `<p style="font-style:italic;opacity:0.85;margin:6px 0;">${cap.epigrafe}</p>` : "";
      const corpoHTML = cap.paragrafos.map((p) => `<p style="margin:6px 0;">${p}</p>`).join("");
      div.innerHTML = `<div class="nome">${cap.titulo}</div>${epigrafeHTML}<div class="desc">${corpoHTML}</div>`;
    } else {
      div.style.opacity = "0.55";
      div.innerHTML = `<div class="nome">🔒 ???</div><div class="desc" style="font-style:italic;">${cap.condicaoDescricao}</div>`;
    }
    lista.appendChild(div);
  });
}

// Bestiário (itens 28 e 29).
//
// Antes: uma fileira de cards de 190px com a FICHA INTEIRA dentro de cada um
// (nível, bioma, elemento, abates, fraqueza e lore). Com 40 monstros isso
// dava 8179px de rolagem num modal de 658px — a lista virava um paredão e
// não havia como comparar duas criaturas.
//
// Agora: grade de ladrilhos (nome, nível, elemento, estado de descoberta) e
// a FICHA COMPLETA no painel contextual — lateral no desktop, bottom sheet
// no celular. Exatamente o "lista/grid + criatura selecionada + ficha" do
// item 28, sem tentar espremer as três coisas lado a lado no celular.
function renderBestiario(corpo, personagem, dados, tela) {
  const bestiario = bestiarioParaCompendio(personagem, dados);
  const progresso = progressoBestiario(personagem, dados);

  const cabecalho = document.createElement("p");
  cabecalho.className = "desc";
  cabecalho.innerHTML = `Descobertos: <b>${progresso.descobertos}/${progresso.total}</b> (${progresso.percentual}%). Derrote um monstro pela primeira vez para revelar sua entrada — a fraqueza elemental exata só aparece depois de mais abates do mesmo tipo.`;
  corpo.appendChild(cabecalho);

  const grade = criarGrade({ densidade: "densa" });
  corpo.appendChild(grade);

  bestiario.forEach((m, i) => {
    const el = document.createElement("div");
    el.className = "hda-ladrilho" + (m.chefe ? " chefe" : "") + (m.descoberto ? "" : " desconhecido");
    el.dataset.uid = String(i);
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    const info = m.descoberto && m.elemento ? infoElemento(m.elemento, dados.elements) : null;
    el.innerHTML = m.descoberto
      ? `<span class="hda-ladrilho-icone icon-frame" style="border-color:${m.chefe ? "#f5a524" : "#4a3a26"}">${info ? info.icone : "👾"}</span>
         <span class="hda-ladrilho-nome hda-clamp-2">${m.nome}${m.chefe ? " 👑" : ""}</span>
         <span class="hda-ladrilho-rar">Nv. ${m.nivel}${info ? ` · ${info.nome}` : ""}</span>
         ${m.abates ? `<span class="hda-ladrilho-qtd">${m.abates}</span>` : ""}`
      : `<span class="hda-ladrilho-icone icon-frame">❓</span>
         <span class="hda-ladrilho-nome hda-clamp-2">???</span>
         <span class="hda-ladrilho-rar">não descoberto</span>`;
    const abrir = () => {
      grade.querySelectorAll(".hda-ladrilho").forEach((x) => x.classList.toggle("selecionado", x === el));
      abrirFichaMonstro(m, dados);
    };
    el.onclick = abrir;
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
    grade.appendChild(el);
  });

  if (tela) tela.definirAcoes([], `${progresso.descobertos} de ${progresso.total} criaturas registradas`);
}

// Ficha completa da criatura — o "nível 3" da informação progressiva.
function abrirFichaMonstro(m, dados) {
  if (!m.descoberto) {
    abrirSheet({ titulo: "Criatura desconhecida", corpoHTML: `<p class="desc" style="font-style:italic;">${m.teaser}</p><p class="desc">Derrote esta criatura uma vez para revelar a entrada.</p>` });
    return;
  }
  let fraquezaHTML;
  if (m.fraquezaRevelada) {
    const nomes = (m.fraquezas || []).map((elId) => {
      const info = infoElemento(elId, dados.elements);
      return info ? `${info.icone} ${info.nome}` : elId;
    });
    fraquezaHTML = nomes.length ? nomes.join(", ") : "nenhuma conhecida";
  } else {
    fraquezaHTML = `??? (mais ${m.abatesFaltandoFraqueza} abate${m.abatesFaltandoFraqueza === 1 ? "" : "s"} para revelar)`;
  }
  const info = m.elemento ? infoElemento(m.elemento, dados.elements) : null;
  abrirSheet({
    titulo: `${m.nome}${m.chefe ? " 👑" : ""}`,
    corpoHTML: `
      <dl class="hda-ficha">
        <div><dt>Nível</dt><dd>${m.nivel}</dd></div>
        <div><dt>Elemento</dt><dd>${info ? `${info.icone} ${info.nome}` : "—"}</dd></div>
        <div><dt>Biomas</dt><dd>${(m.bioma || []).map((b) => BIOMA_LABEL[b] || b).join(", ") || "—"}</dd></div>
        <div><dt>Abates</dt><dd>${m.abates}</dd></div>
        <div><dt>Fraqueza</dt><dd>${fraquezaHTML}</dd></div>
      </dl>
      <p class="desc" style="font-style:italic;">${m.lore}</p>`,
  });
}

function renderMissoes(corpo, personagem, dados) {
  const missoes = missoesParaCompendio(personagem, dados);
  const concluidas = missoes.filter((q) => q.concluida).length;

  corpo.innerHTML = `
    <p>Concluídas: ${concluidas}/${missoes.length}.</p>
    <div style="display:flex;flex-direction:column;gap:6px;"></div>
  `;
  const lista = corpo.lastElementChild;
  missoes.forEach((q) => {
    const status = q.concluida ? "✅ Concluída" : q.ativa ? "🕒 Em andamento" : "🔒 Não iniciada";
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `align-items:flex-start;${q.concluida ? "" : "opacity:0.75;"}`;
    div.innerHTML = `
      <div class="info">
        <div class="nome">${q.nome} <span style="font-size:0.75em;opacity:0.85">— ${status}</span></div>
        <div class="desc">${q.descricao}</div>
        <div class="desc" style="margin-top:2px;">Recompensa: ${q.recompensaOuro} ouro, ${q.recompensaXP} XP${q.recompensaFragmentos ? `, ${q.recompensaFragmentos} Fragmentos` : ""}</div>
      </div>
    `;
    lista.appendChild(div);
  });
}

function renderInvocacoes(corpo, personagem, dados) {
  const historico = historicoInvocacoes(personagem);
  const BANNER_LABEL = { permanente: "Permanente", evento: "Evento", iniciante: "Iniciante" };

  if (!historico.length) {
    corpo.innerHTML = "<p>Nenhuma invocação registrada ainda. Vá até a tela de Time (G) para invocar.</p>";
    return;
  }

  corpo.innerHTML = `<p>Últimas ${historico.length} invocações (mais recente primeiro):</p><div style="display:flex;flex-direction:column;gap:4px;"></div>`;
  const lista = corpo.lastElementChild;
  historico.forEach((h) => {
    const data = new Date(h.data);
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `align-items:center;border-color:${RARITY_COLORS[h.raridade] || "#4a3a26"};padding:6px 10px;`;
    div.innerHTML = `
      <div class="info" style="display:flex;align-items:center;gap:8px;">
        <span class="raridade-badge" style="background:${RARITY_COLORS[h.raridade]}">${RARITY_LABEL[h.raridade] || h.raridade}</span>
        <span class="nome">${h.nome}${h.featured ? " ⭐" : ""}${h.duplicata ? " (duplicata)" : ""}</span>
        <span class="desc">Banner ${BANNER_LABEL[h.banner] || h.banner} — ${data.toLocaleDateString()} ${data.toLocaleTimeString()}</span>
      </div>
    `;
    lista.appendChild(div);
  });
}

// Facções regionais (task #44): reputação de cada facção (numérica, sobe
// derrotando chefes na região dela e por ações que ainda vierem a afetá-la)
// + afiliação (escolha pessoal do jogador, ver WorldStateSystem.js). "Vila"
// fica de fora daqui — ela já tem tela própria de reputação implícita nos
// preços da loja/diálogo, e não é uma das 10 facções regionais afiliáveis.
function renderFaccoes(corpo, personagem, dados) {
  const facoes = (dados.worldStateVariables.facoes || []).filter((f) => f.id !== "vila");
  const afiliacaoAtual = facaoAfiliada(personagem);

  corpo.innerHTML = `
    <p>Cada região do mundo tem seu próprio povo. Afilie-se a uma facção — convocados do gacha originários dela lutam com mais força ao seu lado (camaradagem regional). Derrotar chefes no território de uma facção sobe sua reputação com ela.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  facoes.forEach((f) => {
    const rep = getReputacao(personagem, f.id);
    const tier = tierDaReputacao(rep, dados.worldStateVariables);
    const afiliado = afiliacaoAtual === f.id;
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:220px;align-items:flex-start;${afiliado ? "border-color:#f5a524;box-shadow:0 0 0 2px #f5a524;" : ""}`;
    div.innerHTML = `
      <div class="nome">${f.icone || ""} ${f.nome}${afiliado ? " ⭐ Afiliado" : ""}</div>
      <div class="desc" style="margin-top:4px;">${f.descricao}</div>
      <div class="desc" style="margin-top:6px;">Reputação: ${rep}${tier ? ` (${tier.nome})` : ""}</div>
      <button class="btn-afiliar" style="margin-top:8px;" ${afiliado ? "disabled" : ""}>${afiliado ? "Facção atual" : "Afiliar-se"}</button>
    `;
    div.querySelector(".btn-afiliar").onclick = () => {
      afiliarFaccao(personagem, f.id);
      registrarDecisao(personagem, { icone: f.icone || "🤝", titulo: `Afiliação: ${f.nome}`, texto: `Você declarou lealdade a ${f.nome}.` });
      montarCompendio(personagem, dados, "faccoes");
    };
    grid.appendChild(div);
  });
}
