// Perfis de time salvos (melhoria de jogabilidade pós-backlog original):
// até MAX_PERFIS_DE_TIME configurações nomeadas de time + formação, pra
// trocar rápido entre builds sem remontar tudo manualmente toda vez (ver
// GachaUI.js, aba Time). Guarda em personagem.perfisDeTime — um array de
// slots fixos (índice = número do slot), cada um `null` (vazio) ou
// `{ nome, timeAtivo, formacao }` — persiste no save automaticamente junto
// do resto do personagem, igual a todo outro estado ad-hoc deste projeto
// (nenhum campo novo no contrato de save.js).
//
// Reaproveita definirTimeAtivo (GachaSystem.js) pra CARREGAR um time — ela
// já filtra uids que não existem mais em personagensObtidos e respeita o
// teto de MAX_CONVOCADOS_GACHA, então um perfil salvo nunca consegue
// restaurar um time inválido, mesmo que o roster do jogador tenha mudado
// entre salvar e carregar o perfil.
import { definirTimeAtivo } from "./GachaSystem.js";
import { garantirFormacao, posicaoDe } from "./FormationSystem.js";

export const MAX_PERFIS_DE_TIME = 3;

export function garantirPerfisDeTime(personagem) {
  if (!Array.isArray(personagem.perfisDeTime)) personagem.perfisDeTime = [];
  return personagem.perfisDeTime;
}

function slotValido(slot) {
  return Number.isInteger(slot) && slot >= 0 && slot < MAX_PERFIS_DE_TIME;
}

// Captura o time ativo ATUAL (personagem.gacha.timeAtivo) e a formação de
// cada membro dele (personagem.formacao) num slot — sobrescreve o que
// estava salvo ali antes, se houver.
export function salvarPerfilDeTime(personagem, slot, nome) {
  if (!slotValido(slot)) return { ok: false };
  const perfis = garantirPerfisDeTime(personagem);
  const timeAtivo = [...((personagem.gacha && personagem.gacha.timeAtivo) || [])];
  const idsTime = ["player", ...timeAtivo];
  const formacaoDoTime = {};
  idsTime.forEach((id) => { formacaoDoTime[id] = posicaoDe(personagem, id, idsTime); });
  const nomeFinal = (nome && nome.trim()) ? nome.trim().slice(0, 30) : `Perfil ${slot + 1}`;
  perfis[slot] = { nome: nomeFinal, timeAtivo, formacao: formacaoDoTime };
  return { ok: true, perfil: perfis[slot] };
}

// Restaura o time ativo e a formação salvos num slot. Nunca falha por causa
// de um uid que não existe mais (definirTimeAtivo já filtra); só falha se o
// slot for inválido ou estiver vazio.
export function carregarPerfilDeTime(personagem, slot) {
  if (!slotValido(slot)) return { ok: false };
  const perfis = garantirPerfisDeTime(personagem);
  const perfil = perfis[slot];
  if (!perfil) return { ok: false };
  definirTimeAtivo(personagem, perfil.timeAtivo || []);
  const formacaoAtual = garantirFormacao(personagem);
  const idsRestaurados = ["player", ...(personagem.gacha.timeAtivo || [])];
  idsRestaurados.forEach((id) => {
    if (perfil.formacao && perfil.formacao[id]) formacaoAtual[id] = perfil.formacao[id];
  });
  return { ok: true, perfil };
}

export function apagarPerfilDeTime(personagem, slot) {
  if (!slotValido(slot)) return { ok: false };
  const perfis = garantirPerfisDeTime(personagem);
  if (!perfis[slot]) return { ok: false };
  perfis[slot] = null;
  return { ok: true };
}

// Sempre retorna um array de tamanho fixo MAX_PERFIS_DE_TIME (com `null`
// nos slots vazios), pronto pra UI iterar sem se preocupar com buracos.
export function perfisParaExibir(personagem) {
  const perfis = garantirPerfisDeTime(personagem);
  return Array.from({ length: MAX_PERFIS_DE_TIME }, (_, i) => perfis[i] || null);
}
