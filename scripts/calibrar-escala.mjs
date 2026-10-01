// CALIBRA OS FATORES DE `escala` CONTRA A CONCORRÊNCIA REAL DE CADA CLASSE.
//
// POR QUE ISTO EXISTE. As duas primeiras calibrações foram feitas à mão, a
// partir de uma base de ataque estimada em ~29 (arma + 30% do atributo). A
// base REAL, que sai de `ataqueBase`, é ~95: ela inclui o ataque de classe,
// não só a arma. Errar a base por 3x faz toda habilidade nova nascer fraca
// demais para a IA escolher — e uma habilidade que a IA nunca escolhe não
// muda nada, por mais bem escrita que esteja.
//
// A REGRA MUDOU, e a razão é uma medição que me contrariou.
//
// A primeira regra era PARIDADE com a melhor habilidade existente da classe,
// com o argumento de que a habilidade robusta deve ser escolha lateral e não
// upgrade automático. O argumento continua certo. A conclusão operacional
// estava errada: com a build escolhida por dano simulado (ver
// tests/prova-robustez.mjs), SEIS DE DEZ classes simplesmente não levaram a
// habilidade nova. Paridade significa "não vale a pena trocar" — num argmax,
// empate perde.
//
// Para ocupar uma das 4 vagas de card ela precisa ser MELHOR naquela build.
// A regra agora é: superar a melhor existente da categoria por MARGEM, e
// medida em PODER POR TURNO (que conta recarga e Éter), não em multiplicador
// efetivo — porque foi justamente ignorar recarga que fez a primeira
// calibração entregar habilidades que a IA pegava e que rendiam menos.
//
// Uso: node scripts/calibrar-escala.mjs
import { readFileSync, readdirSync } from "node:fs";
import { criarPersonagem, aplicarCrescimento, ataqueBase, atributosEfetivos, defesaTotal } from "../src/systems/CharacterFactory.js";
import { arvoreDaClasse, escolherNo, pontosDisponiveis, podeEscolher } from "../src/systems/SkillTreeSystem.js";
import { multiplicadorEfetivo, baseDeAtaque, FONTES, TETO_SOBRE_BASE } from "../src/systems/EscalaDerivada.js";
import { valorPorTurno, disponibilidade, VALOR_DO_ATAQUE_BASICO } from "../src/systems/ValorDeHabilidade.js";
import { NOS_NOVOS } from "./aplicar-escala-derivada.mjs";

const dataDir = new URL("../src/data/", import.meta.url);
const dados = Object.fromEntries(readdirSync(dataDir).filter((f) => f.endsWith(".json"))
  .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dataDir)))]));

const NIVEL = 25;
// Quanto a habilidade robusta precisa superar a melhor existente para valer a
// troca de vaga. 10% e nao 1%: o empate tecnico perde para o desempate
// alfabetico do sort, e uma margem apertada some no ruido da simulacao.
const MARGEM = 1.10;
const ALVO_UNICO = ["dano_fisico", "dano_fisico_des", "dano_magico", "dano_ignora_defesa"];
const AREA = ["dano_area"];
const APOIO = ["cura", "cura_area"];
const categoria = (t) => (AREA.includes(t) ? "área" : APOIO.includes(t) ? "apoio" : "alvo único");
const tiposDa = (c) => (c === "área" ? AREA : c === "apoio" ? APOIO : ALVO_UNICO);

function personagem(classe) {
  const p = criarPersonagem({ nome: classe, raca: "humano", classe,
    antecedente: dados.backgrounds[0].id, traco: dados.traits[0].id }, dados);
  while (p.nivel < NIVEL) { p.nivel += 1; aplicarCrescimento(p, dados); }
  const cl = dados.classes.find((c) => c.id === classe);
  const atributo = ["FOR", "DES", "INT"].sort((a, b) => cl.crescimento[b] - cl.crescimento[a] || p.atributos[b] - p.atributos[a])[0];
  p.equipamento.arma = { id: "a", nome: "A", tipo: "arma", atributo, dano: Math.round(3 + NIVEL * 0.4), elemento: "fisico" };
  p.equipamento.peito = { id: "b", nome: "B", tipo: "armadura", defesa: Math.round(2 + NIVEL * 0.2) };
  for (let v = 0; v < 40; v += 1) {
    let comprou = false;
    if (pontosDisponiveis(p, dados) <= 0) break;
    for (const no of arvoreDaClasse(p, dados)) {
      if (pontosDisponiveis(p, dados) <= 0) break;
      if (!podeEscolher(p, dados, no)) continue;
      if (escolherNo(p, dados, no.id).ok) comprou = true;
    }
    if (!comprou) break;
  }
  return p;
}

console.log(`nível ${NIVEL}, equipamento sintético do benchmark, árvore comprada inteira.`);
console.log(`vidaPerdida avaliada com metade da vida (é o estado em que ela decide algo).\n`);
console.log(`classe        habilidade              base  fonte(valor)       alvo/turno  atual  fator atual → sugerido`);

for (const d of NOS_NOVOS) {
  if (!d.habilidade.escala) continue;
  const p = personagem(d.classe);
  const vista = { ataque: ataqueBase(p, dados), atributos: atributosEfetivos(p, dados),
    defesa: defesaTotal(p, dados), hpMax: p.hpMax, hp: Math.round(p.hpMax * 0.5) };
  const h = { ...d.habilidade, nome: d.nome, id: `${d.id}_skill` };
  const cat = categoria(h.tipo);
  const rivais = (p.habilidades || []).filter((x) => x.id !== h.id && tiposDa(cat).includes(x.tipo));
  // Alvo em PODER POR TURNO, com margem: tem de GANHAR da melhor existente,
  // não empatar.
  const melhorRival = Math.max(0, ...rivais.map((x) => valorPorTurno(x, vista)));
  const alvo = melhorRival * MARGEM;
  const base = baseDeAtaque(vista, h);
  const valorFonte = FONTES[h.escala.de](vista);
  const atual = valorPorTurno(h, vista);
  // Resolver: mult * (base + fonte*f) / base = alvo  →  f = base*(alvo/mult - 1)/fonte
  // Resolver para o fator que leva o PODER POR TURNO ao alvo:
  //   valor = mult_ef * d + ataqueBasico * (1 - d),  mult_ef = mult*(base+f*fonte)/base
  // => f = base * ( (valor - basico*(1-d)) / (d*mult) - 1 ) / fonte
  const disp = disponibilidade(h, vista);
  let sugerido = valorFonte > 0 && disp > 0
    ? (base * ((alvo - VALOR_DO_ATAQUE_BASICO * (1 - disp)) / (disp * h.multiplicador) - 1)) / valorFonte
    : 0;
  // Não faz sentido pedir um fator que o teto já cortaria: acima disso o
  // número na tabela seria promessa, não efeito.
  const fatorNoTeto = (base * TETO_SOBRE_BASE) / valorFonte;
  const cortado = sugerido > fatorNoTeto;
  sugerido = Math.min(sugerido, fatorNoTeto);
  console.log(`${d.classe.padEnd(13)} ${d.nome.padEnd(22)} ${String(Math.round(base)).padStart(4)}  ${h.escala.de}(${Math.round(valorFonte)})`.padEnd(66)
    + `${alvo.toFixed(2)}  ${atual.toFixed(2)}   ${h.escala.fator} → ${sugerido.toFixed(2)}${cortado ? " (limitado pelo teto)" : ""}`);
}
