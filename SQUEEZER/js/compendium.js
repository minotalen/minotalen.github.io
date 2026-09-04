/* ==================================================================
   compendium.js — the sticker compendium, living behind the ? in the
   HUD. One reference for every sticker you've unlocked: what it does,
   what it costs, what unlocked it. Rendered live from STK/ACH/ECO, so
   it can never drift from the shop. Type labels and trigger captions
   ride STKTYPE/STKTRIG (config.js) — the same maps the docs build
   (make-constants.js) compiles into stickers.html.
   ================================================================== */
/* boot errors surface as data-cmperr on <html> — readable without console */
addEventListener('error',e=>{document.documentElement.dataset.cmperr=(e.message||'x').slice(0,90);});
const CMP_TY={value:'Value',table:'Table mult',payer:'Score payer',
  insurance:'Insurance',aura:'Aura',trick:'Armed trick',
  out:'OUT engine','out-pay':'OUT payoff',discard:'Discard engine',
  'disc-pay':'Discard payoff'};
const cmpGoal=k=>ACH.find(x=>x.stk===k)||null;
/* the collection: only stickers whose goal is claimed. Rebuilt per paint —
   goals get claimed between opens, and the header/chips must not lie */
const cmpUn=()=>STKKEYS.filter(stkUn);
const cmpDiff=()=>new Set(S.cards.filter(c=>c.stk).map(c=>c.stk)).size;
/* filters: two groups, each multi-selecting (any picked value passes,
   an empty set passes everything), the groups AND together, the search
   ANDs on top — the same rules the docs page (stickers.html) runs */
let cmpQ='',cmpTs=new Set(),cmpTys=new Set();
const cmpPassT=k=>!cmpTs.size||cmpTs.has(STK[k].t);
const cmpPassY=k=>!cmpTys.size||cmpTys.has(STKTYPE[k]||'value');
const cmpPassQ=k=>!cmpQ||(STK[k].n+' '+STK[k].d+' '+CMP_TY[STKTYPE[k]||'value']+' '+(STKTRIG[k]||'')+
  ((cmpGoal(k)||{}).n||'')).toLowerCase().includes(cmpQ);

function compRows(){
  const ks=STKKEYS.filter(k=>stkUn(k)&&cmpPassT(k)&&cmpPassY(k)&&cmpPassQ(k));
  ks.sort((a,b)=>STK[a].t-STK[b].t||stkPrice(a)-stkPrice(b)||STK[a].n.localeCompare(STK[b].n));
  if(!ks.length)return '<p class="note" style="text-align:center;padding:18px 0">nothing matches</p>';
  return ks.map(k=>{
    const s=STK[k],ty=STKTYPE[k]||'value',g=cmpGoal(k);
    return `<div class="row crow">${stkIcon(k)}
      <div class="b">
        <div class="nm">${s.n} <span class="tag t${s.t}">T${s.t}</span>${NONSTACK[k]?' <span class="cns">UNIQUE</span>':''}<span class="cpr">${fmt(stkPrice(k))}</span></div>
        <div class="ds">${s.d}</div>
        <div class="cmeta">${CMP_TY[ty]} · ${STKTRIG[k]||'on the table'}${TRICK[k]?' · one arm per run':''}${NONSTACK[k]?' · only one, ever':''}</div>
        ${g?`<div class="cgoal"><b>${g.n}</b> ${g.d}</div>`:''}
      </div>
    </div>`;}).join('');
}
/* items: [value, html label, on]; tap toggles membership, compPaint repaints */
function compChips(host,items,tap){
  host.innerHTML=items.map(([v,l,on])=>
    `<button class="cchip${on?' on':''}" data-v="${v}">${l}</button>`).join('');
  [...host.children].forEach(c=>c.onclick=()=>{tap(c.dataset.v);compPaint();});
}
function compPaint(){
  const uk=cmpUn();
  /* the denominator reads the live roster: benched stock never counts
     against the collection */
  $('#cmpS').textContent=`${uk.length} OF ${STKKEYS.filter(k=>!STK_OFF[k]).length} UNLOCKED · ONE PER CARD, FROM THE FIXER`;
  /* faceted counts: a chip only counts stickers that clear the search
     and the OTHER group, so its number is what a tap yields. The small
     .cn span keeps the count from widening the chip. ALL chips carry
     no count: the header line states that total */
  const nT=t=>uk.filter(k=>STK[k].t===t&&cmpPassY(k)&&cmpPassQ(k)).length;
  const nY=ty=>uk.filter(k=>(STKTYPE[k]||'value')===ty&&cmpPassT(k)&&cmpPassQ(k)).length;
  const cnt=n=>` <span class="cn">· ${n}</span>`;
  compChips($('#cmpTiers'),
    [[0,'ALL',!cmpTs.size],
     ...[1,2,3,4,5].map(t=>[t,'T'+t+cnt(nT(t)),cmpTs.has(t)])],
    v=>{const t=+v;cmpTs.has(t)?cmpTs.delete(t):cmpTs.add(t);});
  const tys=[];STKKEYS.forEach(k=>{const ty=STKTYPE[k]||'value';
    if(stkUn(k)&&!tys.includes(ty))tys.push(ty);});
  compChips($('#cmpTypes'),
    [['all','ALL',!cmpTys.size],
     ...tys.map(ty=>[ty,CMP_TY[ty].toUpperCase()+cnt(nY(ty)),cmpTys.has(ty)])],
    v=>{cmpTys.has(v)?cmpTys.delete(v):cmpTys.add(v);});
  $('#cmpRows').innerHTML=compRows();
}
let cmpBuilt=false;
function buildComp(){
  $('#cmp').innerHTML=`
  <div id="cmpH">
    <div class="b"><div id="cmpT">STICKER COMPENDIUM</div>
      <div id="cmpS"></div></div>
    <button class="ic" id="cmpX" title="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>
  <div id="cmpB">
    <p class="note">One card, one sticker, permanent: it rides the deck and fires on its
    own trigger. Only De-bolt strips it; only Keeper carries it through ascension.
    De-bolt rides a ${Math.round(ECO.DEBOLT_CHANCE*100)}% stock roll once ${fmtG(ECO.DEBOLT_AT)}
    has gone to stickers. Armed tricks fire from one tap-charge per run. Insurance decides
    whether you survive a risky card; it never bends the pay.</p>
    <input id="cmpQ" type="search" placeholder="search name, effect, goal…" autocomplete="off">
    <div class="cchips" id="cmpTiers"></div>
    <div class="cchips" id="cmpTypes"></div>
    <div id="cmpRows"></div>
    <div id="cmpL">
      <div id="cmpLT">LIL COMPENDIUM</div>
      ${LINGO.map(l=>`<div class="row"><div class="b"><div class="nm">${l[0]}</div><div class="ds">${l[1]}</div></div></div>`).join('')}
    </div>
  </div>`;
  $('#cmpX').onclick=closeComp;
  $('#cmpQ').oninput=e=>{cmpQ=e.target.value.toLowerCase();compPaint();};
  cmpBuilt=true;
}
function openComp(){
  if(cmpDiff()<CMP_AT){toast('Compendium locked\nOpens at '+CMP_AT+' different stickers','lock');return;}
  if(!cmpBuilt)buildComp();compPaint();
  $('#cmp').classList.add('on');$('#cmpB').scrollTop=0;}
function closeComp(){$('#cmp').classList.remove('on');}
const cmpEl=$('#cmp'),bHelp=$('#bHelp');
if(cmpEl)cmpEl.addEventListener('click',e=>{if(e.target.id==='cmp')closeComp();});
if(bHelp){
  bHelp.onclick=openComp;
  /* pointer fallback: some webviews drop synthesized clicks; a tap is a
     clean press-and-release, the same 8px slop rule the felt uses */
  let bp=null;
  bHelp.addEventListener('pointerdown',e=>{bp=[e.clientX,e.clientY];});
  bHelp.addEventListener('pointerup',e=>{
    if(bp&&Math.hypot(e.clientX-bp[0],e.clientY-bp[1])<8)openComp();
    bp=null;});
}
