// O CICLO derrotar → ganhar → construir, com trava.
//
// O QUE ESTE TESTE PROTEGE
// ------------------------
// Antes desta mudança o jogo tinha 19 materiais e 5 receitas. Onze materiais
// — TODOS troféus de chefe, com descrição prometendo "usado em receitas de
// forja raras" — não apareciam em receita nenhuma. O jogador derrubava o
// Colosso, recebia o Núcleo do Colosso e a única coisa a fazer com ele era
// vender. A promessa estava no texto do item e em lugar nenhum do código.
//
// As asserções abaixo são exatamente essa promessa:
//
//   CICLO      todo material de troféu é ingrediente de alguma receita.
//   INTEGRIDADE nenhuma receita pede ou entrega item que não existe.
//   ORIGEM     todo troféu cai de um chefe de verdade (lootTables.json).
//   VALOR      a peça forjada vale mais que a soma dos materiais — senão a
//              forja é um jeito caro de perder ouro.
//   FORJÁVEL   craftar() de verdade consome e entrega, sem mock.
import assert from "node:assert";
import fs from "node:fs";
import { craftar, receitaDisponivel } from "../src/systems/CraftingSystem.js";

const ler = (n) => JSON.parse(fs.readFileSync(new URL(`../src/data/${n}.json`, import.meta.url), "utf8"));
const { itens } = ler("items");
const receitas = ler("recipes");
const loot = ler("lootTables");
const monstros = (() => { const d = ler("monsters"); return Array.isArray(d) ? d : Object.values(d)[0]; })();

let ok = 0;
const check = (nome, cond) => {
  if (!cond) throw new Error(`FALHOU: ${nome}`);
  ok += 1; console.log(`✓ ${nome}`);
};

const porId = new Map(itens.map((i) => [i.id, i]));
const materiais = itens.filter((i) => i.tipo === "material" && i.subtipo !== "missao");
// Troféu = material que só existe porque um chefe morreu. A marca no jogo é a
// descrição ("extraído só do…", "arrancado só do…"), e ela bate com a
// lootTables: quem escrever um troféu novo sem receita cai neste teste.
const trofeus = materiais.filter((m) => /extraíd|extraid|arrancad/i.test(m.descricao || ""));

// --- CICLO ----------------------------------------------------------------
check(`o jogo tem troféus de chefe para fechar o ciclo (${trofeus.length})`, trofeus.length >= 9);

const usados = new Set(receitas.flatMap((r) => r.ingredientes.map((i) => i.itemId)));
const orfaos = materiais.filter((m) => !usados.has(m.id));
check(`nenhum material fica órfão de receita${orfaos.length ? ` — ${orfaos.map((m) => m.id).join(", ")}` : ""}`,
  orfaos.length === 0);

const trofeusSemReceita = trofeus.filter((m) => !usados.has(m.id));
check(`todo troféu de chefe entra em alguma receita${trofeusSemReceita.length ? ` — ${trofeusSemReceita.map((m) => m.id).join(", ")}` : ""}`,
  trofeusSemReceita.length === 0);

// --- INTEGRIDADE ----------------------------------------------------------
const ingredientesQuebrados = receitas.flatMap((r) => r.ingredientes
  .filter((i) => !porId.has(i.itemId)).map((i) => `${r.id}->${i.itemId}`));
check(`todo ingrediente de toda receita existe${ingredientesQuebrados.length ? ` — ${ingredientesQuebrados.join(", ")}` : ""}`,
  ingredientesQuebrados.length === 0);

const resultadosQuebrados = receitas.filter((r) => !porId.has(r.resultadoId)).map((r) => r.id);
check(`toda receita entrega um item que existe${resultadosQuebrados.length ? ` — ${resultadosQuebrados.join(", ")}` : ""}`,
  resultadosQuebrados.length === 0);

const ids = receitas.map((r) => r.id);
check("nenhum id de receita se repete", new Set(ids).size === ids.length);
check("toda receita tem id, nome e pelo menos um ingrediente",
  receitas.every((r) => r.id && r.nome && Array.isArray(r.ingredientes) && r.ingredientes.length));
check("nenhuma receita pede quantidade zero ou negativa",
  receitas.every((r) => r.ingredientes.every((i) => Number.isInteger(i.quantidade) && i.quantidade > 0)));

// Nenhuma receita pode pedir o próprio resultado: seria um laço que só
// existe para consumir o item.
check("nenhuma receita pede o próprio resultado como ingrediente",
  receitas.every((r) => !r.ingredientes.some((i) => i.itemId === r.resultadoId)));

// --- ORIGEM ---------------------------------------------------------------
// Um troféu que nenhum chefe larga é uma receita impossível. Confere contra a
// tabela de loot de verdade, não contra a descrição.
const textoLoot = JSON.stringify(loot);
const semFonte = trofeus.filter((m) => !textoLoot.includes(`"${m.id}"`));
check(`todo troféu cai de alguma tabela de loot${semFonte.length ? ` — ${semFonte.map((m) => m.id).join(", ")}` : ""}`,
  semFonte.length === 0);

const chefes = new Set(monstros.filter((m) => m && m.chefe).map((m) => m.id));
const deChefe = trofeus.filter((m) => Object.entries(loot)
  .some(([alvo, t]) => chefes.has(alvo) && JSON.stringify(t).includes(`"${m.id}"`)));
check(`os troféus vêm de chefes, não de bicho comum (${deChefe.length}/${trofeus.length})`,
  deChefe.length === trofeus.length);

// --- VALOR ----------------------------------------------------------------
// A forja de troféu não pode ser um jeito caro de perder ouro: a peça tem de
// valer mais que a soma do que foi gasto nela. Um troféu de chefe vende por
// 80 a 340 de ouro, então a peça precisa cobrir isso — senão a jogada certa
// passa a ser vender o troféu e a receita nunca é usada.
//
// A regra vale para as ONZE receitas de troféu, não para as cinco antigas.
// MEDIDO: quatro das antigas já estavam abaixo do custo antes desta mudança
// (poção de mana média 30 contra 54, elmo de ferro 12 contra 20, escudo de
// madeira 12 contra 20, antídoto 8 contra 8). São itens de consumo e de kit
// inicial, onde o ponto não é revenda; mexer no preço deles é decisão de
// economia do jogo, não conserto de teste, e fica registrado aqui em vez de
// ser corrigido em silêncio junto com outra coisa.
const LEGADAS = new Set(["receita_pocao_vida_m", "receita_pocao_mana_m", "receita_elmo_comum",
  "receita_escudo_comum", "receita_antidoto"]);
const abaixoDoCusto = [];
for (const r of receitas) {
  if (LEGADAS.has(r.id)) continue;
  const custo = r.ingredientes.reduce((s, i) => s + (porId.get(i.itemId)?.valor || 0) * i.quantidade, 0);
  const valor = porId.get(r.resultadoId)?.valor || 0;
  if (valor <= custo) abaixoDoCusto.push(`${r.id} (${valor} <= ${custo})`);
}
check(`toda peça de troféu vale mais que os materiais${abaixoDoCusto.length ? ` — ${abaixoDoCusto.join(", ")}` : ""}`,
  abaixoDoCusto.length === 0);

// --- FORJÁVEL -------------------------------------------------------------
// Sem mock: monta um inventário com os materiais exatos e chama o sistema de
// verdade. É o que garante que a receita não é só um JSON bonito.
for (const r of receitas) {
  const heroi = { inventario: [], equipamento: {} };
  for (const i of r.ingredientes) {
    for (let n = 0; n < i.quantidade; n += 1) heroi.inventario.push({ ...porId.get(i.itemId) });
  }
  assert.ok(receitaDisponivel(heroi, r), `${r.id}: materiais exatos não bastam`);
  const antes = heroi.inventario.length;
  const res = craftar(heroi, r, itens);
  assert.ok(res.ok, `${r.id}: craftar recusou com os materiais exatos`);
  assert.equal(res.item.id, r.resultadoId, `${r.id}: entregou item errado`);
  const gasto = r.ingredientes.reduce((s, i) => s + i.quantidade, 0);
  assert.equal(heroi.inventario.length, antes - gasto + 1,
    `${r.id}: inventário não bate depois de forjar`);
  assert.ok(!receitaDisponivel(heroi, r), `${r.id}: dá pra forjar de novo sem repor material`);
}
check(`as ${receitas.length} receitas forjam de verdade, consomem o material e entregam a peça`, true);

// Toda peça nova precisa de ícone, senão volta o quadrado marrom de
// placeholder que o teste de ícones existe para impedir.
const indice = ler("itemIcons");
const semIcone = receitas.filter((r) => !indice[r.resultadoId]).map((r) => r.resultadoId);
check(`toda peça forjada tem ícone${semIcone.length ? ` — ${semIcone.join(", ")}` : ""}`, semIcone.length === 0);

console.log(`\n${ok} verificacoes do ciclo de forja passaram (${receitas.length} receitas, ${materiais.length} materiais).`);
