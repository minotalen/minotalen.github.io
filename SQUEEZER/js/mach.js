/* ==================================================================
   mach.js — the live machinations view (mach.html only, body.mach).
   The page plays the SIM'S BRAIN on a fresh state (mach.html stubs
   load/save/flush/cloud/telemetry before main.js boots) and compiles
   the rolling balance into a machinations-style economy graph.

   No game file is edited. Every hook is a wrapper around a global the
   game already publishes:
     logAct      the one settled-action funnel  → tokens, rates, log
     deflect     WARD / SLIPPED saves          → ward tokens
     buyCard     deck purchases                → score→cards→deck chain
     syncWide    the desktop wide lanes        → inert here
     bank        capture avgN/avgRisk/avgChain for the buyer's factors

   The brain (ported from sim.js, player v6): archetype risk line +
   HAND_CAP 8 with hunt policies; the competing-EV buyer (upgrades by
   factor/cost with the 1.35 boost, stickers by estPay·likeOf/cost,
   save-up ledger 2.2×/180s, first-sticker latch, needs-must pooling);
   the card lane (0.6/beat, first incomplete value); auto-claimed
   goals; hunts with stall/rotate blacklists; goal-driven ascend
   (banked ≥ req·(want/3)², want = the next META row clamped 3..10).
   Trick tactics stay the game's own autoPlay policy — the same lines
   the sim's tacticTick mirrors. Split is skipped: the model is one
   table.

   Performance laws: one canvas, flat shapes, no shadowBlur; the rAF
   loop stops when no tokens fly and nothing is dirty; the poll diffs
   state and only then marks dirty; dt is clamped FIRST; particles
   capped; hidden tabs render nothing.
   ================================================================== */
(function(){
'use strict';
if(!document.body.classList.contains('mach'))return;

/* ---------- small helpers ---------- */
const mk=(tag,cls,parent)=>{const e=document.createElement(tag);
  if(cls)e.className=cls;if(parent)parent.appendChild(e);return e;};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pn=()=>performance.now();

/* ==================================================================
   1 · page frame — three panels join the body grid; the wide lanes
   are switched off (this page owns its own two columns)
   ================================================================== */
try{
  if(typeof syncWide==='function'){
    const _sw=syncWide;syncWide=function(){};
    if(typeof WIDE_Q!=='undefined'&&WIDE_Q&&WIDE_Q.removeEventListener)
      WIDE_Q.removeEventListener('change',_sw);
  }
}catch(e){}

const top=mk('div','',document.body);top.id='machTop';
top.innerHTML=
  '<div id="machBar"><div class="mt">LIVE ECONOMY</div>'+
  '<div class="mrate" id="mRate">watching the balance</div>'+
  '<div class="mrate" id="mHunt"></div>'+
  '<div class="mrate" id="mWant"></div><div class="msp"></div>'+
  '<div class="mspd" id="mSpd"><button data-s="1" class="on">1\u00d7</button>'+
  '<button data-s="2">2\u00d7</button><button data-s="4">4\u00d7</button>'+
  '<button data-s="8">8\u00d7</button></div>'+
  '<button class="maut on" id="mRun" title="run / halt the sim brain">RUN</button>'+
  '<button class="maut" id="mBrain" title="cycle the archetype: risk line, boosts, sticker tastes"></button></div>'+
  '<canvas id="machCv"></canvas>';

const bot=mk('div','',document.body);bot.id='machBot';
bot.innerHTML=
  '<div id="mChart"><div class="cht"><span class="mt2" id="mChartT"></span>'+
  '<span class="msp"></span><button id="mChartX" title="close">\u2715</button></div>'+
  '<canvas id="mChartCv"></canvas></div>'+
  '<div id="mBotGrid">'+
  '<div id="mStageWrap"><div id="mStage"></div><div id="mCap">dealing\u2026</div></div>'+
  '<div id="mSide">'+
  '<div class="mh">LAST 10 HANDS \u00b7 OLDEST LEFT</div><div class="a10" id="mRes"></div>'+
  '<div class="mh">GOALS</div><div id="mGoals"></div></div></div>';

const log=mk('div','',document.body);log.id='machLog';
log.innerHTML=
  '<div class="lhead"><div class="mt">PURCHASE + UNLOCK</div>'+
  '<div class="lsub" id="mLogSub"></div></div>'+
  '<div class="lbody" id="mLogBody"></div>';

/* the title screen, the coach and the cold-boot hold belong to
   interactive play: a monitor warms up on its own */
try{
  const f=document.getElementById('felt');if(f)f.classList.remove('ttl');
  if(typeof tutPaint==='function')tutPaint();
  coldBoot=false;lastAct=pn();
  setInterval(()=>{lastAct=pn();},5000);
}catch(e){}

/* ==================================================================
   2 · the feed — rolling windows + the mirrors the wrappers need to
   name what just changed
   ================================================================== */
const T0=Date.now();
const W={inc:[],draw:[],bust:[],upg:[],stk:[],card:[]};
let SPD=1,machDirty=true;
let handMirror=[],upMirror={},metaMirror={};
const handIds=()=>{const o=[];for(const h of S.hands)for(const id of h.ids)o.push(id);return o;};
const fh=()=>S.hands[S.focus]||S.hands[0];
const wardsN=()=>{const r=fh().run;return (r&&r.grace||0)+(r&&r.cullWard||0);};
const awayN=()=>S.out.length+(S.disc?S.disc.length:0)+(S.gone?S.gone.length:0);
const fsum=()=>fh().ids.reduce((a,id)=>a+cval(byId(id)),0);
const rateWin=(win,min)=>{const c=Date.now()-min*60000;let s=0,n=0;
  while(win.length&&win[0].t<c)win.shift();
  for(const e of win){s+=e.n;n++;}return {sum:s,n:n};};

function logRow(cls,tag,name,cost,bal,m){
  const b=document.getElementById('mLogBody');
  const r=mk('div','plrow '+cls,b);r.style.opacity='0';
  if(m)r.dataset.m=m;
  const s=Math.floor((Date.now()-T0)/1000);
  mk('span','plt',r).textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  mk('span','plk',r).textContent=tag;
  const n=mk('span','pln',r);typeof name==='string'?n.textContent=name:n.appendChild(name);
  if(cost!=null)mk('span','plc',r).textContent=(cost<0?'\u2212':'+')+fmt(Math.abs(cost));
  if(bal!=null){const pb=mk('span','plb',r);pb.textContent=fmt(bal);pb.dataset.m='score';}
  b.prepend(r);
  while(b.children.length>80)b.lastChild.remove();
  requestAnimationFrame(()=>{r.style.transition='opacity .25s';r.style.opacity='1';});
  document.getElementById('mLogSub').textContent=b.children.length+' entries';
}
/* the automation sheet's last-10 strip: cells built once, each beat
   only moves fills + labels (a rebuild would restart the ease) */
function buildA10(){
  const box=document.getElementById('mRes');box.textContent='';
  for(let i=0;i<10;i++){
    const c=mk('span','c',box);c.dataset.m='score';c.title='chart the score';
    const i2=mk('i','',c);
    mk('b','',i2);mk('s','',i2);mk('em','',c);}
}
let a10sig='';
function paintA10(){
  const last=(S.st.handLog||[]).slice(-10);
  const sig=last.map(e=>[e.b,e.s,e.v,e.r,e.a].join('|')).join(';');
  if(sig===a10sig)return;a10sig=sig;
  const cols=document.getElementById('mRes').children;
  const off=10-last.length,max=Math.max(1,...last.map(e=>e.v!=null?e.v:e.s));
  for(let i=0;i<10;i++){
    const col=cols[i];if(!col)continue;
    const el=col.querySelector('i'),em=col.querySelector('em'),e=last[i-off];
    if(!e){el.className='';el.removeAttribute('title');em.textContent='';
      el.querySelector('b').style.height='0%';continue;}
    const val=e.v!=null?e.v:e.s;
    el.className=(e.b?'p':'f')+(e.a?' a':'');
    el.title=(e.b?'BANK ':'BUST ')+fmt(Math.max(0,val))+' @ '+e.r+'%';
    el.querySelector('b').style.height=Math.max(8,Math.round(val/max*100))+'%';
    em.textContent=fmt(Math.max(0,val));}
}

/* ==================================================================
   3 · the hooks — wrappers over the game's own globals
   ================================================================== */
const _logAct=typeof logAct==='function'?logAct:null;
if(_logAct)logAct=function(a,n,o){
  _logAct(a,n,o);
  try{machAct(a,n,o);}catch(e){}
};

function spawnCardPanel(c,bust){
  const st=document.getElementById('mStage'),cap=document.getElementById('mCap');
  st.classList.toggle('bust',!!bust);
  const old=st.querySelector('.card');if(old)old.remove();
  const src=els[c.id];
  if(src){
    const cl=src.cloneNode(true);
    cl.classList.remove('pop','flat','buried','grisk');cl.classList.add('faceup');
    cl.style.transform='';cl.style.transition='none';cl.style.zIndex='';
    st.appendChild(cl);
  }
  const bits=['<b>'+c.v+'</b>'];
  if(c.stk&&STK[c.stk])bits.push('<span class="cstk">'+STK[c.stk].n+'</span>');
  if(Array.isArray(c.cond))c.cond.forEach(k=>{if(COND[k])bits.push('<span class="ccnd">'+COND[k].n+'</span>');});
  if(c.shy)bits.push('<span class="cstk">shiny</span>');
  if(c.dud)bits.push('dud');
  if(c.boom3)bits.push('<b>triple</b>');
  cap.innerHTML=bits.join(' \u00b7 ');
}

function machAct(a,n){
  /* draws: the newly seated card is the diff against the mirror */
  if(a==='draw'){
    const cur=handIds();
    const fresh=cur.filter(id=>handMirror.indexOf(id)<0);
    handMirror=cur;
    if(SPD>1&&cdEnd>pn())cdEnd=pn()+(cdEnd-pn())/SPD;   /* the speedup: the deck cools faster */
    W.draw.push({t:Date.now(),n:1});
    tok('eDraw',1,'#5A5642',{r:4.5});
    if(fresh.length){
      const c=byId(fresh[fresh.length-1]);
      if(c)spawnCardPanel(c);
    }
    machDirty=true;return;
  }
  if(a==='bank'){
    const g=Math.max(1,Math.round(Math.log10(Math.max(1,n))));
    tok('eBank',clamp(g,1,6),'#2C563C',{sp:2.1});
    tok('eGhost',1,'#8A6A2F',{sp:1.4,r:3});
    N.score.p=1;W.inc.push({t:Date.now(),n:Math.max(0,n)});
    machDirty=true;return;
  }
  if(a==='bust'){
    const hl=S.st.handLog||[],last=hl[hl.length-1]||{};
    tok('eBust',3,'#8E2B1C',{sp:1.7,r:4.5});E.eBust.fl=1;
    if(bustPair&&bustPair[0]&&byId(bustPair[0]))spawnCardPanel(byId(bustPair[0]),true);
    W.bust.push({t:Date.now(),n:1});
    if(n>0)W.inc.push({t:Date.now(),n});
    setTimeout(()=>{tok('eCyc',2,'#8A8471',{sp:1.3,r:3.5});E.eCyc.fl=1;machDirty=true;},1000);
    machDirty=true;return;
  }
  if(a==='res'){N.score.p=1;W.inc.push({t:Date.now(),n:Math.max(0,n)});machDirty=true;return;}
  if(a==='flt'||a==='bal'){W.inc.push({t:Date.now(),n:Math.max(0,n)});
    tok('eBank',1,'#2C563C',{sp:2.1});machDirty=true;return;}
  if(a==='upg'){
    let id=null;for(const k in S.up)if(S.up[k]!==(upMirror[k]||0))id=k;
    upMirror=Object.assign({},S.up);
    W.upg.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eUp',1,'#2A4761',{sp:2});E.eUp.fl=1;
    const u=id&&UPG[id];
    const nm=document.createDocumentFragment();
    nm.append(document.createTextNode(u?u.n:'Upgrade'));
    if(id)mk('small','',nm).textContent=' L'+L(id);
    logRow('upg','UPG',nm,n,S.score,'upg');machDirty=true;return;
  }
  if(a==='meta'){
    let id=null;for(const k in S.meta)if(S.meta[k]!==(metaMirror[k]||0))id=k;
    metaMirror=Object.assign({},S.meta);
    tok('eUp',1,'#7A4A8A',{sp:2});E.eUp.fl=.6;
    const m=id&&META[id];
    const nm=document.createDocumentFragment();
    nm.append(document.createTextNode(m?m.n:'Shard upgrade'));
    if(id)mk('small','',nm).textContent=' L'+M(id)+' \u00b7 shards';
    logRow('meta','META',nm,n,null,'shards');machDirty=true;return;
  }
  if(a==='stk'){
    W.stk.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eStk',1,'#8A6A2F',{sp:2});E.eStk.fl=1;
    queueMicrotask(()=>{
      const p=S.pick,k=p&&p.k,sk=k&&STK[k];
      const nm=document.createDocumentFragment();
      nm.append(document.createTextNode(sk?sk.n:'Sticker'));
      if(p&&p.shy)mk('small','',nm).textContent=' shiny';
      logRow('stk','STK',nm,n,S.score,'stk');});
    machDirty=true;return;
  }
  if(a==='rr'){W.stk.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eStk',1,'#8A6A2F',{sp:2});
    logRow('stk','SHOP','Restock now',n,S.score,'stk');machDirty=true;return;}
  if(a==='db'){W.stk.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eStk',1,'#8A6A2F',{sp:2});
    logRow('stk','STRIP','De-bolt',n,S.score,'stk');machDirty=true;return;}
  if(a==='asc'){
    toks.length=0;
    N.banked.p=1;
    const nm=document.createDocumentFragment();
    nm.append(document.createTextNode('Ascension'));
    mk('small','',nm).textContent=' +'+fmt(n||0)+' shards';
    logRow('asc','ASC',nm,n,null,'banked');
    machDirty=true;return;
  }
}

/* saves: WARD / SLIPPED deflects feed the ward pool */
const _deflect=typeof deflect==='function'?deflect:null;
if(_deflect)deflect=function(id,label,disc){
  try{
    tok('eWard',1,'#2A4761',{sp:2.2,r:4});N.wards.p=1;
    machDirty=true;
  }catch(e){}
  return _deflect(id,label,disc);
};

/* unlock watch: goal claims land UNL rows the moment they clear */
const _claimAch=typeof claimAch==='function'?claimAch:null;
if(_claimAch)claimAch=function(id){
  const had=has(id);
  const r=_claimAch(id);
  try{
    if(!had&&has(id)){
      const a=ACH.find(x=>x.id===id);
      const nm=document.createDocumentFragment();
      nm.append(document.createTextNode(a?a.n:id));
      const w=rewardTx(a);
      if(w)mk('small','',nm).textContent=' '+w;
      logRow('unl','UNL',nm,null,null);
    }
  }catch(e){}
  return r;
};

/* deck buys: score → BUY CARD → deck (a two-hop token chain) */
const _buyCard=typeof buyCard==='function'?buyCard:null;
if(_buyCard)buyCard=function(v){
  const s0=S.score,c0=S.cards.length;
  const r=_buyCard(v);
  try{
    if(S.cards.length>c0){
      const cost=s0-S.score;
      W.card.push({t:Date.now(),n:Math.abs(cost)});
      tok('eCard',1,'#5A5642',{sp:1.6,r:4.5,next:'eCard2'});E.eCard.fl=1;
      const nm=document.createDocumentFragment();
      nm.append(document.createTextNode('A '+v+' joins the deck'));
      mk('small','',nm).textContent=' #'+ownedOf(v);
      logRow('card','CARD',nm,cost,S.score,'deck');
      machDirty=true;
    }
  }catch(e){}
  return r;
};

/* banks feed the buyer's rolling factors (the sim's avgN/avgRisk/avgChain) */
const _bank=typeof bank==='function'?bank:null;
if(_bank)bank=function(h,auto){
  const N=h.ids.length,r=threat(h),c=h.chain;
  const r2=_bank(h,auto);
  try{
    BRAIN.avgN=BRAIN.avgN*.9+N*.1;
    BRAIN.avgRisk=BRAIN.avgRisk*.9+r*.1;
    BRAIN.avgChain=BRAIN.avgChain*.9+Math.min(c,2+BRAIN.archLine()*4)*.1;
  }catch(e){}
  return r2;
};

/* ==================================================================
   4 · header controls — speedup, run/halt, the archetype dial
   ================================================================== */
document.getElementById('mSpd').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const s=+b.dataset.s;
  if(SPD!==s&&cdEnd>pn())cdEnd=pn()+(cdEnd-pn())*SPD/s;
  SPD=s;
  document.querySelectorAll('#mSpd button').forEach(x=>x.classList.toggle('on',x===b));
});
const mRun=document.getElementById('mRun');
mRun.addEventListener('click',()=>{
  BRAIN.on=!BRAIN.on;
  mRun.classList.toggle('on',BRAIN.on);
  mRun.textContent=BRAIN.on?'RUN':'HALT';
});
const mBrain=document.getElementById('mBrain');
mBrain.addEventListener('click',()=>{
  BRAIN.arch=(BRAIN.arch+1)%ARCH_KEYS.length;
  BRAIN.hunt=null;BRAIN.black.clear();
  mBrain.textContent='BRAIN: '+A_of().n.toUpperCase();
  machDirty=true;
});

/* ==================================================================
   5 · goals — ready-to-claim first, then the closest four
   ================================================================== */
function rewardTx(a){
  if(a.stk&&STK[a.stk])return '\u2192 '+STK[a.stk].n;
  if(a.up&&UPG[a.up])return '\u2192 '+UPG[a.up].n+(a.lv>1?' L'+a.lv:'');
  if(a.meta&&META[a.meta])return '\u2192 '+META[a.meta].n+(a.lv>1?' L'+a.lv:'');
  if(a.s)return '+'+Math.round(a.s*100)+'% shards';
  if(a.v)return '+'+Math.round(a.v*100)+'% value';
  return '';
}
function renderGoals(){
  const box=document.getElementById('mGoals');box.textContent='';
  const ready=(S.ready||[]).filter(id=>{
    const a=ACH.find(x=>x.id===id);
    return a&&!has(id)&&!(a.stk&&STK_OFF[a.stk]);});
  for(const id of ready){
    const a=ACH.find(x=>x.id===id);
    const r=mk('div','grow ready',box);
    mk('span','gn',r).textContent=a.n;
    mk('span','gp',r).textContent='CLAIM';
    mk('span','grr',r).textContent=rewardTx(a);
    r.onclick=()=>{try{claimAch(id);}catch(e){}};
  }
  const prog=[];
  for(const a of ACH){
    if(has(a.id)||(S.ready||[]).indexOf(a.id)>=0)continue;
    if(a.stk&&STK_OFF[a.stk])continue;
    let c=0;try{c=a.g()||0;}catch(e){}
    const p=a.t?clamp(c/a.t,0,1):0;
    if(p>0)prog.push({a,p});
  }
  prog.sort((x,y)=>y.p-x.p);
  for(const q of prog.slice(0,4)){
    const r=mk('div','grow',box);
    mk('span','gn',r).textContent=q.a.n;
    const b=mk('span','gbar',r);const f=mk('i','',b);
    f.style.width=(q.p*100).toFixed(1)+'%';
    mk('span','gp',r).textContent=Math.floor(q.p*100)+'%';
    mk('span','grr',r).textContent=rewardTx(q.a);
  }
  if(!ready.length&&!prog.length)
    mk('div','gdone',box).textContent='every goal claimed';
}

/* ==================================================================
   6 · the graph — one canvas, machinations idiom: pools with fill
   rings, converters, dashed state chips, tokens riding beziers
   ================================================================== */
const cv=document.getElementById('machCv'),ctx=cv.getContext('2d');
const DW=1000,DH=580;
const INK='#46422F',INK3='#8A8471',PAPER='rgba(228,223,209,.88)';

const N={
  deck:  {x:150,y:150,r:46,label:'DECK',col:'#5A5642'},
  wards: {x:430,y:115,r:27,label:'WARDS',col:'#2A4761'},
  hand:  {x:430,y:300,r:54,label:'ON TABLE',col:'#5A5642'},
  away:  {x:255,y:462,r:40,label:'AWAY',col:'#8E2B1C'},
  score: {x:840,y:300,r:60,label:'SCORE',col:'#2C563C',money:true},
  banked:{x:840,y:495,r:33,label:'BANKED',col:'#8A6A2F',money:true},
  upg:   {x:688,y:88,w:108,h:44,label:'UPGRADES',col:'#2A4761'},
  shop:  {x:938,y:88,w:108,h:44,label:'STICKERS',col:'#8A6A2F'},
  cards: {x:72,y:470,w:112,h:44,label:'BUY CARD',col:'#5A5642'},
  risk:  {x:252,y:298,w:96,h:26,label:'RISK',chip:true},
  chain: {x:630,y:178,w:104,h:26,label:'CHAIN',chip:true},
};
const E={
  eDraw:{seg:[[196,176],[280,190],[330,235],[380,270]],col:'#5A5642',lab:[.48,0,-15]},
  eBank:{seg:[[486,282],[590,268],[690,272],[776,292]],col:'#2C563C',lab:[.5,0,-15]},
  eBust:{seg:[[386,338],[352,388],[322,412],[290,430]],col:'#8E2B1C',lab:[.5,20,8]},
  eCyc: {seg:[[213,438],[150,370],[148,270],[158,204]],col:'#8A8471',lab:[.42,-18,0]},
  eUp:  {seg:[[796,248],[772,196],[752,158],[736,120]],col:'#2A4761',lab:[.5,17,0]},
  eStk: {seg:[[876,250],[906,196],[922,158],[934,120]],col:'#8A6A2F',lab:[.52,19,0]},
  eCard:{seg:[[798,356],[600,556],[330,542],[128,474]],col:'#5A5642',lab:[.52,0,-14]},
  eCard2:{seg:[[72,448],[80,330],[110,240],[132,196]],col:'#5A5642',lab:null},
  eWard:{seg:[[430,146],[430,182],[430,216],[430,242]],col:'#2A4761',lab:null,dash:true},
  eGhost:{seg:[[640,286],[710,370],[780,430],[818,470]],col:'#8A6A2F',lab:null,ghost:true},
};
/* state-connection dashes: chip → edge midpoint */
const DASHES=[['risk','eBust'],['chain','eBank']];
function bpt(s,t){const u=1-t;
  return [u*u*u*s[0][0]+3*u*u*t*s[1][0]+3*u*t*t*s[2][0]+t*t*t*s[3][0],
          u*u*u*s[0][1]+3*u*u*t*s[1][1]+3*u*t*t*s[2][1]+t*t*t*s[3][1]];}
function btan(s,t){const u=1-t;
  return [3*u*u*(s[1][0]-s[0][0])+6*u*t*(s[2][0]-s[1][0])+3*t*t*(s[3][0]-s[2][0]),
          3*u*u*(s[1][1]-s[0][1])+6*u*t*(s[2][1]-s[1][1])+3*t*t*(s[3][1]-s[2][1])];}

/* tokens */
const toks=[],TOKMAX=90;
function tok(e,count,col,opt){
  const o=opt||{};
  for(let i=0;i<count;i++){
    if(toks.length>=TOKMAX)toks.shift();
    toks.push({e,t:-(i*.07),sp:o.sp||1.7,col:o.col||col,r:o.r||4,next:o.next||null});
  }
}

/* per-frame read of the live state into labels + ring fractions.
   Defaults keep draw() safe if a frame fires before the first read */
const R={deckN:0,deckMax:1,handN:0,handCap:8,fsum:0,tables:1,wards:0,away:0,
  chain:0,risk:0,prem:1,cmul:1,upL:0,tier:1,next:0,
  incMin:0,drawMin:0,bustMin:0,upMin:0,stkMin:0,cardMin:0,req:1};
function readState(){
  const h=fh();
  R.deckN=S.deck.length;R.deckMax=Math.max(1,S.cards.length);
  R.handN=handIds().length;
  R.handCap=Math.max(8,(L('auto')||1)*S.hands.length);
  R.fsum=fsum();R.tables=S.hands.length;
  R.wards=wardsN();
  R.away=awayN();
  R.chain=h?h.chain:0;
  R.risk=h?Math.round(threat(h)*100):0;
  R.prem=h?riskPrem(h):1;
  R.cmul=h?chainMul(h):1;
  R.upL=Object.values(S.up).reduce((a,b)=>a+b,0);
  R.tier=tierOf();
  R.next=cheapestCard();
  const inc=rateWin(W.inc,2),dr=rateWin(W.draw,2),bu=rateWin(W.bust,2);
  R.incMin=inc.sum;R.drawMin=dr.n;R.bustMin=bu.n;
  R.upMin=rateWin(W.upg,2).sum;R.stkMin=rateWin(W.stk,2).sum;R.cardMin=rateWin(W.card,2).sum;
  R.req=ascReq();
  document.getElementById('mRate').innerHTML=
    (R.incMin>0?'\u25b2 <span class="mn" data-m="incmin">+'+fmt(R.incMin)+'/min</span>  \u00b7  ':'idle \u00b7 ')+
    '<span class="mn" data-m="drawmin">'+R.drawMin+' draws/min</span> \u00b7 '+
    '<span class="mn" data-m="bustmin">'+R.bustMin+' busts/min</span> \u00b7 '+
    '<span class="mn" data-m="prem">x'+R.prem.toFixed(2)+' prem</span>';
  document.getElementById('mHunt').textContent=
    BRAIN.hunt?'hunting '+BRAIN.hunt.g.n+(BRAIN.on?'':' \u00b7 halted'):(BRAIN.on?'':'halted');
  const w=BRAIN.want;
  document.getElementById('mWant').textContent=!w?'':
    (w.latched?'saving \u00b7 ':'')+
    (w.aff?'next: '+w.aff+' \u2212'+fmt(w.ac)
         :(w.best?'want: '+w.best+' \u2212'+fmt(w.bc):'shelf empty \u00b7 rows gated'));
}

/* the eased money displays: the pools roll toward the real balance */
let dScore=0,dBanked=0;

let raf=0,lastT=0;
function frame(t){
  raf=0;
  const dt=Math.min(.05,lastT?(t-lastT)/1000:.016);lastT=t;
  let live=toks.length>0;
  const e=Math.min(1,dt*7);
  if(Math.abs(dScore-S.score)>.5){dScore+=(S.score-dScore)*e;machDirty=true;}
  else dScore=S.score;
  if(Math.abs(dBanked-S.banked)>.5){dBanked+=(S.banked-dBanked)*e;machDirty=true;}
  else dBanked=S.banked;
  for(let i=toks.length-1;i>=0;i--){
    const k=toks[i];k.t+=dt*k.sp;
    if(k.t>=1){
      if(k.next)tok(k.next,1,k.col,{r:k.r,sp:k.sp});
      toks.splice(i,1);
    }
  }
  live=live||toks.length>0;
  let dec=false;
  for(const ek in E){const ed=E[ek];if(ed.fl>0){ed.fl=Math.max(0,ed.fl-dt*1.8);dec=true;}}
  for(const nk in N){const nd=N[nk];if(nd.p>0){nd.p=Math.max(0,nd.p-dt*2.2);dec=true;}}
  if(machDirty||live||dec){draw();machDirty=false;}
  if(live||dec)raf=requestAnimationFrame(frame);
}
function kick(){if(!raf)raf=requestAnimationFrame(frame);}

function fit(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const w=cv.clientWidth,h=cv.clientHeight;
  if(!w||!h)return;
  const W1=Math.round(w*dpr),H1=Math.round(h*dpr);
  if(cv.width!==W1||cv.height!==H1){cv.width=W1;cv.height=H1;}
  cv._dpr=dpr;
}
function rr2(x,y,w,h,r){ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function txt(s,x,y,font,col,align,base){
  ctx.font=font;ctx.fillStyle=col;ctx.textAlign=align||'center';
  ctx.textBaseline=base||'middle';ctx.fillText(s,x,y);}
function haloTxt(s,x,y,font,col){
  ctx.font=font;const w=ctx.measureText(s).width;
  ctx.fillStyle=PAPER;ctx.fillRect(x-w/2-4,y-8,w+8,16);
  txt(s,x,y,font,col);}
function edge(k){
  const ed=E[k],fl=ed.fl||0;
  ctx.setLineDash(ed.dash?[4,4]:ed.ghost?[2,5]:[]);
  ctx.globalAlpha=ed.ghost?.5:.85;
  ctx.strokeStyle=ed.col;ctx.lineWidth=1.6+fl*1.8;
  const s=ed.seg;ctx.beginPath();ctx.moveTo(s[0][0],s[0][1]);
  ctx.bezierCurveTo(s[1][0],s[1][1],s[2][0],s[2][1],s[3][0],s[3][1]);ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=1;
  if(!ed.dash&&!ed.ghost){
    const p=bpt(s,.9),tn=btan(s,.9),l=Math.hypot(tn[0],tn[1])||1;
    const ux=tn[0]/l,uy=tn[1]/l;
    ctx.beginPath();
    ctx.moveTo(p[0]+ux*7,p[1]+uy*7);
    ctx.lineTo(p[0]-ux*3-uy*3.4,p[1]-uy*3+ux*3.4);
    ctx.lineTo(p[0]-ux*3+uy*3.4,p[1]-uy*3-ux*3.4);
    ctx.closePath();ctx.fillStyle=ed.col;ctx.fill();
  }
  if(ed.lab&&ed.col){
    const p=bpt(s,ed.lab[0]);
    ed._lp=[p[0]+ed.lab[1],p[1]+ed.lab[2]];
    haloTxt(ed.text||'',ed._lp[0],ed._lp[1],
      '700 9.5px "Orbit",system-ui,sans-serif',ed.col);
  }
}
function pool(k,text,sub,frac){
  const n=N[k],p=n.p||0,r=n.r*(1+.05*p);
  ctx.beginPath();ctx.arc(n.x,n.y,r,0,7);
  ctx.fillStyle='#F7F3E7';ctx.fill();
  ctx.lineWidth=1.5;ctx.strokeStyle=INK3;ctx.stroke();
  if(frac>0){
    ctx.beginPath();ctx.arc(n.x,n.y,r-3.5,-Math.PI/2,-Math.PI/2+clamp(frac,0,1)*6.2832);
    ctx.lineWidth=4.5;ctx.strokeStyle=n.col;ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt';
  }
  if(p>0){ctx.beginPath();ctx.arc(n.x,n.y,r+3,0,7);
    ctx.lineWidth=2;ctx.globalAlpha=p*.6;ctx.strokeStyle=n.col;ctx.stroke();ctx.globalAlpha=1;}
  txt(text,n.x,n.y,'800 '+(n.r>50?19:n.r>38?15:12)+'px "Orbit",system-ui,sans-serif',INK);
  txt(n.label,n.x,n.y-r-12,'800 9px "Orbit",system-ui,sans-serif',INK3);
  if(sub)txt(sub,n.x,n.y+r+13,'400 9.5px "Orbit",system-ui,sans-serif',INK3);
}
function conv(k,sub){
  const n=N[k],w=n.w,h=n.h*(1+.08*(n.p||0));
  rr2(n.x-w/2,n.y-h/2,w,h,9);
  ctx.fillStyle='#EFEAD9';ctx.fill();
  ctx.lineWidth=1.5;ctx.strokeStyle=INK;ctx.stroke();
  ctx.beginPath();ctx.arc(n.x-w/2+16,n.y,7.5,0,7);
  ctx.strokeStyle=INK;ctx.lineWidth=1.4;ctx.stroke();
  ctx.beginPath();ctx.moveTo(n.x-w/2+12.5,n.y);ctx.lineTo(n.x-w/2+20,n.y);
  ctx.moveTo(n.x-w/2+17,n.y-3);ctx.lineTo(n.x-w/2+20,n.y);ctx.lineTo(n.x-w/2+17,n.y+3);
  ctx.lineWidth=1.4;ctx.stroke();
  txt(n.label,n.x+7,n.y,'800 9px "Orbit",system-ui,sans-serif',INK);
  if(sub)txt(sub,n.x,n.y+h/2+12,'400 9.5px "Orbit",system-ui,sans-serif',INK3);
}
function chipN(k,text){
  const n=N[k],w=n.w,h=n.h;
  ctx.setLineDash([3,3]);
  rr2(n.x-w/2,n.y-h/2,w,h,12);
  ctx.fillStyle=PAPER;ctx.fill();
  ctx.strokeStyle='rgba(142,43,28,.65)';ctx.lineWidth=1.3;ctx.stroke();
  ctx.setLineDash([]);
  txt(text,n.x,n.y+.5,'700 10px "Orbit",system-ui,sans-serif','#8E2B1C');
}
function draw(){
  fit();
  const dpr=cv._dpr||1,w=cv.width/dpr,h=cv.height/dpr;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  const s=Math.min(w/DW,h/DH),ox=(w-DW*s)/2,oy=(h-DH*s)/2;
  cv._view={s,ox,oy};
  ctx.setTransform(dpr*s,0,0,dpr*s,ox*dpr,oy*dpr);
  E.eDraw.text=R.drawMin+'/min';
  E.eBank.text='+'+fmt(R.incMin)+'/min';
  E.eBust.text=R.bustMin+'/min';
  E.eUp.text=fmt(R.upMin);
  E.eStk.text=fmt(R.stkMin);
  E.eCard.text=fmt(R.cardMin);
  for(const k in E)if(!E[k].ghost)edge(k);
  ctx.globalAlpha=.65;
  for(const dk of DASHES){
    const n=N[dk[0]],p=bpt(E[dk[1]].seg,.5);
    ctx.setLineDash([3,3]);ctx.strokeStyle='#8E2B1C';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(n.x,n.y+h2(n));ctx.lineTo(p[0],p[1]);ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha=1;
  for(const k of toks){
    if(k.t<0)continue;
    const p=bpt(E[k.e].seg,Math.min(1,k.t));
    ctx.beginPath();ctx.arc(p[0],p[1],k.r,0,7);
    ctx.fillStyle=k.col;ctx.fill();
    ctx.lineWidth=1;ctx.strokeStyle='rgba(21,20,14,.35)';ctx.stroke();
  }
  pool('deck',String(R.deckN),R.deckN+' of '+R.deckMax,R.deckN/R.deckMax);
  pool('wards',String(R.wards),null,clamp(R.wards/5,0,1));
  pool('hand',String(R.handN),(R.tables>1?R.tables+'\u00d7 ':'')+'\u03a3 '+fmt(R.fsum),
    clamp(R.handN/R.handCap,0,1));
  pool('away',String(R.away),'out '+S.out.length+' \u00b7 disc '+(S.disc?S.disc.length:0),
    clamp(R.away/Math.max(1,R.deckMax),0,1));
  pool('score',fmt(dScore),R.incMin>0?'+'+fmt(R.incMin)+'/min':'income idle',0);
  pool('banked',fmt(dBanked),Math.floor(clamp(S.banked/Math.max(1,R.req),0,1)*100)+'% to ASC',
    clamp(S.banked/Math.max(1,R.req),0,1));
  conv('upg','L'+R.upL+' owned');
  conv('shop','tier '+R.tier+' stock');
  conv('cards','\u2212'+fmt(R.next));
  chipN('risk','RISK '+R.risk+'% \u00b7 \u00d7'+R.prem.toFixed(2));
  chipN('chain','CHAIN '+R.chain+' \u00b7 \u00d7'+R.cmul.toFixed(2));
  edge('eGhost');
}
function h2(n){return n.h?n.h/2:(n.r||0);}

/* resize + visibility + fonts */
if(typeof ResizeObserver==='function')
  new ResizeObserver(()=>{machDirty=true;kick();}).observe(cv);
else addEventListener('resize',()=>{machDirty=true;kick();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){machDirty=true;kick();}});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{machDirty=true;kick();});

/* ==================================================================
   7 · THE BRAIN — ported from sim.js, player v6. Plays the real game
   through its own actions: drawCard / bank / buyUpg / buyCard /
   buyStk + placeStk / claimAch / ascend. Trick tactics stay the
   game's autoPlay (the same gauge lines the sim's tacticTick mirrors).
   ================================================================== */
/* sticker identity: roles + the estPay fields, verbatim sim.js */
const STKD={
  gild:{role:'pay',mul:2.75}, haste:{role:'aura',aura:1},
  tribute:{role:'pay',add:7}, odds:{role:'pay',add:1.5},
  snip:{role:'disc'}, mint:{role:'pay',add:4},
  brass:{role:'table',add:'fn'}, surge:{role:'mult',aura:1},
  twin:{role:'pay',twinPull:1}, mirror:{role:'pay',addC:2.5},
  ward:{role:'ins',dodge:.15}, anchor:{role:'ins',dodge:.10},
  prime:{role:'pay',prime:2}, beacon:{role:'aura',aura:1},
  burn:{role:'disc'}, tell:{role:'trick',trick:1},
  cull:{role:'trick',trick:1}, dividend:{role:'gamble',frac:1,hits:1},
  tab:{role:'outpay',frac:1}, purify:{role:'ins',purify:1},
  echo:{role:'out',trick:1}, bloom:{role:'gamble',frac:1,hits:1},
  kindle:{role:'gamble',frac:1,hits:1}, jynx:{role:'table',frac:1},
  reverb:{role:'disc',dodge:.03}, siphon:{role:'ins',bustAdd:10},
  vanish:{role:'out'}, ledger:{role:'outpay',add:'fn'},
  rake:{role:'outpay',add:'fn'}, stakes:{role:'trick',trick:1},
  scrap:{role:'out',trick:1}, relic:{role:'jackpot',relic:1},
  purge:{role:'disc',purgeN:1}, encore:{role:'disc',swap:1},
  float:{role:'trick',trick:1}, defuse:{role:'out',trick:1},
  swap:{role:'rewrite',trick:1,addC:.2}, clip:{role:'rewrite',trick:1,dodge:.05},
  ghost:{role:'rewrite',trick:1}, patch:{role:'rewrite',trick:1,addC:1},
  variety:{role:'table',frac:1}, dredge:{role:'rewrite',trick:1},
  fetch:{role:'out',trick:1}, riffle:{role:'rewrite',trick:1,addC:3},
  bail:{role:'trick',trick:1}, draft:{role:'disc',trick:1},
  engrave:{role:'rewrite',trick:1}, fallout:{role:'out'},
  remnant:{role:'pay',add:1}, guardian:{role:'ins'},
  flinch:{role:'ins'}, offering:{role:'out',trick:1},
  recycle:{role:'out'}, sub:{role:'out',trick:1},
  exit:{role:'out'}, whip:{role:'disc',trick:1},
  strip:{role:'ins',dodge:.04}, squeeze:{role:'rewrite',trick:1,addC:3},
};
/* archetypes, verbatim */
const ARCH={
  climber:{n:'climber',line:.45,boost:['value','eye','mult','high','deep','over','speed'],
    like:{pay:3,mult:2.5,aura:2.5,jackpot:1.5,table:1.5},fams:null},
  devil:{n:'daredevil',line:.58,boost:['nerve','marked','grace','guard','salv','speed'],
    like:{ins:3,trick:2.5,gamble:2,pay:1.5},fams:['hot','deflect']},
  engineer:{n:'engineer',line:.45,boost:['sleight','marked','speed','value','eye'],
    like:{out:3,outpay:3,disc:2,trick:1.5,pay:1},fams:['out','disc']},
  keeper:{n:'chainkeeper',line:.34,boost:['chain','house','mult','value','iron','speed'],
    like:{mult:3,table:2.5,pay:1.5},fams:['chain','row']},
  hunter:{n:'hunter',line:.45,boost:['value','speed','eye'],like:{},huntAll:true},
};
const ARCH_KEYS=Object.keys(ARCH);
const FAM={
  hot:['hot60','hot70','hot80','hotBanks','bestRisk','bestBustRun','bigBustN'],
  deflect:['deflects','coldWards','wardLost'],
  out:['maxOut','outBanks','deepBanks','fleetBanks','outed','oneOut','pileBanks','bothPiles'],
  disc:['discarded','maxDisc','benchBanks','safeDisc'],
  chain:['bestChainN','bestChain','bestStreak'],
  row:['bestRow3','bestWide','bigHand','bestHandDraws','rainbows','oneTwoThree','spread','richBanks'],
};
const ROLE_X={draw:new Set(['ward','odds','draft','echo'])};
const NEED={
  hits:'gamble',outed:'out',maxOut:'out',outBanks:'out',deepBanks:'out',
  fleetBanks:'out',rewrites:'rewrite',bigRewrites:'rewrite',stkDraws:'draw',
  deflects:'ins',coldWards:'ins',discarded:'disc',maxDisc:'disc',oneOut:'out',
  pileBanks:'out',bothPiles:'out',benchBanks:'disc',safeDisc:'disc',wardLost:'ins',
};
/* hunt policies, verbatim */
const POLICY={
  bigHand:t=>({wide:t,cardFirst:1}), bestHandDraws:t=>({wide:t,cardFirst:1}),
  hot60:()=>({line:.63}), hot70:()=>({line:.73}), hot80:()=>({line:.83}),
  hotBanks:()=>({line:.58}), bestRisk:()=>({line:.93,wide:6}),
  bestBustRun:()=>({line:.7}), bestChainN:()=>({safe:1}),
  bestChain:()=>({safe:1,line:.5}), bestStreak:()=>({safe:1,wide:5,line:.55}),
  bestRow3:()=>({wide:3,safe:1}), bestSeven:()=>({comp:'seven'}),
  bestWide:t=>({wide:Math.max(5,t),safe:1}), rainbows:()=>({wide:7,cardFirst:1}),
  oneTwoThree:()=>({comp:'123'}), spread:()=>({comp:'spread'}),
  richBanks:()=>({comp:'rich3',wide:3}),
  maxOut:()=>({safe:1,role:'out'}), outBanks:()=>({safe:1,role:'out'}),
  deepBanks:()=>({safe:1,role:'out'}), fleetBanks:()=>({safe:1,role:'out'}),
  pileBanks:()=>({safe:1,role:'out',role2:'disc'}),
  benchBanks:()=>({role:'disc',safe:1}),
  bothPiles:()=>({safe:1,role:'out',role2:'disc'}), oneOut:()=>({role:'out'}),
  outed:()=>({role:'out',line:.5}), discarded:()=>({role:'disc'}),
  maxDisc:()=>({role:'disc',wide:8,safe:1}), arms:()=>({role:'trick'}),
  rewrites:()=>({role:'rewrite'}), bigRewrites:()=>({role:'rewrite'}),
  hits:()=>({role:'gamble',wide:6}), stkDraws:()=>({role:'draw'}),
  deflects:()=>({line:.6,role:'ins'}), coldWards:()=>({line:.12,role:'ins'}),
  twoStkBusts:()=>({bustPush:1}),
  inkBanks:()=>({wide:5,stickerFirst:1,role:'many'}),
  stkBanked:()=>({wide:4,stickerFirst:1,role:'many'}),
  bigStk:()=>({stickerFirst:1,wide:6,role:'many'}),
  placed:()=>({stickerFirst:1,role:'many'}),
  bestBank:()=>({wide:9,line:.6}), bestBust:()=>({wide:9,line:.8}),
  bigBustN:()=>({wide:12,cardFirst:1,line:1.1,bustLine:1.1}),
  safeDisc:()=>({role:'disc'}), wardLost:()=>({line:.6,role:'ins'}),
  bestFloat:()=>({wide:9,line:.75}), bestRisky:()=>({wide:12,line:.5,cardFirst:1}),
  draws:()=>({speedFirst:1}), banks:()=>({}), bigBanks:()=>({wide:3}),
  busts:()=>({}), aBusts:()=>({}), coldBusts:()=>({}),
  owned:()=>({cardFirst:1}), sets:()=>({cardFirst:1}),
};
const MODELED=new Set(['draws','banks','runs','busts','aBusts','bigHand','bestBank',
  'bestBust','bestChain','bestChainN','bestHandDraws','bestRisk','bestStreak','bigBanks',
  'spread','bestRow3','richBanks','rainbows','oneTwoThree','bestBustRun','hotBanks',
  'coldBusts','hot60','hot70','hot80','bestWide','arms','deflects','coldWards','rewrites',
  'bigRewrites','hits','stkDraws','maxOut','outBanks','deepBanks','fleetBanks','outed','discarded',
  'maxDisc','bothPiles','bestRisky','bigStk','inkBanks','pileBanks','benchBanks','oneOut','twoStkBusts',
  'stkBanked','bestFloat','placed','owned','sets','asc','bestSeven',
  'bigBustN','safeDisc','wardLost','fiveBanks','stkKinds','upMax','upSum',
  'bestPairs','bestStack']);
const ORDER=['value','speed','mult','nerve','chain','eye','marked','flick','salv',
  'sleight','over','high','house','grace','deep','iron','abank','auto','guard'];
/* the sim's shard-row priority, completed with any newer META rows */
const METAPRIO0=['prodigy','quick','head','rich','keeper','press','daring','trader',
  'storage','fortune','preprint','rebound','dreamer','silver','vantage','stall','union','rally'];
const METAPRIO=METAPRIO0.filter(k=>META[k])
  .concat(Object.keys(META).filter(k=>METAPRIO0.indexOf(k)<0));

/* goal bundle off the live ACH (same statOfSrc read sim.js uses) */
const statOfSrc=s=>{
  if(/ownedOf/.test(s))return 'sets';
  if(/S\.cards\.length/.test(s))return 'owned';
  if(/S\.asc/.test(s))return 'asc';
  if(/Math\.max[\s\S]*S\.up/.test(s))return 'upMax';
  if(/S\.up/.test(s))return 'upSum';
  const m=s.match(/S\.st\.(\w+)/);return m?m[1]:null;};
let GOALS=[];
try{GOALS=ACH.map(a=>({id:a.id,n:a.n,stk:a.stk||null,t:a.t,k:statOfSrc(String(a.g))}))
  .filter(g=>g.k&&MODELED.has(g.k));}catch(e){}

const BRAIN={arch:0,on:true,beat:0,cardClock:0,tSticker:null,goalClock:0,
  sv:{active:false,since:0,for:null},hunt:null,black:new Map(),
  avgN:3,avgRisk:.35,avgChain:2,
  archLine:()=>ARCH[ARCH_KEYS[BRAIN.arch]].line};
let needRoles=new Set();

const A_of=()=>ARCH[ARCH_KEYS[BRAIN.arch]];
const bustRate=()=>S.st.runs?S.st.busts/S.st.runs:.25;
const hotShare=()=>S.st.banks?S.st.hotBanks/S.st.banks:.2;
const outCount2=()=>S.out.length+(S.gone?S.gone.length:0);
const cyc=()=>BRAIN.avgN/Math.max(1,S.cards.length-outCount2());
const presence=()=>Math.min(1,2.5*cyc());
const rMulAt=(r,l)=>{const m=ECO.RISK_COEF+ECO.NERVE_PER*l+ECO.DARING_PER*M('daring');
  return r<=ECO.RISK_EVEN?ECO.RISK_FLOOR+r*(1-ECO.RISK_FLOOR)/ECO.RISK_EVEN*m
    :1+(r-ECO.RISK_EVEN)*(ECO.RISK_TOP-1)/(1-ECO.RISK_EVEN)*m;};
const bandShare=lo=>{let tot=0,hi=0;
  for(let v=1;v<=MAXV;v++){const n=ownedOf(v);tot+=v*n;if(v>=lo)hi+=v*n;}
  return tot?hi/tot:0;};

const statVal=k=>{
  if(k==='sets'){let n=0;for(let v=1;v<=MAXV;v++)if(ownedOf(v)>=v)n++;return n;}
  if(k==='owned')return S.cards.length;
  if(k==='placed')return S.st.placed||0;
  if(k==='asc')return S.asc;
  if(k==='upSum'){let s=0;for(const id in S.up)s+=S.up[id];return s;}
  if(k==='upMax'){let m=0;for(const id in S.up)m=Math.max(m,S.up[id]);return m;}
  return S.st[k]||0;};

/* rough per-copy pay fraction, for RANKING shop offers (sim estPay) */
const estPay=k=>{
  const d=STKD[k];if(!d)return 0;
  let e=(d.mul?d.mul-1:0)+(d.add?(d.add==='fn'?.5:d.add)*.4:0)
    +(d.addC||0)*.4+(d.frac?.12:0)+(d.bustAdd?.05:0)+(d.hits?.3:0)+(d.prime?.1:0);
  if(d.out||d.outN||d.trick)e=Math.max(e,.5);
  if(d.aura)e=Math.max(e,.4);
  if(d.dodge)e=Math.max(e,d.dodge*2);
  if(d.purify)e=Math.max(e,.5);
  if(d.relic)e=Math.max(e,.4);
  if(d.twinPull)e=Math.max(e,.8);
  if(d.purgeN||d.swap)e=Math.max(e,.4);
  return e*.12;};
const likeOf=k=>{
  const d=STKD[k],role=d?d.role:null,A=A_of(),pol=BRAIN.hunt&&BRAIN.hunt.pol;
  let w=(A.like&&A.like[role])||1;
  if(pol&&pol.role){
    if(pol.role==='many')w*=1.6;
    else if(role===pol.role)w*=4;
    else if(ROLE_X[pol.role]&&ROLE_X[pol.role].has(k))w*=4;}
  if(pol&&pol.role2){
    if(role===pol.role2)w*=2;
    else if(ROLE_X[pol.role2]&&ROLE_X[pol.role2].has(k))w*=2;}
  if(needRoles.has(role)||(needRoles.has('draw')&&ROLE_X.draw.has(k)))w*=3;
  const n=stkOwned(k);
  if(!n)w*=1.6;else w/=1+.5*(n-1);
  w*=1+.08*(STK[k].t-1);
  return w;};
const roleOwned=role=>{
  if(role==='many')return S.cards.filter(c=>c.stk&&!c.osk).length;
  let n=0;
  for(const c of S.cards){
    if(!c.stk||c.osk)continue;
    const d=STKD[c.stk];
    if(d&&d.role===role)n++;
    else if(ROLE_X[role]&&ROLE_X[role].has(c.stk))n++;}
  return n;};
function recomputeNeed(){
  needRoles=new Set();
  for(const g of GOALS){
    if(has(g.id)||!g.stk||!NEED[g.k]||STK_OFF[g.stk])continue;
    if(STK[g.stk].t<=tierOf()+1)needRoles.add(NEED[g.k]);}}

/* upgrade factor: the marginal value multiple of the next level
   (sim factorOf, reading the live state) */
function factorOf(oid){
  const l=L(oid),b=bustRate();
  switch(oid){
    case 'speed':return (1/ECO.SPEED_PER)*(stkOwned('haste')?1/(1-.25*presence()*.1):1);
    case 'value':return (1+ECO.INK_PER*(l+1))/(1+ECO.INK_PER*l);
    case 'eye':{const dk=Math.max(1,S.cards.length);
      return (1+ECO.EYE_PER*(l+1)*dk)/(1+ECO.EYE_PER*l*dk);}
    case 'mult':{const ms=multStep();
      return (1+(ms+.05)*(BRAIN.avgN-1))/(1+ms*(BRAIN.avgN-1));}
    case 'chain':{const c=Math.min(BRAIN.avgChain,2+l);
      return (1+(l+1)*c*chainRate(c))/(1+l*c*chainRate(c));}
    case 'nerve':return rMulAt(BRAIN.avgRisk,l+1)/rMulAt(BRAIN.avgRisk,l);
    case 'marked':{const d=Math.min(.85,.01*l),d2=Math.min(.85,.01*(l+1));
      return (1-b*(1-d2)/(1-d))/(1-b)+1e-6;}
    case 'grace':return (1-b*Math.pow(.9,l+1))/(1-b*Math.pow(.9,l));
    case 'guard':{const c=Math.min(.5,.25*hotShare());
      return (1-b*(1-c))/(1-b);}
    case 'salv':return ((1-b)+b*.05*(l+1))/((1-b)+b*.05*l);
    case 'high':return 1+.15*bandShare(8);
    case 'deep':return 1+.2*bandShare(14);
    case 'over':return BRAIN.avgN>=10?1.08:1.01;
    case 'house':return 1+.25/(BRAIN.avgChain+1);
    case 'iron':return 1+.03*BRAIN.avgChain*b;
    case 'sleight':{const o=outCount2();
      return (1+.03*(l+1)*o)/(1+.03*l*o)+(o?0:.004);}
    case 'abank':case 'auto':case 'flick':return 1.0005;
  }
  return 1;
}

/* the bank line: hunt-aware, verbatim wantBank */
function wantBank(r,h){
  const pol=BRAIN.hunt?BRAIN.hunt.pol:null;
  if(pol&&pol.bustPush&&h.ids.length===2&&h.ids.every(id=>!!byId(id).stk))return false;
  if(h.ids.length>=8)return true;
  if(pol){
    if(pol.comp){
      const sv2=h.ids.map(id=>cval(byId(id))).sort((a,b)=>a-b);let ok=false;
      if(pol.comp==='seven')ok=h.ids.length===7;
      else if(pol.comp==='123')ok=[1,2,3].every(v=>sv2.indexOf(v)>=0);
      else if(pol.comp==='spread')ok=sv2.length>=3&&sv2.every((v,i)=>i===0||v-sv2[i-1]>=2);
      else if(pol.comp==='rich3')ok=h.ids.length>=3&&sv2.every(v=>v>=3);
      if(ok)return true;
      return r>=.85;}
    if(pol.wide&&h.ids.length<pol.wide)return r>=(pol.bustLine!=null?pol.bustLine:.85);
    if(pol.safe&&h.ids.length>=2&&r>=.22)return true;
  }
  const line=pol&&pol.line!=null?pol.line:A_of().line;
  return r>=line||h.ids.length>=8;
}

/* the hunt: pick, stall, rotate (sim pickHunt/huntTick) */
function pickHunt(){
  const cands=GOALS.filter(g=>g.stk&&!STK_OFF[g.stk]&&!has(g.id)
    &&!((BRAIN.black.get(g.id)||{}).until>BRAIN.time));
  if(!cands.length)return;
  const A=A_of();let pool2=cands;
  if(!A.huntAll){
    pool2=cands.filter(g=>statVal(g.k)/g.t>=.2&&A.fams&&A.fams.some(f=>FAM[f].indexOf(g.k)>=0));
    if(!pool2.length)pool2=cands.filter(g=>statVal(g.k)/g.t>=.5);
    if(!pool2.length)return;}
  pool2=[...pool2].sort((a,b)=>
    STK[a.stk].t-STK[b.stk].t||statVal(b.k)/b.t-statVal(a.k)/a.t);
  const g=pool2[0],pol=(POLICY[g.k]||(()=>({})))(g.t);
  BRAIN.hunt={g,pol,since:BRAIN.time,start:BRAIN.time,prog:statVal(g.k)};
}
function huntTick(){
  if(BRAIN.hunt){
    const g=BRAIN.hunt.g,v=statVal(g.k);
    if(has(g.id)||v>=g.t){BRAIN.black.delete(g.id);BRAIN.hunt=null;}
    else{
      if(v>BRAIN.hunt.prog){BRAIN.hunt.prog=v;BRAIN.hunt.since=BRAIN.time;}
      const stall=BRAIN.time-BRAIN.hunt.since>720,
            longRun=BRAIN.time-BRAIN.hunt.start>1500;
      if(stall||longRun){
        const b=BRAIN.black.get(g.id)||{until:0,n:0};
        if(stall)b.n++;
        b.until=BRAIN.time+Math.min(3600,600*Math.pow(2,b.n));
        BRAIN.black.set(g.id,b);BRAIN.hunt=null;}}
  }
  if(!BRAIN.hunt)pickHunt();
  recomputeNeed();
}

/* goal-driven prestige: the ascend funds the next wanted shard row */
function wantTarget(){
  for(const k of METAPRIO){
    if(!META[k])continue;
    if(M(k)>=META[k].max)continue;
    if(M(k)===0&&metaGate(k))continue;
    const w=Math.ceil(META[k].c(M(k)));
    return Math.min(Math.max(3,w),10);
  }
  return Infinity;
}

/* one purchase beat (the sim runs one every 0.6 sim-seconds) */
function buySticker(k){
  const i=(S.shop.offers||[]).findIndex(o=>o&&!o.sold&&o.k===k);
  if(i<0)return;
  try{buyStk(i);}catch(e){return;}
  if(BRAIN.tSticker==null)BRAIN.tSticker=BRAIN.time;
}
function buyBeat(){
  const offers=(S.shop.offers||[]).map((o,i)=>({o,i}))
    .filter(x=>x.o&&!x.o.sold&&x.o.k!=='debolt');
  /* the first sticker is a milestone buy: latch the save until bought */
  if(BRAIN.tSticker==null&&offers.length){
    const cheapest=Math.min(...offers.map(x=>stkPrice(x.o.k)));
    if(cheapest-S.score<R.incMin/60*200)BRAIN.sv.active=true;
  }
  const firstSave=BRAIN.tSticker==null&&BRAIN.sv.active;
  /* needs-must pooling: a hunt's family the player owns none of, with
     a producer on the shelf, owns the wallet */
  let pooling=false,poolPick=null;
  const pol=BRAIN.hunt&&BRAIN.hunt.pol;
  if(!firstSave&&pol&&pol.role&&pol.role!=='many'&&roleOwned(pol.role)===0){
    poolPick=offers.find(x=>{
      const d=STKD[x.o.k];if(!d)return false;
      return d.role===pol.role||(ROLE_X[pol.role]&&ROLE_X[pol.role].has(x.o.k));})||null;
    if(poolPick&&S.score<stkPrice(poolPick.o.k))pooling=true;
  }
  /* the card lane */
  const cardLane=(BRAIN.sv.active||pooling)?0:(pol&&pol.cardFirst?.9:.6);
  BRAIN.cardClock+=cardLane;
  const cardEvery=pol&&pol.cardFirst?.6:1.2;
  if(!firstSave&&!pooling&&BRAIN.cardClock>=cardEvery){
    BRAIN.cardClock=0;
    let bestV=0;
    for(let v=1;v<=unlockedV();v++)if(ownedOf(v)<v){bestV=v;break;}
    if(bestV&&S.score>=cardCost(bestV))buyCard(bestV);
  }
  if(firstSave){
    let cheapest=null,ck=null;
    for(const x of offers){const c=stkPrice(x.o.k);
      if(cheapest==null||c<cheapest){cheapest=c;ck=x;}}
    if(ck&&S.score>=stkPrice(ck.o.k)){buySticker(ck.o.k);BRAIN.sv.active=false;}
    return;
  }
  if(poolPick&&!pooling)buySticker(poolPick.o.k);
  if(pooling)return;
  /* the competing-EV buy: upgrades by factor/cost, stickers by
     estPay·likeOf/cost, save-up ledger for the far better best */
  let best=null,bestAff=null;
  for(const oid of ORDER){
    let max;try{max=uMax(oid);}catch(e){max=UPG[oid]?UPG[oid].max:0;}
    const l=L(oid);
    if(!UPG[oid]||l>=max)continue;
    if(upGate(oid))continue;              /* the row hides until its u-goal */
    const cost=upCost(UPG[oid],l);
    let s=(factorOf(oid)-1)/cost;
    if(A_of().boost.indexOf(oid)>=0)s*=1.35;
    if(pol&&pol.speedFirst&&oid==='speed')s*=2;
    if(!best||s>best.s)best={cost,s,kind:'up',oid};
    if(S.score>=cost&&(!bestAff||s>bestAff.s))bestAff={cost,s,kind:'up',oid};
  }
  for(const x of offers){
    const cost=x.o.price||stkPrice(x.o.k);
    const s=estPay(x.o.k)*likeOf(x.o.k)/cost*((pol&&pol.stickerFirst)?2:1);
    if(!best||s>best.s)best={cost,s,kind:'stk',k:x.o.k};
    if(S.score>=cost&&(!bestAff||s>bestAff.s))bestAff={cost,s,kind:'stk',k:x.o.k};
  }
  const key=best?(best.kind==='up'?best.oid:'stk:'+best.k):null;
  const nmOf=c=>!c?null:(c.kind==='up'
    ?(UPG[c.oid]?UPG[c.oid].n:c.oid)+' L'+(L(c.oid)+1)
    :(STK[c.k]?STK[c.k].n:c.k));
  BRAIN.want={best:nmOf(best),bc:best&&best.cost,aff:nmOf(bestAff),ac:bestAff&&bestAff.cost,
    latched:BRAIN.sv.active};
  const buy=c=>{
    if(!c)return;
    if(c.kind==='up'){
      const l0=L(c.oid),s0=S.score;
      try{buyUpg(c.oid);}catch(e){BRAIN.err=(BRAIN.err||0)+1;}
      if(l0===L(c.oid)&&s0===S.score){
        BRAIN.deny=(BRAIN.deny||0)+1;
        const g=upGate(c.oid);
        logRow('unl','DENY',(UPG[c.oid]?UPG[c.oid].n:c.oid)+(g?' \u00b7 goal: '+g.n:' \u00b7 ?'),null,S.score);
      }
    }else{
      const n0=(S.shop.offers||[]).filter(o=>o&&o.sold).length,s0=S.score;
      try{buySticker(c.k);}catch(e){BRAIN.err=(BRAIN.err||0)+1;}
      if((S.shop.offers||[]).filter(o=>o&&o.sold).length===n0&&s0===S.score)
        BRAIN.deny=(BRAIN.deny||0)+1;
    }
  };
  if(best&&S.score<best.cost&&bestAff&&best.s>bestAff.s*2.2){
    if(!BRAIN.sv.active||BRAIN.sv.for!==key){
      BRAIN.sv.active=true;BRAIN.sv.since=BRAIN.time;BRAIN.sv.for=key;}
    if(BRAIN.time-BRAIN.sv.since>=180){BRAIN.sv.active=false;buy(bestAff);}
  }else{
    BRAIN.sv.active=false;
    buy(bestAff);
  }
}

/* the era handoff: the ascend wipes the roster, the mirrors follow */
function onAscendReset(){
  BRAIN.avgN=3;BRAIN.avgRisk=.35;BRAIN.avgChain=2;
  BRAIN.sv={active:false,since:0,for:null};
  BRAIN.hunt=null;BRAIN.cardClock=0;
  handMirror=[];upMirror={};metaMirror={};a10sig='';
}

/* the play tick: arm, bank on the line, draw on a cool deck, claim,
   buy on the beat, hunt, ascend */
function playTick(dt){
  if(typeof S==='undefined'||!S||!BRAIN.on)return;
  if(frozen||document.querySelector('#mo.on'))return;
  BRAIN.time=(BRAIN.time||0)+dt;
  /* claims land the moment they ready (the sim's checkGoals) */
  for(const id of [...(S.ready||[])]){try{claimAch(id);}catch(e){}}
  /* tricks arm by the game's own policy; one bank a tick; draws ride
     the cooldown the speedup warps */
  S.hands.forEach(h=>{try{autoPlay(h);}catch(e){}});
  const h=S.hands[0];
  if(h){
    if(canBank(h)&&wantBank(threat(h),h))bank(h,true);
    else if(pn()>=cdEnd&&!deckHold&&S.deck.length)drawCard(0,null,true);
  }
  /* a pending sticker pick places itself on the first blank */
  if(S.pick){
    const id=S.pick.ids.find(id=>{const c=byId(id);return c&&!c.stk;});
    if(id!=null){try{placeStk(id,50,50);}catch(e){}}
  }
  BRAIN.beat+=dt;
  if(BRAIN.beat>=.6){BRAIN.beat=0;buyBeat();}
  BRAIN.goalClock+=dt;
  if(BRAIN.goalClock>=5){BRAIN.goalClock=0;huntTick();}
  /* ascend when the banked meter funds the next wanted shard row */
  const target=wantTarget();
  if(target!==Infinity){
    const req=ascReq();
    if(S.banked>=req*(target/3)*(target/3)){
      try{ascend();}catch(e){}
      onAscendReset();
      machDirty=true;
    }
  }
}

/* ==================================================================
   8 · click-any-number charts — a 1s history per metric, a sidebar
   canvas, and hit-testing on the graph's nodes, chips and edge labels
   ================================================================== */
const METRICS={
  score:{l:'SCORE',g:()=>S.score},
  banked:{l:'BANKED',g:()=>S.banked},
  incmin:{l:'INCOME /MIN',g:()=>R.incMin},
  spend:{l:'SPEND /MIN',g:()=>R.upMin+R.stkMin+R.cardMin},
  deck:{l:'DECK PILE',g:()=>S.deck.length},
  hand:{l:'TABLE VALUE',g:()=>R.fsum},
  wards:{l:'WARDS',g:()=>R.wards},
  away:{l:'AWAY PILE',g:()=>R.away},
  upg:{l:'UPGRADE LEVELS',g:()=>R.upL},
  stk:{l:'STICKERS PLACED',g:()=>S.st.placed||0},
  drawmin:{l:'DRAWS /MIN',g:()=>R.drawMin},
  bustmin:{l:'BUSTS /MIN',g:()=>R.bustMin},
  chain:{l:'CHAIN',g:()=>R.chain},
  risk:{l:'RISK %',g:()=>R.risk},
  prem:{l:'RISK PREMIUM',g:()=>R.prem},
  shards:{l:'SHARDS',g:()=>S.shards},
};
const HIST={};for(const k in METRICS)HIST[k]=[];
const CHART={k:'score'};
function sampleHist(){
  for(const k in METRICS){
    let v=0;try{v=METRICS[k].g()||0;}catch(e){}
    const a=HIST[k];a.push({t:Date.now(),v});
    if(a.length>720)a.shift();
  }
}
function openChart(k){
  if(!METRICS[k])return;
  CHART.k=k;
  document.getElementById('mChartT').textContent=METRICS[k].l+' \u00b7 LAST 12 MIN';
  document.getElementById('mChart').classList.add('on');
  paintChart();
}
function paintChart(){
  const c=document.getElementById('mChartCv');if(!c||!c.clientWidth)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const w=c.clientWidth,h=c.clientHeight;
  const W1=Math.round(w*dpr),H1=Math.round(h*dpr);
  if(c.width!==W1||c.height!==H1){c.width=W1;c.height=H1;}
  const x2=c.getContext('2d');
  x2.setTransform(dpr,0,0,dpr,0,0);x2.clearRect(0,0,w,h);
  const ser=HIST[CHART.k]||[];
  x2.textBaseline='middle';
  if(ser.length<2){
    x2.font='400 11px "Orbit",system-ui,sans-serif';x2.fillStyle=INK3;
    x2.textAlign='center';x2.fillText('collecting\u2026',w/2,h/2);return;}
  let lo=Infinity,hi=-Infinity;
  for(const p of ser){if(p.v<lo)lo=p.v;if(p.v>hi)hi=p.v;}
  if(hi-lo<1e-9)hi=lo+1;
  const pad=(hi-lo)*.08;lo=Math.max(0,lo-pad);hi+=pad;
  const t0=ser[0].t,t1=ser[ser.length-1].t,span=Math.max(1,t1-t0);
  const X=t=>6+(t-t0)/span*(w-12),Y=v=>h-14-(v-lo)/(hi-lo)*(h-26);
  x2.strokeStyle='rgba(198,191,171,.55)';x2.lineWidth=1;
  for(const f of [0,.5,1]){const y=Y(lo+(hi-lo)*f);
    x2.beginPath();x2.moveTo(6,y);x2.lineTo(w-6,y);x2.stroke();}
  x2.beginPath();
  ser.forEach((p,i)=>{const x=X(p.t),y=Y(p.v);i?x2.lineTo(x,y):x2.moveTo(x,y);});
  x2.strokeStyle='#46422F';x2.lineWidth=1.6;x2.stroke();
  x2.lineTo(X(t1),h-14);x2.lineTo(X(t0),h-14);x2.closePath();
  x2.fillStyle='rgba(70,66,47,.07)';x2.fill();
  const lv=ser[ser.length-1].v;
  x2.beginPath();x2.arc(X(t1),Y(lv),3,0,7);x2.fillStyle='#8A6A2F';x2.fill();
  x2.font='700 9px "Orbit",system-ui,sans-serif';x2.fillStyle=INK3;
  x2.textAlign='left';x2.fillText(fmt(hi),6,10);x2.fillText(fmt(lo),6,h-5);
  x2.textAlign='right';x2.fillText('-'+Math.round(span/1000)+'s',w-6,h-5);
  x2.font='800 13px "Orbit",system-ui,sans-serif';x2.fillStyle='#8A6A2F';
  x2.fillText(fmt(lv),w-6,13);
}
document.getElementById('mChartX').addEventListener('click',()=>{
  document.getElementById('mChart').classList.remove('on');});

/* graph hit-testing: pools, converters, chips, then edge labels */
const N_METRIC={deck:'deck',wards:'wards',hand:'hand',away:'away',score:'score',
  banked:'banked',upg:'upg',shop:'stk',cards:'deck',risk:'risk',chain:'chain'};
const E_METRIC={eDraw:'drawmin',eBank:'incmin',eBust:'bustmin',eUp:'spend',
  eStk:'spend',eCard:'spend'};
function hitMetric(x,y){
  for(const k in E){const ed=E[k];
    if(!ed._lp)continue;
    const dx=x-ed._lp[0],dy=y-ed._lp[1];
    if(dx*dx+dy*dy<1100&&E_METRIC[k])return E_METRIC[k];}
  for(const k in N){const n=N[k];let in2=false;
    if(n.r!=null){const dx=x-n.x,dy=y-n.y;
      in2=dx*dx+dy*dy<(n.r+10)*(n.r+10);}
    else in2=Math.abs(x-n.x)<=n.w/2+8&&Math.abs(y-n.y)<=n.h/2+8;
    if(in2&&N_METRIC[k])return N_METRIC[k];}
  return null;
}
function cvMetric(e){
  const r=cv.getBoundingClientRect(),v=cv._view;if(!v)return null;
  return hitMetric((e.clientX-r.left-v.ox)/v.s,(e.clientY-r.top-v.oy)/v.s);
}
cv.addEventListener('mousemove',e=>{cv.style.cursor=cvMetric(e)?'pointer':'default';});
cv.addEventListener('click',e=>{const m=cvMetric(e);if(m)openChart(m);});
/* the DOM numbers: log rows + balances, the rate readout, the 10 boxes */
document.body.addEventListener('click',e=>{
  const t=e.target.closest('[data-m]');
  if(t&&METRICS[t.dataset.m])openChart(t.dataset.m);
});

/* unlock watchers: tab gates, upgrade + shard rows, the holo press */
let seenTabs={},gatedRows=null,gatedMeta=null,shinyOn=false;
function watchUnlocks(){
  const names={cards:'DECK',ach:'GOALS',up:'UPGRADES',shop:'STICKER SHOP',pres:'ASCEND'};
  for(const k in names)if(S.seen[k]&&!seenTabs[k]){
    seenTabs[k]=1;
    logRow('unl','TAB',names[k]+' tab opens',null,null);}
  if(!gatedRows){
    gatedRows=new Set();gatedMeta=new Set();
    for(const id in UPG)if(upGate(id))gatedRows.add(id);
    for(const id in META)if(metaGate(id))gatedMeta.add(id);
  }else{
    for(const id in UPG){
      const g=upGate(id);
      if(gatedRows.has(id)&&!g)logRow('unl','ROW',UPG[id].n+' row opens',null,null);
      if(g)gatedRows.add(id);else gatedRows.delete(id);}
    for(const id in META){
      const g=metaGate(id);
      if(gatedMeta.has(id)&&!g)logRow('unl','SHARD',META[id].n+' row opens',null,null);
      if(g)gatedMeta.add(id);else gatedMeta.delete(id);}}
  const sh=shinyUn();
  if(sh&&!shinyOn)logRow('unl','UNL','the holo press opens',null,null);
  shinyOn=sh;
}

/* ==================================================================
   9 · the poll — 250 ms: drive the brain, diff the state for the
   canvas, sample history, refresh the strips. At 4\u00d7+ speed the
   felt goes dark (BG): the emitters stand down so the score floats
   never pile into mush
   ================================================================== */
let prev=[],gi=0;
setInterval(()=>{
  if(typeof S==='undefined'||!S)return;
  lastAct=pn();
  if(!document.hidden)BG=SPD>=4;
  playTick(.25*SPD);
  readState();
  const snap=[S.score,S.banked,S.deck.length,R.handN,R.fsum,R.wards,R.away,
    R.chain,R.risk,Object.keys(els).length];
  let changed=snap.length!==prev.length;
  if(!changed)for(let i=0;i<snap.length;i++)if(snap[i]!==prev[i]){changed=true;break;}
  prev=snap;
  if(changed)machDirty=true;
  gi++;
  if(gi%4===0){sampleHist();watchUnlocks();
    if(document.getElementById('mChart').classList.contains('on'))paintChart();}
  if(gi%2===0){paintA10();renderGoals();}
  kick();
},250);

/* boot the monitor: fresh state, brain on, no tutorial, autos off
   (the brain is the automation) */
try{
  S.tut='done';
  S.set.autoDraw=false;S.set.autoBank=false;
  if(typeof tutPaint==='function')tutPaint();
}catch(e){}
try{window.MB={BRAIN:BRAIN,buyBeat:buyBeat,playTick:playTick,
  openChart:openChart,hist:HIST};}catch(e){}
readState();
mBrain.textContent='BRAIN: '+A_of().n.toUpperCase();
buildA10();
document.getElementById('mLogSub').textContent='click any number to chart it';
openChart('score');   /* the chart door is discoverable from frame one */
handMirror=handIds();
upMirror=Object.assign({},S.up);
metaMirror=Object.assign({},S.meta);
dScore=S.score;dBanked=S.banked;
renderGoals();recomputeNeed();kick();
})();
