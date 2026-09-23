// UI dos eventos aleatórios de exploração (melhoria pós-backlog, ver
// ExplorationEventSystem.js). Segue o mesmo padrão visual/estrutural de
// mostrarAmeaca (ThreatUI.js): um modal simples com o texto do evento e
// botões de ação, fechado ao resolver — sem nenhuma tela nova, reaproveita
// o modal-overlay já usado por inventário/missões/forja/etc.
import { abrirModalBase, fecharModal, mostrarMensagem } from "./GameUI.js";
import { realizarTeste } from "../systems/SkillCheckSystem.js";
import { mostrarRolagemD20 } from "./DiceAnimation.js";
import { opcaoDisponivel, aplicarEscolhaEvento, aplicarAchadoEvento, aplicarResultadoTesteExploracao, opcoesDoEvento, opcaoDeOrigem } from "../systems/ExplorationEventSystem.js";
import { registrarDecisao } from "../systems/WorldStateSystem.js";
import { marcarInteracaoAutomatica } from "./HdaUI.js";

// `onFim` é chamado sempre que o evento se resolve (escolha feita, teste
// tentado, ou achado coletado) — o chamador (main.js) usa isso pra
// atualizar o HUD e retomar o salvamento automático normalmente, igual ao
// callback de mostrarAmeaca.
export function mostrarEventoExploracao(evento, personagem, dados, facaoId, onFim) {
  const corpo = abrirModalBase(`${evento.icone || "❔"} ${evento.titulo}`);
  marcarInteracaoAutomatica(corpo);
  const p = document.createElement("p");
  p.textContent = evento.texto;
  corpo.appendChild(p);

  if (evento.tipo === "achado") {
    const btn = document.createElement("button");
    btn.className = "primario btn-evento-tentar";
    btn.textContent = "Recolher";
    btn.onclick = () => {
      const r = aplicarAchadoEvento(personagem, evento);
      mostrarMensagem(`${evento.icone || "❔"} ${r.texto}${r.ouroDelta ? ` (+${r.ouroDelta} ouro)` : ""}`, 4000);
      fecharModal();
      onFim();
    };
    corpo.appendChild(btn);
    return;
  }

  if (evento.tipo === "teste_pericia") {
    const infoTeste = document.createElement("p");
    infoTeste.innerHTML = `<i>🎲 ${evento.pericia} — ${evento.textoOferta}</i>`;
    corpo.appendChild(infoTeste);

    // OPÇÃO DE ORIGEM: quando a perícia do teste é a da origem do herói, ele
    // resolve sem rolar o dado. É o que a origem dá em troca de não dar
    // número nenhum em combate — ver opcaoDeOrigem em ExplorationEventSystem.
    const daOrigem = opcaoDeOrigem(evento, personagem, dados);
    if (daOrigem) {
      const btnOrigem = document.createElement("button");
      btnOrigem.className = "primario btn-evento-origem";
      btnOrigem.textContent = daOrigem.rotulo;
      btnOrigem.onclick = () => {
        btnOrigem.disabled = true;
        const r = aplicarResultadoTesteExploracao(personagem, evento, { sucesso: true }, { dados, facaoId, dadosWorldState: dados.worldStateVariables });
        fecharModal();
        mostrarMensagem(`✅ ${r.texto}${r.ouroDelta ? ` (+${r.ouroDelta} ouro)` : ""}${r.extras && r.extras.length ? ` (${r.extras.join(", ")})` : ""}`, 4200);
        registrarDecisao(personagem, { icone: evento.icone || "🎲", titulo: evento.titulo, texto: `${daOrigem.origem.nome}: ${r.texto}` });
        onFim();
      };
      corpo.appendChild(btnOrigem);
    }

    const btnTentar = document.createElement("button");
    btnTentar.className = "primario btn-evento-tentar";
    btnTentar.textContent = "Tentar";
    btnTentar.onclick = async () => {
      // O resultado é decidido ANTES da animação: `mostrarRolagemD20` só
      // encena o que já aconteceu, nunca sorteia. Assim a animação não pode
      // alterar o jogo, e pular a animação (Acessibilidade → velocidade
      // instantânea) dá exatamente o mesmo desfecho.
      const resultado = realizarTeste(personagem, dados, evento);
      const r = aplicarResultadoTesteExploracao(personagem, evento, resultado, { dados, facaoId, dadosWorldState: dados.worldStateVariables });

      // Trava o botão: sem isto, clicar duas vezes durante o segundo de
      // animação rolaria o teste de novo e aplicaria o efeito duas vezes.
      btnTentar.disabled = true;
      fecharModal();

      const mods = [];
      if (resultado.modAtributo) mods.push(`${resultado.modAtributo > 0 ? "+" : ""}${resultado.modAtributo} atributo`);
      if (resultado.proficiente && resultado.bonusPericia) mods.push(`+${resultado.bonusPericia} perícia`);
      await mostrarRolagemD20(resultado, {
        titulo: evento.titulo || "Teste de perícia",
        modificadores: mods,
      });

      mostrarMensagem(`${resultado.sucesso ? "✅" : "❌"} ${r.texto}${r.ouroDelta ? ` (+${r.ouroDelta} ouro)` : ""}${r.extras && r.extras.length ? ` (${r.extras.join(", ")})` : ""}`, 4200);
      registrarDecisao(personagem, { icone: evento.icone || "🎲", titulo: evento.titulo, texto: r.texto });
      onFim();
    };
    corpo.appendChild(btnTentar);

    const btnIgnorar = document.createElement("button");
    btnIgnorar.textContent = "Deixar pra lá";
    btnIgnorar.onclick = () => { fecharModal(); onFim(); };
    corpo.appendChild(btnIgnorar);
    return;
  }

  // tipo "escolha": uma opção por botão, na ordem definida em
  // explorationEvents.json — a 1ª opção (geralmente a mais "engajada": ajudar/
  // investigar/doar) recebe a classe btn-evento-tentar, igual ao botão
  // "Tentar" do teste de perícia acima, pro modo automático (ver
  // tickAutoPlay em main.js) sempre ter uma ação preferencial a clicar em
  // vez de simplesmente fechar o modal.
  // A lista inclui a opção da CLASSE (`opcoesPorClasse`) e a da PERSONALIDADE
  // (`opcoesPorTraco`) do herói, quando o evento tem — ver opcoesDoEvento.
  // As duas vêm marcadas com classe própria: se parecessem iguais às outras, o
  // jogador não saberia que foi a escolha de criação dele que abriu aquela
  // linha.
  opcoesDoEvento(evento, personagem).forEach((opcao, idx) => {
    const disponivel = opcaoDisponivel(opcao, personagem);
    const btn = document.createElement("button");
    if (idx === 0) btn.className = "primario btn-evento-tentar";
    if (opcao.daClasse) btn.classList.add("btn-evento-classe");
    if (opcao.doTraco) btn.classList.add("btn-evento-traco");
    btn.textContent = opcao.rotulo + (opcao.custoOuroMinimo && !disponivel ? ` (precisa de ${opcao.custoOuroMinimo} ouro)` : "");
    btn.disabled = !disponivel;
    btn.onclick = () => {
      const r = aplicarEscolhaEvento(personagem, evento, opcao.id, dados.worldStateVariables, facaoId, dados);
      if (!r.ok) return;
      const icone = r.sucesso === false ? "❌" : r.sucesso === true ? "✅" : (evento.icone || "❔");
      mostrarMensagem(`${icone} ${r.texto}${r.ouroDelta ? ` (${r.ouroDelta > 0 ? "+" : ""}${r.ouroDelta} ouro)` : ""}${r.extras && r.extras.length ? ` (${r.extras.join(", ")})` : ""}`, 4200);
      registrarDecisao(personagem, { icone: evento.icone || "❔", titulo: evento.titulo, texto: r.texto });
      fecharModal();
      onFim();
    };
    corpo.appendChild(btn);
  });
}
