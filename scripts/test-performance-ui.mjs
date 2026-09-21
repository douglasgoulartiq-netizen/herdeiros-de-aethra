// Regressão de desempenho para o carregamento e o trilho lateral.
// Mede o tempo até a navegação ficar interativa e o atraso entre clique e
// próximo quadro. Também registra tarefas longas e erros de execução.
import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://127.0.0.1:8767";
const browser = await chromium.launch(opcoesDoNavegador());
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const erros = [];
const httpFalhas = [];
page.on("pageerror", (erro) => erros.push(erro.message));
page.on("console", (msg) => { if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) erros.push(msg.text()); });
page.on("response", (resposta) => {
  if (resposta.status() >= 400 && !/favicon/.test(resposta.url())) {
    httpFalhas.push(`${resposta.status()} ${resposta.url()}`);
  }
});

await page.addInitScript(() => {
  window.__hdaLongTasks = [];
  try {
    new PerformanceObserver((lista) => {
      for (const item of lista.getEntries()) window.__hdaLongTasks.push(item.duration);
    }).observe({ type: "longtask", buffered: true });
  } catch { /* API opcional em navegadores antigos. */ }
});

const inicio = Date.now();
await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#hud-buttons button[data-hub]", { state: "attached", timeout: 60000 });
const bootMs = Date.now() - inicio;

const amostras = await page.evaluate(async () => {
  const botoes = [...document.querySelectorAll("#hud-buttons button[data-hub]")];
  const tempos = [];
  for (let rodada = 0; rodada < 5; rodada += 1) {
    for (const botao of botoes) {
      const antes = performance.now();
      botao.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      tempos.push(performance.now() - antes);
      botao.click();
    }
  }
  return tempos;
});

const metricas = await page.evaluate(() => ({
  longTasks: window.__hdaLongTasks || [],
  recursos: performance.getEntriesByType("resource").length,
  transferidos: performance.getEntriesByType("resource")
    .reduce((total, item) => total + (item.transferSize || 0), 0),
}));
const ordenar = [...amostras].sort((a, b) => a - b);
const p95 = ordenar[Math.max(0, Math.ceil(ordenar.length * 0.95) - 1)] || 0;
const maiorLongTask = Math.max(0, ...metricas.longTasks);

console.log(JSON.stringify({
  base: BASE,
  bootMs,
  cliqueMedioMs: +(amostras.reduce((a, b) => a + b, 0) / amostras.length).toFixed(1),
  cliqueP95Ms: +p95.toFixed(1),
  tarefasLongas: metricas.longTasks.length,
  maiorTarefaMs: +maiorLongTask.toFixed(1),
  recursos: metricas.recursos,
  transferidosKB: +(metricas.transferidos / 1024).toFixed(1),
  erros,
  httpFalhas: [...new Set(httpFalhas)],
}, null, 2));

await browser.close();

const falhou = erros.length > 0 || httpFalhas.some((url) => !/favicon/.test(url))
  || p95 > 180 || maiorLongTask > 500 || bootMs > 15000;
if (falhou) process.exitCode = 1;
