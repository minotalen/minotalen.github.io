/* ==================================================================
   tut.js — the onboarding, poster edition. One beat, one poster: a
   loud line, an optional gold action line, nothing else. No small
   text, no illustrations: the felt is the picture, the ring is the
   pointer. The coached verbs, in order:
   pyramid → gather  the deck dealt face-up, tap sweeps it home
   card    → draw    CARD = SCORE
   risk    → deepen  MORE CARDS, MORE RISK → HIGHER MULTI. draw until
                     the twin lands (a bank skips ahead)
   bust    → lose    TWIN = BUST, then the safe road: DRAW, THEN BANK
   wages   → fund    grow score until the DECK tab opens
   buy     → card    buy the first card
   upg     → grind   BUY ANOTHER CARD, shown only once the wallet can:
                     the poster and its ring both wait on cheapestCard(),
                     hiding through the earning stretch between buys
   upbuy   → power   UPGRADES just opened on its own gate: BUY AN
                     UPGRADE, likewise hidden until the cheapest open
                     row is affordable. The purchase closes the run
   end               the loop poster, GOT IT closes it
   UPGRADES is never force-opened: unlocks() raises 'upopen' at the
   natural card-count gate and the coach takes it from there.
   Steps ride S.tut; the game raises events (gather / draw / bust /
   bank / buy / cards / upopen / upgbuy). Events only advance their
   own step, so nothing skips. Analytics: every step carries dt
   (play-sec since the previous step event, i.e. time spent on the
   step before it), done carries frm (where SKIP struck) plus
   dr/bn/bu (draws / banks / busts counted during the run).
   ================================================================== */
let tutHiEls=[],tutHiSig='';
/* the poster: h = the loud line, p2 = the gold action line, bad = red */
const TUT_TXT={
  pyramid:()=>({h:'YOUR DECK',p2:'TAP ANYWHERE'}),
  card:()=>({h:'CARD = SCORE',p2:'TAP THE DECK'}),
  risk:()=>({h:'MORE CARDS, MORE RISK',p2:'→ HIGHER MULTI'}),
  bust:()=>({h:'TWIN = BUST',p2:'DRAW, THEN BANK',bad:1}),
  wages:()=>({h:`BANK ${TAB_GATE.cards.req} SCORE`}),
  buy:()=>({h:'BUY A CARD'}),
  upg:()=>({h:'BUY ANOTHER CARD'}),
  upbuy:()=>({h:'BUY AN UPGRADE'}),
  end:()=>({h:"THAT'S THE GAME",g:'<span class="tv">DRAW</span><span class="tv">BANK</span><span class="tv">BUY</span>'})
};
/* the coach's progress count, shown on the bubble's gold wash */
const TUT_N={pyramid:1,card:2,risk:3,bust:4,wages:5,buy:6,upg:7,upbuy:8,end:8};
/* where the coach points; null = the table speaks for itself. Cards
   and upgrades ring the tab pill from the table, the first buy button
   once their view is open, so the ring follows the player in. The
   grind keeps pointing at buys: that IS the mission */
const viewOn=v=>!!$(`#v-${v}`)&&$('#v-'+v).classList.contains('on');
const atBuy=()=>viewOn('cards')?['#v-cards .buy']:['#tabs button[data-v="cards"]'];
const TUT_AT={pyramid:()=>null,card:()=>['#slotD'],risk:()=>['#rk'],
  bust:()=>['#slotD','#bank'],
  wages:()=>['#hud .mny','#tabs button[data-v="cards"]'],
  buy:atBuy,upg:atBuy,
  upbuy:()=>viewOn('up')?['#v-up .buy']:['#tabs button[data-v="up"]'],
  end:()=>null};
/* the coached buys only speak when the buy is possible: a nudge the
   wallet can't act on is noise, so the grind waits on the cheapest
   card and the upgrade nudge on the cheapest open, goal-free row.
   Hidden means fully hidden: bubble, ring, everything */
const cheapestUpg=()=>{let m=Infinity;
  for(const id in UPG){
    if(!upOpen(id)||L(id)>=UPG[id].max||upGate(id))continue;
    m=Math.min(m,upCost(UPG[id],L(id)));}
  return m;};
const TUT_WAIT={upg:()=>S.score>=cheapestCard(),upbuy:()=>S.score>=cheapestUpg()};
/* an unknown step name can only be a pre-release dev save: restart the
   coach rather than carry a rename map (nothing has shipped) */

/* the run's counters, drained into the done event: what the player
   actually did while coached. dt rides every step as play-seconds
   spent reaching it */
let tutLastMs=0,tutDr=0,tutBn=0,tutBu=0;
function tutEvent(ev){
  const s=S.tut;if(!s||s==='done'||s==='end')return;
  let to=null;
  if(ev==='gather'){if(s==='pyramid')to='card';}
  else if(ev==='draw'){if(s==='pyramid')to='card';else if(s==='card')to='risk';}
  else if(ev==='bust'){if(s==='risk')to='bust';tutBu++;}
  else if(ev==='bank'){if(s==='risk'||s==='bust')to='wages';tutBn++;}
  else if(ev==='buy'){if(s==='wages'||s==='buy')to='upg';}
  else if(ev==='cards'){if(s==='wages')to='buy';}
  else if(ev==='upopen'){if(s==='upg')to='upbuy';}   /* the real gate opened */
  else if(ev==='upgbuy'){if(s==='upbuy')to='end';}   /* the coached purchase */
  if(ev==='draw')tutDr++;
  if(!to)return;
  const now=biMs(),dt=tutLastMs?Math.max(0,Math.round((now-tutLastMs)/1000)):0;
  tutLastMs=now;
  S.tut=to;tutPaint();save();
  bi('tut',{k:to,t:biPlayMin(),dt});
  if(ev==='gather'){
    /* the sweep is the show, and it only ever runs on this tap: the
       dealt-out deck shuffles home in value order, the 1 leading, one
       card every 100ms (gatherHome). Holds go on before layout()'s deck
       loop runs, so nothing teleports */
    const starts=S.deck.slice()
      .sort((a,b)=>byId(a).v-byId(b).v||a-b)
      .map(id=>{const e=els[id];return e&&e._sx!=null?{id,x:e._sx,y:e._sy}:null;})
      .filter(Boolean);
    /* the deck holds until the last card lands, so the coached flick
       starts from a finished stack (the ring draining reads as busy) */
    const hold=starts.length*100+560;
    cdEnd=performance.now()+hold;cdLen=hold;
    gatherHome(starts,100);
    ttlDriftFade();   /* the pyramid is leaving: the drift sinks with it */
  }
  layout();
}
function tutDone(){
  const frm=S.tut==='end'?'end':S.tut;
  S.tut='done';S.seen.tut=true;tutHi(null);tutPaint();save(true);
  bi('tut',{k:'done',d:1,t:biPlayMin(),frm,dr:tutDr,bn:tutBn,bu:tutBu});}
function tutHi(sel){
  const sig=(sel||[]).join('|');
  if(sig===tutHiSig)return;   /* re-ringing the same targets restarts the pulse */
  tutHiSig=sig;
  tutHiEls.forEach(e=>e.classList.remove('tutG'));tutHiEls=[];
  (sel||[]).forEach(s=>{const e=$(s);if(e){e.classList.add('tutG');tutHiEls.push(e);}});
}
function tutPaint(){
  const box=$('#tut');if(!box)return;
  /* an unknown step name restarts the coach (pre-release saves only) */
  if(S.tut&&S.tut!=='done'&&S.tut!=='end'&&!TUT_TXT[S.tut])
    S.tut='pyramid';
  /* the first-load title owns the opening, and the deal that follows
     it: the coach waits till the pyramid has finished dealing out — and
     past a queued sweep, which is about to clear the felt again */
  if(ttlAlive()||pyrUndealt.length||pyrQueue){box.classList.add('off');tutHi(null);return;}
  const s=S.tut;
  if(!s||s==='done'){box.classList.add('off');tutHi(null);return;}
  /* the coached buys wait on the wallet: until the step's buy is
     affordable there is nothing to say, so the whole coach steps
     aside — it walks back in the moment the price is met (paint's
     tick re-runs this) */
  if(TUT_WAIT[s]&&!TUT_WAIT[s]()){box.classList.add('off');tutHi(null);return;}
  if(box.dataset.s!==s){box.dataset.s=s;
    box.classList.remove('in');void box.offsetWidth;box.classList.add('in');
    /* progress rides the bubble itself: the wash sweeps left to right */
    box.style.setProperty('--p',((TUT_N[s]||1)/TUT_N.end*100).toFixed(1)+'%');}
  /* the ring follows the player in: the tab pill from the table, the
   first buy button once its view is open. paint() re-runs this on its
   tick, and Tabs.go on every switch */
  tutHi(TUT_AT[s]?TUT_AT[s]():null);
  box.classList.remove('off');
  /* the poster re-renders only when its words change. SKIP rides inline
     at the text's end, except on the last bubble, where GOT IT already
     closes the run */
  const o=TUT_TXT[s]?TUT_TXT[s]():null;
  const html=o?`<div class="ph${o.bad?' bad':''}">${o.h}`+
    (o.p2?`<span class="p2">${o.p2}</span>`:'')+'</div>'+
    (o.g?`<div class="pg">${o.g}</div>`:''):'';
  if(box.dataset.h!==html){box.dataset.h=html;
    const tx=$('#tutTx');
    tx.innerHTML=html+(s==='end'
      ?'<button class="tgo" id="tutGo">GOT IT</button>'
      :'<button id="tutX">SKIP</button>');
    /* a growing snippet fades in soft, not abrupt */
    tx.classList.remove('swp');void tx.offsetWidth;tx.classList.add('swp');
    const x=$('#tutX');if(x)x.onclick=tutDone;
    const go=$('#tutGo');if(go)go.onclick=tutDone;}
}
