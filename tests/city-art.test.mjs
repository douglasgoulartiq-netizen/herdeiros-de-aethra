import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {ARTES_CIDADES, ARQUITETURA_REGIONAL, arteDaCidade} from '../src/data/cityArt.js';
import {IDENTIDADE_REGIAO} from '../src/data/world/regionIdentity.js';
import {mundoDaSemente,limparCacheMundo} from '../src/systems/WorldBuilder.js';
import {SOLID_TILES} from '../src/data/worldMap.js';
import {Renderer} from '../src/render/Renderer.js';
import {caixaDoProp} from '../src/data/propRegistry.js';

assert.equal(ARTES_CIDADES.length,17);
for(const id of Object.keys(IDENTIDADE_REGIAO)) {
  assert.ok(ARQUITETURA_REGIONAL[id], `Região sem arquitetura: ${id}`);
  for(const asset of ARQUITETURA_REGIONAL[id]) assert.ok(ARTES_CIDADES.includes(asset));
}
let bytes=0;
for(const id of ARTES_CIDADES) {
  const path=new URL(`../assets/props/cidades-v3/${id}.png`,import.meta.url);
  const png=readFileSync(path);
  assert.equal(png.readUInt32BE(16),512,id);
  assert.equal(png.readUInt32BE(20),512,id);
  assert.equal(png[25],6,`${id}: RGBA necessário`);
  bytes+=statSync(path).size;
}
assert.ok(bytes<2*1024*1024,'Pacote de cidades acima de 2 MB');
assert.equal(arteDaCidade({id:'poste',x:1,y:2},'altaverde'),null);
for(const seed of ['cidade-v3','20260906','cidades-costeiras']) {
  limparCacheMundo();
  const m=mundoDaSemente(seed);
  let total=0;
  for(const city of m.assentamentos) {
    const buildings=m.props.filter(p=>p.assentamentoId===city.id && (p.id.startsWith('casa')||['templo','pousada'].includes(p.id)));
    assert.ok(buildings.length,city.nome);
    for(const p of buildings) {
      assert.ok(ARTES_CIDADES.includes(p.arteCidade),`${city.nome}: arte ausente`);
      assert.equal(p.arteCidade,arteDaCidade(p,p.regiaoId));
      total++;
    }
    for(let i=0;i<buildings.length;i++) for(let j=i+1;j<buildings.length;j++) {
      const a=caixaDoProp(buildings[i]),b=caixaDoProp(buildings[j]);
      assert.ok(a.tx+a.larguraTiles<=b.tx || b.tx+b.larguraTiles<=a.tx || a.ty+a.alturaTiles<=b.ty || b.ty+b.alturaTiles<=a.ty,
        `${city.nome}: silhuetas de prédios se sobrepõem`);
    }
    for(const p of city.ruas || []) assert.ok(!SOLID_TILES.has(m.grid[p.y][p.x]),`${city.nome}: rua bloqueada`);
    if(city.descanso) assert.ok(!SOLID_TILES.has(m.grid[city.descanso.y][city.descanso.x]));
  }
  console.log(`OK ${seed}: ${m.assentamentos.length} assentamentos, ${total} prédios com arte, ruas e descanso livres`);
}
console.log(`OK 17 imagens: ${(bytes/1024).toFixed(0)} KB`);

const renderer=Object.create(Renderer.prototype);
const drawn=[];
Object.assign(renderer,{canvas:{width:1000,height:1000},tilePx:32,escala:.5,
  alfaOclusao:new Map(),oclusaoTocada:new Set(),deslocamentoAltura:()=>0,
  ctx:{save(){},restore(){},drawImage(img){drawn.push(img)}},
  imagens:{cidade_campo:{width:512,height:512},prop_casa_p:{width:256,height:256}},
});
const prop={id:'casa_p',arteCidade:'campo',x:5,y:5};
assert.ok(renderer.desenharProp(prop,{x:0,y:0}));
assert.equal(drawn.at(-1),renderer.imagens.cidade_campo,'Renderer não usou nova arte');
renderer.imagens.cidade_campo={width:32,height:32};
assert.ok(renderer.desenharProp(prop,{x:0,y:0}));
assert.equal(drawn.at(-1),renderer.imagens.prop_casa_p,'Fallback perdeu o prédio');
console.log('OK renderização usa arte regional e recupera sprite legado se download falhar');
