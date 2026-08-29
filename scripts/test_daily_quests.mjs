// Regressão para as missões diárias leves (melhoria de jogabilidade
// pós-backlog original, ver DailyQuestSystem.js). Cobre geração/reset por
// dia, progresso por tipo de ação, conclusão e resgate único de recompensa.
import {
  TEMPLATES_DIARIOS, garantirMissoesDiarias, registrarProgressoDiario,
  missoesDiariasParaExibir, coletarRecompensaDiaria,
} from "../src/systems/DailyQuestSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function personagemFake(overrides = {}) {
  return { ouro: 100, ...overrides };
}

// --- existem exatamente os 3 templates leves esperados, um por tipo ---
{
  check("existem 3 templates de missão diária", TEMPLATES_DIARIOS.length === 3);
  const tipos = new Set(TEMPLATES_DIARIOS.map((t) => t.tipo));
  check("cada template cobre um tipo distinto (abate/coleta/vitoria)", tipos.size === 3 && tipos.has("abate") && tipos.has("coleta") && tipos.has("vitoria"));
  TEMPLATES_DIARIOS.forEach((t) => {
    check(`template "${t.id}" tem meta/recompensa bem definidas`, t.meta > 0 && t.recompensaOuro > 0 && t.recompensaFragmentos > 0);
  });
}

// --- garantirMissoesDiarias: gera progresso zerado na primeira vez, é idempotente no mesmo dia ---
{
  const p = personagemFake();
  const g1 = garantirMissoesDiarias(p);
  check("gera missoesDiarias.dia", typeof g1.dia === "string" && g1.dia.length === 10);
  check("progresso começa zerado pros 3 templates", g1.progresso.length === 3 && g1.progresso.every((x) => x.atual === 0 && !x.concluida && !x.coletada));
  const g2 = garantirMissoesDiarias(p);
  check("chamar de novo no mesmo dia não recria o objeto (mesma referência)", g1 === g2);
}

// --- garantirMissoesDiarias: dia diferente reseta o progresso ---
{
  const p = personagemFake();
  garantirMissoesDiarias(p);
  registrarProgressoDiario(p, "abate", 3);
  p.missoesDiarias.dia = "2000-01-01"; // simula um dia antigo, sem mexer no relógio do sistema
  const novo = garantirMissoesDiarias(p);
  check("dia diferente do salvo reseta o progresso pra zero", novo.progresso.every((x) => x.atual === 0 && !x.concluida));
  check("dia diferente do salvo atualiza pro dia atual", novo.dia !== "2000-01-01");
}

// --- registrarProgressoDiario: incrementa só o template do tipo certo, sem passar da meta ---
{
  const p = personagemFake();
  registrarProgressoDiario(p, "abate", 1);
  const abate = missoesDiariasParaExibir(p).find((m) => m.template.id === "diaria_cacada");
  const coleta = missoesDiariasParaExibir(p).find((m) => m.template.id === "diaria_coleta");
  check("abate incrementa só a missão de abate", abate.atual === 1);
  check("abate não afeta a missão de coleta", coleta.atual === 0);

  registrarProgressoDiario(p, "abate", 999); // muito além da meta
  const abateDepois = missoesDiariasParaExibir(p).find((m) => m.template.id === "diaria_cacada");
  check("progresso nunca passa da meta do template", abateDepois.atual === abateDepois.template.meta);
  check("bate a meta marca concluida", abateDepois.concluida === true);
}

// --- registrarProgressoDiario não incrementa mais depois de concluída (evita virar negativo/lixo) ---
{
  const p = personagemFake();
  const t = TEMPLATES_DIARIOS.find((x) => x.tipo === "vitoria");
  registrarProgressoDiario(p, "vitoria", t.meta); // completa de primeira
  const antes = missoesDiariasParaExibir(p).find((m) => m.template.id === t.id).atual;
  registrarProgressoDiario(p, "vitoria", 5);
  const depois = missoesDiariasParaExibir(p).find((m) => m.template.id === t.id).atual;
  check("registrar progresso numa missão já concluída não muda mais nada", antes === depois);
}

// --- coletarRecompensaDiaria: só funciona quando concluída, dá ouro na hora e fragmentos no retorno ---
{
  const p = personagemFake({ ouro: 50 });
  const t = TEMPLATES_DIARIOS.find((x) => x.tipo === "coleta");
  const cedoDemais = coletarRecompensaDiaria(p, t.id);
  check("resgatar antes de concluir falha", cedoDemais.ok === false);
  check("ouro não muda quando o resgate falha", p.ouro === 50);

  registrarProgressoDiario(p, "coleta", t.meta);
  const ouroAntes = p.ouro;
  const res = coletarRecompensaDiaria(p, t.id);
  check("resgatar depois de concluir funciona", res.ok === true);
  check("ouro é aplicado direto ao personagem", p.ouro === ouroAntes + t.recompensaOuro);
  check("fragmentos vêm no retorno pro chamador aplicar (mesmo padrão de QuestSystem)", res.fragmentos === t.recompensaFragmentos);

  const segundoResgate = coletarRecompensaDiaria(p, t.id);
  check("resgatar duas vezes no mesmo dia falha na segunda", segundoResgate.ok === false);
  check("ouro não muda no segundo resgate rejeitado", p.ouro === ouroAntes + t.recompensaOuro);
}

// --- coletarRecompensaDiaria com id desconhecido não quebra ---
{
  const p = personagemFake();
  const res = coletarRecompensaDiaria(p, "id_que_nao_existe");
  check("id de template desconhecido retorna ok:false sem lançar erro", res.ok === false);
}

// --- missoesDiariasParaExibir: sempre retorna os 3, na mesma ordem de TEMPLATES_DIARIOS ---
{
  const p = personagemFake();
  const lista = missoesDiariasParaExibir(p);
  check("lista pra UI tem os 3 templates", lista.length === 3);
  check("ordem bate com TEMPLATES_DIARIOS", lista.every((m, i) => m.template.id === TEMPLATES_DIARIOS[i].id));
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
