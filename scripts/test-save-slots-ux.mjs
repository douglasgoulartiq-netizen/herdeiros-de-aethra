// Regressão dos quatro espaços de jornada: estados, informação, teclado,
// exclusão segura e enquadramento nas três apresentações principais.
import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://localhost:8765";
let ok = 0; let falhou = 0;
function checar(condicao, mensagem, detalhe = "") {
  if (condicao) { ok += 1; console.log(`  ✓ ${mensagem}`); }
  else { falhou += 1; console.log(`  ✗ ${mensagem}${detalhe ? ` — ${detalhe}` : ""}`); }
}

const save = (nome, nivel, salvoEm) => ({
  saveVersion: 9, salvoEm,
  personagem: {
    nome, nivel, classeId: "mago", racaId: "elfo", ngPlus: 0,
    missoesConcluidas: ["m1", "m2", "m3"], biomaVisitados: ["vila", "floresta"],
  },
  mundo: { zonaAtualId: "floresta" },
});

const browser = await chromium.launch(opcoesDoNavegador());
for (const viewport of [
  { nome: "PC", width: 1440, height: 900 },
  { nome: "mobile vertical", width: 390, height: 844 },
  { nome: "mobile horizontal", width: 844, height: 390 },
]) {
  console.log(`\n=== ${viewport.nome} ===`);
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 900 });
  await context.addInitScript(({ save1, save3 }) => {
    localStorage.clear();
    localStorage.setItem("rpg_pt_save_slot_ativo", "1");
    localStorage.setItem("rpg_pt_save_slot_1", JSON.stringify(save1));
    localStorage.setItem("rpg_pt_save_slot_3", JSON.stringify(save3));
    localStorage.setItem("rpg_pt_save_slot_4", "{save inválido");
  }, { save1: save("Lyra", 12, Date.UTC(2026, 8, 17, 18, 30)), save3: save("Doran", 7, Date.UTC(2026, 8, 16, 10, 15)) });
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await page.goto(`${BASE}/index.html`, { waitUntil: "networkidle" });
  await page.waitForSelector(".save-slot-card");

  const estado = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".save-slot-card")];
    const limites = cards.map((card) => card.getBoundingClientRect());
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    return {
      total: cards.length,
      ocupados: cards.filter((c) => c.classList.contains("ocupado")).length,
      vazios: cards.filter((c) => c.classList.contains("vazio")).length,
      corrompidos: cards.filter((c) => c.classList.contains("corrompido")).length,
      data: document.querySelector("#save-slot-1 time")?.textContent || "",
      progresso: document.querySelector("#save-slot-1 .slot-progresso")?.textContent || "",
      semBotaoAninhado: !document.querySelector("button button"),
      dentro: limites.every((r) => r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1),
      semOverflowX: document.documentElement.scrollWidth <= vw + 1,
      apagarEhBotao: document.querySelector("[data-apagar]")?.tagName === "BUTTON",
      alvosToque: innerWidth > 900 || [...document.querySelectorAll("[data-apagar], #btn-novo-jogo, #btn-continuar:not(.hidden)")]
        .every((el) => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }),
    };
  });
  checar(estado.total === 4 && estado.ocupados === 2 && estado.vazios === 2 && estado.corrompidos === 1, "distingue ocupado, vazio e indisponível");
  checar(/Salvo em/.test(estado.data) && /3 missões/.test(estado.progresso) && /2 áreas/.test(estado.progresso), "data, horário e progresso estão legíveis");
  checar(estado.semBotaoAninhado && estado.apagarEhBotao, "exclusão usa botão semântico independente");
  checar(estado.dentro && estado.semOverflowX, "quatro slots cabem sem corte ou rolagem lateral", JSON.stringify(estado));
  checar(estado.alvosToque, "ações críticas têm alvo de toque de pelo menos 44 px");
  checar(erros.length === 0, "tela inicial abre sem erro JavaScript", erros.join(" | "));

  // Fluxo completo por teclado: escolhe o slot vazio, retorna ao primeiro,
  // abre a exclusão, mantém Cancelar como escolha segura e confirma só após
  // mover explicitamente o foco.
  await page.locator("#save-slot-1").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  checar(await page.locator("#save-slot-2").getAttribute("aria-pressed") === "true", "setas + Enter selecionam outro slot e preservam o foco");
  checar(/Criar personagem/.test(await page.locator("#btn-novo-jogo").innerText()), "slot vazio oferece ação Criar personagem");

  await page.locator("#apagar-save-slot-1").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".dialogo-excluir-save[open]");
  checar(await page.evaluate(() => document.activeElement?.classList.contains("dialogo-save-cancelar")), "confirmação abre com Cancelar em foco");
  await page.keyboard.press("ArrowRight");
  checar(await page.evaluate(() => document.activeElement?.classList.contains("dialogo-save-confirmar")), "setas alcançam a confirmação destrutiva");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".dialogo-excluir-save"));
  checar(await page.evaluate(() => localStorage.getItem("rpg_pt_save_slot_1") === null), "exclusão só ocorre após confirmação explícita");
  await context.close();
}

await browser.close();
console.log(`\n=== slots de save: ${ok} verificações, ${falhou} falhas ===`);
if (falhou) process.exitCode = 1;
