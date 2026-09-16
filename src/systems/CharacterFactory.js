// Cria e evolui personagens jogáveis a partir dos dados de raça/classe/antecedente.
import { bonusAfinidade } from "./AffinitySystem.js";
import { bonusVinculo } from "./BondSystem.js";
import { bonusConjunto } from "./SetBonusSystem.js";
import { bonusCaminhoHerdeiro } from "./TalentSystem.js";
import { bonusDosSubStats } from "./SubStatusSystem.js";

// CURVA DE XP.
//
// Era `30 × nível^1.5`. Medido com scripts/medir-dificuldade.mjs: o nível 2
// vinha em 2,7 lutas e o 3 em 6,1 — o começo do jogo passava correndo, que é
// justamente onde o jogador aprende as regras. A campanha inteira (1→17)
// custava 194 lutas.
//
// Agora `30 × nível^1.8`: só o EXPOENTE muda. A base fica em 30 de propósito
// — o primeiro nível continua saindo em ~3 lutas, e ele é a recompensa que
// ensina o jogador que subir de nível existe. O que estava errado não era o
// começo, era a curva ser plana demais depois dele.
//
// Efeito medido, em lutas por nível:
//     nível  2:  6,1 → 7,4      nível  5:  9,5 → 15,5
//     nível 13: 17,1 → 37       campanha 1→17: 194 → 376 lutas (+94%)
//
// TENTEI ANTES `45 × n^1.8` e passei do ponto: 564 lutas (+192%), com o
// nível 13 pedindo 55 lutas. Isso não é dificuldade, é grind — a luta não
// fica mais difícil, só se repete mais. A base voltou para 30.
//
// Mexer aqui é seguro para saves antigos: `ganharXP` recalcula `xpProximo` a
// cada nível, então um save existente pega a curva nova no próximo nível sem
// precisar de migração.
export function xpParaNivel(nivel) {
  return Math.round(30 * Math.pow(nivel, 1.8));
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
// A árvore de verdade (pontos, 3 ramos, 18 nós por classe, requisito de
// atributo, reset) vive em systems/SkillTreeSystem.js. Aqui fica só o que o
// resto do CharacterFactory precisa: transformar os nós de ATRIBUTO já
// comprados num bônus somável, no mesmo formato de bonusAfinidade/
// bonusVinculo/bonusConjunto, para entrar em bonusTotal().
//
// Este arquivo não importa SkillTreeSystem de propósito: SkillTreeSystem já
// importa daqui (calcularHpMax/atributosEfetivos), e um ciclo entre os dois
// só serviria para economizar as seis linhas de `nosDaArvore`.

// Aceita as duas formas do skillTrees.json: array puro (formato antigo, de
// saves e de qualquer dado que ainda não tenha sido regerado) e
// { ramos, nos } (formato atual).
export function nosDaArvore(dados, classeId) {
  const bruto = (dados && dados.skillTrees && dados.skillTrees[classeId]) || null;
  if (!bruto) return [];
  return Array.isArray(bruto) ? bruto : bruto.nos || [];
}

export function bonusArvore(personagem, dados) {
  const bonus = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };
  const arvore = nosDaArvore(dados, personagem.classeId);
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  escolhas.forEach((nodeId) => {
    const node = arvore.find((n) => n.id === nodeId);
    if (!node || !node.efeito || !(node.efeito.atributo in bonus)) return;
    // "atributo" é o tipo atual; "passiva" com efeito.atributo é como a
    // árvore antiga declarava a mesma coisa — os dois somam igual, para um
    // save antigo nunca perder o bônus que já tinha.
    if (node.tipoConcedido === "atributo" || node.tipoConcedido === "passiva") {
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
  // 6ª fonte: sub-status de forja (ver SubStatusSystem.js). Somar AQUI, e só
  // aqui, é o que faz uma espada +6 com "+3 FOR" e "+5% HP" valer em todo o
  // jogo sem nenhuma fórmula de combate saber que sub-status existe — o mesmo
  // truque que as cinco fontes anteriores já usavam.
  const sub = bonusDosSubStats(personagem);
  const total = {};
  for (const k of Object.keys(arv)) total[k] = arv[k] + (afin[k] || 0) + (vinc[k] || 0) + (conj[k] || 0) + (caminho[k] || 0);

  // ESCALAS DIFERENTES, e este foi o único ponto do encaixe que exigiu
  // cuidado: as cinco fontes antigas declaram hpMaxPercent em FRAÇÃO (0.06 =
  // 6%), enquanto o sub-status guarda o número que o jogador lê no item (6).
  // Converter na entrada é o que impede as duas escalas de se misturarem — um
  // "+6% HP" somado como 6.0 multiplicaria a vida por sete.
  total.hpMaxPercent = (total.hpMaxPercent || 0) + (sub.hpMaxPercent || 0) / 100;
  total.FOR = (total.FOR || 0) + (sub.FOR || 0);
  total.DES = (total.DES || 0) + (sub.DES || 0);
  total.CON = (total.CON || 0) + (sub.CON || 0);
  total.INT = (total.INT || 0) + (sub.INT || 0);
  // Campos que SÓ os sub-status produzem — nenhuma outra fonte os declara, e
  // por isso não existem nas chaves de `arv`.
  total.danoPercent = (sub.danoPercent || 0) / 100;
  total.defesaPercent = (sub.defesaPercent || 0) / 100;
  total.subCritico = sub.bonusCritico || 0;
  total.subVelocidade = sub.bonusVelocidade || 0;
  return total;
}

// `escolhaPendente`/`aplicarEscolhaArvore` viviam aqui e implementavam a
// árvore antiga (um par de opções por tier, uma escolha grátis a cada 3
// níveis). Foram substituídas por SkillTreeSystem.escolherNo /
// temCompraDisponivel, que cobram PONTOS — manter as duas versões vivas
// permitiria comprar um nó de graça pelo caminho antigo.

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
  const b = bonusTotal(personagem, dados);
  // `critChance` é a escala antiga (fração: 0.05 = 5%); o sub-status guarda
  // pontos percentuais (5 = 5%), como o jogador lê no item. Mesma conversão
  // do hpMaxPercent.
  return (b.critChance || 0) + (b.subCritico || 0) / 100;
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
  if (dados) {
    const b = bonusTotal(personagem, dados);
    def += b.defesaFlat || 0;
    // Percentual por último, sobre o total já somado — mesma regra do dano.
    def = Math.round(def * (1 + (b.defesaPercent || 0)));
  }
  return def;
}

export function velocidadeTotal(personagem, dados) {
  const a = atributosEfetivos(personagem, dados);
  let vel = a.DES;
  Object.values(personagem.equipamento).forEach((item) => {
    if (item && item.bonusVelocidade) vel += item.bonusVelocidade;
  });
  if (personagem.racaId === "elfo") vel += 2;
  if (dados) vel += bonusTotal(personagem, dados).subVelocidade || 0;
  return vel;
}

export function ataqueBase(personagem, dados) {
  const item = personagem.equipamento.arma;
  const a = atributosEfetivos(personagem, dados);
  // danoPercent e subCritico vêm dos sub-status de forja (ver bonusTotal).
  // Aplicados DEPOIS da soma arma + atributo, que é o que "% de dano"
  // significa: percentual do golpe inteiro, não só da lâmina.
  const b = dados ? bonusTotal(personagem, dados) : {};
  const pct = 1 + (b.danoPercent || 0);
  const critSub = b.subCritico || 0;
  if (item) {
    const atrib = a[item.atributo] || 0;
    return {
      dano: Math.round((item.dano + atrib) * pct),
      atributo: item.atributo,
      bonusCritico: (item.bonusCritico || 0) + critSub,
    };
  }
  return { dano: Math.round((2 + a.FOR) * pct), atributo: "FOR", bonusCritico: critSub };
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
