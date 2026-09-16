// EVENTOS REGIONAIS EM JOGO (ETAPA 3, itens 20, 26, 34 e 40).
//
// Um evento é um estado da região que liga e desliga por condição. Este
// módulo avalia essas condições em TRÊS momentos, e só neles (item 40):
//
//   - o jogador entra numa zona;
//   - o período do dia muda (a cada 4 minutos reais, pelo WeatherSystem);
//   - uma quest regional muda de estado.
//
// Nada aqui roda por quadro, e nada aqui simula região não visitada em tempo
// real: o evento de uma região distante é recalculado quando o jogador
// chega, a partir de dados que não dependem de ter havido alguém lá.
//
// Isso é possível porque toda condição é uma função pura do relógio, do
// World State e das quests — o que também torna o evento reprodutível: dois
// jogadores com o mesmo save e o mesmo minuto veem a mesma região.
import { EVENTOS_REGIONAIS, eventoPorId, CADEIAS_DE_INTERDEPENDENCIA } from "../data/world/regionalEvents.js";
import { MIGRACOES } from "../data/world/ecology.js";
import { QUESTS_REGIONAIS } from "../data/world/regionalQuests.js";
import { climaAtualDaZona, horaDoDiaAtual } from "./WeatherSystem.js";

export function garantirEventos(personagem) {
  if (!personagem.eventosRegionais || typeof personagem.eventosRegionais !== "object") {
    personagem.eventosRegionais = { ativos: [], encerrados: [] };
  }
  const e = personagem.eventosRegionais;
  if (!Array.isArray(e.ativos)) e.ativos = [];
  if (!Array.isArray(e.encerrados)) e.encerrados = [];
  return e;
}

function questFoiConcluida(personagem, id) {
  if (!personagem) return false;
  if ((personagem.missoesConcluidas || []).includes(id)) return true;
  const qr = personagem.questsRegionais || {};
  return qr[id] === "concluida";
}

function questEstaAtiva(personagem, id) {
  if (!personagem) return false;
  if ((personagem.missoesAtivas || []).some((m) => m.id === id)) return true;
  const qr = personagem.questsRegionais || {};
  return qr[id] === "ativa";
}

// O gatilho de um evento. Cada campo presente precisa bater; campo ausente
// não restringe nada.
export function gatilhoAtendido(evento, contexto) {
  const g = evento.gatilho || {};
  const { personagem, worldState = {}, agora = Date.now(), zonaId, visitados = [] } = contexto;

  if (g.requerVisita && !visitados.includes(g.requerVisita)) return false;
  if (g.hora && !g.hora.includes(horaDoDiaAtual(agora).id)) return false;
  if (g.clima) {
    const zonaAlvo = g.zonaClima || zonaId || evento.zonas[0];
    if (!g.clima.includes(climaAtualDaZona(zonaAlvo, agora).id)) return false;
  }
  if (g.questAtiva && !questEstaAtiva(personagem, g.questAtiva)) return false;
  if (g.questConcluida && !questFoiConcluida(personagem, g.questConcluida)) return false;
  if (g.worldState) {
    const bate = Object.entries(g.worldState).every(([k, v]) => worldState[k] === v);
    if (!bate) return false;
  }
  return true;
}

// Um evento encerra quando a condição de encerramento é atendida — e, uma vez
// encerrado por quest, não volta: a quest resolveu o problema, e um problema
// que reaparece sozinho apaga a resolução do jogador.
export function deveEncerrar(evento, contexto) {
  const e = evento.encerraCom;
  if (!e) return false;
  if (e.questConcluida) return questFoiConcluida(contexto.personagem, e.questConcluida);
  if (e.worldState) {
    return Object.entries(e.worldState).every(([k, v]) => (contexto.worldState || {})[k] === v);
  }
  return false;
}

// Reavaliação: liga o que passou a valer, desliga o que deixou de valer, e
// devolve o que mudou para quem chamou poder avisar o jogador.
export function reavaliar(personagem, contexto) {
  const estado = garantirEventos(personagem);
  const abriram = [];
  const fecharam = [];

  EVENTOS_REGIONAIS.forEach((ev) => {
    const ativo = estado.ativos.includes(ev.id);
    const resolvido = estado.encerrados.includes(ev.id);

    if (ativo && deveEncerrar(ev, { ...contexto, personagem })) {
      estado.ativos = estado.ativos.filter((id) => id !== ev.id);
      if (!resolvido) estado.encerrados.push(ev.id);
      fecharam.push(ev);
      return;
    }
    // Evento com encerramento por quest só acontece uma vez. Os outros
    // (caravana, patrulha, chegada de comboio) são cíclicos de propósito.
    if (!ativo && !(resolvido && ev.encerraCom)) {
      if (gatilhoAtendido(ev, { ...contexto, personagem })) {
        estado.ativos.push(ev.id);
        abriram.push(ev);
      }
    } else if (ativo && !ev.encerraCom && !gatilhoAtendido(ev, { ...contexto, personagem })) {
      // Cíclico cuja condição passou (mudou o clima, virou a hora).
      estado.ativos = estado.ativos.filter((id) => id !== ev.id);
      fecharam.push(ev);
    }
  });

  return { abriram, fecharam, ativos: [...estado.ativos] };
}

export function eventosAtivos(personagem) {
  return garantirEventos(personagem).ativos;
}

export function eventosAtivosNaZona(personagem, zonaId) {
  return garantirEventos(personagem).ativos
    .map(eventoPorId).filter((e) => e && e.zonas.includes(zonaId));
}

// O efeito somado dos eventos ativos numa zona — é o que o resto do jogo
// consulta: preço, chance de encontro, rota bloqueada, migração em vigor.
export function efeitosNaZona(personagem, zonaId) {
  const efeitos = {
    precoLoja: 1, encontro: 1, rotasBloqueadas: [], migracoes: [],
    worldState: {}, comercioExtra: false, forjaBonus: false, reputacaoTravada: [],
  };
  eventosAtivosNaZona(personagem, zonaId).forEach((ev) => {
    const a = ev.aplica || {};
    if (typeof a.precoLoja === "number") efeitos.precoLoja *= a.precoLoja;
    if (typeof a.encontroReduzido === "number") efeitos.encontro *= a.encontroReduzido;
    if (typeof a.encontroAumentado === "number") efeitos.encontro *= a.encontroAumentado;
    if (a.rotaBloqueada) efeitos.rotasBloqueadas.push(...a.rotaBloqueada);
    if (a.migracao) efeitos.migracoes.push(a.migracao);
    if (a.worldState) Object.assign(efeitos.worldState, a.worldState);
    if (a.comercioExtra) efeitos.comercioExtra = true;
    if (a.forjaBonus) efeitos.forjaBonus = true;
    if (a.reputacaoTravada) efeitos.reputacaoTravada.push(...a.reputacaoTravada);
  });
  return efeitos;
}

// LEITURA HUMANA DOS EVENTOS ATIVOS (o que faltava para eles existirem na
// tela). `eventosAtivos()` devolve uma lista de IDs — e era ISSO que o painel
// "Como você está" vinha mostrando ao jogador: "Evento em curso:
// ev_tempestade_eter_altaverde". O dado bonito estava todo aqui do lado, em
// `nome` e `aviso`, e ninguém traduzia.
//
// Traduz também o que o evento FAZ. Um evento que encarece a loja em 35% e
// espanta a caça é a explicação de duas coisas que o jogador já notou sem
// entender — o preço que subiu e o bicho que sumiu — e ligar as três é o que
// transforma "o jogo está estranho hoje" em "a região está em crise".
export function resumoDosEventos(personagem, zonaId = null) {
  return garantirEventos(personagem).ativos
    .map(eventoPorId)
    .filter(Boolean)
    .map((ev) => {
      const a = ev.aplica || {};
      const efeitos = [];
      if (typeof a.precoLoja === "number" && a.precoLoja !== 1) {
        const pct = Math.round(Math.abs(a.precoLoja - 1) * 100);
        efeitos.push(a.precoLoja > 1 ? `lojas ${pct}% mais caras` : `lojas ${pct}% mais baratas`);
      }
      if (typeof a.encontroAumentado === "number") efeitos.push(`mais encontros (${Math.round((a.encontroAumentado - 1) * 100)}%)`);
      if (typeof a.encontroReduzido === "number") efeitos.push(`menos encontros (${Math.round((1 - a.encontroReduzido) * 100)}%)`);
      if (a.migracao) {
        // `efeito` da migração é escrito como frase de mundo ("A caça some da
        // mata e se acumula no campo aberto") — é a melhor linha que existe
        // nestes dados e nunca tinha saído do arquivo.
        const m = MIGRACOES.find((x) => x.id === a.migracao);
        efeitos.push(m ? (m.efeito || m.nome) : "a fauna local mudou de lugar");
      }
      if (a.rotaBloqueada) efeitos.push(`rota interrompida (${a.rotaBloqueada.length})`);
      if (a.comercioExtra) efeitos.push("comércio a mais na região");
      if (a.forjaBonus) efeitos.push("a forja rende mais");
      if (a.reputacaoTravada) efeitos.push("reputação travada com uma facção daqui");
      return {
        id: ev.id,
        nome: ev.nome,
        aviso: ev.aviso || "",
        tipo: ev.tipo || "evento",
        regiaoId: ev.regiaoId || null,
        duracao: ev.duracao || "",
        // `aqui` é o que decide se isto merece um aviso no HUD ou só uma
        // linha numa lista: um branqueamento de recife do outro lado do
        // continente é contexto; o mesmo evento na zona em que o jogador
        // está é a razão de a próxima luta estar diferente.
        aqui: !!zonaId && (ev.zonas || []).includes(zonaId),
        efeitos,
      };
    });
}

// Aplica ao World State o que os eventos ativos ditam, e devolve ao normal o
// que os encerrados diziam. Chamado logo depois de reavaliar().
export function aplicarNoWorldState(worldState, resultado) {
  const mudou = {};
  resultado.abriram.forEach((ev) => {
    const ws = (ev.aplica || {}).worldState || {};
    Object.entries(ws).forEach(([k, v]) => { worldState[k] = v; mudou[k] = v; });
  });
  resultado.fecharam.forEach((ev) => {
    const rev = ev.revertePara || {};
    Object.entries(rev).forEach(([k, v]) => {
      if (k === "precoLoja") return;
      worldState[k] = v; mudou[k] = v;
    });
  });
  return mudou;
}

// --- diagnóstico da cadeia (item 34) ---------------------------------------
// Onde o jogador está dentro de cada cadeia de interdependência. Usado pelo
// teste, e serve de base para qualquer painel futuro — sem interface nova
// nesta etapa, que o item 42 pede para não começar redesign.
export function estadoDaCadeia(personagem, worldState, cadeiaId) {
  const cadeia = CADEIAS_DE_INTERDEPENDENCIA.find((c) => c.id === cadeiaId);
  if (!cadeia) return null;
  const estado = garantirEventos(personagem);
  const tocados = new Set([...estado.ativos, ...estado.encerrados]);
  const flags = (personagem.estadoDoMundo && personagem.estadoDoMundo.flags) || {};
  const memoria = personagem.npcs || {};

  // Cada elo é verificado por EVIDÊNCIA deixada no save, não por suposição.
  // Um elo "cumprido" quer dizer: existe no estado do jogador algo que só
  // poderia estar ali se aquele degrau tivesse acontecido de verdade.
  const houveWorldState = (chave) => Object.keys(flags).some((f) => f.startsWith(`ws_${chave}_`));
  const questFeita = (id) => questFoiConcluida(personagem, id);
  // A migração é consequência de um evento ou de uma chave de World State;
  // procura-se a causa dela, e não a migração em si — migração não deixa
  // rastro próprio no save de propósito (ela é recalculada, nunca guardada).
  const houveMigracao = (migId) => {
    const m = MIGRACOES.find((x) => x.id === migId);
    if (!m) return false;
    if (m.causa.tipo === "eventoAtivo") {
      if (tocados.has(m.causa.id)) return true;
      // O evento pode ter passado sem ficar registrado como ativo (o jogador
      // resolveu a linha inteira antes de o clima virar de novo). Uma quest
      // concluída que dispara ou encerra aquele evento é prova de que o
      // degrau existiu — e é prova mais forte que a lista de ativos, que é
      // volátil por natureza.
      return QUESTS_REGIONAIS.some((q) => {
        const c = q.consequencia || {};
        return (c.disparaEvento === m.causa.id || c.encerraEvento === m.causa.id)
          && questFoiConcluida(personagem, q.id);
      });
    }
    if (m.causa.tipo === "worldState") return houveWorldState(m.causa.chave);
    return tocados.size > 0;
  };

  return {
    id: cadeia.id,
    nome: cadeia.nome,
    elos: cadeia.elos.map((e) => {
      let cumprido = false;
      switch (e.passo) {
        case "quest":
        case "resolucao":
          cumprido = questFeita(e.refere); break;
        case "clima":
        case "anomalia":
          // O evento chegou a existir, OU a linha que o encerra foi resolvida
          // (quem resolveu passou por ele necessariamente).
          cumprido = tocados.has(e.refere)
            || (eventoPorId(e.refere)?.encerraCom?.questConcluida
              ? questFeita(eventoPorId(e.refere).encerraCom.questConcluida) : false);
          break;
        case "migracao":
          cumprido = houveMigracao(e.refere); break;
        case "worldState":
        case "estadoFinal":
          cumprido = houveWorldState(e.refere) || worldState[e.refere] !== undefined; break;
        case "npc":
          // O NPC guarda memória de ter passado por esta linha.
          cumprido = !!memoria[e.refere] && Object.keys(memoria[e.refere])
            .some((k) => k.startsWith("soube_de_") || k.startsWith("mudou_por_") || k === "revelado");
          break;
        case "economia":
          // Alguma etapa concluída da cadeia declarou efeito de preço.
          cumprido = cadeia.elos.some((x) => (x.passo === "quest" || x.passo === "resolucao") && questFeita(x.refere));
          break;
        case "faccao":
          cumprido = ((personagem.estadoDoMundo || {}).reputacao || {})[e.refere] !== undefined; break;
        default:
          cumprido = tocados.size > 0;
      }
      return { ...e, cumprido };
    }),
  };
}

// --- save ------------------------------------------------------------------
export function eventosParaSave(personagem) {
  const e = garantirEventos(personagem);
  return { ativos: [...e.ativos], encerrados: [...e.encerrados] };
}

export function carregarEventosDoSave(personagem, salvo) {
  personagem.eventosRegionais = { ativos: [], encerrados: [] };
  if (!salvo || typeof salvo !== "object") return personagem.eventosRegionais;
  const validos = (lista) => (Array.isArray(lista) ? lista.filter(eventoPorId) : []);
  personagem.eventosRegionais.ativos = validos(salvo.ativos);
  personagem.eventosRegionais.encerrados = validos(salvo.encerrados);
  return personagem.eventosRegionais;
}
