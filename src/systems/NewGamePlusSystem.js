// New Game+ (melhoria de jogabilidade pós-backlog original): reinicia a
// aventura do zero (novo personagem, novo mundo — nível 1, sem itens, sem
// missões, sem exploração salva) mas preserva o roster de invocação (ver
// GachaSystem.js: personagem.gacha guarda personagens obtidos, Fragmentos
// de Aethra, pity e conquistas) e aumenta um contador que escala o desafio
// dos monstros na batalha (ver CombatSystem.js: NG_PLUS_ESCALA_POR_NIVEL /
// criarCombatenteInimigo). Só fica disponível depois de derrotar o chefe
// final ao menos uma vez — ver elegivelParaNgPlus.
export function elegivelParaNgPlus(salvo) {
  return !!(
    salvo &&
    salvo.personagem &&
    salvo.personagem.gacha &&
    Array.isArray(salvo.personagem.gacha.conquistas) &&
    salvo.personagem.gacha.conquistas.includes("dragao_derrotado")
  );
}

// Recebe o personagem RECÉM-CRIADO (nível 1, via CharacterFactory.js) e o
// personagem do save anterior, de onde vem o roster/progresso do gacha a
// preservar. Muta e retorna o personagem novo (mesmo padrão de
// aplicarCrescimento/aplicarEscolhaArvore em CharacterFactory.js).
export function aplicarNewGamePlus(personagemNovo, personagemAntigo) {
  personagemNovo.gacha = personagemAntigo.gacha;
  personagemNovo.ngPlus = (personagemAntigo.ngPlus || 0) + 1;
  return personagemNovo;
}
