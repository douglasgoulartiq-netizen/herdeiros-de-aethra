// Os três defeitos do modo automático que este teste tranca.
//
// Cada bloco descreve o comportamento ERRADO observado antes da correção,
// para que uma regressão futura falhe com a explicação junto.
import assert from "node:assert";
import { iniciarMissao, missaoRastreada, concluirMissao } from "../src/systems/QuestSystem.js";

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try { fn(); ok += 1; }
  catch (e) { falhas.push(`${nome} — ${e.message}`); }
}

const QUESTS = [
  { id: "coleta_ervas", vertente: "secundaria", tipo: "coletar", itemAlvo: "erva", quantidade: 2, npcId: "boticaria" },
  { id: "cap_1", vertente: "principal", tipo: "matar", alvo: "lobo", quantidade: 1, npcId: "capitao" },
  { id: "cap_2", vertente: "principal", tipo: "matar", alvo: "goblin", quantidade: 1, npcId: "capitao" },
];
globalThis.window = { __QUESTS__: QUESTS };

const heroi = (extra = {}) => ({
  missoesAtivas: [], missoesConcluidas: [], inventario: [], ouro: 0,
  missaoRastreadaId: null, rastreamentoMissaoPausado: false, ...extra,
});

// ---------------------------------------------------------------- defeito 1
// Aceitar uma missão principal ARRANCAVA o rastreador de uma missão que já
// estava pronta para entregar. No automático isso virava meia-volta com a
// recompensa na mão: o herói caminhava de volta ao ofertante, aceitava a
// nova principal na chegada e partia para o outro lado do mapa sem entregar.
checar("missão pronta para entregar não perde o rastreador para uma principal", () => {
  const p = heroi();
  iniciarMissao(p, QUESTS[0]);
  p.inventario.push({ id: "erva" }, { id: "erva" }); // objetivo cumprido
  assert.strictEqual(p.missaoRastreadaId, "coleta_ervas");
  iniciarMissao(p, QUESTS[1]);
  assert.strictEqual(
    p.missaoRastreadaId, "coleta_ervas",
    "a principal roubou a bússola de uma entrega pronta",
  );
});

checar("entregue a pronta, a principal assume o rastreador sozinha", () => {
  const p = heroi();
  iniciarMissao(p, QUESTS[0]);
  p.inventario.push({ id: "erva" }, { id: "erva" });
  iniciarMissao(p, QUESTS[1]);
  concluirMissao(p, QUESTS[0], []);
  const r = missaoRastreada(p, QUESTS);
  assert.strictEqual(r?.def.id, "cap_1", "ninguém assumiu a bússola depois da entrega");
});

checar("principal continua tomando o foco quando nada está pronto", () => {
  const p = heroi();
  iniciarMissao(p, QUESTS[0]); // sem as ervas: não está pronta
  iniciarMissao(p, QUESTS[1]);
  assert.strictEqual(p.missaoRastreadaId, "cap_1", "a principal deixou de tomar o foco");
});

checar("secundária nunca rouba o foco de quem já tem", () => {
  const p = heroi();
  iniciarMissao(p, QUESTS[1]);
  iniciarMissao(p, QUESTS[0]);
  assert.strictEqual(p.missaoRastreadaId, "cap_1");
});

// ---------------------------------------------------------------- defeito 2
// A navegação lia só a missão RASTREADA, então existia um objetivo por vez.
// A correção no main.js percorre `missoesAtivas`; aqui garantimos o contrato
// de que várias missões coexistem e continuam distinguíveis por prontidão —
// é disso que a lista de alvos depende.
checar("várias missões ativas coexistem sem se anular", () => {
  const p = heroi();
  iniciarMissao(p, QUESTS[0]);
  iniciarMissao(p, QUESTS[1]);
  iniciarMissao(p, QUESTS[2]);
  assert.strictEqual(p.missoesAtivas.length, 3, "aceitar uma missão descartou outra");
  assert.deepStrictEqual(
    p.missoesAtivas.map((m) => m.id).sort(),
    ["cap_1", "cap_2", "coleta_ervas"],
  );
});

// ---------------------------------------------------------------- defeito 3
// Carência de reentrada em masmorra. A regra vive no main.js (que arrasta o
// jogo inteiro), então aqui replicamos exatamente a decisão para travar a
// ARITMÉTICA dela — o vaivém era 9 travessias em 40 s.
const CARENCIA_MS = 45000;
const DISTANCIA_LIBERA = 12;
function aceitaEntrada({ deixadaId, deixadaEm, id, agora, jogador, entrada }) {
  if (deixadaId !== id) return true;
  if (agora - deixadaEm >= CARENCIA_MS) return true;
  const longe = Math.max(Math.abs(jogador.x - entrada.x), Math.abs(jogador.y - entrada.y));
  return longe >= DISTANCIA_LIBERA;
}
const AO_LADO = { jogador: { x: 19, y: 20 }, entrada: { x: 20, y: 20 } };

checar("recém-saído e colado na porta: o automático NÃO reentra", () => {
  assert.strictEqual(
    aceitaEntrada({ deixadaId: "dungeon1", deixadaEm: 1000, id: "dungeon1", agora: 1600, ...AO_LADO }),
    false,
    "reentrou na masmorra que acabou de deixar — o vaivém voltou",
  );
});

checar("afastou-se 12 casas: a masmorra volta a valer na hora", () => {
  assert.strictEqual(
    aceitaEntrada({
      deixadaId: "dungeon1", deixadaEm: 1000, id: "dungeon1", agora: 1600,
      jogador: { x: 8, y: 20 }, entrada: { x: 20, y: 20 },
    }),
    true,
    "afastar-se de verdade deixou de liberar a reentrada",
  );
});

checar("passados 45 s a carência vence mesmo parado na porta", () => {
  assert.strictEqual(
    aceitaEntrada({ deixadaId: "dungeon1", deixadaEm: 1000, id: "dungeon1", agora: 1000 + CARENCIA_MS, ...AO_LADO }),
    true,
    "a carência nunca vence — a masmorra ficaria bloqueada",
  );
});

checar("a carência é só da masmorra deixada, não das outras", () => {
  assert.strictEqual(
    aceitaEntrada({ deixadaId: "dungeon1", deixadaEm: 1000, id: "dungeon2", agora: 1600, ...AO_LADO }),
    true,
    "sair de uma masmorra bloqueou a outra",
  );
});

console.log(`${ok} verificações passaram, ${falhas.length} falharam.`);
if (falhas.length) { falhas.forEach((f) => console.log("  ✗", f)); process.exit(1); }
