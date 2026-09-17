// Carrega todos os arquivos JSON de dados do jogo.
import { IDS_DE_PROP } from "./propRegistry.js";
import { definirIndiceDeIcones, chavesDeIconeEmUso } from "./itemIcons.js";

const ARQUIVOS = [
  "races", "classes", "backgrounds", "traits", "items",
  "monsters", "lootTables", "quests", "npcs", "recipes", "gachaRoster", "skillTrees",
  "elements", "enemyBehaviors", "skillChecks", "worldStateVariables", "compendium",
  "affinities", "explorationEvents", "travelingMerchant",
  "elementalStates", "elementalReactions",
  "subclasses", "talentsGuerreiro", "talentsMago", "heritageTree",
  // Índice id-do-item -> chave do ícone, produzido por gerar-icones.py.
  "itemIcons",
  // Elenco de companheiros de mapa (ver PetSystem.js).
  "pets",
];

// Fallback por arquivo: usado quando o JSON não pode ser buscado (ex.: ainda
// não publicado nesta implantação). Mantém o jogo jogável mesmo com dados
// parciais, em vez de travar o boot inteiro.
const FALLBACK = {
  races: [], classes: [], backgrounds: [], traits: [], monsters: [],
  quests: [], npcs: [], recipes: [], gachaRoster: [],
  items: { raridades: [], itens: [] },
  lootTables: {}, skillTrees: {}, enemyBehaviors: {},
  elements: { elementos: [], matriz: {}, multiplicadores: {} },
  skillChecks: [],
  worldStateVariables: { facoes: [], tiers: [] },
  compendium: [],
  affinities: {},
  explorationEvents: [],
  travelingMerchant: [],
  elementalStates: { estados: [] },
  elementalReactions: { reacoes: [] },
  subclasses: { subclasses: [] },
  talentsGuerreiro: { talentos: [] },
  talentsMago: { talentos: [] },
  heritageTree: { nos: [] },
  itemIcons: {},
  pets: { pets: [] },
};

export async function carregarDados() {
  const entradas = await Promise.all(
    ARQUIVOS.map(async (nome) => {
      try {
        const resp = await fetch(`./src/data/${nome}.json`);
        if (!resp.ok) throw new Error(`Falha ao carregar ${nome}.json`);
        return [nome, await resp.json()];
      } catch (e) {
        console.warn(`[loader] usando fallback para ${nome}.json:`, e.message);
        return [nome, FALLBACK[nome]];
      }
    })
  );
  const dados = Object.fromEntries(entradas);
  window.__QUESTS__ = dados.quests; // usado por QuestSystem.js
  // O índice de ícones vira estado de módulo: a interface consulta por item,
  // sem ter de carregar o objeto inteiro em cada tela.
  definirIndiceDeIcones(dados.itemIcons);
  return dados;
}

// Placeholder gerado em canvas: usado quando um sprite não pode ser
// carregado (ex.: hospedagem que não inclui todos os assets binários).
// Nunca deve impedir o boot do jogo — apenas substitui visualmente.
function criarImagemPlaceholder() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#5b4636";
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = "#e0c080";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
  }
  return canvas;
}

export async function carregarImagem(caminho) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(criarImagemPlaceholder());
    img.src = caminho;
  });
}

export async function carregarImagemCadeia(caminhos) {
  const lista = Array.isArray(caminhos) ? caminhos : [caminhos];
  for (const caminho of lista.filter(Boolean)) {
    const img = await new Promise((resolve) => {
      const candidato = new Image();
      candidato.onload = () => resolve(candidato);
      candidato.onerror = () => resolve(null);
      candidato.src = caminho;
    });
    if (img) return img;
  }
  return criarImagemPlaceholder();
}

export async function carregarTodasImagens(dados) {
  const cache = {};
  const jobs = [];

  jobs.push(["tileset", "assets/tiles/tileset.png"]);
  // Folha estendida (ETAPA 2): neve, gelo, lava, cinzas, brejo, calçada,
  // ponte, lavoura, construção, cristal, mar profundo e osso. Carregada à
  // parte de propósito — a folha original é a arte do jogador e não é
  // sobrescrita. Se este arquivo faltar, carregarImagem devolve o
  // placeholder e o Renderer desenha o tile antigo equivalente
  // (TILE_FALLBACK em worldMap.js), sem quebrar nada.
  jobs.push(["tileset_extra", "assets/tiles/tileset_extra.png"]);
  // Máscaras de transição entre terrenos (ver TerrainBlend.js). Se o arquivo
  // faltar, carregarImagem devolve o placeholder, a mistura se desliga sozinha
  // e a fronteira volta a ser dura — como era antes, sem quebrar nada.
  jobs.push(["mascaras", "assets/tiles/mascaras.png"]);
  // Props de cenário (árvore, casa, rocha, templo...). São imagens SOLTAS e
  // não uma folha, porque cada uma tem um tamanho próprio em tiles — é
  // exatamente isso que tira o mapa do "tudo tem 1 tile". Se algum arquivo
  // faltar, carregarImagem devolve o placeholder e o Renderer simplesmente
  // pula o prop: o tile embaixo continua desenhado e a colisão não muda.
  IDS_DE_PROP.forEach((id) => jobs.push([`prop_${id}`, `assets/props/${id}.png`]));
  jobs.push(["bau_fechado", "assets/sprites/bau_fechado.png"]);
  jobs.push(["bau_aberto", "assets/sprites/bau_aberto.png"]);
  jobs.push(["npc_marker", "assets/sprites/npc_marker.png"]);
  jobs.push(["npc_cidadao_v2", "assets/sprites/npc_cidadao_v2.png"]);
  // Elenco civil detalhado. Cada cadeia termina num sprite antigo compatível:
  // uma publicação parcial continua jogável enquanto recebe o novo lote.
  const civis = {
    npc_campones_v2: "npc_fazendeiro.png",
    npc_mercador_v2: "npc_mercador.png",
    npc_guarda_v2: "npc_guarda.png",
    npc_artesao_v2: "npc_cidadao_v2.png",
    npc_anciao_v2: "npc_anciao.png",
    npc_viajante_v2: "npc_cacador.png",
  };
  Object.entries(civis).forEach(([key, legado]) => jobs.push([key, [
    `assets/sprites/${key}.png`,
    `assets/sprites/${legado}`,
    "assets/sprites/npc_cidadao_v2.png",
    "assets/sprites/npc_marker.png",
  ]]));
  jobs.push(["entrada_masmorra", "assets/sprites/entrada_masmorra.png"]);
  // Ponto de descanso (ver RestSystem.js). Se o arquivo faltar numa
  // publicação antiga, carregarImagem já devolve o placeholder e o jogo
  // continua funcionando — só o desenho fica genérico.
  jobs.push(["fogueira", "assets/sprites/fogueira.png"]);
  ["erva", "minerio", "madeira"].forEach((k) => jobs.push([`no_${k}`, `assets/sprites/no_${k}.png`]));
  // Companheiros de mapa: folha de 2 quadros, igual à do herói.
  ((dados.pets && dados.pets.pets) || []).forEach((p) => jobs.push([`pet_${p.id}`, `assets/sprites/pet_${p.id}.png`]));

  dados.races.forEach((r) => {
    dados.classes.forEach((c) => {
      const key = `pc_${r.id}_${c.id}`;
      jobs.push([key, `assets/sprites/${key}.png`]);
      // Sprite de BATALHA do herói, à parte da folha de caminhada. A folha tem
      // 64 px por quadro porque é desenhada no mapa, onde o tile tem 64; a
      // arena pede 192 (briefings-arte/00_CONTRATO_TECNICO.md). Usar o mesmo
      // arquivo nos dois lugares deixava o jogador como a ÚNICA figura de 16 px
      // lógicos numa arena de peças detalhadas. Se este arquivo faltar,
      // carregarImagem devolve o placeholder e a BattleUI cai sozinha na folha
      // antiga — nada quebra.
      jobs.push([`pcb_${r.id}_${c.id}`, [
        `assets/arte_intermediaria/pc_${r.id}_${c.id}.png`,
        `assets/arte_v2/pc_${r.id}_${c.id}.png`,
        `assets/sprites/pcb_${r.id}_${c.id}.png`,
        `assets/sprites/pc_${r.id}_${c.id}.png`,
      ]]);
    });
  });
  dados.monsters.forEach((m) => {
    jobs.push([m.sprite, `assets/sprites/${m.sprite}.png`]);
    jobs.push([`mb_${m.sprite}`, [`assets/arte_v2/${m.sprite}.png`, `assets/sprites/${m.sprite}.png`]]);
  });
  (dados.gachaRoster || []).forEach((p) => {
    const key = `gacha_${p.id}`;
    jobs.push([key, [`assets/arte_intermediaria/${key}.png`, `assets/sprites/${key}.png`]]);
  });
  (dados.npcs || []).forEach((n) => {
    if (n.sprite) jobs.push([n.id, `assets/sprites/${n.sprite}`]);
  });

  // Um ícone por ITEM (ver itemIcons.js), mais os vinte nomes antigos como
  // rede de segurança. Antes eram só os vinte — e como a pasta não existia,
  // os 287 itens do jogo apareciam todos como o mesmo placeholder marrom.
  chavesDeIconeEmUso(dados.items.itens)
    .forEach((ic) => jobs.push([`icon_${ic}`, `assets/icons/${ic}.png`]));

  await Promise.all(
    jobs.map(async ([key, path]) => {
      cache[key] = await carregarImagemCadeia(path);
    })
  );
  return cache;
}
