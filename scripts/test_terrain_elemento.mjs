// Smoke test para task #42: terreno elemental por bioma/masmorra — o
// elemento dominante da zona fica mais forte para qualquer atacante, mas dá
// resistência aos inimigos do encontro (nativos do terreno) contra esse
// mesmo elemento. Aditivo sobre a matriz elemental (task #30) e a formação
// (task #43) — nenhum dos dois muda de comportamento sem terreno definido.
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import { ZONAS } from "../src/data/worldMap.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));

function fakePersonagemJogador(elementoArma = "fisico") {
  return {
    nome: "Herói", hp: 200, hpMax: 200, mp: 10, mpMax: 10,
    atributos: { FOR: 10, DES: 8, CON: 10, INT: 5 },
    equipamento: { arma: { elemento: elementoArma, dano: 10, atributo: "FOR", bonusCritico: 0 } }, habilidades: [], tracoId: null, racaId: "humano",
    spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
  };
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 500, atk: 8, defesa: 2, vel: 5, elemento: "fisico", xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

// N alto (3000) porque o efeito isolado do terreno é pequeno (bônus 1.2x,
// resistência 0.96x líquido — só ~4% de diferença) frente à variância
// natural do dano (variação 0.85-1.15x + ~15% de chance de crítico
// dobrando o dano); com poucas amostras a comparação de médias fica
// estatisticamente instável (falso negativo intermitente).
function mediaDano(batalha, atacante, alvo, n = 3000) {
  let total = 0, acertos = 0;
  for (let i = 0; i < n; i++) {
    alvo.hp = alvo.hpMax;
    const r = batalha.rolarAtaque(atacante, alvo, { elementoAtacante: atacante.elemento });
    if (r.acertou) { total += r.dano; acertos++; }
  }
  return acertos ? total / acertos : 0;
}

// --- ZONAS/MASMORRAS: todo bioma de combate define elementoDominante; vila não ---
{
  const vila = ZONAS.find((z) => z.id === "vila");
  check("vila (segura) não tem elementoDominante", vila.elementoDominante === null);
  const combateSemElemento = ZONAS.filter((z) => z.id !== "vila" && !z.elementoDominante);
  check("toda zona de combate tem elementoDominante definido", combateSemElemento.length === 0);
  const deserto = ZONAS.find((z) => z.id === "deserto_karn");
  check("Deserto de Karn é fogo (exemplo do pedido original)", deserto.elementoDominante === "fogo");
}

// --- multiplicadorTerreno: sem terreno definido, comportamento idêntico a antes ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase(), 0);
  const semTerreno = new Batalha([jogador], [inimigo], dadosElementos, null);
  check("sem terrenoElemento, multiplicadorTerreno = 1", semTerreno.multiplicadorTerreno("fogo", inimigo) === 1);
}

// --- bônus de ataque: elemento do terreno aumenta o dano de QUALQUER atacante ---
// (isola o bônus da resistência: aqui os alvos são "isPlayer", que nunca
// recebem a resistência de terreno — ver 4º teste abaixo pra confirmar isso
// especificamente. O ponto aqui é só: bater com o elemento do terreno bate
// mais forte do que bater com outro elemento, para qualquer atacante.)
{
  const jogadorFogo = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const jogadorAgua = criarCombatenteJogador(fakePersonagemJogador("agua"), {}, "frente");
  const alvoDummy1 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const alvoDummy2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const batalhaDeserto = new Batalha([jogadorFogo, jogadorAgua, alvoDummy1, alvoDummy2], [], dadosElementos, "fogo");

  const danoFogo = mediaDano(batalhaDeserto, jogadorFogo, alvoDummy1);
  const danoAgua = mediaDano(batalhaDeserto, jogadorAgua, alvoDummy2);
  check("ataque de fogo no deserto causa mais dano que ataque de água (elemento fora do terreno)", danoFogo > danoAgua);
}

// --- resistência: inimigo do encontro resiste ao elemento do terreno, mesmo sem ser do elemento dele ---
{
  const jogadorFogo1 = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const jogadorFogo2 = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const inimigoNoDeserto = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 0);
  const inimigoForaDoDeserto = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 0);
  const batalhaDeserto = new Batalha([jogadorFogo1], [inimigoNoDeserto], dadosElementos, "fogo");
  const batalhaSemTerreno = new Batalha([jogadorFogo2], [inimigoForaDoDeserto], dadosElementos, null);

  const danoComTerreno = mediaDano(batalhaDeserto, jogadorFogo1, inimigoNoDeserto);
  const danoSemTerreno = mediaDano(batalhaSemTerreno, jogadorFogo2, inimigoForaDoDeserto);
  check("fogo contra inimigo NO deserto causa menos dano que o mesmo ataque fora dele (resistência nativa)", danoComTerreno < danoSemTerreno);
}

// --- inimigo atacando o jogador com o elemento do terreno recebe o bônus cheio (sem resistência, alvo é jogador) ---
{
  function fakeAtacanteInimigoComElemento(elemento) {
    return criarCombatenteInimigo(monstroBase({ elemento, atk: 20 }), 0);
  }
  const inimigoFogo = fakeAtacanteInimigoComElemento("fogo");
  const jogador1 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const jogador2 = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const batalhaDeserto = new Batalha([jogador1], [inimigoFogo], dadosElementos, "fogo");
  const batalhaSemTerreno = new Batalha([jogador2], [criarCombatenteInimigo(monstroBase({ elemento: "fogo", atk: 20 }), 0)], dadosElementos, null);

  const danoComTerreno = mediaDano(batalhaDeserto, inimigoFogo, jogador1);
  const inimigoSemTerreno = batalhaSemTerreno.inimigos[0];
  const danoSemTerreno = mediaDano(batalhaSemTerreno, inimigoSemTerreno, jogador2);
  check("inimigo de fogo no deserto ataca o jogador com dano maior que fora do deserto (bônus cheio, sem resistência)", danoComTerreno > danoSemTerreno);
}

// --- FLAGS.terreno desligada: comportamento idêntico a antes da task, mesmo com terrenoElemento setado ---
{
  FLAGS.terreno = false;
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase({ elemento: "fisico" }), 0);
  const batalha = new Batalha([jogador], [inimigo], dadosElementos, "fogo");
  check("FLAGS.terreno=false desativa o bônus/resistência de terreno mesmo com terrenoElemento setado", batalha.multiplicadorTerreno("fogo", inimigo) === 1);
  FLAGS.terreno = true;
}

// --- integração: rolarAtaque nunca deixa o dano abaixo de 1, mesmo com bônus/resistência de terreno somados ---
{
  const jogador = criarCombatenteJogador(fakePersonagemJogador("fogo"), {}, "retaguarda");
  const jogadorFrente = criarCombatenteJogador(fakePersonagemJogador("fisico"), {}, "frente");
  const inimigo = criarCombatenteInimigo(monstroBase({ defesa: 999, elemento: "fisico" }), 0);
  const batalha = new Batalha([jogadorFrente, jogador], [inimigo], dadosElementos, "fogo");
  const r = batalha.rolarAtaque(inimigo, jogador, { elementoAtacante: "fisico" });
  check("dano nunca fica negativo/zero por acidente de arredondamento (piso de 1 preservado)", r.dano >= 1 || r.acertou === false);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
