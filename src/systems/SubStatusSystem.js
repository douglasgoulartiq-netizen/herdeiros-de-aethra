// SUB-STATUS DE FORJA — o que faz duas cópias do mesmo item serem itens
// diferentes.
//
// O PROBLEMA QUE RESOLVE. O aprimoramento antigo ia de +0 a +5 somando 8% do
// stat principal por nível. Previsível de ponta a ponta: duas espadas +5 do
// mesmo modelo eram objetos idênticos, e a decisão "vale subir mais?" tinha
// sempre a mesma resposta (sim, se você tem material). Não havia nada para
// contar sobre uma arma sua.
//
// COMO FUNCIONA AGORA (decisão do jogador, estilo Honkai):
//   • o teto subiu de +5 para +10;
//   • a cada 2 níveis (+2, +4, +6, +8, +10) o item ganha um SUB-STATUS;
//   • em cada um desses marcos o jogo SORTEIA TRÊS candidatos e o jogador
//     escolhe um.
//
// Por que sorteia três em vez de um: a loteria pura (sortear e pronto) cria a
// figura do reroll, e reroll sem uma moeda para pagá-lo é crueldade num jogo
// sem monetização — o jogador ficaria preso a um resultado ruim num item que
// custou material caro. Três candidatos preservam a surpresa (você não
// escolhe da lista inteira) e preservam a decisão (nenhuma forja é igual à
// anterior), sem precisar de economia de reroll.
//
// O QUE NÃO MUDA: items.json continua intocado. O sub-status vive na
// INSTÂNCIA do item — que já carrega `uid`, `aprimoramento`, `danoBase` e
// `nomeBase` —, então nenhum item do catálogo é reescrito e nenhum save antigo
// quebra. Um item forjado antes desta mudança simplesmente tem `subStats`
// vazio e continua funcionando.
import { criarPRNG, hashTexto } from "./WorldSeed.js";

export const NIVEL_MAXIMO = 10;
export const INTERVALO_SUBSTATUS = 2;
export const CANDIDATOS_POR_MARCO = 3;

// Os marcos: +2, +4, +6, +8, +10.
export const MARCOS = Array.from(
  { length: Math.floor(NIVEL_MAXIMO / INTERVALO_SUBSTATUS) },
  (_, i) => (i + 1) * INTERVALO_SUBSTATUS,
);
export const ehMarco = (nivel) => nivel > 0 && nivel % INTERVALO_SUBSTATUS === 0 && nivel <= NIVEL_MAXIMO;

// O POOL. Cada entrada diz o que é, como escala e para quem costuma sair.
//
// `peso` é por TIPO de item: uma armadura sorteia defesa e CON muito mais que
// crítico, porque um peitoral que rola +crítico é uma piada que o jogador não
// pediu. Peso 0 exclui.
//
// `valores` são as faixas por qualidade do rolo (3 níveis, como as
// substat rolls de jogos do gênero) — o mesmo sub-status pode sair fraco ou
// forte, e é isso que faz duas espadas +10 diferirem.
export const POOL_SUBSTATUS = [
  {
    id: "for", rotulo: "FOR", tipo: "atributo", campo: "FOR",
    valores: [1, 2, 3], peso: { arma: 10, armadura: 6, acessorio: 7 },
  },
  {
    id: "des", rotulo: "DES", tipo: "atributo", campo: "DES",
    valores: [1, 2, 3], peso: { arma: 10, armadura: 4, acessorio: 9 },
  },
  {
    id: "con", rotulo: "CON", tipo: "atributo", campo: "CON",
    valores: [1, 2, 3], peso: { arma: 4, armadura: 12, acessorio: 8 },
  },
  {
    id: "int", rotulo: "INT", tipo: "atributo", campo: "INT",
    valores: [1, 2, 3], peso: { arma: 8, armadura: 4, acessorio: 9 },
  },
  {
    id: "dano_pct", rotulo: "Dano", tipo: "percentual", campo: "danoPercent", sufixo: "%",
    valores: [3, 5, 8], peso: { arma: 14, armadura: 0, acessorio: 5 },
  },
  {
    id: "defesa_pct", rotulo: "Defesa", tipo: "percentual", campo: "defesaPercent", sufixo: "%",
    valores: [3, 5, 8], peso: { arma: 0, armadura: 14, acessorio: 5 },
  },
  {
    id: "hp_pct", rotulo: "HP máximo", tipo: "percentual", campo: "hpMaxPercent", sufixo: "%",
    valores: [2, 4, 6], peso: { arma: 3, armadura: 12, acessorio: 8 },
  },
  {
    id: "critico", rotulo: "Crítico", tipo: "plano", campo: "bonusCritico", sufixo: "%",
    valores: [2, 3, 5], peso: { arma: 12, armadura: 2, acessorio: 11 },
  },
  {
    id: "velocidade", rotulo: "Velocidade", tipo: "plano", campo: "bonusVelocidade",
    valores: [1, 2, 3], peso: { arma: 6, armadura: 3, acessorio: 11 },
  },
];

const POR_ID = new Map(POOL_SUBSTATUS.map((s) => [s.id, s]));
export const subStatusPorId = (id) => POR_ID.get(id) || null;

export function garantirSubStats(item) {
  if (!Array.isArray(item.subStats)) item.subStats = [];
  return item.subStats;
}

// Sorteia os candidatos de um marco. Determinístico por (uid do item, nível):
// reabrir a forja, recarregar a página ou desistir e voltar mostra as MESMAS
// três opções. Sem isso, fechar e reabrir vira um reroll grátis, e a escolha
// deixa de custar alguma coisa.
export function candidatosDoMarco(item, nivel) {
  const tipo = item.tipo || "arma";
  const jaTem = new Set(garantirSubStats(item).map((s) => s.id));

  const elegiveis = POOL_SUBSTATUS
    .map((s) => ({ s, peso: (s.peso && s.peso[tipo]) || 0 }))
    .filter((x) => x.peso > 0)
    // Um sub-status que o item já tem pode sair de novo — e aí ele SOMA ao
    // que já estava lá (ver aplicarSubStatus). É o que permite um item focar
    // num atributo em vez de virar uma colcha de retalhos.
    .map((x) => ({ ...x, repetido: jaTem.has(x.s.id) }));

  const rnd = criarPRNG(hashTexto(`${item.uid || item.id}|substat|${nivel}`));
  const escolhidos = [];
  const usados = new Set();

  for (let i = 0; i < CANDIDATOS_POR_MARCO && elegiveis.length > usados.size; i += 1) {
    const disponiveis = elegiveis.filter((x) => !usados.has(x.s.id));
    const total = disponiveis.reduce((soma, x) => soma + x.peso, 0);
    let alvo = rnd() * total;
    let pego = disponiveis[disponiveis.length - 1];
    for (const x of disponiveis) {
      alvo -= x.peso;
      if (alvo <= 0) { pego = x; break; }
    }
    usados.add(pego.s.id);

    // A qualidade do rolo é sorteada junto: 50% fraco, 35% médio, 15% forte.
    const q = rnd();
    const grau = q < 0.5 ? 0 : q < 0.85 ? 1 : 2;
    escolhidos.push({
      id: pego.s.id,
      rotulo: pego.s.rotulo,
      tipo: pego.s.tipo,
      campo: pego.s.campo,
      sufixo: pego.s.sufixo || "",
      valor: pego.s.valores[grau],
      grau,                       // 0 fraco, 1 médio, 2 forte — a UI colore por isto
      repetido: pego.repetido,
    });
  }
  return escolhidos;
}

// Grava a escolha no item. Se o sub-status já existia, SOMA — é o que permite
// um item concentrar (+3 FOR virando +6 FOR) em vez de espalhar.
export function aplicarSubStatus(item, escolha) {
  const lista = garantirSubStats(item);
  const existente = lista.find((s) => s.id === escolha.id);
  if (existente) {
    existente.valor += escolha.valor;
    existente.rolagens = (existente.rolagens || 1) + 1;
  } else {
    lista.push({ ...escolha, rolagens: 1 });
  }
  return lista;
}

// Soma de todos os sub-status de todos os itens equipados, agrupada por
// campo. É o que CharacterFactory consulta — um lugar só, para nenhuma
// fórmula de combate precisar saber que sub-status existe.
export function bonusDosSubStats(personagem) {
  const total = { FOR: 0, DES: 0, CON: 0, INT: 0, danoPercent: 0, defesaPercent: 0, hpMaxPercent: 0, bonusCritico: 0, bonusVelocidade: 0 };
  const equip = (personagem && personagem.equipamento) || {};
  Object.values(equip).forEach((item) => {
    if (!item || !Array.isArray(item.subStats)) return;
    item.subStats.forEach((s) => {
      const campo = s.tipo === "atributo" ? s.campo : s.campo;
      if (campo in total) total[campo] += s.valor;
    });
  });
  return total;
}

// Texto curto de um sub-status, para cartão e tooltip.
export function textoSubStatus(s) {
  const sinal = s.valor >= 0 ? "+" : "";
  return `${s.rotulo} ${sinal}${s.valor}${s.sufixo || ""}`;
}

export const GRAU_ROTULO = ["comum", "bom", "excelente"];
export const GRAU_COR = ["#c8b89a", "#7ab5e0", "#e0b24a"];
