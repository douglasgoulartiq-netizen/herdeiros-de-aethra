// Sistema de invocação (gacha): banners, pity suave/duro, garantias de
// raridade e a mecânica de personagem em destaque do banner de evento.
// As regras (probabilidades, pity, garantias) são sempre as mesmas para
// todo mundo — nunca personalizadas por jogador. Todos os números vêm de
// src/data/economyConfig.js.
import {
  CHANCES_BASE, ORDEM_RARIDADE, CURVA_PITY_SUAVE, PITY_DURO, PITY_SUAVE_INICIO,
  GARANTIA_RARO_A_CADA, GARANTIA_EPICO_A_CADA, BANNER_INICIANTE, EVENTO_FEATURED_ID,
  CUSTO_INVOCACAO,
} from "../data/economyConfig.js";
import { xpParaNivel, ganharXP, aplicarCrescimento } from "./CharacterFactory.js";
import { FRAGMENTOS, XP_DUPLICATA } from "../data/economyConfig.js";

// Time completo = personagem principal (sempre presente) + até
// MAX_CONVOCADOS_GACHA convocados do gacha (era 2, agora 3 — time de até 4
// no total, ver task #43 do backlog e FormationSystem.js pra posicionamento).
export const MAX_CONVOCADOS_GACHA = 3;

// O CUSTO DE ÉTER TEM QUE CABER NO ÉTER DO DONO.
//
// Bug medido: 39 das 215 habilidades com custo (18%) custavam MAIS Éter do
// que o máximo do próprio convocado — "Rhaska Ruído da Tormenta" tem 13 de
// Éter e três habilidades de 14, 19 e 24. Elas apareciam na tela, entravam
// na mão de cards e devolviam "não tem mana suficiente" para sempre. Uma
// habilidade que NUNCA pode ser usada é pior que não existir: ocupa um slot
// da mão e mente para o jogador.
//
// O gerador de habilidades (scripts/gerar-habilidades-gacha.mjs) escala o
// custo pela raridade e pelo molde, sem saber o Éter de quem vai receber —
// e não tem como saber, porque o Éter vem do roster. O único lugar onde os
// dois números existem juntos é aqui, na hora de instanciar o convocado.
//
// O teto é 70% do Éter máximo: a habilidade cara continua sendo um recurso
// escasso (dá para usar uma vez com o Éter cheio, não para repetir), mas
// deixa de ser impossível.
export const FRACAO_MAXIMA_DE_ETER = 0.7;

export function cabeNoEter(habilidade, mpMax) {
  const custo = habilidade.custoMP || 0;
  const teto = Math.max(1, Math.floor((mpMax || 0) * FRACAO_MAXIMA_DE_ETER));
  if (custo <= teto) return habilidade;
  return { ...habilidade, custoMP: teto, custoOriginal: custo };
}

export function estadoGachaInicial() {
  return {
    fragmentos: 0,
    pity: {
      permanente: { desdeUltimoLendario: 0, contadorRaro: 0, contadorEpico: 0 },
      evento: { desdeUltimoLendario: 0, contadorRaro: 0, contadorEpico: 0, garantiaFeaturedPendente: false },
    },
    beginner: { pullsUsados: 0, gratisRestantes: BANNER_INICIANTE.GRATIS_NO_INICIO, melhorRaridadeIdx: -1, concluido: false },
    personagensObtidos: [],
    duplicatas: {}, // rosterId -> contagem de cópias extras já convertidas
    // Histórico das últimas invocações, mais recente por último — usado pelo
    // Compêndio (task #37, ver CompendiumSystem.js/CompendiumUI.js) pra
    // mostrar um log de puxadas. Limitado em HISTORICO_INVOCACOES_MAX pra
    // não crescer sem limite no save.
    historicoInvocacoes: [],
    timeAtivo: [],
    conquistas: [],
    ultimoDesafioDiarioClaim: null,
    desafiosDiariosAcumulados: 1,
    ultimaMissaoSemanalClaim: null,
  };
}

function garantirEstadoGacha(personagem) {
  if (!personagem.gacha) personagem.gacha = estadoGachaInicial();
  return personagem.gacha;
}

function idxRaridade(r) {
  return ORDEM_RARIDADE.indexOf(r);
}

function rolarRaridadeBase(chanceLendarioOverride) {
  const pLeg = chanceLendarioOverride ?? CHANCES_BASE.lendario;
  if (Math.random() < pLeg) return "lendario";
  const resto = { epico: CHANCES_BASE.epico, raro: CHANCES_BASE.raro, incomum: CHANCES_BASE.incomum, comum: CHANCES_BASE.comum };
  const total = Object.values(resto).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rar, peso] of Object.entries(resto)) {
    if (r < peso) return rar;
    r -= peso;
  }
  return "comum";
}

// Executa uma invocação em uma categoria de pity ("permanente" ou "evento")
// e devolve a raridade sorteada, já aplicando pity suave/duro e as garantias
// de raro/épico a cada N invocações.
function rolarComPity(pityState) {
  pityState.desdeUltimoLendario += 1;
  pityState.contadorRaro += 1;
  pityState.contadorEpico += 1;

  let raridade;
  const n = pityState.desdeUltimoLendario;
  if (n >= PITY_DURO) {
    raridade = "lendario";
  } else if (n >= PITY_SUAVE_INICIO) {
    raridade = rolarRaridadeBase(CURVA_PITY_SUAVE[n] ?? 1);
  } else {
    raridade = rolarRaridadeBase();
  }

  if (pityState.contadorEpico >= GARANTIA_EPICO_A_CADA && idxRaridade(raridade) < idxRaridade("epico")) {
    raridade = "epico";
  } else if (pityState.contadorRaro >= GARANTIA_RARO_A_CADA && idxRaridade(raridade) < idxRaridade("raro")) {
    raridade = "raro";
  }

  if (raridade === "lendario") pityState.desdeUltimoLendario = 0;
  if (idxRaridade(raridade) >= idxRaridade("raro")) pityState.contadorRaro = 0;
  if (idxRaridade(raridade) >= idxRaridade("epico")) pityState.contadorEpico = 0;

  return raridade;
}

// Se o roster não tiver ninguém na raridade sorteada (roster incompleto ou
// de teste), cai para a raridade mais próxima disponível em vez de quebrar.
function personagemAleatorioDaRaridade(roster, raridade) {
  let opcoes = roster.filter((p) => p.raridade === raridade);
  if (!opcoes.length) {
    const ordenadoPorProximidade = [...ORDEM_RARIDADE].sort(
      (a, b) => Math.abs(idxRaridade(a) - idxRaridade(raridade)) - Math.abs(idxRaridade(b) - idxRaridade(raridade))
    );
    for (const r of ordenadoPorProximidade) {
      opcoes = roster.filter((p) => p.raridade === r);
      if (opcoes.length) break;
    }
  }
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

// Cria a instância "jogável" de um personagem de gacha a partir da definição
// do roster — formato compatível com o usado pelo CharacterFactory (nivel,
// xp, atributos, hp/mp, equipamento vazio) para poder entrar em batalha e
// evoluir junto com o time.
export function instanciarPersonagemGacha(defRoster) {
  return {
    uid: "gacha_" + Math.random().toString(36).slice(2, 10),
    rosterId: defRoster.id,
    nome: defRoster.nome,
    raridade: defRoster.raridade,
    racaId: defRoster.racaId,
    classeId: defRoster.classeId,
    facaoId: defRoster.facaoId || null, // task #44: região/facção de origem
    descricao: defRoster.descricao,
    nivel: 1,
    xp: 0,
    xpProximo: xpParaNivel(1),
    atributos: { ...defRoster.atributos },
    hpMax: defRoster.hpMax,
    hp: defRoster.hpMax,
    mpMax: defRoster.mpMax,
    mp: defRoster.mpMax,
    equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
    // A habilidade "de sempre" MAIS as exclusivas do personagem. As
    // exclusivas são geradas por scripts/gerar-habilidades-gacha.mjs a
    // partir da classe, do elemento e da RARIDADE — comum tem 1, lendário
    // tem 3 ativas e 2 passivas. É o que faz puxar um lendário significar
    // algo além de números maiores.
    habilidades: [
      { ...defRoster.habilidade, cooldownAtual: 0 },
      ...(defRoster.habilidadesExclusivas || []).map((h) => ({ ...h, cooldownAtual: 0 })),
    ].map((h) => cabeNoEter(h, defRoster.mpMax)),
    // Passivas não entram na mão de cards: valem o tempo todo, sem gastar
    // turno (ver PassiveSystem.js). Guardadas na instância para o save
    // levá-las junto.
    passivas: (defRoster.passivas || []).map((pa) => ({ ...pa })),
    spriteKey: `gacha_${defRoster.id}`,
    ehGacha: true,
  };
}

const HISTORICO_INVOCACOES_MAX = 100;

// Compêndio (task #37): anexa uma entrada compacta ao log de invocações do
// jogador. Só este arquivo escreve em historicoInvocacoes — CompendiumSystem.js
// apenas lê. Corta o histórico mais antigo além do teto pra não inflar o save.
function registrarHistoricoInvocacao(personagem, defRoster, banner, duplicata, featured) {
  const g = garantirEstadoGacha(personagem);
  g.historicoInvocacoes.push({
    rosterId: defRoster.id,
    nome: defRoster.nome,
    raridade: defRoster.raridade,
    banner,
    duplicata,
    featured: !!featured,
    data: Date.now(),
  });
  if (g.historicoInvocacoes.length > HISTORICO_INVOCACOES_MAX) {
    g.historicoInvocacoes.splice(0, g.historicoInvocacoes.length - HISTORICO_INVOCACOES_MAX);
  }
}

// Se o jogador já possui esse personagem, a nova cópia é convertida em XP
// (task #38) aplicado direto na instância já possuída, em vez de virar uma
// segunda unidade solta ou Fragmentos genéricos. `dados` é opcional — sem
// ele o XP ainda é somado, só não recalcula atributos/HP/MP de quem subiu
// de nível nesse momento (mesma regra frouxa que despertar() usa).
function registrarObtido(personagem, defRoster, banner = "?", featured = false, dados = null) {
  const g = garantirEstadoGacha(personagem);
  const instanciaExistente = g.personagensObtidos.find((p) => p.rosterId === defRoster.id);
  if (instanciaExistente) {
    g.duplicatas[defRoster.id] = (g.duplicatas[defRoster.id] || 0) + 1;
    const valorXP = XP_DUPLICATA[defRoster.raridade] || 0;
    let subiuNivel = [];
    if (valorXP > 0) {
      const r = ganharXP(instanciaExistente, valorXP);
      subiuNivel = r.subiuNivel;
      if (dados) subiuNivel.forEach(() => aplicarCrescimento(instanciaExistente, dados));
    }
    registrarHistoricoInvocacao(personagem, defRoster, banner, true, featured);
    return { duplicata: true, xpConvertido: valorXP, subiuNivel, instancia: instanciaExistente };
  }
  const instancia = instanciarPersonagemGacha(defRoster);
  g.personagensObtidos.push(instancia);
  if (g.timeAtivo.length < MAX_CONVOCADOS_GACHA) g.timeAtivo.push(instancia.uid);
  registrarHistoricoInvocacao(personagem, defRoster, banner, false, featured);
  return { duplicata: false, instancia };
}

export function invocarPermanente(personagem, roster, dados = null) {
  const g = garantirEstadoGacha(personagem);
  if (g.fragmentos < CUSTO_INVOCACAO) return { ok: false, motivo: "sem_fragmentos" };
  g.fragmentos -= CUSTO_INVOCACAO;
  const raridade = rolarComPity(g.pity.permanente);
  const def = personagemAleatorioDaRaridade(roster, raridade);
  const r = registrarObtido(personagem, def, "permanente", false, dados);
  return { ok: true, raridade, def, instancia: r.instancia, duplicata: r.duplicata, xpConvertido: r.xpConvertido, subiuNivelDuplicata: r.subiuNivel, featured: false };
}

export function invocarEvento(personagem, roster, dados = null) {
  const g = garantirEstadoGacha(personagem);
  if (g.fragmentos < CUSTO_INVOCACAO) return { ok: false, motivo: "sem_fragmentos" };
  g.fragmentos -= CUSTO_INVOCACAO;
  const raridade = rolarComPity(g.pity.evento);
  let def, featured = false;
  if (raridade === "lendario") {
    const featuredDef = roster.find((p) => p.id === EVENTO_FEATURED_ID);
    if (g.pity.evento.garantiaFeaturedPendente) {
      g.pity.evento.garantiaFeaturedPendente = false;
      def = featuredDef;
      featured = true;
    } else if (Math.random() < 0.5) {
      def = featuredDef;
      featured = true;
    } else {
      def = personagemAleatorioDaRaridade(roster, "lendario");
      g.pity.evento.garantiaFeaturedPendente = true;
    }
  } else {
    def = personagemAleatorioDaRaridade(roster, raridade);
  }
  const r = registrarObtido(personagem, def, "evento", featured, dados);
  return { ok: true, raridade, def, instancia: r.instancia, duplicata: r.duplicata, xpConvertido: r.xpConvertido, subiuNivelDuplicata: r.subiuNivel, featured };
}

export function invocarIniciante(personagem, roster, dados = null) {
  const g = garantirEstadoGacha(personagem);
  if (g.beginner.concluido || g.beginner.pullsUsados >= BANNER_INICIANTE.TETO_TOTAL) {
    return { ok: false, motivo: "banner_esgotado" };
  }
  const gratis = g.beginner.gratisRestantes > 0;
  if (!gratis && g.fragmentos < CUSTO_INVOCACAO) return { ok: false, motivo: "sem_fragmentos" };
  if (gratis) g.beginner.gratisRestantes -= 1;
  else g.fragmentos -= CUSTO_INVOCACAO;

  g.beginner.pullsUsados += 1;
  const n = g.beginner.pullsUsados;
  let raridade = rolarRaridadeBase();

  if (n >= BANNER_INICIANTE.GARANTIA_LENDARIO_ATE && g.beginner.melhorRaridadeIdx < idxRaridade("lendario")) {
    raridade = "lendario";
  } else if (n >= BANNER_INICIANTE.GARANTIA_EPICO_ATE && g.beginner.melhorRaridadeIdx < idxRaridade("epico") && idxRaridade(raridade) < idxRaridade("epico")) {
    raridade = "epico";
  } else if (n >= BANNER_INICIANTE.GARANTIA_RARO_ATE && g.beginner.melhorRaridadeIdx < idxRaridade("raro") && idxRaridade(raridade) < idxRaridade("raro")) {
    raridade = "raro";
  }
  if (idxRaridade(raridade) > g.beginner.melhorRaridadeIdx) g.beginner.melhorRaridadeIdx = idxRaridade(raridade);

  const def = personagemAleatorioDaRaridade(roster, raridade);
  const r = registrarObtido(personagem, def, "iniciante", false, dados);
  if (g.beginner.pullsUsados >= BANNER_INICIANTE.TETO_TOTAL) g.beginner.concluido = true;
  return { ok: true, raridade, def, instancia: r.instancia, duplicata: r.duplicata, xpConvertido: r.xpConvertido, subiuNivelDuplicata: r.subiuNivel, featured: false };
}

export function definirTimeAtivo(personagem, uids) {
  const g = garantirEstadoGacha(personagem);
  g.timeAtivo = uids.slice(0, MAX_CONVOCADOS_GACHA).filter((uid) => g.personagensObtidos.some((p) => p.uid === uid));
}

export function membrosDoTime(personagem) {
  const g = garantirEstadoGacha(personagem);
  return g.timeAtivo
    .map((uid) => g.personagensObtidos.find((p) => p.uid === uid))
    .filter(Boolean)
    .slice(0, MAX_CONVOCADOS_GACHA);
}

export function adicionarFragmentos(personagem, valor) {
  const g = garantirEstadoGacha(personagem);
  g.fragmentos += Math.max(0, Math.round(valor));
  return g.fragmentos;
}

// Conquistas: marcos de progresso que pagam Fragmentos uma única vez cada.
// `condicoes` é um objeto com os sinais atuais do jogo (ver checarConquistas
// nas chamadas em main.js/BattleUI.js) usado para decidir quais conquistas
// acabaram de ser cumpridas.
export function checarConquistas(personagem, eventosAgora = {}) {
  const g = garantirEstadoGacha(personagem);
  const novas = [];
  const tentar = (id, cumprida) => {
    if (cumprida && !g.conquistas.includes(id)) {
      g.conquistas.push(id);
      const def = FRAGMENTOS.CONQUISTAS[id];
      if (def) {
        adicionarFragmentos(personagem, def.valor);
        novas.push({ id, ...def });
      }
    }
  };
  if (eventosAgora.venceuBatalha) tentar("primeira_vitoria", true);
  tentar("nivel_5", personagem.nivel >= 5);
  tentar("primeira_missao", personagem.missoesConcluidas.length >= 1);
  tentar("todas_missoes", personagem.missoesConcluidas.length >= 5);
  if (eventosAgora.explorouMasmorra) tentar("masmorra_concluida", true);
  if (eventosAgora.derrotouDragao) tentar("dragao_derrotado", true);
  tentar("colecao_5", g.personagensObtidos.length >= 5);
  tentar("colecao_12", g.personagensObtidos.length >= 12);
  return novas;
}

// Desafio diário: acumula até um teto sem exigir login todo dia. Chamar ao
// abrir a tela de gacha/HUD para atualizar o número de "cargas" disponíveis.
export function atualizarDesafioDiario(personagem) {
  const g = garantirEstadoGacha(personagem);
  const agora = Date.now();
  if (!g.ultimoDesafioDiarioClaim) {
    g.ultimoDesafioDiarioClaim = agora;
    return g;
  }
  const decorrido = agora - g.ultimoDesafioDiarioClaim;
  const ciclos = Math.floor(decorrido / FRAGMENTOS.DESAFIO_DIARIO_INTERVALO_MS);
  if (ciclos > 0) {
    g.desafiosDiariosAcumulados = Math.min(
      FRAGMENTOS.DESAFIO_DIARIO_MAX_ACUMULO,
      g.desafiosDiariosAcumulados + ciclos
    );
    g.ultimoDesafioDiarioClaim = agora;
  }
  return g;
}

export function resgatarDesafioDiario(personagem) {
  const g = garantirEstadoGacha(personagem);
  atualizarDesafioDiario(personagem);
  if (g.desafiosDiariosAcumulados <= 0) return { ok: false };
  g.desafiosDiariosAcumulados -= 1;
  adicionarFragmentos(personagem, FRAGMENTOS.DESAFIO_DIARIO_RECOMPENSA);
  return { ok: true, valor: FRAGMENTOS.DESAFIO_DIARIO_RECOMPENSA };
}

export function podeResgatarMissaoSemanal(personagem) {
  const g = garantirEstadoGacha(personagem);
  if (!g.ultimaMissaoSemanalClaim) return true;
  return Date.now() - g.ultimaMissaoSemanalClaim >= FRAGMENTOS.MISSAO_SEMANAL_INTERVALO_MS;
}

export function resgatarMissaoSemanal(personagem) {
  const g = garantirEstadoGacha(personagem);
  if (!podeResgatarMissaoSemanal(personagem)) return { ok: false };
  g.ultimaMissaoSemanalClaim = Date.now();
  adicionarFragmentos(personagem, FRAGMENTOS.MISSAO_SEMANAL_RECOMPENSA);
  return { ok: true, valor: FRAGMENTOS.MISSAO_SEMANAL_RECOMPENSA };
}
