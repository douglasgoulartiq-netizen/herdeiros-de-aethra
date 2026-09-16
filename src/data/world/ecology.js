// ECOLOGIA REGIONAL (ETAPA 3, itens 21 a 27).
//
// O QUE JÁ EXISTIA, E O QUE FALTAVA
// ---------------------------------
// A ETAPA 2 já dava a cada zona uma lista `monstros` — isto é, HABITAT por
// zona, que é a metade fácil do item 22. O que não existia era a razão: por
// que aquele bicho está ali, o que ele come, quem o come, a que hora ele
// aparece e o que faz ele ir embora.
//
// Este arquivo é essa camada. Não substitui `zonas[].monstros`: qualifica.
// A zona continua sendo a autoridade sobre QUEM pode aparecer nela; a
// ecologia decide QUANDO, e se hoje aparece.
//
// HABITAT É GRUPO, NÃO BIOMA
// --------------------------
// A primeira versão deste arquivo listava biomas literais ("duna aberta",
// "brejo raso") e acusou 95 violações — quase todas falsas, porque o mundo
// tem 48 biomas e escrever a lista exata de cada espécie é um convite a
// esquecer um. Os biomas foram agrupados em 15 GRUPOS DE HABITAT e a espécie
// declara grupos. Aí sobraram 13 conflitos, e desses 3 eram bugs de verdade
// (ver MIGRACOES e o relatório): serpente marinha num penhasco de altitude,
// carrasco de cinzas num vórtice oceânico e necromante errante em duna limpa.
// Esses três foram corrigidos no pool da zona, em zones.js. Os outros 10 eram
// habitat meu escrito estreito demais, e foram ampliados aqui.
//
// A regra do item 22 ("criatura aquática não aparece aleatoriamente no
// deserto") é o teste: nenhuma zona pode ter no pool uma espécie que não
// compartilhe pelo menos um grupo de habitat com o bioma da zona.
//
// CAMPOS DA ESPÉCIE
//   habitats   grupos de habitat (ver GRUPOS_DE_HABITAT)
//   horario    manha | tarde | noite | sempre  (casa com HORAS_DIA)
//   clima      climas que AUMENTAM a chance; [] = indiferente
//   climaFoge  climas que reduzem a chance a quase zero
//   dieta      o que ela come: espécies e/ou "vegetacao"/"carnica"/"eter"
//   ameaca     passiva | territorial | agressiva | apice
//   eter       0 a 3 — sensibilidade ao Éter; 3 migra em tempestade de Éter
//   grupo      [min,max] de indivíduos por encontro
//   descoberta o que revela a entrada dela no Compendium
//
// `predadores` NÃO é um campo: é derivado de `dieta` por predadoresDe(). Ter
// as duas pontas escritas à mão gerava 22 contradições silenciosas — uma
// espécie que comia outra sem constar como predadora dela. Uma fonte só.
import { ZONAS_MUNDO } from "./zones.js";

export const HORARIOS = ["manha", "tarde", "noite", "sempre"];

// Os 15 grupos de habitat, e a que grupos cada bioma das 48 zonas pertence.
// Um bioma pode estar em vários (uma falésia é costa E altitude E rocha), e é
// isso que faz o teste ser exigente sem ser burro.
export const GRUPOS_DE_HABITAT = [
  "mata", "campo", "brejo", "gelo", "vulcanico", "deserto", "costa",
  "agua_aberta", "altitude", "rocha", "caverna", "ruina", "urbano",
  "ossario", "veu",
];

export const GRUPO_POR_BIOMA = {
  "campo cultivado": ["campo"],
  "bosque claro": ["mata", "campo"],
  "mata de raízes antigas": ["mata"],
  "planície cultivada": ["campo"],
  "alta montanha glacial": ["gelo", "altitude", "rocha"],
  "vale glacial": ["gelo", "rocha"],
  "brejo gelado": ["gelo", "brejo"],
  "caldeira vulcânica": ["vulcanico", "rocha"],
  "encosta minerada": ["vulcanico", "rocha", "caverna"],
  "campo de cinzas": ["vulcanico", "deserto"],
  "mata primordial": ["mata"],
  "lago de mata fechada": ["mata", "agua_aberta", "brejo"],
  "clareira murada por árvores": ["mata"],
  "planície alta": ["campo", "altitude"],
  "cânion de correntes": ["altitude", "rocha"],
  "cidade morta": ["ruina", "urbano", "veu"],
  "ruína de engrenagem": ["ruina", "caverna"],
  "colina ensolarada": ["campo", "ruina"],
  "terra arrasada": ["vulcanico", "deserto"],
  "cânion minerado": ["vulcanico", "rocha", "caverna"],
  "floresta de pedra": ["deserto", "rocha", "ruina"],
  "duna aberta": ["deserto"],
  "oásis": ["deserto", "campo", "agua_aberta"],
  "ruína sob a areia": ["deserto", "ruina"],
  "praia rochosa": ["costa", "rocha"],
  "falésia": ["costa", "altitude", "rocha"],
  "recife": ["costa", "agua_aberta"],
  "banco de coral": ["costa", "agua_aberta"],
  "ilha lacustre": ["agua_aberta", "ruina"],
  "margem de lago": ["agua_aberta", "campo", "brejo"],
  "brejo fechado": ["brejo"],
  "campo de fungos": ["brejo", "caverna"],
  "brejo raso": ["brejo"],
  "selva escura": ["mata", "veu"],
  "clareira ritual": ["mata", "veu"],
  "vale rochoso": ["rocha", "campo"],
  "planície de ossos": ["ossario", "campo"],
  "monumento vivo": ["ossario", "rocha", "ruina"],
  "encosta cavernosa": ["caverna", "rocha"],
  "campo abandonado": ["veu", "ruina", "campo"],
  "vão fraturado": ["veu", "rocha", "ossario"],
  "pico escuro": ["veu", "altitude", "rocha"],
  "penhasco de altitude": ["altitude", "rocha"],
  "ilha flutuante": ["altitude", "campo"],
  "vórtice oceânico": ["agua_aberta", "veu"],
  "fim do mundo conhecido": ["veu", "ruina", "altitude", "agua_aberta"],
  "plataforma submersa": ["agua_aberta", "costa", "ruina"],
  "planalto monumental": ["ossario", "rocha", "ruina"],
};

export const AMEACAS = ["passiva", "territorial", "agressiva", "apice"];

export const ECOLOGIA = {
  // --- floresta e mata ------------------------------------------------
  slime: { habitats: ["brejo", "campo", "mata"], horario: "sempre", clima: ["chuva"], climaFoge: ["nevasca"], dieta: ["vegetacao"], ameaca: "passiva", eter: 2, grupo: [1, 3], descoberta: "residuo magico" },
  morcego: { habitats: ["campo", "caverna", "mata", "rocha", "ruina"], horario: "noite", clima: [], climaFoge: ["tempestade"], dieta: ["abelha_titan", "vegetacao"], ameaca: "passiva", eter: 1, grupo: [2, 4], descoberta: "eco" },
  lobo: { habitats: ["campo", "mata", "ruina"], horario: "noite", clima: ["neblina"], climaFoge: [], dieta: ["javali", "slime", "rato_gigante"], ameaca: "agressiva", eter: 1, grupo: [2, 4], descoberta: "matilha" },
  javali: { habitats: ["campo", "mata", "veu"], horario: "manha", clima: ["chuva"], climaFoge: ["tempestade"], dieta: ["vegetacao"], ameaca: "territorial", eter: 3, grupo: [1, 2], descoberta: "trilha de focinho" },
  rato_gigante: { habitats: ["brejo", "campo", "deserto", "ruina", "urbano", "veu"], horario: "noite", clima: [], climaFoge: [], dieta: ["vegetacao", "carnica"], ameaca: "passiva", eter: 0, grupo: [2, 5], descoberta: "ninhada" },
  abelha_titan: { habitats: ["brejo", "campo", "caverna", "mata"], horario: "tarde", clima: ["limpo"], climaFoge: ["chuva", "nevasca"], dieta: ["vegetacao"], ameaca: "territorial", eter: 2, grupo: [1, 3], descoberta: "colmeia" },
  corvo_ceifador: { habitats: ["campo", "mata", "ossario", "rocha", "ruina", "veu"], horario: "tarde", clima: ["neblina"], climaFoge: [], dieta: ["carnica", "rato_gigante"], ameaca: "agressiva", eter: 2, grupo: [2, 4], descoberta: "bando sobre carnica" },
  urso_ancestral: { habitats: ["caverna", "mata", "rocha"], horario: "manha", clima: [], climaFoge: ["tempestade"], dieta: ["javali", "lobo", "vegetacao"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "marca de garra em tronco" },
  guardiao_das_raizes: { habitats: ["campo", "mata"], horario: "sempre", clima: [], climaFoge: [], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "raiz que se move" },
  wisp_radiante: { habitats: ["agua_aberta", "brejo", "campo", "mata"], horario: "noite", clima: ["neblina"], climaFoge: ["vento_forte"], dieta: ["eter"], ameaca: "passiva", eter: 3, grupo: [1, 3], descoberta: "luz sem fonte" },
  druida_corrompido: { habitats: ["brejo", "caverna", "mata", "veu"], horario: "tarde", clima: ["chuva"], climaFoge: [], dieta: ["eter", "vegetacao"], ameaca: "agressiva", eter: 3, grupo: [1, 2], descoberta: "circulo de plantas mortas" },
  aranha_gigante: { habitats: ["brejo", "caverna", "mata", "rocha", "ruina", "urbano", "veu"], horario: "noite", clima: [], climaFoge: ["vento_forte"], dieta: ["morcego", "rato_gigante", "abelha_titan"], ameaca: "territorial", eter: 0, grupo: [1, 3], descoberta: "teia estrutural" },
  lobo_sombrio: { habitats: ["campo", "mata", "ossario", "rocha", "ruina", "veu"], horario: "noite", clima: ["neblina"], climaFoge: ["limpo"], dieta: ["javali", "lobo"], ameaca: "agressiva", eter: 2, grupo: [2, 4], descoberta: "sombra que sobra" },
  devoradora_de_sombras: { habitats: ["mata", "veu"], horario: "noite", clima: ["neblina"], climaFoge: ["limpo"], dieta: ["lobo_sombrio", "carnica"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "ausencia de som" },
  tirano_do_charco: { habitats: ["brejo"], horario: "sempre", clima: ["chuva"], climaFoge: [], dieta: ["sapo_venenoso", "lodo_negro"], ameaca: "apice", eter: 2, grupo: [1, 1], descoberta: "agua que abre" },
  matriarca_ursina: { habitats: ["mata"], horario: "manha", clima: [], climaFoge: [], dieta: ["javali", "urso_ancestral"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "territorio sem outros ursos" },

  // --- pântano ---------------------------------------------------------
  sapo_venenoso: { habitats: ["brejo", "caverna", "gelo"], horario: "noite", clima: ["chuva"], climaFoge: ["limpo"], dieta: ["abelha_titan"], ameaca: "passiva", eter: 1, grupo: [2, 4], descoberta: "coaxar em coro" },
  lodo_negro: { habitats: ["brejo", "caverna"], horario: "sempre", clima: ["chuva", "neblina"], climaFoge: [], dieta: ["carnica", "vegetacao"], ameaca: "territorial", eter: 2, grupo: [1, 3], descoberta: "lodo que sobe" },
  bruxa_do_lodo_eterno: { habitats: ["brejo", "caverna"], horario: "noite", clima: ["neblina"], climaFoge: [], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "fungo em circulo perfeito" },
  bruxa_da_bruma: { habitats: ["brejo", "gelo", "ossario", "rocha", "veu"], horario: "noite", clima: ["neblina", "nevasca"], climaFoge: ["limpo"], dieta: ["eter"], ameaca: "agressiva", eter: 3, grupo: [1, 2], descoberta: "bruma sem vento" },
  matriarca_da_bruma_eterna: { habitats: ["brejo", "gelo"], horario: "noite", clima: ["neblina"], climaFoge: ["limpo"], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "bruma que segue" },

  // --- neve e montanha --------------------------------------------------
  lobo_gelido: { habitats: ["altitude", "brejo", "gelo", "rocha", "veu"], horario: "noite", clima: ["nevasca"], climaFoge: [], dieta: ["javali", "touro_selvagem"], ameaca: "agressiva", eter: 1, grupo: [2, 4], descoberta: "pegada sem degelo" },
  troll_das_cavernas: { habitats: ["altitude", "campo", "caverna", "gelo", "rocha"], horario: "noite", clima: [], climaFoge: ["limpo"], dieta: ["carnica", "golem_de_pedra"], ameaca: "agressiva", eter: 0, grupo: [1, 2], descoberta: "osso quebrado em pilha" },
  golem_de_pedra: { habitats: ["altitude", "campo", "caverna", "gelo", "ossario", "rocha", "ruina", "vulcanico"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "territorial", eter: 2, grupo: [1, 2], descoberta: "pedra fora do lugar" },
  gargula: { habitats: ["altitude", "caverna", "deserto", "rocha", "ruina", "urbano", "veu", "vulcanico"], horario: "noite", clima: [], climaFoge: [], dieta: [], ameaca: "territorial", eter: 2, grupo: [1, 3], descoberta: "estatua que faltava" },
  senhor_sombrio_da_montanha: { habitats: ["altitude", "gelo", "rocha"], horario: "noite", clima: ["nevasca"], climaFoge: [], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "trono vazio" },
  colosso_das_pedras_cinzentas: { habitats: ["campo", "rocha"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "apice", eter: 2, grupo: [1, 1], descoberta: "passo que treme o chao" },
  troll_anciao_do_eco: { habitats: ["caverna", "rocha"], horario: "noite", clima: [], climaFoge: [], dieta: ["carnica"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "eco que responde errado" },
  rei_petrificado: { habitats: ["ossario", "rocha", "ruina"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "coroa de pedra quente" },

  // --- vulcânico --------------------------------------------------------
  senhor_da_cinza: { habitats: ["agua_aberta", "altitude", "caverna", "deserto", "rocha", "ruina", "veu", "vulcanico"], horario: "sempre", clima: [], climaFoge: ["chuva"], dieta: ["eter"], ameaca: "agressiva", eter: 2, grupo: [1, 2], descoberta: "cinza que anda contra o vento" },
  carrasco_de_cinzas: { habitats: ["deserto", "ossario", "rocha", "veu", "vulcanico"], horario: "sempre", clima: [], climaFoge: ["chuva"], dieta: ["carnica"], ameaca: "agressiva", eter: 2, grupo: [1, 1], descoberta: "marca de queima em fila" },
  arauto_das_cinzas: { habitats: ["deserto", "rocha", "vulcanico"], horario: "noite", clima: [], climaFoge: ["chuva"], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "sino sem badalo" },
  dragao_jovem: { habitats: ["caverna", "deserto", "rocha", "vulcanico"], horario: "tarde", clima: ["limpo"], climaFoge: ["chuva", "nevasca"], dieta: ["touro_selvagem", "javali"], ameaca: "apice", eter: 2, grupo: [1, 1], descoberta: "casca de ovo grande" },
  dragao_anciao_das_cinzas: { habitats: ["deserto", "vulcanico"], horario: "sempre", clima: [], climaFoge: [], dieta: ["dragao_jovem", "carnica"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "vale sem nenhum outro predador" },
  senhor_das_chamas_errantes: { habitats: ["rocha", "vulcanico"], horario: "noite", clima: [], climaFoge: ["chuva"], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "fogo que nao consome" },

  // --- deserto ----------------------------------------------------------
  escorpiao_gigante: { habitats: ["deserto", "rocha", "ruina", "vulcanico"], horario: "noite", clima: ["limpo"], climaFoge: ["chuva"], dieta: ["verme_das_dunas", "rato_gigante"], ameaca: "agressiva", eter: 0, grupo: [1, 3], descoberta: "toca em meia-lua" },
  verme_das_dunas: { habitats: ["deserto", "ruina"], horario: "tarde", clima: ["vento_forte"], climaFoge: ["chuva"], dieta: ["vegetacao", "carnica"], ameaca: "territorial", eter: 1, grupo: [1, 2], descoberta: "areia que respira" },
  bandido: { habitats: ["agua_aberta", "campo", "costa", "deserto", "mata", "rocha", "ruina", "veu"], horario: "tarde", clima: [], climaFoge: ["tempestade", "nevasca"], dieta: [], ameaca: "agressiva", eter: 0, grupo: [2, 3], descoberta: "acampamento apressado" },
  rainha_escorpiao_de_karn: { habitats: ["deserto"], horario: "noite", clima: [], climaFoge: ["chuva"], dieta: ["escorpiao_gigante"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "ninho com carapacas" },
  esqueleto: { habitats: ["campo", "deserto", "ossario", "rocha", "ruina", "urbano", "veu"], horario: "noite", clima: [], climaFoge: [], dieta: [], ameaca: "agressiva", eter: 2, grupo: [2, 4], descoberta: "ossada incompleta" },

  // --- costa e água -----------------------------------------------------
  caranguejo_gigante: { habitats: ["agua_aberta", "costa", "rocha", "ruina"], horario: "manha", clima: [], climaFoge: ["tempestade"], dieta: ["carnica", "vegetacao"], ameaca: "territorial", eter: 0, grupo: [1, 3], descoberta: "carapaca vazia" },
  serpente_marinha: { habitats: ["agua_aberta", "costa", "ruina", "veu"], horario: "noite", clima: ["tempestade", "chuva"], climaFoge: [], dieta: ["caranguejo_gigante", "enguia_eletrica"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "muda de pele" },
  enguia_eletrica: { habitats: ["agua_aberta", "brejo", "campo", "costa", "ruina"], horario: "noite", clima: ["tempestade"], climaFoge: ["limpo"], dieta: ["vegetacao"], ameaca: "passiva", eter: 1, grupo: [2, 4], descoberta: "agua que formiga" },
  arraia_relampago: { habitats: ["agua_aberta", "costa", "ruina", "veu"], horario: "tarde", clima: ["tempestade"], climaFoge: [], dieta: ["enguia_eletrica"], ameaca: "agressiva", eter: 2, grupo: [1, 2], descoberta: "sombra plana rasa" },
  pirata_naufrago: { habitats: ["agua_aberta", "altitude", "costa", "rocha", "ruina", "veu"], horario: "noite", clima: ["neblina"], climaFoge: [], dieta: [], ameaca: "agressiva", eter: 1, grupo: [2, 3], descoberta: "destroco reaproveitado" },
  capita_mare_negra: { habitats: ["agua_aberta", "costa"], horario: "noite", clima: ["tempestade"], climaFoge: [], dieta: [], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "bandeira remendada" },
  serpente_da_tempestade_eterna: { habitats: ["agua_aberta", "veu"], horario: "sempre", clima: ["tempestade"], climaFoge: [], dieta: ["arraia_relampago", "serpente_marinha"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "olho de tempestade parado" },

  // --- vento e altitude -------------------------------------------------
  harpia: { habitats: ["altitude", "campo", "costa", "gelo", "rocha"], horario: "manha", clima: ["vento_forte"], climaFoge: ["nevasca"], dieta: ["morcego", "javali"], ameaca: "agressiva", eter: 1, grupo: [2, 3], descoberta: "ninho em fenda alta" },
  grifo_jovem: { habitats: ["altitude", "campo", "rocha"], horario: "manha", clima: ["limpo", "vento_forte"], climaFoge: ["tempestade"], dieta: ["harpia", "touro_selvagem"], ameaca: "territorial", eter: 1, grupo: [1, 2], descoberta: "pena de duas cores" },
  grifo_alfa_dos_ventos: { habitats: ["altitude", "campo"], horario: "manha", clima: ["vento_forte"], climaFoge: [], dieta: ["grifo_jovem"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "ninho no ponto mais alto" },
  gralha_tempestuosa: { habitats: ["altitude", "campo", "costa", "rocha"], horario: "tarde", clima: ["tempestade", "vento_forte"], climaFoge: ["limpo"], dieta: ["carnica", "vegetacao"], ameaca: "passiva", eter: 2, grupo: [3, 5], descoberta: "bando antes da tempestade" },
  wyvern: { habitats: ["altitude", "deserto", "gelo", "rocha", "veu", "vulcanico"], horario: "tarde", clima: ["vento_forte"], climaFoge: ["neblina"], dieta: ["touro_selvagem", "grifo_jovem"], ameaca: "agressiva", eter: 1, grupo: [1, 2], descoberta: "marca de pouso em rocha" },
  matriarca_wyvern_das_falesias: { habitats: ["altitude", "rocha"], horario: "tarde", clima: [], climaFoge: [], dieta: ["wyvern"], ameaca: "apice", eter: 1, grupo: [1, 1], descoberta: "penhasco com ossada limpa" },
  touro_selvagem: { habitats: ["altitude", "campo", "rocha", "ruina"], horario: "manha", clima: ["limpo"], climaFoge: ["tempestade"], dieta: ["vegetacao"], ameaca: "territorial", eter: 3, grupo: [1, 3], descoberta: "pasto pisoteado em circulo" },

  // --- arcano e Véu -----------------------------------------------------
  cristal_ecoante: { habitats: ["agua_aberta", "brejo", "campo", "caverna", "rocha", "ruina", "urbano", "veu"], horario: "sempre", clima: [], climaFoge: [], dieta: ["eter"], ameaca: "passiva", eter: 3, grupo: [1, 3], descoberta: "som repetido com atraso" },
  sentinela_dourada: { habitats: ["campo", "caverna", "ruina", "urbano", "veu"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "territorial", eter: 2, grupo: [1, 2], descoberta: "postura de guarda sem guarda" },
  sentinela_arcana: { habitats: ["caverna", "deserto", "ruina", "urbano", "veu"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "agressiva", eter: 3, grupo: [1, 2], descoberta: "ordem antiga ainda cumprida" },
  construto_arcano: { habitats: ["agua_aberta", "altitude", "caverna", "ruina", "veu"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "agressiva", eter: 3, grupo: [1, 1], descoberta: "peca de outra maquina" },
  espectro_arcano: { habitats: ["agua_aberta", "campo", "ossario", "rocha", "ruina", "urbano", "veu"], horario: "noite", clima: ["neblina"], climaFoge: ["limpo"], dieta: ["eter"], ameaca: "agressiva", eter: 3, grupo: [1, 3], descoberta: "reflexo atrasado" },
  necromante_errante: { habitats: ["altitude", "campo", "deserto", "ossario", "rocha", "ruina", "veu", "vulcanico"], horario: "noite", clima: ["neblina"], climaFoge: [], dieta: [], ameaca: "agressiva", eter: 3, grupo: [1, 2], descoberta: "ossada arrumada" },
  cavaleiro_caido_de_aethra: { habitats: ["campo", "ossario", "rocha", "ruina", "veu"], horario: "noite", clima: [], climaFoge: [], dieta: [], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "armadura sem ferrugem" },
  guardiao_arcano_das_ruinas: { habitats: ["ruina", "urbano", "veu"], horario: "sempre", clima: [], climaFoge: [], dieta: [], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "porta que so abre uma vez" },
  paladino_do_sol_poente: { habitats: ["campo", "ruina"], horario: "tarde", clima: ["limpo"], climaFoge: [], dieta: [], ameaca: "apice", eter: 2, grupo: [1, 1], descoberta: "sombra longa demais" },
  imperador_arcano_dos_confins: { habitats: ["agua_aberta", "altitude", "ruina", "veu"], horario: "sempre", clima: [], climaFoge: [], dieta: ["eter"], ameaca: "apice", eter: 3, grupo: [1, 1], descoberta: "fim do mapa" },

  // --- humanoides errantes ----------------------------------------------
  goblin: { habitats: ["campo", "caverna", "mata", "rocha", "veu"], horario: "tarde", clima: [], climaFoge: ["nevasca"], dieta: ["carnica", "vegetacao"], ameaca: "agressiva", eter: 0, grupo: [2, 4], descoberta: "armadilha malfeita" },
  orc_selvagem: { habitats: ["campo", "caverna", "mata", "ossario", "rocha", "veu", "vulcanico"], horario: "tarde", clima: [], climaFoge: [], dieta: ["goblin", "carnica"], ameaca: "agressiva", eter: 0, grupo: [1, 3], descoberta: "totem de caça" },
};

// --- Migração (item 24) ----------------------------------------------------
// Uma migração é uma regra declarada: sob tal condição, tais espécies somem de
// tais zonas e aparecem em tais outras. Não é aleatória e não roda em tempo
// real — é consultada quando o jogo precisa saber o pool de uma zona.
export const MIGRACOES = [
  {
    id: "mig_tempestade_eter_altaverde",
    nome: "Fuga do Bosque das Vozes",
    causa: { tipo: "eventoAtivo", id: "ev_tempestade_eter_altaverde" },
    // Sensíveis ao Éter (eter 3) abandonam as zonas atingidas...
    saemDe: ["bosque_das_vozes", "floresta"],
    especies: ["javali", "touro_selvagem", "abelha_titan"],
    vaoPara: ["campos_de_elyndor"],
    efeito: "A caça some da mata e se acumula no campo aberto, onde não há cobertura — e onde o lobo a segue.",
    seguem: ["lobo"],
  },
  {
    id: "mig_branqueamento_recife",
    nome: "Cardume fora de rota",
    causa: { tipo: "worldState", chave: "recife_estado", valor: "branqueado" },
    saemDe: ["jardins_de_perola", "recife_tempestades"],
    especies: ["caranguejo_gigante", "enguia_eletrica"],
    vaoPara: ["abismo_raso"],
    efeito: "O coral branqueado deixa de abrigar; o que comia ali vai para a plataforma submersa, longe da rede dos pescadores.",
    seguem: ["serpente_marinha"],
  },
  {
    id: "mig_coracao_quente",
    nome: "Fuga do Coração",
    causa: { tipo: "worldState", chave: "coracao_petrificado_estado", valor: "quente" },
    saemDe: ["coracao_petrificado"],
    especies: ["golem_de_pedra"],
    vaoPara: ["vale_pedras", "caverna_eco"],
    efeito: "A pedra do monumento esquenta e os golens descem para o vale — bem em cima da frente de escavação.",
    seguem: [],
  },
  {
    id: "mig_nevasca_morranvell",
    nome: "Descida do lobo gélido",
    causa: { tipo: "clima", id: "nevasca", zonas: ["trono_congelado"] },
    saemDe: ["trono_congelado"],
    especies: ["lobo_gelido"],
    vaoPara: ["vale_das_geleiras", "pantano_bruma"],
    efeito: "Na nevasca a matilha desce da alta montanha e chega perto da Fortaleza do Gelo.",
    seguem: [],
  },
];

// --- Consultas -------------------------------------------------------------
const ZONA_POR_ID = new Map(ZONAS_MUNDO.map((z) => [z.id, z]));

export const ecologiaDe = (especieId) => ECOLOGIA[especieId] || null;

export const gruposDoBioma = (bioma) => GRUPO_POR_BIOMA[bioma] || [];

export function habitatCombina(especieId, zonaId) {
  const e = ECOLOGIA[especieId];
  const z = ZONA_POR_ID.get(zonaId);
  if (!e || !z) return false;
  return gruposDoBioma(z.bioma).some((g) => e.habitats.includes(g));
}

// Quem come esta espécie — derivado de `dieta`, nunca declarado à mão.
export function predadoresDe(especieId) {
  return Object.entries(ECOLOGIA)
    .filter(([, e]) => e.dieta.includes(especieId))
    .map(([id]) => id);
}

// Quem come quem, montado a partir de `dieta`/`predadores` — as duas pontas
// precisam concordar, e o teste cobra isso.
export function cadeiaAlimentar() {
  const pares = [];
  Object.entries(ECOLOGIA).forEach(([id, e]) => {
    e.dieta.filter((d) => ECOLOGIA[d]).forEach((presa) => pares.push({ predador: id, presa }));
  });
  return pares;
}

export function migracoesQueAfetam(zonaId) {
  return MIGRACOES.filter((m) => m.saemDe.includes(zonaId) || m.vaoPara.includes(zonaId));
}

export const ESPECIES_SENSIVEIS_AO_ETER = Object.entries(ECOLOGIA)
  .filter(([, e]) => e.eter >= 3).map(([id]) => id);
