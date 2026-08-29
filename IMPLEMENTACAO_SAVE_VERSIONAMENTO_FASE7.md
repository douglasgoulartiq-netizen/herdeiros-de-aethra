# Save: Versionamento e Migração — Fase 7 (task #97)

Antes desta task, cada sistema novo que precisava de um campo novo em `personagem` (gacha, árvore de habilidades antiga, viagem rápida, NG+, Modo História, e mais recentemente Caminhos do Herdeiro e a config de IA de auto-batalha) espalhava seu próprio `if (!personagem.campo) personagem.campo = valorPadrao` dentro de `aplicarEstadoSalvo()` em `main.js`. Funcionava, mas sem nenhum registro explícito de "que versão do save tem o quê" — e um save vindo da nuvem (`continuarDaNuvem`) nem passava por esses ifs de verdade no mesmo lugar que um save local.

## O que mudou: `SAVE_VERSION` + `migrarSave()` em `SaveSystem.js`

- `SAVE_VERSION` (hoje = 2) é a versão do FORMATO de save — sobe 1 sempre que um campo novo precisa de valor padrão.
- `MIGRACOES` é um array de funções, uma por transição de versão: `MIGRACOES[0]` leva a versão 0 (o formato mais antigo que existe, sem `saveVersion` nenhum) pra 1 — os campos que já eram garantidos na unha antes (gacha, árvore antiga, viagem rápida, NG+, Modo História, e a fusão de "masmorra" única em dungeon1/dungeon2). `MIGRACOES[1]` leva de 1 pra 2 — Caminhos do Herdeiro (`caminhoHerdeiro`: pontos, subclasse, herança, presets) e a config de IA de auto-batalha (`autoBatalhaConfig`), cobrindo tanto o personagem principal quanto CADA convocado do gacha já obtido (qualquer um deles pode ganhar pontos de talento em combate de verdade).
- `migrarSave(salvo)` roda só as migrações a partir de `salvo.saveVersion` (ausente = 0) e sempre termina com `saveVersion === SAVE_VERSION`. É idempotente — cada migração só preenche o que falta, nunca sobrescreve o que já existe — então rodar duas vezes no mesmo save (ou reabrir um save que já foi migrado antes) não muda nada da segunda vez em diante.
- `carregarJogo()` (save local) e `salvarJogo()` (ao gravar) chamam `migrarSave()` agora — e `aplicarEstadoSalvo()` em `main.js` também chama, o que cobre o caminho da NUVEM (`continuarDaNuvem`), que antes não passava pelos mesmos ifs que o save local.

## Bug real encontrado e corrigido pelo próprio teste

A primeira versão de `salvarJogo()` só CARIMBAVA `estado.saveVersion = SAVE_VERSION` sem migrar de verdade. Isso é seguro no fluxo real do jogo (o objeto salvo sempre vem do `personagem`/`mundo` vivos, que já passaram por `migrarSave()` no load) — mas é uma armadilha silenciosa: se algum caminho futuro chamasse `salvarJogo()` com um objeto que ainda não tinha sido migrado, o save gravado ficaria com o número da versão atual SEM os campos que essa versão promete, e nenhum load futuro tentaria migrar de novo (porque o número já bate). O teste de save→load pegou isso na hora. Corrigido: `salvarJogo()` agora chama `migrarSave(estado)` de verdade antes de gravar, não só carimba o número — a versão escrita no save nunca mais pode "mentir" sobre o formato dos dados.

## O que NÃO mudou

- Os `garantir*` de cada sistema (`garantirEstadoCaminho`, `garantirConfigAutoBatalha`, `garantirCompendio`, etc.) continuam existindo exatamente como antes — servem de cinto de segurança pra qualquer personagem criado FORA de um load (um convocado novo do gacha, por exemplo), e o pipeline de migração os REUSA em vez de duplicar a lógica de inicialização.
- Nenhum dado existente é perdido, sobrescrito ou alterado — a migração só adiciona o que falta.
- Uma escolha de talento/subclasse/herança que um convocado do gacha já tivesse (num save que já passasse por uma versão anterior desta própria funcionalidade) é preservada intacta — testado explicitamente.

## Testado

- 30 checks novos de lógica pura (`scripts/test_save_migration.mjs`, com um polyfill mínimo de `localStorage` pra rodar fora do navegador): migrar um save no formato mais antigo que existe preserva 100% dos dados originais (nome, nível, atributos, HP/MP, habilidades, inventário, ouro/XP, posição no mundo, baús/nós) E preenche corretamente todos os campos que faltavam, sem inventar progresso (pontos de talento zerados, nenhuma subclasse assumida, nenhum talento pré-escolhido). Confirma que um convocado do gacha SEM `caminhoHerdeiro` ganha um novo zerado, e um que JÁ TINHA progresso real não é resetado. Confirma idempotência (migrar duas vezes não muda nada na segunda) e entradas inválidas (`null`, save sem personagem) não quebram. Fluxo completo `salvarJogo` → `carregarJogo` com o polyfill de `localStorage`. Rodado 5 vezes seguidas sem instabilidade.
- Smoke test de navegador com localStorage REAL (não o polyfill): escreveu um save no formato antigo direto no `localStorage` do Chromium, recarregou a página, clicou em "Continuar Aventura" de verdade, confirmou que o personagem entra no mundo sem crash e com todos os campos novos presentes e corretos, salvou de novo pelo botão real do HUD, recarregou a página inteira e confirmou que o ciclo completo save→reload→load mantém tudo íntegro. Zero erros de console.
- Suíte de regressão completa (47 arquivos, incluindo este novo) rodada duas vezes: zero falhas (fora os dois flaky pré-existentes e documentados, baseados em `Math.random`, sem relação com esta task).
- Nenhum hook de debug temporário ficou no código.

## O que vem a seguir

A suíte final de testes + relatório de 26 itens (task #98) — última tarefa do plano de Caminhos do Herdeiro. A "PROMPT MESTRE DE EVOLUÇÃO" continua deliberadamente adiada pra depois disso, e só deve começar depois de revalidar o desenho de pontos com você, como combinado.
