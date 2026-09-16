// Estado das cenas: o que já foi visto, o que uma escolha de cena faz com o
// mundo, e de onde sai a cena de abertura de cada questline regional.
//
// PERSISTÊNCIA. `personagem.estadoDoMundo.cenasVistas` é um array de ids.
// Fica dentro de estadoDoMundo pelo mesmo motivo que reputação e flags (ver
// WorldStateSystem.js): o objeto `personagem` inteiro já é serializado no
// save, então isto persiste sem exigir nenhum campo novo no contrato de save
// nem nenhuma migração. Um save antigo simplesmente não tem o array, e
// `garantirCenas` o cria vazio na primeira leitura — o que faz um jogador
// que já estava no meio da aventura ver a cena de abertura da próxima
// questline que aceitar, e nunca o prólogo (o prólogo só é disparado por
// jogo novo, em main.js, nunca por carregamento de save).
import { garantirEstadoDoMundo, alterarReputacao, definirFlag, registrarDecisao } from "./WorldStateSystem.js";
import { cutscenePorId, cutscenePorGatilho } from "../data/cutscenes.js";
import { questlineDaRegiao } from "../data/world/regionalQuests.js";

export function garantirCenas(personagem) {
  const estado = garantirEstadoDoMundo(personagem);
  if (!Array.isArray(estado.cenasVistas)) estado.cenasVistas = [];
  return estado.cenasVistas;
}

export function jaViu(personagem, cenaId) {
  return garantirCenas(personagem).includes(cenaId);
}

export function marcarVista(personagem, cenaId) {
  const vistas = garantirCenas(personagem);
  if (!vistas.includes(cenaId)) vistas.push(cenaId);
  return vistas;
}

// A cena de abertura de uma região: a escrita à mão quando existe, e senão
// uma montada a partir do que a própria questline já declara.
//
// Por que montar em vez de simplesmente não mostrar nada: `nome` e `revela`
// de cada questline (regionalQuests.js) foram escritos como promessa
// narrativa daquela linha ("que a vila depende de um bosque que ninguém
// entende, e que o Círculo sabe disso e não manda ninguém"). Esse texto é
// bom e já existe; exibi-lo como cena de abertura é melhor do que deixar
// doze das dezessete regiões entrarem sem nenhuma moldura — e é honesto,
// porque não inventa fato nenhum que o conteúdo não tenha declarado.
export function cenaDeAbertura(regiaoId) {
  const declarada = cutscenePorGatilho(`questline:${regiaoId}`);
  if (declarada) return declarada;

  const linha = questlineDaRegiao(regiaoId);
  if (!linha) return null;

  return {
    id: `abre_${regiaoId}`,
    titulo: linha.nome,
    gerada: true,
    paineis: [
      {
        arte: "regiao",
        texto: [
          `Uma linha começa aqui, e ela existe para mostrar ${linha.revela}.`,
          "Alguém nesta região decidiu que você é a pessoa certa para o primeiro passo. Ainda está por ver se é elogio.",
        ],
      },
    ],
  };
}

// Aplica o que uma escolha de cena faz com o mundo. Diferente do resto das
// cenas (que são texto e só), a escolha do prólogo mexe em reputação, flag e
// diário — e é de propósito: é a primeira lição de gramática do jogo, a de
// que uma resposta dada em voz alta fica registrada. Devolve o texto de
// resultado para a UI encenar.
export function aplicarEscolhaCena(personagem, cena, opcaoId, dadosWorldState) {
  const escolha = cena && cena.escolha;
  const opcao = escolha && (escolha.opcoes || []).find((o) => o.id === opcaoId);
  if (!opcao) return { ok: false };

  if (opcao.flag) definirFlag(personagem, opcao.flag);
  // A escolha da cena é registrada também como flag genérica da cena, para
  // que qualquer conteúdo futuro possa perguntar "o que ele respondeu?" sem
  // precisar conhecer o nome da flag específica de cada opção.
  definirFlag(personagem, `cena_${cena.id}`, opcao.id);

  const mudou = { reputacao: {} };
  if (opcao.reputacao) {
    Object.entries(opcao.reputacao).forEach(([facaoId, delta]) => {
      alterarReputacao(personagem, facaoId, delta, dadosWorldState);
      mudou.reputacao[facaoId] = delta;
    });
  }
  if (opcao.diario) registrarDecisao(personagem, opcao.diario);

  return { ok: true, opcao, texto: opcao.resultado, mudou };
}

// O que o jogador respondeu numa cena — para conteúdo futuro (falas de NPC,
// condições de quest) poder reagir ao prólogo sem depender de flags soltas.
export function respostaDaCena(personagem, cenaId) {
  const flags = garantirEstadoDoMundo(personagem).flags || {};
  const v = flags[`cena_${cenaId}`];
  return typeof v === "string" ? v : null;
}

export { cutscenePorId };
