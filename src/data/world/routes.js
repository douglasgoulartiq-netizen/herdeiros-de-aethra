// ESTRADAS, RIOS E PONTES (ETAPA 2, itens 6, 7, 8 e 9).
//
// ESTRADAS — quatro níveis, e nenhuma decorativa
// ----------------------------------------------
// "Toda estrada deve possuir destino. Não desenhar caminhos decorativos sem
// função." Aqui isso não é uma promessa, é a estrutura do dado: uma estrada é
// um PAR de lugares. Não existe como declarar um traço bonito que não liga
// nada — não há campo para isso.
//
//   PRINCIPAL   liga capitais e a vila inicial. É a espinha do continente,
//               larga, calçada, e o gerador a abre custe o que custar.
//   SECUNDARIA  liga cidade, vila e posto à espinha mais próxima.
//   TRILHA      liga assentamento e POI ao que estiver perto. Estreita, de
//               terra, some dentro da mata.
//   SECRETO     atalho por dentro de barreira (garganta, túnel, passagem).
//               Não aparece no mapa até ser descoberto — é a única categoria
//               que nasce oculta.
//
// As secundárias e as trilhas NÃO são escritas à mão: seria escrever cem
// pares e errar metade quando uma zona mudasse de lugar. Elas são derivadas
// pelo gerador — cada assentamento e cada POI procura o ponto mais próximo da
// rede já existente. Escrito à mão fica só o que é decisão de mundo: a
// espinha e os atalhos secretos.
//
// RIOS — nascente, trajeto, foz (item 7)
// --------------------------------------
// "Não criar rio que termina no nada." Todo rio aqui declara NASCENTE e FOZ,
// e o gerador é obrigado a ligar as duas: o traçado desce o relevo entre elas
// e termina em água aberta, lago ou mar. Afluente é um rio com foz em outro
// rio, e é a mesma estrutura.
//
// PONTES nascem sozinhas (item 8): onde uma estrada cruza água, o gerador
// planta uma. Não há lista de pontes escrita à mão porque a posição depende
// do traçado, que depende da semente.

export const NIVEIS_ESTRADA = {
  PRINCIPAL: { tiles: 3, rotulo: "Estrada principal", custoBarreira: 60, secreta: false },
  SECUNDARIA: { tiles: 2, rotulo: "Estrada secundária", custoBarreira: 110, secreta: false },
  TRILHA: { tiles: 1, rotulo: "Trilha", custoBarreira: 200, secreta: false },
  SECRETO: { tiles: 1, rotulo: "Caminho secreto", custoBarreira: 40, secreta: true },
};

// A espinha do continente. Cada par é uma decisão: por onde o comércio, o
// exército e o herói atravessam Aethra. Lida de norte a sul, ela conta a
// geografia: das geleiras à vila, da vila ao mar, do mar ao deserto.
export const ESTRADAS_PRINCIPAIS = [
  { de: "fortaleza_do_gelo", para: "posto_avancado_da_ordem", nome: "Estrada das Geleiras" },
  { de: "posto_avancado_da_ordem", para: "vila_de_aethra", nome: "Estrada Velha de Aethra" },
  { de: "vila_de_aethra", para: "porto_de_maris", nome: "Estrada do Sal" },
  { de: "posto_avancado_da_ordem", para: "cidade_de_aerwind", nome: "Rota do Vento" },
  { de: "cidade_de_aerwind", para: "posto_da_caravana", nome: "Rota Comercial de Arenth" },
  { de: "posto_da_caravana", para: "cidade_das_sombras", nome: "Estrada dos Lamentos" },
  { de: "porto_de_maris", para: "cidade_de_corallia", nome: "Caminho da Maré" },
  { de: "vila_de_aethra", para: "aldeia_sombria", nome: "Estrada do Lodo" },
  { de: "aldeia_sombria", para: "aldeia_dos_cacadores", nome: "Trilha Larga da Selva" },
  { de: "cidade_flutuante", para: "cidade_das_sombras", nome: "Passagem Suspensa" },
  { de: "fortaleza_de_ignis", para: "fortaleza_do_gelo", nome: "Estrada da Forja" },
  { de: "fortaleza_ignea", para: "cidade_de_aerwind", nome: "Estrada do Ferro Negro" },
];

// Atalhos que atravessam barreira (item 9: passes, gargalos, túneis). São
// poucos de propósito: um atalho deixa de ser atalho quando há cinco.
export const CAMINHOS_SECRETOS = [
  { de: "mina_carmesim", para: "vale_das_geleiras", nome: "Garganta do Ferro", tipo: "garganta" },
  { de: "caverna_eco", para: "vale_pedras", nome: "Túnel do Eco", tipo: "tunel" },
  { de: "montanha_sombria", para: "coracao_petrificado", nome: "Passagem do Vento Uivante", tipo: "passe" },
  { de: "bosque_petrificado", para: "labirinto_mecanico", nome: "Fenda dos Construtos", tipo: "fenda" },
];

// Rios. `nascente` e `foz` são ZONAS: o traçado exato sai do relevo gerado,
// mas as duas pontas são decisão de mundo. `afluenteDe` transforma o rio num
// braço de outro — e é assim que uma bacia inteira se forma sem nenhum
// caso especial no gerador.
export const RIOS = [
  {
    id: "rio_das_vozes", nome: "Rio das Vozes",
    nascente: "vale_das_geleiras", foz: "margem_prismatica",
    largura: 2, descricao: "Desce das geleiras e atravessa Altaverde até o Lago Prismático.",
  },
  {
    id: "rio_da_mae", nome: "Rio da Árvore-Mãe",
    nascente: "bosque_das_vozes", foz: "margem_prismatica",
    largura: 1, afluenteDe: "rio_das_vozes",
    descricao: "Nasce entre as raízes e engrossa o Rio das Vozes.",
  },
  {
    id: "rio_do_sal", nome: "Rio do Sal",
    nascente: "campos_de_elyndor", foz: "costa_aurora",
    largura: 2, descricao: "Corta os campos e desemboca no mar, ao lado do Porto de Maris.",
  },
  {
    id: "rio_negro", nome: "Rio Negro",
    nascente: "charco_fetido", foz: "pantano_negro",
    largura: 2, descricao: "Água parada que só se move quando chove; alimenta o Pântano de Thalgor.",
  },
  {
    id: "rio_das_cinzas", nome: "Rio das Cinzas",
    nascente: "cratera_primeiro_fogo", foz: "deserto_ardente",
    largura: 1, descricao: "Não é água: é lava velha que ainda corre devagar.",
  },
  {
    id: "rio_dos_reflexos", nome: "Rio dos Reflexos",
    nascente: "lago_dos_reflexos", foz: "labirinto_mecanico",
    largura: 2, descricao: "Sai do lago do Bosque Eterno e some entre as ruínas.",
  },
  {
    id: "rio_dos_titas", nome: "Rio dos Titãs",
    nascente: "vale_pedras", foz: "abismo_raso",
    largura: 2, descricao: "Corre entre costelas de Titã até o recife.",
  },
];

export const rioPorId = (id) => RIOS.find((r) => r.id === id) || null;
