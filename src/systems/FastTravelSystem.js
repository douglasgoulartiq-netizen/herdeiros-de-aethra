// Viagem rápida entre zonas exploradas (melhoria de jogabilidade pós-backlog
// original): cada zona do mundo aberto (ver worldMap.js: ZONAS) que o
// personagem já pisou fica disponível pra teleporte instantâneo — evita
// atravessar o mapa de novo só pra voltar numa área já limpa. A Vila (ponto
// de partida seguro) está sempre disponível, mesmo antes de qualquer
// movimento, e masmorras nunca entram na lista (viagem rápida só cobre o
// mundo aberto — entrar numa masmorra continua exigindo achar a entrada).
//
// Reaproveita o campo `biomaVisitados` já existente em CharacterFactory.js
// (declarado desde antes, mas nunca lido em lugar nenhum) em vez de criar um
// campo novo — cada zona do mundo aberto É um bioma no sentido do jogo, e o
// nome já bate com "zonas por onde o personagem passou".
export const ZONA_INICIAL_SEMPRE_DISPONIVEL = "vila";

// Marca uma zona como visitada (idempotente — não duplica). Chamado pelo
// main.js sempre que verificarMudancaDeZona() detecta uma zona nova.
export function marcarZonaVisitada(personagem, zonaId) {
  if (!personagem.biomaVisitados) personagem.biomaVisitados = [];
  if (!zonaId || personagem.biomaVisitados.includes(zonaId)) return;
  personagem.biomaVisitados.push(zonaId);
}

export function zonaFoiVisitada(personagem, zonaId) {
  if (zonaId === ZONA_INICIAL_SEMPRE_DISPONIVEL) return true;
  return !!(personagem.biomaVisitados && personagem.biomaVisitados.includes(zonaId));
}

// Lista, na mesma ordem de ZONAS (worldMap.js), as zonas disponíveis pra
// viagem rápida a partir do progresso do personagem.
export function zonasDisponiveisParaViagem(personagem, ZONAS) {
  return ZONAS.filter((z) => zonaFoiVisitada(personagem, z.id));
}

// Ponto de chegada "ideal" de uma zona: o primeiro marco (pontosDeInteresse
// tipo "marco") se existir — são posições escolhidas à mão, então já ficam
// em terreno andável — senão o centro da bounding box da zona. Retorna
// coordenadas de grid puras; quem chama é responsável por checar colisão
// contra o grid real (este módulo não depende do grid renderizado, pra
// continuar testável sem montar o mundo inteiro).
export function pontoDeChegada(zona) {
  const marco = (zona.pontosDeInteresse || []).find((p) => p.tipo === "marco");
  if (marco) return { x: marco.x, y: marco.y };
  return { x: Math.floor((zona.x0 + zona.x1) / 2), y: Math.floor((zona.y0 + zona.y1) / 2) };
}
