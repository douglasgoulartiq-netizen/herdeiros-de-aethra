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
};
