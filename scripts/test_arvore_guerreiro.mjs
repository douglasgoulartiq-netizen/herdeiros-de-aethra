// Testes da árvore de talentos do Guerreiro (task #93) — usa os dados REAIS
// de src/data/talentsGuerreiro.json e src/data/subclasses.json (não uma
// árvore sintética como test_caminhos_herdeiro_arquitetura.mjs), e prova a
// integração ponta a ponta com os dois motores anteriores: escolher um
// talento realmente concede uma habilidade jogável em combate (task #92),
// e essa habilidade realmente aplica um estado elemental que uma reação
// real consome depois (task #91) — a corrente completa Golpe Rompedor
// (Exposto) -> golpe físico -> reação Ruptura.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import {
  garantirEstadoCaminho, concederPontosPorNivel, escolherTalento, escolherSubclasse,
  arvoreDoPersonagem, talentosAtivos, bonusCaminhoHerdeiro, avaliarArvore, NIVEL_ESCOLHA_SUBCLASSE,
} from "../src/systems/TalentSystem.js";
import { estadoElementalAtivo } from "../src/systems/ElementalReactionSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));
const dadosEstados = JSON.parse(fs.readFileSync(new URL("../src/data/elementalStates.json", import.meta.url)));
const dadosReacoes = JSON.parse(fs.readFileSync(new URL("../src/data/elementalReactions.json", import.meta.url)));
const dadosTalentsGuerreiro = JSON.parse(fs.readFileSync(new URL("../src/data/talentsGuerreiro.json", import.meta.url)));
const dadosSubclasses = JSON.parse(fs.readFileSync(new URL("../src/data/subclasses.json", import.meta.url)));
const dadosClasses = JSON.parse(fs.readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const dados = { talentsGuerreiro: dadosTalentsGuerreiro, subclasses: dadosSubclasses, heritageTree: { nos: [] }, classes: dadosClasses };

function fakePersonagemGuerreiro(nivel = 1) {
  return {
    nome: "Guerreiro de Teste", classeId: "guerreiro", nivel,
    atributos: { FOR: 10, DES: 10, CON: 10, INT: 10 },
    hp: 100, hpMax: 100, mp: 50, mpMax: 50,
    equipamento: { arma: { elemento: "fisico", dano: 10, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano",
  };
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin de Teste", hp: 5000, atk: 5, defesa: 20, vel: 5, elemento: "fisico", chefe: false, xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

function subirAte(p, nivel) {
  for (let n = p.nivel + 1; n <= nivel; n++) concederPontosPorNivel(p, n);
  p.nivel = nivel;
}

// --- os 16 talentos existem, com ids únicos e todos têm efeito ---
{
  const arvore = dadosTalentsGuerreiro.talentos;
  check("a árvore do Guerreiro tem 16 talentos", arvore.length === 16);
  check("todos declaram um efeito real (bonusAtributo ou concedeHabilidade)", arvore.every((t) => t.efeito && (t.efeito.tipo === "bonusAtributo" || t.efeito.tipo === "concedeHabilidade")));
  check("7 são de classe (sem subclasseId)", arvore.filter((t) => !t.subclasseId).length === 7);
  check("3 subclasses com 3 talentos cada (9 no total)", arvore.filter((t) => t.subclasseId).length === 9);
}

// --- percurso completo de um Guerreiro Devastador até o fim da árvore dele ---
{
  const p = fakePersonagemGuerreiro(1);
  subirAte(p, 15);
  check(`no nível 15, acumulou pontos de classe suficientes (14) pros 7 talentos de classe (custo total 1+1+2+1+1+2+3=11)`, p.caminhoHerdeiro.pontosClasse >= 11);

  // Talentos de classe, na ordem certa de pré-requisito.
  check("Vigor de Batalha", escolherTalento(p, "t_guerreiro_vigor_de_batalha", arvoreDoPersonagem(p, dados), dados).ok);
  check("Couraça de Campo", escolherTalento(p, "t_guerreiro_couraca_de_campo", arvoreDoPersonagem(p, dados), dados).ok);
  check("Golpe Rompedor (precisa de Vigor de Batalha)", escolherTalento(p, "t_guerreiro_golpe_rompedor", arvoreDoPersonagem(p, dados), dados).ok);
  check("Fúria Crescente (ramo exclusivo)", escolherTalento(p, "t_guerreiro_ramo_ofensivo", arvoreDoPersonagem(p, dados), dados).ok);
  const pele = escolherTalento(p, "t_guerreiro_ramo_defensivo", arvoreDoPersonagem(p, dados), dados);
  check("Pele de Pedra fica bloqueada (grupo exclusivo já escolhido)", pele.ok === false);

  check("Golpe Rompedor concedeu a habilidade jogável de verdade", p.habilidades.some((h) => h.id === "golpe_rompedor"));
  const bonusAntes = bonusCaminhoHerdeiro(p, dados);
  check("Vigor de Batalha + Fúria Crescente já valem no bônus agregado (FOR +2, critChance +0.08)", bonusAntes.FOR === 2 && Math.abs(bonusAntes.critChance - 0.08) < 1e-9);

  // Subclasse: só no nível 10+, e só depois de escolher fica liberado o resto da árvore dela.
  const cedo = escolherTalento(p, "t_devastador_fratura", arvoreDoPersonagem(p, dados), dados);
  check("talento de subclasse bloqueado ANTES de escolher a subclasse", cedo.ok === false);
  const escolha = escolherSubclasse(p, "guerreiro_devastador", dados);
  check("escolhe a subclasse Devastador no nível 15 (>= 10)", escolha.ok === true);
  // Pontos de subclasse são uma moeda separada dos de classe — o teste
  // aqui foca em pré-requisito/exclusividade de subclasse, não na
  // progressão natural de marcos (essa já é coberta por
  // test_caminhos_herdeiro_arquitetura.mjs), então garante saldo direto.
  p.caminhoHerdeiro.pontosSubclasse = 10;
  check("Fratura (subclasse Devastador)", escolherTalento(p, "t_devastador_fratura", arvoreDoPersonagem(p, dados), dados).ok);
  check("Ruptura Selvagem (subclasse Devastador)", escolherTalento(p, "t_devastador_ruptura_selvagem", arvoreDoPersonagem(p, dados), dados).ok);

  const outraSubclasse = escolherTalento(p, "t_sentinela_vigilancia", arvoreDoPersonagem(p, dados), dados);
  check("talento de OUTRA subclasse (Sentinela) continua bloqueado pra um Devastador", outraSubclasse.ok === false);
}

// --- corrente completa: talento -> habilidade -> Exposto -> Ruptura (integra as tasks #91, #92 e #93) ---
{
  FLAGS.reacoesElementais = true;
  const p = fakePersonagemGuerreiro(1);
  subirAte(p, 3);
  p.caminhoHerdeiro.pontosClasse = 10;
  escolherTalento(p, "t_guerreiro_vigor_de_batalha", arvoreDoPersonagem(p, dados), dados);
  escolherTalento(p, "t_guerreiro_golpe_rompedor", arvoreDoPersonagem(p, dados), dados);
  const habilidadeGolpeRompedor = p.habilidades.find((h) => h.id === "golpe_rompedor");
  check("a habilidade concedida está pronta pra usar em combate", !!habilidadeGolpeRompedor);

  const jogador = criarCombatenteJogador(p, {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase({ defesa: 30 }), 0);
  const batalha = new Batalha([jogador], [inimigo], dadosElementos, null, [], 0, null, false, dadosEstados, dadosReacoes);

  const habilidadeNoCombatente = jogador.habilidades.find((h) => h.id === "golpe_rompedor");
  check("o talento concedido sobrevive à criação do combatente (criarCombatenteJogador copia personagem.habilidades)", !!habilidadeNoCombatente);

  let usou = null;
  for (let i = 0; i < 60 && !usou; i++) {
    const r = batalha.usarHabilidade(jogador, { ...habilidadeNoCombatente, cooldownAtual: 0 }, inimigo);
    if (r.ok && estadoElementalAtivo(inimigo)) usou = r;
  }
  check("Golpe Rompedor (do talento real) aplicou o estado Exposto no alvo", estadoElementalAtivo(inimigo)?.estadoId === "exposto");

  // Agora um golpe físico comum deve acionar a reação Ruptura (ver
  // elementalReactions.json/task #91) — prova que o estado aplicado por um
  // talento novo realmente alimenta o motor de reações já existente.
  let reacaoAconteceu = null;
  for (let i = 0; i < 60 && !reacaoAconteceu; i++) {
    if (!estadoElementalAtivo(inimigo)) {
      // se já foi consumido/expirou numa tentativa anterior, reaplica pra continuar testando
      const r2 = batalha.usarHabilidade(jogador, { ...habilidadeNoCombatente, cooldownAtual: 0 }, inimigo);
      if (!r2.ok || !estadoElementalAtivo(inimigo)) continue;
    }
    const r = batalha.rolarAtaque(jogador, inimigo);
    if (r.acertou && r.reacaoElemental) reacaoAconteceu = r.reacaoElemental;
  }
  check("um golpe físico comum depois disso aciona a reação Ruptura (Exposto + físico)", reacaoAconteceu && reacaoAconteceu.id === "ruptura");
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_arvore_guerreiro ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
