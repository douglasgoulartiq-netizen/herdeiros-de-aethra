// TELA DA ÁRVORE DE HABILIDADES — 3 ramos lado a lado, 6 degraus cada.
//
// O que a tela precisa deixar óbvio, em ordem de importância:
//   1. quantos pontos você tem agora (é a moeda; some do topo e a tela vira
//      um catálogo bonito e inútil);
//   2. por que um nó específico está fechado — e o motivo COMPLETO, não o
//      primeiro obstáculo. "Falta nível 12 e INT 10" numa linha evita o
//      jogador subir dois níveis para descobrir que ainda falta o atributo;
//   3. quanto você já investiu em cada ramo, porque os nós finais exigem 7
//      pontos NO MESMO ramo e essa é a decisão real da tela.
//
// Todo o CSS vive aqui embaixo, injetado uma vez. É a única tela do jogo com
// layout de três colunas e nada mais reusa essas classes — mantê-lo junto do
// componente evita mais um arquivo global que ninguém sabe quem usa.

import {
  arvoreDaClasse, ramosDaClasse, avaliarArvore, escolherNo, resetarArvore,
  pontosTotais, pontosGastos, pontosDisponiveis, pontosNoRamo, custoDoNo,
  custoDeReset, descreverConcessao, garantirEstadoArvore,
} from "../systems/SkillTreeSystem.js";
import { descreverMarca } from "../systems/RecursoClasseSystem.js";
import {
  LIMITE_CARDS, garantirLoadout, habilidadesEquipadas, habilidadesNaReserva,
  alternarCard, moverCard,
} from "../systems/LoadoutSystem.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

const CSS_ID = "css-arvore-habilidades";
const CSS = `
.arv-topo { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;
  background:rgba(0,0,0,0.28); border:1px solid rgba(255,255,255,0.12); border-radius:10px;
  padding:10px 12px; margin-bottom:10px; position:sticky; top:0; z-index:3; backdrop-filter:blur(4px); }
.arv-pontos { font-size:1.15em; font-weight:700; }
.arv-pontos b { color:#f5a524; font-size:1.35em; }
.arv-sub { opacity:0.75; font-size:0.82em; }
.arv-reset { background:#5a2230; border:1px solid #a04456; color:#ffd9e0; border-radius:8px;
  padding:7px 12px; cursor:pointer; font-size:0.85em; }
.arv-reset:disabled { opacity:0.45; cursor:not-allowed; }
/* ÁRVORE EM LADRILHOS — a estrutura da referência, com a nossa densidade.
   Três colunas lado a lado no PC, uma por vez no celular. Cada nó vira um
   ladrilho de ícone grande + nome curto, e o texto longo sai do ladrilho e vai
   para o painel de detalhe: era a descrição inteira dentro de cada nó que
   obrigava o nó a ser um bloco de texto, e o bloco de texto que obrigava a
   coluna a ser larga, e a coluna larga que obrigava a mostrar UM ramo por vez
   até no monitor. Tirando o texto do ladrilho, os três ramos cabem juntos. */
.arv-grade { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); justify-content:center;
  gap:10px; align-items:start; }
.arv-ramo { position:relative; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
  border-radius:12px; padding:10px 8px 12px; min-width:0; overflow:hidden; }
/* Fundo temático por ramo: discreto, atrás dos ladrilhos, nunca competindo
   com eles. A cor é sinal SECUNDÁRIO — o estado de cada nó continua legível
   pela moldura e pelo selo, para quem não distingue as cores. */
/* O fundo tinge a COLUNA INTEIRA, não só o topo.
   MEDIDO em tela: com um gradiente que se apagava no meio, a metade de baixo
   das três colunas ficava do mesmo cinza-azulado e o ramo deixava de ser
   reconhecível justamente onde estão os talentos finais — que são o motivo de
   olhar a coluna. Agora é uma base uniforme mais um brilho no topo. */
.arv-ramo::before { content:""; position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(120% 44% at 50% 0%, rgba(255,255,255,.14) 0%, transparent 70%),
    var(--ramo-cor, rgba(151,111,210,.3)); }
.arv-ramo > * { position:relative; }
.arv-ramo-cab { display:flex; align-items:center; gap:6px; margin-bottom:2px; }
.arv-ramo-icone { font-size:1.15em; }
.arv-ramo-nome { font-weight:700; font-size:1.02em; }
.arv-ramo-inv { margin-left:auto; font-size:0.78em; color:#f5a524; white-space:nowrap; font-variant-numeric:tabular-nums; }
.arv-ramo-desc { font-size:0.76em; opacity:0.72; margin-bottom:10px; line-height:1.3; }

/* Um degrau = uma linha. A linha vertical liga só degraus que de fato dependem
   um do outro, que nesta árvore é toda a corrente (o nó de degrau N exige N-1
   pontos no mesmo ramo). */
.arv-degrau { position:relative; display:flex; justify-content:center; padding-top:16px; }
.arv-degrau:first-of-type { padding-top:2px; }
.arv-degrau:not(:first-of-type)::before { content:""; position:absolute; left:50%; top:0; width:2px; height:16px;
  transform:translateX(-50%); background:rgba(151,111,210,.55); }
.arv-degrau.ligada:not(:first-of-type)::before { background:#4ecb71; }

.arv-no { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px;
  width:100%; max-width:132px; border:0; padding:0; background:none; color:inherit; font:inherit;
  text-align:center; cursor:default; }
.arv-no-quadro { position:relative; display:grid; place-items:center; width:58px; height:58px;
  border:2px solid rgba(255,255,255,0.22); border-radius:12px; background:rgba(6,5,12,.62);
  font-size:26px; line-height:1; box-shadow:inset 0 0 0 1px rgba(0,0,0,.5); }
.arv-no-nome { font-size:.74rem; font-weight:600; line-height:1.2; overflow-wrap:anywhere; }
.arv-no-custo { position:absolute; right:-6px; bottom:-6px; min-width:20px; padding:0 4px; height:18px;
  display:grid; place-items:center; border-radius:999px; font-size:.64rem; font-weight:700;
  background:#1b1728; border:1px solid rgba(255,255,255,.28); font-variant-numeric:tabular-nums; }
/* Selo de estado — o sinal que NÃO depende de cor. */
.arv-no-selo { position:absolute; left:-6px; top:-6px; width:19px; height:19px; display:grid; place-items:center;
  border-radius:999px; font-size:.66rem; background:#1b1728; border:1px solid rgba(255,255,255,.28); }

.arv-no.escolhido .arv-no-quadro { border-color:#4ecb71; background:rgba(78,203,113,.16); }
.arv-no.escolhido .arv-no-selo { border-color:#4ecb71; color:#8ce9a4; }
.arv-no.disponivel { cursor:pointer; }
.arv-no.disponivel .arv-no-quadro { border-color:#f5a524; background:rgba(245,165,36,.14);
  box-shadow:0 0 0 1px rgba(245,165,36,.35), 0 0 14px rgba(245,165,36,.3); }
.arv-no.disponivel:hover .arv-no-quadro { background:rgba(245,165,36,.26); }
.arv-no.bloqueado .arv-no-quadro { border-color:rgba(255,255,255,.18); filter:grayscale(.65); opacity:.62; }
.arv-no.bloqueado .arv-no-nome { opacity:.62; }
/* Pendente = o jogador marcou, mas ainda não aplicou. Precisa se distinguir de
   "adquirido" à primeira vista, senão o botão Aplicar não faz sentido. */
.arv-no.pendente .arv-no-quadro { border-color:#7fd4ff; border-style:dashed;
  background:rgba(127,212,255,.16); box-shadow:0 0 12px rgba(127,212,255,.34); }
.arv-no.pendente .arv-no-selo { border-color:#7fd4ff; color:#bde8ff; }
.arv-no.selecionado .arv-no-quadro { outline:2px solid #fff1a8; outline-offset:3px; }
.arv-no:focus-visible .arv-no-quadro { outline:3px solid #fff1a8; outline-offset:3px; }
/* O nó final do ramo é o objetivo da coluna: maior, e é o único com moldura
   dourada cheia. */
.arv-no.final .arv-no-quadro { width:70px; height:70px; font-size:32px; border-width:3px;
  border-color:#d8b75e; border-radius:16px; }
.arv-no.final .arv-no-nome { font-size:.8rem; font-weight:700; }
@media (prefers-reduced-motion: reduce) { .arv-no .arv-no-quadro { transition:none; } }

/* PAINEL DE DETALHE — fixo, para clicar num talento explicar em vez de gastar.
   Esta é a razão de o ladrilho não ter texto: o texto mora aqui, uma vez só,
   grande o bastante para ler. */
.arv-detalhe { margin-top:12px; border:1px solid rgba(255,255,255,.16); border-radius:12px;
  background:rgba(6,5,12,.55); padding:11px 13px; }
.arv-det-cab { display:flex; align-items:center; gap:9px; }
.arv-det-icone { font-size:26px; }
.arv-det-nome { font-weight:700; font-size:1.02rem; }
.arv-det-tipo { font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; opacity:.7; }
.arv-det-custo { margin-left:auto; font-size:.78rem; border:1px solid rgba(255,255,255,.22);
  border-radius:999px; padding:2px 9px; white-space:nowrap; }
.arv-det-desc { font-size:.85rem; line-height:1.45; margin-top:7px; }
.arv-det-req { font-size:.78rem; margin-top:7px; line-height:1.4; }
.arv-det-req.ok { color:#8ce9a4; }
.arv-det-req.falta { color:#ff9a9a; }
.arv-det-acoes { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
.arv-bt { min-height:40px; padding:6px 14px; border-radius:9px; cursor:pointer; font:inherit;
  font-size:.85rem; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.07); color:inherit; }
.arv-bt.primario { background:linear-gradient(135deg,#6a42a4,#4d2b77); border-color:#b686ff; color:#fff6d8; font-weight:700; }
.arv-bt.confirmar { background:linear-gradient(135deg,#2f7a48,#245c38); border-color:#4ecb71; color:#e8ffef; font-weight:700; }
.arv-bt:disabled { opacity:.4; cursor:not-allowed; }
.arv-bt:focus-visible { outline:3px solid #fff1a8; outline-offset:2px; }
.arv-det-vazio { font-size:.85rem; opacity:.72; line-height:1.45; }
.arv-pendencia { font-size:.8rem; color:#bde8ff; margin-top:8px; }

.arv-legenda { margin-top:10px; font-size:0.78em; opacity:0.72; line-height:1.45; }
.arv-legenda-estados { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; font-size:.76em; }
.arv-legenda-estados span { display:inline-flex; align-items:center; gap:4px; }
/* A fila de ramos ROLA de lado, e esconde 144 px num celular de 320 px
   (medido). Rolar está certo — são muitos ramos e eles não cabem —, mas com
   scrollbar-width:none não sobra pista NENHUMA de que há mais ramos à
   direita. A borda esvanecida abaixo é essa pista, e ela só aparece quando
   existe conteúdo escondido de fato: a classe tem-mais é posta por JS depois
   da montagem e a cada rolagem, porque CSS sozinho não sabe medir transbordo.
   Sem a classe, a fila fica exatamente como era.
   (Este comentário mora DENTRO de um template literal de JS: nada de crase
   aqui, ou o literal fecha no meio e a tela inteira deixa de carregar.) */
.arv-filtros { display:flex; gap:6px; margin:0 0 10px; overflow-x:auto; scrollbar-width:none; position:relative; }
.arv-filtros-caixa { position:relative; }
.arv-filtros-caixa::after {
  content:""; position:absolute; top:0; right:0; bottom:10px; width:34px;
  pointer-events:none; opacity:0; transition:opacity .16s ease;
  background:linear-gradient(90deg, rgba(10,9,18,0) 0%, rgba(10,9,18,.92) 100%);
}
.arv-filtros-caixa.tem-mais::after { opacity:1; }
@media (prefers-reduced-motion: reduce) { .arv-filtros-caixa::after { transition:none; } }
.arv-filtro-ramo { flex:0 0 auto; min-height:42px; padding:7px 12px; border-radius:999px; }
.arv-filtro-ramo.ativo { border-color:#f5a524; background:rgba(245,165,36,.2); color:#fff2cf; }
.arv-filtro-ramo:focus-visible,.arv-aba:focus-visible,.ld-bt:focus-visible { outline:3px solid #fff1a8; outline-offset:2px; }
/* No PC os três ramos ficam juntos — é o ponto da tela: comparar caminhos.
   Abaixo de 900 px eles não cabem lado a lado sem o ladrilho virar miniatura,
   então volta a ser um ramo por vez, escolhido pelos seletores do topo. Não
   espremer três colunas na largura de um celular é decisão, não limitação. */
@media (max-width:899px) {
  .arv-grade { grid-template-columns:1fr; }
  .arv-grade .arv-ramo { display:none; }
  .arv-grade .arv-ramo.ativo { display:block; }
  .arv-topo { top:0; }
  /* Num ramo só a coluna fica larga: o ladrilho cresce em vez de sobrar
     espaço vazio dos dois lados. */
  .arv-no { max-width:none; }
  .arv-no-quadro { width:64px; height:64px; font-size:29px; }
  .arv-no.final .arv-no-quadro { width:76px; height:76px; font-size:35px; }
  .arv-no-nome { font-size:.82rem; }
  /* O detalhe é o que o dedo vai usar: ações grandes e sempre visíveis. */
  .arv-bt { min-height:44px; flex:1 1 auto; }

  /* O CABEÇALHO NÃO PODE COMER A TELA.
     MEDIDO em 390×844: antes desta regra o jogador passava por Fechar, três
     botões de navegação em duas linhas, o título, DUAS abas empilhadas em
     largura cheia e a caixa de pontos com o botão de redistribuir numa linha
     só dele — o primeiro talento começava abaixo da dobra. A árvore é o
     conteúdo da tela; ela precisa aparecer sem rolar. */
  .arv-abas { gap:6px; margin-bottom:6px; }
  .arv-abas button { flex:1 1 0; min-width:0; padding:7px 6px; font-size:.82rem; }
  .arv-topo { flex-wrap:nowrap; align-items:center; gap:8px; padding:8px 10px; margin-bottom:8px; }
  .arv-pontos { font-size:1rem; }
  .arv-pontos b { font-size:1.2em; }
  /* A frase "a árvore inteira custa N" é boa, mas é leitura de uma vez só:
     no celular ela sai do topo e desce para o rodapé explicativo. */
  .arv-topo .arv-sub { display:none; }
  .arv-reset { margin-left:auto; padding:7px 9px; font-size:.76em; white-space:nowrap; }
  .arv-ramo-desc { margin-bottom:8px; }
}
/* Os seletores de ramo só existem quando há um ramo por vez. No PC os três
   títulos já estão na tela, e um seletor duplicado ali é ruído. */
@media (min-width:900px) { .arv-filtros-caixa { display:none; } }

/* --- Abas: Árvore | Cards de batalha --- */
.arv-abas { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }
.arv-aba { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);
  color:inherit; border-radius:8px 8px 0 0; padding:7px 14px; cursor:pointer; font-size:0.9em; }
.arv-aba.ativa { background:rgba(245,165,36,0.18); border-color:#f5a524; font-weight:700; }
.ld-colunas { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; align-items:start; }
.ld-caixa { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
  border-radius:10px; padding:9px; min-width:0; }
.ld-caixa h3 { margin:0 0 3px; font-size:1em; }
.ld-caixa .ld-ajuda { font-size:0.76em; opacity:0.7; margin-bottom:8px; line-height:1.35; }
.ld-slot { border:1px solid rgba(255,255,255,0.12); border-left-width:4px; border-radius:8px;
  padding:7px 9px; margin-bottom:6px; background:rgba(0,0,0,0.22); display:flex; gap:8px; align-items:flex-start; }
.ld-slot.equipada { border-left-color:#4ecb71; background:rgba(78,203,113,0.1); }
.ld-slot.reserva { border-left-color:rgba(255,255,255,0.18); }
.ld-slot.vazio { border-left-color:rgba(255,255,255,0.1); opacity:0.5; font-style:italic; justify-content:center; }
.ld-corpo { flex:1; min-width:0; }
.ld-nome { font-weight:600; font-size:0.92em; overflow-wrap:anywhere; }
.ld-meta { font-size:0.74em; opacity:0.72; margin-top:2px; }
.ld-desc { font-size:0.78em; opacity:0.85; margin-top:3px; line-height:1.35; overflow-wrap:anywhere; }
.ld-bts { display:flex; flex-direction:column; gap:3px; }
.ld-bt { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:inherit;
  border-radius:6px; padding:2px 7px; cursor:pointer; font-size:0.8em; line-height:1.3; }
.ld-bt:hover { background:rgba(255,255,255,0.18); }
.ld-bt:disabled { opacity:0.3; cursor:not-allowed; }
.ld-aviso { font-size:0.8em; color:#ffcf8a; margin-top:6px; min-height:1.2em; }
@media (max-width:900px) { .ld-colunas { grid-template-columns:1fr; } }
`;

function garantirCSS() {
  if (document.getElementById(CSS_ID)) return;
  const el = document.createElement("style");
  el.id = CSS_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function fecharModalLocal() {
  overlay().classList.add("hidden");
  conteudo().innerHTML = "";
  // Fechar a tela descarta o rascunho de pontos. O jogador que sai sem
  // aplicar não fica com uma distribuição meio marcada esperando por ele na
  // próxima vez que abrir — e não perde nada, porque nada foi gasto.
  limparPendencias();
}

const escapar = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// O SELO DE ESTADO. Existe porque cor sozinha não é sinal: um jogador que não
// distingue verde de laranja precisa ver a diferença entre "já é meu" e "posso
// comprar" sem passar o dedo em cada ladrilho.
const SELO = { escolhido: "✓", pendente: "＋", disponivel: "✦", bloqueado: "🔒" };
const ROTULO_ESTADO = {
  escolhido: "adquirido", pendente: "marcado, ainda não aplicado",
  disponivel: "disponível para aprender", bloqueado: "bloqueado",
};

// O ladrilho: ícone, nome curto, custo e selo. NENHUM texto longo — a
// descrição, o requisito e o botão moram no painel de detalhe, uma vez só.
function htmlLadrilho(entrada, { pendente, selecionado, ehFinal }) {
  const { no, estado: estadoReal, motivos } = entrada;
  const estado = pendente ? "pendente" : estadoReal;
  const custo = custoDoNo(no);
  const aria = `${no.nome}, ${descreverConcessao(no)}, nível ${no.nivelRequerido}, custa ${custo} ponto${custo > 1 ? "s" : ""}, ${ROTULO_ESTADO[estado]}`
    + (estado === "bloqueado" && motivos.length ? `, falta ${motivos.join(", ")}` : "");
  return `
    <button type="button"
      class="arv-no ${estado}${ehFinal ? " final" : ""}${selecionado ? " selecionado" : ""}"
      data-no="${escapar(no.id)}" aria-label="${escapar(aria)}"
      aria-pressed="${estado === "escolhido" || estado === "pendente"}">
      <span class="arv-no-quadro">
        ${escapar(no.icone || "◆")}
        <span class="arv-no-selo" aria-hidden="true">${SELO[estado]}</span>
        <span class="arv-no-custo" aria-hidden="true">${custo}</span>
      </span>
      <span class="arv-no-nome">${escapar(no.nome)}</span>
    </button>`;
}

// O PAINEL DE DETALHE.
//
// É o que transforma a árvore de catálogo em decisão: mostra o que o talento
// faz, o requisito COMPLETO (não o primeiro obstáculo) e o botão. Clicar num
// nó abre isto — não gasta ponto. Gastar exige o botão, e mesmo o botão só
// MARCA: nada sai do bolso do jogador antes de "Aplicar".
function htmlDetalhe(entrada, { pendente, pontosLivres }) {
  if (!entrada) {
    return `<div class="arv-detalhe"><div class="arv-det-vazio">
      Toque num talento para ver o que ele faz e o que ele exige.
      Escolher aqui não gasta nada: os pontos só saem quando você aplicar.
    </div></div>`;
  }
  const { no, estado, motivos } = entrada;
  const custo = custoDoNo(no);
  const jaTem = estado === "escolhido";
  const req = no.requisito
    ? Object.entries(no.requisito).map(([k, v]) => `${k} ${v}`).join(", ")
    : null;
  // O requisito é dito por inteiro e SEMPRE, não só quando falta: saber que
  // "este exige 5 pontos no ramo" antes de investir é o que permite planejar.
  const exigencias = [`nível ${no.nivelRequerido}`];
  if (no.requerRamo) exigencias.push(`${no.requerRamo} ponto${no.requerRamo > 1 ? "s" : ""} neste ramo`);
  if (req) exigencias.push(req);

  const linhaReq = jaTem
    ? `<div class="arv-det-req ok">✓ Você já tem este talento.</div>`
    : motivos.length
      ? `<div class="arv-det-req falta">🔒 Falta ${escapar(motivos.join(" · "))}</div>`
      : `<div class="arv-det-req ok">✦ Requisitos cumpridos: ${escapar(exigencias.join(" · "))}</div>`;

  const semPontos = !pendente && pontosLivres < custo;
  const acao = jaTem ? ""
    : pendente
      ? `<button type="button" class="arv-bt" data-tirar="${escapar(no.id)}">Tirar este ponto</button>`
      : `<button type="button" class="arv-bt primario" data-por="${escapar(no.id)}"
           ${motivos.length || semPontos ? "disabled" : ""}>
           ${semPontos ? `Faltam pontos (${pontosLivres}/${custo})` : `Investir ${custo} ponto${custo > 1 ? "s" : ""}`}
         </button>`;

  return `<div class="arv-detalhe">
    <div class="arv-det-cab">
      <span class="arv-det-icone" aria-hidden="true">${escapar(no.icone || "◆")}</span>
      <span>
        <div class="arv-det-nome">${escapar(no.nome)}</div>
        <div class="arv-det-tipo">${escapar(descreverConcessao(no))}</div>
      </span>
      <span class="arv-det-custo">${custo} pt${custo > 1 ? "s" : ""}</span>
    </div>
    <div class="arv-det-desc">${escapar(no.descricao)}</div>
    ${jaTem ? "" : `<div class="arv-det-req">Exige ${escapar(exigencias.join(" · "))}.</div>`}
    ${linhaReq}
    <div class="arv-det-acoes">${acao}</div>
  </div>`;
}

// --- Aba "Cards de batalha" -------------------------------------------------
//
// Depois da árvore nova um personagem chega a 9 habilidades ativas, e a mão
// de cards da batalha virou uma lista de nove opções — o card fica estreito
// demais para o texto caber e o turno vira leitura, não decisão. Aqui o
// jogador escolhe as 4 que viram card. Ver LoadoutSystem.js.

function metaDaHabilidade(h) {
  const partes = [];
  if (h.custoMP) partes.push(`${h.custoMP} de Éter`); else partes.push("sem custo");
  if (h.cooldown) partes.push(`recarga ${h.cooldown}`);
  if (h.elemento) partes.push(h.elemento);
  const AREA = { dano_area: "atinge todos", cura_area: "cura o time", buff_time: "reforça o time", debuff_area: "atinge todos" };
  if (AREA[h.tipo]) partes.push(AREA[h.tipo]);
  return partes.join(" · ");
}

function htmlSlotEquipado(h, i, total) {
  return `
    <div class="ld-slot equipada">
      <div class="ld-corpo">
        <div class="ld-nome">${i + 1}. ${escapar(h.nome)}</div>
        <div class="ld-meta">${escapar(metaDaHabilidade(h))}</div>
        <div class="ld-desc">${escapar(h.descricao || "")}</div>
      </div>
      <div class="ld-bts">
        <button class="ld-bt" data-mover="${escapar(h.id)}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Subir">▲</button>
        <button class="ld-bt" data-mover="${escapar(h.id)}" data-dir="1" ${i === total - 1 ? "disabled" : ""} title="Descer">▼</button>
        <button class="ld-bt" data-alternar="${escapar(h.id)}" title="Tirar da mão">✕</button>
      </div>
    </div>`;
}

function htmlSlotReserva(h, cheio) {
  return `
    <div class="ld-slot reserva">
      <div class="ld-corpo">
        <div class="ld-nome">${escapar(h.nome)}</div>
        <div class="ld-meta">${escapar(metaDaHabilidade(h))}</div>
        <div class="ld-desc">${escapar(h.descricao || "")}</div>
      </div>
      <div class="ld-bts">
        <button class="ld-bt" data-alternar="${escapar(h.id)}" ${cheio ? "disabled" : ""} title="${cheio ? "A mão já está cheia" : "Pôr na mão"}">＋</button>
      </div>
    </div>`;
}

function painelCards(personagem) {
  const equipadas = habilidadesEquipadas(personagem);
  const reserva = habilidadesNaReserva(personagem);
  const cheio = equipadas.length >= LIMITE_CARDS;
  const vazios = Math.max(0, LIMITE_CARDS - equipadas.length);
  return `
    <div class="ld-colunas">
      <div class="ld-caixa">
        <h3>🃏 Na mão — ${equipadas.length}/${LIMITE_CARDS}</h3>
        <div class="ld-ajuda">Só estas viram card na batalha, nesta ordem. A ordem também é a que o cursor do teclado percorre.</div>
        ${equipadas.map((h, i) => htmlSlotEquipado(h, i, equipadas.length)).join("")}
        ${Array.from({ length: vazios }, () => `<div class="ld-slot vazio">slot livre</div>`).join("")}
      </div>
      <div class="ld-caixa">
        <h3>📦 Guardadas — ${reserva.length}</h3>
        <div class="ld-ajuda">Continuam suas; só não entram na mão desta luta. Troque quando quiser, fora da batalha.</div>
        ${reserva.length ? reserva.map((h) => htmlSlotReserva(h, cheio)).join("") : `<div class="ld-slot vazio">nenhuma sobrando</div>`}
      </div>
    </div>
    <div class="ld-aviso"></div>
    <div class="arv-legenda">
      Quatro cards é o que cabe legível na dock em qualquer largura de tela — e ainda dá resposta
      para as quatro situações da luta: bater forte, bater em área, se proteger e curar.
    </div>`;
}

// Qual aba está aberta. Módulo-level porque a tela se redesenha inteira a
// cada clique (é o jeito mais simples de manter estado e tela em sincronia)
// e trocar de aba não pode zerar quando o jogador compra um nó.
let abaAtual = "arvore";
let ramoAtual = null;
// Nó aberto no painel de detalhe. Clicar num talento SELECIONA; não gasta.
let noSelecionado = null;
// PONTOS PENDENTES — a distribuição que o jogador está experimentando.
//
// Antes, clicar num nó disponível comprava na hora. Isso fazia a tela punir
// exatamente o que ela deveria encorajar: explorar antes de decidir. Agora o
// clique abre o detalhe, "Investir" só MARCA aqui, e nada entra no personagem
// até "Aplicar" — que é o único momento em que escolherNo() é chamado.
//
// Some quando a tela fecha ou o herói muda: pendência é rascunho, nunca estado
// do personagem, e um rascunho que sobrevive à troca de herói vira bug.
let pendentes = [];
let heroiDaPendencia = null;

function limparPendencias() { pendentes = []; heroiDaPendencia = null; noSelecionado = null; }

// Fundo temático por ramo. Fica ATRÁS dos ladrilhos, a 50% de opacidade, e é
// sinal secundário: o estado de cada nó continua legível sem depender dele.
// MEDIDO em tela: a primeira versão usava alfa .30–.36 e os três ramos do
// Guerreiro saíram praticamente do mesmo azul — o fundo da própria janela
// dominava e a cor não separava nada. Estes valores são o dobro, e o ramo
// passa a ser reconhecível de longe, que é o ponto da referência.
const CORES_RAMO = {
  // guerreiro
  lamina: "rgba(186,52,44,.62)", baluarte: "rgba(46,104,180,.62)", comando: "rgba(176,132,38,.58)",
  // mago
  elementalista: "rgba(42,140,196,.62)", arcanista: "rgba(126,64,196,.62)", runas: "rgba(54,150,116,.58)",
  // ladino
  sombra: "rgba(74,60,132,.66)", gemeas: "rgba(182,62,92,.6)", trapaca: "rgba(172,138,44,.56)",
  // clérigo
  luz: "rgba(202,166,58,.58)", fe_marcial: "rgba(58,122,182,.6)", punicao: "rgba(182,56,46,.6)",
  // bárbaro
  furia: "rgba(190,52,34,.64)", instinto: "rgba(78,142,58,.6)", devastacao: "rgba(146,94,44,.6)",
  // patrulheiro
  cacada: "rgba(88,152,64,.6)", tempestade: "rgba(58,110,190,.62)", vinculo: "rgba(48,150,106,.58)",
};

export function montarArvoreHabilidades(personagem, dados, onMudar, aba = null, opcoes = {}) {
  garantirCSS();
  garantirEstadoArvore(personagem);
  garantirLoadout(personagem);
  if (aba) abaAtual = aba;
  overlay().classList.remove("hidden");
  conteudo().classList.remove("arvore-caminhos", "arvore-so-heranca");

  const nos = arvoreDaClasse(personagem, dados);
  const ramos = ramosDaClasse(personagem, dados);
  if (!ramos.some((r) => r.id === ramoAtual)) ramoAtual = ramos[0]?.id || null;
  const avaliacao = avaliarArvore(personagem, dados);
  const porId = new Map(avaliacao.map((e) => [e.no.id, e]));

  const disponiveis = pontosDisponiveis(personagem, dados);
  const gastos = pontosGastos(personagem, dados);
  const total = pontosTotais(personagem);
  const custoReset = custoDeReset(personagem);
  const podeResetar = gastos > 0 && (personagem.ouro || 0) >= custoReset;

  // A pendência é do herói aberto. Trocar de herói descarta o rascunho — o
  // contrário deixaria pontos marcados de um personagem prontos para serem
  // aplicados em outro.
  if (heroiDaPendencia && heroiDaPendencia !== personagem) limparPendencias();
  if (pendentes.length) heroiDaPendencia = personagem;
  // Pendência de nó que deixou de existir (reset, troca de classe) não fica.
  pendentes = pendentes.filter((id) => porId.has(id));
  const marcados = new Set(pendentes);
  const custoPendente = pendentes.reduce((s, id) => s + custoDoNo(porId.get(id).no), 0);
  const livres = disponiveis - custoPendente;

  const colunas = ramos.map((ramo) => {
    const doRamo = nos.filter((n) => n.ramo === ramo.id).sort((a, b) => a.tier - b.tier);
    const investido = pontosNoRamo(personagem, dados, ramo.id);
    const pendentesNoRamo = doRamo.filter((n) => marcados.has(n.id)).length;
    const ultimoTier = Math.max(...doRamo.map((n) => n.tier));
    const degraus = doRamo.map((n) => {
      const entrada = porId.get(n.id);
      const pendente = marcados.has(n.id);
      // O traço só fica aceso quando o degrau ANTERIOR já é seu: a linha
      // mostra até onde a corrente de fato chegou, não onde ela poderia ir.
      const anterior = doRamo.find((x) => x.tier === n.tier - 1);
      const ligada = anterior && (porId.get(anterior.id).estado === "escolhido" || marcados.has(anterior.id));
      return `<div class="arv-degrau${ligada ? " ligada" : ""}">${htmlLadrilho(entrada, {
        pendente, selecionado: noSelecionado === n.id, ehFinal: n.tier === ultimoTier,
      })}</div>`;
    }).join("");
    return `
      <div class="arv-ramo ${ramo.id === ramoAtual ? "ativo" : ""}" data-ramo="${escapar(ramo.id)}"
        style="--ramo-cor:${CORES_RAMO[ramo.id] || "rgba(151,111,210,.3)"}">
        <div class="arv-ramo-cab">
          <span class="arv-ramo-icone" aria-hidden="true">${ramo.icone || "◆"}</span>
          <span class="arv-ramo-nome">${escapar(ramo.nome)}</span>
          <span class="arv-ramo-inv">${investido}${pendentesNoRamo ? `+${pendentesNoRamo}` : ""}/10 pts</span>
        </div>
        <div class="arv-ramo-desc">${escapar(ramo.descricao || "")}</div>
        ${degraus}
      </div>`;
  }).join("");

  const detalhe = htmlDetalhe(noSelecionado ? porId.get(noSelecionado) : null,
    { pendente: marcados.has(noSelecionado), pontosLivres: livres });

  const barraPendencia = pendentes.length ? `
    <div class="arv-detalhe" role="status">
      <div class="arv-pendencia">
        ${pendentes.length} talento${pendentes.length > 1 ? "s" : ""} marcado${pendentes.length > 1 ? "s" : ""}
        · ${custoPendente} ponto${custoPendente > 1 ? "s" : ""} · ainda dá pra desfazer
      </div>
      <div class="arv-det-acoes">
        <button type="button" class="arv-bt confirmar" data-aplicar>Aplicar ${custoPendente} ponto${custoPendente > 1 ? "s" : ""}</button>
        <button type="button" class="arv-bt" data-desfazer>Desfazer tudo</button>
      </div>
    </div>` : "";

  const marcas = (personagem.arvore.marcas || []).map((m) => `<div>${escapar(descreverMarca(m, personagem, null, {}).replace(/ — (ATIVA|inativa).*/, ""))} — ${escapar(m.descricao)}</div>`).join("");

  // O 30 estava escrito à mão aqui. Nunca foi verdade para todo mundo: as
  // quatro classes novas custam 27, e qualquer nó acrescentado à árvore move
  // o número. Frase que mente sobre a economia da tela é pior do que frase
  // nenhuma — o jogador decide onde gastar olhando justamente para ela.
  const custoDaArvoreInteira = nos.reduce((soma, n) => soma + (n.custo || 1), 0);

  const painelArvore = `
    <div class="arv-topo">
      <div>
        <div class="arv-pontos"><b>${disponiveis}</b> ponto${disponiveis === 1 ? "" : "s"} disponíve${disponiveis === 1 ? "l" : "is"}</div>
        <div class="arv-sub">${gastos} de ${total} gastos · a árvore inteira custa ${custoDaArvoreInteira} — você nunca compra tudo</div>
      </div>
      <button class="arv-reset" ${podeResetar ? "" : "disabled"} title="${gastos ? `Custa ${custoReset} de ouro (você tem ${personagem.ouro || 0})` : "Você ainda não gastou nenhum ponto"}">
        ↺ Redistribuir · ${custoReset} ouro
      </button>
    </div>
    <div class="arv-filtros-caixa">
      <div class="arv-filtros" role="tablist" aria-label="Ramos de habilidade">
        ${ramos.map((r) => `<button type="button" role="tab" aria-selected="${r.id === ramoAtual}" class="arv-filtro-ramo ${r.id === ramoAtual ? "ativo" : ""}" data-ramo-filtro="${escapar(r.id)}">${r.icone || "◆"} ${escapar(r.nome)}</button>`).join("")}
      </div>
    </div>
    <div class="arv-grade">${colunas}</div>
    ${detalhe}
    ${barraPendencia}
    ${marcas ? `<div class="arv-legenda"><b>Suas marcas de classe:</b><br>${marcas}</div>` : ""}
    <div class="arv-legenda">
      Cada nível dá 1 ponto. Os nós finais de cada ramo exigem <b>7 pontos naquele mesmo ramo</b> —
      espalhar pontos pelos três ramos nunca chega ao fim de nenhum.
      Os requisitos de atributo do ramo híbrido contam equipamento: um amuleto pode abrir um nó.
      <div class="arv-legenda-estados">
        <span>✓ adquirido</span><span>✦ disponível</span><span>＋ marcado</span><span>🔒 bloqueado</span>
      </div>
    </div>`;

  const naMao = habilidadesEquipadas(personagem).length;
  conteudo().innerHTML = `
    <button class="fechar">Fechar (Esc)</button>
    <nav class="progressao-heroi-nav" aria-label="Progressão do herói">
      <button type="button" data-voltar-companhia>← Companhia</button>
      <button class="ativo" type="button" aria-current="page">🌳 Habilidades e cards</button>
      ${opcoes.abrirHeranca ? '<button type="button" data-progressao-heranca>💠 Caminhos e Herança</button>' : ""}
    </nav>
    <h2>Habilidades — ${escapar(personagem.classeNome)}</h2>
    <div class="arv-abas" role="tablist" aria-label="Conteúdo das habilidades">
      <button role="tab" aria-selected="${abaAtual === "arvore"}" class="arv-aba ${abaAtual === "arvore" ? "ativa" : ""}" data-aba="arvore">🌳 Árvore${disponiveis > 0 ? ` · ${disponiveis} pt` : ""}</button>
      <button role="tab" aria-selected="${abaAtual === "cards"}" class="arv-aba ${abaAtual === "cards" ? "ativa" : ""}" data-aba="cards">🃏 Cards de batalha · ${naMao}/${LIMITE_CARDS}</button>
    </div>
    ${abaAtual === "cards" ? painelCards(personagem) : painelArvore}
  `;

  conteudo().querySelector(".fechar").onclick = fecharModalLocal;
  const btnHeranca = conteudo().querySelector("[data-progressao-heranca]");
  if (btnHeranca) btnHeranca.onclick = opcoes.abrirHeranca;
  conteudo().querySelector('[data-voltar-companhia]').onclick = () => document.dispatchEvent(new CustomEvent('hda-navegar', { detail: 'estado' }));
  conteudo().querySelectorAll(".arv-aba").forEach((b) => {
    b.onclick = () => montarArvoreHabilidades(personagem, dados, onMudar, b.dataset.aba, opcoes);
  });
  // A pista de "tem mais ramos à direita". CSS não sabe medir transbordo, e
  // `scrollbar-width:none` apagou a única pista nativa que existia — então a
  // classe é posta aqui, na montagem e a cada rolagem. Ela some sozinha quando
  // o jogador chega ao fim da fila, e nunca aparece numa tela larga onde todos
  // os ramos já cabem.
  {
    const fila = conteudo().querySelector(".arv-filtros");
    const caixa = conteudo().querySelector(".arv-filtros-caixa");
    if (fila && caixa) {
      const revisar = () => {
        const restante = fila.scrollWidth - fila.clientWidth - fila.scrollLeft;
        caixa.classList.toggle("tem-mais", restante > 4);
      };
      fila.addEventListener("scroll", revisar, { passive: true });
      revisar();
      // O painel pode abrir antes de a fonte assentar, e aí a medida sai
      // errada por alguns pixels. Uma segunda leitura no quadro seguinte
      // custa nada e evita a pista aparecer (ou sumir) por engano.
      requestAnimationFrame(revisar);
    }
  }
  conteudo().querySelectorAll("[data-ramo-filtro]").forEach((b) => {
    b.onclick = () => {
      ramoAtual = b.dataset.ramoFiltro;
      conteudo().querySelectorAll(".arv-filtro-ramo").forEach((x) => {
        x.classList.toggle("ativo", x === b);
        x.setAttribute("aria-selected", x === b ? "true" : "false");
      });
      conteudo().querySelectorAll(".arv-ramo").forEach((x) => x.classList.toggle("ativo", x.dataset.ramo === ramoAtual));
      conteudo().querySelector(`.arv-ramo[data-ramo="${CSS.escape(ramoAtual)}"] .arv-no`)?.focus();
    };
  });

  // Setas percorrem a trilha ativa sem depender do mouse. Esquerda/direita
  // troca de ramo; cima/baixo percorre os níveis. Enter e Espaço mantêm o
  // comportamento nativo do botão, inclusive para talentos disponíveis.
  conteudo().querySelector(".arv-grade")?.addEventListener("keydown", (evento) => {
    if (!evento.target.matches(".arv-no")) return;
    const ativos = [...conteudo().querySelectorAll(".arv-ramo.ativo .arv-no")];
    const indice = ativos.indexOf(evento.target);
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp" || evento.key === "Home" || evento.key === "End") {
      evento.preventDefault();
      const destino = evento.key === "Home" ? 0 : evento.key === "End" ? ativos.length - 1 : Math.max(0, Math.min(ativos.length - 1, indice + (evento.key === "ArrowDown" ? 1 : -1)));
      ativos[destino]?.focus();
      return;
    }
    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
    evento.preventDefault();
    const filtros = [...conteudo().querySelectorAll(".arv-filtro-ramo")];
    const atual = filtros.findIndex((x) => x.classList.contains("ativo"));
    const destino = Math.max(0, Math.min(filtros.length - 1, atual + (evento.key === "ArrowRight" ? 1 : -1)));
    filtros[destino]?.click();
  });

  // Aba de cards: ligar/desligar e reordenar. Um clique recusado escreve o
  // motivo em vez de simplesmente não fazer nada — "cliquei e não aconteceu"
  // é o pior retorno possível numa tela de configuração.
  const aviso = conteudo().querySelector(".ld-aviso");
  conteudo().querySelectorAll("[data-alternar]").forEach((b) => {
    b.onclick = () => {
      const r = alternarCard(personagem, b.dataset.alternar);
      if (!r.ok) { if (aviso) aviso.textContent = `⚠️ ${r.motivo}`; return; }
      onMudar();
      montarArvoreHabilidades(personagem, dados, onMudar, null, opcoes);
    };
  });
  conteudo().querySelectorAll("[data-mover]").forEach((b) => {
    b.onclick = () => {
      if (moverCard(personagem, b.dataset.mover, Number(b.dataset.dir)).ok) {
        montarArvoreHabilidades(personagem, dados, onMudar, null, opcoes);
      }
    };
  });

  const redesenhar = () => montarArvoreHabilidades(personagem, dados, onMudar, null, opcoes);

  // CLICAR NUM TALENTO ABRE O DETALHE. Não compra.
  //
  // Todo nó responde ao clique, inclusive o bloqueado — saber POR QUE um
  // talento está fechado é a informação mais pedida desta tela, e ela estava
  // escondida dentro de um `title` que celular nenhum mostra.
  conteudo().querySelectorAll(".arv-no").forEach((el) => {
    el.onclick = () => {
      noSelecionado = el.dataset.no;
      redesenhar();
      // O detalhe nasce fora da vista num celular: leva o foco até ele para
      // quem usa teclado e rola até ele para quem usa o dedo.
      const det = conteudo().querySelector(".arv-detalhe");
      det?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
  });

  // MARCAR e DESMARCAR — só mexe no rascunho.
  conteudo().querySelector("[data-por]")?.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.por;
    if (!pendentes.includes(id)) pendentes.push(id);
    heroiDaPendencia = personagem;
    redesenhar();
  });
  conteudo().querySelector("[data-tirar]")?.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.tirar;
    pendentes = pendentes.filter((x) => x !== id);
    redesenhar();
  });

  // APLICAR — o único lugar do arquivo que gasta ponto de verdade.
  //
  // Aplica em ordem de degrau: o nó de degrau 3 exige pontos no ramo que só
  // existem depois que os de 1 e 2 entraram. Aplicar na ordem em que o jogador
  // clicou faria uma marcação legal ser recusada por ordem, não por regra.
  conteudo().querySelector("[data-aplicar]")?.addEventListener("click", () => {
    const naOrdem = [...pendentes].sort((a, b) => {
      const x = porId.get(a)?.no; const y = porId.get(b)?.no;
      return (x?.tier || 0) - (y?.tier || 0);
    });
    let aplicados = 0; const recusados = [];
    for (const id of naOrdem) {
      const r = escolherNo(personagem, dados, id);
      if (r.ok) aplicados += 1; else recusados.push(porId.get(id)?.no?.nome || id);
    }
    pendentes = recusados.length ? pendentes.filter((id) => !porId.get(id) || porId.get(id).estado !== "escolhido") : [];
    if (!pendentes.length) heroiDaPendencia = null;
    if (aplicados) onMudar();
    redesenhar();
    // Uma recusa aqui é defeito de regra, não do jogador: dizer qual talento
    // não entrou é melhor do que a tela simplesmente não mudar.
    if (recusados.length) {
      const aviso = conteudo().querySelector(".arv-pendencia");
      if (aviso) aviso.textContent = `Não deu para aplicar: ${recusados.join(", ")}.`;
    }
  });
  conteudo().querySelector("[data-desfazer]")?.addEventListener("click", () => {
    pendentes = []; heroiDaPendencia = null;
    redesenhar();
  });

  const btnReset = conteudo().querySelector(".arv-reset");
  if (btnReset && podeResetar) {
    btnReset.onclick = () => {
      // Confirmação em duas etapas no próprio botão: um `confirm()` nativo
      // trava a tela inteira do jogo e some no celular.
      if (btnReset.dataset.confirmando !== "1") {
        btnReset.dataset.confirmando = "1";
        btnReset.textContent = `Confirmar? Devolve ${gastos} pts por ${custoReset} ouro`;
        return;
      }
      const r = resetarArvore(personagem, dados);
      if (r.ok) onMudar();
      montarArvoreHabilidades(personagem, dados, onMudar, null, opcoes);
    };
  }
}
