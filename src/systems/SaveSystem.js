// Salva e carrega o progresso do jogador no localStorage do navegador.
//
// Versionamento e migração (task #97): antes desta task, cada sistema novo
// que precisava de um campo novo em `personagem` (gacha, árvore de
// habilidades antiga, viagem rápida, NG+, Modo História, e depois Caminhos
// do Herdeiro e a config de IA de auto-batalha) espalhava seu próprio
// `if (!personagem.campo) personagem.campo = valorPadrao` em
// aplicarEstadoSalvo() (main.js) — funcionava, mas cada campo novo exigia
// lembrar de mexer nesse if solto, sem nenhum registro de "que versão do
// save tem o quê". Esses `garantir*` continuam existindo em cada sistema
// (TalentSystem.js/AutoBattleAI.js/etc.) como cinto de segurança — cobrem
// também um personagem criado fora de um load, como um convocado novo do
// gacha —, mas agora TODO save carregado (local ou da nuvem) passa primeiro
// por `migrarSave()`, então o formato mais atual do jogo já está garantido
// antes de qualquer tela usar o save.
import { garantirEstadoCaminho } from "./TalentSystem.js";
import { garantirConfigAutoBatalha } from "./AutoBattleAI.js";
import { estadoGachaInicial } from "./GachaSystem.js";

const SAVE_KEY = "rpg_pt_save_v1";

// Versão do FORMATO de save (não é versão do jogo) — sobe 1 sempre que um
// campo novo precisa de valor padrão pra um save antigo carregar sem
// quebrar. Cada migração vira uma função NOVA no array MIGRACOES abaixo,
// nunca uma edição numa já existente — o histórico de migrações fica
// preservado e legível, igual um changelog.
export const SAVE_VERSION = 2;

// MIGRACOES[i] leva um save da versão i pra i+1. `salvo.saveVersion`
// ausente conta como versão 0 (o formato mais antigo que existe, de antes
// desta task — sem gacha/árvore/viagem rápida/NG+/Modo História
// garantidos). Cada função deve ser SEGURA de rodar de novo (só preenche o
// que falta, nunca sobrescreve o que já existe), então mesmo que algo
// interrompa o carregamento no meio, rodar a migração de novo do início
// nunca perde ou duplica nada.
const MIGRACOES = [
  // v0 -> v1: os campos que já eram garantidos "na unha" em
  // aplicarEstadoSalvo() antes desta task existir.
  (salvo) => {
    const p = salvo.personagem;
    if (!p.gacha) p.gacha = estadoGachaInicial();
    if (!p.arvore) p.arvore = { escolhas: [] };
    if (!p.biomaVisitados) p.biomaVisitados = []; // viagem rápida: saves antigos sem o campo
    if (!p.ngPlus) p.ngPlus = 0; // New Game+: saves antigos sem o campo (jogo normal = NG+0)
    if (p.modoHistoria === undefined) p.modoHistoria = false; // Modo História: saves antigos sem o campo (desligado)
    // Masmorra única virou dungeon1/dungeon2 (task #47) — um save de antes
    // dessa mudança guarda só "masmorra" como mapaAtual.
    if (salvo.mundo && salvo.mundo.mapaAtual === "masmorra") salvo.mundo.mapaAtual = "dungeon1";
  },
  // v1 -> v2: Caminhos do Herdeiro (talentos/pontos/subclasse/herança/
  // presets, tasks #92-95) e a config de IA de auto-batalha (task #96).
  // Cobre o personagem principal E cada convocado do gacha já obtido —
  // qualquer um deles pode ganhar pontos de talento em combate de verdade
  // (ver concederPontosPorNivel em BattleUI.js, chamado pra todo `membro`
  // do time, não só o principal), então cada um precisa do próprio estado.
  (salvo) => {
    const p = salvo.personagem;
    garantirEstadoCaminho(p);
    garantirConfigAutoBatalha(p);
    ((p.gacha && p.gacha.personagensObtidos) || []).forEach((convocado) => garantirEstadoCaminho(convocado));
  },
];

// Migra um save carregado pro formato atual — idempotente (rodar duas vezes
// no mesmo save não muda nada da segunda vez em diante, porque só roda as
// migrações a partir de `salvo.saveVersion` e cada uma só preenche o que
// falta). Retorna o mesmo objeto `salvo`, já mutado e com
// `saveVersion === SAVE_VERSION`.
export function migrarSave(salvo) {
  if (!salvo || !salvo.personagem) return salvo;
  const versaoInicial = salvo.saveVersion || 0;
  for (let v = versaoInicial; v < MIGRACOES.length; v++) {
    MIGRACOES[v](salvo);
  }
  salvo.saveVersion = SAVE_VERSION;
  return salvo;
}

export function salvarJogo(estado) {
  try {
    // Migra (não só carimba o número): na prática `estado` já vem do
    // `personagem`/`mundo` vivos, que só existem em memória depois de
    // migrarSave() já ter rodado no load — mas chamar de novo aqui garante
    // que o QUE FOI ESCRITO no save realmente tem a versão que ele afirma
    // ter, mesmo que algum caminho futuro chame salvarJogo() direto com um
    // objeto que ainda não passou por um load (ex.: um save importado, ou
    // um teste). Idempotente e barato — nunca reescreve o que já existe.
    migrarSave(estado);
    localStorage.setItem(SAVE_KEY, JSON.stringify(estado));
    return true;
  } catch (e) {
    console.error("Falha ao salvar:", e);
    return false;
  }
}

export function carregarJogo() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrarSave(JSON.parse(raw));
  } catch (e) {
    console.error("Falha ao carregar:", e);
    return null;
  }
}

export function existeSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function apagarSave() {
  localStorage.removeItem(SAVE_KEY);
}
