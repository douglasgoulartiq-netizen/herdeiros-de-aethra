// AS PRIMEIRAS HORAS — o que foi prometido tem de estar nos dados e nas regras.
//
// Três mudanças, três seções:
//   1. recompensa na hora  (entregaImediata)
//   2. missões de entrega  (tipo "entregar")
//   3. metas menores no começo
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  iniciarMissao, missaoPronta, concluirMissao, entregaImediata,
  progressoDaMissao, textoObjetivoMissao,
} from "../src/systems/QuestSystem.js";

const ler = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const quests = ler("quests.json");
const itens = ler("items.json");
const npcs = ler("npcs.json");
const monstros = ler("monsters.json");
const listaItens = Array.isArray(itens) ? itens : itens.itens;
const listaNpcs = Array.isArray(npcs) ? npcs : npcs.npcs;
const listaMon = Array.isArray(monstros) ? monstros : (monstros.monstros || Object.values(monstros)[0]);

let ok = 0;
const falhas = [];
const checar = (nome, fn) => { try { fn(); ok += 1; } catch (e) { falhas.push(`${nome} — ${e.message}`); } };
const porId = (id) => quests.find((q) => q.id === id);

const heroi = () => ({ missoesAtivas: [], missoesConcluidas: [], inventario: [], ouro: 0, missaoRastreadaId: null });

// ------------------------------------------------- 1. recompensa na hora
checar("missões de matar e coletar pagam na hora", () => {
  for (const q of quests.filter((x) => ["matar", "coletar"].includes(x.tipo))) {
    assert.ok(entregaImediata(q), `${q.id} ainda exige a volta ao ofertante`);
  }
});

checar("missões de entrega NUNCA pagam sozinhas", () => {
  for (const q of quests.filter((x) => x.tipo === "entregar")) {
    assert.strictEqual(entregaImediata(q), false,
      `${q.id} pagaria sozinha — o destinatário deixaria de existir`);
  }
});

checar("uma missão de matar fecha assim que a meta é batida", () => {
  const q = porId("q1_ratos_no_celeiro");
  const p = heroi();
  iniciarMissao(p, q);
  const estado = p.missoesAtivas.find((m) => m.id === q.id);
  for (let i = 0; i < q.quantidade - 1; i++) {
    estado.progresso += 1;
    assert.ok(!missaoPronta(p, q), `ficou pronta com ${estado.progresso} de ${q.quantidade}`);
  }
  estado.progresso += 1;
  assert.ok(missaoPronta(p, q), "bateu a meta e não ficou pronta");
  const r = concluirMissao(p, q, listaItens);
  assert.ok(r.ok && r.ouro > 0, "a entrega não pagou");
});

// ------------------------------------------------- 2. missões de entrega
const entregas = quests.filter((q) => q.tipo === "entregar");

checar("existem missões de entrega no começo do jogo", () => {
  assert.ok(entregas.length >= 3, `só ${entregas.length} missões de entrega`);
});

checar("toda entrega tem ofertante e destinatário DIFERENTES, e ambos existem", () => {
  const ids = new Set(listaNpcs.map((n) => n.id));
  for (const q of entregas) {
    assert.ok(ids.has(q.npcId), `${q.id}: ofertante ${q.npcId} não existe`);
    assert.ok(ids.has(q.npcDestino), `${q.id}: destinatário ${q.npcDestino} não existe`);
    assert.notStrictEqual(q.npcId, q.npcDestino, `${q.id}: entrega para o próprio ofertante`);
  }
});

checar("o pacote de cada entrega existe no catálogo de itens", () => {
  const ids = new Set(listaItens.map((i) => i.id));
  for (const q of entregas) {
    assert.ok(q.itemAlvo, `${q.id} não declara itemAlvo`);
    assert.ok(ids.has(q.itemAlvo), `${q.id}: item ${q.itemAlvo} não existe`);
  }
});

checar("o ciclo da entrega fecha: recebe o pacote, fica pronta, entrega consome", () => {
  const q = entregas[0];
  const p = heroi();
  iniciarMissao(p, q);
  assert.ok(!missaoPronta(p, q), "ficou pronta antes de receber o pacote");
  const base = listaItens.find((i) => i.id === q.itemAlvo);
  p.inventario.push({ ...base, uid: "x1" });
  assert.ok(missaoPronta(p, q), "com o pacote na mochila, continua sem estar pronta");
  assert.strictEqual(progressoDaMissao(p, q).atual, 1);
  const r = concluirMissao(p, q, listaItens);
  assert.ok(r.ok, "a entrega falhou");
  assert.strictEqual(p.inventario.filter((i) => i.id === q.itemAlvo).length, 0,
    "o pacote continuou na mochila depois de entregue");
});

checar("o objetivo da entrega diz o que levar e a quem", () => {
  for (const q of entregas) {
    const t = textoObjetivoMissao(q);
    assert.ok(/Leve/i.test(t), `${q.id}: "${t}" não diz o que fazer`);
    assert.ok(t.includes(q.nomeDestino), `${q.id}: "${t}" não nomeia o destinatário`);
  }
});

// ------------------------------------------------- 3. metas do começo
checar("nenhuma missão inicial pede mais de 3", () => {
  const iniciais = ["q1_ratos_no_celeiro", "q2_lobos_da_floresta", "q3_colar_perdido",
    "q6_javalis_no_pomar", "q7_sombras_no_bosque", "q8_minerio_do_deserto", "q9_picada_escaldante"];
  for (const id of iniciais) {
    const q = porId(id);
    if (!q) continue;
    assert.ok(q.quantidade <= 3, `${id} ainda pede ${q.quantidade}`);
  }
});

checar("todo alvo de missão de matar existe entre os monstros", () => {
  const ids = new Set(listaMon.map((m) => m.id));
  for (const q of quests.filter((x) => x.tipo === "matar")) {
    assert.ok(ids.has(q.alvo), `${q.id}: alvo "${q.alvo}" não existe`);
  }
});

checar("'Pragas no Celeiro' caça rato, não slime", () => {
  const q = porId("q1_ratos_no_celeiro");
  assert.strictEqual(q.alvo, "rato_gigante",
    `a missão dos ratos ainda tem "${q.alvo}" como alvo`);
});

console.log(`${ok} verificações passaram, ${falhas.length} falharam.`);
if (falhas.length) { falhas.forEach((f) => console.log("  ✗", f)); process.exit(1); }
