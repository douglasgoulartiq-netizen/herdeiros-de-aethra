// Smoke test para task #44: 10 facções regionais (regionalidade do mapa) +
// afiliação de personagens (regionalidade dos personagens) + camaradagem
// regional em combate. Cobre integridade dos dados, o sistema puro
// (WorldStateSystem.js) e a integração com o combatente (BattleUI.js usa
// aplicarCamaradagemNoCombatente — testado aqui isoladamente, sem precisar
// montar uma Batalha inteira).
import {
  facaoDaZona, facaoInfo, afiliarFaccao, facaoAfiliada,
  bonusCamaradagemFaccao, aplicarCamaradagemNoCombatente,
  garantirEstadoDoMundo, getReputacao, alterarReputacao,
} from "../src/systems/WorldStateSystem.js";
import { ZONAS } from "../src/data/worldMap.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const worldStateVariables = JSON.parse(fs.readFileSync(new URL("../src/data/worldStateVariables.json", import.meta.url)));
const gachaRoster = JSON.parse(fs.readFileSync(new URL("../src/data/gachaRoster.json", import.meta.url)));
const facaoIds = new Set(worldStateVariables.facoes.map((f) => f.id));
const zonaIds = new Set(ZONAS.map((z) => z.id));

// --- Integridade dos dados ---
{
  check("existem 11 facções (vila + 10 regionais)", worldStateVariables.facoes.length === 11);
  const regionais = worldStateVariables.facoes.filter((f) => f.id !== "vila");
  check("existem exatamente 10 facções regionais", regionais.length === 10);
  check("toda facção regional tem ao menos 1 zona", regionais.every((f) => Array.isArray(f.zonas) && f.zonas.length > 0));
  check("toda facção regional tem ícone", regionais.every((f) => f.icone && f.icone.length > 0));
  const zonasInvalidas = regionais.flatMap((f) => f.zonas).filter((zId) => !zonaIds.has(zId));
  check("toda zona listada em alguma facção existe em ZONAS (worldMap.js)", zonasInvalidas.length === 0);
  // Cada zona de combate (exceto vila) pertence a exatamente 1 facção regional.
  const zonasDeCombate = ZONAS.filter((z) => z.id !== "vila").map((z) => z.id);
  const semFaccao = zonasDeCombate.filter((zId) => !facaoDaZona(zId, worldStateVariables));
  check("toda zona de combate pertence a alguma facção regional", semFaccao.length === 0);
  const zonaContagem = {};
  regionais.forEach((f) => f.zonas.forEach((zId) => { zonaContagem[zId] = (zonaContagem[zId] || 0) + 1; }));
  const duplicadas = Object.entries(zonaContagem).filter(([, n]) => n > 1);
  check("nenhuma zona pertence a mais de uma facção regional ao mesmo tempo", duplicadas.length === 0);

  check("todo personagem do gacha tem facaoId válido", gachaRoster.every((p) => p.facaoId && facaoIds.has(p.facaoId)));
}

// --- facaoDaZona / facaoInfo ---
{
  check("deserto_karn pertence à Caravana de Karn (exemplo do pedido original)", facaoDaZona("deserto_karn", worldStateVariables) === "caravana_de_karn");
  check("zona inexistente não quebra (retorna null)", facaoDaZona("zona_que_nao_existe", worldStateVariables) === null);
  check("facaoInfo retorna a entrada completa", facaoInfo("caravana_de_karn", worldStateVariables).nome === "Caravana de Karn");
  check("facaoInfo de id inexistente retorna null", facaoInfo("nao_existe", worldStateVariables) === null);
}

// --- afiliarFaccao / facaoAfiliada ---
{
  const personagem = {};
  check("sem afiliação definida, facaoAfiliada retorna null", facaoAfiliada(personagem) === null);
  afiliarFaccao(personagem, "guardioes_da_folha");
  check("afiliarFaccao define a afiliação", facaoAfiliada(personagem) === "guardioes_da_folha");
  afiliarFaccao(personagem, "forja_dos_anoes_cinzentos");
  check("afiliação pode ser trocada livremente", facaoAfiliada(personagem) === "forja_dos_anoes_cinzentos");
  const clonado = JSON.parse(JSON.stringify(personagem));
  check("afiliação sobrevive à serialização (save)", facaoAfiliada(clonado) === "forja_dos_anoes_cinzentos");
}

// --- bonusCamaradagemFaccao ---
{
  const principal = {};
  afiliarFaccao(principal, "caravana_de_karn");
  const aliadoMesmaFaccao = { facaoId: "caravana_de_karn" };
  const aliadoOutraFaccao = { facaoId: "confraria_do_farol" };
  const aliadoSemFaccao = {};

  const bonusAtivo = bonusCamaradagemFaccao(aliadoMesmaFaccao, principal);
  check("aliado da mesma facção recebe bônus (algum campo != 0)", Object.values(bonusAtivo).some((v) => v !== 0));
  const bonusInativo = bonusCamaradagemFaccao(aliadoOutraFaccao, principal);
  check("aliado de outra facção não recebe bônus", Object.values(bonusInativo).every((v) => v === 0));
  const bonusSemFaccao = bonusCamaradagemFaccao(aliadoSemFaccao, principal);
  check("aliado sem facaoId não recebe bônus", Object.values(bonusSemFaccao).every((v) => v === 0));

  const principalSemAfiliacao = {};
  const bonusSemAfiliacaoPrincipal = bonusCamaradagemFaccao(aliadoMesmaFaccao, principalSemAfiliacao);
  check("sem o principal afiliado a nada, ninguém recebe bônus", Object.values(bonusSemAfiliacaoPrincipal).every((v) => v === 0));

  // O próprio personagem principal nunca tem facaoId (não nasce numa
  // facção, ele escolhe uma) — bonusCamaradagemFaccao(principal, principal)
  // deve continuar zerado, nunca um "auto-bônus".
  const autoBonus = bonusCamaradagemFaccao(principal, principal);
  check("personagem principal nunca recebe bônus de si mesmo (nunca tem facaoId próprio)", Object.values(autoBonus).every((v) => v === 0));
}

// --- aplicarCamaradagemNoCombatente ---
{
  function fakeCombatente() {
    return {
      atributos: { FOR: 10, DES: 10, CON: 10, INT: 10 },
      defesa: 5, critBonus: 0, hp: 40, hpMax: 40, mp: 10, mpMax: 10,
    };
  }
  const principal = {};
  afiliarFaccao(principal, "caravana_de_karn");
  const membroAlinhado = { facaoId: "caravana_de_karn" };
  const membroDesalinhado = { facaoId: "confraria_do_farol" };

  const cAlinhado = fakeCombatente();
  aplicarCamaradagemNoCombatente(cAlinhado, membroAlinhado, principal);
  check("combatente alinhado ganha CON extra", cAlinhado.atributos.CON > 10);
  check("combatente alinhado ganha hpMax extra (hpMaxPercent)", cAlinhado.hpMax > 40);
  check("hp atual escala proporcionalmente ao novo hpMax (não fica igual nem cheio à toa)", cAlinhado.hp > 40 && cAlinhado.hp <= cAlinhado.hpMax);

  const cDesalinhado = fakeCombatente();
  const cDesalinhadoOriginal = fakeCombatente();
  aplicarCamaradagemNoCombatente(cDesalinhado, membroDesalinhado, principal);
  check("combatente desalinhado não é alterado", JSON.stringify(cDesalinhado) === JSON.stringify(cDesalinhadoOriginal));

  const cPrincipal = fakeCombatente();
  const cPrincipalOriginal = fakeCombatente();
  aplicarCamaradagemNoCombatente(cPrincipal, principal, principal);
  check("aplicar no próprio personagem principal não altera nada (sem facaoId próprio)", JSON.stringify(cPrincipal) === JSON.stringify(cPrincipalOriginal));
}

// --- alterarReputacao continua funcionando por facção regional (reaproveita a mesma função da task #35) ---
{
  const personagem = {};
  const novo = alterarReputacao(personagem, "caravana_de_karn", 20, worldStateVariables);
  check("alterarReputacao funciona pra facção regional (não só 'vila')", novo === 20 && getReputacao(personagem, "caravana_de_karn") === 20);
  check("reputação com uma facção não afeta outra", getReputacao(personagem, "confraria_do_farol") === 0);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
