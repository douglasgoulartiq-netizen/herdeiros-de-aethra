// UI do Mercador Itinerante (melhoria pós-backlog, ver
// TravelingMerchantSystem.js). Reaproveita o mesmo modal/cartão de item da
// loja fixa da vila (ver GameUI.js: abrirModalBase/itemCardHTML/
// comprarItem), só muda o texto de abertura e a facção usada pro cálculo
// de desconto/sobretaxa por reputação (regional, não "vila").
import { caminhoDoIcone } from "../data/itemIcons.js";
import { mostrarMensagem } from "./GameUI.js";
import { abrirTela, LARGURA, criarGrade, abrirSheet, fecharSheet } from "./HdaUI.js";
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
  const tituloDesconto = multPreco !== 1 ? `${multPreco < 1 ? "-" : "+"}${Math.abs(Math.round((1 - multPreco) * 100))}% por reputação com ${nomeFaccao}${tierAtual ? ` (${tierAtual.nome})` : ""}` : "";

  const tela = abrirTela({ titulo: "🧳 Mercador Itinerante", subtitulo: `🪙 ${personagem.ouro}`, largura: LARGURA.media });
  const corpo = tela.corpo;

  const intro = document.createElement("p");
  intro.className = "desc";
  intro.textContent = "Um mercador de passagem armou sua barraca por aqui. O estoque é curto — ele não promete voltar tão cedo, e o que não for vendido hoje vai com ele.";
  corpo.appendChild(intro);
  if (tituloDesconto) {
    const p2 = document.createElement("p");
    p2.className = "desc";
    p2.textContent = `Preços ajustados: ${tituloDesconto}.`;
    corpo.appendChild(p2);
  }

  const grade = criarGrade({ densidade: "densa" });
  corpo.appendChild(grade);
  estoque.forEach((item) => {
    const precoFinal = Math.max(1, Math.round(item.valor * multPreco));
    const podeComprar = personagem.ouro >= precoFinal;
    const el = document.createElement("div");
    el.className = "hda-ladrilho" + (podeComprar ? "" : " indisponivel");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.innerHTML = `
      <span class="hda-ladrilho-icone icon-frame"><img src="${caminhoDoIcone(item)}" alt="" /></span>
      <span class="hda-ladrilho-nome hda-clamp-2">${item.nome}</span>
      <span class="hda-ladrilho-rar">🪙 ${precoFinal}</span>`;
    const abrir = () => {
      grade.querySelectorAll(".hda-ladrilho").forEach((x) => x.classList.toggle("selecionado", x === el));
      abrirSheet({
        titulo: item.nome,
        corpoHTML: `<p class="desc">${item.descricao || ""}</p><dl class="hda-ficha"><div><dt>Preço</dt><dd>🪙 ${precoFinal}</dd></div><div><dt>Seu ouro</dt><dd>🪙 ${personagem.ouro}</dd></div></dl>`,
        acoes: [{ rotulo: `Comprar (${precoFinal}o)`, classe: "primario btn-comprar-mercador", desabilitado: !podeComprar,
          onClick: () => {
            const r = comprarItem(personagem, item, multPreco);
            mostrarMensagem(r.ok ? `Comprou: ${item.nome} (${r.preco}o)!` : r.msg);
            fecharSheet(); onMudar();
            mostrarMercadorItinerante(estoque, personagem, dados, facaoId, onMudar);
          } }],
      });
    };
    el.onclick = abrir;
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
    grade.appendChild(el);
  });
  tela.definirAcoes([], `🪙 <b>${personagem.ouro}</b> · ${estoque.length} itens no estoque de hoje`);

}
