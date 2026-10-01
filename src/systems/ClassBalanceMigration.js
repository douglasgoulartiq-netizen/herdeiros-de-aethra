// Ajusta somente o crescimento alterado. Preserva bônus narrativos, itens,
// talentos, inventário e o dano já sofrido. Não redistribui builds.
export function migrarEquilibrioClasse(p) {
  if (!p || p.versaoEquilibrioClasse >= 2) return;
  const deltas = {barbaro:{DES:1},mago:{CON:1},ladino:{CON:1},clerigo:{DES:1,CON:-1}};
  const niveis = Math.max(0, Math.min(25, Number(p.nivel) || 1) - 1);
  const delta = deltas[p.classeId] || {};
  for (const [k,v] of Object.entries(delta)) {
    if (p.atributos && Number.isFinite(p.atributos[k])) p.atributos[k] = Math.max(1,p.atributos[k]+v*niveis);
  }
  if (delta.CON && Number.isFinite(p.hpMax)) {
    p.hpMax = Math.max(1,p.hpMax+delta.CON*niveis*3);
    p.hp = p.hp > 0 ? Math.min(p.hpMax, Math.max(1,p.hp+delta.CON*niveis*3)) : 0;
  }
  p.versaoEquilibrioClasse = 2;
}
