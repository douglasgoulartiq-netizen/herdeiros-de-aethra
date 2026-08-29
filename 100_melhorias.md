# 100 melhorias — Herdeiros de Aethra

Lista construída em cima do que **já existe e já funciona** no jogo (sistemas em `src/systems/`, telas em `src/ui/`, o painel de contexto de batalha e o visual "UX Combat" adicionados nesta sessão). Não repete o que já foi implementado — combate animado com dado/golpes/números flutuantes, telegraph de inimigo e chefe, barra de postura, combo elemental prévio, badges de vantagem/resistência/imunidade elemental, sinergia de formação/facção visível na tela de time, pity e taxas de gacha visíveis antes do pull, indicador de save, dificuldade ajustável, fonte grande/gigante, alto contraste, safe-area no touch, velocidade de animação e o toggle de Auto batalha dentro da própria tela de combate. Isso já está de pé; a lista abaixo é sobre o que ainda falta.

Cada item tem uma prioridade (Alta = afeta a sessão toda ou a confiança do jogador · Média = melhora um sistema específico · Baixa = polimento) e, quando fizer sentido, o sistema/arquivo que ele estende — nada aqui pede recriar um sistema do zero.

---

## 1. Combate tático, momento a momento (1–15)

1. **(Alta)** Pré-visualização de dano estimado antes de confirmar Atacar/Habilidade (faixa, não número exato) — hoje o combo elemental já tem prévia, mas o dano em si só aparece depois do golpe.
2. **(Alta)** Mostrar o motivo de uma esquiva/bloqueio no log ("Slime esquivou: seu d20 total 14 não superou a defesa 16"), não só o resultado — fecha a lacuna de "por que errei".
3. **(Média)** Ação de Reação: permitir 1 interrupção por rodada (contra-ataque de Duelista, escudo de Defensor) em vez de só ação principal + defender, seguindo a economia de ações do combate tático.
4. **(Média)** Alcance/área visível antes de confirmar habilidades em área (Sopro Elemental já existe; falta prévia de quem será atingido antes do clique).
5. **(Média)** Papéis de combate como linguagem explícita na ficha (Defensor/Duelista/Atirador/Controlador/Suporte/Curandeiro) — hoje a classe define isso implicitamente; nomear ajuda a montar time.
6. **(Média)** Vulnerabilidade única por personagem (ex.: "recebe dano dobrado quando atordoado") além da resistência elemental — aprofunda identidade sem inflar números.
7. **(Média)** Terreno de batalha com efeito jogável, não só visual (a v1.1 UX Combat já tinge o fundo por elemento dominante — dar 1 efeito por terreno: `agua` melhora chance de crítico de raio, `fogo` incendeia status de veneno etc., como já é sugerido em `elementoDominante`).
8. **(Média)** Limite de "desfazer seleção de alvo" antes de confirmar (não desfazer resultado, só a escolha) quando nenhuma informação nova foi revelada.
9. **(Baixa)** Log de combate expansível: resumo de 1 linha por padrão, clique para ver rolagem completa (d20 + atributo + modificadores) — hoje o log já é compacto, falta o detalhe sob demanda.
10. **(Média)** IA de inimigo por comportamento nomeado (caçador cerca isolados, artilheiro força movimento, ladrão rouba e foge) reaproveitando `EnemyAI.js`/`EnemyBehaviors.json` que já categorizam ataques — falta ligar o comportamento à escolha tática, não só ao dano.
11. **(Alta)** Fase 2 de chefe que muda regra, não só reduz vida — ex.: ao quebrar postura pela metade, o chefe troca de padrão de ataque (já há postura/stun; falta a transição de fase).
12. **(Baixa)** Indicador de janela de resposta pós-telegraph ("você tem 1 turno para reagir") explícito no texto do telegraph, hoje só implícito.
13. **(Média)** Impedir imunidade total permanente de chefe a um estilo — garantir que toda "resistência intensa"/"imune" tenha uma janela (ex.: some durante postura quebrada).
14. **(Baixa)** Efeito sonoro opcional (WebAudio simples, sem asset externo) sincronizado com dado/golpe/crítico, com volume separado nas opções — hoje o jogo é 100% visual.
15. **(Média)** Confirmar apenas ações irreversíveis de risco real (Fugir, item raro) — ações reversíveis e frequentes (Atacar, Defender) já não pedem confirmação, o que está certo; documentar isso como regra explícita para não regressão futura.

## 2. Modo automático, ritmo e antigrind (16–23)

16. **(Média)** Log de resumo ao desligar o Auto batalha ("6 vitórias, 2 fugas, 340 XP, 210 ouro") — item já identificado em `20_pontos_de_melhoria.md` #6, ainda em aberto.
17. **(Baixa)** Prioridade de alvo configurável no automático (chefe > baú > coleta > NPC) — item #7 do documento anterior, ainda em aberto.
18. **(Média)** Repetição inteligente de masmorra já concluída (varredura rápida sem re-narrar diálogos/eventos já vistos) para quem quer fazer XP/loot sem grind manual.
19. **(Média)** Garantir progresso relevante mesmo numa fuga/derrota no automático (XP parcial, não just voltar pra vila de mãos vazias) sem tornar a derrota a rota ótima de farm.
20. **(Baixa)** Aviso único (não repetido) quando o automático entra em loop improdutivo (ex.: mesma zona 5 vezes sem avanço de missão/loot novo).
21. **(Média)** Multiplicador de velocidade do próprio automático fora de combate (o `velocidadeAnimacaoCombate` já cobre a luta; falta o mesmo para movimento/interação no mapa).
22. **(Baixa)** Contador visível de "tempo total em automático nesta sessão" como referência para o jogador decidir se quer assumir o controle.
23. **(Média)** Permitir pausar o automático em um ponto de decisão específico (ex.: antes de entrar na sala do chefe) via uma flag simples de "parar antes de: chefe".

## 3. Progressão de personagem e talentos (24–31)

24. **(Alta)** Funções alternativas para personagens antigos: um "modo" ou talento que muda o padrão de uso de uma classe já existente (ex.: Guerreiro tanque vira Guerreiro de dano com um talento exclusivo), em vez de só subir número — `SkillTreeUI.js`/skillTrees.json já existem, falta ramificação mutuamente exclusiva.
25. **(Média)** Pelo menos 2 talentos mutuamente exclusivos por árvore (escolher A fecha B), forçando build, não coleção de tudo.
26. **(Média)** Equipamento que muda padrão de uso, não só stat (ex.: arma que troca alcance por dano, ou converte cura em escudo) — hoje raridade escala poder linear; falta 1–2 itens por raridade que mudem o "como jogar".
27. **(Baixa)** Ataque combinado desbloqueável por rivalidade/afinidade entre dois personagens específicos (ver item 40) contabilizado como progressão horizontal, não vertical.
28. **(Média)** Modificador de expedição escolhido pelo jogador antes de entrar numa masmorra (ex.: "+20% loot, -1 desfazer" ou "monstros mais fortes, XP em dobro") — dá agência sem exigir New Game+.
29. **(Baixa)** Resetar árvore de talentos com custo simbólico (não ouro/gacha) para quem errou a build, evitando arrependimento permanente.
30. **(Média)** Tela de "build sugerida" por papel (Defensor/Curandeiro/etc.) como ponto de partida opcional, não obrigatório, para reduzir paralisia de escolha no início.
31. **(Baixa)** Indicador de "próximo marco" na progressão (nível, talento, ou equipamento) sempre visível no HUD de personagem, para dar direção sem forçar checklist.

## 4. Gacha, coleção e economia (32–41)

32. **(Média)** Variação cosmética ou passiva leve nas primeiras 1–3 duplicatas (o sistema já converte parte da duplicata em XP do personagem — falta o componente cosmético/passivo que a diretriz de duplicatas pede, além da conversão em Fragmentos no excedente).
33. **(Alta)** Vínculo entre `CompendiumSystem`/`CompendiumUI` (lore por monstro) e a coleção de personagens invocados — um personagem já invocado ganha uma linha de "opinião" sobre inimigos da própria região/facção. Puramente cruzamento de dados já existentes, sem conteúdo novo.
34. **(Média)** Histórico de invocação navegável na própria tela de gacha (não só o pity numérico) — últimas N invocações com raridade e resultado, para transparência total.
35. **(Baixa)** Loja de conversão de Fragmentos com progresso direcionado (escolher qual personagem "empurrar" com o excedente) em vez de só acumular moeda solta.
36. **(Média)** Simulação re-executada (`scripts/gacha_sim`, já citado no README) sempre que qualquer taxa/pity mudar, com comparação casual/ativo/dedicado antes de publicar — formalizar isso como processo, não só ferramenta disponível.
37. **(Baixa)** Indicador visual de "featured" (personagem em destaque do banner de evento) reforçado no card do próprio personagem, não só no texto do banner.
38. **(Média)** Registrar e expor ao jogador o percentual de contas que já bateram hard pity (métrica agregada, não individual) como prova pública de que a economia é igual pra todo mundo.
39. **(Baixa)** Filtro de coleção por papel/elemento/raridade/facção na tela de Coleção, hoje provavelmente só uma lista corrida.
40. **(Média)** Sistema de Armas Secretas (arco narrativo de despertar) como conteúdo futuro — hoje o jogo não tem esse banner separado; se for adicionado, manter pity/banner independentes do banner de personagem, conforme a diretriz.
41. **(Baixa)** Selo "sem dinheiro real" bem visível enquanto o jogo for só uma invocação demonstrativa (README já é transparente sobre isso) — reforçar isso na própria UI de gacha, não só na documentação.

## 5. Vínculo, afinidade e rivalidade (42–49)

42. **(Alta)** Consequência visível de rivalidade além do número interno — diálogo específico entre os dois personagens, ou um ataque combinado que só desbloqueia ao "resolver" a rivalidade (item #13 do documento anterior, ainda em aberto; `RivalrySystem.js` já existe, falta a camada narrativa/mecânica visível).
43. **(Média)** Tela de relações (afinidade/rivalidade/amizade) dedicada, mostrando pares ativos e o que cada um desbloqueia — hoje provavelmente só aparece como badge de sinergia em combate.
44. **(Média)** Reagir a decisões de missão, não só à presença no time — afinidade sobe/desce conforme escolhas do jogador em missões que o personagem "opinaria" sobre.
45. **(Baixa)** Diálogo de acampamento entre dois personagens rivais/afins específico, disparado quando ambos estão no time ativo por N batalhas.
46. **(Média)** Função na cidade fora do combate para personagens de alta afinidade (ex.: reduz preço no mercador, acelera forja) — dá uso fora da batalha, como a diretriz de personagens colecionáveis pede.
47. **(Baixa)** Registrar e mostrar "vínculo lembrado" — um resumo textual do relacionamento sem depender de retrato, para telemetria/playtest de conexão emocional.
48. **(Média)** Missão pessoal por personagem principal do roster (não só do protagonista) com uma decisão real, não só combate — mesmo que só 3–4 personagens tenham isso no início.
49. **(Baixa)** Opinião cruzada entre personagens do gacha e NPCs fixos da vila (ex.: um personagem invocado da facção X comenta sobre o mercador) — reaproveita `WorldStateSystem`/facções já existentes.

## 6. Missões e resolução múltipla (50–57)

50. **(Alta)** Terceira via de resolução em pelo menos 1 missão usando `SkillCheckSystem` fora de eventos de exploração e diálogo com NPC — hoje ele já existe e já é usado por NPCs, mas as 5 missões principais continuam só matar/coletar/explorar (item #12 do documento anterior).
51. **(Média)** Estrutura explícita de missão como "necessidade + força opositora + escolha + consequência + mudança persistente" para toda missão nova — documentar como checklist de design, não só implementar.
52. **(Média)** Falha de missão com custo ou nova rota, nunca bloqueio seco — se uma missão pode ser "perdida", garantir que isso abre uma variante, não um beco sem saída.
53. **(Baixa)** Evitar escolha cosmética disfarçada de decisão — auditoria rápida nas 5 missões atuais: cada bifurcação de diálogo muda algo mensurável (recompensa, reputação, rota) ou é só sabor.
54. **(Média)** Missões semanais com objetivo que muda de verdade (região + facção + complicação), não só "mate N monstros de novo" — usar geração por combinação de variáveis, validando antes de publicar.
55. **(Baixa)** Indicador de "quantas abordagens esta missão aceita" na descrição, para o jogador saber que combate não é a única opção antes de tentar.
56. **(Média)** Recompensa de missão por perícia usada (bônus de reputação de facção se resolvida por diálogo, bônus de item se por exploração) — reforça que a via escolhida importa.
57. **(Baixa)** Diário de decisões (`DecisionJournalUI.js` já existe) explicitamente ligado a cada missão resolvida, mostrando qual via foi escolhida e a consequência registrada.

## 7. Mundo reativo, facções e cidade-base (58–67)

58. **(Alta)** Preço do mercador variando com reputação de facção — `WorldStateSystem` já rastreia reputação e é lido "por várias mecânicas", mas não encontrei o preço do mercador de fato variando; fechar esse elo é o item #14 do documento anterior.
59. **(Média)** Fala de NPC específica por reputação (não só disponível/indisponível, mas o texto muda) em pelo menos os NPCs fixos da vila.
60. **(Média)** Clima afetando exploração, não só combate — hoje `WeatherSystem` já dá bônus elemental em batalha; falta o efeito fora dela (ex.: chuva reduz alcance de visão no mapa, ou aumenta chance de evento de abrigo) — item #15 do documento anterior, parte pendente.
61. **(Baixa)** Registrar reputação, confiança e medo separadamente para pelo menos 1 facção mais complexa, em vez de um único número — evita reduzir decisões morais a "boa ou má".
62. **(Média)** Consequência visível em patrulhas/emboscada já existente (`c.emboscada` já aparece em combate) ligada de forma mais clara à reputação regional específica, não só reputação geral.
63. **(Média)** Permitir recuperar relação com uma facção com custo narrativo (missão de reconciliação), sem apagar toda a consequência anterior.
64. **(Baixa)** Tela de "estado do mundo" simples (facções, reputação, decisões-chave) acessível a qualquer momento, sem precisar abrir o diário de decisões inteiro.
65. **(Média)** Ao menos 1 edifício da vila que o jogador pode atribuir um personagem do time (ex.: alguém "trabalha" na forja e dá bônus passivo), como respiro de acampamento entre expedições.
66. **(Baixa)** Evitar transformar a vila em checklist obrigatório pós-batalha — auditar se o fluxo atual (F forja, G time, S salvar) já força passagem por telas demais a cada retorno.
67. **(Média)** Evento de mundo reativo de baixa frequência (ex.: NPC comenta uma conquista recente do jogador) usando dados que já existem (`CompendiumSystem`, conquistas) sem exigir conteúdo novo.

## 8. Masmorras e exploração (68–75)

68. **(Alta)** Rota alternativa (segura vs. arriscada) na masmorra do chefe, hoje aparentemente linear até o Dragão Jovem — mesmo 1 bifurcação com risco/recompensa diferente já cumpre a diretriz de masmorra.
69. **(Média)** Pelo menos 1 chefe opcional (não obrigatório para progressão) com recompensa exclusiva, para dar profundidade sem travar quem quer só avançar.
70. **(Baixa)** Pista visual (não só texto) indicando rota secreta ou atalho na masmorra, coerente com a pixel art já existente.
71. **(Média)** Ponto de descanso dentro da masmorra (cura parcial, não total) para permitir runs mais longas sem forçar volta à vila.
72. **(Baixa)** Complicação de tempo ou ambiente em pelo menos 1 masmorra (ex.: área que perde solidez, reforços chegando) para variar a estrutura "sala com monstro".
73. **(Média)** Encontro que pode ser evitado por exploração/diálogo/perícia em pelo menos 1 ponto por área, conforme a diretriz de "ao menos um encontro evitável por área".
74. **(Baixa)** Mapa/minimapa simples da masmorra atual, já que hoje a navegação parece depender só de memória do jogador.
75. **(Média)** Contrato procedural de exploração (região + objetivo + complicação) para dar variedade a áreas já visitadas sem exigir arte nova — só recombinar dados existentes.

## 9. Itens, equipamento e crafting (76–82)

76. **(Média)** Favoritar/bloquear itens no inventário para evitar descarte acidental de raros/equipados — a diretriz de UX pede isso explicitamente; verificar se já existe e, se não, é baixo custo de implementação.
77. **(Baixa)** Indicador de "item novo" (badge) desde a última vez que o inventário foi aberto.
78. **(Média)** Explicar de onde obter o material que falta diretamente no detalhe da receita de forja/alquimia (`CraftingSystem.js`/`EnchantSystem.js` já existem), em vez de o jogador ter que descobrir sozinho.
79. **(Baixa)** Filtro de inventário por função/classe/elemento/compatibilidade, não só por tipo de item.
80. **(Média)** Bônus de conjunto (`SetBonusSystem.js` já existe) exibido de forma clara no detalhe de cada peça, mostrando quantas peças faltam para ativar.
81. **(Baixa)** Ordenar automaticamente por "relevância para o personagem selecionado" como opção de ordenação do inventário.
82. **(Média)** Prévia de encantamento (`EnchantSystem.js`) antes de confirmar, mostrando o antes/depois do item, seguindo o mesmo padrão de comparação já usado no equipamento.

## 10. UX, HUD, mobile e acessibilidade (83–92)

83. **(Média)** Onboarding contextual na primeira masmorra/primeiro baú/primeira batalha ("dentro da situação real", não só o texto corrido da tela de boot) — item #19 do documento anterior, ainda em aberto.
84. **(Baixa)** `navigator.vibrate` opcional em acerto crítico/dano recebido no mobile, com opção de desligar nas configurações — item #18 do documento anterior, parte pendente.
85. **(Média)** Aumentar levemente a área de toque dos botões de ação em telas pequenas, além do d-pad que já tem safe-area — revisão de alvo mínimo de toque (44×44px como referência comum de acessibilidade).
86. **(Baixa)** Legenda textual para os poucos sons que existirem (ver item 14) e indicação visual redundante para qualquer aviso sonoro futuro.
87. **(Média)** Volumes separados (música/efeitos) nas opções, preparando terreno para quando houver áudio — hoje é 100% silencioso, então isso é pré-requisito antes de adicionar som.
88. **(Baixa)** Glossário rápido (o que é "postura", "pity", "sinergia de formação") acessível de dentro do jogo, não só no README.
89. **(Média)** Objetivo atual sempre visível de forma discreta no HUD (missão ativa + próximo passo), sem precisar abrir a tela de Missões inteira.
90. **(Baixa)** Histórico de diálogo revisável (rolar para cima numa conversa de NPC) para quem perdeu uma linha de texto.
91. **(Média)** Testar e documentar o fluxo completo só com teclado (sem mouse) e só com toque (sem teclado), registrando qualquer ponto que hoje exige o dispositivo "errado".
92. **(Baixa)** Resumir efeitos encadeados de combate (múltiplos status/combos no mesmo turno) em uma linha de log com opção de expandir, evitando spam de linhas.

## 11. Narrativa e continuidade (93–97)

93. **(Média)** Bíblia de continuidade simples (termos, calendário, geografia, facções, personagens) como documento de projeto — já existe estrutura de dados (`worldStateVariables.json`, `compendium.json`); falta consolidar como referência única para novo conteúdo não contradizer o que já existe.
94. **(Baixa)** Declarar pré-condição/efeito/variável alterada em cada missão nova de forma padronizada (mesmo que só em comentário no JSON), para facilitar auditoria futura como a que gerou este documento.
95. **(Média)** Pelo menos 1 personagem do roster com arco que não depende de duplicata (desenvolve por decisão/missão pessoal, não por refinamento) — reforça que colecionar não é a única forma de aprofundar um personagem.
96. **(Baixa)** Registrar decisões de personalidade/antecedente da criação de personagem como algo que o mundo reconhece depois (NPC comenta o antecedente escolhido), aproveitando dados já coletados na criação.
97. **(Média)** Validação de coerência (poder, licença, representação) documentada como checklist antes de publicar qualquer personagem novo do roster.

## 12. Produção, dados, telemetria e QA (98–100)

98. **(Alta)** Telemetria mínima local (mesmo sem servidor): sessão, encontros, causa de derrota, moeda por fonte, tela aberta — mesmo salva só localmente, já permite auditoria de playtest sem exigir infraestrutura nova.
99. **(Média)** Critérios de aceite escritos no formato "dado que / quando / então" para toda mudança de combate ou economia daqui pra frente (o padrão já foi seguido nas entregas desta sessão; formalizar como processo do projeto, não só hábito).
100. **(Alta)** Playtest externo real: um jogador fora do desenvolvimento completando criação de personagem → primeira masmorra → primeira invocação sem orientação, observando onde ele trava — é o único item desta lista que nenhuma auditoria de código substitui.

---

## Se for escolher só 10 para a próxima leva

**33** (compêndio × coleção), **42** (consequência de rivalidade), **50** (terceira via de missão), **58** (preço do mercador por reputação), **68** (rota alternativa na masmorra do chefe), **11** (fase 2 de chefe muda regra), **83** (onboarding contextual), **32** (duplicata com variação além de fragmento), **98** (telemetria mínima local) e **100** (playtest externo). Esses dez cruzam sistemas que já existem no código — nenhum exige arte nova ou uma engine diferente — e cada um fecha uma lacuna citada mais de uma vez nas diretrizes de design (mundo reativo, vínculo, missões com múltiplas vias, confiança na economia).
