// Regressão para a barra de quebra/exposição de chefe (melhoria de
// jogabilidade pós-backlog original, ver CombatSystem.js: postura/
// posturaMax/atordoado, acumularQuebra, BONUS_DANO_ATORDOADO, e o plano
// "atordoado" em decidirAcao/executarAcao). Só chefes (monstroDef.chefe)
// acumulam postura; acertar a fraqueza elemental enche mais rápido que um
// golpe neutro; ao encher, o chefe perde a próxima ação e recebe dano bônus
// enquanto durar.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));

function fakePersonagemJogador(elementoArma = "fogo") {
  return {
    nome: "Herói", hp: 200, hpMax: 200, mp: 50, mpMax: 50,
    atributos: { FOR: 10, DES: 8, CON: 10, INT: 12 },
    equipamento: { arma: { elemento: elementoArma, dano: 10, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano",
    spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}

function chefeBase(overrides = {}) {
  return { id: "chefe_teste", nome: "Chefe de Teste", hp: 5000, atk: 5, defesa: 0, vel: 5, elemento: "gelo", chefe: true, xp: 50, ouroMin: 5, ouroMax: 10, arquetipo: "agressor", ...overrides };
}

function monstroComumBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 5000, atk: 5, defesa: 0, vel: 5, elemento: "gelo", chefe: false, xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

// --- criarCombatenteInimigo: só chefe recebe posturaMax > 0 ---
{
  const chefe = criarCombatenteInimigo(chefeBase(), 0);
  const comum = criarCombatenteInimigo(monstroComumBase(), 0);
  check("chefe nasce com posturaMax > 0", chefe.posturaMax > 0);
  check("chefe nasce com postura 0 e não atordoado", chefe.postura === 0 && chefe.atordoado === false);
  check("monstro comum nasce com posturaMax 0 (nunca acumula quebra)", comum.posturaMax === 0);
}

// --- acumularQuebra: só time do jogador enche a barra de um chefe vivo ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const chefe = criarCombatenteInimigo(chefeBase({ elemento: "gelo" }), 0);
  const batalha = new Batalha([jogador], [chefe], dadosElementos, null);

  batalha.acumularQuebra(chefe, jogador, "vantagem_intensa"); // inimigo atacando jogador: nunca enche nada
  check("um inimigo atacando o jogador nunca acumula postura (alvo não é chefe do lado do jogador)", jogador.postura === undefined);

  const comum = criarCombatenteInimigo(monstroComumBase(), 1);
  batalha.acumularQuebra(jogador, comum, "vantagem_intensa");
  check("monstro comum nunca acumula postura mesmo sob fraqueza elemental", comum.postura === 0 && comum.atordoado === false);
}

// --- fraqueza elemental enche a barra mais rápido que golpe neutro ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const chefeForte = criarCombatenteInimigo(chefeBase({ elemento: "gelo" }), 0); // fogo é forte contra gelo
  const chefeNeutro = criarCombatenteInimigo(chefeBase({ elemento: "fisico" }), 1);
  const batalha = new Batalha([jogador], [chefeForte, chefeNeutro], dadosElementos, null);

  batalha.acumularQuebra(jogador, chefeForte, "vantagem_intensa");
  batalha.acumularQuebra(jogador, chefeNeutro, "neutro");
  check("golpe na fraqueza (vantagem_intensa) enche mais postura que golpe neutro", chefeForte.postura > chefeNeutro.postura);
}

// --- encher a postura atordoa o chefe e reseta postura no registro ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const chefe = criarCombatenteInimigo(chefeBase({ elemento: "gelo" }), 0);
  const batalha = new Batalha([jogador], [chefe], dadosElementos, null);
  check("golpe de fraqueza intensa sozinho não é suficiente pra atordoar (30 de 100)", (() => {
    batalha.acumularQuebra(jogador, chefe, "vantagem_intensa");
    return chefe.atordoado === false;
  })());
  for (let i = 0; i < 5; i++) batalha.acumularQuebra(jogador, chefe, "vantagem_intensa");
  check("golpes repetidos na fraqueza atordoam o chefe ao encher a barra", chefe.atordoado === true);
  check("postura não passa do máximo", chefe.postura <= chefe.posturaMax);

  const posturaAntes = chefe.postura;
  batalha.acumularQuebra(jogador, chefe, "vantagem_intensa");
  check("chefe já atordoado não continua acumulando (evita re-disparar antes do turno perdido)", chefe.postura === posturaAntes);
}

// --- chefe atordoado: decidirAcao força o plano "atordoado", ignorando IA normal ---
{
  FLAGS.iaInimigos = true;
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const chefe = criarCombatenteInimigo(chefeBase({ elemento: "gelo", arquetipo: "suporte" }), 0);
  chefe.atordoado = true;
  chefe.postura = chefe.posturaMax;
  const batalha = new Batalha([jogador], [chefe], dadosElementos, null);
  const plano = batalha.decidirAcao(chefe);
  check('chefe atordoado sempre decide o plano "atordoado"', plano.tipo === "atordoado");

  batalha.executarAcao(chefe, plano);
  check("executarAcao consome o atordoamento (volta a false)", chefe.atordoado === false);
  check("executarAcao reseta a postura a 0 depois do turno perdido", chefe.postura === 0);
  check("executarAcao zera o ATB do chefe (turno consumido)", chefe.atb === 0);
}

// --- chefe atordoado não muta estado dentro de decidirAcao (só executarAcao muta) ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const chefe = criarCombatenteInimigo(chefeBase({ elemento: "gelo" }), 0);
  chefe.atordoado = true;
  chefe.postura = chefe.posturaMax;
  const batalha = new Batalha([jogador], [chefe], dadosElementos, null);
  batalha.decidirAcao(chefe); // chamado "a troco de nada" (prévia), sem executar
  check("decidirAcao sozinho não consome o atordoamento (sem efeito colateral, só executarAcao muta)", chefe.atordoado === true && chefe.postura === chefe.posturaMax);
}

// --- dano bônus contra chefe atordoado (rolarAtaque físico) ---
{
  function mediaDano(batalha, atacante, alvo, n = 2000) {
    let total = 0, acertos = 0;
    for (let i = 0; i < n; i++) {
      alvo.hp = alvo.hpMax;
      const r = batalha.rolarAtaque(atacante, alvo, { elementoAtacante: atacante.elemento });
      if (r.acertou) { total += r.dano; acertos++; }
    }
    return acertos ? total / acertos : 0;
  }
  const jogador1 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const jogador2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const chefeNormal = criarCombatenteInimigo(chefeBase({ elemento: "fisico", defesa: 3 }), 0);
  const chefeAtordoado = criarCombatenteInimigo(chefeBase({ elemento: "fisico", defesa: 3 }), 1);
  chefeAtordoado.atordoado = true;
  const batalha = new Batalha([jogador1, jogador2], [chefeNormal, chefeAtordoado], dadosElementos, null);

  const danoNormal = mediaDano(batalha, jogador1, chefeNormal);
  const danoAtordoado = mediaDano(batalha, jogador2, chefeAtordoado);
  check("chefe atordoado recebe mais dano físico em média que o mesmo chefe não atordoado", danoAtordoado > danoNormal);
}

// --- dano bônus contra chefe atordoado (magia, dano_magico inline em usarHabilidade) ---
{
  const jogadorMago = criarCombatenteJogador({ ...fakePersonagemJogador("fisico"), habilidades: [{ id: "bola_fogo", nome: "Bola de Fogo", tipo: "dano_magico", elemento: "fogo", multiplicador: 1.2, custoMP: 5, cooldown: 0 }] }, {}, "frente");
  const chefe = criarCombatenteInimigo(chefeBase({ elemento: "fisico", defesa: 0 }), 0);
  const batalha = new Batalha([jogadorMago], [chefe], dadosElementos, null);
  const habilidade = jogadorMago.habilidades[0];

  // usarHabilidade(dano_magico) também chama acumularQuebra a cada golpe
  // (mesma fraqueza/ganho de quebra que o resto do combate) — sem resetar
  // postura/atordoado a cada amostra, a própria medição da baseline "normal"
  // acabaria atordoando o chefe no meio do loop (postura enche em ~13
  // golpes de "neutro") e contaminaria a média com bônus que não deveria
  // ter, tornando a comparação estatisticamente instável. Reseta os dois
  // campos a cada amostra pra isolar só o efeito do atordoamento.
  let totalNormal = 0, n = 400;
  for (let i = 0; i < n; i++) {
    chefe.hp = chefe.hpMax;
    chefe.postura = 0;
    chefe.atordoado = false;
    habilidade.cooldownAtual = 0;
    jogadorMago.mp = jogadorMago.mpMax;
    batalha.usarHabilidade(jogadorMago, habilidade, chefe);
    totalNormal += chefe.hpMax - chefe.hp;
  }
  let totalAtordoado = 0;
  for (let i = 0; i < n; i++) {
    chefe.hp = chefe.hpMax;
    chefe.postura = 0;
    chefe.atordoado = true;
    habilidade.cooldownAtual = 0;
    jogadorMago.mp = jogadorMago.mpMax;
    batalha.usarHabilidade(jogadorMago, habilidade, chefe);
    totalAtordoado += chefe.hpMax - chefe.hp;
  }
  check("dano mágico também é ampliado contra chefe atordoado", totalAtordoado > totalNormal);
}

// --- usarHabilidade dano_fisico também acumula quebra (não só ataque básico) ---
{
  const jogador = criarCombatenteJogador({ ...fakePersonagemJogador("fogo"), habilidades: [{ id: "golpe", nome: "Golpe Forte", tipo: "dano_fisico", multiplicador: 1.5, custoMP: 5, cooldown: 0 }] }, {}, "frente");
  const chefe = criarCombatenteInimigo(chefeBase({ elemento: "gelo" }), 0);
  const batalha = new Batalha([jogador], [chefe], dadosElementos, null);
  const habilidade = jogador.habilidades[0];
  for (let i = 0; i < 6; i++) {
    habilidade.cooldownAtual = 0;
    jogador.mp = jogador.mpMax;
    if (chefe.atordoado) break;
    batalha.usarHabilidade(jogador, habilidade, chefe);
  }
  check("usar habilidade de dano físico contra a fraqueza do chefe também acumula postura o suficiente pra atordoar", chefe.atordoado === true);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
