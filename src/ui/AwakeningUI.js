// Tela de Despertar de Arma Secreta: mostra o momento narrativo e aplica o
// bônus permanente de um personagem do gacha que já atingiu o nível exigido.
// Reaproveita o padrão visual das outras telas de modal (overlay único,
// cards com borda colorida por raridade — ver GachaUI.js/SkillTreeUI.js).
import { podeDespertar, despertar, definicaoDespertar } from "../systems/AwakeningSystem.js";
import { RARITY_COLORS, RARITY_LABEL } from "../systems/InventorySystem.js";
import { concederPontoHeranca } from "../systems/TalentSystem.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

// Chamado pelas telas de coleção (GachaUI.js) pra indicar, num card, se o
// personagem já pode despertar ou já despertou — usado tanto na renderização
// da coleção quanto em qualquer outro lugar que liste personagens do gacha.
export function estadoDespertarResumo(instancia, roster) {
  if (instancia.desperto) return { texto: "✨ Despertado", classe: "despertar-feito" };
  const def = definicaoDespertar(instancia, roster);
  if (!def) return null;
  if (podeDespertar(instancia, roster)) return { texto: "🌟 Despertar disponível!", classe: "despertar-disponivel" };
  return { texto: `🔒 Despertar no Nv. ${def.nivelRequerido}`, classe: "despertar-bloqueado" };
}

// `aoVoltar` é um callback sem argumentos que devolve o jogador pra tela que
// chamou (normalmente a aba Coleção do GachaUI) — mantém a navegação simples
// sem empilhar modais, já que só existe um overlay compartilhado no jogo.
export function montarDespertar(personagem, dados, uid, onMudar, aoVoltar) {
  const roster = dados.gachaRoster;
  const g = personagem.gacha;
  const instancia = g.personagensObtidos.find((p) => p.uid === uid);

  overlay().classList.remove("hidden");
  if (!instancia) {
    conteudo().innerHTML = `<button class="fechar">Fechar (Esc)</button><p>Personagem não encontrado.</p>`;
    conteudo().querySelector(".fechar").onclick = fecharModalLocal;
    return;
  }

  const def = definicaoDespertar(instancia, roster);
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <button class="btn-voltar-despertar" style="margin-bottom:8px;">← Voltar à Coleção</button>
    <h2>Despertar de Arma Secreta</h2>
    <div id="despertar-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelector(".btn-voltar-despertar").onclick = () => (aoVoltar ? aoVoltar() : fecharModalLocal());

  const corpo = conteudo().querySelector("#despertar-corpo");

  if (!def) {
    corpo.innerHTML = `<p>${instancia.nome} ainda não possui um Despertar de Arma Secreta definido.</p>`;
    return;
  }

  const badge = `<span class="raridade-badge" style="background:${RARITY_COLORS[instancia.raridade]}">${RARITY_LABEL[instancia.raridade]}</span>`;

  if (instancia.desperto) {
    corpo.innerHTML = `
      <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
        <div class="nome">${instancia.nome} ${badge} — ✨ ${def.nomeArma}</div>
        <div class="desc" style="margin-top:6px;font-style:italic;">${def.narrativa}</div>
        <div class="desc" style="margin-top:10px;color:#4ecb71;">Este personagem já despertou. Os bônus abaixo são permanentes:</div>
        <ul style="margin:6px 0 0 18px;font-size:0.85em;color:#c8b89a;">
          ${Object.entries(def.bonusAtributos).map(([attr, v]) => `<li>+${v} ${attr}</li>`).join("")}
          <li>+${Math.round(def.bonusHabilidadeMultiplicador * 100)}% de força na habilidade "${instancia.habilidades[0]?.nome || ""}"</li>
        </ul>
      </div>
    `;
    return;
  }

  const elegivel = podeDespertar(instancia, roster);
  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
      <div class="nome">${instancia.nome} ${badge} — Nv. ${instancia.nivel}</div>
      <div class="desc" style="margin-top:4px;">Arma Secreta: <strong>${def.nomeArma}</strong> (desperta no Nv. ${def.nivelRequerido})</div>
      ${elegivel
        ? `<div class="desc" style="margin-top:8px;font-style:italic;">${def.narrativa}</div>`
        : `<div class="desc" style="margin-top:8px;opacity:0.7;">Continue desenvolvendo ${instancia.nome} em batalha. Faltam ${Math.max(0, def.nivelRequerido - instancia.nivel)} nível(is) para o Despertar.</div>`}
      <div class="desc" style="margin-top:10px;">Ao despertar, ${instancia.nome} ganha permanentemente:</div>
      <ul style="margin:6px 0 0 18px;font-size:0.85em;color:#c8b89a;">
        ${Object.entries(def.bonusAtributos).map(([attr, v]) => `<li>+${v} ${attr}</li>`).join("")}
        <li>+${Math.round(def.bonusHabilidadeMultiplicador * 100)}% de força na habilidade "${instancia.habilidades[0]?.nome || ""}"</li>
      </ul>
      <button class="btn-despertar" style="margin-top:12px;" ${elegivel ? "" : "disabled"}>${elegivel ? "✨ Despertar Arma Secreta" : "Ainda não disponível"}</button>
    </div>
  `;

  const btn = corpo.querySelector(".btn-despertar");
  if (elegivel) {
    btn.onclick = () => {
      const r = despertar(instancia, roster, dados);
      if (r.ok) {
        // Caminhos do Herdeiro (task #92): o Despertar de um convocado
        // também concede 1 ponto de Herança pro personagem PRINCIPAL — é
        // um evento narrativo de peso do elenco real do jogo, exatamente
        // como o usuário pediu ("usar o elenco real" em vez de personagens
        // inventados). `despertar()` já marca instancia.desperto=true, então
        // isso só roda uma vez por convocado, nunca de novo pro mesmo.
        concederPontoHeranca(personagem, { tipo: "arma_secreta_despertada", rosterId: instancia.rosterId, nome: instancia.nome });
        onMudar();
        montarDespertar(personagem, dados, uid, onMudar, aoVoltar);
      }
    };
  }
}
