// Uma fonte de arte para corpo e retrato; recorte em tempo de desenho.
// O cache fraco evita ler pixels a cada quadro e permite liberar imagens.
const recortes = new WeakMap();
const prontos = new WeakMap();
const corposProntos = new WeakSet();
const retratosProntos = new Map();

export function quadroPersonagem(img, folha = false) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  return folha ? { x: w / 3, y: 0, w: w / 3, h: h / 4 }
    : { x: 0, y: 0, w: w >= h * 1.8 ? h : w, h };
}

function limites(img, folha) {
  const chave = folha ? 'folha' : 'corpo';
  let cache = recortes.get(img);
  if (cache?.[chave]) return cache[chave];
  const q = quadroPersonagem(img, folha);
  const c = document.createElement('canvas');
  // Varredura pequena, apenas uma vez por imagem, ignorando sombra suave.
  c.width = 192; c.height = Math.max(1, Math.round(192 * q.h / q.w));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, c.width, c.height);
  let resultado = q;
  try {
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let l = c.width, t = c.height, r = -1, b = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (pixels[(y * c.width + x) * 4 + 3] < 100) continue;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    if (r >= l) resultado = { x: q.x + l * q.w / c.width, y: q.y + t * q.h / c.height,
      w: (r - l + 1) * q.w / c.width, h: (b - t + 1) * q.h / c.height };
  } catch { /* Imagem externa sem CORS: mantém o enquadramento original. */ }
  cache ||= {}; cache[chave] = resultado; recortes.set(img, cache);
  return resultado;
}

export function encaixeCorpo(q, tamanho = 192, raca = '') {
  const porte = ({ anao: .88, halfling: .8 })[raca] || 1;
  const escala = Math.min(tamanho * .9 / q.w, tamanho * .9 * porte / q.h);
  const w = q.w * escala, h = q.h * escala;
  return { x: (tamanho - w) / 2, y: tamanho * .95 - h, w, h };
}

export function artePersonagem(img, { folha = false, retrato = false, raca = '' } = {}) {
  if (!retrato && corposProntos.has(img)) return img;
  const chave = `${folha}/${retrato}/${raca}`;
  let cache = prontos.get(img);
  if (cache?.[chave]) return cache[chave];
  const q = limites(img, folha);
  const c = document.createElement('canvas'); c.width = c.height = retrato ? 96 : 192;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (retrato) {
    // Rosto e ombros; o corpo permanece disponível ao selecionar o herói.
    const alto = String(img.src || '').includes('mordak_quebramuralhas');
    const lado = Math.min(q.w, q.h * (alto ? .36 : .4));
    ctx.drawImage(img, q.x + (q.w - lado) / 2, q.y + (alto ? q.h * .13 : 0), lado, lado, 4, 4, 88, 88);
  } else {
    const d = encaixeCorpo(q, c.width, raca);
    ctx.drawImage(img, q.x, q.y, q.w, q.h, d.x, d.y, d.w, d.h);
  }
  cache ||= {}; cache[chave] = c; prontos.set(img, cache);
  if (!retrato) corposProntos.add(c);
  return c;
}

// Só transforma personagens; monstros, pets e cenários não passam aqui.
export function prepararRetratoPersonagem(img) {
  if (!img?.dataset?.personagem || img.dataset.artePronta || !img.naturalWidth) return;
  try {
    const chave = `${img.getAttribute('src')}|${img.dataset.folha}|${img.dataset.retrato}|${img.dataset.raca}`;
    let url = retratosProntos.get(chave);
    if (!url) {
      const canvas = artePersonagem(img, { folha: img.dataset.folha === '1',
        retrato: img.dataset.retrato === '1', raca: img.dataset.raca || '' });
      url = canvas.toDataURL('image/png');
      if (retratosProntos.size >= 96) retratosProntos.delete(retratosProntos.keys().next().value);
      retratosProntos.set(chave, url);
    }
    img.dataset.artePronta = '1';
    img.src = url;
    img.style.visibility = '';
  } catch { img.style.visibility = ''; }
}
