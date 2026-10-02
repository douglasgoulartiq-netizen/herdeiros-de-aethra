import assert from 'node:assert/strict';
import {quadroPersonagem,encaixeCorpo} from '../src/render/CharacterArt.js';
import {candidatos,USOS} from '../src/data/assetRegistry.js';
import {imgHtml} from '../src/systems/AssetResolver.js';
// Uma imagem em uma tag CSS de 48px ainda usa seus pixels originais.
assert.deepEqual(quadroPersonagem({width:48,height:48,naturalWidth:1200,naturalHeight:1600},true),{x:400,y:0,w:400,h:400});
for(const shape of [{w:300,h:900},{w:900,h:300},{w:300,h:300}]){
  for(const raca of ['humano','anao','halfling']){
    const d=encaixeCorpo(shape,192,raca);
    assert.ok(d.x>=0 && d.y>=0 && d.x+d.w<=192 && d.y+d.h<=192);
    assert.ok(Math.abs(d.w/d.h-shape.w/shape.h)<1e-8);
    assert.ok(Math.abs(d.y+d.h-192*.95)<1e-8);
  }
}
for(const classe of ['paladino','bardo','druida','necromante']){
  const p={racaId:'elfo',classeId:classe};
  assert.equal(candidatos(p,USOS.COMBATE)[0],`assets/sprites/walk_v2_pc_elfo_${classe}.png`);
  assert.match(imgHtml(p,USOS.RETRATO),/data-personagem="1"/);
  assert.match(imgHtml(p,USOS.RETRATO),/data-retrato="1"/);
}
assert.doesNotMatch(imgHtml({sprite:'mob_slime'},USOS.RETRATO),/data-personagem/);
console.log('OK: tamanho intrínseco, 9 enquadramentos, 4 classes exclusivas e exclusão de monstros.');
