import { progressoDaRegiao, progressoObjetivoRegional, questConcluida } from "./RegionalQuestSystem.js";
import { estadoGachaInicial, instanciarPersonagemGacha, MAX_CONVOCADOS_GACHA } from "./GachaSystem.js";

// Quando Altaverde acaba, o próximo destino não é genérico: é a terra do
// POVO DE ORIGEM do herói (a facção escolhida na criação). `dadosWorldState`
// é opcional — sem ele, o texto volta a ser o antigo.
function orientacaoDepoisDeAltaverde(personagem, dadosWorldState) {
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  const origem = facoes.find((f) => f.id === personagem.faccaoOrigemId);
  if (!origem) return "A história de Altaverde foi decidida. Explore as outras regiões e suas histórias.";
  return `A história de Altaverde foi decidida. Seu povo, ${origem.icone || ""} ${origem.nome}, espera notícias suas — as terras deles são o próximo destino natural.`;
}

export function proximoPassoAltaverde(personagem, dadosWorldState = null) {
  const progresso = progressoDaRegiao(personagem, "altaverde");
  const passo = progresso.passoAtual;
  if (!passo) return { ...progresso, orientacao: orientacaoDepoisDeAltaverde(personagem, dadosWorldState), passo: null };
  const nomes = { npc_cacador: "Elric", npc_mercador: "Baltazar", npc_guarda: "Helena", npc_alt_hedra: "Hedra" };
  const ativa = personagem.questsRegionais[passo.id] === "ativa";
  const objetivo = progressoObjetivoRegional(personagem, passo.id);
  return { ...progresso, passo, orientacao: ativa ? (objetivo.texto || `Converse com ${nomes[passo.npcId]} para decidir o destino da Árvore-Mãe.`) : `Procure ${nomes[passo.npcId]} e aceite “${passo.nome}”.` };
}

export function podeRecrutarAshryn(personagem) {
  return questConcluida(personagem, "qr_altaverde_1") && !personagem.aliadosDaHistoria?.ashryn_folhaferrea;
}

// Recompensa narrativa garantida. Não consome fragmentos, não avança garantias
// de sorteio e não duplica nem modifica uma Ashryn já treinada pelo jogador.
export function recrutarAshryn(personagem, roster) {
  if (!podeRecrutarAshryn(personagem)) return { ok: false };
  const def = roster?.find((p) => p.id === "ashryn_folhaferrea");
  if (!def) return { ok: false };
  const g = personagem.gacha ||= estadoGachaInicial();
  let aliada = g.personagensObtidos.find((p) => p.rosterId === def.id);
  const jaPossuia = !!aliada;
  if (!aliada) {
    aliada = instanciarPersonagemGacha(def);
    g.personagensObtidos.push(aliada);
    if (g.timeAtivo.length < MAX_CONVOCADOS_GACHA) g.timeAtivo.push(aliada.uid);
  }
  (personagem.aliadosDaHistoria ||= {}).ashryn_folhaferrea = true;
  return { ok: true, aliada, jaPossuia, noTime: g.timeAtivo.includes(aliada.uid) };
}
