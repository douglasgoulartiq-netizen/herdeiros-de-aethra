// UI do Mercador Itinerante (melhoria pós-backlog, ver
// TravelingMerchantSystem.js). Reaproveita o mesmo modal/cartão de item da
// loja fixa da vila (ver GameUI.js: abrirModalBase/itemCardHTML/
// comprarItem), só muda o texto de abertura e a facção usada pro cálculo
// de desconto/sobretaxa por reputação (regional, não "vila").
import { abrirModalBase, mostrarMensagem, itemCardHTML } from "./GameUI.js";
import { comprarItem } from "../systems/InventorySystem.js";
import { multiplicadorPrecoLoja, tierDaReputacao, getReputacao } from "../systems/WorldStateSystem.js";

// `onMudar` é chamado a cada compra (não ao fechar) — o chamador (main.js)
// usa isso pra atualizar o HUD (ouro gasto), igual ao onMudar de
// montarLoja/montarInventario. O modal continua aberto pra comprar mais de
// um item na mesma aparição, fechando só pelo botão "Fechar (Esc)" padrão.
export function mostrarMercadorItinerante(estoque, personagem, dados, facaoId, onMudar) {
  const multPreco = multiplicadorPrecoLoja(personagem, dados.worldStateVariables, facaoId);
  const tierAtual = tierDaReputacao(getReputacao(personagem, facaoId), dados.worldStateVariables);
  const facaoInfo = ((dados.worldStateVariables && dados.worldStateVariables.facoes) || []).find((f) => f.id === facaoId);
  const nomeFaccao = facaoInfo ? facaoInfo.nome : facaoId;
  const tituloDesconto = multPreco !== 1 ? ` (${multPreco < 1 ? "-" : "+"}${Math.abs(Math.round((1 - multPreco) * 100))}% por reputação com ${nomeFaccao}: ${tierAtual ? tierAtual.nome : ""})` : "";
  const corpo = abrirModalBase(`🧳 Mercador Itinerante — Seu ouro: ${personagem.ouro}${tituloDesconto}`);

  const intro = document.createElement("p");
  intro.textContent = "Um mercador de passagem armou sua barraca por aqui. O estoque é curto — ele não promete voltar tão cedo, e o que não for vendido hoje vai com ele.";
  corpo.appendChild(intro);

  estoque.forEach((item) => {
    const precoFinal = Math.max(1, Math.round(item.valor * multPreco));
    const div = document.createElement("div");
    div.innerHTML = itemCardHTML(item, `<button data-id="${item.id}" class="btn-comprar-mercador">Comprar (${precoFinal}o)</button>`);
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-comprar-mercador").forEach((b) => b.onclick = () => {
    const item = estoque.find((i) => i.id === b.dataset.id);
    const r = comprarItem(personagem, item, multPreco);
    if (!r.ok) mostrarMensagem(r.msg);
    else mostrarMensagem(`Comprou: ${item.nome} (${r.preco}o)!`);
    onMudar();
    mostrarMercadorItinerante(estoque, personagem, dados, facaoId, onMudar);
  });
}
