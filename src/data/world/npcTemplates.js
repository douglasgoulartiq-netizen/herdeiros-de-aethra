// POPULAÇÃO SECUNDÁRIA (ETAPA 3, item 12) e DENSIDADE (item 40).
//
// Os 100 NPCs importantes têm ficha, nome e memória. O resto da população
// NÃO tem, e não deve ter: o item 41 proíbe dar schedule complexo a todo
// figurante, e o item 40 proíbe lotar cidade de NPC caro.
//
// Um figurante aqui é uma função pura de três coisas — template, semente e
// índice — e não existe até alguém olhar para ele. Nada disso vai para o
// save: o mesmo assentamento, na mesma semente, devolve sempre a mesma
// gente, então guardar seria guardar o que dá pra recalcular.
//
// DENSIDADE (item 23): mais gente perto de cidade, quase ninguém em
// território profundo. `porCategoria` é o orçamento de figurantes por
// categoria de assentamento, e é o teto que o teste de densidade verifica.
import { prngDe, inteiro, derivarSemente } from "../../systems/WorldSeed.js";

// Teto de figurantes simultâneos por assentamento. Bem abaixo do que o
// renderizador aguenta — o gargalo de verdade no mobile é o índice espacial
// por chunk, e figurante entra nele como qualquer objeto.
export const ORCAMENTO_FIGURANTES = {
  CAPITAL: 12,
  CIDADE: 8,
  VILA: 5,
  ASSENTAMENTO: 3,
  ACAMPAMENTO: 2,
};

// Fora de assentamento, no território aberto, o orçamento é este — e é por
// zona inteira, não por chunk.
export const FIGURANTES_EM_ZONA_ABERTA = 1;

// Cada template diz onde aquele tipo de gente aparece, o que faz em cada
// período do dia (rotina rasa: uma palavra, não um schedule), e o banco de
// falas de onde sai a linha dele. Falas curtas de propósito: figurante que
// discursa vira NPC importante mal feito.
export const TEMPLATES = {
  guarda: {
    nome: "Guarda",
    ondeAparece: ["CAPITAL", "CIDADE", "VILA"],
    sprite: "npc_guarda",
    rotina: { manha: "posto", tarde: "ronda", noite: "posto" },
    nomes: ["Aldo", "Brena", "Corvin", "Delia", "Ferro", "Halda", "Isen", "Mora", "Petro", "Runa"],
    falas: [
      "Circulando. Não é pessoal.",
      "Se ouvir sino três vezes, é para entrar em casa.",
      "Não sou eu que faço as regras. Sou eu que fico na chuva por causa delas.",
      "Já andou por aqui antes? Tenho memória boa pra rosto e ruim pra nome.",
    ],
    faccaoProvavel: { CAPITAL: "regional", CIDADE: "regional", VILA: "coroa_de_aethra" },
  },
  comerciante: {
    nome: "Comerciante",
    ondeAparece: ["CAPITAL", "CIDADE", "VILA", "ASSENTAMENTO"],
    sprite: "npc_mercador",
    rotina: { manha: "banca", tarde: "banca", noite: "fechado" },
    nomes: ["Bela", "Cato", "Dula", "Enno", "Girta", "Nemo", "Ossa", "Prim", "Talo", "Vira"],
    falas: [
      "Olha antes de perguntar o preço. Perguntar primeiro estraga a surpresa.",
      "Isso aí veio de longe. Longe encarece.",
      "Não vendo fiado. Vendo confiança, e confiança sai mais cara.",
      "Se você achar mais barato, compra lá e depois me conta onde.",
    ],
  },
  trabalhador: {
    nome: "Trabalhador",
    ondeAparece: ["CAPITAL", "CIDADE", "VILA", "ASSENTAMENTO", "ACAMPAMENTO"],
    sprite: "npc_fazendeiro",
    rotina: { manha: "servico", tarde: "servico", noite: "casa" },
    nomes: ["Arno", "Bruna", "Cleo", "Dario", "Efa", "Golo", "Ista", "Luro", "Neca", "Tomo"],
    falas: [
      "Se for ajudar, pega naquela ponta. Se não for, sai de perto que é pesado.",
      "Trabalho não acaba. Só troca de nome.",
      "Ontem estava pior. Amanhã, sei lá.",
      "Não me pergunta, pergunta a quem manda.",
    ],
  },
  viajante: {
    nome: "Viajante",
    ondeAparece: ["CAPITAL", "CIDADE", "VILA", "ASSENTAMENTO", "ZONA"],
    sprite: "npc_cacador",
    rotina: { manha: "estrada", tarde: "estrada", noite: "estalagem" },
    nomes: ["Arel", "Bode", "Cira", "Dorn", "Eska", "Fenn", "Jora", "Kel", "Sena", "Ulmo"],
    falas: [
      "Vim da estrada de baixo. Está pior do que dizem.",
      "Dois dias a pé. Não recomendo, mas também não desaconselho.",
      "Você vai pra onde? Pergunto porque talvez eu não devesse ir pra lá.",
      "Não conheço ninguém aqui. É por isso que gosto daqui.",
    ],
  },
  marinheiro: {
    nome: "Marinheiro",
    ondeAparece: ["CAPITAL", "CIDADE", "ACAMPAMENTO"],
    regioes: ["costa_da_mare", "recife_coralino", "arquipelago_de_nuvens"],
    sprite: "npc_cacador",
    rotina: { manha: "cais", tarde: "carga", noite: "taberna" },
    nomes: ["Bo", "Cru", "Falua", "Genta", "Iaro", "Maré", "Nato", "Reva", "Sula", "Vento"],
    falas: [
      "Maré vira às três. Depois disso é teimosia, não navegação.",
      "Casco novo, tripulação velha. É assim que funciona.",
      "Juro pelo farol. E eu não juro à toa.",
      "Quem chega, chega. Quem não chega, a gente conta na doca.",
    ],
  },
  mineiro: {
    nome: "Mineiro",
    ondeAparece: ["CIDADE", "ACAMPAMENTO", "ASSENTAMENTO"],
    regioes: ["montanhas_de_vulkor", "vale_dos_titas", "morranvell", "canon_rubro"],
    sprite: "npc_fazendeiro",
    rotina: { manha: "boca", tarde: "boca", noite: "barraca" },
    nomes: ["Broga", "Duni", "Fask", "Grima", "Hurn", "Kolla", "Morr", "Steg", "Torv", "Yara"],
    falas: [
      "Não desce sem alguém saber que você desceu.",
      "Turno de baixo hoje. Amanhã eu falo mais.",
      "Se a corda range, sobe. Não pensa, sobe.",
      "Pedra a gente conhece. Gente é que surpreende.",
    ],
  },
  cacador: {
    nome: "Caçador",
    ondeAparece: ["VILA", "ACAMPAMENTO", "ZONA"],
    regioes: ["altaverde", "selva_umbriaca", "bosque_eterno", "pantano_de_thalgor"],
    sprite: "npc_cacador",
    rotina: { manha: "mata", tarde: "mata", noite: "fogueira" },
    nomes: ["Ash", "Corda", "Erva", "Gralha", "Iva", "Lince", "Muta", "Ravo", "Tesso", "Uru"],
    falas: [
      "Passou bicho grande por aqui. Não hoje. Ontem.",
      "Anda mais devagar. Você faz barulho de carroça.",
      "Nomeia antes de atirar. É como se faz.",
      "Levo o que dá pra carregar e deixo o resto. Sempre foi assim.",
    ],
  },
  peregrino: {
    nome: "Peregrino",
    ondeAparece: ["ACAMPAMENTO", "ZONA"],
    regioes: ["vale_dos_titas", "lago_prismatico", "sombralith", "ruinas_de_aethra"],
    sprite: "npc_anciao",
    rotina: { manha: "marcha", tarde: "marcha", noite: "acampamento" },
    nomes: ["Alma", "Cendo", "Dova", "Erem", "Fio", "Halo", "Nara", "Osso", "Sela", "Vento"],
    falas: [
      "Não corro. Ninguém aqui corre.",
      "Ando desde antes de você nascer, e ainda falta.",
      "Se você tem pressa, passe na frente. Sem ofensa.",
      "Conta os passos. Ajuda mais do que parece.",
    ],
  },
};

export const TEMPLATES_IDS = Object.keys(TEMPLATES);

// Alguns lugares não aceitam qualquer figurante mesmo quando categoria e
// região permitiriam. No Vale dos Titãs, mineiro e peregrino não comem
// juntos — é o costume que separa as duas metades da região, e um mineiro
// gerado no acampamento dos peregrinos desmentiria a própria história que os
// NPCs importantes de lá contam. Exceção declarada, não sorteada.
export const SO_TEMPLATES = {
  acampamento_dos_peregrinos: ["peregrino", "viajante"],
  acampamento_dos_mineiros: ["mineiro", "trabalhador"],
  acampamento_dos_lenhadores: ["trabalhador", "cacador"],
  acampamento_dos_pescadores: ["marinheiro", "trabalhador"],
  posto_avancado_da_ordem: ["peregrino", "trabalhador", "viajante"],
};

// Quais templates cabem num assentamento — categoria manda, o filtro de
// região existe pra marinheiro não aparecer em mina e mineiro não aparecer
// em porto (o item 22 aplicado a gente em vez de bicho), e SO_TEMPLATES tem
// a última palavra onde o costume local for mais forte que a estatística.
export function templatesPara(categoria, regiaoId, localId) {
  const permitidos = TEMPLATES_IDS.filter((id) => {
    const t = TEMPLATES[id];
    if (!t.ondeAparece.includes(categoria)) return false;
    if (t.regioes && !t.regioes.includes(regiaoId)) return false;
    return true;
  });
  const restrito = localId && SO_TEMPLATES[localId];
  if (!restrito) return permitidos;
  const filtrado = restrito.filter((id) => TEMPLATES[id]);
  return filtrado.length ? filtrado : permitidos;
}

// Gera a população secundária de um lugar. Determinística: mesma semente +
// mesmo lugar = mesma gente, sempre. Nada aqui entra no save.
export function popularAssentamento(semente, assentamento, regiaoId) {
  const cat = assentamento.categoria || "ASSENTAMENTO";
  const teto = ORCAMENTO_FIGURANTES[cat] || 2;
  const permitidos = templatesPara(cat, regiaoId, assentamento.id);
  if (permitidos.length === 0) return [];
  const rnd = prngDe(derivarSemente(semente, `figurantes:${assentamento.id}`));
  const quantos = Math.max(1, teto - inteiro(rnd, 0, 2));
  const gente = [];
  for (let i = 0; i < quantos; i += 1) {
    const tid = permitidos[inteiro(rnd, 0, permitidos.length - 1)];
    const t = TEMPLATES[tid];
    gente.push({
      id: `fig_${assentamento.id}_${i}`,
      template: tid,
      nome: `${t.nomes[inteiro(rnd, 0, t.nomes.length - 1)]}, ${t.nome.toLowerCase()}`,
      sprite: t.sprite,
      falas: t.falas,
      rotina: t.rotina,
      figurante: true,
    });
  }
  return gente;
}

// A fala do figurante no momento: escolhida pelo período do dia, não
// sorteada a cada frame (senão ele "muda de opinião" enquanto o jogador
// olha). Determinística por figurante + período.
export function falaDoFigurante(figurante, horaId) {
  const banco = figurante.falas || [];
  if (banco.length === 0) return "...";
  const idx = Math.abs(hashLeve(`${figurante.id}:${horaId}`)) % banco.length;
  return banco[idx];
}

function hashLeve(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
