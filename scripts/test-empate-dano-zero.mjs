// O EMPATE DE DANO ZERO — batalha real, não simulação.
//
// O defeito: `combatente.elemento` é o elemento da ARMA equipada, e responde
// por dois papéis opostos — com o que você bate e o que você resiste. Como
// "mesmo elemento = imune = 0", um herói de espada de fogo contra um monstro
// de fogo entrava num empate perfeito: nenhum dos dois conseguia tirar um
// ponto de vida do outro, para sempre.
//
// Este teste monta exatamente essa batalha e exige que os dois lados causem
// dano. Ele FALHA no código anterior à correção (golpe de metal).
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { elementoFisicoEfetivo, relacaoElemental } from "../src/systems/ElementSystem.js";

const elementos = JSON.parse(readFileSync(new URL("../src/data/elements.json", import.meta.url)));
const monstros = JSON.parse(readFileSync(new URL("../src/data/monsters.json", import.meta.url)));
const lista = Array.isArray(monstros) ? monstros : (monstros.monstros || monstros.monsters || Object.values(monstros)[0]);

let ok = 0;
const falhas = [];
const checar = (nome, fn) => { try { fn(); ok += 1; } catch (e) { falhas.push(`${nome} — ${e.message}`); } };

// ------------------------------------------------------- a regra, isolada
checar("elemento físico imune cai para 'fisico'", () => {
  assert.strictEqual(elementoFisicoEfetivo("fogo", "fogo", elementos), "fisico");
});
checar("vantagem elemental é preservada no golpe físico", () => {
  const rel = relacaoElemental("fogo", "gelo", elementos);
  assert.notStrictEqual(rel, "imune", "premissa do teste mudou");
  assert.strictEqual(elementoFisicoEfetivo("fogo", "gelo", elementos), "fogo",
    "a arma perdeu a vantagem elemental — a correção foi longe demais");
});
checar("arma sem elemento continua física", () => {
  assert.strictEqual(elementoFisicoEfetivo(null, "fogo", elementos), "fisico");
});
checar("magia elemental NÃO usa esta regra: imunidade continua existindo", () => {
  assert.strictEqual(relacaoElemental("fogo", "fogo", elementos), "imune",
    "a imunidade sumiu por completo — magia elemental deixou de ter decisão tática");
});

// ------------------------------------------------- a batalha de verdade
function heroiDeFogo() {
  const p = {
    nome: "Brenn", nivel: 5, hp: 120, hpMax: 120, mp: 0, mpMax: 0,
    atributos: { FOR: 14, DES: 10, CON: 12, INT: 8 },
    equipamento: { arma: { id: "espada_epico", nome: "Espada", elemento: "fogo", dano: 8 } },
    habilidades: [], inventario: [], statusEffects: [],
  };
  return criarCombatenteJogador(p);
}

const defFogo = lista.find((m) => m.elemento === "fogo");
assert.ok(defFogo, "nenhum monstro de fogo nos dados — premissa do teste mudou");

checar("herói com arma de fogo FERE um monstro de fogo", () => {
  const heroi = heroiDeFogo();
  const inimigo = criarCombatenteInimigo(defFogo, elementos);
  const b = new Batalha([heroi], [inimigo], elementos);
  assert.strictEqual(inimigo.elemento, "fogo", "o monstro escolhido não é de fogo");
  assert.strictEqual(heroi.elemento, "fogo", "a arma de fogo não chegou ao combatente");
  let acertos = 0;
  let danoTotal = 0;
  for (let i = 0; i < 200; i++) {
    const r = b.rolarAtaque(heroi, inimigo);
    if (r.acertou) { acertos += 1; danoTotal += r.dano; }
  }
  assert.ok(acertos > 0, "o herói não acertou nenhum golpe em 200 tentativas");
  assert.ok(danoTotal > 0,
    `${acertos} golpes acertaram e somaram 0 de dano — o empate de dano zero voltou`);
});

checar("monstro de fogo FERE um herói com arma de fogo", () => {
  const heroi = heroiDeFogo();
  const inimigo = criarCombatenteInimigo(defFogo, elementos);
  const b = new Batalha([heroi], [inimigo], elementos);
  let acertos = 0;
  let danoTotal = 0;
  for (let i = 0; i < 200; i++) {
    const r = b.rolarAtaque(inimigo, heroi);
    if (r.acertou) { acertos += 1; danoTotal += r.dano; }
  }
  assert.ok(acertos > 0, "o monstro não acertou nenhum golpe em 200 tentativas");
  assert.ok(danoTotal > 0,
    `${acertos} golpes acertaram e somaram 0 de dano — o lado do monstro ainda empata`);
});

checar("a prévia de dano concorda com o golpe real (não mostra IMUNE · 0)", () => {
  const heroi = heroiDeFogo();
  const inimigo = criarCombatenteInimigo(defFogo, elementos);
  const b = new Batalha([heroi], [inimigo], elementos);
  const faixa = b.estimarFaixaDano(heroi, inimigo);
  assert.ok(!faixa.imune, "a prévia ainda anuncia imunidade e o jogador não usaria o ataque");
  assert.ok(faixa.esperado > 0, `a prévia promete ${faixa.esperado} de dano`);
});

// Um empate só termina se ALGUÉM morre. Esta é a prova final: a batalha
// inteira, rodada a rodada, tem de chegar ao fim.
checar("a batalha de fogo contra fogo chega ao fim", () => {
  const heroi = heroiDeFogo();
  const inimigo = criarCombatenteInimigo(defFogo, elementos);
  const b = new Batalha([heroi], [inimigo], elementos);
  const hpInicialInimigo = inimigo.hp;
  const hpInicialHeroi = heroi.hp;
  let rodadas = 0;
  while (heroi.hp > 0 && inimigo.hp > 0 && rodadas < 400) {
    const r = b.rolarAtaque(heroi, inimigo);
    if (r.acertou) inimigo.hp = Math.max(0, inimigo.hp - r.dano);
    if (inimigo.hp > 0) {
      const r2 = b.rolarAtaque(inimigo, heroi);
      if (r2.acertou) heroi.hp = Math.max(0, heroi.hp - r2.dano);
    }
    rodadas += 1;
  }
  assert.ok(inimigo.hp < hpInicialInimigo, "o inimigo terminou com o HP intacto");
  assert.ok(heroi.hp < hpInicialHeroi, "o herói terminou com o HP intacto");
  assert.ok(heroi.hp === 0 || inimigo.hp === 0,
    `400 rodadas sem ninguém cair: herói ${heroi.hp}/${hpInicialHeroi}, inimigo ${inimigo.hp}/${hpInicialInimigo} — o empate continua`);
});

console.log(`${ok} verificações passaram, ${falhas.length} falharam.`);
if (falhas.length) { falhas.forEach((f) => console.log("  ✗", f)); process.exit(1); }
