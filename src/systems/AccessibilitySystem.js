// Configurações de acessibilidade (melhoria de jogabilidade pós-backlog
// original): preferências do JOGADOR, não do personagem — persistem
// separadas do save de progresso (chave própria no localStorage), então
// sobrevivem a Nova Aventura, New Game+ e até apagar o save. Cobre 4 eixos
// concretos: velocidade das mensagens na tela, tremor/flash de tela em
// combate, tamanho de fonte e alto contraste.
//
// Funções puras (mesclarConfig/multiplicadorVelocidadeMensagem/etc.) nunca
// tocam localStorage — só carregarConfigAcessibilidade/
// salvarConfigAcessibilidade fazem isso, e sempre com guarda de
// disponibilidade (localStorage pode não existir: testes Node, modo
// privado do navegador, etc.) — sem ele, a preferência ainda funciona
// dentro da sessão atual (cache em memória), só não persiste entre
// recarregamentos. Isso também é o que torna este sistema testável em Node
// sem precisar de um DOM/localStorage de mentira.

const CHAVE_LOCALSTORAGE = "rpg_pt_acessibilidade_v1";

// Multiplicador aplicado à duração padrão das mensagens (ver
// mostrarMensagem em GameUI.js) — "lenta" dá mais tempo pra ler, "rápida"
// tira as mensagens da tela mais cedo pra quem já conhece o jogo.
export const VELOCIDADES_MENSAGEM = { lenta: 1.6, normal: 1, rapida: 0.55 };
export const TAMANHOS_FONTE = ["normal", "grande", "gigante"];

// Velocidade das animações de combate (melhoria: dado rolando, golpes,
// números flutuantes etc. — ver BattleUI.js/DiceAnimation.js): multiplicador
// aplicado em cima da duração-base (~1s) de cada animação. "instantaneo" não
// remove as animações por completo (o jogador ainda vê o dado parar no
// número certo, só que quase sem demora) — evita qualquer tela "pulando"
// direto pro resultado sem nenhum feedback visual.
export const VELOCIDADES_ANIMACAO_COMBATE = { normal: 1, rapida: 0.5, instantaneo: 0.12 };

// Limiares de HP% do time abaixo dos quais o modo automático se interrompe
// sozinho (ver tickAutoPlay em main.js) — "desligado" nunca para sozinho,
// igual ao comportamento de antes desta opção existir.
export const LIMIARES_HP_AUTOPLAY = { desligado: 0, "15": 0.15, "30": 0.3, "50": 0.5 };

// Multiplicador de dificuldade aplicado a HP/ataque/defesa de TODO monstro
// criado a partir daqui (ver criarCombatenteInimigo em CombatSystem.js) —
// preferência do JOGADOR (não do personagem), pode ser trocada a qualquer
// momento sem reiniciar. "normal" (1x) é idêntico ao comportamento de antes
// desta opção existir. Independente de NG+/Modo História — os multiplicadores
// compõem entre si (ver multEstat em CombatSystem.js).
export const DIFICULDADES = { facil: 0.8, normal: 1, dificil: 1.25, brutal: 1.5 };

// Volume de efeitos sonoros (item 14/87 de 100_melhorias.md, ver
// src/ui/SoundFX.js): o jogo nunca teve áudio, então isso já nasce com um
// eixo próprio, separado de música (que ainda não existe). Novas instalações
// começam em "baixo": o jogador pediu feedback sonoro nos momentos
// importantes, mas o primeiro contato não deve ser agressivo. Preferências
// já salvas continuam sendo respeitadas, inclusive "desligado".
export const VOLUMES_EFEITOS = { desligado: 0, baixo: 0.25, medio: 0.55, alto: 0.9 };

// Velocidade do automático FORA de combate (item 21 de 100_melhorias.md) —
// multiplica o intervalo de 380ms entre passos em tickAutoPlay (main.js);
// "rapida" reduz o intervalo (anda/interage mais rápido), nunca abaixo de
// 80ms (piso de segurança pra não travar o navegador em loop apertado).
export const VELOCIDADES_AUTO_EXPLORACAO = { normal: 1, rapida: 0.5, instantaneo: 0.2 };

// Preferências dos controles de exploração em telas de toque. Elas ficam na
// configuração do dispositivo, separadas dos quatro slots de aventura: trocar
// de personagem não deve fazer o direcional pular de lado ou voltar a ficar
// opaco. Os valores são ids (não números CSS livres) para que um dado antigo
// ou corrompido sempre caia em uma combinação segura.
export const TAMANHOS_CONTROLES_TOQUE = ["compacto", "normal", "grande"];
export const OPACIDADES_CONTROLES_TOQUE = ["discreta", "normal", "alta"];
export const POSICOES_CONTROLES_TOQUE = ["direcional_esquerda", "direcional_direita"];

const PADRAO = {
  velocidadeMensagem: "normal",
  reduzirEfeitos: false,
  tamanhoFonte: "normal",
  altoContraste: false,
  velocidadeAnimacaoCombate: "normal",
  limiteHpAutoPlay: "desligado",
  dificuldade: "normal",
  volumeEfeitos: "baixo",
  velocidadeAutoExploracao: "normal",
  tamanhoControlesToque: "normal",
  opacidadeControlesToque: "normal",
  posicaoControlesToque: "direcional_esquerda",
  // Item 23 de 100_melhorias.md: false preserva o comportamento de sempre
  // (automático enfrenta o chefe sem perguntar) — só quem ligar isso aqui
  // ganha a pausa antes do chefe.
  pararAutoAntesDoChefe: false,
  // Autocuidado do automático (ver AutoCareSystem.js): usa poção quando
  // alguém do time cai abaixo de metade do HP, e só descansa quando as
  // poções acabam. Nasce LIGADA — ao contrário das opções acima, o
  // comportamento antigo (lutar até o time cair) não é algo que alguém
  // escolheria de propósito. Quem quiser o antigo desliga aqui, e a opção
  // "parar com HP baixo" volta a ser a única rede de segurança.
  autoCuidarDoTime: true,
};

let cache = null;

function localStorageDisponivel() {
  return typeof localStorage !== "undefined";
}

// Mescla um objeto parcial de configuração por cima do padrão, ignorando
// qualquer chave desconhecida e qualquer valor fora do domínio esperado
// (ex.: velocidadeMensagem: "turbo" não é uma opção válida) — nunca deixa a
// configuração final num estado inconsistente por causa de um save/valor
// corrompido ou de uma versão futura/antiga do jogo.
export function mesclarConfig(parcial) {
  const p = parcial || {};
  return {
    velocidadeMensagem: p.velocidadeMensagem in VELOCIDADES_MENSAGEM ? p.velocidadeMensagem : PADRAO.velocidadeMensagem,
    reduzirEfeitos: typeof p.reduzirEfeitos === "boolean" ? p.reduzirEfeitos : PADRAO.reduzirEfeitos,
    tamanhoFonte: TAMANHOS_FONTE.includes(p.tamanhoFonte) ? p.tamanhoFonte : PADRAO.tamanhoFonte,
    altoContraste: typeof p.altoContraste === "boolean" ? p.altoContraste : PADRAO.altoContraste,
    velocidadeAnimacaoCombate: p.velocidadeAnimacaoCombate in VELOCIDADES_ANIMACAO_COMBATE ? p.velocidadeAnimacaoCombate : PADRAO.velocidadeAnimacaoCombate,
    limiteHpAutoPlay: p.limiteHpAutoPlay in LIMIARES_HP_AUTOPLAY ? p.limiteHpAutoPlay : PADRAO.limiteHpAutoPlay,
    dificuldade: p.dificuldade in DIFICULDADES ? p.dificuldade : PADRAO.dificuldade,
    volumeEfeitos: p.volumeEfeitos in VOLUMES_EFEITOS ? p.volumeEfeitos : PADRAO.volumeEfeitos,
    velocidadeAutoExploracao: p.velocidadeAutoExploracao in VELOCIDADES_AUTO_EXPLORACAO ? p.velocidadeAutoExploracao : PADRAO.velocidadeAutoExploracao,
    tamanhoControlesToque: TAMANHOS_CONTROLES_TOQUE.includes(p.tamanhoControlesToque) ? p.tamanhoControlesToque : PADRAO.tamanhoControlesToque,
    opacidadeControlesToque: OPACIDADES_CONTROLES_TOQUE.includes(p.opacidadeControlesToque) ? p.opacidadeControlesToque : PADRAO.opacidadeControlesToque,
    posicaoControlesToque: POSICOES_CONTROLES_TOQUE.includes(p.posicaoControlesToque) ? p.posicaoControlesToque : PADRAO.posicaoControlesToque,
    pararAutoAntesDoChefe: typeof p.pararAutoAntesDoChefe === "boolean" ? p.pararAutoAntesDoChefe : PADRAO.pararAutoAntesDoChefe,
    autoCuidarDoTime: typeof p.autoCuidarDoTime === "boolean" ? p.autoCuidarDoTime : PADRAO.autoCuidarDoTime,
  };
}

export function carregarConfigAcessibilidade() {
  if (cache) return cache;
  if (localStorageDisponivel()) {
    try {
      const raw = localStorage.getItem(CHAVE_LOCALSTORAGE);
      cache = raw ? mesclarConfig(JSON.parse(raw)) : mesclarConfig(null);
    } catch (e) {
      cache = mesclarConfig(null);
    }
  } else {
    cache = mesclarConfig(null);
  }
  return cache;
}

export function salvarConfigAcessibilidade(config) {
  cache = mesclarConfig(config);
  if (localStorageDisponivel()) {
    try { localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(cache)); } catch (e) { /* modo privado, cota etc. — segue só em memória */ }
  }
  return cache;
}

export function atualizarConfigAcessibilidade(parcial) {
  return salvarConfigAcessibilidade({ ...carregarConfigAcessibilidade(), ...parcial });
}

export function multiplicadorVelocidadeMensagem() {
  return VELOCIDADES_MENSAGEM[carregarConfigAcessibilidade().velocidadeMensagem] || 1;
}

export function efeitosReduzidos() {
  return carregarConfigAcessibilidade().reduzirEfeitos;
}

// Multiplicador de duração das animações de combate (dado, golpes, etc.) —
// ver VELOCIDADES_ANIMACAO_COMBATE acima. 1 (padrão) = duração normal.
export function multiplicadorVelocidadeAnimacao() {
  return VELOCIDADES_ANIMACAO_COMBATE[carregarConfigAcessibilidade().velocidadeAnimacaoCombate] || 1;
}

// Fração de HP do time (0 a 1) abaixo da qual o modo automático se
// interrompe sozinho — 0 = nunca para sozinho (padrão, idêntico ao
// comportamento de antes desta opção existir). Ver tickAutoPlay em main.js.
export function limiteHpAutoPlay() {
  return LIMIARES_HP_AUTOPLAY[carregarConfigAcessibilidade().limiteHpAutoPlay] ?? 0;
}

// Multiplicador de dificuldade (HP/ataque/defesa de monstro) — ver
// DIFICULDADES acima. 1 (padrão "normal") = idêntico ao comportamento de
// antes desta opção existir.
export function multiplicadorDificuldade() {
  return DIFICULDADES[carregarConfigAcessibilidade().dificuldade] ?? 1;
}

// Volume de efeitos sonoros (0 a 1) — ver VOLUMES_EFEITOS acima e
// src/ui/SoundFX.js. 0 = nenhum som; o padrão de uma instalação nova é baixo.
export function volumeEfeitos() {
  return VOLUMES_EFEITOS[carregarConfigAcessibilidade().volumeEfeitos] ?? 0;
}

// Multiplicador do intervalo do automático fora de combate — ver
// VELOCIDADES_AUTO_EXPLORACAO acima. 1 (padrão) = idêntico a antes.
export function multiplicadorVelocidadeAutoExploracao() {
  return VELOCIDADES_AUTO_EXPLORACAO[carregarConfigAcessibilidade().velocidadeAutoExploracao] ?? 1;
}

// true = o automático para (e avisa) em vez de entrar sozinho na luta
// contra um chefe. false (padrão) = comportamento de sempre.
export function pararAutoAntesDoChefe() {
  return carregarConfigAcessibilidade().pararAutoAntesDoChefe;
}

// true (padrão) = o automático usa poção quando alguém do time cai abaixo
// de metade do HP e descansa só quando as poções acabam; também recusa
// encontro classificado como Mortal. Ver AutoCareSystem.js e tickAutoPlay.
export function autoCuidarDoTime() {
  return carregarConfigAcessibilidade().autoCuidarDoTime;
}

// Só pra testes: reseta o cache em memória (localStorage real não existe em
// Node, então não há nada pra limpar lá) — cada bloco de teste começa do
// zero em vez de herdar o estado de um bloco anterior.
export function _resetParaTeste() {
  cache = null;
}
