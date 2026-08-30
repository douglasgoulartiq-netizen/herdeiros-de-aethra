// Mão de cards de batalha — a camada de TELA.
//
// Antes desta melhoria, o turno do jogador era uma fileira de <button> de
// texto ("Atacar", "Golpe Poderoso (0 MP) [2]") com uma linha de prévia de
// dano por baixo. Este módulo substitui isso por cards: cada ação vira uma
// carta com identidade elemental de Aethra (runa, cor, textura), previsão
// legível, estados visuais e destaque tático.
//
// Divisão de responsabilidades (o motivo de existirem três arquivos):
//   BattleForecast.js  -> O QUE VAI ACONTECER (fatos previstos, puro)
//   TacticalAdvisor.js -> O QUE VALE MAIS A PENA (score interno, puro)
//   BattleCards.js     -> COMO ISSO APARECE E RESPONDE AO TOQUE (só aqui há DOM)
//
// O que este arquivo NUNCA faz: decidir uma ação sozinho. Ele destaca,
// explica e prevê; quem clica é o jogador, sempre — inclusive num card sem
// nenhum destaque.
import { montarMao, preverCard } from "../systems/BattleForecast.js";
import { montarContextoTatico, avaliarMao, dicaIniciante } from "../systems/TacticalAdvisor.js";
import { identidadeElemento, classeElemento, nomeElemento, rotuloRelacao } from "../systems/ElementIdentity.js";
import {
  nivelSugestao, modoDanoPrevisto, modoInfoTatica, modoInicianteAtivo, animacoesReduzidas,
  configCards, salvarConfigCards, SUGESTAO_JOGADA, DANO_PREVISTO, ANIMACOES_CARDS, INFO_TATICA,
} from "../systems/BattleSettings.js";
import { somCardHover, somCardSelecionado, somCardErro, somCombo, somUltimatePronta, somCooldownPronto } from "./SoundFX.js";

// Item 92: nunca criar rolagem horizontal infinita. Até 8 cards cabem em
// duas linhas; acima disso, entra paginação com setas (e teclas ← →).
const CARDS_POR_PAGINA = 8;
const MS_TOQUE_LONGO = 450;

export function criarPainelDeCards(opcoes) {
  const {
    acoesEl,           // container onde a mão é desenhada (#batalha-acoes)
    contextoEl,        // faixa de contexto acima da arena (intenções/timeline)
    dados,             // dados do jogo (elements, elementalStates, ...)
    onJogar,           // (card, previsao) => void  — executa a ação de fato
    onAbrirItens,      // () => void
    onPreverAlvo,      // (alvo, previsao|null) => void — barra-fantasma de HP
    onSelecionarCard,  // (card|null) => void — permite à UI destacar alcance
  } = opcoes;

  // Estado local do painel (nunca estado de jogo).
  let cardSelecionado = null;   // card "armado", aguardando confirmação
  let cardEmFoco = null;        // hover/teclado — só previsão, não arma nada
  let pagina = 0;
  let ultimoEstado = null;
  let confirmarFuga = false;
  let timerToqueLongo = null;
  let assinaturaAnterior = "";  // cache de invalidação (item 82)
  let cacheAvaliacao = null;
  let ultimasProntas = new Set(); // p/ som de "recarga concluída" (item 79)

  // -------------------------------------------------------------------
  // Cache de recálculo (item 82): a mão só é reavaliada quando alguma coisa
  // que ENTRA no cálculo muda. Sem isso, o loop de ATB (a cada 140ms)
  // reavaliaria dezenas de previsões por segundo sem nenhuma mudança real.
  // -------------------------------------------------------------------
  function assinaturaDoEstado(e) {
    const partes = [
      e.jogador && e.jogador.nome, e.jogador && e.jogador.hp, e.jogador && e.jogador.mp,
      e.jogador && e.jogador.posicao,
      e.jogador && e.jogador.statusEffects.map((s) => `${s.tipo}:${s.duracao}`).join(","),
      e.jogador && (e.jogador.habilidades || []).map((h) => `${h.id}:${h.cooldownAtual}`).join(","),
      e.alvo && `${e.alvo.id}:${e.alvo.hp}:${e.alvo.postura}:${e.alvo.atordoado}:${e.alvo.defendendo}`,
      e.alvo && e.alvo.statusEffects.map((s) => `${s.tipo}:${s.estadoId || ""}`).join(","),
      e.inimigosVivos.length,
      e.inimigosVivos.map((i) => `${i.id}:${i.hp <= 0 ? 0 : 1}`).join(","),
      e.aliados.map((c) => `${c.nome}:${c.vivo ? 1 : 0}:${Math.round(c.hp)}`).join(","),
      e.intencoes ? [...e.intencoes.keys()].map((i) => i.id).join(",") : "",
      e.batalha.ultimoAtaqueAliado ? `${e.batalha.ultimoAtaqueAliado.elemento}` : "",
      e.batalha.climaElemento, e.batalha.terrenoElemento,
      nivelSugestao(), modoDanoPrevisto(), modoInfoTatica(),
    ];
    return partes.join("|");
  }

  function avaliar(estado) {
    const assinatura = assinaturaDoEstado(estado);
    if (assinatura === assinaturaAnterior && cacheAvaliacao) return cacheAvaliacao;

    const contexto = {
      soproDisponivel: estado.jogador.racaId === "draconato" && !estado.jogador.sopro_usado && estado.inimigosVivos.length > 0,
      temItens: !!estado.temItens,
      podeReposicionar: estado.jogador.isPlayer,
    };
    const cards = montarMao(estado.jogador, contexto);
    const previsoes = new Map();
    const estadoForecast = { ...estado, dados };
    for (const card of cards) previsoes.set(card.id, preverCard(card, estadoForecast));

    const ctx = montarContextoTatico(estado);
    const avaliacoes = avaliarMao(cards, previsoes, ctx, { sugestao: nivelSugestao(), alvo: estado.alvo });

    cacheAvaliacao = { cards, previsoes, avaliacoes, ctx };
    assinaturaAnterior = assinatura;
    return cacheAvaliacao;
  }

  // Invalidação explícita: chamada pela BattleUI quando algo fora da
  // assinatura muda (troca de alvo, card usado, nova leva de inimigos).
  function invalidar() {
    assinaturaAnterior = "";
    cacheAvaliacao = null;
  }

  // -------------------------------------------------------------------
  // Formatação de valores
  // -------------------------------------------------------------------
  function faixaTexto(min, max) {
    return min === max ? `${min}` : `${min}–${max}`;
  }
  function pct(v) {
    return `${Math.round(v * 100)}%`;
  }

  // Valor principal (grande) do card: dano, cura, dano evitado ou nada.
  function valorPrincipal(card, p) {
    const modo = modoDanoPrevisto();
    if (modo === "off") return null;
    if (p.dano && !p.dano.imune) return { rotulo: "DANO", texto: faixaTexto(p.dano.min, p.dano.max), classe: "valor-dano" };
    if (p.dano && p.dano.imune) return { rotulo: "DANO", texto: "0", classe: "valor-imune" };
    if (p.area) return { rotulo: `${p.area.quantidade} ALVOS`, texto: faixaTexto(p.area.min, p.area.max), classe: "valor-dano" };
    if (p.cura) {
      const perdeu = p.cura.efetivaEsperada < p.cura.esperado;
      return {
        rotulo: perdeu ? "CURA EFETIVA" : "CURA",
        texto: faixaTexto(perdeu ? p.cura.efetivaMin : p.cura.min, perdeu ? p.cura.efetivaMax : p.cura.max),
        classe: "valor-cura",
      };
    }
    if (p.defesa && p.defesa.tipo === "buff") {
      return { rotulo: "REDUÇÃO", texto: pct(p.defesa.reducaoPercent), classe: "valor-defesa" };
    }
    if (p.defesa && p.defesa.danoEvitado && p.defesa.danoEvitado.esperado > 0) {
      return { rotulo: "DANO EVITADO", texto: faixaTexto(p.defesa.danoEvitado.min, p.defesa.danoEvitado.max), classe: "valor-defesa" };
    }
    if (p.defesa && p.defesa.tipo === "guarda") {
      return { rotulo: "BLOQUEIO", texto: pct(p.defesa.chanceBloqueio), classe: "valor-defesa" };
    }
    if (p.reposicionamento && p.reposicionamento.danoEvitadoEstimado > 0) {
      return { rotulo: "DANO EVITADO", texto: `~${p.reposicionamento.danoEvitadoEstimado}`, classe: "valor-defesa" };
    }
    return null;
  }

  // Item 86: no máximo 3 indicadores na visão normal. A ordem desta lista É
  // a prioridade — o que estiver mais acima aparece primeiro.
  function badgesDoCard(card, p, avaliacao) {
    const badges = [];
    const detalhado = modoDanoPrevisto() === "detalhado";

    if (p.execucao === "garantida") badges.push({ txt: "💀 EXECUÇÃO GARANTIDA", cls: "badge-exec badge-exec-forte" });
    else if (p.execucao === "possivel") badges.push({ txt: "💀 POSSÍVEL EXECUÇÃO", cls: "badge-exec" });

    if (p.interrompe) badges.push({ txt: p.interrompe.garantida ? "⚡ INTERROMPE" : "⚡ PODE INTERROMPER", cls: "badge-interrupt" });

    // Rótulo curto de propósito: o nome completo da reação/combo e a
    // descrição inteira vivem no painel de detalhe. Na badge só cabe (e só
    // interessa) o gatilho.
    if (p.reacao) badges.push({ txt: `${p.reacao.icone || "✦"} ${p.reacao.nome.toUpperCase()}`, cls: "badge-combo" });
    else if (p.combo) badges.push({ txt: `${p.combo.icone} COMBO!`, cls: "badge-combo" });

    if (p.dano) {
      const rel = rotuloRelacao(p.dano.relacaoElemental);
      if (rel) badges.push({ txt: `${rel.icone} ${rel.texto}`, cls: `badge-rel ${rel.classe}` });
    }

    if (p.ruptura) {
      if (p.ruptura.quebra) badges.push({ txt: "🛡️💥 ROMPE POSTURA", cls: "badge-ruptura badge-ruptura-forte" });
      else if (p.ruptura.ganho >= p.ruptura.restante * 0.6) badges.push({ txt: "🛡️ QUASE ROMPE", cls: "badge-ruptura" });
      else if (detalhado) badges.push({ txt: `🛡️ RUPTURA ${p.ruptura.ganho}`, cls: "badge-ruptura" });
    }

    if (p.status) {
      const chanceTxt = p.status.garantido || p.status.chance >= 0.999 ? "" : ` ${pct(p.status.chance)}`;
      badges.push({ txt: `${p.status.icone} ${p.status.nome.toUpperCase()}${chanceTxt}`, cls: "badge-status" });
    }

    if (p.chances) {
      // Item 14: só polui o card quando é relevante.
      if (p.chances.acerto < 0.999 && (detalhado || p.chances.acerto < 0.8)) {
        badges.push({ txt: `${p.chances.acerto < 0.7 ? "⚠ " : ""}ACERTO ${pct(p.chances.acerto)}`, cls: p.chances.acerto < 0.7 ? "badge-acerto badge-acerto-baixo" : "badge-acerto" });
      }
      // Item 15.
      if (p.chances.criticoGarantido) badges.push({ txt: "✹ CRÍTICO GARANTIDO", cls: "badge-critico badge-critico-forte" });
      else if (p.chances.critico > 0.25 || (detalhado && p.chances.critico > 0)) {
        badges.push({ txt: `✹ CRÍTICO ${pct(p.chances.critico)}`, cls: "badge-critico" });
      }
    }

    if (p.area && p.area.aliadosNaArea.length) badges.push({ txt: "⚠ ALIADO NA ÁREA", cls: "badge-friendly-fire" });

    if (card.ultimate) badges.push({ txt: p.disponivel ? "✦ DEFINITIVA · PRONTA" : "✦ DEFINITIVA", cls: "badge-ultimate" });

    if (p.vantagem && p.vantagem.nivel === "vantagem" && detalhado) badges.push({ txt: "▲ VANTAGEM", cls: "badge-vantagem" });
    if (p.vantagem && p.vantagem.nivel === "desvantagem") badges.push({ txt: "▼ DESVANTAGEM", cls: "badge-desvantagem" });

    // Selos de origem (itens 52/53/54): a habilidade sabe de onde veio?
    if (card.habilidade && card.habilidade.origemTalento) badges.push({ txt: "🌳 TALENTO ATIVO", cls: "badge-sinergia" });
    if (card.habilidade && card.habilidade.sinergiaArma) badges.push({ txt: "🗡️ SINERGIA DE ARMA", cls: "badge-sinergia" });

    const limite = modoInfoTatica() === "avancada" || detalhado ? 5 : 3;
    return badges.slice(0, limite);
  }

  function classesDeEstado(card, p, avaliacao, ehSelecionado, ehFoco) {
    const cls = ["carta-batalha"];
    cls.push(classeElemento(card.elemento || "fisico"));
    cls.push(`carta-tipo-${card.tipo}`);
    if (card.potencia >= 3) cls.push("potencia-3");
    else if (card.potencia === 2) cls.push("potencia-2");

    // Item 85 — PRIORIDADE DE ESTADOS. Um card indisponível nunca também
    // pisca como recomendado: o bloqueio vence tudo.
    if (!p.disponivel) {
      cls.push("estado-desabilitado");
      if (p.bloqueio && p.bloqueio.motivo === "cooldown") cls.push("estado-cooldown");
      if (p.bloqueio && p.bloqueio.motivo === "recurso") cls.push("estado-sem-recurso");
      if (p.bloqueio && p.bloqueio.motivo === "condicao") cls.push("estado-condicao");
    } else {
      if (ehSelecionado) cls.push("estado-selecionado");
      if (avaliacao && avaliacao.nivel) {
        cls.push(`estado-recomendado nivel-${avaliacao.nivel}`);
        if (avaliacao.melhorJogada) cls.push("estado-melhor-jogada");
      }
      if (p.execucao === "garantida") cls.push("estado-execucao");
      if (p.reacao || p.combo) cls.push("estado-combo");
      if (p.interrompe) cls.push("estado-reacao");
      if (card.ultimate) cls.push("estado-ultimate-pronta");
      if (p.dano && ["vantagem", "vantagem_intensa"].includes(p.dano.relacaoElemental)) cls.push("estado-vulneravel");
      if (p.dano && ["resistencia", "resistencia_intensa", "imune"].includes(p.dano.relacaoElemental)) cls.push("estado-resistente");
    }
    if (ehFoco) cls.push("estado-foco");
    if (card.perigosa) cls.push("carta-perigosa");
    return cls.join(" ");
  }

  // -------------------------------------------------------------------
  // Desenho de um card
  // -------------------------------------------------------------------
  function montarCard(card, p, avaliacao, estado, indice) {
    const el = document.createElement("div");
    const ehSelecionado = cardSelecionado && cardSelecionado.id === card.id;
    el.className = classesDeEstado(card, p, avaliacao, ehSelecionado, cardEmFoco && cardEmFoco.id === card.id);
    el.dataset.cardId = card.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    if (!animacoesReduzidas()) el.style.setProperty("--entrada-atraso", `${Math.min(indice, 9) * 55}ms`);

    const ident = identidadeElemento(card.elemento || "fisico");
    const valor = valorPrincipal(card, p);
    const badges = badgesDoCard(card, p, avaliacao);

    const custos = [];
    // "AP": este jogo é ATB — toda ação custa o turno do combatente. Dizer
    // "1 AÇÃO" é honesto; inventar uma barra de AP que o motor não tem não
    // seria (ver relatório final, seção de pendências).
    custos.push(`<span class="carta-custo-item custo-acao" title="Toda ação consome o turno deste combatente (sistema ATB).">⏳ 1 ação</span>`);
    if (card.custoMP > 0) {
      const falta = estado.jogador.mp < card.custoMP;
      custos.push(`<span class="carta-custo-item custo-eter${falta ? " insuficiente" : ""}" title="Éter (MP) necessário: ${card.custoMP}. Você tem ${estado.jogador.mp}.">💠 ${card.custoMP}</span>`);
    }
    if (card.cooldown > 0) {
      custos.push(`<span class="carta-custo-item custo-recarga" title="Recarga de ${card.cooldown} turno(s) após o uso.">↻ ${card.cooldown}</span>`);
    }
    if (card.usoUnico) custos.push(`<span class="carta-custo-item custo-unico" title="Uma vez por batalha.">★ único</span>`);

    const seloElemento = card.elemento
      ? `<span class="carta-elem-selo" title="${nomeElemento(card.elemento, dados.elements)}">${ident.icone} ${ident.nomeMundo}</span>`
      : "";

    el.innerHTML = `
      <span class="carta-runa" aria-hidden="true">${ident.runa}</span>
      <div class="carta-cabecalho">
        <span class="carta-icone" aria-hidden="true">${card.icone}</span>
        <span class="carta-nome">${card.nome}</span>
      </div>
      ${seloElemento ? `<div class="carta-elemento">${seloElemento}</div>` : `<div class="carta-elemento"></div>`}
      ${valor ? `<div class="carta-valor ${valor.classe}"><span class="carta-valor-rotulo">${valor.rotulo}</span><span class="carta-valor-num">${valor.texto}</span></div>` : `<div class="carta-valor carta-valor-vazio"></div>`}
      <div class="carta-custos">${custos.join("")}</div>
      ${badges.length ? `<div class="carta-badges">${badges.map((b) => `<span class="badge-carta ${b.cls}">${b.txt}</span>`).join("")}</div>` : ""}
      ${avaliacao && avaliacao.melhorJogada ? `<div class="carta-selo-melhor">★ ${avaliacao.nivel === 3 ? "OPORTUNIDADE" : "MELHOR JOGADA"}</div>` : ""}
      ${!p.disponivel && p.bloqueio ? `<div class="carta-bloqueio"><span>${p.bloqueio.texto}</span>${p.bloqueio.motivo === "recurso" ? `<small>Éter ${p.bloqueio.atual}/${p.bloqueio.necessario}</small>` : ""}</div>` : ""}
      ${!p.disponivel && p.bloqueio && p.bloqueio.motivo === "cooldown" ? `<div class="carta-cooldown-overlay" style="--cd-restante:${p.bloqueio.restante / Math.max(1, p.bloqueio.total)}"></div>` : ""}
      ${ehSelecionado ? `<div class="carta-confirmar">Toque de novo para confirmar</div>` : ""}
    `;

    // ---- Interação ----
    // Padrão único para mouse e toque (item 91): 1º toque/clique arma o card
    // (mostra detalhes e a barra-fantasma no alvo), 2º confirma. Nunca há
    // ação irreversível com um clique só.
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      acionarCard(card, p, estado);
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); acionarCard(card, p, estado); }
      if (ev.key === "Escape") { cancelarSelecao(); }
    });
    // Hover (desktop) — só previsão, nunca arma o card.
    el.addEventListener("mouseenter", () => {
      if (cardEmFoco && cardEmFoco.id === card.id) return;
      cardEmFoco = card;
      somCardHover();
      mostrarDetalhe(card, p, avaliacao, estado);
      if (p.disponivel || p.dano) onPreverAlvo && onPreverAlvo(estado.alvo, p);
    });
    el.addEventListener("mouseleave", () => {
      if (cardEmFoco && cardEmFoco.id === card.id) cardEmFoco = null;
      // `cacheAvaliacao` pode ter sido invalidado entre o render e este
      // mouseleave (uma ação do inimigo resolveu no meio-tempo) — sem esta
      // guarda, sair do card com o mouse lançaria um TypeError.
      if (cardSelecionado && cacheAvaliacao) {
        const sel = cacheAvaliacao.previsoes.get(cardSelecionado.id);
        mostrarDetalhe(cardSelecionado, sel, cacheAvaliacao.avaliacoes.get(cardSelecionado.id), estado);
        onPreverAlvo && onPreverAlvo(estado.alvo, sel);
      }
      else { mostrarDetalhe(null); onPreverAlvo && onPreverAlvo(null, null); }
    });
    el.addEventListener("focus", () => {
      cardEmFoco = card;
      mostrarDetalhe(card, p, avaliacao, estado);
      onPreverAlvo && onPreverAlvo(estado.alvo, p);
    });
    // Toque longo no celular (item 50/91): abre o detalhe avançado sem
    // armar nem confirmar nada.
    el.addEventListener("touchstart", () => {
      clearTimeout(timerToqueLongo);
      timerToqueLongo = setTimeout(() => {
        mostrarDetalhe(card, p, avaliacao, estado, true);
        onPreverAlvo && onPreverAlvo(estado.alvo, p);
      }, MS_TOQUE_LONGO);
    }, { passive: true });
    const cancelaToque = () => clearTimeout(timerToqueLongo);
    el.addEventListener("touchend", cancelaToque, { passive: true });
    el.addEventListener("touchmove", cancelaToque, { passive: true });
    el.addEventListener("touchcancel", cancelaToque, { passive: true });

    return el;
  }

  function acionarCard(card, p, estado) {
    // Item 98: ação impossível nunca é só ignorada — explica o motivo.
    if (!p.disponivel) {
      somCardErro();
      mostrarErro(p.bloqueio ? p.bloqueio.texto : "Ação indisponível agora.");
      const el = acoesEl.querySelector(`[data-card-id="${card.id}"]`);
      if (el) { el.classList.remove("carta-recusada"); void el.offsetWidth; el.classList.add("carta-recusada"); }
      return;
    }
    if (card.tipo === "item") { onAbrirItens && onAbrirItens(); return; }

    if (!cardSelecionado || cardSelecionado.id !== card.id) {
      // 1º toque: arma.
      cardSelecionado = card;
      confirmarFuga = false;
      somCardSelecionado();
      if (p.reacao || p.combo) somCombo();
      onSelecionarCard && onSelecionarCard(card);
      onPreverAlvo && onPreverAlvo(estado.alvo, p);
      desenhar(ultimoEstado, { manterPagina: true });
      return;
    }
    // 2º toque no mesmo card: confirma.
    if (card.tipo === "fugir" && !confirmarFuga) {
      confirmarFuga = true;
      mostrarErro("Fugir encerra a batalha para o time inteiro. Toque uma terceira vez para confirmar.", "aviso");
      return;
    }
    const escolhido = cardSelecionado;
    cardSelecionado = null;
    confirmarFuga = false;
    onSelecionarCard && onSelecionarCard(null);
    onPreverAlvo && onPreverAlvo(null, null);
    // Animação de "card usado" (item 25) antes de a ação resolver.
    const el = acoesEl.querySelector(`[data-card-id="${escolhido.id}"]`);
    if (el && !animacoesReduzidas()) el.classList.add("carta-usada");
    onJogar(escolhido, p);
  }

  function cancelarSelecao() {
    if (!cardSelecionado) return;
    // Item 24: o card volta suavemente, sem "pop".
    const el = acoesEl.querySelector(`[data-card-id="${cardSelecionado.id}"]`);
    if (el && !animacoesReduzidas()) el.classList.add("carta-cancelando");
    cardSelecionado = null;
    confirmarFuga = false;
    onSelecionarCard && onSelecionarCard(null);
    onPreverAlvo && onPreverAlvo(null, null);
    setTimeout(() => desenhar(ultimoEstado, { manterPagina: true }), animacoesReduzidas() ? 0 : 160);
  }

  // -------------------------------------------------------------------
  // Detalhe / tooltip avançado (itens 50/51/76)
  // -------------------------------------------------------------------
  function mostrarDetalhe(card, p, avaliacao, estado, forcarAvancado = false) {
    const painel = acoesEl.querySelector("#carta-detalhe");
    if (!painel) return;
    if (!card) {
      painel.className = "carta-detalhe vazio";
      painel.innerHTML = `<span class="detalhe-dica">Passe o mouse ou toque em um card para ver a previsão completa.</span>`;
      return;
    }
    const avancado = forcarAvancado || modoInfoTatica() === "avancada";
    const linhas = [];

    if (card.descricao) linhas.push(`<p class="detalhe-desc">${card.descricao}</p>`);

    if (p.dano && !p.dano.imune) {
      const cr = `<span class="detalhe-crit">crítico ${faixaTexto(p.dano.minCritico, p.dano.maxCritico)}</span>`;
      linhas.push(`<div class="detalhe-linha"><b>Dano previsto:</b> ${faixaTexto(p.dano.min, p.dano.max)} (esperado ${p.dano.esperado}) · ${cr}</div>`);
    }
    if (p.dano && p.dano.imune) linhas.push(`<div class="detalhe-linha detalhe-ruim"><b>Imunidade elemental:</b> este golpe causaria 0 de dano.</div>`);
    if (p.area) {
      linhas.push(`<div class="detalhe-linha"><b>${p.area.quantidade} alvos · total estimado:</b> ${faixaTexto(p.area.min, p.area.max)}</div>`);
      linhas.push(`<div class="detalhe-linha detalhe-sub">${p.area.alvos.map((a) => `${a.alvo.nome} ${a.min}–${a.max}${a.mata ? " 💀" : ""}`).join(" · ")}</div>`);
      if (p.area.aliadosNaArea.length) linhas.push(`<div class="detalhe-linha detalhe-ruim">⚠ Aliados na área: ${p.area.aliadosNaArea.map((c) => c.nome).join(", ")}</div>`);
    }
    if (p.cura) {
      linhas.push(`<div class="detalhe-linha"><b>Cura:</b> ${faixaTexto(p.cura.min, p.cura.max)}${p.cura.efetivaEsperada < p.cura.esperado ? ` · <b>efetiva:</b> ${faixaTexto(p.cura.efetivaMin, p.cura.efetivaMax)} (o resto passaria do limite)` : ""}</div>`);
      if (p.cura.curaReduzida) linhas.push(`<div class="detalhe-linha detalhe-ruim">Um estado ativo está reduzindo a cura que você recebe.</div>`);
    }
    if (p.defesa) {
      if (p.defesa.tipo === "guarda") linhas.push(`<div class="detalhe-linha"><b>Guarda:</b> ${pct(p.defesa.chanceBloqueio)} de bloquear o próximo golpe (limiar d20 ${p.defesa.limiar}).</div>`);
      else linhas.push(`<div class="detalhe-linha"><b>Defesa:</b> ${p.defesa.defesaAntes} → ${p.defesa.defesaDepois} por ${p.defesa.duracao} turnos.</div>`);
      if (p.defesa.danoEvitado) linhas.push(`<div class="detalhe-linha"><b>Dano evitado estimado:</b> ${faixaTexto(p.defesa.danoEvitado.min, p.defesa.danoEvitado.max)} (golpe de ${p.defesa.danoEvitado.de.nome}).</div>`);
      if (p.defesa.salvaVida) linhas.push(`<div class="detalhe-linha detalhe-bom">★ Esta defesa impede um golpe que te derrubaria.</div>`);
    }
    if (p.reposicionamento) {
      const r = p.reposicionamento;
      linhas.push(`<div class="detalhe-linha"><b>Nova linha:</b> ${r.destino === "retaguarda" ? "Retaguarda" : "Frente"}${r.reducaoFisica ? ` · −${pct(r.reducaoFisica)} de dano físico` : ""}.</div>`);
      if (r.ameacasEvitadas.length) linhas.push(`<div class="detalhe-linha detalhe-bom">Sai da mira de: ${r.ameacasEvitadas.map((a) => a.inimigo.nome).join(", ")}.</div>`);
      if (r.destino === "retaguarda" && !r.frenteViva) linhas.push(`<div class="detalhe-linha detalhe-ruim">Ninguém de pé na frente: recuar não reduziria dano agora.</div>`);
    }
    if (p.chances && (p.dano || p.status)) {
      const partes = [`acerto ${pct(p.chances.acerto)}`];
      if (p.chances.criticoGarantido) partes.push("crítico garantido");
      else if (p.chances.critico > 0) partes.push(`crítico ${pct(p.chances.critico)}`);
      if (p.chances.bloqueio > 0) partes.push(`bloqueio do alvo ${pct(p.chances.bloqueio)}`);
      if (p.chances.penalidadeD20 > 0) partes.push(`−${p.chances.penalidadeD20} por estar ofuscado`);
      linhas.push(`<div class="detalhe-linha"><b>Rolagem:</b> ${partes.join(" · ")}.</div>`);
    }
    if (p.ruptura) {
      linhas.push(`<div class="detalhe-linha"><b>Ruptura:</b> +${p.ruptura.ganho} de postura (${p.ruptura.postura}/${p.ruptura.posturaMax})${p.ruptura.quebra ? " — <b>quebra agora</b>" : ` · faltam ${p.ruptura.restante}`}.</div>`);
    }
    if (p.status) linhas.push(`<div class="detalhe-linha"><b>Status:</b> ${p.status.icone} ${p.status.nome}${p.status.detalhe ? ` (${p.status.detalhe})` : ""} — ${p.status.garantido ? "garantido" : pct(p.status.chance)}.</div>`);
    if (p.reacao) linhas.push(`<div class="detalhe-linha detalhe-bom">${p.reacao.icone || "✦"} <b>Reação ${p.reacao.nome}:</b> ${p.reacao.descricao || ""}</div>`);
    if (p.comboParty) linhas.push(`<div class="detalhe-linha detalhe-bom">🔗 <b>Combo de party:</b> ${p.comboParty.de.nome} → ${p.comboParty.para.nome} (${p.comboParty.combo.nome}).</div>`);
    if (p.interrompe) linhas.push(`<div class="detalhe-linha detalhe-bom">⚡ <b>Interrupção:</b> ${p.interrompe.vias.join("; ")}.</div>`);

    // Item 76: por que há vantagem/desvantagem.
    if (avancado && p.vantagem && (p.vantagem.motivosBons.length || p.vantagem.motivosRuins.length)) {
      if (p.vantagem.motivosBons.length) linhas.push(`<div class="detalhe-linha detalhe-bom">▲ ${p.vantagem.motivosBons.join(" · ")}</div>`);
      if (p.vantagem.motivosRuins.length) linhas.push(`<div class="detalhe-linha detalhe-ruim">▼ ${p.vantagem.motivosRuins.join(" · ")}</div>`);
    }
    // Item "por que essa opção é boa": os motivos que formaram o score, sem
    // jamais mostrar o score.
    if (avancado && avaliacao && avaliacao.motivos && avaliacao.motivos.length) {
      const ordenados = [...avaliacao.motivos].sort((a, b) => b.pontos - a.pontos).slice(0, 4);
      linhas.push(`<div class="detalhe-linha detalhe-porque"><b>Leitura tática:</b> ${ordenados.map((m) => m.texto).join(" · ")}.</div>`);
    }
    if (avancado && estado) {
      const amb = [];
      if (estado.batalha.terrenoElemento) amb.push(`terreno ${nomeElemento(estado.batalha.terrenoElemento, dados.elements)}`);
      if (estado.batalha.climaElemento) amb.push(`clima ${nomeElemento(estado.batalha.climaElemento, dados.elements)}`);
      if (estado.jogador.posicao) amb.push(`sua linha: ${estado.jogador.posicao}`);
      if (amb.length) linhas.push(`<div class="detalhe-linha detalhe-sub">Contexto: ${amb.join(" · ")}.</div>`);
    }

    painel.className = `carta-detalhe ${classeElemento(card.elemento || "fisico")}`;
    painel.innerHTML = `<div class="detalhe-titulo">${card.icone} ${card.nome}</div>${linhas.join("")}`;
  }

  // -------------------------------------------------------------------
  // Feedback de erro (item 98) e resumo pós-ação (item 97)
  // -------------------------------------------------------------------
  function mostrarErro(texto, tom = "erro") {
    let el = acoesEl.querySelector("#carta-erro");
    if (!el) {
      el = document.createElement("div");
      el.id = "carta-erro";
      acoesEl.appendChild(el);
    }
    el.className = `carta-erro tom-${tom} visivel`;
    el.textContent = texto;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = "carta-erro"; }, 2600);
  }

  function mostrarResumo(partes) {
    if (!partes || !partes.length) return;
    let el = contextoEl.querySelector("#resumo-acao");
    if (!el) {
      el = document.createElement("div");
      el.id = "resumo-acao";
      contextoEl.appendChild(el);
    }
    el.className = "resumo-acao visivel";
    el.innerHTML = partes.map((p) => `<span class="resumo-chip ${p.cls || ""}">${p.txt}</span>`).join("");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = "resumo-acao"; }, 2200);
  }

  // -------------------------------------------------------------------
  // Faixa de contexto: intenções inimigas + linha do tempo (itens 44/69/70)
  // -------------------------------------------------------------------

  // "Percepção" (item 44): Aethra não tem um atributo com esse nome — o
  // equivalente real é DES (a estatística que já governa mira e iniciativa).
  // Usamos a MAIOR DES do time vivo: um batedor no grupo revela mais para
  // todo mundo, que é exatamente o que Percepção significaria.
  function nivelPercepcao(aliados) {
    const vivos = aliados.filter((c) => c.vivo);
    if (!vivos.length) return 0;
    const des = Math.max(...vivos.map((c) => (c.atributos && c.atributos.DES) || 0));
    if (des >= 10) return 2;   // intenção + alvo + faixa de dano
    if (des >= 6) return 1;    // intenção + alvo
    return 0;                  // só o tipo de intenção
  }

  const ICONE_INTENCAO = {
    atacar: { icone: "⚔", rotulo: "Ataque" },
    conjurar: { icone: "🔥", rotulo: "Magia" },
    curar: { icone: "💚", rotulo: "Cura" },
    proteger: { icone: "🛡", rotulo: "Defesa" },
    envenenar: { icone: "☠", rotulo: "Veneno" },
    roubar: { icone: "💰", rotulo: "Roubo" },
    invocar: { icone: "👥", rotulo: "Invocação" },
    hesitar: { icone: "😨", rotulo: "Recuo" },
    atordoado: { icone: "💫", rotulo: "Atordoado" },
    controlado_elemental: { icone: "🧊", rotulo: "Controlado" },
    nada: { icone: "⏳", rotulo: "Parado" },
  };

  function desenharContexto(estado) {
    if (!contextoEl) return;
    const percepcao = nivelPercepcao(estado.aliados);
    const blocos = [];

    // --- Intenções conhecidas
    if (estado.intencoes && estado.intencoes.size) {
      const itens = [];
      for (const [inimigo, info] of estado.intencoes) {
        if (!inimigo.vivo || !info || !info.plano) continue;
        const meta = ICONE_INTENCAO[info.plano.tipo] || ICONE_INTENCAO.atacar;
        let txt = `${meta.icone} ${meta.rotulo}`;
        if (percepcao >= 1 && info.plano.alvo) txt += ` → ${info.plano.alvo.nome}`;
        if (percepcao >= 2 && info.faixa) txt += ` <b>${faixaTexto(info.faixa.min, info.faixa.max)}</b>`;
        const letal = info.faixa && info.plano.alvo && info.faixa.esperado >= info.plano.alvo.hp;
        itens.push(`<span class="intencao-chip${letal ? " intencao-letal" : ""}${inimigo.chefe ? " intencao-chefe" : ""}" title="${inimigo.nome} está preparando esta ação.">${inimigo.nome}: ${txt}${letal ? " ☠" : ""}</span>`);
      }
      if (itens.length) {
        blocos.push(`<div class="faixa-intencoes"><span class="faixa-rotulo">Intenção inimiga</span>${itens.join("")}${percepcao < 2 ? `<span class="intencao-nota" title="Percepção do time (maior Destreza viva) define quanto da intenção é revelado.">👁 percepção limitada</span>` : ""}</div>`);
      }
    }

    // --- Fase / enrage de chefe (item 43)
    const chefe = estado.inimigosVivos.find((i) => i.chefe);
    if (chefe) {
      const fracao = chefe.hp / Math.max(1, chefe.hpMax);
      const fase = fracao > 0.66 ? 1 : fracao > 0.33 ? 2 : 3;
      const postura = chefe.posturaMax ? Math.round((chefe.postura / chefe.posturaMax) * 100) : 0;
      blocos.push(
        `<div class="faixa-chefe"><span class="faixa-rotulo">👑 ${chefe.nome}</span>` +
        `<span class="chefe-chip">FASE ${fase}</span>` +
        (chefe.posturaMax ? `<span class="chefe-chip${postura >= 70 ? " chefe-chip-alerta" : ""}">POSTURA ${postura}%</span>` : "") +
        (chefe.atordoado ? `<span class="chefe-chip chefe-chip-alerta">ATORDOADO — janela de dano</span>` : "") +
        `</div>`
      );
    }

    // --- Linha do tempo de iniciativa (itens 69/70)
    blocos.push(desenharTimeline(estado));

    // --- Dica de iniciante (item 48)
    if (modoInicianteAtivo() && cacheAvaliacao) {
      const dica = montarDica(estado);
      if (dica) blocos.push(`<div class="faixa-dica">💡 ${dica}</div>`);
    }

    const antigoResumo = contextoEl.querySelector("#resumo-acao");
    contextoEl.innerHTML = blocos.join("");
    if (antigoResumo) contextoEl.appendChild(antigoResumo);
  }

  // Ordem prevista de turnos, a partir do MESMO ATB e da MESMA fórmula de
  // velocidade que o loop de batalha usa (Batalha.modificadorVelocidade) —
  // não é um palpite, é o tempo que falta para cada barra encher.
  function calcularTimeline(estado, { simularDebuff = null } = {}) {
    const { batalha } = estado;
    const todos = [...estado.aliados, ...estado.inimigosVivos].filter((c) => c.vivo);
    return todos
      .map((c) => {
        let vel = batalha.modificadorVelocidade(c);
        if (simularDebuff && simularDebuff.alvo === c) vel *= 1 - simularDebuff.valor;
        const falta = Math.max(0, c.atbMax - c.atb);
        return { c, tempo: falta / Math.max(0.01, vel) };
      })
      .sort((a, b) => a.tempo - b.tempo);
  }

  function desenharTimeline(estado) {
    const linha = calcularTimeline(estado).slice(0, 7);
    // Item 70: se o card armado atrasa alguém, a timeline mostra a mudança.
    let alterada = null;
    if (cardSelecionado && cardSelecionado.subtipo === "debuff_velocidade" && estado.alvo) {
      const h = cardSelecionado.habilidade;
      const nova = calcularTimeline(estado, { simularDebuff: { alvo: estado.alvo, valor: h.valor || 0 } }).slice(0, 7);
      alterada = new Map(nova.map((e, i) => [e.c, i]));
    }
    const chips = linha.map((entrada, i) => {
      const c = entrada.c;
      const destino = alterada ? alterada.get(c) : null;
      const moveu = destino != null && destino !== i;
      return `<span class="tl-chip ${c.isPlayer ? "tl-aliado" : "tl-inimigo"}${c === estado.jogador ? " tl-ativo" : ""}${c.chefe ? " tl-chefe" : ""}${moveu ? " tl-movido" : ""}" title="${c.nome}${moveu ? ` — sairia para a posição ${destino + 1}` : ""}">${i + 1}. ${c.nome}${moveu ? (destino > i ? " ↓" : " ↑") : ""}</span>`;
    });
    return `<div class="faixa-timeline"><span class="faixa-rotulo">Ordem</span>${chips.join("<span class=\"tl-seta\">›</span>")}${alterada ? `<span class="tl-nota">prévia com o atraso aplicado</span>` : ""}</div>`;
  }

  function montarDica(estado) {
    const { cards, previsoes, avaliacoes } = cacheAvaliacao;
    // 1) Uma reação/combo disponível é sempre a dica mais útil.
    for (const card of cards) {
      const p = previsoes.get(card.id);
      if (p && p.disponivel && p.reacao) return `${card.nome} dispara a reação <b>${p.reacao.nome}</b> neste alvo.`;
    }
    // 2) Fraqueza elemental do alvo.
    if (estado.alvo) {
      for (const card of cards) {
        const p = previsoes.get(card.id);
        if (p && p.disponivel && p.dano && p.dano.relacaoElemental === "vantagem_intensa") {
          return `<b>${estado.alvo.nome}</b> é vulnerável a ${nomeElemento(card.elemento, dados.elements)}.`;
        }
      }
    }
    // 3) Interrupção possível.
    for (const card of cards) {
      const p = previsoes.get(card.id);
      if (p && p.disponivel && p.interrompe) return `Você pode interromper a ação de <b>${p.interrompe.inimigo.nome}</b> com ${card.nome}.`;
    }
    // 4) Senão, o motivo do card recomendado.
    for (const card of cards) {
      const a = avaliacoes.get(card.id);
      if (a && a.melhorJogada) return dicaIniciante(a, card);
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Configurações (item 99)
  // -------------------------------------------------------------------
  function montarConfiguracoes() {
    const cfg = configCards();
    const grupo = (rotulo, chave, mapa) =>
      `<label class="cfg-linha"><span>${rotulo}</span><select data-cfg="${chave}">${Object.entries(mapa)
        .map(([v, t]) => `<option value="${v}"${cfg[chave] === v ? " selected" : ""}>${t}</option>`)
        .join("")}</select></label>`;
    return `
      <div class="cards-config-painel" id="cards-config-painel" hidden>
        <div class="cfg-titulo">Leitura da batalha</div>
        ${grupo("Sugestão de jogada", "sugestaoJogada", SUGESTAO_JOGADA)}
        ${grupo("Dano previsto", "danoPrevisto", DANO_PREVISTO)}
        ${grupo("Animações dos cards", "animacoes", ANIMACOES_CARDS)}
        ${grupo("Informações táticas", "infoTatica", INFO_TATICA)}
        <label class="cfg-linha cfg-check"><input type="checkbox" data-cfg-bool="modoIniciante"${cfg.modoIniciante ? " checked" : ""}/><span>Mostrar dicas de iniciante</span></label>
        <label class="cfg-linha cfg-check"><input type="checkbox" data-cfg-bool="dadoSomenteImportante"${cfg.dadoSomenteImportante ? " checked" : ""}/><span>Mostrar o d20 só em momentos importantes</span></label>
        <p class="cfg-nota">A sugestão nunca joga por você: ela só destaca cards. Você continua escolhendo — inclusive um card sem destaque.</p>
      </div>`;
  }

  function ligarConfiguracoes(raiz) {
    raiz.querySelectorAll("[data-cfg]").forEach((sel) => {
      sel.addEventListener("change", () => {
        salvarConfigCards({ [sel.dataset.cfg]: sel.value });
        invalidar();
        desenhar(ultimoEstado, { manterPagina: true, manterConfig: true });
      });
    });
    raiz.querySelectorAll("[data-cfg-bool]").forEach((chk) => {
      chk.addEventListener("change", () => {
        salvarConfigCards({ [chk.dataset.cfgBool]: chk.checked });
        invalidar();
        desenhar(ultimoEstado, { manterPagina: true, manterConfig: true });
      });
    });
  }

  // -------------------------------------------------------------------
  // Desenho da mão
  // -------------------------------------------------------------------
  function desenhar(estado, { manterPagina = false, manterConfig = false } = {}) {
    if (!estado) return;
    ultimoEstado = estado;
    const configAberta = manterConfig && acoesEl.querySelector("#cards-config-painel") && !acoesEl.querySelector("#cards-config-painel").hidden;
    const { cards, previsoes, avaliacoes } = avaliar(estado);

    // Som de "recarga concluída" (item 79): dispara só na transição.
    const prontasAgora = new Set(cards.filter((c) => previsoes.get(c.id).disponivel && c.cooldown > 0).map((c) => c.id));
    for (const id of prontasAgora) if (!ultimasProntas.has(id) && ultimasProntas.size) somCooldownPronto();
    const ultId = cards.find((c) => c.ultimate && previsoes.get(c.id).disponivel);
    if (ultId && !ultimasProntas.has(ultId.id) && ultimasProntas.size) somUltimatePronta();
    ultimasProntas = prontasAgora;

    if (!manterPagina) pagina = 0;
    const totalPaginas = Math.max(1, Math.ceil(cards.length / CARDS_POR_PAGINA));
    pagina = Math.min(pagina, totalPaginas - 1);
    const visiveis = totalPaginas > 1 ? cards.slice(pagina * CARDS_POR_PAGINA, (pagina + 1) * CARDS_POR_PAGINA) : cards;

    acoesEl.innerHTML = `
      <div class="mao-cabecalho">
        <span class="mao-titulo">Ação de <b>${estado.jogador.nome}</b></span>
        <span class="mao-recursos" title="Éter disponível para habilidades.">💠 ${estado.jogador.mp}/${estado.jogador.mpMax}</span>
        <span class="mao-linha" title="Sua linha na formação. Trocar de linha custa o turno.">${estado.jogador.posicao === "retaguarda" ? "🛡️ Retaguarda" : "⚔️ Frente"}</span>
        <button type="button" class="mao-btn-config" id="btn-cards-config" title="Configurações de leitura da batalha">⚙️</button>
      </div>
      ${montarConfiguracoes()}
      <div class="mao-cards" id="mao-cards"></div>
      ${totalPaginas > 1 ? `<div class="mao-paginacao"><button type="button" id="pg-ant" ${pagina === 0 ? "disabled" : ""}>‹</button><span>${pagina + 1}/${totalPaginas}</span><button type="button" id="pg-prox" ${pagina >= totalPaginas - 1 ? "disabled" : ""}>›</button></div>` : ""}
      <div class="carta-detalhe vazio" id="carta-detalhe"><span class="detalhe-dica">Passe o mouse ou toque em um card para ver a previsão completa.</span></div>
      <div class="carta-erro" id="carta-erro"></div>
    `;
    if (animacoesReduzidas()) acoesEl.classList.add("animacoes-reduzidas");
    else acoesEl.classList.remove("animacoes-reduzidas");
    if (cardSelecionado) acoesEl.classList.add("mao-com-selecao");
    else acoesEl.classList.remove("mao-com-selecao");

    const maoEl = acoesEl.querySelector("#mao-cards");
    visiveis.forEach((card, i) => {
      maoEl.appendChild(montarCard(card, previsoes.get(card.id), avaliacoes.get(card.id), estado, i));
    });

    const btnCfg = acoesEl.querySelector("#btn-cards-config");
    const painelCfg = acoesEl.querySelector("#cards-config-painel");
    if (configAberta && painelCfg) painelCfg.hidden = false;
    if (btnCfg) btnCfg.addEventListener("click", (ev) => { ev.stopPropagation(); painelCfg.hidden = !painelCfg.hidden; });
    ligarConfiguracoes(acoesEl);

    const ant = acoesEl.querySelector("#pg-ant");
    const prox = acoesEl.querySelector("#pg-prox");
    if (ant) ant.addEventListener("click", (ev) => { ev.stopPropagation(); pagina -= 1; desenhar(estado, { manterPagina: true }); });
    if (prox) prox.addEventListener("click", (ev) => { ev.stopPropagation(); pagina += 1; desenhar(estado, { manterPagina: true }); });

    if (cardSelecionado) {
      const p = previsoes.get(cardSelecionado.id);
      mostrarDetalhe(cardSelecionado, p, avaliacoes.get(cardSelecionado.id), estado);
      // BUG encontrado no teste de teclado: armar um card reconstrói a mão,
      // o elemento que tinha o foco é destruído e o foco volta para o <body>.
      // Resultado: quem joga por teclado armava o card e depois não
      // conseguia confirmar nem cancelar. Devolvemos o foco ao card armado.
      const elSelecionado = maoEl.querySelector(`[data-card-id="${cardSelecionado.id}"]`);
      if (elSelecionado && document.activeElement !== elSelecionado) {
        try { elSelecionado.focus({ preventScroll: true }); } catch (e) { elSelecionado.focus(); }
      }
    }
    desenharContexto(estado);
  }

  // Clique fora da mão cancela a seleção (item 24).
  //
  // BUG encontrado no teste de integração (e que atingiria TODO clique real):
  // a versão anterior checava `acoesEl.contains(ev.target)` no bubbling, no
  // documento. Só que o handler do card, que roda antes, chama desenhar() e
  // reconstrói o innerHTML da mão — quando o evento chegava ao documento, o
  // elemento clicado já tinha sido removido do DOM, `contains` dava false, e
  // o card recém-armado era cancelado no mesmo clique. Na prática o jogador
  // via o card piscar e nunca conseguia confirmar a ação.
  //
  // A correção marca a origem do clique na fase de CAPTURA, que roda antes de
  // qualquer handler de card e, portanto, antes de qualquer re-render.
  let cliqueNasceuNaMao = false;
  const marcarOrigem = () => { cliqueNasceuNaMao = true; };
  acoesEl.addEventListener("click", marcarOrigem, true);
  const cancelarPorClicoFora = () => {
    if (cliqueNasceuNaMao) { cliqueNasceuNaMao = false; return; }
    if (!cardSelecionado) return;
    cancelarSelecao();
  };
  document.addEventListener("click", cancelarPorClicoFora);

  // Escape cancela a seleção de qualquer lugar da tela — não só de cima do
  // card. Necessário porque o foco pode estar em qualquer elemento quando o
  // jogador desiste da jogada.
  const cancelarPorEscape = (ev) => {
    if (ev.key !== "Escape" || !cardSelecionado) return;
    ev.stopPropagation();
    cancelarSelecao();
  };
  document.addEventListener("keydown", cancelarPorEscape);

  return {
    desenhar,
    invalidar,
    mostrarErro,
    mostrarResumo,
    cancelarSelecao,
    // Usado quando NÃO é a vez do jogador (turno inimigo, telegraph): a mão
    // some, mas a leitura da batalha continua — é exatamente nesse momento
    // que o jogador precisa ver a intenção e a ordem de turnos.
    desenharContextoApenas(estado) {
      if (!estado || !estado.jogador) return;
      ultimoEstado = estado;
      avaliar(estado);
      desenharContexto(estado);
    },
    get cardSelecionado() { return cardSelecionado; },
    // Usado pela BattleUI ao trocar de alvo: a seleção sobrevive, mas todas
    // as previsões precisam ser refeitas (item 5/66).
    trocouAlvo(estado) { invalidar(); desenhar(estado, { manterPagina: true }); },
    destruir() {
      document.removeEventListener("click", cancelarPorClicoFora);
      document.removeEventListener("keydown", cancelarPorEscape);
      acoesEl.removeEventListener("click", marcarOrigem, true);
      clearTimeout(timerToqueLongo);
    },
  };
}
