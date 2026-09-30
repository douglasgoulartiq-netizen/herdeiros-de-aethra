// LIGA `escala` NO MOTOR E PÕE UMA HABILIDADE ROBUSTA EM CADA UMA DAS DEZ CLASSES.
//
// O que este script faz, em quatro partes independentes:
//
//   1) MOTOR (CombatSystem.js) — costura EscalaDerivada.js no golpe e na
//      prévia. Nenhum ponto cria um caminho de dano novo: todos entram na
//      formação da BASE, antes de qualquer multiplicador. Mais o tipo
//      `provocar`, que só empurra o status que AmeacaSystem já lê.
//   2) PRÉVIA (BattleForecast.js) — repassa `escala` para a estimativa, para
//      o número mostrado antes de confirmar ser o número que vai sair.
//   3) IA (AutoBattleAI.js) — faz a escolha de turno enxergar a escala. SEM
//      ISTO NADA ACONTECE: ver a seção correspondente em EscalaDerivada.js.
//   4) DADOS (skillTrees.json) — um nó por classe.
//
// POR QUE UM SCRIPT E NÃO EDIÇÃO DIRETA. Os três arquivos de código e a
// árvore estão sendo trabalhados por outra sessão ao mesmo tempo. Um script
// com âncoras verificadas pode ser rodado DEPOIS que ela comitar, sobre o
// arquivo que existir naquele momento, sem que eu precise adivinhar agora o
// que ela vai ter mudado.
//
// É IDEMPOTENTE E DESISTE EM VEZ DE CHUTAR. Se uma âncora sumir — porque a
// outra sessão reescreveu aquele trecho — ele para e diz qual, sem gravar
// nada. Se uma âncora aparecer DUAS vezes, ele também para: foi essa guarda
// que pegou o fato de `estimarFaixaDano` replicar a fórmula de `rolarAtaque`,
// e remendar só uma das duas teria feito a prévia mentir para o jogador.
//
// Uso:  node scripts/aplicar-escala-derivada.mjs            (simulação)
//       node scripts/aplicar-escala-derivada.mjs --escrever
import fs from "node:fs";

const RAIZ = new URL("../", import.meta.url);
const COMBATE = new URL("src/systems/CombatSystem.js", RAIZ);
const PREVISAO = new URL("src/systems/BattleForecast.js", RAIZ);
const IA = new URL("src/systems/AutoBattleAI.js", RAIZ);
const ARVORES = new URL("src/data/skillTrees.json", RAIZ);
const escrever = process.argv.includes("--escrever");

// Cada remendo: âncora exata (`de`), substituição (`para`) e a marca que
// prova que já foi aplicado. A marca é procurada no arquivo inteiro antes de
// tudo — é ela que torna o script idempotente.
const REMENDOS = [
  {
    nome: "import do módulo",
    marca: `from "./EscalaDerivada.js"`,
    de: `import { escalaDoMonstro, escalaDeNivel } from "./EscalaSystem.js";`,
    para: `import { escalaDoMonstro, escalaDeNivel } from "./EscalaSystem.js";
import { bonusDeEscala, seloDeEscala, criarStatusProvocar } from "./EscalaDerivada.js";`,
  },
  {
    nome: "rolarAtaque aceita `escala`",
    marca: `respeitaFormacao = true, escala = null, magico = false } = {}) {
    const { critico: criticoBase`,
    de: `rolarAtaque(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true, magico = false } = {}) {`,
    para: `rolarAtaque(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true, escala = null, magico = false } = {}) {`,
  },
  {
    nome: "rolarAtaque soma a escala na base",
    marca: `// ESCALA DERIVADA (ver EscalaDerivada.js)`,
    // A âncora inclui a linha SEGUINTE porque `let base = ...` aparece duas
    // vezes no arquivo — aqui e em estimarFaixaDano, que replica a fórmula.
    de: `    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) {`,
    para: `    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    // ESCALA DERIVADA (ver EscalaDerivada.js). Entra ANTES do multiplicador,
    // somando à base: é uma segunda fonte para a mesma habilidade, não um
    // caminho de dano paralelo. O teto está no próprio módulo.
    //
    // O selo sai daqui mesmo, e não de um remendo separado: \`bonusEscala\` só
    // existe nesta linha, e \`selos\` já nasceu acima. Um número que aparece do
    // nada na tela é indistinguível de bug.
    const bonusEscala = bonusDeEscala(atacante, escala, base);
    base += bonusEscala;
    const seloEsc = seloDeEscala(escala, bonusEscala);
    if (seloEsc) selos.push(seloEsc);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) {`,
  },
  {
    nome: "estimarFaixaDano aceita `escala`",
    marca: `respeitaFormacao = true, escala = null, magico = false } = {}) {
    const alvoDef`,
    de: `  estimarFaixaDano(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true, magico = false } = {}) {`,
    para: `  estimarFaixaDano(atacante, alvo, { multiplicador = 1, atributoForcado = null, ignoraDefesa = 0, elementoAtacante = null, respeitaFormacao = true, escala = null, magico = false } = {}) {`,
  },
  {
    nome: "estimarFaixaDano soma a escala (prévia não pode mentir)",
    marca: `// mesma escala do golpe real`,
    de: `    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) base *= 1 + furiaBuff.valor;`,
    para: `    let base = (atacante.ataque.dano || 0) + Math.floor(baseAtributo * 0.3);
    // mesma escala do golpe real — se a prévia não somasse, o jogador veria
    // um número e receberia outro, que é pior do que não ter prévia.
    base += bonusDeEscala(atacante, escala, base);
    base *= multiplicador;
    const furiaBuff = atacante.statusEffects.find((s) => s.tipo === "buff_ataque_proximo");
    if (furiaBuff) base *= 1 + furiaBuff.valor;`,
  },
  {
    nome: "dano_magico soma a escala",
    marca: `// escala derivada no ramo mágico`,
    de: `          let dano = (atacante.atributos.INT * habilidade.multiplicador) * (0.85 + Math.random() * 0.3);`,
    para: `          // escala derivada no ramo mágico — mesma regra do físico: soma na
          // base, antes do multiplicador da habilidade.
          const baseMagica = atacante.atributos.INT + bonusDeEscala(atacante, habilidade.escala, atacante.atributos.INT);
          let dano = (baseMagica * habilidade.multiplicador) * (0.85 + Math.random() * 0.3);`,
  },
  {
    nome: "cura soma a escala",
    marca: `// escala derivada na cura de alvo`,
    de: `        let cura = Math.round(atributoCura * habilidade.multiplicador * (0.9 + Math.random() * 0.2));`,
    para: `        // escala derivada na cura de alvo — é isto que faz o clérigo curar
        // mais por ser grande, e não só por ser sábio.
        const baseCura = atributoCura + bonusDeEscala(atacante, habilidade.escala, atributoCura);
        let cura = Math.round(baseCura * habilidade.multiplicador * (0.9 + Math.random() * 0.2));`,
  },
  {
    nome: "cura_area soma a escala",
    marca: `// escala derivada na cura de área`,
    de: `          let cura = Math.round(Math.max(atacante.atributos.INT || 0, atacante.atributos.CON || 0) * habilidade.multiplicador * (0.9 + Math.random() * 0.2));`,
    para: `          // escala derivada na cura de área
          const attrCuraArea = Math.max(atacante.atributos.INT || 0, atacante.atributos.CON || 0);
          const baseCuraArea = attrCuraArea + bonusDeEscala(atacante, habilidade.escala, attrCuraArea);
          let cura = Math.round(baseCuraArea * habilidade.multiplicador * (0.9 + Math.random() * 0.2));`,
  },
  {
    nome: "repasse de `escala` nos ramos de dano físico",
    marca: `atributoForcado: attr, elementoAtacante: habilidade.elemento, escala: habilidade.escala`,
    de: `        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, atributoForcado: attr, elementoAtacante: habilidade.elemento });`,
    para: `        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, atributoForcado: attr, elementoAtacante: habilidade.elemento, escala: habilidade.escala });`,
  },
  {
    nome: "repasse de `escala` em dano_ignora_defesa",
    marca: `respeitaFormacao: false, escala: habilidade.escala });`,
    de: `        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, ignoraDefesa: 999, elementoAtacante: habilidade.elemento, respeitaFormacao: false });`,
    para: `        const r = this.rolarAtaque(atacante, alvoOuAlvos, { multiplicador: habilidade.multiplicador, ignoraDefesa: 999, elementoAtacante: habilidade.elemento, respeitaFormacao: false, escala: habilidade.escala });`,
  },
  {
    nome: "repasse de `escala` em dano_area",
    marca: `            respeitaFormacao: false,
            escala: habilidade.escala,`,
    de: `            elementoAtacante: habilidade.elemento,
            respeitaFormacao: false,
          });`,
    para: `            elementoAtacante: habilidade.elemento,
            respeitaFormacao: false,
            escala: habilidade.escala,
          });`,
  },
  {
    nome: "tipo `provocar`",
    marca: `case "provocar": {`,
    de: `      case "buff_ataque": {`,
    para: `      // PROVOCAR — a alavanca ativa de aggro. AmeacaSystem já multiplicava a
      // ameaça de quem estivesse com este status por 6; faltava algo que o
      // criasse. Sem isto, tankar era só ser naturalmente robusto, sem
      // nenhuma decisão de turno envolvida.
      case "provocar": {
        atacante.statusEffects = atacante.statusEffects.filter((s) => s.tipo !== "provocar");
        atacante.statusEffects.push(criarStatusProvocar(habilidade));
        this.registrar(\`\${atacante.nome} usa \${habilidade.nome} e atrai a atenção dos inimigos!\`);
        eventos.push({ tipo: "status", alvo: atacante.id, valor: "provocar" });
        break;
      }
      case "buff_ataque": {`,
  },
];

// BattleForecast monta as opções da prévia num lugar só.
const REMENDOS_PREVISAO = [
  {
    nome: "opcoesDeDano repassa `escala`",
    marca: `if (habilidade.escala) opts.escala = habilidade.escala;`,
    de: `  if (habilidade.atributoForcado) opts.atributoForcado = habilidade.atributoForcado;`,
    para: `  if (habilidade.escala) opts.escala = habilidade.escala;
  if (habilidade.atributoForcado) opts.atributoForcado = habilidade.atributoForcado;`,
  },
];

// A IA ordena habilidade por multiplicador cru em quatro lugares, e por isso
// nunca escolheria uma habilidade cujo poder vem de um bônus plano.
const REMENDOS_IA = [
  {
    nome: "import do multiplicador efetivo",
    marca: `from "./EscalaDerivada.js"`,
    de: `const TIPOS_OFENSIVOS = ["dano_fisico", "dano_magico", "dano_fisico_des", "dano_ignora_defesa", "debuff_velocidade"];`,
    para: `import { multiplicadorEfetivo } from "./EscalaDerivada.js";

const TIPOS_OFENSIVOS = ["dano_fisico", "dano_magico", "dano_fisico_des", "dano_ignora_defesa", "debuff_velocidade"];`,
  },
  {
    nome: "ultimate usa o multiplicador efetivo",
    marca: `multiplicadorEfetivo(b, jogador) - multiplicadorEfetivo(a, jogador)`,
    de: `  return [...ofensivas].sort((a, b) => (b.multiplicador || 0) - (a.multiplicador || 0) || String(a.id).localeCompare(String(b.id)))[0];`,
    para: `  return [...ofensivas].sort((a, b) => multiplicadorEfetivo(b, jogador) - multiplicadorEfetivo(a, jogador) || String(a.id).localeCompare(String(b.id)))[0];`,
  },
  {
    nome: "melhorPorMultiplicador recebe o personagem",
    marca: `function melhorPorMultiplicador(lista, jogador)`,
    de: `function melhorPorMultiplicador(lista) {
  if (!lista.length) return null;
  return [...lista].sort((a, b) => (b.multiplicador || 0) - (a.multiplicador || 0) || String(a.id).localeCompare(String(b.id)))[0];
}`,
    para: `function melhorPorMultiplicador(lista, jogador) {
  if (!lista.length) return null;
  return [...lista].sort((a, b) => multiplicadorEfetivo(b, jogador) - multiplicadorEfetivo(a, jogador) || String(a.id).localeCompare(String(b.id)))[0];
}`,
  },
  {
    nome: "valeAPenaArea compara efetivo contra efetivo",
    marca: `melhorAlvoUnico, jogador = null) {`,
    de: `export function valeAPenaArea(habArea, nInimigos, melhorAlvoUnico) {
  if (!habArea || nInimigos < 2) return false;
  const ganhoArea = (habArea.multiplicador || 1) * nInimigos;
  const ganhoUnico = (melhorAlvoUnico && melhorAlvoUnico.multiplicador) || 1;`,
    para: `export function valeAPenaArea(habArea, nInimigos, melhorAlvoUnico, jogador = null) {
  if (!habArea || nInimigos < 2) return false;
  const ganhoArea = (multiplicadorEfetivo(habArea, jogador) || 1) * nInimigos;
  const ganhoUnico = (melhorAlvoUnico && multiplicadorEfetivo(melhorAlvoUnico, jogador)) || 1;`,
  },
  {
    nome: "chamada: cura de time",
    marca: `TIPOS_CURA_TIME), jogador)`,
    de: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_CURA_TIME))`,
    para: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_CURA_TIME), jogador)`,
  },
  {
    nome: "chamada: buff de time",
    marca: `TIPOS_BUFF_TIME), jogador)`,
    de: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_BUFF_TIME))`,
    para: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_BUFF_TIME), jogador)`,
  },
  {
    nome: "chamada: debuff de área",
    marca: `TIPOS_DEBUFF_AREA), jogador)`,
    de: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_DEBUFF_AREA))`,
    para: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_DEBUFF_AREA), jogador)`,
  },
  {
    nome: "chamada: área ofensiva",
    marca: `TIPOS_AREA), jogador)`,
    de: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_AREA))`,
    para: `melhorPorMultiplicador(habilidadesDisponiveis(jogador, TIPOS_AREA), jogador)`,
  },
  {
    nome: "chamada: valeAPenaArea",
    marca: `valeAPenaArea(area, vivos.length, ultimate, jogador)`,
    de: `valeAPenaArea(area, vivos.length, ultimate)`,
    para: `valeAPenaArea(area, vivos.length, ultimate, jogador)`,
  },
  {
    // Remendo SEPARADO, com marca propria. Na primeira tentativa eu pendurei
    // este import no remendo de cima, cuja `marca` e apenas
    // `from "./EscalaDerivada.js"` — que ja estava no arquivo. O script
    // declarou "ja aplicado" e nao adicionou nada. Marca larga demais e um
    // falso positivo de idempotencia: ele mente dizendo que fez.
    nome: "import do poder por turno",
    marca: `from "./ValorDeHabilidade.js"`,
    de: `import { multiplicadorEfetivo } from "./EscalaDerivada.js";`,
    para: `import { multiplicadorEfetivo } from "./EscalaDerivada.js";
import { poderAgora } from "./ValorDeHabilidade.js";`,
  },
  {
    nome: "escolha de turno enxerga a escala (sort inline que faltava)",
    marca: `poderAgora(b, jogador) - poderAgora(a, jogador)`,
    // ESTE REMENDO FALTOU NA PRIMEIRA VERSAO e o erro era caro: `ultimate` e
    // `melhorPorMultiplicador` foram corrigidos, mas a escolha FINAL de
    // habilidade ofensiva e um sort inline separado, por `multiplicador` cru.
    // Resultado: uma habilidade de escala (multiplicador nominal 1,0) nunca
    // era lancada no turno — e quando ela ERA a ultimate, `preservarUltimate`
    // a excluia das candidatas fora de chefe. Ou seja, ficava de fora dos
    // dois jeitos.
    //
    // Aqui e `poderAgora`, e NAO `valorPorTurno`: todas as candidatas ja
    // passaram pelo filtro de recarga e Eter, entao estao disponiveis neste
    // turno. Descontar recarga aqui faria a IA fugir da habilidade pesada
    // justamente no turno em que ela esta pronta.
    de: `    const melhor = [...candidatas].sort((a, b) => (b.multiplicador || 0) - (a.multiplicador || 0))[0];`,
    para: `    const melhor = [...candidatas].sort((a, b) => poderAgora(b, jogador) - poderAgora(a, jogador) || String(a.id).localeCompare(String(b.id)))[0];`,
  },
];

function aplicarRemendos(texto, lista) {
  const relato = [];
  for (const r of lista) {
    if (texto.includes(r.marca)) { relato.push(`  = ${r.nome}: já aplicado`); continue; }
    const ocorrencias = texto.split(r.de).length - 1;
    if (ocorrencias === 0) throw new Error(`âncora NÃO encontrada: ${r.nome}\n  procurava: ${r.de.slice(0, 90)}…`);
    if (ocorrencias > 1) throw new Error(`âncora AMBÍGUA (${ocorrencias} ocorrências): ${r.nome}`);
    texto = texto.replace(r.de, r.para);
    relato.push(`  + ${r.nome}`);
  }
  return { texto, relato };
}

// ---------------------------------------------------------------- 4) DADOS
//
// UMA habilidade por classe, cada uma no idioma da classe. Não é a mesma
// habilidade com dez nomes: as fontes e os tipos são diferentes de propósito,
// porque senão "todas as classes escalam com vida" seria só mais um eixo
// único substituindo o eixo único anterior.
//
// CALIBRAÇÃO — e como ela foi feita errado da primeira vez. Os fatores saíram
// de uma medição, classe por classe, do `multiplicadorEfetivo` de TODAS as
// habilidades no nível 25 com o equipamento sintético do benchmark. O alvo é
// PARIDADE com a melhor habilidade existente da classe: a robusta tem de ser
// uma escolha de verdade, não um upgrade automático nem enfeite.
//
// A primeira calibração usou fatores chutados (defesa 0,35–0,5) e todas as
// habilidades ficaram claramente abaixo da concorrência. Pior: a medição que
// deveria ter mostrado isso estava lendo `p.defesa` de uma FICHA, onde defesa
// não existe — é derivada, vem de `defesaTotal`. Então as quatro habilidades
// que escalam com defesa apareciam com bônus zero e o erro se escondia atrás
// de um segundo erro. Os números abaixo vêm da medição corrigida.
export const NOS_NOVOS = [
  {
    classe: "guerreiro", ramo: "baluarte", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "guerreiro_represalia", icone: "⚔️", nome: "Represália",
    descricao: "Golpe que converte a própria defesa em dano. Quanto melhor a armadura, mais dói.",
    habilidade: { tipo: "dano_fisico", custoMP: 4, cooldown: 1, multiplicador: 1.0, escala: { de: "defesa", fator: 1.9 } },
  },
  {
    classe: "guerreiro", ramo: "baluarte", tier: 2, nivelRequerido: 4, requerRamo: 1,
    id: "guerreiro_provocar", icone: "🗯️", nome: "Chamado do Baluarte",
    descricao: "Atrai para si a atenção dos inimigos por dois turnos.",
    habilidade: { tipo: "provocar", custoMP: 4, cooldown: 3, duracao: 2 },
  },
  {
    classe: "paladino", ramo: "paladino_1", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "paladino_desafio", icone: "🗯️", nome: "Desafio Sagrado",
    descricao: "Um juramento em voz alta: os inimigos precisam responder a você.",
    habilidade: { tipo: "provocar", custoMP: 5, cooldown: 3, duracao: 3 },
  },
  {
    classe: "paladino", ramo: "paladino_1", tier: 5, nivelRequerido: 10, requerRamo: 3,
    id: "paladino_martelo_votivo", icone: "🔨", nome: "Martelo Votivo",
    descricao: "O peso do juramento cai junto com o martelo: o dano cresce com a defesa.",
    habilidade: { tipo: "dano_fisico", custoMP: 4, cooldown: 1, multiplicador: 1.1, escala: { de: "defesa", fator: 0.95 } },
  },
  {
    classe: "barbaro", ramo: "furia", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "barbaro_sangue_fervente", icone: "♨️", nome: "Sangue Fervente",
    descricao: "Cada ponto de vida já perdido vira força. Inútil inteiro; devastador quase morto.",
    habilidade: { tipo: "dano_fisico", custoMP: 3, cooldown: 1, multiplicador: 1.0, escala: { de: "vidaPerdida", fator: 0.35 } },
  },
  {
    classe: "clerigo", ramo: "luz", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "clerigo_bencao_vital", icone: "💗", nome: "Bênção Vital",
    descricao: "Divide a própria vitalidade com o grupo: a cura cresce com a vida máxima de quem conjura.",
    habilidade: { tipo: "cura_area", custoMP: 8, cooldown: 2, multiplicador: 1.0, escala: { de: "vidaMaxima", fator: 0.54 } },
  },
  {
    classe: "druida", ramo: "druida_2", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "druida_casca_carvalho", icone: "🌳", nome: "Casca de Carvalho",
    descricao: "A vitalidade do druida vira seiva para o grupo inteiro.",
    habilidade: { tipo: "cura_area", custoMP: 9, cooldown: 3, multiplicador: 0.9, escala: { de: "vidaMaxima", fator: 0.2 } },
  },
  {
    classe: "necromante", ramo: "necromante_2", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "necromante_pacto_carne", icone: "🦴", nome: "Pacto de Carne",
    descricao: "Oferece a própria massa vital como combustível: o feitiço cresce com a vida máxima.",
    habilidade: { tipo: "dano_magico", custoMP: 6, cooldown: 1, multiplicador: 1.0, escala: { de: "vidaMaxima", fator: 0.16 } },
  },
  {
    classe: "mago", ramo: "runas", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "mago_descarga_runica", icone: "💥", nome: "Descarga Rúnica",
    descricao: "Descarrega a armadura rúnica de uma vez em todos os inimigos. O dano cresce com a defesa.",
    habilidade: { tipo: "dano_area", custoMP: 10, cooldown: 2, multiplicador: 0.85, escala: { de: "defesa", fator: 2.35 } },
  },
  {
    classe: "ladino", ramo: "trapaca", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "ladino_finta_couracada", icone: "🃏", nome: "Finta Couraçada",
    descricao: "Usa a própria guarda como alavanca para um golpe único e preciso.",
    habilidade: { tipo: "dano_fisico_des", custoMP: 4, cooldown: 1, multiplicador: 1.0, escala: { de: "defesa", fator: 2.75 } },
  },
  {
    classe: "patrulheiro", ramo: "vinculo", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "patrulheiro_arco_pesado", icone: "🏹", nome: "Arco de Guerra",
    descricao: "Um arco que só o fôlego sustenta: o dano cresce com a vida máxima.",
    habilidade: { tipo: "dano_fisico", custoMP: 4, cooldown: 1, multiplicador: 1.0, escala: { de: "vidaMaxima", fator: 0.56 } },
  },
  {
    classe: "bardo", ramo: "bardo_1", tier: 4, nivelRequerido: 8, requerRamo: 2,
    id: "bardo_canto_muralha", icone: "🧱", nome: "Canto da Muralha",
    descricao: "O fôlego do bardo vira fôlego do time: a cura cresce com a vida máxima dele.",
    habilidade: { tipo: "cura_area", custoMP: 9, cooldown: 3, multiplicador: 0.85, escala: { de: "vidaMaxima", fator: 0.18 } },
  },
];

function montarNo(d) {
  return {
    id: d.id, icone: d.icone, ramo: d.ramo, tier: d.tier, custo: 1,
    nivelRequerido: d.nivelRequerido, requerRamo: d.requerRamo,
    nome: d.nome, descricao: d.descricao, tipoConcedido: "ativa",
    habilidade: { id: `${d.id}_skill`, nome: d.nome, descricao: d.descricao, ...d.habilidade },
  };
}

function inserirNos(arvores) {
  const relato = [];
  for (const d of NOS_NOVOS) {
    const arv = arvores[d.classe];
    if (!arv || !Array.isArray(arv.nos)) throw new Error(`classe sem árvore: ${d.classe}`);
    if (!(arv.ramos || []).some((r) => r.id === d.ramo)) {
      throw new Error(`ramo inexistente: ${d.classe}/${d.ramo} (ramos: ${(arv.ramos || []).map((r) => r.id).join(", ")})`);
    }
    if (arv.nos.some((n) => n.id === d.id)) { relato.push(`  = ${d.classe}/${d.nome}: já existe`); continue; }
    arv.nos.push(montarNo(d));
    relato.push(`  + ${d.classe.padEnd(12)} ${d.nome} — ${d.habilidade.tipo}${d.habilidade.escala ? ` · escala ${d.habilidade.escala.de} x${d.habilidade.escala.fator}` : ""}`);
  }
  return relato;
}

// ------------------------------------------------------------------- CORPO

let combate;
let previsao;
let ia;
try {
  combate = aplicarRemendos(fs.readFileSync(COMBATE, "utf8"), REMENDOS);
  previsao = aplicarRemendos(fs.readFileSync(PREVISAO, "utf8"), REMENDOS_PREVISAO);
  ia = aplicarRemendos(fs.readFileSync(IA, "utf8"), REMENDOS_IA);
} catch (e) {
  console.error(`ERRO no código — NADA foi gravado.\n${e.message}`);
  process.exit(1);
}

const arvores = JSON.parse(fs.readFileSync(ARVORES, "utf8"));
let relatoArvore;
try {
  relatoArvore = inserirNos(arvores);
} catch (e) {
  console.error(`ERRO nas árvores — NADA foi gravado.\n${e.message}`);
  process.exit(1);
}

console.log(escrever ? "GRAVANDO" : "(simulação — use --escrever)");
console.log("\nMotor (CombatSystem.js):");
combate.relato.forEach((l) => console.log(l));
console.log("\nPrévia (BattleForecast.js):");
previsao.relato.forEach((l) => console.log(l));
console.log("\nIA automática (AutoBattleAI.js):");
ia.relato.forEach((l) => console.log(l));
console.log("\nÁrvores (skillTrees.json):");
relatoArvore.forEach((l) => console.log(l));

if (escrever) {
  fs.writeFileSync(COMBATE, combate.texto, "utf8");
  fs.writeFileSync(PREVISAO, previsao.texto, "utf8");
  fs.writeFileSync(IA, ia.texto, "utf8");
  fs.writeFileSync(ARVORES, `${JSON.stringify(arvores, null, 2)}\n`, "utf8");
  console.log("\ngravado.");
}
