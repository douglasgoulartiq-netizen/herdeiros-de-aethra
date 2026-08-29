# Caminhos do Herdeiro — Fase 4: árvore completa do Mago (Éter)

Segunda classe totalmente realizada dentro do plano "profundo em 2 classes primeiro". Mesma forma da árvore do Guerreiro (Fase 3): 16 talentos — 7 de classe (qualquer Mago) + 3 subclasses (Piromante, Criomante, Tecelão do Éter) com 3 talentos cada, permanentemente escolhida no nível 10.

## Estrutura

- **Intelecto Afiado / Fluxo de Mana** (nível 1): +2 Intelecto / +8% de mana máxima, os dois primeiros pontos de qualquer Mago.
- **Bola de Energia** (nível 3, requer Intelecto Afiado): primeira habilidade de dano mágico de verdade da árvore.
- **Foco Ofensivo vs. Retenção Etérea** (nível 5): par mutuamente exclusivo — +8% de crítico OU +5% de HP máximo. Escolher um bloqueia o outro pra sempre nesse personagem.
- **Escudo Arcano** (nível 7) e **Convergência Etérea** (nível 9): fecham a árvore de classe com uma habilidade defensiva e o maior golpe mágico de classe.
- **Subclasse no nível 10** (permanente): Piromante (dano contínuo/área, deixa Incendiado), Criomante (controle, deixa Congelado) ou Tecelão do Éter (dano de pico puro, deixa Instável). Cada uma tem 3 talentos próprios, os dois últimos exigindo o anterior.

Todo o conteúdo é original de Herdeiros de Aethra — nada copiado de World of Warcraft.

## Diferença proposital em relação à árvore do Guerreiro

O Guerreiro prova a corrente Exposto → Ruptura (uma reação que só dispara depois de uma reação anterior). O Mago prova o outro caminho que o motor de reações da Fase 1 precisa suportar: **Lança de Gelo aplica Congelado DIRETO** (sem depender de nenhuma reação anterior), e depois **qualquer golpe físico de qualquer aliado** — não precisa ser do próprio Mago — aciona a reação Estilhaçar (crítico garantido) nesse alvo. Isso comprova que o motor de estados/reações da task #91 não é específico do Guerreiro: reage igual não importa se o estado veio de uma reação em cadeia ou de uma habilidade que o aplica direto, e não importa qual combatente desfere o golpe seguinte.

## O que já funciona de ponta a ponta (não é só dado no JSON)

Testado em código real, com os dados de verdade de `talentsMago.json`/`subclasses.json` (não uma árvore sintética): escolher Lança de Gelo concede a habilidade → usá-la em combate aplica Congelado direto no alvo (motor da Fase 1) → um golpe físico de um SEGUNDO combatente aliado aciona a reação Estilhaçar de verdade, com crítico garantido. As três fases conversam entre si igual já acontecia com o Guerreiro, agora provado numa classe com forma de conteúdo diferente (mágica em vez de física, controle em vez de dano bruto).

## O que ainda falta pra jogar isso

Ainda não existe uma tela no jogo pra escolher esses talentos — isso é a task #95 (UI visual da árvore, com pan/zoom). A árvore inteira do Mago já existe, está testada e pronta pros dados; só falta a interface pra clicar, exatamente como o Guerreiro.

## Testado

- 20 checks novos (`scripts/test_arvore_mago.mjs`) usando os dados REAIS de `talentsMago.json`/`subclasses.json`: contagem/forma dos 16 talentos, pré-requisito, grupo exclusivo, restrição de subclasse (um talento de Piromante fica bloqueado pra quem escolheu Criomante), bônus agregado, e a corrente completa habilidade → Congelado → Estilhaçar entre dois combatentes diferentes. Rodado 8 vezes seguidas sem nenhuma instabilidade.
- Suíte de regressão completa (44 arquivos, incluindo este novo) rodada duas vezes: zero falhas.
- Smoke test de navegador: boot completo do jogo servido localmente, `talentsMago.json` acessível via fetch com os 16 talentos íntegros, zero erros de console/página novos (o único 404 observado é o `favicon.ico`, pré-existente e sem relação com esta fase).
- Nenhum hook de debug temporário foi deixado no código (`grep __DEBUG` limpo, `node --check src/main.js` OK).

## O que vem a seguir

Guerreiro e Mago — as duas classes escolhidas pra ir "profundo primeiro" — estão completas e testadas de ponta a ponta. A partir daqui: a UI visual da árvore de talentos (task #95), a IA de auto-batalha configurável (task #96), o versionamento/migração de save (task #97) e a suíte final de testes + relatório de 26 itens (task #98). A "PROMPT MESTRE DE EVOLUÇÃO" (atributos novos, pontos de skill, sistema de armas, rework de UI) continua deliberadamente adiada pra depois disso, como combinado.
