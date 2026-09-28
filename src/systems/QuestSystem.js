// Controla o progresso, conclusão e rastreamento de missões.
import { multOuroMissao, multXpMissao } from "./IdentidadeSystem.js";
export const VERTENTE_PRINCIPAL = "principal";

export function ehMissaoPrincipal(questDef) {
  return questDef?.vertente === VERTENTE_PRINCIPAL;
}

export function missaoRastreada(personagem, quests = []) {
  if (!personagem) return null;
  const ativas = personagem.missoesAtivas || [];
  if (personagem.rastreamentoMissaoPausado) return null;
  let id = personagem.missaoRastreadaId;
  if (!ativas.some((m) => m.id === id)) {
    id = ativas.find((m) => ehMissaoPrincipal(quests.find((q) => q.id === m.id)))?.id || ativas[0]?.id || null;
    personagem.missaoRastreadaId = id;
  }
  if (!id) return null;
  const estado = ativas.find((m) => m.id === id);
  const def = quests.find((q) => q.id === id);
  return estado && def ? { estado, def } : null;
}

export function rastrearMissao(personagem, questId) {
  if (!personagem || !(personagem.missoesAtivas || []).some((m) => m.id === questId)) return false;
  const desligando = personagem.missaoRastreadaId === questId && !personagem.rastreamentoMissaoPausado;
  personagem.missaoRastreadaId = desligando ? null : questId;
  personagem.rastreamentoMissaoPausado = desligando;
  return true;
}

export function progressoDaMissao(personagem, questDef) {
  const estado = (personagem?.missoesAtivas || []).find((m) => m.id === questDef?.id);
  if (!estado || !questDef) return { atual: 0, meta: questDef?.quantidade || 1, pronto: false };
  const meta = questDef.quantidade || 1;
  // "entregar" conta igual a "coletar": o que importa é ter o pacote na
  // mochila. A diferença das duas está em ONDE a missão fecha — ver
  // entregaImediata() e destinoDeMissao().
  const atual = questDef.tipo === "coletar" || questDef.tipo === "entregar"
    ? (personagem.inventario || []).filter((i) => i.id === questDef.itemAlvo).length
    : estado.progresso || 0;
  return { atual: Math.min(meta, atual), meta, pronto: missaoPronta(personagem, questDef) };
}

export function textoObjetivoMissao(questDef) {
  if (!questDef) return "Objetivo desconhecido";
  if (questDef.objetivoTexto) return questDef.objetivoTexto;
  if (questDef.tipo === "matar") return `Derrote ${questDef.quantidade || 1} × ${String(questDef.alvo || "alvo").replace(/_/g, " ")}.`;
  if (questDef.tipo === "coletar") return `Colete ${questDef.quantidade || 1} × ${String(questDef.itemAlvo || "item").replace(/_/g, " ")}.`;
  if (questDef.tipo === "explorar") return `Vá até ${String(questDef.localAlvo || questDef.regiao || "o destino").replace(/_/g, " ")}.`;
  if (questDef.tipo === "entregar") return `Leve ${String(questDef.itemNome || questDef.itemAlvo || "o pacote").replace(/_/g, " ")} até ${questDef.nomeDestino || "o destinatário"}.`;
  return questDef.descricao || "Continue a investigação.";
}

// A missão rastreada AGORA já está pronta para entregar?
//
// Serve a uma regra só (ver iniciarMissao): o rastreador nunca é arrancado
// de uma missão que está a um passo da recompensa. Usa o catálogo global
// porque `iniciarMissao` não recebe um — e se ele não existir (testes de
// unidade carregam este módulo sozinho), a resposta é "não", que mantém o
// comportamento antigo em vez de quebrar.
function rastreadaEstaPronta(personagem) {
  const id = personagem?.missaoRastreadaId;
  if (!id) return false;
  const catalogo = typeof window !== "undefined" ? window.__QUESTS__ : null;
  const def = Array.isArray(catalogo) ? catalogo.find((q) => q.id === id) : null;
  return def ? missaoPronta(personagem, def) : false;
}

export function iniciarMissao(personagem, questDef) {
  if (personagem.missoesAtivas.some((m) => m.id === questDef.id)) return false;
  if (personagem.missoesConcluidas.includes(questDef.id)) return false;
  personagem.missoesAtivas.push({ id: questDef.id, progresso: 0 });
  // História principal toma o foco ao ser aceita; missões secundárias só
  // entram no rastreador quando não existe nenhuma direção ativa.
  //
  // A EXCEÇÃO: missão pronta para entregar não perde o rastreador. Antes,
  // aceitar uma principal enquanto se voltava para entregar outra fazia a
  // bússola virar no meio do caminho — e, no modo automático, o herói dava
  // meia-volta com a recompensa na mão. Quem terminar a entrega libera o
  // rastreador em concluirMissao(), e a principal assume no passo seguinte.
  const podeAssumir = !personagem.missaoRastreadaId
    || (ehMissaoPrincipal(questDef) && !rastreadaEstaPronta(personagem));
  if (podeAssumir) {
    personagem.missaoRastreadaId = questDef.id;
    personagem.rastreamentoMissaoPausado = false;
  }
  return true;
}

// A missão paga na hora em que o objetivo é cumprido?
//
// Por padrão SIM: a caminhada de volta ao ofertante num mundo 4× é minutos
// entre cumprir o objetivo e sentir que cumpriu, e era a queixa mais direta
// sobre as primeiras horas. Uma missão pode recusar a entrega imediata
// declarando `entregaImediata: false` em quests.json — é a saída para quando
// o reencontro com o ofertante FOR a cena, e não burocracia.
//
// Missões de entrega (`tipo: "entregar"`) nunca pagam sozinhas: o destino é
// justamente chegar a outra pessoa, então antecipar a recompensa apagaria a
// missão inteira.
export function entregaImediata(questDef) {
  if (!questDef) return false;
  if (questDef.tipo === "entregar") return false;
  return questDef.entregaImediata !== false;
}

export function registrarAbate(personagem, monstroId) {
  const eventos = [];
  personagem.missoesAtivas.forEach((m) => {
    const def = window.__QUESTS__.find((q) => q.id === m.id);
    if (def && def.tipo === "matar" && def.alvo === monstroId && m.progresso < def.quantidade) {
      m.progresso += 1;
      eventos.push({ questId: m.id, progresso: m.progresso, meta: def.quantidade });
    }
  });
  return eventos;
}

export function missaoPronta(personagem, questDef) {
  const m = personagem.missoesAtivas.find((x) => x.id === questDef.id);
  if (!m) return false;
  if (questDef.tipo === "matar") return m.progresso >= questDef.quantidade;
  if (questDef.tipo === "coletar" || questDef.tipo === "entregar") {
    const qtd = personagem.inventario.filter((i) => i.id === questDef.itemAlvo).length;
    return qtd >= (questDef.quantidade || 1);
  }
  if (questDef.tipo === "explorar") return m.progresso >= 1;
  return false;
}

export function concluirMissao(personagem, questDef, itemsCatalog) {
  const idx = personagem.missoesAtivas.findIndex((m) => m.id === questDef.id);
  if (idx < 0) return { ok: false };
  if (questDef.tipo === "coletar" || questDef.tipo === "entregar") {
    let restante = questDef.quantidade || 1;
    for (let i = personagem.inventario.length - 1; i >= 0 && restante > 0; i--) {
      if (personagem.inventario[i].id === questDef.itemAlvo) {
        personagem.inventario.splice(i, 1);
        restante -= 1;
      }
    }
  }
  personagem.missoesAtivas.splice(idx, 1);
  personagem.missoesConcluidas.push(questDef.id);
  if (personagem.missaoRastreadaId === questDef.id) personagem.missaoRastreadaId = null;
  // Motivação Legado (+15% de ouro) e interesse Histórias (+10% de XP) —
  // ver IdentidadeSystem.js. Quem chama usa o `ouro`/`xp` devolvidos.
  const ouro = Math.round((questDef.recompensaOuro || 0) * multOuroMissao(personagem));
  const xp = Math.round((questDef.recompensaXP || 0) * multXpMissao(personagem));
  personagem.ouro += ouro;
  const itemRecompensa = itemsCatalog.find((i) => i.id === questDef.recompensaItemId);
  return {
    ok: true, ouro, xp,
    item: itemRecompensa, fragmentos: questDef.recompensaFragmentos || 0,
  };
}

export function marcarExploracao(personagem, localId) {
  personagem.missoesAtivas.forEach((m) => {
    const def = window.__QUESTS__.find((q) => q.id === m.id);
    if (def && def.tipo === "explorar" && def.localAlvo === localId) {
      m.progresso = 1;
    }
  });
}
