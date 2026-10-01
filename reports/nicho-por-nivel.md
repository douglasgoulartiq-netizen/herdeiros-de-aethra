# O nicho se sustenta ao longo do jogo?

Todo o balanceamento de nicho foi medido e calibrado no **nível 25**. A maior parte de uma partida acontece antes disso. Esta é a mesma matriz rodada em 3 níveis: 5, 15, 25.

**Inclinação** = participação no dano com 6 inimigos menos participação com 1. Negativa é especialista em alvo único, positiva em multidão, entre -6 e 6 é generalista — que é o defeito que o trabalho de nicho existe para corrigir.

| Classe | Nível 5 | Nível 15 | Nível 25 | Mantém o nicho? |
|---|---|---|---|---|
| Ladino | -28.3 · alvo único | 5.7 · generalista | -13.8 · alvo único | **não** |
| Patrulheiro | -22.6 · alvo único | 11.1 · multidão | -19.9 · alvo único | **não** |
| Guerreiro | -4.5 · generalista | -5.0 · generalista | 20.5 · multidão | **não** |
| Bardo | 5.4 · generalista | -12.4 · alvo único | -1.6 · generalista | **não** |
| Bárbaro | 6.0 · generalista | -10.2 · alvo único | 9.4 · multidão | **não** |
| Paladino | 8.6 · multidão | -4.8 · generalista | 2.1 · generalista | **não** |
| Clérigo | 9.2 · multidão | -5.7 · generalista | -4.4 · generalista | **não** |
| Mago | 17.3 · multidão | 4.2 · generalista | 24.6 · multidão | **não** |
| Necromante | 22.3 · multidão | 6.4 · multidão | 1.2 · generalista | **não** |
| Druida | 23.7 · multidão | -0.9 · generalista | 11.3 · multidão | **não** |

## A leitura

**10 de 10 classes mudam de nicho conforme o nível.**

## Onde cada uma vira outra coisa

- **Ladino**: alvo único → generalista entre os níveis 5 e 15; depois generalista → alvo único entre os níveis 15 e 25.
- **Patrulheiro**: alvo único → multidão entre os níveis 5 e 15; depois multidão → alvo único entre os níveis 15 e 25.
- **Guerreiro**: generalista → multidão entre os níveis 15 e 25.
- **Bardo**: generalista → alvo único entre os níveis 5 e 15; depois alvo único → generalista entre os níveis 15 e 25.
- **Bárbaro**: generalista → alvo único entre os níveis 5 e 15; depois alvo único → multidão entre os níveis 15 e 25.
- **Paladino**: multidão → generalista entre os níveis 5 e 15.
- **Clérigo**: multidão → generalista entre os níveis 5 e 15.
- **Mago**: multidão → generalista entre os níveis 5 e 15; depois generalista → multidão entre os níveis 15 e 25.
- **Necromante**: multidão → generalista entre os níveis 15 e 25.
- **Druida**: multidão → generalista entre os níveis 5 e 15; depois generalista → multidão entre os níveis 15 e 25.

O intervalo de cada travessia é de 10 níveis, que é o espaçamento das medições — a classe vira outra coisa em algum ponto ali dentro, e esta ferramenta não aperta mais que isso. Para fechar o cerco, meça os níveis intermediários do intervalo que interessa.

## A causa provável, e o que falta medir

A árvore é comprada por nível, e só 4 habilidades entram na luta. Então o que a classe É em cada nível depende de quais nós já foram comprados e de quais 4 cards cabem — e isso muda de forma descontínua a cada compra. Não é gradual.

O passo seguinte é olhar, nos níveis da travessia, QUAL habilidade entrou no loadout e qual saiu. Esta ferramenta localiza o degrau; não diz ainda qual card o causou.

## Limites

Time fixo, equipamento sintético de orçamento igual, IA automática. A inclinação é uma diferença entre duas médias ruidosas: perto do limite de 6 pontos, a classificação pode trocar por ruído, e por isso a leitura acima destaca as travessias, não a casa decimal.
