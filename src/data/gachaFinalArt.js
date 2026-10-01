// Artes exclusivas das duas levas; carregadas sob demanda.
export const GACHA_FINAL_ART = Object.freeze({
  ...Object.fromEntries(['paladino','bardo','druida','necromante'].flatMap(classe =>
    [1,2,3,4].map(n => [`gacha_novo_${classe}_${n}`, `assets/arte_v2/gacha_novo_${classe}_${n}.png`]))),
  'gacha_novo_paladino_5': 'assets/arte_v2/gacha_novo_paladino_5.png',
  'gacha_novo_paladino_6': 'assets/arte_v2/gacha_novo_paladino_6.png',
  'gacha_novo_paladino_7': 'assets/arte_v2/gacha_novo_paladino_7.png',
  'gacha_novo_paladino_8': 'assets/arte_v2/gacha_novo_paladino_8.png',
  'gacha_novo_bardo_5': 'assets/arte_v2/gacha_novo_bardo_5.png',
  'gacha_novo_bardo_6': 'assets/arte_v2/gacha_novo_bardo_6.png',
  'gacha_novo_bardo_7': 'assets/arte_v2/gacha_novo_bardo_7.png',
  'gacha_novo_bardo_8': 'assets/arte_v2/gacha_novo_bardo_8.png',
  'gacha_novo_druida_5': 'assets/arte_v2/gacha_novo_druida_5.png',
  'gacha_novo_druida_6': 'assets/arte_v2/gacha_novo_druida_6.png',
  'gacha_novo_druida_7': 'assets/arte_v2/gacha_novo_druida_7.png',
  'gacha_novo_druida_8': 'assets/arte_v2/gacha_novo_druida_8.png',
  'gacha_novo_necromante_5': 'assets/arte_v2/gacha_novo_necromante_5.png',
  'gacha_novo_necromante_6': 'assets/arte_v2/gacha_novo_necromante_6.png',
  'gacha_novo_necromante_7': 'assets/arte_v2/gacha_novo_necromante_7.png',
  'gacha_novo_necromante_8': 'assets/arte_v2/gacha_novo_necromante_8.png',
});
