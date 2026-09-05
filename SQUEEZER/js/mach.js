/* ==================================================================
   mach.js — the live machinations view (mach.html only, body.mach).
   The game boots untouched; this file re-lays the page into two
   columns and compiles the rolling balance into a machinations-style
   economy graph. Every hook is a wrapper around a global the game
   already publishes — no game file is edited:

     logAct      the one settled-action funnel (draw/bust/bank/res +
                 every purchase code)  → tokens, rates, results, log
     deflect     WARD / SLIPPED saves    → ward tokens
     buyCard     deck purchases          → score→cards→deck chain
     syncWide    the desktop wide lanes  → inert here (single column)

   Performance laws: one canvas, flat shapes, no shadowBlur; the rAF
   loop stops when no tokens fly and nothing is dirty; a 250 ms poll
   diffs the state and only then marks dirty; dt is clamped FIRST;
   particles are capped; hidden tabs render nothing.
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
  '<div class="mrate" id="mRate">watching the balance</div><div class="msp"></div>'+
  '<div class="mspd" id="mSpd"><button data-s="1" class="on">1\u00d7</button>'+
  '<button data-s="2">2\u00d7</button><button data-s="4">4\u00d7</button>'+
  '<button data-s="8">8\u00d7</button></div>'+
  '<button class="maut" id="mAut" title="flip the game\'s own auto dials">AUTOS</button></div>'+
  '<canvas id="machCv"></canvas>';

const bot=mk('div','',document.body);bot.id='machBot';
bot.innerHTML=
  '<div id="mStageWrap"><div id="mStage"></div><div id="mCap">draw a card</div></div>'+
  '<div id="mSide">'+
  '<div class="mh">LAST 10 RESULTS</div><div id="mRes"></div>'+
  '<div class="mh">GOALS</div><div id="mGoals"></div></div>';

const log=mk('div','',document.body);log.id='machLog';
log.innerHTML=
  '<div class="lhead"><div class="mt">PURCHASE LOG</div>'+
  '<div class="lsub" id="mLogSub"></div></div>'+
  '<div class="lbody" id="mLogBody"></div>';

/* the title screen and the cold-boot hold belong to interactive play:
   a monitor warms up on its own, and the idle minute never returns */
try{
  if(typeof ttlAlive==='function'&&ttlAlive()&&typeof ttlOff==='function')ttlOff(true);
  coldBoot=false;lastAct=pn();
  setInterval(()=>{lastAct=pn();},5000);
}catch(e){}

/* ==================================================================
   2 · the feed — rolling windows, results, mirrors of the state the
   wrappers need to name what just changed
   ================================================================== */
const T0=Date.now();
const W={inc:[],draw:[],bust:[],upg:[],stk:[],card:[]};   /* {t,n} rolling windows */
const RESULTS=[];                                         /* last 10, newest first */
let SPD=1,machDirty=true;
let handMirror=[],upMirror={},metaMirror={};
const handIds=()=>{const o=[];for(const h of S.hands)for(const id of h.ids)o.push(id);return o;};
const fh=()=>S.hands[S.focus]||S.hands[0];
const wardsN=()=>{const r=fh().run;return (r&&r.grace||0)+(r&&r.cullWard||0);};
const awayN=()=>S.out.length+(S.disc?S.disc.length:0)+(S.gone?S.gone.length:0);
const fsum=()=>fh().ids.reduce((a,id)=>a+cval(byId(id)),0);
const rate=(win,min)=>{const c=Date.now()-min*60000;let s=0,n=0;
  while(win.length&&win[0].t<c)win.shift();
  for(const e of win){s+=e.n;n++;}return {sum:s,n:n};};

function chip(k,main,sub){
  RESULTS.unshift({k,main,sub});if(RESULTS.length>10)RESULTS.length=10;
  const box=document.getElementById('mRes');box.textContent='';
  for(const r of RESULTS){
    const c=mk('span','rchip '+r.k,box);c.textContent=r.main;
    if(r.sub)mk('small','',c).textContent=r.sub;}
}
function logRow(cls,tag,name,cost,bal){
  const b=document.getElementById('mLogBody');
  const r=mk('div','plrow '+cls,b);r.style.opacity='0';
  const s=Math.floor((Date.now()-T0)/1000);
  mk('span','plt',r).textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  mk('span','plk',r).textContent=tag;
  const n=mk('span','pln',r);typeof name==='string'?n.textContent=name:n.appendChild(name);
  if(cost!=null)mk('span','plc',r).textContent=(cost<0?'\u2212':'+')+fmt(Math.abs(cost));
  if(bal!=null)mk('span','plb',r).textContent=fmt(bal);
  b.prepend(r);
  while(b.children.length>80)b.lastChild.remove();
  requestAnimationFrame(()=>{r.style.transition='opacity .25s';r.style.opacity='1';});
  document.getElementById('mLogSub').textContent=b.children.length+' entries';
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
      if(c){spawnCardPanel(c);chip('draw',String(cval(c)),n>0?'+'+fmt(n):null);}
    }
    machDirty=true;return;
  }
  if(a==='bank'){
    const g=Math.max(1,Math.round(Math.log10(Math.max(1,n))));
    tok('eBank',clamp(g,1,6),'#2C563C',{sp:2.1});
    tok('eGhost',1,'#8A6A2F',{sp:1.4,r:3});
    N.score.p=1;W.inc.push({t:Date.now(),n:Math.max(0,n)});
    chip('bank','+'+fmt(n),null);
    machDirty=true;return;
  }
  if(a==='bust'){
    const hl=S.st.handLog||[],last=hl[hl.length-1]||{};
    tok('eBust',3,'#8E2B1C',{sp:1.7,r:4.5});E.eBust.fl=1;
    chip('bust','\u2212'+fmt(last.v||0),n>0?'+'+fmt(n)+' kept':null);
    if(bustPair&&bustPair[0]&&byId(bustPair[0]))spawnCardPanel(byId(bustPair[0]),true);
    W.bust.push({t:Date.now(),n:1});
    if(n>0)W.inc.push({t:Date.now(),n});
    setTimeout(()=>{tok('eCyc',2,'#8A8471',{sp:1.3,r:3.5});E.eCyc.fl=1;machDirty=true;},1000);
    machDirty=true;return;
  }
  if(a==='res'){N.score.p=1;W.inc.push({t:Date.now(),n:Math.max(0,n)});
    chip('div','+'+fmt(n),'dividend');machDirty=true;return;}
  if(a==='flt'||a==='bal'){W.inc.push({t:Date.now(),n:Math.max(0,n)});
    tok('eBank',1,'#2C563C',{sp:2.1});chip('div','+'+fmt(n),a==='flt'?'float':'bail');
    machDirty=true;return;}
  if(a==='off'){W.inc.push({t:Date.now(),n:Math.max(0,n)});
    logRow('inc','OFF','Offline earnings',n,S.score);machDirty=true;return;}
  if(a==='upg'){
    let id=null;for(const k in S.up)if(S.up[k]!==(upMirror[k]||0))id=k;
    upMirror=Object.assign({},S.up);
    W.upg.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eUp',1,'#2A4761',{sp:2});E.eUp.fl=1;
    const u=id&&UPG[id];
    const nm=document.createDocumentFragment();
    nm.append(document.createTextNode(u?u.n:'Upgrade'));
    if(id)mk('small','',nm).textContent=' L'+L(id);
    logRow('upg','UPG',nm,n,S.score);machDirty=true;return;
  }
  if(a==='meta'){
    let id=null;for(const k in S.meta)if(S.meta[k]!==(metaMirror[k]||0))id=k;
    metaMirror=Object.assign({},S.meta);
    tok('eUp',1,'#7A4A8A',{sp:2});E.eUp.fl=.6;
    const m=id&&META[id];
    const nm=document.createDocumentFragment();
    nm.append(document.createTextNode(m?m.n:'Shard upgrade'));
    if(id)mk('small','',nm).textContent=' L'+M(id)+' \u00b7 shards';
    logRow('meta','META',nm,n,null);machDirty=true;return;
  }
  if(a==='stk'){
    W.stk.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eStk',1,'#8A6A2F',{sp:2});E.eStk.fl=1;
    queueMicrotask(()=>{
      const p=S.pick,k=p&&p.k,sk=k&&STK[k];
      const nm=document.createDocumentFragment();
      nm.append(document.createTextNode(sk?sk.n:'Sticker'));
      if(p&&p.shy)mk('small','',nm).textContent=' shiny';
      logRow('stk','STK',nm,n,S.score);});
    machDirty=true;return;
  }
  if(a==='rr'){W.stk.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eStk',1,'#8A6A2F',{sp:2});
    logRow('stk','SHOP','Restock now',n,S.score);machDirty=true;return;}
  if(a==='db'){W.stk.push({t:Date.now(),n:Math.abs(n||0)});
    tok('eStk',1,'#8A6A2F',{sp:2});
    logRow('stk','STRIP','De-bolt',n,S.score);machDirty=true;return;}
  if(a==='asc'){
    toks.length=0;
    N.banked.p=1;
    const nm=document.createDocumentFragment();
    nm.append(document.createTextNode('Ascension'));
    mk('small','',nm).textContent=' +'+fmt(n||0)+' shards';
    logRow('asc','ASC',nm,n,null);
    chip('div','ASC','+'+fmt(n||0)+' shards');
    machDirty=true;return;
  }
}

/* saves: WARD / SLIPPED deflects feed the ward pool */
const _deflect=typeof deflect==='function'?deflect:null;
if(_deflect)deflect=function(id,label,disc){
  try{
    tok('eWard',1,'#2A4761',{sp:2.2,r:4});N.wards.p=1;
    chip('ward','save',label==='WARD'?'ward':'slip');
    machDirty=true;
  }catch(e){}
  return _deflect(id,label,disc);
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
      logRow('card','CARD',nm,cost,S.score);
      machDirty=true;
    }
  }catch(e){}
  return r;
};

/* ==================================================================
   4 · header controls — speedup (deck cooldown warp) + autos dial
   ================================================================== */
document.getElementById('mSpd').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const s=+b.dataset.s;
  if(SPD!==s&&cdEnd>pn())cdEnd=pn()+(cdEnd-pn())*SPD/s;
  SPD=s;
  document.querySelectorAll('#mSpd button').forEach(x=>x.classList.toggle('on',x===b));
});
const mAut=document.getElementById('mAut');
mAut.addEventListener('click',()=>{
  if(!L('auto')&&!L('abank'))return;
  const onNow=!!(S.set.autoDraw||S.set.autoBank);
  S.set.autoDraw=!onNow;S.set.autoBank=!onNow;paint();save();
  syncAutos();
});
function syncAutos(){
  const own=!!(L('auto')||L('abank'));
  mAut.disabled=!own;
  mAut.classList.toggle('on',own&&!!(S.set.autoDraw||S.set.autoBank));
}

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
let goalsSeed=0;
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
    mk('span','gr',r).textContent=rewardTx(a);
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
  for(const {a,p} of prog.slice(0,4)){
    const r=mk('div','grow',box);
    mk('span','gn',r).textContent=a.n;
    const b=mk('span','gb',r);const f=mk('i','',b);
    f.style.width=(p*100).toFixed(1)+'%';
    mk('span','gp',r).textContent=Math.floor(p*100)+'%';
    mk('span','gr',r).textContent=rewardTx(a);
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

/* per-frame read of the live state into labels + ring fractions */
const R={};
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
  const inc=rate(W.inc,2),dr=rate(W.draw,2),bu=rate(W.bust,2);
  R.incMin=inc.sum;R.drawMin=dr.n;R.bustMin=bu.n;
  R.upMin=rate(W.upg,2).sum;R.stkMin=rate(W.stk,2).sum;R.cardMin=rate(W.card,2).sum;
  R.req=ascReq();
  const el2=document.getElementById('mRate');
  el2.textContent=(R.incMin>0?'\u25b2 +'+fmt(R.incMin)+'/min  \u00b7  ':'idle  \u00b7  ')+
    R.drawMin+' draws/min \u00b7 '+R.bustMin+' busts/min \u00b7 x'+R.prem.toFixed(2)+' prem';
}

/* the eased money displays: the pools roll toward the real balance */
let dScore=0,dBanked=0;

let raf=0,lastT=0;
function frame(t){
  raf=0;
  const dt=Math.min(.05,lastT?(t-lastT)/1000:.016);lastT=t;
  let live=toks.length>0;
  /* ease the money pools */
  const e=Math.min(1,dt*7);
  if(Math.abs(dScore-S.score)>.5){dScore+=(S.score-dScore)*e;machDirty=true;}
  else dScore=S.score;
  if(Math.abs(dBanked-S.banked)>.5){dBanked+=(S.banked-dBanked)*e;machDirty=true;}
  else dBanked=S.banked;
  /* tokens */
  for(let i=toks.length-1;i>=0;i--){
    const k=toks[i];k.t+=dt*k.sp;
    if(k.t>=1){
      if(k.next)tok(k.next,1,k.col,{r:k.r,sp:k.sp});
      toks.splice(i,1);
    }
  }
  live=live||toks.length>0;
  /* flashes + pulses decay */
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
  if(!ed.dash&&!ed.ghost){   /* arrowhead */
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
    haloTxt(ed.text||'',p[0]+ed.lab[1],p[1]+ed.lab[2],
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
  /* the converter tick: a small arrow in a circle, machinations-style */
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
  ctx.setTransform(dpr*s,0,0,dpr*s,ox*dpr,oy*dpr);
  /* edge labels first (strings live on E) */
  E.eDraw.text=R.drawMin+'/min';
  E.eBank.text='+'+fmt(R.incMin)+'/min';
  E.eBust.text=R.bustMin+'/min';
  E.eUp.text=fmt(R.upMin);
  E.eStk.text=fmt(R.stkMin);
  E.eCard.text=fmt(R.cardMin);
  for(const k in E)if(!E[k].ghost)edge(k);
  /* state dashes */
  ctx.globalAlpha=.65;
  for(const [nk,ek] of DASHES){
    const n=N[nk],p=bpt(E[ek].seg,.5);
    ctx.setLineDash([3,3]);ctx.strokeStyle='#8E2B1C';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(n.x,n.y+h2(n));ctx.lineTo(p[0],p[1]);ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha=1;
  /* tokens */
  for(const k of toks){
    if(k.t<0)continue;
    const p=bpt(E[k.e].seg,Math.min(1,k.t));
    ctx.beginPath();ctx.arc(p[0],p[1],k.r,0,7);
    ctx.fillStyle=k.col;ctx.fill();
    ctx.lineWidth=1;ctx.strokeStyle='rgba(21,20,14,.35)';ctx.stroke();
  }
  /* nodes */
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
   7 · the poll — 250 ms diff of the live balance; only a real change
   marks the canvas dirty. The goal rows refresh on their own beat.
   ================================================================== */
let prev=[],gi=0;
setInterval(()=>{
  if(typeof S==='undefined'||!S)return;
  lastAct=pn();
  readState();
  const snap=[S.score,S.banked,S.deck.length,R.handN,R.fsum,R.wards,R.away,
    R.chain,R.risk,els&&Object.keys(els).length];
  let changed=snap.length!==prev.length;
  if(!changed)for(let i=0;i<snap.length;i++)if(snap[i]!==prev[i]){changed=true;break;}
  prev=snap;
  if(changed)machDirty=true;
  if(++gi%4===0){renderGoals();syncAutos();}
  kick();
},250);

/* seed the mirrors + money displays once the boot save is live */
handMirror=handIds();
upMirror=Object.assign({},S.up);
metaMirror=Object.assign({},S.meta);
dScore=S.score;dBanked=S.banked;
readState();renderGoals();syncAutos();kick();
})();
