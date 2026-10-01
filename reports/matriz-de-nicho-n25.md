# Matriz de nicho — participação no dano do time

10 classes × 4 contagens de inimigos × 1 níveis × 16 sementes = 640 batalhas do motor real.

O time é SEMPRE o mesmo (candidato + guerreiro, clérigo e patrulheiro humanos). A única coisa que muda é quantos inimigos existem. Cada número é a fração do dano do time que saiu do candidato — não vitória, que satura perto de 100% e não distingue ninguém.

**Inclinação** = participação com 6 inimigos menos participação com 1. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.

| Classe | 1 inim. | 2 inim. | 4 inim. | 6 inim. | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Patrulheiro | 80.6% | 68.5% | 64.1% | 60.7% | -19.9 | alvo único | 68.5% | 0 | 0.0% | 0.0% | 0.0% |
| Ladino | 73.6% | 33.5% | 62.4% | 59.7% | -13.8 | alvo único | 57.3% | 0 | 0.0% | 0.0% | 0.0% |
| Clérigo | 10.1% | 11.2% | 8.4% | 5.7% | -4.4 | ⚠ generalista | 8.9% | 0 | 0.0% | 1.6% | 0.0% |
| Bardo | 2.8% | 7.6% | 3.9% | 1.2% | -1.6 | ⚠ generalista | 3.9% | 0 | 28.1% | 0.0% | 0.0% |
| Necromante | 0.0% | 0.6% | 0.8% | 1.2% | 1.2 | ⚠ generalista | 0.6% | 0 | 52.3% | 0.0% | 0.0% |
| Paladino | 1.3% | 2.3% | 3.8% | 3.3% | 2.1 | ⚠ generalista | 2.7% | 0 | 0.0% | 6.3% | 0.0% |
| Bárbaro | 10.5% | 17.1% | 18.1% | 19.9% | 9.4 | multidão | 16.6% | 2 | 0.0% | 4.7% | 0.0% |
| Druida | 3.0% | 10.4% | 13.6% | 14.4% | 11.3 | multidão | 10.4% | 0 | 0.0% | 0.6% | 0.0% |
| Guerreiro | 4.2% | 11.9% | 16.0% | 24.6% | 20.5 | multidão | 14.2% | 0 | 0.0% | 3.1% | 0.0% |
| Mago | 4.3% | 19.0% | 24.2% | 28.9% | 24.6 | multidão | 19.1% | 0 | 0.0% | 0.0% | 0.0% |

## Generalistas (|inclinação| < 6 pontos)

- **Clérigo** — -4.4: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Bardo** — -1.6: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Necromante** — 1.2: rende quase o mesmo contra 1 e contra 6 inimigos.
- **Paladino** — 2.1: rende quase o mesmo contra 1 e contra 6 inimigos.

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
