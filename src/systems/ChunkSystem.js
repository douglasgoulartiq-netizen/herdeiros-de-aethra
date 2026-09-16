// SISTEMA DE CHUNKS (ETAPA 1, task #36).
//
// O mapa é cortado em quadrados de 32x32 tiles. Cada objeto do mundo (baú,
// nó de coleta, entrada de masmorra, chefe, fogueira, saída) fica indexado no
// chunk em que mora, e o jogo passa a perguntar "o que existe perto de mim?"
// em vez de varrer o mundo inteiro.
//
// Por que isso é performance de verdade e não arquitetura por esporte: hoje
// `objetosAtivos()` é chamada a cada quadro — 60 vezes por segundo — e
// reconstrói a lista inteira do zero, incluindo um `dados.monsters.find()`
// por chefe de zona. São 21 chefes e ~50 monstros: mil e cem comparações por
// quadro, mais setenta objetos alocados, sessenta vezes por segundo, para
// desenhar os cinco ou seis que cabem na tela. Com o índice, a resposta sai
// de um balde já pronto.
//
// O módulo é puro (nenhum DOM, nenhuma dependência do estado do jogo), então
// dá pra testar inteiro em Node.
//
// Vocabulário:
//   grade   — quantos chunks cabem no mapa: { colunas, linhas, tamanho }
//   chave   — identificador de um chunk: "cx,cy"
//   índice  — Map de chave -> lista de fontes de objeto daquele chunk
//   ativos  — conjunto de chaves ao redor do jogador (o que está "carregado")

export const TAMANHO_CHUNK = 32;

// Raio padrão em chunks. 1 significa o bloco 3x3 centrado no chunk do
// jogador: 96x96 tiles, muito maior que a janela visível (15x10 tiles), o
// que garante que nada apareça "surgindo" na borda da tela. O teste cobra
// justamente isso.
export const RAIO_PADRAO = 1;

export function gradeDeChunks(largura, altura, tamanho = TAMANHO_CHUNK) {
  return {
    tamanho,
    colunas: Math.max(1, Math.ceil(largura / tamanho)),
    linhas: Math.max(1, Math.ceil(altura / tamanho)),
    largura,
    altura,
  };
}

export const chaveChunk = (cx, cy) => `${cx},${cy}`;

// Chunk que contém o tile (x, y). Coordenada negativa não acontece no jogo,
// mas Math.floor mantém o comportamento correto se um dia acontecer.
export function chunkDoPonto(x, y, tamanho = TAMANHO_CHUNK) {
  return { cx: Math.floor(x / tamanho), cy: Math.floor(y / tamanho) };
}

export const chaveDoPonto = (x, y, tamanho = TAMANHO_CHUNK) => {
  const { cx, cy } = chunkDoPonto(x, y, tamanho);
  return chaveChunk(cx, cy);
};

// Retângulo de tiles coberto por um chunk (fim inclusivo, já recortado pelo
// tamanho real do mapa).
export function limitesDoChunk(cx, cy, grade) {
  const t = grade.tamanho;
  return {
    x0: cx * t, y0: cy * t,
    x1: Math.min(grade.largura - 1, cx * t + t - 1),
    y1: Math.min(grade.altura - 1, cy * t + t - 1),
  };
}

export function todasAsChaves(grade) {
  const chaves = [];
  for (let cy = 0; cy < grade.linhas; cy += 1) for (let cx = 0; cx < grade.colunas; cx += 1) chaves.push(chaveChunk(cx, cy));
  return chaves;
}

// Conjunto de chunks ativos ao redor de (x, y). Recortado pela grade — o
// bloco 3x3 vira 2x2 no canto do mapa, e não inventa chunk que não existe.
export function chunksAtivos(x, y, grade, raio = RAIO_PADRAO) {
  const { cx, cy } = chunkDoPonto(x, y, grade.tamanho);
  const chaves = new Set();
  for (let dy = -raio; dy <= raio; dy += 1) {
    for (let dx = -raio; dx <= raio; dx += 1) {
      const nx = cx + dx; const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grade.colunas || ny >= grade.linhas) continue;
      chaves.add(chaveChunk(nx, ny));
    }
  }
  return chaves;
}

// O que entrou e o que saiu entre dois conjuntos de chunks ativos. É o
// gancho de streaming: a ETAPA 2 pendura aqui "gerar o conteúdo do chunk que
// entrou" e "descarregar o que saiu", sem mexer em mais nada.
export function diferencaDeChunks(antes, depois) {
  const anterior = antes || new Set();
  const entrando = [...depois].filter((k) => !anterior.has(k));
  const saindo = [...anterior].filter((k) => !depois.has(k));
  return { entrando, saindo, mudou: entrando.length > 0 || saindo.length > 0 };
}

// --- Índice espacial -------------------------------------------------------
// `fontes` é uma lista de objetos com pelo menos { x, y }. O índice guarda
// as REFERÊNCIAS, nunca cópias: o baú que o jogador abrir continua sendo o
// mesmo objeto indexado, então estado mutável (aberto, disponível,
// derrotado) nunca fica desatualizado no índice.
export function criarIndice(grade, fontes = []) {
  const baldes = new Map();
  const indice = { grade, baldes, total: 0 };
  fontes.forEach((f) => inserir(indice, f));
  return indice;
}

export function inserir(indice, fonte) {
  if (!fonte || !Number.isFinite(fonte.x) || !Number.isFinite(fonte.y)) return false;
  const chave = chaveDoPonto(fonte.x, fonte.y, indice.grade.tamanho);
  if (!indice.baldes.has(chave)) indice.baldes.set(chave, []);
  indice.baldes.get(chave).push(fonte);
  indice.total += 1;
  return true;
}

export const objetosNoChunk = (indice, chave) => indice.baldes.get(chave) || [];

// Todas as fontes dos chunks ativos ao redor de (x, y), na ordem em que
// foram inseridas dentro de cada chunk. A ordem entre chunks segue a ordem
// de leitura (esquerda→direita, cima→baixo), então o resultado é estável
// entre quadros — sem isso, objetos no mesmo tile ficariam piscando um por
// cima do outro.
export function objetosPerto(indice, x, y, raio = RAIO_PADRAO) {
  const ativos = chunksAtivos(x, y, indice.grade, raio);
  const saida = [];
  for (let cy = 0; cy < indice.grade.linhas; cy += 1) {
    for (let cx = 0; cx < indice.grade.colunas; cx += 1) {
      const chave = chaveChunk(cx, cy);
      if (!ativos.has(chave)) continue;
      const balde = indice.baldes.get(chave);
      if (balde) saida.push(...balde);
    }
  }
  return saida;
}

// Fontes num raio de tiles (quadrado de Chebyshev, que é a vizinhança que o
// jogo usa pra interação: "encostado, inclusive na diagonal"). Consulta só
// os chunks que o quadrado toca.
export function objetosNoRaioDeTiles(indice, x, y, raioTiles) {
  const t = indice.grade.tamanho;
  const cx0 = Math.max(0, Math.floor((x - raioTiles) / t));
  const cx1 = Math.min(indice.grade.colunas - 1, Math.floor((x + raioTiles) / t));
  const cy0 = Math.max(0, Math.floor((y - raioTiles) / t));
  const cy1 = Math.min(indice.grade.linhas - 1, Math.floor((y + raioTiles) / t));
  const saida = [];
  for (let cy = cy0; cy <= cy1; cy += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (const f of indice.baldes.get(chaveChunk(cx, cy)) || []) {
        if (Math.max(Math.abs(f.x - x), Math.abs(f.y - y)) <= raioTiles) saida.push(f);
      }
    }
  }
  return saida;
}

// Diagnóstico: distribuição de objetos pelos chunks. Um chunk com metade do
// mundo dentro dele quer dizer que o tamanho do chunk está errado pra esse
// mapa.
export function estatisticasDoIndice(indice) {
  const ocupados = [...indice.baldes.values()].filter((b) => b.length);
  const tamanhos = ocupados.map((b) => b.length);
  return {
    total: indice.total,
    chunks: indice.grade.colunas * indice.grade.linhas,
    chunksOcupados: ocupados.length,
    maiorChunk: tamanhos.length ? Math.max(...tamanhos) : 0,
    mediaPorChunkOcupado: tamanhos.length ? +(indice.total / tamanhos.length).toFixed(2) : 0,
  };
}
