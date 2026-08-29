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
export function bonusAfinidade(personagem, dados) {
  if (!dados || !dados.affinities) return { ...BONUS_VAZIO };
  const entrada = afinidadeDe(personagem.racaId, personagem.classeId, dados.affinities);
  if (!entrada) return { ...BONUS_VAZIO };
  return { ...BONUS_VAZIO, ...entrada.bonus };
}

// Versão "para UI": texto pronto pra exibir (cartas de criação, coleção do
// gacha, etc.) — null quando a combinação não tem afinidade.
export function infoAfinidade(racaId, classeId, dadosAfinidades) {
  const entrada = afinidadeDe(racaId, classeId, dadosAfinidades);
  if (!entrada) return null;
  return { texto: entrada.texto, bonus: entrada.bonus };
}
