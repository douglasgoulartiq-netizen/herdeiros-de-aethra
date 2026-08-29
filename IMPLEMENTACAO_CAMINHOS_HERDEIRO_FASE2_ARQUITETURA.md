# Caminhos do Herdeiro — Fase 2: arquitetura genérica de pontos, talentos, herança e presets

Continuação direta da Fase 1 (motor de estados/reações elementais, já entregue). Esta fase entrega a "espinha dorsal" de pontos/build sobre a qual as árvores de verdade do Guerreiro e do Mago (próximas fases) vão ser escritas. **Ainda não há nenhum talento real pra escolher em jogo** — os arquivos `talentsGuerreiro.json`/`talentsMago.json` estão vazios de propósito — mas toda a engrenagem por trás já existe, está testada e já está ligada a eventos reais do jogo.

## O que existe agora

- **Duas moedas de ponto de talento** (`pontosClasse`, ganho a cada nível; `pontosSubclasse`, ganho ao escolher subclasse no nível 10 e em marcos seguintes) mais uma terceira, **`pontosHeranca`**, que nunca vem de nível — só de eventos narrativos reais do mundo.
- **Herança usa o elenco real do jogo**, como você pediu: os primeiros nós de `heritageTree.json` estão ligados a chefes de verdade (ex.: derrotar o Dragão Jovem concede "Fôlego do Dragão Jovem", +3 INT permanente), reputação de facção de verdade (ex.: 60+ de reputação com os Guardiões da Folha Verde) e ao Despertar de Arma Secreta de um convocado do gacha — cada nó só fica disponível depois que aquele evento específico realmente aconteceu na sua partida.
- **Regra de peso**: talentos de classe/subclasse podem ser re-especializados (`resetarTalentos` devolve os pontos gastos); escolhas de Herança são **permanentes** — nunca são desfeitas, nem por respec.
- **3 presets de build por personagem**, renomeáveis, cada um guardando sua própria seleção de talentos de classe/subclasse (a Herança é compartilhada entre os três, por ser permanente).
- Já está ligado a eventos reais e testado em jogo de verdade (não só em teste isolado): subir de nível concede ponto de classe, derrotar um chefe pela primeira vez concede ponto de herança, despertar a Arma Secreta de um convocado também concede ponto de herança.

## Testado

- 55 checks novos de lógica pura (`scripts/test_caminhos_herdeiro_arquitetura.mjs`): pontos por nível, pré-requisito, grupo exclusivo (build = escolher), respec preservando herança, presets independentes, subclasse permanente, e o fluxo completo de herança usando o `heritageTree.json` real (gatilho fechado → evento acontece → gatilho abre → escolha → respec não desfaz).
- Smoke test de navegador: personagem criado, batalha real disparada contra o Dragão Jovem (chefe de verdade) e vencida — confirmado que o ponto de Herança realmente apareceu no personagem, com o registro certo de qual chefe o concedeu. Zero erros de console.
- Suíte de regressão completa (42 arquivos) rodada duas vezes: nenhuma quebra.

## O que vem a seguir

As árvores de verdade do Guerreiro e do Mago (as primeiras a de fato ter talentos pra escolher usando este motor), depois a UI visual da árvore, a IA de auto-batalha configurável, e o versionamento de save.
