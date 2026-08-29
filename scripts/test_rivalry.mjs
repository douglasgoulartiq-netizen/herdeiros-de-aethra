// Regressão para Rivalidade/Amizade entre convocados específicos (melhoria
// de jogabilidade pós-backlog, ver RivalrySystem.js: PARES_RELACIONAMENTO/
// paresAtivosNoTime/aplicarParesRelacionamento/paresRelacionamentoPreview),
// integrada em BattleUI.js junto das sinergias de formação/facção (tasks
// anteriores). Pares são identificados por rosterId (gachaRoster.json), não
// pelo uid da instância nem pela classe/facção agregada.
import {
  PARES_RELACIONAMENTO, paresAtivosNoTime, aplicarParesRelacionamento, paresRelacionamentoPreview,
} from "../src/systems/RivalrySystem.js";
import { criarCombatenteJogador } from "../src/systems/CombatSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function fakePersonagem(nome, rosterId) {
  return {
    nome, hp: 100, hpMax: 100, mp: 20, mpMax: 20, rosterId: rosterId || null,
    atributos: { FOR: 5, DES: 5, CON: 5, INT: 5 },
    equipamento: { arma: { elemento: "fisico", dano: 10, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano", spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}

// --- tabela de pares: schema básico e nenhum id duplicado ---
{
  check("existem pelo menos 4 pares curados", PARES_RELACIONAMENTO.length >= 4);
  const idsVistos = new Set();
  PARES_RELACIONAMENTO.forEach((par) => {
    check(`${par.id} tem tipo válido (rivalidade|amizade)`, par.tipo === "rivalidade" || par.tipo === "amizade");
    check(`${par.id} tem exatamente 2 rosterIds`, Array.isArray(par.rosterIds) && par.rosterIds.length === 2 && par.rosterIds[0] !== par.rosterIds[1]);
    check(`${par.id} tem nome/ícone/descrição`, !!par.nome && !!par.icone && !!par.descricao);
    check(`${par.id} tem bonus definido`, !!par.bonus);
    check(`${par.id} não repete id`, !idsVistos.has(par.id));
    idsVistos.add(par.id);
  });
  check("pelo menos 1 par de rivalidade e 1 de amizade", PARES_RELACIONAMENTO.some((p) => p.tipo === "rivalidade") && PARES_RELACIONAMENTO.some((p) => p.tipo === "amizade"));
}

// --- paresAtivosNoTime: sem os dois lados presentes, nenhum par ativa ---
{
  const par = PARES_RELACIONAMENTO[0];
  const membros = [fakePersonagem("Herói", null), fakePersonagem("A", par.rosterIds[0])];
  check("só 1 lado do par presente não ativa nada", paresAtivosNoTime(membros).length === 0);
  check("array vazio/undefined não quebra", paresAtivosNoTime([]).length === 0 && paresAtivosNoTime(undefined).length === 0);
}

// --- paresAtivosNoTime: os dois lados presentes ativa o par ---
{
  const par = PARES_RELACIONAMENTO[0];
  const membros = [fakePersonagem("Herói", null), fakePersonagem("A", par.rosterIds[0]), fakePersonagem("B", par.rosterIds[1])];
  const ativos = paresAtivosNoTime(membros);
  check("os dois lados do par presentes ativa exatamente 1 par", ativos.length === 1 && ativos[0].id === par.id);
  check("paresRelacionamentoPreview (prévia) devolve o mesmo resultado", paresRelacionamentoPreview(membros).length === 1);
}

// --- personagem principal nunca entra num par (rosterId sempre null pra ele) ---
{
  const par = PARES_RELACIONAMENTO[0];
  const membros = [fakePersonagem("Herói", par.rosterIds[0]), fakePersonagem("A", par.rosterIds[1])];
  // mesmo que o "principal" tivesse (hipoteticamente) um rosterId batendo
  // com o par, a função só olha .rosterId — não distingue "é o principal"
  // de "é um convocado", então isso AINDA ativaria; o que garante que o
  // principal nunca participe de verdade é ele nunca ter rosterId de
  // verdade (sempre null/undefined vindo de BattleUI.js).
  check("função em si só olha rosterId (sem distinção especial de 'principal')", paresAtivosNoTime(membros).length === 1);
}

// --- múltiplos pares podem estar ativos ao mesmo tempo (sem exclusividade) ---
{
  if (PARES_RELACIONAMENTO.length >= 2) {
    const parA = PARES_RELACIONAMENTO[0];
    const parB = PARES_RELACIONAMENTO[1];
    const membros = [
      fakePersonagem("Herói", null),
      fakePersonagem("A", parA.rosterIds[0]), fakePersonagem("B", parA.rosterIds[1]),
      fakePersonagem("C", parB.rosterIds[0]), fakePersonagem("D", parB.rosterIds[1]),
    ];
    const ativos = paresAtivosNoTime(membros);
    check("2 pares distintos completos ativam os 2 ao mesmo tempo", ativos.length === 2);
  }
}

// --- aplicarParesRelacionamento: muta só os 2 combatentes do par, mais ninguém ---
{
  const par = PARES_RELACIONAMENTO.find((p) => p.tipo === "rivalidade");
  const membros = [fakePersonagem("Herói", null), fakePersonagem("A", par.rosterIds[0]), fakePersonagem("B", par.rosterIds[1]), fakePersonagem("C", null)];
  const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
  const antes = combatentesTime.map((c) => ({ atributos: { ...c.atributos }, defesa: c.defesa, critBonus: c.critBonus || 0, hpMax: c.hpMax, mpMax: c.mpMax }));

  const resultado = aplicarParesRelacionamento(combatentesTime, membros);
  check("retorna a lista de pares ativos", resultado.length === 1 && resultado[0].id === par.id);

  check("Herói (índice 0, sem rosterId) NÃO é afetado", combatentesTime[0].atributos.FOR === antes[0].atributos.FOR && combatentesTime[0].defesa === antes[0].defesa);
  check("C (índice 3, sem rosterId) NÃO é afetado", combatentesTime[3].atributos.FOR === antes[3].atributos.FOR && combatentesTime[3].defesa === antes[3].defesa);
  check("A (índice 1, lado do par) É afetado", combatentesTime[1].atributos.FOR === antes[1].atributos.FOR + par.bonus.FOR && combatentesTime[1].defesa === Math.max(0, antes[1].defesa + par.bonus.defesaFlat));
  check("B (índice 2, outro lado do par) É afetado", combatentesTime[2].atributos.FOR === antes[2].atributos.FOR + par.bonus.FOR && combatentesTime[2].defesa === Math.max(0, antes[2].defesa + par.bonus.defesaFlat));
  check("crítico do par de rivalidade sobe conforme o bonus configurado", Math.abs((combatentesTime[1].critBonus || 0) - (antes[1].critBonus + par.bonus.critChance)) < 1e-9);
}

// --- aplicarParesRelacionamento: par de amizade aplica hpMaxPercent/mpMaxPercent corretamente ---
{
  const par = PARES_RELACIONAMENTO.find((p) => p.tipo === "amizade" && (p.bonus.hpMaxPercent || p.bonus.mpMaxPercent));
  check("existe pelo menos 1 par de amizade com hpMaxPercent ou mpMaxPercent", !!par);
  if (par) {
    const membros = [fakePersonagem("Herói", null), fakePersonagem("A", par.rosterIds[0]), fakePersonagem("B", par.rosterIds[1])];
    const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
    const hpMaxAntes = combatentesTime[1].hpMax;
    const mpMaxAntes = combatentesTime[1].mpMax;
    aplicarParesRelacionamento(combatentesTime, membros);
    if (par.bonus.hpMaxPercent) {
      check("hpMax sobe pelo percentual configurado", combatentesTime[1].hpMax === Math.max(1, Math.round(hpMaxAntes * (1 + par.bonus.hpMaxPercent))));
      check("hp atual escala junto com hpMax (não fica destravado)", combatentesTime[1].hp <= combatentesTime[1].hpMax);
    }
    if (par.bonus.mpMaxPercent) {
      check("mpMax sobe pelo percentual configurado", combatentesTime[1].mpMax === Math.round(mpMaxAntes * (1 + par.bonus.mpMaxPercent)));
    }
  }
}

// --- sem nenhum par completo no time, nada é mutado ---
{
  const membros = [fakePersonagem("Herói", null), fakePersonagem("A", "rosterid_qualquer_sem_par")];
  const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
  const forAntes = combatentesTime.map((c) => c.atributos.FOR);
  const resultado = aplicarParesRelacionamento(combatentesTime, membros);
  check("nenhum par ativo retorna array vazio", resultado.length === 0);
  check("nenhum atributo é alterado sem par ativo", combatentesTime.every((c, i) => c.atributos.FOR === forAntes[i]));
}

// --- defesa nunca fica negativa mesmo com penalidade de rivalidade ---
{
  const par = PARES_RELACIONAMENTO.find((p) => p.tipo === "rivalidade" && p.bonus.defesaFlat < 0);
  check("existe pelo menos 1 par de rivalidade com penalidade de defesa", !!par);
  if (par) {
    const pA = fakePersonagem("A", par.rosterIds[0]);
    const pB = fakePersonagem("B", par.rosterIds[1]);
    pA.atributos.CON = 0; // defesa base bem baixa, pra testar o piso em 0
    const membros = [fakePersonagem("Herói", null), pA, pB];
    const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
    aplicarParesRelacionamento(combatentesTime, membros);
    check("defesa nunca fica negativa mesmo com penalidade de rivalidade", combatentesTime[1].defesa >= 0);
  }
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== test_rivalry.mjs passou ===");
