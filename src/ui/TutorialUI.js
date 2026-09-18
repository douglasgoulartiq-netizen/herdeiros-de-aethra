import {
  TUTORIAL_ETAPAS, TUTORIAL_DURACAO_SEGUNDOS, deveOferecerTutorial,
  iniciarTutorial, registrarEtapaTutorial, encerrarTutorial, garantirEstadoTutorial,
} from "../systems/TutorialSystem.js";

const ID = "tutorial-camada";

const CONTEUDO = {
  orientacao: ["Explore com as setas ou WASD. Seu herói olha e anima na direção em que anda.", "No celular, use o direcional. Pratique alguns passos na miniatura abaixo."],
  interacao: ["Quando E aparecer perto de algo, pressione E para conversar, coletar, abrir um baú, descansar ou entrar numa masmorra.", "NPCs com ! oferecem algo importante; ícones mostram comércio, cura e outros serviços."],
  missao: ["Missões de história recebem o selo dourado. Ao aceitar uma, ela entra automaticamente em foco.", "A aba Missões mostra objetivo, progresso e permite trocar qual missão está sendo rastreada."],
  mapa: ["O rastro dourado aponta a direção do objetivo sem esconder o cenário.", "O minimapa prende o ! na borda quando o destino está longe. No mapa-múndi, o atalho leva à região correta."],
  mochila: ["Abra Companhia para comparar equipamento, curar aliados e escolher até três convocados.", "Cada personagem pode chegar ao nível 25 e a 250 PC. Convocados ativos recebem XP total; reservas recebem 35%. Verde melhora o time, vermelho enfraquece — mas a estratégia ainda importa."],
  invocacao: ["Fragmentos de Aethra são usados nos banners. O Banner Iniciante oferece invocações grátis e garantias progressivas.", "Personagens repetidos fortalecem o vínculo; cada convocado tem classe, elemento e habilidade própria. Esta demonstração não gasta fragmentos."],
  combate: ["A batalha está pausada. Primeiro leia a intenção do inimigo, depois escolha um card e confirme o alvo.", "A previsão mostra dano, custo, alcance e reações elementais antes de você se comprometer."],
  d20: ["Ataques e desafios importantes rolam um d20. Resultado alto melhora suas chances; 20 é excepcional e 1 é uma falha grave.", "Atributos, equipamento e vantagens somam bônus ao resultado — o dado importa, mas sua preparação também."],
  taticas: ["Habilidades gastam MP ou recurso de classe; Defender reduz o risco e reposicionar protege aliados frágeis.", "P liga o automático. Ele pode cuidar do combate e da exploração, mas pausa diante de perigos e decisões importantes."],
  recompensa: ["Vitórias rendem XP, ouro, fragmentos e itens. Nas cidades, mercadores vendem materiais e artesãos aprimoram armas e armaduras até +10.", "A forja é seu principal caminho de força: use ouro para comprar suprimentos, melhorar equipamento e escolher sub-status. T abre habilidades; H abre Caminhos do Herdeiro."],
};

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function atalhosDaEtapa(etapa) {
  const rotulos = {
    orientacao: "Direcional na tela", interacao: "Botão Ação", missao: "Missões",
    mapa: "Mapa", mochila: "Companhia", invocacao: "Invocar",
    combate: "Toque no card e no alvo", d20: "Toque em Rolar d20",
    taticas: "Cards e botão Automático", recompensa: "Habilidades e Herança",
  };
  return { teclado: etapa.atalho, toque: rotulos[etapa.id] || "Toque na opção destacada" };
}

function tempoFormatado(segundos) {
  const valor = Math.max(0, Math.round(segundos));
  return `${Math.floor(valor / 60)}:${String(valor % 60).padStart(2, "0")}`;
}

function tempoRestante(indice) {
  return TUTORIAL_ETAPAS.slice(indice).reduce((total, etapa) => total + etapa.duracao, 0);
}

function trilhaDeEtapas(indice) {
  return TUTORIAL_ETAPAS.map((etapa, posicao) => {
    const estado = posicao < indice ? "concluida" : posicao === indice ? "atual" : "futura";
    return `<span class="tutorial-marco ${estado}" aria-hidden="true"><i></i></span>`;
  }).join("");
}

function demoMovimento() {
  return `<div class="tut-mundo" aria-label="Área de treino"><div class="tut-trilha"></div><div class="tut-heroi" id="tut-heroi">🧙</div><div class="tut-npc">❗<span>🧑‍🌾</span></div></div><p class="tut-estado" id="tut-estado">Use qualquer direção três vezes.</p>`;
}

function demoAcao(etapa) {
  const demos = {
    interacao: `<div class="tut-cena"><span class="tut-objeto">🧑‍🌾</span><span class="tut-tecla">E</span><div class="tut-balao">Tenho uma missão para você.</div></div><button data-acao="interagir">Pressionar E</button>`,
    missao: `<article class="tut-missao"><small>✦ HISTÓRIA PRINCIPAL</small><h3>O chamado de Aethra</h3><p>Encontre a trilha marcada além dos portões.</p><div class="tut-progresso"><i></i></div></article><button data-acao="missao">Aceitar e rastrear</button>`,
    mapa: `<div class="tut-mapa"><span class="tut-voce">◆ Você</span><i class="tut-rota"></i><button data-acao="mapa" class="tut-alvo">! Objetivo</button></div>`,
    mochila: `<div class="tut-poder"><small>PODER DE COMBATE</small><b>1.840 → 2.120 PC <em>+15%</em></b><span>💡 Afinidade elemental e formação melhoram este time.</span></div><div class="tut-time"><article>🧙<b>Você</b><small>Frente</small></article><article>🛡️<b>Aliado</b><small>Retaguarda</small></article><article class="vazio">＋<b>Vaga livre</b><small>Invoque alguém</small></article></div><button data-acao="mochila">Aplicar sugestão de time</button>`,
    invocacao: `<div class="tut-banner"><span>🎓</span><div><small>BANNER INICIANTE</small><h3>Primeira invocação garantida</h3><p>Raro ou superior · custo nesta demonstração: 0</p></div></div><button data-acao="invocar" class="primario">✨ Invocar agora</button><div id="tut-invocacao-resultado" aria-live="polite"></div>`,
    recompensa: `<div class="tut-recompensas"><span>⭐ +XP</span><span>🪙 Ouro</span><span>💠 Fragmentos</span><span>🎒 Equipamento</span></div><div class="tut-caminhos"><button data-acao="habilidades">T · Habilidades</button><button data-acao="heranca">H · Herança</button></div>`,
  };
  return demos[etapa] || "";
}

function demoBatalha(tipo) {
  const rodape = tipo === "combate"
    ? `<button data-acao="ataque">⚔️ Ataque básico</button><button data-acao="alvo">🎯 Confirmar alvo</button>`
    : tipo === "d20"
      ? `<button data-acao="rolar" class="primario">🎲 Rolar d20</button><strong id="tut-d20">?</strong>`
      : `<button data-acao="habilidade">✨ Habilidade</button><button data-acao="defender">🛡️ Defender</button><button data-acao="automatico">▶ Automático (P)</button>`;
  return `<div class="tut-batalha">
    <div class="tut-pausa">⏸ BATALHA PAUSADA PARA EXPLICAÇÃO</div>
    <div class="tut-arena"><article class="tut-combatente heroi">🧙<b>Herdeiro</b><meter min="0" max="100" value="84"></meter></article><div class="tut-versus">VS</div><article class="tut-combatente monstro" id="tut-monstro">🐺<b>Lobo Sombrio</b><small>Intenção: atacar</small><meter min="0" max="100" value="72"></meter></article></div>
    <div class="tut-cards">${rodape}</div><p class="tut-estado" id="tut-estado">A simulação só avança depois da sua escolha.</p>
  </div>`;
}

function htmlDemo(etapa) {
  if (etapa.demo === "movimento") return demoMovimento();
  if (["combate", "d20", "taticas"].includes(etapa.demo)) return demoBatalha(etapa.demo);
  return demoAcao(etapa.demo);
}

export function tutorialAberto() { return !!document.getElementById(ID); }

export function abrirTutorialInicial(personagem, dados = {}, { oferecer = false, aoEncerrar = null } = {}) {
  if (tutorialAberto()) return Promise.resolve({ status: "ja_aberto" });
  const estadoInicial = garantirEstadoTutorial(personagem);
  const podeRetomar = estadoInicial.status === "em_andamento";
  if (oferecer && !deveOferecerTutorial(personagem) && !podeRetomar) return Promise.resolve({ status: "ignorado" });

  return new Promise((resolve) => {
    const camada = document.createElement("section");
    camada.id = ID;
    camada.className = "tutorial tutorial-convite";
    camada.setAttribute("role", "dialog");
    camada.setAttribute("aria-modal", "true");
    camada.setAttribute("aria-label", "Tutorial inicial");
    document.body.appendChild(camada);
    document.body.classList.add("com-tutorial");

    const estadoSalvo = garantirEstadoTutorial(personagem);
    const retomando = estadoSalvo.status === "em_andamento";
    let indice = retomando ? Math.min(estadoSalvo.etapa || 0, TUTORIAL_ETAPAS.length - 1) : 0;
    let treino = {};
    let iniciado = !oferecer;

    const terminar = (status) => {
      encerrarTutorial(personagem, status);
      document.removeEventListener("keydown", aoTeclado, true);
      camada.remove();
      document.body.classList.remove("com-tutorial");
      if (aoEncerrar) aoEncerrar(status);
      resolve({ status });
    };

    const suspender = () => {
      registrarEtapaTutorial(personagem, indice);
      document.removeEventListener("keydown", aoTeclado, true);
      camada.remove();
      document.body.classList.remove("com-tutorial");
      if (aoEncerrar) aoEncerrar("pausado");
      resolve({ status: "pausado", etapa: indice });
    };

    const convite = () => {
      camada.className = "tutorial tutorial-convite";
      const progresso = Math.round(((indice + 1) / TUTORIAL_ETAPAS.length) * 100);
      camada.innerHTML = `<div class="tutorial-convite-card"><span class="tutorial-emblema">✦</span><small>PRIMEIROS PASSOS</small><h1>${retomando ? "Continuar sua jornada?" : "Conhecer Aethra em 10 minutos?"}</h1><p>${retomando ? `Você parou na etapa ${indice + 1} de ${TUTORIAL_ETAPAS.length}. Seu progresso está salvo.` : "Explore, aceite uma missão, prepare o time e vença uma batalha guiada."}</p>${retomando ? `<div class="tutorial-retomada"><span><b>${progresso}% concluído</b><small>aprox. ${tempoFormatado(tempoRestante(indice))} restantes</small></span><i><b style="width:${progresso}%"></b></i></div>` : ""}<div class="tutorial-convite-acoes"><button id="tut-iniciar" class="primario">${retomando ? `Retomar etapa ${indice + 1}` : "Começar tutorial"}</button>${retomando ? '<button id="tut-recomecar">Recomeçar</button>' : ""}<button id="tut-pular">Pular tutorial</button></div><small>Teclado e toque funcionam em todas as etapas. Reabra depois em Mais → Tutorial.</small></div>`;
      camada.querySelector("#tut-iniciar").onclick = () => { iniciado = true; iniciarTutorial(personagem); render(); };
      const recomecar = camada.querySelector("#tut-recomecar");
      if (recomecar) recomecar.onclick = () => { iniciado = true; iniciarTutorial(personagem, { reiniciar: true }); indice = 0; render(); };
      camada.querySelector("#tut-pular").onclick = () => terminar("pulado");
      camada.querySelector("#tut-iniciar").focus();
    };

    const concluirDemo = (acao) => {
      const etapa = TUTORIAL_ETAPAS[indice];
      const estado = camada.querySelector("#tut-estado");
      if (etapa.demo === "movimento") {
        treino.passos = (treino.passos || 0) + 1;
        const heroi = camada.querySelector("#tut-heroi");
        if (heroi) heroi.style.transform = `translate(${Math.min(76, treino.passos * 20)}px,${treino.passos % 2 ? -12 : 8}px)`;
        if (estado) estado.textContent = treino.passos >= 3 ? "✓ Movimento dominado." : `Mais ${3 - treino.passos} passo(s).`;
        treino.pronto = treino.passos >= 3;
      } else if (etapa.demo === "invocacao") {
        const escolhido = dados.gachaRoster?.find((p) => p.raridade === "raro") || dados.gachaRoster?.[0];
        const resultado = camada.querySelector("#tut-invocacao-resultado");
        if (resultado) resultado.innerHTML = `<article class="tut-convocado"><span>✨</span><div><small>RARO GARANTIDO</small><b>${escapar(escolhido?.nome || "Guardião de Aethra")}</b><p>${escapar(escolhido?.classeId || "Aliado")} · pronto para entrar no time</p></div></article>`;
        treino.pronto = true;
      } else if (etapa.demo === "combate") {
        treino[acao] = true;
        if (estado) estado.textContent = treino.ataque && treino.alvo ? "✓ Card e alvo confirmados. O turno pode começar." : acao === "ataque" ? "Agora confirme o Lobo Sombrio como alvo." : "Escolha primeiro o card Ataque básico.";
        treino.pronto = !!(treino.ataque && treino.alvo);
      } else if (etapa.demo === "d20") {
        const dado = camada.querySelector("#tut-d20");
        if (dado && !treino.rolando) {
          treino.rolando = true; dado.classList.add("rolando"); dado.textContent = "…";
          setTimeout(() => { dado.classList.remove("rolando"); dado.textContent = "16"; treino.pronto = true; if (estado) estado.textContent = "16 + bônus: acerto! O golpe será executado."; atualizarAvancar(); }, 700);
        }
      } else if (etapa.demo === "taticas") {
        treino[acao] = true;
        if (estado) estado.textContent = acao === "automatico" ? "Automático ligado: ele joga até surgir uma decisão importante." : `${acao === "defender" ? "Defesa" : "Habilidade"} compreendida. Teste também as outras opções.`;
        treino.pronto = !!(treino.habilidade && treino.defender && treino.automatico);
      } else {
        treino.pronto = true;
        if (estado) estado.textContent = "✓ Ação compreendida.";
      }
      atualizarAvancar();
    };

    const atualizarAvancar = () => {
      const btn = camada.querySelector("#tut-avancar");
      if (!btn) return;
      btn.disabled = !treino.pronto;
      btn.textContent = indice === TUTORIAL_ETAPAS.length - 1 ? "Começar aventura" : (treino.pronto ? "Continuar" : "Pratique para continuar");
    };

    const render = () => {
      const etapa = TUTORIAL_ETAPAS[indice];
      const atalhos = atalhosDaEtapa(etapa);
      treino = { pronto: false };
      registrarEtapaTutorial(personagem, indice);
      camada.className = "tutorial";
      camada.innerHTML = `<header class="tutorial-topo"><div class="tutorial-identidade"><small>TUTORIAL GUIADO</small><b>${etapa.icone} ${escapar(etapa.titulo)}</b></div><div class="tutorial-resumo" aria-label="Progresso do tutorial"><strong>Etapa ${indice + 1} de ${TUTORIAL_ETAPAS.length}</strong><span>${etapa.minuto} · ${tempoFormatado(tempoRestante(indice))} restantes</span></div><div class="tutorial-topo-acoes"><button id="tut-pausar" title="Seu progresso será salvo">Retomar depois</button><button id="tut-pular">Pular</button></div></header>
        <div class="tutorial-progresso" role="progressbar" aria-label="Etapa ${indice + 1} de ${TUTORIAL_ETAPAS.length}" aria-valuemin="1" aria-valuemax="${TUTORIAL_ETAPAS.length}" aria-valuenow="${indice + 1}"><i style="width:${((indice + 1) / TUTORIAL_ETAPAS.length) * 100}%"></i><div class="tutorial-marcos">${trilhaDeEtapas(indice)}</div></div>
        <main class="tutorial-corpo"><section class="tutorial-explica"><span class="tutorial-numero">${indice + 1}</span><div>${CONTEUDO[etapa.id].map((p) => `<p>${escapar(p)}</p>`).join("")}<div class="tutorial-controles" aria-label="Controles desta etapa"><span><small>TECLADO</small><kbd>${escapar(atalhos.teclado)}</kbd></span><span><small>TOQUE</small><b>${escapar(atalhos.toque)}</b></span></div></div></section><section class="tutorial-demo" aria-label="Prática da etapa ${indice + 1}">${htmlDemo(etapa)}</section></main>
        <footer class="tutorial-rodape"><button id="tut-voltar" ${indice === 0 ? "disabled" : ""}>← Voltar</button><span aria-live="polite">Etapa ${indice + 1}/${TUTORIAL_ETAPAS.length} · ${Math.ceil(etapa.duracao / 60)} min nesta prática</span><button id="tut-avancar" class="primario" disabled>Pratique para continuar</button></footer>`;
      camada.querySelector("#tut-pular").onclick = () => terminar("pulado");
      camada.querySelector("#tut-pausar").onclick = suspender;
      camada.querySelector("#tut-voltar").onclick = () => { indice -= 1; render(); };
      camada.querySelector("#tut-avancar").onclick = () => {
        if (!treino.pronto) return;
        if (indice === TUTORIAL_ETAPAS.length - 1) terminar("concluido");
        else { indice += 1; render(); }
      };
      camada.querySelectorAll("[data-acao]").forEach((btn) => btn.onclick = () => concluirDemo(btn.dataset.acao));
      if (etapa.demo === "recompensa") treino.pronto = true;
      atualizarAvancar();
      camada.querySelector("[data-acao], #tut-avancar")?.focus();
    };

    const aoTeclado = (ev) => {
      if (!iniciado) return;
      const etapa = TUTORIAL_ETAPAS[indice];
      const tecla = ev.key.toLowerCase();
      if (etapa.demo === "movimento" && (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(tecla))) {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("mover");
      } else if (etapa.demo === "interacao" && tecla === "e") {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("interagir");
      } else if (etapa.demo === "missao" && ["m", "q"].includes(tecla)) {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("missao");
      } else if (etapa.demo === "mapa" && tecla === "u") {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("mapa");
      } else if (etapa.demo === "mochila" && ["i", "y"].includes(tecla)) {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("mochila");
      } else if (etapa.demo === "invocacao" && tecla === "g") {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("invocacao");
      } else if (etapa.demo === "taticas" && tecla === "p") {
        ev.preventDefault(); ev.stopImmediatePropagation(); concluirDemo("automatico");
      }
    };
    document.addEventListener("keydown", aoTeclado, true);
    if (oferecer) convite();
    else {
      iniciarTutorial(personagem, { reiniciar: !retomando });
      render();
    }
  });
}

export function duracaoTutorialFormatada() { return `${TUTORIAL_DURACAO_SEGUNDOS / 60} minutos`; }
