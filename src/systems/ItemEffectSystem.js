// EFEITOS DE ITEM LENDÁRIO — motor PURO, sem DOM e sem conhecer a Batalha.
//
// POR QUE ISTO EXISTE
// -------------------
// O jogo tinha 18 lendários, e lendário era só NÚMERO MAIOR. A "Espada do
// Senhor Sombrio" (dano 35) e a "Espada Enferrujada" (dano 6) são o mesmo
// item com valores diferentes: mesma conta, mesma decisão, mesma jogada.
// Achar um lendário não mudava COMO se luta, só quanto o número subia.
//
// O motor já tinha tudo de que um efeito interessante precisa e nada usava:
// relação elemental (fraqueza/resistência/imunidade), estados e reações
// elementais, barra de postura de chefe. Os efeitos abaixo são ganchos
// nesses sistemas — nenhum inventa uma regra paralela.
//
// COMO SE LIGA
// ------------
// Cada efeito declara em QUE MOMENTO ele age. O CombatSystem chama três
// funções, e só três:
//
//   modificadoresDeAtaque(atacante, alvo)   antes de calcular o dano
//   aoCausarDano(atacante, alvo, dano, ctx) depois de aplicar
//   efeitosDoCombatente(c)                  para a UI listar
//
// Nada aqui aplica dano nem escreve no log: devolve o que deveria acontecer
// e quem chama decide. É o que mantém o módulo testável sem navegador.

// O catálogo. `id` é o que vai no campo `efeitos: []` do item no items.json.
export const EFEITOS = {
  perfurar_elemento: {
    nome: "Perfurar Elemento", icone: "🗡️",
    descricao: "Ignora resistência e imunidade elemental do alvo.",
    // Lido em modificadoresDeAtaque: força a relação para neutra quando ela
    // seria ruim. Não transforma em vantagem — só impede o alvo de anular.
    quando: "ataque",
  },
  duplo_elemento: {
    nome: "Golpe de Dois Elementos", icone: "🔥❄️",
    descricao: "Ataca com dois elementos e usa a melhor relação dos dois.",
    quando: "ataque",
  },
  ceifador: {
    nome: "Ceifador", icone: "💀",
    descricao: "Quanto menos vida o alvo tem, mais dano este golpe causa (até +60%).",
    quando: "ataque",
  },
  roubo_de_vida: {
    nome: "Roubo de Vida", icone: "🩸",
    descricao: "Converte parte do dano causado em cura para quem atacou.",
    quando: "dano",
  },
  quebra_postura: {
    nome: "Quebra-Postura", icone: "💥",
    descricao: "Enche a barra de quebra de chefes muito mais rápido.",
    quando: "dano",
  },
  eco: {
    nome: "Eco", icone: "🌀",
    descricao: "Chance de o golpe se repetir de graça, com dano reduzido.",
    quando: "dano",
  },
  ressonancia: {
    nome: "Ressonância", icone: "✨",
    descricao: "Aplica o estado elemental da arma a cada acerto, preparando reações.",
    quando: "dano",
  },
  algoz_de_chefes: {
    nome: "Algoz", icone: "👑",
    descricao: "Causa dano extra contra chefes.",
    quando: "ataque",
  },
  primeiro_sangue: {
    nome: "Primeiro Sangue", icone: "⚡",
    descricao: "O primeiro golpe da batalha causa dano muito maior.",
    quando: "ataque",
  },

  // --- efeitos ligados às REAÇÕES ELEMENTAIS -------------------------------
  // O jogo tem 8 reações prontas (elementalReactions.json) que ficavam
  // inertes porque nada aplicava estado. Estes três efeitos giram em torno
  // delas — é a diferença entre "meu item bate mais" e "meu item muda a
  // ordem em que eu ataco".
  condutor: {
    nome: "Condutor", icone: "🔗",
    descricao: "Todo golpe marca o alvo com o estado do seu elemento, preparando reações.",
    quando: "dano",
  },
  catalisador: {
    nome: "Catalisador", icone: "⚗️",
    descricao: "Reações elementais que você dispara causam metade a mais de dano.",
    quando: "ataque",
  },
  estilhacador: {
    nome: "Estilhaçador", icone: "❄️💥",
    descricao: "Golpes contra alvos com estado elemental ativo têm crítico garantido.",
    quando: "ataque",
  },
};

// Números de cada efeito, num lugar só — é aqui que se ajusta o
// balanceamento sem caçar constante espalhada pelo combate.
export const FORCA = {
  ceifadorMax: 0.6, // +60% quando o alvo está quase morto
  rouboDeVida: 0.18, // 18% do dano vira cura
  quebraPostura: 2.5, // multiplicador do ganho de postura
  ecoChance: 0.25,
  ecoDano: 0.5,
  algoz: 0.3, // +30% contra chefe
  primeiroSangue: 0.75, // +75% no primeiro golpe
  catalisador: 0.5,     // reações causam +50%
};

// Todos os efeitos que um combatente carrega, vindos do equipamento.
// Devolve uma lista de `{ id, def, item }` — o item vai junto porque alguns
// efeitos precisam de dados dele (o segundo elemento, por exemplo).
export function efeitosDoCombatente(c) {
  if (!c || !c.equipamento) return [];
  const saida = [];
  Object.values(c.equipamento).forEach((item) => {
    if (!item || !Array.isArray(item.efeitos)) return;
    item.efeitos.forEach((id) => {
      const def = EFEITOS[id];
      if (def) saida.push({ id, def, item });
    });
  });
  return saida;
}

export function temEfeito(c, id) {
  return efeitosDoCombatente(c).some((e) => e.id === id);
}

// O que muda ANTES de calcular o dano.
//
// Devolve sempre a mesma forma, com valores neutros quando não há efeito —
// assim quem chama nunca precisa testar null.
export function modificadoresDeAtaque(atacante, alvo, contexto = {}) {
  const efeitos = efeitosDoCombatente(atacante);
  const r = {
    multiplicador: 1,
    ignoraRelacaoRuim: false,
    elementoSecundario: null,
    garanteCritico: false,
    bonusReacao: 0,
    aplicados: [],
  };
  if (!efeitos.length) return r;

  for (const e of efeitos) {
    switch (e.id) {
      case "perfurar_elemento":
        r.ignoraRelacaoRuim = true;
        r.aplicados.push(e);
        break;

      case "duplo_elemento":
        // O segundo elemento vem do próprio item; sem ele o efeito é inerte
        // em vez de inventar um elemento por conta própria.
        if (e.item.elementoSecundario) {
          r.elementoSecundario = e.item.elementoSecundario;
          r.aplicados.push(e);
        }
        break;

      case "ceifador": {
        if (!alvo || !alvo.hpMax) break;
        const faltando = 1 - (alvo.hp / alvo.hpMax);
        const bonus = FORCA.ceifadorMax * faltando;
        // `mult` acompanha cada aplicado para o combate poder SELAR o número
        // com a contribuição exata deste efeito (ver `selos` em
        // CombatSystem.rolarAtaque). Sem ele, os nove efeitos lendários
        // continuariam invisíveis dentro de um total só.
        if (bonus > 0.001) { r.multiplicador *= 1 + bonus; r.aplicados.push({ ...e, mult: 1 + bonus }); }
        break;
      }

      case "algoz_de_chefes":
        if (alvo && alvo.chefe) { r.multiplicador *= 1 + FORCA.algoz; r.aplicados.push({ ...e, mult: 1 + FORCA.algoz }); }
        break;

      case "estilhacador":
        // Crítico garantido contra quem já está marcado. É o "Estilhaçar" do
        // jogo virado em propriedade permanente de uma arma.
        // O estado é gravado como `{ tipo: "estado_elemental", estadoId }`
        // (ver ElementalReactionSystem.aplicarEstadoElemental). Na primeira
        // versão eu procurei por `s.tipoEstado`, campo que não existe — o
        // efeito nunca dispararia.
        if (alvo && Array.isArray(alvo.statusEffects)
            && alvo.statusEffects.some((s) => s && s.tipo === "estado_elemental")) {
          r.garanteCritico = true; r.aplicados.push(e);
        }
        break;

      case "catalisador":
        r.bonusReacao = (r.bonusReacao || 0) + FORCA.catalisador;
        r.aplicados.push(e);
        break;

      case "primeiro_sangue":
        // `primeiroGolpe` é decidido por quem chama (a Batalha sabe se algum
        // golpe já saiu). O efeito não guarda estado próprio.
        if (contexto.primeiroGolpe) { r.multiplicador *= 1 + FORCA.primeiroSangue; r.aplicados.push({ ...e, mult: 1 + FORCA.primeiroSangue }); }
        break;

      default:
        break;
    }
  }
  return r;
}

// Dado o par de elementos de um golpe duplo, qual relação usar.
//
// Regra: fica com a MELHOR das duas. É o que faz o efeito valer — uma arma
// de fogo+gelo nunca é anulada por um alvo que resiste a um dos dois.
export const ORDEM_RELACAO = [
  "imune", "resistencia_intensa", "resistencia", "neutro", "vantagem", "vantagem_intensa",
];

export function melhorRelacao(a, b) {
  const ia = ORDEM_RELACAO.indexOf(a);
  const ib = ORDEM_RELACAO.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia >= ib ? a : b;
}

// "Perfurar elemento": relação ruim vira neutra; vantagem é preservada.
export function relacaoPerfurada(relacao) {
  if (relacao === "imune" || relacao === "resistencia" || relacao === "resistencia_intensa") return "neutro";
  return relacao;
}

// O que acontece DEPOIS de o dano ser aplicado.
//
// Devolve uma lista de consequências para quem chama executar. Não executa
// nada aqui de propósito: cura, repetição de golpe e ganho de postura são
// operações da Batalha, e concentrá-las lá evita dois caminhos de dano.
export function aoCausarDano(atacante, alvo, dano, contexto = {}) {
  const efeitos = efeitosDoCombatente(atacante);
  const saida = [];
  if (!efeitos.length || dano <= 0) return saida;

  for (const e of efeitos) {
    switch (e.id) {
      case "roubo_de_vida": {
        const cura = Math.max(1, Math.round(dano * FORCA.rouboDeVida));
        saida.push({ tipo: "curar_atacante", valor: cura, efeito: e });
        break;
      }
      case "quebra_postura":
        if (alvo && alvo.chefe) saida.push({ tipo: "postura_extra", mult: FORCA.quebraPostura, efeito: e });
        break;
      case "eco":
        // A chance é sorteada aqui, mas quem repete o golpe é a Batalha —
        // e ela marca `semEco` na repetição, senão o eco ecoaria sozinho
        // para sempre.
        if (!contexto.semEco && Math.random() < FORCA.ecoChance) {
          saida.push({ tipo: "repetir_golpe", mult: FORCA.ecoDano, efeito: e });
        }
        break;
      case "ressonancia":
      case "condutor":
        // Os dois marcam o alvo; "condutor" existe como nome próprio para
        // armas que NÃO são lendárias mas foram forjadas para reagir.
        if (e.item.elemento) saida.push({ tipo: "aplicar_estado", elemento: e.item.elemento, efeito: e });
        break;
      default:
        break;
    }
  }
  return saida;
}

// Texto curto para a tela do item. Uma linha por efeito.
export function descreverEfeitos(item) {
  if (!item || !Array.isArray(item.efeitos)) return [];
  return item.efeitos
    .map((id) => EFEITOS[id])
    .filter(Boolean)
    .map((def) => `${def.icone} ${def.nome} — ${def.descricao}`);
}
