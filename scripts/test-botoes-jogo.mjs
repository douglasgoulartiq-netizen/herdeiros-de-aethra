// Exercita a navegação real durante uma partida efêmera, sem tocar em saves
// do usuário. Uso: HDA_BASE=http://127.0.0.1:8767 node scripts/test-botoes-jogo.mjs
import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://127.0.0.1:8767";
const mobile = process.env.HDA_MOBILE === "1" && process.env.HDA_HORIZONTAL !== "1";
const horizontal = process.env.HDA_HORIZONTAL === "1";
const browser = await chromium.launch(opcoesDoNavegador());
const page = await browser.newPage({ viewport: horizontal ? { width: 844, height: 390 }
  : mobile ? { width: 390, height: 844 } : { width: 1366, height: 768 } });
const erros = [];
page.on("pageerror", (erro) => erros.push(erro.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !/favicon/.test(r.url())) erros.push(`${r.status()} ${r.url()}`);
});
await page.goto(`${BASE}/index.html?semente=teste-botoes`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#hud-buttons button[data-hub]", { state: "attached", timeout: 60000 });

await page.evaluate(async () => {
  const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
  document.getElementById("btn-novo-jogo").click();
  await dormir(200);
  document.querySelector(".criacao-inicio")?.click();
  await dormir(100);
  document.querySelector(".criacao-aleatoria")?.click();
  await dormir(100);
  document.querySelector(".criacao-continuar")?.click();
  for (let i = 0; i < 45; i += 1) {
    if (document.querySelector(".cutscene")) {
      document.querySelector("#cutscene-pular")?.click();
      document.querySelector(".cutscene-confirmar-pulo")?.click();
    }
    if (document.querySelector("#tutorial-inicial, .tutorial")) {
      const pular = [...document.querySelectorAll(".tutorial button")]
        .find((b) => /pular|mais tarde/i.test(b.textContent));
      pular?.click();
    }
    if (!document.getElementById("hud")?.classList.contains("hidden")
      && !document.querySelector(".cutscene, .tutorial")) break;
    await dormir(240);
  }
});

const estadoInicial = await page.evaluate(() => ({
  hud: document.getElementById("hud")?.className,
  criacao: document.querySelector(".painel-criacao")?.textContent?.slice(0, 250),
  cutscene: !!document.querySelector(".cutscene"),
  tutorial: !!document.querySelector(".tutorial"),
}));
console.log("Estado após criação:", JSON.stringify(estadoInicial));
await page.waitForFunction(() => !document.getElementById("hud")?.classList.contains("hidden")
  && !document.querySelector(".cutscene, .tutorial"), null, { timeout: 20000 });

const resultados = [];
for (const hub of ["personagem", "jornada", "invocar", "mais"]) {
  const botaoHub = page.locator(`#hud-hub-${hub}`);
  const abrirHub = async () => {
    if (mobile) await page.locator(`.hda-navbar button[data-destino='${hub}']`).click();
    else await botaoHub.click();
  };
  await abrirHub();
  const abriu = mobile ? await page.locator(".hda-sheet").isVisible()
    : await botaoHub.getAttribute("aria-expanded") === "true";
  resultados.push({ botao: hub, abriu });
  const acoes = await page.locator(`#hud-painel-${hub} button[data-action]`)
    .evaluateAll((botoes) => botoes.map((b) => b.dataset.action));
  for (const [indice, acao] of acoes.entries()) {
    if (mobile) {
      if (!await page.locator(".hda-sheet").count()) await abrirHub();
    } else if (await botaoHub.getAttribute("aria-expanded") !== "true") await abrirHub();
    const inicio = Date.now();
    if (mobile) await page.locator(".hda-sheet-acoes button").nth(indice).click();
    else await page.locator(`#hud-painel-${hub} button[data-action='${acao}']`).click();
    await page.waitForTimeout(120);
    const estado = await page.evaluate(() => ({
      modal: !document.getElementById("modal-overlay").classList.contains("hidden"),
      sheet: !!document.querySelector(".hda-sheet"),
      tutorial: !!document.querySelector(".tutorial"),
    }));
    const informativa = !["salvar", "descansar", "sair_masmorra"].includes(acao);
    resultados.push({ botao: acao, abriu: !informativa || estado.modal || estado.sheet || estado.tutorial,
      ms: Date.now() - inicio, estado });
    if (estado.modal) {
      const abas = await page.locator("#modal-conteudo .hda-tabs [role='tab']")
        .evaluateAll((elementos) => elementos.map((b) => b.dataset.abaId));
      for (const aba of abas.slice(1, 8)) {
        const alvo = page.locator(`#modal-conteudo .hda-tabs [role='tab'][data-aba-id='${aba}']`).first();
        if (!await alvo.count()) continue;
        const seletor = page.locator("#modal-conteudo .hda-tabs-select").first();
        if (await alvo.isVisible()) await alvo.click();
        else if (await seletor.isVisible()) await seletor.selectOption(aba);
        else throw new Error(`Aba ${acao}/${aba} sem controle visível`);
        const navegou = aba === "evolucao"
          ? await page.locator(".progressao-heroi-nav").count() > 0
          : aba === "historico"
            ? await page.locator("#hda-modal-titulo").textContent() === "Histórico de invocações"
            : await alvo.getAttribute("aria-selected") === "true";
        resultados.push({ botao: `${acao}/${aba}`, abriu: navegou });
      }
    }
    await page.keyboard.press("Escape");
    if (estado.tutorial) {
      await page.locator(".tutorial button").filter({ hasText: /pular|mais tarde/i }).first().click().catch(() => {});
    }
  }
}

// Real buttons in the unified workspaces, not just sidebar entry points.
for (const [entrada, sequencia] of [
  ["mapa", ["viagem", "atlas", "missoes", "diario", "arquivo_missoes", "compendio", "mapa"]],
  ["equipamento", []],
  ["gacha", ["historico", "gacha", "colecao"]],
]) {
  await page.evaluate((acao) => document.dispatchEvent(new CustomEvent("hda-navegar", { detail: acao })), entrada);
  for (const acao of sequencia) {
    await page.locator(`[data-workspace-action="${acao}"]`).first().click();
    resultados.push({ botao: `workspace/${acao}`, abriu: await page.locator("#modal-overlay").isVisible() });
  }
  resultados.push({ botao: `${entrada}/sem-overflow`, abriu: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) });
  await page.keyboard.press("Escape");
}
await page.evaluate(() => document.dispatchEvent(new CustomEvent("hda-navegar", { detail: "equipamento" })));
await page.locator(".party-busca").fill("poção");
await page.getByRole("button", { name: "Forja e Alquimia", exact: true }).click();
await page.locator('[data-workspace-action="equipamento"]').first().click();
resultados.push({ botao: "forja/retorno", abriu: await page.locator(".companhia-equipamento").count() === 1 });
resultados.push({ botao: "equipamento/preserva-busca", abriu: await page.locator(".party-busca").inputValue() === "poção" });
await page.locator(".party-busca").fill("");
await page.screenshot({ path: `test-unificacao-${horizontal ? "horizontal" : mobile ? "mobile" : "desktop"}.png` });
await page.evaluate(() => document.dispatchEvent(new CustomEvent("hda-navegar", { detail: "colecao" })));
await page.getByRole("button", { name: "Companheiros", exact: true }).click();
resultados.push({ botao: "companhia/pets", abriu: await page.locator("#pets-grade").count() === 1 });
await page.getByRole("button", { name: "Formação", exact: true }).click();
resultados.push({ botao: "pets/retorno-formacao", abriu: await page.locator(".companhia-formacao").count() === 1 });
console.log(JSON.stringify({ resultados, erros }, null, 2));
await browser.close();
if (erros.length || resultados.some((r) => !r.abriu)) process.exitCode = 1;
