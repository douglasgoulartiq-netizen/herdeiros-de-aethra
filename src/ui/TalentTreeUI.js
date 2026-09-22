// Caminhos do Herdeiro — UI visual da árvore (task #95).
//
// Só Guerreiro e Mago têm uma árvore de Caminhos do Herdeiro de verdade
// hoje (task #93/#94 — "profundo em 2 classes primeiro"); qualquer outra
// classe continua usando a árvore-base (ui/SkillTreeUI.js). As duas telas
// compartilham a mesma navegação de Progressão do Herói, sem transformar
// seus motores internos em um componente monolítico.
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

export function personagemTemCaminhoHerdeiro(personagem) {
  return new Set(["guerreiro", "mago"]).has(personagem && personagem.classeId);
}

import { somTalento } from "./SoundFX.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

// A progressão usa trilhas HTML em todas as resoluções. O SVG continua
// sendo montado como representação estrutural/testável dos dados, mas não é
// mais a interface principal: comprimir o grafo inteiro na altura da janela
// tornava nomes e estados ilegíveis. As trilhas abaixo não usam zoom, mantêm
// o painel de detalhe fora da área dos nós e funcionam igual com mouse,
// toque, teclado e controle direcional.
const CSS_CAMINHO_ID = "css-caminho-herdeiro-fixo";
const CSS_CAMINHO = `
#modal-conteudo.arvore-caminhos{overflow:hidden}
#modal-conteudo.arvore-caminhos>h2{margin:2px 0 6px;font-size:clamp(1.05rem,2vw,1.45rem)}
#modal-conteudo.arvore-caminhos .progressao-heroi-nav{flex:0 0 auto;margin-bottom:5px}
#caminho-topo{flex:0 0 auto;padding:6px 8px;border:1px solid rgba(151,111,210,.28);border-radius:10px;background:rgba(8,7,16,.42)}
#caminho-pontos,#caminho-presets{gap:5px}
#caminho-pontos #btn-respec,.preset-btn{min-height:36px}
#caminho-corpo{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(270px,330px);gap:10px;min-height:0}
#caminho-viewport-wrap{min-height:0!important;height:auto!important;overflow:auto!important;overscroll-behavior:contain;border-color:rgba(151,111,210,.42)}
#caminho-viewport{min-height:100%;height:auto}
#svg-arvore{display:none!important}
.caminho-mobile-trilhas{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));align-items:start;gap:10px;padding:10px 10px 22px}
.caminho-mobile-legenda{position:sticky!important;top:-10px!important;z-index:5;grid-column:1/-1;display:flex;justify-content:center;gap:6px;margin:-10px -10px 0!important;padding:8px!important;background:rgba(16,12,26,.96)!important}
.caminho-mobile-trilha{min-width:0;padding:9px 9px 12px!important;border-color:rgba(143,100,201,.42)!important;background:linear-gradient(165deg,rgba(53,36,76,.62),rgba(18,15,28,.9))!important}
.caminho-mobile-trilha>h3{position:static!important;width:auto!important;margin:0 0 9px!important;padding:6px 10px!important;white-space:normal}
.caminho-mobile-nos{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
.caminho-mobile-no{width:100%;min-height:70px;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}
.caminho-mobile-no:not(:first-child)::before{display:block!important;left:29px!important;top:-12px!important;width:2px!important;height:10px!important;background:#876cb1!important}
.caminho-mobile-no:hover{transform:translateY(-1px);border-color:#a98bd2}
.caminho-mobile-no:focus-visible{outline:3px solid #fff1a8!important;outline-offset:2px}
.caminho-mobile-no.estado-bloqueado{opacity:.82!important;filter:saturate(.72)}
.caminho-mobile-no.estado-desbloqueavel{background:linear-gradient(135deg,rgba(85,61,24,.72),rgba(28,23,30,.96))!important}
.caminho-mobile-no.estado-escolhido{background:linear-gradient(135deg,rgba(21,67,45,.86),rgba(24,24,38,.96))!important}
.caminho-mobile-nome{font-size:.83rem!important;line-height:1.2!important}
.caminho-mobile-estado small{font-size:.56rem!important}
#caminho-detalhe.caminho-detalhe-fixo{position:sticky!important;inset:auto!important;top:0!important;z-index:2;align-self:start;width:100%!important;max-height:100%;display:flex;flex-direction:column;overflow:hidden;border:1px solid #7653a6;border-radius:12px;background:linear-gradient(180deg,#2b1f3d,#17131f);box-shadow:0 10px 28px rgba(0,0,0,.24);animation:none!important}
#caminho-detalhe.caminho-detalhe-fixo[hidden]{display:none!important}
#caminho-detalhe .hda-fechar{flex:0 0 auto;min-height:36px;margin:0;border-width:0 0 1px;border-radius:0;text-align:center}
#caminho-detalhe .hda-sheet-corpo{padding:0!important;flex:1 1 auto;min-height:0;overflow:auto}
@media(min-width:900px){#caminho-detalhe:has(#caminho-painel>.painel-vazio) .hda-fechar{display:none}}
#caminho-painel{display:block!important;position:static;align-self:start;width:100%!important;max-height:100%;overflow:auto;padding:12px;background:transparent;box-shadow:none}
#caminho-painel:empty{display:none!important}
#caminho-painel .painel-no-acao{position:sticky;bottom:0;padding:9px 0 2px;background:linear-gradient(0deg,#17131f 72%,transparent)}
#caminho-painel .painel-no-acao button{width:100%;min-height:44px}
@media(max-width:899px){
 #modal-conteudo.arvore-caminhos{display:flex!important;height:100dvh!important;padding:7px!important}
 #caminho-corpo{grid-template-columns:1fr;grid-template-rows:minmax(180px,1fr) auto}
 #caminho-detalhe.caminho-detalhe-fixo{position:static!important;max-height:min(34dvh,290px);border-radius:10px}
 #caminho-painel{position:static;max-height:none;border-radius:0}
 #caminho-painel .painel-vazio{display:none}
 .caminho-mobile-trilhas{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
}
@media(max-width:560px){
 #caminho-topo{max-height:min(132px,24dvh)!important;overflow-y:auto!important;overscroll-behavior:contain}
 #caminho-pontos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}
 #caminho-pontos .ponto-badge{padding:5px 4px;text-align:center;white-space:nowrap}
 #caminho-pontos #btn-respec{grid-column:1/-1;margin:0}
 #caminho-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}
 .preset-btn{padding:5px 4px;overflow:hidden;text-overflow:ellipsis}
 .caminho-mobile-trilhas{grid-template-columns:1fr}
}
@media(max-width:560px) and (max-height:840px){
 #caminho-topo{max-height:118px!important}
 #caminho-corpo{grid-template-rows:minmax(110px,1fr) minmax(0,160px)}
 #caminho-detalhe.caminho-detalhe-fixo{height:160px;max-height:160px}
 #caminho-detalhe .hda-sheet-corpo,#caminho-painel{height:100%;max-height:100%;min-height:0;overflow-y:auto}
}
@media(max-width:560px) and (max-height:650px){
 #modal-conteudo.arvore-caminhos>h2{font-size:.9rem}
 #caminho-topo{max-height:90px!important}
 #caminho-corpo{grid-template-rows:minmax(78px,1fr) minmax(0,124px)}
 #caminho-detalhe.caminho-detalhe-fixo{height:124px;max-height:124px}
}
@media(max-height:500px) and (orientation:landscape){
 #modal-conteudo.arvore-caminhos{display:grid!important;grid-template-columns:minmax(190px,250px) minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}
 #modal-conteudo.arvore-caminhos>.fechar{grid-column:1;grid-row:1}
 #modal-conteudo.arvore-caminhos>.progressao-heroi-nav{grid-column:2;grid-row:1;margin:0}
 #modal-conteudo.arvore-caminhos>h2{grid-column:1;grid-row:2;font-size:.9rem}
 #caminho-topo{grid-column:1;grid-row:3;align-content:start;overflow:auto!important}
 #caminho-corpo{grid-column:2;grid-row:2/4;grid-template-columns:minmax(0,1fr) minmax(230px,290px);grid-template-rows:1fr}
 #caminho-detalhe.caminho-detalhe-fixo{max-height:100%;overflow:hidden}
}
`;

function garantirCSSCaminho() {
  if (document.getElementById(CSS_CAMINHO_ID)) return;
  const style = document.createElement("style");
  style.id = CSS_CAMINHO_ID;
  style.textContent = CSS_CAMINHO;
  document.head.appendChild(style);
}

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().classList.remove("arvore-caminhos", "arvore-so-heranca");
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

const COL_W = 190;
const ROW_H = 165;
const SUB_LANE_W = 280;

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
const RAIO = 34;
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
export function montarCaminhoHerdeiro(personagem, dados, onMudar, opcoes = {}) {
  garantirCSSCaminho();
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
  const layout = calcularLayoutArvore(arvoreClasse, subclasses);
  const { posicoes, linhaBaseSubclasses } = layout;
  const somenteHeranca = arvoreClasse.length === 0 && subclasses.every((s) => s.nodes.length === 0);
  let altura = somenteHeranca ? 40 : layout.altura;
  conteudo().classList.toggle("arvore-so-heranca", somenteHeranca);
  // Cada nó de Herança precisa de uma célula de texto própria. Antes cinco
  // nomes longos eram espremidos na largura mínima da árvore de classe e se
  // transformavam numa frase única sobreposta.
  let largura = Math.max(layout.largura, arvoreDeHeranca.length * 190 + 120);
  const deslocamentoX = (largura - layout.largura) / 2;
  if (deslocamentoX) posicoes.forEach((p, id) => posicoes.set(id, { ...p, x: p.x + deslocamentoX }));

  let noSelecionado = null;

  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <nav class="progressao-heroi-nav" aria-label="Progressão do herói">
      ${opcoes.abrirHabilidades ? '<button type="button" data-progressao-habilidades>🌳 Habilidades e cards</button>' : ""}
      <button class="ativo" type="button" aria-current="page">💠 Caminhos e Herança</button>
    </nav>
    <h2>Caminhos do Herdeiro — ${personagem.classeNome || personagem.classeId}</h2>
    <div id="caminho-topo">
      <div id="caminho-pontos"></div>
      <div id="caminho-presets"></div>
    </div>
    <div id="caminho-corpo">
      <div id="caminho-viewport-wrap">
        <div id="caminho-viewport"></div>
      </div>
      <aside id="caminho-detalhe" class="caminho-detalhe-fixo" aria-label="Detalhes do talento" hidden>
        <button type="button" class="hda-fechar">Fechar detalhes</button>
        <div class="hda-sheet-corpo"><div id="caminho-painel"></div></div>
      </aside>
    </div>
  `;
  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  const btnHabilidades = conteudo().querySelector("[data-progressao-habilidades]");
  if (btnHabilidades) btnHabilidades.onclick = opcoes.abrirHabilidades;

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
    montarCaminhoHerdeiro(personagem, dados, onMudar, opcoes);
  };

  // --- presets --------------------------------------------------------------
  const painelPresets = conteudo().querySelector("#caminho-presets");
  ch.presets.forEach((preset, idx) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn" + (idx === ch.presetAtivo ? " ativo" : "");
    btn.textContent = preset.nome;
    btn.title = "Clique para ativar este build; clique duplo ou F2 para renomear.";
    btn.setAttribute("aria-pressed", idx === ch.presetAtivo ? "true" : "false");
    btn.onclick = () => {
      alternarPreset(personagem, idx);
      onMudar();
      montarCaminhoHerdeiro(personagem, dados, onMudar, opcoes);
    };
    btn.ondblclick = () => {
      const novoNome = prompt("Novo nome do build:", preset.nome);
      if (novoNome) {
        renomearPreset(personagem, idx, novoNome);
        montarCaminhoHerdeiro(personagem, dados, onMudar, opcoes);
      }
    };
    btn.onkeydown = (evento) => {
      if (evento.key !== "F2") return;
      evento.preventDefault();
      btn.ondblclick();
    };
    painelPresets.appendChild(btn);
  });

  // --- painel de detalhes do nó ---------------------------------------------
  //
  // O detalhe sempre ocupa uma região própria do layout. Assim ele nunca
  // cobre os nós: no desktop é uma coluna fixa e, no mobile, uma faixa abaixo
  // da trilha. O conteúdo continua sendo o mesmo nas duas resoluções.
  const painel = conteudo().querySelector("#caminho-painel");
  const detalhe = conteudo().querySelector("#caminho-detalhe");
  const casaDoPainel = painel.parentElement;
  function apresentarPainel() {
    if (painel.parentElement !== casaDoPainel) casaDoPainel.appendChild(painel);
    painel.setAttribute("aria-live", "polite");
    detalhe.hidden = false;
    detalhe.classList.toggle("hda-sheet", matchMedia("(max-width:899px)").matches);
  }
  detalhe.querySelector(".hda-fechar").onclick = () => { detalhe.hidden = true; };
  function renderPainel() {
    if (!noSelecionado) {
      const bonus = bonusCaminhoHerdeiro(personagem, dados);
      const linhasBonus = Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => `${k}: ${typeof v === "number" && Math.abs(v) < 1 ? (v * 100).toFixed(0) + "%" : "+" + v}`).join(", ") || "nenhum ainda";
      painel.innerHTML = `<p class="painel-vazio"><b>Escolha um talento</b><br>Use toque, clique ou as setas do teclado para ver seus detalhes.</p><p class="painel-vazio">Bônus ativo agora (build "${ch.presets[ch.presetAtivo].nome}"): ${linhasBonus}</p>`;
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
        if (r.ok) { somTalento(); onMudar(); montarCaminhoHerdeiro(personagem, dados, onMudar, opcoes); }
      };
      acao.appendChild(btn);
    } else {
      acao.innerHTML = `<span class="tag">Bloqueado por enquanto</span>`;
    }
    apresentarPainel();
  }
  function escopoCompleto(ehHeranca) { return ehHeranca ? arvoreDeHeranca : arvoreCompleta; }
  renderPainel();
  if (matchMedia("(min-width:900px)").matches) apresentarPainel();

  // Em telas estreitas, a progressão ganha uma representação própria em
  // trilhas verticais. Ela conserva os mesmos nós e regras do SVG desktop,
  // mas não exige zoom, gesto de pinça ou leitura de rótulos reduzidos.
  const trilhasMobile = document.createElement("div");
  trilhasMobile.className = "caminho-mobile-trilhas";
  trilhasMobile.innerHTML = `<div class="caminho-mobile-legenda" aria-label="Legenda dos talentos"><span class="disponivel">✦ Disponível</span><span class="escolhido">✓ Escolhido</span><span class="bloqueado">🔒 Bloqueado</span></div>`;
  function criarTrilhaMobile(titulo, nodes, ehHeranca = false) {
    if (!nodes.length) return;
    const secao = document.createElement("section"); secao.className = "caminho-mobile-trilha";
    const h = document.createElement("h3"); h.textContent = titulo; secao.appendChild(h);
    const lista = document.createElement("div"); lista.className = "caminho-mobile-nos";
    [...nodes].sort((a, b) => (a.nivelMinimo || 1) - (b.nivelMinimo || 1)).forEach((node) => {
      const escopo = ehHeranca ? arvoreDeHeranca : (node.subclasseId ? nodes : arvoreClasse);
      const avaliacao = ehHeranca ? avaliacaoHeranca : avaliacaoClasse;
      const estadoNo = estadoNode(node, ativos, avaliacao);
      const item = document.createElement("button"); item.type = "button";
      item.className = `caminho-mobile-no estado-${estadoNo} tipo-${classificarTipoNode(node, escopo)}`;
      item.dataset.caminhoNo = node.id;
      item.dataset.nivel = String(node.nivelMinimo || 1);
      const rotuloEstado = estadoNo === "escolhido" ? "Escolhido" : estadoNo === "desbloqueavel" ? "Disponível" : "Bloqueado";
      item.setAttribute("aria-label", `${node.nome}, nível ${node.nivelMinimo || 1}, ${rotuloEstado}`);
      item.setAttribute("aria-pressed", estadoNo === "escolhido" ? "true" : "false");
      item.innerHTML = `<span class="caminho-mobile-nivel">NÍVEL ${node.nivelMinimo || 1}</span><span class="caminho-mobile-icone" aria-hidden="true">${node.icone || "❔"}</span><span class="caminho-mobile-nome">${node.nome}</span><span class="caminho-mobile-estado">${estadoNo === "escolhido" ? "✓" : estadoNo === "desbloqueavel" ? "✦" : "🔒"}<small>${rotuloEstado}</small></span>`;
      item.onclick = () => {
        noSelecionado = { node, ehHeranca, escopo };
        trilhasMobile.querySelectorAll(".selecionado").forEach((el) => el.classList.remove("selecionado"));
        item.classList.add("selecionado"); renderPainel();
      };
      lista.appendChild(item);
    });
    secao.appendChild(lista); trilhasMobile.appendChild(secao);
  }
  criarTrilhaMobile("◆ Trilha da classe", arvoreClasse);
  subclasses.forEach((s) => criarTrilhaMobile(`${s.def.icone || "◇"} ${s.def.nome}`, s.nodes));
  criarTrilhaMobile("💠 Herança do Mundo", arvoreDeHeranca, true);
  conteudo().querySelector("#caminho-viewport").appendChild(trilhasMobile);

  // Setas percorrem os nós na mesma ordem visual das trilhas. Home/End
  // levam ao primeiro/último talento; Enter e Espaço já disparam o clique
  // nativo do <button>. Isso elimina a dependência de mouse sem criar uma
  // segunda regra de seleção.
  trilhasMobile.addEventListener("keydown", (evento) => {
    if (!evento.target.matches("[data-caminho-no]")) return;
    const itens = [...trilhasMobile.querySelectorAll("[data-caminho-no]")];
    const atual = itens.indexOf(evento.target);
    let destino = atual;
    if (evento.key === "ArrowDown" || evento.key === "ArrowRight") destino = Math.min(itens.length - 1, atual + 1);
    else if (evento.key === "ArrowUp" || evento.key === "ArrowLeft") destino = Math.max(0, atual - 1);
    else if (evento.key === "Home") destino = 0;
    else if (evento.key === "End") destino = itens.length - 1;
    else return;
    evento.preventDefault();
    itens[destino]?.focus();
  });

  // --- SVG do grafo -----------------------------------------------------
  const viewportWrap = conteudo().querySelector("#caminho-viewport");
  const svg = svgEl("svg", { width: "100%", height: "100%", id: "svg-arvore" });
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
    const g = svgEl("g", { class: `no-caminho tipo-${tipo} estado-${estado}`, transform: `translate(${p.x},${p.y})`, tabindex: "0", role: "button", "aria-label": `${node.nome}, nível ${node.nivelMinimo || 1}, ${estado}` });
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
    const nivel = svgEl("text", { class: "no-nivel", "text-anchor": "middle", y: -RAIO - 13 });
    nivel.textContent = `NÍVEL ${node.nivelMinimo || 1}`;
    g.appendChild(nivel);
    if (estado === "escolhido") {
      const check = svgEl("text", { class: "no-check", x: RAIO * 0.6, y: -RAIO * 0.6, "text-anchor": "middle" });
      check.textContent = "✅";
      g.appendChild(check);
    }
    const label = svgEl("text", { class: "no-label", "text-anchor": "middle", y: RAIO + 18 });
    const palavras = String(node.nome || "").split(/\s+/);
    const linhas = [""];
    palavras.forEach((palavra) => {
      const atual = linhas[linhas.length - 1];
      if (atual && `${atual} ${palavra}`.length > 18 && linhas.length < 3) linhas.push(palavra);
      else linhas[linhas.length - 1] = atual ? `${atual} ${palavra}` : palavra;
    });
    linhas.forEach((linha, i) => {
      const tspan = svgEl("tspan", { x: 0, dy: i ? 15 : 0 });
      tspan.textContent = linha;
      label.appendChild(tspan);
    });
    g.appendChild(label);
    g.style.cursor = "pointer";
    g.addEventListener("click", () => {
      noSelecionado = { node, ehHeranca, escopo };
      renderPainel();
      conteudo().querySelectorAll(".no-caminho.selecionado").forEach((el) => el.classList.remove("selecionado"));
      g.classList.add("selecionado");
    });
    g.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
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
  svg.setAttribute("height", "100%");
  const tituloHeranca = svgEl("text", { class: "sub-titulo", "text-anchor": "middle", x: largura / 2, y: altura + 20 });
  tituloHeranca.textContent = "💠 Herança do Mundo (permanente — nunca respecável)";
  gViewport.appendChild(tituloHeranca);
  arvoreDeHeranca.forEach((n, idx) => {
    const x = largura / 2 + (idx - (arvoreDeHeranca.length - 1) / 2) * 190;
    const y = altura + 90;
    posicoes.set(n.id, { x, y });
    desenharNode(n, true, arvoreDeHeranca);
  });

  // --- painel fixo -------------------------------------------------------
  // Sem zoom e sem arrasto: o diagrama mantém uma escala legível e o
  // jogador percorre a trilha com a rolagem normal da página.
  const alturaTotal = altura + 170;
  svg.setAttribute("viewBox", `0 0 ${largura} ${alturaTotal}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMin meet");
  function ajustarPainelFixo() {
    const larguraVisivel = viewportWrap.clientWidth || largura;
    const alturaVisivel = viewportWrap.clientHeight || 430;
    // O desenho sempre cabe na altura útil: classe, subclasses e Herança
    // permanecem simultaneamente visíveis, sem uma longa rolagem vertical.
    // Em telas estreitas conservamos largura mínima e só aceitamos rolagem
    // horizontal, pois reduzir mais faria os nomes deixarem de ser legíveis.
    const larguraDesenho = larguraVisivel < 720 ? Math.min(largura, 720) : larguraVisivel;
    svg.style.width = `${larguraDesenho}px`;
    svg.style.height = `${Math.max(300, alturaVisivel)}px`;
  }
  ajustarPainelFixo();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(ajustarPainelFixo).observe(viewportWrap);

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
        if (r.ok) { somTalento(); onMudar(); montarCaminhoHerdeiro(personagem, dados, onMudar, opcoes); }
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
