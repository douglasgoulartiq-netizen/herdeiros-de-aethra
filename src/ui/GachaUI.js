// Tela de invocação (gacha): puxar personagens, ver coleção e montar o time.
import {
  garantirEstadoDePets, elencoDePets, petsDoJogador, petAtivo, ativarPet,
  invocarPet, textoDoBuff, textoDaHabilidade, CUSTO_PADRAO,
} from "../systems/PetSystem.js";
import {
  invocarPermanente, invocarEvento, invocarIniciante, definirTimeAtivo,
  resgatarDesafioDiario, resgatarMissaoSemanal, podeResgatarMissaoSemanal,
  atualizarDesafioDiario, checarConquistas, MAX_CONVOCADOS_GACHA, membrosDoTime,
} from "../systems/GachaSystem.js";
import { CUSTO_INVOCACAO, CUSTO_PACOTE_10, EVENTO_FEATURED_ID, BANNER_INICIANTE, PITY_DURO } from "../data/economyConfig.js";
import { RARITY_COLORS, RARITY_LABEL } from "../systems/InventorySystem.js";
import { estadoDespertarResumo, montarDespertar } from "./AwakeningUI.js";
import { resumoVinculoParaCard, montarVinculo } from "./BondUI.js";
import { posicaoDe, definirPosicao } from "../systems/FormationSystem.js";
import { sinergiasAtivasPreview } from "../systems/FormationSynergySystem.js";
import { sinergiaFaccaoPreview } from "../systems/FactionSynergySystem.js";
import { paresRelacionamentoPreview } from "../systems/RivalrySystem.js";
import { infoAfinidade } from "../systems/AffinitySystem.js";
import { facaoAfiliada, facaoInfo } from "../systems/WorldStateSystem.js";
import { perfisParaExibir, salvarPerfilDeTime, carregarPerfilDeTime, apagarPerfilDeTime } from "../systems/TeamProfileSystem.js";
// Equipar/curar convocados do gacha (pedido do jogador): reaproveita a
// mesma tela de Inventário do personagem principal (GameUI.js), só que com
// `alvo` = o convocado — a mochila e o ouro usados continuam sendo os do
// principal (estoque compartilhado do time, ver InventorySystem.js).
import { montarInventario } from "./GameUI.js";

import { abrirTela, LARGURA, criarGrade, abrirSheet, fecharSheet } from "./HdaUI.js";
import { imgHtml, ligarCadeias } from "../systems/AssetResolver.js";
import { USOS } from "../data/assetRegistry.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

function badge(raridade) {
  return `<span class="raridade-badge" style="background:${RARITY_COLORS[raridade]}">${RARITY_LABEL[raridade]}</span>`;
}

// RETRATO DO CONVOCADO.
//
// Os 100 sprites `gacha_<id>.png` sempre existiram e o loader.js já os
// carregava no boot — esta tela é que nunca os usou, e mostrava só o nome.
// Como a URL é a mesma que o loader já buscou, o navegador serve do cache:
// não há requisição nova nem custo de carregamento aqui.
//
// A moldura é da raridade (a direção de arte pede "rarity frame"), o
// `image-rendering: pixelated` mantém a pixel-art nítida em vez de borrada,
// e a caixa tem tamanho FIXO — sprite que falte ou venha noutra resolução
// não pode empurrar o card e bagunçar a grade.
// O caminho da imagem NÃO é montado aqui. Quem sabe onde mora cada arte é o
// assetRegistry, e quem tenta os arquivos em ordem é o AssetResolver — assim,
// quando a arte nova entrar em assets/arte_v2/, esta tela não muda uma linha.
// O `asset-vazio` ao lado do <img> é o degrau final da cadeia: quando nenhum
// arquivo existe, ele aparece no lugar do ícone de imagem quebrada.
function retratoConvocado(rosterId, raridade, tamanho = 72) {
  const cor = RARITY_COLORS[raridade] || "#666";
  const img = rosterId ? imgHtml({ rosterId }, USOS.RETRATO) : "";
  return `
    <div class="gacha-retrato" style="width:${tamanho}px;height:${tamanho}px;border-color:${cor};">
      ${img}
      <span class="gacha-retrato-vazio asset-vazio" style="display:${rosterId ? "none" : "flex"};">?</span>
    </div>`;
}

export function montarGacha(personagem, dados, onMudar, abaInicial = "invocar") {
  const roster = dados.gachaRoster;
  atualizarDesafioDiario(personagem);
  const g = personagem.gacha;

  const tela = abrirTela({
    titulo: "Invocação",
    subtitulo: `<span id="gacha-saldo-chip">💠 <b id="gacha-saldo">${g.fragmentos}</b></span>`,
    largura: LARGURA.larga,
    classe: "tela-gacha",
  });
  tela.definirAbas([
    { id: "invocar", rotulo: "Invocar", icone: "✨" },
    { id: "colecao", rotulo: `Coleção (${g.personagensObtidos.length})`, icone: "📚" },
    { id: "pets", rotulo: `Pets (${garantirEstadoDePets(personagem).possuidos.length})`, icone: "🐾" },
    { id: "recompensas", rotulo: "Recompensas", icone: "🎁" },
  ], (id) => montarGacha(personagem, dados, onMudar, id), abaInicial);

  const corpo = tela.corpo;
  corpo.id = "gacha-corpo";
  if (abaInicial === "colecao") renderColecao(corpo, personagem, onMudar, dados);
  else if (abaInicial === "time") montarSelecaoDeTime(corpo, personagem, dados, onMudar);
  else if (abaInicial === "pets") renderPets(corpo, personagem, dados, onMudar);
  else if (abaInicial === "recompensas") renderRecompensas(corpo, personagem, dados, onMudar);
  else renderInvocar(corpo, personagem, roster, dados, onMudar, tela);
}

function atualizarSaldo(personagem) {
  const el = document.getElementById("gacha-saldo");
  if (el) el.textContent = personagem.gacha.fragmentos;
}

// Gacha UX (melhoria de jogabilidade #8): mostra custo, saldo, pity ATUAL
// (não só a regra em texto) e garantia/destaque de forma bem visível, ANTES
// do jogador confirmar qualquer invocação — cada card de banner já tem essa
// informação junto do botão, não escondida em outra tela.
function textoPity(pityState) {
  const faltam = Math.max(0, PITY_DURO - pityState.desdeUltimoLendario);
  return `Pity atual: <b>${pityState.desdeUltimoLendario}/${PITY_DURO}</b> desde o último Lendário${faltam > 0 ? ` (garantido em mais ${faltam})` : " (garantido AGORA!)"}.`;
}

// Tela de invocação (itens 23 e 24 do briefing de UX).
//
// O que estava errado: os três banners eram cards empilhados, cada um com os
// próprios botões no fim. No desktop o terceiro par de botões nascia na borda
// inferior do modal; no celular, o segundo e o terceiro banner ficavam
// inteiramente abaixo da dobra. Ou seja, INVOCAR — a única ação da tela —
// dependia de rolagem, exatamente o que os itens 23/24 proíbem.
//
// Como está agora, nos dois formatos:
//   - o BANNER SELECIONADO ocupa o topo, com nome, destaque e pity;
//   - os outros banners viram uma faixa de escolha compacta;
//   - MOEDA fica no cabeçalho fixo;
//   - INVOCAR x1 e x10 ficam na barra de ações fixa do rodapé.
// Nada disso rola. Taxas, garantias e histórico continuam no corpo, que é a
// única parte que rola (item 24).
function renderInvocar(corpo, personagem, roster, dados, onMudar, tela, bannerAtivo = null) {
  const g = personagem.gacha;
  const featured = roster.find((p) => p.id === EVENTO_FEATURED_ID);
  const mostraIniciante = !g.beginner.concluido;

  const BANNERS = [
    { id: "permanente", nome: "Banner Permanente", icone: "♾️",
      destaque: "Todos os personagens do roster",
      desc: "Pity garante Lendário em até 50 invocações (fica mais provável a partir da 40ª).",
      pity: g.pity.permanente, custo1: CUSTO_INVOCACAO, custo10: CUSTO_PACOTE_10, temX10: true },
    { id: "evento", nome: "Banner de Evento", icone: "🌟",
      destaque: featured ? `${featured.nome} ${badge(featured.raridade)}` : "?",
      desc: "Ao sair um Lendário, 50% de chance de ser o personagem em destaque. Se perder o 50/50, o próximo Lendário deste banner é garantido ser ele.",
      pity: g.pity.evento, custo1: CUSTO_INVOCACAO, custo10: CUSTO_PACOTE_10, temX10: true },
  ];
  if (mostraIniciante) {
    BANNERS.push({ id: "iniciante", nome: "Banner Iniciante", icone: "🎓",
      destaque: `${g.beginner.pullsUsados}/${BANNER_INICIANTE.TETO_TOTAL} usadas${g.beginner.gratisRestantes > 0 ? ` · ${g.beginner.gratisRestantes} grátis` : ""}`,
      desc: "Só para quem está começando: Raro+ garantido até a 10ª, Épico+ até a 20ª, Lendário garantido até a 40ª. Desaparece para sempre depois disso.",
      pity: null, custo1: g.beginner.gratisRestantes > 0 ? 0 : CUSTO_INVOCACAO, temX10: false });
  }

  const atual = BANNERS.find((b) => b.id === bannerAtivo) || BANNERS[0];
  const garantia = atual.id === "evento" && g.pity.evento.garantiaFeaturedPendente
    ? `<p class="gacha-garantia">🎯 Garantia ativa: o PRÓXIMO Lendário deste banner será ${featured ? featured.nome : "o personagem em destaque"}, sem precisar do 50/50.</p>` : "";

  corpo.innerHTML = `
    <div class="gacha-escolha" role="tablist" aria-label="Banners">
      ${BANNERS.map((b) => `<button type="button" class="gacha-escolha-btn${b.id === atual.id ? " ativa" : ""}" data-banner="${b.id}" role="tab" aria-selected="${b.id === atual.id}"><span aria-hidden="true">${b.icone}</span> ${b.nome.replace("Banner ", "")}</button>`).join("")}
    </div>
    <section class="gacha-banner-destaque" aria-live="polite">
      <div class="gacha-banner-icone" aria-hidden="true">${atual.icone}</div>
      <div class="gacha-banner-texto">
        <h3 class="gacha-banner-nome">${atual.nome}</h3>
        <p class="gacha-banner-featured">${atual.destaque}</p>
        ${atual.pity ? `<p class="gacha-pity">${textoPity(atual.pity)}</p>` : `<p class="gacha-pity">Sem pity: as garantias deste banner são por número de invocações.</p>`}
        ${garantia}
      </div>
    </section>
    <details class="gacha-detalhes">
      <summary>Detalhes e probabilidades</summary>
      <p class="desc">${atual.desc}</p>
      <p class="desc">Custo por invocação: <b>${CUSTO_INVOCACAO}</b> Fragmentos${atual.temX10 ? ` · pacote de 10: <b>${CUSTO_PACOTE_10}</b> (sem desconto — a vantagem é a garantia de raridade embutida)` : ""}.</p>
    </details>
    <div id="gacha-resultado"></div>
  `;

  corpo.querySelectorAll(".gacha-escolha-btn").forEach((b) => {
    b.onclick = () => renderInvocar(corpo, personagem, roster, dados, onMudar, tela, b.dataset.banner);
  });

  const puxar = (qtd) => {
    const resultados = [];
    for (let i = 0; i < qtd; i += 1) {
      let r;
      if (atual.id === "permanente") r = invocarPermanente(personagem, roster, dados);
      else if (atual.id === "evento") r = invocarEvento(personagem, roster, dados);
      else r = invocarIniciante(personagem, roster, dados);
      resultados.push(r);
      if (!r.ok) break;
    }
    checarConquistas(personagem, {});
    atualizarSaldo(personagem);
    onMudar();
    renderInvocar(corpo, personagem, roster, dados, onMudar, tela, atual.id);
    mostrarResultado(corpo, resultados, dados);
  };

  // A ação principal vive na barra fixa — nunca rola para fora (item 6/23).
  if (tela) {
    const acoes = [{ rotulo: atual.custo1 === 0 ? "Invocar (grátis)" : `Invocar (${atual.custo1})`, classe: "primario btn-puxar", onClick: () => puxar(1),
                     desabilitado: atual.custo1 > g.fragmentos }];
    if (atual.temX10) {
      acoes.push({ rotulo: `Invocar x10 (${atual.custo10})`, classe: "primario btn-puxar", onClick: () => puxar(10),
                   desabilitado: atual.custo10 > g.fragmentos });
    }
    const rodape = tela.definirAcoes(acoes, `💠 <b>${g.fragmentos}</b> Fragmentos de Aethra`);
    // Marcações que a auditoria automatizada procura (item 72) e que também
    // ajudam quem lê o DOM: qual botão é x1 e qual é x10.
    if (rodape) {
      const bts = rodape.querySelectorAll("button");
      if (bts[0]) bts[0].dataset.qtd = "1";
      if (bts[1]) bts[1].dataset.qtd = "10";
    }
  }
}

function mostrarResultado(corpo, resultados, dados) {
  const div = document.getElementById("gacha-resultado");
  if (!div) return;
  const falhas = resultados.filter((r) => !r.ok);
  const sucessos = resultados.filter((r) => r.ok);
  div.innerHTML = `
    <h3>Resultado</h3>
    ${falhas.length ? `<p style="color:#e0574a;">${falhas[0].motivo === "sem_fragmentos" ? "Fragmentos de Aethra insuficientes." : "Este banner já se esgotou para você."}</p>` : ""}
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${sucessos.map((r) => {
        const classeInfo = (dados && dados.classes || []).find((c) => c.id === r.def.classeId);
        return `
        <div class="card" style="flex-direction:column;width:130px;align-items:center;border-color:${RARITY_COLORS[r.raridade]}">
          ${retratoConvocado(r.def.id, r.raridade, 64)}
          <div class="nome" style="text-align:center;">${r.def.nome}${r.featured ? " ⭐" : ""}</div>
          ${badge(r.raridade)}
          ${classeInfo ? `<div class="desc classe-evidente" style="text-align:center;">${classeInfo.icone} ${classeInfo.nome}</div>` : ""}
          ${r.duplicata ? `<div class="desc" style="text-align:center;">Duplicata → +${r.xpConvertido} XP para ${r.def.nome}${r.subiuNivelDuplicata && r.subiuNivelDuplicata.length ? ` (subiu para Nv. ${r.subiuNivelDuplicata[r.subiuNivelDuplicata.length - 1]}!)` : ""}</div>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
  ligarCadeias(div);
}

// Item 39 de 100_melhorias.md: filtro de coleção por raridade/classe — só
// esconde/mostra cards já renderizados (não refaz a busca nem muda nenhum
// dado), então não há risco de divergir do estado real da coleção.
const RARIDADES_FILTRO = ["comum", "incomum", "raro", "epico", "lendario"];
function renderColecao(corpo, personagem, onMudar, dados) {
  const g = personagem.gacha;
  if (!g.personagensObtidos.length) {
    corpo.innerHTML = "<p>Você ainda não invocou nenhum personagem. Vá para a aba Invocar!</p>";
    return;
  }
  const classesPresentes = [...new Set(g.personagensObtidos.map((p) => p.classeId))];
  corpo.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;width:100%;">
      <select id="filtro-colecao-raridade" style="padding:4px;">
        <option value="">Todas as raridades</option>
        ${RARIDADES_FILTRO.map((r) => `<option value="${r}">${RARITY_LABEL[r] || r}</option>`).join("")}
      </select>
      <select id="filtro-colecao-classe" style="padding:4px;">
        <option value="">Todas as classes</option>
        ${classesPresentes.map((c) => { const info = (dados.classes || []).find((x) => x.id === c); return `<option value="${c}">${info ? info.nome : c}</option>`; }).join("")}
      </select>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>`;
  const grid = corpo.lastElementChild;
  function aplicarFiltro() {
    const raridadeF = corpo.querySelector("#filtro-colecao-raridade").value;
    const classeF = corpo.querySelector("#filtro-colecao-classe").value;
    [...grid.children].forEach((card) => {
      const ok = (!raridadeF || card.dataset.raridade === raridadeF) && (!classeF || card.dataset.classe === classeF);
      card.style.display = ok ? "" : "none";
    });
  }
  corpo.querySelector("#filtro-colecao-raridade").onchange = aplicarFiltro;
  corpo.querySelector("#filtro-colecao-classe").onchange = aplicarFiltro;
  g.personagensObtidos.forEach((p) => {
    const noTime = g.timeAtivo.includes(p.uid);
    const resumoDespertar = estadoDespertarResumo(p, dados.gachaRoster);
    const resumoVinculo = resumoVinculoParaCard(p);
    const habilidade = p.habilidades[0];
    // Classe/raça evidentes (task #41): nome + ícone da classe, nome da
    // raça, e a afinidade racial de classe quando ela existe pra essa
    // combinação (ver AffinitySystem.js/affinities.json).
    const classeInfo = (dados.classes || []).find((c) => c.id === p.classeId);
    const racaInfo = (dados.races || []).find((r) => r.id === p.racaId);
    const afinidade = infoAfinidade(p.racaId, p.classeId, dados.affinities);
    // Facção regional (task #44): mostra a facção de origem do convocado e
    // sinaliza quando ela bate com a afiliação do personagem principal
    // (camaradagem regional ativa em batalha).
    const faccaoInfo = p.facaoId ? facaoInfo(p.facaoId, dados.worldStateVariables) : null;
    const camaradagemAtiva = faccaoInfo && facaoAfiliada(personagem) === p.facaoId;
    const div = document.createElement("div");
    div.className = "card convocado-card";
    div.dataset.raridade = p.raridade;
    div.dataset.classe = p.classeId;
    div.style.cssText = `flex-direction:column;width:190px;align-items:center;border-color:${RARITY_COLORS[p.raridade]};cursor:pointer;`;
    // Item 37 de 100_melhorias.md: reforça na própria coleção (não só no
    // flash da invocação) quando este personagem é o destaque ATUAL do
    // banner de Evento — útil pra lembrar quem vale a pena focar Fragmentos.
    const ehFeaturedAtual = p.rosterId === EVENTO_FEATURED_ID;
    div.innerHTML = `
      ${retratoConvocado(p.rosterId, p.raridade, 72)}
      <div class="nome" style="text-align:center;">${p.nome}${noTime ? " 🛡️" : ""}${ehFeaturedAtual ? ` <span title="Destaque atual do Banner de Evento">⭐</span>` : ""}</div>
      ${badge(p.raridade)}
      <div class="desc classe-evidente" style="text-align:center;font-size:1.05em;">${classeInfo ? `${classeInfo.icone} <b>${classeInfo.nome}</b>` : p.classeId}${racaInfo ? ` · ${racaInfo.nome}` : ""}</div>
      ${faccaoInfo ? `<div class="desc" style="text-align:center;">${faccaoInfo.icone || ""} ${faccaoInfo.nome}</div>` : ""}
      <div class="desc" style="text-align:center;">Nv. ${p.nivel}</div>
      <div class="desc" style="text-align:center;">HP ${p.hp}/${p.hpMax} · MP ${p.mp}/${p.mpMax}</div>
      ${afinidade ? `<div class="desc badge-afinidade" style="text-align:center;margin-top:4px;" title="${afinidade.texto}">🔗 Afinidade racial ativa</div>` : ""}
      ${camaradagemAtiva ? `<div class="desc badge-afinidade" style="text-align:center;">🤝 Camaradagem regional ativa</div>` : ""}
      ${p.descricao ? `<div class="desc" style="text-align:center;margin-top:4px;font-style:italic;">${p.descricao}</div>` : ""}
      ${habilidade ? `<div class="desc" style="text-align:center;margin-top:4px;"><b>${habilidade.nome}</b> — ${habilidade.descricao}</div>` : ""}
      ${resumoDespertar ? `<div class="desc despertar-tag ${resumoDespertar.classe}" style="text-align:center;margin-top:4px;">${resumoDespertar.texto}</div>` : ""}
      <div class="desc vinculo-tag ${resumoVinculo.classe}" style="text-align:center;margin-top:4px;">${resumoVinculo.texto}</div>
      <button class="btn-vinculo-card" style="margin-top:6px;">💬 Vínculo</button>
    `;
    ligarCadeias(div);
    // Reabre a tela de gacha inteira (aba Coleção) em vez de reusar `corpo`
    // diretamente: montarDespertar()/montarVinculo() substituem todo o
    // #modal-conteudo, então o nó `corpo` capturado aqui ficaria desanexado
    // do DOM depois disso.
    div.onclick = () => montarDespertar(personagem, dados, p.uid, onMudar, () => montarGacha(personagem, dados, onMudar, "colecao"));
    // Botão de Vínculo fica DENTRO do card clicável de Despertar — precisa
    // parar a propagação do clique, senão os dois modais tentariam abrir ao
    // mesmo tempo (o card inteiro também tem onclick pro Despertar).
    div.querySelector(".btn-vinculo-card").onclick = (ev) => {
      ev.stopPropagation();
      montarVinculo(personagem, dados, p.uid, onMudar, () => montarGacha(personagem, dados, onMudar, "colecao"));
    };
    grid.appendChild(div);
  });
}

// Grade de formação (task #43): mostra o time ativo (principal + convocados)
// já posicionado em frente/retaguarda, com botões pra trocar a posição de
// cada um. "player" é o id-sentinela do personagem principal — o mesmo usado
// por BattleUI.js/FormationSystem.js na hora de montar a batalha de verdade.
function renderFormacao(corpo, personagem, dados, onMudar, aoVoltar = null) {
  const g = personagem.gacha;
  const membrosAtivos = [
    { id: "player", nome: personagem.nome, raridade: null, classeId: personagem.classeId, facaoId: null, rosterId: null },
    ...g.timeAtivo.map((uid) => g.personagensObtidos.find((p) => p.uid === uid)).filter(Boolean)
      .map((p) => ({ id: p.uid, nome: p.nome, raridade: p.raridade, classeId: p.classeId, facaoId: p.facaoId, rosterId: p.rosterId })),
  ];
  const idsTime = membrosAtivos.map((m) => m.id);

  const bloco = document.createElement("div");
  bloco.innerHTML = `
    <h3>Formação</h3>
    <p class="desc">Frente absorve os golpes físicos e é alvo prioritário de inimigos corpo a corpo. Retaguarda recebe menos dano físico enquanto a frente estiver de pé — mas magia e ataques à distância ignoram a formação.</p>
    <div class="formacao-grade"></div>
  `;
  const gradeEl = bloco.querySelector(".formacao-grade");
  ["frente", "retaguarda"].forEach((posicaoFileira) => {
    const coluna = document.createElement("div");
    coluna.className = "formacao-fileira";
    coluna.innerHTML = `<div class="formacao-fileira-titulo">${posicaoFileira === "frente" ? "⚔️ Frente" : "🛡️ Retaguarda"}</div>`;
    membrosAtivos
      .filter((m) => posicaoDe(personagem, m.id, idsTime) === posicaoFileira)
      .forEach((m) => {
        const chip = document.createElement("div");
        chip.className = "formacao-chip";
        if (m.raridade) chip.style.borderColor = RARITY_COLORS[m.raridade];
        // Classe evidente (task #41): ícone da classe ao lado do nome.
        const classeIcone = ((dados.classes || []).find((c) => c.id === m.classeId) || {}).icone || "";
        // O personagem principal não vem do gacha: a chave dele é
        // pc_<raça>_<classe>, e é o registro que sabe disso.
        const retratoChip = m.rosterId
          ? retratoConvocado(m.rosterId, m.raridade, 32)
          : `<div class="gacha-retrato" style="width:32px;height:32px;border-color:#8a7a4a;">
               ${imgHtml({ racaId: personagem.racaId, classeId: personagem.classeId }, USOS.RETRATO)}
               <span class="gacha-retrato-vazio asset-vazio" style="display:none;">?</span>
             </div>`;
        chip.innerHTML = `${retratoChip}<span>${classeIcone} ${m.nome}</span><button class="btn-trocar-posicao" data-id="${m.id}">Trocar</button>`;
        ligarCadeias(chip);
        chip.querySelector(".btn-trocar-posicao").onclick = () => {
          const novaPosicao = posicaoFileira === "frente" ? "retaguarda" : "frente";
          definirPosicao(personagem, m.id, novaPosicao, idsTime);
          onMudar();
          // Re-renderiza a aba Time inteira (não só o bloco de formação):
          // renderFormacao() sempre um <div> novo dentro de `corpo` sem
          // limpar o anterior, então chamar só ela de novo empilharia
          // grades duplicadas. renderTime() já limpa corpo.innerHTML antes
          // de reconstruir tudo — mesmo padrão usado no resto do arquivo.
          montarSelecaoDeTime(corpo, personagem, dados, onMudar, aoVoltar);
        };
        coluna.appendChild(chip);
      });
    gradeEl.appendChild(coluna);
  });
  // Combos de formação: mostra quais sinergias estão ativas com a formação
  // atual, antes mesmo de entrar em batalha (ver FormationSynergySystem.js).
  const membrosComPosicao = membrosAtivos.map((m) => ({ classeId: m.classeId, posicao: posicaoDe(personagem, m.id, idsTime) }));
  const sinergias = sinergiasAtivasPreview(membrosComPosicao);
  const sinergiasEl = document.createElement("div");
  sinergiasEl.className = "sinergias-preview";
  sinergiasEl.innerHTML = sinergias.length
    ? sinergias.map((s) => `<p class="sinergia-preview-item" title="${s.descricao}">${s.icone} <b>${s.nome}</b> ativa</p>`).join("")
    : `<p class="desc">Nenhuma sinergia de formação ativa. Coloque duas classes que combinam (ex.: Guerreiro + Clérigo) na mesma fileira pra ativar um bônus tático.</p>`;
  bloco.appendChild(sinergiasEl);
  // Sinergia de facção (melhoria pós-backlog, ver FactionSynergySystem.js):
  // mesmo espírito da prévia de combos de formação acima, mas avisando se 3+
  // convocados do time atual vêm da mesma facção de origem.
  const sinergiaFaccao = sinergiaFaccaoPreview(membrosAtivos, dados.worldStateVariables);
  const sinergiaFaccaoEl = document.createElement("div");
  sinergiaFaccaoEl.className = "sinergias-preview";
  sinergiaFaccaoEl.innerHTML = sinergiaFaccao
    ? `<p class="sinergia-preview-item" title="${sinergiaFaccao.descricao}">${sinergiaFaccao.icone} <b>${sinergiaFaccao.nome}</b> ativa</p>`
    : `<p class="desc">Nenhuma sinergia de facção ativa. Convoque 3 personagens da mesma facção de origem pro time pra ativar um bônus tático pro grupo inteiro.</p>`;
  bloco.appendChild(sinergiaFaccaoEl);
  // Rivalidade/Amizade entre convocados específicos (melhoria pós-backlog,
  // ver RivalrySystem.js): mesmo espírito das prévias acima, mas por pares
  // curados de personagens nomeados, não por classe/facção agregada.
  const paresRelacionamento = paresRelacionamentoPreview(membrosAtivos);
  const paresEl = document.createElement("div");
  paresEl.className = "sinergias-preview";
  paresEl.innerHTML = paresRelacionamento.length
    ? paresRelacionamento.map((p) => `<p class="sinergia-preview-item" title="${p.descricao}">${p.icone} <b>${p.nome}</b> ativa</p>`).join("")
    : `<p class="desc">Nenhuma rivalidade/amizade ativa. Alguns convocados têm uma história pessoal entre si — leve os dois pro time pra ativar o bônus.</p>`;
  bloco.appendChild(paresEl);
  corpo.appendChild(bloco);

  // Perfis de time salvos (melhoria pós-backlog, ver TeamProfileSystem.js):
  // até 3 configurações nomeadas de time+formação, pra trocar rápido entre
  // builds sem remontar tudo manualmente toda vez.
  const perfisDiv = document.createElement("div");
  perfisDiv.innerHTML = `<h3>Perfis de Time</h3><p class="desc">Salve até ${perfisParaExibir(personagem).length} times com formação pra trocar rápido depois.</p>`;
  perfisParaExibir(personagem).forEach((perfil, slot) => {
    const linha = document.createElement("div");
    linha.className = "card perfil-time-linha";
    linha.style.cssText = "flex-direction:column;align-items:flex-start;gap:6px;width:100%;";
    if (perfil) {
      linha.innerHTML = `
        <div class="nome">${perfil.nome}</div>
        <div class="desc">${perfil.timeAtivo.length + 1} membro(s) no time</div>
        <div style="display:flex;gap:6px;">
          <button class="btn-carregar-perfil" data-slot="${slot}">Carregar</button>
          <button class="btn-apagar-perfil" data-slot="${slot}">Apagar</button>
        </div>
      `;
    } else {
      linha.innerHTML = `
        <div class="nome">Slot ${slot + 1} vazio</div>
        <div style="display:flex;gap:6px;align-items:center;width:100%;">
          <input type="text" class="input-nome-perfil" placeholder="Nome do time (opcional)" maxlength="30" style="flex:1;" />
          <button class="btn-salvar-perfil" data-slot="${slot}">Salvar time atual aqui</button>
        </div>
      `;
    }
    perfisDiv.appendChild(linha);
  });
  corpo.appendChild(perfisDiv);

  perfisDiv.querySelectorAll(".btn-salvar-perfil").forEach((b) => {
    b.onclick = () => {
      const input = b.closest(".perfil-time-linha").querySelector(".input-nome-perfil");
      salvarPerfilDeTime(personagem, Number(b.dataset.slot), input ? input.value : "");
      onMudar();
      montarSelecaoDeTime(corpo, personagem, dados, onMudar, aoVoltar);
    };
  });
  perfisDiv.querySelectorAll(".btn-carregar-perfil").forEach((b) => {
    b.onclick = () => {
      carregarPerfilDeTime(personagem, Number(b.dataset.slot));
      onMudar();
      montarSelecaoDeTime(corpo, personagem, dados, onMudar, aoVoltar);
    };
  });
  perfisDiv.querySelectorAll(".btn-apagar-perfil").forEach((b) => {
    b.onclick = () => {
      apagarPerfilDeTime(personagem, Number(b.dataset.slot));
      onMudar();
      montarSelecaoDeTime(corpo, personagem, dados, onMudar, aoVoltar);
    };
  });
}

// Seleção de time e formação. Mora aqui porque conhece o estado do gacha
// (personagensObtidos, timeAtivo), mas a TELA dona dela é "Time e Mochila"
// (PartyUI.js): montar o grupo não é assunto de invocação. O Gacha deixou de
// ter a aba Time — quem quer trocar o time abre a tela do time.
export function montarSelecaoDeTime(corpo, personagem, dados, onMudar, aoVoltar = null) {
  const g = personagem.gacha;
  corpo.innerHTML = `
    <p>Seu personagem principal (${personagem.nome}) está sempre no time. Escolha até ${MAX_CONVOCADOS_GACHA} personagens invocados para completar o time de ${MAX_CONVOCADOS_GACHA + 1}.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  renderFormacao(corpo, personagem, dados, onMudar, aoVoltar);
  if (!g.personagensObtidos.length) {
    grid.innerHTML = "<p>Invoque personagens na aba Invocar para montar seu time.</p>";
    return;
  }
  g.personagensObtidos.forEach((p) => {
    const selecionado = g.timeAtivo.includes(p.uid);
    const classeInfo = (dados.classes || []).find((c) => c.id === p.classeId);
    const div = document.createElement("div");
    div.className = `card convocado-card time-card${selecionado ? " selecionado" : ""}`;
    div.style.cssText = `flex-direction:column;width:150px;align-items:center;border-color:${RARITY_COLORS[p.raridade]}${selecionado ? ";box-shadow:0 0 0 3px #f5a524" : ""}`;
    div.innerHTML = `
      ${retratoConvocado(p.rosterId, p.raridade, 56)}
      <div class="nome" style="text-align:center;">${p.nome}</div>
      ${badge(p.raridade)}
      <div class="desc classe-evidente">${classeInfo ? `${classeInfo.icone} ${classeInfo.nome}` : p.classeId}</div>
      <div class="desc">Nv. ${p.nivel}</div>
      <div class="desc" style="font-size:0.8em;">HP ${p.hp}/${p.hpMax} · MP ${p.mp}/${p.mpMax}</div>
      <button class="btn-time" data-uid="${p.uid}" style="margin-top:6px;">${selecionado ? "Remover do time" : "Colocar no time"}</button>
      <button class="btn-equipar-convocado" data-uid="${p.uid}" style="margin-top:4px;" title="Equipar itens ou usar poções de cura/mana nele(a), usando o estoque do time">🎒 Equipar/Curar</button>
    `;
    ligarCadeias(div);
    div.querySelector(".btn-time").onclick = () => {
      let novoTime = [...g.timeAtivo];
      if (selecionado) novoTime = novoTime.filter((uid) => uid !== p.uid);
      else if (novoTime.length < MAX_CONVOCADOS_GACHA) novoTime.push(p.uid);
      else { alert(`O time já tem ${MAX_CONVOCADOS_GACHA} personagens convocados além do principal. Remova um antes de adicionar outro.`); return; }
      definirTimeAtivo(personagem, novoTime);
      onMudar();
      montarSelecaoDeTime(corpo, personagem, dados, onMudar, aoVoltar);
    };
    // Equipar/curar convocados do gacha (pedido do jogador): abre a mesma
    // tela de Inventário do personagem principal, mirada nesse convocado —
    // ver montarInventario() em GameUI.js. "Voltar" reabre esta mesma aba.
    div.querySelector(".btn-equipar-convocado").onclick = () => {
      montarInventario(personagem, onMudar, p,
        aoVoltar || (() => montarGacha(personagem, dados, onMudar, "colecao")),
        null, { dados, time: [personagem, ...membrosDoTime(personagem)] });
    };
    grid.appendChild(div);
  });
}

function renderRecompensas(corpo, personagem, dados, onMudar) {
  const g = personagem.gacha;
  const podeSemanal = podeResgatarMissaoSemanal(personagem);
  corpo.innerHTML = `
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Desafio Diário — ${g.desafiosDiariosAcumulados} carga(s) acumulada(s)</div>
      <div class="desc">Não precisa jogar todo dia: acumula até ${7} cargas para você resgatar quando quiser.</div>
      <button id="btn-diario" style="margin-top:6px;" ${g.desafiosDiariosAcumulados > 0 ? "" : "disabled"}>Resgatar</button>
    </div>
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Missão Semanal</div>
      <div class="desc">Uma grande recompensa de Fragmentos, disponível a cada 7 dias.</div>
      <button id="btn-semanal" style="margin-top:6px;" ${podeSemanal ? "" : "disabled"}>${podeSemanal ? "Resgatar" : "Já resgatada esta semana"}</button>
    </div>
  `;
  corpo.querySelector("#btn-diario").onclick = () => {
    const r = resgatarDesafioDiario(personagem);
    if (r.ok) { atualizarSaldo(personagem); onMudar(); renderRecompensas(corpo, personagem, dados, onMudar); }
  };
  corpo.querySelector("#btn-semanal").onclick = () => {
    const r = resgatarMissaoSemanal(personagem);
    if (r.ok) { atualizarSaldo(personagem); onMudar(); renderRecompensas(corpo, personagem, dados, onMudar); }
  };
}


// --- ABA PETS --------------------------------------------------------------
//
// Um pet é DUAS promessas ao mesmo tempo, e a tela precisa mostrar as duas
// lado a lado antes de o jogador escolher:
//
//   o que ele faz FORA da batalha (abrir baú, farejar chefe, afastar bicho)
//   o que ele dá DENTRO dela (o bônus para o time inteiro)
//
// Sem as duas visíveis juntas, "ativar" vira um clique no bicho mais bonito.
// Por isso cada carta traz a habilidade em uma linha e o bônus em outra, e o
// pet ativo fica marcado com contorno e selo — a regra de "só um" tem de ser
// óbvia sem precisar de texto explicando.
function renderPets(corpo, personagem, dados, onMudar) {
  const catalogo = dados.pets || { pets: [] };
  const estado = garantirEstadoDePets(personagem);
  const custo = catalogo.custoInvocacao || CUSTO_PADRAO;
  const meus = petsDoJogador(personagem, catalogo);
  const ativo = petAtivo(personagem, catalogo);
  const elenco = elencoDePets(catalogo);
  const cor = (r) => (dados.items.raridades.find((x) => x.id === r) || {}).cor || "#b0b0b0";

  corpo.innerHTML = `
    <div class="pets-topo">
      <div>
        <h3>Companheiros</h3>
        <p class="desc">O pet trabalha no mapa enquanto você anda e reforça o time inteiro na batalha.
        <b>Só um pode ficar ativo por vez.</b></p>
      </div>
      <button class="btn btn-primario" id="btn-invocar-pet" ${estado ? "" : "disabled"}>
        🐾 Invocar pet — 💠 ${custo}
      </button>
    </div>
    <div id="pets-aviso" class="pets-aviso"></div>
    <div class="pets-grade" id="pets-grade"></div>
    <p class="desc" style="margin-top:14px;">
      Você tem ${meus.length} de ${elenco.length} companheiros.
    </p>`;

  const grade = corpo.querySelector("#pets-grade");
  const cartas = meus.length ? meus : [];
  if (!cartas.length) {
    grade.innerHTML = `<p class="desc">Nenhum companheiro ainda. Invoque o primeiro acima — ele entra ativo sozinho.</p>`;
  }
  for (const def of cartas) {
    const ehAtivo = ativo && ativo.id === def.id;
    const el = document.createElement("div");
    el.className = `pet-carta${ehAtivo ? " ativo" : ""}`;
    el.style.borderColor = cor(def.raridade);
    el.innerHTML = `
      <div class="pet-retrato"><img src="assets/sprites/pet_${def.id}.png" alt="" /></div>
      <div class="pet-info">
        <div class="pet-nome">${def.nome}${ehAtivo ? ' <span class="pet-selo">ativo</span>' : ""}</div>
        <div class="pet-raridade" style="color:${cor(def.raridade)}">${def.raridade}</div>
        <p class="pet-desc">${def.descricao}</p>
        <div class="pet-linha"><span>🗺️</span> ${textoDaHabilidade(def)}</div>
        <div class="pet-linha"><span>⚔️</span> ${textoDoBuff(def.buff)} para o time todo</div>
      </div>
      <button class="btn ${ehAtivo ? "" : "btn-primario"} pet-botao" data-pet="${def.id}">
        ${ehAtivo ? "Dispensar" : "Ativar"}
      </button>`;
    grade.appendChild(el);
  }

  grade.querySelectorAll(".pet-botao").forEach((b) => {
    b.onclick = () => {
      ativarPet(personagem, b.dataset.pet);
      if (onMudar) onMudar();
      montarGacha(personagem, dados, onMudar, "pets");
    };
  });

  const botao = corpo.querySelector("#btn-invocar-pet");
  botao.disabled = personagem.gacha.fragmentos < custo;
  botao.onclick = () => {
    // A moeda é a MESMA do gacha de personagem — passada como um pequeno
    // adaptador para o PetSystem não precisar conhecer o formato do estado
    // do gacha, e continuar testável sem montar um personagem inteiro.
    const moeda = {
      saldo: () => personagem.gacha.fragmentos,
      gastar: (v) => { personagem.gacha.fragmentos -= v; },
      receber: (v) => { personagem.gacha.fragmentos += v; },
    };
    const r = invocarPet(personagem, catalogo, moeda);
    const aviso = corpo.querySelector("#pets-aviso");
    if (!r.ok) {
      aviso.textContent = r.motivo === "sem_fragmentos"
        ? `Fragmentos insuficientes: são necessários ${r.custo || custo}.`
        : "Nenhum companheiro disponível.";
      return;
    }
    if (onMudar) onMudar();
    montarGacha(personagem, dados, onMudar, "pets");
    const novoAviso = document.getElementById("pets-aviso");
    if (novoAviso) {
      novoAviso.innerHTML = r.duplicata
        ? `🐾 <b>${r.pet.nome}</b> já andava com você — 💠 ${r.devolvido} Fragmentos devolvidos.`
        : `🐾 <b>${r.pet.nome}</b> se juntou a você!`;
    }
  };
}
