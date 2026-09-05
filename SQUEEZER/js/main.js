/* ==================================================================
   main.js — boot, keyboard, the frame loop (cooldown ring, autos,
   restock, goal checks), offline earnings.
   Autos are per-hand: Auto-Bank fires on any hand over the bank line,
   Auto-Draw deals round-robin to tables under both its card cap and
   the draw-stop line (the dial the Draw Stop upgrade ceilings), and
   the charged stickers on a driving table arm themselves (autoPlay,
   actions.js). Card taps (arm a trick) are handled on the felt in
   gestures.js.
   ================================================================== */
$('#bSet').onclick=openSet;
$('#bank').onclick=()=>{if($('#bank').dataset.lp)return;bank(S.hands[S.focus]);};

addEventListener('keydown',e=>{
  /* any real key (not just modifiers) dismisses the title; the tab
     keys ride along — a digit or arrow hides the title AND switches */
  const tabKey=(e.key>='1'&&e.key<='9')||e.key==='ArrowLeft'||e.key==='ArrowRight';
  if(ttlAlive()){
    if(/^(Alt|Control|Shift|Meta|CapsLock|NumLock|ScrollLock)$/.test(e.key))return;
    ttlClick();
    if(!tabKey)return;
  }
  if($('#cmp').classList.contains('on')){if(e.key==='Escape')closeComp();return;}
  if($('#mo').classList.contains('on')){if(e.key==='Escape')closeMo();return;}
  if(e.code==='Space'){e.preventDefault();const a=document.activeElement;if(a&&a.tagName==='BUTTON')a.blur();
    if(S.tut==='pyramid')return;   /* the deck waits for its tap-gather */
    drawCard();}
  else if(e.key==='b'||e.key==='B'||e.key==='Enter'){
    e.preventDefault();bank(S.hands[S.focus]);}   /* bank all lives on the held BANK button, not a chord */
  else if(e.key==='f'||e.key==='F'){
    if(S.hands.length>1){S.focus=(S.focus+1)%S.hands.length;layout();paint();}}
  else if(e.key==='d'||e.key==='D')inspectDeck();
  else if(e.code&&e.code.slice(0,3)==='Key'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
    /* the act row: the first eight keys of the letter row address the
       charged tricks — Q acts the first, W the second, and so on. "Live"
       means the same thing the felt paints: charged, unspent, not
       already standing (an armed Float waits, it does not re-arm). Order
       reads the felt the way it lays out: top band down, value ascending
       within a hand. e.code, not e.key, so every layout maps the same
       physical keys; nothing in the slot is a polite refusal */
    const i='QWERTZUI'.indexOf(e.code[3]);
    if(i>=0){
      const acts=[];
      S.hands.forEach(h=>{const r=h.run;
        const standing=id=>r.armedF===id||r.stakesIds.indexOf(id)>=0;
        [...h.ids].sort((a,b)=>byId(a).v-byId(b).v||a-b).forEach(id=>{
          const c=byId(id);
          if(TRICK[c.stk]&&r.spent.indexOf(id)<0&&!standing(id))acts.push(id);});});
      const id=acts[i];
      if(id!=null)tapCard(id);
      else if(!frozen)SFX.deny();
    }}
  else if(e.key>='1'&&e.key<='9'){
    /* digits address the unlocked tabs in rail order — a locked tab
       has no key until it appears */
    const vis=$$('#tabs button').filter(b=>!b.classList.contains('hid'));
    const t=vis[+e.key-1];if(t)Tabs.go(t.dataset.v);}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
    const vis=$$('#tabs button').filter(b=>!b.classList.contains('hid')).map(b=>b.dataset.v);
    const i=vis.indexOf(document.querySelector('.view.on')?.id.slice(2)||'play');
    const t=e.key==='ArrowLeft'?vis[i-1]:vis[i+1];
    if(t){e.preventDefault();Tabs.go(t);}}
});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
addEventListener('resize',()=>requestAnimationFrame(layout));
/* background mode: while the tab is hidden the effects are dark (BG in
   state.js) and the autos keep playing off this 1s beat — rAF is
   paused in a hidden tab, and a throttled timer dragging a frozen bust
   window is what locked the game "for a while" on rejoin. A web lock
   holds the 1s timer clamp, so Chrome's 5-minute intensive throttle
   never slows the beat. On return: the tally modal reports the session */
let bgInt=0,bgTally=null,bgRel=null,welPend=null;
function bgTick(){
  if(frozen||coldBoot||ttlAlive())return;
  autoStep(performance.now());
}
addEventListener('visibilitychange',()=>{
  /* a hidden tab renders nothing, so every cosmetic clock may as well
     stop: CSS animations freeze via the .hid class, SMIL vinyls via
     pauseAnimations (their clocks can outlive the suspended renderer).
     New SVGs built while hidden tick unrendered; the blanket unpause
     on return catches them too */
  document.documentElement.classList.toggle('hid',document.hidden);
  document.querySelectorAll('svg').forEach(s=>{
    try{document.hidden?s.pauseAnimations():s.unpauseAnimations();}catch(e){}});
  if(document.hidden){
    save(true);
    BG=true;
    if((L('auto')&&S.set.autoDraw)||(L('abank')&&S.set.autoBank)){
      bgTally={t:Date.now(),sc:S.score,b:S.st.banks,u:S.st.busts,d:S.st.draws};
      bgInt=setInterval(bgTick,1000);
      try{if(navigator.locks)navigator.locks.request('sqz-bg',{ifAvailable:true},
        ()=>new Promise(r=>bgRel=r)).catch(()=>{});}catch(e){}
    }
  }else if(BG){
    BG=false;
    if(bgInt){clearInterval(bgInt);bgInt=0;}
    if(bgRel){try{bgRel();}catch(e){}bgRel=null;}
    lastAct=performance.now();   /* the return starts a fresh idle minute */
    layout();paint();
    if(bgTally){
      const t=bgTally;bgTally=null;
      const dt=Date.now()-t.t,
            banks=S.st.banks-t.b,busts=S.st.busts-t.u,
            draws=S.st.draws-t.d,gain=S.score-t.sc;
      /* a zero session (a dealt card, no bank) is not news: the money
         is already in S.score either way */
      if(dt>=30000&&gain>0)openBgModal(dt,banks,busts,draws,gain);
    }
  }
});
addEventListener('beforeunload',()=>flush());
setInterval(()=>save(),12000);

/* cold boot: a reload restores armed wards and hot tables, and the draw
   cooldown starts empty — the autos would spend or bank all of that on
   the very first frame, before the first paint. They hold until the
   user's first interaction hands control back. Every interaction also
   re-arms the idle clock that hands the stage back to the title */
let coldBoot=true,lastAct=performance.now();
['pointerdown','keydown','wheel'].forEach(ev=>addEventListener(ev,()=>{
  coldBoot=false;lastAct=performance.now();},{capture:true,passive:true}));

let lastP=0,lastA=0,nextBeat=0,lastF=0,stress=0,aT=0;
function frame(ts){
  const now=performance.now(),rem=Math.max(0,cdEnd-now);
  /* adrenaline: a card YOU play slams stress to 1 (resolve), then a
     slow ~4.5s fade bleeds it to zero — auto-draw churn doesn't count,
     so an unattended hand's heart fades to full silence */
  stress=Math.max(0,stress-Math.min(.1,(now-lastF)/1000)/4.5);lastF=now;
  const ring=$('#ring'),ch=$('#chev');
  /* the heartbeat rides the focused hand: silent under 55%, quickening as
     the gauge climbs; dead during busts. Its intensity follows
     the pool — a small deck is a small moment, not a panic. Stress is
     the adrenaline on top: it drives pace and volume together, and the
     fade carries both to zero ~4.5s after your last card */
  const fh=S.hands[S.focus];
  if(!frozen&&fh&&fh.ids.length&&threat(fh)>=.55){
    const k=(threat(fh)-.55)/.45, pk=Math.min(1,S.deck.length/12);
    if(now>=nextBeat){
      const ks=k*stress;
      nextBeat=ks>0?now+1100-k*620*stress:now+250;   /* silent: cheap poll till the next spike */
      if(ks>0){SFX.heart(ks,pk);beatFx(ks,pk);}
    }
  }else nextBeat=0;
  /* cooldown: the ring starts fully gray and drains away (clockwise,
     from the top) as the deck cools — gone entirely once it's free.
     The bounce arrow above the deck is a draw invitation, so it only
     shows when the table is clear: never under the title, the intro
     deal, or a hand still holding cards */
  const chvOn=!ttlAlive()&&!pyrUndealt.length&&!boardDealing
    &&S.tut!=='pyramid'&&!S.hands.some(h=>h.ids.length);
  if(rem>1){const p=100-Math.min(100,rem/cdLen*100);
    ring.classList.add('on');
    ring.style.background=`conic-gradient(transparent ${p.toFixed(1)}%,rgba(70,66,47,.38) 0)`;
    ch.style.opacity=chvOn?.1:0;}
  else{ring.classList.remove('on');ring.style.background='none';
    ch.style.opacity=chvOn?(frozen?.1:.75):0;}
  ch.classList.toggle('off',!chvOn);   /* a hidden arrow pauses its bounce instead of ticking unseen */
  paintWard(now);
  /* the early lifts pay out: cards pulled mid-cooldown wait face-down
     on the felt and flip the moment the deck cools — real draws, ring
     and all. preDropTick also sends home any waiter a reshuffle
     knocked out of the deck's top seats */
  preDropTick(rem);
  if(!frozen&&!coldBoot&&!ttlAlive()){
    /* a bank inside the step yields the rest of this frame: the sweep
       owns the moment, the next beat draws */
    if(autoStep(now)){requestAnimationFrame(frame);return;}
  }
  /* one idle minute with no modal up hands the stage back to the title */
  if(!ttlAlive()&&now-lastAct>TTL_IDLE
    &&!$('#mo').classList.contains('on')&&!$('#cmp').classList.contains('on'))
    ttlIdle();
  if(ts-lastP>190){lastP=ts;paint();}
  if(ts-lastA>1000){lastA=ts;
    bkWave();   /* RO owns resizes; this catches a replaced back element */
    if(pool().length&&Date.now()>=S.shop.next)rollShop();
    checkAch();unlocks();
    if($('#v-shop').classList.contains('on')&&!S.pick)renderShop();
    if($('#v-cards').classList.contains('on'))paintRisk();
    refreshBuy();}
  requestAnimationFrame(frame);
}
/* one beat of the autos: arm tricks by policy, bank any hand over its
   line, deal on a cool deck. Shared by the frame loop and the
   background tick, so a hidden tab plays the exact same policy */
function autoStep(now){
  /* the driven clock: one tick a second while any auto is switched on,
     the frame beat and the hidden-tab beat both feed it */
  if(((L('auto')&&S.set.autoDraw)||(L('abank')&&S.set.autoBank))&&now-aT>=1000){
    aT=now;S.st.aTime=(S.st.aTime||0)+1;}
  /* the autos arm their own tricks before anything moves — a Stakes
     armed now still doubles the premium of the bank this same tick */
  if(L('auto')&&S.set.autoDraw)S.hands.forEach(autoPlay);
  if(L('abank')&&S.set.autoBank){
    const cap=L('auto');
    /* a table the stop line caught mid-fill is out of the autos' hands
       (autoLineHeld): everything over the bank line cashes out */
    const over=S.hands.find(h=>canBank(h)&&!autoLineHeld(h)&&(
      threat(h)*100>=S.set.risk||autoHolds(h)));   /* a known bust: bank instead */
    if(over){bank(over,true);return true;}
  }
  /* a finger holding the deck owns its top card: the autos wait out the
     hold rather than deal it out from under the drag */
  if(L('auto')&&S.set.autoDraw&&now>=cdEnd&&!deckHold){
    /* tiered deal: each table takes up to L('auto') cards. The stop
       line ends the deal mid-fill and the table freezes (autoLineHeld)
       until you bank it. A Tell-revealed bust holds too */
    const cap=L('auto');
    for(let k=0;k<S.hands.length;k++){
      const i=(S.focus+k)%S.hands.length,h=S.hands[i];
      if(h.ids.length>=cap)continue;
      if(threat(h)*100>=drawStop()*100)continue;   /* the stop line ends the deal */
      if(autoHolds(h))continue;
      drawCard(i,null,true);break;
    }
  }
  return false;
}

/* dev: surface boot/runtime errors in the tab title */
addEventListener('error',e=>{document.title='ERR '+(e.message||e.type).slice(0,80);});
addEventListener('unhandledrejection',e=>{const r=e.reason;
  document.title='REJ '+((r&&r.message)||r||'').toString().slice(0,80);});

/* debug handle for console poking */
window.G={get S(){return S;},get stress(){return stress;},get nextBeat(){return nextBeat;},
  draw:()=>drawCard(),bank:()=>bank(S.hands[S.focus]),bankAll,tab:v=>Tabs.go(v),
  add:(n)=>{S.score+=n;paint();},busts:n=>{S.st.busts+=n;checkAch();},
  hand:(i)=>S.hands[i==null?S.focus:i],
  split:(n)=>{while(S.hands.length<(n||2))S.hands.push(newHand());layout();paint();}};

/* dev hook: /?demo grants progress so the whole loop can be inspected.
   Local origins only: a shipped page must never run it, and a demo boot
   must never sit where a real save can be pushed from */
function demo(){
  if(!/[?&]demo/.test(location.search)||window.__demo)return;
  if(location.protocol!=='file:'&&
     !/^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(location.hostname))return;
  window.__demo=1;
  S.score+=2e5;S.banked+=6e4;S.life+=2e5;S.st.bankSum=(S.st.bankSum||0)+6e4;S.st.busts=26;S.st.inspects=5;
  S.st.zeroed=Math.max(S.st.zeroed||0,1);   /* the rip's gate reads owned progress, demo owns it */
  logAct('dem',2e5);
  S.hands[0].chain=3;S.st.banks=6;S.tut='done';
  ['g1','g2','g3','g4','g5','g7','g9','g23','g24','g25','g26','b1'].forEach(id=>{if(!has(id))S.ach.push(id);});
  const blank=S.cards.filter(c=>!c.stk);
  [['gild',0],['ward',1],['tell',2],['odds',3],['stakes',4],['swap',5]].forEach(([k,i])=>{
    if(blank[i]){blank[i].stk=k;faceOf(blank[i],true);}});
  /* the demo deck wears the condition layer: random cards, random
     conditions, re-rolled each boot (docs/card-modifiers.md) */
  const CK=Object.keys(COND);
  S.cards.forEach(c=>{if(Math.random()<.45){c.cond=[CK[rndi(CK.length)]];faceOf(c);}});
  S.up.grace=Math.max(S.up.grace||0,1);rollShop(true);   /* the ward comes from the Grace upgrade, not a per-boot top-up */
}

(async function boot(){
  const saved=load();
  if(saved){
    S=Object.assign(newState(),saved);
    S.set=Object.assign(newState().set,saved.set||{});
    S.seen=Object.assign(newState().seen,saved.seen||{});
    S.st=Object.assign(newState().st,saved.st||{});
    S.shop=Object.assign({next:0,offers:[],rrP:ECO.RESTOCK_NOW,rrT:0},saved.shop||{});
    S.out=saved.out||saved.exile||[];
    S.disc=saved.disc||[];
    if(!Array.isArray(S.hands)||!S.hands.length)S.hands=[newHand()];
    S.hands.forEach(h=>{h.ids=h.ids||[];h.run=Object.assign(freshRun(),h.run||{});});
    S.focus=Math.min(S.focus||0,S.hands.length-1);
    if(!S.cards.length)seed();
  }else{S=newState();seed();}
  buildFelt();buildEls();rebuildDeck();initInput();demo();
  if(!S.shop.offers.length&&pool().length)rollShop(true);
  const off=saved?offline(saved.t||Date.now()):null;
  Object.keys(S.seen).forEach(k=>{if(k==='tut')return;
    if(S.seen[k]){const b=$(`#tabs button[data-v="${k}"]`);if(b)b.classList.remove('hid');}});
  /* first paint must already be in place: this layout runs while mkEl
     still holds every card's transition suppressed, so hands and piles
     land on their spots instead of tweening in from the spawn corner */
  layout();
  requestAnimationFrame(()=>{layout();paint();bkWave();Tabs.thumb();
    /* the title owns the opening: the board rides in the deck until
       its click deals it out */
    if(ttlAlive())boardStash();});
  renderAll();checkAch();unlocks();
  /* dev/deep-link: #cards, #up, #shop, #ach, #pres open a tab;
     #card opens the sheet of the first stickered card, #comp the book */
  const hq=location.hash.slice(1);
  if(TAB_ORDER.includes(hq))Tabs.go(hq);
  else if(hq==='card'){const c=S.cards.find(x=>x.stk)||S.cards[0];if(c)openCardSheet(c.id);}
  else if(hq==='comp')openComp();
  /* the title owns the opening: the offline report waits under it and
     opens once the last letter has left (ttlOff) */
  if(off)welPend=off;
  /* the title shows on every load: only the untouched tutorial opening
     passes its clicks through to the felt (pyrTap); every other
     showing captures its own dismissal. The board is pre-parked in the
     deck, so the felt goes bare (screensaver) from the first frame */
  ttlOn(S.tut==='pyramid'&&!S.st.draws);
  $('#felt').classList.add('ttl');
  tutPaint();
  /* everything is placed: show the app (base.css keeps it invisible till
     .rdy, so the raw HTML never paints a half-dressed frame) */
  $('#app').classList.add('rdy');
  requestAnimationFrame(frame);
})();
