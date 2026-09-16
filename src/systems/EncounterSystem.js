import { tamanhoDoGrupo, mediaDoGrupo } from "./EscalaSystem.js";

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
// O tamanho do grupo era fixo: 70% de chance de UM inimigo só, sempre, do
// nível 1 ao 20. Contra um time de quatro isso é 4 contra 1 — o inimigo
// morre antes de agir, e nenhuma quantidade de HP conserta isso. Agora sai
// de `tamanhoDoGrupo` (EscalaSystem.js), que cresce com o nível do herói.
// `nivelHeroi` é opcional: sem ele o comportamento cai na faixa inicial, que
// é conservadora — nunca deixa uma chamada antiga mais difícil por acidente.
export function sortearEncontro(bioma, monstros, nivelHeroi = 1) {
  const candidatos = monstros.filter((m) => m.bioma.includes(bioma) && !m.chefe);
  if (candidatos.length === 0) return [];
  return montarGrupo(candidatos, nivelHeroi);
}

function montarGrupo(candidatos, nivelHeroi) {
  const qtdInimigos = tamanhoDoGrupo(nivelHeroi);
  const sorteia = () => candidatos[Math.floor(Math.random() * candidatos.length)];
  // Um inimigo sozinho continua ganhando o reforço de solo (task #46) — a
  // desvantagem numérica dele não mudou, só ficou mais rara.
  if (qtdInimigos === 1) return [reforcarMonstroSolo(sorteia())];
  const grupo = [];
  for (let i = 0; i < qtdInimigos; i++) grupo.push(sorteia());
  return grupo;
}

// PASSOS DE TRÉGUA depois de uma batalha.
//
// Problema medido dentro da masmorra: com o grupo de inimigos maior (ver
// EscalaSystem.js), 86% dos ticks do modo automático eram gastos com a tela
// de batalha aberta — 443 ticks lá dentro e só 59 casas visitadas. Sair de
// uma luta e cair em outra dois passos depois não é dificuldade: é o jogo
// virar um corredor de batalhas em que explorar fica impossível.
//
// A trégua é o remédio clássico: alguns passos sem sorteio logo depois de
// uma luta. Não deixa o jogo mais fácil (o número de lutas por MINUTO cai,
// o de lutas por SALA não), só devolve ao jogador a chance de andar.
export const PASSOS_DE_TREGUA = 5;

let tregua = 0;
export function iniciarTregua(passos = PASSOS_DE_TREGUA) { tregua = passos; }
export function passosDeTreguaRestantes() { return tregua; }
export function zerarTregua() { tregua = 0; }

// A CHANCE COMPENSA O TAMANHO DO GRUPO.
//
// A chance por passo era fixa (4,5% no mundo, 6% na masmorra) desde quando
// 70% dos encontros eram de UM inimigo. Com grupos de 3 e 4, a mesma chance
// significa três a quatro vezes mais MONSTROS por passo, e foi isso que
// transformou a masmorra em corredor de luta. Dividir pela média do grupo
// mantém constante o que importa — monstros enfrentados por passo — enquanto
// cada luta individual fica maior e mais interessante.
export function chanceAjustadaPeloGrupo(chanceBase, nivelHeroi) {
  const referencia = mediaDoGrupo(1);
  const atual = mediaDoGrupo(nivelHeroi || 1);
  if (!atual) return chanceBase;
  return chanceBase * (referencia / atual);
}

export function deveDispararEncontro(chancePorPasso = 0.045) {
  if (tregua > 0) { tregua -= 1; return false; }
  return Math.random() < chancePorPasso;
}

// Como sortearEncontro, mas recebe a lista de monstros já filtrada (usado
// pelo sistema de zonas, onde cada zona já define seu próprio pool).
export function sortearEncontroDeLista(candidatos, nivelHeroi = 1) {
  const vivos = candidatos.filter((m) => !m.chefe);
  if (vivos.length === 0) return [];
  return montarGrupo(vivos, nivelHeroi);
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
