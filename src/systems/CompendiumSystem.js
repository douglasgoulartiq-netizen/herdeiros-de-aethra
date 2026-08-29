// Compêndio: bestiário com registro de abates, lista de missões (concluídas
// ou não) e histórico de invocações — task #37 do backlog. Esta camada é
// só de OBSERVAÇÃO/leitura sobre eventos que outros sistemas já disparam:
// - abates: BattleUI.js chama registrarAbateCompendio() logo ao lado da
//   chamada já existente pra QuestSystem.registrarAbate(), no mesmo loop de
//   fim de batalha — não duplica lógica de progresso de missão, só soma um
//   contador próprio por monstro.
// - missões: não tem estado próprio aqui — deriva de personagem.missoesConcluidas
//   (já mantido por QuestSystem.js) cruzado com dados.quests.
// - invocações: não tem estado próprio aqui — deriva de
//   personagem.gacha.historicoInvocacoes, que GachaSystem.js já escreve
//   sozinho a cada invocarPermanente/invocarEvento/invocarIniciante.
// Nada neste arquivo decide se algo aconteceu no jogo; ele só expõe os dados
// de um jeito conveniente pra CompendiumUI.js.

import { relacaoElemental } from "./ElementSystem.js";

// Fraqueza elemental progressiva (melhoria de jogabilidade pós-backlog
// original): descobrir um monstro (1º abate) já revela nome/nível/bioma/
// elemento PRÓPRIO dele, mas a fraqueza elemental EXATA (o que causar mais
// dano nele) só aparece depois de um número maior de abates — recompensa
// quem realmente "estuda" o monstro em vez de só encontrá-lo uma vez, e dá
// um motivo a mais pra caçar o mesmo tipo repetidas vezes.
export const ABATES_PARA_REVELAR_FRAQUEZA = 3;

// Todo elemento cujo ataque causa "vantagem"/"vantagem_intensa" contra
// `elementoDefensor` — ou seja, a fraqueza do defensor do ponto de vista de
// quem ataca. Intensas primeiro (a fraqueza "de verdade"), depois as
// normais. Físico nunca entra (ElementSystem trata físico como sempre
// neutro) e o próprio elemento nunca aparece (seria imunidade, não fraqueza).
export function calcularFraquezas(elementoDefensor, dadosElementos) {
  if (!elementoDefensor || !dadosElementos) return [];
  const intensas = [];
  const normais = [];
  (dadosElementos.elementos || []).forEach((el) => {
    if (el.id === "fisico" || el.id === elementoDefensor) return;
    const relacao = relacaoElemental(el.id, elementoDefensor, dadosElementos);
    if (relacao === "vantagem_intensa") intensas.push(el.id);
    else if (relacao === "vantagem") normais.push(el.id);
  });
  return [...intensas, ...normais];
}

export function garantirCompendio(personagem) {
  if (!personagem.compendio) personagem.compendio = { abates: {} };
  return personagem.compendio;
}

export function registrarAbateCompendio(personagem, monstroId) {
  const c = garantirCompendio(personagem);
  c.abates[monstroId] = (c.abates[monstroId] || 0) + 1;
  return c.abates[monstroId];
}

export function totalAbates(personagem, monstroId) {
  const c = garantirCompendio(personagem);
  return c.abates[monstroId] || 0;
}

export function jaEncontrado(personagem, monstroId) {
  return totalAbates(personagem, monstroId) > 0;
}

// Junta cada entrada de dados.compendium (lore) com dados.monsters (stats) e
// o progresso do jogador (abates), pronta pra CompendiumUI.js renderizar.
export function bestiarioParaCompendio(personagem, dados) {
  const lorePorId = Object.fromEntries((dados.compendium || []).map((e) => [e.id, e]));
  return dados.monsters.map((m) => {
    const lore = lorePorId[m.id];
    const abates = totalAbates(personagem, m.id);
    const descoberto = abates > 0;
    // Fraqueza elemental progressiva: só revelada depois de
    // ABATES_PARA_REVELAR_FRAQUEZA abates, mesmo que o monstro já esteja
    // "descoberto" (que só exige 1). Enquanto não revelada, a UI mostra
    // quantos abates faltam em vez do elemento exato.
    const fraquezaRevelada = abates >= ABATES_PARA_REVELAR_FRAQUEZA;
    return {
      id: m.id,
      // Enquanto não descoberto, nome e stats ficam escondidos também — só o
      // teaser (que já é escrito de forma vaga, sem entregar o nome) aparece.
      // Isso é o que faz o bestiário funcionar como bestiário de verdade.
      nome: descoberto ? m.nome : "???",
      nivel: descoberto ? m.nivel : null,
      bioma: descoberto ? m.bioma : null,
      elemento: descoberto ? m.elemento : null,
      arquetipo: descoberto ? m.arquetipo : null,
      chefe: !!m.chefe,
      abates,
      descoberto,
      fraquezaRevelada: descoberto && fraquezaRevelada,
      fraquezas: descoberto && fraquezaRevelada ? calcularFraquezas(m.elemento, dados.elements) : null,
      abatesFaltandoFraqueza: descoberto && !fraquezaRevelada ? Math.max(0, ABATES_PARA_REVELAR_FRAQUEZA - abates) : null,
      teaser: lore ? lore.teaser : "???",
      lore: descoberto && lore ? lore.lore : null,
    };
  });
}

export function progressoBestiario(personagem, dados) {
  const total = dados.monsters.length;
  const descobertos = dados.monsters.filter((m) => totalAbates(personagem, m.id) > 0).length;
  return { descobertos, total, percentual: total ? Math.round((descobertos / total) * 100) : 0 };
}

export function missoesParaCompendio(personagem, dados) {
  return dados.quests.map((q) => ({
    ...q,
    concluida: personagem.missoesConcluidas.includes(q.id),
    ativa: personagem.missoesAtivas.some((m) => m.id === q.id),
  }));
}

// Mais recente primeiro — historicoInvocacoes já é gravado em ordem
// cronológica crescente por GachaSystem.js.
export function historicoInvocacoes(personagem) {
  const g = personagem.gacha;
  if (!g || !g.historicoInvocacoes) return [];
  return [...g.historicoInvocacoes].reverse();
}
