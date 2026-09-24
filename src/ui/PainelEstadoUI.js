// PAINEL "COMO VOCÊ ESTÁ" — a tela que faltava.
//
// O DIAGNÓSTICO (ver a auditoria do projeto): sete sistemas do jogo calculam
// bônus que entram no combate e nunca aparecem em lugar nenhum. O jogador
// sente o efeito e não tem como saber a causa:
//
//   • bônus de conjunto     — SetBonusSystem sabe quantas peças faltam
//   • passivas ativas       — PassiveSystem tem descreverPassivas() pronta
//   • sinergia de formação  — sinergiasAtivasPreview() pronta
//   • sinergia de facção    — sinergiaFaccaoPreview() pronta
//   • rivalidades e vínculos— paresRelacionamentoPreview() pronta
//   • óleo de arma          — statusDoOleo() dá os turnos restantes
//   • escala do mundo       — EscalaSystem sobe monstro até +75% e nada avisa
//
// Nenhuma dessas informações precisou ser calculada aqui: TODAS já existiam,
// cada uma exportando uma função de "preview" que ninguém chamava. Este
// arquivo é, quase inteiro, chamadas a funções que estavam prontas — o que
// mede bem o tamanho do problema que ele resolve.
//
// A ORGANIZAÇÃO da tela segue a pergunta do jogador, não a arquitetura do
// código: "o que está me ajudando", "o que está me atrapalhando", "o que
// falta pouco", "como está o mundo".
import { abrirModalBase } from "./GameUI.js";
import { LARGURA } from "./HdaUI.js";
import { conjuntosParaExibir } from "../systems/SetBonusSystem.js";
import { descreverPassivas } from "../systems/PassiveSystem.js";
import { sinergiasAtivasPreview } from "../systems/FormationSynergySystem.js";
import { sinergiaFaccaoPreview } from "../systems/FactionSynergySystem.js";
import { paresRelacionamentoPreview } from "../systems/RivalrySystem.js";
import { statusDoOleo } from "../systems/WeaponOilSystem.js";
import { bonusTotal, ataqueBase, defesaTotal, velocidadeTotal, critBonusTotal, calcularHpMax } from "../systems/CharacterFactory.js";
import { textoSubStatus, GRAU_COR } from "../systems/SubStatusSystem.js";
import { escalaDeNivel, NIVEL_LIMIAR } from "../systems/EscalaSystem.js";

export function montarPainelEstado(personagem, dados, contexto = {}) {
  const corpo = abrirModalBase("📋 Como você está", { largura: LARGURA.media });
  preencherPainelEstado(corpo, personagem, dados, contexto);
}

export function preencherPainelEstado(corpo, personagem, dados, contexto = {}) {
  const time = contexto.time || [personagem];

  corpo.appendChild(secaoNumeros(personagem, dados));
  corpo.appendChild(secaoAjudando(personagem, dados, time));
  corpo.appendChild(secaoFaltaPouco(personagem));
  corpo.appendChild(secaoAtrapalhando(personagem, time));
  corpo.appendChild(secaoMundo(personagem, dados, contexto));
}

// --- Seção 1: os números, e de onde eles vêm --------------------------------

function secaoNumeros(personagem, dados) {
  const s = bloco("Seus números agora", "Tudo somado: equipamento, árvore, afinidade, vínculos, conjuntos, Caminhos e sub-status de forja.");
  const b = bonusTotal(personagem, dados);
  const atq = ataqueBase(personagem, dados);

  const grade = document.createElement("div");
  grade.className = "estado-numeros";
  const fichas = [
    { rot: "Ataque", val: atq.dano, sub: `escala com ${atq.atributo}` },
    { rot: "Defesa", val: defesaTotal(personagem, dados), sub: b.defesaPercent ? `+${Math.round(b.defesaPercent * 100)}% de sub-status` : "" },
    { rot: "HP máximo", val: calcularHpMax(personagem, dados), sub: b.hpMaxPercent ? `+${Math.round(b.hpMaxPercent * 100)}% de bônus` : "" },
    { rot: "Velocidade", val: velocidadeTotal(personagem, dados), sub: "" },
    { rot: "Crítico", val: `${Math.round(critBonusTotal(personagem, dados) * 100)}%`, sub: "" },
  ];
  fichas.forEach((f) => {
    const el = document.createElement("div");
    el.className = "estado-ficha";
    el.innerHTML = `<span class="estado-ficha-rot">${f.rot}</span>
      <b class="estado-ficha-val">${f.val}</b>
      ${f.sub ? `<span class="estado-ficha-sub">${f.sub}</span>` : ""}`;
    grade.appendChild(el);
  });
  s.appendChild(grade);

  // Sub-status por item equipado: a única informação desta tela que o jogador
  // não consegue ver em NENHUM outro lugar depois de forjar.
  const comSub = Object.entries(personagem.equipamento || {})
    .filter(([, it]) => it && (it.subStats || []).length);
  if (comSub.length) {
    const lista = document.createElement("div");
    lista.className = "estado-subs";
    comSub.forEach(([slot, item]) => {
      const linha = document.createElement("div");
      linha.className = "estado-sub-linha";
      linha.innerHTML = `<span class="estado-sub-item">${item.nome}</span>
        ${item.subStats.map((sb) => `<span class="estado-sub-chip" style="border-color:${GRAU_COR[sb.grau] || "#c8b89a"}">${textoSubStatus(sb)}</span>`).join("")}`;
      lista.appendChild(linha);
    });
    s.appendChild(rotulo("Sub-status de forja"));
    s.appendChild(lista);
  }
  return s;
}

// --- Seção 2: o que está ajudando -------------------------------------------

function secaoAjudando(personagem, dados, time) {
  const s = bloco("O que está te ajudando", "");
  const itens = [];

  descreverPassivas(personagem).forEach((t) => itens.push({ icone: "◆", texto: t, tom: "bom" }));

  conjuntosParaExibir(personagem)
    .filter((c) => c.tiersAtivos > 0)
    .forEach((c) => itens.push({
      icone: "🛡️", tom: "bom",
      texto: `${c.nome} — ${c.equipadas}/${c.total} peças, ${c.tiersAtivos} bônus ativo${c.tiersAtivos > 1 ? "s" : ""}`,
    }));

  // As sinergias pedem a lista com classeId e posicao, que é como o time
  // chega do FormationSystem.
  const paraFormacao = time.filter(Boolean).map((m) => ({ classeId: m.classeId, posicao: m.posicao || "frente" }));
  sinergiasAtivasPreview(paraFormacao).forEach((sin) => itens.push({
    icone: "⚔️", tom: "bom",
    texto: `${sin.nome || "Sinergia de formação"}${sin.descricao ? ` — ${sin.descricao}` : ""}`,
  }));

  const facao = sinergiaFaccaoPreview(time.filter(Boolean), dados.worldStateVariables);
  if (facao) itens.push({
    icone: facao.icone || "🤝", tom: "bom",
    texto: `${facao.nome || "Sinergia de facção"}${facao.descricao ? ` — ${facao.descricao}` : ""}`,
  });

  const oleo = statusDoOleo(personagem);
  if (oleo) itens.push({
    icone: "🧴", tom: "aviso",
    texto: `Óleo de ${oleo.elemento} na arma — ${oleo.duracao} turno${oleo.duracao > 1 ? "s" : ""} restante${oleo.duracao > 1 ? "s" : ""}`,
  });

  s.appendChild(listaOuVazio(itens, "Nada ativo além do seu equipamento. Conjuntos, passivas e sinergias aparecem aqui quando existirem."));
  return s;
}

// --- Seção 3: o que falta pouco ---------------------------------------------

// A seção mais útil da tela, e a que o jogo nunca teve: "você está a uma peça
// de um bônus". Sem isso, um conjunto de 4 peças com 3 equipadas é
// indistinguível de nenhuma peça equipada.
function secaoFaltaPouco(personagem) {
  const s = bloco("Falta pouco", "");
  const itens = [];

  conjuntosParaExibir(personagem)
    .filter((c) => c.proximoTierEm)
    .forEach((c) => {
      const faltam = c.proximoTierEm - c.equipadas;
      itens.push({
        icone: "🔗", tom: faltam === 1 ? "quase" : "neutro",
        texto: `${c.nome}: ${c.equipadas}/${c.total} peças — falta${faltam > 1 ? "m" : ""} ${faltam} para o próximo bônus`,
      });
    });

  Object.entries(personagem.equipamento || {})
    .filter(([, it]) => it && (it.aprimoramento || 0) > 0 && (it.aprimoramento || 0) < 10)
    .forEach(([, item]) => {
      const proximoMarco = Math.ceil(((item.aprimoramento || 0) + 1) / 2) * 2;
      itens.push({
        icone: "⚒️", tom: "neutro",
        texto: `${item.nome}: +${item.aprimoramento} → o próximo sub-status vem em +${proximoMarco}`,
      });
    });

  s.appendChild(listaOuVazio(itens, "Nenhum bônus a um passo de distância."));
  return s;
}

// --- Seção 4: o que está atrapalhando ---------------------------------------

function secaoAtrapalhando(personagem, time) {
  const s = bloco("O que está te atrapalhando", "");
  const itens = [];

  paresRelacionamentoPreview(time.filter(Boolean)).forEach((par) => {
    const ruim = par.tipo === "rivalidade" || (par.efeito && par.efeito < 0);
    itens.push({
      icone: ruim ? "💢" : "💛", tom: ruim ? "ruim" : "bom",
      texto: `${par.nome || (ruim ? "Rivalidade" : "Vínculo")}${par.descricao ? ` — ${par.descricao}` : ""}`,
    });
  });

  // Item equipado cujo requisito o personagem não cumpre: já existe
  // penalidade no combate por isso, e ela nunca foi dita em lugar nenhum.
  Object.entries(personagem.equipamento || {}).forEach(([slot, item]) => {
    if (!item || !item.requisito) return;
    const falta = Object.entries(item.requisito)
      .filter(([attr, v]) => (personagem.atributos[attr] || 0) < v)
      .map(([attr, v]) => `${v - (personagem.atributos[attr] || 0)} de ${attr}`);
    if (falta.length) itens.push({
      icone: "⚠️", tom: "ruim",
      texto: `${item.nome} (${slot}): você não cumpre o requisito — falta ${falta.join(" e ")}. O item rende menos assim.`,
    });
  });

  s.appendChild(listaOuVazio(itens, "Nada te penalizando agora."));
  return s;
}

// --- Seção 5: como está o mundo ---------------------------------------------

// A ESCALA é a informação mais importante desta tela inteira. O EscalaSystem
// sobe todo monstro acima do nível 6 (até +70% de HP e +75% de ataque, e
// chefe ganha +130% de HP) e nada no jogo dizia isso. A sensação que sobrava
// era "não estou ficando mais forte" — quando a verdade é que o mundo cresceu
// junto, de propósito.
function secaoMundo(personagem, dados, contexto) {
  const s = bloco("Como está o mundo", "");
  const itens = [];

  const nivel = personagem.nivel || 1;
  if (nivel >= NIVEL_LIMIAR) {
    const e = escalaDeNivel(nivel);
    const pct = (v) => `${Math.round(((v || 1) - 1) * 100)}%`;
    itens.push({
      icone: "📈", tom: "neutro",
      texto: `Os monstros escalam com você desde o nível ${NIVEL_LIMIAR}: no seu nível eles têm +${pct(e.hp)} de HP, +${pct(e.atk)} de ataque e +${pct(e.defesa)} de defesa.`,
    });
  } else {
    itens.push({
      icone: "📈", tom: "neutro",
      texto: `A partir do nível ${NIVEL_LIMIAR} os monstros passam a escalar junto com você. Até lá, cada nível seu é ganho puro.`,
    });
  }

  if (contexto.clima) itens.push({ icone: "🌦️", tom: "neutro", texto: textoClima(contexto.clima, contexto.hora) });
  if (contexto.zonaNome) itens.push({
    icone: "📍", tom: "neutro",
    texto: `Você está em ${contexto.zonaNome}${contexto.zonaNivel ? ` (${contexto.zonaNivel})` : ""}.`,
  });
  // ESTA LISTA ESTAVA QUEBRADA DESDE QUE FOI ESCRITA. `eventosAtivos()`
  // devolve uma lista de IDs — strings — então `ev.nome` era sempre
  // undefined e o painel mostrava literalmente "Evento em curso:
  // ev_tempestade_eter_altaverde" para o jogador. O `ev.descricao` também
  // não existe em lugar nenhum dos dados; o campo escrito é `aviso`.
  // Agora o contexto traz `resumoDosEventos`, que devolve nome, aviso e os
  // efeitos já em português.
  (contexto.eventosAtivos || []).forEach((ev) => {
    if (typeof ev === "string") {
      itens.push({ icone: "⚠️", tom: "aviso", texto: `Evento em curso: ${ev}` });
      return;
    }
    const onde = ev.aqui ? "Aqui, agora" : "Em outra região";
    const efeitos = ev.efeitos && ev.efeitos.length ? ` <em>${ev.efeitos.join(" · ")}</em>` : "";
    itens.push({
      icone: ev.aqui ? "⚠️" : "🌍",
      tom: ev.aqui ? "aviso" : "neutro",
      texto: `<strong>${ev.nome}</strong> — ${onde}. ${ev.aviso}${efeitos}`,
    });
  });

  s.appendChild(listaOuVazio(itens, "Nada fora do comum."));
  return s;
}

function textoClima(clima, hora) {
  const partes = [];
  if (clima.nome) partes.push(clima.nome);
  if (hora && hora.nome) partes.push(hora.nome.toLowerCase());
  const base = partes.join(", ");
  if (clima.elementoBonus) return `${base} — golpes de ${clima.elementoBonus} rendem mais agora.`;
  return base || "Tempo comum.";
}

// --- Peças ------------------------------------------------------------------

function bloco(titulo, descricao) {
  const s = document.createElement("section");
  s.className = "estado-secao";
  s.innerHTML = `<h3 class="estado-titulo">${titulo}</h3>${descricao ? `<p class="estado-desc">${descricao}</p>` : ""}`;
  return s;
}

function rotulo(txt) {
  const r = document.createElement("p");
  r.className = "estado-rotulo";
  r.textContent = txt;
  return r;
}

function listaOuVazio(itens, textoVazio) {
  if (!itens.length) {
    const p = document.createElement("p");
    p.className = "estado-vazio";
    p.textContent = textoVazio;
    return p;
  }
  const ul = document.createElement("ul");
  ul.className = "estado-lista";
  itens.forEach((i) => {
    const li = document.createElement("li");
    li.className = `estado-item tom-${i.tom || "neutro"}`;
    li.innerHTML = `<span class="estado-item-icone">${i.icone}</span><span>${i.texto}</span>`;
    ul.appendChild(li);
  });
  return ul;
}
