import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://localhost:8765";
let ok = 0;
let falhou = 0;
const checar = (cond, msg, extra = "") => {
  if (cond) { ok += 1; console.log(`  ✓ ${msg}`); }
  else { falhou += 1; console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ""}`); }
};

async function abrirPrologo(page) {
  await page.goto(`${BASE}/index.html?semente=cutscene-ux`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("rpg_pt_save_v1"));
  await page.click("#btn-novo-jogo");
  await page.fill("input[placeholder='Digite um nome...']", "Ari");
  await page.click(".criacao-aleatoria");
  await page.waitForSelector(".criacao-resumo");
  await page.evaluate(() => {
    const painel = document.querySelector(".painel-criacao");
    [...painel.querySelectorAll("button")]
      .find((b) => /Começar aventura|Iniciar|Jogar/i.test(b.textContent || "") && !b.disabled)?.click();
  });
  await page.waitForSelector("#cutscene-camada", { state: "visible", timeout: 15000 });
}

async function medir(page, nome) {
  const m = await page.evaluate(() => {
    const camada = document.querySelector("#cutscene-camada");
    const frente = camada.querySelector(".cutscene-frente");
    const r = frente.getBoundingClientRect();
    const ativo = document.activeElement;
    const progresso = camada.querySelector("[role='progressbar']");
    const botoes = [...camada.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
    return {
      modal: camada.getAttribute("aria-modal"),
      rotulo: camada.getAttribute("aria-labelledby") || camada.getAttribute("aria-label"),
      tituloExiste: camada.hasAttribute("aria-label") || !!document.getElementById(camada.getAttribute("aria-labelledby")),
      focoDentro: camada.contains(ativo),
      progresso: progresso?.getAttribute("aria-valuetext"),
      dentro: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      alvos: botoes.every((b) => {
        const x = b.getBoundingClientRect();
        return x.width >= 44 && x.height >= 36;
      }),
      scrollX: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  checar(m.modal === "true" && m.rotulo && m.tituloExiste, `${nome}: diálogo possui nome acessível e é modal`);
  checar(m.focoDentro, `${nome}: foco inicia preso na cutscene`);
  checar(/^Cena \d+ de \d+$/.test(m.progresso || ""), `${nome}: progresso é anunciado (${m.progresso})`);
  checar(m.dentro && m.scrollX, `${nome}: cena cabe inteira sem rolagem horizontal`);
  checar(m.alvos, `${nome}: controles mantêm alvos de toque legíveis`);
}

const browser = await chromium.launch(opcoesDoNavegador());
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const erros = [];
page.on("pageerror", (erro) => erros.push(erro.message));

await abrirPrologo(page);
await medir(page, "retrato");

await page.keyboard.press("Escape");
checar(await page.locator(".cutscene-confirmar").isVisible(), "Escape abre confirmação sem encerrar a cena");
checar(await page.locator(".cutscene-cancelar").evaluate((el) => document.activeElement === el), "confirmação recebe foco inicial seguro");
checar(await page.locator(".cutscene-corpo").getAttribute("aria-hidden") === "true", "confirmação oculta o conteúdo de fundo para leitores de tela");
await page.keyboard.press("Escape");
checar(!(await page.locator(".cutscene-confirmar").isVisible()), "segundo Escape cancela a saída");
checar(await page.locator("#cutscene-pular").evaluate((el) => document.activeElement === el), "foco volta ao controle que abriu a confirmação");

await page.locator("#cutscene-auto").click();
checar(await page.locator("#cutscene-auto").getAttribute("aria-pressed") === "true", "modo automático expõe seu estado para tecnologia assistiva");
// O primeiro comando durante o fade revela o texto completo por desenho;
// esperamos o painel estabilizar para testar a navegação entre painéis.
await page.waitForTimeout(900);
const antesSeta = await page.locator(".cutscene-contador").textContent();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(350);
checar(await page.locator(".cutscene-contador").textContent() !== antesSeta, "seta direita avança mesmo após um controle receber foco");
await page.locator("#cutscene-auto").click();

await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(250);
await medir(page, "paisagem");

await page.locator("#cutscene-pular").click();
await page.locator(".cutscene-confirmar-pulo").click();
await page.waitForFunction(() => !document.getElementById("cutscene-camada"), null, { timeout: 5000 });
checar(await page.evaluate(() => !document.body.classList.contains("com-cutscene")), "encerramento limpa a camada e devolve o jogo");
checar(erros.length === 0, `nenhum erro de JavaScript (${erros.length})`, erros.join(" | "));

await context.close();
await browser.close();
console.log(`\nResultado: ${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
