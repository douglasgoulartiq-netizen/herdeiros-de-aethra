// Malha canônica do mapa de referência (Codex).
export const CODEX_MAP_BASE_W = 224;
export const CODEX_MAP_BASE_H = 176;
// v4: o território explorável dobra em cada eixo (4x a área da v3).
export const CODEX_MAP_SCALE = 4;
export const CODEX_MAP_W = CODEX_MAP_BASE_W * CODEX_MAP_SCALE;
export const CODEX_MAP_H = CODEX_MAP_BASE_H * CODEX_MAP_SCALE;
export const CODEX_MAP_LAYOUT_VERSION = 4;
export function projetarCoordenadaCodex(ponto, largura = CODEX_MAP_W, altura = CODEX_MAP_H) {
  return { x: Math.max(0, Math.min(largura - 1, Math.round(ponto.x * largura / CODEX_MAP_BASE_W))), y: Math.max(0, Math.min(altura - 1, Math.round(ponto.y * altura / CODEX_MAP_BASE_H))) };
}
