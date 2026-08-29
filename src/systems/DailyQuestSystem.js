// Missões diárias leves (melhoria de jogabilidade pós-backlog original): 3
// objetivos simples, sempre os mesmos, que resetam sozinhos à meia-noite (na
// primeira ação do dia, sem precisar de relógio de servidor) e dão uma
// recompensa pequena de ouro + Fragmentos de Aethra ao completar cada um.
//
// Diferente do "Desafio Diário" que já existe em GachaSystem.js/GachaUI.js
// (um cronômetro de 24h que acumula "cargas" resgatáveis sem exigir jogar,
// puramente baseado em tempo) — este sistema exige uma AÇÃO real no dia
// (matar, coletar, vencer uma batalha) e vive na tela de Missões, ao lado
// das missões normais de NPC, não na tela de Time/Gacha. Os dois sistemas
// são independentes e não se sobrepõem.
export const TEMPLATES_DIARIOS = [
  { id: "diaria_cacada", nome: "Caçada do Dia", icone: "⚔️", tipo: "abate", meta: 5, descricao: "Derrote 5 monstros em batalhas.", recompensaOuro: 15, recompensaFragmentos: 15 },
  { id: "diaria_coleta", nome: "Coleta do Dia", icone: "🌿", tipo: "coleta", meta: 3, descricao: "Colete 3 recursos de nós espalhados pelo mundo.", recompensaOuro: 15, recompensaFragmentos: 15 },
  { id: "diaria_vitoria", nome: "Vitória do Dia", icone: "🏆", tipo: "vitoria", meta: 1, descricao: "Vença 1 batalha.", recompensaOuro: 15, recompensaFragmentos: 15 },
];

// Identificador do "dia" pra decidir quando resetar — só precisa ser
// estável dentro do mesmo dia e diferente no dia seguinte; toISOString()
// (UTC) evita qualquer dependência de fuso horário do navegador do jogador.
function diaAtualId() {
  return new Date().toISOString().slice(0, 10);
}

// Garante que personagem.missoesDiarias existe e é do dia de hoje — se for
// de um dia anterior (ou não existir ainda), gera progresso zerado pros 3
// templates. Idempotente: chamar de novo no mesmo dia não reseta nada.
export function garantirMissoesDiarias(personagem) {
  const hoje = diaAtualId();
  if (personagem.missoesDiarias && personagem.missoesDiarias.dia === hoje) return personagem.missoesDiarias;
  personagem.missoesDiarias = {
    dia: hoje,
    progresso: TEMPLATES_DIARIOS.map((t) => ({ id: t.id, atual: 0, concluida: false, coletada: false })),
  };
  return personagem.missoesDiarias;
}

function progressoDe(personagem, templateId) {
  garantirMissoesDiarias(personagem);
  return personagem.missoesDiarias.progresso.find((p) => p.id === templateId) || null;
}

// Chamado pelos pontos de gancho do jogo (abate em BattleUI.js, coleta de
// nó e vitória de batalha em main.js) sempre que a AÇÃO correspondente
// acontece — nunca precisa saber se existe uma missão diária daquele tipo
// hoje; se não existir (não deveria acontecer, os 3 templates cobrem os 3
// tipos sempre), simplesmente não faz nada.
export function registrarProgressoDiario(personagem, tipo, quantidade = 1) {
  garantirMissoesDiarias(personagem);
  TEMPLATES_DIARIOS.filter((t) => t.tipo === tipo).forEach((t) => {
    const p = progressoDe(personagem, t.id);
    if (!p || p.concluida) return;
    p.atual = Math.min(t.meta, p.atual + quantidade);
    if (p.atual >= t.meta) p.concluida = true;
  });
}

// Lista pronta pra UI: cada template junto do progresso do dia.
export function missoesDiariasParaExibir(personagem) {
  garantirMissoesDiarias(personagem);
  return TEMPLATES_DIARIOS.map((t) => ({ template: t, ...progressoDe(personagem, t.id) }));
}

// Resgata a recompensa de uma missão diária concluída (uma vez só por dia,
// por template — `coletada` trava um segundo resgate). Ouro é aplicado
// direto aqui (mesmo padrão de QuestSystem.concluirMissao); Fragmentos de
// Aethra volta no retorno pra quem chamar aplicar via adicionarFragmentos
// (GachaSystem.js), seguindo o mesmo padrão já usado pelas missões de NPC.
export function coletarRecompensaDiaria(personagem, templateId) {
  const t = TEMPLATES_DIARIOS.find((x) => x.id === templateId);
  const p = progressoDe(personagem, templateId);
  if (!t || !p) return { ok: false, msg: "Missão diária desconhecida." };
  if (!p.concluida) return { ok: false, msg: "Ainda não concluída." };
  if (p.coletada) return { ok: false, msg: "Recompensa já resgatada hoje." };
  p.coletada = true;
  personagem.ouro += t.recompensaOuro;
  return { ok: true, ouro: t.recompensaOuro, fragmentos: t.recompensaFragmentos };
}
