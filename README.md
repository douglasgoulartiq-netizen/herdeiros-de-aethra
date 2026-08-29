# Herdeiros de Aethra

Um RPG de mundo aberto para navegador, em português, com regras inspiradas em D&D simplificadas, pixel art gerada proceduralmente, mapa aberto com encontros aleatórios e batalha em turnos no estilo ATB (barra de iniciativa).

## Como jogar

Este jogo é feito em JavaScript puro (sem frameworks) e roda inteiramente no seu navegador — não precisa instalar nada além de um servidor local simples, porque os navegadores bloqueiam o carregamento de módulos JavaScript (`type="module"`) diretamente de arquivos `file://`.

### Passo a passo

1. Extraia o arquivo `.zip` em uma pasta no seu computador.
2. Abra um terminal dentro dessa pasta.
3. Rode um servidor local. Qualquer uma destas opções funciona:
   - Com Python 3 (já vem instalado na maioria dos sistemas): `python3 -m http.server 8000`
   - Com Node.js: `npx serve .`
   - Com a extensão "Live Server" do VS Code (clique com o botão direito em `index.html` → "Open with Live Server")
4. Abra o navegador em `http://localhost:8000` (ou a porta que o servidor indicar).
5. Clique em **Nova Aventura** e comece a jogar!

O jogo salva seu progresso localmente no navegador (localStorage) — use o botão **Salvar (S)** durante o jogo, e depois **Continuar Aventura** na tela inicial para retomar.

## Controles

- Setas do teclado: mover o personagem
- **E**: interagir (falar com NPCs, abrir baús, coletar recursos, entrar na masmorra)
- **I**: inventário e equipamento
- **M**: missões
- **F**: forja e alquimia (criar itens a partir de materiais)
- **G**: time e invocação (gacha)
- **S**: salvar o jogo
- **Esc**: fechar janelas

No celular/tablet, um direcional e um botão "E" aparecem automaticamente na tela (detecção por toque) — os outros botões (Inventário, Missões, Forja, Salvar) já são clicáveis normalmente.

## Jogar no celular (iPhone/Android) sem instalar nada

O jogo já tem controles por toque prontos, mas para abrir num celular você precisa de uma URL (não dá pra rodar `python3 -m http.server` no iPhone). O jeito mais rápido e sem custo, sem precisar saber programar:

1. No computador (ou até no iPhone, usando o app **Arquivos**), acesse **https://app.netlify.com/drop**.
2. Extraia o `.zip` deste projeto numa pasta.
3. Arraste a pasta extraída (ou o `.zip`) para a área de "arrastar e soltar" do Netlify Drop.
4. Em poucos segundos você recebe uma URL pública (tipo `https://algum-nome.netlify.app`).
5. Abra essa URL no Safari do iPhone e jogue! Dá pra tocar em "Compartilhar → Adicionar à Tela de Início" pra ficar com um ícone de app.

Não precisa de conta pra gerar o link (fica temporário); se quiser um link permanente, crie uma conta gratuita no Netlify antes de arrastar a pasta.

Alternativas que também funcionam: GitHub Pages, Cloudflare Pages, Vercel — qualquer hospedagem de site estático funciona, já que o jogo é só HTML/CSS/JS puro.

## Login com Google e save automático na nuvem

O jogo já vem com um botão **"Entrar com Google"** na tela inicial, usando um projeto Supabase (banco de dados + autenticação) já criado para este jogo:

- URL do projeto: `https://qimennnhincqtygrvcwu.supabase.co`
- Tabela `saves` já criada, com Row Level Security (cada jogador só acessa o próprio save).

Porém falta um passo que **só você consegue fazer**, porque exige a sua própria conta Google Cloud (não é algo que eu, como IA, tenha permissão de criar em seu nome):

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/), crie um projeto (ou use um existente).
2. Vá em **APIs e Serviços → Tela de consentimento OAuth** e configure o básico (nome do app, e-mail).
3. Vá em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo "Aplicativo da Web".
4. Em **URIs de redirecionamento autorizados**, adicione:
   `https://qimennnhincqtygrvcwu.supabase.co/auth/v1/callback`
5. Copie o **Client ID** e **Client Secret** gerados.
6. No painel do Supabase (supabase.com/dashboard → seu projeto → **Authentication → Providers → Google**), cole o Client ID e Client Secret, e ative o provedor.
7. Ainda no Supabase, em **Authentication → URL Configuration**, defina a **Site URL** como a URL onde você hospedou o jogo (ex: a URL do Netlify do passo anterior) — isso garante que o login redirecione de volta pro jogo corretamente.

Depois desse passo único, o botão "Entrar com Google" já funciona: ele salva o progresso automaticamente na nuvem a cada 45 segundos (e também sempre que você aperta **Salvar**), além de continuar salvando localmente no navegador como reserva. Sem fazer login, o jogo continua funcionando normalmente, só que salvando apenas localmente.

## O que tem no jogo

- **Criação de personagem**: 6 raças, 6 classes, 6 antecedentes e traços de personalidade, com centenas de combinações possíveis, tudo com atributos, bônus e habilidades próprias.
- **Mundo aberto**: vila com NPCs e mercador, floresta com encontros aleatórios, lago, e uma masmorra com um chefe (Dragão Jovem) no final.
- **Batalha ATB**: barra de iniciativa por velocidade, ataques, habilidades de classe, itens, defender e fugir, com rolagens de dado (d20) e críticos.
- **Itens e raridades**: 72 itens catalogados (armas, armaduras, consumíveis, materiais, acessórios) em 5 raridades (Comum, Incomum, Raro, Épico, Lendário), com valores e poder escalando por raridade.
- **Fontes de itens**: drops de monstros (com taxas de drop configuráveis), baús espalhados pelo mapa, recompensas garantidas de missão, e coleta de materiais + forja/alquimia.
- **5 missões** com objetivos de matar, coletar e explorar, com recompensas em ouro, XP e itens.
- **Time de até 3 personagens e invocação (gacha)**: além do seu personagem, você pode invocar até 2 aliados com uma moeda própria, os **Fragmentos de Aethra**, e lutar em batalhas com o time completo. Veja a seção abaixo.

## Time e invocação (gacha)

Aperte **G** (ou o botão "Time") para abrir a tela de invocação. Ela tem 4 abas:

- **Invocar**: gaste Fragmentos de Aethra para invocar um personagem aleatório de um roster de 24 (5 raridades: Comum, Incomum, Raro, Épico, Lendário). Existem 3 banners:
  - **Permanente**: todo o roster. Tem *pity*: se você não tirar um Lendário em 50 invocações, a 50ª é garantida — e a chance de Lendário já começa a subir bastante a partir da 40ª. Toda 10ª invocação garante Raro ou melhor; toda 25ª garante Épico ou melhor.
  - **Evento**: mesmo roster, mas com um personagem Lendário "em destaque". Ao tirar um Lendário nesse banner, é 50% de chance de ser o personagem em destaque — se perder esse 50/50, o **próximo** Lendário desse banner já vem garantido ser ele.
  - **Iniciante**: banner à parte, com teto de 40 invocações (as primeiras 10 são de graça) e garantias mais rápidas (Raro+ até a 10ª, Épico+ até a 20ª, Lendário até a 40ª). Some para sempre depois que você usa as 40.
  - Se você invocar um personagem que já tem, a cópia extra vira Fragmentos automaticamente (não empilha personagem repetido).
- **Coleção**: todos os personagens que você já invocou.
- **Time**: escolha até 2 personagens invocados para lutarem ao seu lado (seu personagem principal está sempre no time). O time todo ganha XP e sobe de nível junto nas batalhas.
- **Recompensas**: um desafio diário (não precisa jogar todo dia — acumula até 7 resgates) e uma missão semanal, ambos pagando Fragmentos de Aethra.

Fragmentos também vêm de: recompensa das 5 missões principais, abrir baús e coletar recursos por baú/nó do mapa (uma vez cada), derrotar o chefe da masmorra, conquistas (primeira vitória, nível 5, missões concluídas, coleção de personagens) e uma pequena chance de bônus depois de qualquer batalha vencida.

O preço da invocação (100 Fragmentos por puxada, sem desconto no pacote de 10 — a vantagem do pacote é a garantia de raridade embutida) e as probabilidades/pity acima vieram de uma simulação de mais de 1 milhão de jogadores simulados (casual/ativo/dedicado) para bater com a meta de puxadas por semana pedida — o relatório completo, se você quiser conferir os números, está em `scripts/gacha_sim/relatorio_economia.md` (não incluído neste zip, mas posso enviar se quiser). Todos esses valores ficam centralizados e ajustáveis em `src/data/economyConfig.js`.

**Limitações conhecidas, por transparência**: como o jogo não tem servidor, as invocações são calculadas no seu próprio navegador (não há proteção contra alguém editar o `localStorage` manualmente); o banner de evento é fixo (não há um calendário de eventos rotativos); e duplicatas hoje só convertem em Fragmentos, sem sistema de vínculo/afinidade por cópias extras ainda.

## Estrutura do projeto (para quem quiser expandir)

```
index.html              - página principal
src/
  main.js                - orquestra o jogo (estado, input, loop)
  style.css               - toda a interface visual
  data/
    *.json                 - raças, classes, itens, monstros, missões etc. (edite aqui para adicionar conteúdo!)
    worldMap.js             - definição dos mapas e objetos do mundo
    loader.js                - carregamento de dados e imagens
  systems/                - regras do jogo (combate, inventário, missões, save, crafting) sem nenhuma dependência visual
  render/                 - desenho do mundo em canvas
  ui/                     - telas (criação de personagem, batalha, inventário, missões, loja, forja)
assets/                  - pixel art gerada (tiles, sprites, ícones)
scripts/                 - scripts Python usados para gerar a arte e os dados (rode de novo se quiser mais conteúdo)
```

Como tudo é orientado a dados (arquivos `.json` em `src/data/`), dá pra adicionar novos itens, monstros, raças, classes ou missões só editando esses arquivos — não precisa mexer no código do jogo.

## Notas técnicas

- A arte pixel art foi gerada proceduralmente (script Python com Pillow em `scripts/gen_assets.py`) porque o ambiente onde o jogo foi construído não tinha acesso a pacotes de arte externos — então é 100% original e livre de licenciamento.
- O jogo não depende de nenhuma biblioteca externa (sem CDN, sem npm) — funciona totalmente offline depois de baixado.
- Testado de ponta a ponta (criação de personagem, movimento, encontros aleatórios, batalha, missões, loja, forja, equipar itens, masmorra, chefe final, salvar/carregar).
