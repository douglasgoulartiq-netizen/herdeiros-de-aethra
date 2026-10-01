// Folhas 3x4: passada, repouso, passada; frente, esquerda, direita, costas.
export const WALK_ART = Object.freeze(Object.fromEntries(
  ['humano', 'elfo', 'anao', 'halfling', 'orc', 'draconato'].flatMap(raca =>
    ['paladino', 'bardo', 'druida', 'necromante'].map(classe => {
      const key = `pc_${raca}_${classe}`;
      return [key, `assets/sprites/walk_v2_${key}.png`];
    }))));

export const CLASS_EFFECT_ART = Object.freeze({
  forma_fera: 'assets/arte_v2/efeito_forma_fera.png',
  servo_vinculado: 'assets/arte_v2/efeito_servo_vinculado.png',
});

export function quadroCaminhada(img, direcao = 'baixo', fase = 0, andando = false, chave = '') {
  const w = img.width / 3, h = img.height / 4;
  let linha = ({ baixo: 0, esquerda: 1, direita: 2, cima: 3 })[direcao] ?? 0;
  const coluna = andando ? [1, 0, 1, 2][((Math.floor(fase) % 4) + 4) % 4] : 1;
  // Na folha aprovada do paladino élfico, as últimas poses laterais vieram
  // trocadas entre as linhas. O recorte corrige a direção sem espelhar armas.
  if (chave === 'pc_elfo_paladino' && coluna === 2 && (linha === 1 || linha === 2)) linha = 3 - linha;
  return { x: coluna * w, y: linha * h, w, h };
}

export function visualDeClasse(combatente) {
  const ativos = combatente.vivo ? (combatente.statusEffects || []) : [];
  return {
    fera: ativos.some(s => s.tipo === 'forma_animal'),
    servo: ativos.some(s => s.tipo === 'servo_vinculado'),
  };
}
