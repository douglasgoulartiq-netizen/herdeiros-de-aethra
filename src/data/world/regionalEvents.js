// EVENTOS REGIONAIS (ETAPA 3, itens 20, 26 e 34).
//
// Evento aqui é um ESTADO DECLARADO da região, não uma animação. Ele começa
// por uma condição (clima, hora, quest, World State), dura enquanto a
// condição valer, e enquanto durar ele muda três coisas concretas: o pool
// ecológico (via ecology.js MIGRACOES), a fala de NPCs que declaram um
// estado com `{tipo:"eventoAtivo"}`, e uma variável de World State.
//
// Nada disso roda por frame. O RegionalEventSystem avalia quando o jogador
// entra numa zona, quando muda a hora do dia e quando uma quest muda de
// estado — três momentos, não sessenta por segundo (item 40).
//
// AS DUAS CADEIAS DE INTERDEPENDÊNCIA (item 34)
// ---------------------------------------------
// CADEIA A — ALTAVERDE (a que o jogador encontra primeiro, de propósito):
//   ev_tempestade_eter_altaverde dispara com clima arcano no Bosque das Vozes
//   → mig_tempestade_eter_altaverde tira javali/touro/abelha da mata
//   → a caça de Elric seca (npc_cacador muda para o estado "migracao")
//   → vila_aethra_estado vai de "provida" para "escassez"
//   → Tobias, Doran, Baltazar e Mireu mudam de fala; a loja fica mais cara
//   → qr_altaverde_1 aparece na conversa com Elric
//   → o jogador acalma a raiz com Hedra (qr_altaverde_4)
//   → o evento encerra, a migração reverte, a vila volta a "provida"
//
// CADEIA B — RECIFE CORALINO (a mesma forma, ritmo diferente):
//   ev_branqueamento_recife dispara quando a Fenda Azul esquenta
//   → recife_estado = "branqueado"
//   → mig_branqueamento_recife leva o cardume para o Abismo Raso
//   → o Acampamento dos Pescadores perde a safra
//   → Corallia culpa os pescadores; a reputação com a Confraria trava
//   → qr_recife_coralino_2 aparece
//   → resolver esfria a Fenda e devolve o recife a "vivo"
export const EVENTOS_REGIONAIS = [
  // --- cadeia A -----------------------------------------------------------
  {
    id: "ev_tempestade_eter_altaverde",
    nome: "Tempestade de Éter no Bosque das Vozes",
    regiaoId: "altaverde",
    zonas: ["bosque_das_vozes", "floresta"],
    tipo: "tempestade",
    // Dispara com neblina no bosque — o clima que o WeatherSystem já sorteia
    // por zona — e só depois que o jogador tiver visto a vila pelo menos uma
    // vez, pra não abrir o jogo com a região em crise.
    gatilho: { clima: ["neblina"], zonaClima: "bosque_das_vozes", requerVisita: "vila" },
    duracao: "enquanto o clima durar ou até qr_altaverde_4",
    encerraCom: { questConcluida: "qr_altaverde_4" },
    aplica: {
      worldState: { vila_aethra_estado: "escassez" },
      migracao: "mig_tempestade_eter_altaverde",
      precoLoja: 1.35,
    },
    aviso: "O bosque está com a névoa errada. Não é névoa de rio — é névoa que brilha.",
    revertePara: { vila_aethra_estado: "provida", precoLoja: 1 },
  },
  // --- cadeia B -----------------------------------------------------------
  {
    id: "ev_branqueamento_recife",
    nome: "Branqueamento dos Jardins de Pérola",
    regiaoId: "recife_coralino",
    zonas: ["jardins_de_perola", "recife_tempestades", "abismo_raso"],
    tipo: "anomalia",
    gatilho: { questAtiva: "qr_recife_coralino_1" },
    duracao: "até a Fenda Azul esfriar",
    encerraCom: { questConcluida: "qr_recife_coralino_4" },
    aplica: {
      worldState: { recife_estado: "branqueado" },
      migracao: "mig_branqueamento_recife",
      reputacaoTravada: ["confraria_do_farol"],
    },
    aviso: "O coral do viveiro está branco até onde a vista alcança. Branco é osso.",
    revertePara: { recife_estado: "vivo" },
  },
  // --- eventos de estrada e território ------------------------------------
  {
    id: "ev_caravana_de_karn",
    nome: "Caravana em trânsito",
    regiaoId: "deserto_de_arenth",
    zonas: ["deserto_karn", "oasis_sete_sombras"],
    tipo: "caravana",
    gatilho: { hora: ["manha", "tarde"], clima: ["limpo"] },
    duracao: "um período do dia",
    aplica: { comercioExtra: true, encontroReduzido: 0.5 },
    aviso: "Poeira alta na estrada: a caravana está passando, e passar é a única coisa que ela faz.",
  },
  {
    id: "ev_patrulha_da_liga",
    nome: "Patrulha da Liga dos Ventos",
    regiaoId: "vale_do_vento",
    zonas: ["planicie_ventosa", "pontes_suspensas"],
    tipo: "patrulha",
    gatilho: { hora: ["tarde"] },
    duracao: "um período do dia",
    aplica: { encontroReduzido: 0.4, pedagio: true },
    aviso: "Lanças na estrada. A patrulha cobra pedágio, e cobra de quem passa, não de quem mora.",
  },
  {
    id: "ev_ponte_danificada",
    nome: "Passarela do setor leste cedeu",
    regiaoId: "pantano_de_thalgor",
    zonas: ["pantano_negro", "charco_fetido"],
    tipo: "ponte_danificada",
    gatilho: { clima: ["chuva", "tempestade"] },
    duracao: "até a chuva passar ou até qr_pantano_de_thalgor_3",
    encerraCom: { questConcluida: "qr_pantano_de_thalgor_3" },
    aplica: { rotaBloqueada: ["pantano_negro->charco_fetido"], worldState: { thalgor_passarelas: "rompidas" } },
    aviso: "A passarela do leste está na água. Dá pra atravessar nadando, e ninguém aqui recomenda nadar.",
    revertePara: { thalgor_passarelas: "inteiras" },
  },
  {
    id: "ev_animal_ferido",
    nome: "Bicho ferido na trilha",
    regiaoId: "bosque_eterno",
    zonas: ["floresta_ancestral", "portao_verde"],
    tipo: "animal_ferido",
    gatilho: { hora: ["manha"], aposEvento: null },
    duracao: "um período do dia",
    aplica: { escolha: ["curar", "abater", "ignorar"], reputacao: { guardioes_da_folha: 3 } },
    aviso: "Um javali com a pata presa em laço velho. O laço não é dos Guardiões — é do acampamento.",
  },
  {
    id: "ev_disputa_de_licenca",
    nome: "Discussão na boca da trilha",
    regiaoId: "bosque_eterno",
    zonas: ["floresta_ancestral"],
    tipo: "disputa",
    gatilho: { questAtiva: "qr_bosque_eterno_2" },
    duracao: "enquanto a quest estiver ativa",
    aplica: { worldState: { bosque_licenca: "contestada" } },
    aviso: "Lenhador e guardião frente a frente na boca da trilha, e nenhum dos dois quer ser o primeiro a recuar.",
  },
  {
    id: "ev_migracao_do_lobo_gelido",
    nome: "A matilha desceu",
    regiaoId: "morranvell",
    zonas: ["vale_das_geleiras", "pantano_bruma"],
    tipo: "migracao",
    gatilho: { clima: ["nevasca"], zonaClima: "trono_congelado" },
    duracao: "enquanto durar a nevasca",
    aplica: { migracao: "mig_nevasca_morranvell", encontroAumentado: 1.4 },
    aviso: "Pegada de lobo gélido a duzentos passos da muralha. Nunca chegam tão perto.",
  },
  {
    id: "ev_viajante_perdido",
    nome: "Viajante fora de rota",
    regiaoId: "sombralith",
    zonas: ["terras_esquecidas", "vale_dos_lamentos"],
    tipo: "viajante",
    gatilho: { hora: ["noite"], clima: ["neblina"] },
    duracao: "uma noite",
    aplica: { escolha: ["guiar", "informar", "seguir"], reputacao: { ordem_dos_arquivistas: 2 } },
    aviso: "Alguém andando em círculo no campo, sem lanterna. Em Sombralith isso pode ser gente e pode não ser.",
  },
  {
    id: "ev_ataque_ao_acampamento",
    nome: "Ataque ao acampamento",
    regiaoId: "vale_dos_titas",
    zonas: ["vale_pedras", "caverna_eco"],
    tipo: "ataque",
    gatilho: { worldState: { coracao_petrificado_estado: "quente" } },
    duracao: "enquanto o Coração estiver quente",
    aplica: { migracao: "mig_coracao_quente", encontroAumentado: 1.6, worldState: { titas_acampamento: "sob_ataque" } },
    aviso: "Golens descendo do monumento em direção à frente de escavação. Não é ataque: é fuga com peso.",
    revertePara: { titas_acampamento: "normal" },
  },
  {
    id: "ev_forja_acesa",
    nome: "A Cratera foi acesa",
    regiaoId: "montanhas_de_vulkor",
    zonas: ["cratera_primeiro_fogo"],
    tipo: "ritual",
    gatilho: { hora: ["manha"] },
    duracao: "a manhã inteira",
    aplica: { forjaBonus: true, comercioExtra: true },
    aviso: "Thorgrid acendeu a boca sagrada. Enquanto ela estiver acesa, o que se forja aqui sai melhor.",
  },
  {
    id: "ev_mare_de_carta",
    nome: "Chegada de comboio",
    regiaoId: "costa_da_mare",
    zonas: ["costa_aurora"],
    tipo: "caravana",
    gatilho: { hora: ["manha"], clima: ["limpo", "vento_forte"] },
    duracao: "uma manhã",
    aplica: { comercioExtra: true, worldState: { maris_doca: "cheia" } },
    aviso: "Doca cheia. Quem chega traz carta nova, e carta nova é o que move esta cidade.",
    revertePara: { maris_doca: "normal" },
  },
];

export const EVENTOS_POR_REGIAO = EVENTOS_REGIONAIS.reduce((acc, e) => {
  (acc[e.regiaoId] = acc[e.regiaoId] || []).push(e);
  return acc;
}, {});

export const eventoPorId = (id) => EVENTOS_REGIONAIS.find((e) => e.id === id) || null;
export const eventosDaZona = (zonaId) => EVENTOS_REGIONAIS.filter((e) => e.zonas.includes(zonaId));

// Os dois elos completos do item 34, declarados para o teste conferir cada
// degrau em vez de acreditar na descrição.
export const CADEIAS_DE_INTERDEPENDENCIA = [
  {
    id: "cadeia_altaverde",
    nome: "A caça que não volta",
    elos: [
      { passo: "clima", detalhe: "neblina de Éter no bosque_das_vozes", refere: "ev_tempestade_eter_altaverde" },
      { passo: "migracao", detalhe: "javali, touro e abelha saem da mata", refere: "mig_tempestade_eter_altaverde" },
      { passo: "npc", detalhe: "Elric perde a caça e muda de fala", refere: "npc_cacador" },
      { passo: "worldState", detalhe: "vila_aethra_estado = escassez", refere: "vila_aethra_estado" },
      { passo: "npc", detalhe: "Tobias, Doran, Baltazar e Mireu mudam de fala", refere: "npc_fazendeiro" },
      { passo: "economia", detalhe: "preço da loja sobe 35%", refere: "precoLoja" },
      { passo: "quest", detalhe: "qr_altaverde_1 aparece", refere: "qr_altaverde_1" },
      { passo: "resolucao", detalhe: "qr_altaverde_4 acalma a raiz", refere: "qr_altaverde_4" },
      { passo: "estadoFinal", detalhe: "drenar recupera a vila e emudece a árvore; esperar preserva a árvore e mantém a escassez", refere: "vila_aethra_estado" },
    ],
  },
  {
    id: "cadeia_recife",
    nome: "A maré que não volta",
    elos: [
      { passo: "anomalia", detalhe: "a Fenda Azul esquenta", refere: "ev_branqueamento_recife" },
      { passo: "worldState", detalhe: "recife_estado = branqueado", refere: "recife_estado" },
      { passo: "migracao", detalhe: "caranguejo e enguia vão para o abismo_raso", refere: "mig_branqueamento_recife" },
      { passo: "npc", detalhe: "o acampamento dos pescadores perde a safra", refere: "npc_rc_marul" },
      { passo: "faccao", detalhe: "Corallia culpa os pescadores; reputação trava", refere: "confraria_do_farol" },
      { passo: "quest", detalhe: "qr_recife_coralino_2 aparece", refere: "qr_recife_coralino_2" },
      { passo: "resolucao", detalhe: "qr_recife_coralino_4 esfria a Fenda", refere: "qr_recife_coralino_4" },
      { passo: "estadoFinal", detalhe: "recife volta a vivo e o cardume retorna", refere: "recife_estado" },
    ],
  },
];
