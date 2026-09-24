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

export function montarNavegacaoDaTela(raiz, cabecalho, titulo) {
  const contexto = navegacaoDaTela(titulo);
  if (!contexto) return;
  const nav = document.createElement("nav");
  nav.className = "hda-workspace-nav";
  nav.setAttribute("aria-label", contexto.grupo);
  const entradas = contexto.grupo === "Jornada"
    ? [["mapa", "Mapa"], ["missoes", "Missões"], ["compendio", "Códice"]]
    : contexto.grupo === "Companhia"
      ? [["estado", "Heróis"], ["party", "Formação"], ["equipamento", "Equipamento"], ["arvore", "Evolução"]]
      : [];
  // Companhia has its own section tabs; only add return navigation to services.
  const grupos = contexto.grupo === "Companhia" && titulo === "Companhia"
    ? [] : [entradas, contexto.atalhos];
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
