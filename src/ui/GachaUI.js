// Tela de invocação (gacha): puxar personagens, ver coleção e montar o time.
import {
  invocarPermanente, invocarEvento, invocarIniciante, definirTimeAtivo,
  resgatarDesafioDiario, resgatarMissaoSemanal, podeResgatarMissaoSemanal,
  atualizarDesafioDiario, checarConquistas, MAX_CONVOCADOS_GACHA,
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

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

function badge(raridade) {
  return `<span class="raridade-badge" style="background:${RARITY_COLORS[raridade]}">${RARITY_LABEL[raridade]}</span>`;
}

export function montarGacha(personagem, dados, onMudar, abaInicial = "invocar") {
  const roster = dados.gachaRoster;
  atualizarDesafioDiario(personagem);
  const g = personagem.gacha;

  overlay().classList.remove("hidden");
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Invocação — Fragmentos de Aethra: <span id="gacha-saldo">${g.fragmentos}</span></h2>
    <div id="gacha-tabs" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <button data-tab="invocar">Invocar</button>
      <button data-tab="colecao">Coleção (${g.personagensObtidos.length})</button>
      <button data-tab="time">Time</button>
      <button data-tab="recompensas">Recompensas</button>
    </div>
    <div id="gacha-corpo"></div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModal;
  conteudo().querySelectorAll("#gacha-tabs button").forEach((b) => {
    b.onclick = () => montarGacha(personagem, dados, onMudar, b.dataset.tab);
  });

  const corpo = conteudo().querySelector("#gacha-corpo");
  if (abaInicial === "colecao") renderColecao(corpo, personagem, onMudar, dados);
  else if (abaInicial === "time") renderTime(corpo, personagem, dados, onMudar);
  else if (abaInicial === "recompensas") renderRecompensas(corpo, personagem, dados, onMudar);
  else renderInvocar(corpo, personagem, roster, dados, onMudar);
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

function renderInvocar(corpo, personagem, roster, dados, onMudar) {
  const g = personagem.gacha;
  const featured = roster.find((p) => p.id === EVENTO_FEATURED_ID);
  const garantiaFeaturedTexto = g.pity.evento.garantiaFeaturedPendente
    ? `<div class="desc" style="color:#f5d76e;">🎯 Garantia ativa: o PRÓXIMO Lendário deste banner será ${featured ? featured.nome : "o personagem em destaque"}, sem precisar do 50/50.</div>`
    : "";

  corpo.innerHTML = `
    <p class="desc" style="width:100%;">Saldo atual: <b>${g.fragmentos}</b> Fragmentos de Aethra · Custo por invocação: <b>${CUSTO_INVOCACAO}</b> (x10 = ${CUSTO_PACOTE_10}, sem desconto — a vantagem do pacote é a garantia de raridade embutida).</p>
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Banner Permanente</div>
      <div class="desc">Todos os personagens do roster. Pity: garante Lendário em até 50 invocações (fica mais provável a partir da 40ª).</div>
      <div class="desc" style="color:#f5a524;">${textoPity(g.pity.permanente)}</div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button class="btn-puxar" data-banner="permanente" data-qtd="1">Invocar (${CUSTO_INVOCACAO})</button>
        <button class="btn-puxar" data-banner="permanente" data-qtd="10">Invocar x10 (${CUSTO_PACOTE_10})</button>
      </div>
    </div>
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Banner de Evento — em destaque: ${featured ? featured.nome : "?"} ${featured ? badge(featured.raridade) : ""}</div>
      <div class="desc">Ao sair um Lendário deste banner, 50% de chance de ser o personagem em destaque. Se perder o 50/50, o próximo Lendário deste banner é garantido ser ele.</div>
      <div class="desc" style="color:#f5a524;">${textoPity(g.pity.evento)}</div>
      ${garantiaFeaturedTexto}
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button class="btn-puxar" data-banner="evento" data-qtd="1">Invocar (${CUSTO_INVOCACAO})</button>
        <button class="btn-puxar" data-banner="evento" data-qtd="10">Invocar x10 (${CUSTO_PACOTE_10})</button>
      </div>
    </div>
    ${!g.beginner.concluido ? `
    <div class="card" style="flex-direction:column;align-items:flex-start;">
      <div class="nome">Banner Iniciante — ${g.beginner.pullsUsados}/${BANNER_INICIANTE.TETO_TOTAL} usadas${g.beginner.gratisRestantes > 0 ? ` (${g.beginner.gratisRestantes} grátis!)` : ""}</div>
      <div class="desc">Só para quem está começando: Raro+ garantido até a 10ª, Épico+ até a 20ª, Lendário garantido até a 40ª. Desaparece para sempre depois disso.</div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button class="btn-puxar" data-banner="iniciante" data-qtd="1">${g.beginner.gratisRestantes > 0 ? "Invocar (grátis)" : `Invocar (${CUSTO_INVOCACAO})`}</button>
      </div>
    </div>` : ""}
    <div id="gacha-resultado"></div>
  `;

  corpo.querySelectorAll(".btn-puxar").forEach((b) => {
    b.onclick = () => {
      const banner = b.dataset.banner;
      const qtd = Number(b.dataset.qtd);
      const resultados = [];
      for (let i = 0; i < qtd; i++) {
        let r;
        if (banner === "permanente") r = invocarPermanente(personagem, roster, dados);
        else if (banner === "evento") r = invocarEvento(personagem, roster, dados);
        else r = invocarIniciante(personagem, roster, dados);
        if (!r.ok) { resultados.push(r); break; }
        resultados.push(r);
      }
      checarConquistas(personagem, {});
      atualizarSaldo(personagem);
      onMudar();
      renderInvocar(corpo, personagem, roster, dados, onMudar);
      mostrarResultado(corpo, resultados, dados);
    };
  });
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
          <div class="nome" style="text-align:center;">${r.def.nome}${r.featured ? " ⭐" : ""}</div>
          ${badge(r.raridade)}
          ${classeInfo ? `<div class="desc classe-evidente" style="text-align:center;">${classeInfo.icone} ${classeInfo.nome}</div>` : ""}
          ${r.duplicata ? `<div class="desc" style="text-align:center;">Duplicata → +${r.xpConvertido} XP para ${r.def.nome}${r.subiuNivelDuplicata && r.subiuNivelDuplicata.length ? ` (subiu para Nv. ${r.subiuNivelDuplicata[r.subiuNivelDuplicata.length - 1]}!)` : ""}</div>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
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
    div.className = "card";
    div.dataset.raridade = p.raridade;
    div.dataset.classe = p.classeId;
    div.style.cssText = `flex-direction:column;width:190px;align-items:center;border-color:${RARITY_COLORS[p.raridade]};cursor:pointer;`;
    // Item 37 de 100_melhorias.md: reforça na própria coleção (não só no
    // flash da invocação) quando este personagem é o destaque ATUAL do
    // banner de Evento — útil pra lembrar quem vale a pena focar Fragmentos.
    const ehFeaturedAtual = p.rosterId === EVENTO_FEATURED_ID;
    div.innerHTML = `
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
function renderFormacao(corpo, personagem, dados, onMudar) {
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
        chip.innerHTML = `<span>${classeIcone} ${m.nome}</span><button class="btn-trocar-posicao" data-id="${m.id}">Trocar</button>`;
        chip.querySelector(".btn-trocar-posicao").onclick = () => {
          const novaPosicao = posicaoFileira === "frente" ? "retaguarda" : "frente";
          definirPosicao(personagem, m.id, novaPosicao, idsTime);
          onMudar();
          // Re-renderiza a aba Time inteira (não só o bloco de formação):
          // renderFormacao() sempre um <div> novo dentro de `corpo` sem
          // limpar o anterior, então chamar só ela de novo empilharia
          // grades duplicadas. renderTime() já limpa corpo.innerHTML antes
          // de reconstruir tudo — mesmo padrão usado no resto do arquivo.
          renderTime(corpo, personagem, dados, onMudar);
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
      renderTime(corpo, personagem, dados, onMudar);
    };
  });
  perfisDiv.querySelectorAll(".btn-carregar-perfil").forEach((b) => {
    b.onclick = () => {
      carregarPerfilDeTime(personagem, Number(b.dataset.slot));
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
  });
  perfisDiv.querySelectorAll(".btn-apagar-perfil").forEach((b) => {
    b.onclick = () => {
      apagarPerfilDeTime(personagem, Number(b.dataset.slot));
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
  });
}

function renderTime(corpo, personagem, dados, onMudar) {
  const g = personagem.gacha;
  corpo.innerHTML = `
    <p>Seu personagem principal (${personagem.nome}) está sempre no time. Escolha até ${MAX_CONVOCADOS_GACHA} personagens invocados para completar o time de ${MAX_CONVOCADOS_GACHA + 1}.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  `;
  const grid = corpo.lastElementChild;
  renderFormacao(corpo, personagem, dados, onMudar);
  if (!g.personagensObtidos.length) {
    grid.innerHTML = "<p>Invoque personagens na aba Invocar para montar seu time.</p>";
    return;
  }
  g.personagensObtidos.forEach((p) => {
    const selecionado = g.timeAtivo.includes(p.uid);
    const classeInfo = (dados.classes || []).find((c) => c.id === p.classeId);
    const div = document.createElement("div");
    div.className = "card";
    div.style.cssText = `flex-direction:column;width:150px;align-items:center;border-color:${RARITY_COLORS[p.raridade]}${selecionado ? ";box-shadow:0 0 0 3px #f5a524" : ""}`;
    div.innerHTML = `
      <div class="nome" style="text-align:center;">${p.nome}</div>
      ${badge(p.raridade)}
      <div class="desc classe-evidente">${classeInfo ? `${classeInfo.icone} ${classeInfo.nome}` : p.classeId}</div>
      <div class="desc">Nv. ${p.nivel}</div>
      <div class="desc" style="font-size:0.8em;">HP ${p.hp}/${p.hpMax} · MP ${p.mp}/${p.mpMax}</div>
      <button class="btn-time" data-uid="${p.uid}" style="margin-top:6px;">${selecionado ? "Remover do time" : "Colocar no time"}</button>
      <button class="btn-equipar-convocado" data-uid="${p.uid}" style="margin-top:4px;" title="Equipar itens ou usar poções de cura/mana nele(a), usando o estoque do time">🎒 Equipar/Curar</button>
    `;
    div.querySelector(".btn-time").onclick = () => {
      let novoTime = [...g.timeAtivo];
      if (selecionado) novoTime = novoTime.filter((uid) => uid !== p.uid);
      else if (novoTime.length < MAX_CONVOCADOS_GACHA) novoTime.push(p.uid);
      else { alert(`O time já tem ${MAX_CONVOCADOS_GACHA} personagens convocados além do principal. Remova um antes de adicionar outro.`); return; }
      definirTimeAtivo(personagem, novoTime);
      onMudar();
      renderTime(corpo, personagem, dados, onMudar);
    };
    // Equipar/curar convocados do gacha (pedido do jogador): abre a mesma
    // tela de Inventário do personagem principal, mirada nesse convocado —
    // ver montarInventario() em GameUI.js. "Voltar" reabre esta mesma aba.
    div.querySelector(".btn-equipar-convocado").onclick = () => {
      montarInventario(personagem, onMudar, p, () => montarGacha(personagem, dados, onMudar, "time"));
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
