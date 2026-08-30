# Relatório — Mão de Cards de Batalha (HDA)

Implementação concluída, testada e auditada. Este documento segue a estrutura
pedida no item 100 do briefing.

**Regra que governou todas as decisões abaixo:** o jogo prevê, destaca e
explica — nunca joga. Nenhuma linha deste trabalho executa uma ação sozinha,
e todo card continua clicável, inclusive um sem destaque nenhum e inclusive
o card que o sistema considera ruim.

---

## 1. Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/ui/BattleUI.js` | O turno do jogador deixou de ser uma fileira de `<button>` e passou a ser a mão de cards. Adicionados: faixa de contexto tático, prévia na arena (barra-fantasma), intenção antecipada, interrupção, feedback de dano especializado, hit-stop, faixas de NATURAL 20/1 e POSTURA ROMPIDA, resumo pós-ação. |
| `src/systems/CombatSystem.js` | **Só adições só-leitura.** Nenhuma fórmula existente foi alterada. Novos métodos de prévia: `estimarFaixaDanoMagico`, `estimarCura`, `chancesD20`, `estimarRuptura`, `chanceBloqueioSeDefender`, `estimarDanoIntencao`. `estimarFaixaDano` passou a devolver também `esperado`, `reacao` e `elemento`. |
| `src/ui/SoundFX.js` | 6 sons novos de interface (hover, seleção, erro, combo, definitiva pronta, recarga concluída, ruptura). Continuam mudos no volume padrão. |
| `index.html` | Uma linha: `<link>` para `src/battle-cards.css`. |
| `package.json` | Script `npm run test:cards`. |

## 2. Arquivos criados

| Arquivo | Linhas | Papel |
|---|---:|---|
| `src/systems/BattleForecast.js` | 634 | **O que vai acontecer.** Monta a mão e prevê cada card. Puro, sem DOM. |
| `src/systems/TacticalAdvisor.js` | 380 | **O que vale mais a pena.** Tactical Score interno + níveis. Puro, sem DOM. |
| `src/systems/BattleSettings.js` | 122 | Preferências de leitura da batalha (localStorage próprio). |
| `src/systems/ElementIdentity.js` | 116 | Vocabulário e paleta de Aethra por elemento (runa, cor, nome de mundo). |
| `src/ui/BattleCards.js` | 816 | **Como isso aparece e responde ao toque.** Única camada com DOM. |
| `src/battle-cards.css` | 898 | Toda a linguagem visual dos cards, isolada de `style.css`. |
| `scripts/test-battle-cards.mjs` | 375 | Suíte de 49 verificações de recomendação, em Node puro. |
| `scripts/preview-cards.html` | — | Bancada visual: 4 cenários de mão lado a lado. |
| `scripts/preview-batalha.html` | — | Bancada de integração: batalha real, com parâmetros de cenário. |

A separação em três módulos não é enfeite: é o que permite testar a
recomendação em Node, sem navegador, e é o que garante que a UI não consiga
"trapacear" no cálculo.

## 3. Sistema de Tactical Score

Cada card recebe um score interno de 0 a 100, montado a partir de
contribuições **nomeadas** — é por isso que o jogo consegue responder "por que
essa opção é boa?" sem que a UI saiba nada sobre o cálculo.

Componentes: dano relativo à vida restante do alvo · dano comparado ao resto
da mão · execução · fraqueza/resistência elemental · reação · combo de equipe ·
ruptura · status aplicado · interrupção · cura (déficit, valor efetivo, risco
de morte) · defesa (dano evitado, salva-vida) · buff · reposicionamento ·
custo de recurso · janela de definitiva.

Três decisões de projeto que valem mais que os pesos:

- **O score nunca aparece.** O jogador vê `★ MELHOR JOGADA`, um nível de
  brilho e, no detalhe, os motivos em texto. Nunca "93 pontos".
- **Não é "maior DPS sempre".** Cura de emergência, defesa que salva,
  interrupção e quebra de postura entram na mesma moeda de pontos e ganham
  quando o contexto pede. A suíte de testes cobre exatamente isso.
- **Imunidade e indisponibilidade zeram o score.** Um card que causaria 0 de
  dano, ou que está sem Éter, jamais recebe destaque, por mais alto que o
  resto do cálculo tivesse ficado.

## 4. Recomendação de card

Três níveis, com comportamento visual distinto e nenhum flash agressivo:

- **Nível 1** — boa opção: borda tingida pelo elemento, brilho fraco, estático.
- **Nível 2** — excelente: borda no tom do elemento + respiro de 1,9s.
- **Nível 3** — oportunidade especial: moldura dourada extra + respiro de 1,7s
  + selo `★ OPORTUNIDADE`. Reservado a execução garantida, interrupção,
  quebra de postura e jogada que salva alguém.

No máximo **3 cards acesos ao mesmo tempo** e **apenas um** com a estrela
(item 67). Secundários nunca passam do nível 1 e só aparecem se estiverem a
22 pontos ou menos do topo.

A recomendação é recalculada por invalidação de estado (ver §18) — troca de
alvo, status novo, recarga, recurso, aliado que cai, nova leva. Nunca fica
"presa" no card de antes.

Personalidade (item 47): `Desligada` / `Básica` (só nível 3) / `Completa`.

## 5. Recomendação de movimento

Aethra **não tem grade de hexágonos em combate** — a posição que existe de
verdade é a formação (frente/retaguarda, `FormationSystem.js`), e ela muda
duas coisas reais: 25% do dano físico recebido enquanto houver aliado de pé na
frente, e quais arquétipos inimigos conseguem te alcançar.

Então o card `Recuar para a Retaguarda` / `Avançar para a Frente` é a tradução
honesta dos itens 59-62: custa o turno, mostra `DANO EVITADO ~N` calculado a
partir das intenções conhecidas, lista de quem você sai da mira, e só é
recomendado quando muda alguma coisa. Sem aliado vivo na frente, recuar recebe
pontuação negativa e nunca é sugerido — está coberto por teste.

Não inventei uma grade que o motor não tem. O que ficou de fora por isso está
declarado em §22.

## 6. Dano previsto

Vem inteiro de `CombatSystem.js`, dos mesmos métodos que espelham as fórmulas
reais no mesmo arquivo. Considera arma, atributo (com `atributoForcado` por
tipo de habilidade), multiplicador da skill, elemento, matriz elemental,
terreno, clima, combo de equipe, estado elemental do alvo, reação prevista,
buff de fúria, bônus órquico, defesa efetiva (com o desconto certo: 50% no
físico, 30% no mágico), redução de formação e bônus de alvo atordoado.

O card mostra a faixa `min–max`; o detalhe mostra também o esperado e a faixa
de crítico. Três modos: `Não mostrar` / `Faixa` / `Detalhado`.

## 7. Preview de HP

Ao passar o mouse ou armar um card, a barra de HP do alvo ganha um segmento
fantasma em **três camadas** — máximo (hachurado), esperado (com marca) e
mínimo (sólido). É a faixa de incerteza do item 13 desenhada em vez de
escrita. Ao lado, o HP resultante: `→ 34–51`, ou `→ 0 ☠` quando a morte é
garantida no piso da faixa.

Cura usa a mesma barra na direção oposta, em verde, já limitada ao espaço
livre — o card mostra `CURA EFETIVA`, não a cura bruta, para não induzir o
jogador a gastar uma cura grande num alvo quase cheio (item 18).

A prévia é repintada direto nos elementos da arena, sem recriar os cards.

## 8. Combos

Dois sistemas distintos, ambos já existentes no motor e agora visíveis antes
de confirmar:

- **Reação elemental** (estado no alvo + elemento do golpe): o card mostra
  `🥶 CONGELAMENTO`, o alvo ganha um elo visual, e o detalhe traz a descrição
  completa da reação.
- **Combo de party** (aliado preparou o alvo para outro): mostrado como
  `Lirael → Aric` no detalhe, com o nome do combo no card.

## 9. Fraquezas

`↑ VULNERÁVEL` / `↑↑ VULNERÁVEL` na badge, fundo do card levemente tingido,
e +14 / +8 pontos no score. O número flutuante do golpe também muda:
`-142` em verde-claro com o rótulo `VULNERÁVEL!`.

## 10. Resistências

`↓ RESISTENTE` / `↓↓ MUITO RESISTENTE`, o card perde saturação (mas continua
plenamente jogável), e o score cai 10 / 18 pontos. `IMUNE` zera o score.
O dano resistido aparece menor e acinzentado, com o rótulo `RESISTIDO`.

Exceção deliberada: um card recomendado **não** fica dessaturado. Se ele venceu
apesar da resistência (porque dispara uma reação, por exemplo), apagá-lo
contradiria o próprio destaque.

## 11. Reaction Cards

Implementado como **janela de resposta**, não como cards reativos separados —
ver §22 para o porquê. Na prática: a intenção inimiga é fixada quando a barra
do inimigo passa de 85%, então o jogador vê o que vem **durante o próprio
turno**, e o conselheiro promove a resposta certa (Defender, escudo, recuar,
ou o golpe que interrompe) acima do maior dano.

## 12. Interrupt

Esta é uma promessa verificável, não um adorno. Uma ação anunciada é cancelada
de verdade quando o inimigo perde a capacidade de agir antes de executá-la —
morte, atordoamento por quebra de postura, ou controle por estado elemental.
São as mesmas três condições que o motor já respeitava; o que mudou é que
agora elas são **ditas em voz alta** e a mão consegue prevê-las.

Um card só recebe `⚡ INTERROMPE` quando pode abater, congelar ou estourar a
postura do inimigo que está telegrafando. Ambos os caminhos foram observados
numa partida real (§19).

Correção necessária no caminho: a intenção passou a ser decidida **uma única
vez** e reusada. Antes, `decidirAcao()` era chamada de novo para exibir o
telegraph — e como ela contém sorteios (o Ladrão rouba com 60% de chance), o
jogo podia anunciar uma coisa e executar outra.

## 13. Estados visuais

Todos os 13 pedidos: `idle`, `hover`, `selected`, `recommended` (3 níveis),
`combo`, `execution`, `disabled`, `cooldown`, `insufficient-resource`,
`reaction`, `ultimate-ready`, `resistant`, `vulnerable` — mais `condicao`
(bloqueio por condição) e `foco` (teclado).

**Prioridade explícita (item 85):** `disabled` vence tudo. Um card sem Éter ou
em recarga não pisca como recomendado — a regra CSS desliga animação, brilho e
transform. Verificado no teste visual: 0 conflitos em 30 cards.

Card em recarga mostra overlay radial + `RECARGA 2 TURNOS`. Card sem recurso
mostra `FALTA 16 DE ÉTER` e `Éter 9/25`, com o custo riscado. Nenhum card some.

## 14. Animações

Entrada com stagger de 55ms · seleção que sobe 9px e cresce 4,5% (demais cards
perdem intensidade) · cancelamento suave de 160ms · card usado que avança e
some · recusa que sacode 300ms · respiro de 1,7–1,9s · runa do elemento que
acende ao virar recomendado · texturas ambientais por elemento (brasas,
cristalização, onda, mineral, linhas de vento, brotos, prisma, sombra móvel) ·
hit-stop de 90ms no crítico · faixas de NATURAL 20/1 e POSTURA ROMPIDA.

Todas usam apenas `transform`, `opacity`, `filter`, `box-shadow` e
`background-position` — nenhuma provoca reflow.

As texturas elementais só se movem quando o card está em foco, selecionado ou
recomendado. Em repouso, oito animações simultâneas seriam ruído e custo.

## 15. Sons

`hover` (35ms, 12% de volume, com janela anti-repetição de 70ms), `seleção`,
`erro`, `combo`, `definitiva pronta`, `recarga concluída`, `ruptura`. Todos por
osciladores da Web Audio API, sem arquivo externo, e todos mudos enquanto o
volume de efeitos estiver no padrão (`desligado`).

## 16. Mobile

Padrão único para mouse e toque: **1º toque arma** (mostra detalhe, prévia de
HP e o rótulo "Toque de novo para confirmar"), **2º toque confirma**,
**toque longo (450ms)** abre o detalhe avançado. Nenhuma ação irreversível com
um clique só. Nada depende de hover.

Layout: 2 cards por linha a 390px, quebra em linhas em vez de rolagem
horizontal, paginação acima de 8 cards. O card do inimigo inteiro seleciona o
alvo (área de toque muito maior que o botãozinho). Verificado a 390 / 820 /
1280px: **zero rolagem horizontal**.

## 17. Acessibilidade

- `prefers-reduced-motion: reduce` e a opção `Animações: Reduzidas` desligam
  **todas** as animações e transições dos cards — verificado: 0 de 30 cards
  animando. O destaque vira uma borda dourada permanente: a informação não
  some, só para de se mexer.
- Nenhum pulso rápido, nenhum flash. Ciclos de 1,7–1,9s.
- A cor **nunca** é o único sinal: cada elemento tem runa, ícone, nome escrito
  e textura própria. Teste garante 12 runas distintas para 12 elementos.
- Alto contraste (classe já existente do jogo) repinta os cards em preto/branco
  e remove as texturas.
- Teclado: `Tab` alcança os cards, `Enter`/`Espaço` arma e confirma, `Escape`
  cancela de qualquer lugar da tela. O foco é devolvido ao card após o
  re-render.
- Toda badge tem texto legível, não só ícone.

## 18. Performance

- **Cache por assinatura de estado.** A mão só é reavaliada quando algo que
  entra no cálculo muda (HP, Éter, recargas, status, alvo, intenções, clima,
  terreno, configurações). O loop de ATB roda a cada 140ms e não dispara
  recálculo nenhum sozinho.
- **Medição real:** 9 cards, 2000 avaliações completas em 101ms →
  **0,051ms por avaliação**, ou 0,30% de um quadro a 60fps. Mesmo sem cache
  nenhum, caberia folgado.
- A prévia de HP manipula os elementos existentes; não recria os cards.
- Zero timers independentes novos: as animações são CSS, e os estados visuais
  são centralizados em classes.

## 19. Testes realizados

**Suíte lógica** (`npm run test:cards`) — 49 verificações, todas passando:

| Cenário | Verifica |
|---|---|
| Inimigo vulnerável | Chama pontua acima de Maré contra Geada e vira a recomendação |
| Aliado a 8% de HP | Cura de 100 vence golpe de 300 — **e deixa de vencer com vida cheia** |
| Chefe com golpe letal anunciado | Resposta defensiva vence o ataque; dano evitado é calculado |
| Inimigo com 1 HP | `EXECUÇÃO GARANTIDA`, nível 3, e chance de matar < 100% (respeita o erro) |
| Combo disponível | Reação Congelamento prevista, status resultante mostrado, card recomendado |
| Sem recurso | Bloqueado com a falta exata, score 0, sem destaque, **sem sumir da mão** |
| Alvo imune | Score 0, jamais recomendado |
| Posição | Recuar recomendado com aliado na frente; **não** recomendado sem |
| Ruptura/interrupção | Quebra prevista, card marcado como interrupção, nível 3 |
| Personalidade | OFF não destaca nada mas ainda prevê; BÁSICO só destaca o óbvio |
| Foco visual | No máximo 3 destaques, exatamente 1 estrela |
| Layout | 6/7/9 cards e nome de 56 caracteres sem quebrar |
| Identidade | 12 elementos com runa distinta |
| **Pureza** | 10 avaliações seguidas não alteram **nada** do estado de batalha |
| Cura excedente | Cura efetiva limitada ao espaço, desperdício reportado |

**Teste visual** (Chromium headless, 1280 / 820 / 390px): 30 cards em 4
cenários — 0 erros de página, 0 rolagem horizontal, 0 card com conteúdo
estourando, 0 conflito entre `disabled` e `recommended`.

**Teste de integração** (`preview-batalha.html`, batalha real com dados reais,
`iniciarBatalha()` de verdade): partida completa até a vitória, 30 ações
confirmadas, **0 erros de JavaScript**, e todos os 10 marcos observados —
intenção, telegraph, resumo pós-ação, barra-fantasma, número flutuante,
**quebra de postura**, **atordoamento**, **ambos os caminhos de interrupção**,
natural 20/1 e hit-stop.

**Testes de acessibilidade e configuração:** reduced-motion, alto contraste,
navegação por teclado, e `sugestão: OFF` + `dano: OFF` (0 destaques, 0 valores,
0 dicas, 30 cards ainda presentes).

## 20. Bugs encontrados

Todos encontrados pelos testes, não por leitura de código:

1. **Card armava e se cancelava no mesmo clique.** O cancelamento por
   "clique fora" checava `acoesEl.contains(ev.target)` no bubbling, mas o
   handler do card já havia reconstruído a mão — o elemento clicado não estava
   mais no DOM, `contains` dava `false`, e a seleção era desfeita. Na prática,
   **nenhuma ação podia ser confirmada.** O mais grave dos cinco.
2. **Pulso do card recomendado movia o próprio card.** `translateY` de 2px em
   loop infinito num alvo de clique: mira instável no toque e no mouse.
3. **Teclado perdia o foco ao armar.** O re-render destruía o elemento focado;
   quem joga por teclado armava e ficava travado.
4. **Painel de configurações nascia aberto.** `display: flex` vencia `[hidden]`.
5. **Layout:** cards da segunda linha esticavam até a altura da linha; faixas de
   rodapé (melhor jogada, bloqueio) cobriam a última badge; badges longas
   vazavam para fora do card.
6. **Intenção decidida duas vezes.** `decidirAcao()` contém sorteios; chamá-la
   para exibir e de novo para executar podia anunciar uma ação e executar outra.
7. **Intenção chegava tarde demais.** Registrada só quando o inimigo ficava
   pronto — mas o ATB fica pausado durante o turno do jogador, então na prática
   ele decidia sem nunca ver o que vinha.
8. **Plano obsoleto.** Com a intenção antecipada, o alvo escolhido podia morrer
   antes; o motor só tratava `plano.alvo` nulo, não um alvo já derrotado.
9. **`mouseleave` após invalidação** lançava `TypeError` quando o cache havia
   sido descartado por uma ação inimiga no meio-tempo.
10. **Interrupção invisível.** Matar o inimigo antes do golpe funcionava, mas a
    ação anunciada sumia em silêncio — a única confirmação seria o jogador
    reparar numa ausência.

## 21. Bugs corrigidos

Os dez. Cada correção está comentada no ponto exato do código, dizendo qual era
o sintoma — nenhuma foi apagada da história.

- (1) A origem do clique passou a ser marcada na fase de **captura**, antes de
  qualquer re-render.
- (2) O respiro do nível 3 saiu do `transform` do card e foi para a sombra e o
  anel `::before`.
- (3) O foco é devolvido ao card armado após o re-render; `Escape` agora é
  global.
- (4) `.cards-config-painel[hidden] { display: none !important }`.
- (5) `align-items: flex-start`; `padding-bottom` reservado por estado (22px, e
  34px quando o bloqueio tem duas linhas); badges com reticências e rótulos
  encurtados.
- (6, 7, 8) Intenção decidida uma vez, registrada a 85% da barra, com guarda de
  alvo morto que redecide.
- (9) Guarda de `cacheAvaliacao` no `mouseleave`.
- (10) Log e ficha `⚡ INTERROMPIDO` nos dois caminhos.

Após as correções: 49/49 na suíte lógica, 0 erros na integração, todos os
marcos observados.

## 22. Pendências reais

Coisas do briefing que **não** estão implementadas, e por quê. Nenhuma delas
está fingida no código.

1. **Card de ambiente (item 58 — "DERRUBAR PILAR").** O combate não tem
   objetos de cenário. Implementar exige criar o conceito no motor e nos dados
   de encontro, não só um card. Não inventei um.
2. **Cards de reação dedicados (item 21 — ESQUIVAR / BLOQUEAR / CONTRA-MAGIA).**
   O motor de turnos não abre uma janela em que o jogador age *durante* a ação
   do inimigo: enquanto o telegraph roda, o ATB está pausado. Entregar isso de
   verdade significa reescrever `avancarFila`/`iniciarTelegrafo` — risco alto
   para o resto do combate. O que existe hoje (intenção antecipada + resposta
   promovida + interrupção real) cobre a intenção do item sem mentir.
3. **Selos de sinergia de arma / talento / passiva (itens 52-54).** As badges
   existem e funcionam, mas nenhuma habilidade carrega hoje os campos
   `sinergiaArma` / `origemTalento`. Na prática os selos nunca aparecem até
   `TalentSystem.js` propagar essa metadata — é uma mudança de dados, pequena,
   mas fora do escopo desta entrega.
4. **Rank visual real (item 55).** A "potência" da moldura é derivada de
   multiplicador + custo + recarga, porque o objeto de habilidade em combate
   não carrega o `tier` da árvore. Funciona, mas é heurística, não o rank.
5. **Multi-alvo e fogo amigo (itens 64-65).** Só o Sopro Elemental atinge área,
   e ele nunca alcança aliados. A previsão multi-alvo está completa e o aviso
   `⚠ ALIADO NA ÁREA` já dispara sozinho — mas hoje nada o aciona.
6. **Card temporário / `REAÇÃO DISPONÍVEL` (item 78).** A animação de entrada
   existe (`.carta-nova`); nada a usa, porque não existem cards temporários.
7. **"ENRAGE EM 2 TURNOS" (item 43).** O motor não tem contador de enrage. O
   card de contexto mostra FASE (por faixa de HP) e POSTURA, que são reais.
8. **"Percepção" (item 44)** foi mapeada para a maior Destreza viva do time —
   Aethra não tem um atributo de Percepção. Três níveis de revelação.
9. **Háptico (item 80).** O jogo já vibra em dano recebido; não estendi para os
   cards.

**Observação de balanceamento, não de UI:** com a previsão na tela ficou
visível que `buff_defesa` mitiga muito pouco. Contra um golpe de 46–63, o
Escudo Arcano (+50% de defesa) evita ~2 de dano, enquanto `Defender` bloqueia
o golpe inteiro com 65% de chance. A previsão está certa; o número do jogo é
que parece baixo. Vale olhar `defesaEfetiva` × `dano - defesa * 0.5`.

---

## Como testar

```
npm run test:cards                  # 49 verificações de recomendação, sem navegador
python3 -m http.server 8000         # e abrir:
#   /scripts/preview-cards.html     -> 4 cenários de mão lado a lado
#   /scripts/preview-batalha.html   -> batalha real (?nivel=20&chefeFraco=1)
```
