// MASMORRA: conclusão e tempo de espera — motor PURO, sem DOM.
//
// O QUE FALTAVA
// -------------
// Uma masmorra não tinha estado de "concluída". Os baús tinham `aberto`, o
// chefe tinha `derrotadoEm`, e ninguém somava os dois. Consequências:
//
//   • o automático entrava, fazia parte do serviço e saía, e a masmorra
//     continuava idêntica a uma nunca visitada;
//   • nada impedia entrar de novo no segundo seguinte, então "limpar a
//     masmorra" nunca era um evento — era um estado difuso;
//   • o chefe da masmorra reaparecia por RESPAWN_CHEFE_MS como qualquer
//     chefe de campo, e a masmorra virava uma torneira aberta.
//
// O QUE ESTE MÓDULO ACRESCENTA
// ----------------------------
// Um conceito só: uma masmorra está LIMPA quando todos os baús dela estão
// abertos E o chefe dela foi derrotado. Ao ficar limpa, ela entra em espera
// — exatamente como um chefe derrotado — e não aceita entrada até o prazo
// passar. Quando o prazo passa, ela volta ao normal (os baús do gerador são
// reconstruídos pelo próprio mundo, ver worldMap.js).
//
// Tudo aqui é função pura sobre `mundo` e a definição da masmorra. O main.js
// é quem sabe o que é MASMORRAS, entrada, saída e mensagem na tela; este
// arquivo não sabe desenhar nada e não importa nada do jogo.

// Mesma ordem de grandeza do respawn de chefe (30s), mas maior: uma masmorra
// inteira é um compromisso maior que um chefe de campo, e reentrar
// imediatamente esvaziaria o sentido de tê-la concluído.
export const ESPERA_MASMORRA_MS = 120000;

export function garantirEstadoMasmorras(mundo) {
  if (!mundo) return {};
  if (!mundo.masmorrasLimpas || typeof mundo.masmorrasLimpas !== "object") {
    mundo.masmorrasLimpas = {};
  }
  return mundo.masmorrasLimpas;
}

// Quanto falta fazer lá dentro, em números — a UI e o automático leem daqui
// em vez de recontar cada um do seu jeito.
export function progressoDaMasmorra(mundo, def, chefeDisponivel) {
  const baus = (mundo && mundo[def.chestsKey]) || [];
  const abertos = baus.filter((c) => c.aberto).length;
  const chefeVivo = typeof chefeDisponivel === "function" ? chefeDisponivel(def.boss) : !def.boss.derrotadoEm;
  return {
    bausTotal: baus.length,
    bausAbertos: abertos,
    bausFaltando: baus.length - abertos,
    chefeVivo,
    completa: baus.length > 0 && abertos === baus.length && !chefeVivo,
  };
}

// A masmorra está em espera AGORA?
export function masmorraEmEspera(mundo, id, agora = Date.now()) {
  const limpas = garantirEstadoMasmorras(mundo);
  const quando = limpas[id];
  if (!quando) return false;
  return agora - quando < ESPERA_MASMORRA_MS;
}

export function tempoDeEsperaRestanteMs(mundo, id, agora = Date.now()) {
  const limpas = garantirEstadoMasmorras(mundo);
  const quando = limpas[id];
  if (!quando) return 0;
  return Math.max(0, ESPERA_MASMORRA_MS - (agora - quando));
}

// Registra a conclusão. Devolve `true` só na PRIMEIRA vez — quem chama usa
// isso para mostrar a mensagem de "masmorra concluída" uma vez, e não a cada
// passo dado em cima da saída.
export function marcarMasmorraLimpa(mundo, id, agora = Date.now()) {
  const limpas = garantirEstadoMasmorras(mundo);
  if (masmorraEmEspera(mundo, id, agora)) return false;
  limpas[id] = agora;
  return true;
}

// Texto curto para a tela: "Covil das Cinzas — em silêncio por mais 1min42".
export function textoDeEspera(mundo, id, nome, agora = Date.now()) {
  const ms = tempoDeEsperaRestanteMs(mundo, id, agora);
  if (ms <= 0) return "";
  const s = Math.ceil(ms / 1000);
  const min = Math.floor(s / 60);
  const seg = s % 60;
  const quanto = min ? `${min}min${String(seg).padStart(2, "0")}` : `${seg}s`;
  return `${nome} ainda está em silêncio depois da última incursão — volte em ${quanto}.`;
}
