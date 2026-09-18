// Regressão: resize/rotação não acumula listeners e hubs usam disclosure.
import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://localhost:8765";
let falhas = 0;
const checar = (ok, msg, extra = "") => {
  console.log(`${ok ? "OK" : "FALHA"} ${msg}${extra ? ` — ${extra}` : ""}`);
  if (!ok) falhas += 1;
};
const browser = await chromium.launch(opcoesDoNavegador());
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.addInitScript(() => {
  const original = EventTarget.prototype.addEventListener;
  const estado = { ativos: { click: 0, keydown: 0 }, chamadas: { click: 0, keydown: 0 } };
  window.__hdaEventosNavegacao = estado;
  EventTarget.prototype.addEventListener = function (tipo, listener, opcoes) {
    const medir = this === document && ["click", "keydown"].includes(tipo) && opcoes?.signal;
    if (!medir) return original.call(this, tipo, listener, opcoes);
    estado.ativos[tipo] += 1;
    opcoes.signal.addEventListener("abort", () => { estado.ativos[tipo] -= 1; }, { once: true });
    return original.call(this, tipo, function (...args) {
      estado.chamadas[tipo] += 1;
      return typeof listener === "function" ? listener.apply(this, args) : listener.handleEvent(...args);
    }, opcoes);
  };
});

await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForSelector("#hud-buttons button[data-hub]", { state: "attached" });
for (let i = 0; i < 6; i += 1) {
  await page.setViewportSize(i % 2 ? { width: 844, height: 390 } : { width: 390, height: 844 });
  await page.waitForTimeout(80);
}

const resultado = await page.evaluate(() => {
  const grupo = document.querySelector("#hud-buttons .hud-abas");
  const hubs = [...grupo.querySelectorAll("button[data-hub]")];
  const auto = document.getElementById("btn-auto");
  const semantica = grupo.getAttribute("role") === "group"
    && !grupo.querySelector('[role="tab"], [role="tablist"]')
    && hubs.every((botao) => {
      const painel = document.getElementById(botao.getAttribute("aria-controls"));
      return botao.getAttribute("aria-expanded") === "false"
        && painel?.getAttribute("role") === "region"
        && painel.getAttribute("aria-labelledby") === botao.id;
    })
    && !auto.hasAttribute("aria-expanded") && !auto.hasAttribute("aria-controls");
  hubs[0].click();
  window.__hdaEventosNavegacao.chamadas.click = 0;
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return {
    semantica,
    ativos: window.__hdaEventosNavegacao.ativos,
    chamadas: window.__hdaEventosNavegacao.chamadas.click,
    fechou: hubs[0].getAttribute("aria-expanded") === "false",
  };
});

checar(resultado.semantica, "hubs são disclosures associados a regiões");
checar(resultado.ativos.click === 1 && resultado.ativos.keydown === 1,
  "seis rotações mantêm um par de listeners", JSON.stringify(resultado.ativos));
checar(resultado.chamadas === 1 && resultado.fechou, "clique fora dispara uma vez e fecha o hub");
await browser.close();
if (falhas) process.exitCode = 1;
