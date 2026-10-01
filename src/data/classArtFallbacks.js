// Arte provisória explícita: mantém retratos e caminhada disponíveis até
// os conjuntos exclusivos das novas classes passarem pela direção de arte.
export const CLASS_ART_FALLBACKS = { paladino:'guerreiro', bardo:'ladino', druida:'clerigo', necromante:'mago' };
export function classArtFallback(chave) {
  for (const [classe, base] of Object.entries(CLASS_ART_FALLBACKS)) {
    if (chave.startsWith('pc_') && chave.endsWith('_'+classe)) return chave.slice(0,-classe.length)+base;
    const prefixo = `gacha_novo_${classe}_`;
    if (chave.startsWith(prefixo)) {
      const raca = ['humano','elfo','anao','draconato'][Number(chave.slice(prefixo.length))-1];
      if (raca) return `pc_${raca}_${base}`;
    }
  }
  return null;
}
