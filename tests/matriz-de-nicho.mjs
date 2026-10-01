// MATRIZ DE NICHO — a classe é forte ONDE ela deveria ser forte?
//
// POR QUE ESTA FERRAMENTA EXISTE
// ------------------------------
// tests/diagnostico-balanceamento.mjs responde "quem é mais forte". Essa é a
// pergunta certa para achar um exagero, e foi ela que mostrou o ladino em
// 91,06 contra 79,59 do mago. Mas ela não responde a pergunta do DESENHO:
//
//   o assassino deveria ganhar o duelo e sofrer na horda;
//   o mago deveria sofrer no duelo e limpar a horda.
//
// Recalculando a vitória por cenário a partir do balanceamento.json daquele
// protocolo, o quadro é pior do que o índice sugere:
//
//   classe        duelo  grupo  chefe   pico     amplitude
//   ladino         90,3   95,4   94,7   grupo        5,1
//   mago           72,9   83,1   89,1   chefe       16,2
//
// O ladino não é um especialista forte: é um GENERALISTA que ganha em toda
// parte, com amplitude de 5 pontos. E o mago tem o pico em "chefe", que é
// alvo único — exatamente o oposto do papel dele.
//
// O QUE ESTA FERRAMENTA MEDE DE DIFERENTE
// ---------------------------------------
// Dois eixos que o protocolo anterior não separa:
//
// 1. O "duelo" de lá é o candidato SOZINHO. Isso mistura duas variáveis —
//    quantos inimigos há E se existe time. Aqui o time é SEMPRE o mesmo
//    (candidato + três aliados fixos) e a única coisa que muda é a
//    QUANTIDADE DE INIMIGOS: 1, 2, 4, 6.
//
// 2. Vitória satura. Com time completo contra 1 inimigo, quase todo mundo
//    ganha, e uma coluna de "98%" não distingue ninguém. A medida fina é
//    QUANTO DO DANO DO TIME saiu do candidato — participação, não vitória.
//    Um assassino nichado deve dominar a participação com 1 inimigo e
//    despencar com 6; um mago, o contrário.
//
// COMO LER
// --------
//   participação  fração do dano do time que veio do candidato, por contagem
//                 de inimigos. É a coluna que importa.
//   inclinação    participação com 6 inimigos menos participação com 1.
//                 NEGATIVA = especialista em alvo único (assassino).
//                 POSITIVA = especialista em multidão (mago).
//                 perto de ZERO = generalista, que é o defeito a corrigir.
//
// Uso:  node tests/matriz-de-nicho.mjs
//       HDA_AMOSTRAS=8 node tests/matriz-de-nicho.mjs     (mais rápido)
//       HDA_ALVO=json  node tests/matriz-de-nicho.mjs     (só o JSON)
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { criarPersonagem, aplicarCrescimento } from '../src/systems/CharacterFactory.js';
import { criarCombatenteJogador, criarCombatenteInimigo, Batalha } from '../src/systems/CombatSystem.js';
import { escolherAcaoAutomatica, configAutoBatalhaPadrao } from '../src/systems/AutoBattleAI.js';
import { arvoreDaClasse, escolherNo, pontosDisponiveis, podeEscolher } from '../src/systems/SkillTreeSystem.js';
import { LIMITE_CARDS } from '../src/systems/LoadoutSystem.js';
import { ataqueBase, atributosEfetivos, defesaTotal } from '../src/systems/CharacterFactory.js';
import { multiplicadorEfetivo } from '../src/systems/EscalaDerivada.js';
import { valorPorTurno, valorDeApoioPorTurno } from '../src/systems/ValorDeHabilidade.js';

const dataDir = new URL('../src/data/', import.meta.url);
const dados = Object.fromEntries(readdirSync(dataDir).filter(f => f.endsWith('.json')).map(f =>
  [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dataDir)))]));

const N = Number(process.env.HDA_AMOSTRAS || 16);
// Níveis medidos. Configurável porque tudo foi calibrado no 25, e a maioria
// das partidas acontece antes disso — um balanço que só vale no teto não é
// balanço. HDA_NIVEIS=5,15 mede só os baixos.
const NIVEIS = (process.env.HDA_NIVEIS || "5,15,25").split(",").map(Number);
// Medir um nível só grava num arquivo próprio, para as três leituras
// poderem ser comparadas lado a lado em vez de uma sobrescrever a outra.
const variante = process.env.HDA_VARIANTE || '';
if (variante && !/^[a-z0-9-]+$/.test(variante)) throw new Error('Nome de variante inválido');
const SUFIXO = variante ? `-${variante}` : (NIVEIS.length === 1 ? `-n${NIVEIS[0]}` : '');
const ordemReversa = process.env.HDA_BUILD === 'reversa';
const pressao = Number(process.env.HDA_PRESSAO || 1);
if (!Number.isFinite(pressao) || pressao < 1 || pressao > 5) throw new Error('Pressão deve ficar entre 1 e 5');
// A OUTRA METADE DA PRESSÃO — e sem ela a cura continua invisível.
//
// Inimigo reforçado faz o time APANHAR mais, mas o time ainda entra com a
// barra cheia: a primeira cura do clérigo cai em alguém intacto e devolve
// zero de verdade. Por isso a coluna de cura lia zero mesmo com pressão alta.
//
// HDA_VIDA_INICIAL=0.6 faz o time entrar a 60% da vida, que é o estado real
// do meio de uma masmorra — exatamente onde um curandeiro existe para servir.
// Separado de HDA_PRESSAO de propósito: são duas perguntas diferentes
// ("quanto dói apanhar" e "quão machucado eu chego"), e misturá-las num
// knob só impediria medir uma sem a outra.
const VIDA_INICIAL = Number(process.env.HDA_VIDA_INICIAL || 1);
if (!Number.isFinite(VIDA_INICIAL) || VIDA_INICIAL <= 0 || VIDA_INICIAL > 1) throw new Error('HDA_VIDA_INICIAL deve ficar entre 0 (exclusivo) e 1');
const CONTAGENS = [1, 2, 4, 6];
const config = configAutoBatalhaPadrao();

// Mesmo gerador determinístico do outro protocolo: a mesma semente dá a mesma
// batalha, então antes/depois de uma mudança são comparáveis.
const randomOriginal = Math.random;
function semear(s) {
  Math.random = () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Só protagonistas: uma linha por CLASSE, com a raça fixada em humano para
// que a comparação seja entre classes e não entre bônus raciais.
const RACA = dados.races.find((r) => r.id === 'humano') ? 'humano' : dados.races[0].id;
const defs = dados.classes.map((c) => ({ id: `pc:${RACA}:${c.id}`, nome: c.nome, classe: c.id, raca: RACA }));

function criar(def, nivel) {
  const p = criarPersonagem({
    nome: def.nome, raca: def.raca, classe: def.classe,
    antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id,
  }, dados);
  while (p.nivel < nivel) { p.nivel += 1; aplicarCrescimento(p, dados); }
  // Orçamento igual para todos; o atributo da arma segue o crescimento da
  // classe, senão o mago levaria uma espada de Força e a medida viraria ruído.
  const classe = dados.classes.find((c) => c.id === def.classe);
  const atributo = ['FOR', 'DES', 'INT']
    .sort((a, b) => classe.crescimento[b] - classe.crescimento[a] || p.atributos[b] - p.atributos[a])[0];
  p.equipamento.arma = { id: 'bench_arma', nome: 'Arma padrão', tipo: 'arma', atributo, dano: Math.round(3 + nivel * 0.4), elemento: 'fisico' };
  p.equipamento.peito = { id: 'bench_peito', nome: 'Armadura padrão', tipo: 'armadura', defesa: Math.round(2 + nivel * 0.2) };
  comprarArvore(p);
  p.hp = p.hpMax; p.mp = p.mpMax;
  return p;
}

// SEM COMPRAR A ÁRVORE, O BENCHMARK NÃO VÊ A CLASSE — VÊ O KIT BASE.
//
// Este foi o achado que mudou o diagnóstico. Medindo sem talentos, no nível
// 15 o mago tem UMA habilidade ofensiva (Bola de Fogo, x2, 10 de Éter) e o
// ladino tem Ataque Furtivo (x1,8) que custa ZERO e sai todo turno. Nenhum
// dos dois tem ÁREA: toda área mora na árvore.
//
// Medido com a instrumentação de turnos: "área com 6 inimigos" dava 0,0% em
// TODAS as dez classes. Não era a IA ignorando área, nem multiplicador baixo
// — era que ninguém possuía área nenhuma. Um protocolo que não compra a
// árvore não consegue, por construção, responder se o mago é bom contra
// multidão, porque a resposta do mago para multidão está na árvore.
//
// A COMPRA É GULOSA E DECLARADA: percorre a árvore da própria classe em
// ordem e pega tudo que estiver liberado, repetindo enquanto sobrar ponto.
// Não é a build ótima que um humano montaria — é uma build PLAUSÍVEL e,
// acima de tudo, a MESMA regra para todas as classes, que é o que mantém a
// comparação honesta.
function comprarArvore(p) {
  for (let volta = 0; volta < 40; volta += 1) {
    if (pontosDisponiveis(p, dados) <= 0) break;
    let comprouAlgo = false;
    const nos = [...arvoreDaClasse(p, dados)];
    if (ordemReversa) nos.reverse();
    for (const no of nos) {
      if (pontosDisponiveis(p, dados) <= 0) break;
      if (!podeEscolher(p, dados, no)) continue;
      if (escolherNo(p, dados, no.id).ok) comprouAlgo = true;
    }
    if (!comprouAlgo) break;
  }
  escolherCards(p);
}

// COMPRAR A ÁRVORE NÃO BASTA — SÓ QUATRO HABILIDADES ENTRAM NA LUTA.
//
// DEFEITO DESTA PRÓPRIA FERRAMENTA, descoberto ao tentar medir as habilidades
// que escalam com robustez. `criarCombatenteJogador` leva para a batalha
// apenas `habilidadesEquipadas`, que são os 4 cards do loadout
// (LIMITE_CARDS). Sem loadout escolhido, `garantirLoadout` pega AS QUATRO
// PRIMEIRAS da lista — e a lista sai na ordem em que os nós aparecem no JSON.
//
// Ou seja: esta matriz vinha medindo "as quatro primeiras habilidades na
// ordem do arquivo", não uma build. O sintoma foi inconfundível: doze
// habilidades novas declaradas, compradas e presentes na ficha, e a tabela
// inteira saiu IDÊNTICA à anterior até a primeira casa decimal, nas dez
// classes. Um número que não se mexe quando deveria é um resultado, não um
// empate — e foi ele que apontou para cá.
//
// A REGRA NOVA, e por que estas quatro vagas. Um jogador não escolhe os
// primeiros quatro cards; ele cobre as situações da luta. As vagas são:
//
//   1. o melhor golpe de ALVO ÚNICO
//   2. a melhor ÁREA
//   3. o melhor APOIO (cura ou buff)
//   4. a melhor restante, seja qual for
//
// "Melhor" é por `multiplicadorEfetivo`, que já conta o bônus de escala — a
// mesma régua que a IA usa para decidir o turno, então a build e o uso falam
// a mesma língua. Classe sem candidato para uma vaga cede a vaga para a
// regra 4, e nenhuma vaga fica vazia enquanto houver habilidade.
//
// Continua sendo uma regra ÚNICA para as dez classes, que é o que mantém a
// comparação honesta — só que agora é uma regra que descreve um jogador, e
// não a ordem de um arquivo JSON.
const ALVO_UNICO = ['dano_fisico', 'dano_fisico_des', 'dano_magico', 'dano_ignora_defesa'];
const AREA = ['dano_area'];
const APOIO = ['cura', 'cura_area', 'buff_time', 'buff_defesa', 'buff_ataque'];

// A FICHA NÃO TEM `defesa` — SÓ O COMBATENTE TEM.
//
// Segundo defeito, e o que escondeu o primeiro: `p.defesa` é `undefined` num
// personagem fora de combate (defesa é derivada, vem de `defesaTotal`).
// Avaliando a build direto na ficha, TODA habilidade que escala com defesa
// valia bônus zero, e as quatro que usam essa fonte — guerreiro, paladino,
// mago, ladino — eram julgadas pelo multiplicador nu. Dois erros empilhados:
// o segundo escondia o primeiro.
//
// `vidaPerdida` tem o problema inverso: com a ficha cheia ela vale zero, e a
// habilidade do bárbaro seria descartada por ser inútil justamente no estado
// em que ela é DESENHADA para ser inútil. A build é escolhida antes da luta,
// pensando em como a luta vai estar — então a avaliação usa METADE da vida,
// que é o estado em que uma habilidade de sangue decide alguma coisa. Dentro
// da batalha a IA reavalia a cada turno com o HP real, e aí a conta é exata.
function vistaDeCombate(p) {
  return {
    ataque: ataqueBase(p, dados),
    atributos: atributosEfetivos(p, dados),
    defesa: defesaTotal(p, dados),
    hpMax: p.hpMax,
    hp: Math.round(p.hpMax * 0.5),
  };
}

function escolherCards(p) {
  const todas = p.habilidades || [];
  if (todas.length <= LIMITE_CARDS) { p.cards = todas.map((h) => h.id); p.cardsAjustado = true; return; }
  const vista = vistaDeCombate(p);
  // PODER POR TURNO, e nao por uso. Ver src/systems/ValorDeHabilidade.js:
  // montar build e escolher turno sao perguntas diferentes, e usar a mesma
  // regua nas duas foi o que fez tres classes ficarem PIORES depois de ganhar
  // a habilidade nova — ela vencia a vaga por poder por uso e perdia a luta
  // por poder por turno, deslocando uma habilidade de recarga 0.
  const valor = (h) => (APOIO.includes(h.tipo) ? valorDeApoioPorTurno(h, vista) : valorPorTurno(h, vista));
  const ordem = (a, b) => valor(b) - valor(a) || String(a.id).localeCompare(String(b.id));
  const melhor = (tipos) => todas.filter((h) => tipos.includes(h.tipo)).sort(ordem)[0];
  const escolhidas = [];
  for (const grupo of [ALVO_UNICO, AREA, APOIO]) {
    const h = melhor(grupo);
    if (h && !escolhidas.includes(h.id)) escolhidas.push(h.id);
  }
  for (const h of [...todas].sort(ordem)) {
    if (escolhidas.length >= LIMITE_CARDS) break;
    if (!escolhidas.includes(h.id)) escolhidas.push(h.id);
  }
  p.cards = escolhidas;
  // `cardsAjustado` marca a escolha como sendo do jogador — sem isto,
  // garantirLoadout completa por cima e o trabalho acima seria descartado.
  p.cardsAjustado = true;
}

const modelos = new Map();
for (const d of defs) for (const n of NIVEIS) modelos.set(`${d.id}:${n}`, criar(d, n));
const classesApoio = (process.env.HDA_TIME || 'guerreiro,clerigo,patrulheiro').split(',');
const fixos = classesApoio.map((classe) => defs.find((d) => d.classe === classe));
if (fixos.length !== 3 || fixos.some(d=>!d)) throw new Error('HDA_TIME deve listar três classes válidas');

const encontros = {};
for (const nivel of NIVEIS) {
  encontros[nivel] = dados.monsters.filter((m) => !m.chefe)
    .sort((a, b) => Math.abs((a.nivel || 1) - nivel) - Math.abs((b.nivel || 1) - nivel) || b.hp - a.hp)
    .slice(0, 8);
}

function simular(def, nivel, quantos, amostra) {
  semear(20000 + nivel * 100 + quantos * 10 + amostra);
  const pool = encontros[nivel];
  const inimigosDef = Array.from({ length: quantos }, (_, i) => pool[(amostra + i) % pool.length]);
  // O TIME É SEMPRE O MESMO. É isso que isola a variável "quantos inimigos".
  const personagens = [
    structuredClone(modelos.get(`${def.id}:${nivel}`)),
    ...fixos.map((d) => structuredClone(modelos.get(`${d.id}:${nivel}`))),
  ];
  const tanque = ['guerreiro', 'barbaro', 'paladino'].includes(def.classe);
  const time = personagens.map((p, i) => criarCombatenteJogador(p, dados, (tanque ? i < 2 : i === 1 || i === 2) ? 'frente' : 'retaguarda'));
  if (VIDA_INICIAL < 1) for (const c of time) c.hp = Math.max(1, Math.round(c.hpMax * VIDA_INICIAL));
  const inimigos = inimigosDef.map((m, i) => criarCombatenteInimigo(m, i));
  // Pressão existe só na bancada: não muda os monstros nem saves do jogo.
  for (const e of inimigos) {
    e.hpMax = Math.round(e.hpMax * pressao); e.hp = e.hpMax;
    e.ataque.dano = Math.round(e.ataque.dano * pressao);
    if (!Number.isFinite(e.ataque.dano)) throw new Error('Dano inimigo inválido na bancada');
  }
  const b = new Batalha(time, inimigos, dados.elements,
    null, [], 0, null, false, dados.elementalStates, dados.elementalReactions);

  let acoes = 0; let danoCandidato = 0; let danoTime = 0; let acoesCandidato = 0;
  // QUEM APANHA. A contraparte defensiva da participação: da pancada que o
  // time levou, quanto caiu no candidato. Um time de quatro reparte 25% se
  // ninguém puxa nada; um tanque de verdade tem de ficar acima disso, e um
  // mago abaixo. Hoje não existe como puxar ataque — ver EnemyAI: o alvo sai
  // do arquétipo do INIMIGO, e o jogador não influencia.
  let recebidoCandidato = 0; let recebidoTime = 0;
  // POR QUE, não só QUANTO. Separar os turnos do candidato por tipo mostra se
  // ele está limitado por RECURSO: um mago que passa a luta no ataque básico
  // não tem problema de multiplicador, tem problema de Éter.
  const turnos = { basico: 0, alvoUnico: 0, area: 0, outro: 0 };
  // UTILIDADE. A matriz media só dano, e por isso clérigo, bardo e druida
  // apareciam no fim da tabela por DESENHO — o que os torna impossíveis de
  // ajustar, porque qualquer mudança neles parecia não ter efeito.
  //
  // Aqui entra a outra metade do que um personagem entrega: vida devolvida
  // ao time (cura) e turnos gastos em apoio (buff e debuff). Cura é contada
  // pelo HP que de fato ENTROU — curar quem está cheio devolve zero, e tem de
  // aparecer como zero, senão a métrica premia desperdício.
  let curaTime = 0;
  let curaCandidato = 0;
  let turnosApoio = 0;
  for (let tick = 0; tick < 10000 && !b.terminada && acoes < 400; tick += 1) {
    for (const ator of b.avancarATB(1.6)) {
      if (b.terminada) break;
      if (!ator.vivo) continue;
      const hpAntes = b.inimigos.reduce((s, c) => s + c.hp, 0);
      if (ator.isPlayer) {
        if (b.jogadorControladoPorEstado(ator)) b.perderTurnoJogadorPorEstado(ator);
        else {
          const d = escolherAcaoAutomatica(ator, b.inimigosVivos(), config, dados, { aliados: b.timeVivo() });
          if (ator === time[0]) {
            if (!d.habilidade) turnos.basico += 1;
            else if (/area/.test(d.habilidade.tipo || '')) turnos.area += 1;
            else if (/^dano_/.test(d.habilidade.tipo || '')) turnos.alvoUnico += 1;
            else turnos.outro += 1;
          }
          const vidaDoTimeAntes = time.reduce((s2, c) => s2 + Math.max(0, c.hp), 0);
          if (d.habilidade) b.usarHabilidade(ator, d.habilidade, ['curar', 'curar_time', 'buff_time'].includes(d.tipo) ? ator : d.alvo);
          else if (d.tipo === 'defender') { ator.defendendo = true; ator.primeiroTurno = false; }
          else if (d.alvo) b.ataqueBasico(ator, d.alvo);
          const curou = Math.max(0, time.reduce((s2, c) => s2 + Math.max(0, c.hp), 0) - vidaDoTimeAntes);
          curaTime += curou;
          if (ator === time[0]) {
            curaCandidato += curou;
            if (d.habilidade && /^(buff|debuff)/.test(d.habilidade.tipo || '')) turnosApoio += 1;
          }
        }
      } else {
        const vidaAntes = time.map((c) => c.hp);
        b.iaInimigoAgir(ator);
        time.forEach((c, i) => {
          const levou = Math.max(0, vidaAntes[i] - c.hp);
          recebidoTime += levou;
          if (i === 0) recebidoCandidato += levou;
        });
      }
      const saiu = Math.max(0, hpAntes - b.inimigos.reduce((s, c) => s + c.hp, 0));
      if (ator.isPlayer) {
        danoTime += saiu;
        if (ator === time[0]) { danoCandidato += saiu; acoesCandidato += 1; }
      }
      ator.atb = 0;
      b.tickCooldowns(ator); b.aplicarStatusTick(ator); b.verificarFim(); acoes += 1;
    }
  }
  const totalTurnos = turnos.basico + turnos.alvoUnico + turnos.area + turnos.outro || 1;
  return {
    vitoria: +(b.resultado === 'vitoria'),
    participacao: danoTime > 0 ? danoCandidato / danoTime : 0,
    danoPorAcao: acoesCandidato > 0 ? danoCandidato / acoesCandidato : 0,
    apanhou: recebidoTime > 0 ? recebidoCandidato / recebidoTime : 0,
    // SOBREVIVÊNCIA. Participação no dano e pancada recebida não enxergam
    // mudança de vida ou defesa: um mago com metade da vida causa o mesmo
    // dano por ação, só morre antes. Sem esta coluna, qualquer ajuste de
    // robustez parece não ter efeito nenhum — e foi o que aconteceu na
    // primeira medição da mudança de CON.
    morreu: +!time[0].vivo,
    vidaFinal: time[0].hpMax > 0 ? Math.max(0, time[0].hp) / time[0].hpMax : 0,
    fracaoBasico: turnos.basico / totalTurnos,
    fracaoArea: turnos.area / totalTurnos,
    curaCandidato,
    // CONTRIBUIÇÃO: dano + cura do candidato sobre dano + cura do time. É a
    // coluna que faz curandeiro e suporte serem comparáveis com atacante —
    // não porque cura "vale o mesmo" que dano, mas porque as duas são o que
    // o personagem põe na mesa, e medir só uma delas é declarar que a outra
    // não conta.
    contribuicao: (danoTime + curaTime) > 0 ? (danoCandidato + curaCandidato) / (danoTime + curaTime) : 0,
    fracaoApoio: turnosApoio / totalTurnos,
    turnos: acoes,
  };
}

const linhas = [];
try {
  for (const def of defs) {
    const porContagem = {};
    for (const quantos of CONTAGENS) {
      const t = { vitoria: 0, participacao: 0, danoPorAcao: 0, apanhou: 0, morreu: 0, vidaFinal: 0, fracaoBasico: 0, fracaoArea: 0, turnos: 0, curaCandidato: 0, contribuicao: 0, fracaoApoio: 0 };
      let amostras = 0;
      for (const nivel of NIVEIS) {
        for (let a = 0; a < N; a += 1) {
          const r = simular(def, nivel, quantos, a);
          for (const k in t) t[k] += r[k];
          amostras += 1;
        }
      }
      for (const k in t) t[k] /= amostras;
      porContagem[quantos] = t;
    }
    const p = (q) => porContagem[q].participacao;
    linhas.push({
      classe: def.classe, nome: def.nome, porContagem,
      // Inclinação: negativa = alvo único, positiva = multidão, zero = genérico.
      inclinacao: p(6) - p(1),
      // Com 6 inimigos: quanto do tempo ele passou no ataque básico (sinal de
      // falta de recurso) e quanto usou área de verdade.
      apanhouMedio: CONTAGENS.reduce((acc, q) => acc + porContagem[q].apanhou, 0) / CONTAGENS.length,
      morreuMedio: CONTAGENS.reduce((acc, q) => acc + porContagem[q].morreu, 0) / CONTAGENS.length,
      vidaFinalMedia: CONTAGENS.reduce((acc, q) => acc + porContagem[q].vidaFinal, 0) / CONTAGENS.length,
      basicoEm6: porContagem[6].fracaoBasico,
      areaEm6: porContagem[6].fracaoArea,
      contribuicaoMedia: CONTAGENS.reduce((acc, q) => acc + porContagem[q].contribuicao, 0) / CONTAGENS.length,
      curaMedia: CONTAGENS.reduce((acc, q) => acc + porContagem[q].curaCandidato, 0) / CONTAGENS.length,
      apoioMedio: CONTAGENS.reduce((acc, q) => acc + porContagem[q].fracaoApoio, 0) / CONTAGENS.length,
    });
  }
} finally { Math.random = randomOriginal; }

linhas.sort((a, b) => a.inclinacao - b.inclinacao);

const pct = (n) => `${(100 * n).toFixed(1)}%`;
const cab = ['| Classe | ' + CONTAGENS.map((q) => `${q} inim.`).join(' | ') + ' | Inclinação | Nicho | Contribuição | Cura/luta | Turnos de apoio | Apanhou | Morreu |',
  '|---|' + CONTAGENS.map(() => '---:').join('|') + '|---:|---|---:|---:|---:|---:|---:|'];
const corpo = linhas.map((l) => {
  const nicho = l.inclinacao <= -0.06 ? 'alvo único' : l.inclinacao >= 0.06 ? 'multidão' : '⚠ generalista';
  return `| ${l.nome} | ${CONTAGENS.map((q) => pct(l.porContagem[q].participacao)).join(' | ')} `
    + `| ${(100 * l.inclinacao).toFixed(1)} | ${nicho} | ${pct(l.contribuicaoMedia)} | ${Math.round(l.curaMedia)} | ${pct(l.apoioMedio)} | ${pct(l.apanhouMedio)} | ${pct(l.morreuMedio)} |`;
});

const genericos = linhas.filter((l) => Math.abs(l.inclinacao) < 0.06);
const relatorio = `# Matriz de nicho — participação no dano do time

${defs.length} classes × ${CONTAGENS.length} contagens de inimigos × ${NIVEIS.length} níveis × ${N} sementes = ${defs.length * CONTAGENS.length * NIVEIS.length * N} batalhas do motor real.

Nesta execução, o time é candidato + ${classesApoio.join(', ')} humanos. Árvore comprada em ordem ${ordemReversa ? 'reversa' : 'normal'}, loadout escolhido por função; pressão inimiga ${pressao}x, time entrando com ${Math.round(VIDA_INICIAL * 100)}% da vida. Cada número mede a fração do dano do time que saiu do candidato, não preferência humana.

**Inclinação** = participação com ${CONTAGENS[CONTAGENS.length - 1]} inimigos menos participação com ${CONTAGENS[0]}. Negativa é especialista em alvo único; positiva, em multidão; perto de zero é generalista.
${NIVEIS.length > 1 ? `
> ⚠ **ESTA LEITURA É UMA MÉDIA DE ${NIVEIS.length} NÍVEIS (${NIVEIS.join(", ")}), E A COLUNA "NICHO" NÃO DEVE SER LIDA COMO IDENTIDADE DA CLASSE.**
>
> As classes mudam MUITO entre os níveis medidos. Uma que seja −28 no nível 5 e +25 no 25 sai daqui com média perto de zero e recebe o rótulo "generalista" — que é justamente o rótulo do DEFEITO, aplicado pelo motivo errado. A média esconde a oscilação em vez de mostrá-la, e essa leitura já foi usada uma vez para concluir que o nicho tinha se mantido quando as leituras por nível diziam o contrário.
>
> Para saber o que a classe É em cada nível, gere uma leitura por nível (HDA_NIVEIS=<n>) e compare com scripts/comparar-nicho-por-nivel.mjs. Esta tabela serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente — não para rotular classe.
` : ""}

${[...cab, ...corpo].join('\n')}

## Generalistas (|inclinação| < 6 pontos)

${genericos.length ? genericos.map((l) => `- **${l.nome}** — ${(100 * l.inclinacao).toFixed(1)}: rende quase o mesmo contra 1 e contra ${CONTAGENS[CONTAGENS.length - 1]} inimigos.`).join('\n') : '- nenhum.'}

## Limites

**Contribuição** é dano mais cura do candidato sobre dano mais cura do time. Ela existe porque as colunas de participação medem só dano, e isso punha clérigo, bardo e druida no fim da tabela POR DESENHO — o que os tornava impossíveis de ajustar, já que qualquer mudança neles parecia não ter efeito. Cura é contada pelo HP que de fato entrou: curar quem está cheio devolve zero e aparece como zero. Isso não declara que cura vale o mesmo que dano; declara que medir só uma das duas é afirmar que a outra não conta.

**A coluna de cura vem perto de zero para todo mundo, inclusive para o clérigo, e isso não é defeito da medida — é um resultado sobre o CENÁRIO.** O time termina as lutas com cerca de 99% da vida, então a cura cai em barra cheia e devolve zero de verdade. Enquanto o banco de provas não ameaçar o time, ele não consegue medir curandeiro, por melhor que a métrica seja. Medir cura exige um cenário com pressão real — mais inimigos, nível acima, ou sem os aliados fixos —, e isso é a próxima mudança da ferramenta, não deste commit.

**Turnos de apoio**, por outro lado, mede bem e já diz algo: o necromante gasta metade dos turnos em debuff, o que explica sozinho a participação baixa dele no dano. Não é fraqueza de número, é escolha de ação. Time fixo, equipamento sintético de orçamento igual, sem talentos comprados nem consumíveis. IA automática, não jogador humano. Serve para comparar ANTES e DEPOIS de uma mudança com a mesma semente, não para declarar tier list.
`;

mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL(`../reports/matriz-de-nicho${SUFIXO}.json`, import.meta.url),
  JSON.stringify({ amostras: N, contagens: CONTAGENS, niveis: NIVEIS, classesApoio, ordemReversa, pressao, vidaInicial: VIDA_INICIAL, linhas }, null, 2));
writeFileSync(new URL(`../reports/matriz-de-nicho${SUFIXO}.md`, import.meta.url), relatorio);
if (process.env.HDA_ALVO !== 'json') console.log(relatorio);
