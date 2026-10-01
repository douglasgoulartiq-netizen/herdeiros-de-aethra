# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 1 níveis × 6 sementes = 240 batalhas do motor real.

O time é SEMPRE o mesmo (candidato + guerreiro, clérigo e patrulheiro humanos). A única coisa que muda é quantos inimigos existem. Cada número é a fração do dano do time que saiu do candidato — não vitória, que satura perto de 100% e não distingue ninguém.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Bárbaro | 22.9% | 16.1% | 6.3% | 4.6% | -18.3 | alvo único | 12.4% | 0 | 21.5% | 16.7% | 4.2% |
| Bardo | 19.0% | 11.3% | 4.5% | 5.4% | -13.6 | alvo único | 10.3% | 2 | 15.6% | 0.0% | 0.0% |
| Clérigo | 16.9% | 15.3% | 7.6% | 6.5% | -10.4 | alvo único | 11.7% | 4 | 0.0% | 1.8% | 0.0% |
| Paladino | 11.6% | 7.0% | 5.8% | 3.4% | -8.2 | alvo único | 6.9% | 0 | 0.0% | 11.5% | 4.2% |
| Guerreiro | 27.4% | 22.6% | 24.2% | 30.8% | 3.4 | ⚠ generalista | 26.2% | 0 | 0.0% | 4.2% | 0.0% |
| Ladino | 45.6% | 44.9% | 53.7% | 49.2% | 3.6 | ⚠ generalista | 48.1% | 0 | 0.0% | 0.0% | 0.0% |
| Necromante | 1.5% | 10.0% | 3.2% | 6.9% | 5.4 | ⚠ generalista | 5.4% | 0 | 58.0% | 0.0% | 0.0% |
| Druida | 18.9% | 21.7% | 17.8% | 25.8% | 6.8 | multidão | 20.8% | 0 | 0.0% | 0.0% | 0.0% |
| Patrulheiro | 39.7% | 42.3% | 52.9% | 48.8% | 9.1 | multidão | 45.9% | 0 | 0.0% | 0.0% | 0.0% |
| Mago | 20.4% | 29.5% | 24.2% | 33.2% | 12.8 | multidão | 26.8% | 0 | 0.0% | 0.0% | 0.0% |

## Generalistas (|inclinação| < 6 pontos)

- **Guerreiro** — 3.4: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Ladino** — 3.6: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Necromante** — 5.4: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
