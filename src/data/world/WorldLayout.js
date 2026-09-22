// PARTIÇÃO ORGÂNICA DO TERRITÓRIO (ETAPA 2, item 5: "evitar mapas quadrados").
//
// O QUE ESTE ARQUIVO SUBSTITUI
// ---------------------------
// Até a ETAPA 1 cada zona era quatro números — x0, y0, x1, y1 — numa grade de
// 6 colunas por 4 linhas. Três consequências, todas visíveis no jogo:
// o mundo era um tabuleiro de xadrez de retângulos; a fronteira entre duas
// zonas era uma linha reta perfeita que nenhuma paisagem tem; e a última
// linha da grade só usava 4 das 6 colunas, deixando um vão de 504 tiles no
// canto inferior direito que não pertencia a região nenhuma.
//
// COMO FUNCIONA AGORA
// -------------------
// Cada zona tem um CENTRO, um PESO e uma FORMA. Para cada tile do mapa, a
// zona dona é a que minimiza
//
//     distância anisotrópica(tile, centro) / peso  −  amplitude · ruído(tile)
//
// Três peças, cada uma fazendo uma coisa:
//
//   • a DISTÂNCIA sozinha daria um diagrama de Voronoi — orgânico em ângulo,
//     mas ainda de fronteiras retas;
//   • a ANISOTROPIA estica a distância num eixo, e é o que transforma o mesmo
//     algoritmo em vale, cânion ou cordilheira em vez de um borrão redondo;
//   • o RUÍDO COERENTE (valor interpolado, não chuvisco) empurra a fronteira
//     para dentro e para fora em ondas de dez a vinte tiles. É ele que faz a
//     divisa parecer uma costa e não um corte de faca.
//
// O resultado cobre o mapa INTEIRO: todo tile pertence a exatamente uma zona,
// então o vão de 504 tiles deixou de existir por construção, não por remendo.
//
// POR QUE ISTO NÃO DEPENDE DA SEMENTE DO MUNDO
// --------------------------------------------
// A geografia POLÍTICA de Aethra é canônica: o Deserto de Karn fica onde o
// mapa do Manual diz que fica, na sua semente e na minha. O que a semente
// muda é o DETALHE — onde nasce cada árvore, por onde o rio serpenteia, que
// desenho o labirinto tem. Por isso o ruído daqui vem só do id da zona e da
// coordenada, e a partição é a mesma para todo mundo. É também o que permite
// responder "que zona é esta?" sem ter construído o mapa.
import { ZONAS_MUNDO } from "./zones.js";
import { hashTexto } from "../../systems/WorldSeed.js";
import { CODEX_MAP_BASE_W, CODEX_MAP_BASE_H } from "./codexGeography.js";

// Amplitude do ruído de fronteira e anisotropia, por forma orgânica. Um
// cânion é a mesma matemática de uma planície com outros três números — é o
// que evita "a mesma estrutura em todas as regiões" (item 33).
const PERFIL_FORMA = {
  planicie:    { ax: 1.15, ay: 1.00, ruido: 12 },
  floresta:    { ax: 1.00, ay: 1.00, ruido: 14 },
  vale:        { ax: 1.60, ay: 0.72, ruido: 8 },
  canyon:      { ax: 1.95, ay: 0.52, ruido: 6 },
  cordilheira: { ax: 1.50, ay: 0.80, ruido: 10 },
  peninsula:   { ax: 1.20, ay: 0.88, ruido: 16 },
  delta:       { ax: 1.10, ay: 1.10, ruido: 16 },
  arquipelago: { ax: 1.00, ay: 1.00, ruido: 18 },
  pantano:     { ax: 1.15, ay: 1.00, ruido: 16 },
  crateras:    { ax: 1.00, ay: 1.00, ruido: 10 },
  urbana:      { ax: 1.00, ay: 1.00, ruido: 5 },
};
const PERFIL_PADRAO = { ax: 1.0, ay: 1.0, ruido: 12 };

// Ruído de valor com interpolação suave. Uma malha grossa de números
// pseudo-aleatórios é interpolada entre os nós, o que dá ondas em vez de
// chuvisco — chuvisco na fronteira daria zonas serrilhadas tile a tile, que
// é feio e ainda por cima ilegível pro jogador.
const ESCALA_RUIDO = 14; // tiles por célula da malha

// Mistura inteira de 32 bits (do mesmo tronco de xxhash/murmur). Substituiu
// `hashTexto(\`${semente}:${ix}:${iy}\`)`, que era correto e absurdamente
// caro: a primeira versão deste arquivo montava uma string por consulta e
// levava DOIS SEGUNDOS pra decidir o mapa — dois segundos de tela parada em
// todo carregamento, num jogo que roda em celular.
function misturar(a, b, c) {
  let h = (a * 0x27d4eb2d) ^ (b * 0x165667b1) ^ (c * 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296; // [0, 1)
}

const suavizar = (t) => t * t * (3 - 2 * t); // smoothstep

// Malha de ruído PRÉ-CALCULADA por zona. Uma malha inteira tem
// (224/14+2) x (176/14+2) ≈ 270 nós; calcular os 270 uma vez e interpolar é
// a diferença entre 6,6 milhões de hashes e doze mil.
function criarMalha(semente, largura, altura, escala = ESCALA_RUIDO) {
  const cols = Math.ceil(largura / escala) + 2;
  const linhas = Math.ceil(altura / escala) + 2;
  const valores = new Float32Array(cols * linhas);
  for (let iy = 0; iy < linhas; iy += 1) {
    for (let ix = 0; ix < cols; ix += 1) valores[iy * cols + ix] = misturar(semente, ix + 1, iy + 1);
  }
  return { valores, cols, linhas, escala };
}

function amostrarMalha(malha, x, y) {
  const fx = x / malha.escala;
  const fy = y / malha.escala;
  const ix = Math.min(malha.cols - 2, Math.max(0, Math.floor(fx)));
  const iy = Math.min(malha.linhas - 2, Math.max(0, Math.floor(fy)));
  const tx = suavizar(fx - ix);
  const ty = suavizar(fy - iy);
  const v = malha.valores;
  const i0 = iy * malha.cols + ix;
  const i1 = i0 + malha.cols;
  const a = v[i0] + (v[i0 + 1] - v[i0]) * tx;
  const b = v[i1] + (v[i1 + 1] - v[i1]) * tx;
  return (a + (b - a) * ty) * 2 - 1; // [-1, 1]
}

// Ruído coerente avulso, para quem precisa de uma consulta solta (o gerador
// de terreno). Cria a malha na hora e guarda em cache por semente+escala.
const malhasAvulsas = new Map();
function ruidoCoerente(semente, x, y, escala = ESCALA_RUIDO, largura = 256, altura = 256) {
  const chave = `${semente}|${escala}|${largura}x${altura}`;
  let malha = malhasAvulsas.get(chave);
  if (!malha) {
    malha = criarMalha(typeof semente === "number" ? semente : hashTexto(String(semente)), largura, altura, escala);
    malhasAvulsas.set(chave, malha);
  }
  return amostrarMalha(malha, x, y);
}

// Quando o mesmo campo é amostrado centenas de milhares de vezes (terreno e
// altitude), resolvemos a malha uma vez. Mantém exatamente o mesmo ruído,
// sem reconstruir chave de cache a cada tile.
export function amostradorRuidoCoerente(semente, escala = ESCALA_RUIDO, largura = 256, altura = 256) {
  const chave = `${semente}|${escala}|${largura}x${altura}`;
  let malha = malhasAvulsas.get(chave);
  if (!malha) {
    malha = criarMalha(typeof semente === "number" ? semente : hashTexto(String(semente)), largura, altura, escala);
    malhasAvulsas.set(chave, malha);
  }
  return (x, y) => amostrarMalha(malha, x, y);
}

// Ângulo próprio de cada zona, derivado do id. Sem isto, todos os vales do
// mundo apontariam na mesma direção — que é o tipo de repetição que denuncia
// mapa gerado.
function anguloDaZona(id) {
  return (hashTexto(`angulo:${id}`) % 360) * Math.PI / 180;
}

function prepararZonas(largura, altura) {
  return ZONAS_MUNDO.map((z, i) => {
    const perfil = PERFIL_FORMA[z.forma] || PERFIL_PADRAO;
    const ang = anguloDaZona(z.id);
    return {
      indice: i,
      zona: z,
      cx: z.centro.x * largura / CODEX_MAP_BASE_W,
      cy: z.centro.y * altura / CODEX_MAP_BASE_H,
      peso: z.peso || 1,
      ax: perfil.ax,
      ay: perfil.ay,
      amplitude: perfil.ruido,
      cos: Math.cos(ang),
      sen: Math.sin(ang),
      malha: criarMalha(hashTexto(`zona:${z.id}`), largura, altura),
    };
  });
}

let cache = null;

// Mapa de posse: Int16Array de largura*altura com o ÍNDICE da zona dona de
// cada tile. Calculado uma vez e reaproveitado — 224x176 tiles contra 42
// zonas é 1,6 milhão de comparações, coisa de poucos décimos de segundo uma
// vez na vida do processo, e zero nas chamadas seguintes.
export function mapaDePosse(largura, altura) {
  if (cache && cache.largura === largura && cache.altura === altura) return cache;
  const zonas = prepararZonas(largura, altura);
  const posse = new Int16Array(largura * altura);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      let melhor = 0;
      let melhorCusto = Infinity;
      for (let i = 0; i < zonas.length; i += 1) {
        const z = zonas[i];
        // Distância no eixo PRÓPRIO da zona: gira o vetor para o ângulo dela
        // antes de esticar. É isso que faz um vale apontar para uma direção
        // sua em vez de para o leste, sempre.
        const dx = x - z.cx;
        const dy = y - z.cy;
        const rx = (dx * z.cos + dy * z.sen) / z.ax;
        const ry = (-dx * z.sen + dy * z.cos) / z.ay;
        const dist = Math.sqrt(rx * rx + ry * ry) / z.peso;
        // Poda: o ruído só consegue subtrair `amplitude`. Se nem no melhor
        // caso esta zona ganha, nem vale amostrar a malha dela. Corta a
        // esmagadora maioria das amostragens sem mudar um único tile do
        // resultado.
        if (dist - z.amplitude >= melhorCusto) continue;
        const custo = dist - z.amplitude * amostrarMalha(z.malha, x, y);
        if (custo < melhorCusto) { melhorCusto = custo; melhor = i; }
      }
      posse[y * largura + x] = melhor;
    }
  }
  cache = { largura, altura, posse, zonas };
  return cache;
}

export function zonaIndiceNoPonto(x, y, largura, altura) {
  if (x < 0 || y < 0 || x >= largura || y >= altura) return -1;
  return mapaDePosse(largura, altura).posse[y * largura + x];
}

export function zonaDoPonto(x, y, largura, altura) {
  const i = zonaIndiceNoPonto(x, y, largura, altura);
  return i < 0 ? null : ZONAS_MUNDO[i];
}

// Bounding box + área real de cada zona, medidas do mapa de posse. A caixa
// deixou de DEFINIR a zona e passou a ser um resumo dela — usada só por quem
// precisa de um retângulo (a câmera do Atlas, o ponto de chegada da viagem
// rápida), nunca para decidir de quem é um tile.
let cacheResumo = null;
export function resumoDasZonas(largura, altura) {
  if (cacheResumo && cacheResumo.largura === largura && cacheResumo.altura === altura) return cacheResumo.lista;
  const { posse } = mapaDePosse(largura, altura);
  const acc = ZONAS_MUNDO.map(() => ({ x0: Infinity, y0: Infinity, x1: -1, y1: -1, area: 0, somaX: 0, somaY: 0 }));
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const a = acc[posse[y * largura + x]];
      if (x < a.x0) a.x0 = x;
      if (y < a.y0) a.y0 = y;
      if (x > a.x1) a.x1 = x;
      if (y > a.y1) a.y1 = y;
      a.area += 1; a.somaX += x; a.somaY += y;
    }
  }
  const lista = ZONAS_MUNDO.map((z, i) => {
    const a = acc[i];
    const vazia = a.area === 0;
    return {
      ...z,
      x0: vazia ? z.centro.x : a.x0, y0: vazia ? z.centro.y : a.y0,
      x1: vazia ? z.centro.x : a.x1, y1: vazia ? z.centro.y : a.y1,
      area: a.area,
      // Centro de MASSA do território, que é onde a zona realmente está —
      // diferente do centro declarado, que é só a semente da disputa.
      centroReal: vazia ? { ...z.centro } : { x: Math.round(a.somaX / a.area), y: Math.round(a.somaY / a.area) },
    };
  });
  cacheResumo = { largura, altura, lista };
  return lista;
}

// Fronteiras: quais zonas se tocam de verdade no mapa de posse, e em quantos
// tiles. Substitui o grafo por bounding box da ETAPA 1 — que era exato
// enquanto as zonas eram retângulos e passaria a ser ficção agora.
let cacheFronteiras = null;
export function fronteirasDasZonas(largura, altura) {
  if (cacheFronteiras && cacheFronteiras.largura === largura && cacheFronteiras.altura === altura) return cacheFronteiras.mapa;
  const { posse } = mapaDePosse(largura, altura);
  const contagem = new Map();
  const chave = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const a = posse[y * largura + x];
      if (x + 1 < largura) {
        const b = posse[y * largura + x + 1];
        if (a !== b) contagem.set(chave(a, b), (contagem.get(chave(a, b)) || 0) + 1);
      }
      if (y + 1 < altura) {
        const b = posse[(y + 1) * largura + x];
        if (a !== b) contagem.set(chave(a, b), (contagem.get(chave(a, b)) || 0) + 1);
      }
    }
  }
  // Uma fronteira de dois ou três tiles é ruído da malha, não vizinhança:
  // duas zonas que se encostam por um canto não formam caminho. O corte em 6
  // tiles descarta esses encontros acidentais.
  const MINIMO_FRONTEIRA = 6;
  const mapa = new Map(ZONAS_MUNDO.map((z) => [z.id, []]));
  for (const [k, n] of contagem) {
    if (n < MINIMO_FRONTEIRA) continue;
    const [a, b] = k.split("|").map(Number);
    mapa.get(ZONAS_MUNDO[a].id).push({ id: ZONAS_MUNDO[b].id, tiles: n });
    mapa.get(ZONAS_MUNDO[b].id).push({ id: ZONAS_MUNDO[a].id, tiles: n });
  }
  for (const lista of mapa.values()) lista.sort((p, q) => q.tiles - p.tiles);
  cacheFronteiras = { largura, altura, mapa };
  return mapa;
}

// Ruído exportado porque o gerador de terreno usa a MESMA função para
// decidir relevo e vegetação — assim o desenho do chão acompanha a forma da
// zona em vez de brigar com ela.
export { ruidoCoerente };

// Usado pelos testes e pelo diagnóstico.
export function limparCache() { cache = null; cacheResumo = null; cacheFronteiras = null; }
