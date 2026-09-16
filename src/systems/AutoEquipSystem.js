// Equipamento automático (pedido do jogador) — motor PURO, sem DOM.
//
// Faz duas coisas bem diferentes, de propósito:
//
//   1. PREENCHER SLOT VAZIO — roda sozinho, sempre que entram itens na
//      mochila. Só toca em slot que está `null`. Nunca desfaz uma escolha
//      do jogador, porque nunca substitui nada.
//   2. PROPOR UPGRADE — só roda quando o jogador aperta "⚡ Otimizar" no
//      inventário, e devolve uma LISTA de trocas pra ele revisar antes de
//      aplicar. Substituir peça equipada por conta própria seria desfazer
//      build (a arma fraca de elemento certo, o set incompleto que o
//      jogador está montando), então isso nunca acontece sem clique.
//
// COMO ELE DECIDE O QUE É "MELHOR"
// Não inventa fórmula nenhuma: veste o item de mentira no personagem,
// pergunta ao próprio jogo quanto ele passou a valer (ataqueBase/
// defesaTotal/velocidadeTotal/critBonusTotal/calcularHpMax, exatamente as
// funções que o combate usa) e desveste. Isso faz o auto-equipar respeitar
// de graça coisas que ele nem sabe que existem: bônus de conjunto
// (SetBonusSystem), bônus de árvore/afinidade/vínculo, e o fato de que uma
// arma vale o dano dela MAIS o atributo com que ela escala — por isso um
// cajado de INT continua ruim num guerreiro sem o motor precisar conhecer
// a regra "cajado é de mago".
//
// Efeito colateral bom: como a comparação é sempre "poder antes x poder
// depois", equipar num slot vazio também pode ser RECUSADO. Punho vazio dá
// `2 + FOR` de dano (ver ataqueBase); uma espada ruim de INT na mão de um
// guerreiro dá menos que isso. O automático deixa o slot vazio nesse caso,
// que é a decisão certa.
import {
  ataqueBase,
  defesaTotal,
  velocidadeTotal,
  critBonusTotal,
  calcularHpMax,
} from "./CharacterFactory.js";
import { slotDoItem, removerItem } from "./InventorySystem.js";

// Pesos pra colapsar as estatísticas derivadas num número só. Ranquear
// itens EXIGE uma escala comum — não dá pra comparar "+3 de dano" com "+5
// de defesa" sem dizer quanto cada um vale. Estes são os valores, e o
// raciocínio de cada um:
//   ataque    — dano por golpe, a saída principal do personagem.
//   defesa    — vale ~1,5x porque rende duas coisas ao mesmo tempo: reduz
//               o dano recebido E sobe o limiar de bloqueio do d20
//               (10 + defesaEfetiva/2, ver CombatSystem.js).
//   velocidade— frequência de turno no ATB; real, mas indireta.
//   hpMax     — sobreviver mais tempo; peso baixo por ponto porque HP vem
//               em dezenas enquanto dano/defesa vêm em unidades.
//   crítico   — critChance é fração (0.03 = 3%), então precisa de um peso
//               grande pra virar algo comparável: 3% ≈ 2 pontos de poder.
export const PESOS_PODER = {
  ataque: 2.0,
  defesa: 1.5,
  velocidade: 0.6,
  hpMax: 0.08,
  critico: 70,
};

// Margem mínima de ganho pra uma troca ser oferecida como upgrade. Sem
// isso o botão "Otimizar" viraria uma lista de trocas de +0,3 de poder que
// só dão trabalho de ler. Preencher slot VAZIO usa margem 0 (qualquer
// ganho real serve, já que não custa nada perder).
export const MARGEM_UPGRADE = 1.5;

export function poderDeCombate(personagem, dados) {
  const ataque = ataqueBase(personagem, dados).dano;
  const defesa = defesaTotal(personagem, dados);
  const velocidade = velocidadeTotal(personagem, dados);
  const critico = critBonusTotal(personagem, dados);
  const hpMax = calcularHpMax(personagem, dados);
  return (
    ataque * PESOS_PODER.ataque +
    defesa * PESOS_PODER.defesa +
    velocidade * PESOS_PODER.velocidade +
    hpMax * PESOS_PODER.hpMax +
    critico * PESOS_PODER.critico
  );
}

// Veste `item` no slot, mede, e devolve tudo ao que era. Nunca deixa o
// personagem alterado, mesmo se poderDeCombate() explodir no meio.
export function poderComItem(personagem, slot, item, dados) {
  const anterior = personagem.equipamento[slot];
  personagem.equipamento[slot] = item;
  try {
    return poderDeCombate(personagem, dados);
  } finally {
    personagem.equipamento[slot] = anterior;
  }
}

// Todos os personagens que o auto-equipar pode vestir: o principal e os
// convocados do gacha em campo. Recebe o time já montado (main.js e
// GameUI.js já calculam `[personagem, ...membrosDoTime(personagem)]`) pra
// este módulo não precisar importar GachaSystem e virar refém da ordem de
// import.
function alvosValidos(personagem, time) {
  const lista = Array.isArray(time) && time.length ? time : [personagem];
  return lista.filter((p) => p && p.equipamento && p.atributos);
}

// Núcleo compartilhado pelos dois modos. `incluirUpgrades = false` só olha
// slot vazio; `true` também considera trocar peça já equipada.
//
// A mochila é UMA só pro time inteiro, então o planejamento é guloso e
// ordenado: cada item candidato é "reservado" assim que entra no plano
// (`reservados`), pra dois personagens nunca disputarem o mesmo anel. A
// ordem é a do time (principal primeiro), que é a mesma ordem que o
// jogador vê na tela — previsível é mais importante que ótimo aqui.
export function planejarEquipamento(personagem, time, dados, { incluirUpgrades = false } = {}) {
  const acoes = [];
  const reservados = new Set();

  for (const alvo of alvosValidos(personagem, time)) {
    // Recalculado a cada slot porque uma ação já planejada muda o poder
    // base do MESMO personagem (equipar peito muda o total, e o próximo
    // slot precisa ser comparado contra o novo total, não contra o antigo).
    const aplicadosNesteAlvo = [];

    for (const slot of Object.keys(alvo.equipamento)) {
      const equipadoAgora = slotAposAcoes(alvo, slot, aplicadosNesteAlvo);
      if (equipadoAgora && !incluirUpgrades) continue;

      const candidatos = personagem.inventario.filter(
        (it) => !reservados.has(it.uid) && slotDoItem(it) === slot
      );
      if (!candidatos.length) continue;

      // Mede sempre contra o estado COM as ações já planejadas aplicadas,
      // senão o segundo slot compararia contra um personagem desatualizado.
      const restaurar = aplicarTemporariamente(alvo, aplicadosNesteAlvo);
      let melhor = null;
      try {
        const base = poderDeCombate(alvo, dados);
        for (const cand of candidatos) {
          const poder = poderComItem(alvo, slot, cand, dados);
          const ganho = poder - base;
          if (!melhor || ganho > melhor.ganho) melhor = { item: cand, ganho };
        }
      } finally {
        restaurar();
      }

      const margem = equipadoAgora ? MARGEM_UPGRADE : 0;
      if (!melhor || melhor.ganho <= margem) continue;

      reservados.add(melhor.item.uid);
      const acao = {
        alvo,
        alvoNome: alvo.nome,
        slot,
        item: melhor.item,
        itemAnterior: equipadoAgora || null,
        ganho: melhor.ganho,
        motivo: equipadoAgora ? "upgrade" : "vazio",
      };
      aplicadosNesteAlvo.push(acao);
      acoes.push(acao);
    }
  }

  return acoes;
}

// Qual item está no slot considerando as ações já planejadas (mas ainda
// não aplicadas) deste mesmo personagem.
function slotAposAcoes(alvo, slot, acoes) {
  const planejada = acoes.find((a) => a.slot === slot);
  return planejada ? planejada.item : alvo.equipamento[slot];
}

// Aplica ações no personagem só pra medir e devolve uma função que desfaz
// tudo. Nunca persiste: quem persiste é aplicarPlanoEquipamento().
function aplicarTemporariamente(alvo, acoes) {
  const antes = acoes.map((a) => [a.slot, alvo.equipamento[a.slot]]);
  acoes.forEach((a) => (alvo.equipamento[a.slot] = a.item));
  return () => antes.forEach(([slot, item]) => (alvo.equipamento[slot] = item));
}

// Aplica de verdade: tira o item da mochila, veste no alvo, e devolve a
// peça anterior pra mochila (mesmo contrato de equiparItem()).
export function aplicarPlanoEquipamento(personagem, acoes) {
  const aplicadas = [];
  for (const acao of acoes) {
    // Revalida: entre planejar e aplicar o jogador pode ter vendido/usado
    // o item (o botão "Otimizar" mostra uma lista que fica na tela).
    const aindaNaMochila = personagem.inventario.some((i) => i.uid === acao.item.uid);
    if (!aindaNaMochila) continue;
    removerItem(personagem, acao.item.uid);
    const anterior = acao.alvo.equipamento[acao.slot];
    acao.alvo.equipamento[acao.slot] = acao.item;
    if (anterior) personagem.inventario.push(anterior);
    aplicadas.push(acao);
  }
  return aplicadas;
}

// ---------------------------------------------------------------------
// Preferência do jogador
// ---------------------------------------------------------------------
// Mesmo padrão de garantirConfigAutoBatalha/garantirEstadoDoMundo: mora
// dentro de `personagem`, então entra no save existente sem migração e
// sem campo novo no contrato de save.
export function garantirPrefAutoEquipar(personagem) {
  if (typeof personagem.autoEquiparVazios !== "boolean") personagem.autoEquiparVazios = true;
  return personagem.autoEquiparVazios;
}

// O que o jogo chama depois de qualquer entrada de item (baú, loot de
// batalha, coleta, forja, compra). Silencioso quando não há nada a fazer —
// é chamado o tempo todo.
export function autoEquiparSlotsVazios(personagem, time, dados) {
  if (!garantirPrefAutoEquipar(personagem)) return [];
  const plano = planejarEquipamento(personagem, time, dados, { incluirUpgrades: false });
  return aplicarPlanoEquipamento(personagem, plano);
}

// Texto curto pro aviso na tela ("🎽 Equipado: Espada de Ferro (Arma)").
// Agrupa por personagem quando o time inteiro recebeu peça, pra não virar
// seis mensagens seguidas.
export const LABEL_SLOT = {
  arma: "Arma",
  peito: "Peito",
  cabeca: "Cabeça",
  pes: "Pés",
  escudo: "Escudo",
  anel: "Anel",
  amuleto: "Amuleto",
};

export function textoAcoesEquipamento(acoes, personagemPrincipal) {
  if (!acoes.length) return "";
  const porAlvo = new Map();
  acoes.forEach((a) => {
    const chave = a.alvo === personagemPrincipal ? "" : a.alvoNome;
    if (!porAlvo.has(chave)) porAlvo.set(chave, []);
    porAlvo.get(chave).push(`${a.item.nome} (${LABEL_SLOT[a.slot] || a.slot})`);
  });
  return [...porAlvo.entries()]
    .map(([nome, itens]) => (nome ? `${nome}: ${itens.join(", ")}` : itens.join(", ")))
    .join(" · ");
}
