// Tutorial inicial: contrato de conteúdo e estado persistente.
// A soma das durações é deliberadamente 600 s (10 min). O jogador pode
// avançar mais rápido; os tempos servem para controlar a densidade do texto,
// não para prendê-lo esperando um relógio.
export const TUTORIAL_DURACAO_SEGUNDOS = 600;

export const TUTORIAL_ETAPAS = [
  { id: "orientacao", minuto: "0:00", duracao: 45, icone: "🧭", titulo: "Você está em Aethra", atalho: "Setas / WASD", demo: "movimento" },
  { id: "interacao", minuto: "0:45", duracao: 55, icone: "💬", titulo: "Interaja com o mundo", atalho: "E", demo: "interacao" },
  { id: "missao", minuto: "1:40", duracao: 65, icone: "📜", titulo: "Aceite e acompanhe missões", atalho: "M ou Q", demo: "missao" },
  { id: "mapa", minuto: "2:45", duracao: 55, icone: "🗺️", titulo: "Siga o rastro no mapa", atalho: "U", demo: "mapa" },
  { id: "mochila", minuto: "3:40", duracao: 55, icone: "🎒", titulo: "Prepare seu time", atalho: "I ou Y", demo: "mochila" },
  { id: "invocacao", minuto: "4:35", duracao: 70, icone: "✨", titulo: "Faça sua primeira invocação", atalho: "G", demo: "invocacao" },
  { id: "combate", minuto: "5:45", duracao: 80, icone: "⚔️", titulo: "Leia a batalha antes de agir", atalho: "Setas + Enter", demo: "combate" },
  { id: "d20", minuto: "7:05", duracao: 55, icone: "🎲", titulo: "O d20 decide o impacto", atalho: "Enter", demo: "d20" },
  { id: "taticas", minuto: "8:00", duracao: 75, icone: "🛡️", titulo: "Habilidade, defesa e automático", atalho: "Cards / P", demo: "taticas" },
  { id: "recompensa", minuto: "9:15", duracao: 45, icone: "🏆", titulo: "Evolua e escolha seu caminho", atalho: "T e H", demo: "recompensa" },
];

export function garantirEstadoTutorial(personagem) {
  if (!personagem.tutorialInicial || typeof personagem.tutorialInicial !== "object") {
    personagem.tutorialInicial = { status: "nao_iniciado", etapa: 0, versao: 1 };
  }
  return personagem.tutorialInicial;
}

export function deveOferecerTutorial(personagem) {
  return garantirEstadoTutorial(personagem).status === "nao_iniciado";
}

export function iniciarTutorial(personagem, { reiniciar = false } = {}) {
  const estado = garantirEstadoTutorial(personagem);
  if (reiniciar) estado.etapa = 0;
  estado.status = "em_andamento";
  estado.iniciadoEm ||= Date.now();
  return estado;
}

export function registrarEtapaTutorial(personagem, indice) {
  const estado = garantirEstadoTutorial(personagem);
  estado.status = "em_andamento";
  estado.etapa = Math.max(0, Math.min(TUTORIAL_ETAPAS.length - 1, Number(indice) || 0));
  return estado;
}

export function encerrarTutorial(personagem, status = "concluido") {
  const estado = garantirEstadoTutorial(personagem);
  estado.status = status === "pulado" ? "pulado" : "concluido";
  estado.etapa = status === "pulado" ? estado.etapa : TUTORIAL_ETAPAS.length;
  estado.encerradoEm = Date.now();
  return estado;
}

export function duracaoTotalTutorial() {
  return TUTORIAL_ETAPAS.reduce((total, etapa) => total + etapa.duracao, 0);
}
