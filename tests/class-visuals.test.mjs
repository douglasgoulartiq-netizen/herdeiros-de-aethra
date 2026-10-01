import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALK_ART, CLASS_EFFECT_ART, quadroCaminhada, visualDeClasse } from '../src/data/classVisuals.js';
import { desenharVisualDeClasse } from '../src/render/ClassCombatVisuals.js';
import { Renderer } from '../src/render/Renderer.js';
const races=JSON.parse(readFileSync(new URL('../src/data/races.json',import.meta.url)));
const classes=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url)));
for(const raca of races) for(const classe of classes)
 assert.ok(WALK_ART[`pc_${raca.id}_${classe.id}`],`Falta caminhada: ${raca.id}/${classe.id}`);
assert.equal(Object.keys(WALK_ART).length,races.length*classes.length);
for (const [key,path] of Object.entries(WALK_ART)) {
 const png=readFileSync(new URL('../'+path,import.meta.url));
 assert.equal(png[25],6,key+' precisa de alpha');
 const img={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
 for (const dir of ['baixo','esquerda','direita','cima']) for(let fase=0;fase<4;fase++) {
  const q=quadroCaminhada(img,dir,fase,true,key);
  assert.ok(q.x>=0&&q.y>=0&&q.x+q.w<=img.width+.01&&q.y+q.h<=img.height+.01);
 }
 assert.equal(quadroCaminhada(img,'cima',0,false,key).y,img.height*3/4);
 // Exercita o renderer real com todas as combinações e dimensões do mapa.
 // O contexto só permite a sombra e a imagem: uma capa geométrica regressiva
 // (quadraticCurveTo/fillRect) faz este teste falhar.
 for(const tilePx of [34,64]) for(const andando of [false,true]) for(const dir of ['baixo','esquerda','direita','cima']) {
  const draws=[];
  const ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},drawImage(...args){draws.push(args);}};
  Renderer.prototype.desenharJogador.call({ctx,tilePx,imagens:{['walk_'+key]:img},gridAtual:[]},
   {spriteKey:key,dir,andando,fasePasso:3,x:0,y:0},{x:100,y:100},{x:0,y:0});
  assert.equal(draws.length,1,key+' precisa de uma única imagem do corpo');
  assert.equal(draws[0][0],img,key+' deve usar a folha direcional');
  if(dir==='cima') assert.equal(draws[0][2],img.height*3/4,key+' deve mostrar as costas');
 }
}
for(const path of Object.values(CLASS_EFFECT_ART)) assert.equal(readFileSync(new URL('../'+path,import.meta.url))[25],6);
const c={vivo:true,statusEffects:[{tipo:'forma_animal'},{tipo:'servo_vinculado'}]};
assert.deepEqual(visualDeClasse(c),{fera:true,servo:true});
assert.deepEqual(visualDeClasse({...c,vivo:false}),{fera:false,servo:false});
assert.deepEqual(visualDeClasse({...c,statusEffects:[]}),{fera:false,servo:false});
const calls=[],ctx={clearRect(){},save(){},restore(){},drawImage(...a){calls.push(a);}};
const imgs={efeito_forma_fera:{width:1280,height:1280},efeito_servo_vinculado:{width:1280,height:1280}};
desenharVisualDeClasse(ctx,c,imgs,0,true);const antes=JSON.stringify(calls);calls.length=0;
desenharVisualDeClasse(ctx,c,imgs,1234,true);assert.equal(JSON.stringify(calls),antes,'Movimento reduzido fica estável');
for(const a of calls){const [x,y,w,h]=a.slice(-4);assert.ok(x>=0&&y>=0&&x+w<=192&&y+h<=192);}
calls.length=0;desenharVisualDeClasse(ctx,{...c,vivo:false},imgs,0);assert.equal(calls.length,0);
console.log(`OK: ${Object.keys(WALK_ART).length} folhas, todas as raças/classes, quatro direções, 2 efeitos, estados/morte, limites do canvas e movimento reduzido.`);
