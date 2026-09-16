// Onde é possível descansar — motor PURO, sem DOM e sem conhecer o jogo.
//
// POR QUE ISSO EXISTE: `descansar()` (InventorySystem.js) restaura HP e MP
// do time inteiro. Até aqui isso valia em QUALQUER lugar, de graça e
// quantas vezes o jogador quisesse — o que, na prática, apagava a economia
// de poções e tirava o risco de se embrenhar longe da vila. Pior ainda com
// o automático se cuidando sozinho: ele nunca mais morreria.
//
// A regra passa a ser: só dá pra descansar **numa cidade** (zona sem
// encontro aleatório) ou **numa fogueira** — pontos de descanso espalhados
// pelo mapa, um por região e um em cada masmorra.
//
// As fogueiras NÃO são coordenadas escritas à mão. O mapa é regerado a cada
// carregamento (ver iniciarMundo em main.js), então um ponto fixo poderia
// cair dentro de um lago ou de uma parede de labirinto dependendo do
// sorteio. Em vez disso elas são calculadas a partir da grade real: parte
// do centro da região e abre em anéis até achar o primeiro tile andável.
// Assim a fogueira existe sempre, e sempre num lugar que dá pra pisar.

// O jogo inteiro interage por distância de Chebyshev <= 1 (ver
// objetoInteragivelProximo em main.js). A fogueira segue a mesma régua:
// estar na diagonal dela já basta.
export const RAIO_DESCANSO = 1;

// Cidade / abrigo: zona sem nenhum monstro no pool é, por definição deste
// jogo, um lugar seguro (a Vila de Aethra é descrita assim: "segura e sem
// encontros aleatórios"). Deixar a regra derivar disso — em vez de fixar
// `id === "vila"` — faz qualquer cidade futura virar ponto de descanso
// sozinha, sem ninguém lembrar de atualizar uma lista aqui.
export function ehZonaDeDescanso(zona) {
  if (!zona) return false;
  if (zona.abrigo === true) return true;
  return Array.isArray(zona.monstros) && zona.monstros.length === 0;
}

// Primeiro tile andável a partir de `alvo`, em anéis crescentes. `dentro`
// permite restringir a busca (ex.: não deixar a fogueira de uma região
// nascer dentro da região vizinha).
export function tileLivrePerto(alvo, largura, altura, bloqueado, dentro = () => true) {
  const cabe = (x, y) => x >= 0 && y >= 0 && x < largura && y < altura;
  if (cabe(alvo.x, alvo.y) && !bloqueado(alvo.x, alvo.y) && dentro(alvo.x, alvo.y)) return { x: alvo.x, y: alvo.y };
  const raioMax = Math.max(largura, altura);
  for (let r = 1; r <= raioMax; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        // Só a casca do anel: o miolo já foi testado nas voltas anteriores.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = alvo.x + dx;
        const y = alvo.y + dy;
        if (!cabe(x, y) || bloqueado(x, y) || !dentro(x, y)) continue;
        return { x, y };
      }
    }
  }
  return null;
}

// Uma fogueira por região perigosa, no centro dela (ou no tile andável mais
// próximo do centro). Cidades ficam de fora: elas já são ponto de descanso
// inteiras, uma fogueira ali seria redundante.
export function gerarPontosDescanso(zonas, largura, altura, bloqueado) {
  const pontos = [];
  for (const zona of zonas || []) {
    if (ehZonaDeDescanso(zona)) continue;
    const centro = {
      x: Math.round((zona.x0 + zona.x1) / 2),
      y: Math.round((zona.y0 + zona.y1) / 2),
    };
    const dentro = (x, y) => x >= zona.x0 && x <= zona.x1 && y >= zona.y0 && y <= zona.y1;
    const ponto = tileLivrePerto(centro, largura, altura, bloqueado, dentro);
    if (ponto) pontos.push({ id: `fogueira_${zona.id}`, zonaId: zona.id, nome: `Fogueira · ${zona.nome}`, ...ponto });
  }
  return pontos;
}

// Masmorra ganha UMA fogueira, perto do ponto de entrada. `evitar` recebe as
// posições que já têm outra coisa em cima (baús, chefe, saída) pra a
// fogueira não nascer empilhada com elas.
export function gerarPontoDescansoMasmorra(id, spawn, largura, altura, bloqueado, evitar = []) {
  const ocupado = new Set(evitar.map((p) => `${p.x},${p.y}`));
  const livre = (x, y) => !ocupado.has(`${x},${y}`);
  // Duas casas do spawn: perto o bastante pra ser um refúgio de verdade,
  // longe o bastante pra não parecer parte da entrada.
  const ponto = tileLivrePerto({ x: spawn.x + 2, y: spawn.y }, largura, altura, bloqueado, livre)
    || tileLivrePerto(spawn, largura, altura, bloqueado, livre);
  return ponto ? { id: `fogueira_${id}`, zonaId: id, nome: "Fogueira", ...ponto } : null;
}

export function pontoDescansoProximo(pontos, x, y, raio = RAIO_DESCANSO) {
  return (pontos || []).find((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= raio) || null;
}

// A pergunta que o jogo faz antes de deixar descansar.
// Devolve { ok, motivo, onde } — `motivo` já é o texto que vai pra tela,
// porque as três respostas possíveis são curtas e específicas demais pra
// valer a pena montar em outro lugar.
export function podeDescansar({ zona, pontos, x, y }) {
  if (ehZonaDeDescanso(zona)) {
    return { ok: true, onde: "cidade", motivo: `Você descansa em segurança em ${zona.nome}.` };
  }
  const fogueira = pontoDescansoProximo(pontos, x, y);
  if (fogueira) return { ok: true, onde: "fogueira", motivo: "Você acende a fogueira e o time descansa." };
  return {
    ok: false,
    onde: null,
    motivo: "Não dá pra descansar aqui. Volte a uma cidade ou procure uma fogueira (🔥) no mapa.",
  };
}
