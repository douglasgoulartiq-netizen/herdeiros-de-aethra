// Per-character memory: unchanged dialogue is not an exploration objective.
export function criarMemoriaNpcAuto() {
  const personagens = new WeakMap();
  return {
    visitado(personagem, npcId, estado) {
      return personagens.get(personagem)?.get(npcId) === estado;
    },
    registrar(personagem, npcId, estado) {
      if (!personagens.has(personagem)) personagens.set(personagem, new Map());
      personagens.get(personagem).set(npcId, estado);
    },
  };
}
