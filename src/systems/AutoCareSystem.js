// Autocuidado do modo automático — motor PURO, sem DOM.
//
// O que existia antes: o automático lutava até morrer. A única proteção era
// a opção de Acessibilidade "parar quando o HP médio cair abaixo de X", que
// vem DESLIGADA por padrão e, mesmo ligada, só interrompe tudo — não cura
// nada. Na prática o jogador voltava e encontrava o time no chão.
//
// A regra combinada com o jogador: **poção primeiro, descanso só quando
// acabaram as poções.** Isso é de propósito, e a alternativa foi recusada:
// `descansar()` neste jogo é grátis, ilimitado e funciona em qualquer lugar
// (ver InventorySystem.js), então um automático que descansa à vontade
// nunca morre e transforma poção em item decorativo. Gastar a poção
// primeiro devolve peso à mochila; o descanso fica como rede de segurança.
//
// Duas decisões que valem explicar:
//
//   1. O gatilho olha o MEMBRO MAIS FERIDO, não a média do time. Média
//      esconde exatamente o caso que interessa: o principal com 90% e um
//      convocado com 8% dão 49% de média e passariam batido.
//   2. A poção escolhida é a MENOR que ainda cabe no ferimento. Curar 12 de
//      HP com uma Poção Grande (70) é o tipo de desperdício que o jogador
//      faria questão de evitar se estivesse jogando na mão — e o automático
//      existe pra jogar como ele jogaria, não pra queimar o estoque.
import { avaliarEncontro } from "./ThreatSystem.js";

// Abaixo de metade do HP alguém já é considerado ferido. Não é um número
// tímido de propósito: encontro aleatório dispara a cada passo (4,5% no
// mundo, 6% em masmorra), então esperar chegar a 20% é esperar demais.
export const LIMIAR_CUIDADO = 0.5;

export function fracaoHp(p) {
  if (!p || !p.hpMax) return 1;
  return p.hp / p.hpMax;
}

// Só personagens de verdade — o mesmo cuidado que AutoEquipSystem toma com
// entradas nulas ou meio construídas vindas de um save antigo.
function vivos(time) {
  return (time || []).filter((p) => p && typeof p.hp === "number" && p.hpMax > 0);
}

export function membroMaisFerido(time) {
  let pior = null;
  for (const p of vivos(time)) {
    if (!pior || fracaoHp(p) < fracaoHp(pior)) pior = p;
  }
  return pior;
}

export function precisaDeCuidado(time, limiar = LIMIAR_CUIDADO) {
  return vivos(time).some((p) => fracaoHp(p) < limiar);
}

// Consumíveis que curam HP, do menor para o maior. Pão (8) conta: é fraco,
// mas é o que sobra quando as poções acabam e ainda evita um descanso.
export function pocoesDeCura(personagem) {
  return (personagem && personagem.inventario ? personagem.inventario : [])
    .filter((i) => i && i.tipo === "consumivel" && typeof i.curaHP === "number" && i.curaHP > 0)
    .sort((a, b) => a.curaHP - b.curaHP);
}

// A menor poção que cabe no ferimento. Se todas curam mais do que falta
// (jogador com 3 de HP faltando e só Poções Grandes na mochila), usa a
// menor mesmo assim — desperdiçar um pouco é melhor que andar ferido.
export function escolherPocao(pocoes, faltando) {
  if (!pocoes.length) return null;
  const cabe = pocoes.filter((p) => p.curaHP <= faltando);
  return cabe.length ? cabe[cabe.length - 1] : pocoes[0];
}

// A decisão de um tick. Devolve `null` quando não há nada a fazer.
//
//   { tipo: "pocao",       item, alvo, alvoNome, faltando }
//   { tipo: "descanso",    alvo, alvoNome }
//   { tipo: "sem_recurso", alvo, alvoNome }   // só com permitirDescanso:false
//
// Uma ação por tick de propósito: o tick se repete a cada ~380ms, então o
// time se cura em alguns quadros com o jogador VENDO acontecer, em vez de
// tudo sumir num salto só.
export function planejarCuidado(personagem, time, opcoes = {}) {
  const { limiar = LIMIAR_CUIDADO, permitirDescanso = true } = opcoes;
  const feridos = vivos(time).filter((p) => fracaoHp(p) < limiar);
  if (!feridos.length) return null;

  const alvo = membroMaisFerido(feridos);
  const faltando = alvo.hpMax - alvo.hp;
  const pocao = escolherPocao(pocoesDeCura(personagem), faltando);
  if (pocao) return { tipo: "pocao", item: pocao, alvo, alvoNome: alvo.nome, faltando };
  if (permitirDescanso) return { tipo: "descanso", alvo, alvoNome: alvo.nome };
  return { tipo: "sem_recurso", alvo, alvoNome: alvo.nome };
}

// ---------------------------------------------------------------------
// Recusar encontro fora do alcance
// ---------------------------------------------------------------------
// Escolha do jogador: o automático recusa só o que a tela de ameaça
// classifica como **Mortal** (6+ níveis acima do time, ver ThreatSystem).
// "Perigosa" (3 a 5 acima) ele continua encarando — dá bom XP e costuma dar
// pra ganhar, e recusar demais trava a progressão.
export const AMEACAS_RECUSADAS = ["mortal"];

export function deveEvitarEncontro(time, monstrosDef, recusadas = AMEACAS_RECUSADAS) {
  if (!monstrosDef || !monstrosDef.length) return false;
  const membros = vivos(time);
  if (!membros.length) return false;
  const { ameaca } = avaliarEncontro(membros, monstrosDef);
  return recusadas.includes(ameaca.id);
}

// Texto curto pro aviso na tela.
export function textoCuidado(plano, personagemPrincipal) {
  if (!plano) return "";
  const quem = plano.alvo === personagemPrincipal ? "" : `${plano.alvoNome}: `;
  if (plano.tipo === "pocao") return `🧪 ${quem}usou ${plano.item.nome}`;
  if (plano.tipo === "descanso") return "💤 Sem poções — o time descansou para recuperar HP e MP";
  return `⚠️ ${quem}HP baixo e nada para curar`;
}
