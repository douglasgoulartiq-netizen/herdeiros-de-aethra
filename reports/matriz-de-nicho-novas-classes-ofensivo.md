# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 3 níveis × 16 sementes = 1920 batalhas do motor real.

Nesta execução, o time é candidato + barbaro, mago, necromante humanos. Árvore comprada em ordem reversa, loadout escolhido por função; pressão inimiga 2x. Cada número mede a fração do dano do time que saiu do candidato, não preferência humana.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Ladino | 56.0% | 37.2% | 35.3% | 32.1% | -23.9 | alvo único | 40.1% | 0 | 7.4% | 6.9% | 10.4% |
| Guerreiro | 27.4% | 22.5% | 14.8% | 11.4% | -16.0 | alvo único | 19.1% | 2 | 0.0% | 24.6% | 25.5% |
| Patrulheiro | 41.9% | 34.7% | 35.5% | 34.9% | -7.0 | alvo único | 36.7% | 1 | 14.3% | 5.3% | 7.8% |
| Mago | 37.7% | 32.1% | 32.3% | 31.0% | -6.6 | alvo único | 33.2% | 0 | 0.0% | 7.8% | 16.1% |
| Bardo | 14.4% | 13.4% | 8.8% | 7.8% | -6.6 | alvo único | 11.6% | 11 | 25.4% | 9.8% | 16.7% |
| Paladino | 10.3% | 8.4% | 6.5% | 5.3% | -5.0 | ⚠ generalista | 8.1% | 7 | 15.7% | 31.8% | 31.3% |
| Clérigo | 28.4% | 26.2% | 25.1% | 25.0% | -3.3 | ⚠ generalista | 26.2% | 3 | 0.0% | 7.4% | 15.6% |
| Bárbaro | 33.8% | 33.1% | 32.4% | 31.1% | -2.7 | ⚠ generalista | 32.7% | 5 | 0.0% | 23.4% | 20.3% |
| Druida | 15.2% | 17.4% | 19.6% | 21.7% | 6.6 | multidão | 19.1% | 16 | 13.4% | 8.6% | 16.7% |
| Necromante | 10.0% | 13.8% | 19.6% | 21.0% | 11.0 | multidão | 16.1% | 0 | 42.5% | 8.2% | 16.1% |

## Generalistas (|inclinação| < 6 pontos)

- **Paladino** — -5.0: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Clérigo** — -3.3: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Bárbaro** — -2.7: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
