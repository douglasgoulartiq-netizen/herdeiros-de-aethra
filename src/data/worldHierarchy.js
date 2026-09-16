// HIERARQUIA DO MUNDO (ETAPA 1, task #35).
//
//   AETHRA  →  MACRO-REGIÃO  →  ZONA  →  LOCAL  →  INTERIOR
//
// Antes desta task o jogo tinha duas listas de "lugar" que não se
// conheciam: ZONAS (worldMap.js), as 22 áreas jogáveis com bounding box e
// pool de monstros; e ATLAS_REGIONS (atlasRegions.js), as 17 grandes regiões
// do mapa-múndi, com nome canônico, lore e facção. Quem estava no Deserto de
// Karn não tinha como saber que estava no Deserto de Arenth — o jogo não
// tinha onde guardar essa frase.
//
// Este arquivo é a costura, e ele NÃO INVENTA CÂNONE. Regra de ouro em três
// linhas:
//
//   • 15 macro-regiões saem inteiras do atlas, com a zona que o próprio
//     atlas já apontava em `zonaId`;
//   • 2 macro-regiões do atlas não têm zona jogável (Lago Prismático, Abismo
//     de Naz'thal) e continuam sem — entram como lore, `jogavel: false`;
//   • as 7 zonas que o atlas não menciona ganham cada uma sua macro-região
//     DERIVADA, com id prefixado `derivada_`, `derivado: true` e o nome da
//     própria zona. Nenhuma delas é enfiada à força numa região canônica: se
//     amanhã o material do mundo disser que Colinas Douradas fica em
//     Altaverde, é uma linha de dados que muda, e nada mais.
//
// O grafo de vizinhança NÃO vem da arte do mapa (as coordenadas x/y do atlas
// são posições de hotspot sobre uma imagem, aproximadas a olho — derivar
// fronteiras delas seria inventar). Ele vem da GRADE JOGÁVEL: duas zonas são
// vizinhas quando suas bounding boxes se encostam de fato. É o grafo por
// onde o jogador anda, que é o único que precisa estar certo.
import { ATLAS_REGIONS } from "./atlasRegions.js";
import {
  ZONAS, OVERWORLD_W, OVERWORLD_H, OVERWORLD_SPAWN,
  vizinhasDaZonaMundo, zonaNoPonto as zonaNoPontoMundo,
  DUNGEON_W, DUNGEON_H, DUNGEON2_W, DUNGEON2_H,
} from "./worldMap.js";
import { POIS, LANDMARKS, ASSENTAMENTOS, MASMORRAS_MUNDO, CATEGORIAS } from "./world/settlements.js";

// --- Nível 0: o mundo ------------------------------------------------------
export const AETHRA = {
  id: "aethra",
  nivel: "mundo",
  nome: "Aethra",
  largura: OVERWORLD_W,
  altura: OVERWORLD_H,
  spawn: { ...OVERWORLD_SPAWN },
};

// --- Nível 1: macro-regiões ------------------------------------------------
const ZONA_POR_ID = new Map(ZONAS.map((z) => [z.id, z]));
export const zonaPorId = (id) => ZONA_POR_ID.get(id) || null;

function macrosCanonicas() {
  return ATLAS_REGIONS.map((r) => {
    // As zonas de cada região vêm do campo `regiaoId` que a própria zona
    // declara (src/data/world/zones.js).
    //
    // Na ETAPA 1 a ligação vinha do campo `zonaId` do atlas, que aponta UMA
    // zona por região — bastava enquanto havia 22 zonas, e virou um problema
    // com 48: as outras 33 caíam todas em macro-região derivada, e o Olho do
    // Abismo aparecia como sua própria região em vez de parte do Abismo de
    // Naz'thal. As 15 ligações que o atlas já declarava foram TODAS
    // preservadas (o teste confere uma a uma); o que se acrescentou foi o
    // endereço das zonas novas, que é dado de geografia, não de cânone.
    const zonas = ZONAS.filter((z) => z.regiaoId === r.id).map((z) => z.id);
    return {
      id: r.id,
      nivel: "macro",
      derivado: false,
      nome: r.nomeCanonico,
      nomeMapa: r.nomeMapa,
      subtitulo: r.subtitulo,
      descricao: r.descricao,
      presencaDominante: r.presencaDominante,
      locaisLendarios: r.locaisLendarios,
      notaLigacao: r.notaLigacao || null,
      // Posição do hotspot sobre a arte do mapa-múndi, em % (0-100).
      atlas: { x: r.x, y: r.y },
      zonas,
      jogavel: zonas.length > 0,
    };
  });
}

function macrosDerivadas(canonicas) {
  const cobertas = new Set(canonicas.flatMap((m) => m.zonas));
  return ZONAS.filter((z) => !cobertas.has(z.id)).map((z) => ({
    id: `derivada_${z.id}`,
    nivel: "macro",
    derivado: true,
    // Por que existe: o atlas do mapa-múndi não cita esta área. Em vez de
    // encaixá-la na região canônica mais próxima (o que seria inventar
    // geografia), ela vira uma macro-região própria com o nome da zona.
    motivo: "zona sem região correspondente no atlas do mapa-múndi",
    nome: z.nome,
    nomeMapa: z.nome,
    subtitulo: null,
    descricao: z.descricao,
    presencaDominante: null,
    locaisLendarios: null,
    notaLigacao: null,
    atlas: null,
    zonas: [z.id],
    jogavel: true,
  }));
}

const CANONICAS = macrosCanonicas();
export const MACRO_REGIOES = [...CANONICAS, ...macrosDerivadas(CANONICAS)];

const MACRO_POR_ID = new Map(MACRO_REGIOES.map((m) => [m.id, m]));
const MACRO_POR_ZONA = new Map();
MACRO_REGIOES.forEach((m) => m.zonas.forEach((zid) => MACRO_POR_ZONA.set(zid, m)));

export const macroPorId = (id) => MACRO_POR_ID.get(id) || null;
export const macroDaZona = (zonaId) => MACRO_POR_ZONA.get(zonaId) || null;
export const zonasDaMacro = (macroId) => {
  const m = macroPorId(macroId);
  return m ? m.zonas.map(zonaPorId).filter(Boolean) : [];
};

// --- Nível 2: grafo de zonas ----------------------------------------------
// Duas zonas são vizinhas quando as bounding boxes se encostam por um lado
// inteiro (não por um canto): faixas sobrepostas num eixo e bordas coladas
// no outro. É a mesma vizinhança que carvearEstradas() usa pra abrir as
// estradas, então "vizinho no grafo" e "dá pra ir a pé" descrevem a mesma
// coisa — coisa que o teste cobra.
// A vizinhança vem da FRONTEIRA REAL entre territórios no mapa de posse (ver
// WorldLayout.js), não mais de caixas encostadas.
//
// Na ETAPA 1 as zonas eram retângulos numa grade, e "as caixas se tocam" era
// uma resposta exata. Com território orgânico ela virou ficção: duas caixas se
// sobrepõem sem que os territórios se encontrem, e dois territórios vizinhos
// podem ter caixas que nem se tocam. Perguntar ao mapa é a única resposta que
// continua verdadeira.
const GRAFO_ZONAS = new Map(ZONAS.map((z) => [z.id, vizinhasDaZonaMundo(z.id)]));

export const vizinhasDaZona = (zonaId) => [...(GRAFO_ZONAS.get(zonaId) || [])];

const GRAFO_MACROS = new Map(MACRO_REGIOES.map((m) => [m.id, new Set()]));
MACRO_REGIOES.forEach((m) => {
  m.zonas.forEach((zid) => vizinhasDaZona(zid).forEach((vid) => {
    const outra = macroDaZona(vid);
    if (outra && outra.id !== m.id) GRAFO_MACROS.get(m.id).add(outra.id);
  }));
});

export const vizinhasDaMacro = (macroId) => [...(GRAFO_MACROS.get(macroId) || [])];

// Busca em largura no grafo. Devolve a lista de ids do começo ao fim
// (inclusive os dois), ou [] se não houver caminho.
function caminho(grafo, de, para) {
  if (de === para) return grafo.has(de) ? [de] : [];
  if (!grafo.has(de) || !grafo.has(para)) return [];
  const anterior = new Map([[de, null]]);
  const fila = [de];
  for (let i = 0; i < fila.length; i += 1) {
    const atual = fila[i];
    for (const viz of grafo.get(atual)) {
      if (anterior.has(viz)) continue;
      anterior.set(viz, atual);
      if (viz === para) {
        const rota = [para];
        let p = atual;
        while (p !== null) { rota.unshift(p); p = anterior.get(p); }
        return rota;
      }
      fila.push(viz);
    }
  }
  return [];
}

export const caminhoEntreZonas = (de, para) => caminho(GRAFO_ZONAS, de, para);
export const caminhoEntreMacros = (de, para) => caminho(GRAFO_MACROS, de, para);

// --- Nível 3/4: locais e interiores ---------------------------------------
// Um LOCAL é um ponto nomeado dentro de uma zona (baú, nó, marco, chefe,
// entrada de masmorra). Um INTERIOR é um mapa próprio em que se entra por um
// local — hoje as duas masmorras.
// Interiores (masmorras). A ETAPA 2 deu nome próprio às duas — antes a
// primeira era só "Masmorra" — e tirou daqui a COORDENADA da boca: ela agora
// é escolhida pelo gerador dentro da zona declarada, porque uma coordenada
// escrita à mão num mundo gerado é uma promessa que uma hora vira parede.
// `zonaId` é o vínculo com o território (item 19).
export const INTERIORES = MASMORRAS_MUNDO.map((m, i) => ({
  id: m.id,
  nivel: "interior",
  nome: m.nome,
  nomeCanonico: m.id === "dungeon2", // "Covil das Cinzas" já existia no projeto
  zonaId: m.zonaId,
  boca: m.boca,
  largura: i === 0 ? DUNGEON_W : DUNGEON2_W,
  altura: i === 0 ? DUNGEON_H : DUNGEON2_H,
}));

// LOCAIS — o catálogo de lugares nomeados, sem coordenada.
//
// Na ETAPA 1 cada local trazia x/y porque as posições eram literais no
// arquivo. Na ETAPA 2 elas passaram a ser escolhidas pelo gerador dentro do
// território real da zona, e mudam com a semente — então guardá-las aqui
// seria guardar uma resposta desatualizada. A hierarquia responde "o que
// existe e onde pertence"; o mundo gerado responde "em que tile está".
function construirLocais() {
  const locais = [];
  const push = (o) => {
    const macro = macroDaZona(o.zonaId);
    locais.push({ nivel: "local", macroId: macro ? macro.id : null, ...o });
  };
  ASSENTAMENTOS.forEach((a) => push({
    id: a.id, nome: a.nome, tipo: "assentamento", zonaId: a.zonaId,
    categoria: a.categoria, rotulo: CATEGORIAS[a.categoria].rotulo,
    distritos: a.distritos, viagemRapida: !!a.viagemRapida, interior: null,
  }));
  POIS.forEach((p) => push({ id: p.id, nome: p.nome, tipo: "poi", subtipo: p.tipo, zonaId: p.zonaId, oferece: p.oferece, interior: null }));
  LANDMARKS.forEach((l) => push({ id: l.id, nome: l.nome, tipo: "landmark", subtipo: l.tipo, zonaId: l.zonaId, alcance: l.alcance, interior: null }));
  INTERIORES.forEach((i) => push({ id: `entrada_${i.id}`, nome: i.nome, tipo: "masmorra", zonaId: i.zonaId, interior: i.id }));
  ZONAS.forEach((z) => {
    if (!z.chefe) return;
    push({ id: `chefe_${z.id}`, nome: z.chefe.monstroId, tipo: "chefe", zonaId: z.id, monstroId: z.chefe.monstroId, interior: null });
  });
  return locais;
}

export const LOCAIS = construirLocais();

export const locaisDaZona = (zonaId) => LOCAIS.filter((l) => l.zonaId === zonaId);
export const locaisDaMacro = (macroId) => LOCAIS.filter((l) => l.macroId === macroId);

// --- Consulta por ponto ----------------------------------------------------
// Cadeia completa de onde um ponto do mundo aberto está. Com o território
// orgânico da ETAPA 2, TODO tile pertence a alguma zona — o vão de 504 tiles
// da grade antiga deixou de existir por construção —, então `zona` e `macro`
// só vêm null para um ponto fora do mapa.
export function localizar(x, y) {
  const zona = zonaNoPontoMundo(x, y);
  const macro = zona ? macroDaZona(zona.id) : null;
  return { mundo: AETHRA, macro, zona, local: null };
}

// "Aethra › Costa da Maré › Costa da Aurora"
//
// Nomes repetidos em sequência são colapsados: nas zonas de macro derivada a
// região tem o nome da própria zona, e "Aethra › Vila de Aethra › Vila de
// Aethra" só faz o leitor procurar a diferença que não existe.
export function trilha(x, y, { separador = " › " } = {}) {
  const { macro, zona } = localizar(x, y);
  const partes = [];
  [AETHRA.nome, macro && macro.nome, zona && zona.nome]
    .filter(Boolean)
    .forEach((nome) => { if (nome !== partes[partes.length - 1]) partes.push(nome); });
  return partes.join(separador);
}

// --- Território sem zona -------------------------------------------------
// A grade 6x4 da ETAPA 1 deixava o canto inferior direito sem região nenhuma:
// 504 tiles, 6,6% do mapa, em que não havia pool de monstros, clima nem
// descanso. A partição orgânica da ETAPA 2 não tem como deixar vão — todo
// tile é do território mais próximo —, então esta medida existe agora como
// GUARDA: se algum dia voltar a dar diferente de zero, alguma coisa quebrou.
function calcularAreasSemZona() {
  let tiles = 0;
  for (let y = 0; y < OVERWORLD_H; y += 1) {
    for (let x = 0; x < OVERWORLD_W; x += 1) if (!zonaNoPontoMundo(x, y)) tiles += 1;
  }
  return tiles ? { tiles, fracao: tiles / (OVERWORLD_W * OVERWORLD_H) } : null;
}

export const AREA_SEM_ZONA = calcularAreasSemZona();

// --- Resumo (diagnóstico) --------------------------------------------------
// Usado pelo teste e por HDA_MUNDO() no console — um retrato de uma linha do
// estado da geografia, útil pra conferir a ETAPA 2 sem abrir arquivo.
export function resumoHierarquia() {
  return {
    mundo: AETHRA.nome,
    macroRegioes: MACRO_REGIOES.length,
    canonicas: MACRO_REGIOES.filter((m) => !m.derivado).length,
    derivadas: MACRO_REGIOES.filter((m) => m.derivado).length,
    soLore: MACRO_REGIOES.filter((m) => !m.jogavel).length,
    zonas: ZONAS.length,
    zonasSemMacro: ZONAS.filter((z) => !macroDaZona(z.id)).length,
    locais: LOCAIS.length,
    interiores: INTERIORES.length,
    arestasZona: [...GRAFO_ZONAS.values()].reduce((s, v) => s + v.length, 0) / 2,
    areaSemZona: AREA_SEM_ZONA ? `${AREA_SEM_ZONA.tiles} tiles (${(AREA_SEM_ZONA.fracao * 100).toFixed(1)}%)` : "nenhuma",
  };
}
