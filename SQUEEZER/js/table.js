/* ==================================================================
   table.js — the table: felt scaffolding, cardstock cards with sticker
   faces, physical tokens (DECK / OUT / SET / CHAIN / WARD), ward
   rings around the deck, Peek cards
   above the deck, Split's banded hands, layout + paint loop.
   The readout, gauge and BANK all speak for the focused hand; the hand
   rail switches focus.
   ================================================================== */
let FW=0, FH=0, DX=0, DY=0, OX=0, OY=0, CX=0;
const hueOf=v=>200-(v-1)*(195/19);
const inkOf=v=>`hsl(${hueOf(v)} 44% 30%)`;
const tintOf=v=>`hsl(${hueOf(v)} 42% 46%)`;
const topFaceUp=()=>M('vantage')>0;
const HAND_SC=[1,.94,.8,.7,.62];
/* desktop: the app frame runs 15% wider (css min-width:720px blocks) and
   every felt size and anchor scales with it. Guarded: the node harness
   has no matchMedia. The wide two-column layout (css body.wide, born at
   1024px once any side tab exists) stretches the felt past the phone
   frame, so there k rides the measured felt width — clamped, so a
   letterboxed window never blows the piles out of proportion */
const DESK_Q=typeof matchMedia==='function'?matchMedia('(min-width:720px)'):null;
const WIDE_Q=typeof matchMedia==='function'?matchMedia('(min-width:1024px)'):null;
const isWide=()=>!!(WIDE_Q&&WIDE_Q.matches&&document.body.classList.contains('wide'));
const deskK=()=>{
  if(isWide())return Math.min(1.4,Math.max(1.15,FW/560));
  return DESK_Q&&DESK_Q.matches?1.15:1;
};

function mkEl(c){
  if(els[c.id])return els[c.id];
  const e=document.createElement('div');e.className='card';
  e.innerHTML=`<div class="inn"><div class="fc bk"></div>
    <div class="fc ft"><div class="bar"></div><span class="n">${c.v}</span><span class="r"></span></div></div>`;
  e.dataset.cid=c.id;
  e.style.transition='none';e.style.transform=`translate(${DX||60}px,${DY||60}px)`;
  $('#felt').appendChild(e);els[c.id]=e;faceOf(c);
  requestAnimationFrame(()=>{e.style.transition='';});
  return e;
}
/* face refresh: value ink, colored bar, stickers; stamp=true replays the
   slap. The face speaks cval — a borrowed value wears it, wavy-underlined,
   with the printed value struck small somewhere free on the card, until
   the card leaves the table and the printed face comes back */
/* ---------------- card conditions: the procgen wear ----------------
   Every card paints its own set, seeded by id, so the marks are
   permanent: repaints, flights, saves and loads all show the same
   card wearing the same stock. No two cards wear a condition alike.
   Bent bends the stock along a seeded crease line.
   The deck grid reuses the same painter (condPaintGrid) */
function pRng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/* dog-ear geometry: any corner, any intensity. Two seeded depths (a
   along one edge, b along the other) set the crease's angle; the flap
   is the lost corner mirrored across that crease */
const DOGEARCORNER={
  tr:{A:(a,b)=>({x:100-a,y:0}),B:(a,b)=>({x:100,y:b}),C:{x:100,y:0},
      cut:(a,b)=>`0% 0,${100-a}% 0,100% ${b}%,100% 100%,0% 100%`},
  br:{A:(a,b)=>({x:100,y:100-b}),B:(a,b)=>({x:100-a,y:100}),C:{x:100,y:100},
      cut:(a,b)=>`0% 0,100% 0,100% ${100-b}%,${100-a}% 100%,0% 100%`},
  bl:{A:(a,b)=>({x:a,y:100}),B:(a,b)=>({x:0,y:100-b}),C:{x:0,y:100},
      cut:(a,b)=>`0% 0,100% 0,100% 100%,${a}% 100%,0% ${100-b}%`},
  tl:{A:(a,b)=>({x:0,y:b}),B:(a,b)=>({x:a,y:0}),C:{x:0,y:0},
      cut:(a,b)=>`${a}% 0,100% 0,100% 100%,0% 100%,0% ${b}%`}};
function dogearFlap(A,B,C){
  const dx=B.x-A.x,dy=B.y-A.y,l=dx*dx+dy*dy,
        t=((C.x-A.x)*dx+(C.y-A.y)*dy)/l;
  return{x:2*(A.x+t*dx)-C.x,y:2*(A.y+t*dy)-C.y};}
function paintCondInto(layer,c,face){
  layer.innerHTML='';
  const R=pRng(hashStr('cnd'+c.id));
  const el=(cls,st)=>{const d=document.createElement('i');d.className=cls;
    if(st)d.style.cssText=st;layer.appendChild(d);return d;};
  if(cardHas(c,'soggy')){
    for(let i=0,n=3+Math.floor(R()*3);i<n;i++)
      el('stain',`left:${(6+R()*76).toFixed(1)}%;top:${(10+R()*74).toFixed(1)}%;`+
        `width:${(16+R()*30).toFixed(1)}%;height:${(13+R()*24).toFixed(1)}%;opacity:${(.5+R()*.5).toFixed(2)}`);}
  if(cardHas(c,'nearmint')){
    el('mnsh');
    for(let i=0;i<3;i++)
      el('spk',`left:${(10+R()*70).toFixed(1)}%;top:${(14+R()*66).toFixed(1)}%;`+
        `animation-delay:${(i*.85+R()*.4).toFixed(2)}s`);}
  if(cardHas(c,'used')){
    for(let i=0,n=4+Math.floor(R()*3);i<n;i++)
      el('wear',`left:${(8+R()*74).toFixed(1)}%;top:${(8+R()*76).toFixed(1)}%;`+
        `width:${(10+R()*22).toFixed(1)}%;height:${(8+R()*16).toFixed(1)}%`);
    for(let i=0;i<2;i++)
      el('scratch',`left:${(5+R()*40).toFixed(1)}%;top:${(15+R()*70).toFixed(1)}%;`+
        `width:${(25+R()*35).toFixed(0)}%;transform:rotate(${(R()*180).toFixed(0)}deg)`);}
  if(cardHas(c,'ripped')){
    /* the tear starts ON the outer edge: a seeded edge, a seeded spot
       along it, the gash swinging inward from that anchor at a seeded
       angle. Torn stock, not ink; the print never moves under it */
    const E=['t','r','b','l'][Math.floor(R()*4)],
          along=14+R()*72, w=30+R()*12,
          ang=({t:90,r:180,b:270,l:0})[E]+R()*50-25;
    const pos=E==='t'?`left:${along.toFixed(1)}%;top:0`:
              E==='r'?`left:100%;top:${along.toFixed(1)}%`:
              E==='b'?`left:${along.toFixed(1)}%;top:100%`:
                      `left:0;top:${along.toFixed(1)}%`;
    const t=el('ctear',`${pos};width:${w.toFixed(1)}%;`+
      `transform-origin:0 50%;transform:rotate(${ang.toFixed(0)}deg)`);
    t.innerHTML=`<svg viewBox="0 0 24 24">${tearSVG()}</svg>`;}
  if(cardHas(c,'dogeared')){
    /* the fold: a seeded corner, a seeded depth. The face is CLIPPED,
       so the ink border cuts away with the corner and the flap floats
       over the crease with a shadow: the illusion holds */
    if(face){
      const k=['tr','br','bl','tl'][Math.floor(R()*4)],D=DOGEARCORNER[k];
      const a=7+Math.floor(R()*7),b=7+Math.floor(R()*7);
      const A=D.A(a,b),B=D.B(a,b),F=dogearFlap(A,B,D.C);
      face.style.clipPath=`polygon(${D.cut(a,b)})`;
      el('deshade '+k);
      const d=el('deflap');
      d.style.clipPath=`polygon(${A.x}% ${A.y}%,${B.x}% ${B.y}%,${F.x.toFixed(1)}% ${F.y.toFixed(1)}%)`;
      d.style.transform=`perspective(220px) rotateZ(${(R()*12-6).toFixed(1)}deg)`;
      d.style.filter='drop-shadow(-1px 1.5px 1px rgba(30,25,10,.45))';}
  }
  if(cardHas(c,'bent')){
    /* the top edge folds back in 3D. The face is NEVER clipped: an
       opaque strip box covers the top region instead (a clipped face
       clips its own strip away). The wrapper is untransformed (crisp
       border + overflow clip; WebKit drops children of clip-path +
       3D-transform combos), the inner layer keeps FULL-CARD coordinate
       space so the cloned print aligns, then tilts back. The crease
       stays above the sticker band (y 18%+) */
    face.querySelectorAll('.benttop').forEach(x=>x.remove());
    face.style.clipPath='';
    const cut=10+Math.floor(R()*5),lift=(28+R()*8).toFixed(1);
    const wrap=el('benttop');
    wrap.style.height=cut+'%';
    const lay=el('bentin');
    lay.innerHTML=[...face.children].filter(x=>x!==layer).map(x=>x.outerHTML).join('');
    lay.style.height=(10000/cut).toFixed(2)+'%';
    lay.style.transformOrigin=`50% ${cut}%`;
    lay.style.transform=`perspective(400px) rotateX(${lift}deg)`;
    wrap.appendChild(lay);
    face.appendChild(wrap);
    face.appendChild(layer);   /* the crease shade sits above the fold */
    el('bcreasesh',`top:${cut}%;left:0;right:0;height:20%;`+
      `background:linear-gradient(rgba(30,25,10,.20),transparent)`);}
}
/* the YOUR CARDS grid wears the same procgen through the same painter */
function condPaintGrid(root){
  root.querySelectorAll('.gcard').forEach(g=>{
    const c=byId(+g.dataset.id);if(!c)return;
    const gf=g.querySelector('.gf');if(!gf)return;
    gf.style.clipPath='';

    let lay=gf.querySelector('.cnd');
    if(!lay){lay=document.createElement('i');lay.className='cnd';
      const stk=gf.querySelector('.stk');
      if(stk)gf.insertBefore(lay,stk);else gf.appendChild(lay);}
    paintCondInto(lay,c,gf);});
}
function faceOf(c,stamp){
  const e=els[c.id];if(!e)return;
  const v=cval(c);
  const ft=e.querySelector('.ft');
  const barEl=ft.querySelector('.bar');
  if(cardHas(c,'promo')){
    /* the foil layers mix halfway into the card's own value color:
       the custom props feed the css color-mix stops */
    ft.style.setProperty('--holoink',inkOf(v));
    ft.style.setProperty('--holotab',tintOf(v));
    barEl.classList.add('holo');barEl.style.background='';
  }else{
    barEl.classList.remove('holo');barEl.style.background=tintOf(v);
  }
  const nEl=ft.querySelector('.n');
  nEl.style.color=inkOf(v);
  nEl.textContent=v;
  const pb=ft.querySelector('.pbanner');if(pb)pb.remove();
  const ml=ft.querySelector('.minolbl');if(ml)ml.remove();
  /* promo: the shiny top stamp carries the header AND the number,
     and the whole face wears the holo outline */
  ft.classList.toggle('cpromo',cardHas(c,'promo'));
  /* promo: the main digit IS the holo foil */
  nEl.classList.toggle('holonum',cardHas(c,'promo'));
  /* graded: the case carries the institution's label */
  if(cardHas(c,'graded'))ft.insertAdjacentHTML('beforeend',
    `<span class="minolbl">MINO 10</span>`);
  ft.querySelector('.r').textContent=c.r?'+'+(c.r*6)+'%':'';
  const ov=ft.querySelector('.ov');if(ov)ov.remove();
  const modded=c.cv!=null||c.osk!=null||cardHas(c,'soggy')||(c.nb||0)>0;
  if(modded){
    /* the struck print sits in free space: out of the digit band, the
       bar and the relic mark, and on the opposite half from the sticker.
       Seeded per card, so repaints never make it wander */
    const oh=hashStr('ov'+c.id);
    let sx=null,sy=null;
    if(c.stk){const p=stkPose(c.stk,'c'+c.id);
      sx=c.sx!=null?c.sx:p.px;sy=c.sy!=null?c.sy:p.py;}
    const top=sy==null?!!(oh&1):sy>=50;   /* dodge the sticker's half */
    let ox=22+oh%57;                      /* center-x 22-78 */
    if(sx!=null&&Math.abs(ox-sx)<26)ox=sx<=50?Math.min(80,sx+30):Math.max(20,sx-30);
    if(!top&&c.r)ox=Math.min(ox,64);      /* keep the relic mark's corner */
    const oy=top?10+(oh>>7)%5:86+(oh>>7)%5;
    ft.insertAdjacentHTML('beforeend',`<span class="ov" style="left:${ox}%;top:${oy}%">${c.v}</span>`);
  }
  e.classList.toggle('mod',modded);
  ft.classList.toggle('cwet',cardHas(c,'soggy'));
  ft.classList.toggle('cglass',cardHas(c,'glass'));
  ft.classList.toggle('cgraded',cardHas(c,'graded'));
  ft.style.clipPath='';

  e.classList.toggle('boom3',!!c.boom3);
  e.classList.toggle('dud',!!c.dud);
  ft.querySelectorAll('.stk,.rt,.cnd,.benttop').forEach(s=>s.remove());
  const cnd=document.createElement('i');cnd.className='cnd';
  if(c.stk)ft.insertAdjacentHTML('beforeend',stickerHTML(c.stk,'c'+c.id,null,c));
  ft.appendChild(cnd);
  paintCondInto(cnd,c,ft);   /* painted last: the bend's halves carry the sticker */
  if(stamp){e.classList.remove('stamped');void e.offsetWidth;e.classList.add('stamped');
    setTimeout(()=>e.classList.remove('stamped'),520);}
}
function setUsed(c,on){const e=els[c.id];if(!e)return;
  const s=e.querySelector('.stk');if(s)s.classList.toggle('used',on);}

function buildEls(){$('#felt').querySelectorAll('.card').forEach(e=>e.remove());els={};S.cards.forEach(c=>{mkEl(c);faceOf(c);});}
let CUR_CW=54,CUR_CH=76;   /* layout() refreshes; place() stamps them on every card */
function place(id,x,y,rot,up,z,out,sc,rest){
  const e=els[id];if(!e)return;
  if(fanHeld(id))return;   /* mid-fan: the tween owns this card */
  if(preDrops.includes(id))return;   /* the early lifts: they wait on the felt */
  /* a face-up card can never rest flat: the 2D pose pins the back on
     (Tell's revealed top, Vantage's standing read) — it keeps the flip */
  if(rest&&up)rest=false;
  /* rest: a card parked in the deck is placed by left/top with NO
     transform at all — the least machinery a card can render through,
     immune to every compositor/layer mis-scale */
  if(rest){e.style.left=x.toFixed(1)+'px';e.style.top=y.toFixed(1)+'px';e.style.transform='';}
  else{
    /* a card parked by left/top (the deck's rest pose) hands its spot to
       a transform first, frozen: left/top snaps, only transform
       transitions — without this the flight starts at the top-left
       corner. Rest cards sit exactly on the deck, so that is the anchor.
       Read the pose off the inline styles, never the .flat flag:
       stripStates drops it before place() runs in the deck loop, which
       is exactly the road Tell's revealed top takes out of rest */
    if(!e.style.transform&&e.style.left&&e.style.left!=='0px'){
      e.style.transition='none';
      e.style.transform=`translate(${DX}px,${DY}px)`;
      void e.offsetWidth;
      e.style.transition='';
    }
    e.style.left='0px';e.style.top='0px';
    e.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`+(sc?` scale(${sc})`:'');}
  e._sx=x;e._sy=y;e._sr=rest?0:rot;e._sz=z;   /* the sway loop rebuilds around this spot */
  e._pt=performance.now();   /* the placement's flight starts now: the glide's wake stands off a card still travelling */
  /* geometry armor: the box itself is stamped inline-important, so no
     stylesheet rule (var drift, min-width, aspect-ratio, another !important)
     can ever render a card at the wrong proportions */
  const s=e.style;
  s.setProperty('width',CUR_CW+'px','important');
  s.setProperty('height',CUR_CH+'px','important');
  s.setProperty('min-width','0','important');
  s.setProperty('min-height','0','important');
  s.setProperty('aspect-ratio','auto','important');
  s.setProperty('--cw',CUR_CW+'px','important');
  s.setProperty('--ch',CUR_CH+'px','important');
  e.style.zIndex=z;e.classList.toggle('faceup',!!up);e.classList.toggle('out',!!out);
  e.classList.toggle('flat',!!rest);   /* place() owns the flag: any placement off the deck un-flats it, so the draw flip always plays */
}
const stripStates=e=>e.classList.remove('bust','fl0','armed','live','flx','off','buried','chg','flat','boom3','dud');
function buildFelt(){
  $('#felt').insertAdjacentHTML('beforeend',
   `<div id="glow"></div><div id="glowP"></div><div id="vig"></div><div id="glowG"></div>
    <div class="slot" id="slotD"></div><div class="slot" id="slotO"></div><div class="slot" id="slotX"></div>
    <div id="ring"><div id="ringIn"></div></div>
    <svg id="wardR"></svg>
    <div id="deckN" title="cards left in the deck"></div>
    <div class="tok cnt" id="tkO"></div><div class="tok cnt" id="tkX"></div>
    <div id="pileTip"></div><div id="chTip"></div>
    <div class="tok ch" id="tkC">CHAIN</div>
    <div id="buffW"><div id="buffs"></div><div id="buffTip"></div></div>
    <div id="chev"><span>&#9650;</span></div><div id="dz"></div>
    <div id="stkTip"></div>`);
}
/* ---- sticker tag: point the mouse at a stickered card and a
   neumorphic label with its name: desc fades in at one fixed spot —
   centered on the felt just below the card row, the same place for
   every card. Bonus stickers add a gold second line: the bonus they
   are giving right now ---- */
let stkTipId=null;
const stkNow=(c,h)=>{
  const s=STK[c.stk].cur&&h?STK[c.stk].cur(c,h):'';
  return s?`<br><span class="now">${s}</span>`:'';
};
/* the card's full worth — the same layer handParts pays. The hover-safe
   context: no hand means no prime twins, no table max, no floats */
function worthCtx(c,h){
  const ids=h?h.ids:[c.id];
  let prime=0;for(const id of ids)if(byId(id).stk==='prime')prime++;
  if(c.stk==='prime')prime--;
  return{maxV:Math.max(...ids.map(id=>cval(byId(id)))),
         prime:Math.max(0,prime)*ECO.PRIME_ADD,
         fl:h?h.run.floated:[]};
}
const worthOf=(c,h)=>cardValue(c,worthCtx(c,h));
/* the plain-card movers, only the ones that fired — a sticker's own line
   already explains its layer */
function valWhy(c,h){
  const w=[],fl=h?h.run.floated:[];
  if(c.dud)return'dud';
  if(fl.indexOf(c.id)>=0)return'already paid';
  if(c.boom3)w.push('Odds ×'+ECO.ODDS_X);
  if(c.r)w.push('+'+(c.r*6)+'% a mark');
  if(!c.stk){
    let v=cval(c)*(1+.06*(c.r||0))*(c.boom3?ECO.ODDS_X:1);
    const hi=L('high'),de=L('deep');
    if(v>=8&&hi){v*=1+.15*hi;w.push('high ×'+(1+.15*hi).toFixed(2));}
    if(v>=14&&de)w.push('deep ×'+(1+.2*de).toFixed(2));
  }
  return w.join(' · ');
}
const stkTipText=(c,h)=>{
  let s=c.stk?`<b>${STK[c.stk].n}</b>: ${STK[c.stk].d}${c.osk?' · borrowed, till it leaves the table':''}${stkNow(c,h)}`:'';
  /* the card's conditions ride under the sticker text, a hairline
     between: one line per condition, the same words the tag wears */
  if(Array.isArray(c.cond)&&c.cond.length){
    const lines=c.cond.filter(k=>COND[k]).map(k=>COND[k].n.toUpperCase()+': '+COND[k].d);
    if(lines.length)s+=`${s?'<br>':''}<span class="cndline"></span><span class="cndtip">${lines.join('<br>')}</span>`;
  }
  const w=worthOf(c,h);
  if(Math.abs(w-cval(c))>.005){
    const why=valWhy(c,h);
    s+=`${s?'<br>':''}<span class="now">worth ${fmt(w)}${why?' · '+why:''}</span>`;
  }
  return s;
};
/* the tag gate: every stickered card, every conditioned card, plus any
   plain card whose worth has moved off the printed number */
const tipOn=(c,h)=>!!c.stk||!!(c.cond&&c.cond.length)||Math.abs(worthOf(c,h)-cval(c))>.005;
function stkTipShow(e){
  const ce=e.target.closest('.card.faceup'),c=ce&&byId(+ce.dataset.cid);
  const h=c&&S.hands.find(x=>x.ids.indexOf(c.id)>=0);
  if(!c||Views.swiping||!tipOn(c,h))return stkTipHide();
  stkTipId=c.id;
  const t=$('#stkTip');
  t.innerHTML=stkTipText(c,h);
  t.classList.add('on');
  if(c.stk)swayStart(c.id);
}
/* layout runs after every draw, so the open tag restates its numbers
   instead of dying: parked on a card with auto-draw on, you watch the
   live line climb. A card that left the tables takes the tag with it */
function stkTipRefresh(){
  if(stkTipId==null)return;
  const c=byId(stkTipId),h=c&&S.hands.find(x=>x.ids.indexOf(c.id)>=0);
  if(!c||Views.swiping||!tipOn(c,h))return stkTipHide();
  $('#stkTip').innerHTML=stkTipText(c,h);
}
function stkTipHide(){stkTipId=null;const t=$('#stkTip');if(t)t.classList.remove('on');swayStop();}
/* ---- buff bar: live state on the focused table, RPG style — one
   plaque on the felt's top right, one tight row of icons. Only what is
   pending or standing: armed tricks lead (they fire on the next draw),
   then the draw window — Stakes repeats one icon per round it has
   left, five or more collapse into a number and one icon; Anchor's
   guard does the same per draw it has left —
   then the standing buffs (AURA below: Haste, Beacon, Purify).
   Grace's wards stay off the bar: they are the steady rings around the
   table already, and the gauge reads them as insured. Other stickers
   don't get an icon: they are card properties, and their numbers live
   on the card tag and the terms readout. Mouse hover raises the
   sticker tag's twin at one fixed spot under the plaque ---- */
/* the standing buffs: rules that run while the card sits on a table —
   speed, premium, immunity. Haste rides any table at once (it bends
   the shared cooldown). Anchor is not standing: it guards a window of
   draws, so it reads in the countdown group below */
const AURA={haste:1,beacon:1,purify:1};
const q=s=>s.replace(/"/g,'&quot;');
function buffTipHTML(k,mode,n){
  const a=STK[k];
  if(mode==='armed')return `<b>${a.n}</b> · armed — ${a.d.replace(/^Arm: /,'')}`;
  if(mode==='stakes')return `<b>${a.n}</b> · draws pay double premium — <b>${n}</b> left`;
  if(mode==='guard')return `<b>${a.n}</b> · a drawn twin slips back into the deck — <b>${n}</b> draw${n===1?'':'s'} left`;
  if(mode==='grace')return `<b>${a.n}</b> · the next busting draw benches in the discard — <b>${n}</b> left`;
  if(mode==='cullward')return `<b>${a.n}</b> · the ward holds <b>${n}</b> more draw${n===1?'':'s'} — a busting one benches in the discard`;
  return `<b>${a.n}</b>: ${a.d.replace(/\.$/,'')}${n>1?` — <b>×${n}</b> here`:''}`;
}
function buffChip(k,mode,n){
  /* Cull's ward: one glyph, never repeated, with the dash countdown —
     big dashes at 3 draws, small at 2, dots on the last */
  if(mode==='cullward'){
    const tip=q(buffTipHTML(k,mode,n));
    return `<div class="bf cward wd${n}" data-tip="${tip}">${stkIcon(k)}<i class="cwd"></i></div>`;}
  const big=n>=5,reps=big?1:n,tip=q(buffTipHTML(k,mode,n));
  let out='';
  for(let i=0;i<reps;i++)
    out+=`<div class="bf" data-tip="${tip}">${big?`<b>${n}</b>`:''}${stkIcon(k)}</div>`;
  return out;
}
function paintBuffs(){
  const B=$('#buffs');if(!B)return;
  const F=S.hands[Math.min(S.focus,S.hands.length-1)],r=F.run,chips=[];
  if(r.armedF!=null)chips.push(['float','armed',1]);
  if(r.stakesD>0)chips.push(['stakes','stakes',r.stakesD]);
  (r.anchWin||[]).forEach(w=>{if(w.left>0)chips.push(['anchor','guard',w.left]);});
  if(r.cullWard>0)chips.push(['cull','cullward',r.cullWard]);
  if(r.grace>0)chips.push([r.graceVia||'ward','grace',r.grace]);
  const cnt={};
  F.ids.forEach(id=>{const s=byId(id).stk;if(s&&AURA[s])cnt[s]=(cnt[s]||0)+1;});
  if(!cnt.haste&&S.hands.some(h=>h.ids.some(id=>byId(id).stk==='haste')))cnt.haste=1;
  STKKEYS.forEach(k=>{if(cnt[k])chips.push([k,'aura',NONSTACK[k]?1:cnt[k]]);});
  const key=chips.map(c=>c.join(':')).join('|');
  if(B.dataset.b===key)return;
  B.dataset.b=key;
  buffTipHide();                     /* rebuilt under the cursor: the tag must not lie */
  if(tipPin==='buff')tipPin=null;    /* a rebuilt bar tells a new story: the pin dies with it */
  B.innerHTML=chips.map(c=>buffChip(c[0],c[1],c[2])).join('');
}
function buffTipShow(e){
  if(Views.swiping)return buffTipHide();
  const el=e.target.closest('.bf');if(!el)return buffTipHide();
  const t=$('#buffTip');t.innerHTML=el.dataset.tip;t.classList.add('on');
}
function buffTipHide(force){if(!force&&tipPin==='buff')return;
  const t=$('#buffTip');if(t)t.classList.remove('on');}
/* ---- tap-pin: one tooltip may be pinned at a time ----
   The felt's hoverables answer a tap the way they answer a hover — the
   pill rises and STAYS (touch has no hover to lose). A second tap, a
   tap elsewhere, or opening another tip lets it down. Cards never
   join: their tap acts, their long-press tells the story */
let tipPin=null;   /* 'buff' | 'slotX' | 'tkC' */
const TIP_HIDE={buff:()=>buffTipHide(true),slotX:()=>pileTip(false,true),tkC:()=>chainTip(false,true)};
function pinTip(k){
  if(tipPin===k){tipPin=null;TIP_HIDE[k]();return false;}   /* the second tap lets it down */
  if(tipPin)TIP_HIDE[tipPin]();
  tipPin=k;return true;
}
function unpinTip(){if(tipPin)pinTip(tipPin);}
/* ---- sticker sway: a hovered card that can still be triggered (a
   charged trick, .live) never sits still — it drifts back and forth
   on two overlapping sines while leaning left and right on two more,
   so the path never quite repeats. Each card rides its own phase (its
   slot in the chain), and the loop rewrites the whole card transform,
   outline and halo included. The card also rises to the top of the
   pile while swaying; armed, spent and passive cards keep still ---- */
let swayId=null,swayRAF=0;
function swayFrame(t){
  const e=els[swayId];
  /* the card went still under the cursor (armed, spent, frozen):
     land it back on its rest pose, the tag stays up */
  if(!e||e._sx==null||!e.classList.contains('live')){swayStop();return;}
  const ph=(+e.dataset.cid)*2.4;   /* each card its own phase in the chain */
  const dx=Math.sin(t*.0011+ph)*2+Math.sin(t*.0019+ph*1.7)*1;       /* ±3px wander */
  const dy=Math.cos(t*.0008+ph*2.1)*1.2;                            /* soft breathe */
  const dr=Math.sin(t*.00073+ph)*2.4+Math.sin(t*.00151+ph*2.9)*1.8; /* ±~4° lean */
  e.style.transform=`translate(${(e._sx+dx).toFixed(2)}px,${(e._sy+dy).toFixed(2)}px) rotate(${(e._sr+dr).toFixed(2)}deg)`;
  swayRAF=requestAnimationFrame(swayFrame);
}
function swayStart(id){
  const e=els[id];
  if(!e||!e.classList.contains('live'))return;   /* only armable tricks sway */
  if(swayId===id)return;
  swayStop();
  if(fanHeld(id))return;   /* the fan owns this card */
  if(e._sx==null)return;
  swayId=id;e.style.zIndex=930;
  swayRAF=requestAnimationFrame(swayFrame);
}
function swayStop(){
  if(swayRAF)cancelAnimationFrame(swayRAF);
  swayRAF=0;
  if(swayId==null)return;
  const e=els[swayId];swayId=null;
  if(!e||e._sx==null)return;
  e.style.zIndex=e._sz;
  e.style.transform=`translate(${e._sx.toFixed(1)}px,${e._sy.toFixed(1)}px) rotate(${e._sr.toFixed(1)}deg)`;
}
/* armed tricks glow, spent ones dim, charged ones wear the halo — per
   hand. A live aim (Clip/Ghost) rings the carrier solid blue and every
   other card on its table dashed */
function stickerStates(){
  S.hands.forEach(h=>{const r=h.run;
    const isArmed=id=>r.armedF===id
      ||r.stakesIds.indexOf(id)>=0;
    const aH=aim?S.hands.find(x=>x.ids.indexOf(aim.id)>=0):null;
    h.ids.forEach(id=>{const c=byId(id),e=els[id];if(!e)return;
      e.classList.toggle('fl0',r.floated.indexOf(id)>=0);
      e.classList.toggle('aim',!!aH&&aH===h&&id!==aim.id);
      e.classList.toggle('aims',!!aim&&aim.id===id);
      const used=r.spent.indexOf(id)>=0;
      if(c.stk==='flinch'){   /* the gold edge, never the raise: spent = ring off, sticker faded */
        e.classList.toggle('flx',!used);setUsed(c,used);return;}
      if(!TRICK[c.stk]){e.classList.remove('chg');return;}
      const a=isArmed(id);
      e.classList.toggle('chg',!used);   /* charged: the halo + the second line */
      e.classList.toggle('armed',a);
      e.classList.toggle('live',!a&&!used&&!frozen);
      setUsed(c,used&&!a);});
  });
}
function layout(){
  stkTipRefresh();   /* cards move or leave — a stale tag restates or dies */
  const Fd=$('#felt');FW=Fd.clientWidth;FH=Fd.clientHeight;if(!FW)return;
  const n=Math.min(S.hands.length,5),k=deskK(),sc=HAND_SC[n-1]*k;
  /* onboarding: the deck dealt out on the felt at full card size —
     the rows are allowed to lean on each other. The fan-out waits for
     the first-load title to let go of the felt */
  const pyr=S.tut==='pyramid'&&!ttlAlive();
  Fd.classList.toggle('pyr',pyr);
  Fd.classList.toggle('tut',!!S.tut&&S.tut!=='done');
  Fd.style.setProperty('--cw',(54*sc).toFixed(1)+'px');
  Fd.style.setProperty('--ch',(76*sc).toFixed(1)+'px');
  CUR_CW=+(54*sc).toFixed(1);CUR_CH=+(76*sc).toFixed(1);
  const cw=54*sc;
  DX=FW/2;DY=FH-50*k;
  /* piles hug the bottom corners at the phone's proportions — but at
     wide the cards are big enough to kiss the felt's border, so the
     corner inset rides k. Below wide the constant 40 stands as always */
  const pins=isWide()?40*k:40;
  OX=pins;OY=FH-50*k;CX=FW-pins;   /* OUT left, SET right */
  const T=(el,x,y,c)=>{const e=$(el);if(e)e.style.transform=`translate(${x}px,${y}px)`+(c?' translate(-50%,-50%)':'');};
  T('#dz',DX,DY);T('#ring',DX,DY);T('#slotD',DX,DY);T('#slotO',OX,OY);T('#slotX',CX,OY);
  reparkStash();   /* stashed cards ride the anchor too, place() skips its leased ones */
  /* the pile furniture gets the same armor: the slots and the cooldown
     ring are sized in px from this frame's card size, inline-important */
  ['#slotD','#slotO','#slotX'].forEach(sl=>{const e=$(sl);if(!e)return;
    e.style.setProperty('width',CUR_CW+'px','important');
    e.style.setProperty('height',CUR_CH+'px','important');
    e.style.setProperty('margin-left',(-CUR_CW/2)+'px','important');
    e.style.setProperty('margin-top',(-CUR_CH/2)+'px','important');
    e.style.setProperty('aspect-ratio','auto','important');});
  const rg=$('#ring');
  if(rg){rg.style.setProperty('width',(CUR_CW+10)+'px','important');
    rg.style.setProperty('height',(CUR_CH+10)+'px','important');}
  T('#chev',DX,DY-56*k);T('#deckN',DX+cw/2-3,DY-38*sc+4,1);T('#tkO',OX,OY+38*k,1);T('#tkX',CX,OY+38*k,1);
  /* the chain token hugs its corner — edge-anchored, so a wide label
     can never hang off the felt; the buff stack holds the top right */
  const tkc=$('#tkC');
  if(tkc)tkc.style.transform='translate(14px,20px) translateY(-50%)';
  const culled=S.hands.reduce((a,h)=>a+h.run.culled.length,0)+(S.disc?S.disc.length:0);
  $('#deckN').textContent=S.deck.length;
  /* the piles speak in bare amounts — a lone card is its own count */
  $('#tkO').textContent=S.out.length;
  $('#tkO').classList.toggle('off',S.out.length<2);
  $('#tkX').textContent=culled;
  $('#tkX').classList.toggle('off',culled<2);
  $('#slotX').style.opacity=culled?.9:.25;
  const F=S.hands[Math.min(S.focus,S.hands.length-1)];
  /* the chain counter shows the tick's price: one dot per card the next
     tick wants (chainReq), filled by what's on the table. A short hand
     presses the chip darker — the combo will not tick on this bank */
  const creq=chainReq(F.chain),have=F.ids.length;
  /* an open chain tag restates its numbers here: layout runs after every
     draw, so hovering with auto-draw on watches the live line climb */
  const ct=$('#chTip');if(ct&&ct.classList.contains('on'))ct.innerHTML=chainTipText(creq);
  if(!F.chain&&have>=creq){$('#tkC').classList.add('off');}
  else{
    let dots='';for(let i=0;i<creq;i++)dots+=`<i class="${i<Math.min(have,creq)?'on':''}"></i>`;
    $('#tkC').innerHTML=`CHAIN <b>${F.chain}</b>${dots}`;
    $('#tkC').classList.toggle('short',have<creq);
    $('#tkC').classList.remove('off');
  }
  $('#slotO').style.opacity=S.out.length?.9:.35;

  /* hands: one band each, sharing the felt above the deck. Charged
     tricks keep their fan slot but ride a touch low; spent, they rise
     back into the line — the order never shuffles */
  let low=0;   /* the row's lowest edge: the sticker tag hangs just below it */
  const top=Math.max(38*k,FH*.05),bot=FH-116*k,bandH=Math.max(64,(bot-top)/S.hands.length);
  S.hands.forEach((h,i)=>{
    const foc=S.hands.length>1&&i===S.focus,r=h.run;
    const sorted=[...h.ids].sort((a,b)=>{const A=byId(a),B=byId(b);return A.v-B.v||A.id-B.id;});
    const m=sorted.length;if(!m)return;
    const kmax=Math.max(3,Math.floor((FW-16-cw)/12)+1);
    const rows=Math.max(1,Math.ceil(m/kmax)),per=Math.ceil(m/rows);
    const yc=top+i*bandH+bandH/2,rowH=76*sc*.6;
    const bp=bustPair;
    sorted.forEach((id,j)=>{
      const rr=Math.floor(j/per),col=j%per,cnt=Math.min(per,m-rr*per);
      const sp=cnt>1?Math.min(cw*.72,(FW-16-cw)/(cnt-1)):0;
      const dn=TRICK[byId(id).stk]&&r.spent.indexOf(id)<0?12*sc:0;
      let x=FW/2-(cnt-1)*sp/2+col*sp,y=yc+(rr-(rows-1)/2)*rowH+dn,rot=byId(id).j*3,z=100+i*40+j;
      if(bp&&id===bp[0]){x+=18*sc;y-=16*sc;rot=11;z=940;}
      const e=els[id];
      if(e)e.classList.toggle('bust',!!(bp&&(id===bp[0]||id===bp[1])));
      e&&e.classList.toggle('off',S.hands.length>1&&!foc);
      /* boardStash tucks dealt-in cards into the deck stack: once one sits
         in its hand slot, the stack's pale buried edge comes back off */
      if(e&&!fanHeld(id))e.classList.remove('buried');
      const yy=y-(foc?5:0);
      low=Math.max(low,yy+38*sc);
      place(id,x,yy,rot,true,z);
      /* the card to the right rides on top of this one's edge, and a
         row below leans over its foot: stickers slide clear of both */
      if(e&&!fanHeld(id))stkReveal(e,CUR_CW,CUR_CH,col<cnt-1?Math.max(0,cw-sp):0,rr<rows-1?CUR_CH-rowH:0,0);
    });
  });
  $('#felt').style.setProperty('--tipY',low?(low+7).toFixed(1)+'px':'58%');
  /* a card bought away from the table gets its moment first: it shows
     itself on the felt, then throws itself into the deck */
  if(newIns.length){
    const due=newIns.filter(id=>S.deck.includes(id)&&els[id]);
    newIns=[];
    due.forEach((id,k)=>{
      const sx=FW/2+(k-(due.length-1)/2)*64,sy=Math.max(52,FH*.38);
      place(id,sx,sy,0,true,960);
      fanHold(id,950+k*340+4000);   /* covers the show-off pause plus its flight */
      setTimeout(()=>{fanBusy.delete(id);
        if(els[id]&&S.deck.includes(id))fanHome([{id,x:sx,y:sy}]);
        else layout();},950+k*340);
    });
  }
  if(S.showTop!=null&&S.deck.indexOf(S.showTop)<0)S.showTop=null;
  if(pyr){
    /* the whole deck on display: the three 3s, then the 2s, then the 1 —
       rows close enough to lean on each other. Mid-deal, the cards still
       waiting drain in the deck's own rest pose */
    const rows=[[],[],[]];
    S.deck.forEach(id=>rows[byId(id).v>=3?0:byId(id).v===2?1:2].push(id));
    const gapX=cw+5,gapY=Math.min(46,FH*.15),y0=FH/2-gapY;
    rows.forEach((row,r)=>row.forEach((id,j)=>{
      if(pyrUndealt.indexOf(id)>=0)return;   /* still in the stack */
      const e=els[id];if(!e)return;
      stripStates(e);e.classList.remove('buried');
      place(id,FW/2+(j-(row.length-1)/2)*gapX,y0+r*gapY,byId(id).j*5,true,120+r*12+j);
    }));
    /* the waiting stack: dealt from the top, so it keeps the deck's
       edge treatment as it drains */
    pyrUndealt.forEach((id,k)=>{
      const e=els[id];if(!e)return;
      stripStates(e);
      e.classList.toggle('buried',k<pyrUndealt.length-1);
      place(id,DX,DY,0,false,10+pyrUndealt.length-1-k,false,null,true);
    });
  }else{
    /* early lifts parked on the felt still hold the deck's top seats
       logically, but the visible stack drains without them: the working
       top below wears the full edge, and no reveal (Vantage, Tell) may
       read past a lifted card while it waits */
    const lifted=preDrops.length>0,
          dlist=lifted?S.deck.filter(id=>!preDrops.includes(id)):S.deck;
    dlist.forEach((id,i)=>{
      if(fanHeld(id))return;   /* mid-flight: the tween owns this card */
      const k=dlist.length-1-i,e=els[id];
      const top=k===0&&!lifted&&(topFaceUp()||id===S.showTop||cardHas(byId(id),'glass'));
      if(e)stripStates(e);   /* place() below owns the .flat rest flag */
      if(e&&!fanHeld(id))e.classList.toggle('buried',k>0);   /* only the top card wears its full edge */
      /* dead flat: one card looks like one card; the jiggle sells the stack */
      place(id,DX,DY,0,top,10+i,false,null,true);
    });
  }
  /* piles: a tap fans one out along the top for browsing — a shallow
     arc, belly toward the felt — until the next tap sends it back.
     The bench is one stack: Cull's set-asides and Ward's saves share
     the bottom-right slot, both home when you score. Both away piles
     read sorted, low card first */
  const byV=(a,b)=>byId(a).v-byId(b).v||a-b;
  const cull=culledAll().concat(S.disc||[]).sort(byV);
  const outl=[...S.out].sort(byV);
  if(fanZone&&(fanZone==='out'?outl:cull).length<2)fanZone=null;
  if(fanZone){
    const list=fanZone==='out'?outl:cull,n=list.length;
    const span=Math.min(FW-40,Math.max((n-1)*cw*.66,0));
    const fy=Math.max(76*sc/2+8,FH*.12);
    list.forEach((id,i)=>{
      const e=els[id];if(!e)return;
      stripStates(e);e.classList.add('fan');
      const u=n>1?(i/(n-1))*2-1:0;   /* -1..1 across the fan */
      place(id,FW/2+u*span/2,fy+u*u*14,u*10,true,800+i,false);
      if(fanHov===id)e.style.zIndex=960;
      /* each card's right edge hides under the next one out */
      if(!fanHeld(id))stkReveal(e,CUR_CW,CUR_CH,i<n-1?Math.max(0,CUR_CW-span/(n-1)):0,0,0);
    });
  }
  /* a pile of two to four leans out of its slot as a vertical fan —
     face up, deep enough to read the digits, lifted clear of its
     number; hover brings a card to the front of its pile. A bigger
     pile collapses into a standing stack, still face up. Sorted low
     first, and low wears the top seat: the topmost lean and the face
     the collapsed stack shows are both the pile's lowest card */
  const small=n=>n>=2&&n<=4;
  const vy=(base,n,i)=>small(n)?base-9-(n-1-i)*Math.min(56,160/(n-1)):base-Math.min(n-1-i,7)*.9;
  const vr=(n,i,j)=>small(n)?(i-(n-1)/2)*7+j*3:j*6;
  /* leaning piles: the card above covers this one's top; the collapsed
     stack shows only its top card — both cut to nothing, which restores
     the sticker's placed pose in open air */
  const lean=(id,n,i)=>{const e=els[id];
    if(e&&!fanHeld(id))stkReveal(e,CUR_CW,CUR_CH,0,0,small(n)&&i?Math.max(0,CUR_CH-Math.min(56,160/(n-1))):0);};
  if(fanZone!=='out')outl.forEach((id,i)=>{const e=els[id];e&&stripStates(e);
    if(e)e.classList.toggle('fan',small(outl.length));
    place(id,OX,vy(OY,outl.length,i),vr(outl.length,i,0),true,10+(outl.length-1-i),!small(outl.length));
    lean(id,outl.length,i);});
  if(fanZone!=='culled')cull.forEach((id,i)=>{const e=els[id];e&&stripStates(e);
    if(e)e.classList.toggle('fan',small(cull.length));
    place(id,CX,vy(OY,cull.length,i),vr(cull.length,i,0),true,10+(cull.length-1-i),!small(cull.length));
    lean(id,cull.length,i);});
  stickerStates();
}
/* ---------------- the pyramid deal ---------------- */
/* the title's click releases the opening: the deck deals itself out
   onto the felt one card at a time, descending (the 3s lead, the 1
   closes), each flight carried by place()'s rest-departure transition.
   A tap while the deal runs queues the sweep, so a fast double-click
   still lands both halves in order */
let pyrUndealt=[],pyrQueue=false,pyrDealT=0;
/* arming just populates the deal order: the draw holds from the moment
   the title's fade begins, the cards flow at the halfway mark */
function pyrArm(){
  if(S.tut!=='pyramid'||!S.deck.length)return;
  clearTimeout(pyrDealT);
  pyrUndealt=S.deck.slice().sort((a,b)=>byId(b).v-byId(a).v||a-b);
}
function pyrDealGo(){
  pyrArm();
  if(!pyrUndealt.length)return;
  pyrStep();
}
function pyrStep(){
  if(!pyrUndealt.length)return;
  const pid=pyrUndealt.shift(),pv=byId(pid).v;   /* the deal sings its way down the values */
  layout();               /* the card's pyramid slot lifts it out of the stack */
  SFX.draw(pv);buzz(8);
  setTimeout(()=>SFX.land(pv),165);
  if(pyrUndealt.length)pyrDealT=setTimeout(pyrStep,150);
  else pyrDealT=setTimeout(()=>{   /* let the last card land first */
    if(pyrQueue){pyrQueue=false;tutEvent('gather');}
  },430);
}
/* every tap on the opening table routes here: the first releases the
   title (the deal steps in under its fade), one mid-deal queues the
   sweep, the next runs it */
function pyrTap(){
  if(ttlAlive()){ttlClick();return;}
  if(pyrUndealt.length){pyrQueue=true;return;}
  tutEvent('gather');
}
/* ---------------- the board deal ---------------- */
/* the title screen's dismissal deals the whole board back out of the
   deck: boardStash parked every non-deck card in the stack — the boot
   one lays them there instantly under the entrance, the idle one
   sweeps them home face-down — and the deal releases those leases one
   card at a time, place()'s rest-departure transition flying each to
   its spot with its flip */
const dealIds=()=>{
  const byV=(a,b)=>byId(a).v-byId(b).v||a-b;
  const order=S.hands.map((h,i)=>i)
    .sort((a,b)=>a===S.focus?-1:b===S.focus?1:a-b);   /* focused hand first */
  return order.flatMap(i=>[...S.hands[i].ids].sort(byV))
    .concat([...S.out].sort(byV),culledAll().concat(S.disc||[]).sort(byV));
};
let boardDealT=[],boardStashT=[],boardDealing=false;
/* cards tucked into the deck by a stash hold a forever lease, so place()
   skips them — their park must track the deck anchor by hand, or a reflow
   under the title (the autos row filling at boot, a resize) leaves them
   peeking out of the stack's bottom */
const stashParked=new Set();
function reparkStash(){
  const x=DX.toFixed(1)+'px',y=DY.toFixed(1)+'px';
  stashParked.forEach(id=>{const e=els[id];if(!e)return;
    if(e.style.transform){
      const t=`translate(${x},${y})`;
      if(e.style.transform!==t){e.style.transition='none';e.style.transform=t;
        void e.offsetWidth;e.style.transition='';}}
    else if(e.style.left!==x||e.style.top!==y){e.style.left=x;e.style.top=y;}
  });
}
function boardStash(anim){
  const ids=dealIds();
  const gap=Math.max(36,Math.min(110,1500/Math.max(1,ids.length)));
  ids.forEach((id,i)=>{
    const e=els[id];if(!e)return;
    fanHold(id,1e9);                     /* the deal releases it, nothing else */
    if(!anim){                           /* boot: straight into the deck's rest pose */
      e.style.transition='none';
      e.style.left=DX.toFixed(1)+'px';e.style.top=DY.toFixed(1)+'px';
      e.style.transform='';e.style.zIndex=9;
      stripStates(e);
      e.classList.remove('faceup');e.classList.add('flat','buried');
      void e.offsetWidth;e.style.transition='';
      stashParked.add(id);
      return;}
    boardStashT.push(setTimeout(()=>{   /* idle: fly home face-down, tuck under */
      if(!ttlUp)return;                 /* dismissed mid-sweep: the deal owns the board */
      e.style.zIndex=900;
      e.classList.remove('faceup');
      e.style.transform=`translate(${DX.toFixed(1)}px,${DY.toFixed(1)}px)`;
      stashParked.add(id);
      boardStashT.push(setTimeout(()=>{if(ttlUp)e.style.zIndex=9;},430));
    },i*gap));
  });
}
function boardDeal(){
  boardStashT.forEach(clearTimeout);boardStashT=[];
  boardDealT.forEach(clearTimeout);boardDealT=[];
  const ids=dealIds();
  if(!ids.length){ttlDriftFade();return;}
  /* dismissed onto a hidden table (another tab up): release everything
     and let the tab's return layout place it, no stagger to wait out */
  if(!$('#felt').clientWidth){
    ids.forEach(id=>{fanBusy.delete(id);stashParked.delete(id);});layout();
    boardDealing=false;ttlDriftFade();return;}
  boardDealing=true;   /* the draw holds until the board has dealt out */
  const gap=Math.max(36,Math.min(110,1500/ids.length));
  ids.forEach((id,i)=>boardDealT.push(setTimeout(()=>{
    fanBusy.delete(id);stashParked.delete(id);
    layout();               /* its slot lifts it out of the deck, flip and all */
    SFX.draw(byId(id).v);
  },180+i*gap)));
  boardDealT.push(setTimeout(()=>{
    SFX.shuffle();boardDealing=false;
    stashParked.clear();
    ttlDriftFade();   /* the board is out: the drift sinks away */
  },180+ids.length*gap+240));
}
/* ---- pile fans ----
   the OUT and SET stacks read as piles; tap one and its cards glide up
   to the top in a fan, face up, to be read one by one — hover lifts a
   card above its neighbors, another tap (anywhere) glides them back.
   The SET stack is the bench: set-asides and ward saves together */
let fanZone=null,fanHov=null;
const culledAll=()=>S.hands.reduce((a,h)=>a.concat(h.run.culled),[]);
const pileOf=id=>S.out.indexOf(id)>=0?'out'
  :culledAll().indexOf(id)>=0||(S.disc&&S.disc.indexOf(id)>=0)?'culled':null;
function setFan(z){fanZone=z===fanZone?null:z;fanHov=null;layout();
  /* the piles' first fan-open is the curiosity moment: one poster
     names the pile and its return rule (a mid-chain tap stays armed,
     the coach owns that stretch) */
  if(fanZone==='out')coach('out');
  else if(fanZone==='culled')coach('disc');}
/* the empty bench's tag: the sticker tag's twin, pinned by the
   set-aside slot — hover it while nothing waits there and it names
   what the stack is for. Cards present, the pile speaks for itself */
function pileTip(on,force){
  const t=$('#pileTip');if(!t)return false;
  if(!on&&!force&&tipPin==='slotX')return false;   /* a pinned tag survives the pointer leaving */
  if(on&&culledAll().length+S.disc.length===0){
    t.innerHTML='<b>Set aside</b>: Ward saves and cuts wait here, home when you score';
    t.classList.add('on');return true;}
  t.classList.remove('on');return false;
}
/* the chain counter's twin: hover the token and the combo explains
   itself, req included. creq comes from the focused table's chain */
function chainTipText(creq){
  return `<b>Chain</b>: banks in a row without a bust, each one worth more with Chain Reaction`
    +`<br>Dots: the next bank needs <b>${creq}</b> cards on the table, +1 every 10 chain; a bank under the price loses 1 chain`;
}
function chainTip(on,force){
  const t=$('#chTip');if(!t)return false;
  if(!on&&!force&&tipPin==='tkC')return false;   /* a pinned tag survives the pointer leaving */
  if(on){
    const F=S.hands[Math.min(S.focus,S.hands.length-1)];
    t.innerHTML=chainTipText(chainReq(F.chain));t.classList.add('on');return true;}
  t.classList.remove('on');return false;
}

/* ---------------- ward rings ---------------- */
/* one blue ring around the deck per ward (safe pass). Idle rings sit
   still — nothing but a faint breath along the edge. Only when a ward
   breaks does its ring move: the consumed outer ring exhales outward,
   each point at its own pace, thickening, blurring and fading like a
   puff of smoke (redrawn every frame from the frame loop) */
const PPTS=40, WARD_T=900;                  /* one break animation, ms */
const pSpd=j=>1+Math.sin(j*12.9898)*.25;    /* steady per-point drift speed */
/* the standing rings repaint at ~30fps, not per frame: their live edge
   wobbles ±1px on slow sines and samples clean at half rate, while a
   break in flight always rides the full frame rate. pwKey holds the
   last steady geometry (ring count, scale, reduced-motion), so a real
   change paints on its own frame */
let pwT=0,pwKey=null;
function paintWard(now){
  const svg=$('#wardR');if(!svg)return;
  const F=S.hands[Math.min(S.focus,S.hands.length-1)];
  const g=F?F.run.grace:0;
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the consumed outermost ring (index g) plays the break, if one is young */
  const ph=(now-((F&&F.run.wardBreak)||-1e9))/WARD_T;
  const breaking=!still&&ph>=0&&ph<1;
  svg.classList.toggle('on',g>0||breaking);
  if(!g&&!breaking)return;
  const sc=HAND_SC[Math.min(S.hands.length,5)-1]*deskK();
  if(!breaking){
    const key=g+'|'+sc.toFixed(2)+(still?'|s':'');
    if(pwKey===key&&(still||now-pwT<33))return;
    pwKey=key;pwT=now;
  }else pwKey=null;
  let out='';
  if(breaking){
    /* grow, widen, blur, drift — then gone */
    const e=ph*ph*(3-2*ph),pts=[];
    for(let j=0;j<PPTS;j++){
      const a=j/PPTS*2*Math.PI;
      const w=e*16*pSpd(j)+Math.sin(now*.00091+j*2.4)*.6+Math.sin(now*.00189+j*1.3)*.4;
      pts.push((DX+Math.cos(a)*(27*sc+7+g*4+w)).toFixed(1)+','+(DY+Math.sin(a)*(38*sc+5+g*3+w*.8)).toFixed(1));
    }
    out=`<filter id="wB"><feGaussianBlur stdDeviation="${(e*2.6).toFixed(2)}"/></filter>`+
      `<polygon points="${pts.join(' ')}" filter="url(#wB)" stroke-width="${(1.5+e*2.2).toFixed(2)}"`+
      ` opacity="${((1-ph)*(0.85-.15*g)).toFixed(3)}"/>`;
  }
  for(let i=0;i<g;i++){
    const rx=27*sc+7+i*4,ry=38*sc+5+i*3,pts=[];
    for(let j=0;j<PPTS;j++){
      const a=j/PPTS*2*Math.PI;
      /* a faint sine keeps the edge alive; no drift, no fade while idle */
      const w=still?0:Math.sin(now*.00091+j*2.4+i*1.7)*.6+Math.sin(now*.00189+j*1.3+i*.9)*.4;
      pts.push((DX+Math.cos(a)*(rx+w)).toFixed(1)+','+(DY+Math.sin(a)*(ry+w)).toFixed(1));
    }
    out+=`<polygon points="${pts.join(' ')}" opacity="${(0.85-.15*i).toFixed(2)}"/>`;
  }
  svg.innerHTML=out;
}

/* ---------------- paint ---------------- */
/* paint() writes through a memo: an unchanged value never touches the
   DOM, so an idle table costs string work only — no mutation, no style
   recalc, no repaint. classList.toggle(bool) and same-value boolean
   property writes already no-op in the engine, so those stay bare */
const pmv={},
  pTxt=(id,v)=>{v=''+v;if(pmv['t'+id]===v)return;pmv['t'+id]=v;$('#'+id).textContent=v;},
  pHtml=(id,v)=>{v=''+v;if(pmv['h'+id]===v)return;pmv['h'+id]=v;$('#'+id).innerHTML=v;},
  pCls=(id,v)=>{if(pmv['c'+id]===v)return;pmv['c'+id]=v;$('#'+id).className=v;},
  pSt=(id,p,v)=>{v=''+v;const k='s'+id+'.'+p;if(pmv[k]===v)return;pmv[k]=v;$('#'+id).style[p]=v;};
function paint(){
  pTxt('hSc',fmt(S.score));pTxt('hSh',fmt(S.shards));
  pSt('hShW','display',(S.shards||S.shAll)?'block':'none');
  const F0=S.hands[Math.min(S.focus,S.hands.length-1)];
  /* the bust card never sat down: while its pair is up, the readout, the
     terms and the bank quote the standing hand only — the buster changes
     no table value, and busts pay nothing (the record reads by this rule) */
  const bid=bustPair&&F0.ids.indexOf(bustPair[0])>=0?bustPair[0]:null;
  const F=bid?{ids:F0.ids.filter(id=>id!==bid),run:F0.run,chain:F0.chain}:F0;
  /* the held breath: while the pair is up, every quoted number — total,
     premium, gauge, chain — replays the ghost captured the moment before
     the killer landed. The buster's own draw thinned the deck and broke
     the chain; neither may move a digit on the hand it killed */
  const g=bid?bustGhost:null;
  const P=handParts(F),r=g?g.th:threat(F0),
    prem=g?g.prem:riskPrem(F);
  const show=g?g.tot:P.total,chm=g?1+L('chain')*g.chain*chainRate(g.chain):chainMul(F);
  pTxt('rs',fmt(show));
  const T=[];
  if(F.ids.length){
    T.push(`<span class="tm">base <b>${fmt(P.base*valueMult())}</b></span>`);
    T.push(`<span class="tm">${F.ids.length} cards <b>×${handMult(F).toFixed(2)}</b></span>`);
    /* the gambles: what one clean hit adds to the mult, at what odds —
       bloom compounds with its own copy count */
    let bl=0,kd=0;
    for(const id of F.ids){const k=byId(id).stk;
      if(k==='bloom')bl++;else if(k==='kindle')kd++;}
    if(bl)T.push(`<span class="tm c">bloom <b>+${(ECO.BLOOM_PER*bl*bl*F.ids.length).toFixed(2)}× ${Math.round(ECO.BLOOM_CHANCE*100)}%</b></span>`);
    if(kd&&F.ids.length>1)T.push(`<span class="tm c">kindle <b>+${(ECO.KINDLE_PER*kd*(F.ids.length-1)).toFixed(2)}× ${Math.round(ECO.KINDLE_CHANCE*100)}%</b></span>`);
    if(chm>1.001)T.push(`<span class="tm c">chain <b>×${chm.toFixed(2)}</b></span>`);
    if(prem>1.001)T.push(`<span class="tm h">nerve <b>×${prem.toFixed(2)}</b></span>`);
    if(F.run.stakesD)T.push(`<span class="tm h">stakes <b>×2 ${ic('chev')}${F.run.stakesD}</b></span>`);
    if(F.run.floated.length)T.push(`<span class="tm">floated <b>${F.run.floated.length}×0</b></span>`);
    if(overMul(F)>1)T.push(`<span class="tm c">overload <b>×${overMul(F).toFixed(2)}</b></span>`);
    if(F.run.rebound)T.push(`<span class="tm c">rebound <b>×${(1+.12*M('rebound')).toFixed(2)}</b></span>`);
    if(P.led>1.001)T.push(`<span class="tm c">books <b>×${P.led.toFixed(2)}</b></span>`);
    const shn=shinyN(F);
    if(shn)T.push(`<span class="tm c">shiny <b>×${Math.pow(ECO.SHINY_X,shn).toFixed(2)}</b></span>`);
  }
  pHtml('terms',T.join(''));
  /* the shine record: most shinies ever held on one table at once */
  for(const h of S.hands){const n=shinyN(h);if(n>(S.st.bestShine||0))S.st.bestShine=n;}
  paintBuffs();
  tutPaint();
  const pct=(r*100).toFixed(0)+'%';
  pTxt('rkTx',pct);pTxt('rkTx2',pct);
  /* the fill rounds up past the RISK word: any risk at all fills wide
     enough to swallow the label clean, never a sliver behind half a letter */
  const rk=$('#rk'),rkf=$('#rkf'),rkc=$('#rkc'),lab=rk.querySelector('.rkl');
  const bw=rk.clientWidth,need=r>0&&bw>0?lab.offsetLeft+lab.offsetWidth+7:0;
  if(need){const w=Math.max(r*bw,need);
    pSt('rkf','width',w+'px');pSt('rkc','clipPath',`inset(0 calc(100% - ${w}px) 0 0)`);}
  else{pSt('rkf','width',pct);pSt('rkc','clipPath',`inset(0 calc(100% - ${pct}) 0 0)`);}
  pCls('rk',r>=.7?'x':r>=.45?'h':r>=.2?'m':'');
  pSt('glow','opacity',Math.max(0,r-.3)*1.2);
  /* the vignette tracks threat continuously; the red wash rides the heartbeat */
  pSt('vig','opacity',r<.45?0:Math.min(.5,(r-.45)*.85).toFixed(3));
  /* warmth follows the payout, not the danger: a fat premium warms the
     readout and the bank */
  $('#ro').classList.toggle('hot',prem>=1.6);
  $('#bank').classList.toggle('hot',prem>=1.6&&canBank(F));
  /* the two automation lines on the gauge: each takes the color its
     dial's fill is showing at the current setting */
  const zoneCol=v=>v>=70?'#8E2B1C':v>=45?'#B4551E':v>=20?'#8A6A2F':'#2C563C';
  const mk=$('#rkmark');
  if(L('abank')&&S.set.autoBank){pSt('rkmark','display','block');pSt('rkmark','left',S.set.risk+'%');
    mk.title='BANK LINE';pSt('rkmark','background',zoneCol(S.set.risk));}
  else pSt('rkmark','display','none');
  /* the stop line, where the deal refuses */
  const sm=$('#stopmark');
  if(sm){if(L('guard')&&S.set.autoDraw){const sv=Math.round(drawStop()*100);
      pSt('stopmark','display','block');pSt('stopmark','left',sv+'%');sm.title='STOP LINE';
      pSt('stopmark','background',zoneCol(sv));}
    else pSt('stopmark','display','none');}
  $('#bank').disabled=!canBank(F);
  pHtml('bankS',canBank(F)
    ?fmt(show)+(S.hands.length>1?`<i> · H${S.focus+1} · hold = bank all</i>`
      :(S.seen.swd?'':'<i class="touch-only"> · swipe down</i>'))
    :'');
  paintHRow();
  paintAutos();
}
/* the hand rail: one chip per table — cards, risk, chain; tap to focus */
function paintHRow(){
  const R=$('#hrow');if(!R)return;
  if(S.hands.length<2){if(R.innerHTML){R.innerHTML='';pmv['x-hrow']='';
    requestAnimationFrame(layout);}   /* the rail let go: the felt grew under stale anchors */
    return;}
  /* the first paint of a second table names the rail once; on a phone
     this waits for the TABLE visit, the chips live on the felt */
  if(tableUp())coach('split');
  const html=S.hands.map((h,i)=>{
    /* the busted hand mid-window quotes its ghost: the buster never sat
       down, so the chip holds the card count, gauge and chain it had */
    const gb=bustPair&&h.ids.indexOf(bustPair[0])>=0?bustGhost:null;
    const n=gb?h.ids.length-1:h.ids.length;
    const t=n?Math.round((gb?gb.th:threat(h))*100)+'%':'0%';
    const ch=gb?gb.chain:h.chain;
    return `<div class="hchip${i===S.focus?' on':''}" data-i="${i}"><b>H${i+1}</b> ${n}c ${t}${ch?' ·'+ch:''}</div>`;
  }).join('');
  /* same chips, same chips forever: the rail only mutates when its own
     output changed, so a steady multi-hand table costs one string build */
  if(pmv['x-hrow']===html)return;
  const was=R.innerHTML;
  pmv['x-hrow']=html;R.innerHTML=html;
  if(!was)requestAnimationFrame(layout);   /* the rail just took height: re-place the deck */
  R.querySelectorAll('.hchip').forEach(el=>el.onclick=()=>{S.focus=+el.dataset.i;layout();paint();});
}
function paintAutos(){
  const p=$('#autos');
  if(!L('auto')){if(p.innerHTML){p.innerHTML='';p.dataset.b='';
    requestAnimationFrame(layout);}   /* the row let go: the felt grew under stale anchors */
    return;}
  const k=L('auto')+'|'+L('abank')+'|'+L('guard');
  if(p.dataset.b!==k){p.dataset.b=k;
    /* the row takes its height after layout() measured the felt, so the
       deck's anchor is one row stale: re-place the bottom furniture */
    requestAnimationFrame(layout);
    /* the row is four divs: chip, toggle, chip, toggle. The chip body
       opens the AUTOMATION sheet; the toggle pad beside it flips the
       auto on the spot — pressed in and colored when on, flat gray
       when off */
    const carev='<svg class="tc" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5l6-6 6 6"/></svg>';
    const tgl=(id,on,kind,label)=>`<div class="atg ${kind}${on?' on':''}" id="${id}" role="switch"`
      +` aria-checked="${!!on}" aria-label="${label}" title="${label}"><i></i></div>`;
    p.innerHTML=`<div class="tg" id="tA" title="Automation"><span class="d"></span>AUTO-DRAW<b class="tv" id="hA"></b>${carev}</div>`
      +tgl('swD',S.set.autoDraw,'draw','Toggle auto-draw')
      +(L('abank')?`<div class="tg" id="tB" title="Automation"><span class="d"></span>AUTO-BANK<b class="tv" id="rv"></b>${carev}</div>`
        +tgl('swB',S.set.autoBank,'bank','Toggle auto-bank'):``);
    $('#tA').onclick=openAutoPanel;
    if(L('abank'))$('#tB').onclick=openAutoPanel;
    const bindSw=(id,key)=>{const el=$(id);if(el)el.onclick=()=>{
      S.set[key]=!S.set[key];buzz(10);save(true);paintAutos();};};
    bindSw('#swD','autoDraw');
    bindSw('#swB','autoBank');}
  $('#tA').classList.toggle('on',S.set.autoDraw);
  /* the two ways the deal stands down: a Tell-revealed bust (red HELD)
     and a table the stop line caught mid-fill (amber LINE). Both
     are the autos handing the table back to you */
  const held=S.set.autoDraw&&S.hands.some(h=>autoHolds(h));
  const line=S.set.autoDraw&&!held&&S.hands.some(h=>autoLineHeld(h));
  $('#tA').classList.toggle('held',held);
  $('#tA').classList.toggle('line',line);
  const swD=$('#swD');
  if(swD){swD.classList.toggle('on',S.set.autoDraw);swD.setAttribute('aria-checked',String(!!S.set.autoDraw));}
  const hA=$('#hA');if(hA)hA.textContent=held?'HELD':line?'LINE':'·'+L('auto');
  if(L('abank')){$('#tB').classList.toggle('on',S.set.autoBank);
    $('#rv').textContent='@'+S.set.risk+'%';
    const swB=$('#swB');
    if(swB){swB.classList.toggle('on',S.set.autoBank);swB.setAttribute('aria-checked',String(!!S.set.autoBank));}}
}

