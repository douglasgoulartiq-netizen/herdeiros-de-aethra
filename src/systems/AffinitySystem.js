// Sistema de Afinidade racial de classe (task #41): cada raça tem afinidade
// natural com 1 ou mais classes (ver src/data/affinities.json) — quando a
// combinação raça+classe do personagem bate com essa lista, ele ganha um
// bônus de combate extra, sempre no mesmo formato de bonusArvore() em
// CharacterFactory.js (FOR/DES/CON/INT/hpMaxPercent/mpMaxPercent/
// critChance/defesaFlat), somado exatamente do mesmo jeito. Fora da
// combinação, nenhum bônus — afinidade é sempre uma vantagem opcional a
// considerar na escolha de classe, nunca uma penalidade pra quem escolhe
// outra coisa.
const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

// Retorna a entrada de afinidade (classesAfins/bonus/texto) da raça, só se a
// classe informada estiver na lista de afins dela — ou null.
export function afinidadeDe(racaId, classeId, dadosAfinidades) {
  const entrada = dadosAfinidades && dadosAfinidades[racaId];
  if (!entrada || !Array.isArray(entrada.classesAfins) || !entrada.classesAfins.includes(classeId)) return null;
  return entrada;
}

// Bônus pronto pra somar em atributosEfetivos/defesaTotal/calcularHpMax/
// calcularMpMax/critBonusTotal (CharacterFactory.js) — sempre retorna um
// objeto completo (todos os campos zerados quando não há afinidade), igual
// ao contrato de bonusArvore().
// O bônus que vale para esta combinação. `bonusPorClasse` (opcional) troca o
// bônus pela classe — é o caso do Humano, afim de todas as classes mas com
// +1 só no atributo principal de cada uma.
function bonusDaEntrada(entrada, classeId) {
  const porClasse = entrada.bonusPorClasse && entrada.bonusPorClasse[classeId];
  return porClasse || entrada.bonus || {};
}

export function bonusAfinidade(personagem, dados) {
  if (!dados || !dados.affinities) return { ...BONUS_VAZIO };
  const entrada = afinidadeDe(personagem.racaId, personagem.classeId, dados.affinities);
  if (!entrada) return { ...BONUS_VAZIO };
  return { ...BONUS_VAZIO, ...bonusDaEntrada(entrada, personagem.classeId) };
}

// "+2 DES · +5% de crítico" — o bônus escrito como o jogador lê num card.
// O card da classe dizia só "🔗 Afinidade racial", sem o quê.
const ROTULO_BONUS = {
  hpMaxPercent: (v) => `+${Math.round(v * 100)}% de HP máximo`,
  mpMaxPercent: (v) => `+${Math.round(v * 100)}% de MP máximo`,
  critChance: (v) => `+${Math.round(v * 100)}% de crítico`,
  defesaFlat: (v) => `+${v} de defesa`,
};
export function descreverBonus(bonus) {
  return Object.entries(bonus || {})
    .filter(([, v]) => v)
    .map(([k, v]) => (ROTULO_BONUS[k] ? ROTULO_BONUS[k](v) : `+${v} ${k}`))
    .join(" · ");
}

// Versão "para UI": texto pronto pra exibir (cartas de criação, coleção do
// gacha, etc.) — null quando a combinação não tem afinidade.
export function infoAfinidade(racaId, classeId, dadosAfinidades) {
  const entrada = afinidadeDe(racaId, classeId, dadosAfinidades);
  if (!entrada) return null;
  const bonus = bonusDaEntrada(entrada, classeId);
  return { texto: entrada.texto, bonus, resumo: descreverBonus(bonus) };
}
