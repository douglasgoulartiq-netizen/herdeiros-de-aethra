# Equipar convocados, curar o time e descansar — o que foi implementado

Pedido do usuário: "preciso conseguir equipar itens nos personagens que coloco no meu time do gacha, além de conseguir utilizar curas e ter uma opção de dormir para recuperar todos os status".

## Diagnóstico (antes de mexer em código)

O jogo já tinha o motor completo de equipamento, poções e conjuntos de itens (`InventorySystem.js`, `SetBonusSystem.js`) e os convocados do gacha já nasciam com um `equipamento` no mesmo formato do personagem principal (`GachaSystem.js`) — ou seja, o combate já sabia ler o equipamento deles. O que faltava era só a ponte: não existia nenhuma tela pra equipar um convocado, e o botão "Usar Item" (cura) só aparecia no turno do personagem principal e só curava ele mesmo. Também não existia nenhuma forma de descanso — dano em qualquer personagem do time ficava até a próxima poção ou nível.

## O que foi implementado (testado: 21 checks de lógica pura + 13 checks de smoke test de navegador, zero erros de console)

**Equipar/curar convocados do gacha** — na aba "Time" (tecla G), cada convocado agora tem um botão "🎒 Equipar/Curar" que abre a mesma tela de Inventário do personagem principal, só que mirada nele: os 7 slots de equipamento mostrados são os dele, e "Equipar"/"Usar" (poção) afetam ele — mas o item continua saindo da mochila compartilhada do time (a do personagem principal, que é quem recebe loot/compra na loja). Um botão "← Voltar ao Time" retorna pra aba de onde veio.

**Usar cura em qualquer aliado, dentro e fora de batalha** — fora de batalha, isso é a própria tela acima (poção de cura usada no convocado). Dentro de batalha, "Usar Item" deixou de aparecer só no turno do personagem principal: agora aparece no turno de qualquer membro do time, e ao escolher uma poção de cura/mana/antídoto, se houver mais de um aliado vivo, o jogo pergunta em quem usar (mostrando HP/MP de cada um) antes de aplicar.

**Descansar** — novo botão no HUD (💤 Descansar, tecla R), disponível fora de batalha: restaura HP e MP ao máximo do time inteiro (personagem principal + convocados) de uma vez, sem custo. Ainda não há pousada/cidade-abrigo modelada no mundo, então por enquanto funciona em qualquer lugar do mundo aberto — uma versão futura pode amarrar isso a um local específico ou dar um custo, se o playtest mostrar que descansar de graça em qualquer lugar tira tensão demais da exploração de masmorra.

## O que não foi feito, e por quê

- **Custo ou restrição de local para "Descansar"**: deixado de fora nesta rodada pra não inventar uma trava sem validar com playtest se ela é realmente necessária — é fácil adicionar depois (guardrail do projeto: não adicionar mecânica nova sem validar o núcleo primeiro).
- **Deixar convocados carregarem itens fora do estoque compartilhado**: decidido manter tudo numa mochila só (a do personagem principal) — já é o comportamento existente (loot/loja sempre iam pra lá) e evita ter que decidir "pra quem vai o item" toda vez que o time ganha loot em batalha.
