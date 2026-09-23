// Mundo reativo: reputação por facção + flags de escolhas persistentes.
// Tudo fica em personagem.estadoDoMundo — como o objeto `personagem` inteiro
// já é serializado no save (ver SaveSystem.js/estadoAtualParaSalvar em
// main.js), isso persiste automaticamente sem precisar de nenhum campo novo
// no contrato de save. Antes deste sistema, a única "escolha" persistente
// do jogo era a árvore de habilidades — agora ações no mundo (completar
// missões, testes de perícia bem-sucedidos com NPCs) deixam consequência:
// preços na loja mudam, e diálogos refletem como a vila te vê.
//
// Os dados de facções/tiers (src/data/worldStateVariables.json) chegam via
// `dadosWorldState`/`dados.worldState`, carregados pelo loader.js — igual a
// todo outro dado do jogo (nunca import direto de JSON, pra manter o padrão
// "sem build step" do projeto, servido por fetch()).
import { ajustarGanhoReputacao, CUSTO_TROCA_AFILIACAO, multPrecoLojaOrigem } from "./IdentidadeSystem.js";

export function estadoDoMundoInicial() {
  return { reputacao: {}, flags: {} };
}

export function garantirEstadoDoMundo(personagem) {
  if (!personagem.estadoDoMundo) personagem.estadoDoMundo = estadoDoMundoInicial();
  if (!personagem.estadoDoMundo.reputacao) personagem.estadoDoMundo.reputacao = {};
  if (!personagem.estadoDoMundo.flags) personagem.estadoDoMundo.flags = {};
  return personagem.estadoDoMundo;
}

export function getReputacao(personagem, facaoId) {
  return garantirEstadoDoMundo(personagem).reputacao[facaoId] || 0;
}

// Altera a reputação com uma facção, respeitando os limites min/max
// definidos em worldStateVariables.json (sem eles, usa -100/100). Retorna o
// novo valor.
export function alterarReputacao(personagem, facaoId, delta, dadosWorldState) {
  // Interesse Diplomacia: +10% em toda reputação GANHA, arredondado para
  // cima. Perda não muda.
  delta = ajustarGanhoReputacao(personagem, delta);
  const estado = garantirEstadoDoMundo(personagem);
  const facao = ((dadosWorldState && dadosWorldState.facoes) || []).find((f) => f.id === facaoId);
  const min = facao ? facao.min : -100;
  const max = facao ? facao.max : 100;
  const atual = estado.reputacao[facaoId] || 0;
  const novo = Math.max(min, Math.min(max, atual + delta));
  estado.reputacao[facaoId] = novo;
  return novo;
}

// Encontra o tier (faixa nomeada) correspondente a um valor de reputação —
// usado pra decidir desconto na loja e a saudação de diálogo.
export function tierDaReputacao(valor, dadosWorldState) {
  const tiers = [...((dadosWorldState && dadosWorldState.tiers) || [])].sort((a, b) => b.min - a.min);
  return tiers.find((t) => valor >= t.min) || tiers[tiers.length - 1] || null;
}

export function definirFlag(personagem, flagId, valor = true) {
  garantirEstadoDoMundo(personagem).flags[flagId] = valor;
}

export function temFlag(personagem, flagId) {
  return !!garantirEstadoDoMundo(personagem).flags[flagId];
}

// --- Diário de decisões (melhoria pós-backlog) --------------------------
// Registro cronológico de escolhas narrativas importantes — tom escolhido
// numa cena de vínculo (BondUI.js), opção tomada num evento de exploração
// (ExplorationEventUI.js), teste de perícia tentado com um NPC (GameUI.js),
// chefe derrotado (BattleUI.js), facção escolhida (CompendiumUI.js) — pra o
// jogador poder reler depois o que já viveu e o que isso rendeu (ver
// DecisionJournalUI.js). Puramente informativo: NENHUMA lógica de jogo lê
// `estadoDoMundo.decisoes` de volta, só a UI — bem diferente de
// reputacao/flags, que são lidos por várias outras mecânicas (loja,
// emboscada, camaradagem). Guardado dentro de estadoDoMundo pelo mesmo
// motivo que reputação/flags: persiste no save automaticamente, sem
// precisar de um campo novo no contrato de save.
//
// `momento` é um contador monotônico (não timestamp de verdade) só pra
// garantir ordem estável mesmo se duas decisões acontecerem no mesmo tick —
// evita depender de Date.now() dentro de lógica de jogo testável em Node.
const MAX_DECISOES_REGISTRADAS = 40;

export function registrarDecisao(personagem, { icone = "📜", titulo, texto }) {
  const estado = garantirEstadoDoMundo(personagem);
  if (!Array.isArray(estado.decisoes)) estado.decisoes = [];
  if (typeof estado.proximoMomentoDecisao !== "number") estado.proximoMomentoDecisao = 0;
  estado.decisoes.push({ icone, titulo, texto, momento: estado.proximoMomentoDecisao++ });
  // Nunca deixa o registro crescer sem limite num save de longa duração —
  // as mais antigas saem primeiro (FIFO), igual a um diário de papel que só
  // guarda as últimas páginas.
  if (estado.decisoes.length > MAX_DECISOES_REGISTRADAS) estado.decisoes.shift();
}

// Mais recente primeiro, pra UI não precisar inverter nada.
export function decisoesRegistradas(personagem) {
  return [...(garantirEstadoDoMundo(personagem).decisoes || [])].reverse();
}

// Resumo da reputação ATUAL com toda facção que o personagem já afetou
// (valor != 0) — a "consequência que ainda vale hoje" de escolhas antigas,
// complementando o registro cronológico acima (que só mostra o que
// aconteceu, não o placar atual). Facções nunca tocadas (reputação 0, nunca
// alterada) ficam de fora pra não poluir o diário com uma lista de 11
// facções zeradas logo no início do jogo.
export function reputacoesParaExibir(personagem, dadosWorldState) {
  const estado = garantirEstadoDoMundo(personagem);
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  return facoes
    .map((f) => ({ facaoId: f.id, nome: f.nome, icone: f.icone || "", valor: estado.reputacao[f.id] || 0, tier: tierDaReputacao(estado.reputacao[f.id] || 0, dadosWorldState) }))
    .filter((r) => r.valor !== 0);
}

// Multiplicador de preço de loja pra aplicar em cima do valor base do item,
// derivado do tier de reputação com a facção "vila" (1 = preço normal,
// <1 = desconto, >1 = preço mais alto pra quem é malvisto/hostil).
// `facaoId` (melhoria pós-backlog, mercador itinerante — ver
// TravelingMerchantSystem.js): por padrão continua "vila" (comportamento
// idêntico a antes desta opção existir, usado pela loja fixa da vila em
// GameUI.js), mas aceita qualquer outra facção — o mercador itinerante usa
// a facção REGIONAL da zona onde aparece, não a reputação com a vila.
export function multiplicadorPrecoLoja(personagem, dadosWorldState, facaoId = "vila") {
  const rep = getReputacao(personagem, facaoId);
  const tier = tierDaReputacao(rep, dadosWorldState);
  const desconto = tier ? tier.descontoLoja || 0 : 0;
  // A origem escolhida na criação desconta na SUA loja (ver LOJA_DA_ORIGEM em
  // IdentidadeSystem.js). Multiplica em cima do tier em vez de somar, para os
  // dois efeitos ficarem independentes, e continua respeitando o piso de 50%.
  return Math.max(0.5, (1 - desconto) * multPrecoLojaOrigem(personagem, facaoId));
}

// Emboscada regional (melhoria de jogabilidade pós-backlog original):
// consequência visível de reputação muito negativa com a facção regional da
// zona atual — moradores que te veem como inimigo armam emboscadas nos
// encontros aleatórios daquele território (ver EncounterSystem.js:
// reforcarEmboscada, aplicado em main.js). Reaproveita os mesmos tiers já
// usados pro desconto de loja (malvisto/hostil) em vez de criar uma escala
// paralela — ambos são "consequência de reputação ruim", só que um é
// econômico (preço) e o outro é de combate (emboscada).
const TIERS_HOSTIS_EMBOSCADA = new Set(["malvisto", "hostil"]);
const CHANCE_EMBOSCADA = 0.35;

export function deveEmboscar(personagem, facaoId, dadosWorldState) {
  if (!facaoId) return false;
  const rep = getReputacao(personagem, facaoId);
  const tier = tierDaReputacao(rep, dadosWorldState);
  if (!tier || !TIERS_HOSTIS_EMBOSCADA.has(tier.id)) return false;
  return Math.random() < CHANCE_EMBOSCADA;
}

// --- Facções regionais (task #44) ---------------------------------------
// 10 facções ligadas a regiões do mundo aberto (ver worldStateVariables.json
// campo `zonas` de cada facção — os ids batem com ZONAS/worldMap.js), além
// da facção "vila" já existente (essa continua sendo só "simpatia popular",
// sem `zonas` — é tratada à parte). Dá regionalidade ao mapa (cada bioma
// pertence a um povo com identidade própria) e aos personagens (cada um,
// incluindo o principal, pode se afiliar a uma facção — ver
// afiliarFaccao/facaoAfiliada).

export function facaoDaZona(zonaId, dadosWorldState) {
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  const f = facoes.find((f) => Array.isArray(f.zonas) && f.zonas.includes(zonaId));
  return f ? f.id : null;
}

export function facaoInfo(facaoId, dadosWorldState) {
  const facoes = (dadosWorldState && dadosWorldState.facoes) || [];
  return facoes.find((f) => f.id === facaoId) || null;
}

// Afiliação é uma escolha pessoal do personagem (guardada em
// estadoDoMundo, então persiste no save automaticamente igual ao resto do
// mundo reativo) — diferente de reputação, que é numérica e sobe/desce.
// Pode ser trocada, mas não de graça: deixar uma facção custa
// CUSTO_TROCA_AFILIACAO de reputação com ela (decisão do Douglas, 22/09 —
// a escolha precisa ter peso). A facção de ORIGEM é outra coisa: fica em
// `personagem.faccaoOrigemId` para sempre e não muda com a afiliação.
// Devolve quanto de reputação a troca custou (0 quando não havia afiliação).
export function afiliarFaccao(personagem, facaoId, dadosWorldState = null) {
  const estado = garantirEstadoDoMundo(personagem);
  const anterior = estado.facaoAfiliada || null;
  if (anterior === facaoId) return 0;
  let custo = 0;
  if (anterior) {
    custo = CUSTO_TROCA_AFILIACAO;
    alterarReputacao(personagem, anterior, -custo, dadosWorldState);
  }
  estado.facaoAfiliada = facaoId;
  return custo;
}

export function facaoAfiliada(personagem) {
  return garantirEstadoDoMundo(personagem).facaoAfiliada || null;
}

// "Camaradagem regional" (task #44): quando um convocado do gacha tem a
// MESMA facção que o personagem principal escolheu, o vínculo regional
// rende um pequeno bônus de combate — mesmo formato aditivo usado por
// bonusArvore/bonusAfinidade em CharacterFactory.js (FOR/DES/CON/INT/
// hpMaxPercent/mpMaxPercent/critChance/defesaFlat), somado do mesmo jeito.
// `personagemPrincipal` é sempre quem definiu a afiliação (só o herói
// escolhe facção pra si mesmo); convocados do gacha só "concordam" ou não
// com ela através do próprio `facaoId` de nascença (ver gachaRoster.json).
const BONUS_CAMARADAGEM = { FOR: 0, DES: 0, CON: 1, INT: 0, hpMaxPercent: 0.02, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };
const BONUS_VAZIO_FACCAO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

export function bonusCamaradagemFaccao(personagem, personagemPrincipal) {
  const minhaAfiliacao = facaoAfiliada(personagemPrincipal);
  if (!minhaAfiliacao || !personagem.facaoId || personagem.facaoId !== minhaAfiliacao) return { ...BONUS_VAZIO_FACCAO };
  return { ...BONUS_CAMARADAGEM };
}

// Aplica o bônus de camaradagem direto num combatente já montado (ver
// CombatSystem.js criarCombatenteJogador) — feito assim, em vez de
// encaixado dentro de bonusArvore/bonusAfinidade em CharacterFactory.js,
// porque camaradagem depende da afiliação ATUAL do personagem principal e
// de QUEM está no time agora: pode mudar entre batalhas sem o personagem
// subir de nível, então não daria pra esperar o próximo recálculo de
// hpMax/mpMax (que só acontece em ganharXP/aplicarCrescimento). Mutação é
// segura aqui porque `combatente` é um objeto efêmero, recriado do zero a
// cada batalha (nunca é o `personagem`/instância salva).
export function aplicarCamaradagemNoCombatente(combatente, membro, personagemPrincipal) {
  const bonus = bonusCamaradagemFaccao(membro, personagemPrincipal);
  if (Object.values(bonus).every((v) => !v)) return combatente;
  combatente.atributos.FOR = (combatente.atributos.FOR || 0) + bonus.FOR;
  combatente.atributos.DES = (combatente.atributos.DES || 0) + bonus.DES;
  combatente.atributos.CON = (combatente.atributos.CON || 0) + bonus.CON;
  combatente.atributos.INT = (combatente.atributos.INT || 0) + bonus.INT;
  combatente.defesa += bonus.defesaFlat;
  combatente.critBonus = (combatente.critBonus || 0) + bonus.critChance;
  if (bonus.hpMaxPercent) {
    const novoHpMax = Math.round(combatente.hpMax * (1 + bonus.hpMaxPercent));
    combatente.hp = Math.round(combatente.hp * (novoHpMax / combatente.hpMax));
    combatente.hpMax = novoHpMax;
  }
  if (bonus.mpMaxPercent) {
    const novoMpMax = Math.round(combatente.mpMax * (1 + bonus.mpMaxPercent));
    combatente.mp = combatente.mpMax > 0 ? Math.round(combatente.mp * (novoMpMax / combatente.mpMax)) : combatente.mp;
    combatente.mpMax = novoMpMax;
  }
  return combatente;
}
