// Navegação do modo automático (pedido do jogador: "anda a esmo") — motor
// PURO, sem DOM e sem conhecer o jogo.
//
// O que existia antes: `autoAndar()` sorteava uma das 4 direções livres e
// mantinha a mesma com 75% de chance. Isso é um passeio aleatório — num
// mapa de 106x72 ele passava ao lado de um baú sem "ver", e podia levar
// minutos pra tropeçar num nó de coleta que estava a seis passos.
//
// O que passa a existir: uma busca em largura (BFS) saindo do jogador que,
// numa passada só, descobre a distância real (respeitando árvore, parede e
// água) até TODO tile alcançável. Com esse mapa de distâncias pronto, é
// barato perguntar "qual dos alvos vale mais a pena agora?" e reconstruir
// o primeiro passo do caminho até ele.
//
// DIVISÃO DE RESPONSABILIDADE, de propósito: este módulo não sabe o que é
// um baú. Quem monta a lista de alvos (com posição e prioridade) é o
// main.js, que é quem conhece baús, nós, masmorras e chefes. Assim o
// pathfinding fica testável sem carregar o jogo inteiro, e adicionar um
// tipo novo de ponto de interesse não exige tocar aqui.
//
// Custo: o overworld tem 106x72 = 7.632 tiles. Uma BFS completa nisso é
// trabalho de fração de milissegundo, e roda no máximo uma vez por tick do
// automático (que é da ordem de centenas de ms) — não é caminho quente.

// Os 8 vizinhos: o jogo interage por distância de Chebyshev <= 1 (ver
// objetoInteragivelProximo em main.js), ou seja, ficar na diagonal de um
// baú já permite abrir. O MOVIMENTO, porém, é só ortogonal (ver mover()),
// então a BFS anda em 4 direções e só a checagem de "cheguei" usa as 8.
const VIZINHOS_4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const VIZINHOS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

// BFS a partir de `origem`. Devolve os mapas de distância e de "de onde eu
// vim", ambos indexados por `y * largura + x` (array plano é bem mais
// rápido e mais leve que Map de strings pra grade desse tamanho).
export function mapearAlcance(origem, largura, altura, bloqueado) {
  const total = largura * altura;
  const dist = new Int32Array(total).fill(-1);
  const veioDe = new Int32Array(total).fill(-1);
  const idx = (x, y) => y * largura + x;

  const inicio = idx(origem.x, origem.y);
  dist[inicio] = 0;
  // Fila circular simples: `fila` cresce e `cabeca` avança. Sem shift(),
  // que é O(n) em array de JS e transformaria a BFS em O(n²).
  const fila = new Int32Array(total);
  let cabeca = 0;
  let cauda = 0;
  fila[cauda++] = inicio;

  while (cabeca < cauda) {
    const atual = fila[cabeca++];
    const ax = atual % largura;
    const ay = (atual - ax) / largura;
    for (const [dx, dy] of VIZINHOS_4) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
      const vizinho = idx(nx, ny);
      if (dist[vizinho] !== -1) continue;
      if (bloqueado(nx, ny)) continue;
      dist[vizinho] = dist[atual] + 1;
      veioDe[vizinho] = atual;
      fila[cauda++] = vizinho;
    }
  }

  return { dist, veioDe, largura, altura, origem: inicio };
}

// Distância pra conseguir INTERAGIR com um alvo. Como interagir só exige
// estar a Chebyshev <= 1, o custo real é o menor custo entre o tile do
// alvo e os 8 vizinhos dele. Alvos com `exigeMesmoTile` (entrada de
// masmorra, que é uma transição por pisar em cima) ignoram os vizinhos.
export function custoAte(alvo, mapa) {
  const { dist, largura, altura } = mapa;
  const vizinhos = alvo.exigeMesmoTile ? [[0, 0]] : VIZINHOS_8;
  let melhor = -1;
  let melhorTile = -1;
  for (const [dx, dy] of vizinhos) {
    const x = alvo.x + dx;
    const y = alvo.y + dy;
    if (x < 0 || y < 0 || x >= largura || y >= altura) continue;
    const d = dist[y * largura + x];
    if (d === -1) continue;
    if (melhor === -1 || d < melhor) {
      melhor = d;
      melhorTile = y * largura + x;
    }
  }
  return { distancia: melhor, tile: melhorTile };
}

// Quanto "vale a pena" um alvo. Prioridade alta puxa pra perto, distância
// empurra pra longe. PESO_DISTANCIA = 1 significa: cada passo a mais custa
// 1 ponto de prioridade — então um baú (100) só perde pra um nó (70) se
// estiver 30 passos mais longe que ele. É a régua que impede o automático
// de atravessar o mapa inteiro atrás de um baú ignorando o nó ao lado.
export const PESO_DISTANCIA = 1;

export function pontuarAlvo(alvo, mapa, pesoDistancia = PESO_DISTANCIA) {
  const { distancia, tile } = custoAte(alvo, mapa);
  if (distancia === -1) return null; // inalcançável (ilha, atrás de parede)
  return { alvo, distancia, tile, pontos: (alvo.prioridade || 0) - distancia * pesoDistancia };
}

export function escolherAlvo(alvos, mapa, pesoDistancia = PESO_DISTANCIA) {
  let melhor = null;
  for (const alvo of alvos) {
    const avaliado = pontuarAlvo(alvo, mapa, pesoDistancia);
    if (!avaliado) continue;
    // Desempate estável por distância e depois por posição: dois baús
    // empatados não podem fazer o automático alternar entre eles a cada
    // tick (ficaria parado no meio do caminho pra sempre).
    if (
      !melhor ||
      avaliado.pontos > melhor.pontos ||
      (avaliado.pontos === melhor.pontos && avaliado.distancia < melhor.distancia) ||
      (avaliado.pontos === melhor.pontos && avaliado.distancia === melhor.distancia && avaliado.tile < melhor.tile)
    ) {
      melhor = avaliado;
    }
  }
  return melhor;
}

// Reconstrói o caminho de trás pra frente (do destino até a origem) e
// devolve o PRIMEIRO passo — o único que interessa, já que a decisão é
// refeita no tick seguinte com o mapa atualizado (baú pode ter sido
// aberto, inimigo pode ter aparecido).
export function primeiroPasso(tileDestino, mapa) {
  const { veioDe, largura, origem } = mapa;
  if (tileDestino === -1 || tileDestino === origem) return null;
  let atual = tileDestino;
  let anterior = veioDe[atual];
  if (anterior === -1) return null;
  while (anterior !== origem) {
    atual = anterior;
    anterior = veioDe[atual];
    if (anterior === -1) return null; // caminho quebrado (não deve acontecer)
  }
  const ox = origem % largura;
  const oy = (origem - ox) / largura;
  const ax = atual % largura;
  const ay = (atual - ax) / largura;
  return [ax - ox, ay - oy];
}

// A decisão completa de um tick de exploração automática.
// Devolve `null` quando não há alvo alcançável — aí o chamador cai no
// passeio aleatório de antes, que continua sendo o comportamento certo pra
// "não tem nada por perto, vamos descobrir mapa".
export function decidirPassoExploracao({ origem, alvos, largura, altura, bloqueado, pesoDistancia = PESO_DISTANCIA }) {
  if (!alvos || !alvos.length) return null;
  const mapa = mapearAlcance(origem, largura, altura, bloqueado);
  const escolhido = escolherAlvo(alvos, mapa, pesoDistancia);
  if (!escolhido) return null;
  const passo = primeiroPasso(escolhido.tile, mapa);
  if (!passo) return null; // já estamos adjacentes; quem interage é o chamador
  return { passo, alvo: escolhido.alvo, distancia: escolhido.distancia };
}

// Prioridades padrão por tipo de ponto de interesse. Ficam aqui (e não
// espalhadas no main.js) pra a régua toda ser lida de uma vez:
//   bau/no   — recompensa direta, é o motivo de explorar.
//   entrada  — masmorra é OBJETIVO, não sobra.
//
//              Estava em 48, abaixo de nó (72). Como a pontuação é
//              `prioridade - distância`, um nó de coleta a 10 passos (62)
//              batia uma entrada de masmorra a UM passo (47) — e nós
//              reaparecem, então na prática o automático nunca entrava.
//              Medido: 130 ticks parado ao lado da entrada, catando nó.
//
//              A masmorra é o único alvo FINITO do mapa: uma vez limpa,
//              entra em espera (ver DungeonSystem.js) e sai da lista. Alvo
//              que acaba tem que vir antes de alvo que renasce. Fica acima
//              de nó e abaixo de baú — baú à vista continua sendo pego no
//              caminho.
//   chefe    — progressão de verdade, porém arriscada: prioridade baixa
//              faz o automático limpar o que é seguro ANTES de ir atrás
//              dele, em vez de correr pro chefe assim que entra na zona.
//   npc      — só tem valor na primeira conversa (missão); main.js já
//              trava o NPC repetido, aqui só entra com prioridade baixa.
//   saida    — nunca é destino enquanto sobrar qualquer coisa a fazer na
//              masmorra; serve só pra não ficar preso lá dentro.
//   descanso — fogueira/cidade. Só entra na lista quando o time está ferido
//              e sem poção (ver precisaIrDescansar em main.js), e aí passa
//              na frente de tudo: sobreviver vem antes de recompensa.
export const PRIORIDADE = {
  descanso: 140,
  bau: 100,
  no: 72,
  entrada: 90,
  chefe: 22,
  npc: 18,
  saida: 6,
};
