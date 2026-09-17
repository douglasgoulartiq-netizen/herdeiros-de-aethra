// Tela de ameaça pré-combate: mostra classificação (Trivial..Mortal),
// quantidade de inimigos, elementos detectados e se há chefe, antes de
// confirmar a entrada em batalha. O jogador pode lutar ou evitar o combate.
import { avaliarEncontro } from "../systems/ThreatSystem.js";
import { relacaoElemental } from "../systems/ElementSystem.js";
import { fecharModal } from "./GameUI.js";
import { dicasDoChefe } from "../systems/PreparacaoChefeSystem.js";
import { d20 } from "../systems/CombatSystem.js";
import { mostrarRolagemD20 } from "./DiceAnimation.js";
import { limparNotificacoes } from "./Notificacoes.js";
import { marcarInteracaoAutomatica } from "./HdaUI.js";

const overlay = () => document.getElementById("modal-overlay");
const conteudo = () => document.getElementById("modal-conteudo");

const SUFIXO_RELACAO_AMEACA = {
  vantagem_intensa: { texto: "✅✅", titulo: "Sua arma tem vantagem intensa contra este elemento" },
  vantagem: { texto: "✅", titulo: "Sua arma tem vantagem contra este elemento" },
  resistencia: { texto: "🛡️", titulo: "Sua arma sofre resistência deste elemento" },
  resistencia_intensa: { texto: "🛡️🛡️", titulo: "Sua arma sofre resistência intensa deste elemento" },
  imune: { texto: "🚫", titulo: "Este inimigo é imune ao elemento da sua arma" },
};

export function permiteEscolherEncontro(valorD20) {
  return Number(valorD20) > 12;
}

export function mostrarAmeaca(monstrosDef, personagens, dados, onLutar, onFugir, terrenoElemento = null, totalOndasExtras = 0, desafio = null) {
  const info = avaliarEncontro(personagens, monstrosDef);
  overlay().classList.remove("hidden");
  // Elemento da arma do personagem principal, usado só para dar uma prévia
  // de vantagem/resistência/imunidade contra os elementos detectados —
  // puramente informativo, não altera a IA nem o combate em si.
  const elementoArma = (personagens[0] && personagens[0].equipamento && personagens[0].equipamento.arma && personagens[0].equipamento.arma.elemento) || "fisico";
  const elementosHtml = info.elementosDetectados
    .map((elId) => {
      const el = (dados.elements && dados.elements.elementos || []).find((e) => e.id === elId);
      if (!el) return "";
      let sufixo = "";
      if (dados.elements && elementoArma !== "fisico" && elId !== "fisico") {
        const relacao = relacaoElemental(elementoArma, elId, dados.elements);
        const s = SUFIXO_RELACAO_AMEACA[relacao];
        if (s) sufixo = `<span title="${s.titulo}">${s.texto}</span>`;
      }
      return `<span title="${el.nome}" style="font-size:1.2em;margin-right:4px;">${el.icone}${sufixo}</span>`;
    })
    .join("");
  const nomesInimigos = [...new Set(monstrosDef.map((m) => m.nome))].join(", ");
  // Terreno (task #42): badge informativo mostrando o elemento dominante do
  // bioma/masmorra atual — o mesmo elemento fica mais forte para qualquer
  // atacante, mas os inimigos daqui têm resistência a ele (ver CombatSystem.js).
  const terrenoEl = terrenoElemento && dados.elements
    ? (dados.elements.elementos || []).find((e) => e.id === terrenoElemento)
    : null;
  const terrenoHtml = terrenoEl
    ? `<p title="Terreno: ${terrenoEl.nome} fica mais forte aqui, mas os inimigos locais resistem a ele.">🗺️ Terreno: ${terrenoEl.icone} ${terrenoEl.nome}</p>`
    : "";
  // Horda (task #47): avisa ANTES de entrar, já que é um desafio de
  // resistência sem cura entre ondas — o jogador precisa saber que não é
  // um combate comum antes de confirmar.
  const totalOndas = 1 + totalOndasExtras;
  const hordaHtml = totalOndasExtras > 0
    ? `<p style="color:#f5a524;font-weight:bold;" title="O time não recupera HP/MP entre as ondas.">🌊 HORDA! ${totalOndas} ondas de inimigos, sem descanso entre elas.</p>`
    : "";
  const dicas = dicasDoChefe(monstrosDef, personagens, dados);
  const dicasHtml = dicas.length ? `<section class="preparacao-chefe"><h3>Prepare sua estratégia</h3><ul>${dicas.map((d) => `<li>${d}</li>`).join("")}</ul></section>` : "";

  const temSolo = monstrosDef.length === 1 && monstrosDef[0].solo;
  conteudo().classList.toggle("preparacao-chefe-modal", !!info.temChefe);
  marcarInteracaoAutomatica(conteudo());
  // Fala do chefe (task #45): personalidade própria mostrada antes do
  // combate, só quando o encontro é exatamente o chefe único da zona (não
  // aparece em encontros comuns/hordas, que não têm o campo "fala").
  const falaChefe = monstrosDef.length === 1 && monstrosDef[0].chefe && monstrosDef[0].fala
    ? `<p style="font-style:italic;opacity:0.9;margin:8px 0;border-left:3px solid ${info.ameaca.cor};padding-left:8px;">${monstrosDef[0].fala}</p>`
    : "";
  conteudo().innerHTML = `
    <h2 style="color:${info.ameaca.cor};">${info.ameaca.icone} Ameaça: ${info.ameaca.nome}${info.temChefe ? " · 👑 Chefe" : ""}${temSolo ? " · 💪 Reforçado" : ""}</h2>
    <div id="modal-corpo">
      <p>${nomesInimigos}</p>
      ${desafio ? `<p class="desafio-d20-resultado ${desafio.sucesso ? "sucesso" : "falha"}">🎲 D20: <b>${desafio.valor}</b> · ${desafio.sucesso ? "você abriu uma rota de fuga" : "o inimigo bloqueou sua passagem"}</p>` : ""}
      ${falaChefe}
      <p>Inimigos detectados${totalOndasExtras > 0 ? " (1ª onda)" : ""}: <b>${info.quantidade}</b></p>
      ${hordaHtml}
      ${elementosHtml ? `<p>Elementos: ${elementosHtml}</p>` : ""}
      ${terrenoHtml}
      ${dicasHtml}
      <p style="font-size:0.8em;opacity:0.75">Diferença de nível em relação ao grupo: ${info.ameaca.diferenca > 0 ? "+" : ""}${info.ameaca.diferenca}</p>
      <div style="margin-top:10px;">
        <button class="btn-lutar primario">⚔️ Lutar</button>
        <button class="btn-fugir-ameaca">Evitar o combate</button>
      </div>
    </div>
  `;
  conteudo().querySelector(".btn-lutar").onclick = () => { fecharModal(); onLutar(); };
  conteudo().querySelector(".btn-fugir-ameaca").onclick = () => { fecharModal(); if (onFugir) onFugir(); };
}

// Todo encontro agora passa por uma única porta: a tela fica bloqueada,
// notificações antigas saem, o d20 é encenado e só depois aparece uma
// decisão. 13–20 abre Lutar/Fugir; 1–12 significa que o inimigo alcançou o
// grupo e a batalha começa, sem criar um segundo modal por cima do dado.
export async function mostrarDesafioAmeaca(monstrosDef, personagens, dados, onLutar, onFugir, terrenoElemento = null, totalOndasExtras = 0) {
  if (document.body.classList.contains("desafio-encontro-ativo")) return;
  document.body.classList.add("desafio-encontro-ativo");
  limparNotificacoes();
  fecharModal();
  const valor = d20();
  const sucesso = permiteEscolherEncontro(valor);
  try {
    await mostrarRolagemD20(
      { d: valor, total: valor, dificuldade: 13, sucesso },
      { titulo: "Desafio de encontro · escapar ou enfrentar" },
    );
  } finally {
    document.body.classList.remove("desafio-encontro-ativo");
  }
  if (!sucesso) {
    onLutar();
    return;
  }
  mostrarAmeaca(
    monstrosDef, personagens, dados, onLutar, onFugir,
    terrenoElemento, totalOndasExtras, { valor, sucesso },
  );
}
