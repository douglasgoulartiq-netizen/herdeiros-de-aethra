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

  const [ceuTopo, ceuBase] = cenario.ceu || ["#161616", "#2a2a2a"];
  const grad = ctx.createLinearGradient(0, 0, 0, A);
  grad.addColorStop(0, ceuTopo);
  grad.addColorStop(1, ceuBase);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, L, A);

  const tileset = imagens && imagens.tileset;
  const rnd = ruido(semeteDe(cenario.id));
  // Tiles maiores em telas grandes: o campo tem que parecer cenário, não
  // mosaico. Piso de 48px pra não virar pontilhado no celular.
  const t = Math.max(48, Math.round(L / 18));
  // Limitado a uma faixa sã: um horizonte colado no topo não deixa céu, e um
  // colado na base não deixa chão.
  const linhaHorizonte = Math.round(A * Math.min(0.55, Math.max(0.12, fracHorizonte)));

  // Direção de arte: foco luminoso e relevo em dois planos. As formas são
  // determinísticas por bioma e ficam atrás dos tiles, acrescentando escala
  // sem competir com os personagens ou exigir imagens extras pesadas.
  const luzX = Math.round(L * (0.22 + rnd() * 0.56));
  const luzY = Math.round(A * 0.15);
  const luzR = Math.max(18, Math.round(Math.min(L, A) * 0.075));
  const halo = ctx.createRadialGradient(luzX, luzY, 0, luzX, luzY, luzR * 3.2);
  halo.addColorStop(0, "rgba(255,226,166,.28)");
  halo.addColorStop(0.3, "rgba(245,165,36,.11)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo; ctx.fillRect(0, 0, L, linhaHorizonte);
  ctx.fillStyle = "rgba(255,226,166,.22)";
  ctx.beginPath(); ctx.arc(luzX, luzY, luzR, 0, Math.PI * 2); ctx.fill();

  const desenharRelevo = (baseY, amplitude, passo, cor) => {
    ctx.beginPath(); ctx.moveTo(0, baseY);
    for (let x = 0; x <= L + passo; x += passo) {
      ctx.lineTo(x + passo * 0.5, baseY - amplitude * (0.35 + rnd() * 0.65));
      ctx.lineTo(x + passo, baseY);
    }
    ctx.lineTo(L, linhaHorizonte + 8); ctx.lineTo(0, linhaHorizonte + 8); ctx.closePath();
    ctx.fillStyle = cor; ctx.fill();
  };
  desenharRelevo(linhaHorizonte - 16, Math.max(16, A * 0.12), Math.max(70, L / 8), "rgba(8,9,13,.28)");
  desenharRelevo(linhaHorizonte - 5, Math.max(12, A * 0.08), Math.max(52, L / 11), "rgba(5,7,9,.48)");

  // O tileset é uma tira horizontal de 12 tiles de 64px. Se o arquivo não
  // carregou, `carregarImagem` devolve um placeholder de 32x32 (ver
  // loader.js) — desenhar recortes de 64px dele encheria o campo de
  // quadradinhos vazios. Melhor detectar e cair no chão liso.
  const tilesetValido = !!(tileset && tileset.width >= 12 * TILE_SIZE);
  const desenharTile = (idx, x, y, tam) => {
    if (!tilesetValido) return false;
    ctx.drawImage(tileset, idx * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x, y, tam, tam);
    return true;
  };

  // --- vegetação/pedra distante, escurecida para virar silhueta ---------
  ctx.save();
  ctx.globalAlpha = 0.55;
  const decor = cenario.decor && cenario.decor.length ? cenario.decor : [];
  if (decor.length) {
    const tamD = Math.round(t * 0.8);
    for (let x = -tamD; x < L + tamD; x += Math.round(tamD * 0.9)) {
      const idx = decor[Math.floor(rnd() * decor.length)];
      const y = linhaHorizonte - tamD + Math.round(rnd() * 6);
      desenharTile(idx, x, y, tamD);
    }
  }
  ctx.restore();
  // Véu escuro sobre a faixa distante: dá profundidade e garante contraste
  // pros sprites e pra HUD por cima (requisito de legibilidade).
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.fillRect(0, 0, L, linhaHorizonte);

  // --- chão -------------------------------------------------------------
  for (let y = linhaHorizonte; y < A; y += t) {
    for (let x = 0; x < L; x += t) {
      const usaDetalhe = rnd() < 0.18;
      const idx = usaDetalhe ? cenario.detalhe : cenario.chao;
      if (!desenharTile(idx, x, y, t)) {
        // Sem tileset (publicação sem assets): pinta o chão liso em vez de
        // deixar buraco. O jogo continua jogável, só menos bonito.
        ctx.fillStyle = usaDetalhe ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.14)";
        ctx.fillRect(x, y, t, t);
      }
    }
  }

  // Grade de perspectiva sutil: conecta as sombras dos combatentes ao plano
  // do chão e deixa claro quem está à frente e quem está ao fundo.
  ctx.save();
  ctx.strokeStyle = "rgba(244,205,133,.07)"; ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i += 1) {
    ctx.beginPath(); ctx.moveTo(L / 2, linhaHorizonte); ctx.lineTo(L / 2 + i * L * 0.12, A); ctx.stroke();
  }
  for (let i = 1; i <= 5; i += 1) {
    const p = i / 5; const y = linhaHorizonte + (A - linhaHorizonte) * p * p;
    ctx.globalAlpha = p * 0.7; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L, y); ctx.stroke();
  }
  ctx.restore();

  if (cenario.particula) {
    const cores = {
      folhas: ["#6d9d51", "#a38d46"], bolhas: ["#6f9b88", "#bad7c2"],
      areia: ["#c79c57", "#e1c27b"], poeira: ["#a28d75", "#d0bd9e"],
      respingo: ["#68b7cf", "#b9e7ef"],
    };
    const paleta = cores[cenario.particula] || cores.poeira;
    for (let i = 0; i < 18; i += 1) {
      const x = Math.round(rnd() * L); const y = Math.round(linhaHorizonte * 0.25 + rnd() * A * 0.65);
      const s = rnd() > 0.76 ? 3 : 2;
      ctx.globalAlpha = 0.18 + rnd() * 0.28; ctx.fillStyle = paleta[i % paleta.length];
      ctx.fillRect(x, y, s, cenario.particula === "respingo" ? s + 2 : s);
    }
    ctx.globalAlpha = 1;
  }

  // Junção céu/chão suavizada e escurecimento progressivo pro fundo do
  // campo — ancora os sprites e evita "sprite flutuando".
  const sombraChao = ctx.createLinearGradient(0, linhaHorizonte - t * 0.5, 0, A);
  sombraChao.addColorStop(0, "rgba(0,0,0,0.38)");
  sombraChao.addColorStop(0.35, "rgba(0,0,0,0.02)");
  sombraChao.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = sombraChao;
  ctx.fillRect(0, linhaHorizonte - t * 0.5, L, A - linhaHorizonte + t * 0.5);

  // Vinheta: escurece as bordas pra HUD encostar sem competir com o centro.
  const vinheta = ctx.createRadialGradient(L / 2, A * 0.55, Math.min(L, A) * 0.25, L / 2, A * 0.55, Math.max(L, A) * 0.75);
  vinheta.addColorStop(0, "rgba(0,0,0,0)");
  vinheta.addColorStop(1, "rgba(0,0,0,0.45)");
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
