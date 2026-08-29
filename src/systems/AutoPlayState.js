// Estado global (singleton) do modo automático — compartilhado entre
// main.js (exploração/mundo) e BattleUI.js (batalha), já que módulos ES
// exportam a MESMA instância do objeto para todo mundo que os importa.
export const autoPlayState = {
  ativo: false,
  // Resumo da sessão automática atual (item 16 de 100_melhorias.md):
  // zerado toda vez que o automático LIGA, incrementado por quem resolve
  // cada evento (main.js/BattleUI.js) e lido só na hora de desligar, pra
  // mostrar "6 vitórias, 2 fugas, 340 XP, 210 ouro" em vez de nada.
  resumo: { vitorias: 0, derrotas: 0, fugas: 0, xpGanho: 0, ouroGanho: 0 },
};

export function zerarResumoAuto() {
  autoPlayState.resumo = { vitorias: 0, derrotas: 0, fugas: 0, xpGanho: 0, ouroGanho: 0 };
}

export function registrarResultadoBatalhaAuto(resultado) {
  if (resultado === "vitoria") autoPlayState.resumo.vitorias += 1;
  else if (resultado === "derrota") autoPlayState.resumo.derrotas += 1;
  else if (resultado === "fuga") autoPlayState.resumo.fugas += 1;
}

export function registrarGanhosAuto({ xp = 0, ouro = 0 } = {}) {
  autoPlayState.resumo.xpGanho += xp;
  autoPlayState.resumo.ouroGanho += ouro;
}

export function textoResumoAuto() {
  const r = autoPlayState.resumo;
  const partes = [];
  if (r.vitorias) partes.push(`${r.vitorias} vitória${r.vitorias > 1 ? "s" : ""}`);
  if (r.derrotas) partes.push(`${r.derrotas} derrota${r.derrotas > 1 ? "s" : ""}`);
  if (r.fugas) partes.push(`${r.fugas} fuga${r.fugas > 1 ? "s" : ""}`);
  if (r.xpGanho) partes.push(`${r.xpGanho} XP`);
  if (r.ouroGanho) partes.push(`${r.ouroGanho} ouro`);
  return partes.length ? partes.join(", ") : "nenhum evento registrado";
}
