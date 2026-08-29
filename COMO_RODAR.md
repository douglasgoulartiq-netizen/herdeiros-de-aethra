# Como rodar Herdeiros de Aethra

Este é um jogo em JavaScript puro (sem build step), então **não dá para abrir
o `index.html` clicando duas vezes** — o navegador bloqueia os `fetch()` dos
arquivos JSON e módulos por segurança (CORS). É preciso servir a pasta por um
servidor local simples. Veja as opções abaixo.

## Opção 1 — Python (mais simples, geralmente já instalado)

1. Extraia o .zip em uma pasta.
2. Abra um terminal dentro dessa pasta.
3. Rode:
   ```
   python3 -m http.server 8000
   ```
4. Abra no navegador: http://localhost:8000

## Opção 2 — Node.js

1. Extraia o .zip.
2. No terminal, dentro da pasta:
   ```
   npx serve .
   ```
   (ou `npx http-server .`)
3. Abra o link que aparecer no terminal (geralmente http://localhost:3000).

## Opção 3 — VS Code (Live Server)

1. Abra a pasta extraída no VS Code.
2. Instale a extensão "Live Server".
3. Clique com o botão direito em `index.html` → "Open with Live Server".

---

## Publicar com um link ao vivo (sem precisar do seu computador ligado)

A forma mais simples e sem usar linha de comando é a Vercel:

1. Crie uma conta grátis em https://vercel.com (dá para entrar com GitHub, Google etc.).
2. No painel, clique em **"Add New" → "Project"**.
3. Escolha a opção de importar uma pasta / fazer upload direto (ou arraste a
   pasta extraída do jogo para a área de upload, quando disponível na
   interface — a Vercel também aceita `vercel deploy` pela CLI, veja abaixo).
4. Não é necessário configurar build command nem output directory — é um
   site estático, a Vercel detecta sozinha.
5. Clique em "Deploy". Em menos de um minuto você recebe um link do tipo
   `https://seu-projeto.vercel.app` já no ar.

### Alternativa via linha de comando (CLI)

```
npm install -g vercel
cd pasta-do-jogo
vercel login
vercel --prod
```

Siga as perguntas na tela (nome do projeto, etc.) e ao final ele imprime o
link de produção.

### Alternativa via GitHub (recomendada se você for continuar editando)

1. Crie um repositório novo no GitHub e suba os arquivos desta pasta.
2. Em vercel.com → "Add New" → "Project" → conecte sua conta do GitHub e
   selecione o repositório.
3. Deploy automático — e toda vez que você atualizar o repositório, o site
   atualiza sozinho.

---

## Estrutura do projeto

- `index.html` — ponto de entrada
- `src/main.js` — inicialização do jogo
- `src/systems/` — regras (combate, gacha, missões, crafting, etc.)
- `src/ui/` — telas (criação de personagem, batalha, inventário, gacha...)
- `src/data/*.json` — dados do jogo (raças, classes, monstros, itens, mapa...)
- `assets/` — pixel art (tileset do mundo, sprites de personagens/monstros, ícones)
- `scripts/gen_tileset_v2.py` — gerador do tileset de mundo/vilarejo em pixel
  art (rode `python3 scripts/gen_tileset_v2.py` se quiser regenerar/ajustar
  as texturas do mapa)
