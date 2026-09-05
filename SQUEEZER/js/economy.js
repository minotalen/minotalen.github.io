/* ==================================================================
   economy.js — derived numbers: multipliers, threat, costs, unlocks.
   Every formula mirrors sim.js so the tuned pacing holds in-game.

   v5 — the honest gauge, one rule, no exceptions:
     threat(h)  risky cards ÷ deck left. What the gauge shows,
                what the premium pays on. Insurance never touches it.
     effective(h) threat after dodge — display only.
   Insurance (grace, ward, dodge) decides whether you SURVIVE the live
   round; it never bends the pay. Only Purify turns rounds blank.
   All hand math is per-hand: each hand counts its own duplicates
   against the one shared deck.
   ================================================================== */
function achV(){let m=1;ACH.forEach(a=>{if(a.v&&has(a.id))m*=1+a.v;});return m;}
function achS(){let m=1;ACH.forEach(a=>{if(a.s&&has(a.id))m*=1+a.s;});return m;}
const outCount=()=>S.out.length+(S.gone?S.gone.length:0);   /* OUT + discarded for good */

function valueMult(){
  return (1+ECO.INK_PER*L('value'))
       * (1+ECO.EYE_PER*L('eye')*eyeCount())
       * (1+.03*L('sleight')*outCount())
       * (1+.06*M('storage')*outCount())
       * (1+.25*M('prodigy'))
       * (1+ECO.SHALL_PER*S.shAll) * achV();
}
const multStep=()=>ECO.MULT_STEP+ECO.MOMENTUM_PER*L('mult');
const baseCD=()=>Math.max(.22, ECO.CD*Math.pow(ECO.SPEED_PER,L('speed'))*Math.pow(ECO.QUICK_PER,M('quick')));
/* Haste is a live aura across every table — one copy is all you need */
const anyHaste=()=>S.hands.some(h=>h.ids.some(id=>byId(id).stk==='haste'));
const curCD=()=>Math.max(.18, baseCD()*(anyHaste()?ECO.HASTE_MUL:1));
/* one card per buy. Tiers 1-5 are the hand-set CARD_LADDER ladders, one
   price per copy (the 4s pay 20/25/30/40, the 5s open the climb at 50);
   tiers 6+ price anchor*step^(v-anchorV)*(v/anchorV) with copies spanning
   one grow factor. Lifetime spend through the 10s lands on exactly
   100,000 and into the millions by the 14s */
const cardCost=v=>v<=5?Math.ceil(ECO.CARD_LADDER[v-1][ownedOf(v)]*(1-.06*M('press')))
  :Math.ceil(ECO.CARD_ANCHOR*Math.pow(ECO.CARD_STEP,v-ECO.CARD_ANCHOR_V)*(v/ECO.CARD_ANCHOR_V)*Math.pow(ECO.CARD_GROW,ownedOf(v)/v)*(1-.06*M('press')));
const tierDone=v=>ownedOf(v)>=v;
/* the DECK tab's gate: the cheapest card you could actually buy now */
function cheapestCard(){let m=Infinity;
  for(let v=1;v<=unlockedV();v++)if(!tierDone(v))m=Math.min(m,cardCost(v));
  return isFinite(m)?m:ECO.TAB_REQ.cards;}
/* completing tier v-1 hands you exactly (v-1)v/2 cards — that unlocks tier v */
const unlockReq=v=>(v-1)*v/2;
function unlockedV(){let u=3;for(let v=4;v<=MAXV;v++){if(S.cards.length>=unlockReq(v))u=v;else break;}return u;}
/* duplicates of the same sticker run +10% each; variety stays at base price.
   pm = in-tier price marker: same tier, stronger effect, steeper price.
   A sticker Dredge borrowed onto a card is not an owned copy.
   The spread tax: every applied sticker adds +3% to the OTHER stickers'
   price, additive — a roster you keep widening costs more to widen. A
   sticker's own copies self-exclude; their climb is dupGrow's job */
const stkOwned=k=>S.cards.filter(c=>c.stk===k&&!c.osk).length;
const stkPrice=k=>Math.ceil(ECO.STK_BASE*Math.pow(STK[k].t,ECO.STK_TPOW)*(STK[k].pm||1)*Math.pow(ECO.STK_GROW,stkOwned(k))*(1-.12*M('trader'))
  *(1+ECO.STK_INF*Math.max(0,S.cards.filter(c=>c.stk&&!c.osk).length-stkOwned(k))));
const dePrice=k=>Math.max(ECO.DEBOLT_MIN, Math.ceil(stkPrice(k)*ECO.DEBOLT_FRAC));
/* lifetime score spent at the sticker shop: buys and strips both count.
   De-bolt unlocks once it crosses DEBOLT_AT */
const stkSpent=()=>S.st.stkSpent||0;
const deboltUn=()=>stkSpent()>=ECO.DEBOLT_AT;
/* shiny stock: the press runs its holo pass once the last 5 busts all
   sat under SHINY_COLD risk. bustLog holds those last 5, capped */
const shinyUn=()=>{const l=S.st.bustLog||[];
  return l.length>=5&&Math.max.apply(null,l)<ECO.SHINY_COLD;};
/* the roll: SHINY_CHANCE base, SHINY_PER a level on Luster (shards) */
const shinyChance=()=>ECO.SHINY_CHANCE+ECO.SHINY_PER*M('luster');
const shinyN=h=>h.ids.reduce((a,id)=>a+((byId(id)||{}).shy?1:0),0);
const shinyMul=h=>Math.pow(ECO.SHINY_X,shinyN(h));
/* the rip's unlock: the press only tears stock for a player who has set
   a card to 0. Float and Bail both zero a table's cards; the tear waits
   for that (docs/card-modifiers.md, Ripped) */
const rippedUn=()=>(S.st.zeroed||0)>0;
/* the condition roll: every press chance flips once per buy. The
   mboost doubling (the cycle a row's level 1 was bought) rides here */
function rollConds(){const hits=[];
  for(const k in ECO.COND_CH){
    if(Math.random()<ECO.COND_CH[k]*((S.mboost&&S.mboost[k])?2:1))hits.push(k);}
  /* a card wears at most one: several hits resolve to one at random */
  return hits.length?[hits[rndi(hits.length)]]:[];}
/* restock-now: the listed price decays 1%/min toward the floor; each
   purchase resets it ×1.2 from what you paid — skipping the wait stays
   possible, never free */
const rrCost=()=>Math.max(ECO.RESTOCK_FLOOR,
  Math.ceil((S.shop.rrP||ECO.RESTOCK_NOW)*Math.pow(ECO.RESTOCK_DECAY,(Date.now()-(S.shop.rrT||0))/60000)*(1-.12*M('trader'))));
/* the shop stocks deeper tiers as your placed-sticker count grows —
   borrowed stickers (c.osk set) are rentals, not placements */
const tierOf=()=>{const n=S.cards.filter(c=>c.stk&&!c.osk).length;
  let t=1;ECO.TIER_AT.forEach((req,i)=>{if(n>=req)t=i+2;});return t;};
const shopGap=()=>Math.max(ECO.RESTOCK_MIN, ECO.RESTOCK_S*(1-.09*M('trader')))*1000;
const ascReq=()=>Math.ceil(ECO.ASC_REQ*Math.pow(ECO.ASC_REQ_GROW,S.asc));
const shardGain=()=>S.banked<ascReq()?0:
  Math.floor(ECO.SHARDS_BASE*Math.pow(S.banked/ascReq(),.5)*(1+.12*M('fortune'))*achS());

/* ---------------- per-hand ---------------- */
const pureVals=h=>{const s=new Set();for(const id of h.ids){const c=byId(id);if(c.stk==='purify')s.add(cval(c));}return s;};
/* risky cards for this hand: deck cards whose value matches a value you
   hold, minus Purified values. The gauge is this count over deck size */
const riskyIn=h=>{
  if(!S.deck.length||!h.ids.length)return 0;
  const p=pureVals(h),hv=new Set(h.ids.map(id=>cval(byId(id))));
  let n=0;for(const id of S.deck){const c=byId(id);if(hv.has(cval(c))&&!p.has(cval(c)))n++;}
  return n;
};
/* every value a live table would bust on: held values minus Purified,
   one set per hand, unioned. One table in play this is exactly the
   gauge's set; the DECK tab tints deck cards carrying one of these */
const riskyVals=()=>{
  const rv=new Set();
  for(const h of S.hands){
    if(!h.ids.length)continue;
    const p=pureVals(h);
    for(const id of h.ids){const v=cval(byId(id));if(!p.has(v))rv.add(v);}
  }
  return rv;
};
function threat(h){return S.deck.length?riskyIn(h)/S.deck.length:0;}
/* Anchor guards no more: its on-draw window lives in actions, the dodge
   line is Marked Deck's alone */
const dodgeOf=h=>ECO.MARKED_PER*L('marked');
/* a deck's buyable ceiling: the Marked Pendant lifts Marked Deck's ladder
   30 levels to 50, so the slip line can climb to 50% */
const uMax=id=>id==='marked'&&M('pendant')?UPG.marked.max+20:UPG[id].max;
/* an upgrade's next price: base×g^level, unless the row pins its own
   ladder (Pre-Flick's 500 / 1500 / 5000) */
const upCost=(u,l)=>u.c?u.c(l):Math.ceil(u.base*Math.pow(u.g,l));
/* the stop dial's ceiling: the deepest line Draw Stop allows, per
   level. The gauge is honest, so this ignores ward/dodge/grace by
   construction */
const autoStop=()=>{const l=L('guard');return l?ECO.GUARD_AT[l-1]:null;};
/* the draw-stop line: where the deal refuses to continue. The player's
   dial, 5% steps, capped by the Draw Stop ceiling. Without the upgrade
   the stop rides the bank-at line (the tolerance) */
const drawStop=()=>{const c=autoStop();
  return c==null?S.set.risk/100
    :Math.min(S.set.stop==null?95:S.set.stop,Math.round(c*100))/100;};
/* the stop line is a FULL STOP for the autos. The deal refuses any
   table at/over the line, and a table the line catches mid-fill (under
   the cap) freezes: no deal, no bank, it belongs to the player again.
   The hold lifts at the cap and on a known bust (both bank). Without
   the freeze every tier past 1 churns single cards: the line sits
   under one card's gauge, so auto-bank would cash each card the
   moment it lands */
const autoLineHeld=h=>!!(L('auto')&&S.set.autoDraw)
  &&h.ids.length>0&&h.ids.length<L('auto')
  &&threat(h)*100>=drawStop()*100
  &&!autoHolds(h);
/* display only — the true odds the card actually faces */
const effective=h=>threat(h)*(1-Math.min(ECO.DODGE_CAP,dodgeOf(h)));
function riskPremT(t,h){
  const bea=h.ids.some(id=>byId(id).stk==='beacon')?1.5:1;
  const stk=h.run.stakesD>0?2:1;
  const m=(ECO.RISK_COEF+ECO.NERVE_PER*L('nerve')+ECO.DARING_PER*M('daring'))*bea*stk;
  /* the premium line: ×0.6 at 0% risk, break-even at 40%, ×2 at 100%.
     Nerve, daring, beacon and stakes scale both slopes past those marks */
  return t<=ECO.RISK_EVEN
    ? ECO.RISK_FLOOR+t*(1-ECO.RISK_FLOOR)/ECO.RISK_EVEN*m
    : 1+(t-ECO.RISK_EVEN)*(ECO.RISK_TOP-1)/(1-ECO.RISK_EVEN)*m;
}
const riskPrem=h=>riskPremT(threat(h),h);
function cardValue(c,ctx){
  if(c.dud)return 0;
  if(ctx.fl.indexOf(c.id)>=0)return 0;              /* floated: already paid */
  let v=c.stk==='mirror'?ctx.maxV:cval(c);
  if(c.stk!=='mirror')v+=ctx.prime;
  if(c.stk==='gild')v*=ECO.GILD_X;                   /* benched, but placed copies still pay */
  if(cardHas(c,'graded'))v*=ECO.GRADED_X;            /* conditions: slab up.
     Dog-Eared never touches pay: its whole cost is the eye's blindness */
  if(c.boom3)v*=ECO.ODDS_X;                         /* …and Odds' triple */
  if(c.r)v*=1+ECO.RELIC_PER*c.r;
  if(v>=8)v*=1+.15*L('high');
  if(v>=14)v*=1+.20*L('deep');
  return v;
}
/* the card's base worth before its own sticker's multiplier — the layer
   the sticker tags quote as their live bonus. Upgrades, the relic marks
   and the high/deep bands ride later steps, so they stay out; floated
   and Odds-dud cards read 0, honestly, and a gambled winner carries the
   triple in (the gamble can now land on any stickered card) */
function stkBase(c,h){
  if(!h||h.run.floated.indexOf(c.id)>=0||c.dud)return 0;
  const prime=h.ids.reduce((a,id)=>a+(byId(id).stk==='prime'?1:0),0);
  let v=c.stk==='mirror'?Math.max(...h.ids.map(id=>cval(byId(id)))):cval(c);
  if(c.stk!=='mirror')v+=(c.stk==='prime'?prime-1:prime)*ECO.PRIME_ADD;
  if(c.boom3)v*=ECO.ODDS_X;
  return v;
}
/* roll = {bloom,kindle} hit counts from the bank roll. Without it the
   gambles read dormant: the readout, busts and Float all pay the
   guaranteed table, only bank() rolls. Each firing Bloom pays per card
   times every Bloom on the table, so copies compound twice over */
function handMult(h,roll){
  const n=h.ids.length;if(!n)return 1;
  let surge=0,bl=0;
  for(const id of h.ids){const k=byId(id).stk;
    if(k==='surge')surge++;else if(k==='bloom')bl++;}
  /* Variety: +mult per stickered card on the table, itself included —
     the deterministic read on the Surge/Bloom/Kindle dial */
  const va=h.ids.reduce((a,id)=>a+(byId(id).stk?1:0),0);
  return 1+multStep()*(n-1)+ECO.SURGE_STEP*surge+ECO.VAR_PER*va
       +(roll?ECO.KINDLE_PER*(roll.kindle||0)*(n-1)
             +ECO.BLOOM_PER*(roll.bloom||0)*bl*n:0);
}
/* combo difficulty: the bank that ticks the chain must grow with it —
   2 cards at the base, 3 once the chain sits at 10, 4 at 20. A short
   bank still pays but lets the chain slip: -1 */
const chainReq=ch=>2+Math.floor(ch/ECO.CHAIN_STEP_AT);
/* Chain Reaction: the per-bank rate itself rides the combo — deep chains
   pay superlinearly, push your luck compounds */
const chainRate=c=>ECO.CHAIN_PER+ECO.CHAIN_WARM*Math.min(c,ECO.CHAIN_WARM_AT)
  +ECO.CHAIN_HOT*Math.max(0,c-ECO.CHAIN_WARM_AT);
const chainMul=h=>1+L('chain')*h.chain*chainRate(h.chain);   /* uncapped — long chains pay */
const overMul=h=>h.ids.length>=ECO.OVER_AT?1+ECO.OVER_PER*L('over'):1;
/* Tab: the out-pile wage, OUT and gone-for-good alike. Layaway: the
   bench wage, +5% payout per waiting card, per copy */
function booksMul(h){
  let led=1;
  const tb=h.ids.reduce((a,id)=>a+(byId(id).stk==='tab'?1:0),0);
  if(tb)led*=1+ECO.TAB_PER*tb*outCount();
  const lw=h.ids.reduce((a,id)=>a+(byId(id).stk==='layaway'?1:0),0);
  if(lw&&S.disc&&S.disc.length)led*=1+ECO.LAY_PER*lw*S.disc.length;
  return led;
}
/* the full pay ride: every multiplier a score gain stacks at this
   instant — value, hand, chain, premium, books, over, rebound, jynx,
   shiny. handParts multiplies its card base by it, and every +score a
   CARD EFFECT pays (Tribute, Rake, Siphon, Mint, Remnant, Exit) rides
   the same stack: a pay is a pay. flat skips the premium (the premium
   is the wage of risk actually taken, and Float never took any), pre
   quotes the deck as the player faced it, {rx,n} risky over deck size
   with the drawn buster still counted — the bust's pays read that view,
   so pulling the killer out of the deck moves no number on it */
function payMul(h,roll,flat,pre){
  if(!h||!h.ids.length)return valueMult();
  const rx=pre?pre.rx:riskyIn(h);
  /* Jynx: trouble is income — +2% per risky card in the deck, per Jynx.
     The deck scan only runs when a Jynx is actually out */
  const jx=h.ids.reduce((a,id)=>a+(byId(id).stk==='jynx'?1:0),0);
  const reb=h.run.rebound?(1+.12*M('rebound')):1;
  return valueMult()*handMult(h,roll)*chainMul(h)
    *(flat?1:riskPremT(pre?pre.rx/pre.n:threat(h),h))
    *booksMul(h)*overMul(h)*reb
    *(jx?1+ECO.JINX_PER*jx*rx:1)*shinyMul(h);
}
function handParts(h,flat,roll,pre){
  if(!h.ids.length)return{base:0,total:0,led:1};
  const n=h.ids.length;
  const maxV=Math.max(...h.ids.map(id=>cval(byId(id))));
  const prime=h.ids.reduce((a,id)=>a+(byId(id).stk==='prime'?1:0),0);
  /* Ledger reads the OUT pile once: a card whose twin sits OUT pays its
     value again, per Ledger copy. Gone-for-good cards count for nothing —
     OUT only */
  const exTw=new Set(S.out.map(id=>cval(byId(id))));
  const ln=h.ids.reduce((a,id)=>a+(byId(id).stk==='ledger'?1:0),0);
  let base=0;
  for(const id of h.ids){const c=byId(id);
    const v=cardValue(c,{maxV,prime:(c.stk==='prime'?prime-1:prime)*ECO.PRIME_ADD,fl:h.run.floated});
    base+=v;
    if(ln&&exTw.has(cval(c)))base+=v*ln;}
  /* Brass: the table's wage — flat score per card, per Brass, per Brass.
     It rides every multiplier, so the mult stickers make it matter */
  const br=h.ids.reduce((a,id)=>a+(byId(id).stk==='brass'?1:0),0);
  if(br)base+=ECO.BRASS_SCORE*br*br*n;
  /* Shiny: holo vinyl holds its own — ×1.1 per shiny on the table,
     on top of everything else (it rides inside payMul) */
  const led=booksMul(h);
  const total=base*payMul(h,roll,flat,pre);
  return{base,total,led};
}
/* a hand is bankable while any card on it still holds unbanked value */
const canBank=h=>h.ids.length&&!h.ids.every(id=>h.run.floated.indexOf(id)>=0);
function offline(prev){
  if(!OFFLINE_ON)return null;
  const dt=(Date.now()-prev)/1000;
  if(dt<120||!L('auto')||!S.rate)return null;
  const capH=4+2*M('dreamer'),t=Math.min(dt,capH*3600),eff=.40+.15*M('dreamer');
  const gain=t*S.rate*eff;if(gain<1)return null;
  S.score+=gain;S.banked+=gain;S.life+=gain;S.st.bankSum=(S.st.bankSum||0)+gain;
  logAct('off',gain);
  return{gain,t,eff,cap:dt>capH*3600};
}
