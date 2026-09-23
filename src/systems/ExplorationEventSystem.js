// Eventos aleatórios de exploração (melhoria pós-backlog): pequenos
// encontros NÃO-combate ao caminhar pelo mundo aberto — viajante perdido,
// santuário esquecido, ruína a vasculhar, sinal de perigo, achado no
// caminho — pra dar textura ao mundo sem que TODO passo arriscado vire uma
// luta. Alguns reaproveitam o teste de perícia d20 (ver SkillCheckSystem.js,
// contexto "exploracao" em skillChecks.json) pro mesmo sabor de mesa de RPG
// já usado em NPCs/baús/coleta; outros (src/data/explorationEvents.json) são
// escolhas simples (ajudar/ignorar, achado instantâneo) sem d20 nenhum.
// Rola numa chance BEM menor e independente do encontro de monstro (ver
// EncounterSystem.js/main.js: verificarEncontroAleatorio) — os dois nunca
// disparam no mesmo passo, pra não empilhar interrupções uma em cima da
// outra.
import { alterarReputacao } from "./WorldStateSystem.js";
import { adicionarFragmentos } from "./GachaSystem.js";

// Frase que a opção de origem usa quando a perícia do teste é a da origem
// do herói (ver opcaoDeOrigem): ele resolve sem rolar o dado.
const FRASE_DA_ORIGEM = {
  soldado: "Você já fez isso no exército",
  nobre: "Uma conversa de salão resolve isso",
  criminoso: "Coisa de quem cresceu nos becos",
  eremita: "Anos sozinho no mato ensinam isso",
  andarilho_do_povo: "Você já viveu mil histórias assim",
  sabio: "Você leu sobre isso na biblioteca",
};

const uidNovo = () => "id_" + Math.random().toString(36).slice(2, 10);

// Recompensas extras que eventos e testes podem declarar, além de ouro e
// reputação: itens (`itens`/`itensSucesso`), Fragmentos de Aethra e
// descanso completo (`curaTotal`). Devolve os textos para a mensagem.
function aplicarExtras(personagem, { itens = [], fragmentos = 0, curaTotal = false } = {}, dados = null) {
  const notas = [];
  const catalogo = (dados && dados.items && dados.items.itens) || [];
  itens.forEach(({ id, qtd = 1 }) => {
    const item = catalogo.find((i) => i.id === id);
    if (!item) return;
    for (let n = 0; n < qtd; n += 1) personagem.inventario.push({ ...item, uid: uidNovo() });
    notas.push(`${qtd > 1 ? `${qtd}× ` : ""}${item.nome}`);
  });
  if (fragmentos) { adicionarFragmentos(personagem, fragmentos); notas.push(`${fragmentos} Fragmentos`); }
  if (curaTotal) {
    personagem.hp = personagem.hpMax;
    personagem.mp = personagem.mpMax;
    notas.push("HP e MP cheios");
  }
  return notas;
}

export function deveDispararEventoExploracao(chancePorPasso = 0.018) {
  return Math.random() < chancePorPasso;
}

// Une os dois "bancos" de eventos — escolha/achado (explorationEvents.json)
// e teste de perícia (skillChecks.json, contexto "exploracao") — num único
// sorteio, pra quem chama não precisar saber de onde cada evento veio, só o
// `tipo` já resolvido no objeto sorteado ("escolha" | "achado" |
// "teste_pericia").
export function sortearEventoExploracao(dadosEventos, dadosSkillChecks, personagem = null) {
  const testes = (dadosSkillChecks || [])
    .filter((sc) => sc.contexto === "exploracao")
    .map((sc) => ({ ...sc, tipo: "teste_pericia" }));
  // Eventos de ORIGEM (`origemExclusiva`) só aparecem para quem veio dela —
  // é o Soldado que o desertor reconhece, o Sábio que lê a inscrição.
  const origem = personagem && personagem.antecedenteId;
  const eventos = (dadosEventos || []).filter((ev) => !ev.origemExclusiva || ev.origemExclusiva === origem);
  const pool = [...eventos, ...testes];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Algumas opções de evento (ex.: doar ouro num santuário) exigem um valor
// mínimo em caixa — a UI usa isto pra decidir se mostra o botão habilitado,
// ANTES do jogador clicar (nunca deixa clicar e falhar silenciosamente).
// As opções de um evento de escolha para ESTE herói: as do evento e, se o
// evento declarar, a da personalidade dele (`opcoesPorTraco`, marcada com o
// nome do traço no rótulo). Quem desenha e quem aplica usam esta lista.
export function opcoesDoEvento(evento, personagem) {
  const base = evento.opcoes || [];
  const lista = [...base];
  // A AÇÃO DE MUNDO DA CLASSE. A classe era a escolha mais forte da criação e
  // mesmo assim só existia dentro da batalha: fora dela, um Bárbaro e um Mago
  // andavam pelo mundo exatamente iguais. Aqui cada classe tem uma coisa que
  // só ela sabe fazer quando o mundo pede — arrombar, derrubar, ler runa,
  // intimidar, abençoar, rastrear. Entra na MESMA lista das outras opções e
  // é resolvida pelo mesmo motor, como a opção de personalidade.
  const daClasse = personagem && evento.opcoesPorClasse && evento.opcoesPorClasse[personagem.classeId];
  if (daClasse) lista.push({ ...daClasse, id: `classe_${personagem.classeId}`, daClasse: true });
  const doTraco = personagem && evento.opcoesPorTraco && evento.opcoesPorTraco[personagem.tracoId];
  if (doTraco) lista.push({ ...doTraco, id: `traco_${personagem.tracoId}`, doTraco: true });
  return lista;
}

// A opção de ORIGEM num teste de perícia: quem tem a perícia pela origem
// resolve sem rolar o dado. null quando a perícia não é a da origem.
export function opcaoDeOrigem(teste, personagem, dados) {
  const bg = ((dados && dados.backgrounds) || []).find((b) => b.id === (personagem && personagem.antecedenteId));
  if (!bg || !teste || bg.pericia !== teste.pericia) return null;
  return { rotulo: `[${bg.nome}] ${FRASE_DA_ORIGEM[bg.id] || "Sua origem resolve isso"} — sem dado.`, origem: bg };
}

export function opcaoDisponivel(opcao, personagem) {
  if (opcao.custoOuroMinimo && personagem.ouro < opcao.custoOuroMinimo) return false;
  return true;
}

// Aplica a consequência de uma opção de evento tipo "escolha" (ver
// explorationEvents.json). Muta `personagem` (ouro/reputação com a facção
// do território atual, se aplicável) e retorna o texto de resultado + o
// delta de ouro aplicado, pra UI mostrar como mensagem. `ok:false` sem
// mutar nada quando a opção não existe ou não está disponível (custo
// mínimo não atingido — ver opcaoDisponivel).
export function aplicarEscolhaEvento(personagem, evento, opcaoId, dadosWorldState, facaoId = "vila", dados = null) {
  const opcao = opcoesDoEvento(evento, personagem).find((o) => o.id === opcaoId);
  if (!opcao) return { ok: false };
  if (!opcaoDisponivel(opcao, personagem)) return { ok: false };
  // Opção "sorte" (ex.: "Pegadas Estranhas"/investigar): risco leve
  // resolvido por sorteio puro, não por teste de perícia — não representa
  // uma habilidade do personagem, só acaso de estar no lugar certo/errado
  // na hora certa. Nunca deixa o ouro ficar negativo.
  if (opcao.sorte) {
    const sucesso = Math.random() < (opcao.chanceSucesso ?? 0.5);
    const ouroDelta = sucesso ? (opcao.ouroSucesso || 0) : (opcao.ouroFalha || 0);
    personagem.ouro = Math.max(0, personagem.ouro + ouroDelta);
    return { ok: true, sucesso, texto: sucesso ? opcao.textoSucesso : opcao.textoFalha, ouroDelta };
  }
  const ouroDelta = opcao.ouro || 0;
  personagem.ouro = Math.max(0, personagem.ouro + ouroDelta);
  if (opcao.reputacaoFaccao) alterarReputacao(personagem, facaoId, opcao.reputacaoFaccao, dadosWorldState);
  const extras = aplicarExtras(personagem, { itens: opcao.itens, fragmentos: opcao.fragmentos, curaTotal: opcao.curaTotal }, dados);
  return { ok: true, texto: opcao.textoResultado, ouroDelta, extras };
}

// Aplica um evento tipo "achado" (ver explorationEvents.json): recompensa
// instantânea, sem escolha nenhuma — só flavor text + ouro.
export function aplicarAchadoEvento(personagem, evento) {
  const ouroDelta = evento.ouro || 0;
  personagem.ouro += ouroDelta;
  return { texto: evento.textoResultado, ouroDelta };
}

// Aplica o resultado de um teste de perícia de exploração (ver
// SkillCheckSystem.js: realizarTeste — chamado por quem invoca esta
// função, não aqui, pra este módulo não duplicar a lógica de d20). Só
// concede recompensa em caso de sucesso, igual ao padrão já usado pelos
// testes de NPC/baú/coleta.
// `ctx` (opcional): { dados, facaoId, dadosWorldState } — necessário para os
// extras (itens, Fragmentos) e para a reputação regional do sucesso.
export function aplicarResultadoTesteExploracao(personagem, teste, resultado, ctx = {}) {
  let ouroDelta = 0;
  let extras = [];
  if (resultado.sucesso) {
    if (teste.recompensaOuroSucesso) {
      ouroDelta = teste.recompensaOuroSucesso;
      personagem.ouro += ouroDelta;
    }
    if (teste.reputacaoSucesso && ctx.facaoId) alterarReputacao(personagem, ctx.facaoId, teste.reputacaoSucesso, ctx.dadosWorldState || (ctx.dados && ctx.dados.worldStateVariables));
    extras = aplicarExtras(personagem, { itens: teste.itensSucesso, fragmentos: teste.fragmentosSucesso }, ctx.dados);
  }
  return { texto: resultado.sucesso ? teste.textoSucesso : teste.textoFalha, ouroDelta, extras };
}
