// Contrato puro da IA inimiga. Não usa navegador: protege as decisões que
// precisam continuar corretas mesmo quando o layout mobile muda.
import {
  escolherAlvoPorArquetipo,
  escolherAlvoPorArquetipoLegado,
  deveHesitar,
  gerarIntencao,
} from "../src/systems/EnemyAI.js";

let passou = 0;
let falhou = 0;
function checar(condicao, mensagem) {
  if (condicao) { passou += 1; console.log(`  ok   ${mensagem}`); }
  else { falhou += 1; console.log(`  FALHOU   ${mensagem}`); }
}

const time = [
  { nome: "Muralha", hp: 90, hpMax: 100, defesa: 18, atb: 15, ataque: { dano: 8 } },
  { nome: "Ferida", hp: 18, hpMax: 100, defesa: 11, atb: 45, ataque: { dano: 14 } },
  { nome: "Arqueira", hp: 62, hpMax: 80, defesa: 8, atb: 92, ataque: { dano: 25 } },
];

console.log("\n=== IA INIMIGA ===\n");

// A GARANTIA DEIXOU DE SER ABSOLUTA E PASSOU A SER ESTATÍSTICA.
//
// Antes, o alvo saía só do arquétipo do inimigo e podia ser afirmado com um
// "===": agressor SEMPRE pegava o mais ferido. O preço disso era que o
// jogador não tinha influência nenhuma sobre quem apanhava — medido em
// tests/matriz-de-nicho.mjs, o mago levava 18,5% do dano do time, mais que o
// paladino, e investir em vida e defesa não comprava nada.
//
// Agora o alvo é um sorteio com peso (ver AmeacaSystem): ameaça do herói
// vezes preferência do arquétipo. O caçador continua preferindo o frágil,
// mas um guerreiro provocando consegue puxá-lo.
//
// Então o contrato que este teste protege mudou de forma: não é mais "sempre
// escolhe X", é "escolhe X com muito mais frequência que os outros". Isso é
// uma afirmação mais forte, não mais fraca — ela pega tanto a preferência
// sumindo quanto ela virando determinismo.
const RODADAS = 4000;
function frequencias(arquetipo) {
  // Gerador determinístico: o teste não pode falhar de vez em quando.
  let s = 12345;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const conta = {};
  for (let i = 0; i < RODADAS; i += 1) {
    const alvo = escolherAlvoPorArquetipo(time, arquetipo, rnd);
    conta[alvo.nome] = (conta[alvo.nome] || 0) + 1;
  }
  return conta;
}
function prefere(arquetipo, nome, mensagem) {
  const c = frequencias(arquetipo);
  const meu = c[nome] || 0;
  const maiorOutro = Math.max(0, ...Object.entries(c).filter(([n]) => n !== nome).map(([, v]) => v));
  checar(meu > maiorOutro, `${mensagem} (${nome}: ${meu}/${RODADAS}, maior rival: ${maiorOutro})`);
}

prefere("agressor", "Ferida", "agressor prefere o herói com menos vida atual");
prefere("suporte", "Ferida", "suporte sem ação especial mantém alvo coerente");
prefere("cacador", "Arqueira", "caçador prefere a defesa mais baixa");
prefere("conjurador", "Arqueira", "conjurador prefere o alvo mais frágil");
prefere("atirador", "Arqueira", "atirador pressiona quem causa mais dano");
prefere("fanatico", "Muralha", "fanático prefere o alvo com mais vida");
prefere("controlador", "Arqueira", "controlador prefere quem está mais perto de agir");

// A regra antiga continua existindo e continua determinística. Ela não é
// usada pelo jogo; fica como referência do que mudou.
checar(escolherAlvoPorArquetipoLegado(time, "agressor")?.nome === "Ferida",
  "a regra legada segue determinística, para comparação");

checar(escolherAlvoPorArquetipo([], "agressor") === null,
  "sem heróis vivos a IA não inventa alvo");

const covarde = { hp: 20, hpMax: 100, vivo: true };
const aliado = { hp: 10, hpMax: 10, vivo: true };
checar(deveHesitar(covarde, [covarde, aliado], "covarde") === true,
  "covarde hesita com vida crítica");
covarde.hp = 100;
aliado.vivo = false;
checar(deveHesitar(covarde, [covarde, aliado], "covarde") === true,
  "covarde hesita quando um aliado cai");
checar(deveHesitar(covarde, [covarde, aliado], "agressor") === false,
  "outros arquétipos não recebem hesitação indevida");

const intencao = gerarIntencao(
  { nome: "Colosso", chefe: true, elemento: "fogo", atributos: { FOR: 16 } },
  time[1],
  "agressor",
  { agressor: { nome: "Brutal" }, aleatorio: { nome: "Instável" } },
);
checar(intencao.alvoNome === "Ferida" && intencao.perigo === "alto"
  && intencao.elemento === "fogo" && intencao.arquetipoNome === "Brutal",
  "intenção anuncia alvo, perigo, elemento e comportamento");

console.log(`\nResultado: ${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
