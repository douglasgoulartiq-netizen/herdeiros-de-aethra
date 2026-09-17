// Flags para os sistemas novos (aditivos) do jogo. Cada flag pode ser
// desligada individualmente durante testes sem remover nenhum código —
// com a flag desligada, o sistema correspondente se comporta exatamente
// como antes de existir (fallback para o comportamento original).
export const FLAGS = {
  elementos: true, // matriz de força/fraqueza elemental no dano de combate
  iaInimigos: true, // arquétipos de comportamento + intenção antes do ataque
  ameacaPreCombate: true, // classificação de ameaça (Trivial..Mortal) antes da batalha
  terreno: true, // bônus de ataque elemental por zona/masmorra + resistência de inimigos nativos (task #42)
  reacoesElementais: true, // motor de estados/reações elementais (Caminhos do Herdeiro, task #91) — inerte até uma habilidade nova declarar `aplicaEstado`, ver ElementalReactionSystem.js
  // Arte nova (assets/arte_v2/). NASCE DESLIGADA de propósito: com ela
  // desligada o jogo procura exatamente os mesmos arquivos de sempre, então
  // ligar a tubulação não muda um pixel do que está no ar hoje.
  //
  // Ligar aqui vale pro jogo inteiro. Para comparar a arte antiga e a nova
  // numa batalha só, NÃO mexa nisto — passe { arteV2: true } na chamada do
  // resolver (ver AssetResolver.js): o override vale só naquele encontro.
  // É a diferença entre "trocar o jogo" e "espiar o resultado".
  arteV2: true,
};
