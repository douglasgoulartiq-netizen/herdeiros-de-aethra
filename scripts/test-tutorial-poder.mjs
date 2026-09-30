import fs from "node:fs";
import assert from "node:assert/strict";
import { TUTORIAL_ETAPAS, duracaoTotalTutorial, garantirEstadoTutorial, encerrarTutorial } from "../src/systems/TutorialSystem.js";
import { criarPersonagem } from "../src/systems/CharacterFactory.js";
import { estadoGachaInicial } from "../src/systems/GachaSystem.js";
import { avaliarTime, melhorRecomendacaoTime, simularEntradaNoTime, poderDoMembro, PODER_MAXIMO_PERSONAGEM } from "../src/systems/CombatPowerSystem.js";

const ler = (nome) => JSON.parse(fs.readFileSync(new URL(`../src/data/${nome}.json`, import.meta.url), "utf8"));
const dados = {
  races: ler("races"), classes: ler("classes"), backgrounds: ler("backgrounds"), traits: ler("traits"),
  items: ler("items"), skillTrees: ler("skillTrees"), affinities: ler("affinities"),
  worldStateVariables: ler("worldStateVariables"), elements: ler("elements"),
  heritageTree: ler("heritageTree"),
};

assert.equal(TUTORIAL_ETAPAS.length, 10, "tutorial tem dez blocos curtos");
assert.equal(duracaoTotalTutorial(), 600, "conteúdo cabe em dez minutos estimados");
assert.ok(TUTORIAL_ETAPAS.some((e) => e.demo === "invocacao"));
assert.ok(TUTORIAL_ETAPAS.filter((e) => ["combate", "d20", "taticas"].includes(e.demo)).length === 3, "batalha é pausada em três decisões");

const personagem = criarPersonagem({ nome: "Teste", raca: dados.races[0].id, classe: dados.classes[0].id, antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
personagem.gacha = estadoGachaInicial();
const fabricar = (uid, nome, classeId, facaoId, bonus) => ({
  ...personagem, uid, nome, classeId, facaoId, rosterId: uid, nivel: 4 + bonus,
  atributos: { FOR: 10 + bonus, DES: 9 + bonus, CON: 10 + bonus, INT: 8 + bonus },
  hpMax: 80 + bonus * 7, hp: 80 + bonus * 7, mpMax: 35 + bonus * 4, mp: 35 + bonus * 4,
  elementoId: ["fogo", "agua", "terra"][bonus % 3], equipamento: { ...personagem.equipamento },
});
const fraco = fabricar("fraco", "Escudeiro", "guerreiro", "vila", 0);
const fortes = [
  fabricar("forte1", "Lâmina", "ladino", "aurora", 6),
  fabricar("forte2", "Oráculo", "mago", "aurora", 7),
  fabricar("forte3", "Guardião", "clerigo", "aurora", 8),
];
personagem.gacha.personagensObtidos = [fraco, ...fortes];
personagem.gacha.timeAtivo = [fraco.uid];

const atual = avaliarTime(personagem, dados);
assert.ok(atual.total > 0 && atual.base > 0, "PC atual é numérico e explicável");
const previa = simularEntradaNoTime(personagem, dados, fortes[2].uid);
assert.ok(previa.sugerido.total > atual.total, "prévia mostra melhora antes da troca");
const recomendacao = melhorRecomendacaoTime(personagem, dados);
assert.ok(recomendacao && recomendacao.ganho > 0 && recomendacao.uids.length <= 3, "recomendação encontra time mais forte sem ultrapassar vagas");
assert.ok([personagem, ...personagem.gacha.personagensObtidos].every((m) => poderDoMembro(m, dados) <= PODER_MAXIMO_PERSONAGEM), "nenhum personagem passa de 250 PC");

assert.equal(garantirEstadoTutorial(personagem).status, "nao_iniciado");
encerrarTutorial(personagem, "pulado");
assert.equal(personagem.tutorialInicial.status, "pulado", "pular fica salvo");

// O TUTORIAL FOI REESCRITO; ESTE BLOCO ESTAVA CHECANDO O QUE NAO EXISTE MAIS.
//
// Ate aqui o teste passava. Ele quebrava na linha abaixo, lendo
// src/ui/TutorialUI.js e procurando "Pular tutorial". Acontece que
// TutorialUI.js virou um reexport de tres linhas:
//
//   // Compatibility entry point: onboarding now runs in the actual world.
//   export { abrirTutorialInicial, tutorialAberto, ... } from './LiveTutorialUI.js';
//
// A orientação deixou de ser um modal de dez etapas com demonstração e
// passou a ser um CARTÃO vivo, no canto da tela, enquanto o jogador joga o
// mundo de verdade. Nenhuma das frases procuradas ("Retomar etapa", "BATALHA
// PAUSADA", "PODER DE COMBATE") sobreviveu, porque as telas que as exibiam
// não existem mais.
//
// Ou seja: o teste estava vermelho por estar desatualizado, não por defeito.
// Mas apagá-lo perderia a proteção real que ele dava — a de que existe uma
// saída para quem não quer tutorial. Então ele passa a afirmar o contrato de
// HOJE, lendo o módulo que de fato desenha a orientação.
const ui = fs.readFileSync(new URL("../src/ui/LiveTutorialUI.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/tutorial.css", import.meta.url), "utf8");
const gameUi = fs.readFileSync(new URL("../src/ui/GameUI.js", import.meta.url), "utf8");

// SAÍDA: é o que mais importa. Sem isso, quem não quer orientação fica preso
// nela — e foi exatamente esse o defeito que levou o modo automático a não
// fazer nada numa partida nova.
assert.match(ui, /Pular orienta/, "a orientação precisa ter como ser pulada");
// IDENTIDADE: o cartão diz de que missão está falando.
assert.match(ui, /Primeira missão/, "o cartão nomeia a missão que está guiando");
// AÇÃO: o mesmo botão avança a etapa e fecha a missão no fim.
assert.match(ui, /Iniciar patrulha/, "o cartão tem o botão que faz a etapa avançar");
assert.match(ui, /Concluir primeira missão/, "e o botão que fecha a missão");
// LEITOR DE TELA: o texto muda sozinho conforme o jogador age; sem aria-live
// a mudança acontece em silêncio para quem não enxerga a tela.
assert.match(ui, /aria-live/, "o texto que muda sozinho é anunciado");
assert.match(ui, /aria-label/, "o cartão se identifica para leitor de tela");

// CELULAR: o cartão é fixo na tela. Sem largura limitada ao viewport ele
// transborda no aparelho estreito, e sem o estado recolhido ele cobre o
// mundo justamente na hora em que o jogador precisa ver onde está.
assert.match(css, /\.missao-guia\b/, "o cartão tem folha de estilo própria");
assert.match(css, /calc\(100vw - 24px\)/, "o cartão cabe na largura do celular");
assert.match(css, /guia-recolhida/, "o cartão pode recolher para liberar o mundo");

assert.match(gameUi, /tem-recomendacao-time/);

console.log("✓ tutorial opcional cobre 10 minutos, invocação, batalha pausada e recompensa");
console.log(`✓ Poder de Combate: ${atual.total} PC → ${recomendacao.sugerido.total} PC (+${recomendacao.ganhoPct}%)`);
