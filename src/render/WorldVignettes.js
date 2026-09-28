export const CORES_CIDADE = Object.freeze({
  gelo: '#a7cee2', forja: '#ce784f', porto: '#53acbf', elevada: '#b4b5dc',
  ruina: '#9c87bb', deserto: '#ddb275', sombria: '#91739e',
  organica: '#83ae75', ventos: '#7db3d3', verde: '#739d77',
});

export function atividadeVisual(npc) {
  if (npc.ambulante || npc.andando) return null;
  if (npc.servicos?.includes('forja')) return 'forja';
  if (npc.servicos?.includes('loja') || npc.papelVisual === 'mercador') return 'mercado';
  if (npc.papelVisual === 'guarda') return 'vigia';
  return null;
}

export function desenharEstandarte(ctx, tema, x, y, tamanho) {
  const cor = CORES_CIDADE[tema];
  if (!cor) return;
  ctx.save();
  ctx.fillStyle = '#665747';
  ctx.fillRect(x + tamanho * .46, y + tamanho * .12, tamanho * .38, Math.max(1, tamanho * .03));
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(x + tamanho * .53, y + tamanho * .16);
  ctx.lineTo(x + tamanho * .83, y + tamanho * .16);
  ctx.lineTo(x + tamanho * .83, y + tamanho * .64);
  ctx.lineTo(x + tamanho * .68, y + tamanho * .55);
  ctx.lineTo(x + tamanho * .53, y + tamanho * .64);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#eee1b7';
  ctx.fillRect(x + tamanho * .66, y + tamanho * .25, tamanho * .04, tamanho * .18);
  ctx.restore();
}

// Cenas restritas ao tile do trabalhador: não criam obstáculos invisíveis
// nem novos NPCs. Só são chamadas após o descarte dos atores fora da câmera.
export function desenharAtividade(ctx, n, x, y, t, tempo, reduzido = false) {
  const atividade = atividadeVisual(n);
  if (!atividade) return;
  const fase = reduzido ? 0 : (tempo % 2600) / 2600;
  ctx.save();
  if (atividade === 'forja') {
    ctx.fillStyle = '#303d47';
    ctx.fillRect(x + t * .66, y + t * .73, t * .30, t * .08);
    ctx.fillRect(x + t * .74, y + t * .81, t * .12, t * .12);
    ctx.fillStyle = '#839098'; ctx.fillRect(x + t * .66, y + t * .73, t * .30, Math.max(1,t * .018));
    ctx.save();
    ctx.translate(x + t * .71, y + t * .65);
    ctx.rotate(fase < .22 ? -Math.sin(fase / .22 * Math.PI) * .8 : 0);
    ctx.fillStyle = '#9b7956'; ctx.fillRect(0, -t * .17, t * .04, t * .25);
    ctx.fillStyle = '#a1b2bb'; ctx.fillRect(-t * .07, -t * .20, t * .16, t * .07);
    ctx.restore();
    if (!reduzido && fase > .22 && fase < .27) {
      ctx.fillStyle = '#efc783';
      ctx.fillRect(x + t * .87, y + t * .63, Math.max(1,t * .025), Math.max(1,t * .025));
    }
  } else if (atividade === 'mercado') {
    ctx.fillStyle = '#785238'; ctx.fillRect(x + t * .66, y + t * .74, t * .29, t * .19);
    ctx.fillStyle = '#ad8357';
    ctx.fillRect(x + t * .68, y + t * .76, t * .018, t * .14);
    ctx.fillRect(x + t * .91, y + t * .76, t * .018, t * .14);
    ctx.fillStyle = '#b89a63'; ctx.fillRect(x + t * .67, y + t * .72, t * .27, t * .04);
    ctx.fillStyle = '#8d9e64';
    const levantar = reduzido ? 0 : Math.max(0, Math.sin(fase * Math.PI * 2)) * t * .04;
    ctx.fillRect(x + t * .71, y + t * .66 - levantar, t * .08, t * .07);
    ctx.fillStyle = '#bf805d'; ctx.fillRect(x + t * .82, y + t * .66, t * .08, t * .07);
  } else {
    // A arte do guarda já carrega lança: não duplicar a arma. Um pequeno
    // reflexo no metal, com longos intervalos, mantém a pose de vigília.
    if (!reduzido && fase > .82 && fase < .91) {
      ctx.globalAlpha = .3; ctx.fillStyle = '#d4e1de';
      ctx.fillRect(x + t * .38, y + t * .53, t * .035, t * .055);
    }
  }
  ctx.restore();
}
