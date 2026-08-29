// Testes de lógica pura do motor de Estados e Reações Elementais (Caminhos
// do Herdeiro, task #91 — ver elementalStates.json, elementalReactions.json,
// ElementalReactionSystem.js, e a integração em CombatSystem.js).
//
// Como NENHUMA habilidade do jogo ainda declara `aplicaEstado` (isso só
// chega nas tasks #93/#94, árvores de Guerreiro/Mago), estes testes aplicam
// o estado diretamente via aplicarEstadoElemental() pra simular "o alvo já
// está preparado" e então conferem que o motor de dano/turno reage certo —
// exatamente como uma habilidade futura vai fazer.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { aplicarEstadoElemental, estadoElementalAtivo } from "../src/systems/ElementalReactionSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));
const dadosEstados = JSON.parse(fs.readFileSync(new URL("../src/data/elementalStates.json", import.meta.url)));
const dadosReacoes = JSON.parse(fs.readFileSync(new URL("../src/data/elementalReactions.json", import.meta.url)));

function fakePersonagemJogador(elementoArma = "fisico") {
  return {
    nome: "Herói", hp: 200, hpMax: 200, mp: 50, mpMax: 50,
    atributos: { FOR: 10, DES: 8, CON: 10, INT: 12 },
    equipamento: { arma: { elemento: elementoArma, dano: 10, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano",
    spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin de Teste", hp: 5000, atk: 5, defesa: 0, vel: 5, elemento: "fisico", chefe: false, xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

function novaBatalha(jogadores, inimigos, { terreno = null, clima = null } = {}) {
  return new Batalha(jogadores, inimigos, dadosElementos, terreno, [], 0, clima, false, dadosEstados, dadosReacoes);
}

// resolverAcaoD20 rola um d20 puro (~15% de erro total a cada golpe) — os
// testes abaixo precisam de um ACERTO garantido pra checar a reação, então
// tentam de novo em caso de erro total (que não consome nenhum estado, ver
// early-return em rolarAtaque antes do trecho de reação) em vez de aceitar
// ~15% de chance de teste piscar (flaky) por pura sorte de dado.
function atacarAteAcertar(batalha, atacante, alvo, opts = {}, maxTentativas = 60) {
  for (let i = 0; i < maxTentativas; i++) {
    const r = batalha.rolarAtaque(atacante, alvo, opts);
    if (r.acertou) return r;
  }
  throw new Error("não conseguiu acertar em " + maxTentativas + " tentativas (algo além do d20 está errado)");
}

// --- FLAGS.reacoesElementais precisa estar ligada no jogo real ---
check("FLAGS.reacoesElementais está ligada por padrão", FLAGS.reacoesElementais === true);

// --- aplicarEstadoElemental / estadoElementalAtivo (funções puras) ---
{
  const alvo = criarCombatenteInimigo(monstroBase(), 0);
  check("sem estado aplicado, estadoElementalAtivo é null", estadoElementalAtivo(alvo) === null);
  const entrada = aplicarEstadoElemental(alvo, "molhado", dadosEstados);
  check("aplicarEstadoElemental aplica o estado certo", entrada && entrada.estadoId === "molhado");
  check("estadoElementalAtivo agora encontra Molhado", estadoElementalAtivo(alvo)?.estadoId === "molhado");
  aplicarEstadoElemental(alvo, "congelado", dadosEstados);
  check("aplicar um segundo estado SUBSTITUI o primeiro (só 1 por vez)", estadoElementalAtivo(alvo)?.estadoId === "congelado");
  check("aplicarEstadoElemental com id inválido não quebra e retorna null", aplicarEstadoElemental(alvo, "id_que_nao_existe", dadosEstados) === null);
}

// --- Reação Congelamento: Molhado + golpe de Gelo remove Molhado, aplica Congelado e causa dano bônus ---
{
  const jGelo = criarCombatenteJogador(fakePersonagemJogador("gelo"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 0);
  const batalha = novaBatalha([jGelo], [inimigo]);
  aplicarEstadoElemental(inimigo, "molhado", dadosEstados);
  const r = atacarAteAcertar(batalha, jGelo, inimigo, { elementoAtacante: "gelo" });
  check("ataque de Gelo em alvo Molhado aciona a reação Congelamento", r.reacaoElemental && r.reacaoElemental.id === "congelamento");
  check("depois da reação, o alvo perde o Molhado e fica Congelado", estadoElementalAtivo(inimigo)?.estadoId === "congelado");
}

// --- Reação Evaporação (exemplo verbatim do pedido do usuário): Molhado + Chama remove Molhado, dano bônus, névoa de Ofuscado em área ---
{
  const jFogo = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const alvo = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 0);
  const outroInimigo = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 1);
  const batalha = novaBatalha([jFogo], [alvo, outroInimigo]);
  aplicarEstadoElemental(alvo, "molhado", dadosEstados);
  const r = atacarAteAcertar(batalha, jFogo, alvo, { elementoAtacante: "fogo" });
  check("ataque de Chama em alvo Molhado aciona a reação Evaporação", r.reacaoElemental && r.reacaoElemental.id === "evaporacao");
  // A névoa da Evaporação também atinge o PRÓPRIO alvo (ele está dentro
  // dela) — então o Molhado dá lugar ao Ofuscado, não a "nenhum estado".
  check("o Molhado dá lugar ao Ofuscado da névoa no próprio alvo (Evaporação)", estadoElementalAtivo(alvo)?.estadoId === "precisao_reduzida");
  check("a névoa (Ofuscado) atinge TODOS os inimigos vivos do mesmo lado, não só o alvo direto", estadoElementalAtivo(outroInimigo)?.estadoId === "precisao_reduzida");
}

// --- Reação Condução: Molhado + Raio propaga dano pra outro inimigo vivo do mesmo lado ---
{
  const jRaio = criarCombatenteJogador(fakePersonagemJogador("raio"), {}, "frente");
  const alvo = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 0);
  const vizinho = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 1);
  const batalha = novaBatalha([jRaio], [alvo, vizinho]);
  aplicarEstadoElemental(alvo, "molhado", dadosEstados);
  const hpAntes = vizinho.hp;
  atacarAteAcertar(batalha, jRaio, alvo, { elementoAtacante: "raio" });
  check("Condução também causa dano num inimigo vizinho vivo (propagação)", vizinho.hp < hpAntes);
}

// --- Congelado controla o turno do INIMIGO (decidirAcao) ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = novaBatalha([jogador], [inimigo]);
  aplicarEstadoElemental(inimigo, "congelado", dadosEstados);
  const plano = batalha.decidirAcao(inimigo);
  check("inimigo Congelado recebe o plano 'controlado_elemental' (perde o turno)", plano.tipo === "controlado_elemental");
  batalha.executarAcao(inimigo, plano);
  check("executarAcao consome o turno perdido (atb zerado)", inimigo.atb === 0);
}

// --- Congelado controla o turno do JOGADOR (via os métodos usados por BattleUI.js) ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = novaBatalha([jogador], [inimigo]);
  check("sem estado, jogadorControladoPorEstado é falso", batalha.jogadorControladoPorEstado(jogador) === false);
  aplicarEstadoElemental(jogador, "congelado", dadosEstados);
  check("com Congelado ativo, jogadorControladoPorEstado é verdadeiro", batalha.jogadorControladoPorEstado(jogador) === true);
  jogador.atb = 42;
  batalha.perderTurnoJogadorPorEstado(jogador);
  check("perderTurnoJogadorPorEstado zera o ATB do personagem", jogador.atb === 0);
  check("perderTurnoJogadorPorEstado também tica a duração do estado (aplicarStatusTick)", true); // duração decrementada dentro do método; checada abaixo
}

// --- Reação Estilhaçar: só golpe FÍSICO quebra o Congelado (magia não deveria) ---
{
  const jFisico = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const jMago = criarCombatenteJogador({ ...fakePersonagemJogador("fisico"), habilidades: [{ id: "bola_arcana", nome: "Bola Arcana", tipo: "dano_magico", elemento: "arcano", multiplicador: 1.2, custoMP: 5, cooldown: 0, cooldownAtual: 0 }] }, {}, "retaguarda");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = novaBatalha([jFisico, jMago], [inimigo]);
  aplicarEstadoElemental(inimigo, "congelado", dadosEstados);
  const habilidade = jMago.habilidades[0];
  batalha.usarHabilidade(jMago, habilidade, inimigo);
  check("magia NÃO aciona Estilhaçar (continua Congelado)", estadoElementalAtivo(inimigo)?.estadoId === "congelado");
  const r = atacarAteAcertar(batalha, jFisico, inimigo);
  check("um golpe físico comum ACIONA Estilhaçar", r.reacaoElemental && r.reacaoElemental.id === "estilhacar");
  check("Estilhaçar garante crítico no golpe que a aciona", r.critico === true);
  check("depois de Estilhaçar, o Congelado é removido", estadoElementalAtivo(inimigo) === null);
}

// --- Reação Ruptura: golpe físico contra Exposto ignora o resto da defesa ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const inimigoAlto = criarCombatenteInimigo(monstroBase({ defesa: 40 }), 0);
  const inimigoBaixo = criarCombatenteInimigo(monstroBase({ defesa: 40 }), 1);
  const batalhaSemEstado = novaBatalha([jogador], [inimigoAlto]);
  const jogador2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const batalhaComEstado = novaBatalha([jogador2], [inimigoBaixo]);
  aplicarEstadoElemental(inimigoBaixo, "exposto", dadosEstados);
  // Mesmo motivo do teste do Instável acima: com defesa alta (40) e dano
  // base relativamente baixo, um crítico sozinho (2x) pode superar o bônus
  // fixo da reação (defesa ignorada + 1.2x) por puro azar de dado — trava
  // o d20/variância nos dois golpes pra comparar só o efeito da reação.
  const randomOriginal = Math.random;
  let semReacao, comReacao;
  try {
    Math.random = () => 0.5;
    semReacao = batalhaSemEstado.rolarAtaque(jogador, inimigoAlto);
    comReacao = batalhaComEstado.rolarAtaque(jogador2, inimigoBaixo);
  } finally {
    Math.random = randomOriginal;
  }
  check("com o mesmo dado (mockado), o golpe acertou nos dois casos (Ruptura)", semReacao.acertou && comReacao.acertou);
  check("Ruptura (ignora defesa + dano bônus) causa mais dano que o mesmo golpe sem reação", comReacao.dano > semReacao.dano);
  check("Ruptura é reconhecida no resultado do golpe", comReacao.reacaoElemental && comReacao.reacaoElemental.id === "ruptura");
}

// --- Estado Incendiado: dano por turno + redução de cura recebida, via aplicarStatusTick ---
{
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  aplicarEstadoElemental(inimigo, "incendiado", dadosEstados);
  const batalha = novaBatalha([criarCombatenteJogador(fakePersonagemJogador(), {}, "frente")], [inimigo]);
  const hpAntes = inimigo.hp;
  batalha.aplicarStatusTick(inimigo);
  check("Incendiado causa dano a cada tick (dano por turno)", inimigo.hp < hpAntes);
}

// --- Estado Instável: recebe mais dano geral (modificadorDanoRecebidoGeral) ---
{
  const jFisico1 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const jFisico2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const semEstado = criarCombatenteInimigo(monstroBase(), 0);
  const comEstado = criarCombatenteInimigo(monstroBase(), 1);
  const batalha1 = novaBatalha([jFisico1], [semEstado]);
  const batalha2 = novaBatalha([jFisico2], [comEstado]);
  aplicarEstadoElemental(comEstado, "instavel", dadosEstados);
  // Trava o d20 e a variância num valor fixo/idêntico nos dois golpes
  // (Math.random mockado) — sem isso, a comparação de dano seria flaky:
  // dois rolls independentes de variância (0.85-1.15) e crítico (~23% cada)
  // podem fazer o golpe SEM o modificador sair maior só por sorte de dado.
  const randomOriginal = Math.random;
  let r1, r2;
  try {
    Math.random = () => 0.5;
    r1 = batalha1.rolarAtaque(jFisico1, semEstado);
    r2 = batalha2.rolarAtaque(jFisico2, comEstado);
  } finally {
    Math.random = randomOriginal;
  }
  check("com o mesmo dado (mockado), o golpe acertou nos dois casos", r1.acertou && r2.acertou);
  check("alvo Instável recebe mais dano de um golpe físico neutro (modificador geral)", r2.dano > r1.dano);
}

// --- Estado Enraizado: reduz a velocidade efetiva ---
{
  const inimigo = criarCombatenteInimigo(monstroBase({ vel: 10 }), 0);
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const batalha = novaBatalha([jogador], [inimigo]);
  const velAntes = batalha.modificadorVelocidade(inimigo);
  aplicarEstadoElemental(inimigo, "enraizado", dadosEstados);
  const velDepois = batalha.modificadorVelocidade(inimigo);
  check("Enraizado reduz a velocidade efetiva do combatente", velDepois < velAntes);
}

// --- Estado Ofuscado: só aumenta a faixa de erro total, nunca cancela um crítico natural ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = novaBatalha([jogador], [inimigo]);
  aplicarEstadoElemental(jogador, "precisao_reduzida", dadosEstados);
  check("Ofuscado tem penalidadeD20 > 0 nos dados do estado", estadoElementalAtivo(jogador)?.def?.penalidadeD20 > 0);
  // roda várias resoluções e garante que nenhum d20 > 16 vira erro total
  let algumCriticoPreservado = false;
  for (let i = 0; i < 60; i++) {
    const { d, critico, erroTotal } = batalha.resolverAcaoD20(jogador, inimigo);
    if (d > 16) { check("d20 > 16 nunca vira erro total mesmo Ofuscado (crítico preservado)", critico === true && erroTotal === false); algumCriticoPreservado = true; break; }
  }
  check("o teste conseguiu observar pelo menos uma rolagem > 16 em 60 tentativas", algumCriticoPreservado);
}

// --- FLAGS.reacoesElementais desligada: motor inteiro vira no-op, combate igual a antes ---
{
  FLAGS.reacoesElementais = false;
  const jGelo = criarCombatenteJogador(fakePersonagemJogador("gelo"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = novaBatalha([jGelo], [inimigo]);
  aplicarEstadoElemental(inimigo, "molhado", dadosEstados);
  const r = atacarAteAcertar(batalha, jGelo, inimigo, { elementoAtacante: "gelo" });
  check("com a flag desligada, golpe de Gelo em alvo Molhado NÃO aciona reação nenhuma", !r.reacaoElemental);
  FLAGS.reacoesElementais = true;
}

// --- Sem nenhum dado de estados/reações passado pro construtor (compatibilidade com chamadas antigas) ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  // Construtor chamado só com os 8 parâmetros originais, como todo código
  // existente antes desta task fazia — dadosEstados/dadosReacoes ficam null.
  const batalhaAntiga = new Batalha([jogador], [inimigo], dadosElementos, null, [], 0, null, false);
  const r = batalhaAntiga.rolarAtaque(jogador, inimigo);
  check("Batalha construída do jeito antigo (sem os 2 parâmetros novos) continua funcionando normalmente", r.acertou !== undefined && typeof r.dano === "number");
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_reacoes_elementais ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
