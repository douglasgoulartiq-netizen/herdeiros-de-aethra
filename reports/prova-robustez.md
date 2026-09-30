# Prova de robustez — investir em defesa e vida compra ofensiva?

O pedido era ter habilidades, em todas as classes, que escalem com vida máxima e defesa — e não só com ataque e destreza. A afirmação a provar é que **um personagem que investe em defesa e vida agora ganha poder ofensivo com isso**, o que antes era impossível por construção: nenhuma habilidade do jogo lia defesa ou vida.

Personagem de nível 25, 6 amostras, 40 turnos por luta, solo contra dois alvos de vida efetivamente infinita (mede dano, não vitória). Mesmas sementes nas três colunas.

Três versões do MESMO personagem, mesmo orçamento de equipamento (30 pontos):

- **Lâmina** — tudo em dano de arma.
- **Couraça (antes)** — tudo em defesa e vida, e PROIBIDA de levar habilidade que escale com robustez. É o jogo de antes desta mudança, para aquele mesmo personagem.
- **Couraça (agora)** — igual, mas podendo levá-las.

A coluna **ganho** é Couraça(agora) ÷ Couraça(antes): quanto do investimento defensivo virou dano. É a única comparação que isola o efeito, porque nível, árvore, equipamento e sementes são idênticos — só a existência das habilidades muda.

A coluna **razão** é Couraça(agora) ÷ Lâmina, como referência de viabilidade. Ela não deve chegar a 100% nas classes físicas: quem gasta tudo em arma ainda tem de bater mais. Nas classes mágicas ela passa de 100% porque dano de arma quase não entra na conta delas — o feitiço escala com INT —, então ali a "Lâmina" é um espantalho e só o **ganho** significa alguma coisa.

| Classe | Lâmina | Couraça (antes) | Couraça (agora) | Ganho | Razão | Defesa | Vida | Usa escala |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| mago | 2993 | 1925 | 3215 | **167.0%** | 107.4% | 43 | 241 | sim |
| druida | 997 | 790 | 893 | **113.0%** | 89.5% | 44 | 253 | sim |
| clerigo | 485 | 1340 | 1498 | **111.8%** | 308.7% | 32 | 196 | sim |
| guerreiro | 1839 | 1703 | 1703 | **100.0%** | 92.6% | 45 | 271 | não |
| ladino | 2345 | 1965 | 1965 | **100.0%** | 83.8% | 43 | 245 | não |
| barbaro | 2530 | 2491 | 2491 | **100.0%** | 98.4% | 45 | 279 | não |
| patrulheiro | 2445 | 2190 | 2190 | **100.0%** | 89.6% | 32 | 195 | não |
| paladino | 501 | 463 | 463 | **100.0%** | 92.5% | 45 | 265 | não |
| necromante | 905 | 863 | 863 | **100.0%** | 95.3% | 44 | 245 | não |
| bardo | 589 | 632 | 613 | **97.1%** | 104.2% | 44 | 247 | sim |

## Limites

Uma taxa de câmbio declarada (1 de dano de arma = 2 de defesa = 6 de vida) e um orçamento só. Mede dano produzido, não vitória nem sobrevivência — a build Couraça também apanha menos e morre menos, e isso não aparece aqui. IA automática, não jogador humano. Ganho de 100% significa que a classe tem a habilidade mas ela não venceu uma das 4 vagas de card naquela build.
