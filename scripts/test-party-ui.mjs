// TESTE DA TELA DA PARTY.
//
// O que ela promete e que este teste cobra:
//   1. mostra TODOS os membros do grupo de uma vez, com os 7 slots à vista;
//   2. a mochila é uma só, compartilhada;
//   3. escolher um item mostra uma linha POR MEMBRO com o que muda;
//   4. a comparação traz NÚMERO, não "=" para tudo;
//   5. dá para equipar em qualquer membro sem sair da tela;
//   6. o painel de comparação fica visível sem precisar rolar.
//
// O item 4 é o que a primeira versão errou: eu somava campos (`ataque`,
// `magia`, `hpMax`) que não existem em nenhum item do items.json — todo
// delta dava 0 e a tela dizia "=" até comparando espada com slot vazio. Só
// a captura de tela pegou. Este teste é a trava para não voltar.
//
// Uso: node scripts/test-party-ui.mjs  (servidor em 127.0.0.1:8765)
import { chromium } from "playwright";
import { opcoesDoNavegador } from "./browser-config.mjs";

const BASE = process.env.HDA_BASE || "http://127.0.0.1:8765";

let ok = 0; let falhou = 0;
const ver = (nome, cond, det = "") => {
  if (cond) { ok += 1; console.log(`  ✓ ${nome}`); } else {
    falhou += 1; console.log(`  ✗ ${nome}${det ? ` — ${det}` : ""}`);
  }
};

const browser = await chromium.launch(opcoesDoNavegador());

for (const vp of [{ nome: "desktop", width: 1440, height: 900 }, { nome: "celular", width: 390, height: 844 }]) {
  console.log(`\n── ${vp.nome} (${vp.width}×${vp.height})`);
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errosJs = [];
  page.on("pageerror", (e) => errosJs.push(e.message));

  await page.goto(`${BASE}/index.html?semente=2055586687`, { waitUntil: "networkidle" });
  await page.waitForSelector("#btn-novo-jogo", { timeout: 20000 });
  await page.evaluate(() => localStorage.removeItem("rpg_pt_save_v1"));
  await page.click("#btn-novo-jogo");
  await page.waitForTimeout(400);
  await page.fill("input[placeholder='Digite um nome...']", "Herdeira");
  for (let i = 0; i < 15; i += 1) {
    const fim = await page.evaluate(() => {
      const pa = document.querySelector(".painel-criacao");
      if (!pa || !pa.offsetParent) return true;
      const c = pa.querySelector(".opcao-card"); if (c) c.click();
      const a = [...pa.querySelectorAll("button")]
        .find((x) => /Avançar|Começar|Iniciar|Jogar/i.test(x.textContent || "") && !x.disabled);
      if (a) a.click(); return false;
    });
    if (fim) break;
    await page.waitForTimeout(320);
  }
  await page.waitForFunction(() => {
    const d = window.HDA_MUNDO ? window.HDA_MUNDO() : null;
    return !!(d && d.chunksCarregados && d.chunksCarregados !== "—");
  }, { timeout: 20000 });

  // Grupo de 3 (principal + 2 convocados) e algumas armas na mochila.
  const preparo = await page.evaluate(async () => {
    const gs = await import("./src/systems/GachaSystem.js");
    const inv = await import("./src/systems/InventorySystem.js");
    const ld = await import("./src/data/loader.js");
    const dados = await ld.carregarDados();
    const pers = window.HDA_PERSONAGEM();
    pers.gacha.fragmentos = 100000;
    for (let i = 0; i < 4; i += 1) gs.invocarPermanente(pers, dados.gachaRoster, dados);
    pers.gacha.timeAtivo = pers.gacha.personagensObtidos.slice(0, 2).map((c) => c.uid);
    const armas = dados.items.itens.filter((i) => i.tipo === "arma").slice(0, 6);
    armas.forEach((i, n) => pers.inventario.push({ ...i, uid: `t${n}` }));
    inv.equiparItem(pers, "t0", pers); // arma fraca no principal
    return { membros: 1 + gs.membrosDoTime(pers).length, itens: pers.inventario.length };
  });

  await page.keyboard.press("y");
  await page.waitForTimeout(900);

  const tela = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".party-card")];
    const det = document.querySelector(".party-detalhe");
    return {
      cards: cards.length,
      slots: document.querySelectorAll(".party-slot").length,
      itens: document.querySelectorAll(".hda-ladrilho").length,
      temBusca: !!document.querySelector(".party-busca"),
      temFiltros: document.querySelectorAll(".party-cat").length,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      detalheEscondido: !det || !det.classList.contains("visivel"),
    };
  });

  ver(`mostra os ${preparo.membros} membros do grupo`, tela.cards === preparo.membros,
    `${tela.cards} cartões`);
  ver("com os 7 slots de cada um à vista", tela.slots === tela.cards * 7,
    `${tela.slots} slots para ${tela.cards} membros`);
  ver("a mochila compartilhada aparece", tela.itens > 0, `${tela.itens} pilhas`);
  ver("tem busca e filtros por categoria", tela.temBusca && tela.temFiltros >= 5,
    `busca:${tela.temBusca} filtros:${tela.temFiltros}`);
  ver("o painel de comparação começa fechado", tela.detalheEscondido);
  ver("sem rolagem horizontal", !tela.overflowX);

  // --- escolher um item abre a comparação POR MEMBRO ----------------------
  await page.evaluate(() => { const l = [...document.querySelectorAll(".hda-ladrilho")].pop(); if (l) l.click(); });
  await page.waitForTimeout(450);

  const comp = await page.evaluate(() => {
    const det = document.querySelector(".party-detalhe");
    const linhas = [...document.querySelectorAll(".party-linha-membro")];
    const r = det ? det.getBoundingClientRect() : null;
    return {
      visivel: !!det && det.classList.contains("visivel"),
      dentroDaTela: !!r && r.top < window.innerHeight && r.bottom > 0,
      linhas: linhas.length,
      botoes: document.querySelectorAll(".party-btn-equipar").length,
      textos: linhas.map((l) => l.innerText.replace(/\s+/g, " ").trim()),
      // Um delta de verdade tem sinal e número: "+7", "-2". "=" em TODAS as
      // linhas é o sintoma do bug que este teste guarda.
      comNumero: linhas.filter((l) => /[+\-−]\d/.test(l.innerText)).length,
    };
  });

  ver("escolher um item abre a comparação", comp.visivel);
  ver("e ela fica visível sem rolar", comp.dentroDaTela);
  ver(`uma linha por membro (${preparo.membros})`, comp.linhas === preparo.membros,
    `${comp.linhas} linhas`);
  ver("cada linha tem botão de equipar", comp.botoes === preparo.membros,
    `${comp.botoes} botões`);
  ver("a comparação mostra NÚMERO, não '=' em tudo", comp.comNumero > 0,
    comp.textos.join(" / "));

  // --- equipar num convocado, sem sair da tela ----------------------------
  const antes = await page.evaluate(() => {
    const gs = window.HDA_PERSONAGEM().gacha;
    const m = gs.personagensObtidos.find((c) => gs.timeAtivo.includes(c.uid));
    return { nome: m.nome, arma: m.equipamento && m.equipamento.arma ? m.equipamento.arma.nome : null };
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".party-btn-equipar")][1];
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const depois = await page.evaluate(() => {
    const gs = window.HDA_PERSONAGEM().gacha;
    const m = gs.personagensObtidos.find((c) => gs.timeAtivo.includes(c.uid));
    return {
      arma: m.equipamento && m.equipamento.arma ? m.equipamento.arma.nome : null,
      telaAberta: !!document.querySelector(".party-fileira"),
    };
  });
  ver(`equipou no convocado (${antes.nome}) direto da tela`,
    depois.arma && depois.arma !== antes.arma, `${antes.arma} → ${depois.arma}`);
  ver("e a tela continua aberta depois de equipar", depois.telaAberta);

  // --- busca filtra ------------------------------------------------------
  // O termo NÃO pode ser fixo: o que sobra na mochila depende do que os
  // passos acima equiparam. Duas tentativas fixas já falharam por isso
  // ("machado" tinha acabado de sair da mochila; "espada" casava com tudo
  // o que restou). Aqui o termo sai do PRÓPRIO nome de um item visível, e
  // a asserção é sobre o comportamento: encontra aquele item, e um termo
  // impossível não encontra nada.
  const totalAntes = await page.evaluate(() => document.querySelectorAll(".hda-ladrilho").length);
  const alvoBusca = await page.evaluate(() => {
    const el = document.querySelector(".hda-ladrilho .hda-ladrilho-nome");
    // Última palavra do nome: distingue "Espada Élfica" de "Espada de Ferro".
    return el ? el.textContent.trim().split(/\s+/).pop() : "";
  });
  await page.fill(".party-busca", alvoBusca);
  await page.waitForTimeout(400);
  const comTermo = await page.evaluate(() => document.querySelectorAll(".hda-ladrilho").length);
  ver(`a busca encontra o item procurado ("${alvoBusca}")`,
    comTermo >= 1 && comTermo <= totalAntes, `${totalAntes} → ${comTermo}`);

  await page.fill(".party-busca", "zzzznaoexiste");
  await page.waitForTimeout(400);
  const semNada = await page.evaluate(() => ({
    ladrilhos: document.querySelectorAll(".hda-ladrilho").length,
    avisou: /nada na mochila/i.test(document.querySelector(".party-mochila").innerText || ""),
  }));
  ver("busca sem resultado esvazia a grade e avisa",
    semNada.ladrilhos === 0 && semNada.avisou, JSON.stringify(semNada));

  const focoMantido = await page.evaluate(() => document.activeElement
    && document.activeElement.classList.contains("party-busca"));
  ver("e o cursor não sai do campo de busca ao digitar", focoMantido);

  ver("nenhum erro de JavaScript", errosJs.length === 0, errosJs[0] || "");

  await page.screenshot({ path: `party-${vp.nome}.png` });
  await page.close();
}

await browser.close();
console.log(`\n${"─".repeat(60)}`);
console.log(`Resultado: ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
