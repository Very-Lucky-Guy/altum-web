const editions={original:{name:'Original',image:'assets/original.webp'},cobalt:{name:'Cobalt',image:'assets/cobalt.webp'},fuchsia:{name:'Fuchsia',image:'assets/fuchsia.webp'}};
const stories={en:[`Before building cities, humankind learned to listen to the earth. We recognized the coming rain, sought shelter among the trees, and found in fire a way through the night. Our bodies understood the world through cold, hunger, touch, and the presence of others.`,`Over time, we built a world that seems capable of sustaining itself. Yet we still breathe because of forests, draw nourishment from the soil, and search for belonging. Beneath everything we have learned, that nature remains: vulnerable, instinctive, capable of protecting and destroying.`,`In ORIGO, the gorilla emerges from darkness, its strength held in quiet restraint. Its amber eyes meet our gaze. In them, we recognize a kinship that calls us to remember our place among living beings and the responsibility that comes with it.`,`To wear this piece is to carry a question: what do we do with the strength we have been given?`,`The earth is part of our bodies. To care for it is to care for who we are.`,`ORIGO. The earth lives within us.`],es:[`Antes de levantar ciudades, el hombre aprendió a escuchar la tierra. Reconocía la llegada de la lluvia, buscaba refugio entre los árboles y encontraba en el fuego una forma de atravesar la noche. Su cuerpo conocía el mundo a través del frío, el hambre, el tacto y la presencia de otros.`,`Con el tiempo, construimos un mundo que parece capaz de sostenerse por sí mismo. Pero seguimos respirando gracias a los bosques, alimentándonos de la tierra y buscando pertenencia. Bajo todo lo que hemos aprendido permanece esa naturaleza: vulnerable, instintiva, capaz de proteger y de destruir.`,`En ORIGO, el gorila emerge de la oscuridad con la fuerza contenida. Sus ojos ámbar sostienen nuestra mirada. En ellos encontramos un parentesco que nos obliga a recordar nuestra condición de seres vivos y la responsabilidad que nace de ella.`,`Llevar esta obra es llevar una pregunta: ¿qué hacemos con la fuerza que nos fue dada?`,`La tierra forma parte de nuestro cuerpo. Cuidarla es también cuidar aquello que somos.`,`ORIGO. La tierra sigue dentro de nosotros.`]};
let language='en',edition='original',size=null,view='art';
const dialog=document.querySelector('#work-dialog'),detailImage=document.querySelector('#detail-image');
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target);}})},{threshold:.12});document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
function header(){document.querySelector('.navigation').classList.toggle('visible',window.scrollY>180)}window.addEventListener('scroll',header,{passive:true});header();
function renderStory(){document.querySelector('#story-content').replaceChildren(...stories[language].map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));}
function renderSelection(){document.dispatchEvent(new CustomEvent('selectionchange',{detail:{edition,size,language}}));document.querySelector('#selection-note').textContent=size?`ORIGO / ${editions[edition].name} / ${language==='en'?'Size':'Talla'} ${size}`:'';}
function renderEdition(){document.querySelector('#edition-title').textContent=editions[edition].name;document.querySelectorAll('[data-select]').forEach(b=>{const selected=b.dataset.select===edition;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});document.querySelectorAll('[data-view]').forEach(b=>{b.hidden=edition!=='original'&&b.dataset.view!=='art';b.classList.toggle('selected',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});detailImage.src=view==='art'?editions[edition].image:`assets/${view}-dark.webp`;detailImage.alt=`ORIGO ${editions[edition].name} / ${view}`;detailImage.classList.toggle('garment',view!=='art');detailImage.parentElement.classList.toggle('is-garment',view!=='art');renderSelection();}
function selectEdition(key){edition=key;view='art';renderEdition();}
function openWork(key='original'){selectEdition(key);renderStory();if(!dialog.open){dialog.showModal();document.body.style.overflow='hidden';dialog.scrollTop=0;}}
document.querySelector('.portrait-trigger').addEventListener('click',()=>openWork());document.querySelector('#discover').addEventListener('click',()=>openWork());document.querySelectorAll('[data-edition]').forEach(b=>b.addEventListener('click',()=>openWork(b.dataset.edition)));
document.querySelectorAll('[data-select]').forEach(b=>b.addEventListener('click',()=>selectEdition(b.dataset.select)));document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;renderEdition();}));
document.querySelectorAll('.size-picker button').forEach(b=>b.addEventListener('click',()=>{size=b.textContent;document.querySelectorAll('.size-picker button').forEach(x=>{const selected=x===b;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected));});renderSelection();}));
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.body.style.overflow='');
document.querySelector('#language').addEventListener('click',()=>{language=language==='en'?'es':'en';document.documentElement.lang=language;document.querySelectorAll('[data-en]').forEach(e=>e.innerHTML=e.dataset[language]);const button=document.querySelector('#language');button.textContent=language==='en'?'ES':'EN';button.setAttribute('aria-label',language==='en'?'Switch to Spanish':'Cambiar a inglés');document.querySelector('.portrait-trigger').setAttribute('aria-label',language==='en'?'Discover ORIGO':'Descubrir ORIGO');document.querySelector('#close-dialog').setAttribute('aria-label',language==='en'?'Close work':'Cerrar obra');renderStory();renderSelection();});renderStory();renderEdition();

// A brief blink only while the original portrait is visible and the visitor allows motion.
const portrait=document.querySelector('.portrait-trigger');
const eyelids=portrait.querySelector('.blink-frame');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let portraitVisible=false,blinkTimer=null,blinkAnimation=null,motionEnabled=!reducedMotion.matches;
const motionButton=document.querySelector('#motion');
function renderMotion(){motionButton.setAttribute('aria-pressed',String(motionEnabled));const label=language==='en'?(motionEnabled?'Pause blinking':'Enable blinking'):(motionEnabled?'Pausar pestañeo':'Activar pestañeo');motionButton.setAttribute('aria-label',label);motionButton.title=label;document.body.dataset.motion=motionEnabled?'on':'off';}
renderMotion();
motionButton.addEventListener('click',()=>{motionEnabled=!motionEnabled;renderMotion();scheduleBlink(1200);});
document.querySelector('#language').addEventListener('click',renderMotion);
function cancelBlink(){clearTimeout(blinkTimer);blinkTimer=null;if(blinkAnimation){blinkAnimation.cancel();blinkAnimation=null;}}
function scheduleBlink(delay=11000+Math.random()*7000){
 cancelBlink();
 if(!portraitVisible||document.hidden||dialog.open||!motionEnabled)return;
 blinkTimer=setTimeout(()=>{
  if(!portraitVisible||document.hidden||dialog.open||!motionEnabled)return;
  // A quicker closure and a longer, eased reopening give the gaze a quiet rhythm.
  blinkAnimation=eyelids.animate([
   {opacity:0,offset:0,easing:'cubic-bezier(.4,0,.8,1)'},
   {opacity:1,offset:.30,easing:'linear'},
   {opacity:1,offset:.38,easing:'cubic-bezier(.2,0,.2,1)'},
   {opacity:0,offset:1}
  ],{duration:600,easing:'linear'});
  portrait.dataset.blinks=String(Number(portrait.dataset.blinks||0)+1);
  blinkAnimation.finished.then(()=>{blinkAnimation=null;scheduleBlink();}).catch(()=>{});
 },delay);
}
new IntersectionObserver(entries=>{portraitVisible=entries[0].isIntersecting;if(portraitVisible)scheduleBlink(2800);else cancelBlink();},{threshold:.45}).observe(portrait);
reducedMotion.addEventListener('change',()=>{motionEnabled=!reducedMotion.matches;renderMotion();scheduleBlink();});
document.addEventListener('visibilitychange',()=>scheduleBlink());
dialog.addEventListener('close',()=>scheduleBlink(5000));
new MutationObserver(()=>{if(dialog.open)cancelBlink();}).observe(dialog,{attributes:true,attributeFilter:['open']});
