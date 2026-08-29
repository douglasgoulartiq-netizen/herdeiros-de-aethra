// Regressão para combo elemental entre aliados (melhoria de jogabilidade
// pós-backlog original, ver CombatSystem.js: verificarComboElemental/
// COMBOS_ELEMENTAIS/BONUS_DANO_COMBO) — golpe aliado que acerta o mesmo
// alvo logo depois de um companheiro DIFERENTE, com elemento complementar,
// ganha dano bônus.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));

function fakePersonagem(nome, elemento) {
  return {
    nome, hp: 200, hpMax: 200, mp: 20, mpMax: 20,
    atributos: { FOR: 10, DES: 8, CON: 10, INT: 10 },
    equipamento: { arma: { elemento, dano: 10, atributo: "FOR", bonusCritico: 0 } }, habilidades: [], tracoId: null, racaId: "humano",
    spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}
function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 5000, atk: 8, defesa: 2, vel: 5, elemento: "fisico", xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}
function mediaDano(batalha, atacante, alvo, n = 2000) {
  let total = 0, acertos = 0;
  for (let i = 0; i < n; i++) {
    alvo.hp = alvo.hpMax;
    const r = batalha.rolarAtaque(atacante, alvo, { elementoAtacante: atacante.elemento });
    if (r.acertou) { total += r.dano; acertos++; }
  }
  return acertos ? total / acertos : 0;
}

// --- verificarComboElemental: par complementar reconhecido nos dois sentidos ---
{
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const jVento = criarCombatenteJogador(fakePersonagem("Vento", "vento"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jFogo, jVento], [inimigo], dadosElementos, null, [], 0, null);

  const r1 = batalha.verificarComboElemental(jFogo, inimigo, "fogo");
  check("1º golpe aliado nunca forma combo sozinho (não há golpe anterior ainda)", r1.combo === null && r1.multiplicador === 1);

  const r2 = batalha.verificarComboElemental(jVento, inimigo, "vento");
  check("2º golpe, de um aliado DIFERENTE, no MESMO alvo, com elemento complementar, forma combo", r2.combo !== null && r2.combo.nome === "Labareda ao Vento");
  check("combo dá o multiplicador de dano bônus esperado", r2.multiplicador === 1.3);
}

// --- Não forma combo se for o MESMO aliado atacando de novo ---
{
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jFogo], [inimigo], dadosElementos, null, [], 0, null);
  batalha.verificarComboElemental(jFogo, inimigo, "fogo");
  const r2 = batalha.verificarComboElemental(jFogo, inimigo, "vento"); // mesmo atacante, "mudou de elemento" hipoteticamente
  check("o MESMO aliado atacando de novo (mesmo objeto combatente) nunca forma combo, mesmo com par complementar", r2.combo === null);
}

// --- Não forma combo se o alvo for diferente ---
{
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const jVento = criarCombatenteJogador(fakePersonagem("Vento", "vento"), {}, "frente");
  const inimigo1 = criarCombatenteInimigo(monstroBase(), 0);
  const inimigo2 = criarCombatenteInimigo(monstroBase(), 1);
  const batalha = new Batalha([jFogo, jVento], [inimigo1, inimigo2], dadosElementos, null, [], 0, null);
  batalha.verificarComboElemental(jFogo, inimigo1, "fogo");
  const r2 = batalha.verificarComboElemental(jVento, inimigo2, "vento"); // alvo diferente
  check("aliados diferentes, mas em ALVOS diferentes, não forma combo", r2.combo === null);
}

// --- Não forma combo com elementos sem par definido (ex.: físico) ---
{
  const jA = criarCombatenteJogador(fakePersonagem("A", "fisico"), {}, "frente");
  const jB = criarCombatenteJogador(fakePersonagem("B", "fisico"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jA, jB], [inimigo], dadosElementos, null, [], 0, null);
  batalha.verificarComboElemental(jA, inimigo, "fisico");
  const r2 = batalha.verificarComboElemental(jB, inimigo, "fisico"); // mesmo elemento, não é par (nem é diferente)
  check("elementos iguais (ex.: físico+físico) nunca formam combo", r2.combo === null);
}

// --- Não forma combo quando o golpe de um inimigo entra no meio (nunca sujam o estado) ---
{
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const jVento = criarCombatenteJogador(fakePersonagem("Vento", "vento"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jFogo, jVento], [inimigo], dadosElementos, null, [], 0, null);
  batalha.verificarComboElemental(jFogo, inimigo, "fogo");
  // Um golpe de INIMIGO contra o jogador não deveria contar como "golpe aliado" nem quebrar o combo pendente.
  const semEfeito = batalha.verificarComboElemental(inimigo, jFogo, "fisico");
  check("golpe de inimigo (isPlayer:false) nunca forma combo nem altera o estado (retorna neutro)", semEfeito.combo === null && semEfeito.multiplicador === 1);
  const r2 = batalha.verificarComboElemental(jVento, inimigo, "vento");
  check("o combo pendente do golpe aliado original continua válido depois de um golpe de inimigo no meio", r2.combo !== null);
}

// --- FLAGS.elementos desligada desativa o combo também (mesma categoria elemental) ---
{
  FLAGS.elementos = false;
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const jVento = criarCombatenteJogador(fakePersonagem("Vento", "vento"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jFogo, jVento], [inimigo], dadosElementos, null, [], 0, null);
  batalha.verificarComboElemental(jFogo, inimigo, "fogo");
  const r2 = batalha.verificarComboElemental(jVento, inimigo, "vento");
  check("FLAGS.elementos=false desativa o combo elemental também", r2.combo === null && r2.multiplicador === 1);
  FLAGS.elementos = true;
}

// --- Integração com rolarAtaque: o 2º golpe (combo) causa mais dano em média que o mesmo golpe sem combo ---
// Não usa mediaDano() genérico aqui: o combo só fica armado por UM golpe
// (verificarComboElemental sempre sobrescreve o estado a cada chamada, ver
// comentário do método), então pra medir a média de golpes COM combo é
// preciso re-armar o combo antes de CADA golpe medido, não só uma vez antes
// do loop inteiro (senão só a 1ª de milhares de iterações teria o bônus, e
// a diferença de média some no ruído — isso já pegou este próprio teste).
{
  const jFogoA = criarCombatenteJogador(fakePersonagem("FogoA", "fogo"), {}, "frente");
  const jVentoA = criarCombatenteJogador(fakePersonagem("VentoA", "vento"), {}, "frente");
  const alvoComCombo = criarCombatenteInimigo(monstroBase(), 0);
  const batalhaComCombo = new Batalha([jFogoA, jVentoA], [alvoComCombo], dadosElementos, null, [], 0, null);
  let totalComCombo = 0, acertosComCombo = 0;
  for (let i = 0; i < 2000; i++) {
    alvoComCombo.hp = alvoComCombo.hpMax;
    batalhaComCombo.verificarComboElemental(jFogoA, alvoComCombo, "fogo"); // re-arma antes de cada golpe medido
    const r = batalhaComCombo.rolarAtaque(jVentoA, alvoComCombo, { elementoAtacante: "vento" });
    if (r.acertou) { totalComCombo += r.dano; acertosComCombo++; }
  }
  const danoComCombo = acertosComCombo ? totalComCombo / acertosComCombo : 0;

  const jVentoB = criarCombatenteJogador(fakePersonagem("VentoB", "vento"), {}, "frente");
  const alvoSemCombo = criarCombatenteInimigo(monstroBase(), 0);
  const batalhaSemCombo = new Batalha([jVentoB], [alvoSemCombo], dadosElementos, null, [], 0, null);
  const danoSemCombo = mediaDano(batalhaSemCombo, jVentoB, alvoSemCombo);

  check("golpe de vento logo após golpe de fogo aliado (combo) causa mais dano em média que o mesmo golpe isolado", danoComCombo > danoSemCombo);
}

// --- Combo encadeia indefinidamente entre 2 aliados alternando no mesmo alvo (design intencional) ---
{
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const jVento = criarCombatenteJogador(fakePersonagem("Vento", "vento"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jFogo, jVento], [inimigo], dadosElementos, null, [], 0, null);
  const r1 = batalha.verificarComboElemental(jFogo, inimigo, "fogo");
  const r2 = batalha.verificarComboElemental(jVento, inimigo, "vento");
  const r3 = batalha.verificarComboElemental(jFogo, inimigo, "fogo");
  const r4 = batalha.verificarComboElemental(jVento, inimigo, "vento");
  check("1º golpe nunca forma combo (nada antes)", r1.combo === null);
  check("2º, 3º e 4º golpes alternados formam combo continuamente", r2.combo !== null && r3.combo !== null && r4.combo !== null);
}

// --- dano_magico (caminho separado de rolarAtaque) também participa do combo ---
{
  function personagemComHabilidadeMagica(nome, elementoArma, elementoHabilidade) {
    return {
      ...fakePersonagem(nome, elementoArma),
      habilidades: [{ id: "bola_fogo", nome: "Bola de Fogo", tipo: "dano_magico", elemento: elementoHabilidade, multiplicador: 1.5, custoMP: 5, cooldown: 0, cooldownAtual: 0 }],
    };
  }
  // dano_magico rola um d20 (resolverAcaoD20) e pode errar (~15% de chance,
  // d<4) mesmo com o combo armado — tenta algumas vezes (mesmo padrão de
  // outros testes baseados em d20 no projeto) até um acerto de verdade
  // registrar a mensagem de combo, em vez de depender de uma única rolagem.
  const jFogo = criarCombatenteJogador(fakePersonagem("Fogo", "fogo"), {}, "frente");
  const jMago = criarCombatenteJogador(personagemComHabilidadeMagica("Mago", "fisico", "vento"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jFogo, jMago], [inimigo], dadosElementos, null, [], 0, null);
  const habilidade = jMago.habilidades[0];
  let achouComboNoLog = false;
  for (let tentativa = 0; tentativa < 20 && !achouComboNoLog; tentativa++) {
    inimigo.hp = inimigo.hpMax;
    jMago.mp = jMago.mpMax;
    habilidade.cooldownAtual = 0;
    batalha.rolarAtaque(jFogo, inimigo, { elementoAtacante: "fogo" }); // arma o combo de novo
    const logAntes = batalha.log.length;
    batalha.usarHabilidade(jMago, habilidade, inimigo);
    achouComboNoLog = batalha.log.slice(logAntes).some((l) => l.includes("Combo Elemental"));
  }
  check("usarHabilidade (dano_magico) consegue disparar e logar o combo armado por um golpe físico anterior", achouComboNoLog);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
