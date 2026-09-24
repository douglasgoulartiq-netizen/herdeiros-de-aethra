// TELA DA PARTY — mochila do grupo e equipamento de todo mundo num lugar só.
//
// POR QUE ELA EXISTE
// ------------------
// O motor já era unificado e a interface é que não era. `personagem.inventario`
// SEMPRE foi uma mochila só do grupo inteiro, e `equiparItem(personagem, uid,
// alvo)` sempre aceitou equipar em qualquer membro. O que faltava era a tela:
// para vestir um convocado era preciso abrir Invocação → Coleção → achar o
// card → "🎒 Equipar/Curar" → e aí sim cair no inventário, já filtrado num
// personagem só. Comparar duas espadas entre dois membros exigia entrar e
// sair dessa trilha duas vezes, de cabeça.
//
// Aqui tudo fica na mesma tela:
//   • em cima, a FILEIRA DA PARTY — retrato, vida, e os 7 slots de cada um;
//   • embaixo, a MOCHILA COMPARTILHADA, com busca e filtro;
//   • ao escolher um item, um painel diz em quem ele cabe e o que muda em
//     CADA membro — e equipa em um clique, sem sair daqui.
//
// Nada de sistema novo: esta tela só lê e chama o que já existia. Por isso
// ela não pode quebrar save nem balanceamento.
import { caminhoDoIcone } from "../data/itemIcons.js";
import {
  abrirTela, LARGURA, criarGrade, ehMobile,
} from "./HdaUI.js";
import {
  SLOTS_EQUIPAMENTO, empilharInventario, criarLadrilhoItem, mostrarMensagem,
} from "./GameUI.js";
import { ligarTooltips } from "./Tooltip.js";
// Montar o time (quem entra, quem fica na frente) morava dentro da tela de
// Invocação. É o assunto DESTA tela, não daquela: aqui o jogador já está
// olhando o grupo. GachaUI.js continua dono do desenho porque conhece o
// estado do gacha; esta tela só o hospeda.
import { montarSelecaoDeTime } from "./GachaUI.js";
import { planejarEquipamento, aplicarPlanoEquipamento, poderDeCombate, LABEL_SLOT } from "../systems/AutoEquipSystem.js";
import { relacaoElemental, infoElemento } from "../systems/ElementSystem.js";
import { habilidadesEquipadas, habilidadesNaReserva } from "../systems/LoadoutSystem.js";
import { passivasDe } from "../systems/PassiveSystem.js";
import { marcasDe } from "../systems/RecursoClasseSystem.js";
import { equiparItem, desequiparItem, usarConsumivel, venderItem, RARITY_COLORS, RARITY_LABEL } from "../systems/InventorySystem.js";
import { imgHtml, ligarCadeias } from "../systems/AssetResolver.js";
import { USOS } from "../data/assetRegistry.js";
import { descreverEfeitos } from "../systems/ItemEffectSystem.js";
import { textoRequisito, penalidadeDe } from "../systems/RequisitoSystem.js";
import { somConfirmar, somBloqueioOuErro } from "./SoundFX.js";

// Qual slot um item ocupa. O InventorySystem tem a regra canônica, mas ela
// não é exportada; esta é a mesma tabela, e o teste test-party-ui.mjs
// confere que as duas concordam para todo item do jogo.
const SLOT_POR_SUBTIPO = {
  arma: "arma", espada: "arma", machado: "arma", arco: "arma", cajado: "arma", adaga: "arma",
  peito: "peito", torso: "peito", armadura: "peito",
  cabeca: "cabeca", elmo: "cabeca",
  pes: "pes", bota: "pes",
  escudo: "escudo",
  anel: "anel",
  amuleto: "amuleto", colar: "amuleto",
};

export function slotDoItem(item) {
  if (!item) return null;
  if (item.slot && SLOT_POR_SUBTIPO[item.slot]) return SLOT_POR_SUBTIPO[item.slot];
  if (SLOT_POR_SUBTIPO[item.subtipo]) return SLOT_POR_SUBTIPO[item.subtipo];
  if (item.tipo === "arma") return "arma";
  if (item.tipo === "armadura") return SLOT_POR_SUBTIPO[item.subtipo] || "peito";
  if (item.tipo === "acessorio") return SLOT_POR_SUBTIPO[item.subtipo] || "anel";
  return null;
}

// Soma do que um item entrega. Serve para o "+3 / −1" da comparação: número
// seco, sem opinião.
//
// Os nomes dos campos vêm do items.json de verdade — `dano`, `danoMagico`,
// `defesa`, `bonusAtributo`, `bonusCritico`, `bonusVelocidade`, `bonusCura`.
// A primeira versão somava `ataque`/`magia`/`hpMax`, que NÃO existem em
// nenhum item do jogo: toda comparação dava 0 e a tela mostrava "=" para
// tudo, inclusive comparando uma Espada Enferrujada com um slot vazio.
// A captura de tela pegou. O teste test-party-ui.mjs agora trava isso.
const CAMPOS_DE_PODER = [
  "dano", "danoMagico", "defesa",
  "bonusAtributo", "bonusCritico", "bonusVelocidade", "bonusCura",
];

export function poderDoItem(item) {
  if (!item) return 0;
  return CAMPOS_DE_PODER.reduce((s, k) => s + (Number(item[k]) || 0), 0);
}

// --- FICHA DO PERSONAGEM (aba Time) ---------------------------------------
//
// Pedido: "quando se clicar em um personagem abra as opções deles que mostra
// as habilidades, descrição elementos fraquezas tudo isso de forma
// simplificada". A informação já existia espalhada — habilidades na árvore,
// elemento no combate, passivas no PassiveSystem — mas em nenhum lugar
// alguém via o personagem INTEIRO de uma vez.

const RELACAO_ROTULO = {
  vantagem_intensa: { texto: "muito eficaz contra", cor: "#4ecb71" },
  vantagem: { texto: "eficaz contra", cor: "#8fe08f" },
  resistencia: { texto: "fraco contra", cor: "#ffb37a" },
  resistencia_intensa: { texto: "muito fraco contra", cor: "#ff8a8a" },
  imune: { texto: "não afeta", cor: "#ff6b6b" },
};

// Forças e fraquezas do elemento do personagem, lidas da MATRIZ do jogo — não
// de uma tabela escrita à mão aqui, que sairia de sincronia no dia em que a
// matriz mudasse.
export function relacoesDoElemento(elementoId, dados) {
  const todos = ((dados && dados.elements && dados.elements.elementos) || []).map((e) => e.id);
  const forte = [];
  const fraco = [];
  for (const outro of todos) {
    if (outro === elementoId) continue;
    const atacando = relacaoElemental(elementoId, outro, dados.elements);
    if (atacando === "vantagem" || atacando === "vantagem_intensa") forte.push({ id: outro, relacao: atacando });
    // Fraqueza é o que ELE sofre: o quanto o outro elemento é bom contra ele.
    const sofrendo = relacaoElemental(outro, elementoId, dados.elements);
    if (sofrendo === "vantagem" || sofrendo === "vantagem_intensa") fraco.push({ id: outro, relacao: sofrendo });
  }
  return { forte, fraco };
}

function barra(atual, max, classe) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((atual / max) * 100))) : 0;
  const rotulo = classe === "hp" ? "Pontos de vida" : "Pontos de magia";
  return `<span class="party-barra ${classe}" role="progressbar" aria-label="${rotulo}" aria-valuemin="0" aria-valuemax="${Math.max(0, max || 0)}" aria-valuenow="${Math.max(0, atual || 0)}" aria-valuetext="${Math.max(0, atual || 0)} de ${Math.max(0, max || 0)}"><i style="width:${pct}%"></i></span>`;
}

// ---------------------------------------------------------------------------

export function montarParty(personagem, time, dados, onMudar, estadoAnterior = null) {
  const membros = [personagem, ...(time || []), ...(estadoAnterior?.aba === "ficha" ? personagem.gacha?.personagensObtidos || [] : [])]
    .filter((m, i, todos) => m && todos.findIndex((outro) => outro === m || (m.uid && outro?.uid === m.uid)) === i);
  const interfaceToque = ehMobile() || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
  const estado = estadoAnterior || {
    membroIdx: 0,
    filtro: "todos",
    busca: "",
    uidSelecionado: null,
    aba: "mochila",
  };
  if (!estado.aba) estado.aba = "mochila";
  if (!estado.limiteItens) estado.limiteItens = interfaceToque ? 6 : 18;
  if (estado.membroIdx >= membros.length) estado.membroIdx = 0;
  const ativo = membros[estado.membroIdx];

  const tela = abrirTela({
    titulo: "Companhia",
    subtitulo: `🪙 ${personagem.ouro} · 🎒 ${personagem.inventario.length} itens`,
    largura: LARGURA.larga,
    classe: "tela-party",
  });
  const corpo = tela.corpo;
  tela.raiz.dataset.companhiaAba = estado.aba;
  const abaRenderizada = estado.aba;
  estado.rolagens ||= {};
  corpo.addEventListener("scroll", () => { estado.rolagens[abaRenderizada] = corpo.scrollTop; }, { passive: true });
  requestAnimationFrame(() => {
    if (corpo.isConnected) corpo.scrollTop = estado.rolagens[abaRenderizada] || 0;
  });
  corpo.classList.add("companhia-corpo");
  const redesenhar = () => montarParty(personagem, time, dados, onMudar, estado);

  // ---- 1. FILEIRA DA PARTY ------------------------------------------------
  // Um cartão por membro: retrato, vida, éter e os sete slots. Os slots ficam
  // visíveis SEM clicar em ninguém — é isso que permite comparar o grupo de
  // relance, que era exatamente o que a trilha antiga impedia.
  const fileira = document.createElement("div");
  fileira.className = "party-fileira";
  fileira.innerHTML = membros.map((m, i) => {
    const ehAtivo = i === estado.membroIdx;
    const cor = RARITY_COLORS[m.raridade] || "#8a7a4a";
    const alvoRetrato = m.rosterId
      ? { rosterId: m.rosterId }
      : { racaId: m.racaId, classeId: m.classeId };
    const slots = SLOTS_EQUIPAMENTO.map((sl) => {
      const it = m.equipamento && m.equipamento[sl.slot];
      return `<span class="party-slot${it ? " cheio" : " vazio"}" data-membro="${i}" data-slot="${sl.slot}"
        ${it ? `role="button" tabindex="0" aria-label="Desequipar ${it.nome} de ${m.nome}"` : `aria-hidden="true"`}
        title="${sl.label}: ${it ? it.nome : "vazio"}${it ? " — clique para desequipar" : ""}"
        style="${it ? `border-color:${RARITY_COLORS[it.raridade] || "#6b5a3a"}` : ""}">${it ? sl.icone : "·"}</span>`;
    }).join("");
    return `
      <div class="party-card${ehAtivo ? " ativo" : ""}" data-membro="${i}" tabindex="${ehAtivo ? "0" : "-1"}"
           role="radio" aria-checked="${ehAtivo}" aria-label="${m.nome}, nível ${m.nivel || 1}${ehAtivo ? ", selecionado" : ""}"
           title="${m.nome} — clique para escolher">
        <div class="party-retrato" style="border-color:${cor}">
          ${imgHtml(alvoRetrato, USOS.RETRATO, { alt: m.nome })}
          <span class="gacha-retrato-vazio asset-vazio" style="display:none;">?</span>
        </div>
        <div class="party-nome">${m.nome}</div>
        <div class="party-nivel">Nv. ${m.nivel || 1}${m === personagem ? " · você" : ""}</div>
        <div class="party-vitais">
          ${barra(m.hp, m.hpMax, "hp")}<small>${m.hp}/${m.hpMax}</small>
          ${barra(m.mp, m.mpMax, "mp")}<small>${m.mp}/${m.mpMax}</small>
        </div>
        <div class="party-slots">${slots}</div>
      </div>`;
  }).join("");
  const palcoCompanhia = document.createElement("section");
  palcoCompanhia.className = "companhia-palco";
  const trilhoCompanhia = document.createElement("aside");
  trilhoCompanhia.className = "companhia-trilho";
  trilhoCompanhia.setAttribute("aria-label", estado.aba === "ficha" ? "Heróis da companhia" : "Membros da formação ativa");
  fileira.setAttribute("role", "radiogroup");
  trilhoCompanhia.innerHTML = `<small>${estado.aba === "ficha" ? "HERÓIS" : "FORMAÇÃO ATIVA"}</small>`;
  trilhoCompanhia.appendChild(fileira);

  const elementoAtivo = ativo.elementoId || ativo.elemento || ativo.equipamento?.arma?.elemento || "fisico";
  const infoAtivo = infoElemento(elementoAtivo, dados.elements) || { nome: elementoAtivo, icone: "◆", cor: "#c9c9c9" };
  const poderAtivo = Math.min(250, Math.max(0, Math.round(poderDeCombate(ativo, dados))));
  const alvoArte = ativo.rosterId ? { rosterId: ativo.rosterId } : { racaId: ativo.racaId, classeId: ativo.classeId };
  const vitrineCompanhia = document.createElement("div");
  vitrineCompanhia.className = "companhia-vitrine";
  vitrineCompanhia.style.setProperty("--companhia-cor", infoAtivo.cor || "#d8b56f");
  vitrineCompanhia.innerHTML = `
    <div class="companhia-arte">
      ${imgHtml(alvoArte, USOS.COMBATE, { alt: ativo.nome, classe: "companhia-sprite", lazy: false })}
      <span class="companhia-arte-vazia asset-vazio">◆</span>
    </div>
    <div class="companhia-identidade">
      <small>${ativo === personagem ? "HERDEIRO" : "ALIADO CONVOCADO"}</small>
      <h3>${ativo.nome}</h3>
      <p>${ativo.classeNome || ativo.classeId || "Aventureiro"}${ativo.racaNome ? ` · ${ativo.racaNome}` : ""} · Nível ${ativo.nivel || 1}</p>
      <div class="companhia-selos">
        <span style="--selo-cor:${infoAtivo.cor || "#c9c9c9"}">${infoAtivo.icone} ${infoAtivo.nome}</span>
        ${ativo.faccaoNome || ativo.faccaoId ? `<span>⚑ ${ativo.faccaoNome || ativo.faccaoId}</span>` : ""}
        ${ativo.personalidadeNome || ativo.personalidade ? `<span>✦ ${ativo.personalidadeNome || ativo.personalidade}</span>` : ""}
      </div>
      <div class="companhia-equip-slots" aria-label="Equipamento de ${ativo.nome}">
        ${SLOTS_EQUIPAMENTO.map((sl) => {
          const it = ativo.equipamento && ativo.equipamento[sl.slot];
          return `<button type="button" class="companhia-equip-slot${it ? " preenchido" : ""}" data-slot-vitrine="${sl.slot}" aria-label="${sl.label}: ${it ? it.nome : "vazio"}" title="${it ? it.nome : `Equipar ${sl.label}`}" >${sl.icone}<small>${it ? it.nome : sl.label}</small></button>`;
        }).join("")}
      </div>
    </div>
    <div class="companhia-poder">
      <small>PODER INDIVIDUAL</small><strong>${poderAtivo}</strong><span>de 250</span>
      <div class="companhia-poder-barra"><i style="width:${Math.min(100, Math.round(poderAtivo / 2.5))}%"></i></div>
      <div class="companhia-recursos"><span>♥ ${ativo.hp}/${ativo.hpMax}</span><span>◆ ${ativo.mp}/${ativo.mpMax}</span></div>
    </div>`;
  palcoCompanhia.append(trilhoCompanhia, vitrineCompanhia);
  corpo.appendChild(palcoCompanhia);
  ligarCadeias(fileira);
  ligarCadeias(vitrineCompanhia);
  vitrineCompanhia.querySelectorAll("[data-slot-vitrine]").forEach((botao) => {
    botao.onclick = () => {
      estado.aba = "mochila";
      estado.filtro = botao.dataset.slotVitrine === "arma" ? "arma" : botao.dataset.slotVitrine === "peito" || botao.dataset.slotVitrine === "cabeca" || botao.dataset.slotVitrine === "pes" ? "armadura" : "acessorio";
      redesenhar();
    };
  });

  fileira.querySelectorAll(".party-card").forEach((el) => {
    const escolher = () => { estado.membroIdx = Number(el.dataset.membro); redesenhar(); };
    el.onclick = (ev) => { if (!ev.target.closest(".party-slot")) escolher(); };
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); escolher(); } };
  });
  fileira.onkeydown = (ev) => {
    if (!ev.target.classList.contains("party-card") || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return;
    ev.preventDefault();
    const cards = [...fileira.querySelectorAll(".party-card")];
    const atual = cards.indexOf(ev.target);
    const proximo = ev.key === "Home" ? 0 : ev.key === "End" ? cards.length - 1
      : (atual + (["ArrowRight", "ArrowDown"].includes(ev.key) ? 1 : -1) + cards.length) % cards.length;
    cards[proximo]?.focus();
    cards[proximo]?.click();
  };
  // Clicar num slot cheio desequipa direto — o caminho mais curto possível.
  fileira.querySelectorAll(".party-slot.cheio").forEach((el) => {
    const desequipar = (ev) => {
      ev.stopPropagation();
      const m = membros[Number(el.dataset.membro)];
      desequiparItem(personagem, el.dataset.slot, m);
      somConfirmar();
      onMudar();
      mostrarMensagem(`Desequipado de ${m.nome}.`, 1600);
      redesenhar();
    };
    el.onclick = desequipar;
    el.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); desequipar(ev); }
    };
  });

  // ---- 1b. ABAS -----------------------------------------------------------
  // A aba Time morava dentro de Invocação (Gacha → Coleção), o que era o
  // lugar errado: "meu time" não é um assunto de invocação, é o assunto
  // desta tela. Aqui as três coisas que se faz com o grupo ficam lado a
  // lado — ver o que cada um tem, vestir, e mandar vestir sozinho.
  const ABAS = [
    { id: "ficha", rotulo: "Heróis", icone: "👤" },
    { id: "mochila", rotulo: "Equipamento", icone: "🎒" },
    { id: "time", rotulo: "Formação", icone: "🛡️" },
    ...(estado.abrirEvolucao ? [{ id: "evolucao", rotulo: "Evolução", icone: "✨" }] : []),
  ];
  tela.definirAbas(ABAS, (id) => {
    if (id === "evolucao") { estado.abrirEvolucao(); return; }
    estado.aba = id; redesenhar();
  }, estado.aba === "auto" ? "mochila" : estado.aba);
  const ferramentas = document.createElement("nav");
  ferramentas.className = "companhia-ferramentas";
  ferramentas.setAttribute("aria-label", "Ações da companhia");
  const atalhos = estado.aba === "time"
    ? [["Coleção", "colecao"], ["Companheiros", "pets"], ["Revisar equipamentos", "auto"]]
    : estado.aba === "mochila" || estado.aba === "auto"
      ? [...(estado.aba === "auto" ? [["Voltar ao equipamento", "mochila"]] : []), ["Otimizar · ver proposta", "auto"], ["Forja e Alquimia", "forja"]]
      : [["Coleção e vínculos", "colecao"]];
  for (const [rotulo, id] of atalhos) {
    const botao = document.createElement("button");
    botao.type = "button"; botao.textContent = rotulo;
    botao.onclick = () => {
      if (id === "forja") { estado.abrirForja?.(); return; }
      if (id === "colecao" || id === "pets") {
        document.dispatchEvent(new CustomEvent("hda-navegar", { detail: id })); return;
      }
      estado.aba = id; redesenhar();
    };
    if (id !== "forja" || estado.abrirForja) ferramentas.appendChild(botao);
  }
  corpo.insertBefore(ferramentas, corpo.firstChild);

  const painelMochila = document.createElement("section");
  painelMochila.className = "companhia-painel companhia-equipamento";
  painelMochila.setAttribute("aria-label", "Equipamento e mochila compartilhada");
  if (estado.aba === "mochila") corpo.appendChild(painelMochila);

  // Aba "Montar time": seleção de convocados + formação, vindas do GachaUI.
  // Ela recebe um "voltar" que reabre ESTA tela nesta aba, para quem entra em
  // Equipar/Curar por aqui não ser cuspido na tela de invocação.
  if (estado.aba === "time") {
    const painelTime = document.createElement("div");
    painelTime.className = "companhia-painel companhia-formacao";
    corpo.appendChild(painelTime);
    montarSelecaoDeTime(painelTime, personagem, dados || {}, onMudar, redesenhar);
  }

  // ---- 2. FILTRO E BUSCA --------------------------------------------------
  const barraFiltro = document.createElement("div");
  barraFiltro.className = "party-filtros";
  const CATEGORIAS = [
    { id: "todos", rotulo: "Tudo", icone: "🎒" },
    { id: "arma", rotulo: "Armas", icone: "⚔️" },
    { id: "armadura", rotulo: "Armaduras", icone: "🛡️" },
    { id: "acessorio", rotulo: "Acessórios", icone: "💍" },
    { id: "consumivel", rotulo: "Consumíveis", icone: "🧪" },
    { id: "material", rotulo: "Materiais", icone: "🪵" },
  ];
  barraFiltro.innerHTML = `
    <div class="party-cats" role="group" aria-label="Filtrar itens por categoria">
      ${CATEGORIAS.map((c) => `<button class="party-cat${estado.filtro === c.id ? " ativa" : ""}" data-cat="${c.id}" aria-pressed="${estado.filtro === c.id}">${c.icone} ${c.rotulo}</button>`).join("")}
    </div>
    <label class="party-busca-wrap"><span>Buscar na mochila</span><input class="party-busca" type="search" placeholder="Nome do item..." value="${(estado.busca || "").replace(/"/g, "&quot;")}" /></label>`;
  painelMochila.appendChild(barraFiltro);

  barraFiltro.querySelectorAll(".party-cat").forEach((b) => {
    b.onclick = () => { estado.filtro = b.dataset.cat; estado.uidSelecionado = null; redesenhar(); };
  });
  const campoBusca = barraFiltro.querySelector(".party-busca");
  campoBusca.oninput = () => {
    estado.busca = campoBusca.value;
    // Redesenhar a tela inteira a cada tecla tiraria o foco do campo. Só a
    // grade é refeita, e o cursor fica onde estava.
    const aindaVisivel = estado.uidSelecionado && pilhasVisiveis().some((p) => p.uids[0] === estado.uidSelecionado);
    if (estado.uidSelecionado && !aindaVisivel) fecharDetalhe();
    desenharGrade();
  };

  // ---- 3. MOCHILA COMPARTILHADA -------------------------------------------
  const areaGrade = document.createElement("div");
  areaGrade.className = "party-mochila";
  areaGrade.setAttribute("aria-live", "polite");
  painelMochila.appendChild(areaGrade);

  const painel = document.createElement("aside");
  painel.className = "party-detalhe";
  painel.tabIndex = -1;
  painel.setAttribute("role", "region");
  painel.setAttribute("aria-label", "Comparação do item selecionado");
  painel.setAttribute("aria-hidden", "true");
  painelMochila.appendChild(painel);

  const orientacaoDetalhe = document.createElement("div");
  orientacaoDetalhe.className = "companhia-estado-detalhe";
  orientacaoDetalhe.innerHTML = `<span aria-hidden="true">↳</span><div><strong>Escolha um item</strong><small>Veja o que muda antes de equipar, usar ou vender.</small></div>`;
  painelMochila.insertBefore(orientacaoDetalhe, painel);

  function pilhasVisiveis() {
    const busca = (estado.busca || "").trim().toLowerCase();
    return empilharInventario(personagem.inventario)
      .filter(({ item }) => estado.filtro === "todos" || item.tipo === estado.filtro)
      .filter(({ item }) => !busca || (item.nome || "").toLowerCase().includes(busca));
  }

  function desenharGrade() {
    areaGrade.innerHTML = "";
    areaGrade.setAttribute("aria-busy", "false");
    const pilhas = pilhasVisiveis();
    if (!pilhas.length) {
      const inventarioVazio = personagem.inventario.length === 0;
      const vazio = document.createElement("div");
      vazio.className = `companhia-estado companhia-estado-${inventarioVazio ? "vazio" : "sem-resultado"}`;
      vazio.setAttribute("role", "status");
      vazio.innerHTML = inventarioVazio
        ? `<span aria-hidden="true">🎒</span><strong>Mochila vazia</strong><small>Itens obtidos em jornadas e lojas aparecerão aqui.</small>`
        : `<span aria-hidden="true">⌕</span><strong>Nenhum resultado</strong><small>${estado.busca ? `Não encontramos “${estado.busca.replace(/[<>&]/g, "")}”.` : "Não há itens nesta categoria."}</small>`;
      areaGrade.appendChild(vazio);
      return;
    }
    const grade = criarGrade({ densidade: "densa" });
    grade.setAttribute("role", "list");
    const visiveis = pilhas.slice(0, estado.limiteItens);
    visiveis.forEach(({ item, uids }) => grade.appendChild(criarLadrilhoItem(item, uids, ativo, estado.uidSelecionado)));
    areaGrade.appendChild(grade);
    grade.querySelectorAll(".hda-ladrilho").forEach((el) => {
      const pilha = pilhas.find((x) => x.uids[0] === el.dataset.uid);
      if (!pilha) return;
      el.setAttribute("aria-selected", String(el.dataset.uid === estado.uidSelecionado));
      el.setAttribute("aria-label", `${pilha.item.nome}${pilha.uids.length > 1 ? `, ${pilha.uids.length} unidades` : ""}`);
      const abrir = (focarDetalhe = false) => {
        estado.uidSelecionado = pilha.uids[0];
        grade.querySelectorAll(".hda-ladrilho").forEach((o) => {
          const selecionado = o.dataset.uid === pilha.uids[0];
          o.classList.toggle("selecionado", selecionado);
          o.setAttribute("aria-selected", String(selecionado));
        });
        desenharDetalhe(pilha.item, pilha.uids, { focar: focarDetalhe });
      };
      el.onclick = () => abrir(false);
      el.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(true); }
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) {
          ev.preventDefault();
          const itens = [...grade.querySelectorAll(".hda-ladrilho")];
          const colunas = Math.max(1, Math.round(grade.clientWidth / Math.max(1, el.getBoundingClientRect().width)));
          const passo = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : ev.key === "ArrowUp" ? -colunas : colunas;
          itens[Math.max(0, Math.min(itens.length - 1, itens.indexOf(el) + passo))]?.focus();
        }
      };
    });
    if (pilhas.length > visiveis.length) {
      const mais = document.createElement("button");
      mais.className = "party-carregar-mais";
      mais.textContent = `Mostrar mais (${pilhas.length - visiveis.length} restantes)`;
      mais.onclick = () => { estado.limiteItens += interfaceToque ? 6 : 18; desenharGrade(); };
      areaGrade.appendChild(mais);
    }
  }

  // ---- 4. DETALHE COM COMPARAÇÃO POR MEMBRO -------------------------------
  // A parte que resolve o pedido: em vez de "equipar no personagem atual",
  // uma linha por membro dizendo o que ele tem hoje naquele slot e quanto
  // muda. Decidir em quem colocar deixa de exigir memória.
  function fecharDetalhe({ devolverFoco = false } = {}) {
    const itemAnterior = estado.uidSelecionado;
    estado.uidSelecionado = null;
    painel.classList.remove("visivel");
    painel.setAttribute("aria-hidden", "true");
    painel.innerHTML = "";
    orientacaoDetalhe.hidden = false;
    painelMochila.querySelectorAll(".hda-ladrilho").forEach((el) => {
      el.classList.remove("selecionado");
      el.setAttribute("aria-selected", "false");
    });
    if (devolverFoco && itemAnterior) painelMochila.querySelector(`[data-uid="${itemAnterior}"]`)?.focus();
  }

  function desenharDetalhe(item, uids, { focar = false } = {}) {
    const cor = RARITY_COLORS[item.raridade] || "#888";
    const slot = slotDoItem(item);
    const ehConsumivel = item.tipo === "consumivel";

    // Efeitos lendários por extenso. Lendário virou uma REGRA, não só um
    // número maior — e se a tela não disser qual, o jogador não sabe que
    // tem. Fica acima da comparação, porque é o que decide em quem vestir.
    const efeitos = descreverEfeitos(item);
    const efeitosHtml = efeitos.length
      ? `<div class="party-efeitos">${efeitos.map((e) => `<div class="party-efeito">${e}</div>`).join("")}</div>`
      : "";

    const linhas = membros.map((m, i) => {
      if (ehConsumivel) {
        const falta = m.hpMax - m.hp;
        const util = item.curaHP ? Math.min(item.curaHP, falta) : 0;
        return `<div class="party-linha-membro${i === estado.membroIdx ? " membro-ativo" : ""}">
          <span class="party-linha-nome">${m.nome}</span>
          <span class="party-linha-info"><small>ESTADO ATUAL</small>${falta > 0 ? `Faltam ${falta} HP` : "Vida cheia"}</span>
          <span class="party-linha-resultado"><small>AO USAR</small><b class="party-melhor">${item.curaHP ? `+${util} HP` : "Efeito aplicado"}</b></span>
          <button class="party-btn-usar" data-membro="${i}" aria-label="Usar ${item.nome} em ${m.nome}"${falta > 0 ? "" : " disabled"}>Usar</button>
        </div>`;
      }
      if (!slot) {
        return `<div class="party-linha-membro${i === estado.membroIdx ? " membro-ativo" : ""}"><span class="party-linha-nome">${m.nome}</span>
          <span class="party-linha-info">este item não se equipa</span></div>`;
      }
      const atualItem = m.equipamento && m.equipamento[slot];
      // Requisito de atributo: o item continua equipável, mas a tela diz o
      // preço ANTES de o jogador clicar — a penalidade nunca é surpresa.
      const req = textoRequisito(m, item);
      const pen = penalidadeDe(m, item);
      const delta = poderDoItem(item) - poderDoItem(atualItem);
      const sinal = delta > 0 ? `<b class="party-melhor">+${delta}</b>`
        : delta < 0 ? `<b class="party-pior">${delta}</b>`
          : `<b class="party-igual">=</b>`;
      const avisoReq = req && !req.ok
        ? `<span class="party-req-falta" title="${req.texto}">⚠ ${slot === "arma" ? "arma pesada" : "requisito"}: −${Math.round((1 - pen.dano) * 100)}% dano</span>`
        : "";
      return `<div class="party-linha-membro${req && !req.ok ? " penalizado" : ""}${i === estado.membroIdx ? " membro-ativo" : ""}">
        <span class="party-linha-nome">${m.nome}</span>
        <span class="party-linha-info"><small>ATUAL</small>${atualItem ? atualItem.nome : `<i>${slot} vazio</i>`}</span>
        <span class="party-linha-seta" aria-hidden="true">→</span>
        <span class="party-linha-resultado"><small>NOVO</small>${item.nome} ${sinal} ${avisoReq}</span>
        <button class="party-btn-equipar" data-membro="${i}" aria-label="Equipar ${item.nome} em ${m.nome}">Equipar</button>
      </div>`;
    }).join("");

    painel.innerHTML = `
      <div class="party-detalhe-cabecalho">
        <span class="icon-frame" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" alt="" loading="lazy" decoding="async" /></span>
        <div>
          <div class="party-detalhe-nome" style="color:${cor}">${item.nome}</div>
          <div class="desc">${RARITY_LABEL[item.raridade] || ""}${slot ? ` · ${slot}` : ""}${uids.length > 1 ? ` · x${uids.length}` : ""}</div>
        </div>
        <button class="party-detalhe-fechar" type="button" aria-label="Fechar comparação">×</button>
      </div>
      ${item.descricao ? `<p class="desc">${item.descricao}</p>` : ""}
      ${efeitosHtml}
      <div class="party-linhas">${linhas}</div>
      <div class="party-detalhe-acoes">
        <button class="party-btn-vender">Vender por 🪙 ${Math.max(1, Math.round((item.valor || 1) * 0.5))}</button>
      </div>`;

    orientacaoDetalhe.hidden = true;
    painel.setAttribute("aria-hidden", "false");
    painel.querySelector(".party-detalhe-fechar").onclick = () => fecharDetalhe({ devolverFoco: true });
    painel.onkeydown = (ev) => { if (ev.key === "Escape") fecharDetalhe({ devolverFoco: true }); };
    painel.querySelectorAll(".party-btn-equipar").forEach((b) => {
      b.onclick = () => {
        const m = membros[Number(b.dataset.membro)];
        const r = equiparItem(personagem, uids[0], m);
        if (!r.ok) { somBloqueioOuErro(); mostrarMensagem(r.msg || "Não deu para equipar.", 2400); return; }
        somConfirmar();
        onMudar();
        mostrarMensagem(`${item.nome} equipado em ${m.nome}.`, 1800);
        estado.uidSelecionado = null;
        redesenhar();
      };
    });
    painel.querySelectorAll(".party-btn-usar").forEach((b) => {
      b.onclick = () => {
        const m = membros[Number(b.dataset.membro)];
        const r = usarConsumivel(personagem, uids[0], m);
        if (!r.ok) { somBloqueioOuErro(); mostrarMensagem(r.msg || "Não deu para usar.", 2400); return; }
        somConfirmar();
        onMudar();
        mostrarMensagem(`${m.nome} usou ${item.nome}.`, 1800);
        redesenhar();
      };
    });
    const btnVender = painel.querySelector(".party-btn-vender");
    if (btnVender) {
      btnVender.onclick = () => {
        const valor = venderItem(personagem, uids[0]);
        onMudar();
        mostrarMensagem(`Vendido por 🪙 ${valor}.`, 1800);
        estado.uidSelecionado = null;
        redesenhar();
      };
    }
    painel.classList.add("visivel");
    if (focar) painel.focus({ preventScroll: true });
    if (!focar && interfaceToque) painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---- 5. ABA "FICHA DO PERSONAGEM" ---------------------------------------
  const painelFicha = document.createElement("div");
  painelFicha.className = "party-ficha companhia-painel companhia-ficha";
  if (estado.aba === "ficha") corpo.appendChild(painelFicha);

  function desenharFicha() {
    const m = ativo;
    if (!m) { painelFicha.innerHTML = "<p class=\"desc\">Nenhum membro selecionado.</p>"; return; }
    // O herói guarda o elemento escolhido na criação em `elementoId`; os
    // convocados, em `elemento`. Antes a ficha do herói lia só `elemento` e
    // caía no elemento da arma — mostrava "Físico" para quem escolheu Gelo.
    const elemento = m.elementoId || m.elemento || (m.equipamento && m.equipamento.arma && m.equipamento.arma.elemento) || "fisico";
    const info = infoElemento(elemento, dados.elements) || { nome: elemento, icone: "◆", cor: "#c9c9c9" };
    const rel = relacoesDoElemento(elemento, dados);
    const nomeEl = (id) => {
      const i = infoElemento(id, dados.elements);
      return i ? `${i.icone} ${i.nome}` : id;
    };

    const naMao = habilidadesEquipadas(m);
    const guardadas = habilidadesNaReserva(m);
    const passivas = passivasDe(m);
    const marcas = marcasDe(m);

    const listaHab = (lista, vazio) => (lista.length
      ? `<div class="ficha-chips">${lista.map((h) => `<span class="ficha-chip" data-tip-hab="${h.id}">${h.nome}</span>`).join("")}</div>`
      : `<p class="desc">${vazio}</p>`);

    const equipados = SLOTS_EQUIPAMENTO.map((sl) => {
      const it = m.equipamento && m.equipamento[sl.slot];
      return `<div class="ficha-slot${it ? "" : " vazio"}"${it ? ` data-tip-item="${it.uid || it.id}"` : ""}>
        <span class="ficha-slot-icone">${sl.icone}</span>
        <span class="ficha-slot-label">${sl.label}</span>
        <span class="ficha-slot-item">${it ? it.nome : "—"}</span>
      </div>`;
    }).join("");

    painelFicha.innerHTML = `
      <div class="ficha-cabecalho">
        <div>
          <div class="ficha-nome">${m.nome}</div>
          <div class="desc">${m.classeNome || m.classeId || ""}${m.racaNome ? ` · ${m.racaNome}` : ""} · Nível ${m.nivel || 1}${m.raridade ? ` · ${RARITY_LABEL[m.raridade] || m.raridade}` : ""}</div>
        </div>
        <div class="ficha-elemento" style="border-color:${info.cor}">${info.icone} ${info.nome}</div>
      </div>
      <div class="ficha-acoes" aria-label="Ações rápidas de ${m.nome}">
        <button type="button" data-ficha-acao="mochila">🎒 Equipar e comparar</button>
        <button type="button" data-ficha-acao="habilidades">🃏 Editar habilidades</button>
        <button type="button" data-ficha-acao="evolucao">✨ Evoluir personagem</button>
      </div>
      ${m.descricaoTraco || m.descricao ? `<p class="desc">${m.descricaoTraco || m.descricao}</p>` : ""}

      <div class="ficha-grade">
        <div class="ficha-bloco">
          <h4>Atributos</h4>
          <div class="ficha-linhas">
            ${["FOR", "DES", "CON", "INT"].map((k) => `<div class="ficha-linha"><span>${k}</span><b>${(m.atributos && m.atributos[k]) || 0}</b></div>`).join("")}
            <div class="ficha-linha"><span>Vida</span><b>${m.hp}/${m.hpMax}</b></div>
            <div class="ficha-linha"><span>Éter</span><b>${m.mp}/${m.mpMax}</b></div>
          </div>
        </div>
        <div class="ficha-bloco">
          <h4>Elemento</h4>
          <div class="ficha-linhas">
            <div class="ficha-linha"><span>Eficaz contra</span><b>${rel.forte.length ? rel.forte.map((f) => nomeEl(f.id)).join(", ") : "—"}</b></div>
            <div class="ficha-linha ficha-fraqueza"><span>Fraco contra</span><b>${rel.fraco.length ? rel.fraco.map((f) => nomeEl(f.id)).join(", ") : "—"}</b></div>
          </div>
        </div>
      </div>

      <div class="ficha-bloco">
        <h4>Cards de batalha (${naMao.length})</h4>
        ${listaHab(naMao, "Nenhuma habilidade na mão.")}
      </div>
      ${guardadas.length ? `<div class="ficha-bloco"><h4>Guardadas (${guardadas.length})</h4>${listaHab(guardadas, "")}</div>` : ""}
      ${passivas.length ? `<div class="ficha-bloco"><h4>Passivas</h4><div class="ficha-chips">${passivas.map((pa) => `<span class="ficha-chip" data-tip-texto="${(pa.descricao || "").replace(/"/g, "&quot;")}">${pa.icone || "◆"} ${pa.nome}</span>`).join("")}</div></div>` : ""}
      ${marcas.length ? `<div class="ficha-bloco"><h4>Marcas de classe</h4><div class="ficha-chips">${marcas.map((ma) => `<span class="ficha-chip" data-tip-texto="${(ma.descricao || "").replace(/"/g, "&quot;")}">${ma.icone || "◈"} ${ma.nome}</span>`).join("")}</div></div>` : ""}

      <div class="ficha-bloco">
        <h4>Equipamento</h4>
        <div class="ficha-slots">${equipados}</div>
      </div>`;
  }

  // ---- 6. ABA "EQUIPAR AUTOMÁTICO" ----------------------------------------
  const painelAuto = document.createElement("div");
  painelAuto.className = "party-auto companhia-painel companhia-auto";
  if (estado.aba === "auto") corpo.appendChild(painelAuto);

  function desenharAuto() {
    // `planejarEquipamento` já existia e já sabia decidir — só nunca teve
    // tela. Com `incluirUpgrades` ele também troca peça pior por peça melhor,
    // não apenas preenche slot vazio.
    const plano = planejarEquipamento(personagem, membros, dados, { incluirUpgrades: true });
    const acoes = plano.acoes || plano || [];
    const linhas = acoes.length
      ? acoes.map((a) => `<div class="auto-linha">
          <span class="auto-quem">${(a.alvo && a.alvo.nome) || a.nomeAlvo || personagem.nome}</span>
          <span class="auto-slot">${LABEL_SLOT[a.slot] || a.slot}</span>
          <span class="auto-item" data-tip-item="${(a.item && (a.item.uid || a.item.id)) || ""}">${a.item ? a.item.nome : "—"}</span>
          ${a.anterior ? `<span class="auto-troca">no lugar de ${a.anterior.nome}</span>` : `<span class="auto-troca">slot vazio</span>`}
        </div>`).join("")
      : `<p class="desc">Nada a fazer: todo mundo já está com a melhor peça que existe na mochila.</p>`;

    painelAuto.innerHTML = `
      <p class="desc">Compara cada peça da mochila com o que cada membro está usando e propõe a troca que mais aumenta o poder de combate. Nada é aplicado até você confirmar.</p>
      <div class="auto-lista">${linhas}</div>
      <div class="party-detalhe-acoes">
        <button class="party-btn-auto primario"${acoes.length ? "" : " disabled"}>Aplicar ${acoes.length} troca${acoes.length === 1 ? "" : "s"}</button>
      </div>`;

    const btn = painelAuto.querySelector(".party-btn-auto");
    if (btn && acoes.length) {
      btn.onclick = () => {
        aplicarPlanoEquipamento(personagem, acoes);
        somConfirmar();
        onMudar();
        mostrarMensagem(`🎽 ${acoes.length} peça(s) equipada(s) automaticamente.`, 2400);
        redesenhar();
      };
    }
  }

  if (estado.aba === "ficha") {
    desenharFicha();
    painelFicha.querySelectorAll("[data-ficha-acao]").forEach((botao) => {
      botao.onclick = () => {
        const destino = botao.dataset.fichaAcao;
        if (destino === "evolucao") { estado.abrirEvolucao?.(); return; }
        if (destino === "habilidades") { estado.abrirEvolucao?.(); return; }
        estado.aba = destino; redesenhar();
      };
    });
    if (estado.montarResumo) {
      const resumo = document.createElement("details");
      resumo.innerHTML = "<summary>Bônus, efeitos e situação do mundo</summary>";
      painelFicha.appendChild(resumo);
      estado.montarResumo(resumo, ativo);
    }
  }
  if (estado.aba === "auto") desenharAuto();

  // Tooltips: um listener só na tela inteira, resolvendo id → objeto. O
  // catálogo procura primeiro na mochila (uid) e depois no catálogo global
  // (id), porque uma peça já equipada não está mais no inventário.
  const porUid = new Map(personagem.inventario.map((i) => [i.uid, i]));
  const porId = new Map((dados.items.itens || []).map((i) => [i.id, i]));
  const habsDoAtivo = new Map(((ativo && ativo.habilidades) || []).map((h) => [h.id, h]));
  ligarTooltips(corpo, {
    item: (chave) => porUid.get(chave) || porId.get(chave) || null,
    habilidade: (id) => habsDoAtivo.get(id) || null,
    personagem: ativo,
  });

  if (estado.aba === "mochila") {
    areaGrade.setAttribute("aria-busy", "true");
    areaGrade.innerHTML = `<div class="companhia-estado companhia-estado-carregando" role="status"><span aria-hidden="true"></span><strong>Organizando mochila…</strong><small>Comparando itens com a formação ativa.</small></div>`;
    queueMicrotask(() => {
      if (!areaGrade.isConnected) return;
      desenharGrade();
      if (estado.uidSelecionado) {
        const pilha = pilhasVisiveis().find((x) => x.uids[0] === estado.uidSelecionado);
        if (pilha) desenharDetalhe(pilha.item, pilha.uids);
        else fecharDetalhe();
      }
    });
  }

  const equipadosTotal = membros.reduce((s, m) => s
    + SLOTS_EQUIPAMENTO.filter((sl) => m.equipamento && m.equipamento[sl.slot]).length, 0);
  tela.definirAcoes([], `${membros.length} no grupo · ${equipadosTotal}/${membros.length * 7} slots preenchidos`);
  return estado;
}
