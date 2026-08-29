// Telemetria mínima LOCAL (item 98 de 100_melhorias.md): nada sai do
// navegador — tudo fica num array em localStorage, capado em tamanho, só
// pra permitir auditoria de playtest sem precisar de servidor nenhum. Cobre
// o mínimo pedido pelas diretrizes de produção: início/fim de sessão,
// batalha (resultado/duração/composição), causa de derrota, moeda por
// fonte, tela aberta. Não registra texto livre, credenciais nem qualquer
// dado pessoal — só ids e números.
//
// Puramente aditivo: se `localStorage` não existir (Node/modo privado), os
// eventos só ficam em memória pra sessão atual e se perdem ao recarregar —
// igual ao padrão já usado em AccessibilitySystem.js.

const CHAVE = "rpg_pt_telemetria_v1";
const MAX_EVENTOS = 500; // roda-viva: os mais antigos saem primeiro (FIFO)

let cache = null;

function localStorageDisponivel() {
  return typeof localStorage !== "undefined";
}

function carregar() {
  if (cache) return cache;
  if (localStorageDisponivel()) {
    try {
      const raw = localStorage.getItem(CHAVE);
      cache = raw ? JSON.parse(raw) : [];
    } catch (e) {
      cache = [];
    }
  } else {
    cache = [];
  }
  return cache;
}

function salvar() {
  if (!localStorageDisponivel()) return;
  try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch (e) { /* cota/modo privado — segue só em memória */ }
}

export function registrarEvento(tipo, dados = {}) {
  const eventos = carregar();
  eventos.push({ tipo, ts: Date.now(), ...dados });
  while (eventos.length > MAX_EVENTOS) eventos.shift();
  salvar();
}

export function listarEventos() {
  return [...carregar()];
}

export function limparTelemetria() {
  cache = [];
  salvar();
}

// Resumo legível — o que `HDA_TELEMETRIA()` imprime no console (ver main.js
// boot(), onde `window.HDA_TELEMETRIA = ...` é exposto).
export function resumoTelemetria() {
  const eventos = carregar();
  const porTipo = {};
  eventos.forEach((e) => { porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1; });
  const batalhas = eventos.filter((e) => e.tipo === "batalha_fim");
  const vitorias = batalhas.filter((b) => b.resultado === "vitoria").length;
  const derrotas = batalhas.filter((b) => b.resultado === "derrota").length;
  const duracaoMedia = batalhas.length ? Math.round(batalhas.reduce((s, b) => s + (b.duracaoMs || 0), 0) / batalhas.length / 1000) : 0;
  const causasDerrota = {};
  batalhas.filter((b) => b.resultado === "derrota" && b.causa).forEach((b) => { causasDerrota[b.causa] = (causasDerrota[b.causa] || 0) + 1; });
  const moedaPorFonte = {};
  eventos.filter((e) => e.tipo === "moeda").forEach((e) => { moedaPorFonte[e.fonte] = (moedaPorFonte[e.fonte] || 0) + (e.valor || 0); });
  return {
    totalEventos: eventos.length,
    eventosPorTipo: porTipo,
    batalhas: { total: batalhas.length, vitorias, derrotas, duracaoMediaSegundos: duracaoMedia },
    causasDerrota,
    moedaPorFonte,
    telasAbertas: eventos.filter((e) => e.tipo === "tela_aberta").reduce((acc, e) => { acc[e.tela] = (acc[e.tela] || 0) + 1; return acc; }, {}),
  };
}
