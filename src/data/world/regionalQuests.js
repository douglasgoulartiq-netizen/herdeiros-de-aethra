// QUESTLINES REGIONAIS (ETAPA 3, itens 16 a 19).
//
// Uma linha por macro-região, 3 ou 4 passos cada. Regra que vale para todas:
// nenhum passo é "mate N de X". O `objetivo` de cada passo diz o que o jogador
// FAZ, e o `tipo` diz que espécie de jogo é aquilo (item 18).
//
// TIPOS (item 18): investigacao, exploracao, dialogo, decisao, escolta,
// defesa, puzzle, caca, diplomacia, descoberta, combate.
// Nenhuma região usa só um tipo, e nenhuma repete a mesma sequência de tipos
// da região vizinha — o teste confere as duas coisas.
//
// GEOGRAFIA (item 17): todo passo declara `onde` com id real de zona,
// assentamento ou POI da ETAPA 2. Um passo que não usa o território é um
// passo que poderia acontecer em qualquer lugar, e por isso não entra.
//
// CONSEQUÊNCIA (item 19): `consequencia` é o que muda no mundo ao concluir —
// World State, preço, rota, facção, NPC, criatura ou POI. Passo sem
// consequência declarada é passo que o mundo não sentiu.
//
// ESCOLHAS. Um passo `tipo: "decisao"` declara `escolhas`: as duas saídas
// possíveis, cada uma com seu `rotulo` (o que o jogador clica), seu
// `resultado` (o que ele lê depois) e sua própria `consequencia`.
//
// Isto corrige um defeito que os treze passos de decisão tinham desde que
// foram escritos: o `objetivo` descrevia um dilema com dois lados ("drenar
// o Éter, e a Árvore-Mãe emudece — ou esperar, e a vila passa fome"), mas o
// passo tinha UMA consequência fixa e a interface tinha UM botão, "Concluir".
// O jogador lia uma escolha e executava um desfecho que já estava decidido.
// Um passo chamado "decisão" em que ninguém decide nada é a razão mais
// direta de uma história não ter peso.
//
// Como as duas se combinam: `consequencia` do passo é a BASE, aplicada
// aconteça o que acontecer (o que é verdade nos dois caminhos — um POI
// descoberto, um evento encerrado, o próximo passo aberto); a `consequencia`
// da escolha é mesclada por cima, e é ela que diverge. Um passo sem
// `escolhas` continua funcionando exatamente como antes, com um botão só.
//
// REGRA DE ESCRITA das escolhas: os dois lados têm de ser defensáveis, e
// nenhum dos dois pode sair de graça. Se um lado é só "o certo" e o outro é
// só "o errado", não é uma decisão — é um teste de leitura. Por isso todo
// `resultado` aqui diz também o que a escolha custou.
export const TIPOS_DE_QUEST = [
  "investigacao", "exploracao", "dialogo", "decisao", "escolta",
  "defesa", "puzzle", "caca", "diplomacia", "descoberta", "combate",
];

export const QUESTLINES = [
  {
    regiaoId: "altaverde",
    nome: "A Caça que Não Volta",
    revela: "que a vila depende de um bosque que ninguém entende, e que o Círculo de Elyndor sabe disso e não manda ninguém",
    passos: [
      { id: "qr_altaverde_1", nome: "Três dias sem pegada", tipo: "investigacao", npcId: "npc_cacador",
        onde: ["bosque_das_vozes"], objetivo: "Investigar três pontos das armadilhas de Elric no Bosque das Vozes: pressione E longe de outros objetos e examine pontos separados por pelo menos quatro passos. Depois, conte a Elric o que encontrou.",
        consequencia: { worldState: { vila_aethra_estado: "escassez" }, npcMemoria: ["npc_cacador"], abre: "qr_altaverde_2" } },
      { id: "qr_altaverde_2", nome: "O preço do que falta", tipo: "dialogo", npcId: "npc_mercador",
        onde: ["vila_de_aethra"], objetivo: "Ouvir Baltazar, Tobias e Mireu sobre o que a falta de caça fez com o preço, a forja e o humor da vila — e decidir se conta a eles o que Elric viu.",
        consequencia: { npcMemoria: ["npc_mercador", "npc_fazendeiro", "npc_alt_mireu"], abre: "qr_altaverde_3" } },
      { id: "qr_altaverde_3", nome: "A porta cavada por dentro", tipo: "exploracao", npcId: "npc_guarda",
        onde: ["floresta", "dungeon1"], objetivo: "Ir com Helena até a cripta sob a floresta e ver por que a marca de ferramenta está do lado errado da porta.",
        consequencia: { poiMuda: "dungeon1", npcMemoria: ["npc_guarda"], abre: "qr_altaverde_4" } },
      { id: "qr_altaverde_4", nome: "A raiz que grita", tipo: "decisao", npcId: "npc_alt_hedra",
        onde: ["arvore_mae", "bosque_das_vozes"], objetivo: "Com Hedra, escolher entre drenar o Éter da raiz (a caça volta rápido, a Árvore-Mãe emudece por uma estação) ou esperar a pulsação baixar sozinha (a vila passa fome mais tempo, a Árvore fica inteira).",
        consequencia: { encerraEvento: "ev_tempestade_eter_altaverde" },
        escolhas: [
          { id: "drenar", rotulo: "Drenar o Éter da raiz.",
            resultado: "A pulsação cessa em duas noites e a caça volta antes da primeira neve. A Árvore-Mãe fica muda por uma estação inteira — e Hedra, que passou a vida ouvindo aquilo, não te perdoa por isso.",
            consequencia: { worldState: { vila_aethra_estado: "provida", altaverde_arvore: "muda" }, faccao: { guardioes_da_folha: -7 }, precoLoja: 0.95, npcMuda: ["npc_alt_hedra"] } },
          { id: "esperar", rotulo: "Esperar a pulsação baixar sozinha.",
            resultado: "A vila atravessa mais um inverno contando grãos, e duas famílias vão embora antes da primavera. A Árvore-Mãe continua inteira. Hedra registra seu nome no Círculo — pela primeira vez, como alguém de confiança.",
            consequencia: { worldState: { vila_aethra_estado: "escassez", altaverde_arvore: "inteira" }, faccao: { guardioes_da_folha: 14 }, precoLoja: 1.2, npcMuda: ["npc_alt_hedra", "npc_mercador"] } },
        ] },
    ],
  },
  {
    regiaoId: "morranvell",
    nome: "O Juramento Partido",
    revela: "que em Morranvell a palavra dita em voz alta vale mais que documento, e que isso vira um problema quando o velho jarl morre sem dizer nada",
    passos: [
      { id: "qr_morranvell_1", nome: "Duas metades do salão", tipo: "dialogo", npcId: "npc_mo_vigdis",
        onde: ["fortaleza_do_gelo"], objetivo: "Ouvir as duas linhas de clã contarem o mesmo velório com dois finais diferentes.",
        consequencia: { worldState: { morranvell_sucessao: "disputada" }, abre: "qr_morranvell_2" } },
      { id: "qr_morranvell_2", nome: "O que acordou na Mina Alta", tipo: "combate", npcId: "npc_mo_hrutt",
        onde: ["vale_das_geleiras", "trono_congelado"], objetivo: "Descer à Mina Alta e descobrir por que o turno de baixo se recusa a voltar.",
        consequencia: { worldState: { morranvell_mina: "parada" }, abre: "qr_morranvell_3" } },
      { id: "qr_morranvell_3", nome: "A Caverna do Oráculo", tipo: "puzzle", npcId: "npc_mo_ormar",
        onde: ["caverna_do_oraculo"], objetivo: "Reconstruir a ordem em que o jarl falou seus últimos juramentos, pela marca que cada um deixou na pedra.",
        consequencia: { descobre: "caverna_do_oraculo", abre: "qr_morranvell_4" } },
      { id: "qr_morranvell_4", nome: "Dizer em voz alta", tipo: "decisao", npcId: "npc_mo_vigdis",
        onde: ["fortaleza_do_gelo"], objetivo: "Declarar diante do Salão dos Juramentos qual das duas versões a pedra sustenta — sabendo que a verdade favorece quem você menos gosta.",
        consequencia: { worldState: { morranvell_sucessao: "resolvida" } },
        escolhas: [
          { id: "verdade", rotulo: "Declarar o que a pedra sustenta.",
            resultado: "A pedra dá razão a Hrutt, e você diz isso em voz alta diante do salão. A mina reabre na mesma semana. Vigdis aperta sua mão em público e não volta a te procurar em particular.",
            consequencia: { worldState: { morranvell_mina: "aberta", morranvell_sucessao: "por_juramento" }, faccao: { ordem_dos_arquivistas: 12 }, npcMuda: ["npc_mo_hrutt", "npc_mo_vigdis"] } },
          { id: "silencio", rotulo: "Dizer que a pedra está ilegível.",
            resultado: "Ninguém pode provar o contrário — e é exatamente por isso que o Salão dos Juramentos nunca mais vale o que valia. Vigdis fica com o assento. A mina segue parada, e todo mundo sabe de alguma coisa que não pode dizer.",
            consequencia: { worldState: { morranvell_mina: "parada", morranvell_sucessao: "imposta" }, faccao: { ordem_dos_arquivistas: -8, coroa_de_aethra: 6 }, npcMuda: ["npc_mo_vigdis", "npc_mo_ingrid"] } },
        ] },
    ],
  },
  {
    regiaoId: "vale_do_vento",
    nome: "O Pedágio do Vento",
    revela: "que a Liga dos Ventos mantém a estrada aberta cobrando de quem não tem mais nada, e que o exílio virou uma cidade fora do muro",
    passos: [
      { id: "qr_vale_do_vento_1", nome: "A fila que não anda", tipo: "investigacao", npcId: "npc_vv_sarnia",
        onde: ["cidade_de_aerwind", "planicie_ventosa"], objetivo: "Contar quanta gente está acampada fora do muro e descobrir há quanto tempo o exílio deixou de ter prazo.",
        consequencia: { worldState: { aerwind_exilados: "contados" }, abre: "qr_vale_do_vento_2" } },
      { id: "qr_vale_do_vento_2", nome: "Contrato sem testemunha", tipo: "dialogo", npcId: "npc_vv_hesper",
        onde: ["cidade_de_aerwind"], objetivo: "Achar de quem foi a palavra que mandou os primeiros para fora, num sistema que não escreve nada.",
        consequencia: { npcMemoria: ["npc_vv_orvina"], abre: "qr_vale_do_vento_3" } },
      { id: "qr_vale_do_vento_3", nome: "A travessia das Pontes Suspensas", tipo: "escolta", npcId: "npc_vv_kerin",
        onde: ["pontes_suspensas"], objetivo: "Levar uma família de exilados pelo cânion sem passar por nenhum posto de pedágio.",
        consequencia: { rotaAbre: "pontes_suspensas_secreta", faccao: { cla_dos_ventos_dourados: -5 }, abre: "qr_vale_do_vento_4" } },
      { id: "qr_vale_do_vento_4", nome: "Testemunha", tipo: "diplomacia", npcId: "npc_vv_orvina",
        onde: ["torre_dos_ventos"], objetivo: "Convencer a Liga a aceitar prazo de exílio por contrato oral com três testemunhas — ou a admitir que não pretende aceitar nenhum.",
        consequencia: { worldState: { aerwind_exilados: "com_prazo" }, faccao: { cla_dos_ventos_dourados: 10 }, precoLoja: 0.95 } },
    ],
  },
  {
    regiaoId: "bosque_eterno",
    nome: "A Licença de Corte",
    revela: "que uma assinatura da Coroa não vale nada num bosque onde ninguém reconhece a Coroa, e que os dois lados sabem disso",
    passos: [
      { id: "qr_bosque_eterno_1", nome: "O papel e a copa", tipo: "investigacao", npcId: "npc_be_odran",
        onde: ["acampamento_dos_lenhadores"], objetivo: "Ler a licença de corte e conferir, árvore por árvore, se o acampamento está cortando dentro do que ela permite.",
        consequencia: { worldState: { bosque_licenca: "conferida" }, abre: "qr_bosque_eterno_2" } },
      { id: "qr_bosque_eterno_2", nome: "Boca da trilha", tipo: "dialogo", npcId: "npc_be_ilvar",
        onde: ["floresta_ancestral", "portao_verde"], objetivo: "Ouvir o Círculo explicar por que a licença é inválida, e reparar que o argumento deles é bom e a intenção não é limpa.",
        consequencia: { npcMemoria: ["npc_be_ilvar", "npc_be_odran"], abre: "qr_bosque_eterno_3" } },
      { id: "qr_bosque_eterno_3", nome: "O que o lago mostra", tipo: "descoberta", npcId: "npc_be_sedhe",
        onde: ["lago_dos_reflexos", "santuario_da_nevoa"], objetivo: "Achar no Santuário da Névoa o registro de quem plantou a mata que hoje está sendo cortada.",
        consequencia: { descobre: "santuario_da_nevoa", abre: "qr_bosque_eterno_4" } },
      { id: "qr_bosque_eterno_4", nome: "Quem assina o corte", tipo: "decisao", npcId: "npc_be_vess",
        onde: ["acampamento_dos_lenhadores", "portao_verde"], objetivo: "Decidir se a licença passa a ser assinada pelo Círculo (o acampamento encolhe e sobrevive) ou pela Coroa (o corte segue e o Portão Verde fecha).",
        consequencia: { worldState: { bosque_licenca: "decidida" } },
        escolhas: [
          { id: "circulo", rotulo: "A licença passa a ser do Círculo.",
            resultado: "O acampamento encolhe para um terço e sobrevive. Quarenta lenhadores vão procurar trabalho em Aerwind, e vão contar a versão deles da história pelo caminho.",
            consequencia: { worldState: { bosque_licenca: "circulo", bosque_portao: "aberto" }, faccao: { guardioes_da_folha: 12, coroa_de_aethra: -6 }, npcMuda: ["npc_be_odran"] } },
          { id: "coroa", rotulo: "A licença continua sendo da Coroa.",
            resultado: "O corte segue no ritmo que a Coroa quiser, e o Portão Verde fecha por dentro. O que estiver do outro lado deixa de ser problema de alguém — até deixar de ser, de uma vez só.",
            consequencia: { worldState: { bosque_licenca: "coroa", bosque_portao: "fechado" }, faccao: { coroa_de_aethra: 10, guardioes_da_folha: -12 }, npcMuda: ["npc_be_vess"] } },
        ] },
    ],
  },
  {
    regiaoId: "ruinas_de_aethra",
    nome: "As Máquinas Ainda Obedecem",
    revela: "que catalogar virou obedecer, e que alguém das Cidades-Luz deixou uma ordem de pé que a Ordem cumpre sem admitir",
    passos: [
      { id: "qr_ruinas_de_aethra_1", nome: "Índice incompleto", tipo: "investigacao", npcId: "npc_ra_tessen",
        onde: ["posto_avancado_da_ordem"], objetivo: "Comparar o índice do posto com o que está de fato nas prateleiras e achar as entradas que existem sem original.",
        consequencia: { worldState: { ruinas_indice: "furado" }, abre: "qr_ruinas_de_aethra_2" } },
      { id: "qr_ruinas_de_aethra_2", nome: "A Torre responde", tipo: "puzzle", npcId: "npc_ra_brokk",
        onde: ["torre_do_conhecimento", "ruinas_aethra"], objetivo: "Descobrir a que sequência de ordens as sentinelas da Torre ainda obedecem, testando sem ser reduzido a pó.",
        consequencia: { descobre: "torre_do_conhecimento", abre: "qr_ruinas_de_aethra_3" } },
      { id: "qr_ruinas_de_aethra_3", nome: "Câmara dos Nomes", tipo: "exploracao", npcId: "npc_ra_ysolde",
        onde: ["labirinto_mecanico", "camara_dos_nomes"], objetivo: "Atravessar o labirinto seguindo a ordem que a Torre revelou e chegar ao registro que a Ordem nunca copiou.",
        consequencia: { descobre: "camara_dos_nomes", abre: "qr_ruinas_de_aethra_4" } },
      { id: "qr_ruinas_de_aethra_4", nome: "A quem elas obedecem", tipo: "decisao", npcId: "npc_ra_veskia",
        onde: ["posto_avancado_da_ordem", "coluna_partida"], objetivo: "Escolher entre publicar o nome que está na Câmara (a Ordem perde o controle das máquinas e a autoridade junto) ou selá-lo (a Ordem continua obedecendo, e continua sendo a única que sabe atravessar as ruínas).",
        consequencia: { criaturaMuda: ["sentinela_arcana"] },
        escolhas: [
          { id: "publicar", rotulo: "Publicar o nome que está na Câmara.",
            resultado: "As máquinas param de obedecer à Ordem no dia seguinte — e não passam a obedecer a mais ninguém. As ruínas ficam abertas a qualquer um, o que significa abertas também a quem não deveria entrar.",
            consequencia: { worldState: { ruinas_ordem: "exposta", ruinas_acesso: "livre" }, faccao: { ordem_dos_arquivistas: -14 }, descobre: "coluna_partida", npcMuda: ["npc_ra_veskia"] } },
          { id: "selar", rotulo: "Selar o nome.",
            resultado: "A Ordem continua sendo a única que atravessa as ruínas em segurança, e você continua sendo alguém que ela precisa manter por perto. Veskia agradece do jeito dela: com acesso.",
            consequencia: { worldState: { ruinas_ordem: "intacta", ruinas_acesso: "controlado" }, faccao: { ordem_dos_arquivistas: 14 }, npcMuda: ["npc_ra_veskia"] } },
        ] },
    ],
  },
  {
    regiaoId: "canon_rubro",
    nome: "A Doutrina e a Criança",
    revela: "que a Ordem da Chama Rubra tem uma discussão interna sobre até onde o fogo purifica, e que a ala moderada está perdendo",
    passos: [
      { id: "qr_canon_rubro_1", nome: "Pátio das Provas", tipo: "dialogo", npcId: "npc_cr_sarpa",
        onde: ["fortaleza_ignea"], objetivo: "Assistir a uma prova pública e entender o que a Ordem chama de mérito.",
        consequencia: { worldState: { canon_doutrina: "observada" }, abre: "qr_canon_rubro_2" } },
      { id: "qr_canon_rubro_2", nome: "Mãos sem marca", tipo: "investigacao", npcId: "npc_cr_bruen",
        onde: ["fortaleza_ignea", "mina_ferro_negro"], objetivo: "Descobrir por que a aprendiz dos Fornos Baixos foi inscrita numa prova para a qual ninguém a preparou.",
        consequencia: { npcMemoria: ["npc_cr_bruen", "npc_cr_nira"], abre: "qr_canon_rubro_3" } },
      { id: "qr_canon_rubro_3", nome: "Forja dos Deuses", tipo: "exploracao", npcId: "npc_cr_ignara",
        onde: ["forja_dos_deuses", "bosque_petrificado"], objetivo: "Achar na Forja dos Deuses o texto original da doutrina, que fala de metal e não fala de gente.",
        consequencia: { descobre: "forja_dos_deuses", abre: "qr_canon_rubro_4" } },
      { id: "qr_canon_rubro_4", nome: "Diante do Pátio", tipo: "decisao", npcId: "npc_cr_ordalia",
        onde: ["fortaleza_ignea"], objetivo: "Ler o texto original em voz alta no Pátio das Provas, ou entregá-lo à Arconte e deixar que ela decida quando usá-lo.",
        consequencia: { worldState: { canon_doutrina: "revisada" } },
        escolhas: [
          { id: "ler", rotulo: "Ler o texto original no Pátio das Provas.",
            resultado: "Trezentas pessoas ouvem que a doutrina que as governa foi encurtada por alguém, em algum século, por conveniência. A Legião racha em duas. As duas metades juram que são a original.",
            consequencia: { worldState: { canon_doutrina: "publica", canon_legiao: "dividida" }, faccao: { legiao_das_cinzas: -6 }, npcMuda: ["npc_cr_nira", "npc_cr_ordalia"] } },
          { id: "entregar", rotulo: "Entregar o texto à Arconte.",
            resultado: "Ordália guarda o texto e a gratidão. A Legião continua inteira, continua obedecendo, e agora deve a você uma coisa que ela não pode explicar a ninguém.",
            consequencia: { worldState: { canon_doutrina: "guardada", canon_legiao: "inteira" }, faccao: { legiao_das_cinzas: 14 }, npcMuda: ["npc_cr_ordalia"] } },
        ] },
    ],
  },
  {
    regiaoId: "lago_prismatico",
    nome: "O Que o Lago Repete",
    revela: "que o lago devolve o atrasado, e que o atraso cresce toda vez que alguém morre longe daqui",
    passos: [
      { id: "qr_lago_prismatico_1", nome: "Ponto três", tipo: "dialogo", npcId: "npc_lp_mira",
        onde: ["margem_prismatica", "santuario_das_aguas"], objetivo: "Segurar a estaca da menina por uma manhã inteira e ouvir por que ela volta todo dia.",
        consequencia: { npcMemoria: ["npc_lp_mira", "npc_lp_ceren"], abre: "qr_lago_prismatico_2" } },
      { id: "qr_lago_prismatico_2", nome: "Onze anos de medição", tipo: "descoberta", npcId: "npc_lp_isvarn",
        onde: ["observatorio_submerso", "ilha_do_prisma"], objetivo: "Descer ao Observatório Submerso na semana de atraso máximo e ler a série que Isvarn nunca mostrou a ninguém.",
        consequencia: { worldState: { lago_atraso: "grande" }, descobre: "observatorio_submerso", abre: "qr_lago_prismatico_3" } },
      { id: "qr_lago_prismatico_3", nome: "Que dia é hoje", tipo: "decisao", npcId: "npc_lp_o_barqueiro",
        onde: ["ilha_do_prisma", "santuario_das_aguas"], objetivo: "Dizer ao barqueiro há quanto tempo ele saiu — ou não dizer, e deixá-lo atravessar mais uma manhã sem saber.",
        consequencia: { worldState: { lago_atraso: "medido" } },
        escolhas: [
          { id: "dizer", rotulo: "Dizer há quanto tempo ele saiu.",
            resultado: "Ele escuta o número, fica quieto, e depois pergunta se ainda existe a ponte de pedra em Maris. Não existe há oitenta anos. Ele para de remar naquela manhã, e a travessia do lago fica sem barqueiro.",
            consequencia: { worldState: { lago_barqueiro: "parado" }, faccao: { ordem_dos_arquivistas: 8 }, npcMuda: ["npc_lp_o_barqueiro", "npc_lp_mira"] } },
          { id: "calar", rotulo: "Deixá-lo atravessar mais uma manhã.",
            resultado: "Ele te leva até a outra margem falando de uma cidade que não existe mais, e você responde como se existisse. Mira vê tudo da doca e entende o que você fez. Não fica claro se ela aprova.",
            consequencia: { worldState: { lago_barqueiro: "remando" }, faccao: { ordem_dos_arquivistas: -4 }, npcMuda: ["npc_lp_mira"] } },
        ] },
    ],
  },
  {
    regiaoId: "costa_da_mare",
    nome: "As Cartas Roubadas",
    revela: "que a Confraria do Farol controla quem chega vivo ao porto, e que essa vantagem vale mais roubada do que comprada",
    passos: [
      { id: "qr_costa_da_mare_1", nome: "O banco de areia que não existe", tipo: "investigacao", npcId: "npc_cm_sarel",
        onde: ["porto_de_maris"], objetivo: "Achar no Mercado Negro uma carta que copia o erro proposital que Sarel desenha em todo original.",
        consequencia: { worldState: { cartas_de_maris: "vazando" }, abre: "qr_costa_da_mare_2" } },
      { id: "qr_costa_da_mare_2", nome: "Livro de chegada", tipo: "dialogo", npcId: "npc_cm_halvo",
        onde: ["porto_de_maris", "mercado_negro"], objetivo: "Cruzar quem teve carta na mão com quem estava no porto em cada data, e ver dois nomes sobrarem.",
        consequencia: { npcMemoria: ["npc_cm_dova", "npc_cm_maroa"], abre: "qr_costa_da_mare_3" } },
      { id: "qr_costa_da_mare_3", nome: "Por cima do banco falso", tipo: "caca", npcId: "npc_cm_ruvo",
        onde: ["falesias_das_correntes", "farol_das_correntes"], objetivo: "Seguir da falésia o casco que navega pelo banco que não existe, e ver quem o guia.",
        consequencia: { descobre: "farol_das_correntes", abre: "qr_costa_da_mare_4" } },
      { id: "qr_costa_da_mare_4", nome: "Jurar pelo farol", tipo: "decisao", npcId: "npc_cm_nyxandra",
        onde: ["porto_de_maris", "farol_das_correntes"], objetivo: "Entregar a copista à Confraria (o acervo fica selado e a cidade continua dependendo dele) ou tornar as cartas públicas (a Confraria perde o poder de decidir quem chega).",
        consequencia: { npcMuda: ["npc_cm_maroa"] },
        escolhas: [
          { id: "confraria", rotulo: "Entregar a copista à Confraria.",
            resultado: "O acervo é selado e as cartas voltam a bater com a costa. A cidade continua dependendo de um prédio com uma porta só, e da gente que tem a chave.",
            consequencia: { worldState: { cartas_de_maris: "selada" }, faccao: { confraria_do_farol: 12 }, precoLoja: 0.9, npcMuda: ["npc_cm_nyxandra", "npc_cm_dova"] } },
          { id: "publicar", rotulo: "Tornar as cartas públicas.",
            resultado: "Em duas semanas há cópias em toda taberna do porto, metade com erro. A Confraria perde o poder de decidir quem chega — e o naufrágio do mês seguinte é culpa de alguém que agora tem nome.",
            consequencia: { worldState: { cartas_de_maris: "publica" }, faccao: { confraria_do_farol: -12, vila: 10 }, precoLoja: 1.1, npcMuda: ["npc_cm_maroa"] } },
        ] },
    ],
  },
  {
    regiaoId: "recife_coralino",
    nome: "A Maré que Não Volta",
    revela: "que Corallia vive do recife e culpa quem depende dele, e que a Fenda Azul é a causa que ninguém quis olhar",
    passos: [
      { id: "qr_recife_coralino_1", nome: "Branco é osso", tipo: "descoberta", npcId: "npc_rc_behen",
        onde: ["jardins_de_perola", "cidade_de_corallia"], objetivo: "Mapear até onde o viveiro branqueou e trazer a medida para a Casa das Marés.",
        consequencia: { worldState: { recife_estado: "branqueado" }, disparaEvento: "ev_branqueamento_recife", abre: "qr_recife_coralino_2" } },
      { id: "qr_recife_coralino_2", nome: "Safra nenhuma", tipo: "dialogo", npcId: "npc_rc_marul",
        onde: ["acampamento_dos_pescadores", "recife_tempestades"], objetivo: "Ouvir os pescadores serem acusados de pescar demais por quem nunca desceu ao recife.",
        consequencia: { faccao: { confraria_do_farol: -4 }, npcMemoria: ["npc_rc_talia", "npc_rc_marul"], abre: "qr_recife_coralino_3" } },
      { id: "qr_recife_coralino_3", nome: "Onde o cardume foi", tipo: "caca", npcId: "npc_rc_oris",
        onde: ["abismo_raso"], objetivo: "Seguir o cardume até a plataforma submersa e ver o que o levou para lá — e o que o seguiu.",
        consequencia: { descobre: "abismo_raso", criaturaMuda: ["serpente_marinha"], abre: "qr_recife_coralino_4" } },
      { id: "qr_recife_coralino_4", nome: "Fenda Azul", tipo: "puzzle", npcId: "npc_rc_ilma",
        onde: ["fenda_azul"], objetivo: "Esfriar a Fenda fechando na ordem certa as bocas que a alimentam, sem fechar a que ventila o recife.",
        consequencia: { worldState: { recife_estado: "vivo" }, encerraEvento: "ev_branqueamento_recife", faccao: { confraria_do_farol: 12 }, descobre: "fenda_azul" } },
    ],
  },
  {
    regiaoId: "pantano_de_thalgor",
    nome: "As Passarelas Apodrecem",
    revela: "que no pântano dívida se paga em travessia, e que abandonar o setor leste é abandonar as pessoas que moram nele",
    passos: [
      { id: "qr_pantano_de_thalgor_1", nome: "Contar as estacas", tipo: "investigacao", npcId: "npc_pt_darzo",
        onde: ["aldeia_sombria", "pantano_negro"], objetivo: "Percorrer a passarela do leste marcando cada estaca podre e descobrir que são mais do que a aldeia admite.",
        consequencia: { worldState: { thalgor_passarelas: "rompidas" }, abre: "qr_pantano_de_thalgor_2" } },
      { id: "qr_pantano_de_thalgor_2", nome: "Quem paga a conta", tipo: "dialogo", npcId: "npc_pt_maruva",
        onde: ["aldeia_sombria"], objetivo: "Descobrir por que a aldeia prefere discutir a dívida a consertar a passarela, e quem ganha com o setor leste vazio.",
        consequencia: { npcMemoria: ["npc_pt_maruva", "npc_pt_vergo"], abre: "qr_pantano_de_thalgor_3" } },
      { id: "qr_pantano_de_thalgor_3", nome: "Junco do Jardim Fúngico", tipo: "defesa", npcId: "npc_pt_ilua",
        onde: ["jardim_fungico", "charco_fetido"], objetivo: "Escoltar a colheita de junco novo pela travessia e sustentar a ponte improvisada até a carga passar.",
        consequencia: { worldState: { thalgor_passarelas: "inteiras" }, encerraEvento: "ev_ponte_danificada", rotaAbre: "pantano_negro->charco_fetido", abre: "qr_pantano_de_thalgor_4" } },
      { id: "qr_pantano_de_thalgor_4", nome: "Túmulo Vivo", tipo: "decisao", npcId: "npc_pt_nerza",
        onde: ["tumulo_vivo"], objetivo: "Decidir se o Túmulo Vivo vira fonte de fungo para a aldeia (dinheiro agora, o charco avança) ou fica selado (a aldeia continua pobre e o setor leste continua de pé).",
        consequencia: { descobre: "tumulo_vivo" },
        escolhas: [
          { id: "abrir", rotulo: "Abrir o Túmulo como fonte de fungo.",
            resultado: "A aldeia come bem pela primeira vez em anos, e o charco come o setor leste em três estações. Ninguém discorda de Nerza em voz alta, porque ninguém quer voltar a passar fome.",
            consequencia: { worldState: { thalgor_setor_leste: "submerso", thalgor_aldeia: "provida" }, faccao: { andarilhos_do_pantano: -6 }, precoLoja: 0.85, npcMuda: ["npc_pt_nerza"] } },
          { id: "selar", rotulo: "Manter o Túmulo selado.",
            resultado: "O setor leste continua de pé e a aldeia continua pobre. Nerza aceita a decisão sem discutir, o que é pior do que se ela discutisse.",
            consequencia: { worldState: { thalgor_setor_leste: "habitado", thalgor_aldeia: "pobre" }, faccao: { andarilhos_do_pantano: 12 }, precoLoja: 1.1, npcMuda: ["npc_pt_nerza"] } },
        ] },
    ],
  },
  {
    regiaoId: "selva_umbriaca",
    nome: "A Lua Que Não Se Põe",
    revela: "que o rito da tribo tem dono, e que a tribo se partiu por não saber quem era",
    passos: [
      { id: "qr_selva_umbriaca_1", nome: "A letra no altar", tipo: "investigacao", npcId: "npc_su_ynara",
        onde: ["altar_da_lua_negra"], objetivo: "Comparar a letra do rito novo com o calendário de Ynara e descobrir de quem é a mão.",
        consequencia: { worldState: { umbriaca_rito: "identificado" }, descobre: "altar_da_lua_negra", abre: "qr_selva_umbriaca_2" } },
      { id: "qr_selva_umbriaca_2", nome: "Caçar com o desligado", tipo: "caca", npcId: "npc_su_vehl",
        onde: ["bosque_sombrio", "arvore_oca"], objetivo: "Sair em caçada com Vehl e nomear a presa junto com ele, que jura não fazer mais isso.",
        consequencia: { npcMemoria: ["npc_su_vehl", "npc_su_orun"], abre: "qr_selva_umbriaca_3" } },
      { id: "qr_selva_umbriaca_3", nome: "A que veio pela lua", tipo: "dialogo", npcId: "npc_su_a_que_veio",
        onde: ["arvore_oca", "aldeia_dos_cacadores"], objetivo: "Convencer a estrangeira da Árvore Oca a se apresentar à aldeia antes que a lua vire, e levar Ynara até ela.",
        consequencia: { worldState: { umbriaca_rito: "assinado" }, npcMuda: ["npc_su_takra", "npc_su_vehl", "npc_su_ynara"], faccao: { guardioes_da_folha: 8 } } },
    ],
  },
  {
    regiaoId: "vale_dos_titas",
    nome: "O Osso Que Ainda Dói",
    revela: "que o vale é jazida para uns e corpo para outros, e que ninguém ali tem autoridade para decidir qual",
    passos: [
      { id: "qr_vale_dos_titas_1", nome: "Dois ossos de profundidade", tipo: "exploracao", npcId: "npc_vt_hallr",
        onde: ["acampamento_dos_mineiros", "coracao_petrificado"], objetivo: "Descer com a frente de escavação até o veio do peito e sentir, na mão, que a rocha está quente.",
        consequencia: { worldState: { coracao_petrificado_estado: "quente" }, disparaEvento: "ev_ataque_ao_acampamento", abre: "qr_vale_dos_titas_2" } },
      { id: "qr_vale_dos_titas_2", nome: "A marcha", tipo: "dialogo", npcId: "npc_vt_sethra",
        onde: ["templo_dos_titas", "arena_ossea"], objetivo: "Andar a marcha inteira com Sethra, sem correr uma única vez, e ouvir o que ela decidiu não usar como argumento.",
        consequencia: { npcMemoria: ["npc_vt_sethra", "npc_vt_benu"], abre: "qr_vale_dos_titas_3" } },
      { id: "qr_vale_dos_titas_3", nome: "Doze pontos a giz", tipo: "descoberta", npcId: "npc_vt_ora",
        onde: ["caverna_eco", "vale_pedras"], objetivo: "Refazer com Ora as doze medições e provar que o calor sobe onde se cava e cai onde se para.",
        consequencia: { descobre: "caverna_eco", npcMemoria: ["npc_vt_fendrel"], abre: "qr_vale_dos_titas_4" } },
      { id: "qr_vale_dos_titas_4", nome: "Quem decide o vale", tipo: "diplomacia", npcId: "npc_vt_a_que_conta",
        onde: ["templo_dos_titas", "acampamento_dos_peregrinos"], objetivo: "Levar mineiro e peregrino ao mesmo pilar e conseguir que aceitem o número da contadora como árbitro, já que nenhum dos dois aceita o outro.",
        consequencia: { worldState: { coracao_petrificado_estado: "frio", titas_acampamento: "normal" }, encerraEvento: "ev_ataque_ao_acampamento", faccao: { forja_dos_anoes_cinzentos: 8 }, npcMuda: ["npc_vt_hallr", "npc_vt_benu"] } },
    ],
  },
  {
    regiaoId: "deserto_de_arenth",
    nome: "A Água Tem Dono",
    revela: "que hospitalidade é lei em Arenth e cobrança também, e que as duas coisas param de caber juntas quando o poço é um só",
    passos: [
      { id: "qr_deserto_de_arenth_1", nome: "Dedos d'água", tipo: "investigacao", npcId: "npc_da_karim",
        onde: ["posto_da_caravana"], objetivo: "Acompanhar a medição da água vendida por um dia e comparar com o que a Caravana declara ter tirado do poço.",
        consequencia: { worldState: { arenth_agua: "auditada" }, abre: "qr_deserto_de_arenth_2" } },
      { id: "qr_deserto_de_arenth_2", nome: "O poço do Oásis", tipo: "dialogo", npcId: "npc_da_yusra",
        onde: ["posto_do_oasis", "oasis_sete_sombras"], objetivo: "Ouvir por que o Posto do Oásis quer abrir o segundo poço e por que a Caravana chama isso de ruína de rota.",
        consequencia: { npcMemoria: ["npc_da_yusra", "npc_da_nura"], abre: "qr_deserto_de_arenth_3" } },
      { id: "qr_deserto_de_arenth_3", nome: "Biblioteca de Areia", tipo: "puzzle", npcId: "npc_da_rasha",
        onde: ["biblioteca_de_areia", "areias_soterradas"], objetivo: "Achar no arquivo soterrado o mapa antigo dos aquíferos, que diz se o segundo poço secaria o primeiro.",
        consequencia: { descobre: "biblioteca_de_areia", abre: "qr_deserto_de_arenth_4" } },
      { id: "qr_deserto_de_arenth_4", nome: "Sombra a quem pedir", tipo: "decisao", npcId: "npc_da_nura",
        onde: ["templo_de_arenth", "posto_da_caravana"], objetivo: "Decidir se o mapa vira propriedade da Caravana (a rota fica segura e a água cara) ou das Casas de Arenth (o poço abre e a rota fica exposta).",
        consequencia: { descobre: "templo_de_arenth" },
        escolhas: [
          { id: "caravana", rotulo: "O mapa é da Caravana.",
            resultado: "A rota fica segura o ano inteiro e a água passa a ter preço de mercadoria. Quem pode pagar atravessa Arenth sem medo. Quem não pode não atravessa mais.",
            consequencia: { worldState: { arenth_agua: "vendida", arenth_rota: "segura" }, faccao: { caravana_de_karn: 14, vila: -6 }, precoLoja: 1.15, npcMuda: ["npc_da_karim"] } },
          { id: "casas", rotulo: "O mapa é das Casas de Arenth.",
            resultado: "O poço abre para quem chegar, e chega muito mais gente do que o poço aguenta. A rota volta a ser perigosa, e a Caravana deixa de garantir o que garantia.",
            consequencia: { worldState: { arenth_agua: "partilhada", arenth_rota: "exposta" }, faccao: { vila: 12, caravana_de_karn: -10 }, precoLoja: 0.85, npcMuda: ["npc_da_nura"] } },
        ] },
    ],
  },
  {
    regiaoId: "sombralith",
    nome: "O Nome Que Sobrou",
    revela: "que a Corte apaga nomes por decisão administrativa, e que apagar um nome apaga a pessoa da memória do Véu",
    passos: [
      { id: "qr_sombralith_1", nome: "Onze folhas", tipo: "investigacao", npcId: "npc_sl_venra",
        onde: ["cidade_das_sombras"], objetivo: "Conferir onze supressões assinadas pela Arconte em datas em que ela não estava na cidade.",
        consequencia: { worldState: { sombralith_registro: "auditado" }, abre: "qr_sombralith_2" } },
      { id: "qr_sombralith_2", nome: "A mão do calígrafo", tipo: "dialogo", npcId: "npc_sl_ordo",
        onde: ["cidade_das_sombras"], objetivo: "Descobrir quem encomendou cópias de treino da letra da Arconte, pagas em dobro e sem recibo.",
        consequencia: { npcMemoria: ["npc_sl_ordo", "npc_sl_karsan"], abre: "qr_sombralith_3" } },
      { id: "qr_sombralith_3", nome: "Ponto fino", tipo: "escolta", npcId: "npc_sl_delune",
        onde: ["vale_dos_lamentos", "cripta_do_cavaleiro"], objetivo: "Atravessar com Delune até onde o Véu é fino e verificar quais dos onze nomes o Véu ainda reconhece.",
        consequencia: { descobre: "cripta_do_cavaleiro", abre: "qr_sombralith_4" } },
      { id: "qr_sombralith_4", nome: "Restituição", tipo: "decisao", npcId: "npc_sl_meire",
        onde: ["cidade_das_sombras", "cripta_do_cavaleiro"], objetivo: "Escolher entre restituir os nove nomes possíveis e expor o procurador (o prazo da Corte cai de quatro anos para seis meses) ou proteger o procurador e deixar a Corte como está.",
        consequencia: { descobre: "cripta_do_cavaleiro" },
        escolhas: [
          { id: "restituir", rotulo: "Restituir os nove nomes e expor o procurador.",
            resultado: "Nove pessoas voltam a existir no registro e o prazo da Corte cai de quatro anos para seis meses. O procurador tinha noventa e um outros processos, e todos os noventa e um vão ser reabertos por alguém que não é você.",
            consequencia: { worldState: { sombralith_registro: "restituido", sombralith_corte: "reformada" }, faccao: { ordem_dos_arquivistas: 14, coroa_de_aethra: -10 }, npcMuda: ["npc_sl_a_sem_nome", "npc_sl_karsan", "npc_sl_borran"] } },
          { id: "proteger", rotulo: "Proteger o procurador.",
            resultado: "A Corte segue como está, o que significa que segue funcionando. Os nove continuam sem nome. Meire te agradece por não ter derrubado a única estrutura que ainda julga alguma coisa em Sombralith.",
            consequencia: { worldState: { sombralith_registro: "fechado", sombralith_corte: "intacta" }, faccao: { coroa_de_aethra: 10, ordem_dos_arquivistas: -8 }, npcMuda: ["npc_sl_meire", "npc_sl_borran"] } },
        ] },
    ],
  },
  {
    regiaoId: "arquipelago_de_nuvens",
    nome: "O Tratado que Venceu no Caminho",
    revela: "que a cidade se moveu e os papéis não, e que alguém transformou isso em mercado",
    passos: [
      { id: "qr_arquipelago_de_nuvens_1", nome: "Onze ancoragens", tipo: "descoberta", npcId: "npc_an_tessil",
        onde: ["jardim_das_nuvens", "cidade_flutuante"], objetivo: "Refazer com Tessil o mapa das ancoragens desde a migração da ilha.",
        consequencia: { worldState: { nuvens_mapa: "refeito" }, abre: "qr_arquipelago_de_nuvens_2" } },
      { id: "qr_arquipelago_de_nuvens_2", nome: "Casco aliviado", tipo: "investigacao", npcId: "npc_an_hesk",
        onde: ["estaleiro_celeste"], objetivo: "Descobrir por que dois cascos saíram do estaleiro abaixo da margem de segurança dos Clãs.",
        consequencia: { npcMemoria: ["npc_an_hesk", "npc_an_okra"], abre: "qr_arquipelago_de_nuvens_3" } },
      { id: "qr_arquipelago_de_nuvens_3", nome: "Janela fechada", tipo: "diplomacia", npcId: "npc_an_aelric",
        onde: ["falesias_fim"], objetivo: "Descobrir quem pediu a Aelric que usasse a travessia como arma, e quem ele protegeu ao recusar.",
        consequencia: { worldState: { nuvens_travessia: "neutra" }, descobre: "estaleiro_celeste", abre: "qr_arquipelago_de_nuvens_4" } },
      { id: "qr_arquipelago_de_nuvens_4", nome: "Aclamação", tipo: "decisao", npcId: "npc_an_veyra",
        onde: ["cidade_flutuante"], objetivo: "Levar a renegociação à Assembleia sabendo que ela perde por cinco vozes — ou usar a petição do velho mestre de ancoragem para virar as cinco.",
        consequencia: { worldState: { nuvens_tratados: "em_pauta" } },
        escolhas: [
          { id: "limpo", rotulo: "Levar à Assembleia e perder por cinco vozes.",
            resultado: "A renegociação cai, como todo mundo sabia que cairia. Mas ela cai registrada em ata, com nome de quem votou contra — e daqui a três anos isso vai valer mais do que ter ganhado hoje.",
            consequencia: { worldState: { nuvens_tratados: "rejeitados", nuvens_assembleia: "registrada" }, faccao: { cavaleiros_do_vento_uivante: 8, cla_dos_ventos_dourados: 4 }, npcMuda: ["npc_an_veyra"] } },
          { id: "peticao", rotulo: "Usar a petição do velho mestre de ancoragem.",
            resultado: "As cinco vozes viram, e a renegociação passa. Também passa o precedente de que uma petição de oitenta anos atrás pode virar qualquer votação — e não é você quem vai usar isso da próxima vez.",
            consequencia: { worldState: { nuvens_tratados: "renegociados", nuvens_assembleia: "precedente" }, faccao: { cavaleiros_do_vento_uivante: 14, cla_dos_ventos_dourados: -10 }, npcMuda: ["npc_an_dovel", "npc_an_okra"] } },
        ] },
    ],
  },
  {
    regiaoId: "montanhas_de_vulkor",
    nome: "A Forja Não Escolhe",
    revela: "que Vulkor fabrica armas despertadas sabendo que elas não escolhem portador com critério, e que uma delas voltou sozinha",
    passos: [
      { id: "qr_montanhas_de_vulkor_1", nome: "Onze linhas, nove nomes", tipo: "investigacao", npcId: "npc_mv_orik",
        onde: ["fortaleza_de_ignis", "mina_carmesim"], objetivo: "Conferir o livro do arsenal contra as peças presentes e achar a página que falta.",
        consequencia: { worldState: { vulkor_arsenal: "auditado" }, abre: "qr_montanhas_de_vulkor_2" } },
      { id: "qr_montanhas_de_vulkor_2", nome: "Sob a ferrugem", tipo: "descoberta", npcId: "npc_mv_dagrun",
        onde: ["fortaleza_de_ignis"], objetivo: "Limpar a peça que voltou sozinha e ler a runa de quem a fez.",
        consequencia: { npcMemoria: ["npc_mv_dagrun", "npc_mv_thorgrid"], abre: "qr_montanhas_de_vulkor_3" } },
      { id: "qr_montanhas_de_vulkor_3", nome: "Doze passos da pedra torta", tipo: "exploracao", npcId: "npc_mv_kesta",
        onde: ["deserto_ardente"], objetivo: "Desenterrar com Kesta a peça que ela escondeu, e ver por que ela a escondeu.",
        consequencia: { descobre: "deserto_ardente", npcAparece: "npc_mv_o_portador", abre: "qr_montanhas_de_vulkor_4" } },
      { id: "qr_montanhas_de_vulkor_4", nome: "Diante da Assembleia", tipo: "decisao", npcId: "npc_mv_thorgrid",
        onde: ["cratera_primeiro_fogo", "fortaleza_de_ignis"], objetivo: "Fazer Thorgrid dizer em voz alta, diante da Assembleia, se despertar armas foi erro — e aceitar o que isso custa à Forja.",
        consequencia: { descobre: "cratera_primeiro_fogo" },
        escolhas: [
          { id: "admitir", rotulo: "Fazer Thorgrid admitir em voz alta.",
            resultado: "Ele diz que foi erro, diante da Assembleia inteira, e o despertar de armas é suspenso na hora. A Forja perde dois terços das encomendas e um terço dos ferreiros no mesmo mês.",
            consequencia: { worldState: { vulkor_despertar: "suspenso", vulkor_forja: "reduzida" }, faccao: { forja_dos_anoes_cinzentos: 14 }, precoLoja: 1.2, npcMuda: ["npc_mv_dagrun", "npc_mv_o_portador"] } },
          { id: "poupar", rotulo: "Poupá-lo e deixar a Assembleia decidir sozinha.",
            resultado: "Sem a palavra dele, a Assembleia mantém o despertar. A Forja continua a todo vapor e Thorgrid continua respeitado — e é ele quem vai encontrar o próximo Portador, sem ter aprendido nada.",
            consequencia: { worldState: { vulkor_despertar: "mantido", vulkor_forja: "plena" }, faccao: { forja_dos_anoes_cinzentos: -6 }, precoLoja: 0.85, npcMuda: ["npc_mv_thorgrid"] } },
        ] },
    ],
  },
  {
    regiaoId: "abismo_de_nazthal",
    nome: "Os Sem-Tempo",
    revela: "que o fim do mapa tem gente nele, e que chegar é mais fácil do que continuar sendo quem chegou",
    passos: [
      { id: "qr_abismo_de_nazthal_1", nome: "A chamada da manhã", tipo: "dialogo", npcId: "npc_az_haldrek",
        onde: ["nau_dos_sem_tempo"], objetivo: "Ficar no convés durante a chamada e reparar em quantas vozes respondem.",
        consequencia: { worldState: { nazthal_nau: "visitada" }, descobre: "nau_dos_sem_tempo", abre: "qr_abismo_de_nazthal_2" } },
      { id: "qr_abismo_de_nazthal_2", nome: "Três medições que faltam", tipo: "exploracao", npcId: "npc_az_selia",
        onde: ["confins_aethra", "nau_dos_sem_tempo"], objetivo: "Fazer com Selia as três medições que faltam na carta dos Confins, e descobrir que não faltavam.",
        consequencia: { npcMemoria: ["npc_az_selia", "npc_az_haldrek"], npcAparece: "npc_az_o_primeiro", abre: "qr_abismo_de_nazthal_3" } },
      { id: "qr_abismo_de_nazthal_3", nome: "Como você chegou", tipo: "decisao", npcId: "npc_az_o_primeiro",
        onde: ["olho_do_abismo"], objetivo: "Perguntar ao Primeiro como ele chegou, em vez de o que ele é — e decidir se leva a carta de Selia para fora ou fica mais uma noite ouvindo.",
        consequencia: { descobre: "olho_do_abismo" },
        escolhas: [
          { id: "levar", rotulo: "Levar a carta de Selia para fora.",
            resultado: "A carta chega ao mundo e os Confins deixam de ser o fim do mapa. Em dois anos haverá rota, e em cinco haverá porto. Selia nunca quis nenhuma das duas coisas — ela só queria que a medição estivesse certa.",
            consequencia: { worldState: { nazthal_carta: "levada", nazthal_confins: "mapeados" }, faccao: { ordem_dos_arquivistas: 12 }, npcMuda: ["npc_az_selia", "npc_az_haldrek"] } },
          { id: "ficar", rotulo: "Ficar mais uma noite ouvindo.",
            resultado: "O Primeiro conta como chegou, e leva a noite inteira, e no fim você entende por que ninguém antes de você perguntou isso. A carta fica na Nau. Os Confins continuam sendo um lugar de onde se volta diferente.",
            consequencia: { worldState: { nazthal_carta: "ficou", nazthal_confins: "fechados" }, faccao: { legiao_das_cinzas: 14 }, npcMuda: ["npc_az_o_primeiro", "npc_az_selia"] } },
        ] },
    ],
  },
];

// --- Consultas -------------------------------------------------------------
export const QUESTS_REGIONAIS = QUESTLINES.flatMap((l) =>
  l.passos.map((p) => ({ ...p, regiaoId: l.regiaoId, questline: l.nome })));

const POR_ID = new Map(QUESTS_REGIONAIS.map((q) => [q.id, q]));
export const questRegionalPorId = (id) => POR_ID.get(id) || null;
export const questlineDaRegiao = (regiaoId) => QUESTLINES.find((l) => l.regiaoId === regiaoId) || null;
export const questsDoNpc = (npcId) => QUESTS_REGIONAIS.filter((q) => q.npcId === npcId);

// O primeiro passo de cada linha é o único que não precisa de um passo
// anterior aberto. Todo o resto é destravado pelo `consequencia.abre` do
// passo que vem antes — o teste segue essa corrente e cobra que ela chegue
// ao último passo de cada região.
export const PASSOS_INICIAIS = QUESTLINES.map((l) => l.passos[0].id);
