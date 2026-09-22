// IDENTIDADE DO HERÓI — o que cada escolha da criação de personagem faz no
// jogo, num lugar só.
//
// Antes deste módulo, três das nove etapas da criação (elemento, motivação e
// interesses) eram gravadas no save e nenhum sistema lia; a facção de origem
// virava só a afiliação inicial, trocável de graça. Aqui ficam os números e
// as regras dessas escolhas, e os textos que a tela de criação mostra — o
// card e o motor leem a MESMA tabela, então o que o card promete é o que o
// jogo faz.
//
// Quem consome:
//   CombatSystem   — essência/sintonia elemental, ambiente afim, sopro,
//                    motivações de combate (justiça, liberdade, redenção)
//   CharacterFactory — magia inicial no elemento, reputação e emblema de origem
//   BattleUI       — XP de batalha (combate, poder)
//   main.js / QuestSystem / EnchantSystem / WorldStateSystem — os bônus fora
//                    da batalha (descoberta, legado, interesses)
//   CharacterCreationUI — os textos dos cards e o resumo da revisão
import { relacaoElemental } from "./ElementSystem.js";

// --- Elemento ---------------------------------------------------------------

// ESSÊNCIA: golpe do próprio elemento bate mais forte; golpe desse elemento
// contra o herói bate mais fraco.
export const ESSENCIA_ATAQUE = 1.15;
export const ESSENCIA_DEFESA = 0.85;
// SINTONIA: o golpe FÍSICO do herói explora a fraqueza do alvo ao elemento
// dele. Só soma, nunca tira — escolher um elemento não pode deixar a espada
// mais fraca contra ninguém. O Arcano não é forte contra nada na matriz; em
// troca, a sintonia dele vale um pouco contra qualquer alvo.
export const SINTONIA_FISICA = { vantagem: 1.15, vantagem_intensa: 1.25 };
export const SINTONIA_UNIVERSAL = { arcano: 1.08 };
// AMBIENTE AFIM: lutar num terreno ou clima do próprio elemento.
export const AMBIENTE_AFIM = { terreno: { defesa: 0.10, mp: 2 }, clima: { defesa: 0.05, mp: 1 } };
// Sopro do Draconato: chance de deixar o estado do elemento em cada inimigo.
export const CHANCE_ESTADO_SOPRO = 0.35;

// A magia de dano que cada classe mágica recebe na criação segue o elemento
// escolhido. Mesmo custo, recarga e multiplicador; mudam nome, elemento e
// texto. O id continua o da classe (bola_de_fogo, luz_sagrada) — nenhum
// sistema guarda referência por nome.
const MAGIA_DO_MAGO = {
  fogo: "Bola de Fogo", gelo: "Lança de Gelo", agua: "Maré Cortante", raio: "Relâmpago",
  vento: "Lâmina de Vento", terra: "Estilhaço de Pedra", natureza: "Chicote de Espinhos",
  radiante: "Lança de Luz", sombrio: "Dardo Sombrio", arcano: "Míssil Arcano",
};
const MAGIA_DO_CLERIGO = {
  radiante: "Luz Sagrada", sombrio: "Julgamento Sombrio", fogo: "Chama Purificadora",
  gelo: "Geada Sagrada", agua: "Onda Sagrada", raio: "Trovão Divino", vento: "Sopro Divino",
  terra: "Punho da Terra", natureza: "Bênção de Espinhos", arcano: "Selo Arcano",
};
export const MAGIAS_QUE_SEGUEM_O_ELEMENTO = { bola_de_fogo: MAGIA_DO_MAGO, luz_sagrada: MAGIA_DO_CLERIGO };

const NOME_DO_ELEMENTO = {
  fogo: "fogo", gelo: "gelo", agua: "água", raio: "raio", vento: "vento", terra: "terra",
  natureza: "natureza", radiante: "luz radiante", sombrio: "sombra", arcano: "energia arcana",
};

export function habilidadeNoElemento(habilidade, elementoId) {
  const tabela = habilidade && MAGIAS_QUE_SEGUEM_O_ELEMENTO[habilidade.id];
  if (!tabela || !elementoId || !tabela[elementoId]) return habilidade;
  const extra = habilidade.id === "luz_sagrada" ? " Dano extra contra mortos-vivos." : "";
  return {
    ...habilidade,
    nome: tabela[elementoId],
    elemento: elementoId,
    descricao: `Dano mágico de ${NOME_DO_ELEMENTO[elementoId]} em um alvo, pela Inteligência.${extra}`,
  };
}

// Troca, no personagem, as magias que seguem o elemento. Idempotente: rodar
// de novo num herói já convertido não muda nada.
export function aplicarElementoNasHabilidades(personagem) {
  if (!personagem || !personagem.elementoId || !Array.isArray(personagem.habilidades)) return false;
  let mudou = false;
  personagem.habilidades = personagem.habilidades.map((h) => {
    const nova = habilidadeNoElemento(h, personagem.elementoId);
    if (nova !== h && (nova.nome !== h.nome || nova.elemento !== h.elemento)) mudou = true;
    return nova;
  });
  return mudou;
}

// Multiplicador de dano que vem da identidade de quem bate e de quem apanha.
// `fisico`: o golpe é do motor físico (ataque básico e habilidades físicas),
// que é onde a sintonia vale. Devolve também os selos que a tela cola no
// número — [texto, tom, multiplicador].
export function multiplicadorIdentidade(atacante, alvo, elemento, dadosElementos, { fisico = false } = {}) {
  let mult = 1;
  const selos = [];
  const elem = elemento || "fisico";
  if (atacante && atacante.elementoAfinidade) {
    if (elem === atacante.elementoAfinidade) {
      mult *= ESSENCIA_ATAQUE;
      selos.push(["ESSÊNCIA", "bom", ESSENCIA_ATAQUE]);
    } else if (fisico && elem === "fisico" && alvo) {
      const universal = SINTONIA_UNIVERSAL[atacante.elementoAfinidade];
      const relacao = relacaoElemental(atacante.elementoAfinidade, alvo.elemento || "fisico", dadosElementos);
      const m = SINTONIA_FISICA[relacao] || (universal && relacao !== "imune" ? universal : null);
      if (m) {
        mult *= m;
        selos.push(["SINTONIA", "bom", m]);
      }
    }
  }
  if (alvo && alvo.elementoAfinidade && elem === alvo.elementoAfinidade) {
    mult *= ESSENCIA_DEFESA;
    selos.push(["ESSÊNCIA", "bom", ESSENCIA_DEFESA]);
  }
  if (atacante && atacante.motivacaoId === "justica" && alvo && alvo.chefe) {
    mult *= MOTIVACOES.justica.valor;
    selos.push(["JUSTIÇA", "bom", MOTIVACOES.justica.valor]);
  }
  return { mult, selos };
}

// Ambiente afim: terreno/clima do elemento do herói.
export function ambienteAfim(elementoAfinidade, terrenoElemento, climaElemento) {
  if (!elementoAfinidade) return null;
  const r = { defesa: 0, mp: 0, fontes: [] };
  if (terrenoElemento && terrenoElemento === elementoAfinidade) {
    r.defesa += AMBIENTE_AFIM.terreno.defesa; r.mp += AMBIENTE_AFIM.terreno.mp; r.fontes.push("terreno");
  }
  if (climaElemento && climaElemento === elementoAfinidade) {
    r.defesa += AMBIENTE_AFIM.clima.defesa; r.mp += AMBIENTE_AFIM.clima.mp; r.fontes.push("clima");
  }
  return r.fontes.length ? r : null;
}

// Contra quem o elemento é forte/fraco, contando os tipos de criatura do
// bestiário — é o que o card do elemento mostra.
export function relacoesParaCard(elementoId, dadosElementos, monstros = []) {
  const matriz = dadosElementos && dadosElementos.matriz && dadosElementos.matriz[elementoId];
  if (!matriz) return { forte: [], fraco: [], criaturasFracas: 0 };
  const nome = (id) => ((dadosElementos.elementos || []).find((e) => e.id === id) || { nome: id }).nome;
  const forte = [...(matriz.forteIntensa || []), ...(matriz.forte || [])];
  const fraco = [...(matriz.fracoIntensa || []), ...(matriz.fraco || [])];
  const criaturasFracas = monstros.filter((m) => forte.includes(m.elemento)).length;
  return { forte: forte.map(nome), fraco: fraco.map(nome), criaturasFracas };
}

// --- Motivação e interesses ------------------------------------------------

export const MOTIVACOES = {
  descoberta: { valor: 3, efeito: "Cada lugar novo que você descobre rende XP e 3 Fragmentos de Aethra." },
  justica: { valor: 1.10, efeito: "+10% de dano contra chefes." },
  legado: { valor: 1.15, efeito: "+15% de ouro nas recompensas de missão." },
  liberdade: { valor: 0.15, efeito: "+15% de chance de fugir de uma batalha." },
  redencao: { valor: 1.15, efeito: "+15% de cura recebida, de habilidades e de poções." },
  poder: { valor: 0.15, efeito: "+15% de XP ao vencer inimigos de nível acima do seu." },
};

export const INTERESSES = {
  exploracao: { valor: 1.10, efeito: "+10% de Fragmentos de Aethra em baús e nós de recurso; o modo automático prefere lugares novos." },
  combate: { valor: 1.10, efeito: "+10% de XP de batalha." },
  magia: { valor: 0.90, efeito: "−10% no custo de MP das habilidades." },
  natureza: { valor: 0.10, efeito: "10% de chance de colher 1 a mais em cada nó de recurso; o modo automático prefere nós." },
  tesouros: { valor: 1.10, efeito: "+10% de ouro em baús; o modo automático prefere baús." },
  historias: { valor: 1.10, efeito: "+10% de XP nas recompensas de missão; o modo automático procura quem tem história para contar." },
  artesanato: { valor: 0.90, efeito: "−10% no ouro gasto para aprimorar equipamento." },
  diplomacia: { valor: 1.10, efeito: "+10% em toda reputação ganha." },
};

export const temMotivacao = (p, id) => !!p && p.motivacaoId === id;
export const temInteresse = (p, id) => !!p && Array.isArray(p.preferencias) && p.preferencias.includes(id);

export function multOuroMissao(p) { return temMotivacao(p, "legado") ? MOTIVACOES.legado.valor : 1; }
export function multXpMissao(p) { return temInteresse(p, "historias") ? INTERESSES.historias.valor : 1; }
export function multXpBatalha(p) { return temInteresse(p, "combate") ? INTERESSES.combate.valor : 1; }
export function multOuroBau(p) { return temInteresse(p, "tesouros") ? INTERESSES.tesouros.valor : 1; }
export function multFragmentosExploracao(p) { return temInteresse(p, "exploracao") ? INTERESSES.exploracao.valor : 1; }
export function chanceColheitaExtra(p) { return temInteresse(p, "natureza") ? INTERESSES.natureza.valor : 0; }
export function multCuraRecebida(p) { return temMotivacao(p, "redencao") ? MOTIVACOES.redencao.valor : 1; }
export function bonusChanceFuga(p) { return temMotivacao(p, "liberdade") ? MOTIVACOES.liberdade.valor : 0; }

// XP extra da motivação Poder: 15% do XP de cada inimigo acima do nível.
export function xpExtraPoder(p, inimigos = []) {
  if (!temMotivacao(p, "poder")) return 0;
  const nivel = p.nivel || 1;
  const acima = inimigos.filter((i) => (i.nivelMonstro || 0) > nivel).reduce((s, i) => s + (i.xp || 0), 0);
  return Math.round(acima * MOTIVACOES.poder.valor);
}

// Custo de MP com o interesse Magia (mínimo 1 quando a habilidade custa algo).
export function custoMPComInteresse(p, custo) {
  if (!custo || !temInteresse(p, "magia")) return custo || 0;
  return Math.max(1, Math.round(custo * INTERESSES.magia.valor));
}

// Ouro da forja: Artesanato e a combinação Sangue da Forja se somam.
export function multCustoForja(p) {
  let m = 1;
  if (temInteresse(p, "artesanato")) m *= INTERESSES.artesanato.valor;
  if (temCombinacao(p, "sangue_da_forja")) m *= 0.85;
  return m;
}

// Reputação GANHA com Diplomacia: +10%, arredondado para cima. Perda de
// reputação não é afetada.
export function ajustarGanhoReputacao(p, delta) {
  if (!(delta > 0) || !temInteresse(p, "diplomacia")) return delta;
  return Math.ceil(delta * INTERESSES.diplomacia.valor);
}

// Quanto cada interesse empurra a escolha do modo automático, por tipo de
// alvo (ver alvosAutoExploracao em main.js). Soma, nunca subtrai.
const PRIORIDADE_AUTO_POR_INTERESSE = {
  tesouros: { bau: 12 }, natureza: { no: 12 }, artesanato: { no: 6 },
  historias: { npc: 12 }, diplomacia: { npc: 8 }, exploracao: { explorar: 12 },
  magia: { explorar: 6 }, combate: { chefe: 8 },
};
export function bonusPrioridadeAuto(p, tipo) {
  if (!p || !Array.isArray(p.preferencias)) return 0;
  return p.preferencias.reduce((s, id) => s + ((PRIORIDADE_AUTO_POR_INTERESSE[id] || {})[tipo] || 0), 0);
}

// Descoberta: o que um lugar novo rende.
export function recompensaDescoberta(p) {
  if (!temMotivacao(p, "descoberta")) return null;
  return { xp: 5 + 3 * (p.nivel || 1), fragmentos: MOTIVACOES.descoberta.valor };
}

// --- Facção de origem --------------------------------------------------------

export const REPUTACAO_ORIGEM = 20;
export const CUSTO_TROCA_AFILIACAO = 10;

// Emblema da facção de origem: um amuleto com +1 no atributo do povo.
export const ATRIBUTO_DO_EMBLEMA = {
  guardioes_da_folha: "DES", cla_dos_ventos_dourados: "FOR", andarilhos_do_pantano: "CON",
  confraria_do_farol: "INT", caravana_de_karn: "DES", forja_dos_anoes_cinzentos: "CON",
  ordem_dos_arquivistas: "INT", cavaleiros_do_vento_uivante: "FOR", legiao_das_cinzas: "FOR",
  coroa_de_aethra: "CON",
};
export const idDoEmblema = (faccaoId) => `emblema_${faccaoId}`;

// Reputação inicial: +20 com a facção de origem e os extras das combinações.
// Aceita as escolhas da criação ou um personagem salvo.
export function reputacaoInicial(escolhasOuPersonagem) {
  const escolhas = normalizarEscolhas(escolhasOuPersonagem);
  const r = {};
  if (!escolhas.faccao) return r;
  r[escolhas.faccao] = REPUTACAO_ORIGEM;
  const combos = combinacoesDe(escolhas).map((c) => c.id);
  if (combos.includes("filho_da_floresta")) r.guardioes_da_folha = (r.guardioes_da_folha || 0) + 10;
  if (combos.includes("patente_da_coroa")) {
    r.coroa_de_aethra = (r.coroa_de_aethra || 0) + 10;
    r.vila = (r.vila || 0) + 10;
  }
  return r;
}

// --- Combinações -------------------------------------------------------------
// Pares de escolhas que rendem um efeito próprio. Mostradas na revisão da
// criação com o selo "✨ Combinação", no mesmo espírito do selo de afinidade
// raça + classe que já existia.
export const COMBINACOES = [
  { id: "sopro_incendiario", icone: "🔥", nome: "Sopro Incendiário", quando: { raca: "draconato", elemento: "fogo" },
    efeito: "O Sopro Elemental sempre deixa os inimigos Incendiados." },
  { id: "sangue_da_forja", icone: "⚒️", nome: "Sangue da Forja", quando: { raca: "anao", faccao: "forja_dos_anoes_cinzentos" },
    efeito: "−15% no ouro gasto para aprimorar equipamento." },
  { id: "filho_da_floresta", icone: "🌿", nome: "Filho da Floresta", quando: { raca: "elfo", faccao: "guardioes_da_folha" },
    efeito: "Começa com +10 de reputação extra com os Guardiões da Folha Verde." },
  { id: "brasa_da_legiao", icone: "🔥", nome: "Brasa da Legião", quando: { raca: "orc", faccao: "legiao_das_cinzas" },
    efeito: "A Fúria do Orc acende com HP em 40% ou menos, em vez de 30%." },
  { id: "mascate_de_karn", icone: "🐪", nome: "Mascate de Karn", quando: { raca: "halfling", faccao: "caravana_de_karn" },
    efeito: "−10% nos preços do mercador itinerante." },
  { id: "leitor_do_arquivo", icone: "📜", nome: "Leitor do Arquivo", quando: { antecedente: "sabio", faccao: "ordem_dos_arquivistas" },
    efeito: "O Códice libera 3 níveis mais cedo as entradas que pedem nível." },
  { id: "patente_da_coroa", icone: "👑", nome: "Patente da Coroa", quando: { antecedente: "soldado", faccao: "coroa_de_aethra" },
    efeito: "Começa com +10 de reputação extra com a Coroa de Aethra e com a Vila." },
  { id: "divida_antiga", icone: "⛓️", nome: "Dívida Antiga", quando: { antecedente: "criminoso", motivacao: "redencao" },
    efeito: "Sua missão pessoal de Redenção vira a história do seu passado no crime, com o ouro final dobrado." },
];

// Aceita tanto as escolhas da tela de criação ({ raca, elemento, ... })
// quanto um personagem salvo ({ racaId, elementoId, faccaoOrigemId, ... }).
function normalizarEscolhas(x) {
  if (!x) return {};
  return {
    raca: x.raca || x.racaId || null,
    classe: x.classe || x.classeId || null,
    elemento: x.elemento || x.elementoId || null,
    antecedente: x.antecedente || x.antecedenteId || null,
    traco: x.traco || x.tracoId || null,
    faccao: x.faccao || x.faccaoOrigemId || null,
    motivacao: x.motivacao || x.motivacaoId || null,
  };
}

export function combinacoesDe(escolhasOuPersonagem) {
  const e = normalizarEscolhas(escolhasOuPersonagem);
  return COMBINACOES.filter((c) => Object.entries(c.quando).every(([k, v]) => e[k] === v));
}

export function temCombinacao(p, id) {
  return combinacoesDe(p).some((c) => c.id === id);
}

export function limiarFuriaOrc(p) {
  return temCombinacao(p, "brasa_da_legiao") ? 0.4 : 0.3;
}

// --- Saves de antes desta mudança -----------------------------------------
// Um herói criado antes de as escolhas terem efeito recebe, UMA vez, o mesmo
// pacote de um herói novo: magia no elemento, reputação de origem (somada à
// que ele já tem) e o emblema da facção (vestido se o slot estiver livre;
// senão, na mochila). Devolve a lista do que mudou, para a tela avisar.
const uidNovo = () => "id_" + Math.random().toString(36).slice(2, 10);
export function aplicarIdentidadeRetroativa(personagem, dados) {
  if (!personagem || personagem.identidadeV2) return [];
  personagem.identidadeV2 = true;
  const ganhos = [];
  if (aplicarElementoNasHabilidades(personagem)) ganhos.push("magia no seu elemento");
  const rep = reputacaoInicial(personagem);
  if (Object.keys(rep).length) {
    if (!personagem.estadoDoMundo) personagem.estadoDoMundo = { reputacao: {}, flags: {} };
    if (!personagem.estadoDoMundo.reputacao) personagem.estadoDoMundo.reputacao = {};
    const reputacao = personagem.estadoDoMundo.reputacao;
    Object.entries(rep).forEach(([faccaoId, valor]) => {
      reputacao[faccaoId] = Math.min(100, (reputacao[faccaoId] || 0) + valor);
    });
    ganhos.push("reputação com o seu povo");
  }
  const itens = (dados && dados.items && dados.items.itens) || [];
  const emblema = personagem.faccaoOrigemId ? itens.find((i) => i.id === idDoEmblema(personagem.faccaoOrigemId)) : null;
  if (emblema) {
    const copia = { ...emblema, uid: uidNovo() };
    if (personagem.equipamento && !personagem.equipamento.amuleto) personagem.equipamento.amuleto = copia;
    else (personagem.inventario || (personagem.inventario = [])).push(copia);
    ganhos.push(emblema.nome);
  }
  return ganhos;
}
