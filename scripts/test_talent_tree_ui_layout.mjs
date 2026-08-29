// Testes puros da UI visual da árvore (task #95) — só as funções exportadas
// que não tocam DOM (classificação de tipo/estado, layout em grade,
// descrição de efeito/sinergia). O resto (SVG, pan/zoom, cliques) é coberto
// pelo smoke test de navegador (scripts/ não versiona esse arquivo — roda
// via Playwright manualmente, ver changelog da fase).
import {
  classificarTipoNode, estadoNode, calcularProfundidades, layoutLista,
  calcularLayoutArvore, descreverEfeito, descreverSinergia, personagemTemCaminhoHerdeiro,
} from "../src/ui/TalentTreeUI.js";
import { avaliarArvore, garantirEstadoCaminho } from "../src/systems/TalentSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosTalentsGuerreiro = JSON.parse(fs.readFileSync(new URL("../src/data/talentsGuerreiro.json", import.meta.url)));
const dadosTalentsMago = JSON.parse(fs.readFileSync(new URL("../src/data/talentsMago.json", import.meta.url)));
const dadosSubclasses = JSON.parse(fs.readFileSync(new URL("../src/data/subclasses.json", import.meta.url)));
const dadosReacoes = JSON.parse(fs.readFileSync(new URL("../src/data/elementalReactions.json", import.meta.url)));
const dadosHeranca = JSON.parse(fs.readFileSync(new URL("../src/data/heritageTree.json", import.meta.url)));

const arvoreGuerreiro = dadosTalentsGuerreiro.talentos;
const classeGuerreiro = arvoreGuerreiro.filter((n) => !n.subclasseId);
const subGuerreiro = ["guerreiro_devastador", "guerreiro_sentinela", "guerreiro_vendaval"].map((id) => ({
  def: dadosSubclasses.subclasses.find((s) => s.id === id),
  nodes: arvoreGuerreiro.filter((n) => n.subclasseId === id),
}));

// --- personagemTemCaminhoHerdeiro ------------------------------------------
{
  check("Guerreiro tem Caminho do Herdeiro", personagemTemCaminhoHerdeiro({ classeId: "guerreiro" }));
  check("Mago tem Caminho do Herdeiro", personagemTemCaminhoHerdeiro({ classeId: "mago" }));
  check("Ladino ainda NÃO tem (só 2 classes profundas por decisão do usuário)", !personagemTemCaminhoHerdeiro({ classeId: "ladino" }));
  check("não quebra com personagem undefined/null", !personagemTemCaminhoHerdeiro(null) && !personagemTemCaminhoHerdeiro(undefined));
}

// --- classificarTipoNode ----------------------------------------------------
{
  const vigor = classeGuerreiro.find((n) => n.id === "t_guerreiro_vigor_de_batalha");
  const golpeRompedor = classeGuerreiro.find((n) => n.id === "t_guerreiro_golpe_rompedor");
  const impetoFinal = classeGuerreiro.find((n) => n.id === "t_guerreiro_impeto_final");
  const folegoDeFerro = classeGuerreiro.find((n) => n.id === "t_guerreiro_folego_de_ferro");
  check("bonusAtributo classifica como passivo", classificarTipoNode(vigor, classeGuerreiro) === "passivo");
  check("concedeHabilidade com dependente (não é folha) classifica como ativo", classificarTipoNode(golpeRompedor, classeGuerreiro) === "ativo");
  check("folha com maior custo da classe (Ímpeto Final) classifica como ultimate", classificarTipoNode(impetoFinal, classeGuerreiro) === "ultimate");
  check("folha com custo menor que o maior (Fôlego de Ferro) fica só ativo, não ultimate", classificarTipoNode(folegoDeFerro, classeGuerreiro) === "ativo");

  const devastador = subGuerreiro.find((s) => s.def.id === "guerreiro_devastador").nodes;
  const golpeDeExecucao = devastador.find((n) => n.id === "t_devastador_golpe_de_execucao");
  const rupturaSelvagem = devastador.find((n) => n.id === "t_devastador_ruptura_selvagem");
  check("folha final de uma subclasse (Golpe de Execução) classifica como ultimate DENTRO do escopo da subclasse", classificarTipoNode(golpeDeExecucao, devastador) === "ultimate");
  check("nó do meio de uma subclasse (tem dependente) não é ultimate", classificarTipoNode(rupturaSelvagem, devastador) === "ativo");

  const herancaNode = dadosHeranca.nos[0];
  check("nó de herança classifica como heranca independente do efeito", classificarTipoNode(herancaNode, dadosHeranca.nos) === "heranca");
}

// --- calcularProfundidades / layoutLista -----------------------------------
{
  const prof = calcularProfundidades(classeGuerreiro);
  check("Vigor de Batalha (sem pré-requisito) tem profundidade 0", prof.get("t_guerreiro_vigor_de_batalha") === 0);
  check("Golpe Rompedor (requer Vigor) tem profundidade 1", prof.get("t_guerreiro_golpe_rompedor") === 1);
  check("Ímpeto Final (requer Golpe Rompedor) tem profundidade 2", prof.get("t_guerreiro_impeto_final") === 2);

  const layout = layoutLista(classeGuerreiro);
  check("layout cobre todos os 7 nós de classe", layout.size === 7);
  const ofensivo = layout.get("t_guerreiro_ramo_ofensivo");
  const defensivo = layout.get("t_guerreiro_ramo_defensivo");
  check("par exclusivo (Fúria Crescente / Pele de Pedra) fica na MESMA linha", ofensivo.row === defensivo.row);
  check("par exclusivo fica em colunas DIFERENTES (lado a lado, não empilhado)", ofensivo.col !== defensivo.col);
  const coordsUnicas = new Set([...layout.values()].map((p) => `${p.row},${p.col}`));
  check("nenhuma coordenada duplicada dentro da árvore de classe", coordsUnicas.size === layout.size);
}

// --- calcularLayoutArvore (grade completa: classe + 3 subclasses) ----------
{
  const { posicoes, largura, altura } = calcularLayoutArvore(classeGuerreiro, subGuerreiro);
  check("posiciona os 7 talentos de classe", classeGuerreiro.every((n) => posicoes.has(n.id)));
  check("posiciona os 9 talentos de subclasse (3x3)", subGuerreiro.every((s) => s.nodes.every((n) => posicoes.has(n.id))));
  check("largura e altura calculadas são positivas e finitas", largura > 0 && altura > 0 && Number.isFinite(largura) && Number.isFinite(altura));
  const coordsGuerreiro = [...posicoes.values()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
  check("nenhum talento cai exatamente em cima de outro (x,y únicos) na árvore inteira do Guerreiro", new Set(coordsGuerreiro).size === coordsGuerreiro.length);

  // Mesmo teste pro Mago, pra confirmar que o layout generaliza (não foi
  // ajustado só pro formato específico do Guerreiro).
  const arvoreMago = dadosTalentsMago.talentos;
  const classeMago = arvoreMago.filter((n) => !n.subclasseId);
  const subMago = ["mago_piromante", "mago_criomante", "mago_tecelao_do_eter"].map((id) => ({
    def: dadosSubclasses.subclasses.find((s) => s.id === id),
    nodes: arvoreMago.filter((n) => n.subclasseId === id),
  }));
  const layoutMago = calcularLayoutArvore(classeMago, subMago);
  const coordsMago = [...layoutMago.posicoes.values()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
  check("layout do Mago também não tem coordenadas duplicadas", new Set(coordsMago).size === coordsMago.length);
  check("layout do Mago também cobre os 16 talentos", layoutMago.posicoes.size === 16);
}

// --- estadoNode (usa avaliarArvore de verdade) ------------------------------
{
  const p = { nome: "Teste", classeId: "guerreiro", nivel: 1, atributos: { FOR: 10, DES: 10, CON: 10, INT: 10 }, hp: 100, hpMax: 100, mp: 50, mpMax: 50, equipamento: {}, habilidades: [], tracoId: null, racaId: "humano" };
  garantirEstadoCaminho(p);
  p.caminhoHerdeiro.pontosClasse = 5;
  const avaliacao = avaliarArvore(p, arvoreGuerreiro, {});
  const ativos = new Set();
  const vigor = classeGuerreiro.find((n) => n.id === "t_guerreiro_vigor_de_batalha");
  const golpeRompedor = classeGuerreiro.find((n) => n.id === "t_guerreiro_golpe_rompedor");
  check("nível 1, sem pré-requisito e com pontos: Vigor de Batalha fica desbloqueável", estadoNode(vigor, ativos, avaliacao) === "desbloqueavel");
  check("Golpe Rompedor (nível 3, ainda sem Vigor escolhido) fica bloqueado", estadoNode(golpeRompedor, ativos, avaliacao) === "bloqueado");
  ativos.add("t_guerreiro_vigor_de_batalha");
  check("depois de escolhido, o estado vira 'escolhido' mesmo sem reavaliar a árvore", estadoNode(vigor, ativos, avaliacao) === "escolhido");
}

// --- descreverEfeito / descreverSinergia -----------------------------------
{
  const vigor = classeGuerreiro.find((n) => n.id === "t_guerreiro_vigor_de_batalha");
  check("descreverEfeito de bonusAtributo menciona o valor e o atributo", descreverEfeito(vigor).includes("+2") && descreverEfeito(vigor).toLowerCase().includes("força"));

  const golpeRompedor = classeGuerreiro.find((n) => n.id === "t_guerreiro_golpe_rompedor");
  const efeitoTxt = descreverEfeito(golpeRompedor);
  check("descreverEfeito de concedeHabilidade menciona nome da habilidade, custo de MP e estado aplicado", efeitoTxt.includes("Golpe Rompedor") && efeitoTxt.includes("MP") && efeitoTxt.includes("exposto"));

  const sinergia = descreverSinergia(golpeRompedor, dadosReacoes);
  check("descreverSinergia acha a reação Ruptura de verdade (consome o estado Exposto)", !!sinergia && sinergia.toLowerCase().includes("ruptura"));

  const semEstado = classeGuerreiro.find((n) => n.id === "t_guerreiro_folego_de_ferro");
  check("descreverSinergia retorna null pra habilidade que não aplica nenhum estado", descreverSinergia(semEstado, dadosReacoes) === null);
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_talent_tree_ui_layout ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
