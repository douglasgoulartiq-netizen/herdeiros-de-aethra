// Smoke test para task #41: afinidade racial de classe (AffinitySystem.js)
// + classes evidentes (ícone por classe em classes.json). Cobre a
// integridade dos dados, o cálculo de bônus isolado e a integração com
// CharacterFactory.js (atributosEfetivos/defesaTotal/calcularHpMax/
// calcularMpMax/critBonusTotal), que precisa continuar valendo pra árvore
// de habilidades igual antes (afinidade é só mais uma fonte de bônus
// somada, nunca substitui a anterior).
import { afinidadeDe, bonusAfinidade, infoAfinidade } from "../src/systems/AffinitySystem.js";
import {
  atributosEfetivos, defesaTotal, calcularHpMax, calcularMpMax, critBonusTotal, bonusTotal,
} from "../src/systems/CharacterFactory.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const races = JSON.parse(fs.readFileSync(new URL("../src/data/races.json", import.meta.url)));
const classes = JSON.parse(fs.readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const affinities = JSON.parse(fs.readFileSync(new URL("../src/data/affinities.json", import.meta.url)));
const dados = { classes, races, affinities };
const classeIds = new Set(classes.map((c) => c.id));
const racaIds = new Set(races.map((r) => r.id));

// --- Integridade dos dados ---
{
  check("toda raça tem entrada em affinities.json", races.every((r) => affinities[r.id]));
  const chavesInvalidas = Object.keys(affinities).filter((k) => k !== "_comentario" && !racaIds.has(k));
  check("toda chave de affinities.json (exceto _comentario) é uma raça real", chavesInvalidas.length === 0);
  const classesInvalidas = Object.entries(affinities)
    .filter(([k]) => k !== "_comentario")
    .flatMap(([, v]) => v.classesAfins)
    .filter((cId) => !classeIds.has(cId));
  check("toda classe listada em classesAfins existe em classes.json", classesInvalidas.length === 0);
  check("todas as 6 classes têm ícone (classe evidente, task #41)", classes.every((c) => c.icone && c.icone.length > 0));
  check("humano tem afinidade com TODAS as classes (versatilidade)", affinities.humano.classesAfins.length === classes.length);
}

// --- afinidadeDe / infoAfinidade: só ativa na combinação certa ---
{
  check("anão+guerreiro tem afinidade", afinidadeDe("anao", "guerreiro", affinities) !== null);
  check("anão+mago NÃO tem afinidade", afinidadeDe("anao", "mago", affinities) === null);
  check("infoAfinidade retorna texto quando ativa", infoAfinidade("anao", "guerreiro", affinities).texto.length > 0);
  check("infoAfinidade retorna null quando não ativa", infoAfinidade("anao", "mago", affinities) === null);
  check("raça desconhecida nunca quebra (retorna null)", afinidadeDe("raca_inexistente", "guerreiro", affinities) === null);
}

// --- bonusAfinidade: formato compatível com bonusArvore (mesmas chaves) ---
{
  const bonusVazio = bonusAfinidade({ racaId: "elfo", classeId: "guerreiro" }, dados); // elfo não tem afinidade com guerreiro
  check("sem afinidade, todas as chaves do bônus são 0", Object.values(bonusVazio).every((v) => v === 0));
  const bonusAtivo = bonusAfinidade({ racaId: "elfo", classeId: "mago" }, dados);
  check("com afinidade (elfo+mago), bônus não é todo zero", Object.values(bonusAtivo).some((v) => v !== 0));
  check("sem `dados`/`dados.affinities`, nunca quebra (bônus vazio)", Object.values(bonusAfinidade({ racaId: "elfo", classeId: "mago" }, null)).every((v) => v === 0));
}

// --- Integração com CharacterFactory: afinidade soma nos atributos efetivos ---
{
  function fakePersonagem(racaId, classeId) {
    return {
      racaId, classeId, nivel: 5,
      atributos: { FOR: 8, DES: 8, CON: 8, INT: 8 },
      equipamento: { arma: null, peito: null, cabeca: null, pes: null, escudo: null, anel: null, amuleto: null },
      arvore: { escolhas: [] },
    };
  }
  // draconato+mago tem afinidade forte (+2 INT); draconato+ladino não tem.
  const comAfinidade = atributosEfetivos(fakePersonagem("draconato", "mago"), dados);
  const semAfinidade = atributosEfetivos(fakePersonagem("draconato", "ladino"), dados);
  check("atributosEfetivos aplica o bônus de INT da afinidade (draconato+mago)", comAfinidade.INT === 8 + 2);
  check("atributosEfetivos não aplica bônus fora da combinação (draconato+ladino)", semAfinidade.INT === 8);

  // anão+guerreiro tem +1 de defesaFlat.
  const defCom = defesaTotal(fakePersonagem("anao", "guerreiro"), dados);
  const defSem = defesaTotal(fakePersonagem("anao", "mago"), dados);
  check("defesaTotal aplica defesaFlat da afinidade (anão+guerreiro)", defCom === defSem + 1);

  // orc+barbaro tem +4% de HP máximo (hpMaxPercent).
  const classeBarbaro = classes.find((c) => c.id === "barbaro");
  const semBonusHp = classeBarbaro.vidaBase + (8 + 2) * 3; // orc dá +2 FOR, não CON — CON efetivo continua 8
  const pOrcBarbaro = fakePersonagem("orc", "barbaro");
  const hpComAfinidade = calcularHpMax(pOrcBarbaro, dados);
  const hpEsperado = Math.round((classeBarbaro.vidaBase + 8 * 3) * 1.04);
  check("calcularHpMax aplica hpMaxPercent da afinidade (orc+bárbaro, +4%)", hpComAfinidade === hpEsperado);

  // draconato+mago também tem +6% de MP máximo.
  const classeMago = classes.find((c) => c.id === "mago");
  const mpEsperado = Math.round((classeMago.manaBase + (8 + 2) * 2) * 1.06);
  check("calcularMpMax aplica mpMaxPercent + INT da afinidade (draconato+mago)", calcularMpMax(fakePersonagem("draconato", "mago"), dados) === mpEsperado);

  // halfling+ladino tem +5% de crítico.
  check("critBonusTotal aplica critChance da afinidade (halfling+ladino)", critBonusTotal(fakePersonagem("halfling", "ladino"), dados) === 0.05);
  check("critBonusTotal fica 0 fora da combinação de afinidade", critBonusTotal(fakePersonagem("halfling", "mago"), dados) === 0);

  // bonusTotal soma afinidade + árvore (sem árvore escolhida aqui, deve bater com só afinidade).
  const total = bonusTotal(fakePersonagem("halfling", "ladino"), dados);
  check("bonusTotal (sem escolhas de árvore) bate com bonusAfinidade sozinho", total.critChance === 0.05 && total.DES === 2);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
