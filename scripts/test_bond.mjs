// Regressão para vínculo de campanheirismo (melhoria de jogabilidade
// pós-backlog original, ver BondSystem.js) — cenas narrativas por marco de
// nível de cada convocado do gacha, com bônus permanente somado via
// bonusTotal() em CharacterFactory.js (mesma composição usada por árvore de
// habilidades e afinidade racial).
import {
  LIMIARES_VINCULO, garantirVinculo, bonusVinculo, proximoTierDisponivel, cenaVinculo, escolherTomVinculo, resumoVinculoParaCard,
} from "../src/systems/BondSystem.js";
import { bonusTotal, atributosEfetivos, calcularHpMax, critBonusTotal } from "../src/systems/CharacterFactory.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const classes = JSON.parse(fs.readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const dados = { classes };
const classeIds = classes.map((c) => c.id);

function fakeConvocado(classeId, nivel) {
  return {
    uid: "gacha_teste", nome: "Companheira Teste", classeId, nivel,
    atributos: { FOR: 5, DES: 5, CON: 5, INT: 5 },
    equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
    arvore: { escolhas: [] },
  };
}

// --- garantirVinculo: inicializa e não quebra em chamadas repetidas ---
{
  const c = fakeConvocado("guerreiro", 1);
  const v1 = garantirVinculo(c);
  check("garantirVinculo inicializa tier=0 e escolhas=[]", v1.tier === 0 && Array.isArray(v1.escolhas) && v1.escolhas.length === 0);
  const v2 = garantirVinculo(c);
  check("chamar de novo não reseta o estado (mesma referência de objeto)", v1 === v2);
}

// --- proximoTierDisponivel: respeita os limiares de nível ---
{
  check(`limiares são ${JSON.stringify(LIMIARES_VINCULO)}`, LIMIARES_VINCULO.length === 3);
  check("nível 1 não libera nenhum tier", proximoTierDisponivel(fakeConvocado("guerreiro", 1)) === null);
  check(`nível ${LIMIARES_VINCULO[0] - 1} ainda não libera`, proximoTierDisponivel(fakeConvocado("guerreiro", LIMIARES_VINCULO[0] - 1)) === null);
  check(`nível ${LIMIARES_VINCULO[0]} libera o tier 0`, proximoTierDisponivel(fakeConvocado("guerreiro", LIMIARES_VINCULO[0])) === 0);
  check(`nível alto (acima de todos os limiares) ainda libera só o tier 0 primeiro`, proximoTierDisponivel(fakeConvocado("guerreiro", 99)) === 0);
}

// --- cenaVinculo: cobre as 6 classes reais do jogo, todas com os 3 tiers ---
{
  for (const classeId of classeIds) {
    for (let i = 0; i < LIMIARES_VINCULO.length; i++) {
      const c = fakeConvocado(classeId, LIMIARES_VINCULO[i]);
      c.vinculo = { tier: i, escolhas: [] };
      const cena = cenaVinculo(c, { nome: "Herói" });
      check(`classe "${classeId}" tier ${i} tem cena válida (título+texto+2 escolhas)`, !!cena && cena.titulo.length > 0 && cena.texto.length > 0 && cena.escolhas.length === 2);
      if (cena) {
        check(`classe "${classeId}" tier ${i}: placeholders {nome}/{heroi} foram resolvidos no texto`, !cena.texto.includes("{nome}") && !cena.texto.includes("{heroi}"));
        check(`classe "${classeId}" tier ${i}: placeholders resolvidos nas respostas das escolhas`, cena.escolhas.every((e) => !e.resposta.includes("{nome}") && !e.resposta.includes("{heroi}")));
        check(`classe "${classeId}" tier ${i}: texto realmente menciona o nome do convocado`, cena.texto.includes("Companheira Teste"));
      }
    }
  }
}

// --- cenaVinculo: null quando não há cena disponível (nível baixo ou já completou tudo) ---
{
  check("sem nível suficiente, cenaVinculo retorna null", cenaVinculo(fakeConvocado("guerreiro", 1), { nome: "Herói" }) === null);
  const completo = fakeConvocado("guerreiro", 99);
  completo.vinculo = { tier: LIMIARES_VINCULO.length, escolhas: [] };
  check("com todos os tiers completos, cenaVinculo retorna null", cenaVinculo(completo, { nome: "Herói" }) === null);
}

// --- escolherTomVinculo: avança o tier e registra a escolha ---
{
  const c = fakeConvocado("mago", LIMIARES_VINCULO[0]);
  const r1 = escolherTomVinculo(c, "caloroso");
  check("primeira escolha retorna ok:true e tier:0", r1.ok === true && r1.tier === 0);
  check("vinculo.tier avança pra 1 depois da escolha", c.vinculo.tier === 1);
  check("escolha fica registrada no histórico", c.vinculo.escolhas.length === 1 && c.vinculo.escolhas[0].tom === "caloroso" && c.vinculo.escolhas[0].tier === 0);

  // Ainda não atingiu o nível do tier 1 — nova tentativa falha.
  const r2 = escolherTomVinculo(c, "reservado");
  check("sem nível suficiente pro próximo tier, escolherTomVinculo falha (ok:false)", r2.ok === false);
  check("tier não avança quando a escolha falha", c.vinculo.tier === 1);
}

// --- Os dois tons dão exatamente o mesmo bônus mecânico (guardrail: escolha é só narrativa) ---
{
  const cCaloroso = fakeConvocado("clerigo", LIMIARES_VINCULO[0]);
  const cReservado = fakeConvocado("clerigo", LIMIARES_VINCULO[0]);
  escolherTomVinculo(cCaloroso, "caloroso");
  escolherTomVinculo(cReservado, "reservado");
  check("tom 'caloroso' e tom 'reservado' geram o MESMO bônus (bonusVinculo idêntico)", JSON.stringify(bonusVinculo(cCaloroso)) === JSON.stringify(bonusVinculo(cReservado)));
}

// --- bonusVinculo: acumula por tier, na ordem certa ---
{
  const c = fakeConvocado("barbaro", 99);
  check("tier 0 (recém-criado), bônus vazio", Object.values(bonusVinculo(c)).every((v) => v === 0));
  escolherTomVinculo(c, "caloroso"); // completa tier 0 -> tier 1
  const bonus1 = bonusVinculo(c);
  check("após 1 tier completo, CON +1", bonus1.CON === 1 && Object.entries(bonus1).filter(([k]) => k !== "CON").every(([, v]) => v === 0));
  escolherTomVinculo(c, "reservado"); // completa tier 1 -> tier 2
  const bonus2 = bonusVinculo(c);
  check("após 2 tiers completos, CON +1 E critChance +0.02", bonus2.CON === 1 && Math.abs(bonus2.critChance - 0.02) < 1e-9);
  escolherTomVinculo(c, "caloroso"); // completa tier 2 -> tier 3 (fim)
  const bonus3 = bonusVinculo(c);
  check("após os 3 tiers completos, CON+1, critChance+0.02 E hpMaxPercent+0.03", bonus3.CON === 1 && Math.abs(bonus3.critChance - 0.02) < 1e-9 && Math.abs(bonus3.hpMaxPercent - 0.03) < 1e-9);
  check("depois de completar tudo, proximoTierDisponivel volta a ser null (sem mais cenas)", proximoTierDisponivel(c) === null);
}

// --- personagem principal (sem .vinculo) nunca é afetado ---
{
  const principal = { nivel: 20, atributos: { FOR: 5, DES: 5, CON: 5, INT: 5 } };
  check("bonusVinculo do personagem principal (sem campo .vinculo) é sempre vazio", Object.values(bonusVinculo(principal)).every((v) => v === 0));
}

// --- Integração com CharacterFactory.bonusTotal / atributosEfetivos / calcularHpMax ---
{
  const c = fakeConvocado("guerreiro", LIMIARES_VINCULO[0]);
  const antes = atributosEfetivos(c, dados);
  escolherTomVinculo(c, "caloroso"); // +1 CON
  const depois = atributosEfetivos(c, dados);
  check("bonusTotal inclui o vínculo (CON efetivo sobe +1 depois da 1ª cena)", depois.CON === antes.CON + 1);

  // Zera vínculo e testa o tier de crítico isoladamente.
  const c2 = fakeConvocado("ladino", 99);
  c2.vinculo = { tier: 1, escolhas: [] }; // já completou o tier 0, falta o 1
  check("critBonusTotal ainda é 0 antes de completar o tier 1 (só CON do tier 0 conta, não crítico)", critBonusTotal(c2, dados) === 0);
  escolherTomVinculo(c2, "reservado"); // completa tier 1 -> +0.02 crítico
  check("critBonusTotal reflete o bônus do tier 1 assim que completado", Math.abs(critBonusTotal(c2, dados) - 0.02) < 1e-9);

  // hpMaxPercent do tier 2 se reflete em calcularHpMax.
  const c3 = fakeConvocado("clerigo", 99);
  c3.vinculo = { tier: 2, escolhas: [] };
  const classeClerigo = classes.find((x) => x.id === "clerigo");
  const hpAntes = calcularHpMax(c3, dados);
  escolherTomVinculo(c3, "caloroso"); // completa tier 2 -> +3% hpMax
  const hpDepois = calcularHpMax(c3, dados);
  check("calcularHpMax reflete o +3% de hpMaxPercent do tier 2", hpDepois === Math.round(hpAntes * 1.03));
  check("classe clérigo existe nos dados de teste (sanity check do fixture)", !!classeClerigo);
}

// --- resumoVinculoParaCard: os 3 estados possíveis pra UI ---
{
  check("bloqueado quando nível insuficiente", resumoVinculoParaCard(fakeConvocado("guerreiro", 1)).classe === "vinculo-bloqueado");
  check("disponível quando nível bate e ainda não viu a cena", resumoVinculoParaCard(fakeConvocado("guerreiro", LIMIARES_VINCULO[0])).classe === "vinculo-disponivel");
  const completo = fakeConvocado("guerreiro", 99);
  completo.vinculo = { tier: LIMIARES_VINCULO.length, escolhas: [] };
  check("completo quando todos os tiers foram vistos", resumoVinculoParaCard(completo).classe === "vinculo-completo");
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
