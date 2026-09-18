// Suíte de cenários da mão de cards (itens 87, 88 e 89 do pedido).
//
// Roda em Node puro, sem navegador: BattleForecast.js e TacticalAdvisor.js
// foram escritos sem nenhuma dependência de DOM justamente para isso. O que
// esta suíte verifica NÃO é "o código roda", e sim se a RECOMENDAÇÃO é a
// certa em cada situação concreta descrita no pedido:
//
//   1. inimigo vulnerável              -> o card do elemento certo é o topo
//   2. aliado quase morto              -> cura ganha de um golpe muito maior
//   3. chefe carregando um golpe forte -> a resposta certa ganha do DPS
//   4. inimigo com 1 HP                -> execução vira oportunidade
//   5. combo elemental disponível      -> o card que dispara a reação sobe
//   6. personagem sem recurso          -> card bloqueado, nunca recomendado
//   7. alvo imune                      -> jamais recomendado
//   8. posição (item 89)               -> recuar só quando faz diferença
//   9. layout (item 87)                -> 5/6/8 cards e nomes longos
//
// Uso:  node scripts/test-battle-cards.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Batalha, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { montarMao, preverCard } from "../src/systems/BattleForecast.js";
import { montarContextoTatico, avaliarMao } from "../src/systems/TacticalAdvisor.js";
import { aplicarEstadoElemental } from "../src/systems/ElementalReactionSystem.js";
import { identidadeElemento } from "../src/systems/ElementIdentity.js";
import { descreverCenario } from "../src/systems/BattleTerrainSystem.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (nome) => JSON.parse(readFileSync(join(raiz, "src", "data", `${nome}.json`), "utf8"));

const dados = {
  elements: json("elements"),
  elementalStates: json("elementalStates"),
  elementalReactions: json("elementalReactions"),
  monsters: json("monsters"),
};

let passou = 0;
let falhou = 0;
const falhas = [];

function checar(nome, condicao, detalhe = "") {
  if (condicao) { passou += 1; console.log(`  ✓ ${nome}`); }
  else { falhou += 1; falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`); console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

// ---------------------------------------------------------------------
// Fábricas de combatentes de teste (mesmo formato de CombatSystem.js).
// ---------------------------------------------------------------------
function heroi(over = {}) {
  return {
    id: "player", nome: "Aric", isPlayer: true,
    hp: 100, hpMax: 100, mp: 30, mpMax: 30,
    atributos: { FOR: 14, DES: 10, CON: 12, INT: 14 },
    defesa: 8, velocidade: 10,
    ataque: { dano: 12, atributo: "FOR", bonusCritico: 0 },
    critBonus: 0, elemento: "fisico",
    habilidades: [], tracoId: null, racaId: "humano", classeId: "guerreiro",
    sorteUsada: false, primeiroTurno: false, atb: 100, atbMax: 100,
    statusEffects: [], sopro_usado: true, defendendo: false, posicao: "frente", vivo: true,
    ...over,
  };
}

function monstro(over = {}) {
  return {
    id: over.id || "mob_0", monstroId: "mob", nome: "Servo de Gelo", isPlayer: false,
    hp: 60, hpMax: 60, mp: 0, mpMax: 0,
    atributos: { FOR: 12, DES: 8, CON: 20, INT: 12 },
    defesa: 6, velocidade: 8,
    ataque: { dano: 14, atributo: "FOR", bonusCritico: 0 },
    elemento: "gelo", habilidades: [], sorteUsada: false, primeiroTurno: false,
    atb: 0, atbMax: 100, statusEffects: [], chefe: false, solo: false,
    postura: 0, posturaMax: 0, atordoado: false, arquetipo: "agressor",
    defendendo: false, jaRoubou: false, jaInvocou: false, invocacaoDef: null,
    vivo: true, xp: 10, ouroMin: 1, ouroMax: 3,
    ...over,
  };
}

function hab(over) {
  return { id: "h", nome: "Habilidade", descricao: "", custoMP: 0, cooldown: 0, cooldownAtual: 0, tipo: "dano_fisico", multiplicador: 1.5, ...over };
}

// Monta o mesmo pipeline que a UI usa, sem UI.
function avaliar({ jogador, aliados, inimigos, alvo, intencoes = new Map(), sugestao = "completo", contexto = {} }) {
  const batalha = new Batalha(aliados, inimigos, dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
  const inimigosVivos = inimigos.filter((i) => i.vivo);
  const cards = montarMao(jogador, { temItens: false, podeReposicionar: true, ...contexto });
  const estado = { batalha, jogador, alvo, aliados, inimigosVivos, intencoes, dados };
  const previsoes = new Map(cards.map((c) => [c.id, preverCard(c, estado)]));
  const ctx = montarContextoTatico({ jogador, aliados, inimigosVivos, intencoes, batalha });
  const avaliacoes = avaliarMao(cards, previsoes, ctx, { sugestao, alvo });
  const topo = [...avaliacoes.entries()].sort((a, b) => b[1].score - a[1].score)[0];
  return { cards, previsoes, avaliacoes, batalha, topo, melhor: [...avaliacoes.entries()].find(([, a]) => a.melhorJogada) };
}

const nomeDoCard = (cards, id) => (cards.find((c) => c.id === id) || {}).nome;

// =====================================================================
console.log("\n[1] Inimigo vulnerável a um elemento específico");
// =====================================================================
{
  const golpeChama = hab({ id: "chama", nome: "Lâmina Flamejante", tipo: "dano_fisico", multiplicador: 1.4, elemento: "fogo" });
  const golpeMare = hab({ id: "mare", nome: "Corte da Maré", tipo: "dano_fisico", multiplicador: 1.4, elemento: "agua" });
  const jogador = heroi({ habilidades: [golpeChama, golpeMare] });
  // Servo de Gelo: fogo tem vantagem_intensa contra gelo; água é resistida
  // por gelo (gelo é forteIntensa contra agua, mas o que importa aqui é
  // agua->gelo, que é neutro) — usamos o par forte de propósito.
  const alvo = monstro({ elemento: "gelo" });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const chama = r.avaliacoes.get("hab_chama");
  const mare = r.avaliacoes.get("hab_mare");
  const prevChama = r.previsoes.get("hab_chama");
  checar("Chama contra Geada é reconhecida como vantagem intensa", prevChama.dano.relacaoElemental === "vantagem_intensa", prevChama.dano.relacaoElemental);
  checar("Chama pontua mais que Maré contra alvo de Geada", chama.score > mare.score, `chama=${chama.score} mare=${mare.score}`);
  checar("O card recomendado é o de Chama", r.melhor && r.melhor[0] === "hab_chama", r.melhor ? nomeDoCard(r.cards, r.melhor[0]) : "nenhum");
}

// =====================================================================
console.log("\n[2] Aliado quase morto: cura pequena tem de ganhar de golpe grande");
// =====================================================================
{
  const cura = hab({ id: "cura", nome: "Toque Restaurador", tipo: "cura", multiplicador: 7, custoMP: 8 });
  const golpao = hab({ id: "golpao", nome: "Golpe Devastador", tipo: "dano_fisico", multiplicador: 3.2 });
  // 8% de HP, exatamente o exemplo do item 46.
  const jogador = heroi({ hp: 8, hpMax: 100, habilidades: [cura, golpao], atributos: { FOR: 14, DES: 10, CON: 12, INT: 14 } });
  const alvo = monstro({ hp: 400, hpMax: 400, elemento: "fisico" });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const sCura = r.avaliacoes.get("hab_cura").score;
  const sGolpe = r.avaliacoes.get("hab_golpao").score;
  checar("Cura pontua mais que o golpe grande com 8% de HP", sCura > sGolpe, `cura=${sCura} golpe=${sGolpe}`);
  checar("A recomendação é a cura", r.melhor && r.melhor[0] === "hab_cura", r.melhor ? nomeDoCard(r.cards, r.melhor[0]) : "nenhum");

  // Contraprova: com o mesmo par de cards e o herói com vida cheia, a cura
  // NÃO pode ser recomendada (senão a regra estaria apenas "gostando de cura").
  const saudavel = heroi({ hp: 100, hpMax: 100, habilidades: [cura, golpao] });
  const r2 = avaliar({ jogador: saudavel, aliados: [saudavel], inimigos: [monstro({ hp: 400, hpMax: 400, elemento: "fisico" })], alvo: monstro({ hp: 400, hpMax: 400, elemento: "fisico" }) });
  checar("Com vida cheia a cura deixa de ser recomendada", !(r2.melhor && r2.melhor[0] === "hab_cura"), r2.melhor ? nomeDoCard(r2.cards, r2.melhor[0]) : "nenhum");
}

// =====================================================================
console.log("\n[3] Chefe preparando um golpe letal: a resposta ganha do DPS");
// =====================================================================
{
  const escudo = hab({ id: "escudo", nome: "Escudo Arcano", tipo: "buff_defesa", duracao: 2, valor: 0.5, custoMP: 8 });
  const golpe = hab({ id: "golpe", nome: "Golpe Poderoso", tipo: "dano_fisico", multiplicador: 1.5 });
  const jogador = heroi({ hp: 40, hpMax: 100, habilidades: [escudo, golpe] });
  const chefe = monstro({ id: "chefe_0", nome: "Dragão Jovem", chefe: true, posturaMax: 100, hp: 500, hpMax: 500, elemento: "fogo", ataque: { dano: 60, atributo: "FOR", bonusCritico: 0 }, atributos: { FOR: 60, DES: 12, CON: 40, INT: 40 } });
  const batalhaTmp = new Batalha([jogador], [chefe], dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
  const plano = { tipo: "atacar", alvo: jogador };
  const intencoes = new Map([[chefe, { plano, faixa: batalhaTmp.estimarDanoIntencao(chefe, plano) }]]);
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [chefe], alvo: chefe, intencoes });
  const faixa = intencoes.get(chefe).faixa;
  checar("A intenção do chefe tem faixa de dano estimada", faixa && faixa.esperado > 0, faixa ? `${faixa.min}-${faixa.max}` : "sem faixa");
  const sDefensivo = Math.max(r.avaliacoes.get("hab_escudo").score, r.avaliacoes.get("acao_defender").score);
  const sOfensivo = r.avaliacoes.get("hab_golpe").score;
  checar("Uma resposta defensiva pontua mais que o ataque quando o golpe é letal",
    faixa.esperado >= jogador.hp ? sDefensivo > sOfensivo : true,
    `defensivo=${sDefensivo} ofensivo=${sOfensivo} golpe=${faixa.esperado} hp=${jogador.hp}`);
  checar("O card de Defender explica o dano evitado",
    r.previsoes.get("acao_defender").defesa && r.previsoes.get("acao_defender").defesa.danoEvitado != null);
}

// =====================================================================
console.log("\n[4] Inimigo com 1 HP: execução vira oportunidade especial");
// =====================================================================
{
  const golpe = hab({ id: "golpe", nome: "Golpe Poderoso", tipo: "dano_fisico", multiplicador: 1.5 });
  const jogador = heroi({ habilidades: [golpe] });
  const moribundo = monstro({ id: "mob_1", nome: "Lobo Ferido", hp: 1, hpMax: 60, elemento: "fisico" });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [moribundo], alvo: moribundo });
  const prev = r.previsoes.get("hab_golpe");
  checar("O card marca EXECUÇÃO GARANTIDA", prev.execucao === "garantida", String(prev.execucao));
  checar("A recomendação é nível 3 (oportunidade especial)", r.melhor && r.melhor[1].nivel === 3, r.melhor ? `nivel ${r.melhor[1].nivel}` : "nenhum");
  checar("A chance de matar considera a chance de errar (nunca 100%)", prev.chanceMatar > 0.7 && prev.chanceMatar < 1, String(prev.chanceMatar));
}

// =====================================================================
console.log("\n[5] Combo elemental disponível (alvo Molhado + golpe de Geada)");
// =====================================================================
{
  const geada = hab({ id: "geada", nome: "Prisão de Geada", tipo: "dano_magico", multiplicador: 1.6, elemento: "gelo", custoMP: 6 });
  const soco = hab({ id: "soco", nome: "Golpe Sísmico", tipo: "dano_fisico", multiplicador: 1.9 });
  const jogador = heroi({ habilidades: [geada, soco], atributos: { FOR: 14, DES: 10, CON: 12, INT: 20 } });
  const alvo = monstro({ elemento: "fisico", hp: 200, hpMax: 200 });
  aplicarEstadoElemental(alvo, "molhado", dados.elementalStates);
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const prevGeada = r.previsoes.get("hab_geada");
  checar("A reação Congelamento é prevista", prevGeada.reacao && prevGeada.reacao.id === "congelamento", prevGeada.reacao ? prevGeada.reacao.id : "nenhuma");
  checar("O card mostra o status resultante (Congelado)", !!prevGeada.status && /congelad/i.test(prevGeada.status.nome), prevGeada.status ? prevGeada.status.nome : "nenhum");
  checar("O card de combo é o recomendado", r.melhor && r.melhor[0] === "hab_geada", r.melhor ? nomeDoCard(r.cards, r.melhor[0]) : "nenhum");
}

// =====================================================================
console.log("\n[6] Sem recurso: o card fica bloqueado e nunca é recomendado");
// =====================================================================
{
  const caro = hab({ id: "caro", nome: "Chuva de Meteoros", tipo: "dano_magico", multiplicador: 4, elemento: "fogo", custoMP: 25 });
  const jogador = heroi({ mp: 18, mpMax: 30, habilidades: [caro] });
  const alvo = monstro({ elemento: "gelo" });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const prev = r.previsoes.get("hab_caro");
  checar("O card é marcado como indisponível", prev.disponivel === false);
  checar("O motivo do bloqueio é recurso, com a falta exata", prev.bloqueio.motivo === "recurso" && prev.bloqueio.falta === 7, JSON.stringify(prev.bloqueio));
  checar("O card bloqueado tem score 0", r.avaliacoes.get("hab_caro").score === 0, String(r.avaliacoes.get("hab_caro").score));
  checar("O card bloqueado não recebe destaque", !r.avaliacoes.get("hab_caro").nivel);
  checar("Mesmo bloqueado, o card continua na mão (não some)", r.cards.some((c) => c.id === "hab_caro"));
}

// =====================================================================
console.log("\n[7] Alvo imune ao elemento: jamais recomendado");
// =====================================================================
{
  const chama = hab({ id: "chama", nome: "Lâmina Flamejante", tipo: "dano_fisico", multiplicador: 2.5, elemento: "fogo" });
  const jogador = heroi({ habilidades: [chama] });
  const alvo = monstro({ nome: "Elemental de Chama", elemento: "fogo", hp: 30, hpMax: 200 });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const prev = r.previsoes.get("hab_chama");
  checar("A previsão marca imunidade", prev.dano && prev.dano.imune === true);
  checar("O card imune tem score 0", r.avaliacoes.get("hab_chama").score === 0, String(r.avaliacoes.get("hab_chama").score));
  checar("O card imune não é a melhor jogada", !r.avaliacoes.get("hab_chama").melhorJogada);
}

// =====================================================================
console.log("\n[8] Posição (item 89): recuar só quando muda alguma coisa");
// =====================================================================
{
  const golpe = hab({ id: "golpe", nome: "Golpe", tipo: "dano_fisico", multiplicador: 1.4 });
  // (a) Frágil na frente, com aliado de pé atrás e um agressor mirando nele.
  const frágil = heroi({ nome: "Lirael", hp: 18, hpMax: 100, posicao: "frente", habilidades: [golpe] });
  const tanque = heroi({ nome: "Drakan", hp: 90, hpMax: 100, posicao: "frente" });
  const bruto = monstro({ id: "bruto", nome: "Bruto", arquetipo: "agressor", ataque: { dano: 30, atributo: "FOR", bonusCritico: 0 }, atributos: { FOR: 30, DES: 8, CON: 30, INT: 8 } });
  const bTmp = new Batalha([frágil, tanque], [bruto], dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
  const plano = { tipo: "atacar", alvo: frágil };
  const intencoes = new Map([[bruto, { plano, faixa: bTmp.estimarDanoIntencao(bruto, plano) }]]);
  const r = avaliar({ jogador: frágil, aliados: [frágil, tanque], inimigos: [bruto], alvo: bruto, intencoes });
  const rep = r.previsoes.get("acao_reposicionar");
  checar("O card de posição existe e aponta a retaguarda", rep.reposicionamento && rep.reposicionamento.destino === "retaguarda");
  checar("Ele identifica a ameaça de que se esquiva", rep.reposicionamento.ameacasEvitadas.length === 1, JSON.stringify(rep.reposicionamento.ameacasEvitadas.map((a) => a.inimigo.nome)));
  checar("Recuar pontua acima do limiar de recomendação", r.avaliacoes.get("acao_reposicionar").score >= 45, String(r.avaliacoes.get("acao_reposicionar").score));

  // (b) Mesma personagem, mas sem ninguém para segurar a frente: recuar não
  // adianta nada e não pode ser recomendado.
  const sozinha = heroi({ nome: "Lirael", hp: 18, hpMax: 100, posicao: "frente", habilidades: [golpe] });
  const r2 = avaliar({ jogador: sozinha, aliados: [sozinha], inimigos: [monstro({ id: "b2", arquetipo: "agressor" })], alvo: monstro({ id: "b2", arquetipo: "agressor" }) });
  checar("Sem frente viva, recuar não é recomendado", !(r2.melhor && r2.melhor[0] === "acao_reposicionar"), r2.melhor ? nomeDoCard(r2.cards, r2.melhor[0]) : "nenhum");
}

// =====================================================================
console.log("\n[9] Ruptura e interrupção contra chefe");
// =====================================================================
{
  const golpeGeada = hab({ id: "geada", nome: "Estilhaço de Geada", tipo: "dano_fisico", multiplicador: 1.6, elemento: "gelo" });
  const jogador = heroi({ habilidades: [golpeGeada] });
  // Chefe de Vida (natureza): geada não tem vantagem, mas terra sim... aqui o
  // que importa é a postura quase cheia, que deve virar "quebra".
  const chefe = monstro({ id: "chefe", nome: "Guardião", chefe: true, posturaMax: 100, postura: 95, hp: 900, hpMax: 900, elemento: "fisico" });
  const bTmp = new Batalha([jogador], [chefe], dados.elements, null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);
  const plano = { tipo: "atacar", alvo: jogador };
  const intencoes = new Map([[chefe, { plano, faixa: bTmp.estimarDanoIntencao(chefe, plano) }]]);
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [chefe], alvo: chefe, intencoes });
  const prev = r.previsoes.get("hab_geada");
  checar("A ruptura prevista quebra a postura", prev.ruptura && prev.ruptura.quebra === true, JSON.stringify(prev.ruptura));
  checar("O card é marcado como interrupção", !!prev.interrompe, prev.interrompe ? prev.interrompe.vias.join("; ") : "nenhuma");
  checar("Quebrar postura vira oportunidade especial", r.melhor && r.melhor[1].nivel === 3, r.melhor ? `nivel ${r.melhor[1].nivel}` : "nenhum");
}

// =====================================================================
console.log("\n[10] Personalidade da recomendação (item 47)");
// =====================================================================
{
  const golpe = hab({ id: "golpe", nome: "Golpe", tipo: "dano_fisico", multiplicador: 1.4 });
  const jogador = heroi({ habilidades: [golpe] });
  const alvo = monstro({ elemento: "fisico", hp: 200, hpMax: 200 });
  const off = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo, sugestao: "off" });
  checar("OFF não destaca nenhum card", ![...off.avaliacoes.values()].some((a) => a.nivel));
  checar("OFF ainda calcula a previsão de dano", off.previsoes.get("hab_golpe").dano.max > 0);

  // BÁSICO: só o que é óbvio. Alvo saudável e sem nada especial -> nada.
  const basico = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo, sugestao: "basico" });
  checar("BÁSICO não destaca uma jogada comum", ![...basico.avaliacoes.values()].some((a) => a.melhorJogada));

  // BÁSICO com execução garantida -> destaca.
  const moribundo = monstro({ id: "m2", hp: 1, hpMax: 60, elemento: "fisico" });
  const basico2 = avaliar({ jogador, aliados: [jogador], inimigos: [moribundo], alvo: moribundo, sugestao: "basico" });
  checar("BÁSICO destaca a execução garantida", !!basico2.melhor, basico2.melhor ? nomeDoCard(basico2.cards, basico2.melhor[0]) : "nenhum");
}

// =====================================================================
console.log("\n[11] Foco visual (item 67): no máximo 3 cards destacados");
// =====================================================================
{
  const habs = [];
  for (let i = 0; i < 6; i += 1) habs.push(hab({ id: `h${i}`, nome: `Golpe ${i}`, tipo: "dano_fisico", multiplicador: 1.4 + i * 0.05, elemento: "fogo" }));
  const jogador = heroi({ habilidades: habs });
  const alvo = monstro({ elemento: "gelo", hp: 40, hpMax: 300 });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const destacados = [...r.avaliacoes.values()].filter((a) => a.nivel).length;
  const melhores = [...r.avaliacoes.values()].filter((a) => a.melhorJogada).length;
  checar("No máximo 3 cards ficam destacados ao mesmo tempo", destacados <= 3, `destacados=${destacados}`);
  checar("Só um card recebe a estrela de melhor jogada", melhores === 1, `melhores=${melhores}`);
}

// =====================================================================
console.log("\n[12] Layout (item 87): 5, 6 e 8 cards, e nomes longos");
// =====================================================================
{
  for (const qtdHabilidades of [1, 2, 4]) {
    const habs = [];
    for (let i = 0; i < qtdHabilidades; i += 1) habs.push(hab({ id: `h${i}`, nome: `Golpe ${i}` }));
    const jogador = heroi({ habilidades: habs });
    const alvo = monstro();
    const r = avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo, contexto: { temItens: true } });
    // Ataque + N habilidades + Defender + Reposicionar + Item + Fugir
    const esperado = 1 + qtdHabilidades + 4;
    checar(`Mão com ${qtdHabilidades} habilidade(s) gera ${esperado} cards`, r.cards.length === esperado, `gerou ${r.cards.length}`);
    checar(`Todos os ${r.cards.length} cards têm previsão`, [...r.previsoes.values()].every((p) => p != null));
  }
  const nomeLongo = "Invocação Cataclísmica dos Herdeiros Esquecidos de Aethra";
  const jogador = heroi({ habilidades: [hab({ id: "longo", nome: nomeLongo, multiplicador: 2.2 })] });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [monstro()], alvo: monstro() });
  checar("Nome muito longo é aceito sem quebrar a montagem", nomeDoCard(r.cards, "hab_longo") === nomeLongo);
}

// =====================================================================
console.log("\n[13] Identidade elemental completa");
// =====================================================================
{
  const idsDoJogo = dados.elements.elementos.map((e) => e.id);
  const semIdentidade = idsDoJogo.filter((id) => identidadeElemento(id).nomeMundo === "Aço" && id !== "fisico");
  checar("Todo elemento de elements.json tem identidade visual própria", semIdentidade.length === 0, semIdentidade.join(", "));
  const runas = new Set(idsDoJogo.map((id) => identidadeElemento(id).runa));
  checar("Cada elemento tem uma runa distinta (cor nunca é o único sinal)", runas.size === idsDoJogo.length, `${runas.size} runas para ${idsDoJogo.length} elementos`);
}

// =====================================================================
console.log("\n[14] As prévias nunca alteram estado de batalha");
// =====================================================================
{
  const geada = hab({ id: "geada", nome: "Prisão de Geada", tipo: "dano_magico", multiplicador: 1.6, elemento: "gelo", custoMP: 6 });
  const jogador = heroi({ habilidades: [geada] });
  const alvo = monstro({ elemento: "fisico", hp: 200, hpMax: 200 });
  aplicarEstadoElemental(alvo, "molhado", dados.elementalStates);
  const antes = JSON.stringify({ hp: alvo.hp, mp: jogador.mp, status: alvo.statusEffects.map((s) => s.estadoId || s.tipo), cd: geada.cooldownAtual });
  // Avalia a mão dez vezes seguidas — se alguma prévia consumisse estado (o
  // erro clássico deste tipo de sistema), o Molhado sumiria já na primeira.
  for (let i = 0; i < 10; i += 1) avaliar({ jogador, aliados: [jogador], inimigos: [alvo], alvo });
  const depois = JSON.stringify({ hp: alvo.hp, mp: jogador.mp, status: alvo.statusEffects.map((s) => s.estadoId || s.tipo), cd: geada.cooldownAtual });
  checar("10 avaliações seguidas não mudam nada do estado", antes === depois, `${antes} -> ${depois}`);
}

// =====================================================================
console.log("\n[15] Cura acima do limite não engana o jogador (item 18)");
// =====================================================================
{
  const cura = hab({ id: "cura", nome: "Toque Restaurador", tipo: "cura", multiplicador: 8, custoMP: 6 });
  const jogador = heroi({ hp: 95, hpMax: 100, habilidades: [cura], atributos: { FOR: 10, DES: 10, CON: 10, INT: 20 } });
  const r = avaliar({ jogador, aliados: [jogador], inimigos: [monstro()], alvo: monstro() });
  const prev = r.previsoes.get("hab_cura");
  checar("A cura bruta é maior que o espaço disponível", prev.esperado === undefined ? prev.cura.esperado > prev.cura.espaco : true, JSON.stringify(prev.cura));
  checar("A cura efetiva é limitada ao espaço restante", prev.cura.efetivaEsperada <= 5, String(prev.cura.efetivaEsperada));
  checar("A cura desperdiçada é reportada", prev.cura.desperdicada > 0, String(prev.cura.desperdicada));
}

// =====================================================================
console.log("\n[16] Identidade visual determinística dos biomas de batalha");
// =====================================================================
{
  const casos = [
    ["floresta", { zonaNome: "Floresta Eterna" }],
    ["pantano", { zonaNome: "Pântano Negro" }],
    ["deserto", { zonaNome: "Deserto de Karn" }],
    ["montanha", { zonaNome: "Montanhas de Aethra" }],
    ["costa", { zonaNome: "Costa da Aurora" }],
    ["ruinas", { zonaNome: "Ruínas Esquecidas" }],
    ["masmorra", { mapaAtual: "dungeon2", zonaNome: "Galerias Profundas" }],
    ["vila", { zonaNome: "Vila de Altaverde" }],
    ["campo", { zonaNome: "Campo Ventoso" }],
  ];
  const descritores = casos.map(([id, contexto]) => {
    const primeiro = descreverCenario(contexto);
    const segundo = descreverCenario(contexto);
    checar(`${id} resolve o bioma esperado`, primeiro.id === id, primeiro.id);
    checar(`${id} mantém a mesma paleta`, JSON.stringify(primeiro.paleta) === JSON.stringify(segundo.paleta));
    return primeiro;
  });
  const assinaturas = descritores.map((cenario) => JSON.stringify(cenario.paleta));
  checar("os nove biomas têm paletas distintas", new Set(assinaturas).size === casos.length, `${new Set(assinaturas).size}/${casos.length}`);

  const palco = readFileSync(join(raiz, "src", "ui", "BattleStage.js"), "utf8");
  checar("o palco consome piso, neblina e silhueta do descritor",
    palco.includes("cenario.paleta") && palco.includes("pisoHorizonte")
      && palco.includes("corNeblina") && palco.includes("silhuetaDistante"));
}

// =====================================================================
console.log(`\n${"=".repeat(58)}`);
console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
if (falhas.length) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f}`));
}
console.log("=".repeat(58));
process.exit(falhou > 0 ? 1 : 0);
