// ÓLEOS DE ARMA — untar a lâmina para trocar o elemento dos golpes.
//
// O QUE ESTAVA ERRADO
// -------------------
// Seis consumíveis do jogo (Óleo de Água, de Chama, de Raio, de Geada, de
// Terra e de Seiva) declaravam `oleoElemento` e `duracaoTurnos` em
// items.json, custavam 60 de ouro e diziam na descrição "seus golpes passam
// a ser de X por 5 turnos". Nenhuma linha de código lia esses dois campos:
// `usarConsumivel` tratava curaHP, curaMP e removeStatus, e no fim REMOVIA o
// item. Na prática o jogador comprava o óleo, usava, o item sumia e nada
// acontecia — sem mensagem de erro, sem aviso.
//
// COMO FUNCIONA AGORA
// -------------------
// O óleo é um estado com prazo, igual a qualquer outro buff de combate. Ele
// vive em `personagem.oleo` enquanto o herói está no mapa (é assim que ele
// sobrevive a usar o óleo ANTES da luta) e vira um `statusEffect` de tipo
// "oleo_arma" no combatente quando a batalha começa — o que dá de graça o
// relógio de duração, o ícone na ficha e a expiração, tudo já existente.
//
// Enquanto vale, `combatente.elemento` passa a ser o elemento do óleo. Essa
// é a razão de guardar `elementoBase`: quando o prazo acaba, o golpe volta a
// ser o da arma equipada, e não "físico".

// Um óleo por vez. Untar de novo SUBSTITUI — não empilha nem soma prazo.
// Empilhar deixaria seis óleos baratos valendo mais que uma arma lendária de
// elemento, e o preço deles (60 de ouro) não foi feito para isso.
export const TIPO_STATUS = "oleo_arma";

export function ehOleo(item) {
  return !!(item && item.tipo === "consumivel" && item.oleoElemento);
}

export function duracaoDoOleo(item) {
  return Math.max(1, Number(item && item.duracaoTurnos) || 5);
}

/** Unta a arma do personagem. Devolve a mensagem que a interface mostra. */
export function aplicarOleo(personagem, item) {
  if (!personagem || !ehOleo(item)) return null;
  const anterior = personagem.oleo && personagem.oleo.elemento;
  personagem.oleo = { elemento: item.oleoElemento, turnos: duracaoDoOleo(item) };
  return anterior && anterior !== item.oleoElemento
    ? `A arma é limpa e untada de novo: agora os golpes são de ${item.oleoElemento} por ${personagem.oleo.turnos} turnos.`
    : `Arma untada: os golpes são de ${item.oleoElemento} por ${personagem.oleo.turnos} turnos.`;
}

export function oleoAtivo(personagem) {
  const o = personagem && personagem.oleo;
  if (!o || !o.elemento || !(o.turnos > 0)) return null;
  return o;
}

export function limparOleo(personagem) {
  if (personagem) personagem.oleo = null;
}

/**
 * Estado de combate correspondente ao óleo do personagem, ou null.
 *
 * A duração leva +1 porque o relógio de status (tickStatus, em
 * CombatSystem.js) desconta um ponto já no primeiro turno — é a mesma
 * correção que buff_defesa e debuff_velocidade fazem ali.
 */
export function statusDoOleo(personagem) {
  const o = oleoAtivo(personagem);
  if (!o) return null;
  return { tipo: TIPO_STATUS, duracao: o.turnos + 1, elemento: o.elemento };
}

/** O elemento que os golpes deste combatente têm agora. */
export function elementoDoGolpe(combatente) {
  if (!combatente) return "fisico";
  const s = (combatente.statusEffects || []).find((x) => x.tipo === TIPO_STATUS);
  if (s && s.elemento) return s.elemento;
  return combatente.elemento || "fisico";
}

/**
 * Sincroniza `combatente.elemento` com o óleo. Chamada depois do relógio de
 * status: se o óleo acabou de expirar, o golpe volta a ser o da arma — e é
 * `elementoBase` que sabe qual era, porque `elemento` foi sobrescrito.
 */
export function sincronizarElemento(combatente) {
  if (!combatente) return;
  if (combatente.elementoBase === undefined) combatente.elementoBase = combatente.elemento;
  const s = (combatente.statusEffects || []).find((x) => x.tipo === TIPO_STATUS);
  combatente.elemento = (s && s.elemento) || combatente.elementoBase || "fisico";
}

/**
 * Desconta os turnos gastos na luta do óleo guardado no personagem.
 *
 * Sem isto o óleo seria eterno fora do combate: o `statusEffect` expira no
 * combatente (que é descartado no fim da batalha) mas `personagem.oleo`
 * continuaria intacto, e a próxima luta começaria com os 5 turnos de novo.
 */
export function devolverOleoAoPersonagem(personagem, combatente) {
  if (!personagem) return;
  const s = combatente && (combatente.statusEffects || []).find((x) => x.tipo === TIPO_STATUS);
  if (!s || !(s.duracao > 1)) { personagem.oleo = null; return; }
  personagem.oleo = { elemento: s.elemento, turnos: s.duracao - 1 };
}
