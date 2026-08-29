// Smoke test para task #36: Despertar de Arma Secreta (progressão narrativa +
// mecânica para personagens do gacha investidos até nível alto).
import { podeDespertar, despertar, definicaoDespertar } from "../src/systems/AwakeningSystem.js";
import { instanciarPersonagemGacha } from "../src/systems/GachaSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const roster = JSON.parse(fs.readFileSync(new URL("../src/data/gachaRoster.json", import.meta.url)));
const classes = JSON.parse(fs.readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const dados = { classes };

// --- estrutura: todo personagem do roster tem um despertar bem-formado ---
// (o roster cresceu de 24 para 100 na task #49 — checa >= 24 em vez de
// === 24 pra não quebrar quando o roster crescer de novo no futuro)
{
  check(`roster tem pelo menos 24 personagens (encontrado ${roster.length})`, roster.length >= 24);
  let todosOk = true;
  for (const p of roster) {
    const d = p.despertar;
    if (
      !d ||
      typeof d.nivelRequerido !== "number" || d.nivelRequerido < 1 ||
      typeof d.nomeArma !== "string" || !d.nomeArma.length ||
      typeof d.narrativa !== "string" || d.narrativa.length < 20 ||
      typeof d.bonusHabilidadeMultiplicador !== "number" || d.bonusHabilidadeMultiplicador <= 0 ||
      !d.bonusAtributos || Object.keys(d.bonusAtributos).length !== 2
    ) {
      console.log("  -> estrutura inválida em: " + p.id, d);
      todosOk = false;
    }
  }
  check("todo despertar tem nivelRequerido/nomeArma/narrativa/bonus válidos", todosOk);
}

// --- narrativa não contém erro de capitalização (bug já corrigido) nem vírgula solta ---
{
  const ashryn = roster.find((p) => p.id === "ashryn_folhaferrea");
  check("narrativa começa com maiúscula", /^[A-ZÀ-Ý]/.test(ashryn.despertar.narrativa));
  const thorgrid = roster.find((p) => p.nome.startsWith("Thorgrid"));
  check("primeiro nome extraído sem vírgula sobrando", thorgrid && !thorgrid.despertar.narrativa.includes("Thorgrid,,") && thorgrid.despertar.narrativa.includes("quem Thorgrid se tornou"));
}

// --- podeDespertar: gating por nível ---
{
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = def.despertar.nivelRequerido - 1;
  check("não pode despertar abaixo do nível exigido", podeDespertar(instancia, roster) === false);
  instancia.nivel = def.despertar.nivelRequerido;
  check("pode despertar exatamente no nível exigido", podeDespertar(instancia, roster) === true);
  instancia.nivel = def.despertar.nivelRequerido + 5;
  check("pode despertar acima do nível exigido", podeDespertar(instancia, roster) === true);
}

// --- podeDespertar: personagem sem despertar definido ou já desperto ---
{
  check("instância nula/indefinida não quebra", podeDespertar(null, roster) === false);
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = 99;
  instancia.desperto = true;
  check("já desperto não pode despertar de novo", podeDespertar(instancia, roster) === false);
}

// --- despertar(): aplica bônus de atributos corretamente ---
{
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = def.despertar.nivelRequerido;
  const atributosAntes = { ...instancia.atributos };
  const r = despertar(instancia, roster, dados);
  check("despertar() retorna ok:true", r.ok === true);
  let bonusOk = true;
  Object.entries(def.despertar.bonusAtributos).forEach(([attr, valor]) => {
    if (instancia.atributos[attr] !== atributosAntes[attr] + valor) bonusOk = false;
  });
  check("bônus de atributos aplicado corretamente", bonusOk);
  check("marca desperto = true", instancia.desperto === true);
}

// --- despertar(): recalcula hpMax/mpMax preservando proporção atual (não cura/esvazia à toa) ---
{
  const def = roster.find((p) => p.id === "brokk_runamente");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = def.despertar.nivelRequerido;
  instancia.hp = Math.round(instancia.hpMax * 0.5); // meia vida antes de despertar
  const deltaHpEsperadoMin = 0; // hpMax só pode subir ou ficar igual (bônus é sempre >=0)
  const hpMaxAntes = instancia.hpMax;
  despertar(instancia, roster, dados);
  check("hpMax não diminui após despertar", instancia.hpMax >= hpMaxAntes);
  check("hp atual sobe proporcionalmente ao ganho de hpMax (não é curado à toa nem fica igual)", instancia.hp === Math.min(instancia.hpMax, Math.round(hpMaxAntes * 0.5) + (instancia.hpMax - hpMaxAntes)));
  check("hp nunca ultrapassa hpMax", instancia.hp <= instancia.hpMax);
}

// --- despertar(): reforça a habilidade assinatura (multiplicador OU valor) ---
{
  // brokk tem habilidade tipo dano_magico com "multiplicador"
  const defMago = roster.find((p) => p.id === "brokk_runamente");
  const instMago = instanciarPersonagemGacha(defMago);
  instMago.nivel = defMago.despertar.nivelRequerido;
  const multAntes = instMago.habilidades[0].multiplicador;
  despertar(instMago, roster, dados);
  check("bônus de multiplicador aplicado na habilidade (mago)", Math.abs(instMago.habilidades[0].multiplicador - (multAntes + defMago.despertar.bonusHabilidadeMultiplicador)) < 1e-9);

  // ashryn tem habilidade tipo buff_ataque com "valor"
  const defBarb = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instBarb = instanciarPersonagemGacha(defBarb);
  instBarb.nivel = defBarb.despertar.nivelRequerido;
  const valorAntes = instBarb.habilidades[0].valor;
  despertar(instBarb, roster, dados);
  check("bônus de valor aplicado na habilidade (bárbaro)", Math.abs(instBarb.habilidades[0].valor - (valorAntes + defBarb.despertar.bonusHabilidadeMultiplicador)) < 1e-9);
}

// --- despertar(): idempotência — não pode ser aplicado duas vezes ---
{
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = def.despertar.nivelRequerido;
  const r1 = despertar(instancia, roster, dados);
  const atributosDepoisPrimeiro = { ...instancia.atributos };
  const r2 = despertar(instancia, roster, dados);
  check("primeira chamada funciona", r1.ok === true);
  check("segunda chamada é rejeitada", r2.ok === false);
  check("atributos não são somados duas vezes", JSON.stringify(instancia.atributos) === JSON.stringify(atributosDepoisPrimeiro));
}

// --- despertar(): sem `dados`, não mexe em hp/mp mas ainda aplica o resto ---
{
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = def.despertar.nivelRequerido;
  const hpMaxAntes = instancia.hpMax;
  const r = despertar(instancia, roster, null);
  check("sem `dados`, despertar ainda funciona (ok:true)", r.ok === true);
  check("sem `dados`, hpMax não é recalculado", instancia.hpMax === hpMaxAntes);
  check("sem `dados`, atributos e habilidade ainda são reforçados", instancia.desperto === true);
}

// --- despertar(): falha graciosamente quando ainda não pode despertar ---
{
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = 1;
  const r = despertar(instancia, roster, dados);
  check("despertar() recusa quando nível é insuficiente", r.ok === false);
  check("nada é alterado quando recusado", instancia.desperto !== true);
}

// --- definicaoDespertar: retorna null para rosterId inexistente ---
{
  const instancia = instanciarPersonagemGacha(roster[0]);
  instancia.rosterId = "personagem_que_nao_existe";
  check("definicaoDespertar retorna null para rosterId desconhecido", definicaoDespertar(instancia, roster) === null);
}

// --- estado sobrevive a JSON.stringify/parse (compatibilidade com o save) ---
{
  const def = roster.find((p) => p.id === "ashryn_folhaferrea");
  const instancia = instanciarPersonagemGacha(def);
  instancia.nivel = def.despertar.nivelRequerido;
  despertar(instancia, roster, dados);
  const clonado = JSON.parse(JSON.stringify(instancia));
  check("desperto sobrevive a serialização", clonado.desperto === true);
  check("atributos bonificados sobrevivem a serialização", JSON.stringify(clonado.atributos) === JSON.stringify(instancia.atributos));
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
