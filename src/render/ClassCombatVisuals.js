import { visualDeClasse } from '../data/classVisuals.js';

// Tudo cabe no canvas do próprio ator: servo não ocupa vaga nem invade o HUD.
export function desenharVisualDeClasse(ctx, c, imagens, tempo, reduzido = false) {
  const estado = visualDeClasse(c);
  const fera = estado.fera && imagens.efeito_forma_fera;
  const servo = estado.servo && imagens.efeito_servo_vinculado;
  if (fera?.width > 32) {
    ctx.clearRect(0, 0, 192, 192);
    const respirar = reduzido ? 0 : Math.round(Math.sin(tempo / 380) * 2);
    ctx.drawImage(fera, 0, 0, fera.width, fera.height, 0, 4 - respirar, 192, 184 + respirar);
  }
  if (servo?.width > 32) {
    const flutuar = reduzido ? 0 : Math.round(Math.sin(tempo / 320) * 3);
    ctx.save();
    ctx.globalAlpha = .88;
    ctx.drawImage(servo, 0, 0, servo.width, servo.height, 132, 119 + flutuar, 58, 67);
    ctx.restore();
  }
  return estado;
}
