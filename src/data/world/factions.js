// FACÇÕES E PRESENÇA REGIONAL (ETAPA 3, itens 13, 14 e 15).
//
// O ACHADO DA AUDITORIA
// ---------------------
// O pedido listou como referência: Círculo de Elyndor, Ordem da Chama Rubra,
// Navegadores de Maris, Liga dos Ventos, Clãs de Morranvell, Tribos
// Umbríacas, Cultistas do Éter, Arquivistas e Sem-Nome — com a instrução
// "validar no cânone". Validei, e o projeto tem DUAS listas de facção, não
// uma:
//
//   1. A MECÂNICA (src/data/worldStateVariables.json): 10 facções + "vila",
//      com reputação de verdade, cinco tiers, zonas de domínio, e — o que
//      mais pesa — os 100 personagens do gacha filiados a elas por
//      `facaoId`. Guardiões da Folha Verde, Coroa de Aethra, Legião das
//      Cinzas, Ordem dos Arquivistas Perdidos, Forja dos Anões Cinzentos,
//      Caravana de Karn, Confraria do Farol, Andarilhos do Pântano, Clã dos
//      Ventos Dourados, Cavaleiros do Vento Uivante.
//
//   2. A DO ATLAS (src/data/atlasRegions.js, campo `presencaDominante`): 17
//      nomes de presença por região, escritos a partir do Livro da
//      Mitologia. É AQUI que moram os nomes do pedido — Círculo de Elyndor,
//      Navegadores de Maris, Liga dos Ventos, Clãs de Morranvell, Tribos
//      Umbríacas, Ordem da Chama Rubra, Cultistas do Éter.
//
// Das nove do pedido, oito existem na lista 2 e nenhuma na lista 1, com uma
// exceção: "Arquivistas" é a Ordem dos Arquivistas Perdidos, que existe nas
// duas. "Sem-Nome" não aparece em lugar nenhum do projeto — e não foi
// inventada aqui.
//
// A DECISÃO
// ---------
// Não renomear nada, dos dois lados. A facção MECÂNICA continua sendo quem
// carrega reputação (é ela que o save conhece e a que os 100 convocados
// pertencem); o nome do atlas passa a ser a CARA PÚBLICA daquela facção
// naquela região. Não é contradição — é como uma ordem se chama por dentro e
// como o povo a chama por fora. Onde uma presença do atlas não tem facção
// mecânica correspondente, ela fica declarada como presença sem reputação, e
// o teste cobra que isso esteja explícito em vez de escondido.
//
// A OUTRA CORREÇÃO
// ----------------
// As `zonas` de cada facção em worldStateVariables.json listavam só as 22
// zonas da ETAPA 1. Com 48 zonas, 26 ficaram sem dono — território sem
// facção é território onde reputação não muda nada. A tabela abaixo cobre as
// 48, e o teste confere.
import { ZONAS_MUNDO } from "./zones.js";
import { ATLAS_REGIONS } from "../atlasRegions.js";

// Domínio de cada facção mecânica, agora sobre as 48 zonas. As 22 originais
// mantêm exatamente o dono que worldStateVariables.json já declarava — o
// teste compara uma a uma. O que se acrescentou foram as 26 novas.
export const DOMINIO_FACCAO = {
  coroa_de_aethra: ["vila", "campos_de_elyndor"],
  guardioes_da_folha: [
    "floresta", "bosque_sombrio", "floresta_ancestral", "bosque_petrificado",
    "bosque_das_vozes", "lago_dos_reflexos", "portao_verde", "arvore_oca",
  ],
  cla_dos_ventos_dourados: ["colinas_douradas", "planicie_ventosa", "pontes_suspensas"],
  andarilhos_do_pantano: [
    "pantano_negro", "charco_fetido", "pantano_bruma", "jardim_fungico",
  ],
  confraria_do_farol: [
    "costa_aurora", "recife_tempestades", "falesias_das_correntes",
    "jardins_de_perola", "abismo_raso",
  ],
  caravana_de_karn: ["deserto_karn", "deserto_ardente", "oasis_sete_sombras", "areias_soterradas"],
  forja_dos_anoes_cinzentos: [
    "vale_pedras", "caverna_eco", "montanha_sombria", "mina_carmesim",
    "mina_ferro_negro", "cratera_primeiro_fogo",
    // Estas cinco não pertenciam a facção nenhuma: sem dono não há reputação
    // regional, nem desconto do mercador itinerante, nem emboscada quando o
    // herói é malvisto ali. As três do Vale dos Titãs ficam com a Forja porque
    // as outras duas zonas da mesma região já eram dela; as duas de Morranvell
    // são a fortaleza de gelo e a mina, território dos mesmos anões (ver os
    // NPCs de morranvell: clãs, Mina Alta, salão).
    "arena_ossea", "coracao_petrificado", "templo_dos_titas",
    "trono_congelado", "vale_das_geleiras",
  ],
  ordem_dos_arquivistas: [
    "terras_esquecidas", "ruinas_aethra", "labirinto_mecanico",
    "ilha_do_prisma", "margem_prismatica",
  ],
  cavaleiros_do_vento_uivante: ["falesias_fim", "jardim_das_nuvens"],
  legiao_das_cinzas: [
    "covil_do_dragao", "confins_aethra", "vale_dos_lamentos", "olho_do_abismo",
  ],
  // Morranvell e o Vale dos Titãs não pertencem a nenhuma das dez facções
  // mecânicas — e isso é um fato do projeto, não um esquecimento. Ficam
  // declarados aqui com a presença do atlas e SEM reputação, o que é a
  // resposta honesta enquanto não houver facção mecânica para eles.
  //   trono_congelado, vale_das_geleiras  → Clãs de Morranvell (só lore)
  //   arena_ossea, coracao_petrificado,
  //   templo_dos_titas                    → Peregrinos dos Ossos (só lore)
};

// Presenças do atlas que NÃO têm facção mecânica. Declaradas de propósito:
// elas existem no mundo, dão nome e cultura à região, e não movem reputação.
export const PRESENCAS_SEM_REPUTACAO = {
  morranvell: "Clãs de Morranvell",
  vale_dos_titas: "Peregrinos dos Ossos",
  lago_prismatico: "Sacerdotes das Águas",
  abismo_de_nazthal: "Nenhuma facção controla o local",
};

// Identidade de cada facção mecânica: o que ela quer, com quem anda, de quem
// não gosta, o que produz e como se apresenta em cada região (item 14).
//
// `armas` liga cultura a equipamento (item 30). `postos` são os
// assentamentos em que ela manda de fato.
export const FACCOES = {
  coroa_de_aethra: {
    nome: "Coroa de Aethra",
    caraPublica: { altaverde: "Círculo de Elyndor" },
    proposito: "manter o que sobrou de administração central depois da queda das Cidades-Luz",
    postos: ["vila_de_aethra"],
    aliados: ["guardioes_da_folha", "ordem_dos_arquivistas"],
    rivais: ["legiao_das_cinzas"],
    conflito: "cobra imposto de vilas que já não rendem, e sabe disso",
    recursos: ["grão", "milícia", "selo de autoridade"],
    armas: "espada reta e escudo de guarnição — equipamento de tropa, não de herói",
    servicos: ["missoes", "recompensa"],
  },
  guardioes_da_folha: {
    nome: "Guardiões da Folha Verde",
    caraPublica: {
      altaverde: "Círculo de Elyndor",
      bosque_eterno: "Guardiões da Névoa",
      selva_umbriaca: "Tribos Umbríacas",
    },
    proposito: "impedir que a mata seja cortada mais rápido do que consegue crescer",
    postos: ["acampamento_dos_lenhadores", "aldeia_dos_cacadores"],
    aliados: ["coroa_de_aethra", "andarilhos_do_pantano"],
    rivais: ["forja_dos_anoes_cinzentos", "legiao_das_cinzas"],
    conflito: "a licença de corte do acampamento dos lenhadores é considerada inválida por eles",
    recursos: ["madeira antiga", "erva rara", "guia de mata"],
    armas: "arco longo e lâmina curva de madeira endurecida",
    servicos: ["cura", "guia", "erva"],
  },
  cla_dos_ventos_dourados: {
    nome: "Clã dos Ventos Dourados",
    caraPublica: { vale_do_vento: "Liga dos Ventos" },
    proposito: "manter as rotas abertas e cobrar por isso sem parecer que cobra",
    postos: ["cidade_de_aerwind"],
    aliados: ["caravana_de_karn", "cavaleiros_do_vento_uivante"],
    rivais: ["ordem_dos_arquivistas"],
    conflito: "o exílio é a punição padrão, e a fila de exilados virou um problema político",
    recursos: ["escolta", "correio", "contrato"],
    armas: "lança leve e funda — arma de quem luta montado ou no vento",
    servicos: ["escolta", "correio", "viagem"],
  },
  andarilhos_do_pantano: {
    nome: "Andarilhos do Pântano",
    caraPublica: { pantano_de_thalgor: "Clãs do Lodo" },
    proposito: "atravessar o pântano sem morrer e vender esse conhecimento",
    postos: ["aldeia_sombria"],
    aliados: ["guardioes_da_folha"],
    rivais: ["cla_dos_ventos_dourados"],
    conflito: "as passarelas apodrecem mais rápido do que se conserta, e ninguém paga a conta",
    recursos: ["fungo", "alquimia", "passagem segura"],
    armas: "foice de junco e zarabatana — nada que pese na lama",
    servicos: ["alquimia", "guia", "veneno"],
  },
  confraria_do_farol: {
    nome: "Confraria do Farol",
    caraPublica: {
      costa_da_mare: "Navegadores de Maris",
      recife_coralino: "Cidades de Coral",
    },
    proposito: "decidir quem chega vivo ao porto, e vender o mapa que diz como",
    postos: ["porto_de_maris", "cidade_de_corallia", "acampamento_dos_pescadores"],
    aliados: ["caravana_de_karn"],
    rivais: ["cavaleiros_do_vento_uivante"],
    conflito: "alguém anda copiando as melhores cartas de navegação",
    recursos: ["carta náutica", "frete", "pérola"],
    armas: "sabre curvo e arpão — armas de convés, sem espaço para se armar",
    servicos: ["viagem", "mapa", "loja"],
  },
  caravana_de_karn: {
    nome: "Caravana de Karn",
    caraPublica: { deserto_de_arenth: "Casas de Arenth" },
    proposito: "manter a rota comercial funcionando mesmo quando a tempestade a apaga",
    postos: ["posto_da_caravana", "posto_do_oasis"],
    aliados: ["confraria_do_farol", "cla_dos_ventos_dourados"],
    rivais: ["ordem_dos_arquivistas"],
    conflito: "vende água a peso de metal e chama isso de logística",
    recursos: ["água", "sal", "informação de rota"],
    armas: "cimitarra e adaga de cinto — arma que se saca depressa",
    servicos: ["loja", "viagem", "informacao"],
  },
  forja_dos_anoes_cinzentos: {
    nome: "Forja dos Anões Cinzentos",
    caraPublica: { montanhas_de_vulkor: "Forjadores de Vulkor" },
    proposito: "tirar da rocha o que a rocha não quer entregar",
    postos: ["fortaleza_de_ignis", "acampamento_dos_mineiros"],
    aliados: ["ordem_dos_arquivistas"],
    rivais: ["guardioes_da_folha"],
    conflito: "arma despertada não escolhe portador com critério, e eles fabricam assim mesmo",
    recursos: ["ferro negro", "metal vivo", "runa de forja"],
    armas: "martelo pesado e machado de duas mãos, gravados com runa",
    servicos: ["forja", "aprimoramento", "runa"],
  },
  ordem_dos_arquivistas: {
    nome: "Ordem dos Arquivistas Perdidos",
    caraPublica: {
      ruinas_de_aethra: "Cultistas do Éter",
      sombralith: "Corte das Sombras",
      lago_prismatico: "Sacerdotes das Águas",
    },
    proposito: "catalogar tudo que a Era das Cidades-Luz deixou antes que apague",
    postos: ["posto_avancado_da_ordem", "cidade_das_sombras"],
    aliados: ["coroa_de_aethra", "forja_dos_anoes_cinzentos"],
    rivais: ["caravana_de_karn", "cla_dos_ventos_dourados"],
    conflito: "as máquinas das ruínas ainda obedecem a alguém, e a Ordem não diz a quem",
    recursos: ["registro antigo", "cristal de Éter", "tradução"],
    armas: "cajado de foco e adaga ritual — instrumento antes de arma",
    servicos: ["pesquisa", "traducao", "arcano"],
  },
  cavaleiros_do_vento_uivante: {
    nome: "Cavaleiros do Vento Uivante",
    caraPublica: { arquipelago_de_nuvens: "Clãs Celestes" },
    proposito: "guardar as travessias altas e decidir quem passa por elas",
    postos: ["cidade_flutuante"],
    aliados: ["cla_dos_ventos_dourados"],
    rivais: ["confraria_do_farol"],
    conflito: "a ilha migra e metade dos tratados venceu no caminho",
    recursos: ["cristal de vento", "travessia", "ninho de grifo"],
    armas: "lança de arremesso e escudo leve — peso é inimigo em altitude",
    servicos: ["viagem", "montaria", "escolta"],
  },
  legiao_das_cinzas: {
    nome: "Legião das Cinzas",
    caraPublica: { canon_rubro: "Ordem da Chama Rubra" },
    proposito: "provar que transformar pelo fogo purifica — inclusive pessoas",
    postos: ["fortaleza_ignea"],
    aliados: [],
    rivais: ["coroa_de_aethra", "guardioes_da_folha"],
    conflito: "a Ordem discute internamente se a doutrina vale para gente, e a discussão está perdendo",
    recursos: ["carvão", "aço temperado", "doutrina"],
    armas: "espadão de duas mãos e braseiro de guerra",
    servicos: ["forja", "treino"],
  },
  vila: {
    nome: "Vila",
    caraPublica: {},
    proposito: "simpatia popular — não é uma organização, é o que as pessoas comuns acham de você",
    postos: [],
    aliados: [],
    rivais: [],
    conflito: null,
    recursos: [],
    armas: null,
    servicos: ["loja", "descanso"],
    naoEhOrganizacao: true,
  },
};

// --- Consultas -------------------------------------------------------------
const FACCAO_POR_ZONA = new Map();
Object.entries(DOMINIO_FACCAO).forEach(([fid, zonas]) => zonas.forEach((z) => FACCAO_POR_ZONA.set(z, fid)));

export const faccaoDaZonaMundo = (zonaId) => FACCAO_POR_ZONA.get(zonaId) || null;

export function faccoesDaRegiao(regiaoId) {
  const ids = new Set();
  ZONAS_MUNDO.filter((z) => z.regiaoId === regiaoId).forEach((z) => {
    const f = faccaoDaZonaMundo(z.id);
    if (f) ids.add(f);
  });
  return [...ids];
}

// Nome pelo qual a facção é conhecida NAQUELA região — o nome do atlas
// quando existe, o nome próprio dela quando não.
export function nomePublico(faccaoId, regiaoId) {
  const f = FACCOES[faccaoId];
  if (!f) return null;
  return (f.caraPublica && f.caraPublica[regiaoId]) || f.nome;
}

// Presença declarada de uma região: quem manda ali com reputação, e qual é a
// presença de lore do atlas (que pode não ter facção nenhuma).
export function presencaDaRegiao(regiaoId) {
  const atlas = ATLAS_REGIONS.find((r) => r.id === regiaoId);
  const mecanicas = faccoesDaRegiao(regiaoId);
  return {
    regiaoId,
    presencaAtlas: atlas ? atlas.presencaDominante : null,
    faccoes: mecanicas,
    semReputacao: mecanicas.length === 0 ? (PRESENCAS_SEM_REPUTACAO[regiaoId] || null) : null,
  };
}

export const FACCOES_IDS = Object.keys(FACCOES);
