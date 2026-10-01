# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 1 níveis × 16 sementes = 640 batalhas do motor real.

O time é SEMPRE o mesmo (candidato + guerreiro, clérigo e patrulheiro humanos). A única coisa que muda é quantos inimigos existem. Cada número é a fração do dano do time que saiu do candidato — não vitória, que satura perto de 100% e não distingue ninguém.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Bardo | 18.4% | 12.8% | 4.2% | 6.0% | -12.4 | alvo único | 10.5% | 2 | 18.8% | 3.7% | 0.0% |
| Bárbaro | 16.1% | 14.7% | 7.2% | 5.9% | -10.2 | alvo único | 11.0% | 1 | 19.5% | 20.1% | 1.6% |
| Clérigo | 13.4% | 13.2% | 8.7% | 7.7% | -5.7 | ⚠ generalista | 10.8% | 2 | 0.0% | 4.0% | 0.0% |
| Guerreiro | 33.1% | 21.4% | 25.7% | 28.1% | -5.0 | ⚠ generalista | 27.1% | 0 | 0.0% | 14.1% | 0.0% |
| Paladino | 9.5% | 7.8% | 5.9% | 4.7% | -4.8 | ⚠ generalista | 7.0% | 1 | 0.0% | 17.5% | 4.7% |
| Druida | 23.4% | 22.4% | 20.2% | 22.5% | -0.9 | ⚠ generalista | 22.0% | 1 | 0.0% | 3.1% | 0.0% |
| Mago | 25.8% | 27.6% | 27.6% | 30.1% | 4.2 | ⚠ generalista | 27.7% | 0 | 0.0% | 3.1% | 0.0% |
| Ladino | 44.7% | 52.7% | 50.6% | 50.4% | 5.7 | ⚠ generalista | 49.5% | 0 | 0.0% | 0.0% | 0.0% |
| Necromante | 1.6% | 5.4% | 5.7% | 7.9% | 6.4 | multidão | 5.1% | 0 | 61.0% | 1.6% | 0.0% |
| Patrulheiro | 39.0% | 50.5% | 49.4% | 50.1% | 11.1 | multidão | 47.2% | 0 | 0.0% | 0.0% | 0.0% |

## Generalistas (|inclinação| < 6 pontos)

- **Clérigo** — -5.7: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Guerreiro** — -5.0: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Paladino** — -4.8: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Druida** — -0.9: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Mago** — 4.2: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Ladino** — 5.7: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
