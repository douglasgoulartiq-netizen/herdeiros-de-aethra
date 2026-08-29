// Grade de formação (task #43): posiciona cada membro do time (personagem
// principal + até 3 convocados do gacha, ver GachaSystem.js) em "frente" ou
// "retaguarda". Isso afeta quem os inimigos preferem mirar e quanto dano
// físico um alvo na retaguarda recebe (ver CombatSystem.js). Não é uma
// mecânica de posição livre no espaço — só duas fileiras, 2 vagas cada.
export const POSICOES = ["frente", "retaguarda"];
export const VAGAS_POR_POSICAO = 2;

// Guarda a formação em personagem.formacao = { [idCombatente]: "frente"|"retaguarda" }.
// idCombatente é "player" pro personagem principal, ou o uid do personagem de
// gacha — os mesmos ids usados pelos combatentes em CombatSystem.js.
export function garantirFormacao(personagem) {
  if (!personagem.formacao) personagem.formacao = {};
  return personagem.formacao;
}

// Posição padrão quando o jogador nunca configurou: os 2 primeiros do time
// (na ordem principal -> convocados) vão pra frente, o resto pra retaguarda.
// `idsTime` é a lista ordenada de ids que vão pra batalha (ex.: ["player",
// uid1, uid2, uid3]).
export function posicaoDe(personagem, idCombatente, idsTime) {
  const f = garantirFormacao(personagem);
  if (f[idCombatente]) return f[idCombatente];
  const idx = idsTime.indexOf(idCombatente);
  return idx >= 0 && idx < VAGAS_POR_POSICAO ? "frente" : "retaguarda";
}

// Define a posição de um combatente, respeitando o teto de 2 vagas por
// fileira — se a fileira de destino já estiver cheia, troca de lugar com
// quem está lá (nunca deixa mais de 2 na mesma fileira nem perde ninguém).
export function definirPosicao(personagem, idCombatente, novaPosicao, idsTime) {
  if (!POSICOES.includes(novaPosicao)) return { ok: false };
  const f = garantirFormacao(personagem);
  // Garante que todo mundo no time já tem uma posição resolvida (default
  // aplicado) antes de mexer, senão a contagem de vagas fica incorreta.
  idsTime.forEach((id) => { f[id] = posicaoDe(personagem, id, idsTime); });

  const posicaoAtual = f[idCombatente];
  if (posicaoAtual === novaPosicao) return { ok: true };

  const ocupantesDestino = idsTime.filter((id) => id !== idCombatente && f[id] === novaPosicao);
  if (ocupantesDestino.length >= VAGAS_POR_POSICAO) {
    // Troca de lugar com o último ocupante da fileira de destino.
    const trocaCom = ocupantesDestino[ocupantesDestino.length - 1];
    f[trocaCom] = posicaoAtual;
  }
  f[idCombatente] = novaPosicao;
  return { ok: true };
}

// Monta a lista de { id, posicao } pra cada membro do time, pronta pra
// CombatSystem.js aplicar em criarCombatenteJogador(). `idsTime` já vem na
// ordem principal -> convocados (ver BattleUI.js).
export function formacaoParaBatalha(personagem, idsTime) {
  return idsTime.map((id) => ({ id, posicao: posicaoDe(personagem, id, idsTime) }));
}
