// FECHA O CICLO derrotar → ganhar → construir.
//
// O DEFEITO, MEDIDO
// -----------------
// O jogo tem 19 materiais e 5 receitas. Onze desses materiais — todos
// troféus arrancados de um chefe específico, com descrição do tipo
// "extraída só do Tirano do Charco" — não entram em receita NENHUMA. Quem
// derruba o Colosso das Pedras Cinzentas recebe um Núcleo do Colosso que
// só serve para ser VENDIDO por 95 de ouro. O item promete uma forja que
// não existe.
//
// A REGRA DE DESENHO, a mesma para os onze
// ---------------------------------------
//   1 troféu (o do chefe)  +  material comum de bancada  ->  1 peça
//
// A peça sempre supera o que o jogador acha na mesma faixa de nível, e o
// elemento e o efeito saem do CHEFE, não de uma tabela solta: quem matou o
// dragão veste escama de dragão, e a escama resiste a fogo. É isso que faz
// o troféu valer a luta em vez de valer o preço de venda.
//
// Idempotente: roda de novo sem duplicar. A fonte da verdade continua sendo
// items.json + recipes.json; este arquivo existe para o desenho das onze
// peças caber numa tela só e poder ser revisado de uma vez.
//
// Uso:  node scripts/aplicar-receitas-de-trofeu.mjs            (simulação)
//       node scripts/aplicar-receitas-de-trofeu.mjs --escrever
//       python3 scripts/gerar-icones.py                        (depois!)
import fs from "node:fs";

const ITENS = new URL("../src/data/items.json", import.meta.url);
const RECEITAS = new URL("../src/data/recipes.json", import.meta.url);

// Cada entrada: o material órfão, de qual chefe ele cai, a peça que ele vira
// e o custo em material de bancada. `chefe` é documentação — o vínculo real
// está em lootTables.json e foi conferido antes de escrever isto.
export const TROFEUS = [
  {
    material: "minerio_raro", chefe: "Dragão Jovem",
    receita: { id: "receita_lamina_elfica", nome: "Forjar Lâmina Élfica",
      ingredientes: [{ itemId: "minerio_raro", quantidade: 3 }, { itemId: "madeira", quantidade: 2 }] },
    item: {
      id: "lamina_elfica", nome: "Lâmina Élfica", tipo: "arma", subtipo: "espada",
      classeRecomendada: "guerreiro", raridade: "raro", icone: "espada", dano: 17,
      atributo: "FOR", valor: 120, elemento: "natureza", requisito: { FOR: 12 },
      descricao: "Uma lâmina de minério élfico, leve e fria ao toque. Dano baseado em FOR.",
    },
  },
  {
    material: "gema_rara", chefe: "qualquer chefe de zona",
    receita: { id: "receita_amuleto_radiante", nome: "Engastar Amuleto Radiante",
      ingredientes: [{ itemId: "gema_rara", quantidade: 2 }, { itemId: "minerio", quantidade: 4 }] },
    item: {
      id: "amuleto_radiante", nome: "Amuleto Radiante", tipo: "acessorio", slot: "amuleto",
      raridade: "epico", icone: "amuleto", bonusAtributo: { INT: 2, CON: 1 }, valor: 210,
      descricao: "+2 de Inteligência e +1 de Constituição. A gema guarda a luz de todo chefe que caiu por ela.",
    },
  },
  {
    material: "coracao_de_carvalho", chefe: "Guardião das Raízes Antigas",
    receita: { id: "receita_escudo_carvalho_vivo", nome: "Entalhar Escudo de Carvalho Vivo",
      ingredientes: [{ itemId: "coracao_de_carvalho", quantidade: 1 }, { itemId: "madeira", quantidade: 6 }, { itemId: "erva_rara", quantidade: 2 }] },
    item: {
      id: "escudo_de_carvalho_vivo", nome: "Escudo de Carvalho Vivo", tipo: "armadura",
      subtipo: "escudo", slot: "escudo", raridade: "epico", icone: "escudo", defesa: 8,
      valor: 170, requisito: { CON: 10 }, efeitos: ["quebra_postura"],
      descricao: "Escudo de Carvalho Vivo, oferece 8 de defesa. A madeira ainda fecha os próprios cortes.",
    },
  },
  {
    material: "viscera_toxica", chefe: "Tirano do Charco",
    receita: { id: "receita_presa_do_charco", nome: "Afiar Presa do Charco",
      ingredientes: [{ itemId: "viscera_toxica", quantidade: 1 }, { itemId: "minerio_raro", quantidade: 2 }, { itemId: "erva_rara", quantidade: 2 }] },
    item: {
      id: "presa_do_charco", nome: "Presa do Charco", tipo: "arma", subtipo: "adaga",
      classeRecomendada: "ladino", raridade: "epico", icone: "adaga", dano: 20,
      atributo: "DES", valor: 195, bonusCritico: 10, elemento: "veneno",
      requisito: { DES: 14 }, efeitos: ["condutor"],
      descricao: "Uma adaga do charco. Dano baseado em DES. Cada corte deixa o veneno assentado.",
    },
  },
  {
    material: "nucleo_do_colosso", chefe: "Colosso das Pedras Cinzentas",
    receita: { id: "receita_couraca_do_colosso", nome: "Forjar Couraça do Colosso",
      ingredientes: [{ itemId: "nucleo_do_colosso", quantidade: 1 }, { itemId: "minerio", quantidade: 8 }, { itemId: "gema", quantidade: 2 }] },
    item: {
      id: "couraca_do_colosso", nome: "Couraça do Colosso", tipo: "armadura",
      subtipo: "armadura", slot: "peito", raridade: "epico", icone: "armadura", defesa: 12,
      valor: 200, requisito: { CON: 12 },
      descricao: "Couraça do Colosso, oferece 12 de defesa. Pesa como a montanha de onde saiu.",
    },
  },
  {
    material: "pele_regenerativa", chefe: "Troll Ancião do Eco",
    receita: { id: "receita_manto_regenerativo", nome: "Curtir Manto Regenerativo",
      ingredientes: [{ itemId: "pele_regenerativa", quantidade: 1 }, { itemId: "erva_rara", quantidade: 3 }] },
    item: {
      id: "manto_regenerativo", nome: "Manto Regenerativo", tipo: "armadura",
      subtipo: "armadura", slot: "peito", raridade: "epico", icone: "armadura", defesa: 8,
      valor: 185, efeitos: ["roubo_de_vida"],
      descricao: "Manto Regenerativo, oferece 8 de defesa. A pele do troll continua se remendando sozinha.",
    },
  },
  {
    material: "escama_do_dragao_anciao", chefe: "Dragão Ancião das Cinzas",
    receita: { id: "receita_escudo_de_escamas", nome: "Rebitar Escudo de Escamas Ancestrais",
      ingredientes: [{ itemId: "escama_do_dragao_anciao", quantidade: 2 }, { itemId: "minerio_raro", quantidade: 4 }, { itemId: "gema_rara", quantidade: 1 }] },
    item: {
      id: "escudo_de_escamas", nome: "Escudo de Escamas Ancestrais", tipo: "armadura",
      subtipo: "escudo", slot: "escudo", raridade: "lendario", icone: "escudo", defesa: 11,
      valor: 980, requisito: { CON: 12 }, efeitos: ["algoz_de_chefes"],
      descricao: "Escudo de Escamas Ancestrais, oferece 11 de defesa. O fogo escorre por ele sem pegar.",
    },
  },
  {
    material: "chifre_da_colheita", chefe: "O Touro da Colheita",
    receita: { id: "receita_elmo_do_touro", nome: "Montar Elmo do Touro",
      ingredientes: [{ itemId: "chifre_da_colheita", quantidade: 1 }, { itemId: "minerio", quantidade: 5 }] },
    item: {
      id: "elmo_do_touro", nome: "Elmo do Touro", tipo: "armadura", subtipo: "elmo",
      slot: "cabeca", raridade: "raro", icone: "elmo", defesa: 5, valor: 105,
      bonusAtributo: { FOR: 1 },
      descricao: "Elmo do Touro, oferece 5 de defesa e +1 de Força. Os chifres continuam apontando para frente.",
    },
  },
  {
    material: "nucleo_carmesim", chefe: "O Capataz de Pedra",
    receita: { id: "receita_machado_carmesim", nome: "Forjar Machado Carmesim",
      ingredientes: [{ itemId: "nucleo_carmesim", quantidade: 1 }, { itemId: "minerio_raro", quantidade: 3 }, { itemId: "gema", quantidade: 2 }] },
    item: {
      id: "machado_carmesim", nome: "Machado Carmesim", tipo: "arma", subtipo: "machado",
      classeRecomendada: "barbaro", raridade: "epico", icone: "machado", dano: 25,
      atributo: "FOR", valor: 330, elemento: "terra", requisito: { FOR: 16 },
      efeitos: ["quebra_postura"],
      descricao: "Um machado carmesim. Dano baseado em FOR. O núcleo do capataz ainda bate dentro do cabo.",
    },
  },
  {
    material: "dente_da_engrenagem", chefe: "A Engrenagem Mestra",
    receita: { id: "receita_botas_da_engrenagem", nome: "Montar Botas da Engrenagem",
      ingredientes: [{ itemId: "dente_da_engrenagem", quantidade: 1 }, { itemId: "minerio_raro", quantidade: 2 }, { itemId: "madeira", quantidade: 2 }] },
    item: {
      id: "botas_da_engrenagem", nome: "Botas da Engrenagem", tipo: "armadura",
      subtipo: "botas", slot: "pes", raridade: "epico", icone: "botas", defesa: 3,
      valor: 320, bonusVelocidade: 8,
      descricao: "Botas da Engrenagem, oferece 3 de defesa. O dente do labirinto empurra cada passo.",
    },
  },
  {
    material: "elo_da_ancora_viva", chefe: "A Âncora Viva",
    receita: { id: "receita_elo_do_fundo", nome: "Engastar Elo do Fundo",
      ingredientes: [{ itemId: "elo_da_ancora_viva", quantidade: 1 }, { itemId: "gema_rara", quantidade: 1 }, { itemId: "minerio", quantidade: 4 }] },
    item: {
      id: "elo_do_fundo", nome: "Elo do Fundo", tipo: "acessorio", slot: "amuleto",
      raridade: "epico", icone: "amuleto", bonusAtributo: { CON: 3 }, valor: 325,
      descricao: "+3 de Constituição. O elo continua puxando para baixo, e quem o veste não sai do lugar.",
    },
  },
];

const dadosItens = JSON.parse(fs.readFileSync(ITENS, "utf8"));
const receitas = JSON.parse(fs.readFileSync(RECEITAS, "utf8"));

let itensNovos = 0; let itensAtualizados = 0;
for (const t of TROFEUS) {
  const i = dadosItens.itens.findIndex((x) => x.id === t.item.id);
  if (i >= 0) { dadosItens.itens[i] = t.item; itensAtualizados += 1; }
  else { dadosItens.itens.push(t.item); itensNovos += 1; }
}

let receitasNovas = 0; let receitasAtualizadas = 0;
for (const t of TROFEUS) {
  const r = { ...t.receita, resultadoId: t.item.id };
  const i = receitas.findIndex((x) => x.id === r.id);
  if (i >= 0) { receitas[i] = r; receitasAtualizadas += 1; }
  else { receitas.push(r); receitasNovas += 1; }
}

// Conferência antes de gravar: um ingrediente que não existe vira uma receita
// impossível de completar, e a interface da forja não tem como avisar isso.
const ids = new Set(dadosItens.itens.map((i) => i.id));
const quebrados = [];
for (const t of TROFEUS) {
  for (const ing of t.receita.ingredientes) if (!ids.has(ing.itemId)) quebrados.push(`${t.receita.id} -> ${ing.itemId}`);
}
if (quebrados.length) {
  console.error("ingrediente inexistente:", quebrados.join(", "));
  process.exit(1);
}

if (process.argv.includes("--escrever")) {
  fs.writeFileSync(ITENS, `${JSON.stringify(dadosItens, null, 2)}\n`, "utf8");
  fs.writeFileSync(RECEITAS, `${JSON.stringify(receitas, null, 2)}\n`, "utf8");
  console.log(`gravado: ${itensNovos} itens novos, ${itensAtualizados} atualizados; `
    + `${receitasNovas} receitas novas, ${receitasAtualizadas} atualizadas`);
  console.log("AGORA RODE:  python3 scripts/gerar-icones.py");
} else {
  console.log(`(simulacao — use --escrever) ${itensNovos} itens novos, ${itensAtualizados} atualizados; `
    + `${receitasNovas} receitas novas, ${receitasAtualizadas} atualizadas`);
  console.log(`total de receitas depois: ${receitas.length}`);
}
