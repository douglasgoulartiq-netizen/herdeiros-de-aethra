// OS GATILHOS: o que, no estado atual do jogo, merece virar um Cartão de
// Decisão agora.
//
// Este arquivo é a resposta à pergunta "o jogo sabe de alguma coisa que eu
// deveria saber?". Ele não desenha nada (isso é CartaoUI) e não guarda fila
// (isso é CartaoSystem): ele OLHA o personagem e o mundo e produz cartões.
//
// POR QUE UM ARQUIVO SÓ. Cada gatilho poderia morar junto do sistema que ele
// consulta — o de item no AutoEquipSystem, o de habilidade no SkillTreeSystem.
// Ficando juntos, ganha-se a coisa que mais importa aqui: um lugar único onde
// se lê a lista inteira do que pode interromper o jogador. Quando o jogo ficar
// falante demais, é aqui que se corta; espalhado, ninguém encontraria todos.
//
// TODO gatilho segue três regras:
//   1. devolve `null` quando não há nada a dizer (silêncio é o padrão);
//   2. tem uma `chave` que identifica o ASSUNTO, não a ocorrência — para o
//      mesmo assunto não gerar dois cartões, e para o "Agora não" funcionar;
//   3. nunca muda o jogo. Quem muda é o botão do cartão, se clicado.
import { planejarEquipamento, aplicarPlanoEquipamento, poderDeCombate, LABEL_SLOT } from "./AutoEquipSystem.js";
import { compararItens, ganhoRelativo, GANHO_MINIMO_PADRAO } from "./CartaoSystem.js";
import { avaliarArvore as avaliarArvoreHabilidade, pontosDisponiveis } from "./SkillTreeSystem.js";
import { receitaDisponivel } from "./CraftingSystem.js";
import { itemPodeSerAprimorado, nivelAprimoramento, podeAprimorar, MAX_NIVEL_APRIMORAMENTO } from "./EnchantSystem.js";
import { faltaPara, cumpreRequisito } from "./RequisitoSystem.js";
import { slotDoItem } from "./InventorySystem.js";

// --- 1. Item melhor --------------------------------------------------------

// Usa o planejador que já existe, em modo "incluirUpgrades", e converte a
// melhor ação numa proposta de troca. Só a MELHOR: propor cinco trocas de uma
// vez num cartão de canto seria uma planilha.
export function gatilhoItemMelhor(personagem, time, dados, { minimo = GANHO_MINIMO_PADRAO } = {}) {
  const acoes = planejarEquipamento(personagem, time, dados, { incluirUpgrades: true });
  const upgrades = acoes.filter((a) => a.motivo === "upgrade");
  if (!upgrades.length) return null;

  const base = poderDeCombate(personagem, dados);
  // Ordena pelo ganho ABSOLUTO que o planejador mediu, e depois filtra pelo
  // ganho RELATIVO — o jogador escolheu 10%, e 10% de um personagem nível 2 é
  // muito menos poder bruto que 10% de um nível 30.
  const melhor = upgrades.sort((a, b) => b.ganho - a.ganho)[0];
  const alvoBase = melhor.alvo === personagem ? base : poderDeCombate(melhor.alvo, dados);
  const relativo = ganhoRelativo(alvoBase, alvoBase + melhor.ganho);
  if (relativo < minimo) return null;

  const { linhas, avisos } = compararItens(melhor.itemAnterior, melhor.item);
  const paraOutro = melhor.alvo !== personagem;

  return {
    tipo: "item",
    icone: "⚔️",
    chave: `item:${melhor.item.uid}:${melhor.slot}`,
    titulo: paraOutro ? `Item melhor para ${melhor.alvoNome}` : "Item melhor encontrado",
    texto: `${LABEL_SLOT[melhor.slot] || melhor.slot}${paraOutro ? ` — ${melhor.alvoNome}` : ""}`,
    nomes: { atual: melhor.itemAnterior ? melhor.itemAnterior.nome : "Nada", novo: melhor.item.nome },
    comparacao: { linhas, avisos },
    resumo: {
      rotulo: "Poder de combate",
      de: Math.round(alvoBase),
      para: Math.round(alvoBase + melhor.ganho),
      delta: melhor.ganho,
      texto: `${Math.round(relativo * 100)}%`,
    },
    avisos,
    acoes: [{
      rotulo: "Equipar",
      aoClicar: () => {
        const aplicadas = aplicarPlanoEquipamento(personagem, [melhor]);
        return aplicadas.length ? `${melhor.item.nome} equipado.` : "O item não está mais na mochila.";
      },
    }],
  };
}

// --- 2. Habilidade desbloqueada -------------------------------------------

// `nivelAnterior` é o que muda esta função de "você tem pontos" para "ABRIU
// uma habilidade": sem ele não dá para saber se o nó já estava disponível
// antes de subir de nível, e o cartão viraria um lembrete repetido.
export function gatilhoHabilidadeNova(personagem, dados, nivelAnterior, abrirArvore) {
  const pontos = pontosDisponiveis(personagem, dados);
  if (pontos <= 0) return null;

  const estados = avaliarArvoreHabilidade(personagem, dados);
  const disponiveis = estados.filter((e) => e.estado === "disponivel");
  if (!disponiveis.length) return null;

  // Nós que estavam travados por NÍVEL e destravaram agora. É a diferença
  // entre "sobrou ponto" e "abriu coisa nova".
  const recemAbertos = disponiveis.filter((e) => {
    const exigido = e.no.nivelRequerido || 1;
    return exigido > (nivelAnterior || 0) && exigido <= personagem.nivel;
  });
  const foco = recemAbertos[0] || disponiveis[0];
  const novo = recemAbertos.length > 0;

  return {
    tipo: "habilidade",
    icone: "✨",
    central: novo,   // habilidade destravada merece o centro; ponto sobrando, não
    chave: `habilidade:${foco.no.id}`,
    titulo: novo ? "Habilidade desbloqueada" : "Ponto de habilidade sobrando",
    texto: `${foco.no.nome}${foco.no.descricao ? ` — ${foco.no.descricao}` : ""}`,
    avisos: pontos > 1 ? [`Você tem ${pontos} pontos para gastar.`] : [],
    acoes: [{ rotulo: "Abrir árvore", aoClicar: () => { if (abrirArvore) abrirArvore(foco.no.id); return null; } }],
  };
}

// --- 3. Consumível melhor --------------------------------------------------

// Compara a poção de cura mais forte que você tem com a que você tem em maior
// quantidade. O caso real: 12 Poções Menores e 3 Maiores, e o jogador usa as
// menores por hábito porque nunca reparou nas outras.
export function gatilhoConsumivelMelhor(personagem) {
  const curas = personagem.inventario.filter((i) => i.tipo === "consumivel" && (i.curaHP || 0) > 0);
  if (curas.length < 2) return null;

  const porId = new Map();
  curas.forEach((i) => {
    const e = porId.get(i.id) || { item: i, n: 0 };
    e.n += 1; porId.set(i.id, e);
  });
  const lista = [...porId.values()];
  if (lista.length < 2) return null;

  const maisForte = lista.reduce((a, b) => (b.item.curaHP > a.item.curaHP ? b : a));
  const maisComum = lista.reduce((a, b) => (b.n > a.n ? b : a));
  if (maisForte.item.id === maisComum.item.id) return null;
  if (maisForte.item.curaHP <= maisComum.item.curaHP * 1.4) return null;

  return {
    tipo: "consumivel",
    icone: "🧪",
    chave: `consumivel:${maisForte.item.id}`,
    titulo: "Poção mais forte na mochila",
    texto: `Você tem ${maisForte.n}× ${maisForte.item.nome} (cura ${maisForte.item.curaHP}) além de ${maisComum.n}× ${maisComum.item.nome} (cura ${maisComum.item.curaHP}). Guarde a forte para emergência.`,
    rotuloRecusa: "Entendi",
    acoes: [],
  };
}

// --- 4. Dá para forjar -----------------------------------------------------

export function gatilhoPodeForjar(personagem, dados, abrirForja) {
  const prontas = (dados.recipes || []).filter((r) => receitaDisponivel(personagem, r));
  if (!prontas.length) return null;
  const r = prontas[0];
  const resultado = (dados.items.itens || []).find((i) => i.id === r.resultadoId);

  return {
    tipo: "forjar",
    icone: "🔨",
    chave: `forjar:${r.id || r.resultadoId}`,
    titulo: "Você já tem os materiais",
    texto: `${r.nome}${resultado ? ` — ${resultado.nome}` : ""}${prontas.length > 1 ? ` (e mais ${prontas.length - 1} receita${prontas.length > 2 ? "s" : ""})` : ""}`,
    acoes: [{ rotulo: "Abrir forja", aoClicar: () => { if (abrirForja) abrirForja("criar"); return null; } }],
  };
}

// --- 5. Dá para aprimorar --------------------------------------------------

// Olha o que está EQUIPADO, não a mochila inteira: aprimorar um item guardado
// é raramente o que o jogador quer, e sugerir isso geraria ruído.
export function gatilhoPodeAprimorar(personagem, abrirForja) {
  const equipados = Object.values(personagem.equipamento || {}).filter(Boolean);
  for (const item of equipados) {
    if (!itemPodeSerAprimorado(item)) continue;
    if (nivelAprimoramento(item) >= MAX_NIVEL_APRIMORAMENTO) continue;
    const r = podeAprimorar(personagem, item);
    if (!r.ok) continue;
    const nivel = nivelAprimoramento(item);
    return {
      tipo: "aprimorar",
      icone: "⚒️",
      chave: `aprimorar:${item.uid}:${nivel}`,
      titulo: "Dá para aprimorar agora",
      texto: `${item.nome} pode ir para +${nivel + 1}. Você tem o ouro e os materiais.`,
      avisos: [`Custa ${r.custo.ouro} ouro e ${r.custo.materiais.map((m) => `${m.quantidade}× ${m.itemId.replace(/_/g, " ")}`).join(", ")}`],
      acoes: [{ rotulo: "Abrir forja", aoClicar: () => { if (abrirForja) abrirForja("aprimorar"); return null; } }],
    };
  }
  return null;
}

// --- 6. Requisito não atendido ---------------------------------------------

// O item bom que você não pode usar. Hoje isso só aparece no tooltip — ou
// seja, nunca, no celular.
export function gatilhoRequisitoNaoAtendido(personagem, dados) {
  for (const item of personagem.inventario) {
    if (!slotDoItem(item)) continue;
    if (cumpreRequisito(personagem, item)) continue;
    const falta = faltaPara(personagem, item);
    if (!falta || !Object.keys(falta).length) continue;
    const texto = Object.entries(falta).map(([attr, n]) => `${n} de ${attr}`).join(" e ");
    return {
      tipo: "requisito",
      icone: "🔒",
      chave: `requisito:${item.id}`,
      titulo: "Item que você ainda não pode usar",
      texto: `${item.nome} — falta ${texto}. Subir de nível ou a árvore de habilidades resolvem.`,
      rotuloRecusa: "Entendi",
      acoes: [],
    };
  }
  return null;
}

// --- 7. Ponto de Caminho do Herdeiro --------------------------------------

// O Caminho do Herdeiro guarda TRÊS moedas separadas (ver
// TalentSystem.garantirEstadoCaminho): pontos de classe, de subclasse e de
// herança. Somar as três num número só é o certo para o cartão — o jogador
// não quer saber a contabilidade, quer saber que tem coisa para gastar —,
// mas o texto diz de qual tipo, porque elas não são intercambiáveis.
export function gatilhoTalentoSobrando(personagem, abrirCaminhos) {
  const ch = personagem.caminhoHerdeiro;
  if (!ch) return null;
  const moedas = [
    { n: ch.pontosClasse || 0, nome: "de classe" },
    { n: ch.pontosSubclasse || 0, nome: "de subclasse" },
    { n: ch.pontosHeranca || 0, nome: "de herança" },
  ].filter((m) => m.n > 0);
  if (!moedas.length) return null;

  const total = moedas.reduce((s, m) => s + m.n, 0);
  const detalhe = moedas.map((m) => `${m.n} ${m.nome}`).join(", ");
  return {
    tipo: "talento",
    icone: "🌌",
    chave: `talento:${moedas.map((m) => `${m.nome}${m.n}`).join("|")}`,
    titulo: "Ponto de Caminho do Herdeiro",
    texto: `Você tem ${total} ponto${total > 1 ? "s" : ""} sem gastar (${detalhe}).`,
    acoes: [{ rotulo: "Abrir Caminhos", aoClicar: () => { if (abrirCaminhos) abrirCaminhos(); return null; } }],
  };
}

// --- Orquestração ----------------------------------------------------------

// Roda os gatilhos que fazem sentido para um MOMENTO do jogo, em ordem de
// prioridade, e devolve a lista. Quem chama decide o momento:
//
//   "item"  — algo entrou na mochila (baú, drop, compra, recompensa)
//   "nivel" — subiu de nível
//   "calmo" — voltou para o mundo depois de uma batalha, ou descansou
//
// Separar por momento evita o erro clássico: verificar tudo o tempo todo e
// descobrir que o jogo interrompe o jogador a cada dois passos.
export function gatilhosDoMomento(momento, ctx) {
  const { personagem, time, dados, nivelAnterior, abrir = {}, minimo } = ctx;
  const saida = [];
  const empurrar = (c) => { if (c) saida.push(c); };

  if (momento === "nivel") {
    empurrar(gatilhoHabilidadeNova(personagem, dados, nivelAnterior, abrir.arvore));
    empurrar(gatilhoTalentoSobrando(personagem, abrir.caminhos));
  }
  if (momento === "item" || momento === "calmo") {
    empurrar(gatilhoItemMelhor(personagem, time, dados, { minimo }));
  }
  if (momento === "calmo") {
    empurrar(gatilhoPodeAprimorar(personagem, abrir.forja));
    empurrar(gatilhoPodeForjar(personagem, dados, abrir.forja));
    empurrar(gatilhoConsumivelMelhor(personagem));
    empurrar(gatilhoRequisitoNaoAtendido(personagem, dados));
  }
  return saida;
}
