// CALIBRAR CONTRA A SIMULAÇÃO, E NÃO CONTRA UMA FÓRMULA.
//
// POR QUE ESTE SCRIPT EXISTE, EM VEZ DE MAIS UMA VERSÃO DO calibrar-escala
// ------------------------------------------------------------------------
// A régua de calibração já teve quatro versões: multiplicador cru,
// multiplicador efetivo, poder por turno, previsão do motor. Todas são
// PROXIES do que importa — e cada uma errou de um jeito diferente:
//
//   • multiplicador efetivo dizia "estão em paridade" e a simulação mostrou
//     que seis de dez classes não levavam a habilidade;
//   • poder por turno diz que cinco delas JÁ estão acima do alvo, e a
//     simulação continua dizendo que não são levadas.
//
// Duas réguas, duas respostas, e nenhuma delas é o jogo. A terceira tentativa
// de afinar um proxy seria teimosia.
//
// Aqui a pergunta é feita direto ao motor: PARA QUE FATOR esta habilidade
// passa a render mais, em dano simulado, do que a build que o personagem
// montaria sem ela? O número que sai é o menor fator em que levar a
// habilidade é melhor que não levar — medido, não estimado.
//
// COMO FUNCIONA
// -------------
//   1. monta o personagem com orçamento defensivo (é a build para quem a
//      habilidade robusta foi desenhada);
//   2. mede a melhor build SEM a habilidade — subida de encosta sobre dano,
//      uma vez por classe, e guarda;
//   3. para cada fator candidato, troca o card mais fraco dessa build pela
//      habilidade e mede de novo;
//   4. devolve o menor fator em que a troca rende MARGEM a mais.
//
// Custo: uma subida de encosta por classe, mais uma medição por fator. É
// caro, e é o preço de não chutar.
//
// Uso:  node scripts/calibrar-por-simulacao.mjs
//       HDA_AMOSTRAS=8 node scripts/calibrar-por-simulacao.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { criarPersonagem, aplicarCrescimento, ataqueBase, atributosEfetivos, defesaTotal } from "../src/systems/CharacterFactory.js";
import { criarCombatenteJogador, criarCombatenteInimigo, Batalha } from "../src/systems/CombatSystem.js";
import { escolherAcaoAutomatica, configAutoBatalhaPadrao } from "../src/systems/AutoBattleAI.js";
import { arvoreDaClasse, escolherNo, pontosDisponiveis, podeEscolher } from "../src/systems/SkillTreeSystem.js";
import { LIMITE_CARDS } from "../src/systems/LoadoutSystem.js";
import { valorPorTurno } from "../src/systems/ValorDeHabilidade.js";
import { NOS_NOVOS } from "./aplicar-escala-derivada.mjs";

const dataDir = new URL("../src/data/", import.meta.url);
const dados = Object.fromEntries(readdirSync(dataDir).filter((f) => f.endsWith(".json"))
  .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dataDir)))]));

const N = Number(process.env.HDA_AMOSTRAS || 5);
const NIVEL = 25;
const ORCAMENTO = 30;
// Quanto a troca precisa render a mais para valer a vaga. 3% e nao 10%:
// aqui a comparacao e DIRETA (mesma build, um card trocado), entao a margem
// so precisa cobrir o ruido da simulacao, nao a incerteza de um proxy.
const MARGEM = 1.03;
// Fatores testados, do mais contido ao mais generoso. A busca para no
// primeiro que passa — nao existe razao para dar mais poder do que o
// necessario para a habilidade valer a escolha.
const MULTIPLOS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

const config = configAutoBatalhaPadrao();
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

// O nó em teste é comprado ANTES do resto.
//
// Sem isto o paladino nunca recebia a habilidade: a árvore dele custa 29 e o
// jogador tem 24 pontos, o guloso compra na ordem do arquivo, e nó novo
// entra no fim da lista. Ficar de fora por ordem de array não diz nada sobre
// a habilidade — e a pergunta aqui é "SE você tem, vale a vaga de card?".
function montar(classe, idNo) {
  const p = criarPersonagem({ nome: classe, raca: "humano", classe,
    antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
  while (p.nivel < NIVEL) { p.nivel += 1; aplicarCrescimento(p, dados); }
  const cl = dados.classes.find((c) => c.id === classe);
  const atributo = ["FOR", "DES", "INT"].sort((a, b) => cl.crescimento[b] - cl.crescimento[a] || p.atributos[b] - p.atributos[a])[0];
  p.equipamento.arma = { id: "arma", nome: "Arma", tipo: "arma", atributo, dano: 3, elemento: "fisico" };
  p.equipamento.peito = { id: "peito", nome: "Armadura", tipo: "armadura", defesa: 2 + Math.round(ORCAMENTO / 2) };
  // Primeiro abre caminho até o nó em teste: compra os pré-requisitos do
  // ramo dele por tier, depois ele.
  const alvo = (dados.skillTrees[classe]?.nos || []).find((n) => n.id === idNo);
  if (alvo) {
    const doRamo = (dados.skillTrees[classe].nos || []).filter((n) => n.ramo === alvo.ramo && n.tier <= alvo.tier)
      .sort((a, b) => a.tier - b.tier);
    for (let v = 0; v < 10; v += 1) {
      for (const no of [...doRamo, alvo]) {
        if (pontosDisponiveis(p, dados) <= 0) break;
        if (!podeEscolher(p, dados, no)) continue;
        escolherNo(p, dados, no.id);
      }
      if (podeEscolher(p, dados, alvo) === false) break;
    }
  }
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
  p.hpMax += ORCAMENTO * 2;
  p.hp = p.hpMax;
  p.mp = p.mpMax;
  return p;
}

function simular(p, cards, amostra, quantos) {
  semear(90000 + amostra);
  const copia = { ...p, cards: [...cards], cardsAjustado: true };
  const eu = criarCombatenteJogador(structuredClone(copia), dados, "frente");
  const inimigos = Array.from({ length: quantos }, (_, i) => pool[(amostra + i * 3) % pool.length]).map((m, i) => {
    const c = criarCombatenteInimigo(m, i);
    c.hp = 400000; c.hpMax = 400000;
    return c;
  });
  const b = new Batalha([eu], inimigos, dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
  let dano = 0;
  let turnos = 0;
  for (let tick = 0; tick < 20000 && turnos < 40; tick += 1) {
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
      if (turnos >= 40) break;
    }
  }
  return dano;
}

const medir = (p, cards, quantos) => {
  let t = 0;
  for (let a = 0; a < N; a += 1) t += simular(p, cards, a, quantos) / N;
  return t;
};

function melhorBuildSem(p, idProibido, quantos) {
  const todas = (p.habilidades || []).filter((h) => h.id !== idProibido);
  const vista = { ataque: ataqueBase(p, dados), atributos: atributosEfetivos(p, dados),
    defesa: defesaTotal(p, dados), hpMax: p.hpMax, hp: Math.round(p.hpMax * 0.5) };
  let atual = [...todas].sort((a, b) => valorPorTurno(b, vista) - valorPorTurno(a, vista)).slice(0, LIMITE_CARDS).map((h) => h.id);
  let melhor = medir(p, atual, quantos);
  const candidatos = todas.map((h) => h.id);
  for (let volta = 0; volta < 2; volta += 1) {
    let melhorou = false;
    for (let slot = 0; slot < atual.length; slot += 1) {
      for (const cand of candidatos) {
        if (atual.includes(cand)) continue;
        const tentativa = [...atual];
        tentativa[slot] = cand;
        const dano = medir(p, tentativa, quantos);
        if (dano > melhor * 1.005) { melhor = dano; atual = tentativa; melhorou = true; }
      }
    }
    if (!melhorou) break;
  }
  return { cards: atual, dano: melhor };
}

const linhas = [];
try {
  for (const d of NOS_NOVOS) {
    if (!d.habilidade.escala) continue;
    const idHab = `${d.id}_skill`;
    const p = montar(d.classe, d.id);
    if (!(p.habilidades || []).some((h) => h.id === idHab)) { linhas.push({ ...d, erro: "habilidade não está na ficha" }); continue; }
    const mapa = Object.fromEntries((p.habilidades || []).map((h) => [h.id, h]));
    const hab = mapa[idHab];
    const fatorOriginalLocal = d.habilidade.escala.fator;

    // DOIS CENÁRIOS, e isto corrigiu a leitura.
    //
    // Com só 2 inimigos, as que "não achavam" estariam substituindo
    // `barragem`, `tempestade_laminas`, `investida`, `cadeia_raios` — todas
    // de ÁREA. Alvo único não vence área quando há dois alvos, por mais
    // forte que fique: a área bate duas vezes. Era o mesmo erro de julgar a
    // área do mago num duelo, ao contrário.
    //
    // Então cada habilidade é medida onde ela VIVE: duelo para alvo único,
    // multidão para área. As duas colunas ficam no relatório.
    const porCenario = {};
    for (const quantos of [1, 2]) {
      hab.escala = { ...hab.escala, fator: fatorOriginalLocal };
      const base = melhorBuildSem(p, idHab, quantos);
      let escolhido = null;
      let danoEscolhido = 0;
      let trocado = null;
      for (const mult of MULTIPLOS) {
        hab.escala = { ...hab.escala, fator: fatorOriginalLocal * mult };
        let melhorDano = 0;
        let melhorTroca = null;
        for (const alvo of base.cards) {
          const dano = medir(p, base.cards.map((c) => (c === alvo ? idHab : c)), quantos);
          if (dano > melhorDano) { melhorDano = dano; melhorTroca = alvo; }
        }
        danoEscolhido = melhorDano;
        trocado = melhorTroca;
        if (melhorDano >= base.dano * MARGEM) { escolhido = fatorOriginalLocal * mult; break; }
      }
      porCenario[quantos] = { fator: escolhido, danoSem: base.dano, danoCom: danoEscolhido,
        ganho: danoEscolhido / (base.dano || 1), trocado };
    }
    hab.escala = { ...hab.escala, fator: fatorOriginalLocal };
    linhas.push({ classe: d.classe, nome: d.nome, tipo: d.habilidade.tipo,
      fonte: d.habilidade.escala.de, fatorOriginal: fatorOriginalLocal, porCenario });
  }
} finally { Math.random = originalRandom; }

const pct = (x) => `${((x - 1) * 100).toFixed(1)}%`;
let md = `# Calibração por simulação — que fator faz a habilidade valer a vaga?

Três réguas de fórmula deram três respostas diferentes e nenhuma delas é o jogo. Aqui a pergunta vai direto ao motor: **para que fator levar esta habilidade rende mais dano, medido, do que a melhor build sem ela?**

Personagem de nível ${NIVEL} com orçamento defensivo (${ORCAMENTO} pontos em defesa e vida), ${N} amostras, 40 turnos, solo contra dois alvos. A build de referência é a melhor que o personagem monta **sem** a habilidade, por subida de encosta sobre dano simulado. Depois o card de menor valor dessa build é trocado pela habilidade robusta, e o fator sobe até a troca render ${pct(MARGEM)} a mais.

| Classe | Habilidade | Tipo | Fator atual | Duelo: fator / ganho | 2 inimigos: fator / ganho | Substitui (duelo) |
|---|---|---|---:|---:|---:|---|
${linhas.map((l) => {
  if (l.erro) return `| ${l.classe} | ${l.nome} | — | — | — | — | ${l.erro} |`;
  const c = (n) => {
    const x = l.porCenario[n];
    return x.fator === null ? `não achou (${pct(x.ganho)})` : `**${x.fator.toFixed(2)}** / ${pct(x.ganho)}`;
  };
  return `| ${l.classe} | ${l.nome} | ${l.tipo.replace("dano_", "")} | ${l.fatorOriginal} | ${c(1)} | ${c(2)} | ${l.porCenario[1].trocado || "—"} |`;
}).join("\n")}

"Não achou" significa que nem com ${MULTIPLOS[MULTIPLOS.length - 1]}× o fator original a troca compensou — a habilidade que ela substituiria é boa demais, ou a fonte de escala daquela classe é pequena demais para render.

## Limites

Um orçamento, um nível, dois inimigos, sem chefe. Mede dano, não sobrevivência nem utilidade — a build defensiva também apanha menos, e isso não aparece aqui. A troca testada é sempre pelo card de menor valor por turno: uma troca diferente poderia render mais.
`;

mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
writeFileSync(new URL("../reports/calibracao-por-simulacao.md", import.meta.url), md);
writeFileSync(new URL("../reports/calibracao-por-simulacao.json", import.meta.url), JSON.stringify({ nivel: NIVEL, amostras: N, margem: MARGEM, linhas }, null, 2));
console.log(md);
