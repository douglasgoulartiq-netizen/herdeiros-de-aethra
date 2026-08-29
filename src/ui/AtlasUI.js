// Atlas do Mapa-Múndi (pedido do usuário: "adicione também o novo mapa do
// jogo com formato real do pdf e use as descrições do pdf"). Tela nova,
// aditiva — não toca no motor de exploração em tiles já testado. Mostra a
// arte pintada do mapa (assets/lore/mapa_mundi.jpg) com hotspots clicáveis
// pra cada uma das 17 grandes regiões do Atlas Mitológico (src/data/
// atlasRegions.js); cada hotspot abre um painel de descrição usando o texto
// do PDF e, quando a região está ligada a uma zona jogável já visitada,
// reaproveita o sistema de Viagem Rápida existente (FastTravelSystem.js).
import { ATLAS_REGIONS } from "../data/atlasRegions.js";
import { zonaFoiVisitada } from "../systems/FastTravelSystem.js";
import { abrirModalBase } from "./GameUI.js";

export function montarAtlas(personagem, ZONAS, zonaAtualId, onViajar) {
  const corpo = abrirModalBase("🗺️ Atlas do Mapa-Múndi");
  corpo.innerHTML = `
    <p class="desc">As grandes regiões de Aethra, catalogadas no Códice da Mitologia. Clique numa região para ler sua descrição — regiões ligadas a uma zona já visitada permitem viagem rápida direta.</p>
    <div id="atlas-wrap" style="position:relative;width:100%;max-width:900px;margin:0 auto;">
      <img src="assets/lore/mapa_mundi.jpg" alt="Mapa-múndi de Aethra" style="width:100%;display:block;border-radius:6px;border:2px solid #7a5c34;" />
      <div id="atlas-hotspots" style="position:absolute;inset:0;"></div>
    </div>
    <div id="atlas-painel" style="margin-top:14px;"></div>
  `;

  const hotspots = corpo.querySelector("#atlas-hotspots");
  const painel = corpo.querySelector("#atlas-painel");

  ATLAS_REGIONS.forEach((regiao) => {
    const visitada = regiao.zonaId ? zonaFoiVisitada(personagem, regiao.zonaId) : false;
    const marcador = document.createElement("button");
    marcador.className = "atlas-marcador";
    marcador.title = regiao.nomeMapa;
    marcador.style.cssText = `
      position:absolute; left:${regiao.x}%; top:${regiao.y}%; transform:translate(-50%,-50%);
      width:22px; height:22px; border-radius:50%; cursor:pointer; padding:0;
      border:2px solid ${visitada ? "#f5a524" : "#e8dcc4"};
      background:${regiao.zonaId ? (visitada ? "#f5a524" : "#3a2c1a") : "rgba(60,40,80,0.85)"};
      box-shadow:0 0 6px rgba(0,0,0,0.6);
    `;
    marcador.onclick = () => renderPainel(painel, regiao, personagem, ZONAS, zonaAtualId, onViajar);
    hotspots.appendChild(marcador);
  });

  painel.innerHTML = `<p class="desc" style="font-style:italic;">Clique em um marcador do mapa para ver a descrição da região.</p>`;
}

function renderPainel(painel, regiao, personagem, ZONAS, zonaAtualId, onViajar) {
  const zona = regiao.zonaId ? ZONAS.find((z) => z.id === regiao.zonaId) : null;
  const visitada = regiao.zonaId ? zonaFoiVisitada(personagem, regiao.zonaId) : false;
  const aqui = regiao.zonaId === zonaAtualId;

  let ligacaoHTML;
  if (!regiao.zonaId) {
    ligacaoHTML = `<p class="desc" style="opacity:0.8;">Região lendária — ainda não existe uma zona jogável ligada a ela.</p>`;
  } else if (!visitada) {
    ligacaoHTML = `<p class="desc" style="opacity:0.8;">Corresponde a <b>${zona ? zona.nome : regiao.zonaId}</b> no mundo jogável — ainda não explorada.</p>`;
  } else {
    ligacaoHTML = `<p class="desc">Corresponde a <b>${zona ? zona.nome : regiao.zonaId}</b> no mundo jogável.</p>
      <button class="btn-viajar-atlas" ${aqui ? "disabled" : ""}>${aqui ? "Você está aqui" : "Viajar para lá"}</button>`;
  }

  painel.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;width:100%;">
      <div class="nome">${regiao.nomeMapa}${regiao.nomeCanonico !== regiao.nomeMapa ? ` <span style="opacity:0.7;font-weight:normal;">(${regiao.nomeCanonico})</span>` : ""}</div>
      <p style="font-style:italic;opacity:0.85;margin:4px 0;">${regiao.subtitulo}</p>
      <p class="desc" style="margin:6px 0;">${regiao.descricao}</p>
      <p class="desc" style="margin:4px 0;"><b>Locais lendários:</b> ${regiao.locaisLendarios}</p>
      <p class="desc" style="margin:4px 0;"><b>Presença dominante:</b> ${regiao.presencaDominante}</p>
      ${regiao.notaLigacao ? `<p class="desc" style="margin:4px 0;opacity:0.7;font-style:italic;">${regiao.notaLigacao}</p>` : ""}
      ${ligacaoHTML}
    </div>
  `;
  const btn = painel.querySelector(".btn-viajar-atlas");
  if (btn) btn.onclick = () => onViajar(regiao.zonaId);
}
