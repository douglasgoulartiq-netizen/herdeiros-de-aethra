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
export async function animarDado(container, resultado, { critico = false, fumble = false, duracaoTotalMs = 1000, manter = false } = {}) {
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
  // `manter` existe para a rolagem fora de combate: lá a conta aparece
  // DEPOIS do dado parar, e tirar o dado nesse momento deixava um buraco no
  // meio da caixa — a captura de tela mostrou. Na batalha o dado continua
  // saindo, porque lá ele fica por cima da arena.
  if (!manter) el.remove();
  return el;
}

// ---------------------------------------------------------------------------
// ROLAGEM VISÍVEL FORA DE COMBATE
// ---------------------------------------------------------------------------
// O pedido do jogador: "mostra o d20 rodando na tela para conseguir as
// coisas". Na batalha isso já acontecia (BattleUI chama animarDado a cada
// golpe). Fora dela, NÃO: um evento de exploração rolava o dado em silêncio e
// despejava o resultado num aviso de texto — `[d20: 14 +2 atributo = 16 vs.
// DC 12]`. O número aparecia depois de decidido, sem nenhum momento de
// suspense, que é justamente a parte boa de um teste de perícia.
//
// Esta função é a versão autônoma: cria a própria camada por cima de tudo,
// mostra o dado girando, encena o total contra a dificuldade e devolve uma
// Promise que resolve quando o jogador já viu o resultado. Quem chama só
// precisa ter o resultado JÁ decidido pela lógica de jogo — aqui nada é
// sorteado, só encenado.
export async function mostrarRolagemD20(resultado, {
  titulo = "Teste de perícia",
  dificuldade = null,
  modificadores = [],
  duracaoTotalMs = 1000,
} = {}) {
  if (typeof document === "undefined") return;
  const d = resultado && typeof resultado === "object" ? resultado.d : resultado;
  const total = resultado && typeof resultado === "object" ? resultado.total : d;
  const dc = dificuldade != null ? dificuldade
    : (resultado && typeof resultado === "object" ? resultado.dificuldade : null);
  const sucesso = resultado && typeof resultado === "object" && "sucesso" in resultado
    ? resultado.sucesso
    : (dc != null ? total >= dc : null);

  const camada = document.createElement("div");
  camada.className = "rolagem-camada";
  camada.innerHTML = `
    <div class="rolagem-caixa">
      <div class="rolagem-titulo">${titulo}</div>
      <div class="rolagem-palco"></div>
      <div class="rolagem-conta" hidden></div>
    </div>`;
  document.body.appendChild(camada);
  requestAnimationFrame(() => camada.classList.add("visivel"));

  const palco = camada.querySelector(".rolagem-palco");
  // Regra deste jogo (a mesma do combate): 17+ é crítico, 3- é falha total.
  await animarDado(palco, d, { critico: d >= 17, fumble: d <= 3, duracaoTotalMs, manter: true });

  // O dado sai; entra a conta. Mostrar a soma DEPOIS do dado parar é o que
  // transforma um número solto em "o 14 mais o bônus deu para passar".
  const conta = camada.querySelector(".rolagem-conta");
  // Os modificadores JÁ vêm com sinal ("+2 atributo", "-1 cansaço"), então o
  // separador não pode ser outro "+": a primeira versão imprimia
  // "14 + +2 atributo", que a captura de tela pegou. O separador é neutro.
  const partes = [`<b class="rol-d20">${d}</b>`]
    .concat((modificadores || []).filter(Boolean).map((m) => `<span>${m}</span>`));
  conta.innerHTML = `
    <div class="rolagem-soma">${partes.join(' <i aria-hidden="true">·</i> ')} <i>=</i> <b class="rol-total">${total}</b></div>
    ${dc != null ? `<div class="rolagem-alvo">contra dificuldade ${dc}</div>` : ""}
    ${sucesso === null ? "" : `<div class="rolagem-veredito ${sucesso ? "ok" : "falha"}">${sucesso ? "✅ Passou" : "❌ Falhou"}</div>`}`;
  conta.hidden = false;
  requestAnimationFrame(() => conta.classList.add("entrou"));

  await sleep(duracaoAnimacao(1100));
  camada.classList.remove("visivel");
  await sleep(duracaoAnimacao(200));
  camada.remove();
}
