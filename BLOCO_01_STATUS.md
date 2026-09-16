# Bloco 1 — validação para teste

Este bloco reúne as dez melhorias de maior impacto imediato. Os sistemas que já existiam foram conferidos e os ajustes novos foram sincronizados na pasta `jogavel`.

| # | Melhoria | Situação para teste |
|---:|---|---|
| 1 | Tutorial jogável inicial | Ativo: prólogo + orientação da Vila de Aethra após iniciar aventura. |
| 2 | Objetivo e contexto da jornada | Ativo: missão e jornada aparecem nas telas de missão e nos diálogos. |
| 3 | Retorno após derrota | Ativo: resgate calcula a vila/aldeia/posto/cidade habitado mais próximo. |
| 4 | Prévia de dano | Ativo: cards de batalha mostram faixa de dano e resultado esperado. |
| 5 | Área e efeitos de habilidades | Ativo: previsão informa alvos, cura, defesa e reações quando disponíveis. |
| 6 | Telegráfico de intenção inimiga | Ativo: a intenção aparece antes da ação, incluindo ataques perigosos de chefes. |
| 7 | Ordem de turnos visível | Ativo: a fila ATB mostra a ordem prevista de aliados e inimigos. |
| 8 | Fases e postura de chefes | Ativo: postura, fase e anúncios de mudança aparecem na arena. |
| 9 | Log de combate legível | Ativo: registro separado da mão de ações, com detalhes durante a luta. |
| 10 | Mensagens sem cobrir o mapa | Ativo: HUD superior, trilho lateral e rótulos de NPC com prevenção de colisão. |

## Roteiro rápido de teste

1. Abra `index.html` pelo servidor local ou use `Jogar Herdeiros de Aethra.bat`.
2. Clique em **Nova Aventura**, conclua o prólogo e confirme a mensagem da vila.
3. Converse com um NPC usando **E** e aceite uma missão.
4. Entre em uma batalha, passe o mouse ou toque nos cards e confira a previsão.
5. Ative o automático e observe a intenção dos inimigos.
6. Se o time perder, confirme que aparece a mensagem de resgate e que o local muda para o assentamento mais próximo.
