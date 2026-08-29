// Classificação de ameaça de um encontro a partir da diferença entre o
// nível médio do grupo e o nível médio dos inimigos — puramente informativa,
// não altera nenhuma regra de combate ou recompensa.

const FAIXAS = [
  { min: 4, max: Infinity, id: "trivial", nome: "Trivial", cor: "#7a8a7a", icone: "💤" },
  { min: 2, max: 3, id: "favoravel", nome: "Favorável", cor: "#6fcf5c", icone: "🙂" },
  { min: -2, max: 1, id: "equilibrada", nome: "Equilibrada", cor: "#f5e34e", icone: "⚖️" },
  { min: -5, max: -3, id: "perigosa", nome: "Perigosa", cor: "#f5a524", icone: "⚠️" },
  { min: -Infinity, max: -6, id: "mortal", nome: "Mortal", cor: "#e05555", icone: "💀" },
];

export function nivelMedio(personagens) {
  if (!personagens.length) return 1;
  return personagens.reduce((soma, p) => soma + (p.nivel || 1), 0) / personagens.length;
}

export function classificarAmeaca(nivelGrupo, nivelInimigos) {
  const diff = nivelGrupo - nivelInimigos; // positivo = grupo mais forte
  const faixa = FAIXAS.find((f) => diff >= f.min && diff <= f.max) || FAIXAS[2];
  return { id: faixa.id, nome: faixa.nome, cor: faixa.cor, icone: faixa.icone, diferenca: Math.round(diff * 10) / 10 };
}

// `personagens`: array de personagens do time ativo. `monstrosDef`: array de
// definições de monstros (src/data/monsters.json) do encontro.
export function avaliarEncontro(personagens, monstrosDef) {
  const nivelGrupo = nivelMedio(personagens);
  const nivelInimigos = nivelMedio(monstrosDef.map((m) => ({ nivel: m.nivel })));
  const ameaca = classificarAmeaca(nivelGrupo, nivelInimigos);
  const elementosDetectados = [...new Set(monstrosDef.map((m) => m.elemento || "fisico"))];
  const temChefe = monstrosDef.some((m) => m.chefe);
  return {
    ameaca,
    quantidade: monstrosDef.length,
    elementosDetectados,
    temChefe,
    podeFugir: true, // fuga sempre disponível nesta versão (chance baseada em velocidade, ver CombatSystem.fugir)
  };
}
