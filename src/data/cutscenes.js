// CENAS (cutscenes) — a camada que faltava entre "o jogador clicou em Nova
// Aventura" e "o jogador está num mapa com um boneco".
//
// POR QUE ISTO EXISTE. O jogo tinha mitologia (mythologyCodex.js, 25 KB de
// lore boa) e tinha questlines regionais com consequência real
// (regionalQuests.js), mas o jogador nunca via nenhuma das duas coisas
// ACONTECER com ele: o Códice é um livro que se desbloqueia por nível, e a
// questline abre no diálogo de um NPC como um card com um botão "Aceitar".
// Faltava a cena — o momento em que o jogo para e conta. É isso que dá
// impacto: não mais lore, e sim lore ENDEREÇADA ao jogador, num momento em
// que ele não está fazendo outra coisa.
//
// A PREMISSA DO PRÓLOGO, e por que ela é esta. A regra central do mundo já
// estava escrita no Códice: "Aethra responde à história de quem o percorre"
// e "Herdeiro é quem é capaz de ouvir, suportar e alterar a Memória do
// Mundo". O prólogo pega essa regra e a inverte numa falta pessoal: o mundo
// que lembra de tudo não lembra de você. Isso resolve, de uma vez, três
// problemas do jogo anterior:
//   1. dá ao herdeiro algo em jogo (seu próprio nome) desde o minuto zero;
//   2. justifica mecanicamente por que ESTE personagem muda o mundo — o que
//      o Éter ainda não fixou, ainda pode ser escrito;
//   3. funciona com QUALQUER raça/classe/origem escolhida na criação, porque
//      o personagem não lembra de tê-las escolhido: o corpo sabe, a cabeça
//      não. O jogador sabe mais que o personagem, e isso é uma boa posição
//      para começar um RPG.
//
// FORMATO. Cada cena é uma lista de `paineis`, e cada painel é UMA ideia:
// uma arte de fundo (chave tratada em cutscene.css, nada de imagem nova a
// produzir), uma epígrafe opcional e de 1 a 3 parágrafos curtos. Cenas
// longas cansam; a regra aqui é que nenhum painel passe de ~60 palavras.
// `escolha` é opcional e, quando existe, é a última coisa da cena.
//
// TEXTO INTERPOLADO: {nome}, {raca}, {classe}, {origem}, {marcaRaca} (uma
// frase por raça) e {marcaMotivacao} (uma frase por motivação) são trocados em
// runtime por CutsceneUI.js. Nada mais é interpolado — se precisar de outro
// campo, adicione-o lá e documente aqui.

export const CUTSCENES = [
  // ---------------------------------------------------------------------
  // PRÓLOGO. Roda uma vez, logo depois da criação de personagem, antes do
  // primeiro frame do mundo. É a única cena que o jogo mostra sem que o
  // jogador tenha pedido nada — por isso é também a única que pode ser
  // pulada inteira num clique (ver CutsceneUI.js).
  // ---------------------------------------------------------------------
  {
    id: "prologo",
    titulo: "A Memória do Mundo",
    quando: "novo_jogo",
    paineis: [
      {
        arte: "eter",
        epigrafe: "\"Toda montanha guarda um nome anterior ao nosso.\"",
        texto: [
          "Aethra lembra.",
          "Não é força de expressão. Sob a pedra e sob a água corre o Éter, e o Éter guarda tudo o que foi grande o bastante para doer: o juramento dito em voz alta, a casa que queimou, o nome que alguém gritou antes de cair.",
          "É por isso que dois viajantes atravessam a mesma floresta e encontram dois caminhos diferentes. A floresta se lembra de cada um deles. Separadamente.",
        ],
      },
      {
        arte: "ruinas",
        titulo: "A Coroa Partida",
        texto: [
          "Houve uma cidade no centro do mundo. Cinco reinos tentaram segurar os cinco Selos ao mesmo tempo, e o que se partiu naquele dia não foi só uma coroa.",
          "A primeira Tempestade de Éter durou onze anos. Quando passou, as estradas iam para lugares que não existiam mais.",
          "Da cidade sobrou um campo de colunas a um dia de caminhada da vila onde você vai acordar. Chamam de Ruínas de Aethra. Ninguém dorme lá.",
        ],
      },
      {
        arte: "selos",
        titulo: "E agora, de novo",
        texto: [
          "Faz três invernos que os sinais voltaram. O gelo de Morranvell range fora de estação. A Árvore-Mãe de Altaverde pulsa como um coração grande demais para o peito.",
          "Os Selos estão cedendo outra vez, e todo poder que sabe ler um sinal está fazendo a mesma coisa: procurando Herdeiros — gente capaz de ouvir a Memória do Mundo e mudá-la — antes que o vizinho os encontre primeiro.",
        ],
      },
      {
        arte: "retrato",
        titulo: "Você",
        texto: [
          "Você acordou entre as colunas, de barriga para cima, olhando um céu que não reconhecia.",
          "Suas mãos sabiam coisas. Sabiam o peso certo de uma arma, o jeito de {classe} de entrar numa sala, os costumes de {origem} que ninguém precisa relembrar. O corpo inteiro sabia quem era.",
          "{marcaRaca}",
          "A cabeça, não. Nenhum rosto. Nenhuma casa. Nenhuma primeira lembrança — só o lugar onde deveria haver uma.",
        ],
      },
      {
        arte: "vazio",
        titulo: "O que ninguém entende",
        texto: [
          "O Ancião Doran passou três noites com a mão na terra das Ruínas, ouvindo, do jeito que os velhos de Altaverde ouvem.",
          "Ele encontrou a memória do incêndio de quatrocentos anos atrás. Encontrou o cavalo que morreu ali no inverno passado. Encontrou até a gralha.",
          "Não encontrou você. O chão onde você estava deitado não tem registro de ninguém ter se deitado nele.",
          "\"O mundo lembra de tudo\", ele disse. \"Você é a única coisa que ele esqueceu.\"",
        ],
      },
      {
        arte: "vila",
        titulo: "Vila de Aethra",
        texto: [
          "Eles te deram um nome de empréstimo — {nome} — e uma cama nos fundos, e um mês para decidir o que fazer com o resto.",
          "Hedra Raiz-Antiga, que fala pelo Círculo de Elyndor, foi a única que disse em voz alta o que os outros pensavam: uma pessoa sem passado não pode ser lida, não pode ser prevista, e não pode ser confiada.",
          "E uma pessoa que o Éter não fixou pode escrever por cima. É isso que assusta ela. É isso que, daqui a pouco, vai te salvar.",
          "{marcaMotivacao}",
        ],
      },
    ],
    // A primeira coisa que o jogo pede ao jogador não é matar três slimes.
    // É uma escolha sobre quem ele quer ser — e ela deixa marca de verdade
    // (flag + reputação + linha no diário), justamente para ensinar a
    // gramática do jogo na primeira tela: você escolhe, o mundo lembra.
    escolha: {
      pergunta: "Um mês se passou. Doran pergunta, na frente da vila inteira, o que você pretende fazer.",
      opcoes: [
        {
          id: "procurar",
          rotulo: "\"Vou descobrir quem me apagou.\"",
          resultado: "Doran assente devagar. Hedra não gosta da resposta — quem procura o próprio passado costuma desenterrar o dos outros junto. Mas a vila respeita quem diz a verdade em voz alta, mesmo quando a verdade é inconveniente.",
          flag: "prologo_procurar",
          reputacao: { vila: 4 },
          diario: { icone: "🔍", titulo: "O que você respondeu a Doran", texto: "Diante da vila, você disse que vai descobrir quem apagou seu nome da memória do mundo." },
        },
        {
          id: "servir",
          rotulo: "\"Vou ser útil aqui. O resto pode esperar.\"",
          resultado: "É a resposta que uma vila em escassez queria ouvir, e eles não escondem o alívio. Hedra te olha por um segundo a mais que o necessário: gente sem passado que se oferece para servir é exatamente o que o Círculo aprendeu a vigiar.",
          flag: "prologo_servir",
          reputacao: { vila: 8 },
          diario: { icone: "🤝", titulo: "O que você respondeu a Doran", texto: "Você escolheu a vila antes da própria história — e Altaverde não esqueceu isso." },
        },
        {
          id: "calar",
          rotulo: "Não responder nada.",
          resultado: "O silêncio dura o suficiente para virar resposta. Doran encerra a reunião sem insistir. Hedra, ao sair, diz a alguém — alto o bastante para você ouvir — que gente que não se explica raramente melhora com o tempo.",
          flag: "prologo_calar",
          reputacao: { vila: -3 },
          diario: { icone: "🤐", titulo: "O que você respondeu a Doran", texto: "Você não respondeu. A vila tirou suas próprias conclusões." },
        },
      ],
      // UMA QUARTA RESPOSTA, só para quem tem a origem certa. As três acima
      // qualquer herdeiro pode dar; esta o personagem só consegue dar porque
      // veio de onde veio — e é a primeira vez no jogo que a origem escolhida
      // na criação aparece como uma FALA, não como um número de ficha. Vale a
      // mesma reputação com a vila das outras respostas, mais um laço com o
      // povo de onde a origem vem: a resposta abre uma porta que as outras não
      // abrem, em vez de ser simplesmente melhor. Ver opcoesDaCena em
      // CutsceneSystem.js — a opção entra na lista e é resolvida pelo mesmo
      // motor das outras, sem caminho paralelo.
      opcoesPorOrigem: {
        soldado: {
          rotulo: "\"Me deem uma arma e um posto. Quem eu era decide depois.\"",
          resultado: "Doran olha para as suas mãos antes de olhar para o seu rosto — elas já estavam na posição de quem espera ordem. Um veterano da Legião das Cinzas que passava a semana na vila ouve a resposta e anota seu nome de empréstimo num caderno gasto. Hedra não diz nada, o que, vindo dela, é quase aprovação.",
          flag: "prologo_origem_soldado",
          reputacao: { vila: 5, legiao_das_cinzas: 6 },
          diario: { icone: "🎖️", titulo: "O que você respondeu a Doran", texto: "Você se ofereceu como soldado antes de se oferecer como pessoa — e a Legião das Cinzas anotou seu nome." },
        },
        nobre: {
          rotulo: "\"Mandem um corvo a Aethra. Alguém na corte reconhece este rosto.\"",
          resultado: "Ninguém na vila esperava que a pessoa sem passado desse uma ordem. O corvo parte no mesmo dia. A resposta da Coroa demora três semanas e não confirma nada — mas também não nega, e vem com o selo certo, o que em Aethra já é meio caminho.",
          flag: "prologo_origem_nobre",
          reputacao: { vila: 2, coroa_de_aethra: 6 },
          diario: { icone: "👑", titulo: "O que você respondeu a Doran", texto: "Você mandou um corvo à Coroa de Aethra. Ela não confirmou quem você é — e não negou." },
        },
        criminoso: {
          rotulo: "\"Não perguntem o que eu fazia. Perguntem o que eu sei fazer.\"",
          resultado: "Metade da vila entende exatamente o que isso quer dizer. Um tratador da Caravana de Karn, encostado no portão, ri sozinho e depois te procura à noite — tem carga que precisa de alguém que não faça perguntas, e o serviço paga. Hedra passa a contar as ferramentas do galpão duas vezes por semana.",
          flag: "prologo_origem_criminoso",
          reputacao: { vila: -1, caravana_de_karn: 7 },
          diario: { icone: "🎭", titulo: "O que você respondeu a Doran", texto: "Você não explicou seu passado, e a Caravana de Karn gostou justamente disso." },
        },
        eremita: {
          rotulo: "\"Vou voltar para a mata. É onde o mundo fala mais alto.\"",
          resultado: "Doran para de ouvir a vila e passa a ouvir você. Foi exatamente assim que ele encontrou a memória do incêndio de quatrocentos anos atrás — com a mão na terra e a boca fechada. Uma batedora dos Guardiões da Folha Verde te alcança na saída e diz onde acampar sem ser incomodado.",
          flag: "prologo_origem_eremita",
          reputacao: { vila: 1, guardioes_da_folha: 7 },
          diario: { icone: "🌲", titulo: "O que você respondeu a Doran", texto: "Você escolheu a mata em vez da praça, e os Guardiões da Folha Verde entenderam o recado." },
        },
        andarilho_do_povo: {
          rotulo: "\"Já fui de todo lugar e de lugar nenhum. Esta vila serve.\"",
          resultado: "A frase corre a vila antes do fim da tarde, com a precisão de quem sabe repetir uma boa frase. Você não prometeu nada e, mesmo assim, foi a resposta que mais gente gostou — porque não soou como favor nem como fuga, soou como alguém puxando um banco na mesa.",
          flag: "prologo_origem_andarilho",
          reputacao: { vila: 9 },
          diario: { icone: "🥾", titulo: "O que você respondeu a Doran", texto: "Você disse que esta vila serve, e Altaverde te tratou como gente da casa desde então." },
        },
        sabio: {
          rotulo: "\"Se o mundo não me registrou, há um registro errado em algum lugar.\"",
          resultado: "Doran demora a responder porque nunca tinha pensado o problema desse jeito: se a Memória do Mundo não te tem, então ela tem uma lacuna — e lacuna é um erro de arquivo, não um milagre. Uma carta da Ordem dos Arquivistas Perdidos chega antes do fim do mês, endereçada ao \"leitor da vila\".",
          flag: "prologo_origem_sabio",
          reputacao: { vila: 2, ordem_dos_arquivistas: 7 },
          diario: { icone: "📜", titulo: "O que você respondeu a Doran", texto: "Você tratou seu próprio apagamento como um erro de arquivo — e a Ordem dos Arquivistas Perdidos escreveu de volta." },
        },
      },
    },
  },

  // ---------------------------------------------------------------------
  // ABERTURAS DE QUESTLINE. Rodam quando o jogador aceita o PRIMEIRO passo
  // de uma linha regional (ver CutsceneSystem.js: cenaDeAbertura). Duas
  // funções: dizer o que está em jogo naquela região antes do primeiro
  // objetivo, e dar voz ao NPC que puxa a linha — ele deixa de ser um card
  // com botão "Aceitar" e passa a ser alguém pedindo alguma coisa.
  //
  // As regiões listadas aqui são as que o jogador alcança cedo e as que têm
  // a linha mais afiada. As demais recebem uma abertura montada em runtime a
  // partir do `nome` e do `revela` da própria questline — texto que já foi
  // escrito com cuidado em regionalQuests.js. Melhor uma abertura honesta
  // derivada do conteúdo real do que dezessete cenas escritas às pressas.
  // ---------------------------------------------------------------------
  {
    id: "abre_altaverde",
    titulo: "A Caça que Não Volta",
    quando: "questline:altaverde",
    paineis: [
      {
        arte: "bosque",
        texto: [
          "Elric não fala enquanto anda. Só na terceira armadilha vazia ele para e diz o que está incomodando.",
          "\"Não é caça escassa. Caça escassa deixa pegada velha e pegada nova. Aqui só tem velha.\"",
          "\"Alguma coisa entrou no bosque e os bichos foram embora de uma vez. Isso não é fome. Isso é fuga.\"",
        ],
      },
      {
        arte: "arvore",
        texto: [
          "A Árvore-Mãe está pulsando. Dá para sentir pela sola do pé, um compasso a cada quatro segundos, como se alguma coisa grande estivesse tentando lembrar de algo.",
          "O Círculo de Elyndor sabe. O Círculo sabe há meses.",
          "E não mandou ninguém.",
        ],
      },
    ],
  },
  {
    id: "abre_morranvell",
    titulo: "O Juramento Partido",
    quando: "questline:morranvell",
    paineis: [
      {
        arte: "gelo",
        texto: [
          "Em Morranvell nada se escreve. O que vale é a palavra dita em voz alta, diante de testemunhas, no Salão dos Juramentos — e a pedra do salão guarda cada uma delas.",
          "O velho jarl morreu no meio de uma frase.",
          "Duas linhas de clã ouviram o mesmo velório e saíram dele com dois finais diferentes. Nenhuma das duas está mentindo. É isso que torna o problema insolúvel.",
        ],
      },
    ],
  },
  {
    id: "abre_vale_do_vento",
    titulo: "O Pedágio do Vento",
    quando: "questline:vale_do_vento",
    paineis: [
      {
        arte: "vento",
        texto: [
          "A Liga dos Ventos se orgulha de manter todas as estradas abertas. É verdade. Elas estão abertas.",
          "Do lado de fora do muro de Aerwind há uma fila que não anda há tanto tempo que virou bairro: barracas com nome, crianças que nasceram na fila, um poço que alguém cavou porque ia demorar.",
          "Sarnia te pede uma coisa só, para começar: conte quantos são. Ninguém nunca contou.",
        ],
      },
    ],
  },
  {
    id: "abre_bosque_eterno",
    titulo: "O Bosque que Não Deixa Sair",
    quando: "questline:bosque_eterno",
    paineis: [
      {
        arte: "bosque",
        texto: [
          "Todo mundo que entra no Bosque Eterno sai. Esse nunca foi o problema.",
          "O problema é que saem sem algumas horas, e sem conseguir dizer quais.",
          "As árvores aqui são velhas o bastante para terem memória própria — e memória velha, quando encosta na sua, às vezes leva um pedaço junto por engano.",
        ],
      },
    ],
  },
  {
    id: "abre_costa_da_mare",
    titulo: "O Que a Maré Devolve",
    quando: "questline:costa_da_mare",
    paineis: [
      {
        arte: "mare",
        texto: [
          "Na Costa da Maré, falsificar um mapa é crime quase igual a matar. A razão é prática: mapa errado mata mais gente que faca.",
          "Faz duas estações que as cartas da costa norte pararam de bater com a costa norte.",
          "Os Navegadores de Maris juram que não mudaram nada. E é justamente por isso que o assunto é grave.",
        ],
      },
    ],
  },
];

// --- Consultas --------------------------------------------------------------
const POR_ID = new Map(CUTSCENES.map((c) => [c.id, c]));
export const cutscenePorId = (id) => POR_ID.get(id) || null;
export const cutscenePorGatilho = (quando) => CUTSCENES.find((c) => c.quando === quando) || null;
