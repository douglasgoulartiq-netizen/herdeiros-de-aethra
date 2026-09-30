import { autoPlayState } from '../systems/AutoPlayState.js';

export function atualizarBotaoAutoFixo(aoAlternar) {
  let botao = document.getElementById('auto-fixo');
  if (!botao && aoAlternar) {
    botao = document.createElement('button');
    botao.id = 'auto-fixo';
    botao.type = 'button';
    botao.onclick = (evento) => {
      evento.stopPropagation();
      const batalha = document.getElementById('screen-batalha');
      const controle = batalha && !batalha.classList.contains('hidden')
        ? batalha.querySelector('#btn-auto-batalha') : null;
      if (controle) controle.click();
      else aoAlternar();
      atualizarBotaoAutoFixo();
    };
    document.body.appendChild(botao);
  }
  if (!botao) return;
  const ligado = autoPlayState.ativo;
  botao.textContent = ligado ? '⏸ Auto: ligado' : '▶ Auto: desligado';
  botao.setAttribute('aria-pressed', String(ligado));
  botao.setAttribute('aria-label', ligado ? 'Desligar modo automático' : 'Ligar modo automático');
  botao.title = ligado ? 'Desligar automático. A ação já iniciada termina normalmente.' : 'Ligar automático na exploração e no combate';
}
