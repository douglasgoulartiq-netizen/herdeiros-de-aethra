// Motor de Estados e Reações Elementais (Caminhos do Herdeiro, task #91).
//
// Diferença para o sistema elemental existente (ElementSystem.js/
// COMBOS_ELEMENTAIS em CombatSystem.js): aquele é sempre INSTANTÂNEO — um
// golpe compara o elemento do ataque com o do alvo e pronto, nada fica
// "guardado". Este módulo introduz ESTADOS que ficam no alvo por alguns
// turnos (ver src/data/elementalStates.json) e REAÇÕES que dependem de um
// golpe de um elemento específico acertar um alvo que já está com um desses
// estados ativos (ver src/data/elementalReactions.json) — é o padrão
// "prepara depois detona" descrito no pedido do usuário.
//
// Cada combatente (ver criarCombatenteJogador/criarCombatenteInimigo em
// CombatSystem.js) guarda no máximo UM estado elemental por vez, como uma
// entrada a mais dentro do `statusEffects` já existente, marcada com
// `tipo: "estado_elemental"` — não é preciso nenhum campo novo no objeto
// combatente, e o array `statusEffects` continua sendo filtrado/tickado do
// jeito que sempre foi (ver aplicarStatusTick em CombatSystem.js).
//
// Nenhuma função aqui é chamada em lugar nenhum do jogo ainda — só passa a
// ser usada quando uma habilidade nova declarar `aplicaEstado` (ver
// src/data/talents/*.json, tasks #93/#94) E FLAGS.reacoesElementais estiver
// ligada. Até lá, é código morto por desenho, não por acidente: existe pra
// ser testado e ligado sem precisar reescrever o motor de combate de novo.

export function buscarEstadoDef(estadoId, dadosEstados) {
  if (!estadoId || !dadosEstados || !dadosEstados.estados) return null;
  return dadosEstados.estados.find((e) => e.id === estadoId) || null;
}

export function buscarReacaoAplicavel(estadoAtivoId, elementoAtacante, tipoFisico, dadosReacoes) {
  if (!estadoAtivoId || !dadosReacoes || !dadosReacoes.reacoes) return null;
  return (
    dadosReacoes.reacoes.find((r) => {
      if (r.estadoConsumido !== estadoAtivoId) return false;
      if (r.requerTipoFisico && !tipoFisico) return false;
      if (r.elementoGatilho && r.elementoGatilho !== elementoAtacante) return false;
      return true;
    }) || null
  );
}

// Estado elemental atualmente ativo num combatente (no máximo um por vez —
// ver comentário do módulo). Não muta nada, só lê.
export function estadoElementalAtivo(c) {
  if (!c || !c.statusEffects) return null;
  return c.statusEffects.find((s) => s.tipo === "estado_elemental") || null;
}

// Aplica (ou substitui, se já houvesse um) um estado elemental num alvo.
// `duracaoOverride` permite uma habilidade encurtar/alongar a duração
// padrão do estado (ex.: um talento de "estado mais longo"); sem ela, usa
// `duracaoPadrao` do próprio dado do estado.
export function aplicarEstadoElemental(alvo, estadoId, dadosEstados, duracaoOverride = null) {
  const def = buscarEstadoDef(estadoId, dadosEstados);
  if (!def || !alvo || !alvo.vivo) return null;
  alvo.statusEffects = alvo.statusEffects.filter((s) => s.tipo !== "estado_elemental");
  const entrada = { tipo: "estado_elemental", estadoId: def.id, duracao: duracaoOverride ?? def.duracaoPadrao, def };
  alvo.statusEffects.push(entrada);
  return entrada;
}

export function removerEstadoElemental(alvo) {
  if (!alvo || !alvo.statusEffects) return;
  alvo.statusEffects = alvo.statusEffects.filter((s) => s.tipo !== "estado_elemental");
}

// Multiplicador de dano recebido por causa do estado ativo (ex.: Molhado
// toma mais dano de Geada). Combina o modificador específico do elemento do
// golpe com o modificador geral do estado (ex.: Instável), se houver os
// dois — 1 (neutro) se não houver estado ativo ou ele não mencionar esse
// elemento.
export function modificadorDanoRecebidoEstado(alvo, elementoAtacante) {
  const ativo = estadoElementalAtivo(alvo);
  if (!ativo || !ativo.def) return 1;
  let mult = 1;
  if (ativo.def.modificadorDanoRecebido && elementoAtacante && ativo.def.modificadorDanoRecebido[elementoAtacante] != null) {
    mult *= ativo.def.modificadorDanoRecebido[elementoAtacante];
  }
  if (ativo.def.modificadorDanoRecebidoGeral != null) mult *= ativo.def.modificadorDanoRecebidoGeral;
  return mult;
}

export function modificadorCuraRecebidaEstado(alvo) {
  const ativo = estadoElementalAtivo(alvo);
  if (!ativo || !ativo.def || ativo.def.modificadorCuraRecebida == null) return 1;
  return ativo.def.modificadorCuraRecebida;
}

export function modificadorDefesaEstado(alvo) {
  const ativo = estadoElementalAtivo(alvo);
  if (!ativo || !ativo.def || ativo.def.modificadorDefesa == null) return 1;
  return ativo.def.modificadorDefesa;
}

export function modificadorVelocidadeEstado(alvo) {
  const ativo = estadoElementalAtivo(alvo);
  if (!ativo || !ativo.def || ativo.def.modificadorVelocidade == null) return 1;
  return ativo.def.modificadorVelocidade;
}

// Verdadeiro só quando o estado ativo faz o combatente perder a própria
// ação (hoje, só Congelado) — usado tanto pela IA inimiga (decidirAcao, ver
// CombatSystem.js) quanto pelo turno do jogador (ver BattleUI.js).
export function estaControladoPorEstado(c) {
  const ativo = estadoElementalAtivo(c);
  return !!(ativo && ativo.def && ativo.def.controlaTurno);
}

// Penalidade de d20 aplicada ao PRÓPRIO ataque de quem está com o estado
// ativo (hoje, só Ofuscado/precisao_reduzida) — soma-se à faixa de erro
// total normal (d20 < 4) sem mudar a rolagem em si, então nunca invalida um
// crítico (d20 > 16) já rolado.
export function penalidadeD20Estado(c) {
  const ativo = estadoElementalAtivo(c);
  if (!ativo || !ativo.def || !ativo.def.penalidadeD20) return 0;
  return ativo.def.penalidadeD20;
}

// Verifica (COM efeito colateral: consome o estado do alvo se a reação
// disparar) se o golpe que acabou de acertar acionou uma reação elemental.
// Espelha o padrão de verificarComboElemental/peekComboElemental já usado
// em CombatSystem.js: a versão "verificar" muda estado, a "peek" abaixo não.
//
// Retorna `{ ocorreu: false }` sem reação, ou
// `{ ocorreu: true, reacao, multiplicadorDano }` com uma reação — o chamador
// (CombatSystem.js) decide o que fazer com `reacao.aplicaEstado`,
// `reacao.areaAplicaEstado`, `reacao.propagaDano`, `reacao.garanteCritico` e
// `reacao.ignoraDefesaRestante`.
export function verificarReacaoElemental(alvo, elementoAtacante, tipoFisico, dadosReacoes) {
  const ativo = estadoElementalAtivo(alvo);
  if (!ativo) return { ocorreu: false };
  const reacao = buscarReacaoAplicavel(ativo.estadoId, elementoAtacante, tipoFisico, dadosReacoes);
  if (!reacao) return { ocorreu: false };
  removerEstadoElemental(alvo);
  return { ocorreu: true, reacao, multiplicadorDano: 1 + (reacao.danoBonusPercent || 0) };
}

// Versão só-leitura, para prévia de dano (estimarFaixaDano em
// CombatSystem.js) — nunca consome o estado do alvo.
export function peekReacaoElemental(alvo, elementoAtacante, tipoFisico, dadosReacoes) {
  const ativo = estadoElementalAtivo(alvo);
  if (!ativo) return { ocorreu: false };
  const reacao = buscarReacaoAplicavel(ativo.estadoId, elementoAtacante, tipoFisico, dadosReacoes);
  if (!reacao) return { ocorreu: false };
  return { ocorreu: true, reacao, multiplicadorDano: 1 + (reacao.danoBonusPercent || 0) };
}
