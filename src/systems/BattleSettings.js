// Preferências da mão de cards de batalha (item 47/49/71/81/99 do pedido).
//
// Ficam num localStorage PRÓPRIO, separado tanto do save de progresso quanto
// da configuração de Acessibilidade — é preferência de leitura da batalha, não
// de personagem nem de acessibilidade geral, e sobrevive a Nova Aventura/NG+.
// Mesmo padrão defensivo de AccessibilitySystem.js: funções puras nunca tocam
// localStorage, tudo cai num padrão válido se o valor guardado for inválido, e
// a ausência de localStorage (Node, modo privado) só faz a preferência valer
// pela sessão.
//
// A relação com Acessibilidade é de "o mais restritivo vence": se o jogador
// marcou "reduzir efeitos" lá, ou o sistema operacional pede
// prefers-reduced-motion, as animações dos cards caem para o modo reduzido
// mesmo que aqui esteja "completa" (ver animacoesReduzidas()).
import { efeitosReduzidos } from "./AccessibilitySystem.js";

const CHAVE = "hda_cards_batalha_v1";

export const SUGESTAO_JOGADA = {
  off: "Desligada",
  basico: "Básica (só o óbvio)",
  completo: "Completa",
};

export const DANO_PREVISTO = {
  off: "Não mostrar",
  faixa: "Faixa (86–112)",
  detalhado: "Detalhado (+ acerto, crítico, ruptura)",
};

export const ANIMACOES_CARDS = {
  completa: "Completas",
  reduzida: "Reduzidas",
};

export const INFO_TATICA = {
  basica: "Básica (ícones e previsões)",
  avancada: "Avançada (explicações escritas)",
};

const PADRAO = {
  sugestaoJogada: "completo",
  danoPrevisto: "faixa",
  animacoes: "completa",
  infoTatica: "basica",
  // Item 48/49: dicas escritas para quem está começando. Ligado por padrão,
  // e a própria dica traz um "não mostrar mais" na tela de configurações.
  modoIniciante: true,
  // Item 71: o d20 aparecia em TODA rolagem. Com isto ligado (padrão), a
  // animação do dado fica reservada para crítico, falha crítica, quebra de
  // postura e mecânicas de chefe — o resto resolve direto.
  dadoSomenteImportante: true,
};

let cache = null;

function disponivel() {
  return typeof localStorage !== "undefined";
}

export function mesclarConfigCards(parcial) {
  const p = parcial || {};
  return {
    sugestaoJogada: p.sugestaoJogada in SUGESTAO_JOGADA ? p.sugestaoJogada : PADRAO.sugestaoJogada,
    danoPrevisto: p.danoPrevisto in DANO_PREVISTO ? p.danoPrevisto : PADRAO.danoPrevisto,
    animacoes: p.animacoes in ANIMACOES_CARDS ? p.animacoes : PADRAO.animacoes,
    infoTatica: p.infoTatica in INFO_TATICA ? p.infoTatica : PADRAO.infoTatica,
    modoIniciante: typeof p.modoIniciante === "boolean" ? p.modoIniciante : PADRAO.modoIniciante,
    dadoSomenteImportante: typeof p.dadoSomenteImportante === "boolean" ? p.dadoSomenteImportante : PADRAO.dadoSomenteImportante,
  };
}

export function configCards() {
  if (cache) return cache;
  if (disponivel()) {
    try {
      const raw = localStorage.getItem(CHAVE);
      cache = raw ? mesclarConfigCards(JSON.parse(raw)) : mesclarConfigCards(null);
    } catch (e) {
      cache = mesclarConfigCards(null);
    }
  } else {
    cache = mesclarConfigCards(null);
  }
  return cache;
}

export function salvarConfigCards(parcial) {
  cache = mesclarConfigCards({ ...configCards(), ...(parcial || {}) });
  if (disponivel()) {
    try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch (e) { /* segue só em memória */ }
  }
  return cache;
}

// Só para testes: zera o cache em memória.
export function _resetarCacheCards() { cache = null; }

// ---- Consultas usadas pela UI ----------------------------------------

export function nivelSugestao() { return configCards().sugestaoJogada; }
export function modoDanoPrevisto() { return configCards().danoPrevisto; }
export function modoInfoTatica() { return configCards().infoTatica; }
export function modoInicianteAtivo() { return configCards().modoIniciante; }
export function dadoSomenteImportante() { return configCards().dadoSomenteImportante; }

// Preferência do sistema operacional. Consultada a cada chamada (e não uma
// vez no boot) porque o jogador pode mudar a configuração do SO com o jogo
// aberto — e porque em Node/JSDOM `matchMedia` pode simplesmente não existir.
export function prefereMenosMovimento() {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

// "O mais restritivo vence": basta UM dos três dizer que sim.
export function animacoesReduzidas() {
  return configCards().animacoes === "reduzida" || prefereMenosMovimento() || efeitosReduzidos();
}
