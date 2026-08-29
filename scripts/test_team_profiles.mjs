// Regressão para perfis de time salvos (melhoria de jogabilidade pós-
// backlog original, ver TeamProfileSystem.js) — até 3 configurações
// nomeadas de time + formação, salvas/carregadas sob demanda.
import {
  MAX_PERFIS_DE_TIME, garantirPerfisDeTime, salvarPerfilDeTime, carregarPerfilDeTime, apagarPerfilDeTime, perfisParaExibir,
} from "../src/systems/TeamProfileSystem.js";
import { definirPosicao } from "../src/systems/FormationSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function fakeConvocado(uid) {
  return { uid, rosterId: uid, nome: uid, classeId: "guerreiro", nivel: 1 };
}
function fakePersonagem() {
  return {
    nome: "Herói",
    gacha: { timeAtivo: [], personagensObtidos: [fakeConvocado("a"), fakeConvocado("b"), fakeConvocado("c"), fakeConvocado("d")] },
    formacao: {},
  };
}

// --- garantirPerfisDeTime / perfisParaExibir: sempre 3 slots, vazios de início ---
{
  const p = fakePersonagem();
  check(`MAX_PERFIS_DE_TIME é 3`, MAX_PERFIS_DE_TIME === 3);
  const perfis = perfisParaExibir(p);
  check("perfisParaExibir sempre retorna um array de tamanho fixo (3)", perfis.length === 3);
  check("todos os slots começam vazios (null)", perfis.every((s) => s === null));
  check("garantirPerfisDeTime inicializa personagem.perfisDeTime como array", Array.isArray(garantirPerfisDeTime(p)));
}

// --- salvarPerfilDeTime: captura o time ativo e a formação atuais ---
{
  const p = fakePersonagem();
  p.gacha.timeAtivo = ["a", "b"];
  definirPosicao(p, "a", "retaguarda", ["player", "a", "b"]);
  const r = salvarPerfilDeTime(p, 0, "Time Ofensivo");
  check("salvarPerfilDeTime retorna ok:true", r.ok === true);
  check("nome do perfil bate com o informado", r.perfil.nome === "Time Ofensivo");
  check("timeAtivo do perfil bate com o time ativo no momento de salvar", JSON.stringify(r.perfil.timeAtivo) === JSON.stringify(["a", "b"]));
  check("formação de 'a' foi capturada como retaguarda", r.perfil.formacao.a === "retaguarda");
  check("formação de 'player' também foi capturada (default frente)", r.perfil.formacao.player === "frente");
}

// --- salvarPerfilDeTime: nome vazio/omitido usa um nome padrão ---
{
  const p = fakePersonagem();
  const r1 = salvarPerfilDeTime(p, 1, "");
  check("nome vazio vira 'Perfil 2' (slot 1 = 2º perfil)", r1.perfil.nome === "Perfil 2");
  const r2 = salvarPerfilDeTime(p, 2, "   ");
  check("nome só com espaços também cai no padrão", r2.perfil.nome === "Perfil 3");
  const r3 = salvarPerfilDeTime(p, 0, "  Nome com espaços nas pontas  ");
  check("nome válido é aparado (trim)", r3.perfil.nome === "Nome com espaços nas pontas");
}

// --- salvarPerfilDeTime: slot inválido falha sem quebrar ---
{
  const p = fakePersonagem();
  check("slot negativo falha", salvarPerfilDeTime(p, -1, "x").ok === false);
  check("slot >= MAX_PERFIS_DE_TIME falha", salvarPerfilDeTime(p, 3, "x").ok === false);
  check("slot não-inteiro falha", salvarPerfilDeTime(p, 1.5, "x").ok === false);
}

// --- carregarPerfilDeTime: restaura time e formação salvos ---
{
  const p = fakePersonagem();
  p.gacha.timeAtivo = ["a", "b"];
  definirPosicao(p, "b", "retaguarda", ["player", "a", "b"]);
  salvarPerfilDeTime(p, 0, "Perfil A");

  // Muda o time ativo pra outra coisa antes de carregar de volta.
  p.gacha.timeAtivo = ["c", "d"];
  p.formacao = {};

  const r = carregarPerfilDeTime(p, 0);
  check("carregarPerfilDeTime retorna ok:true", r.ok === true);
  check("timeAtivo foi restaurado pro que estava salvo", JSON.stringify(p.gacha.timeAtivo) === JSON.stringify(["a", "b"]));
  check("formação de 'b' foi restaurada (retaguarda)", p.formacao.b === "retaguarda");
}

// --- carregarPerfilDeTime: slot vazio ou inválido falha sem alterar nada ---
{
  const p = fakePersonagem();
  p.gacha.timeAtivo = ["a"];
  check("carregar slot vazio (nunca salvo) falha", carregarPerfilDeTime(p, 1).ok === false);
  check("time ativo não muda quando o carregamento falha", JSON.stringify(p.gacha.timeAtivo) === JSON.stringify(["a"]));
  check("carregar slot fora do intervalo falha", carregarPerfilDeTime(p, 99).ok === false);
}

// --- carregarPerfilDeTime: uid que não existe mais é filtrado (nunca quebra) ---
{
  const p = fakePersonagem();
  p.gacha.timeAtivo = ["a", "b"];
  salvarPerfilDeTime(p, 0, "Perfil com b");
  // "b" deixou de existir no roster (hipotético) — definirTimeAtivo já filtra.
  p.gacha.personagensObtidos = p.gacha.personagensObtidos.filter((c) => c.uid !== "b");
  const r = carregarPerfilDeTime(p, 0);
  check("carregar um perfil com um uid que não existe mais não quebra (ok:true)", r.ok === true);
  check("uid inexistente é filtrado do time restaurado", !p.gacha.timeAtivo.includes("b") && p.gacha.timeAtivo.includes("a"));
}

// --- apagarPerfilDeTime ---
{
  const p = fakePersonagem();
  salvarPerfilDeTime(p, 0, "Pra apagar");
  check("perfil existe antes de apagar", perfisParaExibir(p)[0] !== null);
  const r = apagarPerfilDeTime(p, 0);
  check("apagarPerfilDeTime retorna ok:true", r.ok === true);
  check("slot fica vazio (null) depois de apagar", perfisParaExibir(p)[0] === null);
  check("apagar um slot já vazio falha (ok:false), não quebra", apagarPerfilDeTime(p, 0).ok === false);
  check("apagar slot inválido falha", apagarPerfilDeTime(p, -1).ok === false);
}

// --- Os 3 slots são independentes entre si ---
{
  const p = fakePersonagem();
  p.gacha.timeAtivo = ["a"];
  salvarPerfilDeTime(p, 0, "Slot 0");
  p.gacha.timeAtivo = ["b", "c"];
  salvarPerfilDeTime(p, 1, "Slot 1");
  p.gacha.timeAtivo = ["d"];
  salvarPerfilDeTime(p, 2, "Slot 2");
  const perfis = perfisParaExibir(p);
  check("os 3 slots guardam times diferentes de forma independente", JSON.stringify(perfis[0].timeAtivo) === JSON.stringify(["a"]) && JSON.stringify(perfis[1].timeAtivo) === JSON.stringify(["b", "c"]) && JSON.stringify(perfis[2].timeAtivo) === JSON.stringify(["d"]));
  apagarPerfilDeTime(p, 1);
  check("apagar o slot 1 não afeta os slots 0 e 2", perfisParaExibir(p)[0] !== null && perfisParaExibir(p)[2] !== null && perfisParaExibir(p)[1] === null);
}

// --- Sobrescrever um slot já ocupado funciona (não precisa apagar antes) ---
{
  const p = fakePersonagem();
  p.gacha.timeAtivo = ["a"];
  salvarPerfilDeTime(p, 0, "Original");
  p.gacha.timeAtivo = ["b", "c", "d"];
  salvarPerfilDeTime(p, 0, "Sobrescrito");
  const perfil = perfisParaExibir(p)[0];
  check("sobrescrever um slot troca nome e time salvos", perfil.nome === "Sobrescrito" && JSON.stringify(perfil.timeAtivo) === JSON.stringify(["b", "c", "d"]));
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
