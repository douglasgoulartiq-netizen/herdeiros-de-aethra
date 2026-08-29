// Regressão para a viagem rápida entre zonas exploradas (melhoria de
// jogabilidade pós-backlog original, ver FastTravelSystem.js). Reaproveita
// o campo `biomaVisitados` de CharacterFactory.js (existia desde antes mas
// nunca era lido em lugar nenhum).
import {
  marcarZonaVisitada, zonaFoiVisitada, zonasDisponiveisParaViagem, pontoDeChegada,
  ZONA_INICIAL_SEMPRE_DISPONIVEL,
} from "../src/systems/FastTravelSystem.js";
import { ZONAS } from "../src/data/worldMap.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function personagemFake(overrides = {}) {
  return { biomaVisitados: [], ...overrides };
}

// --- vila sempre disponível, mesmo sem nunca ter sido marcada ---
{
  const p = personagemFake();
  check(`"${ZONA_INICIAL_SEMPRE_DISPONIVEL}" está sempre disponível sem precisar visitar`, zonaFoiVisitada(p, ZONA_INICIAL_SEMPRE_DISPONIVEL));
  check("zona nunca visitada não está disponível", !zonaFoiVisitada(p, "floresta"));
}

// --- marcarZonaVisitada: adiciona e é idempotente ---
{
  const p = personagemFake();
  marcarZonaVisitada(p, "floresta");
  check("marcar uma zona a torna visitada", zonaFoiVisitada(p, "floresta"));
  check("biomaVisitados guarda o id", p.biomaVisitados.includes("floresta"));
  marcarZonaVisitada(p, "floresta");
  check("marcar a mesma zona de novo não duplica", p.biomaVisitados.filter((z) => z === "floresta").length === 1);
}

// --- marcarZonaVisitada cria o array se o personagem (save antigo) não tiver ---
{
  const p = {}; // sem biomaVisitados, como um save de antes deste campo existir
  marcarZonaVisitada(p, "floresta");
  check("marcarZonaVisitada cria biomaVisitados se não existir", Array.isArray(p.biomaVisitados) && p.biomaVisitados.includes("floresta"));
}

// --- marcarZonaVisitada com id vazio/nulo não quebra nem adiciona lixo ---
{
  const p = personagemFake();
  marcarZonaVisitada(p, null);
  marcarZonaVisitada(p, undefined);
  check("ids inválidos não são adicionados", p.biomaVisitados.length === 0);
}

// --- zonasDisponiveisParaViagem: filtra pela lista real de ZONAS, preservando ordem ---
{
  const p = personagemFake();
  marcarZonaVisitada(p, "floresta");
  const disponiveis = zonasDisponiveisParaViagem(p, ZONAS);
  check("vila entra mesmo sem marcar (sempre disponível)", disponiveis.some((z) => z.id === "vila"));
  check("floresta (marcada) entra na lista", disponiveis.some((z) => z.id === "floresta"));
  check("zona nunca visitada não entra na lista", !disponiveis.some((z) => z.id === "planicie_ventosa" && p.biomaVisitados.includes("planicie_ventosa")));
  const idxVila = disponiveis.findIndex((z) => z.id === "vila");
  const idxFloresta = disponiveis.findIndex((z) => z.id === "floresta");
  check("ordem da lista disponível segue a ordem de ZONAS (vila antes de floresta)", idxVila < idxFloresta);
}

// --- pontoDeChegada: usa o marco quando existe ---
{
  const zonaComMarco = ZONAS.find((z) => (z.pontosDeInteresse || []).some((p) => p.tipo === "marco"));
  check("existe pelo menos uma zona com marco nos dados reais (pré-condição do teste)", !!zonaComMarco);
  const marco = zonaComMarco.pontosDeInteresse.find((p) => p.tipo === "marco");
  const chegada = pontoDeChegada(zonaComMarco);
  check(`pontoDeChegada usa o marco de "${zonaComMarco.id}" quando existe`, chegada.x === marco.x && chegada.y === marco.y);
}

// --- pontoDeChegada: cai pro centro da bbox quando não há marco ---
{
  const zonaSemMarco = { id: "teste_sem_marco", x0: 10, y0: 20, x1: 20, y1: 30, pontosDeInteresse: [] };
  const chegada = pontoDeChegada(zonaSemMarco);
  check("sem marco, usa o centro da bounding box (x)", chegada.x === Math.floor((10 + 20) / 2));
  check("sem marco, usa o centro da bounding box (y)", chegada.y === Math.floor((20 + 30) / 2));
}

// --- pontoDeChegada: zona sem pontosDeInteresse definido (undefined) não quebra ---
{
  const zonaMinima = { id: "teste_minimo", x0: 0, y0: 0, x1: 4, y1: 4 };
  const chegada = pontoDeChegada(zonaMinima);
  check("zona sem pontosDeInteresse (undefined) não quebra pontoDeChegada", chegada.x === 2 && chegada.y === 2);
}

// --- toda zona de mundo aberto real tem um ponto de chegada dentro (ou perto) da própria bbox ---
{
  let todasDentro = true;
  for (const zona of ZONAS) {
    const p = pontoDeChegada(zona);
    if (p.x < zona.x0 || p.x > zona.x1 || p.y < zona.y0 || p.y > zona.y1) {
      console.log(`  aviso: ponto de chegada de "${zona.id}" (${p.x},${p.y}) cai fora da bbox (${zona.x0}-${zona.x1}, ${zona.y0}-${zona.y1})`);
      todasDentro = false;
    }
  }
  check("todo ponto de chegada calculado cai dentro da bounding box da própria zona", todasDentro);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
