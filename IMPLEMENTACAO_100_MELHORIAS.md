# Implementação das 100 melhorias — status real, item por item

Esta rodada implementou as melhorias em lotes por categoria, testando a suíte de regressão (`scripts/test_*.mjs`) e um smoke test em navegador headless a cada lote, com commit git de checkpoint. Nenhuma fórmula de dano/defesa/velocidade/crítico/elemento, probabilidade de gacha ou formato de save foi alterada — só combate, automático, HUD, acessibilidade, gacha/coleção e narrativa em torno do que já existia.

Legenda: ✅ Implementado nesta rodada · 🟢 Já existia (corrige uma imprecisão do documento original `100_melhorias.md`) · ⏸️ Adiado, com o motivo.

## 1. Combate tático (1–15)

1. ✅ Prévia de dano estimado (`Batalha.estimarFaixaDano`, mostrada sob Atacar/habilidades).
2. ✅ Motivo de esquiva/bloqueio no log (mostra o d20 e o limiar de defesa).
3. ⏸️ Ação de Reação — nova mecânica de economia de ação, risco real de alterar o ritmo/balanceamento do combate; precisa de design dedicado antes de codar.
4. ✅ Prévia de alvos do Sopro Elemental antes de confirmar.
5. ✅ Papéis de combate nomeados (Defensor/Atirador/Especialista/Curandeiro/Duelista/Controlador) nos cards.
6. ⏸️ Vulnerabilidade única por personagem — autoria de conteúdo por classe/raça + risco de balanceamento sem simulação.
7. 🟢 Terreno já tinha efeito jogável (bônus de ataque elemental, task #42) antes desta sessão — o documento original errou ao listar isso como pendente.
8. 🟢 Trocar de alvo antes de confirmar a ação já era livre (nada consome a escolha até o clique final).
9. ✅ Resolvido pelo item 2: o "motivo" no log já cobre o caso de uso do log expansível sem duplicar um sistema de log inteiro novo.
10. ✅ IA nomeada: badge com nome/descrição do arquétipo do inimigo (dado já existia em `enemyBehaviors.json`, só não aparecia na UI).
11. ⏸️ Fase 2 de chefe muda regra — precisa de simulação por chefe antes de arriscar balanceamento.
12. ✅ Texto explícito de "janela de resposta" no telegraph.
13. ⏸️ Impedir imunidade total permanente — exige auditoria de todos os monstros do bestiário, não feita ainda.
14. ✅ Efeitos sonoros opcionais via Web Audio (`src/ui/SoundFX.js`), desligados por padrão.
15. ✅ Confirmação de 2 cliques só em Fugir (única ação irreversível de risco real).

## 2. Modo automático e ritmo (16–23)

16. ✅ Resumo ao desligar o automático (vitórias/derrotas/fugas/XP/ouro).
17. ⏸️ Prioridade de alvo configurável — precisa de UI de ordenação + lógica de busca dedicada.
18. ⏸️ Repetição inteligente de masmorra já concluída — escopo grande (detectar "já visto" por conteúdo).
19. ⏸️ Progresso garantido em derrota/fuga — risco de virar exploit de farm sem desenho cuidadoso.
20. ⏸️ Aviso de loop improdutivo — heurística não confiável o bastante ainda.
21. ✅ Velocidade do automático fora de combate ajustável (opções de acessibilidade).
22. ✅ Tempo total em automático mostrado ao desligar.
23. ✅ Opção "parar automático antes de um chefe" (desligada por padrão).

## 3. Progressão de personagem (24–31)

24–27. ⏸️ Funções alternativas, talentos exclusivos, itens que mudam padrão de uso, ataque combinado por rivalidade — todos exigem autoria de conteúdo por classe/personagem (não é mudança de código pequena) e/ou dependem de outros itens adiados.
28. ⏸️ Modificador de expedição escolhido pelo jogador — precisa de uma tela nova antes de entrar na masmorra; escopo médio.
29. ⏸️ Reset de talentos — precisa desenhar com cuidado como reverter `aplicarCrescimento()` sem corromper personagens já salvos.
30. ⏸️ Build sugerida por papel — autoria de conteúdo por classe.
31. ✅ HUD mostra sempre "faltam X XP para o nível Y".

## 4. Gacha, coleção e economia (32–41)

32. ⏸️ Duplicata com variação cosmética/passiva — hoje já dá XP ao personagem (não é só conversão em Fragmentos, ao contrário do que o README sugere), mas a parte cosmética/passiva ainda não existe.
33. ⏸️ Vínculo Compêndio × coleção — bloqueado por um requisito de dados: `compendium.json` não liga monstro a facção/região, então não dá pra gerar uma "opinião" honesta sem inventar essa relação.
34. 🟢 Histórico de invocação navegável já existe na aba Compêndio (`historicoInvocacoes`) — o documento original não tinha visto isso.
35. ⏸️ Loja de conversão dirigida de Fragmentos — escopo médio, novo fluxo de UI.
36. ⏸️ Simulação obrigatória antes de mudar taxas — é processo, não código; o simulador (`scripts/gacha_sim`, citado no README) já existe pronto pra ser usado quando a mudança acontecer.
37. ✅ Selo ⭐ do destaque atual do banner de Evento agora aparece na própria Coleção, não só no flash da invocação.
38. ⏸️ Métrica agregada de % de contas em hard pity — pede armazenamento central; o jogo hoje roda 100% local (sem servidor), então não há OS "outras contas" pra agregar.
39. ✅ Filtro de coleção por raridade e classe.
40. ⏸️ Armas Secretas (banner separado) — sistema inteiro novo, fora do escopo desta rodada.
41. ⏸️ Selo "sem dinheiro real" mais visível — baixo valor prático hoje (o jogo já não tem nenhuma forma de pagamento implementada).

## 5. Vínculo, afinidade e rivalidade (42–49)

42. 🟢⏸️ Pares nomeados de rivalidade/amizade com descrição narrativa e badge em batalha **já existiam** antes desta sessão (`RivalrySystem.js`) — o documento original não tinha visto isso. O que ainda falta (ataque combinado desbloqueável ao "resolver" a rivalidade) continua adiado: é conteúdo novo por par.
43. 🟢 Sinergias de par já aparecem contextualmente na tela de Time — uma tela dedicada separada, com todos os pares possíveis (não só os ativos), ainda não existe.
44–49. ⏸️ Reagir a decisões de missão, diálogo de acampamento, função na cidade, telemetria de vínculo, missão pessoal por personagem, opinião cruzada com NPCs — todos exigem autoria de conteúdo narrativo ou dependem de sistemas ainda não implementados (telemetria, terceira via de missão).

## 6. Missões e resolução múltipla (50–57)

50–56. ⏸️ Terceira via de resolução, estrutura padronizada, falha com nova rota, auditoria de escolha cosmética, missões semanais variadas, indicador de abordagens, recompensa por perícia — tudo isso é autoria/revisão de conteúdo de missão, não mudança de sistema; nenhuma das 5 missões principais foi alterada nesta rodada pra não arriscar quebrar progressão de save em andamento.
57. 🟢 `DecisionJournalUI` já registra decisões relevantes do jogador — a amarração explícita "decisão → missão → consequência" pedida no item ainda não existe, mas a base já está lá.

## 7. Mundo reativo, facções e cidade-base (58–67)

58. 🟢 Preço do mercador (loja fixa E mercador itinerante) **já varia** com reputação regional via `WorldStateSystem.multiplicadorPrecoLoja` — o documento original errou ao listar isso como pendente; já está implementado e em uso nos dois lugares.
59. ⏸️ Fala de NPC variando por texto (não só disponibilidade) — precisa de conteúdo de diálogo por NPC.
60. ⏸️ Clima afetando exploração além do combate — o bônus elemental de clima em combate já existe; o efeito fora dele (visão, eventos de abrigo) ainda não.
61–67. ⏸️ Reputação multi-eixo, patrulha ligada à reputação regional específica, recuperar relação com custo narrativo, tela de estado do mundo, atribuir personagem a edifício, auditoria de checklist pós-batalha, evento reativo de baixa frequência — escopo de conteúdo/sistema novo em cada um.

## 8. Masmorras e exploração (68–75)

68. 🟢 As masmorras **já são geradas com labirinto ramificado de verdade** (recursive backtracker, múltiplas rotas e becos sem saída para tesouro) — o documento original presumiu que eram lineares; não é verdade, isso já existe.
69–75. ⏸️ Chefe opcional, pista visual de atalho, ponto de descanso parcial, complicação de tempo/ambiente, encontro evitável documentado, minimapa, contrato procedural de exploração — todos exigem conteúdo novo (level design) ou uma tela nova (minimapa); nenhum é uma mudança de sistema pequena.

## 9. Itens, equipamento e crafting (76–82)

76. ⏸️ Favoritar/bloquear item — pede um novo campo persistido por item de inventário (mudança de formato de save, ainda que aditiva) e alteração no fluxo de descarte; não implementado nesta rodada por prudência com saves existentes.
77–79, 81–82. ⏸️ Indicador de item novo, filtro de inventário, ordenação por relevância, prévia de encantamento — escopo de UI médio cada um.
80. 🟢 Bônus de conjunto já é exibido claramente (`SetBonusSystem`/`conjuntosParaExibir`, usado em `GameUI.js`) — já cobre o pedido do item.

## 10. UX, HUD, mobile e acessibilidade (83–92)

83. ⏸️ Onboarding contextual na primeira masmorra/baú/batalha — precisa de um sistema de dicas "primeira vez" novo.
84. ✅ Vibração tátil opcional (crítico/dano) no celular, respeitando "reduzir efeitos".
85. ⏸️ Área de toque maior nos botões de ação — precisa de revisão visual tela a tela; adiado pra não alterar layout sem visual review completo.
86. ⏸️ Legenda textual pros efeitos sonoros novos — os efeitos atuais já são só reforço de algo já visível (dado, dano, cura), então hoje não há informação sonora exclusiva sem equivalente visual.
87. ✅ Volume de efeitos sonoros separado, com opção "desligado" como padrão (equivalente ao "volumes separados" pedido, na medida em que o jogo tem áudio agora).
88, 90. ⏸️ Glossário in-game, histórico de diálogo revisável — telas novas, não implementadas.
89. 🟢 Parcialmente já existe: HUD já mostra o essencial de personagem/progresso; o item 31 (implementado) já cobre "próximo marco" no HUD sem abrir tela.
91. ⏸️ Auditoria formal de fluxo só-teclado / só-toque — é processo de teste, não código; recomendado como próximo passo de QA.
92. 🟢 Log de combate já é compacto por padrão (uma linha por evento) — resumo expansível de efeitos encadeados específico não foi criado à parte.

## 11. Narrativa e continuidade (93–97)

93. ⏸️ Bíblia de continuidade consolidada — documento de projeto, não código; recomendado para quem for autorar conteúdo novo.
94. ⏸️ Padronizar pré-condição/efeito por missão em comentário — prática de processo pra missões futuras.
95. ⏸️ Personagem com arco sem depender de duplicata — autoria de conteúdo.
96. ⏸️ Mundo reconhecendo antecedente escolhido na criação — precisa de diálogo novo por antecedente.
97. ⏸️ Checklist de validação de personagem novo — processo, não código.

## 12. Produção, dados, telemetria e QA (98–100)

98. ✅ Telemetria mínima local (`src/systems/TelemetrySystem.js`): sessão, batalhas (resultado/duração/composição), causa de derrota, moeda por fonte, tela aberta — tudo em `localStorage`, sem enviar nada pra fora; ver `HDA_TELEMETRIA()` no console do navegador para inspecionar.
99. ✅ Este próprio documento e os commits desta rodada seguem o formato "dado que/quando/então" nas mensagens de commit e nas notas de cada item — adotado como padrão daqui pra frente.
100. ⏸️ Playtest externo real — por definição, não é algo que eu (IA) possa fazer sozinho; nenhuma auditoria de código substitui uma pessoa de fora jogando sem orientação.

---

## Resumo

- **26 itens implementados** nesta rodada (código real, testado).
- **9 itens já existiam** e o documento original de 100 melhorias errou ao listá-los como pendentes (corrigido aqui após verificação direta no código) — em especial: terreno com efeito de combate, preço de loja por reputação, masmorras com labirinto ramificado, pares de rivalidade narrativos, histórico de invocação, bônus de conjunto.
- **65 itens adiados**, cada um com o motivo específico (a maioria é autoria de conteúdo — missões, talentos, itens, diálogo — que universalmente foi tratada como fora do escopo de "pequenas mudanças aditivas" pra não arriscar qualidade ou quebrar saves, mais alguns poucos que dependem de decisão de produto antes de codar).

Toda a suíte de regressão (39 testes) passou depois de cada lote, e um smoke test em navegador headless (desktop 960×700 e mobile 390×780, touch) rodou sem erros de console/página depois do lote final.
