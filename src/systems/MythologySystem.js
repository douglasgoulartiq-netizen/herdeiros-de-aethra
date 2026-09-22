// Códice da Mitologia — camada fina sobre src/data/mythologyCodex.js, no
// mesmo espírito de CompendiumSystem.js: só deriva estado pra UI renderizar,
// não guarda nada de novo no save (o desbloqueio é sempre recalculado a
// partir de campos que o personagem já tem — nível, exploração, missões,
// abates, facção). Isso evita qualquer risco de quebrar saves antigos.
import { MYTHOLOGY_CHAPTERS } from "../data/mythologyCodex.js";
import { temCombinacao } from "./IdentidadeSystem.js";

export function capitulosParaCompendio(personagem) {
  // Combinação Leitor do Arquivo (Sábio + Ordem dos Arquivistas): as
  // entradas que pedem nível abrem 3 níveis mais cedo. As outras condições
  // (lugares, missões, facção) não mudam.
  const leitor = temCombinacao(personagem, "leitor_do_arquivo");
  const quemLe = leitor ? { ...personagem, nivel: (personagem.nivel || 1) + 3 } : personagem;
  return MYTHOLOGY_CHAPTERS.map((cap) => ({
    id: cap.id,
    titulo: cap.titulo,
    epigrafe: cap.epigrafe || null,
    paragrafos: cap.paragrafos,
    desbloqueado: !!cap.condicao(quemLe),
    condicaoDescricao: cap.condicaoDescricao,
  }));
}

export function progressoMitologia(personagem) {
  const capitulos = capitulosParaCompendio(personagem);
  const desbloqueados = capitulos.filter((c) => c.desbloqueado).length;
  return { desbloqueados, total: capitulos.length, percentual: Math.round((desbloqueados / capitulos.length) * 100) };
}
