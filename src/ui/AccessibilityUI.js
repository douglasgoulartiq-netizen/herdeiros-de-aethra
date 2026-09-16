// Tela de Acessibilidade: preferências do JOGADOR (não do personagem), ver
// AccessibilitySystem.js. Reaproveita o modal genérico de GameUI.js
// (abrirModalBase) — funciona tanto na tela inicial (antes de criar
// personagem) quanto durante o jogo (HUD), já que não depende de
// `personagem`/`dados`.
import { abrirModalBase } from "./GameUI.js";
import { alternarTelaCheia, emTelaCheia, suportaTelaCheia } from "../systems/ViewportSystem.js";
import {
  VELOCIDADES_MENSAGEM, TAMANHOS_FONTE, VELOCIDADES_ANIMACAO_COMBATE, LIMIARES_HP_AUTOPLAY, DIFICULDADES, VOLUMES_EFEITOS,
  VELOCIDADES_AUTO_EXPLORACAO,
  carregarConfigAcessibilidade, atualizarConfigAcessibilidade,
} from "../systems/AccessibilitySystem.js";

const LABEL_VELOCIDADE = { lenta: "Lenta (mais tempo pra ler)", normal: "Normal", rapida: "Rápida" };
const LABEL_FONTE = { normal: "Normal", grande: "Grande", gigante: "Gigante" };
// Velocidade das animações de combate (dado rolando, golpes, números
// flutuantes — melhoria de jogabilidade, ver DiceAnimation.js/BattleUI.js).
const LABEL_VELOCIDADE_ANIMACAO = { normal: "Normal (~1s por golpe)", rapida: "Rápida (2x)", instantaneo: "Instantânea" };
// Segurança do modo automático: para sozinho se o HP do time cair abaixo do
// limiar escolhido, em vez de continuar entrando em batalha às cegas.
const LABEL_LIMITE_HP_AUTO = { desligado: "Nunca parar sozinho", "15": "Abaixo de 15% HP", "30": "Abaixo de 30% HP", "50": "Abaixo de 50% HP" };
// Dificuldade: multiplicador de HP/ataque/defesa de monstro, trocável a
// qualquer momento sem reiniciar a run (independente de NG+/Modo História).
const LABEL_DIFICULDADE = { facil: "Fácil (-20%)", normal: "Normal", dificil: "Difícil (+25%)", brutal: "Brutal (+50%)" };
// Volume de efeitos sonoros (item 14/87 de 100_melhorias.md, ver
// src/ui/SoundFX.js) — "Desligado" é o padrão porque o jogo nunca teve
// áudio; ninguém ganha som sem escolher explicitamente aqui.
const LABEL_VOLUME_EFEITOS = { desligado: "Desligado (padrão)", baixo: "Baixo", medio: "Médio", alto: "Alto" };
// Velocidade do automático fora de combate (item 21) e pausa antes de chefe
// (item 23) — ambos preservam o comportamento de sempre por padrão.
const LABEL_VELOCIDADE_AUTO = { normal: "Normal", rapida: "Rápida (2x)", instantaneo: "Quase instantânea" };

// Aplica as classes visuais no <body> de acordo com a config atual —
// chamada no boot() (main.js) e de novo toda vez que a config muda aqui,
// pra valer na hora sem precisar recarregar a página. Exportada separada de
// montarAcessibilidade() porque main.js precisa dela ANTES de qualquer
// modal existir (aplicação inicial no carregamento do jogo).
export function aplicarClassesAcessibilidade() {
  const config = carregarConfigAcessibilidade();
  document.body.classList.remove("fonte-grande", "fonte-gigante", "alto-contraste");
  if (config.tamanhoFonte === "grande") document.body.classList.add("fonte-grande");
  else if (config.tamanhoFonte === "gigante") document.body.classList.add("fonte-gigante");
  if (config.altoContraste) document.body.classList.add("alto-contraste");
}

export function montarAcessibilidade() {
  const corpo = abrirModalBase("Acessibilidade");
  const config = carregarConfigAcessibilidade();
  corpo.innerHTML = `
    <div class="card acc-painel" style="flex-direction:column;align-items:flex-start;gap:12px;width:100%;">
      <label style="width:100%;">Velocidade das mensagens na tela
        <select id="acc-velocidade" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(VELOCIDADES_MENSAGEM).map((v) => `<option value="${v}" ${config.velocidadeMensagem === v ? "selected" : ""}>${LABEL_VELOCIDADE[v] || v}</option>`).join("")}
        </select>
      </label>
      <label style="width:100%;">Tamanho da fonte
        <select id="acc-fonte" style="display:block;margin-top:4px;width:100%;">
          ${TAMANHOS_FONTE.map((t) => `<option value="${t}" ${config.tamanhoFonte === t ? "selected" : ""}>${LABEL_FONTE[t] || t}</option>`).join("")}
        </select>
      </label>
      <label><input type="checkbox" id="acc-efeitos" ${config.reduzirEfeitos ? "checked" : ""}/> Reduzir tremor de tela e flash de dano em combate</label>
      <label><input type="checkbox" id="acc-contraste" ${config.altoContraste ? "checked" : ""}/> Alto contraste</label>
      <label style="width:100%;">Velocidade das animações de combate (dado, golpes, números)
        <select id="acc-vel-anim" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(VELOCIDADES_ANIMACAO_COMBATE).map((v) => `<option value="${v}" ${config.velocidadeAnimacaoCombate === v ? "selected" : ""}>${LABEL_VELOCIDADE_ANIMACAO[v] || v}</option>`).join("")}
        </select>
      </label>
      <label style="width:100%;">Modo automático: parar sozinho com HP baixo
        <select id="acc-limite-hp-auto" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(LIMIARES_HP_AUTOPLAY).map((v) => `<option value="${v}" ${config.limiteHpAutoPlay === v ? "selected" : ""}>${LABEL_LIMITE_HP_AUTO[v] || v}</option>`).join("")}
        </select>
      </label>
      <label style="width:100%;">Dificuldade (HP/ataque/defesa dos monstros)
        <select id="acc-dificuldade" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(DIFICULDADES).map((v) => `<option value="${v}" ${config.dificuldade === v ? "selected" : ""}>${LABEL_DIFICULDADE[v] || v}</option>`).join("")}
        </select>
      </label>
      <label style="width:100%;">Volume de efeitos sonoros (dado, golpes, cura)
        <select id="acc-volume-efeitos" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(VOLUMES_EFEITOS).map((v) => `<option value="${v}" ${config.volumeEfeitos === v ? "selected" : ""}>${LABEL_VOLUME_EFEITOS[v] || v}</option>`).join("")}
        </select>
      </label>
      <label style="width:100%;">Velocidade do automático fora de combate (andar/interagir)
        <select id="acc-velocidade-auto" style="display:block;margin-top:4px;width:100%;">
          ${Object.keys(VELOCIDADES_AUTO_EXPLORACAO).map((v) => `<option value="${v}" ${config.velocidadeAutoExploracao === v ? "selected" : ""}>${LABEL_VELOCIDADE_AUTO[v] || v}</option>`).join("")}
        </select>
      </label>
      <label><input type="checkbox" id="acc-parar-chefe" ${config.pararAutoAntesDoChefe ? "checked" : ""}/> Automático para (em vez de lutar sozinho) ao encontrar um chefe</label>
      <label><input type="checkbox" id="acc-auto-cuidar" ${config.autoCuidarDoTime ? "checked" : ""}/> Automático se cuida sozinho: usa poção com HP baixo, descansa só quando elas acabam, e recusa encontro Mortal</label>
      ${suportaTelaCheia() ? `<button id="acc-tela-cheia" style="width:100%;margin-top:6px;" title="No celular a tela cheia também trava o aparelho em pé, que é a orientação para a qual o jogo é enquadrado.">${emTelaCheia() ? "⛶ Sair da tela cheia" : "⛶ Jogar em tela cheia"}</button>` : ""}
      <p class="desc">As mudanças valem imediatamente e ficam salvas neste dispositivo — inclusive numa Nova Aventura ou New Game+.</p>
    </div>
  `;
  corpo.querySelector("#acc-velocidade").onchange = (e) => { atualizarConfigAcessibilidade({ velocidadeMensagem: e.target.value }); };
  corpo.querySelector("#acc-fonte").onchange = (e) => { atualizarConfigAcessibilidade({ tamanhoFonte: e.target.value }); aplicarClassesAcessibilidade(); };
  corpo.querySelector("#acc-efeitos").onchange = (e) => { atualizarConfigAcessibilidade({ reduzirEfeitos: e.target.checked }); };
  corpo.querySelector("#acc-contraste").onchange = (e) => { atualizarConfigAcessibilidade({ altoContraste: e.target.checked }); aplicarClassesAcessibilidade(); };
  corpo.querySelector("#acc-vel-anim").onchange = (e) => { atualizarConfigAcessibilidade({ velocidadeAnimacaoCombate: e.target.value }); };
  corpo.querySelector("#acc-limite-hp-auto").onchange = (e) => { atualizarConfigAcessibilidade({ limiteHpAutoPlay: e.target.value }); };
  corpo.querySelector("#acc-dificuldade").onchange = (e) => { atualizarConfigAcessibilidade({ dificuldade: e.target.value }); };
  corpo.querySelector("#acc-volume-efeitos").onchange = (e) => { atualizarConfigAcessibilidade({ volumeEfeitos: e.target.value }); };
  corpo.querySelector("#acc-velocidade-auto").onchange = (e) => { atualizarConfigAcessibilidade({ velocidadeAutoExploracao: e.target.value }); };
  corpo.querySelector("#acc-parar-chefe").onchange = (e) => { atualizarConfigAcessibilidade({ pararAutoAntesDoChefe: e.target.checked }); };
  corpo.querySelector("#acc-auto-cuidar").onchange = (e) => { atualizarConfigAcessibilidade({ autoCuidarDoTime: e.target.checked }); };
  // Tela cheia NÃO é preferência salva: quem manda é o navegador, e ele pode
  // sair dela sozinho (Esc, troca de app, uma chamada chegando). Guardar
  // "ligado" no save daria um botão que mente sobre o estado. O rótulo é
  // lido do estado real, toda vez.
  const btnTelaCheia = corpo.querySelector("#acc-tela-cheia");
  if (btnTelaCheia) {
    btnTelaCheia.onclick = async () => {
      await alternarTelaCheia();
      btnTelaCheia.textContent = emTelaCheia() ? "⛶ Sair da tela cheia" : "⛶ Jogar em tela cheia";
    };
  }
}
