// AMEAÇA: por que o inimigo olharia para o guerreiro.
//
// O DEFEITO, MEDIDO (tests/matriz-de-nicho.mjs, coluna "Apanhou")
// ---------------------------------------------------------------
// Num time de quatro, divisão igual é 25% da pancada para cada um. O que o
// jogo entregava:
//
//   Guerreiro   32,4%      Paladino    18,3%
//   Bárbaro     28,0%      Ladino      15,3%
//   Patrulheiro 19,2%      Clérigo      8,0%
//   MAGO        18,5%      Druida       5,6%
//
// O mago, de vestes e retaguarda, apanhava quase o mesmo que o patrulheiro e
// MAIS que o paladino — que é classe de tanque. A formação já fazia alguma
// coisa (a frente apanha mais), mas pouco, e não havia nada que o jogador
// pudesse FAZER a respeito.
//
// A causa está em EnemyAI: o alvo saía só do arquétipo do INIMIGO. Caçador e
// conjurador miram "o de menor defesa" — ou seja, vão direto no mago, de
// propósito, e nenhuma decisão do jogador muda isso. Investir em vida e
// defesa não comprava nada: você sobrevivia a golpes que não ia levar, e o
// mago morria do mesmo jeito.
//
// O MODELO
// --------
// Cada combatente tem um PESO DE AMEAÇA. O inimigo não escolhe o maior: ele
// sorteia com peso. Assim o tanque puxa a maioria dos ataques sem que o jogo
// vire um trilho previsível, e o azar continua existindo.
//
// O peso é multiplicativo, e cada fator responde a uma pergunta do jogador:
//
//   POSIÇÃO     "quem está na frente?" — a fileira da frente é o corpo que
//               aparece primeiro. É a decisão de formação, que já existia.
//   ROBUSTEZ    "quem parece que aguenta?" — defesa e vida máxima. É isto
//               que faz vida e defesa deixarem de ser estatísticas mortas:
//               quem investe nelas passa a ATRAIR o golpe, que é a única
//               forma de essas estatísticas renderem alguma coisa.
//   PROVOCAÇÃO  "quem está gritando comigo?" — status aplicado por
//               habilidade. É a alavanca ativa, e a mais forte.
//
// NÃO existe fator de "alvo quase morto". Foi tentado e removido: ele
// atropelava a personalidade dos arquétipos — no teste, o caçador passou a
// preferir o herói ferido em vez do de menor defesa, que é a identidade
// dele. E era duplicata: "terminar o serviço" já é o que a preferência do
// agressor faz. Um conceito, um lugar.
//
// O ARQUÉTIPO CONTINUA MANDANDO NA PERSONALIDADE. Ele não foi substituído:
// vira um multiplicador de PREFERÊNCIA por cima da ameaça. O caçador continua
// preferindo o frágil — só que agora um guerreiro provocando consegue puxá-lo.
// Sem isso, todo inimigo do jogo passaria a se comportar igual.
//
// Este módulo é só cálculo: não sorteia, não conhece a batalha e não muda
// estado. Quem usa é EnemyAI.escolherAlvoPorArquetipo.

// A frente é o corpo que aparece primeiro. 2,2 e não 2 para a fileira ganhar
// da diferença de robustez entre um guerreiro e um mago do mesmo nível — sem
// isso, um mago muito equipado puxaria ataque da retaguarda.
const PESO_FRENTE = 2.2;

// Referências para normalizar. Não são limites: um valor acima só empurra o
// fator para perto do teto, nunca além dele.
const DEFESA_REFERENCIA = 40;
const VIDA_REFERENCIA = 400;

// Tetos. Robustez multiplica no máximo por 2, provocação por 6. O teto existe
// para que nenhum número de ficha sozinho decida a luta inteira.
const TETO_ROBUSTEZ = 2.0;
const MULT_PROVOCADO = 6.0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function estaProvocando(combatente) {
  return (combatente?.statusEffects || []).some((s) => s.tipo === "provocar" || s.tipo === "provocando");
}

// 1,0 = ameaça neutra. Um mago de retaguarda fica abaixo; um guerreiro de
// frente, acima; um guerreiro provocando, muito acima.
export function pesoDeAmeaca(c) {
  // `vivo === false` e não `!vivo`: combatente sem a propriedade (fixture de
  // teste, combatente recém-montado) é tratado como vivo. Com `!c.vivo`,
  // TODOS os pesos zeravam e o sorteio caía em uniforme — o que anulava o
  // sistema inteiro em silêncio, sem erro nenhum.
  if (!c || c.vivo === false) return 0;

  const frente = c.posicao === "frente" ? PESO_FRENTE : 1;

  // Robustez: defesa e vida máxima somam, cada uma com metade do peso. Some
  // e não multiplique — multiplicar faria um pico numa das duas explodir o
  // resultado, e a ideia é recompensar investir em qualquer uma das duas.
  const porDefesa = clamp((c.defesa || 0) / DEFESA_REFERENCIA, 0, 1);
  const porVida = clamp((c.hpMax || 0) / VIDA_REFERENCIA, 0, 1);
  const robustez = 1 + (TETO_ROBUSTEZ - 1) * (porDefesa * 0.5 + porVida * 0.5);

  const provocacao = estaProvocando(c) ? MULT_PROVOCADO : 1;

  return frente * robustez * provocacao;
}

// A PREFERÊNCIA DO ARQUÉTIPO, agora como multiplicador e não como regra.
//
// Cada arquétipo devolve um número por combatente. Multiplicado pela ameaça,
// ele inclina sem decidir: o caçador continua caçando o frágil, mas não
// ignora um guerreiro que está gritando na cara dele.
//
// O FATOR VAI ATÉ 3, e não até 2,5 como na primeira versão. Com 2,5 a
// personalidade ficava fraca demais: medido em 4000 sorteios, o caçador
// escolhia o herói ferido mais vezes que o de menor defesa. A preferência é
// a identidade do inimigo — ela tem de ganhar da robustez na maioria das
// vezes, e só perder para a provocação, que é a jogada ativa do tanque.
export function preferenciaDoArquetipo(c, arquetipo, time) {
  const fracaoVida = c.hpMax > 0 ? c.hp / c.hpMax : 1;
  const maxDefesa = Math.max(1, ...time.map((x) => x.defesa || 0));
  const maxAtaque = Math.max(1, ...time.map((x) => x.ataque?.dano || 0));
  const maxAtb = Math.max(1, ...time.map((x) => x.atb || 0));

  switch (arquetipo) {
    // Termina o serviço: quanto mais ferido, mais atraente.
    case "agressor":
    case "suporte":
      return 1 + 2 * (1 - fracaoVida);
    // Punem o frágil. Continua sendo a identidade deles — por isso o fator
    // vai até 2,5, o mais forte de todos.
    case "cacador":
    case "conjurador":
    case "ladrao":
      return 1 + 2 * (1 - clamp((c.defesa || 0) / maxDefesa, 0, 1));
    // Atirador mira quem machuca.
    case "atirador":
      return 1 + 2 * clamp((c.ataque?.dano || 0) / maxAtaque, 0, 1);
    // Fanático quer o maior obstáculo — o único que já olhava para o tanque.
    case "fanatico":
      return 1 + 2 * clamp((c.hpMax || 0) / Math.max(1, ...time.map((x) => x.hpMax || 0)), 0, 1);
    // Controla o ritmo: quem está prestes a agir.
    case "comandante":
    case "controlador":
    case "invocador":
      return 1 + 2 * clamp((c.atb || 0) / maxAtb, 0, 1);
    default:
      return 1;
  }
}

// Peso final por combatente, já com a personalidade do inimigo aplicada.
export function pesosDeAlvo(timeVivo, arquetipo) {
  return timeVivo.map((c) => Math.max(0, pesoDeAmeaca(c) * preferenciaDoArquetipo(c, arquetipo, timeVivo)));
}

// Sorteio com peso. `aleatorio` é injetável para o teste ser determinístico.
export function sortearPorPeso(itens, pesos, aleatorio = Math.random) {
  const total = pesos.reduce((s, p) => s + p, 0);
  if (!(total > 0)) return itens[Math.floor(aleatorio() * itens.length)] || null;
  let r = aleatorio() * total;
  for (let i = 0; i < itens.length; i += 1) {
    r -= pesos[i];
    if (r <= 0) return itens[i];
  }
  return itens[itens.length - 1];
}
