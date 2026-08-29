// Combos de formação (melhoria de jogabilidade pós-backlog original):
// quando duas classes específicas ficam na MESMA fileira (frente ou
// retaguarda, ver FormationSystem.js — o modelo atual só tem 2 fileiras de
// até 2 vagas cada, sem posição esquerda/direita), o time ganha um bônus
// tático. Cada fileira só cabe 2 combatentes, então no máximo 1 sinergia
// fica ativa por fileira — o time inteiro pode ter até 2 sinergias
// simultâneas (uma por fileira).
//
// Efêmero por batalha, seguindo o mesmo padrão da camaradagem de facção
// (task #44, ver WorldStateSystem.aplicarCamaradagemNoCombatente): aplicado
// direto no `combatente` já montado em BattleUI.js, nunca no `personagem`
// salvo, porque depende de QUEM está em QUAL fileira agora — pode mudar
// entre batalhas sem o personagem subir de nível.

function bonusPercentualHabilidade(combatente, tipoAlvo, percent) {
  (combatente.habilidades || []).forEach((h) => {
    if (h.tipo !== tipoAlvo) return;
    if (typeof h.multiplicador === "number") h.multiplicador = Math.round(h.multiplicador * (1 + percent) * 100) / 100;
    else if (typeof h.valor === "number") h.valor = Math.round(h.valor * (1 + percent) * 100) / 100;
  });
}

function bonusDefesaPercent(combatente, percent) {
  combatente.defesa = Math.round(combatente.defesa * (1 + percent));
}

function bonusVelPercent(combatente, percent) {
  combatente.velocidade = Math.round(combatente.velocidade * (1 + percent));
}

export const SINERGIAS_FORMACAO = [
  {
    id: "escudo_e_fe",
    classes: ["guerreiro", "clerigo"],
    nome: "Escudo e Fé",
    icone: "🛡️✨",
    descricao: "Guerreiro + Clérigo na mesma fileira: +20% de cura pro Clérigo, +8% de defesa pro Guerreiro.",
    aplicar(cGuerreiro, cClerigo) {
      bonusDefesaPercent(cGuerreiro, 0.08);
      bonusPercentualHabilidade(cClerigo, "cura", 0.2);
    },
  },
  {
    id: "emboscada_coordenada",
    classes: ["ladino", "patrulheiro"],
    nome: "Emboscada Coordenada",
    icone: "🗡️🏹",
    descricao: "Ladino + Patrulheiro na mesma fileira: +12% de chance de crítico pros dois.",
    aplicar(cLadino, cPatrulheiro) {
      cLadino.critBonus = (cLadino.critBonus || 0) + 0.12;
      cPatrulheiro.critBonus = (cPatrulheiro.critBonus || 0) + 0.12;
    },
  },
  {
    id: "convergencia_arcana",
    classes: ["mago", "clerigo"],
    nome: "Convergência Arcana",
    icone: "🔮✨",
    descricao: "Mago + Clérigo na mesma fileira: +10% de dano mágico e +10% de cura.",
    aplicar(cMago, cClerigo) {
      bonusPercentualHabilidade(cMago, "dano_magico", 0.1);
      bonusPercentualHabilidade(cClerigo, "cura", 0.1);
    },
  },
  {
    id: "linha_de_frente_brutal",
    classes: ["barbaro", "guerreiro"],
    nome: "Linha de Frente Brutal",
    icone: "🪓⚔️",
    descricao: "Bárbaro + Guerreiro na mesma fileira: +10% de defesa pros dois.",
    aplicar(cBarbaro, cGuerreiro) {
      bonusDefesaPercent(cBarbaro, 0.1);
      bonusDefesaPercent(cGuerreiro, 0.1);
    },
  },
  {
    id: "tiro_encantado",
    classes: ["patrulheiro", "mago"],
    nome: "Tiro Encantado",
    icone: "🏹🔮",
    descricao: "Patrulheiro + Mago na mesma fileira: +8% de dano nas habilidades ofensivas dos dois.",
    aplicar(cPatrulheiro, cMago) {
      bonusPercentualHabilidade(cPatrulheiro, "dano_fisico_des", 0.08);
      bonusPercentualHabilidade(cMago, "dano_magico", 0.08);
    },
  },
  {
    id: "furia_silenciosa",
    classes: ["barbaro", "ladino"],
    nome: "Fúria Silenciosa",
    icone: "🪓🗡️",
    descricao: "Bárbaro + Ladino na mesma fileira: +10% de velocidade pros dois.",
    aplicar(cBarbaro, cLadino) {
      bonusVelPercent(cBarbaro, 0.1);
      bonusVelPercent(cLadino, 0.1);
    },
  },
];

// Acha, pra uma fileira já filtrada (array de itens com .classeId), a
// primeira sinergia cujas duas classes estão ambas presentes — usado tanto
// pela aplicação real quanto pela prévia, pra nunca divergir uma da outra.
function sinergiaDaFileira(membrosClasses) {
  for (const sinergia of SINERGIAS_FORMACAO) {
    const [classeA, classeB] = sinergia.classes;
    const temA = membrosClasses.includes(classeA);
    const temB = membrosClasses.includes(classeB);
    if (temA && temB && classeA !== classeB) return sinergia;
  }
  return null;
}

// Aplica as sinergias ativas num time já montado (array de combatentes com
// .classeId e .posicao definidos, ver CombatSystem.criarCombatenteJogador)
// — chamado uma vez, na montagem da batalha (ver BattleUI.js). Retorna a
// lista de sinergias que entraram em efeito, pra UI mostrar um aviso.
export function aplicarSinergiasFormacao(combatentesTime) {
  const ativas = [];
  for (const fileira of ["frente", "retaguarda"]) {
    const membros = combatentesTime.filter((c) => c.isPlayer && c.posicao === fileira);
    if (membros.length < 2) continue;
    const sinergia = sinergiaDaFileira(membros.map((m) => m.classeId));
    if (!sinergia) continue;
    const [classeA, classeB] = sinergia.classes;
    const cA = membros.find((c) => c.classeId === classeA);
    const cB = membros.find((c) => c.classeId === classeB && c !== cA);
    if (cA && cB) {
      sinergia.aplicar(cA, cB);
      ativas.push(sinergia);
    }
  }
  return ativas;
}

// Prévia (sem mutar nada) usada pela UI de formação (GachaUI.js) pra
// mostrar quais sinergias estão ativas com a formação atual, antes mesmo de
// entrar em batalha. Recebe uma lista de { classeId, posicao } (um item por
// membro do time, já com a posição resolvida via FormationSystem.posicaoDe).
export function sinergiasAtivasPreview(membrosComClasseEPosicao) {
  const ativas = [];
  for (const fileira of ["frente", "retaguarda"]) {
    const membros = membrosComClasseEPosicao.filter((m) => m.posicao === fileira);
    if (membros.length < 2) continue;
    const sinergia = sinergiaDaFileira(membros.map((m) => m.classeId));
    if (sinergia) ativas.push(sinergia);
  }
  return ativas;
}
