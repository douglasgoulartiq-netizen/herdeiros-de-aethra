// SIGILOS — os ícones do jogo, tirados da mitologia do próprio jogo.
//
// POR QUE ISTO EXISTE
// -------------------
// O menu usava emoji: 🛡️ 🎒 ✨ 🗺️ 📜. Emoji é desenho de OUTRA pessoa, com
// outra grade de pixel, outra paleta e outro traço — e muda de cara conforme
// o celular do jogador. Num jogo que passou a semana inteira acertando a
// própria densidade de pixel, o menu era a única parte que não obedecia a
// nada. Pior: 🎒 é uma mochila genérica. Não diz nada sobre Aethra.
//
// A LINGUAGEM VEM DO CÓDICE, não de um banco de ícones
// ----------------------------------------------------
// `mythologyCodex.js`, capítulo I: Elyndor partiu a própria essência em CINCO
// GRANDES SELOS, e cada um ancorou um aspecto da realidade.
//
//   PEDRA  estabilidade e matéria    losango    montanhas, metais, forja
//   MARÉ   mudança e fluxo           onda       água, ciclos, cura
//   CHAMA  impulso e renovação       triângulo  fogo, transformação, preço
//   VÉU    limite e mistério         crescente  sombra, morte, passagem
//   CÉU    movimento e possibilidade galho      vento, liberdade, destino
//
// Essas cinco formas são o alfabeto. Todo sigilo do jogo é uma combinação
// delas — do mesmo jeito que, na ficção, tudo em Aethra é combinação dos
// cinco Selos. Um jogador nunca vai ler isso num menu, mas vai sentir que os
// ícones pertencem uns aos outros, porque pertencem de verdade.
//
// DESENHADOS NA GRADE DE 16, como o resto do jogo
// -----------------------------------------------
// Medição desta semana: o jogo desenha o chão a 16 pixels lógicos por tile.
// Os sigilos usam a MESMA grade de 16 e saem como retângulos inteiros, com
// `shape-rendering: crispEdges`. Em qualquer tamanho de tela eles continuam
// pixel art de verdade, sem borda macia — que é o defeito que medi na arte
// gerada e que um SVG curvo traria de volta pela porta da frente.

const N = 16; // lado da grade lógica

// --- o alfabeto -------------------------------------------------------------
// Cada função marca pixels numa grade N×N. `c` é a camada: 2 = traço forte,
// 1 = corpo, 3 = brilho. A separação existe para o sigilo ter contorno escuro
// igual ao resto da arte do jogo.

function grade() { return Array.from({ length: N }, () => new Array(N).fill(0)); }
const por = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N && c > (g[y][x] || 0)) g[y][x] = c; };

// PEDRA — losango. Matéria: fechado, simétrico, sem nada saindo dele.
function pedra(g, cx, cy, r, c = 2, preenche = 0) {
  for (let y = -r; y <= r; y += 1) {
    const w = r - Math.abs(y);
    por(g, cx - w, cy + y, c); por(g, cx + w, cy + y, c);
    if (preenche) for (let x = -w + 1; x < w; x += 1) por(g, cx + x, cy + y, preenche);
  }
}

// MARÉ — onda. Fluxo: a única forma do alfabeto que atravessa o sigilo.
function mare(g, x0, y0, larg, amp, c = 2) {
  for (let i = 0; i < larg; i += 1) {
    const y = y0 + Math.round(Math.sin((i / larg) * Math.PI * 2) * amp);
    por(g, x0 + i, y, c);
  }
}

// CHAMA — triângulo apontando para cima. Impulso: tem direção.
function chama(g, cx, base, alt, c = 2, preenche = 0) {
  for (let i = 0; i < alt; i += 1) {
    const w = Math.round((i / (alt - 1)) * (alt - 1)) ;
    const y = base - i;
    por(g, cx - (alt - 1 - i), y, c); por(g, cx + (alt - 1 - i), y, c);
    if (preenche) for (let x = -(alt - 2 - i); x <= alt - 2 - i; x += 1) por(g, cx + x, y, preenche);
  }
  for (let x = cx - (alt - 1); x <= cx + (alt - 1); x += 1) por(g, x, base, c);
}

// VÉU — crescente: um anel com um pedaço faltando. Limite: nunca fecha.
function veu(g, cx, cy, r, aberturaDe, aberturaAte, c = 2) {
  for (let a = 0; a < 360; a += 4) {
    if (a >= aberturaDe && a <= aberturaAte) continue;
    const rad = (a * Math.PI) / 180;
    por(g, Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), c);
  }
}

// CÉU — galho que se abre. Possibilidade: uma linha que vira várias.
function ceu(g, cx, base, alt, c = 2) {
  for (let i = 0; i < alt; i += 1) por(g, cx, base - i, c);
  const topo = base - alt + 1;
  for (let i = 1; i <= 3; i += 1) {
    por(g, cx - i, topo + i - 1, c); por(g, cx + i, topo + i - 1, c);
  }
}

// auxiliares de composição
function linha(g, x0, y0, x1, y1, c = 2) {
  const dx = Math.abs(x1 - x0); const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy; let x = x0; let y = y0;
  for (let i = 0; i < 64; i += 1) {
    por(g, x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function caixa(g, x0, y0, x1, y1, c = 2, preenche = 0) {
  for (let x = x0; x <= x1; x += 1) { por(g, x, y0, c); por(g, x, y1, c); }
  for (let y = y0; y <= y1; y += 1) { por(g, x0, y, c); por(g, x1, y, c); }
  if (preenche) for (let y = y0 + 1; y < y1; y += 1) for (let x = x0 + 1; x < x1; x += 1) por(g, x, y, preenche);
}
function ponto(g, x, y, c = 3) { por(g, x, y, c); }

// --- os sigilos -------------------------------------------------------------
// Cada entrada diz, no comentário, de que parte do Códice ela saiu. Se um dia
// alguém quiser mudar um ícone, precisa saber o que ele estava dizendo.

export const SIGILOS = {
  // A MARCA DO HERDEIRO. "Herdeiro é o título dado àqueles capazes de ouvir,
  // suportar e alterar a Memória do Mundo." Losango (suportar) com o núcleo
  // aberto (ouvir) e uma faísca de Éter dentro (alterar).
  herois(g) {
    // MEDIDO em ASCII antes de ir para a tela: a primeira versão punha
    // losango, losango menor E crescente no mesmo espaço de 16 px, e virou
    // uma mancha. A 48 px na tela, um pixel lógico tem 3 px — só forma
    // grande lê. Ficou: losango cheio, entalhe aberto no topo (ouvir) e
    // núcleo aceso (o Éter que o Herdeiro carrega).
    pedra(g, 8, 8, 7, 2, 1);
    por(g, 8, 1, 0); por(g, 7, 2, 0); por(g, 8, 2, 0); por(g, 9, 2, 0);
    por(g, 7, 3, 2); por(g, 9, 3, 2);
    pedra(g, 8, 9, 3, 2, 3);
  },

  // SELO DA PEDRA — "estabilidade e matéria: montanhas, metais, ossos e
  // fortalezas". O equipamento do herói é matéria, e só isso.
  equipamento(g) {
    pedra(g, 8, 9, 6, 2, 1);
    linha(g, 3, 9, 13, 9, 2);
    linha(g, 8, 3, 8, 9, 2);
    por(g, 6, 5, 2); por(g, 10, 5, 2);
    ponto(g, 8, 6, 3);
  },

  // ÉTER. "A substância que conecta matéria, magia, lembrança e destino."
  // Evolução é o Éter ramificando — é literalmente uma árvore de Éter.
  evolucao(g) {
    // Tronco de 2 px: a 48 px na tela um traço de 1 px some ao lado dos
    // sigilos cheios, e o menu perde o ritmo.
    for (let y = 6; y <= 14; y += 1) { por(g, 7, y, 2); por(g, 8, y, 2); }
    linha(g, 7, 9, 3, 6, 2); linha(g, 8, 9, 12, 6, 2);
    linha(g, 7, 6, 4, 3, 2); linha(g, 8, 6, 11, 3, 2);
    pedra(g, 3, 5, 1, 2, 3); pedra(g, 12, 5, 1, 2, 3);
    pedra(g, 4, 2, 1, 2, 3); pedra(g, 11, 2, 1, 2, 3);
  },

  // OS CINCO SELOS. "Elyndor partiu a própria essência em cinco Grandes
  // Selos." Os Caminhos do Herdeiro são o que liga o jogador a eles.
  caminhos(g) {
    // A primeira versão ligava cada Selo aos DOIS opostos, como um pentagrama.
    // No ASCII virou rabisco. Os cinco em anel dizem a mesma coisa e leem.
    const p = [[8, 2], [14, 7], [11, 14], [5, 14], [2, 7]];
    p.forEach(([x, y], i) => linha(g, x, y, p[(i + 1) % 5][0], p[(i + 1) % 5][1], 1));
    p.forEach(([x, y]) => pedra(g, x, y, 2, 2, 3));
  },

  // MARIS, SENHORA DAS CORRENTES. "Guardiã das rotas, mudanças e encontros."
  // A formação do time é um encontro de correntes.
  formacao(g) {
    // Quatro posições — as quatro do time — em frente e retaguarda, com a
    // corrente de Maris passando por baixo. Duas ondas cruzando três losangos
    // viravam ruído; a linha de frente/retaguarda é o que a tela precisa dizer.
    pedra(g, 5, 5, 2, 2, 1); pedra(g, 11, 5, 2, 2, 1);
    pedra(g, 5, 11, 2, 2, 1); pedra(g, 11, 11, 2, 2, 1);
    for (let x = 2; x <= 13; x += 2) por(g, x, 8, 1);
    ponto(g, 5, 5, 3); ponto(g, 11, 5, 3);
  },

  // A MEMÓRIA DO MUNDO. "O Éter registra essas marcas no território." Uma
  // missão é uma marca que o mundo ainda não esqueceu.
  missoes(g) {
    caixa(g, 3, 2, 12, 13, 2, 1);
    linha(g, 5, 5, 10, 5, 2); linha(g, 5, 7, 10, 7, 2); linha(g, 5, 9, 8, 9, 2);
    pedra(g, 12, 12, 2, 2, 3);
  },

  // AETHRA ENTRE OS SELOS. "Quando os cinco Selos se estabilizaram, o centro
  // entre eles se tornou a região que receberia o nome de Aethra." O mapa é
  // isso: o centro, e os Selos ancorando as bordas.
  mapa(g) {
    // Aethra é o CENTRO entre os Selos. O anel, os quatro Selos nas bordas e
    // o centro aceso — a onda que havia no meio só sujava o miolo.
    veu(g, 8, 8, 6, 999, 999, 2);
    pedra(g, 8, 2, 1, 2, 3); pedra(g, 14, 8, 1, 2, 3);
    pedra(g, 8, 14, 1, 2, 3); pedra(g, 2, 8, 1, 2, 3);
    pedra(g, 8, 8, 2, 2, 3);
  },

  // ELYNDOR, O QUE RECORDA. "Impede que o mundo esqueça." O Códice é a
  // memória guardada em forma de livro.
  codice(g) {
    caixa(g, 2, 3, 14, 13, 2, 1);
    linha(g, 8, 3, 8, 13, 2);
    linha(g, 4, 6, 6, 6, 2); linha(g, 4, 8, 6, 8, 2);
    linha(g, 10, 6, 12, 6, 2); linha(g, 10, 8, 12, 8, 2);
    ponto(g, 8, 8, 3);
  },

  // A CONVERGÊNCIA. "Memória encontrou Vontade e, pela primeira vez, algo
  // desejou continuar existindo." Invocar é repetir a Convergência.
  invocar(g) {
    chama(g, 8, 13, 7, 2, 1);
    ponto(g, 8, 8, 3); ponto(g, 8, 9, 3);
    por(g, 5, 4, 3); por(g, 11, 4, 3); por(g, 8, 2, 3);
  },

  // MORRAN, A COROA DE GELO. "A necessidade de conservar aquilo que não pode
  // ser perdido." Descansar é conservar.
  descansar(g) {
    // Crescente de Morran, sozinho e grande. A versão com estrela de quatro
    // pontas por cima do crescente disputava o mesmo centro e nenhuma das
    // duas formas sobrava.
    veu(g, 9, 8, 6, 250, 290, 2);
    veu(g, 9, 8, 5, 235, 305, 2);
    for (let a = 100; a <= 260; a += 4) {
      const r = (a * Math.PI) / 180;
      por(g, Math.round(9 + Math.cos(r) * 4), Math.round(8 + Math.sin(r) * 4), 1);
    }
    pedra(g, 3, 4, 1, 3, 3); pedra(g, 2, 11, 0, 3, 3);
  },

  // O ÉTER REGISTRA A MARCA. Salvar, na ficção deste mundo, é o Éter fixando
  // no território o que aconteceu.
  salvar(g) {
    pedra(g, 8, 8, 6, 2);
    linha(g, 5, 8, 11, 8, 2);
    linha(g, 8, 5, 8, 11, 2);
    ponto(g, 8, 8, 3);
    por(g, 6, 6, 1); por(g, 10, 6, 1); por(g, 6, 10, 1); por(g, 10, 10, 1);
  },

  // O VÉU. "Limite e mistério — sombra, morte, sonho e PASSAGEM." A tela de
  // acessibilidade é a passagem: é ela que deixa o jogo caber em quem joga.
  acessibilidade(g) {
    veu(g, 8, 8, 6, 250, 290, 2);
    veu(g, 8, 8, 3, 250, 290, 1);
    ponto(g, 8, 8, 3);
  },

  // AERWIND, O CAMINHO ABERTO. "Cultuado por viajantes, mensageiros e
  // FUGITIVOS." Sair da masmorra é exatamente isso.
  sair(g) {
    caixa(g, 2, 2, 9, 14, 2, 0);
    linha(g, 10, 8, 14, 8, 2);
    linha(g, 12, 6, 14, 8, 2); linha(g, 12, 10, 14, 8, 2);
    ponto(g, 7, 8, 3);
  },

  // "Todo destino é uma corrente, que pode ser seguida, combatida ou
  // desviada, mas nunca ignorada." O modo automático é seguir a corrente.
  automatico(g) {
    mare(g, 2, 8, 12, 3, 1);
    chama(g, 11, 11, 4, 2, 3);
    pedra(g, 4, 8, 1, 2, 3);
  },

  // Tutorial: a primeira lição de um Herdeiro é ouvir. Crescente aberto para
  // cima, com a faísca entrando.
  tutorial(g) {
    veu(g, 8, 10, 5, 190, 350, 2);
    linha(g, 8, 2, 8, 6, 1);
    ponto(g, 8, 3, 3); ponto(g, 8, 10, 3);
  },
};

// --- render ----------------------------------------------------------------

const CAMADA = { 1: "corpo", 2: "traco", 3: "brilho" };

// Devolve o SVG do sigilo. Sem `<path>` curvo de propósito: cada pixel lógico
// vira um `<rect>` inteiro, e `crispEdges` garante que ele não ganhe borda
// macia em nenhum zoom. É o mesmo contrato da arte do jogo.
export function sigiloSVG(nome, { tamanho = 48, titulo = "" } = {}) {
  const desenhar = SIGILOS[nome];
  if (!desenhar) return "";
  const g = grade();
  desenhar(g);
  const partes = { corpo: [], traco: [], brilho: [] };
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const c = g[y][x];
      if (!c) continue;
      partes[CAMADA[c]].push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  }
  return `<svg class="sigilo" viewBox="0 0 ${N} ${N}" width="${tamanho}" height="${tamanho}"
    shape-rendering="crispEdges" role="img" ${titulo ? `aria-label="${titulo}"` : 'aria-hidden="true"'}>
    <g class="sig-corpo">${partes.corpo.join("")}</g>
    <g class="sig-traco">${partes.traco.join("")}</g>
    <g class="sig-brilho">${partes.brilho.join("")}</g>
  </svg>`;
}

export function temSigilo(nome) { return !!SIGILOS[nome]; }
