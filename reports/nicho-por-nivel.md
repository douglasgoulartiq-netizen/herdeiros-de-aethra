# O nicho se sustenta ao longo do jogo?

Todo o balanceamento de nicho foi medido e calibrado no **nível 25**. A maior parte de uma partida acontece antes disso. Esta é a mesma matriz rodada em três níveis.

**Inclinação** = participação no dano com 6 inimigos menos participação com 1. Negativa é especialista em alvo único, positiva em multidão, entre -6 e 6 é generalista — que é o defeito que o trabalho de nicho existe para corrigir.

| Classe | Nível 5 | Nível 15 | Nível 25 | Mantém o nicho? |
|---|---|---|---|---|
| Ladino | -26.3 · alvo único | 3.6 · generalista | -13.1 · alvo único | **não** |
| Patrulheiro | -19.9 · alvo único | 9.1 · multidão | -10.3 · alvo único | **não** |
| Guerreiro | -5.9 · generalista | 3.4 · generalista | 6.3 · multidão | **não** |
| Bardo | 5.3 · generalista | -13.6 · alvo único | -3.9 · generalista | **não** |
| Bárbaro | 6.5 · multidão | -18.3 · alvo único | -0.1 · generalista | **não** |
| Paladino | 9.7 · multidão | -8.2 · alvo único | 1.1 · generalista | **não** |
| Clérigo | 10.1 · multidão | -10.4 · alvo único | -0.7 · generalista | **não** |
| Mago | 15.6 · multidão | 12.8 · multidão | 18.9 · multidão | sim |
| Druida | 24.6 · multidão | 6.8 · multidão | 14.6 · multidão | sim |
| Necromante | 25.2 · multidão | 5.4 · generalista | 10.4 · multidão | **não** |

## A leitura

**8 de 10 classes mudam de nicho conforme o nível.** Só Mago e Druida mantêm a mesma identidade nos três.

Alguns casos são inversões completas, não oscilação de borda:

- **Ladino**: alvo único no 5 → generalista no 15 → alvo único no 25.
- **Patrulheiro**: alvo único no 5 → multidão no 15 → alvo único no 25.
- **Guerreiro**: generalista no 5 → generalista no 15 → multidão no 25.
- **Bardo**: generalista no 5 → alvo único no 15 → generalista no 25.

Isso quer dizer que o nicho que calibramos é o nicho do fim do jogo. Um jogador que passe a maior parte da campanha entre os níveis 5 e 15 encontra classes com identidade diferente da que o desenho pretende — e um ajuste feito no 25 pode piorar o 15 sem que ninguém perceba.

## A causa provável, e o que falta medir

A árvore é comprada por nível, e só 4 habilidades entram na luta. Então o que a classe É em cada nível depende de quais nós já foram comprados e de quais 4 cards cabem — e isso muda de forma descontínua a cada compra. Não é gradual.

Confirmar isso exige medir nível a nível, não em três pontos, e olhar qual habilidade entra no loadout em cada degrau. Esta ferramenta mostra que o problema existe; não mostra ainda em que nível exato cada classe vira outra coisa.

## Limites

Três níveis, time fixo, equipamento sintético de orçamento igual, IA automática. A inclinação é uma diferença entre duas médias ruidosas: perto do limite de 6 pontos, a classificação pode trocar por ruído, e por isso a leitura acima destaca as inversões grandes, não as de borda.
