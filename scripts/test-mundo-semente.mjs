// TESTE DO MUNDO DETERMINÍSTICO (ETAPA 1, task #34).
//
// O que ele protege, em uma frase: o mundo é função da semente. Duas
// gerações com a mesma semente têm que ser idênticas tile por tile, em
// qualquer ordem de chamada, e um mundo gerado não pode deixar nada
// inalcançável a pé.
//
// A parte de alcance é a mais importante e a menos óbvia. Enquanto o mapa
// era sorteado de novo a cada carregamento, um baú soterrado numa parede se
// "desentocava" sozinho no boot seguinte — o bug existia e ninguém via.
// Agora o mundo é fixo por semente: o mesmo baú ficaria inalcançável PARA
// SEMPRE naquele save. Por isso o teste varre 40 sementes e cobra caminho a
// pé, da vila, até todo baú, nó, entrada de masmorra e chefe de zona.
//
// Uso:  node scripts/test-mundo-semente.mjs   (puro Node, sem navegador)
import {
  buildDungeon, buildDungeon2,
  OVERWORLD_W, OVERWORLD_H, SOLID_TILES, ZONAS, TILES_TOTAL,
  DUNGEON_SPAWN, CHESTS_DUNGEON, BOSS_TILE, DUNGEON_EXIT_ZONE,
  DUNGEON2_SPAWN, CHESTS_DUNGEON2, BOSS_TILE2, DUNGEON2_EXIT_ZONE,
} from "../src/data/worldMap.js";
// buildOverworld mudou de casa na ETAPA 2: o mundo aberto passou a ser
// construído a partir dos dados de src/data/world/, e o gerador importa
// worldMap — deixar a função lá fecharia um ciclo de módulos.
import { buildOverworld, mundoDaSemente, limparCacheMundo } from "../src/systems/WorldBuilder.js";
import {
  SEMENTE_LEGADO, hashTexto, normalizarSemente, novaSemente, criarPRNG,
  derivarSemente, prngDe, embaralhar, inteiro, formatarSemente, lerSemente,
} from "../src/systems/WorldSeed.js";
import { migrarSave, SAVE_VERSION } from "../src/systems/SaveSystem.js";
import { readFileSync } from "node:fs";
// Travessias de barco (o arquipélago de Corallia é isolado por mar de propósito:
// chega-se nele pela Travessia do Recife, a partir do Porto de Maris).
import { ROTAS_MARITIMAS } from "../src/data/world/routes.js";

let ok = 0;
let falhou = 0;
const checar = (cond, msg, extra = "") => {
  if (cond) { ok += 1; console.log(`  ✓ ${msg}`); }
  else { falhou += 1; console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ""}`); }
};

// Assinatura da grade inteira: se um único tile mudar, o número muda.
function assinatura(g) {
  let h = 0x811c9dc5;
  for (const linha of g) for (const t of linha) {
    h ^= (t + 1);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Busca em largura pisável: devolve o conjunto de tiles alcançáveis a pé a
// partir de (x0, y0), nas 4 direções (o jogo não anda na diagonal).
function alcancaveis(g, x0, y0) {
  const alt = g.length; const larg = g[0].length;
  const vistos = new Uint8Array(larg * alt);
  const fila = [y0 * larg + x0];
  vistos[y0 * larg + x0] = 1;
  for (let i = 0; i < fila.length; i += 1) {
    const p = fila[i]; const x = p % larg; const y = (p - x) / larg;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= larg || ny >= alt) continue;
      const np = ny * larg + nx;
      if (vistos[np] || SOLID_TILES.has(g[ny][nx])) continue;
      vistos[np] = 1; fila.push(np);
    }
  }
  return { vistos, larg, tem: (x, y) => !!vistos[y * larg + x] };
}

console.log("\n=== 1. Gerador de números (WorldSeed) ===\n");
{
  const seq = (s, n = 8) => { const r = criarPRNG(s); return Array.from({ length: n }, () => r()); };
  const a = seq(42); const b = seq(42); const c = seq(43);
  checar(a.every((v, i) => v === b[i]), "mesma semente devolve a mesma sequência");
  checar(a.some((v, i) => v !== c[i]), "sementes diferentes devolvem sequências diferentes");
  checar(a.every((v) => v >= 0 && v < 1), "todo valor cai em [0, 1)");

  const r = criarPRNG(7);
  let soma = 0; const baldes = new Array(10).fill(0);
  for (let i = 0; i < 200000; i += 1) { const v = r(); soma += v; baldes[Math.floor(v * 10)] += 1; }
  const media = soma / 200000;
  checar(Math.abs(media - 0.5) < 0.005, `média perto de 0,5 em 200 mil amostras (${media.toFixed(4)})`);
  const pior = Math.max(...baldes.map((n) => Math.abs(n - 20000) / 20000));
  checar(pior < 0.03, `distribuição uniforme em 10 faixas (pior desvio ${(pior * 100).toFixed(1)}%)`);

  checar(hashTexto("aethra-legado") === SEMENTE_LEGADO,
    "SEMENTE_LEGADO continua sendo hashTexto('aethra-legado')", `${hashTexto("aethra-legado")} ≠ ${SEMENTE_LEGADO}`);
  checar(SEMENTE_LEGADO === 2055586687, "SEMENTE_LEGADO é exatamente 2055586687 (o mundo dos saves antigos)");
  checar(normalizarSemente(null) === SEMENTE_LEGADO && normalizarSemente(undefined) === SEMENTE_LEGADO,
    "semente ausente cai no legado");
  checar(normalizarSemente(0) === 0, "zero é semente válida (não cai no legado)");
  checar(normalizarSemente("123") === 123, "string numérica vira o número");
  checar(normalizarSemente("Aethra") === normalizarSemente("aethra"), "semente de texto ignora maiúsculas");
  checar(novaSemente() !== novaSemente() || novaSemente() !== novaSemente(), "novaSemente() varia");

  const s = 987654;
  checar(derivarSemente(s, "overworld") !== derivarSemente(s, "dungeon1"), "rótulos diferentes derivam sementes diferentes");
  checar(derivarSemente(s, "overworld") === derivarSemente(s, "overworld"), "a derivação é estável");

  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const e1 = embaralhar([...original], criarPRNG(5));
  const e2 = embaralhar([...original], criarPRNG(5));
  checar(e1.join() === e2.join(), "embaralhar é determinístico com a mesma semente");
  checar([...e1].sort((x, y) => x - y).join() === original.join(), "embaralhar é permutação (não perde nem duplica)");
  const contagem = new Array(8).fill(0);
  for (let i = 0; i < 4000; i += 1) contagem[embaralhar([...original], criarPRNG(i))[0] - 1] += 1;
  checar(Math.min(...contagem) > 350, `todo elemento chega à 1ª posição (mínimo ${Math.min(...contagem)} de 4000)`);

  const ri = criarPRNG(3);
  const vistos = new Set();
  for (let i = 0; i < 2000; i += 1) vistos.add(inteiro(ri, 2, 5));
  checar([...vistos].sort().join() === "2,3,4,5", "inteiro(rnd, 2, 5) cobre 2..5 e não sai da faixa");

  checar(lerSemente(formatarSemente(123456)) === 123456, "formatarSemente/lerSemente fecham o ciclo");
  checar(formatarSemente(SEMENTE_LEGADO).length <= 7, `a semente cabe em 7 caracteres (${formatarSemente(SEMENTE_LEGADO)})`);
  checar(lerSemente("floresta bonita") === normalizarSemente("floresta bonita"), "uma frase também é semente válida");
}

console.log("\n=== 2. O mundo é função da semente ===\n");
{
  const a1 = assinatura(buildOverworld(111));
  const a2 = assinatura(buildOverworld(111));
  const b1 = assinatura(buildOverworld(112));
  checar(a1 === a2, "mesma semente → mundo aberto idêntico tile por tile");
  checar(a1 !== b1, "sementes diferentes → mundos diferentes");

  const d1 = assinatura(buildDungeon(111));
  const d1b = assinatura(buildDungeon(111));
  const d2 = assinatura(buildDungeon2(111));
  checar(d1 === d1b, "mesma semente → masmorra 1 idêntica");
  checar(d1 !== d2, "as duas masmorras têm fluxos separados (não são a mesma planta)");
  checar(assinatura(buildDungeon(112)) !== d1, "outra semente → outra masmorra 1");

  // Independência de ordem: é isto que permite carregar só um chunk depois,
  // sem "acordar" o resto do mundo pra manter o fluxo alinhado.
  buildOverworld(111); buildOverworld(111); buildDungeon2(111);
  checar(assinatura(buildDungeon(111)) === d1, "a masmorra 1 não muda com o que foi gerado antes dela");
  buildDungeon(111);
  checar(assinatura(buildOverworld(111)) === a1, "o mundo aberto não muda com o que foi gerado antes dele");

  // Todo tile precisa ser um TILE conhecido, em toda semente. A tabela tem 24
  // desde a ETAPA 2 (as 12 originais + neve, gelo, lava, cinzas, brejo,
  // calçada, ponte, lavoura, construção, cristal, mar profundo e osso).
  const validos = new Set(Array.from({ length: TILES_TOTAL }, (_, i) => i));
  let tilesEstranhos = 0;
  for (const s of [1, 2, 3, SEMENTE_LEGADO]) {
    const g = buildOverworld(s);
    for (const linha of g) for (const t of linha) if (!validos.has(t)) tilesEstranhos += 1;
  }
  checar(tilesEstranhos === 0, "nenhum tile fora da tabela TILE em 4 sementes");

  const g = buildOverworld(SEMENTE_LEGADO);
  checar(g.length === OVERWORLD_H && g[0].length === OVERWORLD_W, `a grade tem ${OVERWORLD_W}x${OVERWORLD_H}`);
}

console.log("\n=== 3. Nenhum Math.random() sobrou na geração ===\n");
{
  // Guarda de regressão: qualquer Math.random() que volte a estes arquivos
  // reabre exatamente o bug que esta task fechou.
  //
  // A contagem é feita sobre o CÓDIGO, com os comentários removidos antes.
  // Sem isso o teste falha por causa dos próprios comentários que explicam
  // por que Math.random saiu daqui — foi o que aconteceu na primeira
  // execução.
  // O `\r\n` na primeira linha não é decoração: os arquivos do projeto são
  // gravados no Windows, e em expressão regular de JavaScript o `.` NÃO
  // atravessa `\r` (é terminador de linha). Sem normalizar, o filtro de
  // comentário não casa nada e o teste acusa comentário como se fosse
  // código — foi assim que ele falhou na segunda execução.
  const codigo = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8")
    .replace(/\r\n?/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*/, "$1")).join("\n");
  const contar = (txt) => (txt.match(/Math\.random/g) || []).length;

  const nWorld = contar(codigo("../src/data/worldMap.js"));
  checar(nWorld === 0, `worldMap.js não chama Math.random (${nWorld} ocorrência(s) no código)`);
  const nRest = contar(codigo("../src/systems/RestSystem.js"));
  checar(nRest === 0, `RestSystem.js também não sorteia nada (${nRest})`);
  const nSeed = contar(codigo("../src/systems/WorldSeed.js"));
  checar(nSeed === 1, `WorldSeed.js usa Math.random uma vez só, em novaSemente() (${nSeed})`);
  // Contraprova do filtro de comentários: se ele estivesse comendo código de
  // verdade, esta linha acusaria.
  checar(codigo("../src/systems/WorldSeed.js").includes("export function novaSemente"),
    "o filtro de comentários não engoliu o código junto");
}

console.log("\n=== 4. Alcance a pé — 12 mundos ===\n");
{
  // Doze sementes, não quarenta: cada mundo da ETAPA 2 leva ~300ms pra ser
  // construído (39 mil tiles, rios, estradas, assentamentos), e quarenta
  // seriam treze segundos de teste pra cobrir a mesma regra.
  const SEMENTES = [SEMENTE_LEGADO, ...Array.from({ length: 11 }, (_, i) => hashTexto(`semente-teste-${i}`))];
  let falhasPontos = 0; let piorCobertura = 1; const exemplos = [];
  let falhasDeclaradas = 0; const declarados = [];

  for (const s of SEMENTES) {
    limparCacheMundo();
    const mundo = mundoDaSemente(s);
    const g = mundo.grid;
    // Alcance = a pé a partir do início + a pé a partir do cais de chegada de
    // cada travessia cujo porto de partida já é alcançável. Repete até
    // estabilizar, para o caso de uma travessia levar a outra.
    const buscas = [alcancaveis(g, mundo.spawn.x, mundo.spawn.y)];
    const tem = (x, y) => buscas.some((b) => b.tem(x, y));
    const porId = new Map(mundo.assentamentos.map((a) => [a.id, a]));
    const embarcadas = new Set();
    for (let mudou = true; mudou;) {
      mudou = false;
      for (const rota of ROTAS_MARITIMAS) {
        for (const [de, para] of [[rota.de, rota.para], [rota.para, rota.de]]) {
          const origem = porId.get(de); const destino = porId.get(para);
          if (!origem || !destino || embarcadas.has(`${de}>${para}`) || !tem(origem.x, origem.y)) continue;
          embarcadas.add(`${de}>${para}`);
          buscas.push(alcancaveis(g, destino.x, destino.y));
          mudou = true;
        }
      }
    }
    for (const rota of ROTAS_MARITIMAS) {
      const porto = porId.get(rota.de);
      if (!porto || !buscas[0].tem(porto.x, porto.y)) {
        falhasPontos += 1;
        if (exemplos.length < 4) exemplos.push(`porto da ${rota.nome} fora do alcance a pé (semente ${s})`);
      }
    }
    const bfs = { tem };
    const pontos = [
      ...mundo.baus.map((c) => [`baú ${c.id}`, c.x, c.y]),
      ...mundo.nos.map((n) => [`nó ${n.id}`, n.x, n.y]),
      ...mundo.chefes.map((c) => [`chefe ${c.zonaId}`, c.x, c.y]),
      ...mundo.pois.map((p) => [`POI ${p.id}`, p.x, p.y]),
      ...mundo.landmarks.map((l) => [`marco ${l.id}`, l.x, l.y]),
      ...mundo.assentamentos.map((a) => [`assentamento ${a.id}`, a.x, a.y]),
      ...mundo.masmorras.map((d) => [`boca ${d.id}`, d.entrada.x, d.entrada.y]),
    ];
    for (const [nome, x, y] of pontos) {
      if (!bfs.tem(x, y)) { falhasPontos += 1; if (exemplos.length < 4) exemplos.push(`${nome} @${x},${y} (semente ${s})`); }
    }
    for (const a of mundo.inalcancaveis || []) {
      falhasDeclaradas += 1;
      if (declarados.length < 4) declarados.push(`${a.id || "?"} @${a.x},${a.y} (semente ${s})`);
    }
    let pisaveis = 0; let atingidos = 0;
    for (let y = 0; y < OVERWORLD_H; y += 1) for (let x = 0; x < OVERWORLD_W; x += 1) {
      if (SOLID_TILES.has(g[y][x])) continue;
      pisaveis += 1; if (bfs.tem(x, y)) atingidos += 1;
    }
    piorCobertura = Math.min(piorCobertura, atingidos / pisaveis);
  }

  checar(falhasPontos === 0, "todo baú, nó, chefe, POI, marco, assentamento e boca de masmorra é alcançável a pé (ou a pé depois de uma travessia de barco) em 12 mundos", exemplos.join(" · "));
  // O MESMO FATO, AGORA DITO PELO PRÓPRIO GERADOR.
  //
  // A asserção acima refaz a inundação aqui no teste. `inalcancaveis` é a
  // resposta do gerador sobre si mesmo, depois das duas rodadas de reparo
  // (ver WorldBuilder). Vale ter as duas: se um dia elas discordarem, a
  // discordância é a informação — significa que o gerador e o teste não
  // concordam sobre o que é "alcançável", e é isso que precisa ser resolvido
  // antes de qualquer outra coisa.
  checar(falhasDeclaradas === 0, `o gerador não declara nenhum alvo inalcançável em 12 mundos`, declarados.join(" · "));
  checar(piorCobertura > 0.9, `o chão pisável é praticamente um continente só, contando o arquipélago da travessia (pior semente: ${(piorCobertura * 100).toFixed(1)}%)`);
  limparCacheMundo();
}

console.log("\n=== 5. Masmorras — 40 sementes ===\n");
{
  const SEMENTES = [SEMENTE_LEGADO, ...Array.from({ length: 39 }, (_, i) => hashTexto(`masmorra-${i}`))];
  const casos = [
    ["masmorra 1", buildDungeon, DUNGEON_SPAWN, CHESTS_DUNGEON, BOSS_TILE, DUNGEON_EXIT_ZONE],
    ["masmorra 2", buildDungeon2, DUNGEON2_SPAWN, CHESTS_DUNGEON2, BOSS_TILE2, DUNGEON2_EXIT_ZONE],
  ];
  for (const [nome, build, spawn, baus, chefe, saida] of casos) {
    let falhas = 0; const exemplos = [];
    const plantas = new Set();
    for (const s of SEMENTES) {
      const g = build(s);
      plantas.add(assinatura(g));
      const bfs = alcancaveis(g, spawn.x, spawn.y);
      const alvos = [
        ...baus.map((b) => [b.id, b.x, b.y]),
        ["chefe", chefe.x, chefe.y],
        ["saída", saida.x0, saida.y0],
      ];
      for (const [rot, x, y] of alvos) {
        if (!bfs.tem(x, y)) { falhas += 1; if (exemplos.length < 3) exemplos.push(`${rot} @${x},${y} (semente ${s})`); }
      }
    }
    checar(falhas === 0, `${nome}: chefe, saída e todos os baús alcançáveis do spawn em 40 sementes`, exemplos.join(" · "));
    checar(plantas.size >= SEMENTES.length * 0.9, `${nome}: as 40 sementes dão plantas variadas (${plantas.size} distintas)`);
  }
}

console.log("\n=== 6. O mundo inteiro é função da semente ===\n");
{
  // Não é só a grade: assentamento, POI, marco, baú e boca de masmorra também
  // saem no mesmo lugar quando a semente é a mesma, e em lugares diferentes
  // quando não é. Sem isso, dois jogadores com a mesma semente veriam o mesmo
  // terreno com os baús em lugares diferentes.
  limparCacheMundo();
  const a1 = mundoDaSemente(555);
  const chave = (m) => [
    ...m.assentamentos.map((s) => `${s.id}@${s.x},${s.y}`),
    ...m.pois.map((p) => `${p.id}@${p.x},${p.y}`),
    ...m.baus.map((b) => `${b.id}@${b.x},${b.y}`),
    ...m.masmorras.map((d) => `${d.id}@${d.entrada.x},${d.entrada.y}`),
  ].join("|");
  const k1 = chave(a1);
  limparCacheMundo();
  const k2 = chave(mundoDaSemente(555));
  limparCacheMundo();
  const k3 = chave(mundoDaSemente(556));
  checar(k1 === k2, "mesma semente → tudo no mesmo lugar (assentamento, POI, baú, masmorra)");
  checar(k1 !== k3, "outra semente → outro mundo");
  limparCacheMundo();

  // Rio que termina no nada é o que o item 7 do pedido proíbe. Todo rio tem
  // que acabar em água.
  const m = mundoDaSemente(555);
  checar(m.rios.length > 0, `o mundo tem rios (${m.rios.length})`);
  checar(m.rios.every((r) => r.pontos > 4), "nenhum rio é um respingo de dois tiles");
  checar(m.estradas.every((e) => e.tiles > 0), "toda estrada tem traçado de verdade");
  checar(m.estradas.every((e) => e.de && e.para), "e toda estrada tem origem e destino declarados (item 6)");
  limparCacheMundo();

  // Save antigo (v2, sem semente) tem que ganhar SEMENTE_LEGADO.
  const antigo = { saveVersion: 2, personagem: { nome: "T", gacha: { personagensObtidos: [] } }, mundo: { mapaAtual: "overworld", player: { x: 5, y: 5 } } };
  migrarSave(antigo);
  checar(antigo.mundo.semente === SEMENTE_LEGADO, "save v2 recebe SEMENTE_LEGADO na migração");
  checar(antigo.saveVersion === SAVE_VERSION && SAVE_VERSION >= 3, `o save foi carimbado como v${SAVE_VERSION}`);

  // Idempotência: migrar de novo não pode trocar o mundo de quem já jogou.
  antigo.mundo.semente = 4242;
  antigo.saveVersion = 2;
  migrarSave(antigo);
  checar(antigo.mundo.semente === 4242, "a migração NUNCA sobrescreve uma semente que já existe");

  // Save pré-histórico, sem saveVersion nenhum.
  const cru = { personagem: { nome: "T" }, mundo: { mapaAtual: "masmorra", player: { x: 4, y: 6 } } };
  migrarSave(cru);
  checar(cru.mundo.semente === SEMENTE_LEGADO, "save v0 (sem versão) também recebe a semente");
}

console.log("\n" + "─".repeat(60));
console.log(`Resultado: ${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
