// Códice da Mitologia (pedido do usuário: "adicione também os detalhes da
// história... o livro com toda mitologia do universo do jogo"). Texto
// transcrito do PDF "Herdeiros de Aethra - Livro da Mitologia" (Códice dos
// Primeiros Herdeiros). Os capítulos XIV, XV e XVI do livro original são
// notas de produção endereçadas a roteiristas/designers ("Como a mitologia
// deve aparecer na jogabilidade", "Cronologia resumida para roteiristas e
// designers", "Princípios narrativos do HDA") — não são lore in-fiction, por
// isso ficam de fora do Códice desbloqueável do jogador (mantidos como
// referência de produção para guiar textos futuros, não como conteúdo pro
// personagem ler).
//
// Desbloqueio: cada capítulo verifica uma condição simples e monotônica
// sobre o personagem (nível, zonas exploradas, missões concluídas, abates
// registrados no compêndio, facção afiliada) — todos campos que já existem
// e são salvos, nada novo pra persistir. `condicaoDescricao` é o texto
// mostrado enquanto o capítulo está bloqueado.

export const MYTHOLOGY_CHAPTERS = [
  {
    id: "prologo",
    titulo: "Prólogo — O mundo que se lembra",
    epigrafe: "\"Toda montanha guarda um nome anterior ao nosso. Todo rio sabe para onde corria antes de os homens aprenderem a desenhar mapas.\"",
    paragrafos: [
      "Aethra é um mundo vivo, não apenas no sentido natural, mas no sentido literal. Rochas, rios, tempestades, ruínas e seres possuem memória residual de uma energia primordial chamada Éter. Quando grandes emoções, mortes, pactos ou catástrofes ocorrem, o Éter registra essas marcas no território. Por isso, dois viajantes podem atravessar a mesma floresta e encontrar versões diferentes do mesmo caminho: Aethra responde à história de quem o percorre.",
      "O termo Herdeiro não significa descendente de uma linhagem real. É um título antigo dado àqueles capazes de ouvir, suportar e alterar a Memória do Mundo. Alguns nascem sensíveis ao Éter. Outros tornam-se Herdeiros após sobreviver a um Despertar. Outros ainda são escolhidos por artefatos, entidades ou lugares. A principal disputa da história de Aethra não é por tronos, mas pelo direito de decidir o que o mundo deve lembrar e o que deve esquecer.",
    ],
    condicao: () => true,
    condicaoDescricao: "Sempre disponível.",
  },
  {
    id: "cap1",
    titulo: "I — A Criação: antes da primeira luz",
    epigrafe: "\"No princípio não havia vazio. Havia possibilidade.\"",
    paragrafos: [
      "Antes de Aethra existia o Mar Sem Forma, uma realidade sem distância, tempo ou matéria. Nele flutuavam sete impulsos primordiais, conhecidos posteriormente como os Sete Princípios: Forma, Movimento, Calor, Frio, Vida, Memória e Vontade. Eles não eram deuses; eram tendências do próprio universo, incapazes de consciência individual.",
      "O primeiro acontecimento foi chamado de Convergência. Memória encontrou Vontade e, pela primeira vez, algo desejou continuar existindo. Dessa união nasceu Elyndor, a primeira consciência. Elyndor não tinha corpo e não possuía gênero; era uma mente feita de lembrança e intenção. Ao perceber os demais Princípios, Elyndor começou a nomeá-los. E em Aethra, nomear significa dar limite. Assim surgiram as primeiras leis do mundo.",
      "Para impedir que a existência se dissolvesse novamente no Mar Sem Forma, Elyndor partiu a própria essência em cinco Grandes Selos. Cada selo ancorou um aspecto da realidade. Os fragmentos lançados entre eles condensaram-se como Éter: a substância que conecta matéria, magia, lembrança e destino.",
      "Selo da Pedra — estabilidade e matéria — reflexo: montanhas, metais, ossos e fortalezas. Selo da Maré — mudança e fluxo — reflexo: água, ciclos, cura e transformação. Selo da Chama — impulso e renovação — reflexo: fogo, paixão, destruição e forja. Selo do Véu — limite e mistério — reflexo: sombra, morte, sonho e passagem. Selo do Céu — movimento e possibilidade — reflexo: vento, relâmpago, liberdade e destino.",
      "Quando os cinco Selos se estabilizaram, o centro entre eles se tornou a região que mais tarde receberia o nome de Aethra. O mundo nasceu, portanto, não como obra de um deus artesão, mas como uma tentativa de impedir que toda possibilidade voltasse a ser nada.",
    ],
    condicao: (p) => (p.nivel || 1) >= 2,
    condicaoDescricao: "Alcance o nível 2.",
  },
  {
    id: "cap2",
    titulo: "II — Os Deuses, Guardiões e Falsos Deuses",
    paragrafos: [
      "Os povos atuais chamam de deuses entidades de naturezas muito diferentes. A teologia de Aethra distingue quatro categorias: Princípios, Guardiões, Ascendidos e Deuses de Máscara. A confusão entre elas alimentou guerras religiosas por milênios.",
      "Os Cinco Guardiões dos Selos — Elyndor, o que Recorda: fragmento consciente da entidade original, associado ao equilíbrio, árvores ancestrais, cura e memória; seus sacerdotes afirmam que Elyndor não governa a natureza, ele impede que ela esqueça como se regenerar. Morran, a Coroa de Gelo: guardião do Frio, da disciplina e da preservação — não representa crueldade, mas a necessidade de conservar aquilo que não pode ser perdido. Rubra, a Forjadora: entidade da chama, da transformação e do preço — sua doutrina ensina que nada valioso surge sem perda de forma anterior. Maris, Senhora das Correntes: guardiã das rotas, mudanças e encontros — navegadores acreditam que todo destino é uma corrente, que pode ser seguida, combatida ou desviada, mas nunca ignorada. Aerwind, o Caminho Aberto: guardião do vento e da possibilidade, cultuado por viajantes, mensageiros, inventores e fugitivos.",
      "Os Ascendidos são mortais ou criaturas que acumularam Éter, memória e culto suficientes para continuar existindo após a morte física. Podem conceder bênçãos e responder a rituais, mas não controlam leis fundamentais — a maioria dos santos, reis-deuses, patronos de cidades e espíritos ancestrais pertence a esta categoria.",
      "Os mais perigosos seres religiosos são os Deuses de Máscara. Eles surgem quando uma entidade do Véu aprende a usar uma crença coletiva como identidade. Quanto mais pessoas acreditam em determinada imagem, mais estável se torna a máscara — um Deus de Máscara pode parecer benevolente durante gerações e tornar-se monstruoso quando a cultura que o sustenta muda.",
    ],
    condicao: (p) => (p.nivel || 1) >= 3,
    condicaoDescricao: "Alcance o nível 3.",
  },
  {
    id: "cap3",
    titulo: "III — O Éter e as Leis da Magia",
    epigrafe: "\"Magia é memória convencendo a matéria de que ela já foi outra coisa.\"",
    paragrafos: [
      "Éter é a substância invisível deixada entre os Grandes Selos. Ele existe em tudo, mas concentra-se em criaturas, ruínas, lugares de forte emoção e fenômenos naturais. Magia não cria energia do nada; ela reorganiza possibilidades registradas no Éter.",
      "Todo uso de magia exige três componentes: Intenção, Forma e Custo. A Intenção define o que o conjurador deseja. A Forma determina como esse desejo será imposto ao mundo — gesto, runa, canto, arma, pacto ou mecanismo. O Custo é o desequilíbrio produzido pela alteração. Custos pequenos se dissipam; custos grandes deixam Cicatrizes Etéricas.",
      "As seis correntes elementais: Chama (Calor + Vontade) queima, rompe, transforma. Maré (Movimento + Vida) cura, adapta, conduz. Geada (Frio + Memória) preserva, desacelera, cristaliza. Vendaval (Movimento + Vontade) move, dispersa, acelera. Pedra (Forma + Memória) protege, ancora, fortalece. Umbral (Véu + Memória) oculta, desloca, corrói identidade.",
      "Combinações elementais não são acidentes: são reencontros entre Princípios. Água e raio conduzem intenção; gelo e água aprisionam movimento; fogo e vento propagam transformação. Magos experientes não perguntam apenas \"qual elemento causa mais dano?\", mas \"qual estado do mundo posso preparar para que outra força o complete?\".",
      "Quando muitas Cicatrizes Etéricas se sobrepõem, o mundo tenta corrigir o desequilíbrio. O resultado é uma Tempestade de Éter: clima, espaço e memória entram em conflito. Estradas mudam, monstros sofrem mutações, mortos podem ser ouvidos e construções antigas reaparecem temporariamente. Algumas eras terminaram após tempestades que duraram anos.",
    ],
    condicao: (p) => (p.nivel || 1) >= 4,
    condicaoDescricao: "Alcance o nível 4.",
  },
  {
    id: "cap4",
    titulo: "IV — As Sete Eras de Aethra",
    paragrafos: [
      "1. Era do Primeiro Nome — Elyndor define os Grandes Selos. Surgem mares, continentes e os primeiros seres elementais. Não existem povos mortais organizados.",
      "2. Era dos Titãs — Criaturas colossais moldam o relevo ao caminhar. Seus ossos tornam-se montanhas e seus órgãos mineralizados originam metais lendários.",
      "3. Era das Cidades-Luz — Primeiras civilizações humanas, élficas, anãs e híbridas dominam runas e máquinas etéricas. A atual região das Ruínas de Aethra torna-se o centro do mundo conhecido.",
      "4. Era da Coroa Partida — Reinos tentam controlar simultaneamente os cinco Selos. Começa a Guerra dos Herdeiros. A capital central é destruída e o mundo sofre a primeira grande Tempestade de Éter.",
      "5. Era das Cinzas — Rotas desaparecem, povos migram e antigas tecnologias são tratadas como religião. Surgem facções modernas como o Círculo de Elyndor e a Ordem da Chama Rubra.",
      "6. Era dos Portais — Fendas ancestrais voltam a funcionar. Regiões distantes tornam-se acessíveis, mas entidades do Véu também encontram caminhos para o mundo físico.",
      "7. Era dos Novos Herdeiros — Era atual. Sinais indicam que os Grandes Selos estão enfraquecendo. Várias facções buscam novos Herdeiros antes que outra Coroa Partida seja formada.",
    ],
    condicao: (p) => (p.nivel || 1) >= 5,
    condicaoDescricao: "Alcance o nível 5.",
  },
  {
    id: "cap5",
    titulo: "V — Atlas Mitológico: as Grandes Regiões",
    paragrafos: [
      "As dezessete grandes regiões de Aethra — de Altaverde, terra do equilíbrio, às profundezas sem nome do Abismo de Naz'thal — estão catalogadas no Atlas do Mapa-Múndi (tecla U). Cada região carrega sua própria presença dominante, seus locais lendários e as marcas que o Éter deixou nela.",
    ],
    condicao: (p) => (p.locaisExplorados || []).length >= 3,
    condicaoDescricao: "Explore 3 pontos de interesse diferentes no mundo.",
  },
  {
    id: "cap6",
    titulo: "VI — Povos e Culturas",
    paragrafos: [
      "Elyndorianos — comunidades de Altaverde e planícies centrais que tratam memória como responsabilidade pública. Árvores funerárias recebem placas com histórias dos mortos.",
      "Morranos — clãs de montanha. Valorizam palavra dada, resistência e genealogia. Um juramento quebrado pode excluir uma família de rotas e abrigos por gerações.",
      "Aerwindianos — povos do vento. Preferem contratos curtos e alianças voluntárias. Crianças recebem seu primeiro mapa antes de receber uma arma.",
      "Marianos — habitantes costeiros e navegadores. Consideram correnteza, comércio e informação partes da mesma arte. Mapas falsos são crime quase equivalente a assassinato.",
      "Umbríacos — tribos que vivem próximas ao Véu. Não veem sombra como maldade; veem-na como segunda identidade. Alguns ritos de maturidade exigem enfrentar a própria sombra separada.",
      "Arenthianos — povos de oásis e caravanas. Guardam conhecimento em placas de vidro e areia encantada, já que papel raramente sobrevive às tempestades.",
      "Corallianos — povos anfíbios, humanos adaptados e habitantes marinhos. Suas cidades são construídas para existir parcialmente acima e abaixo da água.",
    ],
    condicao: (p) => (p.locaisExplorados || []).length >= 6,
    condicaoDescricao: "Explore 6 pontos de interesse diferentes no mundo.",
  },
  {
    id: "cap7",
    titulo: "VII — Facções que disputam o futuro",
    paragrafos: [
      "Círculo de Elyndor — deseja restaurar o equilíbrio dos Grandes Selos. Seus membros são curadores, druidas, pesquisadores de memória e diplomatas. Problema: alguns acreditam que preservar o mundo exige impedir mudanças sociais profundas.",
      "Ordem da Chama Rubra — defende que Aethra precisa ser reforjado, não preservado. Seus líderes buscam armas despertadas e aceitam grandes sacrifícios para impedir uma catástrofe maior.",
      "Liga dos Ventos — confederação de cidades e guildas independentes. Protege rotas e informação. Rejeita impérios, mas seus membros frequentemente entram em conflito entre si.",
      "Navegadores de Maris — rede de capitães, cartógrafos e mercadores. Mantêm rotas marítimas e conhece portais costeiros. Alguns praticam contrabando de artefatos.",
      "Cultistas do Éter — nome genérico para vários grupos que querem restaurar a civilização da Era das Cidades-Luz. Nem todos são malignos; o perigo está em repetir experiências que já quebraram o mundo.",
      "Tribos Umbríacas — aliança frouxa de povos da Selva Umbríaca. São especialistas em entidades do Véu e frequentemente tratados injustamente como cultistas sombrios.",
      "Clãs de Morranvell — casas guerreiras que guardam fortalezas glaciais e registros antigos. Discordam sobre abrir ou manter seladas conhecimentos preservados no gelo.",
    ],
    condicao: (p) => !!(p.estadoDoMundo && p.estadoDoMundo.facaoAfiliada),
    condicaoDescricao: "Afilie-se a uma facção no Compêndio.",
  },
  {
    id: "cap8",
    titulo: "VIII — Morte, Véu e o que existe depois",
    paragrafos: [
      "Quando uma pessoa morre, seu corpo retorna à matéria, sua energia se dissipa e sua Memória Etérica começa a atravessar o Véu. A maioria das memórias perde identidade individual e integra o Fluxo Profundo, uma camada de consciência coletiva que alguns chamam de \"mar dos ancestrais\".",
      "Fantasmas surgem quando uma lembrança possui Vontade suficiente para resistir à dissolução. Nem todo fantasma é a alma completa de uma pessoa; muitos são apenas uma emoção repetindo seu último significado. Por isso exorcizar pode significar compreender, não destruir.",
      "Ressurreição verdadeira é quase impossível porque exige reunir corpo, memória e vontade antes que o indivíduo se dissolva no Fluxo Profundo. Técnicas antigas podem reconstruir corpos, mas frequentemente trazem algo incompleto, alterado ou acompanhado por entidades que encontraram a passagem aberta.",
      "Os Sem-Nome — a maior tragédia espiritual de Aethra é tornar-se Sem-Nome: perder tantas partes da própria memória que o Véu não consegue reconhecer a identidade. Sem-Nome podem existir fisicamente, mas começam a copiar nomes, rostos e histórias de outras pessoas. Alguns chefes e antagonistas antigos pertencem a esta condição.",
    ],
    condicao: (p) => (p.nivel || 1) >= 7,
    condicaoDescricao: "Alcance o nível 7.",
  },
  {
    id: "cap9",
    titulo: "IX — Criaturas, monstros e ecologia mítica",
    paragrafos: [
      "Monstros de Aethra não constituem uma única categoria. Alguns são animais naturais adaptados ao Éter; outros são mutações de Tempestades; outros são constructos antigos, espíritos, fragmentos de Titãs ou seres do Véu.",
      "Feras etéricas — animais expostos a altas concentrações de Éter — desenvolvem afinidades elementais e territorialidade incomum. Constructos — máquinas e guardiões das Cidades-Luz — seguem ordens antigas, às vezes interpretadas literalmente. Ecos — memórias que adquiriram forma — repetem acontecimentos até serem interrompidas ou compreendidas. Vélicos — seres originados além do Véu — alteram percepção, identidade e espaço. Titânicos — fragmentos vivos de Titãs — agem como ecossistemas ambulantes ou bosses regionais. Corrompidos — seres desestabilizados por Cicatrizes Etéricas — misturam elementos e comportamentos imprevisíveis.",
      "A ecologia deve responder ao território. Lobos de Morranvell não são apenas versões de gelo de lobos comuns: caçam pelo som sob nevasca. Predadores Umbríacos podem atacar sombras antes do corpo. Criaturas do Lago Prismático alteram afinidade conforme o clima. Essa regra conecta lore, IA e combate — é a mesma lógica por trás do bônus de terreno elemental e dos arquétipos de comportamento já vistos no bestiário deste jogo.",
    ],
    condicao: (p) => {
      const c = p.compendio && p.compendio.abates ? p.compendio.abates : {};
      return Object.values(c).reduce((s, n) => s + n, 0) >= 15;
    },
    condicaoDescricao: "Derrote 15 monstros (contagem soma todos os tipos do Bestiário).",
  },
  {
    id: "cap10",
    titulo: "X — Artefatos, Armas Secretas e Despertares",
    paragrafos: [
      "Artefatos antigos armazenam Memórias de Uso. Uma espada utilizada durante séculos para defender uma ponte pode começar a \"lembrar\" proteção e responder melhor quando seu portador protege aliados. Esse princípio explica as Armas Secretas e seus Despertares.",
      "Um Despertar não é simplesmente melhoria de raridade. O artefato reconhece uma situação atual como equivalente a uma memória importante do passado e manifesta uma forma mais profunda. Por isso, despertar uma arma pode exigir decisões narrativas, rivalidades, lugares específicos ou ações em combate.",
      "A Coroa Partida — cinco fragmentos de um dispositivo criado para sincronizar os Grandes Selos. Reunidos, poderiam estabilizar Aethra ou permitir que alguém reescrevesse enormes partes da Memória do Mundo.",
      "Lâmina de Rubra — arma que muda de forma conforme aquilo que o portador aceita sacrificar. É impossível empunhá-la por muito tempo sem perder algo significativo.",
      "Bússola de Maris — não aponta norte; aponta para o lugar que o portador mais precisa encontrar. O problema é que \"precisar\" e \"querer\" raramente são a mesma coisa.",
      "Máscara Sem Rosto — artefato do Véu que permite assumir memórias superficiais de outra pessoa. Uso prolongado faz o portador esquecer quais lembranças são suas.",
      "Semente de Elyndor — fragmento da Árvore-Mãe capaz de restaurar uma região devastada. Para germinar, exige uma memória voluntariamente oferecida e perdida para sempre.",
    ],
    condicao: (p) => (p.nivel || 1) >= 9,
    condicaoDescricao: "Alcance o nível 9.",
  },
  {
    id: "cap11",
    titulo: "XI — Religiões, ritos e festas",
    paragrafos: [
      "Noite das Lanternas Vazias — celebrada em Altaverde. Famílias acendem lanternas sem nomes para lembrar pessoas cuja história foi perdida. Durante a noite, espíritos sem identidade podem se aproximar sem hostilidade.",
      "Juramento do Primeiro Inverno — cerimônia de Morranvell. Jovens escolhem uma promessa que será gravada em gelo encantado. Quebrá-la produz vergonha social e, segundo crença local, rachaduras reais na geleira.",
      "Corrida dos Sete Ventos — festival de Aerwind com planadores, montarias e corridas por plataformas. Algumas rotas só aparecem durante o evento devido às correntes sazonais.",
      "Maré dos Retornados — portos de Maris deixam uma vaga livre em cada mesa para navegadores desaparecidos. Há registros de pessoas retornando durante a cerimônia após décadas sumidas.",
      "Forja das Cinzas — rito Rubro no qual um objeto significativo é destruído e seu metal incorporado a uma nova ferramenta, simbolizando transformação consciente.",
    ],
    condicao: (p) => (p.missoesConcluidas || []).length >= 3,
    condicaoDescricao: "Conclua 3 missões.",
  },
  {
    id: "cap12",
    titulo: "XII — A Profecia dos Herdeiros",
    epigrafe: "\"Quando o Lago perder todas as cores, quando o gelo recordar fogo, quando a árvore produzir uma folha negra e a sombra de uma cidade cair antes de suas torres, cinco caminhos voltarão a apontar para o mesmo centro. Então o mundo perguntará novamente: quem decide o que merece permanecer?\"",
    paragrafos: [
      "A profecia aparece em versões diferentes em quase todas as culturas. O Círculo de Elyndor entende que cinco novos Herdeiros deverão restaurar os Selos. A Ordem Rubra acredita que os Selos precisam ser destruídos e reforjados. Cultistas do Éter afirmam que a profecia descreve a reconstrução da Coroa Partida. Nenhuma interpretação foi confirmada.",
      "Para o jogo, a profecia funciona melhor se nunca existir uma resposta totalmente \"correta\". O jogador deve poder descobrir evidências para interpretações conflitantes e decidir qual futuro construir. Isso permite múltiplos finais sem reduzir escolhas a bem versus mal.",
    ],
    condicao: (p) => (p.nivel || 1) >= 12,
    condicaoDescricao: "Alcance o nível 12.",
  },
  {
    id: "cap13",
    titulo: "XIII — Os Grandes Segredos do Mundo",
    paragrafos: [
      "Elyndor pode não ser o criador original — alguns registros das Ruínas de Aethra indicam que Elyndor também foi nomeado por algo anterior. Se verdadeiro, existe uma consciência além do Mar Sem Forma.",
      "Os Titãs podem ser Selos vivos — teorias antigas sugerem que os Titãs não surgiram depois da criação; eles seriam mecanismos biológicos usados para estabilizar regiões. Matá-los poderia enfraquecer o mundo.",
      "Sombralith não foi acidente — documentos incompletos indicam que a ruptura do Véu foi deliberada para esconder algo que não podia ser destruído.",
      "A Coroa Partida funcionou — a versão oficial diz que o dispositivo falhou. Outra hipótese diz que ele funcionou perfeitamente e alguém escolheu apagar do mundo o resultado.",
      "Os Herdeiros anteriores ainda existem — nomes de antigos Herdeiros desaparecem de registros no mesmo momento histórico. Eles podem ter sido mortos, apagados ou transformados em parte da própria Memória do Mundo.",
    ],
    condicao: (p) => (p.nivel || 1) >= 15,
    condicaoDescricao: "Alcance o nível 15.",
  },
  {
    id: "epilogo",
    titulo: "Epílogo — O mundo depois do jogador",
    epigrafe: "\"Herdar não é receber. É decidir o que fazer com aquilo que sobreviveu até você.\"",
    paragrafos: [
      "A história central de Herdeiros de Aethra deve terminar com uma transformação real do mundo. Os Grandes Selos podem ser restaurados, substituídos, destruídos, compartilhados entre povos ou incorporados aos próprios Herdeiros. Cada solução deve alterar regiões, facções, clima, magia e memória coletiva.",
      "Isso permite que o New Game+ seja canônico: uma nova jornada pode ser interpretada como outra possibilidade registrada no Éter, uma memória alternativa tentando provar que seu futuro também poderia ter existido. Dessa forma, repetição, escolhas divergentes e múltiplos finais tornam-se parte da própria cosmologia.",
      "Aethra existe porque alguma coisa, no início de tudo, decidiu lembrar. O conflito final pergunta ao jogador se lembrar de tudo é realmente o mesmo que preservar o que importa.",
    ],
    condicao: (p) => (p.nivel || 1) >= 18,
    condicaoDescricao: "Alcance o nível 18.",
  },
  {
    id: "apendice",
    titulo: "Apêndice — Vocabulário essencial",
    paragrafos: [
      "Éter: Substância que conecta matéria, magia, memória e destino.",
      "Memória do Mundo: Registro etérico acumulado em lugares, seres e objetos.",
      "Herdeiro: Pessoa capaz de perceber e alterar profundamente a Memória do Mundo.",
      "Despertar: Momento em que pessoa ou artefato acessa uma camada mais profunda de sua memória etérica.",
      "Cicatriz Etérica: Marca persistente causada por magia, emoção ou catástrofe de grande intensidade.",
      "Véu: Limite entre realidade material e o Fluxo Profundo.",
      "Fluxo Profundo: Camada onde memórias dissolvidas dos mortos se integram.",
      "Sem-Nome: Ser cuja identidade foi fragmentada a ponto de o Véu não reconhecê-lo.",
      "Grande Selo: Âncora cosmológica que mantém uma lei fundamental de Aethra.",
      "Tempestade de Éter: Resposta do mundo a desequilíbrios e Cicatrizes acumuladas.",
      "Ascendido: Mortal ou criatura que preservou identidade após a morte por meio do Éter e culto.",
      "Deus de Máscara: Entidade do Véu estabilizada por uma crença coletiva.",
    ],
    condicao: () => true,
    condicaoDescricao: "Sempre disponível.",
  },
];
