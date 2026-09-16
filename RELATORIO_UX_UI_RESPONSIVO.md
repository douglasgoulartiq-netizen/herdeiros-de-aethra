# Relatório — Reestruturação de UX/UI (Desktop + Mobile)

Auditoria automatizada, reestruturação e verificação concluídas.

**Resultado medido:** de **73 combinações reprovadas em 216** (18 telas × 12
resoluções) para **0 em 216**. `npm run test:ui` reproduz a auditoria inteira.

---

## 1. Telas encontradas

Dezoito superfícies, auditadas uma a uma em 12 resoluções:

| Tela | Função | Estrutura antes |
|---|---|---|
| Inventário | equipar, usar, vender | lista única de 2707px |
| Missões | ativas e diárias | lista |
| Forja & Alquimia | criar e aprimorar | duas listas de 2371px |
| Loja | comprar da vila | lista de 24 itens |
| Mercador Itinerante | estoque temporário | lista |
| Viagem Rápida | teleporte entre zonas | lista de 30 zonas |
| Gacha — Invocar | banners e pity | 3 cards empilhados |
| Gacha — Coleção/Time/Recompensas | roster | abas + listas |
| Habilidades | árvore de classe | lista |
| Caminhos do Herdeiro | árvore de talentos | árvore + painel de 300px fixo |
| Compêndio | bestiário, missões, invocações, facções, mitologia | 5 abas + 8179px de lista |
| Atlas | mapa-múndi com hotspots | imagem sem proporção reservada |
| Diário de Decisões | histórico | lista |
| Acessibilidade | preferências | formulário |
| Ameaça pré-combate | decidir lutar/fugir | painel |
| Criação de personagem | onboarding | tela cheia |
| Batalha | combate ATB + mão de cards | pilha vertical |
| HUD do mundo | barras + 15 botões | coluna vertical |

## 2. Problemas encontrados

Seis causas estruturais explicavam quase toda a lista de sintomas:

1. **`#modal-conteudo` era uma caixa rolável única.** Título, botão de fechar,
   abas, conteúdo e ações no mesmo scroll — então EQUIPAR, CRIAR e INVOCAR
   saíam de vista assim que a lista crescia.
2. **Largura fixa de 720px.** Num monitor de 1600px sobravam 55% de tela
   vazia; num celular de 320px a mesma caixa apertava tudo.
3. **Abas eram botões soltos com `margin: 6px`.** No celular viravam torre
   vertical — o Compêndio gastava **303px de altura só em abas**.
4. **Não existia painel contextual.** "Detalhes" só podiam ser mais conteúdo
   empilhado, o que multiplicava a rolagem.
5. **`justify-content: center` em containers roláveis.** Bug clássico e o mais
   grave: o excedente é empurrado para **fora do alcance da rolagem**.
   Afetava `.tela`, o campo da arena e a mão de cards.
6. **`flex-wrap: wrap` numa coluna com altura limitada.** A mão de cards
   embrulhava numa **segunda coluna 316px fora da tela**.

## 3. Nova estrutura de navegação

Uma definição única (`HUBS` em `GameUI.js`) alimenta os dois formatos:

```
👤 Personagem   Habilidades · Caminhos do Herdeiro · Time e Invocação
🧭 Jornada      Missões · Atlas · Viagem Rápida · Diário
🎒 Mochila      → Inventário (direto)
📚 Codex        → Compêndio (direto)
⋯  Mais         Forja · Descansar · Sair da Masmorra · Automático · Salvar · Acessibilidade
```

- **Desktop:** a mesma coluna do HUD, agora **agrupada por hub com rótulo** —
  cinco blocos em vez de 15 botões soltos.
- **Celular:** barra inferior de 5 destinos. Hub com uma ação abre direto;
  com várias, abre a lista num painel. **Profundidade máxima: 2 níveis.**
- A barra só existe **enquanto se joga**: some na criação de personagem e na
  batalha, vinculada à visibilidade do próprio HUD (sem sincronia manual).

## 4-6. Abas reorganizadas, criadas e unificadas

| Tela | Abas |
|---|---|
| Inventário | **criadas:** Equipado · Todos · Armas · Armaduras · Acessórios · Consumíveis · Materiais |
| Forja | **criadas:** Criar · Aprimorar (eram dois blocos empilhados) |
| Gacha | mantidas (Invocar/Coleção/Time/Recompensas), agora fixas fora do scroll |
| Compêndio | mantidas as 5, agora numa faixa que não vira torre |

Acima de 5 abas, o celular recebe um **seletor** em vez de uma faixa rolável —
descobrir função arrastando é o que o item 15 proíbe.

Nenhuma aba foi removida e nenhuma aba vazia foi criada.

## 7-10. Layouts

**Desktop (≥1200px):** modal de até 1320px (grades) ou 1600px (mapas/árvores);
grade + painel de detalhes lado a lado; HUD agrupado à direita. Quando o painel
abre, a tela por baixo **cede a largura dele** em vez de ficar coberta.

**Tablet (768–1199px):** duas colunas a partir de 900px; abaixo disso o painel
de detalhes vira sheet. Foi aqui que apareceu um bug de fronteira: o CSS
escondia o painel a 900px enquanto o JS só trocava para sheet a 720px — num
tablet em retrato o detalhe do talento não aparecia em lugar nenhum.

**Celular (<720px):** o modal vira **tela cheia** (não uma caixinha
espremida); grade densa; detalhes em bottom sheet; ações numa barra inferior
de botões de largura igual; navegação inferior por hubs.

**Landscape:** cabeçalhos e botões encolhem; a **batalha muda de composição** —
campo à esquerda, mão de cards em coluna à direita, registro oculto.

## 11. Overflow corrigido

Corrigido na **causa**, nunca com `overflow-x: hidden` no body:

- centralização insegura → `justify-content: safe center` / `flex-start`;
- `flex-wrap` numa coluna de altura limitada → `nowrap`;
- `min-width: 0` em todo container flex/grid, para poderem encolher;
- `minmax(min(100%, X), 1fr)` nas grades — a coluna encolhe a 320px em vez de vazar;
- títulos e nomes com reticências ou quebra, nunca esticando o container;
- imagem do mapa com proporção reservada **e** teto de altura.

Medição final: **0 elementos vazando** e **0 rolagem horizontal** em 216
combinações.

## 12-14. Janelas, modais e tooltips

Componente único `.hda-modal` em três faixas — **cabeçalho fixo · corpo
rolável · ações fixas** — usado por todas as telas. Largura responsiva por
densidade de conteúdo, altura limitada a `90dvh` (tela cheia no celular).

Tooltips que dependiam de hover viraram **painel contextual** (item 40/66): o
mesmo componente é sheet no celular e painel lateral no desktop, com botão de
fechar e `Esc` — que fecha primeiro o painel e só depois a tela.

## 15-16. Battle UI e cards

A tela virou um flex column de altura fixa em que **só o campo cresce** —
por isso a mão de cards nunca é empurrada para fora. Registro de combate
recolhível (a última linha continua visível no resumo). Contexto tático com
teto de altura. No celular: **3 cards por linha** (2 abaixo de 360px), altura
reduzida, **uma badge por card**, rótulos curtos (`PODE MATAR` em vez de
`POSSÍVEL EXEC…` truncado) e **inimigos em primeiro** (item 34).

Verificado numa partida real: 29 ações, 0 erros de JS, e todos os dez marcos
observados (intenção, telegraph, resumo, barra-fantasma, dano flutuante,
quebra de postura, atordoamento, ambos os caminhos de interrupção, natural
20/1 e hit-stop).

## 17. Gacha

O caso mais explícito do briefing (itens 23/24). Antes, os botões de invocar do
segundo e do terceiro banner ficavam **abaixo da dobra**. Agora, nos dois
formatos e sem rolagem nenhuma: banner em destaque no topo, escolha de banner
em faixa compacta, **moeda no cabeçalho**, **pity no banner**, e **Invocar x1 /
x10 na barra fixa**. Taxas, garantias e detalhes ficam recolhidos no corpo.

## 18. Inventário

De lista única de 2707px para: abas por categoria · grade de ladrilhos
(ícone, nome em duas linhas, raridade por **moldura e rótulo**) · detalhe com
comparação de equipamento no painel contextual · EQUIPAR/USAR/VENDER na barra
fixa desse painel. No desktop cabe inteiro numa tela.

## 19-22. Skill Tree, Mapa, Bestiário, Crafting

- **Caminhos do Herdeiro:** árvore em largura cheia no celular; o painel do nó
  é **o mesmo elemento**, movido para dentro do sheet — todo o wiring de
  APRENDER continua idêntico.
- **Atlas:** proporção reservada (a imagem ausente colapsava o mapa para 22px
  de altura) e teto de altura para telas baixas.
- **Bestiário:** grade de criaturas + ficha no painel. Eram 8179px de rolagem.
- **Forja:** abas Criar/Aprimorar, grade de receitas, materiais e **CRIAR** no
  rodapé fixo do painel.

## 23-24. Testes e resoluções

`scripts/test-ui-responsivo.mjs` abre **cada tela** em cada resolução, executa
a interação mínima que leva à ação principal, e mede: overflow horizontal do
documento, elementos que ultrapassam a viewport, controles inalcançáveis na
vertical, alvos de toque pequenos, texto abaixo de 10px, rolagem excessiva e
**presença e visibilidade dos elementos críticos** de cada tela.

Resoluções: 1920×1080 · 1600×900 · 1366×768 · 1280×720 · 1024×768 · 768×1024 ·
430×932 · 390×844 · 375×812 · 360×800 · **320×568** · 844×390 (landscape).

O critério distingue **visível** de **alcançável com scroll**: para Gacha,
Forja, Inventário, Loja, Viagem, Batalha, Compêndio, Atlas e Caminhos, a ação
principal precisa estar *visível*, não apenas existir.

## 25-26. Bugs encontrados e corrigidos

Todos encontrados por medição, não por leitura:

1. **Centralização tornava o overflow inalcançável** (`.tela`, campo da arena,
   mão de cards). Metade da arena ficava acima do topo, fora do alcance da
   rolagem. → `safe center` / `flex-start`.
2. **A mão de cards inteira aparecia 316px à direita da tela** no celular:
   `flex-wrap: wrap` numa coluna com altura limitada vira multi-coluna. → `nowrap`.
3. **`flex-shrink: 0` impedia o campo de encolher**, empurrando os cards para
   fora num celular de 568px. → regra escopada, excluindo a batalha.
4. **Fronteira JS × CSS desalinhada** (720 vs 900px): em tablet retrato o
   painel do talento não aparecia nem como coluna nem como sheet.
5. **Painel de detalhes cobria a última coluna da grade** no desktop.
6. **Imagem do mapa colapsava para 22px** quando ausente/carregando.
7. **Barra inferior aparecia antes de existir personagem**, oferecendo cinco
   caminhos fechados.
8. **Criação de personagem encostada na borda esquerda** após a correção de
   centralização.
9. **Badges truncadas** no card estreito (`POSSÍVEL EXEC…`).
10. **Party antes dos inimigos** no celular, invertendo a prioridade do item 34.

Seis dos dez existiam antes deste trabalho; quatro foram introduzidos por
correções e pegos pelo mesmo teste no ciclo seguinte.

## 27. Arquivos alterados

**Criados**

| Arquivo | Linhas | Papel |
|---|---:|---|
| `src/hda-ui.css` | 648 | Sistema de interface: modal, abas, split, grade, sheet, barra de ações, navegação inferior |
| `src/ui/HdaUI.js` | 321 | Componentes: `abrirTela`, `montarAbas`, `abrirSheet`, `montarNavbar`, `criarGrade` |
| `scripts/test-ui-responsivo.mjs` | 281 | Auditoria automatizada de 216 combinações |
| `scripts/audit-ui.html` | — | Bancada que abre todas as telas com dados reais |

**Modificados:** `index.html` (link do CSS + `viewport-fit=cover`),
`src/main.js` (navegação por hubs), `src/ui/GameUI.js` (casca, HUBS,
inventário, forja, aprimoramento, loja, viagem), `src/ui/GachaUI.js`,
`src/ui/CompendiumUI.js`, `src/ui/TalentTreeUI.js`,
`src/ui/TravelingMerchantUI.js`, `src/ui/AtlasUI.js`, `src/ui/BattleUI.js`,
`src/ui/BattleCards.js`, `src/battle-cards.css`, `package.json`.

## 28. Pendências reais

1. **Sete telas ainda usam a casca antiga sem grade própria** — Missões,
   Diário, Acessibilidade, Ameaça, Habilidades, Vínculo, Despertar. Elas
   passam na auditoria (herdaram cabeçalho fixo, corpo rolável e largura
   responsiva da casca comum), mas continuam listas verticais onde uma grade
   com painel seria melhor. Não reescrevi porque nenhuma delas reprovava.
2. **Aba "Equipado" do inventário** mostra os slots mas ainda não abre a
   seleção de equipamento ao tocar num slot (item 22). Hoje o caminho é a aba
   da categoria.
3. **Gesto de arrastar** para fechar o bottom sheet não está implementado — a
   pega é decorativa; fechar é por botão, toque no fundo ou `Esc`.
4. **`:has()`** é usado em duas regras (esconder a navbar fora do jogo, ceder
   largura ao painel). Em navegadores sem suporte, a navbar aparece na criação
   de personagem e o painel volta a sobrepor — degradação suave, não quebra.
5. **Item 46 (contexto)** — "pegou arma nova → COMPARAR" não foi implementado;
   a comparação existe, mas só dentro do inventário.
6. **Efeitos de UI por perfil** (item 64, Alta/Média/Baixa) não existem; há
   apenas Animações Completa/Reduzida, que já vinha da entrega anterior.
7. **A auditoria mede geometria, não estética.** Ela prova que nada está
   cortado ou fora da tela; não prova que cada tela ficou bonita. As telas
   reescritas eu revisei por captura; as sete do item 1, não.

---

## Como reproduzir

```
npm run test:ui       # 18 telas × 12 resoluções, com interação
npm run test:cards    # 49 verificações da mão de cards
python3 -m http.server 8000
#  /scripts/audit-ui.html      -> abre qualquer tela isolada
#  /scripts/preview-batalha.html -> batalha real
```
