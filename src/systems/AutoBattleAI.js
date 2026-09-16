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
    // --- Regras novas (pedido: "quero que pense mais dentro da batalha") ---
    // Todas nascem LIGADAS: são exatamente as decisões que faltavam, e
    // desligadas o comportamento volta a ser o antigo.
    usarArea: true,          // golpe em área quando rende mais que um alvo só
    bufarTime: true,         // reforçar o grupo antes de trocar golpe
    cuidarDosAliados: true,  // curar o TIME, não só a si mesmo
    defenderSobPressao: true,// defender quando não há como curar nem trocar
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
  if (typeof c.usarArea !== "boolean") c.usarArea = true;
  if (typeof c.bufarTime !== "boolean") c.bufarTime = true;
  if (typeof c.cuidarDosAliados !== "boolean") c.cuidarDosAliados = true;
  if (typeof c.defenderSobPressao !== "boolean") c.defenderSobPressao = true;
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

// --- APOIO, ÁREA E DEFESA -------------------------------------------------
//
// O que a IA não sabia fazer, e por que cada coisa importa agora:
//
//   ÁREA  — `TIPOS_OFENSIVOS` não incluía `dano_area`, então a IA
//           simplesmente NUNCA usava golpe em área. Isso passou de detalhe a
//           problema quando o tamanho do grupo inimigo passou a crescer com
//           o nível (ver EscalaSystem.js): com 3 ou 4 inimigos em campo,
//           bater num alvo só é a pior jogada disponível.
//
//   APOIO — a cura só olhava o PRÓPRIO HP do lutador. Um clérigo com o time
//           inteiro a 30% e ele a 100% atacava. E `buff_time`/`cura_area`,
//           que existem no motor e nas habilidades do gacha e da árvore,
//           nunca eram escolhidos por ninguém.
//
//   DEFESA— a ação Defender existia só para o jogador humano. Sem ela, um
//           lutador sem cura e sem Éter só sabia atacar até morrer.

const TIPOS_AREA = ["dano_area"];
const TIPOS_CURA_TIME = ["cura_area"];
const TIPOS_BUFF_TIME = ["buff_time"];
const TIPOS_DEBUFF_AREA = ["debuff_area"];

export function habilidadesDisponiveis(jogador, tipos) {
  return (jogador.habilidades || []).filter(
    (h) => tipos.includes(h.tipo) && h.cooldownAtual === 0 && jogador.mp >= (h.custoMP || 0),
  );
}

function melhorPorMultiplicador(lista) {
  if (!lista.length) return null;
  return [...lista].sort((a, b) => (b.multiplicador || 0) - (a.multiplicador || 0) || String(a.id).localeCompare(String(b.id)))[0];
}

export function fracaoVida(c) {
  return c && c.hpMax ? Math.max(0, c.hp) / c.hpMax : 1;
}

// Aliados vivos abaixo do limiar. `aliados` já inclui o próprio lutador
// quando quem chama passa o time inteiro — de propósito: para decidir cura
// de grupo, ele conta como qualquer outro.
export function aliadosFeridos(aliados, limiar) {
  return (aliados || []).filter((a) => a && a.vivo !== false && fracaoVida(a) < limiar);
}

// O time já está reforçado? Serve para não gastar o turno repetindo um buff
// que ainda está de pé — e é também o que faz o buff sair NO COMEÇO da luta
// sem precisar de contador de rodada: no primeiro turno ninguém tem buff, e
// depois disso a condição só volta a ser verdadeira quando ele expira.
export function timeJaReforcado(aliados) {
  return (aliados || []).some((a) => a && a.vivo !== false
    && (a.statusEffects || []).some((e) => e && (e.tipo === "buff_defesa" || e.tipo === "buff_ataque_proximo")));
}

export function inimigosJaLentos(inimigos) {
  const vivos = (inimigos || []).filter((i) => i && i.vivo !== false);
  if (!vivos.length) return true;
  return vivos.every((i) => (i.statusEffects || []).some((e) => e && e.tipo === "debuff_velocidade"));
}

// A ÁREA COMPENSA?
//
// Comparação de dano esperado: `multiplicador × nº de alvos` contra o melhor
// golpe de alvo único. Mas dano total não é o objetivo — MATAR é. Espalhar
// 1,2 entre dois inimigos deixa os dois vivos e batendo; concentrar 2,0 num
// deles pode derrubá-lo e tirar metade do dano que o time vai receber.
//
// Por isso a margem depende de quantos alvos há:
//   • 2 inimigos → exige 50% a mais. Com dois em campo, matar um corta o
//     dano inimigo pela metade; a área precisa ser claramente melhor para
//     valer abrir mão disso.
//   • 3 ou mais  → 15% basta. Aí matar um ainda deixa dois batendo, e o
//     dano total volta a ser o que importa.
//
// (A primeira versão usava 15% para todo mundo, e a IA gastava área contra
// dois inimigos fracos quando um golpe forte teria derrubado um deles.)
export const MARGEM_AREA = 1.15;
export const MARGEM_AREA_DOIS_ALVOS = 1.5;

export function margemDaArea(nInimigos) {
  return nInimigos <= 2 ? MARGEM_AREA_DOIS_ALVOS : MARGEM_AREA;
}

export function valeAPenaArea(habArea, nInimigos, melhorAlvoUnico) {
  if (!habArea || nInimigos < 2) return false;
  const ganhoArea = (habArea.multiplicador || 1) * nInimigos;
  const ganhoUnico = (melhorAlvoUnico && melhorAlvoUnico.multiplicador) || 1;
  return ganhoArea >= ganhoUnico * margemDaArea(nInimigos);
}

// Guardar Éter para a cura: gastar o último Éter numa área e deixar o time
// sem cura no turno seguinte é a troca errada. Só bloqueia quem TEM cura.
export function sobraEterParaCurar(jogador, custo) {
  const cura = (jogador.habilidades || []).find((h) => h.tipo === "cura" || h.tipo === "cura_area");
  if (!cura) return true;
  return (jogador.mp - (custo || 0)) >= (cura.custoMP || 0);
}

// Defender: quando não há como curar, não há Éter para nada e a vida está
// baixa. Trocar golpe nessa situação é apostar em morrer primeiro; defender
// obriga o atacante a superar a defesa no d20 (ver resolverAcaoD20).
export function podeCurar(c) {
  return (c.habilidades || []).some(
    (h) => (h.tipo === "cura" || h.tipo === "cura_area") && h.cooldownAtual === 0 && c.mp >= (h.custoMP || 0),
  );
}

// DEFENDER É PARA GANHAR UM TURNO, NÃO PARA ADIAR A MORTE.
//
// A primeira versão desta regra mandava defender sempre que a vida estivesse
// baixa e não houvesse cura. Isso produz um lutador que defende TODO turno
// até morrer, porque a condição nunca deixa de ser verdadeira — a guarda não
// cura ninguém. Defender só faz sentido quando existe uma razão para o
// próximo turno ser melhor que este: alguém do time consegue curar. Aí a
// guarda compra exatamente o turno de que o curandeiro precisa.
//
// Três travas, todas necessárias:
//   • estado CRÍTICO (metade do limiar), não só "ferido";
//   • a guarda ainda não estar de pé (ela dura até o próximo golpe inimigo);
//   • existir um aliado capaz de curar no turno seguinte.
export function deveDefender(jogador, config, limiar, aliados = []) {
  if (!config.defenderSobPressao) return false;
  if (jogador.defendendo) return false;
  if (fracaoVida(jogador) >= limiar / 2) return false;
  if (podeCurar(jogador)) return false;
  return (aliados || []).some((a) => a && a !== jogador && a.vivo !== false && podeCurar(a));
}

// Decisão completa de UM turno automático. Retorna sempre um objeto com
// `tipo`: "curar" | "curar_time" | "buff_time" | "debuff_area" | "area" |
// "defender" | "habilidade" | "ataque" | "fugir".
//
// `contexto.aliados` é o time do lutador (inclusive ele). Sem esse dado a IA
// decide como antes — nenhuma das regras de apoio dispara —, então nenhum
// chamador antigo muda de comportamento por não ter sido atualizado.
export function escolherAcaoAutomatica(jogador, inimigosVivos, config, dados, contexto = {}) {
  const limiar = limiarCura(config);
  const aliados = (contexto.aliados || []).filter((a) => a && a.vivo !== false);
  const vivos = inimigosVivos.filter((i) => i && i.vivo !== false);

  // 1. CURA DE GRUPO. Vem antes da cura própria porque um clérigo com dois
  //    aliados a 30% e ele a 100% precisa agir pelo TIME — a regra antiga
  //    olhava só o HP dele e mandava atacar.
  if (config.cuidarDosAliados && aliados.length) {
    const curaTime = melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_CURA_TIME));
    const feridos = aliadosFeridos(aliados, limiar);
    // Dois feridos justificam a cura de grupo; um só justifica se estiver
    // em estado crítico (metade do limiar), senão a cura de alvo único é
    // mais econômica.
    const critico = aliadosFeridos(aliados, limiar / 2).length >= 1;
    if (curaTime && (feridos.length >= 2 || critico)) {
      return { tipo: "curar_time", habilidade: curaTime, alvo: jogador };
    }
  }

  // 2. CURA PRÓPRIA — o comportamento de sempre.
  const cura = jogador.habilidades.find((h) => h.tipo === "cura" && h.cooldownAtual === 0 && jogador.mp >= h.custoMP);
  if (cura && fracaoVida(jogador) < limiar) {
    return { tipo: "curar", habilidade: cura };
  }

  if (!vivos.length) return { tipo: "fugir" };

  // 3. REFORÇAR O TIME antes de trocar golpe (pedido explícito: "para os
  //    clérigos pensar em bufar aliados no começo do turno"). Não precisa de
  //    contador de rodada: a condição "ninguém está reforçado" só é
  //    verdadeira no começo da luta e quando o reforço expira.
  if (config.bufarTime && aliados.length >= 2 && !timeJaReforcado(aliados)) {
    const buff = melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_BUFF_TIME));
    if (buff && sobraEterParaCurar(jogador, buff.custoMP || 0)) {
      return { tipo: "buff_time", habilidade: buff, alvo: jogador };
    }
  }

  // 4. DEFENDER quando não há cura nem habilidade ofensiva possível.
  if (deveDefender(jogador, config, limiar, aliados)) return { tipo: "defender" };

  // 5. ATRASAR A HORDA. Só com muitos inimigos e só enquanto algum deles
  //    ainda estiver rápido — repetir o debuff num campo já lento é gastar
  //    o turno à toa.
  if (config.usarArea && vivos.length >= 3 && !inimigosJaLentos(vivos)) {
    const debuff = melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_DEBUFF_AREA));
    if (debuff && sobraEterParaCurar(jogador, debuff.custoMP || 0)) {
      return { tipo: "debuff_area", habilidade: debuff, alvo: vivos[0] };
    }
  }

  let candidatas = habilidadesOfensivasDisponiveis(jogador);
  const ultimate = habilidadeUltimate(jogador);
  const alvo = escolherAlvoAutomatico(jogador, vivos, config, dados, ultimate);
  if (!alvo) return { tipo: "fugir" };

  // 6. GOLPE EM ÁREA quando rende mais que bater num alvo só. A comparação
  //    é de dano esperado (multiplicador × alvos), não "tem área, usa área":
  //    contra dois inimigos fracos um golpe forte de alvo único pode valer
  //    mais, e a área custa Éter e recarga.
  if (config.usarArea) {
    const area = melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_AREA));
    if (area && valeAPenaArea(area, vivos.length, ultimate) && sobraEterParaCurar(jogador, area.custoMP || 0)) {
      return { tipo: "area", habilidade: area, alvo };
    }
  }

  // Preservar ultimate: só gasta a habilidade de maior multiplicador contra
  // um chefe ou quando é o último inimigo em pé (garante o abate) — contra
  // um inimigo comum com outros vivos, guarda ela e usa outra coisa.
  if (config.preservarUltimate && ultimate && candidatas.length > 1) {
    const podeGastarUltimate = alvo.chefe || vivos.length === 1;
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
