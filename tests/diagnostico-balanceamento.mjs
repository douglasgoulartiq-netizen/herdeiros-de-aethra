import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { criarPersonagem, aplicarCrescimento } from '../src/systems/CharacterFactory.js';
import { instanciarPersonagemGacha } from '../src/systems/GachaSystem.js';
import { criarCombatenteJogador, criarCombatenteInimigo, Batalha } from '../src/systems/CombatSystem.js';
import { escolherAcaoAutomatica, configAutoBatalhaPadrao } from '../src/systems/AutoBattleAI.js';

const dataDir = new URL('../src/data/', import.meta.url);
const dados = Object.fromEntries(readdirSync(dataDir).filter(f => f.endsWith('.json')).map(f =>
  [f.slice(0,-5), JSON.parse(readFileSync(new URL(f, dataDir)))]));
const N = Number(process.env.HDA_AMOSTRAS || 24);
const niveis = [5,15,25];
const config = configAutoBatalhaPadrao();
const originalRandom = Math.random;
function seed(s) { Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const defs = [
  ...dados.classes.flatMap(c => dados.races.map(r => ({id:`pc:${r.id}:${c.id}`, nome:`${c.nome} · ${r.nome}`, classe:c.id, raca:r.id, origem:'protagonista'}))),
  ...dados.gachaRoster.map(g => ({id:g.id,nome:g.nome,classe:g.classeId,raca:g.racaId,origem:'gacha',raridade:g.raridade,roster:g})),
];
function criar(def, nivel) {
  const p = def.roster ? instanciarPersonagemGacha(def.roster) : criarPersonagem({nome:def.nome,raca:def.raca,classe:def.classe,
    antecedente:dados.backgrounds[0].id,traco:dados.traits[0].id}, dados);
  while (p.nivel < nivel) { p.nivel++; aplicarCrescimento(p,dados); }
  // Mesmo orçamento de dano/defesa, atributo da arma adequado ao crescimento.
  const classe = dados.classes.find(c => c.id === def.classe);
  const atributo = ['FOR','DES','INT'].sort((a,b) => classe.crescimento[b]-classe.crescimento[a] || p.atributos[b]-p.atributos[a])[0];
  p.equipamento.arma = {id:'benchmark_arma',nome:'Arma padrão',tipo:'arma',atributo,dano:Math.round(3+nivel*.4),elemento:'fisico'};
  p.equipamento.peito = {id:'benchmark_peito',nome:'Armadura padrão',tipo:'armadura',defesa:Math.round(2+nivel*.2)};
  p.hp=p.hpMax; p.mp=p.mpMax;
  return p;
}
const modelos = new Map();
for (const d of defs) for (const n of niveis) modelos.set(`${d.id}:${n}`,criar(d,n));
const fixos = ['guerreiro','mago','clerigo'].map(classe => defs.find(d => d.origem==='protagonista' && d.raca==='humano' && d.classe===classe));
const cenarios = ['duelo','grupo','chefe'];
const encontros = {};
for (const nivel of niveis) {
  const comuns = dados.monsters.filter(m => !m.chefe).sort((a,b) => Math.abs((a.nivel||1)-nivel)-Math.abs((b.nivel||1)-nivel) || b.hp-a.hp).slice(0,6);
  const chefes = dados.monsters.filter(m => m.chefe).sort((a,b) => Math.abs((a.nivel||1)-nivel)-Math.abs((b.nivel||1)-nivel) || b.hp-a.hp).slice(0,3);
  encontros[nivel]={comuns,chefes};
}
function simular(def,nivel,cenario,amostra) {
  seed(10000+nivel*100+amostra);
  const candidatos = encontros[nivel];
  const inimigosDef = cenario==='chefe' ? [candidatos.chefes[amostra%candidatos.chefes.length]]
    : Array.from({length:cenario==='duelo'?1:4},(_,i)=>candidatos.comuns[(amostra+i)%candidatos.comuns.length]);
  const personagens = [structuredClone(modelos.get(`${def.id}:${nivel}`)),
    ...(cenario==='duelo'?[]:fixos.map(d=>structuredClone(modelos.get(`${d.id}:${nivel}`))))];
  const tanque = ['guerreiro','barbaro','paladino'].includes(def.classe);
  const time=personagens.map((p,i)=>criarCombatenteJogador(p,dados,
    cenario==='duelo' || (tanque ? i<2 : i===1 || i===2) ? 'frente' : 'retaguarda'));
  const b=new Batalha(time,inimigosDef.map((m,i)=>criarCombatenteInimigo(m,i)),dados.elements,null,[],0,null,false,dados.elementalStates,dados.elementalReactions);
  let acoes=0,dano=0,cura=0,suporte=0,acoesProprias=0;
  for(let tick=0;tick<10000 && !b.terminada && acoes<400;tick++) {
    for(const ator of b.avancarATB(1.6)) {
      if(b.terminada) break;
      if(!ator.vivo) continue;
      const hpAntes=b.inimigos.reduce((s,c)=>s+c.hp,0);
      const aliadosAntes=time.reduce((s,c)=>s+c.hp,0);
      if(ator.isPlayer) {
        if(b.jogadorControladoPorEstado(ator)) b.perderTurnoJogadorPorEstado(ator);
        else {
          const d=escolherAcaoAutomatica(ator,b.inimigosVivos(),config,dados,{aliados:b.timeVivo()});
          if(d.habilidade) b.usarHabilidade(ator,d.habilidade,['curar','curar_time','buff_time'].includes(d.tipo)?ator:d.alvo);
          else if(d.tipo==='defender') {ator.defendendo=true;ator.primeiroTurno=false;}
          else if(d.alvo) b.ataqueBasico(ator,d.alvo);
          if(ator===time[0] && ['buff_time','debuff_area'].includes(d.tipo)) suporte++;
        }
      } else b.iaInimigoAgir(ator);
      if(ator===time[0]) {acoesProprias++; dano+=Math.max(0,hpAntes-b.inimigos.reduce((s,c)=>s+c.hp,0)); cura+=Math.max(0,time.reduce((s,c)=>s+c.hp,0)-aliadosAntes);}
      ator.atb=0;
      b.tickCooldowns(ator);b.aplicarStatusTick(ator);b.verificarFim();acoes++;
    }
  }
  return {vitoria:+(b.resultado==='vitoria'),limite:+!b.terminada,acoes,dano,cura,suporte,acoesProprias,
    sobrevivencia:+time[0].vivo,vidaTime:time.reduce((s,c)=>s+Math.max(0,c.hp),0)/time.reduce((s,c)=>s+c.hpMax,0)};
}
const resultados=[];
try {
 for(const def of defs) {
  const linhas=[];
  for(const nivel of niveis) for(const cenario of cenarios) {
    const totais={vitoria:0,limite:0,acoes:0,dano:0,cura:0,suporte:0,acoesProprias:0,sobrevivencia:0,vidaTime:0};
    for(let a=0;a<N;a++) {const r=simular(def,nivel,cenario,a);for(const k in totais) totais[k]+=r[k]/N;}
    linhas.push({nivel,cenario,...totais});
  }
  const media = campo => linhas.reduce((s,l)=>s+l[campo],0)/linhas.length;
  const grupo=linhas.filter(l=>l.cenario!=='duelo');
  const vitoriaTime=grupo.reduce((s,l)=>s+l.vitoria,0)/grupo.length;
  const vitoriaSolo=linhas.filter(l=>l.cenario==='duelo').reduce((s,l)=>s+l.vitoria,0)/3;
  // Desempenho de grupo domina; dano não recebe bônus que puniria curandeiros.
  const indice=100*(.6*vitoriaTime+.15*vitoriaSolo+.15*media('vidaTime')+.1*media('sobrevivencia'));
  const {roster,...identidade}=def;
  resultados.push({...identidade,indice,vitoriaTime,vitoriaSolo,dano:media('dano'),cura:media('cura'),suporte:media('suporte'),acoes:media('acoes'),linhas});
 }
} finally {Math.random=originalRandom;}
resultados.sort((a,b)=>b.indice-a.indice || a.acoes-b.acoes);
const classes=dados.classes.map(c=>{const rs=resultados.filter(r=>r.origem==='protagonista'&&r.classe===c.id);return {classe:c.nome,indice:rs.reduce((s,r)=>s+r.indice,0)/rs.length};}).sort((a,b)=>b.indice-a.indice);
const percentual = n=>(100*n).toFixed(1)+'%';
const tabela = origem => ['| # | Personagem | Classe | Índice | Vitória time | Vitória solo | Cura/luta |','|---|---|---|---:|---:|---:|---:|',...resultados.filter(r=>r.origem===origem).slice(0,20).map((r,i)=>`| ${i+1} | ${r.nome} | ${r.classe} | ${r.indice.toFixed(1)} | ${percentual(r.vitoriaTime)} | ${percentual(r.vitoriaSolo)} | ${r.cura.toFixed(1)} |`)].join('\n');
const relatorio=`# Diagnóstico de balanceamento\n\n${defs.length} candidatos × 3 níveis × 3 cenários × ${N} sementes = ${defs.length*9*N} batalhas do motor real, sem interface.\n\nEquipamento sintético de orçamento igual; sem talentos comprados, consumíveis ou despertar. IA equilibrada. Protagonistas usam mesma origem/traço. Aliados fixos: guerreiro, mago, clérigo humanos; candidato sempre na frente. Isso não mede todas as formações ou habilidade humana. Cenários usam monstros reais mais próximos do nível; confira níveis reais no JSON.\n\nÍndice 0–100 (não poder do jogo): 60% vitória em grupo + 15% vitória solo + 15% vida restante do time + 10% sobrevivência. Não premia dano bruto diretamente. Empate resolvido por duração, sem alegar diferença significativa.\n\n## Protagonistas\n${tabela('protagonista')}\n\n## Gacha\n${tabela('gacha')}\n\n## Classes do protagonista (média das raças)\n${classes.map(c=>`- ${c.classe}: ${c.indice.toFixed(2)}`).join('\n')}\n\n## Limites\nRanking deste protocolo, não tier list universal. Comparar raridades separadamente antes de nerfar. Sem amostragem de partidas humanas, sem validar UX, equipamento ideal ou composições diversas. Curar/bufar conta no resultado coletivo, mas o time fixo pode esconder redundância e sinergias. Uma segunda bateria deve variar posição, aliados e equipamento antes de mudanças de atributos.\n`;
mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});
writeFileSync(new URL('../reports/balanceamento.json',import.meta.url),JSON.stringify({amostras:N,totalBatalhas:defs.length*9*N,classes,encontros,resultados},null,2));
const relatorioFinal = relatorio.replace('candidato sempre na frente', 'duas vagas por fileira: candidato guerreiro, bárbaro ou paladino na frente; demais candidatos na retaguarda. Os aliados preenchem as outras vagas (duelo sempre na frente)');
writeFileSync(new URL('../reports/balanceamento.md',import.meta.url),relatorioFinal);
console.log(relatorioFinal);
