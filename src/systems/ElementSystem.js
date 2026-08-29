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
