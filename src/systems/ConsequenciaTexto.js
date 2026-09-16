// Traduz o que uma quest mudou no mundo para uma frase que um jogador lê.
//
// POR QUE ISTO EXISTE. Ao concluir um passo de questline, a interface
// mostrava literalmente isto:
//
//   "A raiz que grita concluída. O mundo mudou: vila_aethra_estado →
//    provida; guardioes_da_folha +8"
//
// Isso é o dump de duas chaves de um objeto. O jogador acabou de escolher
// entre calar uma árvore de quatrocentos anos e deixar a vila com fome, e o
// que ele recebe de volta é sintaxe de banco de dados. A consequência
// existia no código e não existia na experiência — e uma consequência que o
// jogador não entende é, para todos os efeitos, uma consequência que não
// aconteceu.
//
// FORMATO. Cada chave de World State tem uma frase por valor. Chave sem
// verbete cai no fallback (`vulkor_arsenal: "auditado"` → "Vulkor arsenal:
// auditado"), que é feio mas legível, e nunca quebra — conteúdo novo pode
// entrar sem passar por aqui primeiro.
//
// O dicionário fica separado dos dados da quest de propósito: regionalQuests
// declara O QUE mudou (a chave e o valor, que outras mecânicas leem), e este
// arquivo diz COMO isso se conta. Misturar as duas coisas obrigaria a
// reescrever conteúdo toda vez que só o texto precisasse melhorar.

const FRASES = {
  vila_aethra_estado: {
    provida: "A Vila de Aethra volta a ter carne no defumadouro.",
    escassez: "A Vila de Aethra entra em mais uma estação contando grãos.",
  },
  altaverde_arvore: {
    muda: "A Árvore-Mãe emudece. Altaverde vai passar uma estação sem saber o que o bosque pensa.",
    inteira: "A Árvore-Mãe continua falando. O Círculo registra quem escolheu ouvi-la.",
  },
  morranvell_sucessao: {
    disputada: "Duas linhas de clã reivindicam o mesmo assento em Morranvell.",
    por_juramento: "A sucessão de Morranvell se resolve pela pedra do Salão — como sempre deveria.",
    imposta: "Vigdis fica com o assento sem que a pedra tenha confirmado nada.",
    resolvida: "A sucessão de Morranvell está resolvida.",
  },
  morranvell_mina: {
    aberta: "A Mina Alta reabre e o turno de baixo volta ao trabalho.",
    parada: "A Mina Alta segue parada, e ninguém explica por quê.",
  },
  bosque_licenca: {
    circulo: "A licença de corte passa ao Círculo. O acampamento encolhe e sobrevive.",
    coroa: "A licença de corte continua com a Coroa. O machado não para.",
    decidida: "A licença de corte tem dono.",
    conferida: "Alguém finalmente conferiu a licença de corte.",
  },
  bosque_portao: {
    aberto: "O Portão Verde continua passável.",
    fechado: "O Portão Verde fecha por dentro.",
  },
  ruinas_ordem: {
    exposta: "A Ordem perde o controle das máquinas — e a autoridade que vinha com ele.",
    intacta: "A Ordem continua sendo a única que atravessa as Ruínas em segurança.",
  },
  ruinas_acesso: {
    livre: "As Ruínas de Aethra ficam abertas a qualquer um que chegue.",
    controlado: "O acesso às Ruínas continua passando pela Ordem.",
  },
  canon_doutrina: {
    publica: "O texto original é lido em voz alta no Pátio das Provas.",
    guardada: "O texto original vai para as mãos da Arconte, e para de circular.",
    revisada: "A doutrina do Cânon Rubro é revista.",
    observada: "Alguém notou o que falta na doutrina do Cânon.",
  },
  canon_legiao: {
    dividida: "A Legião das Cinzas racha em duas, e as duas se dizem a original.",
    inteira: "A Legião das Cinzas continua inteira, e continua obedecendo.",
  },
  lago_barqueiro: {
    parado: "O barqueiro para de remar. A travessia do Lago Prismático fica sem barca.",
    remando: "O barqueiro atravessa mais uma manhã sem saber que ano é.",
  },
  lago_atraso: { medido: "O atraso do Lago Prismático foi medido.", grande: "O atraso do Lago é maior do que alguém admite." },
  cartas_de_maris: {
    selada: "O acervo é selado. A Costa continua dependendo de uma porta só.",
    publica: "As cartas de Maris circulam livres — metade delas com erro.",
    vazando: "Cópias das cartas de Maris começam a aparecer onde não deviam.",
  },
  thalgor_setor_leste: {
    submerso: "O charco avança sobre o setor leste de Thalgor.",
    habitado: "O setor leste de Thalgor continua de pé.",
  },
  thalgor_aldeia: { provida: "A aldeia do pântano come bem pela primeira vez em anos.", pobre: "A aldeia do pântano continua pobre." },
  arenth_agua: {
    vendida: "A água de Arenth passa a ter preço de mercadoria.",
    partilhada: "O poço de Arenth abre para quem chegar.",
    auditada: "Alguém finalmente conferiu de quem é a água de Arenth.",
  },
  arenth_rota: { segura: "A rota do deserto fica segura o ano inteiro.", exposta: "A rota do deserto volta a ser perigosa." },
  sombralith_registro: {
    restituido: "Nove pessoas voltam a existir no registro de Sombralith.",
    fechado: "Os nove continuam sem nome.",
    auditado: "O registro de Sombralith foi auditado.",
  },
  sombralith_corte: {
    reformada: "O prazo da Corte cai de quatro anos para seis meses.",
    intacta: "A Corte Sem Rosto segue exatamente como estava.",
  },
  nuvens_tratados: {
    renegociados: "Os tratados do Arquipélago são renegociados.",
    rejeitados: "A renegociação cai — mas cai registrada em ata, com nomes.",
    em_pauta: "A renegociação dos tratados entra na pauta da Assembleia.",
  },
  nuvens_assembleia: {
    registrada: "Fica em ata quem votou contra, e isso vai valer depois.",
    precedente: "Abre-se o precedente de que uma petição antiga vira qualquer votação.",
  },
  vulkor_despertar: {
    suspenso: "O despertar de armas é suspenso em Vulkor.",
    mantido: "A Assembleia mantém o despertar de armas.",
  },
  vulkor_forja: {
    reduzida: "A Forja perde dois terços das encomendas e um terço dos ferreiros.",
    plena: "A Forja continua a todo vapor.",
  },
  nazthal_carta: {
    levada: "A carta de Selia sai dos Confins.",
    ficou: "A carta fica na Nau. Os Confins continuam sendo o fim do mapa.",
  },
  nazthal_confins: {
    mapeados: "Em dois anos haverá rota até os Confins. Em cinco, porto.",
    fechados: "Os Confins continuam sendo um lugar de onde se volta diferente.",
  },
  aerwind_exilados: { contados: "Pela primeira vez, alguém contou quantos estão fora do muro.", com_prazo: "O exílio em Aerwind volta a ter prazo." },
  recife_estado: { vivo: "O recife volta a ter cor.", branqueado: "O recife branqueia." },
  coracao_petrificado_estado: { quente: "O Coração Petrificado volta a esquentar.", frio: "O Coração Petrificado esfria." },
  umbriaca_rito: { identificado: "O rito da Selva Umbríaca tem nome.", assinado: "O rito da Selva Umbríaca passa a ter testemunha." },
  thalgor_passarelas: { inteiras: "As passarelas do pântano continuam inteiras.", rompidas: "As passarelas do pântano se rompem." },
};

function frase(chave, valor) {
  const porValor = FRASES[chave];
  if (porValor && porValor[valor]) return porValor[valor];
  // Fallback: legível sem ser bonito, e nunca em branco.
  const k = chave.replace(/_/g, " ");
  return `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${String(valor).replace(/_/g, " ")}`;
}

function nomeFacao(facaoId, dadosWorldState) {
  const f = ((dadosWorldState && dadosWorldState.facoes) || []).find((x) => x.id === facaoId);
  return f ? `${f.icone ? f.icone + " " : ""}${f.nome}` : facaoId.replace(/_/g, " ");
}

// Transforma o objeto `mudou` devolvido por concluirQuestRegional numa lista
// de linhas prontas para exibir. Cada linha é { icone, texto } — a UI decide
// como desenhar. Ordem: primeiro o que mudou no mundo, depois quem passou a
// te dever (ou a te querer mal), depois o resto.
export function linhasDaConsequencia(mudou, dadosWorldState) {
  if (!mudou) return [];
  const linhas = [];

  Object.entries(mudou.worldState || {}).forEach(([chave, valor]) => {
    linhas.push({ icone: "🌍", texto: frase(chave, valor) });
  });

  // O qualificador é escrito sem verbo concordado com o nome da facção —
  // "Guardiões da Folha Verde" é plural e "Caravana de Karn" é singular, e
  // uma frase que precisasse concordar com os dois exigiria marcar gênero e
  // número de cada facção só para caber num aviso.
  Object.entries(mudou.faccao || {}).forEach(([facaoId, delta]) => {
    const forte = Math.abs(delta) >= 10;
    const qualificador = forte
      ? (delta > 0 ? "isso vale um favor mais adiante" : "isso não vai ser esquecido")
      : (delta > 0 ? "conta a seu favor" : "conta contra você");
    linhas.push({
      icone: delta > 0 ? "▲" : "▼",
      texto: `${nomeFacao(facaoId, dadosWorldState)}: ${delta > 0 ? "+" : ""}${delta} — ${qualificador}.`,
    });
  });

  if (typeof mudou.precoLoja === "number" && mudou.precoLoja !== 1) {
    linhas.push({
      icone: "🪙",
      texto: mudou.precoLoja < 1
        ? `Os preços da região caem ${Math.round((1 - mudou.precoLoja) * 100)}%.`
        : `Os preços da região sobem ${Math.round((mudou.precoLoja - 1) * 100)}%.`,
    });
  }

  (mudou.descobertas || []).forEach((id) => {
    linhas.push({ icone: "📍", texto: `${String(id).replace(/_/g, " ")} entra no seu mapa.` });
  });
  (mudou.rotas || []).forEach((id) => {
    linhas.push({ icone: "🧭", texto: `Uma rota nova se abre: ${String(id).replace(/_/g, " ")}.` });
  });
  (mudou.eventos || []).forEach((e) => {
    linhas.push({ icone: e.acao === "encerra" ? "🕊️" : "⚠️", texto: e.acao === "encerra" ? "Um evento em curso na região termina." : "Um evento novo começa na região." });
  });
  if ((mudou.npcs || []).length) {
    const n = mudou.npcs.length;
    linhas.push({ icone: "💬", texto: `${n} ${n === 1 ? "pessoa passa" : "pessoas passam"} a te tratar de outro jeito.` });
  }

  return linhas;
}

// Versão de uma linha só, para o aviso flutuante (mostrarMensagem), que não
// comporta uma lista. Pega o efeito mais importante e diz só ele.
export function resumoDaConsequencia(mudou, dadosWorldState) {
  const linhas = linhasDaConsequencia(mudou, dadosWorldState);
  if (!linhas.length) return "";
  return linhas[0].texto;
}
