// --- Reforço de monstro solo (task #46) -----------------------------------
// Desde que o time passou a ter até 4 personagens (task #43), uma luta
// contra 1 monstro só ficou raso demais — o grupo inteiro cerca um único
// alvo sem nenhuma pressão de verdade. Quando o sorteio dá exatamente 1
// inimigo, ele entra na batalha reforçado (mais vida, ataque e defesa) pra
// compensar estar em desvantagem numérica de até 4 pra 1 — e a recompensa
// (XP/ouro) sobe junto, proporcional ao reforço, pra continuar valendo a
// pena. Nunca mexe no `monstros.json` original: sempre um clone raso, então
// o mesmo monstro em grupo (2-3) continua com os stats normais.
const SOLO_MULT = { hp: 1.6, atk: 1.25, defesa: 1.15, xp: 1.3, ouro: 1.3 };

export function reforcarMonstroSolo(monstroDef) {
  // Math.ceil (nunca Math.round) em todo campo escalado: com stats baixos
  // de monstro inicial (ex.: defesa 2, ouroMin 1), um multiplicador de 15-
  // 30% arredondado pra baixo vira "+0" na prática — o reforço precisa ser
  // sempre perceptível, mesmo no early game.
  return {
    ...monstroDef,
    hp: Math.ceil(monstroDef.hp * SOLO_MULT.hp),
    atk: Math.ceil(monstroDef.atk * SOLO_MULT.atk),
    defesa: Math.ceil(monstroDef.defesa * SOLO_MULT.defesa),
    xp: Math.ceil(monstroDef.xp * SOLO_MULT.xp),
    ouroMin: Math.ceil(monstroDef.ouroMin * SOLO_MULT.ouro),
    ouroMax: Math.ceil(monstroDef.ouroMax * SOLO_MULT.ouro),
    solo: true, // sinaliza pra UI (ThreatUI/BattleUI) que este é um monstro reforçado
  };
}

// --- Emboscada por reputação regional (melhoria pós-backlog original) ----
// Consequência visível de reputação muito negativa com a facção regional da
// zona (ver WorldStateSystem.js: deveEmboscar) — moradores hostis reforçam
// o encontro aleatório com um atacante extra vindo do mesmo pool da zona.
// Multiplicador mais leve que o reforço de monstro solo (task #46): aqui o
// "reforço" principal já é o número extra de inimigos, o multiplicador só
// dá um empurrão a mais pra sentir que é gente de verdade emboscando, não
// só um bicho a mais no grupo.
const EMBOSCADA_MULT = { hp: 1.15, atk: 1.1, xp: 1.15, ouro: 1.15 };

export function reforcarEmboscada(monstroDef) {
  return {
    ...monstroDef,
    hp: Math.ceil(monstroDef.hp * EMBOSCADA_MULT.hp),
    atk: Math.ceil(monstroDef.atk * EMBOSCADA_MULT.atk),
    xp: Math.ceil(monstroDef.xp * EMBOSCADA_MULT.xp),
    ouroMin: Math.ceil(monstroDef.ouroMin * EMBOSCADA_MULT.ouro),
    ouroMax: Math.ceil(monstroDef.ouroMax * EMBOSCADA_MULT.ouro),
    emboscada: true, // sinaliza pra UI (ThreatUI/BattleUI) que este é um atacante de emboscada
  };
}

// Decide encontros aleatórios ao caminhar em terreno selvagem, e sorteia loot.
export function sortearEncontro(bioma, monstros) {
  const candidatos = monstros.filter((m) => m.bioma.includes(bioma) && !m.chefe);
  if (candidatos.length === 0) return [];
  const qtdInimigos = Math.random() < 0.7 ? 1 : Math.random() < 0.85 ? 2 : 3;
  if (qtdInimigos === 1) return [reforcarMonstroSolo(candidatos[Math.floor(Math.random() * candidatos.length)])];
  const grupo = [];
  for (let i = 0; i < qtdInimigos; i++) {
    grupo.push(candidatos[Math.floor(Math.random() * candidatos.length)]);
  }
  return grupo;
}

export function deveDispararEncontro(chancePorPasso = 0.045) {
  return Math.random() < chancePorPasso;
}

// Como sortearEncontro, mas recebe a lista de monstros já filtrada (usado
// pelo sistema de zonas, onde cada zona já define seu próprio pool).
export function sortearEncontroDeLista(candidatos) {
  const vivos = candidatos.filter((m) => !m.chefe);
  if (vivos.length === 0) return [];
  const qtdInimigos = Math.random() < 0.7 ? 1 : Math.random() < 0.85 ? 2 : 3;
  if (qtdInimigos === 1) return [reforcarMonstroSolo(vivos[Math.floor(Math.random() * vivos.length)])];
  const grupo = [];
  for (let i = 0; i < qtdInimigos; i++) {
    grupo.push(vivos[Math.floor(Math.random() * vivos.length)]);
  }
  return grupo;
}

// --- Hordas de monstros (task #47) ---------------------------------------
// Quando um encontro aleatório dispara, há uma chance pequena dele virar
// uma HORDA: em vez de 1 grupo só, o combate acontece em ondas sucessivas —
// a próxima só aparece depois que a anterior é derrotada por completo (ver
// Batalha.avancarLeva() em CombatSystem.js). O time não recupera HP/MP
// entre levas, então é um desafio de resistência, bem mais puxado que um
// encontro comum — mas o loot/XP final soma TODAS as levas.
export function deveSerHorda(chance = 0.10) {
  return Math.random() < chance;
}

// Sorteia N levas (grupos) a partir do mesmo pool de candidatos da zona —
// cada leva usa a mesma lógica de sortearEncontroDeLista (1-3 inimigos,
// nunca chefes). Levas vazias (pool sem candidatos válidos) são descartadas
// em vez de gerar uma onda "vazia" que pularia direto pra próxima.
export function sortearLevasHorda(candidatos, numLevas = 5) {
  const levas = [];
  for (let i = 0; i < numLevas; i++) {
    const leva = sortearEncontroDeLista(candidatos);
    if (leva.length) levas.push(leva);
  }
  return levas;
}
