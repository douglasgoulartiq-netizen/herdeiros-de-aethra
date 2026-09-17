// ASSENTAMENTOS, POIs, LANDMARKS E MASMORRAS (ETAPA 2, itens 10 a 20).
//
// DE ONDE VÊM OS NOMES
// --------------------
// De lugar nenhum novo. O pedido listou onze capitais possíveis — Valedorn,
// Sylvaran, Khardrum, Khar-Zhur, Sahram, Moura-Nal, Porto Velar, Ossária,
// Nocthar, Caelium, Aerathis — e mandou "verificar antes". Verifiquei: NENHUMA
// das onze aparece em qualquer arquivo deste projeto. Inventá-las seria criar
// cânone, que é justamente o que não se deve fazer.
//
// O que o projeto TEM é o campo `locaisLendarios` do atlas do mapa-múndi
// (src/data/atlasRegions.js): três lugares com nome próprio para cada uma das
// 17 regiões, 51 no total, escritos a partir do Livro da Mitologia. É de lá
// que sai tudo aqui. "Cidade de Aerwind", "Porto de Maris", "Fortaleza do
// Gelo", "Aldeia Sombria", "Câmara dos Nomes", "Farol das Correntes" — cada
// nome abaixo já existia no projeto esperando território.
//
// A categoria de cada assentamento também não foi escolhida no gosto: ela sai
// do que o próprio nome canônico diz. "Cidade de X" é cidade, "Aldeia de X" é
// vila, "Fortaleza de X" é praça-forte. Onde o cânone não dá nome — os
// acampamentos de mineiro, de caravana, de pescador do item 16 — o nome é
// descritivo da FUNÇÃO, nunca um topônimo novo.
//
// ESCALA (itens 11 a 14)
// ----------------------
// `raio` é o tamanho do assentamento em tiles, e as categorias não se
// confundem: uma capital ocupa um raio de 11 (uma mancha de ~380 tiles, com
// distritos próprios), uma vila ocupa 4, um acampamento ocupa 2. "Capital não
// pode parecer quatro casas" é uma frase que vira um número aqui.
//
// DISTRITOS (item 13) são por cultura, não um molde repetido: o porto de
// Maris tem doca e mercado negro; a cidade glacial de Morranvell tem mina e
// salão; a Cidade das Sombras tem necrópole. Nenhuma planta se repete.

// RAIOS (revistos na reconstrução do mapa).
//
// Os valores antigos — capital 11, vila 4 — foram escritos quando uma "casa"
// era UM TILE pintado de parede. Agora uma casa é um prédio de 4x4 a 6x6
// tiles com colisão própria, e nesses raios não cabia cidade nenhuma: a Vila
// de Aethra saía com DUAS paredes soltas e a maior capital do mundo com sete.
// Uma capital de raio 14 tem ~615 tiles de mancha urbana, que é o que uma
// planta de ruas e quarteirões precisa para render as dezenas de prédios que
// o briefing cobra.
export const CATEGORIAS = {
  CAPITAL: { raio: 22, minDistritos: 4, rotulo: "Capital" },
  CIDADE: { raio: 16, minDistritos: 2, rotulo: "Cidade" },
  VILA: { raio: 11, minDistritos: 0, rotulo: "Vila" },
  ASSENTAMENTO: { raio: 7, minDistritos: 0, rotulo: "Assentamento" },
  ACAMPAMENTO: { raio: 5, minDistritos: 0, rotulo: "Acampamento" },
};

// `zonaId` diz em que zona o assentamento nasce; a posição exata é escolhida
// pelo gerador dentro do território real dela (nada de coordenada escrita à
// mão que pode cair dentro de um lago).
export const ASSENTAMENTOS = [
  // --- CAPITAIS ---------------------------------------------------------
  {
    id: "sylvaran_altaverde", nome: "Sylvaran, Altaverde", categoria: "CAPITAL",
    zonaId: "campos_de_elyndor", faccao: "Círculo de Altaverde",
    economia: "ervas raras, madeira juramentada, cura e artesanato élfico",
    distritos: ["Praça da Árvore", "Templo Verde", "Mercado das Folhas", "Bairro dos Artesãos", "Jardins d'Água", "Portão das Montanhas"],
    problema: "a cidade prospera, mas as raízes antigas começaram a empurrar suas muralhas",
    viagemRapida: true, modeloRico: true,
  },
  {
    id: "cidade_de_aerwind", nome: "Cidade de Aerwind", categoria: "CAPITAL",
    zonaId: "planicie_ventosa", faccao: "Liga dos Ventos",
    economia: "rotas aéreas, correio e contratos de escolta",
    distritos: ["Praça das Velas", "Torre dos Ventos", "Estaleiro Alto", "Mercado do Vento", "Quartel da Liga"],
    problema: "o exílio é a punição mais temida, e a fila de exilados cresceu",
    viagemRapida: true,
  },
  {
    id: "porto_de_maris", nome: "Porto de Maris", categoria: "CAPITAL",
    zonaId: "costa_aurora", faccao: "Navegadores de Maris",
    economia: "cartografia, frete e leilão de rotas",
    distritos: ["Doca Velha", "Casa das Cartas", "Mercado Negro", "Bairro dos Cordoeiros", "Farol"],
    problema: "mapa é propriedade valiosa, e alguém anda copiando os melhores",
    viagemRapida: true,
  },
  {
    id: "cidade_das_sombras", nome: "Cidade das Sombras", categoria: "CAPITAL",
    zonaId: "terras_esquecidas", faccao: "Corte das Sombras",
    economia: "nenhuma que se declare em voz alta",
    distritos: ["Praça Vazia", "Necrópole", "Corte Baixa", "Torre do Silêncio"],
    problema: "de longe a cidade está inteira; de dentro, é ruína",
    viagemRapida: true,
  },
  {
    id: "cidade_flutuante", nome: "Cidade Flutuante", categoria: "CAPITAL",
    zonaId: "jardim_das_nuvens", faccao: "Clãs Celestes",
    economia: "cristal de vento, jardins suspensos e travessia",
    distritos: ["Ancoradouro", "Jardins Altos", "Assembleia dos Clãs", "Estaleiro Celeste"],
    problema: "a ilha migra, e metade dos tratados venceu no caminho",
    viagemRapida: true,
  },
  {
    id: "cidade_de_corallia", nome: "Cidade de Corallia", categoria: "CAPITAL",
    zonaId: "jardins_de_perola", faccao: "Cidades de Coral",
    economia: "pérola, coral trabalhado e pilotagem de recife",
    distritos: ["Cais de Coral", "Casa das Marés", "Viveiro de Pérola", "Guarda do Recife"],
    problema: "a cidade é meio submersa e a maré decide o expediente",
    viagemRapida: true,
  },

  // --- CIDADES E PRAÇAS-FORTES ------------------------------------------
  {
    id: "fortaleza_do_gelo", nome: "Fortaleza do Gelo", categoria: "CIDADE",
    zonaId: "vale_das_geleiras", faccao: "Clãs de Morranvell",
    economia: "mina de profundidade e pactos jurados diante da geleira",
    distritos: ["Salão dos Juramentos", "Mina Alta", "Muralha Norte"],
    problema: "o gelo lembra promessas — e cobra as quebradas",
    viagemRapida: true,
  },
  {
    id: "fortaleza_de_ignis", nome: "Fortaleza de Ignis", categoria: "CIDADE",
    zonaId: "mina_carmesim", faccao: "Forjadores de Vulkor",
    economia: "forja de metal vivo e refino de lava cristalizada",
    distritos: ["Grande Forja", "Bocas de Fundição", "Muralha de Basalto"],
    problema: "arma despertada não escolhe portador com critério",
    viagemRapida: true,
  },
  {
    id: "fortaleza_ignea", nome: "Fortaleza Ígnea", categoria: "CIDADE",
    zonaId: "mina_ferro_negro", faccao: "Ordem da Chama Rubra",
    economia: "ferro negro, carvão e a doutrina de que transformar purifica",
    distritos: ["Pátio das Provas", "Fornos Baixos", "Arsenal"],
    problema: "a Ordem discute se a purificação vale para pessoas também",
    viagemRapida: true,
  },

  // --- VILAS (item 15: motivo de existir, economia, problema, gancho) ----
  {
    id: "vila_de_aethra", nome: "Vila de Aethra", categoria: "VILA",
    zonaId: "vila", faccao: "vila",
    economia: "lavoura, caça miúda e uma forja que atende três povoados",
    distritos: [],
    problema: "os campos do norte já não rendem como rendiam",
    viagemRapida: true, inicial: true,
  },
  {
    id: "aldeia_sombria", nome: "Aldeia Sombria", categoria: "VILA",
    zonaId: "pantano_negro", faccao: "Clãs do Lodo",
    economia: "colheita de fungo e alquimia de pântano",
    distritos: [],
    problema: "as passarelas apodrecem mais rápido do que se conserta",
    viagemRapida: true, elevada: true,
  },
  {
    id: "aldeia_dos_cacadores", nome: "Aldeia dos Caçadores", categoria: "VILA",
    zonaId: "bosque_sombrio", faccao: "Tribos Umbríacas",
    economia: "caça, curtume e escolta por dentro da selva",
    distritos: [],
    problema: "à noite as sombras se soltam dos donos, e alguém precisa negociar",
    viagemRapida: true,
  },

  // --- ASSENTAMENTOS E ACAMPAMENTOS (item 16) ---------------------------
  // Sem topônimo: o nome diz a função, que é o que um posto desses é.
  { id: "posto_da_caravana", nome: "Posto da Caravana", categoria: "ASSENTAMENTO", zonaId: "deserto_karn", faccao: "Casas de Arenth", economia: "água, sombra e pedágio informal", distritos: [], problema: "a rota muda com a tempestade", viagemRapida: true },
  { id: "acampamento_dos_mineiros", nome: "Acampamento dos Mineiros", categoria: "ACAMPAMENTO", zonaId: "caverna_eco", faccao: null, economia: "minério bruto", distritos: [], problema: "o eco da caverna atrapalha o sono e a conta do turno", viagemRapida: false },
  { id: "acampamento_dos_pescadores", nome: "Acampamento dos Pescadores", categoria: "ACAMPAMENTO", zonaId: "recife_tempestades", faccao: null, economia: "pesca de recife", distritos: [], problema: "a tempestade não avisa", viagemRapida: false },
  { id: "posto_avancado_da_ordem", nome: "Posto Avançado da Ordem", categoria: "ASSENTAMENTO", zonaId: "ruinas_aethra", faccao: "Ordem dos Arquivistas", economia: "escavação e catalogação", distritos: [], problema: "as máquinas ainda obedecem a alguém", viagemRapida: true },
  { id: "acampamento_dos_peregrinos", nome: "Acampamento dos Peregrinos", categoria: "ACAMPAMENTO", zonaId: "templo_dos_titas", faccao: "Peregrinos dos Ossos", economia: "oferendas e guia de romaria", distritos: [], problema: "partes do Titã ainda reagem ao Éter", viagemRapida: false },
  { id: "acampamento_dos_lenhadores", nome: "Acampamento dos Lenhadores", categoria: "ACAMPAMENTO", zonaId: "floresta_ancestral", faccao: null, economia: "madeira de árvore milenar, com licença duvidosa", distritos: [], problema: "os druidas da mata discordam da licença", viagemRapida: false },
  { id: "posto_do_oasis", nome: "Posto do Oásis", categoria: "ASSENTAMENTO", zonaId: "oasis_sete_sombras", faccao: "Casas de Arenth", economia: "água vendida a peso de metal", distritos: [], problema: "sete sombras, e ninguém contou quantas são de gente", viagemRapida: true },
];

// --- PONTOS DE INTERESSE (itens 17 e 18) ---------------------------------
// "POI não é baú." Cada um declara o que OFERECE — história, combate, puzzle,
// evento, recurso, segredo, atalho — e é isso que a ETAPA 3 vai pendurar
// nele. Um POI sem nenhuma dessas coisas não deveria existir.
export const POIS = [
  { id: "arvore_mae", nome: "Árvore-Mãe", zonaId: "bosque_das_vozes", tipo: "arvore_antiga", oferece: ["historia", "recurso", "segredo"], descricao: "A seiva cristalizada guarda memórias de gente morta." },
  { id: "santuario_do_equilibrio", nome: "Santuário do Equilíbrio", zonaId: "floresta", tipo: "santuario", oferece: ["historia", "evento"], descricao: "Ferimento leve cicatriza mais rápido perto das raízes antigas." },
  { id: "caverna_do_oraculo", nome: "Caverna do Oráculo", zonaId: "trono_congelado", tipo: "caverna", oferece: ["historia", "puzzle", "segredo"], descricao: "O gelo aqui preserva cartas, corpos e emoções." },
  { id: "torre_dos_ventos", nome: "Torre dos Ventos", zonaId: "planicie_ventosa", tipo: "torre", oferece: ["historia", "atalho"], descricao: "Vê-se dela metade de Aerwind — e é por isso que ela existe." },
  { id: "santuario_da_nevoa", nome: "Santuário da Névoa", zonaId: "lago_dos_reflexos", tipo: "santuario", oferece: ["historia", "evento", "segredo"], descricao: "Quem entra para matar caminha dias; quem entra para curar, minutos." },
  { id: "torre_do_conhecimento", nome: "Torre do Conhecimento", zonaId: "ruinas_aethra", tipo: "torre", oferece: ["historia", "combate", "recurso"], descricao: "Ainda de pé, ainda catalogando, ainda sem bibliotecário." },
  { id: "camara_dos_nomes", nome: "Câmara dos Nomes", zonaId: "labirinto_mecanico", tipo: "cripta", oferece: ["historia", "puzzle", "segredo"], descricao: "Os registros de antigos Herdeiros continuam selados." },
  { id: "forja_dos_deuses", nome: "Forja dos Deuses", zonaId: "mina_ferro_negro", tipo: "forja", oferece: ["historia", "recurso", "combate"], descricao: "Aqui a lava vira metal vivo, e o metal vivo às vezes vira outra coisa." },
  { id: "santuario_das_aguas", nome: "Santuário das Águas", zonaId: "margem_prismatica", tipo: "santuario", oferece: ["historia", "evento"], descricao: "Os sacerdotes leem no prisma o equilíbrio mágico do continente." },
  { id: "observatorio_submerso", nome: "Observatório Submerso", zonaId: "ilha_do_prisma", tipo: "ruina", oferece: ["puzzle", "segredo", "historia"], descricao: "Metade dele está debaixo d'água, e a metade que importa é essa." },
  { id: "mercado_negro", nome: "Mercado Negro", zonaId: "falesias_das_correntes", tipo: "mercado", oferece: ["evento", "recurso", "segredo"], descricao: "Mapas que não deviam existir trocam de mão aqui." },
  { id: "farol_das_correntes", nome: "Farol das Correntes", zonaId: "costa_aurora", tipo: "farol", oferece: ["historia", "atalho"], descricao: "A luz dele decide quantos barcos chegam inteiros." },
  { id: "tumulo_vivo", nome: "Túmulo Vivo", zonaId: "jardim_fungico", tipo: "cripta", oferece: ["combate", "historia", "segredo"], descricao: "Plantas crescem sobre armaduras em horas — e algumas armaduras reagem." },
  { id: "altar_da_lua_negra", nome: "Altar da Lua Negra", zonaId: "arvore_oca", tipo: "altar", oferece: ["evento", "combate", "historia"], descricao: "As tribos negociam aqui com o que se solta das pessoas à noite." },
  { id: "templo_de_arenth", nome: "Templo de Arenth", zonaId: "areias_soterradas", tipo: "templo", oferece: ["puzzle", "historia", "recurso"], descricao: "Aparece por poucas horas depois da tempestade, e some de novo." },
  { id: "biblioteca_de_areia", nome: "Biblioteca de Areia", zonaId: "areias_soterradas", tipo: "ruina", oferece: ["historia", "puzzle", "segredo"], descricao: "Os volumes são de vidro fundido pelo raio na duna." },
  { id: "estaleiro_celeste", nome: "Estaleiro Celeste", zonaId: "falesias_fim", tipo: "estaleiro", oferece: ["recurso", "historia", "atalho"], descricao: "Onde se conserta o que voa — e o que caiu." },
  { id: "nau_dos_sem_tempo", nome: "Nau dos Sem-Tempo", zonaId: "olho_do_abismo", tipo: "naufragio", oferece: ["historia", "combate", "segredo"], descricao: "Sumiu há décadas e voltou sem que ninguém a bordo envelhecesse." },
  { id: "fenda_azul", nome: "Fenda Azul", zonaId: "abismo_raso", tipo: "anomalia", oferece: ["puzzle", "segredo", "evento"], descricao: "Uma dobra do Véu que se abre debaixo d'água." },
  { id: "campo_de_batalha_esquecido", nome: "Campo de Batalha Esquecido", zonaId: "campos_de_elyndor", tipo: "campo_de_batalha", oferece: ["historia", "combate", "recurso"], descricao: "Ninguém lembra de que lado estava, e as armas continuam no chão." },
  { id: "coluna_partida", nome: "Coluna Partida", zonaId: "colinas_douradas", tipo: "ruina", oferece: ["historia", "atalho"], descricao: "Um marco de estrada de um reino que não existe mais." },
  { id: "cripta_do_cavaleiro", nome: "Cripta do Cavaleiro Caído", zonaId: "vale_dos_lamentos", tipo: "cripta", oferece: ["combate", "historia", "segredo"], descricao: "Selada por dentro, o que é um detalhe difícil de explicar." },
];

// --- LANDMARKS (item 10) --------------------------------------------------
// "Landmarks ajudam navegação": são o que se vê de longe e permite dizer
// "estou a leste do vulcão" sem abrir mapa nenhum. Por isso cada um declara
// `visivelDeLonge` e a distância em tiles a partir da qual aparece.
export const LANDMARKS = [
  { id: "lm_arvore_mae", nome: "Árvore-Mãe", zonaId: "bosque_das_vozes", tipo: "arvore_monumental", alcance: 40 },
  { id: "lm_trono_congelado", nome: "Trono Congelado", zonaId: "trono_congelado", tipo: "esqueleto_de_tita", alcance: 55 },
  { id: "lm_cratera", nome: "Cratera do Primeiro Fogo", zonaId: "cratera_primeiro_fogo", tipo: "vulcao", alcance: 60 },
  { id: "lm_torre_conhecimento", nome: "Torre do Conhecimento", zonaId: "ruinas_aethra", tipo: "torre", alcance: 45 },
  { id: "lm_farol", nome: "Farol das Correntes", zonaId: "costa_aurora", tipo: "farol", alcance: 42 },
  { id: "lm_torre_silencio", nome: "Torre do Silêncio", zonaId: "terras_esquecidas", tipo: "torre", alcance: 45 },
  { id: "lm_coracao", nome: "Coração Petrificado", zonaId: "coracao_petrificado", tipo: "esqueleto_de_tita", alcance: 50 },
  { id: "lm_prisma", nome: "Ilha do Prisma", zonaId: "ilha_do_prisma", tipo: "cristal", alcance: 48 },
  { id: "lm_portao_verde", nome: "Portão Verde", zonaId: "portao_verde", tipo: "ruina", alcance: 35 },
  { id: "lm_ponte_colossal", nome: "Ponte Colossal de Aethra", zonaId: "campos_de_elyndor", tipo: "ponte_colossal", alcance: 38 },
  { id: "lm_arvore_oca", nome: "Árvore Oca", zonaId: "arvore_oca", tipo: "arvore_monumental", alcance: 36 },
  { id: "lm_olho", nome: "Olho do Abismo", zonaId: "olho_do_abismo", tipo: "anomalia", alcance: 52 },
  // Os cinco abaixo entraram depois de MEDIR a cobertura: com os doze
  // primeiros, um quarto do mapa não tinha nenhum marco à vista, e o teste de
  // orientação (item 31) reprovava com 74%. As lacunas eram o Abismo Raso, a
  // Planície Ventosa, o Templo dos Titãs, o Deserto de Karn e a Caverna do
  // Eco — todas regiões abertas, justamente onde um ponto de referência mais
  // faz falta. Os nomes continuam vindo do `locaisLendarios` do atlas.
  { id: "lm_torre_ventos", nome: "Torre dos Ventos", zonaId: "planicie_ventosa", tipo: "torre", alcance: 50 },
  { id: "lm_templo_titas", nome: "Templo dos Titãs", zonaId: "templo_dos_titas", tipo: "ruina", alcance: 48 },
  { id: "lm_fenda_azul", nome: "Fenda Azul", zonaId: "abismo_raso", tipo: "anomalia", alcance: 50 },
  { id: "lm_biblioteca", nome: "Biblioteca de Areia", zonaId: "deserto_karn", tipo: "ruina", alcance: 44 },
  { id: "lm_fortaleza_gelo", nome: "Fortaleza do Gelo", zonaId: "vale_das_geleiras", tipo: "torre", alcance: 46 },
];

// --- MASMORRAS (item 19) --------------------------------------------------
// "Não teletransportar jogador para dungeon sem contexto." Cada masmorra
// declara em que zona sua boca fica e COMO ela se apresenta no terreno; o
// gerador coloca a entrada num tile andável dessa zona, ligada à malha de
// estradas — nunca num tile solto no meio de uma parede.
export const MASMORRAS_MUNDO = [
  {
    id: "dungeon1", nome: "Cripta sob a Floresta", zonaId: "floresta",
    boca: "uma escada de pedra descendo entre raízes",
    largura: 22, altura: 16, nivel: [4, 7],
    monstros: ["esqueleto", "aranha_gigante", "morcego", "rato_gigante"],
    chefe: "dragao_jovem", elementoDominante: "sombrio", facaoId: "ordem_dos_arquivistas",
  },
  {
    id: "dungeon2", nome: "Covil das Cinzas", zonaId: "covil_do_dragao",
    boca: "uma fenda de basalto que exala calor",
    largura: 20, altura: 14, nivel: [14, 18],
    monstros: ["gargula", "wyvern", "senhor_da_cinza", "necromante_errante", "troll_das_cavernas", "golem_de_pedra"],
    chefe: "arauto_das_cinzas", elementoDominante: "fogo", facaoId: "legiao_das_cinzas",
  },
];

export const assentamentoPorId = (id) => ASSENTAMENTOS.find((a) => a.id === id) || null;
export const assentamentosDaZona = (zonaId) => ASSENTAMENTOS.filter((a) => a.zonaId === zonaId);
export const poisDaZona = (zonaId) => POIS.filter((p) => p.zonaId === zonaId);
export const landmarksDaZona = (zonaId) => LANDMARKS.filter((l) => l.zonaId === zonaId);
export const masmorrasDaZona = (zonaId) => MASMORRAS_MUNDO.filter((m) => m.zonaId === zonaId);
