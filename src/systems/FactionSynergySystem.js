// Sinergia de facção em batalha (melhoria de jogabilidade pós-backlog
// original): quando 3 ou mais membros do time atual vêm da MESMA facção de
// origem (personagem.facaoId, ver gachaRoster.json), o grupo luta com mais
// coordenação — pequeno bônus tático que vale pra TODO o time nesta
// batalha, não só quem é da facção (diferente da camaradagem regional,
// task #44, ver WorldStateSystem.aplicarCamaradagemNoCombatente, que só
// beneficia CADA convocado individualmente e depende da afiliação pessoal
// que o jogador escolheu). Aqui o requisito é só sobre quem está no time
// agora, entre si — não depende de nenhuma escolha de afiliação prévia,
// então dá pra ativar com qualquer facção, inclusive uma que o jogador
// nunca visitou.
//
// O time tem no máximo 4 (personagem principal + até 3 convocados do
// gacha, ver BattleUI.js/FormationSystem.js). O personagem principal nunca
// tem facaoId próprio — só convocados nascem com uma —, então o limiar de
// 3 só é alcançável quando os 3 convocados do time inteiro vêm da mesma
// facção: recompensa deliberada por montar um time temático em vez de só
// pegar os convocados com melhor status individual.
//
// Efêmero por batalha, seguindo o mesmo padrão de
// WorldStateSystem.aplicarCamaradagemNoCombatente/FormationSynergySystem:
// muta direto os `combatente`s já montados (nunca o `personagem` salvo),
// porque depende de QUEM está no time agora, podendo mudar entre batalhas
// sem ninguém subir de nível.

export const LIMIAR_SINERGIA_FACCAO = 3;

const BONUS_SINERGIA_FACCAO = { FOR: 1, DES: 1, CON: 0, INT: 1, defesaFlat: 1, critChance: 0.03 };

// Acha a facção com mais membros no time atual, entre quem TEM facaoId
// (convocados do gacha; o personagem principal nunca conta) e quantos são.
// `membros` é um array de objetos com `.facaoId` (personagens de verdade ou
// só a projeção mínima usada pela prévia da UI de formação) — não são
// combatentes montados, que não carregam facaoId (ver criarCombatenteJogador
// em CombatSystem.js).
// Facção com que um membro conta para a sinergia: o convocado tem a de
// nascença (`facaoId`); o herói conta pela afiliação que escolheu (ele não
// tem `facaoId` de propósito — ver CharacterFactory). Antes o herói nunca
// contava, e um time de três convocados do mesmo povo com o herói afiliado a
// ele não fechava a sinergia.
export function facaoParaSinergia(m) {
  if (!m) return null;
  if (m.facaoId) return m.facaoId;
  return (m.estadoDoMundo && m.estadoDoMundo.facaoAfiliada) || null;
}

export function facaoDominanteDoTime(membros) {
  const contagem = {};
  for (const m of membros || []) {
    const f = facaoParaSinergia(m);
    if (!f) continue;
    contagem[f] = (contagem[f] || 0) + 1;
  }
  let melhorId = null;
  let melhorCount = 0;
  for (const [id, count] of Object.entries(contagem)) {
    if (count > melhorCount) {
      melhorId = id;
      melhorCount = count;
    }
  }
  return melhorCount > 0 ? { facaoId: melhorId, count: melhorCount } : null;
}

function infoSinergiaFaccao(dominante, dadosWorldState) {
  if (!dominante) return null;
  const facao = ((dadosWorldState && dadosWorldState.facoes) || []).find((f) => f.id === dominante.facaoId);
  const nomeFaccao = facao ? facao.nome : dominante.facaoId;
  return {
    categoria: "faccao",
    facaoId: dominante.facaoId,
    count: dominante.count,
    icone: (facao && facao.icone) || "🤝",
    nome: `Unidade dos ${nomeFaccao}`,
    descricao: `${dominante.count} membros do time são da facção ${nomeFaccao}: +1 FOR, +1 DES, +1 INT, +1 de defesa e +3% de crítico pro time inteiro nesta batalha.`,
  };
}

// Prévia (sem mutar nada), usada pela UI de formação (GachaUI.js) pra
// mostrar se a sinergia de facção está ativa com o time atual, antes mesmo
// de entrar em batalha — mesmo espírito de sinergiasAtivasPreview em
// FormationSynergySystem.js.
export function sinergiaFaccaoPreview(membros, dadosWorldState) {
  const dominante = facaoDominanteDoTime(membros);
  if (!dominante || dominante.count < LIMIAR_SINERGIA_FACCAO) return null;
  return infoSinergiaFaccao(dominante, dadosWorldState);
}

// Aplica o bônus no time inteiro já montado (array de combatentes, ver
// CombatSystem.criarCombatenteJogador) quando 3+ dos `timePersonagens`
// (mesma ordem/tamanho de `combatentesTime`, ver BattleUI.js) compartilham
// a mesma facaoId. Retorna a sinergia ativa (pra UI mostrar o aviso, igual
// às sinergias de formação) ou null se não atingiu o limiar.
export function aplicarSinergiaFaccao(combatentesTime, timePersonagens, dadosWorldState) {
  const dominante = facaoDominanteDoTime(timePersonagens);
  if (!dominante || dominante.count < LIMIAR_SINERGIA_FACCAO) return null;
  for (const combatente of combatentesTime || []) {
    if (!combatente.isPlayer) continue;
    combatente.atributos.FOR = (combatente.atributos.FOR || 0) + BONUS_SINERGIA_FACCAO.FOR;
    combatente.atributos.DES = (combatente.atributos.DES || 0) + BONUS_SINERGIA_FACCAO.DES;
    combatente.atributos.CON = (combatente.atributos.CON || 0) + BONUS_SINERGIA_FACCAO.CON;
    combatente.atributos.INT = (combatente.atributos.INT || 0) + BONUS_SINERGIA_FACCAO.INT;
    combatente.defesa += BONUS_SINERGIA_FACCAO.defesaFlat;
    combatente.critBonus = (combatente.critBonus || 0) + BONUS_SINERGIA_FACCAO.critChance;
  }
  return infoSinergiaFaccao(dominante, dadosWorldState);
}
