// Smoke test para task #39: empilhamento de itens iguais na mochila (lógica
// pura, sem DOM — a parte visual/interativa é coberta por um teste Playwright
// à parte, rodado e descartado durante a implementação).
import { empilharInventario } from "../src/ui/GameUI.js";
import { adicionarItem, removerItem, venderItem } from "../src/systems/InventorySystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function personagem() {
  return { inventario: [], ouro: 0 };
}

const pocao = { id: "pocao_vida_m", nome: "Poção de Vida M", tipo: "consumivel", valor: 20, curaHP: 30 };
const espada = { id: "espada_ferro", nome: "Espada de Ferro", tipo: "arma", valor: 50 };

// --- itens idênticos (mesmo id) viram uma única pilha ---
{
  const p = personagem();
  adicionarItem(p, pocao, 3);
  const pilhas = empilharInventario(p.inventario);
  check("3 poções iguais viram 1 pilha só", pilhas.length === 1);
  check("a pilha reporta os 3 uids", pilhas[0].uids.length === 3);
  check("cada uid na pilha é único (itens continuam sendo objetos distintos)", new Set(pilhas[0].uids).size === 3);
}

// --- itens diferentes NÃO se misturam na mesma pilha ---
{
  const p = personagem();
  adicionarItem(p, pocao, 2);
  adicionarItem(p, espada, 1);
  const pilhas = empilharInventario(p.inventario);
  check("itens de ids diferentes formam pilhas separadas", pilhas.length === 2);
  const pilhaPocao = pilhas.find((pl) => pl.item.id === "pocao_vida_m");
  const pilhaEspada = pilhas.find((pl) => pl.item.id === "espada_ferro");
  check("pilha de poções tem 2 unidades", pilhaPocao.uids.length === 2);
  check("pilha de espada tem 1 unidade", pilhaEspada.uids.length === 1);
}

// --- mochila vazia não quebra ---
{
  check("mochila vazia gera lista de pilhas vazia", empilharInventario([]).length === 0);
}

// --- vender um item de uma pilha reduz só aquela pilha, sem afetar as outras ---
{
  const p = personagem();
  adicionarItem(p, pocao, 3);
  adicionarItem(p, espada, 2);
  let pilhas = empilharInventario(p.inventario);
  const umaPocao = pilhas.find((pl) => pl.item.id === "pocao_vida_m").uids[0];
  venderItem(p, umaPocao);
  pilhas = empilharInventario(p.inventario);
  check("pilha de poções perde 1 unidade após vender uma", pilhas.find((pl) => pl.item.id === "pocao_vida_m").uids.length === 2);
  check("pilha de espadas não é afetada", pilhas.find((pl) => pl.item.id === "espada_ferro").uids.length === 2);
}

// --- "vender tudo" de uma pilha remove exatamente aquela quantidade, calcula o total certo ---
{
  const p = personagem();
  adicionarItem(p, pocao, 4);
  const pilha = empilharInventario(p.inventario).find((pl) => pl.item.id === "pocao_vida_m");
  let total = 0;
  pilha.uids.forEach((uid) => { total += venderItem(p, uid); });
  check("vender tudo remove a pilha inteira da mochila", p.inventario.length === 0);
  check("valor total de vender tudo é a soma de cada unidade (preço x quantidade)", total === Math.max(1, Math.round(pocao.valor * 0.5)) * 4);
}

// --- ordem de descoberta das pilhas é estável (não embaralha a mochila) ---
{
  const p = personagem();
  adicionarItem(p, espada, 1);
  adicionarItem(p, pocao, 1);
  const pilhas = empilharInventario(p.inventario);
  check("pilhas aparecem na ordem em que o primeiro item de cada tipo foi adicionado", pilhas[0].item.id === "espada_ferro" && pilhas[1].item.id === "pocao_vida_m");
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
