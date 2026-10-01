import { Renderer } from '../src/render/Renderer.js';
import { WALK_ART, quadroCaminhada } from '../src/data/classVisuals.js';
const race=document.querySelector('#race'), moving=document.querySelector('#moving'), night=document.querySelector('#night'), status=document.querySelector('#status'), gallery=document.querySelector('#gallery');
const races=['humano','elfo','anao','halfling','orc','draconato'];
race.innerHTML=races.map(r=>`<option>${r}</option>`).join('');
const images=new Map();
async function load(key){
 if(!images.has(key)) images.set(key,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{images.delete(key);reject(new Error(key));};img.src=WALK_ART[key];}));
 return images.get(key);
}
let actors=[],generation=0;
async function showRace(){
 const current=++generation;actors=[];gallery.replaceChildren();status.textContent='Carregando '+race.value+'…';
 const keys=Object.keys(WALK_ART).filter(k=>k.startsWith(`pc_${race.value}_`));
 const loaded=await Promise.allSettled(keys.map(load));if(current!==generation)return;
 for(let i=0;i<keys.length;i++){
  const card=document.createElement('article'), title=document.createElement('h2');title.textContent=keys[i].replace('pc_','').replaceAll('_',' · ');card.append(title);gallery.append(card);
  if(loaded[i].status==='rejected'){card.append('Imagem ausente');continue;}
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=136;canvas.setAttribute('aria-label',title.textContent+' frente, esquerda, direita, costas');card.append(canvas);
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  actors.push({ctx,key:keys[i],renderer:{ctx,tilePx:70,imagens:{['walk_'+keys[i]]:loaded[i].value},gridAtual:[]}});
 }
 status.textContent=`${actors.length}/${keys.length} folhas carregadas · nenhuma partida ou save alterado.`;
}
document.querySelector('#validate').onclick=async()=>{
 const failures=[];let done=0;
 for(const key of Object.keys(WALK_ART)){
  try{const img=await load(key);for(const dir of ['baixo','esquerda','direita','cima'])for(let f=0;f<4;f++){
   const q=quadroCaminhada(img,dir,f,true,key);if(q.x<0||q.y<0||q.x+q.w>img.width+.01||q.y+q.h>img.height+.01)throw Error('recorte');
  }}catch(e){failures.push(key);}
  status.textContent=`Validação ${++done}/${Object.keys(WALK_ART).length}`;
 }
 status.textContent=failures.length?`FALHA: ${failures.join(', ')}`:`OK: ${done} folhas decodificadas, quatro direções e recortes válidos.`;
};
race.onchange=()=>showRace().catch(e=>{status.textContent=e.message;});
function draw(time){
 const walking=moving.checked&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const a of actors){a.ctx.clearRect(0,0,400,136);for(const [i,dir]of ['baixo','esquerda','direita','cima'].entries()){
  Renderer.prototype.desenharJogador.call(a.renderer,{spriteKey:a.key,dir,andando:walking,fasePasso:time/155,horaNoite:night.checked,x:0,y:0},{x:50+i*100,y:89},{x:0,y:0});
 }}requestAnimationFrame(draw);
}
await showRace();requestAnimationFrame(draw);
