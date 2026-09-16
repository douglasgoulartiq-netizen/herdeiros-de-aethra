// BARRAMENTO DE EVENTOS VISUAIS — 40 linhas que resolvem um problema de
// arquitetura, não de jogo.
//
// O PROBLEMA. O CombatSystem sabe coisas que merecem aparecer na tela: a
// reação elemental que acabou de ocorrer, o chefe que mudou de fase, o golpe
// que entrou por causa de um sub-status. Mas ele NÃO PODE importar UI: é
// testado em Node, sem DOM (ver os test_*.mjs do projeto), e um `import` de
// BattleUI lá dentro quebraria todos eles de uma vez.
//
// A saída de sempre seria devolver essas informações no retorno da função e
// fazer a UI as procurar. Isso funciona para UMA informação e vira um
// emaranhado com cinco — cada camada entre o cálculo e a tela precisando
// repassar um campo que não lhe diz respeito.
//
// Um barramento resolve: o sistema ANUNCIA, quem estiver ouvindo desenha, e
// quando ninguém ouve (todos os testes em Node) as chamadas são no-ops.
// Mesmo padrão de `registrarAoSubirNivel` em CartaoUI, generalizado.

const ouvintes = new Map();

// `ouvir("reacao", fn)` devolve a função de cancelar — a UI de batalha chama
// isso ao desmontar, senão uma batalha antiga continuaria desenhando por cima
// da próxima.
export function ouvir(evento, callback) {
  if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
  ouvintes.get(evento).add(callback);
  return () => ouvintes.get(evento)?.delete(callback);
}

export function anunciar(evento, dados) {
  const conjunto = ouvintes.get(evento);
  if (!conjunto || !conjunto.size) return false;
  // Try/catch por ouvinte: um erro no desenho NUNCA pode interromper o
  // cálculo do combate que o disparou.
  conjunto.forEach((fn) => {
    try { fn(dados); } catch (e) { console.error("[EventosVisuais]", evento, e); }
  });
  return true;
}

export function limparOuvintes(evento) {
  if (evento) ouvintes.delete(evento);
  else ouvintes.clear();
}

// Os eventos que existem hoje. Documentados aqui para quem for adicionar um
// saber o que já há, e para quem for ouvir não errar o nome.
export const EVENTO = {
  // { nome, icone, descricao, alvo, dano } — reação elemental ocorreu
  REACAO: "reacao",
  // { chefe, fase, nome, habilidade } — o chefe virou de fase
  FASE_CHEFE: "fase_chefe",
  // { alvo, quebras, enfureceu, novaPosturaMax } — postura quebrada. O
  // momento que interessa mostrar é o `enfureceu`: é aí que a barra do chefe
  // cresce e os golpes dele passam a doer mais, e nada na tela dizia isso.
  QUEBRA: "quebra",
  // { combatente, dano, icone, nome } — dano de veneno/incendiado no tique de
  // status. O tique roda FORA do fluxo de `animarGolpe`, então o número
  // flutuante nunca era chamado: 8% do HP máximo por turno saía só como uma
  // linha de log que ninguém lê no meio da luta.
  DANO_PERIODICO: "dano_periodico",
  // { combatente, icone, nome } — o combatente perdeu a ação (Congelado).
  TURNO_PERDIDO: "turno_perdido",
  // { atacante, alvo, cura } — roubo de vida (efeito de item ou passiva). Só
  // tinha linha de log: o jogador via a própria barra subir depois de bater e
  // não ligava as duas coisas.
  DRENO: "dreno",
  // { atacante, alvo } — o golpe se repetiu (efeito Eco). Sem sinal, os dois
  // números em sequência pareciam um bug.
  ECO: "eco",
  // { alvo, estadoId, icone, elemento } — a arma marcou o alvo com um estado
  // elemental. É o que ACENDE as reações, e acontecia em silêncio.
  MARCA_ELEMENTAL: "marca_elemental",
  // { primeiro, segundo, alvo, nome } — combo elemental entre dois aliados.
  // Havia badge na carta, mas nada ligava os dois heróis na arena — que é o
  // que ensinaria a jogada.
  COMBO: "combo",
};
