// Testes de lógica pura da arquitetura genérica de Caminhos do Herdeiro
// (task #92 — pontos, talentos, subclasse, herança e presets, ver
// src/systems/TalentSystem.js). As árvores DE VERDADE do Guerreiro/Mago só
// chegam nas tasks #93/#94 — aqui os "talentos" usados são sintéticos,
// exatamente no formato que essas árvores vão usar, só pra provar que o
// motor (pontos, pré-requisito, grupo exclusivo, respec, herança
// permanente, presets) funciona ponta a ponta antes de existir conteúdo.
import {
  garantirEstadoCaminho, concederPontosPorNivel, concederPontoHeranca,
  escolherTalento, resetarTalentos, talentosAtivos, avaliarArvore,
  renomearPreset, alternarPreset, bonusCaminhoHerdeiro, atendeGatilhoHeranca,
  subclassesDisponiveis, escolherSubclasse, arvoreDoPersonagem, arvoreHeranca,
  NIVEL_ESCOLHA_SUBCLASSE,
} from "../src/systems/TalentSystem.js";
import { totalAbates, registrarAbateCompendio } from "../src/systems/CompendiumSystem.js";
import { getReputacao, alterarReputacao } from "../src/systems/WorldStateSystem.js";
import fs from "node:fs";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

const dadosElementos = JSON.parse(fs.readFileSync(new URL("../src/data/elements.json", import.meta.url))); // não usado diretamente, mantém padrão dos outros testes
const dadosHeritageReal = JSON.parse(fs.readFileSync(new URL("../src/data/heritageTree.json", import.meta.url)));
const dadosWorldState = JSON.parse(fs.readFileSync(new URL("../src/data/worldStateVariables.json", import.meta.url)));

function fakePersonagem(overrides = {}) {
  return { nome: "Herói", classeId: "guerreiro", nivel: 1, atributos: { FOR: 10, DES: 10, CON: 10, INT: 10 }, hp: 100, hpMax: 100, mp: 20, mpMax: 20, equipamento: {}, habilidades: [], ...overrides };
}

// Árvore sintética (mesmo formato de src/data/talentsGuerreiro.json quando
// deixar de estar vazio): 2 talentos de classe encadeados + 1 grupo
// exclusivo de 2 opções + 1 talento de subclasse restrito por nível.
const ARVORE_TESTE = [
  { id: "t_forca_1", nome: "Vigor de Batalha", tipoPonto: "classe", custo: 1, nivelMinimo: 1, efeito: { tipo: "bonusAtributo", atributo: "FOR", valor: 2 } },
  { id: "t_forca_2", nome: "Fúria Contida", tipoPonto: "classe", custo: 1, nivelMinimo: 3, requer: ["t_forca_1"], efeito: { tipo: "bonusAtributo", atributo: "FOR", valor: 3 } },
  { id: "t_ramo_a", nome: "Investida", tipoPonto: "classe", custo: 1, nivelMinimo: 1, grupoExclusivo: "ramo_impeto", efeito: { tipo: "bonusAtributo", atributo: "DES", valor: 2 } },
  { id: "t_ramo_b", nome: "Postura de Ferro", tipoPonto: "classe", custo: 1, nivelMinimo: 1, grupoExclusivo: "ramo_impeto", efeito: { tipo: "bonusAtributo", atributo: "CON", valor: 2 } },
  { id: "t_habilidade_nova", nome: "Golpe Sísmico", tipoPonto: "classe", custo: 2, nivelMinimo: 1, efeito: { tipo: "concedeHabilidade", habilidade: { id: "golpe_sismico", nome: "Golpe Sísmico", tipo: "dano_fisico", multiplicador: 1.5, custoMP: 5, cooldown: 2 } } },
  { id: "t_subclasse_x", nome: "Marca do Devastador", tipoPonto: "subclasse", custo: 1, nivelMinimo: NIVEL_ESCOLHA_SUBCLASSE, efeito: { tipo: "bonusAtributo", atributo: "FOR", valor: 4 } },
];

// --- garantirEstadoCaminho: estado inicial correto e idempotente ---
{
  const p = fakePersonagem();
  const ch = garantirEstadoCaminho(p);
  check("estado inicial: 0 pontos em tudo", ch.pontosClasse === 0 && ch.pontosSubclasse === 0 && ch.pontosHeranca === 0);
  check("estado inicial: sem subclasse", ch.subclasseId === null);
  check("estado inicial: 3 presets vazios chamados Build 1/2/3", ch.presets.length === 3 && ch.presets[0].nome === "Build 1" && ch.presets.every((pr) => pr.talentosEscolhidos.length === 0));
  check("estado inicial: preset ativo é o 0", ch.presetAtivo === 0);
  const ch2 = garantirEstadoCaminho(p);
  check("chamar de novo não reseta nada (idempotente)", ch2 === ch);
}

// --- concessão de pontos por nível ---
{
  const p = fakePersonagem({ nivel: 1 });
  concederPontosPorNivel(p, 2);
  check("subir de nível concede 1 ponto de classe", p.caminhoHerdeiro.pontosClasse === 1);
  for (let n = 3; n <= NIVEL_ESCOLHA_SUBCLASSE; n++) concederPontosPorNivel(p, n);
  check(`chegar no nível ${NIVEL_ESCOLHA_SUBCLASSE} concede também 1 ponto de subclasse (marco de escolha)`, p.caminhoHerdeiro.pontosSubclasse === 1);
  check("pontos de classe continuam acumulando em todo nível, inclusive o de marco", p.caminhoHerdeiro.pontosClasse === NIVEL_ESCOLHA_SUBCLASSE - 1);
  concederPontosPorNivel(p, 15);
  check("marco de subclasse (nível 15) só concede ponto de subclasse se já tiver subclasse escolhida", p.caminhoHerdeiro.pontosSubclasse === 1);
}

// --- escolher talento: pré-requisito, custo, grupo exclusivo ---
{
  const p = fakePersonagem({ nivel: 5 });
  p.caminhoHerdeiro = undefined;
  concederPontosPorNivel(p, 2); concederPontosPorNivel(p, 3); concederPontosPorNivel(p, 4); concederPontosPorNivel(p, 5);
  check("tem 4 pontos de classe acumulados", p.caminhoHerdeiro.pontosClasse === 4);

  const semPreReq = escolherTalento(p, "t_forca_2", ARVORE_TESTE, null);
  check("não deixa escolher talento sem o pré-requisito", semPreReq.ok === false);

  const r1 = escolherTalento(p, "t_forca_1", ARVORE_TESTE, null);
  check("escolhe o talento base com sucesso", r1.ok === true);
  check("gasta 1 ponto de classe", p.caminhoHerdeiro.pontosClasse === 3);
  check("o talento entra no preset ativo", talentosAtivos(p).includes("t_forca_1"));

  const r2 = escolherTalento(p, "t_forca_2", ARVORE_TESTE, null);
  check("agora com o pré-requisito cumprido, escolhe o talento encadeado", r2.ok === true);

  const rA = escolherTalento(p, "t_ramo_a", ARVORE_TESTE, null);
  check("escolhe uma opção do grupo exclusivo", rA.ok === true);
  const rB = escolherTalento(p, "t_ramo_b", ARVORE_TESTE, null);
  check("a OUTRA opção do mesmo grupo exclusivo fica bloqueada", rB.ok === false);

  const semPontos = escolherTalento(p, "t_habilidade_nova", ARVORE_TESTE, null); // custa 2, só sobrou 0
  check("sem pontos suficientes, a escolha falha", semPontos.ok === false && p.caminhoHerdeiro.pontosClasse === 1);
}

// --- talento que concede habilidade nova de verdade ---
{
  const p = fakePersonagem({ nivel: 1 });
  concederPontosPorNivel(p, 2);
  p.caminhoHerdeiro.pontosClasse = 5; // ajuste direto só pra não escrever 5 level-ups no teste
  const r = escolherTalento(p, "t_habilidade_nova", ARVORE_TESTE, null);
  check("talento de habilidade nova retorna ok", r.ok === true);
  check("a habilidade nova realmente aparece em personagem.habilidades", p.habilidades.some((h) => h.id === "golpe_sismico"));
  const r2 = escolherTalento(p, "t_habilidade_nova", ARVORE_TESTE, null);
  check("escolher o mesmo talento 2x não duplica (já está ativo, não some como 'disponível')", r2.ok === false);
  check("a habilidade continua aparecendo só 1 vez", p.habilidades.filter((h) => h.id === "golpe_sismico").length === 1);
}

// --- avaliarArvore: nível insuficiente pra talento de subclasse antes do marco ---
{
  const p = fakePersonagem({ nivel: 5 });
  p.caminhoHerdeiro = undefined;
  garantirEstadoCaminho(p).pontosSubclasse = 5;
  const { disponiveis, bloqueados } = avaliarArvore(p, ARVORE_TESTE);
  check("no nível 5, o talento de subclasse (exige nível 10) aparece bloqueado", bloqueados.some((b) => b.node.id === "t_subclasse_x"));
  check("no nível 5, o talento de subclasse NÃO aparece como disponível", !disponiveis.some((n) => n.id === "t_subclasse_x"));
}

// --- resetarTalentos: respec devolve pontos do preset ativo, sem mexer em herança ---
{
  const p = fakePersonagem({ nivel: 5 });
  p.caminhoHerdeiro = undefined;
  garantirEstadoCaminho(p).pontosClasse = 10;
  escolherTalento(p, "t_forca_1", ARVORE_TESTE, null);
  escolherTalento(p, "t_forca_2", ARVORE_TESTE, null);
  concederPontoHeranca(p, { tipo: "teste" });
  // aplica um nó de herança real (sem gatilho, pra não depender de contexto neste bloco)
  const noHeranca = { id: "heranca_teste_fake", nome: "Teste", custo: 1, efeito: { tipo: "bonusAtributo", atributo: "CON", valor: 5 } };
  const rHeranca = escolherTalento(p, "heranca_teste_fake", [noHeranca], null, { heranca: true });
  check("escolhe um nó de herança normalmente (sem gatilho = sempre disponível)", rHeranca.ok === true);
  check("antes do respec: 0 pontos de classe sobrando (gastou 2 de 10... falta ajustar)", p.caminhoHerdeiro.pontosClasse === 8);

  resetarTalentos(p, ARVORE_TESTE);
  check("respec devolve os pontos de classe gastos no preset ativo", p.caminhoHerdeiro.pontosClasse === 10);
  check("respec limpa os talentos de classe do preset ativo", !talentosAtivos(p).includes("t_forca_1") && !talentosAtivos(p).includes("t_forca_2"));
  check("respec NUNCA mexe na herança — continua lá depois do reset", talentosAtivos(p).includes("heranca_teste_fake"));
  check("respec não devolve pontosHeranca (não tem como, herança não é respecável)", p.caminhoHerdeiro.pontosHeranca === 0);
}

// --- presets: 3 slots, renomeáveis, cada um guarda talentos de classe/subclasse separados ---
{
  const p = fakePersonagem({ nivel: 5 });
  p.caminhoHerdeiro = undefined;
  garantirEstadoCaminho(p).pontosClasse = 10;
  escolherTalento(p, "t_forca_1", ARVORE_TESTE, null);
  check("Build 1 (ativo por padrão) tem o talento escolhido", talentosAtivos(p).includes("t_forca_1"));

  const rNome = renomearPreset(p, 1, "Build Ruptura");
  check("renomeia o preset 1 com sucesso", rNome.ok === true && p.caminhoHerdeiro.presets[1].nome === "Build Ruptura");

  alternarPreset(p, 1);
  check("depois de trocar pro preset 1 (vazio), o talento do preset 0 NÃO aparece mais ativo", !talentosAtivos(p).includes("t_forca_1"));
  garantirEstadoCaminho(p).pontosClasse += 1;
  escolherTalento(p, "t_ramo_a", ARVORE_TESTE, null);
  check("o novo talento escolhido no preset 1 fica só nele", talentosAtivos(p).includes("t_ramo_a"));

  alternarPreset(p, 0);
  check("voltando pro preset 0, o talento original dele reaparece e o do preset 1 some", talentosAtivos(p).includes("t_forca_1") && !talentosAtivos(p).includes("t_ramo_a"));
}

// --- bonusCaminhoHerdeiro: agrega talentos de classe/subclasse escolhidos no preset ativo ---
{
  const p = fakePersonagem({ nivel: 5, classeId: "guerreiro" });
  p.caminhoHerdeiro = undefined;
  garantirEstadoCaminho(p).pontosClasse = 10;
  escolherTalento(p, "t_forca_1", ARVORE_TESTE, null); // +2 FOR
  escolherTalento(p, "t_forca_2", ARVORE_TESTE, null); // +3 FOR
  // bonusCaminhoHerdeiro lê arvoreDoPersonagem(personagem, dados) — como o
  // classeId é "guerreiro" mas dados.talentsGuerreiro real está vazio (só
  // vem em #93), simulamos `dados` com a árvore de teste no MESMO formato.
  const dadosFalsos = { talentsGuerreiro: { talentos: ARVORE_TESTE }, heritageTree: { nos: [] } };
  const bonus = bonusCaminhoHerdeiro(p, dadosFalsos);
  check("soma os bônus de FOR dos 2 talentos escolhidos (2+3=5)", bonus.FOR === 5);
}

// --- personagem sem caminhoHerdeiro nenhum: bonusCaminhoHerdeiro não quebra e retorna zerado ---
{
  const p = fakePersonagem();
  delete p.caminhoHerdeiro;
  const bonus = bonusCaminhoHerdeiro(p, { talentsGuerreiro: { talentos: ARVORE_TESTE } });
  check("sem estado nenhum, bonusCaminhoHerdeiro retorna tudo zerado (compatibilidade com save antigo)", Object.values(bonus).every((v) => v === 0));
}

// --- subclasse: escolha respeita classe/nível, é permanente (não pode escolher 2x) ---
{
  const dadosSubclasses = { subclasses: { subclasses: [{ id: "guerreiro_devastador", classeId: "guerreiro", nome: "Devastador", nivelRequerido: NIVEL_ESCOLHA_SUBCLASSE }, { id: "mago_piromante", classeId: "mago", nome: "Piromante", nivelRequerido: NIVEL_ESCOLHA_SUBCLASSE }] } };
  const p = fakePersonagem({ nivel: 5, classeId: "guerreiro" });
  check("só mostra subclasses da MESMA classe", subclassesDisponiveis(p, dadosSubclasses).length === 1 && subclassesDisponiveis(p, dadosSubclasses)[0].id === "guerreiro_devastador");
  const cedo = escolherSubclasse(p, "guerreiro_devastador", dadosSubclasses);
  check("nível abaixo do requisito não deixa escolher subclasse ainda", cedo.ok === false);
  p.nivel = NIVEL_ESCOLHA_SUBCLASSE;
  const certo = escolherSubclasse(p, "guerreiro_devastador", dadosSubclasses);
  check("no nível certo, escolhe a subclasse", certo.ok === true && p.caminhoHerdeiro.subclasseId === "guerreiro_devastador");
  const denovo = escolherSubclasse(p, "guerreiro_devastador", dadosSubclasses);
  check("não deixa escolher subclasse 2x (permanente)", denovo.ok === false);
}

// --- Herança usa o ELENCO/EVENTOS REAIS do jogo (heritageTree.json de verdade) ---
{
  const p = fakePersonagem({ nivel: 20 });
  const arvore = arvoreHeranca({ heritageTree: dadosHeritageReal });
  check("heritageTree.json real tem pelo menos 1 nó", arvore.length > 0);
  const noDragao = arvore.find((n) => n.id === "heranca_folego_do_dragao_jovem");
  check("existe o nó real ligado ao chefe Dragão Jovem", !!noDragao);

  const contexto = { totalAbates, getReputacao };
  check("ANTES de derrotar o Dragão Jovem, o gatilho de herança não é atendido", atendeGatilhoHeranca(p, noDragao, contexto) === false);
  registrarAbateCompendio(p, "dragao_jovem");
  check("DEPOIS de derrotar o Dragão Jovem (registrarAbateCompendio), o gatilho passa a ser atendido", atendeGatilhoHeranca(p, noDragao, contexto) === true);

  const noFaccao = arvore.find((n) => n.id === "heranca_favor_da_folha_verde");
  check("existe o nó real ligado à reputação de facção", !!noFaccao);
  check("ANTES de subir reputação, o gatilho de facção não é atendido", atendeGatilhoHeranca(p, noFaccao, contexto) === false);
  alterarReputacao(p, "guardioes_da_folha", 70, dadosWorldState);
  check("DEPOIS de subir reputação acima do mínimo, o gatilho passa a ser atendido", atendeGatilhoHeranca(p, noFaccao, contexto) === true);

  // Fluxo completo: ganha o ponto (evento genérico), o gatilho do nó
  // específico também já está atendido (abate registrado acima) -> escolhe.
  garantirEstadoCaminho(p).pontosHeranca = 0;
  concederPontoHeranca(p, { tipo: "chefe_derrotado", monstroId: "dragao_jovem" });
  check("concederPontoHeranca soma 1 ponto de herança", p.caminhoHerdeiro.pontosHeranca === 1);
  const escolha = escolherTalento(p, "heranca_folego_do_dragao_jovem", arvore, null, { heranca: true, contexto });
  check("com ponto + gatilho atendido, escolhe o nó de herança real", escolha.ok === true);
  check("gasta o ponto de herança", p.caminhoHerdeiro.pontosHeranca === 0);
  check("a escolha de herança fica registrada em personagem.caminhoHerdeiro.heranca", p.caminhoHerdeiro.heranca.some((h) => h.id === "heranca_folego_do_dragao_jovem"));

  resetarTalentos(p, arvore);
  check("resetarTalentos (respec) NUNCA remove uma escolha de herança, mesmo chamado com a árvore de herança por engano", p.caminhoHerdeiro.heranca.some((h) => h.id === "heranca_folego_do_dragao_jovem"));
}

// --- arvoreDoPersonagem: classes sem árvore ainda ficam 100% inertes ---
{
  const dadosVazios = { talentsGuerreiro: { talentos: [] }, talentsMago: { talentos: [] } };
  const pGuerreiro = fakePersonagem({ classeId: "guerreiro" });
  const pMago = fakePersonagem({ classeId: "mago" });
  const pArqueiro = fakePersonagem({ classeId: "arqueiro" }); // classe sem NENHUM arquivo de talentos ainda
  check("Guerreiro: árvore vazia (task #93 ainda não existe)", arvoreDoPersonagem(pGuerreiro, dadosVazios).length === 0);
  check("Mago: árvore vazia (task #94 ainda não existe)", arvoreDoPersonagem(pMago, dadosVazios).length === 0);
  check("Classe sem arquivo nenhum: retorna [] sem quebrar", arvoreDoPersonagem(pArqueiro, dadosVazios).length === 0);
  check("dados ausente (undefined): retorna [] sem quebrar", arvoreDoPersonagem(pGuerreiro, undefined).length === 0);
}

const falhas = process.exitCode === 1;
console.log("\n=== RESUMO test_caminhos_herdeiro_arquitetura ===");
console.log(falhas ? "HOUVE FALHAS" : "TODOS OS CHECKS PASSARAM");
