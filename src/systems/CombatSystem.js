// Sistema de batalha ATB (Active Time Battle) com regras inspiradas em d20.
import { atributosEfetivos, defesaTotal, velocidadeTotal, ataqueBase, critBonusTotal } from "./CharacterFactory.js";
import { relacaoElemental, multiplicadorElemental } from "./ElementSystem.js";
import { escolherAlvoPorArquetipo, deveHesitar } from "./EnemyAI.js";
import { FLAGS } from "../data/featureFlags.js";
import {
  modificadorDanoRecebidoEstado, modificadorCuraRecebidaEstado, modificadorDefesaEstado,
  modificadorVelocidadeEstado, estaControladoPorEstado, penalidadeD20Estado,
  verificarReacaoElemental, peekReacaoElemental, aplicarEstadoElemental, estadoElementalAtivo,
} from "./ElementalReactionSystem.js";
import { multiplicadorDificuldade } from "./AccessibilitySystem.js";

// Task #43 (formação): só estes arquétipos são "bloqueados" pela frente do
// time — os demais (à distância, mágicos ou furtivos) alcançam a retaguarda
// livremente. Ver escolherAlvoIA().
const ARQUETIPOS_RESPEITAM_FORMACAO = new Set(["agressor", "fanatico", "aleatorio", "covarde"]);

export function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

// `posicao` ("frente" | "retaguarda", ver FormationSystem.js) vem já
// resolvida de fora — este módulo só guarda e reage a ela, nunca decide
// posição sozinho.
export function criarCombatenteJogador(personagem, dados, posicao = "frente") {
  return {
    id: "player",
    nome: personagem.nome,
    isPlayer: true,
    hp: personagem.hp,
    hpMax: personagem.hpMax,
    mp: personagem.mp,
    mpMax: personagem.mpMax,
    atributos: atributosEfetivos(personagem, dados),
    defesa: defesaTotal(personagem, dados),
    velocidade: velocidadeTotal(personagem, dados),
    ataque: ataqueBase(personagem, dados),
    critBonus: critBonusTotal(personagem, dados),
    elemento: (personagem.equipamento.arma && personagem.equipamento.arma.elemento) || "fisico",
    habilidades: personagem.habilidades.map((h) => ({ ...h, cooldownAtual: 0 })),
    tracoId: personagem.tracoId,
    racaId: personagem.racaId,
    classeId: personagem.classeId,
    sorteUsada: false,
    primeiroTurno: true,
    atb: 0,
    atbMax: 100,
    statusEffects: [],
    spriteKey: personagem.spriteKey,
    sopro_usado: false,
    defendendo: false,
    posicao,
    vivo: true,
  };
}

// New Game+ (melhoria de jogabilidade pós-backlog original): cada nível de
// NG+ escala hp/ataque/defesa dos monstros pra cima e a recompensa (xp/ouro)
// junto — reinicia a aventura mais desafiadora, mas justa (quem enfrenta
// monstro mais forte também ganha mais por ele). Velocidade fica de fora de
// propósito: escalar iniciativa também tornaria o ATB do jogador cada vez
// mais irrelevante a cada ciclo, em vez de só "mais duro de matar".
export const NG_PLUS_ESCALA_POR_NIVEL = 0.22;

function multiplicadorNgPlus(ngPlus) {
  return 1 + NG_PLUS_ESCALA_POR_NIVEL * Math.max(0, ngPlus || 0);
}

// Modo História (melhoria pós-backlog): opção de dificuldade mais leve,
// escolhida uma vez na criação de personagem (ver CharacterCreationUI.js/
// CharacterFactory.js: personagem.modoHistoria) pra quem quer focar na
// narrativa e exploração sem a pressão do combate padrão. Reduz só hp/
// ataque/defesa dos monstros — de propósito NÃO reduz XP/ouro (ver
// `multRecompensa` abaixo, que ignora modoHistoria), pra não punir
// economicamente quem escolhe jogar assim. É o contrário exato de NG+
// (que fica mais difícil E rende mais); os dois multiplicadores compõem
// entre si caso um save NG+ também tenha modoHistoria ligado.
export const MODO_HISTORIA_REDUCAO = 0.3;

function multiplicadorModoHistoria(modoHistoria) {
  return modoHistoria ? 1 - MODO_HISTORIA_REDUCAO : 1;
}

export function criarCombatenteInimigo(monstroDef, idx, ngPlus = 0, modoHistoria = false) {
  // `multRecompensa` só reflete NG+ (recompensa nunca cai por causa do Modo
  // História nem da dificuldade); `multEstat` soma os três efeitos pra
  // hp/ataque/defesa. Dificuldade (melhoria de jogabilidade pós-backlog,
  // ver AccessibilitySystem.js/DIFICULDADES): preferência do JOGADOR, pode
  // ser trocada a qualquer momento sem reiniciar a run — "normal" (1x) é
  // idêntico ao comportamento de antes desta opção existir.
  const multRecompensa = multiplicadorNgPlus(ngPlus);
  const multEstat = multRecompensa * multiplicadorModoHistoria(modoHistoria) * multiplicadorDificuldade();
  const hpEscalado = Math.max(1, Math.round(monstroDef.hp * multEstat));
  const atkEscalado = Math.max(1, Math.round(monstroDef.atk * multEstat));
  const defesaEscalada = Math.max(0, Math.round(monstroDef.defesa * multEstat));
  return {
    id: `${monstroDef.id}_${idx}`,
    monstroId: monstroDef.id,
    nome: monstroDef.nome,
    isPlayer: false,
    hp: hpEscalado,
    hpMax: hpEscalado,
    mp: 0,
    mpMax: 0,
    atributos: { FOR: atkEscalado, DES: monstroDef.vel, CON: defesaEscalada * 2, INT: atkEscalado },
    defesa: defesaEscalada,
    velocidade: monstroDef.vel,
    ataque: { dano: atkEscalado, atributo: "FOR", bonusCritico: 0 },
    elemento: monstroDef.elemento || "fisico",
    habilidades: [],
    sorteUsada: false,
    primeiroTurno: true,
    atb: Math.random() * 40,
    atbMax: 100,
    statusEffects: [],
    spriteKey: monstroDef.sprite,
    chefe: !!monstroDef.chefe,
    solo: !!monstroDef.solo, // task #46: monstro reforçado por estar sozinho contra o time
    emboscada: !!monstroDef.emboscada, // melhoria pós-backlog: atacante extra por reputação regional negativa (ver EncounterSystem.js)
    // Barra de quebra (melhoria pós-backlog): só chefes acumulam postura.
    postura: 0,
    posturaMax: monstroDef.chefe ? POSTURA_MAX_CHEFE : 0,
    atordoado: false,
    arquetipo: monstroDef.arquetipo || "aleatorio",
    defendendo: false,
    // Estado das ações especiais dos arquétipos Ladrão/Invocador — cada um só
    // usa sua habilidade única uma vez por batalha, depois volta a atacar.
    jaRoubou: false,
    jaInvocou: false,
    // Definição opcional (src/data/monsters.json: campo "invocacao") do
    // reforço que um Invocador chama à batalha; sem ela, invocar() usa um
    // clone enfraquecido do próprio invocador.
    invocacaoDef: monstroDef.invocacao || null,
    vivo: true,
    // Recompensa também escala com NG+ (só NG+ — ver multRecompensa acima).
    xp: Math.max(1, Math.round(monstroDef.xp * multRecompensa)),
    ouroMin: Math.max(0, Math.round(monstroDef.ouroMin * multRecompensa)),
    ouroMax: Math.max(0, Math.round(monstroDef.ouroMax * multRecompensa)),
  };
}

// Barra de quebra/exposição de chefe (melhoria de jogabilidade pós-backlog
// original): acertar a fraqueza elemental do chefe enche a postura dele mais
// rápido que um golpe neutro; ao encher, o chefe fica ATORDOADO — perde a
// próxima ação e recebe dano bônus enquanto durar. Só chefes (`chefe:true`)
// têm `posturaMax` definido; monstros comuns ficam com posturaMax:0 e nunca
// acumulam nada (ver acumularQuebra). Só o time do jogador enche a barra.
const POSTURA_MAX_CHEFE = 100;
const GANHO_QUEBRA_POR_RELACAO = {
  vantagem_intensa: 30,
  vantagem: 18,
  neutro: 8,
  resistencia: 3,
  resistencia_intensa: 1,
  imune: 0,
};
const BONUS_DANO_ATORDOADO = 1.35;

// Terreno (task #42): elemento dominante do bioma/masmorra deixa esse
// elemento mais forte para QUALQUER atacante (ex.: fogo no deserto), mas dá
// resistência aos inimigos do encontro contra esse mesmo elemento — eles são
// nativos do terreno, então já se adaptaram a ele. As duas coisas juntas se
// cancelam parcialmente quando o jogador ataca um inimigo local com o
// elemento do terreno (ligeira desvantagem, ~0.96x), incentivando variar o
// elemento contra a fauna nativa e recompensando esse elemento em qualquer
// outra situação (chefes de fora do bioma, PvE geral). Aditivo sobre a
// matriz elemental (ElementSystem.js) — nunca a substitui.
const BONUS_ATAQUE_TERRENO = 1.2;
const RESISTENCIA_TERRENO_INIMIGO = 0.8;

// Clima (melhoria de jogabilidade pós-backlog original, ver WeatherSystem.js):
// mesma ideia do terreno acima, mas mais fraca de propósito — o terreno é
// permanente/estrutural do bioma, o clima é passageiro (muda a cada poucos
// minutos reais). Os dois multiplicadores SOMAM quando o elemento do clima
// bate com o do terreno (ex.: chuva — água — no meio de um pântano de água),
// em vez de um substituir o outro.
const BONUS_ATAQUE_CLIMA = 1.1;
const RESISTENCIA_CLIMA_INIMIGO = 0.9;

// Combo elemental entre aliados (melhoria de jogabilidade pós-backlog
// original): quando um aliado acerta um inimigo, e o PRÓXIMO golpe aliado
// que acerta O MESMO inimigo vem de um companheiro DIFERENTE com um
// elemento complementar (ver COMBOS_ELEMENTAIS), esse golpe ganha dano
// bônus e um aviso especial no log — recompensa focar o mesmo alvo com um
// time elementalmente variado, em vez de só "quem bate mais forte".
// Aditivo sobre a matriz de vantagem/resistência elemental
// (ElementSystem.js) — nunca a substitui, e continua valendo mesmo contra
// um alvo elementalmente neutro/resistente ao golpe. Gira em janela livre
// (não expira sozinho por tempo/turnos) — só é "consumido" quando um novo
// golpe aliado no mesmo alvo o encadeia ou quebra o combo (alvo muda, ou o
// MESMO aliado ataca de novo antes de outro companheiro entrar). Isso
// significa que dois aliados alternando golpes complementares no mesmo alvo
// mantêm o bônus continuamente — intencional: recompensa a decisão tática
// de manter o time focando o mesmo inimigo, não é "grátis" o tempo todo.
const BONUS_DANO_COMBO = 1.3;
const COMBOS_ELEMENTAIS = [
  { par: ["fogo", "vento"], nome: "Labareda ao Vento", icone: "🔥🌪️" },
  { par: ["agua", "raio"], nome: "Corrente Elétrica", icone: "💧⚡" },
  { par: ["gelo", "terra"], nome: "Terra Congelada", icone: "❄️⛰️" },
  { par: ["natureza", "veneno"], nome: "Floração Tóxica", icone: "🌿☠️" },
  { par: ["radiante", "arcano"], nome: "Luz Arcana", icone: "✨🔮" },
  { par: ["sombrio", "veneno"], nome: "Corrupção Sombria", icone: "🌑☠️" },
];

// Exportada (melhoria de jogabilidade: prévia de combo elemental antes de
// confirmar o ataque, ver BattleUI.js) — mesma função usada internamente por
// verificarComboElemental(), só que sem nenhum efeito colateral, então pode
// ser chamada livremente só pra checar "e se" sem consumir nem alterar
// `ultimoAtaqueAliado`.
export function comboDoisElementos(elementoA, elementoB) {
  if (!elementoA || !elementoB || elementoA === elementoB) return null;
  return COMBOS_ELEMENTAIS.find((c) => (c.par[0] === elementoA && c.par[1] === elementoB) || (c.par[0] === elementoB && c.par[1] === elementoA)) || null;
}

export class Batalha {
  // `time` é um array de 1 a 4 combatentes do jogador (criados via
  // criarCombatenteJogador), sempre com o personagem principal em time[0].
  // `dadosElementos` é o conteúdo de src/data/elements.json (opcional — sem
  // ele, ou com FLAGS.elementos desligada, o dano continua neutro, igual a
  // antes deste sistema existir).
  // `terrenoElemento` (task #42): id do elemento dominante do terreno atual
  // (ex.: "fogo" no deserto) ou null/undefined fora de zonas com terreno
  // definido — ver terrenoElementoAtual() em main.js.
  // `levasExtras` (task #47, hordas): array de arrays de monstroDef pras
  // ondas 2 em diante — `inimigos` (parâmetro) é sempre só a 1ª onda. Vazio
  // (padrão) = combate comum de 1 onda só, comportamento idêntico a antes
  // desta task existir.
  // `ngPlus` (New Game+, melhoria pós-backlog): nível de New Game+ do
  // personagem — 0 no jogo normal. Só afeta INIMIGOS NOVOS criados durante
  // a própria batalha (leva extra de horda, ver avancarLeva()); os
  // `inimigos` da 1ª onda já chegam prontos (escalados por quem chamou
  // criarCombatenteInimigo antes de montar a Batalha, ver BattleUI.js).
  // `climaElemento` (melhoria pós-backlog, ver WeatherSystem.js): elemento
  // favorecido pelo clima ATUAL da zona (ex.: "agua" durante chuva), ou
  // null fora do mundo aberto / com céu limpo — ver climaAtual() em main.js.
  // `modoHistoria` (melhoria pós-backlog): igual a `ngPlus` acima, só afeta
  // inimigos NOVOS criados durante a própria batalha (leva extra de horda,
  // ver avancarLeva()) — a 1ª onda já chega escalada de quem chamou
  // criarCombatenteInimigo antes de montar a Batalha (ver BattleUI.js).
  // `dadosEstados`/`dadosReacoes` (Caminhos do Herdeiro, task #91): conteúdo
  // de elementalStates.json/elementalReactions.json, opcionais — sem eles
  // (ou com FLAGS.reacoesElementais desligada), nenhuma habilidade tem como
  // aplicar estado nenhum, então o motor de reações fica inerte e o combate
  // continua idêntico a antes desses dois arquivos existirem.
  constructor(time, inimigos, dadosElementos = null, terrenoElemento = null, levasExtras = [], ngPlus = 0, climaElemento = null, modoHistoria = false, dadosEstados = null, dadosReacoes = null) {
    this.time = time;
    this.inimigos = inimigos;
    this.dadosElementos = dadosElementos;
    this.dadosEstados = dadosEstados || null;
    this.dadosReacoes = dadosReacoes || null;
    this.terrenoElemento = terrenoElemento || null;
    this.climaElemento = climaElemento || null;
    this.ngPlus = ngPlus || 0;
    this.modoHistoria = !!modoHistoria;
    this.log = [];
    this.terminada = false;
    this.resultado = null; // 'vitoria' | 'derrota' | 'fuga'
    // Ouro roubado por inimigos Ladrão ao longo da batalha — a UI (BattleUI)
    // deduz esse total do ouro real do personagem ao encerrar o combate,
    // qualquer que seja o resultado (o furto já aconteceu, vitória não
    // devolve o que foi roubado).
    this.ouroRoubado = 0;
    // Hordas (task #47): `this.inimigos` só guarda a onda ATUAL (pra IA,
    // alvo e renderização olharem só quem está na arena agora — ver
    // avancarLeva()); `historicoInimigos` acumula TODOS os inimigos de
    // TODAS as ondas, já derrotados ou não, pra recompensa final (XP/ouro/
    // loot/compêndio em BattleUI.js) somar a horda inteira, não só a última
    // onda.
    this.levasRestantes = [...levasExtras];
    this.historicoInimigos = [...inimigos];
    this.levaAtual = 1;
    this.totalLevas = 1 + levasExtras.length;
    // Combo elemental entre aliados (melhoria pós-backlog, ver
    // COMBOS_ELEMENTAIS acima): guarda o ÚLTIMO golpe aliado que acertou um
    // inimigo, pra saber se o PRÓXIMO golpe aliado forma um combo. Guarda
    // as referências dos objetos combatente em si (não `.id`) porque todo
    // combatente do time do jogador usa o mesmo id fixo "player"
    // (ver criarCombatenteJogador) — comparar por `.id` não distinguiria
    // dois membros diferentes do time.
    this.ultimoAtaqueAliado = null;
    // Ganchos de animação (melhoria de jogabilidade: golpes visíveis em
    // combate, ver BattleUI.js/DiceAnimation.js). Nenhum dos dois muda
    // qualquer regra ou número de jogo — só registram "o que aconteceu na
    // última rolagem/quebra de postura" pra UI decidir o que animar, sem
    // precisar espionar o retorno interno de cada método de ataque (que já
    // tem formatos diferentes entre ataqueBasico/usarHabilidade/etc.).
    // `rolagemSeq`/`quebraSeq` sobem a cada evento — a UI compara o valor
    // antes/depois de chamar uma ação pra saber se UM NOVO evento aconteceu
    // durante ela (nunca reaproveita um evento de uma ação anterior).
    this.rolagemSeq = 0;
    this.ultimaRolagem = null; // { seq, d, critico, erroTotal, bloqueado, atacante, alvo }
    this.quebraSeq = 0;
    this.ultimaQuebra = null; // { seq, alvo }
  }

  todos() {
    return [...this.time, ...this.inimigos];
  }

  timeVivo() {
    return this.time.filter((c) => c.vivo);
  }

  inimigosVivos() {
    return this.inimigos.filter((i) => i.vivo);
  }

  registrar(msg) {
    this.log.push(msg);
    if (this.log.length > 60) this.log.shift();
  }

  aplicarStatusTick(c) {
    c.statusEffects = c.statusEffects.filter((s) => {
      // Condição aplicada pelo arquétipo Controlador: dano gradual baseado
      // em porcentagem do HP máximo, a cada tick, enquanto durar.
      if (s.tipo === "condicao_veneno" && c.vivo) {
        const dano = Math.max(1, Math.round(c.hpMax * s.valor));
        this.aplicarDano(c, dano);
        this.registrar(`${c.nome} sofre ${dano} de dano por veneno!`);
      }
      // Estados elementais com dano por turno (Caminhos do Herdeiro, task
      // #91) — hoje só Incendiado, ver elementalStates.json.
      if (s.tipo === "estado_elemental" && c.vivo && s.def && s.def.danoPorTurnoPercentHpMax) {
        const dano = Math.max(1, Math.round(c.hpMax * s.def.danoPorTurnoPercentHpMax));
        this.aplicarDano(c, dano);
        this.registrar(`${s.def.icone || ""} ${c.nome} sofre ${dano} de dano por estar ${s.def.nome}!`);
      }
      s.duracao -= 1;
      return s.duracao > 0 && c.vivo;
    });
  }

  modificadorVelocidade(c) {
    let vel = c.velocidade;
    if (c.isPlayer && c.tracoId === "corajoso" && c.hp / c.hpMax <= 0.3) vel += 3;
    const debuff = c.statusEffects.find((s) => s.tipo === "debuff_velocidade");
    if (debuff) vel *= 1 - debuff.valor;
    if (FLAGS.reacoesElementais) vel *= modificadorVelocidadeEstado(c);
    return Math.max(1, vel);
  }

  avancarATB(incremento) {
    const prontos = [];
    for (const c of this.todos()) {
      if (!c.vivo) continue;
      c.atb += this.modificadorVelocidade(c) * incremento;
      if (c.atb >= c.atbMax) prontos.push(c);
    }
    prontos.sort((a, b) => b.atb - a.atb);
    return prontos;
  }

  defesaEfetiva(c) {
    let def = c.defesa;
    if (c.primeiroTurno && c.isPlayer && c.tracoId === "cauteloso") def = Math.round(def * 1.2);
    const buff = c.statusEffects.find((s) => s.tipo === "buff_defesa");
    if (buff) def = Math.round(def * (1 + buff.valor));
    const furiaDebuff = c.statusEffects.find((s) => s.tipo === "furia_debuff");
    if (furiaDebuff) def = Math.round(def * (1 - furiaDebuff.valor));
    if (FLAGS.reacoesElementais) def = Math.round(def * modificadorDefesaEstado(c));
    return def;
  }

  // Enche a postura do chefe alvo quando o JOGADOR o acerta — o ganho
  // depende da relação elemental do golpe (fraqueza enche muito mais rápido
  // que um golpe neutro ou contra resistência). Ao encher, atordoa o chefe:
  // a próxima decidirAcao() dele vira um turno perdido (ver decidirAcao/
  // executarAcao) e ele recebe BONUS_DANO_ATORDOADO enquanto durar (ver
  // rolarAtaque). Não acumula nada enquanto já está atordoado (evita re-
  // disparar o estado antes do turno perdido ser consumido).
  acumularQuebra(atacante, alvo, relacao) {
    if (!atacante || !atacante.isPlayer || !alvo || alvo.isPlayer) return;
    if (!alvo.chefe || !alvo.vivo || alvo.atordoado || !alvo.posturaMax) return;
    const ganho = GANHO_QUEBRA_POR_RELACAO[relacao] ?? GANHO_QUEBRA_POR_RELACAO.neutro;
    if (ganho <= 0) return;
    alvo.postura = Math.min(alvo.posturaMax, alvo.postura + ganho);
    if (alvo.postura >= alvo.posturaMax) {
      alvo.atordoado = true;
      this.registrar(`💥 ${alvo.nome} perde a postura e fica ATORDOADO! Vai perder a próxima ação e sofrer dano extra.`);
      // Gancho de animação (ver comentário no construtor): a UI usa isso pra
      // dar um momento visual claro à quebra de postura, em vez de só uma
      // linha de log — ver BattleUI.js.
      this.quebraSeq += 1;
      this.ultimaQuebra = { seq: this.quebraSeq, alvo };
    }
  }

  registrarReacaoElemental(relacao) {
    if (relacao === "vantagem_intensa") this.registrar("🔥🔥 Vantagem elemental INTENSA! Dano muito ampliado.");
    else if (relacao === "vantagem") this.registrar("🔥 Vantagem elemental! Dano ampliado.");
    else if (relacao === "resistencia_intensa") this.registrar("🛡️🛡️ Resistência elemental INTENSA. Dano bastante reduzido.");
    else if (relacao === "resistencia") this.registrar("🛡️ Resistência elemental. Dano reduzido.");
    else if (relacao === "imune") this.registrar("🚫 Imunidade elemental! O ataque não causa dano.");
  }

  // Resolução unificada de d20 para qualquer ação de combate (ataque físico,
  // habilidade, magia). O d20 PURO decide crítico (>16) / erro total (<4) /
  // acerto normal (4-16) — atributos e defesa nunca alteram essa faixa, só a
  // quantidade de dano depois. Também resolve o bloqueio de "Defender": se o
  // alvo estiver com `defendendo` ativo, compara o d20 do atacante contra um
  // limiar de defesa (10 + metade da defesa efetiva do alvo); rolagem menor
  // que o limiar = ataque bloqueado. O flag `defendendo` é consumido aqui,
  // então só protege contra a próxima ação recebida.
  resolverAcaoD20(atacante, alvo) {
    let d = d20();
    if (d < 4 && atacante.isPlayer && atacante.tracoId === "sortudo" && !atacante.sorteUsada) {
      atacante.sorteUsada = true;
      d = d20();
      this.registrar(`${atacante.nome} usa a sorte de Halfling e re-rola o dado!`);
    }
    let bloqueado = false;
    // `limiarBloqueio` (melhoria de jogabilidade: "motivo" da esquiva/bloqueio
    // no log): guardado mesmo quando o alvo não estava defendendo (fica
    // `null` nesse caso) só para a UI poder explicar POR QUE um ataque falhou
    // ou foi bloqueado, sem mudar nenhum valor usado no cálculo em si.
    let limiarBloqueio = null;
    if (alvo && alvo.defendendo) {
      limiarBloqueio = 10 + Math.floor(this.defesaEfetiva(alvo) / 2);
      if (d < limiarBloqueio) bloqueado = true;
      alvo.defendendo = false;
    }
    // Ofuscado (Caminhos do Herdeiro, task #91): penaliza só a faixa de erro
    // total do PRÓPRIO ataque de quem está com o estado — nunca tira um
    // crítico já rolado (d > 16 continua crítico independentemente).
    const penalidade = FLAGS.reacoesElementais ? penalidadeD20Estado(atacante) : 0;
    const resultado = { d, critico: d > 16, erroTotal: d - penalidade < 4, bloqueado, limiarBloqueio };
    // Gancho de animação (ver comentário no construtor): registra TODA
    // rolagem de d20 de combate, vitoriosa ou não — a UI decide o que fazer
    // com erro/bloqueio (ex.: mostrar "ESQUIVOU!"/"BLOQUEADO!" em vez de
    // número de dano) a partir desses mesmos campos.
    this.rolagemSeq += 1;
    this.ultimaRolagem = { seq: this.rolagemSeq, atacante, alvo, ...resultado };
    return resultado;
  }

  // `respeitaFormacao` (task #43): ataques físicos "normais" são reduzidos
  // contra um alvo na retaguarda ENQUANTO houver algum aliado dele vivo na
  // frente (a frente "absorve" parte do golpe); ataques que já ignoram
  // defesa (dano_ignora_defesa) ou magia não respeitam formação — a
  // convenção é que só o embate físico direto é bloqueável por
  // posicionamento, igual ao doc de design (terreno/posição > estatística).
  formacaoReducaoDano(alvo) {
    if (!alvo.isPlayer || alvo.posicao !== "retaguarda") return 1;
    const frenteViva = this.time.some((c) => c !== alvo && c.posicao === "frente" && c.vivo);
    return frenteViva ? 0.75 : 1;
  }

  // Terreno (task #42): ver comentário de BONUS_ATAQUE_TERRENO/
  // RESISTENCIA_TERRENO_INIMIGO acima. `elementoAtacante` é o elemento
  // efetivo do golpe (arma/habilidade); `alvo` é o combatente que recebe o
  // dano.
  multiplicadorTerreno(elementoAtacante, alvo) {
    if (!FLAGS.terreno || !this.terrenoElemento || !elementoAtacante) return 1;
    if (elementoAtacante !== this.terrenoElemento) return 1;
    let mult = BONUS_ATAQUE_TERRENO;
    if (!alvo.isPlayer) mult *= RESISTENCIA_TERRENO_INIMIGO;
    return mult;
  }

  // Clima (melhoria pós-backlog, ver WeatherSystem.js/BONUS_ATAQUE_CLIMA
  // acima): mesma lógica do terreno, só que mais fraca e lida de
  // `this.climaElemento` em vez de `this.terrenoElemento` — reaproveita a
  // mesma FLAGS.terreno (mesma categoria de "efeito ambiental elemental",
  // não faz sentido ligar um e desligar o outro separadamente).
  multiplicadorClima(elementoAtacante, alvo) {
    if (!FLAGS.terreno || !this.climaElemento || !elementoAtacante) return 1;
    if (elementoAtacante !== this.climaElemento) return 1;
    let mult = BONUS_ATAQUE_CLIMA;
    if (!alvo.isPlayer) mult *= RESISTENCIA_CLIMA_INIMIGO;
    return mult;
  }

  // Combo elemental entre aliados (ver COMBOS_ELEMENTAIS acima). Só golpes
  // de ALIADO contra INIMIGO participam (nunca golpe de inimigo, nem golpe
  // aliado em outro aliado como cura/buff) — chamado só a partir de um
  // golpe que já ACERTOU (erro total/bloqueio nunca chegam aqui). Sempre
  // atualiza `this.ultimoAtaqueAliado` no final, mesmo sem formar combo,
  // pra esse golpe virar a referência do PRÓXIMO possível combo.
  verificarComboElemental(atacante, alvo, elementoAtacante) {
    if (!FLAGS.elementos || !this.dadosElementos || !atacante.isPlayer || alvo.isPlayer) return { multiplicador: 1, combo: null };
    const anterior = this.ultimoAtaqueAliado;
    let resultado = { multiplicador: 1, combo: null };
    if (anterior && anterior.alvo === alvo && anterior.atacante !== atacante) {
      const combo = comboDoisElementos(anterior.elemento, elementoAtacante);
      if (combo) resultado = { multiplicador: BONUS_DANO_COMBO, combo };
    }
    this.ultimoAtaqueAliado = { atacante, alvo, elemento: elementoAtacante };
    return resultado;
  }

  // Versão SÓ-LEITURA de verificarComboElemental (melhoria de jogabilidade:
  // prévia de dano estimado, item 1 de 100_melhorias.md) — mesma checagem,
  // mas sem atualizar `this.ultimoAtaqueAliado`, porque uma prévia nunca pode
  // alterar estado real de combate (o próximo golpe de verdade ainda precisa
  // ver o último ataque aliado ANTERIOR à prévia, não a prévia em si).
  peekComboElemental(atacante, alvo, elementoAtacante) {
    if (!FLAGS.elementos || !this.dadosElementos || !atacante.isPlayer || alvo.isPlayer) return { multiplicador: 1, combo: null };
    const anterior = this.ultimoAtaqueAliado;
    if (anterior && anterior.alvo === alvo && anterior.atacante !== atacante) {
      const combo = comboDoisElementos(anterior.elemento, elementoAtacante);
      if (combo) return { multiplicador: BONUS_DANO_COMBO, combo };
    }
    return { multiplicador: 1, combo: null };
  }

  // Prévia de dano (melhoria de jogabilidade, item 1 de 100_melhorias.md):
  // replica a MESMA fórmula de rolarAtaque(), mas sem rolar d20 nem mudar
  // nenhum estado — só os dois ingredientes que dependem de sorte (a faixa
  // de variância 0.85–1.15 e se vai ser crítico) ficam de fora do valor
  // exato, virando o "min–max" exibido. Nunca deve ser chamada em nenhum
  // lugar que decida o resultado real de um golpe — só para exibição na UI
  // ANTES de confirmar a ação (ver BattleUI.js).
  estimarFaixaDano(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true } = {}) {
    const alvoDef = this.defesaEfetiva(alvo);
    const atributo = atributoForcado || atacante.ataque.atributo;
    const baseAtributo = atacante.atributos[atributo] || 0;
    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) base *= 1 + furiaBuff.valor;
    const elemResolvido = elementoAtacante || atacante.elemento || "fisico";
    let relacao = "neutro";
    let multElemental = 1;
    if (FLAGS.elementos && this.dadosElementos) {
      const elemDef = alvo.elemento || "fisico";
      relacao = relacaoElemental(elemResolvido, elemDef, this.dadosElementos);
      multElemental = multiplicadorElemental(elemResolvido, elemDef, this.dadosElementos);
    }
    if (relacao === "imune") return { min: 0, max: 0, minCritico: 0, maxCritico: 0, imune: true, relacaoElemental: relacao, combo: null };
    const combo = this.peekComboElemental(atacante, alvo, elemResolvido);
    let baseComMultiplicadores = base * multElemental * this.multiplicadorTerreno(elemResolvido, alvo) * this.multiplicadorClima(elemResolvido, alvo) * combo.multiplicador;
    if (atacante.racaId === "orc" && atacante.hp / atacante.hpMax <= 0.3) baseComMultiplicadores *= 1.3;
    // Prévia (só-leitura) do bônus de reação elemental — ver peekReacaoElemental
    // em ElementalReactionSystem.js. Nunca consome o estado do alvo.
    let ignoraDefesaExtraPreview = 0;
    if (FLAGS.reacoesElementais) {
      baseComMultiplicadores *= modificadorDanoRecebidoEstado(alvo, elemResolvido);
      const { ocorreu, reacao, multiplicadorDano } = peekReacaoElemental(alvo, elemResolvido, true, this.dadosReacoes);
      if (ocorreu) {
        baseComMultiplicadores *= multiplicadorDano;
        if (reacao.ignoraDefesaRestante) ignoraDefesaExtraPreview = 999;
      }
    }
    const defReduzida = Math.max(0, alvoDef - ignoraDefesa - ignoraDefesaExtraPreview);
    const formacaoMult = respeitaFormacao ? this.formacaoReducaoDano(alvo) : 1;
    const bonusAtordoado = alvo.chefe && alvo.atordoado ? BONUS_DANO_ATORDOADO : 1;
    const finalizar = (varianciaMult, dobraCritico) => {
      let dano = baseComMultiplicadores * varianciaMult;
      if (dobraCritico) dano *= 2;
      dano = Math.max(1, Math.round(dano - defReduzida * 0.5));
      dano = Math.max(1, Math.round(dano * formacaoMult));
      dano = Math.round(dano * bonusAtordoado);
      return dano;
    };
    return {
      min: finalizar(0.85, false), max: finalizar(1.15, false),
      minCritico: finalizar(0.85, true), maxCritico: finalizar(1.15, true),
      relacaoElemental: relacao, combo: combo.combo,
    };
  }

  rolarAtaque(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true } = {}) {
    const { critico: criticoBase, erroTotal, bloqueado } = this.resolverAcaoD20(atacante, alvo);
    let critico = criticoBase;
    const alvoDef = this.defesaEfetiva(alvo);
    // Bônus de crítico da árvore de habilidades: chance extra de crítico
    // (não se aplica a um erro total natural).
    if (!critico && !erroTotal && atacante.critBonus && Math.random() < atacante.critBonus) critico = true;

    if (erroTotal) {
      this.registrar(`${atacante.nome} erra completamente o ataque! (d20: ${this.ultimaRolagem.d}, erro total abaixo de 4)`);
      return { acertou: false, critico: false, dano: 0, relacaoElemental: "neutro" };
    }
    if (bloqueado) {
      this.registrar(`${alvo.nome} se defende e bloqueia o ataque de ${atacante.nome}! (seu d20 ${this.ultimaRolagem.d} não superou o limiar de defesa ${this.ultimaRolagem.limiarBloqueio})`);
      return { acertou: false, critico: false, dano: 0, relacaoElemental: "neutro", bloqueado: true };
    }

    const atributo = atributoForcado || atacante.ataque.atributo;
    const baseAtributo = atacante.atributos[atributo] || 0;
    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) {
      base *= 1 + furiaBuff.valor;
      atacante.statusEffects = atacante.statusEffects.filter((s) => s !== furiaBuff);
      this.registrar(`${atacante.nome} canaliza a fúria em seu ataque!`);
    }
    const variancia = 0.85 + Math.random() * 0.3;
    let dano = base * variancia;
    if (critico) dano *= 2;
    if (atacante.racaId === "orc" && atacante.hp / atacante.hpMax <= 0.3) dano *= 1.3;
    const elemResolvido = elementoAtacante || atacante.elemento || "fisico";
    let relacao = "neutro";
    if (FLAGS.elementos && this.dadosElementos) {
      const elemDef = alvo.elemento || "fisico";
      relacao = relacaoElemental(elemResolvido, elemDef, this.dadosElementos);
      dano *= multiplicadorElemental(elemResolvido, elemDef, this.dadosElementos);
    }
    dano *= this.multiplicadorTerreno(elemResolvido, alvo);
    dano *= this.multiplicadorClima(elemResolvido, alvo);
    const combo = this.verificarComboElemental(atacante, alvo, elemResolvido);
    dano *= combo.multiplicador;
    // Estados e reações elementais (Caminhos do Herdeiro, task #91): sem
    // nenhum estado ativo no alvo (sempre o caso enquanto nenhuma habilidade
    // nova declarar `aplicaEstado`), tudo isto vira no-op — ver comentário
    // do módulo em ElementalReactionSystem.js.
    let ignoraDefesaExtra = 0;
    let reacaoOcorrida = null;
    if (FLAGS.reacoesElementais) {
      dano *= modificadorDanoRecebidoEstado(alvo, elemResolvido);
      const { ocorreu, reacao, multiplicadorDano } = verificarReacaoElemental(alvo, elemResolvido, true, this.dadosReacoes);
      if (ocorreu) {
        reacaoOcorrida = reacao;
        dano *= multiplicadorDano;
        if (reacao.garanteCritico && !critico) { critico = true; dano *= 2; }
        if (reacao.ignoraDefesaRestante) ignoraDefesaExtra = 999;
      }
    }
    const defReduzida = Math.max(0, alvoDef - ignoraDefesa - ignoraDefesaExtra);
    dano = Math.max(1, Math.round(dano - defReduzida * 0.5));
    if (respeitaFormacao) dano = Math.max(1, Math.round(dano * this.formacaoReducaoDano(alvo)));
    // Chefe atordoado (barra de quebra): dano bônus enquanto durar.
    if (alvo.chefe && alvo.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
    // Imunidade elemental anula o dano por completo — sobrepõe o piso de 1
    // de dano usado no restante do cálculo.
    if (relacao === "imune") dano = 0;

    if (reacaoOcorrida) this.resolverConsequenciasReacao(atacante, alvo, reacaoOcorrida, dano);

    return { acertou: true, critico, dano, relacaoElemental: relacao, combo: combo.combo, reacaoElemental: reacaoOcorrida };
  }

  // Aplica o estado elemental que uma habilidade declare (`habilidade.
  // aplicaEstado`, ver elementalStates.json) no alvo que ela acabou de
  // acertar — usado pelas árvores de talento novas (Caminhos do Herdeiro,
  // tasks #93/#94), nenhuma habilidade existente antes dessas tasks declara
  // isso, então esta função nunca roda em combate hoje sem uma dessas.
  // `habilidade.duracaoEstado` (opcional) sobrescreve a duração padrão do
  // estado; sem ela, usa `duracaoPadrao` do próprio estado.
  aplicarEstadoDeHabilidade(habilidade, alvo) {
    if (!FLAGS.reacoesElementais || !habilidade.aplicaEstado || !alvo || !alvo.vivo) return;
    const entrada = aplicarEstadoElemental(alvo, habilidade.aplicaEstado, this.dadosEstados, habilidade.duracaoEstado || null);
    if (entrada && entrada.def) this.registrar(`${entrada.def.icone || ""} ${alvo.nome} fica ${entrada.def.nome}!`);
  }

  // Aplica os efeitos colaterais de uma reação elemental que acabou de
  // disparar (ver ElementalReactionSystem.js/elementalReactions.json):
  // aplica um novo estado no alvo, propaga uma fração do dano pra outro
  // inimigo vivo do mesmo lado (Condução), ou aplica um estado em ÁREA
  // (todas as unidades vivas do mesmo lado do alvo — ex.: a névoa de
  // Evaporação). `danoFinal` é o dano JÁ calculado do golpe que disparou a
  // reação, usado só como base pra propagação (nunca re-aplicado no alvo
  // principal, que já é aplicado pelo chamador de rolarAtaque/dano_magico).
  resolverConsequenciasReacao(atacante, alvo, reacao, danoFinal) {
    this.registrar(`${reacao.icone || "✨"} Reação Elemental: ${reacao.nome}! ${reacao.descricao || ""}`);
    if (reacao.aplicaEstado) {
      aplicarEstadoElemental(alvo, reacao.aplicaEstado, this.dadosEstados);
    }
    const ladoDoAlvo = alvo.isPlayer ? this.timeVivo() : this.inimigosVivos();
    if (reacao.areaAplicaEstado) {
      for (const membro of ladoDoAlvo) {
        aplicarEstadoElemental(membro, reacao.areaAplicaEstado, this.dadosEstados, reacao.areaDuracao || null);
      }
    }
    if (reacao.propagaDano) {
      const outros = ladoDoAlvo.filter((c) => c !== alvo && c.vivo);
      if (outros.length) {
        const secundario = outros[Math.floor(Math.random() * outros.length)];
        const danoSecundario = Math.max(1, Math.round(danoFinal * (reacao.propagaPercent || 0.4)));
        this.aplicarDano(secundario, danoSecundario);
        this.registrar(`${reacao.icone || "⚡"} A reação salta para ${secundario.nome}, causando ${danoSecundario} de dano!`);
      }
    }
  }

  aplicarDano(alvo, dano) {
    alvo.hp = Math.max(0, alvo.hp - dano);
    if (alvo.hp <= 0) {
      alvo.vivo = false;
      this.registrar(`${alvo.nome} foi derrotado!`);
    }
  }

  ataqueBasico(atacante, alvo) {
    const r = this.rolarAtaque(atacante, alvo);
    if (r.acertou) {
      this.aplicarDano(alvo, r.dano);
      this.registrar(`${atacante.nome} ataca ${alvo.nome} e causa ${r.dano} de dano${r.critico ? " (CRÍTICO!)" : ""}.`);
      this.registrarReacaoElemental(r.relacaoElemental);
      this.acumularQuebra(atacante, alvo, r.relacaoElemental);
      if (r.combo) this.registrar(`${r.combo.icone} Combo Elemental: ${r.combo.nome}! O golpe em equipe amplia o dano.`);
    }
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return r;
  }

  usarHabilidade(atacante, habilidade, alvoOuAlvos) {
    if (atacante.mp < habilidade.custoMP) {
      this.registrar(`${atacante.nome} não tem mana suficiente para ${habilidade.nome}.`);
      return { ok: false };
    }
    if (habilidade.cooldownAtual > 0) {
      this.registrar(`${habilidade.nome} ainda está recarregando.`);
      return { ok: false };
    }
    atacante.mp -= habilidade.custoMP;
    habilidade.cooldownAtual = habilidade.cooldown + 1;

    const eventos = [];
    switch (habilidade.tipo) {
      case "dano_fisico":
      case "dano_fisico_des": {
        const attr = habilidade.tipo === "dano_fisico_des" ? "DES" : null;
        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, atributoForcado: attr, elementoAtacante: habilidade.elemento });
        if (r.acertou) { this.aplicarDano(alvoOuAlvos, r.dano); this.registrarReacaoElemental(r.relacaoElemental); this.acumularQuebra(atacante, alvoOuAlvos, r.relacaoElemental); this.aplicarEstadoDeHabilidade(habilidade, alvoOuAlvos); }
        this.registrar(`${atacante.nome} usa ${habilidade.nome}${r.acertou ? ` e causa ${r.dano} de dano` : " mas erra"}!`);
        if (r.combo) this.registrar(`${r.combo.icone} Combo Elemental: ${r.combo.nome}! O golpe em equipe amplia o dano.`);
        eventos.push({ tipo: "dano", alvo: alvoOuAlvos.id, valor: r.dano, critico: r.critico });
        break;
      }
      case "dano_ignora_defesa": {
        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, ignoraDefesa: 999, elementoAtacante: habilidade.elemento, respeitaFormacao: false });
        if (r.acertou) { this.aplicarDano(alvoOuAlvos, r.dano); this.registrarReacaoElemental(r.relacaoElemental); this.acumularQuebra(atacante, alvoOuAlvos, r.relacaoElemental); this.aplicarEstadoDeHabilidade(habilidade, alvoOuAlvos); }
        this.registrar(`${atacante.nome} usa ${habilidade.nome}, ignorando parte da defesa!`);
        if (r.combo) this.registrar(`${r.combo.icone} Combo Elemental: ${r.combo.nome}! O golpe em equipe amplia o dano.`);
        eventos.push({ tipo: "dano", alvo: alvoOuAlvos.id, valor: r.dano, critico: r.critico });
        break;
      }
      case "dano_magico": {
        const { critico, erroTotal, bloqueado } = this.resolverAcaoD20(atacante, alvoOuAlvos);
        if (erroTotal) {
          this.registrar(`${atacante.nome} conjura ${habilidade.nome} mas o feitiço falha! (d20: ${this.ultimaRolagem.d}, erro total abaixo de 4)`);
        } else if (bloqueado) {
          this.registrar(`${alvoOuAlvos.nome} se defende e bloqueia o feitiço ${habilidade.nome} de ${atacante.nome}! (seu d20 ${this.ultimaRolagem.d} não superou o limiar de defesa ${this.ultimaRolagem.limiarBloqueio})`);
        } else {
          let dano = (atacante.atributos.INT * habilidade.multiplicador) * (0.85 + Math.random() * 0.3);
          if (critico) dano *= 2;
          let relacao = "neutro";
          const elemAtqMagico = habilidade.elemento || atacante.elemento || "fisico";
          if (FLAGS.elementos && this.dadosElementos) {
            const elemDef = alvoOuAlvos.elemento || "fisico";
            relacao = relacaoElemental(elemAtqMagico, elemDef, this.dadosElementos);
            dano *= multiplicadorElemental(elemAtqMagico, elemDef, this.dadosElementos);
          }
          dano *= this.multiplicadorTerreno(elemAtqMagico, alvoOuAlvos);
          dano *= this.multiplicadorClima(elemAtqMagico, alvoOuAlvos);
          const combo = this.verificarComboElemental(atacante, alvoOuAlvos, elemAtqMagico);
          dano *= combo.multiplicador;
          // Estados e reações elementais (Caminhos do Herdeiro, task #91) —
          // mesmo motor usado em rolarAtaque(), aqui com tipoFisico=false
          // (magia nunca aciona Estilhaçar/Ruptura, que exigem golpe físico).
          let reacaoOcorrida = null;
          if (FLAGS.reacoesElementais) {
            dano *= modificadorDanoRecebidoEstado(alvoOuAlvos, elemAtqMagico);
            const { ocorreu, reacao, multiplicadorDano } = verificarReacaoElemental(alvoOuAlvos, elemAtqMagico, false, this.dadosReacoes);
            if (ocorreu) { reacaoOcorrida = reacao; dano *= multiplicadorDano; }
          }
          dano = Math.max(1, Math.round(dano - this.defesaEfetiva(alvoOuAlvos) * 0.3));
          if (alvoOuAlvos.chefe && alvoOuAlvos.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
          if (relacao === "imune") dano = 0;
          this.aplicarDano(alvoOuAlvos, dano);
          this.registrar(`${atacante.nome} conjura ${habilidade.nome} e causa ${dano} de dano mágico${critico ? " (CRÍTICO!)" : ""}!`);
          this.registrarReacaoElemental(relacao);
          this.acumularQuebra(atacante, alvoOuAlvos, relacao);
          if (combo.combo) this.registrar(`${combo.combo.icone} Combo Elemental: ${combo.combo.nome}! O golpe em equipe amplia o dano.`);
          if (reacaoOcorrida) this.resolverConsequenciasReacao(atacante, alvoOuAlvos, reacaoOcorrida, dano);
          this.aplicarEstadoDeHabilidade(habilidade, alvoOuAlvos);
          eventos.push({ tipo: "dano", alvo: alvoOuAlvos.id, valor: dano, critico });
        }
        break;
      }
      case "cura": {
        let cura = Math.round(atacante.atributos.INT * habilidade.multiplicador * (0.9 + Math.random() * 0.2));
        if (FLAGS.reacoesElementais) cura = Math.round(cura * modificadorCuraRecebidaEstado(atacante));
        atacante.hp = Math.min(atacante.hpMax, atacante.hp + cura);
        this.registrar(`${atacante.nome} usa ${habilidade.nome} e recupera ${cura} de HP.`);
        eventos.push({ tipo: "cura", alvo: atacante.id, valor: cura });
        break;
      }
      case "buff_defesa": {
        atacante.statusEffects.push({ tipo: "buff_defesa", duracao: habilidade.duracao + 1, valor: habilidade.valor });
        this.registrar(`${atacante.nome} usa ${habilidade.nome} e fica mais resistente!`);
        break;
      }
      case "buff_ataque": {
        atacante.statusEffects.push({ tipo: "buff_ataque_proximo", duracao: 2, valor: habilidade.valor });
        atacante.statusEffects.push({ tipo: "furia_debuff", duracao: habilidade.duracao + 1, valor: 0.2 });
        this.registrar(`${atacante.nome} entra em fúria!`);
        break;
      }
      case "debuff_velocidade": {
        alvoOuAlvos.statusEffects.push({ tipo: "debuff_velocidade", duracao: habilidade.duracao + 1, valor: habilidade.valor });
        this.registrar(`${atacante.nome} usa ${habilidade.nome} em ${alvoOuAlvos.nome}, reduzindo sua velocidade!`);
        break;
      }
      case "fuga": {
        this.resultado = "fuga";
        this.terminada = true;
        this.registrar(`${atacante.nome} foge com segurança da batalha!`);
        break;
      }
      default:
        break;
    }
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return { ok: true, eventos };
  }

  usarSoproElemental(atacante) {
    if (atacante.sopro_usado || atacante.racaId !== "draconato") return { ok: false };
    atacante.sopro_usado = true;
    let total = 0;
    for (const inimigo of this.inimigosVivos()) {
      let dano = Math.round(atacante.atributos.INT * 1.6 * (0.85 + Math.random() * 0.3));
      dano = Math.max(1, dano - Math.round(this.defesaEfetiva(inimigo) * 0.3));
      if (inimigo.chefe && inimigo.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
      this.aplicarDano(inimigo, dano);
      this.acumularQuebra(atacante, inimigo, "neutro");
      total += dano;
    }
    this.registrar(`${atacante.nome} solta um Sopro Elemental, causando dano em todos os inimigos!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return { ok: true, totalDano: total };
  }

  fugir(iniciador) {
    const chance = 0.5 + iniciador.velocidade * 0.02;
    if (Math.random() < chance) {
      this.resultado = "fuga";
      this.terminada = true;
      this.registrar(`${iniciador.nome} conseguiu fugir com o time!`);
      return true;
    }
    this.registrar(`${iniciador.nome} tentou fugir, mas não conseguiu!`);
    iniciador.atb = 0;
    return false;
  }

  // Escolhe o alvo pelo arquétipo do inimigo (ver EnemyAI.js). Com
  // FLAGS.iaInimigos desligada, ou sem arquétipo definido, cai exatamente
  // no comportamento original: alvo aleatório entre o time vivo.
  //
  // Formação (task #43): arquétipos "de combate corpo a corpo" (ver
  // ARQUETIPOS_RESPEITAM_FORMACAO) só conseguem mirar quem está na frente
  // enquanto houver alguém lá — a retaguarda fica fora de alcance pra eles.
  // Arquétipos à distância/mágicos/furtivos (atirador, caçador, conjurador,
  // controlador, comandante, invocador, ladrão) ignoram formação e miram
  // qualquer um, reforçando a identidade que cada um já tinha.
  escolherAlvoIA(inimigo) {
    let vivos = this.timeVivo();
    if (!vivos.length) return null;
    if (!FLAGS.iaInimigos) return vivos[Math.floor(Math.random() * vivos.length)];
    const arquetipo = inimigo.arquetipo || "aleatorio";
    if (ARQUETIPOS_RESPEITAM_FORMACAO.has(arquetipo)) {
      const frente = vivos.filter((c) => c.posicao === "frente");
      if (frente.length) vivos = frente;
    }
    return escolherAlvoPorArquetipo(vivos, arquetipo);
  }

  // Versão do controle-de-turno por estado elemental (ver decidirAcao/
  // "controlado_elemental" abaixo) para o lado do JOGADOR — a IA inimiga
  // decide sozinha via decidirAcao(), mas o time do jogador escolhe ação
  // pela UI (ver BattleUI.js), então precisa de um jeito de checar/consumir
  // o turno perdido a partir de fora, sem duplicar FLAGS.reacoesElementais
  // e a lógica de log em cada lugar que chama.
  jogadorControladoPorEstado(c) {
    return !!(FLAGS.reacoesElementais && c && c.vivo && estaControladoPorEstado(c));
  }

  perderTurnoJogadorPorEstado(c) {
    const ativo = estadoElementalAtivo(c);
    this.registrar(`${(ativo && ativo.def && ativo.def.icone) || "❄️"} ${c.nome} está ${(ativo && ativo.def && ativo.def.nome) || "controlado"} e perde o turno!`);
    c.primeiroTurno = false;
    c.atb = 0;
    this.aplicarStatusTick(c);
  }

  // `decidirAcao` e `executarAcao` ficam separados (em vez de um único
  // iaInimigoAgir monolítico) para permitir a prévia de intenção
  // ("telegraph"): a UI pode chamar decidirAcao() pra saber e mostrar o que
  // o inimigo VAI fazer antes de fato executar, sem re-rolar nada — a
  // decisão (incluindo os dados dos arquétipos com chance, como o Ladrão)
  // é tomada uma única vez e só então aplicada com executarAcao().
  iaInimigoAgir(inimigo) {
    const plano = this.decidirAcao(inimigo);
    this.executarAcao(inimigo, plano);
  }

  // Decide o que o inimigo vai fazer neste turno, sem alterar nenhum estado
  // de batalha (sem dano, cura, flags consumidas etc.) — seguro pra ser
  // chamado só pra exibir a intenção ao jogador.
  decidirAcao(inimigo) {
    const vivos = this.timeVivo();
    if (!vivos.length) return { tipo: "nada", alvo: null };
    // Barra de quebra: chefe atordoado perde a ação inteira deste turno —
    // isso tem prioridade sobre hesitar/arquétipo especial/ataque comum.
    if (inimigo.chefe && inimigo.atordoado) {
      return { tipo: "atordoado", alvo: null };
    }
    // Estado elemental que controla o turno (hoje só Congelado — Caminhos do
    // Herdeiro, task #91): mesma prioridade da barra de quebra acima.
    if (FLAGS.reacoesElementais && estaControladoPorEstado(inimigo)) {
      return { tipo: "controlado_elemental", alvo: null };
    }
    if (FLAGS.iaInimigos && deveHesitar(inimigo, this.inimigos, inimigo.arquetipo)) {
      return { tipo: "hesitar", alvo: null };
    }
    if (FLAGS.iaInimigos) {
      const especial = this.decidirAcaoEspecialArquetipo(inimigo);
      if (especial) return especial;
    }
    const alvo = this.escolherAlvoIA(inimigo) || vivos[Math.floor(Math.random() * vivos.length)];
    return { tipo: "atacar", alvo };
  }

  // Aplica de fato um plano retornado por decidirAcao(). Cada `case` chama
  // exatamente o método que a versão anterior (monolítica) chamava, então o
  // comportamento de jogo não muda — só a decisão do alvo é separada da
  // execução.
  executarAcao(inimigo, plano) {
    switch (plano.tipo) {
      case "atordoado":
        this.registrar(`💫 ${inimigo.nome} está atordoado e perde o turno!`);
        // Consome o turno perdido e reseta a postura — o chefe volta a
        // acumular quebra do zero na sequência.
        inimigo.atordoado = false;
        inimigo.postura = 0;
        inimigo.primeiroTurno = false;
        inimigo.atb = 0;
        return;
      case "controlado_elemental": {
        const ativo = estadoElementalAtivo(inimigo);
        this.registrar(`${(ativo && ativo.def && ativo.def.icone) || "❄️"} ${inimigo.nome} está ${(ativo && ativo.def && ativo.def.nome) || "controlado"} e perde o turno!`);
        inimigo.primeiroTurno = false;
        inimigo.atb = 0;
        return;
      }
      case "hesitar":
        this.registrar(`${inimigo.nome} hesita e recua, não ataca neste turno!`);
        inimigo.primeiroTurno = false;
        inimigo.atb = 0;
        return;
      case "curar":
        this.curarAliado(inimigo, plano.alvo);
        return;
      case "proteger":
        this.protegerAliado(inimigo, plano.alvo);
        return;
      case "envenenar":
        this.envenenar(inimigo, plano.alvo);
        return;
      case "conjurar":
        this.conjurarAtaque(inimigo, plano.alvo);
        return;
      case "roubar":
        this.roubar(inimigo);
        return;
      case "invocar":
        this.invocar(inimigo);
        return;
      case "nada":
        return;
      case "atacar":
      default: {
        const alvo = plano.alvo || this.timeVivo()[Math.floor(Math.random() * this.timeVivo().length)];
        if (alvo) this.ataqueBasico(inimigo, alvo);
        return;
      }
    }
  }

  // Tenta decidir (sem executar) a ação única do arquétipo do inimigo
  // (curar, proteger, envenenar, conjurar, roubar, invocar). Retorna o plano
  // `{ tipo, alvo }` se a ação especial se aplica, ou `null` para cair no
  // ataque básico normal (ex.: Suporte sem ninguém ferido para curar). Cada
  // arquétipo aqui foi pensado para nunca "travar" o inimigo — sempre existe
  // um caminho de volta ao ataque comum.
  decidirAcaoEspecialArquetipo(inimigo) {
    const aliadosVivos = this.inimigosVivos();
    switch (inimigo.arquetipo) {
      case "suporte": {
        const alvoCura = aliadosVivos
          .filter((a) => a !== inimigo && a.hp / a.hpMax < 0.7)
          .sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
        if (!alvoCura) return null;
        return { tipo: "curar", alvo: alvoCura };
      }
      case "defensor": {
        const alvoProteger = aliadosVivos.filter((a) => a !== inimigo).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] || inimigo;
        const jaProtegido = alvoProteger.statusEffects.some((s) => s.tipo === "buff_defesa");
        if (jaProtegido) return null;
        return { tipo: "proteger", alvo: alvoProteger };
      }
      case "controlador": {
        const vivosTime = this.timeVivo();
        const alvo = escolherAlvoPorArquetipo(vivosTime, "cacador");
        if (!alvo || alvo.statusEffects.some((s) => s.tipo === "condicao_veneno")) return null;
        return { tipo: "envenenar", alvo };
      }
      case "conjurador": {
        const alvo = this.escolherAlvoIA(inimigo);
        if (!alvo) return null;
        return { tipo: "conjurar", alvo };
      }
      case "ladrao": {
        if (inimigo.jaRoubou || Math.random() >= 0.6) return null;
        return { tipo: "roubar", alvo: null };
      }
      case "invocador": {
        if (inimigo.jaInvocou || this.inimigos.length >= 6) return null;
        return { tipo: "invocar", alvo: null };
      }
      default:
        return null;
    }
  }

  // Suporte: cura o aliado mais ferido.
  curarAliado(atacante, alvo) {
    const poder = atacante.atributos.INT || atacante.atributos.FOR || 0;
    let cura = Math.max(1, Math.round(alvo.hpMax * 0.22 + poder * 0.6));
    if (FLAGS.reacoesElementais) cura = Math.max(1, Math.round(cura * modificadorCuraRecebidaEstado(alvo)));
    alvo.hp = Math.min(alvo.hpMax, alvo.hp + cura);
    this.registrar(`${atacante.nome} conjura cura em ${alvo.nome}, recuperando ${cura} de HP!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Defensor: aumenta a defesa do aliado mais vulnerável (ou de si mesmo,
  // se estiver sozinho) reaproveitando o mesmo status "buff_defesa" que já
  // existe para as habilidades do jogador.
  protegerAliado(atacante, alvo) {
    alvo.statusEffects.push({ tipo: "buff_defesa", duracao: 3, valor: 0.5 });
    const quem = alvo === atacante ? "a si mesmo" : alvo.nome;
    this.registrar(`${atacante.nome} protege ${quem}, aumentando a defesa!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Controlador: aplica uma condição de veneno (dano ao longo do tempo,
  // resolvida em aplicarStatusTick) em vez de atacar diretamente.
  envenenar(atacante, alvo) {
    alvo.statusEffects.push({ tipo: "condicao_veneno", duracao: 3, valor: 0.08 });
    this.registrar(`${atacante.nome} aplica uma condição debilitante em ${alvo.nome}: veneno!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Conjurador: ataque mágico que ignora parte da defesa do alvo, sempre
  // usado no lugar do ataque básico (reforça a identidade de "só conjura").
  conjurarAtaque(atacante, alvo) {
    const r = this.rolarAtaque(atacante, alvo, {
      multiplicador: 1.3,
      ignoraDefesa: Math.round(this.defesaEfetiva(alvo) * 0.4),
      elementoAtacante: atacante.elemento,
      respeitaFormacao: false,
    });
    if (r.acertou) {
      this.aplicarDano(alvo, r.dano);
      this.registrar(`${atacante.nome} conjura uma magia em ${alvo.nome}, causando ${r.dano} de dano${r.critico ? " (CRÍTICO!)" : ""}!`);
      this.registrarReacaoElemental(r.relacaoElemental);
    }
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Ladrão: rouba ouro do grupo (creditado ao final da batalha pela UI, ver
  // `ouroRoubado`) uma única vez por combate — depois volta a atacar.
  roubar(atacante) {
    const valor = 5 + Math.floor(Math.random() * 16);
    this.ouroRoubado += valor;
    atacante.jaRoubou = true;
    this.registrar(`${atacante.nome} rouba ${valor} de ouro da bolsa do grupo!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  // Invocador: chama um reforço para a batalha (usa `invocacaoDef`, vindo
  // do campo opcional "invocacao" em monsters.json, ou um clone enfraquecido
  // de si mesmo como fallback) — uma única vez por combate.
  invocar(atacante) {
    const base = atacante.invocacaoDef || {
      id: `${atacante.monstroId}_convocado`,
      nome: `Invocação de ${atacante.nome}`,
      hp: Math.max(6, Math.round(atacante.hpMax * 0.4)),
      atk: Math.max(2, Math.round((atacante.ataque?.dano || 4) * 0.6)),
      vel: atacante.velocidade,
      defesa: Math.max(0, Math.round(atacante.defesa * 0.6)),
      elemento: atacante.elemento,
      sprite: atacante.spriteKey,
      xp: Math.max(1, Math.round((atacante.xp || 4) * 0.3)),
      ouroMin: 0,
      ouroMax: 1,
    };
    const novo = criarCombatenteInimigo(base, this.inimigos.length);
    novo.atb = 15; // não age no mesmo instante em que é convocado
    this.inimigos.push(novo);
    atacante.jaInvocou = true;
    this.registrar(`${atacante.nome} invoca ${novo.nome} para a batalha!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
  }

  tickCooldowns(c) {
    c.habilidades.forEach((h) => {
      if (h.cooldownAtual > 0) h.cooldownAtual -= 1;
    });
  }

  verificarFim() {
    if (this.timeVivo().length === 0) {
      this.terminada = true;
      this.resultado = "derrota";
    } else if (this.inimigosVivos().length === 0) {
      if (this.levasRestantes.length > 0) {
        this.avancarLeva();
      } else {
        this.terminada = true;
        this.resultado = "vitoria";
      }
    }
    return this.terminada;
  }

  // Horda (task #47): a onda atual foi limpa e ainda sobram ondas — troca
  // `this.inimigos` pela próxima onda (mutação in-place via length=0+push,
  // não reatribuição: BattleUI.js guarda a MESMA referência de array numa
  // constante local, então só mutar in-place propaga a nova onda pra
  // renderização/alvo/ATB sem precisar de nenhum código novo lá). O time
  // NÃO recupera HP/MP entre ondas — é o que torna a horda um desafio de
  // resistência, não só "mais um combate".
  avancarLeva() {
    const defsProximaLeva = this.levasRestantes.shift();
    this.levaAtual += 1;
    const novosInimigos = defsProximaLeva.map((m, i) => criarCombatenteInimigo(m, `l${this.levaAtual}_${i}`, this.ngPlus, this.modoHistoria));
    this.inimigos.length = 0;
    this.inimigos.push(...novosInimigos);
    this.historicoInimigos.push(...novosInimigos);
    this.registrar(`🌊 Uma nova leva de inimigos aparece! (Leva ${this.levaAtual}/${this.totalLevas})`);
  }
}
