// Arte visual independente da planta: não altera colisões, RNG ou saves.
export const ARTES_CIDADES = [
  'campo', 'mercador', 'bosque', 'neve', 'cla', 'forja', 'mina',
  'oasis', 'caravana', 'palafita', 'pescador', 'porto', 'coral',
  'vento', 'arcana', 'pousada', 'templo',
];

export const ARQUITETURA_REGIONAL = {
  altaverde: ['campo', 'mercador', 'bosque'],
  morranvell: ['neve', 'cla'],
  montanhas_de_vulkor: ['forja', 'mina'],
  canon_rubro: ['mina', 'forja'],
  deserto_de_arenth: ['oasis', 'caravana'],
  pantano_de_thalgor: ['palafita', 'bosque'],
  costa_da_mare: ['pescador', 'porto'],
  recife_coralino: ['coral', 'pescador'],
  vale_dos_titas: ['cla', 'arcana'],
  sombralith: ['arcana', 'cla'],
  arquipelago_de_nuvens: ['vento', 'coral'],
  vale_do_vento: ['vento', 'mercador'],
  ruinas_de_aethra: ['arcana', 'campo'],
  bosque_eterno: ['bosque', 'campo'],
  selva_umbriaca: ['palafita', 'bosque'],
  lago_prismatico: ['pescador', 'bosque'],
  abismo_de_nazthal: ['arcana', 'mina'],
};

export function arteDaCidade(prop, regiaoId) {
  if (prop.id === 'pousada' || prop.id === 'templo') return prop.id;
  if (!prop.id?.startsWith('casa')) return null;
  const paleta = ARQUITETURA_REGIONAL[regiaoId] || ARQUITETURA_REGIONAL.altaverde;
  // Hash local: novas imagens nunca consomem a sequência aleatória do mundo.
  const hash = (Math.imul(prop.x, 73856093) ^ Math.imul(prop.y, 19349663)) >>> 0;
  return paleta[hash % paleta.length];
}
