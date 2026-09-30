// A PERGUNTA QUE A MATRIZ DE NICHO NÃO CONSEGUE RESPONDER.
//
// O pedido era: "quero habilidades em todas as classes que escalem com vida
// máxima e defesa, e não só com ataque e destreza". A afirmação a provar,
// portanto, é esta:
//
//     Um personagem que investe em DEFESA e VIDA passa a ganhar poder
//     OFENSIVO com isso — coisa que antes era impossível por construção.
//
// A matriz de nicho não consegue testar isso, e vale dizer por quê, porque a
// tentativa falhou de um jeito instrutivo: lá todo mundo recebe o MESMO
// equipamento sintético. Com as habilidades novas calibradas em paridade com
// a melhor habilidade existente de cada classe — que é o alvo certo, uma
// escolha lateral e não um upgrade automático —, o resultado com equipamento
// igual é um EMPATE. E num `argmax` determinístico, empate significa "nunca
// escolhida": a tabela inteira saiu igual à anterior.
//
// Isso não é a mudança falhando. É o instrumento errado para a pergunta: com
// equipamento idêntico para todos, não existe "investir em defesa", logo não
// há o que medir.
//
// O QUE ESTA FERRAMENTA FAZ
// -------------------------
// Para cada classe, monta DUAS versões do mesmo personagem, no mesmo nível,
// com o MESMO ORÇAMENTO de equipamento gasto de formas opostas:
//
//   LÂMINA    todo o orçamento em dano de arma.
//   COURAÇA   todo o orçamento em defesa e vida de armadura.
//
// As duas brigam contra os mesmos inimigos, com as mesmas sementes. A medida
// é o dano que cada uma produz.
//
// A LEITURA. Antes, COURAÇA era estritamente pior em dano: o orçamento gasto
// em armadura não comprava ofensiva nenhuma, e essa é a definição exata de
// "só ataque importa". Depois, COURAÇA tem uma habilidade que converte parte
// daquele investimento em dano, e a distância encolhe. O número que interessa
// é a RAZÃO couraça/lâmina: quanto mais perto de 1, mais viável é a build
// defensiva. Ela não deve CHEGAR a 1 — quem gasta tudo em arma ainda deve
// bater mais —, mas também não deve ser desprezível, senão a escolha é falsa.
//
// Uso:  node tests/prova-robustez.mjs
//       HDA_AMOSTRAS=16 node tests/prova-robustez.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { criarPersonagem, aplicarCrescimento, ataqueBase, atributosEfetivos, defesaTotal } from "../src/systems/CharacterFactory.js";
import { criarCombatenteJogador, criarCombatenteInimigo, Batalha } from "../src/systems/CombatSystem.js";
import { escolherAcaoAutomatica, configAutoBatalhaPadrao } from "../src/systems/AutoBattleAI.js";
import { arvoreDaClasse, escolherNo, pontosDisponiveis, podeEscolher } from "../src/systems/SkillTreeSystem.js";
import { LIMITE_CARDS } from "../src/systems/LoadoutSystem.js";
import { multiplicadorEfetivo } from "../src/systems/EscalaDerivada.js";

const dataDir = new URL("../src/data/", import.meta.url);
const dados = Object.fromEntries(readdirSync(dataDir).filter((f) => f.endsWith(".json"))
  .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dataDir)))]));

const N = Number(process.env.HDA_AMOSTRAS || 8);
const NIVEL = 25;
const config = configAutoBatalhaPadrao();

// ORÇAMENTO IGUAL, GASTO DE FORMAS OPOSTAS.
//
// 30 pontos para os dois lados. A taxa de câmbio (1 de dano de arma = 2 de
// defesa = 6 de vida) não é arbitrária: sai da própria ficha do jogo, onde
// 1 de CON vale 3 de vida e meio ponto de defesa. O ponto do teste não é
// acertar a taxa perfeita — é que os dois lados gastem o MESMO, para que a
// diferença de dano seja atribuível só a ONDE foi gasto.
const ORCAMENTO = 30;
const BUILDS = {
  lamina: { arma: ORCAMENTO, defesa: 0, vida: 0 },
  couraca: { arma: 0, defesa: Math.round(ORCAMENTO / 2), vida: ORCAMENTO * 2 },
};

const ALVO_UNICO = ["dano_fisico", "dano_fisico_des", "dano_magico", "dano_ignora_defesa"];
const AREA = ["dano_area"];
const APOIO = ["cura", "cura_area", "buff_time", "buff_defesa", "buff_ataque"];

function escolherCards(p) {
  const todas = p.habilidades || [];
  if (todas.length <= LIMITE_CARDS) { p.cards = todas.map((h) => h.id); p.cardsAjustado = true; return; }
  const vista = { ataque: ataqueBase(p, dados), atributos: atributosEfetivos(p, dados),
    defesa: defesaTotal(p, dados), hpMax: p.hpMax, hp: Math.round(p.hpMax * 0.5) };
  const ordem = (a, b) => multiplicadorEfetivo(b, vista) - multiplicadorEfetivo(a, vista) || String(a.id).localeCompare(String(b.id));
  const escolhidas = [];
  for (const grupo of [ALVO_UNICO, AREA, APOIO]) {
    const h = todas.filter((x) => grupo.includes(x.tipo)).sort(ordem)[0];
    if (h && !escolhidas.includes(h.id)) escolhidas.push(h.id);
  }
  for (const h of [...todas].sort(ordem)) {
    if (escolhidas.length >= LIMITE_CARDS) break;
    if (!escolhidas.includes(h.id)) escolhidas.push(h.id);
  }
  p.cards = escolhidas;
  p.cardsAjustado = true;
}

function montar(classe, build) {
  const p = criarPersonagem({ nome: `${classe}/${build}`, raca: "humano", classe,
    antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
  while (p.nivel < NIVEL) { p.nivel += 1; aplicarCrescimento(p, dados); }
  const cl = dados.classes.find((c) => c.id === classe);
  const atributo = ["FOR", "DES", "INT"].sort((a, b) => cl.crescimento[b] - cl.crescimento[a] || p.atributos[b] - p.atributos[a])[0];
  const b = BUILDS[build];
  p.equipamento.arma = { id: "arma", nome: "Arma", tipo: "arma", atributo, dano: 3 + b.arma, elemento: "fisico" };
  p.equipamento.peito = { id: "peito", nome: "Armadura", tipo: "armadura", defesa: 2 + b.defesa, vida: b.vida };
  for (let v = 0; v < 40; v += 1) {
    let comprou = false;
    if (pontosDisponiveis(p, dados) <= 0) break;
    for (const no of arvoreDaClasse(p, dados)) {
      if (pontosDisponiveis(p, dados) <= 0) break;
      if (!podeEscolher(p, dados, no)) continue;
      if (escolherNo(p, dados, no.id).ok) comprou = true;
    }
    if (!comprou) break;
  }
  // `vida` de equipamento não é lida por CharacterFactory; o orçamento
  // defensivo em vida é somado aqui, explicitamente, para não depender de um
  // campo que o motor talvez ignore em silêncio.
  p.hpMax += b.vida;
  p.hp = p.hpMax;
  p.mp = p.mpMax;
  escolherCards(p);
  return p;
}

const originalRandom = Math.random;
function semear(s) {
  Math.random = () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const pool = dados.monsters.filter((m) => !m.chefe)
  .sort((a, b) => Math.abs((a.nivel || 1) - NIVEL) - Math.abs((b.nivel || 1) - NIVEL) || b.hp - a.hp)
  .slice(0, 6);

// Solo contra dois inimigos: sem aliados, todo o dano medido é do candidato,
// e dois alvos deixam tanto alvo único quanto área fazerem sentido.
function simular(p, amostra) {
  semear(90000 + amostra);
  const inimigosDef = [pool[amostra % pool.length], pool[(amostra + 3) % pool.length]];
  const eu = criarCombatenteJogador(structuredClone(p), dados, "frente");
  const inimigos = inimigosDef.map((m, i) => {
    const c = criarCombatenteInimigo(m, i);
    c.hp = 400000; c.hpMax = 400000;  // saco de pancada: mede dano, não vitória
    return c;
  });
  const b = new Batalha([eu], inimigos, dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
  let dano = 0;
  let turnos = 0;
  const TURNOS = 40;
  for (let tick = 0; tick < 20000 && turnos < TURNOS; tick += 1) {
    for (const ator of b.avancarATB(1.6)) {
      if (!ator.vivo) continue;
      const antes = inimigos.reduce((s, c) => s + c.hp, 0);
      if (ator.isPlayer) {
        if (b.jogadorControladoPorEstado(ator)) b.perderTurnoJogadorPorEstado(ator);
        else {
          const d = escolherAcaoAutomatica(ator, b.inimigosVivos(), config, dados, { aliados: b.timeVivo() });
          if (d.habilidade) b.usarHabilidade(ator, d.habilidade, ["curar", "curar_time", "buff_time"].includes(d.tipo) ? ator : d.alvo);
          else if (d.tipo === "defender") { ator.defendendo = true; ator.primeiroTurno = false; }
          else if (d.alvo) b.ataqueBasico(ator, d.alvo);
        }
        turnos += 1;
        dano += Math.max(0, antes - inimigos.reduce((s, c) => s + c.hp, 0));
      } else b.iaInimigoAgir(ator);
      ator.atb = 0;
      b.tickCooldowns(ator);
      b.aplicarStatusTick(ator);
      if (turnos >= TURNOS) break;
    }
  }
  return { dano, turnos };
}

const linhas = [];
try {
  for (const classe of Object.keys(dados.skillTrees)) {
    const medida = {};
    for (const build of Object.keys(BUILDS)) {
      const p = montar(classe, build);
      let total = 0;
      for (let a = 0; a < N; a += 1) total += simular(p, a).dano / N;
      const usaEscala = (p.habilidades || []).some((h) => h.escala && (p.cards || []).includes(h.id));
      medida[build] = { dano: total, defesa: defesaTotal(p, dados), hpMax: p.hpMax, usaEscala };
    }
    // O CONTRAFACTUAL: a MESMA build Couraça, com as mesmas peças e a mesma
    // árvore, só que proibida de levar habilidade que escala com robustez.
    // É literalmente o jogo de antes desta mudança para aquele personagem —
    // e é a única comparação que isola o efeito, porque tudo o mais é igual.
    const antes = montar(classe, "couraca");
    antes.habilidades = (antes.habilidades || []).filter((h) => !h.escala);
    antes.cards = null; antes.cardsAjustado = false;
    escolherCards(antes);
    let danoAntes = 0;
    for (let a = 0; a < N; a += 1) danoAntes += simular(antes, a).dano / N;
    medida.couracaAntes = { dano: danoAntes };
    linhas.push({ classe, ...medida,
      razao: medida["couraca"].dano / (medida.lamina.dano || 1),
      ganho: medida["couraca"].dano / (danoAntes || 1) });
  }
} finally { Math.random = originalRandom; }

linhas.sort((a, b) => b.ganho - a.ganho);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const md = `# Prova de robustez — investir em defesa e vida compra ofensiva?

O pedido era ter habilidades, em todas as classes, que escalem com vida máxima e defesa — e não só com ataque e destreza. A afirmação a provar é que **um personagem que investe em defesa e vida agora ganha poder ofensivo com isso**, o que antes era impossível por construção: nenhuma habilidade do jogo lia defesa ou vida.

Personagem de nível ${NIVEL}, ${N} amostras, ${40} turnos por luta, solo contra dois alvos de vida efetivamente infinita (mede dano, não vitória). Mesmas sementes nas três colunas.

Três versões do MESMO personagem, mesmo orçamento de equipamento (${ORCAMENTO} pontos):

- **Lâmina** — tudo em dano de arma.
- **Couraça (antes)** — tudo em defesa e vida, e PROIBIDA de levar habilidade que escale com robustez. É o jogo de antes desta mudança, para aquele mesmo personagem.
- **Couraça (agora)** — igual, mas podendo levá-las.

A coluna **ganho** é Couraça(agora) ÷ Couraça(antes): quanto do investimento defensivo virou dano. É a única comparação que isola o efeito, porque nível, árvore, equipamento e sementes são idênticos — só a existência das habilidades muda.

A coluna **razão** é Couraça(agora) ÷ Lâmina, como referência de viabilidade. Ela não deve chegar a 100% nas classes físicas: quem gasta tudo em arma ainda tem de bater mais. Nas classes mágicas ela passa de 100% porque dano de arma quase não entra na conta delas — o feitiço escala com INT —, então ali a "Lâmina" é um espantalho e só o **ganho** significa alguma coisa.

| Classe | Lâmina | Couraça (antes) | Couraça (agora) | Ganho | Razão | Defesa | Vida | Usa escala |
|---|---:|---:|---:|---:|---:|---:|---:|---|
${linhas.map((l) => `| ${l.classe} | ${Math.round(l.lamina.dano)} | ${Math.round(l.couracaAntes.dano)} | ${Math.round(l["couraca"].dano)} | **${pct(l.ganho)}** | ${pct(l.razao)} | ${l["couraca"].defesa} | ${l["couraca"].hpMax} | ${l["couraca"].usaEscala ? "sim" : "não"} |`).join("\n")}

## Limites

Uma taxa de câmbio declarada (1 de dano de arma = 2 de defesa = 6 de vida) e um orçamento só. Mede dano produzido, não vitória nem sobrevivência — a build Couraça também apanha menos e morre menos, e isso não aparece aqui. IA automática, não jogador humano. Ganho de 100% significa que a classe tem a habilidade mas ela não venceu uma das 4 vagas de card naquela build.
`;

mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
writeFileSync(new URL("../reports/prova-robustez.md", import.meta.url), md);
writeFileSync(new URL("../reports/prova-robustez.json", import.meta.url), JSON.stringify({ nivel: NIVEL, amostras: N, orcamento: ORCAMENTO, linhas }, null, 2));
console.log(md);
