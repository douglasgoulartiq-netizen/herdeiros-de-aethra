// A FORJA PRECISA DIZER ONDE CONSEGUIR — E NUNCA INVENTAR.
//
// O QUE ESTE TESTE PROTEGE
// ------------------------
// A forja listava "Minério Élfico 0/2" e parava aí. O jogador fechava a tela
// sem nenhuma pista do que fazer em seguida, num lugar que é justamente onde
// ele foi porque QUER progredir de propósito. O jogo sabia a resposta o tempo
// todo — está em lootTables.json e na lista de recursos das zonas.
//
// As três regras que sustentam a dica:
//
//   VERDADE     toda origem citada existe no dado. Zona citada é zona real,
//               monstro citado é monstro real, e ele realmente derruba aquilo.
//   SILÊNCIO    item sem origem conhecida devolve null. Uma linha vazia é
//               melhor que uma pista errada — mandar o jogador ao lugar
//               errado é pior do que não dizer nada.
//   BREVIDADE   uma fonte, não todas. Erva tem nó em três zonas e cai de três
//               bichos; dizer tudo dá três linhas para UM ingrediente, e uma
//               receita tem vários. Havendo nó, o nó é a resposta.
//
// COBERTURA é medida e relatada, não exigida: quantos materiais de receita
// têm origem conhecida. O número deve subir com o tempo; travá-lo num piso
// alto hoje só quebraria a suíte quando alguém criasse um item novo.
//
// Uso:  node scripts/test-origem-de-item.mjs
import assert from "node:assert";
import fs from "node:fs";
import { origemDoItem } from "../src/systems/OrigemDeItem.js";
import { ZONAS_MUNDO } from "../src/data/world/zones.js";

const ler = (n) => JSON.parse(fs.readFileSync(new URL(`../src/data/${n}.json`, import.meta.url), "utf8"));
const dados = { monsters: ler("monsters"), lootTables: ler("lootTables") };
const { itens } = ler("items");
const brutoReceitas = ler("recipes");
const receitas = Array.isArray(brutoReceitas) ? brutoReceitas : Object.values(brutoReceitas)[0];

const nomesDeZona = new Set(ZONAS_MUNDO.map((z) => z.nome || z.id));
const idsDeZona = new Set(ZONAS_MUNDO.map((z) => z.id));
const porId = new Map(dados.monsters.map((m) => [m.id, m]));

let ok = 0;
const falhas = [];
const checar = (nome, cond, extra = "") => {
  if (cond) { ok += 1; return; }
  falhas.push(`${nome}${extra ? ` — ${extra}` : ""}`);
};

// --- VERDADE -----------------------------------------------------------
// Para todo material citado em alguma receita, o que a dica afirma tem de
// bater com o dado.
const materiais = [...new Set(receitas.flatMap((r) => (r.ingredientes || []).map((i) => i.itemId)))];
let comOrigem = 0;

for (const id of materiais) {
  const o = origemDoItem(id, dados);
  if (!o) continue;
  comOrigem += 1;

  checar(`${id}: a dica não é vazia`, o.texto && o.texto.trim().length > 0);
  checar(`${id}: as zonas citadas existem`, o.zonas.every((z) => idsDeZona.has(z)),
    o.zonas.filter((z) => !idsDeZona.has(z)).join(", "));
  checar(`${id}: os monstros citados existem`, o.monstros.every((m) => porId.has(m)),
    o.monstros.filter((m) => !porId.has(m)).join(", "));

  // O texto só pode nomear zonas de verdade. Extrai os nomes citados depois
  // de "colhido em" / "—" e confere um a um.
  const listados = (o.texto.match(/(?:colhido em |— )(.+)$/) || [, ""])[1]
    .split(",").map((s) => s.trim()).filter(Boolean);
  checar(`${id}: todo lugar citado é uma zona real`,
    listados.every((n) => nomesDeZona.has(n)), listados.filter((n) => !nomesDeZona.has(n)).join(" | "));

  // Se diz "cai de", aquele monstro derruba mesmo o item.
  if (o.texto.startsWith("cai de")) {
    checar(`${id}: quem "cai de" derruba de verdade`,
      o.monstros.every((m) => (dados.lootTables[m]?.pool || []).some((p) => p.itemId === id)));
  }

  // --- BREVIDADE -------------------------------------------------------
  // Havendo nó de colheita, a dica é sobre o nó e não mistura as duas fontes.
  const temNo = ZONAS_MUNDO.some((z) => (z.recursos || []).includes(id));
  if (temNo) {
    checar(`${id}: com nó, a dica fala do nó`, o.texto.startsWith("colhido em"), o.texto.slice(0, 60));
    checar(`${id}: com nó, não emenda a queda junto`, !o.texto.includes("cai de"), o.texto.slice(0, 80));
  }
  checar(`${id}: a dica cabe numa linha curta`, o.texto.length <= 160, `${o.texto.length} chars`);
}

// --- SILÊNCIO ----------------------------------------------------------
// Inventado não tem origem, e o módulo tem de admitir isso em vez de chutar.
checar("item inexistente devolve null", origemDoItem("item_que_nao_existe_xyz", dados) === null);
checar("id vazio devolve null", origemDoItem("", dados) === null);
checar("sem dados devolve null", origemDoItem("gema", null) === null);

// Item que existe no catálogo mas não vem de lugar nenhum (recompensa de
// missão, por exemplo) também tem de devolver null, não um texto vago.
const semOrigem = itens.filter((i) => !origemDoItem(i.id, dados));
checar("há itens sem origem conhecida, e eles devolvem null e não texto",
  semOrigem.every((i) => origemDoItem(i.id, dados) === null));

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error(`   ${f}`));
}
assert.equal(falhas.length, 0, "a dica de origem contradiz o dado");
console.log(`✓ ${ok} verificações passaram.`);
console.log(`✓ cobertura: ${comOrigem}/${materiais.length} materiais de receita têm origem conhecida`
  + ` (${Math.round(comOrigem / materiais.length * 100)}%).`);
