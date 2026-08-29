// Regressão para os eventos aleatórios de exploração (melhoria pós-backlog,
// ver ExplorationEventSystem.js/ExplorationEventUI.js/main.js:
// verificarEncontroAleatorio). Pequenos encontros NÃO-combate ao caminhar
// pelo mundo — viajante perdido, santuário, ruína, sinal de perigo, achado —
// alguns via escolha simples (explorationEvents.json), outros via teste de
// perícia d20 (skillChecks.json, contexto "exploracao", ver
// SkillCheckSystem.js).
import {
  deveDispararEventoExploracao, sortearEventoExploracao, opcaoDisponivel,
  aplicarEscolhaEvento, aplicarAchadoEvento, aplicarResultadoTesteExploracao,
} from "../src/systems/ExplorationEventSystem.js";
import { realizarTeste } from "../src/systems/SkillCheckSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosEventos = JSON.parse(fs.readFileSync(new URL("../src/data/explorationEvents.json", import.meta.url)));
const dadosSkillChecks = JSON.parse(fs.readFileSync(new URL("../src/data/skillChecks.json", import.meta.url)));

function fakePersonagem(overrides = {}) {
  return {
    nome: "Herói", ouro: 50, nivel: 1,
    atributos: { FOR: 10, DES: 10, CON: 10, INT: 10 },
    antecedenteId: "soldado",
    equipamento: {},
    ...overrides,
  };
}

const worldStateVars = { facoes: [{ id: "vila", nome: "Vila" }], tiers: [{ min: -999, max: 999, nome: "Neutro" }] };

// --- deveDispararEventoExploracao: taxa estatística perto do esperado ---
{
  const N = 20000;
  const chance = 0.02;
  let disparos = 0;
  for (let i = 0; i < N; i++) if (deveDispararEventoExploracao(chance)) disparos++;
  const taxa = disparos / N;
  check(`deveDispararEventoExploracao(0.02) dispara perto de 2% das vezes (achou ${(taxa * 100).toFixed(2)}%)`, taxa > 0.015 && taxa < 0.025);
  check("deveDispararEventoExploracao(0) nunca dispara", !deveDispararEventoExploracao(0));
  check("deveDispararEventoExploracao(1) sempre dispara", deveDispararEventoExploracao(1));
}

// --- explorationEvents.json: schema básico de cada template ---
{
  check("explorationEvents.json tem pelo menos 3 templates", dadosEventos.length >= 3);
  dadosEventos.forEach((e) => {
    check(`${e.id} tem tipo válido (escolha|achado)`, e.tipo === "escolha" || e.tipo === "achado");
    check(`${e.id} tem título e texto`, !!e.titulo && !!e.texto);
    if (e.tipo === "escolha") check(`${e.id} tem pelo menos 2 opções`, (e.opcoes || []).length >= 2);
    if (e.tipo === "achado") check(`${e.id} tem textoResultado`, !!e.textoResultado);
  });
}

// --- skillChecks.json: entradas de contexto "exploracao" existem e têm o campo certo ---
{
  const testesExploracao = dadosSkillChecks.filter((sc) => sc.contexto === "exploracao");
  check("existem testes de perícia de contexto 'exploracao'", testesExploracao.length >= 2);
  testesExploracao.forEach((t) => {
    check(`${t.id} tem pericia/atributo/dificuldade`, !!t.pericia && !!t.atributo && typeof t.dificuldade === "number");
    check(`${t.id} não é 'unicoPorPersonagem' (evento repetível ao explorar)`, !t.unicoPorPersonagem);
  });
}

// --- sortearEventoExploracao: sempre devolve um evento do pool combinado, com tipo resolvido ---
{
  for (let i = 0; i < 50; i++) {
    const evento = sortearEventoExploracao(dadosEventos, dadosSkillChecks);
    check("sortearEventoExploracao devolve um evento com tipo válido", ["escolha", "achado", "teste_pericia"].includes(evento.tipo));
  }
  check("sortearEventoExploracao com pools vazios devolve null", sortearEventoExploracao([], []) === null);
}

// --- aplicarAchadoEvento: soma ouro e devolve o texto ---
{
  const p = fakePersonagem({ ouro: 20 });
  const evento = dadosEventos.find((e) => e.tipo === "achado");
  const r = aplicarAchadoEvento(p, evento);
  check("aplicarAchadoEvento soma o ouro do evento", p.ouro === 20 + evento.ouro);
  check("aplicarAchadoEvento devolve o texto de resultado", r.texto === evento.textoResultado);
}

// --- aplicarEscolhaEvento: opção simples de ouro/reputação ---
{
  const evento = dadosEventos.find((e) => e.id === "viajante_perdido");
  const opcaoAjudar = evento.opcoes.find((o) => o.id === "ajudar");
  const p = fakePersonagem({ ouro: 10 });
  const r = aplicarEscolhaEvento(p, evento, "ajudar", worldStateVars, "vila");
  check("aplicarEscolhaEvento (ajudar) retorna ok:true", r.ok === true);
  check("aplicarEscolhaEvento soma o ouro da opção", p.ouro === 10 + opcaoAjudar.ouro);
  check("aplicarEscolhaEvento devolve o texto de resultado da opção", r.texto === opcaoAjudar.textoResultado);

  const pIgnorar = fakePersonagem({ ouro: 10 });
  const rIgnorar = aplicarEscolhaEvento(pIgnorar, evento, "ignorar", worldStateVars, "vila");
  check("ignorar não muda o ouro", pIgnorar.ouro === 10);

  const rInvalida = aplicarEscolhaEvento(fakePersonagem(), evento, "opcao_inexistente", worldStateVars, "vila");
  check("opção inexistente retorna ok:false e não muda nada", rInvalida.ok === false);
}

// --- aplicarEscolhaEvento: custo mínimo de ouro bloqueia a opção sem fundos ---
{
  const evento = dadosEventos.find((e) => e.id === "santuario_esquecido");
  const opcaoDoar = evento.opcoes.find((o) => o.id === "doar");
  const pSemOuro = fakePersonagem({ ouro: 2 });
  check("opcaoDisponivel: false quando ouro é menor que o custo mínimo", opcaoDisponivel(opcaoDoar, pSemOuro) === false);
  const r = aplicarEscolhaEvento(pSemOuro, evento, "doar", worldStateVars, "vila");
  check("aplicarEscolhaEvento recusa a opção sem ouro suficiente (ok:false)", r.ok === false);
  check("ouro não muda quando a opção é recusada por falta de fundos", pSemOuro.ouro === 2);

  const pComOuro = fakePersonagem({ ouro: 50 });
  check("opcaoDisponivel: true quando o ouro alcança o custo mínimo", opcaoDisponivel(opcaoDoar, pComOuro) === true);
  const rOk = aplicarEscolhaEvento(pComOuro, evento, "doar", worldStateVars, "vila");
  check("doar com ouro suficiente funciona (ok:true)", rOk.ok === true);
  check("ouro nunca fica negativo mesmo com custo maior que o saldo", pComOuro.ouro >= 0);
}

// --- aplicarEscolhaEvento: opção "sorte" resolve sucesso/falha sem d20 de perícia ---
{
  const evento = dadosEventos.find((e) => e.id === "pegadas_estranhas");
  const opcaoInvestigar = evento.opcoes.find((o) => o.id === "investigar");
  let sucessos = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const p = fakePersonagem({ ouro: 100 });
    const r = aplicarEscolhaEvento(p, evento, "investigar", worldStateVars, "vila");
    if (r.sucesso) {
      sucessos++;
      if (p.ouro !== 100 + opcaoInvestigar.ouroSucesso) throw new Error("ouro de sucesso incorreto");
    } else {
      if (p.ouro !== Math.max(0, 100 + opcaoInvestigar.ouroFalha)) throw new Error("ouro de falha incorreto");
    }
  }
  const taxa = sucessos / N;
  check(`opção 'sorte' respeita a chanceSucesso configurada (achou ${(taxa * 100).toFixed(1)}%, esperado ~${(opcaoInvestigar.chanceSucesso * 100).toFixed(0)}%)`, Math.abs(taxa - opcaoInvestigar.chanceSucesso) < 0.05);
}

// --- aplicarResultadoTesteExploracao: reaproveita realizarTeste do SkillCheckSystem ---
{
  const teste = dadosSkillChecks.find((sc) => sc.contexto === "exploracao");
  const dadosFake = {};
  let sucessos = 0, falhas = 0;
  for (let i = 0; i < 30; i++) {
    const p = fakePersonagem({ ouro: 0, nivel: 20 }); // nível alto = bônus de proficiência maior, mais chance de ver sucesso E falha nas tentativas
    const resultado = realizarTeste(p, dadosFake, teste);
    const r = aplicarResultadoTesteExploracao(p, teste, resultado);
    if (resultado.sucesso) {
      sucessos++;
      check("sucesso no teste de exploração soma o ouro de recompensa", p.ouro === teste.recompensaOuroSucesso);
      check("texto de sucesso bate com o do teste", r.texto === teste.textoSucesso);
    } else {
      falhas++;
      check("falha no teste de exploração não muda o ouro", p.ouro === 0);
      check("texto de falha bate com o do teste", r.texto === teste.textoFalha);
    }
  }
  check("o loop de teste gerou pelo menos um resultado (sucesso ou falha)", sucessos + falhas === 30);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== test_exploration_events.mjs passou ===");
