# Relatório de simulação da economia de Fragmentos de Aethra (gacha)

Simulação de Monte Carlo (não altera nenhum arquivo do jogo) para validar o
sistema de invocação (gacha) de "Herdeiros de Aethra". Script:
`scripts/gacha_sim/simulate_economy.py`. Resultados brutos em `results.json`.

## 1. Metodologia

- Motor de pity/garantias simulado com **1.000.000 de jogadores** x **400
  pulls sequenciais** por categoria de banner (permanente e evento),
  totalizando 400 milhões de eventos de pull por categoria — muito acima do
  piso de 1.000.000 de sequências pedido. As regras de pity/garantia/50-50
  **não dependem do perfil de jogador nem do cenário de renda** (só a
  *quantidade* de pulls/semana muda por perfil), então rodamos o motor
  UMA vez e reaproveitamos a mesma simulação para todas as 9 combinações
  perfil × cenário, recortando a janela de pulls correspondente a cada um.
  Isso é matematicamente equivalente a rodar o motor 9 vezes e é
  declarado aqui por transparência.
- Para métricas "em regime" (jogador veterano, longe do início da conta —
  hard pity por mês e taxa de duplicatas por mês), usamos uma janela tardia
  do histórico simulado (pulls 200–400) em vez da janela desde o pull 1,
  para não sofrer o viés de "conta nova" (pity sempre começa zerado). Para
  métricas do "mês 1" (primeiro mês de um jogador novo), usamos a janela
  real desde o pull 1, que é o cenário correto nesse caso.
- Banner iniciante simulado à parte, com 1.000.000 de jogadores x 40 pulls
  (o teto fixo do banner).
- Duplicatas: **não existe um roster real de personagens no jogo ainda**,
  então assumimos, só para esta simulação, um roster fictício por raridade
  (Comum=20, Incomum=15, Raro=10, Épico=6, Lendário=4 personagens
  possíveis) e tratamos "duplicata" como "id de personagem, dentro daquela
  raridade, que o jogador já possuía". **Isso é uma simplificação
  explícita** — com um roster tão pequeno (55 personagens no total), um
  jogador dedicado satura o roster em poucos meses e a taxa de "personagem
  novo" cai para quase zero depois disso; um roster real bem maior (ou
  recompensas de "fragmento de personagem" para dupes) mudaria esse número,
  mas a curva de pity/garantias em si não muda.
- Renda semanal: ver seção 2. Os 3 cenários (conservador -25%, equilibrado
  = como especificado, generoso +25%) mantêm custo de pull, odds e pity
  IDÊNTICOS — só a renda de fragmentos varia.

## 2. Modelo de renda semanal (premissas)

Adotamos a leitura de que os "6 buckets" descritos formam duas famílias:

- **Recorrentes (para sempre)**: diário/recorrente, masmorras/desafios,
  eventos — juntos formam a renda "steady-state" (semana 4+), na proporção
  relativa 20:20:10 (a mesma proporção definida para a fase early).
- **Bônus únicos (só semanas 1-3)**: quests/progressão, exploração,
  conquistas — como esse conteúdo é finito, tratamos como **lump sum único**
  (não um valor semanal recorrente), distribuído nas semanas 1-3 na
  proporção relativa 30:10:10. O valor total do lump é calculado para que a
  **média semanal das primeiras 3 semanas bata exatamente com a meta
  "early"** de cada perfil (assumindo que as fontes recorrentes já operam
  no valor steady desde a semana 1):

  `lump_total = 3 × (renda_early_semana − renda_steady_semana)`

- **Casual**: não há indicação de tapering para este perfil no briefing (só
  "~600/semana"), então modelamos renda **achatada** (early = steady =
  600), sem bônus único de introdução. Isso é uma escolha de simplicidade,
  documentada aqui — se o design quiser dar um empurrãozinho de boas-vindas
  ao casual também, um lump pequeno (ex.: 100-150 fragmentos únicos) pode
  ser adicionado sem quebrar a meta de 5-7 pulls/semana.
- **Ativo** e **Dedicado**: seguem os valores early/steady dados no
  briefing (1000→800 e 1400→1150 respectivamente).

Custo de pull: **100 fragmentos, fixo, igual para todos** (não
personalizado). Pacote de 10 pulls = 1000 fragmentos (sem desconto), com a
vantagem de garantir a ativação de um piso de raridade dentro do pacote.

## 3. Resultados do motor de gacha (independem de perfil/cenário)

| Métrica | Valor |
|---|---|
| Primeiro Lendário — média | 37,6 pulls |
| Primeiro Lendário — p99 | 48 pulls |
| Primeiro Lendário — máximo observado | 50 pulls (bate com o hard pity teórico) |
| Featured garantido (banner evento) — média ("caminho de sorte") | 56,3 pulls |
| Featured garantido — p99 | 92 pulls |
| Featured garantido — máximo observado | 99 pulls |
| Featured garantido — limite teórico pior caso | 100 pulls (confirmado: nunca ultrapassado) |
| % de jogadores que bateram hard pity (pull 50) ao menos 1x em 400 pulls | 0,24% |

Checagem de sanidade: a média do featured (56,3) bate com a previsão
analítica `0,5 × 37,6 + 0,5 × (2 × 37,6) = 56,4` (50% dos jogadores ganham o
50/50 na primeira Lendária; os outros 50% precisam de um segundo ciclo de
pity completo) — confirma que a mecânica de 50/50 + garantia persistente
está implementada corretamente.

## 4. Banner iniciante (isolado)

40 pulls no total (10 grátis garantidos na introdução + até 30 pagos),
com garantias: Raro+ até o pull 10, Épico+ até o pull 20, Lendário até o
pull 40.

| Pergunta | Resultado |
|---|---|
| % que chega a Raro+ usando só os 10 pulls grátis | **100%** (garantido por regra — o pull 10 força Raro+ se ainda não saiu) |
| % que chega a Épico+ usando só os 10 pulls grátis (naturalmente, sem forçar) | **~50,0%** |
| % que chega a Épico+ até o pull 20 (com a garantia) | 100% (garantido por regra) |
| % que chega a Lendário até o pull 40 (com a garantia) | 100% (garantido por regra) |

Ou seja: um jogador que usa **só** os 10 pulls grátis da introdução sempre
sai com pelo menos um Raro (é garantido por design), e tem cerca de 1 em 2
chances de sair também com um Épico ou Lendário de bônus — um resultado de
onboarding bem generoso e sem risco de "10 pulls e nada de bom", o que é
positivo para a primeira impressão do jogo.

## 5. Resultados por cenário e perfil

Legenda: "mês 1" = 3 semanas em ritmo "early" + 1,3 semana em ritmo
"steady" (4,3 semanas). "mês em regime" = 4,3 semanas em ritmo "steady",
medido em jogador veterano (não no primeiro mês).

### 5.1 Cenário `conservador` (renda −25%)

| Perfil | Pulls/sem (early) | Alvo | Pulls/sem (steady) | Pulls no mês 1 | Pulls/mês em regime | Hard pity ≥1x no mês 1 | Hard pity ≥1x no mês em regime | Personagens novos/mês (mês1 · regime) | Duplicatas/mês (mês1 · regime) |
|---|---|---|---|---|---|---|---|---|---|
| Casual | 4,5 | 5-7 | 4,5 | 19,4 | 19,3 | 0,00% | 0,01% | 16,0 · 0,18 | 3,0 · 18,8 |
| Ativo | 7,5 | 8-12 | 6,0 | 30,3 | 25,8 | 0,00% | 0,02% | 23,0 · 0,25 | 7,0 · 25,8 |
| Dedicado | 10,5 | 12-16 | 8,6 | 42,7 | 37,1 | 0,00% | 0,02% | 29,6 · 0,36 | 13,4 · 36,6 |

**Todos os perfis ficam fora da faixa-alvo de pulls/semana** (esperado —
é o cenário de estresse "-25%", não deveria bater a meta).

### 5.2 Cenário `equilibrado` (renda como especificada — RECOMENDADO)

| Perfil | Pulls/sem (early) | Alvo | Pulls/sem (steady) | Pulls no mês 1 | Pulls/mês em regime | Hard pity ≥1x no mês 1 | Hard pity ≥1x no mês em regime | Personagens novos/mês (mês1 · regime) | Duplicatas/mês (mês1 · regime) |
|---|---|---|---|---|---|---|---|---|---|
| Casual | **6,0** | 5-7 ✅ | 6,0 | 25,8 | 25,8 | 0,00% | 0,02% | 20,6 · 0,25 | 5,4 · 25,8 |
| Ativo | **10,0** | 8-12 ✅ | 8,0 | 40,4 | 34,4 | 0,00% | 0,02% | 28,1 · 0,33 | 11,9 · 33,7 |
| Dedicado | **14,0** | 12-16 ✅ | 11,5 | 57,0 | 49,4 | 0,02% | 0,03% | 35,2 · 0,48 | 21,8 · 48,5 |

**Todos os 3 perfis caem dentro da faixa-alvo de pulls/semana na fase
early.** Checagem extra pedida no briefing — "Ativo deve bater hard pity em
~4-6 semanas cumulativas": 3 semanas a 10 pulls/sem (30) + ~2,5 semanas a 8
pulls/sem (20 pulls) = **~5,5 semanas** para acumular as 50 pulls do hard
pity → dentro da faixa 4-6 semanas pedida. ✅

Único ponto de atenção: **Dedicado em regime fica em 11,5 pulls/semana**,
levemente abaixo do piso da faixa-alvo (12). É uma diferença de ~4%,
dentro da margem de ruído de design; se quiser fechar exatamente, bastaria
subir a renda recorrente semanal do Dedicado de 1150 para ~1200
fragmentos/semana (ver seção 7, ajuste opcional).

### 5.3 Cenário `generoso` (renda +25%)

| Perfil | Pulls/sem (early) | Alvo | Pulls/sem (steady) | Pulls no mês 1 | Pulls/mês em regime | Hard pity ≥1x no mês 1 | Hard pity ≥1x no mês em regime | Personagens novos/mês (mês1 · regime) | Duplicatas/mês (mês1 · regime) |
|---|---|---|---|---|---|---|---|---|---|
| Casual | 7,5 | 5-7 | 7,5 | 32,2 | 32,2 | 0,00% | 0,02% | 24,1 · 0,31 | 7,9 · 31,7 |
| Ativo | 12,5 | 8-12 | 10,0 | 50,5 | 43,0 | 0,02% | 0,03% | 32,7 · 0,42 | 17,3 · 42,6 |
| Dedicado | 17,5 | 12-16 | 14,4 | 71,2 | 61,8 | 0,03% | 0,04% | 39,4 · 0,60 | 31,6 · 61,4 |

**Todos os perfis ficam acima da faixa-alvo** (esperado — cenário de
estresse "+25%").

## 6. Efeito de um bônus pontual (+300 fragmentos, evento único)

Sub-simulação ilustrativa: um evento avulso que dá +300 fragmentos de uma
vez (= 3 pulls extras) naquela semana, cenário equilibrado, renda steady:

| Perfil | Pulls/sem normal | Pulls/sem com bônus | Semanas "economizadas" para acumular as 50 pulls do hard pity |
|---|---|---|---|
| Casual | 6,0 | 9,0 (+50%) | ~2,8 semanas |
| Ativo | 8,0 | 11,0 (+37,5%) | ~1,7 semana |
| Dedicado | 11,5 | 14,5 (+26%) | ~0,9 semana |

Um bônus de valor fixo tem impacto **proporcionalmente maior em perfis de
menor renda** (o casual ganha +50% de pulls naquela semana, o dedicado só
+26%) — isso é desejável do ponto de vista de retenção: bônus pontuais
ajudam desproporcionalmente quem gasta/joga menos, sem precisar mexer nas
odds nem no pity de ninguém.

## 7. Recomendação

**Recomendo o cenário `equilibrado` como está**, com um ajuste **opcional**
(não obrigatório): subir a renda recorrente semanal do perfil Dedicado de
1150 → ~1200 fragmentos/semana em regime, para fechar 12,0 pulls/semana
exatos (hoje 11,5, ~4% abaixo do piso da faixa-alvo 12-16). Todo o resto
bate:

- Casual: 6,0 pulls/sem, exatamente no meio da faixa 5-7. ✅
- Ativo: 10,0 pulls/sem early (faixa 8-12) e atinge o piso do hard pity em
  ~5,5 semanas cumulativas (faixa pedida: 4-6 semanas). ✅
- Dedicado: 14,0 pulls/sem early (faixa 12-16). ✅ Steady em 11,5 (levemente
  abaixo de 12 — ajuste opcional acima).
- Custo de pull (100), odds base e tabela de pity **não foram alteradas** —
  só a renda de fragmentos foi calibrada.

Os cenários `conservador` e `generoso` funcionam corretamente como
variantes de estresse (±25%) e, como esperado, saem da faixa-alvo — não são
recomendados como padrão, mas são úteis para testar a robustez do sistema
de pity sob economia mais apertada ou mais generosa (o pity/garantias
seguram bem em ambos os extremos: hard pity continua muito raro, <0,05% de
incidência por mês em todos os casos).
