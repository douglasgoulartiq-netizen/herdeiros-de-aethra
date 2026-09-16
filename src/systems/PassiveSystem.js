// PASSIVAS — motor PURO, sem DOM.
//
// POR QUE ISTO EXISTE
// -------------------
// O jogo não tinha o conceito. Toda habilidade era ATIVA: você gasta o turno,
// ela acontece, acabou. Isso significa que um convocado só se diferencia
// enquanto é a vez dele — nos outros três quartos da batalha ele é um saco de
// HP com um número de ataque.
//
// Passiva é o oposto: não gasta turno, não aparece na mão de cards, e vale o
// tempo todo. É o que faz um time ser uma COMPOSIÇÃO em vez de quatro
// atacantes em fila. "Levo a Lyanthe porque o time inteiro cura 20% mais" é
// uma decisão de montagem de time; "levo porque ela bate 3 a mais" não é.
//
// COMO FUNCIONA
// -------------
// Uma passiva é um objeto declarado nos dados:
//
//   { id, nome, icone, descricao, efeito: { tipo, valor, escopo } }
//
//   escopo: "proprio" (só quem tem)  |  "time" (todo o grupo)
//
// Este módulo NÃO aplica nada sozinho. Ele apenas SOMA as passivas ativas de
// um time e devolve os modificadores resultantes; quem multiplica é o
// CombatSystem, num ponto só. É o que impede duas passivas iguais de serem
// aplicadas duas vezes por caminhos diferentes.

// Os tipos que o combate entende. Um tipo desconhecido é ignorado em vez de
// quebrar — dados novos nunca derrubam uma batalha em andamento.
export const TIPOS_PASSIVA = {
  dano: "Multiplica o dano causado",
  defesa: "Reduz o dano recebido",
  cura_recebida: "Amplia a cura recebida",
  velocidade: "Multiplica a velocidade",
  critico: "Soma à chance de crítico",
  vida_max: "Multiplica o HP máximo",
  eter_max: "Multiplica o Éter máximo",
  roubo_vida: "Converte parte do dano em cura",
  resistencia_elemental: "Reduz o dano elemental recebido",
  ouro: "Aumenta o ouro ganho",
  xp: "Aumenta o XP ganho",
};

// Neutro: o que `modificadoresDoTime` devolve quando ninguém tem passiva.
// Devolver sempre a mesma forma é o que permite ao CombatSystem multiplicar
// sem testar nada.
export function neutro() {
  return {
    dano: 1, defesa: 1, cura_recebida: 1, velocidade: 1,
    critico: 0, vida_max: 1, eter_max: 1, roubo_vida: 0,
    resistencia_elemental: 1, ouro: 1, xp: 1,
    ativas: [],
  };
}

// As passivas que UM personagem carrega. Vêm de duas fontes:
//   • `passivas` do próprio personagem (convocado do gacha, ver gachaSkills)
//   • nós de árvore já escolhidos que concedem passiva
export function passivasDe(personagem) {
  if (!personagem) return [];
  const saida = [];
  if (Array.isArray(personagem.passivas)) saida.push(...personagem.passivas);
  // Nós de árvore que concedem passiva. O formato do nó é o mesmo do
  // skillTrees.json — `tipoConcedido: "passiva"`.
  if (personagem.arvore && Array.isArray(personagem.arvore.passivas)) {
    saida.push(...personagem.arvore.passivas);
  }
  return saida.filter((p) => p && p.efeito && TIPOS_PASSIVA[p.efeito.tipo]);
}

// Soma as passivas do time inteiro, respeitando o ESCOPO de cada uma.
//
// Devolve um modificador por membro (`porMembro[id]`) porque uma passiva de
// escopo "proprio" vale só para quem a tem — misturar tudo num número só
// daria o bônus de todo mundo para todo mundo.
export function modificadoresDoTime(time) {
  const membros = (time || []).filter(Boolean);
  const porMembro = {};
  const doTime = neutro();

  // 1ª passagem: passivas de escopo "time" viram um bônus comum.
  for (const m of membros) {
    for (const p of passivasDe(m)) {
      if (p.efeito.escopo !== "time") continue;
      aplicarNo(doTime, p);
    }
  }

  // 2ª passagem: cada membro recebe o bônus comum MAIS o que é só dele.
  for (const m of membros) {
    const meu = clonar(doTime);
    for (const p of passivasDe(m)) {
      if (p.efeito.escopo === "time") continue;
      aplicarNo(meu, p);
    }
    porMembro[m.id || m.uid || m.nome] = meu;
  }

  return { doTime, porMembro };
}

function clonar(m) {
  return { ...m, ativas: [...m.ativas] };
}

// Como cada tipo se acumula. Multiplicativos multiplicam; aditivos somam.
// Escrever isso num lugar só evita o clássico "duas passivas de crítico
// somam num lugar e multiplicam noutro".
const ADITIVOS = new Set(["critico", "roubo_vida"]);

function aplicarNo(mod, passiva) {
  const { tipo, valor } = passiva.efeito;
  if (!(tipo in mod)) return;
  if (ADITIVOS.has(tipo)) mod[tipo] += valor;
  else mod[tipo] *= valor;
  mod.ativas.push(passiva);
}

// O modificador de um combatente específico, pronto para o combate usar.
// Aceita o resultado de `modificadoresDoTime` para não recalcular a cada
// golpe — recalcular por golpe seria O(time × passivas) num laço quente.
export function modificadorDe(mapa, combatente) {
  if (!mapa || !combatente) return neutro();
  const chave = combatente.id || combatente.uid || combatente.nome;
  return mapa.porMembro[chave] || neutro();
}

// Texto para a tela: uma linha por passiva ativa.
export function descreverPassivas(personagem) {
  return passivasDe(personagem).map((p) => `${p.icone || "◆"} ${p.nome} — ${p.descricao}`);
}
