// ÍCONES DAS QUATRO ÁRVORES NOVAS
//
// O PROBLEMA QUE ISTO RESOLVE
// ---------------------------
// As árvores de paladino, bardo, druida e necromante nasceram com UM ícone
// por classe: os 18 nós do paladino são 18 escudos. A tela de ladrilhos lê
// cada coluna de relance, e dezoito ícones iguais empatam a leitura — é
// exatamente a parede de ícones iguais que test-arvore-ladrilhos existe para
// impedir, e ele estava apontando isso corretamente.
//
// A REGRA QUE EU SIGO AQUI
// ------------------------
// Os quatro degraus passivos (Vitalidade, Reserva, Tenacidade, Renovação) se
// repetem igual em TODAS as colunas de TODAS as classes. Eles ganham o MESMO
// ícone em todo lugar, de propósito: o jogador aprende uma vez que ❤️ é vida
// e 🔋 é Éter, e não reaprende por classe. O teste proíbe repetir ícone
// DENTRO de uma coluna, não entre colunas — e repetir entre colunas aqui é
// consistência, não preguiça.
//
// Os dois degraus que são habilidade de verdade (1 e 3) ganham ícone próprio,
// escolhido pelo que a habilidade FAZ, não pela classe: a cura do paladino é
// uma aurora, a canção de guerra do bardo é um megafone, a forma animal do
// druida é uma pata. Assim o ladrilho diz algo antes de o jogador ler o nome.
//
// Idempotente: escreve só o que mudou e confere o resultado contra a mesma
// regra que o teste aplica. Uso: node scripts/aplicar-icones-classes-novas.mjs
import { readFileSync, writeFileSync } from "node:fs";

const CAMINHO = new URL("../src/data/skillTrees.json", import.meta.url);

// Os quatro passivos, iguais em toda árvore.
const PASSIVOS = { 2: "❤️", 4: "🔋", 5: "🧱", 6: "💗" };

// As habilidades, por nó. Nenhum destes pode colidir com os passivos acima
// nem com o outro nó da mesma coluna — a conferência no fim garante isso.
const HABILIDADES = {
  paladino_0_1: "🌅", paladino_0_3: "⚖️",   // cura da aurora / juízo de luz
  paladino_1_1: "🏰", paladino_1_3: "⚔️",   // muralha votiva / golpe votivo
  paladino_2_1: "🛡️", paladino_2_3: "✨",   // voto de proteção / cura maior

  bardo_0_1: "🎼", bardo_0_3: "🎶",         // balada do refúgio / refrão da vida
  bardo_1_1: "🔇", bardo_1_3: "🎵",         // dissonância (lentidão) / nota cortante
  bardo_2_1: "📣", bardo_2_3: "🪕",         // canto da coragem / balada maior

  druida_0_1: "💧", druida_0_3: "🌱",       // orvalho / raízes profundas
  druida_1_1: "🍃", druida_1_3: "🌵",       // tempestade de folhas / espinho vivo
  druida_2_1: "🐾", druida_2_3: "🌿",       // forma da fera / orvalho maior

  necromante_0_1: "🩸", necromante_0_3: "⚰️", // drenar vitalidade / peso do túmulo
  necromante_1_1: "🌑", necromante_1_3: "👻", // colheita de cinzas / toque fúnebre
  necromante_2_1: "💀", necromante_2_3: "🧛", // servo vinculado / drenar maior
};

// NOMES DO TERCEIRO DEGRAU
//
// As quatro árvores batizaram a versão forte de cada habilidade como
// "<nome base> Superior". Quatro desses nomes passam dos 24 caracteres que o
// ladrilho comporta, e o teste reprova — com razão: nome que não cabe quebra
// em três linhas e desalinha a coluna. Mas encurtar só os quatro deixaria
// metade da árvore com "Superior" e metade sem, então renomeio os doze.
// Nenhuma classe antiga usa "Superior": elas dão nome próprio a cada nó, e é
// essa convenção que estas seguem agora.
const NOMES_DEGRAU_3 = {
  paladino_0_3: "Sentença de Luz",
  paladino_1_3: "Lâmina do Juramento",
  paladino_2_3: "Clarão Restaurador",
  bardo_0_3: "Grande Refrão",
  bardo_1_3: "Nota Dilacerante",
  bardo_2_3: "Balada do Bastião",
  druida_0_3: "Raízes do Abismo",
  druida_1_3: "Espinho Ancião",
  druida_2_3: "Orvalho da Alvorada",
  necromante_0_3: "Peso da Sepultura",
  necromante_1_3: "Toque do Fim",
  necromante_2_3: "Sede de Vitalidade",
};
const LIMITE_NOME = 24;

// Ícone do próprio ramo (o cabeçalho da coluna), hoje também repetido.
const RAMOS = {
  paladino_0: "🌅", paladino_1: "🏰", paladino_2: "🛡️",
  bardo_0: "🎼", bardo_1: "🎵", bardo_2: "📣",
  druida_0: "💧", druida_1: "🍃", druida_2: "🐾",
  necromante_0: "🩸", necromante_1: "🌑", necromante_2: "💀",
};

const CLASSES = ["paladino", "bardo", "druida", "necromante"];
const arvores = JSON.parse(readFileSync(CAMINHO, "utf8"));

let trocados = 0;
const semRegra = [];
for (const cls of CLASSES) {
  const a = arvores[cls];
  if (!a) { console.error(`árvore ausente: ${cls}`); process.exit(1); }

  for (const r of a.ramos || []) {
    if (RAMOS[r.id] && r.icone !== RAMOS[r.id]) { r.icone = RAMOS[r.id]; trocados += 1; }
  }

  for (const n of a.nos) {
    const degrau = Number(String(n.id).split("_").pop());
    const novo = HABILIDADES[n.id] || PASSIVOS[degrau];
    // Sem regra conhecida é motivo de parar, não de inventar: significa que a
    // árvore mudou de forma e esta tabela ficou para trás.
    if (!novo) { semRegra.push(n.id); continue; }
    if (n.icone !== novo) { n.icone = novo; trocados += 1; }

    // A passiva carrega o próprio ícone, e a HUD mostra ESSE. Deixar os dois
    // diferentes faz o mesmo talento aparecer com uma cara na árvore e outra
    // na barra de status.
    if (n.passiva && n.passiva.icone !== novo) { n.passiva.icone = novo; trocados += 1; }

    // O nome vive em dois lugares: o ladrilho lê n.nome, o card de combate e
    // o log lêem habilidade.nome. Renomear só um faz o jogo chamar a mesma
    // coisa por dois nomes.
    const nomeNovo = NOMES_DEGRAU_3[n.id];
    if (nomeNovo) {
      if (n.nome !== nomeNovo) { n.nome = nomeNovo; trocados += 1; }
      if (n.habilidade && n.habilidade.nome !== nomeNovo) { n.habilidade.nome = nomeNovo; trocados += 1; }
    }
  }
}

if (semRegra.length) {
  console.error(`sem regra de ícone para: ${semRegra.join(", ")}`);
  console.error("a árvore mudou de forma — atualize a tabela antes de rodar.");
  process.exit(1);
}

// A MESMA conferência que o teste faz, antes de gravar: se eu escrevi uma
// colisão, o arquivo não sai daqui.
const colisoes = [];
for (const cls of CLASSES) {
  const porRamo = {};
  for (const n of arvores[cls].nos) (porRamo[n.ramo] = porRamo[n.ramo] || []).push(n.icone);
  for (const [ramo, ics] of Object.entries(porRamo)) {
    if (new Set(ics).size !== ics.length) colisoes.push(`${cls}/${ramo}: ${ics.join(" ")}`);
  }
}
if (colisoes.length) {
  console.error("a tabela de ícones ainda colide — nada foi gravado:");
  colisoes.forEach((c) => console.error("  " + c));
  process.exit(1);
}

const compridos = [];
for (const cls of CLASSES) {
  for (const n of arvores[cls].nos) if (n.nome.length > LIMITE_NOME) compridos.push(`${cls}/${n.nome} (${n.nome.length})`);
}
if (compridos.length) {
  console.error(`nome passa de ${LIMITE_NOME} caracteres — nada foi gravado:`);
  compridos.forEach((c) => console.error("  " + c));
  process.exit(1);
}

if (trocados === 0) { console.log("já aplicado: nenhum ícone a trocar."); process.exit(0); }

writeFileSync(CAMINHO, JSON.stringify(arvores, null, 2) + "\n");
console.log(`${trocados} ícones trocados nas 4 árvores novas, sem colisão em nenhuma das 12 colunas.`);
