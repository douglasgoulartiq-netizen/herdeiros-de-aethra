# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 3 níveis × 16 sementes = 1920 batalhas do motor real.

Nesta execução, o time é candidato + paladino, bardo, druida humanos. Árvore comprada em ordem normal, loadout escolhido por função; pressão inimiga 2x. Cada número mede a fração do dano do time que saiu do candidato, não preferência humana.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Bárbaro | 45.1% | 38.2% | 28.2% | 24.5% | -20.5 | alvo único | 34.2% | 11 | 3.8% | 29.4% | 30.7% |
| Guerreiro | 51.1% | 36.8% | 40.1% | 37.0% | -14.2 | alvo único | 40.7% | 0 | 0.0% | 27.3% | 31.3% |
| Clérigo | 39.1% | 28.8% | 26.2% | 25.4% | -13.7 | alvo único | 30.5% | 23 | 0.0% | 10.0% | 31.3% |
| Paladino | 22.5% | 19.3% | 13.5% | 11.1% | -11.5 | alvo único | 16.6% | 3 | 2.4% | 26.9% | 42.7% |
| Bardo | 25.4% | 26.4% | 19.7% | 18.0% | -7.3 | alvo único | 22.5% | 13 | 17.7% | 12.2% | 32.8% |
| Ladino | 62.6% | 56.3% | 58.4% | 58.8% | -3.8 | ⚠ generalista | 58.5% | 0 | 0.0% | 6.2% | 12.0% |
| Patrulheiro | 57.4% | 54.3% | 59.4% | 59.1% | 1.7 | ⚠ generalista | 57.1% | 1 | 6.5% | 7.6% | 14.1% |
| Mago | 45.7% | 47.7% | 52.3% | 55.7% | 10.0 | multidão | 49.7% | 0 | 0.0% | 9.8% | 21.9% |
| Druida | 28.8% | 36.0% | 38.4% | 43.6% | 14.8 | multidão | 36.5% | 8 | 8.6% | 12.4% | 28.1% |
| Necromante | 20.8% | 27.6% | 35.4% | 40.2% | 19.4 | multidão | 30.4% | 2 | 35.0% | 12.5% | 30.7% |

## Generalistas (|inclinação| < 6 pontos)

- **Ladino** — -3.8: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Patrulheiro** — 1.7: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
