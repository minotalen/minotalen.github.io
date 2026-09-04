/* ==================================================================
   panels.js — view renderers (deck, upgrades, sticker shop, goals, ascend),
   purchases, goal checks, unlock reveals, ascension
   ================================================================== */
/* the pocket preview. A real card (c passed) wears every face state the
   felt paints: soggy's wet wash, glass sheen, the graded case + MINO
   label, promo's holo bar and foil digit, and an empty .cnd layer tagged
   data-cid for the modal painter to fill with the seeded wear */
const mini=(v,stk,r,id,c)=>{
  const wet=!!c&&cardHas(c,'soggy'),glass=!!c&&cardHas(c,'glass'),
        graded=!!c&&cardHas(c,'graded'),promo=!!c&&cardHas(c,'promo');
  const cls=[wet&&'cwet',glass&&'cglass',graded&&'cgraded',promo&&'cpromo']
    .filter(Boolean).join(' ');
  const dc=((c&&(c.cv!=null||c.osk))?'tmp':'')+(promo?' holonum':'');
  return `<div class="mc${cls?` ${cls}`:''}"${c?` data-cid="${c.id}"`:''}`+
    (promo?` style="--holoink:${inkOf(v)};--holotab:${tintOf(v)}"`:'')+`>`+
    (promo?'<div class="bar holo"></div>':`<div class="bar" style="background:${tintOf(v)}"></div>`)+
    (stk?stickerHTML(stk,'c'+(id||v),null,c):'')+
    `<b${dc?` class="${dc.trim()}"`:''} style="color:${inkOf(v)}">${v}</b>`+
    (r?`<span class="r">+${Math.round(r*ECO.RELIC_PER*100)}%</span>`:'')+
    (graded?'<span class="minolbl">MINO 10</span>':'')+
    (c?'<i class="cnd"></i>':'')+`</div>`;
};

/* ---------------- purchases ---------------- */
function buyCard(v){
  const cost=cardCost(v);
  if(S.score<cost||tierDone(v)||v>unlockedV()){SFX.deny();return;}
  S.score-=cost;
  const nc=addCard(v);faceOf(nc);
  /* the condition roll: one flip per press chance (economy.js). Hits
     are permanent and ride the buy toast, rip-style */
  const hits=ECO.COND_LIVE?rollConds():[];
  if(hits.length){nc.cond=hits;faceOf(nc);}
  if(!S.hands.some(h=>h.ids.length))rebuildDeck();
  else S.deck.splice(rndi(S.deck.length+1),0,nc.id);
  /* bought away from the table: it owes the felt a show-and-tuck */
  newIns.push(nc.id);
  layout();SFX.buy();buzz(12);
  if(hits.length)toast(`A ${v} joins the deck\n`+
    hits.map(k=>COND[k].n.toUpperCase()+': '+COND[k].d).join('\n'),'plus');
  else toast(`A ${v} joins the deck`,'plus');
  checkAch();unlocks();paint();renderCards();save(true);
  /* the deck-build itself is a purchase stream: first buy is a funnel
     step, the value mix rides a 1-in-10 sample like banks. cv not v:
     the envelope already owns v (schema version) and a payload v would
     clobber it into a server-side drop */
  biFirst('card');
  if(Math.random()<.1)bi('buy',{k:'card',cv:v,p:biBucket(cost),t:biPlayMin()});
  tutEvent('buy');
}
function buyUpg(id){
  const u=UPG[id];if(!u)return;
  const l=L(id);if(l>=uMax(id))return;
  if(upGate(id)){SFX.deny();return;}   /* a level-gated rung waits on its goal */
  const cost=Math.ceil(u.base*Math.pow(u.g,l));if(S.score<cost){SFX.deny();return;}
  S.score-=cost;S.up[id]=l+1;SFX.buy();buzz(12);
  logAct('upg',-cost);
  biFirst('upg');bi('buy',{k:'upg',id,l:l+1,p:biBucket(cost),t:biPlayMin()});
  if(id==='auto'&&S.up.auto===1)toast(OFFLINE_ON?'Auto-draw online\nOffline earnings on':'Auto-draw online','clock');
  if(id==='guard')toast(`Draw Stop\nThe stop dial now reaches ${Math.round(ECO.GUARD_AT[S.up.guard-1]*100)}% risk`,'alert');
  if(id==='split'){S.hands.push(newHand());
    toast(`Another hand\n${S.hands.length} tables now`,'stack');layout();}
  paint();renderUp();save(true);
  tutEvent('upgbuy');
}
function buyMeta(id){
  const m=META[id];if(!m)return;
  const l=M(id);if(l>=m.max)return;
  if(metaGate(id)){SFX.deny();return;}   /* a gated rung waits on its goal */
  const cost=Math.ceil(m.c(l));if(S.shards<cost){SFX.deny();return;}
  S.shards-=cost;S.meta[id]=l+1;SFX.buy();paint();renderPres();save(true);
  logAct('meta',-cost);
  bi('buy',{k:'meta',id,p:biBucket(cost),t:biPlayMin()});
}
function rollShop(quiet){
  /* the free rotation also resets the restock-now price to base: the
     ×1.2 escalation only prices reroll-spam inside one stock window */
  const p=pool();S.shop.offers=[];S.shop.rrP=ECO.RESTOCK_NOW;S.shop.rrT=Date.now();
  S.shop.next=Date.now()+shopGap();
  if(p.length)S.shop.offers=pickOffers(p);
  /* the tick rolls stock before the tab itself unlocks: stay silent
     until STICKER SHOP is open (S.seen.shop) */
  if(!quiet&&p.length&&S.seen.shop)toast('Sticker shop restocked','spark');
  save(true);
}
/* stock = goal-unlocked stickers up to your open tier (tierOf, economy.js).
   A unique you already own never rolls again — only one exists, ever */
const pool=()=>STKKEYS.filter(k=>stkUn(k)&&STK[k].t<=tierOf()&&
  !(NONSTACK[k]&&S.cards.some(c=>c.stk===k||c.osk===k)));
/* each slot rolls a tier first — ECO.TIER_W weights t1 8 down to t5 4, so
   the top tier lands half as often as the first — then a sticker from it.
   Only stocked tiers join the draw, so early shops renormalize */
function pickOffers(p){
  const seen=new Set(),out=[],slots=3+(M('stall')?1:0)+(M('union')?1:0);
  const uq={};                       /* each unique rides its own 1/2 roll */
  while(out.length<slots&&seen.size<p.length){
    const byT={};
    for(const k of p){
      if(seen.has(k))continue;
      if(NONSTACK[k]){
        if(!(k in uq))uq[k]=Math.random()<.5;
        if(!uq[k])continue;
      }
      (byT[STK[k].t]=byT[STK[k].t]||[]).push(k);
    }
    const tiers=Object.keys(byT);
    if(!tiers.length)break;          /* nothing left but coin-lost uniques */
    let r=Math.random()*tiers.reduce((a,t)=>a+ECO.TIER_W[t-1],0),t=tiers[0];
    for(const ti of tiers){r-=ECO.TIER_W[ti-1];if(r<=0){t=ti;break;}}
    const k=byT[t][rndi(byT[t].length)];
    seen.add(k);
    /* one roll in ten comes off the press shiny: holo vinyl, double price.
       The press only runs once the cold-bust bar is met (shinyUn) —
       cosmetic vinyl with a ×1.1 per shiny on its table */
    const shy=shinyUn()&&Math.random()<ECO.SHINY_CHANCE;
    out.push({k,price:stkPrice(k)*(shy?2:1),shy:shy?1:0,sold:false});
  }
  /* de-bolt rides a lucky roll once the spend gate is met (deboltUn,
     economy.js): 10% per (re)stock, and it eats a slot */
  if(out.length&&deboltUn()&&Math.random()<ECO.DEBOLT_CHANCE)
    out[rndi(out.length)]={k:'debolt',sold:false};
  return out;
}
function reroll(){
  const c=rrCost();if(S.score<c){SFX.deny();return;}
  S.score-=c;S.shop.rrP=Math.ceil(c*ECO.RESTOCK_G);S.shop.rrT=Date.now();
  logAct('rr',-c);
  bi('buy',{k:'rr',p:biBucket(c),t:biPlayMin()});
  S.shop.offers=pickOffers(pool());
  SFX.buy();paint();renderShop();save(true);
}
function buyStk(i){
  const o=S.shop.offers[i];
  if(!o||o.sold){SFX.deny();return;}
  if(o.k==='debolt'){openDebolt(i);return;}   /* lucky roll: the strip menu */
  if(S.score<o.price){SFX.deny();return;}
  const cs=pickField();
  if(!cs)return;
  S.score-=o.price;o.sold=true;
  S.st.stkSpent=(S.st.stkSpent||0)+o.price;   /* the de-bolt gate reads this */
  logAct('stk',-o.price);
  biFirst('stk');bi('buy',{k:'stk',id:o.k,p:biBucket(o.price),t:biPlayMin()});
  S.pick={k:o.k,shy:o.shy||0,ids:cs.map(c=>c.id)};
  SFX.buy();buzz(12);
  paint();renderShop();save(true);
}
/* the pick stage's three candidates, shared by purchases and the gift:
   distinct values first, and a short field fills back in with
   same-value duplicates, the highest value first */
function pickField(){
  const blank=S.cards.filter(c=>!c.stk);
  if(!blank.length){toast('Every card has a sticker','alert');return null;}
  const seen=new Set(),cs=[];
  for(const c of shuffle(blank))
    if(!seen.has(c.v)){seen.add(c.v);cs.push(c);if(cs.length===3)break;}
  if(cs.length<3)for(const c of shuffle(blank.slice()).sort((a,b)=>b.v-a.v))
    if(!cs.includes(c)){cs.push(c);if(cs.length===3)break;}
  cs.sort((a,b)=>a.v-b.v);
  return cs;
}
/* the shop-unlock gift: a free Snip pinned above the stock until taken.
   Claiming pays nothing and opens the pick stage; S.pick rides the
   save, so a claimed gift survives reloads — the offer itself dies the
   moment it is picked up, never before */
function claimGift(){
  if(!S.gift||S.pick)return;
  const cs=pickField();
  if(!cs)return;
  const k=S.gift.k;S.gift=null;
  biFirst('stk');   /* a gifted sticker is still your first sticker */
  bi('gift',{w:k,d:1,t:biPlayMin()});
  S.pick={k,shy:0,ids:cs.map(c=>c.id)};
  SFX.buy();buzz(12);
  paint();renderShop();save(true);
}
/* the drop lands anywhere on the card; the sticker is nudged off the
   edges but only gently corralled around the numeral — its ink reaches
   ~20-25% of the card width from the center, so the outer ranges keep
   the bulk of the vinyl on the card while the numeral band (glyph span
   22.5/77.5, % of face height) allows deep overlap: the strips lean
   well onto the print (30/70). x stays honest — the push is vertical,
   into the strips above and below the digit. Seeded anchors live in
   their own strips (RINK/DIGH in stickers.js) */
function clampStk(x,y){
  x=Math.max(25,Math.min(75,x));
  if(y>30&&y<70)y=y-30<=70-y?30:70;
  y=Math.max(18,Math.min(82,y));
  return[x,y];
}
function placeStk(id,px,py,rot){
  const c=byId(id);if(!c||c.stk||!S.pick)return;
  const[x,y]=clampStk(px,py);
  c.stk=S.pick.k;c.sx=x;c.sy=y;if(S.pick.shy){c.shy=1;S.st.shinyPlaced=(S.st.shinyPlaced||0)+1;}
  /* the angle rides the drag's sine sway — release timing picks it.
     No drag angle (deep-link, older save): fall back to the seed tilt */
  c.srot=Math.round((rot!=null?rot:stkPose(S.pick.k,'c'+id).rot)*10)/10;
  S.st.placed=(S.st.placed||0)+1;S.pick=null;
  /* the rip: one apply in a hundred tears the stock into the RIPPED
     condition, sticker and all. The press only tears once a card has
     been set to 0 (rippedUn), and a card wears at most one condition */
  const rip=rippedUn()&&Math.random()<ECO.RIP_CHANCE&&!(c.cond&&c.cond.length);
  if(rip)c.cond=['ripped'];
  /* the placement completes the purchase loop: which vinyl actually
     landed, on what, and whether the press or the apply rolled against
     the player (shiny/rip live rates vs ECO) */
  bi('stk',{id:c.stk,cv:c.v,shy:c.shy?1:0,rip:rip?1:0,t:biPlayMin()});
  faceOf(c,true);
  /* the apply, ON RELEASE: the sticker starts exactly where the guide
     left it — same spot, same angle, no flight from elsewhere — rises
     slowly, hangs a beat at the apex, then comes down with weight;
     contact lands ~1.1s in. The peel already happened back on the pad
     at pickup; the card never moves: a pressure ring and a shadow
     press ground the contact frame, the stage holds through the long
     settle, then flips to the shop */
  const el=document.querySelector(`.pcard[data-id="${id}"]`);
  const impact=()=>{
    SFX.slap();buzz(34);
    toast(`${STK[c.stk].n} slapped onto a ${c.v}`
      +(rip?'\nRIPPED: on draw: pays 1 ward, then deals 2 more cards':''),rip?'alert':'spark');
    if(rip)setTimeout(()=>SFX.rip(),90);
    if(el){const r=el.getBoundingClientRect();
      spray(r.left+r.width*x/100,r.top+r.height*y/100,'#B9B2A0',18);
      el.insertAdjacentHTML('beforeend',`<i class="sring" style="left:${x}%;top:${y}%"></i>`);
      /* the flash tears from the outer edge, the same geometry the
         placed card will wear: seeded edge, spot along it, inward swing */
      if(rip){
        const RE=['t','r','b','l'][rndi(4)],ra=14+rndi(73),rw=30+Math.random()*12,
          rang=({t:90,r:180,b:270,l:0})[RE]+Math.random()*50-25,
          rpos=RE==='t'?`left:${ra}%;top:0`:RE==='r'?`left:100%;top:${ra}%`:
                RE==='b'?`left:${ra}%;top:100%`:`left:0;top:${ra}%`;
        el.insertAdjacentHTML('beforeend',
          `<svg class="rt" viewBox="0 0 24 24" style="${rpos};width:${rw.toFixed(1)}%;
            transform-origin:0 50%;transform:rotate(${rang.toFixed(0)}deg)">${tearSVG()}</svg>`);}
      el.classList.add('press');
      setTimeout(()=>el.classList.remove('press'),480);}
  };
  if(el&&!el.querySelector('.stk:not(.gstk)')){
    el.classList.add('peeling');
    el.insertAdjacentHTML('beforeend',stickerHTML(c.stk,'c'+id,'apply',c));
    setTimeout(impact,1100);
    setTimeout(()=>{el.classList.remove('peeling');
      const rg=el.querySelector('.sring');if(rg)rg.remove();
      checkAch();renderShop();},3300);
  }else{impact();checkAch();renderShop();}
  paint();save(true);
}
function ascend(){
  const g=shardGain();if(g<1)return;
  /* Keeper takes what the card IS, not what Dredge borrowed for a turn;
     a card keeps its wear through the reset, the rip scar included */
  const kept=S.cards.filter(c=>c.stk).sort((a,b)=>b.v-a.v).slice(0,M('keeper'))
    .map(c=>({v:c.v,stk:c.osk||c.stk,r:c.r||0,cond:(c.cond&&c.cond.length)?c.cond:null}));
  S.shards+=g;S.shAll+=g;S.asc++;
  S.rst=snapRun(S);   /* the wall's this-run halves restart at the snapshot */
  logAct('asc',g);
  /* fires before the reset: S.asc is the ascend's number, S.score the
     pot it costs — what the prestige curve is made of. The rest is the
     ascend snapshot, the explorable record of what this player had:
     banked, lifetime shards, owned upgrade/meta levels, cards, keepers,
     placements this run (S.rst was just snapped, so the split is live) */
  const lv=o=>Object.keys(o||{}).reduce((a,k)=>a+(+o[k]||0),0);
  biFirst('asc');bi('asc',{g,n:S.asc,t:biPlayMin(),s:biBucket(S.score),
    b:biBucket(S.banked),sa:biBucket(S.shAll),
    u:lv(S.up),un:Object.keys(S.up).length,ml:lv(S.meta),
    kp:kept.length,cd:S.cards.length,
    pl:(S.st.placed||0)-((S.rst&&S.rst.placed)||0)});
  S.up={};S.cards=[];S.deck=[];S.out=[];S.disc=[];S.gone=[];S.nid=1;S.banked=0;S.pick=null;
  S.hands=[newHand()];S.focus=0;S.dhold={};S.mboost={};   /* condition ledgers die with the cycle */
  S.score=Math.floor(400*Math.pow(2.15,M('rich'))-400);
  seed(kept);buildEls();rebuildDeck();layout();rollShop(true);cdEnd=0;
  slam('+'+g+' SHARDS','var(--gld)');spray(innerWidth/2,innerHeight*.4,'#8A6A2F',36);
  SFX.goal();closeMo();checkAch();paint();renderAll();save(true);
}
function seed(kept){
  const top=Math.min(MAXV,3+M('head'));
  for(let v=1;v<=top;v++)for(let i=0;i<v;i++)addCard(v);
  (kept||[]).forEach(k=>{const c=addCard(k.v,k.stk,k.cond);c.r=k.r||0;faceOf(c);});
  /* Preprint: the fresh deck leaves the press with stickers already on.
     Same tier odds as the shop roll, over the unlocked pool — uniques
     respect themselves, and Keeper's vinyl counts toward the tier */
  for(let i=0;i<M('preprint');i++){
    const p=pool();if(!p.length)break;
    const byT={};for(const k of p)(byT[STK[k].t]=byT[STK[k].t]||[]).push(k);
    const tiers=Object.keys(byT).map(Number);
    let r=Math.random()*tiers.reduce((a,t)=>a+ECO.TIER_W[t-1],0),t=tiers[0];
    for(const ti of tiers){r-=ECO.TIER_W[ti-1];if(r<=0){t=ti;break;}}
    const bare=S.cards.filter(c=>!c.stk);
    if(!bare.length)break;
    const c=bare[rndi(bare.length)];
    c.stk=byT[t][rndi(byT[t].length)];
    faceOf(c);
  }
  rebuildDeck();
}

/* ---------------- goals + reveals ---------------- */
/* a stale cached config can name a sticker the live STK lacks — the
   GOALS tab must render anyway */
const stkN=k=>STK[k]?STK[k].n:k;
/* meeting a goal only marks it ready — the bonus lands when the player
   claims it in the GOALS tab */
function checkAch(){
  let got=false;
  for(const a of ACH){
    if(a.stk&&STK_OFF[a.stk])continue;   /* a benched sticker's gate never readies */
    if(has(a.id)||S.ready.indexOf(a.id)>=0)continue;let c=0;try{c=a.g();}catch(e){}
    if(c<a.t)continue;
    S.ready.push(a.id);got=true;
    bi('goal',{id:a.id,st:0,t:biPlayMin()});
    toast(`${a.n}\n${a.d}.`,'star');
  }
  if(got){SFX.goal();buzz(30);save(true);}
  /* the nub holds only while an unseen goal waits — opening GOALS once
     marks them seen (tabs.js fixTab) and the dot goes with it. A stale
     ready entry for a since-benched gate never lights it */
  const b=$('#tabs button[data-v="ach"]');
  if(b&&S.ready.some(id=>{const a=ACH.find(x=>x.id===id);
      return a&&!(a.stk&&STK_OFF[a.stk])&&!has(id)&&!S.rseen[id];})
    &&!b.classList.contains('on')&&!b.querySelector('.nub')){
    const n=document.createElement('span');n.className='nub';b.appendChild(n);}
}
function claimAch(id){
  const a=ACH.find(x=>x.id===id);
  if(!a||has(id)||(a.stk&&STK_OFF[a.stk]))return;
  let c=0;try{c=a.g();}catch(e){}
  if(c<a.t)return;
  S.ach.push(id);
  bi('goal',{id,st:1,t:biPlayMin()});
  const sk=STK[a.stk];
  const w=a.stk?`Sticker unlocked · ${sk?sk.n:a.stk}${sk&&sk.t>tierOf()?' · tier '+sk.t+' stock':''}`
    :a.up?`Upgrade unlocked · ${UPG[a.up]?UPG[a.up].n:a.up}${a.lv>1?' level '+a.lv:''}`
    :a.meta?`Shard upgrade unlocked · ${META[a.meta]?META[a.meta].n:a.meta}${a.lv>1?' level '+a.lv:''}`
    :a.s?`+${Math.round(a.s*100)}% shards`:`+${Math.round(a.v*100)}% card value`;
  toast(`${a.n}\n${w}`,'star',sk?stkIcon(a.stk):null);
  SFX.goal();buzz(30);
  checkAch();paint();renderAch();renderUp();renderShop();renderPres();refreshBuy();save(true);
}
/* tab gating: one locked tab rides the rail at a time — the next gate
   in the chain, each visible once the previous one opens. Its fill
   rides val toward req, and crossing the req opens it for good */
const upCount=()=>Object.values(S.up).reduce((a,b)=>a+b,0);
const TAB_GATE={
  cards:{vis:()=>S.st.banks>0,req:20,val:()=>S.score,u:'score',n:'DECK'},
  ach:{vis:()=>S.seen.cards,req:20,val:()=>S.score,u:'score',n:'GOALS'},
  up:{vis:()=>S.seen.ach,req:8,val:()=>S.cards.length,u:'cards',n:'UPGRADES'},
  shop:{vis:()=>S.seen.up,req:5,val:()=>upCount(),u:'upgrades',n:'STICKER SHOP'},
  pres:{vis:()=>S.banked>=ECO.TAB_REQ.pres,req:ECO.TAB_REQ.pres,val:()=>S.banked,u:'banked',n:'ASCEND'}};
/* tapped while locked: the requirement, tersely (tabs.js) */
const tabHint=v=>{const t=TAB_GATE[v];return t?`${t.n}\nOpens at ${fmtG(t.req)} ${t.u}`:null;};
function unlocks(){
  /* locked tabs ride the rail early: dimmed, filling toward their req —
     the tab is the bar too. The fill lands, lingers a beat, then the
     pill rises clean as the next gate takes its place */
  const OPEN={cards:'DECK\nCards, one buy at a time',ach:'GOALS\nEach unlocks something',
    up:'UPGRADES\nPower bought with score',
    shop:'STICKER SHOP\nFirst sticker free: Snip',
    pres:'ASCEND\nReset for shards'};
  for(const k in TAB_GATE){
    const t=TAB_GATE[k],b=$(`#tabs button[data-v="${k}"]`);
    if(!b||!t.vis())continue;
    b.classList.remove('hid');
    if(!S.seen[k]){
      b.classList.add('lock');
      b.style.setProperty('--p',Math.min(100,t.val()/t.req*100).toFixed(1)+'%');
      if(t.val()>=t.req){
        S.seen[k]=true;
        biFirst('tab:'+k);
        if(!b.querySelector('.nub')){const n=document.createElement('span');n.className='nub';b.appendChild(n);}
        toast(OPEN[k],'unlock');SFX.goal();
        if(k==='cards')tutEvent('cards');
        if(k==='up')tutEvent('upopen');   /* the coach's grind ends here */
        /* the shop's opening gift: a free Snip, granted the moment the
           tab unlocks, pinned above the stock until taken */
        if(k==='shop'&&!S.gift){S.gift={k:'snip'};
          bi('gift',{w:'snip',t:biPlayMin()});}}
    }else if(b.classList.contains('lock')){
      b.classList.remove('lock');b.style.setProperty('--p','');}
  }
  /* every pill is flex:1, so one joining the rail resizes them all —
     and the next gate unhides later in this same pass than the crossing
     above. Measure once at the end, or the thumb keeps the old rail's
     shape until something clicks */
  Tabs.thumb();
  syncWide();   /* a first tab birthing the rail births the wide panel too */
}

/* ---------------- renderers ---------------- */
/* fills rise instead of popping: each `.pf` row is re-seated at its last
   painted fill (zero for a first sighting), then eased to the live value
   by the `--p` transition. Rows painted while their tab is dark reset,
   so a tab always fills up as it slides in. Crossing into full — a goal
   flowing in — washes the row once */
const PFP={};
function fillUp(panel,pk){
  const view=$(panel);
  if(!view.classList.contains('on')){
    Object.keys(PFP).forEach(k=>{if(k.indexOf(pk+':')===0)delete PFP[k];});
    return;}
  $$(panel+' .row.pf').forEach((r,i)=>{
    const k=pk+':'+(r.dataset.pk||'#'+i);
    const tgt=r.style.getPropertyValue('--p')||'0%';
    const prev=k in PFP?PFP[k]:'0%';
    if(prev===tgt)return;
    const seen=k in PFP;
    r.style.setProperty('--p',prev);void r.offsetWidth;
    r.style.setProperty('--p',tgt);PFP[k]=tgt;
    if(seen&&parseFloat(prev)<100&&parseFloat(tgt)>=100){
      r.classList.add('pfdone');
      r.addEventListener('animationend',()=>r.classList.remove('pfdone'),{once:true});}
  });
}
/* one card in the deck grid: sticker face front, sticker text back.
   rv is the risky-value set: a card still in the deck carrying one is
   tinted pink, drawing it would bust a table */
function gcell(c,dim,rv){
  const a=c.stk?STK[c.stk]:null,v=cval(c),tmp=c.cv!=null||c.osk!=null;
  const rk=rv&&rv.has(v)&&S.deck.includes(c.id);
  const pr=cardHas(c,'promo');
  const cc=(cardHas(c,'soggy')?' cwet':'')+(cardHas(c,'glass')?' cglass':'')+
    (cardHas(c,'graded')?' cgraded':'')+(pr?' cpromo':'');
  return `<div class="gcard${a?'':' nk'}${dim||''}${rk?' grisk':''}" data-id="${c.id}"><div class="ginn">
    <div class="gface gf${cc}"${pr?` style="--holoink:${inkOf(v)};--holotab:${tintOf(v)}"`:''}><div class="gbar${pr?' holo':''}"${pr?'':` style="background:${tintOf(v)}"`}></div>
      <b${tmp?' class="tmp"':''} class="${cardHas(c,'promo')?'holonum':''}" style="color:${inkOf(v)}">${v}</b>${cardHas(c,'promo')?``:''}${cardHas(c,'graded')?'<span class="minolbl">MINO 10</span>':''}
      ${c.stk?stickerHTML(c.stk,'c'+c.id,null,c):''}${c.r?`<span class="gr">+${Math.round(c.r*ECO.RELIC_PER*100)}%</span>`:''}</div>
    <div class="gface gb"><i>${a?a.n:'BLANK'}</i>
      <span${a?'':' class="gbl"'}>${a?a.d:'no sticker yet'}</span></div>
  </div></div>`;
}
let cardF='all';   /* the YOUR CARDS grid filter: all / d(eck) / t(ables) / o(ut) */
const NUMW=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
  'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
const ANW=new Set(['Eight','Eleven','Eighteen']);   /* vowel-sound names take "an" */
function renderCards(){
  const u=unlockedV();
  let h=`<h2>VALUES</h2><p class="note">Every copy costs more than the last. Complete a set to unlock the next value.</p>`;
  const done=[],open=[];
  for(let v=1;v<=MAXV;v++){if(tierDone(v))done.push(v);else if(v<=u)open.push(v);}
  if(done.length)h+=`<div class="chips" style="margin-bottom:8px">`+
    done.map(v=>`<span class="chip ok">${v}s ${ic('check')}</span>`).join('')+`</div>`;
  for(const v of open){
    const cost=cardCost(v),own=ownedOf(v);
    h+=`<div class="row pf" data-pk="v${v}" style="--p:${(own/v*100).toFixed(1)}%"><div class="mc">${mini(v)}</div>
      <div class="b"><div class="nm">Buy a${ANW.has(NUMW[v])?'n':''} ${NUMW[v]||v}</div></div>
      <button class="buy" data-v="${v}" ${S.score<cost?'disabled':''}>${fmt(cost)}</button></div>`;
  }
  /* every card you own as a flip grid: dimmed ones sit on a table or outside.
     Filter chips: the discard pile (OUT + gone for good) is one tap away */
  const tbl=new Set();S.hands.forEach(hd=>hd.ids.forEach(id=>tbl.add(id)));
  const out=new Set(S.out);S.hands.forEach(hd=>hd.run.culled.forEach(id=>out.add(id)));
  (S.gone||[]).forEach(id=>out.add(id));
  const disc=new Set(S.disc||[]);
  const loc=c=>tbl.has(c.id)?'t':out.has(c.id)?'o':disc.has(c.id)?'x':'d';
  const all=[...S.cards].sort((a,b)=>a.v-b.v||a.id-b.id);
  const list=cardF==='all'?all:all.filter(c=>loc(c)===cardF);
  const nd=all.filter(c=>loc(c)==='d').length;
  const nx=all.filter(c=>loc(c)==='x').length;
  const chip=(f,l,n)=>`<button class="cchip${cardF===f?' on':''}" data-f="${f}">${l} · ${n}</button>`;
  const rv=riskyVals();
  const dim=c=>tbl.has(c.id)?' gt':out.has(c.id)?' go':disc.has(c.id)?' gx':'';
  h+=`<h2>YOUR CARDS · ${S.cards.length}</h2>
    <div class="chips" style="margin-bottom:8px" id="cf">
      ${chip('all','all',all.length)}${chip('d','face-down',nd)}${chip('t','on tables',tbl.size)}${chip('o','out',out.size)}${chip('x','discarded',nx)}</div>
    <p class="note">Tap or hover a card to read its sticker. Out cards get shuffled back on the next bust; discarded cards are shuffled back on bank. A pink glow marks cards that would bust a table if drawn now.</p>
    <div id="dgrid">`+list.map(c=>gcell(c,dim(c),rv)).join('')+`</div>`;
  $('#v-cards').innerHTML=h;fillUp('#v-cards','cards');
  condPaintGrid($('#v-cards'));
  $$('#v-cards .buy[data-v]').forEach(b=>b.onclick=()=>buyCard(+b.dataset.v));
  /* a tap opens the card sheet: the flip stays on hover */
  $$('#v-cards .gcard').forEach(g=>g.onclick=()=>openCardSheet(+g.dataset.id));
  $$('#v-cards #cf .cchip').forEach(b=>b.onclick=()=>{cardF=b.dataset.f;renderCards();});
}
/* the pink tint rides the live hands: autos draw and bank while the tab
   is open, so re-tint in place instead of re-rendering, which would
   reset the card flips */
function paintRisk(){
  if(!$('#v-cards').classList.contains('on'))return;
  const rv=riskyVals(),dk=new Set(S.deck);
  $$('#v-cards .gcard').forEach(g=>{
    const c=byId(+g.dataset.id);
    g.classList.toggle('grisk',!!c&&dk.has(c.id)&&rv.has(cval(c)));
  });
}
/* an upgrade row shows once any of its u-goals is claimed — bought rows
   stay visible. A goal with lv set holds that level's buy until claimed
   (the row-opening goal holds level 1) */
const upOpen=id=>{const gs=ACH.filter(x=>x.up===id);
  return !gs.length||gs.some(x=>has(x.id))||L(id)>0;};
const upGate=id=>{const l=L(id);
  return ACH.find(a=>a.up===id&&(a.lv||1)===l+1&&!has(a.id))||null;};
/* the shard rows read the same rule: a row shows once its SU-goal is
   claimed (bought rows stay visible), the next rung waits on its gate */
const metaOpen=id=>{const gs=ACH.filter(x=>x.meta===id);
  return !gs.length||gs.some(x=>has(x.id))||M(id)>0;};
const metaGate=id=>{const l=M(id);
  return ACH.find(a=>a.meta===id&&(a.lv||1)===l+1&&!has(a.id))||null;};
function renderUp(){
  let h=`<h2>UPGRADES</h2><p class="note">Power bought with score, kept until you ASCEND. Locked rows open through GOALS.</p>`;let hid=0;
  Object.keys(UPG).forEach(id=>{
    const u=UPG[id];
    if(!upOpen(id)&&!L(id)){hid++;return;}
    const l=L(id),mx=uMax(id),max=l>=mx,cost=Math.ceil(u.base*Math.pow(u.g,l));
    const gate=upGate(id);   /* the next level waits on a goal */
    const ds=(typeof u.d==='function'?u.d(l):u.d)   /* descs may speak per level */
      +(gate?`<br>Level ${l+1} · ${gate.n}: ${gate.d}`:'');
    h+=`<div class="row pf" data-pk="u${id}" style="--p:${(l/mx*100).toFixed(1)}%"><div class="b"><div class="nm">${u.n}${mx>1?` <span class="tag">${l}/${mx}</span>`:''}</div>
      <div class="ds">${ds}</div></div>
      <button class="buy" data-u="${id}" ${max||gate||S.score<cost?'disabled':''}>${gate?ic('lock')+' GOAL':max?'MAX':fmt(cost)}</button></div>`;});
  if(hid)h+=`<p class="note" style="text-align:center;color:var(--ink2)">${hid} more unlock via GOALS.</p>`;
  /* YOUR NUMBERS, the ledger: live table state, the records, the lifetime
     counts. Every chip carries a title line spelling out what the number
     means; a goal keeps its own progress on its row in GOALS */
  const n=k=>S.st[k]||0,pct=x=>Math.round(x*100)+'%';
  /* a zero row says nothing: chips without a number sit out, and a group
     whose every chip sat out goes with them. tip rides along as a title */
  const C=(l,v,tip)=>{if(v==null||v==='')return '';
    const m=String(v).match(/-?[\d.]+/);
    return m&&parseFloat(m[0])===0?'':`<span class="chip"${tip?` title="${tip}"`:''}>${l} <b>${v}</b></span>`;};
  const G=(l,cs)=>{const f=cs.filter(Boolean);
    return f.length?`<div class="bk">${l}</div><div class="chips" style="margin-bottom:8px">${f.join('')}</div>`:'';};
  /* past the first ascend the lifetime counters wear two numbers: this
     run / all runs. The run half is the counter minus its ascend-time
     snapshot (S.rst); before it, one number says the same thing */
  const split=S.asc>0&&S.rst;
  const run=k=>split?Math.max(0,n(k)-(S.rst[k]||0)):0;
  const C2=(l,k,tip)=>!split?C(l,fmt(n(k)),tip)
    :(n(k)>0||run(k)>0?`<span class="chip"${tip?` title="${tip}"`:''}>${l} <b>${fmt(run(k))} / ${fmt(n(k))}</b></span>`:'');
  const CV=(l,r,t,tip)=>(r>0||t>0)
    ?`<span class="chip"${tip?` title="${tip}"`:''}>${l} <b>${split?fmt(r)+' / '+fmt(t):fmt(t)}</b></span>`:'';
  h+=`<h2>YOUR NUMBERS</h2>
    <p class="note">The full ledger: what the tables are doing this second, the records you have set, and everything the game has counted since the first hand. A goal keeps its own progress on its row in GOALS.${split?' Two numbers on a chip: this run / all runs.':''}</p>`
    +G('right now',[
      C('card value','×'+valueMult().toFixed(2),'What one card pays, every multiplier stacked: ink, upgrades, shards, goals.'),
      C('draw cooldown',baseCD().toFixed(2)+'s','Seconds between draws, before any Haste.'),
      C('income',fmt(S.rate)+'/s','Score per second, measured over the last stretch of play.'),
      C('chain',(S.hands[S.focus]||{chain:0}).chain,'Banks in a row on the focused table without a bust.'),
      C('deck left',S.deck.length,'Cards still waiting in the draw pile.'),
      C('out',S.out.length,'Cards sitting OUT. Every bust brings the pile home.'),
      C('discard',(S.disc||[]).length,'Cards set aside. They shuffle back the next time you score.'),
      C('hot streak',n('streak'),'Banks worth '+fmtG(ECO.STREAK_AT)+' or more, in a row. This run is live now.')])
    +G('records',[
      C('biggest bank',fmt(n('bestBank')),'The richest single bank, ever.'),
      C('biggest bust',fmt(Math.round(n('bestBust'))),'The most valuable hand you have ever busted.'),
      C('longest chain',n('bestChainN'),'Most banks in a row on one table, no bust between them.'),
      C('richest chain',fmt(n('bestChain')),'Total score banked across one chain, first bank to last.'),
      C('boldest bank',pct(n('bestRisk')),'The hottest risk gauge you have ever banked at.'),
      C('widest hand',n('bigHand'),'Most cards held on one table at once.'),
      C('most tables',n('maxTables'),'Most tables holding cards at the same time.'),
      C('best hot streak',n('bestStreak'),'Longest row of big banks without a miss.'),
      C('most out',n('maxOut'),'Most cards OUT of the deck at once.'),
      C('best shine',n('bestShine'),'Most shiny stickers on one table at once.')])
    +G('lifetime',[
      C2('hands played','runs','A run is one hand on one table: it ends at the bank or the bust.'),
      C2('cards drawn','draws','Every card off the deck, drawn by you or dealt by the autos.'),
      C2('banks','banks','Hands cashed in.'),
      CV('banked value',S.banked,n('bankSum'),'Everything that ever counted toward an ascend: banks, Float and Bail exits, flat bust pays, offline gains.'),
      C2('busts','busts','Hands that drew a twin and died.'),
      CV('bust value',run('bustSum'),n('bustSum'),'Standing value lost to busts: what the hand was worth when it died.'),
      C2('tricks armed','arms','Trick stickers charged. Armed is spent, whether it fired or not.'),
      C2('gamble hits','hits','On-bank flips that paid: Bloom, Kindle, Dividend.'),
      C2('values rewritten','rewrites','Temp value changes worn: Swap, Clip, Ghost, Dredge, Riffle, Engrave.'),
      C2('risky dodges','deflects','Risky cards that never bust you: slips, wards, guards.'),
      C2('twins slipped','slips','Would-be busters that slipped back into the deck: Marked Deck dodges and Anchor guards.'),
      C2('cards sent out','outed','Cards put OUT, your own plays only. The buster seat counts for nothing.'),
      C2('cards discarded','discarded','Cards sent to the discard.')])
    +G('stickers',[
      C2('stickers placed','placed','Stickers slapped onto cards.'),
      C2('shinies placed','shinyPlaced','Holo vinyl that landed on a card.'),
      C('different',cmpDiff(),'Different stickers in play. The compendium opens at '+CMP_AT+'.')]);
  $('#v-up').innerHTML=h;fillUp('#v-up','up');
  $$('#v-up .buy').forEach(b=>b.onclick=()=>buyUpg(b.dataset.u));
}
/* ---------------- the pick stage ---------------- */
/* no modal, no copy: the shop tab becomes the table. Three cards in a
   row, the paid sticker waiting on a raised pad that dips under the
   cursor — drag it onto a card the way cards drag on the felt. A ghost
   previews the clamped spot; the drop is permanent. */
function renderPick(){
  /* the row class carries the count: fewer picks grow the cards so a
     short field still reads as a composed stage */
  $('#v-shop').innerHTML=`<div id="pwrap">
    <div id="prow" class="n${S.pick.ids.length}">${S.pick.ids.map(id=>{const c=byId(id),p=stkPose(S.pick.k,'c'+id);
      return `<div class="pcard" data-id="${id}">
        <div class="pbar" style="background:${tintOf(c.v)}"></div>
        <b style="color:${inkOf(c.v)}">${c.v}</b>
        <svg class="stk gstk${S.pick.shy?' shy':''}" viewBox="0 0 24 24" style="--r:${p.rot}deg;
          transform:translate(-50%,-50%) rotate(${p.rot}deg)">${stickerSVG(S.pick.k)}</svg></div>`;}).join('')}</div>
    <div id="pped"><svg class="${S.pick.shy?'shy':''}" viewBox="0 0 24 24">${stickerSVG(S.pick.k)}</svg></div>
  </div>`;
  initPickDrag();
  /* the deal flips take ~.8s; the first-time drag nudge starts after
     they land and loops until a real hand grabs the pad */
  if(!S.seen.pickDrag)setTimeout(startPNudge,900);
}
/* ---- first-time drag nudge ----
   one singleton ghost vinyl repeats the move for new hands: peels off
   the pad, glides up onto a card, presses the strip, fades — until
   the pad is grabbed for real (S.seen.pickDrag) or the stage goes */
let pnud=null;
function stopPNudge(){if(!pnud)return;
  clearTimeout(pnud.t);pnud.a.cancel();pnud.el.remove();
  clearInterval(pnud.iv);pnud=null;}
function startPNudge(){
  stopPNudge();
  const ped=$('#pped'),cards=$$('#prow .pcard');
  if(!ped||!cards.length||!S.pick||S.seen.pickDrag)return;
  const el=document.createElement('div');el.className='pnudge';
  el.innerHTML=`<svg class="${S.pick.shy?'shy':''}" viewBox="0 0 24 24">${stickerSVG(S.pick.k)}</svg>`;
  document.body.appendChild(el);
  const pr=ped.getBoundingClientRect(),cr=cards[Math.min(1,cards.length-1)].getBoundingClientRect();
  const sx=pr.left+pr.width/2,sy=pr.top+pr.height*.42;
  const tx=cr.left+cr.width/2,ty=cr.top+cr.height*.775;
  const T=(x,y,s,r)=>`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) rotate(${r}deg) scale(${s})`;
  const a=el.animate([
    {transform:T(sx,sy,.8,0),opacity:0,easing:'ease-out'},
    {transform:T(sx,sy-14,.86,-4),opacity:1,offset:.09,easing:'cubic-bezier(.45,0,.55,1)'},
    {transform:T(sx,sy-26,.97,-7),offset:.2,easing:'cubic-bezier(.5,.05,.6,.4)'},
    {transform:T(tx,ty,1,-8),offset:.5,easing:'ease-in-out'},
    {transform:T(tx,ty,1,7),offset:.6,easing:'ease-in-out'},
    {transform:T(tx,ty,.97,0),offset:.68,easing:'ease-out'},
    {transform:T(tx,ty,1,0),opacity:1,offset:.76,easing:'ease-in'},
    {transform:T(tx,ty,1,0),opacity:0,offset:.86,easing:'linear'},
    {transform:T(sx,sy,.8,0),opacity:0}],
    {duration:3400,iterations:Infinity});
  pnud={a,el,t:0,iv:setInterval(()=>{   /* stage left: re-render, tab out, placed */
    if(!ped.isConnected||!$('#v-shop').classList.contains('on')||!S.pick)stopPNudge();},250)};
}
function initPickDrag(){
  const ped=$('#pped');let drag=null,raf=0;
  const cardAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el?el.closest('.pcard'):null;};
  const unhot=c=>{if(c)c.classList.remove('hot');};
  /* hover half of every frame: which card sits under the sticker. The
     coords are the GHOST's, never the finger's — on touch the ghost
     rides above the fingertip, and what you see is what lands */
  const hit=(gx,gy)=>{
    const card=cardAt(gx,gy);
    if(card!==drag.card){unhot(drag.card);drag.card=card;
      if(card){card.classList.add('hot');SFX.detent();buzz(6);}}
    const over=!!card;
    if(over!==drag.over){drag.over=over;drag.g.classList.toggle('hide',over);}
    if(card){
      const r=card.getBoundingClientRect();
      const[x,y]=clampStk((gx-r.left)/r.width*100,(gy-r.top)/r.height*100);
      const gh=card.querySelector('.gstk');
      gh.style.left=x+'%';gh.style.top=y+'%';}
  };
  /* the sticker trails the finger on a stiff spring and banks into its
     own velocity — that lag and lean is what reads as held in the hand.
     The bank responds heavy on purpose (slow to take the lean, slow to
     give it back). On top of the lean it sways on a very slow sine,
     ±20°: the phase at the moment of release is the angle the sticker
     keeps for good */
  const tick=now=>{
    if(!drag)return;
    const dt=Math.min(.04,(now-drag.t)/1000)||.016;drag.t=now;
    const ox=drag.px,oy=drag.py,f=Math.min(1,dt*21);
    drag.px+=(drag.tx-drag.px)*f;drag.py+=(drag.ty-drag.py)*f;
    const vx=(drag.px-ox)/dt,vy=(drag.py-oy)/dt;
    const tilt=Math.max(-19,Math.min(19,vx*.045+vy*.012));
    drag.rot+=(tilt-drag.rot)*Math.min(1,dt*8.5);
    drag.ang=drag.rot+Math.sin(now*.00125)*20;
    const sc=drag.over?1.04:1.17+Math.min(.1,Math.hypot(vx,vy)*.0004);
    drag.sc+=(sc-drag.sc)*Math.min(1,dt*9);
    drag.g.style.transform=`translate(${drag.px.toFixed(1)}px,${drag.py.toFixed(1)}px) translate(-50%,-50%) rotate(${drag.ang.toFixed(2)}deg) scale(${drag.sc.toFixed(3)})`;
    /* the guide wears the same live angle: what shows is what lands */
    if(drag.over&&drag.card){
      const gh=drag.card.querySelector('.gstk');
      if(gh)gh.style.transform=`translate(-50%,-50%) rotate(${drag.ang.toFixed(2)}deg)`;}
    raf=requestAnimationFrame(tick);
  };
  const end=(e,commit)=>{
    if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(raf);
    unhot(d.card);
    const card=commit?cardAt(d.tx,d.ty):null;
    if(card){d.g.remove();
      const r=card.getBoundingClientRect();
      placeStk(+card.dataset.id,(d.tx-r.left)/r.width*100,(d.ty-r.top)/r.height*100,d.ang||0);}
    else{ /* released over nothing: the sticker settles back onto the
             paper — a landed slap never restores it, the stage just closes */
      ped.classList.remove('lift','peeloff');
      d.g.style.transition='opacity .16s';d.g.style.opacity=0;
      setTimeout(()=>d.g.remove(),180);
      if(commit){SFX.deny();buzz(10);}}
  };
  ped.addEventListener('pointerdown',e=>{
    if(!S.pick)return;
    e.preventDefault();
    if(!S.seen.pickDrag){S.seen.pickDrag=1;save(true);}
    stopPNudge();
    ped.setPointerCapture(e.pointerId);
    const g=document.createElement('div');g.className='pdrag';
    g.innerHTML=`<svg class="${S.pick.shy?'shy':''}" viewBox="0 0 24 24">${stickerSVG(S.pick.k)}</svg>`;
    document.body.appendChild(g);
    const r=ped.getBoundingClientRect();
    /* touch (and pen) lift: the finger can't cover what it carries —
       from the first move the ghost rides a fixed offset above the
       pointer, and the guide and the drop read the ghost's point, so
       what you see is what lands. The lift waits for that first move:
       at grab the ghost is still on the pad, and 76px would point it
       straight into the bottom card */
    const lift=e.pointerType&&e.pointerType!=='mouse'?76:0;
    /* it lifts off the pad and springs up to the finger */
    drag={g,tx:e.clientX,ty:e.clientY,lift,px:r.left+r.width/2,py:r.top+r.height*.4,
      rot:0,ang:0,sc:.45,over:false,card:null,t:performance.now()};
    g.style.transform=`translate(${drag.px.toFixed(1)}px,${drag.py.toFixed(1)}px) translate(-50%,-50%) scale(.45)`;
    /* the pickup: the vinyl PEELS off its backing paper right here —
       crackle under the fingers while the pad sticker swings up into
       the hand and the ghost springs away with it */
    ped.classList.add('lift','peeloff');SFX.peel();buzz(10);
    raf=requestAnimationFrame(tick);
    hit(drag.tx,drag.ty);});
  ped.addEventListener('pointermove',e=>{if(drag){drag.tx=e.clientX;drag.ty=e.clientY-drag.lift;hit(drag.tx,drag.ty);}});
  ped.addEventListener('pointerup',e=>end(e,true));
  ped.addEventListener('pointercancel',e=>end(e,false));
}
function renderShop(){
  if(S.pick){renderPick();return;}
  const p=pool(),tO=tierOf(),placedN=S.cards.filter(c=>c.stk).length;
  const diff=new Set(S.cards.filter(c=>c.stk).map(c=>c.stk)).size;
  let h=`<h2>STICKER SHOP</h2>`;
  /* the unlock gift rides above everything: free, first row, until
     taken. The claim itself opens the pick stage (claimGift) */
  if(S.gift&&STK[S.gift.k]){const a=STK[S.gift.k];
    h+=`<div class="row gift">${stkIcon(S.gift.k,0)}<div class="b"><div class="nm">${a.n} <span class="tag">GIFT</span><span class="tag t${a.t}">TIER ${a.t}</span></div>
      <div class="ds">${a.d}</div></div>
      <button class="buy g" data-i="gift">FREE</button></div>`;}
  if(!p.length)h+=`<p class="note">Nothing yet. Goals unlock the stock (GOALS tab).</p>`;
  else{
    const left=Math.max(0,S.shop.next-Date.now());
    h+=`<p class="note">Buy stickers here to put on your cards and make them better! After you buy a sticker, select one of 3 cards to apply it to.<br>Stock rotates · restock in <b class="tmr">${Math.floor(left/60000)}m ${Math.floor(left%60000/1000)}s</b>.</p>`;
    S.shop.offers.forEach((o,i)=>{
      if(o.k!=='debolt'&&!STK[o.k])return;   /* stale key from an older roster */
      if(o.k==='debolt'){         /* the lucky roll: one strip, this stock only */
        h+=`<div class="row${o.sold?' sold':''}"><div class="b"><div class="nm">De-bolt <span class="tag">10% ROLL</span></div>
          <div class="ds">Strip any sticker; the card goes blank. Half its price, min 1K. No refunds.</div></div>
          <button class="buy rd" data-i="${i}" ${o.sold?'disabled':''}>${o.sold?'SOLD':'OPEN'}</button></div>`;
        return;}
      const a=STK[o.k];
      const ownN=S.cards.filter(c=>c.stk===o.k&&!c.osk).length;
      const owned=NONSTACK[o.k]&&ownN>0;
      const tag=owned?' <span class="tag">OWNED · unique</span>':ownN?` <span class="tag">OWNED ×${ownN} · +10% each</span>`:'';
      h+=`<div class="row${o.sold?' sold':''}">${stkIcon(o.k,o.shy)}<div class="b"><div class="nm">${a.n} ${o.shy?'<span class="tag shy">SHINY</span>':''}<span class="tag t${a.t}">TIER ${a.t}</span>${tag}</div>
        <div class="ds">${a.d}${o.shy?' Holo vinyl, double price.':''}</div></div>
        <button class="buy g" data-i="${i}" ${o.sold||owned||S.score<o.price?'disabled':''}>${o.sold?'SOLD':owned?'OWNED':fmt(o.price)}</button></div>`;});
    const rc=rrCost();
    h+=`<div class="row"><div class="b"><div class="nm">Restock now</div>
      <div class="ds">Skip the wait. The price cools 1%/min; each buy reheats it ×1.2.</div></div>
      <button class="buy" id="rr" ${S.score<rc?'disabled':''}>${fmt(rc)}</button></div>`;}
  /* the meta block sits just under the stock: tier depth, the compendium,
     the de-bolt gate. A met gate leaves for the GOALS tab, so the block
     only renders while something here is still open */
  let prog='';
  if(tO<5){
    const base=tO===1?0:ECO.TIER_AT[tO-2],next=ECO.TIER_AT[tO-1];
    const pct=Math.min(100,Math.max(0,(placedN-base)/(next-base)*100));
    prog+=`<div class="row pf" data-pk="tier" style="--p:${pct.toFixed(1)}%"><div class="b">
      <div class="nm">${ic('stack')} TIER ${tO+1} STOCK</div>
      <div class="ds">Place ${next} stickers to open Tier ${tO+1}.</div></div>
      <div class="gst"><div class="v">${placedN}<i>/</i>${next}</div><div class="l">TO T${tO+1}</div></div></div>`;
  }
  if(diff<CMP_AT)prog+=`<div class="row pf pg" data-pk="cmpgate" style="--p:${(diff/CMP_AT*100).toFixed(1)}%"><div class="b">
    <div class="nm">${ic('lock')} STICKER COMPENDIUM</div>
    <div class="ds">Opens at ${CMP_AT} different stickers placed.</div></div>
    <div class="gst"><div class="v">${diff}<i>/</i>${CMP_AT}</div></div></div>`;
  /* the offer itself renders in the stock above while it is rolled in;
     this row holds the gate the rest of the time */
  if(!deboltUn()&&!S.shop.offers.some(o=>o.k==='debolt')){
    const spent=stkSpent();
    prog+=`<div class="row pf pg" data-pk="dbolt" style="--p:${(spent/ECO.DEBOLT_AT*100).toFixed(1)}%"><div class="b">
      <div class="nm">${ic('lock')} DE-BOLT</div>
      <div class="ds">Unlocks at ${fmtG(ECO.DEBOLT_AT)} spent on stickers.</div></div>
      <div class="gst"><div class="v">${fmtG(spent)}<i>/</i>${fmtG(ECO.DEBOLT_AT)}</div><div class="l">SPENT</div></div></div>`;
  }
  if(prog)h+=`<h2>PROGRESS</h2>`+prog;
  const lk=STKKEYS.filter(k=>!STK_OFF[k]&&(!stkUn(k)||STK[k].t>tO)).sort((a,b)=>STK[a].t-STK[b].t);
  if(lk.length)h+=`<h2>LOCKED · ${lk.length}</h2>`+lk.map(k=>{
    if(stkUn(k)){const s=STK[k];          /* goal done — the tier gate holds it back */
      return `<div class="row"><div class="b"><div class="nm">${stkIcon(k)} ${s.n} <span class="tag t${s.t}">T${s.t}</span></div>
        <div class="gst"><div class="v">T${s.t}</div><div class="l">TIER</div></div></div></div>`;}
    const a=ACH.find(x=>x.stk===k);if(!a)return '';
    let c=0;try{c=a.g();}catch(e){}
    c=Math.min(c,a.t);
    const pct=Math.min(100,c/a.t*100);
    return `<div class="row pf pg" data-pk="lk${k}" style="--p:${pct.toFixed(1)}%"><div class="b"><div class="nm">${stkIcon(k)} ${STK[k].n} <span class="tag t${STK[k].t}">T${STK[k].t}</span></div>
      <div class="ds">${a.n} · ${a.d}</div></div>
      <div class="gst"><div class="v">${fmtG(c)}<i>/</i>${fmtG(a.t)}</div><div class="l">GOAL</div></div></div>`;}).join('');
  h+=`<div class="chips"><span class="chip">stock tier <b>T${tO}</b></span>
    <span class="chip">blank cards <b>${S.cards.filter(c=>!c.stk).length}</b></span>
    <span class="chip">stickers placed <b>${placedN}</b></span>
    <span class="chip">different <b>${diff}</b></span></div>`;
  $('#v-shop').innerHTML=h;fillUp('#v-shop','shop');
  $$('#v-shop .buy[data-i]').forEach(b=>b.onclick=()=>
    b.dataset.i==='gift'?claimGift():buyStk(+b.dataset.i));
  const r=$('#rr');if(r)r.onclick=reroll;
}
function renderAch(){
  /* benched stickers' gates are hidden with their stickers; the counts
     read the live roster only */
  const LIVE=ACH.filter(a=>!(a.stk&&STK_OFF[a.stk]));
  let h=`<h2>GOALS · ${LIVE.filter(a=>has(a.id)).length}/${LIVE.length}</h2><p class="note">Goals unlock new upgrades and stickers once you complete them.</p>`;
  const prog=a=>{let c=0;try{c=a.g();}catch(e){}return Math.min(c,a.t);};
  const rank=a=>has(a.id)?2:prog(a)>=a.t?0:1;   /* claimable first */
  const list=[...LIVE].sort((a,b)=>rank(a)-rank(b));
  list.forEach(a=>{
    const ok=has(a.id),c=prog(a);
    const rw=a.stk?`${ic('spark')} ${stkN(a.stk)}${STK[a.stk]?' · T'+STK[a.stk].t+' sticker':' · sticker'}`
      :a.up?`${ic('zap')} ${UPG[a.up]?UPG[a.up].n:a.up}${a.lv>1?' '+a.lv+' · upgrade level':' · upgrade row'}`
      :a.meta?`${ic('gem')} ${META[a.meta]?META[a.meta].n:a.meta}${a.lv>1?' '+a.lv+' · shard upgrade level':' · shard upgrade'}`
      :a.s?`+${Math.round(a.s*100)}% shards`:`+${Math.round(a.v*100)}% value`;
    if(!ok&&c>=a.t){          /* met — the bonus waits on the claim */
      h+=`<div class="row pf pg" data-pk="${a.id}" style="--p:100%"><div class="b"><div class="nm">${ic('star')} ${a.n} <span class="tag">${rw}</span></div>
        <div class="ds">${a.d}</div></div>
        <button class="buy" data-cl="${a.id}">CLAIM</button></div>`;return;}
    const st=ok?`<div class="gst done"><div class="v">${ic('check')}</div></div>`
      :`<div class="gst"><div class="v">${fmtG(c)}<i>/</i>${fmtG(a.t)}</div></div>`;
    h+=`<div class="row${ok?' done':' pf pg'}"${ok?'':` data-pk="${a.id}" style="--p:${(c/a.t*100).toFixed(1)}%"`}><div class="b"><div class="nm">${ok?ic('star'):ic('star-o')} ${a.n} <span class="tag">${rw}</span></div>
      <div class="ds">${a.d}</div></div>${st}</div>`;});
  /* gates that met leave the shop's PROGRESS block for here, so their
     done state keeps a home: full stock, the compendium (its OPEN button
     rides along, it is the book's only entry) */
  if(tierOf()>=5)h+=`<div class="row"><div class="b"><div class="nm">${ic('stack')} Full stock</div>
    <div class="ds">The Fixer sells everything, tier 5 deep.</div></div>
    <div class="gst done"><div class="v">${ic('check')}</div></div></div>`;
  if(cmpDiff()>=CMP_AT)h+=`<div class="row"><div class="b"><div class="nm">${ic('book')} Sticker compendium</div>
    <div class="ds">The full sticker reference, open.</div></div>
    <button class="buy" id="cmpGo">OPEN</button></div>`;
  /* de-bolt is not a goal, but its gate lives here: the shop stocks the
     strip on 10% rolls once enough has gone to stickers */
  const spent=stkSpent();
  h+=deboltUn()
    ?`<div class="row"><div class="b"><div class="nm">De-bolt</div>
      <div class="ds">Restocks roll a strip offer in, 10% chance.</div></div>
      <div class="gst done"><div class="v">${ic('check')}</div></div></div>`
    :`<div class="row pf pg" data-pk="dbolt" style="--p:${(spent/ECO.DEBOLT_AT*100).toFixed(1)}%"><div class="b">
      <div class="nm">${ic('lock')} De-bolt</div>
      <div class="ds">Strip a sticker off its card. Unlocks at ${fmtG(ECO.DEBOLT_AT)} sticker spend.</div></div>
      <div class="gst"><div class="v">${fmtG(spent)}<i>/</i>${fmtG(ECO.DEBOLT_AT)}</div><div class="l">SPENT</div></div></div>`;
  /* shiny stock: same shape, gate is nerve — 5 busts in a row under the
     cold line. The trailing cold count is the fill */
  const log=S.st.bustLog||[];let cold=0;
  for(let i=log.length-1;i>=0&&log[i]<ECO.SHINY_COLD;i--)cold++;
  h+=shinyUn()
    ?`<div class="row"><div class="b"><div class="nm">Shiny stock</div>
      <div class="ds">Unlocked. 10% of rolls come out shiny: holo vinyl, double price. Each shiny on a table pays ×${ECO.SHINY_X.toFixed(2)} per shiny there.</div></div>
      <div class="gst done"><div class="v">${ic('check')}</div></div></div>`
    :`<div class="row pf pg" data-pk="shiny" style="--p:${(cold/5*100).toFixed(1)}%"><div class="b">
      <div class="nm">${ic('lock')} Shiny stock</div>
      <div class="ds">Bust 5 times in a row under ${Math.round(ECO.SHINY_COLD*100)}% risk. The press then runs a holo pass: 10% of rolls come out shiny, double price.</div></div>
      <div class="gst"><div class="v">${cold}<i>/</i>5</div><div class="l">COLD</div></div></div>`;
  $('#v-ach').innerHTML=h;fillUp('#v-ach','ach');
  $$('#v-ach .buy[data-cl]').forEach(b=>b.onclick=()=>claimAch(b.dataset.cl));
  const cg=$('#v-ach #cmpGo');if(cg)cg.onclick=openComp;
}
function renderPres(){
  const g=shardGain(),req=ascReq(),pc=Math.min(100,S.banked/req*100);
  let h=`<h2>ASCEND</h2><p class="note">Burn it down. You lose cards, upgrades and score. You keep shards, everything they bought, every goal, and Keeper cards.</p>
  <div class="row pf pd" data-pk="asc" style="--p:${pc.toFixed(1)}%"><div class="b"><div class="nm">Shards waiting</div>
    <div class="ds">Banked this cycle: ${fmt(S.banked)} / ${fmt(req)}</div></div>
    <button class="buy g" id="asc" ${g<1?'disabled':''}>+${g} ${ic('gem')}</button></div>
  <div class="chips"><span class="chip">ascensions <b>${S.asc}</b></span>
    <span class="chip">shards earned <b>${S.shAll}</b></span>
    <span class="chip">shard bonus <b>+${S.shAll*3}%</b></span>
    <span class="chip">goal bonus <b>×${achV().toFixed(2)}</b></span></div><h2>SHARD UPGRADES</h2><p class="note">Bought with shards. Rows open via their goals in the GOALS tab.</p>`;
  let hid=0;
  Object.keys(META).forEach(id=>{
    const m=META[id];
    if(!metaOpen(id)&&!M(id)){hid++;return;}
    const l=M(id),max=l>=m.max,cost=Math.ceil(m.c(l));
    const gate=metaGate(id);   /* the next level waits on a goal */
    const ds=(typeof m.d==='function'?m.d(l):m.d)
      +(gate?`<br>Level ${l+1} · ${gate.n}: ${gate.d}`:'');
    h+=`<div class="row pf pd" data-pk="m${id}" style="--p:${(l/m.max*100).toFixed(1)}%"><div class="b"><div class="nm">${m.n} <span class="tag">${l}/${m.max}</span></div>
      <div class="ds">${ds}</div></div>
      <button class="buy g" data-m="${id}" ${max||gate||S.shards<cost?'disabled':''}>${gate?ic('lock')+' GOAL':max?'MAX':ic('gem')+cost}</button></div>`;});
  if(hid)h+=`<p class="note" style="text-align:center;color:var(--ink2)">${hid} more unlock via GOALS.</p>`;
  $('#v-pres').innerHTML=h;fillUp('#v-pres','pres');
  const a=$('#asc');if(a)a.onclick=confirmAsc;
  $$('#v-pres .buy[data-m]').forEach(b=>b.onclick=()=>buyMeta(b.dataset.m));
}
/* affordability moves with the score; buttons light up while you watch.
   In-place disabled flips only — a full re-render would reset card flips */
function refreshBuy(){
  $$('#v-cards .buy[data-v]').forEach(b=>{const v=+b.dataset.v;
    b.disabled=S.score<cardCost(v)||tierDone(v)||v>unlockedV();});
  $$('#v-up .buy[data-u]').forEach(b=>{const u=UPG[b.dataset.u],l=L(b.dataset.u);
    b.disabled=l>=uMax(b.dataset.u)||!!upGate(b.dataset.u)||S.score<Math.ceil(u.base*Math.pow(u.g,l));});
  $$('#v-pres .buy[data-m]').forEach(b=>{const m=META[b.dataset.m],l=M(b.dataset.m);
    b.disabled=l>=m.max||!!metaGate(b.dataset.m)||S.shards<Math.ceil(m.c(l));});
  const r=$('#rr');if(r)r.disabled=S.score<rrCost();
  const a=$('#asc');if(a)a.disabled=shardGain()<1;
}
const renderAll=()=>{renderCards();renderUp();renderShop();renderAch();renderPres();};
