// Encantamento/aprimoramento de equipamento (melhoria de jogabilidade
// pós-backlog original): gasta ouro + materiais (minério, gema, os drops
// exclusivos de chefe já existem no inventário como "material" comum, ver
// task #45) pra subir o poder de um item já forjado/encontrado, em vez de
// só trocar por um item melhor. Funciona tanto com o item equipado quanto
// ainda no inventário — encontra pelo mesmo `uid` usado no resto do jogo.
//
// Guarda um snapshot do valor ORIGINAL (danoBase/defesaBase/bonusAtributoBase)
// na primeira vez que o item é aprimorado, e recalcula o valor atual a
// partir dele a cada nível — assim nunca acumula erro de arredondamento
// aplicando percentual em cima de percentual. Usa Math.ceil (nunca
// Math.round) pra garantir que mesmo um item com stat base baixo (ex.:
// defesa 2) sinta um ganho visível a cada nível — mesma lição aprendida no
// reforço de monstro solo (task #46).
import { contarItem, removerPorId } from "./InventorySystem.js";

export const MAX_NIVEL_APRIMORAMENTO = 5;
export const GANHO_POR_NIVEL = 0.08; // +8% do stat base por nível, cumulativo a partir do original

// Custo pra ir do nível atual (índice) pro próximo. CUSTO_POR_NIVEL[0] =
// custo de +0 -> +1, [4] = custo de +4 -> +5 (máximo).
export const CUSTO_POR_NIVEL = [
  { ouro: 15, materiais: [{ itemId: "minerio", quantidade: 2 }, { itemId: "madeira", quantidade: 1 }] },
  { ouro: 35, materiais: [{ itemId: "minerio", quantidade: 3 }, { itemId: "gema", quantidade: 1 }] },
  { ouro: 70, materiais: [{ itemId: "minerio_raro", quantidade: 2 }, { itemId: "gema", quantidade: 2 }] },
  { ouro: 130, materiais: [{ itemId: "minerio_raro", quantidade: 3 }, { itemId: "erva_rara", quantidade: 2 }] },
  { ouro: 220, materiais: [{ itemId: "gema_rara", quantidade: 1 }, { itemId: "minerio_raro", quantidade: 4 }] },
];

// Só arma/armadura/acessório têm um stat pra escalar — consumíveis e
// materiais nunca aparecem aqui (nem equipados, nem no inventário).
export function itemPodeSerAprimorado(item) {
  return !!item && ["arma", "armadura", "acessorio"].includes(item.tipo);
}

export function nivelAprimoramento(item) {
  return (item && item.aprimoramento) || 0;
}

// null quando já está no nível máximo (nada mais pra comprar).
export function custoProximoNivel(item) {
  const nivel = nivelAprimoramento(item);
  if (nivel >= MAX_NIVEL_APRIMORAMENTO) return null;
  return CUSTO_POR_NIVEL[nivel];
}

export function podeAprimorar(personagem, item) {
  if (!itemPodeSerAprimorado(item)) return { ok: false, msg: "Este item não pode ser aprimorado." };
  const custo = custoProximoNivel(item);
  if (!custo) return { ok: false, msg: "Item já está no nível máximo de aprimoramento (+" + MAX_NIVEL_APRIMORAMENTO + ")." };
  if (personagem.ouro < custo.ouro) return { ok: false, msg: "Ouro insuficiente." };
  const faltando = custo.materiais.filter((m) => contarItem(personagem, m.itemId) < m.quantidade);
  if (faltando.length) return { ok: false, msg: "Materiais insuficientes." };
  return { ok: true, custo };
}

// Acha o item pelo uid tanto no inventário quanto nos slots de equipamento
// (um item aprimorável só pode estar em um dos dois lugares por vez).
export function encontrarItemPorUid(personagem, uid) {
  const noInventario = personagem.inventario.find((i) => i.uid === uid);
  if (noInventario) return noInventario;
  for (const slot of Object.keys(personagem.equipamento)) {
    const equipado = personagem.equipamento[slot];
    if (equipado && equipado.uid === uid) return equipado;
  }
  return null;
}

function recalcularStats(item, novoNivel) {
  const mult = 1 + GANHO_POR_NIVEL * novoNivel;
  if (typeof item.dano === "number") {
    if (item.danoBase === undefined) item.danoBase = item.dano;
    item.dano = Math.ceil(item.danoBase * mult);
  }
  if (typeof item.defesa === "number") {
    if (item.defesaBase === undefined) item.defesaBase = item.defesa;
    item.defesa = Math.ceil(item.defesaBase * mult);
  }
  if (item.bonusAtributo && typeof item.bonusAtributo === "object") {
    if (!item.bonusAtributoBase) item.bonusAtributoBase = { ...item.bonusAtributo };
    Object.keys(item.bonusAtributoBase).forEach((attr) => {
      item.bonusAtributo[attr] = Math.ceil(item.bonusAtributoBase[attr] * mult);
    });
  }
  if (!item.nomeBase) item.nomeBase = item.nome;
  item.nome = `${item.nomeBase} +${novoNivel}`;
}

// Aprimora o item de `uid` em 1 nível, consumindo ouro + materiais. Muta o
// item em-lugar (o mesmo objeto continua equipado/no inventário depois),
// então nenhum outro sistema (equipar, defesaTotal, ataqueBase) precisa
// saber que aprimoramento existe — eles já leem item.dano/item.defesa
// diretamente.
export function aprimorarItem(personagem, uid) {
  const item = encontrarItemPorUid(personagem, uid);
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const checagem = podeAprimorar(personagem, item);
  if (!checagem.ok) return checagem;

  const { custo } = checagem;
  personagem.ouro -= custo.ouro;
  custo.materiais.forEach((m) => removerPorId(personagem, m.itemId, m.quantidade));

  const novoNivel = nivelAprimoramento(item) + 1;
  item.aprimoramento = novoNivel;
  recalcularStats(item, novoNivel);

  return { ok: true, item, novoNivel };
}
