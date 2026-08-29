# 20 pontos de melhoria — Herdeiros de Aethra

Lista construída em cima do que já existe no jogo (sistemas em `src/systems/`, telas em `src/ui/`), priorizando decisões por minuto, legibilidade e retenção sem depender de gacha para sustentar a diversão. Cada item traz a experiência pretendida, o que mudar na prática e um critério de aceite simples. Prioridade: Alta = afeta a sessão toda; Média = melhora um sistema específico; Baixa = polimento.

## Combate e modo automático

**1. Aviso visual de respawn do chefe (Alta)**
Agora que o chefe some por 30s após ser derrotado (`RESPAWN_CHEFE_MS`), o jogador — principalmente no automático — fica sem entender por que a interação sumiu. Mostrar um marcador temporário no mapa ("Chefe se recupera... 0:18") no local onde ele estava. Critério de aceite: ao derrotar o chefe, aparece um indicador visível até `chefeDisponivel()` voltar a `true`.

**2. Trava de segurança no modo automático (Alta)**
O automático hoje reengaja qualquer alvo disponível sem checar risco. Adicionar um limite configurável ("parar automático se HP do time cair abaixo de X%") evita que o jogador saia da tela e volte com o grupo derrotado. Critério de aceite: automático desliga sozinho e mostra motivo ("Automático interrompido: HP baixo") quando o limite é cruzado.

**3. Telegraph de ataques especiais de chefe (Alta)**
`CombatSystem` já tem postura/stun de chefe; falta comunicar a intenção antes do golpe (ex: ícone "carregando" 1 turno antes de um ataque em área). Sem isso o jogador só aprende por erro. Critério de aceite: todo ataque de chefe com dano acima da média mostra um ícone de intenção no turno anterior.

**4. Pré-visualização de combo elemental (Média)**
O sistema de elementos já calcula combos; mostrar antes de confirmar a ação ("Fogo + Vento = queimadura em área") em vez de só depois do resultado, para decisão informada em vez de tentativa e erro.

**5. Velocidade de batalha ajustável (Média)**
`AccessibilitySystem` existe, mas para sessões de farm/automático um multiplicador de velocidade de animação (1x/2x/instantâneo) reduz tempo morto sem tirar decisões — pedido explícito das diretrizes de antigrind.

## Modo automático (extensão do pedido do bug)

**6. Log de resumo pós-automático (Média)**
Ao desligar o automático, mostrar um resumo ("6 vitórias, 2 fugas, 340 XP, 210 ouro") em vez de só o log corrido. Ajuda o jogador a decidir se vale continuar.

**7. Prioridade de alvo configurável no automático (Baixa)**
Hoje o automático parece pegar o primeiro objeto interagível por proximidade. Deixar escolher prioridade (chefe > baú > coleta > NPC) evita loops improdutivos perto de várias opções.

## Gacha, coleção e progressão (mantendo gacha como aquisição, não como jogo central)

**8. Pity e taxas sempre visíveis antes do pull (Alta)**
A UX de gacha recomendada exige mostrar custo, saldo, pity atual e garantia antes de confirmar. Verificar se `GachaUI` já expõe isso com destaque (não só em texto pequeno) — se não, é a correção de maior impacto em confiança do jogador.

**9. Utilidade para duplicata além de fragmento (Média)**
Hoje toda cópia repetida vira Fragmentos. Dar às primeiras 1–3 duplicatas um pequeno bônus passivo ou variação cosmética do personagem (sem virar power creep obrigatório) segue a diretriz "duplicatas liberam variação, não apenas conversão".

**10. Vínculo entre coleção e Compêndio (Média)**
`CompendiumSystem`/`CompendiumUI` já existem com lore por monstro; ligar isso à coleção de personagens invocados (ex: personagens invocados ganham uma linha de "opinião" sobre inimigos de sua região/facção) aprofunda o mundo sem exigir conteúdo novo, só cruzar dados existentes.

**11. Explicar sinergia de formação/facção na tela de time (Média)**
`FormationSynergySystem` e `FactionSynergySystem` calculam bônus, mas o jogador precisa entender de onde vêm. Mostrar "+10% dano (sinergia: 2 personagens da Floresta)" diretamente na tela de time, não só o número final.

## Missões, mundo e narrativa

**12. Terceira via de resolução em pelo menos 1 missão (Alta)**
As 5 missões atuais são só matar/coletar/explorar. Adicionar uma abordagem social (teste de perícia via `SkillCheckSystem`, que já existe, mas parece subutilizado fora de eventos de exploração) para resolver uma missão sem combate cria a variedade que falta.

**13. Consequência visível de rivalidade (Média)**
`RivalrySystem` existe; garantir que rivalidade não seja só um número interno — ex: diálogo específico, ou um ataque combinado desbloqueado ao "resolver" a rivalidade, como as referências recomendam ("recompensa não é só dano").

**14. Reputação de facção refletida no mundo (Média)**
Se `WorldStateSystem`/`FactionSynergySystem` já rastreiam facção, mostrar isso fora do menu: preço do mercador variando, ou uma fala de NPC diferente, torna a consequência tangível em vez de abstrata.

**15. Clima afetando exploração, não só estética (Baixa)**
`WeatherSystem` existe; se hoje é só visual, ligar a um evento de exploração (ex: chuva reduz alcance de visão / aumenta chance de evento de abrigo) dá função jogável ao sistema já implementado.

## UX, acessibilidade e mobile

**16. Comparação lado a lado no inventário (Alta)**
Ao passar/tocar num item candidato, mostrar o equipado atual ao lado, destacando só as diferenças (dano, defesa, bônus de set) — reduz troca de tela mental, crítico no celular onde não dá pra ter duas janelas abertas.

**17. Indicador de "salvo por último às HH:MM" (Baixa)**
Com autosave a cada 45s (login) e save manual, um indicador discreto de status evita a ansiedade de "será que salvou?", especialmente sem login Google.

**18. Alvos de toque maiores e feedback tátil no D-pad mobile (Média)**
Os controles touch já existem; no celular real, aumentar a área de toque dos botões de ação e (se suportado pelo navegador) usar `navigator.vibrate` num acerto crítico ou dano recebido melhora a sensação sem novo sistema.

**19. Onboarding contextual na primeira masmorra (Média)**
A tela de boot já explica controles em texto corrido; melhor seria ensinar "dentro da situação real" (ex: primeira vez que um baú aparece, uma dica única "aperte E para abrir"), como recomendam as diretrizes de onboarding — texto de boot vira reforço, não a única fonte.

**20. Dificuldade ajustável sem reiniciar campanha (Média)**
Hoje a dificuldade parece fixa pelo nível dos monstros. Expor um multiplicador de vida/dano de inimigos nas opções de acessibilidade (não escondido, alterável a qualquer momento) atende jogadores com tolerância a erro diferente sem forçar New Game+.

---

### Como priorizar

Se for escolher só 3 para a próxima leva: **1 e 2** (fecham de vez a experiência do modo automático que motivou o bug reportado), e **8** (confiança na economia de gacha, base de tudo que vem depois). Os itens 12–15 são os que mais aprofundam "mundo reativo" sem exigir arte nova — só cruzar sistemas que já existem no código.
