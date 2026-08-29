# Caminhos do Herdeiro — Fase 3: árvore completa do Guerreiro (Ímpeto)

Primeira classe com talentos de verdade pra escolher. 16 talentos no total: 7 de classe (qualquer Guerreiro) + 3 subclasses (Devastador, Sentinela, Vendaval) com 3 talentos cada, permanentemente escolhida no nível 10.

## Estrutura

- **Vigor de Batalha / Couraça de Campo** (nível 1): +2 FOR / +2 defesa, os dois primeiros pontos que todo Guerreiro pode gastar.
- **Golpe Rompedor** (nível 3, requer Vigor de Batalha): primeira habilidade nova de verdade da árvore — deixa o alvo **Exposto** (usa o motor de estados elementais da Fase 1: o próximo golpe físico nele aciona a reação **Ruptura**, ignorando o resto da defesa).
- **Fúria Crescente vs. Pele de Pedra** (nível 5): par mutuamente exclusivo — +8% de crítico OU +6% de HP máximo. Escolher um bloqueia o outro para sempre nesse personagem (build é escolha, como você pediu).
- **Fôlego de Ferro** (nível 7) e **Ímpeto Final** (nível 9): fecham a árvore de classe com uma habilidade defensiva e uma ofensiva mais forte.
- **Subclasse no nível 10** (permanente — não muda depois): Devastador (dano bruto/ignora defesa/Exposto), Sentinela (defesa/proteção/contra-ataque) ou Vendaval (velocidade/crítico/elemento Vento). Cada uma tem 3 talentos próprios, os últimos dois exigindo o anterior.

Todo o conteúdo (nomes, ícones, descrições, habilidades) é original de Herdeiros de Aethra — nada copiado de World of Warcraft, como você pediu explicitamente.

## O que já funciona de ponta a ponta (não é só dado no JSON)

A corrente completa foi testada em código real: escolher Golpe Rompedor concede a habilidade de verdade → usá-la em combate aplica Exposto no alvo (motor da Fase 1) → o próximo golpe físico nesse alvo aciona a reação Ruptura de verdade, ignorando defesa. As três fases já conversam entre si.

## O que ainda falta pra jogar isso

**Ainda não existe uma tela no jogo pra escolher esses talentos** — isso é a próxima fase (UI visual da árvore, com pan/zoom). Por enquanto, a árvore inteira já existe, está testada e pronta pros dados; só falta a interface pra clicar.

## Testado

- 21 checks novos (`scripts/test_arvore_guerreiro.mjs`) usando os dados REAIS de `talentsGuerreiro.json`/`subclasses.json` (não uma árvore sintética): pré-requisitos, grupo exclusivo, restrição de subclasse (um talento de Devastador fica bloqueado pra quem escolheu Sentinela, e vice-versa), e a corrente completa talento → habilidade → estado → reação.
- Smoke test de navegador: boot completo do jogo com os dois arquivos novos (`talentsGuerreiro.json`, `subclasses.json`) registrados no carregador de dados — zero erros de console.
- Suíte de regressão completa (43 arquivos) rodada duas vezes: nenhuma quebra.

## O que vem a seguir

A árvore do Mago (mesma profundidade, tema Éter), depois a UI visual, a IA de auto-batalha configurável, e o versionamento de save.
