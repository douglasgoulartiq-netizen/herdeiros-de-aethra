// MAPA-MÚNDI INTERATIVO — o "macro" do pedido, com dois níveis de leitura e
// os níveis recomendados de cada região.
//
// O QUE ELE SUBSTITUI. O Atlas antigo era uma pintura (assets/lore/
// mapa_mundi.jpg) com 17 bolinhas por cima, posicionadas à mão em
// porcentagem. Três limitações, todas de fundo:
//   1. a pintura não é o mundo jogável — as bolinhas estavam onde o artista
//      pôs a região no quadro, não onde a zona fica nos 224x176 tiles em que
//      se anda;
//   2. não mostrava NÍVEL nenhum, apesar de `perigo: [min,max]` existir em
//      todas as 48 zonas desde sempre;
//   3. não tinha névoa: o mapa inteiro aparecia igual para quem tinha acabado
//      de sair da vila e para quem tinha explorado o mundo.
//
// Este mapa é desenhado a partir do mapa de posse REAL (WorldLayout), então
// cada região está exatamente onde se caminha até ela. O Atlas pintado
// continua existindo e não foi tocado — são coisas diferentes: aquele é uma
// peça de lore, este é um instrumento.
//
// DOIS MODOS, que é o "macro e micro":
//   • REGIÕES — as 17 macro-regiões, cada uma de uma cor, com nome e faixa de
//     nível. É o mapa de "para onde eu vou agora".
//   • ZONAS — as 48 zonas, tonalizadas dentro da cor da região-mãe. É o mapa
//     de "o que tem dentro daqui".
//
// INTERATIVO: passar o mouse destaca e mostra o nome; clicar abre o painel
// com descrição, nível, ameaça relativa ao SEU nível, monstros e o botão de
// viagem rápida quando a zona já foi visitada.
import { abrirModalBase, fecharModal } from "./GameUI.js";
import { LARGURA } from "./HdaUI.js";
import { zonaFoiVisitada } from "../systems/FastTravelSystem.js";
import { LABEL_NEVOA, estadoDaZona } from "../systems/FogOfWarSystem.js";
import {
  zonasDoMundo, macrosDoMundo, bitmapDoMundo, bitmapDaNevoa, DIM_MUNDO,
  visibilidadeDaZona, visibilidadeDaMacro, VISIBILIDADE, ameacaRelativa,
  exploracaoDoMundo, corDaMacro,
} from "../systems/MapaSystem.js";

const MODO = { REGIOES: "macro", ZONAS: "zonas" };

export function montarMapaMundo(personagem, contexto = {}) {
  // `cheia` é a largura reservada em HdaUI para mapas e árvores — o mapa
  // precisa de todo pixel que a janela puder dar.
  const corpo = abrirModalBase("🗺️ Mapa de Aethra", { largura: LARGURA.cheia });
  const expl = exploracaoDoMundo(personagem);

  corpo.innerHTML = `
    <div class="mapa-barra">
      <div class="mapa-modos" role="tablist">
        <button type="button" class="mapa-modo ativo" data-modo="${MODO.REGIOES}" role="tab">Regiões</button>
        <button type="button" class="mapa-modo" data-modo="${MODO.ZONAS}" role="tab">Zonas</button>
      </div>
      <div class="mapa-explorado" title="Porcentagem do território já descoberto">
        Explorado: <b>${expl.pct}%</b> <span class="mapa-explorado-det">(${expl.zonasAbertas}/${expl.totalZonas} zonas)</span>
      </div>
    </div>
    <div class="mapa-corpo">
      <div class="mapa-tela">
        <canvas class="mapa-canvas"></canvas>
        <div class="mapa-rotulos"></div>
        <div class="mapa-dica hidden"></div>
      </div>
      <aside class="mapa-painel"></aside>
    </div>
    <p class="mapa-legenda">
      <span><i class="mapa-pino-voce"></i> você</span>
      <span><i class="mapa-chip-visitado"></i> descoberto</span>
      <span><i class="mapa-chip-rumor"></i> rumor</span>
      <span><i class="mapa-chip-oculto"></i> desconhecido</span>
    </p>`;

  const tela = corpo.querySelector(".mapa-tela");
  const canvas = corpo.querySelector(".mapa-canvas");
  const rotulos = corpo.querySelector(".mapa-rotulos");
  const dica = corpo.querySelector(".mapa-dica");
  const painel = corpo.querySelector(".mapa-painel");

  const ctx = canvas.getContext("2d");
  const zonas = zonasDoMundo();
  const macros = macrosDoMundo();

  let modo = MODO.REGIOES;
  let selecionado = null;
  let escala = 1;

  // O canvas acompanha a largura disponível mantendo a proporção do mundo
  // (224x176). Redesenhar no resize é o que faz o mapa servir tanto numa
  // janela de 1440 quanto num celular de 390.
  function dimensionar() {
    // A escala é limitada pelos DOIS eixos: um canvas que caiba na largura
    // mas não na altura obriga a rolar o modal para ver o sul do mundo, que é
    // exatamente o que um mapa não pode pedir. `disponivelY` desconta a barra
    // de modos, a legenda e o cromo do modal.
    const larg = Math.max(260, Math.min(tela.clientWidth || 640, 1100));
    const disponivelY = Math.max(220, (window.innerHeight || 800) - 260);
    escala = Math.min(larg / DIM_MUNDO.largura, disponivelY / DIM_MUNDO.altura);
    canvas.width = Math.round(DIM_MUNDO.largura * escala);
    canvas.height = Math.round(DIM_MUNDO.altura * escala);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    rotulos.style.width = `${canvas.width}px`;
    rotulos.style.height = `${canvas.height}px`;
  }

  function desenhar() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmapDoMundo(modo), 0, 0, canvas.width, canvas.height);
    // A névoa vai por cima das cores: o território existe, o conhecimento é
    // que é parcial.
    ctx.drawImage(bitmapDaNevoa(personagem), 0, 0, canvas.width, canvas.height);

    desenharPontos();
    if (selecionado) contornar(selecionado);
    desenharVoce();
    montarRotulos();
  }

  // Um ponto no centro de massa de cada lugar nomeado. Existe por causa do
  // des-empilhamento: um rótulo que precisou subir 30px para não colidir
  // deixaria de apontar para nada, e pareceria nomear a mancha vizinha. Com o
  // ponto desenhado no lugar certo, o nome é uma legenda do ponto — que é
  // como um atlas de verdade resolve o mesmo problema.
  function desenharPontos() {
    const itens = modo === MODO.REGIOES
      ? macros.map((m) => ({ ref: m, vis: visibilidadeDaMacro(personagem, m.id) }))
      : zonas.map((z) => ({ ref: z, vis: visibilidadeDaZona(personagem, z.id) }));
    ctx.save();
    itens.forEach(({ ref, vis }) => {
      if (vis === VISIBILIDADE.OCULTA) return;
      const x = ref.centro.x * escala, y = ref.centro.y * escala;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = vis === VISIBILIDADE.INSINUADA ? "rgba(241,233,216,0.5)" : "rgba(241,233,216,0.92)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.stroke();
    });
    ctx.restore();
  }

  // Contorno do que está selecionado, desenhado a partir da caixa real da
  // zona (ou da união das caixas das zonas da região).
  function contornar(alvo) {
    const caixa = alvo.tipo === "macro" ? caixaDaMacro(alvo.ref) : alvo.ref.caixa;
    ctx.save();
    ctx.strokeStyle = "#f5a524";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(
      caixa.x0 * escala, caixa.y0 * escala,
      (caixa.x1 - caixa.x0 + 1) * escala, (caixa.y1 - caixa.y0 + 1) * escala,
    );
    ctx.restore();
  }

  function caixaDaMacro(macro) {
    return macro.zonas.reduce((acc, z) => ({
      x0: Math.min(acc.x0, z.caixa.x0), y0: Math.min(acc.y0, z.caixa.y0),
      x1: Math.max(acc.x1, z.caixa.x1), y1: Math.max(acc.y1, z.caixa.y1),
    }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  }

  function desenharVoce() {
    const p = contexto.jogador;
    if (!p || contexto.mapaAtual !== "overworld") return;
    const x = p.x * escala, y = p.y * escala;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(245,165,36,0.28)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = "#f5a524"; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = "#2a1c08"; ctx.stroke();
    ctx.restore();
  }

  // Os rótulos são elementos HTML por cima do canvas, não texto desenhado:
  // assim herdam a fonte do jogo, respeitam o tamanho de fonte da
  // Acessibilidade e podem receber clique e foco de teclado.
  function montarRotulos() {
    rotulos.innerHTML = "";
    const itens = modo === MODO.REGIOES
      ? macros.map((m) => ({ tipo: "macro", ref: m, vis: visibilidadeDaMacro(personagem, m.id) }))
      : zonas.map((z) => ({ tipo: "zona", ref: z, vis: visibilidadeDaZona(personagem, z.id) }));

    itens.forEach((item) => {
      if (item.vis === VISIBILIDADE.OCULTA) return;   // não se rotula o que não se conhece
      const r = item.ref;
      const el = document.createElement("button");
      el.type = "button";
      const px = (r.centro.x / DIM_MUNDO.largura) * 100;
      const py = (r.centro.y / DIM_MUNDO.altura) * 100;
      // Um rótulo centrado no seu ponto vaza para fora do mapa quando a
      // região é colada na borda — "Montanhas Infernais de Vulkor" no oeste
      // some metade. Perto da borda ele deixa de ser centrado e passa a se
      // encostar nela por dentro. O ponto continua sendo o mesmo; só a âncora
      // do texto muda.
      const borda = px < 14 ? "esq" : px > 86 ? "dir" : "";
      const bordaY = py < 8 ? "topo" : py > 92 ? "base" : "";
      el.className = `mapa-rotulo ${borda ? `na-${borda}` : ""} ${bordaY ? `na-${bordaY}` : ""} ${item.vis === VISIBILIDADE.INSINUADA ? "rumor" : ""} ${selecionado && selecionado.ref.id === r.id ? "ativo" : ""}`;
      el.style.left = `${px}%`;
      el.style.top = `${py}%`;

      const nivel = r.nivel ? r.nivel.texto : "";
      const ameaca = item.tipo === "zona" ? ameacaRelativa(r, personagem.nivel) : ameacaRelativa({ perigo: r.nivel ? [r.nivel.min, r.nivel.max] : null }, personagem.nivel);
      el.innerHTML = `<span class="mapa-rotulo-nome">${r.nome}</span>${nivel ? `<span class="mapa-rotulo-nivel" style="color:${ameaca.cor}">${nivel}</span>` : ""}`;
      el.onclick = () => selecionar(item);
      el.onmouseenter = () => mostrarDica(el, r, item);
      el.onmouseleave = () => dica.classList.add("hidden");
      rotulos.appendChild(el);
    });
    // Medir exige que os rótulos já estejam no DOM e o layout, resolvido.
    requestAnimationFrame(desempilhar);
  }

  // DES-EMPILHAMENTO. Quarenta e oito rótulos ancorados no centro de massa da
  // sua zona colidem: "Cratera do Primeiro Fogo" cai em cima de "Mina
  // Carmesim" e as duas ficam ilegíveis. Em vez de esconder rótulos (que é
  // esconder justamente o nível que o jogador veio ver), cada par que se
  // sobrepõe é afastado na vertical, metade para cada lado, até se separarem.
  //
  // Só na vertical, e com teto: um rótulo que se afasta demais do seu
  // território deixa de nomeá-lo. Preso a 34px, ele fica visivelmente ligado à
  // mancha de cor de onde saiu — e a mancha continua clicável, porque o
  // clique no território é do canvas, não do rótulo.
  const DESLOCAMENTO_MAX = 34;
  function desempilhar() {
    const els = [...rotulos.children];
    if (els.length < 2) return;
    const base = rotulos.getBoundingClientRect();
    const itens = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x0: r.left - base.left, x1: r.right - base.left, y0: r.top - base.top, y1: r.bottom - base.top, dy: 0 };
    });

    for (let iter = 0; iter < 14; iter += 1) {
      let mexeu = false;
      for (let i = 0; i < itens.length; i += 1) {
        for (let j = i + 1; j < itens.length; j += 1) {
          const a = itens[i], b = itens[j];
          const sobrepoeX = a.x0 < b.x1 + 2 && b.x0 < a.x1 + 2;
          if (!sobrepoeX) continue;
          const ay0 = a.y0 + a.dy, ay1 = a.y1 + a.dy;
          const by0 = b.y0 + b.dy, by1 = b.y1 + b.dy;
          if (ay0 >= by1 + 1 || by0 >= ay1 + 1) continue;
          // Empurra quem está mais acima para cima, e o outro para baixo.
          const empurrao = (Math.min(ay1, by1) - Math.max(ay0, by0)) / 2 + 1;
          const acima = ay0 + ay1 < by0 + by1 ? a : b;
          const abaixo = acima === a ? b : a;
          acima.dy -= empurrao;
          abaixo.dy += empurrao;
          mexeu = true;
        }
      }
      if (!mexeu) break;
    }

    itens.forEach((it) => {
      const dy = Math.max(-DESLOCAMENTO_MAX, Math.min(DESLOCAMENTO_MAX, it.dy));
      it.el.style.marginTop = dy ? `${Math.round(dy)}px` : "";
      it.el.classList.toggle("deslocado", Math.abs(dy) > 6);
    });
  }

  function mostrarDica(el, r, item) {
    const n = r.nivel ? r.nivel.texto : "nível desconhecido";
    const a = item.tipo === "zona" ? ameacaRelativa(r, personagem.nivel) : null;
    dica.innerHTML = `<b>${r.nome}</b><br>${n}${a && a.rotulo ? ` · <span style="color:${a.cor}">${a.rotulo}</span>` : ""}`;
    dica.classList.remove("hidden");
    dica.style.left = el.style.left;
    dica.style.top = el.style.top;
  }

  // Clicar no próprio mapa seleciona pela POSSE do tile — é o que faz um mapa
  // parecer um mapa: você aponta para o território, não para o rótulo.
  canvas.onclick = (ev) => {
    const caixa = canvas.getBoundingClientRect();
    const tx = Math.floor((ev.clientX - caixa.left) / escala);
    const ty = Math.floor((ev.clientY - caixa.top) / escala);
    const zona = zonaNoTile(tx, ty);
    if (!zona) return;
    if (visibilidadeDaZona(personagem, zona.id) === VISIBILIDADE.OCULTA) {
      painel.innerHTML = `<p class="mapa-vazio">Território desconhecido. Você ainda não esteve aqui, e ninguém te contou o que há.</p>`;
      return;
    }
    if (modo === MODO.REGIOES) {
      const macro = macros.find((m) => m.id === zona.macroId);
      if (macro) selecionar({ tipo: "macro", ref: macro, vis: visibilidadeDaMacro(personagem, macro.id) });
    } else {
      selecionar({ tipo: "zona", ref: zona, vis: visibilidadeDaZona(personagem, zona.id) });
    }
  };

  function zonaNoTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= DIM_MUNDO.largura || ty >= DIM_MUNDO.altura) return null;
    // Reaproveita o bitmap já pintado por zona: ler um pixel é mais barato do
    // que reimportar o mapa de posse aqui só para uma consulta.
    const idx = indicePorPixel(tx, ty);
    return idx == null ? null : zonas[idx] || null;
  }

  // Índice da zona dona do tile, pela cor do bitmap de zonas. As 48 cores são
  // distintas por construção (ver MapaSystem: cor da macro + variação por
  // irmã), então a correspondência é exata.
  let indicePorCor = null;
  function indicePorPixel(tx, ty) {
    if (!indicePorCor) {
      indicePorCor = new Map();
      zonas.forEach((z, i) => indicePorCor.set(z.cor.toLowerCase(), i));
    }
    const bm = bitmapDoMundo(MODO.ZONAS);
    const d = bm.getContext("2d").getImageData(tx, ty, 1, 1).data;
    const hex = `#${((d[0] << 16) | (d[1] << 8) | d[2]).toString(16).padStart(6, "0")}`;
    return indicePorCor.has(hex) ? indicePorCor.get(hex) : null;
  }

  function selecionar(item) {
    selecionado = item;
    desenhar();
    painel.innerHTML = "";
    painel.appendChild(item.tipo === "macro" ? painelDaMacro(item.ref) : painelDaZona(item.ref));
  }

  function painelDaMacro(m) {
    const div = document.createElement("div");
    const vis = visibilidadeDaMacro(personagem, m.id);
    const ameaca = ameacaRelativa({ perigo: m.nivel ? [m.nivel.min, m.nivel.max] : null }, personagem.nivel);
    div.innerHTML = `
      <div class="mapa-cab" style="border-color:${m.cor}">
        <h3>${m.nome}</h3>
        ${m.nomeMapa && m.nomeMapa !== m.nome ? `<p class="mapa-sub">${m.nomeMapa}${m.subtitulo ? ` · ${m.subtitulo}` : ""}</p>` : (m.subtitulo ? `<p class="mapa-sub">${m.subtitulo}</p>` : "")}
        ${m.nivel ? `<p class="mapa-nivel" style="color:${ameaca.cor}">${m.nivel.texto} — ${ameaca.rotulo || "—"} <span class="mapa-nivel-voce">(você: nível ${personagem.nivel})</span></p>` : ""}
      </div>
      ${vis === VISIBILIDADE.ABERTA && m.descricao ? `<p class="mapa-desc">${m.descricao}</p>` : `<p class="mapa-desc mapa-rumor-txt">Você conhece esta região de ouvir falar. Explore-a para saber o que há nela.</p>`}
      <h4 class="mapa-h4">Zonas (${m.zonas.length})</h4>
      <ul class="mapa-lista"></ul>`;
    const ul = div.querySelector(".mapa-lista");
    m.zonas.forEach((z) => {
      const v = visibilidadeDaZona(personagem, z.id);
      const a = ameacaRelativa(z, personagem.nivel);
      const li = document.createElement("li");
      if (v === VISIBILIDADE.OCULTA) {
        li.className = "mapa-item oculto";
        li.innerHTML = `<span class="mapa-item-nome">— não descoberta —</span>`;
      } else {
        li.className = "mapa-item";
        li.innerHTML = `<button type="button" class="mapa-item-btn">
            <span class="mapa-item-nome">${z.nome}</span>
            <span class="mapa-item-nivel" style="color:${a.cor}">${z.nivel ? z.nivel.texto : ""}</span>
          </button>`;
        li.querySelector("button").onclick = () => {
          modo = MODO.ZONAS;
          corpo.querySelectorAll(".mapa-modo").forEach((b) => b.classList.toggle("ativo", b.dataset.modo === MODO.ZONAS));
          selecionar({ tipo: "zona", ref: z, vis: v });
        };
      }
      ul.appendChild(li);
    });
    return div;
  }

  function painelDaZona(z) {
    const div = document.createElement("div");
    const vis = visibilidadeDaZona(personagem, z.id);
    const a = ameacaRelativa(z, personagem.nivel);
    const visitada = zonaFoiVisitada(personagem, z.id);
    const aqui = contexto.zonaAtualId === z.id;

    div.innerHTML = `
      <div class="mapa-cab" style="border-color:${z.cor}">
        <p class="mapa-trilha">${z.macroNome}</p>
        <h3>${z.nome}</h3>
        ${z.nivel ? `<p class="mapa-nivel" style="color:${a.cor}">${z.nivel.texto}${a.rotulo ? ` — ${a.rotulo}` : ""}</p>` : ""}
        <p class="mapa-estado">${LABEL_NEVOA[estadoDaZona(personagem, z.id)] || "Desconhecido"}</p>
      </div>
      ${vis === VISIBILIDADE.ABERTA
        ? `<p class="mapa-desc">${z.descricao || ""}</p>
           <dl class="mapa-fichas">
             <div><dt>Bioma</dt><dd>${z.bioma || "—"}</dd></div>
             <div><dt>Clima</dt><dd>${z.clima || "—"}</dd></div>
             ${z.elementoDominante ? `<div><dt>Elemento</dt><dd>${z.elementoDominante}</dd></div>` : ""}
             ${(z.recursos || []).length ? `<div><dt>Recursos</dt><dd>${z.recursos.join(", ")}</dd></div>` : ""}
           </dl>
           ${(z.monstros || []).length ? `<h4 class="mapa-h4">Criaturas</h4><p class="mapa-desc mapa-monstros">${z.monstros.map((x) => x.replace(/_/g, " ")).join(" · ")}</p>` : ""}
           ${z.chefe ? `<p class="mapa-chefe">☠ Chefe: ${String(z.chefe.monstroId).replace(/_/g, " ")}</p>` : ""}`
        : `<p class="mapa-desc mapa-rumor-txt">Só rumores chegaram até aqui. Vá até lá para saber o resto.</p>`}
      <div class="mapa-acoes"></div>`;

    const acoes = div.querySelector(".mapa-acoes");
    if (aqui) {
      acoes.innerHTML = `<p class="mapa-aqui">📍 Você está aqui.</p>`;
    } else if (visitada && contexto.onViajar) {
      const btn = document.createElement("button");
      btn.className = "primario";
      btn.textContent = "Viajar para cá";
      btn.onclick = () => { fecharModal(); contexto.onViajar(z.id); };
      acoes.appendChild(btn);
    } else if (vis !== VISIBILIDADE.OCULTA) {
      acoes.innerHTML = `<p class="mapa-aqui mapa-rumor-txt">Viagem rápida só para onde você já esteve.</p>`;
    }
    return div;
  }

  corpo.querySelectorAll(".mapa-modo").forEach((b) => b.onclick = () => {
    modo = b.dataset.modo;
    corpo.querySelectorAll(".mapa-modo").forEach((x) => x.classList.toggle("ativo", x === b));
    // Trocar de modo mantém o lugar em foco, trocando só a escala de leitura:
    // selecionar Altaverde em "Regiões" e passar para "Zonas" deve continuar
    // olhando para Altaverde, não jogar o jogador de volta ao nada.
    if (selecionado) {
      if (modo === MODO.ZONAS && selecionado.tipo === "macro") {
        const primeira = selecionado.ref.zonas.find((z) => visibilidadeDaZona(personagem, z.id) !== VISIBILIDADE.OCULTA);
        selecionado = primeira ? { tipo: "zona", ref: primeira, vis: visibilidadeDaZona(personagem, primeira.id) } : null;
      } else if (modo === MODO.REGIOES && selecionado.tipo === "zona") {
        const macro = macros.find((m) => m.id === selecionado.ref.macroId);
        selecionado = macro ? { tipo: "macro", ref: macro, vis: visibilidadeDaMacro(personagem, macro.id) } : null;
      }
    }
    if (selecionado) selecionar(selecionado);
    else { desenhar(); painelInicial(); }
  });

  function painelInicial() {
    const zonaAtual = zonas.find((z) => z.id === contexto.zonaAtualId);
    if (zonaAtual) {
      const macro = macros.find((m) => m.id === zonaAtual.macroId);
      if (macro) return selecionar({ tipo: "macro", ref: macro, vis: visibilidadeDaMacro(personagem, macro.id) });
    }
    painel.innerHTML = `<p class="mapa-vazio">Clique numa região do mapa para ver o que se sabe dela.</p>`;
  }

  // O modal já está no DOM quando montarMapaMundo roda, mas a largura só é
  // final depois do layout — daí o rAF antes de medir.
  requestAnimationFrame(() => {
    dimensionar();
    desenhar();
    painelInicial();
  });

  const aoRedimensionar = () => { dimensionar(); desenhar(); };
  window.addEventListener("resize", aoRedimensionar);
  // O modal é destruído ao fechar; o listener tem de ir junto, senão sobra um
  // por abertura e todos disparam contra canvases que já não existem.
  const observador = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      window.removeEventListener("resize", aoRedimensionar);
      observador.disconnect();
    }
  });
  observador.observe(document.getElementById("modal-overlay") || document.body, { childList: true, subtree: true });
}
