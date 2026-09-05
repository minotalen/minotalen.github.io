/* ==================================================================
   gestures.js — hands: deck flick/hold/early-lift, swipe-down-to-bank,
   swipe-up-to-draw (mid-cooldown: Pre-Flick parks the card for the
   ring), and horizontal swipes that drag the views between tabs (the
   felt included: its taps, holds and vertical swipes stand down the
   moment a horizontal drag engages; right-click on the bare felt still
   ends the turn).
   The deck's top card lifts any time, cooldown included. Cards pulled
   early sit face-down where they land on the felt and flip when the
   deck cools; holding the deck still inspects it.
   ================================================================== */
/* set by initInput once its hold timers exist — a tab swipe calls it to
   kill any hold (bank-all, card inspect) the finger may have started */
let killHolds=null;

/* the pre-flick, swipe form (Pre-Flick): an upward flick while the
   ring runs pulls the deck's next card out face-down to wait on the
   felt — the drag lift without the grab. The shuffled deck is the
   source, even while the last bank or bust is still flying home */
function flickUp(x,y){
  if(!L('flick')||frozen||boardDealing||pyrUndealt.length)return false;
  if(preDrops.length>=flickCap())return false;
  const c=deckTop();if(c==null)return false;
  /* not onto the stack itself: a card parked there reads as dealt-in */
  const fr=$('#felt').getBoundingClientRect(),dr=$('#dz').getBoundingClientRect();
  if(fr.left+x>=dr.left&&fr.left+x<=dr.right&&fr.top+y>=dr.top&&fr.top+y<=dr.bottom)return false;
  const el=els[c];if(!el)return false;
  const cw=CUR_CW,ch=CUR_CH,
        px=Math.min(FW-cw/2-8,Math.max(cw/2+8,x)),
        py=Math.min(FH-ch/2-8,Math.max(ch/2+8,y));
  /* rest pose hands its spot to a frozen transform first (geometry
     armor), then the park transform glides the card out of the stack */
  el.style.transition='none';
  el.style.left='0px';el.style.top='0px';
  el.style.transform=`translate(${DX}px,${DY}px)`;
  void el.offsetWidth;
  el.style.transition='';
  el.classList.remove('buried');
  el.classList.remove('faceup');   /* a card yielded mid-flight flies face-up; the park waits blind */
  el.style.zIndex=500;
  el.style.transform=`translate(${px.toFixed(1)}px,${py.toFixed(1)}px) rotate(${(byId(c).j*3).toFixed(1)}deg)`;
  el._pkx=px;el._pky=py;   /* the pose a carry-drag starts from */
  preDrops.push(c);
  SFX.detent();buzz(6);
  return true;
}

/* put a waiting card back on the stack: out of the park list, slotted
   directly beneath the remaining block (the park list keeps owning the
   deck's tail seats), then layout re-stacks it — the deck flinches */
function returnPark(id){
  const i=preDrops.indexOf(id);if(i<0)return;
  preDrops.splice(i,1);
  const k=S.deck.indexOf(id);
  if(preDrops.length&&k>=0){
    S.deck.splice(k,1);
    const j=S.deck.indexOf(preDrops[0]);
    S.deck.splice(j<0?S.deck.length:j,0,id);
  }
  layout();SFX.slide();deckJiggle();
}

function initInput(){
  const z=$('#dz');
  let id=null,el=null,sx=0,sy=0,st=0,ly=0,lt=0,vy=0,moved=false,held=null,heldFired=false,cdL=false;
  const top=deckTop;   /* a lift grabs the deck's next card, parked ones sit out */

  /* park a lifted deck card on the felt: face-down where it landed,
     clamped inside the felt, pinned there until the cooldown clears */
  const dropEarly=(cid,ce,x,y)=>{
    const cw=CUR_CW,ch=CUR_CH,
          cx=Math.min(FW-cw/2-8,Math.max(cw/2+8,x)),
          cy=Math.min(FH-ch/2-8,Math.max(ch/2+8,y));
    ce.style.transition='';
    ce.classList.remove('buried');
    ce.classList.remove('faceup');   /* same as flickUp: the park waits blind */
    ce.style.zIndex=500;
    ce.style.transform=`translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) rotate(${(byId(cid).j*3).toFixed(1)}deg)`;
    ce._pkx=cx;ce._pky=cy;   /* the pose a carry-drag starts from */
    preDrops.push(cid);
    SFX.detent();buzz(6);
  };

  z.addEventListener('pointerdown',e=>{
    if(frozen)return;
    const c=top();if(c==null)return;
    z.setPointerCapture(e.pointerId);
    sx=e.clientX;sy=e.clientY;ly=e.clientY;st=lt=performance.now();vy=0;moved=false;heldFired=false;
    cdL=performance.now()<cdEnd;deckHold=true;
    if(preDrops.length>=flickCap()){id=null;el=null;}   /* every seat is spoken for */
    else{id=c;el=els[c];el.style.transition='none';el.style.zIndex=960;liftGrab=c;
      /* the card may rest in the deck positioned by left/top — hand it
         back to transform positioning for the drag: left/top=0 alone
         would teleport it to the top-left corner */
      el.style.left='0px';el.style.top='0px';
      el.style.transform=`translate(${DX}px,${DY}px)`;
      fanHold(c,1e9);}   /* the finger owns this card: layout keeps off it */
    held=setTimeout(()=>{held=null;heldFired=true;if(!moved)inspectDeck();},430);
  });
  z.addEventListener('pointermove',e=>{
    if(held==null&&!id)return;
    const t=performance.now(),dt=Math.max(1,t-lt);
    vy=(e.clientY-ly)/dt;ly=e.clientY;lt=t;
    const dx=e.clientX-sx,dy=Math.min(6,e.clientY-sy);
    if(Math.abs(dx)>7||Math.abs(e.clientY-sy)>7){moved=true;if(held){clearTimeout(held);held=null;}}
    if(id==null)return;                     /* a waiting early-lift owns the top seat */
    const pull=Math.min(1,Math.max(0,-dy/70));
    el.style.transform=`translate(${DX+dx*.5}px,${DY+dy*.9}px) rotate(${dx*.09}deg) scale(${1+pull*.14})`;
    if(pull>=1&&!el.dataset.rdy){el.dataset.rdy='1';SFX.detent();buzz(6);}
    if(pull<1)delete el.dataset.rdy;
  });
  function cancel(){if(held){clearTimeout(held);held=null;}
    deckHold=false;
    if(id==null)return;
    const e=el;fanBusy.delete(id);liftGrab=null;id=null;el=null;
    delete e.dataset.rdy;e.style.transition='';layout();}
  z.addEventListener('pointerup',e=>{
    if(held){clearTimeout(held);held=null;}
    const grab=id,ge=el;id=null;el=null;deckHold=false;liftGrab=null;
    if(ge){fanBusy.delete(grab);delete ge.dataset.rdy;ge.style.transition='';}
    if(grab==null){ /* nothing liftable: a polite refusal tick */
      if(!moved&&!heldFired&&performance.now()-st<260&&(performance.now()<cdEnd||preDrops.length>0))SFX.deny();
      return;}
    const dy=e.clientY-sy,quick=performance.now()-st<260;
    /* onboarding: the opening's tap script owns the deck — release,
       deal, sweep (pyrTap) */
    if(S.tut==='pyramid'){pyrTap();return;}
    /* dropped over the felt, clear of the deck and meaningfully moved:
       the card lands there. A cool deck flips it at once (the pre-drop
       fires next frame); mid-cooldown it waits face-down for the ring
       while a seat is free — full seats send it back with a tick */
    const fx=DX+(e.clientX-sx)*.5,fy=DY+Math.min(6,e.clientY-sy)*.9,
          fr=$('#felt').getBoundingClientRect(),dr=$('#dz').getBoundingClientRect(),
          inR=r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom,
          onTable=moved&&Math.hypot(fx-DX,fy-DY)>24&&inR(fr)&&!inR(dr);
    if(cdL){  /* grabbed mid-cooldown: drop on the felt, else back it goes */
      if(onTable){
        if(preDrops.length<flickCap()){dropEarly(grab,ge,fx,fy);return;}
        SFX.deny();layout();return;}
      layout();if(!moved&&quick)SFX.deny();return;}
    const wants=dy<-26||vy<-.45||(!moved&&quick);
    if(wants)drawCard();
    else if(onTable){dropEarly(grab,ge,fx,fy);return;}
    else{layout();if(wants)SFX.deny();}
  });
  z.addEventListener('pointercancel',cancel);
  z.addEventListener('wheel',e=>{if(e.deltaY<0){e.preventDefault();
    /* the pyramid is on display: only the tap-gather opens the deck */
    if(S.tut==='pyramid')return;drawCard();}},{passive:false});

  /* the felt: swipe down banks, swipe up draws, tap arms a trick, hold
     (or right-click) opens the sticker card, right-click on the bare
     felt ends the turn. A hold never banks — the sheet swallows it; a
     horizontal drag belongs to the tab swipe, not the felt. */
  const Fd=$('#felt');let by=null,bx=0,bt=0,cardP=null,cardT=0,infoFired=false,parkP=null;
  Fd.addEventListener('pointerdown',e=>{
    if(e.target.closest('#dz'))return;
    stkTipHide();
    by=e.clientY;bx=e.clientX;bt=performance.now();infoFired=false;
    const ce=e.target.closest('.card');
    /* a parked early lift: the finger can carry it — drop it on the
       deck to put it back, anywhere else re-parks it */
    if(ce&&!ce.classList.contains('faceup')&&preDrops.includes(+ce.dataset.cid)){
      const pid=+ce.dataset.cid,pe=els[pid]||ce;
      parkP={id:pid,el:pe,px:pe._pkx||DX,py:pe._pky||DY,x:e.clientX,y:e.clientY};
      pe.style.transition='none';
      pe.style.zIndex=960;
      return;
    }
    /* pile cards count too, even face-down — a tap fans them out */
    cardP=(ce&&(ce.classList.contains('faceup')||pileOf(+ce.dataset.cid)))
      ?{id:+ce.dataset.cid,x:e.clientX,y:e.clientY}:null;
    if(cardP)cardT=setTimeout(()=>{cardT=0;if(Views.swiping)return;
      infoFired=true;openStkCard(cardP.id);},350);
  });
  Fd.addEventListener('pointermove',e=>{
    if(parkP){
      const dx=e.clientX-parkP.x,dy=e.clientY-parkP.y,
            px=parkP.px+dx,py=parkP.py+dy;
      parkP.el._pkx=px;parkP.el._pky=py;
      parkP.el.style.transform=`translate(${px.toFixed(1)}px,${py.toFixed(1)}px) rotate(${Math.max(-14,Math.min(14,dx*.09)).toFixed(1)}deg)`;
      return;
    }
    if(cardP&&cardT&&Math.hypot(e.clientX-cardP.x,e.clientY-cardP.y)>8){
      clearTimeout(cardT);cardT=0;}
  });
  Fd.addEventListener('pointerup',e=>{
    if(cardT){clearTimeout(cardT);cardT=0;}
    if(parkP){
      const p=parkP;parkP=null;by=null;
      p.el.style.transition='';p.el.style.zIndex=500;
      if(!preDrops.includes(p.id)){layout();return;}   /* it flipped or flew home mid-carry */
      const dr=$('#dz').getBoundingClientRect(),
            over=e.clientX>=dr.left&&e.clientX<=dr.right&&e.clientY>=dr.top&&e.clientY<=dr.bottom;
      if(over){returnPark(p.id);return;}
      /* still waiting: it re-parks where the finger left it */
      const cw=CUR_CW,ch=CUR_CH,
            px=Math.min(FW-cw/2-8,Math.max(cw/2+8,p.px)),
            py=Math.min(FH-ch/2-8,Math.max(ch/2+8,p.py));
      p.px=px;p.py=py;p.el._pkx=px;p.el._pky=py;
      p.el.style.transform=`translate(${px.toFixed(1)}px,${py.toFixed(1)}px) rotate(${(byId(p.id).j*3).toFixed(1)}deg)`;
      return;
    }
    const held=cardP;cardP=null;
    if(by==null)return;
    const d=e.clientY-by,fast=performance.now()-bt<650;by=null;
    /* onboarding: the opening's tap script — the first tap releases the
       title, one mid-deal queues the sweep, the next runs it (pyrTap) */
    if(S.tut==='pyramid'&&!Views.swiping&&!infoFired&&Math.hypot(e.clientX-bx,d)<8){
      pyrTap();return;}
    if(held&&!infoFired&&Math.hypot(e.clientX-bx,d)<8&&!Views.swiping&&fast){
      const p=pileOf(held.id);
      if(p&&!aim){setFan(p);return;}   /* pile tap: open, swap or close the fan */
      if(fanZone)setFan(null);         /* a table tap closes it; the card still plays */
      tapCard(held.id);return;}
    if(!held&&aim&&Math.hypot(e.clientX-bx,d)<8&&!Views.swiping){cancelAim();return;}
    if(!held&&fanZone&&!infoFired&&Math.hypot(e.clientX-bx,d)<8&&!Views.swiping&&fast
      &&!e.target.closest('.tok.cnt')){setFan(null);return;}
    if(d>44&&fast&&!Views.swiping&&!infoFired)bank(S.hands[S.focus]);
    /* the felt's other half: a swipe up anywhere off the deck draws.
       Mid-cooldown the Pre-Flick catches it: the next card pulls out
       face-down to wait for the ring (silent without the upgrade, the
       same nothing a swipe has always done on a cooling deck) */
    else if(d<-44&&fast&&!Views.swiping&&!infoFired){
      const fr=Fd.getBoundingClientRect();
      if(!drawCard())flickUp(e.clientX-fr.left,e.clientY-fr.top);
    }
  });
  Fd.addEventListener('pointercancel',()=>{
    if(cardT){clearTimeout(cardT);cardT=0;}
    if(parkP){const p=parkP;parkP=null;
      p.el.style.transition='';p.el.style.zIndex=500;}
    by=null;cardP=null;});
  Fd.addEventListener('contextmenu',e=>{
    const ce=e.target.closest('.card');
    if(ce&&ce.classList.contains('faceup')){e.preventDefault();openStkCard(+ce.dataset.cid);return;}
    /* right-click on the felt ends the turn: every hand over the line
       banks at once, the hold-the-BANK gesture in mouse form. This
       fires after pointerup, so an open press (by!=null — also how a
       touch long-press arrives) never triggers it; onboarding keeps
       its own script */
    if(frozen||by!=null||(S.tut&&S.tut!=='done'&&S.tut!=='end'))return;
    e.preventDefault();bankAll();
  });
  /* mouse hover over a stickered card: the neumorphic tag slides in
     below it — touch never sees this, long-press opens the sheet.
     Over a pile, hover lifts the card to the front: fully forward in
     an open fan, just above its pile in the standing vertical one */
  Fd.addEventListener('pointerover',e=>{
    if(e.pointerType!=='mouse'||Views.swiping)return;
    stkTipShow(e);
    const ce=e.target.closest('.card');if(!ce)return;
    const id=+ce.dataset.cid,p=pileOf(id);if(!p)return;
    const byV=(a,b)=>byId(a).v-byId(b).v||a-b;   /* piles read low card first */
    const list=(p==='out'?S.out.slice():culledAll().concat(S.disc||[])).sort(byV);
    if(fanZone===p){
      fanHov=id;
      list.forEach((fid,i)=>{const el=els[fid];if(el)el.style.zIndex=fid===id?960:800+i;});
    }else if(!fanZone&&list.length>=2&&list.length<=4){
      list.forEach((fid,i)=>{const el=els[fid];if(el)el.style.zIndex=fid===id?60:10+(list.length-1-i);});
    }
  });
  Fd.addEventListener('pointerout',e=>{if(e.pointerType==='mouse')stkTipHide();});
  Fd.addEventListener('pointerleave',stkTipHide);

  /* the buff bar: mouse hover raises its tag — touch never sees it */
  const BW=$('#buffs');
  BW.addEventListener('pointerover',e=>{if(e.pointerType==='mouse')buffTipShow(e);});
  BW.addEventListener('pointerout',e=>{if(e.pointerType==='mouse')buffTipHide();});
  BW.addEventListener('pointerleave',buffTipHide);

  /* hold the BANK button to bank every hand at once — unless the hold
     turns into a tab swipe */
  let bLP=false,bT=0,bX=0,bY=0;
  $('#bank').addEventListener('pointerdown',e=>{
    bLP=false;bX=e.clientX;bY=e.clientY;
    bT=setTimeout(()=>{if(Views.swiping)return;bLP=true;bankAll();},430);});
  $('#bank').addEventListener('pointermove',e=>{
    if(bT&&Math.hypot(e.clientX-bX,e.clientY-bY)>8){clearTimeout(bT);bT=0;}});
  $('#bank').addEventListener('pointerup',()=>clearTimeout(bT));
  $('#bank').addEventListener('pointerleave',()=>clearTimeout(bT));

  killHolds=()=>{clearTimeout(bT);bT=0;
    if(cardT){clearTimeout(cardT);cardT=0;}
    /* the swipe took the pointer (and its capture): the felt's own
       up/cancel will never arrive, so nothing may stay half-pressed —
       a carried waiting card re-parks where it sits */
    if(parkP){const p=parkP;parkP=null;
      p.el.style.transition='';p.el.style.zIndex=500;}
    by=null;cardP=null;};

  /* the pile counters open their fan too — a small target, but it sits
     right under the pile it counts */
  $('#tkO').onclick=()=>{if(S.out.length>1)setFan('out');};
  $('#tkX').onclick=()=>{if(culledAll().length+S.disc.length>1)setFan('culled');};

  /* the empty set-aside slot explains itself: a hover raises the
     sticker tag's twin beside the stack */
  $('#slotX').addEventListener('pointerenter',()=>pileTip(true));
  $('#slotX').addEventListener('pointerleave',()=>pileTip(false));

  /* the chain token explains the combo: streak, pay, and the dots'
     rising card req */
  $('#tkC').addEventListener('pointerenter',()=>chainTip(true));
  $('#tkC').addEventListener('pointerleave',()=>chainTip(false));

  initViewSwipe();
}

/* ---- horizontal swipe between tabs: a 10%-of-width dead zone is the
   trigger — under it the drag is nothing (release cancels), past it the
   views follow the finger and release flicks the switch. Rubber-band at
   the locked edges, same gesture on the rail ---- */
const Views={swiping:false};
function initViewSwipe(){
  const host=$('#views');
  let sx=0,sy=0,mode=null,from=null,to=null,dx=0,ate=false;
  const order=()=>$$('#tabs button').filter(b=>!b.classList.contains('hid')&&!b.classList.contains('lock')).map(b=>b.dataset.v);
  const curV=()=>document.querySelector('.view.on')?.id.slice(2)||'play';
  const reset=()=>{Views.swiping=false;from=null;to=null;mode=null;dx=0;};

  /* a swipe that started on a button or row must not also fire its
     click once the finger lifts — no accidental buys or sheet opens */
  const eatClicks=el=>el.addEventListener('click',e=>{
    if(ate){ate=false;e.stopPropagation();e.preventDefault();}},true);
  eatClicks(host);

  host.addEventListener('pointerdown',e=>{
    ate=false;
    if($('#mo').classList.contains('on'))return;
    /* wide desktop: the table never leaves the stage, so there is no
       lane to drag — the felt's taps, holds and vertical swipes (a
       separate handler) all stand; the panel switches by rail */
    if(document.body.classList.contains('wide'))return;
    /* the deck, the risk slider and the sticker-pick pad own their
       drags. Everything else can swipe — the felt included: its taps,
       holds and vertical swipes stand down the moment a horizontal drag
       engages (killHolds + Views.swiping + the eaten click) */
    if(e.target.closest('#dz,#pped,input'))return;
    sx=e.clientX;sy=e.clientY;
    mode=null;from=curV();to=null;dx=0;
  });
  host.addEventListener('pointermove',e=>{
    if(from==null)return;
    const x=e.clientX-sx,y=e.clientY-sy;
    if(!mode){
      /* the dead zone gates the trigger; past it, axis dominance still
         decides — whichever axis clearly leads takes the gesture, so a
         phone's arced swipes resolve and a scroll's drift never flips */
      const W=host.clientWidth;
      if(Math.abs(x)>W*.1&&Math.abs(x)>Math.abs(y)*1.2)mode='swipe';
      else if(Math.abs(y)>14&&Math.abs(y)>Math.abs(x)*1.2)mode='scroll';
      if(mode!=='swipe')return;
      ate=true;Views.swiping=true;
      if(killHolds)killHolds();          /* bank-all / inspect holds are dead */
      /* touch pointers are implicitly captured to their target already;
         an explicit retarget onto the host makes iOS drop mid-drag
         moves (the stuck swipe) — only the mouse needs the capture */
      if(e.pointerType!=='touch')try{host.setPointerCapture(e.pointerId);}catch(err){}
      const vis=order(),i=vis.indexOf(from);
      if(i<0){from=curV();return;}
      const nx=x<0?vis[i+1]:null, pv=x>0?vis[i-1]:null;
      to=nx||pv||null;
      $('#v-'+from).style.transition='none';
      if(!to){mode='edge';return;}       /* nowhere to go — rubber-band */
      const nxt=$('#v-'+to);
      nxt.classList.add('on');
      nxt.style.transition='none';
      nxt.style.transform=`translateX(${x<0?host.clientWidth:-host.clientWidth}px)`;
    }
    if(mode!=='swipe'&&mode!=='edge')return;
    e.preventDefault();
    dx=x;
    const W=host.clientWidth,cur=$('#v-'+from);
    if(mode==='edge'){                   /* resist, then spring back */
      cur.style.transform=`translateX(${Math.sign(x)*Math.min(42,Math.abs(x)*.16)}px)`;
      return;
    }
    const nxt=$('#v-'+to);
    cur.style.transform=`translateX(${dx*.6}px)`;
    nxt.style.transform=`translateX(${(dx<0?W:-W)+dx*.6}px)`;
  },{passive:false});
  /* land the drag on `dst`: the switch snaps instantly, content renders
     after the class flip — shared by pointerup and pointercancel */
  const commitTo=(cur,dst)=>{
    cur.style.cssText='';
    cur.classList.remove('on');
    Tabs.fixTab(dst);
    if(dst!=='play')Tabs.render(dst);
    else requestAnimationFrame(layout);
    save();
  };
  host.addEventListener('pointerup',()=>{
    if(from==null)return;
    const cur=$('#v-'+from);
    if(mode==='edge'){
      cur.style.transition='transform .24s var(--sp)';
      cur.style.transform='translateX(0)';
      setTimeout(()=>{cur.style.cssText='';},240);
    }else if(mode==='swipe'&&to){
      /* the dead zone was the decision: past it the release is the
         flick and the switch snaps into place — nothing can freeze it
         part way. Under the zone mode never engaged, so this lift is
         just a tap or a dead drag */
      commitTo(cur,to);
    }
    reset();
  });
  host.addEventListener('pointercancel',()=>{
    if(from&&mode==='swipe'&&to){
      /* the browser took the pointer back mid-drag (a native pan it
         claimed anyway, a phone UI gesture): the gate was crossed, so
         the flick still lands */
      commitTo($('#v-'+from),to);
    }
    else if(from&&mode==='edge')$('#v-'+from).style.cssText='';
    reset();
  });

  /* the rail itself: a short horizontal fling across the buttons moves
     one tab over — taps still tap */
  const rail=$('#tabs');let rOn=false,rFired=false,rsx=0,rsy=0;
  eatClicks(rail);
  rail.addEventListener('pointerdown',e=>{rOn=true;rFired=false;rsx=e.clientX;rsy=e.clientY;});
  rail.addEventListener('pointermove',e=>{
    if(!rOn||rFired)return;
    const dx2=e.clientX-rsx;
    if(Math.abs(dx2)>26&&Math.abs(dx2)>Math.abs(e.clientY-rsy)*1.2){
      rFired=true;ate=true;
      const vis=order(),i=vis.indexOf(curV());
      if(i<0)return;
      const t=dx2<0?vis[i+1]:vis[i-1];
      if(t)Tabs.go(t,null,true);
    }
  });
  rail.addEventListener('pointerup',()=>{rOn=false;});
  rail.addEventListener('pointercancel',()=>{rOn=false;});
}
