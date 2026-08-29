// Smoke test para task #46: monstro solo reforçado — como o time agora tem
// até 4 personagens (task #43), uma luta contra 1 monstro só ficava trivial;
// agora esse monstro entra reforçado (mais vida/ataque/defesa) e dá mais
// XP/ouro em troca, só quando está sozinho contra o grupo.
import { reforcarMonstroSolo, sortearEncontroDeLista, sortearEncontro } from "../src/systems/EncounterSystem.js";
import { criarCombatenteInimigo } from "../src/systems/CombatSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", bioma: ["floresta"], hp: 30, atk: 8, defesa: 2, vel: 5, elemento: "fisico", xp: 5, ouroMin: 1, ouroMax: 2, arquetipo: "agressor", ...overrides };
}

// --- reforcarMonstroSolo: aplica os multiplicadores certos, sem mutar o original ---
{
  const original = monstroBase();
  const reforcado = reforcarMonstroSolo(original);
  check("hp reforçado é maior que o original", reforcado.hp > original.hp);
  check("atk reforçado é maior que o original", reforcado.atk > original.atk);
  check("defesa reforçada é maior que a original", reforcado.defesa > original.defesa);
  check("xp reforçado é maior que o original", reforcado.xp > original.xp);
  check("ouroMin/ouroMax reforçados são maiores que os originais", reforcado.ouroMin > original.ouroMin && reforcado.ouroMax > original.ouroMax);
  check("marca solo:true", reforcado.solo === true);
  check("não muta o objeto original (mesmos valores de antes)", original.hp === 30 && original.atk === 8 && original.solo === undefined);
  check("mantém id/nome/elemento intactos", reforcado.id === original.id && reforcado.nome === original.nome && reforcado.elemento === original.elemento);
}

// --- sortearEncontroDeLista: só reforça quando o grupo sai com 1 monstro ---
{
  const candidatos = [monstroBase({ id: "goblin" }), monstroBase({ id: "lobo" })];
  let vistosSolo = 0, vistosGrupo = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const grupo = sortearEncontroDeLista(candidatos);
    if (grupo.length === 1) {
      vistosSolo++;
      if (!grupo[0].solo || grupo[0].hp <= 30) { vistosSolo = -999999; break; } // marca falha catastrófica
    } else if (grupo.length >= 2) {
      vistosGrupo++;
      if (grupo.some((m) => m.solo)) { vistosGrupo = -999999; break; }
    }
  }
  check("todo encontro de 1 monstro vem reforçado (solo:true, hp maior)", vistosSolo > 0);
  check("nenhum encontro de 2-3 monstros vem reforçado (grupo normal)", vistosGrupo > 0);
  check(`distribuição amostrada é plausível (~70% solo, achou solo=${vistosSolo}, grupo=${vistosGrupo} em ${N})`, vistosSolo > N * 0.5 && vistosSolo < N * 0.85);
}

// --- sortearEncontro (bioma) segue a mesma regra ---
{
  const monstros = [monstroBase({ id: "goblin", bioma: ["floresta"] })];
  let achouSolo = false;
  for (let i = 0; i < 200 && !achouSolo; i++) {
    const grupo = sortearEncontro("floresta", monstros);
    if (grupo.length === 1 && grupo[0].solo) achouSolo = true;
  }
  check("sortearEncontro (bioma) também reforça encontros de 1 monstro", achouSolo);
}

// --- criarCombatenteInimigo repassa o flag `solo` pro combatente ---
{
  const reforcado = reforcarMonstroSolo(monstroBase());
  const combatenteSolo = criarCombatenteInimigo(reforcado, 0);
  check("combatente criado a partir de um monstro reforçado tem solo:true", combatenteSolo.solo === true);
  const combatenteNormal = criarCombatenteInimigo(monstroBase(), 0);
  check("combatente de um monstro normal (não passou por reforcarMonstroSolo) tem solo:false", combatenteNormal.solo === false);
  check("combatente reforçado realmente tem hp maior que o monstro base (30)", combatenteSolo.hpMax > 30);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
