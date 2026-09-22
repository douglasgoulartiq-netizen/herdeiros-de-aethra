// Sistema de batalha ATB (Active Time Battle) com regras inspiradas em d20.
import { statusDoOleo, sincronizarElemento, devolverOleoAoPersonagem, TIPO_STATUS as STATUS_OLEO } from "./WeaponOilSystem.js";
import { atributosEfetivos, defesaTotal, velocidadeTotal, ataqueBase, critBonusTotal } from "./CharacterFactory.js";
import { relacaoElemental, multiplicadorElemental, multiplicadorDaRelacao } from "./ElementSystem.js";
import { escolherAlvoPorArquetipo, deveHesitar } from "./EnemyAI.js";
import { FLAGS } from "../data/featureFlags.js";
import {
  ehChefe as ehChefeDeFase, garantirBase as garantirBaseDoChefe,
  checarViradaDeFase, podeUsarHabilidade, marcarHabilidadeUsada,
  passarTurnoDoChefe, registrarQuebra, habilidadeDoChefe,
} from "./BossPhaseSystem.js";
import {
  modificadoresDeAtaque, aoCausarDano as efeitosAoCausarDano,
  relacaoPerfurada, melhorRelacao,
} from "./ItemEffectSystem.js";
import { penalidadeEquipada } from "./RequisitoSystem.js";
import { modificadoresDoTime, modificadorDe } from "./PassiveSystem.js";
import { marcasDe, bonusDeMarcas } from "./RecursoClasseSystem.js";
import { escalaDoMonstro, escalaDeNivel } from "./EscalaSystem.js";
// Barramento de eventos visuais: este arquivo é testado em Node, sem DOM, e
// não pode importar UI. Ele ANUNCIA; quem estiver na tela desenha. Sem
// ouvinte, cada anunciar() é um no-op — nenhum teste precisou mudar.
import { anunciar, EVENTO } from "./EventosVisuais.js";
import { habilidadesEquipadas } from "./LoadoutSystem.js";
import {
  modificadorDanoRecebidoEstado, modificadorCuraRecebidaEstado, modificadorDefesaEstado,
  modificadorVelocidadeEstado, estaControladoPorEstado, penalidadeD20Estado,
  verificarReacaoElemental, peekReacaoElemental, aplicarEstadoElemental, estadoElementalAtivo,
  buscarReacaoAplicavel,
} from "./ElementalReactionSystem.js";
import { multiplicadorDificuldade } from "./AccessibilitySystem.js";
import {
  multiplicadorIdentidade, ambienteAfim, custoMPComInteresse, multCuraRecebida, bonusChanceFuga,
  limiarFuriaOrc, temCombinacao, CHANCE_ESTADO_SOPRO,
} from "./IdentidadeSystem.js";

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
    // Elemento da ARMA, guardado à parte: enquanto um óleo estiver valendo,
    // `elemento` acima é sobrescrito, e é daqui que ele volta quando o óleo
    // expira — sem isso o golpe viraria "físico" no fim do prazo.
    elementoBase: (personagem.equipamento.arma && personagem.equipamento.arma.elemento) || "fisico",
    // O equipamento viaja para o combatente por REFERÊNCIA. Dois sistemas
    // precisam dele durante a luta: os efeitos de item lendário
    // (ItemEffectSystem) e o requisito de atributo (RequisitoSystem). Antes
    // só o ELEMENTO da arma vinha, e por isso os efeitos não chegavam ao
    // combate — a arma tinha "roubo de vida" escrito e nada acontecia.
    equipamento: personagem.equipamento,
    // Passivas do convocado (ver PassiveSystem.js). Viajam junto porque o
    // modificador é calculado sobre o COMBATENTE, não sobre o personagem —
    // é no combate que elas valem.
    passivas: personagem.passivas || [],
    // MARCAS DE CLASSE (ver RecursoClasseSystem.js) — os nós finais de ramo
    // da árvore de habilidades. Resolvidas AQUI, uma vez, em vez de a cada
    // golpe: durante a batalha ninguém compra nó novo.
    marcas: marcasDe(personagem),
    // A MÃO DE CARDS É O LOADOUT, não a lista inteira (ver LoadoutSystem.js).
    // Com a árvore nova um personagem chega a 9 ativas; mostrar todas fazia
    // o jogador ler nove cards por turno e espremia cada card a ponto de o
    // texto não caber. `habilidadesEquipadas` devolve as 4 escolhidas fora
    // da batalha — e, para um save antigo sem escolha feita, as 4 primeiras,
    // que é exatamente o que aparecia antes.
    // Interesse "Magia": −10% no custo de MP. Aplicado na cópia de combate
    // da habilidade, e não na hora do gasto, para o card, a IA e o desconto
    // do MP lerem o mesmo número.
    habilidades: habilidadesEquipadas(personagem).map((h) => ({ ...h, cooldownAtual: 0, custoMP: custoMPComInteresse(personagem, h.custoMP) })),
    tracoId: personagem.tracoId,
    racaId: personagem.racaId,
    classeId: personagem.classeId,
    sorteUsada: false,
    sorteMiudaUsada: false,
    // IDENTIDADE DO HERÓI (ver IdentidadeSystem.js). Só o protagonista tem
    // elemento de afinidade e motivação — convocados ficam com null e nada
    // disso vale para eles.
    elementoAfinidade: personagem.elementoId || null,
    motivacaoId: personagem.motivacaoId || null,
    limiarFuria: limiarFuriaOrc(personagem),
    soproIncendiario: temCombinacao(personagem, "sopro_incendiario"),
    primeiroTurno: true,
    // PERSONALIDADE "Visão Aguçada": começa com 20 de ATB. O inimigo nasce
    // com `Math.random() * 40`, então 20 de adiantamento é meia largura desse
    // sorteio — costuma agir antes, sem nunca ser garantido. (O +2 de
    // velocidade do ELFO é outra coisa e mora em velocidadeTotal.)
    atb: personagem.tracoId === "visao_aguçada" ? 20 : 0,
    atbMax: 100,
    // O óleo pode ter sido usado no MAPA, antes da luta. Ele entra aqui como
    // estado de combate para pegar de graça o relógio de duração, o ícone na
    // ficha e a expiração — em vez de um segundo sistema de prazo paralelo.
    statusEffects: [statusDoOleo(personagem)].filter(Boolean),
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
  // ESCALA POR NÍVEL E DE CHEFE (ver EscalaSystem.js). Entra aqui, e só
  // aqui, porque este é o único lugar por onde um monstro vira combatente:
  // reforço de solo, emboscada, NG+, Modo História e dificuldade já se
  // multiplicam neste mesmo ponto, então a curva continua sendo um número
  // só de conferir em vez de seis lugares que podem discordar.
  const esc = escalaDoMonstro(monstroDef);
  const hpEscalado = Math.max(1, Math.round(monstroDef.hp * multEstat * esc.hp));
  const atkEscalado = Math.max(1, Math.round(monstroDef.atk * multEstat * esc.atk));
  const defesaEscalada = Math.max(0, Math.round(monstroDef.defesa * multEstat * esc.defesa));
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
    // Estado das fases (ver BossPhaseSystem.js). Declarado aqui para o objeto
    // ter forma estável desde o começo — `garantirBase` preenche `__base` no
    // primeiro uso, com os valores JÁ escalados por NG+/dificuldade acima.
    faseAtual: 1,
    quebras: 0,
    enfurecido: false,
    recargaHabilidade: 0,
    arquetipo: monstroDef.arquetipo || "aleatorio",
    // A escala aplicada logo acima vira um campo do combatente só para a
    // tela poder mostrá-la. O EscalaSystem sobe um monstro em até +75% de
    // ataque conforme o nível da zona, e nada avisava: a mesma criatura,
    // com o mesmo nome e o mesmo sprite, batia o dobro numa região
    // avançada e o jogador concluía que tinha ficado fraco.
    nivelMonstro: monstroDef.nivel || null,
    escala: esc,
    // E a escala SÓ DE NÍVEL, separada. `esc` já embute o multiplicador de
    // chefe (2,3× de vida), então mostrar `esc` no selo diria "+240% de
    // vida" para um chefe e o jogador leria isso como reforço da região.
    // São duas coisas diferentes: a coroa 👑 já conta que é chefe; o selo
    // conta o que a REGIÃO acrescentou.
    escalaNivel: escalaDeNivel(monstroDef.nivel),
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
// Chance de uma arma elemental comum deixar seu estado no alvo. Ver
// marcarEstadoPorArma para o porquê de não ser 100%.
// Quais status contam como "efeito negativo". Usado pelo traço do Anão
// ("Resistente") e pela poção de antídoto, que antes limpava o array inteiro
// — levando junto a fúria, a guarda e o óleo de arma que o jogador tinha
// acabado de gastar um turno para aplicar.
export const ESTADOS_RUINS = new Set([
  "condicao_veneno", "debuff_velocidade", "furia_debuff", "estado_elemental",
]);

const CHANCE_ESTADO_POR_ARMA = 0.25;

// Terreno (task #42): elemento dominante do bioma/masmorra deixa esse
// elemento mais forte para QUALQUER atacante (ex.: fogo no deserto), mas dá
// resistência aos inimigos do encontro contra esse mesmo elemento — eles são
// nativos do terreno, então já se adaptaram a ele. As duas coisas juntas se
// cancelam parcialmente quando o jogador ataca um inimigo local com o
// elemento do terreno (ligeira desvantagem, ~0.96x), incentivando variar o
// elemento contra a fauna nativa e recompensando esse elemento em qualquer
// outra situação (chefes de fora do bioma, PvE geral). Aditivo sobre a
// matriz elemental (ElementSystem.js) — nunca a substitui.
export const BONUS_ATAQUE_TERRENO = 1.2;
export const RESISTENCIA_TERRENO_INIMIGO = 0.8;

// Clima (melhoria de jogabilidade pós-backlog original, ver WeatherSystem.js):
// mesma ideia do terreno acima, mas mais fraca de propósito — o terreno é
// permanente/estrutural do bioma, o clima é passageiro (muda a cada poucos
// minutos reais). Os dois multiplicadores SOMAM quando o elemento do clima
// bate com o do terreno (ex.: chuva — água — no meio de um pântano de água),
// em vez de um substituir o outro.
export const BONUS_ATAQUE_CLIMA = 1.1;
export const RESISTENCIA_CLIMA_INIMIGO = 0.9;

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
    // "Primeiro Sangue" (efeito de item) precisa saber se ALGUM golpe já saiu
    // nesta batalha. Mora na Batalha, não no item: o efeito não guarda estado
    // próprio, senão duas batalhas seguidas compartilhariam a contagem.
    this.jaHouveGolpe = false;
    // PASSIVAS (ver PassiveSystem.js). Calculadas UMA vez, no começo da
    // batalha: recalcular por golpe seria O(time × passivas) num laço quente,
    // e passiva não muda no meio da luta. `modificadorDe` só faz uma consulta.
    this.passivas = modificadoresDoTime(time);
    // HP e Éter máximos podem ser ampliados por passiva. Aplicado aqui,
    // antes do primeiro turno, para a barra já nascer no tamanho certo.
    for (const c of time || []) {
      const m = modificadorDe(this.passivas, c);
      if (m.vida_max !== 1) {
        const novo = Math.max(1, Math.round(c.hpMax * m.vida_max));
        c.hp += novo - c.hpMax; c.hpMax = novo;
      }
      if (m.eter_max !== 1) {
        const novo = Math.max(0, Math.round(c.mpMax * m.eter_max));
        c.mp += novo - c.mpMax; c.mpMax = novo;
      }
      if (m.velocidade !== 1) c.velocidade = Math.max(1, Math.round(c.velocidade * m.velocidade));
    }
    // AMBIENTE AFIM (ver IdentidadeSystem.js): lutar num terreno ou clima do
    // próprio elemento dá defesa e Éter por turno. Decidido uma vez, aqui —
    // terreno e clima não mudam no meio da luta.
    for (const c of time || []) {
      c.ambienteAfim = FLAGS.terreno ? ambienteAfim(c.elementoAfinidade, this.terrenoElemento, this.climaElemento) : null;
    }
    this.log = [];
    this.terminada = false;
    this.resultado = null; // 'vitoria' | 'derrota' | 'fuga'
    // Ouro roubado por inimigos Ladrão ao longo da batalha — a UI (BattleUI)
    // deduz esse total do ouro real do personagem ao encerrar o combate,
    // qualquer que seja o resultado (o furto já aconteceu, vitória não
    // devolve o que foi roubado).
    this.ouroRoubado = 0;
    // Mesmo padrão de `ultimaRolagem`/`ultimaQuebra`: existe desde o começo
    // para o objeto ter forma estável (ver `selos` em rolarAtaque).
    this.ultimosSelos = null;
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
        anunciar(EVENTO.DANO_PERIODICO, { combatente: c, dano, icone: "☠️", nome: "Veneno" });
      }
      // Estados elementais com dano por turno (Caminhos do Herdeiro, task
      // #91) — hoje só Incendiado, ver elementalStates.json.
      if (s.tipo === "estado_elemental" && c.vivo && s.def && s.def.danoPorTurnoPercentHpMax) {
        const dano = Math.max(1, Math.round(c.hpMax * s.def.danoPorTurnoPercentHpMax));
        this.aplicarDano(c, dano);
        this.registrar(`${s.def.icone || ""} ${c.nome} sofre ${dano} de dano por estar ${s.def.nome}!`);
        anunciar(EVENTO.DANO_PERIODICO, { combatente: c, dano, icone: s.def.icone || "🔥", nome: s.def.nome });
      }
      // PERSONALIDADE "Resistente": efeitos negativos perdem 2 turnos por
      // vez, em vez de 1 — e só o que é RUIM, senão o herói perderia os
      // próprios buffs na metade do tempo.
      const ruim = ESTADOS_RUINS.has(s.tipo)
        || (s.tipo === "estado_elemental" && s.def && s.def.beneficio !== true);
      let passo = (ruim && c.isPlayer && c.tracoId === "resistente") ? 2 : 1;
      // RAÇA — Anão, "Pele de Pedra": todo efeito negativo dura 1 turno a
      // menos. Cobra o turno extra uma vez só por efeito, na primeira
      // contagem; vale venha o efeito de onde vier (golpe, habilidade,
      // estado elemental). Antes este comentário dizia "traço do anão", mas o
      // código testava a PERSONALIDADE Resistente — o anão não ganhava nada.
      if (ruim && c.isPlayer && c.racaId === "anao" && !s.peleDePedra) {
        s.peleDePedra = true;
        passo += 1;
      }
      s.duracao -= passo;
      return s.duracao > 0 && c.vivo;
    });
    // O óleo troca o elemento dos golpes enquanto vale. Como o relógio acima
    // pode tê-lo acabado de derrubar, a sincronia vem DEPOIS do filtro.
    sincronizarElemento(c);
    // Ambiente afim (terreno/clima do elemento do herói): Éter por turno.
    if (c.ambienteAfim && c.ambienteAfim.mp && c.vivo && c.mp < c.mpMax) {
      c.mp = Math.min(c.mpMax, c.mp + c.ambienteAfim.mp);
    }
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

  // Estado que as condições de marca leem. Para um inimigo, "aliados" são os
  // outros inimigos — assim uma marca concedida a um convocado que lute do
  // lado errado (nunca acontece hoje, mas o motor não pode assumir isso)
  // continua significando a mesma coisa.
  ctxMarcas(portador) {
    const doJogador = this.time.includes(portador);
    return {
      aliados: doJogador ? this.timeVivo() : this.inimigosVivos(),
      inimigosVivos: doJogador ? this.inimigosVivos().length : this.timeVivo().length,
    };
  }

  defesaEfetiva(c) {
    let def = c.defesa;
    if (c.primeiroTurno && c.isPlayer && c.tracoId === "cauteloso") def = Math.round(def * 1.2);
    const buff = c.statusEffects.find((s) => s.tipo === "buff_defesa");
    if (buff) def = Math.round(def * (1 + buff.valor));
    const furiaDebuff = c.statusEffects.find((s) => s.tipo === "furia_debuff");
    if (furiaDebuff) def = Math.round(def * (1 - furiaDebuff.valor));
    if (FLAGS.reacoesElementais) def = Math.round(def * modificadorDefesaEstado(c));
    if (c.ambienteAfim && c.ambienteAfim.defesa) def = Math.round(def * (1 + c.ambienteAfim.defesa));
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
      // Cada quebra seguinte custa mais caro, e na segunda o chefe enfurece.
      // Sem isto dava para acorrentar atordoamento acertando a fraqueza
      // elemental e o chefe nunca jogava — a mecânica de postura virava um
      // botão de vitória em vez de recompensa.
      const q = registrarQuebra(alvo);
      if (q) this.registrar(q.texto);
      if (q) anunciar(EVENTO.QUEBRA, { alvo: alvo.nome, ...q });
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

  // BUG (auditoria de combate): o RequisitoSystem calculava `acerto` — a
  // penalidade de ACERTO por usar equipamento pesado demais — e NINGUÉM lia.
  // Só o dano era penalizado. Convertida aqui para PONTOS de d20, na mesma
  // escala do Ofuscado: −30% (o teto do sistema) vira −3 na faixa de erro
  // total. Como o Ofuscado, nunca tira um crítico já rolado.
  //
  // Mora numa função só porque `resolverAcaoD20` e `chancesD20` precisam
  // chegar ao mesmo número — se a prévia e a rolagem discordarem, a barra de
  // previsão da carta passa a mentir.
  penalidadeDeAcerto(atacante) {
    let p = FLAGS.reacoesElementais ? penalidadeD20Estado(atacante) : 0;
    if (atacante && atacante.isPlayer) {
      const eq = penalidadeEquipada(atacante);
      if (eq.penalizado) p += Math.round((1 - eq.acerto) * 10);
    }
    return p;
  }

  resolverAcaoD20(atacante, alvo) {
    let d = d20();
    // RAÇA — Halfling, "Sorte Miúda": o primeiro 1 da batalha é re-rolado.
    // Vem antes da personalidade Sortudo de propósito: um halfling sortudo
    // gasta primeiro a sorte da raça e guarda a da personalidade.
    if (d === 1 && atacante.isPlayer && atacante.racaId === "halfling" && !atacante.sorteMiudaUsada) {
      atacante.sorteMiudaUsada = true;
      d = d20();
      this.registrar(`${atacante.nome} tem a Sorte Miúda do halfling e re-rola o 1!`);
    }
    // PERSONALIDADE — Sortudo: uma rolagem de 1 a 3 é refeita, uma vez.
    if (d < 4 && atacante.isPlayer && atacante.tracoId === "sortudo" && !atacante.sorteUsada) {
      atacante.sorteUsada = true;
      d = d20();
      this.registrar(`${atacante.nome} conta com a sorte e re-rola o dado!`);
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
    const penalidade = this.penalidadeDeAcerto(atacante);
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
      // `deQuem` carrega QUEM preparou o combo. Sem isso a tela sabe que houve
      // combo mas não sabe de onde traçar a linha até aqui.
      if (combo) resultado = { multiplicador: BONUS_DANO_COMBO, combo, deQuem: anterior.atacante };
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
    if (relacao === "imune") return { min: 0, max: 0, esperado: 0, minCritico: 0, maxCritico: 0, imune: true, relacaoElemental: relacao, combo: null, reacao: null, elemento: elemResolvido };
    const combo = this.peekComboElemental(atacante, alvo, elemResolvido);
    let baseComMultiplicadores = base * multElemental * this.multiplicadorTerreno(elemResolvido, alvo) * this.multiplicadorClima(elemResolvido, alvo) * combo.multiplicador;
    if (atacante.racaId === "orc" && atacante.hp / atacante.hpMax <= (atacante.limiarFuria || 0.3)) baseComMultiplicadores *= 1.3;
    baseComMultiplicadores *= multiplicadorIdentidade(atacante, alvo, elemResolvido, this.dadosElementos, { fisico: true }).mult;
    // Prévia (só-leitura) do bônus de reação elemental — ver peekReacaoElemental
    // em ElementalReactionSystem.js. Nunca consome o estado do alvo.
    let ignoraDefesaExtraPreview = 0;
    let reacaoPrevista = null;
    if (FLAGS.reacoesElementais) {
      baseComMultiplicadores *= modificadorDanoRecebidoEstado(alvo, elemResolvido);
      const { ocorreu, reacao, multiplicadorDano } = peekReacaoElemental(alvo, elemResolvido, true, this.dadosReacoes);
      if (ocorreu) {
        reacaoPrevista = reacao;
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
      // `esperado`: mesma fórmula com variância 1.0 (o centro da faixa) —
      // usado pela barra-fantasma de HP (item 12/13 do pedido de cards),
      // nunca por nenhuma decisão de jogo.
      esperado: finalizar(1, false),
      minCritico: finalizar(0.85, true), maxCritico: finalizar(1.15, true),
      relacaoElemental: relacao, combo: combo.combo,
      reacao: reacaoPrevista, elemento: elemResolvido,
    };
  }

  // =====================================================================
  // PRÉVIAS SÓ-LEITURA PARA A UI DE CARDS (nenhuma delas rola dado, muda
  // estado ou é chamada por qualquer caminho que decida um resultado real).
  // Ficam AQUI, e não num módulo de UI, de propósito: espelham fórmulas que
  // moram neste mesmo arquivo (rolarAtaque, usarHabilidade/dano_magico,
  // usarHabilidade/cura, resolverAcaoD20, acumularQuebra), então qualquer
  // ajuste de balanceamento futuro é feito lado a lado com a prévia
  // correspondente, em vez de duas cópias em arquivos distantes.
  // =====================================================================

  // Espelha o ramo `dano_magico` de usarHabilidade(): INT * multiplicador,
  // variância 0.9..1.1 (não 0.85..1.15 como o físico), defesa a 30% (não
  // 50%) e SEM redução de formação. Retorna o mesmo formato de
  // estimarFaixaDano() para a UI poder tratar os dois igual.
  estimarFaixaDanoMagico(atacante, alvo, { multiplicador = 1, elementoAtacante = null } = {}) {
    const elemResolvido = elementoAtacante || atacante.elemento || "fisico";
    let relacao = "neutro";
    let multElemental = 1;
    if (FLAGS.elementos && this.dadosElementos) {
      const elemDef = alvo.elemento || "fisico";
      relacao = relacaoElemental(elemResolvido, elemDef, this.dadosElementos);
      multElemental = multiplicadorElemental(elemResolvido, elemDef, this.dadosElementos);
    }
    if (relacao === "imune") return { min: 0, max: 0, esperado: 0, minCritico: 0, maxCritico: 0, imune: true, relacaoElemental: relacao, combo: null, reacao: null, elemento: elemResolvido };
    const combo = this.peekComboElemental(atacante, alvo, elemResolvido);
    let base = (atacante.atributos.INT || 0) * multiplicador;
    base *= multElemental * this.multiplicadorTerreno(elemResolvido, alvo) * this.multiplicadorClima(elemResolvido, alvo) * combo.multiplicador;
    base *= multiplicadorIdentidade(atacante, alvo, elemResolvido, this.dadosElementos).mult;
    let reacaoPrevista = null;
    if (FLAGS.reacoesElementais) {
      base *= modificadorDanoRecebidoEstado(alvo, elemResolvido);
      // tipoFisico=false: magia nunca aciona Estilhaçar/Ruptura (mesma regra
      // do ramo dano_magico de usarHabilidade).
      const { ocorreu, reacao, multiplicadorDano } = peekReacaoElemental(alvo, elemResolvido, false, this.dadosReacoes);
      if (ocorreu) { reacaoPrevista = reacao; base *= multiplicadorDano; }
    }
    const bonusAtordoado = alvo.chefe && alvo.atordoado ? BONUS_DANO_ATORDOADO : 1;
    const defAplicada = this.defesaEfetiva(alvo) * 0.3;
    const finalizar = (varianciaMult, dobraCritico) => {
      let dano = base * varianciaMult;
      if (dobraCritico) dano *= 2;
      dano = Math.max(1, Math.round(dano - defAplicada));
      return Math.round(dano * bonusAtordoado);
    };
    return {
      min: finalizar(0.9, false), max: finalizar(1.1, false), esperado: finalizar(1, false),
      minCritico: finalizar(0.9, true), maxCritico: finalizar(1.1, true),
      relacaoElemental: relacao, combo: combo.combo, reacao: reacaoPrevista, elemento: elemResolvido,
    };
  }

  // Espelha o ramo `cura` de usarHabilidade() (que sempre cura o próprio
  // conjurador). `efetivaMin/efetivaMax` já descontam o excedente acima do
  // HP máximo — item 18 do pedido: não induzir o jogador a gastar uma cura
  // grande num alvo quase cheio.
  estimarCura(atacante, habilidade) {
    const mult = habilidade.multiplicador || 1;
    const modEstado = FLAGS.reacoesElementais ? modificadorCuraRecebidaEstado(atacante) : 1;
    const bruta = (v) => Math.max(0, Math.round(Math.round((atacante.atributos.INT || 0) * mult * v) * modEstado));
    const min = bruta(0.9);
    const max = bruta(1.1);
    const esperado = bruta(1);
    const espaco = Math.max(0, atacante.hpMax - atacante.hp);
    return {
      min, max, esperado,
      efetivaMin: Math.min(min, espaco), efetivaMax: Math.min(max, espaco), efetivaEsperada: Math.min(esperado, espaco),
      desperdicada: Math.max(0, esperado - espaco),
      espaco,
      curaReduzida: modEstado < 1,
    };
  }

  // Probabilidades da rolagem d20 desta ação, derivadas das MESMAS regras de
  // resolverAcaoD20(): crítico natural em d>16, erro total em d-penalidade<4,
  // bloqueio só quando o alvo está defendendo, re-rolagem do traço "sortudo"
  // enquanto ainda não foi usada nesta batalha. Devolve frações 0..1.
  chancesD20(atacante, alvo, { tipoFisico = true, elemento = null } = {}) {
    const penalidade = this.penalidadeDeAcerto(atacante);
    const rerolagem = !!(atacante.isPlayer && atacante.tracoId === "sortudo" && !atacante.sorteUsada);
    const rerolagemRaca = !!(atacante.isPlayer && atacante.racaId === "halfling" && !atacante.sorteMiudaUsada);
    const limiarErro = Math.min(20, Math.max(0, 4 + penalidade)); // erro se d < limiarErro
    const faces = 20;
    // Distribuição do d20 FINAL, depois das re-rolagens, na mesma ordem de
    // resolverAcaoD20: primeiro a Sorte Miúda (só o 1), depois a Sortudo (1 a
    // 3). Cada re-rolagem pega a massa das faces que ela refaz e espalha
    // igualmente pelas 20 faces.
    const dist = new Array(faces + 1).fill(1 / faces);
    dist[0] = 0;
    const rerolar = (ate) => {
      let massa = 0;
      for (let f = 1; f <= ate; f += 1) { massa += dist[f]; dist[f] = 0; }
      for (let f = 1; f <= faces; f += 1) dist[f] += massa / faces;
    };
    if (rerolagemRaca) rerolar(1);
    if (rerolagem) rerolar(3);
    const pMenorQue = (t) => {
      let p = 0;
      for (let f = 1; f < Math.min(faces + 1, t); f += 1) p += dist[f];
      return p;
    };
    const pErro = pMenorQue(limiarErro);
    const pCriticoNatural = 1 - pMenorQue(17);
    const pAcerto = Math.max(0, 1 - pErro);
    // Bônus de crítico da árvore/talentos: só é testado quando a rolagem não
    // foi crítico natural nem erro total (mesma condição de rolarAtaque).
    const critBonus = Math.max(0, Math.min(1, atacante.critBonus || 0));
    let pCritico = pCriticoNatural + Math.max(0, pAcerto - pCriticoNatural) * critBonus;
    // Bloqueio: só existe se o alvo declarou Defender. Aproximação honesta —
    // usa o mesmo limiar (10 + metade da defesa efetiva) de resolverAcaoD20.
    let pBloqueio = 0;
    let limiarBloqueio = null;
    if (alvo && alvo.defendendo) {
      limiarBloqueio = 10 + Math.floor(this.defesaEfetiva(alvo) / 2);
      pBloqueio = Math.max(0, pMenorQue(limiarBloqueio) - pErro);
    }
    // Crítico GARANTIDO: um golpe físico contra alvo Congelado dispara
    // Estilhaçar, que tem `garanteCritico` (ver elementalReactions.json).
    let criticoGarantido = false;
    if (FLAGS.reacoesElementais && alvo) {
      const estado = estadoElementalAtivo(alvo);
      if (estado) {
        const r = buscarReacaoAplicavel(estado.estadoId, elemento, tipoFisico, this.dadosReacoes);
        if (r && r.garanteCritico) criticoGarantido = true;
      }
    }
    return {
      acerto: Math.max(0, pAcerto - pBloqueio),
      erro: pErro,
      bloqueio: pBloqueio,
      critico: criticoGarantido ? 1 : pCritico,
      criticoGarantido,
      penalidadeD20: penalidade,
      rerolagemSorte: rerolagem,
      rerolagemSorteMiuda: rerolagemRaca,
      limiarBloqueio,
    };
  }

  // Ganho de postura (ruptura) que ESTE golpe daria no alvo, pelas mesmas
  // regras de acumularQuebra(): só o time do jogador enche, só contra chefe
  // vivo e ainda não atordoado, e o valor depende da relação elemental.
  estimarRuptura(atacante, alvo, relacao) {
    if (!atacante || !atacante.isPlayer || !alvo || alvo.isPlayer) return null;
    if (!alvo.chefe || !alvo.vivo || alvo.atordoado || !alvo.posturaMax) return null;
    const ganho = GANHO_QUEBRA_POR_RELACAO[relacao] ?? GANHO_QUEBRA_POR_RELACAO.neutro;
    if (ganho <= 0) return null;
    const restante = Math.max(0, alvo.posturaMax - alvo.postura);
    return { ganho, restante, quebra: ganho >= restante, postura: alvo.postura, posturaMax: alvo.posturaMax };
  }

  // Chance de o alvo bloquear o PRÓXIMO golpe recebido se ele usar Defender
  // agora — usada pelo card "Defender" pra dizer o que a defesa vale de fato
  // (item 19), em vez de só "fica defendendo".
  chanceBloqueioSeDefender(c) {
    const limiar = 10 + Math.floor(this.defesaEfetiva(c) / 2);
    return { limiar, chance: Math.min(20, Math.max(0, limiar - 1)) / 20 };
  }

  // Faixa de dano que um plano de intenção inimiga (ver decidirAcao) causaria
  // no alvo escolhido. Reusa exatamente os multiplicadores que
  // conjurarAtaque()/ataqueBasico() usariam — nunca inventa um número novo.
  estimarDanoIntencao(inimigo, plano) {
    if (!plano || !plano.alvo || !plano.alvo.vivo) return null;
    if (plano.tipo === "atacar") return this.estimarFaixaDano(inimigo, plano.alvo);
    if (plano.tipo === "conjurar") {
      return this.estimarFaixaDano(inimigo, plano.alvo, {
        multiplicador: 1.3,
        ignoraDefesa: Math.round(this.defesaEfetiva(plano.alvo) * 0.4),
        elementoAtacante: inimigo.elemento,
        respeitaFormacao: false,
      });
    }
    return null;
  }

  rolarAtaque(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true } = {}) {
    const { critico: criticoBase, erroTotal, bloqueado } = this.resolverAcaoD20(atacante, alvo);
    let critico = criticoBase;
    const alvoDef = this.defesaEfetiva(alvo);
    // Bônus de crítico da árvore de habilidades: chance extra de crítico
    // (não se aplica a um erro total natural).
    // Chance extra de crítico: a fixa (`critBonus`, vinda de nós de árvore e
    // equipamento) e a CONDICIONAL das marcas de classe (Vantagem, Trama,
    // Rajada), que só existe contra o alvo certo. Somadas num sorteio só —
    // dois sorteios separados dariam mais crítico do que a soma anunciada.
    const critoMarca = bonusDeMarcas(atacante, alvo, this.ctxMarcas(atacante)).critico;
    const chanceCritExtra = (atacante.critBonus || 0) + critoMarca;
    if (!critico && !erroTotal && chanceCritExtra > 0 && Math.random() < chanceCritExtra) critico = true;

    if (erroTotal) {
      this.registrar(`${atacante.nome} erra completamente o ataque! (d20: ${this.ultimaRolagem.d}, erro total abaixo de 4)`);
      return { acertou: false, critico: false, dano: 0, relacaoElemental: "neutro" };
    }
    if (bloqueado) {
      this.registrar(`${alvo.nome} se defende e bloqueia o ataque de ${atacante.nome}! (seu d20 ${this.ultimaRolagem.d} não superou o limiar de defesa ${this.ultimaRolagem.limiarBloqueio})`);
      return { acertou: false, critico: false, dano: 0, relacaoElemental: "neutro", bloqueado: true };
    }

    // SELOS DO GOLPE (auditoria de combate, itens 7, 13, 14 e 15).
    //
    // O QUE ISTO RESOLVE. O número de dano é o resultado de até dez
    // multiplicadores empilhados — item lendário, traço racial, marca de
    // classe, terreno, clima, atordoamento, formação, penalidade de
    // equipamento — e o jogador via só o total. Um golpe de 47 e um de 12 no
    // mesmo inimigo pareciam sorte, e as decisões que de fato produziram a
    // diferença (quebrar a postura antes, lutar no terreno certo, atacar com
    // HP baixo) não recebiam crédito nenhum.
    //
    // Cada multiplicador que mexe no dano em mais de 5% empurra um selo aqui,
    // e a tela o desenha colado no número (ver spawnFloatingText em
    // BattleUI). Um lugar só, na ordem em que os multiplicadores realmente
    // acontecem — o que também torna esta lista uma leitura honesta da
    // fórmula, em vez de um comentário que envelhece.
    const selos = [];
    const selar = (texto, tom, mult) => {
      if (mult === undefined || mult === null || Math.abs(mult - 1) < 0.05) return;
      const pct = Math.round((mult - 1) * 100);
      selos.push({ texto, tom, pct, rotulo: `${texto} ${pct > 0 ? "+" : ""}${pct}%` });
    };

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
    if (atacante.racaId === "orc" && atacante.hp / atacante.hpMax <= (atacante.limiarFuria || 0.3)) { dano *= 1.3; selar("FÚRIA ORC", "bom", 1.3); }
    // EFEITOS DE ITEM LENDÁRIO (ver ItemEffectSystem.js). Só o time do jogador
    // carrega equipamento, então para inimigos isto devolve valores neutros e
    // não custa nada.
    const efeitos = modificadoresDeAtaque(atacante, alvo, {
      primeiroGolpe: !this.jaHouveGolpe,
    });
    dano *= efeitos.multiplicador;
    // Um selo por efeito de item que realmente entrou — Ceifador, Algoz,
    // Primeiro Sangue, Perfurar, Duplo Elemento, Estilhaçador. Os nove
    // efeitos lendários eram invisíveis em combate: existiam só como texto na
    // descrição do item, e o jogador não tinha como saber se a arma que
    // comprou estava fazendo alguma coisa.
    (efeitos.aplicados || []).forEach((e) => {
      const nome = (e.def && e.def.nome) ? e.def.nome.toUpperCase() : String(e.id || "").toUpperCase();
      if (e.mult !== undefined) selar(nome, "item", e.mult);
      else selos.push({ texto: nome, tom: "item", pct: null, rotulo: nome });
    });
    // "Estilhaçador": crítico garantido contra alvo já marcado por estado
    // elemental. Entra AQUI, antes de o crítico dobrar o dano lá em cima —
    // o `dano` já foi multiplicado por 2 se `critico` era true, então a
    // promoção precisa aplicar o dobro por conta própria.
    if (efeitos.garanteCritico && !critico) { critico = true; dano *= 2; }

    // REQUISITO DE ATRIBUTO (ver RequisitoSystem.js). Arma pesada demais para
    // o personagem continua equipável — só rende menos, proporcional ao que
    // falta. Nunca vira item morto na mochila.
    const pen = penalidadeEquipada(atacante);
    if (pen.penalizado) { dano *= pen.dano; selar("EQUIPAMENTO PESADO", "ruim", pen.dano); }

    // PASSIVAS do atacante e do alvo. Um ponto só para as duas pontas: aqui
    // o dano já é o número final antes da defesa, então "causa mais" e
    // "recebe menos" não podem se aplicar duas vezes por caminhos diferentes.
    const passivaAtq = modificadorDe(this.passivas, atacante);
    const passivaAlvo = modificadorDe(this.passivas, alvo);
    dano *= passivaAtq.dano;
    dano *= passivaAlvo.defesa;
    // BUG (auditoria): `resistencia_elemental` também nunca era lida. Vale só
    // contra golpe COM elemento — contra "fisico" seria uma segunda passiva
    // de defesa com outro nome, e as duas se acumulariam sem o jogador ter
    // como entender por quê.
    const elemDoGolpe = elementoAtacante || atacante.elemento || "fisico";
    if (elemDoGolpe !== "fisico" && passivaAlvo.resistencia_elemental !== 1) {
      dano *= passivaAlvo.resistencia_elemental;
    }

    // MARCAS DE CLASSE (ver RecursoClasseSystem.js). Diferentemente da
    // passiva, a marca depende da SITUAÇÃO — por isso é avaliada aqui, com
    // atacante e alvo em mãos, e não uma vez no construtor. Entra no mesmo
    // ponto das passivas, pelo mesmo motivo: um lugar só decide "causa mais"
    // e "recebe menos".
    const marcaAtq = bonusDeMarcas(atacante, alvo, this.ctxMarcas(atacante));
    const marcaAlvo = bonusDeMarcas(alvo, atacante, this.ctxMarcas(alvo));
    dano *= marcaAtq.dano;
    dano *= marcaAlvo.defesa;
    if (marcaAtq.ativas.length) {
      this.registrar(`   ${marcaAtq.ativas.map((m) => `${m.icone || "◈"} ${m.nome}`).join(" · ")} em ação.`);
      // A marca disparava e a única pista era essa linha de log, escrita
      // DEPOIS do golpe — tarde demais para influenciar a jogada. Agora vem
      // colada no número.
      marcaAtq.ativas.forEach((m) => {
        const r = `${m.icone || "◈"} ${String(m.nome).toUpperCase()}`;
        selos.push({ texto: r, tom: "marca", pct: null, rotulo: r });
      });
    }

    const elemResolvido = elementoAtacante || atacante.elemento || "fisico";
    let relacao = "neutro";
    if (FLAGS.elementos && this.dadosElementos) {
      const elemDef = alvo.elemento || "fisico";
      relacao = relacaoElemental(elemResolvido, elemDef, this.dadosElementos);
      // GOLPE DE DOIS ELEMENTOS: fica com a melhor das duas relações. É o que
      // faz o efeito valer — um alvo que resiste a um dos dois não anula o
      // golpe inteiro.
      if (efeitos.elementoSecundario) {
        const relB = relacaoElemental(efeitos.elementoSecundario, elemDef, this.dadosElementos);
        relacao = melhorRelacao(relacao, relB);
      }
      // PERFURAR ELEMENTO: resistência e imunidade viram neutro. Vantagem é
      // preservada — o efeito impede o alvo de anular, não vira vantagem.
      if (efeitos.ignoraRelacaoRuim) relacao = relacaoPerfurada(relacao);
      dano *= multiplicadorDaRelacao(relacao, this.dadosElementos);
    }
    const multTerreno = this.multiplicadorTerreno(elemResolvido, alvo);
    const multClima = this.multiplicadorClima(elemResolvido, alvo);
    dano *= multTerreno;
    dano *= multClima;
    // Terreno e clima ficam no cabeçalho da batalha, que o jogador lê uma vez
    // e esquece. Somados chegam a ×1,32 — a diferença entre lutar no lugar
    // certo e no lugar errado, e ela nunca aparecia no momento do golpe.
    selar("TERRENO", "ambiente", multTerreno);
    selar("CLIMA", "ambiente", multClima);
    // IDENTIDADE (ver IdentidadeSystem.js): essência do elemento de quem
    // bate e de quem apanha, sintonia do golpe físico com a fraqueza do alvo,
    // motivação Justiça contra chefe. Cada uma com o seu selo.
    const identidade = multiplicadorIdentidade(atacante, alvo, elemResolvido, this.dadosElementos, { fisico: true });
    dano *= identidade.mult;
    identidade.selos.forEach(([texto, tom, mult]) => selar(texto, tom, mult));
    const combo = this.verificarComboElemental(atacante, alvo, elemResolvido);
    dano *= combo.multiplicador;
    if (combo.combo) {
      // O badge "COMBO!" já existia NA CARTA, antes de jogar. O que faltava
      // era o momento: nada ligava, na arena, o herói que preparou ao herói
      // que fechou — e é essa ligação que ensina a jogada.
      selar("COMBO", "combo", combo.multiplicador);
      anunciar(EVENTO.COMBO, {
        primeiro: combo.deQuem || null, segundo: atacante, alvo,
        nome: combo.combo.nome || "Combo elemental",
      });
    }
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
        // "Catalisador": a reação em si rende mais. Multiplica só o BÔNUS da
        // reação, não o dano inteiro — senão um item que só deveria turbinar
        // reações viraria um multiplicador geral disfarçado.
        const extra = efeitos.bonusReacao || 0;
        dano *= extra > 0 ? (1 + (multiplicadorDano - 1) * (1 + extra)) : multiplicadorDano;
        if (reacao.garanteCritico && !critico) { critico = true; dano *= 2; }
        if (reacao.ignoraDefesaRestante) ignoraDefesaExtra = 999;
      }
    }
    const defReduzida = Math.max(0, alvoDef - ignoraDefesa - ignoraDefesaExtra);
    dano = Math.max(1, Math.round(dano - defReduzida * 0.5));
    if (respeitaFormacao) {
      const red = this.formacaoReducaoDano(alvo);
      dano = Math.max(1, Math.round(dano * red));
      // O jogador batia num alvo da retaguarda, o número vinha menor, e nada
      // dizia que a linha de frente inimiga estava absorvendo parte do golpe.
      selar("PROTEGIDO", "ruim", red);
    }
    // Chefe atordoado (barra de quebra): dano bônus enquanto durar. É a
    // recompensa INTEIRA do sistema de postura — encher a barra, quebrar e
    // bater +35% — e não tinha nenhum sinal no número.
    if (alvo.chefe && alvo.atordoado) {
      dano = Math.round(dano * BONUS_DANO_ATORDOADO);
      selar("ATORDOADO", "postura", BONUS_DANO_ATORDOADO);
    }
    // Imunidade elemental anula o dano por completo — sobrepõe o piso de 1
    // de dano usado no restante do cálculo.
    if (relacao === "imune") dano = 0;

    if (reacaoOcorrida) this.resolverConsequenciasReacao(atacante, alvo, reacaoOcorrida, dano);

    // Gancho para a tela, no mesmo padrão de `ultimaQuebra` e
    // `ultimaViradaDeFase`: a UI monta o efeito visual a partir de
    // `ultimaRolagem`, que é gravada ANTES do cálculo do dano e portanto não
    // pode carregar os selos. O `seq` amarra os dois — sem ele, os selos de
    // um golpe vazariam para o número do golpe seguinte.
    this.ultimosSelos = { seq: this.rolagemSeq, selos };
    return { acertou: true, critico, dano, relacaoElemental: relacao, combo: combo.combo, reacaoElemental: reacaoOcorrida, selos };
  }

  // Aplica o estado elemental que uma habilidade declare (`habilidade.
  // aplicaEstado`, ver elementalStates.json) no alvo que ela acabou de
  // acertar — usado pelas árvores de talento novas (Caminhos do Herdeiro,
  // tasks #93/#94), nenhuma habilidade existente antes dessas tasks declara
  // isso, então esta função nunca roda em combate hoje sem uma dessas.
  // `habilidade.duracaoEstado` (opcional) sobrescreve a duração padrão do
  // estado; sem ela, usa `duracaoPadrao` do próprio estado.
  // Qual estado um elemento deixa no alvo. A tabela vive nos DADOS
  // (elementalStates.json declara `elementoOrigem` em cada estado), então
  // um estado novo passa a valer sem tocar em código.
  estadoDoElemento(elemento) {
    if (!elemento || !this.dadosEstados) return null;
    const lista = this.dadosEstados.estados || [];
    const achou = lista.find((e) => e.elementoOrigem === elemento);
    return achou ? achou.id : null;
  }

  aplicarEstadoDeHabilidade(habilidade, alvo) {
    if (!FLAGS.reacoesElementais || !habilidade.aplicaEstado || !alvo || !alvo.vivo) return;
    const entrada = aplicarEstadoElemental(alvo, habilidade.aplicaEstado, this.dadosEstados, habilidade.duracaoEstado || null);
    if (entrada && entrada.def) {
      this.registrar(`${entrada.def.icone || ""} ${alvo.nome} fica ${entrada.def.nome}!`);
      // A marcação elemental é o que ACENDE todo o sistema de reações — molhar
      // agora para conduzir depois. Acontecia em silêncio: o ícone aparecia no
      // card no render seguinte e nada mostrava que veio DA ARMA de quem
      // acabou de bater.
      anunciar(EVENTO.MARCA_ELEMENTAL, {
        alvo, estadoId: entrada.def.id,
        icone: entrada.def.icone || "✨", elemento: entrada.def.elementoOrigem || null,
      });
    }
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
    // A linha acima existe desde que as reações existem — e some no rolar do
    // log no meio da luta. O anúncio abaixo dá um letreiro na tela (ver
    // RevelacoesCombate.js), que é o que faz o jogador descobrir que molhar
    // o alvo antes do golpe de raio muda alguma coisa.
    anunciar(EVENTO.REACAO, {
      nome: reacao.nome, icone: reacao.icone, descricao: reacao.descricao,
      alvo: alvo ? alvo.nome : "", dano: danoFinal,
    });
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
    // ELETRIZADO — o estado que não fazia nada.
    //
    // `elementalStates.json` declara `propagaCentelha: true` e
    // `centelhaPercent: 0.4` no Eletrizado desde que o arquivo existe, e
    // NENHUMA linha do jogo lia esses dois campos. O jogador aplicava o
    // estado, via o ícone, e nada acontecia nunca.
    //
    // A regra: quem está Eletrizado e leva dano espalha uma fração dele para
    // outro do MESMO LADO. `__emCentelha` é a trava contra recursão — sem ela
    // dois eletrizados de lados opostos se descarregariam um no outro para
    // sempre e a batalha travaria dentro de uma pilha de chamadas.
    const centelha = (FLAGS.reacoesElementais && !this.__emCentelha && alvo.vivo && dano > 0)
      ? this.centelhaDe(alvo) : null;

    alvo.hp = Math.max(0, alvo.hp - dano);
    if (alvo.hp <= 0) {
      alvo.vivo = false;
      this.registrar(`${alvo.nome} foi derrotado!`);
      return;
    }
    // FASES DE CHEFE (ver BossPhaseSystem.js). O chefe era estatisticamente
    // um monstro comum com mais HP: caía em ~1 rodada de time e nunca fazia
    // nada. Agora a luta muda em 66% e 33% da vida dele. A checagem mora
    // aqui, no único ponto por onde TODO dano passa — colocá-la em cada
    // golpe seria esquecer um.
    const virada = checarViradaDeFase(alvo);
    if (virada) {
      this.registrar(virada.texto);
      if (virada.liberaHabilidade && virada.habilidade) {
        this.registrar(`   ${virada.habilidade.icone} ${alvo.nome} agora pode usar ${virada.habilidade.nome}.`);
      }
      // Gancho de animação, mesmo padrão de `ultimaQuebra`: a UI dá um
      // momento visual à virada em vez de só uma linha no registro.
      this.faseSeq = (this.faseSeq || 0) + 1;
      this.ultimaViradaDeFase = { seq: this.faseSeq, alvo, ...virada };
      anunciar(EVENTO.FASE_CHEFE, {
        chefe: alvo.nome, fase: virada.fase, nome: virada.nome,
        habilidade: virada.liberaHabilidade ? virada.habilidade : null,
      });
    }

    // A centelha do Eletrizado salta DEPOIS de o dano original ter sido
    // resolvido por inteiro — inclusive a virada de fase acima. Assim a
    // ordem dos acontecimentos na tela é a mesma da lógica.
    if (centelha) this.propagarCentelha(alvo, dano, centelha);
  }

  // O estado Eletrizado ativo num combatente, ou null.
  centelhaDe(c) {
    const s = (c.statusEffects || []).find(
      (e) => e.tipo === "estado_elemental" && e.def && e.def.propagaCentelha
    );
    return s ? s.def : null;
  }

  propagarCentelha(origem, dano, def) {
    const mesmoLado = origem.isPlayer ? this.timeVivo() : this.inimigosVivos();
    const outros = mesmoLado.filter((c) => c !== origem && c.vivo);
    if (!outros.length) return;
    const destino = outros[Math.floor(Math.random() * outros.length)];
    const salto = Math.max(1, Math.round(dano * (def.centelhaPercent || 0.4)));
    this.__emCentelha = true;
    try {
      this.aplicarDano(destino, salto);
    } finally {
      this.__emCentelha = false;
    }
    this.registrar(`${def.icone || "⚡"} A centelha salta de ${origem.nome} para ${destino.nome}: ${salto} de dano!`);
    anunciar(EVENTO.REACAO, {
      nome: "Centelha", icone: def.icone || "⚡",
      descricao: `A carga de ${origem.nome} salta para ${destino.nome}.`,
      alvo: destino.nome, dano: salto,
    });
  }

  // ARMA ELEMENTAL MARCA O ALVO — com CHANCE, não sempre.
  //
  // É isto que faz as reações elementais acontecerem jogando: uma espada de
  // água deixa o alvo Molhado, e o golpe seguinte de Raio vira Condução
  // (dano extra + a corrente salta para outro inimigo); um golpe físico
  // contra alvo Congelado vira Estilhaçar (crítico garantido).
  //
  // A chance é baixa de propósito. Aplicar SEMPRE faria toda luta virar uma
  // cascata de reações e o efeito deixaria de ser especial — vira ruído. Com
  // 25%, a reação é um momento; e quem quiser garantia usa uma arma lendária
  // com Ressonância, que aplica todo golpe. Aí o lendário vale por uma
  // REGRA, não por um número maior.
  marcarEstadoPorArma(atacante, alvo) {
    if (!FLAGS.reacoesElementais || !alvo || !alvo.vivo) return;
    const arma = atacante.equipamento && atacante.equipamento.arma;
    // O elemento vem do COMBATENTE, não da arma: com a arma untada o golpe é
    // do óleo, e a marca elemental tem de acompanhar — era esse o sentido de
    // "marcando o alvo para reações elementais" na descrição do item.
    const elementoAtual = atacante.elemento;
    if (!elementoAtual || elementoAtual === "fisico") return;
    // Ressonância já aplica todo golpe em aplicarEfeitosPosDano — sem esta
    // guarda, a arma lendária rolaria a chance duas vezes.
    const temRessonancia = !!arma && Array.isArray(arma.efeitos) && arma.efeitos.includes("ressonancia");
    if (temRessonancia) return;
    if (Math.random() >= CHANCE_ESTADO_POR_ARMA) return;
    const estado = this.estadoDoElemento(elementoAtual);
    if (estado) this.aplicarEstadoDeHabilidade({ aplicaEstado: estado }, alvo);
  }

  // Consequências de efeito de item DEPOIS de o dano sair (ver
  // ItemEffectSystem.js). Concentradas aqui, num lugar só, porque cura e
  // repetição de golpe são operações da Batalha — deixar cada efeito
  // aplicá-las por conta própria criaria um segundo caminho de dano.
  aplicarEfeitosPosDano(atacante, alvo, dano, contexto = {}) {
    // BUG (auditoria): a passiva `roubo_vida` existia no PassiveSystem, era
    // somada no modificador do combatente e NUNCA era lida pelo combate — só
    // o efeito de item lendário de mesmo nome funcionava. Entra aqui, no
    // mesmo ponto e com o mesmo formato do efeito de item, para não haver
    // dois caminhos de cura-por-dano que possam discordar.
    const passivaDoAtacante = modificadorDe(this.passivas, atacante);
    if (passivaDoAtacante.roubo_vida > 0 && atacante.vivo && dano > 0) {
      const cura = Math.max(1, Math.round(dano * passivaDoAtacante.roubo_vida));
      const antes = atacante.hp;
      atacante.hp = Math.min(atacante.hpMax, atacante.hp + cura);
      if (atacante.hp - antes > 0) {
        this.registrar(`🩸 ${atacante.nome} drena ${atacante.hp - antes} de vida.`);
        anunciar(EVENTO.DRENO, { atacante, alvo, cura: atacante.hp - antes });
      }
    }
    const consequencias = efeitosAoCausarDano(atacante, alvo, dano, contexto);
    for (const c of consequencias) {
      if (c.tipo === "curar_atacante") {
        const antes = atacante.hp;
        atacante.hp = Math.min(atacante.hpMax, atacante.hp + c.valor);
        const curou = atacante.hp - antes;
        if (curou > 0) {
          this.registrar(`${c.efeito.def.icone} ${atacante.nome} drena ${curou} de vida.`);
          anunciar(EVENTO.DRENO, { atacante, alvo, cura: curou });
        }
      } else if (c.tipo === "postura_extra") {
        // Reusa a mesma porta de sempre: acumularQuebra continua sendo o
        // único lugar que enche postura, e o efeito só empurra mais vezes.
        const voltas = Math.max(1, Math.round(c.mult) - 1);
        for (let i = 0; i < voltas; i += 1) this.acumularQuebra(atacante, alvo, "neutro");
      } else if (c.tipo === "aplicar_estado") {
        // RESSONÂNCIA: a arma marca o alvo com o estado do próprio elemento.
        // É o que ACENDE o sistema de reações elementais — ele existia
        // inteiro (8 reações prontas em elementalReactions.json) e ficava
        // inerte porque nada no jogo aplicava estado nenhum.
        this.aplicarEstadoDeHabilidade({ aplicaEstado: this.estadoDoElemento(c.elemento) }, alvo);
      } else if (c.tipo === "repetir_golpe") {
        // `semEco: true` na repetição — sem isso o eco ecoaria sozinho para
        // sempre e um golpe poderia não terminar nunca.
        if (!alvo.vivo) continue;
        this.registrar(`${c.efeito.def.icone} O golpe ecoa!`);
        anunciar(EVENTO.ECO, { atacante, alvo });
        // O ECO NÃO PODE ROUBAR A ROLAGEM DO GOLPE ORIGINAL.
        //
        // `rolarAtaque` grava `ultimaRolagem`/`ultimosSelos`, e a tela lê os
        // dois DEPOIS que a ação inteira termina — inclusive este eco, que
        // roda por último. Sem o resguardo abaixo, a batalha animava o d20 do
        // eco, herdava dele o crítico e a cor elemental e, quando o eco
        // errava, escrevia "ESQUIVOU!" em cima de um alvo que tinha acabado
        // de levar o dano cheio do primeiro golpe. Parecia bug porque era.
        const rolagemOriginal = this.ultimaRolagem;
        const selosOriginais = this.ultimosSelos;
        const seqOriginal = this.rolagemSeq;
        const eco = this.rolarAtaque(atacante, alvo, { multiplicador: c.mult });
        if (eco.acertou) this.aplicarDano(alvo, eco.dano);
        this.ultimaRolagem = rolagemOriginal;
        this.ultimosSelos = selosOriginais;
        this.rolagemSeq = seqOriginal;
      }
    }
  }

  ataqueBasico(atacante, alvo) {
    const r = this.rolarAtaque(atacante, alvo);
    if (r.acertou) {
      this.aplicarDano(alvo, r.dano);
      this.jaHouveGolpe = true;
      this.marcarEstadoPorArma(atacante, alvo);
      this.aplicarEfeitosPosDano(atacante, alvo, r.dano, { semEco: false });
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
          // Identidade do herói (essência/Justiça). O ramo mágico não tinha
          // selos; ganha os da identidade, gravados no mesmo `seq` da rolagem
          // para a tela colar no número como faz com o golpe físico.
          const identidadeMagica = multiplicadorIdentidade(atacante, alvoOuAlvos, elemAtqMagico, this.dadosElementos);
          dano *= identidadeMagica.mult;
          this.ultimosSelos = {
            seq: this.rolagemSeq,
            selos: identidadeMagica.selos.map(([texto, tom, mult]) => {
              const pct = Math.round((mult - 1) * 100);
              return { texto, tom, pct, rotulo: `${texto} ${pct > 0 ? "+" : ""}${pct}%` };
            }),
          };
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
        // A cura escalava só com INT. Isso funcionava enquanto só o Clérigo e
        // o Mago curavam; com "Segundo Fôlego" (Bárbaro) e "Ervas de Cura"
        // (Patrulheiro) na árvore, um Bárbaro de INT 3 curaria 5 de HP no
        // nível 20. Passa a escalar pelo MAIOR entre INT e CON — quem cura
        // por fé usa INT, quem cura por teimosia usa CON, e nenhuma classe
        // fica com uma habilidade decorativa.
        const atributoCura = Math.max(atacante.atributos.INT || 0, atacante.atributos.CON || 0);
        let cura = Math.round(atributoCura * habilidade.multiplicador * (0.9 + Math.random() * 0.2));
        cura = Math.round(cura * bonusDeMarcas(atacante, null, this.ctxMarcas(atacante)).cura);
        cura = Math.round(cura * modificadorDe(this.passivas, atacante).cura_recebida);
        if (FLAGS.reacoesElementais) cura = Math.round(cura * modificadorCuraRecebidaEstado(atacante));
        cura = Math.round(cura * multCuraRecebida(atacante)); // motivação Redenção
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
      // --- ÁREA E TIME (adicionados para as habilidades do gacha) ---------
      //
      // O motor só sabia acertar UM alvo. Habilidade de área e buff de time
      // eram impossíveis de declarar — e sem elas o convocado não tinha como
      // ter identidade tática, só um golpe um pouco mais forte.
      //
      // Reusam as mesmas portas de sempre: `rolarAtaque` por alvo (mesma
      // régua de d20, crítico, elemento e reação) e `statusEffects` para o
      // buff. Nada aqui é um caminho paralelo de dano.
      case "dano_area": {
        const alvos = this.inimigosVivos();
        if (!alvos.length) break;
        this.registrar(`${atacante.nome} usa ${habilidade.nome} contra ${alvos.length} inimigo(s)!`);
        let totalCausado = 0;
        for (const alvo of alvos) {
          const r = this.rolarAtaque(atacante, alvo, {
            multiplicador: habilidade.multiplicador,
            elementoAtacante: habilidade.elemento,
            respeitaFormacao: false,
          });
          if (!r.acertou) { this.registrar(`   ${alvo.nome} escapa.`); continue; }
          this.aplicarDano(alvo, r.dano);
          this.acumularQuebra(atacante, alvo, r.relacaoElemental);
          this.aplicarEstadoDeHabilidade(habilidade, alvo);
          totalCausado += r.dano;
          this.registrar(`   ${alvo.nome} sofre ${r.dano}${r.critico ? " (CRÍTICO!)" : ""}.`);
          eventos.push({ tipo: "dano", alvo: alvo.id, valor: r.dano, critico: r.critico });
        }
        this.registrar(`   Total: ${totalCausado} de dano em área.`);
        break;
      }
      case "cura_area": {
        const aliados = this.timeVivo();
        let total = 0;
        for (const a of aliados) {
          let cura = Math.round(Math.max(atacante.atributos.INT || 0, atacante.atributos.CON || 0) * habilidade.multiplicador * (0.9 + Math.random() * 0.2));
          // Marca de quem CURA (Fé, Louvor, Elo) e passiva de quem RECEBE
          // (Mãos Cálidas) — as duas pontas, cada uma uma vez.
          cura = Math.round(cura * bonusDeMarcas(atacante, null, this.ctxMarcas(atacante)).cura);
          cura = Math.round(cura * modificadorDe(this.passivas, a).cura_recebida);
          if (FLAGS.reacoesElementais) cura = Math.round(cura * modificadorCuraRecebidaEstado(a));
          cura = Math.round(cura * multCuraRecebida(a)); // motivação Redenção de quem recebe
          const antes = a.hp;
          a.hp = Math.min(a.hpMax, a.hp + cura);
          total += a.hp - antes;
          eventos.push({ tipo: "cura", alvo: a.id, valor: a.hp - antes });
        }
        this.registrar(`${atacante.nome} usa ${habilidade.nome} e restaura ${total} de vida no time.`);
        break;
      }
      case "buff_time": {
        // Um buff para o grupo inteiro. `alvoBuff` diz o que reforçar:
        // "defesa" (reduz dano recebido) ou "ataque" (amplia o próximo golpe).
        const aliados = this.timeVivo();
        const tipoBuff = habilidade.alvoBuff === "ataque" ? "buff_ataque_proximo" : "buff_defesa";
        for (const a of aliados) {
          a.statusEffects.push({
            tipo: tipoBuff,
            duracao: (habilidade.duracao || 2) + 1,
            valor: habilidade.valor,
            nome: habilidade.nome,
            icone: habilidade.icone || "🛡️",
          });
        }
        this.registrar(`${atacante.nome} usa ${habilidade.nome}: o time inteiro fica reforçado por ${habilidade.duracao || 2} turnos!`);
        break;
      }
      case "debuff_area": {
        const alvos = this.inimigosVivos();
        for (const alvo of alvos) {
          alvo.statusEffects.push({ tipo: "debuff_velocidade", duracao: (habilidade.duracao || 2) + 1, valor: habilidade.valor });
        }
        this.registrar(`${atacante.nome} usa ${habilidade.nome}: ${alvos.length} inimigo(s) ficam mais lentos!`);
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

  // SOPRO ELEMENTAL do Draconato. Até aqui era dano neutro — o nome dizia
  // "elemental" e o golpe ignorava o elemento. Agora sopra o elemento que o
  // herói escolheu na criação (fogo para quem não tem nenhum): passa pela
  // matriz elemental, terreno, clima e essência, enche a postura do chefe
  // conforme a relação e tem chance de deixar o estado do elemento. A
  // combinação Draconato + Fogo ("Sopro Incendiário") incendeia sempre.
  elementoDoSopro(atacante) {
    return atacante.elementoAfinidade || "fogo";
  }

  // Fórmula única do sopro, usada pelo golpe de verdade e pela prévia do card.
  // `variancia` é o multiplicador de 0.85..1.15 (a prévia passa os extremos).
  danoDoSopro(atacante, alvo, variancia) {
    const elemento = this.elementoDoSopro(atacante);
    let relacao = "neutro";
    let dano = (atacante.atributos.INT || 0) * 1.6 * variancia;
    if (FLAGS.elementos && this.dadosElementos) {
      relacao = relacaoElemental(elemento, alvo.elemento || "fisico", this.dadosElementos);
      dano *= multiplicadorElemental(elemento, alvo.elemento || "fisico", this.dadosElementos);
    }
    if (relacao === "imune") return { dano: 0, relacao, elemento };
    dano *= this.multiplicadorTerreno(elemento, alvo) * this.multiplicadorClima(elemento, alvo);
    dano *= multiplicadorIdentidade(atacante, alvo, elemento, this.dadosElementos).mult;
    dano = Math.max(1, Math.round(dano - this.defesaEfetiva(alvo) * 0.3));
    if (alvo.chefe && alvo.atordoado) dano = Math.round(dano * BONUS_DANO_ATORDOADO);
    return { dano, relacao, elemento };
  }

  estimarSopro(atacante, alvo) {
    const min = this.danoDoSopro(atacante, alvo, 0.85);
    const max = this.danoDoSopro(atacante, alvo, 1.15);
    const esperado = this.danoDoSopro(atacante, alvo, 1);
    return { min: min.dano, max: max.dano, esperado: esperado.dano, relacaoElemental: esperado.relacao, elemento: esperado.elemento };
  }

  usarSoproElemental(atacante) {
    if (atacante.sopro_usado || atacante.racaId !== "draconato") return { ok: false };
    atacante.sopro_usado = true;
    let total = 0;
    const elemento = this.elementoDoSopro(atacante);
    const estado = this.estadoDoElemento(elemento);
    for (const inimigo of this.inimigosVivos()) {
      const r = this.danoDoSopro(atacante, inimigo, 0.85 + Math.random() * 0.3);
      this.aplicarDano(inimigo, r.dano);
      this.acumularQuebra(atacante, inimigo, r.relacao);
      total += r.dano;
      const incendeia = atacante.soproIncendiario && elemento === "fogo";
      if (estado && inimigo.vivo && r.relacao !== "imune" && (incendeia || Math.random() < CHANCE_ESTADO_SOPRO)) {
        this.aplicarEstadoDeHabilidade({ aplicaEstado: estado }, inimigo);
      }
    }
    const nomeElemento = (this.dadosElementos && (this.dadosElementos.elementos || []).find((e) => e.id === elemento)) || null;
    this.registrar(`${atacante.nome} solta um Sopro de ${nomeElemento ? nomeElemento.nome : elemento}, causando dano em todos os inimigos!`);
    atacante.primeiroTurno = false;
    atacante.atb = 0;
    return { ok: true, totalDano: total, elemento };
  }

  fugir(iniciador) {
    // Motivação Liberdade: +15% de chance de fugir.
    const chance = 0.5 + iniciador.velocidade * 0.02 + bonusChanceFuga(iniciador);
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
  // O combatente perdeu a ação. Anunciado para a tela poder mostrar o gelo
  // rachando em cima do sprite — antes o turno era simplesmente pulado e a
  // única pista era uma linha no log.
  anunciarTurnoPerdido(c, ativo) {
    const def = ativo && ativo.def;
    anunciar(EVENTO.TURNO_PERDIDO, {
      combatente: c,
      icone: (def && def.icone) || "❄️",
      nome: (def && def.nome) || "Controlado",
    });
  }

  jogadorControladoPorEstado(c) {
    return !!(FLAGS.reacoesElementais && c && c.vivo && estaControladoPorEstado(c));
  }

  perderTurnoJogadorPorEstado(c) {
    const ativo = estadoElementalAtivo(c);
    this.registrar(`${(ativo && ativo.def && ativo.def.icone) || "❄️"} ${c.nome} está ${(ativo && ativo.def && ativo.def.nome) || "controlado"} e perde o turno!`);
    this.anunciarTurnoPerdido(c, ativo);
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
    // HABILIDADE ASSINADA DE CHEFE. Vem ANTES da ação de arquétipo comum: a
    // partir da fase 2 é ela que dá cara à luta. Tem recarga própria, então
    // não vira o ataque padrão — o chefe alterna entre ela e o resto.
    if (podeUsarHabilidade(inimigo)) {
      const hab = habilidadeDoChefe(inimigo);
      const plano = this.planoDaHabilidadeDeChefe(inimigo, hab);
      if (plano) return plano;
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
    // Recarga da assinatura do chefe anda a cada turno DELE, não a cada turno
    // do jogo — senão um chefe lento teria a habilidade pronta muito mais
    // vezes que um rápido, ao contrário do que a velocidade deveria dizer.
    passarTurnoDoChefe(inimigo);
    switch (plano.tipo) {
      case "habilidade_chefe":
        this.usarHabilidadeDeChefe(inimigo, plano);
        inimigo.primeiroTurno = false;
        inimigo.atb = 0;
        return;
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
        this.anunciarTurnoPerdido(inimigo, ativo);
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

  // Traduz a habilidade declarada em BossPhaseSystem num plano que
  // executarAcao entende. Devolve null quando não há alvo válido — e aí o
  // chefe cai no comportamento normal em vez de perder o turno.
  planoDaHabilidadeDeChefe(inimigo, hab) {
    if (!hab || !hab.efeito) return null;
    const vivosTime = this.timeVivo();
    if (!vivosTime.length) return null;
    const e = hab.efeito;
    if (e.tipo === "cura") return { tipo: "habilidade_chefe", hab, alvo: inimigo };
    if (e.tipo === "guarda") return { tipo: "habilidade_chefe", hab, alvo: inimigo };
    if (e.tipo === "area") return { tipo: "habilidade_chefe", hab, alvo: null };
    if (e.alvo === "mais_ferido") {
      const alvo = vivosTime.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      return alvo ? { tipo: "habilidade_chefe", hab, alvo } : null;
    }
    const alvo = this.escolherAlvoIA(inimigo) || vivosTime[0];
    return alvo ? { tipo: "habilidade_chefe", hab, alvo } : null;
  }

  // Executa a assinatura. O dano reusa rolarAtaque (mesma régua de d20,
  // crítico e elemento do resto do jogo) e só multiplica no fim — assim a
  // habilidade de chefe não vira um caminho paralelo com regras próprias.
  usarHabilidadeDeChefe(inimigo, plano) {
    const hab = plano.hab;
    const e = hab.efeito;
    this.registrar(`${hab.icone} ${inimigo.nome} usa ${hab.nome}!`);
    marcarHabilidadeUsada(inimigo);

    if (e.tipo === "cura") {
      const cura = Math.max(1, Math.round(inimigo.hpMax * e.mult));
      inimigo.hp = Math.min(inimigo.hpMax, inimigo.hp + cura);
      this.registrar(`   ${inimigo.nome} recupera ${cura} de vida.`);
      return;
    }
    if (e.tipo === "guarda") {
      inimigo.defendendo = true;
      // BUG (auditoria de combate): isto gravava `turnos: 2`, mas o relógio de
      // status (`aplicarStatusTick`) desconta de `duracao`. Resultado: a guarda
      // do chefe — que corta metade do dano recebido — NUNCA expirava, e valia
      // a luta inteira a partir do primeiro uso. `+1` porque o tick já desconta
      // no mesmo turno em que o efeito entra, igual a todos os outros.
      inimigo.statusEffects.push({ tipo: "buff_defesa", valor: e.reducao, duracao: 3, nome: hab.nome, icone: hab.icone });
      this.registrar(`   ${inimigo.nome} ergue a guarda.`);
      return;
    }
    const alvos = e.tipo === "area" ? this.timeVivo() : [plano.alvo].filter(Boolean);
    for (const alvo of alvos) {
      const r = this.rolarAtaque(inimigo, alvo);
      if (!r.acertou) { this.registrar(`   ${hab.nome} errou ${alvo.nome}.`); continue; }
      let dano = Math.round(r.dano * (e.mult || 1));
      // Perfurante ignora parte da defesa: devolve o pedaço que a defesa
      // tinha tirado, na mesma proporção declarada.
      if (e.ignoraDefesa) dano = Math.round(dano + (alvo.defesa || 0) * e.ignoraDefesa);
      dano = Math.max(1, dano);
      this.aplicarDano(alvo, dano);
      this.registrar(`   ${alvo.nome} sofre ${dano} de dano.`);
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
    } else {
      // Sem esta linha o turno do Conjurador some do log quando ele erra: o
      // jogador via o inimigo "pular a vez" sem entender o porquê.
      this.registrar(`${atacante.nome} conjura uma magia em ${alvo.nome}, mas o feitiço se perde!`);
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
