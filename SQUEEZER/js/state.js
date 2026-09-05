/* ==================================================================
   state.js — game state shape, persistence (localStorage → memory),
   save/flush/load.
   v5: one deck, many hands. Each hand owns its table, chain, insurance
   and armed tricks; the deck, the OUT pile, the discard and the draw
   cooldown are shared.
   ================================================================== */
const $ = s=>document.querySelector(s), $$ = s=>[...document.querySelectorAll(s)];
const SUF=['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','Ud','Dd','Tg'];
function fmt(n){
  if(!isFinite(n))return '∞';if(n<0)return '-'+fmt(-n);
  if(n<1000)return n<10?(Math.round(n*10)/10).toString():Math.floor(n).toString();
  let i=0;while(n>=1000&&i<SUF.length-1){n/=1000;i++;}
  return (n<10?n.toFixed(2):n<100?n.toFixed(1):Math.floor(n).toString())+SUF[i];
}
/* whole numbers drop the dead decimals: 5.00K → 5K, 45.0K → 45K (goal counters) */
const fmtG=n=>fmt(n).replace(/\.0+(?=[A-Za-z]|$)/,'');
const rndi=n=>Math.floor(Math.random()*n);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rndi(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const hashStr=s=>{let h=9;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),387420489);return (h>>>0);};

let S, cdEnd=0, cdLen=1, echoD=0, runT=0, dirty=false, els={}, frozen=false;
/* BG: the tab is hidden. Effects go dark and every deferred step runs
   inline — timer throttle would stretch the animation chains to a
   crawl and leave frozen windows straddling the return (main.js arms
   and disarms it on visibilitychange) */
let BG=false;
/* oddsNext: the hand waiting for the card Odds pulled, the one that
   flips triple or dud. wardNext: the hand waiting for Ward's protected
   pull. twinNext: the hand waiting for Twin's pull — the one card that
   lands bust-proof or benches */
let oddsNext=null, wardNext=null, twinNext=null;
/* bustPair = the two cards named in the bust flash. newIns = cards bought
   away from the table, waiting for their show-and-tuck on the felt.
   bustGhost = the held breath: the exact quote the felt showed the moment
   before the killer landed (total, premium, threat, chain). paint() replays
   it while the pair is up — the draw that busts moves no digit anywhere. */
let bustPair=null, newIns=[], bustGhost=null;
/* the early deck lift: preDrops are cards pulled while the draw cooldown
   still runs and dropped on the felt (drag the deck, or Pre-Flick's
   swipe up) — they sit face-down where they landed and flip (real
   draws) the moment the deck cools. They hold the deck's top seats
   until then; preDropTick flips them and reclaims any a reshuffle
   knocked out of place. deckHold marks a finger on the deck so the
   autos never deal that card out from under it; liftGrab is the card a
   drag currently holds (flights home yield it). All transient: a
   reload simply returns the cards. */
let preDrops=[], deckHold=false, liftGrab=null;
/* the card a lift would take: the deck's top card that is not already
   parked on the felt (the parked block owns the tail until it flips) */
const deckTop=()=>{for(let i=S.deck.length-1;i>=0;i--)if(!preDrops.includes(S.deck[i]))return S.deck[i];return null;};
/* waiting seats: one without the upgrade (the drag lift, as always),
   one per Pre-Flick level once owned */
const flickCap=()=>Math.max(1,L('flick'));

/* Armed tricks hold the carrying card's id (null = not armed); spent[]
   remembers consumed tricks so the sticker dims for the rest of the
   run. wardBreak stamps when a ward ring broke, for the smoke-puff
   animation. */
const freshRun = ()=>({started:false, grace:0, cullWard:0, rebound:false, wardBreak:0,
                       draws:0, armedF:null,
                       stakesIds:[], stakesD:0, anchWin:[],
                       culled:[], floated:[], spent:[], autoDeal:false});
function newHand(){return{ids:[], chain:0, chainScore:0, ironUsed:false, rallyUsed:false, run:freshRun()};}
function newState(){return{
  ver:9, score:0, banked:0, life:0, shards:0, shAll:0, asc:0,
  cards:[], nid:1, deck:[], hands:[newHand()], focus:0, out:[], disc:[], gone:[], rf:[], showTop:null,
  up:{}, meta:{}, ach:[], ready:[], rseen:{},
  st:{draws:0, banks:0, busts:0, runs:0, bigHand:0, bestBank:0,
      bestChain:0, bestChainN:0, maxOut:0, bestRisk:0, inspects:0,
      arms:0, maxTables:0, placed:0, outed:0,
      bestBust:0, bestHandDraws:0, deflects:0, slips:0, outBanks:0, bigStk:0, boardVals:0,
      bustRun:0, bestBustRun:0, hotBanks:0,
      coldWards:0,
      streak:0, bestStreak:0,
      recharges:0, wreckSaves:0, bestRisky:0, fetches:0, bestFloat:0,
      drafted:0, stkDraws:0, rewrites:0, hits:0, deepBanks:0,
      bigRewrites:0, hot60:0, hot70:0, hot80:0, hotRun:[0,0,0], wideRun:0, bestWide:0,
      row3:0, bestRow3:0,
      db2Run:0, db2Best:0, db2N:0,
      spread:0, bigBanks:0, rainbows:0, bothPiles:0, oneTwoThree:0,
      discarded:0, twinTowns:0, works:0, books:0, boomerangs:0, stkKinds:0,
      maxDisc:0, inkBanks:0, coldBusts:0, oneOut:0, twoStkBusts:0, pileBanks:0, benchBanks:0,
      bigBustN:0, safeDisc:0, wardLost:0, effectBusts:0,
      bestPairs:0, bestStack:0,
      zeroed:0,
      fiveBanks:0,
      stkBanked:0,
      stkSpent:0, shinyPlaced:0, shinyBought:0, bestShine:0, bustLog:[], handLog:[],
      aDraws:0, aBanks:0, aBusts:0, aGain:0, aBest:0, aTime:0,
      bankSum:0, bustSum:0},
  dhold:{}, mboost:{},
  shop:{next:0, offers:[], rrP:0, rrT:0}, pick:null, gift:null, rate:0,
  log:[], logSeq:0, logH:'',
  set:{sound:true, haptic:true, autoDraw:true, autoBank:true, risk:55, stop:95, arm:{}},
  seen:{cards:false, up:false, shop:false, ach:false, pres:false, tut:false,
        swd:false},   /* swd: the first swipe-down bank retired the button hint */
  tut:'pyramid', t:Date.now()
};}

/* the counters YOUR NUMBERS splits into this run / all runs once the
   player has ascended. S.rst is their snapshot taken at each ascend;
   the run half is always the live counter minus the snapshot */
const RUN_KEYS=['runs','draws','banks','busts','arms','hits','rewrites',
  'deflects','slips','outed','discarded','placed','shinyPlaced','shinyBought','bankSum','bustSum'];
function snapRun(p){const o={};
  for(const k of RUN_KEYS)o[k]=(p&&p.st&&p.st[k])||0;
  o.life=(p&&p.life)||0;return o;}

const L=id=>S.up[id]||0, M=id=>S.meta[id]||0, has=id=>S.ach.indexOf(id)>=0;
const byId=id=>S.cards.find(c=>c.id===id);
/* what a card is worth right now: the value modifiers (Swap, Clip,
   Ghost, Dredge, Riffle) rewrite c.cv / borrow a sticker into c.stk
   (printed one parked in c.osk) and never touch the printed c.v.
   Conditions ride the same layer: Soggy reads one less, Near Mint's
   bends (c.nb) each read one less, the print itself stays put so set
   math (ownedOf, tierDone, cardCost) is never touched */
const cardHas=(c,k)=>!!c&&Array.isArray(c.cond)&&c.cond.indexOf(k)>=0;
const cval=c=>{
  const b=c.cv||c.v;
  if(!Array.isArray(c.cond)&&!c.nb)return b;
  /* conditions floor at 0: a soggy or fully bent 1 is worth nothing.
     The CVAL_MIN law stays the rewrites' law, not the conditions' */
  return Math.max(0,Math.min(MAXV,b-(cardHas(c,'soggy')?1:0)-(c.nb||0)));};
/* Collector's Eye reads clean stock only: Dog-Eared and Glass are
   invisible to it (the sets and every owned-count goal still count) */
const eyeCount=()=>S.cards.reduce((a,c)=>a+((cardHas(c,'dogeared')||cardHas(c,'glass'))?0:1),0);
const ownedOf=v=>S.cards.reduce((a,c)=>a+(c.v===v?1:0),0);
/* a benched sticker never unlocks: its gate never shows, the shop never
   stocks it. Placed copies keep working; STK_OFF is the whole switch */
const stkUn=k=>{if(STK_OFF[k])return false;const a=ACH.find(x=>x.stk===k);return a?has(a.id):false;};
function addCard(v,stk,cond){const c={id:S.nid++,v,stk:stk||null,cond:cond&&cond.length?cond:null,j:Math.random()*2-1,r:0};S.cards.push(c);mkEl(c);return c;}

/* ---------------- storage ---------------- */
const KEY='pressure_v4', mem={};
const store={
  get(k){try{const v=localStorage.getItem(KEY+':'+k);if(v!=null)return{value:v};}catch(e){}
    return mem[k]?{value:mem[k]}:null;},
  set(k,v){mem[k]=v;try{localStorage.setItem(KEY+':'+k,v);}catch(e){}return 1;}
};
let sT=null;
function save(now){dirty=true;if(now)return flush();if(sT)return;
  sT=setTimeout(()=>{sT=null;flush();},4000);}
async function flush(){
  /* a cloud restore is mid-handoff: the dying page must not write */
  if(!dirty||window.__cloudLoad)return;dirty=false;S.t=Date.now();
  /* demo mutates the booted save in memory only: landing it in the local
     slot would boot poisoned under the real key next session, and that
     session's push is a legitimate-looking cloud save (cloud.js gates
     the demo page itself, but not this hand-me-down) */
  if(window.__demo)return;
  try{await store.set(KEY,JSON.stringify(S));}catch(e){}
  /* cloud.js rides flush: it is the one door every save drains through */
  if(typeof cloudOnFlush==='function')cloudOnFlush();}

/* v5 → v6: the card field takes the sticker's name — `ab` becomes
   `stk`, matching what it has always rendered */
function migrate5(p){
  if(!p||p.ver!==5)return null;
  p.ver=6;
  (p.cards||[]).forEach(c=>{c.stk=c.ab||null;delete c.ab;});
  return p;
}
/* v6 → v7: culled stickers (charm, peek, scout) leave the roster —
   cards still carrying one go blank */
function migrate6(p){
  if(!p||p.ver!==6)return null;
  p.ver=7;
  (p.cards||[]).forEach(c=>{if(c.stk&&!STK[c.stk])c.stk=null;});
  return p;
}
/* v7 → v8: the OUT pile loses its code alias — exile becomes out, the
   stat maxExile becomes maxOut. Same piles, honest names */
function migrate7(p){
  if(!p||p.ver!==7)return null;
  p.ver=8;
  p.out=p.out||p.exile||[];delete p.exile;
  if(p.st){p.st.maxOut=p.st.maxOut||p.st.maxExile||0;delete p.st.maxExile;}
  return p;
}
/* v8 → v9: Grace re-priced and re-gated (Rainbow holds level 1, Cold
   Blood level 2). A save that bought Grace under the old gate loses the
   levels and every claim gating the row — it locks shut until the new
   goals land again */
function migrate8(p){
  if(!p||p.ver!==8)return null;
  p.ver=9;
  if(p.up)delete p.up.grace;
  const g=ACH.filter(a=>a.up==='grace').map(a=>a.id);
  const cut=a=>a.filter(id=>g.indexOf(id)<0);
  if(p.ach)p.ach=cut(p.ach);
  if(p.ready)p.ready=cut(p.ready);
  if(p.rseen)g.forEach(id=>{delete p.rseen[id];});
  return p;
}
/* v4 → v5: the single hand becomes hands[0]; dead stickers remap to
   living ones (gambit→odds, chill→haste, vault→float); values are now
   bought as whole sets, so any partial set is topped up for free */
function migrate(p){
  if(!p||p.ver!==4)return null;
  p.ver=5;
  const rem={gambit:'odds', chill:'haste', vault:'float'};
  (p.cards||[]).forEach(c=>{if(c.ab&&rem[c.ab])c.ab=rem[c.ab];});
  const cnt={};(p.cards||[]).forEach(c=>cnt[c.v]=(cnt[c.v]||0)+1);
  for(const v in cnt)for(let i=cnt[v];i<+v;i++)
    p.cards.push({id:p.nid++,v:+v,ab:null,j:Math.random()*2-1,r:0});
  p.hands=[{ids:[], chain:(p.st&&p.st.chain)||0, chainScore:(p.st&&p.st.chainScore)||0,
            ironUsed:false, run:freshRun()}];
  p.focus=0;
  return p;
}
/* parse + migrate + sanitize a raw save string: the one door both a
   local boot and a cloud-pulled save walk through */
function ingestSave(str){try{let p=JSON.parse(str);
  if(p&&p.ver===4)p=migrate(p);
  if(p&&p.ver===5)p=migrate5(p);
  if(p&&p.ver===6)p=migrate6(p);
  if(p&&p.ver===7)p=migrate7(p);
  if(p&&p.ver===8)p=migrate8(p);
  if(p&&p.ver===9){
    if(!Array.isArray(p.hands)||!p.hands.length)p.hands=[newHand()];
    if(!Array.isArray(p.gone))p.gone=[];   /* Fallout's discard-for-good pile */
    if(!Array.isArray(p.disc))p.disc=[];   /* Ward saves, home on the next score */
    /* per-goal NEW badges postdate old saves: everything claimed before
       the feed existed counts as already read, or a veteran's first
       visit lights the whole tab up at once */
    if(p.ach&&p.ach.length&&!p.rseenV2){
      p.rseen=p.rseen||{};p.ach.forEach(id=>{p.rseen[id]=1;});p.rseenV2=1;}
    /* the value ledgers postdate old saves: banked value starts at what
       this cycle already banked, bust value starts at zero, nothing ever
       counted it. A save that already ascended snapshots here, so the
       this-run halves count from this load forward */
    if(p.st&&p.st.bankSum==null)p.st.bankSum=p.banked||0;
    if(p.asc>0&&!p.rst)p.rst=snapRun(p);
    p.hands.forEach(h=>{h.run=Object.assign(freshRun(),h.run||{});delete h.run.ward;delete h.run.armedW;});
    /* the interactive onboarding replaced the old text modal: a save that
       saw the modal is done, one that predates it starts at the pyramid */
    if(p.tut==null)p.tut=(p.seen&&p.seen.tut)?'done':'pyramid';
    /* a save can predate a roster edit — dead keys go blank before any
       renderer or action meets them (cards, shop stock alike). A stale
       borrow from a mid-turn save is held to the same bar */
    p.dhold=(p.dhold&&typeof p.dhold==='object')?p.dhold:{};
    p.mboost=(p.mboost&&typeof p.mboost==='object')?p.mboost:{};
    (p.cards||[]).forEach(c=>{
      if(c.stk&&!STK[c.stk])c.stk=null;
      /* the rip graduated into the condition roster: an old scar becomes
         RIPPED. A card wears at most one condition, so an existing
         condition wins and the scar simply heals */
      if(c.rip){delete c.rip;
        if(!Array.isArray(c.cond)||!c.cond.length)c.cond=['ripped'];}
      if(c.cond!=null&&(!Array.isArray(c.cond)||!c.cond.length||
          !c.cond.every(k=>typeof k==='string'&&COND[k])))delete c.cond;
      if(c.nb!=null&&!(typeof c.nb==='number'&&c.nb>0&&c.nb<MAXV))delete c.nb;
      if(!c.stk)delete c.shy;   /* a shine rides its sticker, never a blank */
      if(c.osk!=null&&!STK[c.osk])delete c.osk;
      if(c.cv!=null&&!(typeof c.cv==='number'&&c.cv>=1&&c.cv<=999))delete c.cv;});
    if(p.shop&&Array.isArray(p.shop.offers))
      p.shop.offers=p.shop.offers.filter(o=>o&&STK[o.k]);
    /* the action log rides the save: entries are never rewritten here —
      a log that fails its own shape drops whole (the server rebaselines
      the key), because touching one entry breaks the chain anyway */
    if(p.log!=null){
      const okLog=Array.isArray(p.log)&&p.log.length<=600
        &&p.log.every(e=>e&&typeof e==='object'&&typeof e.s==='number'
          &&typeof e.t==='number'&&typeof e.a==='string'&&e.a.length<=4);
      if(!okLog){p.log=[];p.logSeq=0;p.logH='';}
    }
    /* a pending sticker pick survives reloads — but only while all three
       candidate cards are still alive and blank */
    if(p.pick){
      if(!STK[p.pick.k]||!Array.isArray(p.pick.ids))p.pick=null;
      else{p.pick.ids=p.pick.ids.filter(id=>(p.cards||[]).some(c=>c.id===id&&!c.stk));
        if(p.pick.ids.length!==3)p.pick=null;}
    }
    return p;}}catch(e){}return null;}
function load(){
  /* a cloud restore lands in the staging slot and boot adopts it on
     the first load, clearing it: the dying page's autosave can write
     the main slot all it wants and never win that race */
  try{const staged=store.get(KEY+'.pull');
    if(staged&&staged.value){store.set(KEY+'.pull','');
      const one=ingestSave(staged.value);if(one)return one;}}catch(e){}
  try{const r=store.get(KEY);
  return (r&&r.value)?ingestSave(r.value):null;}catch(e){}return null;}
