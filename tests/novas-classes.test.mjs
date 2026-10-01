import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { criarPersonagem, aplicarCrescimento } from '../src/systems/CharacterFactory.js';
import { instanciarPersonagemGacha } from '../src/systems/GachaSystem.js';
import { criarCombatenteJogador, criarCombatenteInimigo, Batalha } from '../src/systems/CombatSystem.js';
import { arvoreDoPersonagem, subclassesDisponiveis } from '../src/systems/TalentSystem.js';
import { candidatos } from '../src/data/assetRegistry.js';
import { escolherAcaoAutomatica, configAutoBatalhaPadrao } from '../src/systems/AutoBattleAI.js';
import { migrarEquilibrioClasse } from '../src/systems/ClassBalanceMigration.js';
import { montarMao, preverCard } from '../src/systems/BattleForecast.js';
const root=new URL('../',import.meta.url),dir=new URL('src/data/',root);
const d=Object.fromEntries(readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>[f.slice(0,-5),JSON.parse(readFileSync(new URL(f,dir)))]));
const ids=['paladino','bardo','druida','necromante'];
const criar=(classe,raca='humano')=>criarPersonagem({nome:classe,raca,classe,antecedente:d.backgrounds[0].id,traco:d.traits[0].id},d);
const setup=(classe)=>{const p=criar(classe);p.nivel=10;for(let n=1;n<10;n++)aplicarCrescimento(p,d);p.hp=p.hpMax;p.mp=p.mpMax;
 const c=criarCombatenteJogador(p,d),aliado=criarCombatenteJogador(criar('guerreiro'),d);
 const e=criarCombatenteInimigo({...d.monsters.find(m=>!m.chefe),hp:10000,defesa:0},0);
 return {c,aliado,e,b:new Batalha([c,aliado],[e],d.elements),p};};
for(const id of ids){
 const classe=d.classes.find(c=>c.id===id);
 assert.equal(Object.values(classe.crescimento).reduce((a,b)=>a+b),5);
 assert.equal(d.skillTrees[id].nos.length,18);
 for(const r of d.races){
  const p=criar(id,r.id);
  while(p.nivel<25){p.nivel++;aplicarCrescimento(p,d);}
  assert.ok(Number.isFinite(p.hpMax)&&p.hpMax>0);
  assert.equal(arvoreDoPersonagem(p,d).length,12);
  assert.equal(subclassesDisponiveis(p,d).length,2);
  assert.ok(candidatos(p).some(path=>existsSync(new URL(path,root))),id+' precisa de arte disponível');
 }
 const convocados=d.gachaRoster.filter(g=>g.classeId===id);assert.equal(convocados.length,8);
 for(const g of convocados){const p=instanciarPersonagemGacha(g);assert.equal(p.classeId,id);assert.ok(candidatos({rosterId:g.id}).some(path=>existsSync(new URL(path,root))));}
 const skills=[...classe.habilidades,...d.skillTrees[id].nos.flatMap(n=>n.habilidade?[n.habilidade]:[]),...convocados.flatMap(g=>g.habilidadesExclusivas)];
 for(const h of skills){const {c,e,b}=setup(id);c.mp=1000;const skill={...h,cooldownAtual:0};
  assert.ok(b.usarHabilidade(c,skill,['cura','buff_defesa','buff_time','buff_ataque','cura_area'].includes(h.tipo)?c:e).ok);
  assert.ok(Number.isFinite(c.hp)&&Number.isFinite(e.hp));
 }
}
{
 const {c,aliado,b}=setup('paladino');const h={...d.classes.find(c=>c.id==='paladino').habilidades[1],cooldownAtual:0};
 b.usarHabilidade(c,h,c);const antes=c.hp,vida=aliado.hp;b.aplicarDano(aliado,20);
 assert.equal(antes-c.hp,4);assert.equal(vida-aliado.hp,16);
}
{
 const {c,b}=setup('bardo');const skills=d.gachaRoster.find(g=>g.classeId==='bardo'&&g.raridade==='epico').habilidadesExclusivas;
 for(const h of skills.filter(h=>h.cancao))b.usarHabilidade(c,{...h,cooldownAtual:0},c);
 for(const a of b.time)assert.equal(a.statusEffects.filter(s=>s.cantor===0).length,1);
 assert.doesNotThrow(()=>JSON.stringify(b.time));
}
{
 const {c,b,e}=setup('druida');b.usarHabilidade(c,{...d.classes.find(x=>x.id==='druida').habilidades[1],cooldownAtual:0},c);
 const cura=d.gachaRoster.find(g=>g.classeId==='druida'&&g.raridade==='epico').habilidadesExclusivas.find(h=>h.tipo==='cura_area');
 const mp=c.mp;assert.equal(b.usarHabilidade(c,{...cura,cooldownAtual:0},c).ok,false);assert.equal(c.mp,mp);
 const acao=escolherAcaoAutomatica(c,[e],configAutoBatalhaPadrao(),d,{aliados:b.time});
 assert.notEqual(acao.habilidade?.tipo,'cura_area');
 for(let i=0;i<4;i++)b.aplicarStatusTick(c);
 assert.ok(!c.statusEffects.some(s=>s.tipo==='forma_animal'));
}
{
 const {c,b,e}=setup('necromante');b.usarHabilidade(c,{...d.classes.find(x=>x.id==='necromante').habilidades[1],cooldownAtual:0},c);
 const qtd=b.time.length,vida=e.hp;b.acionarServo(c,e);assert.equal(b.time.length,qtd);assert.ok(e.hp<vida);
 c.vivo=false;const depois=e.hp;b.acionarServo(c,e);assert.equal(e.hp,depois);
}
assert.equal(new Set(d.gachaRoster.map(g=>g.id)).size,d.gachaRoster.length);
console.log('OK: 24 combinações raça/classe, 32 convocados, progressão até 25, artes disponíveis, habilidades, intercessão, canções, metamorfose e servo.');
{
 const p={classeId:'mago',nivel:10,atributos:{FOR:3,DES:14,CON:13,INT:27},hp:0,hpMax:61};
 migrarEquilibrioClasse(p);assert.equal(p.atributos.CON,22);assert.equal(p.hp,0);
 const copia=JSON.stringify(p);migrarEquilibrioClasse(p);assert.equal(JSON.stringify(p),copia);
 const novo=criar('mago');const atributos={...novo.atributos};migrarEquilibrioClasse(novo);assert.deepEqual(novo.atributos,atributos);
}
{
 const {c,e,b}=setup('paladino');
 const card=montarMao(c).find(card=>card.habilidade?.intercessao);
 assert.equal(card.alvoTipo,'self');
 const p=preverCard(card,{batalha:b,jogador:c,alvo:null,inimigosVivos:[e],aliados:b.time,dados:d,intencoes:[]});
 assert.equal(p.exigeAlvo,false);assert.equal(p.disponivel,true);
}
console.log('OK: migração idempotente sem ressuscitar e proteção sem exigir alvo inimigo.');
