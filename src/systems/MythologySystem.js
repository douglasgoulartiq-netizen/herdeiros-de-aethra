// Códice da Mitologia — camada fina sobre src/data/mythologyCodex.js, no
// mesmo espírito de CompendiumSystem.js: só deriva estado pra UI renderizar,
// não guarda nada de novo no save (o desbloqueio é sempre recalculado a
// partir de campos que o personagem já tem — nível, exploração, missões,
// abates, facção). Isso evita qualquer risco de quebrar saves antigos.
import { MYTHOLOGY_CHAPTERS } from "../data/mythologyCodex.js";

export function capitulosParaCompendio(personagem) {
  return MYTHOLOGY_CHAPTERS.map((cap) => ({
    id: cap.id,
    titulo: cap.titulo,
    epigrafe: cap.epigrafe || null,
    paragrafos: cap.paragrafos,
    desbloqueado: !!cap.condicao(personagem),
    condicaoDescricao: cap.condicaoDescricao,
  }));
}

export function progressoMitologia(personagem) {
  const capitulos = capitulosParaCompendio(personagem);
  const desbloqueados = capitulos.filter((c) => c.desbloqueado).length;
  return { desbloqueados, total: capitulos.length, percentual: Math.round((desbloqueados / capitulos.length) * 100) };
}
