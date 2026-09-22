// Motor de PREVISÃO da mão de cards (módulo puro — sem DOM, sem timers).
//
// Responsabilidade única: dado um combatente do time, a instância de
// `Batalha` e o alvo selecionado, montar (a) a lista de cards jogáveis
// naquele turno e (b) a previsão completa de cada card (faixa de dano, cura
// efetiva, chance de acerto/crítico, ruptura, status, reação/combo,
// execução, interrupção, vantagem/desvantagem).
//
// Regras de ouro deste arquivo:
//   1. Nada aqui rola dado nem muda estado de batalha. Todas as fórmulas
//      vêm das prévias só-leitura de CombatSystem.js (estimarFaixaDano,
//      estimarFaixaDanoMagico, estimarCura, chancesD20, estimarRuptura...),
//      que por sua vez espelham as fórmulas reais no mesmo arquivo.
//   2. Nada aqui decide a jogada. A pontuação tática mora em
//      TacticalAdvisor.js; o que este módulo produz são FATOS previstos.
//   3. Sem DOM: dá pra rodar tudo em Node (ver scripts/test-battle-cards.mjs).
import { estadoElementalAtivo, buscarEstadoDef, buscarReacaoAplicavel } from "./ElementalReactionSystem.js";
import { comboDoisElementos } from "./CombatSystem.js";
import { FLAGS } from "../data/featureFlags.js";

// Tipos de habilidade cuja fórmula de dano é a FÍSICA (rolarAtaque) — os
// mesmos já tratados assim em CombatSystem.usarHabilidade().
export const TIPOS_FISICOS = ["dano_fisico", "dano_fisico_des", "dano_ignora_defesa"];
export const TIPOS_OFENSIVOS = [...TIPOS_FISICOS, "dano_magico", "debuff_velocidade"];
export const TIPOS_ALVO_PROPRIO = ["cura", "buff_defesa", "buff_ataque", "fuga"];

// Opções que cada tipo de habilidade passa para rolarAtaque() — cópia fiel
// do switch de usarHabilidade(), para que a prévia use exatamente os mesmos
// modificadores que a execução real usará.
export function opcoesDeDano(habilidade) {
  const opts = { multiplicador: habilidade.multiplicador || 1, elementoAtacante: habilidade.elemento || null };
  if (habilidade.tipo === "dano_fisico_des") opts.atributoForcado = "DES";
  if (habilidade.tipo === "dano_ignora_defesa") { opts.ignoraDefesa = 999; opts.respeitaFormacao = false; }
  return opts;
}

// "Potência" visual do card (item 55: cards de rank maior parecem mais
// elaborados). O jogo não guarda `rank` na habilidade em combate — o tier da
// árvore fica na origem (skillTrees/talents), não no objeto copiado para o
// combatente. Então derivamos de dois dados que ESTÃO no card: o
// multiplicador e o custo/recarga. Só afeta moldura, nunca tamanho nem
// nenhuma regra.
export function potenciaVisual(habilidade) {
  if (!habilidade) return 1;
  const mult = habilidade.multiplicador || 0;
  const peso = mult + (habilidade.custoMP || 0) / 20 + (habilidade.cooldown || 0) / 6;
  if (peso >= 2.1) return 3;
  if (peso >= 1.5) return 2;
  return 1;
}

// A "ultimate" do combatente, para fins de moldura/recomendação especial
// (itens 56/57): a habilidade ofensiva de maior multiplicador que ele
// possui. Mesma definição já usada pela IA de auto-batalha
// (AutoBattleAI.habilidadeUltimate) — só que aqui olha TODAS as habilidades
// (mesmo em recarga ou sem MP), porque o card precisa existir na mão mesmo
// quando ainda não está pronto, mostrando "READY" só quando estiver.
export function idUltimate(combatente) {
  const ofensivas = (combatente.habilidades || []).filter((h) => TIPOS_OFENSIVOS.includes(h.tipo));
  if (!ofensivas.length) return null;
  const melhor = [...ofensivas].sort(
    (a, b) => (b.multiplicador || 0) - (a.multiplicador || 0) || String(a.id).localeCompare(String(b.id))
  )[0];
  // Só vale como "ultimate" se realmente se destaca do resto da mão — numa
  // mão com dois golpes de 1.3x, nenhum é ultimate.
  if ((melhor.multiplicador || 0) < 1.5) return null;
  return melhor.id;
}

// ---------------------------------------------------------------------
// 1. MONTAGEM DA MÃO
// ---------------------------------------------------------------------

// Constrói os descritores dos cards disponíveis para `jogador` neste turno.
// `contexto` traz o que não está no combatente: itens da mochila, se o
// personagem é draconato com sopro sobrando, etc.
export function montarMao(jogador, contexto = {}) {
  const cards = [];
  const ultId = idUltimate(jogador);

  cards.push({
    id: "acao_atacar",
    tipo: "ataque",
    nome: "Ataque Básico",
    descricao: "Golpe com a arma equipada. Sem custo, sem recarga.",
    icone: "⚔️",
    elemento: jogador.elemento || "fisico",
    custoMP: 0,
    cooldown: 0,
    cooldownAtual: 0,
    alvoTipo: "inimigo",
    habilidade: null,
    ultimate: false,
    potencia: 1,
    fisico: true,
  });

  (jogador.habilidades || []).forEach((h) => {
    const ofensiva = TIPOS_OFENSIVOS.includes(h.tipo);
    cards.push({
      id: `hab_${h.id}`,
      tipo: "habilidade",
      subtipo: h.tipo,
      nome: h.nome,
      descricao: h.descricao || "",
      icone: iconePorTipoHabilidade(h.tipo),
      elemento: h.elemento || (ofensiva ? jogador.elemento || "fisico" : null),
      custoMP: h.custoMP || 0,
      cooldown: h.cooldown || 0,
      cooldownAtual: h.cooldownAtual || 0,
      alvoTipo: TIPOS_ALVO_PROPRIO.includes(h.tipo) ? "self" : "inimigo",
      habilidade: h,
      ultimate: h.id === ultId,
      potencia: potenciaVisual(h),
      fisico: TIPOS_FISICOS.includes(h.tipo),
    });
  });

  if (contexto.soproDisponivel) {
    // O sopro sai no elemento escolhido na criação (fogo para quem não
    // escolheu) — ver Batalha.elementoDoSopro.
    const elementoSopro = jogador.elementoAfinidade || "fogo";
    cards.push({
      id: "acao_sopro",
      tipo: "sopro",
      nome: "Sopro Elemental",
      descricao: "Atinge TODOS os inimigos vivos com o seu elemento, com chance de deixar o estado dele. Uma vez por batalha.",
      icone: "💨",
      elemento: elementoSopro,
      custoMP: 0,
      cooldown: 0,
      cooldownAtual: 0,
      alvoTipo: "area_inimigos",
      habilidade: null,
      ultimate: true,
      potencia: 3,
      fisico: false,
      usoUnico: true,
    });
  }

  cards.push({
    id: "acao_defender",
    tipo: "defender",
    nome: "Defender",
    descricao: "Prepara a guarda: o próximo golpe recebido só passa se o d20 do atacante superar seu limiar de defesa.",
    icone: "🛡️",
    elemento: null,
    custoMP: 0,
    cooldown: 0,
    cooldownAtual: 0,
    alvoTipo: "self",
    habilidade: null,
    ultimate: false,
    potencia: 1,
    fisico: false,
  });

  // Card de posição (itens 59-62 adaptados a este jogo): Aethra não usa
  // grade de hexágonos em combate — a posição existe, mas é a FORMAÇÃO
  // (frente/retaguarda, ver FormationSystem.js/formacaoReducaoDano). Então
  // "mover" aqui é trocar de linha, o que muda de verdade quem a IA inimiga
  // consegue mirar e quanto dano físico o personagem recebe.
  if (contexto.podeReposicionar !== false) {
    const indoPara = jogador.posicao === "retaguarda" ? "frente" : "retaguarda";
    cards.push({
      id: "acao_reposicionar",
      tipo: "reposicionar",
      nome: indoPara === "retaguarda" ? "Recuar para a Retaguarda" : "Avançar para a Frente",
      descricao:
        indoPara === "retaguarda"
          ? "Troca de linha: na retaguarda você sofre 25% menos dano físico enquanto houver aliado de pé na frente, e a maioria dos inimigos corpo a corpo deixa de te alcançar."
          : "Troca de linha: na frente você vira o alvo prioritário dos inimigos corpo a corpo, protegendo quem está atrás.",
      icone: indoPara === "retaguarda" ? "🛡️" : "⚔️",
      elemento: null,
      custoMP: 0,
      cooldown: 0,
      cooldownAtual: 0,
      alvoTipo: "self",
      habilidade: null,
      ultimate: false,
      potencia: 1,
      fisico: false,
      destino: indoPara,
    });
  }

  if (contexto.temItens) {
    cards.push({
      id: "acao_item",
      tipo: "item",
      nome: "Usar Item",
      descricao: "Abre a mochila compartilhada do time (poções, antídotos, bombas).",
      icone: "🎒",
      elemento: null,
      custoMP: 0, cooldown: 0, cooldownAtual: 0,
      alvoTipo: "aliado",
      habilidade: null, ultimate: false, potencia: 1, fisico: false,
    });
  }

  cards.push({
    id: "acao_fugir",
    tipo: "fugir",
    nome: "Fugir",
    descricao: "Tenta escapar com o time inteiro. Ação irreversível: pede confirmação.",
    icone: "🏃",
    elemento: null,
    custoMP: 0, cooldown: 0, cooldownAtual: 0,
    alvoTipo: "nenhum",
    habilidade: null, ultimate: false, potencia: 1, fisico: false,
    perigosa: true,
  });

  return cards;
}

function iconePorTipoHabilidade(tipo) {
  switch (tipo) {
    case "dano_fisico": return "🗡️";
    case "dano_fisico_des": return "🎯";
    case "dano_ignora_defesa": return "🩸";
    case "dano_magico": return "🔮";
    case "cura": return "💚";
    case "buff_defesa": return "🛡️";
    case "buff_ataque": return "💢";
    case "debuff_velocidade": return "🐌";
    case "fuga": return "🏃";
    default: return "✦";
  }
}

// ---------------------------------------------------------------------
// 2. PREVISÃO DE UM CARD
// ---------------------------------------------------------------------

// `estado` reúne tudo que a previsão precisa saber além do card:
//   { batalha, jogador, alvo, aliados, inimigosVivos, intencoes, dados }
// `intencoes`: Map de inimigo -> { plano, faixa } já telegrafado/enfileirado
// (ver BattleUI.js) — é o que permite prever "esta defesa evita X de dano" e
// "este card interrompe aquele ataque".
export function preverCard(card, estado) {
  const { batalha, jogador, alvo } = estado;
  const previsao = {
    disponivel: true,
    bloqueio: null,
    dano: null,
    area: null,
    cura: null,
    defesa: null,
    chances: null,
    ruptura: null,
    status: null,
    reacao: null,
    combo: null,
    comboParty: null,
    execucao: null,
    chanceMatar: 0,
    interrompe: null,
    vantagem: null,
    reposicionamento: null,
    exigeAlvo: card.alvoTipo === "inimigo",
  };

  // --- Disponibilidade (itens 26/27/28): o card NUNCA some, só explica.
  const h = card.habilidade;
  if (h) {
    if ((h.cooldownAtual || 0) > 0) {
      previsao.disponivel = false;
      previsao.bloqueio = {
        motivo: "cooldown",
        texto: `RECARGA ${h.cooldownAtual} ${h.cooldownAtual === 1 ? "TURNO" : "TURNOS"}`,
        restante: h.cooldownAtual,
        total: (h.cooldown || 0) + 1,
      };
    } else if (jogador.mp < (h.custoMP || 0)) {
      const falta = (h.custoMP || 0) - jogador.mp;
      previsao.disponivel = false;
      previsao.bloqueio = {
        motivo: "recurso",
        texto: `FALTA ${falta} DE ÉTER`,
        necessario: h.custoMP,
        atual: jogador.mp,
        falta,
      };
    } else if (h.requerEstadoAlvo) {
      // Gancho para habilidades condicionais (item 28). Nenhuma habilidade
      // do jogo declara isso hoje; quando declarar, o card já explica a
      // condição em vez de simplesmente não funcionar.
      const estadoAtivo = alvo ? estadoElementalAtivo(alvo) : null;
      if (!estadoAtivo || estadoAtivo.estadoId !== h.requerEstadoAlvo) {
        const def = buscarEstadoDef(h.requerEstadoAlvo, estado.dados && estado.dados.elementalStates);
        previsao.disponivel = false;
        previsao.bloqueio = {
          motivo: "condicao",
          texto: `SÓ CONTRA ALVO ${(def && def.nome ? def.nome.toUpperCase() : String(h.requerEstadoAlvo).toUpperCase())}`,
        };
      }
    }
  }
  if (card.tipo === "reposicionar" && estado.reposicionarBloqueado) {
    previsao.disponivel = false;
    previsao.bloqueio = { motivo: "condicao", texto: "SEM ALIADO PARA SEGURAR A FRENTE" };
  }
  if (previsao.exigeAlvo && (!alvo || !alvo.vivo)) {
    previsao.disponivel = false;
    previsao.bloqueio = previsao.bloqueio || { motivo: "alvo", texto: "SEM ALVO VÁLIDO" };
  }

  // --- Previsões numéricas (calculadas mesmo com o card bloqueado: é o que
  // permite ao jogador comparar "vale esperar a recarga?").
  if (card.tipo === "ataque" || (card.tipo === "habilidade" && TIPOS_OFENSIVOS.includes(card.subtipo))) {
    if (alvo && alvo.vivo) preverOfensivo(card, previsao, estado);
  } else if (card.tipo === "sopro") {
    preverArea(card, previsao, estado);
  } else if (card.tipo === "habilidade" && card.subtipo === "cura") {
    previsao.cura = batalha.estimarCura(jogador, h);
  } else if (card.tipo === "habilidade" && card.subtipo === "buff_defesa") {
    preverDefesa(card, previsao, estado, { valor: h.valor || 0, duracao: (h.duracao || 0) + 1 });
  } else if (card.tipo === "habilidade" && card.subtipo === "buff_ataque") {
    previsao.buff = {
      texto: `+${Math.round((h.valor || 0) * 100)}% no próximo golpe`,
      contrapartida: "−20% de defesa enquanto durar a fúria",
    };
  } else if (card.tipo === "defender") {
    const bloq = batalha.chanceBloqueioSeDefender(jogador);
    previsao.defesa = { chanceBloqueio: bloq.chance, limiar: bloq.limiar, danoEvitado: null, tipo: "guarda" };
    aplicarDanoEvitado(previsao, estado, { bloqueiaTudo: true, chance: bloq.chance });
  } else if (card.tipo === "reposicionar") {
    preverReposicionamento(card, previsao, estado);
  }

  return previsao;
}

function preverOfensivo(card, previsao, estado) {
  const { batalha, jogador, alvo } = estado;
  const h = card.habilidade;
  const magico = card.subtipo === "dano_magico";
  const elemento = card.elemento || jogador.elemento || "fisico";

  if (card.subtipo === "debuff_velocidade") {
    previsao.status = {
      nome: "Lento",
      icone: "🐌",
      chance: 1,
      detalhe: `−${Math.round((h.valor || 0) * 100)}% de velocidade por ${(h.duracao || 0) + 1} turnos`,
      garantido: true,
    };
    previsao.chances = batalha.chancesD20(jogador, alvo, { tipoFisico: false, elemento });
    return;
  }

  const faixa = magico
    ? batalha.estimarFaixaDanoMagico(jogador, alvo, { multiplicador: (h && h.multiplicador) || 1, elementoAtacante: h && h.elemento })
    : batalha.estimarFaixaDano(jogador, alvo, h ? opcoesDeDano(h) : {});

  previsao.dano = faixa;
  previsao.chances = batalha.chancesD20(jogador, alvo, { tipoFisico: !magico, elemento });
  previsao.ruptura = batalha.estimarRuptura(jogador, alvo, faixa.relacaoElemental);
  previsao.reacao = faixa.reacao || null;
  previsao.combo = faixa.combo || null;

  // Combo de party (item 10): quem preparou o alvo para este golpe.
  const ult = batalha.ultimoAtaqueAliado;
  if (previsao.combo && ult && ult.alvo === alvo && ult.atacante !== jogador) {
    previsao.comboParty = { de: ult.atacante, para: jogador, combo: previsao.combo };
  }

  // Estado elemental que ESTE card aplica no alvo (habilidades novas com
  // `aplicaEstado`, ver elementalStates.json). Aplicação é determinística
  // quando o golpe acerta — então a "chance" exibida é a chance de acerto.
  if (FLAGS.reacoesElementais && h && h.aplicaEstado) {
    const def = buscarEstadoDef(h.aplicaEstado, estado.dados && estado.dados.elementalStates);
    if (def) {
      previsao.status = {
        nome: def.nome, icone: def.icone || "✦",
        chance: previsao.chances.acerto,
        detalhe: `${h.duracaoEstado || def.duracaoPadrao} turnos`,
        garantido: false,
      };
    }
  }
  // Estado aplicado pela REAÇÃO (ex.: Congelamento deixa o alvo Congelado).
  if (previsao.reacao && previsao.reacao.aplicaEstado) {
    const def = buscarEstadoDef(previsao.reacao.aplicaEstado, estado.dados && estado.dados.elementalStates);
    if (def) {
      previsao.status = {
        nome: def.nome, icone: def.icone || "✦",
        chance: previsao.chances.acerto,
        detalhe: `via reação ${previsao.reacao.nome}`,
        garantido: false,
      };
    }
  }

  preverExecucao(previsao, alvo);
  preverVantagem(previsao, estado, { magico, elemento });
  preverInterrupcao(card, previsao, estado);
}

function preverArea(card, previsao, estado) {
  const { batalha, jogador, inimigosVivos } = estado;
  // Sopro Elemental: a MESMA fórmula do golpe de verdade (Batalha.danoDoSopro)
  // — INT × 1,6 no elemento do herói, matriz elemental, terreno, clima e
  // essência, defesa a 30%, sem d20 (nunca erra).
  const alvos = inimigosVivos.map((i) => {
    const e = batalha.estimarSopro(jogador, i);
    return { alvo: i, min: e.min, max: e.max, esperado: e.esperado, mata: e.min >= i.hp, relacaoElemental: e.relacaoElemental };
  });
  previsao.area = {
    alvos,
    quantidade: alvos.length,
    min: alvos.reduce((s, a) => s + a.min, 0),
    max: alvos.reduce((s, a) => s + a.max, 0),
    esperado: alvos.reduce((s, a) => s + a.esperado, 0),
    abates: alvos.filter((a) => a.mata).length,
    // Fogo amigo (item 64): o Sopro só alcança inimigos. O campo existe
    // sempre para a UI poder avisar assim que qualquer card de área futuro
    // incluir aliados na lista.
    aliadosNaArea: [],
  };
  previsao.chances = { acerto: 1, erro: 0, bloqueio: 0, critico: 0, criticoGarantido: false, penalidadeD20: 0, rerolagemSorte: false, rerolagemSorteMiuda: false, limiarBloqueio: null };
  if (previsao.area.abates > 0) previsao.execucao = "garantida";
  else if (alvos.some((a) => a.max >= a.alvo.hp)) previsao.execucao = "possivel";
  previsao.chanceMatar = previsao.area.abates > 0 ? 1 : 0;
}

function preverDefesa(card, previsao, estado, { valor, duracao }) {
  const { batalha, jogador } = estado;
  const defAtual = batalha.defesaEfetiva(jogador);
  previsao.defesa = {
    tipo: "buff",
    reducaoPercent: valor,
    duracao,
    defesaAntes: defAtual,
    defesaDepois: Math.round(defAtual * (1 + valor)),
    danoEvitado: null,
  };
  aplicarDanoEvitado(previsao, estado, { fatorDefesa: 1 + valor });
}

// Item 19: "dano evitado estimado". Só é possível dizer isso quando existe
// uma intenção inimiga conhecida mirando este personagem — nesse caso
// recalculamos a MESMA faixa de dano com a defesa aumentada (ou com o
// bloqueio da guarda) e mostramos a diferença. Sem intenção conhecida, o
// card mostra a redução percentual e nada mais, em vez de inventar um número.
function aplicarDanoEvitado(previsao, estado, { fatorDefesa = 1, bloqueiaTudo = false, chance = 1 }) {
  const { batalha, jogador, intencoes } = estado;
  if (!intencoes || !intencoes.size) return;
  let melhor = null;
  for (const [inimigo, info] of intencoes) {
    if (!info || !info.plano || info.plano.alvo !== jogador || !inimigo.vivo) continue;
    const faixa = info.faixa || batalha.estimarDanoIntencao(inimigo, info.plano);
    if (!faixa) continue;
    if (!melhor || faixa.esperado > melhor.faixa.esperado) melhor = { inimigo, faixa };
  }
  if (!melhor) return;
  if (bloqueiaTudo) {
    previsao.defesa.danoEvitado = {
      min: Math.round(melhor.faixa.min * chance),
      max: Math.round(melhor.faixa.max * chance),
      esperado: Math.round(melhor.faixa.esperado * chance),
      de: melhor.inimigo,
      chance,
      integral: true,
    };
  } else {
    // A defesa entra no cálculo como `dano - defesa*0.5`; simulamos o mesmo
    // desconto extra que a defesa multiplicada produziria.
    const extra = batalha.defesaEfetiva(jogador) * (fatorDefesa - 1) * 0.5;
    previsao.defesa.danoEvitado = {
      min: Math.max(0, Math.round(Math.min(melhor.faixa.min, extra))),
      max: Math.max(0, Math.round(Math.min(melhor.faixa.max, extra))),
      esperado: Math.max(0, Math.round(Math.min(melhor.faixa.esperado, extra))),
      de: melhor.inimigo,
      chance: 1,
      integral: false,
    };
  }
  previsao.defesa.ameaca = melhor;
  // "Esta defesa salva o personagem" (item 19/45): o golpe previsto mata sem
  // a defesa, e não mata (ou é bloqueado) com ela.
  const morreriaSem = melhor.faixa.esperado >= jogador.hp;
  const sobraDepois = jogador.hp - Math.max(0, melhor.faixa.esperado - (previsao.defesa.danoEvitado.esperado || 0));
  previsao.defesa.salvaVida = morreriaSem && (bloqueiaTudo ? chance >= 0.4 : sobraDepois > 0);
}

function preverReposicionamento(card, previsao, estado) {
  const { batalha, jogador, aliados, intencoes } = estado;
  const destino = card.destino;
  const frenteViva = aliados.some((c) => c !== jogador && c.posicao === "frente" && c.vivo);
  const info = {
    destino,
    frenteViva,
    reducaoFisica: destino === "retaguarda" && frenteViva ? 0.25 : 0,
    // Ameaças que deixariam de alcançar o personagem na retaguarda: os
    // arquétipos corpo a corpo (ver ARQUETIPOS_RESPEITAM_FORMACAO em
    // CombatSystem.js) só miram a frente enquanto ela existir.
    ameacasEvitadas: [],
    perigoAtual: 0,
  };
  if (intencoes) {
    for (const [inimigo, dados] of intencoes) {
      if (!dados || !dados.plano || dados.plano.alvo !== jogador || !inimigo.vivo) continue;
      const faixa = dados.faixa || batalha.estimarDanoIntencao(inimigo, dados.plano);
      if (!faixa) continue;
      info.perigoAtual += faixa.esperado;
      if (destino === "retaguarda" && frenteViva && ["agressor", "fanatico", "aleatorio", "covarde"].includes(inimigo.arquetipo)) {
        info.ameacasEvitadas.push({ inimigo, faixa });
      }
    }
  }
  info.danoEvitadoEstimado = info.ameacasEvitadas.reduce((s, a) => s + a.faixa.esperado, 0)
    + (info.reducaoFisica ? Math.round((info.perigoAtual - info.ameacasEvitadas.reduce((s, a) => s + a.faixa.esperado, 0)) * info.reducaoFisica) : 0);
  previsao.reposicionamento = info;
}

function preverExecucao(previsao, alvo) {
  const faixa = previsao.dano;
  if (!faixa || faixa.imune || !alvo) return;
  const hp = alvo.hp;
  const pAcerto = previsao.chances ? previsao.chances.acerto : 1;
  if (faixa.min >= hp) {
    previsao.execucao = "garantida";
    previsao.chanceMatar = pAcerto;
    return;
  }
  const pCrit = previsao.chances ? previsao.chances.critico : 0;
  let p = 0;
  if (faixa.max >= hp) {
    // Aproximação uniforme dentro da faixa normal (a variância real é
    // uniforme em 0.85..1.15, então isso é fiel o bastante para um
    // indicador, e nunca é usado como resultado de nada).
    const largura = Math.max(1, faixa.max - faixa.min);
    p += (1 - pCrit) * Math.min(1, Math.max(0, (faixa.max - hp) / largura));
  }
  if (faixa.maxCritico >= hp) {
    const larguraC = Math.max(1, faixa.maxCritico - faixa.minCritico);
    p += pCrit * Math.min(1, Math.max(0, (faixa.maxCritico - hp) / larguraC));
  }
  previsao.chanceMatar = Math.min(1, p * pAcerto);
  if (previsao.chanceMatar > 0.02) previsao.execucao = "possivel";
}

// Itens 74-76: Aethra não tem "vantagem/desvantagem" de d20 como regra
// nomeada, mas TEM as duas coisas que a regra representa — modificadores que
// mexem na faixa de erro e efeitos que garantem crítico. Aqui traduzimos o
// estado real em ▲/▼ e listamos o MOTIVO de cada um (item 76), sem inventar
// nenhum modificador novo.
function preverVantagem(previsao, estado, { magico, elemento }) {
  const { jogador, alvo } = estado;
  const motivosBons = [];
  const motivosRuins = [];
  const ch = previsao.chances;

  if (ch && ch.criticoGarantido) motivosBons.push("alvo congelado — golpe físico estilhaça (crítico garantido)");
  if (alvo && alvo.chefe && alvo.atordoado) motivosBons.push("alvo atordoado (+35% de dano)");
  if (ch && ch.rerolagemSorteMiuda) motivosBons.push("Sorte Miúda do halfling ainda disponível (re-rola um 1)");
  if (ch && ch.rerolagemSorte) motivosBons.push("sorte ainda disponível (re-rola um ataque de 1 a 3)");
  if (jogador.racaId === "orc" && jogador.hp / jogador.hpMax <= (jogador.limiarFuria || 0.3)) motivosBons.push("fúria órquica: HP baixo aumenta seu dano");
  if (previsao.dano && jogador.elementoAfinidade && previsao.dano.elemento === jogador.elementoAfinidade) motivosBons.push("essência: golpe do seu elemento (+15%)");
  if (alvo && alvo.chefe && jogador.motivacaoId === "justica") motivosBons.push("justiça: +10% de dano contra chefes");
  if (previsao.dano && ["vantagem", "vantagem_intensa"].includes(previsao.dano.relacaoElemental)) motivosBons.push("vantagem elemental");
  if (previsao.reacao) motivosBons.push(`reação ${previsao.reacao.nome} pronta`);
  if (previsao.combo) motivosBons.push(`combo de equipe ${previsao.combo.nome}`);

  if (ch && ch.penalidadeD20 > 0) motivosRuins.push(`ofuscado (−${ch.penalidadeD20} na faixa de acerto)`);
  if (ch && ch.bloqueio > 0) motivosRuins.push(`alvo em guarda (${Math.round(ch.bloqueio * 100)}% de bloqueio)`);
  if (previsao.dano && ["resistencia", "resistencia_intensa"].includes(previsao.dano.relacaoElemental)) motivosRuins.push("resistência elemental");
  if (previsao.dano && previsao.dano.imune) motivosRuins.push("imunidade elemental — 0 de dano");
  if (!magico && alvo && !alvo.isPlayer && elemento) {
    // Nada a acrescentar: a matriz já foi lida acima. Mantido explícito para
    // deixar claro que a lista de motivos cobre só efeitos REAIS do motor.
  }

  const saldo = motivosBons.length - motivosRuins.length;
  previsao.vantagem = {
    nivel: saldo > 0 ? "vantagem" : saldo < 0 ? "desvantagem" : null,
    motivosBons,
    motivosRuins,
  };
}

// Itens 20/21: interrupção. Neste jogo, uma ação inimiga já telegrafada é
// cancelada quando o inimigo morre ANTES de executá-la, ou quando ele perde
// o turno por controle (Congelado) / atordoamento por quebra de postura.
// Então "este card interrompe" é uma afirmação verificável, não um adorno:
// só marcamos quando o card pode matar o inimigo que está telegrafando,
// congelá-lo, ou estourar a postura dele.
function preverInterrupcao(card, previsao, estado) {
  const { alvo, intencoes } = estado;
  if (!alvo || !intencoes || !intencoes.has(alvo)) return;
  const info = intencoes.get(alvo);
  if (!info || !info.plano) return;
  const planoPerigoso = ["atacar", "conjurar", "envenenar", "invocar", "roubar", "curar", "proteger"].includes(info.plano.tipo);
  if (!planoPerigoso) return;

  const vias = [];
  if (previsao.execucao === "garantida") vias.push("abate o inimigo antes do golpe");
  else if (previsao.chanceMatar > 0.35) vias.push(`pode abater antes do golpe (${Math.round(previsao.chanceMatar * 100)}%)`);
  if (previsao.status && /congelad/i.test(previsao.status.nome)) vias.push("congela o inimigo (perde o turno)");
  if (previsao.ruptura && previsao.ruptura.quebra) vias.push("quebra a postura (perde o turno)");

  if (!vias.length) return;
  previsao.interrompe = {
    inimigo: alvo,
    plano: info.plano,
    faixa: info.faixa || null,
    vias,
    garantida: previsao.execucao === "garantida" || (previsao.ruptura && previsao.ruptura.quebra) || !!(previsao.status && /congelad/i.test(previsao.status.nome)),
  };
}

// ---------------------------------------------------------------------
// 3. UTILITÁRIOS DE CONTEXTO
// ---------------------------------------------------------------------

// Combo de party disponível contra um alvo, independente de card (usado no
// painel de contexto e pelo destaque de "Lirael → Aric", item 10).
export function comboDePartyDisponivel(batalha, jogador, alvo) {
  const ult = batalha.ultimoAtaqueAliado;
  if (!ult || ult.alvo !== alvo || ult.atacante === jogador) return null;
  const combo = comboDoisElementos(ult.elemento, jogador.elemento || "fisico");
  if (!combo) return null;
  return { de: ult.atacante, para: jogador, combo, elementoAnterior: ult.elemento };
}

// Reação elemental disponível contra um alvo com um elemento hipotético —
// usado pelo painel de dicas do modo iniciante (item 48).
export function reacaoDisponivelContra(alvo, elemento, tipoFisico, dadosReacoes) {
  if (!FLAGS.reacoesElementais) return null;
  const estado = estadoElementalAtivo(alvo);
  if (!estado) return null;
  return buscarReacaoAplicavel(estado.estadoId, elemento, tipoFisico, dadosReacoes) || null;
}
