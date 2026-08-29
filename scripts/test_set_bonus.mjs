// Regressão para sets de equipamento (melhoria de jogabilidade pós-backlog
// original, ver SetBonusSystem.js) — bônus extra ao vestir 2+ peças do
// mesmo conjunto, somado via bonusTotal() em CharacterFactory.js (mesma
// composição usada por árvore de habilidades, afinidade racial e vínculo).
import {
  SETS_DE_EQUIPAMENTO, pecasEquipadasDoConjunto, tiersAtivosDoConjunto, bonusConjunto, conjuntosParaExibir,
} from "../src/systems/SetBonusSystem.js";
import { bonusTotal, atributosEfetivos, defesaTotal } from "../src/systems/CharacterFactory.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const itemsData = JSON.parse(fs.readFileSync(new URL("../src/data/items.json", import.meta.url)));
const itensPorId = Object.fromEntries(itemsData.itens.map((i) => [i.id, i]));

function equipamentoVazio() {
  return { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null };
}
function fakePersonagem(equipamento) {
  return {
    nivel: 5, racaId: "humano", classeId: "guerreiro",
    atributos: { FOR: 5, DES: 5, CON: 5, INT: 5 },
    equipamento, arvore: { escolhas: [] },
  };
}
// Mapeia cada item de set pro slot certo, igual InventorySystem.equiparItem faria.
const SLOT_POR_ARMADURA = { peito: "peito", cabeca: "cabeca", pes: "pes", escudo: "escudo" };
function equipar(equipamento, itemId) {
  const def = itensPorId[itemId];
  const slot = SLOT_POR_ARMADURA[def.slot];
  equipamento[slot] = { ...def };
}

// --- Integridade dos dados: todo item citado nos conjuntos existe de verdade em items.json ---
{
  const idsInvalidos = SETS_DE_EQUIPAMENTO.flatMap((s) => s.pecas).filter((id) => !itensPorId[id]);
  check("todo item citado em SETS_DE_EQUIPAMENTO existe em items.json", idsInvalidos.length === 0);
  check("todo conjunto tem pelo menos 1 tier de bônus", SETS_DE_EQUIPAMENTO.every((s) => s.tiers.length >= 1));
  check("tiers de cada conjunto estão em ordem crescente de peças", SETS_DE_EQUIPAMENTO.every((s) => s.tiers.every((t, i) => i === 0 || t.pecas > s.tiers[i - 1].pecas)));
  check("nenhum tier pede mais peças do que o conjunto tem no total", SETS_DE_EQUIPAMENTO.every((s) => s.tiers.every((t) => t.pecas <= s.pecas.length)));
}

// --- pecasEquipadasDoConjunto: conta certo, ignora itens de fora do conjunto ---
{
  const setAndarilho = SETS_DE_EQUIPAMENTO.find((s) => s.id === "andarilho");
  const eq = equipamentoVazio();
  check("0 peças equipadas de início", pecasEquipadasDoConjunto(fakePersonagem(eq), setAndarilho) === 0);
  equipar(eq, "armadura_comum");
  check("1 peça equipada conta certo", pecasEquipadasDoConjunto(fakePersonagem(eq), setAndarilho) === 1);
  equipar(eq, "elmo_comum");
  check("2 peças equipadas conta certo", pecasEquipadasDoConjunto(fakePersonagem(eq), setAndarilho) === 2);
  // Item de FORA do conjunto (armadura_incomum não faz parte de "andarilho") não conta.
  const eq2 = equipamentoVazio();
  equipar(eq2, "armadura_incomum");
  check("item de outro tier/conjunto não conta pro conjunto 'andarilho'", pecasEquipadasDoConjunto(fakePersonagem(eq2), setAndarilho) === 0);
}

// --- tiersAtivosDoConjunto / bonusConjunto: limiares corretos, bônus somam entre degraus ---
{
  const setAndarilho = SETS_DE_EQUIPAMENTO.find((s) => s.id === "andarilho");
  const eq = equipamentoVazio();
  equipar(eq, "armadura_comum");
  const p1peca = fakePersonagem(eq);
  check("com 1 peça (abaixo do 1º limiar), nenhum tier ativo", tiersAtivosDoConjunto(p1peca, setAndarilho).length === 0);
  check("com 1 peça, bonusConjunto fica todo zero", Object.values(bonusConjunto(p1peca)).every((v) => v === 0));

  equipar(eq, "elmo_comum");
  const p2pecas = fakePersonagem(eq);
  check("com 2 peças (bate o 1º limiar), 1 tier ativo", tiersAtivosDoConjunto(p2pecas, setAndarilho).length === 1);
  check("com 2 peças, bonusConjunto tem +1 DES (tier de 2 peças)", bonusConjunto(p2pecas).DES === 1);
  check("com 2 peças, defesaFlat ainda é 0 (tier de 4 peças não bateu)", bonusConjunto(p2pecas).defesaFlat === 0);

  equipar(eq, "botas_comum");
  equipar(eq, "escudo_comum");
  const p4pecas = fakePersonagem(eq);
  check("com as 4 peças, os 2 tiers ficam ativos ao mesmo tempo", tiersAtivosDoConjunto(p4pecas, setAndarilho).length === 2);
  check("com as 4 peças, bônus dos 2 tiers SOMAM (DES do tier 1 + defesaFlat do tier 2, não substitui)", bonusConjunto(p4pecas).DES === 1 && bonusConjunto(p4pecas).defesaFlat === 2);
}

// --- Sem nenhuma peça de nenhum conjunto, bonusConjunto é sempre vazio (comportamento idêntico a antes) ---
{
  const eq = equipamentoVazio();
  equipar(eq, "espada_comum".length ? "armadura_incomum" : "armadura_incomum"); // item comum, fora de qualquer conjunto
  const p = fakePersonagem(eq);
  check("equipamento genérico (fora de qualquer conjunto) não ativa bônus nenhum", Object.values(bonusConjunto(p)).every((v) => v === 0));
  check("equipamento null (personagem sem campo equipamento) não quebra", Object.values(bonusConjunto({})).every((v) => v === 0));
}

// --- conjuntosParaExibir: só lista conjuntos com pelo menos 1 peça, com progresso certo ---
{
  const eq = equipamentoVazio();
  check("nenhuma peça equipada -> lista vazia", conjuntosParaExibir(fakePersonagem(eq)).length === 0);
  equipar(eq, "armadura_epico");
  const resumo = conjuntosParaExibir(fakePersonagem(eq));
  check("1 peça do vigilante élfico aparece na lista", resumo.length === 1 && resumo[0].id === "vigilante_elfico");
  check("progresso mostra 1 de 3 peças, nenhum tier ativo ainda, próximo tier em 2", resumo[0].equipadas === 1 && resumo[0].total === 3 && resumo[0].tiersAtivos === 0 && resumo[0].proximoTierEm === 2);
  equipar(eq, "elmo_epico");
  equipar(eq, "botas_epico");
  const resumoCompleto = conjuntosParaExibir(fakePersonagem(eq))[0];
  check("conjunto completo (3/3): 2 tiers ativos e proximoTierEm null (não há mais nada a alcançar)", resumoCompleto.tiersAtivos === 2 && resumoCompleto.proximoTierEm === null);
}

// --- Integração com CharacterFactory: bônus de conjunto entra em atributosEfetivos/defesaTotal ---
{
  const eq = equipamentoVazio();
  equipar(eq, "armadura_lendario");
  equipar(eq, "elmo_lendario");
  const p = fakePersonagem(eq);
  const antes = defesaTotal(fakePersonagem(equipamentoVazio()), {});
  // 2 peças do conjunto guardião eterno = +4% hpMaxPercent (não afeta defesa ainda, só o tier de 4 peças dá defesaFlat).
  check("bonusTotal inclui o bônus de conjunto (hpMaxPercent do guardião eterno com 2 peças)", bonusTotal(p, {}).hpMaxPercent === 0.04);

  equipar(eq, "botas_lendario");
  equipar(eq, "escudo_lendario");
  const pCompleto = fakePersonagem(eq);
  // Peças de armadura/escudo/elmo já dão defesa própria (defesa base do item) SOMADA ao defesaFlat do conjunto (tier de 4 peças).
  const defesaComConjuntoCompleto = defesaTotal(pCompleto, {});
  const defesaSemBonusDeConjunto = Object.values(eq).filter(Boolean).reduce((acc, it) => acc + (it.defesa || 0), 0) + Math.floor(pCompleto.atributos.CON / 2);
  check("defesaTotal com o conjunto completo é maior que só a defesa base dos itens (defesaFlat do tier de 4 peças soma)", defesaComConjuntoCompleto === defesaSemBonusDeConjunto + 4);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
