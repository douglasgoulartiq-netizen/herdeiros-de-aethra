// Servidor estático para testar exatamente os arquivos que irão à Vercel.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..", "dist");
const porta = Number(process.env.PORTA) || 8768;
const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const destino = path.resolve(raiz, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
  if (!destino.startsWith(`${raiz}${path.sep}`)) { res.writeHead(403).end(); return; }
  fs.readFile(destino, (erro, conteudo) => {
    if (erro) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": tipos[path.extname(destino)] || "application/octet-stream" });
    res.end(conteudo);
  });
}).listen(porta, "127.0.0.1", () => console.log(`Build de produção: http://127.0.0.1:${porta}/`));
