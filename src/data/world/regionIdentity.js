// IDENTIDADE DAS MACRO-REGIÕES (ETAPA 2, item 3 e 24 do pedido).
//
// "Cada macro-região precisa ser reconhecível sem precisar ler seu nome."
//
// Este arquivo é o que traduz essa frase em tiles. Cada região declara de que
// é feita — chão, vegetação, relevo, água, arquitetura, materiais, clima — e o
// gerador (WorldBuilder.js) pinta o território a partir daqui. Trocar duas
// linhas de uma região muda a cara dela no mapa inteiro, sem tocar em código.
//
// Duas regras que este arquivo segue e não pode deixar de seguir:
//
// 1. NADA DE CÂNONE INVENTADO. As regiões são as 17 do atlas do mapa-múndi
//    (src/data/atlasRegions.js) — mesmos ids, mesmos nomes. O que se acrescenta
//    aqui é COMO ELAS SE PARECEM, que é informação de terreno, não de lore.
//    As descrições do atlas foram a fonte: "cadeia de montanhas glaciais",
//    "lava cristaliza em metal vivo", "plantas crescem sobre armaduras em
//    horas" — cada paleta abaixo tenta ser a leitura fiel de uma dessas frases.
//
// 2. NENHUMA REGIÃO É OUTRA COM PALETA DIFERENTE (item 33). Duas regiões de
//    floresta existem — Altaverde e o Bosque Eterno — e elas se distinguem por
//    ESTRUTURA, não por cor: Altaverde é campo aberto cortado por rio, com
//    lavoura perto das cidades; o Bosque Eterno é mata fechada sem estrada
//    principal, em que a densidade de árvore é o próprio obstáculo.
import { TILE } from "../worldMap.js";

// `chao` é o tile-base; `mistura` são pares [tile, densidade] pintados por
// cima, na ordem. `relevo` é o que forma barreira (montanha, ruína, cristal);
// `agua` é o que os rios e lagos daquela região usam — é o que faz o mesmo rio
// virar água corrente em Altaverde e lago congelado em Morranvell.
//
// `arquitetura` descreve de que os assentamentos são feitos ali: em Morranvell
// um vilarejo é pedra escura sobre neve; em Arenth é barro claro sobre areia.
// `densidadeRelevo` é quanto da região é barreira — 0.30 em cordilheira é o
// que faz montanha ser montanha e não decoração.
export const IDENTIDADE_REGIAO = {
  // --- ALTAVERDE: florestas, rios, raízes, campos, bosques -----------------
  altaverde: {
    chao: TILE.GRASS,
    mistura: [[TILE.GRASS_DETAIL, 0.14], [TILE.TREE, 0.10], [TILE.BUSH, 0.05]],
    relevo: TILE.WALL, densidadeRelevo: 0.03,
    agua: TILE.WATER,
    vegetacao: "bosque claro e campo aberto, raízes aflorando nas margens",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.FARM },
    materiais: ["erva", "madeira"],
    clima: "temperado",
    cores: { chao: "#4a7c3f", detalhe: "#6ea355", agua: "#3f6fa5" },
    // Item 23: perto de civilização há lavoura; Altaverde é a região que mais
    // recebe esse tratamento porque é onde o jogo começa.
    lavouraPertoDeCidade: true,
  },

  // --- MORRANVELL: neve, vales, lagos congelados, fortalezas, minas --------
  morranvell: {
    chao: TILE.SNOW,
    mistura: [[TILE.WALL, 0.10], [TILE.TREE, 0.05]],
    relevo: TILE.WALL, densidadeRelevo: 0.18,
    agua: TILE.ICE,
    vegetacao: "pinheiro raro e rocha nua sob a neve",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.SNOW },
    materiais: ["minerio"],
    clima: "nevado",
    cores: { chao: "#e7edf6", detalhe: "#b9c7da", agua: "#9ec8de" },
  },

  // --- VULKOR: vulcões, lava, cinzas, cânions, forjas ----------------------
  montanhas_de_vulkor: {
    chao: TILE.ASH,
    mistura: [[TILE.WALL, 0.14], [TILE.LAVA, 0.05]],
    relevo: TILE.WALL, densidadeRelevo: 0.24,
    agua: TILE.LAVA,
    vegetacao: "nenhuma — o que cresce aqui é metal",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.ASH },
    materiais: ["minerio"],
    clima: "vulcanico",
    cores: { chao: "#5c5552", detalhe: "#3a3433", agua: "#e8761e" },
  },

  // --- CÂNON RUBRO: cânions vulcânicos, minas, forjas ----------------------
  canon_rubro: {
    chao: TILE.ASH,
    mistura: [[TILE.SAND, 0.10], [TILE.WALL, 0.10], [TILE.LAVA, 0.03]],
    relevo: TILE.WALL, densidadeRelevo: 0.20,
    agua: TILE.LAVA,
    vegetacao: "arbusto queimado nas bordas do cânion",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.ASH },
    materiais: ["minerio"],
    clima: "vulcanico",
    cores: { chao: "#6b5148", detalhe: "#8a5a3a", agua: "#e8761e" },
  },

  // --- ARENTH: dunas, oásis, ruínas enterradas, rotas comerciais -----------
  deserto_de_arenth: {
    chao: TILE.SAND,
    mistura: [[TILE.WALL, 0.05], [TILE.TALL_GRASS, 0.02]],
    relevo: TILE.WALL, densidadeRelevo: 0.06,
    agua: TILE.WATER,
    vegetacao: "tufo seco e palmeira só à beira de água",
    arquitetura: { piso: TILE.VILLAGE_FLOOR, parede: TILE.BUILDING, entorno: TILE.SAND },
    materiais: ["minerio", "erva"],
    clima: "arido",
    cores: { chao: "#d9c185", detalhe: "#c2a765", agua: "#3f8fa5" },
    // Rota comercial: Arenth é a região em que a estrada principal importa
    // mais que a paisagem — item 24.
    estradaMarcante: true,
  },

  // --- THALGOR: pântanos, canais, vilas elevadas, ruínas inundadas ---------
  pantano_de_thalgor: {
    chao: TILE.MARSH,
    mistura: [[TILE.WATER, 0.16], [TILE.TALL_GRASS, 0.12], [TILE.BUSH, 0.06]],
    relevo: TILE.TREE, densidadeRelevo: 0.05,
    agua: TILE.WATER,
    vegetacao: "juncal, raiz suspensa e fungo do tamanho de um escudo",
    arquitetura: { piso: TILE.BRIDGE, parede: TILE.BUILDING, entorno: TILE.MARSH },
    materiais: ["erva"],
    clima: "umido",
    cores: { chao: "#4a5334", detalhe: "#6b7442", agua: "#3d5847" },
    // As vilas de Thalgor são ELEVADAS: o piso delas é passarela sobre a água,
    // e não calçada — é o que o atlas descreve e o que as diferencia à vista.
    vilaElevada: true,
  },

  // --- MARIS / COSTA DA MARÉ: portos, falésias, arquipélagos, recifes ------
  costa_da_mare: {
    // FALÉSIA, não praia: pouca água em cima da terra, muita rocha e capim
    // de duna. É o que separa a Costa da Maré do Recife Coralino, que era a
    // outra região de areia e água — sem isso as duas ficavam sendo a mesma
    // paisagem com outro nome, exatamente o que o item 33 proíbe.
    chao: TILE.SAND,
    mistura: [[TILE.WATER, 0.11], [TILE.GRASS_DETAIL, 0.13], [TILE.WALL, 0.11]],
    relevo: TILE.WALL, densidadeRelevo: 0.12,
    agua: TILE.WATER,
    vegetacao: "capim de duna e mato rasteiro sobre a falésia",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.SAND },
    materiais: ["minerio", "erva"],
    clima: "costeiro",
    cores: { chao: "#d8c79b", detalhe: "#a8a06e", agua: "#2f6f9e" },
    porto: true,
  },

  // --- RECIFE CORALINO: reino parcialmente submerso ------------------------
  recife_coralino: {
    // SUBMERSO: muita água rasa e coral exposto na maré baixa. O coral usa o
    // tile de osso — os dois são calcário claro, e é o que dá ao recife uma
    // cor que não existe em nenhuma outra região.
    chao: TILE.SAND,
    mistura: [[TILE.WATER, 0.32], [TILE.BONE, 0.14], [TILE.DEEP_WATER, 0.04]],
    relevo: TILE.WALL, densidadeRelevo: 0.07,
    agua: TILE.WATER,
    vegetacao: "coral fora d'água na maré baixa",
    arquitetura: { piso: TILE.BRIDGE, parede: TILE.BUILDING, entorno: TILE.SAND },
    materiais: ["minerio"],
    clima: "costeiro",
    cores: { chao: "#d6c9a4", detalhe: "#7fb0a6", agua: "#2c7fa8" },
    porto: true,
  },

  // --- VALE DOS TITÃS: escalas monumentais, ossos, ruínas gigantes ---------
  vale_dos_titas: {
    chao: TILE.BONE,
    mistura: [[TILE.GRASS, 0.16], [TILE.WALL, 0.10], [TILE.SAND, 0.06]],
    relevo: TILE.WALL, densidadeRelevo: 0.14,
    agua: TILE.WATER,
    vegetacao: "grama curta entre costelas do tamanho de torres",
    arquitetura: { piso: TILE.VILLAGE_FLOOR, parede: TILE.BUILDING, entorno: TILE.BONE },
    materiais: ["minerio", "madeira"],
    clima: "temperado",
    cores: { chao: "#c9bfa0", detalhe: "#8f8567", agua: "#3f6fa5" },
  },

  // --- SOMBRALITH: Véu, terreno fragmentado, névoa, anomalias --------------
  sombralith: {
    chao: TILE.GRASS_DETAIL,
    mistura: [[TILE.CRYSTAL, 0.06], [TILE.WALL, 0.10], [TILE.BUSH, 0.08], [TILE.VILLAGE_FLOOR, 0.05]],
    relevo: TILE.CRYSTAL, densidadeRelevo: 0.12,
    agua: TILE.WATER,
    vegetacao: "mato morto e cidade que só existe de longe",
    arquitetura: { piso: TILE.VILLAGE_FLOOR, parede: TILE.BUILDING, entorno: TILE.GRASS_DETAIL },
    materiais: ["erva"],
    clima: "sombrio",
    cores: { chao: "#3f4234", detalhe: "#5b4f6b", agua: "#2b3a4a" },
    // Terreno fragmentado: a região é rasgada por vãos, o que a torna a mais
    // difícil de atravessar em linha reta.
    fragmentado: true,
  },

  // --- NUVEA / ARQUIPÉLAGO DE NUVENS: verticalidade, pontes, ventos --------
  arquipelago_de_nuvens: {
    // "Ilhas flutuantes sustentadas por CRISTAIS DE VENTO", diz o atlas — e
    // é o cristal que distingue Nuvea do Vale do Vento, a outra região de
    // planície ventosa. Sem ele as duas eram capim com pedra.
    chao: TILE.GRASS,
    mistura: [[TILE.DEEP_WATER, 0.20], [TILE.CRYSTAL, 0.13], [TILE.GRASS_DETAIL, 0.08]],
    relevo: TILE.CRYSTAL, densidadeRelevo: 0.10,
    agua: TILE.DEEP_WATER,
    vegetacao: "jardim suspenso e capim de altitude",
    arquitetura: { piso: TILE.BRIDGE, parede: TILE.BUILDING, entorno: TILE.GRASS },
    materiais: ["erva", "minerio"],
    clima: "ventoso",
    cores: { chao: "#6f9a63", detalhe: "#9db9c9", agua: "#1b2f52" },
    // O vazio entre as ilhas é intransponível: aqui a PONTE não é conforto, é
    // a única forma de existir caminho.
    ilhas: true,
  },

  // --- AERWIND / VALE DO VENTO: planícies, cânions, rotas abertas ----------
  vale_do_vento: {
    chao: TILE.GRASS,
    mistura: [[TILE.GRASS_DETAIL, 0.18], [TILE.WALL, 0.06], [TILE.TREE, 0.02]],
    relevo: TILE.WALL, densidadeRelevo: 0.08,
    agua: TILE.WATER,
    vegetacao: "capim alto deitado pelo vento, quase nenhuma árvore",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.GRASS },
    materiais: ["erva", "madeira"],
    clima: "ventoso",
    cores: { chao: "#7ba055", detalhe: "#a3bb6b", agua: "#3f6fa5" },
    estradaMarcante: true,
  },

  // --- RUÍNAS DE AETHRA: memória, Éter, arquitetura quebrada --------------
  ruinas_de_aethra: {
    chao: TILE.VILLAGE_FLOOR,
    mistura: [[TILE.GRASS, 0.18], [TILE.WALL, 0.12], [TILE.CRYSTAL, 0.05], [TILE.BUSH, 0.08]],
    relevo: TILE.WALL, densidadeRelevo: 0.14,
    agua: TILE.WATER,
    vegetacao: "vegetação tomando praça, coluna e escadaria",
    arquitetura: { piso: TILE.COBBLE, parede: TILE.BUILDING, entorno: TILE.VILLAGE_FLOOR },
    materiais: ["minerio", "erva"],
    clima: "arcano",
    cores: { chao: "#8a8272", detalhe: "#6d6f8a", agua: "#3f6fa5" },
    instavel: true,
  },

  // --- BOSQUE ETERNO / VERDANTIS: floresta primordial ---------------------
  bosque_eterno: {
    chao: TILE.TALL_GRASS,
    mistura: [[TILE.TREE, 0.30], [TILE.BUSH, 0.12], [TILE.GRASS_DETAIL, 0.06]],
    relevo: TILE.TREE, densidadeRelevo: 0.10,
    agua: TILE.WATER,
    vegetacao: "mata fechada — a própria densidade é a barreira",
    arquitetura: { piso: TILE.VILLAGE_FLOOR, parede: TILE.BUILDING, entorno: TILE.TALL_GRASS },
    materiais: ["madeira", "erva"],
    clima: "umido",
    cores: { chao: "#2f5a33", detalhe: "#1f4426", agua: "#2f5f6f" },
    // Sem estrada principal: no Bosque Eterno se anda por trilha. É o
    // contraste deliberado com Altaverde, a outra região de floresta.
    semEstradaPrincipal: true,
  },

  // --- SELVA UMBRÍACA: selva densa onde o Véu toca o mundo ----------------
  selva_umbriaca: {
    chao: TILE.TALL_GRASS,
    mistura: [[TILE.TREE, 0.24], [TILE.BUSH, 0.14], [TILE.MARSH, 0.06]],
    relevo: TILE.TREE, densidadeRelevo: 0.08,
    agua: TILE.WATER,
    vegetacao: "cipó, folhagem escura e sombra que anda sozinha",
    arquitetura: { piso: TILE.VILLAGE_FLOOR, parede: TILE.BUILDING, entorno: TILE.TALL_GRASS },
    materiais: ["madeira", "erva"],
    clima: "umido",
    cores: { chao: "#28402a", detalhe: "#3d2f4a", agua: "#2f4f4a" },
  },

  // --- LAGO PRISMÁTICO: onde seis correntes elementais se encontram -------
  // Até a ETAPA 1 esta região existia só como lore, sem uma única zona
  // jogável. Ganhou território aqui porque é o CENTRO geográfico do mapa do
  // Manual — deixar um buraco bem no meio do continente era o que obrigava o
  // jogador a contornar o mundo inteiro.
  lago_prismatico: {
    // Chão de AREIA com muita água por cima, e não água pura: uma região
    // inteira de água seria um buraco no meio do continente, e o Lago
    // Prismático é margem tanto quanto lago.
    chao: TILE.SAND,
    mistura: [[TILE.GRASS, 0.12], [TILE.WATER, 0.30], [TILE.CRYSTAL, 0.04]],
    relevo: TILE.CRYSTAL, densidadeRelevo: 0.05,
    agua: TILE.WATER,
    vegetacao: "junco e cristal crescendo na margem",
    arquitetura: { piso: TILE.BRIDGE, parede: TILE.BUILDING, entorno: TILE.SAND },
    materiais: ["erva", "minerio"],
    clima: "temperado",
    cores: { chao: "#3f88a8", detalhe: "#a8c9d6", agua: "#2f7fa8" },
  },

  // --- ABISMO DE NAZ'THAL: vórtice oceânico, dobra do Véu -----------------
  abismo_de_nazthal: {
    chao: TILE.DEEP_WATER,
    mistura: [[TILE.WATER, 0.20], [TILE.CRYSTAL, 0.06], [TILE.WALL, 0.05]],
    // Relevo de ROCHA, não de cristal: com cristal, a cordilheira dos Confins
    // pintava um quinto do continente de roxo e o fim do mundo virava um
    // adesivo em vez de um lugar.
    relevo: TILE.WALL, densidadeRelevo: 0.08,
    agua: TILE.DEEP_WATER,
    vegetacao: "nada boia aqui por muito tempo",
    arquitetura: { piso: TILE.BRIDGE, parede: TILE.BUILDING, entorno: TILE.DEEP_WATER },
    materiais: ["minerio"],
    clima: "sombrio",
    cores: { chao: "#132339", detalhe: "#2b4a6b", agua: "#0d1a2b" },
    ilhas: true,
  },
};

// Identidade usada por qualquer região que ainda não tenha uma escrita acima
// (uma região derivada da ETAPA 1, por exemplo). Deliberadamente sem graça:
// se algo aparecer com esta cara no jogo, é sinal de que falta escrever a
// identidade daquela região, e isso tem que ficar VISÍVEL.
export const IDENTIDADE_PADRAO = {
  chao: TILE.GRASS,
  mistura: [[TILE.GRASS_DETAIL, 0.10], [TILE.TREE, 0.06]],
  relevo: TILE.WALL, densidadeRelevo: 0.05,
  agua: TILE.WATER,
  vegetacao: "campo comum",
  arquitetura: { piso: TILE.VILLAGE_FLOOR, parede: TILE.BUILDING, entorno: TILE.GRASS },
  materiais: ["erva"],
  clima: "temperado",
  cores: { chao: "#4a7c3f", detalhe: "#6ea355", agua: "#3f6fa5" },
};

export function identidadeDaRegiao(regiaoId) {
  return IDENTIDADE_REGIAO[regiaoId] || IDENTIDADE_PADRAO;
}
