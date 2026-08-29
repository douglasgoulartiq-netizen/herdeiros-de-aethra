// Rivalidade/Amizade entre convocados específicos (melhoria de jogabilidade
// pós-backlog original): pares curados de personagens do gacha com uma
// relação pessoal predefinida (ver gachaRoster.json — identificados pelo
// `rosterId` de cada um, não pelo uid da instância, já que o mesmo par narra
// a mesma história não importa qual cópia específica o jogador tenha) que
// rendem um bônus tático quando os DOIS estão no time ativo ao mesmo tempo.
// Mesmo espírito de FormationSynergySystem.js (par de CLASSES na mesma
// fileira) e FactionSynergySystem.js (3+ da mesma FACÇÃO agregada), mas
// aqui o requisito é sobre QUEM especificamente está no time — dois
// personagens nomeados, em qualquer fileira.
//
// Rivalidade x Amizade têm identidades mecânicas diferentes de propósito:
// rivalidade é uma TROCA (bônus ofensivo/crítico às custas de um pouco de
// defesa — competir um com o outro tira o foco da guarda), enquanto
// amizade é puramente aditiva/de suporte (cobrem um ao outro, sem custo).
// Um convocado pode participar de mais de um par ativo ao mesmo tempo — a
// tabela é pequena o bastante pra não precisar de exclusividade.
//
// Efêmero por batalha, seguindo o mesmo padrão de
// WorldStateSystem.aplicarCamaradagemNoCombatente/FormationSynergySystem/
// FactionSynergySystem: muta direto os `combatente`s já montados em
// BattleUI.js, nunca o `personagem`/instância salva, porque depende de QUEM
// está no time AGORA — pode mudar entre batalhas sem ninguém subir de nível.

const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

export const PARES_RELACIONAMENTO = [
  {
    id: "rivalidade_folha_cinzas",
    tipo: "rivalidade",
    rosterIds: ["ashryn_folhaferrea", "zephyrion_furia_draconiana"],
    nome: "Rivalidade: Folha Verde vs. Cinzas",
    icone: "🔥",
    descricao: "Ashryn Folhaférrea e Zephyrion Fúria Draconiana competem pra provar quem é o bárbaro mais implacável: +8% de crítico pros dois, mas -1 de defesa (a competição fala mais alto que a cautela).",
    bonus: { ...BONUS_VAZIO, critChance: 0.08, defesaFlat: -1 },
  },
  {
    id: "rivalidade_forja",
    tipo: "rivalidade",
    rosterIds: ["kaethrys_escamas_de_aco", "grimnir_punho_de_granito"],
    nome: "Rivalidade: Forjados na Disputa",
    icone: "⚒️",
    descricao: "Kaethrys Escamas de Aço e Grimnir Punho de Granito disputam quem golpeia mais forte desde os tempos de forja: +2 de Força pros dois, mas -2 de defesa.",
    bonus: { ...BONUS_VAZIO, FOR: 2, defesaFlat: -2 },
  },
  {
    id: "amizade_raizes",
    tipo: "amizade",
    rosterIds: ["rowan_trilhaverde", "lyanthe_orvalho_sagrado"],
    nome: "Amizade: Raízes da Mesma Floresta",
    icone: "🌿",
    descricao: "Rowan Trilhaverde e Lyanthe Orvalho Sagrado cresceram juntos entre os Guardiões da Folha Verde: +6% de HP máximo e +1 de defesa pros dois.",
    bonus: { ...BONUS_VAZIO, hpMaxPercent: 0.06, defesaFlat: 1 },
  },
  {
    id: "amizade_arquivo",
    tipo: "amizade",
    rosterIds: ["brokk_runamente", "wyn_faisca_curiosa"],
    nome: "Amizade: Arquivo Compartilhado",
    icone: "📚",
    descricao: "Brokk Runamente e Wyn Faísca Curiosa dividem anotações e feitiços há anos na Ordem dos Arquivistas: +8% de MP máximo e +1 de Inteligência pros dois.",
    bonus: { ...BONUS_VAZIO, mpMaxPercent: 0.08, INT: 1 },
  },
];

// Acha, entre `membros` (array de objetos com `.rosterId` — convocados do
// gacha; o personagem principal nunca tem rosterId próprio, então nunca
// entra num par), todos os pares da tabela acima cujos DOIS lados estão
// presentes no time atual.
export function paresAtivosNoTime(membros) {
  const idsPresentes = new Set((membros || []).filter((m) => m && m.rosterId).map((m) => m.rosterId));
  return PARES_RELACIONAMENTO.filter((par) => par.rosterIds.every((id) => idsPresentes.has(id)));
}

function aplicarBonusAoCombatente(c, bonus) {
  c.atributos.FOR = (c.atributos.FOR || 0) + bonus.FOR;
  c.atributos.DES = (c.atributos.DES || 0) + bonus.DES;
  c.atributos.CON = (c.atributos.CON || 0) + bonus.CON;
  c.atributos.INT = (c.atributos.INT || 0) + bonus.INT;
  c.defesa = Math.max(0, c.defesa + bonus.defesaFlat);
  c.critBonus = (c.critBonus || 0) + bonus.critChance;
  if (bonus.hpMaxPercent) {
    const novoHpMax = Math.max(1, Math.round(c.hpMax * (1 + bonus.hpMaxPercent)));
    c.hp = Math.round(c.hp * (novoHpMax / c.hpMax));
    c.hpMax = novoHpMax;
  }
  if (bonus.mpMaxPercent && c.mpMax > 0) {
    const novoMpMax = Math.round(c.mpMax * (1 + bonus.mpMaxPercent));
    c.mp = Math.round(c.mp * (novoMpMax / c.mpMax));
    c.mpMax = novoMpMax;
  }
}

// Aplica os pares ativos num time já montado (array de combatentes, ver
// CombatSystem.criarCombatenteJogador) — chamado uma vez, na montagem da
// batalha (ver BattleUI.js), igual a aplicarSinergiasFormacao/
// aplicarSinergiaFaccao. `combatentesTime` e `timePersonagens` andam em
// paralelo (mesma ordem/tamanho — ver BattleUI.js), já que o combatente
// montado não carrega rosterId (só o objeto original tem). Retorna a lista
// de pares que entraram em efeito, pra UI mostrar um aviso.
export function aplicarParesRelacionamento(combatentesTime, timePersonagens) {
  const ativos = paresAtivosNoTime(timePersonagens);
  ativos.forEach((par) => {
    par.rosterIds.forEach((rosterId) => {
      const idx = (timePersonagens || []).findIndex((p) => p && p.rosterId === rosterId);
      const combatente = idx >= 0 ? combatentesTime[idx] : null;
      if (combatente) aplicarBonusAoCombatente(combatente, par.bonus);
    });
  });
  return ativos;
}

// Prévia (sem mutar nada), usada pela UI de formação (GachaUI.js) pra
// mostrar quais pares estão ativos com o time atual, antes mesmo de entrar
// em batalha — mesmo espírito de sinergiasAtivasPreview/sinergiaFaccaoPreview.
export function paresRelacionamentoPreview(membros) {
  return paresAtivosNoTime(membros);
}
