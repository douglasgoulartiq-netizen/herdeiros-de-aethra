// TODA MISSÃO PRECISA TER ONDE SER CUMPRIDA.
//
// O QUE ESTE TESTE PROTEGE
// ------------------------
// O modo automático foi ligado numa partida nova e, em 60 segundos, o herói
// visitou TRÊS casas: 183,195 / 182,194 / 182,196. Nível 1, nenhuma missão
// concluída. A causa não era a IA — era o dado, em duas formas:
//
//   q1_ratos_no_celeiro  matar 2 rato_gigante  regiao "vila"
//   q6_javalis_no_pomar  matar 3 javali        regiao "bosque_sombrio"
//
// A zona "vila" tem `monstros: []` — é a vila inicial, segura de propósito.
// E "bosque_sombrio" não tinha javali na lista, embora o próprio Tobias diga
// "Javali do Bosque Sombrio" com todas as letras. Ou seja: as duas primeiras
// missões de caça do jogo mandavam procurar onde a caça não existe.
//
// Isso não trava só o automático. Um jogador humano que siga a bússola chega
// ao lugar, anda em volta e não encontra nada — e não tem como saber que o
// errado é o jogo, não ele.
//
// A REGRA, ENTÃO
// --------------
//   CAÇA     toda missão "matar" aponta para uma região onde o alvo vive
//            (lista de monstros da zona, ou o chefe da masmorra).
//   COLETA   toda missão "coletar" aponta para uma região que produz o
//            recurso — ou o item vem de derrota, e aí não precisa de nó.
//   EXISTE   a região citada existe mesmo em zones.js.
//
// Nenhuma dessas três é opinião: são a condição mínima para a missão poder
// ser concluída. Um teste que passe aqui não garante que a missão é boa;
// um que falhe garante que ela é impossível.
import assert from "node:assert";
import fs from "node:fs";
import { ZONAS_MUNDO } from "../src/data/world/zones.js";

// As masmorras vivem em `const MASMORRAS` dentro de main.js, que não é
// importável de fora (ele inicializa o jogo ao carregar). Como só precisamos
// da lista de monstros de cada uma, lemos essa lista do próprio código. Se o
// formato mudar, o teste avisa em vez de passar em silêncio.
const FONTE_MAIN = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
function monstrosDaMasmorra(id) {
  const i = FONTE_MAIN.indexOf(`  ${id}: {`);
  if (i < 0) return null;
  const j = FONTE_MAIN.indexOf("monstros: [", i);
  if (j < 0 || j > i + 900) return null;
  return FONTE_MAIN.slice(j + "monstros: [".length, FONTE_MAIN.indexOf("]", j))
    .split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
}
assert.ok(monstrosDaMasmorra("dungeon1")?.length, "não consegui ler os monstros de dungeon1 em main.js — o formato de MASMORRAS mudou");

const ler = (n) => JSON.parse(fs.readFileSync(new URL(`../src/data/${n}.json`, import.meta.url), "utf8"));
const brutoQuests = ler("quests");
const quests = Array.isArray(brutoQuests) ? brutoQuests : Object.values(brutoQuests)[0];
const { itens } = ler("items");
const monstros = (() => { const m = ler("monsters"); return Array.isArray(m) ? m : (m.monsters || Object.values(m)[0]); })();

const zonaPor = new Map(ZONAS_MUNDO.map((z) => [z.id, z]));
const falhas = [];
const anotar = (q, motivo) => falhas.push(`${q.id} (${q.tipo}): ${motivo}`);

// De onde vem um item: nó de recurso da zona, ou derrota de um monstro que
// vive nela. As tabelas de loot ficam em lootTables.json, indexadas por
// monstro — monsters.json não tem campo de drop nenhum, e foi por confiar
// nele que a primeira versão deste teste acusou missões que estavam certas.
const loot = ler("lootTables");
const dropadoPor = new Map(); // itemId -> Set(monstroId)
for (const [monstroId, tabela] of Object.entries(loot)) {
  for (const entrada of tabela?.pool || []) {
    const id = entrada.itemId;
    if (!id) continue;
    if (!dropadoPor.has(id)) dropadoPor.set(id, new Set());
    dropadoPor.get(id).add(monstroId);
  }
}

let conferidas = 0;
for (const q of quests) {
  // "tutorial" se cumpre na interface (invocar, formar time, lutar) e nunca
  // tem lugar no mapa. Ver a guarda em alvoDeUmaMissaoAutomatica: essas
  // missões estão FORA da navegação automática justamente por isso.
  if (q.tipo === "tutorial") continue;

  const mapaAlvo = q.mapaAlvo || "overworld";
  if (mapaAlvo !== "overworld") {
    const dentroDaMasmorra = monstrosDaMasmorra(mapaAlvo);
    if (!dentroDaMasmorra) { anotar(q, `mapaAlvo "${mapaAlvo}" não existe em MASMORRAS`); continue; }
    conferidas += 1;
    if (q.tipo === "matar" && q.alvo) {
      // Chefe de masmorra é colocado à parte (BOSS_TILE), não na lista de
      // encontros aleatórios — por isso ele passa sem estar na lista.
      const ehChefe = monstros.some((m) => m.id === q.alvo && (m.chefe || m.boss));
      if (!dentroDaMasmorra.includes(q.alvo) && !ehChefe) {
        anotar(q, `alvo "${q.alvo}" não aparece na masmorra "${mapaAlvo}" (monstros: ${JSON.stringify(dentroDaMasmorra)})`);
      }
    }
    continue;
  }

  const zonaId = q.zonaAlvo || q.regiao;
  if (!zonaId) continue;
  const zona = zonaPor.get(zonaId);
  if (!zona) { anotar(q, `região "${zonaId}" não existe em zones.js`); continue; }
  conferidas += 1;

  if (q.tipo === "matar" && q.alvo) {
    if (!(zona.monstros || []).includes(q.alvo)) {
      anotar(q, `alvo "${q.alvo}" não vive em "${zonaId}" (monstros: ${JSON.stringify(zona.monstros || [])})`);
    }
  }

  if (q.tipo === "coletar" && q.itemAlvo) {
    const existe = itens.some((i) => i.id === q.itemAlvo);
    if (!existe) { anotar(q, `itemAlvo "${q.itemAlvo}" não existe em items.json`); continue; }
    // A pergunta não é "existe em algum lugar do mundo", e sim "existe NESTA
    // região". Um item que só cai de um chefe de masmorra não se coleta numa
    // zona de deserto, por mais que exista no jogo.
    const temNo = (zona.recursos || []).includes(q.itemAlvo);
    const quemDropa = dropadoPor.get(q.itemAlvo) || new Set();
    const caiAqui = (zona.monstros || []).some((m) => quemDropa.has(m));
    if (!temNo && !caiAqui) {
      anotar(q, `"${q.itemAlvo}" não é recurso de "${zonaId}" nem cai de nenhum monstro de lá `
        + `(quem dropa: ${[...quemDropa].join(", ") || "ninguém"})`);
    }
  }
}

if (falhas.length) {
  console.error(`✗ ${falhas.length} missão(ões) sem onde ser cumprida(s):`);
  falhas.forEach((f) => console.error(`   ${f}`));
}
assert.equal(falhas.length, 0, "há missões apontando para onde o objetivo não existe");
console.log(`✓ ${conferidas} missões conferidas: todas apontam para um lugar onde o objetivo existe.`);
