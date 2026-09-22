// Encantamento/aprimoramento de equipamento (melhoria de jogabilidade
// pós-backlog original): gasta ouro + materiais (minério, gema, os drops
// exclusivos de chefe já existem no inventário como "material" comum, ver
// task #45) pra subir o poder de um item já forjado/encontrado, em vez de
// só trocar por um item melhor. Funciona tanto com o item equipado quanto
// ainda no inventário — encontra pelo mesmo `uid` usado no resto do jogo.
//
// Guarda um snapshot do valor ORIGINAL (danoBase/defesaBase/bonusAtributoBase)
// na primeira vez que o item é aprimorado, e recalcula o valor atual a
// partir dele a cada nível — assim nunca acumula erro de arredondamento
// aplicando percentual em cima de percentual. Usa Math.ceil (nunca
// Math.round) pra garantir que mesmo um item com stat base baixo (ex.:
// defesa 2) sinta um ganho visível a cada nível — mesma lição aprendida no
// reforço de monstro solo (task #46).
import { contarItem, removerPorId } from "./InventorySystem.js";
import { ehMarco, candidatosDoMarco, aplicarSubStatus } from "./SubStatusSystem.js";
import { multCustoForja } from "./IdentidadeSystem.js";

// O teto subiu de +5 para +10 (decisão do jogador). Motivo de design: com
// sub-status a cada 2 níveis, cinco marcos (+2, +4, +6, +8, +10) dão ao item
// uma história própria — a mesma espada vira cinco itens diferentes ao longo
// da campanha. Com o teto antigo seriam só dois marcos, e o aprimoramento
// continuaria sendo uma escada curta.
export const MAX_NIVEL_APRIMORAMENTO = 10;
export const GANHO_POR_NIVEL = 0.08; // +8% do stat base por nível, cumulativo a partir do original

// Custo pra ir do nível atual (índice) pro próximo. CUSTO_POR_NIVEL[0] =
// custo de +0 -> +1, [9] = custo de +9 -> +10 (máximo).
//
// A curva dos cinco primeiros é a original, intocada: um save no meio do
// caminho não vê preço mudar. Do +6 em diante ela cresce mais rápido (cada
// nível custa ~1,7x o anterior) porque esses níveis carregam os marcos de
// sub-status — são a parte cara do item de propósito, e o material raro é o
// que dá peso à escolha de QUAL item levar até o fim.
export const CUSTO_POR_NIVEL = [
  { ouro: 5, materiais: [{ itemId: "minerio", quantidade: 1 }] },
  { ouro: 10, materiais: [{ itemId: "minerio", quantidade: 1 }, { itemId: "madeira", quantidade: 1 }] },
  { ouro: 18, materiais: [{ itemId: "minerio", quantidade: 2 }] },
  { ouro: 30, materiais: [{ itemId: "minerio_raro", quantidade: 1 }, { itemId: "gema", quantidade: 1 }] },
  { ouro: 45, materiais: [{ itemId: "minerio_raro", quantidade: 1 }, { itemId: "gema", quantidade: 1 }] },
  { ouro: 70, materiais: [{ itemId: "minerio_raro", quantidade: 2 }, { itemId: "gema", quantidade: 1 }] },
  { ouro: 105, materiais: [{ itemId: "minerio_raro", quantidade: 2 }, { itemId: "erva_rara", quantidade: 1 }] },
  { ouro: 150, materiais: [{ itemId: "minerio_raro", quantidade: 3 }, { itemId: "gema_rara", quantidade: 1 }] },
  { ouro: 220, materiais: [{ itemId: "minerio_raro", quantidade: 3 }, { itemId: "gema_rara", quantidade: 2 }] },
  { ouro: 320, materiais: [{ itemId: "minerio_raro", quantidade: 4 }, { itemId: "gema_rara", quantidade: 2 }] },
];

// Só arma/armadura/acessório têm um stat pra escalar — consumíveis e
// materiais nunca aparecem aqui (nem equipados, nem no inventário).
export function itemPodeSerAprimorado(item) {
  return !!item && ["arma", "armadura", "acessorio"].includes(item.tipo);
}

export function nivelAprimoramento(item) {
  return (item && item.aprimoramento) || 0;
}

// null quando já está no nível máximo (nada mais pra comprar). Com
// `personagem`, o ouro já vem com os descontos da identidade do herói —
// interesse Artesanato (−10%) e a combinação Sangue da Forja (−15%), ver
// IdentidadeSystem.multCustoForja. Materiais não têm desconto.
export function custoProximoNivel(item, personagem = null) {
  const nivel = nivelAprimoramento(item);
  if (nivel >= MAX_NIVEL_APRIMORAMENTO) return null;
  const base = CUSTO_POR_NIVEL[nivel];
  const mult = personagem ? multCustoForja(personagem) : 1;
  if (mult === 1) return base;
  // Arredonda para BAIXO: no nível mais barato (5 de ouro) um arredondamento
  // comum comeria o desconto inteiro, e o jogador não veria a escolha valer.
  return { ...base, ouro: Math.max(1, Math.floor(base.ouro * mult)), ouroSemDesconto: base.ouro };
}

export function podeAprimorar(personagem, item) {
  if (!itemPodeSerAprimorado(item)) return { ok: false, msg: "Este item não pode ser aprimorado." };
  const custo = custoProximoNivel(item, personagem);
  if (!custo) return { ok: false, msg: "Item já está no nível máximo de aprimoramento (+" + MAX_NIVEL_APRIMORAMENTO + ")." };
  if (personagem.ouro < custo.ouro) return { ok: false, msg: "Ouro insuficiente." };
  const faltando = custo.materiais.filter((m) => contarItem(personagem, m.itemId) < m.quantidade);
  if (faltando.length) return { ok: false, msg: "Materiais insuficientes." };
  return { ok: true, custo };
}

// Acha o item pelo uid tanto no inventário quanto nos slots de equipamento
// (um item aprimorável só pode estar em um dos dois lugares por vez).
export function encontrarItemPorUid(personagem, uid) {
  const noInventario = personagem.inventario.find((i) => i.uid === uid);
  if (noInventario) return noInventario;
  for (const slot of Object.keys(personagem.equipamento)) {
    const equipado = personagem.equipamento[slot];
    if (equipado && equipado.uid === uid) return equipado;
  }
  return null;
}

function recalcularStats(item, novoNivel) {
  const mult = 1 + GANHO_POR_NIVEL * novoNivel;
  if (typeof item.dano === "number") {
    if (item.danoBase === undefined) item.danoBase = item.dano;
    item.dano = Math.ceil(item.danoBase * mult);
  }
  if (typeof item.defesa === "number") {
    if (item.defesaBase === undefined) item.defesaBase = item.defesa;
    item.defesa = Math.ceil(item.defesaBase * mult);
  }
  if (item.bonusAtributo && typeof item.bonusAtributo === "object") {
    if (!item.bonusAtributoBase) item.bonusAtributoBase = { ...item.bonusAtributo };
    Object.keys(item.bonusAtributoBase).forEach((attr) => {
      item.bonusAtributo[attr] = Math.ceil(item.bonusAtributoBase[attr] * mult);
    });
  }
  if (!item.nomeBase) item.nomeBase = item.nome;
  item.nome = `${item.nomeBase} +${novoNivel}`;
}

// Aprimora o item de `uid` em 1 nível, consumindo ouro + materiais. Muta o
// item em-lugar (o mesmo objeto continua equipado/no inventário depois),
// então nenhum outro sistema (equipar, defesaTotal, ataqueBase) precisa
// saber que aprimoramento existe — eles já leem item.dano/item.defesa
// diretamente.
export function aprimorarItem(personagem, uid) {
  const item = encontrarItemPorUid(personagem, uid);
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const checagem = podeAprimorar(personagem, item);
  if (!checagem.ok) return checagem;

  const { custo } = checagem;
  personagem.ouro -= custo.ouro;
  custo.materiais.forEach((m) => removerPorId(personagem, m.itemId, m.quantidade));

  const novoNivel = nivelAprimoramento(item) + 1;
  item.aprimoramento = novoNivel;
  recalcularStats(item, novoNivel);

  // MARCO DE SUB-STATUS (+2, +4, +6, +8, +10). O nível já está gravado e o
  // stat já subiu; o que falta é a ESCOLHA, e ela não acontece aqui — esta
  // função é pura e roda em teste sem navegador. Devolve os três candidatos
  // para a UI apresentar, e `escolherSubStatusDoMarco` grava a decisão.
  //
  // Um item que ficou com marco pendente (o jogador fechou a forja no meio)
  // não fica quebrado: `marcoPendente` sobrevive no save, e a forja o oferece
  // de novo na próxima vez. Perder um sub-status pago seria imperdoável.
  const resultado = { ok: true, item, novoNivel, marco: null };
  if (ehMarco(novoNivel)) {
    const candidatos = candidatosDoMarco(item, novoNivel);
    item.marcoPendente = { nivel: novoNivel, candidatos };
    resultado.marco = { nivel: novoNivel, candidatos };
  }
  return resultado;
}

// Grava a escolha do marco. Separada de `aprimorarItem` porque acontece num
// segundo momento (depois de o jogador olhar as três opções), e porque assim
// é testável sem simular clique.
export function escolherSubStatusDoMarco(personagem, uid, idEscolhido) {
  const item = encontrarItemPorUid(personagem, uid);
  if (!item || !item.marcoPendente) return { ok: false, msg: "Nenhuma escolha pendente neste item." };
  const escolha = (item.marcoPendente.candidatos || []).find((c) => c.id === idEscolhido);
  if (!escolha) return { ok: false, msg: "Opção inválida." };
  aplicarSubStatus(item, escolha);
  delete item.marcoPendente;
  return { ok: true, item, escolha };
}

// Um item com marco pendente é o que a forja precisa resolver antes de deixar
// o jogador aprimorar de novo — senão dá para acumular escolhas e perder o
// fio de qual pertence a qual nível.
export const temMarcoPendente = (item) => !!(item && item.marcoPendente);

export function itensComMarcoPendente(personagem) {
  const lista = [];
  (personagem.inventario || []).forEach((i) => { if (temMarcoPendente(i)) lista.push(i); });
  Object.values(personagem.equipamento || {}).forEach((i) => { if (temMarcoPendente(i)) lista.push(i); });
  return lista;
}
