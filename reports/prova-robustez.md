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
| mago | 1293 | 1602 | 2290 | **143.0%** | 177.1% | 43 | 241 | sim |
| necromante | 521 | 601 | 649 | **108.0%** | 124.6% | 44 | 245 | sim |
| druida | 617 | 770 | 803 | **104.2%** | 130.2% | 44 | 253 | sim |
| ladino | 2026 | 1893 | 1950 | **103.0%** | 96.2% | 43 | 245 | sim |
| bardo | 464 | 538 | 554 | **103.0%** | 119.5% | 44 | 247 | sim |
| paladino | 474 | 350 | 350 | **100.0%** | 73.7% | 45 | 265 | não |
| guerreiro | 1664 | 1633 | 1596 | **97.8%** | 95.9% | 45 | 271 | sim |
| barbaro | 1897 | 2310 | 2252 | **97.5%** | 118.7% | 45 | 279 | sim |
| patrulheiro | 2117 | 1947 | 1866 | **95.8%** | 88.1% | 32 | 195 | sim |
| clerigo | 416 | 1116 | 1018 | **91.2%** | 244.5% | 32 | 196 | sim |

## Limites

Uma taxa de câmbio declarada (1 de dano de arma = 2 de defesa = 6 de vida) e um orçamento só. Mede dano produzido, não vitória nem sobrevivência — a build Couraça também apanha menos e morre menos, e isso não aparece aqui. IA automática, não jogador humano. Ganho de 100% significa que a classe tem a habilidade mas ela não venceu uma das 4 vagas de card naquela build.
