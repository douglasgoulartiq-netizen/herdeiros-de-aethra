// A RODA DOS SELOS — a navegação do jogo em uma tela só.
//
// O QUE ELA SUBSTITUI
// -------------------
// Quatro abas num trilho lateral (PC) ou numa barra inferior (celular), cada
// uma abrindo um painel com a lista de ações. Para chegar na mochila eram
// dois toques e um painel que cobria o mundo pela lateral. Quatro abas
// também obrigam a decidir ANTES de ver: o jogador precisa saber que
// "Equipamento" mora dentro de "Companhia" para achá-lo.
//
// Aqui é um toque. O botão abre metade da tela e TODAS as ações aparecem de
// uma vez, agrupadas mas visíveis — ninguém precisa adivinhar em que gaveta
// está o que quer.
//
// POR QUE METADE DA TELA, E NÃO A TELA INTEIRA
// --------------------------------------------
// O mundo continua visível atrás. Isso não é enfeite: o jogador abre o menu
// no meio de uma caminhada, e ver onde parou é o que evita a sensação de
// "saí do jogo para mexer num aplicativo". No PC a metade é a direita (a mão
// do mouse); no celular é a de baixo (o alcance do polegar).
//
// A IDENTIDADE VEM DO CÓDICE
// --------------------------
// Os ícones são os sigilos de `Sigilos.js`, desenhados a partir dos Cinco
// Selos de Elyndor, na mesma grade de 16 px do resto da arte. Nenhum emoji:
// emoji é desenho de outra pessoa, muda de cara em cada aparelho e não diz
// nada sobre Aethra.
import { SIGILOS, sigiloSVG } from "./Sigilos.js";

const CSS_ID = "css-roda-dos-selos";

// Cada ação aponta para um sigilo. Quando não houver, o emoji antigo entra
// como rede de segurança — uma ação nova não pode sumir do menu só porque
// ninguém desenhou o símbolo dela ainda.
const SIGILO_DA_ACAO = {
  estado: "herois", equipamento: "equipamento", arvore: "evolucao",
  caminhos: "caminhos", party: "formacao", missoes: "missoes",
  mapa: "mapa", compendio: "codice", gacha: "invocar",
  tutorial: "tutorial", descansar: "descansar", sair_masmorra: "sair",
  salvar: "salvar", acessibilidade: "acessibilidade", auto: "automatico",
};

// A cor de cada grupo sai do Selo que ele representa. Sinal secundário: o
// sigilo e o rótulo continuam dizendo tudo sem a cor.
const COR_DO_GRUPO = {
  personagem: "#c9a227", // Pedra — matéria, o que o herói é e carrega
  jornada: "#4a9fd4",    // Maré — rotas, mudança, para onde se vai
  invocar: "#c4553f",    // Chama — a Convergência, o que nasce
  mais: "#8a7fb5",       // Véu — limite, passagem, o que fecha o jogo
};

const CSS = `
.roda-abrir {
  position: fixed; z-index: 40; display: grid; place-items: center;
  width: 64px; height: 64px; padding: 0; cursor: pointer;
  border: 2px solid rgba(214,182,110,.5); border-radius: 18px;
  background: linear-gradient(160deg, rgba(28,24,44,.94), rgba(14,12,24,.96));
  box-shadow: 0 6px 22px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08);
  color: #e8dcc0;
}
.roda-abrir:hover { border-color: #e6c877; }
.roda-abrir:focus-visible { outline: 3px solid #fff1a8; outline-offset: 3px; }
.roda-abrir[aria-expanded="true"] { border-color: #e6c877; background: linear-gradient(160deg, rgba(58,46,26,.96), rgba(26,20,12,.96)); }
.roda-abrir .sigilo { width: 34px; height: 34px; }

/* A CORTINA não é escurecimento decorativo: ela é o que impede o clique de
   atravessar para o mundo enquanto o menu está aberto, e o que dá o alvo de
   "clicar fora para fechar". */
.roda-cortina { position: fixed; inset: 0; z-index: 39; background: rgba(6,5,12,.42);
  backdrop-filter: blur(2px); opacity: 0; transition: opacity .18s ease; }
.roda-cortina.vis { opacity: 1; }

/* O ATRIBUTO hidden PRECISA GANHAR DE .roda.
   A regra do navegador para [hidden] é um seletor de tipo; .roda com
   display:flex é um seletor de classe e vence por especificidade. Resultado
   medido: a Roda aparecia ABERTA na tela de título e o painel cobria o botão
   "Criar personagem" — o teste automatizado não conseguia nem começar o jogo.
   Um !important aqui é a exceção que se justifica: esconder é a única coisa
   que nenhuma outra regra pode ter o direito de desfazer. */
.roda[hidden], .roda-cortina[hidden] { display: none !important; }

/* A Roda só existe DENTRO do jogo. Ela mora no body (ver o comentário na
   montagem), então perdeu a carona na visibilidade do #hud — sem esta regra
   o botão de abrir flutuaria sobre a tela de título e sobre a criação de
   personagem, que são telas com fluxo próprio. */
body:has(#screen-boot:not(.hidden)) .roda-abrir,
body:has(#screen-criacao:not(.hidden)) .roda-abrir,
body:has(#screen-batalha:not(.hidden)) .roda-abrir { display: none; }

.roda { position: fixed; z-index: 41; display: flex; flex-direction: column;
  background: linear-gradient(200deg, rgba(24,20,38,.97), rgba(10,9,18,.985));
  border: 1px solid rgba(214,182,110,.34);
  box-shadow: 0 -2px 60px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06);
  overflow: hidden auto; overscroll-behavior: contain;
}
/* Fio dourado na aresta que encosta no mundo: é o que faz o painel parecer
   uma peça do jogo em vez de uma caixa de sistema por cima dele. */
.roda::before { content: ""; position: absolute; inset-inline: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(230,200,119,.75), transparent); }

.roda-cab { display: flex; align-items: baseline; gap: 10px; padding: 14px 18px 4px; }
.roda-titulo { font-size: 1.04rem; font-weight: 700; letter-spacing: .04em; color: #f0e4c6; }
.roda-sub { font-size: .76rem; opacity: .6; }
.roda-fechar { margin-left: auto; min-height: 36px; padding: 5px 12px; cursor: pointer;
  border: 1px solid rgba(255,255,255,.2); border-radius: 9px; font: inherit; font-size: .82rem;
  background: rgba(255,255,255,.06); color: inherit; }
.roda-fechar:focus-visible { outline: 3px solid #fff1a8; outline-offset: 2px; }

.roda-grupo { padding: 8px 18px 4px; }
.roda-grupo-rot { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  font-size: .68rem; text-transform: uppercase; letter-spacing: .14em; color: var(--sel, #d6b66e); opacity: .9; }
.roda-grupo-rot::after { content: ""; flex: 1; height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--sel, #d6b66e) 55%, transparent), transparent); }

.roda-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.roda-item { position: relative; display: flex; flex-direction: column; align-items: center;
  gap: 7px; padding: 12px 6px 10px; cursor: pointer; font: inherit; color: #e6dcc6;
  border: 1px solid rgba(255,255,255,.1); border-radius: 14px;
  background: linear-gradient(170deg, rgba(255,255,255,.055), rgba(255,255,255,.012));
  transition: transform .14s ease, border-color .14s ease, background .14s ease;
}
.roda-item:hover { transform: translateY(-2px); border-color: var(--sel, #d6b66e);
  background: linear-gradient(170deg, color-mix(in srgb, var(--sel,#d6b66e) 20%, transparent), rgba(255,255,255,.02)); }
.roda-item:active { transform: translateY(0); }
.roda-item:focus-visible { outline: 3px solid #fff1a8; outline-offset: 2px; }
.roda-item-rot { font-size: .76rem; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
.roda-item kbd { position: absolute; top: 5px; right: 6px; font-size: .58rem; opacity: .42;
  border: 1px solid rgba(255,255,255,.2); border-radius: 4px; padding: 0 3px; }
.roda-item .sigilo { width: 42px; height: 42px; }
.sigilo .sig-traco { fill: #0d0b14; }
.sigilo .sig-corpo { fill: var(--sel, #d6b66e); }
.sigilo .sig-brilho { fill: #fff3d0; }
.roda-item:hover .sigilo .sig-corpo { fill: color-mix(in srgb, var(--sel,#d6b66e) 78%, #fff); }

/* O Automático é ESTADO, não destino: fica marcado quando está ligado. */
.roda-item.ligado { border-color: #4ecb71; background: linear-gradient(170deg, rgba(78,203,113,.2), rgba(255,255,255,.02)); }
.roda-item.ligado .sigilo .sig-corpo { fill: #8ce9a4; }

/* ENTRADA. Os ladrilhos entram em cascata a partir da borda do painel — o
   atraso é por posição, não aleatório, então o olho segue a ordem de leitura.
   Cada um nasce VISÍVEL e só desliza: parar em opacity 0 esperando animação
   é como uma tela vira uma tela em branco quando algo falha. */
@keyframes roda-entra { from { transform: translateY(10px); opacity: .001; } to { transform: none; opacity: 1; } }
.roda.animar .roda-item { animation: roda-entra .26s cubic-bezier(.2,.9,.3,1) backwards; }
@media (prefers-reduced-motion: reduce) {
  .roda.animar .roda-item { animation: none; }
  .roda-cortina { transition: none; }
  .roda-item { transition: none; }
}

/* PC — metade DIREITA. O mundo continua à esquerda. */
@media (min-width: 900px) {
  .roda-abrir { right: 18px; bottom: 18px; }
  /* MEDIDO: top:0 com bottom:0 num elemento position:fixed devolveu altura de
     2 px aqui — só o traço do ::before. O #hud-buttons que hospeda a Roda tem
     max-height e overflow-y:auto próprios (hda-ui.css), e o par top/bottom não
     resolveu contra o viewport como deveria. Altura explícita não depende
     dessa resolução e não deixa margem para o painel colapsar.
     (Comentário DENTRO de um template literal: nenhuma crase aqui.) */
  .roda { right: 0; top: 0; height: 100dvh; width: min(46vw, 560px);
    border-radius: 20px 0 0 20px; }
  .roda::before { inset: 0 auto 0 0; width: 2px; height: auto;
    background: linear-gradient(180deg, transparent, rgba(230,200,119,.75), transparent); }
}
/* Celular — metade DE BAIXO, onde o polegar alcança. */
@media (max-width: 899px) {
  .roda-abrir { right: 14px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); width: 58px; height: 58px; }
  .roda { left: 0; right: 0; bottom: 0; max-height: 62dvh; border-radius: 20px 20px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px); }
  .roda-grade { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
  .roda-item { min-height: 88px; }
  .roda-cab { padding: 12px 16px 2px; }
  .roda-grupo { padding: 6px 16px 2px; }
}
`;

function garantirCSS() {
  if (document.getElementById(CSS_ID)) return;
  const el = document.createElement("style");
  el.id = CSS_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

const icone = (acao, rotulo) => (SIGILO_DA_ACAO[acao] && SIGILOS[SIGILO_DA_ACAO[acao]]
  ? sigiloSVG(SIGILO_DA_ACAO[acao], { tamanho: 42, titulo: rotulo })
  : `<span class="roda-emoji" aria-hidden="true">${acao.icone || "◆"}</span>`);

// Monta a Roda. `hubs` e `acaoAuto` vêm de GameUI para este módulo não
// precisar conhecer o conteúdo do menu — ele cuida da FORMA, não da lista.
export function montarRodaDosSelos(hud, hubs, acaoAuto, onAcao, signal) {
  garantirCSS();
  hud.className = "hud-roda";
  hud.innerHTML = "";

  const abrir = document.createElement("button");
  abrir.type = "button";
  abrir.className = "roda-abrir";
  abrir.id = "roda-abrir";
  abrir.setAttribute("aria-expanded", "false");
  abrir.setAttribute("aria-controls", "roda-painel");
  abrir.title = "Menu (Esc fecha)";
  abrir.setAttribute("aria-label", "Abrir o menu");
  abrir.innerHTML = sigiloSVG("caminhos", { tamanho: 34 });

  const cortina = document.createElement("div");
  cortina.className = "roda-cortina";
  cortina.hidden = true;

  const roda = document.createElement("div");
  roda.className = "roda";
  roda.id = "roda-painel";
  roda.hidden = true;
  roda.setAttribute("role", "dialog");
  roda.setAttribute("aria-modal", "false");
  roda.setAttribute("aria-label", "Menu do jogo");

  roda.innerHTML = `
    <div class="roda-cab">
      <span class="roda-titulo">Os Selos</span>
      <span class="roda-sub">tudo em um toque</span>
      <button type="button" class="roda-fechar">Fechar · Esc</button>
    </div>`;

  // TODOS os grupos e TODAS as ações nascem no DOM. Dois motivos: o jogador
  // vê o menu inteiro sem abrir gaveta nenhuma, e `atualizarHUD` liga e
  // desliga botões por id (#btn-caminhos, #btn-auto) — um id que só existe
  // com o menu aberto seria um id ausente na hora em que é usado.
  for (const hub of hubs) {
    const grupo = document.createElement("div");
    grupo.className = "roda-grupo";
    grupo.dataset.hub = hub.id;
    grupo.style.setProperty("--sel", COR_DO_GRUPO[hub.id] || "#d6b66e");
    const grade = document.createElement("div");
    grade.className = "roda-grade";
    const acoes = hub.id === "mais" ? [...hub.acoes, acaoAuto] : hub.acoes;
    for (const a of acoes) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "roda-item";
      b.dataset.action = a.acao;
      if (a.id) b.id = a.id;
      if (a.ocultavel) b.classList.add("hidden");
      // O rótulo do ladrilho é o CURTO. MEDIDO na tela: "Formação e
      // companheiros" e "Acessibilidade" quebravam em três linhas com uma
      // letra órfã embaixo ("companheiro / s"). O nome inteiro continua no
      // aria-label e no title, para leitor de tela e para quem passa o mouse.
      b.title = a.rotulo;
      b.setAttribute("aria-label", a.rotulo);
      b.innerHTML = `${icone(a.acao, a.rotulo)}
        <span class="roda-item-rot">${a.curto || a.rotulo}</span>
        ${a.atalho ? `<kbd>${a.atalho}</kbd>` : ""}`;
      // O Automático é estado: ligá-lo NÃO fecha a Roda, para o jogador ver
      // o botão acender. Todo o resto abre uma tela e a Roda sai da frente.
      b.onclick = () => { if (a.acao !== acaoAuto.acao) fechar(); onAcao(a.acao); };
      grade.appendChild(b);
    }
    grupo.innerHTML = `<div class="roda-grupo-rot">${hub.rotulo}</div>`;
    grupo.appendChild(grade);
    roda.appendChild(grupo);
  }

  let aberta = false;
  function abrirRoda() {
    aberta = true;
    cortina.hidden = false; roda.hidden = false;
    requestAnimationFrame(() => cortina.classList.add("vis"));
    roda.classList.add("animar");
    // Cascata por posição de leitura. 26 ms por passo: o último ladrilho de
    // uma Roda de 15 entra em ~390 ms, abaixo do meio segundo em que uma
    // animação de abertura deixa de parecer resposta e passa a parecer espera.
    roda.querySelectorAll(".roda-item").forEach((el, i) => {
      el.style.animationDelay = `${Math.min(i, 14) * 26}ms`;
    });
    abrir.setAttribute("aria-expanded", "true");
    roda.querySelector(".roda-item:not(.hidden)")?.focus();
  }
  function fechar() {
    if (!aberta) return;
    aberta = false;
    cortina.classList.remove("vis");
    roda.hidden = true; cortina.hidden = true;
    roda.classList.remove("animar");
    abrir.setAttribute("aria-expanded", "false");
  }
  abrir.onclick = (ev) => { ev.stopPropagation(); if (aberta) fechar(); else abrirRoda(); };
  cortina.onclick = fechar;
  roda.querySelector(".roda-fechar").onclick = fechar;
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && aberta) { ev.stopPropagation(); fechar(); }
  }, { signal });

  // A RODA MORA NO BODY, não dentro do #hud.
  //
  // MEDIDO: pendurada em #hud-buttons, a Roda aparecia em top -360 e depois
  // -152 — ou seja, o `position: fixed` estava resolvendo contra um ancestral,
  // não contra a janela, e o painel inteiro ficava fora da tela (invisível no
  // screenshot, mas com caixa de 560x720 na medição, que foi o que quase me
  // enganou). Um ancestral do HUD cria bloco de contenção; sobreposição de
  // tela cheia não pode depender de descobrir qual. No body não há ancestral
  // nenhum para atrapalhar.
  //
  // Os ids continuam existindo no documento (#btn-auto, #btn-caminhos), que é
  // o que `atualizarHUD` procura — ele usa getElementById, não busca dentro
  // do #hud.
  document.body.append(cortina, roda, abrir);
  // Uma remontagem (troca de orientação) não pode deixar a Roda anterior para
  // trás no body: sem isto, girar o celular empilharia painéis invisíveis.
  signal?.addEventListener("abort", () => { cortina.remove(); roda.remove(); abrir.remove(); });
  return { abrir: abrirRoda, fechar, estaAberta: () => aberta };
}
