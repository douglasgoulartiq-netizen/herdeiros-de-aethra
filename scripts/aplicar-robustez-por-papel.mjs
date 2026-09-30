// O MAGO GANHAVA CONSTITUIÇÃO NO MESMO RITMO DO BÁRBARO.
//
// O DEFEITO, MEDIDO
// -----------------
// Toda a robustez do jogo sai de UM atributo (CharacterFactory):
//
//     hpMax  = vidaBase + CON * 3
//     defesa = floor(CON / 2) + equipamento
//
// E `crescimento.CON` valia 2 para OITO das dez classes — mago, bardo, druida
// e necromante inclusive. Só clérigo e patrulheiro ganhavam 1.
//
// A diferença inicial existe (guerreiro CON 7, mago CON 4), mas some: ao
// longo de 24 níveis ambos somam +48, e 3 pontos viram ruído. O resultado,
// medido com a árvore comprada no nível 25:
//
//     guerreiro   defesa 35   vida 211
//     mago        defesa 33   vida 181
//
// Seis por cento de defesa a mais. O guerreiro não era robusto — ele só tinha
// um nome diferente. E é isto que faz "só ataque importar": se vida e defesa
// são praticamente iguais para todos, a única coisa que distingue uma classe
// da outra é quanto dano ela causa. Não adianta sistema de ameaça: o tanque
// não tem o que tankar com.
//
// A CORREÇÃO
// ----------
// CON passa a crescer pelo PAPEL. A linha de frente mantém 2 — os números
// dela hoje são a régua com que os monstros foram ajustados, e mexer nisso
// invalidaria o balanceamento de encontro inteiro. Quem não é linha de frente
// cai para 1.
//
// Ou seja: o tanque não fica mais forte; o resto fica de fato frágil, que era
// o que faltava. No nível 25 a conta passa a ser:
//
//     guerreiro   CON 7 + 2*24 = 55   ->  vida 199   defesa 34
//     mago        CON 4 + 1*24 = 28   ->  vida 106   defesa 21
//
// Quase o dobro de vida e 1,6x de defesa. A partir daí vida e defesa são
// escolhas de verdade, e o sistema de ameaça (AmeacaSystem) tem sobre o que
// operar.
//
// O PAR DISSO É A PROTEÇÃO. Deixar o conjurador frágil sem lhe dar como se
// proteger seria só um nerf. Os dois andam juntos: com a ameaça ligada, o
// mago passou de 18,5% para 3,2% da pancada recebida. Frágil, porém coberto
// — desde que o jogador cuide da formação.
//
// ATENÇÃO A SAVES EXISTENTES: isto muda hpMax de personagem já criado. A
// migração precisa recalcular vida e reajustar hp atual proporcionalmente,
// senão um mago salvo com 181 de vida acorda com 106 e o hp atual acima do
// máximo. Ver ClassBalanceMigration.js.
//
// Uso:  node scripts/aplicar-robustez-por-papel.mjs            (simulação)
//       node scripts/aplicar-robustez-por-papel.mjs --escrever
import fs from "node:fs";

const CLASSES = new URL("../src/data/classes.json", import.meta.url);

// Linha de frente: mantém 2. São elas que a régua de dano dos monstros já
// pressupõe, e são elas que devem apanhar.
export const LINHA_DE_FRENTE = ["guerreiro", "barbaro", "paladino"];
export const CON_FRENTE = 2;
export const CON_RETAGUARDA = 1;

const classes = JSON.parse(fs.readFileSync(CLASSES, "utf8"));
const relato = [];
let mexidos = 0;

for (const c of classes) {
  const alvo = LINHA_DE_FRENTE.includes(c.id) ? CON_FRENTE : CON_RETAGUARDA;
  const atual = c.crescimento?.CON;
  if (atual === alvo) continue;
  const vida25 = (con) => c.vidaBase + (c.atributosBase.CON + con * 24) * 3;
  const def25 = (con) => Math.floor((c.atributosBase.CON + con * 24) / 2);
  relato.push(`${c.id.padEnd(13)} CON/nível ${atual} → ${alvo}`
    + `  | nv25: vida ${vida25(atual)} → ${vida25(alvo)}, defesa base ${def25(atual)} → ${def25(alvo)}`);
  c.crescimento.CON = alvo;
  mexidos += 1;
}

if (!mexidos) {
  console.log("nada a fazer: o crescimento de CON já está por papel.");
} else if (process.argv.includes("--escrever")) {
  fs.writeFileSync(CLASSES, `${JSON.stringify(classes, null, 2)}\n`, "utf8");
  console.log(`gravado: ${mexidos} classe(s)`);
  relato.forEach((l) => console.log(`  ${l}`));
} else {
  console.log(`(simulação — use --escrever) ${mexidos} classe(s):`);
  relato.forEach((l) => console.log(`  ${l}`));
}
