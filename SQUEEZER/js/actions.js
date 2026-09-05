/* ==================================================================
   actions.js — the core loop: draw, resolve, deflect, bust, bank, the
   deck-working stickers (Snip, Burn), and the armed tricks
   (Odds, Cull, Stakes, Float, Defuse, Scrap).
   One deck, many hands: draws route to one hand, a bust wipes only
   that hand. Two away piles: OUT rides the bust cycle — every bust
   brings it home and the card that landed the bust sits out till the
   next — while the discard holds ward saves and rides home on your
   next score; a bust never touches it.
   ================================================================== */
/* a deferred gameplay step (the bust unwrap, a sticker rider, a dividend
   re-score): in background mode every one runs inline.
   A throttled timer would stretch the chain to a crawl, and the frozen
   window inside a bust would straddle the return to the tab */
const runSoon=(fn,ms)=>{if(BG)fn();else setTimeout(fn,ms);};

/* pulls in flight: the riders (rip, Odds, Ward, Twin) deal a
   beat out. A bank that lands inside that window does not cash — it
   queues, and the pulls land on the still-standing hand, so a late pull
   can still bust it. 70ms after the last pull resolves, a queued bank
   cashes whatever the table holds then. Transient by nature: a reload
   simply drops the window, so the count lives here, never on the run */
const pendW=new WeakMap();
const pendAdd=h=>{const q=pendW.get(h)||{n:0};q.n++;pendW.set(h,q);};
function pendEnd(h){
  const q=pendW.get(h);
  if(!q||q.n<=0||--q.n>0||!q.q)return;
  q.q=0;
  runSoon(()=>{if(!frozen&&S.hands.indexOf(h)>=0&&canBank(h))bank(h,q.a);},70);}

function rebuildDeck(){
  revertMods();                         /* safety net: strays off the tables */
  const parked=new Set(S.out);
  if(S.gone)S.gone.forEach(id=>parked.add(id));   /* discarded for good: never deals again */
  if(S.disc)S.disc.forEach(id=>parked.add(id));   /* warded: home only on a score */
  S.hands.forEach(h=>{h.ids.forEach(id=>parked.add(id));h.run.culled.forEach(id=>parked.add(id));});
  S.deck=shuffle(S.cards.filter(c=>!parked.has(c.id)).map(c=>c.id));
  S.showTop=null;                       /* a reshuffle buries the knowledge */
}
/* first draw of a hand: opens the run, the ward stands from the shuffle */
function startHand(h){
  h.run.started=true;h.run.grace=L('grace');
}
/* hand-size and live-table records ride every card that lands */
function noteHand(h){
  if(h.ids.length>S.st.bigHand)S.st.bigHand=h.ids.length;
  const nT=S.hands.filter(x=>x.ids.length).length;
  if(nT>S.st.maxTables)S.st.maxTables=nT;
  /* stickered cards live on the tables — the Variety gate rides this */
  const nS=S.hands.reduce((a,x)=>a+x.ids.filter(id=>byId(id).stk).length,0);
  if(nS>(S.st.bigStk||0))S.st.bigStk=nS;
  /* Well Rounded: the widest value spread the boards have held at once —
     a landing can only raise it, so no tick is needed on the way out */
  const nV=new Set();S.hands.forEach(x=>x.ids.forEach(id=>nV.add(cval(byId(id)))));
  if(nV.size>(S.st.boardVals||0))S.st.boardVals=nV.size;
}
function breakChain(h){
  if(h.chainScore>S.st.bestChain)S.st.bestChain=h.chainScore;
  if(h.chain>S.st.bestChainN)S.st.bestChainN=h.chain;
  h.chain=0;h.chainScore=0;h.ironUsed=false;h.rallyUsed=false;
}

function drawCard(hi,free,auto){
  if(frozen)return false;
  if(pyrUndealt.length||boardDealing)return false;   /* the intro owns the deck */
  if(aim)cancelAim();
  const now=performance.now();
  if(!free&&now<cdEnd)return false;
  const h=S.hands[hi==null?S.focus:hi];
  if(!h.run.started)startHand(h);
  if(!S.deck.length){
    const live=S.hands.filter(canBank);
    if(live.length){toast('Deck empty\nBanking the table','card');live.forEach(x=>bank(x,auto));}
    else if(S.hands.some(x=>x.ids.length)){
      /* every table is floated dry and the deck is empty: the zero-value
         hands fold so their cards return to the deck */
      S.hands.forEach(x=>{if(x.ids.length&&!canBank(x)){
        revertLeaving(x.ids);x.ids=[];x.run=freshRun();}});
      rebuildDeck();layout();paint();}
    return false;}
  const id=S.deck[S.deck.length-1];
  if(!free){const cd=curCD();cdLen=Math.max(1,cd*1000);cdEnd=now+cd*1000;}
  const fresh=[];
  const ok=resolve(id,h,auto,fresh);
  /* Promo: the landing was free — the cooldown it stamped comes back,
     so the next card deals the moment you click */
  if(ok&&!free&&cardHas(byId(id),'promo')){cdEnd=0;
    const[fx,fy]=feltPt(FW/2,FH*.62);float('FREE',fx,fy,'#8A6A2F');}
  /* guard windows burn one draw per real draw, the guard's own landing
     excepted — an Anchor starts counting with the next card */
  if(ok){const rw=h.run;
    if(rw.anchWin&&rw.anchWin.length)rw.anchWin=rw.anchWin.filter(w=>
      fresh.indexOf(w)>=0||--w.left>0);}
  return ok;
}
/* the pre-flick tick, one beat a frame: cards pulled mid-cooldown wait
   face-down on the felt until the ring clears, then land as real draws
   — one per beat, the last one stamps the ring, the rest land free (a
   whole parked burst drains on one cooldown). A reshuffle (a bank or a
   bust while cards wait) scrambles the deck: any waiter that lost its
   top seat goes home. Frozen never flips — a bust mid-burst leaves the
   rest parked for the next window */
function preDropTick(rem){
  if(!preDrops.length||!S.deck.length)return;
  const seats=S.deck.slice(-preDrops.length);
  if(preDrops.some(id=>!seats.includes(id))){
    preDrops=preDrops.filter(id=>seats.includes(id));layout();return;}
  if(rem>0||frozen||boardDealing||pyrUndealt.length)return;
  const tid=S.deck[S.deck.length-1];
  preDrops.splice(preDrops.indexOf(tid),1);
  drawCard(null,preDrops.length>0);   /* free while waiters remain: one ring per burst */
}
function resolve(id,h,auto,fresh){
  fresh=fresh||[];
  /* the gauge as the player faced it, the drawn card still in the deck:
     the cold-ward gate reads this, never the post-draw deck */
  const preTh=threat(h);
  const i=S.deck.indexOf(id);if(i>=0)S.deck.splice(i,1);
  if(id===S.showTop)S.showTop=null;     /* the reveal is spent with the card */
  const c=byId(id);S.st.draws++;
  const _s0=S.score;   /* the draw's own pays (Tribute, Rake) ride its log entry */
  /* the automation ledger: a draw the autos made stamps the run, so a
     bust there later reads as theirs */
  if(auto){S.st.aDraws=(S.st.aDraws||0)+1;h.run.autoDeal=true;}else h.run.autoDeal=false;
  ttlOff();   /* the first-load title's whole job ends at the first real draw */
  const r=h.run;
  /* the ward rider protects exactly one draw: the extra card a Ward
     pulls. Spent whether or not it was needed */
  const wardRide=wardNext===h;if(wardRide)wardNext=null;
  /* Odds' rider rides one pull exactly: spent even when the pull never
     lands (bust, ward, slip) — the flip never waits for a later draw */
  const oddsRide=oddsNext===h;if(oddsRide)oddsNext=null;
  /* Twin's rider protects one pull the other way round: the twin it
     pulls lands bust-proof (no shield is consulted, the value may
     repeat), a blank benches straight to the discard */
  const twinRide=twinNext===h;if(twinRide)twinNext=null;
  /* Flinch: a standing Flinch refuses its own value — a drawn card
     matching it never lands and goes straight OUT. The match alone
     decides: it reads before Near Mint's bend and before every shield,
     so wards stay pocketed and even a rider's pull is not exempt.
     One catch a run: the trigger spends the Flinch — the ring dies and
     the sticker fades (r.spent, the same ledger the tricks use) */
  const flx=h.ids.find(x=>{const f=byId(x);return f.stk==='flinch'&&cval(f)===cval(c)&&r.spent.indexOf(x)<0;});
  if(flx!=null){
    r.spent.push(flx);
    toOut(id);slam('FLINCH','#2C563C');
    SFX.stk('flinch','act',cval(c));buzz(18);layout();paint();save();checkFloatAll();return true;}
  /* Near Mint bends before anyone reads the card: a twin draw dings
       its value 1 lower, permanently (c.nb), then the whole safe read
       runs again on the new value. Wards and dodges never hear of it */
  if(cardHas(c,'nearmint')&&cval(c)>0){
    const p0=pureVals(h),t0=h.ids.find(x=>cval(byId(x))===cval(c));
    if(t0&&!p0.has(cval(c))){
      c.nb=(c.nb||0)+1;faceOf(c);
      const[nx,ny]=feltPt(FW/2,FH*.3);
      float('NEAR MINT '+cval(c),nx,ny,'#3E7A5E');SFX.detent();buzz(10);}
  }
  const p=pureVals(h),twin=h.ids.find(x=>cval(byId(x))===cval(c));
  const safe=!twin||c.stk==='purify'||p.has(cval(c));
  /* Twin's pulled twin never enters the chain: it lands, and the
     one-value-per-hand rule bows out for it — no Bent exile either once
     the condition had its say above */
  if(safe&&twinRide){
    SFX.stk('twin','act',cval(c));
    wardFlight(id);          /* the bench glide: no ward show, no bust */
    const[x,y]=feltPt(OX,OY);float('TWIN\nA '+cval(c)+' WAITS',x,y-16,'#4A5A66');
    layout();paint();save();return true;}
  if(!safe&&!twinRide){
    /* Bent: the condition exiles its own card before any shield is
       consulted — the wards stay pocketed, the hand stands, and the
       OUT pile takes the seat (home on the next bust) */
    if(cardHas(c,'bent')){
      toOut(c.id);slam('BENT','#2C563C');
      SFX.buy();buzz(18);layout();paint();save();checkFloatAll();return true;}
    /* Anchor's guard cuts in before everything: a twin of a standing
       guard was never really drawn — it slips back into the deck at a
       random depth, the same half-draw show a Marked dodge plays */
    r.anchWin=r.anchWin||[];
    const gw=r.anchWin.find(w=>w.left>0&&cval(byId(w.id))===cval(c));
    if(gw)return deflect(id,'SLIPPED');
    /* Cull intercepts before any insurance: the round leaves the deck */
    if(r.armedC!=null){
      const cid=r.armedC;r.armedC=null;r.spent.push(cid);r.culled.push(id);
      slam('CULL','#46422F');
      SFX.burn();SFX.stk('cull','act',cval(byId(id)));buzz(18);layout();paint();save();checkFloatAll();return true;}
    /* the ward rider takes the hit first — a pulled card is protected
       outright, so Grace stays in pocket. A ward save (rider or Grace)
       benches the drawn card in the discard */
    if(wardRide){r.wardBreak=performance.now();noteWard(preTh);SFX.stk('ward','act',cval(byId(id)));return deflect(id,'WARDED',true);}
    if(r.grace>0){r.grace--;r.wardBreak=performance.now();noteWard(preTh);return deflect(id,'WARD',true);}
    const dodge=dodgeOf(h);
    if(Math.random()<Math.min(ECO.DODGE_CAP,dodge))return deflect(id,'SLIPPED');
    bust(c,twin,h,preTh);return true;
  }
  h.ids.push(id);
  noteHand(h);
  if(twinRide)slam('TWIN','#3E5A78');   /* the pulled twin sat down anyway */
  if(!auto)stress=1;   /* a card you played re-spikes the heart */
  /* per-hand draw record: the Long Hand ladder reads it */
  r.draws=(r.draws||0)+1;
  if(r.draws>S.st.bestHandDraws)S.st.bestHandDraws=r.draws;
  /* No Touching: the WHOLE hand spread out — every pair of values 2+ apart */
  const spr=[];h.ids.forEach(x=>spr.push(cval(byId(x))));spr.sort((a,b)=>a-b);
  let spread=spr.length>0;
  for(let i=1;i<spr.length;i++)if(spr[i]-spr[i-1]<2)spread=false;
  if(spread&&spr.length>(S.st.spread||0))S.st.spread=spr.length;
  SFX.draw(cval(c));buzz(8);setTimeout(()=>SFX.land(cval(c)),165);
  c.dud=false;c.boom3=false;
  {const ce=els[id];if(ce)ce.classList.remove('boom3','dud');}
  /* Odds' rider: the card it pulled gambles the moment it lands —
     triple value or a dud, never the Odds card itself. faceOf paints
     the ring on the winner, the gray wash on the dud */
  if(oddsRide){const win=Math.random()<.5;
    if(win)c.boom3=true;else c.dud=true;
    faceOf(c);
    setTimeout(()=>{const[x,y]=feltPt(FW/2,FH*.3);float(win?'TRIPLE':'DUD',x,y-20,win?'#2C563C':'#8E2B1C');
      SFX.stk('odds','act',cval(c));},120);}
  /* a ripped card pays its scar on every landing: 1 ward, then the tear
     rips the deck forward and 2 more cards come, free. The ward can
     catch either pull's bust: the scar insures its own draw */
  if(cardHas(c,'ripped')){
    r.grace++;
    const[wx,wy]=feltPt(FW/2,FH*.24);float('+1 WARD',wx,wy,'#3E7A5E');
    if(echoD<10){echoD+=2;const eh=S.hands.indexOf(h);
      pendAdd(h);pendAdd(h);
      [1,2].forEach(n=>runSoon(()=>{
        const h2=S.hands[eh];
        if(!h2||frozen){echoD--;pendEnd(h);return;}
        drawCard(eh,true,true);echoD--;pendEnd(h);},280*n));}
  }
  /* the pop is a deferred class flip: hold the element, never re-look it
     up — the roster can be rebuilt (boot, ascension) inside the timeout */
  const popEl=els[id];
  const pop=()=>{if(!popEl)return;popEl.classList.add('pop');
    setTimeout(()=>popEl.classList.remove('pop'),520);};
  if(c.stk==='tribute'){
    const g=c.v*ECO.TRIBUTE_X*valueMult();S.score+=g;S.life+=g;
    const[x,y]=feltPt(FW/2,FH*.3);float('+'+fmt(g),x,y-26,'#8A6A2F');SFX.stk('tribute','draw',cval(c));
    pop();}
  if(c.stk==='snip')doSnip(c);
  if(c.stk==='burn')doBurn();
  if(c.stk==='whip')doWhip();
  if(c.stk==='encore')doEncore(c);
  if(c.stk==='rake'){
    const g=ECO.RAKE_PER*outCount()*valueMult();S.score+=g;S.life+=g;
    const[x,y]=feltPt(FW/2,FH*.3);float('RAKE\n+'+fmt(g),x,y-26,'#3E7A5E');SFX.stk('rake','draw',cval(c));
    pop();}
  if(r.stakesD>0&&r.stakesIds.length){r.stakesD--;if(!r.stakesD){r.spent.push(...r.stakesIds);r.stakesIds=[];}}
  logAct('draw',S.score-_s0,auto);
  biFirst('draw');
  layout();paint();save();
  checkFloatAll();
  /* Anchor's guard opens on its landing: for the next few draws, any
     card that twins the Anchor's own value slips back into the deck
     instead of busting the hand. The landing draw itself never counts
     against the window */
  if(c.stk==='anchor'){
    r.anchWin=r.anchWin||[];
    const w={id:id,left:ECO.ANCHOR_DRAWS};
    r.anchWin.push(w);fresh.push(w);
    const[ax,ay]=feltPt(FW/2,FH*.24);
    float('GUARD '+ECO.ANCHOR_DRAWS+' DRAWS',ax,ay,'#3E5A78');SFX.stk('anchor','arm',cval(c));buzz(10);}
  /* Reverb's cut: a beat after it lands, the deck's next card is benched
     to the discard. If it was this card's own twin, the near-bust pays
     a ward — the flight shows the cut face-up either way */
  if(c.stk==='reverb'){const eh=S.hands.indexOf(h);
    runSoon(()=>{
      const h2=S.hands[eh];
      if(!h2||frozen||!S.deck.length)return;
      const tid=S.deck.pop();
      benchSafe(tid);
      const hit=cval(byId(tid))===cval(c);
      wardFlight(tid);
      if(hit){h2.run.grace++;
        const[wx,wy]=feltPt(FW/2,FH*.24);float('+1 WARD',wx,wy,'#3E7A5E');}
      else{const[x,y]=feltPt(OX,OY);float('CUT A '+byId(tid).v,x,y-16,'#4A5A66');}
      SFX.burn();SFX.stk('reverb','act',cval(byId(tid)));buzz(hit?18:10);layout();paint();save();
    },280);}
  /* Odds pulls a free card and hands the gamble to it: the 50/50 flips
     on the pull the moment it lands, not on the Odds card */
  if(c.stk==='odds'&&echoD<10){echoD++;SFX.stk('odds','arm',cval(c));const eh=S.hands.indexOf(h);
    pendAdd(h);
    runSoon(()=>{
      const h2=S.hands[eh];
      if(!h2||frozen){echoD--;pendEnd(h);return;}
      oddsNext=h2;const ok=drawCard(eh,true,true);
      if(ok)S.st.stkDraws=(S.st.stkDraws||0)+1;else oddsNext=null;echoD--;pendEnd(h);},280);}
  /* Ward's rider: the extra card it pulled cannot bust. It resolves like
     any draw — a twin is warded to the discard, a blank lands */
  if(c.stk==='ward'&&echoD<10){echoD++;SFX.stk('ward','arm',cval(c));const eh=S.hands.indexOf(h);
    pendAdd(h);
    runSoon(()=>{
      const h2=S.hands[eh];
      if(!h2||frozen){echoD--;pendEnd(h);return;}
      wardNext=h2;const ok=drawCard(eh,true,true);
      if(ok)S.st.stkDraws=(S.st.stkDraws||0)+1;else wardNext=null;echoD--;pendEnd(h);},280);}
  tutEvent('draw');
  return true;
}
/* Ward saves bench the card: the drawn round waits in the discard, home
   on your next score. A dodge plays it deeper: the round shuffles back
   into the deck, the half-draw shown first */
/* the ward save's moment: the saved round lifts off the deck face-up,
   hangs a beat, then glides the rest of the way into the discard pile */
function wardFlight(id){
  toDisc(id);
  const e=els&&els[id];if(!e)return;
  if(BG){layout();return;}   /* hidden: the card benches, no flight to throttle */
  SFX.slide();
  fanHold(id,1400);   /* layout keeps its hands off the card mid-flight */
  /* the card rests in the deck by left/top: re-anchor that spot as a
     transform, frozen, so the lift animates from the stack */
  e.style.transition='none';
  e.style.left='0px';e.style.top='0px';
  e.style.transform=`translate(${DX}px,${DY}px)`;
  e.classList.remove('flat');e.classList.remove('buried');
  void e.offsetWidth;
  e.style.transition='transform .5s cubic-bezier(.25,.9,.35,1)';
  e.style.transform=`translate(${DX}px,${Math.max(90,DY-280).toFixed(0)}px) rotate(-7deg)`;
  e.classList.add('faceup');e.style.zIndex=960;
  setTimeout(()=>{fanBusy.delete(id);e.style.transition='';
    e.style.zIndex='';layout();},640);
}
/* a ward save under the cold line feeds Grace's level-2 gate, and every
   spent shield counts as lost (Broken Guards). Ward's rider and Grace
   count alike; dodges and Defuse are not wards */
const noteWard=pre=>{S.st.wardLost=(S.st.wardLost||0)+1;
  if(pre<ECO.COLD_AT)S.st.coldWards=(S.st.coldWards||0)+1;};
function deflect(id,label,disc){
  S.st.deflects=(S.st.deflects||0)+1;
  /* the slips are the shuffle-backs: a Marked dodge or an Anchor guard
     twin. Wards never slip, they bench the card */
  if(label==='SLIPPED')S.st.slips=(S.st.slips||0)+1;
  if(disc)wardFlight(id);else slipBack(id);
  layout();
  slam(label,'#2C563C');
  SFX.buy();buzz(26);paint();save();return true;
}
/* the dodge's return, better than a bounce: the round is filed back into
   the deck at a random depth — a real shuffle, the top included — so it
   never sits waiting on the very next draw. On screen it plays the
   half-draw it survived: up out of the stack face-up, a beat to be read,
   then tucked back under with a shuffle. The game holds like a bust
   while the face shows, so nothing can draw the peeking card mid-peek
   or reshuffle the deck around it */
function slipBack(id){
  const at=rndi(S.deck.length+1);
  S.deck.splice(at,0,id);
  if(at===S.deck.length-1)S.showTop=null;   /* it took the crown: Tell's reveal is spent */
  if(BG)return;                             /* hidden: filed back, no show */
  const e=els[id];if(!e)return;
  SFX.slide();
  frozen=true;
  fanHold(id,2100);
  /* the deck's rest pose re-anchored as a frozen transform first: the
     peek rises from the stack, never the corner */
  e.style.transition='none';
  e.style.left='0px';e.style.top='0px';
  e.style.transform=`translate(${DX}px,${DY}px)`;
  e.classList.remove('flat','buried');
  void e.offsetWidth;
  e.style.zIndex=950;
  e.style.transition='transform .4s cubic-bezier(.25,.9,.35,1)';
  e.style.transform=`translate(${DX}px,${(DY-CUR_CH*.62).toFixed(0)}px) rotate(4deg)`;
  e.classList.add('faceup');
  setTimeout(()=>{                          /* a beat with the face out */
    SFX.shuffle();deckJiggle();
    e.classList.remove('faceup');           /* the flip rides the tuck */
    e.style.transition='transform .36s cubic-bezier(.5,0,.6,1)';
    e.style.transform=`translate(${DX}px,${DY}px)`;
    setTimeout(()=>{
      fanBusy.delete(id);
      if(els[id]===e){e.style.transition='';e.style.zIndex='';}
      frozen=false;layout();paint();
    },380);
  },640);
}
function bust(c,twinId,h,preTh){
  frozen=true;
  /* the bust card never sat down: the record and Salvage read the standing
     hand only — its value joins no table and no score. The CARD itself still
     rides on-bust effects: a Siphon that lands the bust pays its own ×10 */
  /* the deck as the player faced the draw: the buster still counted in it
     (it matched a standing value or it could not have busted). The record,
     the pays and the preview quote this view — pulling the killer out of
     the deck moves no number on the hand it killed */
  const pre={rx:riskyIn(h)+1,n:S.deck.length+1};
  const tot=handParts(h,false,null,pre).total;
  /* the ghost quote, captured before anything the break touches: the total,
     the premium and the threat all read the deck the player faced, the
     chain still stands. The window replays this verbatim */
  bustGhost={tot,prem:riskPremT(pre.rx/pre.n,h),th:preTh,chain:h.chain};
  if(tot>S.st.bestBust)S.st.bestBust=tot;
  S.st.bustSum=(S.st.bustSum||0)+tot;   /* the bust ledger: standing value lost */
  const salv=tot*.07*L('salv');
  let keep=salv;
  /* Silver Lining: a bust under the cold line pays the standing table out
     flat — no premium, no rolls, the wage of a risk nobody banked. It is
     the one bust pay that reaches banked: it stands in for the bank. The
     gauge is the one the player faced, the drawn card still in the deck —
     the same reading the cold-ward gate counts */
  const silver=M('silver')&&preTh<ECO.COLD_AT
    ?handParts(h,true,null,pre).total:0;
  if(silver)keep+=silver;
  /* Guardian: while it sits OUT, the bust rolls a 1/3 to stand in for
     the bank — the same flat pay Silver Lining makes */
  const guard=S.out.some(oid=>byId(oid).stk==='guardian')
    &&Math.random()<ECO.GUARD_CH?handParts(h,true,null,pre).total:0;
  if(guard)keep+=guard;
  /* Paper Cut: the bust caught a 2-card hand, both cards papered */
  if(h.ids.length===2&&h.ids.every(x=>byId(x).stk))
    S.st.twoStkBusts=(S.st.twoStkBusts||0)+1;
  /* Pileup: the widest hand a bust ever caught — read before the
     buster joins it, the standing table as it died */
  if(h.ids.length>(S.st.bigBustN||0))S.st.bigBustN=h.ids.length;
  h.ids.push(c.id);bustPair=[c.id,twinId];
  for(const id of h.ids){const k=byId(id);if(k.stk==='siphon')keep+=cval(k)*ECO.SIPHON_X*valueMult();}
  const siph=keep-salv-silver-guard;
  S.st.busts++;S.st.runs++;S.st.streak=0;S.st.hotRun=[0,0,0];S.st.wideRun=0;S.st.row3=0;S.st.sevenRun=0;   /* a bust breaks the hot and wide rows */
  if(h.run.autoDeal)S.st.aBusts=(S.st.aBusts||0)+1;   /* the hand's last card was the autos' deal */
  /* Snake Eyes: consecutive busts landed on the pair of 2s — any other
     bust breaks the row, banks ride through. The buster sits OUT till the
     next bust, so the second landing wants help: Fetch runs a 2 home,
     Swap or Dredge clones it back into play */
  S.st.db2Run=cval(c)===2?(S.st.db2Run||0)+1:0;
  if(S.st.db2Run>(S.st.db2Best||0))S.st.db2Best=S.st.db2Run;
  if(cval(c)===2)S.st.db2N=(S.st.db2N||0)+1;   /* Two Timer counts landings, not the row */
  /* Hard Luck: busts under the halfway line, in a row — the pre-draw
     gauge is the one the player faced. A hot bust breaks the row, so
     does a bank */
  S.st.bustRun=preTh<.5?(S.st.bustRun||0)+1:0;
  if(S.st.bustRun>(S.st.bestBustRun||0))S.st.bestBustRun=S.st.bustRun;
  /* Long Odds: landings at or under the 5% line, lifetime */
  if(preTh<=ECO.LONG_AT)S.st.coldBusts=(S.st.coldBusts||0)+1;
  /* the last 5 bust risks, rolling — 5 cold ones in a row unlock the
     holo press (shinyUn, economy.js). Post-draw reading: the buster is
     already out of the deck, so it moves neither this nor any gauge */
  const bth=threat(h);
  S.st.bustLog=[...(S.st.bustLog||[]).slice(-4),bth];
  /* the strip logs the bust: v is the standing total it killed — the
     ghost window's own number — while s keeps the wreck's pay so the
     sheet's rate counts only what it earned */
  S.st.handLog=[...(S.st.handLog||[]).slice(-9),
    {b:0,s:keep,v:tot,r:Math.round(bth*100),t:Date.now(),a:h.run.autoDeal?1:0}];
  if(L('iron')&&!h.ironUsed&&h.chain>0){h.ironUsed=true;toast('Iron Nerve\nChain held','link');}
  else if(M('rally')&&!h.rallyUsed&&h.chain>0){h.rallyUsed=true;toast('Rally\nChain held','link');}
  else breakChain(h);
  layout();SFX.bust();shake();buzz([35,50,90]);
  const[x,y]=feltPt(FW/2,FH*.34);spray(x,y,'#8E2B1C',26);slam('BUST','#8E2B1C');
  if(keep>0){S.score+=keep;S.life+=keep;if(silver)S.banked+=silver;if(guard)S.banked+=guard;
    if(silver||guard)S.st.bankSum=(S.st.bankSum||0)+silver+guard;   /* flat bust pays reach the banked line */
    let d=380;
    if(salv>0){setTimeout(()=>float('SALVAGE\n+'+fmt(salv),x,y+48,'#8A6A2F'),d);d+=140;}
    if(siph>0){setTimeout(()=>{float('SIPHON\n+'+fmt(siph),x,y+48,'#8A6A2F');SFX.stk('siphon','bust');},d);d+=140;}
    if(silver>0)setTimeout(()=>float('SILVER\n+'+fmt(silver),x,y+48,'#2A4761'),d);
    if(guard>0)setTimeout(()=>{float('GUARD\n+'+fmt(guard),x,y+48,'#2A4761');SFX.stk('guardian','bust');},d);}
  logAct('bust',keep,h.run.autoDeal);
  biFirst('bust');
  paint();save(true);
  tutEvent('bust');
  runSoon(()=>{
    /* everyone folds into the sweep home: the busted hand rides the
       same cascade as the OUT pile, face-up over the arc and back-down
       into the tuck. The buster is not riding — it takes its seat in OUT */
    const going=h.ids.filter(id=>id!==c.id);
    revertLeaving(going);   /* the sweep flies printed faces */
    h.ids=[];
    h.run=freshRun();h.run.rebound=M('rebound')>0;
    h.run.grace=L('grace');   /* the ward stands from the shuffle, not the first draw */
    /* the bust cycle: the whole OUT pile rides home, the card that
       landed the bust takes its place till the next bust. The
       discard is not swept: a ward save waits for a score */
    const spot=id=>{const e=els[id];return e&&e._sx!=null?{id,x:e._sx,y:e._sy}:null;};
    const ride=S.out.map(spot).concat(going.map(spot)).filter(Boolean);
    /* the lifts come home too: the shuffle voids the wait, and they fly
       face-down with the sweep */
    if(preDrops.length){
      const fr2=$('#felt').getBoundingClientRect();
      preDrops.forEach(id=>{const e=els[id];
        if(e){const r=e.getBoundingClientRect();
          ride.push({id,x:r.left-fr2.left+r.width/2,y:r.top-fr2.top+r.height/2,down:1});}});
      preDrops=[];
    }
    S.out=[];
    toOut(c.id,true);   /* the seat is free: no outed tick */
    bustPair=null;bustGhost=null;rebuildDeck();SFX.shuffle();
    frozen=false;layout();paint();SFX.slide();fanHome(ride);},950);}
/* the gamble stickers roll once per bank, per copy: hits ride the total,
   misses sit. Busts, Float and the readout never roll */
function rollStk(h){
  const r={bloom:0,kindle:0,bl:0,kd:0};
  for(const id of h.ids){const c=byId(id);
    if(c.stk==='bloom'){r.bl++;
      if(Math.random()<ECO.BLOOM_CHANCE)r.bloom++;}
    if(c.stk==='kindle'){r.kd++;
      if(Math.random()<ECO.KINDLE_CHANCE)r.kindle++;}}
  return r;
}
/* Dividend's second pass: the table's payout lands again, in its green.
   The cards are long gone by then — the amount was captured at bank */
function reScore(s){
  S.score+=s;S.banked+=s;S.life+=s;S.st.bankSum=(S.st.bankSum||0)+s;
  logAct('res',s);
  if(s>S.st.bestBank)S.st.bestBank=s;
  const[x,y]=feltPt(FW/2,FH*.32);
  spray(x,y,'#3E7A5E',scoreSpk(s));slam(fmt(s),'#3E7A5E');
  SFX.bank(1,1);SFX.stk('dividend','bank');buzz(20);scorePulse();
  float('DIVIDEND',x,y+34,'#3E7A5E');
  paint();save(true);
}
function bank(h,auto){
  if(!h.ids.length||frozen||!canBank(h))return;
  const pq=pendW.get(h);
  if(pq&&pq.n>0){pq.q=1;pq.a=auto;return;}   /* pulls in flight: the bank queues behind them */
  const _s0=S.score;   /* the bank's entry carries every on-bank pay (Mint, Remnant, rolls) */
  if(aim)cancelAim();                   /* a bank is a shuffle: the aim is void */
  const risk=threat(h),prem=riskPrem(h);
  /* Hexed's read: the risky-card count this bank was paid on */
  const live=riskyIn(h);if(live>(S.st.bestRisky||0))S.st.bestRisky=live;
  const roll=rollStk(h);
  let s=handParts(h,false,roll).total;
  const house=!h.chain&&L('house');
  if(house)s*=ECO.HOUSE_X;
  S.score+=s;S.banked+=s;S.life+=s;S.st.bankSum=(S.st.bankSum||0)+s;
  S.st.banks++;S.st.runs++;
  /* the sheet's last-10 strip: every settled hand logs its pay (s),
     its worth at settle (v — the same number for a bank) and the
     gauge it was read at */
  S.st.handLog=[...(S.st.handLog||[]).slice(-9),
    {b:1,s,v:s,r:Math.round(risk*100),t:Date.now(),a:auto?1:0}];
  /* the automation ledger: what the autos cashed, and their best single pay */
  if(auto){S.st.aBanks=(S.st.aBanks||0)+1;S.st.aGain=(S.st.aGain||0)+s;
    if(s>(S.st.aBest||0))S.st.aBest=s;}
  /* Payday: a bank with a real hand behind it, not a one-card drip */
  if(h.ids.length>=3)S.st.bigBanks=(S.st.bigBanks||0)+1;
  /* Daredevil: banks cashed over the halfway line, lifetime */
  if(risk>.5)S.st.hotBanks=(S.st.hotBanks||0)+1;
  /* any bank breaks the bust row (Hard Luck) */
  S.st.bustRun=0;
  /* Hot Streak: a row of 100K+ banks — a smaller bank or a bust breaks it */
  if(s>=ECO.STREAK_AT){S.st.streak=(S.st.streak||0)+1;
    if(S.st.streak>(S.st.bestStreak||0))S.st.bestStreak=S.st.streak;}
  else S.st.streak=0;
  /* a chain tick wants a bank big enough for the combo: 2 cards, +1 per
     10 chain (chainReq). Smaller banks are chain-neutral */
  if(h.ids.length>=chainReq(h.chain)){h.chain++;h.chainScore+=s;}
  if(risk>S.st.bestRisk)S.st.bestRisk=risk;
  /* hot streaks: consecutive banks past each line — a cold bank breaks
     the row, a bust sweeps it (Nerve Test / Running Hot / High Wire) */
  S.st.hotRun=ECO.HOT_AT.map((at,i)=>{
    const r=risk>=at?((S.st.hotRun&&S.st.hotRun[i])||0)+1:0;
    if(r>(S.st['hot'+(60+i*10)]||0))S.st['hot'+(60+i*10)]=r;
    return r;});
  /* wide rows: consecutive banks holding 5+ — a thin bank breaks the
     row, a bust sweeps it (On a Roll); haste's row asks the same of 3+ */
  S.st.wideRun=h.ids.length>=5?(S.st.wideRun||0)+1:0;
  if(S.st.wideRun>(S.st.bestWide||0))S.st.bestWide=S.st.wideRun;
  S.st.row3=h.ids.length>=3?(S.st.row3||0)+1:0;
  if(S.st.row3>(S.st.bestRow3||0))S.st.bestRow3=S.st.row3;
  S.st.sevenRun=h.ids.length===7?(S.st.sevenRun||0)+1:0;
  if(S.st.sevenRun>(S.st.bestSeven||0))S.st.bestSeven=S.st.sevenRun;
  if(s>S.st.bestBank)S.st.bestBank=s;
  if(h.chainScore>S.st.bestChain)S.st.bestChain=h.chainScore;
  if(h.chain>S.st.bestChainN)S.st.bestChainN=h.chain;
  const dt=Math.max(.6,(performance.now()-runT)/1000);runT=performance.now();
  S.rate=S.rate?S.rate*.85+(s/dt)*.15:s/dt;
  const n=h.ids.length,[x,y]=feltPt(FW/2,FH*.32);
  /* the slam is the one number of the moment — particles carry the rest */
  spray(x,y,'#2C563C',scoreSpk(s));slam(house?'HOUSE '+fmt(s):fmt(s),'#2C563C');
  SFX.bank(n,prem);buzz(20);warm();scorePulse();
  const purge=h.ids.some(id=>byId(id).stk==='purge'),
        fallout=!purge&&h.ids.some(id=>byId(id).stk==='fallout');
  /* snapshot the table where it sits: every card bound for the deck keeps
     its spot for the fan-home */
  const fr=$('#felt').getBoundingClientRect();
  const back=(purge||fallout)?[]:h.ids.reduce((a,id)=>{
    const e=els[id];
    if(e&&byId(id).stk!=='vanish'){const r=e.getBoundingClientRect();
      a.push({id,x:r.left-fr.left+r.width/2,y:r.top-fr.top+r.height/2});}
    return a;},[]);
  /* the discard rides home with the sweep: a score is what springs the
     warded cards, so they join the same cascade into the deck */
  if(S.disc)S.disc.forEach(id=>{const e=els[id];
    if(e&&e._sx!=null)back.push({id,x:e._sx,y:e._sy});});
  /* the early lifts come home with the sweep too: a bank is a shuffle,
     the wait is void — they fly back face-down with the cascade */
  preDrops.forEach(id=>{const e=els[id];
    if(e){const r=e.getBoundingClientRect();
      back.push({id,x:r.left-fr.left+r.width/2,y:r.top-fr.top+r.height/2,down:1});}});
  preDrops=[];
  let mint=0,divHits=0,divCards=0;
  for(const id of h.ids){const c=byId(id);
    if(c.stk==='relic'){c.r=(c.r||0)+1;faceOf(c);SFX.stk('relic','bank',cval(c));}
    if(c.stk==='mint')mint+=cval(c)*ECO.MINT_X*valueMult();
    if(c.stk==='dividend'){divCards++;
      if(Math.random()<ECO.DIVIDEND_CHANCE)divHits++;}}
  if(mint){S.score+=mint;S.life+=mint;}
  /* Remnant: values parked in the discard pay at the score — read while
     the pile still stands, copies stack */
  let rem=0;
  if(S.disc)for(const did of S.disc)if(byId(did).stk==='remnant')
    rem+=cval(byId(did));
  if(rem){const g=rem*valueMult();S.score+=g;S.life+=g;}
  /* Exit: the bench's cut — 2% of the discard's total value pays at the
     score, per copy, read while the pile still stands (the sweep below
     springs it home; Purge's fill lands after, so it pays next bank) */
  let exv=0;
  const exC=h.ids.reduce((a,id)=>a+(byId(id).stk==='exit'?1:0),0);
  if(exC&&S.disc)for(const did of S.disc)exv+=cval(byId(did));
  if(exv){exv*=ECO.EXIT_PER*exC;const g=exv*valueMult();S.score+=g;S.life+=g;}
  /* every fired gamble tallies: Bloom, Kindle and Dividend hits feed
     the gamble goal */
  S.st.hits=(S.st.hits||0)+roll.bloom+roll.kindle+divHits;
  /* The Works: all three gambles fire on one bank */
  if(roll.bloom&&roll.kindle&&divHits)S.st.works=(S.st.works||0)+1;
  /* the roll's story: what fired into the mult, then the on-top payers.
     Brass leads — the table wage, quoted pre-multiplier like the tag.
     The slam above is already the sum of it all */
  const flows=[];
  const brWage=ECO.BRASS_SCORE*h.ids.reduce((a,id)=>a+(byId(id).stk==='brass'?1:0),0)**2*n;
  if(brWage)flows.push(['brass','BRASS\n+'+fmt(brWage),'#8A6A2F']);
  if(roll.bloom)flows.push(['bloom','BLOOM\n+'+(ECO.BLOOM_PER*roll.bloom*roll.bl*n).toFixed(2)+'×','#C25B7C']);
  if(roll.kindle)flows.push(['kindle','KINDLE\n+'+(ECO.KINDLE_PER*roll.kindle*(n-1)).toFixed(2)+'×','#C6551F']);
  if(mint)flows.push(['mint','MINT\n+'+fmt(mint),'#2F6B54']);
  if(rem)flows.push(['remnant','REMNANT\n+'+fmt(rem*valueMult()),'#41618F']);
  if(exv)flows.push(['exit','EXIT\n+'+fmt(exv*valueMult()),'#2E6E8E']);
  flows.forEach((f,i)=>setTimeout(()=>{SFX.stk(f[0],'bank');float(f[1],x,y+34,f[2]);},240+i*140));
  /* Dividend hits re-run the scoring: the first payout finishes, a 400ms
     beat, then the table pays again — per hit, a beat apart */
  for(let i=0;i<divHits;i++)runSoon(()=>reScore(s),400+i*400);
  /* composition bonuses: the loadout is the puzzle. Twin Town counts a
     doubled sticker, Balanced Books a hand whose twins all sit OUT (read
     before any of the hand leaves), a boomerang a card Fetch ran home
     that this bank finally cashed */
  const sk=h.ids.map(id=>byId(id).stk).filter(Boolean);
  if(new Set(sk).size<sk.length)S.st.twinTowns=(S.st.twinTowns||0)+1;
  /* Collage: the widest sticker spread one bank has held */
  if(new Set(sk).size>(S.st.stkKinds||0))S.st.stkKinds=new Set(sk).size;
  /* No Small Change: a real hand with no small cards on it */
  if(h.ids.length>=3&&h.ids.every(id=>cval(byId(id))>=3))S.st.richBanks=(S.st.richBanks||0)+1;
  /* Inked Up: a real hand where every card wears a sticker */
  if(h.ids.length>=5&&h.ids.every(id=>byId(id).stk))S.st.inkBanks=(S.st.inkBanks||0)+1;
  /* Papered banks: every stickered card this bank cashed, lifetime —
     Preprint's gate, fed by any placed sticker */
  S.st.stkBanked=(S.st.stkBanked||0)+h.ids.reduce((a,id)=>a+(byId(id).stk?1:0),0);
  /* Fives banked, lifetime: Centapent's count (shown values, so a
     rewrite to or from a 5 moves it) */
  S.st.fiveBanks=(S.st.fiveBanks||0)+h.ids.reduce((a,id)=>a+(cval(byId(id))===5?1:0),0);
  /* Clockwork: the hand ticks through the low trio, a 1 a 2 and a 3 */
  if([1,2,3].every(v=>h.ids.some(id=>cval(byId(id))===v)))S.st.oneTwoThree=(S.st.oneTwoThree||0)+1;
  /* Rainbow: a full hand with no twins on it */
  if(h.ids.length>=7&&new Set(h.ids.map(id=>cval(byId(id)))).size===h.ids.length)
    S.st.rainbows=(S.st.rainbows||0)+1;
  /* the pair build: duplicated values only sit in a hand via Twin's
     pull or a Purify seat. Pairs counts values held twice or more, the
     stack is the deepest one-value run ever banked (Quadro claims /4,
     the ladder can claim /8 later) */
  {const vc={};h.ids.forEach(id=>{const v=cval(byId(id));vc[v]=(vc[v]||0)+1;});
   const ns=Object.values(vc),pairs=ns.filter(n=>n>=2).length;
   if(pairs>(S.st.bestPairs||0))S.st.bestPairs=pairs;
   const stack=Math.max(0,...ns);
   if(stack>(S.st.bestStack||0))S.st.bestStack=stack;}
  if(h.ids.length>=3&&h.ids.every(id=>S.out.some(o=>cval(byId(o))===cval(byId(id)))))
    S.st.books=(S.st.books||0)+1;
  if(S.rf&&S.rf.length){const homed=h.ids.filter(id=>S.rf.includes(id));
    if(homed.length){S.st.boomerangs=(S.st.boomerangs||0)+homed.length;
      S.rf=S.rf.filter(r=>!homed.includes(r));}}
  /* the table lifts: rewrites and gamble states die here, so every card
     — home to the deck or out via Vanish, Purge, Fallout — flies wearing
     its printed face. Purge's hand benches to the discard after the
     sweep below */
  revertLeaving(h.ids);
  if(fallout){
    h.ids.forEach(toOut);
    /* Fallout discards for good: the cards leave the OUT cycle and never
       deal again, but they keep feeding every per-card-out payoff */
    S.gone.push(...h.ids);
    S.out=S.out.filter(id=>!h.ids.includes(id));
    toast('Fallout\nThe hand is gone for good','ban');SFX.stk('fallout','bank');}
  else h.ids.forEach(id=>{if(byId(id).stk==='vanish')toOut(id);});
  /* Escape Artist: banks that keep OUT pressure on — the pile survives
     the shuffle, only a full bust sweeps it */
  if(S.out.length>=3)S.st.outBanks=(S.st.outBanks||0)+1;
  /* the deeper cut: five out at one bank, Purge/Fallout-era
     fleet pressure */
  if(S.out.length>=5)S.st.deepBanks=(S.st.deepBanks||0)+1;
  /* the fleet cut: six out at one bank — Tab's gate, the far end of
     the out-running ladder */
  if(S.out.length>=6)S.st.fleetBanks=(S.st.fleetBanks||0)+1;
  /* Two Pockets: banks cashed with both away piles fed — read before
     the discard rides home */
  if(S.out.length&&S.disc&&S.disc.length)S.st.pileBanks=(S.st.pileBanks||0)+1;
  /* Rain Check: banks cashed with the bench fed — 3+ waiting, same
     pre-sweep read */
  if(S.disc&&S.disc.length>=3)S.st.benchBanks=(S.st.benchBanks||0)+1;
  /* Recycle: a banked hand wearing one runs the cheapest card ALREADY
     OUT home — the pile drains one a bank, but a landing of this bank's
     own (Vanish, Fallout) is never undone in the same
     breath. No sticker, no drain: OUT rides home on a bust only */
  if(h.ids.some(id=>byId(id).stk==='recycle')){
    const pool=S.out.filter(oid=>!h.ids.includes(oid));
    if(pool.length){
      let low=pool[0];
      for(const oid of pool)if(cval(byId(oid))<cval(byId(low)))low=oid;
      S.out.splice(S.out.indexOf(low),1);
      SFX.stk('recycle','bank',cval(byId(low)));}
  }
  /* the score brings the discard home: warded cards rejoin the shuffle.
     A bust never sweeps this pile, only a bank does. A Used card holds
     its seat through this score and rides home with the next */
  if(S.disc&&S.disc.length){
    const keepD=[];
    S.disc.forEach(did=>{
      if(S.dhold[did]>0){S.dhold[did]--;keepD.push(did);}
      else delete S.dhold[did];});
    S.disc=keepD;
  }
  /* Purge benches the banked hand here — after the sweep, so its cards
     wait out one FULL score, not the one that just cashed them */
  if(purge){h.ids.forEach(toDisc);toast('Purge\nThe hand waits in the discard','ban');SFX.stk('purge','bank');}
  h.ids=[];h.run=freshRun();h.run.grace=L('grace');
  rebuildDeck();
  setTimeout(()=>SFX.shuffle(),160);
  logAct('bank',S.score-_s0,auto);
  biFirst('bank');
  /* sampled bank: pay + whose hand dealt it. Set-chance verification
     lives in sim.js; the money curve rides the inc snapshots */
  if(Math.random()<.1)bi('bank',{n:biBucket(S.score-_s0),a:auto?1:0});
  layout();SFX.slide();fanHome(back);checkAch();unlocks();paint();save(true);
  checkFloatAll();
  tutEvent('bank');
}
function bankAll(){S.hands.slice().forEach(h=>{if(canBank(h))bank(h);});}

/* ---------------- deck-working stickers ---------------- */
/* every road into the OUT pile passes here: the pile count and the
   reveal all track it. The cumulative outed stat counts only cards YOU
   put out: the bust cycle's buster seat is the game's own doing, so it
   rides free */
function toOut(id,free){
  S.out.push(id);
  if(!free)S.st.outed=(S.st.outed||0)+1;
  /* One Out: a worth-1 exiled on purpose — the buster seat stays free */
  if(!free&&cval(byId(id))===1)S.st.oneOut=(S.st.oneOut||0)+1;
  if(S.out.length>S.st.maxOut)S.st.maxOut=S.out.length;
  if(id===S.showTop)S.showTop=null;
  notePiles();
}
/* the discard: ward saves park here, home on the next score — a
   waiting room, not pressure. It feeds nothing */
function toDisc(id){
  S.disc.push(id);
  S.st.discarded=(S.st.discarded||0)+1;
  /* Used: this card holds its seat through one extra score */
  if(cardHas(byId(id),'used'))S.dhold[id]=(S.dhold[id]||0)+1;
  /* On the Shelf: how deep the discard has stood */
  if(S.disc.length>(S.st.maxDisc||0))S.st.maxDisc=S.disc.length;
  if(id===S.showTop)S.showTop=null;
  notePiles();
}
/* the pile pair: how deep BOTH away piles stand at once — Defuse's gate
   reads it, so every road into either pile notes it here */
function notePiles(){
  const m=Math.min(S.out.length,(S.disc||[]).length);
  if(m>(S.st.bothPiles||0))S.st.bothPiles=m;
}
/* Encore: the piles trade places. The discard deals again — warded
   saves, cuts and Purged hands come home mid-run — and the deck waits
   out one score in its place. Used holds die with the wait (the card
   came home, it owes nobody an extra score); an empty discard has
   nothing to trade, the landing says so and moves on */
function doEncore(c){
  const disc=S.disc||[];
  if(!disc.length){
    const[x,y]=feltPt(FW/2,FH*.3);float('ENCORE\nNOTHING WAITING',x,y,'#4A5A66');
    return;}
  S.disc=S.deck;
  S.deck=disc;
  disc.forEach(id=>delete S.dhold[id]);
  if(S.showTop!=null)S.showTop=null;   /* the old deck's reveal is buried */
  if(S.disc.length>(S.st.maxDisc||0))S.st.maxDisc=S.disc.length;
  notePiles();
  const[x,y]=feltPt(FW/2,FH*.3);
  float('ENCORE\n'+disc.length+' BACK IN PLAY',x,y,'#3E5A78');
  slam('ENCORE','#3E5A78');
  SFX.shuffle();deckJiggle();buzz(14);
  SFX.stk('encore','act',cval(c));
  layout();paint();save();
}
function doSnip(c){
  let i=S.deck.findIndex(id=>byId(id).v===c.v);
  if(i<0&&S.deck.length)i=rndi(S.deck.length);
  if(i<0)return;
  const id=S.deck.splice(i,1)[0];benchSafe(id);toDisc(id);
  const[x,y]=feltPt(OX,OY);float('SNIPPED A '+byId(id).v,x,y-16,'#46422F');
  SFX.burn();SFX.stk('snip','act',byId(id).v);layout();
}
/* Burn: the pair-hunt — only values the deck holds twice qualify, one
   wins at random, both twins leave for the discard together */
function doBurn(){
  const tally={};
  S.deck.forEach(id=>{const v=cval(byId(id));tally[v]=(tally[v]||0)+1;});
  const pairs=Object.keys(tally).filter(v=>tally[v]>1);
  if(!pairs.length)return;
  const v=+pairs[rndi(pairs.length)];
  const pool=S.deck.filter(id=>cval(byId(id))===v);
  const ids=[];
  for(let i=0;i<2;i++)ids.push(pool.splice(rndi(pool.length),1)[0]);
  const[x,y]=feltPt(FW/2,FH*.5);
  ids.forEach(id=>{S.deck.splice(S.deck.indexOf(id),1);benchSafe(id);toDisc(id);});
  float('BURNED A PAIR OF '+v+'S',x,y-14,'#8E2B1C');spray(x,y,'#8E2B1C',14);SFX.burn();SFX.stk('burn','act',v);layout();
}
/* Whip: the blank hunt — the deck's first card that busts nobody (top
   down) benches to the discard. Two triggers, one cut: the landing
   fires it free, the arm fires it on your timing. A deck of nothing
   but threats denies the arm, unspent */
/* a blank reads against every standing table at once — Burn's cut has
   no hand of its own, so the cutters share the one global read */
const safeVal=v=>!S.hands.some(h=>h.ids.some(x=>cval(byId(x))===v)&&!pureVals(h).has(v));
/* Cold Cuts: a blank benched on purpose counts, whatever cut it rode */
const benchSafe=id=>{if(safeVal(cval(byId(id))))S.st.safeDisc=(S.st.safeDisc||0)+1;};
function doWhip(){
  for(let i=S.deck.length-1;i>=0;i--){
    const id=S.deck[i];
    if(!safeVal(cval(byId(id))))continue;
    S.deck.splice(i,1);
    benchSafe(id);toDisc(id);
    const[x,y]=feltPt(OX,OY);float('WHIPPED A '+byId(id).v,x,y-16,'#46422F');
    SFX.burn();SFX.stk('whip','act',byId(id).v);buzz(12);layout();
    return true;}
  const[x,y]=feltPt(FW/2,FH*.3);float('WHIP\nNO SAFE CARD',x,y,'#4A5A66');
  return false;
}

/* ---------------- value modifiers ----------------
   Swap, Clip, Ghost, Dredge, Riffle rewrite what a table card is worth —
   as long as the card stays in play, never longer. The printed value
   (c.v) and the card's own sticker stay put: the rewrite rides c.cv, and
   Dredge parks the printed sticker in c.osk while it wears the OUT
   card's. Every road off the felt — the deck on a bank or bust, OUT via
   Vanish or Fallout, the discard (a bench, a cut or a Purged hand) —
   reverts the card as it lifts (revertLeaving), so the flight home
   wears the printed face.
   revertMods stays as the safety net for strays outside play */
/* every rewrite tallies here; the ones that land a 20+ feed Riffle's
   gate (Swap and Dredge reach it without Riffle — two ways in) */
function bumpRewrite(c){
  S.st.rewrites=(S.st.rewrites||0)+1;
  if(cval(c)>=20)S.st.bigRewrites=(S.st.bigRewrites||0)+1;
}
const cardPt=c=>{const e=els[c.id];return e&&e._sx!=null?feltPt(e._sx,e._sy-34):null;};
/* the card turns over in place; an apply spins forward, the
   shuffle-revert spins back — the face swaps at the edge-on moment.
   A card leaving in a sweep never spins: fanHome strips the class at
   launch and the flight half-turns it to the back instead */
function flipCard(c,back){
  const e=els[c.id];
  if(!e||!e.classList||!e.classList.contains('faceup')){faceOf(c);return;}
  const cl=back?'revb':'rev';
  e.classList.remove('rev','revb');void e.offsetWidth;e.classList.add(cl);
  setTimeout(()=>faceOf(c,true),325);
  setTimeout(()=>e.classList.remove('rev','revb'),830);
}
/* peel one card's rewrite: borrowed value and borrowed sticker off, the
   printed pair back with the snap-back spin. The old value is the card's
   own struck print (faceOf's .ov), not a float in the air */
function revertCard(c){
  if(c.cv==null&&!c.osk)return false;
  delete c.cv;
  if(c.osk){c.stk=c.osk;delete c.osk;}
  flipCard(c,true);
  return true;
}
const inPlay=id=>S.hands.some(x=>x.ids.indexOf(id)>=0);
function revertMods(){
  cancelAim();
  S.cards.filter(c=>(c.cv!=null||c.osk)&&!inPlay(c.id)).forEach(revertCard);
}
/* the felt lets go: a leaving card drops its rewrite (and Odds' gamble
   states) at the lift, so it flies wearing its printed face */
function revertLeaving(ids){
  ids.forEach(id=>{const c=byId(id);if(!c)return;
    const mod=revertCard(c);
    if(c.boom3||c.dud){c.boom3=false;c.dud=false;if(!mod)faceOf(c);}});
}
/* Clip and Ghost tap → aim: pick a target on the same table. Tapping
   the carrier again, any felt tap, a draw or a bank all stand down */
let aim=null;
function startAim(c){
  if(aim)cancelAim();
  aim={id:c.id};
  toast(STK[c.stk].n+'\nPick a card on this table','target');
  SFX.detent();buzz(10);
  layout();
}
function cancelAim(){if(!aim)return;aim=null;stickerStates();}
function aimTap(tid){
  const a=aim;aim=null;
  if(tid===a.id){stickerStates();return;}          /* carrier again: never mind */
  const c=byId(a.id),h=S.hands.find(x=>x.ids.indexOf(a.id)>=0);
  const t=byId(tid),th=t?S.hands.find(x=>x.ids.indexOf(tid)>=0):null;
  if(!c||!h||!t||th!==h||frozen||h.run.spent.indexOf(a.id)>=0){
    if(t)SFX.deny();
    stickerStates();return;}
  if(c.stk==='engrave'){
    /* nothing shown to keep: the trigger stays charged */
    if(t.cv==null){SFX.deny();stickerStates();return;}
    t.v=Math.min(MAXV,cval(t));delete t.cv;
    bumpRewrite(t);
    flipCard(t);
    const p=cardPt(t);if(p)float('ENGRAVED '+t.v,p[0],p[1],'#4A5A66');
    SFX.stk('engrave','act',t.v);buzz(12);
    h.run.spent.push(a.id);
    S.st.arms=(S.st.arms||0)+1;
    layout();paint();save();
    return;
  }
  if(c.stk==='patch'){
    /* the ceiling: a printed 20 cannot rise, the trigger stays charged */
    if(t.v>=MAXV){SFX.deny();stickerStates();return;}
    t.v=Math.min(MAXV,t.v+1);
    bumpRewrite(t);
    flipCard(t);
    const p=cardPt(t);if(p)float('+1 · '+t.v,p[0],p[1],'#2C563C');
    SFX.stk('patch','act',t.v);buzz(12);
    h.run.spent.push(a.id);
    S.st.arms=(S.st.arms||0)+1;
    layout();paint();save();
    checkFloatAll();
    return;
  }
  if(c.stk==='clip'){
    /* the floor stays charged: no rewrite ever walks a shown value out of
       the deck's range (ECO.CVAL_MIN) — that would be Purify's job */
    if(cval(t)<=ECO.CVAL_MIN){SFX.deny();stickerStates();return;}
    t.cv=cval(t)-1;bumpRewrite(t);
    flipCard(t);
    const p=cardPt(t);if(p)float('−1',p[0],p[1],'#B4551E');
  }else{                                           /* Ghost: paste the table's floor */
    const rest=h.ids.filter(x=>x!==tid).map(x=>cval(byId(x)));
    if(!rest.length){SFX.deny();stickerStates();return;}
    t.cv=Math.max(ECO.CVAL_MIN,Math.min(MAXV,Math.min(...rest)));bumpRewrite(t);
    flipCard(t);
    const p=cardPt(t);if(p)float('→ '+t.cv,p[0],p[1],'#6B7F3E');
  }
  h.run.spent.push(a.id);
  S.st.arms=(S.st.arms||0)+1;
  SFX.stk(c.stk,'act',cval(t));buzz(12);
  layout();paint();save();
  checkFloatAll();
}
function fireSwap(c){
  if(!S.deck.length){SFX.deny();return false;}
  /* a swap onto the value the card already wears is a silent no-op: the
     flip and float play, nothing changes, and the arm burns. Draw only
     from values that actually differ; deny unspent when none can */
  const pool=S.deck.filter(id=>byId(id).v!==cval(c));
  if(!pool.length){SFX.deny();return false;}
  const src=byId(pool[rndi(pool.length)]);
  c.cv=Math.max(ECO.CVAL_MIN,Math.min(MAXV,src.v));   /* the value only — never its sticker */
  bumpRewrite(c);
  flipCard(c);
  const p=cardPt(c);if(p)float('→ '+c.cv,p[0],p[1],'#C25B7C');
  SFX.stk('swap','act',cval(c));buzz(10);
  return true;
}
/* Dredge: two from OUT, tap one — the carrier wears its value and its
   sticker till it leaves the table. Committed like every trick: closing
   the reveal without choosing wastes the arm */
function copyDredge(c,src){
  c.osk=c.osk||c.stk;                    /* never bury the printed sticker */
  c.stk=src.stk||null;                   /* a blank OUT card blanks it a while */
  c.cv=Math.max(ECO.CVAL_MIN,Math.min(MAXV,src.v));bumpRewrite(c);
  flipCard(c);
  const p=cardPt(c);if(p)float('→ '+(src.stk?STK[src.stk].n:c.cv),p[0],p[1],'#8A6A2F');
  SFX.stk('dredge','act',cval(c));buzz(10);
}
let dredgeCtx=null;
function openDredge(picks,h,c){
  dredgeCtx={picks,h,id:c.id};
  openMo(`<h3>DREDGE</h3><p class="note">Two from OUT. Tap one: this card becomes its
    copy, value and sticker, till it leaves the table.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin:14px 0">
      ${picks.map((id,i)=>`<button onclick="pickDredge(${i})" style="background:none;border:0;padding:0;cursor:pointer">${mini(byId(id).v,byId(id).stk,byId(id).r,id,byId(id))}</button>`).join('')}</div>
    <p class="stkline">close without choosing and the arm is wasted</p>
    <button class="close" onclick="closeMo()">CLOSE</button>`);
}
function pickDredge(i){
  const d=dredgeCtx;if(!d||frozen)return;
  dredgeCtx=null;
  const src=byId(d.picks[i]),c=byId(d.id);
  closeMo();
  if(!src||!c||!S.hands.some(x=>x.ids.indexOf(c.id)>=0))return;
  copyDredge(c,src);
  layout();paint();save();
  checkFloatAll();
}
function fireRiffle(c){
  if(S.deck.length<2){SFX.deny();return false;}
  const three=[...S.deck].sort(()=>Math.random()-.5).slice(0,3);
  const vs=three.map(id=>byId(id).v).sort((a,b)=>a-b);
  c.cv=Math.max(ECO.CVAL_MIN,Math.min(MAXV,vs[0]+vs[1]));bumpRewrite(c);
  flipCard(c);
  openMo(`<h3>RIFFLE</h3><p class="note">Three from the deck — the two lowest set its worth, till it leaves the table.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin:14px 0">
      ${three.map(id=>mini(byId(id).v,null,byId(id).r)).join('')}</div>
    <p class="stkline">lowest two · <b>${vs[0]} + ${vs[1]} = ${c.cv}</b></p>
    <button class="close" onclick="closeMo()">CLOSE</button>`);
  SFX.stk('riffle','act',cval(c));buzz(10);
  return true;
}
/* Squeeze: five from the deck, and the risky ones set the worth — the
   gauge made solid, till the card leaves the table. A clean peek (no
   risky card in the five) denies, unspent: there is no count to read */
function fireSqueeze(c,h){
  if(!S.deck.length){SFX.deny();return false;}
  const five=[...S.deck].sort(()=>Math.random()-.5).slice(0,5);
  const p=pureVals(h);
  const rk=five.filter(id=>{const v=cval(byId(id));
    return h.ids.some(x=>cval(byId(x))===v)&&!p.has(v);});
  if(!rk.length){SFX.deny();return false;}
  const vs=rk.map(id=>cval(byId(id))),sum=vs.reduce((a,b)=>a+b,0);
  c.cv=Math.max(ECO.CVAL_MIN,Math.min(MAXV,sum));bumpRewrite(c);
  flipCard(c);
  openMo(`<h3>SQUEEZE</h3><p class="note">Five from the deck — the risky ones set this card's worth, till it leaves the table.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin:14px 0">
      ${five.map(id=>`<span${rk.indexOf(id)>=0?'':' style="opacity:.35"'}>${mini(cval(byId(id)),byId(id).stk,byId(id).r,id,byId(id))}</span>`).join('')}</div>
    <p class="stkline">risky ${vs.join(' + ')} = ${c.cv}${sum>MAXV?' · capped':''}</p>
    <button class="close" onclick="closeMo()">CLOSE</button>`);
  SFX.stk('squeeze','act',cval(c));buzz(10);
  return true;
}

/* ---------------- armed tricks ---------------- */
/* tap a charged trick on the table: arm it. One arm per card per run;
   fire or expire, the charge is spent — committing is the gamble */
function armTrick(id){
  const c=byId(id);if(!c||!TRICK[c.stk])return;
  const h=S.hands.find(x=>x.ids.includes(id));
  if(!h||frozen)return;
  const r=h.run;
  if(r.spent.indexOf(id)>=0){SFX.deny();return;}
  /* Scrap fires the moment it is armed: the top card leaves the deck.
     With a Tell up you knew exactly what you were throwing away */
  if(c.stk==='scrap'){
    if(!S.deck.length){SFX.deny();return;}
    const tid=S.deck.pop();
    toOut(tid);
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    const[x,y]=feltPt(FW/2,FH*.44);
    float('SCRAPPED A '+byId(tid).v,x,y,'#8E2B1C');
    SFX.burn();SFX.stk('scrap','act',byId(tid).v);buzz(18);layout();paint();save();
    return;}
  /* Tell fires on the arm too: the top card flips face-up and stays
     that way until it is drawn, scrapped or the deck reshuffles */
  if(c.stk==='tell'){
    if(!S.deck.length){SFX.deny();return;}
    S.showTop=S.deck[S.deck.length-1];
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    toast('Tell\nThe top card shows its face','eye');
    SFX.detent();SFX.stk('tell','arm',cval(byId(S.showTop)));buzz(10);layout();paint();save(true);
    return;}
  /* the value modifiers: Swap, Riffle and Squeeze fire on the tap,
     Dredge deals its two picks from OUT, and the aim tricks wait for a
     target. Denials (empty deck / OUT pile, no floor to copy, no risky
     card in the peek) never spend */
  if(c.stk==='swap'||c.stk==='riffle'||c.stk==='squeeze'){
    const fired=c.stk==='swap'?fireSwap(c):c.stk==='riffle'?fireRiffle(c):fireSqueeze(c,h);
    if(!fired)return;
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    layout();paint();save();
    checkFloatAll();
    return;}
  if(c.stk==='dredge'){
    if(!S.out.length){SFX.deny();return;}
    const pool=S.out.slice(),picks=[];
    for(let i=0;i<2&&pool.length;i++)picks.push(pool.splice(rndi(pool.length),1)[0]);
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    openDredge(picks,h,c);
    SFX.detent();buzz(10);layout();paint();save();
    return;}
  if(c.stk==='clip'||c.stk==='ghost'||c.stk==='patch'||c.stk==='engrave'){startAim(c);return;}
  /* Draft: two off the top, face up. Keep one — it lands by the same
     resolve rules, so a kept twin still busts, you were warned — and
     the other waits in the discard. Fewer than two in the deck denies, unspent */
  if(c.stk==='draft'){
    if(S.deck.length<2){SFX.deny();return;}
    const two=[S.deck.pop(),S.deck.pop()];
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    openDraft(two,h);
    SFX.detent();buzz(10);layout();paint();save();
    return;}
  /* Twin: the pull is yours to time — a twin of the table lands without
     busting (the rider in resolve bows the one-value rule), anything
     else benches. An empty deck denies, unspent */
  if(c.stk==='twin'){
    if(!S.deck.length||echoD>=10){SFX.deny();return;}
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    echoD++;
    SFX.stk('twin','arm',cval(c));buzz(12);
    const eh=S.hands.indexOf(h);
    pendAdd(h);
    runSoon(()=>{
      echoD--;
      const h2=S.hands[eh];
      if(!h2||frozen){pendEnd(h);return;}
      twinNext=h2;const ok=drawCard(eh,true,true);
      if(ok)S.st.stkDraws=(S.st.stkDraws||0)+1;else twinNext=null;
      pendEnd(h);},280);
    layout();paint();save();
    return;}
  /* Offering: the card leaves for OUT and the chain gains 1 — the arm
     that pays in links, not score */
  if(c.stk==='offering'){
    const xi=h.ids.indexOf(id);
    if(xi>=0)h.ids.splice(xi,1);
    revertLeaving([id]);
    toOut(id);
    h.chain++;
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    const[x,y]=feltPt(FW/2,FH*.44);
    float('OFFERING\nCHAIN +1',x,y,'#3C7C9E');
    SFX.stk('offering','arm',cval(c));buzz(14);layout();paint();save();
    checkFloatAll();
    return;}
  /* Sub: the carrier benches to the discard and a random card OUT takes
     its seat, landing by the resolve rules — a twin sub still busts.
     An empty OUT pile denies, unspent */
  if(c.stk==='sub'){
    if(!S.out.length){SFX.deny();return;}
    const rid=S.out.splice(rndi(S.out.length),1)[0];
    const xi=h.ids.indexOf(id);
    if(xi>=0)h.ids.splice(xi,1);
    revertLeaving([id]);
    toDisc(id);
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    SFX.stk('sub','act',cval(byId(rid)));buzz(12);
    layout();paint();save();
    resolve(rid,h);
    checkFloatAll();
    return;}
  /* Bail: the manual exit — pays the table in full, premium included,
     then zeroes it. Not a bank: no chain tick, no reshuffle, no OUT
     triggers, Relic sits. Float's big sibling: same exit, your timing */
  if(c.stk==='bail'){
    fireBail(h,c);
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    layout();paint();save();
    checkFloatAll();
    return;}
  /* Fetch: look at 3 from OUT, send one back to the deck. Closing the
     reveal without choosing wastes the arm — committed, like every
     trick; an empty OUT pile denies the tap, unspent */
  if(c.stk==='fetch'){
    if(!S.out.length){SFX.deny();return;}
    const pool=S.out.slice(),picks=[];
    for(let i=0;i<3&&pool.length;i++)picks.push(pool.splice(rndi(pool.length),1)[0]);
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    openFetch(picks);
    SFX.detent();buzz(10);layout();paint();save();
    return;}
  /* Echo: scan the deck's top 3, twins of its value leave for the
     discard, the reveal shows what was there. Committed like every
     trick: a clean scan is information, the arm is spent either way.
     An empty deck denies, unspent */
  if(c.stk==='echo'){
    if(!S.deck.length){SFX.deny();return;}
    const peek=[];
    for(let i=0;i<3&&i<S.deck.length;i++)peek.push(S.deck[S.deck.length-1-i]);
    const cut=peek.filter(cid=>cval(byId(cid))===cval(c));
    cut.forEach(cid=>{S.deck.splice(S.deck.indexOf(cid),1);benchSafe(cid);toDisc(cid);});
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    const[x,y]=feltPt(FW/2,FH*.3);
    float(cut.length?'ECHO\nCUT '+cut.length:'ECHO\nNO TWIN',x,y,
      cut.length?'#8E2B1C':'#4A5A66');
    if(cut.length)SFX.burn();else SFX.detent();
    SFX.stk('echo','act',cval(c));
    buzz(cut.length?14:10);
    layout();paint();save();
    openMo(`<h3>ECHO</h3><p class="note">The deck's top ${peek.length}: anything matching this value leaves for the discard.</p>
      <div style="display:flex;gap:12px;justify-content:center;margin:14px 0">
        ${peek.map(cid=>`<span${cut.indexOf(cid)>=0?' style="opacity:.35"':''}>${mini(cval(byId(cid)),byId(cid).stk,byId(cid).r,cid,byId(cid))}</span>`).join('')}</div>
      <p class="stkline">${cut.length
        ?`cut ${cut.length} × ${cval(c)} · ${cut.length===1?'it waits':'they wait'} in the discard till you score`
        :`no twin of the ${cval(c)} up top`}</p>
      <button class="close" onclick="closeMo()">CLOSE</button>`);
    return;}
  /* Whip's arm: the second trigger, the same cut the landing makes.
     No blank in the deck denies, unspent */
  if(c.stk==='whip'){
    const cut=S.deck.length&&doWhip();
    if(!cut){SFX.deny();}
    else{r.spent.push(id);S.st.arms=(S.st.arms||0)+1;}
    layout();paint();save();
    checkFloatAll();
    return;}
  /* Strip: the floor pays the shield — the table's cheapest card
     benches and a ward stands in its place. The carrier may be the
     lowest: the arm spends before the bench */
  if(c.stk==='strip'){
    if(!h.ids.length){SFX.deny();return;}
    let low=h.ids[0];
    for(const x of h.ids)if(cval(byId(x))<cval(byId(low)))low=x;
    const lv=cval(byId(low));
    h.ids.splice(h.ids.indexOf(low),1);
    revertLeaving([low]);
    toDisc(low);
    r.grace++;
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    const[x,y]=feltPt(FW/2,FH*.3);
    float('STRIP\nA '+lv+' FOR 1 WARD',x,y,'#3E7A5E');
    SFX.stk('strip','act',lv);buzz(14);layout();paint();save();
    checkFloatAll();
    return;}
  /* Ward is a passive sticker now: nothing to arm, the rider fires
     on its own draw */
  /* Defuse: the tap cuts into the deck — the top card is exiled OUT,
     the next one benched to the discard, and when neither would have
     busted the table banks on the spot. An empty deck denies, unspent */
  if(c.stk==='defuse'){
    if(!S.deck.length){SFX.deny();return;}
    const cut1=S.deck.pop();
    const mate=S.deck.length?S.deck.pop():null;
    if(cut1===S.showTop||mate===S.showTop)S.showTop=null;
    toOut(cut1);
    if(mate!=null){benchSafe(mate);wardFlight(mate);}
    r.spent.push(id);
    S.st.arms=(S.st.arms||0)+1;
    const p=pureVals(h);
    const liveV=v=>h.ids.some(x=>cval(byId(x))===v)&&!p.has(v);
    const v1=cval(byId(cut1)),vm=mate!=null?cval(byId(mate)):null;
    slam('DEFUSE','#2C563C');
    if(!liveV(v1)&&(vm==null||!liveV(vm))){
      SFX.stk('defuse','act',v1);buzz(26);layout();paint();save();
      if(h.ids.length&&canBank(h))bank(h);   /* both cuts were safe */
    }else{
      const[lx,ly]=feltPt(FW/2,FH*.26);
      float('CUT A LIVE '+(liveV(v1)?v1:vm),lx,ly,'#8E2B1C');
      SFX.burn();SFX.stk('defuse','act',liveV(v1)?v1:vm);buzz(14);layout();paint();save();}
    checkFloatAll();
    return;}
  if(c.stk==='cull'){if(r.armedC!=null){SFX.deny();return;}r.armedC=id;}
  else if(c.stk==='float'){if(r.armedF!=null){SFX.deny();return;}r.armedF=id;}
  else if(c.stk==='stakes'){if(r.stakesIds.indexOf(id)>=0){SFX.deny();return;}r.stakesIds.push(id);r.stakesD+=ECO.WINDOW_DRAWS;}
  S.st.arms=(S.st.arms||0)+1;
  /* an arm is a commitment: flush now, so no reload ever un-arms it */
  SFX.detent();SFX.stk(c.stk,'arm',cval(c));buzz(10);layout();paint();save(true);
  checkFloat(h);
}
/* one tap entry point for every face-up card on the felt — while an
   aim is live, every card tap is a target (or a stand-down) */
function tapCard(id){
  if(aim){aimTap(id);return;}
  const c=byId(id);if(!c||!c.stk)return;
  if(TRICK[c.stk])armTrick(id);
}

/* ---------------- the autos play their own tricks ----------------
   With Auto-Draw driving, charged stickers arm themselves by policy:
   shields and Cull when the gauge runs hot (or a revealed bust is
   coming), Stakes while the premium is fat, Float near its pay-out
   line, Tell whenever the top card is hidden. One arm per card per
   run — same rules as a tap. */
function autoHolds(h){
  /* a Tell reveal sits on top: hold the deal while it busts this hand
     and no shield stands (a set cull, a live Anchor guard, grace) */
  if(S.showTop==null)return false;
  const c=byId(S.showTop),r=h.run;
  if(!c)return false;
  const twin=h.ids.find(x=>byId(x).v===c.v);
  if(!twin||c.stk==='purify'||pureVals(h).has(c.v))return false;
  return r.armedC==null&&r.grace<=0
    &&!(r.anchWin||[]).some(w=>w.left>0&&cval(byId(w.id))===c.v)
    &&!(h.ids.some(x=>{const f=byId(x);return f.stk==='flinch'&&r.spent.indexOf(x)<0&&cval(f)===c.v;}));
}
function autoPlay(h){
  const r=h.run,th=threat(h),held=autoHolds(h),A=ECO.AUTO_SKILL;
  const charged=k=>h.ids.find(id=>byId(id).stk===k&&r.spent.indexOf(id)<0);
  const armed=id=>r.armedC===id||r.armedF===id
    ||r.stakesIds.indexOf(id)>=0;
  const skill=(k,ok)=>{if(!ok)return;const id=charged(k);
    if(id==null||armed(id))return;armTrick(id);};
  skill('tell',S.showTop==null);
  skill('defuse',th>=A.defuse||held);
  skill('cull',th>=A.cull||held);
  skill('float',th>=A.float);
  skill('stakes',th>=A.stakes);
  /* a blind cut only when blind: skip it while a Tell has the top read —
     unless that read is a bust aimed at this hand, then cut it away */
  skill('scrap',(th>=A.scrap&&S.showTop==null)||held);
  /* Twin wants the hand's last moment: the pull lands most often when
     the deck is thickest with twins, which is the player's own stop
     line — the same tick the deal would skip this table */
  skill('twin',th>=drawStop());
}
/* Float: armed at the threshold, it pays the table out the moment the
   gauge crosses it — the run continues on zeroed cards. The pay is
   flat: no premium, that is the wage of a banked risk and Float
   banked nothing */
function checkFloat(h){
  if(h.run.armedF!=null&&threat(h)>=ECO.FLOAT_AT)fireFloat(h);
}
function checkFloatAll(){S.hands.forEach(checkFloat);}
function fireFloat(h){
  const fid=h.run.armedF;h.run.armedF=null;h.run.spent.push(fid);
  const s=handParts(h,true).total;
  S.score+=s;S.banked+=s;S.life+=s;S.st.bankSum=(S.st.bankSum||0)+s;
  logAct('flt',s);
  /* every card the float sets to 0 feeds the rip's unlock gate */
  S.st.zeroed=(S.st.zeroed||0)+h.ids.filter(id=>h.run.floated.indexOf(id)<0).length;
  h.run.floated.push(...h.ids);
  if(s>(S.st.bestFloat||0))S.st.bestFloat=s;
  const[x,y]=feltPt(FW/2,FH*.3);float('+'+fmt(s),x,y,'#2A4761');slam('FLOAT','#2A4761');
  SFX.bank(h.ids.length,1);SFX.stk('float','bank');buzz(20);warm();scorePulse();
  layout();paint();save(true);
}
/* Bail: the manual exit. Same zeroing as Float, but you pick the moment
   and the premium rides — it pays what a bank would without being one */
function fireBail(h,c){
  const s=handParts(h).total;
  S.score+=s;S.banked+=s;S.life+=s;S.st.bankSum=(S.st.bankSum||0)+s;
  logAct('bal',s);
  S.st.zeroed=(S.st.zeroed||0)+h.ids.filter(id=>h.run.floated.indexOf(id)<0).length;
  h.run.floated.push(...h.ids);
  if(s>(S.st.bestFloat||0))S.st.bestFloat=s;
  const[x,y]=feltPt(FW/2,FH*.3);float('+'+fmt(s),x,y,'#2A4761');slam('BAILED','#2A4761');
  SFX.bank(h.ids.length,1);SFX.stk('bail','bank');buzz(20);warm();scorePulse();
  layout();paint();save(true);
}

/* ---------------- Fetch: three from OUT, one comes home ---------------- */
let fetchCtx=null;
function openFetch(picks){
  fetchCtx=picks;
  openMo(`<h3>FETCH</h3><p class="note">Three from OUT. Tap one: it returns to the deck, on top.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin:14px 0">
      ${picks.map((id,i)=>`<button onclick="pickFetch(${i})" style="background:none;border:0;padding:0;cursor:pointer">${mini(byId(id).v,byId(id).stk,byId(id).r,id,byId(id))}</button>`).join('')}</div>
    <p class="stkline">close without choosing and the arm is wasted</p>
    <button class="close" onclick="closeMo()">CLOSE</button>`);
}
function pickFetch(i){
  const id=fetchCtx&&fetchCtx[i];if(id==null)return;
  const ex=S.out.indexOf(id);if(ex<0)return;
  S.out.splice(ex,1);
  S.deck.push(id);                       /* on top: the next draw can take it */
  S.rf=(S.rf||[]).concat(id);            /* Boomerang: remembered till it banks */
  const c=byId(id);
  const[x,y]=feltPt(OX,OY);float('FETCHED A '+c.v,x,y-16,'#3E7A5E');
  S.st.fetches=(S.st.fetches||0)+1;
  SFX.stk('fetch','act',c.v);buzz(12);
  closeMo();layout();paint();save();
  checkFloatAll();
}

/* ---------------- Draft: two from the top, keep one ---------------- */
let draftCtx=null;
function openDraft(two,h){
  draftCtx={h,ids:two};
  openMo(`<h3>DRAFT</h3><p class="note">Two from the deck, face up. Keep one: it lands
    by the normal rules, so a kept twin still busts. The other waits in the discard.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin:14px 0">
      ${two.map((id,i)=>`<button onclick="pickDraft(${i})" style="background:none;border:0;padding:0;cursor:pointer">${mini(byId(id).v,byId(id).stk,byId(id).r,id,byId(id))}</button>`).join('')}</div>
    <button class="close" onclick="closeDraft()">CLOSE</button>`);
}
function pickDraft(i){
  const d=draftCtx;if(!d||frozen)return;
  draftCtx=null;
  const keep=d.ids[i],drop=d.ids[1-i];
  closeMo();
  benchSafe(drop);toDisc(drop);
  S.st.drafted=(S.st.drafted||0)+1;S.st.stkDraws=(S.st.stkDraws||0)+1;
  const[x,y]=feltPt(FW/2,FH*.44);float('DRAFTED',x,y,'#3C7C9E');
  SFX.stk('draft','act',byId(keep).v);buzz(12);
  layout();paint();save();
  resolve(keep,d.h);
  checkFloatAll();
}
/* close without choosing: both cards return to the top, the arm wasted */
function closeDraft(){
  const d=draftCtx;
  if(d)S.deck.push(...d.ids);
  draftCtx=null;closeMo();layout();paint();
}
