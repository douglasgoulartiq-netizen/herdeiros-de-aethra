// Carrega somente o bioma da luta atual. Cache limitado evita manter todos
// os fundos decodificados na memória de um celular.
export const FUNDOS_BATALHA = Object.freeze(Object.fromEntries([
  'floresta', 'pantano', 'deserto', 'montanha', 'costa', 'ruinas',
  'masmorra', 'vila', 'campo', 'neve', 'vulcao', 'cristal', 'agua',
].map(id => [id, new URL(`../../assets/cenarios-batalha/${id}-v1.webp`, import.meta.url).href])));

const cache = new Map();
export function carregarFundoBatalha(id) {
  const url = FUNDOS_BATALHA[id];
  if (!url || typeof Image === 'undefined') return Promise.resolve(null);
  if (cache.has(id)) {
    const promessa = cache.get(id);
    cache.delete(id); cache.set(id, promessa);
    return promessa;
  }
  const promessa = new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => { cache.delete(id); resolve(null); };
    img.src = url;
  });
  cache.set(id, promessa);
  while (cache.size > 3) cache.delete(cache.keys().next().value);
  return promessa;
}

export function desenharFundoIlustrado(ctx, img, largura, altura, horizonte) {
  // Separa panorama e piso para que os pés nunca fiquem no céu ao girar o
  // celular. Recorte horizontal central preserva proporção na vertical.
  const corte = Math.round(img.height * .34);
  const linha = Math.round(altura * Math.max(.16, Math.min(.32, horizonte)));
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const sw = Math.min(img.width, img.height * largura / altura);
  const faixa = (sy, sh, dy, dh) => {
    ctx.drawImage(img, (img.width - sw) / 2, sy, sw, sh, 0, dy, largura, dh);
  };
  faixa(0, corte, 0, linha);
  faixa(corte, img.height - corte, linha, altura - linha);
  const sombra = ctx.createLinearGradient(0, 0, 0, altura);
  sombra.addColorStop(0, 'rgba(8,14,24,.12)');
  sombra.addColorStop(.4, 'rgba(8,14,24,.08)');
  sombra.addColorStop(1, 'rgba(8,14,24,.25)');
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, largura, altura);
  // Reduz o contraste apenas no piso ocupado pelos combatentes. O panorama
  // e as bordas continuam ricos, sem blur caro ou nova imagem decodificada.
  const palco = ctx.createRadialGradient(largura * .5, altura * .63, 0, largura * .5, altura * .63, Math.max(largura, altura) * .58);
  palco.addColorStop(0, 'rgba(26,33,38,.30)');
  palco.addColorStop(.62, 'rgba(26,33,38,.16)');
  palco.addColorStop(1, 'rgba(26,33,38,0)');
  ctx.fillStyle = palco;
  ctx.fillRect(0, linha, largura, altura - linha);
  ctx.restore();
}
