// Poder de Combate (PC): uma leitura comparável do que o motor realmente
// usa — atributos efetivos, arma, defesa, velocidade, HP/MP, habilidades e
// bônus coletivos. Não altera dano nem balanceamento; apenas traduz o estado
// atual para um número e simula trocas antes de confirmá-las.
import { atributosEfetivos, defesaTotal, velocidadeTotal, ataqueBase, critBonusTotal } from "./CharacterFactory.js";
import { sinergiasAtivasPreview } from "./FormationSynergySystem.js";
import { sinergiaFaccaoPreview } from "./FactionSynergySystem.js";
import { posicaoDe } from "./FormationSystem.js";

const MAX_CONVOCADOS = 3;
export const PODER_MAXIMO_PERSONAGEM = 250;

function numero(v) { return Number(v) || 0; }
function equipamentoSeguro(m) { return m.equipamento || {}; }

export function poderDoMembro(membro, dados = {}) {
  if (!membro) return 0;
  const seguro = { ...membro, atributos: membro.atributos || {}, equipamento: equipamentoSeguro(membro) };
  const a = atributosEfetivos(seguro, dados);
  const ataque = ataqueBase(seguro, dados);
  const defesa = defesaTotal(seguro, dados);
  const velocidade = velocidadeTotal(seguro, dados);
  const critico = critBonusTotal(seguro, dados) + numero(ataque.bonusCritico) / 100;
  const habilidades = (seguro.habilidades || []).reduce((s, h) => {
    const impacto = numero(h.valor) + numero(h.multiplicador) * 10 + numero(h.duracao) * 2;
    return s + Math.min(12, impacto * .35);
  }, 0);
  const atributos = ["FOR", "DES", "CON", "INT"].reduce((s, k) => s + numero(a[k]), 0);
  // Escala deliberadamente curta: um aventureiro começa por volta de
  // 50–80 PC e nenhum indivíduo passa de 250, mesmo com equipamento +10.
  // A forja continua pesando porque ataque/defesa já incluem o item final.
  const bruto = 24 + Math.max(0, Math.min(24, numero(seguro.nivel) - 1)) * 5.2
    + Math.max(0, atributos - 28) * .72
    + numero(seguro.hpMax) * .035 + numero(seguro.mpMax) * .025
    + defesa * .75 + velocidade * .3 + numero(ataque.dano) * 1.05
    + critico * 18 + Math.min(18, habilidades);
  return Math.max(1, Math.min(PODER_MAXIMO_PERSONAGEM, Math.round(bruto)));
}

export function membrosParaUids(personagem, uids = null) {
  const escolhidos = uids || personagem.gacha?.timeAtivo || [];
  const roster = personagem.gacha?.personagensObtidos || [];
  return [personagem, ...escolhidos.map((uid) => roster.find((p) => p.uid === uid)).filter(Boolean)].slice(0, 4);
}

function elementoDo(membro) {
  return membro.elementoId || membro.elemento || membro.equipamento?.arma?.elemento || "fisico";
}

export function avaliarTime(personagem, dados = {}, uids = null, opcoes = {}) {
  const membros = membrosParaUids(personagem, uids);
  const ids = membros.map((m, i) => i === 0 ? "player" : m.uid);
  const membrosPosicionados = membros.map((m, i) => ({
    ...m,
    posicao: opcoes.posicoes?.[ids[i]] || posicaoDe(personagem, ids[i], ids),
  }));
  const individual = membrosPosicionados.map((m) => ({ uid: m.uid || "player", nome: m.nome, poder: poderDoMembro(m, dados) }));
  const base = individual.reduce((s, m) => s + m.poder, 0);
  const formacao = sinergiasAtivasPreview(membrosPosicionados);
  const faccao = sinergiaFaccaoPreview(membrosPosicionados, dados.worldStateVariables);
  const elementos = new Set(membrosPosicionados.map(elementoDo));
  const classes = new Set(membrosPosicionados.map((m) => m.classeId).filter(Boolean));
  const bonusFormacao = formacao.length * .045;
  const bonusFaccao = faccao ? .08 : 0;
  const bonusAfinidade = Math.min(.075, Math.max(0, elementos.size - 1) * .025);
  const bonusVariedade = Math.min(.045, Math.max(0, classes.size - 1) * .015);
  const multiplicador = 1 + bonusFormacao + bonusFaccao + bonusAfinidade + bonusVariedade;
  return {
    total: Math.round(base * multiplicador), base, individual, membros: membrosPosicionados,
    bonusPercentual: Math.round((multiplicador - 1) * 100),
    formacao, faccao, elementos: [...elementos], classes: [...classes],
    bonus: { formacao: Math.round(bonusFormacao * 100), faccao: Math.round(bonusFaccao * 100), afinidade: Math.round(bonusAfinidade * 100), variedade: Math.round(bonusVariedade * 100) },
  };
}

function candidatosRelevantes(personagem, dados) {
  const todos = personagem.gacha?.personagensObtidos || [];
  const ativos = new Set(personagem.gacha?.timeAtivo || []);
  const porForca = [...todos].sort((a, b) => poderDoMembro(b, dados) - poderDoMembro(a, dados)).slice(0, 14);
  const faccoesAtivas = new Set(membrosParaUids(personagem).map((m) => m.facaoId).filter(Boolean));
  const tematicos = todos.filter((m) => faccoesAtivas.has(m.facaoId));
  return [...new Map([...porForca, ...tematicos, ...todos.filter((m) => ativos.has(m.uid))].map((m) => [m.uid, m])).values()];
}

function combinacoes(lista, tamanho, inicio = 0, atual = [], saida = []) {
  if (atual.length === tamanho) { saida.push([...atual]); return saida; }
  for (let i = inicio; i <= lista.length - (tamanho - atual.length); i += 1) {
    atual.push(lista[i]); combinacoes(lista, tamanho, i + 1, atual, saida); atual.pop();
  }
  return saida;
}

export function chaveDaRecomendacao(rec) {
  return rec ? `${rec.atual.total}>${rec.sugerido.total}:${rec.uids.join(",")}` : "sem-recomendacao";
}

export function melhorRecomendacaoTime(personagem, dados = {}) {
  if (!personagem?.gacha) return null;
  const atuais = [...(personagem.gacha.timeAtivo || [])];
  const atual = avaliarTime(personagem, dados, atuais);
  const candidatos = candidatosRelevantes(personagem, dados);
  const tamanho = Math.min(MAX_CONVOCADOS, Math.max(atuais.length, Math.min(MAX_CONVOCADOS, candidatos.length)));
  if (!tamanho) return null;
  let melhor = { uids: atuais, avaliacao: atual };
  for (const grupo of combinacoes(candidatos, tamanho)) {
    const uids = grupo.map((m) => m.uid);
    const avaliacao = avaliarTime(personagem, dados, uids);
    if (avaliacao.total > melhor.avaliacao.total) melhor = { uids, avaliacao };
  }
  const ganho = melhor.avaliacao.total - atual.total;
  const ganhoPct = atual.total ? Math.round(ganho / atual.total * 100) : 0;
  if (ganho <= 0 || ganhoPct < 2 || melhor.uids.join("|") === atuais.join("|")) return null;
  const entram = melhor.uids.filter((uid) => !atuais.includes(uid));
  const saem = atuais.filter((uid) => !melhor.uids.includes(uid));
  const roster = personagem.gacha.personagensObtidos;
  const motivos = [];
  if (melhor.avaliacao.faccao && !atual.faccao) motivos.push(`ativa ${melhor.avaliacao.faccao.nome}`);
  if (melhor.avaliacao.formacao.length > atual.formacao.length) motivos.push("cria uma sinergia de formação");
  if (melhor.avaliacao.elementos.length > atual.elementos.length) motivos.push("amplia a cobertura elemental");
  if (!motivos.length) motivos.push("aumenta atributos, equipamento e habilidades do grupo");
  return {
    atual, sugerido: melhor.avaliacao, uids: melhor.uids, ganho, ganhoPct, motivos,
    entram: entram.map((uid) => roster.find((m) => m.uid === uid)?.nome || uid),
    saem: saem.map((uid) => roster.find((m) => m.uid === uid)?.nome || uid),
  };
}

export function simularEntradaNoTime(personagem, dados, uid) {
  const atuais = [...(personagem.gacha?.timeAtivo || [])];
  const atual = avaliarTime(personagem, dados, atuais);
  if (atuais.includes(uid)) return { atual, sugerido: atual, delta: 0, deltaPct: 0, uids: atuais };
  const possibilidades = atuais.length < MAX_CONVOCADOS
    ? [[...atuais, uid]]
    : atuais.map((_, i) => atuais.map((x, k) => k === i ? uid : x));
  let melhor = { uids: atuais, sugerido: atual };
  possibilidades.forEach((uids) => {
    const avaliacao = avaliarTime(personagem, dados, uids);
    if (avaliacao.total > melhor.sugerido.total) melhor = { uids, sugerido: avaliacao };
  });
  const delta = melhor.sugerido.total - atual.total;
  return { atual, ...melhor, delta, deltaPct: atual.total ? Math.round(delta / atual.total * 100) : 0 };
}

export function formatarPoder(valor) { return Math.round(valor || 0).toLocaleString("pt-BR"); }
