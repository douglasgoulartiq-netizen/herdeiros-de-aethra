// Criação de personagem em etapas, com identidade narrativa persistente.
import { criarPersonagem, atributosEfetivos } from "../systems/CharacterFactory.js";
import { infoAfinidade, descreverBonus } from "../systems/AffinitySystem.js";
import {
  MOTIVACOES, INTERESSES, COMBINACOES, combinacoesDe, relacoesParaCard, habilidadeNoElemento,
  REPUTACAO_ORIGEM, ATRIBUTO_DO_EMBLEMA, SINTONIA_UNIVERSAL, CUSTO_TROCA_AFILIACAO,
  LOJA_DA_ORIGEM, DESCONTO_LOJA_ORIGEM,
} from "../systems/IdentidadeSystem.js";

export const ETAPAS_CRIACAO = ["nome", "raca", "classe", "elemento", "antecedente", "traco", "faccao", "preferencias", "resumo"];

const APRESENTACAO_ETAPAS = {
  nome: { icone: "✦", nome: "Identidade" },
  raca: { icone: "◈", nome: "Raça" },
  classe: { icone: "⚔", nome: "Classe" },
  elemento: { icone: "◆", nome: "Elemento" },
  antecedente: { icone: "⌂", nome: "Origem" },
  traco: { icone: "◉", nome: "Personalidade" },
  faccao: { icone: "⚑", nome: "Facção" },
  preferencias: { icone: "♥", nome: "Motivações" },
  resumo: { icone: "✓", nome: "Revisão" },
};

export const PREFERENCIAS_CRIACAO = [
  { id: "exploracao", icone: "🧭", nome: "Exploração", descricao: "Descobrir lugares e caminhos esquecidos." },
  { id: "combate", icone: "⚔️", nome: "Combate", descricao: "Superar inimigos e provar sua força." },
  { id: "magia", icone: "🔮", nome: "Magia", descricao: "Estudar o Éter, runas e fenômenos arcanos." },
  { id: "natureza", icone: "🌿", nome: "Natureza", descricao: "Proteger criaturas, florestas e ciclos vivos." },
  { id: "tesouros", icone: "💎", nome: "Tesouros", descricao: "Encontrar relíquias e recompensas raras." },
  { id: "historias", icone: "📖", nome: "Histórias", descricao: "Conhecer povos, lendas e decisões do mundo." },
  { id: "artesanato", icone: "🔨", nome: "Artesanato", descricao: "Forjar, melhorar e colecionar equipamentos." },
  { id: "diplomacia", icone: "🤝", nome: "Diplomacia", descricao: "Criar alianças e mudar o destino das facções." },
];

export const MOTIVACOES_CRIACAO = [
  { id: "descoberta", icone: "🗺️", nome: "Descoberta", descricao: "Quero revelar o que ninguém encontrou." },
  { id: "justica", icone: "⚖️", nome: "Justiça", descricao: "Quero proteger quem não consegue lutar." },
  { id: "legado", icone: "👑", nome: "Legado", descricao: "Quero deixar um nome que sobreviva ao tempo." },
  { id: "liberdade", icone: "🕊️", nome: "Liberdade", descricao: "Não aceitarei correntes nem destinos impostos." },
  { id: "redencao", icone: "🌅", nome: "Redenção", descricao: "Quero reparar um passado que ainda me persegue." },
  { id: "poder", icone: "✨", nome: "Poder", descricao: "Quero dominar forças que outros temem." },
];

const ELEMENTOS_DE_HEROI = new Set(["fogo", "agua", "gelo", "natureza", "terra", "raio", "vento", "radiante", "sombrio", "arcano"]);
const NOMES_POR_RACA = {
  humano: ["Liora", "Cael", "Mira", "Darian", "Seren"], elfo: ["Aelwyn", "Thalion", "Lethira", "Eryndor", "Sylvaine"],
  anao: ["Brynja", "Dagrim", "Thrain", "Runna", "Brokk"], orc: ["Krusha", "Ghazak", "Rhaska", "Vurg", "Mordak"],
  halfling: ["Pippa", "Merric", "Tobber", "Wyn", "Mellow"], draconato: ["Aurexia", "Kaethrys", "Zephyrion", "Vexahl", "Ashkaris"],
};
const PERFIS_DE_CLASSE = {
  guerreiro: { elementos: ["terra", "fogo", "radiante"], antecedentes: ["soldado", "nobre"], tracos: ["corajoso", "resistente", "cauteloso"], faccoes: ["coroa_de_aethra", "forja_dos_anoes_cinzentos", "legiao_das_cinzas"], preferencias: ["combate", "artesanato", "diplomacia"], motivacoes: ["justica", "legado"] },
  mago: { elementos: ["arcano", "gelo", "raio", "sombrio"], antecedentes: ["sabio", "eremita"], tracos: ["visao_aguçada", "cauteloso", "sortudo"], faccoes: ["ordem_dos_arquivistas", "cavaleiros_do_vento_uivante"], preferencias: ["magia", "historias", "exploracao"], motivacoes: ["descoberta", "poder"] },
  ladino: { elementos: ["sombrio", "vento"], antecedentes: ["criminoso", "andarilho_do_povo"], tracos: ["sortudo", "visao_aguçada", "ganancioso"], faccoes: ["caravana_de_karn", "confraria_do_farol", "cla_dos_ventos_dourados"], preferencias: ["tesouros", "exploracao", "historias"], motivacoes: ["liberdade", "redencao"] },
  clerigo: { elementos: ["radiante", "agua", "natureza"], antecedentes: ["eremita", "nobre", "andarilho_do_povo"], tracos: ["cauteloso", "resistente", "corajoso"], faccoes: ["guardioes_da_folha", "coroa_de_aethra", "andarilhos_do_pantano"], preferencias: ["diplomacia", "historias", "natureza"], motivacoes: ["justica", "redencao"] },
  barbaro: { elementos: ["fogo", "terra", "raio"], antecedentes: ["eremita", "soldado"], tracos: ["resistente", "corajoso", "sortudo"], faccoes: ["legiao_das_cinzas", "cla_dos_ventos_dourados", "forja_dos_anoes_cinzentos"], preferencias: ["combate", "exploracao", "natureza"], motivacoes: ["liberdade", "legado"] },
  patrulheiro: { elementos: ["natureza", "vento", "agua"], antecedentes: ["eremita", "andarilho_do_povo", "soldado"], tracos: ["visao_aguçada", "cauteloso", "resistente"], faccoes: ["guardioes_da_folha", "andarilhos_do_pantano", "cavaleiros_do_vento_uivante"], preferencias: ["exploracao", "natureza", "historias"], motivacoes: ["descoberta", "justica"] },
};

const escolher = (lista, random = Math.random) => lista?.length ? lista[Math.min(lista.length - 1, Math.floor(random() * lista.length))] : null;
const idsValidos = (preferidos, disponiveis) => { const ids = new Set(disponiveis.map((x) => x.id)); return preferidos.filter((id) => ids.has(id)); };
export const elementosDisponiveis = (dados) => (((dados || {}).elements || {}).elementos || []).filter((e) => ELEMENTOS_DE_HEROI.has(e.id));
const CAMPOS_TRAVAVEIS = [
  ["nome", "Nome"], ["raca", "Raça"], ["classe", "Classe"], ["elemento", "Elemento"],
  ["antecedente", "Origem"], ["traco", "Personalidade"], ["faccao", "Facção"],
  ["motivacao", "Motivação"], ["preferencias", "Gostos"],
];

// Sorteia um arquétipo inteiro, em vez de campos isolados sem relação.
export function gerarCriacaoAleatoria(dados, random = Math.random) {
  const raca = escolher(dados.races, random);
  const classe = escolher(dados.classes, random);
  const perfil = PERFIS_DE_CLASSE[classe.id] || {};
  const elementos = elementosDisponiveis(dados);
  const faccoes = (dados.worldStateVariables?.facoes || []).filter((f) => f.id !== "vila");
  const pool = (preferidos, disponiveis) => idsValidos(preferidos || [], disponiveis);
  const antecedentes = pool(perfil.antecedentes, dados.backgrounds);
  const tracos = pool(perfil.tracos, dados.traits);
  const elementosCoerentes = pool(perfil.elementos, elementos);
  const faccoesCoerentes = pool(perfil.faccoes, faccoes);
  const gostos = pool(perfil.preferencias, PREFERENCIAS_CRIACAO);
  const motivacoes = pool(perfil.motivacoes, MOTIVACOES_CRIACAO);
  return {
    nome: escolher(NOMES_POR_RACA[raca.id] || ["Aventureiro"], random), raca: raca.id, classe: classe.id,
    elemento: escolher(elementosCoerentes.length ? elementosCoerentes : elementos.map((e) => e.id), random),
    antecedente: escolher(antecedentes.length ? antecedentes : dados.backgrounds.map((b) => b.id), random),
    traco: escolher(tracos.length ? tracos : dados.traits.map((t) => t.id), random),
    faccao: escolher(faccoesCoerentes.length ? faccoesCoerentes : faccoes.map((f) => f.id), random),
    preferencias: gostos.slice(0, 2).length ? gostos.slice(0, 2) : ["exploracao"],
    motivacao: escolher(motivacoes.length ? motivacoes : MOTIVACOES_CRIACAO.map((m) => m.id), random),
  };
}

export function aplicarCriacaoAleatoriaComTravas(estado, dados, random = Math.random) {
  const sorteio = gerarCriacaoAleatoria(dados, random);
  const travas = estado.travas instanceof Set ? estado.travas : new Set(estado.travas || []);
  CAMPOS_TRAVAVEIS.forEach(([campo]) => {
    const valorAtual = estado[campo];
    const preenchido = Array.isArray(valorAtual) ? valorAtual.length > 0 : valorAtual != null && valorAtual !== "";
    if (!travas.has(campo) || !preenchido) estado[campo] = Array.isArray(sorteio[campo]) ? [...sorteio[campo]] : sorteio[campo];
  });
  estado.travas = travas;
  return estado;
}

// `efeitos`: [[ícone, texto], ...] — o que a escolha FAZ no jogo, com o
// selo de onde ela pesa (ver LEGENDA_ONDE_PESA). Spans e não lista: o card é
// um <button>, que só aceita conteúdo de frase.
function criarCard({ titulo, descricao = "", meta = "", efeitos = [], selecionada, onClick, classe = "" }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `opcao-card ${classe}${selecionada ? " selecionada" : ""}`.trim();
  card.setAttribute("aria-pressed", selecionada ? "true" : "false");
  const linhas = efeitos.filter(([, texto]) => texto)
    .map(([icone, texto]) => `<span class="opcao-efeito"><i aria-hidden="true">${icone}</i>${texto}</span>`).join("");
  card.innerHTML = `<h3>${titulo}</h3>${descricao ? `<p>${descricao}</p>` : ""}${meta ? `<p class="opcao-meta">${meta}</p>` : ""}${linhas ? `<span class="opcao-efeitos">${linhas}</span>` : ""}`;
  card.onclick = onClick;
  return card;
}

// Onde cada escolha pesa, com o mesmo ícone em todos os cards.
const LEGENDA_ONDE_PESA = "Onde pesa: ⚔️ batalha · 🗺️ exploração · 💬 conversas · 📈 progresso · 🤝 facções";
const ONDE_PESA_TRACO_RACIAL = {
  adaptavel: "📈", olhos_da_floresta: "⚔️🗺️", pele_de_pedra: "⚔️", furia_orc: "⚔️", sorte_miuda: "⚔️", sopro_elemental: "⚔️",
};
const ICONE_MOTIVACAO = { descoberta: "🗺️", justica: "⚔️", legado: "📈", liberdade: "⚔️", redencao: "⚔️", poder: "📈" };
const ICONE_INTERESSE = {
  exploracao: "🗺️", combate: "📈", magia: "⚔️", natureza: "🗺️", tesouros: "🗺️", historias: "📈", artesanato: "📈", diplomacia: "🤝",
};
const NOME_ATRIBUTO = { FOR: "Força", DES: "Destreza", CON: "Constituição", INT: "Inteligência" };
const listaHumana = (itens) => itens.length <= 1 ? (itens[0] || "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;

// Classes com quem a raça tem afinidade, por nome.
function classesAfinsDaRaca(racaId, dados) {
  const entrada = dados.affinities && dados.affinities[racaId];
  if (!entrada || !Array.isArray(entrada.classesAfins)) return [];
  if (entrada.classesAfins.length >= (dados.classes || []).length) return ["todas as classes"];
  return entrada.classesAfins.map((id) => (dados.classes.find((c) => c.id === id) || { nome: id }).nome);
}

// O kit da origem, por extenso: "2× Poção de Vida Pequena".
function kitDaOrigem(b, dados) {
  const kit = Array.isArray(b.itensIniciais) ? b.itensIniciais : b.itemInicial ? [{ id: b.itemInicial, qtd: 1 }] : [];
  return kit.map(({ id, qtd = 1 }) => {
    const item = (dados.items?.itens || []).find((i) => i.id === id);
    return item ? `${qtd > 1 ? `${qtd}× ` : ""}${item.nome}` : null;
  }).filter(Boolean);
}

// Quantos testes do mundo usam a perícia — dá a medida de quanto ela aparece.
const testesDaPericia = (pericia, dados) => (dados.skillChecks || []).filter((t) => t.pericia === pericia).length;

// A loja onde a origem é de casa (ver LOJA_DA_ORIGEM em IdentidadeSystem.js),
// escrita com o nome da facção e não com o id.
function lojaDeCasa(antecedenteId, dados) {
  const loja = LOJA_DA_ORIGEM[antecedenteId];
  if (!loja) return "";
  const facoes = (dados.worldStateVariables && dados.worldStateVariables.facoes) || [];
  const nome = (facoes.find((f) => f.id === loja.faccaoId) || {}).nome || loja.faccaoId;
  return `−${Math.round(DESCONTO_LOJA_ORIGEM * 100)}% de preço nas lojas de ${nome}: ${loja.motivo}.`;
}

// Tudo que as escolhas atuais fazem, para a revisão ("Onde suas escolhas
// aparecem"). Cada linha: [ícone, título, texto].
function efeitosDaIdentidade(estado, dados) {
  const achar = (lista, id) => (lista || []).find((x) => x.id === id);
  const linhas = [];
  const raca = achar(dados.races, estado.raca);
  const classe = achar(dados.classes, estado.classe);
  if (raca) linhas.push([ONDE_PESA_TRACO_RACIAL[raca.traco] || "⚔️", `Raça — ${raca.nome}`, raca.descricaoTraco]);
  const afinidade = raca && classe ? infoAfinidade(raca.id, classe.id, dados.affinities) : null;
  if (afinidade) linhas.push(["🔗", "Afinidade de raça e classe", `${afinidade.resumo} (${afinidade.texto.split(":")[0]}).`]);
  if (classe) {
    const habilidades = classe.habilidades.map((h) => habilidadeNoElemento(h, estado.elemento).nome);
    linhas.push(["⚔️", `Classe — ${classe.nome}`, `Começa com ${listaHumana(habilidades)}.`]);
  }
  const elemento = achar(dados.elements?.elementos, estado.elemento);
  if (elemento) {
    const r = relacoesParaCard(elemento.id, dados.elements, dados.monsters);
    const sintonia = SINTONIA_UNIVERSAL[elemento.id]
      ? "golpes físicos +8% contra qualquer alvo"
      : `golpes físicos +15% a +25% contra ${r.criaturasFracas} tipos de criatura fracos a ${elemento.nome.toLowerCase()}`;
    linhas.push(["⚔️", `Elemento — ${elemento.nome}`, `Golpes de ${elemento.nome.toLowerCase()} +15%, dano recebido dele −15%; ${sintonia}; terreno e clima de ${elemento.nome.toLowerCase()} dão defesa e MP.`]);
    if (raca && raca.id === "draconato") linhas.push(["🔥", "Sopro Elemental", `Sai em ${elemento.nome.toLowerCase()}, com chance de deixar o estado dele.`]);
  }
  const origem = achar(dados.backgrounds, estado.antecedente);
  if (origem) {
    const kit = kitDaOrigem(origem, dados);
    linhas.push(["💬", `Origem — ${origem.nome}`, `Perícia ${origem.pericia} (${testesDaPericia(origem.pericia, dados)} testes no mundo), ${origem.ouroInicial} de ouro${kit.length ? ` e ${listaHumana(kit)}` : ""}.`]);
  }
  const traco = achar(dados.traits, estado.traco);
  if (traco) linhas.push(["⚔️", `Personalidade — ${traco.nome}`, traco.descricao]);
  const faccao = achar(dados.worldStateVariables?.facoes, estado.faccao);
  if (faccao) {
    const atr = ATRIBUTO_DO_EMBLEMA[faccao.id];
    linhas.push(["🤝", `Facção — ${faccao.nome}`, `Começa Respeitado (+${REPUTACAO_ORIGEM})${atr ? ` e com o emblema do seu povo (+1 ${atr})` : ""}. A origem é para sempre; trocar de afiliação custa ${CUSTO_TROCA_AFILIACAO} de reputação.`]);
  }
  const motivacao = MOTIVACOES_CRIACAO.find((m) => m.id === estado.motivacao);
  if (motivacao) linhas.push([ICONE_MOTIVACAO[motivacao.id] || "📈", `Motivação — ${motivacao.nome}`, MOTIVACOES[motivacao.id]?.efeito || ""]);
  (estado.preferencias || []).forEach((id) => {
    const p = PREFERENCIAS_CRIACAO.find((x) => x.id === id);
    if (p) linhas.push([ICONE_INTERESSE[id] || "📈", `Interesse — ${p.nome}`, INTERESSES[id]?.efeito || ""]);
  });
  return linhas;
}

export function montarCriacaoPersonagem(container, dados, onFinalizar) {
  const estado = { nome: "", raca: null, classe: null, elemento: null, antecedente: null, traco: null, faccao: null, preferencias: [], motivacao: null, etapaIdx: 0, modoHistoria: false, travas: new Set() };
  const lista = (painel, classe = "") => { const el = document.createElement("div"); el.className = `grid-opcoes ${classe}`.trim(); painel.appendChild(el); return el; };
  const textoApoio = (painel, texto) => { const p = document.createElement("p"); p.className = "criacao-intro"; p.textContent = texto; painel.appendChild(p); };
  const botao = (texto, onclick, classe = "") => { const b = document.createElement("button"); b.type = "button"; b.className = classe; b.textContent = texto; b.onclick = onclick; return b; };
  const navegacao = (painel, valido) => {
    const proxima = APRESENTACAO_ETAPAS[ETAPAS_CRIACAO[estado.etapaIdx + 1]];
    const a = document.createElement("div"); a.className = "criacao-navegacao";
    const contexto = document.createElement("span"); contexto.className = "criacao-navegacao-status"; contexto.textContent = proxima ? `Próxima etapa: ${proxima.nome}` : "Pronto para começar";
    const voltar = botao("← Voltar", () => { estado.etapaIdx--; render(); }, "criacao-voltar");
    const prox = botao(proxima ? `Continuar: ${proxima.nome} →` : "Continuar →", () => { estado.etapaIdx++; render(); }, "primario criacao-continuar");
    prox.disabled = !valido();
    a.append(contexto, voltar, prox); painel.appendChild(a);
  };
  const tituloSecao = (painel, texto) => { const h = document.createElement("h3"); h.className = "criacao-secao-titulo"; h.textContent = texto; painel.appendChild(h); };
  const nomeDe = (listaDados, id) => listaDados?.find((item) => item.id === id)?.nome || "";

  const montarResumoEscolhas = () => {
    const itens = [
      ["Nome", estado.nome],
      ["Raça", nomeDe(dados.races, estado.raca)],
      ["Classe", nomeDe(dados.classes, estado.classe)],
      ["Elemento", nomeDe(elementosDisponiveis(dados), estado.elemento)],
      ["Origem", nomeDe(dados.backgrounds, estado.antecedente)],
      ["Personalidade", nomeDe(dados.traits, estado.traco)],
      ["Facção", nomeDe(dados.worldStateVariables?.facoes, estado.faccao)],
      ["Motivação", nomeDe(MOTIVACOES_CRIACAO, estado.motivacao)],
      ["Interesses", estado.preferencias.map((id) => nomeDe(PREFERENCIAS_CRIACAO, id)).filter(Boolean).join(", ")],
    ].filter(([, valor]) => valor);
    if (!itens.length) return null;
    const resumo = document.createElement("section"); resumo.className = "criacao-escolhas"; resumo.setAttribute("aria-label", "Resumo das escolhas atuais");
    const cabecalho = document.createElement("div"); cabecalho.className = "criacao-escolhas-cabecalho";
    const rotulo = document.createElement("b"); rotulo.textContent = "Seu herói até aqui";
    const contagem = document.createElement("span"); contagem.textContent = `${itens.length}/9 escolhas definidas`; cabecalho.append(rotulo, contagem);
    const listaEscolhas = document.createElement("div"); listaEscolhas.className = "criacao-escolhas-lista";
    itens.forEach(([nome, valor]) => { const item = document.createElement("span"); item.className = "criacao-escolha"; const legenda = document.createElement("small"); legenda.textContent = nome; const escolha = document.createElement("b"); escolha.textContent = valor; item.append(legenda, escolha); listaEscolhas.appendChild(item); });
    resumo.append(cabecalho, listaEscolhas); return resumo;
  };

  function render() {
    const etapa = ETAPAS_CRIACAO[estado.etapaIdx];
    container.innerHTML = "";
    const painel = document.createElement("div"); painel.className = "painel-criacao";
    const topo = document.createElement("div"); topo.className = "criacao-topo";
    const progresso = document.createElement("div"); progresso.className = "criacao-progresso"; progresso.setAttribute("aria-label", `Etapa ${estado.etapaIdx + 1} de ${ETAPAS_CRIACAO.length}`); progresso.innerHTML = ETAPAS_CRIACAO.map((id, i) => { const info = APRESENTACAO_ETAPAS[id]; return `<span class="criacao-passo${i < estado.etapaIdx ? " ativo concluido" : i === estado.etapaIdx ? " ativo atual" : ""}" title="${i + 1}. ${info.nome}"${i === estado.etapaIdx ? ' aria-current="step"' : ""}><i>${info.icone}</i><small>${info.nome}</small></span>`; }).join("");
    const aleatorio = botao("✨ Sortear escolhas livres", () => { aplicarCriacaoAleatoriaComTravas(estado, dados); estado.etapaIdx = ETAPAS_CRIACAO.length - 1; render(); }, "criacao-aleatoria");
    aleatorio.title = "Mantém as escolhas marcadas com cadeado e sorteia somente as demais.";
    topo.append(progresso, aleatorio);
    const titulo = document.createElement("h2"); titulo.className = "passo-titulo";
    const identificador = document.createElement("p"); identificador.className = "criacao-etapa-identificador"; identificador.textContent = `Etapa ${estado.etapaIdx + 1} de ${ETAPAS_CRIACAO.length} · ${APRESENTACAO_ETAPAS[etapa].nome}`;
    painel.append(topo, identificador, titulo); container.appendChild(painel);

    const resumoEscolhas = montarResumoEscolhas();
    if (resumoEscolhas && etapa !== "resumo") painel.appendChild(resumoEscolhas);

    const escolhasPreenchidas = CAMPOS_TRAVAVEIS.filter(([campo]) => Array.isArray(estado[campo]) ? estado[campo].length : estado[campo]);
    if (escolhasPreenchidas.length) {
      const travas = document.createElement("div"); travas.className = "criacao-travas"; travas.setAttribute("aria-label", "Escolhas preservadas no sorteio");
      const rotulo = document.createElement("span"); rotulo.className = "criacao-travas-rotulo"; rotulo.textContent = "Preservar no aleatório:"; travas.appendChild(rotulo);
      escolhasPreenchidas.forEach(([campo, nome]) => {
        const ativa = estado.travas.has(campo); const b = botao(`${ativa ? "🔒" : "🔓"} ${nome}`, () => { ativa ? estado.travas.delete(campo) : estado.travas.add(campo); render(); }, `criacao-trava${ativa ? " ativa" : ""}`);
        b.setAttribute("aria-pressed", ativa ? "true" : "false"); travas.appendChild(b);
      });
      painel.appendChild(travas);
    }
    if (estado.raca && estado.classe) {
      const racaAtual = dados.races.find((x) => x.id === estado.raca); const classeAtual = dados.classes.find((x) => x.id === estado.classe);
      const preview = document.createElement("div"); preview.className = "criacao-preview";
      preview.innerHTML = `<span class="criacao-preview-sprite" style="background-image:url('assets/sprites/pc_${estado.raca}_${estado.classe}.png')"></span><span><small>PRÉVIA DO HERÓI</small><b>${estado.nome || "Novo herói"}</b><em>${racaAtual?.nome || ""} · ${classeAtual?.nome || ""}</em></span>`;
      painel.appendChild(preview);
    }

    if (etapa === "nome") {
      titulo.textContent = "Como se chama seu herói?";
      textoApoio(painel, "Defina origem, afinidade elemental, personalidade, facção e o que move este herói.");
      const input = document.createElement("input"); input.type = "text"; input.maxLength = 28; input.placeholder = "Digite um nome..."; input.value = estado.nome;
      const avancar = () => { estado.nome = input.value.trim() || "Aventureiro"; estado.etapaIdx++; render(); };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") avancar(); });
      painel.append(input, botao("Definir nome e continuar →", avancar, "primario criacao-inicio")); setTimeout(() => input.focus(), 0); return;
    }
    if (etapa === "raca") {
      titulo.textContent = "Escolha sua raça"; textoApoio(painel, LEGENDA_ONDE_PESA); const grid = lista(painel);
      dados.races.forEach((r) => grid.appendChild(criarCard({
        titulo: r.nome, descricao: r.descricao, meta: Object.entries(r.bonus).map(([k, v]) => `+${v} ${k}`).join(" · "),
        efeitos: [[ONDE_PESA_TRACO_RACIAL[r.traco] || "⚔️", r.descricaoTraco], ["🔗", `Afinidade com ${listaHumana(classesAfinsDaRaca(r.id, dados))}.`]],
        selecionada: estado.raca === r.id, onClick: () => { estado.raca = r.id; render(); },
      }))); navegacao(painel, () => estado.raca);
    } else if (etapa === "classe") {
      titulo.textContent = "Escolha sua classe"; const grid = lista(painel);
      dados.classes.forEach((c) => {
        const afinidade = infoAfinidade(estado.raca, c.id, dados.affinities);
        const subclasses = ((dados.subclasses && dados.subclasses.subclasses) || []).filter((sc) => sc.classeId === c.id).length;
        const a = c.atributosBase || {};
        const card = criarCard({
          titulo: `${c.icone || ""} ${c.nome}`, descricao: c.descricao || "",
          meta: `HP ${c.vidaBase} · MP ${c.manaBase} · FOR ${a.FOR} DES ${a.DES} CON ${a.CON} INT ${a.INT}`,
          efeitos: [
            ["⚔️", `Começa com ${listaHumana(c.habilidades.map((h) => h.nome))}.`],
            afinidade ? ["🔗", `Afinidade com a sua raça: ${afinidade.resumo}.`] : ["", ""],
            subclasses ? ["📈", `No nível 10, escolhe entre ${subclasses} subclasses.`] : ["", ""],
          ],
          selecionada: estado.classe === c.id, onClick: () => { estado.classe = c.id; render(); },
        });
        const sprite = document.createElement("span"); sprite.className = "criacao-sprite"; sprite.style.backgroundImage = `url('assets/sprites/pc_${estado.raca}_${c.id}.png')`; card.prepend(sprite); grid.appendChild(card);
      }); navegacao(painel, () => estado.classe);
    } else if (etapa === "elemento") {
      titulo.textContent = "Escolha sua afinidade elemental";
      textoApoio(painel, "⚔️ O elemento vale em toda batalha: golpes dele +15% e dano dele contra você −15% (essência); seus golpes físicos acertam mais forte as criaturas fracas a ele (sintonia); e lutar em terreno ou clima dele dá defesa e MP a cada turno.");
      const grid = lista(painel, "grid-elementos");
      const classeAtual = dados.classes.find((c) => c.id === estado.classe);
      elementosDisponiveis(dados).forEach((e) => {
        const r = relacoesParaCard(e.id, dados.elements, dados.monsters);
        const forcaFraqueza = SINTONIA_UNIVERSAL[e.id]
          ? "Ninguém resiste a ele: sintonia +8% contra qualquer alvo."
          : `Forte contra ${listaHumana(r.forte) || "—"}${r.fraco.length ? ` · fraco contra ${listaHumana(r.fraco)}` : ""}.`;
        const magia = (classeAtual?.habilidades || []).map((h) => habilidadeNoElemento(h, e.id)).find((h) => h.elemento === e.id);
        grid.appendChild(criarCard({
          titulo: `${e.icone || "✦"} ${e.nome}`, descricao: forcaFraqueza,
          efeitos: [
            magia ? ["✨", `Sua magia inicial: ${magia.nome}.`] : ["", ""],
            estado.raca === "draconato" ? ["🔥", `Seu Sopro sai em ${e.nome.toLowerCase()}.`] : ["", ""],
          ],
          selecionada: estado.elemento === e.id, classe: "elemento-card", onClick: () => { estado.elemento = e.id; render(); },
        }));
      }); navegacao(painel, () => estado.elemento);
    } else if (etapa === "antecedente") {
      titulo.textContent = "Escolha seu antecedente";
      textoApoio(painel, "💬 A perícia da origem soma bônus nos testes de conversa e exploração que pedem por ela.");
      const grid = lista(painel);
      dados.backgrounds.forEach((b) => {
        const kit = kitDaOrigem(b, dados);
        grid.appendChild(criarCard({
          titulo: b.nome, descricao: b.descricao, meta: `${b.pericia} · ${b.ouroInicial} ouro`,
          efeitos: [
            kit.length ? ["🎒", `Começa com ${listaHumana(kit)}.`] : ["", ""],
            ["💬", `${b.pericia}: ${testesDaPericia(b.pericia, dados)} testes no mundo usam esta perícia.`],
            ["🗺️", lojaDeCasa(b.id, dados)],
          ],
          selecionada: estado.antecedente === b.id, onClick: () => { estado.antecedente = b.id; render(); },
        }));
      }); navegacao(painel, () => estado.antecedente);
    } else if (etapa === "traco") {
      titulo.textContent = "Defina sua personalidade"; textoApoio(painel, "⚔️ A personalidade entra em toda batalha — o card diz exatamente como."); const grid = lista(painel); dados.traits.forEach((t) => grid.appendChild(criarCard({ titulo: t.nome, descricao: t.descricao, selecionada: estado.traco === t.id, onClick: () => { estado.traco = t.id; render(); } }))); navegacao(painel, () => estado.traco);
    } else if (etapa === "faccao") {
      titulo.textContent = "Escolha sua facção de origem";
      textoApoio(painel, `🤝 Você começa Respeitado (+${REPUTACAO_ORIGEM}) pelo povo de onde veio, com o emblema dele no pescoço. A origem não muda nunca; a afiliação pode mudar depois, mas deixar uma facção custa ${CUSTO_TROCA_AFILIACAO} de reputação com ela.`);
      const grid = lista(painel);
      (dados.worldStateVariables.facoes || []).filter((f) => f.id !== "vila").forEach((f) => {
        const atr = ATRIBUTO_DO_EMBLEMA[f.id];
        const combo = COMBINACOES.find((c) => c.quando.faccao === f.id && Object.entries(c.quando).every(([k, v]) => k === "faccao" || estado[k] === v));
        grid.appendChild(criarCard({
          titulo: `${f.icone || "◆"} ${f.nome}`, descricao: f.descricao,
          efeitos: [
            atr ? ["📿", `Emblema: +1 de ${NOME_ATRIBUTO[atr]}.`] : ["", ""],
            combo ? ["✨", `Combinação com as suas escolhas: ${combo.nome}.`] : ["", ""],
          ],
          selecionada: estado.faccao === f.id, onClick: () => { estado.faccao = f.id; render(); },
        }));
      }); navegacao(painel, () => estado.faccao);
    } else if (etapa === "preferencias") {
      titulo.textContent = "O que move seu herói?"; textoApoio(painel, "Escolha uma motivação e até três interesses para esta jornada."); tituloSecao(painel, "Motivação principal"); const gm = lista(painel, "grid-compacto");
      MOTIVACOES_CRIACAO.forEach((m) => gm.appendChild(criarCard({ titulo: `${m.icone} ${m.nome}`, descricao: m.descricao, efeitos: [[ICONE_MOTIVACAO[m.id] || "📈", MOTIVACOES[m.id]?.efeito || ""]], selecionada: estado.motivacao === m.id, onClick: () => { estado.motivacao = m.id; render(); } }))); tituloSecao(painel, `Interesses (${estado.preferencias.length}/3)`); const gp = lista(painel, "grid-compacto");
      PREFERENCIAS_CRIACAO.forEach((p) => { const ativa = estado.preferencias.includes(p.id); gp.appendChild(criarCard({ titulo: `${p.icone} ${p.nome}`, descricao: p.descricao, efeitos: [[ICONE_INTERESSE[p.id] || "📈", INTERESSES[p.id]?.efeito || ""]], selecionada: ativa, onClick: () => { if (ativa) estado.preferencias = estado.preferencias.filter((id) => id !== p.id); else if (estado.preferencias.length < 3) estado.preferencias = [...estado.preferencias, p.id]; render(); } })); }); navegacao(painel, () => estado.motivacao && estado.preferencias.length);
    } else if (etapa === "resumo") {
      titulo.textContent = `A jornada de ${estado.nome}`; const personagem = criarPersonagem(estado, dados); personagem.modoHistoria = estado.modoHistoria;
      const encontrar = (listaDados, id) => listaDados.find((x) => x.id === id); const raca = encontrar(dados.races, estado.raca); const classe = encontrar(dados.classes, estado.classe); const antecedente = encontrar(dados.backgrounds, estado.antecedente); const traco = encontrar(dados.traits, estado.traco); const elemento = encontrar(elementosDisponiveis(dados), estado.elemento); const faccao = encontrar(dados.worldStateVariables.facoes, estado.faccao); const motivacao = encontrar(MOTIVACOES_CRIACAO, estado.motivacao); const gostos = estado.preferencias.map((id) => encontrar(PREFERENCIAS_CRIACAO, id)).filter(Boolean);
      // Atributos com afinidade e o que já vem vestido (anel do Nobre,
      // emblema da facção) — os números com que o herói entra em Aethra.
      const efetivos = atributosEfetivos(personagem, dados);
      const resumo = document.createElement("div"); resumo.className = "criacao-resumo"; resumo.innerHTML = `<div class="criacao-heroi-resumo" style="background-image:url('assets/sprites/pc_${estado.raca}_${estado.classe}.png')"></div><div class="resumo-identidade"><h3>${classe.icone || ""} ${raca.nome} ${classe.nome}</h3><p>${elemento.icone} <b>${elemento.nome}</b> · ${faccao.icone || "◆"} <b>${faccao.nome}</b></p><p>${motivacao.icone} <b>${motivacao.nome}</b> · ${antecedente.nome} · ${traco.nome}</p><div class="resumo-gostos">${gostos.map((g) => `<span>${g.icone} ${g.nome}</span>`).join("")}</div></div><div class="resumo-atributos">${[["FOR", "Força"], ["DES", "Destreza"], ["CON", "Constituição"], ["INT", "Inteligência"]].map(([id, nome]) => `<div class="stat-row"><span>${nome}</span><b>${efetivos[id]}</b></div>`).join("")}<div class="stat-row"><span>HP / MP</span><b>${personagem.hpMax} / ${personagem.mpMax}</b></div><div class="stat-row"><span>Ouro</span><b>${personagem.ouro}</b></div></div>`; painel.appendChild(resumo);
      // ONDE SUAS ESCOLHAS APARECEM: cada escolha com o que ela faz no jogo,
      // e as combinações que as escolhas atuais fecham.
      const efeitos = document.createElement("section"); efeitos.className = "criacao-efeitos-resumo"; efeitos.setAttribute("aria-label", "Onde suas escolhas aparecem");
      const combos = combinacoesDe(estado);
      efeitos.innerHTML = `<h4>Onde suas escolhas aparecem</h4><p class="criacao-legenda">${LEGENDA_ONDE_PESA}</p>`
        + `<div class="criacao-efeitos-lista">${efeitosDaIdentidade(estado, dados).map(([icone, rotulo, texto]) => `<div class="criacao-efeito-linha"><i aria-hidden="true">${icone}</i><div><b>${rotulo}</b><span>${texto}</span></div></div>`).join("")}</div>`
        + (combos.length ? `<div class="criacao-combinacoes">${combos.map((c) => `<div class="criacao-combinacao"><b>✨ Combinação: ${c.icone} ${c.nome}</b><span>${c.efeito}</span></div>`).join("")}</div>` : "");
      painel.appendChild(efeitos);
      const modo = document.createElement("label"); modo.className = "modo-historia-card"; const check = document.createElement("input"); check.type = "checkbox"; check.checked = estado.modoHistoria; check.onchange = () => { estado.modoHistoria = check.checked; personagem.modoHistoria = estado.modoHistoria; }; modo.append(check, document.createTextNode(" 📖 Modo História — inimigos 30% mais fracos, XP e ouro normais. Dá para ligar e desligar depois, em Acessibilidade.")); painel.appendChild(modo);
      const acoes = document.createElement("div"); acoes.className = "criacao-navegacao"; const pronto = document.createElement("span"); pronto.className = "criacao-navegacao-status"; pronto.textContent = "Tudo pronto para entrar em Aethra"; acoes.append(pronto, botao("← Voltar", () => { estado.etapaIdx--; render(); }, "criacao-voltar"), botao("Começar aventura →", () => onFinalizar(personagem), "primario criacao-continuar")); painel.appendChild(acoes);
    }
  }
  render();
}
