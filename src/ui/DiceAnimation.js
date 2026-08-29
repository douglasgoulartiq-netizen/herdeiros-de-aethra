// Animação genérica de "dado rolando" (d20): usada tanto no combate
// (BattleUI.js, a cada ataque/habilidade que rola d20) quanto em testes de
// perícia fora de combate (GameUI.js) — qualquer lugar que já use d20() de
// CombatSystem.js pode reaproveitar este componente visual em vez de só
// mostrar o resultado direto no texto do log.
//
// Duração-base ~1s (pedido explícito de design), escalada pelo multiplicador
// de velocidade de animação escolhido em Acessibilidade (ver
// AccessibilitySystem.js) — "instantâneo" ainda mostra o dado parar no
// número certo, só que quase sem demora, pra nunca pular direto pro
// resultado sem nenhum feedback visual.
import { multiplicadorVelocidadeAnimacao } from "../systems/AccessibilitySystem.js";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// Escala uma duração-base (ms) pelo multiplicador de velocidade de animação
// escolhido pelo jogador — usado por qualquer animação de combate nova
// (dado, golpe, textos flutuantes de status) pra todas obedecerem a mesma
// preferência de velocidade sem duplicar a leitura da config em cada lugar.
export function duracaoAnimacao(baseMs) {
  return Math.max(16, Math.round(baseMs * multiplicadorVelocidadeAnimacao()));
}

// Cria e anima um dado d20 dentro de `container` (elemento já posicionado —
// normalmente uma camada absoluta central da arena de batalha ou do modal de
// teste de perícia). Cicla números 1-20 aleatórios rapidamente e então para
// EXATAMENTE no `resultado` já decidido por fora (nunca sorteia um valor
// próprio — o d20 real já foi rolado pela lógica de jogo antes desta função
// ser chamada; ela só encena visualmente o resultado que já aconteceu).
// Crítico (d>16, regra deste jogo) e Falha Total (d<4) ganham uma cor/borda
// distintas ao pousar. Resolve a Promise quando a animação termina (o número
// final fica visível por um instante antes de a chamadora poder removê-lo).
export async function animarDado(container, resultado, { critico = false, fumble = false, duracaoTotalMs = 1000 } = {}) {
  if (!container) return;
  const el = document.createElement("div");
  el.className = "dado-rolagem";
  el.textContent = "?";
  container.appendChild(el);

  const duracaoRolagem = duracaoAnimacao(duracaoTotalMs * 0.7);
  const intervaloTick = Math.max(28, duracaoAnimacao(65));
  const inicio = Date.now();
  await new Promise((resolve) => {
    const tick = () => {
      el.textContent = String(1 + Math.floor(Math.random() * 20));
      if (Date.now() - inicio < duracaoRolagem) {
        setTimeout(tick, intervaloTick);
      } else {
        resolve();
      }
    };
    tick();
  });

  el.textContent = String(resultado);
  el.classList.add("parado");
  if (critico) el.classList.add("critico");
  else if (fumble) el.classList.add("fumble");
  await sleep(duracaoAnimacao(duracaoTotalMs * 0.35));
  el.remove();
}
