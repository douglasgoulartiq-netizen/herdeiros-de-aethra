# IA de Auto-Batalha Avançada — Fase 6 (task #96)

Substitui a IA fixa do modo automático (sempre atacava quem tinha menos HP, curava só abaixo de 35% fixo, usava a primeira habilidade ofensiva disponível com 70% de chance) por um sistema configurável de verdade, com um botão novo **"⚙️ IA"** na tela de batalha.

## Motor: `src/systems/AutoBattleAI.js`

Módulo puro (sem DOM, sem depender de uma instância de `Batalha`) — recebe combatentes no mesmo formato que `CombatSystem.js` já usa e devolve uma decisão (`curar` / `habilidade` / `ataque` / `fugir`); quem executa continua sendo `BattleUI.js`, exatamente como antes.

- **3 modos**: Conservador (cura com 50% de HP, usa habilidade 50% das vezes), Equilibrado (35%/70% — o comportamento antigo, sem mudar nada pra quem nunca mexer na config), Agressivo (20%/95%).
- **5 regras independentes**, ligadas/desligadas por fora do modo:
  - **Preservar a habilidade mais forte pros chefes** — só gasta a habilidade de maior multiplicador contra um chefe ou quando é o último inimigo vivo; contra inimigos comuns com outros vivos, guarda ela.
  - **Focar o chefe** — prioriza o combatente com `chefe:true` (dado real de `monsters.json`, não um conceito novo).
  - **Eliminar suporte primeiro** — prioriza `arquetipo:"suporte"` (dado real de `enemyBehaviors.json`).
  - **Explorar fraqueza elemental** — usa `relacaoElemental`/a matriz real de `elements.json` (o mesmo sistema que já decide dano em combate) pra pontuar mais um alvo fraco ao elemento da habilidade mais forte disponível.
  - **Priorizar reação/combo elemental** — reconhece quando o alvo já está com um estado elemental ativo (motor da Fase 1) e, se alguma habilidade disponível dispara uma reação de verdade nele (`peekReacaoElemental`, sem gastar/consumir nada até decidir), usa essa habilidade em vez de rolar aleatório.
- A config fica em `personagem.autoBatalhaConfig` — persiste no save automaticamente, mesmo padrão de `caminhoHerdeiro`/`estadoDoMundo`/etc. (tudo dentro do objeto `personagem`, sem migração formal necessária: save antigo sem o campo recebe a config padrão na primeira vez que a IA roda).

## UI de configuração

Botão **"⚙️ IA"** ao lado do botão Auto na tela de batalha (funciona mesmo com o HUD escondido, que é onde ficava o único toggle antigo do automático) abre um modal com: seletor de modo, campo opcional pra sobrescrever o limiar de cura em %, e as 5 regras como checkbox com descrição de uma linha cada. Tudo grava direto em `personagem.autoBatalhaConfig` assim que muda — sem botão "Salvar" separado, porque não existe estado intermediário: a config É o que a IA usa no próximo turno automático.

## O que NÃO mudou

- Nenhuma regra de combate nova: a IA só decide QUAL ação tomar, usando exatamente as mesmas funções que já existiam (`batalha.usarHabilidade`, `batalha.ataqueBasico`, `batalha.fugir`) — zero lógica de dano/cura duplicada.
- Cura continua sendo só auto-cura (a habilidade `tipo:"cura"` sempre cura quem a usa, nunca um aliado — isso já era assim no motor de combate antes desta task, a IA não inventou suporte a cura de aliado que não existe de verdade).
- Com as 5 regras desligadas e sem override de cura, o comportamento é idêntico ao antigo: só HP mais baixo decide o alvo. Ninguém que nunca abrir a tela de config nota qualquer diferença de comportamento.

## Testado

- 26 checks novos de lógica pura (`scripts/test_auto_battle_ai.mjs`): config padrão e backfill de save antigo/inválido, os 3 modos, filtro de habilidades disponíveis, escolha de "ultimate", pontuação de alvo com cada regra ligada/desligada isoladamente (inclusive confirmando com os DADOS REAIS de `elements.json` que fogo é vantagem intensa contra gelo), prioridade de cura, decisão de fugir sem inimigos, preservarUltimate (30 rodadas confirmando que nunca gasta contra inimigo comum e sempre libera contra chefe), e priorizarCombo (confirma que escolhe a habilidade física certa pra acionar Estilhaçar num alvo Congelado, em vez de rolar aleatório). Rodado 6 vezes seguidas sem instabilidade.
- Smoke test de navegador com interação real: criar personagem → forçar uma batalha → abrir o modal ⚙️ IA → trocar de modo → marcar uma regra → fechar e reabrir confirmando que persistiu → ligar o modo automático de verdade e ver a IA nova conduzir a batalha até o fim sem travar e sem nenhum erro de console.
- Suíte de regressão completa (46 arquivos, incluindo este novo) rodada duas vezes: zero falhas (fora o flaky pré-existente e documentado de `test_ai_archetypes.mjs`, baseado em `Math.random`, sem relação com esta task — confirmado passando 5/5 isolado).
- Nenhum hook de debug temporário ficou no código.

## O que vem a seguir

Versionamento/migração de save (task #97) e a suíte final de testes + relatório de 26 itens (task #98). A "PROMPT MESTRE DE EVOLUÇÃO" continua deliberadamente adiada pra depois disso.
