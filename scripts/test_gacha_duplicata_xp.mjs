// Smoke test para task #38: duplicata de gacha vira XP do próprio personagem
// (em vez de Fragmentos de Aethra).
import { estadoGachaInicial, invocarPermanente, invocarEvento, invocarIniciante } from "../src/systems/GachaSystem.js";
import { XP_DUPLICATA, CUSTO_INVOCACAO, BANNER_INICIANTE } from "../src/data/economyConfig.js";
import { xpParaNivel, calcularHpMax, calcularMpMax } from "../src/systems/CharacterFactory.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const gachaRoster = JSON.parse(fs.readFileSync(new URL("../src/data/gachaRoster.json", import.meta.url)));
const classes = JSON.parse(fs.readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const dados = { classes };

function personagem() {
  return { gacha: estadoGachaInicial() };
}

// Força invocações repetidas do MESMO personagem: satura o pity duro pra
// forçar lendários e usa o roster inteiro filtrado por um id só, simulando
// duplicata de forma determinística (sem depender de sorte).
function forcarDuplicata(p, rosterUmSo, dados) {
  p.gacha.fragmentos = CUSTO_INVOCACAO * 2;
  const r1 = invocarPermanente(p, rosterUmSo, dados); // primeira cópia: desbloqueia
  p.gacha.fragmentos = CUSTO_INVOCACAO * 2;
  const r2 = invocarPermanente(p, rosterUmSo, dados); // segunda cópia: duplicata
  return { r1, r2 };
}

// --- duplicata concede XP ao personagem já possuído, não mais Fragmentos ---
{
  const p = personagem();
  const alvo = gachaRoster.find((c) => c.id === "ashryn_folhaferrea");
  const rosterUmSo = [alvo];
  const { r1, r2 } = forcarDuplicata(p, rosterUmSo, dados);

  check("primeira invocação desbloqueia o personagem (não é duplicata)", r1.ok && r1.duplicata === false);
  check("segunda invocação do mesmo personagem é reconhecida como duplicata", r2.ok && r2.duplicata === true);
  check("duplicata não concede mais campo fragmentosConvertidos", r2.fragmentosConvertidos === undefined);
  check("duplicata concede xpConvertido igual ao valor configurado pra raridade", r2.xpConvertido === XP_DUPLICATA[alvo.raridade]);
  check("fragmentos do jogador não mudam por causa da duplicata (só pelo custo da invocação)", p.gacha.fragmentos === CUSTO_INVOCACAO * 2 - CUSTO_INVOCACAO);

  const instancia = p.gacha.personagensObtidos.find((i) => i.rosterId === alvo.id);
  check("XP da duplicata foi somado na instância já possuída", instancia.xp === XP_DUPLICATA[alvo.raridade] % xpParaNivel(1) || instancia.nivel > 1);
  check("continua existindo só 1 instância desse personagem (não duplicou a unidade)", p.gacha.personagensObtidos.filter((i) => i.rosterId === alvo.id).length === 1);
  check("contador de duplicatas incrementa", p.gacha.duplicatas[alvo.id] === 1);
}

// --- duplicata com XP suficiente sobe de nível e aplica crescimento (com `dados`) ---
{
  const p = personagem();
  // personagem lendário: XP_DUPLICATA.lendario = 250, bem mais que xpParaNivel(1) = 30,
  // deve garantir subida de nível.
  const alvoLendario = gachaRoster.find((c) => c.raridade === "lendario");
  const rosterUmSo = [alvoLendario];
  const { r2 } = forcarDuplicata(p, rosterUmSo, dados);

  const instancia = p.gacha.personagensObtidos.find((i) => i.rosterId === alvoLendario.id);
  check("XP de duplicata lendária é maior que o necessário pro nível 2", XP_DUPLICATA.lendario > xpParaNivel(1));
  check("instância sobe de nível com XP suficiente", instancia.nivel > 1);
  check("subiuNivel é reportado no retorno", r2.subiuNivelDuplicata && r2.subiuNivelDuplicata.length > 0);
  // Compara com a fórmula real (calcularHpMax/calcularMpMax), não com o
  // hpMax "de fábrica" do roster: alguns Lendários têm stats propositalmente
  // acima da curva de classe (bônus de raridade), então depois de um level up
  // real o valor recalculado pela fórmula pode legitimamente ficar abaixo do
  // valor inicial do roster — isso já era assim pra qualquer gacha que sobe
  // de nível em batalha (ganharXP + aplicarCrescimento em BattleUI.js), esta
  // task só reaproveita o mesmo pipeline pra duplicatas.
  check("hpMax/mpMax recalculados batem com a fórmula de crescimento real", instancia.hpMax === calcularHpMax(instancia, dados) && instancia.mpMax === calcularMpMax(instancia, dados));
}

// --- sem `dados`, duplicata ainda soma XP e nível, só não recalcula hp/mp ---
{
  const p = personagem();
  const alvoLendario = gachaRoster.find((c) => c.raridade === "lendario");
  const rosterUmSo = [alvoLendario];
  p.gacha.fragmentos = CUSTO_INVOCACAO * 2;
  invocarPermanente(p, rosterUmSo, null);
  p.gacha.fragmentos = CUSTO_INVOCACAO * 2;
  const r2 = invocarPermanente(p, rosterUmSo, null);
  const instancia = p.gacha.personagensObtidos.find((i) => i.rosterId === alvoLendario.id);
  check("sem `dados`, XP e nível ainda sobem", instancia.nivel > 1 && r2.xpConvertido > 0);
  check("sem `dados`, hpMax não muda (não tenta recalcular sem o catálogo de classes)", instancia.hpMax === alvoLendario.hpMax);
}

// --- funciona igual no banner de Evento e no banner Iniciante ---
{
  const p = personagem();
  const alvo = gachaRoster.find((c) => c.id === "ashryn_folhaferrea");
  const rosterUmSo = [alvo];
  p.gacha.fragmentos = CUSTO_INVOCACAO * 2;
  invocarEvento(p, rosterUmSo, dados);
  p.gacha.fragmentos = CUSTO_INVOCACAO * 2;
  const r2 = invocarEvento(p, rosterUmSo, dados);
  check("banner de Evento também converte duplicata em XP", r2.duplicata === true && r2.xpConvertido === XP_DUPLICATA[alvo.raridade]);
}
{
  const p = personagem();
  const alvo = gachaRoster.find((c) => c.id === "ashryn_folhaferrea");
  const rosterUmSo = [alvo];
  // gasta as invocações grátis do banner iniciante até garantir 2 puxadas do mesmo personagem
  const r1 = invocarIniciante(p, rosterUmSo, dados);
  const r2 = invocarIniciante(p, rosterUmSo, dados);
  check("banner Iniciante também converte duplicata em XP", r1.ok && r2.ok && r2.duplicata === true && r2.xpConvertido === XP_DUPLICATA[alvo.raridade]);
}

// --- estado sobrevive a JSON.stringify/parse (compatibilidade com o save) ---
{
  const p = personagem();
  const alvo = gachaRoster.find((c) => c.id === "ashryn_folhaferrea");
  const rosterUmSo = [alvo];
  forcarDuplicata(p, rosterUmSo, dados);
  const clonado = JSON.parse(JSON.stringify(p));
  const instancia = clonado.gacha.personagensObtidos.find((i) => i.rosterId === alvo.id);
  check("XP acumulado da duplicata sobrevive à serialização", instancia.xp > 0 || instancia.nivel > 1);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
