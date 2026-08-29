// Regressão para sinergia de facção em batalha (melhoria de jogabilidade
// pós-backlog original, ver FactionSynergySystem.js: aplicarSinergiaFaccao/
// sinergiaFaccaoPreview/facaoDominanteDoTime), integrada em BattleUI.js
// junto das sinergias de formação (task anterior).
import {
  LIMIAR_SINERGIA_FACCAO, facaoDominanteDoTime, sinergiaFaccaoPreview, aplicarSinergiaFaccao,
} from "../src/systems/FactionSynergySystem.js";
import { criarCombatenteJogador } from "../src/systems/CombatSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function fakePersonagem(nome, facaoId) {
  return {
    nome, hp: 100, hpMax: 100, mp: 10, mpMax: 10, facaoId: facaoId || null,
    atributos: { FOR: 5, DES: 5, CON: 5, INT: 5 },
    equipamento: { arma: { elemento: "fisico", dano: 10, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano", spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}

const dadosWorldState = {
  facoes: [{ id: "guardioes_da_folha", nome: "Guardiões da Folha Verde", icone: "🌿" }],
};

// --- facaoDominanteDoTime: sem ninguém com facaoId, retorna null ---
{
  const membros = [fakePersonagem("Herói", null), fakePersonagem("A", null)];
  check("sem nenhum membro com facaoId, facaoDominanteDoTime retorna null", facaoDominanteDoTime(membros) === null);
  check("array vazio/undefined não quebra", facaoDominanteDoTime([]) === null && facaoDominanteDoTime(undefined) === null);
}

// --- facaoDominanteDoTime: conta certo e acha a maioria ---
{
  const membros = [
    fakePersonagem("Herói", null), // principal nunca tem facaoId
    fakePersonagem("A", "guardioes_da_folha"),
    fakePersonagem("B", "guardioes_da_folha"),
    fakePersonagem("C", "ordem_dos_arquivistas"),
  ];
  const dominante = facaoDominanteDoTime(membros);
  check("acha a facção com mais membros (2 guardiões da folha vs 1 arquivista)", dominante && dominante.facaoId === "guardioes_da_folha" && dominante.count === 2);
}

// --- LIMIAR: 2 membros da mesma facção NÃO é suficiente pra ativar a sinergia ---
{
  const membros = [
    fakePersonagem("Herói", null),
    fakePersonagem("A", "guardioes_da_folha"),
    fakePersonagem("B", "guardioes_da_folha"),
  ];
  check(`limiar é ${LIMIAR_SINERGIA_FACCAO}`, LIMIAR_SINERGIA_FACCAO === 3);
  check("2 da mesma facção não ativa a prévia (abaixo do limiar)", sinergiaFaccaoPreview(membros, dadosWorldState) === null);
  const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
  const resultado = aplicarSinergiaFaccao(combatentesTime, membros, dadosWorldState);
  check("2 da mesma facção não ativa a aplicação real (abaixo do limiar)", resultado === null);
}

// --- 3 membros da mesma facção ativa a sinergia (prévia e aplicação real) ---
{
  const membros = [
    fakePersonagem("Herói", null),
    fakePersonagem("A", "guardioes_da_folha"),
    fakePersonagem("B", "guardioes_da_folha"),
    fakePersonagem("C", "guardioes_da_folha"),
  ];
  const previa = sinergiaFaccaoPreview(membros, dadosWorldState);
  check("3 da mesma facção ativa a prévia", !!previa && previa.facaoId === "guardioes_da_folha" && previa.count === 3);
  check("prévia usa o nome/ícone reais da facção (worldStateVariables)", previa.nome.includes("Guardiões da Folha Verde") && previa.icone === "🌿");

  const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
  const atributosAntes = combatentesTime.map((c) => ({ ...c.atributos }));
  const defesaAntes = combatentesTime.map((c) => c.defesa);
  const critAntes = combatentesTime.map((c) => c.critBonus || 0);

  const resultado = aplicarSinergiaFaccao(combatentesTime, membros, dadosWorldState);
  check("aplicação real retorna a sinergia ativa", !!resultado && resultado.categoria === "faccao");

  combatentesTime.forEach((c, i) => {
    check(`combatente ${i} (${c.nome}) ganha +1 FOR`, c.atributos.FOR === atributosAntes[i].FOR + 1);
    check(`combatente ${i} (${c.nome}) ganha +1 DES`, c.atributos.DES === atributosAntes[i].DES + 1);
    check(`combatente ${i} (${c.nome}) ganha +1 INT`, c.atributos.INT === atributosAntes[i].INT + 1);
    check(`combatente ${i} (${c.nome}) ganha +1 de defesa`, c.defesa === defesaAntes[i] + 1);
    check(`combatente ${i} (${c.nome}) ganha +3% de crítico`, Math.abs((c.critBonus || 0) - (critAntes[i] + 0.03)) < 1e-9);
  });
  check("o bônus vale pro PERSONAGEM PRINCIPAL também (time inteiro), mesmo sem facaoId própria", combatentesTime[0].atributos.FOR === atributosAntes[0].FOR + 1);
}

// --- 4 da mesma facção também ativa (não exige exatamente 3) ---
{
  const membros = [
    fakePersonagem("Herói", "guardioes_da_folha"), // hipotético: mesmo que o principal tivesse facaoId, ainda funcionaria
    fakePersonagem("A", "guardioes_da_folha"),
    fakePersonagem("B", "guardioes_da_folha"),
    fakePersonagem("C", "guardioes_da_folha"),
  ];
  const dominante = facaoDominanteDoTime(membros);
  check("4 membros da mesma facção também ativa (conta 4, não só 3)", dominante && dominante.count === 4);
}

// --- facção sem entrada em worldStateVariables não quebra (usa fallback) ---
{
  const membros = [
    fakePersonagem("Herói", null),
    fakePersonagem("A", "faccao_desconhecida"),
    fakePersonagem("B", "faccao_desconhecida"),
    fakePersonagem("C", "faccao_desconhecida"),
  ];
  const previa = sinergiaFaccaoPreview(membros, { facoes: [] });
  check("facção sem dados em worldStateVariables não quebra, usa o próprio id como nome e ícone genérico", !!previa && previa.nome.includes("faccao_desconhecida") && previa.icone === "🤝");
  const previaSemDados = sinergiaFaccaoPreview(membros, null);
  check("dadosWorldState nulo/undefined também não quebra", !!previaSemDados);
}

// --- não muta os combatentes quando a sinergia não está ativa ---
{
  const membros = [fakePersonagem("Herói", null), fakePersonagem("A", "guardioes_da_folha")];
  const combatentesTime = membros.map((p) => criarCombatenteJogador(p, {}, "frente"));
  const forAntes = combatentesTime.map((c) => c.atributos.FOR);
  aplicarSinergiaFaccao(combatentesTime, membros, dadosWorldState);
  check("sem atingir o limiar, nenhum atributo é alterado", combatentesTime.every((c, i) => c.atributos.FOR === forAntes[i]));
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
