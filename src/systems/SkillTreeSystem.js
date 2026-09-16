// ÁRVORE DE HABILIDADES — motor PURO, sem DOM.
//
// O QUE HAVIA ANTES
// -----------------
// 8 nós por classe, 2 ramos, um par por tier, uma escolha a cada 3 níveis.
// Como o jogador escolhia UM dos dois em cada tier e só existiam 4 tiers, no
// nível 12 todo guerreiro já tinha tomado todas as decisões que a classe
// oferecia. Dois guerreiros de nível 15 eram, na prática, o mesmo guerreiro.
//
// O QUE EXISTE AGORA
// ------------------
// 3 ramos × 6 nós = 18 nós por classe, comprados com PONTOS. O ponto é a
// escassez: você ganha 1 por nível e a árvore inteira custa 30, então mesmo
// no nível 20 (19 pontos) você compra pouco mais de dois terços dela. Não
// existe build "completa" — existe build ESCOLHIDA.
//
// As três travas, e por que cada uma existe:
//
//  1. NÍVEL (`nivelRequerido`) — ritmo. Impede pegar o nó final no nível 4.
//  2. PONTOS NO RAMO (`requerRamo`) — profundidade. Para chegar ao fim de um
//     ramo você precisa ter investido NELE, não em três ramos pela metade.
//     É o que impede o "pega só as pontas boas de todos".
//  3. REQUISITO DE ATRIBUTO (`requisito`) — identidade. Aqui está a parte
//     interessante: os atributos deste jogo crescem sozinhos e de forma fixa
//     por classe (ver aplicarCrescimento), então exigir FOR de um guerreiro
//     seria só um nível disfarçado. Por isso os requisitos de atributo caem
//     sobre o atributo que a classe NÃO tem — o ramo híbrido de cada classe
//     pede o atributo estrangeiro. Um guerreiro nasce e morre com INT 1;
//     para abrir o ramo Comando ele precisa comprar o nó de +INT da própria
//     árvore e/ou usar equipamento com bônus. Isso transforma o requisito
//     numa DECISÃO (gastei 1 ponto e um slot de amuleto para abrir isso) em
//     vez de numa espera.
//
// Reset: devolve todos os pontos por ouro (ver CUSTO_RESET_BASE). O usuário
// pediu escolha definitiva, não escolha irreversível — o preço é o que faz a
// escolha pesar, não a impossibilidade.

import { calcularHpMax, calcularMpMax, atributosEfetivos } from "./CharacterFactory.js";

// 1 ponto por nível a partir do 2. Nível 20 = 19 pontos; a árvore custa 30.
export const PONTOS_POR_NIVEL = 1;
export const NIVEL_PRIMEIRO_PONTO = 2;

// Reset custa ouro e escala com o nível — respecar um personagem alto é uma
// decisão econômica, não um botão grátis de "testar tudo".
export const CUSTO_RESET_BASE = 120;
export const CUSTO_RESET_POR_NIVEL = 45;

export const RAMO_ICONE = { 0: "⚔️", 1: "🛡️", 2: "✨" };

// --- Estado -------------------------------------------------------------

// Backfill defensivo (mesmo padrão de garantirEstadoCaminho/garantirCompendio):
// cria o estado a partir do nada para qualquer personagem — novo ou de um
// save anterior a esta versão — sem migração formal. Um save antigo tinha
// `arvore: { escolhas: [...] }` com ids da árvore velha; esses ids não
// existem mais na nova, então `escolhas` é preservado (nunca apagamos dado do
// jogador) mas ids órfãos simplesmente não somam nada — e `pontosGastos`
// conta só o que a árvore atual reconhece, então o jogador recebe os pontos
// de volta em vez de ficar devendo.
export function garantirEstadoArvore(personagem) {
  if (!personagem) return null;
  if (!personagem.arvore) personagem.arvore = {};
  const a = personagem.arvore;
  if (!Array.isArray(a.escolhas)) a.escolhas = [];
  if (!Array.isArray(a.passivas)) a.passivas = [];
  if (!Array.isArray(a.marcas)) a.marcas = [];
  return a;
}

export function arvoreDaClasse(personagem, dados) {
  const t = (dados && dados.skillTrees) || {};
  const bruto = t[personagem && personagem.classeId];
  if (!bruto) return [];
  // Aceita as duas formas: array puro (formato antigo) e { ramos, nos }
  // (formato novo, que carrega o nome de cada ramo junto).
  return Array.isArray(bruto) ? bruto : bruto.nos || [];
}

export function ramosDaClasse(personagem, dados) {
  const t = (dados && dados.skillTrees) || {};
  const bruto = t[personagem && personagem.classeId];
  if (bruto && !Array.isArray(bruto) && Array.isArray(bruto.ramos)) return bruto.ramos;
  // Formato antigo: deriva os ramos dos próprios nós.
  const nos = arvoreDaClasse(personagem, dados);
  return [...new Set(nos.map((n) => n.ramo))].map((id, i) => ({ id, nome: id, icone: RAMO_ICONE[i] || "◆" }));
}

// --- Pontos --------------------------------------------------------------

export function pontosTotais(personagem) {
  if (!personagem) return 0;
  return Math.max(0, (personagem.nivel || 1) - (NIVEL_PRIMEIRO_PONTO - 1)) * PONTOS_POR_NIVEL;
}

export function custoDoNo(no) {
  return (no && no.custo) || 1;
}

// Só conta ids que a árvore ATUAL conhece — ver comentário de
// garantirEstadoArvore sobre saves antigos.
export function pontosGastos(personagem, dados) {
  const arvore = arvoreDaClasse(personagem, dados);
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  return escolhas.reduce((soma, id) => {
    const no = arvore.find((n) => n.id === id);
    return soma + (no ? custoDoNo(no) : 0);
  }, 0);
}

export function pontosDisponiveis(personagem, dados) {
  return pontosTotais(personagem) - pontosGastos(personagem, dados);
}

export function pontosNoRamo(personagem, dados, ramo) {
  const arvore = arvoreDaClasse(personagem, dados);
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  return escolhas.reduce((soma, id) => {
    const no = arvore.find((n) => n.id === id);
    return soma + (no && no.ramo === ramo ? custoDoNo(no) : 0);
  }, 0);
}

// --- Travas ---------------------------------------------------------------

// O requisito é conferido contra os atributos EFETIVOS — a mesma conta que o
// combate usa (base + equipamento + árvore + afinidade + vínculo + conjunto),
// não os atributos crus. Duas consequências que são o ponto do desenho:
//   • comprar "Disciplina (+6 INT)" abre NA HORA o nó que pede INT 10;
//   • um amuleto de +4 INT pode abrir o nó final do ramo híbrido — e tirar o
//     amuleto o fecharia de novo, se ele já não estivesse comprado.
export function faltaDeAtributo(personagem, dados, no) {
  if (!no || !no.requisito) return null;
  const attrs = atributosEfetivos(personagem, dados);
  const faltas = Object.entries(no.requisito)
    .map(([k, min]) => ({ atributo: k, minimo: min, atual: attrs[k] || 0, falta: Math.max(0, min - (attrs[k] || 0)) }))
    .filter((f) => f.falta > 0);
  return faltas.length ? faltas : null;
}

// Todos os motivos pelos quais um nó não pode ser comprado agora. Devolver a
// LISTA inteira (em vez do primeiro motivo) é o que permite à tela dizer
// "faltam 2 níveis E 4 de INT" numa linha só, em vez de o jogador descobrir
// os obstáculos um de cada vez.
export function motivosBloqueio(personagem, dados, no) {
  const motivos = [];
  const escolhas = (personagem.arvore && personagem.arvore.escolhas) || [];
  if (escolhas.includes(no.id)) return ["já desbloqueado"];
  if ((personagem.nivel || 1) < (no.nivelRequerido || 1)) {
    motivos.push(`nível ${no.nivelRequerido}`);
  }
  const noRamo = pontosNoRamo(personagem, dados, no.ramo);
  if (noRamo < (no.requerRamo || 0)) {
    motivos.push(`${no.requerRamo} pontos neste ramo (você tem ${noRamo})`);
  }
  const faltas = faltaDeAtributo(personagem, dados, no);
  if (faltas) {
    motivos.push(faltas.map((f) => `${f.atributo} ${f.minimo} (você tem ${f.atual})`).join(" e "));
  }
  const custo = custoDoNo(no);
  if (pontosDisponiveis(personagem, dados) < custo) {
    motivos.push(`${custo} ${custo === 1 ? "ponto" : "pontos"}`);
  }
  return motivos;
}

export function podeEscolher(personagem, dados, no) {
  return motivosBloqueio(personagem, dados, no).length === 0;
}

// Estado de cada nó, de uma vez só — a tela desenha a árvore inteira a
// partir disto sem repetir nenhuma das regras acima.
export function avaliarArvore(personagem, dados) {
  garantirEstadoArvore(personagem);
  const arvore = arvoreDaClasse(personagem, dados);
  const escolhas = new Set(personagem.arvore.escolhas);
  return arvore.map((no) => {
    if (escolhas.has(no.id)) return { no, estado: "escolhido", motivos: [] };
    const motivos = motivosBloqueio(personagem, dados, no);
    return { no, estado: motivos.length ? "bloqueado" : "disponivel", motivos };
  });
}

// --- Compra ---------------------------------------------------------------

// Aplica o que o nó concede. Cada `tipoConcedido` tem um destino único, e é
// SEMPRE o mesmo destino de onde o resto do jogo já lê:
//   ativa    → personagem.habilidades      (mão de cards / CombatSystem)
//   passiva  → arvore.passivas             (PassiveSystem.passivasDe)
//   marca    → arvore.marcas               (RecursoClasseSystem.marcasDe)
//   atributo → nada direto; bonusArvore lê `escolhas` e soma
function aplicarConcessao(personagem, no, dados) {
  const a = garantirEstadoArvore(personagem);
  if (no.tipoConcedido === "ativa" && no.habilidade) {
    if (!personagem.habilidades.some((h) => h.id === no.habilidade.id)) {
      personagem.habilidades.push({ ...no.habilidade, cooldownAtual: 0 });
    }
  } else if (no.tipoConcedido === "passiva" && no.passiva) {
    if (!a.passivas.some((p) => p.id === no.passiva.id)) a.passivas.push({ ...no.passiva });
  } else if (no.tipoConcedido === "marca" && no.marca) {
    if (!a.marcas.some((m) => m.id === no.marca.id)) a.marcas.push({ ...no.marca });
  }
  // Atributo (e qualquer nó que mexa em vida/éter máximos) exige recalcular
  // os máximos na hora, senão o jogador só veria o HP novo no próximo nível.
  if (dados) {
    personagem.hpMax = calcularHpMax(personagem, dados);
    personagem.mpMax = calcularMpMax(personagem, dados);
    personagem.hp = Math.min(personagem.hpMax, personagem.hp);
    personagem.mp = Math.min(personagem.mpMax, personagem.mp);
  }
}

export function escolherNo(personagem, dados, noId) {
  const arvore = arvoreDaClasse(personagem, dados);
  const no = arvore.find((n) => n.id === noId);
  if (!no) return { ok: false, motivo: "nó inexistente" };
  const motivos = motivosBloqueio(personagem, dados, no);
  if (motivos.length) return { ok: false, motivo: motivos.join("; ") };
  garantirEstadoArvore(personagem).escolhas.push(no.id);
  aplicarConcessao(personagem, no, dados);
  return { ok: true, no, pontosRestantes: pontosDisponiveis(personagem, dados) };
}

// --- Reset ----------------------------------------------------------------

export function custoDeReset(personagem) {
  return CUSTO_RESET_BASE + CUSTO_RESET_POR_NIVEL * Math.max(0, (personagem.nivel || 1) - 1);
}

// Desfaz TUDO: devolve os pontos, tira as habilidades concedidas da mão,
// limpa passivas e marcas, e recalcula os máximos.
//
// Importante: só remove habilidade que veio DA ÁRVORE. A habilidade inicial
// da classe e qualquer habilidade de outra fonte (gacha, talento) ficam.
export function resetarArvore(personagem, dados, { cobrarOuro = true } = {}) {
  const a = garantirEstadoArvore(personagem);
  const custo = custoDeReset(personagem);
  if (cobrarOuro && (personagem.ouro || 0) < custo) {
    return { ok: false, motivo: `faltam ${custo - (personagem.ouro || 0)} de ouro`, custo };
  }
  const arvore = arvoreDaClasse(personagem, dados);
  const idsDeHabilidade = new Set(
    a.escolhas
      .map((id) => arvore.find((n) => n.id === id))
      .filter((n) => n && n.tipoConcedido === "ativa" && n.habilidade)
      .map((n) => n.habilidade.id)
  );
  personagem.habilidades = (personagem.habilidades || []).filter((h) => !idsDeHabilidade.has(h.id));
  const devolvidos = pontosGastos(personagem, dados);
  a.escolhas = [];
  a.passivas = [];
  a.marcas = [];
  if (cobrarOuro) personagem.ouro = (personagem.ouro || 0) - custo;
  if (dados) {
    personagem.hpMax = calcularHpMax(personagem, dados);
    personagem.mpMax = calcularMpMax(personagem, dados);
    personagem.hp = Math.min(personagem.hpMax, personagem.hp);
    personagem.mp = Math.min(personagem.mpMax, personagem.mp);
  }
  return { ok: true, custo, devolvidos, pontosDisponiveis: pontosDisponiveis(personagem, dados) };
}

// --- Apoio para a tela ----------------------------------------------------

// Texto humano do que o nó dá — a tela não deve saber o formato de nenhum
// dos quatro tipos de concessão.
export function descreverConcessao(no) {
  if (no.tipoConcedido === "ativa" && no.habilidade) {
    const h = no.habilidade;
    const custo = h.custoMP ? `${h.custoMP} de Éter` : "sem custo";
    const cd = h.cooldown ? `recarga ${h.cooldown}` : "sem recarga";
    return `Habilidade ativa · ${custo} · ${cd}`;
  }
  if (no.tipoConcedido === "passiva" && no.passiva) {
    const alcance = no.passiva.efeito.escopo === "time" ? "todo o time" : "só você";
    return `Passiva permanente · ${alcance}`;
  }
  if (no.tipoConcedido === "marca" && no.marca) return `Marca de classe · ${no.marca.recurso}`;
  if (no.tipoConcedido === "atributo" && no.efeito) return `+${no.efeito.valor} de ${no.efeito.atributo} permanente`;
  return "";
}

// Existe alguma compra possível agora? É o que acende o aviso "🌟 pontos
// disponíveis" na HUD — mostrar só "tem ponto sobrando" seria ruim, porque
// no nível 2 você tem 1 ponto e nada para comprar até o nível certo.
export function temCompraDisponivel(personagem, dados) {
  if (!personagem || !dados) return false;
  return avaliarArvore(personagem, dados).some((e) => e.estado === "disponivel");
}

// --- Modo automático ------------------------------------------------------
//
// O automático precisa gastar ponto sozinho, senão o personagem sobe de
// nível para sempre com 15 pontos parados. A versão antiga sorteava entre as
// duas opções do tier — com 3 ramos e 18 nós, sortear produziria exatamente
// o pior resultado possível: pontos espalhados em três ramos rasos, nenhum
// nó final jamais alcançado (eles exigem 7 pontos NO MESMO ramo).
//
// Por isso a heurística é uma só e é de PROFUNDIDADE: continue o ramo em que
// você já investiu mais. O automático termina o que começou.
export function escolhaAutomatica(personagem, dados) {
  const disponiveis = avaliarArvore(personagem, dados)
    .filter((e) => e.estado === "disponivel")
    .map((e) => e.no);
  if (!disponiveis.length) return null;
  const investimento = {};
  for (const r of ramosDaClasse(personagem, dados)) investimento[r.id] = pontosNoRamo(personagem, dados, r.id);
  disponiveis.sort((a, b) => {
    const dif = (investimento[b.ramo] || 0) - (investimento[a.ramo] || 0);
    if (dif) return dif;             // 1º: o ramo mais investido
    if (a.tier !== b.tier) return a.tier - b.tier;  // 2º: o degrau mais baixo do ramo
    return custoDoNo(a) - custoDoNo(b);             // 3º: o mais barato
  });
  return disponiveis[0];
}
