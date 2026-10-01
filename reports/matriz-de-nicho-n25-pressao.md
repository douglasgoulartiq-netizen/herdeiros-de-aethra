# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 1 níveis × 8 sementes = 320 batalhas do motor real.

O time é SEMPRE o mesmo (candidato + guerreiro, clérigo e patrulheiro humanos). A única coisa que muda é quantos inimigos existem. Cada número é a fração do dano do time que saiu do candidato — não vitória, que satura perto de 100% e não distingue ninguém.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Patrulheiro | 64.8% | 69.3% | 54.6% | 48.5% | -16.4 | alvo único | 59.2% | 0 | 0.0% | 0.0% | 0.0% |
| Ladino | 60.9% | 35.2% | 54.6% | 50.0% | -10.9 | alvo único | 50.2% | 0 | 0.0% | 0.0% | 0.0% |
| Clérigo | 16.4% | 9.3% | 7.9% | 10.2% | -6.2 | alvo único | 12.0% | 21 | 0.0% | 0.0% | 0.0% |
| Bardo | 5.1% | 3.6% | 3.3% | 3.8% | -1.2 | ⚠ generalista | 3.9% | 0 | 24.2% | 4.1% | 0.0% |
| Paladino | 1.0% | 1.7% | 3.0% | 3.8% | 2.8 | ⚠ generalista | 2.3% | 0 | 0.0% | 7.9% | 3.1% |
| Necromante | 0.0% | 2.3% | 5.8% | 5.8% | 5.8 | ⚠ generalista | 3.5% | 0 | 45.4% | 3.1% | 0.0% |
| Bárbaro | 20.1% | 13.9% | 25.2% | 28.8% | 8.6 | multidão | 22.3% | 7 | 0.0% | 9.4% | 3.1% |
| Druida | 6.1% | 10.1% | 14.8% | 17.8% | 11.7 | multidão | 12.1% | 0 | 0.0% | 3.1% | 0.0% |
| Guerreiro | 11.0% | 5.5% | 20.1% | 26.5% | 15.5 | multidão | 15.7% | 0 | 0.0% | 9.4% | 0.0% |
| Mago | 13.6% | 15.3% | 30.9% | 37.4% | 23.8 | multidão | 24.2% | 0 | 0.0% | 0.0% | 0.0% |

## Generalistas (|inclinação| < 6 pontos)

- **Bardo** — -1.2: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Paladino** — 2.8: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Necromante** — 5.8: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
