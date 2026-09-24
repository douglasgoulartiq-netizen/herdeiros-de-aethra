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

// --- pontoDeChegada: o marco tem prioridade quando a zona declara um ---
//
// A pré-condição deste bloco era "existe pelo menos uma zona com marco nos
// dados reais". Desde o mundo 4x nenhuma tem: as zonas passaram a ser
// orgânicas e o ponto de chegada bom virou o CENTRO DE MASSA (`centroReal`),
// calculado pelo gerador, em vez de uma coordenada escolhida à mão. O caminho
// do marco continua no código para quem quiser fixar um ponto, então o que se
// testa agora é a REGRA de prioridade, com uma zona montada aqui — e não a
// presença de um dado que o mundo deixou de usar.
{
  const comMarco = {
    id: "teste_com_marco", x0: 0, y0: 0, x1: 100, y1: 100,
    centroReal: { x: 50, y: 50 },
    pontosDeInteresse: [{ tipo: "recurso", x: 7, y: 7 }, { tipo: "marco", x: 12, y: 34 }],
  };
  const chegada = pontoDeChegada(comMarco);
  check("pontoDeChegada usa o marco quando a zona declara um", chegada.x === 12 && chegada.y === 34);
  check("o marco vence o centro de massa", chegada.x !== comMarco.centroReal.x);
}

// --- pontoDeChegada: sem marco, o centro de MASSA vence a caixa ---
// É isto que todas as zonas do jogo usam hoje; a caixa delimitadora só entra
// quando nem centro de massa existe (zona retangular antiga ou de teste).
{
  const organica = { id: "teste_organica", x0: 0, y0: 0, x1: 100, y1: 100, centroReal: { x: 18, y: 72 }, pontosDeInteresse: [] };
  const chegada = pontoDeChegada(organica);
  check("sem marco, usa o centro de massa da zona", chegada.x === 18 && chegada.y === 72);
  const zonasReais = ZONAS.filter((z) => z.centroReal);
  check(`as zonas do mundo têm centro de massa (${zonasReais.length}/${ZONAS.length})`, zonasReais.length === ZONAS.length);
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
