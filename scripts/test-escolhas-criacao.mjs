// Escolhas da criação de personagem com efeito de verdade (22/09).
// Cada bloco confere uma promessa escrita num card da criação contra o que o
// motor faz. Roda sem navegador: `node scripts/test-escolhas-criacao.mjs`.
import fs from "node:fs";
import { criarPersonagem, atributosEfetivos } from "../src/systems/CharacterFactory.js";
import { bonusAfinidade, infoAfinidade, descreverBonus } from "../src/systems/AffinitySystem.js";
import { Batalha, criarCombatenteJogador, criarCombatenteInimigo } from "../src/systems/CombatSystem.js";
import { mundoDaSemente, bausEscondidosDoMundo } from "../src/systems/WorldBuilder.js";
import { SOLID_TILES, TILES_AGUA } from "../src/data/worldMap.js";
import { CHANCE_ITEM_EXTRA_GANANCIOSO } from "../src/ui/BattleUI.js";
import { multiplicadorPrecoLoja } from "../src/systems/WorldStateSystem.js";
import { opcoesDaCena, aplicarEscolhaCena } from "../src/systems/CutsceneSystem.js";
import { CUTSCENES } from "../src/data/cutscenes.js";
import { RECONHECIMENTO_RACIAL, reconhecimentoRacial } from "../src/data/world/racialReactions.js";
import { reacaoARaca } from "../src/systems/NpcSystem.js";
import { NPCS_REGIONAIS } from "../src/data/world/npcs/index.js";
import { LOJA_DA_ORIGEM, DESCONTO_LOJA_ORIGEM, lojaDaOrigem, textoDescontoOrigem } from "../src/systems/IdentidadeSystem.js";
import { arvoreDoPersonagem, NIVEL_ESCOLHA_SUBCLASSE, concederPontosPorNivel, escolherTalento, escolherSubclasse, subclassesDisponiveis, bonusCaminhoHerdeiro, avaliarArvore } from "../src/systems/TalentSystem.js";

const json = (nome) => JSON.parse(fs.readFileSync(new URL(`../src/data/${nome}.json`, import.meta.url), "utf8"));
const dados = {
  races: json("races"), classes: json("classes"), backgrounds: json("backgrounds"), traits: json("traits"),
  items: json("items"), elements: json("elements"), worldStateVariables: json("worldStateVariables"),
  affinities: json("affinities"), skillTrees: json("skillTrees"),
};
let passou = 0;
const check = (nome, condicao) => { if (!condicao) throw new Error(`FALHOU: ${nome}`); passou++; console.log(`✓ ${nome}`); };

const elementosHeroi = ["fogo", "agua", "gelo", "natureza", "terra", "raio", "vento", "radiante", "sombrio", "arcano"];
const heroi = (extra = {}) => criarPersonagem({
  nome: "Teste", raca: "humano", classe: "guerreiro", antecedente: "soldado", traco: "corajoso",
  elemento: "fogo", faccao: "guardioes_da_folha", preferencias: ["combate"], motivacao: "justica", ...extra,
}, dados);

// Monta uma batalha mínima com o herói e um inimigo neutro.
function batalhaCom(personagem, monstro = {}) {
  const jogador = criarCombatenteJogador(personagem, dados);
  const def = { id: "alvo", nome: "Alvo", hp: 500, atk: 6, vel: 1, defesa: 0, elemento: "fisico", sprite: "x", ...monstro };
  const inimigo = criarCombatenteInimigo(def, 0);
  return { jogador, inimigo, batalha: new Batalha([jogador], [inimigo], dados.elements) };
}

// Math.random com uma fila de valores; depois da fila, volta ao normal.
function comRandom(fila, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => (i < fila.length ? fila[i++] : original());
  try { return fn(); } finally { Math.random = original; }
}
const faceParaRandom = (face) => (face - 1) / 20 + 0.001;

// --- Nomes: traço racial não repete personalidade -----------------------
{
  const idsPersonalidade = new Set(dados.traits.map((t) => t.id));
  const colisoes = dados.races.filter((r) => idsPersonalidade.has(r.traco)).map((r) => r.id);
  check("nenhum traço racial usa o id de uma personalidade", colisoes.length === 0);
  check("todo traço racial tem descrição", dados.races.every((r) => r.traco && r.descricaoTraco));
  check("texto do Draconato sem erro de digitação", !JSON.stringify(dados.races).includes("élemental") && !JSON.stringify(dados.affinities).includes("Élemental"));
}

// --- Anão: Pele de Pedra ---------------------------------------------------
{
  const durar = (raca) => {
    const { jogador, batalha } = batalhaCom(heroi({ raca }));
    jogador.statusEffects.push({ tipo: "condicao_veneno", duracao: 3, valor: 0.01 });
    let ticks = 0;
    while (jogador.statusEffects.some((s) => s.tipo === "condicao_veneno") && ticks < 10) {
      batalha.aplicarStatusTick(jogador);
      ticks += 1;
    }
    return ticks;
  };
  const humano = durar("humano");
  const anao = durar("anao");
  check(`anão: veneno de 3 turnos some 1 tique antes (${anao} contra ${humano})`, anao === humano - 1);
  const { jogador, batalha } = batalhaCom(heroi({ raca: "anao" }));
  jogador.statusEffects.push({ tipo: "buff_defesa", duracao: 3, valor: 0.3 });
  batalha.aplicarStatusTick(jogador);
  check("anão: buff não é encurtado", jogador.statusEffects.find((s) => s.tipo === "buff_defesa").duracao === 2);
}

// --- Halfling: Sorte Miúda ------------------------------------------------
{
  const { jogador, inimigo, batalha } = batalhaCom(heroi({ raca: "halfling", traco: "cauteloso" }));
  const r = comRandom([faceParaRandom(1), faceParaRandom(15)], () => batalha.resolverAcaoD20(jogador, inimigo));
  check("halfling: um 1 é re-rolado", r.d === 15 && jogador.sorteMiudaUsada === true);
  const r2 = comRandom([faceParaRandom(1), faceParaRandom(15)], () => batalha.resolverAcaoD20(jogador, inimigo));
  check("halfling: só uma vez por batalha", r2.d === 1);
  const { jogador: humano, inimigo: alvoH, batalha: bH } = batalhaCom(heroi({ raca: "humano", traco: "cauteloso" }));
  const r3 = comRandom([faceParaRandom(1), faceParaRandom(15)], () => bH.resolverAcaoD20(humano, alvoH));
  check("humano não re-rola o 1", r3.d === 1);
  const { jogador: hs, inimigo: alvoS, batalha: bS } = batalhaCom(heroi({ raca: "halfling", traco: "sortudo" }));
  const r4 = comRandom([faceParaRandom(1), faceParaRandom(2), faceParaRandom(18)], () => bS.resolverAcaoD20(hs, alvoS));
  check("halfling sortudo: raça re-rola o 1, personalidade re-rola o 2", r4.d === 18 && hs.sorteMiudaUsada && hs.sorteUsada);
  const semSorte = bH.chancesD20(humano, alvoH);
  const comSorte = batalha.chancesD20(batalhaCom(heroi({ raca: "halfling", traco: "cauteloso" })).jogador, inimigo);
  check(`previsão: halfling erra menos (${comSorte.erro.toFixed(4)} < ${semSorte.erro.toFixed(4)})`, comSorte.erro < semSorte.erro && comSorte.rerolagemSorteMiuda);
  check("previsão sem re-rolagem bate com o d20 puro (15% de erro, 20% de crítico natural)", Math.abs(semSorte.erro - 0.15) < 1e-9);
}

// --- Elfo: Olhos da Floresta ------------------------------------------------
{
  const semente = 20260922;
  const gerado = mundoDaSemente(semente);
  const escondidos = bausEscondidosDoMundo(gerado, semente);
  check(`elfo: o mundo tem baús escondidos (${escondidos.length})`, escondidos.length >= 3);
  const ocupado = new Set([...gerado.baus, ...gerado.nos].map((o) => `${o.x},${o.y}`));
  check("baús escondidos não caem em cima de outro objeto", escondidos.every((b) => !ocupado.has(`${b.x},${b.y}`)));
  check("baús escondidos só em zona sem baú comum", escondidos.every((b) => !gerado.baus.some((c) => c.zonaId === b.zonaId)));
  check("baús escondidos têm id próprio e marca de escondido", escondidos.every((b) => b.id.startsWith("bau_oculto_") && b.escondido));
  check("gerar de novo devolve os mesmos baús", bausEscondidosDoMundo(mundoDaSemente(semente), semente) === escondidos);
  const main = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  check("só o elfo recebe os baús escondidos", /racaId !== "elfo"\) return comuns/.test(main));

  // UMA SEMENTE SÓ NÃO PROTEGE NADA.
  //
  // A asserção de cima já falhou uma vez (2 baús em vez de 3) e passou
  // despercebida porque ninguém sabia se era a semente ou a regra. A causa
  // era estrutural: 17 dos 84 nós de recurso ficam DENTRO d'água, a busca
  // partia do nó e não encontrava vizinho aberto nenhum, e a zona perdia o
  // baú em silêncio. Com uma semente só, o mesmo defeito volta a passar
  // como "azar da semente". Com cinco, não passa.
  const porSemente = [1, 777, 4242, 20260922, 987654].map((s) => ({
    s, n: bausEscondidosDoMundo(mundoDaSemente(s), s).length,
  }));
  check(`todo mundo gerado entrega 3+ baús escondidos (${porSemente.map((p) => `${p.s}:${p.n}`).join(", ")})`,
    porSemente.every((p) => p.n >= 3));

  // O baú tem de ser ALCANÇÁVEL a pé: nunca em cima de água nem de sólido.
  // É a garantia que a correção acima entregou de fato — trocar o ponto de
  // partida por uma margem aberta não serve de nada se o resultado ainda
  // puder cair num lago.
  const molhados = [];
  for (const { s } of porSemente) {
    const g = mundoDaSemente(s);
    for (const b of bausEscondidosDoMundo(g, s)) {
      const t = g.grid[b.y][b.x];
      if (SOLID_TILES.has(t) || TILES_AGUA.has(t)) molhados.push(`${s}:${b.id}`);
    }
  }
  check(`nenhum baú escondido cai em água ou em tile sólido${molhados.length ? ` — ${molhados.join(", ")}` : ""}`,
    molhados.length === 0);
}

// --- Origem: kit inicial -------------------------------------------------------
{
  const ids = new Set(dados.items.itens.map((i) => i.id));
  const kits = dados.backgrounds.flatMap((b) => (b.itensIniciais || []).map((k) => k.id));
  check("todo item de kit de origem existe", kits.length > 0 && kits.every((id) => ids.has(id)));
  const soldado = heroi({ antecedente: "soldado" });
  check("soldado começa com 2 poções", soldado.inventario.filter((i) => i.id === "pocao_vida_p").length === 2);
  const nobre = heroi({ antecedente: "nobre" });
  const anel = nobre.equipamento.anel;
  check("nobre começa com o Anel de Sinete já no dedo, e ele dá atributo", anel && anel.id === "anel_de_sinete" && anel.bonusAtributo.INT === 1 && anel.bonusAtributo.CON === 1);
  check("origem guarda o nome legível", heroi({ antecedente: "sabio" }).antecedenteNome === "Sábio");
  const temAlgoDoKit = (p) => p.inventario.length >= 1 || !!p.equipamento.anel;
  check("toda origem começa com pelo menos um item do kit", dados.backgrounds.every((b) => temAlgoDoKit(heroi({ antecedente: b.id }))));
}

// --- Personalidade: Ganancioso ------------------------------------------------
{
  const texto = dados.traits.find((t) => t.id === "ganancioso").descricao;
  check("Ganancioso: 25% de item extra e o card diz isso", CHANCE_ITEM_EXTRA_GANANCIOSO === 0.25 && texto.includes("25%"));
  check("Ganancioso começa com 20% menos ouro", heroi({ traco: "ganancioso", antecedente: "nobre" }).ouro === 48);
}

// --- Humano: afinidade no atributo da classe -----------------------------------
{
  const esperado = { guerreiro: "FOR", mago: "INT", ladino: "DES", clerigo: "INT", barbaro: "FOR", patrulheiro: "DES" };
  for (const [classe, atributo] of Object.entries(esperado)) {
    const b = bonusAfinidade({ racaId: "humano", classeId: classe }, dados);
    const soma = b.FOR + b.DES + b.CON + b.INT;
    check(`humano ${classe}: +1 ${atributo} e só`, b[atributo] === 1 && soma === 1);
  }
  const efetivo = atributosEfetivos(heroi({ raca: "humano", classe: "guerreiro" }), dados);
  const base = dados.classes.find((c) => c.id === "guerreiro").atributosBase;
  check("humano guerreiro: FOR = base + 1 raça + 1 afinidade", efetivo.FOR === base.FOR + 2 && efetivo.INT === base.INT + 1);
  check("card da classe diz o bônus da afinidade", infoAfinidade("humano", "ladino", dados.affinities).resumo === "+1 DES");
  check("resumo legível de bônus composto", descreverBonus({ DES: 2, critChance: 0.05 }) === "+2 DES · +5% de crítico");
}

// --- Clérigo: golpes de luz usam um elemento que existe -------------------------
{
  const elementos = new Set(dados.elements.elementos.map((e) => e.id));
  const arvores = JSON.stringify(dados.skillTrees);
  const usados = [...arvores.matchAll(/"elemento": ?"([a-z_]+)"/g)].map((m) => m[1]);
  check("toda habilidade das árvores usa um elemento da tabela", usados.length > 0 && usados.every((e) => elementos.has(e)));
}

// =====================================================================
// LEVA 2 — escolhas que não faziam nada passam a valer
// =====================================================================
const monstros = json("monsters");
const ident = await import("../src/systems/IdentidadeSystem.js");
const { usarConsumivel } = await import("../src/systems/InventorySystem.js");
const { concluirMissao } = await import("../src/systems/QuestSystem.js");
const { alterarReputacao, afiliarFaccao, getReputacao } = await import("../src/systems/WorldStateSystem.js");
const { custoProximoNivel } = await import("../src/systems/EnchantSystem.js");
const { facaoDominanteDoTime } = await import("../src/systems/FactionSynergySystem.js");
const { capitulosParaCompendio } = await import("../src/systems/MythologySystem.js");

// --- Elemento: essência, sintonia, ambiente afim ---------------------------
{
  const alvoNeutro = { elemento: "fisico" };
  const semElemento = heroi({ elemento: null });
  const deFogo = heroi({ elemento: "fogo" });
  const { batalha, inimigo } = batalhaCom(deFogo);
  const jSem = criarCombatenteJogador(semElemento, dados);
  const jFogo = criarCombatenteJogador(deFogo, dados);
  const magiaSem = batalha.estimarFaixaDanoMagico(jSem, inimigo, { multiplicador: 2, elementoAtacante: "fogo" });
  const magiaFogo = batalha.estimarFaixaDanoMagico(jFogo, inimigo, { multiplicador: 2, elementoAtacante: "fogo" });
  check(`essência: magia do próprio elemento +15% (${magiaSem.esperado} → ${magiaFogo.esperado})`, magiaFogo.esperado > magiaSem.esperado);
  const m = ident.multiplicadorIdentidade(jFogo, alvoNeutro, "fogo", dados.elements);
  check("essência de ataque é ×1,15 com selo", Math.abs(m.mult - 1.15) < 1e-9 && m.selos[0][0] === "ESSÊNCIA");

  const deAgua = criarCombatenteJogador(heroi({ elemento: "agua" }), dados);
  const sint = ident.multiplicadorIdentidade(deAgua, { elemento: "fogo" }, "fisico", dados.elements, { fisico: true });
  check("sintonia: golpe físico de herói de Água contra criatura de fogo ×1,25", Math.abs(sint.mult - 1.25) < 1e-9 && sint.selos[0][0] === "SINTONIA");
  const semSint = ident.multiplicadorIdentidade(deAgua, { elemento: "natureza" }, "fisico", dados.elements, { fisico: true });
  check("sintonia nunca tira dano (água contra natureza fica ×1)", semSint.mult === 1);
  const arcano = criarCombatenteJogador(heroi({ elemento: "arcano" }), dados);
  check("arcano: sintonia +8% contra qualquer alvo", Math.abs(ident.multiplicadorIdentidade(arcano, { elemento: "terra" }, "fisico", dados.elements, { fisico: true }).mult - 1.08) < 1e-9);
  const defesa = ident.multiplicadorIdentidade({ elemento: "fogo" }, jFogo, "fogo", dados.elements);
  check("essência de defesa: golpe de fogo contra herói de fogo ×0,85", Math.abs(defesa.mult - 0.85) < 1e-9);

  const monstroFogo = { id: "m", nome: "Brasa", hp: 100, atk: 10, vel: 1, defesa: 0, elemento: "fogo", sprite: "x" };
  const jSintonia = criarCombatenteJogador(heroi({ elemento: "agua" }), dados);
  const inimigoFogo = criarCombatenteInimigo(monstroFogo, 0);
  const b2 = new Batalha([jSintonia], [inimigoFogo], dados.elements);
  const golpeCom = b2.estimarFaixaDano(jSintonia, inimigoFogo);
  const jNeutro = criarCombatenteJogador(heroi({ elemento: null }), dados);
  const golpeSem = new Batalha([jNeutro], [criarCombatenteInimigo(monstroFogo, 0)], dados.elements).estimarFaixaDano(jNeutro, criarCombatenteInimigo(monstroFogo, 0));
  check(`prévia do golpe físico já conta a sintonia (${golpeSem.esperado} → ${golpeCom.esperado})`, golpeCom.esperado > golpeSem.esperado);

  const jTerra = criarCombatenteJogador(heroi({ elemento: "terra" }), dados);
  const alvoT = criarCombatenteInimigo({ id: "t", nome: "T", hp: 100, atk: 5, vel: 1, defesa: 10, elemento: "fisico", sprite: "x" }, 0);
  const bTerreno = new Batalha([jTerra], [alvoT], dados.elements, "terra", [], 0, "terra");
  check("ambiente afim: terreno e clima do elemento somam +15% de defesa e +3 MP", jTerra.ambienteAfim && Math.abs(jTerra.ambienteAfim.defesa - 0.15) < 1e-9 && jTerra.ambienteAfim.mp === 3);
  jTerra.defesa = 20;
  check("ambiente afim entra na defesa efetiva", bTerreno.defesaEfetiva(jTerra) === 23);
  jTerra.mp = 0;
  bTerreno.aplicarStatusTick(jTerra);
  check("ambiente afim devolve MP a cada turno", jTerra.mp === 3);
  const jOutro = criarCombatenteJogador(heroi({ elemento: "gelo" }), dados);
  new Batalha([jOutro], [criarCombatenteInimigo(monstroFogo, 0)], dados.elements, "terra");
  check("sem ambiente afim em terreno de outro elemento", jOutro.ambienteAfim === null);
}

// --- Magia inicial segue o elemento -----------------------------------------
{
  const mago = heroi({ classe: "mago", elemento: "gelo" });
  const lanca = mago.habilidades.find((h) => h.id === "bola_de_fogo");
  check("mago de gelo começa com Lança de Gelo (elemento gelo)", lanca.nome === "Lança de Gelo" && lanca.elemento === "gelo");
  const clerigo = heroi({ classe: "clerigo", elemento: "sombrio" });
  check("clérigo sombrio começa com Julgamento Sombrio", clerigo.habilidades.some((h) => h.nome === "Julgamento Sombrio" && h.elemento === "sombrio"));
  const guerreiro = heroi({ classe: "guerreiro", elemento: "gelo" });
  check("guerreiro não tem magia trocada", guerreiro.habilidades.every((h) => !h.elemento));
  check("toda magia que segue o elemento tem nome para os 10 elementos", Object.values(ident.MAGIAS_QUE_SEGUEM_O_ELEMENTO).every((t) => elementosHeroi.every((e) => t[e])));
}

// --- Sopro do Draconato -----------------------------------------------------------
{
  const drac = criarCombatenteJogador(heroi({ raca: "draconato", classe: "mago", elemento: "gelo" }), dados);
  const alvoAgua = criarCombatenteInimigo({ id: "a", nome: "Onda", hp: 400, atk: 5, vel: 1, defesa: 0, elemento: "agua", sprite: "x" }, 0);
  const b = new Batalha([drac], [alvoAgua], dados.elements);
  const e = b.estimarSopro(drac, alvoAgua);
  check(`sopro de gelo contra água é vantagem intensa (${e.relacaoElemental})`, e.relacaoElemental === "vantagem_intensa" && e.elemento === "gelo");
  const r = b.usarSoproElemental(drac);
  check("o sopro de verdade sai no elemento escolhido", r.ok && r.elemento === "gelo" && alvoAgua.hp < 400);
  const semElemento = criarCombatenteJogador(heroi({ raca: "draconato", elemento: null }), dados);
  check("draconato sem elemento sopra fogo", new Batalha([semElemento], [criarCombatenteInimigo({ id: "b", nome: "B", hp: 50, atk: 1, vel: 1, defesa: 0, elemento: "fisico", sprite: "x" }, 0)], dados.elements).elementoDoSopro(semElemento) === "fogo");
  const incendiario = criarCombatenteJogador(heroi({ raca: "draconato", elemento: "fogo" }), dados);
  check("Draconato + Fogo fecha a combinação Sopro Incendiário", incendiario.soproIncendiario === true);
}

// --- Facção de origem ---------------------------------------------------------
{
  const p = heroi({ faccao: "confraria_do_farol" });
  check("começa Respeitado (+20) com a facção de origem", getReputacao(p, "confraria_do_farol") === ident.REPUTACAO_ORIGEM);
  check("emblema da facção já vem vestido (+1 INT)", p.equipamento.amuleto && p.equipamento.amuleto.id === "emblema_confraria_do_farol" && p.equipamento.amuleto.bonusAtributo.INT === 1);
  check("todas as 10 facções têm emblema no items.json", Object.keys(ident.ATRIBUTO_DO_EMBLEMA).every((f) => dados.items.itens.some((i) => i.id === `emblema_${f}`)));
  const elfo = heroi({ raca: "elfo", faccao: "guardioes_da_folha" });
  check("Filho da Floresta: elfo dos Guardiões começa com 30", getReputacao(elfo, "guardioes_da_folha") === 30);
  const soldado = heroi({ antecedente: "soldado", faccao: "coroa_de_aethra" });
  check("Patente da Coroa: +10 extra com a Coroa e com a Vila", getReputacao(soldado, "coroa_de_aethra") === 30 && getReputacao(soldado, "vila") === 10);
  const custo = afiliarFaccao(p, "caravana_de_karn", dados.worldStateVariables);
  check("trocar de afiliação custa 10 com a facção anterior", custo === 10 && getReputacao(p, "confraria_do_farol") === 10 && p.estadoDoMundo.facaoAfiliada === "caravana_de_karn");
  check("a origem não muda com a afiliação", p.faccaoOrigemId === "confraria_do_farol");
  check("afiliar-se à facção atual não custa nada", afiliarFaccao(p, "caravana_de_karn", dados.worldStateVariables) === 0);
  const convocado = (f) => ({ facaoId: f });
  check("o herói conta para a sinergia de 3 da mesma facção", facaoDominanteDoTime([p, convocado("caravana_de_karn"), convocado("caravana_de_karn")]).count === 3);
}

// --- Motivações ------------------------------------------------------------------
{
  const chefe = { chefe: true, elemento: "fisico" };
  const justo = criarCombatenteJogador(heroi({ motivacao: "justica", elemento: null }), dados);
  check("Justiça: +10% contra chefe", Math.abs(ident.multiplicadorIdentidade(justo, chefe, "fisico", dados.elements).mult - 1.10) < 1e-9);
  check("Justiça não vale contra monstro comum", ident.multiplicadorIdentidade(justo, { elemento: "fisico" }, "fisico", dados.elements).mult === 1);
  const livre = criarCombatenteJogador(heroi({ motivacao: "liberdade" }), dados);
  check("Liberdade: +15% de chance de fuga", ident.bonusChanceFuga(livre) === 0.15 && ident.bonusChanceFuga(justo) === 0);
  const redimido = heroi({ motivacao: "redencao", antecedente: "soldado" });
  redimido.hp = 1;
  usarConsumivel(redimido, redimido.inventario.find((i) => i.id === "pocao_vida_p").uid, redimido);
  check("Redenção: poção de 15 cura 17", redimido.hp === 1 + Math.round(15 * 1.15));
  const poderoso = heroi({ motivacao: "poder" });
  check("Poder: 15% do XP dos inimigos acima do nível", ident.xpExtraPoder(poderoso, [{ nivelMonstro: 5, xp: 100 }, { nivelMonstro: 1, xp: 100 }]) === 15);
  const legado = heroi({ motivacao: "legado" });
  legado.missoesAtivas = [{ id: "q" }];
  const ouroAntes = legado.ouro;
  const r = concluirMissao(legado, { id: "q", tipo: "matar", recompensaOuro: 100, recompensaXP: 50 }, dados.items.itens);
  check("Legado: missão de 100 ouro paga 115", r.ouro === 115 && legado.ouro === ouroAntes + 115 && r.xp === 50);
  const descobridor = heroi({ motivacao: "descoberta" });
  check("Descoberta: lugar novo rende XP e 3 Fragmentos", ident.recompensaDescoberta(descobridor).fragmentos === 3 && ident.recompensaDescoberta(heroi({ motivacao: "poder" })) === null);
  check("toda motivação tem efeito escrito", ["descoberta", "justica", "legado", "liberdade", "redencao", "poder"].every((id) => ident.MOTIVACOES[id] && ident.MOTIVACOES[id].efeito));
}

// --- Interesses ----------------------------------------------------------------------
{
  const mago = heroi({ classe: "mago", elemento: "fogo", preferencias: ["magia"] });
  const combatente = criarCombatenteJogador(mago, dados);
  check("Magia: Bola de Fogo custa 9 MP em vez de 10", combatente.habilidades.find((h) => h.id === "bola_de_fogo").custoMP === 9);
  check("sem Magia, custo cheio", criarCombatenteJogador(heroi({ classe: "mago", preferencias: ["combate"] }), dados).habilidades.find((h) => h.id === "bola_de_fogo").custoMP === 10);
  const historiador = heroi({ preferencias: ["historias"] });
  historiador.missoesAtivas = [{ id: "q" }];
  check("Histórias: +10% de XP de missão", concluirMissao(historiador, { id: "q", tipo: "matar", recompensaOuro: 10, recompensaXP: 50 }, dados.items.itens).xp === 55);
  const diplomata = heroi({ preferencias: ["diplomacia"], faccao: null });
  alterarReputacao(diplomata, "vila", 3, dados.worldStateVariables);
  check("Diplomacia: +3 vira +4 (10% arredondado para cima)", getReputacao(diplomata, "vila") === 4);
  alterarReputacao(diplomata, "vila", -2, dados.worldStateVariables);
  check("Diplomacia não mexe em perda", getReputacao(diplomata, "vila") === 2);
  const arteso = heroi({ preferencias: ["artesanato"] });
  const espada = { tipo: "arma", aprimoramento: 5 };
  const custoCheio = custoProximoNivel(espada).ouro;
  check(`Artesanato: forja 10% mais barata (${custoCheio} → ${custoProximoNivel(espada, arteso).ouro})`, custoProximoNivel(espada, arteso).ouro === Math.floor(custoCheio * 0.9));
  check("Artesanato vale até no nível mais barato (5 → 4)", custoProximoNivel({ tipo: "arma", aprimoramento: 0 }, arteso).ouro === 4);
  const anaoForja = heroi({ raca: "anao", faccao: "forja_dos_anoes_cinzentos", preferencias: ["artesanato"] });
  check("Sangue da Forja soma com Artesanato", Math.abs(ident.multCustoForja(anaoForja) - 0.9 * 0.85) < 1e-9);
  check("Tesouros: +10% de ouro em baú", ident.multOuroBau(heroi({ preferencias: ["tesouros"] })) === 1.10);
  check("Natureza: 10% de colheita extra", ident.chanceColheitaExtra(heroi({ preferencias: ["natureza"] })) === 0.10);
  check("Exploração: +10% de Fragmentos", ident.multFragmentosExploracao(heroi({ preferencias: ["exploracao"] })) === 1.10);
  check("Combate: +10% de XP de batalha", ident.multXpBatalha(heroi({ preferencias: ["combate"] })) === 1.10);
  check("interesses empurram o automático para o alvo deles", ident.bonusPrioridadeAuto(heroi({ preferencias: ["tesouros", "natureza"] }), "bau") === 12 && ident.bonusPrioridadeAuto(heroi({ preferencias: ["tesouros"] }), "no") === 0);
  check("todo interesse tem efeito escrito", ["exploracao", "combate", "magia", "natureza", "tesouros", "historias", "artesanato", "diplomacia"].every((id) => ident.INTERESSES[id] && ident.INTERESSES[id].efeito));
}

// --- Combinações ------------------------------------------------------------------
{
  check("combinações reconhecem escolhas da tela e personagem salvo", ident.combinacoesDe({ raca: "orc", faccao: "legiao_das_cinzas" }).some((c) => c.id === "brasa_da_legiao")
    && ident.combinacoesDe(heroi({ raca: "orc", faccao: "legiao_das_cinzas" })).some((c) => c.id === "brasa_da_legiao"));
  const orc = criarCombatenteJogador(heroi({ raca: "orc", faccao: "legiao_das_cinzas" }), dados);
  check("Brasa da Legião: fúria a partir de 40% de HP", orc.limiarFuria === 0.4);
  const sabio = heroi({ antecedente: "sabio", faccao: "ordem_dos_arquivistas" });
  const comum = heroi({ antecedente: "soldado", faccao: "ordem_dos_arquivistas" });
  const abertos = (p) => capitulosParaCompendio(p).filter((c) => c.desbloqueado).length;
  check(`Leitor do Arquivo: Códice abre mais cedo (${abertos(comum)} → ${abertos(sabio)})`, abertos(sabio) > abertos(comum));
}

// --- Save antigo recebe o pacote uma vez ------------------------------------------------
{
  const antigo = heroi({ classe: "mago", elemento: "raio", faccao: "legiao_das_cinzas" });
  // simula um herói de antes: sem marca, sem reputação, sem emblema, magia antiga
  delete antigo.identidadeV2;
  antigo.estadoDoMundo.reputacao = { legiao_das_cinzas: 5 };
  antigo.equipamento.amuleto = null;
  antigo.habilidades = antigo.habilidades.map((h) => (h.id === "bola_de_fogo" ? { ...h, nome: "Bola de Fogo", elemento: "fogo" } : h));
  const ganhos = ident.aplicarIdentidadeRetroativa(antigo, dados);
  check("save antigo: ganha magia, reputação e emblema", ganhos.length === 3 && antigo.habilidades.some((h) => h.nome === "Relâmpago") && getReputacao(antigo, "legiao_das_cinzas") === 25 && antigo.equipamento.amuleto.id === "emblema_legiao_das_cinzas");
  check("save antigo: só uma vez", ident.aplicarIdentidadeRetroativa(antigo, dados).length === 0 && getReputacao(antigo, "legiao_das_cinzas") === 25);
}

// =====================================================================
// LEVA 3 — conteúdo ligado às escolhas
// =====================================================================
const skillChecks = json("skillChecks");
const eventos = json("explorationEvents");
const heranca = json("heritageTree");
const destino = await import("../src/systems/DestinoSystem.js");
const evSys = await import("../src/systems/ExplorationEventSystem.js");
const { atendeGatilhoHeranca } = await import("../src/systems/TalentSystem.js");
const dadosMundo = { ...dados, monsters: monstros, skillChecks, explorationEvents: eventos, backgrounds: dados.backgrounds };

// --- Testes de perícia: toda perícia de origem aparece no mundo ---------------
{
  const porPericia = {};
  skillChecks.forEach((t) => { porPericia[t.pericia] = (porPericia[t.pericia] || 0) + 1; });
  dados.backgrounds.forEach((b) => {
    check(`perícia ${b.pericia} (${b.nome}) tem ao menos 4 testes no mundo (${porPericia[b.pericia] || 0})`, (porPericia[b.pericia] || 0) >= 4);
  });
  const idsItens = new Set(dados.items.itens.map((i) => i.id));
  const itensDeTeste = skillChecks.flatMap((t) => (t.itensSucesso || []).map((i) => i.id));
  check("todo item prometido por teste existe", itensDeTeste.every((id) => idsItens.has(id)));
  const exploracao = skillChecks.filter((t) => t.contexto === "exploracao");
  check("todo teste de exploração tem título, texto, oferta, sucesso e falha", exploracao.every((t) => t.titulo && t.texto && t.textoOferta && t.textoSucesso && t.textoFalha));
  check("todo teste de exploração dá alguma recompensa no sucesso", exploracao.every((t) => t.recompensaOuroSucesso || t.itensSucesso || t.fragmentosSucesso));
  check("ids de teste não se repetem", new Set(skillChecks.map((t) => t.id)).size === skillChecks.length);
}

// --- Opção de origem: passa sem dado -------------------------------------------
{
  const soldado = heroi({ antecedente: "soldado" });
  const teste = skillChecks.find((t) => t.pericia === "Intimidação");
  const opcao = evSys.opcaoDeOrigem(teste, soldado, dadosMundo);
  check("Soldado resolve um teste de Intimidação sem dado", !!opcao && opcao.rotulo.startsWith("[Soldado]"));
  check("outra origem não recebe a opção", evSys.opcaoDeOrigem(teste, heroi({ antecedente: "sabio" }), dadosMundo) === null);
  const antes = soldado.ouro;
  const r = evSys.aplicarResultadoTesteExploracao(soldado, teste, { sucesso: true }, { dados: dadosMundo, facaoId: "vila", dadosWorldState: dados.worldStateVariables });
  check("a opção de origem paga a recompensa do sucesso", soldado.ouro > antes && r.texto === teste.textoSucesso);
  const comItem = skillChecks.find((t) => t.itensSucesso && t.itensSucesso.length);
  const p2 = heroi();
  const nInv = p2.inventario.length;
  evSys.aplicarResultadoTesteExploracao(p2, comItem, { sucesso: true }, { dados: dadosMundo });
  check("teste com item entrega o item", p2.inventario.length > nInv);
  const comFragmentos = skillChecks.find((t) => t.fragmentosSucesso);
  const p3 = heroi();
  evSys.aplicarResultadoTesteExploracao(p3, comFragmentos, { sucesso: true }, { dados: dadosMundo });
  check("teste com Fragmentos entrega Fragmentos", (p3.gacha ? p3.gacha.fragmentos : 0) >= comFragmentos.fragmentosSucesso);
  const p4 = heroi();
  const ouro4 = p4.ouro;
  evSys.aplicarResultadoTesteExploracao(p4, comItem, { sucesso: false }, { dados: dadosMundo });
  check("falha não paga nada", p4.ouro === ouro4);
}

// --- Eventos exclusivos de origem ------------------------------------------------
{
  const exclusivos = eventos.filter((e) => e.origemExclusiva);
  check(`há eventos exclusivos de origem (${exclusivos.length})`, exclusivos.length >= 12);
  dados.backgrounds.forEach((b) => {
    const meus = exclusivos.filter((e) => e.origemExclusiva === b.id);
    check(`${b.nome} tem 2 eventos só dele`, meus.length === 2 && meus.every((e) => (e.opcoes || []).some((o) => o.id === "origem")));
  });
  const doSabio = heroi({ antecedente: "sabio" });
  let viuDeOutraOrigem = false;
  let viuDoSabio = false;
  for (let i = 0; i < 400; i += 1) {
    const ev = evSys.sortearEventoExploracao(eventos, [], doSabio);
    if (ev.origemExclusiva && ev.origemExclusiva !== "sabio") viuDeOutraOrigem = true;
    if (ev.origemExclusiva === "sabio") viuDoSabio = true;
  }
  check("o sorteio só oferece o evento da origem certa", !viuDeOutraOrigem && viuDoSabio);
  const evSabio = exclusivos.find((e) => e.origemExclusiva === "sabio" && (e.opcoes || []).some((o) => o.fragmentos));
  const antes = (doSabio.gacha && doSabio.gacha.fragmentos) || 0;
  evSys.aplicarEscolhaEvento(doSabio, evSabio, "origem", dados.worldStateVariables, "vila", dadosMundo);
  check("a escolha de origem entrega Fragmentos", ((doSabio.gacha && doSabio.gacha.fragmentos) || 0) > antes);
}

// --- Opção de personalidade nos eventos ---------------------------------------------
{
  const comTraco = eventos.filter((e) => e.opcoesPorTraco);
  const tracosCobertos = new Set(comTraco.flatMap((e) => Object.keys(e.opcoesPorTraco)));
  check(`toda personalidade tem uma resposta de evento (${tracosCobertos.size}/6)`, dados.traits.every((t) => tracosCobertos.has(t.id)));
  const corajoso = heroi({ traco: "corajoso" });
  const ev = comTraco.find((e) => e.opcoesPorTraco.corajoso);
  const opcoes = evSys.opcoesDoEvento(ev, corajoso);
  check("a opção da personalidade entra na lista", opcoes.some((o) => o.id === "traco_corajoso" && o.doTraco));
  check("quem tem outra personalidade não vê a opção", !evSys.opcoesDoEvento(ev, heroi({ traco: "cauteloso" })).some((o) => o.doTraco));
  const ouroAntes = corajoso.ouro;
  const r = evSys.aplicarEscolhaEvento(corajoso, ev, "traco_corajoso", dados.worldStateVariables, "vila", dadosMundo);
  check("a opção da personalidade paga", r.ok && corajoso.ouro > ouroAntes);
  const resistente = heroi({ traco: "resistente" });
  const evVigilia = comTraco.find((e) => e.opcoesPorTraco.resistente && e.opcoesPorTraco.resistente.curaTotal);
  resistente.hp = 1; resistente.mp = 0;
  evSys.aplicarEscolhaEvento(resistente, evVigilia, "traco_resistente", dados.worldStateVariables, "vila", dadosMundo);
  check("vigília do Resistente devolve HP e MP", resistente.hp === resistente.hpMax && resistente.mp === resistente.mpMax);
}

// --- Destino pessoal ------------------------------------------------------------------
{
  check("toda origem tem contato e toda motivação tem caminho", dados.backgrounds.every((b) => destino.CONTATOS_DE_ORIGEM[b.id])
    && ["descoberta", "justica", "legado", "liberdade", "redencao", "poder"].every((m) => destino.CAMINHOS_DA_MOTIVACAO[m]?.passos.length === 3));
  const p = heroi({ antecedente: "criminoso", motivacao: "legado" });
  const itens = destino.destinoAtual(p, dadosMundo);
  check("o painel mostra a tarefa de origem e o passo da motivação", itens.length === 2 && itens[0].linha === "origem" && itens[1].linha === "motivacao");
  check("o objetivo vira texto legível", destino.textoObjetivo(itens[0].objetivo).length > 10 && destino.textoRecompensa(itens[0].recompensa, dadosMundo).length > 3);
  check("nada é entregue antes da meta", destino.verificarDestino(p, dadosMundo).length === 0);
  p.locaisExplorados = ["bau_a", "bau_b", "bau_c"];
  const ouroAntes = p.ouro;
  const entregues = destino.verificarDestino(p, dadosMundo);
  check(`três baús fecham a tarefa do Criminoso e o 1º passo do Legado (${entregues.length})`, entregues.length === 2 && p.ouro > ouroAntes && p.destino.origemConcluida && p.destino.passoMotivacao === 1);
  check("o passo entregue devolve o XP para quem chamou", entregues.some((e) => e.xp > 0));
  const vitorias = heroi({ antecedente: "soldado", motivacao: "poder" });
  destino.registrarVitoria(vitorias, [{ nivelMonstro: 9, xp: 10 }]);
  destino.registrarVitoria(vitorias, [{ nivelMonstro: 1, xp: 10 }]);
  check("contadores de vitória e de vitória acima do nível", vitorias.contadores.vitorias === 2 && vitorias.contadores.vitoriasAcima === 1);
  destino.registrarColeta(vitorias);
  check("contador de coleta", vitorias.contadores.coletas === 1);
  const chefeMonstro = monstros.find((m) => m.chefe);
  const cacador = heroi({ motivacao: "justica" });
  cacador.compendio = { abates: { [chefeMonstro.id]: 1 } };
  check("chefes contam pelo bestiário", destino.progressoObjetivo(cacador, { tipo: "chefes", meta: 1 }, dadosMundo).pronto);
  const ladrao = heroi({ antecedente: "criminoso", motivacao: "redencao" });
  const caminhoLadrao = destino.destinoAtual(ladrao, dadosMundo).find((i) => i.linha === "motivacao");
  check("Criminoso + Redenção vira Dívida Antiga", caminhoLadrao.subtitulo.includes("Dívida Antiga"));
  const outroRedimido = heroi({ antecedente: "nobre", motivacao: "redencao" });
  check("sem a combinação, a linha segue com o nome normal", !destino.destinoAtual(outroRedimido, dadosMundo).find((i) => i.linha === "motivacao").subtitulo.includes("Dívida Antiga"));
}

// --- Herança: um nó por facção e um por raça ---------------------------------------------
{
  const nos = heranca.nos;
  const facoes = dados.worldStateVariables.facoes.filter((f) => f.id !== "vila");
  check("toda facção tem um nó de herança", facoes.every((f) => nos.some((n) => n.gatilho && n.gatilho.tipo === "reputacaoFaccao" && n.gatilho.facaoId === f.id)));
  check("toda raça tem um nó de herança", dados.races.every((r) => nos.some((n) => n.gatilho && n.gatilho.tipo === "racaNivel" && n.gatilho.racaId === r.id)));
  const chaves = ["FOR", "DES", "CON", "INT", "hpMaxPercent", "mpMaxPercent", "critChance", "defesaFlat"];
  check("todo nó tem efeito somável", nos.every((n) => n.efeito && n.efeito.tipo === "bonusAtributo" && chaves.includes(n.efeito.atributo)));
  const noDoAnao = nos.find((n) => n.gatilho.tipo === "racaNivel" && n.gatilho.racaId === "anao");
  const anaoNovato = { racaId: "anao", nivel: 3 };
  const anaoVeterano = { racaId: "anao", nivel: 8 };
  check("nó de raça só abre no nível certo", !atendeGatilhoHeranca(anaoNovato, noDoAnao) && atendeGatilhoHeranca(anaoVeterano, noDoAnao));
  check("nó de raça não abre para outra raça", !atendeGatilhoHeranca({ racaId: "elfo", nivel: 20 }, noDoAnao));
}

// --- Prólogo com frase de raça e de motivação -------------------------------------------
{
  const cenas = fs.readFileSync(new URL("../src/data/cutscenes.js", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../src/ui/CutsceneUI.js", import.meta.url), "utf8");
  check("o prólogo usa a frase da raça e a da motivação", cenas.includes("{marcaRaca}") && cenas.includes("{marcaMotivacao}"));
  check("a cena tem frase para as 6 raças e as 6 motivações", dados.races.every((r) => new RegExp(`${r.id}:`).test(ui.split("MARCA_DA_MOTIVACAO")[0]))
    && ["descoberta", "justica", "legado", "liberdade", "redencao", "poder"].every((m) => ui.includes(`${m}: "E, sem saber por quê`)));
}

// --- Onda 4: toda classe tem Caminho do Herdeiro -----------------------------------------
//
// A classe é a primeira escolha de verdade da criação. Antes desta onda,
// quatro das seis classes abriam a tela "Caminhos do Herdeiro" vazia — o card
// prometia um caminho que não existia. Estes blocos conferem, para as SEIS
// famílias, que a árvore existe, que ela é alcançável nível a nível e que
// todo efeito declarado é um efeito que o motor executa de verdade.
{
  const arvores = {
    guerreiro: json("talentsGuerreiro"), mago: json("talentsMago"),
    ladino: json("talentsLadino"), clerigo: json("talentsClerigo"),
    barbaro: json("talentsBarbaro"), patrulheiro: json("talentsPatrulheiro"),
  };
  const subclasses = json("subclasses").subclasses;
  const estados = json("elementalStates").estados.map((e) => e.id);
  const elementos = json("elements").elementos.map((e) => e.id);
  const dadosTalentos = {
    subclasses: { subclasses },
    talentsGuerreiro: arvores.guerreiro, talentsMago: arvores.mago,
    talentsLadino: arvores.ladino, talentsClerigo: arvores.clerigo,
    talentsBarbaro: arvores.barbaro, talentsPatrulheiro: arvores.patrulheiro,
    heritageTree: heranca,
  };
  const ATRIBUTOS_SOMAVEIS = ["FOR", "DES", "CON", "INT", "hpMaxPercent", "mpMaxPercent", "critChance", "defesaFlat"];
  // Os tipos que CombatSystem.usarHabilidade() realmente processa (o `switch`
  // grande) — qualquer outro vira um card que não faz nada em combate.
  const TIPOS_JOGAVEIS = ["dano_fisico", "dano_fisico_des", "dano_ignora_defesa", "dano_magico", "cura",
    "buff_defesa", "buff_ataque", "debuff_velocidade", "dano_area", "cura_area", "buff_time", "debuff_area", "fuga"];

  check(`as 6 classes jogáveis têm árvore de talentos (${dados.classes.length})`,
    dados.classes.every((c) => arvoreDoPersonagem({ classeId: c.id }, dadosTalentos).length > 0));

  const todos = [];
  for (const classe of dados.classes) {
    const arvore = arvoreDoPersonagem({ classeId: classe.id }, dadosTalentos);
    todos.push(...arvore);
    const ids = new Set(arvore.map((t) => t.id));
    const daClasse = arvore.filter((t) => t.tipoPonto === "classe");
    const daSub = arvore.filter((t) => t.tipoPonto === "subclasse");
    const subsDaClasse = subclasses.filter((s) => s.classeId === classe.id);
    check(`${classe.nome}: 16 talentos (7 de classe + 9 de subclasse)`, arvore.length === 16 && daClasse.length === 7 && daSub.length === 9);
    check(`${classe.nome}: 3 subclasses com 3 talentos cada`,
      subsDaClasse.length === 3 && subsDaClasse.every((s) => daSub.filter((t) => t.subclasseId === s.id).length === 3));
    check(`${classe.nome}: todo talento aponta para a própria classe`, arvore.every((t) => t.classeId === classe.id));
    check(`${classe.nome}: todo subclasseId existe em subclasses.json`,
      daSub.every((t) => subsDaClasse.some((s) => s.id === t.subclasseId)));
    check(`${classe.nome}: nenhum pré-requisito quebrado`, arvore.every((t) => (t.requer || []).every((r) => ids.has(r))));
    // Um pré-requisito só é alcançável se vier ANTES em nível — senão o
    // talento nasce trancado pra sempre.
    const nivel = Object.fromEntries(arvore.map((t) => [t.id, t.nivelMinimo]));
    check(`${classe.nome}: pré-requisito nunca exige nível maior que o próprio talento`,
      arvore.every((t) => (t.requer || []).every((r) => nivel[r] <= t.nivelMinimo)));
    // Dois talentos do mesmo grupoExclusivo se trancam: exigir os dois
    // deixaria o dependente inacessível.
    const grupos = {};
    arvore.filter((t) => t.grupoExclusivo).forEach((t) => { (grupos[t.grupoExclusivo] ||= []).push(t.id); });
    check(`${classe.nome}: ninguém exige dois talentos que se trancam`,
      arvore.every((t) => Object.values(grupos).every((g) => (t.requer || []).filter((r) => g.includes(r)).length <= 1)));
    check(`${classe.nome}: talento de subclasse só a partir do nível da escolha (${NIVEL_ESCOLHA_SUBCLASSE})`,
      daSub.every((t) => t.nivelMinimo >= NIVEL_ESCOLHA_SUBCLASSE) && daClasse.every((t) => t.nivelMinimo < NIVEL_ESCOLHA_SUBCLASSE));
  }

  const idsGlobais = todos.map((t) => t.id);
  check(`nenhum id de talento se repete entre as classes (${idsGlobais.length})`, new Set(idsGlobais).size === idsGlobais.length);
  const habs = todos.filter((t) => t.efeito.tipo === "concedeHabilidade").map((t) => t.efeito.habilidade);
  const idsHab = habs.map((h) => h.id);
  check(`nenhum id de habilidade se repete (${idsHab.length})`, new Set(idsHab).size === idsHab.length);
  check("todo efeito é bonusAtributo ou concedeHabilidade", todos.every((t) => ["bonusAtributo", "concedeHabilidade"].includes(t.efeito.tipo)));
  check("todo bonusAtributo usa um atributo que entra em bonusTotal()",
    todos.filter((t) => t.efeito.tipo === "bonusAtributo").every((t) => ATRIBUTOS_SOMAVEIS.includes(t.efeito.atributo) && t.efeito.valor > 0));
  check("toda habilidade concedida usa um tipo que o motor executa", habs.every((h) => TIPOS_JOGAVEIS.includes(h.tipo)));
  check("todo elemento declarado existe em elements.json", habs.every((h) => !h.elemento || elementos.includes(h.elemento)));
  check("todo aplicaEstado existe em elementalStates.json", habs.every((h) => !h.aplicaEstado || estados.includes(h.aplicaEstado)));
  check("toda habilidade tem nome, custo de MP e cooldown", habs.every((h) => h.nome && h.custoMP >= 0 && h.cooldown >= 0));
  check("toda habilidade de dano tem multiplicador", habs.every((h) => !/^dano_|^cura/.test(h.tipo) || h.multiplicador > 0));
  check("todo talento tem nome, ícone, descrição e custo", todos.every((t) => t.nome && t.icone && t.descricao && t.custo >= 1));

  // TETO DE ATRIBUTO. Só 6 dos 7 talentos de classe são alcançáveis (o par do
  // nv5 se tranca) e só UMA das 3 trilhas de subclasse. Guerreiro e Mago são
  // a régua: primário até 5, crítico até 0,13, vida até 0,06, mana até 0,08,
  // defesa até 5. Sem este teste, uma classe nova nasce mais forte que as
  // outras só porque ninguém somou a árvore inteira.
  const TETO = { FOR: 5, DES: 5, CON: 5, INT: 5, critChance: 0.13, hpMaxPercent: 0.06, mpMaxPercent: 0.08, defesaFlat: 5 };
  const estouros = [];
  for (const classe of dados.classes) {
    const arvore = arvoreDoPersonagem({ classeId: classe.id }, dadosTalentos);
    const deClasse = arvore.filter((t) => t.tipoPonto === "classe");
    const grupos = {};
    deClasse.filter((t) => t.grupoExclusivo).forEach((t) => { (grupos[t.grupoExclusivo] ||= []).push(t.id); });
    const ramos = Object.values(grupos);
    const combinacoes = ramos.length ? ramos[0].map((id) => [id]) : [[]];
    for (const sub of subclasses.filter((s) => s.classeId === classe.id)) {
      for (const escolhidos of combinacoes) {
        const soma = {};
        const pegar = (t) => { if (t.efeito.tipo === "bonusAtributo") soma[t.efeito.atributo] = (soma[t.efeito.atributo] || 0) + t.efeito.valor; };
        deClasse.filter((t) => !t.grupoExclusivo || escolhidos.includes(t.id)).forEach(pegar);
        arvore.filter((t) => t.subclasseId === sub.id).forEach(pegar);
        for (const [attr, valor] of Object.entries(soma)) {
          if (valor > TETO[attr] + 1e-9) estouros.push(`${classe.nome}/${sub.nome}: ${attr} ${valor.toFixed(2)} > ${TETO[attr]}`);
        }
      }
    }
  }
  check(`nenhuma classe passa do teto de atributo do Guerreiro/Mago${estouros.length ? ` — ${estouros.join("; ")}` : ""}`, estouros.length === 0);

  // O Bárbaro tem manaBase 4: uma habilidade cara nasceria inutilizável.
  const doBarbaro = arvores.barbaro.talentos.filter((t) => t.efeito.tipo === "concedeHabilidade").map((t) => t.efeito.habilidade);
  check("nenhuma habilidade do Bárbaro cobra mana que ele não tem", doBarbaro.every((h) => h.custoMP === 0));
}

// --- Onda 4: os talentos novos funcionam de verdade em combate ---------------------------
{
  const dadosCompletos = { ...dados, elementalStates: json("elementalStates"), elementalReactions: json("elementalReactions") };
  const ladino = heroi({ classe: "ladino", elemento: "sombrio" });
  const talento = json("talentsLadino").talentos.find((t) => t.id === "t_ladino_golpe_nas_costas");
  ladino.habilidades = [...ladino.habilidades, { ...talento.efeito.habilidade }];
  const { batalha, jogador, inimigo } = batalhaCom(ladino);
  // Repete porque o d20 pode errar, repondo MP e cooldown a cada tentativa: o
  // que se afirma é que o golpe EXISTE no motor e tira HP quando acerta, não
  // que ele nunca erra nem que o herói tem mana para 20 golpes seguidos.
  const hpAntes = inimigo.hp;
  for (let i = 0; i < 20 && inimigo.hp === hpAntes; i += 1) {
    jogador.mp = jogador.mpMax;
    jogador.cooldowns = {};
    batalha.usarHabilidade(jogador, { ...talento.efeito.habilidade }, inimigo);
  }
  check("talento novo vira golpe real em batalha (Golpe nas Costas tira HP)", inimigo.hp < hpAntes);

  const clerigo = heroi({ classe: "clerigo" });
  const cura = json("talentsClerigo").talentos.find((t) => t.id === "t_guardiao_luz_sopro_da_aurora");
  clerigo.habilidades = [...clerigo.habilidades, { ...cura.efeito.habilidade }];
  const b2 = batalhaCom(clerigo);
  b2.jogador.hp = 5;
  b2.jogador.mp = b2.jogador.mpMax;
  b2.batalha.usarHabilidade(b2.jogador, { ...cura.efeito.habilidade }, b2.jogador);
  check("cura de subclasse devolve HP de verdade", b2.jogador.hp > 5);

  // Aqui a batalha precisa das tabelas de ESTADOS: aplicarEstadoDeHabilidade
  // não faz nada sem `dadosEstados` (ver CombatSystem.js).
  const patrulheiro = heroi({ classe: "patrulheiro", elemento: "natureza" });
  const raizes = json("talentsPatrulheiro").talentos.find((t) => t.id === "t_silvestre_raizes_vivas");
  const alvo = criarCombatenteInimigo({ id: "alvo", nome: "Alvo", hp: 5000, atk: 6, vel: 1, defesa: 0, elemento: "fisico", sprite: "x" }, 0);
  const arqueiro = criarCombatenteJogador(patrulheiro, dados);
  const b3 = new Batalha([arqueiro], [alvo], dados.elements, null, [], 0, null, false, dadosCompletos.elementalStates, dadosCompletos.elementalReactions);
  const enraizado = (c) => (c.estadosElementais || c.statusEffects || []).some((s) => (s.def && s.def.id === "enraizado") || s.estado === "enraizado" || s.id === "enraizado" || s.tipo === "enraizado");
  // Repõe MP e cooldown a cada tentativa: o que se afirma é que a habilidade
  // aplica o estado quando ACERTA, não que ela acerta sempre nem que o
  // Patrulheiro tem mana para 40 conjurações seguidas.
  for (let i = 0; i < 40 && !enraizado(alvo); i += 1) {
    alvo.hp = 5000;
    arqueiro.mp = arqueiro.mpMax;
    arqueiro.cooldowns = {};
    b3.usarHabilidade(arqueiro, { ...raizes.efeito.habilidade }, alvo);
  }
  check("Raízes Vivas chega a aplicar Enraizado no alvo", enraizado(alvo));
}

// --- Onda 4: subir de nível e gastar ponto funciona nas 4 classes novas -------------------
//
// O teste acima confere o DADO. Este confere o CAMINHO INTEIRO: subir de
// nível dá ponto, o ponto abre um talento, o talento entra no personagem
// (atributo somado ou habilidade jogável) e a subclasse do nível 10 destrava
// a trilha dela — em cada uma das 4 classes que não tinham nada.
{
  const dadosTalentos = {
    ...dados,
    subclasses: json("subclasses"),
    talentsGuerreiro: json("talentsGuerreiro"), talentsMago: json("talentsMago"),
    talentsLadino: json("talentsLadino"), talentsClerigo: json("talentsClerigo"),
    talentsBarbaro: json("talentsBarbaro"), talentsPatrulheiro: json("talentsPatrulheiro"),
    heritageTree: heranca,
  };
  const subir = (p, ate) => { for (let n = p.nivel + 1; n <= ate; n += 1) { p.nivel = n; concederPontosPorNivel(p, n); } };

  for (const classeId of ["ladino", "clerigo", "barbaro", "patrulheiro"]) {
    const p = heroi({ classe: classeId });
    const arvore = arvoreDoPersonagem(p, dadosTalentos);
    subir(p, 9);
    const { disponiveis } = avaliarArvore(p, arvore);
    check(`${classeId}: no nível 9 há talento de classe disponível (${disponiveis.length})`, disponiveis.length > 0 && disponiveis.every((n) => n.tipoPonto === "classe"));

    // 1) Um talento de atributo entra em bonusCaminhoHerdeiro de verdade.
    const passivo = arvore.find((t) => t.tipoPonto === "classe" && t.nivelMinimo === 1 && t.efeito.tipo === "bonusAtributo");
    const antes = bonusCaminhoHerdeiro(p, dadosTalentos)[passivo.efeito.atributo];
    check(`${classeId}: escolher "${passivo.nome}" gasta ponto e soma o atributo`,
      escolherTalento(p, passivo.id, arvore, dadosTalentos).ok
      && bonusCaminhoHerdeiro(p, dadosTalentos)[passivo.efeito.atributo] === antes + passivo.efeito.valor);

    // 2) Um talento de habilidade coloca a habilidade na barra do personagem.
    const comHab = arvore.find((t) => t.tipoPonto === "classe" && t.efeito.tipo === "concedeHabilidade" && (t.requer || []).every((r) => r === passivo.id));
    if (comHab) {
      const r = escolherTalento(p, comHab.id, arvore, dadosTalentos);
      check(`${classeId}: "${comHab.nome}" vira habilidade na barra`,
        r.ok && p.habilidades.some((h) => h.id === comHab.efeito.habilidade.id));
    }

    // 3) No nível 10 a subclasse abre e destrava só a trilha escolhida.
    subir(p, 10);
    const subs = subclassesDisponiveis(p, dadosTalentos);
    check(`${classeId}: 3 subclasses oferecidas no nível 10`, subs.length === 3);
    check(`${classeId}: escolher "${subs[0].nome}" trava a escolha`, escolherSubclasse(p, subs[0].id, dadosTalentos).ok && !escolherSubclasse(p, subs[1].id, dadosTalentos).ok);
    const abertos = avaliarArvore(p, arvore).disponiveis.filter((n) => n.tipoPonto === "subclasse");
    check(`${classeId}: só a trilha de "${subs[0].nome}" abre`, abertos.length > 0 && abertos.every((n) => n.subclasseId === subs[0].id));
    check(`${classeId}: nenhum talento das outras 2 subclasses aparece`,
      avaliarArvore(p, arvore).disponiveis.every((n) => n.subclasseId !== subs[1].id && n.subclasseId !== subs[2].id));
  }
}

// --- Onda 5: a loja onde a origem é de casa ----------------------------------------------
{
  const facoes = dados.worldStateVariables.facoes.map((f) => f.id);
  check(`toda origem tem uma loja de casa (${Object.keys(LOJA_DA_ORIGEM).length}/6)`,
    dados.backgrounds.every((b) => LOJA_DA_ORIGEM[b.id]));
  check("toda loja de casa aponta para uma facção que existe",
    Object.values(LOJA_DA_ORIGEM).every((l) => facoes.includes(l.faccaoId)));
  check("nenhuma facção é a loja de casa de duas origens",
    new Set(Object.values(LOJA_DA_ORIGEM).map((l) => l.faccaoId)).size === Object.keys(LOJA_DA_ORIGEM).length);
  check("toda loja de casa explica o motivo", Object.values(LOJA_DA_ORIGEM).every((l) => l.motivo && l.motivo.length > 10));

  const nobre = heroi({ antecedente: "nobre" });
  const naCoroa = multiplicadorPrecoLoja(nobre, dados.worldStateVariables, "coroa_de_aethra");
  const naVila = multiplicadorPrecoLoja(nobre, dados.worldStateVariables, "vila");
  check(`Nobre paga ${Math.round(DESCONTO_LOJA_ORIGEM * 100)}% menos na Coroa (${naCoroa.toFixed(2)}) e preço cheio na vila (${naVila.toFixed(2)})`,
    Math.abs(naCoroa - (1 - DESCONTO_LOJA_ORIGEM)) < 1e-9 && Math.abs(naVila - 1) < 1e-9);

  const andarilho = heroi({ antecedente: "andarilho_do_povo" });
  check("Andarilho do Povo é quem tem desconto na vila",
    Math.abs(multiplicadorPrecoLoja(andarilho, dados.worldStateVariables, "vila") - (1 - DESCONTO_LOJA_ORIGEM)) < 1e-9);

  // O desconto da origem MULTIPLICA o da reputação — não substitui um pelo
  // outro, nem some quando o herói já é bem-visto.
  const comRep = heroi({ antecedente: "nobre", faccao: "coroa_de_aethra" });
  const tierRespeitado = dados.worldStateVariables.tiers.find((t) => t.id === "respeitado");
  const esperado = (1 - tierRespeitado.descontoLoja) * (1 - DESCONTO_LOJA_ORIGEM);
  check(`reputação e origem se somam sem se cancelar (${multiplicadorPrecoLoja(comRep, dados.worldStateVariables, "coroa_de_aethra").toFixed(4)} = ${esperado.toFixed(4)})`,
    Math.abs(multiplicadorPrecoLoja(comRep, dados.worldStateVariables, "coroa_de_aethra") - esperado) < 1e-9);

  // Um herói hostil continua pagando mais: o desconto da origem não pode
  // apagar a punição de reputação, só amortecê-la.
  const odiado = heroi({ antecedente: "nobre" });
  odiado.estadoDoMundo.reputacao.coroa_de_aethra = -80;
  check("quem é hostil ainda paga mais que o preço cheio na própria loja de casa",
    multiplicadorPrecoLoja(odiado, dados.worldStateVariables, "coroa_de_aethra") > 1);

  check("o piso de 50% continua valendo", dados.backgrounds.every((b) => {
    const p = heroi({ antecedente: b.id });
    p.estadoDoMundo.reputacao[LOJA_DA_ORIGEM[b.id].faccaoId] = 999;
    return multiplicadorPrecoLoja(p, dados.worldStateVariables, LOJA_DA_ORIGEM[b.id].faccaoId) >= 0.5;
  }));

  check("a loja explica o desconto na tela e cala fora dela",
    textoDescontoOrigem(nobre, "coroa_de_aethra", "Nobre").includes("Nobre")
    && textoDescontoOrigem(nobre, "vila", "Nobre") === "");
  check("o card da criação mostra a loja de casa das 6 origens", dados.backgrounds.every((b) => lojaDaOrigem({ antecedenteId: b.id })));
}

// --- Onda 5: a resposta que só a sua origem permite no prólogo ---------------------------
{
  const prologo = CUTSCENES.find((c) => c.quando === "novo_jogo" && c.escolha);
  const porOrigem = prologo.escolha.opcoesPorOrigem || {};
  check("o prólogo tem uma resposta para cada uma das 6 origens",
    dados.backgrounds.every((b) => porOrigem[b.id]));
  check("toda resposta de origem tem fala, desfecho, flag, reputação e diário",
    Object.values(porOrigem).every((o) => o.rotulo && o.resultado && o.flag && o.reputacao && o.diario));
  check("nenhuma flag de origem se repete",
    new Set(Object.values(porOrigem).map((o) => o.flag)).size === Object.keys(porOrigem).length);
  check("toda reputação prometida é de uma facção que existe", Object.values(porOrigem).every((o) =>
    Object.keys(o.reputacao).every((f) => dados.worldStateVariables.facoes.some((x) => x.id === f))));

  const soldado = heroi({ antecedente: "soldado" });
  const opcoes = opcoesDaCena(prologo, soldado);
  check(`o Soldado vê 4 respostas, não 3 (${opcoes.length})`, opcoes.length === prologo.escolha.opcoes.length + 1);
  check("a resposta extra vem marcada como da origem", opcoes.some((o) => o.id === "origem_soldado" && o.daOrigem));
  check("quem tem outra origem não vê a resposta do Soldado",
    !opcoesDaCena(prologo, heroi({ antecedente: "sabio" })).some((o) => o.id === "origem_soldado"));
  check("um personagem sem origem só vê as 3 de todo mundo", opcoesDaCena(prologo, {}).length === prologo.escolha.opcoes.length);

  // A resposta da origem tem de passar pelo MESMO motor das outras: flag,
  // reputação e diário. Se só existisse no texto, seria decoração.
  const antesVila = getReputacao(soldado, "vila");
  const r = aplicarEscolhaCena(soldado, prologo, "origem_soldado", dados.worldStateVariables);
  check("a resposta da origem é aplicada de verdade (flag, reputação e diário)",
    r.ok && soldado.estadoDoMundo.flags.prologo_origem_soldado
    && getReputacao(soldado, "vila") > antesVila
    && getReputacao(soldado, "legiao_das_cinzas") > 0
    && (soldado.estadoDoMundo.decisoes || []).length > 0);
  check("a cena registra QUAL resposta foi dada", soldado.estadoDoMundo.flags[`cena_${prologo.id}`] === "origem_soldado");

  // Ninguém pode responder pela origem alheia, nem por acidente nem de propósito.
  check("responder com a origem errada não aplica nada",
    !aplicarEscolhaCena(heroi({ antecedente: "nobre" }), prologo, "origem_soldado", dados.worldStateVariables).ok);

  // A resposta de origem abre uma porta, não é simplesmente a melhor: o ganho
  // com a vila não passa do da melhor resposta que todo mundo pode dar.
  const melhorComum = Math.max(...prologo.escolha.opcoes.map((o) => (o.reputacao || {}).vila || 0));
  check(`nenhuma resposta de origem rende mais com a vila que a melhor resposta comum (${melhorComum})`,
    Object.values(porOrigem).every((o) => (o.reputacao.vila || 0) <= melhorComum + 1));
}

// --- Onda 5: o povo da região repara na raça do herdeiro ---------------------------------
{
  const regioes = [...new Set(NPCS_REGIONAIS.map((n) => n.regiaoId).filter(Boolean))];
  const racas = dados.races.map((r) => r.id);
  const pares = Object.entries(RECONHECIMENTO_RACIAL).flatMap(([reg, m]) => Object.keys(m).map((r) => [reg, r]));
  check(`há reconhecimento racial escrito (${pares.length} falas em ${Object.keys(RECONHECIMENTO_RACIAL).length} regiões)`, pares.length >= 18);
  check("toda região da tabela tem NPC de verdade", Object.keys(RECONHECIMENTO_RACIAL).every((r) => regioes.includes(r)));
  check("toda raça da tabela existe em races.json", pares.every(([, r]) => racas.includes(r)));
  check("as 6 raças são reconhecidas em algum lugar",
    racas.every((r) => pares.some(([, rr]) => rr === r)));
  check("toda fala é uma frase de verdade (fala do local, não rótulo)",
    pares.every(([reg, r]) => RECONHECIMENTO_RACIAL[reg][r].length > 40));

  const npcDeMorranvell = NPCS_REGIONAIS.find((n) => n.regiaoId === "morranvell");
  check("um anão em Morranvell é reconhecido", !!reacaoARaca(npcDeMorranvell, heroi({ raca: "anao" })));
  check("um orc em Morranvell não recebe fala inventada", reacaoARaca(npcDeMorranvell, heroi({ raca: "orc" })) === null);
  check("NPC sem região (os 5 antigos da vila) nunca reage",
    reacaoARaca({ id: "npc_fazendeiro", nome: "Tobias" }, heroi({ raca: "anao" })) === null);
  check("sem personagem não quebra", reacaoARaca(npcDeMorranvell, null) === null && reconhecimentoRacial(null, null) === null);

  // A reação é texto, não mecânica: não pode mexer em atributo, ouro nem
  // reputação pelas costas do jogador.
  const antes = heroi({ raca: "anao" });
  const ouroAntes = antes.ouro;
  const repAntes = JSON.stringify(antes.estadoDoMundo.reputacao);
  reacaoARaca(npcDeMorranvell, antes);
  check("a reação é só fala: não mexe em ouro nem reputação",
    antes.ouro === ouroAntes && JSON.stringify(antes.estadoDoMundo.reputacao) === repAntes);
}

// --- Onda 5: a ação de mundo da classe ---------------------------------------------------
{
  const comClasse = eventos.filter((e) => e.opcoesPorClasse);
  const cobertas = new Set(comClasse.flatMap((e) => Object.keys(e.opcoesPorClasse)));
  check(`toda classe tem ação de mundo (${cobertas.size}/6 em ${comClasse.length} eventos)`,
    dados.classes.every((c) => cobertas.has(c.id)));
  check("toda ação de classe aponta para uma classe que existe",
    [...cobertas].every((id) => dados.classes.some((c) => c.id === id)));
  check("toda ação de classe tem rótulo marcado e desfecho escrito",
    comClasse.every((e) => Object.values(e.opcoesPorClasse).every((o) => /^\[[^\]]+\]/.test(o.rotulo) && o.textoResultado && o.textoResultado.length > 40)));
  const itensDoJogo = new Set(dados.items.itens.map((i) => i.id));
  check("todo item prometido por ação de classe existe",
    comClasse.every((e) => Object.values(e.opcoesPorClasse).every((o) => (o.itens || []).every((i) => itensDoJogo.has(i.id)))));

  // Os 4 eventos novos existem e cada um tem saída para quem NÃO é da classe:
  // uma ação exclusiva que trancasse o evento seria pior que não existir.
  ["bau_trancado", "passagem_bloqueada", "pedra_runica", "cobradores_na_estrada"].forEach((id) => {
    const ev = eventos.find((e) => e.id === id);
    check(`evento "${id}" existe e tem saída para qualquer herói`, !!ev && (ev.opcoes || []).length >= 2);
  });

  const ladino = heroi({ classe: "ladino" });
  const bauTrancado = eventos.find((e) => e.id === "bau_trancado");
  const opcoesLadino = evSys.opcoesDoEvento(bauTrancado, ladino);
  check("o Ladino vê a opção de arrombar", opcoesLadino.some((o) => o.id === "classe_ladino" && o.daClasse));
  check("o Mago não vê a opção do Ladino",
    !evSys.opcoesDoEvento(bauTrancado, heroi({ classe: "mago" })).some((o) => o.daClasse && o.id === "classe_ladino"));
  check("cada classe vê no máximo a PRÓPRIA ação", dados.classes.every((c) =>
    evSys.opcoesDoEvento(bauTrancado, heroi({ classe: c.id })).filter((o) => o.daClasse).length <= 1));

  // A ação tem de PAGAR de verdade, e pagar melhor que a saída de todo mundo
  // — senão a classe é só um rótulo a mais no botão.
  const ouroAntes = ladino.ouro;
  const r = evSys.aplicarEscolhaEvento(ladino, bauTrancado, "classe_ladino", dados.worldStateVariables, "vila", dados);
  check("a ação da classe paga de verdade", r.ok && ladino.ouro > ouroAntes && ladino.inventario.length > 0);
  check("a ação da classe rende mais que a saída bruta",
    bauTrancado.opcoesPorClasse.ladino.ouro > Math.max(...bauTrancado.opcoes.map((o) => o.ouro || 0)));
  check("ninguém resolve com a ação de outra classe",
    !evSys.aplicarEscolhaEvento(heroi({ classe: "mago" }), bauTrancado, "classe_ladino", dados.worldStateVariables, "vila", dados).ok);

  // Classe e personalidade convivem no mesmo evento sem uma comer a outra.
  const ladinoSortudo = heroi({ classe: "ladino", traco: "sortudo" });
  const ambas = evSys.opcoesDoEvento(bauTrancado, ladinoSortudo);
  check("classe e personalidade aparecem juntas quando as duas batem",
    ambas.some((o) => o.daClasse) && ambas.some((o) => o.doTraco));
  check("nenhum id de opção se repete dentro de um evento", eventos.every((e) => {
    const ids = evSys.opcoesDoEvento(e, ladinoSortudo).map((o) => o.id);
    return new Set(ids).size === ids.length;
  }));
}

console.log(`\n${passou} testes das escolhas de criação passaram.`);
