# Direção aprovada e integração

Mistura de pixel art legível com atmosfera discreta. As 15 moradias e a
pousada/templo são selecionadas por `src/data/cityArt.js`, com a mesma câmera
e densidade de pixels. Geradas pela ferramenta integrada image_gen, não pela
API/CLI. Prompts completos de arquitetura: `prompts.json` nesta pasta.

## Planta urbana

- Terreno regional nos quintais; praça e ruas pavimentadas, não a cidade inteira.
- Uma fileira por quarteirão; reserva do volume visual, além da colisão.
- Duas faixas de rua em frente às fileiras, becos laterais e soleiras.
- Eixos principais, praça, hospedagem, templo, mercados e jardins.
- Capitais e cidades recebem fonte/mercado; vilas recebem poço quando cabe.
- Corpos d'água, pontes, viagens de barco e repouso continuam sendo funcionais.
- A planta mudou. Saves carregados dentro de paredes usam a salvaguarda
  existente de reposicionamento; não são apagados.

## Complementos de praça

Arquivos de produção: `../fonte_urbana.png`, `../banca_urbana.png`,
`../poco_urbano.png` (PNG RGBA, exportados em 512 px / 128 pixels lógicos).
Originais gerados preservados fora do projeto.

Prompt comum (image_gen, transparência verdadeira; referência: cena aprovada):

> Production pixel art RPG prop sprite. Match reference hand-pixelled colors
> and orthogonal elevated front camera. Isolated on genuine transparent
> background. Square canvas, whole subject visible, no ground tile, no people,
> no text, no 3D render, restrained texture, readable at 64x64 pixels. Subject:

Complementos de assunto usados:

- Fonte: one round low gray-stone town fountain, small tree emblem in the
  center, clear blue water, compact circular basin, no tall statue
- Mercado: one modest wooden market stall, sage green and cream striped
  canvas awning, crates of apples and bread, no people
- Poço: one small circular stone water well, wooden supports, simple
  terracotta pitched canopy and bucket

## Verificação

`node tests/city-art.test.mjs`: cobertura de todos os assentamentos em três
sementes, imagens RGBA, limite de tamanho, silhuetas sem sobreposição,
ruas/descanso livres, seleção da nova arte e fallback.

Prévia de desenvolvimento: `tests/city-art-preview.html`, com o gerador,
terreno e renderizador reais. Não acessa nem grava o save do usuário.
A revisão visual da primeira integração revelou a necessidade da nova
planta. A tentativa de revisar a planta final no navegador foi bloqueada
pela ferramenta; a validação final em tela permanece pendente.

Suítes de mundo (22), props (17), geografia (65) e estradas (7) passaram.
Urbanismo e cobertura de arte passaram em três sementes. A suíte ampliada
de NPCs tem 3142 verificações aprovadas e três falhas pré-existentes:
dominância de espécies dia/noite e dois critérios de deslocamento da rotina.
O diagnóstico `tests/check-city-baseline.mjs` reproduziu as mesmas três
falhas usando o gerador do HEAD, sem alterar a cópia de trabalho.
