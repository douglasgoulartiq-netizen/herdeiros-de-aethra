import { animacoesReduzidas } from '../systems/BattleSettings.js';
import { duracaoAnimacao } from './DiceAnimation.js';

export function tempoAviso(automatico, chefe, multiplicador = 1) {
  // A velocidade dos efeitos não pode tornar o aviso ilegível.
  const base = automatico ? 500 : chefe ? 1200 : 950;
  const fator = Number.isFinite(multiplicador) ? Math.max(0, multiplicador) : 1;
  return Math.max(automatico ? 350 : 800, Math.min(2000, base * fator));
}

export function temposDaAcao(perfil, reduzido, critico) {
  const total = reduzido ? 140 : perfil.duracao;
  const pausa = critico && !reduzido ? 90 : 0;
  return { preparo: total * .58, pausa, retorno: total * .42 - pausa };
}

// Forma e texto acompanham a cor: a leitura não depende de distinguir tons.
export const ELEMENTOS_VISUAIS = {
  fogo: ['#edaa69', 'Chama', '✦'], gelo: ['#9bdbe7', 'Gelo', '❄'],
  raio: ['#e9d886', 'Raio', 'ϟ'], natureza: ['#8ad6a5', 'Natureza', '❧'],
  vento: ['#b2e4dc', 'Vento', '≋'], arcano: ['#c9b1ef', 'Éter', '◇'],
  luz: ['#f1dfac', 'Luz', '✧'], sombra: ['#b9a6d7', 'Sombra', '◈'],
  fisico: ['#d7dfe8', 'Físico', '╱'], cura: ['#90d8ae', 'Cura', '+'],
  defesa: ['#9cbfea', 'Proteção', '⬡'],
  agua: ['#8dc8ef', 'Água', '≈'], terra: ['#d1b48b', 'Terra', '▲'],
  radiante: ['#f1dfac', 'Radiante', '☼'], sombrio: ['#b9a6d7', 'Sombrio', '◐'],
  veneno: ['#bdd58a', 'Veneno', '⊙'],
};

export function perfilVisual(acao = {}, ator = {}) {
  const h = acao.habilidade || acao.hab || {};
  const tipo = h.tipo || h.efeito?.tipo || acao.tipo || 'ataque';
  const cura = /cura/.test(tipo);
  const defesa = /buff|defen|proteg|guarda/.test(tipo);
  const elemento = cura ? 'cura' : defesa ? 'defesa' : h.elemento || acao.elemento || ator.elemento || 'fisico';
  const paleta = ELEMENTOS_VISUAIS[elemento] || ELEMENTOS_VISUAIS.arcano;
  return { elemento, cor: paleta[0], simbolo: paleta[2],
    nome: h.nome || acao.nome || (cura ? 'Cura' : defesa ? 'Defesa' : tipo === 'ataque' || tipo === 'atacar' ? 'Ataque' : paleta[1]),
    suporte: cura || defesa, magia: cura || defesa || /magico|conjur|sopro/.test(tipo) || (!/fisico/.test(tipo) && elemento !== 'fisico'),
    duracao: acao.hab ? 1100 : tipo === 'ataque' || tipo === 'atacar' ? 520 : 880 };
}

// Avisos descrevem o plano real, inclusive cura e guarda de um inimigo.
export function avisoDePlano(plano, combatente) {
  if (!plano || !combatente?.vivo) return '';
  const tipo = plano.hab?.efeito?.tipo || plano.tipo;
  if (tipo === 'area' && combatente.isPlayer) return 'ÁREA · Ataque iminente';
  if (plano.alvo !== combatente) return '';
  if (/cura/.test(tipo)) return 'CURA · Alvo aliado';
  if (/proteg|guarda/.test(tipo)) return 'PROTEÇÃO · Alvo aliado';
  return 'ALVO · Ataque iminente';
}

export function mostrarEstadoCombate(arena, descricao) {
  arena.querySelector('.combate-estado-detalhe')?.remove();
  const painel = document.createElement('div');
  painel.className = 'combate-estado-detalhe';
  painel.setAttribute('role', 'status');
  const texto = document.createElement('span'); texto.textContent = descricao;
  const fechar = document.createElement('button'); fechar.textContent = 'Fechar detalhe';
  fechar.type = 'button'; fechar.onclick = () => painel.remove();
  painel.append(texto, fechar); arena.append(painel);
}

export function resumoEstados(efeitos) {
  const ordenados = [...efeitos].sort((a,b) => (a.turnos ?? Infinity) - (b.turnos ?? Infinity));
  return { visiveis: ordenados.slice(0,2), restantes: Math.max(0,ordenados.length-2),
    descricao: ordenados.map(e => `${e.label || e.chave}: ${e.titulo}${e.turnos != null ? ` · ${e.turnos} turno(s)` : ''}`).join('\n') };
}

export function resumoImpacto(alvos, resultados) {
  return alvos.map(alvo => {
    const r = resultados?.get(alvo);
    if (!r) return null;
    if (r.dano > 0) return `${alvo.nome}: −${r.dano} HP`;
    if (r.cura > 0) return `${alvo.nome}: +${r.cura} HP`;
    return null;
  }).filter(Boolean).join(' · ');
}

// Uma instância por batalha. Pular encerra somente a apresentação, nunca a regra.
export function criarApresentacaoCombate(arena, elementoDe) {
  const faixa = document.createElement('div');
  faixa.className = 'combate-leitura';
  const texto = document.createElement('span');
  texto.setAttribute('role', 'status'); texto.setAttribute('aria-live', 'polite');
  const pular = document.createElement('button');
  pular.type = 'button'; pular.textContent = 'Pular efeito'; pular.hidden = true;
  faixa.append(texto, pular);
  // A narração usa a barra fixa de informações; no centro da arena ela
  // escondia projéteis, números de dano e combatentes.
  const tela = arena.closest?.('.bt-screen') || arena.parentElement || arena;
  (tela.querySelector('#bt-legenda-acao') || arena).append(faixa);
  let finalizarEspera = null, pulou = false;
  const animacoes = new Set();
  pular.onclick = () => { pulou = true; for (const a of animacoes) a.cancel(); finalizarEspera?.(); };
  const esperar = ms => new Promise(resolve => {
    if (pulou || !arena.isConnected) return resolve();
    const timer = setTimeout(fim, ms);
    function fim() { clearTimeout(timer); finalizarEspera = null; resolve(); }
    finalizarEspera = fim;
  });
  function mover(el, frames, ms) {
    if (!el?.animate) return;
    const anim = el.animate(frames, { duration: ms, easing: 'ease-out', fill: 'none' });
    animacoes.add(anim); anim.finished.catch(() => {}).finally(() => animacoes.delete(anim));
  }
  function ponto(el) {
    const r = (el?.querySelector('.sprite-wrap') || el)?.getBoundingClientRect();
    const base = arena.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top } : null;
  }
  async function executar({ ator, alvos = [], acao = {}, impacto }) {
    pulou = false;
    const perfil = perfilVisual(acao, ator);
    const reduzido = animacoesReduzidas();
    arena.classList.toggle('combate-conforto', reduzido);
    arena.classList.add('combate-em-acao');
    const nodes = [];
    const atacante = elementoDe(ator);
    arena.querySelector('.combate-estado-detalhe')?.remove();
    const tempos = temposDaAcao(perfil, reduzido, acao.critico);
    const preparo = duracaoAnimacao(tempos.preparo);
    const retorno = duracaoAnimacao(tempos.retorno);
    const total = preparo + retorno;
    texto.textContent = `${ator?.nome || 'Ação'} · ${perfil.nome} → ${alvos.map(a => a.nome).join(', ') || 'Próprio personagem'}`;
    pular.hidden = reduzido;
    try {
      atacante?.classList.add('acao-origem');
      for (const alvo of alvos) elementoDe(alvo)?.classList.add(perfil.suporte ? 'acao-beneficio' : 'acao-destino');
      const origem = ponto(atacante);
      const primeiroDestino = ponto(elementoDe(alvos[0]));
      const direcaoX = (primeiroDestino?.x ?? 0) - (origem?.x ?? 0);
      const direcaoY = (primeiroDestino?.y ?? 0) - (origem?.y ?? 0);
      const distancia = Math.max(1, Math.hypot(direcaoX, direcaoY));
      if (!reduzido) {
        const sprite = atacante?.querySelector('.sprite-canvas');
        mover(sprite, perfil.magia ? [{ transform:'scale(1)', filter: 'brightness(1)' }, { transform:'scale(1.025)', filter: 'brightness(1.16)' }, { transform:'scale(1)', filter: 'brightness(1)' }] : [{ transform: 'translate(0,0)' }, { transform: `translate(${direcaoX / distancia * 12}px,${direcaoY / distancia * 12}px) rotate(-3deg)` }, { transform: 'translate(0,0)' }], total);
        for (const alvo of alvos.slice(0, 6)) {
          const dest = ponto(elementoDe(alvo));
          if (!dest) continue;
          const fx = document.createElement('span');
          fx.className = `combate-trajeto elemento-${perfil.elemento}`;
          fx.style.setProperty('--fx-cor', perfil.cor);
          fx.textContent = perfil.simbolo;
          fx.setAttribute('aria-hidden', 'true');
          fx.style.left = `${dest.x}px`; fx.style.top = `${dest.y}px`;
          arena.append(fx); nodes.push(fx);
          mover(fx, perfil.magia ? [{ transform: `translate(${(origem?.x ?? dest.x) - dest.x}px,${(origem?.y ?? dest.y) - dest.y}px) scale(.5)`, opacity: .3 }, { transform: 'translate(0,0) scale(1)', opacity: .75 }] : [{ transform: 'rotate(-40deg) scale(.2)', opacity: 0 }, { transform: 'rotate(20deg) scale(1.4)', opacity: .75 }], preparo);
        }
      }
      await esperar(preparo);
      nodes.forEach(n => n.remove());
      impacto(); // HP, números e status aparecem no contato, uma única vez.
      const resumo = resumoImpacto(alvos, acao.resultados);
      if (resumo) texto.textContent = `${perfil.nome} · ${resumo}`;
      elementoDe(ator)?.classList.add('acao-origem');
      for (const alvo of alvos) elementoDe(alvo)?.classList.add(perfil.suporte ? 'acao-beneficio' : 'acao-destino');
      if (tempos.pausa && !pulou) await esperar(duracaoAnimacao(tempos.pausa));
      if (!reduzido && !pulou) for (const alvo of alvos.slice(0, 6)) {
        const el = elementoDe(alvo);
        const dest = ponto(el);
        const resultadoAlvo = acao.resultados?.get(alvo);
        const atingido = resultadoAlvo ? resultadoAlvo.dano > 0 : !acao.erro && !acao.bloqueado;
        if (dest && (atingido || perfil.suporte)) {
          const anel = document.createElement('span');
          anel.className = `combate-impacto elemento-${perfil.elemento}`;
          anel.setAttribute('aria-hidden', 'true');
          anel.style.cssText = `left:${dest.x}px;top:${dest.y}px;--fx-cor:${perfil.cor}`;
          arena.append(anel); nodes.push(anel);
          mover(anel, [{ transform: 'scale(.45)', opacity: .65 }, { transform: 'scale(1.2)', opacity: 0 }], retorno);
        }
        const pose = perfil.suporte ? [{ opacity: .85 }, { opacity: 1 }] : atingido
          ? [{ transform: 'translateX(0)' }, { transform: 'translateX(4px) rotate(2deg)' }, { transform: 'translateX(0)' }]
          : [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(0)' }];
        const esquivou = acao.erro && (!acao.alvoRolagem || acao.alvoRolagem === alvo);
        if (alvo.vivo !== false && (atingido || perfil.suporte || esquivou)) mover(el?.querySelector('.sprite-canvas'), pose, retorno);
      }
      await esperar(retorno);
    } finally {
      nodes.forEach(n => n.remove());
      animacoes.forEach(a => a.cancel()); animacoes.clear();
      arena.querySelectorAll('.acao-origem,.acao-destino,.acao-beneficio').forEach(el => el.classList.remove('acao-origem','acao-destino','acao-beneficio'));
      arena.classList.remove('combate-em-acao'); pular.hidden = true;
    }
  }
  return { executar };
}
