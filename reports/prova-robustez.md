# Prova de robustez — investir em defesa e vida compra ofensiva?

O pedido era ter habilidades, em todas as classes, que escalem com vida máxima e defesa — e não só com ataque e destreza. A afirmação a provar é que **um personagem que investe em defesa e vida agora ganha poder ofensivo com isso**, o que antes era impossível por construção: nenhuma habilidade do jogo lia defesa ou vida.

Personagem de nível 25, 8 amostras, 40 turnos por luta, solo contra dois alvos de vida efetivamente infinita (mede dano, não vitória). Mesmas sementes nas três colunas.

Três versões do MESMO personagem, mesmo orçamento de equipamento (30 pontos):

- **Lâmina** — tudo em dano de arma.
- **Couraça (antes)** — tudo em defesa e vida, e PROIBIDA de levar habilidade que escale com robustez. É o jogo de antes desta mudança, para aquele mesmo personagem.
- **Couraça (agora)** — igual, mas podendo levá-las.

A coluna **ganho** é Couraça(agora) ÷ Couraça(antes): quanto do investimento defensivo virou dano. É a única comparação que isola o efeito, porque nível, árvore, equipamento e sementes são idênticos — só a existência das habilidades muda.

A coluna **razão** é Couraça(agora) ÷ Lâmina, como referência de viabilidade. Ela não deve chegar a 100% nas classes físicas: quem gasta tudo em arma ainda tem de bater mais. Nas classes mágicas ela passa de 100% porque dano de arma quase não entra na conta delas — o feitiço escala com INT —, então ali a "Lâmina" é um espantalho e só o **ganho** significa alguma coisa.

| Classe | Lâmina | Couraça (antes) | Couraça (agora) | Ganho | Razão | Defesa | Vida | Usa escala |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| mago | 2759 | 1890 | 3048 | **161.3%** | 110.5% | 43 | 241 | sim |
| druida | 908 | 800 | 1096 | **137.0%** | 120.7% | 44 | 253 | sim |
| ladino | 2212 | 1825 | 2159 | **118.3%** | 97.6% | 43 | 245 | sim |
| guerreiro | 1664 | 1633 | 1883 | **115.3%** | 113.2% | 45 | 271 | sim |
| clerigo | 499 | 1209 | 1287 | **106.4%** | 257.7% | 32 | 196 | sim |
| barbaro | 2290 | 2310 | 2310 | **100.0%** | 100.9% | 45 | 279 | não |
| patrulheiro | 2117 | 2392 | 2392 | **100.0%** | 113.0% | 32 | 195 | não |
| paladino | 563 | 396 | 396 | **100.0%** | 70.4% | 45 | 268 | não |
| necromante | 817 | 1216 | 1216 | **100.0%** | 148.8% | 44 | 245 | não |
| bardo | 649 | 673 | 667 | **99.1%** | 102.9% | 44 | 247 | sim |

## Limites

Uma taxa de câmbio declarada (1 de dano de arma = 2 de defesa = 6 de vida) e um orçamento só. Mede dano produzido, não vitória nem sobrevivência — a build Couraça também apanha menos e morre menos, e isso não aparece aqui. IA automática, não jogador humano. Ganho de 100% significa que a classe tem a habilidade mas ela não venceu uma das 4 vagas de card naquela build.
