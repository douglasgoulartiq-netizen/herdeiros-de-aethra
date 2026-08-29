// Controla o progresso e conclusão de missões.
export function iniciarMissao(personagem, questDef) {
  if (personagem.missoesAtivas.some((m) => m.id === questDef.id)) return false;
  if (personagem.missoesConcluidas.includes(questDef.id)) return false;
  personagem.missoesAtivas.push({ id: questDef.id, progresso: 0 });
  return true;
}

export function registrarAbate(personagem, monstroId) {
  const eventos = [];
  personagem.missoesAtivas.forEach((m) => {
    const def = window.__QUESTS__.find((q) => q.id === m.id);
    if (def && def.tipo === "matar" && def.alvo === monstroId && m.progresso < def.quantidade) {
      m.progresso += 1;
      eventos.push({ questId: m.id, progresso: m.progresso, meta: def.quantidade });
    }
  });
  return eventos;
}

export function missaoPronta(personagem, questDef) {
  const m = personagem.missoesAtivas.find((x) => x.id === questDef.id);
  if (!m) return false;
  if (questDef.tipo === "matar") return m.progresso >= questDef.quantidade;
  if (questDef.tipo === "coletar") {
    const qtd = personagem.inventario.filter((i) => i.id === questDef.itemAlvo).length;
    return qtd >= questDef.quantidade;
  }
  if (questDef.tipo === "explorar") return m.progresso >= 1;
  return false;
}

export function concluirMissao(personagem, questDef, itemsCatalog) {
  const idx = personagem.missoesAtivas.findIndex((m) => m.id === questDef.id);
  if (idx < 0) return { ok: false };
  if (questDef.tipo === "coletar") {
    let restante = questDef.quantidade;
    for (let i = personagem.inventario.length - 1; i >= 0 && restante > 0; i--) {
      if (personagem.inventario[i].id === questDef.itemAlvo) {
        personagem.inventario.splice(i, 1);
        restante -= 1;
      }
    }
  }
  personagem.missoesAtivas.splice(idx, 1);
  personagem.missoesConcluidas.push(questDef.id);
  personagem.ouro += questDef.recompensaOuro;
  const itemRecompensa = itemsCatalog.find((i) => i.id === questDef.recompensaItemId);
  return {
    ok: true, ouro: questDef.recompensaOuro, xp: questDef.recompensaXP,
    item: itemRecompensa, fragmentos: questDef.recompensaFragmentos || 0,
  };
}

export function marcarExploracao(personagem, localId) {
  personagem.missoesAtivas.forEach((m) => {
    const def = window.__QUESTS__.find((q) => q.id === m.id);
    if (def && def.tipo === "explorar" && def.localAlvo === localId) {
      m.progresso = 1;
    }
  });
}
