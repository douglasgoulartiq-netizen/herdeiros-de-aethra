// ESCALA DE DIFICULDADE POR NÍVEL — motor PURO, sem DOM.
//
// O DIAGNÓSTICO (scripts/medir-dificuldade.mjs, medido, não achado)
// ----------------------------------------------------------------
// Do nível 8 em diante o jogo afrouxa, e não é por causa do dano:
//
//   • O monstro cresce devagar. Do nível 8 ao 17 a vida média sai de 106
//     para 275 (×2,6) — e no nível 9 ela chega a CAIR em relação ao 8.
//     O herói, no mesmo trecho, ganha arma nova, +2 de atributo por nível,
//     passivas de árvore, marcas de classe e passivas de convocado.
//
//   • Pior que isso: 70% dos encontros eram de UM monstro só. Contra um
//     time de quatro, isso é 4 contra 1 — o inimigo morre antes de agir.
//     Nenhuma quantidade de HP conserta desvantagem numérica; ele só
//     demora mais para morrer sem nunca jogar.
//
// A CORREÇÃO, em duas frentes que se somam
// ----------------------------------------
//   1. ESCALA — vida/ataque/defesa crescem a mais a partir do NIVEL_LIMIAR
//      (hoje 6), com teto. É um multiplicador aplicado num ponto só
//      (criarCombatenteInimigo),
//      em vez de reescrever os 66 monstros à mão: assim o balanceamento é um
//      número que dá para medir e mexer, não 200 campos espalhados.
//
//   2. NÚMERO — o tamanho do grupo passa a depender do nível do herói. É a
//      correção que realmente muda a sensação da luta, porque devolve ao
//      inimigo o direito de agir.
//
// CHEFE: continuava sendo um monstro comum com uma flag. Ganha multiplicador
// próprio, e é sobretudo VIDA e DEFESA — o drama de fase quem entrega é o
// BossPhaseSystem; o que faltava era a luta durar o suficiente para as três
// fases acontecerem.

// A partir daqui a curva do monstro passa a ganhar reforço. Ficou em 6 e não
// em 8 (o nível que o jogador apontou) porque o reforço é gradual: começando
// no 8 ele só seria perceptível lá pelo 11.
export const NIVEL_LIMIAR = 6;

// Ganho por nível acima do limiar, e o teto de cada um.
//
// POR QUE O ATAQUE CRESCE MAIS QUE A VIDA (0,09 contra 0,06)
// ---------------------------------------------------------
// A defesa deste jogo SUBTRAI (`dano - defesa × 0,5`), e a armadura do herói
// cresce mais rápido que o ataque do monstro. Medido com o time equipado:
// no nível 8 a defesa era 30 contra ataque 20 — cada golpe inimigo tirava 5
// de HP, e o time aguentava 41 rodadas. Não era falta de vida do monstro:
// era o ataque dele não acompanhar a armadura.
//
// Contra uma defesa que subtrai, multiplicar a VIDA do monstro só alonga a
// luta; quem devolve o perigo é o ATAQUE. Por isso o ataque tem o maior
// ganho e o maior teto dos três.
export const GANHO = { hp: 0.06, atk: 0.09, defesa: 0.05 };
export const TETO = { hp: 1.7, atk: 1.75, defesa: 1.5 };

// Multiplicador de CHEFE, aplicado por cima da escala de nível.
//
// Vida alta e defesa alta; ataque só um pouco. Um chefe que bate 2× mata o
// time por sorteio; um chefe que AGUENTA é um chefe que chega às fases 2 e 3
// e mostra a habilidade assinada dele (ver BossPhaseSystem.js). A tensão vem
// de a luta mudar, não de o dano ser grande.
export const CHEFE = { hp: 2.3, atk: 1.2, defesa: 1.35 };

export function escalaDeNivel(nivelMonstro) {
  const acima = Math.max(0, (nivelMonstro || 1) - NIVEL_LIMIAR);
  return {
    hp: Math.min(TETO.hp, 1 + GANHO.hp * acima),
    atk: Math.min(TETO.atk, 1 + GANHO.atk * acima),
    defesa: Math.min(TETO.defesa, 1 + GANHO.defesa * acima),
  };
}

// A escala completa de um monstro: nível + (se for chefe) o bônus de chefe.
export function escalaDoMonstro(monstroDef) {
  const base = escalaDeNivel(monstroDef && monstroDef.nivel);
  if (!monstroDef || !monstroDef.chefe) return base;
  return { hp: base.hp * CHEFE.hp, atk: base.atk * CHEFE.atk, defesa: base.defesa * CHEFE.defesa };
}

// --- Tamanho do grupo -----------------------------------------------------
//
// Faixas de nível do HERÓI (não do monstro): é a economia de ações do time
// dele que decide se a luta tem pressão. Cada faixa é uma lista de pesos —
// pesos[i] é a chance relativa de o encontro ter (i+1) inimigos.
//
// Leitura rápida da tabela: no começo o jogo continua ensinando com lutas de
// 1 e 2. A partir do nível 9 o encontro de UM inimigo só praticamente some,
// e a partir do 13 o normal passa a ser 3.
export const FAIXAS_DE_GRUPO = [
  { ate: 4, pesos: [55, 33, 12, 0, 0] },
  { ate: 8, pesos: [30, 40, 25, 5, 0] },
  { ate: 12, pesos: [10, 32, 38, 18, 2] },
  { ate: 16, pesos: [4, 22, 38, 28, 8] },
  { ate: Infinity, pesos: [0, 14, 34, 34, 18] },
];

export function pesosDeGrupo(nivelHeroi) {
  const nv = nivelHeroi || 1;
  return (FAIXAS_DE_GRUPO.find((f) => nv <= f.ate) || FAIXAS_DE_GRUPO[FAIXAS_DE_GRUPO.length - 1]).pesos;
}

// `sorteio` é injetável para o teste poder fixar o resultado em vez de
// rodar mil vezes e torcer pela média.
export function tamanhoDoGrupo(nivelHeroi, sorteio = Math.random) {
  const pesos = pesosDeGrupo(nivelHeroi);
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = sorteio() * total;
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

// Quantos inimigos, em média, um encontro tem naquele nível. Só para
// relatório e teste — nada de jogo depende disto.
export function mediaDoGrupo(nivelHeroi) {
  const pesos = pesosDeGrupo(nivelHeroi);
  const total = pesos.reduce((a, b) => a + b, 0);
  return pesos.reduce((soma, p, i) => soma + p * (i + 1), 0) / total;
}
