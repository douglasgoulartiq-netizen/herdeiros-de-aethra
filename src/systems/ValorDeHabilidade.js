// QUANTO VALE UMA HABILIDADE — E POR QUE A RESPOSTA É DIFERENTE EM DOIS LUGARES.
//
// O jogo decide duas coisas distintas, e vinha usando a MESMA régua para as
// duas (`multiplicador` cru). Só que a resposta certa não é a mesma:
//
//   ESCOLHA DE TURNO   "entre as habilidades que posso usar AGORA, qual eu
//                      uso?" — todas as candidatas já passaram pelo filtro de
//                      recarga e Éter, então todas estão disponíveis neste
//                      turno. Aqui a resposta é o PODER AGORA. Descontar
//                      recarga aqui seria errado: faria a IA evitar
//                      justamente a habilidade pesada que ela guardou para
//                      este momento.
//
//   ESCOLHA DE BUILD   "quais 4 habilidades eu levo para a luta?" (os cards
//                      do loadout, LIMITE_CARDS). Aqui a pergunta é outra:
//                      não adianta uma habilidade monstruosa que sai uma vez
//                      a cada quatro turnos se ela ocupa a vaga de uma que
//                      sai todo turno. Aqui a resposta é o PODER POR TURNO.
//
// O DEFEITO MEDIDO. Na prova de robustez, três classes ficaram PIORES depois
// de ganhar a habilidade nova: guerreiro -2,2%, bárbaro -2,5%, patrulheiro
// -4,2%, clérigo -8,8%. Não era a habilidade ser fraca — ela vencia a vaga
// por poder por USO e perdia a luta por poder por TURNO, deslocando uma
// habilidade de recarga 0 que saía sempre. Trocar ×1,7 de recarga 3 por ×1,5
// de recarga 0 é perder dano, e a régua antiga não conseguia ver isso.
//
// O MODELO
// --------
// Uma habilidade não está disponível todo turno. Duas coisas a limitam:
//
//   RECARGA   `cooldown` N significa uma vez a cada N+1 turnos.
//   ÉTER      custo C com reserva M dá M/C usos na luta inteira; dividido
//             pelo número de turnos, vira uma fração de disponibilidade.
//
// Nos turnos em que ela NÃO está disponível, o personagem não fica parado:
// ele dá um ataque básico. Por isso o valor por turno é uma média ponderada
// entre a habilidade e o ataque básico, e não o valor da habilidade cortado.
//
//     valor = poder * disponibilidade + ataqueBasico * (1 - disponibilidade)
//
// Conferindo contra o caso que motivou tudo, no guerreiro:
//
//     Golpe Poderoso   x1,50  recarga 0  ->  1,50 por turno
//     Investida Brutal x1,70  recarga 3  ->  1,18 por turno
//
// O Golpe Poderoso vale mais, e a régua antiga dizia o contrário. Isso não é
// sobre as habilidades novas: é um erro que o jogo tinha em todas as classes.
import { multiplicadorEfetivo } from "./EscalaDerivada.js";

// Um ataque básico é multiplicador 1 por definição (rolarAtaque sem
// habilidade). É o piso: é o que o personagem faz quando nada melhor está
// disponível, e por isso é o valor de comparação dos turnos vazios.
export const VALOR_DO_ATAQUE_BASICO = 1;

// Quantos turnos dura uma luta, para converter reserva de Éter em fração de
// disponibilidade. É uma PREMISSA DECLARADA, não uma medição: lutas variam
// muito. O número importa pouco porque entra dentro de um `min` com 1 — só
// morde quando a habilidade é cara o bastante para o personagem não poder
// repeti-la, que é justamente quando ele precisa saber disso.
export const TURNOS_DE_REFERENCIA = 12;

// Fração dos turnos em que esta habilidade está de fato disponível.
export function disponibilidade(habilidade, combatente, turnos = TURNOS_DE_REFERENCIA) {
  if (!habilidade) return 0;
  const porRecarga = 1 / (1 + Math.max(0, habilidade.cooldown || 0));
  const custo = habilidade.custoMP || 0;
  const reserva = combatente?.mpMax;
  // Sem custo, ou sem informação de reserva, o Éter não limita. Não chutar
  // um limite que não se conhece é melhor do que inventar um: na dúvida, a
  // recarga sozinha já é um limite honesto.
  if (!(custo > 0) || !(reserva > 0) || !(turnos > 0)) return porRecarga;
  const porEter = (reserva / custo) / turnos;
  return Math.max(0, Math.min(porRecarga, porEter, 1));
}

// O número para comparar habilidades na hora de MONTAR A BUILD.
export function valorPorTurno(habilidade, combatente, turnos = TURNOS_DE_REFERENCIA) {
  if (!habilidade) return 0;
  const poder = multiplicadorEfetivo(habilidade, combatente);
  const d = disponibilidade(habilidade, combatente, turnos);
  return poder * d + VALOR_DO_ATAQUE_BASICO * (1 - d);
}

// O número para comparar habilidades na hora de ESCOLHER O TURNO. É só o
// poder agora — existe como função nomeada para que os dois usos fiquem
// visíveis lado a lado e ninguém troque um pelo outro por engano, que é
// exatamente o erro que este módulo documenta.
export function poderAgora(habilidade, combatente) {
  return multiplicadorEfetivo(habilidade, combatente);
}

// Cura e buff não têm "poder por turno" comparável a dano pela mesma régua —
// o valor deles depende de quanto o time está ferido, que é situação e não
// ficha. Para eles a disponibilidade ainda vale (uma cura de recarga 4 cobre
// menos turnos que uma de recarga 1), então a build usa o mesmo desconto,
// mas sem o piso do ataque básico, que não cura ninguém.
export function valorDeApoioPorTurno(habilidade, combatente, turnos = TURNOS_DE_REFERENCIA) {
  if (!habilidade) return 0;
  return multiplicadorEfetivo(habilidade, combatente) * disponibilidade(habilidade, combatente, turnos);
}

// O MULTIPLICADOR É UM PROXY, E ELE MENTE EM PELO MENOS UM CASO GRANDE.
//
// Trocar a régua de "por uso" para "por turno" consertou guerreiro, ladino,
// bárbaro e clérigo — e AFUNDOU o patrulheiro, de -4% para -29%. A causa:
// a habilidade nova deslocou o Tiro Perfurante, que é `dano_ignora_defesa`.
// Ignorar defesa não aparece em multiplicador nenhum, e vale muito mais do
// que parece, por dois caminhos somados:
//
//   1. o dano final subtrai a defesa do alvo;
//   2. a defesa do alvo também sobe o limiar de bloqueio
//      (`10 + floor(defesa/2)`), ou seja, mexe na chance de o golpe passar.
//
// Nenhum dos dois cabe num multiplicador. E inventar um terceiro proxy para
// remendar o segundo seria repetir o erro: já calibrei à mão duas vezes neste
// trabalho e errei as duas.
//
// A SAÍDA É NÃO USAR PROXY. O motor já tem uma função cujo trabalho inteiro é
// responder "quanto dano esta habilidade faz": `estimarFaixaDano`. Ela
// conhece defesa, bloqueio, elemento, formação, terreno e a escala derivada —
// tudo de uma vez, pela fórmula de verdade, porque é a MESMA fórmula do golpe
// real. Usar ela em vez de adivinhar é mais curto e mais correto.
//
// `prever` é injetado por quem chama (o banco de provas monta uma Batalha e
// um inimigo representativo), para este módulo continuar sem conhecer
// combate. Quem não puder prever continua usando o multiplicador — o proxy
// não some, ele vira o plano B declarado.
export function valorMedidoPorTurno(habilidade, combatente, prever, turnos = TURNOS_DE_REFERENCIA) {
  if (!habilidade) return 0;
  const esperado = typeof prever === "function" ? prever(habilidade) : null;
  if (!(esperado > 0)) return valorPorTurno(habilidade, combatente, turnos);
  const basico = typeof prever === "function" ? prever(null) : 0;
  const d = disponibilidade(habilidade, combatente, turnos);
  return esperado * d + (basico > 0 ? basico : 0) * (1 - d);
}
