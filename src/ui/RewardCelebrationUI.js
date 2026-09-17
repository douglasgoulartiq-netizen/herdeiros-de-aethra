import { caminhoDoIcone } from "../data/itemIcons.js";
import { RARITY_LABEL } from "../systems/InventorySystem.js";
import { somTesouro } from "./SoundFX.js";

let atual = null;

export function celebrarRecompensa({ titulo = "Tesouro conquistado", itens = [], ouro = 0, fragmentos = 0, abencoado = false } = {}) {
  if (typeof document === "undefined") return;
  if (atual) atual.remove();
  const melhor = itens.reduce((acc, item) => {
    const ordem = { comum: 0, incomum: 1, raro: 2, epico: 3, lendario: 4 };
    return !acc || (ordem[item.raridade] || 0) > (ordem[acc.raridade] || 0) ? item : acc;
  }, null);
  const el = document.createElement("section");
  el.className = `recompensa-vitoria rar-${melhor?.raridade || "comum"}`;
  el.setAttribute("role", "status");
  el.innerHTML = `
    <div class="recompensa-raios" aria-hidden="true"></div>
    <div class="recompensa-painel">
      <div class="recompensa-selo">${abencoado ? "✦ FORTUNA ✦" : "✦ DESCOBERTA ✦"}</div>
      <h2>${titulo}</h2>
      <div class="recompensa-itens">${itens.map((item) => `
        <div class="recompensa-item rar-${item.raridade || "comum"}">
          <img src="${caminhoDoIcone(item)}" alt="" />
          <span><b>${item.nome}</b><small>${RARITY_LABEL[item.raridade] || item.raridade || "Item"}</small></span>
        </div>`).join("")}</div>
      <div class="recompensa-extras">${ouro ? `<span>🪙 +${ouro} ouro</span>` : ""}${fragmentos ? `<span>✧ +${fragmentos} Fragmentos</span>` : ""}</div>
      <small class="recompensa-fechar">Clique para continuar</small>
    </div>`;
  const fechar = () => { if (atual === el) atual = null; el.classList.add("saindo"); setTimeout(() => el.remove(), 260); };
  el.onclick = fechar;
  document.body.appendChild(el);
  atual = el;
  somTesouro(melhor?.raridade || (abencoado ? "epico" : "comum"));
  setTimeout(fechar, 4300);
}
