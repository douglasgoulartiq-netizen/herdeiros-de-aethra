// Regressão para o Modo História (melhoria pós-backlog, ver CombatSystem.js:
// MODO_HISTORIA_REDUCAO/multiplicadorModoHistoria dentro de
// criarCombatenteInimigo, personagem.modoHistoria criado em
// CharacterFactory.js e escolhido em CharacterCreationUI.js). Reduz hp/
// ataque/defesa dos monstros SEM reduzir XP/ouro — o contrário exato de
// NG+ (mais difícil E rende mais) — e os dois multiplicadores devem compor
// quando ambos estão ativos ao mesmo tempo.
import { criarCombatenteInimigo, MODO_HISTORIA_REDUCAO, NG_PLUS_ESCALA_POR_NIVEL } from "../src/systems/CombatSystem.js";
import { criarPersonagem } from "../src/systems/CharacterFactory.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 100, atk: 20, defesa: 10, vel: 5, elemento: "fisico", chefe: false, xp: 50, ouroMin: 10, ouroMax: 20, arquetipo: "agressor", ...overrides };
}

// --- personagem novo nasce com modoHistoria: false (jogo normal, saves antigos incluídos via main.js) ---
{
  const dados = {
    races: [{ id: "humano", nome: "Humano", bonus: { CON: 1 }, descricaoTraco: "" }],
    classes: [{ id: "guerreiro", nome: "Guerreiro", atributosBase: { FOR: 10, DES: 8, CON: 10, INT: 6 }, vidaBase: 40, manaBase: 10, habilidades: [] }],
    backgrounds: [{ id: "soldado", nome: "Soldado", ouroInicial: 50, pericia: "Atletismo" }],
    traits: [{ id: "corajoso", nome: "Corajoso", descricao: "" }],
    items: { itens: [] },
  };
  const p = criarPersonagem({ nome: "Teste", raca: "humano", classe: "guerreiro", antecedente: "soldado", traco: "corajoso" }, dados);
  check("personagem novo nasce com modoHistoria: false", p.modoHistoria === false);
}

// --- hp/ataque/defesa reduzidos exatamente por MODO_HISTORIA_REDUCAO, XP/ouro intactos ---
{
  const normal = criarCombatenteInimigo(monstroBase(), 0, 0, false);
  const facil = criarCombatenteInimigo(monstroBase(), 0, 0, true);
  const fatorEsperado = 1 - MODO_HISTORIA_REDUCAO;
  check("hp reduzido pelo fator esperado", facil.hp === Math.max(1, Math.round(100 * fatorEsperado)));
  check("ataque reduzido pelo fator esperado", facil.atributos.FOR === Math.max(1, Math.round(20 * fatorEsperado)));
  check("defesa reduzida pelo fator esperado", facil.defesa === Math.max(0, Math.round(10 * fatorEsperado)));
  check("hp do modo fácil é estritamente menor que o normal", facil.hp < normal.hp);
  check("XP não muda com Modo História", facil.xp === normal.xp);
  check("ouroMin não muda com Modo História", facil.ouroMin === normal.ouroMin);
  check("ouroMax não muda com Modo História", facil.ouroMax === normal.ouroMax);
}

// --- modoHistoria=false (padrão) é idêntico a não passar o parâmetro (compatibilidade) ---
{
  const semParametro = criarCombatenteInimigo(monstroBase(), 0, 0);
  const comFalseExplicito = criarCombatenteInimigo(monstroBase(), 0, 0, false);
  check("omitir modoHistoria é idêntico a passar false", semParametro.hp === comFalseExplicito.hp && semParametro.atributos.FOR === comFalseExplicito.atributos.FOR);
}

// --- compõe com NG+: hp cai por causa do Modo História mesmo com NG+ ligado, mas XP/ouro só sobem (NG+) ---
{
  const ngPlusSozinho = criarCombatenteInimigo(monstroBase(), 0, 2, false);
  const ngPlusComModoHistoria = criarCombatenteInimigo(monstroBase(), 0, 2, true);
  const multNgPlus = 1 + NG_PLUS_ESCALA_POR_NIVEL * 2;
  const multComposto = multNgPlus * (1 - MODO_HISTORIA_REDUCAO);
  check("hp com NG+2 sozinho escala só pelo NG+", ngPlusSozinho.hp === Math.max(1, Math.round(100 * multNgPlus)));
  check("hp com NG+2 + Modo História compõe os dois multiplicadores", ngPlusComModoHistoria.hp === Math.max(1, Math.round(100 * multComposto)));
  check("hp com os dois ligados é menor que só com NG+", ngPlusComModoHistoria.hp < ngPlusSozinho.hp);
  check("XP com NG+2 + Modo História é igual a NG+2 sozinho (Modo História nunca reduz recompensa)", ngPlusComModoHistoria.xp === ngPlusSozinho.xp);
  check("XP com NG+2 é maior que sem NG+ (recompensa de NG+ intacta)", ngPlusSozinho.xp > criarCombatenteInimigo(monstroBase(), 0, 0, false).xp);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== test_story_mode.mjs passou ===");
