// Efeitos sonoros opcionais (item 14/87 de 100_melhorias.md): o jogo nunca
// teve áudio, então este módulo é 100% aditivo — sem ele, nada muda. Usa só
// osciladores da Web Audio API (nenhum arquivo de áudio externo, mantendo o
// projeto sem dependências), e é regido inteiramente por
// AccessibilitySystem.volumeEfeitos() — "desligado" significa que
// nenhuma função aqui produz som nenhum, e nunca lança erro (tudo em
// try/catch): áudio nunca pode travar ou atrasar o combate em si.
import { volumeEfeitos } from "../systems/AccessibilitySystem.js";

let ctx = null;
function contexto() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch (e) {
    return null;
  }
}

// Alguns navegadores exigem um gesto do usuário antes de liberar o áudio —
// chamar isso a partir de qualquer clique/toque já existente (ver main.js)
// é suficiente; se falhar, os efeitos simplesmente continuam mudos.
export function destravarAudio() {
  try {
    const c = contexto();
    if (c && c.state === "suspended") c.resume();
  } catch (e) { /* silencioso de propósito */ }
}

function bipar({ freq = 440, duracaoMs = 90, tipo = "sine", volumeMult = 1, deslizarPara = null, atrasoMs = 0 } = {}) {
  const vol = volumeEfeitos();
  if (vol <= 0) return;
  try {
    const c = contexto();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tipo;
    const inicio = c.currentTime + atrasoMs / 1000;
    const fim = inicio + duracaoMs / 1000;
    osc.frequency.setValueAtTime(freq, inicio);
    if (deslizarPara) osc.frequency.linearRampToValueAtTime(deslizarPara, fim);
    const volFinal = Math.max(0, Math.min(1, vol * volumeMult));
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.setValueAtTime(volFinal, inicio);
    gain.gain.exponentialRampToValueAtTime(0.0001, fim);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(inicio);
    osc.stop(fim + 0.02);
  } catch (e) { /* silencioso de propósito — áudio nunca pode quebrar o jogo */ }
}

export function somDadoTick() { bipar({ freq: 320, duracaoMs: 35, tipo: "square", volumeMult: 0.35 }); }
export function somDadoParou(critico) {
  if (critico) bipar({ freq: 660, duracaoMs: 260, tipo: "triangle", deslizarPara: 990, volumeMult: 0.8 });
  else bipar({ freq: 440, duracaoMs: 140, tipo: "triangle", volumeMult: 0.6 });
}
export function somDano(critico) {
  bipar({ freq: critico ? 180 : 220, duracaoMs: critico ? 220 : 120, tipo: "sawtooth", deslizarPara: critico ? 80 : 140, volumeMult: critico ? 0.8 : 0.5 });
}
export function somCura() { bipar({ freq: 520, duracaoMs: 180, tipo: "sine", deslizarPara: 780, volumeMult: 0.55 }); }
export function somBloqueioOuErro() { bipar({ freq: 200, duracaoMs: 90, tipo: "square", volumeMult: 0.35 }); }

// ---------------------------------------------------------------------
// Sons da mão de cards (item 79 do pedido de melhoria dos cards).
//
// Duas regras deliberadas, porque som de interface cansa muito mais rápido
// que efeito visual:
//   1. Hover é o som MAIS BAIXO e MAIS CURTO do jogo (35ms, 12% do volume) —
//      passar o mouse por 8 cards não pode virar uma escala musical.
//   2. Todos continuam mudos enquanto o volume de efeitos estiver
//      "desligado" (ver volumeEfeitos()).
// ---------------------------------------------------------------------

// Anti-repetição: o mouse atravessa vários cards em milissegundos; sem esta
// janela, o hover viraria um chiado contínuo.
let ultimoHover = 0;
export function somCardHover() {
  const agora = Date.now();
  if (agora - ultimoHover < 70) return;
  ultimoHover = agora;
  bipar({ freq: 880, duracaoMs: 35, tipo: "sine", volumeMult: 0.12 });
}

export function somCardSelecionado() { bipar({ freq: 600, duracaoMs: 90, tipo: "triangle", deslizarPara: 760, volumeMult: 0.4 }); }
export function somCardErro() { bipar({ freq: 150, duracaoMs: 130, tipo: "square", deslizarPara: 110, volumeMult: 0.4 }); }
export function somCombo() { bipar({ freq: 700, duracaoMs: 200, tipo: "triangle", deslizarPara: 1180, volumeMult: 0.5 }); }
export function somUltimatePronta() { bipar({ freq: 330, duracaoMs: 380, tipo: "sawtooth", deslizarPara: 990, volumeMult: 0.45 }); }
export function somCooldownPronto() { bipar({ freq: 990, duracaoMs: 110, tipo: "sine", deslizarPara: 1320, volumeMult: 0.28 }); }
export function somRuptura() { bipar({ freq: 240, duracaoMs: 320, tipo: "sawtooth", deslizarPara: 90, volumeMult: 0.7 }); }

// Vocabulário sonoro compartilhado. São acordes mínimos e curtos, feitos no
// próprio navegador: nenhum download, licença ou atraso de carregamento.
export function somInterfaceAbrir() { bipar({ freq: 430, duracaoMs: 55, tipo: "sine", deslizarPara: 560, volumeMult: 0.18 }); }
export function somInterfaceFechar() { bipar({ freq: 480, duracaoMs: 55, tipo: "sine", deslizarPara: 350, volumeMult: 0.14 }); }
export function somConfirmar() {
  bipar({ freq: 520, duracaoMs: 75, tipo: "triangle", volumeMult: 0.3 });
  bipar({ freq: 720, duracaoMs: 100, tipo: "triangle", volumeMult: 0.26, atrasoMs: 55 });
}
export function somSucesso() {
  bipar({ freq: 440, duracaoMs: 100, tipo: "sine", volumeMult: 0.3 });
  bipar({ freq: 660, duracaoMs: 150, tipo: "triangle", volumeMult: 0.32, atrasoMs: 80 });
}
export function somTesouro(raridade = "comum") {
  const topo = { comum: 720, incomum: 820, raro: 940, epico: 1080, lendario: 1240 }[raridade] || 720;
  [0, 1, 2].forEach((i) => bipar({ freq: topo * (0.55 + i * 0.2), duracaoMs: 170, tipo: "triangle", volumeMult: 0.34, atrasoMs: i * 85 }));
}
export function somNivel() {
  [392, 523, 659, 784].forEach((freq, i) => bipar({ freq, duracaoMs: 210, tipo: "triangle", volumeMult: 0.34, atrasoMs: i * 75 }));
}
export function somTalento() {
  bipar({ freq: 310, duracaoMs: 160, tipo: "sine", deslizarPara: 620, volumeMult: 0.3 });
  bipar({ freq: 930, duracaoMs: 180, tipo: "triangle", volumeMult: 0.25, atrasoMs: 110 });
}
export function somEntradaChefe() {
  bipar({ freq: 105, duracaoMs: 520, tipo: "sawtooth", deslizarPara: 62, volumeMult: 0.42 });
  bipar({ freq: 210, duracaoMs: 330, tipo: "triangle", deslizarPara: 120, volumeMult: 0.26, atrasoMs: 160 });
}
