import { caminhoDoIcone } from "../data/itemIcons.js";
import { RARITY_LABEL } from "../systems/InventorySystem.js";
import { somTesouro } from "./SoundFX.js";

let atual = null;
let sequencia = 0;

export function celebrarRecompensa({ titulo = "Tesouro conquistado", itens = [], ouro = 0, fragmentos = 0, abencoado = false } = {}) {
  if (typeof document === "undefined") return;
  const focoAnterior = atual?.focoAnterior || document.activeElement;
  if (atual) atual.descartar();
  const melhor = itens.reduce((acc, item) => {
    const ordem = { comum: 0, incomum: 1, raro: 2, epico: 3, lendario: 4 };
    return !acc || (ordem[item.raridade] || 0) > (ordem[acc.raridade] || 0) ? item : acc;
  }, null);
  const id = ++sequencia;
  const tituloId = `recompensa-titulo-${id}`;
  const instrucaoId = `recompensa-instrucao-${id}`;
  const el = document.createElement("section");
  el.className = `recompensa-vitoria rar-${melhor?.raridade || "comum"}`;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", tituloId);
  el.setAttribute("aria-describedby", instrucaoId);
  el.innerHTML = `
    <div class="recompensa-raios" aria-hidden="true"></div>
    <div class="recompensa-painel">
      <div class="recompensa-selo">${abencoado ? "✦ FORTUNA ✦" : "✦ DESCOBERTA ✦"}</div>
      <h2 id="${tituloId}">${titulo}</h2>
      <div class="recompensa-itens">${itens.map((item) => `
        <div class="recompensa-item rar-${item.raridade || "comum"}">
          <img src="${caminhoDoIcone(item)}" alt="" />
          <span><b>${item.nome}</b><small>${RARITY_LABEL[item.raridade] || item.raridade || "Item"}</small></span>
        </div>`).join("")}</div>
      <div class="recompensa-extras">${ouro ? `<span>🪙 +${ouro} ouro</span>` : ""}${fragmentos ? `<span>✧ +${fragmentos} Fragmentos</span>` : ""}</div>
      <p class="recompensa-instrucao" id="${instrucaoId}">Confira suas recompensas e continue a jornada.</p>
      <button class="recompensa-continuar" type="button">Continuar</button>
    </div>`;
  const botaoContinuar = el.querySelector(".recompensa-continuar");
  let fechando = false;
  let temporizador = null;

  const finalizar = (restaurarFoco) => {
    el.remove();
    if (restaurarFoco && !atual && focoAnterior?.isConnected && typeof focoAnterior.focus === "function") {
      focoAnterior.focus({ preventScroll: true });
    }
  };
  const fechar = () => {
    if (fechando) return;
    fechando = true;
    clearTimeout(temporizador);
    if (atual?.el === el) atual = null;
    el.classList.add("saindo");
    setTimeout(() => finalizar(true), 260);
  };
  const descartar = () => {
    clearTimeout(temporizador);
    if (atual?.el === el) atual = null;
    fechando = true;
    finalizar(false);
  };
  const aoPressionarTecla = (evento) => {
    if (evento.key === "Tab") {
      evento.preventDefault();
      botaoContinuar.focus({ preventScroll: true });
      return;
    }
    if (["Enter", " ", "Escape"].includes(evento.key)) {
      evento.preventDefault();
      fechar();
    }
  };

  botaoContinuar.addEventListener("click", fechar);
  el.addEventListener("click", (evento) => {
    if (evento.target === el) fechar();
  });
  el.addEventListener("keydown", aoPressionarTecla);
  document.body.appendChild(el);
  atual = { el, descartar, focoAnterior };
  botaoContinuar.focus({ preventScroll: true });
  somTesouro(melhor?.raridade || (abencoado ? "epico" : "comum"));
  temporizador = setTimeout(fechar, 4300);
}
