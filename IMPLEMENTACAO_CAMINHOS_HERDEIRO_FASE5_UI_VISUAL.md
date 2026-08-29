# Caminhos do Herdeiro — Fase 5: UI visual da árvore

Primeira tela jogável de verdade pra tudo que as Fases 1–4 construíram. Até aqui, Guerreiro e Mago tinham árvores completas e testadas, mas **nenhum jogador conseguia realmente clicar em nada** — a única forma de escolher um talento era chamando funções direto no console. Agora existe um botão novo no HUD, **"🌌 Caminhos do Herdeiro (H)"**, que só aparece pra Guerreiro e Mago (as duas classes com árvore de verdade — qualquer outra classe continua só com o botão "Habilidades" antigo, sem nenhuma mudança de comportamento pra ela).

## O que a tela faz

- **Grafo real**, não uma lista: cada talento é um nó desenhado em SVG, posicionado automaticamente a partir dos próprios dados (nível mínimo, pré-requisito, grupo exclusivo, subclasse) — não existe nenhuma coordenada fixa por talento no código, então uma futura 3ª/4ª/5ª classe já renderiza sozinha sem precisar mexer neste arquivo.
- **Pan e zoom**: arrasta pra mover o grafo, roda do mouse ou os botões ➕/➖ pra ampliar/reduzir, 🎯 recentraliza. (Pinch-to-zoom com dois dedos não foi implementado — só arrasto de um dedo/mouse mais os botões de zoom, que funcionam em qualquer dispositivo.)
- **Forma e cor por tipo**, além da cor: círculo azul = passivo (bônus de atributo), hexágono laranja = ativo (concede uma habilidade jogável), estrela dourada = ultimate (o golpe mais forte no fim de cada ramo), losango roxo = herança (evento real do mundo). Um anel tracejado vermelho marca quando um nó faz parte de uma escolha exclusiva (pegar um bloqueia o outro pra sempre nesse build).
- **Estado visual**: bloqueado (cinza, apagado), desbloqueável agora (brilho dourado), já escolhido (borda clara + ✅). Clicar em qualquer nó abre um painel lateral com nome, ícone, nível mínimo, custo/moeda, descrição, efeito por extenso, pré-requisito (pelo nome, não pelo id), sinergia real (por exemplo: Golpe Rompedor mostra que deixa o alvo pronto pra reação Ruptura, lendo isso de verdade de `elementalReactions.json`, não como texto solto) e o motivo exato de estar bloqueado quando for o caso.
- **Herança do Mundo** aparece como uma fileira própria embaixo do grafo principal (não é level-gated como o resto, cada nó só depende de um evento real já ter acontecido na partida) — o painel mostra se o gatilho (chefe derrotado / reputação de facção / Arma Secreta despertada) já foi cumprido ou não, com o nome de verdade do chefe/facção.
- **Escolha de subclasse**: a partir do nível 10, um bloco aparece com um botão por subclasse disponível; escolher é permanente (mesma regra da Fase 2/3/4 — a tela não inventa nenhuma regra nova).
- **Presets e respec**, expostos pela primeira vez numa tela (a arquitetura da Fase 2 já suportava os 3 builds nomeáveis e o reset, mas não existia nenhum jeito de usar isso): abas pra trocar/renomear build, e um botão "Resetar talentos deste build" que devolve só os pontos de classe/subclasse do preset ativo — herança nunca é devolvida, como sempre foi a regra.

## O que NÃO foi inventado

- Nenhuma regra de jogo nova: a tela só chama as funções que já existiam em `TalentSystem.js` (`escolherTalento`, `escolherSubclasse`, `resetarTalentos`, `renomearPreset`, `alternarPreset`) — zero lógica de progressão duplicada na UI.
- "Maximizado" (pedido no escopo original) não virou um selo por nó individual: talentos aqui são de escolha única (não têm "rank"), então um selo de progresso por nó não faria sentido de verdade — a completude aparece de forma honesta pelo estado visual de cada nó (todos escolhidos = build completo), sem fingir uma mecânica de rank que não existe.
- "Transformação" como tipo de efeito é reconhecida pelo classificador (`classificarTipoNode`), mas nenhum talento de Guerreiro/Mago usa esse tipo ainda — fica pronta pro conteúdo futuro, sem fingir que já existe.

## Bug real encontrado e corrigido durante o teste (não só no papel)

O primeiro teste de clique de verdade no navegador falhou: clicar num nó não abria o painel. Investigando, o clique sintético do Chromium estava sendo redirecionado pro próprio `<svg>` (não pro nó) por causa do `setPointerCapture` usado pro arrasto (pan) — capturado logo no `pointerdown`, mesmo quando o usuário só queria clicar, não arrastar. Corrigido: a captura agora só acontece depois de um arrasto de verdade (threshold de alguns pixels de movimento), então um clique simples funciona normalmente e o arrasto continua suave. Sem esse teste de clique real (não só chamar a função direto), esse bug teria ido pro jogador.

## Testado

- 29 checks novos de lógica pura (`scripts/test_talent_tree_ui_layout.mjs`): classificação de tipo de nó (inclusive o caso de "ultimate" só valer dentro do escopo certo — classe vs. subclasse), cálculo de layout sem nenhuma coordenada duplicada (incluindo o bug real de dois talentos de nível 1 caindo em cima um do outro, corrigido antes de qualquer criança tocar o navegador), texto de efeito/sinergia lido dos dados de verdade. Rodado 5 vezes seguidas sem instabilidade.
- Smoke test de navegador com CLIQUE DE VERDADE (não só chamada de função): criar personagem do zero pela tela normal → abrir Caminhos do Herdeiro → clicar num nó → ver o painel abrir com o nó certo → clicar em "Desbloquear" → ver o ponto de classe ser gasto de verdade e o nó virar "escolhido" no re-render → trocar pra árvore do Mago e confirmar que troca certo → escolher uma subclasse pelo botão real da tela.
- Suíte de regressão completa (46 arquivos, incluindo este novo) rodada duas vezes: zero falhas.
- Nenhum hook de debug temporário ficou no código (`grep __DEBUG` limpo, `node --check` OK em todos os arquivos tocados).

## O que vem a seguir

IA de auto-batalha configurável (task #96), versionamento/migração de save (task #97), e a suíte final de testes + relatório de 26 itens (task #98). A "PROMPT MESTRE DE EVOLUÇÃO" continua deliberadamente adiada pra depois disso.
