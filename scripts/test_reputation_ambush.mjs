// Regressão para a emboscada regional (melhoria de jogabilidade pós-backlog
// original): consequência de combate pra reputação regional muito negativa,
// além do preço de loja pior que já existia (multiplicadorPrecoLoja, ver
// test_world_state.mjs) — só que este é o lado de COMBATE da mesma ideia.
import { deveEmboscar, alterarReputacao } from "../src/systems/WorldStateSystem.js";
import { reforcarEmboscada } from "../src/systems/EncounterSystem.js";
import { criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const worldState = JSON.parse(fs.readFileSync(new URL("../src/data/worldStateVariables.json", import.meta.url)));

function personagemFake() {
  return { estadoDoMundo: { reputacao: {}, flags: {} } };
}

// Monkeypatch determinístico de Math.random pra testar o gate de chance sem
// depender de estatística — restaurado no final de cada bloco que usa.
function comRandomFixo(valor, fn) {
  const original = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = original; }
}

// --- deveEmboscar: precisa de facaoId ---
{
  const p = personagemFake();
  check("sem facaoId (null), nunca emboscar", !deveEmboscar(p, null, worldState));
  check("sem facaoId (undefined), nunca emboscar", !deveEmboscar(p, undefined, worldState));
}

// --- deveEmboscar: tiers neutros/positivos nunca emboscam, mesmo com sorte máxima ---
{
  const p = personagemFake();
  // Reputação neutra (0) e positiva (bem alta) com uma facção regional.
  const neutro = comRandomFixo(0, () => deveEmboscar(p, "guardioes_da_folha", worldState));
  check("reputação neutra nunca aciona emboscada, mesmo com o dado mais favorável possível", !neutro);

  alterarReputacao(p, "guardioes_da_folha", 80, worldState);
  const positivo = comRandomFixo(0, () => deveEmboscar(p, "guardioes_da_folha", worldState));
  check("reputação positiva (herói) nunca aciona emboscada", !positivo);
}

// --- deveEmboscar: tiers malvisto/hostil podem emboscar, respeitando a chance ---
{
  const p = personagemFake();
  alterarReputacao(p, "guardioes_da_folha", -70, worldState); // bem negativo -> tier "hostil"
  const comSorteRuim = comRandomFixo(0, () => deveEmboscar(p, "guardioes_da_folha", worldState));
  check("reputação hostil COM o dado favorável (0) aciona emboscada", comSorteRuim === true);
  const comSorteBoa = comRandomFixo(0.999, () => deveEmboscar(p, "guardioes_da_folha", worldState));
  check("reputação hostil COM o dado desfavorável (quase 1) não aciona (respeita a chance, não é 100%)", comSorteBoa === false);
}

// --- reforcarEmboscada: escala hp/atk/recompensa pra cima, preserva o resto, marca emboscada:true ---
{
  const m = { id: "lobo", nome: "Lobo", hp: 40, atk: 8, defesa: 3, vel: 6, elemento: "fisico", xp: 5, ouroMin: 2, ouroMax: 4 };
  const reforcado = reforcarEmboscada(m);
  check("emboscada aumenta o hp", reforcado.hp > m.hp);
  check("emboscada aumenta o ataque", reforcado.atk > m.atk);
  check("emboscada aumenta xp/ouro", reforcado.xp > m.xp && reforcado.ouroMin > m.ouroMin && reforcado.ouroMax > m.ouroMax);
  check("emboscada NÃO mexe na defesa (só o número/dano do ataque extra, não a resistência)", reforcado.defesa === m.defesa);
  check("emboscada preserva elemento/id/nome originais", reforcado.elemento === m.elemento && reforcado.id === m.id && reforcado.nome === m.nome);
  check("marca emboscada:true pra UI reconhecer", reforcado.emboscada === true);
  check("monstro original não é mutado (clone, não in-place)", m.emboscada === undefined && m.hp === 40);
}

// --- integração: criarCombatenteInimigo propaga o flag emboscada pro combatente ---
{
  const m = { id: "lobo", nome: "Lobo", hp: 40, atk: 8, defesa: 3, vel: 6, elemento: "fisico", xp: 5, ouroMin: 2, ouroMax: 4 };
  const reforcado = reforcarEmboscada(m);
  const combatente = criarCombatenteInimigo(reforcado, 0);
  check("combatente criado a partir de um monstro de emboscada carrega emboscada:true", combatente.emboscada === true);
  const combatenteNormal = criarCombatenteInimigo(m, 0);
  check("combatente normal (sem emboscada) fica com emboscada:false", combatenteNormal.emboscada === false);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
