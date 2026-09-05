/* ==================================================================
   sw.js — the PWA worker: install + offline shell.

   What it caches: same-origin GETs of static files only. The ?v= sweep
   makes asset URLs immutable per deploy, so cache-first is exact for
   them; CACHE rides the sweep too (a bump starts a fresh cache, the
   old one is dropped on activate). Navigations are network-first: a
   live deploy's index.html always wins while online, the cached shell
   answers when offline.

   What it never touches: everything else. The cloud save API and the
   BI beacons are POSTs to zahlenzellen.io (cross-origin, skipped by
   the origin check); SKIP also guards the API paths for the day the
   game itself sits on that box under /squeezer/.
   ================================================================== */
const CACHE='squeezer-v248';
const SKIP=/\/(cs|bi)(\/|$)|\/saves\.json$/;
const STATIC=/\.(css|mjs|js|json|webmanifest|png|svg|jpe?g|webp|gif|ico|woff2?|ttf|otf|html?)$/i;

self.addEventListener('install',e=>{
  e.waitUntil(warm().then(()=>self.skipWaiting()));
});

/* Precache the shell by reading what index.html actually references
   (href=/src= attrs, then url(...) inside the stylesheets), so the
   cache list can never drift from the markup the sweep produces. A
   missing file skips quietly: install never strands on one dead ref */
async function warm(){
  const c=await caches.open(CACHE);
  const done=new Set();
  const grab=async(url)=>{
    if(done.has(url))return; done.add(url);
    try{
      const r=await fetch(new Request(url,{cache:'reload'}));
      if(!r||!r.ok)return;
      await c.put(url,r.clone());
      if(/\.css$/i.test(new URL(url,self.location.href).pathname)){
        const css=await r.clone().text();
        for(const m of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)){
          const ref=m[2];
          if(!ref||ref.startsWith('data:'))continue;
          await grab(new URL(ref,url).href);
        }
      }
    }catch(_){}
  };
  await grab(new URL('./',self.registration.scope).href);
  const html=await (await c.match('./')).text();
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const u=m[1];
    if(/^(https?:|data:|#)/.test(u))continue;
    await grab(new URL(u,self.registration.scope).href);
  }
}

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(SKIP.test(url.pathname))return;
  if(req.mode!=='navigate'&&!STATIC.test(url.pathname))return;
  e.respondWith(req.mode==='navigate'?netFirst(req):cacheFirst(req));
});

async function netFirst(req){
  try{
    const r=await fetch(req);
    if(r&&r.ok){const c=await caches.open(CACHE);c.put(req,r.clone());}
    return r;
  }catch(_){
    const c=await caches.open(CACHE);
    return (await c.match(req,{ignoreSearch:true}))
      ||(await c.match('./',{ignoreSearch:true}))
      ||Response.error();
  }
}

async function cacheFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req);
  if(hit)return hit;
  const r=await fetch(req);
  if(r&&r.ok)c.put(req,r.clone());
  return r;
}
