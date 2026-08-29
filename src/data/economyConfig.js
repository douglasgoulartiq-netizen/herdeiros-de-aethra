// Configuração da economia de invocação (gacha) — "Fragmentos de Aethra".
// Todos os valores ficam centralizados aqui de propósito: para ajustar preços,
// probabilidades ou recompensas basta editar este arquivo, sem mexer no resto
// do código. Os valores abaixo são o cenário "equilibrado", escolhido a partir
// de uma simulação de Monte Carlo com 1.000.000+ jogadores simulados por perfil
// (ver scripts/gacha_sim/relatorio_economia.md para o relatório completo com os
// três cenários — conservador, equilibrado e generoso — e a justificativa).
//
// IMPORTANTE: preço, probabilidades e pity são SEMPRE os mesmos para todo
// mundo — nunca personalizados por jogador.

export const CUSTO_INVOCACAO = 100; // 1 invocação = 100 Fragmentos de Aethra
export const CUSTO_PACOTE_10 = CUSTO_INVOCACAO * 10; // sem desconto — a vantagem é a garantia de raridade embutida

// Chances base por invocação (somam 100%). Usadas sempre que o pity suave/duro
// não estiver sobrescrevendo o resultado.
export const CHANCES_BASE = {
  lendario: 0.007,
  epico: 0.06,
  raro: 0.15,
  incomum: 0.33,
  comum: 0.453,
};

export const ORDEM_RARIDADE = ["comum", "incomum", "raro", "epico", "lendario"];

// Pity suave: a partir da invocação 40 (contando desde a última Lendária),
// a chance de Lendária DESSA invocação é sobrescrita pela curva abaixo.
// Na invocação 50 é garantia total (pity duro).
export const CURVA_PITY_SUAVE = {
  40: 0.08, 41: 0.14, 42: 0.20, 43: 0.27, 44: 0.35, 45: 0.45,
  46: 0.57, 47: 0.70, 48: 0.82, 49: 0.92, 50: 1.0,
};
export const PITY_DURO = 50;
export const PITY_SUAVE_INICIO = 40;

export const GARANTIA_RARO_A_CADA = 10; // toda 10ª invocação garante Raro ou melhor
export const GARANTIA_EPICO_A_CADA = 25; // toda 25ª invocação garante Épico ou melhor

// Banner iniciante: teto fixo de 40 invocações totais, some para sempre depois
// que o jogador atinge o teto. As 10 primeiras são de graça durante o tutorial.
export const BANNER_INICIANTE = {
  TETO_TOTAL: 40,
  GRATIS_NO_INICIO: 10,
  GARANTIA_RARO_ATE: 10,
  GARANTIA_EPICO_ATE: 20,
  GARANTIA_LENDARIO_ATE: 40,
};

// Conversão de duplicatas (task #38): a primeira cópia de um personagem
// sempre o desbloqueia; a partir da 2ª cópia do MESMO personagem, ela vira
// XP aplicado direto NELE (em vez de Fragmentos de Aethra genéricos) — evita
// "perda total" da puxada e, mais importante, faz duplicatas acelerarem
// diretamente o personagem que o jogador já escolheu investir, reforçando a
// escolha em vez de só devolver moeda pra puxar de novo. Escala com a
// raridade na mesma proporção que a antiga VALOR_DUPLICATA tinha.
export const XP_DUPLICATA = {
  comum: 25,
  incomum: 40,
  raro: 70,
  epico: 130,
  lendario: 250,
};

// Personagem em destaque do banner de evento atual (fixo por enquanto — o
// jogo não tem calendário de eventos rotativos, então mantemos um banner de
// evento permanente com este personagem lendário em destaque).
export const EVENTO_FEATURED_ID = "nyxandra_voz_da_tempestade";

// --- Fontes de Fragmentos (distribuição pedida: 30% missões/progressão,
// 20% diário/recorrente, 20% masmorras/desafios, 10% exploração,
// 10% conquistas, 10% eventos) ---
//
// Conteúdo de missões/exploração/conquistas é finito no jogo atual, então
// essas três fontes são bônus ÚNICOS (recebidos uma vez, ao cumprir cada
// coisa), enquanto diário/masmorra/evento são recorrentes para sempre.
// Isso é uma simplificação deliberada e está documentada no relatório da
// simulação — a proporção 30/20/20/10/10/10 vale para as primeiras semanas
// de um jogador ativo, quando todas as seis fontes ainda estão disponíveis.
export const FRAGMENTOS = {
  // Recorrente: desafio diário. Não obriga login diário — o jogador acumula
  // até 7 "cargas" não resgatadas, então nunca perde progresso por faltar um dia.
  DESAFIO_DIARIO_RECOMPENSA: 45,
  DESAFIO_DIARIO_MAX_ACUMULO: 7,
  DESAFIO_DIARIO_INTERVALO_MS: 24 * 60 * 60 * 1000,

  // Recorrente: missão semanal (sempre disponível, reseta a cada 7 dias).
  MISSAO_SEMANAL_RECOMPENSA: 300,
  MISSAO_SEMANAL_INTERVALO_MS: 7 * 24 * 60 * 60 * 1000,

  // Recorrente: masmorras/desafios — recompensa ao derrotar o chefe da masmorra.
  RECOMPENSA_CHEFE_MASMORRA: 150,

  // Recorrente: evento — pequena chance de bônus após vencer uma batalha.
  CHANCE_BONUS_EVENTO_POS_BATALHA: 0.08,
  BONUS_EVENTO_VALOR: 60,

  // Único: recompensa de progressão embutida nas 5 missões principais do jogo
  // (ver quests.json → campo recompensaFragmentos de cada missão).

  // Único: primeira vez que cada baú/nó de coleta é usado (exploração).
  EXPLORACAO_BAU_RECOMPENSA: 40,
  EXPLORACAO_NO_RECOMPENSA: 20,

  // Único: conquistas (marcos de progresso).
  CONQUISTAS: {
    primeira_vitoria: { nome: "Primeira Vitória", valor: 50 },
    nivel_5: { nome: "Nível 5", valor: 80 },
    primeira_missao: { nome: "Primeira Missão Concluída", valor: 40 },
    todas_missoes: { nome: "Todas as Missões Concluídas", valor: 150 },
    masmorra_concluida: { nome: "Explorador da Masmorra", valor: 60 },
    dragao_derrotado: { nome: "Matador de Dragões", valor: 120 },
    colecao_5: { nome: "Colecionador: 5 personagens", valor: 60 },
    colecao_12: { nome: "Colecionador: 12 personagens", valor: 100 },
  },
};

// Renda semanal alvo por perfil (referência da simulação — não é aplicada
// diretamente no código, é usada para calibrar os valores acima).
export const RENDA_SEMANAL_REFERENCIA = {
  casual: { early: 600, steady: 600 },
  ativo: { early: 1000, steady: 800 },
  dedicado: { early: 1400, steady: 1150 },
};
