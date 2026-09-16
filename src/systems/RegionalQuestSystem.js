// QUESTLINES REGIONAIS EM JOGO (ETAPA 3, itens 16 a 19 e 38).
//
// A quest regional NÃO substitui o QuestSystem que já existia: aquele resolve
// missão de contagem (`matar`/`coletar`/`explorar`), continua funcionando e
// continua guardando o que sempre guardou. Este resolve linha narrativa, que
// é outra coisa — avança por passo concluído, não por contador.
//
// Estado no save: `personagem.questsRegionais = { [id]: "disponivel" |
// "ativa" | "concluida" | "falhada" }`. Nada além disso: o texto, o objetivo
// e a consequência vivem no arquivo de dados, porque são conteúdo.
import {
  QUESTLINES, QUESTS_REGIONAIS, questRegionalPorId, questlineDaRegiao, PASSOS_INICIAIS,
} from "../data/world/regionalQuests.js";
import { alterarReputacao, definirFlag, registrarDecisao } from "./WorldStateSystem.js";
import { lembrar } from "./NpcSystem.js";

export const ESTADO = {
  INDISPONIVEL: "indisponivel",
  DISPONIVEL: "disponivel",
  ATIVA: "ativa",
  CONCLUIDA: "concluida",
  FALHADA: "falhada",
};

export function garantirQuestsRegionais(personagem) {
  if (!personagem.questsRegionais || typeof personagem.questsRegionais !== "object") {
    personagem.questsRegionais = {};
  }
  // Os primeiros passos de cada linha nascem disponíveis: é o NPC daquele
  // passo que os oferece quando o jogador o encontra. O resto nasce
  // indisponível e é aberto pelo `consequencia.abre` do passo anterior.
  PASSOS_INICIAIS.forEach((id) => {
    if (!personagem.questsRegionais[id]) personagem.questsRegionais[id] = ESTADO.DISPONIVEL;
  });
  return personagem.questsRegionais;
}

export function estadoDaQuest(personagem, questId) {
  const q = garantirQuestsRegionais(personagem);
  return q[questId] || ESTADO.INDISPONIVEL;
}

export const questAtiva = (p, id) => estadoDaQuest(p, id) === ESTADO.ATIVA;
export const questConcluida = (p, id) => estadoDaQuest(p, id) === ESTADO.CONCLUIDA;

const INVESTIGACAO_ELRIC = "qr_altaverde_1";
const PISTAS_ELRIC = [
  "A primeira armadilha está vazia. A isca continua intacta.",
  "As pegadas ao redor da segunda armadilha são antigas. Nenhuma trilha recente.",
  "A terceira armadilha também está intacta. A caça abandonou este trecho do bosque.",
];

function pistasElric(personagem) {
  return personagem.investigacaoElric?.pistas || [];
}

export function progressoObjetivoRegional(personagem, questId) {
  if (questId === "qr_altaverde_2") {
    const ouvidos = personagem.progressoAltaverde?.conversas || [];
    const faltam = [["npc_mercador", "Baltazar"], ["npc_fazendeiro", "Tobias"], ["npc_alt_mireu", "Mireu"]].filter(([id]) => !ouvidos.includes(id));
    return { pronto: faltam.length === 0, texto: faltam.length ? `Converse após aceitar a missão com: ${faltam.map(([, nome]) => nome).join(", ")}. Depois, retorne a Baltazar.` : "Todos foram ouvidos. Retorne a Baltazar." };
  }
  if (questId === "qr_altaverde_3") {
    const pronto = personagem.progressoAltaverde?.portaExaminada === true;
    return { pronto, texto: pronto ? "Marca examinada. Relate a descoberta a Helena." : "Entre na Masmorra Antiga e pressione E longe de outros objetos para examinar a marca da porta. Depois, volte a Helena." };
  }
  if (questId !== INVESTIGACAO_ELRIC) return { pronto: true, texto: "" };
  const quantidade = pistasElric(personagem).length;
  return {
    pronto: quantidade >= PISTAS_ELRIC.length,
    texto: quantidade >= PISTAS_ELRIC.length
      ? "Investigação completa. Volte a falar com Elric."
      : `Pistas examinadas: ${quantidade}/3. No Bosque das Vozes, pressione E em três pontos separados por pelo menos quatro passos, longe de outros objetos.`,
  };
}

export function registrarConversaAltaverde(personagem, npcId) {
  if (!questAtiva(personagem, "qr_altaverde_2")) return false;
  if (!["npc_mercador", "npc_fazendeiro", "npc_alt_mireu"].includes(npcId)) return false;
  const progresso = personagem.progressoAltaverde ||= {};
  const conversas = progresso.conversas ||= [];
  if (conversas.includes(npcId)) return false;
  conversas.push(npcId);
  return true;
}

export function podeExaminarPortaAltaverde(personagem, local = {}) {
  return questAtiva(personagem, "qr_altaverde_3") && local.mapaAtual === "dungeon1"
    && !personagem.progressoAltaverde?.portaExaminada;
}

export function examinarPortaAltaverde(personagem, local) {
  if (!podeExaminarPortaAltaverde(personagem, local)) return { ok: false };
  (personagem.progressoAltaverde ||= {}).portaExaminada = true;
  return { ok: true, texto: "A marca foi cavada por dentro. Algo tentou sair da cripta. Volte a Helena para relatar a descoberta." };
}

// Só uma interação explícita no mundo conta. Visitas anteriores, andar em
// círculos e reabrir o diálogo não geram evidências. O personagem já é salvo
// integralmente, portanto as três coordenadas sobrevivem ao carregamento.
export function podeInvestigarElric(personagem, { mapaAtual, zonaId, x, y } = {}) {
  return questAtiva(personagem, INVESTIGACAO_ELRIC)
    && mapaAtual === "overworld" && zonaId === "bosque_das_vozes"
    && Number.isInteger(x) && Number.isInteger(y)
    && pistasElric(personagem).length < PISTAS_ELRIC.length
    && pistasElric(personagem).every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) >= 4);
}

export function investigarElric(personagem, local) {
  if (!podeInvestigarElric(personagem, local)) return { ok: false };
  if (!personagem.investigacaoElric) personagem.investigacaoElric = { pistas: [] };
  const pistas = personagem.investigacaoElric.pistas;
  const texto = PISTAS_ELRIC[pistas.length];
  pistas.push({ x: local.x, y: local.y });
  return { ok: true, texto: `${texto} (${pistas.length}/3)${pistas.length === 3 ? " Volte a falar com Elric." : " Procure outro ponto a pelo menos quatro passos."}` };
}

// O que este NPC tem a oferecer agora: só o passo dele, e só se estiver
// disponível ou ativa. É isto que impede o NPC de virar terminal de quest —
// ele tem no máximo um passo por vez, e o passo é o assunto dele.
export function questsOferecidasPor(personagem, npcId) {
  return QUESTS_REGIONAIS
    .filter((q) => q.npcId === npcId)
    .map((q) => ({ quest: q, estado: estadoDaQuest(personagem, q.id) }))
    .filter((x) => x.estado === ESTADO.DISPONIVEL || x.estado === ESTADO.ATIVA);
}

export function aceitarQuestRegional(personagem, questId) {
  const q = questRegionalPorId(questId);
  if (!q) return { ok: false, motivo: "quest inexistente" };
  if (estadoDaQuest(personagem, questId) !== ESTADO.DISPONIVEL) {
    return { ok: false, motivo: "não está disponível" };
  }
  personagem.questsRegionais[questId] = ESTADO.ATIVA;
  if (questId === INVESTIGACAO_ELRIC) personagem.investigacaoElric = { pistas: [] };
  if (questId === "qr_altaverde_2") ((personagem.progressoAltaverde ||= {}).conversas ||= []);
  if (questId === "qr_altaverde_3") {
    const progresso = personagem.progressoAltaverde ||= {};
    if (progresso.portaExaminada === undefined) progresso.portaExaminada = false;
  }
  return { ok: true, quest: q };
}

// Conclui o passo e APLICA a consequência (item 19). Devolve o que mudou no
// mundo, para quem chamou poder mostrar ao jogador — mudança que ninguém vê
// é mudança que não aconteceu.
//
// `escolhaId` só é usado por passos `tipo: "decisao"`, que declaram
// `escolhas` (ver regionalQuests.js). Nesses, a consequência aplicada é a
// BASE do passo mesclada com a da escolha feita; nos demais, `escolhaId` é
// ignorado e nada muda em relação ao comportamento anterior. Um passo com
// escolhas que chega aqui SEM escolhaId é recusado em vez de cair num
// padrão silencioso: concluir uma decisão sem decidir é justamente o bug que
// as escolhas vieram consertar, e falhar alto é como ele não volta.
export function concluirQuestRegional(personagem, questId, mundo = {}, escolhaId = null) {
  const q = questRegionalPorId(questId);
  if (!q) return { ok: false, motivo: "quest inexistente" };
  if (estadoDaQuest(personagem, questId) !== ESTADO.ATIVA) {
    return { ok: false, motivo: "não está ativa" };
  }

  const temEscolhas = Array.isArray(q.escolhas) && q.escolhas.length > 0;
  const escolha = temEscolhas ? q.escolhas.find((e) => e.id === escolhaId) : null;
  if (temEscolhas && !escolha) return { ok: false, motivo: "falta escolher" };

  const objetivo = progressoObjetivoRegional(personagem, questId);
  if (!objetivo.pronto) return { ok: false, motivo: objetivo.texto };

  personagem.questsRegionais[questId] = ESTADO.CONCLUIDA;

  // Base do passo + o que a escolha acrescenta. `worldState` e `faccao` são
  // mesclados chave a chave (a escolha pode sobrescrever uma chave da base);
  // as listas são concatenadas; os campos simples, quando a escolha traz um,
  // valem os da escolha.
  const c = mesclarConsequencias(q.consequencia, escolha && escolha.consequencia);
  const mudou = { worldState: {}, faccao: {}, npcs: [], eventos: [], descobertas: [], rotas: [], escolha: escolha || null };

  if (c.worldState) {
    Object.entries(c.worldState).forEach(([chave, valor]) => {
      if (mundo.worldState) mundo.worldState[chave] = valor;
      definirFlag(personagem, `ws_${chave}_${valor}`);
      mudou.worldState[chave] = valor;
    });
  }
  if (c.faccao && mundo.dadosWorldState) {
    Object.entries(c.faccao).forEach(([fid, delta]) => {
      alterarReputacao(personagem, fid, delta, mundo.dadosWorldState);
      mudou.faccao[fid] = delta;
    });
  }
  (c.npcMemoria || []).forEach((npcId) => {
    lembrar(personagem, npcId, `soube_de_${questId}`, true);
    mudou.npcs.push(npcId);
  });
  (c.npcMuda || []).forEach((npcId) => {
    lembrar(personagem, npcId, `mudou_por_${questId}`, true);
    mudou.npcs.push(npcId);
  });
  if (c.npcAparece) {
    lembrar(personagem, c.npcAparece, "revelado", true);
    mudou.npcs.push(c.npcAparece);
  }
  if (c.disparaEvento) mudou.eventos.push({ acao: "dispara", id: c.disparaEvento });
  if (c.encerraEvento) mudou.eventos.push({ acao: "encerra", id: c.encerraEvento });
  if (c.descobre) mudou.descobertas.push(c.descobre);
  if (c.rotaAbre) mudou.rotas.push(c.rotaAbre);
  if (typeof c.precoLoja === "number") mudou.precoLoja = c.precoLoja;

  // Abre o próximo passo da linha.
  if (c.abre && estadoDaQuest(personagem, c.abre) === ESTADO.INDISPONIVEL) {
    personagem.questsRegionais[c.abre] = ESTADO.DISPONIVEL;
    mudou.abriu = c.abre;
  }

  // O diário guarda o que o jogador ESCOLHEU quando havia escolha — não o
  // enunciado do dilema. "Você drenou o Éter da raiz" é uma página de
  // diário; "escolher entre drenar ou esperar" é um enunciado de prova.
  registrarDecisao(personagem, {
    icone: escolha ? "⚖️" : "🗺️",
    titulo: q.nome,
    texto: escolha ? `${q.questline} — ${escolha.rotulo} ${escolha.resultado}` : `${q.questline} — ${q.objetivo}`,
  });

  return { ok: true, quest: q, mudou, escolha: escolha || null };
}

// Mescla a consequência-base do passo com a da escolha. Objetos (worldState,
// faccao) são unidos chave a chave; listas são concatenadas sem repetir;
// campos simples (abre, descobre, precoLoja, ...) da escolha ganham dos da
// base quando existem.
function mesclarConsequencias(base = {}, extra) {
  if (!extra) return { ...base };
  const out = { ...base, ...extra };
  out.worldState = { ...(base.worldState || {}), ...(extra.worldState || {}) };
  out.faccao = { ...(base.faccao || {}), ...(extra.faccao || {}) };
  ["npcMemoria", "npcMuda", "criaturaMuda"].forEach((campo) => {
    const juntos = [...(base[campo] || []), ...(extra[campo] || [])];
    if (juntos.length) out[campo] = [...new Set(juntos)];
  });
  return out;
}

// Falhar é possível (item 38) e não trava a linha: o passo seguinte abre do
// mesmo jeito, com a consequência mais dura já registrada. Linha narrativa que
// pode ficar impossível de terminar é bug, não drama.
export function falharQuestRegional(personagem, questId) {
  const q = questRegionalPorId(questId);
  if (!q || estadoDaQuest(personagem, questId) !== ESTADO.ATIVA) return { ok: false };
  personagem.questsRegionais[questId] = ESTADO.FALHADA;
  const abre = q.consequencia && q.consequencia.abre;
  if (abre && estadoDaQuest(personagem, abre) === ESTADO.INDISPONIVEL) {
    personagem.questsRegionais[abre] = ESTADO.DISPONIVEL;
  }
  registrarDecisao(personagem, { icone: "✖", titulo: `${q.nome} (falhou)`, texto: q.objetivo });
  return { ok: true, quest: q, abriu: abre || null };
}

// --- progresso -------------------------------------------------------------
export function progressoDaRegiao(personagem, regiaoId) {
  const linha = questlineDaRegiao(regiaoId);
  if (!linha) return null;
  const estados = linha.passos.map((p) => estadoDaQuest(personagem, p.id));
  const concluidos = estados.filter((e) => e === ESTADO.CONCLUIDA).length;
  return {
    regiaoId,
    nome: linha.nome,
    revela: linha.revela,
    total: linha.passos.length,
    concluidos,
    completa: concluidos === linha.passos.length,
    passoAtual: linha.passos.find((p, i) => estados[i] === ESTADO.ATIVA || estados[i] === ESTADO.DISPONIVEL) || null,
  };
}

export function progressoGeral(personagem) {
  return QUESTLINES.map((l) => progressoDaRegiao(personagem, l.regiaoId));
}

// --- save ------------------------------------------------------------------
export function questsRegionaisParaSave(personagem) {
  const q = garantirQuestsRegionais(personagem);
  const out = {};
  Object.entries(q).forEach(([id, estado]) => {
    // Não vale a pena salvar o que é o padrão de um jogo novo.
    if (estado === ESTADO.DISPONIVEL && PASSOS_INICIAIS.includes(id)) return;
    if (estado === ESTADO.INDISPONIVEL) return;
    out[id] = estado;
  });
  return out;
}

export function carregarQuestsRegionaisDoSave(personagem, salvo) {
  personagem.questsRegionais = {};
  garantirQuestsRegionais(personagem);
  if (!salvo || typeof salvo !== "object") return personagem.questsRegionais;
  Object.entries(salvo).forEach(([id, estado]) => {
    if (questRegionalPorId(id)) personagem.questsRegionais[id] = estado;
  });
  return personagem.questsRegionais;
}
