/* ==================================================================
   cloud.js — key-based cloud saves. No account: a 24-letter key IS
   the login. The key is born on the first MENU visit, shown in the
   CLOUD SAVE block, and every push overwrites the cloud copy under
   it. Typing any key pulls that copy back (load + reload, so the
   save walks boot's own merge and migration chain).
   The sync record lives beside the save in the store ('cloud'), so a
   wiped save keeps its key: wipe pauses auto-push (held) until you
   push a fresh backup or load the old one. Demo runs never sync.
   Server: server/cloud.js in this repo. CLOUD_BASE is set at deploy.
   ================================================================== */
let CLOUD_BASE='https://zahlenzellen.io/squeezer/cs';
let CLOUD_WAIT=15000;     /* auto-push debounce after a flush */
const CLOUD_ABC='23456789ABCDEFGHJKMNPQRSTUVWXYZ';  /* no 0 O 1 I L */
const CLOUD_KRE=new RegExp('^['+CLOUD_ABC+']{24}$');

/* integrity tag over the exact blob: two FNV-1a lanes (one index-mixed)
   give 64 bits against corruption and casual hand edits. It is not
   secrecy — the client computes it, so a determined cheater recomputes
   it too; the server's plausibility gate is what bounds them */
function cloudSum(s){
  let a=0x811c9dc5>>>0,b=0x019d5f11>>>0;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);
    a=Math.imul(a^c,16777619)>>>0;
    b=Math.imul(b^c,16777619)>>>0;
    b=(b+i+((b>>>7)^c))>>>0;}
  const h=n=>('0000000'+n.toString(16)).slice(-8);
  return h(a)+h(b);}

function cloudNormKey(s){if(typeof s!=='string')return null;
  const k=s.toUpperCase().replace(/[^0-9A-Z]/g,'');
  return CLOUD_KRE.test(k)?k:null;}
/* 6 groups of 4: the way the key is written everywhere it is shown */
function cloudShow(k){return (k||'').replace(/(.{4})/g,'$1 ').trim();}
function cloudGenKey(){
  const a=new Uint8Array(24),n=CLOUD_ABC.length;
  if(typeof crypto!=='undefined'&&crypto.getRandomValues){
    /* rejection sampling: no letter carries the modulo bias */
    for(let i=0;i<24;){const b=new Uint8Array(1);
      crypto.getRandomValues(b);
      if(b[0]<256-256%n)a[i]=b[0]%n,i++;}
  }else for(let i=0;i<24;i++)a[i]=Math.floor(Math.random()*n);
  let s='';for(let i=0;i<24;i++)s+=CLOUD_ABC[a[i]];
  return s;}

/* ---------------- the sync record ---------------- */
function cloudRec(){
  let r=null;try{const g=store.get('cloud');if(g&&g.value)r=JSON.parse(g.value);}catch(e){}
  return Object.assign({key:null,auto:true,pt:0,nt:0,ps:0,sid:0,held:false},r||{});}
function cloudSaveRec(r){store.set('cloud',JSON.stringify(r));}
/* a key is born the first time the MENU asks for one, not on a timer */
function cloudEnsureKey(){const r=cloudRec();
  if(!cloudNormKey(r.key)){r.key=cloudGenKey();cloudSaveRec(r);bi('cloud',{w:'key'});}return r.key;}
function cloudHold(){const r=cloudRec();
  if(cloudNormKey(r.key)){r.held=true;cloudSaveRec(r);}}
function cloudCanAuto(){
  if(!CLOUD_BASE)return false;
  const r=cloudRec();
  return !!(r.auto&&cloudNormKey(r.key)&&!r.held&&!window.__demo);}

function cloudAgo(ts){if(!ts)return 'never';
  const s=Math.max(0,(Date.now()-ts)/1000);
  if(s<50)return 'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400*2)return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';}

/* ---------------- action log ----------------
   Offline-first: every settled action appends one chained entry to
   S.log, which rides the save itself. The server replays the window
   between pushes (chain, counts, pay sums) — the growth gates stop
   guessing and check what the play actually did. Entries trim at
   LOG_MAX oldest-first; trimming shows as a seq gap, which the server
   accepts and journals. The chain is tamper-evidence, not secrecy. */
const LOG_MAX=500;
const LOG_FNV=s=>{let a=0x811c9dc5>>>0;
  for(let i=0;i<s.length;i++)a=Math.imul(a^s.charCodeAt(i),16777619)>>>0;
  return ('0000000'+a.toString(16)).slice(-8);};
function logAct(a,n,o){
  if(!S)return;
  if(!Array.isArray(S.log))S.log=[];
  S.logSeq=(S.logSeq||0)+1;
  const e={s:S.logSeq,t:Date.now(),a};
  if(n!=null&&isFinite(n))e.n=Math.round(n*100)/100;
  if(o)e.o=1;
  e.h=LOG_FNV((S.logH||'')+'|'+e.s+'|'+e.t+'|'+e.a+'|'+(e.n!=null?e.n:'')+'|'+(e.o||0));
  S.logH=e.h;
  S.log.push(e);
  if(S.log.length>LOG_MAX)S.log.splice(0,S.log.length-LOG_MAX);
}

/* ---------------- the session lock ----------------
   one writer per key: every tab mints a short session id (in
   sessionStorage, so a reload keeps it and a second tab gets its own).
   A push from a session that is not the lock holder is refused with
   the holder's id; that tab shows the kick bar and can RECLAIM, which
   compares the cloud copy first (lifetime draws: the holder may have
   played on while this tab sat kicked) and then either adopts that
   newer save or steals the lock by naming it. Read-only pulls need
   no lock.
   Closing the tab kills its sid, so the sync record remembers the last
   sid that held the lock (rec.sid): a new tab refused by that exact
   ghost steals it back silently — the bar means a live foreign session
   (or a second tab of this browser), never your own dead one */
let CLOUD_SID='',cloudHolder=null,cloudSteal=null,cloudGhostOK=true,
    cloudWantSteal=false;   /* an adoption handed its steal across the reload */
try{
  CLOUD_SID=sessionStorage.getItem('cs-sid')||'';
  cloudWantSteal=!!sessionStorage.getItem('cs-steal');
  if(!/^[0-9A-Z]{8}$/.test(CLOUD_SID)){
    const a=new Uint8Array(8);
    if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(a);
    else for(let i=0;i<8;i++)a[i]=Math.floor(Math.random()*256);
    CLOUD_SID='';
    for(let i=0;i<8;i++)CLOUD_SID+=CLOUD_ABC[a[i]%CLOUD_ABC.length];
    sessionStorage.setItem('cs-sid',CLOUD_SID);}
}catch(e){CLOUD_SID=cloudGenKey().slice(0,8);}
function cloudKickShow(){const b=$('#kickBar');if(b)b.classList.add('on');}
function cloudKickHide(){const b=$('#kickBar');if(b)b.classList.remove('on');
  cloudHolder=null;cloudSteal=null;}
/* steal the lock with a fresh session id; a stale steal just re-arms.
   The cloud copy is pulled and compared first: a blind steal would
   overwrite the holder's progress with this tab's older save. Lifetime
   draws decide (a total, never-resetting counter the server already
   snapshots per record); a meaningfully newer cloud save is adopted
   instead via cloudApply's staging slot + reload, and the steal intent
   rides sessionStorage (cs-steal) so the fresh page's first refused
   push finishes taking the lock */
const RECLAIM_MIN=50;   /* draws of noise floor: autos churn this in a minute */
async function cloudReclaim(){
  const a=new Uint8Array(8);
  if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(a);
  else for(let i=0;i<8;i++)a[i]=Math.floor(Math.random()*256);
  CLOUD_SID='';
  for(let i=0;i<8;i++)CLOUD_SID+=CLOUD_ABC[a[i]%CLOUD_ABC.length];
  try{sessionStorage.setItem('cs-sid',CLOUD_SID);}catch(e){}
  const p=await cloudPull(cloudRec().key);
  if(p.ok&&p.save&&((p.save.st&&p.save.st.draws)||0)>=(S.st.draws||0)+RECLAIM_MIN){
    if(cloudHolder){
      try{sessionStorage.setItem('cs-steal',cloudHolder);}catch(e){}
    }
    cloudApply(p);
    return{ok:true,adopted:true};
  }
  cloudSteal=cloudHolder;
  const r=await cloudPush();
  cloudSteal=null;
  if(r.ok)cloudKickHide();
  else if(r.holder)cloudHolder=r.holder;
  return r;}

/* ---------------- push / pull ---------------- */
async function cloudPush(re){
  if(!CLOUD_BASE)return{ok:false,err:'setup'};
  if(window.__demo)return{ok:false,err:'demo'};   /* demo state is not a real save */
  /* the adopt handoff: intent is spent by the first real push whatever
     it answers — a success means the lock already lapsed */
  let want=false;
  if(!re&&cloudWantSteal){want=true;cloudWantSteal=false;
    try{sessionStorage.removeItem('cs-steal');}catch(e){}}
  const r=cloudRec();
  if(!cloudNormKey(r.key)){r.key=cloudGenKey();}
  const data=JSON.stringify(S);
  try{
    const res=await fetch(CLOUD_BASE+'/save',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({key:r.key,data,sum:cloudSum(data),
        sid:CLOUD_SID,steal:cloudSteal||undefined})});
    const j=await res.json().catch(()=>null);
    if(!j)return{ok:false,err:'fail'};
    if(!j.ok){
      if(j.err==='sid'){
        /* the holder is this browser's own dead tab (the last sid that
           held the lock here): steal it back silently, once per page
           load — a repeat flap means two live tabs and earns the bar */
        if(!re&&cloudGhostOK&&j.holder&&j.holder===r.sid){
          cloudGhostOK=false;cloudSteal=j.holder;
          const again=await cloudPush(true);
          cloudSteal=null;
          return again;
        }
        /* the adopted page's promised steal: the refusal names whoever
           holds NOW, which is the lock to take */
        if(!re&&want&&j.holder){
          cloudSteal=j.holder;
          const again=await cloudPush(true);
          cloudSteal=null;
          return again;
        }
        cloudHolder=j.holder||null;cloudKickShow();
      }
      return{ok:false,err:j.err||'fail',holder:j.holder};}
    r.pt=Date.now();r.ps=S.logSeq||0;r.sid=CLOUD_SID;cloudSaveRec(r);
    cloudKickHide();   /* a landed push means the lock is ours: the bar must go */
    if(Math.random()<.1)bi('cloud',{w:'push',s:biBucket(S.score),rt:biBucket(S.rate),asc:S.asc});   /* sampled: pushes are the loud lane */
    return{ok:true};
  }catch(e){bi('cloud',{w:'push-fail'});return{ok:false,err:'net'};}
}
/* pull validates through ingestSave: what comes back is exactly what
   a local boot would have accepted. The caller decides overwrite. */
async function cloudPull(raw){
  if(!CLOUD_BASE)return{ok:false,err:'setup'};
  if(window.__demo)return{ok:false,err:'demo'};   /* demo never reads or writes the cloud */
  const k=cloudNormKey(raw);
  if(!k)return{ok:false,err:'key'};
  try{
    const res=await fetch(CLOUD_BASE+'/save?key='+k);
    if(res.status===404)return{ok:false,err:'none'};
    if(!res.ok)return{ok:false,err:'fail'};
    const j=await res.json();
    if(!j.ok)return{ok:false,err:j.err||'fail'};
    if(typeof j.sum!=='string'||j.sum!==cloudSum(j.data))
      return{ok:false,err:'corrupt'};   /* bytes did not survive the trip */
    const save=ingestSave(j.data);
    if(!save)return{ok:false,err:'bad'};
    bi('cloud',{w:'pull'});
    return{ok:true,key:k,ts:j.ts||0,data:j.data,save};
  }catch(e){return{ok:false,err:'net'};}
}
/* write the pulled blob to the staging slot and reload: boot's first
   load() adopts it before the main slot is ever read, so the dying
   page's autosave (beforeunload flush) cannot win the race. The flag
   is the belt over that suspenders: no save, no final push */
function cloudApply(res){
  const r=cloudRec();r.key=res.key;r.nt=Date.now();r.held=false;
  cloudSaveRec(r);
  window.__cloudLoad=1;
  store.set(KEY+'.pull',res.data);
  location.reload();
}

/* GDPR erasure: delete the cloud copy under this key and stop sync.
   Auto stays off until the player turns it back on, so erasure sticks */
async function cloudDelete(){
  if(!CLOUD_BASE)return{ok:false,err:'setup'};
  if(window.__demo)return{ok:false,err:'demo'};   /* demo never touches the cloud copy */
  const r=cloudRec(),k=cloudNormKey(r.key);
  if(!k)return{ok:false,err:'key'};
  try{
    const res=await fetch(CLOUD_BASE+'/save?key='+k,{method:'DELETE'});
    if(!res.ok)return{ok:false,err:'fail'};
    const j=await res.json();
    if(!j.ok)return{ok:false,err:j.err||'fail'};
    r.pt=0;r.nt=0;r.held=false;r.auto=false;
    cloudSaveRec(r);
    bi('cloud',{w:'delete'});
    return{ok:true};
  }catch(e){return{ok:false,err:'net'};}
}

/* wipe flow: mint a fresh key for the new game and RETIRE the old
   cloud copy (soft delete: the server keeps it, nothing serves it).
   Nothing is lost; the player just can't reach the old save any more */
async function cloudRotate(){
  const r=cloudRec(),old=cloudNormKey(r.key);
  if(window.__demo)return{ok:true,key:old,retired:false};   /* demo wipes stay local: no key change, no retire */
  r.key=cloudGenKey();r.pt=0;r.nt=0;r.held=false;
  cloudSaveRec(r);
  bi('cloud',{w:'rotate'});
  if(CLOUD_BASE&&old){
    try{fetch(CLOUD_BASE+'/retire',{method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({key:old})});}catch(e){}
  }
  return{ok:true,key:r.key,retired:!!old};
}

/* ---------------- auto-sync ----------------
   flush is the one choke point every save drains through: after each
   one, coalesce pushes to one per CLOUD_WAIT. pagehide fires a final
   keepalive push so closing the tab never loses the last stretch.
   A save the server keeps refusing backs off 10 minutes instead of
   hammering the door every flush. The first auto-sync waits out a
   short warmup after load: boot settles (offline pay, tutorial,
   staging adoption) before the first backup leaves */
let cloudPT=0,cloudBack=0,cloudTT=0,cloudRetry=false;
let CLOUD_WARM=45000,cloudUp=Date.now();
function cloudOnFlush(){
  if(!cloudCanAuto())return;
  if(cloudTT){clearTimeout(cloudTT);cloudTT=0;}
  const wait=Math.max(0,cloudPT+CLOUD_WAIT-Date.now(),cloudBack-Date.now(),
    cloudUp+CLOUD_WARM-Date.now());
  cloudTT=setTimeout(()=>{cloudTT=0;
    if(!cloudCanAuto())return;
    cloudPT=Date.now();
    /* 'plaus' = the save itself is rejected; 'sum'/'key'/'data' are
       protocol-level: one quick retry before the long backoff, and
       the server journals every one of them now */
    cloudPush().then(j=>{
      if(j.ok){cloudRetry=false;return;}
      if(j.err==='plaus'||j.err==='sum'||j.err==='key'||j.err==='data'){
        cloudBack=Date.now()+(cloudRetry?600000:5000);
        cloudRetry=true;}});},wait);}
addEventListener('pagehide',()=>{
  if(!cloudCanAuto()||window.__cloudLoad)return;
  const r=cloudRec();
  if((S.logSeq||0)===(r.ps||0))return;   /* nothing new since the last push */
  try{
    const data=JSON.stringify(S);
    /* must match cloudPush's body exactly: sum went missing here once
       and every reload logged a 403 */
    fetch(CLOUD_BASE+'/save',{method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({key:r.key,data,sum:cloudSum(data),sid:CLOUD_SID})});}catch(e){}});

/* tap-to-copy with the old clipboard fallback for plain http */
function cloudCopy(text){
  if(navigator.clipboard&&navigator.clipboard.writeText)
    return navigator.clipboard.writeText(text).then(()=>true,()=>cloudCopyFallback(text));
  return Promise.resolve(cloudCopyFallback(text));}
function cloudCopyFallback(text){
  try{const t=document.createElement('textarea');
    t.value=text;t.style.position='fixed';t.style.opacity='0';
    document.body.appendChild(t);t.select();
    const ok=document.execCommand('copy');t.remove();return ok;}catch(e){return false;}}

/* the kick bar's RECLAIM button (static markup, bound once) */
(function(){
  const b=$('#kRe');
  if(b)b.onclick=()=>{buzz(10);cloudReclaim();};
})();
