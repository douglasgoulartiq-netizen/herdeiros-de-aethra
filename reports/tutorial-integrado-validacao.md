# Tutorial integrado — validação local

Versão de trabalho, não publicada. Servidor local 127.0.0.1:8772.

## Percurso observado no navegador

- Criação de Vurg (Orc/Bárbaro), prólogo e entrada no mapa com guia sobre o jogo.
- Três invocações gratuitas reais: Kazra Grito Silencioso, Dura Passo-Leve e Lyanthe Orvalho Sagrado; registros na coleção e redução de 10 para 7 invocações gratuitas.
- Primeira patrulha contra Slime usando card real e confirmação de ação. XP passou a 9 e ouro a 19; missão marcou 1/2 vitórias.
- Segunda patrulha contra Morcego usando habilidade real. XP passou a 19 e ouro a 23; missão ofereceu conclusão.
- Botão Concluir primeira missão removeu a orientação e salvou.

## Ajustes posteriores ao percurso

- Formação passou a exigir colocação manual dos três aliados, em vez de entrada automática. Testada no contrato Node, ainda não repetida no navegador com personagem novo.
- Destaques passaram a usar IDs da navegação desktop e as classes reais dos cards. Posicionamento do balão em batalha mudou para o topo. Ainda falta revalidar visualmente em ambas as orientações mobile.
- Removido indicador incorreto de zero passos para a missão de interface.

## Testes automatizados

`node scripts/test-live-tutorial.mjs`: aprovado. Três aliados distintos, recursos reais, formação manual, derrotas/fugas não contam, vitórias limitadas a duas.

Verificação de sintaxe em main.js, LiveTutorialUI.js e PartyUI.js aprovada. Piloto de combate existente: 36/36 concluídos. Não substitui teste responsivo ou campanha completa.
