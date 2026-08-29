// Cria e evolui personagens jogáveis a partir dos dados de raça/classe/antecedente.
import { bonusAfinidade } from "./AffinitySystem.js";
import { bonusVinculo } from "./BondSystem.js";
import { bonusConjunto } from "./SetBonusSystem.js";
import { bonusCaminhoHerdeiro } from "./TalentSystem.js";

export function xpParaNivel(nivel) {
  return Math.round(30 * Math.pow(nivel, 1.5));
}

export function criarPersonagem({ nome, raca, classe, antecedente, traco }, dados) {
  const r = dados.races.find((x) => x.id === raca);
  const c = dados.classes.find((x) => x.id === classe);
  const b = dados.backgrounds.find((x) => x.id === antecedente);
  const t = dados.traits.find((x) => x.id === traco);

  const atributos = { FOR: c.atributosBase.FOR, DES: c.atributosBase.DES, CON: c.atributosBase.CON, INT: c.atributosBase.INT };
  Object.entries(r.bonus).forEach(([k, v]) => (atributos[k] += v));

  const hpMax = c.vidaBase + atributos.CON * 3;
  const mpMax = c.manaBase + atributos.INT * 2;

  let ouro = b.ouroInicial;
  if (traco === "ganancioso") ouro = Math.round(ouro * 0.8);

  const inventario = [];
  if (b.itemInicial) {
    const item = dados.items.itens.find((i) => i.id === b.itemInicial);
    if (item) inventario.push({ ...item, uid: cryptoId() });
  }

  const personagem = {
    nome,
    racaId: raca,
    classeId: classe,
    antecedenteId: antecedente,
    tracoId: traco,
    racaNome: r.nome,
    classeNome: c.nome,
    classeIcone: c.icone || "", // task #41: classe evidente na HUD
    descricaoTraco: t.descricao,
    nivel: 1,
    xp: 0,
    xpProximo: xpParaNivel(1),
    atributos,
    hpMax,
    hp: hpMax,
    mpMax,
    mp: mpMax,
    ouro,
    inventario,
    equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
    habilidades: c.habilidades.map((h) => ({ ...h, cooldownAtual: 0 })),
    missoesAtivas: [],
    missoesConcluidas: [],
    spriteKey: `pc_${raca}_${classe}`,
    biomaVisitados: [],
    arvore: { escolhas: [] },
    ngPlus: 0, // New Game+ (melhoria pós-backlog original, ver NewGamePlusSystem.js)
    // Modo História (melhoria pós-backlog): escolhido na criação de
    // personagem (ver CharacterCreationUI.js) — reduz hp/ataque/defesa dos
    // monstros (ver CombatSystem.js: MODO_HISTORIA_REDUCAO) sem reduzir
    // XP/ouro, pro contrário exato de NG+ (que deixa mais difícil E rende
    // mais). Default false = comportamento idêntico a antes desta opção
    // existir.
    modoHistoria: false,
  };
  return personagem;
}

// --- Árvore de habilidades ---------------------------------------------
// Cada classe tem 4 "tiers" (níveis 3/6/9/12), cada um com 2 opções (ramo
// ofensivo: sempre uma nova habilidade ativa de ataque; ramo de suporte:
// um bônus passivo permanente ou, em algumas classes, uma habilidade de
// apoio). O jogador escolhe uma opção por tier — a outra fica de fora.

export function bonusArvore(personagem, dados) {
  const bonus = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };
  const arvore = (dados && dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  escolhas.forEach((nodeId) => {
    const node = arvore.find((n) => n.id === nodeId);
    if (node && node.tipoConcedido === "passiva" && node.efeito && node.efeito.atributo in bonus) {
      bonus[node.efeito.atributo] += node.efeito.valor;
    }
  });
  return bonus;
}

// Soma o bônus da árvore de habilidades (bonusArvore) com o bônus de
// afinidade racial de classe (task #41, AffinitySystem.js), o bônus de
// vínculo de campanheirismo (melhoria pós-backlog, BondSystem.js — só
// convocados do gacha têm, o principal fica com bônus vazio) e o bônus de
// conjunto de equipamento (melhoria pós-backlog, SetBonusSystem.js — muda a
// qualquer momento que o equipamento mudar, nunca é "guardado") — mesmo
// formato dos quatro, então basta somar campo a campo. Usado por todas as
// funções abaixo, pra cada um desses bônus valer nos mesmos lugares
// (atributos, defesa, HP/MP máximo, chance de crítico) sem duplicar a
// lógica de leitura em cada uma.
export function bonusTotal(personagem, dados) {
  const arv = bonusArvore(personagem, dados);
  const afin = bonusAfinidade(personagem, dados);
  const vinc = bonusVinculo(personagem);
  const conj = bonusConjunto(personagem);
  // Caminhos do Herdeiro (task #92) — 5ª fonte, mesmo formato das outras
  // quatro. Com `personagem.caminhoHerdeiro` inexistente (save antigo/
  // qualquer personagem antes desta task) ou nenhum talento/herança
  // escolhido ainda (o caso de 100% dos personagens hoje, já que as árvores
  // de verdade só chegam nas tasks #93/#94), bonusCaminhoHerdeiro() retorna
  // tudo zerado — no-op total, comportamento idêntico a antes desta task.
  const caminho = bonusCaminhoHerdeiro(personagem, dados);
  const total = {};
  for (const k of Object.keys(arv)) total[k] = arv[k] + (afin[k] || 0) + (vinc[k] || 0) + (conj[k] || 0) + (caminho[k] || 0);
  return total;
}

// Retorna o próximo tier ainda não decidido cujo nível já foi atingido
// (ou null se não há nada pendente ainda). Os tiers são avaliados em ordem
// de nível, então nunca pula um tier anterior ainda não resolvido.
export function escolhaPendente(personagem, dados) {
  const arvore = (dados && dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  if (!arvore.length) return null;
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  const tiers = [...new Set(arvore.map((n) => n.tier))].sort((a, b) => a - b);
  for (const tier of tiers) {
    const opcoes = arvore.filter((n) => n.tier === tier);
    if (opcoes.some((n) => escolhas.includes(n.id))) continue;
    const nivelRequerido = opcoes[0].nivelRequerido;
    if (personagem.nivel >= nivelRequerido) return { tier, nivelRequerido, opcoes };
    return null;
  }
  return null;
}

export function aplicarEscolhaArvore(personagem, dados, nodeId) {
  const arvore = (dados && dados.skillTrees && dados.skillTrees[personagem.classeId]) || [];
  const node = arvore.find((n) => n.id === nodeId);
  if (!node) return { ok: false };
  if (!personagem.arvore) personagem.arvore = { escolhas: [] };
  if (personagem.arvore.escolhas.includes(nodeId)) return { ok: false };
  personagem.arvore.escolhas.push(nodeId);
  if (node.tipoConcedido === "ativa" && node.habilidade) {
    const jaTem = personagem.habilidades.some((h) => h.id === node.habilidade.id);
    if (!jaTem) personagem.habilidades.push({ ...node.habilidade, cooldownAtual: 0 });
  } else {
    personagem.hpMax = calcularHpMax(personagem, dados);
    personagem.mpMax = calcularMpMax(personagem, dados);
    personagem.hp = Math.min(personagem.hpMax, personagem.hp);
    personagem.mp = Math.min(personagem.mpMax, personagem.mp);
  }
  return { ok: true, node };
}

export function calcularHpMax(personagem, dados) {
  const c = dados.classes.find((x) => x.id === personagem.classeId);
  if (!c) return personagem.hpMax || 1;
  const bonus = bonusTotal(personagem, dados);
  const conEfetivo = personagem.atributos.CON + (bonus.CON || 0);
  return Math.round((c.vidaBase + conEfetivo * 3) * (1 + (bonus.hpMaxPercent || 0)));
}

export function calcularMpMax(personagem, dados) {
  const c = dados.classes.find((x) => x.id === personagem.classeId);
  if (!c) return personagem.mpMax || 0;
  const bonus = bonusTotal(personagem, dados);
  const intEfetivo = personagem.atributos.INT + (bonus.INT || 0);
  return Math.round((c.manaBase + intEfetivo * 2) * (1 + (bonus.mpMaxPercent || 0)));
}

export function critBonusTotal(personagem, dados) {
  if (!dados) return 0;
  return bonusTotal(personagem, dados).critChance || 0;
}

export function atributosEfetivos(personagem, dados) {
  const a = { ...personagem.atributos };
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.bonusAtributo) {
      Object.entries(item.bonusAtributo).forEach(([k, v]) => (a[k] = (a[k] || 0) + v));
    }
  });
  if (dados) {
    const bonus = bonusTotal(personagem, dados);
    ["FOR", "DES", "CON", "INT"].forEach((k) => { a[k] = (a[k] || 0) + (bonus[k] || 0); });
  }
  return a;
}

export function defesaTotal(personagem, dados) {
  let def = Math.floor(personagem.atributos.CON / 2);
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.defesa) def += item.defesa;
  });
  if (dados) def += bonusTotal(personagem, dados).defesaFlat || 0;
  return def;
}

export function velocidadeTotal(personagem, dados) {
  const a = atributosEfetivos(personagem, dados);
  let vel = a.DES;
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.bonusVelocidade) vel += item.bonusVelocidade;
  });
  if (personagem.racaId === "elfo") vel += 2;
  return vel;
}

export function ataqueBase(personagem, dados) {
  const item = personagem.equipamento.arma;
  const a = atributosEfetivos(personagem, dados);
  if (item) {
    const atrib = a[item.atributo] || 0;
    return { dano: item.dano + atrib, atributo: item.atributo, bonusCritico: item.bonusCritico || 0 };
  }
  return { dano: 2 + a.FOR, atributo: "FOR", bonusCritico: 0 };
}

export function ganharXP(personagem, xp) {
  let ganho = xp;
  if (personagem.racaId === "humano") ganho = Math.round(ganho * 1.05);
  personagem.xp += ganho;
  const subiuNivel = [];
  while (personagem.xp >= personagem.xpProximo) {
    personagem.xp -= personagem.xpProximo;
    personagem.nivel += 1;
    personagem.xpProximo = xpParaNivel(personagem.nivel);
    subiuNivel.push(personagem.nivel);
  }
  return { ganho, subiuNivel };
}

export function aplicarCrescimento(personagem, dados) {
  const c = dados.classes.find((x) => x.id === personagem.classeId);
  Object.entries(c.crescimento).forEach(([k, v]) => (personagem.atributos[k] += v));
  const hpAntigo = personagem.hpMax;
  personagem.hpMax = calcularHpMax(personagem, dados);
  personagem.mpMax = calcularMpMax(personagem, dados);
  personagem.hp += personagem.hpMax - hpAntigo;
  personagem.mp = personagem.mpMax;
}

export function cryptoId() {
  return "id_" + Math.random().toString(36).slice(2, 10);
}
