// Despertar de Arma Secreta: consequência narrativa E mecânica de investir
// em um personagem do gacha até um nível alto o bastante — cada entrada do
// roster (src/data/gachaRoster.json) tem um campo aditivo "despertar" (nível
// exigido, nome da arma secreta, narrativa, bônus de atributos e bônus na
// habilidade assinatura). Isso NUNCA muda invocação/raridade/duplicatas —
// só dá aos personagens que o jogador realmente desenvolveu uma progressão
// extra e um momento narrativo, reaproveitando o padrão visual já existente
// (ver AwakeningUI.js).
import { calcularHpMax, calcularMpMax } from "./CharacterFactory.js";

export function definicaoDespertar(instancia, roster) {
  const def = roster.find((p) => p.id === instancia.rosterId);
  return (def && def.despertar) || null;
}

export function podeDespertar(instancia, roster) {
  if (!instancia || instancia.desperto) return false;
  const def = definicaoDespertar(instancia, roster);
  if (!def) return false;
  return instancia.nivel >= def.nivelRequerido;
}

// Aplica o Despertar de forma permanente: soma o bônus de atributos, ajusta
// HP/MP máximos de acordo (igual a aplicarCrescimento em CharacterFactory.js
// — preserva a proporção de HP/MP atual em vez de curar/esvaziar à toa) e
// reforça a habilidade assinatura (multiplicador ou valor, o que existir).
// Marca `instancia.desperto = true` pra nunca poder repetir.
export function despertar(instancia, roster, dados) {
  if (!podeDespertar(instancia, roster)) return { ok: false };
  const def = definicaoDespertar(instancia, roster);

  Object.entries(def.bonusAtributos).forEach(([attr, valor]) => {
    instancia.atributos[attr] = (instancia.atributos[attr] || 0) + valor;
  });

  if (dados) {
    const hpAntigo = instancia.hpMax;
    const mpAntigo = instancia.mpMax;
    instancia.hpMax = calcularHpMax(instancia, dados);
    instancia.mpMax = calcularMpMax(instancia, dados);
    instancia.hp = Math.min(instancia.hpMax, instancia.hp + (instancia.hpMax - hpAntigo));
    instancia.mp = Math.min(instancia.mpMax, instancia.mp + (instancia.mpMax - mpAntigo));
  }

  const habilidade = instancia.habilidades && instancia.habilidades[0];
  if (habilidade) {
    if (typeof habilidade.multiplicador === "number") habilidade.multiplicador += def.bonusHabilidadeMultiplicador;
    else if (typeof habilidade.valor === "number") habilidade.valor += def.bonusHabilidadeMultiplicador;
  }

  instancia.desperto = true;
  return { ok: true, def };
}
