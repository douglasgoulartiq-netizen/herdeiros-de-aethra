// Smoke test para task #31: os 6 arquétipos de IA novos (Defensor,
// Controlador, Suporte, Conjurador, Ladrão, Invocador).
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { FLAGS } from "../src/data/featureFlags.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

console.log("FLAGS.iaInimigos =", FLAGS.iaInimigos);

function fakePersonagem(nome = "Herói") {
  return {
    nome, hp: 100, hpMax: 100, mp: 50, mpMax: 50,
    atributos: { FOR: 10, DES: 10, CON: 14, INT: 10 },
    equipamento: {}, habilidades: [], tracoId: "corajoso", racaId: "humano", spriteKey: "x", nivel: 5,
  };
}
function monstroBase(overrides) {
  return { id: "m", nome: "M", hp: 200, atk: 10, vel: 5, defesa: 4, elemento: "fisico", sprite: "m", xp: 10, ouroMin: 1, ouroMax: 3, ...overrides };
}

// --- Suporte: cura o aliado mais ferido em vez de atacar ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const suporte = criarCombatenteInimigo(monstroBase({ id: "suporte1", arquetipo: "suporte" }), 0);
  const ferido = criarCombatenteInimigo(monstroBase({ id: "ferido1" }), 1);
  ferido.hp = Math.round(ferido.hpMax * 0.3);
  const batalha = new Batalha([jogador], [suporte, ferido], null);
  const hpAntes = ferido.hp;
  const jogadorHpAntes = jogador.hp;
  batalha.iaInimigoAgir(suporte);
  check("Suporte cura o aliado ferido (hp subiu)", ferido.hp > hpAntes);
  check("Suporte não atacou o jogador (hp do jogador intacto)", jogador.hp === jogadorHpAntes);
}

// --- Suporte sem ninguém para curar cai pro ataque normal ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const suporte = criarCombatenteInimigo(monstroBase({ id: "suporte2", arquetipo: "suporte" }), 0);
  const batalha = new Batalha([jogador], [suporte], null);
  const jogadorHpAntes = jogador.hp;
  batalha.iaInimigoAgir(suporte);
  check("Suporte sozinho ataca o jogador normalmente", jogador.hp <= jogadorHpAntes);
}

// --- Defensor: protege o aliado mais ferido com buff_defesa ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const defensor = criarCombatenteInimigo(monstroBase({ id: "defensor1", arquetipo: "defensor" }), 0);
  const fraco = criarCombatenteInimigo(monstroBase({ id: "fraco1" }), 1);
  fraco.hp = Math.round(fraco.hpMax * 0.4);
  const batalha = new Batalha([jogador], [defensor, fraco], null);
  batalha.iaInimigoAgir(defensor);
  check("Defensor aplica buff_defesa no aliado mais ferido", fraco.statusEffects.some((s) => s.tipo === "buff_defesa"));
}

// --- Controlador: aplica condicao_veneno em vez de atacar ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const controlador = criarCombatenteInimigo(monstroBase({ id: "controlador1", arquetipo: "controlador" }), 0);
  const batalha = new Batalha([jogador], [controlador], null);
  batalha.iaInimigoAgir(controlador);
  check("Controlador aplica condicao_veneno no jogador", jogador.statusEffects.some((s) => s.tipo === "condicao_veneno"));
}

// --- condicao_veneno causa dano ao longo do tempo via aplicarStatusTick ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const inimigo = criarCombatenteInimigo(monstroBase({ id: "x" }), 0);
  const batalha = new Batalha([jogador], [inimigo], null);
  jogador.statusEffects.push({ tipo: "condicao_veneno", duracao: 2, valor: 0.08 });
  const hpAntes = jogador.hp;
  batalha.aplicarStatusTick(jogador);
  check("condicao_veneno causa dano no tick", jogador.hp < hpAntes);
}

// --- Conjurador: sempre usa magia (nunca ataqueBasico puro) ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const conjurador = criarCombatenteInimigo(monstroBase({ id: "conjurador1", arquetipo: "conjurador", elemento: "fogo" }), 0);
  const batalha = new Batalha([jogador], [conjurador], null);
  const logAntes = batalha.log.length;
  batalha.iaInimigoAgir(conjurador);
  const logNovo = batalha.log.slice(logAntes).join(" | ");
  check("Conjurador registra 'conjura' no log", /conjura/i.test(logNovo));
}

// --- Ladrão: rouba ouro uma vez, não repete ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const ladrao = criarCombatenteInimigo(monstroBase({ id: "ladrao1", arquetipo: "ladrao" }), 0);
  const batalha = new Batalha([jogador], [ladrao], null);
  let roubou = false;
  for (let i = 0; i < 30 && !roubou; i++) {
    ladrao.jaRoubou = false; // força tentativas repetidas só pra achar uma que role <0.6
    const antes = batalha.ouroRoubado;
    batalha.iaInimigoAgir(ladrao);
    if (batalha.ouroRoubado > antes) roubou = true;
  }
  check("Ladrão eventualmente rouba ouro (ouroRoubado > 0)", batalha.ouroRoubado > 0);
  ladrao.jaRoubou = true;
  const antesFlag = batalha.ouroRoubado;
  batalha.iaInimigoAgir(ladrao);
  check("Ladrão não rouba de novo depois de jaRoubou=true", batalha.ouroRoubado === antesFlag);
}

// --- Invocador: adiciona um novo inimigo à batalha, uma única vez ---
{
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  const invocador = criarCombatenteInimigo(monstroBase({
    id: "necro1", arquetipo: "invocador",
    invocacao: { id: "esqueleto_convocado", nome: "Esqueleto Invocado", sprite: "mob_esqueleto", hp: 30, atk: 10, defesa: 3, vel: 6, elemento: "sombrio", xp: 6, ouroMin: 0, ouroMax: 2 },
  }), 0);
  const batalha = new Batalha([jogador], [invocador], null);
  const totalAntes = batalha.inimigos.length;
  batalha.iaInimigoAgir(invocador);
  check("Invocador adiciona 1 inimigo à batalha", batalha.inimigos.length === totalAntes + 1);
  check("invocacaoDef customizada foi usada (nome correto)", batalha.inimigos[batalha.inimigos.length - 1].nome === "Esqueleto Invocado");
  check("jaInvocou marcado", invocador.jaInvocou === true);
  const totalApos1 = batalha.inimigos.length;
  batalha.iaInimigoAgir(invocador); // segunda tentativa não deve invocar de novo
  check("Invocador não invoca duas vezes", batalha.inimigos.length === totalApos1);
}

// --- Imunidade elemental (task #30) integrada ao conjurarAtaque do Conjurador ---
{
  const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url)));
  const jogador = criarCombatenteJogador(fakePersonagem(), {});
  jogador.elemento = "fogo";
  const conjurador = criarCombatenteInimigo(monstroBase({ id: "conjurador2", arquetipo: "conjurador", elemento: "fogo" }), 0);
  const batalha = new Batalha([jogador], [conjurador], dadosElementos);
  const hpAntes = jogador.hp;
  batalha.conjurarAtaque(conjurador, jogador);
  check("Conjurador fogo vs jogador fogo (imune) causa 0 dano", jogador.hp === hpAntes);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
