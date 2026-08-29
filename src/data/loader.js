// Carrega todos os arquivos JSON de dados do jogo.
const ARQUIVOS = [
  "races", "classes", "backgrounds", "traits", "items",
  "monsters", "lootTables", "quests", "npcs", "recipes", "gachaRoster", "skillTrees",
  "elements", "enemyBehaviors", "skillChecks", "worldStateVariables", "compendium",
  "affinities", "explorationEvents", "travelingMerchant",
  "elementalStates", "elementalReactions",
  "subclasses", "talentsGuerreiro", "talentsMago", "heritageTree",
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

export async function carregarTodasImagens(dados) {
  const cache = {};
  const jobs = [];

  jobs.push(["tileset", "assets/tiles/tileset.png"]);
  jobs.push(["bau_fechado", "assets/sprites/bau_fechado.png"]);
  jobs.push(["bau_aberto", "assets/sprites/bau_aberto.png"]);
  jobs.push(["npc_marker", "assets/sprites/npc_marker.png"]);
  jobs.push(["entrada_masmorra", "assets/sprites/entrada_masmorra.png"]);
  ["erva", "minerio", "madeira"].forEach((k) => jobs.push([`no_${k}`, `assets/sprites/no_${k}.png`]));

  dados.races.forEach((r) => {
    dados.classes.forEach((c) => {
      const key = `pc_${r.id}_${c.id}`;
      jobs.push([key, `assets/sprites/${key}.png`]);
    });
  });
  dados.monsters.forEach((m) => jobs.push([m.sprite, `assets/sprites/${m.sprite}.png`]));
  (dados.gachaRoster || []).forEach((p) => {
    const key = `gacha_${p.id}`;
    jobs.push([key, `assets/sprites/${key}.png`]);
  });
  (dados.npcs || []).forEach((n) => {
    if (n.sprite) jobs.push([n.id, `assets/sprites/${n.sprite}`]);
  });

  const icones = new Set(dados.items.itens.map((i) => i.icone));
  icones.forEach((ic) => jobs.push([`icon_${ic}`, `assets/icons/${ic}.png`]));

  await Promise.all(
    jobs.map(async ([key, path]) => {
      cache[key] = await carregarImagem(path);
    })
  );
  return cache;
}
