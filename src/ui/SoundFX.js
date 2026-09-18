// Efeitos sonoros opcionais (item 14/87 de 100_melhorias.md): o jogo nunca
// teve áudio, então este módulo é 100% aditivo — sem ele, nada muda. Usa só
// osciladores da Web Audio API (nenhum arquivo de áudio externo, mantendo o
// projeto sem dependências), e é regido inteiramente por
// AccessibilitySystem.volumeEfeitos() — "desligado" significa que
// nenhuma função aqui produz som nenhum, e nunca lança erro (tudo em
// try/catch): áudio nunca pode travar ou atrasar o combate em si.
import { volumeEfeitos, efeitosReduzidos } from "../systems/AccessibilitySystem.js";

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

function bipar({ freq = 440, duracaoMs = 90, tipo = "sine", volumeMult = 1, deslizarPara = null, atrasoMs = 0 } = {}, volume = null) {
  const vol = volume ?? volumeEfeitos();
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

// Um gesto deve produzir no máximo UM evento sonoro semântico, mesmo quando
// o timbre usa duas ou três notas. No modo de efeitos reduzidos, a primeira
// nota já transmite a informação e acordes/atrasos são omitidos.
function tocarEvento(nome, tons) {
  const vol = volumeEfeitos();
  if (vol <= 0) return;
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent("hda:som", { detail: { nome } }));
    }
  } catch (e) { /* observabilidade nunca pode interromper a interface */ }
  const sequencia = efeitosReduzidos() ? tons.slice(0, 1) : tons;
  sequencia.forEach((tom) => bipar(tom, vol));
}

export function somDadoTick() { tocarEvento("dado_tick", [{ freq: 320, duracaoMs: 35, tipo: "square", volumeMult: 0.35 }]); }
export function somDadoParou(critico) {
  tocarEvento(critico ? "dado_critico" : "dado_parou", [critico
    ? { freq: 660, duracaoMs: 260, tipo: "triangle", deslizarPara: 990, volumeMult: 0.8 }
    : { freq: 440, duracaoMs: 140, tipo: "triangle", volumeMult: 0.6 }]);
}
export function somDano(critico) {
  tocarEvento(critico ? "dano_critico" : "dano", [{ freq: critico ? 180 : 220, duracaoMs: critico ? 220 : 120, tipo: "sawtooth", deslizarPara: critico ? 80 : 140, volumeMult: critico ? 0.8 : 0.5 }]);
}
export function somCura() { tocarEvento("cura", [{ freq: 520, duracaoMs: 180, tipo: "sine", deslizarPara: 780, volumeMult: 0.55 }]); }
export function somBloqueioOuErro() { tocarEvento("erro", [{ freq: 200, duracaoMs: 90, tipo: "square", volumeMult: 0.35 }]); }

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
  tocarEvento("card_hover", [{ freq: 880, duracaoMs: 35, tipo: "sine", volumeMult: 0.12 }]);
}

export function somCardSelecionado() { tocarEvento("card_selecionado", [{ freq: 600, duracaoMs: 90, tipo: "triangle", deslizarPara: 760, volumeMult: 0.4 }]); }
export function somCardErro() { tocarEvento("card_erro", [{ freq: 150, duracaoMs: 130, tipo: "square", deslizarPara: 110, volumeMult: 0.4 }]); }
export function somCombo() { tocarEvento("combo", [{ freq: 700, duracaoMs: 200, tipo: "triangle", deslizarPara: 1180, volumeMult: 0.5 }]); }
export function somUltimatePronta() { tocarEvento("ultimate_pronta", [{ freq: 330, duracaoMs: 380, tipo: "sawtooth", deslizarPara: 990, volumeMult: 0.45 }]); }
export function somCooldownPronto() { tocarEvento("cooldown_pronto", [{ freq: 990, duracaoMs: 110, tipo: "sine", deslizarPara: 1320, volumeMult: 0.28 }]); }
export function somRuptura() { tocarEvento("ruptura", [{ freq: 240, duracaoMs: 320, tipo: "sawtooth", deslizarPara: 90, volumeMult: 0.7 }]); }

// Vocabulário sonoro compartilhado. São acordes mínimos e curtos, feitos no
// próprio navegador: nenhum download, licença ou atraso de carregamento.
export function somInterfaceAbrir() { tocarEvento("interface_abrir", [{ freq: 430, duracaoMs: 55, tipo: "sine", deslizarPara: 560, volumeMult: 0.18 }]); }
export function somInterfaceFechar() { tocarEvento("interface_fechar", [{ freq: 480, duracaoMs: 55, tipo: "sine", deslizarPara: 350, volumeMult: 0.14 }]); }
export function somTrocarAba() { tocarEvento("trocar_aba", [{ freq: 560, duracaoMs: 45, tipo: "sine", deslizarPara: 640, volumeMult: 0.14 }]); }
export function somCancelar() { tocarEvento("cancelar", [{ freq: 390, duracaoMs: 65, tipo: "sine", deslizarPara: 310, volumeMult: 0.16 }]); }
export function somConfirmar() {
  tocarEvento("confirmar", [
    { freq: 520, duracaoMs: 75, tipo: "triangle", volumeMult: 0.3 },
    { freq: 720, duracaoMs: 100, tipo: "triangle", volumeMult: 0.26, atrasoMs: 55 },
  ]);
}
export function somSucesso() {
  tocarEvento("sucesso", [
    { freq: 440, duracaoMs: 100, tipo: "sine", volumeMult: 0.3 },
    { freq: 660, duracaoMs: 150, tipo: "triangle", volumeMult: 0.32, atrasoMs: 80 },
  ]);
}
export function somTesouro(raridade = "comum") {
  const topo = { comum: 720, incomum: 820, raro: 940, epico: 1080, lendario: 1240 }[raridade] || 720;
  tocarEvento("tesouro", [0, 1, 2].map((i) => ({ freq: topo * (0.55 + i * 0.2), duracaoMs: 170, tipo: "triangle", volumeMult: 0.34, atrasoMs: i * 85 })));
}
export function somNivel() {
  tocarEvento("nivel", [392, 523, 659, 784].map((freq, i) => ({ freq, duracaoMs: 210, tipo: "triangle", volumeMult: 0.34, atrasoMs: i * 75 })));
}
export function somTalento() {
  tocarEvento("talento", [
    { freq: 310, duracaoMs: 160, tipo: "sine", deslizarPara: 620, volumeMult: 0.3 },
    { freq: 930, duracaoMs: 180, tipo: "triangle", volumeMult: 0.25, atrasoMs: 110 },
  ]);
}
export function somEntradaChefe() {
  tocarEvento("entrada_chefe", [
    { freq: 105, duracaoMs: 520, tipo: "sawtooth", deslizarPara: 62, volumeMult: 0.42 },
    { freq: 210, duracaoMs: 330, tipo: "triangle", deslizarPara: 120, volumeMult: 0.26, atrasoMs: 160 },
  ]);
}
