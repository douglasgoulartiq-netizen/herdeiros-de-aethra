// NPCs VIVOS (ETAPA 3, itens 8, 9, 10, 11, 15 e 32).
//
// Três coisas acontecem aqui, e nenhuma delas roda por quadro:
//
//   1. QUAL FALA (item 7 e 8). O NPC tem uma pilha de `estados`, do mais
//      específico para o mais geral, e o primeiro cuja condição bate é o que
//      ele diz. A condição olha World State, quest, evento, clima, hora e
//      reputação — quer dizer, o NPC lembra do que o jogador fez porque o
//      mundo lembra, não porque ele guarda uma cópia disso.
//
//   2. ONDE ELE ESTÁ (item 9). `rotina.manha/tarde/noite` casa com as três
//      horas que o WeatherSystem já produz do relógio real. Ninguém anda:
//      o NPC simplesmente ESTÁ no lugar do período atual. É a diferença
//      entre schedule e pathfinding, e é de propósito.
//
//   3. SIMULAÇÃO DISTANTE (item 10). NPC de região não carregada não tem
//      função nenhuma sendo chamada: `estadoLogico()` devolve onde ele
//      estaria e em que estado narrativo estaria, a partir de dados, sem
//      instanciar nada. Sem AI, sem pathfinding, sem animação — como o item
//      10 exige em letra.
//
// MEMÓRIA (item 8) é o que vai para o save: por NPC, `{conhecido, conversas,
// favor}` mais os campos próprios que a ficha declarou em `estadoInicial`.
// A ficha em si nunca é salva — ela é conteúdo, e conteúdo vem do arquivo.
import { NPCS_REGIONAIS, npcPorId, npcsDaRegiao, NPCS_RECORRENTES } from "../data/world/npcs/index.js";
import { horaDoDiaAtual, climaAtualDaZona } from "./WeatherSystem.js";
import { getReputacao, tierDaReputacao, temFlag } from "./WorldStateSystem.js";
import { reconhecimentoRacial } from "../data/world/racialReactions.js";

export const ORDEM_TIERS = ["hostil", "malvisto", "neutro", "respeitado", "heroi"];

// --- memória ---------------------------------------------------------------
export function garantirMemoriaNpcs(personagem) {
  if (!personagem.npcs || typeof personagem.npcs !== "object") personagem.npcs = {};
  return personagem.npcs;
}

export function memoriaDoNpc(personagem, npcId) {
  const mem = garantirMemoriaNpcs(personagem);
  if (!mem[npcId]) {
    const ficha = npcPorId(npcId);
    mem[npcId] = { ...(ficha ? ficha.estadoInicial : {}), conhecido: false, conversas: 0, favor: 0 };
  }
  return mem[npcId];
}

export function registrarConversa(personagem, npcId) {
  const m = memoriaDoNpc(personagem, npcId);
  m.conhecido = true;
  m.conversas = (m.conversas || 0) + 1;
  return m;
}

export function lembrar(personagem, npcId, chave, valor) {
  const m = memoriaDoNpc(personagem, npcId);
  m[chave] = valor;
  return m;
}

export function alterarFavor(personagem, npcId, delta) {
  const m = memoriaDoNpc(personagem, npcId);
  m.favor = Math.max(-100, Math.min(100, (m.favor || 0) + delta));
  return m.favor;
}

// --- condições dos estados narrativos --------------------------------------
// `contexto` é montado por quem chama (main.js), e é o único lugar que sabe
// do jogo rodando. Este módulo continua puro e testável.
export function condicaoAtendida(quando, contexto) {
  if (!quando || quando.tipo === "sempre") return true;
  const {
    personagem, worldState = {}, eventosAtivos = [], zonaId, agora = Date.now(),
    dadosWorldState, regiaoAtual,
  } = contexto;
  switch (quando.tipo) {
    case "hora":
      return horaDoDiaAtual(agora).id === quando.id;
    case "clima":
      return zonaId ? climaAtualDaZona(zonaId, agora).id === quando.id : false;
    case "eventoAtivo":
      return eventosAtivos.includes(quando.id);
    case "worldState":
      return worldState[quando.chave] === quando.valor;
    case "questAtiva":
      return !!(personagem && (personagem.missoesAtivas || []).some((m) => m.id === quando.id));
    case "questConcluida":
      return !!(personagem && (personagem.missoesConcluidas || []).includes(quando.id));
    case "reputacaoMin":
      return !!(personagem && getReputacao(personagem, quando.faccao) >= quando.valor);
    case "foraDaRegiaoNatal":
      return !!(regiaoAtual && contexto.npcRegiaoNatal && regiaoAtual !== contexto.npcRegiaoNatal);
    case "flag":
      return !!(personagem && temFlag(personagem, quando.id));
    default:
      return false;
  }
}

// A fala do momento. Percorre os estados na ordem em que a ficha os declarou
// (do específico para o "sempre"), o que faz da ordem do arquivo a regra de
// precedência — visível a olho nu, sem prioridade numérica escondida.
export function falaAtual(npc, contexto) {
  const ctx = { ...contexto, npcRegiaoNatal: npc.regiaoId };
  const estado = (npc.estados || []).find((e) => condicaoAtendida(e.quando, ctx));
  if (estado) return { id: estado.id, texto: estado.dialogo };
  return { id: "base", texto: npc.dialogo || "..." };
}

// Reação por reputação (item 15). A ficha escreve três âncoras — heroi,
// neutro, hostil — e os tiers intermediários caem na âncora mais próxima.
// Três reações escritas de verdade valem mais que cinco enchendo linguiça, e
// o jogador nunca vê a diferença.
export function reacaoPorReputacao(npc, personagem, dadosWorldState, faccaoId) {
  const alvo = faccaoId || npc.faccaoId || "vila";
  const tier = tierDaReputacao(getReputacao(personagem, alvo), dadosWorldState);
  const r = npc.reacaoAReputacao || {};
  const id = tier ? tier.id : "neutro";
  if (id === "heroi" || id === "respeitado") return r.heroi || r.neutro || null;
  if (id === "hostil" || id === "malvisto") return r.hostil || r.neutro || null;
  return r.neutro || null;
}

// Reação à RAÇA do herdeiro. O povo de uma região repara em quem é de casa e
// em quem claramente não é (ver racialReactions.js). Vem depois da reação por
// reputação porque é o comentário menos importante dos dois: reputação é o que
// você fez, raça é só o que você é. Devolve null na maioria dos encontros — a
// tabela é esparsa de propósito, e um NPC sem região nunca reage.
export function reacaoARaca(npc, personagem) {
  if (!npc || !personagem) return null;
  return reconhecimentoRacial(npc.regiaoId, personagem.racaId);
}

// --- rotina (item 9) -------------------------------------------------------
export function localAgora(npc, agora = Date.now()) {
  const hora = horaDoDiaAtual(agora).id;
  const r = npc.rotina && npc.rotina[hora];
  return r ? r.local : npc.local;
}

export function atividadeAgora(npc, agora = Date.now()) {
  const hora = horaDoDiaAtual(agora).id;
  const r = npc.rotina && npc.rotina[hora];
  return r ? r.atividade : null;
}

export function npcsPresentesEm(localId, agora = Date.now()) {
  return NPCS_REGIONAIS.filter((n) => localAgora(n, agora) === localId);
}

// --- NPCs secretos (item 32) -----------------------------------------------
export function requisitoAtendido(npc, contexto) {
  const req = npc.requisito;
  if (!req) return true;
  const { personagem, agora = Date.now(), zonaId } = contexto;
  if (req.hora && horaDoDiaAtual(agora).id !== req.hora) return false;
  if (req.clima && (!zonaId || climaAtualDaZona(zonaId, agora).id !== req.clima)) return false;
  if (req.questAtiva && !(personagem && (personagem.missoesAtivas || []).some((m) => m.id === req.questAtiva))) return false;
  if (req.questConcluida && !(personagem && (personagem.missoesConcluidas || []).includes(req.questConcluida))) return false;
  if (req.reputacao && !(personagem && getReputacao(personagem, req.reputacao.faccao) >= req.reputacao.min)) return false;
  if (req.bestiarioMin && !(personagem && Object.keys((personagem.compendio || {}).abates || {}).length >= req.bestiarioMin)) return false;
  if (req.itemId && !(personagem && (personagem.inventario || []).some((i) => i.id === req.itemId))) return false;
  return true;
}

// Quem o jogador PODE encontrar num lugar agora: quem a rotina põe ali, menos
// quem ainda não cumpriu requisito de aparição.
export function npcsVisiveisEm(localId, contexto) {
  return npcsPresentesEm(localId, contexto.agora).filter((n) => requisitoAtendido(n, contexto));
}

// --- NPCs recorrentes (item 11) --------------------------------------------
// A mesma pessoa, com o mesmo id e a mesma memória, aparecendo fora da região
// natal. Nunca uma cópia: se o jogador já conversou com Rowan em Altaverde, o
// Rowan do Deserto de Arenth lembra disso, porque é o mesmo registro no save.
export function recorrentesEm(localId) {
  return NPCS_RECORRENTES.filter((n) => (n.recorrente || []).includes(localId));
}

export function registrarEncontroRecorrente(personagem, npcId, regiaoId) {
  const m = memoriaDoNpc(personagem, npcId);
  if (!Array.isArray(m.regioesEmQueVoceOEncontrou)) m.regioesEmQueVoceOEncontrou = [];
  if (!m.regioesEmQueVoceOEncontrou.includes(regiaoId)) m.regioesEmQueVoceOEncontrou.push(regiaoId);
  return m.regioesEmQueVoceOEncontrou.length;
}

// --- simulação distante (item 10) ------------------------------------------
// Estado lógico de um NPC cuja região não está carregada. É uma leitura de
// dados: sem instância, sem AI, sem pathfinding, sem animação. O custo é o de
// resolver a rotina e a pilha de estados — as duas coisas que a UI precisaria
// saber SE o jogador chegasse lá, e nada além disso.
export function estadoLogico(npcId, contexto) {
  const npc = npcPorId(npcId);
  if (!npc) return null;
  return {
    id: npc.id,
    regiaoId: npc.regiaoId,
    local: localAgora(npc, contexto.agora),
    atividade: atividadeAgora(npc, contexto.agora),
    estado: falaAtual(npc, contexto).id,
    visivel: requisitoAtendido(npc, contexto),
  };
}

// A região inteira, em estado lógico. É o que o jogo consulta ao mostrar o
// Atlas ou ao decidir se uma quest de outra região avançou — nunca ao
// desenhar um quadro.
export function estadoLogicoDaRegiao(regiaoId, contexto) {
  return npcsDaRegiao(regiaoId).map((n) => estadoLogico(n.id, contexto));
}

// --- save ------------------------------------------------------------------
// Só a memória vai para o disco, e só a dos NPCs que o jogador tocou. Um save
// novo não carrega 100 objetos vazios.
export function memoriaParaSave(personagem) {
  const mem = garantirMemoriaNpcs(personagem);
  const out = {};
  Object.entries(mem).forEach(([id, m]) => {
    if (m && (m.conhecido || m.conversas > 0 || m.favor !== 0)) out[id] = m;
  });
  return out;
}

export function carregarMemoriaDoSave(personagem, salvo) {
  personagem.npcs = {};
  if (!salvo || typeof salvo !== "object") return personagem.npcs;
  Object.entries(salvo).forEach(([id, m]) => {
    if (!npcPorId(id)) return; // NPC que não existe mais no conteúdo: descarta em silêncio
    personagem.npcs[id] = { ...(npcPorId(id).estadoInicial || {}), ...m };
  });
  return personagem.npcs;
}
