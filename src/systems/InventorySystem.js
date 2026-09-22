// Gerencia inventário, equipamento e comércio.
import { multCuraRecebida } from "./IdentidadeSystem.js";
import { ehOleo, aplicarOleo } from "./WeaponOilSystem.js";
import { cryptoId } from "./CharacterFactory.js";

export const RARITY_COLORS = {
  comum: "#b0b0b0",
  incomum: "#4caf50",
  raro: "#3d8bfd",
  epico: "#a855f7",
  lendario: "#f5a524",
};

export const RARITY_LABEL = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

export function adicionarItem(personagem, itemBase, quantidade = 1) {
  for (let i = 0; i < quantidade; i++) {
    personagem.inventario.push({ ...itemBase, uid: cryptoId() });
  }
}

export function removerItem(personagem, uid) {
  const idx = personagem.inventario.findIndex((i) => i.uid === uid);
  if (idx >= 0) return personagem.inventario.splice(idx, 1)[0];
  return null;
}

export function removerPorId(personagem, itemId, quantidade = 1) {
  let restante = quantidade;
  for (let i = personagem.inventario.length - 1; i >= 0 && restante > 0; i--) {
    if (personagem.inventario[i].id === itemId) {
      personagem.inventario.splice(i, 1);
      restante -= 1;
    }
  }
  return restante === 0;
}

export function contarItem(personagem, itemId) {
  return personagem.inventario.filter((i) => i.id === itemId).length;
}

const SLOT_POR_TIPO = { arma: "arma", armadura: null, acessorio: null };

// Exportado (antes era privado) porque o auto-equipar precisa saber em que
// slot cada item da mochila cabe. Ter DUAS cópias dessa regra seria a
// receita clássica pro dia em que alguém adiciona um slot novo aqui e o
// automático continua ignorando ele — uma fonte de verdade só.
export function slotDoItem(item) {
  if (item.tipo === "arma") return "arma";
  if (item.tipo === "armadura") {
    return { peito: "peito", cabeca: "cabeca", pes: "pes", escudo: "escudo" }[item.slot] || null;
  }
  if (item.tipo === "acessorio") {
    return { anel: "anel", amuleto: "amuleto" }[item.slot] || null;
  }
  return null;
}

// `alvo` (pedido do jogador: equipar/curar convocados do gacha, não só o
// personagem principal) — quem "possui" a mochila/ouro continua sendo
// sempre `personagem` (só ele recebe itens de loja/loot/loot de batalha,
// ver adicionarItem), mas o item pode ser vestido em QUALQUER personagem
// jogável do time (o principal ou um convocado do gacha — ambos já têm o
// mesmo formato de `equipamento`, ver CharacterFactory.js/GachaSystem.js).
// Sem passar `alvo`, o comportamento é idêntico a antes (equipa em si
// mesmo) — todo chamador existente continua funcionando sem mudança.
export function equiparItem(personagem, uid, alvo = personagem) {
  const item = personagem.inventario.find((i) => i.uid === uid);
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const slot = slotDoItem(item);
  if (!slot) return { ok: false, msg: "Este item não pode ser equipado." };
  const anterior = alvo.equipamento[slot];
  alvo.equipamento[slot] = item;
  removerItem(personagem, uid);
  if (anterior) personagem.inventario.push(anterior);
  return { ok: true };
}

export function desequiparItem(personagem, slot, alvo = personagem) {
  const item = alvo.equipamento[slot];
  if (!item) return { ok: false };
  alvo.equipamento[slot] = null;
  personagem.inventario.push(item);
  return { ok: true };
}

// Mesma ideia de `alvo` acima, agora para consumíveis: o item sai da
// mochila de `personagem` (sempre o principal, dono do estoque
// compartilhado), mas o efeito de cura/remoção de status é aplicado em
// `alvo` — permite curar um convocado do gacha usando um item da mochila
// do personagem principal, tanto fora quanto dentro de batalha (ver
// BattleUI.js). Mensagem menciona o nome só quando `alvo` é outra pessoa,
// pra manter o texto exatamente igual a antes no uso em si mesmo.
export function usarConsumivel(personagem, uid, alvo = personagem) {
  const item = personagem.inventario.find((i) => i.uid === uid);
  if (!item || item.tipo !== "consumivel") return { ok: false, msg: "Não é possível usar este item." };
  const emOutroAlvo = alvo !== personagem;
  let msg = "";
  if (item.curaHP) {
    // Motivação Redenção (+15% de cura recebida) — vale para o herói, que é
    // quem tem motivação; convocados curam o valor do item.
    const cura = Math.round(item.curaHP * multCuraRecebida(alvo));
    alvo.hp = Math.min(alvo.hpMax, alvo.hp + cura);
    msg = emOutroAlvo ? `${alvo.nome} recuperou ${cura} de HP.` : `Recuperou ${cura} de HP.`;
  }
  if (item.curaMP) {
    alvo.mp = Math.min(alvo.mpMax, alvo.mp + item.curaMP);
    msg = emOutroAlvo ? `${alvo.nome} recuperou ${item.curaMP} de MP.` : `Recuperou ${item.curaMP} de MP.`;
  }
  if (item.removeStatus) {
    alvo.statusEffects = [];
    msg = emOutroAlvo ? `Efeitos negativos de ${alvo.nome} removidos.` : "Efeitos negativos removidos.";
  }
  // Óleo de arma (ver WeaponOilSystem.js). Estes seis itens declaravam
  // `oleoElemento` e `duracaoTurnos` desde sempre e NINGUÉM lia: o item era
  // removido logo abaixo e o jogador ficava sem o óleo e sem o efeito.
  // Unta sempre QUEM VAI LUTAR — por isso `alvo`, e não `personagem`.
  if (ehOleo(item)) {
    const texto = aplicarOleo(alvo, item);
    msg = emOutroAlvo ? `${alvo.nome}: ${texto}` : texto;
  }
  removerItem(personagem, uid);
  return { ok: true, msg };
}

// Descansar (pedido do jogador): restaura HP e MP máximos do time inteiro
// de uma vez, fora de batalha. Sem custo/restrição de local por enquanto —
// o mundo aberto ainda não modela pousada/cidade-abrigo (ver
// world-narrative-content.md pra uma versão futura com custo ou risco
// associado). `time` é sempre [personagem, ...membrosDoTime(personagem)]
// (ver main.js), então cobre o principal e os convocados do gacha juntos.
export function descansar(time) {
  time.forEach((p) => {
    p.hp = p.hpMax;
    p.mp = p.mpMax;
  });
}

export function venderItem(personagem, uid) {
  const item = removerItem(personagem, uid);
  if (!item) return 0;
  const valor = Math.max(1, Math.round((item.valor || 1) * 0.5));
  personagem.ouro += valor;
  return valor;
}

// Venda rápida conservadora: limpa equipamento comum e excesso de itens
// empilháveis, mas nunca encosta em raridade rara+, item equipado ou nas
// últimas unidades úteis. A prévia e a venda usam a mesma seleção para o
// jogador sempre receber exatamente o valor mostrado na confirmação.
export function itensParaVendaEmLote(personagem) {
  const inventario = personagem.inventario || [];
  const porId = new Map();
  inventario.forEach((item) => {
    const lista = porId.get(item.id) || [];
    lista.push(item);
    porId.set(item.id, lista);
  });
  const selecionados = [];
  for (const lista of porId.values()) {
    const item = lista[0];
    if (!item || item.raridade !== "comum") continue;
    if (["arma", "armadura", "acessorio"].includes(item.tipo)) selecionados.push(...lista);
    else if (item.tipo === "consumivel" && lista.length > 5) selecionados.push(...lista.slice(5));
    else if (item.tipo === "material" && lista.length > 20) selecionados.push(...lista.slice(20));
  }
  return selecionados;
}

export function previaVendaEmLote(personagem) {
  const itens = itensParaVendaEmLote(personagem);
  return {
    quantidade: itens.length,
    valor: itens.reduce((soma, item) => soma + Math.max(1, Math.round((item.valor || 1) * 0.5)), 0),
  };
}

export function venderItensEmLote(personagem) {
  const itens = itensParaVendaEmLote(personagem);
  let valor = 0;
  itens.forEach((item) => { valor += venderItem(personagem, item.uid); });
  return { quantidade: itens.length, valor };
}

export function custoServicoLoja(personagem, servicoId) {
  const nivel = Math.max(1, personagem.nivel || 1);
  if (servicoId === "recuperar_time") return 35 + nivel * 8;
  if (servicoId === "bencao_fortuna") return 160 + nivel * 12;
  return Infinity;
}

export function comprarServicoLoja(personagem, servicoId, time = [personagem]) {
  const custo = custoServicoLoja(personagem, servicoId);
  if (!Number.isFinite(custo)) return { ok: false, msg: "Serviço indisponível." };
  if ((personagem.ouro || 0) < custo) return { ok: false, msg: `Faltam ${custo - (personagem.ouro || 0)} de ouro.` };
  personagem.ouro -= custo;
  if (servicoId === "recuperar_time") {
    descansar(time.length ? time : [personagem]);
    return { ok: true, custo, msg: "O grupo recuperou todo o HP e MP." };
  }
  personagem.bausAbençoados = Math.max(0, personagem.bausAbençoados || 0) + 3;
  return { ok: true, custo, msg: "Os próximos 3 baús terão uma recompensa extra." };
}

// `multiplicadorPreco` (padrão 1 = preço normal) permite que a loja reflita
// a reputação do personagem com a vila (ver WorldStateSystem.js) sem esse
// módulo precisar conhecer nada sobre reputação — só recebe o número já
// calculado e aplica no preço final.
export function comprarItem(personagem, itemBase, multiplicadorPreco = 1) {
  const preco = Math.max(1, Math.round(itemBase.valor * multiplicadorPreco));
  if (personagem.ouro < preco) return { ok: false, msg: "Ouro insuficiente." };
  personagem.ouro -= preco;
  adicionarItem(personagem, itemBase, 1);
  return { ok: true, preco };
}

export function comprarLote(personagem, itemBase, quantidade, multiplicadorPreco = 1, valorUnitario = null) {
  const qtd = Math.max(1, Math.floor(quantidade || 1));
  const unitario = valorUnitario == null ? (itemBase.valor || 1) : valorUnitario;
  const preco = Math.max(1, Math.round(unitario * qtd * multiplicadorPreco));
  if (personagem.ouro < preco) return { ok: false, msg: "Ouro insuficiente." };
  personagem.ouro -= preco;
  adicionarItem(personagem, itemBase, qtd);
  return { ok: true, preco, quantidade: qtd };
}

export function sortearRaridade(raridades, bonusRaroPercent = 0) {
  const pesos = raridades.map((r) => (r.ordem >= 2 ? r.peso * (1 + bonusRaroPercent) : r.peso));
  const total = pesos.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < raridades.length; i++) {
    if (roll < pesos[i]) return raridades[i].id;
    roll -= pesos[i];
  }
  return raridades[0].id;
}

// Todas as quedas de UMA tabela, de uma vez.
//
// `chanceDrop` decide SE cai; `quedas` (opcional, padrão 1) decide QUANTAS
// rolagens acontecem quando cai. É assim que um chefe passa a ser generoso
// em quantidade em vez de em raridade — ver scripts/gerar-loot.mjs, onde a
// tabela de chefe ganhou `quedas: 2` e o peso do lendário caiu para 10.
//
// Uma tabela sem o campo `quedas` continua valendo exatamente 1: nenhuma
// tabela antiga muda de comportamento por este acréscimo.
export function rolarQuedas(tabela, itemsCatalog) {
  if (!tabela || !tabela.pool || !tabela.pool.length) return [];
  if (Math.random() >= (tabela.chanceDrop != null ? tabela.chanceDrop : 0)) return [];
  const quantas = Math.max(1, Math.floor(tabela.quedas || 1));
  const saida = [];
  for (let i = 0; i < quantas; i++) {
    const item = sortearLoot(tabela.pool, itemsCatalog);
    if (item) saida.push(item);
  }
  return saida;
}

export function sortearLoot(pool, itemsCatalog) {
  const total = pool.reduce((a, p) => a + p.peso, 0);
  let roll = Math.random() * total;
  for (const p of pool) {
    if (roll < p.peso) return itemsCatalog.find((i) => i.id === p.itemId) || null;
    roll -= p.peso;
  }
  return null;
}
