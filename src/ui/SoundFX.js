// Efeitos sonoros opcionais (item 14/87 de 100_melhorias.md): o jogo nunca
// teve áudio, então este módulo é 100% aditivo — sem ele, nada muda. Usa só
// osciladores da Web Audio API (nenhum arquivo de áudio externo, mantendo o
// projeto sem dependências), e é regido inteiramente por
// AccessibilitySystem.volumeEfeitos() — "desligado" (padrão) significa que
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

function bipar({ freq = 440, duracaoMs = 90, tipo = "sine", volumeMult = 1, deslizarPara = null } = {}) {
  const vol = volumeEfeitos();
  if (vol <= 0) return;
  try {
    const c = contexto();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (deslizarPara) osc.frequency.linearRampToValueAtTime(deslizarPara, c.currentTime + duracaoMs / 1000);
    const volFinal = Math.max(0, Math.min(1, vol * volumeMult));
    gain.gain.setValueAtTime(volFinal, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duracaoMs / 1000);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duracaoMs / 1000 + 0.02);
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
