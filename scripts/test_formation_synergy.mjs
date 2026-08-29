// Regressão para o combo de formação (melhoria de jogabilidade pós-backlog
// original): duas classes específicas na mesma fileira dão um bônus tático
// efêmero por batalha, igual à camaradagem de facção.
import { SINERGIAS_FORMACAO, aplicarSinergiasFormacao, sinergiasAtivasPreview } from "../src/systems/FormationSynergySystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

function combatenteFake(classeId, posicao, overrides = {}) {
  return {
    isPlayer: true,
    classeId,
    posicao,
    defesa: 10,
    velocidade: 8,
    critBonus: 0,
    habilidades: [{ id: "hab", tipo: overrides.tipo || "dano_fisico", multiplicador: overrides.multiplicador ?? 1.5, valor: overrides.valor }],
    ...overrides,
  };
}

// --- todas as 6 sinergias têm as duas classes distintas e um aplicar() ---
{
  check("existem pelo menos 6 sinergias de formação definidas", SINERGIAS_FORMACAO.length >= 6);
  for (const s of SINERGIAS_FORMACAO) {
    check(`sinergia "${s.id}": duas classes distintas`, s.classes.length === 2 && s.classes[0] !== s.classes[1]);
    check(`sinergia "${s.id}": tem nome/icone/descricao/aplicar`, !!s.nome && !!s.icone && !!s.descricao && typeof s.aplicar === "function");
  }
}

// --- guerreiro + clerigo na mesma fileira ativa "Escudo e Fé" ---
{
  const guerreiro = combatenteFake("guerreiro", "frente");
  const clerigo = combatenteFake("clerigo", "frente", { tipo: "cura", multiplicador: 2.0 });
  const defesaAntes = guerreiro.defesa;
  const curaAntes = clerigo.habilidades[0].multiplicador;
  const ativas = aplicarSinergiasFormacao([guerreiro, clerigo]);
  check('"Escudo e Fé" entra na lista de sinergias ativas', ativas.some((s) => s.id === "escudo_e_fe"));
  check("defesa do guerreiro aumentou", guerreiro.defesa > defesaAntes);
  check("multiplicador de cura do clérigo aumentou", clerigo.habilidades[0].multiplicador > curaAntes);
}

// --- classes sem sinergia definida entre si não ativam nada ---
{
  const mago = combatenteFake("mago", "frente", { tipo: "dano_magico" });
  const ladino = combatenteFake("ladino", "retaguarda", { tipo: "dano_fisico_des" }); // fileiras diferentes
  const ativas = aplicarSinergiasFormacao([mago, ladino]);
  check("mago e ladino em fileiras diferentes não ativam sinergia nenhuma", ativas.length === 0);
}

// --- mesma classe duas vezes na fileira não ativa nada (precisa de 2 classes distintas) ---
{
  const guerreiro1 = combatenteFake("guerreiro", "frente");
  const guerreiro2 = combatenteFake("guerreiro", "frente");
  const ativas = aplicarSinergiasFormacao([guerreiro1, guerreiro2]);
  check("dois guerreiros na mesma fileira não ativam sinergia (precisa de 2 classes diferentes)", ativas.length === 0);
}

// --- no máximo 1 sinergia por fileira, até 2 no time inteiro (frente + retaguarda) ---
{
  const g = combatenteFake("guerreiro", "frente");
  const c = combatenteFake("clerigo", "frente", { tipo: "cura" });
  const b = combatenteFake("barbaro", "retaguarda");
  const l = combatenteFake("ladino", "retaguarda", { tipo: "dano_fisico_des" });
  const ativas = aplicarSinergiasFormacao([g, c, b, l]);
  check("time de 4 com 2 pares distintos ativa 2 sinergias (uma por fileira)", ativas.length === 2);
  check('sinergia da frente é "Escudo e Fé"', ativas.some((s) => s.id === "escudo_e_fe"));
  check('sinergia da retaguarda é "Fúria Silenciosa"', ativas.some((s) => s.id === "furia_silenciosa"));
}

// --- inimigos (isPlayer:false) nunca contam pra sinergia, mesmo com classeId coincidente ---
{
  const guerreiro = combatenteFake("guerreiro", "frente");
  const inimigoDisfarcado = { isPlayer: false, classeId: "clerigo", posicao: "frente" };
  const ativas = aplicarSinergiasFormacao([guerreiro, inimigoDisfarcado]);
  check("inimigo com classeId coincidente não ativa sinergia (isPlayer:false é ignorado)", ativas.length === 0);
}

// --- prévia (sinergiasAtivasPreview) bate com o resultado real, sem mutar nada ---
{
  const membros = [
    { classeId: "mago", posicao: "frente" },
    { classeId: "clerigo", posicao: "frente" },
  ];
  const preview = sinergiasAtivasPreview(membros);
  check('prévia detecta "Convergência Arcana" (mago + clérigo na frente)', preview.some((s) => s.id === "convergencia_arcana"));
  check("prévia não altera os objetos de entrada (sem campos extras)", Object.keys(membros[0]).length === 2);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
