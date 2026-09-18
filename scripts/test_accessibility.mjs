// Regressão para configurações de acessibilidade (melhoria de jogabilidade
// pós-backlog original, ver AccessibilitySystem.js) — preferências do
// jogador (velocidade de mensagens, tremor/flash de tela, tamanho de
// fonte, alto contraste), persistidas fora do save de progresso.
import {
  VELOCIDADES_MENSAGEM, TAMANHOS_FONTE, mesclarConfig, carregarConfigAcessibilidade, salvarConfigAcessibilidade,
  atualizarConfigAcessibilidade, multiplicadorVelocidadeMensagem, efeitosReduzidos, _resetParaTeste,
  TAMANHOS_CONTROLES_TOQUE, OPACIDADES_CONTROLES_TOQUE, POSICOES_CONTROLES_TOQUE,
} from "../src/systems/AccessibilitySystem.js";

function check(label, cond) {
  console.log((cond ? "OK " : "FALHA ") + label);
  if (!cond) process.exitCode = 1;
}

// --- carregarConfigAcessibilidade: sem nada salvo, retorna o padrão ---
{
  _resetParaTeste();
  const config = carregarConfigAcessibilidade();
  check("padrão: velocidadeMensagem normal", config.velocidadeMensagem === "normal");
  check("padrão: reduzirEfeitos desligado", config.reduzirEfeitos === false);
  check("padrão: tamanhoFonte normal", config.tamanhoFonte === "normal");
  check("padrão: altoContraste desligado", config.altoContraste === false);
  check("padrão mobile: direcional à esquerda, tamanho e opacidade normais",
    config.posicaoControlesToque === "direcional_esquerda"
    && config.tamanhoControlesToque === "normal"
    && config.opacidadeControlesToque === "normal");
}

// --- mesclarConfig: valores válidos passam, inválidos/desconhecidos caem no padrão ---
{
  const valido = mesclarConfig({ velocidadeMensagem: "lenta", reduzirEfeitos: true, tamanhoFonte: "grande", altoContraste: true });
  check("mesclarConfig aceita valores válidos", valido.velocidadeMensagem === "lenta" && valido.reduzirEfeitos === true && valido.tamanhoFonte === "grande" && valido.altoContraste === true);

  const invalido = mesclarConfig({ velocidadeMensagem: "turbo-hiper", tamanhoFonte: "minusculo", reduzirEfeitos: "sim", altoContraste: 1 });
  check("velocidadeMensagem inválida cai no padrão (normal)", invalido.velocidadeMensagem === "normal");
  check("tamanhoFonte inválido cai no padrão (normal)", invalido.tamanhoFonte === "normal");
  check("reduzirEfeitos não-booleano cai no padrão (false)", invalido.reduzirEfeitos === false);
  check("altoContraste não-booleano cai no padrão (false)", invalido.altoContraste === false);
  const mobileInvalido = mesclarConfig({ tamanhoControlesToque: "enorme", opacidadeControlesToque: 0.2, posicaoControlesToque: "centro" });
  check("preferências mobile inválidas caem nos padrões seguros",
    mobileInvalido.tamanhoControlesToque === "normal"
    && mobileInvalido.opacidadeControlesToque === "normal"
    && mobileInvalido.posicaoControlesToque === "direcional_esquerda");

  const semNada = mesclarConfig(null);
  check("mesclarConfig(null) nunca quebra, retorna o padrão inteiro", semNada.velocidadeMensagem === "normal" && semNada.tamanhoFonte === "normal");

  const parcial = mesclarConfig({ tamanhoFonte: "gigante" });
  check("chave desconhecida/faltando não afeta as outras (só tamanhoFonte muda)", parcial.tamanhoFonte === "gigante" && parcial.velocidadeMensagem === "normal");
}

// --- salvarConfigAcessibilidade / carregarConfigAcessibilidade: persistem (via cache em memória, sem localStorage no Node) ---
{
  _resetParaTeste();
  const salvo = salvarConfigAcessibilidade({ velocidadeMensagem: "rapida", reduzirEfeitos: true, tamanhoFonte: "grande", altoContraste: false });
  check("salvarConfigAcessibilidade retorna a config já mesclada/validada", salvo.velocidadeMensagem === "rapida" && salvo.reduzirEfeitos === true);
  const recarregado = carregarConfigAcessibilidade();
  check("carregarConfigAcessibilidade depois de salvar retorna o mesmo valor salvo", recarregado.velocidadeMensagem === "rapida" && recarregado.tamanhoFonte === "grande");
}

// --- atualizarConfigAcessibilidade: muda só o campo pedido, preserva o resto ---
{
  _resetParaTeste();
  salvarConfigAcessibilidade({ velocidadeMensagem: "lenta", reduzirEfeitos: true, tamanhoFonte: "gigante", altoContraste: true });
  const atualizado = atualizarConfigAcessibilidade({ altoContraste: false });
  check("atualizarConfigAcessibilidade muda só o campo informado", atualizado.altoContraste === false);
  check("atualizarConfigAcessibilidade preserva os campos não informados", atualizado.velocidadeMensagem === "lenta" && atualizado.reduzirEfeitos === true && atualizado.tamanhoFonte === "gigante");
}

// --- multiplicadorVelocidadeMensagem / efeitosReduzidos: refletem a config atual ---
{
  _resetParaTeste();
  check(`VELOCIDADES_MENSAGEM tem as 3 opções esperadas`, Object.keys(VELOCIDADES_MENSAGEM).sort().join(",") === "lenta,normal,rapida");
  check("multiplicador padrão (normal) é 1 — comportamento idêntico a antes deste sistema existir", multiplicadorVelocidadeMensagem() === 1);
  check("efeitosReduzidos padrão é false — comportamento idêntico a antes deste sistema existir", efeitosReduzidos() === false);

  salvarConfigAcessibilidade({ velocidadeMensagem: "lenta" });
  check("velocidade 'lenta' dá um multiplicador > 1 (mensagens ficam mais tempo na tela)", multiplicadorVelocidadeMensagem() > 1);
  salvarConfigAcessibilidade({ velocidadeMensagem: "rapida" });
  check("velocidade 'rapida' dá um multiplicador < 1 (mensagens somem mais rápido)", multiplicadorVelocidadeMensagem() < 1);

  salvarConfigAcessibilidade({ reduzirEfeitos: true });
  check("efeitosReduzidos reflete o valor salvo", efeitosReduzidos() === true);
}

// --- TAMANHOS_FONTE: lista fixa esperada pela UI (AccessibilityUI.js) ---
{
  check("TAMANHOS_FONTE tem as 3 opções esperadas, na ordem certa", JSON.stringify(TAMANHOS_FONTE) === JSON.stringify(["normal", "grande", "gigante"]));
  check("controles touch expõem três tamanhos e três opacidades", TAMANHOS_CONTROLES_TOQUE.length === 3 && OPACIDADES_CONTROLES_TOQUE.length === 3);
  check("controles touch podem trocar de mão", JSON.stringify(POSICOES_CONTROLES_TOQUE) === JSON.stringify(["direcional_esquerda", "direcional_direita"]));
}

// --- Som: um gesto gera um evento semântico, sem ignorar mute/redução ---
{
  const eventos = [];
  let osciladores = 0;
  globalThis.CustomEvent = globalThis.CustomEvent || class {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  class AudioFalso {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createOscillator() {
      osciladores += 1;
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  }
  globalThis.window = {
    AudioContext: AudioFalso,
    dispatchEvent(evento) { eventos.push(evento); return true; },
  };
  const sons = await import("../src/ui/SoundFX.js");

  _resetParaTeste();
  salvarConfigAcessibilidade({ volumeEfeitos: "baixo", reduzirEfeitos: false });
  sons.somConfirmar();
  check("uma confirmação emite no máximo um evento sonoro", eventos.length === 1 && eventos[0].detail.nome === "confirmar");
  check("o acorde normal continua sendo um único evento semântico", osciladores === 2);

  eventos.length = 0; osciladores = 0;
  salvarConfigAcessibilidade({ volumeEfeitos: "baixo", reduzirEfeitos: true });
  sons.somConfirmar();
  check("efeitos reduzidos eliminam notas acessórias", eventos.length === 1 && osciladores === 1);

  eventos.length = 0; osciladores = 0;
  salvarConfigAcessibilidade({ volumeEfeitos: "desligado", reduzirEfeitos: false });
  sons.somConfirmar();
  check("mute impede evento e oscilador", eventos.length === 0 && osciladores === 0);
}

console.log(process.exitCode ? "=== FALHAS ENCONTRADAS ===" : "=== todos os testes passaram ===");
