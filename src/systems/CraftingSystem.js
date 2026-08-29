// Combina materiais coletados em itens, usando receitas de forja/alquimia.
import { contarItem, removerPorId, adicionarItem } from "./InventorySystem.js";

export function receitaDisponivel(personagem, receita) {
  return receita.ingredientes.every((ing) => contarItem(personagem, ing.itemId) >= ing.quantidade);
}

export function craftar(personagem, receita, itemsCatalog) {
  if (!receitaDisponivel(personagem, receita)) return { ok: false, msg: "Materiais insuficientes." };
  receita.ingredientes.forEach((ing) => removerPorId(personagem, ing.itemId, ing.quantidade));
  const resultado = itemsCatalog.find((i) => i.id === receita.resultadoId);
  if (resultado) adicionarItem(personagem, resultado, 1);
  return { ok: true, item: resultado };
}
