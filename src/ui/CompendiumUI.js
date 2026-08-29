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

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

const BIOMA_LABEL = { floresta: "Floresta", estrada: "Estrada", masmorra: "Masmorra", deserto: "Deserto", aguas: "Águas" };
const ELEMENTO_LABEL = { fogo: "Fogo", agua: "Água", gelo: "Gelo", natureza: "Natureza", sombrio: "Sombrio", radiante: "Radiante", vento: "Vento", terra: "Terra", raio: "Raio", arcano: "Arcano", veneno: "Veneno" };

export function montarCompendio(personagem, dados, abaInicial = "bestiario") {
  overlay().classList.remove("hidden");
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Compêndio</h2>
    <div id="compendio-tabs" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <button data-tab="bestiario">Bestiário</button>
      <button data-tab="missoes">Missões</button>
      <button data-tab="invocacoes">Invocações</button>
      <button data-tab="faccoes">Facções</button>
      <button data-tab="mitologia">📖 Mitologia</button>
    </div>
    <div id="compendio-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelectorAll("#compendio-tabs button").forEach((b) => {
    b.onclick = () => montarCompendio(personagem, dados, b.dataset.tab);
  });

  const corpo = conteudo().querySelector("#compendio-corpo");
  if (abaInicial === "missoes") renderMissoes(corpo, personagem, dados);
  else if (abaInicial === "invocacoes") renderInvocacoes(corpo, personagem, dados);
  else if (abaInicial === "faccoes") renderFaccoes(corpo, personagem, dados);
  else if (abaInicial === "mitologia") renderMitologia(corpo, personagem, dados);
  else renderBestiario(corpo, personagem, dados);
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

function renderBestiario(corpo, personagem, dados) {
  const bestiario = bestiarioParaCompendio(personagem, dados);
  const progresso = progressoBestiario(personagem, dados);

  corpo.innerHTML = `
    <p>Descobertos: ${progresso.descobertos}/${progresso.total} (${progresso.percentual}%). Derrote um monstro pela primeira vez para revelar sua entrada — a fraqueza elemental exata só aparece depois de mais abates do mesmo tipo.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  bestiario.forEach((m) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:190px;align-items:flex-start;${m.chefe ? "border-color:#f5a524;" : ""}${!m.descoberto ? "opacity:0.55;" : ""}`;
    if (m.descoberto) {
      // Fraqueza elemental progressiva (melhoria pós-backlog original): só
      // aparece depois de ABATES_PARA_REVELAR_FRAQUEZA abates — antes disso,
      // mostra quantos faltam em vez do elemento exato, pra dar um motivo a
      // mais pra caçar o mesmo monstro de novo.
      let fraquezaHTML;
      if (m.fraquezaRevelada) {
        const nomes = (m.fraquezas || []).map((elId) => {
          const info = infoElemento(elId, dados.elements);
          return info ? `${info.icone} ${info.nome}` : elId;
        });
        fraquezaHTML = nomes.length ? `Fraqueza: ${nomes.join(", ")}` : "Fraqueza: nenhuma conhecida";
      } else {
        fraquezaHTML = `Fraqueza: ??? (mais ${m.abatesFaltandoFraqueza} abate${m.abatesFaltandoFraqueza === 1 ? "" : "s"} para revelar)`;
      }
      div.innerHTML = `
        <div class="nome">${m.nome}${m.chefe ? " 👑" : ""}</div>
        <div class="desc">Nv. ${m.nivel} · ${(m.bioma || []).map((b) => BIOMA_LABEL[b] || b).join(", ")}${m.elemento ? ` · ${ELEMENTO_LABEL[m.elemento] || m.elemento}` : ""}</div>
        <div class="desc" style="margin-top:4px;">Abates: ${m.abates}</div>
        <div class="desc" style="margin-top:4px;">${fraquezaHTML}</div>
        <div class="desc" style="margin-top:6px;font-style:italic;">${m.lore}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="nome">???</div>
        <div class="desc" style="margin-top:4px;font-style:italic;">${m.teaser}</div>
      `;
    }
    grid.appendChild(div);
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
