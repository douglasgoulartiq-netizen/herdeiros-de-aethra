// RESOLVEDOR DE IMAGEM — a cadeia de fallback em funcionamento.
//
// O assetRegistry diz QUAIS arquivos servem, em ordem. Este módulo faz a
// lista virar uma imagem na tela: tenta o primeiro, e quando ele não
// existe passa pro próximo sozinho, sem piscar erro pro jogador.
//
// POR QUE NÃO BASTA UM onerror SOLTO
// ----------------------------------
// Um `onerror` inline resolve UM fallback. A cadeia tem três ou quatro
// degraus, e a coleção do gacha redesenha a cada rolagem — sem memória,
// o navegador repete o mesmo 404 dezenas de vezes por minuto, e cada 404
// é uma ida à rede. Por isso existe aqui:
//
//   1. uma lista de degraus, não um degrau só;
//   2. memória do que já faltou, pra nunca pedir duas vezes;
//   3. um placeholder desenhado quando a lista acaba — nunca o ícone de
//      imagem quebrada, que é o pior resultado possível numa tela de RPG.
//
// A memória vive no módulo (dura a sessão) porque é exatamente esse o
// tempo de vida do fato: o arquivo não vai aparecer no servidor no meio
// da partida. Recarregar a página zera, que é o comportamento certo
// depois de instalar a arte nova.
import { candidatos, USOS } from "../data/assetRegistry.js";

// URLs que já responderam 404 nesta sessão. Set de string, some no reload.
const faltando = new Set();
// URLs já confirmadas como boas — evita reprocessar a cadeia inteira.
const existem = new Set();

// Zera a memória. Existe para os testes conseguirem medir a cadeia mais de
// uma vez no mesmo carregamento sem herdar o resultado da medição anterior.
export function limparMemoriaDeAssets() {
  faltando.clear();
  existem.clear();
}

// Só para diagnóstico: o que faltou até agora. Um número alto aqui depois
// de instalar a arte nova é o sintoma de zip incompleto ou nome errado.
export function relatorioDeAssets() {
  return { faltando: [...faltando], existem: existem.size };
}

// Descarta candidatos que já sabemos que não existem. É a diferença entre
// pedir 4 arquivos por retrato e pedir 1.
function candidatosVivos(alvo, uso, opcoes) {
  return candidatos(alvo, uso, opcoes).filter((u) => !faltando.has(u));
}

// Aplica a cadeia num <img> que já está no DOM.
//
// Cada erro marca a URL como ausente e tenta a próxima. Quando acaba, a
// imagem some e quem cuida do visual é o elemento de placeholder que o
// chamador passar (ou nada, e aí fica o fundo da moldura).
export function aplicarCadeia(img, alvo, uso = USOS.COMBATE, opcoes = {}) {
  if (!img) return null;
  const fila = candidatosVivos(alvo, uso, opcoes);
  const placeholder = opcoes.placeholder || img.nextElementSibling;

  const desistir = () => {
    img.style.display = "none";
    if (placeholder && placeholder.classList
      && placeholder.classList.contains("asset-vazio")) placeholder.style.display = "flex";
    if (typeof opcoes.aoFalhar === "function") opcoes.aoFalhar();
  };

  let i = 0;
  const tentar = () => {
    if (i >= fila.length) { desistir(); return; }
    const url = fila[i];
    i += 1;
    img.onerror = () => { faltando.add(url); tentar(); };
    img.onload = () => {
      existem.add(url);
      img.onerror = null;
      if (placeholder && placeholder.classList
        && placeholder.classList.contains("asset-vazio")) placeholder.style.display = "none";
      if (typeof opcoes.aoCarregar === "function") opcoes.aoCarregar(url);
    };
    img.src = url;
  };

  if (fila.length === 0) { desistir(); return null; }
  tentar();
  return fila[0];
}

// Versão para as telas que montam HTML como texto (a maioria delas).
//
// Não dá pra registrar listener num elemento que ainda não existe, então a
// cadeia inteira viaja no atributo data-cadeia e é ligada depois, quando o
// HTML já está no documento — ver `ligarCadeias`. O primeiro degrau já vai
// no src pra imagem começar a carregar junto com o resto da tela, sem
// esperar o JavaScript.
export function imgHtml(alvo, uso = USOS.COMBATE, opcoes = {}) {
  const fila = candidatosVivos(alvo, uso, opcoes);
  if (fila.length === 0) return "";
  const attrs = [
    `src="${fila[0]}"`,
    `data-cadeia="${fila.join("|")}"`,
    `alt="${(opcoes.alt || "").replace(/"/g, "&quot;")}"`,
    opcoes.lazy === false ? "" : 'loading="lazy"',
    'decoding="async"',
    opcoes.classe ? `class="${opcoes.classe}"` : "",
  ].filter(Boolean).join(" ");
  return `<img ${attrs}>`;
}

// Liga a cadeia em tudo que `imgHtml` produziu dentro de um pedaço da tela.
// Chame uma vez depois de escrever o innerHTML. É idempotente: uma imagem
// já ligada é ignorada, então chamar de novo depois de um render parcial
// não duplica listener.
export function ligarCadeias(raiz) {
  if (!raiz) return 0;
  const alvos = raiz.querySelectorAll("img[data-cadeia]:not([data-cadeia-ligada])");
  alvos.forEach((img) => {
    img.setAttribute("data-cadeia-ligada", "1");
    const fila = (img.getAttribute("data-cadeia") || "").split("|").filter(Boolean);
    const vizinho = img.nextElementSibling;
    let i = fila.indexOf(img.getAttribute("src")) + 1;

    const esconderVazio = () => {
      if (vizinho && vizinho.classList && vizinho.classList.contains("asset-vazio")) {
        vizinho.style.display = "none";
      }
    };
    const mostrarVazio = () => {
      if (vizinho && vizinho.classList && vizinho.classList.contains("asset-vazio")) {
        vizinho.style.display = "flex";
      }
    };

    // Se a imagem já carregou antes do JS rodar (cache), não há o que ligar.
    if (img.complete && img.naturalWidth > 0) {
      existem.add(img.getAttribute("src"));
      esconderVazio();
      return;
    }

    img.onload = () => { existem.add(img.getAttribute("src")); esconderVazio(); };
    img.onerror = () => {
      faltando.add(img.getAttribute("src"));
      if (i < fila.length) { img.src = fila[i]; i += 1; return; }
      img.onerror = null;
      img.style.display = "none";
      mostrarVazio();
    };
  });
  return alvos.length;
}

// Pré-carrega o melhor candidato de uma lista de alvos. Serve pra tela de
// batalha: pedir os sprites dos inimigos ANTES do primeiro quadro evita o
// slot aparecer vazio e "encher" no meio da animação de entrada — que é
// justamente o tipo de tremor que a medição de layout proíbe.
export function precarregar(alvos, uso = USOS.COMBATE, opcoes = {}) {
  if (typeof Image === "undefined") return Promise.resolve(0);
  const urls = [...new Set(alvos.flatMap((a) => candidatosVivos(a, uso, opcoes).slice(0, 1)))];
  return Promise.all(urls.map((url) => new Promise((resolve) => {
    if (existem.has(url)) { resolve(true); return; }
    const img = new Image();
    img.onload = () => { existem.add(url); resolve(true); };
    img.onerror = () => { faltando.add(url); resolve(false); };
    img.src = url;
  }))).then((r) => r.filter(Boolean).length);
}
