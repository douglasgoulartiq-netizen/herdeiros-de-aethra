// Regressão para o aprimoramento de equipamento (melhoria de jogabilidade
// pós-backlog original, ver EnchantSystem.js).
import {
  itemPodeSerAprimorado, nivelAprimoramento, custoProximoNivel, podeAprimorar,
  aprimorarItem, encontrarItemPorUid, MAX_NIVEL_APRIMORAMENTO, CUSTO_POR_NIVEL,
} from "../src/systems/EnchantSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function personagemFake(overrides = {}) {
  return {
    ouro: 1000,
    inventario: [],
    equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
    ...overrides,
  };
}

function espadaFake(uid = "esp1") {
  return { uid, id: "espada_comum", nome: "Espada Enferrujada", tipo: "arma", subtipo: "espada", dano: 6, atributo: "FOR", valor: 15, raridade: "comum" };
}

function materialFarto(personagem, nivel) {
  // Dá materiais de sobra pra cobrir os custos até o nível pedido.
  for (let i = 0; i < nivel; i++) {
    CUSTO_POR_NIVEL[i].materiais.forEach((m) => {
      for (let q = 0; q < m.quantidade + 5; q++) personagem.inventario.push({ id: m.itemId, uid: `mat_${m.itemId}_${i}_${q}` });
    });
  }
}

// --- itemPodeSerAprimorado: só arma/armadura/acessório ---
{
  check("arma pode ser aprimorada", itemPodeSerAprimorado({ tipo: "arma" }));
  check("armadura pode ser aprimorada", itemPodeSerAprimorado({ tipo: "armadura" }));
  check("acessório pode ser aprimorado", itemPodeSerAprimorado({ tipo: "acessorio" }));
  check("consumível NÃO pode ser aprimorado", !itemPodeSerAprimorado({ tipo: "consumivel" }));
  check("material NÃO pode ser aprimorado", !itemPodeSerAprimorado({ tipo: "material" }));
  check("null não quebra", !itemPodeSerAprimorado(null));
}

// --- aprimorarItem no inventário: consome ouro/materiais e sobe o dano ---
{
  const p = personagemFake();
  const espada = espadaFake();
  p.inventario.push(espada);
  materialFarto(p, 1);
  const ouroAntes = p.ouro;
  const danoAntes = espada.dano;
  const res = aprimorarItem(p, "esp1");
  check("aprimorarItem retorna ok:true", res.ok === true);
  check("nível do item sobe pra +1", nivelAprimoramento(espada) === 1);
  check("dano do item aumenta", espada.dano > danoAntes);
  check("ouro foi descontado", p.ouro === ouroAntes - CUSTO_POR_NIVEL[0].ouro);
  check("nome do item ganha o sufixo +1", espada.nome.endsWith(" +1"));
  check("danoBase guarda o valor original", espada.danoBase === danoAntes);
}

// --- aprimorar até o máximo, depois rejeita ---
{
  const p = personagemFake();
  const espada = espadaFake();
  p.inventario.push(espada);
  materialFarto(p, MAX_NIVEL_APRIMORAMENTO);
  for (let i = 0; i < MAX_NIVEL_APRIMORAMENTO; i++) {
    const r = aprimorarItem(p, "esp1");
    check(`aprimoramento ${i + 1}/${MAX_NIVEL_APRIMORAMENTO} funciona`, r.ok === true);
  }
  check(`item chegou no nível máximo (+${MAX_NIVEL_APRIMORAMENTO})`, nivelAprimoramento(espada) === MAX_NIVEL_APRIMORAMENTO);
  check("custoProximoNivel retorna null no máximo", custoProximoNivel(espada) === null);
  const rejeitado = aprimorarItem(p, "esp1");
  check("tentar aprimorar além do máximo falha", rejeitado.ok === false);
  check("dano final é maior que o dano base original", espada.dano > espada.danoBase);
}

// --- ouro insuficiente rejeita sem consumir nada ---
{
  const p = personagemFake({ ouro: 0 });
  const espada = espadaFake();
  p.inventario.push(espada);
  materialFarto(p, 1);
  const antes = { ouro: p.ouro, dano: espada.dano, nivel: nivelAprimoramento(espada), inv: p.inventario.length };
  const res = aprimorarItem(p, "esp1");
  check("aprimorar sem ouro suficiente falha", res.ok === false);
  check("nada muda quando falha por falta de ouro", p.ouro === antes.ouro && espada.dano === antes.dano && nivelAprimoramento(espada) === antes.nivel && p.inventario.length === antes.inv);
}

// --- materiais insuficientes rejeita sem consumir ouro ---
{
  const p = personagemFake();
  const espada = espadaFake();
  p.inventario.push(espada); // sem nenhum material extra
  const ouroAntes = p.ouro;
  const res = aprimorarItem(p, "esp1");
  check("aprimorar sem materiais suficientes falha", res.ok === false);
  check("ouro não é descontado quando falha por falta de material", p.ouro === ouroAntes);
}

// --- funciona também com o item EQUIPADO (não só na mochila) ---
{
  const p = personagemFake();
  const espada = espadaFake("esp_equipada");
  p.equipamento.arma = espada;
  materialFarto(p, 1);
  check("encontrarItemPorUid acha item equipado", encontrarItemPorUid(p, "esp_equipada") === espada);
  const res = aprimorarItem(p, "esp_equipada");
  check("aprimorar item equipado funciona", res.ok === true && nivelAprimoramento(p.equipamento.arma) === 1);
}

// --- armadura (campo defesa) e acessório (bonusAtributo) escalam corretamente ---
{
  const p = personagemFake();
  const armadura = { uid: "arm1", id: "armadura_comum", nome: "Armadura de Couro", tipo: "armadura", subtipo: "armadura", slot: "peito", defesa: 5, valor: 20, raridade: "comum" };
  const anel = { uid: "anel1", id: "anel_forca", nome: "Anel da Força", tipo: "acessorio", slot: "anel", bonusAtributo: { FOR: 2 }, valor: 80, raridade: "raro" };
  p.inventario.push(armadura, anel);
  materialFarto(p, 1);
  const defesaAntes = armadura.defesa;
  const r1 = aprimorarItem(p, "arm1");
  check("aprimorar armadura sobe a defesa", r1.ok && armadura.defesa > defesaAntes);
  materialFarto(p, 1);
  const forAntes = anel.bonusAtributo.FOR;
  const r2 = aprimorarItem(p, "anel1");
  check("aprimorar acessório sobe o bonusAtributo", r2.ok && anel.bonusAtributo.FOR > forAntes);
}

// --- item não encontrado / não aprimorável ---
{
  const p = personagemFake();
  const res1 = aprimorarItem(p, "uid_inexistente");
  check("uid inexistente retorna ok:false", res1.ok === false);
  const pocao = { uid: "poc1", id: "pocao_vida_p", nome: "Poção", tipo: "consumivel", valor: 5 };
  p.inventario.push(pocao);
  const check2 = podeAprimorar(p, pocao);
  check("podeAprimorar recusa consumível", check2.ok === false);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
