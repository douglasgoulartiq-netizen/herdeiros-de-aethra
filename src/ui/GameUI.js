// Telas de inventário, missões, loja, forja, diálogo e HUD (tudo em DOM/HTML).
import { RARITY_COLORS, RARITY_LABEL, equiparItem, desequiparItem, usarConsumivel, venderItem, comprarItem } from "../systems/InventorySystem.js";
import { receitaDisponivel, craftar } from "../systems/CraftingSystem.js";
import { itemPodeSerAprimorado, nivelAprimoramento, custoProximoNivel, podeAprimorar, aprimorarItem, MAX_NIVEL_APRIMORAMENTO } from "../systems/EnchantSystem.js";
import { iniciarMissao, missaoPronta, concluirMissao } from "../systems/QuestSystem.js";
import { missoesDiariasParaExibir, coletarRecompensaDiaria } from "../systems/DailyQuestSystem.js";
import { ganharXP, aplicarCrescimento, cryptoId, escolhaPendente } from "../systems/CharacterFactory.js";
import { adicionarFragmentos, checarConquistas } from "../systems/GachaSystem.js";
import { testesDoContexto, testeJaFeito, marcarTesteFeito, realizarTeste } from "../systems/SkillCheckSystem.js";
import { getReputacao, alterarReputacao, tierDaReputacao, multiplicadorPrecoLoja, registrarDecisao } from "../systems/WorldStateSystem.js";
import { zonaFoiVisitada } from "../systems/FastTravelSystem.js";
import { conjuntosParaExibir } from "../systems/SetBonusSystem.js";
import { multiplicadorVelocidadeMensagem } from "../systems/AccessibilitySystem.js";
import { registrarEvento } from "../systems/TelemetrySystem.js";
import { personagemTemCaminhoHerdeiro } from "./TalentTreeUI.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

export function fecharModal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
}

export function abrirModalBase(titulo) {
  overlay().classList.remove("hidden");
  conteudo().innerHTML = `<button class="fechar">Fechar (Esc)</button><h2>${titulo}</h2><div id="modal-corpo"></div>`;
  conteudo().querySelector(".fechar").onclick = fecharModal;
  // Telemetria mínima local (item 98 de 100_melhorias.md): ponto único que
  // cobre a maioria das telas do jogo, já que quase todas passam por aqui —
  // só o título (nunca conteúdo do jogador), pra saber onde o tempo é gasto.
  registrarEvento("tela_aberta", { tela: titulo });
  return conteudo().querySelector("#modal-corpo");
}

export function mostrarMensagem(texto, duracaoMs = 2200) {
  const el = document.getElementById("mensagem-topo");
  el.textContent = texto;
  el.classList.remove("hidden");
  clearTimeout(mostrarMensagem._t);
  // Acessibilidade (melhoria pós-backlog, ver AccessibilitySystem.js):
  // velocidade de mensagens é uma preferência do jogador, não do
  // personagem — multiplicador 1 (padrão) mantém o comportamento idêntico
  // a antes deste sistema existir.
  mostrarMensagem._t = setTimeout(() => el.classList.add("hidden"), Math.round(duracaoMs * multiplicadorVelocidadeMensagem()));
}

export function atualizarHUD(personagem) {
  // Botão "Caminhos do Herdeiro" (task #95) só aparece pra quem tem árvore
  // de verdade hoje (Guerreiro/Mago — "profundo em 2 classes primeiro");
  // outras classes continuam só com o botão "Habilidades" antigo.
  const btnCaminhos = document.getElementById("btn-caminhos");
  if (btnCaminhos) btnCaminhos.classList.toggle("hidden", !personagemTemCaminhoHerdeiro(personagem));
  document.getElementById("hud-hp").style.width = `${Math.max(0, (personagem.hp / personagem.hpMax) * 100)}%`;
  document.getElementById("hud-mp").style.width = `${Math.max(0, (personagem.mp / personagem.mpMax) * 100)}%`;
  document.getElementById("hud-xp").style.width = `${Math.max(0, (personagem.xp / personagem.xpProximo) * 100)}%`;
  const fragmentos = personagem.gacha ? personagem.gacha.fragmentos : 0;
  // New Game+ (melhoria pós-backlog original): selo visível só quando o
  // personagem está numa run de NG+ (ngPlus > 0) — jogo normal fica igual a
  // antes desta melhoria existir.
  const seloNgPlus = personagem.ngPlus > 0 ? ` <span class="badge-ng-plus" title="New Game+: monstros mais fortes e valem mais XP/ouro">🔥 NG+${personagem.ngPlus}</span>` : "";
  // Modo História (melhoria pós-backlog): selo visível só quando ligado —
  // mesmo padrão do selo de NG+ acima, jogo normal fica igual a antes desta
  // melhoria existir.
  const seloModoHistoria = personagem.modoHistoria ? ` <span class="badge-modo-historia" title="Modo História: monstros mais fracos, XP/ouro normais">📖 Modo História</span>` : "";
  // Item 31 de 100_melhorias.md: próximo marco de progressão sempre visível
  // (aqui, o mais simples e universal — faltam quantos XP pro próximo
  // nível), sem precisar abrir nenhuma tela.
  const faltamXP = Math.max(0, personagem.xpProximo - personagem.xp);
  document.getElementById("hud-info").innerHTML =
    `<b>${personagem.nome}</b> - Nv. ${personagem.nivel} ${personagem.classeIcone || ""} ${personagem.classeNome}${seloNgPlus}${seloModoHistoria}<br/>HP ${personagem.hp}/${personagem.hpMax} · MP ${personagem.mp}/${personagem.mpMax} · Ouro: ${personagem.ouro} · Fragmentos: ${fragmentos}<br/><span style="opacity:0.75;font-size:0.85em;">Faltam ${faltamXP} XP para o nível ${personagem.nivel + 1}</span>`;
}

export function itemCardHTML(item, extraBotoesHTML = "") {
  const cor = RARITY_COLORS[item.raridade] || "#888";
  return `
    <div class="card">
      <span class="icon-frame" style="border-color:${cor}"><img src="assets/icons/${item.icone}.png" /></span>
      <div class="info">
        <div class="nome">${item.nome} <span class="raridade-badge" style="background:${cor}">${RARITY_LABEL[item.raridade]}</span></div>
        <div class="desc">${item.descricao || ""}</div>
      </div>
      <div>${extraBotoesHTML}</div>
    </div>`;
}

// Ordem fixa dos 7 slots de equipamento — sempre renderizados, vazios ou
// não, pra virar um painel visual estável em vez de uma lista que só mostra
// o que está preenchido (task #39).
const SLOTS_EQUIPAMENTO = [
  { slot: "arma", label: "Arma", icone: "⚔️" },
  { slot: "peito", label: "Peito", icone: "🛡️" },
  { slot: "cabeca", label: "Cabeça", icone: "🪖" },
  { slot: "pes", label: "Pés", icone: "👢" },
  { slot: "escudo", label: "Escudo", icone: "🔰" },
  { slot: "anel", label: "Anel", icone: "💍" },
  { slot: "amuleto", label: "Amuleto", icone: "📿" },
];

// Comparação equipado x candidato (melhoria de jogabilidade #16): mostra só
// as estatísticas que DIFEREM entre o item já equipado no slot e o item da
// mochila, com sinal de melhor/pior — evita o jogador ter que abrir duas
// telas ou fazer conta de cabeça pra saber se vale a pena trocar. Mesma
// lista de slots usada por SLOTS_EQUIPAMENTO acima (arma/peito/cabeca/pes/
// escudo/anel/amuleto).
function slotDoItemParaComparacao(item) {
  if (item.tipo === "arma") return "arma";
  if (item.tipo === "armadura" || item.tipo === "acessorio") return item.slot || null;
  return null;
}

const LABEL_STAT_COMPARACAO = { dano: "Dano", defesa: "Defesa", bonus_FOR: "FOR", bonus_DES: "DES", bonus_CON: "CON", bonus_INT: "INT" };

function statsComparaveis(item) {
  const stats = {};
  if (typeof item.dano === "number") stats.dano = item.dano;
  if (typeof item.defesa === "number") stats.defesa = item.defesa;
  if (item.bonusAtributo) Object.entries(item.bonusAtributo).forEach(([atributo, valor]) => { stats[`bonus_${atributo}`] = valor; });
  return stats;
}

// Retorna só as linhas que DIFEREM entre os dois itens — `null` se não há
// nada equipado nesse slot pra comparar (a mochila nunca tem os dois iguais
// pra que a lista fique vazia sem sentido nenhum).
function compararComEquipado(candidato, equipado) {
  if (!equipado || equipado.uid === candidato.uid) return null;
  const statsCand = statsComparaveis(candidato);
  const statsEquip = statsComparaveis(equipado);
  const chaves = new Set([...Object.keys(statsCand), ...Object.keys(statsEquip)]);
  const linhas = [];
  chaves.forEach((chave) => {
    const atual = statsEquip[chave] || 0;
    const novo = statsCand[chave] || 0;
    if (atual === novo) return;
    linhas.push({ label: LABEL_STAT_COMPARACAO[chave] || chave, atual, novo, melhor: novo > atual });
  });
  const elementoMudou = (candidato.elemento || null) !== (equipado.elemento || null);
  return { linhas, elementoMudou, elementoNovo: candidato.elemento || null, elementoAtual: equipado.elemento || null };
}

function comparacaoEquipamentoHTML(candidato, alvo) {
  const slot = slotDoItemParaComparacao(candidato);
  if (!slot) return "";
  const equipado = alvo.equipamento[slot];
  const cmp = compararComEquipado(candidato, equipado);
  if (!cmp || (!cmp.linhas.length && !cmp.elementoMudou)) return "";
  const linhasHTML = cmp.linhas.map((l) =>
    `<span class="comparacao-stat ${l.melhor ? "melhor" : "pior"}">${l.label}: ${l.atual} → ${l.novo} (${l.melhor ? "+" : ""}${l.novo - l.atual})</span>`
  ).join(" ");
  const elementoHTML = cmp.elementoMudou
    ? `<span class="comparacao-stat elemento">Elemento: ${cmp.elementoAtual || "físico"} → ${cmp.elementoNovo || "físico"}</span>`
    : "";
  return `<div class="comparacao-equip" title="Comparado com ${equipado.nome}, já equipado neste slot">vs. equipado (${equipado.nome}): ${linhasHTML}${elementoHTML}</div>`;
}

function slotEquipadoHTML({ slot, label, icone }, item) {
  if (!item) {
    return `
      <div class="equip-slot vazio" data-slot="${slot}">
        <span class="equip-slot-icone">${icone}</span>
        <div class="equip-slot-label">${label}</div>
        <div class="equip-slot-vazio-texto">Vazio</div>
      </div>`;
  }
  const cor = RARITY_COLORS[item.raridade] || "#888";
  return `
    <div class="equip-slot preenchido" data-slot="${slot}" style="border-color:${cor}">
      <span class="icon-frame" style="border-color:${cor}"><img src="assets/icons/${item.icone}.png" /></span>
      <div class="equip-slot-label">${label}</div>
      <div class="equip-slot-item-nome">${item.nome}</div>
      <button data-slot="${slot}" class="btn-desequipar">Remover</button>
    </div>`;
}

// Agrupa itens idênticos (mesmo `id`) da mochila numa única pilha visual —
// a mochila em si continua guardando um objeto por unidade (cada um com seu
// próprio uid, ver InventorySystem.js), isso é só apresentação (task #39).
// Exportada (e não só usada internamente) pra dar pra testar a lógica de
// agrupamento sem precisar de DOM — ver scripts/test_inventory_ui.mjs.
export function empilharInventario(inventario) {
  const pilhas = new Map();
  inventario.forEach((item) => {
    if (!pilhas.has(item.id)) pilhas.set(item.id, { item, uids: [] });
    pilhas.get(item.id).uids.push(item.uid);
  });
  return [...pilhas.values()];
}

// `alvo` (pedido do jogador: equipar/curar convocados do gacha, não só o
// personagem principal) — a mochila, o ouro e a compra/venda continuam
// sempre do `personagem` (dono do estoque compartilhado do time, ver
// InventorySystem.js), mas os slots de equipamento mostrados/editados e o
// alvo do botão "Usar" (consumível) são de `alvo`. Sem passar `alvo`, é
// exatamente a tela de sempre (equipar/curar a si mesmo) — chamada em
// onHudAction("inventario") em main.js. Com `alvo` diferente (chamada nova
// em GachaUI.js, botão "🎒 Equipar/Curar" de cada convocado), vira a tela
// de gerenciar aquele convocado usando os itens do personagem principal.
// `aoVoltar` (opcional): quando a tela é aberta de dentro de outra tela
// (ver botão "🎒 Equipar/Curar" na aba Time, GachaUI.js), mostra um botão
// "← Voltar" que chama esse callback em vez de só fechar tudo — mesmo
// padrão já usado por montarDespertar/montarVinculo (AwakeningUI.js/
// BondUI.js) pra voltar à Coleção.
export function montarInventario(personagem, onMudar, alvo = personagem, aoVoltar = null) {
  const ehOutroAlvo = alvo !== personagem;
  const corpo = abrirModalBase(ehOutroAlvo ? `Inventário — ${alvo.nome}` : "Inventário");

  if (aoVoltar) {
    const btnVoltar = document.createElement("button");
    btnVoltar.textContent = "← Voltar ao Time";
    btnVoltar.style.cssText = "margin-bottom:8px;";
    btnVoltar.onclick = aoVoltar;
    corpo.appendChild(btnVoltar);
  }

  const equipDiv = document.createElement("div");
  equipDiv.innerHTML = ehOutroAlvo ? `<h3>Equipado em ${alvo.nome}</h3>` : "<h3>Equipado</h3>";
  const gridEquip = document.createElement("div");
  gridEquip.className = "equip-slots-grid";
  gridEquip.innerHTML = SLOTS_EQUIPAMENTO.map((s) => slotEquipadoHTML(s, alvo.equipamento[s.slot])).join("");
  equipDiv.appendChild(gridEquip);
  corpo.appendChild(equipDiv);

  // Conjuntos de equipamento (melhoria pós-backlog, ver SetBonusSystem.js):
  // mostra o progresso de cada conjunto com pelo menos 1 peça equipada, pra
  // o jogador saber que vestir peças combinando dá um bônus extra.
  const conjuntosAtivos = conjuntosParaExibir(alvo);
  if (conjuntosAtivos.length) {
    const conjDiv = document.createElement("div");
    conjDiv.innerHTML = "<h3>Conjuntos</h3>";
    conjuntosAtivos.forEach((c) => {
      const p = document.createElement("p");
      p.className = "desc conjunto-resumo" + (c.tiersAtivos > 0 ? " conjunto-ativo" : "");
      const statusTexto = c.proximoTierEm
        ? `${c.equipadas}/${c.total} peças — vista mais ${c.proximoTierEm - c.equipadas} pra ativar o próximo bônus`
        : `${c.equipadas}/${c.total} peças — todos os bônus ativos!`;
      p.textContent = `${c.nome}: ${statusTexto}`;
      conjDiv.appendChild(p);
    });
    corpo.appendChild(conjDiv);
  }

  const invDiv = document.createElement("div");
  invDiv.innerHTML = "<h3>Mochila</h3>";
  if (personagem.inventario.length === 0) invDiv.innerHTML += "<p>Vazia.</p>";
  const pilhas = empilharInventario(personagem.inventario);
  pilhas.forEach(({ item, uids }) => {
    const qtd = uids.length;
    const primeiroUid = uids[0];
    let botoes = "";
    if (item.tipo === "arma" || item.tipo === "armadura" || item.tipo === "acessorio") {
      botoes = `<button data-uid="${primeiroUid}" class="btn-equipar">${ehOutroAlvo ? `Equipar em ${alvo.nome}` : "Equipar"}</button>`;
    } else if (item.tipo === "consumivel") {
      botoes = `<button data-uid="${primeiroUid}" class="btn-usar">${ehOutroAlvo ? `Usar em ${alvo.nome}` : "Usar"}</button>`;
    }
    const precoUnitario = Math.max(1, Math.round((item.valor || 1) * 0.5));
    botoes += ` <button data-uid="${primeiroUid}" class="btn-vender">Vender (${precoUnitario}o)</button>`;
    if (qtd > 1) {
      botoes += ` <button data-id="${item.id}" class="btn-vender-tudo">Vender Tudo (x${qtd}, ${precoUnitario * qtd}o)</button>`;
    }
    const nomeComQtd = qtd > 1 ? `${item.nome} <span class="stack-badge">x${qtd}</span>` : item.nome;
    const div = document.createElement("div");
    div.innerHTML = itemCardHTML({ ...item, nome: nomeComQtd }, botoes);
    // Comparação equipado x candidato (melhoria de jogabilidade #16): só pra
    // itens equipáveis com algo já equipado no mesmo slot pra comparar.
    const comparacaoHTML = comparacaoEquipamentoHTML(item, alvo);
    if (comparacaoHTML) div.innerHTML += comparacaoHTML;
    invDiv.appendChild(div);
  });
  corpo.appendChild(invDiv);

  corpo.querySelectorAll(".btn-equipar").forEach((b) => b.onclick = () => {
    equiparItem(personagem, b.dataset.uid, alvo);
    onMudar(); montarInventario(personagem, onMudar, alvo, aoVoltar);
  });
  corpo.querySelectorAll(".btn-desequipar").forEach((b) => b.onclick = () => {
    desequiparItem(personagem, b.dataset.slot, alvo);
    onMudar(); montarInventario(personagem, onMudar, alvo, aoVoltar);
  });
  corpo.querySelectorAll(".btn-usar").forEach((b) => b.onclick = () => {
    const r = usarConsumivel(personagem, b.dataset.uid, alvo);
    if (r.msg) mostrarMensagem(r.msg);
    onMudar(); montarInventario(personagem, onMudar, alvo, aoVoltar);
  });
  corpo.querySelectorAll(".btn-vender").forEach((b) => b.onclick = () => {
    const valor = venderItem(personagem, b.dataset.uid);
    mostrarMensagem(`Vendido por ${valor} de ouro.`);
    onMudar(); montarInventario(personagem, onMudar, alvo, aoVoltar);
  });
  corpo.querySelectorAll(".btn-vender-tudo").forEach((b) => b.onclick = () => {
    const pilha = pilhas.find((p) => p.item.id === b.dataset.id);
    let total = 0;
    if (pilha) pilha.uids.forEach((uid) => { total += venderItem(personagem, uid); });
    mostrarMensagem(`Vendidos ${pilha ? pilha.uids.length : 0} itens por ${total} de ouro no total.`);
    onMudar(); montarInventario(personagem, onMudar, alvo, aoVoltar);
  });
}

// Missões diárias leves (melhoria de jogabilidade pós-backlog original, ver
// DailyQuestSystem.js): sempre os mesmos 3 objetivos, resetam sozinhos a
// cada dia. Fica no topo da tela de Missões, separado das missões de NPC —
// não precisa aceitar nada, o progresso já conta sozinho a partir do
// momento em que o personagem existe.
function montarMissoesDiarias(corpo, personagem, onMudar) {
  const bloco = document.createElement("div");
  bloco.innerHTML = "<h3>📅 Missões Diárias</h3><p class=\"desc\">Resetam todo dia. Progresso conta sozinho enquanto você joga normalmente.</p>";
  missoesDiariasParaExibir(personagem).forEach(({ template, atual, meta, concluida, coletada }) => {
    const div = document.createElement("div");
    div.className = "card";
    const statusTxt = coletada
      ? "Recompensa já resgatada hoje. ✅"
      : `Progresso: ${atual}/${meta}${concluida ? " — pronta pra resgatar!" : ""}`;
    div.innerHTML = `<div class="info"><div class="nome">${template.icone} ${template.nome}</div>
        <div class="desc">${template.descricao}</div>
        <div class="desc">${statusTxt} · Recompensa: ${template.recompensaOuro}o + ${template.recompensaFragmentos} Fragmentos</div></div>
      <div><button ${concluida && !coletada ? "" : "disabled"} data-id="${template.id}" class="btn-resgatar-diaria">Resgatar</button></div>`;
    bloco.appendChild(div);
  });
  corpo.appendChild(bloco);
  bloco.querySelectorAll(".btn-resgatar-diaria").forEach((b) => b.onclick = () => {
    const res = coletarRecompensaDiaria(personagem, b.dataset.id);
    if (res.ok) {
      if (res.fragmentos) adicionarFragmentos(personagem, res.fragmentos);
      mostrarMensagem(`Recompensa diária resgatada: +${res.ouro} ouro, +${res.fragmentos} Fragmentos de Aethra!`);
    } else {
      mostrarMensagem(res.msg);
    }
    onMudar();
  });
}

export function montarMissoes(personagem, dados) {
  const corpo = abrirModalBase("Missões");
  montarMissoesDiarias(corpo, personagem, () => montarMissoes(personagem, dados));
  const hSeparador = document.createElement("h3");
  hSeparador.textContent = "Missões de NPCs";
  corpo.appendChild(hSeparador);
  if (personagem.missoesAtivas.length === 0 && personagem.missoesConcluidas.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Nenhuma missão aceita ainda. Converse com os NPCs da vila!";
    corpo.appendChild(p);
    return;
  }
  personagem.missoesAtivas.forEach((m) => {
    const def = dados.quests.find((q) => q.id === m.id);
    const meta = def.quantidade || 1;
    const pronto = missaoPronta(personagem, def);
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">${def.nome} ${pronto ? "✅" : ""}</div>
      <div class="desc">${def.descricao}</div>
      <div class="desc">Progresso: ${m.progresso}/${meta}</div></div>`;
    corpo.appendChild(div);
  });
  if (personagem.missoesConcluidas.length) {
    const h = document.createElement("h3");
    h.textContent = "Concluídas";
    corpo.appendChild(h);
    personagem.missoesConcluidas.forEach((id) => {
      const def = dados.quests.find((q) => q.id === id);
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<div class="info"><div class="nome">${def.nome}</div></div>`;
      corpo.appendChild(div);
    });
  }
}

// Aprimoramento de equipamento (melhoria de jogabilidade pós-backlog
// original, ver EnchantSystem.js): lista todo item aprimorável — equipado
// OU ainda na mochila — com o custo do próximo nível e um botão pra gastar.
// Reaproveita o mesmo `uid` usado por equipar/desequipar/vender, então
// funciona nos dois lugares sem duplicar lógica de busca.
function itensAprimoraveis(personagem) {
  const equipados = Object.values(personagem.equipamento).filter(Boolean);
  const daMochila = personagem.inventario.filter(itemPodeSerAprimorado);
  return [...equipados, ...daMochila].filter(itemPodeSerAprimorado);
}

function custoTextoAprimoramento(custo, dados) {
  const materiaisTxt = custo.materiais.map((m) => {
    const item = dados.items.itens.find((x) => x.id === m.itemId);
    return `${item ? item.nome : m.itemId} x${m.quantidade}`;
  }).join(", ");
  return `${custo.ouro}o + ${materiaisTxt}`;
}

function montarAprimoramento(corpo, personagem, dados, onMudar) {
  const bloco = document.createElement("div");
  bloco.innerHTML = "<h3>⚒️ Aprimorar Equipamento</h3><p class=\"desc\">Gasta ouro e materiais pra fortalecer um item que você já tem, em vez de descartá-lo por um melhor. Máximo +" + MAX_NIVEL_APRIMORAMENTO + ".</p>";
  const itens = itensAprimoraveis(personagem);
  if (!itens.length) {
    bloco.innerHTML += "<p>Nenhum item aprimorável equipado ou na mochila.</p>";
  }
  itens.forEach((item) => {
    const nivel = nivelAprimoramento(item);
    const custo = custoProximoNivel(item);
    const check = podeAprimorar(personagem, item);
    const div = document.createElement("div");
    div.className = "card";
    const statusTxt = custo
      ? `Nível +${nivel} → +${nivel + 1} · Custo: ${custoTextoAprimoramento(custo, dados)}`
      : `Nível máximo (+${MAX_NIVEL_APRIMORAMENTO}) atingido.`;
    div.innerHTML = `<div class="info"><div class="nome">${item.nome}</div><div class="desc">${statusTxt}</div></div>
      <div><button ${check.ok ? "" : "disabled"} title="${!check.ok ? check.msg : ""}" data-uid="${item.uid}" class="btn-aprimorar">Aprimorar</button></div>`;
    bloco.appendChild(div);
  });
  corpo.appendChild(bloco);
  bloco.querySelectorAll(".btn-aprimorar").forEach((b) => b.onclick = () => {
    const res = aprimorarItem(personagem, b.dataset.uid);
    if (res.ok) mostrarMensagem(`${res.item.nome} aprimorado!`);
    else mostrarMensagem(res.msg);
    onMudar(); montarForja(personagem, dados, onMudar);
  });
}

export function montarForja(personagem, dados, onMudar) {
  const corpo = abrirModalBase("Forja & Alquimia");
  const receitasBloco = document.createElement("div");
  receitasBloco.innerHTML = "<h3>🔨 Receitas</h3>";
  if (dados.recipes.length === 0) receitasBloco.innerHTML += "<p>Nenhuma receita conhecida.</p>";
  dados.recipes.forEach((r) => {
    const disponivel = receitaDisponivel(personagem, r);
    const ingredientesTxt = r.ingredientes.map((i) => {
      const item = dados.items.itens.find((x) => x.id === i.itemId);
      return `${item ? item.nome : i.itemId} x${i.quantidade}`;
    }).join(", ");
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">${r.nome}</div><div class="desc">Requer: ${ingredientesTxt}</div></div>
      <div><button ${disponivel ? "" : "disabled"} data-id="${r.id}" class="btn-craft">Criar</button></div>`;
    receitasBloco.appendChild(div);
  });
  corpo.appendChild(receitasBloco);
  corpo.querySelectorAll(".btn-craft").forEach((b) => b.onclick = () => {
    const receita = dados.recipes.find((r) => r.id === b.dataset.id);
    const res = craftar(personagem, receita, dados.items.itens);
    if (res.ok) mostrarMensagem(`Você criou: ${res.item.nome}!`);
    onMudar(); montarForja(personagem, dados, onMudar);
  });

  montarAprimoramento(corpo, personagem, dados, onMudar);
}

// Viagem rápida (melhoria de jogabilidade pós-backlog original, ver
// FastTravelSystem.js): lista toda zona do mundo aberto já visitada
// (`ZONAS`, a lista completa, vem de worldMap.js — filtra aqui em vez de
// receber já filtrada pra poder mostrar as zonas ainda não exploradas como
// bloqueadas "???" em vez de simplesmente omiti-las, dando ao jogador uma
// noção de quanto do mapa falta visitar). `zonaAtualId` desabilita o botão
// da zona onde o personagem já está.
export function montarViagemRapida(personagem, ZONAS, zonaAtualId, onViajar) {
  const corpo = abrirModalBase("🧭 Viagem Rápida");
  const intro = document.createElement("p");
  intro.className = "desc";
  intro.textContent = "Teleporte instantâneo para qualquer zona do mundo aberto que você já visitou.";
  corpo.appendChild(intro);

  ZONAS.forEach((zona) => {
    const visitada = zonaFoiVisitada(personagem, zona.id);
    const div = document.createElement("div");
    div.className = "card";
    if (!visitada) {
      div.innerHTML = `<div class="info"><div class="nome">??? </div><div class="desc">Zona ainda não explorada.</div></div>`;
      corpo.appendChild(div);
      return;
    }
    const aqui = zona.id === zonaAtualId;
    div.innerHTML = `<div class="info"><div class="nome">${zona.nome}${aqui ? " (você está aqui)" : ""}</div><div class="desc">${zona.descricao || ""}</div></div>
      <div><button ${aqui ? "disabled" : ""} data-id="${zona.id}" class="btn-viajar">Viajar</button></div>`;
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-viajar").forEach((b) => b.onclick = () => onViajar(b.dataset.id));
}

export function montarLoja(personagem, dados, onMudar) {
  // Reputação com a vila (mundo reativo, ver WorldStateSystem.js) muda o
  // preço de tudo na loja: quem ajudou a vila paga menos, quem é malvisto
  // paga mais — uma consequência tangível e recorrente das escolhas do
  // jogador, não só um texto de sabor.
  const multPreco = multiplicadorPrecoLoja(personagem, dados.worldStateVariables);
  const tierAtual = tierDaReputacao(getReputacao(personagem, "vila"), dados.worldStateVariables);
  const tituloDesconto = multPreco !== 1 ? ` (${multPreco < 1 ? "-" : "+"}${Math.abs(Math.round((1 - multPreco) * 100))}% por reputação: ${tierAtual ? tierAtual.nome : ""})` : "";
  const corpo = abrirModalBase(`Mercador — Seu ouro: ${personagem.ouro}${tituloDesconto}`);
  const catalogo = dados.items.itens.filter((i) => i.raridade === "comum" || i.raridade === "incomum").slice(0, 24);
  catalogo.forEach((item) => {
    const precoFinal = Math.max(1, Math.round(item.valor * multPreco));
    const div = document.createElement("div");
    div.innerHTML = itemCardHTML(item, `<button data-id="${item.id}" class="btn-comprar">Comprar (${precoFinal}o)</button>`);
    corpo.appendChild(div);
  });
  corpo.querySelectorAll(".btn-comprar").forEach((b) => b.onclick = () => {
    const item = dados.items.itens.find((i) => i.id === b.dataset.id);
    const r = comprarItem(personagem, item, multPreco);
    if (!r.ok) mostrarMensagem(r.msg);
    else mostrarMensagem(`Comprou: ${item.nome} (${r.preco}o)!`);
    onMudar(); montarLoja(personagem, dados, onMudar);
  });
}

// Ganhos de reputação com a facção "vila" — pequenos e nunca negativos, pra
// recompensar ajudar sem punir o jogador por simplesmente jogar (ver
// princípio de design: consequências viram novas rotas/benefícios, não
// bloqueios).
const REPUTACAO_POR_TESTE_SUCESSO = 3;
const REPUTACAO_POR_MISSAO = 5;

export function montarDialogo(npc, dados, personagem, onMudar) {
  const corpo = abrirModalBase(npc.nome);
  const p = document.createElement("p");
  p.textContent = npc.dialogo;
  corpo.appendChild(p);

  // Mundo reativo: a reputação com a vila muda a saudação de cada NPC — uma
  // consequência visível, recorrente, das missões e testes de perícia que o
  // jogador já resolveu (ver WorldStateSystem.js).
  const tierRep = tierDaReputacao(getReputacao(personagem, "vila"), dados.worldStateVariables);
  if (tierRep && tierRep.saudacao) {
    const saud = document.createElement("p");
    saud.style.cssText = "opacity:0.85;font-style:italic;";
    saud.textContent = `"${tierRep.saudacao}" (Reputação: ${tierRep.nome})`;
    corpo.appendChild(saud);
  }

  if (npc.id === "npc_mercador") {
    const btn = document.createElement("button");
    btn.className = "primario";
    btn.textContent = "Ver itens à venda";
    btn.onclick = () => montarLoja(personagem, dados, onMudar);
    corpo.appendChild(btn);
    return;
  }

  // Testes de perícia (d20) oferecidos por este NPC — ver skillChecks.json.
  // Cada um pode ser tentado uma única vez por personagem quando marcado
  // como "unicoPorPersonagem", pra não virar uma fonte infinita de ouro.
  const testes = testesDoContexto(dados.skillChecks, "npc", { npcId: npc.id })
    .filter((t) => !t.unicoPorPersonagem || !testeJaFeito(personagem, t.id));
  testes.forEach((teste) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">🎲 ${teste.pericia}</div><div class="desc">${teste.textoOferta}</div></div>
      <div><button class="btn-teste-pericia" data-id="${teste.id}">Tentar</button></div>`;
    corpo.appendChild(div);
  });
  corpo.querySelectorAll(".btn-teste-pericia").forEach((b) => b.onclick = () => {
    const teste = testes.find((t) => t.id === b.dataset.id);
    const r = realizarTeste(personagem, dados, teste);
    if (teste.unicoPorPersonagem) marcarTesteFeito(personagem, teste.id);
    const rolagemTxt = `[d20: ${r.d}${r.modAtributo ? ` +${r.modAtributo} atributo` : ""}${r.proficiente ? ` +${r.bonusPericia} perícia` : ""} = ${r.total} vs. DC ${r.dificuldade}]`;
    if (r.sucesso) {
      if (teste.recompensaOuroSucesso) personagem.ouro += teste.recompensaOuroSucesso;
      alterarReputacao(personagem, "vila", REPUTACAO_POR_TESTE_SUCESSO, dados.worldStateVariables);
      mostrarMensagem(`✅ Sucesso! ${teste.textoSucesso} ${rolagemTxt}${teste.recompensaOuroSucesso ? ` (+${teste.recompensaOuroSucesso} ouro)` : ""} (+${REPUTACAO_POR_TESTE_SUCESSO} reputação)`, 4200);
      registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: teste.textoSucesso });
    } else {
      mostrarMensagem(`❌ Falha. ${teste.textoFalha} ${rolagemTxt}`, 4200);
      registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: teste.textoFalha });
    }
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar);
  });

  const quests = dados.quests.filter((q) => q.npcId === npc.id);
  quests.forEach((q) => {
    const jaAtiva = personagem.missoesAtivas.some((m) => m.id === q.id);
    const jaConcluida = personagem.missoesConcluidas.includes(q.id);
    const div = document.createElement("div");
    div.className = "card";
    if (jaConcluida) {
      div.innerHTML = `<div class="info"><div class="nome">${q.nome} (concluída)</div></div>`;
    } else if (jaAtiva) {
      const pronto = missaoPronta(personagem, q);
      div.innerHTML = `<div class="info"><div class="nome">${q.nome}</div><div class="desc">${q.descricao}</div></div>
        <div><button ${pronto ? "" : "disabled"} class="btn-entregar" data-id="${q.id}">${pronto ? "Entregar" : "Em progresso"}</button></div>`;
    } else {
      div.innerHTML = `<div class="info"><div class="nome">${q.nome}</div><div class="desc">${q.descricao}</div>
        <div class="desc">Recompensa: ${q.recompensaOuro} ouro, ${q.recompensaXP} XP</div></div>
        <div><button class="btn-aceitar" data-id="${q.id}">Aceitar</button></div>`;
    }
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-aceitar").forEach((b) => b.onclick = () => {
    const q = dados.quests.find((x) => x.id === b.dataset.id);
    iniciarMissao(personagem, q);
    mostrarMensagem(`Missão aceita: ${q.nome}`);
    montarDialogo(npc, dados, personagem, onMudar);
  });
  corpo.querySelectorAll(".btn-entregar").forEach((b) => b.onclick = () => {
    const q = dados.quests.find((x) => x.id === b.dataset.id);
    const r = concluirMissao(personagem, q, dados.items.itens);
    if (r.ok) {
      if (r.item) {
        personagem.inventario.push({ ...r.item, uid: cryptoId() });
      }
      const { subiuNivel } = ganharXP(personagem, r.xp);
      subiuNivel.forEach(() => aplicarCrescimento(personagem, dados));
      if (r.fragmentos) adicionarFragmentos(personagem, r.fragmentos);
      checarConquistas(personagem, {});
      alterarReputacao(personagem, "vila", REPUTACAO_POR_MISSAO, dados.worldStateVariables);
      let msg = `Missão concluída! +${r.ouro} ouro, +${r.xp} XP${r.fragmentos ? `, +${r.fragmentos} Fragmentos de Aethra` : ""}${r.item ? `, item: ${r.item.nome}` : ""} (+${REPUTACAO_POR_MISSAO} reputação com a vila)`;
      if (escolhaPendente(personagem, dados)) msg += " · 🌟 Nova escolha de habilidade disponível (T)!";
      mostrarMensagem(msg);
    }
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar);
  });
}
