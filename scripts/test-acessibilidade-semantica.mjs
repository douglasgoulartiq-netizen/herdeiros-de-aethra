// Contrato final das três correções semânticas nas telas críticas.
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const index = ler("../index.html");
const game = ler("../src/ui/GameUI.js");
const batalha = ler("../src/ui/BattleUI.js");
const party = ler("../src/ui/PartyUI.js");
const hda = ler("../src/ui/HdaUI.js");

const testes = [
  [
    ["hud-hp", "hud-mp", "hud-xp"].every((id) => index.includes(`id="${id}"`))
      && (index.match(/role="progressbar"/g) || []).length >= 3
      && game.includes('barra.setAttribute("aria-valuenow"')
      && game.includes('barra.setAttribute("aria-valuetext"'),
    "HUD anuncia HP, MP e XP com valores atualizados",
  ],
  [
    batalha.includes('role="progressbar" aria-label="Pontos de vida de')
      && batalha.includes('role="progressbar" aria-label="Pontos de magia de')
      && party.includes('role="progressbar"')
      && party.includes('aria-valuetext='),
    "batalha e Companhia anunciam recursos por personagem",
  ],
  [
    hda.includes('b.setAttribute("aria-current", "page")')
      && hda.includes('b.removeAttribute("aria-current")'),
    "navegação principal comunica somente o destino ativo",
  ],
  [
    batalha.includes('return `<button type="button" class="status-icone')
      && !batalha.includes("icone.setAttribute('role', 'button')")
      && !batalha.includes("icone.onkeydown ="),
    "estados interativos usam botão nativo, sem simulação por span",
  ],
];

let falhas = 0;
for (const [ok, nome] of testes) {
  console.log(`${ok ? "OK" : "FALHA"} ${nome}`);
  if (!ok) falhas += 1;
}
console.log(`\nAcessibilidade semântica: ${testes.length - falhas}/${testes.length} contratos atendidos.`);
process.exitCode = falhas ? 1 : 0;
