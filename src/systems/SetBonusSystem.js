// Sets de equipamento (melhoria de jogabilidade pós-backlog original): um
// pequeno número de peças de armadura/acessório já existentes em
// items.json formam conjuntos temáticos — vestir 2 (ou, em alguns casos, o
// conjunto inteiro) dá um bônus extra, além do que cada peça já dá sozinha.
// Cria uma razão pra escolher um "visual"/tema de build em vez de só pegar
// sempre o item com o maior número (guardrail do jogo: oferecer expressão,
// sinergia e descoberta, não só poder bruto).
//
// Mesmo formato de bonusArvore/bonusAfinidade/bonusVinculo
// (CharacterFactory.js), somado exatamente do mesmo jeito dentro de
// bonusTotal() — vale automaticamente em atributos/defesa/HP/MP/crítico sem
// duplicar nenhuma lógica de aplicação em batalha/forja/etc.
//
// Diferente dos outros três bônus (árvore/afinidade/vínculo, todos ganhos
// permanentemente e independentes do que está equipado agora), o bônus de
// conjunto depende do EQUIPAMENTO ATUAL — pode ligar e desligar a qualquer
// momento que o jogador troca de peça, então é recalculado toda vez, nunca
// "guardado" no personagem.
//
// IMPORTANTE: este arquivo nunca importa de CharacterFactory.js (só o
// contrário acontece) — mesmo cuidado de import circular de BondSystem.js.

const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

// Cada conjunto lista os IDs de item (ver items.json) que contam pra ele e
// os "degraus" de bônus por quantidade de peças vestidas — os bônus de
// degraus diferentes SOMAM entre si (vestir o conjunto inteiro dá o bônus
// de 2 peças E o de peça completa ao mesmo tempo), no espírito de sets de
// RPG onde cada limiar é um bônus adicional, não substituto.
export const SETS_DE_EQUIPAMENTO = [
  {
    id: "andarilho",
    nome: "Conjunto do Andarilho",
    pecas: ["armadura_comum", "elmo_comum", "botas_comum", "escudo_comum"],
    tiers: [
      { pecas: 2, bonus: { ...BONUS_VAZIO, DES: 1 } },
      { pecas: 4, bonus: { ...BONUS_VAZIO, defesaFlat: 2 } },
    ],
  },
  {
    id: "vigilante_elfico",
    nome: "Conjunto do Vigilante Élfico",
    pecas: ["armadura_epico", "elmo_epico", "botas_epico"],
    tiers: [
      { pecas: 2, bonus: { ...BONUS_VAZIO, critChance: 0.03 } },
      { pecas: 3, bonus: { ...BONUS_VAZIO, DES: 2 } },
    ],
  },
  {
    id: "guardiao_eterno",
    nome: "Conjunto do Guardião Eterno",
    pecas: ["armadura_lendario", "elmo_lendario", "botas_lendario", "escudo_lendario"],
    tiers: [
      { pecas: 2, bonus: { ...BONUS_VAZIO, hpMaxPercent: 0.04 } },
      { pecas: 4, bonus: { ...BONUS_VAZIO, defesaFlat: 4 } },
    ],
  },
];

// Quantas peças de um conjunto específico o personagem tem equipadas agora
// (olha só personagem.equipamento — os 7 slots fixos, nunca a mochila).
export function pecasEquipadasDoConjunto(personagem, setDef) {
  if (!personagem || !personagem.equipamento) return 0;
  return Object.values(personagem.equipamento).filter((item) => item && setDef.pecas.includes(item.id)).length;
}

// Os degraus (tiers) já alcançados de um conjunto específico, na ordem
// definida em SETS_DE_EQUIPAMENTO.
export function tiersAtivosDoConjunto(personagem, setDef) {
  const n = pecasEquipadasDoConjunto(personagem, setDef);
  return setDef.tiers.filter((t) => n >= t.pecas);
}

// Soma o bônus de TODOS os conjuntos ativos agora — pronto pra entrar em
// bonusTotal() (CharacterFactory.js), mesmo contrato de bonusArvore/
// bonusAfinidade/bonusVinculo.
export function bonusConjunto(personagem) {
  const total = { ...BONUS_VAZIO };
  if (!personagem || !personagem.equipamento) return total;
  for (const setDef of SETS_DE_EQUIPAMENTO) {
    tiersAtivosDoConjunto(personagem, setDef).forEach((t) => {
      Object.keys(total).forEach((k) => { total[k] += t.bonus[k] || 0; });
    });
  }
  return total;
}

// Resumo de cada conjunto pronto pra UI (Inventário — ver GameUI.js): só
// lista conjuntos com pelo menos 1 peça equipada, pra não poluir a tela com
// conjuntos totalmente irrelevantes pro personagem atual.
export function conjuntosParaExibir(personagem) {
  return SETS_DE_EQUIPAMENTO
    .map((setDef) => {
      const equipadas = pecasEquipadasDoConjunto(personagem, setDef);
      if (equipadas === 0) return null;
      const tiersAtivos = tiersAtivosDoConjunto(personagem, setDef);
      const proximoTier = setDef.tiers.find((t) => t.pecas > equipadas) || null;
      return {
        id: setDef.id,
        nome: setDef.nome,
        equipadas,
        total: setDef.pecas.length,
        tiersAtivos: tiersAtivos.length,
        proximoTierEm: proximoTier ? proximoTier.pecas : null,
      };
    })
    .filter(Boolean);
}
