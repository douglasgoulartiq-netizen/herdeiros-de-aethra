import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GACHA_FINAL_ART } from '../src/data/gachaFinalArt.js';
import { candidatos, chaveDe, USOS } from '../src/data/assetRegistry.js';
import { carregarTodasImagens } from '../src/data/loader.js';
import { estadoGachaInicial, instanciarPersonagemGacha, invocarPermanente } from '../src/systems/GachaSystem.js';
import { aplicarCrescimento } from '../src/systems/CharacterFactory.js';
import { CUSTO_INVOCACAO } from '../src/data/economyConfig.js';
const root=new URL('../',import.meta.url),dir=new URL('src/data/',root);
const d=Object.fromEntries(readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>[f.slice(0,-5),JSON.parse(readFileSync(new URL(f,dir)))]));
const novos=d.gachaRoster.filter(g=>GACHA_FINAL_ART['gacha_'+g.id]);
assert.equal(novos.length,32);
const hashes=new Set();
for(const g of novos){
 const key='gacha_'+g.id,p=instanciarPersonagemGacha(g),path=GACHA_FINAL_ART[key];
 assert.equal(chaveDe(p),key,'A instância precisa manter sua arte exclusiva');
 for(const uso of Object.values(USOS))assert.deepEqual(candidatos(p,uso),[path]);
 const png=readFileSync(new URL(path,root));
 assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.equal(png[25],6,'PNG deve ter canal alpha RGBA');
 hashes.add(createHash('sha256').update(png).digest('hex'));
 assert.ok(d.races.some(r=>r.id===g.racaId));
 assert.ok(p.habilidades.every(h=>h.custoMP<=p.mpMax));
 while(p.nivel<25){p.nivel++;aplicarCrescimento(p,d);}
 assert.ok(Number.isFinite(p.hpMax)&&Number.isFinite(p.mpMax));
 assert.equal(new Set(p.habilidades.map(h=>h.id)).size,p.habilidades.length);
}
assert.equal(hashes.size,32,'Cada personagem deve ter imagem própria');
// Exercita o sorteio real completo, sem alterar as probabilidades do jogo.
const realRandom=Math.random;let seed=20260930;
Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
try{
 const p={gacha:estadoGachaInicial()};p.gacha.fragmentos=CUSTO_INVOCACAO*20000;
 for(let i=0;i<20000;i++)assert.ok(invocarPermanente(p,d.gachaRoster,d).ok);
 const obtidos=new Set(p.gacha.personagensObtidos.map(g=>g.rosterId));
 for(const g of novos)assert.ok(obtidos.has(g.id),'Convocado ausente dos sorteios: '+g.id);
}finally{Math.random=realRandom;}
// A segunda leva não baixa 20 MB de arte na abertura do jogo.
const realImage=globalThis.Image,realTimeout=globalThis.setTimeout,requests=[];
globalThis.Image=class {set src(value){requests.push(value);queueMicrotask(()=>this.onload());}};
globalThis.setTimeout=()=>0;
try{
 const cache=await carregarTodasImagens({races:[],classes:[],monsters:[],gachaRoster:novos,npcs:[]});
 assert.ok(!requests.some(url=>Object.values(GACHA_FINAL_ART).includes(url)));
 const key='gacha_'+novos[0].id;assert.equal(cache[key],undefined);
 await new Promise(resolve=>realTimeout(resolve,0));
 assert.ok(cache[key]);
 assert.equal(requests.filter(url=>Object.values(GACHA_FINAL_ART).includes(url)).length,1);
}finally{globalThis.Image=realImage;globalThis.setTimeout=realTimeout;}
console.log('OK: 32 artes únicas com alpha, identidade exclusiva em todos os usos, progressão até 25, 20.000 invocações reais do motor e carga de arte sob demanda.');
