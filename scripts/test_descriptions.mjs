// Smoke test para task #40: descrições completas — garante que todo item,
// habilidade/magia, classe, raça, antecedente, traço e personagem de gacha
// tem um campo "descricao" (ou equivalente) não vazio, pra nunca regredir
// e algum conteúdo novo entrar sem descrição visível ao jogador.
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function ler(nome) {
  return JSON.parse(fs.readFileSync(new URL(`../src/data/${nome}.json`, import.meta.url)));
}

const items = ler("items");
const classes = ler("classes");
const races = ler("races");
const backgrounds = ler("backgrounds");
const traits = ler("traits");
const skillTrees = ler("skillTrees");
const gachaRoster = ler("gachaRoster");
const compendium = ler("compendium");
const monsters = ler("monsters");

function textoValido(s) {
  return typeof s === "string" && s.trim().length > 5;
}

// --- itens: todo item da loja/inventário tem descrição ---
{
  const semDescricao = items.itens.filter((i) => !textoValido(i.descricao));
  check(`todos os ${items.itens.length} itens têm descrição`, semDescricao.length === 0);
}

// --- classes: descrição da classe + descrição de cada habilidade inicial ---
{
  const semDescricaoClasse = classes.filter((c) => !textoValido(c.descricao));
  check(`todas as ${classes.length} classes têm descrição própria`, semDescricaoClasse.length === 0);
  const habilidadesSemDescricao = classes.flatMap((c) => c.habilidades).filter((h) => !textoValido(h.descricao));
  check("todas as habilidades iniciais de classe têm descrição", habilidadesSemDescricao.length === 0);
}

// --- raças: descrição da raça + descrição do traço racial ---
{
  const semDescricao = races.filter((r) => !textoValido(r.descricao) || !textoValido(r.descricaoTraco));
  check(`todas as ${races.length} raças têm descrição e descrição de traço racial`, semDescricao.length === 0);
}

// --- antecedentes ---
{
  const semDescricao = backgrounds.filter((b) => !textoValido(b.descricao));
  check(`todos os ${backgrounds.length} antecedentes têm descrição`, semDescricao.length === 0);
}

// --- traços de personalidade ---
{
  const semDescricao = traits.filter((t) => !textoValido(t.descricao));
  check(`todos os ${traits.length} traços têm descrição`, semDescricao.length === 0);
}

// --- árvore de habilidades: todo nó e toda habilidade concedida tem descrição ---
{
  let semDescricao = [];
  // skillTrees.json passou a ser { [classe]: { ramos, nos } } — antes a classe
  // mapeava direto para o array de nós, e este teste parou de rodar (estourava
  // em nodes.forEach) sem ninguém notar.
  Object.entries(skillTrees).forEach(([classeId, arvore]) => {
    (arvore.nos || []).forEach((n) => {
      if (!textoValido(n.descricao)) semDescricao.push(`${classeId}/${n.id}`);
      if (n.habilidade && !textoValido(n.habilidade.descricao)) semDescricao.push(`${classeId}/${n.id}/habilidade`);
    });
  });
  check("todos os nós da árvore de habilidades (e habilidades concedidas) têm descrição", semDescricao.length === 0);
}

// --- gacha: bio do personagem + descrição da habilidade assinatura ---
{
  const semBio = gachaRoster.filter((p) => !textoValido(p.descricao));
  check(`todos os ${gachaRoster.length} personagens do gacha têm bio (descricao)`, semBio.length === 0);
  const semHabilidade = gachaRoster.filter((p) => !p.habilidade || !textoValido(p.habilidade.descricao));
  check("toda habilidade assinatura de personagem de gacha tem descrição", semHabilidade.length === 0);
}

// --- compêndio (bestiário): teaser + lore por monstro (já coberto por
// gen_compendium.py/task #37, revalidado aqui como parte da garantia geral
// de "descrições completas") ---
{
  const idsMonstros = new Set(monsters.map((m) => m.id));
  const cobreTodos = monsters.every((m) => compendium.some((c) => c.id === m.id));
  check("todo monstro tem entrada de bestiário (teaser + lore)", cobreTodos);
  const semTexto = compendium.filter((c) => !textoValido(c.teaser) || !textoValido(c.lore));
  check("toda entrada de bestiário tem teaser e lore não vazios", semTexto.length === 0);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
