// A TELA DOS CARTÕES DE DECISÃO. As regras estão em CartaoSystem.js; aqui é
// só o desenho e o ritmo.
//
// DUAS POSIÇÕES, e o motivo da diferença:
//
//  • CANTO (superior direito, abaixo da faixa de status) — para tudo que é
//    sugestão: item melhor, dá para forjar, poção nova. O jogador continua
//    jogando; o cartão espera, e some sozinho para o sino do HUD se ele não
//    responder. Um pop-up central a cada item bom dropado seria insuportável
//    numa masmorra.
//
//  • CENTRO — só para subir de nível. Ali o jogador QUER parar: é o momento de
//    recompensa do loop inteiro, e interromper é o ponto.
//
// O SINO. Cartão que expira não some do mundo: vai para uma fila com contador,
// no canto. É o que permite o cartão ser discreto sem a informação se perder —
// a alternativa (ficar na tela até clicarem) é o que transforma sugestão em
// estorvo.
import { duracaoAnimacao, sleep } from "./DiceAnimation.js";
import { efeitosReduzidos } from "../systems/AccessibilitySystem.js";
import {
  proximoCartao, removerCartao, registrarRecusa, silenciarParaSempre,
  tamanhoDaFila, aoMudarFila, cartoesNaFila,
} from "../systems/CartaoSystem.js";

const ID_PILHA = "cartoes-pilha";
const ID_SINO = "cartoes-sino";
const SEGUNDOS_NA_TELA = 11000;

let contexto = null;      // { personagem, dados, onAcao }
let mostrando = null;     // chave do cartão na tela
let timerSaida = null;

export function iniciarCartoes({ personagem, dados, onAcao }) {
  contexto = { personagem, dados, onAcao };
  garantirCasca();
  aoMudarFila(() => { atualizarSino(); if (!mostrando) mostrarProximo(); });
  atualizarSino();
  mostrarProximo();
}

export function pararCartoes() {
  contexto = null; mostrando = null;
  clearTimeout(timerSaida);
  document.getElementById(ID_PILHA)?.remove();
  document.getElementById(ID_SINO)?.remove();
}

function garantirCasca() {
  const app = document.getElementById("app");
  if (!document.getElementById(ID_PILHA)) {
    const pilha = document.createElement("div");
    pilha.id = ID_PILHA;
    pilha.className = "cartoes-pilha";
    app.appendChild(pilha);
  }
  if (!document.getElementById(ID_SINO)) {
    const sino = document.createElement("button");
    sino.id = ID_SINO;
    sino.type = "button";
    sino.className = "cartoes-sino hidden";
    sino.title = "Sugestões pendentes";
    sino.innerHTML = `<span class="cartoes-sino-icone">💡</span><span class="cartoes-sino-n"></span>`;
    sino.onclick = () => { mostrarProximo(true); };
    app.appendChild(sino);
  }
}

function atualizarSino() {
  const sino = document.getElementById(ID_SINO);
  if (!sino) return;
  const n = tamanhoDaFila() - (mostrando ? 1 : 0);
  sino.classList.toggle("hidden", n <= 0);
  sino.querySelector(".cartoes-sino-n").textContent = n > 0 ? String(n) : "";
}

// --- Exibição --------------------------------------------------------------

// PAUSA DURANTE A BATALHA.
//
// Este era o pior caso de sobreposição do jogo. O cartão mora no canto
// superior direito — exatamente onde ficam os cards dos inimigos — e a
// primeira tentativa de conserto (checar se a tela de batalha está visível
// dentro de `mostrarProximo`) só impedia cartões NOVOS: um cartão que já
// estivesse aberto quando a luta começou continuava lá, tapando o bicho que
// o jogador estava tentando escolher. Medido com a batalha rodando: três
// capturas em oito com o cartão por cima.
//
// Então a pausa é explícita e retroativa — esconde o que está na tela e
// segura o que vier. Fora isso, a decisão que o cartão propõe (trocar de
// arma, gastar ponto de talento) não é nem possível dentro do combate.
let pausado = false;

export function pausarCartoes() {
  pausado = true;
  const pilha = document.getElementById(ID_PILHA);
  if (pilha) pilha.classList.add("cartoes-pausados");
  const sino = document.getElementById(ID_SINO);
  if (sino) sino.classList.add("hidden");
}

export function retomarCartoes() {
  pausado = false;
  const pilha = document.getElementById(ID_PILHA);
  if (pilha) pilha.classList.remove("cartoes-pausados");
  // O cartão que estava aberto foi só escondido, não descartado: se ainda é
  // o da vez, ele reaparece; senão, entra o próximo da fila.
  if (mostrando) { atualizarSino(); return; }
  mostrarProximo();
}

export function mostrarProximo(forcar = false) {
  if (!contexto) return;
  if (mostrando && !forcar) return;
  const cartao = proximoCartao();
  if (!cartao) { atualizarSino(); return; }
  // Cartão nunca compete com uma cena de tela cheia nem com um modal — essas
  // já pediram a atenção inteira do jogador.
  if (document.getElementById("cutscene-camada")) return;
  // NEM COM A BATALHA. Este era o pior caso de sobreposição do jogo: o cartão
  // mora no canto superior direito, que é exatamente onde ficam os cards dos
  // inimigos, e ele aparecia no meio do turno — tapando o bicho que o jogador
  // estava tentando escolher. Fora isso, a decisão que ele propõe (trocar de
  // arma, gastar um ponto de talento) não é nem sequer possível dentro do
  // combate. O cartão fica na fila, o sino acende, e ele aparece ao fim da
  // luta — quando o jogador pode de fato agir sobre a sugestão.
  if (pausado) { atualizarSino(); return; }
  desenhar(cartao);
}

function desenhar(cartao) {
  garantirCasca();
  const pilha = document.getElementById(ID_PILHA);
  pilha.innerHTML = "";
  mostrando = cartao.chave;

  const el = document.createElement("div");
  el.className = `cartao cartao-${cartao.tipo}${cartao.central ? " cartao-central" : ""}`;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", cartao.titulo || "Sugestão");

  el.innerHTML = `
    <div class="cartao-cab">
      <span class="cartao-icone">${cartao.icone || "💡"}</span>
      <span class="cartao-titulo">${cartao.titulo || ""}</span>
      <button type="button" class="cartao-fechar" aria-label="Dispensar">×</button>
    </div>
    <div class="cartao-corpo"></div>
    <div class="cartao-acoes"></div>`;

  const corpo = el.querySelector(".cartao-corpo");
  if (cartao.texto) {
    const p = document.createElement("p");
    p.className = "cartao-texto";
    p.textContent = cartao.texto;
    corpo.appendChild(p);
  }
  if (cartao.comparacao) corpo.appendChild(montarComparacao(cartao.comparacao, cartao.nomes));
  if (cartao.resumo) {
    const r = document.createElement("div");
    r.className = "cartao-resumo";
    r.innerHTML = `<span>${cartao.resumo.rotulo}</span>
      <b>${cartao.resumo.de} → ${cartao.resumo.para}</b>
      <span class="cartao-delta ${cartao.resumo.delta >= 0 ? "sobe" : "desce"}">${cartao.resumo.delta >= 0 ? "▲" : "▼"} ${cartao.resumo.texto}</span>`;
    corpo.appendChild(r);
  }
  (cartao.avisos || []).forEach((a) => {
    const w = document.createElement("p");
    w.className = "cartao-aviso";
    w.textContent = `⚠ ${a}`;
    corpo.appendChild(w);
  });

  const acoes = el.querySelector(".cartao-acoes");
  (cartao.acoes || []).forEach((acao, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === 0 ? "primario" : "";
    b.textContent = acao.rotulo;
    b.onclick = () => {
      // O callback pode devolver texto para confirmar o que aconteceu — é o
      // que fecha o ciclo "eu cliquei, e daí?".
      const retorno = acao.aoClicar ? acao.aoClicar() : null;
      fechar(cartao, { aceito: true, retorno });
    };
    acoes.appendChild(b);
  });

  const agoraNao = document.createElement("button");
  agoraNao.type = "button";
  agoraNao.className = "cartao-depois";
  agoraNao.textContent = cartao.rotuloRecusa || "Agora não";
  agoraNao.onclick = () => { registrarRecusa(contexto.personagem, cartao.chave); fechar(cartao, { aceito: false }); };
  acoes.appendChild(agoraNao);

  el.querySelector(".cartao-fechar").onclick = () => {
    silenciarParaSempre(contexto.personagem, cartao.chave);
    fechar(cartao, { aceito: false, silenciado: true });
  };

  pilha.appendChild(el);
  requestAnimationFrame(() => el.classList.add("visivel"));
  atualizarSino();

  // Cartão central espera decisão; cartão de canto se retira sozinho.
  clearTimeout(timerSaida);
  if (!cartao.central && !cartao.fixo) {
    timerSaida = setTimeout(() => {
      // Sair por tempo NÃO conta como recusa: o assunto continua na fila, e o
      // sino passa a mostrá-lo. Tratar silêncio como "não" seria decidir pelo
      // jogador.
      mostrando = null;
      const cur = document.querySelector(".cartao");
      if (cur) { cur.classList.remove("visivel"); setTimeout(() => cur.remove(), 260); }
      atualizarSino();
    }, SEGUNDOS_NA_TELA);
  }
}

function fechar(cartao, { aceito, retorno, silenciado } = {}) {
  clearTimeout(timerSaida);
  removerCartao(cartao.chave);
  mostrando = null;
  const el = document.querySelector(".cartao");
  if (el) {
    el.classList.remove("visivel");
    el.classList.add(aceito ? "aceito" : "recusado");
    setTimeout(() => el.remove(), efeitosReduzidos() ? 0 : 260);
  }
  atualizarSino();
  if (contexto && contexto.onAcao) contexto.onAcao({ cartao, aceito, retorno, silenciado });
  // Dá um respiro antes do próximo: dois cartões em sequência imediata leem
  // como um só piscando.
  setTimeout(() => mostrarProximo(), efeitosReduzidos() ? 0 : 420);
}

// --- Tabela de comparação --------------------------------------------------

function montarComparacao({ linhas, avisos }, nomes = {}) {
  const tabela = document.createElement("div");
  tabela.className = "cartao-comparacao";
  tabela.innerHTML = `
    <div class="cartao-col-cab">
      <span class="cartao-col-atual">${nomes.atual || "Atual"}</span>
      <span class="cartao-seta">→</span>
      <span class="cartao-col-novo">${nomes.novo || "Novo"}</span>
    </div>`;

  linhas.forEach((l) => {
    const linha = document.createElement("div");
    linha.className = "cartao-linha";
    const classe = l.delta > 0 ? "sobe" : l.delta < 0 ? "desce" : "igual";
    const seta = l.delta > 0 ? "▲" : l.delta < 0 ? "▼" : "=";
    const sinal = l.delta > 0 ? "+" : "";
    linha.innerHTML = `
      <span class="cartao-rot">${l.rotulo}</span>
      <span class="cartao-de">${l.de || "—"}${l.de && l.sufixo ? l.sufixo : ""}</span>
      <span class="cartao-para">${l.para || "—"}${l.para && l.sufixo ? l.sufixo : ""}</span>
      <span class="cartao-dif ${classe}">${l.delta ? `${seta} ${sinal}${l.delta}${l.sufixo}` : "="}</span>`;
    tabela.appendChild(linha);
  });

  return tabela;
}

// --- Animação de subir de nível --------------------------------------------

// Três camadas, todas opcionais e todas escaladas pelo multiplicador de
// Acessibilidade: a faixa de XP estourando (no HUD), a coluna de luz (no
// mundo) e o letreiro. Com `efeitosReduzidos()` ligado, o letreiro aparece
// sem movimento — a informação nunca depende da animação.
export async function animarSubirDeNivel(nivel, { onFim } = {}) {
  const app = document.getElementById("app");
  if (!app) { if (onFim) onFim(); return; }

  const hud = document.getElementById("hud-topo");
  if (hud) {
    hud.classList.add("subiu-nivel");
    setTimeout(() => hud.classList.remove("subiu-nivel"), duracaoAnimacao(1400));
  }

  const camada = document.createElement("div");
  camada.className = "nivel-camada";
  camada.innerHTML = `
    <div class="nivel-raio"></div>
    <div class="nivel-texto">
      <span class="nivel-rotulo">NÍVEL</span>
      <span class="nivel-numero">${nivel}</span>
    </div>
    <div class="nivel-particulas">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>`;
  app.appendChild(camada);

  requestAnimationFrame(() => camada.classList.add("visivel"));
  await sleep(efeitosReduzidos() ? 900 : duracaoAnimacao(1700));
  camada.classList.remove("visivel");
  await sleep(efeitosReduzidos() ? 0 : duracaoAnimacao(320));
  camada.remove();
  if (onFim) onFim();
}

// CELEBRAR O NÍVEL. Vive aqui, e não em main.js, por um motivo de dependência:
// quem sobe de nível é BattleUI (fim de batalha) e GameUI (entrega de missão),
// e nenhum dos dois pode importar main.js sem criar um ciclo. Este módulo os
// dois já importam.
//
// main.js registra o que fazer DEPOIS da animação (verificar os gatilhos de
// habilidade destravada) via `registrarAoSubirNivel`; se ninguém registrar, a
// animação roda sozinha e nada quebra.
let aoSubirNivel = null;
export function registrarAoSubirNivel(fn) { aoSubirNivel = fn; }

export async function celebrarNivel(novoNivel, nivelAnterior) {
  await animarSubirDeNivel(novoNivel);
  if (aoSubirNivel) aoSubirNivel(novoNivel, nivelAnterior);
}

export const temCartaoNaTela = () => !!mostrando;
export const pendentes = () => cartoesNaFila();
