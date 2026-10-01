// AS QUATRO CLASSES NOVAS ABREM O JOGO DE VERDADE
//
// Por que existe: `node --check` aceita arquivo que o navegador recusa (uma
// crase dentro de comentário CSS em template literal fecha o literal), e
// nenhum teste de unidade enxerga 404 de arte. Este abre o index.html, cria
// um personagem de cada classe nova, carrega a árvore e roda a luta até o
// fim — o mesmo caminho de quem instalou o jogo.
//
// Uso:  node scripts/test-classes-novas-navegador.mjs  (precisa do servidor
//       estático em HDA_BASE, padrão http://127.0.0.1:8765)
import { chromium } from "playwright";

const BASE = process.env.HDA_BASE || "http://127.0.0.1:8765";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const CLASSES = ["paladino", "bardo", "druida", "necromante", "guerreiro"];

const nav = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const pg = await nav.newPage();
const erros = [];
const faltando = new Set();
pg.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 240)); });
pg.on("pageerror", (e) => erros.push("pageerror: " + String(e).slice(0, 240)));
pg.on("response", (r) => { if (r.status() === 404) faltando.add(new URL(r.url()).pathname); });

await pg.goto(BASE + "/index.html", { waitUntil: "networkidle", timeout: 60000 });

// Os módulos carregaram? Se o boot quebrou, nada disto existe.
const booto = await pg.evaluate(async () => {
  const m = await import("/src/data/loader.js");
  const d = await m.carregarDados();
  return { classes: d.classes.map((c) => c.id), arvores: Object.keys(d).filter((k) => k.startsWith("talents")) };
});

const resultado = [];
for (const classeId of CLASSES) {
  const r = await pg.evaluate(async (classeId) => {
    const L = await import("/src/data/loader.js");
    const F = await import("/src/systems/CharacterFactory.js");
    const C = await import("/src/systems/CombatSystem.js");
    const T = await import("/src/systems/TalentSystem.js");
    const dados = await L.carregarDados();
    const p = F.criarPersonagem({
      nome: "Teste", raca: "humano", classe: classeId, elemento: "fogo",
      antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id,
    }, dados);
    p.nivel = 25; p.pontosTalento = 24;
    const arvore = T.arvoreDoPersonagem(p, dados);
    const comb = C.criarCombatenteJogador(p, dados, "frente");
    const monstro = (dados.monsters.monstros || dados.monsters).find((x) => !x.chefe);
    const inimigo = C.criarCombatenteInimigo(JSON.parse(JSON.stringify(monstro)), 0);
    const b = new C.Batalha([comb], [inimigo], dados.elements, null);
    // Roda o relógio: é aqui que status novos (forma animal, servo,
    // intercessão, regeneração de Éter) são exercitados de verdade.
    let voltas = 0;
    while (comb.vivo && inimigo.vivo && voltas < 300) { b.avancarATB(1); voltas++; }
    return {
      classeId,
      temArvore: !!(arvore && (arvore.nos || arvore.ramos || Object.keys(arvore).length)),
      hpMax: comb.hpMax, mpMax: comb.mpMax,
      habilidades: (comb.habilidades || []).map((h) => h.id),
      velocidade: F.velocidadeTotal(p, dados), voltas, hpFim: comb.hp, inimigoVivo: inimigo.vivo,
    };
  }, classeId).catch((e) => ({ classeId, erro: String(e).slice(0, 200) }));
  resultado.push(r);
}

await nav.close();

console.log("classes carregadas:", booto.classes.join(", "));
console.log("arvores carregadas:", booto.arvores.join(", "));
for (const r of resultado) {
  if (r.erro) console.log(`FALHA ${r.classeId}: ${r.erro}`);
  else console.log(`OK    ${r.classeId}: hp ${r.hpMax} mp ${r.mpMax} vel ${r.velocidade} arvore=${r.temArvore} cards=[${r.habilidades.join(",")}]`);
}
// Dívida antiga, de antes deste trabalho: três props urbanos que nunca
// foram desenhados. Ficam listados para não sumirem do radar, mas não
// reprovam — senão este teste nasce vermelho por culpa de outro assunto.
const DIVIDA_CONHECIDA = ["fonte_urbana", "banca_urbana", "poco_urbano"];
const art404 = [...faltando].filter((p) => /\.(png|jpg|webp)$/i.test(p));
const novos404 = art404.filter((p) => !DIVIDA_CONHECIDA.some((d) => p.includes(d)));
const errosReais = erros.filter((e) => !/Failed to load resource/.test(e));

console.log(`\n404 de arte: ${art404.length} (${novos404.length} fora da dívida conhecida)`);
art404.slice(0, 10).forEach((p) => console.log("  ? " + p));
console.log(`erros de console (fora 404): ${errosReais.length}`);
errosReais.slice(0, 8).forEach((e) => console.log("  ! " + e));

const quebrou = resultado.some((r) => r.erro) || errosReais.length > 0 || novos404.length > 0;
process.exitCode = quebrou ? 1 : 0;
console.log(quebrou ? "\n=== FALHOU ===" : "\n=== passou ===");
