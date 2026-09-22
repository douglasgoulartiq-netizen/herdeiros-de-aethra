// DESTINO PESSOAL — o caminho que as escolhas da criação abrem.
//
// Duas linhas, as duas nascem da criação de personagem e andam sozinhas com
// o que o jogador já faz no jogo (vencer, explorar, abrir baú, colher,
// concluir missão). Nada aqui pede NPC novo nem marca no mapa: o progresso é
// lido de contadores do próprio personagem, e a recompensa cai quando a meta
// é alcançada.
//
//   ORIGEM     — um recado do contato de origem (a comandante do Soldado, a
//                receptadora do Criminoso…), com uma tarefa curta do começo
//                do jogo e reputação com o povo de onde o herói veio.
//   MOTIVAÇÃO  — uma linha de três passos, um por fase do jogo, que termina
//                com um ponto de Herança. É a motivação escolhida virando
//                história: Justiça derruba chefes, Descoberta mapeia lugares.
//
// Quem chama `verificarDestino` (main.js, a cada atualização da interface)
// recebe o que foi concluído e aplica o XP com o fluxo normal de subir de
// nível; o resto da recompensa é aplicado aqui.
import { alterarReputacao } from "./WorldStateSystem.js";
import { adicionarFragmentos } from "./GachaSystem.js";
import { concederPontoHeranca } from "./TalentSystem.js";
import { temCombinacao } from "./IdentidadeSystem.js";

export const CONTATOS_DE_ORIGEM = {
  soldado: {
    icone: "🪖", contato: "Capitã Brenna", nome: "Velhos Hábitos",
    recado: "Recado da Capitã Brenna, sua antiga comandante: \"Soube que você voltou à estrada. Mostre que o treino não enferrujou.\"",
    objetivo: { tipo: "vitorias", meta: 5 },
    recompensa: { ouro: 30, itens: [{ id: "pocao_vida_p", qtd: 2 }], reputacaoOrigem: 5 },
  },
  nobre: {
    icone: "🎩", contato: "Mordomo Aldric", nome: "O Nome da Família",
    recado: "Aldric, o mordomo da sua casa, escreve: \"Seu pai quer saber se o sobrenome ainda abre portas lá fora.\"",
    objetivo: { tipo: "faccoesRespeitado", meta: 2 },
    recompensa: { ouro: 80, reputacaoOrigem: 5 },
  },
  criminoso: {
    icone: "🗝️", contato: "Vess, a receptadora", nome: "Mercadoria Quente",
    recado: "Vess manda dizer: \"Tem coisa boa esquecida em baú por aí. Abre três e a gente acerta as contas.\"",
    objetivo: { tipo: "baus", meta: 3 },
    recompensa: { ouro: 60, reputacaoOrigem: 5 },
  },
  eremita: {
    icone: "🌿", contato: "Velho Tomas", nome: "O Herbário de Tomas",
    recado: "Um bilhete amarrado num galho, com a letra torta do velho Tomas: \"Cinco colheitas boas e eu te ensino a guardar erva do jeito certo.\"",
    objetivo: { tipo: "coletas", meta: 5 },
    recompensa: { itens: [{ id: "erva_rara", qtd: 1 }, { id: "pocao_vida_p", qtd: 2 }], reputacaoOrigem: 5 },
  },
  andarilho_do_povo: {
    icone: "🤲", contato: "Irmã Liane", nome: "Mãos que Ajudam",
    recado: "Irmã Liane, que cuidava dos andarilhos na estrada, escreve: \"Duas famílias precisam de você. Faça por elas o que fizeram por você.\"",
    objetivo: { tipo: "missoes", meta: 2 },
    recompensa: { ouro: 40, reputacaoVila: 10, reputacaoOrigem: 5 },
  },
  sabio: {
    icone: "📜", contato: "Arquivista Orwen", nome: "Notas de Campo",
    recado: "O arquivista Orwen pede: \"Descreva para mim quatro lugares que nenhum livro descreve direito.\"",
    objetivo: { tipo: "lugares", meta: 4 },
    recompensa: { fragmentos: 30, itens: [{ id: "pergaminho_arcano", qtd: 2 }], reputacaoOrigem: 5 },
  },
};

export const CAMINHOS_DA_MOTIVACAO = {
  descoberta: {
    icone: "🗺️", titulo: "Mapa do que Ninguém Viu",
    passos: [
      { nome: "Primeiros rastros", objetivo: { tipo: "lugares", meta: 5 }, recompensa: { xp: 60, fragmentos: 15 } },
      { nome: "Onde a trilha some", objetivo: { tipo: "lugares", meta: 12 }, recompensa: { xp: 180, ouro: 60 } },
      { nome: "Cartógrafo de Aethra", objetivo: { tipo: "lugares", meta: 25 }, recompensa: { xp: 400, fragmentos: 60, pontoHeranca: true } },
    ],
  },
  justica: {
    icone: "⚖️", titulo: "Quem Protege os Outros",
    passos: [
      { nome: "O primeiro tirano", objetivo: { tipo: "chefes", meta: 1 }, recompensa: { xp: 80, ouro: 40 } },
      { nome: "Três regiões mais leves", objetivo: { tipo: "chefes", meta: 3 }, recompensa: { xp: 200, fragmentos: 30 } },
      { nome: "O nome que os fracos repetem", objetivo: { tipo: "chefes", meta: 6 }, recompensa: { xp: 450, ouro: 150, pontoHeranca: true } },
    ],
  },
  legado: {
    icone: "👑", titulo: "Relíquias da Casa",
    passos: [
      { nome: "O primeiro tesouro", objetivo: { tipo: "baus", meta: 3 }, recompensa: { xp: 60, ouro: 40 } },
      { nome: "Um cofre que cresce", objetivo: { tipo: "baus", meta: 8 }, recompensa: { xp: 180, ouro: 100 } },
      { nome: "O que sobrevive ao tempo", objetivo: { tipo: "baus", meta: 15 }, recompensa: { xp: 400, ouro: 250, pontoHeranca: true } },
    ],
  },
  liberdade: {
    icone: "🕊️", titulo: "Sem Correntes",
    passos: [
      { nome: "Pé na estrada", objetivo: { tipo: "zonas", meta: 4 }, recompensa: { xp: 60, ouro: 30 } },
      { nome: "Ninguém me segura", objetivo: { tipo: "vitorias", meta: 20 }, recompensa: { xp: 180, fragmentos: 30 } },
      { nome: "Dono do próprio caminho", objetivo: { tipo: "zonas", meta: 12 }, recompensa: { xp: 400, ouro: 150, pontoHeranca: true } },
    ],
  },
  redencao: {
    icone: "🌅", titulo: "O Que Ficou Para Trás",
    passos: [
      { nome: "O primeiro favor", objetivo: { tipo: "missoes", meta: 2 }, recompensa: { xp: 60, ouro: 30 } },
      { nome: "Um nome limpo na vila", objetivo: { tipo: "reputacaoVila", meta: 20 }, recompensa: { xp: 180, fragmentos: 30 } },
      { nome: "A dívida paga", objetivo: { tipo: "missoes", meta: 6 }, recompensa: { xp: 400, ouro: 150, pontoHeranca: true } },
    ],
  },
  poder: {
    icone: "✨", titulo: "Forças que Outros Temem",
    passos: [
      { nome: "Maior que eu", objetivo: { tipo: "vitoriasAcima", meta: 3 }, recompensa: { xp: 80, fragmentos: 15 } },
      { nome: "O medo muda de lado", objetivo: { tipo: "vitoriasAcima", meta: 10 }, recompensa: { xp: 220, ouro: 80 } },
      { nome: "Ninguém à altura", objetivo: { tipo: "vitoriasAcima", meta: 25 }, recompensa: { xp: 450, fragmentos: 60, pontoHeranca: true } },
    ],
  },
};

// Criminoso + Redenção ("Dívida Antiga"): a Redenção vira a história do
// passado no crime — outros nomes e o ouro final dobrado.
const DIVIDA_ANTIGA = {
  icone: "⛓️", titulo: "Dívida Antiga",
  nomes: ["Devolver o que foi roubado", "Um rosto que a vila perdoa", "A última dívida"],
};

const TEXTO_OBJETIVO = {
  vitorias: (m) => `Vença ${m} batalhas`,
  vitoriasAcima: (m) => `Vença ${m} batalhas contra inimigos de nível acima do seu`,
  coletas: (m) => `Colha ${m} vezes em nós de recurso`,
  baus: (m) => `Abra ${m} baús`,
  lugares: (m) => `Descubra ${m} lugares (cidades, pontos de interesse, marcos)`,
  zonas: (m) => `Pise em ${m} zonas diferentes`,
  chefes: (m) => `Derrote ${m} chefes diferentes`,
  missoes: (m) => `Conclua ${m} missões`,
  reputacaoVila: (m) => `Chegue a ${m} de reputação com a Vila`,
  faccoesRespeitado: (m) => `Seja Respeitado (20+) por ${m} facções regionais`,
};
export const textoObjetivo = (objetivo) => (TEXTO_OBJETIVO[objetivo.tipo] || (() => objetivo.tipo))(objetivo.meta);

// Contadores que só o destino usa. Criados sob demanda — um save antigo
// começa do zero nos que não dá para reconstruir, e reconstrói os que dá
// (baús, lugares, zonas, chefes, missões) a partir do que já está gravado.
export function garantirContadores(personagem) {
  if (!personagem.contadores || typeof personagem.contadores !== "object") personagem.contadores = {};
  const c = personagem.contadores;
  ["vitorias", "vitoriasAcima", "coletas"].forEach((k) => { if (typeof c[k] !== "number") c[k] = 0; });
  return c;
}

export function registrarVitoria(personagem, inimigos = []) {
  const c = garantirContadores(personagem);
  c.vitorias += 1;
  const nivel = personagem.nivel || 1;
  if (inimigos.some((i) => (i.nivelMonstro || 0) > nivel)) c.vitoriasAcima += 1;
}

export function registrarColeta(personagem) {
  garantirContadores(personagem).coletas += 1;
}

const DESCOBERTOS = new Set(["descoberto", "dominado"]);

export function progressoObjetivo(personagem, objetivo, dados = {}) {
  const c = garantirContadores(personagem);
  const nevoa = personagem.nevoa || {};
  const reputacao = (personagem.estadoDoMundo && personagem.estadoDoMundo.reputacao) || {};
  let atual = 0;
  switch (objetivo.tipo) {
    case "vitorias": atual = c.vitorias; break;
    case "vitoriasAcima": atual = c.vitoriasAcima; break;
    case "coletas": atual = c.coletas; break;
    case "baus": atual = (personagem.locaisExplorados || []).filter((id) => String(id).includes("bau")).length; break;
    case "lugares": atual = Object.values(nevoa.locais || {}).filter((e) => DESCOBERTOS.has(e)).length; break;
    case "zonas": atual = Object.values(nevoa.zonas || {}).filter((e) => DESCOBERTOS.has(e)).length; break;
    case "chefes": {
      const abates = (personagem.compendio && personagem.compendio.abates) || {};
      const chefes = new Set((dados.monsters || []).filter((m) => m.chefe).map((m) => m.id));
      atual = Object.keys(abates).filter((id) => chefes.has(id) && abates[id] > 0).length;
      break;
    }
    case "missoes": {
      const regionais = Object.values(personagem.questsRegionais || {}).filter((e) => e === "concluida").length;
      atual = (personagem.missoesConcluidas || []).length + regionais;
      break;
    }
    case "reputacaoVila": atual = reputacao.vila || 0; break;
    case "faccoesRespeitado": atual = Object.entries(reputacao).filter(([id, v]) => id !== "vila" && v >= 20).length; break;
    default: atual = 0;
  }
  return { atual: Math.min(atual, objetivo.meta), meta: objetivo.meta, pronto: atual >= objetivo.meta };
}

export function garantirDestino(personagem) {
  if (!personagem.destino || typeof personagem.destino !== "object") personagem.destino = { origemConcluida: false, passoMotivacao: 0 };
  return personagem.destino;
}

// O que o painel mostra: a tarefa de origem (se ainda não acabou) e o passo
// atual da motivação.
export function destinoAtual(personagem, dados = {}) {
  const d = garantirDestino(personagem);
  const itens = [];
  const origem = CONTATOS_DE_ORIGEM[personagem.antecedenteId];
  if (origem && !d.origemConcluida) {
    itens.push({
      linha: "origem", icone: origem.icone, titulo: origem.nome, subtitulo: `Contato de origem: ${origem.contato}`,
      texto: origem.recado, objetivo: origem.objetivo, recompensa: origem.recompensa,
      progresso: progressoObjetivo(personagem, origem.objetivo, dados),
    });
  }
  const caminho = CAMINHOS_DA_MOTIVACAO[personagem.motivacaoId];
  if (caminho && d.passoMotivacao < caminho.passos.length) {
    const divida = personagem.motivacaoId === "redencao" && temCombinacao(personagem, "divida_antiga");
    const passo = caminho.passos[d.passoMotivacao];
    const recompensa = divida && d.passoMotivacao === caminho.passos.length - 1
      ? { ...passo.recompensa, ouro: (passo.recompensa.ouro || 0) * 2 } : passo.recompensa;
    itens.push({
      linha: "motivacao", icone: divida ? DIVIDA_ANTIGA.icone : caminho.icone,
      titulo: divida ? DIVIDA_ANTIGA.nomes[d.passoMotivacao] : passo.nome,
      subtitulo: `${divida ? DIVIDA_ANTIGA.titulo : caminho.titulo} · passo ${d.passoMotivacao + 1} de ${caminho.passos.length}`,
      objetivo: passo.objetivo, recompensa,
      progresso: progressoObjetivo(personagem, passo.objetivo, dados),
    });
  }
  return itens;
}

export function textoRecompensa(r = {}, dados = {}) {
  const partes = [];
  if (r.xp) partes.push(`${r.xp} XP`);
  if (r.ouro) partes.push(`🪙 ${r.ouro}`);
  if (r.fragmentos) partes.push(`💠 ${r.fragmentos} Fragmentos`);
  (r.itens || []).forEach(({ id, qtd = 1 }) => {
    const item = ((dados.items && dados.items.itens) || []).find((i) => i.id === id);
    partes.push(`${qtd > 1 ? `${qtd}× ` : ""}${item ? item.nome : id}`);
  });
  if (r.reputacaoOrigem) partes.push(`+${r.reputacaoOrigem} com o seu povo`);
  if (r.reputacaoVila) partes.push(`+${r.reputacaoVila} com a Vila`);
  if (r.pontoHeranca) partes.push("1 ponto de Herança");
  return partes.join(" · ");
}

const uidNovo = () => "id_" + Math.random().toString(36).slice(2, 10);

function aplicarRecompensa(personagem, r, dados) {
  if (r.ouro) personagem.ouro = (personagem.ouro || 0) + r.ouro;
  if (r.fragmentos) adicionarFragmentos(personagem, r.fragmentos);
  (r.itens || []).forEach(({ id, qtd = 1 }) => {
    const item = ((dados.items && dados.items.itens) || []).find((i) => i.id === id);
    if (!item) return;
    for (let n = 0; n < qtd; n += 1) personagem.inventario.push({ ...item, uid: uidNovo() });
  });
  if (r.reputacaoOrigem && personagem.faccaoOrigemId) alterarReputacao(personagem, personagem.faccaoOrigemId, r.reputacaoOrigem, dados.worldStateVariables);
  if (r.reputacaoVila) alterarReputacao(personagem, "vila", r.reputacaoVila, dados.worldStateVariables);
  if (r.pontoHeranca) concederPontoHeranca(personagem, { tipo: "destino", motivacao: personagem.motivacaoId });
}

// Confere as metas e entrega o que foi alcançado. Devolve a lista do que
// concluiu, cada item com o XP que o chamador deve aplicar.
export function verificarDestino(personagem, dados = {}) {
  if (!personagem) return [];
  const d = garantirDestino(personagem);
  const concluidos = [];
  for (let guarda = 0; guarda < 6; guarda += 1) {
    const pronto = destinoAtual(personagem, dados).find((i) => i.progresso.pronto);
    if (!pronto) break;
    aplicarRecompensa(personagem, pronto.recompensa, dados);
    if (pronto.linha === "origem") d.origemConcluida = true;
    else d.passoMotivacao += 1;
    concluidos.push({ ...pronto, xp: pronto.recompensa.xp || 0 });
  }
  return concluidos;
}
