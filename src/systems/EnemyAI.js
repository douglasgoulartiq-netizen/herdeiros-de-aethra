// Arquétipos de comportamento dos inimigos: decidem alvo e se um inimigo
// covarde deve hesitar em vez de atacar. Puramente sobre o espaço de ação
// que já existe (ataque básico + fuga individual) — não inventa mecânicas
// novas de combate. Nunca lê nada que o jogador ainda não confirmou: só
// enxerga o estado atual do time (hp/defesa/ataque/atb), igual à IA aleatória
// que já existia.
//
// Arquétipos com comportamento próprio: Agressor, Caçador, Atirador,
// Fanático, Comandante, Covarde (mira quem atacar quando decide atacar) e,
// numa segunda leva, Defensor, Controlador, Suporte, Conjurador, Ladrão e
// Invocador — estes seis ganharam habilidades novas de monstro (curar
// aliado, invocar reforço, roubar ouro, aplicar condição de veneno,
// proteger aliado, conjurar magia) implementadas em CombatSystem.js
// (Batalha.acaoEspecialArquetipo e métodos relacionados: curarAliado,
// protegerAliado, envenenar, conjurarAtaque, roubar, invocar). Quando a
// condição da ação especial não se aplica (ex.: Suporte sem ninguém para
// curar), o inimigo cai para um ataque básico mirado pelas regras abaixo.

export function escolherAlvoPorArquetipo(timeVivo, arquetipo) {
  if (!timeVivo.length) return null;
  switch (arquetipo) {
    case "agressor":
    case "suporte": // sem cura disponível, foca o mais ferido
      return timeVivo.reduce((pior, atual) => (atual.hp < pior.hp ? atual : pior));
    case "cacador":
    case "conjurador": // magia pune o mais frágil
    case "ladrao": // alvo fácil quando não há mais o que roubar
      return timeVivo.reduce((pior, atual) => (atual.defesa < pior.defesa ? atual : pior));
    case "atirador":
      return timeVivo.reduce((pior, atual) => ((atual.ataque?.dano || 0) > (pior.ataque?.dano || 0) ? atual : pior));
    case "fanatico":
      return timeVivo.reduce((pior, atual) => (atual.hp > pior.hp ? atual : pior));
    case "comandante":
    case "controlador": // controla o ritmo mirando quem está prestes a agir
    case "invocador":
      return timeVivo.reduce((pior, atual) => (atual.atb > pior.atb ? atual : pior));
    case "defensor":
    case "covarde":
    case "aleatorio":
    default:
      return timeVivo[Math.floor(Math.random() * timeVivo.length)];
  }
}

// Um Covarde hesita (não ataca neste turno) quando algum aliado já morreu
// ou o próprio HP está crítico. Não sai da batalha (evitaria mexer no
// tracking de loot/XP no fim da luta) — só perde a vez, o que já transmite
// bem a ideia de "recuar".
export function deveHesitar(inimigo, todosInimigos, arquetipo) {
  if (arquetipo !== "covarde") return false;
  const aliadoCaiu = todosInimigos.some((i) => i !== inimigo && !i.vivo);
  const hpCritico = inimigo.hp / inimigo.hpMax < 0.3;
  return aliadoCaiu || hpCritico;
}

// Gera a "intenção" mostrada ao jogador antes do inimigo agir — informação
// suficiente para planejar (alvo, tipo, elemento, perigo aproximado), sem
// necessariamente revelar o dano exato.
export function gerarIntencao(inimigo, alvo, arquetipo, dadosBehaviors) {
  const def = (dadosBehaviors && dadosBehaviors[arquetipo]) || dadosBehaviors?.aleatorio;
  const perigo = inimigo.chefe ? "alto" : inimigo.atributos.FOR >= 12 ? "medio" : "baixo";
  return {
    arquetipo,
    arquetipoNome: def?.nome || "Instável",
    alvoNome: alvo ? alvo.nome : null,
    tipo: "ataque",
    elemento: inimigo.elemento || "fisico",
    perigo,
  };
}
