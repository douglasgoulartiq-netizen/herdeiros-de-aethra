import assert from 'node:assert/strict';
import { autoPlayState } from '../src/systems/AutoPlayState.js';
import { atualizarBotaoAutoFixo } from '../src/ui/AutoToggleUI.js';
const elementos = new Map();
let emCombate = false, cliquesCombate = 0, cliquesMundo = 0;
globalThis.document = {
  getElementById: id => id === 'screen-batalha' ? {
    classList: {contains: () => !emCombate},
    querySelector: () => ({click: () => {cliquesCombate++; autoPlayState.ativo = !autoPlayState.ativo;}}),
  } : elementos.get(id),
  createElement: () => ({atributos: {}, setAttribute(k,v) {this.atributos[k]=v;}}),
  body: {appendChild: el => elementos.set(el.id, el)},
};
const alternar = () => { cliquesMundo++; autoPlayState.ativo = !autoPlayState.ativo; };
atualizarBotaoAutoFixo(alternar);
atualizarBotaoAutoFixo(alternar);
assert.equal(elementos.size, 1);
const botao = elementos.get('auto-fixo');
botao.onclick({stopPropagation(){}});
assert.equal(cliquesMundo, 1);
assert.equal(botao.atributos['aria-pressed'], 'true');
emCombate = true;
botao.onclick({stopPropagation(){}});
assert.equal(cliquesCombate, 1);
assert.equal(botao.atributos['aria-pressed'], 'false');
assert.equal(cliquesMundo, 1);
console.log('OK: botão único, estado acessível, exploração e controle de combate.');
