// Tela de Vínculo de Campanheirismo: mostra a cena narrativa disponível de
// um convocado do gacha (ou o histórico de escolhas já feitas) e aplica a
// escolha de tom. Reaproveita o padrão visual das outras telas de modal —
// mesmo espírito de AwakeningUI.js (Despertar de Arma Secreta).
import {
  LIMIARES_VINCULO, garantirVinculo, cenaVinculo, escolherTomVinculo, resumoVinculoParaCard,
} from "../systems/BondSystem.js";
import { calcularHpMax, calcularMpMax } from "../systems/CharacterFactory.js";
import { RARITY_COLORS, RARITY_LABEL } from "../systems/InventorySystem.js";
import { registrarDecisao } from "../systems/WorldStateSystem.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

export { resumoVinculoParaCard };

// `aoVoltar` funciona igual ao de montarDespertar: devolve o jogador pra
// tela que chamou (normalmente a aba Coleção do GachaUI), sem empilhar
// modais.
export function montarVinculo(personagem, dados, uid, onMudar, aoVoltar) {
  const g = personagem.gacha;
  const instancia = g.personagensObtidos.find((p) => p.uid === uid);

  overlay().classList.remove("hidden");
  if (!instancia) {
    conteudo().innerHTML = `<button class="fechar">Fechar (Esc)</button><p>Personagem não encontrado.</p>`;
    conteudo().querySelector(".fechar").onclick = fecharModalLocal;
    return;
  }

  const vinculo = garantirVinculo(instancia);
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <button class="btn-voltar-vinculo" style="margin-bottom:8px;">← Voltar à Coleção</button>
    <h2>Vínculo de Campanheirismo</h2>
    <div id="vinculo-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  conteudo().querySelector(".btn-voltar-vinculo").onclick = () => (aoVoltar ? aoVoltar() : fecharModalLocal());

  const corpo = conteudo().querySelector("#vinculo-corpo");
  const badge = `<span class="raridade-badge" style="background:${RARITY_COLORS[instancia.raridade]}">${RARITY_LABEL[instancia.raridade]}</span>`;

  const cena = cenaVinculo(instancia, personagem);
  const progresso = `${Math.min(vinculo.tier, LIMIARES_VINCULO.length)}/${LIMIARES_VINCULO.length} cenas vistas`;

  if (!cena) {
    // Sem cena disponível agora: mostra progresso + histórico de escolhas
    // já feitas (puro flavor — os dois tons davam o mesmo bônus mecânico).
    const faltamTudo = vinculo.tier >= LIMIARES_VINCULO.length;
    const proximoNivel = !faltamTudo ? LIMIARES_VINCULO[vinculo.tier] : null;
    corpo.innerHTML = `
      <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
        <div class="nome">${instancia.nome} ${badge} — Nv. ${instancia.nivel}</div>
        <div class="desc" style="margin-top:6px;">${progresso}</div>
        ${faltamTudo
          ? `<div class="desc" style="margin-top:8px;color:#4ecb71;">Vínculo completo — vocês já dividiram tudo que havia pra dividir por enquanto.</div>`
          : `<div class="desc" style="margin-top:8px;opacity:0.7;">Continue levando ${instancia.nome} em batalha. A próxima cena libera no Nv. ${proximoNivel} (faltam ${Math.max(0, proximoNivel - instancia.nivel)} nível(is)).</div>`}
        ${vinculo.escolhas.length ? `
          <div class="desc" style="margin-top:10px;">Momentos já vividos:</div>
          <ul style="margin:6px 0 0 18px;font-size:0.85em;color:#c8b89a;">
            ${vinculo.escolhas.map((e) => `<li>Cena ${e.tier + 1}: tom ${e.tom === "caloroso" ? "caloroso 💛" : "reservado 🩶"}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
    `;
    return;
  }

  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
      <div class="nome">${instancia.nome} ${badge} — Nv. ${instancia.nivel}</div>
      <div class="desc" style="margin-top:4px;">${progresso}</div>
      <div class="desc" style="margin-top:10px;font-weight:bold;">${cena.titulo}</div>
      <div class="desc" style="margin-top:6px;font-style:italic;">${cena.texto}</div>
      <div id="vinculo-escolhas" style="display:flex;flex-direction:column;gap:6px;margin-top:12px;width:100%;"></div>
    </div>
  `;
  const escolhasEl = corpo.querySelector("#vinculo-escolhas");
  cena.escolhas.forEach((e) => {
    const btn = document.createElement("button");
    btn.textContent = e.rotulo;
    btn.onclick = () => {
      const r = escolherTomVinculo(instancia, e.id);
      if (!r.ok) return;
      registrarDecisao(personagem, { icone: "💛", titulo: `Vínculo com ${instancia.nome}`, texto: `${cena.titulo}: ${e.resposta}` });
      // Recalcula hp/mpMax se o tier concluído trouxe hpMaxPercent/
      // mpMaxPercent (só o 3º tier tem, ver BONUS_POR_TIER em
      // BondSystem.js) — mesmo padrão de aplicarEscolhaArvore/despertar,
      // que fazem esse recálculo explícito depois de mudar o bônus
      // permanente, já que hp/mpMax não são recalculados sozinhos.
      if (r.bonus.hpMaxPercent || r.bonus.mpMaxPercent) {
        const hpAntigo = instancia.hpMax;
        const mpAntigo = instancia.mpMax;
        instancia.hpMax = calcularHpMax(instancia, dados);
        instancia.mpMax = calcularMpMax(instancia, dados);
        instancia.hp = Math.min(instancia.hpMax, instancia.hp + (instancia.hpMax - hpAntigo));
        instancia.mp = Math.min(instancia.mpMax, instancia.mp + (instancia.mpMax - mpAntigo));
      }
      corpo.innerHTML = `
        <div class="card" style="flex-direction:column;align-items:flex-start;border-color:${RARITY_COLORS[instancia.raridade]}">
          <div class="nome">${instancia.nome} ${badge}</div>
          <div class="desc" style="margin-top:8px;font-style:italic;">${e.resposta}</div>
          <button class="btn-continuar-vinculo" style="margin-top:12px;">Continuar</button>
        </div>
      `;
      corpo.querySelector(".btn-continuar-vinculo").onclick = () => {
        onMudar();
        montarVinculo(personagem, dados, uid, onMudar, aoVoltar);
      };
    };
    escolhasEl.appendChild(btn);
  });
}
