// Regressão para o New Game+ (melhoria de jogabilidade pós-backlog
// original, ver NewGamePlusSystem.js + CombatSystem.js: NG_PLUS_ESCALA_POR_
// NIVEL/criarCombatenteInimigo/Batalha.ngPlus). Cobre elegibilidade,
// preservação do roster de gacha, e a escala de monstros/recompensa —
// incluindo o cuidado de NÃO escalar em dobro uma invocação (que já nasce
// derivada de um atacante já escalado).
import { elegivelParaNgPlus, aplicarNewGamePlus } from "../src/systems/NewGamePlusSystem.js";
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo, NG_PLUS_ESCALA_POR_NIVEL } from "../src/systems/CombatSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function monstroBase(overrides = {}) {
  return { id: "goblin", nome: "Goblin", hp: 100, atk: 20, defesa: 10, vel: 5, elemento: "fisico", xp: 10, ouroMin: 4, ouroMax: 8, arquetipo: "agressor", ...overrides };
}

// --- elegivelParaNgPlus: precisa de save com a conquista do chefe final ---
{
  check("save nulo não é elegível", !elegivelParaNgPlus(null));
  check("save sem personagem não é elegível", !elegivelParaNgPlus({}));
  check("save com personagem mas sem gacha não é elegível", !elegivelParaNgPlus({ personagem: {} }));
  check("save com gacha mas sem a conquista do chefe final não é elegível", !elegivelParaNgPlus({ personagem: { gacha: { conquistas: ["primeira_vitoria"] } } }));
  check("save com a conquista do chefe final é elegível", elegivelParaNgPlus({ personagem: { gacha: { conquistas: ["primeira_vitoria", "dragao_derrotado"] } } }));
}

// --- aplicarNewGamePlus: preserva o gacha por referência e incrementa ngPlus ---
{
  const gachaAntigo = { fragmentos: 250, personagensObtidos: ["a", "b"], conquistas: ["dragao_derrotado"] };
  const personagemAntigo = { gacha: gachaAntigo, ngPlus: 0 };
  const personagemNovo = { nome: "Herói II", nivel: 1, ngPlus: 0 };
  const resultado = aplicarNewGamePlus(personagemNovo, personagemAntigo);
  check("gacha do save antigo é preservado no personagem novo", resultado.gacha === gachaAntigo);
  check("ngPlus sobe de 0 pra 1 na primeira run de NG+", resultado.ngPlus === 1);
  check("retorna o mesmo objeto recebido (personagemNovo), mutado", resultado === personagemNovo);
}

// --- aplicarNewGamePlus: encadeado (NG+1 -> NG+2) incrementa de novo ---
{
  const personagemNgUm = { gacha: { fragmentos: 10, conquistas: ["dragao_derrotado"] }, ngPlus: 1 };
  const personagemNgDois = aplicarNewGamePlus({ ngPlus: 0 }, personagemNgUm);
  check("NG+1 -> NG+2 incrementa corretamente", personagemNgDois.ngPlus === 2);
}

// --- criarCombatenteInimigo: ngPlus 0 (padrão) não altera nada (compatibilidade total) ---
{
  const m = monstroBase();
  const semNg = criarCombatenteInimigo(m, 0);
  check("sem ngPlus, hp bate exatamente com monsters.json", semNg.hp === m.hp);
  check("sem ngPlus, ataque bate exatamente com monsters.json", semNg.ataque.dano === m.atk);
  check("sem ngPlus, defesa bate exatamente com monsters.json", semNg.defesa === m.defesa);
  check("sem ngPlus, xp/ouro batem exatamente com monsters.json", semNg.xp === m.xp && semNg.ouroMin === m.ouroMin && semNg.ouroMax === m.ouroMax);
}

// --- criarCombatenteInimigo: ngPlus > 0 escala hp/ataque/defesa/recompensa pra cima ---
{
  const m = monstroBase();
  const comNg = criarCombatenteInimigo(m, 0, 1);
  const multEsperado = 1 + NG_PLUS_ESCALA_POR_NIVEL * 1;
  check("NG+1 aumenta o hp", comNg.hp > m.hp);
  check("NG+1 aumenta o ataque", comNg.ataque.dano > m.atk);
  check("NG+1 aumenta a defesa", comNg.defesa > m.defesa);
  check("NG+1 aumenta xp/ouro (recompensa acompanha a dificuldade)", comNg.xp > m.xp && comNg.ouroMin > m.ouroMin && comNg.ouroMax > m.ouroMax);
  check("hp escalado bate com o multiplicador esperado", comNg.hp === Math.round(m.hp * multEsperado));
  check("velocidade NÃO escala com NG+ (só dificuldade de dano/hp, não iniciativa)", comNg.velocidade === m.vel);
}

// --- NG+ mais alto escala mais que NG+ baixo (progressão) ---
{
  const m = monstroBase();
  const ngUm = criarCombatenteInimigo(m, 0, 1);
  const ngTres = criarCombatenteInimigo(m, 0, 3);
  check("NG+3 escala mais que NG+1", ngTres.hp > ngUm.hp && ngTres.ataque.dano > ngUm.ataque.dano);
}

// --- ngPlus negativo/indefinido não quebra nem reduz abaixo do original ---
{
  const m = monstroBase();
  const semArgumento = criarCombatenteInimigo(m, 0, undefined);
  const negativo = criarCombatenteInimigo(m, 0, -5);
  check("ngPlus undefined se comporta como 0", semArgumento.hp === m.hp);
  check("ngPlus negativo nunca reduz abaixo do stat original (piso em 0)", negativo.hp === m.hp);
}

// --- Batalha.ngPlus escala a nova leva de horda, mas NÃO escala em dobro uma invocação ---
{
  function fakePersonagemJogador() {
    return {
      nome: "Herói", hp: 200, hpMax: 200, mp: 10, mpMax: 10,
      atributos: { FOR: 10, DES: 8, CON: 10, INT: 5 },
      equipamento: { arma: null }, habilidades: [], tracoId: null, racaId: "humano",
      spriteKey: "pc_humano_guerreiro", classeId: "guerreiro",
    };
  }
  const jogador = criarCombatenteJogador(fakePersonagemJogador(), {}, "frente");
  const primeiraOnda = [criarCombatenteInimigo(monstroBase(), 0, 2)]; // já escalado por quem monta a batalha (BattleUI.js)
  const segundaOndaDefs = [monstroBase({ id: "goblin2" })]; // cru, como vem de EncounterSystem.js
  const batalha = new Batalha([jogador], primeiraOnda, null, null, [segundaOndaDefs], 2);
  check("Batalha guarda o ngPlus recebido", batalha.ngPlus === 2);

  // Avança pra 2ª leva "matando" o único inimigo da primeira.
  primeiraOnda[0].vivo = false;
  primeiraOnda[0].hp = 0;
  batalha.verificarFim();
  const novoInimigo = batalha.inimigos[0];
  const multEsperado = 1 + NG_PLUS_ESCALA_POR_NIVEL * 2;
  check("nova leva de horda também escala pelo ngPlus da batalha", novoInimigo.hp === Math.round(monstroBase({ id: "goblin2" }).hp * multEsperado));

  // Invocação: nasce de um atacante JÁ escalado (novoInimigo, NG+2) — não
  // deve escalar de novo por cima (senão viraria NG+4 de fato).
  const hpMaxAtacante = novoInimigo.hpMax;
  batalha.invocar(novoInimigo);
  const invocado = batalha.inimigos[batalha.inimigos.length - 1];
  const hpEsperadoInvocacao = Math.max(6, Math.round(hpMaxAtacante * 0.4));
  check("invocação não escala em dobro (usa só o stat já escalado do invocador, sem multiplicar de novo)", invocado.hpMax === hpEsperadoInvocacao);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
