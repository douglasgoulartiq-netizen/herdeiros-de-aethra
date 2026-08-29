// IA de batalha automática avançada (task #96) — motor puro, sem DOM e sem
// depender de uma instância de `Batalha`: recebe combatentes já criados
// (mesmo formato de CombatSystem.js) e devolve uma DECISÃO ({tipo, alvo,
// habilidade}); quem executa de verdade (chamar batalha.usarHabilidade/
// ataqueBasico/fugir) é BattleUI.js, exatamente como já fazia antes desta
// task existir — só a escolha ficou mais esperta.
//
// Substitui o `agirAutomaticamente()` antigo (escolhia sempre o inimigo com
// menos HP, curava só abaixo de 35% fixo, e usava a PRIMEIRA habilidade
// ofensiva disponível com 70% de chance) por um sistema configurável:
//   - 3 modos (conservador/equilibrado/agressivo) — controlam o quão cedo
//     cura e o quão disposto está a gastar MP em habilidades.
//   - 5 regras independentes, ligadas/desligadas por fora do modo: preservar
//     a habilidade mais forte pros chefes, focar chefe, eliminar suporte
//     primeiro, explorar fraqueza elemental, priorizar combo/reação.
// A configuração fica em `personagem.autoBatalhaConfig` — persiste no save
// automaticamente (mesmo padrão de caminhoHerdeiro/estadoDoMundo/etc.:
// tudo dentro do objeto `personagem`, sem campo novo no contrato de save).
import { relacaoElemental } from "./ElementSystem.js";
import { estadoElementalAtivo, peekReacaoElemental } from "./ElementalReactionSystem.js";

export const MODOS_AUTO_BATALHA = ["conservador", "equilibrado", "agressivo"];

export const LABEL_MODO = {
  conservador: "🛡️ Conservador",
  equilibrado: "⚖️ Equilibrado",
  agressivo: "⚔️ Agressivo",
};

// Cada modo só define dois números-base; as 5 regras abaixo são
// independentes do modo (um jogador Agressivo também pode querer preservar
// a ultimate pros chefes, por exemplo).
export const PRESETS_MODO = {
  conservador: { curarAbaixoDe: 0.5, chanceUsarHabilidade: 0.5 },
  equilibrado: { curarAbaixoDe: 0.35, chanceUsarHabilidade: 0.7 },
  agressivo: { curarAbaixoDe: 0.2, chanceUsarHabilidade: 0.95 },
};

export function configAutoBatalhaPadrao() {
  return {
    modo: "equilibrado",
    curarAbaixoDe: null, // null = usa o padrão do modo; 0-1 sobrescreve manualmente
    preservarUltimate: false,
    focarChefe: true,
    eliminarSuporte: true,
    explorarFraquezaElemental: true,
    priorizarCombo: true,
  };
}

// Backfill defensivo — mesmo padrão de garantirEstadoCaminho/
// garantirEstadoDoMundo/garantirCompendio já usado no projeto: qualquer
// personagem, novo ou de um save antigo de antes desta task existir, ganha
// uma config válida sem precisar de migração formal de save.
export function garantirConfigAutoBatalha(personagem) {
  if (!personagem.autoBatalhaConfig) personagem.autoBatalhaConfig = configAutoBatalhaPadrao();
  const c = personagem.autoBatalhaConfig;
  if (!MODOS_AUTO_BATALHA.includes(c.modo)) c.modo = "equilibrado";
  if (typeof c.preservarUltimate !== "boolean") c.preservarUltimate = false;
  if (typeof c.focarChefe !== "boolean") c.focarChefe = true;
  if (typeof c.eliminarSuporte !== "boolean") c.eliminarSuporte = true;
  if (typeof c.explorarFraquezaElemental !== "boolean") c.explorarFraquezaElemental = true;
  if (typeof c.priorizarCombo !== "boolean") c.priorizarCombo = true;
  if (c.curarAbaixoDe != null && (typeof c.curarAbaixoDe !== "number" || c.curarAbaixoDe < 0 || c.curarAbaixoDe > 1)) c.curarAbaixoDe = null;
  return c;
}

export function limiarCura(config) {
  return config.curarAbaixoDe != null ? config.curarAbaixoDe : PRESETS_MODO[config.modo].curarAbaixoDe;
}

export function chanceUsarHabilidade(config) {
  return PRESETS_MODO[config.modo].chanceUsarHabilidade;
}

// Mesma lista de CombatSystem.js/BattleUI.js (dano_fisico, dano_magico,
// dano_fisico_des, dano_ignora_defesa, debuff_velocidade) — repetida aqui
// (não importada de BattleUI.js) porque este módulo precisa ficar livre de
// DOM pra ser testável puro; BattleUI.js continua sendo a única fonte de
// verdade sobre QUAIS tipos de habilidade existem no jogo.
const TIPOS_OFENSIVOS = ["dano_fisico", "dano_magico", "dano_fisico_des", "dano_ignora_defesa", "debuff_velocidade"];

export function habilidadesOfensivasDisponiveis(jogador) {
  return jogador.habilidades.filter((h) => TIPOS_OFENSIVOS.includes(h.tipo) && h.cooldownAtual === 0 && jogador.mp >= h.custoMP);
}

// "Ultimate", pra fins de IA, é a habilidade ofensiva disponível de maior
// multiplicador — não depende de metadado de talento (que não existe mais
// no combatente em combate, só na origem em TalentSystem.js), então
// funciona igual pra qualquer classe/origem de habilidade.
export function habilidadeUltimate(jogador) {
  const ofensivas = habilidadesOfensivasDisponiveis(jogador);
  if (!ofensivas.length) return null;
  return [...ofensivas].sort((a, b) => (b.multiplicador || 0) - (a.multiplicador || 0) || String(a.id).localeCompare(String(b.id)))[0];
}

function tipoFisicoDaHabilidade(h) {
  return !h || h.tipo !== "dano_magico";
}

function elementoDaHabilidade(h, jogador) {
  return (h && h.elemento) || jogador.elemento || "fisico";
}

// Pontuação de um alvo candidato — quanto maior, mais prioritário. Cada
// regra desligada simplesmente não contribui nenhum ponto (nunca penaliza),
// então desligar tudo volta pro comportamento antigo: só HP mais baixo.
export function pontuarAlvo(inimigo, jogador, habilidadeCandidata, config, dados) {
  let pontos = (1 - inimigo.hp / Math.max(1, inimigo.hpMax)) * 10;
  if (config.focarChefe && inimigo.chefe) pontos += 50;
  if (config.eliminarSuporte && inimigo.arquetipo === "suporte") pontos += 30;
  const elemento = elementoDaHabilidade(habilidadeCandidata, jogador);
  if (config.explorarFraquezaElemental && dados && dados.elements) {
    const relacao = relacaoElemental(elemento, inimigo.elemento, dados.elements);
    if (relacao === "vantagem_intensa") pontos += 25;
    else if (relacao === "vantagem") pontos += 15;
    else if (relacao === "resistencia" || relacao === "resistencia_intensa") pontos -= 10;
  }
  if (config.priorizarCombo && dados && dados.elementalReactions) {
    const estado = estadoElementalAtivo(inimigo);
    if (estado) {
      const { ocorreu } = peekReacaoElemental(inimigo, elemento, tipoFisicoDaHabilidade(habilidadeCandidata), dados.elementalReactions);
      if (ocorreu) pontos += 40;
    }
  }
  return pontos;
}

// `habilidadeCandidata` é opcional — representa a habilidade mais provável
// de ser usada (normalmente a ultimate disponível), só pra saber que
// elemento considerar na hora de avaliar fraqueza/combo. Se vier nula,
// cai pro elemento da arma (ataque básico).
export function escolherAlvoAutomatico(jogador, inimigosVivos, config, dados, habilidadeCandidata = null) {
  if (!inimigosVivos.length) return null;
  return [...inimigosVivos].sort((a, b) => pontuarAlvo(b, jogador, habilidadeCandidata, config, dados) - pontuarAlvo(a, jogador, habilidadeCandidata, config, dados))[0];
}

// Decisão completa de UM turno automático. Retorna sempre um objeto com
// `tipo`: "curar" | "habilidade" | "ataque" | "fugir".
export function escolherAcaoAutomatica(jogador, inimigosVivos, config, dados) {
  // Curar tem prioridade sobre tudo, igual ao comportamento original — só
  // que agora o limiar é configurável (por modo ou por override manual) em
  // vez de 35% fixo pra qualquer jogador.
  const cura = jogador.habilidades.find((h) => h.tipo === "cura" && h.cooldownAtual === 0 && jogador.mp >= h.custoMP);
  if (cura && jogador.hp / Math.max(1, jogador.hpMax) < limiarCura(config)) {
    return { tipo: "curar", habilidade: cura };
  }

  if (!inimigosVivos.length) return { tipo: "fugir" };

  let candidatas = habilidadesOfensivasDisponiveis(jogador);
  const ultimate = habilidadeUltimate(jogador);
  const alvo = escolherAlvoAutomatico(jogador, inimigosVivos, config, dados, ultimate);
  if (!alvo) return { tipo: "fugir" };

  // Preservar ultimate: só gasta a habilidade de maior multiplicador contra
  // um chefe ou quando é o último inimigo em pé (garante o abate) — contra
  // um inimigo comum com outros vivos, guarda ela e usa outra coisa.
  if (config.preservarUltimate && ultimate && candidatas.length > 1) {
    const podeGastarUltimate = alvo.chefe || inimigosVivos.length === 1;
    if (!podeGastarUltimate) candidatas = candidatas.filter((h) => h.id !== ultimate.id);
  }

  if (!candidatas.length) return { tipo: "ataque", alvo };

  // Se existe uma reação elemental de verdade disponível AGORA contra o
  // alvo escolhido, usa a habilidade que dispara ela — um combo real
  // sempre vale mais que a chance aleatória de usar habilidade.
  if (config.priorizarCombo && dados && dados.elementalReactions && estadoElementalAtivo(alvo)) {
    const comboHabilidade = candidatas.find((h) => peekReacaoElemental(alvo, elementoDaHabilidade(h, jogador), tipoFisicoDaHabilidade(h), dados.elementalReactions).ocorreu);
    if (comboHabilidade) return { tipo: "habilidade", habilidade: comboHabilidade, alvo };
  }

  if (Math.random() < chanceUsarHabilidade(config)) {
    const melhor = [...candidatas].sort((a, b) => (b.multiplicador || 0) - (a.multiplicador || 0))[0];
    return { tipo: "habilidade", habilidade: melhor, alvo };
  }
  return { tipo: "ataque", alvo };
}
