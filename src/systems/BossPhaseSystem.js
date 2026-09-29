// FASES DE CHEFE — motor PURO, sem DOM e sem conhecer a Batalha.
//
// POR QUE ISTO EXISTE
// -------------------
// Comparei os campos de um chefe e de um monstro comum no monsters.json.
// São EXATAMENTE os mesmos: hp, atk, defesa, vel, elemento, xp. A única
// diferença é a flag `chefe: true`, que liga a barra de postura. Ou seja:
// um chefe era um slime grande.
//
// E medido (scripts/medir-dificuldade.mjs): um herói sozinho derruba o
// chefe da própria faixa em 3,4 a 6 golpes. Com um time de quatro, isso é
// uma rodada. O jogador nunca via o chefe fazer nada.
//
// Inflar o HP não conserta isso — só faz a mesma luta durar mais. O que
// falta a uma luta de chefe é ela MUDAR enquanto acontece. Três coisas:
//
//   1. FASES — em 66% e 33% de HP o chefe muda de comportamento. O jogador
//      percebe que a luta virou, e a jogada que funcionava para de bastar.
//   2. HABILIDADE PRÓPRIA — cada arquétipo ganha um golpe assinado, que só
//      aparece a partir da fase 2. É o que dá cara ao chefe.
//   3. ENFURECER — cada quebra de postura seguinte fica mais cara. Sem isso
//      dá para acorrentar atordoamento e o chefe nunca joga.
//
// Tudo aqui é função pura sobre o objeto do combatente. Quem aplica é o
// CombatSystem; este módulo só decide O QUE deveria acontecer.

// Os cortes de fase, em fração de HP. Ordem: da fase mais avançada para a
// mais branda, para `faseDoChefe` poder devolver a primeira que casar.
export const CORTES_DE_FASE = [
  { fase: 3, ate: 0.33, nome: "Desespero" },
  { fase: 2, ate: 0.66, nome: "Fúria" },
  { fase: 1, ate: Infinity, nome: "Domínio" },
];

// O que cada fase entrega. Multiplicadores sobre o valor BASE do chefe —
// nunca acumulados sobre o valor já modificado, senão duas passagens pela
// mesma fase dobrariam o efeito.
export const EFEITOS_DE_FASE = {
  1: { dano: 1, velocidade: 1, defesa: 1 },
  2: { dano: 1.25, velocidade: 1.1, defesa: 1 },
  // A fase 3 troca defesa por agressão: o chefe fica mais perigoso E mais
  // fácil de ferir. É de propósito — a corrida final tem que ser tensa dos
  // dois lados, não um muro que só demora mais.
  3: { dano: 1.5, velocidade: 1.3, defesa: 0.85 },
};

// Quanto a postura máxima cresce a cada quebra. A primeira quebra é a
// prometida; da segunda em diante o chefe "aprende". Sem isto, acertar a
// fraqueza elemental em sequência prende o chefe atordoado para sempre — o
// sistema de postura vira um botão de vitória em vez de uma recompensa.
export const CRESCIMENTO_POSTURA_POR_QUEBRA = 1.6;
// E ele fica com raiva: dano permanente a mais depois da segunda quebra.
export const DANO_ENFURECIDO = 1.35;
export const QUEBRAS_PARA_ENFURECER = 2;

// A habilidade assinada de cada arquétipo. Só entra a partir da fase 2, e
// tem recarga própria — não é para virar o ataque padrão.
//
// COBERTURA. A primeira versão desta tabela tinha cinco arquétipos: bruto,
// atirador, ladrao, invocador e defensor. Os chefes do jogo usam DOZE
// (comandante, defensor, conjurador, controlador, fanatico, agressor,
// atirador, invocador, ladrao, suporte, cacador, covarde), e "bruto" não é
// um deles. Contado: 32 dos 49 chefes — 65%, incluindo o Dragão Jovem —
// caíam no genérico "Fúria Cega". Dois terços do bestiário de chefe
// dividiam o mesmo golpe.
//
// Agora os doze estão cobertos, cada um com uma assinatura que diz o que
// aquele arquétipo É: o comandante convoca, o conjurador amaldiçoa, o
// covarde se esconde. `aleatorio` continua existindo como rede, mas deixou
// de ser o caminho da maioria.
//
// `efeito` é lido pelo CombatSystem; aqui é só a declaração.
export const HABILIDADE_DE_CHEFE = {
  // --- os cinco originais, preservados ---
  bruto: {
    nome: "Investida Devastadora", icone: "💢",
    descricao: "Um golpe pesado que ignora metade da defesa.",
    efeito: { tipo: "perfurante", mult: 1.6, ignoraDefesa: 0.5 }, recarga: 3,
  },
  atirador: {
    nome: "Saraivada", icone: "🏹",
    descricao: "Atinge o time inteiro com dano reduzido.",
    efeito: { tipo: "area", mult: 0.7 }, recarga: 4,
  },
  ladrao: {
    nome: "Golpe Sombrio", icone: "🗡️",
    descricao: "Ataca o membro mais ferido do time.",
    efeito: { tipo: "executor", mult: 1.4, alvo: "mais_ferido" }, recarga: 3,
  },
  invocador: {
    nome: "Chamado das Sombras", icone: "🌑",
    descricao: "Recupera parte da própria vida.",
    efeito: { tipo: "cura", mult: 0.12 }, recarga: 5,
  },
  defensor: {
    nome: "Muralha Viva", icone: "🛡️",
    descricao: "Ergue a guarda e reduz o dano recebido no próximo turno.",
    efeito: { tipo: "guarda", reducao: 0.5 }, recarga: 4,
  },

  // --- os oito que faltavam ---
  comandante: {
    nome: "Ordem de Ataque", icone: "📯",
    descricao: "Prepara um golpe anunciado que cai no turno seguinte.",
    // Carregar é o efeito que mais gera DECISÃO: o jogador vê o golpe vindo
    // e tem um turno para se proteger, curar ou tentar matar antes.
    efeito: { tipo: "carregar", mult: 2.1, aviso: "ergue a lâmina e chama a formação" }, recarga: 4,
  },
  conjurador: {
    nome: "Maldição Arcana", icone: "🔮",
    descricao: "Enfraquece a defesa de todo o time por alguns turnos.",
    efeito: { tipo: "maldicao", estado: "furia_debuff", valor: 0.25, duracao: 3 }, recarga: 4,
  },
  controlador: {
    nome: "Correntes de Lodo", icone: "🕸️",
    descricao: "Retarda o time inteiro.",
    efeito: { tipo: "maldicao", estado: "debuff_velocidade", valor: 0.3, duracao: 3 }, recarga: 4,
  },
  fanatico: {
    nome: "Oferenda de Sangue", icone: "🩸",
    descricao: "Fere o próprio corpo para desferir um golpe muito mais forte.",
    efeito: { tipo: "sacrificio", mult: 2.2, custoHp: 0.08 }, recarga: 4,
  },
  agressor: {
    nome: "Golpe Duplo", icone: "⚔️",
    descricao: "Dois ataques seguidos, em alvos possivelmente diferentes.",
    efeito: { tipo: "duplo", mult: 0.85, vezes: 2 }, recarga: 3,
  },
  suporte: {
    nome: "Elo Vital", icone: "💚",
    descricao: "Drena vida de um herói para si.",
    efeito: { tipo: "drenar", mult: 1.1, roubo: 0.6 }, recarga: 3,
  },
  cacador: {
    nome: "Marca do Caçador", icone: "🎯",
    descricao: "Marca uma presa: o próximo golpe nela é muito mais forte.",
    efeito: { tipo: "carregar", mult: 1.9, aviso: "escolhe uma presa e a encara", fixarAlvo: true }, recarga: 4,
  },
  covarde: {
    nome: "Recuo Traiçoeiro", icone: "🌫️",
    descricao: "Some na névoa: ergue a guarda e recupera um pouco de vida.",
    efeito: { tipo: "guarda", reducao: 0.45, curaJunto: 0.06 }, recarga: 4,
  },

  aleatorio: {
    nome: "Fúria Cega", icone: "💥",
    descricao: "Um ataque mais forte, sem mirar.",
    efeito: { tipo: "perfurante", mult: 1.35 }, recarga: 3,
  },
};

export function ehChefe(c) {
  return !!(c && c.chefe && c.hpMax > 0);
}

// Em que fase o chefe está AGORA, pela fração de HP.
export function faseDoChefe(c) {
  if (!ehChefe(c)) return 1;
  const fracao = c.hp / c.hpMax;
  return CORTES_DE_FASE.find((f) => fracao <= f.ate).fase;
}

export function nomeDaFase(fase) {
  const f = CORTES_DE_FASE.find((x) => x.fase === fase);
  return f ? f.nome : "Domínio";
}

// Guarda os valores BASE na primeira vez. Todo cálculo de fase parte daqui,
// nunca do valor já modificado — é isso que impede o efeito de compor
// sozinho quando a função é chamada duas vezes no mesmo turno.
export function garantirBase(c) {
  if (!c || c.__base) return c;
  c.__base = {
    dano: c.ataque ? c.ataque.dano : 0,
    velocidade: c.velocidade,
    defesa: c.defesa,
    posturaMax: c.posturaMax,
  };
  c.faseAtual = 1;
  c.quebras = 0;
  c.enfurecido = false;
  c.recargaHabilidade = 0;
  return c;
}

// Aplica os números da fase ao combatente. Idempotente: chamar de novo com a
// mesma fase deixa tudo igual.
export function aplicarFase(c, fase) {
  if (!ehChefe(c)) return null;
  garantirBase(c);
  const e = EFEITOS_DE_FASE[fase] || EFEITOS_DE_FASE[1];
  const multEnfurecido = c.enfurecido ? DANO_ENFURECIDO : 1;
  if (c.ataque) c.ataque.dano = Math.max(1, Math.round(c.__base.dano * e.dano * multEnfurecido));
  c.atributos.FOR = c.ataque ? c.ataque.dano : c.atributos.FOR;
  c.velocidade = Math.max(1, Math.round(c.__base.velocidade * e.velocidade));
  c.defesa = Math.max(0, Math.round(c.__base.defesa * e.defesa));
  c.faseAtual = fase;
  return e;
}

// Chamado depois de o chefe levar dano. Devolve `null` quando nada mudou, ou
// a descrição da virada — quem chama decide como anunciar.
export function checarViradaDeFase(c) {
  if (!ehChefe(c) || !c.vivo) return null;
  garantirBase(c);
  const nova = faseDoChefe(c);
  if (nova <= c.faseAtual) return null; // fase só avança
  aplicarFase(c, nova);
  const hab = habilidadeDoChefe(c);
  return {
    fase: nova,
    nome: nomeDaFase(nova),
    // A fase 2 é quando a habilidade assinada entra em cena.
    liberaHabilidade: nova >= 2 && !!hab,
    habilidade: hab,
    texto: nova === 2
      ? `⚔️ ${c.nome} entra em FÚRIA — os golpes ficam mais pesados.`
      : `🔥 ${c.nome} está em DESESPERO — mais rápido e mais letal, mas a guarda cede.`,
  };
}

// ---------------------------------------------------------------------------
// REPERTÓRIO DO CHEFE
//
// Um chefe pode declarar as PRÓPRIAS habilidades em monsters.json, no campo
// `habilidades`. É o que separa o Dragão Jovem do Tirano do Charco: sem isso,
// os dois são "um comandante" e lutam igual.
//
// Cada habilidade declarada aceita:
//   id         obrigatório — a chave da recarga própria
//   fase       a partir de que fase ela entra (padrão 2)
//   recarga    turnos de espera DELE depois de usar (padrão 3)
//   efeito     o que ela faz (ver usarHabilidadeDeChefe no CombatSystem)
//
// Sem `habilidades` declaradas, o chefe usa a assinatura do arquétipo — que
// agora existe para os doze arquétipos do jogo. Ou seja: todo chefe tem cara,
// e quem quiser dar uma cara ainda mais própria escreve no dado.
// ---------------------------------------------------------------------------

// Fase mínima padrão: a assinatura entra quando a luta já virou uma vez.
export const FASE_PADRAO_DA_HABILIDADE = 2;

function comId(hab, idPadrao) {
  if (!hab) return null;
  return hab.id ? hab : { ...hab, id: idPadrao };
}

// Todo o repertório do chefe, em ordem de declaração.
export function habilidadesDoChefe(c) {
  if (!ehChefe(c)) return [];
  const declaradas = Array.isArray(c.habilidadesChefe) ? c.habilidadesChefe.filter(Boolean) : [];
  if (declaradas.length) return declaradas.map((h, i) => comId(h, `decl_${i}`));
  const doArquetipo = HABILIDADE_DE_CHEFE[c.arquetipo] || HABILIDADE_DE_CHEFE.aleatorio;
  return [comId(doArquetipo, c.arquetipo || "aleatorio")];
}

// A assinatura — a que representa o chefe na interface (telegrafo, revelações,
// ficha do bestiário). É a primeira do repertório, então um chefe sem
// declaração devolve exatamente o que devolvia antes desta mudança.
export function habilidadeDoChefe(c) {
  return habilidadesDoChefe(c)[0] || null;
}

function recargaDe(c, hab) {
  if (!c.recargasChefe) c.recargasChefe = {};
  return c.recargasChefe[hab.id] || 0;
}

// A habilidade que o chefe usaria AGORA, ou null. Entre as prontas, escolhe a
// de recarga mais longa: a mais rara é a mais especial, e é ela que o jogador
// deve ver quando as duas estão disponíveis no mesmo turno.
export function habilidadeDisponivel(c) {
  if (!ehChefe(c) || !c.vivo || c.atordoado) return null;
  garantirBase(c);
  const prontas = habilidadesDoChefe(c).filter((h) => {
    const faseMin = h.fase ?? FASE_PADRAO_DA_HABILIDADE;
    return c.faseAtual >= faseMin && recargaDe(c, h) <= 0;
  });
  if (!prontas.length) return null;
  return prontas.slice().sort((a, b) => (b.recarga || 3) - (a.recarga || 3))[0];
}

export function podeUsarHabilidade(c) {
  return !!habilidadeDisponivel(c);
}

export function marcarHabilidadeUsada(c, hab) {
  const usada = hab || habilidadeDoChefe(c);
  if (!usada) return;
  if (!c.recargasChefe) c.recargasChefe = {};
  c.recargasChefe[usada.id] = usada.recarga || 3;
  // Espelho do campo antigo: a interface e os testes anteriores liam
  // `recargaHabilidade`, e continuam lendo um número coerente.
  c.recargaHabilidade = c.recargasChefe[usada.id];
}

export function passarTurnoDoChefe(c) {
  if (!ehChefe(c)) return;
  if (!c.recargasChefe) c.recargasChefe = {};
  for (const k of Object.keys(c.recargasChefe)) {
    if (c.recargasChefe[k] > 0) c.recargasChefe[k] -= 1;
  }
  if (c.recargaHabilidade > 0) c.recargaHabilidade -= 1;
}

// Registra uma quebra de postura e devolve o que mudou. É aqui que o chefe
// "aprende": a próxima barra é maior, e na segunda ele enfurece.
export function registrarQuebra(c) {
  if (!ehChefe(c)) return null;
  garantirBase(c);
  c.quebras = (c.quebras || 0) + 1;
  const novoMax = Math.round((c.__base.posturaMax || 100)
    * Math.pow(CRESCIMENTO_POSTURA_POR_QUEBRA, c.quebras));
  c.posturaMax = novoMax;
  c.postura = 0;
  const enfurecouAgora = !c.enfurecido && c.quebras >= QUEBRAS_PARA_ENFURECER;
  if (enfurecouAgora) {
    c.enfurecido = true;
    aplicarFase(c, c.faseAtual); // reaplica com o multiplicador de fúria
  }
  return {
    quebras: c.quebras,
    novaPosturaMax: novoMax,
    enfureceu: enfurecouAgora,
    texto: enfurecouAgora
      ? `😤 ${c.nome} ENFURECE! Quebrar a postura dele fica mais difícil, e os golpes doem mais.`
      : `A postura de ${c.nome} vai custar mais caro da próxima vez.`,
  };
}
