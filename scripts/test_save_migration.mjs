// Testes do pipeline versionado de save (task #97): SAVE_VERSION +
// migrarSave(). Usa um polyfill mínimo de localStorage (Node não tem um) só
// pra exercitar salvarJogo()/carregarJogo() de ponta a ponta; o resto testa
// migrarSave() diretamente, sem precisar do navegador.
globalThis.localStorage = (() => {
  let dados = {};
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    clear: () => { dados = {}; },
  };
})();

const { migrarSave, SAVE_VERSION, salvarJogo, carregarJogo, existeSave, apagarSave } = await import("../src/systems/SaveSystem.js");
import { arvoreDoPersonagem } from "../src/systems/TalentSystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

// Save no formato mais antigo que existe (pré-gacha, pré-Caminhos do
// Herdeiro, pré-viagem-rápida/NG+/Modo História, masmorra ainda como um
// único mapa) — exatamente o tipo de save real que um jogador antigo teria
// no localStorage, sem NENHUM dos campos adicionados desde então.
function saveAntigoV0() {
  return {
    personagem: {
      nome: "Herói Antigo", classeId: "guerreiro", nivel: 12,
      atributos: { FOR: 14, DES: 10, CON: 12, INT: 8 },
      hp: 80, hpMax: 80, mp: 30, mpMax: 30,
      equipamento: { arma: { elemento: "fisico", dano: 10, atributo: "FOR", bonusCritico: 0 } },
      habilidades: [{ id: "golpe_velho", nome: "Golpe", tipo: "dano_fisico", multiplicador: 1.2, custoMP: 0, cooldown: 0 }],
      inventario: [{ uid: "item1", nome: "Poção" }],
      ouro: 500, xp: 100, xpProximo: 500,
      tracoId: "corajoso", racaId: "humano",
      // sem .gacha, .arvore, .biomaVisitados, .ngPlus, .modoHistoria,
      // .caminhoHerdeiro, .autoBatalhaConfig — igual um save de verdade de
      // antes de qualquer uma dessas tasks existir.
    },
    mundo: {
      mapaAtual: "masmorra", // formato antigo: uma masmorra só, sem dungeon1/dungeon2
      player: { x: 10, y: 12, dir: "baixo", frame: 0 },
      chests: [{ id: "c1", aberto: false }],
      nodes: [{ id: "n1", coletado: false }],
      zonaAtualId: "floresta",
    },
    // sem .saveVersion — o marcador de "isto é um save v0"
  };
}

// --- migrarSave: não perde nenhum dado que já existia --------------------
{
  const salvo = saveAntigoV0();
  const antes = JSON.parse(JSON.stringify(salvo)); // snapshot antes da migração
  const migrado = migrarSave(salvo);

  check("migrarSave marca a versão atual", migrado.saveVersion === SAVE_VERSION);
  check("nome do personagem preservado", migrado.personagem.nome === antes.personagem.nome);
  check("nível preservado", migrado.personagem.nivel === antes.personagem.nivel);
  check("atributos preservados", JSON.stringify(migrado.personagem.atributos) === JSON.stringify(antes.personagem.atributos));
  check("hp/mp preservados", migrado.personagem.hp === antes.personagem.hp && migrado.personagem.mp === antes.personagem.mp);
  check("habilidade antiga preservada (não sumiu nem duplicou)", migrado.personagem.habilidades.length === 1 && migrado.personagem.habilidades[0].id === "golpe_velho");
  check("inventário preservado", migrado.personagem.inventario.length === 1 && migrado.personagem.inventario[0].uid === "item1");
  check("ouro/xp preservados", migrado.personagem.ouro === 500 && migrado.personagem.xp === 100);
  check("posição no mundo preservada", migrado.mundo.player.x === 10 && migrado.mundo.player.y === 12);
  check("baús e nós preservados", migrado.mundo.chests.length === 1 && migrado.mundo.nodes.length === 1);
}

// --- migrarSave: preenche os campos que faltavam --------------------------
{
  const migrado = migrarSave(saveAntigoV0());
  const p = migrado.personagem;
  check("ganha .gacha", !!p.gacha && Array.isArray(p.gacha.personagensObtidos));
  check("ganha .arvore (árvore de habilidades antiga)", !!p.arvore && Array.isArray(p.arvore.escolhas));
  check("ganha .biomaVisitados", Array.isArray(p.biomaVisitados));
  check("ganha .ngPlus = 0", p.ngPlus === 0);
  check("ganha .modoHistoria = false", p.modoHistoria === false);
  check("ganha .caminhoHerdeiro (Caminhos do Herdeiro) zerado, sem inventar pontos", !!p.caminhoHerdeiro && p.caminhoHerdeiro.pontosClasse === 0 && p.caminhoHerdeiro.pontosSubclasse === 0 && p.caminhoHerdeiro.pontosHeranca === 0);
  check("caminhoHerdeiro vem com os 3 presets vazios (nenhum talento inventado)", p.caminhoHerdeiro.presets.length === 3 && p.caminhoHerdeiro.presets.every((pr) => pr.talentosEscolhidos.length === 0));
  check("caminhoHerdeiro vem sem subclasse escolhida (decisão do jogador, não pode ser assumida)", p.caminhoHerdeiro.subclasseId === null);
  check("ganha .autoBatalhaConfig (task #96) com os padrões corretos", !!p.autoBatalhaConfig && p.autoBatalhaConfig.modo === "equilibrado");
  check("mundo.mapaAtual 'masmorra' (formato antigo) vira 'dungeon1'", migrado.mundo.mapaAtual === "dungeon1");
  check("com caminhoHerdeiro migrado, a árvore real do Guerreiro já é enxergada corretamente (sem crash)", arvoreDoPersonagem(p, { talentsGuerreiro: { talentos: [{ id: "x" }] } }).length === 1);
}

// --- migrarSave: convocados do gacha também recebem caminhoHerdeiro -------
{
  const salvo = saveAntigoV0();
  salvo.personagem.gacha = {
    fragmentos: 10,
    personagensObtidos: [
      { uid: "conv1", nome: "Convocado 1", classeId: "mago", nivel: 8, habilidades: [] },
      { uid: "conv2", nome: "Convocado 2", classeId: "guerreiro", nivel: 5, habilidades: [], caminhoHerdeiro: { pontosClasse: 3, pontosSubclasse: 0, pontosHeranca: 0, heranca: [], marcosSubclasseConcedidos: [], presets: [{ nome: "Build 1", talentosEscolhidos: ["ja_tinha"] }, { nome: "Build 2", talentosEscolhidos: [] }, { nome: "Build 3", talentosEscolhidos: [] }], presetAtivo: 0, subclasseId: null } },
    ],
    timeAtivo: [],
  };
  const migrado = migrarSave(salvo);
  const [conv1, conv2] = migrado.personagem.gacha.personagensObtidos;
  check("convocado SEM caminhoHerdeiro ganha um novo, zerado", !!conv1.caminhoHerdeiro && conv1.caminhoHerdeiro.pontosClasse === 0);
  check("convocado que JÁ TINHA caminhoHerdeiro (progresso real) não é resetado nem perde o talento escolhido", conv2.caminhoHerdeiro.pontosClasse === 3 && conv2.caminhoHerdeiro.presets[0].talentosEscolhidos.includes("ja_tinha"));
}

// --- migrarSave é idempotente: rodar 2x não muda nada da 2ª vez em diante -
{
  const salvo = saveAntigoV0();
  const primeiraVez = migrarSave(salvo);
  const snapshot1 = JSON.stringify(primeiraVez);
  const segundaVez = migrarSave(primeiraVez);
  const snapshot2 = JSON.stringify(segundaVez);
  check("migrar um save já migrado não altera nada (idempotente)", snapshot1 === snapshot2);
}

// --- migrarSave não quebra com entrada inválida ----------------------------
{
  check("migrarSave(null) não lança exceção", migrarSave(null) === null);
  check("migrarSave(save sem personagem) não lança exceção", migrarSave({ mundo: {} }) !== undefined);
}

// --- fluxo real salvarJogo -> carregarJogo (com localStorage polyfill) ----
{
  apagarSave();
  check("sem save nenhum, existeSave() é falso", !existeSave());
  const salvo = saveAntigoV0();
  delete salvo.saveVersion; // reforça que é um save "cru", como viria de um jogador antigo de verdade
  const ok = salvarJogo(salvo);
  check("salvarJogo grava com sucesso", ok === true);
  check("depois de salvar, existeSave() é verdadeiro", existeSave());

  const carregado = carregarJogo();
  check("carregarJogo já devolve o save MIGRADO (não precisa chamar migrarSave manualmente de novo)", carregado.saveVersion === SAVE_VERSION && !!carregado.personagem.caminhoHerdeiro && !!carregado.personagem.gacha);
  check("dados originais preservados no fluxo real salvar->carregar", carregado.personagem.nome === "Herói Antigo" && carregado.personagem.ouro === 500);
  apagarSave();
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_save_migration ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
