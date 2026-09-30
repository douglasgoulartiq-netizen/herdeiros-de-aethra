import assert from 'node:assert/strict';
import { decidirPassoExploracao } from '../src/systems/AutoExploreAI.js';
import { ZONAS_MUNDO } from '../src/data/world/zones.js';
import { readFileSync } from 'node:fs';

// Regressão da missão real: vila é segura; o rato aparece na floresta.
const quests = JSON.parse(readFileSync(new URL('../src/data/quests.json', import.meta.url)));
const ratos = quests.find(q => q.id === 'q1_ratos_no_celeiro');
assert.ok(!ZONAS_MUNDO.find(z => z.id === ratos.regiao).monstros.includes(ratos.alvo));
assert.ok(ZONAS_MUNDO.find(z => z.id === 'floresta').monstros.includes(ratos.alvo));
const sairDaVila = decidirPassoExploracao({ origem: {x: 1, y: 1}, largura: 20, altura: 5,
  bloqueado: () => false, alvos: [{prioridade: 132, estadoPatrulha: {}, patrulha: x => x >= 10}] });
assert.ok(sairDaVila.alvo.x >= 10, 'busca habitat fora da cidade sem encontros');
assert.equal(sairDaVila.passo[0], 1);

const estadoPatrulha = {};
const alvo = { tipo: 'missao', prioridade: 132, estadoPatrulha,
  patrulha: (x, y) => x >= 2 && x <= 27 && y >= 2 && y <= 27 };
const origem = { x: 15, y: 15 };
const visitados = new Set();
let maiorDistancia = 0;
for (let tick = 0; tick < 120; tick++) {
  const decisao = decidirPassoExploracao({ origem, alvos: [alvo], largura: 30, altura: 30,
    bloqueado: (x, y) => x === 10 && y < 20 });
  assert.ok(decisao, 'caça não pode virar chegada sem próximo passo');
  const anterior = estadoPatrulha.tile;
  origem.x += decisao.passo[0]; origem.y += decisao.passo[1];
  assert.ok(!(origem.x === 10 && origem.y < 20), 'respeita colisão');
  visitados.add(`${origem.x},${origem.y}`);
  maiorDistancia = Math.max(maiorDistancia, Math.abs(origem.x - 15), Math.abs(origem.y - 15));
  if (origem.y * 30 + origem.x !== anterior) {
    decidirPassoExploracao({ origem, alvos: [alvo], largura: 30, altura: 30,
      bloqueado: (x, y) => x === 10 && y < 20 });
    assert.equal(estadoPatrulha.tile, anterior, 'mantém waypoint durante o percurso');
  }
}
assert.ok(visitados.size > 30, `patrulha variada: ${visitados.size}`);
assert.ok(maiorDistancia > 3, 'sai do raio do centro da vila');
assert.ok(estadoPatrulha.recentes.length <= 8, 'memória limitada');
const base = { origem: {x: 0, y: 0}, largura: 5, altura: 5, bloqueado: () => false };
assert.equal(decidirPassoExploracao({ ...base, alvos: [{...alvo, estadoPatrulha: {}, patrulha: () => false}] }), null);
const entrega = {x: 4, y: 4, prioridade: 178, tipo: 'entrega'};
assert.equal(decidirPassoExploracao({ ...base, alvos: [entrega, {...alvo, estadoPatrulha: {}, patrulha: () => true}] }).alvo.tipo, 'entrega');
console.log(`Patrulha: 120 passos, ${visitados.size} tiles distintos, afastamento máximo ${maiorDistancia}; estabilidade, colisão, memória e prioridade de entrega OK.`);
