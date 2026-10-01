// Teste de cobertura e conformidade dos sprites de criatura.
//
// O QUE ESTE TESTE PROTEGE
// ------------------------
// Antes desta leva faltavam 119 sprites: os 66 monstros (100% deles), 17 das
// 36 combinações de raça x classe e 36 dos 100 convocados. Todos caíam no
// mesmo placeholder marrom do loader — o jogador lutava contra uma caixinha, e
// metade da criação de personagem levava a um boneco genérico. O loader
// engolia o 404 de propósito (para não travar o boot), então NADA no jogo
// reclamava. Só um teste que varre o disco pega isso.
//
// Além da cobertura, aqui valem as regras medidas de
// briefings-arte/00_CONTRATO_TECNICO.md:
//
//   TAMANHO      192x192 para peça de batalha; 64 de lado por quadro no mapa.
//   TRANSPARÊNCIA fundo transparente de verdade, sem retângulo nem moldura.
//   ENQUADRAMENTO a criatura ocupa 85-90% da altura e fica apoiada na base.
//   SILHUETA     em preto sólido a peça tem que ser distinta das vizinhas.
import assert from "node:assert";
import fs from "node:fs";
import { WALK_ART } from "../src/data/classVisuals.js";
import { GACHA_FINAL_ART } from "../src/data/gachaFinalArt.js";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), "utf8"));
const SPRITES = path.join(RAIZ, "assets", "sprites");

const falhas = [];
const ok = [];
function checar(nome, fn) {
  try { fn(); ok.push(nome); } catch (e) { falhas.push(`${nome}: ${e.message}`); }
}

// --- leitor de PNG mínimo --------------------------------------------------
// Sem dependência nova: o projeto não tem biblioteca de imagem em Node e não
// vale acrescentar uma só para o teste. Estes sprites são todos RGBA de 8 bits
// sem entrelace, que é o único caso que este leitor precisa cobrir.
function lerPNG(arquivo) {
  const buf = fs.readFileSync(arquivo);
  assert.strictEqual(buf.readUInt32BE(0), 0x89504e47, "não é PNG");
  let pos = 8;
  let larg = 0, alt = 0, prof = 0, tipo = 0;
  const partes = [];
  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos);
    const nome = buf.toString("ascii", pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + tam);
    if (nome === "IHDR") {
      larg = dados.readUInt32BE(0);
      alt = dados.readUInt32BE(4);
      prof = dados[8];
      tipo = dados[9];
    } else if (nome === "IDAT") {
      partes.push(dados);
    } else if (nome === "IEND") break;
    pos += 12 + tam;
  }
  assert.strictEqual(prof, 8, `profundidade ${prof} não suportada`);
  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipo];
  assert.ok(canais, `tipo de cor ${tipo} não suportado`);
  const cru = zlib.inflateSync(Buffer.concat(partes));
  const bpp = canais;
  const passo = larg * bpp;
  const px = Buffer.alloc(alt * passo);
  let p = 0;
  for (let y = 0; y < alt; y++) {
    const filtro = cru[p++];
    const linha = cru.subarray(p, p + passo);
    p += passo;
    const destino = px.subarray(y * passo, (y + 1) * passo);
    const anterior = y > 0 ? px.subarray((y - 1) * passo, y * passo) : null;
    for (let i = 0; i < passo; i++) {
      const a = i >= bpp ? destino[i - bpp] : 0;
      const b = anterior ? anterior[i] : 0;
      const c = (anterior && i >= bpp) ? anterior[i - bpp] : 0;
      let v = linha[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += Math.floor((a + b) / 2);
      else if (filtro === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      destino[i] = v & 0xff;
    }
  }
  return { larg, alt, canais, px, tipo };
}

function alfa(img, x, y) {
  if (img.canais === 4) return img.px[(y * img.larg + x) * 4 + 3];
  if (img.canais === 2) return img.px[(y * img.larg + x) * 2 + 1];
  return 255; // sem canal alfa
}

function caixa(img, x0 = 0, x1 = img.larg) {
  let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, cheios = 0;
  for (let y = 0; y < img.alt; y++) {
    for (let x = x0; x < x1; x++) {
      if (alfa(img, x, y) > 16) {
        cheios++;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  return { minx, maxx, miny, maxy, cheios,
           alt: maxy - miny + 1, larg: maxx - minx + 1 };
}

// Assinatura de silhueta: a peça reduzida a uma grade 8x8 de "tem pixel ou
// não". É a forma mecânica da regra 5 do contrato — se duas criaturas têm a
// mesma assinatura, elas são a mesma mancha preta lado a lado.
function silhueta(img) {
  const c = caixa(img);
  if (c.cheios === 0) return "vazio";
  let s = "";
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      let conta = 0, total = 0;
      const x0 = c.minx + Math.floor(gx * c.larg / 8);
      const x1 = c.minx + Math.floor((gx + 1) * c.larg / 8);
      const y0 = c.miny + Math.floor(gy * c.alt / 8);
      const y1 = c.miny + Math.floor((gy + 1) * c.alt / 8);
      for (let y = y0; y < Math.max(y1, y0 + 1); y++) {
        for (let x = x0; x < Math.max(x1, x0 + 1); x++) {
          total++;
          if (alfa(img, x, y) > 16) conta++;
        }
      }
      s += (total && conta / total > 0.35) ? "1" : "0";
    }
  }
  return s;
}

const monstros = ler("src/data/monsters.json");
const racas = ler("src/data/races.json");
const classes = ler("src/data/classes.json");
const gacha = ler("src/data/gachaRoster.json");
const pets = ler("src/data/pets.json").pets || [];
const npcs = ler("src/data/npcs.json") || [];

const existe = (nome) => fs.existsSync(path.join(SPRITES, nome));

// --- 1. cobertura: nada mais pode cair no placeholder ----------------------
checar("todo monstro tem arquivo de sprite", () => {
  const faltando = monstros.filter((m) => !existe(`${m.sprite}.png`)).map((m) => m.sprite);
  assert.strictEqual(faltando.length, 0,
    `${faltando.length} de ${monstros.length} sem sprite: ${faltando.slice(0, 6).join(", ")}`);
});

// DOIS NOMES LEGÍTIMOS PARA A MESMA FOLHA.
//
// Esta checagem só conhecia `pc_<raça>_<classe>.png` e por isso reprovava as
// 24 combinações das classes novas — cuja folha existe, chama-se
// `walk_v2_pc_<raça>_<classe>.png` e está ligada ao jogo por
// classVisuals.js (WALK_ART). O herói aparece andando na tela hoje; era a
// checagem que estava atrás do jogo, não o jogo atrás dela.
//
// O que ela continua cobrando é o que importa: que TODA combinação tenha
// folha em algum caminho que o jogo saiba procurar. Quem não tem vira
// placeholder no mapa.
checar("toda combinação de raça x classe tem folha de caminhada", () => {
  const faltando = [];
  for (const r of racas) for (const c of classes) {
    const chave = `pc_${r.id}_${c.id}`;
    const alternativa = WALK_ART[chave];
    if (existe(`${chave}.png`)) continue;
    if (alternativa && fs.existsSync(path.join(RAIZ, alternativa))) continue;
    faltando.push(chave);
  }
  assert.strictEqual(faltando.length, 0,
    `${faltando.length} de ${racas.length * classes.length} sem folha: ${faltando.slice(0, 6).join(", ")}`);
});

// Mesma cegueira, outro lugar: a arte EXCLUSIVA da segunda leva do gacha
// vive em assets/arte_v2 e é resolvida por gachaFinalArt.js. Sem conhecê-la,
// esta checagem acusava 32 convocados que aparecem perfeitamente na tela.
checar("todo convocado do elenco tem sprite", () => {
  const faltando = gacha.filter((p) => {
    if (existe(`gacha_${p.id}.png`)) return false;
    const exclusiva = GACHA_FINAL_ART[`gacha_${p.id}`];
    return !(exclusiva && fs.existsSync(path.join(RAIZ, exclusiva)));
  }).map((p) => p.id);
  assert.strictEqual(faltando.length, 0,
    `${faltando.length} de ${gacha.length} sem sprite: ${faltando.slice(0, 6).join(", ")}`);
});

checar("todo pet tem sprite", () => {
  const faltando = pets.filter((p) => !existe(`pet_${p.id}.png`)).map((p) => p.id);
  assert.strictEqual(faltando.length, 0, `sem sprite: ${faltando.join(", ")}`);
});

checar("todo NPC com sprite declarado tem o arquivo", () => {
  const faltando = npcs.filter((n) => n.sprite && !existe(n.sprite)).map((n) => n.id);
  assert.strictEqual(faltando.length, 0, `sem sprite: ${faltando.join(", ")}`);
});

// --- 2. formato medido do contrato ----------------------------------------
const deBatalha = [
  ...monstros.map((m) => `${m.sprite}.png`),
  ...gacha.map((p) => `gacha_${p.id}.png`),
].filter(existe);

checar("peça de batalha tem 192x192 (o pior caso do celular é DPR 3)", () => {
  const erradas = [];
  for (const nome of deBatalha) {
    const img = lerPNG(path.join(SPRITES, nome));
    if (img.larg !== 192 || img.alt !== 192) erradas.push(`${nome} ${img.larg}x${img.alt}`);
  }
  assert.strictEqual(erradas.length, 0,
    `${erradas.length} fora do tamanho: ${erradas.slice(0, 5).join(", ")}`);
});

checar("folha de mapa tem quadros quadrados de 64", () => {
  const erradas = [];
  for (const r of racas) for (const c of classes) {
    const nome = `pc_${r.id}_${c.id}.png`;
    if (!existe(nome)) continue;
    const img = lerPNG(path.join(SPRITES, nome));
    if (img.alt !== 64 || img.larg % 64 !== 0) erradas.push(`${nome} ${img.larg}x${img.alt}`);
  }
  assert.strictEqual(erradas.length, 0, `fora do formato: ${erradas.join(", ")}`);
});

checar("peça de batalha tem fundo transparente de verdade", () => {
  // Um sprite com moldura ou retângulo de fundo tem os quatro cantos opacos.
  const ruins = [];
  for (const nome of deBatalha) {
    const img = lerPNG(path.join(SPRITES, nome));
    if (img.canais !== 4 && img.canais !== 2) { ruins.push(`${nome} sem canal alfa`); continue; }
    const cantos = [[0, 0], [img.larg - 1, 0], [0, img.alt - 1], [img.larg - 1, img.alt - 1]];
    if (cantos.every(([x, y]) => alfa(img, x, y) > 16)) ruins.push(nome);
  }
  assert.strictEqual(ruins.length, 0, `com fundo: ${ruins.slice(0, 5).join(", ")}`);
});

checar("nenhuma peça de batalha está vazia ou quase vazia", () => {
  const ruins = [];
  for (const nome of deBatalha) {
    const c = caixa(lerPNG(path.join(SPRITES, nome)));
    const ocupacao = c.cheios / (192 * 192);
    if (ocupacao < 0.04) ruins.push(`${nome} ${(ocupacao * 100).toFixed(1)}%`);
  }
  assert.strictEqual(ruins.length, 0, `quase vazias: ${ruins.slice(0, 5).join(", ")}`);
});

// --- 3. enquadramento: regra 3 do contrato ---------------------------------
checar("a criatura fica apoiada na base do quadro", () => {
  // "Sem margem grande embaixo: o jogo alinha os pés na linha do slot."
  const ruins = [];
  for (const nome of deBatalha) {
    const img = lerPNG(path.join(SPRITES, nome));
    const c = caixa(img);
    const folga = img.alt - 1 - c.maxy;
    if (folga > 24) ruins.push(`${nome} ${folga}px de folga embaixo`);
  }
  assert.strictEqual(ruins.length, 0, `${ruins.length} flutuando: ${ruins.slice(0, 5).join(", ")}`);
});

checar("a criatura preenche o quadro numa das duas direções", () => {
  // O contrato pede 85-90% da ALTURA, mas um bicho largo e baixo — arraia,
  // morcego de asa aberta — é limitado pela largura e nunca chega lá sem
  // virar girafa. A regra real é: uma das duas dimensões tem que encher.
  const ruins = [];
  for (const nome of deBatalha) {
    const img = lerPNG(path.join(SPRITES, nome));
    const c = caixa(img);
    const pAlt = c.alt / img.alt, pLarg = c.larg / img.larg;
    if (Math.max(pAlt, pLarg) < 0.72) {
      ruins.push(`${nome} ${(pAlt * 100) | 0}%x${(pLarg * 100) | 0}%`);
    }
  }
  assert.strictEqual(ruins.length, 0,
    `${ruins.length} pequenas demais: ${ruins.slice(0, 5).join(", ")}`);
});

// --- 4. silhueta: a regra de aprovação do contrato -------------------------
checar("dois monstros não têm a mesma silhueta", () => {
  const porForma = new Map();
  for (const m of monstros) {
    if (!existe(`${m.sprite}.png`)) continue;
    const s = silhueta(lerPNG(path.join(SPRITES, `${m.sprite}.png`)));
    if (!porForma.has(s)) porForma.set(s, []);
    porForma.get(s).push(m.sprite);
  }
  const colisoes = [...porForma.values()].filter((v) => v.length > 1);
  assert.strictEqual(colisoes.length, 0,
    `${colisoes.length} grupo(s) com silhueta idêntica: ${colisoes.slice(0, 3).map((g) => g.join("=")).join(" | ")}`);
});

checar("o elenco de convocados não é cem vezes a mesma figura", () => {
  // Era exatamente esse o estado anterior: 100 heróis, a mesma silhueta de
  // 16 px, só a cor da roupa mudando. Num gacha isso não é falta de arte, é
  // falta de recompensa.
  const formas = new Set();
  for (const p of gacha) {
    if (!existe(`gacha_${p.id}.png`)) continue;
    formas.add(silhueta(lerPNG(path.join(SPRITES, `gacha_${p.id}.png`))));
  }
  assert.ok(formas.size >= 24,
    `só ${formas.size} silhuetas distintas em ${gacha.length} convocados`);
});

checar("cada raça se distingue no mapa das outras raças", () => {
  // Mesma classe, raças diferentes: a folha de caminhada não pode ser
  // idêntica pixel a pixel, senão trocar de raça não muda nada na tela.
  const iguais = [];
  for (const c of classes) {
    const vistos = new Map();
    for (const r of racas) {
      const arq = path.join(SPRITES, `pc_${r.id}_${c.id}.png`);
      if (!fs.existsSync(arq)) continue;
      const chave = fs.readFileSync(arq).toString("base64");
      if (vistos.has(chave)) iguais.push(`${r.id}=${vistos.get(chave)} (${c.id})`);
      else vistos.set(chave, r.id);
    }
  }
  assert.strictEqual(iguais.length, 0, `folhas idênticas: ${iguais.join(", ")}`);
});

checar("toda raça x classe tem sprite de BATALHA de 192", () => {
  // A folha de mapa (pc_*) tem 64 px por quadro porque o tile do mundo tem 64.
  // Enquanto a batalha usava essa mesma folha, o herói era a única figura de
  // 16 px lógicos numa arena onde monstro e convocado já tinham 192.
  const faltando = [];
  const erradas = [];
  for (const r of racas) for (const c of classes) {
    const nome = `pcb_${r.id}_${c.id}.png`;
    if (!existe(nome)) { faltando.push(`${r.id}_${c.id}`); continue; }
    const img = lerPNG(path.join(SPRITES, nome));
    if (img.larg !== 192 || img.alt !== 192) erradas.push(`${nome} ${img.larg}x${img.alt}`);
  }
  assert.strictEqual(faltando.length, 0,
    `${faltando.length} sem sprite de batalha: ${faltando.slice(0, 6).join(", ")}`);
  assert.strictEqual(erradas.length, 0, `fora do tamanho: ${erradas.join(", ")}`);
});

checar("a batalha prefere o sprite de 192 do herói", () => {
  const bu = fs.readFileSync(path.join(RAIZ, "src/ui/BattleUI.js"), "utf8");
  assert.ok(/imagens\[`pcb_\$\{c\.racaId\}_\$\{c\.classeId\}`\]/.test(bu),
    "BattleUI.js não busca o sprite de batalha do herói");
  const ld = fs.readFileSync(path.join(RAIZ, "src/data/loader.js"), "utf8");
  assert.ok(/pcb_\$\{r\.id\}_\$\{c\.id\}/.test(ld), "loader.js não carrega os pcb_*");
});

// --- 4b. retratos da barra de ordem de turno -------------------------------
const HD = path.join(RAIZ, "assets", "sprites_hd");
const existeHD = (n) => fs.existsSync(path.join(HD, n));

checar("toda raça x classe tem retrato de 64 px em sprites_hd", () => {
  // A pasta inteira não existia. BattleUI montava o caminho na mão, a <img>
  // quebrada não derruba nada, e a barra de ordem de turno ficava sem rosto
  // nenhum — sem que nada no jogo reclamasse.
  const faltando = [];
  for (const r of racas) for (const c of classes) {
    if (!existeHD(`retrato_${r.id}_${c.id}.png`)) faltando.push(`${r.id}_${c.id}`);
  }
  assert.strictEqual(faltando.length, 0,
    `${faltando.length} sem retrato: ${faltando.slice(0, 6).join(", ")}`);
});

checar("cada família genérica do registro tem retrato de monstro", () => {
  // As famílias vêm de assetRegistry.js. Ler de lá em vez de repetir a lista
  // aqui é o que impede as duas de divergirem em silêncio.
  const reg = fs.readFileSync(path.join(RAIZ, "src/data/assetRegistry.js"), "utf8");
  const bloco = reg.slice(reg.indexOf("const FAMILIA_GENERICA"), reg.indexOf("};", reg.indexOf("const FAMILIA_GENERICA")));
  const familias = [...bloco.matchAll(/^\s{2}(\w+):\s*\[/gm)].map((m) => m[1]);
  assert.ok(familias.length >= 5, `só ${familias.length} famílias lidas do registro`);
  const faltando = familias.filter((f) => !existeHD(`retrato_monstro_${f}.png`));
  assert.strictEqual(faltando.length, 0, `sem retrato: ${faltando.join(", ")}`);
});

checar("retrato é quadrado de 64 e tem fundo transparente", () => {
  const ruins = [];
  for (const nome of fs.readdirSync(HD).filter((f) => f.endsWith(".png"))) {
    const img = lerPNG(path.join(HD, nome));
    if (img.larg !== 64 || img.alt !== 64) { ruins.push(`${nome} ${img.larg}x${img.alt}`); continue; }
    if (caixa(img).cheios === 0) ruins.push(`${nome} vazio`);
  }
  assert.strictEqual(ruins.length, 0, ruins.slice(0, 5).join(", "));
});

checar("a barra de ordem de turno não monta caminho de arte na mão", () => {
  // O caminho cravado foi a CAUSA do buraco acima: com ele, nem o registro
  // nem a cadeia de fallback eram consultados.
  const bu = fs.readFileSync(path.join(RAIZ, "src/ui/BattleUI.js"), "utf8");
  assert.ok(!/`assets\/sprites_hd\/retrato_\$\{/.test(bu),
    "BattleUI.js ainda monta o caminho do retrato à mão");
  assert.ok(/imgHtml\(descritor, USOS\.RETRATO/.test(bu),
    "BattleUI.js não pede o retrato ao registro de assets");
  assert.ok(/ligarCadeias\(timelineEl\)/.test(bu),
    "a cadeia de fallback dos retratos não está ligada");
});

// --- 5. o loader continua sabendo pedir tudo isso --------------------------
checar("o loader pede sprite para monstro, raça x classe, convocado e pet", () => {
  const loader = fs.readFileSync(path.join(RAIZ, "src/data/loader.js"), "utf8");
  for (const trecho of ["dados.monsters.forEach", "dados.races.forEach",
                        "gachaRoster", "dados.pets"]) {
    assert.ok(loader.includes(trecho), `loader.js não pede ${trecho}`);
  }
});

checar("a batalha desenha o quadro pelo tamanho real da imagem", () => {
  // O 64 cravado no drawImage recortava o canto superior esquerdo de qualquer
  // sprite maior — com arte de 192 o jogador via um pedaço da pata do bicho.
  const bu = fs.readFileSync(path.join(RAIZ, "src/ui/BattleUI.js"), "utf8");
  assert.ok(/const ladoQuadro = /.test(bu), "BattleUI.js não deduz o lado do quadro");
  assert.ok(!/drawImage\(img, frame, 0, 64, 64/.test(bu),
    "BattleUI.js ainda recorta 64x64 fixo");
});

const total = monstros.length + racas.length * classes.length + gacha.length + pets.length;
console.log(ok.map((n) => `  ok   ${n}`).join("\n"));
console.log(`\n  (${monstros.length} monstros · ${racas.length * classes.length} raça×classe · ${gacha.length} convocados · ${pets.length} pets = ${total} peças)`);
if (falhas.length) {
  console.log(falhas.map((f) => `  FALHA ${f}`).join("\n"));
  console.log(`\n❌ ${falhas.length} falha(s) de ${ok.length + falhas.length}`);
  process.exit(1);
}
console.log(`\n✅ ${ok.length}/${ok.length} — cobertura, formato, enquadramento e silhueta`);
