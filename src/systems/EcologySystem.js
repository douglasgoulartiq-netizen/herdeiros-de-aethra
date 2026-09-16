// ECOLOGIA EM JOGO (ETAPA 3, itens 21 a 27).
//
// A zona diz QUEM pode aparecer nela (zones.js, herdado da ETAPA 2). Este
// módulo decide QUEM aparece AGORA, e por quê: hora do dia, clima da zona,
// migração em vigor. É consultado quando o jogador dá um passo em terreno
// selvagem — a mesma frequência do sorteio de encontro que já existia — e
// nunca simula a ecologia inteira em tempo real, que o item 41 proíbe.
//
// O resultado é uma LISTA PONDERADA, não um filtro seco: uma espécie noturna
// não some de dia, fica rara. Filtro seco deixaria zonas vazias em certos
// horários, e zona vazia é pior que zona previsível.
import { ECOLOGIA, MIGRACOES, habitatCombina, predadoresDe } from "../data/world/ecology.js";
import { ZONAS_MUNDO } from "../data/world/zones.js";
import { horaDoDiaAtual, climaAtualDaZona } from "./WeatherSystem.js";

const ZONA = new Map(ZONAS_MUNDO.map((z) => [z.id, z]));

// Pesos. Fora do horário a espécie não some — fica 4x mais rara. Clima que
// favorece dobra; clima do qual ela foge quase zera (0.1, não 0: "quase
// nunca" conta uma história melhor do que "nunca").
export const PESO = { HORARIO_CERTO: 3, HORARIO_ERRADO: 0.75, CLIMA_BOM: 2, CLIMA_RUIM: 0.1, NORMAL: 1 };

// --- migração (item 24) ----------------------------------------------------
export function migracoesEmVigor(contexto) {
  const { worldState = {}, eventosAtivos = [], zonaId, agora = Date.now() } = contexto;
  return MIGRACOES.filter((m) => {
    const c = m.causa;
    if (c.tipo === "eventoAtivo") return eventosAtivos.includes(c.id);
    if (c.tipo === "worldState") return worldState[c.chave] === c.valor;
    if (c.tipo === "clima") {
      const alvo = (c.zonas && c.zonas[0]) || zonaId;
      return alvo ? climaAtualDaZona(alvo, agora).id === c.id : false;
    }
    return false;
  });
}

// Quem saiu desta zona e quem chegou nela por conta das migrações ativas.
export function ajusteDeMigracao(zonaId, contexto) {
  const saem = new Set();
  const chegam = new Set();
  migracoesEmVigor(contexto).forEach((m) => {
    if (m.saemDe.includes(zonaId)) {
      m.especies.forEach((e) => saem.add(e));
      (m.seguem || []).forEach((e) => saem.add(e));
    }
    if (m.vaoPara.includes(zonaId)) {
      m.especies.forEach((e) => chegam.add(e));
      (m.seguem || []).forEach((e) => chegam.add(e));
    }
  });
  return { saem: [...saem], chegam: [...chegam] };
}

// --- pool da zona agora ----------------------------------------------------
export function poolDaZona(zonaId, contexto = {}) {
  const z = ZONA.get(zonaId);
  if (!z) return [];
  const agora = contexto.agora ?? Date.now();
  const hora = horaDoDiaAtual(agora).id;
  const clima = climaAtualDaZona(zonaId, agora).id;
  const { saem, chegam } = ajusteDeMigracao(zonaId, { ...contexto, zonaId, agora });

  const base = (z.monstros || []).filter((id) => !saem.includes(id));
  // Migrante só entra se o habitat da zona de destino aceitar. É o item 22
  // valendo também para quem chegou fugindo — bicho não vira outro bicho por
  // ter mudado de endereço.
  const entrantes = chegam.filter((id) => !base.includes(id) && habitatCombina(id, zonaId));

  return [...base, ...entrantes].map((id) => {
    const e = ECOLOGIA[id];
    if (!e) return { id, peso: PESO.NORMAL, motivo: "sem ecologia declarada" };
    let peso = PESO.NORMAL;
    const motivos = [];
    if (e.horario === "sempre" || e.horario === hora) { peso *= PESO.HORARIO_CERTO; motivos.push("no horário"); }
    else { peso *= PESO.HORARIO_ERRADO; motivos.push("fora do horário"); }
    if (e.clima.includes(clima)) { peso *= PESO.CLIMA_BOM; motivos.push(`favorecida por ${clima}`); }
    if (e.climaFoge.includes(clima)) { peso *= PESO.CLIMA_RUIM; motivos.push(`evita ${clima}`); }
    if (entrantes.includes(id)) motivos.push("migrou para cá");
    return { id, peso, motivo: motivos.join(", "), migrante: entrantes.includes(id) };
  }).filter((c) => c.peso > 0);
}

// Sorteia respeitando o peso. `rnd` injetável para o teste ser determinístico.
export function sortearEspecie(zonaId, contexto = {}, rnd = Math.random) {
  const pool = poolDaZona(zonaId, contexto);
  if (pool.length === 0) return null;
  const total = pool.reduce((s, c) => s + c.peso, 0);
  let alvo = rnd() * total;
  for (const c of pool) {
    if (alvo < c.peso) return c;
    alvo -= c.peso;
  }
  return pool[pool.length - 1];
}

// Quantos indivíduos, segundo o `grupo` da espécie (item 23: grupo é traço da
// espécie, não do nível do jogador).
export function tamanhoDoGrupo(especieId, rnd = Math.random) {
  const e = ECOLOGIA[especieId];
  if (!e || !Array.isArray(e.grupo)) return 1;
  const [min, max] = e.grupo;
  return min + Math.floor(rnd() * (max - min + 1));
}

// --- bestiário (item 25) ---------------------------------------------------
// Encontrar a criatura na região alimenta o Compendium. Aqui só se decide O
// QUE foi descoberto e com que pista; quem grava é o CompendiumSystem, que já
// existia e não muda.
export function descobertaAoEncontrar(especieId, zonaId) {
  const e = ECOLOGIA[especieId];
  const z = ZONA.get(zonaId);
  if (!e || !z) return null;
  return {
    especieId,
    zonaId,
    regiaoId: z.regiaoId,
    pista: e.descoberta,
    ameaca: e.ameaca,
    // O que mais o jogador aprende de graça ao ver esta espécie: quem a come
    // e o que ela come. É a cadeia do item 23 aparecendo na ficha do bicho.
    come: e.dieta.filter((d) => ECOLOGIA[d]),
    comidaPor: predadoresDe(especieId),
  };
}

// --- consultas de apoio ----------------------------------------------------
export function especiesDaRegiao(regiaoId) {
  const ids = new Set();
  ZONAS_MUNDO.filter((z) => z.regiaoId === regiaoId).forEach((z) => {
    (z.monstros || []).forEach((m) => ids.add(m));
    if (z.chefe) ids.add(z.chefe.monstroId);
  });
  return [...ids];
}

// Diagnóstico usado pelo teste e pelo relatório: o que a zona oferece em cada
// um dos três períodos, com o mesmo clima. Serve para provar que dia e noite
// não devolvem a mesma lista (item 27).
export function perfilDoDia(zonaId, contexto = {}) {
  const base = contexto.agora ?? Date.now();
  const DUR = 4 * 60 * 1000; // DURACAO_HORA_DIA_MS
  return ["manha", "tarde", "noite"].map((hora, i) => {
    const agora = base + i * DUR;
    const pool = poolDaZona(zonaId, { ...contexto, agora });
    const total = pool.reduce((s, c) => s + c.peso, 0) || 1;
    return {
      hora,
      dominante: pool.slice().sort((a, b) => b.peso - a.peso).map((c) => c.id)[0] || null,
      chances: pool.map((c) => ({ id: c.id, chance: +(c.peso / total).toFixed(3) })),
    };
  });
}
