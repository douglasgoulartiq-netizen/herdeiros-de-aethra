// Diário de Decisões (melhoria pós-backlog): tela que reúne as escolhas
// narrativas importantes já feitas (vínculo, eventos de exploração, testes
// de perícia com NPCs, chefes derrotados, facção escolhida) e a
// consequência que elas ainda têm HOJE (reputação atual por facção) — ver
// WorldStateSystem.js: registrarDecisao/decisoesRegistradas/
// reputacoesParaExibir. Reaproveita o modal padrão (abrirModalBase), igual
// a toda outra tela secundária do jogo.
import { abrirModalBase } from "./GameUI.js";
import { decisoesRegistradas, reputacoesParaExibir, facaoAfiliada, facaoInfo } from "../systems/WorldStateSystem.js";

export function montarDiarioDeDecisoes(personagem, dados) {
  const corpo = abrirModalBase("📖 Diário de Decisões");

  const afiliacaoId = facaoAfiliada(personagem);
  if (afiliacaoId) {
    const f = facaoInfo(afiliacaoId, dados.worldStateVariables);
    const p = document.createElement("p");
    p.innerHTML = `<b>Afiliação atual:</b> ${f ? `${f.icone || ""} ${f.nome}` : afiliacaoId}`;
    corpo.appendChild(p);
  }

  const tituloRep = document.createElement("h3");
  tituloRep.textContent = "Reputação com o mundo";
  corpo.appendChild(tituloRep);

  const reputacoes = reputacoesParaExibir(personagem, dados.worldStateVariables);
  if (!reputacoes.length) {
    const vazio = document.createElement("p");
    vazio.style.opacity = "0.7";
    vazio.textContent = "Suas ações ainda não deixaram marca em nenhuma facção.";
    corpo.appendChild(vazio);
  } else {
    const listaRep = document.createElement("div");
    listaRep.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;";
    reputacoes.forEach((r) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cssText = "flex-direction:column;align-items:flex-start;min-width:160px;";
      card.innerHTML = `<div class="nome">${r.icone} ${r.nome}</div><div class="desc">Reputação: ${r.valor > 0 ? "+" : ""}${r.valor}${r.tier ? ` (${r.tier.nome})` : ""}</div>`;
      listaRep.appendChild(card);
    });
    corpo.appendChild(listaRep);
  }

  const tituloDecisoes = document.createElement("h3");
  tituloDecisoes.textContent = "Momentos vividos";
  corpo.appendChild(tituloDecisoes);

  const decisoes = decisoesRegistradas(personagem);
  if (!decisoes.length) {
    const vazio = document.createElement("p");
    vazio.style.opacity = "0.7";
    vazio.textContent = "Nenhuma decisão marcante registrada ainda — explore o mundo, converse com NPCs e viva cenas de vínculo com seu time.";
    corpo.appendChild(vazio);
    return;
  }

  const lista = document.createElement("div");
  lista.style.cssText = "display:flex;flex-direction:column;gap:8px;";
  decisoes.forEach((d) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "flex-direction:column;align-items:flex-start;";
    card.innerHTML = `<div class="nome">${d.icone} ${d.titulo}</div><div class="desc">${d.texto}</div>`;
    lista.appendChild(card);
  });
  corpo.appendChild(lista);
}
