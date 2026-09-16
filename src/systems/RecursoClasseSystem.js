// MARCAS DE CLASSE ("recurso de identidade") — motor PURO, sem DOM.
//
// POR QUE ISTO EXISTE
// -------------------
// Passiva (PassiveSystem.js) vale SEMPRE. Habilidade ativa vale QUANDO VOCÊ
// GASTA O TURNO. Faltava o meio-termo: um bônus que vale sozinho, sem gastar
// turno, mas SÓ quando a situação é a certa. É isso que faz duas classes com
// o mesmo número de dano jogarem diferente:
//
//   • o Bárbaro quer estar quase morrendo   (Fúria)
//   • o Guerreiro quer estar inteiro         (Guarda)
//   • o Ladino quer o alvo quase morto       (Presa)
//   • o Mago quer o alvo ainda inteiro       (Foco)
//
// Nenhum deles ganha "mais dano". Todos ganham dano NUM MOMENTO DIFERENTE da
// batalha — e é o momento que muda como você joga a classe.
//
// A REGRA DE PROJETO QUE MANDA AQUI: zero estado novo.
// Toda condição abaixo é lida de coisas que a batalha JÁ tem (hp, hpMax, mp,
// statusEffects, quantos inimigos estão vivos). Nada é acumulado entre
// turnos, nada precisa ser salvo, nada precisa de migração de save. Uma
// marca é uma função pura do estado atual — se o estado voltar, o bônus
// volta junto, e não existe "recurso zerado por bug".
//
// Uma marca é concedida por um nó final de ramo da árvore de habilidades
// (tipoConcedido: "marca", ver skillTrees.json) e mora em
// `personagem.arvore.marcas`.

// As condições que o combate sabe avaliar. Uma condição desconhecida devolve
// `false` em vez de quebrar — dado novo nunca derruba uma batalha em curso.
export const CONDICOES = {
  hp_proprio_abaixo: "Enquanto sua vida estiver abaixo do limiar",
  hp_proprio_acima: "Enquanto sua vida estiver acima do limiar",
  hp_alvo_abaixo: "Contra alvos abaixo do limiar de vida",
  hp_alvo_acima: "Contra alvos acima do limiar de vida",
  eter_proprio_acima: "Enquanto seu Éter estiver acima do limiar",
  alvo_debilitado: "Contra alvos sob qualquer efeito negativo",
  aliado_ferido: "Enquanto algum aliado estiver ferido",
  inimigos_vivos: "Quanto mais inimigos em campo",
  hp_perdido_escalonado: "Cresce conforme você perde vida",
};

function fracaoVida(c) {
  if (!c || !c.hpMax) return 1;
  return Math.max(0, c.hp) / c.hpMax;
}

function fracaoEter(c) {
  if (!c) return 0;
  const max = c.mpMax || c.eterMax || 0;
  if (!max) return 0;
  return Math.max(0, c.mp != null ? c.mp : c.eter || 0) / max;
}

// Avalia UMA condição. Devolve { ativa, escala } — `escala` é 1 para as
// condições binárias e cresce para as escalonadas (Fúria, Massacre), de
// forma que quem chama multiplica sempre do mesmo jeito.
export function avaliarCondicao(cond, portador, alvo, ctx = {}) {
  if (!cond || !cond.tipo) return { ativa: true, escala: 1 };
  const lim = cond.limiar != null ? cond.limiar : 0.5;
  switch (cond.tipo) {
    case "hp_proprio_abaixo": return { ativa: fracaoVida(portador) < lim, escala: 1 };
    case "hp_proprio_acima": return { ativa: fracaoVida(portador) > lim, escala: 1 };
    case "hp_alvo_abaixo": return { ativa: !!alvo && fracaoVida(alvo) < lim, escala: 1 };
    case "hp_alvo_acima": return { ativa: !!alvo && fracaoVida(alvo) > lim, escala: 1 };
    case "eter_proprio_acima": return { ativa: fracaoEter(portador) > lim, escala: 1 };
    case "alvo_debilitado": {
      const efeitos = (alvo && alvo.statusEffects) || [];
      const ruins = efeitos.filter((e) => e && !String(e.tipo || "").startsWith("buff_"));
      return { ativa: ruins.length > 0 || !!(alvo && alvo.atordoado), escala: 1 };
    }
    case "aliado_ferido": {
      const aliados = ctx.aliados || [];
      return { ativa: aliados.some((a) => a && a !== portador && a.vivo !== false && fracaoVida(a) < lim), escala: 1 };
    }
    case "inimigos_vivos": {
      const n = ctx.inimigosVivos || 0;
      const minimo = cond.minimo != null ? cond.minimo : 2;
      // Escala pelo EXCEDENTE: 2 inimigos = 1 degrau, 3 = 2 degraus...
      return { ativa: n >= minimo, escala: Math.max(0, n - (minimo - 1)) };
    }
    case "hp_perdido_escalonado": {
      const perdido = 1 - fracaoVida(portador);
      const fatia = cond.fatia || 0.2;
      return { ativa: perdido > 0, escala: Math.floor(perdido / fatia) };
    }
    default: return { ativa: false, escala: 0 };
  }
}

// Neutro: a mesma forma sempre, para quem chama nunca testar null.
export function neutroMarca() {
  return { dano: 1, defesa: 1, cura: 1, critico: 0, ativas: [] };
}

// As marcas que um combatente carrega. Vêm da árvore (nós de ramo final) e,
// para um convocado do gacha, podem vir direto do próprio personagem.
export function marcasDe(portador) {
  if (!portador) return [];
  const saida = [];
  if (Array.isArray(portador.marcas)) saida.push(...portador.marcas);
  if (portador.arvore && Array.isArray(portador.arvore.marcas)) saida.push(...portador.arvore.marcas);
  return saida.filter((m) => m && m.efeito);
}

// O bônus resultante AGORA, para este portador contra este alvo.
//
// `escala` multiplica só a PARTE que cresce: um efeito declarado como
// `{ dano: 0.12, escalonado: true }` com escala 3 vira +36% (1.36), enquanto
// `{ dano: 1.35 }` sem `escalonado` é um multiplicador fixo. Os dois convivem
// porque escalonado é opt-in e o teto vem de `maximo`.
export function bonusDeMarcas(portador, alvo, ctx = {}) {
  const saida = neutroMarca();
  for (const m of marcasDe(portador)) {
    const { ativa, escala } = avaliarCondicao(m.condicao, portador, alvo, ctx);
    if (!ativa || escala <= 0) continue;
    const e = m.efeito;
    if (e.escalonado) {
      const teto = e.maximo != null ? e.maximo : Infinity;
      if (e.dano) saida.dano *= 1 + Math.min(teto, e.dano * escala);
      if (e.critico) saida.critico += Math.min(teto, e.critico * escala);
    } else {
      if (e.dano) saida.dano *= e.dano;
      if (e.defesa) saida.defesa *= e.defesa;
      if (e.cura) saida.cura *= e.cura;
      if (e.critico) saida.critico += e.critico;
    }
    saida.ativas.push(m);
  }
  return saida;
}

// Texto curto para a tela: "🔥 Fúria — ativa (+24% de dano)".
export function descreverMarca(m, portador, alvo, ctx = {}) {
  const { ativa, escala } = avaliarCondicao(m.condicao, portador, alvo, ctx);
  const partes = [];
  const e = m.efeito || {};
  if (e.escalonado && e.dano) {
    const teto = e.maximo != null ? e.maximo : Infinity;
    const agora = ativa ? Math.min(teto, e.dano * escala) : 0;
    partes.push(`+${Math.round(agora * 100)}% de dano`);
  } else {
    if (e.dano) partes.push(`${e.dano >= 1 ? "+" : ""}${Math.round((e.dano - 1) * 100)}% de dano`);
    if (e.defesa) partes.push(`${Math.round((1 - e.defesa) * 100)}% menos dano recebido`);
    if (e.cura) partes.push(`+${Math.round((e.cura - 1) * 100)}% de cura`);
    if (e.critico) partes.push(`+${Math.round(e.critico * 100)}% de crítico`);
  }
  return `${m.icone || "◈"} ${m.nome} — ${ativa ? "ATIVA" : "inativa"}${partes.length ? ` (${partes.join(", ")})` : ""}`;
}
