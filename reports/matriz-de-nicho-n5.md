# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 1 níveis × 6 sementes = 240 batalhas do motor real.

O time é SEMPRE o mesmo (candidato + guerreiro, clérigo e patrulheiro humanos). A única coisa que muda é quantos inimigos existem. Cada número é a fração do dano do time que saiu do candidato — não vitória, que satura perto de 100% e não distingue ninguém.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Ladino | 81.5% | 35.5% | 43.4% | 55.2% | -26.3 | alvo único | 53.9% | 0 | 0.0% | 1.0% | 0.0% |
| Patrulheiro | 73.5% | 29.7% | 42.1% | 53.6% | -19.9 | alvo único | 49.7% | 0 | 5.6% | 1.0% | 0.0% |
| Guerreiro | 21.6% | 27.1% | 23.0% | 15.7% | -5.9 | ⚠ generalista | 21.9% | 0 | 0.0% | 19.5% | 0.0% |
| Bardo | 0.0% | 12.8% | 11.0% | 5.3% | 5.3 | ⚠ generalista | 7.2% | 0 | 63.5% | 3.8% | 0.0% |
| Bárbaro | 4.9% | 26.8% | 13.2% | 11.4% | 6.5 | multidão | 14.1% | 0 | 20.1% | 30.4% | 0.0% |
| Paladino | 0.0% | 5.4% | 11.2% | 9.7% | 9.7 | multidão | 6.6% | 0 | 39.9% | 26.3% | 0.0% |
| Clérigo | 4.9% | 21.4% | 14.4% | 15.0% | 10.1 | multidão | 13.8% | 0 | 0.0% | 4.9% | 0.0% |
| Mago | 21.4% | 25.6% | 47.5% | 36.9% | 15.6 | multidão | 32.6% | 0 | 0.0% | 5.6% | 0.0% |
| Druida | 0.0% | 9.6% | 18.0% | 24.6% | 24.6 | multidão | 12.9% | 0 | 55.2% | 4.2% | 0.0% |
| Necromante | 0.0% | 8.0% | 15.1% | 25.2% | 25.2 | multidão | 11.9% | 0 | 41.7% | 5.0% | 0.0% |

## Generalistas (|inclinação| < 6 pontos)

- **Guerreiro** — -5.9: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Bardo** — 5.3: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
