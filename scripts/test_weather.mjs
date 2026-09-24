// Regressão para eventos de clima/hora do dia por zona (melhoria de
// jogabilidade pós-backlog original, ver WeatherSystem.js +
// CombatSystem.js: multiplicadorClima/BONUS_ATAQUE_CLIMA). Determinístico a
// partir de um `agora` injetado — nunca lê Date.now() diretamente aqui, pra
// dar pra testar sem depender do relógio real.
import {
  TIPOS_CLIMA, HORAS_DIA, climaAtualDaZona, horaDoDiaAtual, DURACAO_CLIMA_MS, DURACAO_HORA_DIA_MS,
} from "../src/systems/WeatherSystem.js";
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));

// --- climaAtualDaZona: determinístico (mesma zona + mesmo período = mesmo clima) ---
{
  const agora = 1_700_000_000_000;
  const a = climaAtualDaZona("floresta", agora);
  const b = climaAtualDaZona("floresta", agora + 1000); // ainda dentro do mesmo período de 5 min
  check("mesmo período de tempo dá o mesmo clima pra mesma zona", a.id === b.id);
  check("clima retornado é sempre um dos TIPOS_CLIMA conhecidos", TIPOS_CLIMA.some((c) => c.id === a.id));
}

// --- climaAtualDaZona: zonas diferentes podem ter climas diferentes no mesmo instante ---
{
  const agora = 1_700_000_000_000;
  const zonas = ["floresta", "deserto_karn", "pantano_negro", "costa_aurora", "colinas_douradas", "vale_pedras"];
  const climas = zonas.map((z) => climaAtualDaZona(z, agora).id);
  const distintos = new Set(climas);
  check("zonas diferentes não ficam todas obrigatoriamente com o mesmo clima no mesmo instante", distintos.size > 1);
}

// --- climaAtualDaZona: muda ao cruzar pro próximo período ---
{
  const zona = "floresta";
  // Varre vários períodos distantes até achar dois adjacentes com climas
  // diferentes (evita depender de qual período exato calha de mudar).
  let mudou = false;
  for (let p = 0; p < 20; p++) {
    const t0 = p * DURACAO_CLIMA_MS;
    const t1 = (p + 1) * DURACAO_CLIMA_MS;
    if (climaAtualDaZona(zona, t0).id !== climaAtualDaZona(zona, t1).id) { mudou = true; break; }
  }
  check("clima muda ao avançar pra outro período de tempo (em algum momento dos 20 testados)", mudou);
}

// --- climaAtualDaZona: zonaId vazio/nulo não quebra, cai no clima padrão (limpo) ---
{
  check("zonaId nulo retorna o clima padrão (limpo), não quebra", climaAtualDaZona(null, 12345).id === "limpo");
  check("zonaId undefined retorna o clima padrão (limpo), não quebra", climaAtualDaZona(undefined, 12345).id === "limpo");
}

// --- horaDoDiaAtual: cicla entre manhã/tarde/noite, determinístico ---
{
  const h0 = horaDoDiaAtual(0);
  check("hora do dia é sempre uma das 3 conhecidas", HORAS_DIA.some((h) => h.id === h0.id));
  const umCicloDepois = horaDoDiaAtual(DURACAO_HORA_DIA_MS * 24);
  check("um ciclo completo depois, volta pra mesma hora do dia", umCicloDepois.id === h0.id);
  const proximaHora = horaDoDiaAtual(DURACAO_HORA_DIA_MS);
  check("uma hora avança sem exigir mudança de período", proximaHora.hora === 1 && proximaHora.id === "noite");
  check("amanhecer e anoitecer são graduais", horaDoDiaAtual(6 * DURACAO_HORA_DIA_MS).escuridao === .5 && horaDoDiaAtual(19 * DURACAO_HORA_DIA_MS).escuridao === .5);
  check("meio-dia tem luz plena", horaDoDiaAtual(12 * DURACAO_HORA_DIA_MS).escuridao === 0);
}

// --- TIPOS_CLIMA: "limpo" não tem bônus elemental (é o clima neutro/padrão) ---
{
  const limpo = TIPOS_CLIMA.find((c) => c.id === "limpo");
  check('"limpo" existe e não tem elementoBonus', !!limpo && limpo.elementoBonus === null);
  check("todo clima com elementoBonus aponta pra um elemento válido nos dados reais", TIPOS_CLIMA.filter((c) => c.elementoBonus).every((c) => dadosElementos.elementos.some((e) => e.id === c.elementoBonus)));
}

// --- Integração CombatSystem.js: multiplicadorClima só se aplica quando o elemento do ataque bate com o clima ---
function fakePersonagemJogador(elemento) {
  return {
    nome: "Herói", hp: 200, hpMax: 200, mp: 10, mpMax: 10,
    atributos: { FOR: 10, DES: 8, CON: 10, INT: 5 },
    equipamento: { arma: { elemento, dano: 10, atributo: "FOR", bonusCritico: 0 } }, habilidades: [], tracoId: null, racaId: "humano",
    spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}
function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 500, atk: 8, defesa: 2, vel: 5, elemento: "fisico", xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}
function mediaDano(batalha, atacante, alvo, n = 3000) {
  let total = 0, acertos = 0;
  for (let i = 0; i < n; i++) {
    alvo.hp = alvo.hpMax;
    const r = batalha.rolarAtaque(atacante, alvo, { elementoAtacante: atacante.elemento });
    if (r.acertou) { total += r.dano; acertos++; }
  }
  return acertos ? total / acertos : 0;
}

// --- sem climaElemento (null), multiplicadorClima é sempre 1 (comportamento idêntico a antes) ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jogador], [inimigo], dadosElementos, null, [], 0, null);
  check("sem climaElemento, multiplicadorClima = 1", batalha.multiplicadorClima("agua", inimigo) === 1);
}

// --- com climaElemento definido, ataque do elemento certo causa mais dano em média ---
{
  const jogadorAgua = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const jogadorFogo = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const alvo1 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const alvo2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const batalhaChuva = new Batalha([jogadorAgua, jogadorFogo, alvo1, alvo2], [], dadosElementos, null, [], 0, "agua");

  const danoAgua = mediaDano(batalhaChuva, jogadorAgua, alvo1);
  const danoFogo = mediaDano(batalhaChuva, jogadorFogo, alvo2);
  check("durante clima de água (chuva), ataque de água causa mais dano que ataque de fogo (fora do bônus)", danoAgua > danoFogo);
}

// --- clima e terreno SOMAM quando coincidem no mesmo elemento ---
{
  const jogadorAgua1 = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const jogadorAgua2 = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const alvo1 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const alvo2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  // Só terreno de água, sem clima.
  const batalhaSoTerreno = new Batalha([jogadorAgua1, alvo1], [], dadosElementos, "agua", [], 0, null);
  // Terreno de água E clima de água juntos.
  const batalhaTerrenoEClima = new Batalha([jogadorAgua2, alvo2], [], dadosElementos, "agua", [], 0, "agua");

  const danoSoTerreno = mediaDano(batalhaSoTerreno, jogadorAgua1, alvo1);
  const danoTerrenoEClima = mediaDano(batalhaTerrenoEClima, jogadorAgua2, alvo2);
  check("terreno + clima do mesmo elemento causam mais dano que só o terreno sozinho", danoTerrenoEClima > danoSoTerreno);
}

// --- FLAGS.terreno desligada desativa o clima também (mesma categoria de efeito ambiental) ---
{
  FLAGS.terreno = false;
  const jogador = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const batalha = new Batalha([jogador], [inimigo], dadosElementos, null, [], 0, "agua");
  check("FLAGS.terreno=false desativa multiplicadorClima também", batalha.multiplicadorClima("agua", inimigo) === 1);
  FLAGS.terreno = true;
}

// --- dano nunca fica negativo/zero por acidente mesmo com clima somado a outros bônus ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase({ defesa: 999 }), 0);
  const batalha = new Batalha([jogador], [inimigo], dadosElementos, "agua", [], 0, "agua");
  const r = batalha.rolarAtaque(jogador, inimigo, { elementoAtacante: "agua" });
  check("dano nunca fica negativo/zero por acidente de arredondamento mesmo com clima+terreno somados", r.dano >= 1 || r.acertou === false);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
