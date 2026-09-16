// Servidor local do HERDEIROS DE AETHRA.
//
// POR QUE ISTO EXISTE
// -------------------
// O jogo é ES modules puro e carrega os dados com fetch("./src/data/*.json").
// Abrir o index.html com duplo clique (file://) NÃO funciona: o navegador
// bloqueia módulo e fetch nesse protocolo, e o jogo trava na tela de boot.
// Ele precisa de um servidor HTTP, mesmo que só no seu computador.
//
// O package.json já mandava `npm run dev` chamar este arquivo desde sempre —
// só que o arquivo nunca existiu. Agora existe, sem nenhuma dependência: usa
// apenas o que já vem dentro do Node.
//
// O que ele faz:
//   1. sobe o servidor na primeira porta livre a partir da 8765;
//   2. abre o navegador padrão já no jogo;
//   3. mostra o endereço da rede local, pra abrir no celular pelo mesmo Wi-Fi;
//   4. fica rodando até você fechar a janela.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTA_INICIAL = Number(process.env.PORTA) || 8765;
const TENTATIVAS = 20;
// Escuta em toda a rede pra dar pra abrir no celular. Passe SOMENTE_LOCAL=1
// se quiser que só este computador enxergue o jogo.
const ENDERECO = process.env.SOMENTE_LOCAL ? "127.0.0.1" : "0.0.0.0";

// Content-Type importa de verdade aqui: um .js servido como text/plain faz o
// navegador recusar o módulo, e o jogo não sobe.
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function ipsDaRede() {
  const saida = [];
  Object.values(os.networkInterfaces()).forEach((lista) => {
    (lista || []).forEach((i) => {
      if (i.family === "IPv4" && !i.internal) saida.push(i.address);
    });
  });
  return saida;
}

function abrirNavegador(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, (erro) => {
    if (erro) console.log(`\n  Não consegui abrir o navegador sozinho. Abra: ${url}\n`);
  });
}

const servidor = http.createServer((req, res) => {
  // Só o caminho, sem query string (o jogo usa ?semente=...).
  let caminho = decodeURIComponent(req.url.split("?")[0]);
  if (caminho === "/" || caminho === "") caminho = "/index.html";

  // Trava: nada fora da pasta do jogo, mesmo que a URL traga "..".
  const destino = path.join(RAIZ, path.normalize(caminho).replace(/^([/\\])+/, ""));
  if (!destino.startsWith(RAIZ)) {
    res.writeHead(403).end("403 — fora da pasta do jogo");
    return;
  }

  fs.readFile(destino, (erro, dados) => {
    if (erro) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`404 — não achei ${caminho}`);
      return;
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream",
      // Sem cache: você edita um arquivo, dá F5 e vê a mudança na hora. Num
      // servidor de desenvolvimento isso vale mais do que velocidade.
      "Cache-Control": "no-store",
    });
    res.end(dados);
  });
});

// Se a porta estiver ocupada (o jogo já aberto, outro programa), tenta a
// seguinte em vez de morrer com um erro que não explica nada.
let porta = PORTA_INICIAL;
let tentativas = 0;
servidor.on("error", (e) => {
  if (e.code === "EADDRINUSE" && tentativas < TENTATIVAS) {
    tentativas += 1;
    porta += 1;
    servidor.listen(porta, ENDERECO);
    return;
  }
  console.error("\n  Não consegui subir o servidor:", e.message);
  process.exit(1);
});

servidor.listen(porta, ENDERECO, () => {
  const local = `http://127.0.0.1:${porta}/`;
  console.log("");
  console.log("   HERDEIROS DE AETHRA");
  console.log("   ==========================================================");
  console.log(`   Neste computador:  ${local}`);
  if (ENDERECO === "0.0.0.0") {
    const ips = ipsDaRede();
    if (ips.length) {
      console.log("");
      console.log("   No celular (mesmo Wi-Fi):");
      ips.forEach((ip) => console.log(`                      http://${ip}:${porta}/`));
    }
  }
  console.log("");
  console.log(`   Pasta: ${RAIZ}`);
  console.log("");
  console.log("   O navegador abre sozinho em instantes.");
  console.log("   FECHE ESTA JANELA para desligar o jogo.");
  console.log("   ==========================================================");
  console.log("");
  abrirNavegador(local);
});
