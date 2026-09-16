// REVELAÇÕES DE COMBATE — dar um momento na tela a três mecânicas que já
// funcionavam e só existiam como uma linha no registro de texto.
//
// O QUE ESTAVA INVISÍVEL
// ----------------------
//  1. REAÇÃO ELEMENTAL. `resolverConsequenciasReacao` (CombatSystem) já
//     escrevia "⚡ Reação Elemental: Condução!" no log. Só que durante uma
//     luta o log rola sozinho e ninguém lê: o jogador via um número de dano
//     maior e concluía "deu sorte". A reação é a mecânica mais profunda do
//     combate — molhar o alvo e depois acertar com raio — e ela nunca se
//     apresentava.
//  2. VIRADA DE FASE DO CHEFE. O BossPhaseSystem muda dano, velocidade e
//     defesa em 66% e 33% de HP, e libera a habilidade assinada na fase 2.
//     `nomeDaFase()` existia desde sempre e NENHUMA tela a chamava.
//  3. O CHEFE ENFURECER. Na segunda quebra de postura a barra de postura
//     cresce 2,6× e os golpes do chefe ganham +35%. O jogador só percebia
//     que "de repente ficou difícil quebrar de novo".
//
// COMO ISTO SE LIGA AO COMBATE
// ----------------------------
// Não se liga. O CombatSystem é testado em Node, sem DOM, então ele não pode
// importar esta tela. Ele ANUNCIA num barramento (EventosVisuais.js) e este
// módulo OUVE. Quando ninguém ouve — que é o caso de todos os test_*.mjs —
// o anúncio é um no-op. Nenhum teste precisou mudar por causa disto.
//
// UMA POR VEZ. Três reações podem sair na mesma ação (a propagação acerta um
// segundo alvo, que também estava molhado). Empilhar os três letreiros na
// tela ao mesmo tempo seria pior que não mostrar nenhum, então há uma fila:
// entra um, espera, entra o próximo. A fila tem teto — o que passar do teto
// continua só no log, porque o jogador não vai ficar assistindo a uma fila
// de sete avisos enquanto quer jogar.

import { ouvir, EVENTO } from "../systems/EventosVisuais.js";
import { efeitosReduzidos } from "../systems/AccessibilitySystem.js";

const TEMPO_REACAO = 1500;
const TEMPO_FASE = 2400;
const TEMPO_FURIA = 1800;
const TEMPO_FAIXA = 950;
const MAX_FILA = 3;

// Cor de contorno por tipo de revelação. É a única cor que estes letreiros
// têm — o resto é o mesmo pergaminho escuro do jogo, para o letreiro não
// parecer um pop-up de outro aplicativo.
const COR = {
  reacao: "#7ab5e0",
  fase: "#e0602a",
  furia: "#e0b24a",
};

// A cor de cada faixa curta, pela classe que a BattleUI manda. Um natural 1 e
// uma postura rompida não podem sair com a mesma moldura: a primeira é uma
// desgraça, a segunda é a recompensa de três turnos de trabalho.
const COR_DA_FAIXA = {
  "faixa-nat20": "#ffe066",
  "faixa-nat1": "#e05555",
  "faixa-ruptura": "#7ab5e0",
  "faixa-eco": "#c89af0",
  "faixa-leva": "#7ab5e0",
};

// A fila viva da batalha atual. Existe como variável de módulo — e não só
// dentro do `iniciarRevelacoes` — porque a BattleUI precisa enfileirar as
// faixas curtas (NATURAL 20, POSTURA ROMPIDA, ECO, LEVA N) na MESMA fila dos
// letreiros. Antes elas eram uma camada à parte desenhada em cima do campo, e
// as duas podiam aparecer no mesmo instante, uma sobre a outra. Passando pela
// mesma fila, duas nunca coexistem — por construção, não por sorte.
let filaAtiva = null;

export function iniciarRevelacoes(campoEl) {
  if (!campoEl) return () => {};

  const camada = document.createElement("div");
  camada.className = "revelacoes-camada";
  campoEl.appendChild(camada);

  const fila = [];
  let ocupado = false;

  function enfileirar(entrada) {
    if (fila.length >= MAX_FILA) return;
    fila.push(entrada);
    if (!ocupado) proximo();
  }

  function proximo() {
    const entrada = fila.shift();
    if (!entrada) { ocupado = false; return; }
    ocupado = true;
    desenhar(entrada);
  }

  function desenhar(entrada) {
    const el = document.createElement("div");
    // A faixa curta não é um letreiro com ícone e corpo — é uma palavra só.
    // Reusa a mesma caixa e a mesma fila, com o conteúdo enxuto.
    if (entrada.classe === "faixa") {
      el.className = `revelacao rev-faixa faixa-central ${entrada.extra || ""}`;
      // A borda de `.revelacao` vem de `--rev-cor`, e este ramo não a definia
      // — então POSTURA ROMPIDA, NATURAL 1, ECO e LEVA saíam todas com a
      // moldura azul de reação elemental. Cada faixa tem a cor do que ela é.
      el.style.setProperty("--rev-cor", COR_DA_FAIXA[entrada.extra] || "#c8b89a");
      el.textContent = entrada.nome;
    } else {
      el.className = `revelacao rev-${entrada.classe}`;
      el.style.setProperty("--rev-cor", COR[entrada.classe] || COR.reacao);
      el.innerHTML = `
        <div class="rev-icone">${entrada.icone}</div>
        <div class="rev-corpo">
          <div class="rev-rotulo">${entrada.rotulo}</div>
          <div class="rev-nome">${entrada.nome}</div>
          ${entrada.desc ? `<div class="rev-desc">${entrada.desc}</div>` : ""}
        </div>`;
    }
    camada.appendChild(el);

    // Com efeitos reduzidos o letreiro não pulsa nem estoura — ele
    // simplesmente aparece e some. A INFORMAÇÃO é a mesma; o que muda é o
    // movimento, que é o que incomoda quem ligou a opção.
    const reduzido = efeitosReduzidos();
    if (reduzido) el.classList.add("sem-movimento");
    const duracao = reduzido ? Math.round(entrada.tempo * 0.8) : entrada.tempo;

    setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => {
        el.remove();
        proximo();
      }, reduzido ? 60 : 260);
    }, duracao);
  }

  // --- Os três ouvintes -----------------------------------------------

  const cancelar = [];

  cancelar.push(ouvir(EVENTO.REACAO, (d) => {
    enfileirar({
      classe: "reacao",
      icone: d.icone || "✨",
      rotulo: "Reação elemental",
      nome: d.nome || "Reação",
      // A descrição vem do elementalReactions.json e explica o que a reação
      // FEZ ("a corrente salta para outro inimigo"). É a metade útil: sem
      // ela o nome sozinho não ensina nada a quem viu pela primeira vez.
      desc: d.descricao || "",
      tempo: TEMPO_REACAO,
    });
  }));

  cancelar.push(ouvir(EVENTO.FASE_CHEFE, (d) => {
    const hab = d.habilidade;
    enfileirar({
      classe: "fase",
      icone: d.fase >= 3 ? "🔥" : "⚔️",
      rotulo: `${d.chefe} — fase ${d.fase}`,
      nome: (d.nome || "").toUpperCase(),
      desc: hab
        ? `Libera ${hab.icone || ""} ${hab.nome}: ${hab.descricao || ""}`
        : (d.fase >= 3
          ? "Mais rápido e mais letal — mas a guarda cede."
          : "Os golpes ficam mais pesados."),
      tempo: TEMPO_FASE,
    });
  }));

  cancelar.push(ouvir(EVENTO.QUEBRA, (d) => {
    // Só o enfurecer vira letreiro. A quebra em si já tem momento visual
    // próprio na BattleUI (o card sacode, a barra estoura) — repetir seria
    // ruído em cima de algo que o jogador já entendeu.
    if (!d.enfureceu) return;
    enfileirar({
      classe: "furia",
      icone: "😤",
      rotulo: "O chefe aprendeu",
      nome: `${d.alvo} ENFURECE`,
      desc: "A postura dele custa mais caro agora, e os golpes doem mais.",
      tempo: TEMPO_FURIA,
    });
  }));

  // Publica a fila para `anunciarFaixa` poder usá-la.
  filaAtiva = enfileirar;

  return () => {
    cancelar.forEach((fn) => fn && fn());
    fila.length = 0;
    camada.remove();
    filaAtiva = null;
  };
}

// Uma faixa curta — um nome em caixa alta, sem ícone nem descrição. É o que
// a BattleUI chamava de `mostrarFaixaCentral`, agora entrando pela fila dos
// letreiros em vez de por uma camada própria sobre os cards.
export function anunciarFaixa(texto, classe = "") {
  if (!filaAtiva) return false;
  filaAtiva({
    classe: "faixa",
    extra: classe,
    icone: "",
    rotulo: "",
    nome: texto,
    desc: "",
    tempo: TEMPO_FAIXA,
  });
  return true;
}
