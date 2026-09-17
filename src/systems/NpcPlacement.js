// ONDE CADA NPC FICA NO MAPA (ETAPA 3, itens 1, 9 e 10).
//
// O BUG QUE ISTO CORRIGE
// ----------------------
// Até a ETAPA 2, main.js colocava os NPCs assim:
//
//     dados.npcs.forEach((n, i) => { const vaga = vagas[i % vagas.length]; ... })
//
// isto é: encaixava cada NPC numa das dez vagas que o gerador abriu ao redor
// da praça da vila, na ordem do array. Com cinco NPCs isso passava
// despercebido — todos eram da vila mesmo. Com cem, os cem apareceriam
// empilhados na mesma praça, dez por vaga, incluindo o barqueiro do Lago
// Prismático e o Portador de Vulkor. O campo `regiao` da ficha era decorativo.
//
// Aqui o lugar da ficha passa a valer: cada NPC fica no assentamento, POI ou
// zona que a rotina dele indica PARA A HORA ATUAL, e num ponto estável ao
// redor daquele lugar. Estável importa — NPC que troca de tile a cada
// consulta pisca na tela e engana o índice de chunks.
import { NPCS_REGIONAIS, npcPorId } from "../data/world/npcs/index.js";
import { localAgora, requisitoAtendido, atividadeAgora } from "./NpcSystem.js";
import { SOLID_TILES } from "../data/worldMap.js";

// Espiral quadrada a partir do centro: primeiro anel, segundo anel, e assim
// por diante. Determinística e densa perto do centro, que é onde a gente
// espera achar gente num assentamento.
function* espiral(cx, cy, raioMax) {
  yield { x: cx, y: cy };
  for (let r = 1; r <= raioMax; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) { yield { x: cx + dx, y: cy - r }; yield { x: cx + dx, y: cy + r }; }
    for (let dy = -r + 1; dy <= r - 1; dy += 1) { yield { x: cx - r, y: cy + dy }; yield { x: cx + r, y: cy + dy }; }
  }
}

function hashLeve(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// Os seis arquétipos civis usam a mesma linguagem visual dos heróis do mapa,
// mas comunicam a profissão antes mesmo de o jogador abrir o diálogo. A
// função fica exportada para o Atlas, testes e futuros retratos de conversa
// poderem aplicar exatamente a mesma escolha.
export const SPRITES_CIVIS = Object.freeze([
  "npc_campones_v2",
  "npc_mercador_v2",
  "npc_guarda_v2",
  "npc_artesao_v2",
  "npc_anciao_v2",
  "npc_viajante_v2",
]);

const SERVICOS_POR_VISUAL = [
  [["forja", "aprimoramento", "runa"], "npc_artesao_v2", "artesão"],
  [["loja", "compra", "correio"], "npc_mercador_v2", "mercador"],
  [["treino", "escolta", "recompensa"], "npc_guarda_v2", "guarda"],
  [["pesquisa", "traducao", "arcano"], "npc_anciao_v2", "sábio"],
  [["guia", "viagem", "mapa", "bestiario"], "npc_viajante_v2", "viajante"],
  [["cura", "erva", "alquimia", "veneno", "descanso"], "npc_campones_v2", "morador"],
];

function textoNormalizado(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function visualDoNpc(npc = {}) {
  const servicos = npc.servicos || [];
  for (const [tipos, spriteKey, papelVisual] of SERVICOS_POR_VISUAL) {
    if (tipos.some((tipo) => servicos.includes(tipo))) return { spriteKey, papelVisual };
  }

  const papel = textoNormalizado(npc.papel);
  if (/autoridade|conflito|faccao|soldado|guarda/.test(papel)) {
    return { spriteKey: "npc_guarda_v2", papelVisual: "guarda" };
  }
  if (/artesao|ferreiro|alquim/.test(papel)) {
    return { spriteKey: "npc_artesao_v2", papelVisual: "artesão" };
  }
  if (/historiador|sabio|anciao|erudito/.test(papel)) {
    return { spriteKey: "npc_anciao_v2", papelVisual: "sábio" };
  }
  if (/explorador|misterioso|andarilho|cacador/.test(papel)) {
    return { spriteKey: "npc_viajante_v2", papelVisual: "viajante" };
  }
  if (/mercador|comerciante/.test(papel)) {
    return { spriteKey: "npc_mercador_v2", papelVisual: "mercador" };
  }
  return { spriteKey: "npc_campones_v2", papelVisual: "morador" };
}

// A região não troca arbitrariamente a profissão de um NPC importante. Nos
// figurantes, porém, ela muda a mistura de roupas que se vê na rua: portos e
// fronteiras têm mais viajantes, centros ricos têm mercadores e zonas de
// ofício têm artesãos. Continua determinístico para não piscar entre saves.
export function visualAmbienteDaRegiao(regiaoId = "", indice = 0) {
  const regiao = textoNormalizado(regiaoId);
  let opcoes = ["npc_campones_v2", "npc_artesao_v2", "npc_viajante_v2"];
  if (/costa|recife|arquipelago|vento|lago/.test(regiao)) {
    opcoes = ["npc_viajante_v2", "npc_campones_v2", "npc_mercador_v2"];
  } else if (/vulkor|canon|ruina|morranvell/.test(regiao)) {
    opcoes = ["npc_artesao_v2", "npc_guarda_v2", "npc_viajante_v2"];
  } else if (/altaverde|elyndor|bosque/.test(regiao)) {
    opcoes = ["npc_campones_v2", "npc_artesao_v2", "npc_mercador_v2"];
  } else if (/deserto|pantano|selva|abismo/.test(regiao)) {
    opcoes = ["npc_viajante_v2", "npc_anciao_v2", "npc_campones_v2"];
  }
  return opcoes[Math.abs(indice) % opcoes.length];
}

const ICONE_SERVICO = [
  [["forja", "aprimoramento"], "🔨", "Forja"],
  [["loja", "compra"], "🛒", "Comércio"],
  [["cura", "erva"], "✚", "Cura"],
  [["viagem", "guia", "mapa"], "🧭", "Viagem e mapas"],
  [["descanso"], "☾", "Descanso"],
  [["treino", "tecnica"], "⚔", "Treinamento"],
  [["pesquisa", "arcano"], "✦", "Conhecimento"],
];

// Um símbolo por NPC, priorizando o que ele oferece AGORA. A exclamação é
// reservada a missões ainda abertas; os demais mostram o serviço principal.
function marcadorDoNpc(npc, personagem) {
  const concluidas = personagem?.missoesConcluidas || [];
  const ativas = personagem?.missoesAtivas || [];
  const questAberta = npc.questId && !concluidas.includes(npc.questId)
    && (ativas.some((q) => q.id === npc.questId) || (npc.servicos || []).includes("missoes"));
  if (questAberta) return { icone: "!", rotulo: "Missão disponível", cor: "#ffd45a" };
  const servicos = npc.servicos || [];
  for (const [tipos, icone, rotulo] of ICONE_SERVICO) {
    if (tipos.some((tipo) => servicos.includes(tipo))) return { icone, rotulo, cor: "#b8e7ff" };
  }
  if (npc.ensina) return { icone: "★", rotulo: "Pode ensinar", cor: "#d8b6ff" };
  return null;
}

// Índice localId -> ponto, a partir do mundo gerado. Assentamento e POI têm
// coordenada própria; zona cai no centro dela. Uma masmorra usa a entrada.
export function indiceDeLugares(gerado) {
  const mapa = new Map();
  (gerado.assentamentos || []).forEach((a) => mapa.set(a.id, { x: a.x, y: a.y, raio: a.raio || 4 }));
  (gerado.pois || []).forEach((p) => mapa.set(p.id, { x: p.x, y: p.y, raio: 3 }));
  (gerado.landmarks || []).forEach((l) => { if (!mapa.has(l.id)) mapa.set(l.id, { x: l.x, y: l.y, raio: 3 }); });
  (gerado.masmorras || []).forEach((m) => { if (m.entrada) mapa.set(m.id, { x: m.entrada.x, y: m.entrada.y, raio: 2 }); });
  // Zona sem assentamento nem POI: o NPC fica no território dela. Prefere-se
  // `centroReal` (o centro de massa do que foi realmente pintado) ao `centro`
  // declarado, porque em zonas de forma estranha — o Olho do Abismo é um
  // vórtice oceânico, os Confins são o fim do mapa — o centro declarado cai
  // na água. Guarda-se também a caixa da zona como plano B.
  (gerado.zonas || []).forEach((z) => {
    if (mapa.has(z.id)) return;
    const c = z.centroReal || z.centro;
    if (!c) return;
    mapa.set(z.id, {
      x: c.x, y: c.y, raio: 6,
      caixa: (z.x0 !== undefined) ? { x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 } : null,
    });
  });
  return mapa;
}

// Um ponto livre e estável para este NPC, ao redor do lugar dele. `ocupados`
// é um Set de "x,y" compartilhado pela chamada inteira, para dois NPCs nunca
// caírem no mesmo tile.
export function pontoDoNpc(npcId, lugar, grid, ocupados) {
  if (!lugar) return null;
  const raio = Math.max(2, lugar.raio || 4);
  // O deslocamento inicial vem do id: NPCs do mesmo lugar começam a procurar
  // em pontos diferentes da espiral, então não se acumulam todos no primeiro
  // tile livre a nordeste.
  const pulo = hashLeve(npcId) % Math.max(1, raio * 2 + 1);
  let vistos = 0;
  let primeiroLivre = null;
  for (const p of espiral(lugar.x, lugar.y, raio + 2)) {
    if (p.y < 0 || p.x < 0 || !grid[p.y] || grid[p.y][p.x] === undefined) continue;
    if (SOLID_TILES.has(grid[p.y][p.x])) continue;
    const chave = `${p.x},${p.y}`;
    if (ocupados.has(chave)) continue;
    if (!primeiroLivre) primeiroLivre = p;
    if (vistos >= pulo) { ocupados.add(chave); return p; }
    vistos += 1;
  }
  if (primeiroLivre) { ocupados.add(`${primeiroLivre.x},${primeiroLivre.y}`); return primeiroLivre; }

  // Plano B: a espiral não achou chão firme perto do centro. Acontece em zona
  // de água — o Olho do Abismo é um vórtice, os Confins são o fim do mapa — e
  // deixava o NPC de fora do jogo em certos períodos do dia, o que é pior do
  // que pô-lo alguns tiles adiante. Varre a caixa da zona inteira.
  const cx = lugar.caixa;
  if (cx) {
    for (let y = cx.y0; y <= cx.y1; y += 1) {
      for (let x = cx.x0; x <= cx.x1; x += 1) {
        if (!grid[y] || grid[y][x] === undefined) continue;
        if (SOLID_TILES.has(grid[y][x])) continue;
        const chave = `${x},${y}`;
        if (ocupados.has(chave)) continue;
        ocupados.add(chave);
        return { x, y };
      }
    }
  }
  return null;
}

// A lista de NPCs posicionados AGORA. Só entra quem a rotina põe num lugar que
// existe no mapa e quem já cumpriu requisito de aparição (item 32).
//
// Custo: uma passada pelos 100 NPCs, feita quando o mundo é montado e quando
// vira o período do dia — não por quadro. Quem filtra por proximidade depois
// é o índice de chunks, que já existe desde a ETAPA 1.
export function posicionarNpcs(gerado, contexto) {
  const lugares = indiceDeLugares(gerado);
  const grid = gerado.grid;
  const ocupados = new Set();
  const agora = contexto.agora ?? Date.now();
  const fora = [];
  const postos = [];
  const ambientes = [];

  NPCS_REGIONAIS.forEach((npc) => {
    if (!requisitoAtendido(npc, { ...contexto, agora })) return;
    const localId = localAgora(npc, agora);
    const lugar = lugares.get(localId) || lugares.get(npc.local);
    if (!lugar) { fora.push({ id: npc.id, local: localId }); return; }
    const p = pontoDoNpc(npc.id, lugar, grid, ocupados);
    if (!p) { fora.push({ id: npc.id, local: localId }); return; }
    const visual = visualDoNpc(npc);
    postos.push({
      ...npc,
      x: p.x, y: p.y,
      localAtual: localId,
      atividade: atividadeAgora(npc, agora),
      // Autoridades, mercadores, ferreiros e personagens de missão ficam em
      // seus postos. Só uma pequena parcela de cidadãos/exploradores passeia.
      ambulante: ["cidadão memorável", "explorador"].includes(npc.papel)
        && !(npc.servicos || []).some((s) => ["missoes", "loja", "forja", "cura", "descanso"].includes(s))
        && hashLeve(npc.id) % 7 === 0,
      marcador: marcadorDoNpc(npc, contexto.personagem),
      mostrarNome: true,
      spriteKey: visual.spriteKey,
      papelVisual: visual.papelVisual,
      varianteRegional: npc.regiao,
    });
  });

  // População ambiente: as cidades tinham autoridades e quest givers, mas
  // quase nenhum morador comum. Estes cidadãos são determinísticos, podem ser
  // abordados e caminham visualmente perto da praça sem entrar em paredes.
  const nomes = ["Moradora", "Artesão", "Viajante", "Pescadora", "Aprendiz", "Patrulheiro"];
  const falas = [
    "As estradas mudam, mas a praça sempre sabe quem voltou.",
    "Hoje o Éter está inquieto. Dá para sentir nas ferramentas.",
    "Se for sair da cidade, leve provisões e preste atenção ao relevo.",
    "Toda caravana traz uma história e leva outra embora.",
  ];
  (gerado.assentamentos || []).forEach((a) => {
    const quantidade = a.categoria === "CAPITAL" ? 3 : a.categoria === "CIDADE" ? 2 : 1;
    const lugar = lugares.get(a.id);
    for (let i = 0; i < quantidade; i += 1) {
      const id = `amb_${a.id}_${i}`;
      const p = pontoDoNpc(id, lugar, grid, ocupados);
      if (!p) continue;
      const h = hashLeve(id);
      ambientes.push({
        id, nome: nomes[h % nomes.length], dialogo: falas[h % falas.length],
        x: p.x, y: p.y, ancoraX: p.x, ancoraY: p.y,
        localAtual: a.id, regiaoId: a.regiaoId, atividade: "circulando pela cidade",
        // No máximo um transeunte móvel nas cidades grandes; vilas menores
        // ganham presença humana sem parecer que todos deslizam pela praça.
        ambulante: i === 0 && ["CAPITAL", "CIDADE"].includes(a.categoria),
        mostrarNome: false,
        ambiente: true,
        spriteKey: visualAmbienteDaRegiao(a.regiaoId, h + i),
        papelVisual: "morador",
        varianteRegional: a.regiaoId,
      });
    }
  });

  return { npcs: postos, ambientes, semLugar: fora };
}

// Onde ESTE NPC está agora, sem posicionar os outros. Usado pelo Atlas e por
// qualquer tela que queira apontar um NPC no mapa.
export function ondeEsta(npcId, gerado, agora = Date.now()) {
  const npc = npcPorId(npcId);
  if (!npc) return null;
  const lugares = indiceDeLugares(gerado);
  const localId = localAgora(npc, agora);
  const lugar = lugares.get(localId) || lugares.get(npc.local);
  if (!lugar) return null;
  return { localId, x: lugar.x, y: lugar.y, atividade: atividadeAgora(npc, agora) };
}
