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

// Descoberta no nível de MACRO-REGIÃO (ETAPA 1, task #37). É um registro
// separado de `biomaVisitados` porque responde outra pergunta: zona visitada
// é "onde já dá pra viajar rápido"; macro-região descoberta é "que partes de
// Aethra este herdeiro já conhece" — o que o Atlas mostra, e o que uma
// conquista futura vai contar. Deriva sempre de zona pisada, nunca é
// concedida sozinha.
export function marcarMacroVisitada(personagem, macroId) {
  if (!personagem.macrosDescobertas) personagem.macrosDescobertas = [];
  if (!macroId || personagem.macrosDescobertas.includes(macroId)) return;
  personagem.macrosDescobertas.push(macroId);
}

export function macroFoiDescoberta(personagem, macroId) {
  return !!(personagem.macrosDescobertas && personagem.macrosDescobertas.includes(macroId));
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
  // Centro de MASSA do território, não o meio da caixa delimitadora.
  //
  // A diferença passou a importar na ETAPA 2: com zonas orgânicas, o meio da
  // caixa de uma península ou de um arquipélago cai no mar. O centro de massa
  // cai onde a zona realmente tem terra.
  if (zona.centroReal) return { x: zona.centroReal.x, y: zona.centroReal.y };
  return { x: Math.floor((zona.x0 + zona.x1) / 2), y: Math.floor((zona.y0 + zona.y1) / 2) };
}

// --- PONTOS DE VIAGEM RÁPIDA (ETAPA 2, item 27) ---------------------------
// "Definir pontos coerentes: cidade, porto, caravana, santuário, waypoint. Só
// habilitar após descoberta."
//
// Até aqui a viagem rápida levava ao CENTRO DE UMA ZONA, o que é uma ideia
// estranha quando se olha de perto: ninguém pega carona para "o meio da
// planície". Agora o destino é um LUGAR — a praça de uma cidade, a doca de um
// porto, o poço de um posto de caravana —, e só entram os assentamentos que
// declaram `viagemRapida`.
//
// `assentamentos` vem do mundo gerado (têm x/y reais); `estadoZona` é a
// consulta de névoa. Nenhum ponto aparece antes de o jogador ter pisado na
// zona dele — exceto a vila inicial, que é a casa dele.
export function pontosDeViagemDisponiveis(personagem, assentamentos, estadoZona) {
  return (assentamentos || [])
    .filter((a) => a.viagemRapida)
    .filter((a) => a.inicial || zonaFoiVisitada(personagem, a.zonaId)
      || ["descoberto", "dominado"].includes(estadoZona ? estadoZona(a.zonaId) : ""))
    .map((a) => ({
      id: a.id, nome: a.nome, categoria: a.categoria, zonaId: a.zonaId,
      x: a.x, y: a.y, faccao: a.faccao || null,
    }));
}
