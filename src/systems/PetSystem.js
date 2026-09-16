// PETS — o companheiro que trabalha FORA da batalha.
//
// O QUE FOI PEDIDO
// ----------------
// "adiciona uma aba de pets na aba de sumonar, para poder sumonar pets com
// habilidades de fora da batalha, que interajem com o mapa como ir até o baú
// e abrir e pegar as coisas, achar chefes com habilidades raras e esse pet
// durante as batalhas só podem ter um e ele dependendo do pet da um buff para
// o time todo de algum estatus"
//
// São três coisas distintas, e cada uma vira uma parte deste módulo:
//
//   1. INVOCAR   pets saem do mesmo balcão do gacha e custam os mesmos
//                Fragmentos de Aethra. Não inventei uma segunda moeda: uma
//                moeda a mais é uma decisão a mais para o jogador tomar sem
//                ter informação para tomá-la.
//
//   2. AGIR NO MAPA  o pet abre baú e colhe nó ao alcance, ou fareja chefe e
//                boca de masmorra ao longe. Ele age sozinho, num relógio
//                próprio — não a cada quadro, senão o mapa esvazia num
//                piscar e a exploração perde a graça.
//
//   3. BUFAR O TIME  um pet ativo por vez, e o ativo dá um bônus fixo a TODO
//                combatente do time. É o que faz a escolha do pet importar
//                antes de entrar na luta, e não durante.
//
// O QUE ESTE MÓDULO NÃO FAZ
// -------------------------
// Ele não abre baú nem coleta nada por conta própria: devolve QUAIS alvos o
// pet alcança, e quem executa é o main.js, chamando exatamente as mesmas
// funções que a tecla E chama. Duplicar a lógica de saque aqui criaria dois
// caminhos para "um baú foi aberto" — e o dia em que um deles ganhasse um
// teste de perícia, um bônus ou um registro de progresso, o outro ficaria
// para trás em silêncio.

// Um pet age a cada 3,5 segundos. O número sai do que se quer sentir: rápido
// o bastante para o jogador ver o bicho trabalhando enquanto anda, devagar o
// bastante para não limpar uma clareira inteira antes de ele chegar nela.
export const INTERVALO_ACAO_MS = 3500;

// Custo em Fragmentos de Aethra. Fica em pets.json junto ao elenco, para o
// balanceamento morar todo no mesmo lugar; este é só o valor de segurança.
export const CUSTO_PADRAO = 60;

const ORDEM_RARIDADE = ["comum", "incomum", "raro", "epico", "lendario"];
// Pesos de sorteio. Mesma forma da tabela do gacha de personagem, com a cauda
// um pouco mais gorda: o elenco de pets é pequeno (doze), e um lendário
// inalcançável num elenco desse tamanho é frustração, não raridade.
const CHANCES = { comum: 0.46, incomum: 0.30, raro: 0.16, epico: 0.06, lendario: 0.02 };

export function estadoInicialDePets() {
  return { possuidos: [], ativo: null, historico: 0 };
}

export function garantirEstadoDePets(personagem) {
  if (!personagem.pets) personagem.pets = estadoInicialDePets();
  const p = personagem.pets;
  if (!Array.isArray(p.possuidos)) p.possuidos = [];
  if (typeof p.historico !== "number") p.historico = 0;
  return p;
}

export function elencoDePets(catalogo) {
  return (catalogo && catalogo.pets) || [];
}

export function defDoPet(catalogo, id) {
  return elencoDePets(catalogo).find((p) => p.id === id) || null;
}

export function petsDoJogador(personagem, catalogo) {
  const estado = garantirEstadoDePets(personagem);
  return estado.possuidos.map((id) => defDoPet(catalogo, id)).filter(Boolean);
}

export function petAtivo(personagem, catalogo) {
  const estado = garantirEstadoDePets(personagem);
  if (!estado.ativo) return null;
  // Um pet que saiu da posse (save antigo, elenco alterado) não pode
  // continuar ativo — senão o bônus fica pendurado num bicho que não existe.
  if (!estado.possuidos.includes(estado.ativo)) return null;
  return defDoPet(catalogo, estado.ativo);
}

// SÓ UM ATIVO. É a regra que o pedido traz, e é o que dá peso à escolha:
// ativar um é desativar o outro, sempre.
export function ativarPet(personagem, id) {
  const estado = garantirEstadoDePets(personagem);
  if (id === null) { estado.ativo = null; return { ok: true, ativo: null }; }
  if (!estado.possuidos.includes(id)) return { ok: false, motivo: "nao_possui" };
  estado.ativo = estado.ativo === id ? null : id;   // clicar no ativo desativa
  return { ok: true, ativo: estado.ativo };
}

function sortearRaridade(rnd = Math.random) {
  const r = rnd();
  let acc = 0;
  for (const raridade of ["lendario", "epico", "raro", "incomum", "comum"]) {
    acc += CHANCES[raridade];
    if (r < acc) return raridade;
  }
  return "comum";
}

// Invocação. Devolve `duplicata: true` quando o pet sorteado já era do
// jogador — nesse caso os Fragmentos voltam pela metade, em vez de sumirem.
// Pet não tem nível nem fragmento de duplicata para gastar, então engolir a
// moeda inteira numa repetição seria só punição sem contrapartida.
export function invocarPet(personagem, catalogo, moeda, rnd = Math.random) {
  const estado = garantirEstadoDePets(personagem);
  const elenco = elencoDePets(catalogo);
  if (!elenco.length) return { ok: false, motivo: "sem_elenco" };
  const custo = (catalogo && catalogo.custoInvocacao) || CUSTO_PADRAO;
  if (!moeda || moeda.saldo() < custo) return { ok: false, motivo: "sem_fragmentos", custo };
  moeda.gastar(custo);

  const raridade = sortearRaridade(rnd);
  // Se a raridade sorteada não tem ninguém, desce até achar — nunca devolve
  // "nada" por causa de um buraco no elenco.
  let candidatos = [];
  for (let i = ORDEM_RARIDADE.indexOf(raridade); i >= 0 && !candidatos.length; i -= 1) {
    candidatos = elenco.filter((p) => p.raridade === ORDEM_RARIDADE[i]);
  }
  if (!candidatos.length) candidatos = elenco;
  const def = candidatos[Math.floor(rnd() * candidatos.length)];

  estado.historico += 1;
  if (estado.possuidos.includes(def.id)) {
    const devolvido = Math.floor(custo / 2);
    moeda.receber(devolvido);
    return { ok: true, duplicata: true, pet: def, devolvido };
  }
  estado.possuidos.push(def.id);
  // O primeiro pet entra ativo sozinho: obrigar um clique a mais para o bicho
  // recém-invocado começar a funcionar é atrito sem propósito.
  if (!estado.ativo) estado.ativo = def.id;
  return { ok: true, duplicata: false, pet: def };
}

// --- bônus de time ---------------------------------------------------------
// Aplicado a TODO combatente do time no começo da batalha, no mesmo ponto e
// do mesmo jeito que a camaradagem de facção (ver BattleUI.js). Chaves:
// FOR/DES/CON/INT somam atributo; `defesa`, `critico`, `eter` somam o valor
// já calculado do combatente.
export function bonusDoPetAtivo(personagem, catalogo) {
  const def = petAtivo(personagem, catalogo);
  return (def && def.buff) || null;
}

export function aplicarBonusDePet(combatente, personagem, catalogo) {
  const buff = bonusDoPetAtivo(personagem, catalogo);
  if (!buff || !combatente) return combatente;
  for (const [chave, valor] of Object.entries(buff)) {
    if (["FOR", "DES", "CON", "INT"].includes(chave)) {
      if (combatente.atributos) {
        combatente.atributos = { ...combatente.atributos };
        combatente.atributos[chave] = (combatente.atributos[chave] || 0) + valor;
      }
    } else if (chave === "defesa") {
      combatente.defesa = (combatente.defesa || 0) + valor;
    } else if (chave === "critico") {
      combatente.critBonus = (combatente.critBonus || 0) + valor;
    } else if (chave === "eter") {
      combatente.mpMax = (combatente.mpMax || 0) + valor;
      combatente.mp = (combatente.mp || 0) + valor;
    }
  }
  combatente.bonusPet = buff;
  return combatente;
}

// Texto do bônus, para a ficha do pet na tela de invocação.
export function textoDoBuff(buff) {
  if (!buff) return "";
  const nomes = { FOR: "Força", DES: "Destreza", CON: "Constituição", INT: "Inteligência",
    defesa: "Defesa", critico: "% de crítico", eter: "Éter" };
  return Object.entries(buff)
    .map(([k, v]) => `+${v} ${nomes[k] || k}`)
    .join(", ");
}

export function textoDaHabilidade(def) {
  if (!def || !def.mapa) return "";
  const m = def.mapa;
  if (m.tipo === "coletar") {
    const alvos = (m.alvos || []).map((a) => (a === "bau" ? "baús" : "nós de recurso")).join(" e ");
    const extra = m.achadoExtra ? `, com ${Math.round(m.achadoExtra * 100)}% de chance de achado extra` : "";
    return `Abre ${alvos} a até ${m.raio} passos${extra}.`;
  }
  if (m.tipo === "revelar") {
    const nome = { chefe: "chefes", masmorra: "bocas de masmorra", poi: "pontos de interesse", landmark: "marcos" };
    const alvos = (m.alvos || []).map((a) => nome[a] || a).join(", ");
    const coleta = m.tambemColeta ? ` Também abre baús a ${m.tambemColeta} passos.` : "";
    return `Fareja ${alvos} a até ${m.raio} passos.${coleta}`;
  }
  if (m.tipo === "tregua") {
    return `Reduz em ${Math.round((m.forca || 0) * 100)}% a chance de encontro enquanto você anda.`;
  }
  return "";
}

// --- ação no mapa ----------------------------------------------------------
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Quais alvos o pet ALCANÇA agora. Função pura: recebe as fontes do mapa e a
// posição do jogador, devolve o que fazer. Quem executa é o main.js.
//
// `fontes` é a lista que o índice de chunks já monta a cada quadro — o pet
// não varre o mundo, ele olha só o que já está carregado em volta, que é a
// mesma vizinhança que o jogador enxerga.
export function alvosDoPet(def, jogador, fontes, jaRevelados = new Set()) {
  const saida = { coletar: [], revelar: [] };
  if (!def || !def.mapa) return saida;
  const m = def.mapa;

  if (m.tipo === "coletar" || m.tambemColeta) {
    const raio = m.tipo === "coletar" ? m.raio : m.tambemColeta;
    const querBau = m.tipo !== "coletar" || (m.alvos || []).includes("bau");
    const querNo = (m.alvos || []).includes("no");
    for (const f of fontes) {
      if (dist(f, jogador) > raio) continue;
      if (f.tipo === "bau" && querBau && f.ref && !f.ref.aberto) saida.coletar.push(f);
      else if (f.tipo === "no" && querNo && f.ref && f.ref.disponivel) saida.coletar.push(f);
    }
    // Um alvo por vez. O pet trabalhando é uma coisa que se VÊ acontecendo;
    // esvaziar seis baús no mesmo instante vira um número subindo na tela.
    saida.coletar = saida.coletar.slice(0, 1);
  }

  if (m.tipo === "revelar") {
    const quer = new Set(m.alvos || []);
    for (const f of fontes) {
      if (!quer.has(f.tipo)) continue;
      if (dist(f, jogador) > m.raio) continue;
      const id = idDaFonte(f);
      if (!id || jaRevelados.has(id)) continue;
      saida.revelar.push({ fonte: f, id });
    }
    saida.revelar = saida.revelar.slice(0, 2);
  }
  return saida;
}

export function idDaFonte(f) {
  if (!f) return null;
  if (f.ref && f.ref.id) return `${f.tipo}:${f.ref.id}`;
  if (f.ref && f.ref.monstroId) return `${f.tipo}:${f.ref.monstroId}:${f.x},${f.y}`;
  if (f.ref && f.ref.nome) return `${f.tipo}:${f.ref.nome}`;
  return `${f.tipo}:${f.x},${f.y}`;
}

// Direção cardinal de um alvo, para o aviso dizer PARA ONDE ir. Sem isso
// "farejou um chefe" é uma notificação bonita que não muda nada do que o
// jogador faz em seguida.
export function rumoAte(de, para) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const vertical = Math.abs(dy) > Math.abs(dx) * 1.6;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.6;
  if (vertical) return dy < 0 ? "norte" : "sul";
  if (horizontal) return dx < 0 ? "oeste" : "leste";
  // Tabela explícita em vez de juntar pedaços: colar "nor" com "este" dá
  // "noreste", e só essa das quatro leva o D. O teste pegou.
  const diagonais = {
    "norte-oeste": "noroeste", "norte-leste": "nordeste",
    "sul-oeste": "sudoeste", "sul-leste": "sudeste",
  };
  return diagonais[`${dy < 0 ? "norte" : "sul"}-${dx < 0 ? "oeste" : "leste"}`];
}

// Fator multiplicador da chance de encontro. 1 = sem pet de trégua.
export function fatorDeTregua(personagem, catalogo) {
  const def = petAtivo(personagem, catalogo);
  if (!def || !def.mapa || def.mapa.tipo !== "tregua") return 1;
  return Math.max(0.2, 1 - (def.mapa.forca || 0));
}
