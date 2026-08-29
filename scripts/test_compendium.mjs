// Smoke test para task #37: Compêndio (bestiário/abates, missões, invocações).
import {
  garantirCompendio, registrarAbateCompendio, totalAbates, jaEncontrado,
  bestiarioParaCompendio, progressoBestiario, missoesParaCompendio, historicoInvocacoes,
} from "../src/systems/CompendiumSystem.js";
import { estadoGachaInicial, invocarPermanente } from "../src/systems/GachaSystem.js";
import { CUSTO_INVOCACAO } from "../src/data/economyConfig.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const monsters = JSON.parse(fs.readFileSync(new URL("../src/data/monsters.json", import.meta.url)));
const compendium = JSON.parse(fs.readFileSync(new URL("../src/data/compendium.json", import.meta.url)));
const quests = JSON.parse(fs.readFileSync(new URL("../src/data/quests.json", import.meta.url)));
const gachaRoster = JSON.parse(fs.readFileSync(new URL("../src/data/gachaRoster.json", import.meta.url)));
const dados = { monsters, compendium, quests, gachaRoster };

function personagem() {
  return { missoesAtivas: [], missoesConcluidas: [], gacha: estadoGachaInicial() };
}

// --- estrutura: compendium.json cobre todos os monstros de monsters.json ---
{
  const idsMonstros = new Set(monsters.map((m) => m.id));
  const idsCompendio = new Set(compendium.map((c) => c.id));
  check("compendium.json tem exatamente as mesmas entradas de monsters.json", monsters.every((m) => idsCompendio.has(m.id)) && compendium.every((c) => idsMonstros.has(c.id)));
  check("toda entrada do compêndio tem teaser e lore não vazios", compendium.every((c) => c.teaser && c.teaser.length > 5 && c.lore && c.lore.length > 20));
}

// --- garantirCompendio / registrarAbateCompendio / totalAbates ---
{
  const p = personagem();
  check("compêndio inicial sem abates", totalAbates(p, "slime") === 0);
  check("garantirCompendio cria estrutura", !!garantirCompendio(p).abates);
  registrarAbateCompendio(p, "slime");
  registrarAbateCompendio(p, "slime");
  registrarAbateCompendio(p, "lobo");
  check("contagem de abates soma corretamente por monstro", totalAbates(p, "slime") === 2 && totalAbates(p, "lobo") === 1);
  check("monstro nunca abatido continua em 0", totalAbates(p, "dragao_jovem") === 0);
  check("jaEncontrado reflete abates > 0", jaEncontrado(p, "slime") === true && jaEncontrado(p, "dragao_jovem") === false);
}

// --- bestiarioParaCompendio: mistura stats + lore + progresso corretamente ---
{
  const p = personagem();
  registrarAbateCompendio(p, "slime");
  const bestiario = bestiarioParaCompendio(p, dados);
  check("bestiário tem uma entrada por monstro", bestiario.length === monsters.length);
  const slime = bestiario.find((b) => b.id === "slime");
  const dragao = bestiario.find((b) => b.id === "dragao_jovem");
  check("monstro abatido aparece como descoberto com lore completo", slime.descoberto === true && typeof slime.lore === "string" && slime.lore.length > 20);
  check("monstro nunca visto aparece bloqueado mas com teaser presente", dragao.descoberto === false && dragao.lore === null && typeof dragao.teaser === "string");
}

// --- progressoBestiario: contagem geral ---
{
  const p = personagem();
  check("progresso inicial é 0%", progressoBestiario(p, dados).descobertos === 0);
  registrarAbateCompendio(p, "slime");
  registrarAbateCompendio(p, "lobo");
  const prog = progressoBestiario(p, dados);
  check("progresso soma monstros únicos descobertos, não abates totais", prog.descobertos === 2);
  check("percentual calculado sobre o total de monstros", prog.percentual === Math.round((2 / monsters.length) * 100));
}

// --- missoesParaCompendio: deriva de missoesConcluidas/missoesAtivas sem estado próprio ---
{
  const p = personagem();
  p.missoesConcluidas.push(quests[0].id);
  p.missoesAtivas.push({ id: quests[1].id, progresso: 0 });
  const lista = missoesParaCompendio(p, dados);
  check("lista de missões cobre todas as quests do jogo", lista.length === quests.length);
  check("missão concluída é marcada corretamente", lista.find((q) => q.id === quests[0].id).concluida === true);
  check("missão ativa (não concluída) é marcada corretamente", lista.find((q) => q.id === quests[1].id).ativa === true && lista.find((q) => q.id === quests[1].id).concluida === false);
  check("missão nunca tocada não é concluída nem ativa", lista.find((q) => !p.missoesConcluidas.includes(q.id) && !p.missoesAtivas.some((m) => m.id === q.id)).concluida === false);
}

// --- historicoInvocacoes: GachaSystem grava, CompendiumSystem só lê (mais recente primeiro) ---
{
  const p = personagem();
  check("histórico vazio no início", historicoInvocacoes(p).length === 0);
  p.gacha.fragmentos = CUSTO_INVOCACAO * 5;
  for (let i = 0; i < 3; i++) invocarPermanente(p, gachaRoster);
  const hist = historicoInvocacoes(p);
  check("histórico registra uma entrada por invocação", hist.length === 3);
  check("histórico vem em ordem do mais recente pro mais antigo", hist[0].data >= hist[1].data && hist[1].data >= hist[2].data);
  check("cada entrada tem banner/raridade/nome preenchidos", hist.every((h) => h.banner === "permanente" && h.raridade && h.nome));
}

// --- historicoInvocacoes: teto de tamanho não deixa o array crescer sem limite ---
{
  const p = personagem();
  p.gacha.fragmentos = CUSTO_INVOCACAO * 150;
  for (let i = 0; i < 120; i++) invocarPermanente(p, gachaRoster);
  check("histórico é cortado no teto de 100 entradas", p.gacha.historicoInvocacoes.length === 100);
}

// --- estado sobrevive a JSON.stringify/parse (compatibilidade com o save) ---
{
  const p = personagem();
  registrarAbateCompendio(p, "slime");
  p.gacha.fragmentos = CUSTO_INVOCACAO;
  invocarPermanente(p, gachaRoster);
  const clonado = JSON.parse(JSON.stringify(p));
  check("abates sobrevivem à serialização", totalAbates(clonado, "slime") === 1);
  check("histórico de invocações sobrevive à serialização", historicoInvocacoes(clonado).length === 1);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
