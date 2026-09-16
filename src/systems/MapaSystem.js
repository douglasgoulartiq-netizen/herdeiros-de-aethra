// A CAMADA DE DADOS DOS MAPAS — o que desenhar, nunca como desenhar.
//
// Serve as duas telas novas: o minimapa do HUD (MinimapaUI.js) e o mapa-múndi
// inteiro (MapaMundoUI.js). Ficar fora da UI é o que permite as duas
// concordarem: mesma cor para a mesma região, mesmo nível para a mesma zona,
// mesma regra de névoa. Duas telas que calculam a mesma coisa por conta
// própria acabam discordando — é uma questão de quando, não de se.
//
// O QUE JÁ EXISTIA, e por isso nada aqui inventa geografia:
//   • WorldLayout.mapaDePosse(224, 176) diz de que zona é cada tile. É a
//     partição orgânica real do mundo, não uma grade de retângulos.
//   • zones.js ZONAS_MUNDO traz `perigo: [min, max]` — o NÍVEL de cada uma
//     das 48 zonas, que já estava escrito e nunca tinha sido mostrado ao
//     jogador em lugar nenhum.
//   • worldHierarchy.js agrupa as 48 zonas nas 17 macro-regiões.
//   • FogOfWarSystem diz o que o jogador já descobriu.
//
// Este arquivo só junta as quatro coisas e acrescenta a única que faltava:
// cor.
import { ZONAS_MUNDO } from "../data/world/zones.js";
import { mapaDePosse, resumoDasZonas } from "../data/world/WorldLayout.js";
import { MACRO_REGIOES, macroDaZona } from "../data/worldHierarchy.js";
import { TILE, OVERWORLD_W, OVERWORLD_H } from "../data/worldMap.js";
import { estadoDaZona, NEVOA } from "./FogOfWarSystem.js";

// --- Cores -----------------------------------------------------------------

// Paleta de tile para desenho em miniatura. Não é a arte do jogo reduzida: um
// tileset de 64px encolhido a 2px vira papa cinzenta. São cores CHAPADAS
// escolhidas para se distinguirem uma da outra a 2 pixels de tamanho, que é a
// única coisa que importa num minimapa.
const COR_TILE = {
  [TILE.GRASS]: "#3f6b34",
  [TILE.GRASS_DETAIL]: "#4a7a3c",
  [TILE.TALL_GRASS]: "#356b2e",
  [TILE.TREE]: "#23421f",
  [TILE.BUSH]: "#2d5427",
  [TILE.PATH]: "#8a7350",
  [TILE.SAND]: "#c2a76a",
  [TILE.WATER]: "#2b5f8a",
  [TILE.DEEP_WATER]: "#1d4166",
  [TILE.WALL]: "#5c5348",
  [TILE.DUNGEON_WALL]: "#3b3530",
  [TILE.DUNGEON_FLOOR]: "#6a6157",
  [TILE.VILLAGE_FLOOR]: "#9c855e",
  [TILE.SNOW]: "#d7e3ea",
  [TILE.ICE]: "#9dc4dd",
  [TILE.LAVA]: "#c2451f",
  [TILE.ASH]: "#615a55",
  [TILE.MARSH]: "#4c5c36",
  [TILE.COBBLE]: "#877f74",
  [TILE.BRIDGE]: "#8d6c44",
  [TILE.FARM]: "#8a7a3e",
  [TILE.BUILDING]: "#7a4a33",
  [TILE.CRYSTAL]: "#7f6ab5",
  [TILE.BONE]: "#cfc4a8",
};
const COR_TILE_PADRAO = "#3f6b34";

export function corDoTile(t) {
  return COR_TILE[t] || COR_TILE_PADRAO;
}

// Uma cor por macro-região, atribuída na ordem em que as regiões aparecem em
// worldHierarchy. Matizes espaçados no círculo cromático para regiões
// vizinhas nunca caírem na mesma faixa; saturação e luminosidade fixas para o
// mapa inteiro parecer um mapa, e não um saco de balas.
const MATIZES_MACRO = [
  "#5e9e4a", "#4a8fb8", "#b8794a", "#9a5ab0", "#c2a23c",
  "#4fae91", "#c25b5b", "#6f7fc9", "#8fae3c", "#b5548f",
  "#3f9cb5", "#a8763c", "#7ab54f", "#9c5fc9", "#c98a3c",
  "#4a9e6e", "#b04a6e",
];
// Dezessete matizes puros lado a lado dão um mapa político de livro escolar,
// que destoa da paleta sépia do jogo inteiro. Misturar cada um com o marrom
// da interface tira a estridência sem tirar a distinção: as regiões
// continuam separáveis a olho, mas o mapa passa a parecer pertencer a Aethra.
const TERRA = [0x5a, 0x4a, 0x32];
const MISTURA_TERRA = 0.3;
const CORES_MACRO = MATIZES_MACRO.map((c) => misturarComTerra(c, MISTURA_TERRA));

function misturarComTerra(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c, k) => Math.round(c * (1 - t) + TERRA[k] * t);
  const r = canal((n >> 16) & 255, 0), g = canal((n >> 8) & 255, 1), b = canal(n & 255, 2);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
const COR_POR_MACRO = new Map(MACRO_REGIOES.map((m, i) => [m.id, CORES_MACRO[i % CORES_MACRO.length]]));
export const corDaMacro = (macroId) => COR_POR_MACRO.get(macroId) || "#6a6157";

// A cor de uma ZONA é a da sua macro-região, clareada ou escurecida conforme a
// posição dela dentro da região. Assim as 48 zonas continuam distinguíveis uma
// da outra sem que o mapa perca a leitura de "isto tudo é Altaverde".
const VARIACAO_NA_MACRO = new Map();
MACRO_REGIOES.forEach((m) => {
  const irmas = ZONAS_MUNDO.filter((z) => z.regiaoId === m.id);
  irmas.forEach((z, i) => {
    // De -18% a +18% de luminosidade, distribuídos entre as irmãs.
    const passo = irmas.length > 1 ? (i / (irmas.length - 1)) * 2 - 1 : 0;
    VARIACAO_NA_MACRO.set(z.id, passo * 0.18);
  });
});

export function corDaZona(zonaId) {
  const macro = macroDaZona(zonaId);
  const base = corDaMacro(macro ? macro.id : null);
  return ajustarLuminosidade(base, VARIACAO_NA_MACRO.get(zonaId) || 0);
}

function ajustarLuminosidade(hex, delta) {
  const n = parseInt(hex.slice(1), 16);
  const mexer = (c) => {
    const v = delta >= 0 ? c + (255 - c) * delta : c * (1 + delta);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const r = mexer((n >> 16) & 255), g = mexer((n >> 8) & 255), b = mexer(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// --- Níveis ----------------------------------------------------------------

// O `perigo: [min, max]` de cada zona virando texto. Esta é a informação que o
// jogador pediu para ver no mapa e que o jogo guardava sem nunca mostrar:
// dá para saber, olhando, que o Abismo de Naz'thal é Nv. 28-32 e que não se
// entra lá no nível 6.
export function faixaDeNivel(zona) {
  const p = zona && zona.perigo;
  if (!Array.isArray(p) || !p.length) return null;
  const [min, max] = p.length > 1 ? p : [p[0], p[0]];
  return { min, max, texto: min === max ? `Nv. ${min}` : `Nv. ${min}–${max}` };
}

// Quão perigosa esta zona é PARA ESTE personagem agora. Serve para pintar o
// nível de verde a vermelho — a leitura que o jogador realmente quer do mapa
// não é "qual o nível daqui", é "eu morro se eu for?".
export function ameacaRelativa(zona, nivelDoHeroi) {
  const f = faixaDeNivel(zona);
  if (!f || !nivelDoHeroi) return { id: "desconhecida", rotulo: "", cor: "#c8b89a" };
  const folga = nivelDoHeroi - f.min;
  if (nivelDoHeroi > f.max + 2) return { id: "trivial", rotulo: "Tranquilo", cor: "#7aa86a" };
  if (folga >= 0) return { id: "adequada", rotulo: "No seu nível", cor: "#c9b14a" };
  if (folga >= -3) return { id: "arriscada", rotulo: "Arriscado", cor: "#d38b3f" };
  return { id: "mortal", rotulo: "Mortal", cor: "#c25050" };
}

// --- Geometria do mundo ----------------------------------------------------

// Caixa e centro de cada zona, medidos do mapa de posse real (não da caixa
// declarada — ver WorldLayout: a caixa é um resumo, nunca a definição).
let cacheZonas = null;
export function zonasDoMundo() {
  if (cacheZonas) return cacheZonas;
  const resumo = resumoDasZonas(OVERWORLD_W, OVERWORLD_H);
  cacheZonas = ZONAS_MUNDO.map((z, i) => {
    const r = resumo[i] || {};
    const macro = macroDaZona(z.id);
    return {
      ...z,
      indice: i,
      macroId: macro ? macro.id : null,
      macroNome: macro ? macro.nome : "—",
      macroNomeMapa: macro ? macro.nomeMapa : null,
      caixa: { x0: r.x0 ?? 0, y0: r.y0 ?? 0, x1: r.x1 ?? 0, y1: r.y1 ?? 0 },
      // `centroReal` é o centro de MASSA do território (ver resumoDasZonas), e
      // não o `centro` declarado em zones.js — aquele é só a semente da
      // disputa de posse, e pode cair fora do território que a zona ganhou.
      // Para escrever um nome no mapa, o que vale é onde a zona está.
      centro: r.centroReal ? { ...r.centroReal } : { ...z.centro },
      area: r.area || 0,
      cor: corDaZona(z.id),
      nivel: faixaDeNivel(z),
    };
  });
  return cacheZonas;
}

export const zonaDoMundoPorId = (id) => zonasDoMundo().find((z) => z.id === id) || null;

// As 17 macro-regiões com o que o mapa precisa saber delas: cor, faixa de
// nível agregada (o menor mínimo e o maior máximo das zonas filhas) e onde
// escrever o nome (o centro de massa das zonas que a compõem).
let cacheMacros = null;
export function macrosDoMundo() {
  if (cacheMacros) return cacheMacros;
  const zonas = zonasDoMundo();
  cacheMacros = MACRO_REGIOES.map((m) => {
    const filhas = zonas.filter((z) => z.macroId === m.id);
    const areaTotal = filhas.reduce((s, z) => s + z.area, 0) || 1;
    const min = Math.min(...filhas.map((z) => (z.nivel ? z.nivel.min : 99)));
    const max = Math.max(...filhas.map((z) => (z.nivel ? z.nivel.max : 0)));
    return {
      id: m.id,
      nome: m.nome,
      nomeMapa: m.nomeMapa || m.nome,
      subtitulo: m.subtitulo || "",
      descricao: m.descricao || "",
      cor: corDaMacro(m.id),
      zonas: filhas,
      area: areaTotal,
      // Centro ponderado pela área: uma região com uma zona enorme e três
      // pequenas tem o nome escrito onde ela de fato está.
      centro: {
        x: Math.round(filhas.reduce((s, z) => s + z.centro.x * z.area, 0) / areaTotal),
        y: Math.round(filhas.reduce((s, z) => s + z.centro.y * z.area, 0) / areaTotal),
      },
      nivel: filhas.length && min <= max ? { min, max, texto: min === max ? `Nv. ${min}` : `Nv. ${min}–${max}` } : null,
    };
  }).filter((m) => m.zonas.length);
  return cacheMacros;
}

// --- Névoa -----------------------------------------------------------------

// Quanto de cada zona o jogador pode ver no mapa. O mapa NUNCA revela o que a
// névoa não revelou — um mapa que mostra tudo desde o começo não é um mapa, é
// um índice.
export const VISIBILIDADE = {
  OCULTA: "oculta",       // desconhecida: silhueta apagada, sem nome nem nível
  INSINUADA: "insinuada", // rumor: nome e nível, cor lavada
  ABERTA: "aberta",       // descoberta ou dominada: tudo
};

export function visibilidadeDaZona(personagem, zonaId) {
  const e = estadoDaZona(personagem, zonaId);
  if (e === NEVOA.DESCOBERTO || e === NEVOA.DOMINADO) return VISIBILIDADE.ABERTA;
  if (e === NEVOA.RUMOR) return VISIBILIDADE.INSINUADA;
  return VISIBILIDADE.OCULTA;
}

// Visibilidade de uma macro-região: a melhor entre as zonas filhas. Uma
// região de que se conhece um pedaço já aparece nomeada no mapa — é assim que
// funciona conhecer um território.
export function visibilidadeDaMacro(personagem, macroId) {
  const filhas = zonasDoMundo().filter((z) => z.macroId === macroId);
  let melhor = VISIBILIDADE.OCULTA;
  for (const z of filhas) {
    const v = visibilidadeDaZona(personagem, z.id);
    if (v === VISIBILIDADE.ABERTA) return VISIBILIDADE.ABERTA;
    if (v === VISIBILIDADE.INSINUADA) melhor = VISIBILIDADE.INSINUADA;
  }
  return melhor;
}

// Quanto do mundo já foi descoberto, em porcentagem de ÁREA (não de contagem
// de zonas): descobrir o Deserto de Arenth vale mais que descobrir a Vila,
// porque é maior, e é assim que o jogador sente.
export function exploracaoDoMundo(personagem) {
  const zonas = zonasDoMundo();
  const total = zonas.reduce((s, z) => s + z.area, 0) || 1;
  let aberta = 0, insinuada = 0;
  zonas.forEach((z) => {
    const v = visibilidadeDaZona(personagem, z.id);
    if (v === VISIBILIDADE.ABERTA) aberta += z.area;
    else if (v === VISIBILIDADE.INSINUADA) insinuada += z.area;
  });
  return {
    pct: Math.round((aberta / total) * 100),
    pctComRumor: Math.round(((aberta + insinuada) / total) * 100),
    zonasAbertas: zonas.filter((z) => visibilidadeDaZona(personagem, z.id) === VISIBILIDADE.ABERTA).length,
    totalZonas: zonas.length,
  };
}

// --- Bitmap do mundo -------------------------------------------------------

// Uma imagem de 224x176 pintada uma vez e reaproveitada: cada pixel é um tile,
// colorido pela zona dona dele. Desenhar 39.424 retângulos a cada quadro
// derrubaria o jogo; desenhar um ImageBitmap escalado custa uma chamada.
//
// `modo`: "zonas" pinta cada uma das 48; "macro" pinta as 17 regiões (zonas da
// mesma região ficam com a mesma cor, e o mapa lê como território político).
const cacheBitmap = new Map();
export function bitmapDoMundo(modo = "zonas") {
  if (cacheBitmap.has(modo)) return cacheBitmap.get(modo);
  const { posse } = mapaDePosse(OVERWORLD_W, OVERWORLD_H);
  const zonas = zonasDoMundo();
  const cores = zonas.map((z) => hexParaRgb(modo === "macro" ? corDaMacro(z.macroId) : z.cor));

  const cv = document.createElement("canvas");
  cv.width = OVERWORLD_W; cv.height = OVERWORLD_H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(OVERWORLD_W, OVERWORLD_H);
  for (let i = 0; i < posse.length; i += 1) {
    const c = cores[posse[i]] || [90, 90, 90];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cacheBitmap.set(modo, cv);
  return cv;
}

// Máscara de névoa: onde o jogador NÃO descobriu. Separada do bitmap de cores
// porque muda quando ele explora, enquanto as cores nunca mudam — separar as
// duas é o que evita repintar 39.424 pixels a cada passo dele.
export function bitmapDaNevoa(personagem) {
  const { posse } = mapaDePosse(OVERWORLD_W, OVERWORLD_H);
  const zonas = zonasDoMundo();
  const alfaPorZona = zonas.map((z) => {
    const v = visibilidadeDaZona(personagem, z.id);
    if (v === VISIBILIDADE.ABERTA) return 0;
    if (v === VISIBILIDADE.INSINUADA) return 152;
    // Quase opaco, mas não opaco: o contorno do continente continua legível
    // (o jogador sabe que existe terra ali), sem entregar de que região é.
    return 243;
  });
  const cv = document.createElement("canvas");
  cv.width = OVERWORLD_W; cv.height = OVERWORLD_H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(OVERWORLD_W, OVERWORLD_H);
  for (let i = 0; i < posse.length; i += 1) {
    img.data[i * 4] = 8; img.data[i * 4 + 1] = 6; img.data[i * 4 + 2] = 12;
    img.data[i * 4 + 3] = alfaPorZona[posse[i]] ?? 232;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function hexParaRgb(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const DIM_MUNDO = { largura: OVERWORLD_W, altura: OVERWORLD_H };
