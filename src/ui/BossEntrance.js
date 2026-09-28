import { animacoesReduzidas } from '../systems/BattleSettings.js';

// Apresentação única por encontro; não altera dano, iniciativa ou ATB.
export function apresentarChefe(container, chefe, { automatico = false } = {}) {
  if (!chefe) return { pronto: Promise.resolve(), cancelar() {} };
  const painel = document.createElement('div');
  painel.className = 'boss-entrance';
  const texto = document.createElement('span');
  texto.setAttribute('role', 'status');
  texto.textContent = `Guardião da região · ${chefe.nome}`;
  const pular = document.createElement('button');
  pular.type = 'button'; pular.textContent = 'Iniciar luta';
  painel.append(texto, pular);
  container.append(painel);
  let timer, concluir, terminou = false;
  const pronto = new Promise(resolve => { concluir = resolve; });
  const cancelar = () => {
    if (terminou) return;
    terminou = true; clearTimeout(timer); painel.remove(); concluir();
  };
  pular.onclick = cancelar;
  timer = setTimeout(cancelar, animacoesReduzidas() ? 450 : automatico ? 800 : 1800);
  return { pronto, cancelar };
}
