// Motor visual das cenas. Uma camada de tela cheia, acima de tudo (inclusive
// do modal-overlay), que mostra um painel por vez e devolve uma Promise que
// resolve quando a cena termina — assim quem chama simplesmente dá `await` e
// continua, sem callback aninhado:
//
//   await reproduzirCutscene(cena, personagem, dados);
//   iniciarMundo();
//
// DECISÕES DE DESENHO, e por quê:
//
// • Sem imagem nova. `painel.arte` é uma chave de classe CSS
//   (cutscene.css) que pinta um gradiente temático com um glifo grande ao
//   fundo. O jogo tem 516 assets e nenhum deles é arte de cena; inventar
//   dezoito ilustrações seria a parte cara e a menos importante. A exceção é
//   a arte "retrato", que usa o retrato HD do próprio personagem
//   (assets/sprites_hd/retrato_<raca>_<classe>.png, os mesmos que BattleUI
//   já usa) — no painel em que a cena fala sobre ele.
//
// • Parágrafo por parágrafo, não letra por letra. Texto que datilografa
//   parece cinematográfico por dez segundos e vira obstáculo no minuto
//   seguinte, ainda mais em PT-BR, que tem palavras longas. Cada parágrafo
//   entra com um fade curto; um clique durante a entrada mostra tudo de uma
//   vez. Ninguém espera o jogo.
//
// • Pular é de primeira classe. O botão "Pular cena" fica visível o tempo
//   todo, não escondido atrás de um hold de três segundos. Um jogador que
//   está recomeçando pela quinta vez não deve ser punido com a mesma cena.
//   Pular ainda aplica a escolha (quando há), usando a primeira opção — ver
//   `escolherPadraoAoPular` abaixo.
//
// • Respeita Acessibilidade. Todas as durações passam por duracaoAnimacao(),
//   o mesmo multiplicador do dado e do combate, e por efeitosReduzidos().
import { duracaoAnimacao, sleep } from "./DiceAnimation.js";
import { efeitosReduzidos } from "../systems/AccessibilitySystem.js";
import { aplicarEscolhaCena, opcoesDaCena, marcarVista } from "../systems/CutsceneSystem.js";
import { linhasDaConsequencia } from "../systems/ConsequenciaTexto.js";

const ID_CAMADA = "cutscene-camada";

// {nome}, {raca}, {classe}, {origem}, {marcaRaca} e {marcaMotivacao} — os
// únicos campos interpolados. Ver o cabeçalho de cutscenes.js. Os nomes dos
// campos aqui seguem o objeto criado por CharacterFactory.criarPersonagem:
// racaNome/classeNome (legíveis) com racaId/classeId como reserva, e
// antecedenteNome para a origem.
//
// Uma frase do prólogo por RAÇA e outra por MOTIVAÇÃO (22/09). A cena era
// igual para todo mundo, e o próprio prólogo diz que "o corpo sabe, a cabeça
// não" — então é o corpo e o que move o herói que mudam de frase. Herói sem
// motivação (save antigo) simplesmente não ganha a linha: parágrafo vazio é
// descartado na renderização.
const MARCA_DA_RACA = {
  humano: "O corpo era humano: nada que chamasse atenção numa multidão — e é isso que faz passar por qualquer porta.",
  elfo: "O corpo era élfico: os olhos achavam no escuro o que os outros só encontram tropeçando.",
  anao: "O corpo era anão: baixo, firme no chão, feito para aguentar o que vem de cima.",
  orc: "O corpo era órquico: largo demais para caber em briga pequena.",
  halfling: "O corpo era halfling: pequeno, rápido, com um jeito de sair ileso que ninguém sabe explicar.",
  draconato: "O corpo era draconato: escamas mornas, e um fôlego que esquenta antes de você mandar.",
};
const MARCA_DA_MOTIVACAO = {
  descoberta: "E, sem saber por quê, a primeira coisa que você quis foi ver o que tem depois da última curva da estrada.",
  justica: "E, sem saber por quê, o que te tirou da cama foi a ideia de alguém forte pisando em alguém fraco.",
  legado: "E, sem saber por quê, o que incomodou não foi o passado perdido: foi a chance de não deixar nada para trás.",
  liberdade: "E, sem saber por quê, a única coisa que você não aceitou foi o mês de prazo que te deram.",
  redencao: "E, sem saber por quê, você acordou com a sensação de dever alguma coisa a alguém.",
  poder: "E, sem saber por quê, o que o Éter fez com você não deu medo: deu vontade de aprender a fazer igual.",
};

// Saves de antes de `antecedenteNome` existir só guardam o id — e o id
// "sabio" não tem acento. Esta tabela cobre esses heróis sem migração.
const NOME_DA_ORIGEM = {
  soldado: "Soldado", nobre: "Nobre", criminoso: "Criminoso", eremita: "Eremita",
  andarilho_do_povo: "Andarilho do Povo", sabio: "Sábio",
};

function interpolar(texto, personagem) {
  if (!texto) return "";
  const p = personagem || {};
  const mapa = {
    nome: p.nome || "viajante",
    raca: minusculas(p.racaNome || p.racaId) || "andarilho",
    classe: minusculas(p.classeNome || p.classeId) || "aventureiro",
    origem: minusculas(p.antecedenteNome || NOME_DA_ORIGEM[p.antecedenteId] || p.antecedenteId) || "estrada",
    marcaRaca: MARCA_DA_RACA[p.racaId] || "O corpo sabia se mover, e por enquanto isso bastava.",
    marcaMotivacao: MARCA_DA_MOTIVACAO[p.motivacaoId] || "",
  };
  return String(texto).replace(/\{(nome|raca|classe|origem|marcaRaca|marcaMotivacao)\}/g, (_, chave) => mapa[chave]);
}

// As cenas usam esses valores no meio de frase ("o jeito de guerreiro de
// entrar numa sala"), por isso minúsculas e sem sublinhado.
function minusculas(valor) {
  if (!valor) return "";
  return String(valor).replace(/_/g, " ").toLowerCase();
}

// Os mesmos retratos que BattleUI usa: assets/sprites_hd/retrato_<racaId>_
// <classeId>.png — com ID, não com nome ("anao", não "Anão").
function caminhoRetrato(personagem) {
  const raca = personagem && personagem.racaId;
  const classe = personagem && personagem.classeId;
  if (!raca || !classe) return null;
  return `assets/sprites_hd/retrato_${raca}_${classe}.png`;
}

export function cutsceneAberta() {
  return !!document.getElementById(ID_CAMADA);
}

// Reproduz a cena e resolve com { pulou, escolha } quando ela acaba.
export function reproduzirCutscene(cena, personagem, dados = {}) {
  return new Promise((resolve) => {
    if (!cena || !Array.isArray(cena.paineis) || !cena.paineis.length) return resolve({ pulou: false });
    // Duas cenas ao mesmo tempo seria um bug de chamada, não um estado a
    // suportar: a segunda simplesmente não abre.
    if (cutsceneAberta()) return resolve({ pulou: false });

    const focoAnterior = document.activeElement;
    const totalPaineis = cena.paineis.length;
    const idTitulo = `cutscene-titulo-${String(cena.id || "cena").replace(/[^a-z0-9_-]/gi, "-")}`;
    const camada = document.createElement("div");
    camada.id = ID_CAMADA;
    camada.className = "cutscene";
    camada.setAttribute("role", "dialog");
    camada.setAttribute("aria-modal", "true");
    if (cena.titulo) camada.setAttribute("aria-labelledby", idTitulo);
    else camada.setAttribute("aria-label", "Cena narrativa");
    camada.innerHTML = `
      <div class="cutscene-arte" aria-hidden="true"></div>
      <div class="cutscene-frente" tabindex="-1">
        <div class="cutscene-cab">
          <span class="cutscene-titulo" id="${idTitulo}"></span>
          <div class="cutscene-acoes">
            <button type="button" class="cutscene-auto" id="cutscene-auto" aria-pressed="false" title="Alternar avanço automático">▶ Auto</button>
            <button type="button" class="cutscene-pular" id="cutscene-pular">Pular cena</button>
          </div>
        </div>
        <div class="cutscene-corpo">
          <p class="cutscene-epigrafe hidden"></p>
          <h2 class="cutscene-subtitulo hidden"></h2>
          <div class="cutscene-texto"></div>
        </div>
        <div class="cutscene-rodape">
          <div class="cutscene-progresso">
            <span class="cutscene-contador" aria-live="polite"></span>
            <div class="cutscene-trilha" role="progressbar" aria-label="Progresso da cena" aria-valuemin="1" aria-valuemax="${totalPaineis}" aria-valuenow="1"><span></span></div>
            <div class="cutscene-pontos" aria-hidden="true"></div>
          </div>
          <button type="button" class="primario cutscene-avancar" id="cutscene-avancar">Continuar</button>
        </div>
        <div class="cutscene-confirmar hidden" role="alertdialog" aria-modal="true" aria-labelledby="cutscene-confirmar-titulo" aria-describedby="cutscene-confirmar-texto">
          <div class="cutscene-confirmar-caixa">
            <h3 id="cutscene-confirmar-titulo">Pular esta cena?</h3>
            <p id="cutscene-confirmar-texto">A cena será marcada como vista. Se houver uma decisão, será usada a opção padrão.</p>
            <div class="cutscene-confirmar-acoes">
              <button type="button" class="cutscene-cancelar">Continuar assistindo</button>
              <button type="button" class="cutscene-confirmar-pulo">Pular cena</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(camada);
    document.body.classList.add("com-cutscene");

    const arte = camada.querySelector(".cutscene-arte");
    const elTitulo = camada.querySelector(".cutscene-titulo");
    const elEpigrafe = camada.querySelector(".cutscene-epigrafe");
    const elSub = camada.querySelector(".cutscene-subtitulo");
    const elTexto = camada.querySelector(".cutscene-texto");
    const elPontos = camada.querySelector(".cutscene-pontos");
    const elContador = camada.querySelector(".cutscene-contador");
    const elTrilha = camada.querySelector(".cutscene-trilha");
    const elPreenchimento = elTrilha.querySelector("span");
    const btnAvancar = camada.querySelector("#cutscene-avancar");
    const btnPular = camada.querySelector("#cutscene-pular");
    const btnAuto = camada.querySelector("#cutscene-auto");
    const confirmacao = camada.querySelector(".cutscene-confirmar");
    const btnCancelarPulo = camada.querySelector(".cutscene-cancelar");
    const btnConfirmarPulo = camada.querySelector(".cutscene-confirmar-pulo");
    const frente = camada.querySelector(".cutscene-frente");
    const partesPlanoFundo = [...camada.querySelectorAll(".cutscene-cab, .cutscene-corpo, .cutscene-rodape")];

    elTitulo.textContent = cena.titulo || "";
    cena.paineis.forEach(() => {
      const ponto = document.createElement("i");
      elPontos.appendChild(ponto);
    });

    let indice = 0;
    let entrando = false;     // um painel ainda está fazendo fade dos parágrafos
    let adiantar = false;     // o jogador clicou durante o fade: mostra tudo já
    let finalizado = false;
    let automatico = false;
    let timerAutomatico = null;
    let confirmandoPulo = false;

    const seletoresFoco = "button:not([disabled]):not(.hidden), [href], [tabindex]:not([tabindex='-1'])";

    function cancelarAutomatico() {
      if (timerAutomatico) clearTimeout(timerAutomatico);
      timerAutomatico = null;
    }

    function agendarAutomatico(painel) {
      cancelarAutomatico();
      if (!automatico || entrando || finalizado || confirmandoPulo || cena.escolha && indice === totalPaineis - 1) return;
      const caracteres = (painel?.texto || []).join(" ").length;
      const espera = efeitosReduzidos() ? 4200 : Math.min(10000, Math.max(4500, 2600 + caracteres * 32));
      timerAutomatico = setTimeout(() => {
        if (!document.hidden && automatico && !confirmandoPulo) avancar();
      }, espera);
    }

    function atualizarProgresso(i) {
      const atual = Math.min(totalPaineis, i + 1);
      elContador.textContent = `Cena ${atual} de ${totalPaineis}`;
      elTrilha.setAttribute("aria-valuenow", String(atual));
      elTrilha.setAttribute("aria-valuetext", `Cena ${atual} de ${totalPaineis}`);
      elPreenchimento.style.width = `${(atual / totalPaineis) * 100}%`;
      [...elPontos.children].forEach((p, k) => {
        p.classList.toggle("ativo", k <= i);
        if (k === i) p.setAttribute("aria-current", "step");
        else p.removeAttribute("aria-current");
      });
    }

    function encerrar(saida) {
      if (finalizado) return;
      finalizado = true;
      cancelarAutomatico();
      document.removeEventListener("keydown", aoTeclado, true);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      camada.classList.add("saindo");
      const espera = efeitosReduzidos() ? 0 : duracaoAnimacao(320);
      setTimeout(() => {
        camada.remove();
        document.body.classList.remove("com-cutscene");
        if (personagem) marcarVista(personagem, cena.id);
        const destinoFoco = focoAnterior?.isConnected
          ? focoAnterior
          : document.querySelector("#game-canvas, .hda-navbar button, button:not([disabled])");
        destinoFoco?.focus?.({ preventScroll: true });
        resolve(saida);
      }, espera);
    }

    async function mostrarPainel(i) {
      const painel = cena.paineis[i];
      entrando = true;
      adiantar = false;

      arte.className = `cutscene-arte arte-${painel.arte || "eter"}`;
      arte.style.backgroundImage = "";
      if (painel.arte === "retrato") {
        const src = caminhoRetrato(personagem);
        // Se o retrato não existir para esta combinação, o gradiente da
        // classe `arte-retrato` continua valendo — a cena nunca quebra por
        // falta de arte.
        if (src) {
          const img = new Image();
          img.onload = () => { arte.style.backgroundImage = `url("${src}")`; arte.classList.add("com-imagem"); };
          img.src = src;
        }
      }

      atualizarProgresso(i);

      elEpigrafe.classList.toggle("hidden", !painel.epigrafe);
      elEpigrafe.textContent = interpolar(painel.epigrafe, personagem);
      elSub.classList.toggle("hidden", !painel.titulo);
      elSub.textContent = interpolar(painel.titulo, personagem);

      elTexto.innerHTML = "";
      // Uma linha que vira texto vazio depois da interpolação (ex.: a frase
      // de motivação num herói de save antigo) não vira parágrafo em branco.
      const paragrafos = (painel.texto || []).map((t) => interpolar(t, personagem)).filter((t) => t.trim()).map((t) => {
        const p = document.createElement("p");
        p.textContent = t;
        p.className = "cutscene-p";
        elTexto.appendChild(p);
        return p;
      });

      const ultimo = i === cena.paineis.length - 1;
      btnAvancar.textContent = ultimo && !cena.escolha && cena.quando === "novo_jogo" ? "Começar" : "Continuar";

      const passo = efeitosReduzidos() ? 0 : duracaoAnimacao(260);
      for (let k = 0; k < paragrafos.length; k++) {
        paragrafos[k].classList.add("visivel");
        // Nada de esperar DEPOIS do último parágrafo: essa espera final não
        // revelava mais nada e mantinha o painel em estado "entrando", de
        // modo que o primeiro clique do jogador era engolido como
        // "adiantar" quando já não havia nada a adiantar — e ele precisava
        // clicar duas vezes para virar a página.
        if (adiantar || !passo || k === paragrafos.length - 1) continue;
        await sleep(passo);
      }
      // Se o jogador adiantou no meio, o loop acima já pulou as esperas —
      // mas os parágrafos restantes podem não ter recebido a classe ainda.
      paragrafos.forEach((p) => p.classList.add("visivel"));
      entrando = false;
      agendarAutomatico(painel);
    }

    function avancar() {
      if (finalizado || confirmandoPulo) return;
      cancelarAutomatico();
      // Clicar durante o fade não pula o painel: mostra o painel inteiro.
      // É o comportamento que todo jogo com cena tem, e o que evita que um
      // clique ansioso engula um parágrafo inteiro sem o jogador ver.
      if (entrando) { adiantar = true; return; }

      if (indice < cena.paineis.length - 1) {
        indice += 1;
        mostrarPainel(indice);
        return;
      }
      if (cena.escolha) return mostrarEscolha();
      encerrar({ pulou: false });
    }

    function mostrarEscolha() {
      const escolha = cena.escolha;
      cancelarAutomatico();
      arte.className = "cutscene-arte arte-escolha";
      elEpigrafe.classList.add("hidden");
      elSub.classList.remove("hidden");
      elSub.textContent = "Uma decisão";
      elTexto.innerHTML = "";

      const pergunta = document.createElement("p");
      pergunta.className = "cutscene-p visivel";
      pergunta.textContent = interpolar(escolha.pergunta, personagem);
      elTexto.appendChild(pergunta);

      const lista = document.createElement("div");
      lista.className = "cutscene-opcoes";
      // A opção da própria origem vem junto e MARCADA — se ela parecesse igual
      // às outras, o jogador nunca saberia que a escolha de criação dele
      // acabou de abrir uma resposta que ninguém mais tem.
      opcoesDaCena(cena, personagem).forEach((opcao) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = opcao.daOrigem ? "cutscene-opcao da-origem" : "cutscene-opcao";
        if (opcao.daOrigem) {
          const selo = document.createElement("span");
          selo.className = "cutscene-opcao-selo";
          selo.textContent = personagem.antecedenteNome || "Sua origem";
          btn.appendChild(selo);
          btn.appendChild(document.createTextNode(interpolar(opcao.rotulo, personagem)));
        } else {
          btn.textContent = interpolar(opcao.rotulo, personagem);
        }
        btn.onclick = () => resolverEscolha(opcao.id);
        lista.appendChild(btn);
      });
      elTexto.appendChild(lista);

      // Durante a escolha não há "Continuar": a única saída é escolher, ou
      // pular (que escolhe a primeira opção). Botão de avançar escondido
      // evita o jogador atravessar a decisão sem perceber que era uma.
      btnAvancar.classList.add("hidden");
      elPontos.classList.add("hidden");
      elTrilha.setAttribute("aria-label", "Decisão da cena");
      requestAnimationFrame(() => lista.querySelector("button")?.focus());
    }

    async function resolverEscolha(opcaoId) {
      // Duas origens de escolha, um mesmo motor:
      //
      // • `escolha.aoEscolher` — quem chamou a cena decide o efeito. É o
      //   caminho das DECISÕES DE QUESTLINE (GameUI.js): quem aplica a
      //   consequência ali é concluirQuestRegional, não este arquivo, e o
      //   callback devolve { texto, linhas } já pronto para encenar.
      // • sem callback — a cena é autossuficiente e os efeitos estão nos
      //   próprios dados da opção (é o caso do prólogo).
      //
      // Os dois desembocam no mesmo desfecho na tela, que é o ponto: uma
      // decisão de quest passa a ter exatamente o mesmo peso visual que a
      // decisão do prólogo, em vez de ser um botão "Concluir" num card.
      const contrato = cena.escolha || {};
      const r = contrato.aoEscolher
        ? contrato.aoEscolher(opcaoId)
        : aplicarEscolhaCena(personagem, cena, opcaoId, dados.worldStateVariables);
      if (!r || !r.ok) return encerrar({ pulou: false });

      // O desfecho da escolha é a última coisa que a cena mostra — e ela
      // fica na tela até o jogador confirmar, porque é a consequência dele.
      elSub.textContent = "";
      elSub.classList.add("hidden");
      elTexto.innerHTML = "";
      const p = document.createElement("p");
      p.className = "cutscene-p";
      p.textContent = interpolar(r.texto, personagem);
      elTexto.appendChild(p);
      await sleep(efeitosReduzidos() ? 0 : duracaoAnimacao(120));
      p.classList.add("visivel");

      // O ECO: o que essa escolha mudou no mundo, em frases. Vem pronto de
      // quem chamou (`r.linhas`, caminho das quests — ver
      // ConsequenciaTexto.js) ou é montado aqui a partir da reputação
      // (caminho do prólogo). Isto é o que faltava para uma decisão parecer
      // uma decisão: ver, no mesmo instante, o que ela custou.
      // As duas origens desembocam no mesmo formatador (ConsequenciaTexto),
      // para o eco do prólogo e o eco de uma decisão de questline saírem
      // escritos do mesmo jeito.
      const linhas = r.linhas && r.linhas.length
        ? r.linhas
        : linhasDaConsequencia({ faccao: (r.mudou && r.mudou.reputacao) || {} }, dados.worldStateVariables);
      if (linhas.length) {
        const eco = document.createElement("ul");
        eco.className = "cutscene-eco";
        linhas.forEach(({ icone, texto }) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="cutscene-eco-icone"></span><span></span>`;
          li.firstChild.textContent = icone || "•";
          li.lastChild.textContent = texto;
          eco.appendChild(li);
        });
        elTexto.appendChild(eco);
        requestAnimationFrame(() => eco.classList.add("visivel"));
      }

      btnAvancar.classList.remove("hidden");
      // "Começar" só faz sentido quando a cena é a que precede o início do
      // jogo; numa decisão tomada no meio de uma questline, o que vem a
      // seguir é a continuação do que já estava acontecendo.
      btnAvancar.textContent = cena.quando === "novo_jogo" ? "Começar" : "Continuar";
      btnAvancar.onclick = () => encerrar({ pulou: false, escolha: opcaoId });
    }

    // Pular durante uma cena com escolha ainda registra uma escolha — a
    // primeira da lista. Deixar a escolha em branco criaria um personagem
    // sem resposta no diário e sem flag, um estado que nenhum conteúdo
    // posterior sabe tratar. A primeira opção é sempre a mais neutra/ativa.
    function escolherPadraoAoPular() {
      if (!cena.escolha) return null;
      const primeira = (cena.escolha.opcoes || [])[0];
      if (!primeira) return null;
      aplicarEscolhaCena(personagem, cena, primeira.id, dados.worldStateVariables);
      return primeira.id;
    }

    function confirmarPulo() {
      if (finalizado || confirmandoPulo) return;
      cancelarAutomatico();
      confirmandoPulo = true;
      confirmacao.classList.remove("hidden");
      frente.classList.add("confirmando");
      partesPlanoFundo.forEach((parte) => {
        parte.inert = true;
        parte.setAttribute("aria-hidden", "true");
      });
      btnCancelarPulo.focus();
    }

    function cancelarPulo() {
      if (!confirmandoPulo) return;
      confirmandoPulo = false;
      confirmacao.classList.add("hidden");
      frente.classList.remove("confirmando");
      partesPlanoFundo.forEach((parte) => {
        parte.inert = false;
        parte.removeAttribute("aria-hidden");
      });
      btnPular.focus();
      agendarAutomatico(cena.paineis[indice]);
    }

    function pular() {
      const escolhido = escolherPadraoAoPular();
      encerrar({ pulou: true, escolha: escolhido });
    }

    function alternarAutomatico() {
      automatico = !automatico;
      btnAuto.setAttribute("aria-pressed", String(automatico));
      btnAuto.textContent = automatico ? "⏸ Auto" : "▶ Auto";
      btnAuto.title = automatico ? "Desativar avanço automático" : "Ativar avanço automático";
      if (automatico) agendarAutomatico(cena.paineis[indice]);
      else cancelarAutomatico();
    }

    function aoMudarVisibilidade() {
      if (document.hidden) cancelarAutomatico();
      else if (automatico && !confirmandoPulo) agendarAutomatico(cena.paineis[indice]);
    }

    function aoTeclado(ev) {
      if (finalizado) return;
      if (ev.key === "Tab") {
        const raiz = confirmandoPulo ? confirmacao : camada;
        const focaveis = [...raiz.querySelectorAll(seletoresFoco)].filter((el) => !el.closest(".hidden") && el.offsetParent !== null);
        if (!focaveis.length) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
        else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault(); ev.stopPropagation();
        return confirmandoPulo ? cancelarPulo() : confirmarPulo();
      }
      if (confirmandoPulo) return;
      if (ev.key === " " || ev.key === "Enter" || ev.key === "ArrowRight" || ev.key === "PageDown") {
        // Espaço/Enter com foco num botão já dispara o click dele — deixar
        // passar aqui também avançaria duas vezes.
        if ((ev.key === " " || ev.key === "Enter") && document.activeElement?.tagName === "BUTTON") return;
        ev.preventDefault(); ev.stopPropagation();
        if (!btnAvancar.classList.contains("hidden")) btnAvancar.click();
      }
    }

    btnAvancar.onclick = avancar;
    btnPular.onclick = confirmarPulo;
    btnAuto.onclick = alternarAutomatico;
    btnCancelarPulo.onclick = cancelarPulo;
    btnConfirmarPulo.onclick = pular;
    // Clicar na área da cena avança também — mas não quando o clique foi num
    // botão (senão a opção escolhida também contaria como "avançar").
    camada.querySelector(".cutscene-corpo").onclick = (ev) => {
      if (ev.target.closest("button")) return;
      if (!btnAvancar.classList.contains("hidden")) avancar();
    };
    document.addEventListener("keydown", aoTeclado, true);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    requestAnimationFrame(() => camada.classList.add("visivel"));
    mostrarPainel(0);
    requestAnimationFrame(() => frente.focus({ preventScroll: true }));
  });
}
