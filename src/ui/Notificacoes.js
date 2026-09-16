// NOTIFICAÇÕES — a fila de avisos do jogo.
//
// O QUE HAVIA ANTES
// -----------------
// Uma única `<div id="mensagem-topo">`. `mostrarMensagem()` escrevia o texto
// nela e agendava um timeout para escondê-la. Consequência direta: a segunda
// mensagem APAGAVA a primeira. No modo automático — que ganha ouro, sobe de
// nível, usa poção e acha item em quadros seguidos — o jogador via um borrão
// de textos se sobrescrevendo e não lia nenhum. E, como tudo saía com a mesma
// moldura marrom, "você subiu de nível" e "não dá para descansar aqui" tinham
// exatamente o mesmo peso visual.
//
// O QUE ESTE MÓDULO FAZ
// ---------------------
//   • EMPILHA em vez de sobrescrever (até MAX_PILHA de cada vez);
//   • dá TIPO a cada aviso — ganho, sucesso, aviso, erro, info — e cada tipo
//     tem cor, ícone e borda próprios, então dá para saber o que é antes de
//     ler;
//   • junta repetições: "+3 ouro" três vezes vira "+3 ouro ×3", em vez de
//     três cartões iguais empilhados;
//   • mostra o tempo restante numa barrinha, para o aviso não sumir "do nada";
//   • deixa fechar no clique.
//
// COMPATIBILIDADE: `mostrarMensagem(texto, ms)` continua existindo e com a
// mesma assinatura (GameUI.js re-exporta daqui). Dezenas de chamadas antigas
// seguem funcionando — elas caem no tipo "info" e ganham o visual novo de
// graça, sem precisar tocar em nenhuma delas.
import { multiplicadorVelocidadeMensagem } from "../systems/AccessibilitySystem.js";

export const MAX_PILHA = 4;

// Cada tipo é uma leitura diferente do mesmo canal. O ícone padrão só entra
// quando quem chamou não mandou um — mensagens antigas já começam com emoji
// no texto, e duas carinhas seguidas ficariam ridículas.
const TIPOS = {
  ganho: { classe: "n-ganho", icone: "✨" },
  sucesso: { classe: "n-sucesso", icone: "✅" },
  aviso: { classe: "n-aviso", icone: "⚠️" },
  erro: { classe: "n-erro", icone: "🚫" },
  info: { classe: "n-info", icone: "" },
};

let pilhaEl = null;
const vivos = [];

function garantirPilha() {
  if (pilhaEl && document.body.contains(pilhaEl)) return pilhaEl;
  pilhaEl = document.getElementById("hda-notificacoes");
  if (!pilhaEl) {
    pilhaEl = document.createElement("div");
    pilhaEl.id = "hda-notificacoes";
    // Região viva para leitores de tela: quem não vê a tela também recebe
    // o aviso, sem precisar procurar por ele.
    pilhaEl.setAttribute("role", "status");
    pilhaEl.setAttribute("aria-live", "polite");
    const jogo = document.getElementById("screen-jogo") || document.body;
    jogo.appendChild(pilhaEl);
  }
  return pilhaEl;
}

function remover(n) {
  const i = vivos.indexOf(n);
  if (i >= 0) vivos.splice(i, 1);
  if (!n.el || !n.el.parentNode) return;
  n.el.classList.add("saindo");
  // Espera a transição de saída antes de tirar do DOM; se o jogador tiver
  // pedido menos movimento, sai na hora.
  const semMovimento = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => { if (n.el.parentNode) n.el.remove(); }, semMovimento ? 0 : 200);
}

// O aviso propriamente dito.
//
// `texto` pode vir com emoji na frente (é como as chamadas antigas escrevem).
// Nesse caso o emoji do TIPO não é adicionado, para não duplicar.
export function notificar(texto, opcoes = {}) {
  if (!texto) return null;
  const { tipo = "info", duracaoMs = 2600, titulo = "" } = opcoes;
  const def = TIPOS[tipo] || TIPOS.info;
  const pilha = garantirPilha();

  // --- junta repetição --------------------------------------------------
  // Mesmo texto ainda na tela? Soma no contador em vez de empilhar de novo.
  // É o caso do automático catando três moedas seguidas.
  const igual = vivos.find((n) => n.texto === texto && n.tipo === tipo);
  if (igual) {
    igual.vezes += 1;
    const marca = igual.el.querySelector(".n-vezes");
    if (marca) { marca.textContent = `×${igual.vezes}`; marca.hidden = false; }
    igual.el.classList.remove("pulsa");
    // Reinicia a animação de pulso: sem isto, a repetição não dá sinal
    // nenhum de que algo novo aconteceu.
    void igual.el.offsetWidth;
    igual.el.classList.add("pulsa");
    reiniciarRelogio(igual, duracaoMs);
    return igual;
  }

  // --- estoura o topo da pilha ------------------------------------------
  while (vivos.length >= MAX_PILHA) remover(vivos[0]);

  const el = document.createElement("div");
  el.className = `hda-notif ${def.classe}`;
  const emojiJaNoTexto = /^\s*[\p{Extended_Pictographic}]/u.test(texto);
  const icone = opcoes.icone || (emojiJaNoTexto ? "" : def.icone);
  el.innerHTML = `
    ${icone ? `<span class="n-icone" aria-hidden="true">${icone}</span>` : ""}
    <span class="n-corpo">
      ${titulo ? `<b class="n-titulo">${titulo}</b>` : ""}
      <span class="n-texto">${texto}</span>
    </span>
    <span class="n-vezes" hidden></span>
    <span class="n-tempo"><i></i></span>`;
  el.onclick = () => remover(n);

  const n = { el, texto, tipo, vezes: 1, timer: null };
  pilha.appendChild(el);
  vivos.push(n);
  // Deixa o navegador pintar antes de ligar a transição de entrada.
  requestAnimationFrame(() => el.classList.add("entrou"));
  reiniciarRelogio(n, duracaoMs);
  return n;
}

// O relógio de vida do aviso. A barrinha é animação pura de CSS (transform),
// então não custa layout nem trabalho por quadro.
function reiniciarRelogio(n, duracaoMs) {
  clearTimeout(n.timer);
  // Velocidade de mensagem é preferência do jogador (Acessibilidade), não
  // do jogo — o mesmo multiplicador que o sistema antigo já respeitava.
  const total = Math.round(duracaoMs * multiplicadorVelocidadeMensagem());
  const barra = n.el.querySelector(".n-tempo i");
  if (barra) {
    barra.style.transition = "none";
    barra.style.transform = "scaleX(1)";
    void barra.offsetWidth;
    barra.style.transition = `transform ${total}ms linear`;
    barra.style.transform = "scaleX(0)";
  }
  n.timer = setTimeout(() => remover(n), total);
}

// Atalhos, para quem chama não precisar lembrar do nome do tipo.
export const notificarGanho = (t, o = {}) => notificar(t, { ...o, tipo: "ganho" });
export const notificarSucesso = (t, o = {}) => notificar(t, { ...o, tipo: "sucesso" });
export const notificarAviso = (t, o = {}) => notificar(t, { ...o, tipo: "aviso" });
export const notificarErro = (t, o = {}) => notificar(t, { ...o, tipo: "erro" });

// Classificação automática para as chamadas ANTIGAS.
//
// São dezenas de `mostrarMensagem("🚫 ...")` espalhadas pelo jogo. Reescrever
// todas seria muito risco por pouco ganho; ler o emoji que elas já usam
// entrega o mesmo resultado sem tocar em nenhuma. Quem quiser precisão passa
// o tipo explicitamente.
const PISTAS = [
  { re: /^[\s]*(🚫|❌|⛔|💀)/u, tipo: "erro" },
  { re: /^[\s]*(⚠️|⏸|⏳)/u, tipo: "aviso" },
  { re: /^[\s]*(✅|✔️|💤|🛡️)/u, tipo: "sucesso" },
  { re: /^[\s]*(✨|🎉|🪙|💠|⭐|🏆|📦|🧪)/u, tipo: "ganho" },
];

export function tipoPeloTexto(texto) {
  const achou = PISTAS.find((p) => p.re.test(texto || ""));
  return achou ? achou.tipo : "info";
}

// Substituta de `mostrarMensagem`. Mesma assinatura de sempre.
export function mostrarMensagem(texto, duracaoMs = 2200, opcoes = {}) {
  return notificar(texto, { tipo: tipoPeloTexto(texto), duracaoMs, ...opcoes });
}

// Usado ao trocar de tela (batalha começando, jogo recarregando): avisos do
// contexto anterior não devem sobrar por cima do novo.
export function limparNotificacoes() {
  [...vivos].forEach(remover);
}
