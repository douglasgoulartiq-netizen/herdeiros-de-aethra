# Mapa, Mitologia e Arte — o que foi implementado

Pedido do usuário: usar o print de referência de outro jogo pra melhorar a pixel art da tela de combate, adicionar o mapa-múndi real do PDF com suas descrições, e adicionar a história do Livro da Mitologia.

Antes de implementar, três decisões de escopo foram confirmadas com o usuário (perguntas feitas porque cada uma tinha trade-offs reais de tempo/risco):

1. **Arte visual** → "Motor + tela de combate": evoluir o gerador de pixel art procedural (não existe ferramenta de geração de imagem por IA neste ambiente) e redesenhar a tela de combate, aplicando o novo estilo a um conjunto representativo, não a todo o jogo.
2. **Mapa-múndi** → "Nova tela de Atlas": o mapa pintado do PDF vira uma tela nova, sem mexer no motor de exploração em tiles já testado.
3. **Mitologia** → "Códice desbloqueável": o livro vira uma nova aba no Compêndio, com capítulos que se revelam conforme o jogador progride.

## O que foi implementado (testado: 39/39 testes de regressão + smoke test de navegador em desktop e mobile, zero erros de console)

**Atlas do Mapa-Múndi** (tecla U / botão no HUD) — `src/ui/AtlasUI.js`, `src/data/atlasRegions.js`. A arte do mapa (extraída do PDF em alta resolução, 1800px) com as 17 regiões marcadas por hotspots clicáveis. Cada região mostra a descrição, locais lendários e presença dominante exatamente como no PDF. 15 das 17 regiões foram ligadas à zona jogável mais coerente por tema/elemento (com viagem rápida direta reaproveitando o sistema já existente); 2 (Lago Prismático, Abismo de Naz'thal) ficaram marcadas como "região lendária, ainda sem zona jogável" em vez de forçar uma ligação sem sentido — a tabela completa de decisões está nos comentários do próprio `atlasRegions.js`.

**Códice da Mitologia** (aba nova no Compêndio) — `src/systems/MythologySystem.js`, `src/data/mythologyCodex.js`. Os 16 capítulos do livro (Prólogo ao Epílogo + Apêndice de vocabulário) transcritos, com desbloqueio ligado a progresso real do personagem (nível, exploração, missões, abates, facção afiliada — nada novo salvo, só lido do que já existe). Os capítulos XIV-XVI do livro original ("Como a mitologia deve aparecer na jogabilidade", "Cronologia pra designers", "Princípios narrativos") são notas de produção, não lore — ficaram de fora do Códice do jogador por não serem conteúdo in-fiction, mas orientaram como o resto foi escrito.

**Motor de pixel art HD** — `scripts/gen_assets_hd.py` (novo, não altera `gen_assets.py`). Grade 32x32 com sombreamento em 3 tons (antes: 16x16, cor lisa), proporção chibi inspirada no print de referência. Gerou retratos das 6 raças x 6 classes do herói (36 combinações) e dos 9 monstros-base do jogo (`assets/sprites_hd/`) — um conjunto representativo, não a regeneração de todo o jogo (isso seria um projeto à parte).

**Redesenho da tela de combate** — `src/ui/BattleUI.js`, `src/style.css`. Barra de retratos HD no topo, mostrando o time em ordem de prontidão (destaque dourado em quem está pronto/ativo), inspirada na composição do print de referência. É puramente visual: lê os mesmos dados que já alimentavam os cards de corpo inteiro (que continuam existindo, inalterados, com toda a interação de seleção de alvo e números flutuantes).

## O que não foi feito, e por quê

- **Regenerar os +100 sprites do gacha e o bestiário inteiro** no estilo HD: escopo grande demais pra essa rodada (risco de inconsistência visual num conjunto tão grande sem revisão manual peça a peça). O motor está pronto para isso ser feito depois, incrementalmente.
- **Renomear as 22 zonas existentes** pros nomes do mapa mitológico: descartado na decisão de escopo (opção "Nova tela de Atlas" em vez de "Atlas + renomear zonas") — evita reescrever descrições/lore espalhadas por vários sistemas nesta rodada.
- **Reescrever textos já existentes** (facções, missões, armas despertadas) com a terminologia do livro (Éter, Selos, Véu): descartado na decisão de escopo (opção "Códice desbloqueável" em vez de "Códice + reescrever textos") — o Códice fica como fonte de verdade da mitologia sem arriscar o tom do que já existe.
