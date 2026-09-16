// NPCs REGIONAIS IMPORTANTES (ETAPA 3, itens 1 a 11).
//
// O QUE FOI PRESERVADO
// --------------------
// Os cinco NPCs que já existiam (npc_fazendeiro, npc_cacador, npc_anciao,
// npc_guarda, npc_mercador) continuam em src/data/npcs.json, com os MESMOS
// ids, os MESMOS nomes e os MESMOS diálogos. Nada aqui os renomeia, apaga,
// duplica ou substitui. O que este módulo faz por eles é dar-lhes ficha
// completa e um lugar de verdade no mapa (altaverde.js), porque até agora
// eles eram encaixados em "vagas" ao redor da praça — moravam num índice de
// array, não numa geografia.
//
// O QUE ESTE MÓDULO NÃO É
// -----------------------
// Não é um segundo cadastro de personagem jogável. Os 100 convocados do
// gacha continuam em gachaRoster.json, com nome, classe, raça, facção e
// habilidade intocados. Alguns deles aparecem no mundo como NPC — e quando
// aparecem, o NPC aponta para o roster por `gachaId` em vez de copiar os
// dados. Um personagem, um cadastro.
//
// FICHA (item 5) — todo NPC importante declara os 24 campos:
//   id, nome, regiaoId, local, papel, profissao, faccaoId, aparencia,
//   silhueta, personalidade, fala, motivacao, medo, objetivo, segredo,
//   relacoes, rotina, questId, reacaoAoJogador, reacaoAReputacao, estados,
//   servicos, lore, estadoInicial
//
// Campos opcionais: `gachaId` (item 2), `recorrente` (item 11), `requisito`
// (item 32: NPC que só aparece sob condição), `ensina` (itens 29 e 31).
//
// O teste (scripts/test-npcs-etapa3.mjs) cobra os 24 campos preenchidos, ids
// únicos, `local` existente na geografia da ETAPA 2, `faccaoId` existente,
// `questId` existente, relações apontando para NPCs reais e — o item 41 —
// que nenhum NPC seja casca vazia só pra fechar conta.
import { NPCS_ALTAVERDE } from "./altaverde.js";
import { NPCS_MORRANVELL } from "./morranvell.js";
import { NPCS_VALE_DO_VENTO } from "./valeDoVento.js";
import { NPCS_BOSQUE_ETERNO } from "./bosqueEterno.js";
import { NPCS_RUINAS_DE_AETHRA } from "./ruinasDeAethra.js";
import { NPCS_CANON_RUBRO } from "./canonRubro.js";
import { NPCS_LAGO_PRISMATICO } from "./lagoPrismatico.js";
import { NPCS_COSTA_DA_MARE } from "./costaDaMare.js";
import { NPCS_RECIFE_CORALINO } from "./recifeCoralino.js";
import { NPCS_PANTANO_DE_THALGOR } from "./pantanoDeThalgor.js";
import { NPCS_SELVA_UMBRIACA } from "./selvaUmbriaca.js";
import { NPCS_VALE_DOS_TITAS } from "./valeDosTitas.js";
import { NPCS_DESERTO_DE_ARENTH } from "./desertoDeArenth.js";
import { NPCS_SOMBRALITH } from "./sombralith.js";
import { NPCS_ARQUIPELAGO_DE_NUVENS } from "./arquipelagoDeNuvens.js";
import { NPCS_MONTANHAS_DE_VULKOR } from "./montanhasDeVulkor.js";
import { NPCS_ABISMO_DE_NAZTHAL } from "./abismoDeNazthal.js";

export const CAMPOS_DA_FICHA = [
  "id", "nome", "regiaoId", "local", "papel", "profissao", "faccaoId",
  "aparencia", "silhueta", "personalidade", "fala", "motivacao", "medo",
  "objetivo", "segredo", "relacoes", "rotina", "questId", "reacaoAoJogador",
  "reacaoAReputacao", "estados", "servicos", "lore", "estadoInicial",
];

// Arquétipos de papel do item 4. Nenhuma região usa a lista inteira nem a
// mesma combinação — o teste cobra que não exista fórmula repetida.
export const PAPEIS = {
  AUTORIDADE: "autoridade",
  FACCAO: "representante de facção",
  ARTESAO: "artesão",
  SABIO: "historiador/sábio",
  EXPLORADOR: "explorador",
  CONFLITO: "ligado ao conflito",
  MISTERIOSO: "misterioso",
  CIDADAO: "cidadão memorável",
};

export const NPCS_POR_REGIAO = {
  altaverde: NPCS_ALTAVERDE,
  morranvell: NPCS_MORRANVELL,
  vale_do_vento: NPCS_VALE_DO_VENTO,
  bosque_eterno: NPCS_BOSQUE_ETERNO,
  ruinas_de_aethra: NPCS_RUINAS_DE_AETHRA,
  canon_rubro: NPCS_CANON_RUBRO,
  lago_prismatico: NPCS_LAGO_PRISMATICO,
  costa_da_mare: NPCS_COSTA_DA_MARE,
  recife_coralino: NPCS_RECIFE_CORALINO,
  pantano_de_thalgor: NPCS_PANTANO_DE_THALGOR,
  selva_umbriaca: NPCS_SELVA_UMBRIACA,
  vale_dos_titas: NPCS_VALE_DOS_TITAS,
  deserto_de_arenth: NPCS_DESERTO_DE_ARENTH,
  sombralith: NPCS_SOMBRALITH,
  arquipelago_de_nuvens: NPCS_ARQUIPELAGO_DE_NUVENS,
  montanhas_de_vulkor: NPCS_MONTANHAS_DE_VULKOR,
  abismo_de_nazthal: NPCS_ABISMO_DE_NAZTHAL,
};

export const NPCS_REGIONAIS = Object.values(NPCS_POR_REGIAO).flat();

const POR_ID = new Map(NPCS_REGIONAIS.map((n) => [n.id, n]));
export const npcPorId = (id) => POR_ID.get(id) || null;
export const npcsDaRegiao = (regiaoId) => NPCS_POR_REGIAO[regiaoId] || [];
export const npcsDoLocal = (localId) => NPCS_REGIONAIS.filter((n) => n.local === localId);

// NPCs que reaparecem fora da região natal (item 11). `recorrente` lista os
// outros locais em que a mesma pessoa pode ser encontrada — é a mesma
// pessoa, com o mesmo id e a mesma memória, não uma cópia.
export const NPCS_RECORRENTES = NPCS_REGIONAIS.filter((n) => Array.isArray(n.recorrente) && n.recorrente.length > 0);

// NPCs que exigem condição pra aparecer (item 32).
export const NPCS_SECRETOS = NPCS_REGIONAIS.filter((n) => n.requisito);

// NPCs que ensinam alguma coisa (itens 29 e 31).
export const NPCS_MESTRES = NPCS_REGIONAIS.filter((n) => n.ensina);

// NPCs que são um convocado do gacha presente no mundo (item 2).
export const NPCS_DO_GACHA = NPCS_REGIONAIS.filter((n) => n.gachaId);
