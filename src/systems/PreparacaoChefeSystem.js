import { relacaoElemental } from "./ElementSystem.js";
import { FLAGS } from "../data/featureFlags.js";

export function dicasDoChefe(monstros, personagens, dados) {
  const chefe = monstros.find((m) => m.chefe);
  if (!chefe) return [];
  const dicas = [];
  if (FLAGS.elementos && dados.elements) {
    const elementos = dados.elements.elementos || [];
    const fortes = elementos.filter((e) => ["vantagem", "vantagem_intensa"].includes(relacaoElemental(e.id, chefe.elemento, dados.elements)));
    if (fortes.length) dicas.push(`Fraqueza elemental: ${fortes.map((e) => e.nome).join(" ou ")}.`);
    const elemento = elementos.find((e) => e.id === chefe.elemento);
    if (elemento && elemento.id !== "fisico") dicas.push(`Evite ${elemento.nome}: ataques desse elemento não causam dano.`);
  }
  if (personagens.some((p) => p.hp < p.hpMax * 0.5)) dicas.push("Alguém está com pouca vida. Descanse antes do desafio.");
  dicas.push("O chefe muda de fase. Guarde cura e use Defender quando ele anunciar um ataque poderoso.");
  return dicas;
}
