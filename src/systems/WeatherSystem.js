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
import { ZONAS_MUNDO } from "../data/world/zones.js";

export const DURACAO_CLIMA_MS = 5 * 60 * 1000; // cada "rodada" de clima dura 5 minutos reais
// Um ciclo completo dura 24 minutos reais: cada minuto representa uma hora
// de Aethra. Isso torna o relógio legível e garante uma noite perceptível em
// qualquer sessão normal de exploração.
export const DURACAO_HORA_DIA_MS = 60 * 1000;

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
const ZONA_POR_ID = new Map(ZONAS_MUNDO.map((zona) => [zona.id, zona]));

export function climaAtualDaZona(zonaId, agora, altitude = 0) {
  if (!zonaId) return TIPOS_CLIMA[0];
  const periodo = Math.floor(agora / DURACAO_CLIMA_MS);
  const semente = hashString(`${zonaId}:${periodo}`);
  const zona = ZONA_POR_ID.get(zonaId);
  // A neve segue a altitude e a latitude glacial, não um sorteio global.
  // Vulkor é uma exceção intencional: calor vulcânico impede nevasca.
  const altaMontanha = altitude >= 5 && zona?.clima !== "vulcanico";
  const pesos = zona?.clima === "nevado" || altaMontanha
    ? { limpo: 15, chuva: 0, nevasca: 55, tempestade: 0, neblina: 10, vento_forte: 20 }
    : zona?.clima === "arido" || zona?.clima === "vulcanico"
      ? { limpo: 65, chuva: 0, nevasca: 0, tempestade: 5, neblina: 10, vento_forte: 20 }
      : null;
  const pesoTotal = TIPOS_CLIMA.reduce((s, c) => s + (pesos ? pesos[c.id] : c.peso), 0);
  let alvo = semente % pesoTotal;
  for (const clima of TIPOS_CLIMA) {
    const peso = pesos ? pesos[clima.id] : clima.peso;
    if (alvo < peso) return clima;
    alvo -= peso;
  }
  return TIPOS_CLIMA[0];
}

export function horaDoDiaAtual(agora) {
  const horaDecimal = ((agora / DURACAO_HORA_DIA_MS) % 24 + 24) % 24;
  const hora = Math.floor(horaDecimal);
  const minuto = Math.floor((horaDecimal - hora) * 60);
  const suavizar = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
  const escuridao = horaDecimal < 7 ? 1 - suavizar((horaDecimal - 5) / 2) : suavizar((horaDecimal - 18) / 2);
  // Mantém os ids legados para agendas de NPC e eventos existentes.
  const id = hora >= 6 && hora < 12 ? "manha" : hora >= 12 && hora < 20 ? "tarde" : "noite";
  const base = HORAS_DIA.find((item) => item.id === id) || HORAS_DIA[0];
  return { ...base, hora, horaDecimal, escuridao, rotulo: `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`, ehNoite: id === "noite" };
}

export function ehNoite(agora) {
  return horaDoDiaAtual(agora).ehNoite;
}
