// TELA CHEIA, ORIENTAÇÃO E REDIMENSIONAMENTO
//
// Três problemas de celular que só existem fora do desktop, resolvidos aqui
// pra não ficarem espalhados pelo main.js:
//
// 1. A ALTURA DA JANELA MUDA SOZINHA. A barra de endereço do navegador
//    móvel recolhe quando o dedo desliza e volta quando para. Cada uma
//    dessas mudanças é um `resize`, e o canvas precisa acompanhar — senão o
//    jogo fica com uma faixa esticada ou cortada até a próxima rotação.
//    `visualViewport` avisa disso melhor que `window.resize`, e os dois são
//    ouvidos.
//
// 2. REDIMENSIONAR CUSTA CARO. Trocar `canvas.width` joga fora o buffer e o
//    estado do contexto. Durante um arrasto isso dispara dezenas de vezes por
//    segundo, então o ajuste é agendado pro próximo quadro em vez de rodar em
//    cada evento.
//
// 3. TELA CHEIA E ORIENTAÇÃO SÓ PODEM SER PEDIDAS COM O DEDO DO JOGADOR NA
//    TELA. Navegador nenhum concede as duas fora de um gesto — e travar
//    orientação exige estar em tela cheia primeiro. Por isso o pedido é
//    pendurado no primeiro toque de verdade (o botão que começa o jogo), e
//    não no carregamento.
//
// Nada aqui é obrigatório pro jogo funcionar: cada função falha em silêncio
// em navegador que não suporta (desktop, iOS Safari na trava de orientação),
// e o jogo continua igual.

let agendado = null;

// Ajusta o canvas ao tamanho real da viewport, no máximo uma vez por quadro.
// `aoAjustar` é chamado só quando alguma coisa realmente mudou.
export function agendarAjuste(renderer, aoAjustar) {
  if (agendado) return;
  agendado = requestAnimationFrame(() => {
    agendado = null;
    if (!renderer) return;
    const mudou = renderer.redimensionar();
    renderer.recuoTopoCss = recuoSuperior();
    // Onde termina a área livre no rodapé: acima da barra de navegação e dos
    // controles de toque. É onde a dica de interação é desenhada no celular.
    renderer.recuoRodapeCss = recuoInferiorControles();
    if (mudou && typeof aoAjustar === "function") aoAjustar();
  });
}

// Altura da área "proibida" no topo (entalhe/câmera/barra de status). Lida do
// CSS em vez de chutada, então acompanha o aparelho.
export function recuoSuperior() {
  try {
    const valor = getComputedStyle(document.documentElement).getPropertyValue("--hda-safe-top");
    const n = parseFloat(valor);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

// Quanto do rodapé está ocupado por barra de navegação + controles de toque.
// Lido do CSS (o mesmo token que posiciona os controles), então muda junto
// com eles em vez de virar um número mágico repetido em dois lugares.
export function recuoInferiorControles() {
  try {
    const raiz = getComputedStyle(document.documentElement);
    const navbar = parseFloat(raiz.getPropertyValue("--hda-navbar-alt")) || 58;
    const seguro = parseFloat(raiz.getPropertyValue("--hda-safe-bottom")) || 0;
    // O direcional tem no máximo 200px; a faixa livre fica logo acima dele.
    const dpad = document.getElementById("touch-dpad");
    const altoDpad = dpad && dpad.offsetParent ? dpad.getBoundingClientRect().height : 0;
    return navbar + seguro + altoDpad + 22;
  } catch (e) {
    return 96;
  }
}

export function ligarAjusteDeViewport(renderer, aoAjustar) {
  const ajustar = () => agendarAjuste(renderer, aoAjustar);
  window.addEventListener("resize", ajustar);
  window.addEventListener("orientationchange", () => setTimeout(ajustar, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", ajustar);
    window.visualViewport.addEventListener("scroll", ajustar);
  }
  document.addEventListener("fullscreenchange", () => setTimeout(ajustar, 60));
  ajustar();
  return ajustar;
}

// --- Tela cheia ------------------------------------------------------------
export function emTelaCheia() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function suportaTelaCheia() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export async function entrarTelaCheia() {
  const el = document.documentElement;
  const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!pedir) return false;
  try {
    await pedir.call(el, { navigationUI: "hide" });
    return true;
  } catch (e) {
    return false;
  }
}

export async function sairTelaCheia() {
  const sair = document.exitFullscreen || document.webkitExitFullscreen;
  if (!sair) return false;
  try {
    await sair.call(document);
    return true;
  } catch (e) {
    return false;
  }
}

export async function alternarTelaCheia() {
  if (emTelaCheia()) { await sairTelaCheia(); return false; }
  const ok = await entrarTelaCheia();
  if (ok) await travarRetrato();
  return ok;
}

// --- Orientação ------------------------------------------------------------
// Retrato é a orientação PRINCIPAL do jogo: o mundo é enquadrado pra ela (ver
// TILES_NO_LADO_MENOR no Renderer) e os controles ficam onde o polegar
// alcança. A trava só funciona em tela cheia e só em navegador que a
// implementa (Chrome/Android). Em quem não implementa — iOS, por exemplo — o
// jogo continua jogável deitado; a diferença é que ali é o jogador que
// escolhe, não o jogo.
export async function travarRetrato() {
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("portrait");
      return true;
    }
  } catch (e) { /* navegador recusou; segue em frente */ }
  return false;
}

export function ehTelaDeToque() {
  return window.matchMedia("(pointer: coarse)").matches;
}

// Pendura o pedido de tela cheia no PRIMEIRO gesto real do jogador. Só em
// tela de toque: no desktop entrar em tela cheia sem pedir é invasivo — lá o
// jogo já ocupa a janela inteira, e existe o botão em Acessibilidade.
export function pedirTelaCheiaNoPrimeiroGesto(elementos) {
  if (!ehTelaDeToque() || !suportaTelaCheia()) return;
  const uma = async () => {
    elementos.forEach((el) => el && el.removeEventListener("click", uma));
    if (emTelaCheia()) return;
    const ok = await entrarTelaCheia();
    if (ok) await travarRetrato();
  };
  elementos.forEach((el) => el && el.addEventListener("click", uma));
}
