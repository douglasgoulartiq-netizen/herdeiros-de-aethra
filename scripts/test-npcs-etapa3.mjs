// Verificações da ETAPA 3 — NPCs, ecologia, quests, facções e mundo vivo.
// Itens 37, 38, 39, 40 e 41 do pedido.
//
// Rode com: npm run test:etapa3
import { NPCS_REGIONAIS, NPCS_POR_REGIAO, CAMPOS_DA_FICHA, NPCS_SECRETOS, NPCS_DO_GACHA, NPCS_RECORRENTES, NPCS_MESTRES } from "../src/data/world/npcs/index.js";
import { ZONAS_MUNDO } from "../src/data/world/zones.js";
import { ASSENTAMENTOS, POIS, LANDMARKS, MASMORRAS_MUNDO } from "../src/data/world/settlements.js";
import { FACCOES, DOMINIO_FACCAO, PRESENCAS_SEM_REPUTACAO, faccaoDaZonaMundo, nomePublico, presencaDaRegiao } from "../src/data/world/factions.js";
import { ECOLOGIA, habitatCombina, cadeiaAlimentar, predadoresDe, MIGRACOES, GRUPOS_DE_HABITAT } from "../src/data/world/ecology.js";
import { QUESTLINES, QUESTS_REGIONAIS, TIPOS_DE_QUEST, PASSOS_INICIAIS, questRegionalPorId } from "../src/data/world/regionalQuests.js";
import { EVENTOS_REGIONAIS, CADEIAS_DE_INTERDEPENDENCIA, eventoPorId } from "../src/data/world/regionalEvents.js";
import { TEMPLATES, TEMPLATES_IDS, ORCAMENTO_FIGURANTES, popularAssentamento, templatesPara } from "../src/data/world/npcTemplates.js";
import { MACRO_REGIOES } from "../src/data/worldHierarchy.js";
import { mundoDaSemente } from "../src/systems/WorldBuilder.js";
import { posicionarNpcs, ondeEsta } from "../src/systems/NpcPlacement.js";
import { falaAtual, localAgora, npcsVisiveisEm, estadoLogicoDaRegiao, memoriaDoNpc, registrarConversa, memoriaParaSave, carregarMemoriaDoSave, reacaoPorReputacao, requisitoAtendido } from "../src/systems/NpcSystem.js";
import { poolDaZona, perfilDoDia, descobertaAoEncontrar, sortearEspecie, tamanhoDoGrupo, ajusteDeMigracao } from "../src/systems/EcologySystem.js";
import { garantirQuestsRegionais, aceitarQuestRegional, concluirQuestRegional, falharQuestRegional, progressoDaRegiao, questsOferecidasPor, questsRegionaisParaSave, carregarQuestsRegionaisDoSave, ESTADO, investigarElric } from "../src/systems/RegionalQuestSystem.js";
import { reavaliar, efeitosNaZona, estadoDaCadeia, aplicarNoWorldState, eventosParaSave, carregarEventosDoSave } from "../src/systems/RegionalEventSystem.js";
import { migrarSave, SAVE_VERSION, WORLD_STATE_REGIONAL_PADRAO } from "../src/systems/SaveSystem.js";
import { HORAS_DIA, DURACAO_HORA_DIA_MS } from "../src/systems/WeatherSystem.js";

// O DIA VIROU UM RELÓGIO DE 24 HORAS E ESTE TESTE NÃO SOUBE.
//
// Ele amostrava os períodos por ÍNDICE: `i * DURACAO_HORA_DIA_MS` para
// i = 0, 1, 2, como se o dia tivesse três fatias iguais. Hoje
// `horaDoDiaAtual` divide um dia de 24 horas assim:
//
//   hora 6–11  -> manha        hora 12–19 -> tarde       resto -> noite
//
// Então os índices 0, 1 e 2 são uma da manhã, duas e três — TODOS noite. O
// teste chamava isso de "os três períodos" e media a mesma coisa três vezes.
//
// Isso produziu duas falhas de naturezas opostas:
//   - "a rotina move o NPC ao longo do dia" ficava VERMELHO sem defeito
//     nenhum: Elric vai mesmo ao bosque de manhã, caça à tarde e dorme na
//     vila à noite — conferido em 8h, 14h e 22h.
//   - "ninguém fica sem lugar no mapa" ficava VERDE valendo um terço: as
//     três iterações verificavam a madrugada.
//
// HORA_DO_PERIODO fixa uma hora dentro de cada faixa, então "os três
// períodos" volta a significar o que diz.
const HORA_DO_PERIODO = { manha: 8, tarde: 14, noite: 22 };
const instanteDe = (periodo) => HORA_DO_PERIODO[periodo] * DURACAO_HORA_DIA_MS;
import { getReputacao, decisoesRegistradas } from "../src/systems/WorldStateSystem.js";
import fs from "node:fs";

let ok = 0; const falhas = [];
const t = (nome, cond, extra = "") => {
  if (cond) { ok += 1; } else { falhas.push(`${nome}${extra ? ` — ${extra}` : ""}`); }
};
const secao = (s) => console.log(`\n── ${s}`);

const dadosWS = JSON.parse(fs.readFileSync(new URL("../src/data/worldStateVariables.json", import.meta.url), "utf8"));
const npcsJson = JSON.parse(fs.readFileSync(new URL("../src/data/npcs.json", import.meta.url), "utf8"));
const roster = JSON.parse(fs.readFileSync(new URL("../src/data/gachaRoster.json", import.meta.url), "utf8"));
const monstros = JSON.parse(fs.readFileSync(new URL("../src/data/monsters.json", import.meta.url), "utf8"));

const LUGARES = new Set([
  ...ASSENTAMENTOS.map((a) => a.id), ...POIS.map((p) => p.id),
  ...LANDMARKS.map((l) => l.id), ...MASMORRAS_MUNDO.map((m) => m.id),
  ...ZONAS_MUNDO.map((z) => z.id), "dungeon1", "dungeon2",
]);
const IDS = new Set(NPCS_REGIONAIS.map((n) => n.id));
const novoPersonagem = () => ({
  nome: "Teste", missoesAtivas: [], missoesConcluidas: [],
  inventario: [], compendio: { abates: {} }, biomaVisitados: ["vila"],
  estadoDoMundo: { reputacao: {}, flags: {}, decisoes: [] },
});

// ─────────────────────────────────────────────────────────────────────────
secao("1. NPCs existentes preservados (item 1)");
npcsJson.forEach((o) => {
  const n = NPCS_REGIONAIS.find((x) => x.id === o.id);
  t(`${o.id} continua existindo`, !!n);
  if (!n) return;
  t(`${o.id} manteve o nome`, n.nome === o.nome, `${n.nome} != ${o.nome}`);
  const base = (n.estados || []).find((e) => e.id === "base");
  t(`${o.id} manteve a primeira fala`, base && base.dialogo === o.dialogo);
});
t("nenhum NPC antigo foi duplicado", new Set(NPCS_REGIONAIS.map((n) => n.id)).size === NPCS_REGIONAIS.length);

secao("2. Personagens do gacha (item 2)");
NPCS_DO_GACHA.forEach((n) => {
  const c = roster.find((r) => r.id === n.gachaId);
  t(`${n.gachaId} existe no roster`, !!c);
  if (!c) return;
  t(`${n.gachaId} manteve nome`, c.nome === n.nome, `${n.nome} != ${c.nome}`);
  t(`${n.gachaId} manteve facção`, c.facaoId === n.faccaoId, `${n.faccaoId} != ${c.facaoId}`);
});
t("ao menos 8 convocados aparecem no mundo", NPCS_DO_GACHA.length >= 8, `${NPCS_DO_GACHA.length}`);
t("nenhum convocado foi usado duas vezes", new Set(NPCS_DO_GACHA.map((n) => n.gachaId)).size === NPCS_DO_GACHA.length);

secao("3. Cobertura e ficha completa (itens 3 e 5)");
t("17 regiões povoadas", Object.keys(NPCS_POR_REGIAO).length === 17);
t("~96 NPCs importantes (meta do item 3)", NPCS_REGIONAIS.length >= 96, `${NPCS_REGIONAIS.length}`);
MACRO_REGIOES.forEach((r) => {
  const l = NPCS_POR_REGIAO[r.id] || [];
  t(`${r.id} tem NPCs`, l.length >= 3, `${l.length}`);
});
NPCS_REGIONAIS.forEach((n) => {
  const falta = CAMPOS_DA_FICHA.filter((c) => !(c in n));
  t(`${n.id}: 24 campos da ficha`, falta.length === 0, falta.join(","));
  t(`${n.id}: local real`, LUGARES.has(n.local), n.local);
  ["manha", "tarde", "noite"].forEach((h) => {
    const r = n.rotina && n.rotina[h];
    t(`${n.id}: rotina ${h}`, !!(r && r.local && r.atividade && LUGARES.has(r.local)), r && r.local);
  });
  t(`${n.id}: facção válida`, n.faccaoId === null || !!FACCOES[n.faccaoId], n.faccaoId);
  t(`${n.id}: quest existe`, !n.questId || !!questRegionalPorId(n.questId) || n.questId.startsWith("q1_"), n.questId);
  (n.relacoes || []).forEach((rel) => t(`${n.id}: relação com ${rel.npcId}`, !rel.npcId || IDS.has(rel.npcId)));
  const est = n.estados || [];
  t(`${n.id}: último estado é "sempre"`, est.length > 0 && est[est.length - 1].quando.tipo === "sempre");
  t(`${n.id}: 3 âncoras de reputação`, ["heroi", "neutro", "hostil"].every((k) => n.reacaoAReputacao && n.reacaoAReputacao[k]));
});

secao("4. Item 41 — nenhum NPC de casca (nada só para fechar conta)");
NPCS_REGIONAIS.forEach((n) => {
  t(`${n.id}: segredo com substância`, (n.segredo || "").length >= 25);
  t(`${n.id}: lore com substância`, (n.lore || "").length >= 40);
  t(`${n.id}: tem ao menos uma relação`, (n.relacoes || []).length >= 1);
  t(`${n.id}: silhueta descrita`, (n.silhueta || "").length >= 25);
});

secao("5. Item 6 — silhuetas distinguíveis dentro da região");
Object.entries(NPCS_POR_REGIAO).forEach(([r, lista]) => {
  const sil = lista.map((n) => n.silhueta.toLowerCase().slice(0, 40));
  t(`${r}: silhuetas não repetidas`, new Set(sil).size === sil.length);
});

secao("6. Item 4 — sem fórmula idêntica de papéis");
Object.entries(NPCS_POR_REGIAO).forEach(([r, lista]) => {
  const papeis = new Set(lista.map((n) => n.papel));
  t(`${r}: usa 3 a 7 papéis distintos, nunca os 8`, papeis.size >= 3 && papeis.size <= 7, `${papeis.size}`);
});
const combos = {};
Object.entries(NPCS_POR_REGIAO).forEach(([r, l]) => {
  const k = [...new Set(l.map((n) => n.papel))].sort().join("|");
  (combos[k] = combos[k] || []).push(r);
});
t("nenhuma combinação de papéis vale para mais de 3 regiões",
  Object.values(combos).every((v) => v.length <= 3),
  JSON.stringify(Object.entries(combos).filter(([, v]) => v.length > 3)));

secao("7. Item 7 — nada de NPC-terminal e nada de 'mate cinco lobos'");
const CONTAGEM = /\b(mate|matar|abater|elimine|derrote|colete|traga)\s+(\d+|um|uma|dois|duas|tr[êe]s|quatro|cinco|seis)\b/i;
NPCS_REGIONAIS.forEach((n) => {
  (n.estados || []).forEach((e) => t(`${n.id}/${e.id}: fala não pede contagem`, !CONTAGEM.test(e.dialogo), e.dialogo.slice(0, 50)));
  t(`${n.id}: tem opinião sobre outra pessoa`, (n.relacoes || []).some((r) => (r.nota || "").length > 20));
});
QUESTS_REGIONAIS.forEach((q) => t(`${q.id}: objetivo não é contagem`, !CONTAGEM.test(q.objetivo), q.objetivo.slice(0, 50)));

secao("8. Facções (itens 13, 14 e 15)");
t("as 10 facções mecânicas + vila existem", Object.keys(FACCOES).length === 11);
const zonasCobertas = new Set(Object.values(DOMINIO_FACCAO).flat());
const semDono = ZONAS_MUNDO.filter((z) => !zonasCobertas.has(z.id));
t("toda zona tem dono ou presença declarada", semDono.every((z) => {
  const r = presencaDaRegiao(z.regiaoId);
  return r.semReputacao !== null || PRESENCAS_SEM_REPUTACAO[z.regiaoId];
}), semDono.map((z) => z.id).join(","));
dadosWS.facoes.filter((f) => f.zonas).forEach((f) => {
  const decl = DOMINIO_FACCAO[f.id] || [];
  t(`${f.id}: worldStateVariables bate com factions.js`, f.zonas.length === decl.length && f.zonas.every((z) => decl.includes(z)));
  f.zonas.forEach((z) => t(`${f.id}: zona ${z} existe`, ZONAS_MUNDO.some((x) => x.id === z)));
});
Object.entries(FACCOES).forEach(([id, f]) => {
  if (f.naoEhOrganizacao) return;
  ["proposito", "conflito", "armas"].forEach((k) => t(`${id}: tem ${k}`, !!f[k]));
  ["postos", "aliados", "rivais", "recursos", "servicos"].forEach((k) => t(`${id}: ${k} é lista`, Array.isArray(f[k])));
  f.postos.forEach((p) => t(`${id}: posto ${p} existe`, LUGARES.has(p)));
  f.aliados.concat(f.rivais).forEach((o) => t(`${id}: relação com facção real ${o}`, !!FACCOES[o]));
});
t("nome público difere do interno em ao menos 8 regiões",
  MACRO_REGIOES.filter((r) => {
    const fs2 = presencaDaRegiao(r.id).faccoes;
    return fs2.some((f) => nomePublico(f, r.id) !== FACCOES[f].nome);
  }).length >= 8);
t("facção de zona resolve para as 48 zonas ou declara ausência",
  ZONAS_MUNDO.every((z) => faccaoDaZonaMundo(z.id) !== undefined));

secao("9. Ecologia (itens 21 a 27, e 39)");
t("toda espécie do jogo tem ecologia", monstros.every((m) => !!ECOLOGIA[m.id]),
  monstros.filter((m) => !ECOLOGIA[m.id]).map((m) => m.id).join(","));
t("15 grupos de habitat", GRUPOS_DE_HABITAT.length === 15);
let foraDeHabitat = [];
ZONAS_MUNDO.forEach((z) => {
  [...(z.monstros || []), ...(z.chefe ? [z.chefe.monstroId] : [])].forEach((m) => {
    if (!habitatCombina(m, z.id)) foraDeHabitat.push(`${m}@${z.id}(${z.bioma})`);
  });
});
t("item 22: nenhuma criatura fora do habitat", foraDeHabitat.length === 0, foraDeHabitat.join(" "));
t("item 23: existe cadeia predador/presa", cadeiaAlimentar().length >= 30, `${cadeiaAlimentar().length}`);
t("predadores derivados batem com a dieta",
  Object.keys(ECOLOGIA).every((id) => predadoresDe(id).every((p) => ECOLOGIA[p].dieta.includes(id))));
t("item 24: há migrações declaradas", MIGRACOES.length >= 3);
MIGRACOES.forEach((m) => {
  m.saemDe.concat(m.vaoPara).forEach((z) => t(`migração ${m.id}: zona ${z} existe`, ZONAS_MUNDO.some((x) => x.id === z)));
  m.especies.forEach((e) => t(`migração ${m.id}: espécie ${e} existe`, !!ECOLOGIA[e]));
  m.vaoPara.forEach((z) => m.especies.forEach((e) =>
    t(`migração ${m.id}: ${e} cabe no destino ${z}`, habitatCombina(e, z))));
});
// item 27: dia e noite não devolvem a mesma coisa
const zonasComPool = ZONAS_MUNDO.filter((z) => (z.monstros || []).length >= 3);
const diferem = zonasComPool.filter((z) => {
  const p = perfilDoDia(z.id, { agora: 0 });
  return new Set(p.map((x) => x.dominante)).size > 1;
});
t("item 27: dia e noite mudam a espécie dominante na maioria das zonas",
  diferem.length >= zonasComPool.length * 0.6, `${diferem.length}/${zonasComPool.length}`);
t("item 25: encontrar alimenta o bestiário com pista e cadeia", (() => {
  const d = descobertaAoEncontrar("lobo", "bosque_das_vozes");
  return d && d.pista && d.regiaoId === "altaverde" && d.come.length > 0;
})());
t("sorteio ponderado é determinístico com rnd fixo",
  sortearEspecie("floresta", { agora: 0 }, () => 0.5).id === sortearEspecie("floresta", { agora: 0 }, () => 0.5).id);
t("tamanho de grupo respeita a espécie", (() => {
  const n = tamanhoDoGrupo("lobo", () => 0.99);
  return n >= ECOLOGIA.lobo.grupo[0] && n <= ECOLOGIA.lobo.grupo[1];
})());

secao("10. Questlines (itens 16 a 19, e 38)");
t("uma linha por macro-região", QUESTLINES.length === 17);
t("toda macro-região tem linha", MACRO_REGIOES.every((r) => QUESTLINES.some((l) => l.regiaoId === r.id)));
t("todos os 11 tipos de quest são usados",
  new Set(QUESTS_REGIONAIS.map((q) => q.tipo)).size === TIPOS_DE_QUEST.length);
const seqs = {};
QUESTLINES.forEach((l) => {
  const k = l.passos.map((p) => p.tipo).join(">");
  (seqs[k] = seqs[k] || []).push(l.regiaoId);
});
t("nenhuma região repete a sequência de tipos de outra",
  Object.values(seqs).every((v) => v.length === 1), JSON.stringify(Object.entries(seqs).filter(([, v]) => v.length > 1)));
QUESTS_REGIONAIS.forEach((q) => {
  t(`${q.id}: tipo válido`, TIPOS_DE_QUEST.includes(q.tipo));
  t(`${q.id}: NPC real`, IDS.has(q.npcId), q.npcId);
  q.onde.forEach((o) => t(`${q.id}: usa geografia real (${o})`, LUGARES.has(o)));
  t(`${q.id}: item 17 — ao menos um lugar`, q.onde.length >= 1);
  const c = q.consequencia || {};
  t(`${q.id}: item 19 — consequência declarada`, Object.keys(c).length > 0);
  if (c.abre) t(`${q.id}: abre passo existente`, !!questRegionalPorId(c.abre));
  if (c.disparaEvento) t(`${q.id}: evento existe`, !!eventoPorId(c.disparaEvento));
  if (c.encerraEvento) t(`${q.id}: evento existe`, !!eventoPorId(c.encerraEvento));
  (c.npcMuda || []).concat(c.npcMemoria || []).forEach((n) => t(`${q.id}: NPC ${n} existe`, IDS.has(n)));
});
QUESTLINES.forEach((l) => {
  let atual = l.passos[0].id; const cadeia = [atual];
  for (let i = 0; i < 12; i += 1) {
    const q = questRegionalPorId(atual);
    const nx = q && q.consequencia && q.consequencia.abre;
    if (!nx) break;
    cadeia.push(nx); atual = nx;
  }
  t(`${l.regiaoId}: a linha inteira é alcançável`, cadeia.length === l.passos.length, `${cadeia.length}/${l.passos.length}`);
  t(`${l.regiaoId}: declara o que revela`, (l.revela || "").length > 30);
});
t("17 passos iniciais", PASSOS_INICIAIS.length === 17);

secao("11. Quest em jogo: aceitar, concluir, falhar, recarregar (item 38)");
{
  const p = novoPersonagem(); const ws = {};
  garantirQuestsRegionais(p);
  t("passo inicial nasce disponível", questsOferecidasPor(p, "npc_cacador").length === 1);
  t("passo 2 nasce indisponível", garantirQuestsRegionais(p).qr_altaverde_2 === undefined);
  t("não dá para concluir sem aceitar", !concluirQuestRegional(p, "qr_altaverde_1", { worldState: ws }).ok);
  t("aceitar funciona", aceitarQuestRegional(p, "qr_altaverde_1").ok);
  t("aceitar duas vezes não funciona", !aceitarQuestRegional(p, "qr_altaverde_1").ok);
  t("não conclui sem investigar", !concluirQuestRegional(p, "qr_altaverde_1", { worldState: ws }).ok);
  [62, 66, 70].forEach((x) => investigarElric(p, { mapaAtual: "overworld", zonaId: "bosque_das_vozes", x, y: 62 }));
  const r = concluirQuestRegional(p, "qr_altaverde_1", { worldState: ws, dadosWorldState: dadosWS });
  t("concluir funciona", r.ok);
  t("item 19: World State mudou", ws.vila_aethra_estado === "escassez");
  t("abriu o passo seguinte", r.mudou.abriu === "qr_altaverde_2");
  t("passo 2 agora disponível", questsOferecidasPor(p, "npc_mercador").length === 1);
  t("decisão foi registrada no diário", decisoesRegistradas(p).length > 0);
  // falhar não tranca a linha
  aceitarQuestRegional(p, "qr_altaverde_2");
  const f = falharQuestRegional(p, "qr_altaverde_2");
  t("falhar é possível", f.ok);
  t("falhar mesmo assim abre o próximo", f.abriu === "qr_altaverde_3");
  // save/load
  const salvo = questsRegionaisParaSave(p);
  const p2 = novoPersonagem();
  carregarQuestsRegionaisDoSave(p2, salvo);
  t("estado das quests sobrevive ao save", p2.questsRegionais.qr_altaverde_1 === ESTADO.CONCLUIDA
    && p2.questsRegionais.qr_altaverde_2 === ESTADO.FALHADA);
  t("save não guarda o que é padrão", !Object.values(salvo).includes(ESTADO.INDISPONIVEL));
  const prog = progressoDaRegiao(p, "altaverde");
  t("progresso da região é legível", prog.total === 4 && prog.concluidos === 1);
}

secao("12. NPC em jogo: fala, rotina, memória, reputação (item 37)");
{
  const p = novoPersonagem();
  const npc = NPCS_REGIONAIS.find((n) => n.id === "npc_cacador");
  const ctxBase = { personagem: p, worldState: {}, eventosAtivos: [], zonaId: "floresta", agora: 0, dadosWorldState: dadosWS };
  t("sem crise, Elric usa o estado base", falaAtual(npc, ctxBase).id === "base");
  t("com escassez, Elric muda de fala",
    falaAtual(npc, { ...ctxBase, worldState: { vila_aethra_estado: "escassez" } }).id === "escassez");
  t("com o evento ativo, muda de novo",
    falaAtual(npc, { ...ctxBase, eventosAtivos: ["ev_tempestade_eter_altaverde"] }).id === "migracao");
  // rotina cobre os três períodos e move gente de verdade
  const locais = HORAS_DIA.map((h) => localAgora(npc, instanteDe(h.id)));
  t("item 9: a rotina move o NPC ao longo do dia", new Set(locais).size >= 2, locais.join(">"));
  const comRotinaVariavel = NPCS_REGIONAIS.filter((n) =>
    new Set(["manha", "tarde", "noite"].map((h) => n.rotina[h].local)).size >= 2);
  t("a maioria dos NPCs muda de lugar durante o dia",
    comRotinaVariavel.length >= NPCS_REGIONAIS.length * 0.7, `${comRotinaVariavel.length}/${NPCS_REGIONAIS.length}`);
  // memória
  registrarConversa(p, "npc_cacador");
  registrarConversa(p, "npc_cacador");
  t("memória conta conversas", memoriaDoNpc(p, "npc_cacador").conversas === 2);
  t("memória herda o estado inicial da ficha", memoriaDoNpc(p, "npc_cacador").presasNoAno === 3);
  const salvo = memoriaParaSave(p);
  t("save guarda só quem foi conhecido", Object.keys(salvo).length === 1);
  const p2 = novoPersonagem();
  carregarMemoriaDoSave(p2, salvo);
  t("memória sobrevive ao save", p2.npcs.npc_cacador.conversas === 2);
  carregarMemoriaDoSave(p2, { npc_que_nao_existe: { conversas: 9 } });
  t("save com NPC removido não quebra", Object.keys(p2.npcs).length === 0);
  // reputação
  const heroi = { ...p, estadoDoMundo: { reputacao: { vila: 80 }, flags: {} } };
  const hostil = { ...p, estadoDoMundo: { reputacao: { vila: -80 }, flags: {} } };
  t("item 15: reação muda com a reputação",
    reacaoPorReputacao(npc, heroi, dadosWS, "vila") !== reacaoPorReputacao(npc, hostil, dadosWS, "vila"));
}

secao("13. NPCs secretos e recorrentes (itens 11 e 32)");
t("existem NPCs secretos", NPCS_SECRETOS.length >= 10, `${NPCS_SECRETOS.length}`);
t("no máximo 1 secreto por região",
  Object.values(NPCS_POR_REGIAO).every((l) => l.filter((n) => n.requisito).length <= 1));
{
  const p = novoPersonagem();
  const ctx = { personagem: p, agora: 0, zonaId: "olho_do_abismo" };
  const secreto = NPCS_REGIONAIS.find((n) => n.id === "npc_az_o_primeiro");
  t("secreto não aparece sem cumprir requisito", !requisitoAtendido(secreto, ctx));
  p.missoesConcluidas.push("qr_abismo_de_nazthal_2");
  const noite = instanteDe("noite");
  t("secreto aparece quando o requisito é cumprido",
    requisitoAtendido(secreto, { ...ctx, personagem: p, agora: noite }));
}
t("existem NPCs recorrentes", NPCS_RECORRENTES.length >= 2);
NPCS_RECORRENTES.forEach((n) => n.recorrente.forEach((l) =>
  t(`${n.id}: reaparece em lugar real (${l})`, LUGARES.has(l))));
t("existem mestres que ensinam (itens 29 e 31)", NPCS_MESTRES.length >= 10, `${NPCS_MESTRES.length}`);
t("nem todo NPC ensina (item 31)", NPCS_MESTRES.length < NPCS_REGIONAIS.length * 0.5);

secao("14. Posicionamento no mapa real (itens 1 e 9)");
{
  const g = mundoDaSemente(2055586687);
  const p = novoPersonagem();
  const ctx = { personagem: p, agora: 0, worldState: {}, eventosAtivos: [] };
  const r = posicionarNpcs(g, ctx);
  t("ninguém fica sem lugar no mapa", r.semLugar.length === 0, JSON.stringify(r.semLugar));
  t("todos os visíveis foram posicionados", r.npcs.length === NPCS_REGIONAIS.length - NPCS_SECRETOS.filter((n) => !requisitoAtendido(n, ctx)).length);
  t("dois NPCs nunca no mesmo tile", new Set(r.npcs.map((n) => `${n.x},${n.y}`)).size === r.npcs.length);
  // o bug que isto corrige: cem NPCs empilhados na praça da vila
  const naPraca = r.npcs.filter((n) => Math.hypot(n.x - 46, n.y - 46) < 8);
  t("os NPCs não estão todos empilhados na vila", naPraca.length <= 8, `${naPraca.length}`);
  const regioes = new Set(r.npcs.map((n) => n.regiaoId));
  t("NPCs espalhados por todas as regiões", regioes.size === 17, `${regioes.size}`);
  // determinismo
  const r2 = posicionarNpcs(g, ctx);
  t("posicionamento é determinístico",
    JSON.stringify(r.npcs.map((n) => [n.id, n.x, n.y])) === JSON.stringify(r2.npcs.map((n) => [n.id, n.x, n.y])));
  // a rotina move de verdade no mapa
  const manha = ondeEsta("npc_cacador", g, instanteDe("manha"));
  const noite = ondeEsta("npc_cacador", g, instanteDe("noite"));
  t("a rotina muda a posição no mapa", manha.localId !== noite.localId);
  // Regressão: os três períodos, não só o primeiro. Foi assim que apareceu o
  // caso do Abismo de Naz'thal — no período da tarde, Haldrek e Selia ficavam
  // sem lugar porque o centro do Olho do Abismo e dos Confins cai na água, e
  // os dois simplesmente sumiam do jogo. A varredura da caixa da zona
  // (NpcPlacement.js) é o plano B que resolve isso.
  ["manha", "tarde", "noite"].forEach((hora) => {
    const rr = posicionarNpcs(g, { ...ctx, agora: instanteDe(hora) });
    t(`período ${hora}: ninguém fica sem lugar no mapa`, rr.semLugar.length === 0,
      rr.semLugar.map((x) => `${x.id}@${x.local}`).join(","));
    t(`período ${hora}: as 17 regiões continuam habitadas`,
      new Set(rr.npcs.map((n) => n.regiaoId)).size === 17,
      `${new Set(rr.npcs.map((n) => n.regiaoId)).size}`);
    t(`período ${hora}: sem dois NPCs no mesmo tile`,
      new Set(rr.npcs.map((n) => `${n.x},${n.y}`)).size === rr.npcs.length);
  });
}

secao("15. Eventos e as duas cadeias de interdependência (itens 20 e 34)");
t("há eventos regionais suficientes", EVENTOS_REGIONAIS.length >= 10, `${EVENTOS_REGIONAIS.length}`);
t("tipos de evento variados (item 20)", new Set(EVENTOS_REGIONAIS.map((e) => e.tipo)).size >= 7);
EVENTOS_REGIONAIS.forEach((e) => {
  e.zonas.forEach((z) => t(`${e.id}: zona ${z} existe`, ZONAS_MUNDO.some((x) => x.id === z)));
  t(`${e.id}: tem aviso ao jogador`, (e.aviso || "").length > 20);
  t(`${e.id}: tem gatilho`, !!e.gatilho && Object.keys(e.gatilho).length > 0);
});
t("2 cadeias de interdependência declaradas", CADEIAS_DE_INTERDEPENDENCIA.length === 2);
CADEIAS_DE_INTERDEPENDENCIA.forEach((c) => {
  t(`${c.id}: tem o elo completo do item 34`, c.elos.length >= 8, `${c.elos.length}`);
  const passos = c.elos.map((e) => e.passo);
  ["migracao", "npc", "worldState", "quest", "resolucao", "estadoFinal"].forEach((k) =>
    t(`${c.id}: contém o elo "${k}"`, passos.includes(k)));
});
{
  // A cadeia A, percorrida de ponta a ponta.
  const p = novoPersonagem(); const ws = { ...WORLD_STATE_REGIONAL_PADRAO };
  garantirQuestsRegionais(p);
  t("cadeia A: vila começa provida", ws.vila_aethra_estado === "provida");
  aceitarQuestRegional(p, "qr_altaverde_1");
  [62, 66, 70].forEach((x) => investigarElric(p, { mapaAtual: "overworld", zonaId: "bosque_das_vozes", x, y: 62 }));
  concluirQuestRegional(p, "qr_altaverde_1", { worldState: ws, dadosWorldState: dadosWS });
  t("cadeia A: a vila entrou em escassez", ws.vila_aethra_estado === "escassez");
  const elric = NPCS_REGIONAIS.find((n) => n.id === "npc_cacador");
  const tobias = NPCS_REGIONAIS.find((n) => n.id === "npc_fazendeiro");
  const ctxCrise = { personagem: p, worldState: ws, eventosAtivos: [], zonaId: "floresta", agora: 0 };
  t("cadeia A: Elric mudou de fala", falaAtual(elric, ctxCrise).id === "escassez");
  t("cadeia A: Tobias mudou de fala", falaAtual(tobias, ctxCrise).id === "escassez");
  // migração some com a caça
  const poolNormal = poolDaZona("bosque_das_vozes", { agora: 0 });
  const poolCrise = poolDaZona("bosque_das_vozes", { agora: 0, eventosAtivos: ["ev_tempestade_eter_altaverde"] });
  t("cadeia A: a caça migrou para fora do bosque", poolCrise.length < poolNormal.length,
    `${poolCrise.length} vs ${poolNormal.length}`);
  const campo = poolDaZona("campos_de_elyndor", { agora: 0, eventosAtivos: ["ev_tempestade_eter_altaverde"] });
  t("cadeia A: a caça apareceu no campo aberto", campo.some((c) => c.migrante));
  // A resolução exige uma escolha; nenhum caminho concede os dois benefícios.
  p.progressoAltaverde = { conversas: ["npc_mercador", "npc_fazendeiro", "npc_alt_mireu"], portaExaminada: true };
  ["qr_altaverde_2", "qr_altaverde_3"].forEach((id) => {
    aceitarQuestRegional(p, id);
    concluirQuestRegional(p, id, { worldState: ws, dadosWorldState: dadosWS });
  });
  aceitarQuestRegional(p, "qr_altaverde_4");
  const antesDaEscolha = JSON.stringify(p);
  const wsAntes = JSON.stringify(ws);
  t("cadeia A: decisão exige escolha", !concluirQuestRegional(p, "qr_altaverde_4", { worldState: ws, dadosWorldState: dadosWS }).ok);
  t("cadeia A: escolha desconhecida é recusada", !concluirQuestRegional(p, "qr_altaverde_4", { worldState: ws, dadosWorldState: dadosWS }, "inexistente").ok);
  t("cadeia A: recusa preserva personagem e mundo", JSON.stringify(p) === antesDaEscolha && JSON.stringify(ws) === wsAntes);
  const esperando = JSON.parse(antesDaEscolha);
  const wsEsperando = JSON.parse(wsAntes);
  const reputacaoAntes = getReputacao(p, "guardioes_da_folha");
  const espera = concluirQuestRegional(esperando, "qr_altaverde_4", { worldState: wsEsperando, dadosWorldState: dadosWS }, "esperar");
  t("cadeia A: esperar conclui a missão", espera.ok);
  t("cadeia A: esperar preserva árvore e mantém escassez", wsEsperando.altaverde_arvore === "inteira" && wsEsperando.vila_aethra_estado === "escassez");
  t("cadeia A: esperar conquista confiança", getReputacao(esperando, "guardioes_da_folha") === reputacaoAntes + 14);
  t("cadeia A: esperar encarece a loja", espera.mudou.precoLoja === 1.2);
  t("cadeia A: esperar registra o desfecho no diário", decisoesRegistradas(esperando).some((d) => d.texto.includes(espera.escolha.resultado)));
  const drenagem = concluirQuestRegional(p, "qr_altaverde_4", { worldState: ws, dadosWorldState: dadosWS }, "drenar");
  t("cadeia A: drenar conclui a missão", drenagem.ok);
  t("cadeia A: drenar deixa a árvore muda", ws.altaverde_arvore === "muda");
  t("cadeia A: drenar reduz preço da loja", drenagem.mudou.precoLoja === 0.95);
  t("cadeia A: a vila voltou a ser provida", ws.vila_aethra_estado === "provida");
  t("cadeia A: Elric voltou ao estado base",
    falaAtual(elric, { ...ctxCrise, worldState: ws }).id === "base");
  t("cadeia A: drenar custa confiança dos Guardiões", getReputacao(p, "guardioes_da_folha") === reputacaoAntes - 7);
  const depoisDaEscolha = JSON.stringify(p);
  t("cadeia A: não permite trocar decisão concluída", !concluirQuestRegional(p, "qr_altaverde_4", { worldState: ws, dadosWorldState: dadosWS }, "esperar").ok);
  t("cadeia A: tentativa de troca não altera progresso", JSON.stringify(p) === depoisDaEscolha);
  const estado = estadoDaCadeia(p, ws, "cadeia_altaverde");
  t("cadeia A: todos os elos foram cumpridos", estado.elos.every((e) => e.cumprido),
    estado.elos.filter((e) => !e.cumprido).map((e) => e.passo).join(","));
}
{
  // A cadeia B: o branqueamento do recife.
  const p = novoPersonagem(); const ws = { ...WORLD_STATE_REGIONAL_PADRAO };
  garantirQuestsRegionais(p);
  aceitarQuestRegional(p, "qr_recife_coralino_1");
  concluirQuestRegional(p, "qr_recife_coralino_1", { worldState: ws, dadosWorldState: dadosWS });
  t("cadeia B: o recife branqueou", ws.recife_estado === "branqueado");
  const { saem } = ajusteDeMigracao("jardins_de_perola", { worldState: ws, agora: 0 });
  t("cadeia B: o cardume saiu do viveiro", saem.length >= 2, saem.join(","));
  const abismo = poolDaZona("abismo_raso", { worldState: ws, agora: 0 });
  t("cadeia B: o cardume chegou ao abismo raso", abismo.some((c) => c.migrante));
  ["qr_recife_coralino_2", "qr_recife_coralino_3", "qr_recife_coralino_4"].forEach((id) => {
    aceitarQuestRegional(p, id);
    concluirQuestRegional(p, id, { worldState: ws, dadosWorldState: dadosWS });
  });
  t("cadeia B: o recife voltou a viver", ws.recife_estado === "vivo");
}

secao("16. Motor de eventos");
{
  const p = novoPersonagem(); const ws = { ...WORLD_STATE_REGIONAL_PADRAO };
  const r = reavaliar(p, { worldState: ws, agora: 0, zonaId: "deserto_karn", visitados: ["vila"] });
  t("reavaliar devolve o que abriu e o que fechou", Array.isArray(r.abriram) && Array.isArray(r.fecharam));
  t("eventos ativos são ids reais", r.ativos.every((id) => !!eventoPorId(id)));
  aplicarNoWorldState(ws, r);
  const ef = efeitosNaZona(p, "deserto_karn");
  t("efeitos são somáveis e numéricos", typeof ef.precoLoja === "number" && typeof ef.encontro === "number");
  const salvo = eventosParaSave(p);
  const p2 = novoPersonagem();
  carregarEventosDoSave(p2, salvo);
  t("eventos sobrevivem ao save", JSON.stringify(eventosParaSave(p2)) === JSON.stringify(salvo));
  carregarEventosDoSave(p2, { ativos: ["ev_que_nao_existe"], encerrados: [] });
  t("evento removido do jogo não quebra o save", p2.eventosRegionais.ativos.length === 0);
}

secao("17. População secundária e densidade (itens 12, 23 e 40)");
t("8 templates de figurante", TEMPLATES_IDS.length === 8);
TEMPLATES_IDS.forEach((id) => {
  const tp = TEMPLATES[id];
  t(`template ${id}: tem falas`, tp.falas.length >= 3);
  t(`template ${id}: tem nomes`, tp.nomes.length >= 8);
  t(`template ${id}: rotina rasa de 3 períodos`, ["manha", "tarde", "noite"].every((h) => !!tp.rotina[h]));
});
{
  const zonaDe = (id) => ZONAS_MUNDO.find((z) => z.id === id);
  let total = 0;
  ASSENTAMENTOS.forEach((a) => {
    const reg = zonaDe(a.zonaId).regiaoId;
    const g = popularAssentamento(2055586687, a, reg);
    total += g.length;
    t(`${a.id}: dentro do orçamento de figurantes`, g.length <= ORCAMENTO_FIGURANTES[a.categoria], `${g.length} > ${ORCAMENTO_FIGURANTES[a.categoria]}`);
    const g2 = popularAssentamento(2055586687, a, reg);
    t(`${a.id}: figurantes determinísticos`, JSON.stringify(g) === JSON.stringify(g2));
  });
  t("item 23: capital tem mais gente que acampamento",
    popularAssentamento(2055586687, ASSENTAMENTOS.find((a) => a.categoria === "CAPITAL"), "vale_do_vento").length
    > popularAssentamento(2055586687, ASSENTAMENTOS.find((a) => a.categoria === "ACAMPAMENTO"), "vale_dos_titas").length);
  t("item 40: densidade total sob controle no mobile", total <= 120, `${total}`);
  t("marinheiro não aparece em mina", !templatesPara("CIDADE", "montanhas_de_vulkor", "fortaleza_de_ignis").includes("marinheiro"));
  t("mineiro não aparece no acampamento dos peregrinos",
    !templatesPara("ACAMPAMENTO", "vale_dos_titas", "acampamento_dos_peregrinos").includes("mineiro"));
}

secao("18. Save v6 (item 36)");
t("SAVE_VERSION é 10", SAVE_VERSION === 10);
{
  const v5 = {
    saveVersion: 5,
    personagem: { nome: "Antigo", biomaVisitados: ["vila", "floresta"], nevoa: { zonas: { vila: "descoberto" }, locais: {} } },
    mundo: { layoutMundo: 2, mapaAtual: "overworld", player: { x: 46, y: 46 }, zonaAtualId: "floresta", chests: [{ id: "bau_vila_1" }] },
  };
  migrarSave(v5);
t("v5 -> v10 carimba a versão", v5.saveVersion === 10);
  // A v6 não mexe na posição; quem mexe é a v10, que leva o desenho-base
  // (layout 2) para a malha 4x: (46,46) vira (184,184), o centro da vila.
  t("a posição só muda de escala (v10): (46,46) do desenho-base vira (184,184)", v5.mundo.player.x === 184 && v5.mundo.player.y === 184);
  t("v6 não apaga os baús", v5.mundo.chests.length === 1);
  t("v6 cria a memória de NPC vazia", JSON.stringify(v5.personagem.npcs) === "{}");
  t("v6 cria as quests regionais vazias", JSON.stringify(v5.personagem.questsRegionais) === "{}");
  t("v6 cria os eventos vazios", v5.personagem.eventosRegionais.ativos.length === 0);
  t("v6 semeia o World State regional em repouso",
    Object.keys(WORLD_STATE_REGIONAL_PADRAO).every((k) => v5.mundo.worldStateRegional[k] === WORLD_STATE_REGIONAL_PADRAO[k]));
  const antes = JSON.stringify(v5);
  migrarSave(v5);
  t("v6 é idempotente", JSON.stringify(v5) === antes);
  const v0 = { personagem: { nome: "Muito antigo" }, mundo: { mapaAtual: "overworld", player: { x: 30, y: 50 } } };
  migrarSave(v0);
t("um save v0 atravessa a série inteira até a v10", v0.saveVersion === 10 && !!v0.mundo.worldStateRegional);
}

secao("19. Simulação distante (item 10)");
{
  const p = novoPersonagem();
  const ctx = { personagem: p, agora: 0, worldState: {}, eventosAtivos: [] };
  const distante = estadoLogicoDaRegiao("abismo_de_nazthal", ctx);
  t("região distante devolve estado lógico", distante.length === 3);
  t("estado lógico traz local, atividade e estado narrativo",
    distante.every((e) => e.local && "atividade" in e && e.estado && "visivel" in e));
  t("estado lógico não instancia nada (é objeto simples)",
    distante.every((e) => Object.keys(e).length === 6));
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 200; i += 1) MACRO_REGIOES.forEach((r) => estadoLogicoDaRegiao(r.id, ctx));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  t("17 regiões em estado lógico, 200 vezes, abaixo de 2s", ms < 2000, `${ms.toFixed(0)}ms`);
}

secao("20. Cultura regional e armas (itens 30 e 33)");
{
  const comArma = Object.values(FACCOES).filter((f) => f.armas).length;
  t("famílias de armas ligadas a cultura", comArma >= 9, `${comArma}`);
  // O vocabulário de uma cultura aparece no que as pessoas DIZEM, não só na
  // descrição de como falam — o teste olha as duas coisas.
  const vocab = {};
  Object.entries(NPCS_POR_REGIAO).forEach(([r, l]) => {
    vocab[r] = l.map((n) => [n.fala, n.profissao, ...(n.estados || []).map((e) => e.dialogo)].join(" ")).join(" ").toLowerCase();
  });
  t("Morranvell fala de juramento", vocab.morranvell.includes("juramento") || vocab.morranvell.includes("clã"));
  t("Maris fala de carta/maré", /carta|mar[ée]|farol|doca/.test(vocab.costa_da_mare));
  t("Vulkor fala de runa/forja", /runa|forja|metal|peça|ferro/.test(vocab.montanhas_de_vulkor));
  t("Sombralith fala de nome/Véu", /nome|v[ée]u|luto|processo|papel/.test(vocab.sombralith));
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`${ok} verificações passaram, ${falhas.length} falharam.`);
if (falhas.length) {
  console.log("\nFALHAS:");
  falhas.slice(0, 40).forEach((f) => console.log("  ✗", f));
  if (falhas.length > 40) console.log(`  ... e mais ${falhas.length - 40}`);
  process.exit(1);
}
console.log("ETAPA 3 verificada.");
