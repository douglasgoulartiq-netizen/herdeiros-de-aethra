// Navigation only: no ownership of game state and no duplicate modal/listeners.
export function navegacaoDaTela(titulo) {
  if (/Mapa de Aethra|Atlas do Mapa|Viagem Rápida/.test(titulo)) return {
    grupo: "Jornada", ativo: "mapa", atalhos: [["mapa", "Mapa"], ["viagem", "Viajar"], ["atlas", "Atlas ilustrado"]],
  };
  if (/Missões|Diário de Decisões/.test(titulo)) return {
    grupo: "Jornada", ativo: "missoes", atalhos: [["missoes", "Objetivos"], ["diario", "Decisões"], ["arquivo_missoes", "Histórico de missões"]],
  };
  if (/Códice/.test(titulo)) return { grupo: "Jornada", ativo: "compendio", atalhos: [] };
  if (titulo === "Forja & Alquimia") return { grupo: "Companhia", ativo: "equipamento", atalhos: [["equipamento", "Voltar ao equipamento"]] };
  if (titulo === "Companhia") return { grupo: "Companhia", ativo: "party", atalhos: [] };
  if (/Invocação|Histórico de invocações/.test(titulo)) return { grupo: "Invocar", ativo: "gacha", atalhos: [["gacha", "Invocar"], ["historico", "Histórico"], ["colecao", "Ver meus heróis"]] };
  return null;
}

// A RODA DOS SELOS TORNOU ESTA FAIXA UMA CÓPIA DO MENU.
//
// Até aqui, todo painel remontava no topo as entradas do GRUPO a que ele
// pertence — "Mapa · Missões · Códice" em Jornada, "Heróis · Formação ·
// Equipamento · Evolução" em Companhia. Isso fazia sentido quando a navegação
// era um trilho de quatro abas: para chegar a uma irmã era preciso reabrir a
// gaveta certa, e a faixa era o atalho.
//
// A Roda mostra as QUINZE ações de uma vez, a um toque. Conferido uma a uma:
// mapa, missoes, compendio, estado, party, equipamento e arvore estão todas
// lá. A faixa deixou de ser atalho e virou o mesmo menu impresso duas vezes —
// e cobrando o preço que mais dói, altura, justamente no celular, onde medi o
// cabeçalho empurrando o primeiro talento para 645px numa tela de 700.
//
// O QUE FICA. Os `atalhos` não são duplicação: viagem, atlas, diario,
// arquivo_missoes, historico e colecao NÃO existem na Roda — só se chega a
// eles por aqui. E "Voltar ao equipamento", na Forja, é botão de volta de uma
// subtela, não entrada de menu. Essa faixa continua.
export function montarNavegacaoDaTela(raiz, cabecalho, titulo) {
  const contexto = navegacaoDaTela(titulo);
  if (!contexto) return;
  const nav = document.createElement("nav");
  nav.className = "hda-workspace-nav";
  nav.setAttribute("aria-label", contexto.grupo);
  const grupos = [contexto.atalhos];
  for (const itens of grupos) {
    if (!itens.length) continue;
    const faixa = document.createElement("div");
    for (const [acao, rotulo] of itens) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.textContent = rotulo;
      botao.dataset.workspaceAction = acao;
      if (acao === contexto.ativo) botao.setAttribute("aria-current", "page");
      botao.onclick = () => document.dispatchEvent(new CustomEvent("hda-navegar", { detail: acao }));
      faixa.appendChild(botao);
    }
    nav.appendChild(faixa);
  }
  if (nav.childElementCount) cabecalho.after(nav);
}
