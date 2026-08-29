// Testes da árvore de talentos do Mago (task #94) — mesmo padrão de
// test_arvore_guerreiro.mjs, com dados REAIS de talentsMago.json/
// subclasses.json. A corrente elemental testada aqui é diferente da do
// Guerreiro: Lança de Gelo (Criomante) aplica Congelado diretamente, e um
// golpe físico de qualquer aliado depois disso aciona Estilhaçar (crítico
// garantido) — prova que o motor de reações da task #91 reage igual não
// importa se o estado veio de uma reação anterior ou de uma habilidade que
// o aplica direto.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import {
  garantirEstadoCaminho, concederPontosPorNivel, escolherTalento, escolherSubclasse,
  arvoreDoPersonagem, bonusCaminhoHerdeiro,
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
const dadosTalentsMago = JSON.parse(fs.readFileSync(new URL("../src/data/talentsMago.json", import.meta.url)));
const dadosSubclasses = JSON.parse(fs.readFileSync(new URL("../src/data/subclasses.json", import.meta.url)));
const dadosClasses = JSON.parse(fs.readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const dados = { talentsMago: dadosTalentsMago, subclasses: dadosSubclasses, heritageTree: { nos: [] }, classes: dadosClasses };

function fakePersonagemMago(nivel = 1) {
  return {
    nome: "Mago de Teste", classeId: "mago", nivel,
    atributos: { FOR: 8, DES: 8, CON: 8, INT: 14 },
    hp: 80, hpMax: 80, mp: 60, mpMax: 60,
    equipamento: { arma: { elemento: "arcano", dano: 4, atributo: "INT", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano",
  };
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin de Teste", hp: 5000, atk: 5, defesa: 10, vel: 5, elemento: "fisico", chefe: false, xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

function subirAte(p, nivel) {
  for (let n = p.nivel + 1; n <= nivel; n++) concederPontosPorNivel(p, n);
  p.nivel = nivel;
}

// --- os 16 talentos existem, com ids únicos e todos têm efeito ---
{
  const arvore = dadosTalentsMago.talentos;
  check("a árvore do Mago tem 16 talentos", arvore.length === 16);
  check("todos declaram um efeito real (bonusAtributo ou concedeHabilidade)", arvore.every((t) => t.efeito && (t.efeito.tipo === "bonusAtributo" || t.efeito.tipo === "concedeHabilidade")));
  check("7 são de classe (sem subclasseId)", arvore.filter((t) => !t.subclasseId).length === 7);
  check("3 subclasses com 3 talentos cada (9 no total)", arvore.filter((t) => t.subclasseId).length === 9);
  check("3 habilidades de subclasse aplicam estado elemental real (Incendiado/Congelado/Instável)", arvore.filter((t) => t.efeito.tipo === "concedeHabilidade" && t.efeito.habilidade.aplicaEstado).length === 3);
}

// --- percurso completo: talentos de classe, ramo exclusivo, subclasse Criomante ---
{
  const p = fakePersonagemMago(1);
  subirAte(p, 15);
  p.caminhoHerdeiro.pontosClasse = 20;

  check("Intelecto Afiado", escolherTalento(p, "t_mago_intelecto_afiado", arvoreDoPersonagem(p, dados), dados).ok);
  check("Fluxo de Mana", escolherTalento(p, "t_mago_fluxo_de_mana", arvoreDoPersonagem(p, dados), dados).ok);
  check("Bola de Energia (precisa de Intelecto Afiado)", escolherTalento(p, "t_mago_bola_de_energia", arvoreDoPersonagem(p, dados), dados).ok);
  check("Foco Ofensivo (ramo exclusivo)", escolherTalento(p, "t_mago_ramo_ofensivo", arvoreDoPersonagem(p, dados), dados).ok);
  const retencao = escolherTalento(p, "t_mago_ramo_defensivo", arvoreDoPersonagem(p, dados), dados);
  check("Retenção Etérea fica bloqueada (grupo exclusivo já escolhido)", retencao.ok === false);
  check("Bola de Energia concedeu a habilidade jogável de verdade", p.habilidades.some((h) => h.id === "bola_de_energia"));

  const bonus = bonusCaminhoHerdeiro(p, dados);
  check("bônus agregado bate (INT +2, mpMaxPercent +0.08, critChance +0.08)", bonus.INT === 2 && Math.abs(bonus.mpMaxPercent - 0.08) < 1e-9 && Math.abs(bonus.critChance - 0.08) < 1e-9);

  const escolha = escolherSubclasse(p, "mago_criomante", dados);
  check("escolhe a subclasse Criomante", escolha.ok === true);
  p.caminhoHerdeiro.pontosSubclasse = 10;
  check("Frio Penetrante (subclasse Criomante)", escolherTalento(p, "t_criomante_frio_penetrante", arvoreDoPersonagem(p, dados), dados).ok);
  check("Lança de Gelo (subclasse Criomante)", escolherTalento(p, "t_criomante_lanca_de_gelo", arvoreDoPersonagem(p, dados), dados).ok);

  const outraSubclasse = escolherTalento(p, "t_piromante_chama_interior", arvoreDoPersonagem(p, dados), dados);
  check("talento de OUTRA subclasse (Piromante) continua bloqueado pra um Criomante", outraSubclasse.ok === false);
}

// --- corrente completa: Lança de Gelo aplica Congelado -> golpe físico aciona Estilhaçar ---
{
  FLAGS.reacoesElementais = true;
  const pMago = fakePersonagemMago(1);
  // Lança de Gelo exige nível 12 (t_criomante_lanca_de_gelo.nivelMinimo) e a
  // subclasse só pode ser escolhida a partir do nível 10 (nivelRequerido) —
  // ao contrário do Golpe Rompedor do Guerreiro (nível 3), aqui é preciso
  // subir bem mais antes de conseguir montar a corrente completa.
  subirAte(pMago, 15);
  pMago.caminhoHerdeiro.pontosClasse = 5;
  pMago.caminhoHerdeiro.pontosSubclasse = 5;
  escolherSubclasse(pMago, "mago_criomante", dados);
  escolherTalento(pMago, "t_criomante_frio_penetrante", arvoreDoPersonagem(pMago, dados), dados);
  const r1 = escolherTalento(pMago, "t_criomante_lanca_de_gelo", arvoreDoPersonagem(pMago, dados), dados);
  check("Lança de Gelo escolhida com sucesso", r1.ok === true);

  const pGuerreiro = { nome: "Aliado Físico", classeId: "guerreiro", nivel: 5, atributos: { FOR: 14, DES: 10, CON: 10, INT: 5 }, hp: 100, hpMax: 100, mp: 20, mpMax: 20, equipamento: { arma: { elemento: "fisico", dano: 10, atributo: "FOR", bonusCritico: 0 } }, habilidades: [], tracoId: null, racaId: "humano" };

  const jMago = criarCombatenteJogador(pMago, {}, "retaguarda");
  const jGuerreiro = criarCombatenteJogador(pGuerreiro, {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jMago, jGuerreiro], [inimigo], dadosElementos, null, [], 0, null, false, dadosEstados, dadosReacoes);

  const habilidadeLancaDeGelo = jMago.habilidades.find((h) => h.id === "lanca_de_gelo");
  check("a habilidade Lança de Gelo sobrevive à criação do combatente", !!habilidadeLancaDeGelo);

  let congelou = false;
  for (let i = 0; i < 60 && !congelou; i++) {
    const r = batalha.usarHabilidade(jMago, { ...habilidadeLancaDeGelo, cooldownAtual: 0 }, inimigo);
    if (r.ok && estadoElementalAtivo(inimigo)?.estadoId === "congelado") congelou = true;
  }
  check("Lança de Gelo (do talento real) aplicou Congelado direto no alvo (sem precisar de reação Molhado+Gelo)", congelou);

  let estilhacou = null;
  for (let i = 0; i < 60 && !estilhacou; i++) {
    if (estadoElementalAtivo(inimigo)?.estadoId !== "congelado") {
      const r2 = batalha.usarHabilidade(jMago, { ...habilidadeLancaDeGelo, cooldownAtual: 0 }, inimigo);
      if (!r2.ok || estadoElementalAtivo(inimigo)?.estadoId !== "congelado") continue;
    }
    const r = batalha.rolarAtaque(jGuerreiro, inimigo);
    if (r.acertou && r.reacaoElemental) estilhacou = r.reacaoElemental;
  }
  check("um golpe físico de outro aliado aciona Estilhaçar (crítico garantido) no alvo Congelado", estilhacou && estilhacou.id === "estilhacar");
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_arvore_mago ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
