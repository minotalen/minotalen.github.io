/* ==================================================================
   modals.js — every dialog: Peek & Scout (risk-management looks),
   ascension, settings, welcome. The onboarding lives in tut.js —
   a coach bubble on the table, not a modal.
   The deck view lives in the DECK tab: inspectDeck() is its one entry
   point. The sticker pick is not a dialog any more — it owns the shop
   tab (renderPick, panels.js).
   ================================================================== */
/* separators used across sheet/chip copy */
const D=' · ', MID=' · ', X='×';
const openMo=h=>{$('#sh').classList.remove('set');$('#sh').innerHTML=h;paintMo();$('#mo').classList.add('on');stkTipHide();};
/* every pocket preview riding a real card (mini's data-cid) gets the
   seeded wear painted in: the same painter the felt uses, so a rip is
   the same rip everywhere */
function paintMo(){$$('#sh .mc[data-cid]').forEach(mc=>{
  const c=byId(+mc.dataset.cid);if(!c)return;
  let lay=mc.querySelector('.cnd');
  if(!lay){lay=document.createElement('i');lay.className='cnd';mc.appendChild(lay);}
  paintCondInto(lay,c,mc);});};
const closeMo=()=>$('#mo').classList.remove('on');
$('#mo').onclick=e=>{if(e.target.id==='mo')closeMo();};

/* hold the deck or press D: the DECK tab is the inspection */
function inspectDeck(){S.st.inspects++;Tabs.go('cards');save();}

/* card sheet: tap any card in the DECK tab */
function confirmAsc(){
  const g=shardGain(),k=M('keeper');
  openMo(`<h3>ASCEND FOR ${g} SHARD${g===1?'':'S'}?</h3>
  <p class="note">Gone: cards, upgrades, score.<br>Kept: shards, shard upgrades, goals${k?`, best ${k} stickered`:''}.<br>
  You restart owning every set up to ${Math.min(MAXV,3+M('head'))}${M('rich')?` plus ${fmt(Math.floor(400*Math.pow(2.15,M('rich'))-400))} score`:''}.</p>
  <button class="close gld" id="yes">ASCEND</button>
  <button class="close" onclick="closeMo()">NOT YET</button>`);
  $('#yes').onclick=ascend;
}
/* ---------------- automation: the bar's sheet ----------------
   Tapping an AUTO chip on the table opens this: the switches, the two
   dials (where the deal stops, where the bank fires) and the ledger.
   Live: a 1s beat repaints the record, the last-10 strip and the
   score/min read while the sheet is up, since the autos keep playing
   behind it */
let aInt=0;
function openAutoPanel(){
  if(aInt){clearInterval(aInt);aInt=0;}
  const dr=L('auto'),bk=L('abank'),gd=L('guard');
  const ceil=gd?Math.round(ECO.GUARD_AT[gd-1]*100):null;
  const stopV=Math.min(S.set.stop==null?95:S.set.stop,ceil||95);
  const drawDs=`Deals up to ${dr} card${dr===1?'':'s'} a table, then waits. Stops at the ${ceil?'STOP':'BANK'} line, or a bust it can see.`;
  const bankDs='Banks full tables at the BANK line and busts it can see. A stopped table waits for you.';
  const cls=v=>v>=70?'x':v>=45?'h':v>=20?'m':'';
  openMo(`<h3>AUTOMATION</h3>
  <div class="row"><div class="b"><div class="nm">Auto-draw</div><div class="ds">${drawDs}</div></div>
    <button class="asw${S.set.autoDraw?' on':''}" id="aswD" role="switch" aria-checked="${!!S.set.autoDraw}"><i></i></button></div>
  ${ceil?`<div class="arsl ${cls(stopV)}" id="arslS" tabindex="0" role="slider" aria-label="Draw stop"
    aria-valuemin="10" aria-valuemax="100" aria-valuenow="${stopV}" title="Unlocked to ${ceil}% by Draw Stop">
    <div class="af" id="arslSF"></div>
    <div class="ax" id="arslSX" aria-hidden="true"></div>
    <span class="al">STOP</span><b id="arslSV">${stopV}%</b>
    <div class="ac" id="arslSC"><span class="al">STOP</span><b id="arslSVC">${stopV}%</b></div></div>`:''}
  ${bk?`<div class="row"><div class="b"><div class="nm">Auto-bank</div><div class="ds">${bankDs}</div></div>
    <button class="asw${S.set.autoBank?' on':''}" id="aswB" role="switch" aria-checked="${!!S.set.autoBank}"><i></i></button></div>
  <div class="arsl ${cls(S.set.risk)}" id="arsl" tabindex="0" role="slider" aria-label="Risk tolerance"
    aria-valuemin="10" aria-valuemax="100" aria-valuenow="${S.set.risk}">
    <div class="af" id="arslF"></div>
    <div class="ax" id="arslX" aria-hidden="true"></div>
    <span class="al">BANK</span><b id="arslV">${S.set.risk}%</b>
    <div class="ac" id="arslC"><span class="al">BANK</span><b id="arslVC">${S.set.risk}%</b></div></div>`:''}
  <div class="ash"><span>RECORD</span></div>
  <div class="asg">
    <div class="gst"><div class="v" id="asD"></div><div class="l">DEALT</div></div>
    <div class="gst"><div class="v" id="asB"></div><div class="l">BANKS</div></div>
    <div class="gst"><div class="v" id="asG"></div><div class="l">EARNED</div></div></div>
  <div class="asg">
    <div class="gst"><div class="v" id="asBe"></div><div class="l">BEST BANK</div></div>
    <div class="gst"><div class="v" id="asBu"></div><div class="l">BUSTS</div></div>
    <div class="gst"><div class="v" id="asT"></div><div class="l">DRIVEN</div></div></div>
  <div class="chips" id="asCh"></div>
  <div class="apm"><div class="v" id="asPm">—</div><div class="l">SCORE / MIN</div></div>
  <div class="a10" id="asTen">${'<span class="c"><i><b></b><s></s></i><em></em></span>'.repeat(10)}</div>
  <p class="note">Last 10 hands, oldest left. Blue dot: the autos played it.</p>
  <button class="close" onclick="closeMo()">CLOSE</button>`);
  /* one tolerance track, reused by both dials: the RISK gauge exactly —
     label left, value right, the cream twin flips as the fill covers
     them. The track is always the full 10..100 scale; maxPct is the
     player's unlocked ceiling and the tail past it greys out. Drag the
     track, tap it, or step with the arrow keys, 5% at a step */
  const mkArsl=(sl,maxPct,onPaint)=>{
    const F=$('#'+sl.id+'F'),X=$('#'+sl.id+'X'),V=$('#'+sl.id+'V'),C=$('#'+sl.id+'C'),
      VC=$('#'+sl.id+'VC');
    X.style.left=maxPct+'%';
    const key=sl.id==='arsl'?'risk':'stop';
    const paint=()=>{const v=Math.min(S.set[key],maxPct),t=(v-10)/90*100;
      F.style.width=t+'%';
      V.textContent=v+'%';VC.textContent=v+'%';
      C.style.clipPath=`inset(0 ${100-t}% 0 0)`;
      sl.setAttribute('aria-valuenow',v);
      sl.className='arsl '+(v>=70?'x':v>=45?'h':v>=20?'m':'');
      if(onPaint)onPaint();};
    const setV=v=>{v=Math.max(10,Math.min(maxPct,Math.round(v/5)*5));
      if(v!==S.set[key]){S.set[key]=v;buzz(6);save();}
      paint();};
    const fromE=e=>{const r=sl.getBoundingClientRect();
      setV(10+(e.clientX-r.left)/r.width*90);};
    sl.onpointerdown=e=>{sl.setPointerCapture(e.pointerId);fromE(e);
      sl.onpointermove=ev=>{if(ev.buttons&1||ev.pointerType==='touch')fromE(ev);};};
    sl.onpointerup=sl.onpointercancel=()=>{sl.onpointermove=null;save(true);};
    sl.onkeydown=e=>{
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();
        setV(S.set[key]+(e.key==='ArrowLeft'?-5:5));}};
    paint();};
  if($('#arslS'))mkArsl($('#arslS'),ceil,()=>paintAutos());
  if($('#arsl'))mkArsl($('#arsl'),100,()=>{
    const mk=$('#rkmark');
    if(L('abank')&&S.set.autoBank){mk.style.display='block';mk.style.left=S.set.risk+'%';}
    paintAutos();});
  $('#aswD').onclick=()=>{S.set.autoDraw=!S.set.autoDraw;buzz(10);save(true);
    paintAutos();openAutoPanel();};
  if(bk)$('#aswB').onclick=()=>{S.set.autoBank=!S.set.autoBank;buzz(10);save(true);
    paintAutos();openAutoPanel();};
  const dur=s=>s>=3600?`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`
    :s>=60?`${Math.floor(s/60)}m ${Math.floor(s%60)}s`:`${s||0}s`;
  const paintLedger=()=>{
    const st=S.st;
    $('#asD').textContent=fmt(st.aDraws||0);
    $('#asB').textContent=fmt(st.aBanks||0);
    $('#asG').textContent='+'+fmt(st.aGain||0);
    $('#asBe').textContent=fmt(st.aBest||0);
    $('#asBu').textContent=fmt(st.aBusts||0);
    $('#asT').textContent=dur(st.aTime||0);
    const sh=st.banks?Math.round((st.aBanks||0)/st.banks*100):0;
    $('#asCh').innerHTML=`<span class="chip">share of all banks <b>${sh}%</b></span>`;};
  /* the last-10 strip: the cells are built once, each beat only moves
     their fills and the number row under them — a rebuild every second
     would restart the ease */
  const paintRecent=()=>{
    const cols=$('#asTen').children,last=(S.st.handLog||[]).slice(-10);
    const off=10-last.length,max=Math.max(...last.map(e=>e.v??e.s),1);
    for(let i=0;i<10;i++){
      const col=cols[i],el=col.querySelector('i'),em=col.querySelector('em'),e=last[i-off];
      if(!e){el.className='';el.removeAttribute('title');em.textContent='';
        el.querySelector('b').style.height='0%';continue;}
      const val=e.v??e.s;   /* v: the worth at settle — a bust shows the total it killed, not its salvage pay */
      el.className=(e.b?'p':'f')+(e.a?' a':'');
      el.title=(e.b?'BANK ':'BUST ')+fmt(Math.max(0,val))+D+e.r+'%';
      el.querySelector('b').style.height=Math.max(8,Math.round(val/max*100))+'%';   /* a bust that paid nothing keeps a short red bar */
      em.textContent=fmt(Math.max(0,val));}
    /* score/minute across those hands; a too-short span defers to the
       measured per-second rate */
    let pm=0;
    if(last.length>=2){const span=(last[last.length-1].t-last[0].t)/1000;
      if(span>=15)pm=last.reduce((a,e)=>a+e.s,0)/span*60;}
    if(pm<1)pm=(S.rate||0)*60;
    $('#asPm').textContent=pm>0?fmt(pm)+'/m':'—';};
  paintLedger();paintRecent();
  aInt=setInterval(()=>{
    if(!$('#mo').classList.contains('on')){clearInterval(aInt);aInt=0;return;}
    paintLedger();paintRecent();},1000);
}
function openSet(){
  /* desktop wears the .set sheet: two columns (game+controls left,
     cloud+danger right), compact rows so it fits one viewport with no
     scroll. Phones stack the columns in DOM order */
  openMo(`<h3>MENU</h3>
  <div class="setcols">
  <div class="scol">
  <div class="ash"><span>GAME</span></div>
  <div class="row"><div class="b"><div class="nm">Sound</div><div class="ds">Quiet machine sounds.</div></div>
    <button class="buy flat${S.set.sound?' on':''}" id="sS">${S.set.sound?'ON':'OFF'}</button></div>
  <div class="row"><div class="b"><div class="nm">Vibration</div>
    <div class="ds">Haptics on mobile.</div></div>
    <button class="buy flat${S.set.haptic?' on':''}" id="sH">${S.set.haptic?'ON':'OFF'}</button></div>
  <div class="row"><div class="b"><div class="nm">Anonymous stats</div>
    <div class="ds">Optional. No keys, no personal data. <a id="csPriv" target="_blank" rel="noopener">Privacy</a></div></div>
    <button class="buy flat${biConsent()?' on':''}" id="biT">${biConsent()?'ON':'OFF'}</button></div>
  <div class="ash"><span>CONTROLS</span></div>
  <div class="row"><div class="b"><div class="ds"><b>Draw</b> tap or flick the deck, or swipe up · <b>Bank</b> swipe down · <b>Bank all</b> hold the BANK button<br>
    <b>Tabs</b> swipe sideways, anywhere off the deck · <b>Deck view</b> hold the deck · <b>Split</b> tap a chip<br>
    Lift the top card early: drop it on the felt and it flips when the draw cooldown clears.<br>
    Tap a charged trick card to arm it. Hold a face-up card for its story.<br>
    Swap, Clip, Ghost, Dredge and Riffle rewrite table values — every rewrite turns back at the shuffle.<br>
    Keys: <b>Space</b> draw · <b>B</b> bank · <b>F</b> hand · <b>D</b> deck · <b>1-6</b> tabs.</div></div></div>
  </div>
  <div class="scol">
  <div class="ash csnet"><span>CLOUD SAVE</span><b id="csNet"></b></div>
  <p class="note csnote">The game always saves on this device. A key is the only account: it carries your game to any device, no signup.</p>
  <div class="row"><div class="b"><div class="nm">Your key</div>
    <div class="csk" id="csK"></div>
    <div class="ds" id="csKy">Same key, same game. Keep it somewhere safe.</div></div>
    <button class="buy flat" id="csCp">COPY</button></div>
  <div class="row"><div class="b"><div class="nm">Auto-sync</div>
    <div class="ds">Backs the game up while you play.</div></div>
    <button class="asw${cloudRec().auto?' on':''}" id="csA" role="switch" aria-checked="${!!cloudRec().auto}"><i></i></button></div>
  <div class="row"><div class="b"><div class="nm">Back up now</div>
    <div class="ds" id="csMsg"></div></div>
    <button class="buy flat" id="csP">PUSH</button></div>
  <div class="row"><div class="b"><div class="nm">Load a game</div>
    <div class="csin"><input id="csIn" maxlength="29" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="paste a key" aria-label="Save key">
    <button class="buy flat" id="csGo">LOAD</button></div>
    <div class="ds" id="csL">Type its key to load a game here.</div></div></div>
  <div class="ash dgr"><span>DANGER</span></div>
  <div class="row"><div class="b"><div class="nm">Delete save</div><div class="ds">Everything here, and your cloud key rotates. The old backup retires, it is not lost.</div></div>
    <button class="buy rd" id="sW">WIPE</button></div>
  <div class="row"><div class="b"><div class="nm">Delete cloud copy</div><div class="ds">Erases the online backup. Auto-sync turns off. No undo.</div></div>
    <button class="buy rd" id="csDel">DELETE</button></div>
  </div>
  </div>
  <button class="close" onclick="closeMo()">CLOSE</button>
  <p class="dsnote">found a bug? have ideas? <a href="https://discord.gg/fsRnxAY8d5" target="_blank" rel="noopener">join the discord</a> (:</p>`);
  $('#sh').classList.add('set');
  $('#sS').onclick=()=>{S.set.sound=!S.set.sound;save(true);openSet();};
  $('#sH').onclick=()=>{S.set.haptic=!S.set.haptic;save(true);openSet();};
  $('#biT').onclick=()=>{biSetConsent(!biConsent());buzz(10);openSet();};
  const pv=$('#csPriv');
  if(pv)pv.href=(CLOUD_BASE||'https://zahlenzellen.io/squeezer/cs')+'/privacy';
  /* cloud save: the key is the whole account. Async ops paint into the
     status lines instead of re-opening the sheet, so a slow round trip
     never snaps the modal's scroll */
  const csMsg=$('#csMsg'),csL=$('#csL'),csKy=$('#csKy');
  const KY_TXT='Same key, same game. Keep it somewhere safe.';
  const paintMsg=()=>{const r=cloudRec();
    csMsg.textContent=!CLOUD_BASE?'No sync server configured.'
      :r.held?'Paused. Back up now starts a fresh backup, Load brings the old one back.'
      :r.pt?`Backed up ${cloudAgo(r.pt)}.`:'Never backed up. Tap PUSH.';};
  paintMsg();
  const paintNet=w=>{const el=$('#csNet');if(!el)return;
    el.textContent=w;el.style.color=w==='ONLINE'?'var(--grn)':w==='OFFLINE'?'var(--red)':'var(--ink3)';};
  /* demo runs never sync: no key mint, no ping; the buttons still
     answer, cloud.js refuses them with err 'demo' */
  let ckey=null;
  if(window.__demo){
    ckey=cloudNormKey(cloudRec().key)||'';
    $('#csK').textContent=ckey?cloudShow(ckey):'no key in demo';
    csKy.textContent='Demo runs never sync.';
    paintNet('DEMO');
  }else{
    ckey=cloudEnsureKey();
    $('#csK').textContent=cloudShow(ckey);
    if(!CLOUD_BASE)paintNet('NO SERVER');
    else fetch(CLOUD_BASE+'/ping').then(r=>r.json())
      .then(j=>{paintNet(j.ok?'ONLINE':'DOWN');})
      .catch(()=>{paintNet('OFFLINE');});
  }
  let kyT=0;
  $('#csCp').onclick=()=>cloudCopy(ckey).then(okc=>{buzz(8);
    clearTimeout(kyT);
    csKy.textContent=okc?'Key copied to the clipboard.'
      :'Copy failed: tap the key, then copy by hand.';
    kyT=setTimeout(()=>{csKy.textContent=KY_TXT;},3000);});
  $('#csA').onclick=()=>{const r=cloudRec();r.auto=!r.auto;cloudSaveRec(r);
    buzz(10);openSet();};
  $('#csP').onclick=async()=>{const b=$('#csP');b.disabled=true;
    csMsg.textContent='Backing up';
    const r=await cloudPush();b.disabled=false;buzz(r.ok?8:4);
    if(r.ok){paintMsg();return;}
    csMsg.textContent=r.err==='net'?'No connection.'
      :r.err==='setup'?'No server.'
      :r.err==='demo'?'Demo runs never sync.'
      :r.err==='sid'?'Another session holds this save. Reclaim below.'
      :r.err==='sum'?'Rejected: this page is out of date. Reload it, then push.'
      :(r.err==='plaus'?'Rejected: the save failed the server sanity check.'
      :'Server error.');};
  /* load: one tap loads, but a cloud copy older than the current game
     arms first — OVERWRITE within 4s or the tap was a mis-read. The
     armed tap falls THROUGH the arm check (the flag stays set) and
     loads; clearing it here would just re-arm forever */
  let armT=0;
  const disarm=()=>{const b=$('#csGo');if(!b)return;
    delete b.dataset.arm;b.textContent='LOAD';b.classList.remove('rd');};
  $('#csGo').onclick=async()=>{
    const b=$('#csGo'),raw=$('#csIn').value;
    if(!cloudNormKey(raw)){csL.textContent='A key is 24 letters and digits.';return;}
    clearTimeout(armT);
    csL.textContent='Loading';
    const r=await cloudPull(raw);
    if(!r.ok){buzz(4);
      csL.textContent=r.err==='key'?'A key is 24 letters and digits.'
        :r.err==='none'?'No save under that key.'
        :r.err==='demo'?'Demo runs never sync.'
        :r.err==='net'?'No connection.'
        :r.err==='corrupt'?'That save came back damaged. Try again.'
        :r.err==='bad'?'That save will not load here.':'Load failed.';
      return;}
    if(S.st.draws&&r.ts&&S.t>r.ts+120000&&!b.dataset.arm){
      b.dataset.arm='1';b.textContent='OVERWRITE';b.classList.add('rd');buzz(4);
      csL.textContent='Your game here is newer. OVERWRITE replaces it.';
      armT=setTimeout(disarm,4000);
      return;}
    disarm();
    buzz(8);cloudApply(r);
  };
  $('#csIn').onkeydown=e=>{if(e.key==='Enter')$('#csGo').onclick();};
  /* erasure is three taps, each a 4s window: DELETE arms to SURE?,
     SURE? arms to ERASE, ERASE does it. Lives in DANGER now, and
     auto-sync turns off with it so the erasure sticks */
  let delT=0;
  const delReset=()=>{const b=$('#csDel');if(!b)return;
    delete b.dataset.arm;b.textContent='DELETE';};
  $('#csDel').onclick=async()=>{
    const b=$('#csDel');
    if(!b.dataset.arm){b.dataset.arm='1';b.textContent='SURE?';buzz(4);
      clearTimeout(delT);delT=setTimeout(delReset,4000);return;}
    if(b.dataset.arm==='1'){b.dataset.arm='2';b.textContent='ERASE';buzz([20,40,20]);
      clearTimeout(delT);delT=setTimeout(delReset,4000);return;}
    clearTimeout(delT);delReset();b.disabled=true;
    const r=await cloudDelete();b.disabled=false;buzz(r.ok?8:4);
    if(r.ok){openSet();
      $('#csMsg').textContent='Cloud copy deleted. Auto-sync is off.';return;}
    csMsg.textContent='Delete failed: '+(r.err==='net'?'no connection'
      :r.err==='setup'?'no server'
      :r.err==='demo'?'demo runs never sync':'server error')+'.';};
  $('#sW').onclick=async()=>{S=newState();seed();buildEls();rollShop(true);
    /* the cloud key rotates: the fresh game backs up under a new code
       and the old copy retires on the server, kept but unreachable */
    await cloudRotate();
    await flush();closeMo();layout();paint();renderAll();
    $$('#tabs button').forEach((b,i)=>{if(i)b.classList.add('hid');});Tabs.thumb();toast('Save wiped\nA fresh key is in the menu','trash');};
}
function openWelcome(o){
  const hh=Math.floor(o.t/3600),m=Math.floor(o.t%3600/60);
  openMo(`<h3>WHILE YOU WERE OUT</h3>
  <p class="note">Auto-draw dealt for <b class="tmr">${hh}h ${m}m</b> at ${(o.eff*100)|0}% efficiency${o.cap?' · offline cap hit':''}.</p>
  <div style="text-align:center;margin:16px 0"><div style="font-family:var(--disp);font-size:36px;font-weight:800;letter-spacing:-.02em;color:var(--gld)">+${fmt(o.gain)}</div>
  <div style="font-size:8.5px;letter-spacing:.22em;color:var(--ink3);font-weight:700;margin-top:4px">SCORE COLLECTED</div></div>
  <button class="close" onclick="closeMo()">COLLECT</button>`);
}
/* the hidden tab's session: the autos played on with the effects dark,
   at the live rate, and this reports what they made */
function openBgModal(dt,banks,busts,draws,gain){
  const dur=dt>=3600000
    ?`${Math.floor(dt/3600000)}h ${Math.floor(dt%3600000/60000)}m`
    :`${Math.floor(dt/60000)}m ${Math.floor(dt%60000/1000)}s`;
  openMo(`<h3>WHILE YOU WERE OUT</h3>
  <p class="note">The autos played for <b class="tmr">${dur}</b>, live rate, no offline discount.</p>
  <div style="text-align:center;margin:16px 0"><div style="font-family:var(--disp);font-size:36px;font-weight:800;letter-spacing:-.02em;color:var(--gld)">+${fmt(gain)}</div>
  <div style="font-size:8.5px;letter-spacing:.22em;color:var(--ink3);font-weight:700;margin-top:4px">SCORE COLLECTED</div></div>
  <p class="note">${banks} bank${banks===1?'':'s'}${D}${draws} card${draws===1?'':'s'} dealt${busts?`${D}${busts} bust${busts===1?'':'s'}`:''}</p>
  <button class="close" onclick="closeMo()">COLLECT</button>`);
}

/* ---------------- sticker card: hold / right-click a table card ----------------
   the card, then its sticker's line — nothing else. Blanks have no
   sticker to show, so they keep the full sheet */
function openStkCard(id){
  const c=byId(id);if(!c)return;
  if(!c.stk)return openCardSheet(id);
  const a=STK[c.stk];
  const tmp=[];
  if(c.cv!=null)tmp.push('showing '+c.cv+' till it leaves the table');
  if(c.osk)tmp.push('your '+STK[c.osk].n+' waits underneath');
  const h=S.hands.find(x=>x.ids.indexOf(id)>=0);
  openMo(`<div class="cardmo"><div class="stkshow">${mini(cval(c),c.stk,c.r,c.id,c)}</div>
  <div class="cardmoR"><p class="stkline"><b>${a.n}</b>: ${a.d}${tmp.length?`<br><i>${tmp.join(' · ')}</i>`:''}${stkNow(c,h)}</p></div></div>
  <button class="close" onclick="closeMo()">CLOSE</button>`);
}

/* ---------------- card sheet: tap a card in the DECK tab ---------------- */
function openCardSheet(id){
  const c=byId(id);if(!c)return;
  const a=c.stk?STK[c.stk]:null;
  const hi=S.hands.findIndex(h=>h.ids.includes(id));
  const r=hi>=0?S.hands[hi].run:null;
  const setAside=r&&r.culled.includes(id);
  const loc=hi>=0?(setAside?'SET ASIDE '+D+' back when hand '+(hi+1)+' banks':'ON TABLE '+MID+' HAND '+(hi+1))
    :S.deck.includes(id)?'IN THE DECK'
    :S.out.includes(id)?'OUT '+D+' back on the next bust'
    :S.disc&&S.disc.includes(id)?'DISCARD '+D+' back when you score'
    :'GONE';
  const lines=[];
  if(Array.isArray(c.cond))c.cond.forEach(k=>{if(COND[k])
    lines.push(COND[k].n.toUpperCase()+': '+COND[k].d);});
  if(c.r)lines.push('relic +'+Math.round(c.r*ECO.RELIC_PER*100)+'% '+MID+' grows every bank');
  if(r&&r.floated.includes(id))lines.push('FLOATED '+X+'0 '+MID+' paid, still steps the multiplier');
  if(c.cv!=null)lines.push('SHOWING '+c.cv+' '+MID+' till it leaves the table');
  if(c.osk)lines.push('WEARING '+STK[c.osk].n+' '+MID+' the printed sticker is back when it leaves the table');
  if(c.boom3)lines.push('TRIPLED '+D+' the draw won');
  else if(c.dud)lines.push('DUD '+D+' the draw lost, worth 0');
  if(c.stk==='anchor'&&r&&r.anchWin&&r.anchWin.length){
    const gw=r.anchWin.find(w=>w.id===id&&w.left>0);
    if(gw)lines.push('GUARDING '+D+' a twin slips back into the deck, '
      +gw.left+' draw'+(gw.left===1?'':'s')+' left');}
  if(a&&TRICK[c.stk]){
    const armed=r&&(r.armedC===id||r.armedF===id
      ||r.stakesIds.includes(id));
    const used=r&&r.spent.includes(id);
    if(armed)lines.push('ARMED '+D+' waiting on its window');
    else if(used)lines.push('SPENT '+D+' refills on bank');
    else if(hi>=0)lines.push('CHARGED '+D+' tap it on the table to arm');
  }
  const deckN=S.deck.filter(x=>byId(x).v===c.v).length;
  const holders=S.hands.filter(h=>h.ids.some(x=>byId(x).v===c.v));
  const purified=S.hands.some(h=>pureVals(h).has(c.v));
  const live=holders.length&&!purified&&deckN>0;
  openMo(`<div class="shead"><h3>THE ${c.v}</h3><span class="chip loc">${loc}</span></div>
  <div class="cardmo"><div class="stkshow">${mini(cval(c),c.stk,c.r,c.id,c)}</div>
    <div class="cardmoR">
      <div class="stkline">${a?`<b>${stkIcon(c.stk,c.shy)} ${a.n}</b>: ${a.d}`:`<span class="blank">blank ${D} no sticker yet. Only blanks can take one.</span>`}</div>
      ${lines.length?`<span class="cndline"></span><span class="cndtip">${lines.join('<br>')}</span>`:''}
      ${hi>=0?`<div class="stkline"><span class="now">NOW WORTH <b>${fmt(worthOf(c,S.hands[hi]))}</b> ${MID} after every mult</span></div>`:''}
      ${live||purified||(a&&NONSTACK[c.stk])?`<div class="chips">
        ${live?'<span class="chip" style="color:var(--red)">risky cards in the deck</span>':''}
        ${purified?'<span class="chip ok">purified '+D+' cannot bust you</span>':''}
        ${a&&NONSTACK[c.stk]?'<span class="chip">unique · only one, ever</span>':''}</div>`:''}
    </div></div>
  <button class="close" onclick="closeMo()">CLOSE</button>`);
}

/* ---------------- De-bolt: strip a sticker, card goes blank ----------------
   oi = the shop offer it rode in on (a 10% roll); a strip spends it */
function openDebolt(oi){
  const list=S.cards.filter(c=>c.stk);
  if(!list.length)return;
  openMo(`<h3>DE-BOLT</h3><p class="note">Strip a sticker; the card goes blank and can take a new one. Half price, min 1K. No refunds.</p>`
    +list.map(c=>{
      const base=c.osk||c.stk,pr=dePrice(base);   /* the printed sticker sets the price */
      return `<div class="row"><div class="mc">${mini(cval(c),c.stk,c.r,c.id,c)}</div>
        <div class="b"><div class="nm"><b style="color:${inkOf(c.v)}">${c.v}</b> ${stkIcon(base,c.shy)} ${STK[base].n}</div>
        <div class="ds">${c.r?'relic growth lost · ':''}${STK[base].d}</div></div>
        <button class="buy rd" data-id="${c.id}" ${S.score<pr?'disabled':''}>${fmt(pr)}</button></div>`;}).join('')
    +`<button class="close" onclick="closeMo()">CLOSE</button>`);
  $$('#sh .buy[data-id]').forEach(b=>b.onclick=()=>{
    const c=byId(+b.dataset.id);if(!c||!c.stk)return;
    const pr=dePrice(c.osk||c.stk);
    if(S.score<pr){SFX.deny();return;}
    S.score-=pr;S.st.stkSpent=(S.st.stkSpent||0)+pr;   /* strips count toward the gate too */
    logAct('db',-pr);
    bi('buy',{k:'db',id:c.osk||c.stk,p:biBucket(pr),t:biPlayMin()});
    c.stk=null;delete c.osk;delete c.cv;delete c.srot;delete c.shy;faceOf(c);
    if(oi!=null&&S.shop.offers[oi])S.shop.offers[oi].sold=true;
    SFX.stamp();buzz(16);toast('Sticker stripped\nThe '+c.v+' is blank','x');
    closeMo();layout();paint();renderCards();renderShop();save(true);
  });
}
