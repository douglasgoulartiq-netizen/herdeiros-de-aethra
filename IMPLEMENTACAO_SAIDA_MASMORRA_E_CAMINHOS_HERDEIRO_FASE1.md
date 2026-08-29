# Saída de masmorra + início de "Caminhos do Herdeiro" (motor de estados/reações elementais)

## 1. Correção: sair de masmorra/caverna

Pedido: "quando se entra em uma caverna ou algo do tipo não tem opção para sair".

**Diagnóstico**: a saída já funcionava (voltar pro ponto de entrada existia no código), mas não tinha NENHUMA pista visual nem forma óbvia de usar — o jogador não tinha como descobrir que existia.

**O que foi feito** (testado: 9 checks automatizados de navegador + screenshot, zero erros de console):
- Marcador visual no ponto de saída de cada masmorra (reaproveita o sprite de "entrada de masmorra").
- Ao chegar perto da saída, o jogo reconhece e mostra o prompt de interação (tecla E), igual a baú/NPC/nó de coleta.
- Novo botão **"🚪 Sair da Masmorra"** sempre visível na HUD dentro de masmorras — funciona de qualquer ponto do labirinto, não só perto da saída original. Fora de masmorra, avisa que você já está na superfície em vez de fazer nada silenciosamente.

## 2. Caminhos do Herdeiro — Fase 1: motor de Estados e Reações Elementais

Este é o primeiro pedaço da implementação grande de progressão (classes, subclasses, talentos, herança, IA de auto-batalha) que você pediu — fatiada, como combinado, em "profundo em 2 classes primeiro" (Guerreiro e Mago) mais a arquitetura de apoio. **Esta entrega é só o motor de combate novo; nenhuma árvore de talento nova ainda usa ele** (isso vem nas próximas partes). Por isso ele não muda nada visível jogando hoje — é a fundação testada sobre a qual as habilidades novas vão ser construídas.

### O que existe agora

- **Estados elementais** (`src/data/elementalStates.json`): Molhado, Congelado, Incendiado, Exposto, Corrompido, Enraizado, Eletrizado, Instável e Ofuscado — cada um "gruda" num alvo por alguns turnos e muda como ele reage a golpes seguintes (mais dano de um elemento específico, perde o turno, dano ao longo do tempo, cura reduzida, defesa/velocidade reduzida, etc.).
- **Reações elementais** (`src/data/elementalReactions.json`): o que acontece quando um golpe de um elemento específico acerta um alvo que já está com um desses estados — inclui o exemplo que você deu (Molhado + Chama = Evaporação: remove Molhado, dano extra, e cria uma névoa que reduz a precisão de todo o grupo do alvo), além de Congelamento (Molhado+Gelo), Condução (Molhado+Raio, salta dano pra outro inimigo), Estilhaçar (golpe físico quebra o Congelado, crítico garantido), Ruptura (golpe físico ignora defesa de quem está Exposto) e Distorção (Éter/Umbral um contra o outro).
- **Motor** (`src/systems/ElementalReactionSystem.js` + integração em `src/systems/CombatSystem.js`): aplicado nos dois pontos reais de dano do jogo (ataque físico e magia), no cálculo de defesa, velocidade e precisão, no turno perdido de "Congelado" (tanto pra inimigo quanto pra qualquer membro do seu time), e no dano contínuo de "Incendiado".
- **Liga/desliga com uma flag** (`FLAGS.reacoesElementais` em `featureFlags.js`) — se algo der errado, desligar essa flag volta o combate a se comportar exatamente como antes desta entrega, sem precisar reverter nenhum código.

### Testado

- 24 checks de lógica pura novos (`scripts/test_reacoes_elementais.mjs`), cobrindo cada estado e cada reação, incluindo o caso "e se a flag estiver desligada" e "e se uma Batalha for criada do jeito antigo, sem os dados novos" (compatibilidade).
- Smoke test de navegador: personagem criado, batalha real disparada e jogada até o fim — zero erros de console.
- Suíte de regressão completa (44 arquivos de teste) rodada duas vezes: nenhuma quebra. As duas falhas conhecidas e não relacionadas (dependem de sorte de dado, já existiam antes desta sessão) foram checadas de novo isoladamente e continuam passando 5/5 quando rodadas sozinhas.

### O que vem a seguir (ainda não está neste pacote)

A arquitetura genérica de pontos/talentos/herança/presets, as árvores completas de Guerreiro e Mago (as primeiras a de fato usar esse motor), a UI visual da árvore, a IA de auto-batalha configurável, e o versionamento de save — cada uma será sua própria entrega testada, na ordem combinada.
