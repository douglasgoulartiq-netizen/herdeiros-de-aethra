// Testes de perícia (d20) fora de combate — pontos de decisão no mundo
// (diálogos de NPC, baús, coleta de recursos), lidos de
// src/data/skillChecks.json. Antes deste sistema, o campo "pericia" de
// cada antecedente (src/data/backgrounds.json) era só texto de sabor; agora
// ele concede um bônus de proficiência real quando bate com a perícia
// exigida pelo teste.
//
// Convenção deste sistema (diferente do d20 puro do combate, ver
// CombatSystem.js): segue o modelo clássico de teste de perícia —
// d20 + modificador de atributo (+ proficiência, se aplicável) comparado
// contra uma dificuldade (DC). Natural 20 é sucesso automático; natural 1 é
// falha automática; os dois nunca se misturam com combate.
import { atributosEfetivos } from "./CharacterFactory.js";

export function d20Pericia() {
  return Math.floor(Math.random() * 20) + 1;
}

// Bônus de proficiência: cresce lentamente com o nível, igual à ideia geral
// de "personagens experientes são melhores no que sabem fazer" sem virar o
// fator dominante do teste (o d20 continua sendo a maior fatia do resultado).
export function bonusProficiencia(personagem) {
  return 2 + Math.floor((personagem.nivel || 1) / 4);
}

export function possuiPericia(personagem, dados, nomePericia) {
  const bg = (dados.backgrounds || []).find((b) => b.id === personagem.antecedenteId);
  return !!bg && bg.pericia === nomePericia;
}

// Executa um teste de perícia e retorna o resultado completo (pra UI exibir
// o "d20 + modificadores = total vs dificuldade", como uma mesa de RPG).
export function realizarTeste(personagem, dados, { pericia, atributo, dificuldade }) {
  const d = d20Pericia();
  const atributos = atributosEfetivos(personagem, dados);
  const modAtributo = Math.floor((atributos[atributo] ?? 10) / 2);
  const proficiente = possuiPericia(personagem, dados, pericia);
  const bonusPericiaValor = proficiente ? bonusProficiencia(personagem) : 0;
  const total = d + modAtributo + bonusPericiaValor;
  const critico = d === 20;
  const falhaCritica = d === 1;
  const sucesso = critico || (!falhaCritica && total >= dificuldade);
  return { d, modAtributo, bonusPericia: bonusPericiaValor, proficiente, total, dificuldade, sucesso, critico, falhaCritica };
}

// Filtra os testes disponíveis num contexto (ex.: "npc", "bau", "no"),
// opcionalmente restritos a um NPC específico.
export function testesDoContexto(dadosSkillChecks, contexto, filtro = {}) {
  return (dadosSkillChecks || []).filter((sc) => {
    if (sc.contexto !== contexto) return false;
    if (filtro.npcId && sc.npcId !== filtro.npcId) return false;
    return true;
  });
}

export function testeJaFeito(personagem, testeId) {
  return (personagem.testesPericiaFeitos || []).includes(testeId);
}

export function marcarTesteFeito(personagem, testeId) {
  if (!personagem.testesPericiaFeitos) personagem.testesPericiaFeitos = [];
  if (!personagem.testesPericiaFeitos.includes(testeId)) personagem.testesPericiaFeitos.push(testeId);
}
