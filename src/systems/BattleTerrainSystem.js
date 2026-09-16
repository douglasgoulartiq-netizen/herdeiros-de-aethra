// Cenário da batalha a partir do lugar onde ela começou — motor PURO, sem
// DOM e sem canvas.
//
// O QUE ESTE MÓDULO NÃO FAZ, DE PROPÓSITO: inventar bônus. Os números que
// ele devolve são os multiplicadores REAIS que o CombatSystem aplica
// (importados de lá, não copiados) — se um dia alguém mudar 1.2 para 1.3 no
// combate, a barra de cima muda junto sozinha. Uma UI que promete um bônus
// que o motor não calcula é pior que uma UI sem bônus nenhum.
//
// O QUE ELE FAZ: recebe os ids reais do jogo (zona, masmorra, tile pisado,
// elemento do terreno, clima) e devolve um descritor completo do cenário —
// nome, descrição curta, quais TILES DO PRÓPRIO JOGO desenham o chão e a
// vegetação ao fundo, a paleta de céu e a lista de modificadores com sinal.
//
// Os tiles vêm do tileset real (assets/tiles/tileset.png, os mesmos índices
// de TILE em worldMap.js). Isso resolve o pedido de "usar o terreno onde a
// batalha começou" sem precisar de nenhuma arte nova: o chão da batalha é
// literalmente o chão do mapa.
import { TILE } from "../data/worldMap.js";
import {
  BONUS_ATAQUE_TERRENO,
  RESISTENCIA_TERRENO_INIMIGO,
  BONUS_ATAQUE_CLIMA,
  RESISTENCIA_CLIMA_INIMIGO,
} from "./CombatSystem.js";

// Cenários por bioma. `chao` e `detalhe` são índices do tileset; `decor` são
// os tiles espalhados na faixa distante (silhuetas de vegetação/pedra).
// `ceu` é o gradiente do fundo, em pixel-art escuro pra HUD ficar legível
// por cima. `particula` liga o efeito ambiental discreto.
const CENARIOS = {
  floresta: {
    nome: "Floresta", chao: TILE.GRASS, detalhe: TILE.TALL_GRASS, decor: [TILE.TREE, TILE.BUSH],
    ceu: ["#16241c", "#25402c"], particula: "folhas",
    descricao: "Copas fechadas e raízes expostas: pouco espaço para recuar.",
  },
  pantano: {
    nome: "Pântano", chao: TILE.GRASS_DETAIL, detalhe: TILE.WATER, decor: [TILE.TREE, TILE.BUSH],
    ceu: ["#141d1a", "#22322a"], particula: "bolhas",
    descricao: "Solo encharcado que segura os pés e engole o som dos passos.",
  },
  deserto: {
    nome: "Deserto", chao: TILE.SAND, detalhe: TILE.SAND, decor: [TILE.WALL],
    ceu: ["#2a1f14", "#54402a"], particula: "areia",
    descricao: "Areia solta e calor que sobe do chão em ondas.",
  },
  montanha: {
    nome: "Montanha", chao: TILE.PATH, detalhe: TILE.WALL, decor: [TILE.WALL],
    ceu: ["#1a1a24", "#33333f"], particula: "poeira",
    descricao: "Pedra nua e vento cortante entre as encostas.",
  },
  costa: {
    nome: "Costa", chao: TILE.SAND, detalhe: TILE.WATER, decor: [TILE.BUSH],
    ceu: ["#12202c", "#1f3a4c"], particula: "respingo",
    descricao: "Faixa de areia batida pela maré, com o mar logo atrás.",
  },
  ruinas: {
    nome: "Ruínas", chao: TILE.DUNGEON_FLOOR, detalhe: TILE.PATH, decor: [TILE.WALL, TILE.DUNGEON_WALL],
    ceu: ["#1d1a16", "#332e26"], particula: "poeira",
    descricao: "Colunas caídas e mosaicos rachados de uma Aethra que não existe mais.",
  },
  masmorra: {
    nome: "Masmorra", chao: TILE.DUNGEON_FLOOR, detalhe: TILE.DUNGEON_FLOOR, decor: [TILE.DUNGEON_WALL],
    ceu: ["#0f0d12", "#1e1a22"], particula: "poeira",
    descricao: "Corredor de pedra sem saída à vista, iluminado só pelo que você trouxe.",
  },
  vila: {
    nome: "Vila", chao: TILE.VILLAGE_FLOOR, detalhe: TILE.PATH, decor: [TILE.BUSH],
    ceu: ["#241d16", "#3d3126"], particula: null,
    descricao: "Chão batido entre casas — ninguém esperava luta aqui.",
  },
  campo: {
    nome: "Campo Aberto", chao: TILE.GRASS, detalhe: TILE.GRASS_DETAIL, decor: [TILE.BUSH],
    ceu: ["#1a2418", "#2e4028"], particula: null,
    descricao: "Terreno plano e sem cobertura: nada atrapalha, nada protege.",
  },
};

// Palavras que identificam o bioma pelo NOME da zona. As zonas do jogo já se
// chamam "Pântano Negro", "Deserto de Karn", "Falésias do Fim" — usar isso é
// mais honesto do que manter uma segunda tabela de id→bioma que alguém vai
// esquecer de atualizar ao criar a zona 23.
const PISTAS = [
  [/pantano|pântano|charco|brum/i, "pantano"],
  [/deserto|karn|dun|areia/i, "deserto"],
  [/montanha|vale|pedra|falesia|falésia|colina/i, "montanha"],
  [/costa|recife|praia|aurora|mar/i, "costa"],
  [/ruina|ruína|aethra antiga|esquecid|confins/i, "ruinas"],
  [/caverna|covil|eco|galeria/i, "masmorra"],
  [/floresta|bosque|mata|arvore|árvore/i, "floresta"],
  [/vila|cidade|aldeia/i, "vila"],
  [/planicie|planície|campo|ventosa/i, "campo"],
];

// Fallback por TILE pisado, quando não há zona (ou o nome não diz nada).
const POR_TILE = {
  [TILE.WATER]: "pantano",
  [TILE.SAND]: "deserto",
  [TILE.TREE]: "floresta",
  [TILE.TALL_GRASS]: "floresta",
  [TILE.BUSH]: "floresta",
  [TILE.WALL]: "montanha",
  [TILE.DUNGEON_FLOOR]: "masmorra",
  [TILE.DUNGEON_WALL]: "masmorra",
  [TILE.VILLAGE_FLOOR]: "vila",
  [TILE.PATH]: "campo",
  [TILE.GRASS]: "campo",
  [TILE.GRASS_DETAIL]: "campo",
};

export const CENARIO_PADRAO = "campo";

// Escolhe o bioma: masmorra ganha na hora; depois o nome da zona; depois o
// tile pisado; e só então o padrão. Nunca inventa uma região — quando não
// sabe, assume "Campo Aberto", que é o cenário neutro.
export function resolverCenarioId({ mapaAtual, zonaNome, zonaId, tile } = {}) {
  if (mapaAtual && mapaAtual !== "overworld") {
    if (/dungeon2|cinza|covil/i.test(mapaAtual)) return "masmorra";
    return "masmorra";
  }
  const texto = `${zonaNome || ""} ${zonaId || ""}`;
  for (const [regex, id] of PISTAS) if (regex.test(texto)) return id;
  if (typeof tile === "number" && POR_TILE[tile]) return POR_TILE[tile];
  return CENARIO_PADRAO;
}

// Percentual legível a partir de um multiplicador: 1.2 -> "+20%".
export function pct(mult) {
  const p = Math.round((mult - 1) * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

// Modificadores REAIS do ambiente, na ordem em que interessam ao jogador.
// `sinal` é "+" (bônus), "-" (penalidade) ou "=" (neutro/informativo) — o
// pedido de acessibilidade era não depender de cor, então o sinal viaja
// junto com o texto e vira ▲/▼/— na tela.
export function modificadoresDoAmbiente({ elementoTerreno, elementoClima, nomeElemento = (id) => id } = {}) {
  const linhas = [];
  if (elementoTerreno) {
    linhas.push({
      sinal: "+", chave: `terreno_${elementoTerreno}`,
      texto: `${nomeElemento(elementoTerreno)} ${pct(BONUS_ATAQUE_TERRENO)}`,
      detalhe: `Ataques de ${nomeElemento(elementoTerreno)} causam ${pct(BONUS_ATAQUE_TERRENO)} de dano neste terreno.`,
    });
    linhas.push({
      sinal: "-", chave: `terreno_res_${elementoTerreno}`,
      texto: `Inimigos locais resistem ${nomeElemento(elementoTerreno)} ${pct(RESISTENCIA_TERRENO_INIMIGO)}`,
      detalhe: `A fauna nativa já se adaptou: recebe ${pct(RESISTENCIA_TERRENO_INIMIGO)} de dano desse elemento. Somando com o bônus acima, usar o elemento do terreno contra um inimigo local fica levemente desfavorável (${(BONUS_ATAQUE_TERRENO * RESISTENCIA_TERRENO_INIMIGO).toFixed(2)}x) — vale variar.`,
    });
  }
  if (elementoClima) {
    linhas.push({
      sinal: "+", chave: `clima_${elementoClima}`,
      texto: `${nomeElemento(elementoClima)} ${pct(BONUS_ATAQUE_CLIMA)}`,
      detalhe: `O clima reforça ataques de ${nomeElemento(elementoClima)} em ${pct(BONUS_ATAQUE_CLIMA)}.`,
    });
    linhas.push({
      sinal: "-", chave: `clima_res_${elementoClima}`,
      texto: `Inimigos resistem ${nomeElemento(elementoClima)} ${pct(RESISTENCIA_CLIMA_INIMIGO)}`,
      detalhe: `Efeito de clima é mais fraco que o de terreno de propósito: ele passa, o bioma fica.`,
    });
  }
  if (!linhas.length) {
    linhas.push({
      sinal: "=", chave: "neutro", texto: "Sem efeito ambiental",
      detalhe: "Nenhum elemento domina este lugar nem o clima atual — o combate é decidido só pelo que você trouxe.",
    });
  }
  return linhas;
}

// O descritor completo que a tela de batalha consome.
export function descreverCenario(contexto = {}) {
  const {
    mapaAtual = "overworld", zonaId = null, zonaNome = null, zonaDescricao = null, tile = null,
    elementoTerreno = null, elementoClima = null, climaNome = null, climaIcone = null,
    nomeElemento = (id) => id, iconeElemento = () => "",
  } = contexto;

  const id = resolverCenarioId({ mapaAtual, zonaNome, zonaId, tile });
  const base = CENARIOS[id] || CENARIOS[CENARIO_PADRAO];
  return {
    id,
    // Nome real da zona quando existe; o nome do bioma é só o fallback.
    nome: zonaNome || base.nome,
    subtitulo: base.nome,
    descricao: zonaDescricao || base.descricao,
    chao: base.chao,
    detalhe: base.detalhe,
    decor: base.decor,
    ceu: base.ceu,
    particula: base.particula,
    clima: climaNome ? { nome: climaNome, icone: climaIcone || "" } : null,
    elementoTerreno,
    elementoClima,
    iconeTerreno: elementoTerreno ? iconeElemento(elementoTerreno) : "",
    modificadores: modificadoresDoAmbiente({ elementoTerreno, elementoClima, nomeElemento }),
  };
}
