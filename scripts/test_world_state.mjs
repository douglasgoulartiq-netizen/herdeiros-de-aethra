// Smoke test para task #35: mundo reativo (reputação + flags persistentes).
import {
  garantirEstadoDoMundo, getReputacao, alterarReputacao, tierDaReputacao,
  definirFlag, temFlag, multiplicadorPrecoLoja,
  registrarDecisao, decisoesRegistradas, reputacoesParaExibir,
} from "../src/systems/WorldStateSystem.js";
import { comprarItem } from "../src/systems/InventorySystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const worldState = JSON.parse(fs.readFileSync(new URL("../src/data/worldStateVariables.json", import.meta.url)));

function personagem() {
  return { ouro: 1000, inventario: [] };
}

// --- estado inicial ---
{
  const p = personagem();
  check("reputação inicial = 0", getReputacao(p, "vila") === 0);
  check("garantirEstadoDoMundo cria estrutura", !!garantirEstadoDoMundo(p).reputacao);
}

// --- alterar reputação soma e respeita limites min/max ---
{
  const p = personagem();
  alterarReputacao(p, "vila", 30, worldState);
  check("reputação sobe pra 30", getReputacao(p, "vila") === 30);
  alterarReputacao(p, "vila", 1000, worldState);
  check("reputação nunca passa do max (100)", getReputacao(p, "vila") === 100);
  alterarReputacao(p, "vila", -5000, worldState);
  check("reputação nunca passa do min (-100)", getReputacao(p, "vila") === -100);
}

// --- tierDaReputacao encontra o tier correto pra cada faixa ---
{
  check("rep 80 = heroi", tierDaReputacao(80, worldState).id === "heroi");
  check("rep 25 = respeitado", tierDaReputacao(25, worldState).id === "respeitado");
  check("rep 0 = neutro", tierDaReputacao(0, worldState).id === "neutro");
  check("rep -30 = malvisto", tierDaReputacao(-30, worldState).id === "malvisto");
  check("rep -80 = hostil", tierDaReputacao(-80, worldState).id === "hostil");
}

// --- multiplicadorPrecoLoja reflete o tier (desconto pra herói, sobretaxa pra hostil) ---
{
  const heroi = personagem();
  alterarReputacao(heroi, "vila", 80, worldState);
  const multHeroi = multiplicadorPrecoLoja(heroi, worldState);
  check("herói paga menos que o preço normal", multHeroi < 1);

  const hostil = personagem();
  alterarReputacao(hostil, "vila", -80, worldState);
  const multHostil = multiplicadorPrecoLoja(hostil, worldState);
  check("hostil paga mais que o preço normal", multHostil > 1);

  const neutro = personagem();
  check("neutro paga preço normal (multiplicador 1)", multiplicadorPrecoLoja(neutro, worldState) === 1);
}

// --- comprarItem aplica o multiplicador de preço corretamente ---
{
  const p = personagem();
  const item = { id: "x", nome: "Item Teste", valor: 100 };
  const r = comprarItem(p, item, 0.85); // desconto de herói (15%)
  check("preço com desconto aplicado corretamente", r.preco === 85);
  check("ouro deduzido pelo preço com desconto, não o valor base", p.ouro === 1000 - 85);
}
{
  const p = personagem();
  const item = { id: "y", nome: "Item Teste 2", valor: 100 };
  const r = comprarItem(p, item, 1.15); // sobretaxa de hostil (15%)
  check("preço com sobretaxa aplicado corretamente", r.preco === 115);
}

// --- flags persistentes ---
{
  const p = personagem();
  check("flag não existe inicialmente", !temFlag(p, "ajudou_fazendeiro"));
  definirFlag(p, "ajudou_fazendeiro", true);
  check("flag definida corretamente", temFlag(p, "ajudou_fazendeiro"));
}

// --- estado sobrevive a JSON.stringify/parse (compatibilidade com o save) ---
{
  const p = personagem();
  alterarReputacao(p, "vila", 42, worldState);
  definirFlag(p, "teste_persistencia", true);
  const clonado = JSON.parse(JSON.stringify(p));
  check("reputação sobrevive a serialização", getReputacao(clonado, "vila") === 42);
  check("flag sobrevive a serialização", temFlag(clonado, "teste_persistencia"));
}

// --- Diário de decisões (melhoria pós-backlog): registrarDecisao/decisoesRegistradas ---
{
  const p = personagem();
  check("nenhuma decisão registrada inicialmente", decisoesRegistradas(p).length === 0);
  registrarDecisao(p, { icone: "🧳", titulo: "Viajante Perdido", texto: "Você ajudou." });
  registrarDecisao(p, { icone: "🏛️", titulo: "Ruína Esquecida", texto: "Você encontrou moedas." });
  check("duas decisões registradas", decisoesRegistradas(p).length === 2);
  check("decisoesRegistradas devolve a mais recente primeiro", decisoesRegistradas(p)[0].titulo === "Ruína Esquecida");
  check("cada decisão guarda icone/titulo/texto", decisoesRegistradas(p)[1].icone === "🧳" && decisoesRegistradas(p)[1].texto === "Você ajudou.");
  check("momento é monotônico crescente na ordem de registro", decisoesRegistradas(p)[1].momento < decisoesRegistradas(p)[0].momento);
}

// --- registrarDecisao nunca deixa o registro crescer sem limite (FIFO) ---
{
  const p = personagem();
  for (let i = 0; i < 55; i++) registrarDecisao(p, { titulo: `Decisão ${i}`, texto: "x" });
  const registradas = decisoesRegistradas(p);
  check("registro nunca passa de 40 entradas", registradas.length === 40);
  check("as mais ANTIGAS são descartadas primeiro (FIFO)", registradas[registradas.length - 1].titulo === "Decisão 15");
  check("a mais recente continua no topo", registradas[0].titulo === "Decisão 54");
}

// --- reputacoesParaExibir: só facções realmente afetadas (valor != 0) ---
{
  const p = personagem();
  check("nenhuma reputação pra exibir logo no início", reputacoesParaExibir(p, worldState).length === 0);
  alterarReputacao(p, "vila", 15, worldState);
  const r1 = reputacoesParaExibir(p, worldState);
  check("depois de alterar, aparece exatamente 1 facção", r1.length === 1);
  check("a facção exibida é a vila, com o valor e o tier corretos", r1[0].facaoId === "vila" && r1[0].valor === 15 && r1[0].tier.id === "neutro");
  alterarReputacao(p, "guardioes_da_folha", -30, worldState);
  check("depois de afetar uma 2ª facção, aparecem as 2", reputacoesParaExibir(p, worldState).length === 2);
}

// --- estado sobrevive a JSON.stringify/parse, incluindo o diário ---
{
  const p = personagem();
  registrarDecisao(p, { icone: "⚔️", titulo: "Chefe derrotado: Dragão", texto: "Você venceu." });
  const clonado = JSON.parse(JSON.stringify(p));
  check("decisões sobrevivem à serialização", decisoesRegistradas(clonado).length === 1 && decisoesRegistradas(clonado)[0].titulo === "Chefe derrotado: Dragão");
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
