// Regressão para o Mercador Itinerante (melhoria de jogabilidade
// pós-backlog original, ver TravelingMerchantSystem.js/
// TravelingMerchantUI.js/main.js: verificarEncontroAleatorio). NPC temporário
// que vende um catálogo EXCLUSIVO (nunca aparece na loja fixa da vila, que
// só vende comum/incomum — ver GameUI.montarLoja) com preço reagindo à
// reputação REGIONAL da zona onde aparece.
import { deveAparecerMercador, sortearEstoqueMercador } from "../src/systems/TravelingMerchantSystem.js";
import { multiplicadorPrecoLoja, alterarReputacao } from "../src/systems/WorldStateSystem.js";
import { comprarItem } from "../src/systems/InventorySystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const catalogoExclusivo = JSON.parse(fs.readFileSync(new URL("../src/data/travelingMerchant.json", import.meta.url)));
const itensNormais = JSON.parse(fs.readFileSync(new URL("../src/data/items.json", import.meta.url)));
const worldState = JSON.parse(fs.readFileSync(new URL("../src/data/worldStateVariables.json", import.meta.url)));

function personagem(ouro = 1000) {
  return { ouro, inventario: [] };
}

// --- deveAparecerMercador: taxa estatística perto do esperado ---
{
  const N = 20000;
  const chance = 0.01;
  let disparos = 0;
  for (let i = 0; i < N; i++) if (deveAparecerMercador(chance)) disparos++;
  const taxa = disparos / N;
  check(`deveAparecerMercador(0.01) dispara perto de 1% das vezes (achou ${(taxa * 100).toFixed(2)}%)`, taxa > 0.006 && taxa < 0.015);
  check("deveAparecerMercador(0) nunca dispara", !deveAparecerMercador(0));
  check("deveAparecerMercador(1) sempre dispara", deveAparecerMercador(1));
}

// --- catálogo exclusivo: schema básico e nenhum id colide com items.json (loja fixa) ---
{
  check("catálogo do mercador itinerante tem pelo menos 3 itens", catalogoExclusivo.length >= 3);
  const idsNormais = new Set(itensNormais.itens.map((i) => i.id));
  catalogoExclusivo.forEach((item) => {
    check(`${item.id}: tem id/nome/tipo/raridade/valor/icone/descricao`, !!item.id && !!item.nome && !!item.tipo && !!item.raridade && typeof item.valor === "number" && !!item.icone && !!item.descricao);
    check(`${item.id}: NÃO existe na loja fixa da vila (items.json) — é exclusivo de verdade`, !idsNormais.has(item.id));
    check(`${item.id}: raridade é raro+ (a loja fixa só vende comum/incomum — ver GameUI.montarLoja)`, item.raridade !== "comum" && item.raridade !== "incomum");
    if (item.tipo === "arma") check(`${item.id} (arma): tem dano e atributo`, typeof item.dano === "number" && !!item.atributo);
    if (item.tipo === "armadura") check(`${item.id} (armadura): tem defesa e slot`, typeof item.defesa === "number" && !!item.slot);
    if (item.tipo === "acessorio") check(`${item.id} (acessório): tem slot e bonusAtributo`, !!item.slot && !!item.bonusAtributo);
    if (item.tipo === "consumivel") check(`${item.id} (consumível): tem curaHP e/ou curaMP`, typeof item.curaHP === "number" || typeof item.curaMP === "number");
  });
}

// --- sortearEstoqueMercador: tamanho, sem duplicatas, não muta o catálogo original ---
{
  const original = [...catalogoExclusivo];
  const estoque = sortearEstoqueMercador(catalogoExclusivo, 3);
  check("estoque sorteado tem o tamanho pedido (catálogo tem itens suficientes)", estoque.length === 3);
  check("nenhum item repetido no estoque sorteado", new Set(estoque.map((i) => i.id)).size === estoque.length);
  check("todo item do estoque veio do catálogo real", estoque.every((i) => catalogoExclusivo.some((c) => c.id === i.id)));
  check("sortearEstoqueMercador não muta o array original do catálogo", JSON.stringify(catalogoExclusivo) === JSON.stringify(original));
}

// --- sortearEstoqueMercador: pedir mais itens que o catálogo tem devolve o catálogo inteiro, sem duplicar ---
{
  const estoque = sortearEstoqueMercador(catalogoExclusivo, 999);
  check("pedir mais que o catálogo tem devolve o catálogo inteiro (sem inventar itens)", estoque.length === catalogoExclusivo.length);
  check("catálogo vazio/undefined não quebra", sortearEstoqueMercador([], 3).length === 0 && sortearEstoqueMercador(undefined, 3).length === 0);
}

// --- multiplicadorPrecoLoja agora aceita facção regional (não só "vila") ---
{
  const p = personagem();
  alterarReputacao(p, "guardioes_da_folha", 80, worldState);
  const multRegional = multiplicadorPrecoLoja(p, worldState, "guardioes_da_folha");
  check("desconto de reputação REGIONAL funciona (herói da facção paga menos)", multRegional < 1);
  const multVilaAindaZero = multiplicadorPrecoLoja(p, worldState, "vila");
  check("reputação com a vila continua intacta (0), sem vazar da regional", multVilaAindaZero === 1);
  const multPadrao = multiplicadorPrecoLoja(p, worldState);
  check("omitir facaoId continua defaultando pra 'vila' (compatibilidade com a loja fixa)", multPadrao === multVilaAindaZero);
}

// --- comprarItem funciona de ponta a ponta com um item exclusivo do mercador ---
{
  const item = catalogoExclusivo[0];
  const p = personagem(1000);
  const r = comprarItem(p, item, 1);
  check("comprar um item exclusivo do mercador funciona (ok:true)", r.ok === true);
  check("ouro deduzido pelo preço correto", p.ouro === 1000 - item.valor);
  check("item exclusivo entra no inventário com todos os campos originais preservados", p.inventario.some((i) => i.id === item.id && i.nome === item.nome));
}

// --- comprarItem recusa quando o ouro não é suficiente, mesmo pra item exclusivo ---
{
  const item = catalogoExclusivo.find((i) => i.valor > 10) || catalogoExclusivo[0];
  const p = personagem(1);
  const r = comprarItem(p, item, 1);
  check("sem ouro suficiente, a compra é recusada (ok:false)", r.ok === false);
  check("ouro não muda quando a compra é recusada", p.ouro === 1);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== test_traveling_merchant.mjs passou ===");
