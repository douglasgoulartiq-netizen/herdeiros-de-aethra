// Smoke test para as novas regras de combate (task #29):
// - d20 puro decide crítico (>16) / erro total (<4) / acerto (4-16)
// - Defender: seta `defendendo`, e o d20 do PRÓXIMO ataque recebido é
//   comparado contra o limiar de defesa; o flag é consumido depois de 1 uso.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo, d20 } from "../src/systems/CombatSystem.js";

function fakePersonagem() {
  return {
    nome: "Herói",
    hp: 100, hpMax: 100, mp: 50, mpMax: 50,
    atributos: { FOR: 10, DES: 10, CON: 14, INT: 10 },
    equipamento: {},
    habilidades: [],
    tracoId: "corajoso",
    racaId: "humano",
    spriteKey: "x",
    nivel: 1,
  };
}
function fakeDados() {
  return {};
}

// --- 1) Distribuição do d20 puro (sanity, sem mocks de Math.random) ---
let crit = 0, miss = 0, hit = 0;
const N = 20000;
for (let i = 0; i < N; i++) {
  const d = d20();
  if (d > 16) crit++;
  else if (d < 4) miss++;
  else hit++;
}
console.log(`[d20] N=${N} crit(>16)=${crit} (${(100*crit/N).toFixed(1)}%) miss(<4)=${miss} (${(100*miss/N).toFixed(1)}%) hit(4-16)=${hit} (${(100*hit/N).toFixed(1)}%)`);
// Esperado: crit ~20% (17-20), miss ~15% (1-3), hit ~65% (4-16)
const okDist = Math.abs(crit/N - 0.20) < 0.03 && Math.abs(miss/N - 0.15) < 0.03 && Math.abs(hit/N - 0.65) < 0.03;
console.log(okDist ? "OK distribuição dentro do esperado" : "FALHA distribuição fora do esperado");

// --- 2) resolverAcaoD20 nunca usa atributos/defesa pra decidir crit/erro ---
// (verificado estruturalmente: resolverAcaoD20 só olha `d`, sem ler atributos)
import fs from "node:fs";
const src = fs.readFileSync(new URL("../src/systems/CombatSystem.js", import.meta.url), "utf8");
const fnMatch = src.match(/resolverAcaoD20\(atacante, alvo\) \{[\s\S]*?\n  \}/);
const fnBody = fnMatch ? fnMatch[0] : "";
const usesAtributos = /atributos/.test(fnBody);
console.log(usesAtributos ? "FALHA resolverAcaoD20 referencia atributos" : "OK resolverAcaoD20 não usa atributos para decidir crit/erro");

// --- 3) Mecânica de Defender: monta uma batalha mínima e simula ataques ---
const monstroDef = { id: "goblin", nome: "Goblin", hp: 30, atk: 8, vel: 5, defesa: 3, elemento: "fisico", sprite: "g" };
let bloqueios = 0, ataquesTotais = 0;
const TRIALS = 4000;
for (let i = 0; i < TRIALS; i++) {
  const jogador = criarCombatenteJogador(fakePersonagem(), fakeDados());
  jogador.atributos = { FOR: 10, DES: 10, CON: 14, INT: 10 };
  jogador.defesa = 5;
  jogador.ataque = { dano: 8, atributo: "FOR", bonusCritico: 0 };
  const inimigo = criarCombatenteInimigo(monstroDef, 0);
  const batalha = new Batalha([jogador], [inimigo], null);

  jogador.defendendo = true;
  const r = batalha.rolarAtaque(inimigo, jogador);
  ataquesTotais++;
  // Tanto erro total (d<4) quanto bloqueio (4<=d<limiar) resultam em "sem
  // dano" enquanto o jogador está defendendo — é isso que importa pra
  // jogabilidade, então medimos a taxa combinada (!acertou).
  if (!r.acertou) bloqueios++;
  // flag deve ser consumido após o uso
  if (jogador.defendendo !== false) {
    console.log("FALHA: defendendo não foi limpo após o ataque");
  }
}
const limiarEsperado = 10 + Math.floor(5 / 2); // defesa efetiva sem buffs = 5 -> limiar 12
// P(d < limiar) para d20 uniforme 1-20 = (limiar-1)/20 (inclui os d<4 que já
// errariam de qualquer forma, mais os 4<=d<limiar bloqueados pela defesa)
const probEsperada = (limiarEsperado - 1) / 20;
console.log(`[Defender] limiar=${limiarEsperado} sem-dano=${bloqueios}/${ataquesTotais} (${(100*bloqueios/ataquesTotais).toFixed(1)}%) esperado~${(100*probEsperada).toFixed(1)}%`);
const okDefend = Math.abs(bloqueios/ataquesTotais - probEsperada) < 0.04;
console.log(okDefend ? "OK taxa de bloqueio dentro do esperado" : "FALHA taxa de bloqueio fora do esperado");

// --- 4) defendendo=false (padrão) nunca bloqueia ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), fakeDados());
  jogador.atributos = { FOR: 10, DES: 10, CON: 14, INT: 10 };
  jogador.defesa = 5;
  const inimigo = criarCombatenteInimigo(monstroDef, 0);
  const batalha = new Batalha([jogador], [inimigo], null);
  let anyBlocked = false;
  for (let i = 0; i < 500; i++) {
    jogador.vivo = true; jogador.hp = jogador.hpMax;
    const r = batalha.rolarAtaque(inimigo, jogador);
    if (r.bloqueado) anyBlocked = true;
  }
  console.log(anyBlocked ? "FALHA: bloqueou sem defendendo=true" : "OK: nunca bloqueia sem Defender ativo");
}

console.log("=== fim dos testes ===");
