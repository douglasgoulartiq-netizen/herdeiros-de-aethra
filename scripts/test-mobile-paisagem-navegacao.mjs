import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://localhost:8765";
const APARELHOS = [
  { nome: "celular paisagem 844x390", width: 844, height: 390 },
  { nome: "celular paisagem 740x360", width: 740, height: 360 },
];
let falhas = 0;

function checar(ok, mensagem, detalhe = "") {
  console.log(`${ok ? "OK" : "FALHA"} ${mensagem}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
}

function sobrepoe(a, b) {
  return !!a && !!b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

const browser = await chromium.launch(opcoesDoNavegador());
for (const aparelho of APARELHOS) {
  console.log(`\n=== ${aparelho.nome} ===`);
  const context = await browser.newContext({
    viewport: { width: aparelho.width, height: aparelho.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForSelector(".hda-navbar button", { state: "attached", timeout: 20000 });
  await page.evaluate(() => {
    document.querySelectorAll(".tela").forEach((tela) => tela.classList.add("hidden"));
    document.getElementById("hud")?.classList.remove("hidden");
    document.getElementById("touch-controls")?.classList.remove("hidden");
  });
  await page.waitForTimeout(100);

  const estado = await page.evaluate(() => {
    const caixa = (el) => {
      if (!el || getComputedStyle(el).display === "none") return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const nav = document.querySelector(".hda-navbar");
    const botoes = [...(nav?.querySelectorAll("button") || [])];
    return {
      nav: caixa(nav),
      botoes: botoes.map((botao) => ({
        caixa: caixa(botao),
        rotulo: botao.querySelector(".hda-nav-rotulo")?.textContent?.trim() || "",
        rotuloVisivel: getComputedStyle(botao.querySelector(".hda-nav-rotulo")).display !== "none",
        nomeAcessivel: botao.innerText.trim(),
      })),
      trilhoVisivel: getComputedStyle(document.getElementById("hud-buttons")).display !== "none",
      dpad: caixa(document.getElementById("touch-dpad")),
      acao: caixa(document.querySelector(".touch-acao")),
      larguraDocumento: document.documentElement.scrollWidth,
      alturaDocumento: document.documentElement.scrollHeight,
    };
  });

  checar(!!estado.nav, "barra de HUBS aparece em aparelho touch deitado");
  checar(estado.botoes.length === 4, "os quatro HUBS continuam sendo a fonte da navegação");
  checar(estado.botoes.every((b) => b.caixa?.height >= 44 && b.caixa?.width >= 44), "todos os destinos têm alvo de pelo menos 44px");
  checar(estado.botoes.every((b) => b.rotuloVisivel && b.rotulo && b.nomeAcessivel), "todos os destinos exibem rótulo compreensível");
  checar(!estado.trilhoVisivel, "trilho lateral de desktop fica oculto");
  checar(!sobrepoe(estado.nav, estado.dpad) && !sobrepoe(estado.nav, estado.acao), "barra não cobre direcional nem ação");
  checar(estado.nav?.left >= -1 && estado.nav?.right <= aparelho.width + 1 && estado.nav?.bottom <= aparelho.height + 1, "barra respeita os limites e as áreas seguras");
  checar(estado.larguraDocumento <= aparelho.width + 1 && estado.alturaDocumento <= aparelho.height + 1, "navegação não cria rolagem na página");

  await page.locator(".hda-navbar button").first().click();
  await page.waitForSelector(".hda-sheet", { state: "visible" });
  await page.waitForTimeout(280);
  const painel = await page.evaluate(() => {
    const nav = document.querySelector(".hda-navbar").getBoundingClientRect();
    const sheet = document.querySelector(".hda-sheet").getBoundingClientRect();
    const acoes = [...document.querySelectorAll(".hda-sheet-acoes button")].map((b) => b.getBoundingClientRect().height);
    return { terminaAntesDaBarra: sheet.bottom <= nav.top + 1, alvos: acoes };
  });
  checar(painel.terminaAntesDaBarra, "painel do HUB abre acima da barra persistente");
  checar(painel.alvos.length > 0 && painel.alvos.every((h) => h >= 44), "ações do HUB mantêm toque de 44px");
  checar(erros.length === 0, "nenhum erro de JavaScript", erros.join(" | "));
  await context.close();
}

await browser.close();
if (falhas) process.exitCode = 1;
