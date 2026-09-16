// NÉVOA DE GUERRA (ETAPA 2, item 26).
//
// Quatro estados, e a diferença entre eles é o que o jogador SABE:
//
//   DESCONHECIDO  nunca ouviu falar. O Atlas mostra vazio.
//   RUMOR         ouviu falar sem ter ido. Sabe o nome e mais ou menos onde
//                 fica; não sabe o que tem lá. É o estado que dá vontade de ir.
//   DESCOBERTO    pisou. Vale viagem rápida, aparece no mapa com o que viu.
//   DOMINADO      limpou: chefe caído e todo baú da zona aberto. Serve pra o
//                 jogo saber o que ainda deve alguma coisa a ele.
//
// "Não revelar automaticamente tudo": o único jeito de DESCOBRIR é chegar lá.
// Rumor, por outro lado, se espalha — e por dois caminhos que existem no
// terreno, não por decreto:
//
//   • VIZINHANÇA — pisar numa zona põe as vizinhas dela em rumor. Você está
//     na fronteira; alguém do outro lado conta de onde veio.
//   • LANDMARK — um marco visível de longe (item 10: "landmarks ajudam
//     navegação") põe a zona dele em rumor de qualquer lugar dentro do seu
//     alcance. É o vulcão no horizonte: você ainda não foi, mas já sabe que
//     existe e para que lado fica.
//
// O estado nunca retrocede: uma vez descoberto, sempre descoberto.
export const NEVOA = {
  DESCONHECIDO: "desconhecido",
  RUMOR: "rumor",
  DESCOBERTO: "descoberto",
  DOMINADO: "dominado",
};

const ORDEM = [NEVOA.DESCONHECIDO, NEVOA.RUMOR, NEVOA.DESCOBERTO, NEVOA.DOMINADO];
const nivelDe = (estado) => Math.max(0, ORDEM.indexOf(estado));

export function garantirNevoa(personagem) {
  if (!personagem.nevoa || typeof personagem.nevoa !== "object") personagem.nevoa = {};
  if (!personagem.nevoa.zonas) personagem.nevoa.zonas = {};
  if (!personagem.nevoa.locais) personagem.nevoa.locais = {};
  return personagem.nevoa;
}

export function estadoDaZona(personagem, zonaId) {
  const n = garantirNevoa(personagem);
  return n.zonas[zonaId] || NEVOA.DESCONHECIDO;
}

export function estadoDoLocal(personagem, localId) {
  const n = garantirNevoa(personagem);
  return n.locais[localId] || NEVOA.DESCONHECIDO;
}

// Sobe o estado, nunca desce. Devolve true quando houve promoção — é o que
// permite avisar o jogador só quando algo mudou de verdade.
export function promoverZona(personagem, zonaId, estado) {
  if (!zonaId) return false;
  const n = garantirNevoa(personagem);
  const atual = n.zonas[zonaId] || NEVOA.DESCONHECIDO;
  if (nivelDe(estado) <= nivelDe(atual)) return false;
  n.zonas[zonaId] = estado;
  return true;
}

export function promoverLocal(personagem, localId, estado) {
  if (!localId) return false;
  const n = garantirNevoa(personagem);
  const atual = n.locais[localId] || NEVOA.DESCONHECIDO;
  if (nivelDe(estado) <= nivelDe(atual)) return false;
  n.locais[localId] = estado;
  return true;
}

// Chegar numa zona: ela vira DESCOBERTA e as vizinhas viram RUMOR.
// `vizinhas` é injetada por quem chama (worldHierarchy), pra este módulo não
// depender da geografia e continuar testável sozinho.
export function aoEntrarNaZona(personagem, zonaId, vizinhas = []) {
  const novidades = { descobriu: promoverZona(personagem, zonaId, NEVOA.DESCOBERTO), rumores: [] };
  vizinhas.forEach((v) => { if (promoverZona(personagem, v, NEVOA.RUMOR)) novidades.rumores.push(v); });
  return novidades;
}

// Marco visível: tudo que estiver dentro do alcance do landmark põe a zona
// dele em rumor. É o único jeito de saber de uma região sem fazer fronteira
// com ela.
export function verificarLandmarks(personagem, x, y, landmarks) {
  const vistos = [];
  for (const l of landmarks || []) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d > (l.alcance || 40)) continue;
    if (promoverLocal(personagem, l.id, NEVOA.RUMOR)) vistos.push(l);
    promoverZona(personagem, l.zonaId, NEVOA.RUMOR);
  }
  return vistos;
}

// DOMINADO: chefe caído e nenhum baú fechado sobrando naquela zona. Chamado
// depois de abrir baú e depois de vencer chefe — as duas únicas coisas que
// podem completar uma zona.
export function reavaliarDominio(personagem, zonaId, { baus = [], chefe = null } = {}) {
  if (estadoDaZona(personagem, zonaId) !== NEVOA.DESCOBERTO) return false;
  const bausDaZona = baus.filter((b) => b.zonaId === zonaId);
  const todosAbertos = bausDaZona.length === 0 || bausDaZona.every((b) => b.aberto);
  const chefeCaido = !chefe || !!chefe.derrotadoEm;
  if (!todosAbertos || !chefeCaido) return false;
  return promoverZona(personagem, zonaId, NEVOA.DOMINADO);
}

// Resumo pro Atlas e pro diagnóstico.
export function resumoNevoa(personagem, totalZonas) {
  const n = garantirNevoa(personagem);
  const conta = { desconhecido: 0, rumor: 0, descoberto: 0, dominado: 0 };
  Object.values(n.zonas).forEach((e) => { conta[e] = (conta[e] || 0) + 1; });
  conta.desconhecido = Math.max(0, totalZonas - conta.rumor - conta.descoberto - conta.dominado);
  return conta;
}

export const LABEL_NEVOA = {
  [NEVOA.DESCONHECIDO]: "Desconhecido",
  [NEVOA.RUMOR]: "Rumor",
  [NEVOA.DESCOBERTO]: "Descoberto",
  [NEVOA.DOMINADO]: "Dominado",
};
