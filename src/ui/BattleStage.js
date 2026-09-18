// Palco da batalha: o esqueleto FIXO da tela de combate.
//
// POR QUE ISSO EXISTE — a causa do bug de deslocamento
// ----------------------------------------------------
// A tela antiga era uma pilha vertical em que quase tudo participava do
// fluxo do documento: os combatentes viviam em duas colunas flex com
// `flex-wrap: wrap`, recriadas inteiras a cada tick do ATB (~140ms); o log
// era um <details> que ao abrir empurrava o contexto tático e a mão de
// cards; badges de sinergia e de horda entravam e saíam do fluxo; e o campo
// usava `align-items: safe center` com `overflow:auto`, então qualquer
// mudança de altura recentralizava tudo. Resultado: trocar de personagem
// ativo, matar um monstro ou ganhar um status mexia na tela inteira.
//
// A CORREÇÃO É ESTRUTURAL, não cosmética: o palco é um grid de quatro
// faixas de altura previsível, e o campo é um retângulo cuja altura vem da
// faixa do grid — nunca do conteúdo. Dentro dele, monstros e heróis moram em
// SLOTS de tamanho fixo criados uma única vez. Conteúdo muda dentro do slot;
// slot não sai do lugar. Um combatente morto deixa o slot lá, apagado.
//
//   ┌────────────────────────────────┐
//   │ header do terreno              │  auto (altura estável)
//   ├────────────────────────────────┤
//   │ CAMPO                          │  minmax(0, 1fr)  ← só ele cresce
//   │  cena (canvas de tiles reais)  │
//   │  fileira de inimigos (slots)   │
//   │  fileira de heróis (slots)     │
//   │  fx / dado / overlays          │
//   ├────────────────────────────────┤
//   │ infobar: timeline + log        │  auto
//   ├────────────────────────────────┤
//   │ dock de cards                  │  auto (altura por clamp no CSS)
//   └────────────────────────────────┘
//
// Nada aqui conhece regra de combate — o palco só oferece lugares. Quem
// preenche é a BattleUI.
import { TILE_SIZE } from "../data/worldMap.js";

// Quantos lugares existem em cada fileira. Os números vêm do jogo: o time
// ativo é o principal + até 3 convocados (MAX_CONVOCADOS_GACHA), e o maior
// encontro possível hoje é uma horda de 5 + 1 de emboscada.
export const MAX_SLOTS_HEROI = 4;
export const MAX_SLOTS_INIMIGO = 6;

// Ruído determinístico: a cena precisa ser idêntica em todo redesenho (a
// cada resize, por exemplo), senão a vegetação "pularia" de lugar.
function ruido(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const semeteDe = (txt) => [...String(txt)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const comAlpha = (cor, alpha) => {
  const hex = String(cor || "").match(/^#([0-9a-f]{6})$/i);
  if (!hex) return cor || `rgba(20,24,28,${alpha})`;
  const valor = Number.parseInt(hex[1], 16);
  return `rgba(${valor >> 16},${(valor >> 8) & 255},${valor & 255},${alpha})`;
};

// Desenha o cenário no canvas de fundo usando os TILES REAIS do jogo
// (assets/tiles/tileset.png). Três faixas: céu, vegetação distante
// escurecida e chão. Sem arte nova: o chão da batalha é o chão do mapa.
// `fracHorizonte` é ONDE O CHÃO COMEÇA, em fração da altura do campo.
//
// Era 0,42 fixo — e a fileira de inimigos vai de 2% a ~44% da altura. Ou
// seja: os inimigos eram desenhados NO CÉU. Numa masmorra os morcegos
// flutuavam sobre a parede do fundo; numa praia, o caranguejo ficava na faixa
// escura do horizonte. A sombra elíptica sob cada sprite não resolvia nada,
// porque ela ancora o sprite ao CARD, não ao cenário.
//
// Agora quem monta o palco mede onde os sprites realmente estão e passa o
// valor — o cenário se adapta ao layout, e não o contrário. O layout tem
// restrições de legibilidade que o desenho de fundo não tem.
export function desenharCena(canvas, cenario, imagens, fracHorizonte = 0.42) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const L = canvas.width;
  const A = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, L, A);

  const id = String(cenario.id || "campo").toLowerCase();
  const [ceuTopo, ceuBase] = cenario.ceu || ["#161a22", "#343642"];
  const paleta = cenario.paleta || {};
  const [pisoHorizonte, pisoProfundo] = paleta.piso || ["#24272a", "#121316"];
  const [silhuetaDistante, silhuetaProxima] = paleta.silhueta || ["#20272a", "#0d1215"];
  const corNeblina = paleta.neblina || "#d2dce0";
  const rnd = ruido(semeteDe(id));
  const linhaHorizonte = Math.round(A * Math.min(0.55, Math.max(0.16, fracHorizonte)));
  const alturaChao = A - linhaHorizonte;

  // O cenário é deliberadamente amplo e silencioso. Ele comunica o bioma
  // com poucas massas grandes; personagens, efeitos e decisões continuam
  // sendo o foco visual mesmo quando o encontro tem dez combatentes.
  const ceu = ctx.createLinearGradient(0, 0, 0, linhaHorizonte + 1);
  ceu.addColorStop(0, ceuTopo);
  ceu.addColorStop(0.68, ceuBase);
  ceu.addColorStop(1, "rgba(18,21,27,1)");
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, L, linhaHorizonte + 2);

  const massa = (pontos, cor) => {
    ctx.beginPath();
    ctx.moveTo(0, linhaHorizonte + 2);
    pontos.forEach(([x, y]) => ctx.lineTo(x * L, linhaHorizonte - y * A));
    ctx.lineTo(L, linhaHorizonte + 2);
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
  };
  const elipse = (x, y, rx, ry, cor) => {
    ctx.beginPath();
    ctx.ellipse(x * L, y, rx * L, ry * A, 0, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
  };

  // Uma assinatura visual por terreno, construída com no máximo quatro
  // formas grandes. Não há repetição de árvores/pedras nem textura ruidosa.
  if (id.includes("mont") || id.includes("gelo") || id.includes("neve")) {
    massa([[0, .02], [.16, .24], [.31, .06], [.49, .31], [.68, .08], [.83, .25], [1, .03]], comAlpha(silhuetaDistante, .78));
    massa([[0, .01], [.24, .13], [.42, .04], [.64, .19], [.82, .03], [1, .1]], comAlpha(silhuetaProxima, .88));
  } else if (id.includes("flor") || id.includes("bosque")) {
    [[.09,.12,.08],[.29,.18,.11],[.73,.16,.12],[.91,.1,.07]].forEach(([x,h,r]) => {
      ctx.fillStyle = comAlpha(silhuetaProxima, .82);
      ctx.fillRect(x * L - L * .012, linhaHorizonte - h * A, L * .024, h * A);
      elipse(x, linhaHorizonte - h * A, r, .08, comAlpha(silhuetaDistante, .9));
    });
  } else if (id.includes("pant") || id.includes("lama")) {
    massa([[0,.01],[.2,.07],[.43,.025],[.7,.08],[1,.02]], comAlpha(silhuetaDistante, .86));
    ctx.strokeStyle = comAlpha(corNeblina, .42); ctx.lineWidth = Math.max(2, L / 420);
    for (let i = 0; i < 8; i += 1) {
      const x = (i + .5) * L / 8;
      ctx.beginPath(); ctx.moveTo(x, linhaHorizonte); ctx.lineTo(x + (i % 2 ? 5 : -5), linhaHorizonte - A * (.035 + rnd() * .04)); ctx.stroke();
    }
  } else if (id.includes("desert") || id.includes("areia")) {
    elipse(.25, linhaHorizonte + A * .08, .43, .16, comAlpha(silhuetaDistante, .62));
    elipse(.78, linhaHorizonte + A * .08, .5, .2, comAlpha(silhuetaProxima, .7));
  } else if (id.includes("cost") || id.includes("praia") || id.includes("agua")) {
    ctx.fillStyle = comAlpha(corNeblina, .18); ctx.fillRect(0, linhaHorizonte - 2, L, Math.max(8, alturaChao * .24));
    elipse(.13, linhaHorizonte + A * .02, .08, .035, comAlpha(silhuetaProxima, .82));
    elipse(.87, linhaHorizonte + A * .015, .11, .045, comAlpha(silhuetaProxima, .78));
  } else if (id.includes("ruin")) {
    ctx.fillStyle = comAlpha(silhuetaProxima, .82);
    ctx.fillRect(L * .08, linhaHorizonte - A * .2, L * .045, A * .2);
    ctx.fillRect(L * .84, linhaHorizonte - A * .26, L * .052, A * .26);
    ctx.fillRect(L * .075, linhaHorizonte - A * .21, L * .07, A * .022);
    ctx.fillRect(L * .825, linhaHorizonte - A * .27, L * .085, A * .022);
  } else if (id.includes("masm") || id.includes("dungeon") || id.includes("caver")) {
    ctx.fillStyle = comAlpha(silhuetaProxima, .8); ctx.fillRect(0, 0, L, linhaHorizonte);
    ctx.fillStyle = comAlpha(silhuetaDistante, .76);
    ctx.fillRect(L * .06, 0, L * .07, linhaHorizonte);
    ctx.fillRect(L * .87, 0, L * .07, linhaHorizonte);
  } else if (id.includes("vila") || id.includes("cidade")) {
    massa([[0,.01],[.12,.12],[.25,.01],[.39,.17],[.54,.01],[.7,.11],[.83,.01],[.94,.15],[1,.02]], comAlpha(silhuetaProxima, .84));
  } else {
    massa([[0,.02],[.2,.09],[.42,.025],[.65,.11],[.82,.04],[1,.08]], comAlpha(silhuetaDistante, .66));
  }

  // Piso em planos largos: ainda usa a paleta do terreno verdadeiro, mas
  // sem o mosaico de blocos que poluía a batalha.
  const chao = ctx.createLinearGradient(0, linhaHorizonte, 0, A);
  chao.addColorStop(0, pisoHorizonte);
  chao.addColorStop(.58, comAlpha(pisoHorizonte, .96));
  chao.addColorStop(1, pisoProfundo);
  ctx.fillStyle = chao;
  ctx.fillRect(0, linhaHorizonte, L, alturaChao);

  const tileset = imagens && imagens.tileset;
  const tilesetValido = !!(tileset && tileset.width >= 12 * TILE_SIZE);
  if (tilesetValido) {
    // Cinco manchas suaves do tile real dão continuidade ao mapa sem criar
    // uma parede de quadrados. O recorte é grande e quase transparente.
    ctx.save();
    ctx.globalAlpha = .13;
    const tam = Math.max(72, Math.round(L / 7));
    for (let i = 0; i < 5; i += 1) {
      const idx = i % 3 === 0 ? cenario.detalhe : cenario.chao;
      const x = Math.round((i - .25) * L / 4 + (rnd() - .5) * tam * .35);
      const y = Math.round(linhaHorizonte + alturaChao * (.08 + rnd() * .62));
      ctx.drawImage(tileset, idx * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x, y, tam, tam);
    }
    ctx.restore();
  }

  // Uma linha ambiental discreta reforça água, neve ou solo sem virar grade.
  ctx.save();
  ctx.strokeStyle = id.includes("cost") || id.includes("agua")
    ? "rgba(115,211,225,.18)" : "rgba(231,205,151,.075)";
  ctx.lineWidth = Math.max(1, L / 900);
  for (let i = 1; i <= 3; i += 1) {
    const y = linhaHorizonte + alturaChao * (i / 4);
    ctx.beginPath();
    ctx.moveTo(L * (.06 + i * .015), y);
    ctx.quadraticCurveTo(L * .5, y + (i % 2 ? 4 : -4), L * (.94 - i * .015), y);
    ctx.stroke();
  }
  ctx.restore();

  if (cenario.particula) {
    const cores = {
      folhas: ["#7ca15c", "#c09c55"], bolhas: ["#77a596", "#b8d5c7"],
      areia: ["#caa66b", "#ead092"], poeira: ["#b19b81", "#d6c5aa"],
      respingo: ["#6bbbd1", "#c0edf2"],
    };
    const paleta = cores[cenario.particula] || cores.poeira;
    for (let i = 0; i < 6; i += 1) {
      const x = Math.round(rnd() * L);
      const y = Math.round(linhaHorizonte * .2 + rnd() * A * .68);
      ctx.globalAlpha = .14 + rnd() * .18;
      ctx.fillStyle = paleta[i % paleta.length];
      ctx.fillRect(x, y, 2, cenario.particula === "respingo" ? 4 : 2);
    }
    ctx.globalAlpha = 1;
  }

  const nevoa = ctx.createLinearGradient(0, linhaHorizonte - A * .06, 0, linhaHorizonte + A * .12);
  nevoa.addColorStop(0, comAlpha(corNeblina, 0));
  nevoa.addColorStop(.5, comAlpha(corNeblina, .075));
  nevoa.addColorStop(1, comAlpha(corNeblina, 0));
  ctx.fillStyle = nevoa;
  ctx.fillRect(0, linhaHorizonte - A * .06, L, A * .18);

  // Vinheta curta: mantém os controles legíveis, mas não apaga o terreno.
  const vinheta = ctx.createRadialGradient(L / 2, A * .53, Math.min(L, A) * .34, L / 2, A * .53, Math.max(L, A) * .7);
  vinheta.addColorStop(0, "rgba(0,0,0,0)");
  vinheta.addColorStop(1, "rgba(0,0,0,.3)");
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, L, A);
}

function criarSlots(fileiraEl, quantidade, prefixo) {
  const slots = [];
  for (let i = 0; i < quantidade; i += 1) {
    const slot = document.createElement("div");
    slot.className = "bt-slot";
    slot.id = `${prefixo}_${i}`;
    slot.dataset.slot = String(i);
    slot.dataset.ocupado = "0";
    fileiraEl.appendChild(slot);
    slots.push(slot);
  }
  return slots;
}

// Monta o esqueleto UMA vez por batalha e devolve as referências. A partir
// daqui a BattleUI só troca conteúdo dentro dos lugares que este objeto
// entrega — nunca recria o esqueleto.
export function montarPalco(screenEl, { cenario, imagens, autoAtivo = false } = {}) {
  screenEl.className = "tela bt-screen";
  screenEl.classList.remove("hidden");
  screenEl.dataset.cenario = cenario ? cenario.id : "";
  screenEl.innerHTML = `
    <header class="bt-header" id="bt-header">
      <div class="bt-header-local">
        <span class="bt-header-nome" id="bt-nome-local"></span>
        <span class="bt-header-desc" id="bt-desc-local"></span>
      </div>
      <div class="bt-header-mods" id="bt-mods" role="list"></div>
      <div class="bt-header-acoes">
        <button id="btn-auto-batalha" class="${autoAtivo ? "ativo" : ""}" title="Liga/desliga o modo automático (mesmo do botão Automático fora do combate)">${autoAtivo ? "⏸ Auto" : "▶ Auto"}</button>
        <button id="btn-config-ia" title="Configura como a IA do modo automático decide (modo, cura, alvos, combos)">⚙️</button>
      </div>
    </header>

    <div class="bt-field" id="bt-field">
      <canvas class="bt-cena" id="bt-cena"></canvas>
      <div class="bt-overlays" id="bt-overlays"></div>
      <div class="bt-row bt-row-inimigos" id="bt-row-inimigos"></div>
      <div class="bt-row bt-row-herois" id="bt-row-herois"></div>
      <!-- PISTA DE ANÚNCIOS: terra reservada no meio do campo, entre as duas
           fileiras. O dado, os letreiros de revelação e as faixas curtas
           moram aqui e nada mais é desenhado neste espaço — é o que faz o
           combate parar de empilhar coisa em cima de personagem. Altura em
           batalha-layout.css (--anuncio-alt). -->
      <div class="bt-pista-anuncios" id="bt-pista"></div>
      <div class="fx-layer" id="bt-fx"></div>
      <div class="dado-layer" id="bt-dado"></div>
    </div>

    <div class="bt-infobar" id="bt-infobar">
      <div class="bt-timeline" id="bt-timeline" aria-label="Ordem de turno"></div>
      <div class="bt-legenda-acao" id="bt-legenda-acao" aria-label="Ação em andamento"></div>
      <button class="bt-log-toggle" id="bt-log-toggle" aria-expanded="false" title="Abrir/fechar o registro de combate">
        <span class="bt-log-ultima" id="bt-log-ultima"></span>
        <span class="bt-log-seta" aria-hidden="true">⌃</span>
      </button>
      <div class="bt-log-panel" id="bt-log-panel" hidden>
        <div class="bt-log-lista" id="batalha-log"></div>
      </div>
    </div>

    <div class="bt-dock" id="batalha-acoes"></div>
  `;

  const campoEl = screenEl.querySelector("#bt-field");
  const cenaCanvas = screenEl.querySelector("#bt-cena");
  const fileiraInimigos = screenEl.querySelector("#bt-row-inimigos");
  const fileiraHerois = screenEl.querySelector("#bt-row-herois");
  const logPanel = screenEl.querySelector("#bt-log-panel");
  const logToggle = screenEl.querySelector("#bt-log-toggle");

  const slotsInimigos = criarSlots(fileiraInimigos, MAX_SLOTS_INIMIGO, "MONSTER_SLOT");
  const slotsHerois = criarSlots(fileiraHerois, MAX_SLOTS_HEROI, "HERO_SLOT");

  // A cena é redesenhada só quando o CAMPO muda de tamanho — nunca a cada
  // tick. ResizeObserver em vez de listener de window porque o campo pode
  // mudar de altura por causa da barra de endereço do celular sem a janela
  // disparar resize.
  // ONDE FICA A LINHA DO CHÃO.
  //
  // Mede a base do sprite do inimigo mais baixo e põe o horizonte um pouco
  // acima dela — assim os inimigos ficam com os pés no chão desenhado, no
  // fundo da cena, e os heróis mais à frente. Antes disso o horizonte era
  // 42% fixo e os inimigos eram desenhados no céu.
  //
  // Enquanto não houver card na tela (primeiro desenho), usa 0,30: um valor
  // que já deixa a fileira de inimigos em terra firme no caso comum. Assim o
  // primeiro quadro nunca sai errado, mesmo que a medição só venha depois.
  const FRAC_PADRAO = 0.30;
  const medirHorizonte = () => {
    const r = campoEl.getBoundingClientRect();
    if (!r.height) return FRAC_PADRAO;
    const sprites = [...fileiraInimigos.querySelectorAll(".sprite-wrap")];
    if (!sprites.length) return FRAC_PADRAO;
    const base = Math.max(...sprites.map((el) => el.getBoundingClientRect().bottom));
    if (!Number.isFinite(base) || base <= r.top) return FRAC_PADRAO;
    // 26px acima dos pés: o bastante para o sprite pisar no chão em vez de
    // nascer exatamente na emenda entre o céu e o solo.
    return (base - 26 - r.top) / r.height;
  };

  let ultimoTamanho = "";
  const redesenharCena = (forcar = false) => {
    const r = campoEl.getBoundingClientRect();
    const L = Math.max(1, Math.round(r.width));
    const A = Math.max(1, Math.round(r.height));
    const frac = medirHorizonte();
    // A chave inclui o horizonte arredondado: o tamanho do campo pode não
    // mudar e mesmo assim a linha do chão mudar (a primeira leva entra, os
    // cards aparecem, os sprites passam a existir).
    const chave = `${L}x${A}@${Math.round(frac * 200)}`;
    if (chave === ultimoTamanho && !forcar) return;
    ultimoTamanho = chave;
    cenaCanvas.width = L;
    cenaCanvas.height = A;
    // Publicada para o CSS: a sombra de chão e o degradê de profundidade das
    // fileiras se ancoram nela (ver batalha-layout.css).
    campoEl.style.setProperty("--horizonte", `${Math.round(A * frac)}px`);
    if (cenario) desenharCena(cenaCanvas, cenario, imagens, frac);
  };
  const observador = typeof ResizeObserver !== "undefined" ? new ResizeObserver(redesenharCena) : null;
  if (observador) observador.observe(campoEl);
  redesenharCena();

  // Log: o painel é ABSOLUTO, ancorado acima da barra. Abrir e fechar nunca
  // muda a altura de nada — era exatamente o que o <details> antigo fazia.
  let logAberto = false;
  const alternarLog = (forcar) => {
    logAberto = typeof forcar === "boolean" ? forcar : !logAberto;
    logPanel.hidden = !logAberto;
    logToggle.setAttribute("aria-expanded", String(logAberto));
    logToggle.classList.toggle("aberto", logAberto);
    screenEl.classList.toggle("log-aberto", logAberto);
  };
  logToggle.onclick = () => alternarLog();

  return {
    screenEl,
    headerEl: screenEl.querySelector("#bt-header"),
    nomeLocalEl: screenEl.querySelector("#bt-nome-local"),
    descLocalEl: screenEl.querySelector("#bt-desc-local"),
    modsEl: screenEl.querySelector("#bt-mods"),
    campoEl,
    cenaCanvas,
    overlaysEl: screenEl.querySelector("#bt-overlays"),
    slotsInimigos,
    slotsHerois,
    fxLayer: screenEl.querySelector("#bt-fx"),
    dadoLayer: screenEl.querySelector("#bt-dado"),
    pistaEl: screenEl.querySelector("#bt-pista"),
    // A BattleUI chama isto depois do primeiro render dos cards: só então os
    // sprites existem e a linha do chão pode ser medida de verdade.
    redesenharCena: () => redesenharCena(true),
    timelineEl: screenEl.querySelector("#bt-timeline"),
    logListaEl: screenEl.querySelector("#batalha-log"),
    logUltimaEl: screenEl.querySelector("#bt-log-ultima"),
    dockEl: screenEl.querySelector("#batalha-acoes"),
    alternarLog,
    logEstaAberto: () => logAberto,
    redesenharCena,
    destruir() {
      if (observador) observador.disconnect();
    },
  };
}

// Preenche o cabeçalho do terreno. Chamado uma vez por batalha (o cenário
// não muda no meio) e de novo se o clima virar.
export function pintarCabecalho(palco, cenario) {
  if (!palco || !cenario) return;
  const clima = cenario.clima ? ` · ${cenario.clima.icone} ${cenario.clima.nome}` : "";
  palco.nomeLocalEl.textContent = `${cenario.iconeTerreno || "🗺️"} ${cenario.nome}${clima}`;
  palco.nomeLocalEl.title = `${cenario.nome} — ${cenario.subtitulo}`;
  palco.descLocalEl.textContent = cenario.descricao || "";
  // Acessibilidade: o sinal (▲ ▼ —) carrega a informação, a cor só reforça.
  const SINAL = { "+": "▲", "-": "▼", "=": "—" };
  const CLASSE = { "+": "bonus", "-": "penalidade", "=": "neutro" };
  palco.modsEl.innerHTML = cenario.modificadores
    .map((m) => `<span class="bt-mod bt-mod-${CLASSE[m.sinal]}" role="listitem" title="${(m.detalhe || "").replace(/"/g, "&quot;")}"><b aria-hidden="true">${SINAL[m.sinal]}</b> ${m.texto}</span>`)
    .join("");
}
