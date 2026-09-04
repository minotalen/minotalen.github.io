/* ==================================================================
   telemetry.js — anonymous, opt-in play stats (ANALYTICS.md). No keys,
   no IPs, no identifiers beyond a random analytics id that is NOT the
   save key. Before the player answers the consent bar the queue lives
   in memory only: their session is recorded on the device, sent only
   on YES, discarded on NO (nothing is written to storage or the
   network before consent — the aid, the seq and the first-markers
   follow the same rule). After consent the queue persists through a
   capped store buffer and drains by sendBeacon to the /bi endpoint in
   batches of 50, so offline play keeps count. Income snapshots (inc,
   plus the same fields riding ses) report lifetime totals every 15
   play-minutes: unsampled, monotonic, the per-player money axis.
   Each envelope carries bd, the client build (?v=): every table and
   curve can be cut by build once patches ship. One beat ping per
   session (pagehide) says only whether stats are on — no id — so the
   opt-in rate is measurable.
   ================================================================== */
let biT0=Date.now(),biSeq=+(store.get('bi-seq')||{value:0}).value||0,
    biPlay=+(store.get('bi-play')||{value:0}).value||0,
    biIncNext=+(store.get('bi-inc')||{value:0}).value||0;
/* minutes of play this player has on record — the honest x-axis for
   goal/sticker balance. Play means visible: a hidden tab's auto-run
   burns wall time, not play-minutes, so the hidden stretch is shaved
   off before any metric reads it */
let biHid=0,biHidAt=0;
function biMs(){const n=Date.now();
  return Math.max(0,n-biT0-biHid-(biHidAt?n-biHidAt:0));}
function biPlayMin(){return Math.round((biPlay+biMs()/1000)/60);}
/* the client build, read off main.js's own ?v= tag: the version every
   asset link shares. 0 = unversioned/dev load */
let biBdV=null;
function biBuild(){
  if(biBdV!=null)return biBdV;
  try{const t=document.querySelector('script[src*="js/main.js"]');
    const m=t&&String(t.src||'').match(/[?&]v=(\d+)/);
    biBdV=m?+m[1]:0;}catch(e){biBdV=0;}
  return biBdV;}
/* the income snapshot: lifetime totals, unsampled, every player. g is
   lifetime score earned — monotonic across ascends, so per-player
   earning curves and first-hour earnings read straight off it. The
   progression axes ride along: sa lifetime shards, u/ml owned upgrade
   and meta levels, pc stickers placed, c different stickers — the
   per-player progression curves read off those the same way. dr is
   lifetime draws, monotonic the same way: the dashboard reads a day's
   cards drawn off day-over-day dr deltas, exactly like income */
function biSnap(){try{
  if(typeof S==='undefined'||!S)return null;
  const lv=o=>Object.keys(o||{}).reduce((a,k)=>a+(+o[k]||0),0);
  return {g:biBucket(S.life),s:biBucket(S.score),sh:biBucket(S.shards),
          a:S.asc,t:biPlayMin(),
          sa:biBucket(S.shAll||0),u:lv(S.up),ml:lv(S.meta),
          pc:S.st?+(S.st.placed||0):0,
          dr:biBucket(S.st?+(S.st.draws||0):0),
          c:typeof cmpDiff==='function'?cmpDiff():0};}catch(e){return null;}}
const biQ=[];
/* restore the capped buffer: whatever the last session queued but
   never flushed (short visits, offline play, dead tabs). Only exists
   once consent has been given — pre-consent sessions never persist */
try{const c=store.get('bi-ev');
  if(c&&c.value)for(const e of JSON.parse(c.value).slice(-200))biQ.push(e);}catch(e){}
function biPersist(){try{store.set('bi-ev',JSON.stringify(biQ.slice(-200)));}catch(e){}}
function biConsent(){const c=store.get('bi-consent');
  return !!(c&&c.value==='1');}
/* pre-consent identity: a RAM-only aid, so an unanswered session never
   writes an identifier to the device */
let biAidV=null;
function biAid(){
  if(biConsent()){
    const c=store.get('bi-aid');
    if(c&&/^[0-9A-Z]{16}$/.test(c.value))return c.value;
    const a=biAidV||biMintAid();
    store.set('bi-aid',a);return a;}
  if(!biAidV)biAidV=biMintAid();
  return biAidV;}
function biMintAid(){
  const a=new Uint8Array(16);
  if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(a);
  else for(let i=0;i<16;i++)a[i]=Math.floor(Math.random()*256);
  let s='';for(let i=0;i<16;i++)s+=CLOUD_ABC[a[i]%CLOUD_ABC.length];
  return s;}
/* the MENU toggle: OFF stops collection and purges what is queued,
   but keeps the established identity and play-clock — turning stats
   back on must not fork the player into a second aid */
function biSetConsent(on){store.set('bi-consent',on?'1':'0');
  if(!on){biQ.length=0;store.set('bi-ev','[]');}}   /* opt-out purges the queue */
/* the first-boot bar. YES promotes the whole RAM session into durable
   storage (aid, seq, first-markers, queue) and flushes it — the real
   boot event, with platform and build, was already buffered at load.
   NO nukes everything bi-*: collected-before-consent data is deleted,
   which is the whole promise of the RAM buffer */
let biFirstRam={};
function biAnswer(on){
  biSetConsent(on);
  try{const bar=$('#biBar');if(bar)bar.classList.remove('on');}catch(e){}
  if(on){
    try{
      const c=store.get('bi-aid');
      const keep=c&&/^[0-9A-Z]{16}$/.test(c.value)?c.value:null;
      const aid=keep||biAidV||biMintAid();
      store.set('bi-aid',aid);
      /* the queue may carry the RAM aid from the off stretch: rewrite */
      for(const q of biQ)if(q.aid!==aid)q.aid=aid;
      store.set('bi-seq',''+biSeq);
      if(biIncNext)store.set('bi-inc',''+biIncNext);
      let m={};try{const f=store.get('bi-first');
        if(f&&f.value)m=JSON.parse(f.value)||{};}catch(e){}
      for(const k in biFirstRam)m[k]=1;
      store.set('bi-first',JSON.stringify(m));
    }catch(e){}
    biPersist();
    biFlush(true);
  }else{
    biQ.length=0;biFirstRam={};biAidV=null;biSeq=0;biIncNext=0;
    for(const k of ['bi-ev','bi-aid','bi-seq','bi-first','bi-play','bi-inc'])
      try{store.set(k,'');}catch(e){}
  }}
let biErr=0;
function bi(e,f){
  if(!CLOUD_BASE)return;
  if(e==='err'&&++biErr>20)return;   /* an error loop must not queue-spam */
  biSeq++;
  if(biConsent())store.set('bi-seq',''+biSeq);
  biQ.push(Object.assign({v:1,aid:biAid(),ts:Date.now(),seq:biSeq,e,bd:biBuild()},f||{}));
  if(biQ.length>200)biQ.shift();
  /* pre-consent the queue stays in RAM: no store write, no flush */
  if(biConsent()){biPersist();
    if(biQ.length>=10)biFlush();}}
/* once-per-player milestones: draw, bank, shop, stk, upg, asc...
   markers: RAM before consent (they ride the buffered events), the
   store after (and the stored set is honored pre-consent too, so a
   stats-off stretch after an old YES never re-fires an old first) */
function biFirst(w){
  let m={};
  try{const c=store.get('bi-first');
    if(c&&c.value)m=JSON.parse(c.value)||{};}catch(e){}
  if(m[w]||biFirstRam[w])return;
  biFirstRam[w]=1;
  if(biConsent()){
    m[w]=1;
    try{store.set('bi-first',JSON.stringify(m));}catch(e){}}
  bi('first',{w,t:biPlayMin()});}
/* 2 significant digits: pays keep their shape, cardinality stays low */
function biBucket(n){n=+n;return isFinite(n)&&n?+n.toPrecision(2):0;}
/* the /bi endpoint takes 50 envelopes per POST; splice keeps a big
   restored queue from wedging into a permanent 400 retry loop */
function biFlush(all){
  if(!biQ.length||!CLOUD_BASE||!biConsent())return;
  const batch=biQ.splice(0,50);
  biPersist();
  const payload=JSON.stringify(batch);
  const url=CLOUD_BASE.replace(/\/cs\/?$/,'')+'/bi/';
  let sent=false;
  try{sent=!!(navigator.sendBeacon&&
    navigator.sendBeacon(url,new Blob([payload],{type:'text/plain'})));}catch(e){}
  if(sent){if(all&&biQ.length)biFlush(true);return;}
  fetch(url,{method:'POST',body:payload,keepalive:true})
    .then(r=>{if(!(r.ok||r.status===204))biRequeue(batch);})
    .catch(()=>biRequeue(batch));}
function biRequeue(b){biQ.unshift(...b);if(biQ.length>200)biQ.length=200;biPersist();}
/* the session beat: one ping at pagehide saying only whether stats are
   on. No id, no events — the server counts sessions and (through a
   salted, truncated, daily one-way code of the IP) rough uniques, so
   the opt-in rate exists as a number. Sent either way, and named as
   such in the privacy policy */
function biBeat(){
  if(!CLOUD_BASE)return;
  const url=CLOUD_BASE.replace(/\/cs\/?$/,'')+'/bi/beat';
  const payload=JSON.stringify({c:biConsent()?1:0});
  let sent=false;
  try{sent=!!(navigator.sendBeacon&&
    navigator.sendBeacon(url,new Blob([payload],{type:'text/plain'})));}catch(e){}
  if(sent)return;
  try{fetch(url,{method:'POST',body:payload,keepalive:true}).catch(()=>{});}catch(e){}}
/* the consent bar covers the tabs until the player answers */
function biAsk(){
  if(!CLOUD_BASE)return;
  const c=store.get('bi-consent');
  if(c&&c.value!=null)return;   /* asked before: their answer stands */
  const bar=$('#biBar');
  if(bar)bar.classList.add('on');}
(function bindBar(){
  const ok=$('#biOk'),no=$('#biNo');
  if(ok)ok.onclick=()=>biAnswer(true);
  if(no)no.onclick=()=>biAnswer(false);})();
/* ask once, after boot has settled */
setTimeout(biAsk,1200);
/* opportunistic drain on the cloud-push cadence, not just page exit;
   the same tick takes an income snapshot every 15 play-minutes. The
   snapshot buffers pre-consent like everything else; only the inc
   cursor's store write waits for consent */
setInterval(()=>{biFlush();
  if(!biIncNext)biIncNext=Math.ceil(biPlayMin()/15)*15;
  if(biPlayMin()>=biIncNext){
    biIncNext=biPlayMin()+15;
    if(biConsent())store.set('bi-inc',''+biIncNext);
    const f=biSnap();if(f)bi('inc',f);}},60000);
/* long-frame watch: one rAF clock, visible time only. lf counts frames
   over 100ms, fw is the worst gap — both ride the ses event. The
   stubbed rAF in the test harness passes no timestamp: bail instead of
   spinning a fake timer loop */
let biLF=0,biFW=0,biLastF=0;
function biFrame(t){
  if(t==null)return;
  if(biLastF&&!document.hidden){
    const g=t-biLastF;
    if(g>100)biLF++;
    if(g>biFW)biFW=g;}
  biLastF=t;
  requestAnimationFrame(biFrame);}
try{requestAnimationFrame(biFrame);}catch(e){}
/* ---- wiring: boot once everything is up, sessions, errors ---- */
addEventListener('load',()=>{
  try{if(S){const f={sv:S.ver,o:/iP/.test(navigator.platform)?'ios'
    :/Android/.test(navigator.platform)?'android'
    :/Mac/.test(navigator.platform)?'mac'
    :/Win/.test(navigator.platform)?'win':'other',
    bt:performance&&performance.now?Math.round(performance.now()):0};
    if(self!==top){const s=biSrc(document.referrer);if(s)f.src=s;}   /* itch / galaxy / generic embed */
    bi('boot',f);}}catch(e){}
  biT0=Date.now();biHid=0;biHidAt=0;});
addEventListener('pagehide',()=>{
  const dur=Math.round(biMs()/1000);
  biPlay+=dur;
  store.set('bi-play',''+biPlay);
  const f=biSnap()||{};
  f.d=dur;                     /* the session's last word: totals + length */
  f.lf=biLF;f.fw=biFW?biBucket(biFW):0;   /* the jank the session actually saw */
  bi('ses',f);
  biLF=0;biFW=0;
  biBeat();
  biT0=Date.now();biHid=0;biHidAt=0;
  biFlush(true);});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){biFlush();biHidAt=Date.now();}
  else{if(biHidAt){biHid+=Date.now()-biHidAt;biHidAt=0;}
    biLastF=0;}});   /* the frame clock restarts: no phantom first gap */
/* which portal embedded us: the referrer names the host (browsers send
   at least the origin). Unknown iframe → generic emb, standalone → no
   src field at all */
function biSrc(ref){
  const m=String(ref||'').match(/(itch|galaxy)\.[a-z.]+/i);
  if(m)return m[1].toLowerCase();
  return ref?'emb':'';}
function biStack(e){
  try{const s=e&&e.stack?String(e.stack).split('\n'):[];
    return (s[1]||s[0]||'').trim().slice(0,120);}catch(x){return '';}}
addEventListener('error',e=>bi('err',{
  m:String(e&&e.message||'err').slice(0,120),st:biStack(e&&e.error),
  sv:(typeof S!=='undefined'&&S&&S.ver)||0}));
addEventListener('unhandledrejection',e=>bi('err',{
  m:String((e&&e.reason&&(e.reason.message||e.reason))||'rej').slice(0,120),
  st:biStack(e&&e.reason),
  sv:(typeof S!=='undefined'&&S&&S.ver)||0}));
