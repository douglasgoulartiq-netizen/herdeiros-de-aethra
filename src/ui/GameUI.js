// Telas de inventário, missões, loja, forja, diálogo e HUD (tudo em DOM/HTML).
import { caminhoDoIcone } from "../data/itemIcons.js";
import { RARITY_COLORS, RARITY_LABEL, equiparItem, desequiparItem, usarConsumivel, venderItem, comprarItem, comprarLote, previaVendaEmLote, venderItensEmLote, custoServicoLoja, comprarServicoLoja } from "../systems/InventorySystem.js";
import { receitaDisponivel, craftar } from "../systems/CraftingSystem.js";
import { itemPodeSerAprimorado, nivelAprimoramento, custoProximoNivel, podeAprimorar, aprimorarItem, MAX_NIVEL_APRIMORAMENTO,
  escolherSubStatusDoMarco,
  temMarcoPendente} from "../systems/EnchantSystem.js";
import { iniciarMissao, missaoPronta, concluirMissao, ehMissaoPrincipal, missaoRastreada, rastrearMissao, progressoDaMissao, textoObjetivoMissao } from "../systems/QuestSystem.js";
import { missoesDiariasParaExibir, coletarRecompensaDiaria } from "../systems/DailyQuestSystem.js";
import { ganharXP, aplicarCrescimento, cryptoId, NIVEL_MAXIMO_PERSONAGEM } from "../systems/CharacterFactory.js";
import { temCompraDisponivel } from "../systems/SkillTreeSystem.js";

// BUG ANTIGO, achado pelo teste da masmorra: `REPUTACAO_POR_MISSAO` era
// usado duas vezes ao concluir uma missão pelo diálogo de NPC e não estava
// declarado em lugar nenhum do projeto (conferido: só estas duas linhas o
// mencionavam). Toda entrega de missão por diálogo lançava
// "REPUTACAO_POR_MISSAO is not defined" e a recompensa não chegava a ser
// mostrada. O valor segue a mesma régua de REPUTACAO_POR_CHEFE (20 em
// BattleUI.js): uma missão vale menos que derrubar um chefe.
const REPUTACAO_POR_MISSAO = 8;
import { adicionarFragmentos, checarConquistas } from "../systems/GachaSystem.js";
import { testesDoContexto, testeJaFeito, marcarTesteFeito, realizarTeste } from "../systems/SkillCheckSystem.js";
import { getReputacao, alterarReputacao, tierDaReputacao, multiplicadorPrecoLoja, registrarDecisao } from "../systems/WorldStateSystem.js";
import { zonaFoiVisitada } from "../systems/FastTravelSystem.js";
import { conjuntosParaExibir } from "../systems/SetBonusSystem.js";
import { registrarEvento } from "../systems/TelemetrySystem.js";
import { mostrarRolagemD20 } from "./DiceAnimation.js";
import { personagemTemCaminhoHerdeiro } from "./TalentTreeUI.js";
import { planejarEquipamento, aplicarPlanoEquipamento, autoEquiparSlotsVazios, garantirPrefAutoEquipar } from "../systems/AutoEquipSystem.js";
import { abrirTela, fecharTela, LARGURA, criarGrade, criarSplit, abrirSheet, fecharSheet, ehMobile, montarAbas, montarNavbar, marcarNavbarAtiva, marcarInteracaoAutomatica } from "./HdaUI.js";
import { falaAtual, reacaoPorReputacao, reacaoARaca, registrarConversa } from "../systems/NpcSystem.js";
import { questsOferecidasPor, aceitarQuestRegional, concluirQuestRegional, progressoObjetivoRegional } from "../systems/RegionalQuestSystem.js";
import { questRegionalPorId, PASSOS_INICIAIS } from "../data/world/regionalQuests.js";
import { linhasDaConsequencia, resumoDaConsequencia } from "../systems/ConsequenciaTexto.js";
import { reproduzirCutscene } from "./CutsceneUI.js";
import { textoSubStatus, GRAU_ROTULO, GRAU_COR, MARCOS, NIVEL_MAXIMO as SUB_NIVEL_MAX } from "../systems/SubStatusSystem.js";
import { celebrarNivel } from "./CartaoUI.js";
import { cenaDeAbertura, cenaDaMissao, jaViu } from "../systems/CutsceneSystem.js";
import { proximoPassoAltaverde, podeRecrutarAshryn, recrutarAshryn } from "../systems/JornadaSystem.js";
import { destinoAtual, textoObjetivo, textoRecompensa } from "../systems/DestinoSystem.js";
import { opcaoDeOrigem } from "../systems/ExplorationEventSystem.js";
import { textoDescontoOrigem } from "../systems/IdentidadeSystem.js";
import { somConfirmar, somCancelar, somBloqueioOuErro } from "./SoundFX.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

export function fecharModal() {
  fecharTela();
}

// Casca de tela padrão. Antes montava tudo num bloco só (`<button>Fechar</button>
// <h2>…</h2><div id="modal-corpo">`) dentro de um `#modal-conteudo` que rolava
// inteiro — por isso o título e as ações sumiam de vista junto com a lista.
// Agora delega para `abrirTela()` (ver HdaUI.js), que separa cabeçalho fixo,
// corpo rolável e barra de ações fixa. A assinatura antiga continua valendo:
// quem chamava `abrirModalBase("Título")` e recebia o corpo continua
// funcionando sem nenhuma mudança.
export function abrirModalBase(titulo, opcoes = {}) {
  const tela = abrirTela({ titulo, ...opcoes });
  telaAtual = tela;
  const corpo = tela.corpo;
  corpo.__tela = tela;
  // Telemetria mínima local (item 98 de 100_melhorias.md): ponto único que
  // cobre a maioria das telas do jogo, já que quase todas passam por aqui —
  // só o título (nunca conteúdo do jogador), pra saber onde o tempo é gasto.
  registrarEvento("tela_aberta", { tela: titulo });
  return corpo;
}

// Última casca aberta — permite às telas usarem `definirAcoes`/`definirAbas`
// sem mudar a assinatura de `abrirModalBase`.
let telaAtual = null;
export function telaAberta() { return telaAtual; }

// Re-exportado de Notificacoes.js. A implementação saiu daqui porque a
// versão antiga escrevia numa div única — a segunda mensagem apagava a
// primeira, e no modo automático (ouro, nível, poção, item em quadros
// seguidos) isso virava um borrão ilegível. A assinatura é a mesma, então
// as dezenas de chamadas espalhadas pelo jogo continuam valendo e ganham
// o visual novo sem serem tocadas.
// ATENÇÃO: `export { x } from "..."` NÃO cria binding local — este arquivo
// chama mostrarMensagem() 14 vezes, e um re-export puro daria ReferenceError
// em todas. Por isso: importa (para uso interno) E reexporta (para quem
// importava daqui).
import {
  mostrarMensagem, notificar, notificarGanho, notificarSucesso,
  notificarAviso, notificarErro, limparNotificacoes,
} from "./Notificacoes.js";

export {
  mostrarMensagem, notificar, notificarGanho, notificarSucesso,
  notificarAviso, notificarErro, limparNotificacoes,
};

// =====================================================================
// ARQUITETURA DE NAVEGAÇÃO (itens 13, 43, 44, 45, 82, 83, 84)
//
// O HUD tinha 15 botões soltos numa coluna vertical à direita. No desktop
// isso já era uma parede sem hierarquia; no celular a coluna simplesmente
// não cabia na tela.
//
// Agora existe UMA definição de navegação, usada pelos dois formatos
// (item 84): no desktop ela vira a mesma coluna, mas AGRUPADA por hub; no
// celular vira a barra inferior de 5 destinos, e cada hub abre a sua lista
// num painel. A profundidade máxima é hub → ação (item 83) — nenhuma função
// ficou a três níveis de distância.
//
// Os `id` originais (#btn-caminhos, #btn-auto) foram preservados porque
// atualizarHUD, main.js e BattleUI.js os procuram pelo id.
// De cinco hubs para QUATRO. O "Codex" era um hub inteiro para uma única
// ação (Compêndio) — um destino de primeiro nível que abria uma tela só, o
// que desperdiça um dos poucos lugares que o jogador consegue memorizar.
// Compêndio desceu para Jornada, que é onde mora o resto do conhecimento do
// mundo (Atlas, Diário, Missões), e Forja subiu para Mochila, que é onde o
// jogador já está quando pensa em item. Sobram quatro blocos com peso
// parecido — 4, 5, 3 e 5 ações — em vez de 4, 4, 2, 1 e 6.
//
// O "Modo Automático" saiu do hub e virou botão solto no trilho (ver
// montarNavegacao): ele é um ESTADO ligado/desligado que pisca enquanto está
// ativo, e um estado escondido dentro de um menu fechado não é um estado
// visível. #btn-auto continua existindo com o mesmo id porque main.js e
// BattleUI.js o procuram por ele.
export const ACAO_AUTO = { acao: "auto", rotulo: "Modo Automático", icone: "▶", atalho: "P", id: "btn-auto" };

export const HUBS = [
  // `curto` é o rótulo do trilho, onde cabem 68px: "Personagem" virava
  // "PERSON…" e uma palavra cortada não é um rótulo. Na barra do celular e no
  // título do painel continua valendo o nome inteiro.
  { id: "personagem", icone: "🛡️", rotulo: "Companhia", curto: "Equipe", acoes: [
    { acao: "estado", rotulo: "Heróis", icone: "👤", atalho: "K" },
    { acao: "equipamento", rotulo: "Equipamento", icone: "🎒", atalho: "I" },
    { acao: "arvore", rotulo: "Evolução · Habilidades", icone: "✨", atalho: "T" },
    { acao: "caminhos", rotulo: "Caminhos do Herdeiro", icone: "🌌", atalho: "H", id: "btn-caminhos" },
    // "Time" saiu de dentro do painel de invocação e virou tela própria
    // (PartyUI.js). Antes, para vestir um convocado era preciso passar pelo
    // gacha — uma tela de sorteio — o que misturava duas coisas que não têm
    // nada a ver uma com a outra.
    { acao: "party", rotulo: "Formação e companheiros", icone: "🛡️", atalho: "Y" },
  ] },
  // Mapa, viagens e atlas compartilham Jornada → Mapa. Os atalhos de
  // teclado antigos continuam disponíveis sem duplicar entradas no menu.
  { id: "jornada", icone: "🧭", rotulo: "Jornada", acoes: [
    { acao: "missoes", rotulo: "Missões", icone: "📜", atalho: "M" },
    { acao: "mapa", rotulo: "Mapa de Aethra", icone: "🗺️", atalho: "U" },
    { acao: "compendio", rotulo: "Códice", icone: "📚", atalho: "C" },
  ] },
  { id: "invocar", icone: "✨", rotulo: "Invocar", acoes: [
    { acao: "gacha", rotulo: "Invocar heróis", icone: "✨", atalho: "G" },
  ] },
  { id: "mais", icone: "⋯", rotulo: "Menu", acoes: [
    { acao: "tutorial", rotulo: "Tutorial e ajuda", icone: "🎓", atalho: "F1" },
    { acao: "descansar", rotulo: "Descansar", icone: "💤", atalho: "R" },
    { acao: "sair_masmorra", rotulo: "Sair da Masmorra", icone: "🚪" },
    { acao: "salvar", rotulo: "Salvar", icone: "💾", atalho: "S" },
    { acao: "acessibilidade", rotulo: "Acessibilidade", icone: "⚙️" },
  ] },
];

// `montarNavegacao` roda novamente em toda troca de tamanho/orientação.
// Os elementos antigos são substituídos, mas listeners ligados em `document`
// sobreviveriam a eles e se acumulariam. Um controlador por montagem encerra
// o ciclo anterior antes de instalar o novo, inclusive após várias rotações.
let eventosNavegacao = null;

// Monta a navegação nos dois formatos a partir de HUBS. Chamada uma vez pelo
// boot (main.js) e de novo em toda troca de orientação/tamanho.
export function montarNavegacao(onAcao) {
  eventosNavegacao?.abort();
  eventosNavegacao = new AbortController();
  const { signal } = eventosNavegacao;
  const hud = document.getElementById("hud-buttons");
  if (hud) {
    // TRILHO LATERAL (desktop). A parede de 17 botões empilhados ocupava 760
    // pixels da direita da tela — um quinto do mundo escondido atrás de um
    // menu que fica aberto o tempo todo mesmo quando não se está usando. E
    // como o #hud é um flex com align-items: center, a altura dessa torre
    // era o que jogava a caixa de identidade para o MEIO da tela, em cima do
    // personagem.
    //
    // Agora são quatro abas de 64px e um painel que só existe enquanto está
    // aberto. Fechado, o menu inteiro custa 64px de largura; aberto, ele
    // cobre um retângulo do canto direito e some no clique seguinte.
    hud.className = "hda-vira-navbar hud-trilho";
    hud.innerHTML = "";

    const paineis = document.createElement("div");
    paineis.className = "hud-paineis";

    const abas = document.createElement("div");
    abas.className = "hud-abas";
    abas.setAttribute("role", "group");
    abas.setAttribute("aria-label", "Menus do jogo");

    let abertoId = null;
    const fecharPainel = () => {
      abertoId = null;
      paineis.querySelectorAll(".hud-painel").forEach((p) => {
        p.classList.add("hidden");
        p.hidden = true;
      });
      abas.querySelectorAll("button[data-hub]").forEach((b) => {
        b.classList.remove("ativa");
        b.setAttribute("aria-expanded", "false");
      });
      hud.classList.remove("aberto");
    };
    const abrirPainel = (id) => {
      if (abertoId === id) { fecharPainel(); return; }
      abertoId = id;
      paineis.querySelectorAll(".hud-painel").forEach((p) => {
        const oculto = p.dataset.hub !== id;
        p.classList.toggle("hidden", oculto);
        p.hidden = oculto;
      });
      abas.querySelectorAll("button[data-hub]").forEach((b) => {
        const ativo = b.dataset.hub === id;
        b.classList.toggle("ativa", ativo);
        b.setAttribute("aria-expanded", String(ativo));
      });
      hud.classList.add("aberto");
    };

    for (const hub of HUBS) {
      const aba = document.createElement("button");
      aba.type = "button";
      aba.dataset.hub = hub.id;
      aba.id = `hud-hub-${hub.id}`;
      aba.setAttribute("aria-expanded", "false");
      aba.setAttribute("aria-controls", `hud-painel-${hub.id}`);
      aba.title = hub.rotulo;
      aba.innerHTML = `<span class="hud-aba-icone" aria-hidden="true">${hub.icone}</span><span class="hud-aba-rotulo">${hub.curto || hub.rotulo}</span>`;
      aba.onclick = (ev) => { ev.stopPropagation(); abrirPainel(hub.id); };
      abas.appendChild(aba);

      // Todos os painéis nascem no DOM (escondidos). É isso que mantém
      // #btn-caminhos existindo mesmo com o menu fechado — atualizarHUD
      // liga e desliga esse botão pelo id, e um id que só existe quando o
      // menu está aberto seria um id que não existe na hora em que é usado.
      const painel = document.createElement("div");
      painel.className = "hud-painel hidden";
      painel.id = `hud-painel-${hub.id}`;
      painel.dataset.hub = hub.id;
      painel.hidden = true;
      painel.setAttribute("role", "region");
      painel.setAttribute("aria-labelledby", aba.id);
      painel.innerHTML = `<span class="hud-painel-rotulo">${hub.icone} ${hub.rotulo}</span>`;
      for (const a of hub.acoes) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.action = a.acao;
        if (a.id) b.id = a.id;
        if (a.ocultavel) b.classList.add("hidden");
        b.innerHTML = `<span class="hud-acao-icone" aria-hidden="true">${a.icone}</span><span class="hud-acao-rotulo">${a.rotulo}</span>${a.atalho ? `<kbd>${a.atalho}</kbd>` : ""}`;
        b.onclick = () => { fecharPainel(); onAcao(a.acao); };
        painel.appendChild(b);
      }
      paineis.appendChild(painel);
    }

    // O Automático fica FORA das abas, sempre visível: ele é um estado que
    // pisca enquanto está ligado, e estado escondido dentro de menu fechado
    // não comunica nada. Mesmo id de sempre (#btn-auto).
    const auto = document.createElement("button");
    auto.type = "button";
    auto.id = ACAO_AUTO.id;
    auto.className = "hud-aba hud-aba-auto";
    auto.dataset.action = ACAO_AUTO.acao;
    auto.title = `${ACAO_AUTO.rotulo} (${ACAO_AUTO.atalho})`;
    auto.innerHTML = `<span class="hud-aba-icone" aria-hidden="true">${ACAO_AUTO.icone}</span><span class="hud-aba-rotulo">Auto</span>`;
    // Ligar/desligar a viagem não recolhe o painel em uso: o jogador pode
    // configurar herói, jornada ou mochila enquanto o mundo continua ao
    // fundo. O painel só será fechado pelo fluxo de entrada em combate.
    auto.onclick = (ev) => { ev.stopPropagation(); onAcao(ACAO_AUTO.acao); };
    abas.appendChild(auto);

    hud.appendChild(paineis);
    hud.appendChild(abas);

    // Clicar no mundo ou apertar Esc fecha o painel. Sem isto o menu aberto
    // vira um estado preso: some só se você acertar a mesma aba de novo.
    document.addEventListener("click", (ev) => { if (abertoId && !hud.contains(ev.target)) fecharPainel(); }, { signal });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && abertoId) fecharPainel(); }, { signal });
  }

  // Barra inferior (celular). Um hub com uma única ação abre direto; os
  // demais abrem a lista num painel — nunca mais de dois toques (item 83).
  montarNavbar(HUBS.map((h) => ({ id: h.id, icone: h.icone, rotulo: h.rotulo })), (id) => {
    const hub = HUBS.find((h) => h.id === id);
    if (!hub) return;
    marcarNavbarAtiva(id);
    if (hub.direto) { fecharSheet(); onAcao(hub.direto); return; }
    const visiveis = hub.acoes.filter((a) => {
      if (!a.ocultavel) return true;
      const el = document.getElementById(a.id);
      return el && !el.classList.contains("hidden");
    });
    // No celular o Automático entra no fim de "Mais": lá o trilho não
    // existe, e sem esta linha o modo automático ficaria inalcançável pelo
    // dedo — só pelo atalho de teclado, que num celular não existe.
    const acoes = hub.id === "mais" ? [...visiveis, ACAO_AUTO] : visiveis;
    abrirSheet({
      titulo: `${hub.icone} ${hub.rotulo}`,
      corpoHTML: "",
      acoes: acoes.map((a) => ({
        rotulo: `${a.icone} ${a.rotulo}`,
        onClick: () => { fecharSheet(); onAcao(a.acao); },
      })),
      aoFechar: () => marcarNavbarAtiva(null),
    });
  });
}

export function atualizarHUD(personagem) {
  // Botão "Caminhos do Herdeiro" (task #95) só aparece pra quem tem árvore
  // de verdade hoje (Guerreiro/Mago — "profundo em 2 classes primeiro");
  // outras classes continuam só com o botão "Habilidades" antigo.
  const btnCaminhos = document.getElementById("btn-caminhos");
  // A Herança do Mundo existe para qualquer classe. Guerreiro e Mago têm
  // ramos próprios mais profundos, mas esconder todo o destino tirava do
  // Patrulheiro (e das demais classes) o acesso aos nós universais.
  if (btnCaminhos) btnCaminhos.classList.remove("hidden");
  const nivelMaximo = personagem.nivel >= NIVEL_MAXIMO_PERSONAGEM;
  const atualizarBarra = (id, atual, max, rotulo, texto = null) => {
    const fill = document.getElementById(id);
    if (!fill) return;
    const limite = Math.max(1, Number(max) || 1);
    const valor = Math.max(0, Math.min(limite, Number(atual) || 0));
    fill.style.width = `${Math.max(0, Math.min(100, (valor / limite) * 100))}%`;
    const barra = fill.parentElement;
    if (!barra) return;
    barra.setAttribute("role", "progressbar");
    barra.setAttribute("aria-label", rotulo);
    barra.setAttribute("aria-valuemin", "0");
    barra.setAttribute("aria-valuemax", String(limite));
    barra.setAttribute("aria-valuenow", String(valor));
    barra.setAttribute("aria-valuetext", texto || `${valor} de ${limite}`);
  };
  atualizarBarra("hud-hp", personagem.hp, personagem.hpMax, "Pontos de vida");
  atualizarBarra("hud-mp", personagem.mp, personagem.mpMax, "Pontos de magia");
  atualizarBarra(
    "hud-xp",
    nivelMaximo ? personagem.xpProximo : personagem.xp,
    personagem.xpProximo,
    "Experiência",
    nivelMaximo ? `Nível máximo ${NIVEL_MAXIMO_PERSONAGEM}` : null,
  );
  const fragmentos = personagem.gacha ? personagem.gacha.fragmentos : 0;
  // New Game+ (melhoria pós-backlog original): selo visível só quando o
  // personagem está numa run de NG+ (ngPlus > 0) — jogo normal fica igual a
  // antes desta melhoria existir.
  const seloNgPlus = personagem.ngPlus > 0 ? ` <span class="badge-ng-plus" title="New Game+: monstros mais fortes e valem mais XP/ouro">🔥 NG+${personagem.ngPlus}</span>` : "";
  // Modo História (melhoria pós-backlog): selo visível só quando ligado —
  // mesmo padrão do selo de NG+ acima, jogo normal fica igual a antes desta
  // melhoria existir.
  const seloModoHistoria = personagem.modoHistoria ? ` <span class="badge-modo-historia" title="Modo História: monstros mais fracos, XP/ouro normais">📖 Modo História</span>` : "";
  // Item 31 de 100_melhorias.md: próximo marco de progressão sempre visível
  // (aqui, o mais simples e universal — faltam quantos XP pro próximo
  // nível), sem precisar abrir nenhuma tela.
  const faltamXP = nivelMaximo ? 0 : Math.max(0, personagem.xpProximo - personagem.xp);

  // Os números saíram de dentro de um parágrafo de texto e viraram rótulos
  // em cima das próprias barras: "HP 58/58" ao lado da barra de HP diz a
  // mesma coisa que a barra e ocupa o mesmo lugar. Antes a linha de recursos
  // repetia HP e MP que já estavam desenhados dois centímetros ao lado.
  const num = (id, txt, dica) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = txt;
    if (dica) el.title = dica;
  };
  num("hud-hp-num", `${personagem.hp}/${personagem.hpMax}`, "Pontos de vida");
  num("hud-mp-num", `${personagem.mp}/${personagem.mpMax}`, "Pontos de magia");
  // A frase inteira virou dica da barra. Ela ficava numa segunda linha embaixo
  // do nome dizendo a mesma coisa que o número ao lado da barra de XP — duas
  // vezes o mesmo dado em 3cm de faixa.
  num("hud-xp-num", nivelMaximo ? "NÍVEL MÁX." : `faltam ${faltamXP}`, nivelMaximo ? `Nível máximo ${NIVEL_MAXIMO_PERSONAGEM}` : `Faltam ${faltamXP} XP para o nível ${personagem.nivel + 1}`);

  // As três linhas viraram três elementos com classe própria. O motivo é o
  // celular em pé: o bloco inteiro ocupava três linhas de texto no topo da
  // tela cheia, tampando o mundo justo na direção em que o jogador anda. Com
  // classes, o CSS esconde as duas linhas de menu (ouro, fragmentos, XP que
  // falta — tudo isso está a um toque de distância nas telas) e mantém quem
  // você é e de que nível, que é o que se lê de relance.
  document.getElementById("hud-info").innerHTML =
    `<span class="hud-linha-identidade"><b>${personagem.nome}</b><span class="hud-nivel">Nv. ${personagem.nivel}</span><span class="hud-classe">${personagem.classeIcone || ""} ${personagem.classeNome}</span>${seloNgPlus}${seloModoHistoria}</span>`
    + `<span class="hud-linha-xp">Faltam ${faltamXP} XP para o nível ${personagem.nivel + 1}</span>`;

  // Ouro e fragmentos saíram do parágrafo e viraram duas fichas próprias no
  // canto direito da faixa — é o canto em que o jogador procura moeda em
  // qualquer RPG, e como ficha o número muda de valor sem reescrever texto.
  const bolsa = document.getElementById("hud-bolsa");
  if (bolsa) {
    bolsa.innerHTML =
      `<span class="hud-ficha" title="Ouro"><span aria-hidden="true">🪙</span>${personagem.ouro}</span>`
      + `<span class="hud-ficha" title="Fragmentos de invocação"><span aria-hidden="true">💠</span>${fragmentos}</span>`;
  }
}

// Pequeno sinal no menu, não um pop-up: só acende quando existe uma sugestão
// nova que aumenta o PC em pelo menos 2%. O cálculo fica no sistema puro;
// esta função apenas traduz a recomendação para os ícones que já existem.
export function atualizarIndicadorRecomendacaoTime(personagem, recomendacao, chave) {
  const nova = !!recomendacao && personagem?.recomendacaoTimeVistaChave !== chave;
  const seletores = ['[data-action="party"]', '[data-hub="personagem"]', '[data-hub="mochila"]'];
  document.querySelectorAll(seletores.join(",")).forEach((el) => {
    el.classList.toggle("tem-recomendacao-time", nova);
    if (nova) el.title = `Sugestão de time: +${recomendacao.ganhoPct}% de Poder de Combate`;
  });
}

export function itemCardHTML(item, extraBotoesHTML = "") {
  const cor = RARITY_COLORS[item.raridade] || "#888";
  return `
    <div class="card">
      <span class="icon-frame" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" /></span>
      <div class="info">
        <div class="nome">${item.nome} <span class="raridade-badge" style="background:${cor}">${RARITY_LABEL[item.raridade]}</span></div>
        <div class="desc">${item.descricao || ""}</div>
      </div>
      <div>${extraBotoesHTML}</div>
    </div>`;
}

// Ordem fixa dos 7 slots de equipamento — sempre renderizados, vazios ou
// não, pra virar um painel visual estável em vez de uma lista que só mostra
// o que está preenchido (task #39).
// Exportado para a tela unificada de Party (PartyUI.js) usar a MESMA lista.
// Duplicar sete slots em dois arquivos é como um slot novo aparece num
// lugar e some no outro.
export const SLOTS_EQUIPAMENTO = [
  { slot: "arma", label: "Arma", icone: "⚔️" },
  { slot: "peito", label: "Peito", icone: "🛡️" },
  { slot: "cabeca", label: "Cabeça", icone: "🪖" },
  { slot: "pes", label: "Pés", icone: "👢" },
  { slot: "escudo", label: "Escudo", icone: "🔰" },
  { slot: "anel", label: "Anel", icone: "💍" },
  { slot: "amuleto", label: "Amuleto", icone: "📿" },
];

// Comparação equipado x candidato (melhoria de jogabilidade #16): mostra só
// as estatísticas que DIFEREM entre o item já equipado no slot e o item da
// mochila, com sinal de melhor/pior — evita o jogador ter que abrir duas
// telas ou fazer conta de cabeça pra saber se vale a pena trocar. Mesma
// lista de slots usada por SLOTS_EQUIPAMENTO acima (arma/peito/cabeca/pes/
// escudo/anel/amuleto).
function slotDoItemParaComparacao(item) {
  if (item.tipo === "arma") return "arma";
  if (item.tipo === "armadura" || item.tipo === "acessorio") return item.slot || null;
  return null;
}

const LABEL_STAT_COMPARACAO = { dano: "Dano", defesa: "Defesa", bonus_FOR: "FOR", bonus_DES: "DES", bonus_CON: "CON", bonus_INT: "INT" };

function statsComparaveis(item) {
  const stats = {};
  if (typeof item.dano === "number") stats.dano = item.dano;
  if (typeof item.defesa === "number") stats.defesa = item.defesa;
  if (item.bonusAtributo) Object.entries(item.bonusAtributo).forEach(([atributo, valor]) => { stats[`bonus_${atributo}`] = valor; });
  return stats;
}

// Retorna só as linhas que DIFEREM entre os dois itens — `null` se não há
// nada equipado nesse slot pra comparar (a mochila nunca tem os dois iguais
// pra que a lista fique vazia sem sentido nenhum).
function compararComEquipado(candidato, equipado) {
  if (!equipado || equipado.uid === candidato.uid) return null;
  const statsCand = statsComparaveis(candidato);
  const statsEquip = statsComparaveis(equipado);
  const chaves = new Set([...Object.keys(statsCand), ...Object.keys(statsEquip)]);
  const linhas = [];
  chaves.forEach((chave) => {
    const atual = statsEquip[chave] || 0;
    const novo = statsCand[chave] || 0;
    if (atual === novo) return;
    linhas.push({ label: LABEL_STAT_COMPARACAO[chave] || chave, atual, novo, melhor: novo > atual });
  });
  const elementoMudou = (candidato.elemento || null) !== (equipado.elemento || null);
  return { linhas, elementoMudou, elementoNovo: candidato.elemento || null, elementoAtual: equipado.elemento || null };
}

function comparacaoEquipamentoHTML(candidato, alvo) {
  const slot = slotDoItemParaComparacao(candidato);
  if (!slot) return "";
  const equipado = alvo.equipamento[slot];
  const cmp = compararComEquipado(candidato, equipado);
  if (!cmp || (!cmp.linhas.length && !cmp.elementoMudou)) return "";
  const linhasHTML = cmp.linhas.map((l) =>
    `<span class="comparacao-stat ${l.melhor ? "melhor" : "pior"}">${l.label}: ${l.atual} → ${l.novo} (${l.melhor ? "+" : ""}${l.novo - l.atual})</span>`
  ).join(" ");
  const elementoHTML = cmp.elementoMudou
    ? `<span class="comparacao-stat elemento">Elemento: ${cmp.elementoAtual || "físico"} → ${cmp.elementoNovo || "físico"}</span>`
    : "";
  return `<div class="comparacao-equip" title="Comparado com ${equipado.nome}, já equipado neste slot">vs. equipado (${equipado.nome}): ${linhasHTML}${elementoHTML}</div>`;
}

export function slotEquipadoHTML({ slot, label, icone }, item) {
  if (!item) {
    return `
      <div class="equip-slot vazio" data-slot="${slot}">
        <span class="equip-slot-icone">${icone}</span>
        <div class="equip-slot-label">${label}</div>
        <div class="equip-slot-vazio-texto">Vazio</div>
      </div>`;
  }
  const cor = RARITY_COLORS[item.raridade] || "#888";
  return `
    <div class="equip-slot preenchido" data-slot="${slot}" style="border-color:${cor}">
      <span class="icon-frame" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" /></span>
      <div class="equip-slot-label">${label}</div>
      <div class="equip-slot-item-nome">${item.nome}</div>
      <button data-slot="${slot}" class="btn-desequipar">Remover</button>
    </div>`;
}

// ---- Painel de equipamento automático (aba "Equipado") ----------------
// Regra combinada com o jogador: slot VAZIO se resolve sozinho; peça já
// equipada só troca se ele mandar. Por isso são duas coisas separadas aqui —
// um interruptor pro automático silencioso e um botão explícito pro resto.
//
// O botão nunca aplica direto: ele MOSTRA o que pretende trocar (com a
// diferença de estatísticas de cada peça) e espera a confirmação. Trocar
// equipamento sem avisar é a maneira mais rápida de desfazer uma build que o
// jogador montou de propósito.
function painelAutoEquipar(personagem, time, dados, aoAplicar) {
  const painel = document.createElement("div");
  painel.className = "auto-equipar";
  // Sem contexto (chamador antigo que não passou dados/time) o painel
  // simplesmente não existe — a tela volta a ser a de antes.
  if (!dados || !time) return painel;

  garantirPrefAutoEquipar(personagem);
  painel.innerHTML = `
    <h3>⚙️ Equipamento automático</h3>
    <label class="auto-equipar-check">
      <input type="checkbox" id="chk-auto-equipar"${personagem.autoEquiparVazios ? " checked" : ""}/>
      <span>Vestir sozinho quando o slot estiver <b>vazio</b> (você e o time)</span>
    </label>
    <p class="desc auto-equipar-nota">Peça que você já escolheu nunca é trocada sem sua ordem. Pra revisar trocas, use o botão abaixo.</p>
    <div class="auto-equipar-acoes"></div>
    <div class="auto-equipar-plano"></div>`;

  painel.querySelector("#chk-auto-equipar").onchange = (ev) => {
    personagem.autoEquiparVazios = ev.target.checked;
    // Ligar já vale pra agora: preenche o que estiver vazio na hora, em vez
    // de esperar o próximo baú.
    if (personagem.autoEquiparVazios) autoEquiparSlotsVazios(personagem, time, dados);
    aoAplicar();
  };

  const areaAcoes = painel.querySelector(".auto-equipar-acoes");
  const areaPlano = painel.querySelector(".auto-equipar-plano");

  const btn = document.createElement("button");
  btn.textContent = "⚡ Otimizar equipamento";
  btn.className = "btn-otimizar";
  btn.title = "Procura na mochila trocas que aumentem o poder de combate — você vê a lista antes de qualquer coisa mudar";
  btn.onclick = () => {
    const plano = planejarEquipamento(personagem, time, dados, { incluirUpgrades: true });
    if (!plano.length) {
      areaPlano.innerHTML = `<p class="desc auto-equipar-ok">✅ Nada a melhorar: o que está na mochila não supera o que já está vestido.</p>`;
      return;
    }
    areaPlano.innerHTML = `
      <p class="auto-equipar-titulo">${plano.length} troca${plano.length > 1 ? "s" : ""} sugerida${plano.length > 1 ? "s" : ""}:</p>
      <ul class="auto-equipar-lista">${plano.map((a) => linhaPlanoHTML(a, personagem)).join("")}</ul>
      <div class="auto-equipar-confirma">
        <button class="btn-aplicar-plano">✅ Aplicar tudo</button>
        <button class="btn-cancelar-plano">Cancelar</button>
      </div>`;
    areaPlano.querySelector(".btn-cancelar-plano").onclick = () => { somCancelar(); areaPlano.innerHTML = ""; };
    areaPlano.querySelector(".btn-aplicar-plano").onclick = () => {
      aplicarPlanoEquipamento(personagem, plano);
      somConfirmar();
      aoAplicar();
    };
  };
  areaAcoes.appendChild(btn);

  return painel;
}

// Uma linha do plano: quem, qual slot, o que sai, o que entra e por quê.
// Reaproveita compararComEquipado() (a mesma comparação que a grade da
// mochila já mostra) pra o jogador ler a troca com a régua que ele conhece.
function linhaPlanoHTML(acao, personagemPrincipal) {
  const quem = acao.alvo === personagemPrincipal ? "" : `<b>${acao.alvoNome}</b> · `;
  const rotuloSlot = (SLOTS_EQUIPAMENTO.find((s) => s.slot === acao.slot) || { label: acao.slot, icone: "•" });
  if (!acao.itemAnterior) {
    return `<li class="auto-equipar-item vazio">${quem}${rotuloSlot.icone} ${rotuloSlot.label}: <i>vazio</i> → <b>${acao.item.nome}</b></li>`;
  }
  const cmp = compararComEquipado(acao.item, acao.itemAnterior);
  const diffs = cmp
    ? cmp.linhas.map((l) => `<span class="comparacao-stat ${l.melhor ? "melhor" : "pior"}">${l.label} ${l.novo > l.atual ? "+" : ""}${l.novo - l.atual}</span>`).join(" ")
    : "";
  return `<li class="auto-equipar-item">${quem}${rotuloSlot.icone} ${rotuloSlot.label}: ${acao.itemAnterior.nome} → <b>${acao.item.nome}</b> ${diffs}</li>`;
}

// Agrupa itens idênticos (mesmo `id`) da mochila numa única pilha visual —
// a mochila em si continua guardando um objeto por unidade (cada um com seu
// próprio uid, ver InventorySystem.js), isso é só apresentação (task #39).
// Exportada (e não só usada internamente) pra dar pra testar a lógica de
// agrupamento sem precisar de DOM — ver scripts/test_inventory_ui.mjs.
// ORDEM DE RELEVÂNCIA da mochila (pedido: "do mais relevante para o menos").
//
// A ordem era a de INSERÇÃO — a ordem em que os itens caíram, que é a mesma
// coisa que ordem nenhuma. Com 287 itens no catálogo e a mochila crescendo a
// luta inteira, o que interessa fica soterrado no fim da lista.
//
// A régua, de fora para dentro:
//   1. EQUIPAMENTO antes de consumível, e consumível antes de material.
//      Material é insumo de forja; nunca é a resposta para "o que eu faço
//      agora".
//   2. RARIDADE decrescente. É a leitura que o jogador já faz pela cor.
//   3. PODER decrescente (soma dos números do item) — desempata dois épicos.
//   4. NOME, só para a ordem ser estável entre redesenhos: sem isso dois
//      itens empatados trocam de lugar a cada tecla digitada na busca.
export const ORDEM_TIPO = { arma: 0, armadura: 1, acessorio: 2, consumivel: 3, material: 4 };
export const ORDEM_RARIDADE = { lendario: 0, epico: 1, raro: 2, incomum: 3, comum: 4 };

const CAMPOS_PODER_ITEM = ["dano", "danoMagico", "defesa", "bonusCritico", "bonusVelocidade", "bonusCura", "curaHP", "curaMP"];
export function relevanciaDoItem(item) {
  const poder = CAMPOS_PODER_ITEM.reduce((s, k) => s + (Number(item[k]) || 0), 0)
    + Object.values(item.bonusAtributo || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  return {
    tipo: ORDEM_TIPO[item.tipo] != null ? ORDEM_TIPO[item.tipo] : 9,
    raridade: ORDEM_RARIDADE[item.raridade] != null ? ORDEM_RARIDADE[item.raridade] : 9,
    poder,
  };
}

export function ordenarPorRelevancia(pilhas) {
  return [...pilhas].sort((a, b) => {
    const ra = relevanciaDoItem(a.item);
    const rb = relevanciaDoItem(b.item);
    return ra.tipo - rb.tipo
      || ra.raridade - rb.raridade
      || rb.poder - ra.poder
      || String(a.item.nome).localeCompare(String(b.item.nome));
  });
}

export function empilharInventario(inventario) {
  const pilhas = new Map();
  inventario.forEach((item) => {
    if (!pilhas.has(item.id)) pilhas.set(item.id, { item, uids: [] });
    pilhas.get(item.id).uids.push(item.uid);
  });
  return ordenarPorRelevancia([...pilhas.values()]);
}

// `alvo` (pedido do jogador: equipar/curar convocados do gacha, não só o
// personagem principal) — a mochila, o ouro e a compra/venda continuam
// sempre do `personagem` (dono do estoque compartilhado do time, ver
// InventorySystem.js), mas os slots de equipamento mostrados/editados e o
// alvo do botão "Usar" (consumível) são de `alvo`. Sem passar `alvo`, é
// exatamente a tela de sempre (equipar/curar a si mesmo) — chamada em
// onHudAction("inventario") em main.js. Com `alvo` diferente (chamada nova
// em GachaUI.js, botão "🎒 Equipar/Curar" de cada convocado), vira a tela
// de gerenciar aquele convocado usando os itens do personagem principal.
// `aoVoltar` (opcional): quando a tela é aberta de dentro de outra tela
// (ver botão "🎒 Equipar/Curar" na aba Time, GachaUI.js), mostra um botão
// "← Voltar" que chama esse callback em vez de só fechar tudo — mesmo
// padrão já usado por montarDespertar/montarVinculo (AwakeningUI.js/
// BondUI.js) pra voltar à Coleção.
// `contexto` ({ dados, time }) é opcional de propósito: sem ele a tela
// funciona exatamente como antes, só sem o painel de equipamento
// automático (que precisa das fórmulas do jogo e do time inteiro pra
// decidir). Assim nenhum chamador antigo quebra.
export function montarInventario(personagem, onMudar, alvo = personagem, aoVoltar = null, estadoAba = null, contexto = {}) {
  const { dados = null, time = null } = contexto;
  const ehOutroAlvo = alvo !== personagem;
  // Estado de navegação da tela (aba e item selecionado). Preservado entre
  // re-renderizações para o jogador não voltar ao topo da lista toda vez que
  // equipa alguma coisa.
  const estado = estadoAba || { aba: "todos", uidSelecionado: null };

  const tela = abrirTela({
    titulo: ehOutroAlvo ? `Inventário — ${alvo.nome}` : "Inventário",
    subtitulo: `🪙 ${personagem.ouro}`,
    largura: LARGURA.larga,
    classe: "tela-inventario",
  });
  const corpo = tela.corpo;
  registrarEvento("tela_aberta", { tela: "Inventário" });

  const redesenhar = () => montarInventario(personagem, onMudar, alvo, aoVoltar, estado, contexto);

  // ---- Abas por categoria (item 82) -----------------------------------
  const ABAS = [
    { id: "equipado", rotulo: "Equipado", icone: "🎽" },
    { id: "todos", rotulo: "Todos", icone: "🎒" },
    { id: "arma", rotulo: "Armas", icone: "⚔️" },
    { id: "armadura", rotulo: "Armaduras", icone: "🛡️" },
    { id: "acessorio", rotulo: "Acessórios", icone: "💍" },
    { id: "consumivel", rotulo: "Consumíveis", icone: "🧪" },
    { id: "material", rotulo: "Materiais", icone: "🪵" },
  ];
  tela.definirAbas(ABAS, (id) => { estado.aba = id; estado.uidSelecionado = null; redesenhar(); }, estado.aba);

  if (aoVoltar) {
    const btnVoltar = document.createElement("button");
    btnVoltar.textContent = "← Voltar ao Time";
    btnVoltar.style.cssText = "margin:0 0 10px;";
    btnVoltar.onclick = aoVoltar;
    corpo.appendChild(btnVoltar);
  }

  // ---- Aba EQUIPADO: painel de slots + conjuntos -----------------------
  if (estado.aba === "equipado") {
    const bloco = document.createElement("div");
    bloco.innerHTML = `<h3>${ehOutroAlvo ? `Equipado em ${alvo.nome}` : "Equipado"}</h3>`;
    const gridEquip = document.createElement("div");
    gridEquip.className = "equip-slots-grid";
    gridEquip.innerHTML = SLOTS_EQUIPAMENTO.map((sl) => slotEquipadoHTML(sl, alvo.equipamento[sl.slot])).join("");
    bloco.appendChild(gridEquip);
    corpo.appendChild(bloco);

    const conjuntosAtivos = conjuntosParaExibir(alvo);
    if (conjuntosAtivos.length) {
      const conjDiv = document.createElement("div");
      conjDiv.innerHTML = "<h3>Conjuntos</h3>";
      conjuntosAtivos.forEach((c) => {
        const pEl = document.createElement("p");
        pEl.className = "desc conjunto-resumo" + (c.tiersAtivos > 0 ? " conjunto-ativo" : "");
        pEl.textContent = `${c.nome}: ${c.proximoTierEm
          ? `${c.equipadas}/${c.total} peças — vista mais ${c.proximoTierEm - c.equipadas} pra ativar o próximo bônus`
          : `${c.equipadas}/${c.total} peças — todos os bônus ativos!`}`;
        conjDiv.appendChild(pEl);
      });
      corpo.appendChild(conjDiv);
    }
    corpo.querySelectorAll(".btn-desequipar").forEach((b) => b.onclick = () => {
      desequiparItem(personagem, b.dataset.slot, alvo);
      somConfirmar();
      onMudar(); redesenhar();
    });

    corpo.appendChild(painelAutoEquipar(personagem, time, dados, () => { onMudar(); redesenhar(); }));

    tela.definirAcoes([], `${SLOTS_EQUIPAMENTO.filter((sl) => alvo.equipamento[sl.slot]).length}/7 slots preenchidos`);
    return;
  }

  // ---- Demais abas: GRADE de itens -------------------------------------
  const pilhas = empilharInventario(personagem.inventario)
    .filter(({ item }) => estado.aba === "todos" || item.tipo === estado.aba);

  if (!pilhas.length) {
    const vazio = document.createElement("p");
    vazio.className = "desc";
    vazio.textContent = estado.aba === "todos" ? "Mochila vazia." : "Nenhum item desta categoria na mochila.";
    corpo.appendChild(vazio);
    tela.definirAcoes([], `🪙 ${personagem.ouro} de ouro`);
    return;
  }

  const grade = criarGrade({ densidade: "densa" });
  grade.setAttribute("role", "list");
  for (const { item, uids } of pilhas) {
    grade.appendChild(criarLadrilhoItem(item, uids, alvo, estado.uidSelecionado));
  }
  corpo.appendChild(grade);

  // ---- Seleção: painel contextual (lateral no desktop, sheet no celular)
  const selecionar = (item, uids) => {
    estado.uidSelecionado = uids[0];
    grade.querySelectorAll(".hda-ladrilho").forEach((el) => el.classList.toggle("selecionado", el.dataset.uid === uids[0]));
    abrirDetalheItem(item, uids, personagem, alvo, ehOutroAlvo, onMudar, redesenhar);
  };
  grade.querySelectorAll(".hda-ladrilho").forEach((el) => {
    const pilha = pilhas.find((x) => x.uids[0] === el.dataset.uid);
    if (!pilha) return;
    el.onclick = () => selecionar(pilha.item, pilha.uids);
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selecionar(pilha.item, pilha.uids); } };
  });

  const previaLote = previaVendaEmLote(personagem);
  const acoesLote = previaLote.quantidade ? [{
    rotulo: `Vender sucata (${previaLote.quantidade})`,
    onClick: () => abrirSheet({
      titulo: "Venda rápida protegida",
      corpoHTML: `<p>Vender <b>${previaLote.quantidade}</b> itens por <b>🪙 ${previaLote.valor}</b>?</p><p class="desc">Inclui equipamentos comuns, consumíveis acima de 5 e materiais acima de 20. Itens incomuns, raros, épicos e lendários ficam protegidos.</p>`,
      acoes: [
        { rotulo: "Cancelar", onClick: fecharSheet },
        { rotulo: `Confirmar +${previaLote.valor}o`, classe: "primario", onClick: () => {
          const r = venderItensEmLote(personagem);
          fecharSheet(); mostrarMensagem(`Venda em lote concluída: ${r.quantidade} itens por ${r.valor} de ouro.`);
          onMudar(); redesenhar();
        } },
      ],
    }),
  }] : [];
  tela.definirAcoes(acoesLote, `🪙 ${personagem.ouro} de ouro · ${pilhas.length} ${pilhas.length === 1 ? "tipo de item" : "tipos de item"}`);
}

// Ladrilho compacto de item: ícone grande, nome em no máximo duas linhas,
// raridade pela moldura E pelo rótulo (a cor nunca é o único sinal, item 61)
// e a quantidade empilhada. Todo o resto vive no painel de detalhes — é a
// informação progressiva do item 50.
export function criarLadrilhoItem(item, uids, alvo, uidSelecionado) {
  const cor = RARITY_COLORS[item.raridade] || "#888";
  const el = document.createElement("div");
  el.className = "hda-ladrilho" + (uids[0] === uidSelecionado ? " selecionado" : "");
  el.dataset.uid = uids[0];
  // Declara O QUE este ladrilho é; quem monta a ficha é Tooltip.js. O
  // atributo `title` sai de cena: ele mostra texto puro, demora ~1,5s e não
  // cabe uma ficha com números, efeitos e requisito.
  el.dataset.tipItem = uids[0];
  el.tabIndex = 0;
  el.setAttribute("role", "listitem");
  const equipavel = ["arma", "armadura", "acessorio"].includes(item.tipo);
  const slot = slotDoItemParaComparacao(item);
  const equipadoAqui = slot && alvo.equipamento[slot];
  el.innerHTML = `
    <span class="hda-ladrilho-icone icon-frame" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" alt="" /></span>
    <span class="hda-ladrilho-nome hda-clamp-2">${item.nome}</span>
    <span class="hda-ladrilho-rar" style="color:${cor}">${RARITY_LABEL[item.raridade]}</span>
    ${uids.length > 1 ? `<span class="hda-ladrilho-qtd">x${uids.length}</span>` : ""}
    ${equipavel && equipadoAqui ? `<span class="hda-ladrilho-marca" title="Você já tem algo neste slot — o detalhe compara os dois">⇄</span>` : ""}
  `;
  return el;
}

// Painel de detalhes do item. Mesmo componente nos dois formatos (item 47):
// bottom sheet no celular, painel encostado à direita no desktop. As ações
// ficam no rodapé FIXO do painel, então EQUIPAR/USAR/VENDER nunca dependem
// de rolagem (item 6/20).
function abrirDetalheItem(item, uids, personagem, alvo, ehOutroAlvo, onMudar, redesenhar) {
  const cor = RARITY_COLORS[item.raridade] || "#888";
  const precoUnitario = Math.max(1, Math.round((item.valor || 1) * 0.5));
  const comparacao = comparacaoEquipamentoHTML(item, alvo) || "";
  const corpoHTML = `
    <div class="hda-det-topo">
      <span class="icon-frame hda-det-icone" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" alt="" /></span>
      <div class="hda-det-info">
        <div class="hda-det-nome hda-nome-longo">${item.nome}</div>
        <div><span class="raridade-badge" style="background:${cor}">${RARITY_LABEL[item.raridade]}</span> <span class="desc">${item.tipo}</span></div>
      </div>
    </div>
    ${uids.length > 1 ? `<p class="desc">Você tem <b>${uids.length}</b> deste item.</p>` : ""}
    <p class="desc">${item.descricao || ""}</p>
    ${comparacao}
    <p class="desc">Valor de venda: <b>${precoUnitario}</b> de ouro cada.</p>
  `;
  const acoes = [];
  if (["arma", "armadura", "acessorio"].includes(item.tipo)) {
    acoes.push({ rotulo: ehOutroAlvo ? `Equipar em ${alvo.nome}` : "Equipar", classe: "primario",
      onClick: () => {
        const r = equiparItem(personagem, uids[0], alvo);
        if (!r.ok) { somBloqueioOuErro(); if (r.msg) mostrarMensagem(r.msg); return; }
        somConfirmar(); fecharSheet(true); onMudar(); redesenhar();
      } });
  } else if (item.tipo === "consumivel") {
    acoes.push({ rotulo: ehOutroAlvo ? `Usar em ${alvo.nome}` : "Usar", classe: "primario",
      onClick: () => {
        const r = usarConsumivel(personagem, uids[0], alvo);
        if (!r.ok) { somBloqueioOuErro(); if (r.msg) mostrarMensagem(r.msg); return; }
        somConfirmar(); if (r.msg) mostrarMensagem(r.msg); fecharSheet(true); onMudar(); redesenhar();
      } });
  }
  acoes.push({ rotulo: `Vender (${precoUnitario}o)`,
    onClick: () => { const v = venderItem(personagem, uids[0]); mostrarMensagem(`Vendido por ${v} de ouro.`); fecharSheet(); onMudar(); redesenhar(); } });
  if (uids.length > 1) {
    acoes.push({ rotulo: `Vender tudo (x${uids.length})`, classe: "perigo",
      onClick: () => {
        let total = 0;
        uids.forEach((uid) => { total += venderItem(personagem, uid); });
        mostrarMensagem(`Vendidos ${uids.length} itens por ${total} de ouro no total.`);
        fecharSheet(); onMudar(); redesenhar();
      } });
  }
  abrirSheet({ titulo: item.nome, corpoHTML, acoes });
}

function montarMissoesDiarias(corpo, personagem, onMudar) {
  const bloco = document.createElement("div");
  bloco.innerHTML = "<h3>📅 Missões Diárias</h3><p class=\"desc\">Resetam todo dia. Progresso conta sozinho enquanto você joga normalmente.</p>";
  missoesDiariasParaExibir(personagem).forEach(({ template, atual, meta, concluida, coletada }) => {
    const div = document.createElement("div");
    div.className = "card";
    const statusTxt = coletada
      ? "Recompensa já resgatada hoje. ✅"
      : `Progresso: ${atual}/${meta}${concluida ? " — pronta pra resgatar!" : ""}`;
    div.innerHTML = `<div class="info"><div class="nome">${template.icone} ${template.nome}</div>
        <div class="desc">${template.descricao}</div>
        <div class="desc">${statusTxt} · Recompensa: ${template.recompensaOuro}o + ${template.recompensaFragmentos} Fragmentos</div></div>
      <div><button ${concluida && !coletada ? "" : "disabled"} data-id="${template.id}" class="btn-resgatar-diaria">Resgatar</button></div>`;
    bloco.appendChild(div);
  });
  corpo.appendChild(bloco);
  bloco.querySelectorAll(".btn-resgatar-diaria").forEach((b) => b.onclick = () => {
    const res = coletarRecompensaDiaria(personagem, b.dataset.id);
    if (res.ok) {
      if (res.fragmentos) adicionarFragmentos(personagem, res.fragmentos);
      mostrarMensagem(`Recompensa diária resgatada: +${res.ouro} ouro, +${res.fragmentos} Fragmentos de Aethra!`);
    } else {
      mostrarMensagem(res.msg);
    }
    onMudar();
  });
}

let abaMissoesAtual = "ativas";

function nomeLegivelMissao(valor, padrao = "Região não informada") {
  if (!valor) return padrao;
  return String(valor).replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function recompensaMissao(def) {
  const partes = [];
  if (def.recompensaOuro) partes.push(`🪙 ${def.recompensaOuro}`);
  if (def.recompensaXP) partes.push(`✦ ${def.recompensaXP} XP`);
  if (def.recompensaFragmentos) partes.push(`💎 ${def.recompensaFragmentos}`);
  return partes.join(" · ") || "Recompensa narrativa";
}

function regiaoMissao(def) {
  return nomeLegivelMissao(def.mapaAlvo || def.zonaAlvo || def.regiao || def.localAlvo);
}

export function montarMissoes(personagem, dados) {
  const corpo = abrirModalBase("🧭 Missões", { largura: LARGURA.media });
  const rastreada = missaoRastreada(personagem, dados.quests);
  const resumo = document.createElement("section");
  resumo.className = `missao-rastreada-resumo${rastreada ? " ativa" : " vazia"}`;
  if (rastreada) {
    const progresso = progressoDaMissao(personagem, rastreada.def);
    const percentual = Math.round(progresso.atual / Math.max(1, progresso.meta) * 100);
    resumo.innerHTML = `
      <div class="missao-rastreada-cabecalho">
        <span class="missao-rastreada-selo">${ehMissaoPrincipal(rastreada.def) ? "✦ HISTÓRIA PRINCIPAL" : "◆ MISSÃO RASTREADA"}</span>
        <span class="missao-estado ${progresso.pronto ? "pronta" : "em-andamento"}">${progresso.pronto ? "Pronta para entregar" : "Em andamento"}</span>
      </div>
      <h3>${rastreada.def.nome}</h3>
      <p class="missao-objetivo-destaque"><span aria-hidden="true">◎</span><span><small>Objetivo atual</small>${textoObjetivoMissao(rastreada.def)}</span></p>
      <div class="missao-meta" aria-label="Informações da missão">
        <span><small>Região</small>📍 ${regiaoMissao(rastreada.def)}</span>
        <span><small>Recompensa</small>${recompensaMissao(rastreada.def)}</span>
      </div>
      <div class="missao-progresso-linha"><b>Progresso</b><span>${progresso.atual}/${progresso.meta}</span></div>
      <div class="missao-progresso" role="progressbar" aria-label="Progresso de ${rastreada.def.nome}" aria-valuemin="0" aria-valuemax="${progresso.meta}" aria-valuenow="${progresso.atual}"><i style="width:${percentual}%"></i></div>
      <div class="missao-rastreada-acoes">
        <button type="button" class="missao-ver-mapa primario">🗺️ Ver no mapa</button>
        <button type="button" class="missao-parar-rastro">Parar de rastrear</button>
      </div>`;
  } else if (proximoPassoAltaverde(personagem, dados.worldStateVariables).passo) {
    // Sem missão rastreada, mas com a Jornada de Altaverde em andamento. O
    // cabeçalho dizia "Sem objetivo rastreado" com o próximo passo da Jornada
    // escrito logo abaixo — quem está começando o jogo tem, sim, um objetivo.
    const jornadaAtual = proximoPassoAltaverde(personagem, dados.worldStateVariables);
    resumo.className = "missao-rastreada-resumo ativa";
    resumo.innerHTML = `
      <span class="missao-rastreada-selo">✦ PRÓXIMO PASSO DA JORNADA</span>
      <h3>Jornada de Altaverde · ${jornadaAtual.concluidos}/${jornadaAtual.total}</h3>
      <p class="missao-objetivo-destaque"><span aria-hidden="true">◎</span><span><small>Objetivo atual</small>${jornadaAtual.orientacao}</span></p>`;
  } else {
    resumo.innerHTML = `
      <span class="missao-rastreada-selo">◇ SEM OBJETIVO RASTREADO</span>
      <h3>${personagem.missoesAtivas.length ? "Escolha uma direção" : "Sua jornada está livre"}</h3>
      <p>${personagem.missoesAtivas.length ? "Use “Rastrear no mapa” em uma missão ativa." : "Converse com personagens marcados por ! para descobrir novas histórias."}</p>`;
  }
  corpo.appendChild(resumo);
  // SEU CAMINHO (ver DestinoSystem.js): o recado do contato de origem e o
  // passo atual da motivação escolhida na criação, com o progresso de cada
  // um. Andam sozinhos com o que o jogador já faz; a recompensa cai quando a
  // meta é alcançada.
  const caminho = destinoAtual(personagem, dados);
  if (caminho.length) {
    const secao = document.createElement("section");
    secao.className = "destino-pessoal";
    secao.setAttribute("aria-label", "Seu caminho");
    secao.innerHTML = `<span class="missao-rastreada-selo">✦ SEU CAMINHO</span>` + caminho.map((c) => {
      const pct = Math.round((c.progresso.atual / Math.max(1, c.progresso.meta)) * 100);
      return `<article class="destino-item">
        <div class="destino-cabecalho"><b>${c.icone} ${c.titulo}</b><small>${c.subtitulo}</small></div>
        ${c.texto ? `<p class="destino-recado">${c.texto}</p>` : ""}
        <p class="destino-objetivo">◎ ${textoObjetivo(c.objetivo)} <b>${c.progresso.atual}/${c.progresso.meta}</b></p>
        <div class="missao-progresso" role="progressbar" aria-label="Progresso de ${c.titulo}" aria-valuemin="0" aria-valuemax="${c.progresso.meta}" aria-valuenow="${c.progresso.atual}"><i style="width:${pct}%"></i></div>
        <p class="destino-recompensa"><small>Recompensa</small> ${textoRecompensa(c.recompensa, dados)}</p>
      </article>`;
    }).join("");
    corpo.appendChild(secao);
  }
  resumo.querySelector(".missao-ver-mapa")?.addEventListener("click", () => {
    fecharModal();
    document.dispatchEvent(new CustomEvent("hda:abrir-mapa-missao"));
  });
  resumo.querySelector(".missao-parar-rastro")?.addEventListener("click", () => {
    if (!rastreada || !rastrearMissao(personagem, rastreada.def.id)) return;
    mostrarMensagem("Rastreamento removido. Você pode escolher outro objetivo quando quiser.");
    montarMissoes(personagem, dados);
  });
  const abas = document.createElement("nav");
  abas.className = "missoes-abas";
  abas.setAttribute("role", "tablist");
  abas.setAttribute("aria-label", "Categorias de missões");
  abas.innerHTML = `
    <button type="button" role="tab" aria-controls="missoes-grupo-ativas" data-missao-aba="ativas">Ativas <b>${personagem.missoesAtivas.length}</b></button>
    <button type="button" role="tab" aria-controls="missoes-grupo-diarias" data-missao-aba="diarias">Diárias</button>
    <button type="button" role="tab" aria-controls="missoes-grupo-concluidas" data-missao-aba="concluidas">Concluídas <b>${personagem.missoesConcluidas.length}</b></button>`;
  corpo.appendChild(abas);

  const grupoAtivas = document.createElement("div");
  grupoAtivas.className = "missoes-grupo";
  grupoAtivas.id = "missoes-grupo-ativas";
  grupoAtivas.setAttribute("role", "tabpanel");
  grupoAtivas.dataset.missaoGrupo = "ativas";
  const grupoDiarias = document.createElement("div");
  grupoDiarias.className = "missoes-grupo";
  grupoDiarias.id = "missoes-grupo-diarias";
  grupoDiarias.setAttribute("role", "tabpanel");
  grupoDiarias.dataset.missaoGrupo = "diarias";
  const grupoConcluidas = document.createElement("div");
  grupoConcluidas.className = "missoes-grupo";
  grupoConcluidas.id = "missoes-grupo-concluidas";
  grupoConcluidas.setAttribute("role", "tabpanel");
  grupoConcluidas.dataset.missaoGrupo = "concluidas";
  corpo.append(grupoAtivas, grupoDiarias, grupoConcluidas);
  const jornada = proximoPassoAltaverde(personagem, dados.worldStateVariables);
  const painelJornada = document.createElement("section");
  painelJornada.className = "card";
  const tituloJornada = document.createElement("h3");
  tituloJornada.textContent = `Jornada de Altaverde · ${jornada.concluidos}/${jornada.total}`;
  const objetivoJornada = document.createElement("p");
  objetivoJornada.textContent = jornada.orientacao;
  painelJornada.append(tituloJornada, objetivoJornada);
  if (podeRecrutarAshryn(personagem)) {
    const historia = document.createElement("p");
    historia.textContent = "Elric contou a Ashryn Folhaférrea sobre sua investigação. Ela oferece ajuda para descobrir o que está acontecendo com a floresta.";
    const recrutar = document.createElement("button");
    recrutar.className = "primario recrutar-aliado";
    recrutar.textContent = "Convidar Ashryn para o grupo";
    recrutar.onclick = () => {
      const resultado = recrutarAshryn(personagem, dados.gachaRoster);
      if (!resultado.ok) { mostrarMensagem("Não foi possível encontrar a aliada. Tente abrir as missões novamente."); return; }
      atualizarHUD(personagem);
      montarMissoes(personagem, dados);
      mostrarMensagem(resultado.jaPossuia ? "Ashryn reafirma seu compromisso com a jornada. Seu progresso com ela foi preservado." : resultado.noTime ? "Ashryn entrou no time! Abra Companhia para equipá-la." : "Ashryn se juntou à coleção. Escolha sua formação em Companhia.", 7000);
    };
    painelJornada.append(historia, recrutar);
  }
  grupoAtivas.appendChild(painelJornada);
  montarMissoesDiarias(grupoDiarias, personagem, () => montarMissoes(personagem, dados));
  const hSeparador = document.createElement("h3");
  hSeparador.textContent = "Missões de NPCs";
  grupoAtivas.appendChild(hSeparador);
  if (personagem.missoesAtivas.length === 0 && personagem.missoesConcluidas.length === 0) {
    const vazio = document.createElement("section");
    vazio.className = "missoes-estado-vazio";
    vazio.innerHTML = "<span aria-hidden=\"true\">🧭</span><h3>Nenhuma missão ativa</h3><p>Explore o mundo e converse com personagens marcados por <b>!</b>.</p>";
    grupoAtivas.appendChild(vazio);
  } else if (personagem.missoesAtivas.length === 0) {
    const bloqueada = document.createElement("section");
    bloqueada.className = "missoes-estado-vazio bloqueada";
    bloqueada.innerHTML = "<span aria-hidden=\"true\">🔒</span><h3>Próximo capítulo ainda bloqueado</h3><p>Continue explorando e procure personagens importantes para abrir uma nova missão.</p>";
    grupoAtivas.appendChild(bloqueada);
  }
  [...personagem.missoesAtivas].sort((a, b) => Number(ehMissaoPrincipal(dados.quests.find((q) => q.id === b.id))) - Number(ehMissaoPrincipal(dados.quests.find((q) => q.id === a.id)))).forEach((m) => {
    const def = dados.quests.find((q) => q.id === m.id);
    if (!def) return;
    const progresso = progressoDaMissao(personagem, def);
    const sendoRastreada = personagem.missaoRastreadaId === def.id;
    const div = document.createElement("div");
    div.className = `card missao-card${ehMissaoPrincipal(def) ? " principal" : ""}${sendoRastreada ? " rastreada" : ""}${progresso.pronto ? " pronta" : ""}`;
    div.innerHTML = `<div class="info">
      <div class="missao-card-topo"><span class="missao-vertente">${ehMissaoPrincipal(def) ? "✦ História principal" : "Missão de NPC"}</span>${sendoRastreada ? `<span class="missao-em-foco">◎ Em foco</span>` : ""}</div>
      <div class="nome">${def.nome}</div>
      <div class="desc missao-objetivo">${textoObjetivoMissao(def)}</div>
      <div class="missao-meta compacta"><span>📍 ${regiaoMissao(def)}</span><span>${recompensaMissao(def)}</span></div>
      <div class="missao-progresso-linha"><b>${progresso.pronto ? "Pronta para entregar" : "Progresso"}</b><span>${progresso.atual}/${progresso.meta}</span></div>
      <div class="missao-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${progresso.meta}" aria-valuenow="${progresso.atual}"><i style="width:${Math.round(progresso.atual / progresso.meta * 100)}%"></i></div>
      ${progresso.pronto ? '<div class="missao-entrega">✓ Volte ao responsável para receber a recompensa.</div>' : ""}
    </div><div class="missao-acoes"><button type="button" aria-pressed="${sendoRastreada}" class="btn-rastrear-missao${sendoRastreada ? " ativo" : ""}" data-id="${def.id}">${sendoRastreada ? "Parar de rastrear" : "Rastrear no mapa"}</button></div>`;
    grupoAtivas.appendChild(div);
  });
  corpo.querySelectorAll(".btn-rastrear-missao").forEach((b) => b.onclick = () => {
    if (!rastrearMissao(personagem, b.dataset.id)) return;
    mostrarMensagem(personagem.missaoRastreadaId ? "🧭 Missão marcada no mapa." : "Rastreamento removido.");
    montarMissoes(personagem, dados);
  });
  if (personagem.missoesConcluidas.length) {
    const h = document.createElement("h3");
    h.textContent = "Concluídas";
    grupoConcluidas.appendChild(h);
    personagem.missoesConcluidas.forEach((id) => {
      const def = dados.quests.find((q) => q.id === id);
      if (!def) return;
      const div = document.createElement("div");
      div.className = "card missao-card concluida";
      div.innerHTML = `<div class="info"><div class="missao-card-topo"><span class="missao-vertente">✓ Concluída</span></div><div class="nome">${def.nome}</div><div class="missao-meta compacta"><span>📍 ${regiaoMissao(def)}</span><span>${recompensaMissao(def)}</span></div></div>`;
      grupoConcluidas.appendChild(div);
    });
  }
  if (!personagem.missoesConcluidas.length) grupoConcluidas.innerHTML = '<p class="missoes-vazio">Nenhuma missão concluída nesta jornada.</p>';

  const ativarAba = (id) => {
    abaMissoesAtual = id;
    corpo.querySelectorAll("[data-missao-aba]").forEach((b) => {
      const ativo = b.dataset.missaoAba === id;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-selected", String(ativo));
      b.tabIndex = ativo ? 0 : -1;
    });
    corpo.querySelectorAll("[data-missao-grupo]").forEach((g) => { g.hidden = g.dataset.missaoGrupo !== id; });
  };
  corpo.querySelectorAll("[data-missao-aba]").forEach((b) => { b.onclick = () => ativarAba(b.dataset.missaoAba); });
  abas.addEventListener("keydown", (evento) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
    evento.preventDefault();
    const botoes = [...abas.querySelectorAll("[data-missao-aba]")];
    const atual = botoes.indexOf(document.activeElement);
    const destino = evento.key === "Home" ? 0 : evento.key === "End" ? botoes.length - 1 : (atual + (evento.key === "ArrowRight" ? 1 : -1) + botoes.length) % botoes.length;
    ativarAba(botoes[destino].dataset.missaoAba);
    botoes[destino].focus();
  });
  ativarAba(abaMissoesAtual);
}

// Aprimoramento de equipamento (melhoria de jogabilidade pós-backlog
// original, ver EnchantSystem.js): lista todo item aprimorável — equipado
// OU ainda na mochila — com o custo do próximo nível e um botão pra gastar.
// Reaproveita o mesmo `uid` usado por equipar/desequipar/vender, então
// funciona nos dois lugares sem duplicar lógica de busca.
function itensAprimoraveis(personagem) {
  const equipados = Object.values(personagem.equipamento).filter(Boolean);
  const daMochila = personagem.inventario.filter(itemPodeSerAprimorado);
  return [...equipados, ...daMochila].filter(itemPodeSerAprimorado);
}

function custoTextoAprimoramento(custo, dados) {
  const materiaisTxt = custo.materiais.map((m) => {
    const item = dados.items.itens.find((x) => x.id === m.itemId);
    return `${item ? item.nome : m.itemId} x${m.quantidade}`;
  }).join(", ");
  // Com desconto de identidade (Artesanato / Sangue da Forja), mostra o
  // preço cheio riscado — o jogador vê que a escolha dele está valendo.
  const ouroTxt = custo.ouroSemDesconto ? `<s>${custo.ouroSemDesconto}o</s> ${custo.ouro}o` : `${custo.ouro}o`;
  return `${ouroTxt} + ${materiaisTxt}`;
}


// A ficha do item na forja. Além do custo, mostra os sub-status que ele já
// tem e AVISA quando o próximo nível é um marco — saber que o +6 traz uma
// escolha muda a decisão de gastar o material agora ou guardar.
function montarFichaAprimoramento(item, nivel, custo, check, dados) {
  if (!custo) {
    return `<p class="desc">Nível máximo (+${SUB_NIVEL_MAX}) atingido.</p>${fichaSubStats(item)}`;
  }
  const proximo = nivel + 1;
  const ehMarcoProximo = MARCOS.includes(proximo);
  return `
    <dl class="hda-ficha">
      <div><dt>Nível</dt><dd>+${nivel} → +${proximo}</dd></div>
      <div><dt>Custo</dt><dd>${custoTextoAprimoramento(custo, dados)}</dd></div>
    </dl>
    ${ehMarcoProximo ? `<p class="forja-marco-aviso">⭐ +${proximo} é um marco: você vai escolher um sub-status entre três.</p>` : ""}
    ${fichaSubStats(item)}
    ${check.ok ? "" : `<p class="desc" style="color:#ff9a9a;">${check.msg}</p>`}`;
}

function fichaSubStats(item) {
  const subs = item.subStats || [];
  if (!subs.length) {
    return `<p class="desc forja-subs-vazio">Sem sub-status ainda. Eles chegam em +${MARCOS.join(", +")}.</p>`;
  }
  return `<div class="forja-subs">
    <span class="forja-subs-cab">Sub-status</span>
    ${subs.map((sb) => `<span class="forja-sub" style="border-color:${GRAU_COR[sb.grau] || "#c8b89a"}">${textoSubStatus(sb)}${sb.rolagens > 1 ? ` <i>(${sb.rolagens}×)</i>` : ""}</span>`).join("")}
  </div>`;
}

// A ESCOLHA DO MARCO: três cartas, uma decisão, sem volta. É o momento que
// diferencia duas cópias do mesmo item — e por isso tem tela própria em vez
// de um `confirm()`.
function abrirEscolhaDeMarco(item, personagem, onMudar, redesenhar) {
  const marco = item.marcoPendente;
  if (!marco) return;
  const corpoHTML = `
    <p class="desc">${item.nome} chegou a <b>+${marco.nivel}</b>. Escolha um sub-status — a escolha é permanente.</p>
    <div class="forja-opcoes">
      ${marco.candidatos.map((c) => `
        <button type="button" class="forja-opcao" data-id="${c.id}" style="--grau:${GRAU_COR[c.grau] || "#c8b89a"}">
          <span class="forja-opcao-valor">${textoSubStatus(c)}</span>
          <span class="forja-opcao-grau">${GRAU_ROTULO[c.grau] || ""}</span>
          ${c.repetido ? `<span class="forja-opcao-soma">soma ao que o item já tem</span>` : ""}
        </button>`).join("")}
    </div>`;
  abrirSheet({ titulo: `⭐ +${marco.nivel} — escolha um sub-status`, corpoHTML, acoes: [] });
  document.querySelectorAll(".forja-opcao").forEach((b) => {
    b.onclick = () => {
      const r = escolherSubStatusDoMarco(personagem, item.uid, b.dataset.id);
      mostrarMensagem(r.ok ? `${item.nome}: ${textoSubStatus(r.escolha)}` : r.msg, 3600);
      fecharSheet();
      onMudar();
      if (redesenhar) redesenhar("aprimorar");
    };
  });
}

function montarAprimoramento(corpo, personagem, dados, onMudar, tela, redesenhar) {
  const intro = document.createElement("p");
  intro.className = "desc";
  intro.textContent = `Gasta ouro e materiais pra fortalecer um item que você já tem. Máximo +${MAX_NIVEL_APRIMORAMENTO} — e em +${MARCOS.join(", +")} o item ganha um sub-status à sua escolha.`;
  corpo.appendChild(intro);

  const itens = itensAprimoraveis(personagem);
  if (!itens.length) {
    const vazio = document.createElement("p");
    vazio.className = "desc";
    vazio.textContent = "Nenhum item aprimorável equipado ou na mochila.";
    corpo.appendChild(vazio);
    if (tela) tela.definirAcoes([], "");
    return;
  }

  const grade = criarGrade({ densidade: "densa" });
  corpo.appendChild(grade);
  itens.forEach((item) => {
    const nivel = nivelAprimoramento(item);
    const custo = custoProximoNivel(item, personagem);
    const check = podeAprimorar(personagem, item);
    const cor = RARITY_COLORS[item.raridade] || "#888";
    const el = document.createElement("div");
    el.className = "hda-ladrilho" + (check.ok ? "" : " indisponivel");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.innerHTML = `
      <span class="hda-ladrilho-icone icon-frame" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" alt="" /></span>
      <span class="hda-ladrilho-nome hda-clamp-2">${item.nome}</span>
      <span class="hda-ladrilho-rar">${temMarcoPendente(item) ? "⭐ escolha pendente" : `+${nivel}${custo ? ` → +${nivel + 1}` : " (máx)"}`}</span>
      ${(item.subStats || []).length ? `<span class="forja-subs-mini">${item.subStats.map((sb) => textoSubStatus(sb)).join(" · ")}</span>` : ""}`;
    const abrir = () => {
      grade.querySelectorAll(".hda-ladrilho").forEach((x) => x.classList.toggle("selecionado", x === el));

      // MARCO PENDENTE tem prioridade sobre tudo: o jogador já pagou por
      // aquele nível e a escolha ficou devendo. Deixar o botão "Aprimorar"
      // acessível antes de resolver permitiria acumular marcos e perder de
      // vista qual pertence a qual nível.
      if (temMarcoPendente(item)) return abrirEscolhaDeMarco(item, personagem, onMudar, redesenhar);

      abrirSheet({
        titulo: item.nome,
        corpoHTML: montarFichaAprimoramento(item, nivel, custo, check, dados),
        acoes: [{ rotulo: "Aprimorar", classe: "primario btn-aprimorar", desabilitado: !check.ok, titulo: check.ok ? "" : check.msg,
          onClick: () => {
            const res = aprimorarItem(personagem, item.uid);
            if (!res.ok) { mostrarMensagem(res.msg); return; }
            fecharSheet(); onMudar();
            // Chegou num marco: a escolha dos três sub-status entra na hora,
            // como recompensa do nível que acabou de ser pago.
            if (res.marco) {
              mostrarMensagem(`⭐ ${res.item.nome} chegou a +${res.novoNivel} — escolha um sub-status!`, 4000);
              abrirEscolhaDeMarco(res.item, personagem, onMudar, redesenhar);
              return;
            }
            mostrarMensagem(`${res.item.nome} aprimorado!`);
            if (redesenhar) redesenhar("aprimorar");
          } }],
      });
    };
    el.onclick = abrir;
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
    grade.appendChild(el);
  });

  if (tela) tela.definirAcoes([], `🪙 ${personagem.ouro} de ouro · ${itens.filter((i) => podeAprimorar(personagem, i).ok).length} item(ns) aprimorável(is) agora`);
}

// Forja & Alquimia (item 30).
//
// Antes: receitas e aprimoramentos empilhados num único bloco de 2371px,
// cada linha com o próprio botão "Criar" — o botão da última receita ficava
// a duas telas de distância. Agora: abas (Criar / Aprimorar), grade de
// ladrilhos, e a receita escolhida abre no painel contextual com materiais,
// resultado e o botão CRIAR fixo no rodapé desse painel.
export function montarForja(personagem, dados, onMudar, aba = "criar") {
  const tela = abrirTela({
    titulo: "Forja & Alquimia",
    subtitulo: `🪙 ${personagem.ouro}`,
    largura: LARGURA.media,
    classe: "tela-forja",
  });
  const corpo = tela.corpo;
  const redesenhar = (a) => montarForja(personagem, dados, onMudar, a || aba);
  tela.definirAbas([
    { id: "criar", rotulo: "Criar", icone: "🔨" },
    { id: "aprimorar", rotulo: "Aprimorar", icone: "⚒️" },
  ], (id) => redesenhar(id), aba);

  if (aba === "aprimorar") {
    montarAprimoramento(corpo, personagem, dados, onMudar, tela, redesenhar);
    return;
  }

  if (!dados.recipes.length) {
    corpo.innerHTML = '<p class="desc">Nenhuma receita conhecida ainda.</p>';
    tela.definirAcoes([], "Explore e converse com NPCs para aprender receitas.");
    return;
  }

  const grade = criarGrade({ densidade: "densa" });
  corpo.appendChild(grade);
  dados.recipes.forEach((r) => {
    const disponivel = receitaDisponivel(personagem, r);
    const el = document.createElement("div");
    el.className = "hda-ladrilho" + (disponivel ? "" : " indisponivel");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.innerHTML = `
      <span class="hda-ladrilho-icone icon-frame">${disponivel ? "🔨" : "🔒"}</span>
      <span class="hda-ladrilho-nome hda-clamp-2">${r.nome}</span>
      <span class="hda-ladrilho-rar">${disponivel ? "pronto" : "faltam materiais"}</span>`;
    const abrir = () => {
      grade.querySelectorAll(".hda-ladrilho").forEach((x) => x.classList.toggle("selecionado", x === el));
      const ingredientes = r.ingredientes.map((i) => {
        const item = dados.items.itens.find((x) => x.id === i.itemId);
        const tem = personagem.inventario.filter((x) => x.id === i.itemId).length;
        return `<div><dt>${item ? item.nome : i.itemId}</dt><dd>${tem}/${i.quantidade}${tem >= i.quantidade ? " ✓" : ""}</dd></div>`;
      }).join("");
      abrirSheet({
        titulo: r.nome,
        corpoHTML: `<p class="desc">Materiais necessários:</p><dl class="hda-ficha">${ingredientes}</dl>`,
        acoes: [{ rotulo: "Criar", classe: "primario btn-craft", desabilitado: !disponivel,
          titulo: disponivel ? "" : "Faltam materiais",
          onClick: () => {
            const res = craftar(personagem, r, dados.items.itens);
            if (res.ok) mostrarMensagem(`Você criou: ${res.item.nome}!`);
            fecharSheet(); onMudar(); redesenhar();
          } }],
      });
    };
    el.onclick = abrir;
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
    grade.appendChild(el);
  });

  const prontas = dados.recipes.filter((r) => receitaDisponivel(personagem, r)).length;
  tela.definirAcoes([], `${prontas} de ${dados.recipes.length} receitas com materiais suficientes`);
}

// Viagem rápida.
//
// ETAPA 2, item 27: o destino deixou de ser "uma zona" e passou a ser um
// LUGAR — a praça de uma capital, a doca de um porto, o poço de um posto de
// caravana. Ninguém pega carona para "o meio da planície", e era literalmente
// isso que a viagem rápida fazia: teleportava para o centro geométrico de uma
// área.
//
// `destinos` são os pontos já liberados (ver pontosDeViagemDisponiveis em
// FastTravelSystem.js — nada aparece antes de o jogador ter estado lá);
// `bloqueados` é só a contagem do que ainda falta descobrir, para o jogador
// saber que o mapa continua.
const ICONE_DESTINO = { CAPITAL: "🏛️", CIDADE: "🏰", VILA: "🏘️", ASSENTAMENTO: "⛺", ACAMPAMENTO: "🔥" };
const ROTULO_DESTINO = { CAPITAL: "capital", CIDADE: "cidade", VILA: "vila", ASSENTAMENTO: "assentamento", ACAMPAMENTO: "acampamento" };

export function montarViagemRapida(personagem, destinos, zonaAtualId, onViajar, bloqueados = 0, barcos = [], onBarco = null) {
  const tela = abrirTela({ titulo: "🧭 Viagem Rápida", largura: LARGURA.media });
  const corpo = tela.corpo;
  const intro = document.createElement("p");
  intro.className = "desc";
  intro.textContent = "Volte instantaneamente a qualquer lugar em que você já esteve: cidade, porto, posto ou santuário.";
  corpo.appendChild(intro);

  // Coluna de 120px em vez dos 160px padrão: um destino é um ícone e um
  // nome curto, e com 160px a lista virava uma coluna única num celular de
  // 320px — dezesseis ladrilhos empilhados, duas telas de rolagem pra
  // escolher uma cidade.
  const grade = criarGrade({ densidade: "", coluna: "120px" });
  corpo.appendChild(grade);
  const naoVisitadas = new Array(Math.max(0, bloqueados)).fill(0);
  const listaVisitadas = destinos;
  let visitadas = 0;
  listaVisitadas.forEach((zona) => {
    const visitada = true;
    visitadas += 1;
    const aqui = zona.zonaId === zonaAtualId;
    const el = document.createElement("div");
    el.className = "hda-ladrilho compacto" + (visitada ? "" : " desconhecido") + (aqui ? " selecionado" : "");
    el.tabIndex = visitada && !aqui ? 0 : -1;
    el.setAttribute("role", "button");
    el.innerHTML = `
      <span class="hda-ladrilho-icone icon-frame">${aqui ? "📍" : ICONE_DESTINO[zona.categoria] || "🧭"}</span>
      <span class="hda-ladrilho-nome hda-clamp-2">${zona.nome}</span>
      <span class="hda-ladrilho-rar">${aqui ? "você está aqui" : ROTULO_DESTINO[zona.categoria] || "viajar"}</span>`;
    if (visitada && !aqui) {
      el.onclick = () => onViajar(zona.id);
      el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onViajar(zona.id); } };
    } else {
      el.classList.add("indisponivel");
      el.title = aqui ? "Você já está nesta zona." : "Explore esta zona a pé para liberar a viagem rápida.";
    }
    grade.appendChild(el);
  });
  if (naoVisitadas.length) {
    const det = document.createElement("details");
    det.className = "hda-recolhido";
    det.innerHTML = `<summary>${naoVisitadas.length} lugar(es) ainda por descobrir</summary><p class="desc">Chegue a pé para liberar cada um: ${naoVisitadas.map(() => "???").join(" · ")}</p>`;
    corpo.appendChild(det);
  }
  if (barcos.length && onBarco) {
    const travessias = document.createElement("section");
    travessias.className = "viagem-travessias";
    travessias.innerHTML = "<h3>⛵ Travessias marítimas</h3><p class=\"desc\">Partida do porto onde você está; ilhas não têm estrada de acesso.</p>";
    for (const rota of barcos) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.textContent = `${rota.destino} · 🪙 ${rota.custo}`;
      botao.disabled = personagem.ouro < rota.custo;
      botao.title = botao.disabled ? "Moedas insuficientes para a passagem" : `${rota.nome}, saindo de ${rota.origem}`;
      botao.onclick = () => onBarco(rota);
      travessias.appendChild(botao);
    }
    corpo.appendChild(travessias);
  }
  tela.definirAcoes([], `${visitadas} de ${visitadas + naoVisitadas.length} lugares descobertos`);
}

const PACOTES_FORJA = [
  { itemId: "minerio", quantidade: 5, valorUnitario: 7, icone: "⛏️" },
  { itemId: "madeira", quantidade: 5, valorUnitario: 5, icone: "🪵" },
  { itemId: "gema", quantidade: 3, valorUnitario: 15, icone: "💎" },
  { itemId: "minerio_raro", quantidade: 3, valorUnitario: 35, icone: "🔷" },
  { itemId: "erva_rara", quantidade: 2, valorUnitario: 35, icone: "🌿" },
  { itemId: "gema_rara", quantidade: 1, valorUnitario: 90, icone: "✨" },
];

export function montarLoja(personagem, dados, onMudar, contexto = {}) {
  const multPreco = multiplicadorPrecoLoja(personagem, dados.worldStateVariables);
  const tierAtual = tierDaReputacao(getReputacao(personagem, "vila"), dados.worldStateVariables);
  // Cada motivo se explica sozinho: reputação e origem mexem no preço por
  // caminhos diferentes (ver multiplicadorPrecoLoja/LOJA_DA_ORIGEM), e creditar
  // tudo à reputação escondia o efeito da escolha de criação.
  const motivos = [];
  if (tierAtual && (tierAtual.descontoLoja || 0) !== 0) {
    const pct = Math.abs(Math.round(tierAtual.descontoLoja * 100));
    motivos.push(`${tierAtual.descontoLoja > 0 ? "−" : "+"}${pct}% por reputação com a vila (${tierAtual.nome})`);
  }
  const daOrigem = textoDescontoOrigem(personagem, "vila", personagem.antecedenteNome);
  if (daOrigem) motivos.push(daOrigem);
  const tela = abrirTela({ titulo: "Mercador & Suprimentos", subtitulo: `🪙 ${personagem.ouro}`, largura: LARGURA.larga, classe: "tela-loja" });
  const corpo = tela.corpo;

  if (motivos.length) {
    const p = document.createElement("p");
    p.className = "desc";
    p.textContent = `Preços ajustados: ${motivos.join(" · ")}.`;
    corpo.appendChild(p);
  }

  const servicos = document.createElement("section");
  servicos.className = "loja-servicos";
  const custoCura = custoServicoLoja(personagem, "recuperar_time");
  const custoFortuna = custoServicoLoja(personagem, "bencao_fortuna");
  const restantes = Math.max(0, personagem.bausAbençoados || 0);
  servicos.innerHTML = `<h3>Serviços da expedição</h3><p class="desc">Use seu ouro para voltar ao mapa mais preparado.</p>
    <div class="hda-grid densa">
      <button class="card servico-loja" data-servico="recuperar_time"><span class="nome">🏨 Recuperar grupo</span><span class="desc">HP e MP completos para todo o time</span><b>🪙 ${custoCura}</b></button>
      <button class="card servico-loja" data-servico="bencao_fortuna"><span class="nome">✨ Bênção da Fortuna</span><span class="desc">+1 item e +35% ouro nos próximos 3 baús${restantes ? ` · ${restantes} carga(s) ativa(s)` : ""}</span><b>🪙 ${custoFortuna}</b></button>
    </div>`;
  servicos.querySelectorAll("[data-servico]").forEach((btn) => {
    const id = btn.dataset.servico;
    btn.disabled = personagem.ouro < custoServicoLoja(personagem, id);
    btn.onclick = () => {
      const r = comprarServicoLoja(personagem, id, contexto.time || [personagem]);
      mostrarMensagem(r.ok ? `🪙 ${r.msg} (-${r.custo} ouro)` : r.msg, 3600);
      onMudar(); montarLoja(personagem, dados, onMudar, contexto);
    };
  });
  corpo.appendChild(servicos);

  const suprimentos = document.createElement("section");
  suprimentos.className = "loja-servicos loja-forja";
  suprimentos.innerHTML = `<h3>⚒️ Suprimentos de forja</h3><p class="desc">Toda cidade abastecida vende materiais. Use ouro para manter suas armas e armaduras evoluindo.</p><div class="hda-grid densa"></div>`;
  const gradeForja = suprimentos.querySelector(".hda-grid");
  PACOTES_FORJA.forEach((pacote) => {
    const item = dados.items.itens.find((i) => i.id === pacote.itemId);
    if (!item) return;
    const preco = Math.max(1, Math.round(pacote.valorUnitario * pacote.quantidade * multPreco));
    const possui = personagem.inventario.filter((i) => i.id === item.id).length;
    const btn = document.createElement("button");
    btn.className = "card servico-loja pacote-forja";
    btn.disabled = personagem.ouro < preco;
    btn.innerHTML = `<span class="nome">${pacote.icone} ${item.nome} ×${pacote.quantidade}</span><span class="desc">Na mochila: ${possui}</span><b>🪙 ${preco}</b>`;
    btn.onclick = () => {
      const r = comprarLote(personagem, item, pacote.quantidade, multPreco, pacote.valorUnitario);
      mostrarMensagem(r.ok ? `⚒️ Comprou ${item.nome} ×${r.quantidade} por ${r.preco} ouro.` : r.msg, 3200);
      onMudar();
      montarLoja(personagem, dados, onMudar, contexto);
    };
    gradeForja.appendChild(btn);
  });
  corpo.appendChild(suprimentos);

  const catalogo = dados.items.itens.filter((i) => i.raridade === "comum" || i.raridade === "incomum").slice(0, 24);
  const grade = criarGrade({ densidade: "densa" });
  corpo.appendChild(grade);
  catalogo.forEach((item) => {
    const precoFinal = Math.max(1, Math.round(item.valor * multPreco));
    const podeComprar = personagem.ouro >= precoFinal;
    const cor = RARITY_COLORS[item.raridade] || "#888";
    const el = document.createElement("div");
    el.className = "hda-ladrilho" + (podeComprar ? "" : " indisponivel");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.innerHTML = `
      <span class="hda-ladrilho-icone icon-frame" style="border-color:${cor}"><img src="${caminhoDoIcone(item)}" alt="" /></span>
      <span class="hda-ladrilho-nome hda-clamp-2">${item.nome}</span>
      <span class="hda-ladrilho-rar">🪙 ${precoFinal}</span>`;
    const abrir = () => {
      grade.querySelectorAll(".hda-ladrilho").forEach((x) => x.classList.toggle("selecionado", x === el));
      abrirSheet({
        titulo: item.nome,
        corpoHTML: `<p class="desc">${item.descricao || ""}</p><dl class="hda-ficha"><div><dt>Raridade</dt><dd style="color:${cor}">${RARITY_LABEL[item.raridade]}</dd></div><div><dt>Preço</dt><dd>🪙 ${precoFinal}</dd></div><div><dt>Seu ouro</dt><dd>🪙 ${personagem.ouro}</dd></div></dl>`,
        acoes: [{ rotulo: `Comprar (${precoFinal}o)`, classe: "primario btn-comprar", desabilitado: !podeComprar,
          titulo: podeComprar ? "" : "Ouro insuficiente",
          onClick: () => {
            const r = comprarItem(personagem, item, multPreco);
            mostrarMensagem(r.ok ? `Comprou: ${item.nome} (${r.preco}o)!` : r.msg);
            fecharSheet(); onMudar(); montarLoja(personagem, dados, onMudar, contexto);
          } }],
      });
    };
    el.onclick = abrir;
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
    grade.appendChild(el);
  });
  tela.definirAcoes([], `🪙 <b>${personagem.ouro}</b> de ouro · ${catalogo.length} itens à venda`);
}

export function montarDialogo(npc, dados, personagem, onMudar, contexto = {}) {
  const corpo = abrirModalBase(npc.nome);
  marcarInteracaoAutomatica(corpo);

  // Quem é essa pessoa, em uma linha. Só para NPC com ficha da ETAPA 3 — os
  // cinco antigos continuam entrando por `npc.dialogo` como sempre.
  if (npc.papel && npc.profissao) {
    const cab = document.createElement("p");
    cab.style.cssText = "opacity:0.7;font-size:0.9em;margin-bottom:0.4em;";
    cab.textContent = npc.atividade ? `${npc.profissao} — ${npc.atividade}` : npc.profissao;
    corpo.appendChild(cab);
  }

  // A FALA DO MOMENTO (ETAPA 3, itens 7 e 8). O NPC tem uma pilha de estados
  // narrativos e diz o primeiro cuja condição bate — quest ativa, evento em
  // curso, World State da região, hora, clima. É assim que ele "lembra": o
  // mundo lembra, e ele lê o mundo. Sem ficha, cai no `dialogo` de sempre.
  const p = document.createElement("p");
  p.textContent = npc.estados ? falaAtual(npc, { personagem, ...contexto }).texto : npc.dialogo;
  corpo.appendChild(p);

  // Reação à reputação (item 15). A ficha nova escreve a reação da própria
  // pessoa; sem ficha, vale a saudação genérica do tier, como antes.
  const reacao = npc.reacaoAReputacao
    ? reacaoPorReputacao(npc, personagem, dados.worldStateVariables, npc.faccaoId || "vila")
    : null;
  const tierRep = tierDaReputacao(getReputacao(personagem, npc.faccaoId || "vila"), dados.worldStateVariables);
  const textoReacao = reacao || (tierRep && tierRep.saudacao);
  if (textoReacao) {
    const saud = document.createElement("p");
    saud.style.cssText = "opacity:0.85;font-style:italic;";
    saud.textContent = `"${textoReacao}"${tierRep ? ` (Reputação: ${tierRep.nome})` : ""}`;
    corpo.appendChild(saud);
  }

  // O povo da região repara na raça de quem chegou (ver racialReactions.js).
  // Vem por último entre as falas porque é o comentário menos importante: a
  // reputação é o que você fez, a raça é só o que você é. Na maioria dos
  // encontros não existe e nada aparece.
  const daRaca = reacaoARaca(npc, personagem);
  if (daRaca) {
    const linha = document.createElement("p");
    linha.style.cssText = "opacity:0.85;font-style:italic;";
    linha.textContent = `"${daRaca}"${personagem.racaNome ? ` (${personagem.racaNome})` : ""}`;
    corpo.appendChild(linha);
  }

  // Passos de questline regional oferecidos por este NPC (itens 16 a 19).
  // No máximo um por vez, por construção — é o que impede o NPC de virar
  // terminal de quest.
  if (npc.regiaoId) {
    questsOferecidasPor(personagem, npc.id).forEach(({ quest, estado }) => {
      const div = document.createElement("div");
      div.className = "card";
      if (estado === "ativa") {
        // Um passo `tipo: "decisao"` não se "conclui": ele se DECIDE. O
        // rótulo do botão diz isso, e o clique abre a cena de decisão em vez
        // de aplicar um desfecho que o jogador não escolheu.
        const decide = Array.isArray(quest.escolhas) && quest.escolhas.length > 0;
        const progresso = progressoObjetivoRegional(personagem, quest.id);
        div.innerHTML = `<div class="info"><div class="nome">${decide ? "⚖️ " : ""}${quest.nome}</div><div class="desc">${quest.objetivo}</div>
          <div class="desc">Onde: ${quest.onde.join(", ")}</div></div>
          <div class="desc">${progresso.texto}</div>
          <div><button class="${decide ? "primario " : ""}btn-qr-concluir" data-id="${quest.id}" ${progresso.pronto ? "" : "disabled"}>${decide ? "Decidir" : "Concluir"}</button></div>`;
      } else {
        div.innerHTML = `<div class="info"><div class="nome">${quest.nome} · ${quest.questline}</div>
          <div class="desc">${quest.objetivo}</div></div>
          <div><button class="btn-qr-aceitar" data-id="${quest.id}">Aceitar</button></div>`;
      }
      corpo.appendChild(div);
    });
    corpo.querySelectorAll(".btn-qr-aceitar").forEach((b) => b.onclick = async () => {
      const r = aceitarQuestRegional(personagem, b.dataset.id);
      if (r.ok) {
        // ABERTURA DA LINHA: aceitar o primeiro passo de uma questline
        // regional abre uma cena curta que diz o que está em jogo naquela
        // região, uma vez só. Antes disto, uma linha de quatro passos sobre
        // uma sucessão de clãs começava com um card e um botão "Aceitar" —
        // o jogador aceitava sem nunca ter ouvido de que se tratava.
        const primeiro = PASSOS_INICIAIS.includes(r.quest.id);
        const cena = primeiro ? cenaDeAbertura(r.quest.regiaoId) : null;
        if (cena && !jaViu(personagem, cena.id)) {
          fecharModal();
          await reproduzirCutscene(cena, personagem, dados);
        }
        mostrarMensagem(`Missão regional aceita: ${r.quest.nome}`);
      }
      onMudar();
      montarDialogo(npc, dados, personagem, onMudar, contexto);
    });
    corpo.querySelectorAll(".btn-qr-concluir").forEach((b) => b.onclick = async () => {
      const quest = questRegionalPorId(b.dataset.id);
      const progresso = progressoObjetivoRegional(personagem, b.dataset.id);
      if (!progresso.pronto) { mostrarMensagem(progresso.texto, 7000); return; }
      const mundoQuest = { worldState: contexto.worldState, dadosWorldState: dados.worldStateVariables };

      // PASSO COM ESCOLHA: vira cena. O dilema entra como painel, as saídas
      // como opções, e o desfecho traz o eco do que mudou no mundo. É o
      // mesmo motor do prólogo — de propósito: uma decisão que altera uma
      // região inteira não pode ter menos presença na tela do que um card.
      if (quest && Array.isArray(quest.escolhas) && quest.escolhas.length) {
        fecharModal();
        await reproduzirCutscene({
          id: `decisao_${quest.id}`,
          titulo: quest.questline,
          paineis: [{ arte: "escolha", titulo: quest.nome, texto: [quest.objetivo] }],
          escolha: {
            pergunta: "O que você faz?",
            opcoes: quest.escolhas.map((e) => ({ id: e.id, rotulo: e.rotulo })),
            // Quem aplica a consequência é o sistema de quests, não a cena:
            // a cena só encena o que ele devolve.
            aoEscolher: (opcaoId) => {
              const r = concluirQuestRegional(personagem, quest.id, mundoQuest, opcaoId);
              if (!r.ok) return { ok: false };
              return {
                ok: true,
                texto: r.escolha ? r.escolha.resultado : "",
                linhas: linhasDaConsequencia(r.mudou, dados.worldStateVariables),
              };
            },
          },
        }, personagem, dados);
        onMudar();
        montarDialogo(npc, dados, personagem, onMudar, contexto);
        return;
      }

      // Passo comum: conclui direto, mas o aviso agora é uma frase em
      // português e não o dump das chaves que mudaram.
      const r = concluirQuestRegional(personagem, b.dataset.id, mundoQuest);
      if (r.ok) {
        const resumo = resumoDaConsequencia(r.mudou, dados.worldStateVariables);
        mostrarMensagem(`${r.quest.nome} concluída.${resumo ? " " + resumo : ""}${r.quest.id === "qr_altaverde_1" ? " Abra Missões (M): Ashryn oferece ajuda à sua jornada." : ""}`, 8000);
      }
      onMudar();
      montarDialogo(npc, dados, personagem, onMudar, contexto);
    });
  }

  const servicosNpc = new Set(npc.servicos || []);
  const atendeLoja = npc.id === "npc_mercador" || servicosNpc.has("loja") || servicosNpc.has("compra");
  const atendeForja = servicosNpc.has("forja") || servicosNpc.has("aprimoramento");
  if (atendeLoja || atendeForja) {
    const btnLoja = document.createElement("button");
    btnLoja.className = "primario";
    btnLoja.textContent = "⚒️ Comprar materiais de forja";
    btnLoja.onclick = () => montarLoja(personagem, dados, onMudar, contexto);
    corpo.appendChild(btnLoja);
    if (atendeForja) {
      const btnForja = document.createElement("button");
      btnForja.textContent = "🔨 Usar a forja";
      btnForja.onclick = () => montarForja(personagem, dados, onMudar, "aprimorar");
      corpo.appendChild(btnForja);
    }
    return;
  }

  // Testes de perícia (d20) oferecidos por este NPC — ver skillChecks.json.
  // Cada um pode ser tentado uma única vez por personagem quando marcado
  // como "unicoPorPersonagem", pra não virar uma fonte infinita de ouro.
  const testes = testesDoContexto(dados.skillChecks, "npc", { npcId: npc.id })
    .filter((t) => !t.unicoPorPersonagem || !testeJaFeito(personagem, t.id));
  testes.forEach((teste) => {
    // Opção de ORIGEM: quem tem a perícia pela origem resolve sem dado (ver
    // opcaoDeOrigem em ExplorationEventSystem.js) — a mesma regra dos
    // eventos de exploração, aqui na conversa com o NPC.
    const daOrigem = opcaoDeOrigem(teste, personagem, dados);
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="info"><div class="nome">🎲 ${teste.pericia}</div><div class="desc">${teste.textoOferta}</div></div>
      <div>${daOrigem ? `<button class="btn-teste-origem" data-id="${teste.id}">${daOrigem.origem.nome}: sem dado</button>` : ""}<button class="btn-teste-pericia" data-id="${teste.id}">Tentar</button></div>`;
    corpo.appendChild(div);
  });
  corpo.querySelectorAll(".btn-teste-origem").forEach((b) => b.onclick = () => {
    const teste = testes.find((t) => t.id === b.dataset.id);
    const daOrigem = opcaoDeOrigem(teste, personagem, dados);
    if (!teste || !daOrigem) return;
    b.disabled = true;
    if (teste.unicoPorPersonagem) marcarTesteFeito(personagem, teste.id);
    if (teste.recompensaOuroSucesso) personagem.ouro += teste.recompensaOuroSucesso;
    alterarReputacao(personagem, "vila", REPUTACAO_POR_TESTE_SUCESSO, dados.worldStateVariables);
    mostrarMensagem(`✅ ${daOrigem.origem.nome}: ${teste.textoSucesso}${teste.recompensaOuroSucesso ? ` (+${teste.recompensaOuroSucesso} ouro)` : ""} (+${REPUTACAO_POR_TESTE_SUCESSO} reputação)`, 4200);
    registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: `${daOrigem.origem.nome}: ${teste.textoSucesso}` });
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar, contexto);
  });
  corpo.querySelectorAll(".btn-teste-pericia").forEach((b) => b.onclick = async () => {
    const teste = testes.find((t) => t.id === b.dataset.id);
    const r = realizarTeste(personagem, dados, teste);
    if (teste.unicoPorPersonagem) marcarTesteFeito(personagem, teste.id);
    // Trava o botão durante a animação: dois cliques rápidos rolariam o
    // teste duas vezes e dariam a recompensa duas vezes.
    b.disabled = true;
    // A conta em texto (`[d20: 14 +2 = 16 vs DC 12]`) sai do aviso e vira a
    // própria animação: o mesmo conteúdo, num momento em que se olha.
    const mods = [];
    if (r.modAtributo) mods.push(`${r.modAtributo > 0 ? "+" : ""}${r.modAtributo} atributo`);
    if (r.proficiente && r.bonusPericia) mods.push(`+${r.bonusPericia} perícia`);
    await mostrarRolagemD20(r, { titulo: teste.nome || `Teste · ${teste.pericia || teste.atributo || ""}`, modificadores: mods });
    if (r.sucesso) {
      if (teste.recompensaOuroSucesso) personagem.ouro += teste.recompensaOuroSucesso;
      alterarReputacao(personagem, "vila", REPUTACAO_POR_TESTE_SUCESSO, dados.worldStateVariables);
      mostrarMensagem(`✅ ${teste.textoSucesso}${teste.recompensaOuroSucesso ? ` (+${teste.recompensaOuroSucesso} ouro)` : ""} (+${REPUTACAO_POR_TESTE_SUCESSO} reputação)`, 4200);
      registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: teste.textoSucesso });
    } else {
      mostrarMensagem(`❌ ${teste.textoFalha}`, 4200);
      registrarDecisao(personagem, { icone: "🎲", titulo: `Conversa com ${npc.nome}`, texto: teste.textoFalha });
    }
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar, contexto);
  });

  const quests = dados.quests.filter((q) => q.npcId === npc.id);
  quests.forEach((q) => {
    const jaAtiva = personagem.missoesAtivas.some((m) => m.id === q.id);
    const jaConcluida = personagem.missoesConcluidas.includes(q.id);
    const div = document.createElement("div");
    div.className = "card";
    if (jaConcluida) {
      div.innerHTML = `<div class="info"><div class="nome">${q.nome} (concluída)</div></div>`;
    } else if (jaAtiva) {
      const pronto = missaoPronta(personagem, q);
      div.innerHTML = `<div class="info"><div class="nome">${q.nome}</div><div class="desc">${q.descricao}</div></div>
        <div><button ${pronto ? "" : "disabled"} class="btn-entregar" data-id="${q.id}">${pronto ? "Entregar" : "Em progresso"}</button></div>`;
    } else {
      div.innerHTML = `<div class="info"><div class="nome">${q.nome}</div><div class="desc">${q.descricao}</div>
        <div class="desc">Recompensa: ${q.recompensaOuro} ouro, ${q.recompensaXP} XP</div></div>
        <div><button class="btn-aceitar" data-id="${q.id}">Aceitar</button></div>`;
    }
    corpo.appendChild(div);
  });

  corpo.querySelectorAll(".btn-aceitar").forEach((b) => b.onclick = async () => {
    const q = dados.quests.find((x) => x.id === b.dataset.id);
    if (!iniciarMissao(personagem, q)) return;
    onMudar();
    const cena = cenaDaMissao(q, "aceita");
    if (cena) {
      fecharModal();
      await reproduzirCutscene(cena, personagem, dados);
    }
    mostrarMensagem(`🧭 Missão aceita e rastreada: ${q.nome}`);
    montarDialogo(npc, dados, personagem, onMudar, contexto);
  });
  corpo.querySelectorAll(".btn-entregar").forEach((b) => b.onclick = async () => {
    const q = dados.quests.find((x) => x.id === b.dataset.id);
    const r = concluirMissao(personagem, q, dados.items.itens);
    if (r.ok) {
      if (r.item) {
        personagem.inventario.push({ ...r.item, uid: cryptoId() });
      }
      const nivelAntes = personagem.nivel;
      const { subiuNivel } = ganharXP(personagem, r.xp);
      subiuNivel.forEach(() => aplicarCrescimento(personagem, dados));
      if (subiuNivel.length) celebrarNivel(subiuNivel[subiuNivel.length - 1], nivelAntes);
      if (r.fragmentos) adicionarFragmentos(personagem, r.fragmentos);
      checarConquistas(personagem, {});
      alterarReputacao(personagem, "vila", REPUTACAO_POR_MISSAO, dados.worldStateVariables);
      // DESFECHO (quests.json): o que aconteceu com quem pediu a missão,
      // mostrado ANTES do saldo de recompensas. Uma missão que termina só
      // com "+25 ouro, +20 XP" não tem desfecho — tem extrato. O `desfecho`
      // é o que transforma "matei três slimes" em "o Tobias tem semente para
      // o ano que vem", e é ele que fica registrado no diário.
      const cenaFinal = cenaDaMissao(q, "concluida");
      if (q.desfecho && !cenaFinal) {
        mostrarMensagem(`📜 ${q.desfecho}`, 6500);
      }
      let msg = `Missão concluída! +${r.ouro} ouro, +${r.xp} XP${r.fragmentos ? `, +${r.fragmentos} Fragmentos de Aethra` : ""}${r.item ? `, item: ${r.item.nome}` : ""} (+${REPUTACAO_POR_MISSAO} reputação com a vila)`;
      if (temCompraDisponivel(personagem, dados)) msg += " · 🌟 Pontos de habilidade para gastar (T)!";
      // Com desfecho, o saldo entra um pouco depois, para não competir com a
      // frase — dois avisos ao mesmo tempo viram um só, ilegível.
      if (q.desfecho) registrarDecisao(personagem, { icone: "📜", titulo: q.nome, texto: q.desfecho });
      if (cenaFinal) {
        fecharModal();
        await reproduzirCutscene(cenaFinal, personagem, dados);
        mostrarMensagem(msg);
      } else if (q.desfecho) setTimeout(() => mostrarMensagem(msg), 1400);
      else mostrarMensagem(msg);
    }
    onMudar();
    montarDialogo(npc, dados, personagem, onMudar, contexto);
  });
}
