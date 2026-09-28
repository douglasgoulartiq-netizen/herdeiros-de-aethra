// Detalhes arquitetônicos leves sobre a hospedagem existente. Sem imagens
// extras, filtros por quadro ou alterações na caixa de colisão do prédio.
export const ESTILOS_HOSPEDAGEM = {
  alpina: { tecido: '#475e72', claro: '#dce5df', simbolo: '❄' },
  maritima: { tecido: '#276f83', claro: '#ede3bf', simbolo: '≈' },
  caravana: { tecido: '#ad6545', claro: '#f0d797', simbolo: '◇' },
  bosque: { tecido: '#41684d', claro: '#e0d6a1', simbolo: '♧' },
  real: { tecido: '#663e65', claro: '#e2c985', simbolo: '♜' },
};

export function desenharHospedagem(ctx, estilo, x, y, w, h) {
  const p = ESTILOS_HOSPEDAGEM[estilo];
  if (!p) return;
  ctx.save();
  const px = Math.max(1, Math.round(w / 96));
  const rect = (a, b, c, d, cor) => {
    ctx.fillStyle = cor;
    ctx.fillRect(Math.round(x + a * w), Math.round(y + b * h), Math.round(c * w), Math.round(d * h));
  };
  // Marquise listrada, apoios de madeira e placa de descanso.
  // A marquise fica sobre a varanda lateral existente, nunca sobre a porta
  // central ou sobre a escadaria que indica o acesso ao descanso.
  rect(.16, .69, .22, .045, p.tecido);
  for (let i = 0; i < 5; i++) rect(.165 + i * .043, .69, .018, .045, p.claro);
  rect(.16, .735, .22, .01, '#392e29');
  rect(.16, .746, .009, .12, '#70503a');
  rect(.37, .746, .009, .12, '#70503a');
  rect(.81, .49, .016, .10, '#503c2d');
  rect(.79, .51, .09, .08, '#272d2a');
  ctx.strokeStyle = p.claro;
  ctx.lineWidth = px;
  ctx.strokeRect(Math.round(x + w * .79), Math.round(y + h * .51), Math.round(w * .09), Math.round(h * .08));
  ctx.fillStyle = p.claro;
  ctx.font = `${Math.max(7, Math.round(w * .045))}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.simbolo, x + w * .835, y + h * .55);
  if (estilo === 'alpina') {
    rect(.16, .68, .22, .01, '#e6eeed');
  } else if (estilo === 'bosque') {
    for (let i = 0; i < 4; i++) rect(.18 + i * .02, .73 + i * .035, .028, .045, i % 2 ? '#739458' : '#3e6543');
  } else if (estilo === 'caravana') {
    rect(.12, .88, .12, .07, '#936245');
    rect(.14, .855, .08, .025, '#c0915b');
  }
  ctx.restore();
}
