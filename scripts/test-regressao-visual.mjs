// Matriz leve de regressao visual. Mede o jogo real em tres formatos sem
// versionar screenshots: geometria, overflow, colisoes, foco e erros JS.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AMOSTRA = process.argv.includes("--sample");
const LIMITE_GLOBAL_MS = AMOSTRA ? 90_000 : 300_000;
const vigia = setTimeout(() => {
  console.error(`\nFALHA regressao visual excedeu ${LIMITE_GLOBAL_MS / 1000}s e foi encerrada para nao bloquear o gate.`);
  process.exit(124);
}, LIMITE_GLOBAL_MS);
const FORMATOS = [
  { id: "desktop", width: 1440, height: 900, mobile: false },
  { id: "mobile-retrato", width: 390, height: 844, mobile: true },
  { id: "mobile-paisagem", width: 844, height: 390, mobile: true },
];
const CENAS = [
  { id: "entrada-saves", grupo: "entrada", raiz: "#screen-boot", critico: ".save-slot-card" },
  { id: "criacao", grupo: "criacao", raiz: "#screen-criacao", critico: ".painel-criacao" },
  { id: "exploracao-hud", grupo: "nucleo", raiz: "#hud", critico: "#hud-bars" },
  { id: "companhia", grupo: "nucleo", raiz: "#modal-conteudo", critico: ".companhia-corpo" },
  { id: "missoes", grupo: "nucleo", raiz: "#modal-conteudo", critico: ".hda-modal-corpo, #modal-corpo" },
  { id: "caminho", grupo: "nucleo", raiz: "#modal-conteudo", critico: "#caminho-viewport-wrap" },
  { id: "gacha", grupo: "nucleo", raiz: "#modal-conteudo", critico: "#gacha-saldo" },
  { id: "batalha", grupo: "nucleo", raiz: "#screen-batalha", critico: "#bt-field" },
  { id: "tutorial", grupo: "tutorial", raiz: "#tutorial-camada", critico: ".tutorial-corpo" },
  { id: "cutscene", grupo: "cutscene", raiz: "#cutscene-camada", critico: ".cutscene-frente" },
];
const CENAS_ATIVAS = AMOSTRA
  ? CENAS.filter((c) => ["entrada-saves", "companhia", "batalha", "tutorial"].includes(c.id))
  : CENAS;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
function servidorLocal() {
  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const relativo = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^[/\\]+/, "");
      const arquivo = path.resolve(RAIZ, relativo);
      if (!arquivo.startsWith(RAIZ)) throw new Error("fora da raiz");
      const conteudo = await readFile(arquivo);
      res.writeHead(200, { "Content-Type": `${MIME[path.extname(arquivo).toLowerCase()] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" });
      res.end(conteudo);
    } catch {
      res.writeHead(404).end("nao encontrado");
    }
  });
  return new Promise((resolve) => servidor.listen(0, "127.0.0.1", () => resolve({ servidor, base: `http://127.0.0.1:${servidor.address().port}` })));
}

async function paginaNova(context, base) {
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    // O navegador escreve 404 de sprite opcional como console.error, mas
    // isso nao e excecao JS. A matriz tem um assert separado de pageerror e
    // nao deve transformar fallback de arte em falso positivo de runtime.
    if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) erros.push(`console: ${m.text()}`);
  });
  await page.goto(`${base}/index.html?semente=regressao-visual`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".save-slot-card", { timeout: 30000 });
  return { page, erros };
}

async function instalarNucleo(page) {
  await page.evaluate(async () => {
    const [{ carregarDados }, fabrica, GameUI, party, gacha, caminho, batalha, gachaSys] = await Promise.all([
      import("./src/data/loader.js"), import("./src/systems/CharacterFactory.js"), import("./src/ui/GameUI.js"),
      import("./src/ui/PartyUI.js"), import("./src/ui/GachaUI.js"), import("./src/ui/TalentTreeUI.js"),
      import("./src/ui/BattleUI.js"), import("./src/systems/GachaSystem.js"),
    ]);
    const dados = await carregarDados();
    const personagem = fabrica.criarPersonagem({ nome: "Ari", raca: dados.races[0].id, classe: dados.classes[0].id, antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
    personagem.ouro = 2500;
    personagem.inventario = dados.items.itens.slice(0, 10).map((i) => ({ ...i, uid: fabrica.cryptoId() }));
    gachaSys.adicionarFragmentos(personagem, 5000);
    const limpar = () => {
      GameUI.fecharModal();
      document.querySelectorAll(".tela").forEach((e) => e.classList.add("hidden"));
      document.getElementById("screen-batalha").innerHTML = "";
      document.getElementById("hud")?.classList.add("hidden");
      document.body.classList.remove("em-batalha");
      document.getElementById("app")?.classList.remove("em-batalha");
    };
    window.__VR_ABRIR__ = (id) => {
      limpar();
      if (id === "exploracao-hud") {
        document.getElementById("hud").classList.remove("hidden");
        GameUI.atualizarHUD(personagem);
      } else if (id === "companhia") {
        party.montarParty(personagem, [personagem, ...gachaSys.membrosDoTime(personagem)], dados, () => {});
      } else if (id === "missoes") {
        GameUI.montarMissoes(personagem, dados);
      } else if (id === "caminho") {
        caminho.montarCaminhoHerdeiro(personagem, dados, () => {});
      } else if (id === "gacha") {
        gacha.montarGacha(personagem, dados, () => {});
      } else if (id === "batalha") {
        const tela = document.getElementById("screen-batalha");
        tela.classList.remove("hidden");
        const chefe = dados.monsters.find((m) => m.chefe) || dados.monsters[0];
        const comum = dados.monsters.find((m) => !m.chefe) || dados.monsters[0];
        batalha.iniciarBatalha(tela, {}, dados, personagem, [], [chefe, comum], "terra", "ar", null, [], () => {}, { zonaId: "floresta", zonaNome: "Floresta Antiga", tile: 3 });
      }
    };
  });
}

async function abrirEspecial(page, id) {
  if (id === "tutorial") {
    await page.evaluate(async () => {
      const [{ carregarDados }, { criarPersonagem }, { abrirTutorialInicial }] = await Promise.all([import("./src/data/loader.js"), import("./src/systems/CharacterFactory.js"), import("./src/ui/TutorialUI.js")]);
      const dados = await carregarDados();
      const p = criarPersonagem({ nome: "Ari", raca: dados.races[0].id, classe: dados.classes[0].id, antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
      abrirTutorialInicial(p, dados, { oferecer: false });
    });
    await page.waitForSelector("#tutorial-camada", { state: "visible" });
  } else if (id === "cutscene") {
    await page.evaluate(async () => {
      const [{ carregarDados }, { criarPersonagem }, { reproduzirCutscene }, { cutscenePorId }] = await Promise.all([import("./src/data/loader.js"), import("./src/systems/CharacterFactory.js"), import("./src/ui/CutsceneUI.js"), import("./src/systems/CutsceneSystem.js")]);
      const dados = await carregarDados();
      const p = criarPersonagem({ nome: "Ari", raca: dados.races[0].id, classe: dados.classes[0].id, antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
      reproduzirCutscene(cutscenePorId("prologo"), p, dados);
    });
    await page.waitForSelector("#cutscene-camada", { state: "visible" });
  }
}

async function medir(page, cena) {
  return page.evaluate(({ raizSel, criticoSel }) => {
    const visivel = (el) => !!el && !el.closest(".hidden") && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 0;
    const raiz = document.querySelector(raizSel);
    const critico = document.querySelector(criticoSel);
    const vw = document.documentElement.clientWidth; const vh = document.documentElement.clientHeight;
    const rr = raiz?.getBoundingClientRect(); const rc = critico?.getBoundingClientRect();
    const dentro = (r) => !!r && r.left >= -2 && r.right <= vw + 2 && r.top >= -2 && r.bottom <= vh + 2;
    const filhos = raiz ? [...raiz.children].filter((el) => {
      if (!visivel(el) || el.getAttribute("aria-hidden") === "true") return false;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return !["absolute", "fixed"].includes(cs.position) && r.width * r.height > 500;
    }) : [];
    const colisoes = [];
    for (let i = 0; i < filhos.length; i += 1) for (let j = i + 1; j < filhos.length; j += 1) {
      const a = filhos[i].getBoundingClientRect(); const b = filhos[j].getBoundingClientRect();
      const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (ix * iy > 24) colisoes.push(`${filhos[i].className || filhos[i].id} × ${filhos[j].className || filhos[j].id}`);
    }
    const focaveis = raiz ? [...raiz.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")].filter(visivel) : [];
    const alvo = focaveis[0]; alvo?.focus();
    const rf = alvo?.getBoundingClientRect();
    return {
      raizExiste: visivel(raiz), criticoExiste: visivel(critico),
      semOverflowX: document.documentElement.scrollWidth <= vw + 2 && document.body.scrollWidth <= vw + 2,
      raizDentro: dentro(rr), criticoIntersecta: !!rc && rc.right > 0 && rc.left < vw && rc.bottom > 0 && rc.top < vh,
      colisoes, focoOk: !!alvo && document.activeElement === alvo && !!rf && rf.right > 0 && rf.left < vw && rf.bottom > 0 && rf.top < vh,
      foco: alvo?.id || alvo?.className || alvo?.tagName || "nenhum",
    };
  }, { raizSel: cena.raiz, criticoSel: cena.critico });
}

const { servidor, base } = await servidorLocal();
const browser = await chromium.launch(opcoesDoNavegador());
const resultados = [];
try {
  for (const formato of FORMATOS) {
    const context = await browser.newContext({ viewport: { width: formato.width, height: formato.height }, isMobile: formato.mobile, hasTouch: formato.mobile, deviceScaleFactor: 1 });
    await context.addInitScript(() => localStorage.clear());
    let nucleo = null;
    for (const cena of CENAS_ATIVAS) {
      let pagina;
      if (cena.grupo === "nucleo") {
        if (!nucleo) { nucleo = await paginaNova(context, base); await instalarNucleo(nucleo.page); }
        pagina = nucleo;
        await pagina.page.evaluate((id) => window.__VR_ABRIR__(id), cena.id);
        await pagina.page.waitForTimeout(cena.id === "batalha" ? 500 : 140);
      } else {
        pagina = await paginaNova(context, base);
        if (cena.id === "criacao") { await pagina.page.click("#btn-novo-jogo"); await pagina.page.waitForSelector(".painel-criacao"); }
        else if (["tutorial", "cutscene"].includes(cena.id)) await abrirEspecial(pagina.page, cena.id);
      }
      const medida = await medir(pagina.page, cena);
      const erros = [...pagina.erros]; pagina.erros.length = 0;
      const falhas = [
        !medida.raizExiste && "raiz ausente", !medida.criticoExiste && "conteudo critico ausente",
        !medida.semOverflowX && "overflow horizontal", !medida.raizDentro && "raiz cortada",
        !medida.criticoIntersecta && "conteudo critico fora da viewport", medida.colisoes.length && `sobreposicao: ${medida.colisoes.join(", ")}`,
        !medida.focoOk && `foco invalido (${medida.foco})`, erros.length && `erro JS: ${erros.join(" | ")}`,
      ].filter(Boolean);
      resultados.push({ formato: formato.id, cena: cena.id, passou: !falhas.length, falhas });
      if (pagina !== nucleo) await pagina.page.close();
    }
    if (nucleo) await nucleo.page.close();
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => servidor.close(resolve));
}

for (const r of resultados) console.log(`${r.passou ? "OK" : "FALHA"} ${r.formato.padEnd(16)} ${r.cena}${r.falhas.length ? ` — ${r.falhas.join("; ")}` : ""}`);
const falhas = resultados.filter((r) => !r.passou);
console.log(`\nRegressao visual: ${resultados.length - falhas.length}/${resultados.length} combinacoes aprovadas${AMOSTRA ? " (amostra)" : ""}.`);
clearTimeout(vigia);
process.exitCode = falhas.length ? 1 : 0;
