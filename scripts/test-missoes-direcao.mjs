import fs from "node:fs";
import assert from "node:assert/strict";
import { iniciarMissao, concluirMissao, missaoRastreada, rastrearMissao, progressoDaMissao, textoObjetivoMissao } from "../src/systems/QuestSystem.js";
import { cenaDaMissao } from "../src/systems/CutsceneSystem.js";

const quests = JSON.parse(fs.readFileSync(new URL("../src/data/quests.json", import.meta.url), "utf8"));

// TUTORIAL NÃO É CAPÍTULO, E ERA POR ISSO QUE ESTE TESTE ESTAVA VERMELHO.
//
// `tutorial_companhia` tem `vertente: "principal"`, então caía no contrato
// abaixo — e falhava, porque não tem `importante` nem `mapaAlvo`. Não tem
// mesmo: ela se cumpre invocando aliados, montando o time e lutando, tudo na
// interface. Não existe lugar no mapa para onde mandar o jogador.
//
// Marcá-la como capítulo para o teste passar seria inverter a correção: foi
// exatamente esse "destino que não leva a lugar nenhum" que travou o modo
// automático por 60 segundos na vila, orbitando três casas (ver a guarda
// `def?.tipo === "tutorial"` em alvoDeUmaMissaoAutomatica).
//
// Então o contrato passa a dizer o que sempre quis dizer: CAPÍTULO é missão
// principal que acontece NO MUNDO. A orientação segue sendo principal na
// narrativa, e é verificada pela regra própria dela, logo abaixo.
const principais = quests.filter((q) => q.vertente === "principal");
const capitulos = principais.filter((q) => q.tipo !== "tutorial");
assert.ok(capitulos.length >= 3, "há uma sequência principal rastreável");
assert.ok(capitulos.every((q) => q.importante && q.mapaAlvo && q.objetivoTexto), "capítulos principais declaram cena, destino e objetivo");

// A regra própria da orientação: ela não pode declarar destino, justamente
// para não voltar a ser alvo de navegação.
for (const t of principais.filter((q) => q.tipo === "tutorial")) {
  assert.ok(!t.mapaAlvo, `${t.id}: missão de tutorial não declara mapaAlvo`);
  assert.ok(t.objetivoTexto, `${t.id}: mas diz ao jogador o que fazer`);
}

const personagem = { missoesAtivas: [], missoesConcluidas: [], inventario: [], ouro: 0 };
assert.equal(iniciarMissao(personagem, capitulos[0]), true);
assert.equal(personagem.missaoRastreadaId, capitulos[0].id, "principal aceita entra em foco");
assert.equal(missaoRastreada(personagem, quests).def.id, capitulos[0].id);
assert.ok(textoObjetivoMissao(capitulos[0]).length > 20);
assert.ok(cenaDaMissao(capitulos[0], "aceita")?.paineis?.length, "aceite importante gera cutscene");
assert.ok(cenaDaMissao(capitulos[0], "concluida")?.paineis?.length, "desfecho importante gera cutscene");

const secundaria = quests.find((q) => q.tipo === "coletar");
iniciarMissao(personagem, secundaria);
personagem.inventario.push({ id: secundaria.itemAlvo });
assert.equal(progressoDaMissao(personagem, secundaria).atual, 1, "coleta lê inventário real");
assert.equal(rastrearMissao(personagem, secundaria.id), true);
assert.equal(personagem.missaoRastreadaId, secundaria.id, "rastreamento pode ser trocado");
assert.equal(rastrearMissao(personagem, secundaria.id), true);
assert.equal(personagem.missaoRastreadaId, null, "mesmo botão desliga o rastro");
assert.equal(missaoRastreada(personagem, quests), null, "rastro pausado não reaparece sozinho ao redesenhar a interface");

personagem.missoesAtivas.find((m) => m.id === capitulos[0].id).progresso = capitulos[0].quantidade || 1;
concluirMissao(personagem, capitulos[0], []);
assert.notEqual(personagem.missaoRastreadaId, capitulos[0].id, "concluir limpa foco antigo");

const renderer = fs.readFileSync(new URL("../src/render/Renderer.js", import.meta.url), "utf8");
const minimapa = fs.readFileSync(new URL("../src/ui/MinimapaUI.js", import.meta.url), "utf8");
const mapa = fs.readFileSync(new URL("../src/ui/MapaMundoUI.js", import.meta.url), "utf8");
const cursor = fs.readFileSync(new URL("../src/ui/CursorTeclado.js", import.meta.url), "utf8");
const principal = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const gameUi = fs.readFileSync(new URL("../src/ui/GameUI.js", import.meta.url), "utf8");
const estilo = fs.readFileSync(new URL("../src/missoes-direcao.css", import.meta.url), "utf8");
assert.match(renderer, /desenharRastroMissao/);
assert.match(renderer, /if \(!alvoVisivel\)/, "destino visível não duplica seta e selo");
assert.match(minimapa, /objetivoMissao/);
assert.match(mapa, /mapa-missao-atalho/);
assert.match(cursor, /\.hda-sheet/);
assert.match(cursor, /#screen-criacao/);
assert.match(cursor, /vizinhoEspacial/);
assert.match(cursor, /navDown/);
assert.match(principal, /configurarNavegacaoBoot/);
assert.match(gameUi, /aria-controls="missoes-grupo-ativas"/);
assert.match(gameUi, /ArrowLeft/);
assert.match(gameUi, /missao-parar-rastro/);
assert.match(gameUi, /Próximo capítulo ainda bloqueado/);
assert.match(estilo, /missao-meta/);
assert.match(estilo, /orientation:landscape/);

console.log(`✓ ${capitulos.length} capítulos principais com cenas e destino (+${principais.length - capitulos.length} de orientação, sem destino de propósito)`);
console.log("✓ rastreamento, progresso real, mundo, minimapa, mapa e teclado conectados");
