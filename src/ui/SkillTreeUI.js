// Tela da árvore de habilidades: mostra os nós já desbloqueados, a escolha
// pendente (se houver, com botões para o jogador decidir entre o ramo
// ofensivo e o ramo de suporte) e os próximos tiers ainda bloqueados.
import { escolhaPendente, aplicarEscolhaArvore } from "../systems/CharacterFactory.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

function cardNo(node, extraHTML = "") {
  const ramoLabel = node.ramo === "ofensiva" ? "⚔️ Ofensiva" : "🛡️ Suporte";
  return `
    <div class="card" style="align-items:flex-start;">
      <div class="info">
        <div class="nome">${node.nome} <span style="font-size:0.7em;opacity:0.75">(${ramoLabel})</span></div>
        <div class="desc">${node.descricao}</div>
      </div>
      <div>${extraHTML}</div>
    </div>`;
}

export function montarArvoreHabilidades(personagem, dados, onMudar) {
  overlay().classList.remove("hidden");
  const arvore = (dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  const pendente = escolhaPendente(personagem, dados);
  const classeDef = (dados.classes || []).find((c) => c.id === personagem.classeId);

  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Árvore de Habilidades — ${personagem.classeNome}</h2>
    ${classeDef && classeDef.descricao ? `<p style="opacity:0.85;font-style:italic;">${classeDef.descricao}</p>` : ""}
    <div id="modal-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  const corpo = conteudo().querySelector("#modal-corpo");

  if (pendente) {
    const bloco = document.createElement("div");
    bloco.innerHTML = `<h3 style="color:#f5a524;">🌟 Escolha disponível (Nível ${pendente.nivelRequerido})</h3><p style="font-size:0.85em;opacity:0.85">Escolha um dos dois caminhos abaixo. A escolha é permanente.</p>`;
    pendente.opcoes.forEach((node) => {
      const div = document.createElement("div");
      div.innerHTML = cardNo(node, `<button class="btn-escolha-habilidade primario" data-node-id="${node.id}">Escolher</button>`);
      bloco.appendChild(div);
    });
    corpo.appendChild(bloco);
    corpo.querySelectorAll(".btn-escolha-habilidade").forEach((b) => {
      b.onclick = () => {
        const r = aplicarEscolhaArvore(personagem, dados, b.dataset.nodeId);
        if (r.ok) onMudar();
        montarArvoreHabilidades(personagem, dados, onMudar);
      };
    });
  }

  const tiers = [...new Set(arvore.map((n) => n.tier))].sort((a, b) => a - b);
  if (tiers.length) {
    const h = document.createElement("h3");
    h.textContent = "Progresso";
    corpo.appendChild(h);
  }
  tiers.forEach((tier) => {
    const opcoes = arvore.filter((n) => n.tier === tier);
    const escolhido = opcoes.find((n) => escolhas.includes(n.id));
    const nivelRequerido = opcoes[0].nivelRequerido;
    const div = document.createElement("div");
    if (escolhido) {
      div.innerHTML = cardNo(escolhido, `<span style="color:#4ecb71;font-size:0.8em;">✅ Desbloqueado</span>`);
    } else if (personagem.nivel >= nivelRequerido) {
      // já coberto pelo bloco de escolha pendente acima
      return;
    } else {
      div.innerHTML = `<div class="card" style="opacity:0.55;"><div class="info"><div class="nome">🔒 Tier ${tier}</div>
        <div class="desc">Disponível no nível ${nivelRequerido}: ${opcoes.map((o) => o.nome).join(" ou ")}</div></div></div>`;
    }
    corpo.appendChild(div);
  });

  if (!arvore.length) {
    corpo.innerHTML += "<p>Esta classe ainda não possui árvore de habilidades.</p>";
  }
}
