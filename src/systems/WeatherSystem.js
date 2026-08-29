// Eventos de clima e hora do dia por zona (melhoria de jogabilidade
// pós-backlog original): variações periódicas derivadas do relógio real
// (Date.now()) combinado com o id da zona — não precisa de nenhum estado
// novo salvo/carregado (SaveSystem.js não muda em nada), e cada zona pode
// estar com um clima diferente no mesmo instante. Determinístico dentro do
// mesmo período: duas chamadas próximas no tempo pra mesma zona sempre dão
// o mesmo resultado (importante pra UI não "piscar" a cada re-render).
//
// Interage com o terreno elemental (task #42, ver CombatSystem.js
// multiplicadorTerreno/multiplicadorClima): enquanto durar, o elemento do
// clima também ganha um bônus de ataque — mais fraco que o bônus do terreno
// fixo do bioma (o terreno é permanente/estrutural, o clima é passageiro) —
// e os dois somam quando coincidem (ex.: chuva numa zona de água já forte
// fica ainda mais forte; chuva n uma zona de fogo esfria um pouco a
// vantagem do bioma sem removê-la).
export const DURACAO_CLIMA_MS = 5 * 60 * 1000; // cada "rodada" de clima dura 5 minutos reais
export const DURACAO_HORA_DIA_MS = 4 * 60 * 1000; // manhã/tarde/noite, 4 min reais cada — ciclo completo de 12 min

export const TIPOS_CLIMA = [
  { id: "limpo", nome: "Céu Limpo", icone: "☀️", elementoBonus: null, peso: 40 },
  { id: "chuva", nome: "Chuva", icone: "🌧️", elementoBonus: "agua", peso: 15 },
  { id: "nevasca", nome: "Nevasca", icone: "❄️", elementoBonus: "gelo", peso: 10 },
  { id: "tempestade", nome: "Tempestade", icone: "⛈️", elementoBonus: "raio", peso: 10 },
  { id: "neblina", nome: "Neblina", icone: "🌫️", elementoBonus: "sombrio", peso: 10 },
  { id: "vento_forte", nome: "Vento Forte", icone: "🌬️", elementoBonus: "vento", peso: 15 },
];

export const HORAS_DIA = [
  { id: "manha", nome: "Manhã", icone: "🌅" },
  { id: "tarde", nome: "Tarde", icone: "🌇" },
  { id: "noite", nome: "Noite", icone: "🌙" },
];

// Hash simples e determinístico de string -> inteiro positivo, só pra
// espalhar zonas diferentes em "sorteios" diferentes a partir do mesmo
// relógio, sem depender de nenhuma biblioteca externa.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// `agora` é injetável (testabilidade determinística) — em produção, o
// chamador sempre passa Date.now() (nunca lido diretamente aqui dentro).
export function climaAtualDaZona(zonaId, agora) {
  if (!zonaId) return TIPOS_CLIMA[0];
  const periodo = Math.floor(agora / DURACAO_CLIMA_MS);
  const semente = hashString(`${zonaId}:${periodo}`);
  const pesoTotal = TIPOS_CLIMA.reduce((s, c) => s + c.peso, 0);
  let alvo = semente % pesoTotal;
  for (const clima of TIPOS_CLIMA) {
    if (alvo < clima.peso) return clima;
    alvo -= clima.peso;
  }
  return TIPOS_CLIMA[0];
}

export function horaDoDiaAtual(agora) {
  const periodo = Math.floor(agora / DURACAO_HORA_DIA_MS) % HORAS_DIA.length;
  return HORAS_DIA[periodo];
}
