# A esteira de arte dos 26 chefes

A mesma esteira que produziu as 17 casas de cidade, apontada para criatura em
vez de prédio. Três peças:

| arquivo | o que faz |
| --- | --- |
| `prompts-chefes.json` | o prompt de estilo e os 26 assuntos, um por chefe |
| `../../tools/import-boss-art.ps1` | recorta, encaixa e grava as duas peças |
| `../../scripts/test-arte-chefes.mjs` | confere o contrato e diz quem falta |

## O que falta, e por quê importa

23 dos 49 chefes têm peça em `arte_v2`. Os outros 26 caem no sprite antigo pela
cadeia de fallback do `assetRegistry.js` — não quebra nada, e é justamente por
isso que passa despercebido: a batalha só fica estranha quando um chefe novo e
um antigo aparecem perto um do outro.

`node scripts/test-arte-chefes.mjs` imprime a lista do que falta **ordenada por
nível**, do mais visto ao menos visto. O Touro da Colheita (nível 4) é o chefe
que todo jogador encontra; O Que Olha de Volta (nível 20) é o que quase ninguém
vê. Se for para gerar dez e parar, que sejam os dez de cima.

## Como gerar uma peça

1. **A primeira imagem da sessão** usa `firstPrompt`, com
   `mob_dragao_anciao_das_cinzas.png` (chefe monstruoso) ou
   `mob_arauto_das_cinzas.png` (chefe humanoide) anexada **como imagem 1**. É
   ela que fixa a densidade de pixel e o contorno para as seguintes.
2. **As demais** usam `basePrompt` + o texto do chefe em `variantes`.
3. A imagem sai em `C:\Users\User\.codex\generated_images\...`. Não apague o
   original: o importador lê e não move nada.
4. Importe:

   ```powershell
   pwsh tools/import-boss-art.ps1 -Source C:\...\exec-xxxx.png -Name mob_veia_negra
   ```

   Ele grava `mob_veia_negra.png` (256) e `mob_veia_negra_icon.png` (64).

5. `node scripts/test-arte-chefes.mjs` para conferir tamanho, par de ícone e
   nova cobertura.

## O contrato, e de onde saíram os números

De `src/data/assetRegistry.js`, que por sua vez saiu da medição real dos slots
de batalha (`scripts/medir-layout-batalha.mjs`):

- **combate** — 256×256 para chefe (o chefe ocupa mais de um slot de largura),
  192×192 para criatura comum.
- **retrato** — 64×64, sufixo `_icon`. Usado na ordem de turno e na coleção.
- **alfa de verdade**. Fundo opaco é rejeitado pelo importador, não aceito com
  um aviso: uma peça com fundo vira um retângulo colado no cenário.

Duas diferenças em relação ao importador de cidade, e as duas são medidas, não
gosto:

- **Sem ampliação por vizinho mais próximo.** A arte de cidade é 128 pixels
  lógicos ampliados 4×. A `arte_v2` que já está no projeto **não é**: nem
  `mob_arauto_das_cinzas.png` nem `mob_dragao_anciao_das_cinzas.png` têm bloco
  N×N constante — são 256 px de resolução plena. Ampliar aqui deixaria o chefe
  novo com metade do detalhe dos 23 que já existem.
- **Duas peças por chefe.** O ícone é redução da própria peça de combate já
  montada, e não um recorte separado: a cobertura de alfa das duas bate em
  0,001 nas peças existentes, o que confirma que foi assim que as 23 foram
  feitas.

## O que a arte NÃO precisa entregar

As duas fases de chefe do combate (`src/systems/BossPhaseSystem.js`) são feitas
por **filtro CSS sobre a mesma imagem** — brilho, saturação e um halo na fase 2,
mais um respiro animado na fase 3, em `src/revelacoes.css`. Não é preciso uma
variante de arte por fase, e não adianta desenhar o efeito na peça: ele seria
aplicado duas vezes.

Também não entram na peça: chão, moldura, sombra projetada, barra de vida,
texto, brilho solto. Qualquer pixel fora do corpo do bicho vira sujeira
flutuante quando ele aparece no mapa.
