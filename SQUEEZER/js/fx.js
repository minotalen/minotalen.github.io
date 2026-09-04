/* ==================================================================
   fx.js — floating text (labels + slams), spray particles, toasts, shake,
   and the fan-home: banked cards cascade back into the deck
   ================================================================== */
/* one handler owns every floating text on screen: quick labels, payout
   flights, the big slams. Each text leases its spot till it dies — a
   newcomer that would land on a live one is offset a slot upward, so two
   never share a spot at once */
const FTX=[];
function float(t,x,y,c,o){
  if(BG)return;   /* the tab is hidden: the effects are dark */
  o=o||{};
  const big=!!o.big,fly=!big&&/\+\s*[\d,]/.test(t);
  const life=big?820:fly?1750:1060,now=performance.now();
  /* two-line floats (LABEL\n+AMOUNT): the label sits over the amount,
     both centered; the lease sizes to the wider line, the taller box */
  const lines=String(t).split('\n'),two=lines.length>1;
  const len=Math.max(2,...lines.map(l=>l.length));
  for(let i=FTX.length-1;i>=0;i--)if(FTX[i].until<now)FTX.splice(i,1);
  const w=(big?21:9)*len,h=big?26:two?34:14;
  /* the offset queue: climb a slot at a time till the spot is clear
     (a stack deeper than the screen is tall just overlaps — spam case) */
  for(;;){
    const hit=FTX.find(f=>Math.abs(f.x-x)<(f.w+w)/2&&Math.abs(f.y-y)<f.h+h);
    if(!hit||y-hit.h-h<26)break;
    y-=hit.h+h;}
  const d=document.createElement('div');
  d.className='ftx'+(big?' big':'')+(two?' two':'');
  if(two)d.innerHTML=lines.map(l=>`<div>${l}</div>`).join('');
  else d.textContent=t;
  d.style.cssText=`left:${x}px;top:${y}px;color:${c||'var(--ink)'}`;
  /* score gains linger where they landed, then get sucked into the score
     plaque (--fx/--fy carry the delta from the slot they held); plain
     labels (BURNED 3, SNIPPED A 7, …) keep the rise-and-fade */
  if(fly){const pl=$('#hSc')&&$('#hSc').closest('.mny');
    if(pl){const r=pl.getBoundingClientRect();
      d.classList.add('fly');
      d.style.setProperty('--fx',(r.left+r.width/2-x).toFixed(0)+'px');
      d.style.setProperty('--fy',(r.top+r.height/2-y).toFixed(0)+'px');}}
  $('#fx').appendChild(d);
  FTX.push({x,y,w,h,until:now+life});
  setTimeout(()=>d.remove(),life+40);
}
/* the slam is the same system's big face: one anchor at screen center */
function slam(t,c){float(t,innerWidth/2,innerHeight*.34,c,{big:1});}
/* spray: confetti with real physics — launched hot, pulled down by
   gravity, bouncing off the frame's walls, shrinking and fading as they
   age. One shared rAF loop tends every particle on screen */
const SPKS=[];let spkOn=false,spkT=0;
function spray(x,y,c,n){
  if(BG)return;
  for(let i=0;i<(n||16);i++){
    const d=document.createElement('div');d.className='spk';
    const sz=4+Math.random()*3.2,half=sz/2;
    d.style.cssText=`background:${c};width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;`+
      `transform:translate(${(x-half).toFixed(1)}px,${(y-half).toFixed(1)}px)`;
    $('#fx').appendChild(d);
    const a=Math.random()*6.28,v=70+Math.random()*190;
    SPKS.push({d,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-120,
      rot:Math.random()*360,spin:(Math.random()-.5)*900,
      age:0,life:1.25+Math.random()*.7,half});
  }
  if(SPKS.length>260)SPKS.splice(0,SPKS.length-260).forEach(p=>p.d.remove());
  if(!spkOn){spkOn=true;spkT=performance.now();requestAnimationFrame(spkStep);}
}
function spkStep(now){
  const dt=Math.min(.05,(now-spkT)/1000);spkT=now;
  const W=innerWidth,H=innerHeight;
  for(let i=SPKS.length-1;i>=0;i--){
    const p=SPKS[i];p.age+=dt;
    if(p.age>=p.life){p.d.remove();SPKS.splice(i,1);continue;}
    p.vy+=1500*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;
    if(p.x<p.half){p.x=p.half;p.vx=Math.abs(p.vx)*.62;}
    else if(p.x>W-p.half){p.x=W-p.half;p.vx=-Math.abs(p.vx)*.62;}
    if(p.y<p.half){p.y=p.half;p.vy=Math.abs(p.vy)*.62;}
    else if(p.y>H-p.half){p.y=H-p.half;p.vy=-Math.abs(p.vy)*.5;p.vx*=.82;}
    const k=p.age/p.life;
    p.d.style.transform=`translate(${(p.x-p.half).toFixed(1)}px,${(p.y-p.half).toFixed(1)}px) rotate(${p.rot|0}deg) scale(${(1-k*.8).toFixed(3)})`;
    p.d.style.opacity=(1-k*k).toFixed(3);
  }
  if(SPKS.length)requestAnimationFrame(spkStep);else spkOn=false;
}
/* the particle budget rides the payout: spare change gets a spare
   burst, six-figure banks get the storm */
const scoreSpk=s=>Math.round(Math.min(60,12+5.2*Math.log10(1+s)));
/* ---------------- the fan-home ---------------- */
/* a bank pays out, then the table clears itself the way solitaire
   always did: card by card, each launched, arcing under gravity to one
   bounce off the deck line, then tucked in UNDER the stack with a short
   glide. layout() keeps its hands off them mid-flight (see place) */
/* holds are leases, not claims: each live tick renews a short expiry,
   so a tween that dies mid-flight (an exception anywhere in step)
   can never pin a card at a stale pose — layout reclaims it */
const fanBusy=new Map();
const fanHold=(id,ms)=>fanBusy.set(id,performance.now()+ms);
const fanHeld=id=>{const x=fanBusy.get(id);return x!=null&&performance.now()<x;};
function fanHome(starts){
  if(BG)return;   /* hidden: rebuildDeck already filed the cards, layout places them */
  const cards=starts.filter(s=>els[s.id]);
  if(!cards.length)return;
  cards.sort((a,b)=>a.x-b.x);                    /* the sweep reads left to right */
  const stag=Math.max(34,Math.min(85,560/cards.length)),t0=performance.now();
  cards.forEach((c,i)=>{
    c.t0=t0+i*stag;c.e=els[c.id];
    fanHold(c.id,4000);
    /* freeze in place until its turn. rebuildDeck has already filed these
       cards into the deck, so layout() flattened them into rest pose —
       undo that with the face flip muted: no flip plays at launch, the
       card flies face-up and turns face-down only as it tucks under the
       stack */
    c.e.style.transition='none';c.e.style.zIndex=900;
    c.e.style.left='0px';c.e.style.top='0px';   /* flights are transform-positioned */
    const inn=c.e.querySelector('.inn');
    if(inn)inn.style.transition='none';
    c.e.classList.remove('buried','flat','bust');c.e.classList.add('faceup');
    if(inn)inn.style.transition='';
    c.e.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`;
  });
  let fT=t0;
  const step=now=>{
    const dt=Math.min(.04,(now-fT)/1000);fT=now;
    let live=false;
    try{
    for(const c of cards){
      if(c.done)continue;
      if(els[c.id]!==c.e){c.done=true;fanBusy.delete(c.id);continue;} /* rebuilt underneath us */
      fanHold(c.id,1500);
      if(now<c.t0){live=true;continue;}
      if(!c.go){
        c.go=true;
        /* throw strength sized to the drop so every card lands its first
           bounce on the deck regardless of where it sat */
        const g=2600,vy0=-(420+Math.random()*260),drop=Math.max(40,DY-c.y);
        const T=(-vy0+Math.sqrt(vy0*vy0+2*g*drop))/g;
        c.vx=(DX-c.x)/T;c.vy=vy0;c.g=g;
      }
      if(!c.tk){                                  /* flight: one bounce off the deck line */
        c.vy+=c.g*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;
        if(c.x<28){c.x=28;c.vx=Math.abs(c.vx);}
        else if(c.x>FW-28){c.x=FW-28;c.vx=-Math.abs(c.vx);}
        if(c.y>=DY){
          c.y=DY;c.tk=true;c.e.style.zIndex=9;    /* from here it rides under the stack */
          c.vy=Math.abs(c.vy)<110?0:-c.vy*.38;
          c.vx*=.5;                               /* the overshoot the tuck glides back from */
        }
      }else{                                      /* tuck: slide in under the deck */
        c.vy+=c.g*dt;
        c.y=Math.min(DY,c.y+c.vy*dt);
        c.x+=(DX-c.x)*Math.min(1,dt*9);c.vx=(DX-c.x)*9;
        if(c.y+c.vy*dt>=DY){c.x=DX;c.y=DY;c.vy=0;c.vx=0;}
      }
      const rot=Math.max(-14,Math.min(14,c.vx*.03));
      c.e.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
      if(!c.vy&&c.y>=DY-.5){                      /* tucked in: hand it back, deck flinches */
        c.done=true;fanBusy.delete(c.id);
        c.e.style.transition='';layout();deckJiggle();
        continue;
      }
      live=true;
    }
    }catch(err){
      /* a crashed tick must not leave its cards leased forever: release
         them and let layout() put everything back where it belongs */
      console.error('fanHome crashed, releasing its cards',err);
      cards.forEach(c=>{fanBusy.delete(c.id);const e=els[c.id];if(e)e.style.transition='';});
      try{layout();}catch(_){}
      return;
    }
    if(live)requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* the deck flinches as each card slides home — a quick shuffle-jiggle,
   every card in the stack nudged along its own --jx/--jy (the translate
   property composes with the inline transform, so place() never fights it) */
let jigT=0;
function deckJiggle(){
  S.deck.forEach(id=>{
    const e=els[id];
    if(!e||fanHeld(id))return;
    e.style.setProperty('--jx',(Math.random()*6-3).toFixed(1)+'px');
    e.style.setProperty('--jy',(Math.random()*5-2.5).toFixed(1)+'px');
    if(e.classList.contains('jig')){e.classList.remove('jig');void e.offsetWidth;}
    e.classList.add('jig');
  });
  clearTimeout(jigT);
  jigT=setTimeout(()=>S.deck.forEach(id=>{const e=els[id];e&&e.classList.remove('jig');}),280);
}
/* ---------------- the pyramid gather ---------------- */
/* the onboarding sweep: the dealt-out deck shuffles home in a fixed
   order, one card every GAP ms — a short eased glide into the stack
   with a small hop, face-down on arrival, deck flinch per landing.
   Deliberate and countable, where the bank cascade is a throw */
function gatherHome(starts,gap){
  const cards=starts.filter(s=>els[s.id]&&els[s.id]._sx!=null);
  if(!cards.length)return;
  const FLY=280,t0=performance.now();
  cards.forEach((c,i)=>{
    c.t0=t0+i*gap;c.e=els[c.id];c.sx=c.x;c.sy=c.y;c.sr=c.e._sr||0;
    fanHold(c.id,6000);                       /* layout keeps off until landed */
    c.e.style.transition='none';c.e.style.zIndex=900+i;
    c.e.style.left='0px';c.e.style.top='0px'; /* flights are transform-positioned */
    c.e.classList.remove('buried');
    c.e.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) rotate(${c.sr.toFixed(1)}deg)`;
  });
  let fT=t0;
  const step=now=>{
    const dt=Math.min(.04,(now-fT)/1000);fT=now;
    let live=false;
    for(const c of cards){
      if(c.done)continue;
      if(els[c.id]!==c.e){c.done=true;fanBusy.delete(c.id);continue;}  /* rebuilt underneath us */
      fanHold(c.id,1200);
      const t=(now-c.t0)/FLY;
      if(t<0){live=true;continue;}
      if(t>=1){                                 /* landed: back to place(), deck flinches */
        c.done=true;fanBusy.delete(c.id);
        c.e.style.transition='';c.e.style.zIndex=9;
        layout();deckJiggle();
        continue;}
      const k=1-Math.pow(1-t,3);                /* easeOutCubic */
      const x=c.sx+(DX-c.sx)*k,
            y=c.sy+(DY-c.sy)*k-16*Math.sin(Math.PI*t),   /* the hop */
            r=c.sr*(1-k);
      c.e.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`;
      live=true;
    }
    if(live)requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function toast(t,e,art){if(BG)return;const d=document.createElement('div');d.className='ts';
  /* \n splits title from detail: first line bold, the rest a step down.
     art is raw svg standing in for the event icon — a sticker unlock
     announces with the vinyl itself */
  const[a,...rest]=t.split('\n');
  d.innerHTML=((art||e)?`<span class="e">${art||ic(e)}</span>`:'')+
    `<span class="tx"><b>${a}</b>${rest.length?`<i>${rest.join('<br>')}</i>`:''}</span>`;
  $('#toast').appendChild(d);
  setTimeout(()=>{d.style.transition='opacity .3s';d.style.opacity=0;setTimeout(()=>d.remove(),320);},2300+rest.length*700);}
function shake(){if(BG)return;const a=$('#app');a.classList.remove('shake');void a.offsetWidth;a.classList.add('shake');}
/* reward aura: one warm bloom across the felt, one glow on the score plaque */
function warm(){if(BG)return;const g=$('#glowG');if(!g)return;g.classList.remove('on');void g.offsetWidth;g.classList.add('on');}
function scorePulse(){if(BG)return;const m=$('#hSc').closest('.mny');if(!m)return;
  m.classList.remove('pulse');void m.offsetWidth;m.classList.add('pulse');}
/* the heartbeat's visual half: one soft swell of the red wash per beat,
   in lockstep with the thump — peak rides threat × adrenaline × deck size,
   so it fades out with the sound */
function beatFx(k,i){
  if(BG)return;
  const g=$('#glowP');if(!g)return;
  g.style.setProperty('--bi',(.8*k*i).toFixed(3));
  g.classList.remove('beat');void g.offsetWidth;g.classList.add('beat');}
const feltPt=(x,y)=>{const r=$('#felt').getBoundingClientRect();return[r.left+x,r.top+y];};
/* ---- the title screen: SQUEEZER + byline, shown on every load and
   again after an idle minute. The letters land one by one, then each
   borrows the charged-card hover shift verbatim — the two-sine wander,
   breathe and lean a live trigger runs under the cursor (swayFrame,
   table.js) — one phase per letter, like a card's slot in the chain,
   PLUS a slight per-letter amplitude of its own (ttlAmp) and a slow
   up-down bob riding its own depth. Keep the base constants in step
   with swayFrame. The sway's clock starts at a random point in its
   path, so no two showings breathe alike. Behind the text, a loose
   drift of the player's own stickers wanders the felt (ttlFly): they
   repel each other and the deck stack, and fade in and out one by one
   on the letters' own walk. The
   title holds the app until its click: the release waits out the
   entrance (the sequence must be seen), the letters fade out left to
   right, and the opening deals its cards under that fade — the
   tutorial's pyramid, any other showing the stashed board
   (table.js) ---------- */
let ttlRAF=0,ttlBs=null,ttlAmp=null,ttlFly=null,ttlFLast=0,ttlT0=0,ttlKill=0,ttlKillT=0,ttlUp=0,ttlPass=false,ttlR0=Math.random()*1e4,ttlDoc=null,ttlFKeep=null,ttlCapT=0,
    ttlDeckEl=null,ttlDeckCw=0,ttlDeckCh=0;   /* the deck's repel zone */
const TTL_IDLE=60000, /* a minute untouched hands the stage back */
      TTL_FDELAY=110, /* the fade-out walks left to right, a letter at a time */
      TTL_FDUR=500,   /* each letter's own fade — the text lingers */
      TTL_HALF=700,   /* the deal expands while the text is only half gone */
      TTL_FR=90,      /* the drift's repulsion radius off each edge */
      TTL_VMAX=60,    /* its top speed, px/s — soft walls, no slingshots */
      K=400;          /* wall force at zero gap, px/s^2 (quadratic falloff) */
function ttlStep(t){
  if((!ttlBs||!ttlBs[0].isConnected)&&!ttlFly){ttlRAF=0;return;}
  /* the title runs at most ~60fps: slow glides and gentle bobs sample
     identically at half a ProMotion refresh, and a 60Hz panel never
     skips a frame (16.7ms steps clear the gate) — only faster displays
     drop every other tick. Skipped ticks still stamp nothing, so the
     physics dt below integrates the full span */
  if(t-ttlCapT<13){ttlRAF=requestAnimationFrame(ttlStep);return;}
  ttlCapT=t;
  if(ttlBs){   /* the sway rides the letters while they live; the drift
                  below floats the whole time, on the raw clock */
    const st=t+ttlR0;   /* the letter sway starts at a random t — local,
                           never the frame t the drift's dt derives from */
    ttlBs.forEach((b,i)=>{
      const ph=i*2.4,a=ttlAmp&&ttlAmp[i]||{ax:1,ay:1,ar:1,vy:1.6};
      const dx=(Math.sin(st*.0011+ph)*2+Math.sin(st*.0019+ph*1.7)*1)*a.ax*.55;
      const dy=(Math.cos(st*.0008+ph*2.1)*1.2*a.ay
        +Math.sin(st*.0014+ph*.7)*a.vy)*.55;   /* the bob: its own wave, its own depth */
      const dr=(Math.sin(st*.00073+ph)*2.4+Math.sin(st*.00151+ph*2.9)*1.8)*a.ar*.55;
      b.style.transform=`translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${dr.toFixed(2)}deg)`;});
  }
  /* the sticker drift: velocity-driven bodies. Each faces a direction
     that wanders on layered sines (plus a wall-avoid steer), propels
     along its facing at a speed that breathes on its own sine, and
     banks in 3D as it turns. Walls and neighbor collisions apply
     repelling forces to the velocity — billiards in space, no flips.
     The letters need no collision of their own: their paper-colored
     backdrop occludes any sticker that passes behind them */
  if(ttlFly&&ttlFly.length){
    /* real frame delta — ttlFLast is stamped raw (build/resume use
       performance.now, and the sway's ttlR0 offset no longer touches t),
       so the integrator advances every frame the title is up */
    const dt=Math.min(.05,Math.max(0,(t-ttlFLast)/1000));ttlFLast=t;
    const lw=ttlFly[0].lw,W=lw.clientWidth,H=lw.clientHeight;
    /* the deck stack's live spot in layer coords: the pile drifts with
       layout and the 1s re-layouts, so its rect is read every frame */
    let dk=null;
    if(ttlDeckEl&&ttlDeckEl.isConnected){
      const lr=lw.getBoundingClientRect(),sr=ttlDeckEl.getBoundingClientRect();
      if(sr.width||sr.height)
        dk={x:sr.left-lr.left+sr.width/2-ttlDeckCw/2,
            y:sr.top-lr.top+sr.height/2-ttlDeckCh/2,
            w:ttlDeckCw,h:ttlDeckCh};
    }
    /* billiard pairs: slop-and-percent separation (gradual, never a
       snap) plus an impulse along the normal only while approaching,
       and a push-apart field before they even touch — the repulsion
       reads while they are still apart */
    for(let i=0;i<ttlFly.length;i++)for(let j=i+1;j<ttlFly.length;j++){
      const a=ttlFly[i],b=ttlFly[j];
      const dx=b.x-a.x,dy=b.y-a.y,min=(a.sz+b.sz)*.46,dist=Math.hypot(dx,dy);
      if(dist<min&&dist>.01){
        const nx=dx/dist,ny=dy/dist,corr=Math.min(3,Math.max(0,min-dist-2)*.25);
        a.x-=nx*corr*.5;a.y-=ny*corr*.5;
        b.x+=nx*corr*.5;b.y+=ny*corr*.5;
        const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(vn<0){
          a.vx+=nx*vn*.4;a.vy+=ny*vn*.4;
          b.vx-=nx*vn*.4;b.vy-=ny*vn*.4;
        }
      }else if(dist>.01){
        const R=(a.sz+b.sz)*.7;
        if(dist<R){
          const q=1-dist/R,f=80*q*q;
          a.vx-=dx/dist*f*dt;a.vy-=dy/dist*f*dt;
          b.vx+=dx/dist*f*dt;b.vy+=dy/dist*f*dt;
        }
      }
    }
    for(const f of ttlFly){
      /* facing: layered sines + a steer that turns away from walls
         (slow when far, faster as the gap closes) */
      const th=f.th0+.55*Math.sin(t*f.w1+f.p1)+.35*Math.sin(t*f.w2+f.p2)+f.steer;
      const spd=f.sp0*(1+.45*Math.sin(t*f.ws+f.ps));   /* breathing thrust */
      f.vx+=(Math.cos(th)*spd-f.vx)*Math.min(1,8*dt);
      f.vy+=(Math.sin(th)*spd-f.vy)*Math.min(1,8*dt);
      /* soft walls */
      let ax=0,ay=0,near=null,gap=1e9;
      const push=(d,fx,fy,dir)=>{
        if(d<TTL_FR){
          const q=1-Math.max(0,d)/TTL_FR;
          ax+=fx*K*q*q;ay+=fy*K*q*q;
          if(d<gap){gap=d;near=dir;}
        }
      };
      push(f.x,1,0,'l');push(W-f.sz-f.x,-1,0,'r');
      push(f.y,0,1,'t');push(H-f.sz-f.y,0,-1,'b');
      /* the deck repels with the same field, measured off the pile's
         rect (closest point; dead-center falls back to rect center) */
      if(dk){
        const px=f.x+f.sz/2,py=f.y+f.sz/2,
              cx=Math.max(dk.x,Math.min(px,dk.x+dk.w)),
              cy=Math.max(dk.y,Math.min(py,dk.y+dk.h));
        let ddx=px-cx,ddy=py-cy,dd=Math.hypot(ddx,ddy);
        if(dd<.01){ddx=px-(dk.x+dk.w/2);ddy=py-(dk.y+dk.h/2);dd=Math.hypot(ddx,ddy)||1;}
        if(dd<TTL_FR){
          const q=1-dd/TTL_FR;
          ax+=ddx/dd*K*q*q;ay+=ddy/dd*K*q*q;
        }
      }
      f.vx+=ax*dt;f.vy+=ay*dt;
      /* near a wall they calm down: less thrust, less hover buzz */
      const cw=near?1-Math.max(0,gap)/TTL_FR:0;
      if(cw>0){const dm=1-.18*cw;f.vx*=dm;f.vy*=dm;}
      const spd2=Math.hypot(f.vx,f.vy);
      if(spd2>TTL_VMAX){f.vx*=TTL_VMAX/spd2;f.vy*=TTL_VMAX/spd2;}
      f.x=Math.max(0,Math.min(W-f.sz,f.x+f.vx*dt));
      f.y=Math.max(0,Math.min(H-f.sz,f.y+f.vy*dt));
      /* the steer turns the facing toward the field center, harder the
         closer a wall is, easing back out in open space — the slow
         banked turn away: the wall push sheds speed while the facing
         swings, so they glide around, never bounce */
      const c=near?1-Math.max(0,gap)/TTL_FR:0;
      let sTarget=0;
      if(near){
        const want=Math.atan2(H/2-(f.y+f.sz/2),W/2-(f.x+f.sz/2));
        let d=want-th;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
        sTarget=Math.max(-.9,Math.min(.9,d))*(.4+.6*c);
      }
      f.steer+=(sTarget-f.steer)*Math.min(1,(0.8+3.2*c)*dt);
      /* banking: the 3D tilt follows the body — turn rate leans it,
         the nearest wall adds a veer-off tilt */
      const dTh=(th-f.prevTh)/dt;f.prevTh=th;
      f.bank+=((Math.max(-40,Math.min(40,dTh*26)))-f.bank)*Math.min(1,5*dt);
      let ty=0,tp=0;
      if(near==='l')ty=f.maxT;else if(near==='r')ty=-f.maxT;
      if(near==='t')tp=-f.maxT;else if(near==='b')tp=f.maxT;
      if(c){ty*=.4+.6*c;tp*=.4+.6*c;}
      f.yaw+=(ty-f.yaw)*Math.min(1,(0.8+3.4*c)*dt);
      f.pitch+=(tp-f.pitch)*Math.min(1,(0.8+3.4*c)*dt);
      const wy=f.yaw+f.bank*.5+3*Math.sin(t*f.w2*.7+f.p2);
      const wp=f.pitch+f.bank*.3+2*Math.sin(t*f.w1*.8+f.p1);
      f.t3.style.transform=`rotateX(${wp.toFixed(2)}deg) rotateY(${wy.toFixed(2)}deg) rotate(${(th*20).toFixed(2)}deg)`;
      f.el.style.transform=`translate3d(${f.x.toFixed(1)}px,${f.y.toFixed(1)}px,0)`;
    }
  }
  ttlRAF=requestAnimationFrame(ttlStep);
}
/* the deck's repel zone: the slot's anchor plus one card footprint and
   the spawn-clearance pad, cached per showing (the dims only move with
   a rescale; the position is read live every frame in ttlStep) */
function ttlDeckSet(felt){
  ttlDeckEl=document.getElementById('slotD');
  if(!ttlDeckEl){ttlDeckCw=ttlDeckCh=0;return;}
  const cs=getComputedStyle(felt);
  ttlDeckCw=(parseFloat(cs.getPropertyValue('--cw'))||54)+16;
  ttlDeckCh=(parseFloat(cs.getPropertyValue('--ch'))||76)+16;
}
/* the drift cast: up to 12 of the player's own stickers, every key used
   at most once — duplicates never tease. The layer lives in the felt,
   under the cards: bound to the table, visible under the title text */
function ttlFlyBuild(){
  /* the cast survives between showings: the same stickers in the same
     spots sink with a deal and rise again with the next title, so a
     re-show never reads as the cast teleporting across the felt */
  if(ttlFKeep&&ttlFKeep.fs.length){
    const{lw,fs}=ttlFKeep;
    if(lw.isConnected&&fs[0].lw===lw){
      /* measure visible, never inside display:none: a hidden layer reads
         0x0 and the clamp below piles the whole cast into one corner */
      lw.style.display='';
      void lw.offsetWidth;
      const W=lw.clientWidth,H=lw.clientHeight;
      if(W&&H){
        ttlDeckSet(lw.parentElement);
        for(const s of fs){
          s.x=Math.max(0,Math.min(W-s.sz,s.x));
          s.y=Math.max(0,Math.min(H-s.sz,s.y));
        }
        ttlFly=fs;
        ttlFLast=performance.now();
        return;
      }
      lw.style.display='none';   /* felt hidden: no room to resume here */
    }
    ttlFKeep=null;
  }
  const old=document.getElementById('ttlF');
  if(old)old.remove();
  ttlFly=null;
  const felt=$('#felt');if(!felt||!felt.clientWidth)return;
  const pool=[...new Set(S.cards.map(c=>c.stk).filter(Boolean))];
  if(!pool.length)return;
  const lw=document.createElement('div');lw.id='ttlF';
  felt.insertBefore(lw,felt.firstChild);
  ttlDeckSet(felt);
  /* spawn positions reject the deck stack and the letter row: a sticker
     born under either hides, then reads as materialising out from
     beneath them. Only direct occlusion is rejected — close is fine */
  const zone=el=>{const r=el.getBoundingClientRect(),l=lw.getBoundingClientRect();
    return{x:r.left-l.left,y:r.top-l.top,w:r.width,h:r.height};};
  const avoid=[];
  const tt=document.getElementById('ttlT');
  if(tt)avoid.push(zone(tt));
  const sd=document.getElementById('slotD');
  if(sd){const cs=getComputedStyle(felt),z=zone(sd);
    const cw=(parseFloat(cs.getPropertyValue('--cw'))||54)+16,
          ch=(parseFloat(cs.getPropertyValue('--ch'))||76)+16;
    avoid.push({x:z.x+z.w/2-cw/2,y:z.y+z.h/2-ch/2,w:cw,h:ch});}
  const clear=(x,y,s)=>avoid.every(z=>x+s<=z.x||x>=z.x+z.w||y+s<=z.y||y>=z.y+z.h);
  const target=Math.min(pool.length,5+Math.floor(Math.random()*8));
  const bag=pool.slice().sort(()=>Math.random()-.5);
  for(let i=0;i<target;i++){
    const d=document.createElement('div');d.className='tfl';
    const sz=38+Math.random()*16;
    /* the box is real: the physics treats (x,y) as top-left, so the
       slab needs its own width/height, not a collapsed 0x0 shim */
    d.style.width=sz+'px';d.style.height=sz+'px';
    d.style.setProperty('--cw',(sz/.4725).toFixed(0)+'px');
    /* a real 3D slab: glyph front, vinyl backing, preserve-3d between */
    d.innerHTML=`<div class="t3"><div class="tb"></div><div class="tf"></div></div>`;
    d.querySelector('.tf').innerHTML=stickerHTML(bag[i],'fly'+i);
    const s=d.querySelector('.stk');
    if(s){s.style.left='50%';s.style.top='50%';}
    lw.appendChild(d);
    let x,y,a=0;
    do{x=sz+Math.random()*(felt.clientWidth-sz*2);
       y=sz+Math.random()*(felt.clientHeight-sz*2);}
    while(!clear(x,y,sz)&&++a<50);
    ttlFly=ttlFly||[];
    ttlFly.push({el:d,t3:d.firstChild,lw,sz,x,y,
      vx:0,vy:0,
      th0:Math.random()*6.28,                 /* base facing */
      sp0:(26+Math.random()*16)*.55,          /* base thrust, px/s — gentle float */
      ws:.0005+Math.random()*.0006,ps:Math.random()*6.28,  /* the speed's sine */
      steer:0,prevTh:0,bank:0,yaw:0,pitch:0,maxT:26+Math.random()*14,
      w1:.0004+Math.random()*.0004,w2:.0008+Math.random()*.0005,
      p1:Math.random()*6.28,p2:Math.random()*6.28});
  }
  ttlFLast=performance.now();
  ttlFKeep={lw,fs:ttlFly};
}
function ttlOn(pass){
  ttlPass=!!pass;
  const box=$('#ttl');if(!box)return;
  ttlBs=[...box.querySelectorAll('#ttlT b')];
  /* each letter a slightly different amplitude on every axis, and its
     own bob depth — kept gentle */
  ttlAmp=ttlBs.map(()=>({
    ax:.85+Math.random()*.3,ay:.85+Math.random()*.3,ar:.85+Math.random()*.3,
    vy:.8+Math.random()*1.2}));
  /* the landing replays on every showing: clear the previous fade's
     inline opacity, reset, then re-run with the per-letter delays.
     Letters land as the finished ink glyph — no outline stage on the
     way in (that vocabulary belongs to the hide, which drains to the
     outline before fading) */
  const again=el=>{el.style.animation='none';void el.offsetWidth;el.style.animation='';};
  ttlBs.forEach((b,i)=>{
    b.style.transition='none';b.style.opacity='';
    b.style.color='var(--ink)';b.style.webkitTextStrokeColor='var(--ink)';
    again(b);b.style.animationDelay=(i*110)+'ms';});
  const s=box.querySelector('#ttlS');
  if(s){s.style.transition='';s.style.opacity='';again(s);s.style.animationDelay=(ttlBs.length*110+140)+'ms';}
  ttlR0=Math.random()*1e4;
  ttlT0=performance.now();ttlKill=0;ttlUp=1;
  box.classList.remove('gone');
  box.classList.add('out');   /* the pads start dropped, lift below with the letters */
  /* the tutorial's opening passes clicks through to the felt (pyrTap);
     every other showing captures its own dismissal */
  box.classList.toggle('live',!ttlPass);
  box.onpointerdown=()=>{if(!ttlPass)ttlClick();};
  /* the box is absolute inside #app, so on desktop it only spans the
     column and taps on the letterboxed paper die on body. Dismissal
     also rides a document-capture tap; pass mode never arms it (the
     felt's pyrTap owns those). Capture beats any stopPropagation */
  if(ttlDoc)document.removeEventListener('pointerdown',ttlDoc,true);
  ttlDoc=ttlPass?null:()=>ttlClick();
  if(ttlDoc)document.addEventListener('pointerdown',ttlDoc,true);
  box.classList.add('on');
  /* the drift cast lives in the felt: build it once the box shows */
  ttlFlyBuild();
  /* the cast fades in one by one on the text's own clock: each sticker
     fades for a letter's 500ms, the walk swept left to right so the
     first starts with the first letter and the last lands with the
     byline — the whole walk starts and ends with the text's */
  if(ttlFly&&ttlFly.length&&ttlBs){
    const lw=ttlFly[0].lw,fs=ttlFly.slice().sort((a,b)=>a.x-b.x);
    for(const s of fs){s.el.style.transition='none';s.el.style.opacity=0;}
    lw.style.transition='none';lw.style.opacity=1;
    void lw.offsetWidth;
    const end=ttlBs.length*110+140+450,
          step=fs.length>1?(end-TTL_FDUR)/(fs.length-1):0;
    fs.forEach((s,i)=>{
      s.el.style.transition=`opacity ${TTL_FDUR}ms ease ${Math.round(i*step)}ms`;
      s.el.style.opacity=1;});
  }
  if(!ttlRAF)ttlRAF=requestAnimationFrame(ttlStep);
  /* the pad lift needs the dropped state to have rendered first, or the
     transition never arms (same two-flush rule as the letter fades) */
  requestAnimationFrame(()=>{if(!ttlKill&&box.isConnected)box.classList.remove('out');});
}
/* the pyramid deal (table.js), the board deal and the coach bubble
   (tut.js) gate on this: the title gets the stage to itself first */
function ttlAlive(){return !!ttlUp;}
/* the tap the title was waiting for; one that lands while it's already
   dying queues the pyramid's sweep instead of being lost */
function ttlClick(){
  if(ttlKill){if(ttlPass)pyrQueue=true;return;}
  ttlOff();
}
function ttlOff(){
  const box=$('#ttl');
  if(!box||!ttlBs||ttlKill)return;
  biFirst('go');   /* funnel step 0: the first-input moment, once per player */
  ttlKill=1;
  clearTimeout(ttlKillT);
  ttlKillT=setTimeout(()=>{
    const b=$('#ttl');if(!b)return;
    ttlUp=0;   /* gates lift at once: the deal runs under the letter fade */
    b.classList.remove('live');b.onpointerdown=null;
    if(ttlDoc){document.removeEventListener('pointerdown',ttlDoc,true);ttlDoc=null;}
    $('#felt').classList.remove('ttl');   /* the table returns with the fade */
    /* the letters fade out as the finished ink glyph, left to right,
       the byline last, the sway still breathing under them — no outline
       stage on the way out either. Their entrance animations must stop
       owning opacity, and that clear must reach a style recalc BEFORE
       the fade arms: Chrome refuses to start a transition for a
       property an animation held in the before-change style, so one
       combined flush just snaps. The byline's ttlin has the same trap */
    const bs=ttlBs||[];
    const s=b.querySelector('#ttlS');
    bs.forEach(el=>{el.style.animation='none';});
    if(s)s.style.animation='none';
    void box.offsetWidth;
    /* the pads die with their lines: .out points each pad's transition
       at its own wave (title across the whole walk, byline inside it) */
    box.classList.add('out');
    bs.forEach((el,i)=>{
      el.style.transition=`opacity ${TTL_FDUR}ms ease ${i*TTL_FDELAY}ms`;
      el.style.opacity=0;});
    if(s){s.style.transition=`opacity ${TTL_FDUR}ms ease ${bs.length*TTL_FDELAY+80}ms`;s.style.opacity=0;}
    /* the drift rides the same wave out: one by one, left to right,
       the first goes with the first letter and the last is gone with
       the byline. The float keeps running under the fade until the
       deal lands and ttlDriftFade sinks the layer for good */
    if(ttlFly&&ttlFly.length){
      const fs=ttlFly.slice().sort((a,b)=>a.x-b.x),
            end=bs.length*TTL_FDELAY+80+TTL_FDUR,
            step=fs.length>1?(end-TTL_FDUR)/(fs.length-1):0;
      fs.forEach((f,i)=>{
        f.el.style.transition=`opacity ${TTL_FDUR}ms ease ${Math.round(i*step)}ms`;
        f.el.style.opacity=0;});
    }
    /* arm the intro now, deal it at halfway: no draw slips through the
       crossfade, and the pyramid grows out of the dying text. The drift
       is already bound to the felt, so it just keeps floating under the
       cards while they come out */
    if(ttlPass)pyrArm();else if(dealIds().length)boardDealing=true;
    setTimeout(()=>{
      if(ttlPass)pyrDealGo();else boardDeal();
    },TTL_HALF);
    ttlKillT=setTimeout(()=>{
      ttlBs=null;ttlAmp=null;
      const bb=$('#ttl');if(bb)bb.classList.add('gone');
      /* boot's offline report waited here rather than share the screen
         with the title (the modal sits under it in z) */
      if(welPend){const o=welPend;welPend=null;openWelcome(o);}
    },bs.length*TTL_FDELAY+TTL_FDUR+300);
  },0);   /* a click cancels the entrance outright: mid-landing letters
             snap to their ink pose and the L-to-R fade starts at once */
}
/* the under-card drift's curtain: the intro is done, the stickers sink
   away. Called when the pyramid sweeps home or the board has dealt —
   and by Tabs.go when the player leaves the play view, since the drift
   belongs to the table and hides with it */
function ttlDriftFade(){
  if(!ttlFly)return;
  const lw=ttlFly[0].lw,f=ttlFly;
  ttlFly=null;   /* freeze in place while they sink */
  lw.style.transition='opacity .9s ease';
  lw.style.opacity=0;
  ttlFKeep={lw,fs:f};
  /* stay in the DOM, hidden, so the next showing resumes the same cast */
  setTimeout(()=>{if(ttlFKeep&&ttlFKeep.lw===lw)lw.style.display='none';},950);
}
/* one idle minute hands the stage back: the title fades in while the
   board sweeps home into the deck; once the sweep has landed the table
   goes bare (screensaver) until the next click deals it out */
function ttlIdle(){
  ttlOn(false);
  boardStash(true);
  setTimeout(()=>{if(ttlUp)$('#felt').classList.add('ttl');},1900);
}
/* ---- the card back hatch: long sine stripes at 45deg, phase-offset
   per stripe so the crests cascade. The SVG is painted ONCE into
   --bkpat and sized to the ::after layer's oversized box (inset:-70px
   in table.css); the flow itself is that layer's transform translate —
   will-change keeps it a frozen raster the GPU slides, so zoomed-out
   cards never re-alias the lines frame to frame (that re-raster was the
   flicker). The sine field is periodic over the keyframe's exact shift,
   so the CSS loop never pops. Runs again only on a box size change ---- */
let bkEl=null,bkBox='',bkRO=null,bkObsEl=null;
function bkWave(){
  if(!bkEl||!bkEl.isConnected)bkEl=document.querySelector('.fc.bk');
  if(!bkEl)return;
  /* size changes arrive by observer (window, desk scale, hand count),
     not the old 120ms poll; --bkpat lives on the root, so a same-size
     replacement back needs nothing — the frame loop's 1s tick re-runs
     this as the identity catch-up when the DOM hands us a fresh one */
  if(bkObsEl!==bkEl){bkObsEl=bkEl;
    if(typeof ResizeObserver!=='undefined'){
      if(!bkRO)bkRO=new ResizeObserver(()=>bkWave());
      bkRO.disconnect();bkRO.observe(bkEl);}}
  const cs=getComputedStyle(bkEl,'::after'),w=parseFloat(cs.width),h=parseFloat(cs.height);
  if(!(w>4&&h>4))return;
  const key=w.toFixed(1)+'x'+h.toFixed(1);
  if(key===bkBox)return;
  bkBox=key;
  const SP=12,TRAVEL=120,                 /* stripe pitch vs per-axis loop travel */
    LAM=TRAVEL*Math.SQRT2,HALF=LAM/2,     /* wave: one travel up the 45deg line */
    W=w+TRAVEL,H=h+TRAVEL,                /* matches background-size 100%+120px */
    amp=3,
    D=(W+H)/(2*Math.SQRT2),XL=D+2,n=Math.ceil(XL*2/HALF),st=XL*2/n;
  let d='';
  for(let p=-D-amp-SP;p<=D+amp+SP;p+=SP){
    const k=p*.055,o=s=>amp*Math.sin(s*2*Math.PI/LAM+k);
    d+=`M${(-XL).toFixed(1)} ${p.toFixed(1)}`;
    for(let j=0;j<n;j++){
      const s0=-XL+j*st,s1=s0+st,m=s0+st/2;
      /* quadratic whose midpoint lands on the true sine sample — the
         control rides 2*mid minus the endpoint average */
      d+=`Q${m.toFixed(1)} ${(p+2*o(m)-o(s0)-o(s1)).toFixed(2)} ${s1.toFixed(1)} ${(p+o(s1)).toFixed(2)}`;
    }
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">`
    +`<g transform="translate(${(W/2).toFixed(1)} ${(H/2).toFixed(1)}) rotate(-45)">`
    +`<path d="${d}" fill="none" stroke="rgba(21,20,14,.17)" stroke-width="2.5"/></g></svg>`;
  document.documentElement.style.setProperty('--bkpat',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
