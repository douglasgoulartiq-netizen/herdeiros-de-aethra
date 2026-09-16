// ZONAS JOGÁVEIS (ETAPA 2, itens 4, 5 e 24 do pedido).
//
// Nenhuma zona se chama "Zona 1". Nenhuma é um retângulo. E nenhuma tem nome
// inventado — cada uma leva ou o nome que o projeto já usava (as 22 da ETAPA
// 1) ou o de um LUGAR LENDÁRIO que o atlas do mapa-múndi já listava para
// aquela região (`locaisLendarios` em src/data/atlasRegions.js). "Bosque das
// Vozes", "Trono Congelado", "Mina do Ferro Negro", "Oásis das Sete Sombras":
// tudo isso já estava escrito no projeto, esperando território.
//
// COMO A FORMA DEIXA DE SER QUADRADA
// ----------------------------------
// Até a ETAPA 1 cada zona era uma bounding box literal numa grade 6x4, e o
// mapa inteiro era um tabuleiro de xadrez de retângulos com um vão de 504
// tiles no canto. Aqui a zona não tem borda escrita: ela tem um CENTRO, um
// PESO e uma FORMA. O gerador (WorldBuilder.js) decide de quem é cada tile
// por proximidade perturbada por ruído — uma partição de Voronoi orgânica — e
// a `forma` distorce essa disputa: um vale se estica num eixo, um arquipélago
// se quebra em ilhas, um canyon vira uma fenda estreita. O resultado não tem
// linha reta, não tem vão e não tem dois territórios iguais.
//
// CAMPOS
//   id, nome            — identidade
//   regiaoId            — macro-região do atlas a que pertence
//   bioma               — leitura curta do terreno
//   funcao              — por que a zona existe no mundo (item 4)
//   perigo: [min, max]  — faixa de nível recomendada
//   forma               — a composição orgânica (item 5)
//   centro: { x, y }    — em tiles do mapa
//   peso                — tamanho relativo na disputa por território
//   elementoDominante   — bônus de terreno em combate (sistema já existente)
//   monstros            — pool de encontro (ids reais de monsters.json)
//   recursos            — o que se colhe aqui
//   clima               — usado pelo WeatherSystem e pela identidade visual
//   chefe               — chefe fixo da zona, quando tem
//   descricao           — a frase que o jogador lê ao entrar
// As medidas do mundo (224x176) moram em worldMap.js. Este arquivo NÃO as
// importa de propósito: worldMap importa WorldLayout, que importa este
// arquivo, e uma volta a mais fecharia o ciclo — o módulo tentaria ler
// OVERWORLD_W antes de ele existir. Os centros abaixo são coordenadas
// absolutas em tiles, e o teste de mundo confere que nenhuma cai fora.

// Formas orgânicas disponíveis (item 5). O gerador implementa cada uma; a
// zona só escolhe.
export const FORMAS = [
  "planicie", "floresta", "vale", "canyon", "cordilheira",
  "peninsula", "delta", "arquipelago", "pantano", "crateras", "urbana",
];

export const ZONAS_MUNDO = [
  // =======================================================================
  // ALTAVERDE — florestas, rios, raízes, campos, bosques. Onde o jogo começa.
  // =======================================================================
  {
    id: "vila", nome: "Vila de Aethra", regiaoId: "altaverde",
    bioma: "campo cultivado", funcao: "inicial",
    perigo: [1, 2], forma: "urbana", centro: { x: 46, y: 46 }, peso: 0.80,
    elementoDominante: null, monstros: [], recursos: ["erva"], clima: "temperado",
    descricao: "Vila natal do herói, entre a lavoura e a orla da floresta. Sem encontros aleatórios.",
  },
  {
    id: "floresta", nome: "Floresta Sussurrante", regiaoId: "altaverde",
    bioma: "bosque claro", funcao: "aprendizado",
    perigo: [1, 3], forma: "floresta", centro: { x: 68, y: 44 }, peso: 1.05,
    elementoDominante: "natureza",
    monstros: ["slime", "morcego", "lobo", "goblin", "rato_gigante", "abelha_titan"],
    recursos: ["erva", "madeira"], clima: "temperado",
    chefe: { monstroId: "guardiao_das_raizes" },
    descricao: "Bosque claro logo às portas da vila, com um pequeno lago.",
  },
  {
    id: "bosque_das_vozes", nome: "Bosque das Vozes", regiaoId: "altaverde",
    bioma: "mata de raízes antigas", funcao: "santuario",
    perigo: [3, 5], forma: "floresta", centro: { x: 62, y: 62 }, peso: 0.95,
    elementoDominante: "natureza",
    monstros: ["lobo", "corvo_ceifador", "abelha_titan", "javali", "wisp_radiante"],
    recursos: ["madeira", "erva"], clima: "temperado",
    descricao: "As raízes da Árvore-Mãe afloram aqui, e quem mente em voz alta atrai companhia.",
  },
  {
    id: "campos_de_elyndor", nome: "Campos de Elyndor", regiaoId: "altaverde",
    bioma: "planície cultivada", funcao: "travessia",
    perigo: [2, 4], forma: "planicie", centro: { x: 84, y: 54 }, peso: 1.10,
    elementoDominante: null,
    monstros: ["goblin", "bandido", "javali", "lobo", "touro_selvagem"],
    recursos: ["erva"], clima: "temperado",
    descricao: "Planície aberta ligando a vila ao resto do reino — a estrada principal passa por aqui.",
  },

  // =======================================================================
  // MORRANVELL — neve, vales, lagos congelados, fortalezas, minas.
  // =======================================================================
  {
    id: "trono_congelado", nome: "Trono Congelado", regiaoId: "morranvell",
    bioma: "alta montanha glacial", funcao: "fronteira",
    perigo: [12, 15], forma: "cordilheira", centro: { x: 92, y: 12 }, peso: 1.15,
    elementoDominante: "gelo",
    monstros: ["lobo_gelido", "troll_das_cavernas", "golem_de_pedra", "wyvern"],
    recursos: ["minerio"], clima: "nevado",
    chefe: { monstroId: "senhor_sombrio_da_montanha" },
    descricao: "O corpo mineralizado de um Titã adormecido, sob gelo que lembra promessas.",
  },
  {
    id: "vale_das_geleiras", nome: "Vale das Geleiras", regiaoId: "morranvell",
    bioma: "vale glacial", funcao: "travessia",
    perigo: [10, 13], forma: "vale", centro: { x: 76, y: 22 }, peso: 1.05,
    elementoDominante: "gelo",
    monstros: ["lobo_gelido", "bruxa_da_bruma", "harpia", "troll_das_cavernas"],
    recursos: ["minerio"], clima: "nevado",
    descricao: "Um corredor de gelo entre paredes de rocha — a única entrada praticável em Morranvell.",
  },
  {
    id: "pantano_bruma", nome: "Pântano da Bruma", regiaoId: "morranvell",
    bioma: "brejo gelado", funcao: "profunda",
    perigo: [10, 12], forma: "pantano", centro: { x: 70, y: 36 }, peso: 0.95,
    elementoDominante: "gelo",
    monstros: ["lodo_negro", "sapo_venenoso", "troll_das_cavernas", "lobo_gelido", "bruxa_da_bruma"],
    recursos: ["erva"], clima: "nevado",
    chefe: { monstroId: "matriarca_da_bruma_eterna" },
    descricao: "Névoa perpétua no sopé das geleiras, onde a água nunca decide se congela.",
  },

  // =======================================================================
  // MONTANHAS DE VULKOR — vulcões, lava, cinzas, cânions, forjas.
  // =======================================================================
  {
    id: "cratera_primeiro_fogo", nome: "Cratera do Primeiro Fogo", regiaoId: "montanhas_de_vulkor",
    bioma: "caldeira vulcânica", funcao: "fronteira",
    perigo: [14, 17], forma: "crateras", centro: { x: 34, y: 14 }, peso: 1.10,
    elementoDominante: "fogo",
    monstros: ["senhor_da_cinza", "gargula", "golem_de_pedra", "carrasco_de_cinzas"],
    recursos: ["minerio"], clima: "vulcanico",
    descricao: "O anel de crateras onde, dizem, o primeiro fogo do mundo foi aceso.",
  },
  {
    id: "mina_carmesim", nome: "Mina Carmesim", regiaoId: "montanhas_de_vulkor",
    bioma: "encosta minerada", funcao: "recurso",
    perigo: [12, 15], forma: "canyon", centro: { x: 22, y: 26 }, peso: 0.90,
    elementoDominante: "fogo",
    monstros: ["golem_de_pedra", "troll_das_cavernas", "gargula", "orc_selvagem"],
    recursos: ["minerio"], clima: "vulcanico",
    descricao: "Galerias abertas na rocha viva; a lava cristaliza aqui em metal que muda de forma.",
  },
  {
    id: "deserto_ardente", nome: "Deserto Ardente", regiaoId: "montanhas_de_vulkor",
    bioma: "campo de cinzas", funcao: "travessia",
    perigo: [11, 13], forma: "planicie", centro: { x: 40, y: 34 }, peso: 1.05,
    elementoDominante: "fogo",
    monstros: ["escorpiao_gigante", "necromante_errante", "golem_de_pedra", "senhor_da_cinza"],
    recursos: ["minerio"], clima: "vulcanico",
    chefe: { monstroId: "senhor_das_chamas_errantes" },
    descricao: "Areia tão quente que tremula, entre a cordilheira e o mar.",
  },

  // =======================================================================
  // BOSQUE ETERNO (VERDANTIS) — floresta primordial. Sem estrada principal.
  // =======================================================================
  {
    id: "floresta_ancestral", nome: "Floresta Ancestral", regiaoId: "bosque_eterno",
    bioma: "mata primordial", funcao: "profunda",
    perigo: [6, 9], forma: "floresta", centro: { x: 136, y: 20 }, peso: 1.15,
    elementoDominante: "natureza",
    monstros: ["urso_ancestral", "orc_selvagem", "druida_corrompido", "lobo_sombrio"],
    recursos: ["madeira", "erva"], clima: "umido",
    chefe: { monstroId: "matriarca_ursina" },
    descricao: "Árvores milenares guardadas por ursos e druidas corrompidos.",
  },
  {
    id: "lago_dos_reflexos", nome: "Lago dos Reflexos", regiaoId: "bosque_eterno",
    bioma: "lago de mata fechada", funcao: "santuario",
    perigo: [5, 8], forma: "delta", centro: { x: 152, y: 32 }, peso: 0.95,
    elementoDominante: "agua",
    monstros: ["sapo_venenoso", "lodo_negro", "druida_corrompido", "abelha_titan"],
    recursos: ["erva", "madeira"], clima: "umido",
    descricao: "A água devolve o rosto de quem se aproxima — nem sempre o rosto certo.",
  },
  {
    id: "portao_verde", nome: "Portão Verde", regiaoId: "bosque_eterno",
    bioma: "clareira murada por árvores", funcao: "travessia",
    perigo: [4, 7], forma: "vale", centro: { x: 120, y: 26 }, peso: 0.85,
    elementoDominante: "natureza",
    monstros: ["lobo", "javali", "corvo_ceifador", "urso_ancestral"],
    recursos: ["madeira"], clima: "umido",
    descricao: "A única fenda praticável na muralha viva do Bosque Eterno.",
  },

  // =======================================================================
  // VALE DO VENTO (AERWIND) — planícies, cânions, rotas abertas, ventos.
  // =======================================================================
  {
    id: "planicie_ventosa", nome: "Planície Ventosa", regiaoId: "vale_do_vento",
    bioma: "planície alta", funcao: "travessia",
    perigo: [6, 9], forma: "planicie", centro: { x: 198, y: 24 }, peso: 1.20,
    elementoDominante: "vento",
    monstros: ["touro_selvagem", "harpia", "grifo_jovem", "gralha_tempestuosa"],
    recursos: ["erva"], clima: "ventoso",
    chefe: { monstroId: "grifo_alfa_dos_ventos" },
    descricao: "Campos abertos varridos pelo vento, domínio de grifos jovens.",
  },
  {
    id: "pontes_suspensas", nome: "Pontes Suspensas", regiaoId: "vale_do_vento",
    bioma: "cânion de correntes", funcao: "travessia",
    perigo: [8, 11], forma: "canyon", centro: { x: 208, y: 44 }, peso: 0.90,
    elementoDominante: "vento",
    monstros: ["harpia", "grifo_jovem", "gralha_tempestuosa", "bandido"],
    recursos: ["madeira", "minerio"], clima: "ventoso",
    descricao: "Cânions cruzados por passarelas que balançam o dia inteiro.",
  },

  // =======================================================================
  // RUÍNAS DE AETHRA — memória, Éter, arquitetura quebrada, instabilidade.
  // =======================================================================
  {
    id: "ruinas_aethra", nome: "Ruínas de Aethra Antiga", regiaoId: "ruinas_de_aethra",
    bioma: "cidade morta", funcao: "profunda",
    perigo: [9, 12], forma: "urbana", centro: { x: 116, y: 52 }, peso: 1.15,
    elementoDominante: "arcano",
    monstros: ["esqueleto", "necromante_errante", "gargula", "sentinela_arcana", "espectro_arcano"],
    recursos: ["minerio", "erva"], clima: "arcano",
    chefe: { monstroId: "guardiao_arcano_das_ruinas" },
    descricao: "Restos da maior cidade da Era das Cidades-Luz; máquinas ainda obedecem ordens de mortos.",
  },
  {
    id: "labirinto_mecanico", nome: "Labirinto Mecânico", regiaoId: "ruinas_de_aethra",
    bioma: "ruína de engrenagem", funcao: "profunda",
    perigo: [11, 14], forma: "crateras", centro: { x: 132, y: 62 }, peso: 0.85,
    elementoDominante: "arcano",
    monstros: ["construto_arcano", "sentinela_arcana", "gargula", "espectro_arcano"],
    recursos: ["minerio"], clima: "arcano",
    descricao: "Corredores que se reorganizam quando ninguém está olhando.",
  },
  {
    id: "colinas_douradas", nome: "Colinas Douradas", regiaoId: "ruinas_de_aethra",
    bioma: "colina ensolarada", funcao: "travessia",
    perigo: [4, 6], forma: "planicie", centro: { x: 100, y: 38 }, peso: 1.00,
    elementoDominante: "radiante",
    monstros: ["goblin", "bandido", "harpia", "touro_selvagem", "wisp_radiante", "sentinela_dourada"],
    recursos: ["minerio", "erva"], clima: "temperado",
    chefe: { monstroId: "paladino_do_sol_poente" },
    descricao: "Colinas ensolaradas cortadas por trilhas de pastores, às portas das ruínas.",
  },

  // =======================================================================
  // CÂNON RUBRO — cânions vulcânicos, minas e forjas.
  // =======================================================================
  {
    id: "covil_do_dragao", nome: "Covil do Dragão", regiaoId: "canon_rubro",
    bioma: "terra arrasada", funcao: "profunda",
    perigo: [14, 16], forma: "crateras", centro: { x: 148, y: 58 }, peso: 1.05,
    elementoDominante: "fogo",
    monstros: ["gargula", "wyvern", "senhor_da_cinza"],
    recursos: ["minerio"], clima: "vulcanico",
    chefe: { monstroId: "dragao_anciao_das_cinzas" },
    descricao: "Terra cinzenta e queimada que esconde o Covil das Cinzas.",
  },
  {
    id: "mina_ferro_negro", nome: "Mina do Ferro Negro", regiaoId: "canon_rubro",
    bioma: "cânion minerado", funcao: "recurso",
    perigo: [12, 14], forma: "canyon", centro: { x: 160, y: 72 }, peso: 0.90,
    elementoDominante: "fogo",
    monstros: ["golem_de_pedra", "orc_selvagem", "troll_das_cavernas", "gargula"],
    recursos: ["minerio"], clima: "vulcanico",
    descricao: "A fenda de onde sai o metal que a Ordem da Chama Rubra transforma.",
  },
  {
    id: "bosque_petrificado", nome: "Bosque Petrificado", regiaoId: "canon_rubro",
    bioma: "floresta de pedra", funcao: "fronteira",
    perigo: [10, 12], forma: "floresta", centro: { x: 138, y: 84 }, peso: 0.95,
    elementoDominante: "terra",
    monstros: ["golem_de_pedra", "gargula", "orc_selvagem"],
    recursos: ["madeira", "minerio"], clima: "arido",
    chefe: { monstroId: "rei_petrificado" },
    descricao: "Árvores viradas pedra por uma magia que ninguém lembra de ter lançado.",
  },

  // =======================================================================
  // DESERTO DE ARENTH — dunas, oásis, ruínas enterradas, rotas comerciais.
  // =======================================================================
  {
    id: "deserto_karn", nome: "Deserto de Karn", regiaoId: "deserto_de_arenth",
    bioma: "duna aberta", funcao: "travessia",
    perigo: [8, 10], forma: "planicie", centro: { x: 186, y: 58 }, peso: 1.20,
    elementoDominante: "fogo",
    monstros: ["escorpiao_gigante", "esqueleto", "bandido", "verme_das_dunas"],
    recursos: ["minerio"], clima: "arido",
    chefe: { monstroId: "rainha_escorpiao_de_karn" },
    descricao: "Dunas escaldantes onde escorpiões gigantes espreitam sob a areia.",
  },
  {
    id: "oasis_sete_sombras", nome: "Oásis das Sete Sombras", regiaoId: "deserto_de_arenth",
    bioma: "oásis", funcao: "descanso",
    perigo: [7, 10], forma: "delta", centro: { x: 204, y: 72 }, peso: 0.75,
    elementoDominante: "agua",
    monstros: ["bandido", "escorpiao_gigante", "harpia"],
    recursos: ["erva"], clima: "arido",
    descricao: "Sete palmeiras, uma nascente e a única sombra confiável de Arenth.",
  },
  {
    id: "areias_soterradas", nome: "Areias Soterradas", regiaoId: "deserto_de_arenth",
    bioma: "ruína sob a areia", funcao: "profunda",
    perigo: [10, 13], forma: "crateras", centro: { x: 196, y: 92 }, peso: 0.90,
    elementoDominante: "arcano",
    monstros: ["necromante_errante", "esqueleto", "verme_das_dunas", "espectro_arcano"],
    recursos: ["minerio"], clima: "arido",
    descricao: "A tempestade abre construções por poucas horas antes de enterrá-las de novo.",
  },

  // =======================================================================
  // COSTA DA MARÉ (MARIS) — portos, falésias, arquipélagos, recifes.
  // =======================================================================
  {
    id: "costa_aurora", nome: "Costa da Aurora", regiaoId: "costa_da_mare",
    bioma: "praia rochosa", funcao: "travessia",
    perigo: [6, 8], forma: "peninsula", centro: { x: 34, y: 74 }, peso: 1.10,
    elementoDominante: "agua",
    monstros: ["caranguejo_gigante", "pirata_naufrago", "morcego"],
    recursos: ["minerio", "erva"], clima: "costeiro",
    chefe: { monstroId: "capita_mare_negra" },
    descricao: "Praia rochosa batida por ventos e naufrágios antigos.",
  },
  {
    id: "falesias_das_correntes", nome: "Falésias das Correntes", regiaoId: "costa_da_mare",
    bioma: "falésia", funcao: "fronteira",
    perigo: [8, 11], forma: "canyon", centro: { x: 22, y: 60 }, peso: 0.90,
    elementoDominante: "agua",
    monstros: ["harpia", "pirata_naufrago", "serpente_marinha", "gralha_tempestuosa"],
    recursos: ["minerio"], clima: "costeiro",
    descricao: "Paredões sobre o mar; o farol daqui decide quem chega vivo ao porto.",
  },

  // =======================================================================
  // RECIFE CORALINO — reino parcialmente submerso.
  // =======================================================================
  {
    id: "recife_tempestades", nome: "Recife das Tempestades", regiaoId: "recife_coralino",
    bioma: "recife", funcao: "profunda",
    perigo: [9, 11], forma: "arquipelago", centro: { x: 26, y: 100 }, peso: 1.10,
    elementoDominante: "raio",
    monstros: ["serpente_marinha", "caranguejo_gigante", "pirata_naufrago", "arraia_relampago", "enguia_eletrica"],
    recursos: ["minerio"], clima: "costeiro",
    chefe: { monstroId: "serpente_da_tempestade_eterna" },
    descricao: "Recifes castigados por tempestade constante e serpentes marinhas.",
  },
  {
    id: "jardins_de_perola", nome: "Jardins de Pérola", regiaoId: "recife_coralino",
    bioma: "banco de coral", funcao: "recurso",
    perigo: [8, 10], forma: "arquipelago", centro: { x: 40, y: 112 }, peso: 0.85,
    elementoDominante: "agua",
    monstros: ["caranguejo_gigante", "enguia_eletrica", "arraia_relampago"],
    recursos: ["minerio", "erva"], clima: "costeiro",
    descricao: "Na maré baixa, o coral vira estrada; na alta, vira teto.",
  },

  // =======================================================================
  // LAGO PRISMÁTICO — o centro do continente. Até a ETAPA 1, só lore.
  // =======================================================================
  {
    id: "ilha_do_prisma", nome: "Ilha do Prisma", regiaoId: "lago_prismatico",
    bioma: "ilha lacustre", funcao: "santuario",
    perigo: [7, 10], forma: "arquipelago", centro: { x: 112, y: 80 }, peso: 1.05,
    elementoDominante: "arcano",
    monstros: ["cristal_ecoante", "wisp_radiante", "espectro_arcano", "sentinela_arcana"],
    recursos: ["minerio", "erva"], clima: "temperado",
    descricao: "Seis correntes elementais se encontram aqui, e a água muda de cor conforme quem ganha.",
  },
  {
    id: "margem_prismatica", nome: "Margem Prismática", regiaoId: "lago_prismatico",
    bioma: "margem de lago", funcao: "travessia",
    perigo: [5, 8], forma: "delta", centro: { x: 96, y: 72 }, peso: 1.00,
    elementoDominante: "agua",
    monstros: ["sapo_venenoso", "lodo_negro", "cristal_ecoante", "harpia"],
    recursos: ["erva"], clima: "temperado",
    descricao: "Junco, cristal e o caminho de água que liga o norte ao sul do continente.",
  },

  // =======================================================================
  // PÂNTANO DE THALGOR — pântanos, canais, vilas elevadas, ruínas inundadas.
  // =======================================================================
  {
    id: "pantano_negro", nome: "Pântano Negro", regiaoId: "pantano_de_thalgor",
    bioma: "brejo fechado", funcao: "profunda",
    perigo: [5, 7], forma: "pantano", centro: { x: 92, y: 96 }, peso: 1.10,
    elementoDominante: "veneno",
    monstros: ["sapo_venenoso", "lodo_negro", "aranha_gigante"],
    recursos: ["erva"], clima: "umido",
    chefe: { monstroId: "bruxa_do_lodo_eterno" },
    descricao: "Águas paradas e lodo venenoso; poucos voltam sem lama nas botas.",
  },
  {
    id: "jardim_fungico", nome: "Jardim Fúngico", regiaoId: "pantano_de_thalgor",
    bioma: "campo de fungos", funcao: "recurso",
    perigo: [6, 9], forma: "pantano", centro: { x: 108, y: 106 }, peso: 0.90,
    elementoDominante: "veneno",
    monstros: ["lodo_negro", "aranha_gigante", "druida_corrompido", "sapo_venenoso"],
    recursos: ["erva"], clima: "umido",
    descricao: "Cogumelos da altura de um homem; plantas crescem sobre armaduras em horas.",
  },
  {
    id: "charco_fetido", nome: "Charco Fétido", regiaoId: "pantano_de_thalgor",
    bioma: "brejo raso", funcao: "travessia",
    perigo: [3, 5], forma: "pantano", centro: { x: 70, y: 86 }, peso: 0.95,
    elementoDominante: "veneno",
    monstros: ["slime", "sapo_venenoso", "aranha_gigante", "rato_gigante"],
    recursos: ["erva"], clima: "umido",
    chefe: { monstroId: "tirano_do_charco" },
    descricao: "Brejo raso nos limites sul dos campos, cheio de zumbido de insetos.",
  },

  // =======================================================================
  // SELVA UMBRÍACA — selva densa onde o Véu toca o mundo físico.
  // =======================================================================
  {
    id: "bosque_sombrio", nome: "Bosque Sombrio", regiaoId: "selva_umbriaca",
    bioma: "selva escura", funcao: "profunda",
    perigo: [3, 5], forma: "floresta", centro: { x: 112, y: 120 }, peso: 1.10,
    elementoDominante: "sombrio",
    monstros: ["lobo", "goblin", "bandido", "lobo_sombrio", "aranha_gigante", "corvo_ceifador"],
    recursos: ["madeira", "erva"], clima: "umido",
    chefe: { monstroId: "devoradora_de_sombras" },
    descricao: "Mata densa e escura onde bandidos e lobos sombrios rondam.",
  },
  {
    id: "arvore_oca", nome: "Árvore Oca", regiaoId: "selva_umbriaca",
    bioma: "clareira ritual", funcao: "santuario",
    perigo: [6, 9], forma: "floresta", centro: { x: 128, y: 132 }, peso: 0.85,
    elementoDominante: "sombrio",
    monstros: ["lobo_sombrio", "druida_corrompido", "corvo_ceifador", "espectro_arcano"],
    recursos: ["madeira"], clima: "umido",
    descricao: "Um tronco vazio do tamanho de uma torre, onde as tribos negociam com as sombras.",
  },

  // =======================================================================
  // VALE DOS TITÃS — escalas monumentais, ossos, ruínas gigantes.
  // =======================================================================
  {
    id: "vale_pedras", nome: "Vale das Pedras Cinzentas", regiaoId: "vale_dos_titas",
    bioma: "vale rochoso", funcao: "travessia",
    perigo: [4, 6], forma: "vale", centro: { x: 96, y: 134 }, peso: 1.05,
    elementoDominante: "terra",
    monstros: ["bandido", "goblin", "harpia", "cristal_ecoante"],
    recursos: ["minerio"], clima: "temperado",
    chefe: { monstroId: "colosso_das_pedras_cinzentas" },
    descricao: "Vale rochoso cortado por trilhas antigas de comerciantes.",
  },
  {
    id: "arena_ossea", nome: "Arena Óssea", regiaoId: "vale_dos_titas",
    bioma: "planície de ossos", funcao: "profunda",
    perigo: [11, 14], forma: "crateras", centro: { x: 120, y: 148 }, peso: 1.00,
    elementoDominante: "terra",
    monstros: ["golem_de_pedra", "esqueleto", "troll_das_cavernas", "carrasco_de_cinzas"],
    recursos: ["minerio"], clima: "temperado",
    descricao: "Uma caixa torácica do tamanho de um bairro, virada rinha por quem sobrou.",
  },
  {
    id: "coracao_petrificado", nome: "Coração Petrificado", regiaoId: "vale_dos_titas",
    bioma: "monumento vivo", funcao: "santuario",
    perigo: [13, 16], forma: "cordilheira", centro: { x: 142, y: 158 }, peso: 0.90,
    elementoDominante: "terra",
    monstros: ["golem_de_pedra", "construto_arcano", "gargula", "carrasco_de_cinzas"],
    recursos: ["minerio"], clima: "temperado",
    descricao: "Ainda bate, muito devagar. Perto dele o Éter fica pesado.",
  },
  {
    id: "caverna_eco", nome: "Caverna do Eco", regiaoId: "vale_dos_titas",
    bioma: "encosta cavernosa", funcao: "recurso",
    perigo: [8, 10], forma: "canyon", centro: { x: 74, y: 148 }, peso: 0.90,
    elementoDominante: "terra",
    monstros: ["esqueleto", "troll_das_cavernas", "aranha_gigante"],
    recursos: ["minerio"], clima: "temperado",
    chefe: { monstroId: "troll_anciao_do_eco" },
    descricao: "Encostas rochosas com uma boca de caverna que devolve gemidos.",
  },

  // =======================================================================
  // SOMBRALITH — o Véu, terreno fragmentado, névoa, anomalias.
  // =======================================================================
  {
    id: "terras_esquecidas", nome: "Terras Esquecidas", regiaoId: "sombralith",
    bioma: "campo abandonado", funcao: "travessia",
    perigo: [6, 8], forma: "planicie", centro: { x: 182, y: 108 }, peso: 1.05,
    elementoDominante: "sombrio",
    monstros: ["esqueleto", "druida_corrompido", "bandido", "corvo_ceifador"],
    recursos: ["erva"], clima: "sombrio",
    chefe: { monstroId: "cavaleiro_caido_de_aethra" },
    descricao: "Campos abandonados com fundações de casas há muito caídas.",
  },
  {
    id: "vale_dos_lamentos", nome: "Vale dos Lamentos", regiaoId: "sombralith",
    bioma: "vão fraturado", funcao: "profunda",
    perigo: [13, 16], forma: "canyon", centro: { x: 200, y: 122 }, peso: 0.95,
    elementoDominante: "sombrio",
    monstros: ["espectro_arcano", "gargula", "carrasco_de_cinzas", "necromante_errante"],
    recursos: ["minerio"], clima: "sombrio",
    descricao: "O chão aqui está rachado até onde a vista alcança, e o vão não tem fundo visível.",
  },
  {
    id: "montanha_sombria", nome: "Montanha Sombria", regiaoId: "sombralith",
    bioma: "pico escuro", funcao: "fronteira",
    perigo: [13, 15], forma: "cordilheira", centro: { x: 168, y: 132 }, peso: 1.00,
    elementoDominante: "sombrio",
    monstros: ["wyvern", "golem_de_pedra", "troll_das_cavernas"],
    recursos: ["minerio"], clima: "sombrio",
    descricao: "Picos escuros habitados por golens e trolls de caverna.",
  },

  // =======================================================================
  // ARQUIPÉLAGO DE NUVENS (NUVEA) — verticalidade, pontes, ventos.
  // =======================================================================
  {
    id: "falesias_fim", nome: "Falésias do Fim", regiaoId: "arquipelago_de_nuvens",
    bioma: "penhasco de altitude", funcao: "fronteira",
    perigo: [12, 14], forma: "peninsula", centro: { x: 176, y: 74 }, peso: 1.00,
    elementoDominante: "vento",
    monstros: ["wyvern", "harpia", "grifo_jovem", "gralha_tempestuosa"],
    recursos: ["minerio"], clima: "ventoso",
    chefe: { monstroId: "matriarca_wyvern_das_falesias" },
    descricao: "Penhascos altíssimos onde wyverns fazem seus ninhos.",
  },
  {
    id: "jardim_das_nuvens", nome: "Jardim das Nuvens", regiaoId: "arquipelago_de_nuvens",
    bioma: "ilha flutuante", funcao: "santuario",
    perigo: [12, 15], forma: "arquipelago", centro: { x: 196, y: 88 }, peso: 0.90,
    elementoDominante: "vento",
    monstros: ["grifo_jovem", "gralha_tempestuosa", "harpia", "wisp_radiante"],
    recursos: ["erva"], clima: "ventoso",
    descricao: "Ilhas que migram durante o ano; aqui território se mede em tempo, não em fronteira.",
  },

  // =======================================================================
  // ABISMO DE NAZ'THAL — o vazio profundo. Era só lore até a ETAPA 1.
  // =======================================================================
  {
    id: "olho_do_abismo", nome: "Olho do Abismo", regiaoId: "abismo_de_nazthal",
    bioma: "vórtice oceânico", funcao: "fronteira",
    perigo: [17, 20], forma: "arquipelago", centro: { x: 202, y: 156 }, peso: 1.00,
    elementoDominante: "arcano",
    monstros: ["serpente_marinha", "espectro_arcano", "construto_arcano", "arraia_relampago"],
    recursos: ["minerio"], clima: "sombrio",
    descricao: "O vórtice não leva ao fundo do mar: leva a uma dobra do Véu.",
  },
  {
    id: "confins_aethra", nome: "Confins de Aethra", regiaoId: "abismo_de_nazthal",
    bioma: "fim do mundo conhecido", funcao: "profunda",
    perigo: [15, 20], forma: "cordilheira", centro: { x: 174, y: 160 }, peso: 1.05,
    elementoDominante: "arcano",
    monstros: ["senhor_da_cinza", "wyvern", "golem_de_pedra", "gargula", "construto_arcano", "carrasco_de_cinzas"],
    recursos: ["minerio"], clima: "sombrio",
    chefe: { monstroId: "imperador_arcano_dos_confins" },
    descricao: "A fronteira final do reino conhecido, onde só os mais fortes sobrevivem.",
  },
  {
    id: "abismo_raso", nome: "Abismo Raso", regiaoId: "recife_coralino",
    bioma: "plataforma submersa", funcao: "profunda",
    perigo: [10, 13], forma: "arquipelago", centro: { x: 38, y: 142 }, peso: 1.00,
    elementoDominante: "agua",
    monstros: ["serpente_marinha", "enguia_eletrica", "arraia_relampago", "pirata_naufrago"],
    recursos: ["minerio"], clima: "costeiro",
    descricao: "Onde o recife cede e o fundo some — raso só no nome.",
  },
  {
    id: "templo_dos_titas", nome: "Templo dos Titãs", regiaoId: "vale_dos_titas",
    bioma: "planalto monumental", funcao: "santuario",
    perigo: [9, 12], forma: "planicie", centro: { x: 76, y: 166 }, peso: 0.95,
    elementoDominante: "terra",
    monstros: ["golem_de_pedra", "esqueleto", "cristal_ecoante", "troll_das_cavernas"],
    recursos: ["minerio", "erva"], clima: "temperado",
    descricao: "Construído entre duas costelas de Titã, e menor que qualquer uma delas.",
  },
];

export const zonaPorIdMundo = (id) => ZONAS_MUNDO.find((z) => z.id === id) || null;
