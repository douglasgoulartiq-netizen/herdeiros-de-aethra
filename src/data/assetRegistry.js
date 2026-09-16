// REGISTRO DE ASSETS — o único lugar do jogo que sabe onde mora cada imagem.
//
// POR QUE ISTO EXISTE
// -------------------
// Até agora cada tela montava o caminho na mão, cada uma do seu jeito:
//
//   loader.js      `assets/sprites/${key}.png`
//   BattleUI.js    `assets/sprites_hd/retrato_${raca}_${classe}.png`
//   GachaUI.js     `assets/sprites/gacha_${id}.png`
//
// Enquanto existe uma arte só, isso funciona. No dia em que chega a arte
// nova — pasta diferente, tamanho diferente, um pôster que a antiga não
// tinha — seria preciso caçar cada template espalhado em cada arquivo de
// UI, e qualquer um esquecido vira imagem quebrada em produção.
//
// Aqui o caminho deixa de ser texto colado no meio do HTML e vira uma
// PERGUNTA: "qual imagem eu uso pro monstro X no combate?". A resposta é
// uma LISTA em ordem de preferência, não um caminho só — quem desenha
// tenta o primeiro, e se faltar cai pro seguinte sozinho.
//
// Este módulo é puro de propósito: nenhum DOM, nenhum fetch, nada de
// Image(). Só texto entra e sai. Assim ele roda no Node sem navegador e o
// teste da tubulação não precisa subir o Chromium pra conferir uma regra
// de caminho.
import { FLAGS } from "./featureFlags.js";

// Onde a arte nova vai morar. Pasta separada de propósito: a arte atual
// NUNCA é sobrescrita, então dá pra ligar e desligar a nova sem perder a
// antiga, e pra comparar as duas lado a lado numa batalha só.
export const PASTA_V2 = "assets/arte_v2";
export const PASTA_ATUAL = "assets/sprites";
export const PASTA_HD = "assets/sprites_hd";

// Os quatro jeitos de mostrar a mesma criatura. O uso decide o arquivo e
// o tamanho — é por isso que ele é parâmetro, e não uma segunda função.
export const USOS = {
  COMBATE: "combate", // forma reduzida, dentro do slot da batalha
  RETRATO: "retrato", // cabeça/busto: coleção do gacha, ordem de turno
  POSTER: "poster", // corpo inteiro com cenário: bestiário
  MAPA: "mapa", // marcador no canvas do mundo (pré-carregado pelo loader)
};

// Tamanho que a arte nova precisa ter em cada uso. Estes números não são
// gosto: saíram da medição dos slots reais (scripts/medir-layout-batalha.mjs)
// multiplicados pelo DPR de celular, que é onde o pixel é mais apertado.
// São os MESMOS números que foram para os briefings — se um dia divergirem,
// o validador acusa, porque ele lê daqui.
export const TAMANHO_ALVO = {
  [USOS.COMBATE]: { comum: 192, chefe: 256 },
  [USOS.RETRATO]: { comum: 64, chefe: 64 },
  [USOS.POSTER]: { comum: [1024, 1536], chefe: [1024, 1536] },
  [USOS.MAPA]: { comum: 32, chefe: 32 },
};

// Sufixo do arquivo na arte nova, por uso. O combate fica sem sufixo
// porque é a imagem principal — foi assim que os briefings pediram, e o
// nome do arquivo é contrato: ele é a chave que já está gravada dentro
// dos saves dos jogadores.
const SUFIXO_V2 = {
  [USOS.COMBATE]: "",
  [USOS.RETRATO]: "_icon",
  [USOS.POSTER]: "_portrait",
  [USOS.MAPA]: "",
};

// Os 9 retratos genéricos que já existem em sprites_hd/. Não cobrem os 66
// monstros — cobrem FAMÍLIAS. Um lobo gélido continua sendo um lobo, e um
// retrato de lobo é infinitamente melhor do que o emoji 👹 que a ordem de
// turno mostra hoje. A tabela é explícita porque adivinhar por substring
// solto erraria: "lodo negro" contém "lo", não é um lobo.
const FAMILIA_GENERICA = {
  aranha: ["aranha"],
  bandido: ["bandido", "pirata", "capita", "carrasco"],
  dragao: ["dragao", "wyvern", "grifo"],
  esqueleto: ["esqueleto", "rei_petrificado", "cavaleiro_caido"],
  goblin: ["goblin"],
  lobo: ["lobo"],
  morcego: ["morcego", "corvo", "gralha", "harpia", "abelha"],
  orc: ["orc", "troll", "ogro"],
  slime: ["slime", "lodo"],
};

// Descobre a família de um monstro pela chave do sprite. Devolve null
// quando não reconhece — e null aqui é resposta honesta, não erro: o
// chamador cai no próximo candidato em vez de mostrar um lobo no lugar
// de um golem.
export function familiaGenerica(chave) {
  const nome = String(chave || "").replace(/^mob_/, "");
  const achou = Object.entries(FAMILIA_GENERICA)
    .find(([, pistas]) => pistas.some((p) => nome.includes(p)));
  return achou ? achou[0] : null;
}

// A chave de um alvo — o nome do arquivo sem pasta e sem extensão.
//
// É aqui que mora a única regra de nomenclatura do jogo. Note que ela NÃO
// inventa nada: para monstro ela usa o campo `sprite` que já está no
// monsters.json, exatamente como o loader sempre usou.
export function chaveDe(alvo) {
  if (!alvo) return null;
  if (typeof alvo === "string") return alvo;

  // Monstro traz a chave pronta do JSON — respeitar isso é o que mantém
  // saves antigos válidos.
  if (alvo.sprite) return String(alvo.sprite).replace(/\.png$/i, "");

  // Personagem principal: a combinação raça+classe é a identidade visual.
  if (alvo.racaId && alvo.classeId) return `pc_${alvo.racaId}_${alvo.classeId}`;

  // Convocado do gacha.
  if (alvo.rosterId) return `gacha_${alvo.rosterId}`;

  // Último recurso: um id cru com o prefixo do tipo.
  if (alvo.id && alvo.tipo) return `${alvo.tipo}_${alvo.id}`;
  if (alvo.id) return String(alvo.id);
  return null;
}

// Diz se o alvo é chefe. Só muda o TAMANHO esperado da arte, nunca o
// caminho — chefe e criatura comum moram na mesma pasta.
export function ehChefe(alvo) {
  return !!(alvo && (alvo.chefe || alvo.ehChefe || alvo.tier === "chefe"));
}

// A pergunta principal: quais imagens servem, em ordem de preferência.
//
// Devolve SEMPRE um array (possivelmente vazio). Nunca lança. Quem
// desenha percorre a lista; o primeiro arquivo que existir é o que
// aparece. Lista vazia significa "não tenho imagem nenhuma pra isso" — e
// aí o desenho usa o placeholder, que é decisão de UI, não daqui.
export function candidatos(alvo, uso = USOS.COMBATE, opcoes = {}) {
  const chave = chaveDe(alvo);
  if (!chave) return [];

  // A flag pode ser forçada por chamada. É isso que permite ligar a arte
  // nova em UM encontro pra comparar, sem virar o jogo inteiro de uma vez.
  const v2 = opcoes.arteV2 === undefined ? !!FLAGS.arteV2 : !!opcoes.arteV2;
  const lista = [];

  if (v2) {
    const sufixo = SUFIXO_V2[uso] || "";
    lista.push(`${PASTA_V2}/${chave}${sufixo}.png`);
    // Se o uso específico ainda não foi desenhado (o pôster costuma ficar
    // pra depois), a arte nova de combate já é melhor que a antiga.
    if (sufixo) lista.push(`${PASTA_V2}/${chave}.png`);
  }

  // Camada atual. Retrato de personagem tem arquivo próprio em sprites_hd —
  // é a única exceção de pasta, e ela existe desde antes deste registro.
  if (uso === USOS.RETRATO && chave.startsWith("pc_")) {
    lista.push(`${PASTA_HD}/retrato_${chave.slice(3)}.png`);
  }
  lista.push(`${PASTA_ATUAL}/${chave}.png`);

  // Retrato genérico por família, só pra monstro e só como penúltimo
  // recurso: melhor um lobo genérico do que um emoji.
  if (uso === USOS.RETRATO && chave.startsWith("mob_")) {
    const fam = familiaGenerica(chave);
    if (fam) lista.push(`${PASTA_HD}/retrato_monstro_${fam}.png`);
  }

  // Sem duplicatas: a mesma URL duas vezes na cadeia faz o navegador
  // pedir de novo um arquivo que já falhou.
  return [...new Set(lista)];
}

// Atalho para quem só quer o melhor caminho e trata a falta por conta
// própria (o canvas do mapa, por exemplo, que já tem placeholder próprio).
export function melhorCaminho(alvo, uso = USOS.COMBATE, opcoes = {}) {
  return candidatos(alvo, uso, opcoes)[0] || null;
}

// O tamanho que a arte deste alvo deveria ter, neste uso. Usado pelo
// validador e pelos briefings — uma fonte só, para os dois não brigarem.
export function tamanhoEsperado(alvo, uso = USOS.COMBATE) {
  const t = TAMANHO_ALVO[uso];
  if (!t) return null;
  const v = ehChefe(alvo) ? t.chefe : t.comum;
  return Array.isArray(v) ? { largura: v[0], altura: v[1] } : { largura: v, altura: v };
}
