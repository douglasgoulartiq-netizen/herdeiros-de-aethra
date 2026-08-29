// Caminhos do Herdeiro — arquitetura genérica (task #92): pontos, árvore de
// talentos, herança narrativa e presets de build. Este arquivo é o motor;
// os DADOS (as árvores de verdade do Guerreiro e do Mago) chegam nas tasks
// #93/#94 em src/data/talentsGuerreiro.json e src/data/talentsMago.json —
// hoje eles existem só como esqueleto vazio (`{"talentos": []}`), então
// `talentosDisponiveis()` sempre retorna vazio pra qualquer personagem e
// nada muda em nenhuma partida existente. Nenhuma classe além de Guerreiro/
// Mago tem um arquivo de talentos ainda (por decisão do usuário: "profundo
// em 2 classes primeiro") — pra qualquer outra classe, `arvoreDoPersonagem`
// retorna [] e o sistema inteiro fica inerte pra ela, exatamente como
// funcionava antes desta task existir.
//
// Moedas de ponto (`tipoPonto` de cada nó): "classe" (ganho a cada level up,
// ver concederPontosPorNivel), "subclasse" (ganho em marcos de nível DEPOIS
// de escolher subclasse) e "heranca" (NUNCA ganho por nível — só por eventos
// narrativos reais do mundo: chefe derrotado, reputação de facção, despertar
// de Arma Secreta de um convocado do gacha — ver concederPontoHeranca e os
// gatilhos embutidos em atendeGatilhoHeranca).
//
// Regra explícita do usuário: talentos de classe/subclasse podem ser
// re-especializados (resetarTalentos devolve os pontos gastos); escolhas de
// HERANÇA são permanentes — "a decisão do mundo precisa ter peso" — nunca
// são desfeitas por resetarTalentos.

import { calcularHpMax, calcularMpMax } from "./CharacterFactory.js";

// Nível em que cada personagem pode escolher subclasse, e os marcos de
// nível seguintes que concedem +1 ponto de subclasse (além do ponto
// concedido na própria escolha). Números conservadores de propósito — dá
// pra ajustar depois do playtest sem migrar nenhum save (é só configuração,
// não é dado salvo).
export const NIVEL_ESCOLHA_SUBCLASSE = 10;
export const MARCOS_PONTO_SUBCLASSE = [10, 15, 20, 25, 30];

function presetVazio(nome) {
  return { nome, talentosEscolhidos: [] };
}

// Backfill defensivo (mesmo padrão de garantirCompendio/garantirEstadoDoMundo/
// garantirEstadoGacha já usado no projeto): cria o estado a partir do nada
// pra qualquer personagem — novo ou de um save antigo de antes desta task
// existir — sem precisar de migração formal de save (task #97 cuida da
// versão "de verdade"; isso aqui já deixa o save antigo 100% seguro de ler
// hoje).
export function garantirEstadoCaminho(personagem) {
  if (!personagem.caminhoHerdeiro) {
    personagem.caminhoHerdeiro = {
      subclasseId: null,
      pontosClasse: 0,
      pontosSubclasse: 0,
      pontosHeranca: 0,
      heranca: [], // [{ id, origem, nivelNaEpoca }] — escolhas permanentes já feitas
      marcosSubclasseConcedidos: [], // níveis de MARCOS_PONTO_SUBCLASSE já pagos, pra nunca conceder 2x
      presets: [presetVazio("Build 1"), presetVazio("Build 2"), presetVazio("Build 3")],
      presetAtivo: 0,
    };
  }
  const ch = personagem.caminhoHerdeiro;
  // Backfills de campo a campo (mesmo estilo de aplicarEstadoSalvo em
  // SaveSystem.js) — cobre um save que já tinha `caminhoHerdeiro` de uma
  // versão anterior desta própria task, mas sem um campo mais novo.
  if (!Array.isArray(ch.heranca)) ch.heranca = [];
  if (!Array.isArray(ch.marcosSubclasseConcedidos)) ch.marcosSubclasseConcedidos = [];
  if (!Array.isArray(ch.presets) || ch.presets.length !== 3) ch.presets = [presetVazio("Build 1"), presetVazio("Build 2"), presetVazio("Build 3")];
  if (typeof ch.presetAtivo !== "number" || ch.presetAtivo < 0 || ch.presetAtivo > 2) ch.presetAtivo = 0;
  if (typeof ch.pontosClasse !== "number") ch.pontosClasse = 0;
  if (typeof ch.pontosSubclasse !== "number") ch.pontosSubclasse = 0;
  if (typeof ch.pontosHeranca !== "number") ch.pontosHeranca = 0;
  return ch;
}

function presetAtivo(personagem) {
  const ch = garantirEstadoCaminho(personagem);
  return ch.presets[ch.presetAtivo];
}

// Talentos ativos AGORA (do preset selecionado) + toda a herança (a herança
// não pertence a nenhum preset — é permanente e vale nos três ao mesmo
// tempo, ao contrário de talento de classe/subclasse).
export function talentosAtivos(personagem) {
  const ch = garantirEstadoCaminho(personagem);
  return [...presetAtivo(personagem).talentosEscolhidos, ...ch.heranca.map((h) => h.id)];
}

// A árvore de talentos "de verdade" do personagem — [] pra qualquer classe
// sem arquivo ainda (ver comentário do módulo). `dados` é o objeto retornado
// por carregarDados() (loader.js).
export function arvoreDoPersonagem(personagem, dados) {
  if (!dados) return [];
  if (personagem.classeId === "guerreiro") return (dados.talentsGuerreiro && dados.talentsGuerreiro.talentos) || [];
  if (personagem.classeId === "mago") return (dados.talentsMago && dados.talentsMago.talentos) || [];
  return [];
}

export function arvoreHeranca(dados) {
  return (dados && dados.heritageTree && dados.heritageTree.nos) || [];
}

// --- Concessão de pontos --------------------------------------------------

// Chamado uma vez por nível novo alcançado (ver ganharXP em CharacterFactory.js
// e o loop de fim de batalha em BattleUI.js: `subiuNivel.forEach(novoNivel =>
// concederPontosPorNivel(membro, novoNivel))`). Funciona igual pro
// personagem principal e pra qualquer convocado do gacha (ambos têm
// classeId + nivel no mesmo formato).
export function concederPontosPorNivel(personagem, novoNivel) {
  const ch = garantirEstadoCaminho(personagem);
  ch.pontosClasse += 1;
  if (novoNivel === NIVEL_ESCOLHA_SUBCLASSE && !ch.subclasseId) {
    // O PONTO de subclasse é concedido aqui; a ESCOLHA em si (qual
    // subclasse) é decidida pelo jogador via escolherSubclasse() — só
    // ganhar o nível não escolhe nada sozinho.
    ch.pontosSubclasse += 1;
    ch.marcosSubclasseConcedidos.push(novoNivel);
  } else if (MARCOS_PONTO_SUBCLASSE.includes(novoNivel) && ch.subclasseId && !ch.marcosSubclasseConcedidos.includes(novoNivel)) {
    ch.pontosSubclasse += 1;
    ch.marcosSubclasseConcedidos.push(novoNivel);
  }
  return ch;
}

// Herança NUNCA vem de nível — só de eventos narrativos reais (ver
// gatilhos concretos já ligados em BattleUI.js/AwakeningUI.js). `origem` é
// um registro legível do que causou o ponto, guardado pra auditoria/relatório
// final (task #98) — nunca usado pra lógica de jogo.
export function concederPontoHeranca(personagem, origem) {
  const ch = garantirEstadoCaminho(personagem);
  ch.pontosHeranca += 1;
  ch.registroPontosHeranca = ch.registroPontosHeranca || [];
  ch.registroPontosHeranca.push({ origem, nivelNaEpoca: personagem.nivel });
  return ch;
}

// --- Subclasse -------------------------------------------------------------

export function subclassesDisponiveis(personagem, dados) {
  return ((dados && dados.subclasses && dados.subclasses.subclasses) || []).filter((s) => s.classeId === personagem.classeId);
}

export function escolherSubclasse(personagem, subclasseId, dados) {
  const ch = garantirEstadoCaminho(personagem);
  if (ch.subclasseId) return { ok: false, motivo: "já tem subclasse escolhida" };
  const opcao = subclassesDisponiveis(personagem, dados).find((s) => s.id === subclasseId);
  if (!opcao) return { ok: false, motivo: "subclasse inválida pra essa classe" };
  if (personagem.nivel < (opcao.nivelRequerido || NIVEL_ESCOLHA_SUBCLASSE)) return { ok: false, motivo: "nível insuficiente" };
  ch.subclasseId = subclasseId;
  return { ok: true };
}

// --- Talentos (classe/subclasse) e Herança, mesmo motor para os dois -------
// `lista` é a árvore relevante (arvoreDoPersonagem() para talento normal,
// arvoreHeranca() para um nó de herança) — quem chama decide qual.

function grupoJaEscolhido(personagem, node, lista) {
  if (!node.grupoExclusivo) return null;
  const ativos = new Set(talentosAtivos(personagem));
  return lista.find((n) => n.grupoExclusivo === node.grupoExclusivo && n.id !== node.id && ativos.has(n.id)) || null;
}

function prerequisitosAtendidos(personagem, node) {
  if (!node.requer || !node.requer.length) return true;
  const ativos = new Set(talentosAtivos(personagem));
  return node.requer.every((id) => ativos.has(id));
}

// Gatilhos narrativos de herança (task #92 — hoje cobre os 3 tipos já com
// dado real no jogo; novos tipos podem ser adicionados aqui sem mudar
// nenhum nó já salvo, já que o gatilho é reavaliado toda vez, nunca gravado).
// `contexto` é opcional e traz funções de leitura de outros sistemas (pra
// não criar dependência circular importando CompendiumSystem/WorldStateSystem
// direto neste arquivo) — ver TalentSystem.contexto em main.js.
export function atendeGatilhoHeranca(personagem, node, contexto = {}) {
  const g = node.gatilho;
  if (!g) return true; // nó de herança sem gatilho = sempre disponível (raro, mas válido)
  if (g.tipo === "chefeDerrotado") return !!(contexto.totalAbates && contexto.totalAbates(personagem, g.monstroId) > 0);
  if (g.tipo === "reputacaoFaccao") return !!(contexto.getReputacao && contexto.getReputacao(personagem, g.facaoId) >= g.minimo);
  if (g.tipo === "armaSecretaDespertada") return !!(personagem.caminhoHerdeiro?.registroPontosHeranca || []).some((r) => r.origem && r.origem.tipo === "arma_secreta_despertada" && (!g.rosterId || r.origem.rosterId === g.rosterId));
  return true;
}

// Retorna { disponiveis, bloqueados } avaliando toda a `lista` de uma vez —
// usado pela UI (task #95) pra saber o que mostrar clicável vs. acinzentado,
// sem duplicar essas mesmas regras na camada visual.
export function avaliarArvore(personagem, lista, { heranca = false, contexto = {} } = {}) {
  const ch = garantirEstadoCaminho(personagem);
  const ativos = new Set(talentosAtivos(personagem));
  const disponiveis = [];
  const bloqueados = [];
  for (const node of lista) {
    if (ativos.has(node.id)) continue; // já escolhido, nem entra nas duas listas
    const motivos = [];
    if (personagem.nivel < (node.nivelMinimo || 1)) motivos.push("nível insuficiente");
    // Talento restrito a UMA subclasse (ver subclasses.json/talentsGuerreiro.json)
    // só fica disponível pra quem já escolheu exatamente essa subclasse —
    // sem isso, um talento "de Devastador" ficaria escolhível por qualquer
    // Guerreiro, o que quebraria a ideia de build = escolha de caminho.
    if (node.subclasseId && node.subclasseId !== ch.subclasseId) motivos.push("subclasse errada ou ainda não escolhida");
    if (!prerequisitosAtendidos(personagem, node)) motivos.push("pré-requisito não cumprido");
    const conflito = grupoJaEscolhido(personagem, node, lista);
    if (conflito) motivos.push(`exclusivo com "${conflito.nome}"`);
    if (heranca && !atendeGatilhoHeranca(personagem, node, contexto)) motivos.push("evento narrativo ainda não aconteceu");
    const custo = node.custo || 1;
    const pontosDisponiveis = heranca ? ch.pontosHeranca : node.tipoPonto === "subclasse" ? ch.pontosSubclasse : ch.pontosClasse;
    if (pontosDisponiveis < custo) motivos.push("pontos insuficientes");
    if (motivos.length) bloqueados.push({ node, motivos });
    else disponiveis.push(node);
  }
  return { disponiveis, bloqueados };
}

// Efeitos que já têm consumidor real hoje: bonusAtributo (agregado por
// bonusCaminhoHerdeiro, ver mais abaixo) e concedeHabilidade (empurra
// direto pra `personagem.habilidades`, mesmo padrão de aplicarEscolhaArvore
// em CharacterFactory.js). Outros `tipo` de efeito (aplicaEstado, proc,
// transformação, etc. — ver o resto do pedido do usuário) ficam pra quando
// as árvores de verdade forem escritas (#93/#94): a função já aceita
// qualquer `node.efeito`, só ainda não faz nada de especial com tipos que
// não sejam esses dois — não quebra, só não tem efeito mecânico ainda.
function aplicarEfeitoImediato(personagem, node, dados) {
  if (node.efeito && node.efeito.tipo === "concedeHabilidade" && node.efeito.habilidade) {
    const jaTem = personagem.habilidades.some((h) => h.id === node.efeito.habilidade.id);
    if (!jaTem) personagem.habilidades.push({ ...node.efeito.habilidade, cooldownAtual: 0 });
  }
  if (dados) {
    personagem.hpMax = calcularHpMax(personagem, dados);
    personagem.mpMax = calcularMpMax(personagem, dados);
    personagem.hp = Math.min(personagem.hpMax, personagem.hp);
    personagem.mp = Math.min(personagem.mpMax, personagem.mp);
  }
}

// `heranca=true` escolhe um nó de HERANÇA (gasta pontosHeranca, some pra
// SEMPRE, nunca entra em nenhum preset, precisa do gatilho narrativo
// atendido); `heranca=false` (padrão) escolhe um talento normal de
// classe/subclasse (gasta a moeda que o próprio nó declarar em
// `tipoPonto`, entra no preset ATIVO — respecável depois via
// resetarTalentos).
export function escolherTalento(personagem, talentoId, lista, dados, { heranca = false, contexto = {} } = {}) {
  const ch = garantirEstadoCaminho(personagem);
  const node = lista.find((n) => n.id === talentoId);
  if (!node) return { ok: false, motivo: "talento inexistente" };
  const { disponiveis } = avaliarArvore(personagem, lista, { heranca, contexto });
  if (!disponiveis.some((n) => n.id === talentoId)) return { ok: false, motivo: "não disponível agora" };
  const custo = node.custo || 1;
  if (heranca) {
    ch.pontosHeranca -= custo;
    ch.heranca.push({ id: talentoId, origem: node.gatilho || null, nivelNaEpoca: personagem.nivel });
  } else {
    const moeda = node.tipoPonto === "subclasse" ? "pontosSubclasse" : "pontosClasse";
    ch[moeda] -= custo;
    presetAtivo(personagem).talentosEscolhidos.push(talentoId);
  }
  aplicarEfeitoImediato(personagem, node, dados);
  return { ok: true, node };
}

// Respec (regra explícita do usuário: classe/subclasse pode, herança NUNCA).
// Devolve os pontos gastos nos talentos do PRESET ATIVO (soma o `custo` de
// cada um, olhando a árvore pra saber a moeda certa de cada id) e limpa só
// esse preset — os outros dois presets e a herança inteira ficam intactos.
export function resetarTalentos(personagem, lista) {
  const ch = garantirEstadoCaminho(personagem);
  const preset = presetAtivo(personagem);
  for (const id of preset.talentosEscolhidos) {
    const node = lista.find((n) => n.id === id);
    const custo = (node && node.custo) || 1;
    if (node && node.tipoPonto === "subclasse") ch.pontosSubclasse += custo;
    else ch.pontosClasse += custo;
  }
  preset.talentosEscolhidos = [];
  return { ok: true };
}

// --- Presets -----------------------------------------------------------

export function renomearPreset(personagem, indice, nome) {
  const ch = garantirEstadoCaminho(personagem);
  if (indice < 0 || indice > 2 || !nome || !nome.trim()) return { ok: false };
  ch.presets[indice].nome = nome.trim().slice(0, 24);
  return { ok: true };
}

// Troca qual preset está ativo — NÃO reaplica habilidades concedidas por
// talento automaticamente hoje (task #92 é só a arquitetura; a UI de #95 e
// as árvores de #93/#94 vão decidir como isso deve ficar visualmente
// consistente na hora de trocar em campo). O que já é seguro e correto
// desde já: `bonusCaminhoHerdeiro` sempre lê do preset ATIVO, então stats
// (atributos/HP/MP/defesa) ficam corretos assim que troca.
export function alternarPreset(personagem, indice) {
  const ch = garantirEstadoCaminho(personagem);
  if (indice < 0 || indice > 2) return { ok: false };
  ch.presetAtivo = indice;
  return { ok: true };
}

// --- Agregação de bônus mecânico ----------------------------------------
// Mesmo formato de bonusArvore/bonusAfinidade/bonusVinculo/bonusConjunto em
// CharacterFactory.js, pra poder entrar em bonusTotal() como uma 5ª fonte
// somada campo a campo — ver import lá.
export function bonusCaminhoHerdeiro(personagem, dados) {
  const bonus = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };
  if (!personagem.caminhoHerdeiro) return bonus; // save antigo/personagem sem estado ainda — no-op total
  const arvore = arvoreDoPersonagem(personagem, dados);
  const heranca = arvoreHeranca(dados);
  const ids = talentosAtivos(personagem);
  for (const id of ids) {
    const node = arvore.find((n) => n.id === id) || heranca.find((n) => n.id === id);
    if (node && node.efeito && node.efeito.tipo === "bonusAtributo" && node.efeito.atributo in bonus) {
      bonus[node.efeito.atributo] += node.efeito.valor;
    }
  }
  return bonus;
}
