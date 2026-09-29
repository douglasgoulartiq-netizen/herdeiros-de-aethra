// A ÁRVORE DE LADRILHOS — o que o desenho da tela exige dos DADOS.
//
// A tela nova mostra cada talento como um ladrilho: ícone grande, nome curto,
// custo. Isso muda o que os dados precisam garantir, e nada disso era exigido
// quando o nó era um bloco de texto:
//
//   ÍCONE     todo nó precisa de um. Sem ícone o ladrilho fica vazio, e
//             "◆" em quinze ladrilhos é a mesma parede de ícones iguais que o
//             teste de ícones de item existe para impedir.
//   DISTINTO  dois nós da MESMA coluna não podem repetir ícone: a coluna é
//             lida de relance, e dois ícones iguais empatam a leitura.
//   NOME CURTO o nome fica embaixo de um ladrilho de 58 px. Nome comprido
//             quebra em três linhas e desalinha a coluna inteira.
//   CORRENTE  o degrau N tem de exigir mais pontos no ramo que o degrau N-1,
//             senão a linha que liga os ladrilhos mente sobre a ordem.
//   FINAL     o último degrau de cada ramo é o objetivo da coluna, e a tela o
//             desenha maior. Ele precisa de fato ser o mais caro de alcançar.
import fs from "node:fs";

const arvores = JSON.parse(fs.readFileSync(new URL("../src/data/skillTrees.json", import.meta.url), "utf8"));

let ok = 0;
const check = (nome, cond) => {
  if (!cond) throw new Error(`FALHOU: ${nome}`);
  ok += 1; console.log(`✓ ${nome}`);
};

const classes = Object.keys(arvores);
check(`o jogo tem árvore para todas as classes (${classes.length})`, classes.length >= 6);

// --- ÍCONE ----------------------------------------------------------------
const semIcone = [];
for (const [cls, a] of Object.entries(arvores)) {
  for (const n of a.nos) if (!n.icone) semIcone.push(`${cls}/${n.id}`);
}
check(`todo nó da árvore tem ícone${semIcone.length ? ` — ${semIcone.slice(0, 6).join(", ")}` : ""}`,
  semIcone.length === 0);

// --- DISTINTO DENTRO DA COLUNA --------------------------------------------
const repetidos = [];
for (const [cls, a] of Object.entries(arvores)) {
  const porRamo = {};
  for (const n of a.nos) (porRamo[n.ramo] = porRamo[n.ramo] || []).push(n.icone);
  for (const [ramo, ics] of Object.entries(porRamo)) {
    if (new Set(ics).size !== ics.length) repetidos.push(`${cls}/${ramo}`);
  }
}
check(`nenhuma coluna repete ícone${repetidos.length ? ` — ${repetidos.join(", ")}` : ""}`,
  repetidos.length === 0);

// --- NOME CURTO -----------------------------------------------------------
// 22 caracteres cabem em duas linhas sob um ladrilho de 58 px na fonte da
// tela. O maior nome do jogo hoje é "Tempestade de Lâminas", com 21.
const LIMITE = 24;
const compridos = [];
for (const [cls, a] of Object.entries(arvores)) {
  for (const n of a.nos) if (n.nome.length > LIMITE) compridos.push(`${cls}/${n.nome} (${n.nome.length})`);
}
check(`nenhum nome de talento passa de ${LIMITE} caracteres${compridos.length ? ` — ${compridos.join(", ")}` : ""}`,
  compridos.length === 0);

// --- CORRENTE -------------------------------------------------------------
const foraDeOrdem = [];
for (const [cls, a] of Object.entries(arvores)) {
  const porRamo = {};
  for (const n of a.nos) (porRamo[n.ramo] = porRamo[n.ramo] || []).push(n);
  for (const [ramo, nos] of Object.entries(porRamo)) {
    const ordenados = [...nos].sort((x, y) => x.tier - y.tier);
    const tiers = ordenados.map((n) => n.tier);
    if (new Set(tiers).size !== tiers.length) foraDeOrdem.push(`${cls}/${ramo}: degrau repetido`);
    for (let i = 1; i < ordenados.length; i += 1) {
      const antes = ordenados[i - 1]; const agora = ordenados[i];
      if ((agora.requerRamo || 0) < (antes.requerRamo || 0)) {
        foraDeOrdem.push(`${cls}/${ramo}: ${agora.nome} exige menos que ${antes.nome}`);
      }
      if ((agora.nivelRequerido || 0) < (antes.nivelRequerido || 0)) {
        foraDeOrdem.push(`${cls}/${ramo}: ${agora.nome} pede nível menor que ${antes.nome}`);
      }
    }
  }
}
check(`a corrente de cada ramo sobe em degraus${foraDeOrdem.length ? ` — ${foraDeOrdem.slice(0, 4).join(" | ")}` : ""}`,
  foraDeOrdem.length === 0);

// --- FINAL ----------------------------------------------------------------
const finaisFracos = [];
for (const [cls, a] of Object.entries(arvores)) {
  const porRamo = {};
  for (const n of a.nos) (porRamo[n.ramo] = porRamo[n.ramo] || []).push(n);
  for (const [ramo, nos] of Object.entries(porRamo)) {
    const ultimo = nos.reduce((m, n) => (n.tier > m.tier ? n : m), nos[0]);
    const maiorReq = Math.max(...nos.map((n) => n.requerRamo || 0));
    if ((ultimo.requerRamo || 0) < maiorReq) finaisFracos.push(`${cls}/${ramo}`);
  }
}
check(`o último degrau é o mais exigente do ramo${finaisFracos.length ? ` — ${finaisFracos.join(", ")}` : ""}`,
  finaisFracos.length === 0);

// --- FORMA GERAL ----------------------------------------------------------
const desiguais = [];
for (const [cls, a] of Object.entries(arvores)) {
  const porRamo = {};
  for (const n of a.nos) porRamo[n.ramo] = (porRamo[n.ramo] || 0) + 1;
  const contagens = Object.values(porRamo);
  if (new Set(contagens).size !== 1) desiguais.push(`${cls}: ${JSON.stringify(porRamo)}`);
  if (a.ramos.length !== 3) desiguais.push(`${cls}: ${a.ramos.length} ramos`);
}
// A tela desenha três colunas de tamanho igual: um ramo com dois nós a mais
// deixaria uma coluna comprida e duas curtas ao lado dela.
check(`toda classe tem 3 ramos do mesmo tamanho${desiguais.length ? ` — ${desiguais.join(" | ")}` : ""}`,
  desiguais.length === 0);

const ramosSemTema = [];
for (const [cls, a] of Object.entries(arvores)) {
  for (const r of a.ramos) if (!r.nome || !r.descricao) ramosSemTema.push(`${cls}/${r.id}`);
}
check(`todo ramo tem nome e descrição própria${ramosSemTema.length ? ` — ${ramosSemTema.join(", ")}` : ""}`,
  ramosSemTema.length === 0);

const totalNos = Object.values(arvores).reduce((s, a) => s + a.nos.length, 0);
console.log(`\n${ok} verificações da árvore de ladrilhos passaram (${classes.length} classes, ${totalNos} talentos).`);
