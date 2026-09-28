// Matriz de força/fraqueza elemental, lida inteiramente dos dados
// (src/data/elements.json) — nenhum multiplicador fica espalhado no código.
// Elemento "fisico" (ou ausente) nunca tem vantagem/resistência: dano
// continua neutro, igual ao comportamento de antes deste sistema existir.
//
// Níveis possíveis (do mais forte pro mais fraco pro atacante):
//   "vantagem_intensa" > "vantagem" > "neutro" > "resistencia" > "resistencia_intensa" > "imune"
// "imune" é sempre o mesmo elemento atacando o mesmo elemento (ex.: fogo
// contra um inimigo de elemento fogo) — não precisa ser listado em
// elements.json, é resolvido aqui antes de consultar a matriz.

export function relacaoElemental(elementoAtacante, elementoDefensor, dadosElementos) {
  if (!dadosElementos || !elementoAtacante || !elementoDefensor) return "neutro";
  if (elementoAtacante === "fisico" || elementoDefensor === "fisico") return "neutro";
  if (elementoAtacante === elementoDefensor) return "imune";
  const entrada = dadosElementos.matriz[elementoAtacante];
  if (!entrada) return "neutro";
  if (entrada.forteIntensa && entrada.forteIntensa.includes(elementoDefensor)) return "vantagem_intensa";
  if (entrada.forte && entrada.forte.includes(elementoDefensor)) return "vantagem";
  if (entrada.fracoIntensa && entrada.fracoIntensa.includes(elementoDefensor)) return "resistencia_intensa";
  if (entrada.fraco && entrada.fraco.includes(elementoDefensor)) return "resistencia";
  return "neutro";
}

export function multiplicadorElemental(elementoAtacante, elementoDefensor, dadosElementos) {
  const relacao = relacaoElemental(elementoAtacante, elementoDefensor, dadosElementos);
  if (!dadosElementos) return 1;
  return dadosElementos.multiplicadores[relacao] ?? 1;
}

export function infoElemento(elementoId, dadosElementos) {
  if (!dadosElementos) return null;
  return dadosElementos.elementos.find((e) => e.id === elementoId) || null;
}

// Multiplicador a partir de uma RELAÇÃO já decidida.
//
// `multiplicadorElemental` acima recalcula a relação a partir dos dois
// elementos, o que impede qualquer coisa de alterá-la no meio do caminho.
// Os efeitos de item lendário precisam exatamente disso: "Perfurar Elemento"
// rebaixa resistência para neutro, e "Golpe de Dois Elementos" escolhe a
// melhor das duas relações. Sem esta função, os dois efeitos mudariam uma
// variável que ninguém lê e não fariam nada.
export function multiplicadorDaRelacao(relacao, dadosElementos) {
  if (!dadosElementos) return 1;
  return dadosElementos.multiplicadores[relacao] ?? 1;
}

// O GOLPE DE METAL — a saída que faltava para o empate de dano zero.
//
// O DEFEITO. `combatente.elemento` NÃO é a identidade do personagem: é o
// elemento da ARMA equipada (ver CombatSystem, onde o combatente é montado a
// partir de `personagem.equipamento.arma.elemento`). 107 das 161 armas do
// jogo têm elemento, e o mesmo campo responde por dois papéis opostos — com
// o que você BATE e o que você RESISTE.
//
// Junte isso a "mesmo elemento = imune = 0" e o empate aparece sozinho:
// um herói de espada de fogo encontra um monstro de fogo. O ataque básico
// dele sai como fogo e causa 0. Toda habilidade FÍSICA dele também sai como
// fogo (herdam o elemento da arma) e causam 0. E o ataque do monstro, que é
// fogo, contra um herói cujo `elemento` é fogo, também causa 0. Ninguém
// machuca ninguém, para sempre, e a única saída era fugir.
//
// A REGRA. Um golpe físico é, antes de tudo, metal e força: o encantamento é
// um bônus. Quando o encantamento não morde — e imunidade é exatamente isso
// — o golpe vale pelo que sobra, dano físico neutro. Então, e SÓ para
// ataques físicos, um elemento que resultaria em imunidade cai para
// "fisico", que a matriz acima trata como neutro contra tudo.
//
// O que isto NÃO muda: magia elemental continua podendo ser anulada. Uma
// bola de fogo num inimigo de fogo ainda causa 0, e isso continua sendo uma
// decisão tática de verdade — a diferença é que agora sempre existe o
// ataque básico como resposta, em vez de um beco sem saída.
export function elementoFisicoEfetivo(elementoAtacante, elementoDefensor, dadosElementos) {
  const bruto = elementoAtacante || "fisico";
  if (relacaoElemental(bruto, elementoDefensor, dadosElementos) === "imune") return "fisico";
  return bruto;
}
