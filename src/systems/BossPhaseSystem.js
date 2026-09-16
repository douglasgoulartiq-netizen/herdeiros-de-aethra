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
// `efeito` é lido pelo CombatSystem; aqui é só a declaração.
export const HABILIDADE_DE_CHEFE = {
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

export function habilidadeDoChefe(c) {
  if (!ehChefe(c)) return null;
  return HABILIDADE_DE_CHEFE[c.arquetipo] || HABILIDADE_DE_CHEFE.aleatorio;
}

// O chefe pode usar a assinatura neste turno?
export function podeUsarHabilidade(c) {
  if (!ehChefe(c) || !c.vivo || c.atordoado) return false;
  garantirBase(c);
  return c.faseAtual >= 2 && (c.recargaHabilidade || 0) <= 0 && !!habilidadeDoChefe(c);
}

export function marcarHabilidadeUsada(c) {
  const hab = habilidadeDoChefe(c);
  c.recargaHabilidade = hab ? hab.recarga : 3;
}

export function passarTurnoDoChefe(c) {
  if (!ehChefe(c)) return;
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
