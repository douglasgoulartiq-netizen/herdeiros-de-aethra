import { carregarDados, carregarImagemCadeia } from '../src/data/loader.js';
import { GACHA_FINAL_ART } from '../src/data/gachaFinalArt.js';
import { CLASS_EFFECT_ART } from '../src/data/classVisuals.js';
import { criarPersonagem } from '../src/systems/CharacterFactory.js';
import { instanciarPersonagemGacha, estadoGachaInicial } from '../src/systems/GachaSystem.js';
import { montarParty } from '../src/ui/PartyUI.js';
import { iniciarBatalha } from '../src/ui/BattleUI.js';
const status=document.querySelector('#preview-status');
window.addEventListener('error',e=>{status.textContent='ERRO: '+e.message;});
window.addEventListener('unhandledrejection',e=>{status.textContent='ERRO: '+e.reason;});
try{
 const d=await carregarDados(),novos=d.gachaRoster.filter(g=>GACHA_FINAL_ART['gacha_'+g.id]);
 const p=criarPersonagem({nome:'Verificação local',raca:'humano',classe:'paladino',antecedente:d.backgrounds[0].id,traco:d.traits[0].id},d);
 p.gacha=estadoGachaInicial();p.gacha.personagensObtidos=novos.map(instanciarPersonagemGacha);
 p.gacha.timeAtivo=p.gacha.personagensObtidos.slice(0,3).map(g=>g.uid);
 const select=document.querySelector('#preview-hero');
 select.innerHTML=novos.map(g=>'<option value="'+g.id+'">'+g.nome+' — '+g.classeId+'</option>').join('');
 document.querySelector('#preview-gallery').innerHTML=novos.map(g=>'<figure><img loading="lazy" src="../'+GACHA_FINAL_ART['gacha_'+g.id]+'" alt="'+g.nome+'"><figcaption>'+g.nome+'<br>'+g.classeId+' · '+g.raridade+'</figcaption></figure>').join('');
 document.querySelector('#preview-party').onclick=()=>montarParty(p,[],d,()=>{},{aba:'ficha',membroUid:p.gacha.personagensObtidos.find(g=>g.rosterId===select.value).uid,membroIdx:0,filtro:'todos',busca:'',uidSelecionado:null});
 document.querySelector('#preview-battle').onclick=async()=>{
  const selected=p.gacha.personagensObtidos.find(g=>g.rosterId===select.value);
  const others=['druida','necromante','bardo'].filter(cl=>cl!==selected.classeId).map(cl=>p.gacha.personagensObtidos.find(g=>g.classeId===cl));
  const extras=[selected,others[0],others.find(g=>g.classeId!==others[0].classeId)];
  const mob={...d.monsters.find(m=>!m.chefe),hp:400},imagens={};
  await Promise.all(Object.entries(CLASS_EFFECT_ART).map(async ([key,path])=>{imagens['efeito_'+key]=await carregarImagemCadeia([path]);}));
  await Promise.all(extras.map(async g=>{imagens[g.spriteKey]=await carregarImagemCadeia([GACHA_FINAL_ART[g.spriteKey]]);}));
  imagens['pcb_humano_paladino']=await carregarImagemCadeia(['assets/arte_intermediaria/pc_humano_guerreiro.png']);
  imagens[mob.sprite]=await carregarImagemCadeia(['assets/arte_v2/'+mob.sprite+'.png','assets/sprites/'+mob.sprite+'.png']);
  const screen=document.querySelector('#screen-batalha');screen.classList.remove('hidden');
  iniciarBatalha(screen,imagens,d,p,extras,[mob],'natureza',null,null,[],resultado=>{
   screen.classList.add('hidden');
   status.textContent='Batalha concluída: '+resultado+'. Nenhum save foi gravado.';
  },{zonaNome:'Teste local',zonaId:'vila'});
 };
 document.querySelectorAll('#preview-controls button').forEach(b=>b.disabled=false);
 status.textContent=novos.length+' convocados · ficha e batalha usam os módulos reais · nenhum save é gravado por esta página.';
}catch(e){status.textContent='ERRO: '+e.message;console.error(e);}
