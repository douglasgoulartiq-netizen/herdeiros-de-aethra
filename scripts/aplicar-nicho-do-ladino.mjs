// O LADINO ERA O MELHOR CONTRA UM INIMIGO *E* CONTRA SEIS.
//
// O DEFEITO, MEDIDO (tests/matriz-de-nicho.mjs, árvore comprada)
// --------------------------------------------------------------
//   classe        1 inim.  6 inim.  inclinação  turnos em área c/ 6
//   Ladino         65,4%    57,2%       -8,2           36,1%
//   Patrulheiro    63,6%    33,5%      -30,1           16,2%
//   Mago           15,1%    44,9%      +29,8           45,0%
//
// Ladino e patrulheiro são o mesmo arquétipo — dano físico de destreza, alvo
// único. O patrulheiro se comporta como tal: domina o duelo e despenca na
// multidão. O ladino domina o duelo E CONTINUA dominando a multidão.
//
// A coluna da direita diz por quê: 36% dos turnos dele com seis inimigos são
// ÁREA. Ele tem duas habilidades de área na árvore (ramo "gêmeas"), e a
// Tempestade de Lâminas (x1,45) é praticamente a Nova Elemental do mago
// (x1,5) — mais barata, num personagem que já vence o duelo.
//
// O mago NÃO precisa de reforço: +29,8 de inclinação e 45% dos turnos em área
// já fazem dele o especialista em multidão. Ele parecia fraco porque o ladino
// também fazia o trabalho dele.
//
// A MUDANÇA, E POR QUE ELA É NEUTRA NO DUELO
// ------------------------------------------
// As duas habilidades deixam de ser `dano_area` e viram `dano_fisico_des`,
// COM O MESMO MULTIPLICADOR.
//
// Contra UM inimigo isso não muda nada: uma área que atinge "todos" atinge
// aquele um, pelo mesmo multiplicador. O número do duelo tem de ficar onde
// está — e é isso que o teste confere depois. Contra seis, todo o valor
// desaparece, que é exatamente o objetivo.
//
// Foi escolhido não aumentar o dano de alvo único junto. Mexer em dois eixos
// na mesma rodada torna impossível saber qual deles produziu o resultado.
//
// O NOME E A FICÇÃO MUDAM JUNTO. "Rodopio de lâminas que atinge todos os
// inimigos" virando alvo único seria mentira na tela. A descrição passa a
// dizer o que a habilidade faz.
//
// Uso:  node scripts/aplicar-nicho-do-ladino.mjs            (simulação)
//       node scripts/aplicar-nicho-do-ladino.mjs --escrever
import fs from "node:fs";

const ARVORES = new URL("../src/data/skillTrees.json", import.meta.url);

export const CONVERTER = {
  danca_aco: {
    tipo: "dano_fisico_des",
    nome: "Dança de Aço",
    descricao: "Uma sequência de cortes rápidos no mesmo alvo, sem dar espaço para reagir.",
  },
  tempestade_laminas: {
    tipo: "dano_fisico_des",
    nome: "Tempestade de Lâminas",
    descricao: "Uma saraivada de golpes concentrada num só inimigo, do primeiro corte ao último.",
  },
};

const fonte = JSON.parse(fs.readFileSync(ARVORES, "utf8"));
const ladino = fonte.ladino && fonte.ladino.nos;
if (!Array.isArray(ladino)) { console.error("não achei a lista de nós do ladino (esperado fonte.ladino.nos)"); process.exit(1); }

let mexidos = 0;
const relato = [];
for (const no of ladino) {
  const h = no.habilidade;
  if (!h || !CONVERTER[h.id]) continue;
  const novo = CONVERTER[h.id];
  if (h.tipo === novo.tipo) continue;
  relato.push(`${no.id}: ${h.nome} — ${h.tipo} → ${novo.tipo} (multiplicador x${h.multiplicador}, inalterado)`);
  h.tipo = novo.tipo;
  h.descricao = novo.descricao;
  no.descricao = novo.descricao;
  mexidos += 1;
}

if (!mexidos) {
  console.log("nada a fazer: as habilidades já são de alvo único.");
} else if (process.argv.includes("--escrever")) {
  fs.writeFileSync(ARVORES, `${JSON.stringify(fonte, null, 2)}\n`, "utf8");
  console.log(`gravado: ${mexidos} habilidade(s) convertida(s)`);
  relato.forEach((l) => console.log(`  ${l}`));
} else {
  console.log(`(simulação — use --escrever) ${mexidos} habilidade(s):`);
  relato.forEach((l) => console.log(`  ${l}`));
}
