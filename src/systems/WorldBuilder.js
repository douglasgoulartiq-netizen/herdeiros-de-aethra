// GERADOR DO MUNDO (ETAPA 2).
//
// Transforma os dados de src/data/world/ num mapa de tiles jogável. A ordem
// dos passos não é arbitrária — cada um depende do anterior:
//
//   1. TERRENO      cada tile recebe a identidade da região dona (neve,
//                   cinza, brejo, coral) e o desenho da forma da zona
//                   (cânion tem parede, arquipélago tem canal, cratera tem
//                   anel);
//   2. MAR          a borda do mapa vira oceano com contorno irregular, pra
//                   o continente ter costa em vez de terminar numa reta;
//   3. RIOS         nascente → foz, descendo o terreno já formado. Sem terreno
//                   não há por onde descer;
//   4. ASSENTAMENTOS  aplanam o chão e se dividem em distritos. Precisam vir
//                   depois do rio: cidade portuária quer ficar NA água;
//   5. ESTRADAS     ligam assentamento a assentamento por busca de menor
//                   custo. Precisam do rio pra saber onde a ponte vai;
//   6. PONTES       nascem sozinhas onde a estrada cruzou água;
//   7. OBJETOS      baú, nó de recurso, POI, landmark, boca de masmorra e
//                   chefe, cada um num tile andável da sua própria zona;
//   8. ACESSO       garantia final de que dá pra chegar a pé em tudo.
//
// Determinismo: tudo aqui é função da semente (ver WorldSeed.js). A partição
// política do território NÃO é — ela é canônica e igual pra todo mundo (ver
// WorldLayout.js). Duas pessoas com a mesma semente veem o mesmo mapa; duas
// pessoas com sementes diferentes veem o mesmo Deserto de Karn com outras
// dunas.
import {
  TILE, SOLID_TILES, TILES_AGUA, OVERWORLD_W, OVERWORLD_H,
} from "../data/worldMap.js";
import { ZONAS_MUNDO } from "../data/world/zones.js";
import { identidadeDaRegiao } from "../data/world/regionIdentity.js";
import { mapaDePosse, resumoDasZonas, ruidoCoerente, amostradorRuidoCoerente } from "../data/world/WorldLayout.js";
import { ASSENTAMENTOS, CATEGORIAS, POIS, LANDMARKS, MASMORRAS_MUNDO } from "../data/world/settlements.js";
import { ESTRADAS_PRINCIPAIS, CAMINHOS_SECRETOS, RIOS, NIVEIS_ESTRADA } from "../data/world/routes.js";
import { prngDe, hashTexto, embaralhar } from "./WorldSeed.js";
import { PROPS, tilesDeColisao } from "../data/propRegistry.js";

const W = OVERWORLD_W;
const H = OVERWORLD_H;
const idx = (x, y) => y * W + x;
const dentro = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

// ---------------------------------------------------------------------------
// Fila de prioridade. A busca de estrada sem isto vira varredura do mapa
// inteiro a cada passo — o que, com 66 estradas, seriam alguns segundos de
// tela parada.
// ---------------------------------------------------------------------------
//
// Guardada em dois arrays tipados em vez de um objeto {no, prioridade} por
// entrada: com o mundo 4x maior a busca de estrada inseria milhões de objetos
// e o coletor de lixo virava parte do tempo de carregamento. As comparações e
// as trocas são exatamente as mesmas da versão com objetos, então a ordem de
// saída — e com ela o traçado de cada estrada — não muda.
class FilaMinima {
  constructor() {
    this.nos = new Int32Array(1024);
    this.pri = new Float64Array(1024);
    this.n = 0;
  }
  get tamanho() { return this.n; }
  crescer() {
    const nos = new Int32Array(this.nos.length * 2); nos.set(this.nos); this.nos = nos;
    const pri = new Float64Array(this.pri.length * 2); pri.set(this.pri); this.pri = pri;
  }
  inserir(no, prioridade) {
    if (this.n === this.nos.length) this.crescer();
    const nos = this.nos; const pri = this.pri;
    let i = this.n++;
    nos[i] = no; pri[i] = prioridade;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (pri[pai] <= pri[i]) break;
      const tn = nos[pai]; nos[pai] = nos[i]; nos[i] = tn;
      const tp = pri[pai]; pri[pai] = pri[i]; pri[i] = tp;
      i = pai;
    }
  }
  retirar() {
    const nos = this.nos; const pri = this.pri;
    const topo = nos[0];
    this.n -= 1;
    const n = this.n;
    if (n) {
      nos[0] = nos[n]; pri[0] = pri[n];
      let i = 0;
      for (;;) {
        const e = i * 2 + 1; const d = e + 1;
        let menor = i;
        if (e < n && pri[e] < pri[menor]) menor = e;
        if (d < n && pri[d] < pri[menor]) menor = d;
        if (menor === i) break;
        const tn = nos[menor]; nos[menor] = nos[i]; nos[i] = tn;
        const tp = pri[menor]; pri[menor] = pri[i]; pri[i] = tp;
        i = menor;
      }
    }
    return topo;
  }
}

// ---------------------------------------------------------------------------
// 1. TERRENO — identidade regional + forma da zona
// ---------------------------------------------------------------------------
//
// CALIBRAÇÃO DO RUÍDO — por que "densidade 0,10" saía como 3%
// ------------------------------------------------------------
// `mistura` declara frações: Altaverde pede 10% de árvore e 5% de arbusto. O
// código comparava o ruído direto contra a densidade (vezes um fator 1,25 de
// correção) e o resultado MEDIDO no mapa inteiro foi 3,0% de árvore — menos
// de um terço do declarado. Perto da vila inicial, SETE árvores num raio de
// vinte tiles: uma região de floresta sem floresta.
//
// A causa estava no comentário que já existia aqui: ruído de valor
// interpolado não é uniforme. Ele se acumula perto de 0,5 e visita as pontas
// muito menos que um sorteio simples, então um limiar de 0,10 corta uma fatia
// bem menor que 10% da distribuição — e quanto MENOR a densidade pedida,
// maior o erro proporcional. Multiplicar por 1,25 não conserta isso: é um
// número achado à mão para um caso, aplicado a todos.
//
// A correção é MEDIR em vez de chutar. `limiarDeDensidade` amostra o próprio
// campo de ruído, ordena e devolve o valor no quantil pedido. Por construção,
// o limiar devolvido para 0,10 corta 10% daquele campo. Continua
// determinístico: as amostras saem de um PRNG semeado com a mesma chave do
// campo, então a mesma semente dá o mesmo mapa.
const AMOSTRAS_CALIBRAGEM = 1400;
const cacheLimiar = new Map();
// `pontos` são os tiles em que a densidade deve valer. Amostrar o mapa
// inteiro responde a pergunta errada quando a densidade é de uma ZONA: o
// campo de ruído é o mesmo em todo lugar, mas cada zona ocupa um pedaço dele,
// e uma zona que calhe de cair numa parte alta do campo sai quase sem copa.
// Foi o que aconteceu com o Bosque Sombrio, medido em 27% quando o pedido era
// 58% — e uma janela quadrada em volta do centro declarado não resolveu,
// porque os territórios são orgânicos e não cabem num quadrado.
function limiarDeDensidade(chave, campo, densidade, pontos = null) {
  const memo = `${chave}|${densidade}`;
  const guardado = cacheLimiar.get(memo);
  if (guardado !== undefined) return guardado;
  const rnd = prngDe(chave, "calibragem");
  const n = pontos ? Math.min(AMOSTRAS_CALIBRAGEM, pontos.length) : AMOSTRAS_CALIBRAGEM;
  const valores = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    if (pontos) {
      const p = pontos[Math.floor(rnd() * pontos.length)];
      valores[i] = campo(p.x, p.y);
    } else {
      valores[i] = campo(Math.floor(rnd() * W), Math.floor(rnd() * H));
    }
  }
  valores.sort();
  const pos = Math.min(valores.length - 1, Math.max(0, Math.round(densidade * (valores.length - 1))));
  const limiar = valores[pos];
  cacheLimiar.set(memo, limiar);
  return limiar;
}
export function limparCacheCalibragem() { cacheLimiar.clear(); }

function pintarTerreno(g, semente, posse, zonas) {
  // Uma malha de ruído por zona, com a semente do MUNDO misturada: a forma do
  // território é canônica, mas onde exatamente cai cada árvore muda de semente
  // para semente.
  // Cache em três níveis (zona → camada → escala) em vez de uma chave de
  // texto montada a cada consulta: o terreno faz ~2 milhões delas no mundo 4x.
  const sementesRuido = new Map();
  const amostradorDe = (zonaId, camada, escala) => {
    let porCamada = sementesRuido.get(zonaId);
    if (!porCamada) { porCamada = new Map(); sementesRuido.set(zonaId, porCamada); }
    let porEscala = porCamada.get(camada);
    if (!porEscala) { porEscala = new Map(); porCamada.set(camada, porEscala); }
    let amostrar = porEscala.get(escala);
    if (!amostrar) {
      amostrar = amostradorRuidoCoerente(hashTexto(`${semente}:${zonaId}:${camada}`), escala, W, H);
      porEscala.set(escala, amostrar);
    }
    return amostrar;
  };
  const ruido = (zonaId, camada, x, y, escala) => amostradorDe(zonaId, camada, escala)(x, y);

  // Amostra de tiles REAIS de cada zona, para a calibragem de densidade saber
  // de que pedaço do campo de ruído está falando. Passo 3 nos dois eixos:
  // ~11% dos tiles, determinístico, e uma varredura só.
  const amostrasDaZona = new Map();
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      const zi = posse[idx(x, y)];
      let lista = amostrasDaZona.get(zi);
      if (!lista) { lista = []; amostrasDaZona.set(zi, lista); }
      lista.push({ x, y });
    }
  }

  const perfis = zonas.map((z, zi) => {
    const ident = identidadeDaRegiao(z.regiaoId);
    const pontos = amostrasDaZona.get(zi) || null;
    const limiares = ident.mistura.map(([, densidade], c) =>
      limiarDeDensidade(`${semente}:${z.id}:mix${c}`,
        (px, py) => ruido(z.id, `mix${c}`, px, py, 7), densidade, pontos));
    // Um amostrador por camada de mistura, resolvido antes do laço de tiles.
    const misturas = ident.mistura.map((_, c) => amostradorDe(z.id, `mix${c}`, 7));
    return { ident, pontos, limiares, misturas };
  });

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const zi = posse[idx(x, y)];
      const z = zonas[zi];
      const { ident, pontos: amostras, limiares, misturas } = perfis[zi];
      let tile = ident.chao;

      // Mistura da região: manchas coerentes, não chuvisco. Ruído suave
      // cortado por um limiar dá bosque, pedregulho, poça — formas com borda,
      // que é o que faz o terreno parecer terreno.
      //
      // O limiar vem calibrado (ver acima): "densidade 0,10" agora significa
      // 10% dos tiles daquela zona, e não "algum número menor que ninguém
      // mediu".
      for (let c = 0; c < ident.mistura.length; c += 1) {
        const [tileMistura] = ident.mistura[c];
        const limiar = limiares[c];
        if (misturas[c](x, y) < limiar) tile = tileMistura;
      }

      // Forma da zona: a diferença entre um cânion e uma planície de mesma
      // cor. Cada caso mexe no relevo ou na água, nunca só na paleta (item 33).
      tile = aplicarForma(tile, z, ident, x, y, ruido, semente, amostras);
      g[y][x] = tile;
    }
  }
}

function aplicarForma(tile, z, ident, x, y, ruido, semente, amostras = null) {
  const dx = x - z.centro.x * W / 224;
  const dy = y - z.centro.y * H / 176;
  const dist = Math.hypot(dx, dy);
  const n = (v, escala) => ruido(z.id, v, x, y, escala);
  // Mesmo campo de ruído, mas amostrável em qualquer ponto — é o que a
  // calibragem de densidade precisa (ela varre o mapa, não só este tile).
  const n2 = (v, px, py, escala) => ruido(z.id, v, px, py, escala);

  switch (z.forma) {
    case "cordilheira": {
      // Barreira de verdade (item 9): a espinha é sólida, e o que abre passe
      // é a estrada — não uma clareira decorativa.
      // 0,35 sobre ruído em [-1,1] deixa ~35% da zona como rocha. A primeira
      // versão usava 0,55 e a cordilheira virava um muro quase maciço: a
      // região inteira ficava intransponível e o mapa perdia metade da área
      // andável.
      const espinha = Math.abs(n("espinha", 18));
      if (espinha < 0.35) return ident.relevo;
      if (espinha < 0.50 && n("saia", 9) > 0.35) return ident.relevo;
      return tile;
    }
    case "canyon": {
      // Fenda: paredes nos dois lados, chão no meio.
      const parede = Math.abs(n("fenda", 12));
      if (parede > 0.52) return ident.relevo;
      if (parede > 0.44 && n("borda", 6) > 0.3) return ident.relevo;
      return tile;
    }
    case "vale": {
      // Vale é o inverso do cânion: paredes longe do eixo, fundo limpo e
      // andável — é por onde se atravessa uma cordilheira.
      const eixo = Math.abs(n("eixo", 16));
      if (eixo > 0.62) return ident.relevo;
      if (eixo < 0.18) return tile === ident.relevo ? ident.chao : tile;
      return tile;
    }
    case "crateras": {
      // Anéis concêntricos: borda de cratera sólida, fundo aberto.
      const anel = (dist + n("anel", 20) * 9) % 26;
      if (anel < 3.2) return ident.relevo;
      if (anel > 22 && n("interno", 8) > 0.4) return ident.agua;
      return tile;
    }
    case "arquipelago": {
      // Ilhas separadas por canal intransponível: aqui a ponte não é conforto,
      // é a única forma de existir caminho.
      // O canal precisa ser estreito o bastante pra caber ponte e largo o
      // bastante pra ser obstáculo. Em -0,10 o arquipélago virava mar com
      // pedras dentro.
      const massa = n("ilha", 11);
      if (massa < -0.30) return ident.agua === TILE.DEEP_WATER ? TILE.DEEP_WATER : TILE.WATER;
      if (massa < -0.18) return TILE.SAND;
      return tile;
    }
    case "pantano": {
      const poca = n("poca", 6);
      if (poca > 0.46) return TILE.WATER;
      if (poca > 0.22) return TILE.MARSH;
      return tile;
    }
    case "delta": {
      // Braços de água que se abrem em leque a partir do centro.
      const braco = Math.abs(n("braco", 8));
      if (braco < 0.085) return ident.agua === TILE.LAVA ? TILE.LAVA : TILE.WATER;
      return tile;
    }
    case "peninsula": {
      // Terra que avança sobre o mar: água cresce com a distância do centro.
      const mar = dist / 34 + n("mar", 14) * 0.5;
      if (mar > 1.55) return TILE.DEEP_WATER;
      if (mar > 1.28) return TILE.WATER;
      if (mar > 1.14) return TILE.SAND;
      return tile;
    }
    case "floresta": {
      // ESTE CASO NÃO FAZIA NADA.
      //
      // A condição era `ident.relevo === TILE.TREE ? TILE.TREE : tile`, e
      // NENHUMA região do jogo declara relevo de árvore — relevo é rocha em
      // todas elas, sem exceção. Ou seja: toda zona de forma "floresta" caía
      // no `: tile` e ficava sendo só a mistura base da região. A Floresta
      // Sussurrante, o Bosque das Vozes e o Bosque Eterno eram campo aberto.
      //
      // Agora a mata é feita de verdade, em dois níveis: o miolo fecha em
      // árvore e a orla vira sub-bosque de arbusto. Os dois usam limiar
      // calibrado, então "60% de copa" quer dizer 60%.
      // A calibragem amostra os tiles REAIS da zona (ver limiarDeDensidade).
      const campoMata = (px, py) => n2("mata", px, py, 5);
      const chaveMata = `${semente}:${z.id}:mata`;
      const fechada = limiarDeDensidade(chaveMata, campoMata, 0.58, amostras);
      const orla = limiarDeDensidade(chaveMata, campoMata, 0.78, amostras);
      const v = n("mata", 5);
      if (v < fechada) return TILE.TREE;
      if (v < orla) return n("sub", 4) > 0 ? TILE.BUSH : TILE.TALL_GRASS;
      return tile;
    }
    case "urbana": {
      // ESTE CASO APAGAVA A MATA DA ZONA ONDE O JOGO COMEÇA.
      //
      // A regra era "todo tile sólido que não seja água vira chão", aplicada
      // à ZONA INTEIRA. Como TREE e BUSH são sólidos, a zona da Vila de
      // Aethra perdia cada árvore e cada arbusto — foi a causa direta das
      // sete árvores num raio de vinte tiles em volta do spawn.
      //
      // A intenção original era legítima: o assentamento não pode nascer
      // dentro de uma mata fechada. Mas isso é uma questão de alguns tiles em
      // volta do centro, não da zona toda. Agora só o miolo é limpo; o resto
      // da zona mantém o bosque, que é o que faz a vila parecer uma clareira
      // numa floresta em vez de um tapete de grama.
      if (dist < 10 && SOLID_TILES.has(tile) && tile !== TILE.WATER) return ident.chao;
      return tile;
    }
    default:
      return tile;
  }
}

// ---------------------------------------------------------------------------
// 2. MAR — o contorno do continente
// ---------------------------------------------------------------------------
// Sem isto o mundo termina numa linha reta em cada lado, e a primeira coisa
// que o jogador aprende é que o mapa é um retângulo. A margem tem largura
// irregular pra costa parecer costa.
function desenharOceano(g, semente) {
  const ruido = (lado, v) => ruidoCoerente(hashTexto(`${semente}:costa:${lado}`), v, 0, 9, Math.max(W, H), 1);
  for (let x = 0; x < W; x += 1) {
    const topo = 3 + Math.round((ruido("n", x) + 1) * 3);
    const base = 3 + Math.round((ruido("s", x) + 1) * 3);
    for (let y = 0; y < topo; y += 1) g[y][x] = y < topo - 1 ? TILE.DEEP_WATER : TILE.WATER;
    for (let y = H - base; y < H; y += 1) g[y][x] = y > H - base ? TILE.DEEP_WATER : TILE.WATER;
  }
  for (let y = 0; y < H; y += 1) {
    const oeste = 3 + Math.round((ruido("o", y) + 1) * 3);
    const leste = 3 + Math.round((ruido("l", y) + 1) * 3);
    for (let x = 0; x < oeste; x += 1) g[y][x] = x < oeste - 1 ? TILE.DEEP_WATER : TILE.WATER;
    for (let x = W - leste; x < W; x += 1) g[y][x] = x > W - leste ? TILE.DEEP_WATER : TILE.WATER;
  }
}

// Corallia é um arquipélago, não uma península ligada por uma estrada
// invisível. A faixa marítima acompanha a fronteira orgânica das zonas do
// recife; uma expansão do mundo não a transforma numa linha reta artificial.
function isolarArquipelagoCoral(g, posse) {
  const ilha = new Uint8Array(W * H);
  const distancia = new Uint8Array(W * H);
  const fila = new Int32Array(W * H);
  let fim = 0;
  for (let i = 0; i < ilha.length; i += 1) {
    if (ZONAS_MUNDO[posse[i]]?.regiaoId !== "recife_coralino") continue;
    ilha[i] = 1;
    fila[fim++] = i;
  }
  for (let inicio = 0; inicio < fim; inicio += 1) {
    const i = fila[inicio];
    const x = i % W; const y = (i - x) / W;
    if (distancia[i] >= 7) continue;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (!dentro(nx, ny)) continue;
      const j = idx(nx, ny);
      if (ilha[j] || distancia[j]) continue;
      distancia[j] = distancia[i] + 1;
      fila[fim++] = j;
      g[ny][nx] = distancia[j] <= 2 ? TILE.WATER : TILE.DEEP_WATER;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. RIOS — nascente, trajeto, foz
// ---------------------------------------------------------------------------
// O traçado é um passeio guiado: a cada passo o rio anda na direção da foz,
// com um desvio lateral vindo do ruído. Isso dá meandro sem risco de nunca
// chegar — a componente na direção do destino é sempre maior que o desvio.
// Distância de cada tile de TERRA até a água mais próxima. Usada para
// terminar rio: enquanto o valor não for zero, o rio ainda não chegou a lugar
// nenhum.
function campoDistanciaAteAgua(g) {
  const dist = new Int16Array(W * H).fill(-1);
  const fila = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (TILES_AGUA.has(g[y][x])) { dist[idx(x, y)] = 0; fila.push(idx(x, y)); }
    }
  }
  for (let i = 0; i < fila.length; i += 1) {
    const p = fila[i]; const x = p % W; const y = (p - x) / W;
    for (let d = 0; d < 4; d += 1) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!dentro(nx, ny) || dist[idx(nx, ny)] !== -1) continue;
      dist[idx(nx, ny)] = dist[p] + 1;
      fila.push(idx(nx, ny));
    }
  }
  return dist;
}

function cavarRios(g, semente, resumo, registro) {
  const porId = new Map(resumo.map((z) => [z.id, z]));
  // Medida ANTES de cavar: é a água que já existe (mar da borda, lagos das
  // regiões). É contra ela que cada rio é obrigado a terminar.
  const ateAgua = campoDistanciaAteAgua(g);
  for (const rio of RIOS) {
    const nascente = porId.get(rio.nascente);
    const foz = porId.get(rio.foz);
    if (!nascente || !foz) continue;
    const a = nascente.centroReal;
    const b = foz.centroReal;
    const rnd = prngDe(semente, `rio:${rio.id}`);
    const pontos = [];
    let x = a.x;
    let y = a.y;
    const passos = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1.6) + 8;
    for (let p = 0; p < passos; p += 1) {
      pontos.push({ x: Math.round(x), y: Math.round(y) });
      const dx = b.x - x;
      const dy = b.y - y;
      const d = Math.hypot(dx, dy);
      if (d < 2) break;
      const desvio = (rnd() - 0.5) * 1.7;
      // avanço na direção da foz + desvio perpendicular = meandro que chega
      x += (dx / d) + (-dy / d) * desvio;
      y += (dy / d) + (dx / d) * desvio;
      if (!dentro(Math.round(x), Math.round(y))) break;
    }
    // FOZ DE VERDADE (item 7: "não criar rio que termina no nada").
    // O trajeto acima chega ao centro da zona de foz, que pode ser terra
    // seca — o Rio das Cinzas morria no meio do deserto e o Rio dos Reflexos
    // sumia nas ruínas. Daqui em diante o rio desce pelo caminho mais curto
    // até a primeira água que já existe: lago, pântano ou mar. Quando chega,
    // acabou; se em 80 passos não achou, para, mas isso não acontece num
    // continente cercado de oceano.
    //
    // A DESCIDA TAMBÉM MEANDRA.
    //
    // O trecho de cima já serpenteava; este não. Ele descia pelo gradiente do
    // campo de distância até a água, e gradiente puro em quatro direções
    // desenha CORREDOR RETO — foi ele que traçou a régua vertical de vinte
    // tiles ao lado da vila inicial, não a parte "com meandro".
    //
    // A correção mantém a garantia (o rio SEMPRE chega na água, que é a razão
    // desta etapa existir) e devolve a curva: o passo continua tendo de
    // aproximar da foz, mas ENTRE os vizinhos que aproximam a escolha é
    // sorteada com peso, então o leito oscila em vez de trilhar o gradiente.
    let fx = Math.round(x); let fy = Math.round(y);
    for (let passo = 0; passo < 120; passo += 1) {
      if (!dentro(fx, fy) || ateAgua[idx(fx, fy)] <= 0) break;
      const atual = ateAgua[idx(fx, fy)];
      const candidatos = [];
      for (let d = 0; d < 4; d += 1) {
        const nx = fx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = fy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (!dentro(nx, ny)) continue;
        const v = ateAgua[idx(nx, ny)];
        if (v >= 0 && v < atual) candidatos.push({ x: nx, y: ny, v });
      }
      if (!candidatos.length) break;
      // O que mais aproxima pesa 3; qualquer outro que ainda aproxime pesa 1.
      // O rio desce sempre, mas não em linha.
      const menor = Math.min(...candidatos.map((c) => c.v));
      const pesos = candidatos.map((c) => (c.v === menor ? 3 : 1));
      let sorteio = rnd() * pesos.reduce((acc, w) => acc + w, 0);
      let escolhido = candidatos[0];
      for (let i = 0; i < candidatos.length; i += 1) {
        sorteio -= pesos[i];
        if (sorteio < 0) { escolhido = candidatos[i]; break; }
      }
      fx = escolhido.x; fy = escolhido.y;
      pontos.push({ x: fx, y: fy });
    }
    // LARGURA MÍNIMA DE DOIS.
    //
    // O briefing proíbe "rio de 1 tile" e a medição mostrava trechos de um
    // tile só: com `largura: 1` o disco de corte tem raio efetivo de ~1,4, o
    // que dá três tiles no eixo reto mas UM na diagonal — e rio meandrante é
    // quase todo diagonal. Dois de base garante leito largo em qualquer
    // ângulo; o afluente continua mais estreito que o rio principal, que é a
    // hierarquia que `largura` existe para expressar.
    const larg = Math.max(2, rio.largura || 1);
    for (const p of pontos) {
      const zona = ZONAS_MUNDO[mapaDePosse(W, H).posse[idx(Math.min(W - 1, Math.max(0, p.x)), Math.min(H - 1, Math.max(0, p.y)))]];
      const tileAgua = identidadeDaRegiao(zona.regiaoId).agua;
      for (let oy = -larg; oy <= larg; oy += 1) {
        for (let ox = -larg; ox <= larg; ox += 1) {
          if (ox * ox + oy * oy > larg * larg + larg) continue;
          const nx = p.x + ox; const ny = p.y + oy;
          if (!dentro(nx, ny)) continue;
          g[ny][nx] = tileAgua;
        }
      }
    }
    registro.push({ id: rio.id, nome: rio.nome, nascente: rio.nascente, foz: rio.foz, pontos: pontos.length, afluenteDe: rio.afluenteDe || null });
  }
}

// ---------------------------------------------------------------------------
// 4. ASSENTAMENTOS — categoria, escala e distritos
// ---------------------------------------------------------------------------
function acharTileParaAssentamento(g, resumoZona, rnd, pegadaGlobal = new Set()) {
  // Procura em anéis a partir do centro de massa da zona: perto do meio,
  // fora d'água e fora de parede.
  const c = resumoZona.centroReal;
  for (let raio = 0; raio < 40; raio += 1) {
    const candidatos = [];
    for (let oy = -raio; oy <= raio; oy += 1) {
      for (let ox = -raio; ox <= raio; ox += 1) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== raio && raio > 0) continue;
        const x = c.x + ox; const y = c.y + oy;
        if (!dentro(x, y)) continue;
        if (TILES_AGUA.has(g[y][x])) continue;
        if (g[y][x] === TILE.LAVA) continue;
        // Não fundar cidade dentro de cidade: com os raios maiores as manchas
        // passaram a se tocar, e um centro dentro do vizinho faria a praça
        // nascer em cima das casas dele.
        if (pegadaGlobal.has(idx(x, y))) continue;
        candidatos.push({ x, y });
      }
    }
    if (candidatos.length) return candidatos[Math.floor(rnd() * candidatos.length)];
  }
  return { ...c };
}

// CIDADE QUE PARECE CIDADE
// ------------------------
// A versão anterior desenhava a mancha de calçada e depois sorteava
// `parede` em 62% dos tiles fora das ruas. O resultado medido na Vila de
// Aethra — a vila onde o jogo COMEÇA — foram DOIS tiles de prédio: a mancha
// tinha raio 4, a praça de 5x5 comia o miolo dela, e a estrada principal,
// carvada depois, passava por cima do resto. Uma "vila" de duas paredes
// soltas.
//
// A reconstrução tem três partes, e nenhuma inventa sistema novo:
//
//   ESCALA     os raios subiram (vila 4→7, cidade 7→11, capital 11→16) e
//              agora existe um alvo declarado de CASAS por categoria, que é o
//              número que o briefing cobra ("capital não pode ter 4 prédios").
//
//   PLANTA     rua principal + travessas em grade irregular; entre elas,
//              QUARTEIRÕES. A casa nasce dentro de um quarteirão, encostada
//              na rua, virada para ela — não em qualquer tile que sobrou.
//
//   CASA       cada casa é um PROP (arte de 4x4 a 8x7 tiles, ver
//              propRegistry.js) mais a colisão MEDIDA da própria arte pintada
//              no grid como `parede`. Ou seja: a casa passou a ser maior que
//              o personagem de verdade, e a colisão continua sendo tile —
//              nada no jogo precisa saber que props existem para bater nela.
const CASAS_POR_CATEGORIA = {
  CAPITAL: { alvo: 58, grandes: 0.46, templo: true },
  CIDADE: { alvo: 30, grandes: 0.34, templo: true },
  VILA: { alvo: 13, grandes: 0.20, templo: false },
  ASSENTAMENTO: { alvo: 6, grandes: 0.10, templo: false },
  ACAMPAMENTO: { alvo: 3, grandes: 0, templo: false },
};

// Uma casa cabe aqui?
//
// A regra é só sobre a COLISÃO — a parede. A primeira versão também reservava
// o espaço do TELHADO, e o resultado foi uma capital com sete prédios: cada
// casa bloqueava 16 tiles em vez de 8, e a mancha urbana acabava antes das
// casas. Sobreposição de telhado não é problema, é como uma cidade se parece:
// o y-sort já desenha o prédio de trás primeiro, e o da frente cobre parte
// dele. O que não pode acontecer é duas paredes no mesmo tile, ou uma parede
// em cima de outra — isso fecharia passagem.
function cabeACasa(g, prop, ocupado) {
  for (const t of tilesDeColisao(prop)) {
    if (!dentro(t.x, t.y)) return false;
    if (ocupado.has(idx(t.x, t.y))) return false;
    if (TILES_AGUA.has(g[t.y][t.x])) return false;
    if (g[t.y][t.x] === TILE.LAVA) return false;
  }
  return true;
}

// Paletas urbanas por cultura/clima. As casas V2 compartilham a linguagem
// visual da pousada, mas cada território combina materiais e cores próprios.
// A categoria também participa: acampamentos continuam usando construções
// simples; cidades e capitais recebem solares de pedra entre as moradias.
function paletaUrbana(ident, categoria) {
  if (categoria === "ACAMPAMENTO") {
    return { comuns: ["casa_p"], grandes: ["casa_g"] };
  }
  if (ident.porto || ident.clima === "costeiro") {
    return {
      comuns: ["casa_costeira_v2", "casa_urbana_azul_v2", "casa_costeira_v2", "casa_urbana_vermelha_v2"],
      grandes: ["casa_costeira_v2", "casa_pedra_v2"],
    };
  }
  if (ident.clima === "nevado") {
    return {
      comuns: ["casa_pedra_v2", "casa_urbana_azul_v2", "casa_pedra_v2"],
      grandes: ["casa_pedra_v2"],
    };
  }
  if (ident.clima === "vulcanico" || ident.clima === "arido") {
    return {
      comuns: ["casa_pedra_v2", "casa_urbana_vermelha_v2", "casa_urbana_vermelha_v2"],
      grandes: ["casa_pedra_v2", "casa_urbana_vermelha_v2"],
    };
  }
  if (ident.clima === "umido") {
    return {
      comuns: ["casa_urbana_verde_v2", "casa_urbana_verde_v2", "casa_urbana_azul_v2"],
      grandes: ["casa_urbana_verde_v2", "casa_pedra_v2"],
    };
  }
  if (ident.clima === "sombrio" || ident.instavel) {
    return {
      comuns: ["casa_pedra_v2", "casa_urbana_verde_v2", "casa_urbana_azul_v2"],
      grandes: ["casa_pedra_v2"],
    };
  }
  if (ident.clima === "ventoso" || ident.ilhas) {
    return {
      comuns: ["casa_urbana_azul_v2", "casa_urbana_verde_v2", "casa_pedra_v2"],
      grandes: ["casa_urbana_azul_v2", "casa_pedra_v2"],
    };
  }
  return {
    comuns: ["casa_urbana_vermelha_v2", "casa_urbana_verde_v2", "casa_urbana_azul_v2"],
    grandes: ["casa_pedra_v2", "casa_urbana_vermelha_v2"],
  };
}

function sortearDaPaleta(ids, rnd) {
  return ids[Math.floor(rnd() * ids.length)] || ids[0];
}

function construirAssentamento(g, a, centro, ident, rnd, pegadaGlobal = new Set()) {
  const cat = CATEGORIAS[a.categoria];
  const raio = cat.raio;
  const plano = CASAS_POR_CATEGORIA[a.categoria] || CASAS_POR_CATEGORIA.ASSENTAMENTO;
  const tiles = [];
  // Mancha urbana com borda irregular — cidade não é um quadrado, nem um
  // círculo perfeito.
  for (let oy = -raio - 2; oy <= raio + 2; oy += 1) {
    for (let ox = -raio - 2; ox <= raio + 2; ox += 1) {
      const x = centro.x + ox; const y = centro.y + oy;
      if (!dentro(x, y)) continue;
      const d = Math.hypot(ox, oy) + (rnd() - 0.5) * 2.2;
      if (d > raio) continue;
      // CIDADE NÃO PAVIMENTA CIDADE.
      //
      // Os raios cresceram nesta reconstrução e duas capitais vizinhas
      // passaram a se sobrepor: a segunda a ser construída pintava calçada
      // por cima das casas da primeira, e o teste achou uma casa com um tile
      // de fachada faltando. Território já ocupado por outro assentamento
      // fica de fora da mancha desta — e, como a mancha é o que define onde
      // as casas podem nascer, nada mais precisa saber disso.
      if (pegadaGlobal.has(idx(x, y))) continue;
      // Vila elevada (Thalgor): o piso é passarela sobre a água, então a água
      // NÃO é aterrada — é o que distingue a silhueta dessas vilas.
      if (a.elevada && TILES_AGUA.has(g[y][x])) { g[y][x] = ident.arquitetura.piso; tiles.push({ x, y }); continue; }
      if (TILES_AGUA.has(g[y][x])) continue; // cidade portuária mantém a água da doca
      g[y][x] = ident.arquitetura.piso;
      tiles.push({ x, y });
    }
  }

  // --- planta: fileiras de casas -------------------------------------------
  //
  // Duas tentativas anteriores erraram por excesso de estrutura. A primeira
  // sorteava tiles e testava um por um: uma capital saía com OITO prédios,
  // porque uma casa tem 4 a 6 tiles de largura e quase nenhum sorteio caía
  // numa posição em que ela coubesse. A segunda montava uma grade de ruas por
  // resto de divisão com fase por banda — quando o sorteio de uma banda dava
  // zero, a coluna do centro virava rua inteira, e sobravam seis linhas de
  // rua seguidas no meio da vila.
  //
  // O que uma cidade vista de cima realmente é: FILEIRAS de casas, ombro a
  // ombro, com um vão de circulação entre uma fileira e a seguinte. É isso
  // que se desenha aqui, e nada mais. A casa ocupa duas linhas de parede; a
  // fileira seguinte começa `passoY` linhas adiante, deixando a faixa do meio
  // livre — essa faixa É a rua, e como toda a mancha é calçada, ela já está
  // desenhada. Sem grade invisível, sem fase, sem caso especial.
  // ESPAÇAMENTO ENTRE FILEIRAS.
  //
  // Com 3 a cidade ficou densa demais para ser LIDA: a arte da casa tem 4
  // tiles de altura (6 na casa grande) e só 2 de parede, então o telhado
  // cobria inteiramente o vão da fileira de cima — a screenshot virou uma
  // parede contínua de telhados, sem chão à vista, e o jogador não enxergava
  // por onde andar. O vão tem de ser maior que a ALTURA DA ARTE, não que a
  // altura da colisão: 6 (ou 8 onde cabe casa grande) deixa dois tiles de
  // calçada visível entre uma fileira e a seguinte.
  // Quarteirão = DUAS fileiras coladas (a de trás aparece por cima do
  // telhado da da frente, que é como um bairro se lê de cima), e um vão de
  // dois tiles de calçada até o próximo quarteirão.
  //
  // O número sai da ALTURA DA ARTE, não da colisão: a casa pequena tem 4
  // tiles de arte e 2 de parede, então duas fileiras a 3 de distância cobrem
  // 7 linhas, e o quarteirão seguinte só pode começar 9 linhas depois se
  // quisermos calçada visível entre eles. Com espaçamento uniforme de 3 (a
  // primeira tentativa) o telhado de cima tapava o vão inteiro e a cidade
  // virava uma parede contínua de telhados, sem chão à vista.
  const alturaArte = plano.grandes >= 0.3 ? 6 : 4;
  const dentroDoQuarteirao = 3;
  // Três fileiras por quarteirão em cidade grande, duas nas pequenas: a
  // terceira fileira aproveita a altura do quarteirão sem comer a calçada,
  // e é o que tira a capital de 15 prédios para perto de 25.
  const fileirasPorBloco = plano.alvo >= 20 ? 3 : 2;
  const passoBloco = alturaArte + dentroDoQuarteirao * (fileirasPorBloco - 1) + 2;
  const ocupado = new Set();

  // Praça central: sempre aberta, é onde o jogador chega e onde ficam os
  // NPCs. Reservada ANTES das casas para que nenhuma nasça dentro dela.
  // Praça proporcional: numa capital ela é o coração da cidade; num
  // acampamento de seis tiles de raio, uma praça de 5x5 seria o acampamento
  // inteiro e não sobraria onde erguer barraca.
  const pracaR = a.categoria === "CAPITAL" ? 4 : a.categoria === "CIDADE" ? 3
    : a.categoria === "VILA" ? 2 : a.categoria === "ASSENTAMENTO" ? 1 : 0;
  for (let oy = -pracaR; oy <= pracaR; oy += 1) {
    for (let ox = -pracaR; ox <= pracaR; ox += 1) {
      const x = centro.x + ox; const y = centro.y + oy;
      if (!dentro(x, y)) continue;
      // Nem a praça invade cidade vizinha: com os raios maiores, a praça de
      // uma capital chegava a cair sobre as casas da outra e as apagava.
      if (pegadaGlobal.has(idx(x, y))) continue;
      g[y][x] = ident.arquitetura.piso;
      ocupado.add(idx(x, y));
      // A praça entra na PEGADA da cidade mesmo quando o tile era água (porto
      // e cidade elevada): sem isso a estrada não reconhecia aquele pedaço
      // como cidade e o pavimentava — 17 tiles de terra batida dentro de
      // praças, todos em assentamentos sobre água.
      if (!tiles.some((t) => t.x === x && t.y === y)) tiles.push({ x, y });
    }
  }

  const props = [];
  // Casas acompanham a cultura do território: regiões verdes/úmidas usam
  // volumes élficos e madeira; fortalezas, gelo e vulcões privilegiam massa
  // de pedra. Não é só uma troca de cor: muda a silhueta dos bairros.
  const organica = ident.clima === "umido" || ident.vegetacao?.includes("bosque") || ident.vegetacao?.includes("mata");
  const paleta = paletaUrbana(ident, a.categoria);
  // Moradias antigas (`casa_p`, `casa_g` e variações regionais simples)
  // ainda existem para acampamentos e compatibilidade de saves, mas não
  // entram mais na malha urbana. Antes elas eram inseridas no começo destas
  // listas e acabavam dominando a rolagem visual — por isso a pousada nova
  // aparecia cercada pelos blocos antigos. Vilas, cidades e capitais agora
  // usam exclusivamente as famílias V2, todas desenhadas no mesmo padrão
  // detalhado da pousada.
  const dentroDaMancha = new Set(tiles.map((t) => idx(t.x, t.y)));

  // Eixos urbanos visíveis. A praça liga-se aos quatro portões e ganha um
  // anel de circulação, como na referência: o jogador entende onde está e
  // para onde cada bairro continua sem precisar de minimapa.
  const pisoVia = ident.arquitetura.piso === TILE.COBBLE ? TILE.VILLAGE_FLOOR : TILE.COBBLE;
  const meiaVia = a.categoria === "CAPITAL" ? 1 : 0;
  if (a.categoria !== "ACAMPAMENTO") {
    const cruzCompleta = ["CAPITAL", "CIDADE"].includes(a.categoria);
    for (let d = -raio + 1; d <= raio - 1; d += 1) {
      for (let faixa = -meiaVia; faixa <= meiaVia; faixa += 1) {
        const trechos = [[centro.x + faixa, centro.y + d]];
        if (cruzCompleta) trechos.push([centro.x + d, centro.y + faixa]);
        for (const [x, y] of trechos) {
          if (!dentro(x, y) || !dentroDaMancha.has(idx(x, y))) continue;
          g[y][x] = pisoVia; ocupado.add(idx(x, y));
        }
      }
    }
    if (cruzCompleta) {
      const anel = pracaR + 1;
      for (let d = -anel; d <= anel; d += 1) {
        for (const [x, y] of [[centro.x + d, centro.y - anel], [centro.x + d, centro.y + anel], [centro.x - anel, centro.y + d], [centro.x + anel, centro.y + d]]) {
          if (!dentro(x, y) || !dentroDaMancha.has(idx(x, y))) continue;
          g[y][x] = pisoVia; ocupado.add(idx(x, y));
        }
      }
    }
  }

  // Planta especial da capital rica de Altaverde: um eixo cerimonial largo
  // liga o portão sul à praça; a leste, um jardim d'água atravessado por
  // pontes cria o mesmo contraste de pedra, verde e canais da referência.
  // Tudo usa tiles já conhecidos pelo jogo, portanto permanece navegável e
  // leve mesmo com o continente quatro vezes maior.
  if (a.modeloRico) {
    for (let y = centro.y + pracaR + 1; y <= centro.y + raio - 1; y += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const x = centro.x + ox;
        if (!dentro(x, y) || !dentroDaMancha.has(idx(x, y))) continue;
        g[y][x] = TILE.COBBLE;
        ocupado.add(idx(x, y));
      }
    }
    const lagoX0 = centro.x + pracaR + 4;
    const lagoX1 = Math.min(centro.x + raio - 3, lagoX0 + 7);
    for (let y = centro.y - 3; y <= centro.y + 3; y += 1) {
      for (let x = lagoX0; x <= lagoX1; x += 1) {
        if (!dentro(x, y) || !dentroDaMancha.has(idx(x, y))) continue;
        g[y][x] = y === centro.y ? TILE.BRIDGE : TILE.WATER;
        ocupado.add(idx(x, y));
      }
    }
    // Limite urbano com quatro portões. A cerca é visual e não prende o
    // jogador; a forma pontilhada permite entradas menores entre bairros.
    for (let passo = 0; passo < 96; passo += 1) {
      const ang = passo / 96 * Math.PI * 2;
      if (Math.abs(Math.sin(ang)) < .10 || Math.abs(Math.cos(ang)) < .10) continue;
      const x = Math.round(centro.x + Math.cos(ang) * (raio - 1));
      const y = Math.round(centro.y + Math.sin(ang) * (raio - 1));
      if (dentro(x, y) && dentroDaMancha.has(idx(x, y)) && !ocupado.has(idx(x, y))) {
        props.push({ id: "cerca", x, y });
      }
    }
  }

  // Mobiliário da praça: postes nos quatro cantos e uma placa na entrada sul.
  // São props de 1 tile de largura e SEM colisão — a praça continua livre.
  // Existem porque praça de calçada lisa lê como estacionamento; quatro
  // verticais bastam para ela virar praça, com imagens que o jogo já carrega.
  //
  // Postos ANTES das casas, e o tile deles entra em `ocupado`: colocados
  // depois, uma casa podia nascer em cima e a placa virava obstáculo — que é
  // exatamente o que o teste pegou.
  for (const [ox, oy] of [[-pracaR, -pracaR], [pracaR, -pracaR], [-pracaR, pracaR], [pracaR, pracaR]]) {
    const px = centro.x + ox; const py = centro.y + oy;
    if (!dentro(px, py) || !dentroDaMancha.has(idx(px, py))) continue;
    props.push({ id: "poste", x: px, y: py });
    ocupado.add(idx(px, py));
  }
  {
    const py = centro.y + pracaR + 1;
    if (dentro(centro.x, py) && dentroDaMancha.has(idx(centro.x, py))) {
      props.push({ id: "placa", x: centro.x, y: py });
      ocupado.add(idx(centro.x, py));
    }
  }

  // Toda cidade/vila tem uma pousada claramente reconhecível junto à praça.
  // Além de ser o marco visual de abrigo, sua porta fornece a coordenada de
  // descanso do assentamento para interface e automação.
  let descanso = null;
  if (a.categoria !== "ACAMPAMENTO") {
    const candidatos = [
      { id: "pousada", x: centro.x - pracaR - 3, y: centro.y + pracaR + 2 },
      { id: "pousada", x: centro.x + pracaR + 4, y: centro.y + pracaR + 2 },
      { id: "pousada", x: centro.x, y: centro.y + pracaR + 4 },
      { id: "pousada", x: centro.x - pracaR - 3, y: centro.y - pracaR - 2 },
    ];
    // Cidades flutuantes e postos estreitos nem sempre comportam uma das
    // quatro posições ideais. Varremos o anel urbano antes de desistir: a
    // pousada continua perto da praça, mas a regra de descanso deixa de
    // depender do formato peculiar da ilha/costa.
    for (let raioBusca = pracaR + 2; raioBusca <= raio; raioBusca += 1) {
      for (let ox = -raioBusca; ox <= raioBusca; ox += 1) {
        candidatos.push({ id: "pousada", x: centro.x + ox, y: centro.y - raioBusca });
        candidatos.push({ id: "pousada", x: centro.x + ox, y: centro.y + raioBusca });
      }
      for (let oy = -raioBusca + 1; oy < raioBusca; oy += 1) {
        candidatos.push({ id: "pousada", x: centro.x - raioBusca, y: centro.y + oy });
        candidatos.push({ id: "pousada", x: centro.x + raioBusca, y: centro.y + oy });
      }
    }
    let pousada = candidatos.find((p) => tilesDeColisao(p).every((c) => dentroDaMancha.has(idx(c.x, c.y))) && cabeACasa(g, p, ocupado));
    // Sobre água, a pousada é erguida numa pequena plataforma urbana. A
    // colisão vira parede normalmente e a porta continua alcançável pela
    // calçada; isso cobre Corallia e a Cidade Flutuante sem transformar o
    // restante do lago em terra.
    if (!pousada) {
      pousada = candidatos.find((p) => tilesDeColisao(p).every((c) =>
        dentro(c.x, c.y) && dentroDaMancha.has(idx(c.x, c.y)) && !ocupado.has(idx(c.x, c.y)) && g[c.y][c.x] !== TILE.LAVA));
    }
    if (!pousada) {
      const borda = [];
      for (let alcance = raio + 1; alcance <= raio + 4; alcance += 1) {
        for (let ox = -alcance; ox <= alcance; ox += 1) {
          borda.push({ id: "pousada", x: centro.x + ox, y: centro.y - alcance });
          borda.push({ id: "pousada", x: centro.x + ox, y: centro.y + alcance });
        }
      }
      pousada = borda.find((p) => tilesDeColisao(p).every((c) =>
        dentro(c.x, c.y) && !ocupado.has(idx(c.x, c.y)) && !pegadaGlobal.has(idx(c.x, c.y)) && g[c.y][c.x] !== TILE.LAVA));
    }
    if (pousada) {
      for (const c of tilesDeColisao(pousada)) {
        g[c.y][c.x] = ident.arquitetura.parede;
        ocupado.add(idx(c.x, c.y));
      }
      props.push(pousada);
      descanso = { x: pousada.x, y: pousada.y + 1, nome: `Pousada de ${a.nome}` };
    }
  }

  // Pequenos sinais regionais dentro da malha urbana: pinheiros e rochas no
  // gelo, pedra vulcânica nas fortalezas, vegetação nos centros verdes.
  const decoracao = ident.clima === "nevado" ? "pinheiro"
    : ident.clima === "vulcanico" ? "rocha_g"
      : organica ? "arvore_p" : ident.porto ? "poste" : "arbusto";
  for (const [ox, oy] of [[-pracaR - 2, 0], [pracaR + 2, 0], [0, -pracaR - 2]]) {
    const p = { id: decoracao, x: centro.x + ox, y: centro.y + oy };
    if (!dentro(p.x, p.y) || !dentroDaMancha.has(idx(p.x, p.y)) || ocupado.has(idx(p.x, p.y))) continue;
    props.push(p); ocupado.add(idx(p.x, p.y));
  }

  // As fileiras nascem A PARTIR DA PRAÇA, para os dois lados, em vez de a
  // partir da borda. Começando da borda, o acampamento e o assentamento
  // ficavam com a única fileira possível caindo em cima da praça — e sem
  // nenhuma casa. Ancorar na praça garante que a primeira fileira encoste
  // nela, que é onde uma casa realmente fica.
  // Cota de CASAS, contada à parte de `props`. O mobiliário da praça (quatro
  // postes e uma placa) também entra em `props`, e comparar `props.length`
  // com o alvo fazia um acampamento — cujo alvo é três — estourar a cota
  // ANTES de erguer a primeira barraca. Capital não notava; acampamento
  // ficava com zero construções.
  let casasPostas = 0;

  const fileiras = [];
  const parDeFileiras = (yBase) => {
    for (let k = 0; k < fileirasPorBloco; k += 1) fileiras.push(yBase - k * dentroDoQuarteirao);
  };
  for (let dy = pracaR + 2; dy <= raio + 1; dy += passoBloco) parDeFileiras(centro.y + dy);
  for (let dy = -pracaR - 1; dy >= -raio - 1; dy -= passoBloco) parDeFileiras(centro.y + dy);
  for (const y of fileiras) {
    if (casasPostas >= plano.alvo) break;
    if (!dentro(0, y)) continue;
    // Onde a fileira começa varia de linha para linha: fachadas alinhadas na
    // mesma coluna em todas as fileiras dariam um tabuleiro.
    let x = centro.x - raio - 3 + Math.floor(rnd() * 3);
    while (x <= centro.x + raio + 3) {
      if (casasPostas >= plano.alvo) break;
      // Tenta o estilo sorteado e, se não couber ali, o outro. Sem a segunda
      // tentativa, uma rolagem de "casa grande" num trecho estreito era
      // simplesmente perdida.
      const querGrande = rnd() < plano.grandes;
      const preferido = sortearDaPaleta(querGrande ? paleta.grandes : paleta.comuns, rnd);
      // O segundo estilo vem do outro porte e também é sorteado. Além de
      // aproveitar trechos estreitos, isso impede fileiras monocromáticas.
      const alternativo = sortearDaPaleta(querGrande ? paleta.comuns : paleta.grandes, rnd);
      let posto = null;
      for (const id of [...new Set([preferido, alternativo])]) {
        const meta = PROPS[id];
        // Encaixa a casa com a borda ESQUERDA da colisão na coluna x.
        const prop = { id, x: x - meta.colisao.x0, y };
        const cols = tilesDeColisao(prop);
        if (!cols.every((c) => dentroDaMancha.has(idx(c.x, c.y)))) continue;
        if (!cabeACasa(g, prop, ocupado)) continue;
        for (const c of cols) {
          g[c.y][c.x] = ident.arquitetura.parede;
          ocupado.add(idx(c.x, c.y));
        }
        props.push(prop);
        casasPostas += 1;
        posto = meta.colisao.x1 - meta.colisao.x0 + 1;
        break;
      }
      x += posto === null ? 1 : posto + (rnd() < 0.25 ? 2 : 1); // beco entre vizinhas
    }
  }
  // Marco da praça: capital e cidade ganham um templo, que é o prop mais alto
  // do jogo e o que se enxerga de longe — é o que faz a capital ter silhueta.
  if (plano.templo) {
    const alvo = { id: "templo", x: centro.x, y: centro.y - pracaR - 1 };
    if (cabeACasa(g, alvo, ocupado)) {
      for (const c of tilesDeColisao(alvo)) { g[c.y][c.x] = ident.arquitetura.parede; ocupado.add(idx(c.x, c.y)); }
      props.push(alvo);
    }
  }
  // Entorno: lavoura ao redor de cidade grande, onde a região tem lavoura
  // (item 23 — mais fazendas perto de civilização).
  if (ident.lavouraPertoDeCidade && (a.categoria === "CAPITAL" || a.categoria === "CIDADE" || a.categoria === "VILA")) {
    for (let oy = -raio - 4; oy <= raio + 4; oy += 1) {
      for (let ox = -raio - 4; ox <= raio + 4; ox += 1) {
        const x = centro.x + ox; const y = centro.y + oy;
        if (!dentro(x, y)) continue;
        const d = Math.hypot(ox, oy);
        if (d <= raio + 1 || d > raio + 4) continue;
        if (SOLID_TILES.has(g[y][x]) || TILES_AGUA.has(g[y][x])) continue;
        if (rnd() < 0.55) g[y][x] = TILE.FARM;
      }
    }
  }
  // Posições dos distritos, em anel ao redor da praça. Cada capital tem os
  // seus, escritos em settlements.js — nenhuma repete a planta da outra.
  const distritos = (a.distritos || []).map((nome, i, arr) => {
    const ang = (i / Math.max(1, arr.length)) * Math.PI * 2;
    const dx = Math.round(Math.cos(ang) * (raio * 0.6));
    const dy = Math.round(Math.sin(ang) * (raio * 0.6));
    const x = Math.min(W - 1, Math.max(0, centro.x + dx));
    const y = Math.min(H - 1, Math.max(0, centro.y + dy));
    // O distrito abre um respiro de calçada, mas NÃO derruba o que já está
    // construído: antes ele pintava piso por cima de tudo, e como roda depois
    // das casas, abria um buraco de calçada no meio de uma parede — o teste
    // pegou uma casa com um tile de fachada faltando.
    for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
      if (!dentro(x + ox, y + oy)) continue;
      if (ocupado.has(idx(x + ox, y + oy))) continue;
      if (pegadaGlobal.has(idx(x + ox, y + oy))) continue;
      g[y + oy][x + ox] = ident.arquitetura.piso;
    }
    return { nome, x, y };
  });
  // `casas` conta só CONSTRUÇÃO — o mobiliário de praça (poste, placa) entra
  // em `props` mas não é prédio, e contá-lo inflaria o número que o teste e o
  // relatório usam para dizer "esta capital tem 40 prédios".
  const construcoes = props.filter((p) => p.id.startsWith("casa") || p.id === "templo").length;
  return { distritos, props, casas: construcoes, tiles, praca: pracaR, descanso };
}

// ---------------------------------------------------------------------------
// 5. ESTRADAS — busca de menor custo, com ponte onde precisa
// ---------------------------------------------------------------------------
// Distância de cada tile de água até a margem mais próxima, por busca em
// largura a partir de toda a terra de uma vez. É o que permite cobrar da
// estrada o preço CERTO por molhar o pé.
//
// Sem este campo, água é um número só, e não existe número certo: a mesma
// tarifa que faz atravessar um riacho de três tiles vira convite pra cortar
// um lago ao meio, e a que protege o lago faz a estrada contornar o riacho
// por trinta tiles. Com ele, atravessar custa o que a travessia REALMENTE
// tem de largura — que é exatamente como uma estrada de verdade é decidida.
function campoLarguraDaAgua(g) {
  const dist = new Int16Array(W * H).fill(-1);
  const fila = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!TILES_AGUA.has(g[y][x])) { dist[idx(x, y)] = 0; fila.push(idx(x, y)); }
    }
  }
  for (let i = 0; i < fila.length; i += 1) {
    const p = fila[i]; const x = p % W; const y = (p - x) / W;
    for (let d = 0; d < 4; d += 1) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!dentro(nx, ny) || dist[idx(nx, ny)] !== -1) continue;
      dist[idx(nx, ny)] = dist[p] + 1;
      fila.push(idx(nx, ny));
    }
  }
  return dist;
}

function custoDoTile(tile, custoBarreira, distanciaAteMargem) {
  if (tile === TILE.PATH || tile === TILE.COBBLE || tile === TILE.BRIDGE) return 1; // reaproveita traçado
  if (TILES_AGUA.has(tile)) {
    // Mar aberto nunca: ponte sobre o oceano não é ponte, é teletransporte
    // com tabuleiro de madeira.
    if (tile === TILE.DEEP_WATER) return custoBarreira * 6;
    // 4 de tarifa fixa + 7 por tile de afastamento da margem. Um rio de
    // cinco tiles custa ~25 no ponto mais fundo (empata com desvio de 8
    // tiles); o meio de um lago de trinta custa mais de 100 e continua
    // sendo contornado.
    const fundo = distanciaAteMargem <= 0 ? 1 : distanciaAteMargem;
    return 4 + fundo * 7;
  }
  if (tile === TILE.LAVA) return custoBarreira * 4;        // último recurso
  if (SOLID_TILES.has(tile)) return custoBarreira;         // escavar rocha/mata
  return 3;                                                // terreno aberto
}

// ESTRADA NÃO ANDA EM LINHA RETA.
//
// A busca de menor custo cobra o MESMO preço por qualquer terreno aberto, e o
// caminho mais barato entre dois pontos num campo uniforme é a reta. Foi o
// que o mapa mostrou: da vila inicial saía uma faixa de terra batida
// perfeitamente horizontal atravessando meio continente — cinquenta tiles sem
// um desvio, coisa que não existe em estrada nenhuma.
//
// A correção é um RELEVO DE CUSTO: um campo de ruído suave que soma até ~2,5
// ao preço de cada tile aberto (que custa 3). Em distância curta a reta
// continua ganhando — desviar custa mais do que economiza —, mas ao longo de
// dezenas de tiles a estrada passa a preferir os vales desse relevo e
// serpenteia. É como um caminho de verdade nasce: contornando o que é mais
// caro de atravessar. O campo sai da semente, então o traçado é o mesmo em
// toda partida com a mesma semente.
const AMPLITUDE_RELEVO = 4.0;
const ESCALA_RELEVO = 14;
function relevoDeCusto(semente) {
  const hash = hashTexto(`${semente}:relevo-de-estrada`);
  // Amostrador resolvido uma vez: `ruidoCoerente` montava uma chave de texto
  // por consulta, e o A* consulta o mesmo tile várias vezes por estrada.
  const bruto = amostradorRuidoCoerente(hash, ESCALA_RELEVO, W, H);
  // NORMALIZAÇÃO — sem ela o relevo não existe.
  //
  // Primeira versão: `(ruido + 1) * 0.5 * amplitude`, assumindo ruído em
  // [-1,1]. Medido, o campo varia de ~-0,25 a ~+0,30. O que o A* recebia era
  // portanto uma CONSTANTE de ~2 somada a todo tile — que não muda decisão
  // nenhuma, e por isso mexer na amplitude não mudava uma vírgula do traçado.
  // A lição é a mesma da calibragem de densidade: medir o campo antes de
  // cobrar preço dele.
  const rnd = prngDe(semente, "relevo-amostra");
  const amostras = new Float64Array(600);
  for (let i = 0; i < amostras.length; i += 1) {
    amostras[i] = bruto(Math.floor(rnd() * W), Math.floor(rnd() * H));
  }
  amostras.sort();
  const baixo = amostras[Math.floor(amostras.length * 0.05)];
  const alto = amostras[Math.floor(amostras.length * 0.95)];
  const faixa = Math.max(1e-6, alto - baixo);
  // Memória por tile (Float64, o mesmo valor exato que seria recalculado): as
  // dezenas de estradas do mundo passam pelos mesmos corredores.
  const memoria = new Float64Array(W * H).fill(NaN);
  return (x, y) => {
    const i = y * W + x;
    const guardado = memoria[i];
    if (guardado === guardado) return guardado;
    const t = Math.min(1, Math.max(0, (bruto(x, y) - baixo) / faixa));
    const valor = t * AMPLITUDE_RELEVO;
    memoria[i] = valor;
    return valor;
  };
}

// Buffers da busca, reaproveitados entre as dezenas de estradas do mundo. Um
// carimbo de "rodada" diz se o custo guardado vale para a busca atual; assim
// nenhuma chamada precisa preencher 600 mil posições antes de começar.
let buscaCusto = null;
let buscaAnterior = null;
let buscaCarimbo = null;
let buscaRodada = 0;
// Tiles em que o relevo de custo se aplica (terreno aberto): tabela em vez de
// duas consultas a Set por vizinho visitado.
const ABERTO_PARA_RELEVO = new Uint8Array(256);
for (let t = 0; t < 256; t += 1) ABERTO_PARA_RELEVO[t] = (!SOLID_TILES.has(t) && !TILES_AGUA.has(t)) ? 1 : 0;

function buscarCaminho(g, inicio, fim, custoBarreira, larguraAgua, relevo = null) {
  if (!buscaCusto || buscaCusto.length !== W * H) {
    buscaCusto = new Float32Array(W * H);
    buscaAnterior = new Int32Array(W * H);
    buscaCarimbo = new Uint32Array(W * H);
    buscaRodada = 0;
  }
  buscaRodada += 1;
  if (buscaRodada >= 0xFFFFFFFF) { buscaCarimbo.fill(0); buscaRodada = 1; }
  const rodada = buscaRodada;
  const custoGuardado = buscaCusto; const carimbo = buscaCarimbo; const anterior = buscaAnterior;
  const custoDe = (i) => (carimbo[i] === rodada ? custoGuardado[i] : Infinity);
  const fila = new FilaMinima();
  const iIni = idx(inicio.x, inicio.y);
  const iFim = idx(fim.x, fim.y);
  custoGuardado[iIni] = 0; carimbo[iIni] = rodada; anterior[iIni] = -1;
  fila.inserir(iIni, 0);
  const h = (i) => {
    const x = i % W; const y = (i - x) / W;
    return (Math.abs(x - fim.x) + Math.abs(y - fim.y)) * 3;
  };
  while (fila.tamanho) {
    const atual = fila.retirar();
    if (atual === iFim) break;
    const x = atual % W; const y = (atual - x) / W;
    const base = custoGuardado[atual];
    for (let d = 0; d < 4; d += 1) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!dentro(nx, ny)) continue;
      const vizinho = idx(nx, ny);
      const tile = g[ny][nx];
      let novo = base + custoDoTile(tile, custoBarreira, larguraAgua ? larguraAgua[vizinho] : 1);
      // Só o terreno aberto ganha relevo: encarecer rocha ou água já caras
      // não muda decisão nenhuma e só deixaria a busca mais lenta.
      if (relevo && ABERTO_PARA_RELEVO[tile]) novo += relevo(nx, ny);
      if (novo >= custoDe(vizinho)) continue;
      custoGuardado[vizinho] = novo; carimbo[vizinho] = rodada;
      anterior[vizinho] = atual;
      fila.inserir(vizinho, novo + h(vizinho));
    }
  }
  if (custoDe(iFim) === Infinity) return null;
  const caminho = [];
  let cur = iFim;
  while (cur !== -1) {
    const x = cur % W;
    caminho.push({ x, y: (cur - x) / W });
    if (cur === iIni) break;
    cur = anterior[cur];
  }
  return caminho.reverse();
}

// Tile que já pertence a uma cidade construída: calçada, chão de vila ou
// parede de prédio. A estrada respeita os três — o primeiro porque a rua da
// cidade já é caminho, o último porque derrubar uma casa para passar com uma
// estrada é literalmente o que estava acontecendo.
// Tiles que já pertencem a uma cidade construída.
//
// A primeira versão perguntava pelo TIPO do tile (calçada, chão de vila,
// prédio). Errado por construção: as vilas elevadas de Thalgor e as cidades
// sobre água têm piso de PASSARELA, que é o mesmo tile de uma ponte de
// estrada — não dá para distinguir um do outro pelo tipo. O resultado medido
// foram 69 tiles de terra batida dentro de praças, todos em assentamentos
// sobre água. Agora a pegada de cada assentamento é registrada
// explicitamente quando ele é construído, e a estrada consulta a lista.
function ehPisoDeCidade(pegada, x, y) {
  return pegada.has(idx(x, y));
}

function carvearEstrada(g, caminho, nivel, ident, pontes, nomeRota, pegadaDeCidade) {
  const largura = NIVEIS_ESTRADA[nivel].tiles;
  const meia = Math.floor(largura / 2);
  let tilesPonte = 0;
  // Onde havia água ANTES de carvar qualquer coisa.
  //
  // Este pré-cálculo não é elegância: sem ele o registro de pontes fica
  // quase vazio. Uma estrada principal tem 3 tiles de largura, então o bloco
  // 3x3 do ponto anterior já cobriu o ponto atual — quando a travessia era
  // conferida no meio do laço, o tile já tinha virado ponte e a água
  // "sumia". O mundo tinha 415 tiles de ponte construídos e registrava DUAS
  // travessias.
  const eraAgua = caminho.map((p) => TILES_AGUA.has(g[p.y][p.x]));
  for (let ip = 0; ip < caminho.length; ip += 1) {
    const p = caminho[ip];
    const sobreAgua = eraAgua[ip];
    for (let oy = -meia; oy <= meia; oy += 1) {
      for (let ox = -meia; ox <= meia; ox += 1) {
        const x = p.x + ox; const y = p.y + oy;
        if (!dentro(x, y)) continue;
        if (TILES_AGUA.has(g[y][x])) {
          // Água na LARGURA da estrada, com o eixo dela em terra firme, é
          // margem — não travessia. Antes esta linha calçava a beira do lago
          // de tabuleiro de ponte: a Rota do Vento saía com 26 tiles de ponte
          // sem cruzar rio nenhum, e o registro de pontes do mundo (4) não
          // batia com o que estava desenhado (113 tiles). Margem fica margem.
          if (!sobreAgua) continue;
          g[y][x] = TILE.BRIDGE; tilesPonte += 1; continue;
        }
        // A ESTRADA PARA NA CIDADE.
        //
        // Antes ela seguia em frente e pavimentava tudo. Como toda estrada
        // termina no CENTRO de um assentamento, e a vila inicial é ponto de
        // partida de uma principal e de chegada de outra mais os ramais de
        // quem não está na espinha, o resultado medido foi uma faixa de onze
        // tiles de terra batida rasgando a Vila de Aethra ao meio — praça,
        // quarteirão e casa, tudo virava estrada. Dentro da cidade quem leva
        // o tráfego é a rua dela; a estrada só precisa encostar.
        if (ehPisoDeCidade(pegadaDeCidade, x, y)) continue;
        g[y][x] = TILE.PATH;
      }
    }
    if (sobreAgua) {
      const ultima = pontes[pontes.length - 1];
      // Uma travessia contínua é UMA ponte, não uma por tile.
      if (!ultima || Math.abs(ultima.fim.x - p.x) + Math.abs(ultima.fim.y - p.y) > 2 || ultima.rota !== nomeRota) {
        pontes.push({ rota: nomeRota, inicio: { ...p }, fim: { ...p }, tiles: 1 });
      } else {
        ultima.fim = { ...p };
        ultima.tiles += 1;
      }
    }
  }
  return tilesPonte;
}

// ---------------------------------------------------------------------------
// 6. ALTITUDE — oito patamares reais e estradas que viram rampas
// ---------------------------------------------------------------------------
// O tile diz de que o chão é feito; a altitude diz ONDE esse chão está. Antes
// as duas ideias eram confundidas no Renderer (neve = um pouquinho alta,
// água = um pouquinho baixa), portanto uma cordilheira continuava parecendo
// um tapete. Este campo independente vai de 0 a 8: mar/praia embaixo,
// planícies no meio e geleiras/vulcões no alto.
export const ALTURA_MAXIMA_MUNDO = 8;

function alturaBaseDaRegiao(ident) {
  if (ident.ilhas) return 7;
  if (ident.clima === "nevado") return 7;
  if (ident.clima === "vulcanico") return 6;
  if (ident.clima === "ventoso") return 4;
  if (ident.clima === "sombrio" || ident.instavel) return 3;
  if (ident.clima === "arido") return 1;
  if (ident.clima === "costeiro") return 0;
  if (ident.clima === "umido") return 1;
  // Planícies temperadas são a referência vertical do continente. Isso
  // impede que cidades comuns ganhem muralhas artificiais só por existirem;
  // a monumentalidade fica reservada às serras, geleiras e ilhas suspensas.
  return 0;
}

function gerarMapaDeAlturas(g, posse, zonas, semente, assentamentos, tracados) {
  const alturas = new Uint8Array(W * H);
  // A versão anterior calculava o hash da semente e montava a chave do ruído
  // DUAS vezes por tile. Mesmo campo, resolvido uma vez.
  const ruido = amostradorRuidoCoerente(hashTexto(`${semente}:altitude-real`), 24, W, H);
  // Altura-base por zona: depende só da região, não do tile.
  const basePorZona = zonas.map((zona) => alturaBaseDaRegiao(identidadeDaRegiao(zona?.regiaoId)));

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const tile = g[y][x];
      if (tile === TILE.DEEP_WATER || tile === TILE.WATER) {
        alturas[idx(x, y)] = 0;
        continue;
      }
      const zi = posse[idx(x, y)];
      let h = zonas[zi] ? basePorZona[zi] : alturaBaseDaRegiao(identidadeDaRegiao(undefined));
      if (tile === TILE.SAND || tile === TILE.MARSH) h = Math.min(h, 1);
      if (tile === TILE.ICE) h = Math.max(h, 5);
      if (tile === TILE.WALL || tile === TILE.CRYSTAL || tile === TILE.LAVA) h += 1;
      const r = ruido(x, y);
      if (r > 0.24) h += 1;
      if (r < -0.28) h -= 1;
      alturas[idx(x, y)] = Math.max(0, Math.min(ALTURA_MAXIMA_MUNDO, h));
    }
  }

  // Propaga os vales para dentro das serras: salvo paredão construído mais
  // tarde, dois tiles naturais vizinhos diferem no máximo um nível. O pico
  // continua chegando a 8, mas através de oito faixas caminháveis — exatamente
  // a sensação de subir a montanha em vez de encontrar uma parede projetada
  // sobre metade da tela.
  for (let passagem = 0; passagem < ALTURA_MAXIMA_MUNDO; passagem += 1) {
    let mudou = false;
    for (const reverso of [false, true]) {
      const y0 = reverso ? H - 1 : 0; const yFim = reverso ? -1 : H; const sy = reverso ? -1 : 1;
      const x0 = reverso ? W - 1 : 0; const xFim = reverso ? -1 : W; const sx = reverso ? -1 : 1;
      for (let y = y0; y !== yFim; y += sy) for (let x = x0; x !== xFim; x += sx) {
        const i = idx(x, y);
        if (TILES_AGUA.has(g[y][x])) continue;
        // Os quatro vizinhos sem criar um array por tile (eram cinco
        // alocações por tile, em até dezesseis varreduras do mapa).
        let teto = ALTURA_MAXIMA_MUNDO;
        if (x > 0) teto = Math.min(teto, alturas[i - 1] + 1);
        if (x < W - 1) teto = Math.min(teto, alturas[i + 1] + 1);
        if (y > 0) teto = Math.min(teto, alturas[i - W] + 1);
        if (y < H - 1) teto = Math.min(teto, alturas[i + W] + 1);
        if (alturas[i] > teto) { alturas[i] = teto; mudou = true; }
      }
    }
    if (!mudou) break;
  }

  // Assentamento precisa ser um lugar construído, não casas em degraus
  // aleatórios. Cada cidade aplaina seu platô; a estrada fará a transição.
  for (const a of assentamentos) {
    const zona = zonas.find((z) => z.id === a.zonaId);
    const nivel = Math.max(0, Math.min(ALTURA_MAXIMA_MUNDO,
      alturaBaseDaRegiao(identidadeDaRegiao(zona?.regiaoId))));
    for (let oy = -a.raio - 2; oy <= a.raio + 2; oy += 1) {
      for (let ox = -a.raio - 2; ox <= a.raio + 2; ox += 1) {
        const x = a.x + ox; const y = a.y + oy;
        if (!dentro(x, y) || Math.hypot(ox, oy) > a.raio + 1.5) continue;
        if (!TILES_AGUA.has(g[y][x])) alturas[idx(x, y)] = nivel;
      }
    }
  }

  // Saia topográfica: o platô urbano não termina num corte vertical junto à
  // primeira casa. Em até vinte e oito tiles o terreno pode subir/descer um
  // patamar a cada quatro passos, formando colinas, terraços e acessos
  // legíveis sem projetar uma montanha inteira por cima dos telhados.
  for (const a of assentamentos) {
    const centroH = alturas[idx(a.x, a.y)];
    const alcance = a.raio + 28;
    for (let oy = -alcance; oy <= alcance; oy += 1) {
      for (let ox = -alcance; ox <= alcance; ox += 1) {
        const x = a.x + ox; const y = a.y + oy;
        if (!dentro(x, y) || TILES_AGUA.has(g[y][x])) continue;
        const dist = Math.hypot(ox, oy);
        if (dist <= a.raio + 1.5 || dist > alcance) continue;
        const variacao = Math.max(1, Math.ceil((dist - a.raio - 1.5) / 4));
        const i = idx(x, y);
        alturas[i] = Math.max(centroH - variacao, Math.min(centroH + variacao, alturas[i]));
      }
    }
  }

  // Cada rota interpola a altura entre seus destinos. Isso transforma o
  // caminho para Morranvell numa subida longa e legível em vez de um salto
  // de sete níveis na fronteira da neve. A faixa inteira acompanha a rampa.
  const ancoras = new Set(assentamentos.map((a) => idx(a.x, a.y)));
  for (const rota of tracados) {
    const caminho = rota.pontos;
    if (!caminho?.length) continue;
    const h0 = alturas[idx(caminho[0].x, caminho[0].y)];
    const fim = caminho[caminho.length - 1];
    const h1 = alturas[idx(fim.x, fim.y)];
    const raio = rota.nivel === "PRINCIPAL" ? 2 : rota.nivel === "SECUNDARIA" ? 1 : 0;
    for (let i = 0; i < caminho.length; i += 1) {
      const t = caminho.length <= 1 ? 0 : i / (caminho.length - 1);
      const suave = t * t * (3 - 2 * t);
      const h = Math.round(h0 + (h1 - h0) * suave);
      const p = caminho[i];
      for (let oy = -raio; oy <= raio; oy += 1) for (let ox = -raio; ox <= raio; ox += 1) {
        const x = p.x + ox; const y = p.y + oy;
        if (!dentro(x, y) || TILES_AGUA.has(g[y][x])) continue;
        if (ancoras.has(idx(x, y))) continue;
        alturas[idx(x, y)] = h;
      }
    }
  }

  // Rotas compartilham trechos. Uma estrada processada depois pode alterar
  // um entroncamento já usado por outra; relaxamos a rede inteira mantendo os
  // centros urbanos como âncoras, até nenhum passo do eixo saltar mais de um
  // patamar por tile.
  for (let passagem = 0; passagem < Math.max(W, H); passagem += 1) {
    let mudou = false;
    for (const rota of tracados) {
      for (let i = 1; i < (rota.pontos?.length || 0); i += 1) {
        const a = rota.pontos[i - 1]; const b = rota.pontos[i];
        const ia = idx(a.x, a.y); const ib = idx(b.x, b.y);
        const ha = alturas[ia]; const hb = alturas[ib];
        if (ha > hb + 1) {
          if (ancoras.has(ib)) alturas[ia] = hb + 1;
          else alturas[ib] = ha - 1;
          mudou = true;
        } else if (hb > ha + 1) {
          if (ancoras.has(ia)) alturas[ib] = ha + 1;
          else alturas[ia] = hb - 1;
          mudou = true;
        }
      }
    }
    if (!mudou) break;
  }

  return alturas;
}

function ornamentarEstradas(g, props, tracados, pegadaDeCidade, assentamentos) {
  const ocupados = new Set(props.map((p) => idx(p.x, p.y)));
  for (const rota of tracados) {
    const pontos = rota.pontos || [];
    // Calçada de aproximação deixa evidente onde termina a estrada regional
    // e começa a rua da cidade.
    for (const cidade of [rota.deRef, rota.paraRef].filter(Boolean)) {
      for (const p of pontos) {
        if (Math.hypot(p.x - cidade.x, p.y - cidade.y) > cidade.raio + 5) continue;
        if (!pegadaDeCidade.has(idx(p.x, p.y)) && g[p.y][p.x] === TILE.PATH) g[p.y][p.x] = TILE.COBBLE;
      }
    }
    if (rota.nivel !== "PRINCIPAL") continue;
    // Postes regulares funcionam como escala e perspectiva: ao subir uma
    // rampa, o jogador vê a sequência desaparecer no patamar superior.
    for (let i = 10; i < pontos.length - 10; i += 16) {
      const p = pontos[i]; const anterior = pontos[Math.max(0, i - 1)];
      const dx = p.x - anterior.x; const dy = p.y - anterior.y;
      const lado = i % 32 ? 2 : -2;
      const x = p.x - dy * lado; const y = p.y + dx * lado;
      const chave = idx(x, y);
      if (!dentro(x, y) || pegadaDeCidade.has(chave) || ocupados.has(chave) || SOLID_TILES.has(g[y][x]) || TILES_AGUA.has(g[y][x])) continue;
      props.push({ id: i % 32 ? "poste" : "placa", x, y, rota: rota.nome });
      ocupados.add(chave);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. OBJETOS — um tile andável dentro da própria zona
// ---------------------------------------------------------------------------
function tileAndavelNaZona(g, posse, zonaIndice, alvo, rnd, ocupados) {
  for (let raio = 0; raio < 30; raio += 1) {
    const candidatos = [];
    for (let oy = -raio; oy <= raio; oy += 1) {
      for (let ox = -raio; ox <= raio; ox += 1) {
        if (raio > 0 && Math.max(Math.abs(ox), Math.abs(oy)) !== raio) continue;
        const x = alvo.x + ox; const y = alvo.y + oy;
        if (!dentro(x, y)) continue;
        if (posse[idx(x, y)] !== zonaIndice) continue;
        if (SOLID_TILES.has(g[y][x])) continue;
        if (ocupados.has(idx(x, y))) continue;
        candidatos.push({ x, y });
      }
    }
    if (candidatos.length) {
      const p = candidatos[Math.floor(rnd() * candidatos.length)];
      ocupados.add(idx(p.x, p.y));
      return p;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 8. ACESSO — nada pode ficar inalcançável
// ---------------------------------------------------------------------------
// Tiles sólidos em tabela: a inundação consulta um por vizinho visitado.
const SOLIDO = new Uint8Array(256);
for (let t = 0; t < 256; t += 1) SOLIDO[t] = SOLID_TILES.has(t) ? 1 : 0;

// Espalha `visto` a partir das posições em `sementes` por todo tile andável
// ainda não visto. Fila em array tipado: no mundo 4x a componente principal
// passa de 400 mil tiles.
function inundar(g, visto, sementes) {
  const fila = new Int32Array(W * H);
  let fim = 0;
  for (const s of sementes) fila[fim++] = s;
  for (let i = 0; i < fim; i += 1) {
    const p = fila[i]; const x = p % W; const y = (p - x) / W;
    for (let d = 0; d < 4; d += 1) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!dentro(nx, ny) || visto[idx(nx, ny)] || SOLIDO[g[ny][nx]]) continue;
      visto[idx(nx, ny)] = 1;
      fila[fim++] = idx(nx, ny);
    }
  }
  return visto;
}

function componenteAndavel(g, origem) {
  const visto = new Uint8Array(W * H);
  const inicio = idx(origem.x, origem.y);
  visto[inicio] = 1;
  return inundar(g, visto, [inicio]);
}

// O tile alcançável mais próximo do alvo em distância de Manhattan. Em caso de
// empate vence o que vem primeiro na leitura linha a linha — o MESMO critério
// da varredura do mapa inteiro que isto substitui, só que andando em anéis a
// partir do alvo em vez de percorrer 600 mil tiles por alvo.
function alcancavelMaisProximo(visto, alvo) {
  const maxD = W + H;
  for (let d = 0; d <= maxD; d += 1) {
    let melhorI = -1;
    for (let dy = -d; dy <= d; dy += 1) {
      const y = alvo.y + dy;
      if (y < 0 || y >= H) continue;
      const dx = d - Math.abs(dy);
      const xs = dx === 0 ? [alvo.x] : [alvo.x - dx, alvo.x + dx];
      for (const x of xs) {
        if (x < 0 || x >= W) continue;
        const i = idx(x, y);
        if (visto[i] && (melhorI < 0 || i < melhorI)) melhorI = i;
      }
    }
    if (melhorI >= 0) { const x = melhorI % W; return { x, y: (melhorI - x) / W }; }
  }
  return null;
}

function garantirAcesso(g, alvos, origem) {
  let visto = componenteAndavel(g, origem);
  const faltando = alvos.filter((a) => a && dentro(a.x, a.y) && !visto[idx(a.x, a.y)]);
  for (const alvo of faltando) {
    if (visto[idx(alvo.x, alvo.y)]) continue;
    // Liga ao tile alcançável mais próximo com um corredor em L, abrindo o
    // que estiver no caminho. É a mesma ideia da ETAPA 1, agora sobre um mapa
    // onde barreira é intencional — por isso a trilha aberta é estreita.
    const melhor = alcancavelMaisProximo(visto, alvo);
    if (!melhor) continue;
    // Tiles que este corredor abrir: só eles podem ligar coisa nova à parte
    // já alcançável, então a inundação recomeça deles em vez do mapa todo.
    const abertos = [];
    const passoX = melhor.x > alvo.x ? 1 : -1;
    // NUNCA através de um prédio: a garantia de acesso abria caminho em
    // qualquer tile sólido, e depois que casas viraram construções de verdade
    // isso passou a DERRUBAR PAREDE — o teste pegou uma casa com um buraco de
    // estrada no meio. Cidade já nasce conectada pelas próprias ruas; o que
    // esta etapa precisa abrir é rocha e mata.
    for (let x = alvo.x; x !== melhor.x; x += passoX) {
      if (g[alvo.y][x] === TILE.BUILDING) continue;
      if (SOLID_TILES.has(g[alvo.y][x])) { g[alvo.y][x] = TILE.PATH; abertos.push(idx(x, alvo.y)); }
    }
    const passoY = melhor.y > alvo.y ? 1 : -1;
    for (let y = alvo.y; y !== melhor.y; y += passoY) {
      if (g[y][melhor.x] === TILE.BUILDING) continue;
      if (SOLID_TILES.has(g[y][melhor.x])) { g[y][melhor.x] = TILE.PATH; abertos.push(idx(melhor.x, y)); }
    }
    if (SOLID_TILES.has(g[alvo.y][alvo.x]) && g[alvo.y][alvo.x] !== TILE.BUILDING) { g[alvo.y][alvo.x] = TILE.PATH; abertos.push(idx(alvo.x, alvo.y)); }
    // Abrir um tile só aumenta a região alcançável (nada vira sólido aqui).
    // Todo tile novo nela é ligado à parte antiga por um tile recém-aberto
    // vizinho de um tile já visto — então inundar a partir desses dá a mesma
    // componente que refazer a busca inteira desde a origem.
    const sementes = [];
    for (const i of abertos) {
      if (visto[i]) continue;
      const x = i % W; const y = (i - x) / W;
      const encosta = (x > 0 && visto[i - 1]) || (x < W - 1 && visto[i + 1])
        || (y > 0 && visto[i - W]) || (y < H - 1 && visto[i + W]);
      if (encosta) { visto[i] = 1; sementes.push(i); }
    }
    if (sementes.length) inundar(g, visto, sementes);
  }
}

// ---------------------------------------------------------------------------
// PRINCIPAL
// ---------------------------------------------------------------------------
export function construirMundo(semente) {
  const t0 = Date.now();
  const { posse } = mapaDePosse(W, H);
  const resumo = resumoDasZonas(W, H);
  const porId = new Map(resumo.map((z) => [z.id, z]));
  const indicePorId = new Map(ZONAS_MUNDO.map((z, i) => [z.id, i]));
  const rnd = prngDe(semente, "mundo");

  const g = Array.from({ length: H }, () => new Array(W).fill(TILE.GRASS));
  pintarTerreno(g, semente, posse, ZONAS_MUNDO);
  desenharOceano(g, semente);
  isolarArquipelagoCoral(g, posse);

  const rios = [];
  cavarRios(g, semente, resumo, rios);

  // --- assentamentos ---
  // `props` acumula a ARTE das construções de todas as cidades. A colisão
  // delas já foi pintada no grid pelo construtor; esta lista é só o que o
  // Renderer desenha por cima, e viaja no mundo gerado (não no save: é
  // função da semente, então nenhum save antigo precisa migrar).
  const assentamentos = [];
  const props = [];
  // Pegada urbana: todo tile que pertence a algum assentamento. É o que a
  // estrada consulta para parar na cidade em vez de atravessá-la.
  const pegadaDeCidade = new Set();
  for (const a of ASSENTAMENTOS) {
    const zr = porId.get(a.zonaId);
    if (!zr) continue;
    const ident = identidadeDaRegiao(zr.regiaoId);
    const centro = acharTileParaAssentamento(g, zr, rnd, pegadaDeCidade);
    const construido = construirAssentamento(g, a, centro, ident, rnd, pegadaDeCidade);
    const temaArquitetura = ident.clima === "nevado" ? "gelo"
      : ident.clima === "vulcanico" ? "forja"
        : ident.porto ? "porto" : ident.ilhas ? "elevada" : ident.instavel ? "ruina"
          : ident.clima === "arido" ? "deserto" : ident.clima === "sombrio" ? "sombria"
            : ident.clima === "umido" ? "organica" : ident.clima === "ventoso" ? "ventos" : "verde";
    props.push(...construido.props.map((p) => ({ ...p, assentamentoId: a.id, temaArquitetura })));
    construido.tiles.forEach((t) => pegadaDeCidade.add(idx(t.x, t.y)));
    assentamentos.push({
      ...a, x: centro.x, y: centro.y, raio: CATEGORIAS[a.categoria].raio,
      distritos: construido.distritos, casas: construido.casas, praca: construido.praca,
      descanso: construido.descanso, temaArquitetura,
    });
  }
  const assentamentoPorIdMapa = new Map(assentamentos.map((a) => [a.id, a]));

  // --- estradas ---
  // Largura da água medida ANTES de qualquer estrada existir: é o mapa
  // fluvial do território, e é o que decide onde vale a pena erguer ponte.
  const larguraAgua = campoLarguraDaAgua(g);
  const relevo = relevoDeCusto(semente);
  const estradas = [];
  const pontes = [];
  const tracados = [];
  const ligar = (de, para, nivel, nome) => {
    if (!de || !para) return null;
    const caminho = buscarCaminho(g, { x: de.x, y: de.y }, { x: para.x, y: para.y }, NIVEIS_ESTRADA[nivel].custoBarreira, larguraAgua, relevo);
    if (!caminho) return null;
    const identDe = identidadeDaRegiao((porId.get(de.zonaId) || {}).regiaoId);
    const tilesPonte = carvearEstrada(g, caminho, nivel, identDe, pontes, nome, pegadaDeCidade);
    const registro = { nome, nivel, de: de.id, para: para.id, tiles: caminho.length, tilesPonte,
      secreta: NIVEIS_ESTRADA[nivel].secreta, pontos: caminho };
    estradas.push(registro);
    tracados.push({ ...registro, deRef: de, paraRef: para });
    return caminho;
  };

  // espinha
  for (const r of ESTRADAS_PRINCIPAIS) {
    ligar(assentamentoPorIdMapa.get(r.de), assentamentoPorIdMapa.get(r.para), "PRINCIPAL", r.nome);
  }
  // secundárias: todo assentamento fora da espinha se liga ao mais próximo
  // que já está nela. É isto que garante "toda estrada tem destino" sem uma
  // lista escrita à mão que envelhece.
  const naEspinha = new Set(ESTRADAS_PRINCIPAIS.flatMap((r) => [r.de, r.para]));
  for (const a of assentamentos) {
    if (naEspinha.has(a.id)) continue;
    if (porId.get(a.zonaId)?.regiaoId === "recife_coralino") continue;
    let alvo = null; let melhor = Infinity;
    for (const b of assentamentos) {
      if (!naEspinha.has(b.id)) continue;
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (d < melhor) { melhor = d; alvo = b; }
    }
    if (alvo) ligar(a, alvo, "SECUNDARIA", `Ramal de ${a.nome}`);
  }
  const portoIlha = assentamentoPorIdMapa.get("cidade_de_corallia");
  if (portoIlha) for (const a of assentamentos) {
    if (a.id !== portoIlha.id && porId.get(a.zonaId)?.regiaoId === "recife_coralino") {
      ligar(portoIlha, a, "TRILHA", `Trilha do Recife até ${a.nome}`);
    }
  }
  // caminhos secretos: atravessam barreira, e nascem ocultos
  for (const c of CAMINHOS_SECRETOS) {
    const a = porId.get(c.de); const b = porId.get(c.para);
    if (!a || !b) continue;
    const caminho = buscarCaminho(g, a.centroReal, b.centroReal, NIVEIS_ESTRADA.SECRETO.custoBarreira, larguraAgua, relevo);
    if (!caminho) continue;
    carvearEstrada(g, caminho, "SECRETO", identidadeDaRegiao(a.regiaoId), pontes, c.nome, pegadaDeCidade);
    const registro = { nome: c.nome, nivel: "SECRETO", de: c.de, para: c.para,
      tiles: caminho.length, secreta: true, tipo: c.tipo, pontos: caminho };
    estradas.push(registro);
    tracados.push(registro);
  }

  ornamentarEstradas(g, props, tracados, pegadaDeCidade, assentamentos);

  // --- objetos ---
  const ocupados = new Set();
  assentamentos.forEach((a) => ocupados.add(idx(a.x, a.y)));

  const pois = [];
  for (const p of POIS) {
    const zr = porId.get(p.zonaId);
    const zi = indicePorId.get(p.zonaId);
    if (!zr || zi === undefined) continue;
    const pos = tileAndavelNaZona(g, posse, zi, zr.centroReal, rnd, ocupados);
    if (pos) pois.push({ ...p, x: pos.x, y: pos.y });
  }

  const landmarks = [];
  for (const l of LANDMARKS) {
    const zr = porId.get(l.zonaId);
    const zi = indicePorId.get(l.zonaId);
    if (!zr || zi === undefined) continue;
    const pos = tileAndavelNaZona(g, posse, zi, zr.centroReal, rnd, ocupados);
    if (pos) landmarks.push({ ...l, x: pos.x, y: pos.y });
  }

  const masmorras = [];
  for (const m of MASMORRAS_MUNDO) {
    const zr = porId.get(m.zonaId);
    const zi = indicePorId.get(m.zonaId);
    if (!zr || zi === undefined) continue;
    const pos = tileAndavelNaZona(g, posse, zi, zr.centroReal, rnd, ocupados);
    if (pos) masmorras.push({ ...m, entrada: { x: pos.x, y: pos.y } });
  }

  // Baús do mundo aberto agora são descobertas raras, não decoração repetida.
  // A zona inicial garante um; territórios perigosos garantem outro; nas
  // demais regiões apenas parte delas recebe baú (determinístico pela semente).
  // A recompensa maior vive em abrirBau(), portanto menos ícones no mapa não
  // significa menos progresso — significa exploração com momentos marcantes.
  const baus = [];
  const nos = [];
  const chefes = [];
  for (const z of resumo) {
    const zi = indicePorId.get(z.id);
    const perigo = (z.perigo && z.perigo[1]) || 1;
    const quantosBaus = z.funcao === "inicial" || perigo >= 11 || rnd() < 0.42 ? 1 : 0;
    const tier = perigo >= 15 ? "bau_lendario" : perigo >= 11 ? "bau_epico" : perigo >= 6 ? "bau_raro" : "bau_comum";
    for (let i = 0; i < quantosBaus; i += 1) {
      const pos = tileAndavelNaZona(g, posse, zi, z.centroReal, rnd, ocupados);
      if (pos) baus.push({ id: `bau_${z.id}_${i + 1}`, x: pos.x, y: pos.y, tier, aberto: false, zonaId: z.id });
    }
    (z.recursos || []).forEach((tipo, i) => {
      const pos = tileAndavelNaZona(g, posse, zi, z.centroReal, rnd, ocupados);
      if (pos) nos.push({ id: `no_${z.id}_${tipo}`, x: pos.x, y: pos.y, tipo, disponivel: true, zonaId: z.id });
    });
    if (z.chefe) {
      const pos = tileAndavelNaZona(g, posse, zi, z.centroReal, rnd, ocupados);
      if (pos) chefes.push({ zonaId: z.id, x: pos.x, y: pos.y, monstroId: z.chefe.monstroId });
    }
  }

  // Vagas de NPC: tiles andáveis em volta da praça da vila inicial. O
  // gerador não conhece a lista de NPCs do jogo (isso é dado de conteúdo,
  // não de terreno) — ele só entrega os LUGARES, e o main.js encaixa quem
  // mora em cada um. Assim ninguém nasce dentro de uma parede quando a vila
  // muda de forma.
  const vagasNpc = [];
  {
    const iniPraca = ASSENTAMENTOS.find((a) => a.inicial);
    const alvo = iniPraca ? assentamentos.find((a) => a.id === iniPraca.id) : assentamentos[0];
    if (alvo) {
      const zi = indicePorId.get(alvo.zonaId);
      for (let i = 0; i < 10; i += 1) {
        const pos = tileAndavelNaZona(g, posse, zi, { x: alvo.x, y: alvo.y }, rnd, ocupados);
        if (pos) vagasNpc.push(pos);
      }
    }
  }

  // --- acesso ---
  const inicial = assentamentos.find((a) => a.inicial) || assentamentos[0];
  const spawn = inicial ? { x: inicial.x, y: inicial.y } : { x: Math.floor(W / 2), y: Math.floor(H / 2) };
  const alvosDeAcesso = [
    ...baus, ...nos, ...chefes, ...pois, ...landmarks,
    ...masmorras.map((m) => m.entrada),
    ...assentamentos.map((a) => ({ x: a.x, y: a.y })),
    ...vagasNpc,
  ];
  const ehDoRecife = (alvo) => ZONAS_MUNDO[posse[idx(alvo.x, alvo.y)]]?.regiaoId === "recife_coralino";
  garantirAcesso(g, alvosDeAcesso.filter((alvo) => !ehDoRecife(alvo)), spawn);
  const corallia = assentamentoPorIdMapa.get("cidade_de_corallia");
  if (corallia) garantirAcesso(g, alvosDeAcesso.filter(ehDoRecife), corallia);
  // A garantia de acesso pode abrir uma trilha de terra sobre uma faixa de
  // água para conectar outro objetivo. Reafirmar o canal no fim impede que
  // isso vire uma ponte acidental até a ilha.
  isolarArquipelagoCoral(g, posse);

  const alturas = gerarMapaDeAlturas(g, posse, ZONAS_MUNDO, semente, assentamentos, tracados);

  // Os buffers da busca de estradas só servem durante a construção. Soltos
  // aqui, não ficam 7,5 MB presos na memória pelo resto da partida — o que no
  // celular faz diferença. Um próximo mundo (outro save, jogo novo) os recria.
  buscaCusto = null; buscaAnterior = null; buscaCarimbo = null; buscaRodada = 0;

  return {
    grid: g, alturas, spawn, props,
    zonas: resumo, assentamentos, estradas, pontes, rios, pois, landmarks, masmorras,
    baus, nos, chefes, vagasNpc,
    ms: Date.now() - t0,
  };
}

// Cache: `buildOverworld()` é chamada no boot e o mundo é o mesmo enquanto a
// semente não muda. Sem isto, cada chamada refaria os 39 mil tiles.
let cacheMundo = null;
export function mundoDaSemente(semente) {
  if (cacheMundo && cacheMundo.semente === semente) return cacheMundo.mundo;
  const mundo = construirMundo(semente);
  cacheMundo = { semente, mundo };
  return mundo;
}
export function limparCacheMundo() { cacheMundo = null; }

// BAÚS ESCONDIDOS — o que o traço racial do Elfo ("Olhos da Floresta")
// promete. Ficam FORA de construirMundo de propósito: usam um gerador
// semeado próprio (`prngDe(semente, "baus-escondidos")`), não tocam no `rnd`
// do mundo nem na grade, então o mapa de todo mundo continua idêntico — só o
// elfo recebe estes baús na lista de objetos (ver iniciarMundo em main.js).
//
// Regra: metade das zonas que ficaram SEM baú comum ganha um escondido,
// perto de um nó de recurso da própria zona. O nó já tem acesso garantido
// pelo gerador; a busca abaixo anda só por tile aberto a partir dele, então o
// baú escondido também é alcançável — nunca fica atrás de água ou rocha.
const RAIO_BAU_ESCONDIDO = 6;
export function bausEscondidosDoMundo(gerado, semente) {
  if (!gerado || !gerado.grid) return [];
  if (gerado.bausEscondidos && gerado.bausEscondidos.semente === semente) return gerado.bausEscondidos.lista;
  const g = gerado.grid;
  const rnd = prngDe(semente, "baus-escondidos");
  const ocupados = new Set();
  const marcar = (p) => { if (p && dentro(p.x, p.y)) ocupados.add(idx(p.x, p.y)); };
  [...(gerado.baus || []), ...(gerado.nos || []), ...(gerado.chefes || []), ...(gerado.pois || []),
    ...(gerado.landmarks || []), ...(gerado.vagasNpc || []), ...(gerado.assentamentos || [])].forEach(marcar);
  (gerado.masmorras || []).forEach((m) => marcar(m.entrada));
  (gerado.props || []).forEach((p) => tilesDeColisao(p).forEach(marcar));
  const aberto = (x, y) => dentro(x, y) && !SOLID_TILES.has(g[y][x]) && !TILES_AGUA.has(g[y][x]);
  const comBau = new Set((gerado.baus || []).map((b) => b.zonaId));
  const lista = [];
  for (const z of gerado.zonas || []) {
    if (comBau.has(z.id) || z.funcao === "inicial") continue;
    if (rnd() >= 0.5) continue;
    const no = (gerado.nos || []).find((n) => n.zonaId === z.id);
    if (!no) continue;
    // Busca em largura a partir do nó, só por tile aberto, até o raio.
    const vistos = new Set([idx(no.x, no.y)]);
    let fronteira = [{ x: no.x, y: no.y }];
    const candidatos = [];
    for (let passo = 1; passo <= RAIO_BAU_ESCONDIDO && fronteira.length; passo += 1) {
      const proxima = [];
      for (const p of fronteira) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = p.x + dx; const y = p.y + dy;
          const k = idx(x, y);
          if (vistos.has(k) || !aberto(x, y)) continue;
          vistos.add(k);
          proxima.push({ x, y });
          if (passo >= 2 && !ocupados.has(k)) candidatos.push({ x, y });
        }
      }
      fronteira = proxima;
    }
    if (!candidatos.length) continue;
    const pos = candidatos[Math.floor(rnd() * candidatos.length)];
    ocupados.add(idx(pos.x, pos.y));
    const perigo = (z.perigo && z.perigo[1]) || 1;
    const tier = perigo >= 15 ? "bau_lendario" : perigo >= 11 ? "bau_epico" : perigo >= 6 ? "bau_raro" : "bau_comum";
    lista.push({ id: `bau_oculto_${z.id}`, x: pos.x, y: pos.y, tier, aberto: false, zonaId: z.id, escondido: true });
  }
  gerado.bausEscondidos = { semente, lista };
  return lista;
}

// Assinatura que o jogo já usava desde a ETAPA 1. Continua devolvendo só a
// grade — quem quer o mundo inteiro (assentamentos, estradas, POIs) pede
// `mundoDaSemente()`. Mantida aqui, e não em worldMap.js, porque o gerador
// importa worldMap: pôr a função lá fecharia um ciclo de módulos.
export function buildOverworld(semente) {
  return mundoDaSemente(semente).grid;
}
