// CARTÕES DE DECISÃO — a camada que resolve o problema de "o jogo sabe, mas
// não conta".
//
// O DIAGNÓSTICO. O jogo já tinha as respostas e nunca as mostrava na hora
// certa:
//   • AutoEquipSystem sabe, com precisão, se um item é melhor — vestindo-o de
//     mentira e perguntando ao próprio motor de combate quanto o personagem
//     passou a valer. Mas isso só rodava quando o jogador abria o inventário e
//     clicava "⚡ Otimizar".
//   • SkillTreeSystem sabe exatamente QUAL nó destravou ao subir de nível
//     (avaliarArvore devolve estado por nó). Mas o jogo dizia só "🌟 Pontos de
//     habilidade para gastar (T)!", encavalado no fim de outro aviso.
//   • EnchantSystem e CraftingSystem sabem se você já tem os materiais. Nunca
//     falavam nada.
//
// Este módulo é a fila e as regras; quem desenha é CartaoUI.js. A separação
// importa porque as REGRAS (o que merece interromper, o que já foi recusado,
// o que é spam) são testáveis sem navegador, e foram a parte que exigiu
// decisão de desenho.
//
// PERSISTÊNCIA: o que o jogador recusou vive em
// `personagem.estadoDoMundo.cartoes`, dentro de estadoDoMundo pelo mesmo
// motivo de reputação/flags/cenas — o objeto `personagem` inteiro já é
// serializado no save, então nada de campo novo no contrato nem migração.
import { garantirEstadoDoMundo } from "./WorldStateSystem.js";

// Ganho mínimo de poder de combate para valer uma interrupção. 10% é a
// escolha do jogador (o padrão anterior do "Otimizar", MARGEM_UPGRADE = 1.5,
// era absoluto e servia para uma LISTA que ele pediu para ver — aqui é
// relativo, porque o cartão chega sem ser chamado e precisa se justificar).
export const GANHO_MINIMO_PADRAO = 0.10;

// Quantos cartões podem estar esperando ao mesmo tempo. Passou disso, o mais
// antigo de menor prioridade cai: uma fila de vinte cartões não é informação,
// é dívida.
const MAX_FILA = 6;

// Quanto tempo (em ações do jogador, não em relógio) um "Agora não" cala
// aquele assunto. Contado em eventos porque o relógio real não representa
// quanto o jogador jogou — deixar o jogo aberto no menu não deveria fazer o
// cartão voltar.
const SILENCIO_APOS_RECUSA = 40;

// Prioridade decide a ordem da fila quando mais de um cartão espera. Não é
// "importância" no abstrato: é quão perecível a informação é. Uma habilidade
// destravada continua destravada daqui a uma hora; um mercador itinerante vai
// embora.
export const PRIORIDADE = {
  nivel: 100,        // subiu de nível: o momento é agora
  habilidade: 80,    // nó novo disponível
  item: 60,          // troca de equipamento
  talento: 55,       // ponto de Caminho do Herdeiro sobrando
  forjar: 40,        // dá para forjar uma receita
  aprimorar: 35,     // dá para aprimorar um item
  consumivel: 30,    // poção melhor na mochila
  requisito: 20,     // item que você não pode usar ainda
};

export function garantirCartoes(personagem) {
  const estado = garantirEstadoDoMundo(personagem);
  if (!estado.cartoes || typeof estado.cartoes !== "object") estado.cartoes = {};
  if (!estado.cartoes.recusados || typeof estado.cartoes.recusados !== "object") estado.cartoes.recusados = {};
  if (typeof estado.cartoes.relogio !== "number") estado.cartoes.relogio = 0;
  return estado.cartoes;
}

// Um "tique" por evento de jogo relevante (item recebido, nível, entrada em
// zona). É o relógio contra o qual as recusas expiram.
export function tiquear(personagem, quantos = 1) {
  const c = garantirCartoes(personagem);
  c.relogio += quantos;
  return c.relogio;
}

export function foiRecusado(personagem, chave) {
  const c = garantirCartoes(personagem);
  const ate = c.recusados[chave];
  if (typeof ate !== "number") return false;
  if (c.relogio >= ate) { delete c.recusados[chave]; return false; }
  return true;
}

export function registrarRecusa(personagem, chave, duracao = SILENCIO_APOS_RECUSA) {
  const c = garantirCartoes(personagem);
  c.recusados[chave] = c.relogio + duracao;
}

// "Nunca mais" para este assunto — usado pelo botão de dispensar permanente.
export function silenciarParaSempre(personagem, chave) {
  registrarRecusa(personagem, chave, Number.MAX_SAFE_INTEGER);
}

// --- A fila ----------------------------------------------------------------
//
// A fila é de sessão, não de save: cartões são sobre "o que fazer agora", e
// restaurar no boot uma fila de ontem seria mostrar decisões cujo contexto
// já passou.
const fila = [];
let aoMudar = null;

export function aoMudarFila(callback) { aoMudar = callback; }

// `chave` identifica o ASSUNTO (não o cartão): dois cartões com a mesma chave
// são a mesma conversa, e o segundo substitui o primeiro em vez de empilhar.
// Sem isso, matar cinco goblins com o mesmo item no chão geraria cinco
// cartões idênticos.
export function enfileirar(personagem, cartao) {
  if (!cartao || !cartao.chave || !cartao.tipo) return false;
  if (foiRecusado(personagem, cartao.chave)) return false;

  const existente = fila.findIndex((c) => c.chave === cartao.chave);
  const completo = { prioridade: PRIORIDADE[cartao.tipo] || 10, ...cartao };
  if (existente >= 0) fila[existente] = completo;
  else fila.push(completo);

  fila.sort((a, b) => b.prioridade - a.prioridade);
  while (fila.length > MAX_FILA) fila.pop();

  if (aoMudar) aoMudar(fila.length);
  return true;
}

export const proximoCartao = () => fila[0] || null;
export const cartoesNaFila = () => [...fila];
export const tamanhoDaFila = () => fila.length;

export function removerCartao(chave) {
  const i = fila.findIndex((c) => c.chave === chave);
  if (i >= 0) fila.splice(i, 1);
  if (aoMudar) aoMudar(fila.length);
}

export function limparFila() {
  fila.length = 0;
  if (aoMudar) aoMudar(0);
}

// --- Comparação de itens ---------------------------------------------------

// Traduz dois itens numa lista de linhas comparáveis, já com a diferença
// calculada. É o conteúdo do cartão de troca: sem isto, o cartão mostraria
// "dano 12" — um número que não informa nada sem o "de quanto era".
//
// Atenção ao caso do slot vazio (`atual` nulo): ali a comparação não é
// "melhor que", é "melhor que nada", e o texto muda.
const LINHAS_COMPARAVEIS = [
  { campo: "dano", rotulo: "Dano" },
  { campo: "defesa", rotulo: "Defesa" },
  { campo: "bonusCritico", rotulo: "Crítico", sufixo: "%" },
  { campo: "bonusVelocidade", rotulo: "Velocidade" },
  { campo: "bonusCura", rotulo: "Cura", sufixo: "%" },
];
const ATRIBUTOS = ["FOR", "DES", "CON", "INT"];

export function compararItens(atual, novo) {
  const linhas = [];
  const num = (item, campo) => (item && typeof item[campo] === "number" ? item[campo] : 0);

  LINHAS_COMPARAVEIS.forEach(({ campo, rotulo, sufixo }) => {
    const a = num(atual, campo);
    const b = num(novo, campo);
    if (!a && !b) return;
    linhas.push({ rotulo, de: a, para: b, delta: b - a, sufixo: sufixo || "" });
  });

  ATRIBUTOS.forEach((attr) => {
    const a = (atual && atual.bonusAtributo && atual.bonusAtributo[attr]) || 0;
    const b = (novo && novo.bonusAtributo && novo.bonusAtributo[attr]) || 0;
    if (!a && !b) return;
    linhas.push({ rotulo: attr, de: a, para: b, delta: b - a, sufixo: "" });
  });

  // Sub-status vindos da forja (ver EnchantSystem): entram como linhas
  // próprias, marcadas, porque são o que diferencia duas cópias do mesmo item.
  const subA = (atual && atual.subStats) || [];
  const subB = (novo && novo.subStats) || [];
  if (subA.length || subB.length) {
    linhas.push({
      rotulo: "Sub-status", texto: true,
      de: subA.length ? `${subA.length}` : "—",
      para: subB.length ? `${subB.length}` : "—",
      delta: subB.length - subA.length, sufixo: "",
    });
  }

  // Campos que não somam, mas mudam o caráter do item.
  const avisos = [];
  if (atual && novo && atual.atributo && novo.atributo && atual.atributo !== novo.atributo) {
    avisos.push(`Escala com ${novo.atributo} em vez de ${atual.atributo}`);
  }
  if (novo && novo.elemento && (!atual || atual.elemento !== novo.elemento)) {
    avisos.push(`Elemento: ${novo.elemento}`);
  }
  if (atual && atual.elemento && novo && !novo.elemento) {
    avisos.push(`Perde o elemento ${atual.elemento}`);
  }
  if (atual && (atual.aprimoramento || 0) > 0) {
    avisos.push(`Você perde o aprimoramento +${atual.aprimoramento} do item atual`);
  }

  return { linhas, avisos };
}

// Percentual de ganho de poder, o número que decide se o cartão aparece.
export function ganhoRelativo(poderAntes, poderDepois) {
  if (!poderAntes || poderAntes <= 0) return poderDepois > 0 ? 1 : 0;
  return (poderDepois - poderAntes) / poderAntes;
}

export function valeInterromper(poderAntes, poderDepois, minimo = GANHO_MINIMO_PADRAO) {
  return ganhoRelativo(poderAntes, poderDepois) >= minimo;
}
