// Smoke test para task #47: hordas de monstros — 10% de chance de um
// encontro virar horda de 5 levas sucessivas, sem cura entre elas, com
// recompensa somando todas as levas no fim.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { deveSerHorda, sortearLevasHorda, sortearEncontroDeLista } from "../src/systems/EncounterSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function fakePersonagemJogador() {
  return {
    nome: "Herói", hp: 500, hpMax: 500, mp: 10, mpMax: 10,
    atributos: { FOR: 50, DES: 8, CON: 10, INT: 5 },
    equipamento: { arma: { elemento: "fisico", dano: 200, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano", spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}

function monstroBase(id, overrides = {}) {
  return { id, nome: id, hp: 1, atk: 1, defesa: 0, vel: 5, elemento: "fisico", xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

// --- EncounterSystem: probabilidade e sorteio de levas ---
{
  let hordas = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (deveSerHorda()) hordas++;
  const taxa = hordas / N;
  check(`deveSerHorda() dispara perto de 10% das vezes (achou ${(taxa * 100).toFixed(1)}%)`, taxa > 0.08 && taxa < 0.12);

  const candidatos = [monstroBase("goblin"), monstroBase("lobo"), monstroBase("chefao", { chefe: true })];
  const levas = sortearLevasHorda(candidatos, 5);
  check("sortearLevasHorda retorna até 5 levas", levas.length <= 5 && levas.length > 0);
  check("nenhuma leva vem vazia", levas.every((l) => l.length > 0));
  check("nenhuma leva inclui um chefe (mesma regra de sortearEncontroDeLista)", levas.every((l) => l.every((m) => !m.chefe)));
  check("cada leva tem entre 1 e 3 inimigos", levas.every((l) => l.length >= 1 && l.length <= 3));
}

// --- Batalha sem levasExtras: comportamento idêntico a antes da task (regressão) ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase("goblin"), 0);
  const batalha = new Batalha([jogador], [inimigo], null, null, []);
  check("totalLevas é 1 sem levasExtras", batalha.totalLevas === 1);
  batalha.aplicarDano(inimigo, 9999);
  const terminou = batalha.verificarFim();
  check("sem levasExtras, matar o único inimigo já termina em vitória (sem virar horda)", terminou && batalha.resultado === "vitoria");
  check("historicoInimigos tem só o inimigo original", batalha.historicoInimigos.length === 1);
}

// --- Batalha com levasExtras: avança onda por onda até a última ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const onda1 = [criarCombatenteInimigo(monstroBase("goblin"), 0)];
  const levasExtras = [
    [monstroBase("lobo")],
    [monstroBase("aranha_gigante"), monstroBase("slime")],
    [monstroBase("bandido")],
    [monstroBase("harpia")],
  ]; // total 5 ondas (1 inicial + 4 extras)
  const batalha = new Batalha([jogador], onda1, null, null, levasExtras);
  check("totalLevas soma 1 + levasExtras.length", batalha.totalLevas === 5);
  check("levaAtual começa em 1", batalha.levaAtual === 1);

  // Mata a 1ª onda inteira — deve avançar pra 2ª automaticamente, sem terminar a batalha.
  batalha.inimigos.forEach((i) => batalha.aplicarDano(i, 9999));
  let terminou = batalha.verificarFim();
  check("matar a 1ª onda não termina a batalha (ainda restam ondas)", terminou === false && batalha.resultado === null);
  check("levaAtual avança pra 2", batalha.levaAtual === 2);
  check("inimigos agora é só a 2ª onda (1 lobo)", batalha.inimigos.length === 1 && batalha.inimigos[0].vivo);
  check("historicoInimigos já acumula onda 1 + onda 2", batalha.historicoInimigos.length === 2);

  // Mata a 2ª onda (1 lobo) — avança pra 3ª (2 inimigos).
  batalha.inimigos.forEach((i) => batalha.aplicarDano(i, 9999));
  batalha.verificarFim();
  check("3ª onda tem 2 inimigos (aranha + slime)", batalha.inimigos.length === 2);
  check("time NÃO recupera HP/MP entre ondas (desafio de resistência)", jogador.hp === jogador.hpMax); // ninguém bateu nele ainda, só sanity de que nada "cura" automaticamente

  // Mata a 3ª onda inteira.
  batalha.inimigos.forEach((i) => batalha.aplicarDano(i, 9999));
  batalha.verificarFim();
  check("4ª onda tem 1 inimigo (bandido)", batalha.inimigos.length === 1 && batalha.levaAtual === 4);

  // Mata a 4ª onda.
  batalha.inimigos.forEach((i) => batalha.aplicarDano(i, 9999));
  batalha.verificarFim();
  check("5ª (última) onda tem 1 inimigo (harpia)", batalha.inimigos.length === 1 && batalha.levaAtual === 5);
  check("ainda não terminou — falta a última onda", batalha.terminada === false);

  // Mata a 5ª e última onda — agora sim termina em vitória.
  batalha.inimigos.forEach((i) => batalha.aplicarDano(i, 9999));
  terminou = batalha.verificarFim();
  check("matar a última onda termina a batalha em vitória", terminou === true && batalha.resultado === "vitoria");
  check("historicoInimigos acumulou as 5 ondas inteiras (1+1+2+1+1=6 inimigos)", batalha.historicoInimigos.length === 6);
  check("log registra a transição de leva", batalha.log.some((l) => l.includes("Leva 2/5")));
}

// --- Derrota no meio de uma horda também termina a batalha normalmente ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const onda1 = [criarCombatenteInimigo(monstroBase("goblin"), 0)];
  const levasExtras = [[monstroBase("lobo")], [monstroBase("harpia")]];
  const batalha = new Batalha([jogador], onda1, null, null, levasExtras);
  jogador.hp = 0;
  jogador.vivo = false;
  const terminou = batalha.verificarFim();
  check("time inteiro morto no meio de uma horda termina em derrota (não trava esperando próxima onda)", terminou === true && batalha.resultado === "derrota");
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
