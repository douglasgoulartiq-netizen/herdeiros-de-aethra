// COMO AS REGIÕES RECEBEM A RAÇA DO HERDEIRO.
//
// A raça escolhida na criação já pesava em atributo e em traço, mas o mundo
// não a enxergava: um anão atravessava Morranvell e ninguém em Morranvell
// notava que ele era anão. Aqui cada região ganha o que o povo dela DIZ para
// quem é de casa — e, em alguns lugares, o que diz para quem claramente não é.
//
// FORMATO. `RECONHECIMENTO_RACIAL[regiaoId][racaId]` é uma frase só, dita
// pelo NPC logo depois da fala dele, entre aspas, do mesmo jeito que a reação
// por reputação já aparecia. A tabela é ESPARSA de propósito: só existe linha
// onde há alguma coisa de verdade para dizer. Encher as 17 regiões × 6 raças
// daria 102 frases e nenhuma delas seria boa.
//
// A frase é sempre da boca do LOCAL, nunca do narrador, e nunca vale
// mecânica — é reconhecimento, não bônus. O peso mecânico da raça já está no
// traço racial e na afinidade; o que faltava era o mundo dar sinal de que
// reparou.
export const RECONHECIMENTO_RACIAL = {
  // --- Anão: pedra, mina e clã ------------------------------------------
  morranvell: {
    anao: "Você tem o passo de quem já desceu poço. Aqui isso vale mais que nome de família — mas nome de família também vale, e o seu ninguém sabe qual é.",
    halfling: "Gente do seu tamanho costuma chegar aqui vendendo alguma coisa. Você não está vendendo nada, o que é pior: significa que veio pelo frio.",
  },
  montanhas_de_vulkor: {
    anao: "Um anão na boca da forja. Meu avô diria que é bom presságio; eu digo que é só mais um par de mãos que sabe onde não encostar.",
    draconato: "A montanha respira fogo e você respira de volta. Fica à vontade — aqui ninguém corre de escama.",
  },
  vale_dos_titas: {
    anao: "Anão de pedra grande sabe olhar para cima sem sentir vergonha. A maioria chega aqui e fica olhando o chão.",
    orc: "Você não parece pequeno diante disso aqui. É a primeira vez em anos que vejo alguém não parecer pequeno diante disso aqui.",
  },

  // --- Elfo: mata, água e o que dura mais que gente ----------------------
  bosque_eterno: {
    elfo: "A mata te deixou entrar sem fazer barulho. Ela não faz isso por qualquer um, e eu vivo aqui há trinta anos.",
    anao: "Anão em mata fechada anda como quem espera que o teto caia. Relaxe: aqui o que cai é folha.",
  },
  altaverde: {
    elfo: "Você olhou para a Árvore-Mãe antes de olhar para mim. Todo elfo faz isso, e todo elfo acha que ninguém reparou.",
    halfling: "Você já sentou na minha mesa sem eu oferecer. Gente do seu povo faz isso e, não sei por quê, nunca soa mal-educado.",
    humano: "Você parece daqui. Isso não é elogio nem ofensa — é só que metade da vila também parece, e ainda assim ninguém sabe de onde você veio.",
  },
  lago_prismatico: {
    elfo: "A água mostra quem olha nela. Você não desviou o rosto, o que é raro e não necessariamente bom.",
  },

  // --- Orc: calor, guerra e o que ficou depois dela ----------------------
  canon_rubro: {
    orc: "Orc descendo o Cânion sem escolta. Ou você é muito burro, ou é daqui. Vou apostar na segunda e ficar de olho assim mesmo.",
  },
  deserto_de_arenth: {
    orc: "O sol não te derrubou no primeiro dia. Quem aguenta o primeiro dia costuma aguentar o resto — e quem não aguenta, a gente encontra depois.",
    draconato: "A areia não gruda em escama. Deve ser bom. Nunca vou saber.",
  },

  // --- Halfling: estrada, porto e conversa -------------------------------
  costa_da_mare: {
    halfling: "Ninguém do seu povo chega aqui sem já saber o preço do peixe. Você sabe. Não vou nem tentar.",
    humano: "Metade deste porto é gente que veio de outro lugar e ficou. Você tem cara de quem ainda não decidiu qual das duas metades é.",
  },
  vale_do_vento: {
    halfling: "Caravana boa sempre tem um da sua altura sentado na frente. Sabe por quê? Porque ele vê o que vem antes de todo mundo, e ninguém desconfia dele.",
    elfo: "O vento aqui não é bonito, é trabalho. Vocês costumam levar dois dias para entender isso.",
  },

  // --- Draconato: o que o Éter deixou marcado ----------------------------
  arquipelago_de_nuvens: {
    draconato: "As crianças daqui crescem ouvindo que os primeiros a subir tinham escama. Agora elas vão passar o mês inteiro te olhando.",
  },
  abismo_de_nazthal: {
    draconato: "Lá embaixo tem coisa que reconhece o que corre no seu sangue. Não sei se isso te protege ou te marca. Ninguém sabe.",
  },
  sombralith: {
    draconato: "Sua escama pega a pouca luz que sobra e devolve. Aqui isso é praticamente uma tocha — e tocha chama companhia.",
    humano: "Você não tem nada que denuncie de onde veio. Em Sombralith isso é quase um ofício.",
  },

  // --- Humano e os lugares onde ser comum é a vantagem -------------------
  ruinas_de_aethra: {
    humano: "Quatro reinos mandaram gente para cá e todos eles tinham a sua cara. Ninguém vai te barrar. Ninguém vai te ajudar também.",
  },
  selva_umbriaca: {
    humano: "Você não é a coisa mais estranha que entrou aqui este mês. Fique feliz com isso.",
    elfo: "Esta mata não é a sua mata. Ela também é antiga, também é viva, e não gosta nem um pouco de quem chega achando que já entende.",
  },
  pantano_de_thalgor: {
    halfling: "O lodo aqui engole bota, e a sua é pequena. Pise onde eu pisar.",
    orc: "Você é pesado. No pântano, pesado é problema — mas quando o problema é outra coisa, pesado é o que a gente chama.",
  },
};

// A frase que ESTA pessoa diz a ESTE herdeiro, ou null. `regiaoId` vem do NPC;
// NPC sem região (os cinco antigos da vila) não reage — eles não têm um povo
// atrás deles para reagir em nome de quem.
export function reconhecimentoRacial(regiaoId, racaId) {
  if (!regiaoId || !racaId) return null;
  return (RECONHECIMENTO_RACIAL[regiaoId] || {})[racaId] || null;
}
