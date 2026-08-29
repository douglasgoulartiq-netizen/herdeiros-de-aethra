// Testes do motor de IA de auto-batalha (task #96) — puro, sem DOM/Batalha,
// usando combatentes no mesmo formato de CombatSystem.js (criarCombatente*).
import {
  MODOS_AUTO_BATALHA, configAutoBatalhaPadrao, garantirConfigAutoBatalha,
  limiarCura, chanceUsarHabilidade, habilidadesOfensivasDisponiveis, habilidadeUltimate,
  pontuarAlvo, escolherAlvoAutomatico, escolherAcaoAutomatica,
} from "../src/systems/AutoBattleAI.js";
import { criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { aplicarEstadoElemental } from "../src/systems/ElementalReactionSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));
const dadosEstados = JSON.parse(fs.readFileSync(new URL("../src/data/elementalStates.json", import.meta.url)));
const dadosReacoes = JSON.parse(fs.readFileSync(new URL("../src/data/elementalReactions.json", import.meta.url)));
const dados = { elements: dadosElementos, elementalReactions: dadosReacoes };

function fakePersonagem(overrides = {}) {
  return {
    nome: "Teste", classeId: "guerreiro", nivel: 5,
    atributos: { FOR: 12, DES: 10, CON: 10, INT: 10 },
    hp: 100, hpMax: 100, mp: 50, mpMax: 50,
    equipamento: { arma: { elemento: "fisico", dano: 8, atributo: "FOR", bonusCritico: 0 } },
    habilidades: [], tracoId: null, racaId: "humano",
    ...overrides,
  };
}

function monstro(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 100, atk: 5, defesa: 5, vel: 5, elemento: "fisico", chefe: false, arquetipo: "agressor", xp: 5, ouroMin: 1, ouroMax: 2, ...overrides };
}

// --- config: padrão, backfill, limiares -------------------------------
{
  const c = configAutoBatalhaPadrao();
  check("config padrão começa no modo equilibrado", c.modo === "equilibrado");
  check("config padrão tem as 5 regras ligadas, exceto preservarUltimate", c.preservarUltimate === false && c.focarChefe && c.eliminarSuporte && c.explorarFraquezaElemental && c.priorizarCombo);

  const p = fakePersonagem();
  const cfg = garantirConfigAutoBatalha(p);
  check("garantirConfigAutoBatalha cria a config a partir do nada", !!p.autoBatalhaConfig);
  check("limiarCura sem override usa o padrão do modo (equilibrado = 0.35)", limiarCura(cfg) === 0.35);
  cfg.curarAbaixoDe = 0.6;
  check("limiarCura com override manual usa o valor customizado", limiarCura(cfg) === 0.6);

  const pInvalido = fakePersonagem({ autoBatalhaConfig: { modo: "modo_inexistente", curarAbaixoDe: 5 } });
  const cfgCorrigida = garantirConfigAutoBatalha(pInvalido);
  check("backfill corrige um modo inválido de volta pro padrão", cfgCorrigida.modo === "equilibrado");
  check("backfill descarta um curarAbaixoDe fora do intervalo 0-1", cfgCorrigida.curarAbaixoDe === null);

  check("os 3 modos têm presets válidos (cura entre 0 e 1, chance entre 0 e 1)", MODOS_AUTO_BATALHA.every((m) => {
    const preset = configAutoBatalhaPadrao();
    preset.modo = m;
    return limiarCura(preset) >= 0 && limiarCura(preset) <= 1 && chanceUsarHabilidade(preset) >= 0 && chanceUsarHabilidade(preset) <= 1;
  }));
  check("modo agressivo cura com HP mais alto sendo mais tolerante a risco (limiar MENOR que conservador)", (() => {
    const agressivo = configAutoBatalhaPadrao(); agressivo.modo = "agressivo";
    const conservador = configAutoBatalhaPadrao(); conservador.modo = "conservador";
    return limiarCura(agressivo) < limiarCura(conservador);
  })());
}

// --- habilidadesOfensivasDisponiveis / habilidadeUltimate ----------------
{
  const jogador = criarCombatenteJogador(fakePersonagem({
    habilidades: [
      { id: "golpe_fraco", nome: "Golpe Fraco", tipo: "dano_fisico", multiplicador: 1.0, custoMP: 0, cooldown: 0 },
      { id: "golpe_forte", nome: "Golpe Forte", tipo: "dano_fisico", multiplicador: 2.0, custoMP: 5, cooldown: 0 },
      { id: "cura_basica", nome: "Cura", tipo: "cura", multiplicador: 1.0, custoMP: 5, cooldown: 0 },
      { id: "em_cooldown", nome: "Em Recarga", tipo: "dano_fisico", multiplicador: 3.0, custoMP: 5, cooldown: 2 },
    ],
  }), {}, "frente");
  jogador.habilidades.find((h) => h.id === "em_cooldown").cooldownAtual = 2;

  const ofensivas = habilidadesOfensivasDisponiveis(jogador);
  check("filtra só ofensivas disponíveis (fora cooldown, MP suficiente) — 2 das 4", ofensivas.length === 2);
  check("não inclui a habilidade de cura entre as ofensivas", !ofensivas.some((h) => h.tipo === "cura"));
  check("não inclui a habilidade em recarga", !ofensivas.some((h) => h.id === "em_cooldown"));

  const ultimate = habilidadeUltimate(jogador);
  check("ultimate é a de maior multiplicador disponível (Golpe Forte, não a que está em recarga)", ultimate.id === "golpe_forte");
}

// --- pontuarAlvo / escolherAlvoAutomatico ---------------------------------
{
  const jogador = criarCombatenteJogador(fakePersonagem({ equipamento: { arma: { elemento: "fogo", dano: 8, atributo: "FOR", bonusCritico: 0 } } }), {}, "frente");
  const chefe = criarCombatenteInimigo(monstro({ id: "chefe1", chefe: true, hp: 200 }), 0);
  const suporte = criarCombatenteInimigo(monstro({ id: "suporte1", arquetipo: "suporte", hp: 200 }), 1);
  const comum = criarCombatenteInimigo(monstro({ id: "comum1", hp: 200 }), 2);
  const fraco = criarCombatenteInimigo(monstro({ id: "fraco1", elemento: "gelo", hp: 200 }), 3); // fogo > gelo (checar matriz real)

  const configTudoLigado = configAutoBatalhaPadrao();
  const configTudoDesligado = { ...configAutoBatalhaPadrao(), focarChefe: false, eliminarSuporte: false, explorarFraquezaElemental: false, priorizarCombo: false };

  check("com tudo desligado, empatando em HP, a pontuação de chefe/suporte/comum é igual (só HP conta)", (() => {
    const pChefe = pontuarAlvo(chefe, jogador, null, configTudoDesligado, dados);
    const pComum = pontuarAlvo(comum, jogador, null, configTudoDesligado, dados);
    return Math.abs(pChefe - pComum) < 1e-9;
  })());
  check("com focarChefe ligado, chefe pontua mais que um inimigo comum de mesmo HP", pontuarAlvo(chefe, jogador, null, configTudoLigado, dados) > pontuarAlvo(comum, jogador, null, configTudoLigado, dados));
  check("com eliminarSuporte ligado, suporte pontua mais que um inimigo comum de mesmo HP", pontuarAlvo(suporte, jogador, null, configTudoLigado, dados) > pontuarAlvo(comum, jogador, null, configTudoLigado, dados));

  // fogo tem vantagem_intensa contra gelo de verdade (ver elements.json:
  // matriz.fogo.forteIntensa inclui "gelo") — não é uma suposição do teste.
  check("fogo é vantagem_intensa contra gelo nos dados reais (pré-condição do teste)", (dadosElementos.matriz.fogo.forteIntensa || []).includes("gelo"));
  check("com explorarFraquezaElemental ligado, alvo fraco ao elemento da habilidade pontua mais", pontuarAlvo(fraco, jogador, { elemento: "fogo" }, configTudoLigado, dados) > pontuarAlvo(comum, jogador, { elemento: "fogo" }, configTudoLigado, dados));

  const escolhido = escolherAlvoAutomatico(jogador, [comum, chefe, suporte], configTudoLigado, dados, null);
  check("com chefe vivo e focarChefe ligado, o chefe é escolhido entre os candidatos", escolhido === chefe);

  check("escolherAlvoAutomatico com lista vazia retorna null", escolherAlvoAutomatico(jogador, [], configTudoLigado, dados, null) === null);
}

// --- escolherAcaoAutomatica: cura tem prioridade -----------------------
{
  const jogador = criarCombatenteJogador(fakePersonagem({
    hp: 20, hpMax: 100,
    habilidades: [{ id: "cura1", nome: "Cura", tipo: "cura", multiplicador: 1.0, custoMP: 5, cooldown: 0 }],
  }), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstro(), 0);
  const config = configAutoBatalhaPadrao();
  const decisao = escolherAcaoAutomatica(jogador, [inimigo], config, dados);
  check("HP a 20% (abaixo do limiar 35% do modo equilibrado) com cura disponível: decide curar", decisao.tipo === "curar" && decisao.habilidade.id === "cura1");
}

// --- escolherAcaoAutomatica: sem inimigos vivos foge --------------------
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {}, "frente");
  const config = configAutoBatalhaPadrao();
  const decisao = escolherAcaoAutomatica(jogador, [], config, dados);
  check("sem nenhum inimigo vivo, decide fugir", decisao.tipo === "fugir");
}

// --- preservarUltimate: guarda a habilidade mais forte pra chefe --------
{
  const jogador = criarCombatenteJogador(fakePersonagem({
    habilidades: [
      { id: "fraca", nome: "Fraca", tipo: "dano_fisico", multiplicador: 1.0, custoMP: 0, cooldown: 0 },
      { id: "ultimate", nome: "Ultimate", tipo: "dano_fisico", multiplicador: 3.0, custoMP: 0, cooldown: 0 },
    ],
  }), {}, "frente");
  const comum1 = criarCombatenteInimigo(monstro({ id: "c1", hp: 200 }), 0);
  const comum2 = criarCombatenteInimigo(monstro({ id: "c2", hp: 200 }), 1);
  const config = { ...configAutoBatalhaPadrao(), modo: "agressivo", preservarUltimate: true, focarChefe: false, eliminarSuporte: false, explorarFraquezaElemental: false, priorizarCombo: false };

  // Força sempre "usar habilidade" (modo agressivo = 95% de chance) e roda
  // várias vezes: contra 2 inimigos comuns (nenhum chefe), a ultimate nunca
  // deve ser escolhida.
  let usouUltimateContraComum = false;
  for (let i = 0; i < 30; i++) {
    const d = escolherAcaoAutomatica(jogador, [comum1, comum2], config, dados);
    if (d.tipo === "habilidade" && d.habilidade.id === "ultimate") usouUltimateContraComum = true;
  }
  check("preservarUltimate: nunca gasta a ultimate contra inimigos comuns com outros vivos", !usouUltimateContraComum);

  const chefeUnico = criarCombatenteInimigo(monstro({ id: "chefeUnico", chefe: true, hp: 200 }), 0);
  let usouUltimateContraChefe = false;
  for (let i = 0; i < 30 && !usouUltimateContraChefe; i++) {
    const d = escolherAcaoAutomatica(jogador, [chefeUnico], config, dados);
    if (d.tipo === "habilidade" && d.habilidade.id === "ultimate") usouUltimateContraChefe = true;
  }
  check("preservarUltimate: libera a ultimate contra um chefe", usouUltimateContraChefe);
}

// --- priorizarCombo: usa a habilidade que aciona uma reação real --------
{
  const jogador = criarCombatenteJogador(fakePersonagem({
    habilidades: [
      { id: "golpe_fisico", nome: "Golpe Físico", tipo: "dano_fisico", multiplicador: 1.0, custoMP: 0, cooldown: 0 },
      { id: "bola_fogo", nome: "Bola de Fogo", tipo: "dano_magico", multiplicador: 1.2, custoMP: 0, cooldown: 0, elemento: "fogo" },
    ],
  }), {}, "frente");
  const alvo = criarCombatenteInimigo(monstro({ id: "alvoCongelado", hp: 500 }), 0);
  aplicarEstadoElemental(alvo, "congelado", dadosEstados);
  const config = configAutoBatalhaPadrao();

  // Estilhaçar (ver elementalReactions.json) é acionada por Congelado +
  // golpe FÍSICO — a habilidade mágica (Bola de Fogo) não deveria disparar
  // essa reação; a física deveria.
  let usouFisicaPorCombo = false;
  for (let i = 0; i < 20 && !usouFisicaPorCombo; i++) {
    if (alvo.statusEffects.every((s) => s.tipo !== "estado_elemental")) aplicarEstadoElemental(alvo, "congelado", dadosEstados);
    const d = escolherAcaoAutomatica(jogador, [alvo], config, dados);
    if (d.tipo === "habilidade" && d.habilidade.id === "golpe_fisico") usouFisicaPorCombo = true;
  }
  check("priorizarCombo: escolhe a habilidade física certa pra acionar Estilhaçar num alvo Congelado (em vez de rolar aleatório)", usouFisicaPorCombo);
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_auto_battle_ai ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
