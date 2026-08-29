// Vínculo de campanheirismo (melhoria de jogabilidade pós-backlog original):
// cenas narrativas curtas entre o herói (personagem principal) e cada
// convocado do gacha, desbloqueadas por marcos de NÍVEL do próprio
// convocado (ver LIMIARES_VINCULO) — 3 tiers ao todo. Cada cena oferece uma
// escolha de TOM (mais caloroso ou mais reservado) que é só narrativa: as
// duas opções concedem exatamente o mesmo bônus mecânico, nunca uma
// vantagem de poder por "escolher certo" (guardrail do jogo: não
// recompensar somente poder bruto; oferecer expressão, sinergia, descoberta
// e história). O bônus acumulado entra na mesma composição de bonusTotal()
// usada por árvore de habilidades e afinidade racial (ver
// CharacterFactory.js) — vale automaticamente em atributos/defesa/HP/MP/
// crítico sem duplicar nenhuma lógica de aplicação, só precisa registrar a
// escolha (ver bonusVinculo, importado por CharacterFactory.js).
//
// Diferente de AffinitySystem.js (afinidade RAÇA+CLASSE, estático, nunca
// evolui) e de AwakeningSystem.js (Despertar de Arma Secreta — narrativa
// sobre o EQUIPAMENTO do convocado, não sobre a relação dele com o herói):
// vínculo é sobre a relação interpessoal, evolui com o tempo jogado, e é o
// único desses três sistemas que dá ao jogador uma escolha real (de tom,
// não de poder).
//
// IMPORTANTE: este arquivo nunca importa de CharacterFactory.js (só o
// contrário acontece) — evita import circular, já que CharacterFactory.js
// importa bonusVinculo daqui pra somar em bonusTotal(). O recálculo de
// hp/mpMax após um tier ser completado (quando o bônus inclui
// hpMaxPercent/mpMaxPercent) é responsabilidade de quem chama
// escolherTomVinculo (ver BondUI.js), exatamente como aplicarEscolhaArvore
// faz internamente em CharacterFactory.js pro ramo passivo da árvore.

export const LIMIARES_VINCULO = [3, 7, 12];

const BONUS_VAZIO = { FOR: 0, DES: 0, CON: 0, INT: 0, hpMaxPercent: 0, mpMaxPercent: 0, critChance: 0, defesaFlat: 0 };

const BONUS_POR_TIER = [
  { ...BONUS_VAZIO, CON: 1 },
  { ...BONUS_VAZIO, critChance: 0.02 },
  { ...BONUS_VAZIO, hpMaxPercent: 0.03 },
];

const TOM_CALOROSO = "caloroso";
const TOM_RESERVADO = "reservado";

// 6 classes x 3 tiers = 18 cenas. `texto`/`resposta` usam os placeholders
// {nome} (convocado) e {heroi} (personagem principal), substituídos em
// cenaVinculo() na hora de exibir — nunca guardados já resolvidos, pra não
// precisar reprocessar nada se o jogador trocar de personagem principal
// (ex.: New Game+).
const TEMPLATES_VINCULO = {
  guerreiro: [
    {
      titulo: "Primeiras Impressões",
      texto: "{nome} limpa a lâmina em silêncio depois da batalha e nota que {heroi} ainda está por perto. \"Lutou bem hoje\", diz, sem tirar os olhos da lâmina. É o tipo de elogio que não se repete fácil.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Retribuir o elogio", resposta: "{heroi} sorri e devolve o elogio sem cerimônia — {nome} pisca, pega de surpresa, e um sorriso pequeno escapa antes que consiga escondê-lo." },
        { id: TOM_RESERVADO, rotulo: "Só acenar com a cabeça", resposta: "{heroi} aceita o elogio com um aceno simples. {nome} entende — palavras não são o forte de nenhum dos dois — e volta a cuidar da arma, satisfeita(o) com o silêncio compartilhado." },
      ],
    },
    {
      titulo: "A Cicatriz",
      texto: "Enquanto descansam no acampamento, {nome} mostra uma cicatriz antiga no braço. \"Foi o preço de uma lição que não esqueci\", diz, sem entrar em detalhes — mas os olhos dizem que a história pesa.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Perguntar o que aconteceu", resposta: "{nome} hesita, depois conta a história inteira, aliviada(o) por finalmente dividir o peso com alguém — o vínculo entre os dois fica mais forte que qualquer armadura." },
        { id: TOM_RESERVADO, rotulo: "Respeitar o silêncio", resposta: "{heroi} não insiste. {nome} agradece com um olhar — algumas histórias só se contam quando a pessoa certa souber esperar." },
      ],
    },
    {
      titulo: "Lado a Lado",
      texto: "\"Já lutei sozinha(o) a vida toda\", diz {nome}, olhando o acampamento movimentado ao redor. \"Não esperava que lutar ao lado de alguém fizesse tanta diferença.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que confia plenamente nela(e)", resposta: "{nome} baixa a guarda pela primeira vez desde que se conheceram — não é fraqueza, é a confiança que só se constrói em combate de verdade." },
        { id: TOM_RESERVADO, rotulo: "Deixar as ações falarem por si", resposta: "{heroi} não precisa dizer nada — {nome} já viu o suficiente em batalha pra saber que pode contar com ele(a), e isso basta." },
      ],
    },
  ],
  mago: [
    {
      titulo: "Uma Pergunta Curiosa",
      texto: "{nome} folheia um grimório à luz da fogueira e, sem levantar os olhos, pergunta: \"{heroi}, você já se perguntou por que a magia obedece a certas regras e não outras?\" É óbvio que a pergunta é só um pretexto pra puxar assunto.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Sentar e conversar sobre o assunto", resposta: "{nome} se anima como raramente acontece, e a conversa se estende noite adentro — {heroi} entende que, pra ela(e), curiosidade compartilhada é a forma mais sincera de amizade." },
        { id: TOM_RESERVADO, rotulo: "Responder rápido e voltar ao que fazia", resposta: "{nome} aceita a resposta breve sem se ofender, mas anota mentalmente o assunto pra outra hora — a curiosidade dela(e) não desiste fácil." },
      ],
    },
    {
      titulo: "O Feitiço que Deu Errado",
      texto: "{nome} confessa, meio sem graça, um feitiço que saiu terrivelmente errado nos primeiros estudos. \"Quase incendiei a própria biblioteca\", admite, tentando (e falhando) parecer indiferente.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Rir junto e pedir mais detalhes", resposta: "{nome} relaxa ao ver que {heroi} não vai julgá-la(o) por isso, e a história vira uma das piadas favoritas do grupo." },
        { id: TOM_RESERVADO, rotulo: "Elogiar o quanto ela(e) evoluiu desde então", resposta: "{nome} aceita o elogio com um aceno modesto — vindo de {heroi}, o reconhecimento vale mais do que qualquer risada." },
      ],
    },
    {
      titulo: "Teoria e Prática",
      texto: "\"Estudei magia a vida toda em livros\", diz {nome}, guardando o grimório. \"Mas foi lutando ao seu lado que finalmente entendi o que ela realmente é.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que aprendeu igualmente com ela(e)", resposta: "{nome} sorri, genuinamente tocada(o) — a troca de conhecimento virou, sem que nenhum dos dois notasse, uma amizade de verdade." },
        { id: TOM_RESERVADO, rotulo: "Concordar em poucas palavras", resposta: "{nome} não precisa de mais que isso — o respeito mútuo entre os dois já fala por si." },
      ],
    },
  ],
  ladino: [
    {
      titulo: "Um Teste de Confiança",
      texto: "{nome} devolve, sem dizer nada, uma bolsa de moedas que \"esqueceu\" de roubar de {heroi} na primeira noite. \"Só queria ver se você notaria\", diz com um sorriso torto.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Rir da brincadeira", resposta: "{nome} relaxa os ombros — {heroi} passou no teste sem nem saber que estava sendo testado(a), e isso conta mais do que qualquer palavra." },
        { id: TOM_RESERVADO, rotulo: "Avisar que da próxima vez não vai rir", resposta: "{nome} solta uma risada curta, genuinamente impressionada(o) — respeito de quem não se deixa levar é raro." },
      ],
    },
    {
      titulo: "Regras Próprias",
      texto: "\"Nunca confiei em ninguém que não tivesse provado o valor primeiro\", diz {nome}, observando {heroi} de esguelha. \"Você ainda não me deu motivo pra duvidar. É... incomum.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que a confiança é mútua", resposta: "{nome} desvia o olhar, sem graça — não está acostumada(o) a esse tipo de sinceridade, mas guarda a frase com mais carinho do que admite." },
        { id: TOM_RESERVADO, rotulo: "Deixar por isso mesmo, sem grandes declarações", resposta: "{nome} aprecia exatamente esse estilo — nenhum dos dois precisa de discursos pra saber onde estão." },
      ],
    },
    {
      titulo: "Sem Truques",
      texto: "{nome} guarda as ferramentas de arrombamento pela primeira vez sem checar se {heroi} está olhando. \"Não preciso mais fingir por perto de você\", admite, quase sem querer.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que sempre pôde ser ela(e) mesma(o)", resposta: "{nome} fica quieta(o) por um instante — é o tipo de coisa que ninguém tinha dito antes, e o silêncio depois diz tudo." },
        { id: TOM_RESERVADO, rotulo: "Só sorrir de volta", resposta: "{nome} entende o sorriso melhor do que entenderia qualquer discurso — entre os dois, isso já basta." },
      ],
    },
  ],
  clerigo: [
    {
      titulo: "Uma Bênção Silenciosa",
      texto: "Antes da batalha, {nome} sussurra uma prece breve — não só pela vitória, mas por {heroi}, especificamente. Percebe que foi ouvida(o) e fica visivelmente sem graça.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Agradecer pela preocupação", resposta: "{nome} sorri, aliviada(o) — cuidar dos outros é natural para ela(e), mas ser notada(o) por isso ainda a(o) emociona um pouco." },
        { id: TOM_RESERVADO, rotulo: "Fingir não ter ouvido, por respeito", resposta: "{nome} aprecia o gesto discreto de {heroi} — algumas devoções são mais sinceras quando ninguém precisa comentar sobre elas." },
      ],
    },
    {
      titulo: "Dúvidas de Fé",
      texto: "\"Às vezes me pergunto se estou realmente curando por fé ou só por hábito\", confessa {nome}, olhando as próprias mãos. É raro vê-la(o) tão insegura(o).",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Garantir que a fé dela(e) sempre ajudou o grupo", resposta: "{nome} respira fundo, visivelmente aliviada(o) — às vezes só precisava ouvir isso de alguém em quem confia." },
        { id: TOM_RESERVADO, rotulo: "Dizer que as dúvidas fazem parte da fé de verdade", resposta: "{nome} pondera a frase por um longo momento antes de assentir devagar — talvez {heroi} tenha razão." },
      ],
    },
    {
      titulo: "Um Propósito Renovado",
      texto: "\"Vim pra este caminho pra servir a um ideal\", diz {nome}. \"Não esperava que servir ao seu lado desse a esse ideal um rosto de verdade.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que a fé dela(e) também guia {heroi}", resposta: "{nome} segura a mão de {heroi} por um instante, em silêncio — é o tipo de gratidão que não cabe em palavras." },
        { id: TOM_RESERVADO, rotulo: "Aceitar as palavras com um aceno solene", resposta: "{nome} entende o gesto contido de {heroi} como o que é: um respeito profundo, dito à sua própria maneira." },
      ],
    },
  ],
  barbaro: [
    {
      titulo: "Um Desafio Amistoso",
      texto: "{nome} bate o peito e desafia {heroi} pra um teste de força — \"só pra ver do que você é feita(o)\", diz com um sorriso largo. Claramente não é sobre vencer.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Topar o desafio de bom grado", resposta: "{nome} solta uma gargalhada, seja lá quem vencer — o que importa é que {heroi} não recuou." },
        { id: TOM_RESERVADO, rotulo: "Recusar com educação, mas elogiar a força dela(e)", resposta: "{nome} respeita a recusa sem ressentimento — força também é saber escolher suas batalhas." },
      ],
    },
    {
      titulo: "Fúria e Controle",
      texto: "\"Nem sempre foi fácil segurar a fúria\", admite {nome}, olhando as mãos calejadas. \"Lutar ao seu lado me ajudou a entender quando soltá-la e quando guardá-la.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que confia no controle dela(e)", resposta: "{nome} se ergue um pouco mais orgulhosa(o) — vindo de {heroi}, essa confiança pesa mais do que qualquer vitória." },
        { id: TOM_RESERVADO, rotulo: "Concordar sem alarde", resposta: "{nome} aprecia que {heroi} não faça drama disso — só reconhece o esforço, e é o suficiente." },
      ],
    },
    {
      titulo: "A Alcateia",
      texto: "\"Minha gente diz que a força de um guerreiro se mede pela alcateia que ele escolhe\", diz {nome}. \"Escolhi bem, ao que parece.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que também escolheu bem", resposta: "{nome} solta um grito de guerra animado — é a forma dela(e) de dizer \"eu também\", alto o bastante pro acampamento inteiro ouvir." },
        { id: TOM_RESERVADO, rotulo: "Bater o punho no peito, em sinal de respeito", resposta: "{nome} retribui o gesto na mesma moeda — entre guerreiros, esse é o cumprimento que mais vale." },
      ],
    },
  ],
  patrulheiro: [
    {
      titulo: "Trilha Compartilhada",
      texto: "{nome} aponta pegadas quase invisíveis no chão e ensina {heroi} a lê-las. \"A trilha conta histórias, se você souber prestar atenção\", diz, claramente orgulhosa(o) do próprio ofício.",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Pedir pra aprender mais", resposta: "{nome} se ilumina — poucas coisas a(o) deixam tão feliz quanto compartilhar o que sabe com alguém interessado de verdade." },
        { id: TOM_RESERVADO, rotulo: "Observar em silêncio e aprender fazendo", resposta: "{nome} aprova o silêncio atento de {heroi} — é assim que ela(e) mesma(o) aprendeu, olhando e fazendo." },
      ],
    },
    {
      titulo: "Raízes",
      texto: "\"A estrada é minha casa há tanto tempo que esqueci como é ficar parada(o)\", admite {nome}, olhando o horizonte. \"Viajar com vocês... é o mais perto de um lar que tive em anos.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que ela(e) sempre terá um lugar no grupo", resposta: "{nome} sorri de um jeito que raramente se permite — a estrada continua sendo casa, mas agora tem companhia de verdade." },
        { id: TOM_RESERVADO, rotulo: "Deixar a paisagem falar por si, em silêncio companheiro", resposta: "{nome} aprecia o silêncio tanto quanto apreciaria qualquer palavra — algumas companhias não precisam de discurso." },
      ],
    },
    {
      titulo: "Um Novo Horizonte",
      texto: "\"Rastreei quase todo tipo de criatura que existe\", diz {nome}, guardando o arco. \"Mas nunca imaginei que rastrear um caminho ao seu lado valeria tanto a pena.\"",
      escolhas: [
        { id: TOM_CALOROSO, rotulo: "Dizer que pretende seguir esse caminho junto dela(e)", resposta: "{nome} assente devagar, os olhos brilhando — é uma promessa que os dois pretendem cumprir." },
        { id: TOM_RESERVADO, rotulo: "Só continuar caminhando ao lado dela(e)", resposta: "{nome} entende: algumas promessas se fazem andando, não falando — e isso já diz tudo." },
      ],
    },
  ],
};

function preencherPlaceholders(texto, nome, heroi) {
  return texto.replaceAll("{nome}", nome).replaceAll("{heroi}", heroi);
}

export function garantirVinculo(instancia) {
  if (!instancia.vinculo) instancia.vinculo = { tier: 0, escolhas: [] };
  if (typeof instancia.vinculo.tier !== "number") instancia.vinculo.tier = 0;
  if (!Array.isArray(instancia.vinculo.escolhas)) instancia.vinculo.escolhas = [];
  return instancia.vinculo;
}

// Soma de todos os tiers já completados — mesmo formato de bonusArvore/
// bonusAfinidade em CharacterFactory.js, pronto pra entrar em bonusTotal().
// Só convocados do gacha têm `.vinculo` — o personagem principal nunca tem,
// então essa função sempre retorna o bônus vazio pra ele (comportamento
// idêntico a antes deste sistema existir).
export function bonusVinculo(personagem) {
  const v = personagem && personagem.vinculo;
  if (!v || !v.tier) return { ...BONUS_VAZIO };
  const total = { ...BONUS_VAZIO };
  for (let i = 0; i < v.tier && i < BONUS_POR_TIER.length; i++) {
    Object.keys(total).forEach((k) => { total[k] += BONUS_POR_TIER[i][k] || 0; });
  }
  return total;
}

// Tier da próxima cena disponível (0, 1 ou 2), ou null se o nível do
// convocado ainda não chegou lá ou se já viu todas as cenas.
export function proximoTierDisponivel(instancia) {
  const v = garantirVinculo(instancia);
  if (v.tier >= LIMIARES_VINCULO.length) return null;
  return (instancia.nivel || 1) >= LIMIARES_VINCULO[v.tier] ? v.tier : null;
}

// Monta a cena disponível agora (com os placeholders já resolvidos) pra
// UI exibir, ou null se não há nenhuma pendente. Nunca muta nada — só
// escolherTomVinculo aplica de fato a escolha.
export function cenaVinculo(instancia, personagem) {
  const tier = proximoTierDisponivel(instancia);
  if (tier === null) return null;
  const porClasse = TEMPLATES_VINCULO[instancia.classeId];
  if (!porClasse || !porClasse[tier]) return null;
  const bruto = porClasse[tier];
  const nome = instancia.nome;
  const heroi = (personagem && personagem.nome) || "o herói";
  return {
    tier,
    titulo: bruto.titulo,
    texto: preencherPlaceholders(bruto.texto, nome, heroi),
    escolhas: bruto.escolhas.map((e) => ({ ...e, resposta: preencherPlaceholders(e.resposta, nome, heroi) })),
    bonus: BONUS_POR_TIER[tier],
  };
}

// Aplica a escolha de tom: avança o tier (a próxima cena só libera no
// próximo marco de nível) e registra a escolha (só pra histórico/flavor —
// nunca lida de volta pra decidir bônus, já que os dois tons dão o mesmo).
// NÃO recalcula hp/mpMax aqui de propósito (ver nota do arquivo) — quem
// chama isso e tem acesso a `dados` (BondUI.js) faz esse recálculo depois,
// igual ao padrão já usado por aplicarEscolhaArvore/despertar.
export function escolherTomVinculo(instancia, tomId) {
  const tier = proximoTierDisponivel(instancia);
  if (tier === null) return { ok: false };
  const v = garantirVinculo(instancia);
  v.escolhas.push({ tier, tom: tomId });
  v.tier = tier + 1;
  return { ok: true, tier, bonus: BONUS_POR_TIER[tier] };
}

// Resumo pronto pra exibir num card da coleção (GachaUI.js), no mesmo
// espírito de estadoDespertarResumo (AwakeningUI.js).
export function resumoVinculoParaCard(instancia) {
  const v = garantirVinculo(instancia);
  if (v.tier >= LIMIARES_VINCULO.length) return { texto: "💞 Vínculo completo", classe: "vinculo-completo" };
  const proximoNivel = LIMIARES_VINCULO[v.tier];
  if ((instancia.nivel || 1) >= proximoNivel) return { texto: "💬 Cena de vínculo disponível!", classe: "vinculo-disponivel" };
  return { texto: `🔒 Vínculo no Nv. ${proximoNivel}`, classe: "vinculo-bloqueado" };
}
