// Caminhos do Herdeiro — UI visual da árvore (task #95).
//
// Só Guerreiro e Mago têm uma árvore de Caminhos do Herdeiro de verdade
// hoje (task #93/#94 — "profundo em 2 classes primeiro"); qualquer outra
// classe continua usando só a tela antiga (ui/SkillTreeUI.js, botão
// "Habilidades"). Este módulo abre um botão NOVO e separado ("Caminhos"),
// que só aparece pra quem tem árvore real — ver personagemTemCaminhoHerdeiro,
// chamada em main.js antes de mostrar o botão.
//
// Layout do grafo é calculado a partir dos próprios dados (nivelMinimo,
// requer, grupoExclusivo, subclasseId) — não há nenhuma coordenada
// hardcoded por talento, então qualquer árvore futura (as outras 6 classes)
// já rende automaticamente sem precisar mexer neste arquivo.
import {
  garantirEstadoCaminho, arvoreDoPersonagem, arvoreHeranca, avaliarArvore,
  talentosAtivos, escolherTalento, escolherSubclasse, subclassesDisponiveis,
  resetarTalentos, renomearPreset, alternarPreset, bonusCaminhoHerdeiro,
  NIVEL_ESCOLHA_SUBCLASSE,
} from "../systems/TalentSystem.js";
import { totalAbates } from "../systems/CompendiumSystem.js";
import { getReputacao, facaoInfo } from "../systems/WorldStateSystem.js";

const CLASSES_SUPORTADAS = new Set(["guerreiro", "mago"]);

export function personagemTemCaminhoHerdeiro(personagem) {
  return CLASSES_SUPORTADAS.has(personagem && personagem.classeId);
}

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().classList.remove("arvore-caminhos");
  conteudo().innerHTML = "";
}

function contextoHeranca(dados) {
  return {
    totalAbates: (p, monstroId) => totalAbates(p, monstroId),
    getReputacao: (p, facaoId) => getReputacao(p, facaoId),
  };
}

// --- Classificação visual (pura, testável) ---------------------------------
// "escopo" é a lista de nós relevante pra decidir se um nó é folha da
// cadeia (ex.: só os 7 talentos de classe, ou só os 3 de UMA subclasse) —
// sem isso, um talento de outra subclasse poderia contar como "quem
// depende dele" por engano.
export function classificarTipoNode(node, escopo) {
  if (node.tipoPonto === "heranca") return "heranca";
  if (!node.efeito) return "passivo";
  if (node.efeito.tipo === "transformacao") return "transformacao";
  if (node.efeito.tipo !== "concedeHabilidade") return "passivo";
  const concedem = escopo.filter((n) => n.efeito && n.efeito.tipo === "concedeHabilidade");
  const ehFolha = !escopo.some((n) => Array.isArray(n.requer) && n.requer.includes(node.id));
  const maiorCusto = concedem.length ? Math.max(...concedem.map((n) => n.custo || 1)) : node.custo || 1;
  return ehFolha && (node.custo || 1) >= maiorCusto ? "ultimate" : "ativo";
}

export function estadoNode(node, ativos, avaliacao) {
  if (ativos.has(node.id)) return "escolhido";
  if (avaliacao.disponiveis.some((n) => n.id === node.id)) return "desbloqueavel";
  return "bloqueado";
}

// --- Layout (puro, testável) -------------------------------------------
// Profundidade de um nó = 0 se não tem pré-requisito dentro do MESMO
// escopo, senão 1 + a maior profundidade de quem ele exige. Nós que
// dividem um grupoExclusivo na mesma profundidade ficam lado a lado;
// qualquer outro nó solo fica centralizado (coluna 0).
export function calcularProfundidades(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map();
  function prof(n, pilha = new Set()) {
    if (cache.has(n.id)) return cache.get(n.id);
    if (pilha.has(n.id)) return 0; // guarda contra ciclo acidental nos dados
    pilha.add(n.id);
    const reqs = (n.requer || []).map((id) => byId.get(id)).filter(Boolean);
    const d = reqs.length ? 1 + Math.max(...reqs.map((r) => prof(r, pilha))) : 0;
    cache.set(n.id, d);
    return d;
  }
  const out = new Map();
  nodes.forEach((n) => out.set(n.id, prof(n)));
  return out;
}

// A LINHA de cada nó (pra desenhar) não pode vir só da profundidade de
// requer: dois talentos de nível 1 sem pré-requisito entre si (ex.: Vigor
// de Batalha e Couraça de Campo) têm profundidade 0 os dois, mas o par
// exclusivo de nível 5 (Fúria Crescente/Pele de Pedra) TAMBÉM não tem
// `requer` — sem olhar nivelMinimo, os dois grupos colidiriam na mesma
// linha. Aqui a linha é o maior entre "posição do nível na lista de níveis
// únicos, em ordem" e "1 + linha do pré-requisito mais profundo" — assim um
// nó nunca desenha acima de quem ele exige, mas nós de mesmo nível sem
// relação entre si (o caso comum aqui) ficam sempre na mesma linha visual.
function calcularLinhas(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const niveisUnicos = [...new Set(nodes.map((n) => n.nivelMinimo || 1))].sort((a, b) => a - b);
  const rankPorNivel = new Map(niveisUnicos.map((nv, i) => [nv, i]));
  const cache = new Map();
  function linha(n, pilha = new Set()) {
    if (cache.has(n.id)) return cache.get(n.id);
    const base = rankPorNivel.get(n.nivelMinimo || 1) ?? 0;
    if (pilha.has(n.id)) return base; // guarda contra ciclo acidental nos dados
    pilha.add(n.id);
    const reqs = (n.requer || []).map((id) => byId.get(id)).filter(Boolean);
    const l = reqs.length ? Math.max(base, 1 + Math.max(...reqs.map((r) => linha(r, pilha)))) : base;
    cache.set(n.id, l);
    return l;
  }
  const out = new Map();
  nodes.forEach((n) => out.set(n.id, linha(n)));
  return out;
}

export function layoutLista(nodes) {
  const prof = calcularLinhas(nodes);
  const porProf = new Map();
  nodes.forEach((n) => {
    const d = prof.get(n.id);
    if (!porProf.has(d)) porProf.set(d, []);
    porProf.get(d).push(n);
  });
  const pos = new Map();
  [...porProf.keys()].sort((a, b) => a - b).forEach((d) => {
    const nesteNivel = [...porProf.get(d)].sort((a, b) => a.id.localeCompare(b.id));
    const grupos = new Map();
    const solo = [];
    nesteNivel.forEach((n) => {
      if (n.grupoExclusivo) {
        if (!grupos.has(n.grupoExclusivo)) grupos.set(n.grupoExclusivo, []);
        grupos.get(n.grupoExclusivo).push(n);
      } else solo.push(n);
    });
    // Mais de um nó solo pode compartilhar a mesma profundidade (ex.: dois
    // talentos de nível 1 sem pré-requisito entre si, como Vigor de Batalha
    // e Couraça de Campo) — sem espalhar por coluna aqui, os dois cairiam
    // exatamente na mesma coordenada. Mesmo espalhamento centralizado que já
    // era usado pra grupoExclusivo, só que sem a linha tracejada de conflito.
    solo.forEach((n, i) => pos.set(n.id, { row: d, col: i - (solo.length - 1) / 2 }));
    grupos.forEach((arr) => {
      const span = arr.length;
      arr.forEach((n, i) => pos.set(n.id, { row: d, col: i - (span - 1) / 2 }));
    });
  });
  return pos;
}

const COL_W = 150;
const ROW_H = 140;
const SUB_LANE_W = 230;

// Monta a posição em pixel de TODOS os nós (classe + cada subclasse, lado a
// lado, embaixo da coluna de classe) de uma árvore inteira. Retorna
// { posicoes: Map(id -> {x,y}), largura, altura, linhaBaseSubclasses }.
export function calcularLayoutArvore(nodesClasse, subclasses) {
  const posicoes = new Map();
  const layoutClasse = layoutLista(nodesClasse);
  let maxColClasse = 0;
  let maxRowClasse = -1;
  layoutClasse.forEach(({ row, col }) => {
    maxColClasse = Math.max(maxColClasse, Math.abs(col));
    maxRowClasse = Math.max(maxRowClasse, row);
  });
  const centerX = Math.max(320, (maxColClasse * 2 + 1) * COL_W / 2 + COL_W);
  nodesClasse.forEach((n) => {
    const { row, col } = layoutClasse.get(n.id);
    posicoes.set(n.id, { x: centerX + col * COL_W, y: 90 + row * ROW_H });
  });
  const linhaBaseSubclasses = 90 + (maxRowClasse + 1) * ROW_H + 60;
  subclasses.forEach((sub, idx) => {
    const laneX = centerX + (idx - (subclasses.length - 1) / 2) * SUB_LANE_W;
    const layoutSub = layoutLista(sub.nodes);
    sub.nodes.forEach((n) => {
      const { row } = layoutSub.get(n.id);
      posicoes.set(n.id, { x: laneX, y: linhaBaseSubclasses + row * ROW_H });
    });
  });
  const maxSubRow = subclasses.length
    ? Math.max(0, ...subclasses.map((s) => Math.max(0, ...s.nodes.map((n) => layoutLista(s.nodes).get(n.id).row))))
    : -1;
  const largura = centerX * 2 + 80;
  const altura = linhaBaseSubclasses + (maxSubRow + 1) * ROW_H + 80;
  return { posicoes, largura, altura, linhaBaseSubclasses, centerX };
}

// --- Descrição textual do efeito/sinergia (pura, usada no painel) ---------
export function descreverEfeito(node) {
  if (!node.efeito) return "Sem efeito mecânico.";
  if (node.efeito.tipo === "bonusAtributo") {
    const alvo = node.efeito.atributo;
    const percentuais = new Set(["hpMaxPercent", "mpMaxPercent", "critChance"]);
    const valor = percentuais.has(alvo) ? `${(node.efeito.valor * 100).toFixed(0)}%` : `+${node.efeito.valor}`;
    const nomes = { FOR: "Força", DES: "Destreza", CON: "Constituição", INT: "Intelecto", hpMaxPercent: "HP máximo", mpMaxPercent: "MP máximo", critChance: "chance de crítico", defesaFlat: "defesa" };
    return `Bônus permanente: ${valor} de ${nomes[alvo] || alvo}.`;
  }
  if (node.efeito.tipo === "concedeHabilidade") {
    const h = node.efeito.habilidade;
    const partes = [`Concede a habilidade "${h.nome}" (${h.tipo.replace(/_/g, " ")}, x${h.multiplicador || h.valor || "-"}).`];
    if (h.custoMP != null) partes.push(`Custo: ${h.custoMP} MP.`);
    if (h.cooldown != null) partes.push(`Recarga: ${h.cooldown} turno(s).`);
    if (h.elemento) partes.push(`Elemento: ${h.elemento}.`);
    if (h.aplicaEstado) partes.push(`Aplica o estado "${h.aplicaEstado}" por ${h.duracaoEstado} turno(s).`);
    return partes.join(" ");
  }
  return `Efeito: ${node.efeito.tipo}.`;
}

export function descreverSinergia(node, dadosReacoes) {
  const estado = node.efeito && node.efeito.tipo === "concedeHabilidade" && node.efeito.habilidade && node.efeito.habilidade.aplicaEstado;
  if (!estado) return null;
  const reacoes = ((dadosReacoes && dadosReacoes.reacoes) || []).filter((r) => r.estadoConsumido === estado);
  if (!reacoes.length) return null;
  return reacoes.map((r) => `Deixa o alvo pronto pra reação "${r.nome}" (${r.descricao})`).join(" ");
}

function descreverGatilhoHeranca(node, personagem, dados) {
  const g = node.gatilho;
  if (!g) return "Sempre disponível.";
  if (g.tipo === "chefeDerrotado") {
    const m = (dados.monsters || []).find((mm) => mm.id === g.monstroId);
    const cumprido = totalAbates(personagem, g.monstroId) > 0;
    return `Derrotar ${m ? m.nome : g.monstroId} ao menos uma vez. ${cumprido ? "✅ Já aconteceu." : "⏳ Ainda não aconteceu nesta partida."}`;
  }
  if (g.tipo === "reputacaoFaccao") {
    const f = facaoInfo(g.facaoId, dados.worldStateVariables);
    const atual = getReputacao(personagem, g.facaoId);
    const cumprido = atual >= g.minimo;
    return `Reputação ${g.minimo}+ com ${f ? f.nome : g.facaoId} (atual: ${atual}). ${cumprido ? "✅ Já cumprido." : "⏳ Ainda não cumprido."}`;
  }
  if (g.tipo === "armaSecretaDespertada") {
    const cumprido = ((personagem.caminhoHerdeiro && personagem.caminhoHerdeiro.registroPontosHeranca) || []).some((r) => r.origem && r.origem.tipo === "arma_secreta_despertada");
    return `Despertar a Arma Secreta de algum convocado do gacha. ${cumprido ? "✅ Já aconteceu." : "⏳ Ainda não aconteceu nesta partida."}`;
  }
  return "Evento narrativo não reconhecido.";
}

// --- Formas SVG por tipo -----------------------------------------------
const RAIO = 27;
function pontosHexagono(r) {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    p.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(" ");
}
function pontosEstrela(rOut, rIn) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(" ");
}
function pontosDiamante(r) {
  return `0,${-r} ${r},0 0,${r} ${-r},0`;
}

const CORES_TIPO = {
  passivo: "#2f4fb0",
  ativo: "#c8622f",
  ultimate: "#f5a524",
  heranca: "#8a4fb0",
  transformacao: "#2f9c8a",
};

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function formaDoTipo(tipo) {
  if (tipo === "passivo") return svgEl("circle", { r: RAIO });
  if (tipo === "heranca") return svgEl("polygon", { points: pontosDiamante(RAIO + 3) });
  if (tipo === "ultimate") return svgEl("polygon", { points: pontosEstrela(RAIO + 6, (RAIO + 6) * 0.45) });
  return svgEl("polygon", { points: pontosHexagono(RAIO) }); // ativo / transformacao
}

// --- Render principal -----------------------------------------------------
export function montarCaminhoHerdeiro(personagem, dados, onMudar) {
  overlay().classList.remove("hidden");
  conteudo().classList.add("arvore-caminhos");
  const ch = garantirEstadoCaminho(personagem);
  const arvoreClasse = arvoreDoPersonagem(personagem, dados).filter((n) => !n.subclasseId);
  const arvoreCompleta = arvoreDoPersonagem(personagem, dados);
  const subclassesOpcoes = subclassesDisponiveis(personagem, dados);
  const subclasses = subclassesOpcoes.map((s) => ({
    def: s,
    nodes: arvoreCompleta.filter((n) => n.subclasseId === s.id),
  }));
  const arvoreDeHeranca = arvoreHeranca(dados);
  const ativos = new Set(talentosAtivos(personagem));
  const avaliacaoClasse = avaliarArvore(personagem, arvoreCompleta, {});
  const avaliacaoHeranca = avaliarArvore(personagem, arvoreDeHeranca, { heranca: true, contexto: contextoHeranca(dados) });
  const { posicoes, largura, altura, linhaBaseSubclasses } = calcularLayoutArvore(arvoreClasse, subclasses);

  let noSelecionado = null;

  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <h2>Caminhos do Herdeiro — ${personagem.classeNome || personagem.classeId}</h2>
    <div id="caminho-topo">
      <div id="caminho-pontos"></div>
      <div id="caminho-presets"></div>
    </div>
    <div id="caminho-corpo">
      <div id="caminho-viewport-wrap">
        <div id="caminho-zoom-controles">
          <button id="btn-zoom-in" title="Aproximar">➕</button>
          <button id="btn-zoom-out" title="Afastar">➖</button>
          <button id="btn-zoom-reset" title="Centralizar">🎯</button>
        </div>
        <div id="caminho-viewport"></div>
      </div>
      <div id="caminho-painel"></div>
    </div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;

  // --- cabeçalho de pontos -------------------------------------------------
  const painelPontos = conteudo().querySelector("#caminho-pontos");
  painelPontos.innerHTML = `
    <span class="ponto-badge classe">🔷 Classe: ${ch.pontosClasse}</span>
    <span class="ponto-badge subclasse">🔶 Subclasse: ${ch.pontosSubclasse}</span>
    <span class="ponto-badge heranca">💠 Herança: ${ch.pontosHeranca}</span>
    <button id="btn-respec" title="Devolve os pontos de classe/subclasse gastos NESTE build (herança nunca é devolvida)">↺ Resetar talentos deste build</button>
  `;
  painelPontos.querySelector("#btn-respec").onclick = () => {
    resetarTalentos(personagem, arvoreCompleta);
    onMudar();
    montarCaminhoHerdeiro(personagem, dados, onMudar);
  };

  // --- presets --------------------------------------------------------------
  const painelPresets = conteudo().querySelector("#caminho-presets");
  ch.presets.forEach((preset, idx) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn" + (idx === ch.presetAtivo ? " ativo" : "");
    btn.textContent = preset.nome;
    btn.title = "Clique para ativar este build; clique duplo pra renomear.";
    btn.onclick = () => {
      alternarPreset(personagem, idx);
      onMudar();
      montarCaminhoHerdeiro(personagem, dados, onMudar);
    };
    btn.ondblclick = () => {
      const novoNome = prompt("Novo nome do build:", preset.nome);
      if (novoNome) {
        renomearPreset(personagem, idx, novoNome);
        montarCaminhoHerdeiro(personagem, dados, onMudar);
      }
    };
    painelPresets.appendChild(btn);
  });

  // --- painel lateral de detalhes -------------------------------------------
  const painel = conteudo().querySelector("#caminho-painel");
  function renderPainel() {
    if (!noSelecionado) {
      const bonus = bonusCaminhoHerdeiro(personagem, dados);
      const linhasBonus = Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => `${k}: ${typeof v === "number" && Math.abs(v) < 1 ? (v * 100).toFixed(0) + "%" : "+" + v}`).join(", ") || "nenhum ainda";
      painel.innerHTML = `<p class="painel-vazio">Toque em um nó da árvore pra ver detalhes.</p><p class="painel-vazio">Bônus ativo agora (build "${ch.presets[ch.presetAtivo].nome}"): ${linhasBonus}</p>`;
      return;
    }
    const { node, ehHeranca, escopo } = noSelecionado;
    const tipo = classificarTipoNode(node, escopo);
    const avaliacao = ehHeranca ? avaliacaoHeranca : avaliacaoClasse;
    const estado = estadoNode(node, ativos, avaliacao);
    const bloqueio = avaliacao.bloqueados.find((b) => b.node.id === node.id);
    const sinergia = descreverSinergia(node, dados.elementalReactions);
    painel.innerHTML = `
      <div class="painel-no">
        <div class="painel-no-titulo">${node.icone || "❔"} ${node.nome}</div>
        <div class="painel-no-tags">
          <span class="tag">${tipo}</span>
          <span class="tag">nível ${node.nivelMinimo || 1}+</span>
          <span class="tag">custo ${node.custo || 1} (${ehHeranca ? "herança" : node.tipoPonto})</span>
        </div>
        <p class="painel-no-desc">${node.descricao || ""}</p>
        <p class="painel-no-efeito">${descreverEfeito(node)}</p>
        ${sinergia ? `<p class="painel-no-sinergia">🔗 Sinergia: ${sinergia}</p>` : ""}
        ${node.requer && node.requer.length ? `<p class="painel-no-req">Pré-requisito: ${node.requer.map((id) => (escopo.find((n) => n.id === id) || { nome: id }).nome).join(", ")}</p>` : ""}
        ${node.grupoExclusivo ? `<p class="painel-no-req">⚔️ Escolha exclusiva — pegar este bloqueia outros do mesmo ramo pra sempre neste build.</p>` : ""}
        ${ehHeranca ? `<p class="painel-no-req">🌍 ${descreverGatilhoHeranca(node, personagem, dados)}</p>` : ""}
        ${estado === "bloqueado" && bloqueio ? `<p class="painel-no-bloqueio">🔒 ${bloqueio.motivos.join("; ")}</p>` : ""}
        <div class="painel-no-acao"></div>
      </div>
    `;
    const acao = painel.querySelector(".painel-no-acao");
    if (estado === "escolhido") {
      acao.innerHTML = `<span class="tag escolhido-tag">✅ Já adquirido</span>`;
    } else if (estado === "desbloqueavel") {
      const btn = document.createElement("button");
      btn.className = "primario";
      btn.textContent = ehHeranca ? "Gastar ponto de Herança (permanente)" : "Desbloquear";
      btn.onclick = () => {
        const r = escolherTalento(personagem, node.id, escopoCompleto(ehHeranca), dados, { heranca: ehHeranca, contexto: contextoHeranca(dados) });
        if (r.ok) { onMudar(); montarCaminhoHerdeiro(personagem, dados, onMudar); }
      };
      acao.appendChild(btn);
    } else {
      acao.innerHTML = `<span class="tag">Bloqueado por enquanto</span>`;
    }
  }
  function escopoCompleto(ehHeranca) { return ehHeranca ? arvoreDeHeranca : arvoreCompleta; }
  renderPainel();

  // --- SVG do grafo -----------------------------------------------------
  const viewportWrap = conteudo().querySelector("#caminho-viewport");
  const svg = svgEl("svg", { width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`, id: "svg-arvore" });
  const gViewport = svgEl("g", { id: "g-arvore-viewport" });
  svg.appendChild(gViewport);
  viewportWrap.appendChild(svg);

  function pos(id) { return posicoes.get(id); }

  function desenharEdges(nodes, ehHeranca) {
    nodes.forEach((n) => {
      (n.requer || []).forEach((reqId) => {
        const a = pos(reqId), b = pos(n.id);
        if (!a || !b) return;
        gViewport.appendChild(svgEl("line", { x1: a.x, y1: a.y + RAIO, x2: b.x, y2: b.y - RAIO, class: "edge-requer" }));
      });
    });
    const vistos = new Set();
    nodes.forEach((n) => {
      if (!n.grupoExclusivo) return;
      nodes.forEach((m) => {
        if (m.id === n.id || m.grupoExclusivo !== n.grupoExclusivo) return;
        const chave = [n.id, m.id].sort().join("|");
        if (vistos.has(chave)) return;
        vistos.add(chave);
        const a = pos(n.id), b = pos(m.id);
        if (!a || !b) return;
        gViewport.appendChild(svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge-exclusivo" }));
      });
    });
  }
  desenharEdges(arvoreClasse, false);
  subclasses.forEach((s) => desenharEdges(s.nodes, false));

  function desenharNode(node, ehHeranca, escopo) {
    const p = pos(node.id);
    if (!p) return;
    const tipo = classificarTipoNode(node, escopo);
    const avaliacao = ehHeranca ? avaliacaoHeranca : avaliacaoClasse;
    const estado = estadoNode(node, ativos, avaliacao);
    const g = svgEl("g", { class: `no-caminho tipo-${tipo} estado-${estado}`, transform: `translate(${p.x},${p.y})` });
    // Área de clique invisível maior que a forma visível: sem isso, um
    // <g> sem geometria própria só recebe clique exatamente em cima do
    // pixel pintado de cada filho (SVG não tem "clique em qualquer lugar
    // da caixa" por padrão) — clicar perto da borda do ícone ou no rótulo
    // abaixo dele não abriria o painel. Cobre forma (raio ~33) + rótulo
    // (a ~45px abaixo do centro).
    g.appendChild(svgEl("circle", { r: RAIO + 35, class: "no-area-clique", fill: "transparent" }));
    const forma = formaDoTipo(tipo);
    forma.setAttribute("class", "no-forma");
    forma.setAttribute("fill", estado === "bloqueado" ? "#2b2118" : CORES_TIPO[tipo]);
    g.appendChild(forma);
    if (node.grupoExclusivo) g.appendChild(svgEl(tipo === "passivo" ? "circle" : "polygon", { ...(tipo === "passivo" ? { r: RAIO + 6 } : { points: tipo === "heranca" ? pontosDiamante(RAIO + 9) : tipo === "ultimate" ? pontosEstrela(RAIO + 12, (RAIO + 12) * 0.45) : pontosHexagono(RAIO + 6) }), class: "no-anel-exclusivo" }));
    const icone = svgEl("text", { class: "no-icone", "text-anchor": "middle", dy: "0.35em" });
    icone.textContent = node.icone || "❔";
    g.appendChild(icone);
    if (estado === "escolhido") {
      const check = svgEl("text", { class: "no-check", x: RAIO * 0.6, y: -RAIO * 0.6, "text-anchor": "middle" });
      check.textContent = "✅";
      g.appendChild(check);
    }
    const label = svgEl("text", { class: "no-label", "text-anchor": "middle", y: RAIO + 18 });
    label.textContent = node.nome;
    g.appendChild(label);
    g.style.cursor = "pointer";
    g.addEventListener("click", () => {
      noSelecionado = { node, ehHeranca, escopo };
      renderPainel();
      conteudo().querySelectorAll(".no-caminho.selecionado").forEach((el) => el.classList.remove("selecionado"));
      g.classList.add("selecionado");
    });
    gViewport.appendChild(g);
  }
  arvoreClasse.forEach((n) => desenharNode(n, false, arvoreClasse));
  subclasses.forEach((s) => s.nodes.forEach((n) => desenharNode(n, false, s.nodes)));

  // Cabeçalhos de coluna por subclasse (nome + botão de escolha se ainda
  // não decidido, ou selo "seu caminho"/"bloqueado" se já decidido).
  subclasses.forEach((s, idx) => {
    const laneX = posicoes.size && s.nodes.length ? pos(s.nodes[0].id).x : 0;
    const header = svgEl("g", { transform: `translate(${laneX},${linhaBaseSubclasses - 55})` });
    const titulo = svgEl("text", { class: "sub-titulo", "text-anchor": "middle" });
    titulo.textContent = `${s.def.icone || ""} ${s.def.nome}`;
    header.appendChild(titulo);
    gViewport.appendChild(header);
  });

  // Nós de Herança — cluster próprio abaixo de tudo (não são level-gated
  // nem entram no grafo de pré-requisito; cada um só depende de um evento
  // real do mundo, então ficam lado a lado, sem linhas de conexão).
  svg.setAttribute("height", altura + 170);
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 170}`);
  const tituloHeranca = svgEl("text", { class: "sub-titulo", "text-anchor": "middle", x: largura / 2, y: altura + 20 });
  tituloHeranca.textContent = "💠 Herança do Mundo (permanente — nunca respecável)";
  gViewport.appendChild(tituloHeranca);
  arvoreDeHeranca.forEach((n, idx) => {
    const x = largura / (arvoreDeHeranca.length + 1) * (idx + 1);
    const y = altura + 90;
    posicoes.set(n.id, { x, y });
    desenharNode(n, true, arvoreDeHeranca);
  });

  // --- pan / zoom --------------------------------------------------------
  let escala = 1, tx = 0, ty = 0, arrastando = false, ultimoX = 0, ultimoY = 0;
  function aplicarTransform() { gViewport.setAttribute("transform", `translate(${tx},${ty}) scale(${escala})`); }
  function centralizar() {
    const wrapRect = viewportWrap.getBoundingClientRect();
    escala = Math.min(1, wrapRect.width / largura);
    tx = (wrapRect.width - largura * escala) / 2;
    ty = 20;
    aplicarTransform();
  }
  // Captura o ponteiro só depois que o arrasto realmente começa (threshold
  // de alguns pixels) — se soltar a captura assim que ela é pedida no
  // pointerdown, um clique simples (sem mover o mouse) faz o navegador
  // redirecionar o "click" sintético pro próprio <svg> em vez do nó
  // clicado (comportamento de pointer capture do Chromium), e nenhum nó
  // nunca abriria o painel de detalhes. Só captura de verdade quando
  // detecta arrasto — cliques continuam funcionando normalmente.
  svg.addEventListener("pointerdown", (e) => {
    arrastando = true; ultimoX = e.clientX; ultimoY = e.clientY;
    svg._pointerIdAtual = e.pointerId; svg._capturado = false;
  });
  svg.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - ultimoX, dy = e.clientY - ultimoY;
    if (!svg._capturado && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      svg.setPointerCapture(e.pointerId);
      svg._capturado = true;
    }
    tx += dx; ty += dy;
    ultimoX = e.clientX; ultimoY = e.clientY;
    aplicarTransform();
  });
  function soltarArrasto(e) {
    arrastando = false;
    if (svg._capturado && e && e.pointerId != null) svg.releasePointerCapture(e.pointerId);
    svg._capturado = false;
  }
  svg.addEventListener("pointerup", soltarArrasto);
  svg.addEventListener("pointerleave", soltarArrasto);
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const novo = Math.max(0.35, Math.min(2.2, escala * (e.deltaY < 0 ? 1.1 : 0.9)));
    escala = novo;
    aplicarTransform();
  }, { passive: false });
  conteudo().querySelector("#btn-zoom-in").onclick = () => { escala = Math.min(2.2, escala * 1.2); aplicarTransform(); };
  conteudo().querySelector("#btn-zoom-out").onclick = () => { escala = Math.max(0.35, escala * 0.8); aplicarTransform(); };
  conteudo().querySelector("#btn-zoom-reset").onclick = centralizar;
  centralizar();

  // Botões "escolher esta subclasse" — anexados via DOM comum (fora do
  // SVG) logo abaixo do painel de pontos, pra não depender de clique
  // preciso dentro do gráfico em telas pequenas.
  if (!ch.subclasseId && personagem.nivel >= NIVEL_ESCOLHA_SUBCLASSE && subclassesOpcoes.length) {
    const bloco = document.createElement("div");
    bloco.id = "caminho-escolha-subclasse";
    bloco.innerHTML = `<p>Nível ${NIVEL_ESCOLHA_SUBCLASSE}+ alcançado — escolha sua subclasse (permanente):</p>`;
    subclassesOpcoes.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "primario";
      btn.textContent = `${s.icone || ""} ${s.nome}`;
      btn.onclick = () => {
        const r = escolherSubclasse(personagem, s.id, dados);
        if (r.ok) { onMudar(); montarCaminhoHerdeiro(personagem, dados, onMudar); }
      };
      bloco.appendChild(btn);
    });
    painelPontos.insertAdjacentElement("afterend", bloco);
  } else if (!ch.subclasseId && personagem.nivel < NIVEL_ESCOLHA_SUBCLASSE) {
    const aviso = document.createElement("p");
    aviso.id = "caminho-escolha-subclasse";
    aviso.textContent = `Subclasse disponível no nível ${NIVEL_ESCOLHA_SUBCLASSE} (faltam ${NIVEL_ESCOLHA_SUBCLASSE - personagem.nivel}).`;
    painelPontos.insertAdjacentElement("afterend", aviso);
  }
}
