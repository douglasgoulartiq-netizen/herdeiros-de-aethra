// Conselheiro tático da mão de cards (módulo puro — sem DOM).
//
// Recebe as PREVISÕES de BattleForecast.js e devolve, para cada card, um
// TACTICAL SCORE interno (0-100) com a lista de motivos que o formaram, além
// de um nível de recomendação (1 = boa, 2 = excelente, 3 = oportunidade
// especial) e, no máximo, UM card marcado como "melhor jogada".
//
// Três promessas que este arquivo cumpre e que valem mais que o número em si:
//
//   1. O SCORE NUNCA APARECE PRO JOGADOR (item 2 do pedido). Ele existe pra
//      ordenar decisões, não pra virar planilha. A UI só lê `nivel`,
//      `melhorJogada` e `motivos`.
//   2. O JOGO NUNCA JOGA SOZINHO. Nada aqui executa ação nenhuma; a
//      recomendação é um destaque visual, e o jogador continua clicando no
//      card que quiser — inclusive num card com score baixo.
//   3. NÃO É "MAIOR DPS SEMPRE" (item 45/46). Cura de emergência, defesa que
//      salva, interrupção e quebra de postura entram na MESMA moeda de
//      pontos que dano, então competem de verdade — e ganham quando o
//      contexto pede.
//
// Toda contribuição de pontos é nomeada (`motivos`), então a UI consegue
// responder "por que essa opção é boa?" sem que este módulo precise saber
// nada sobre a tela.

// Níveis de personalidade da recomendação (item 47).
export const NIVEIS_SUGESTAO = ["off", "basico", "completo"];

const LIMIAR_NIVEL_1 = 45;
const LIMIAR_NIVEL_2 = 62;
const LIMIAR_NIVEL_3 = 78;
// Item 67 (foco visual): no máximo 3 cards acesos ao mesmo tempo, e só o
// primeiro recebe a estrela de "melhor jogada".
const MAX_DESTAQUES = 3;

// Arquétipos inimigos cuja morte vale mais do que o HP que eles ainda têm —
// removê-los muda a batalha, não só a barra de vida.
const PESO_ARQUETIPO = {
  suporte: 1.35,
  invocador: 1.3,
  conjurador: 1.2,
  controlador: 1.2,
  ladrao: 1.15,
  defensor: 1.1,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------
// Contexto agregado da batalha — calculado UMA vez por avaliação da mão
// (não por card), porque é o mesmo para todos.
// ---------------------------------------------------------------------
export function montarContextoTatico({ jogador, aliados, inimigosVivos, intencoes, batalha }) {
  const vivos = aliados.filter((c) => c.vivo);
  const aliadoMaisFerido = vivos.length
    ? vivos.reduce((pior, atual) => (atual.hp / atual.hpMax < pior.hp / pior.hpMax ? atual : pior))
    : null;

  // Perigo previsto sobre cada aliado, a partir das intenções conhecidas.
  const perigoPorAliado = new Map();
  let perigoTotal = 0;
  let maiorAmeaca = null;
  if (intencoes) {
    for (const [inimigo, info] of intencoes) {
      if (!inimigo.vivo || !info || !info.plano || !info.plano.alvo) continue;
      const faixa = info.faixa || (batalha ? batalha.estimarDanoIntencao(inimigo, info.plano) : null);
      if (!faixa) continue;
      const atual = perigoPorAliado.get(info.plano.alvo) || 0;
      perigoPorAliado.set(info.plano.alvo, atual + faixa.esperado);
      perigoTotal += faixa.esperado;
      if (!maiorAmeaca || faixa.esperado > maiorAmeaca.faixa.esperado) maiorAmeaca = { inimigo, plano: info.plano, faixa };
    }
  }

  // Alguém do time morre com o que está telegrafado?
  const aliadosEmRiscoDeMorte = vivos.filter((c) => (perigoPorAliado.get(c) || 0) >= c.hp);

  const chefe = inimigosVivos.find((i) => i.chefe) || null;
  const partyEmPerigo = vivos.some((c) => c.hp / c.hpMax <= 0.3) || aliadosEmRiscoDeMorte.length > 0;

  return {
    jogador,
    vivos,
    aliadoMaisFerido,
    perigoPorAliado,
    perigoTotal,
    maiorAmeaca,
    aliadosEmRiscoDeMorte,
    chefe,
    partyEmPerigo,
    hpFracaoJogador: jogador.hpMax ? jogador.hp / jogador.hpMax : 1,
    perigoSobreJogador: perigoPorAliado.get(jogador) || 0,
    inimigosVivos,
  };
}

function pesoDoAlvo(alvo, ctx) {
  if (!alvo) return 1;
  let peso = 1;
  if (alvo.chefe) peso *= 1.5;
  peso *= PESO_ARQUETIPO[alvo.arquetipo] || 1;
  // Um inimigo que está prestes a bater forte em alguém vale mais como alvo.
  const ameaca = ctx.maiorAmeaca && ctx.maiorAmeaca.inimigo === alvo ? ctx.maiorAmeaca.faixa.esperado : 0;
  if (ameaca > 0) peso *= 1 + clamp(ameaca / Math.max(1, ctx.jogador.hpMax), 0, 0.4);
  return peso;
}

// ---------------------------------------------------------------------
// Pontuação de UM card
// ---------------------------------------------------------------------
export function pontuarCard(card, previsao, ctx, extras = {}) {
  const motivos = [];
  const add = (pontos, texto, chave) => {
    if (!pontos) return 0;
    motivos.push({ pontos: Math.round(pontos), texto, chave });
    return pontos;
  };

  if (!previsao.disponivel) {
    return { score: 0, motivos: [], especial: null, indisponivel: true };
  }
  // Fugir nunca é recomendado: encerrar a batalha do time inteiro é uma
  // decisão de jogador, não de conselheiro. O card continua lá, jogável.
  if (card.tipo === "fugir" || card.tipo === "item") {
    return { score: 0, motivos: [], especial: null, naoRecomendavel: true };
  }

  let score = 0;
  let especial = null;
  const alvo = extras.alvo;

  // ---- A. Dano bruto e dano relativo -------------------------------
  const dano = previsao.dano;
  const pAcerto = previsao.chances ? previsao.chances.acerto : 1;
  let danoEfetivo = 0;
  if (dano && !dano.imune) danoEfetivo = dano.esperado * pAcerto;
  if (previsao.area) danoEfetivo = previsao.area.esperado;

  if (danoEfetivo > 0 && alvo) {
    const peso = previsao.area ? 1.2 : pesoDoAlvo(alvo, ctx);
    const alvoHp = previsao.area ? Math.max(1, ctx.inimigosVivos.reduce((s, i) => s + i.hp, 0)) : Math.max(1, alvo.hp);
    // Quanto da vida restante do alvo este golpe leva (satura em 100%).
    score += add(38 * clamp(danoEfetivo / alvoHp, 0, 1) * peso, "leva boa parte da vida restante do alvo", "dano_relativo");
    // Quanto este golpe vale COMPARADO ao resto da mão — é o que impede que
    // todo card fique fraco só porque o chefe tem muito HP.
    const melhor = Math.max(1, extras.melhorDanoEfetivo || 1);
    score += add(24 * clamp(danoEfetivo / melhor, 0, 1), "maior dano disponível agora", "dano_comparativo");
  }

  // ---- B. Execução --------------------------------------------------
  if (previsao.chanceMatar > 0) {
    let pts = 45 * previsao.chanceMatar;
    if (alvo && alvo.chefe) pts += 16 * previsao.chanceMatar;
    if (alvo && PESO_ARQUETIPO[alvo.arquetipo]) pts += 10 * previsao.chanceMatar;
    score += add(pts, previsao.execucao === "garantida" ? "abate o alvo (execução garantida)" : "pode abater o alvo", "execucao");
    if (previsao.execucao === "garantida") especial = especial || "execucao";
  }
  if (previsao.area && previsao.area.abates > 0) {
    score += add(18 * previsao.area.abates, `abate ${previsao.area.abates} inimigo(s) de uma vez`, "execucao_area");
    especial = especial || "execucao";
  }

  // ---- C. Relação elemental ----------------------------------------
  if (dano) {
    if (dano.imune) {
      // Item 8 levado ao extremo correto: um golpe que causa 0 nunca pode
      // ser sugerido, por mais alto que o resto do cálculo tivesse ficado.
      return { score: 0, motivos: [{ pontos: 0, texto: "o alvo é imune a este elemento — 0 de dano", chave: "imune" }], especial: null, desaconselhado: true };
    }
    if (dano.relacaoElemental === "vantagem_intensa") score += add(14, "explora uma fraqueza elemental forte", "fraqueza");
    else if (dano.relacaoElemental === "vantagem") score += add(8, "explora a fraqueza elemental do alvo", "fraqueza");
    else if (dano.relacaoElemental === "resistencia") score += add(-10, "o alvo resiste a este elemento", "resistencia");
    else if (dano.relacaoElemental === "resistencia_intensa") score += add(-18, "o alvo resiste muito a este elemento", "resistencia");
  }

  // ---- D. Reação e combo -------------------------------------------
  if (previsao.reacao) {
    score += add(18, `dispara a reação ${previsao.reacao.nome}`, "reacao");
    especial = especial || "combo";
  }
  if (previsao.combo) {
    score += add(12, `encadeia o combo de equipe ${previsao.combo.nome}`, "combo");
    especial = especial || "combo";
  }

  // ---- E. Ruptura ---------------------------------------------------
  if (previsao.ruptura) {
    if (previsao.ruptura.quebra) {
      score += add(22, "quebra a postura do chefe (ele perde o turno e sofre +35% de dano)", "ruptura_quebra");
      especial = especial || "ruptura";
    } else {
      score += add(10 * clamp(previsao.ruptura.ganho / Math.max(1, previsao.ruptura.restante), 0, 1), "enche a barra de postura do chefe", "ruptura");
    }
  }

  // ---- F. Status aplicado -------------------------------------------
  if (previsao.status) {
    const chance = previsao.status.chance != null ? previsao.status.chance : 1;
    const controla = /congelad/i.test(previsao.status.nome);
    score += add((controla ? 16 : 8) * chance, `aplica ${previsao.status.nome}`, "status");
  }

  // ---- G. Interrupção -----------------------------------------------
  if (previsao.interrompe) {
    let pts = previsao.interrompe.garantida ? 30 : 18;
    const faixa = previsao.interrompe.faixa;
    if (faixa && ctx.jogador.hpMax && faixa.esperado / ctx.jogador.hpMax >= 0.35) pts += 12;
    if (previsao.interrompe.inimigo && previsao.interrompe.inimigo.chefe) pts += 8;
    score += add(pts, `interrompe a ação de ${previsao.interrompe.inimigo.nome}`, "interrupcao");
    especial = especial || "interrupcao";
  }

  // ---- H. Cura ------------------------------------------------------
  if (previsao.cura) {
    const alvoCura = ctx.jogador; // o motor só cura o próprio conjurador
    const deficit = 1 - clamp(alvoCura.hp / Math.max(1, alvoCura.hpMax), 0, 1);
    const efetiva = previsao.cura.efetivaEsperada;
    if (efetiva <= 0) {
      score += add(-20, "vida praticamente cheia — a cura seria desperdiçada", "cura_desperdicada");
    } else {
      score += add(52 * Math.pow(deficit, 1.4), "sua vida está baixa", "cura_deficit");
      score += add(22 * clamp(efetiva / Math.max(1, alvoCura.hpMax), 0, 1), "recupera uma fatia relevante da vida", "cura_valor");
      if (previsao.cura.desperdicada > previsao.cura.esperado * 0.4) {
        score += add(-12, "boa parte da cura passaria do limite de vida", "cura_excesso");
      }
      // Risco de morte no que já está telegrafado (item 46).
      if (ctx.perigoSobreJogador >= alvoCura.hp) {
        score += add(45, "você morre com o golpe que já está anunciado — curar agora evita isso", "cura_salva");
        especial = especial || "salva";
      } else if (deficit >= 0.7) {
        especial = especial || "salva";
      }
      if (previsao.cura.curaReduzida) score += add(-8, "um estado ativo reduz a cura recebida", "cura_reduzida");
    }
  }

  // ---- I. Defesa ----------------------------------------------------
  if (previsao.defesa) {
    if (previsao.defesa.salvaVida) {
      score += add(48, "esta defesa impede um golpe que te derrubaria", "defesa_salva");
      especial = especial || "salva";
    }
    const evitado = previsao.defesa.danoEvitado;
    if (evitado && evitado.esperado > 0) {
      score += add(30 * clamp(evitado.esperado / Math.max(1, ctx.jogador.hp), 0, 1), "reduz bastante o golpe que vem aí", "defesa_valor");
    } else if (ctx.perigoSobreJogador > 0) {
      score += add(10, "há um golpe anunciado contra você", "defesa_contexto");
    } else {
      score += add(-6, "nenhum golpe anunciado contra você agora", "defesa_sem_alvo");
    }
    if (previsao.defesa.tipo === "guarda" && previsao.defesa.chanceBloqueio) {
      score += add(14 * previsao.defesa.chanceBloqueio, `${Math.round(previsao.defesa.chanceBloqueio * 100)}% de bloquear o próximo golpe`, "defesa_bloqueio");
    }
  }

  // ---- J. Buff de ataque --------------------------------------------
  if (previsao.buff) {
    // Só vale a pena quando sobrarão turnos pra descontar o bônus — sem
    // ameaça imediata e com o time inteiro de pé.
    score += add(ctx.partyEmPerigo ? 8 : 26, "prepara um golpe muito mais forte no próximo turno", "buff");
    if (ctx.partyEmPerigo) score += add(-10, "o time está em perigo: preparar um golpe custa um turno agora", "buff_risco");
  }

  // ---- K. Reposicionamento (itens 59-62) ----------------------------
  if (previsao.reposicionamento) {
    const r = previsao.reposicionamento;
    if (r.danoEvitadoEstimado > 0) {
      score += add(34 * clamp(r.danoEvitadoEstimado / Math.max(1, ctx.jogador.hp), 0, 1), "sai da mira do que está anunciado", "posicao_evita");
    }
    if (r.destino === "retaguarda" && ctx.hpFracaoJogador <= 0.35 && r.frenteViva) {
      score += add(26, "vida baixa: a retaguarda te protege enquanto a frente aguenta", "posicao_seguranca");
      especial = especial || "salva";
    }
    if (r.destino === "frente" && !r.frenteViva) {
      score += add(18, "não há mais ninguém segurando a frente — a retaguarda deixou de proteger", "posicao_frente_vazia");
    }
    if (r.destino === "retaguarda" && !r.frenteViva) {
      score += add(-22, "sem aliado de pé na frente, recuar não reduz dano nenhum", "posicao_inutil");
    }
    if (r.danoEvitadoEstimado <= 0 && ctx.perigoSobreJogador <= 0) {
      score += add(-16, "nada mirando em você: trocar de linha só gastaria o turno", "posicao_sem_motivo");
    }
  }

  // ---- L. Custo de recurso ------------------------------------------
  if (card.custoMP > 0 && ctx.jogador.mpMax > 0) {
    score += add(-7 * clamp(card.custoMP / ctx.jogador.mpMax, 0, 1), "consome uma fatia grande do seu Éter", "custo");
  }

  // ---- M. Ultimate: só quando faz sentido (item 57) -----------------
  if (card.ultimate) {
    const janelaDeBurst =
      (alvo && (alvo.chefe || alvo.atordoado)) ||
      previsao.chanceMatar > 0.3 ||
      !!previsao.reacao ||
      (dano && ["vantagem", "vantagem_intensa"].includes(dano.relacaoElemental)) ||
      (previsao.area && previsao.area.quantidade >= 3) ||
      ctx.partyEmPerigo;
    if (!janelaDeBurst) {
      score *= 0.72;
      motivos.push({ pontos: 0, texto: "guardando a habilidade definitiva para uma janela melhor", chave: "ultimate_guardada" });
    } else if (previsao.chanceMatar > 0.3 || (previsao.area && previsao.area.abates > 0)) {
      especial = especial || "ultimate";
    }
  }

  score = clamp(Math.round(score), 0, 100);
  return { score, motivos, especial, indisponivel: false };
}

// ---------------------------------------------------------------------
// Avaliação da mão inteira
// ---------------------------------------------------------------------

// `sugestao`: "off" | "basico" | "completo" (item 47).
// Retorna um Map cardId -> { score, nivel, melhorJogada, motivos, especial }.
export function avaliarMao(cards, previsoes, ctx, { sugestao = "completo", alvo = null } = {}) {
  // Melhor dano efetivo da mão, para a normalização comparativa.
  let melhorDanoEfetivo = 1;
  for (const card of cards) {
    const p = previsoes.get(card.id);
    if (!p || !p.disponivel) continue;
    if (p.area) melhorDanoEfetivo = Math.max(melhorDanoEfetivo, p.area.esperado);
    else if (p.dano && !p.dano.imune) melhorDanoEfetivo = Math.max(melhorDanoEfetivo, p.dano.esperado * (p.chances ? p.chances.acerto : 1));
  }

  const resultados = new Map();
  for (const card of cards) {
    const p = previsoes.get(card.id);
    if (!p) { resultados.set(card.id, { score: 0, nivel: null, melhorJogada: false, motivos: [], especial: null }); continue; }
    const r = pontuarCard(card, p, ctx, { alvo, melhorDanoEfetivo });
    resultados.set(card.id, { ...r, nivel: null, melhorJogada: false });
  }

  if (sugestao === "off") return resultados;

  // Ordena e distribui os destaques.
  const ordenados = [...resultados.entries()]
    .filter(([, r]) => !r.indisponivel && !r.naoRecomendavel && !r.desaconselhado && r.score >= LIMIAR_NIVEL_1)
    .sort((a, b) => b[1].score - a[1].score);

  if (!ordenados.length) return resultados;

  const [topId, top] = ordenados[0];
  let nivelTopo = top.score >= LIMIAR_NIVEL_3 && top.especial ? 3 : top.score >= LIMIAR_NIVEL_2 ? 2 : 1;
  // Uma oportunidade especial muito clara sobe pro nível 3 mesmo com score
  // um pouco menor — é o caso "pode matar o chefe agora" (item 4).
  if (top.especial && ["execucao", "interrupcao", "salva"].includes(top.especial) && top.score >= LIMIAR_NIVEL_2) nivelTopo = 3;

  // BÁSICO só mostra o que é obviamente certo (item 47).
  if (sugestao === "basico" && nivelTopo < 3) return resultados;

  resultados.get(topId).nivel = nivelTopo;
  resultados.get(topId).melhorJogada = true;

  if (sugestao === "completo") {
    let destaques = 1;
    for (const [id, r] of ordenados.slice(1)) {
      if (destaques >= MAX_DESTAQUES) break;
      // Secundários nunca ofuscam o principal: no máximo nível 1, e só se
      // estiverem realmente perto do topo.
      if (r.score >= LIMIAR_NIVEL_2 && r.score >= top.score - 22) {
        resultados.get(id).nivel = 1;
        destaques += 1;
      }
    }
  }

  return resultados;
}

// Dica curta do modo iniciante (item 48) — uma frase, derivada do MESMO
// motivo que mais pesou no card recomendado, sem números.
export function dicaIniciante(resultado, card) {
  if (!resultado || !resultado.motivos || !resultado.motivos.length) return null;
  const principal = [...resultado.motivos].sort((a, b) => b.pontos - a.pontos)[0];
  if (!principal || principal.pontos <= 0) return null;
  return `${card.nome}: ${principal.texto}.`;
}
