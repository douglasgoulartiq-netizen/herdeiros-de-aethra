// Teste do pedido do jogador: equipar itens e usar curas em convocados do
// gacha, usando sempre o estoque (mochila/ouro) do personagem principal.
// Lógica pura (sem DOM) — a parte visual (botão "🎒 Equipar/Curar" na aba
// Time, submenu de alvo em batalha) é coberta por smoke test de navegador.
import { adicionarItem, equiparItem, desequiparItem, usarConsumivel, descansar } from "../src/systems/InventorySystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function principal() {
  return { nome: "Herói", inventario: [], equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null }, hp: 50, hpMax: 100, mp: 10, mpMax: 40 };
}

function convocado() {
  // Mesmo formato usado por instanciarPersonagemGacha() em GachaSystem.js —
  // sem `inventario` próprio de propósito (usa sempre o do principal).
  return { nome: "Convocado", equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null }, hp: 20, hpMax: 60, mp: 5, mpMax: 20 };
}

const espada = { id: "espada_ferro", nome: "Espada de Ferro", tipo: "arma", valor: 50, dano: 5, atributo: "FOR" };
const pocaoHP = { id: "pocao_vida_m", nome: "Poção de Vida Média", tipo: "consumivel", valor: 28, curaHP: 35 };

// --- equipar num convocado usa a mochila do principal e não a dele mesmo ---
{
  const p = principal();
  const c = convocado();
  adicionarItem(p, espada, 1);
  const uid = p.inventario[0].uid;
  const r = equiparItem(p, uid, c);
  check("equipar no convocado retorna ok", r.ok === true);
  check("a arma vai pro equipamento DO CONVOCADO, não do principal", c.equipamento.arma && c.equipamento.arma.id === "espada_ferro");
  check("o principal continua sem nada equipado", p.equipamento.arma === null);
  check("a arma some da mochila compartilhada", p.inventario.length === 0);
}

// --- desequipar do convocado devolve pra mochila compartilhada (do principal) ---
{
  const p = principal();
  const c = convocado();
  adicionarItem(p, espada, 1);
  equiparItem(p, p.inventario[0].uid, c);
  const r = desequiparItem(p, "arma", c);
  check("desequipar do convocado retorna ok", r.ok === true);
  check("o slot do convocado fica vazio", c.equipamento.arma === null);
  check("o item volta pra mochila do principal", p.inventario.length === 1 && p.inventario[0].id === "espada_ferro");
}

// --- usar poção de cura NO CONVOCADO consome da mochila do principal e cura o convocado ---
{
  const p = principal();
  const c = convocado();
  adicionarItem(p, pocaoHP, 1);
  const uid = p.inventario[0].uid;
  const r = usarConsumivel(p, uid, c);
  check("usar poção no convocado retorna ok", r.ok === true);
  check("o HP de quem cura (mensagem) e quem é curado batem: convocado sobe de 20 pra 55", c.hp === 55);
  check("o HP do principal não muda", p.hp === 50);
  check("a poção some da mochila do principal", p.inventario.length === 0);
  check("a mensagem menciona o nome do convocado (alvo diferente do dono do item)", r.msg.includes("Convocado"));
}

// --- cura não passa do hpMax do alvo ---
{
  const p = principal();
  const c = convocado();
  c.hp = 55; // só falta 5 pro máximo (60)
  adicionarItem(p, pocaoHP, 1); // cura 35, mas só cabe 5
  usarConsumivel(p, p.inventario[0].uid, c);
  check("cura não ultrapassa hpMax do alvo", c.hp === c.hpMax);
}

// --- usar sem passar alvo continua curando quem usa (comportamento antigo, sem regressão) ---
{
  const p = principal();
  adicionarItem(p, pocaoHP, 1);
  const r = usarConsumivel(p, p.inventario[0].uid);
  check("sem alvo explícito, cura o próprio personagem (compatibilidade com uso anterior)", p.hp === 85);
  check("mensagem sem alvo explícito continua no formato antigo (sem nome)", r.msg === "Recuperou 35 de HP.");
}

// --- equipar/desequipar sem alvo explícito continua no próprio personagem (compatibilidade) ---
{
  const p = principal();
  adicionarItem(p, espada, 1);
  equiparItem(p, p.inventario[0].uid);
  check("sem alvo explícito, equipa em si mesmo (compatibilidade com uso anterior)", p.equipamento.arma && p.equipamento.arma.id === "espada_ferro");
}

// --- descansar restaura HP/MP máximos do time inteiro (principal + convocados) ---
{
  const p = principal();
  const c1 = convocado();
  const c2 = convocado();
  c2.hp = 1; c2.mp = 0;
  descansar([p, c1, c2]);
  check("descansar leva HP do principal ao máximo", p.hp === p.hpMax);
  check("descansar leva MP do principal ao máximo", p.mp === p.mpMax);
  check("descansar leva HP do convocado 1 ao máximo", c1.hp === c1.hpMax);
  check("descansar leva HP do convocado 2 (quase morto) ao máximo", c2.hp === c2.hpMax);
  check("descansar leva MP do convocado 2 (zerado) ao máximo", c2.mp === c2.mpMax);
}

if (process.exitCode) {
  console.log("\nALGUM TESTE FALHOU");
} else {
  console.log("\nTODOS OS TESTES PASSARAM");
}
