# Auditoria do projeto e plano de integração aditiva

Documento da Etapa 1 (Auditoria). **Atualizado após a Etapa 3 (Combate: elementos + IA legível de inimigos)**, primeira fatia implementada conforme sua escolha nas perguntas de priorização. O relatório de entrega está na seção 10, no final.

## 0. Decisões confirmadas por você

- "Armas Secretas com despertar narrativo" (sistema 8 do pedido original) se aplica aos **personagens do gacha atual** (não um sistema de armas equipáveis separado) — ainda não implementado, fica para uma próxima etapa.
- Prioridade de implementação: **Elementos + IA de inimigos** primeiro — é o que este documento reporta agora.

## 1. Stack e arquitetura atual

- **Stack**: JavaScript puro (ES Modules), sem framework (nem React/Vue, nem engine tipo Phaser). Renderização do mundo em `<canvas>` 2D puro. Telas de menu/inventário/diálogo são DOM/HTML sobre um `#modal-overlay`. Sem bundler — os módulos são carregados diretamente pelo navegador (`<script type="module" src="src/main.js">`).
- **Dados do jogo**: arquivos `.json` em `src/data/` (raças, classes, monstros, itens, missões, roster de gacha, árvore de habilidades, etc.), carregados em runtime por `src/data/loader.js` via `fetch`.
- **"Banco de dados"**: não há backend próprio. Existe uma tabela `saves` no Supabase (Postgres), acessada via REST direto (`src/systems/CloudSave.js`, sem SDK) — um único registro por usuário com uma coluna `dados` (JSONB) contendo o save inteiro serializado. Não é um schema relacional; é essencialmente um documento JSON versionado por usuário. Isso é uma boa notícia para "migração aditiva": novos campos no objeto salvo não exigem migração de schema, só compatibilidade defensiva no código (padrão já usado: `if (!personagem.gacha) personagem.gacha = estadoGachaInicial();`).
- **Save local**: `localStorage`, chave fixa (`src/systems/SaveSystem.js`).
- **Testes**: não há suíte de testes automatizados formal no repositório; a verificação até agora foi feita via scripts Playwright ad-hoc (headless Chromium) rodados manualmente durante o desenvolvimento, não versionados no projeto.

## 2. Onde cada sistema pedido pelo usuário já existe hoje

| Sistema (pedido) | Estado atual | Arquivo(s) principal(is) |
|---|---|---|
| Combate | ATB (Active Time Battle) com time de até 3 personagens, d20 nos ataques, cooldowns, status effects | `src/systems/CombatSystem.js`, `src/ui/BattleUI.js` |
| Personagens | Criação (raça/classe/antecedente/traço), atributos FOR/DES/CON/INT, níveis, agora com árvore de habilidades | `src/systems/CharacterFactory.js` |
| Inimigos | 29 monstros em dados, com `nivel`, `bioma`, atributos de combate. IA **muito simples**: ataca um alvo aleatório do time vivo, sempre ataque básico — sem arquétipos, sem intenção, sem memória | `src/data/monsters.json`, `CombatSystem.js` (`iaInimigoAgir`) |
| Atributos | FOR/DES/CON/INT, com efetivos calculados (equipamento + árvore de habilidades) | `CharacterFactory.js` |
| Níveis | XP, curva de nível, monstros com faixa de nível sugerida por zona | `CharacterFactory.js`, `src/data/worldMap.js` (22 zonas, cada uma com `nivelSugerido`) |
| Elementos | **Não existe.** Nenhum monstro, arma ou habilidade tem campo de elemento hoje | — |
| Inventário | Itens, equipamento, consumíveis, venda | `src/systems/InventorySystem.js`, `src/data/items.json` |
| Armas | Itens do tipo `"arma"` no inventário comum (sem sistema próprio de "Arma Secreta"/despertar) | `items.json` |
| Masmorras | 2 masmorras proceduralmente geradas, **lineares** (um só caminho até o chefe, sem bifurcação real) | `worldMap.js` (`buildDungeon`, `buildDungeon2`), registro `MASMORRAS` em `main.js` |
| Missões | Aceitar/entregar com NPCs, tipos `matar`/`coletar`/`explorar`, recompensa em ouro/XP/Fragmentos | `src/systems/QuestSystem.js`, `src/data/quests.json` |
| Escolhas | Só cosméticas na criação de personagem (traço/antecedente) + a árvore de habilidades nova (uma escolha binária a cada tier de nível). **Não existe** sistema de decisão narrativa com consequência persistente no mundo | `CharacterFactory.js` (árvore) |
| Dados (d20) | Usado **só dentro do combate** (`d20()` em `CombatSystem.js`, para acerto/erro/crítico). Não há testes de perícia fora de combate | `CombatSystem.js` |
| Gacha | Invocação de **personagens** (não armas) — banners normal/evento/iniciante, roster de 24 personagens | `src/systems/GachaSystem.js`, `src/data/gachaRoster.json` |
| Pity | Hard pity (50), soft pity (curva 40–50), garantia de raridade a cada N pulls, 50/50 com garantia persistente no banner de evento | `GachaSystem.js` |
| Moedas | Ouro (`personagem.ouro`) e Fragmentos de Aethra (`personagem.gacha.fragmentos`, moeda do gacha) | `src/data/economyConfig.js` |
| Save | `localStorage` + nuvem opcional (Supabase, login Google) | `SaveSystem.js`, `CloudSave.js` |
| Banco de dados | Tabela `saves` no Supabase (ver seção 1) | `CloudSave.js` |
| Interface | Telas DOM (`#modal-overlay`) para inventário/missões/forja/diálogo/gacha/árvore de habilidades + HUD fixo + canvas do mundo/batalha | `src/ui/*.js`, `index.html`, `src/style.css` |

**Ponto de atenção terminológico importante**: o pedido do usuário fala em "Armas Secretas" como o nome do sistema de gacha (comum em jogos gacha chamarem os personagens invocáveis de "armas", ex: Genshin/Star Rail-like). Aqui o gacha atual invoca **personagens jogáveis**, não armas de equipar. Antes de implementar a Etapa 7 (Despertar), preciso confirmar com você: o "Despertar" narrativo deve ser aplicado (a) aos **personagens do gacha atual** (tratando "Arma Secreta" como sinônimo de personagem invocável, que é o padrão do gênero), ou (b) a um **novo sistema de armas equipáveis raras** obtidas separadamente? A resposta muda bastante o desenho de dados da Etapa 7.

## 3. Arquivos que serão **apenas consultados** (referência, não tocados)

`src/main.js` (loop principal, HUD, auto-play) só precisa ser consultado nas etapas iniciais para os pontos de integração — será modificado depois, mas nas primeiras etapas (fundação/dados) fica só como referência. Da mesma forma: `src/ui/GachaUI.js`, `src/ui/CharacterCreationUI.js`, `src/render/Renderer.js`, `src/systems/CraftingSystem.js` — consultados para manter o padrão de código, sem necessidade de alteração nas primeiras etapas.

## 4. Arquivos que precisarão ser **modificados** (por sistema, visão geral — detalhado etapa a etapa quando começarmos a codar)

- **Inimigos com IA legível** → `src/data/monsters.json` (campo aditivo `arquetipo`, opcional, default para um arquétipo neutro se ausente — não quebra monstros existentes), `CombatSystem.js` (`iaInimigoAgir` ganha lógica por arquétipo, mantendo o comportamento atual como fallback), `BattleUI.js` (exibir intenção antes do ataque).
- **Encontros por nível/ameaça** → `worldMap.js` (já tem `nivelSugerido` por zona — só precisa de uma função de classificação de ameaça, não uma reescrita), `src/systems/EncounterSystem.js`.
- **Dados em decisões / pré-combate** → novo sistema (ver arquivos novos abaixo), com pontos de gancho em `GameUI.js` (diálogos) e `main.js` (encontro no mundo).
- **Elementos** → `monsters.json`, `items.json` (armas), `classes.json`/`skillTrees.json` (habilidades) ganham campo **opcional** `elemento` (default `"fisico"` se ausente); `CombatSystem.js` ganha a leitura da matriz para multiplicar dano.
- **Masmorras com rotas** → `worldMap.js` (`buildDungeon`/`buildDungeon2` viram geração com bifurcação — aditivo, mantendo compatibilidade dos saves antigos que só guardam posição/baús abertos).
- **Mundo reativo** → `main.js` (novo estado `mundo.estadoDoMundo`), `GameUI.js` (diálogos passam a consultar reputação).
- **Despertar de Armas** → depende da resposta da pergunta da seção 2. Provavelmente `GachaSystem.js` (sem tocar em pity/probabilidade) + `gachaRoster.json` (campo aditivo).
- **Compêndio** → principalmente novo, com pequenos ganchos em `CombatSystem.js` (registrar abate), `QuestSystem.js`, `GachaSystem.js`.

## 5. Arquivos **novos** propostos (nomes seguem o padrão do projeto)

- `src/data/enemyBehaviors.json` — `EnemyBehaviorDefinition` por arquétipo (Agressor, Defensor, Caçador, Atirador, Controlador, Suporte, Conjurador, Ladrão, Invocador, Comandante, Covarde, Fanático).
- `src/systems/EnemyAI.js` — decide ação do inimigo a partir do arquétipo + `EnemyIntent` (o que será mostrado ao jogador antes do golpe).
- `src/systems/ThreatSystem.js` — `ThreatAssessment` (Trivial/Favorável/Equilibrada/Perigosa/Mortal) a partir da diferença de nível.
- `src/data/skillChecks.json` — `SkillCheckDefinition` (perícias, atributo associado, DC base).
- `src/systems/SkillCheckSystem.js` — rolagem `d20 + mod + proficiência + situacional` fora de combate, com preview antes/resultado depois.
- `src/data/elements.json` — `ElementDefinition` + `ElementInteractionMatrix` (a matriz de força/fraqueza, configurável em dados, não hardcoded).
- `src/data/dungeonRoutes.json` + extensão de `worldMap.js` — `DungeonRoute`.
- `src/systems/WorldStateSystem.js` + `src/data/worldStateVariables.json` — `WorldStateVariable`, `WorldChoiceConsequence`.
- `src/data/weaponAwakenings.json` + `src/systems/AwakeningSystem.js` — `SecretWeaponAwakening` (pendente a decisão da seção 2).
- `src/data/compendium.json` + `src/systems/CompendiumSystem.js` — `CompendiumEntry`, `CompendiumProgress`, `CompendiumReward`.
- `src/ui/ThreatUI.js`, `src/ui/SkillCheckUI.js`, `src/ui/DungeonMapUI.js`, `src/ui/CompendiumUI.js`, `src/ui/AwakeningUI.js` — telas novas, reaproveitando o padrão visual de `GameUI.js`/`style.css` (mesmos `.card`, `.modal-*`, cores).
- `src/data/featureFlags.js` — flags simples (`export const FLAGS = { enemyAI: true, elementos: true, ... }`) para poder desligar cada sistema novo individualmente durante testes, sem remover código.

## 6. Como cada sistema novo se conecta ao existente (sem substituir nada)

- A IA de inimigos **substitui só a lógica interna** de `iaInimigoAgir()` — a assinatura e o restante do `CombatSystem.js` (dano, d20, cooldowns, ATB) continuam iguais. Monstros sem `arquetipo` definido caem num arquétipo padrão equivalente ao comportamento atual (ataque aleatório), então nenhum monstro existente muda de comportamento até eu revisar e atribuir arquétipos deliberadamente.
- A matriz elemental entra como **um multiplicador adicional** dentro de `rolarAtaque`/`usarHabilidade` (mesmo ponto que já aplica variância e crítico) — dano sem elemento definido continua exatamente igual a hoje (elemento `"fisico"` neutro).
- O sistema de dados fora de combate reaproveita a função `d20()` já existente em `CombatSystem.js` (extraída para um lugar compartilhado se necessário), então a "sensação" das rolagens é consistente com o combate.
- Rotas de masmorra são uma **extensão** da geração procedural atual, não uma reescrita — o registro `MASMORRAS` em `main.js` e o formato de save (`chestsDungeon`, `zonaAtualId` etc.) continuam válidos.
- O Compêndio é essencialmente um sistema de **observador** (regista quando algo já implementado acontece: abate, missão concluída, invocação) — não interfere no fluxo de nenhum sistema existente, só escuta.
- Autoplay (`AutoPlayState.js`, `tickAutoPlay` em `main.js`) precisa ser estendido para lidar com os novos modais (teste de perícia pré-combate, escolha de rota de masmorra, despertar de arma) do mesmo jeito que já faz hoje com diálogo/gacha/árvore de habilidades — decidir automaticamente para não travar o loop.

## 7. Conflitos e riscos identificados

1. **Nomenclatura "Arma Secreta"** (seção 2) — preciso da sua decisão antes de tocar em `GachaSystem.js`/`gachaRoster.json`, porque as duas interpretações têm impacto de dados bem diferente.
2. **IA e o loop de auto-play**: a IA de inimigos hoje roda dentro de um `setInterval` de 140ms (`loopATB` em `BattleUI.js`) sem pausa para "mostrar intenção" — implementar a prévia de intenção do inimigo exige inserir uma pausa/telegraph antes do golpe, o que muda o *timing* do combate (mesmo sem mudar as regras). Vou propor um valor de delay configurável (respeitando "velocidade ajustável de animação" pedida na seção 11) para não tornar o combate arrastado.
3. **Elemento em habilidades da árvore recém-criada**: acabei de adicionar `src/data/skillTrees.json` nesta sessão (6 classes, 4 tiers cada) sem campo de elemento. Adicionar elemento agora é aditivo (campo opcional), sem quebrar as escolhas já salvas em saves existentes.
4. **Masmorras com rotas**: como as 2 masmorras atuais são grids fixos, adicionar bifurcação real é a mudança de maior risco técnico da lista — preciso ter cuidado para não invalidar `chestsDungeon`/posições salvas de jogadores que já estão no meio de uma masmorra num save existente. Vou desenhar isso para migrar graciosamente (se o save tem uma posição que não existe mais na masmorra nova, reposicionar no spawn com aviso, nunca travar).
5. **Escopo**: os 12 sistemas somados são, na prática, uma expansão do tamanho do jogo já feito até agora (ou maior). Não é razoável implementar tudo em uma única leva sem revisão — por isso a etapa 1 parou aqui.

## 8. Não há risco de perda de dados nesta auditoria

Nada foi implementado ainda nesta etapa — só leitura e planejamento. Nenhum arquivo de dados ou save foi alterado.

## 9. Próxima etapa recomendada (histórico — já superado, ver seção 10)

~~Sugiro começar pela Etapa 2 (Fundação)...~~ Você escolheu "Elementos + IA de inimigos" e confirmou "Armas Secretas = personagens do gacha atual". A Etapa 3 (Fundação + Combate, combinadas) já foi implementada e testada — relatório abaixo.

## 10. Relatório de entrega — Etapa 3: Elementos + IA legível de inimigos

### 1. O que foi adicionado

- **Sistema elemental completo**: 12 elementos (Físico, Fogo, Água, Gelo, Natureza, Terra, Raio, Vento, Radiante, Sombrio, Arcano, Veneno) com matriz de força/fraqueza configurável em dados (não hardcoded). Vantagem = dano ×1,25; resistência = ×0,75; Físico nunca tem vantagem/resistência (sempre neutro, ×1,00) — igual ao comportamento de antes deste sistema existir. Simplificação assumida: implementei um único nível de vantagem/resistência (não os níveis extras "intensa"/imune do seu pedido original) para manter o primeiro corte simples — dá para adicionar depois se fizer falta.
  - 17 armas, 23 dos 29 monstros e 11 habilidades de classe/árvore ganharam elemento (o resto ficou "físico", que é neutro por padrão — uma escolha de conteúdo, não uma lacuna técnica).
  - Reação elemental aparece no log de batalha ("🔥 Vantagem elemental! Dano ampliado." / "🛡️ Resistência elemental. Dano reduzido.") e como selo no card do combatente em batalha (ícone do elemento + ✅/🛡️ quando há vantagem/resistência em relação ao atacante ativo).
- **IA de inimigos com arquétipos legíveis**: implementei 6 dos 12 arquétipos pedidos — **Agressor** (ataca o mais vulnerável), **Caçador** (ataca o de menor defesa), **Atirador** (ataca a maior ameaça), **Fanático** (nunca recua, ataca o mais resistente), **Comandante** (mira quem vai agir primeiro), **Covarde** (hesita e não ataca quando um aliado cai ou o próprio HP fica crítico). Todos os 29 monstros já têm um arquétipo atribuído.
  - Os outros 6 arquétipos do pedido (Defensor, Controlador, Suporte, Conjurador, Ladrão, Invocador) dependem de dar habilidades novas aos monstros (curar aliado, invocar, roubar, aplicar condição) — decidi não implementar isso ainda nesta fatia para não misturar "IA lê o estado atual" com "autoria de dezenas de habilidades de monstro" no mesmo lote. Documentado como próximo passo natural.
- **Classificação de ameaça pré-combate**: tela nova antes de cada batalha (encontro aleatório ou chefe de masmorra) mostrando Trivial/Favorável/Equilibrada/Perigosa/Mortal (por cor + ícone + texto, não só cor), quantidade de inimigos, elementos detectados, aviso de chefe, com opção de **Lutar** ou **Evitar o combate**.
- **Feature flags** (`elementos`, `iaInimigos`, `ameacaPreCombate`) para desligar qualquer um dos três sistemas individualmente sem remover código — todos ligados por padrão.
- Modo automático estendido para lidar com a nova tela de ameaça (sempre luta, nunca evita sozinho — senão nunca ganharia XP) e para não travar.

### 2. Arquivos modificados

- `src/systems/CombatSystem.js` — `criarCombatenteJogador`/`criarCombatenteInimigo` ganharam campo `elemento`; `criarCombatenteInimigo` ganhou campo `arquetipo`; `Batalha` aceita um 3º parâmetro opcional (`dadosElementos`); `rolarAtaque` e o caso `dano_magico` de `usarHabilidade` aplicam o multiplicador elemental; `iaInimigoAgir` usa o arquétipo (com fallback para aleatório, idêntico ao comportamento antigo, se a flag estiver desligada ou o monstro não tiver arquétipo).
- `src/systems/CharacterFactory.js` — nenhuma mudança nesta etapa (fica só como consulta).
- `src/data/loader.js` — passou a carregar `elements.json` e `enemyBehaviors.json`.
- `src/data/monsters.json` — campo aditivo `elemento` em 23/29 monstros e `arquetipo` em 29/29.
- `src/data/items.json` — campo aditivo `elemento` em 17/31 armas.
- `src/data/classes.json` e `src/data/skillTrees.json` — campo aditivo `elemento` em 11 habilidades de dano.
- `src/ui/BattleUI.js` — passa `dados.elements` para `new Batalha(...)`; cards de combatente mostram o selo de elemento (com prévia de vantagem/resistência contra o atacante ativo).
- `src/main.js` — nova função `iniciarEncontroComAmeaca` (substitui as chamadas diretas a `dispararBatalha` nos dois pontos onde um combate começa: encontro aleatório e chefe de masmorra); modo automático passa a clicar "Lutar" na tela de ameaça.

### 3. Arquivos criados

- `src/data/featureFlags.js`
- `src/data/elements.json`
- `src/systems/ElementSystem.js`
- `src/data/enemyBehaviors.json`
- `src/systems/EnemyAI.js`
- `src/systems/ThreatSystem.js`
- `src/ui/ThreatUI.js`

### 4. Como testar

- Qualquer batalha já mostra a tela de ameaça antes de começar (encontro aleatório andando pelo mundo, ou chegando no chefe de uma masmorra) — dá pra ver a classificação, os elementos dos inimigos e escolher Lutar/Evitar.
- Durante a batalha, o card de cada combatente mostra o ícone do elemento (quando não é físico) — atacando um inimigo fraco contra o seu elemento aparece "🔥 Vantagem elemental!" no log; atacando um forte aparece "🛡️ Resistência elemental.".
- Equipar uma arma temática (ex: Espada Flamejante = fogo) e lutar contra um inimigo de natureza (ex: Druida Corrompido) mostra a vantagem funcionando; testado e confirmado via automação.
- Lutar contra um Goblin (arquétipo Covarde) em grupo: depois que um aliado morre, os outros passam a "hesitar e recuar" em vez de atacar — testado e confirmado.
- O modo automático (P) continua funcionando exatamente como antes, incluindo a nova tela de ameaça (luta sempre, sem travar).

### 5. O que permaneceu intacto

- Probabilidades e pity do gacha — não toquei em `GachaSystem.js` nem `economyConfig.js`.
- Saves antigos continuam carregando: os campos novos (`elemento`, `arquetipo` nos dados; nada de novo no objeto `personagem` salvo) são todos aditivos e têm fallback (`|| "fisico"`, `|| "aleatorio"`) — um save de antes desta etapa carrega normalmente e o combate se comporta de forma neutra até você jogar mais e pegar itens/inimigos com elemento definido.
- Fórmulas de dano físico/mágico, ATB, cooldowns, status effects, fuga, itens em batalha — todos exatamente como antes; o multiplicador elemental é só mais um fator multiplicativo no cálculo, igual ao crítico ou à variância aleatória que já existiam.
- Auto-play, árvore de habilidades, mundo de 22 áreas, NPCs, gráficos (dano flutuante/tremor/movimento suave) — todos teoados de novo depois dessas mudanças e continuam funcionando.

### 6. Riscos ou pendências

- Não implementei a "prévia de intenção" (mostrar o alvo/tipo de ataque do inimigo *antes* dele agir, com tempo pra reagir) — o `iaInimigoAgir` decide e executa no mesmo tick, como antes. Fazer isso direito exige inserir uma pausa controlada no loop de ATB (`BattleUI.js`), que é uma mudança de *timing* de combate maior — preferi entregar a decisão de alvo legível primeiro e avaliar com você se vale a pena adicionar o telegraph visual depois.
- Os 6 arquétipos que dependem de habilidades de monstro (Defensor, Controlador, Suporte, Conjurador, Ladrão, Invocador) ficaram de fora — ver seção 1.
- Vantagem/resistência "intensa" e imunidade (do seu pedido original) não foram implementadas — só um nível de vantagem/resistência por ora.
- Ainda não iniciei: dados fora de combate, masmorras com rotas, mundo reativo, despertar de armas, compêndio (sistemas 3, 6, 7, 8, 9 do pedido original) — aguardando sua confirmação de prioridade.

### 7. Próxima etapa recomendada

Como você mencionou "dados fora de combate" como segunda opção nas alternativas que te dei, e ele reaproveita o `d20()` que já existe (baixo risco, alto valor narrativo), sugiro esse como próximo — ou, se preferir, posso completar a IA de inimigos com os 6 arquétipos restantes (que exigem dar habilidades aos monstros) antes de seguir para um sistema novo. Aguardando sua direção.
