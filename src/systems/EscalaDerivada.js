// VIDA E DEFESA PRECISAVAM PODER *FAZER* ALGUMA COISA.
//
// O DEFEITO, MEDIDO
// -----------------
// Toda habilidade do jogo tira força de um atributo de ficha: FOR, DES ou
// INT. Em `rolarAtaque` a conta é sempre a mesma —
//
//     base = arma.dano + floor(atributo * 0.3)
//
// — e `atributo` só pode ser FOR, DES ou INT, porque é o que existe em
// `ataque.atributo` e em `atributoForcado`. CON entra no jogo por uma porta
// só (CharacterFactory):
//
//     hpMax  = vidaBase + CON * 3
//     defesa = floor(CON / 2) + equipamento
//
// Ou seja: vida e defesa só serviam para DEMORAR MAIS PARA MORRER. Nenhuma
// habilidade, em nenhuma das dez classes, ficava mais forte porque o
// personagem era robusto. Foi isso que o jogador descreveu como "só ataque
// importa" — e ele estava certo, literalmente: era o único eixo que comprava
// poder ofensivo.
//
// O sistema de ameaça (AmeacaSystem) resolveu metade do problema: quem é
// robusto passou a ATRAIR o golpe, então investir em vida e defesa deixou de
// ser desperdício. Mas atrair golpe é defensivo. Continuava não havendo
// NADA que transformasse robustez em ação.
//
// O MODELO: UM CAMPO, TRÊS FONTES
// -------------------------------
// Uma habilidade pode declarar `escala`, que soma à sua base uma parte de uma
// estatística DERIVADA de quem usa:
//
//     "escala": { "de": "defesa",      "fator": 0.6  }
//     "escala": { "de": "vidaMaxima",  "fator": 0.15 }
//     "escala": { "de": "vidaPerdida", "fator": 0.18 }
//
// É UM CAMPO, não um tipo de habilidade novo. Isso importa: `dano_fisico`,
// `dano_magico`, `dano_area`, `cura` e `cura_area` continuam sendo os mesmos
// cinco tipos, com a mesma régua de d20, crítico, elemento, formação e
// reação. `escala` entra na formação da BASE e nada mais — não é um caminho
// paralelo de dano, que é exatamente o erro que faria o balanceamento voltar
// à estaca zero.
//
// POR QUE SOMA E NÃO MULTIPLICA. Multiplicar faria a habilidade escalar com
// robustez E com o atributo de ataque ao mesmo tempo, e o produto de duas
// coisas que crescem por nível explode. Somando, a habilidade tem duas
// fontes independentes e o jogador escolhe qual alimentar.
//
// AS TRÊS FONTES E POR QUE ESTAS TRÊS
// -----------------------------------
//   defesa       o que você aguenta agora. Era a estatística mais morta do
//                jogo: fora reduzir dano recebido, não fazia nada.
//   vidaMaxima   o tamanho do corpo. Escala com CON e com equipamento de
//                vida, e é o que distingue um bárbaro de um mago.
//   vidaPerdida  hpMax - hp. Não é robustez, é RISCO: só rende quando você
//                já apanhou. É a fonte do bárbaro, e a única que o jogador
//                controla de dentro da luta.
//
// TETO, E POR QUE ELE EXISTE
// --------------------------
// O bônus é limitado a `TETO_SOBRE_BASE` vezes a base original da habilidade.
// Sem isso, um personagem com equipamento de defesa muito acima da curva
// transformaria uma habilidade de tier 1 num golpe de fim de jogo — e pior,
// o teto do jogo passaria a ser decidido pelo item mais quebrado que existe,
// não pelo desenho da classe. Com teto, robustez é uma SEGUNDA fonte forte,
// nunca a única que importa. É o mesmo raciocínio dos tetos de AmeacaSystem.
//
// Este módulo é só cálculo: não conhece a batalha, não sorteia e não muda
// estado. Quem usa é CombatSystem (golpe e prévia) e AutoBattleAI (escolha).

// Quanto o bônus pode valer, no máximo, em relação à base da própria
// habilidade. 1.5 = o bônus nunca passa de dobrar e meia a habilidade.
//
// COMEÇOU EM 1.0 E SUBIU, por um motivo medido. A base de ataque real de um
// personagem de nível 25 é ~95 (ela inclui o ataque de classe, não só a
// arma), enquanto a defesa dele é ~35. Para uma habilidade de defesa chegar a
// empatar com a melhor da classe, o fator precisa ser alto — e com teto 1.0 o
// bônus batia no limite com uns 50 de defesa. Ou seja: "escala com defesa"
// virava "x2 fixo", e o jogador que investisse em armadura além disso não via
// nada acontecer. A escala tem de ter uma FAIXA em que ela responde, senão
// não é escala.
export const TETO_SOBRE_BASE = 1.5;

export const FONTES = {
  // `defesa` aqui é a defesa de ficha (CON/2 + equipamento), NÃO a defesa
  // efetiva de combate. De propósito: a efetiva inclui buffs temporários e
  // postura, e uma habilidade que ficasse mais forte porque o personagem se
  // defendeu no turno anterior seria um laço difícil de ler na tela e fácil
  // de abusar em loop.
  defesa: (c) => Math.max(0, c?.defesa || 0),
  vidaMaxima: (c) => Math.max(0, c?.hpMax || 0),
  vidaPerdida: (c) => Math.max(0, (c?.hpMax || 0) - (c?.hp ?? c?.hpMax ?? 0)),
};

// Devolve o BÔNUS a somar à base — já limitado pelo teto. `base` é a base que
// a habilidade teria sem escala; passar 0 desliga o teto (usado pelos testes
// que querem olhar o valor cru da fonte).
//
// Devolve 0, sem erro, para habilidade sem `escala`, fonte desconhecida ou
// combatente sem a estatística. Uma habilidade mal declarada em JSON não pode
// derrubar o combate — o pior que acontece é ela não escalar, e o teste
// scripts/test-escala-derivada.mjs é quem pega isso antes de chegar no jogo.
export function bonusDeEscala(combatente, escala, base = 0) {
  if (!escala || !combatente) return 0;
  const fonte = FONTES[escala.de];
  if (!fonte) return 0;
  const fator = Number(escala.fator);
  if (!Number.isFinite(fator) || fator <= 0) return 0;
  const bruto = fonte(combatente) * fator;
  if (!Number.isFinite(bruto) || bruto <= 0) return 0;
  if (!(base > 0)) return bruto;
  return Math.min(bruto, base * TETO_SOBRE_BASE);
}

// Rótulo curto para a tela e para o registro de combate. Existe porque um
// número que aparece do nada é indistinguível de um bug: se a Represália do
// guerreiro bate mais forte quando ele está de escudo, o jogador precisa ver
// POR QUÊ, do mesmo jeito que vê os selos de elemento e de terreno.
export const ROTULO_DA_FONTE = {
  defesa: "DEFESA",
  vidaMaxima: "VIGOR",
  vidaPerdida: "SANGUE",
};

export function seloDeEscala(escala, bonus) {
  if (!escala || !(bonus > 0)) return null;
  const texto = ROTULO_DA_FONTE[escala.de];
  if (!texto) return null;
  return { texto, tom: "bom", pct: null, rotulo: `${texto} +${Math.round(bonus)}` };
}

// A IA PRECISA ENXERGAR A ESCALA — SENÃO A HABILIDADE NASCE MORTA.
//
// ISTO FOI UM DEFEITO MEDIDO, NÃO UMA PRECAUÇÃO. Com as doze habilidades já
// declaradas, compradas na árvore e presentes na ficha do combatente, a
// matriz de nicho deu números IDÊNTICOS aos de antes, até a primeira casa
// decimal, nas dez classes. A costura no motor estava certa; o que faltava
// era alguém escolher usá-las.
//
// A causa: AutoBattleAI ordena habilidade por `multiplicador` cru, em quatro
// lugares. A Represália do guerreiro é ×1,0 mais ~20 de dano vindo da defesa;
// o Golpe Poderoso que ele já tinha é ×1,5. Por multiplicador cru o Golpe
// Poderoso ganha sempre, e a Represália nunca é lançada — exatamente como
// `provocar` ficou sendo lido por AmeacaSystem sem nada no jogo o criar. Uma
// habilidade que o jogo nunca usa não é balanceamento: é código morto com
// nome bonito.
//
// `multiplicadorEfetivo` traduz o bônus plano de volta para a moeda que a IA
// já fala — quanto a habilidade rende EM RELAÇÃO à base daquele personagem.
// Uma habilidade sem `escala` devolve o multiplicador intacto, então o
// comportamento de todas as habilidades antigas fica igual ao que era.

// Replica a base de `rolarAtaque`: arma + 30% do atributo que aquela
// habilidade usa. Duplicação consciente e comentada dos dois lados — a IA não
// pode instanciar uma Batalha só para comparar duas habilidades.
export function baseDeAtaque(combatente, habilidade) {
  if (!combatente) return 0;
  if (habilidade?.tipo === "dano_magico") return combatente.atributos?.INT || 0;
  if (habilidade?.tipo === "cura" || habilidade?.tipo === "cura_area") {
    return Math.max(combatente.atributos?.INT || 0, combatente.atributos?.CON || 0);
  }
  const forcado = habilidade?.atributoForcado
    || (habilidade?.tipo === "dano_fisico_des" ? "DES" : null);
  const atributo = forcado || combatente.ataque?.atributo;
  const valor = (combatente.atributos && combatente.atributos[atributo]) || 0;
  return (combatente.ataque?.dano || 0) + Math.floor(valor * 0.3);
}

export function multiplicadorEfetivo(habilidade, combatente) {
  const mult = habilidade?.multiplicador || 0;
  if (!habilidade?.escala || !combatente) return mult;
  const base = baseDeAtaque(combatente, habilidade);
  if (!(base > 0)) return mult;
  return (mult * (base + bonusDeEscala(combatente, habilidade.escala, base))) / base;
}

// PROVOCAR — a alavanca ativa que faltava.
//
// AmeacaSystem já LÊ o status `provocar` e multiplica a ameaça por 6. Mas
// nenhuma habilidade do jogo o CRIAVA: o código de leitura estava morto desde
// que foi escrito. Sem isto, a única forma de puxar ataque era ser
// naturalmente robusto — passivo. Com isto, tankar vira uma decisão de turno.
//
// A duração é curta de propósito (2 a 3 turnos): provocação é um custo de
// turno, não um estado permanente. Um taunt permanente tornaria a formação
// irrelevante e faria todo inimigo do jogo se comportar igual — o mesmo
// defeito que AmeacaSystem existe para evitar.
export const ICONE_PROVOCAR = "🗯️";

export function criarStatusProvocar(habilidade) {
  return {
    tipo: "provocar",
    duracao: (habilidade?.duracao || 2) + 1,
    valor: 1,
    nome: habilidade?.nome || "Provocar",
    icone: ICONE_PROVOCAR,
  };
}
