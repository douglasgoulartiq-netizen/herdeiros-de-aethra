// PROVA QUE VIDA E DEFESA VIRARAM PODER — E QUE NÃO VIRARAM PODER DEMAIS.
//
// Quatro coisas são testadas, nesta ordem, porque cada uma só faz sentido se
// a anterior valer:
//
//   1. A FÓRMULA. O módulo puro: as três fontes, o teto, e o comportamento
//      diante de habilidade mal declarada (que não pode derrubar o combate).
//   2. O MOTOR. Uma batalha de verdade, com dois combatentes idênticos menos
//      pela defesa — se o de mais defesa não bater mais forte, a costura em
//      CombatSystem não pegou, por mais que o módulo esteja certo.
//   3. A PROVOCAÇÃO. Que o status nasce, que AmeacaSystem o enxerga, e que
//      ele de fato puxa o ataque — medido, não afirmado.
//   4. OS DADOS. Que as declarações na árvore são válidas e que as dez
//      classes têm ao menos uma habilidade que escala com robustez.
//
// O teste 2 é o que importa: o erro caro aqui não é errar a conta, é a conta
// certa nunca ser chamada. Foi exatamente assim que `provocar` ficou dois
// commits sendo lido por AmeacaSystem sem nada no jogo criá-lo — e foi
// exatamente assim que as doze habilidades novas nasceram e não mudaram nada
// na medição, porque a IA as ordenava por multiplicador cru.
import { readFileSync, readdirSync } from "node:fs";
import { bonusDeEscala, TETO_SOBRE_BASE, criarStatusProvocar, multiplicadorEfetivo } from "../src/systems/EscalaDerivada.js";
import { pesoDeAmeaca, estaProvocando, pesosDeAlvo } from "../src/systems/AmeacaSystem.js";
import { criarPersonagem, aplicarCrescimento } from "../src/systems/CharacterFactory.js";
import { criarCombatenteJogador, criarCombatenteInimigo, Batalha } from "../src/systems/CombatSystem.js";

const dataDir = new URL("../src/data/", import.meta.url);
const dados = Object.fromEntries(readdirSync(dataDir).filter((f) => f.endsWith(".json"))
  .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dataDir)))]));

let ok = 0;
let falhou = 0;
const conferir = (cond, msg) => { if (cond) { ok += 1; console.log(`  ok   ${msg}`); } else { falhou += 1; console.log(`  FALHA ${msg}`); } };

// ------------------------------------------------------------ 1) A FÓRMULA
console.log("\n1) A fórmula pura");

const bruto = { defesa: 40, hpMax: 400, hp: 100 };
conferir(bonusDeEscala(bruto, { de: "defesa", fator: 0.5 }) === 20, "defesa 40 x0,5 = 20");
conferir(bonusDeEscala(bruto, { de: "vidaMaxima", fator: 0.1 }) === 40, "vidaMaxima 400 x0,1 = 40");
conferir(bonusDeEscala(bruto, { de: "vidaPerdida", fator: 0.2 }) === 60, "vidaPerdida (400-100) x0,2 = 60");

const comTeto = bonusDeEscala({ hpMax: 2000 }, { de: "vidaMaxima", fator: 0.1 }, 10);
conferir(comTeto === 10 * TETO_SOBRE_BASE, `teto: bônus bruto 200 sobre base 10 vira ${comTeto}`);
conferir(bonusDeEscala({ hpMax: 2000 }, { de: "vidaMaxima", fator: 0.1 }, 0) === 200, "base 0 desliga o teto (uso dos testes)");

for (const [rotulo, chamada] of [
  ["sem escala", () => bonusDeEscala(bruto, null)],
  ["fonte desconhecida", () => bonusDeEscala(bruto, { de: "carisma", fator: 1 })],
  ["fator ausente", () => bonusDeEscala(bruto, { de: "defesa" })],
  ["fator negativo", () => bonusDeEscala(bruto, { de: "defesa", fator: -3 })],
  ["combatente nulo", () => bonusDeEscala(null, { de: "defesa", fator: 1 })],
  ["sem a estatística", () => bonusDeEscala({}, { de: "defesa", fator: 1 })],
]) {
  let r;
  try { r = chamada(); } catch (e) { r = `EXCEÇÃO: ${e.message}`; }
  conferir(r === 0, `${rotulo} → 0 (veio ${r})`);
}

conferir(bonusDeEscala({ hpMax: 300, hp: 300 }, { de: "vidaPerdida", fator: 1 }) === 0, "inteiro: vidaPerdida rende 0");

// Habilidade sem escala não pode mudar de valor para a IA — é o que garante
// que nada do comportamento antigo se mexeu.
const semEsc = { tipo: "dano_fisico", multiplicador: 1.7 };
conferir(multiplicadorEfetivo(semEsc, bruto) === 1.7, "habilidade sem escala mantém o multiplicador intacto");

// --------------------------------------------------------------- 2) O MOTOR
console.log("\n2) A costura no motor (a conta certa está sendo chamada?)");

function medirDano(defesa, escala, amostras = 600) {
  const semente = (() => { let s = 7; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const original = Math.random;
  Math.random = semente;
  let total = 0;
  try {
    for (let i = 0; i < amostras; i += 1) {
      const p = criarPersonagem({ nome: "g", raca: "humano", classe: "guerreiro",
        antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
      while (p.nivel < 20) { p.nivel += 1; aplicarCrescimento(p, dados); }
      p.equipamento.arma = { id: "t", nome: "Arma", tipo: "arma", atributo: "FOR", dano: 10, elemento: "fisico" };
      p.hp = p.hpMax; p.mp = p.mpMax;
      const eu = criarCombatenteJogador(p, dados, "frente");
      eu.defesa = defesa;
      const inimigo = criarCombatenteInimigo(dados.monsters.find((m) => !m.chefe), 0);
      inimigo.hp = 999999; inimigo.hpMax = 999999; inimigo.defesa = 0;
      const b = new Batalha([eu], [inimigo], dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
      const antes = inimigo.hp;
      const r = b.rolarAtaque(eu, inimigo, { multiplicador: 1, escala });
      if (r.acertou) { b.aplicarDano(inimigo, r.dano); total += antes - inimigo.hp; }
    }
  } finally { Math.random = original; }
  return total / amostras;
}

const escalaDefesa = { de: "defesa", fator: 0.5 };
const semEscala = medirDano(10, null);
const defesaBaixa = medirDano(10, escalaDefesa);
const defesaAlta = medirDano(60, escalaDefesa);

console.log(`     sem escala, defesa 10 → ${semEscala.toFixed(1)} de dano médio`);
console.log(`     com escala, defesa 10 → ${defesaBaixa.toFixed(1)}`);
console.log(`     com escala, defesa 60 → ${defesaAlta.toFixed(1)}`);

conferir(defesaBaixa > semEscala * 1.02, "a escala aumenta o dano (a costura pegou)");
conferir(defesaAlta > defesaBaixa * 1.2, "mais defesa = mais dano (a fonte é lida de verdade)");
conferir(Math.abs(medirDano(60, null) - semEscala) < 0.5, "sem escala, a defesa do atacante não muda nada (controle)");

const absurdo = medirDano(100000, escalaDefesa);
conferir(absurdo < defesaAlta * 3, `teto vale no motor: defesa 100000 dá ${absurdo.toFixed(1)}, não o infinito`);

// ---------------------------------------------------------- 3) A PROVOCAÇÃO
console.log("\n3) A provocação");

const status = criarStatusProvocar({ nome: "Chamado do Baluarte", duracao: 2 });
const provocador = { posicao: "frente", defesa: 20, hpMax: 200, hp: 200, statusEffects: [status] };
const quieto = { posicao: "frente", defesa: 20, hpMax: 200, hp: 200, statusEffects: [] };

conferir(estaProvocando(provocador), "AmeacaSystem enxerga o status criado");
conferir(status.duracao === 3, "duração 2 vira 3 no status (o turno de uso conta)");
conferir(pesoDeAmeaca(provocador) > pesoDeAmeaca(quieto) * 5, "provocar multiplica a ameaça por ~6");

const fragil = { posicao: "retaguarda", defesa: 4, hpMax: 90, hp: 90, statusEffects: [], ataque: { dano: 9 }, atb: 0 };
const pesos = pesosDeAlvo([provocador, fragil], "cacador");
const fatia = pesos[0] / (pesos[0] + pesos[1]);
console.log(`     caçador (que caça o frágil): ${(fatia * 100).toFixed(1)}% do peso vai para quem provocou`);
conferir(fatia > 0.6, "provocar vence a preferência do caçador pelo frágil");

// E NÃO PODE VIRAR TRILHO. A primeira versão deste teste afirmava que, sem
// provocação, o caçador volta a PREFERIR o frágil — e falhou. A afirmação
// estava errada, não o sistema: um alvo de frente e robusto vence a
// preferência do caçador quando a diferença de fragilidade é moderada, que é
// exatamente o desenho escolhido ("a ameaça pesa, o arquétipo continua").
const semProvocar = pesosDeAlvo([quieto, fragil], "cacador");
const fatiaFragilSem = semProvocar[1] / (semProvocar[0] + semProvocar[1]);
const fatiaFragilCom = pesos[1] / (pesos[0] + pesos[1]);
console.log(`     peso do frágil: ${(fatiaFragilSem * 100).toFixed(1)}% sem provocação → ${(fatiaFragilCom * 100).toFixed(1)}% com`);
conferir(fatiaFragilSem > fatiaFragilCom * 2.5, "provocar é o que tira o frágil da mira, e não o acaso");

const pesosFanatico = pesosDeAlvo([quieto, fragil], "fanatico");
const fatiaFanatico = pesosFanatico[1] / (pesosFanatico[0] + pesosFanatico[1]);
console.log(`     mesmo par, sem provocação: caçador dá ${(fatiaFragilSem * 100).toFixed(1)}% ao frágil, fanático dá ${(fatiaFanatico * 100).toFixed(1)}%`);
conferir(fatiaFragilSem > fatiaFanatico * 1.5, "a personalidade do arquétipo sobreviveu ao sistema de ameaça");

// -------------------------------------------------------------- 4) OS DADOS
console.log("\n4) Os nós declarados na árvore");

const FONTES_VALIDAS = new Set(["defesa", "vidaMaxima", "vidaPerdida"]);
const TIPOS_QUE_ESCALAM = new Set(["dano_fisico", "dano_fisico_des", "dano_ignora_defesa", "dano_magico", "dano_area", "cura", "cura_area"]);
const classesComEscala = new Set();
const classesComProvocar = new Set();
let ruins = 0;

for (const [classe, arv] of Object.entries(dados.skillTrees)) {
  for (const no of arv.nos || []) {
    const h = no.habilidade;
    if (!h) continue;
    if (h.tipo === "provocar") classesComProvocar.add(classe);
    if (!h.escala) continue;
    classesComEscala.add(classe);
    if (!FONTES_VALIDAS.has(h.escala.de)) { console.log(`  FALHA ${classe}/${no.id}: fonte "${h.escala.de}" não existe`); ruins += 1; }
    if (!(Number(h.escala.fator) > 0)) { console.log(`  FALHA ${classe}/${no.id}: fator inválido`); ruins += 1; }
    if (!TIPOS_QUE_ESCALAM.has(h.tipo)) { console.log(`  FALHA ${classe}/${no.id}: tipo "${h.tipo}" ignora escala — seria mentira na tela`); ruins += 1; }
    if (!(arv.ramos || []).some((r) => r.id === no.ramo)) { console.log(`  FALHA ${classe}/${no.id}: ramo "${no.ramo}" não existe`); ruins += 1; }
  }
}

conferir(ruins === 0, `nenhuma declaração de escala inválida (${ruins} encontradas)`);
const todas = Object.keys(dados.skillTrees);
const faltando = todas.filter((c) => !classesComEscala.has(c));
conferir(faltando.length === 0, `as ${todas.length} classes têm ao menos uma habilidade que escala com robustez${faltando.length ? ` (faltam: ${faltando.join(", ")})` : ""}`);
conferir(classesComProvocar.size >= 2, `pelo menos duas classes podem provocar (${[...classesComProvocar].join(", ")})`);

console.log(`\n${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
