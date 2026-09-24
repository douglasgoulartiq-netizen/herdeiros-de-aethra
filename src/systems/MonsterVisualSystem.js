// A identidade é compartilhada entre exploração e combate. O porte é
// visual apenas: não altera colisão, alcance, atributos ou dificuldade.
const HUMANOIDES = new Set([
  'bandido', 'goblin', 'esqueleto', 'orc_selvagem', 'pirata_naufrago',
  'druida_corrompido', 'necromante_errante', 'bruxa_da_bruma',
  'carrasco_de_cinzas', 'arauto_das_cinzas', 'paladino_do_sol_poente',
  'bruxa_do_lodo_eterno', 'capita_mare_negra', 'cavaleiro_caido_de_aethra',
  'rei_petrificado', 'matriarca_da_bruma_eterna', 'senhor_sombrio_da_montanha',
  'imperador_arcano_dos_confins', 'primeira_voz', 'capataz_de_pedra',
  'cortador_de_cordas', 'dona_do_poco', 'jardineira_de_perola',
  'oficiante_do_oco', 'ultimo_sacerdote', 'campea_invicta', 'guardia_das_ilhas',
]);

export function monstroHumanoide(monstro = {}) {
  if (typeof monstro.humanoide === 'boolean') return monstro.humanoide;
  const id = monstro.monstroId || monstro.id || String(monstro.spriteKey || monstro.sprite || '').replace(/^mob_/, '');
  return HUMANOIDES.has(id);
}

export function escalaChefeMapa(monstro) {
  return monstroHumanoide(monstro) ? 1.65 : 4.32;
}

export function imagemOficialMonstro(imagens, sprite) {
  return imagens?.[`mb_${sprite}`] || imagens?.[sprite];
}
