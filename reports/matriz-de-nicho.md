# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 3 níveis × 16 sementes = 1920 batalhas do motor real.

O time é SEMPRE o mesmo (candidato + guerreiro, clérigo e patrulheiro humanos). A única coisa que muda é quantos inimigos existem. Cada número é a fração do dano do time que saiu do candidato — não vitória, que satura perto de 100% e não distingue ninguém.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Ladino | 66.6% | 41.5% | 54.7% | 54.4% | -12.2 | alvo único | 54.3% | 0 | 0.0% | 0.4% | 0.0% |
| Patrulheiro | 64.7% | 51.1% | 54.7% | 54.3% | -10.5 | alvo único | 56.2% | 0 | 1.9% | 0.4% | 0.0% |
| Bardo | 7.4% | 10.0% | 6.3% | 4.5% | -2.9 | ⚠ generalista | 7.1% | 1 | 36.7% | 3.6% | 0.0% |
| Clérigo | 9.2% | 15.6% | 9.8% | 8.8% | -0.3 | ⚠ generalista | 10.8% | 1 | 0.0% | 3.9% | 0.0% |
| Bárbaro | 10.5% | 19.1% | 11.9% | 12.3% | 1.7 | ⚠ generalista | 13.5% | 1 | 12.3% | 16.6% | 0.5% |
| Paladino | 3.6% | 4.6% | 5.5% | 5.6% | 2.0 | ⚠ generalista | 4.8% | 0 | 15.0% | 17.7% | 1.6% |
| Guerreiro | 19.2% | 19.9% | 20.2% | 22.9% | 3.7 | ⚠ generalista | 20.6% | 0 | 0.0% | 11.6% | 0.0% |
| Necromante | 0.5% | 3.6% | 6.7% | 10.5% | 9.9 | multidão | 5.3% | 0 | 53.0% | 3.2% | 0.0% |
| Druida | 9.2% | 14.0% | 16.4% | 20.5% | 11.4 | multidão | 15.0% | 0 | 18.2% | 3.7% | 0.0% |
| Mago | 16.9% | 24.5% | 30.6% | 32.3% | 15.4 | multidão | 26.0% | 0 | 0.0% | 2.8% | 0.0% |

## Generalistas (|inclinação| < 6 pontos)

- **Bardo** — -2.9: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Clérigo** — -0.3: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Bárbaro** — 1.7: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Paladino** — 2.0: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Guerreiro** — 3.7: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
