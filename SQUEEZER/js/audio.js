/* ==================================================================
   audio.js — SFX engine: dry, mechanical, low-passed. No jingles.
   Brown-ish noise on a shared lowpass bus + compressor; every voice
   gets its own gentle lowpass so nothing is bright or casino-ey.
   The organic pass: no two plays of a voice land identical (J nudges
   pitch, level and length a hair each time), the cards sing — draw and
   land pitch on a D blues scale (NOTE, card 1 the root, card 20 three
   octaves up), so a run of draws improvises instead of repeating — and
   every sticker owns a signature (stk): a family timbre from its
   STKTYPE, a seeded interval and register hashed from its key the way
   the vinyl hues are, shaped by the event (draw/act/arm/bank/bust).
   A live-voice gate keeps bursts honest: garnish drops out first, the
   table's own physics only ever thins.
   ================================================================== */
const SFX = (() => {
  let ac = null, nb = null, bus = null, nv = 0;
  const CAP = 30;
  function ctx(){
    if(!ac){
      ac = new (window.AudioContext||window.webkitAudioContext)();
      nb = ac.createBuffer(1, ac.sampleRate*.5, ac.sampleRate);
      const d = nb.getChannelData(0); let last = 0;
      for(let i=0;i<d.length;i++){const w=Math.random()*2-1; last=(last+.04*w)/1.04; d[i]=last*3.2;}
      const lp = ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=5200; lp.Q.value=.4;
      const g = ac.createGain(); g.gain.value=.55;
      let node = lp;
      if(ac.createDynamicsCompressor){
        const cp = ac.createDynamicsCompressor();
        cp.threshold.value=-20; cp.ratio.value=6; cp.attack.value=.003; cp.release.value=.12;
        lp.connect(cp); cp.connect(g);
      } else lp.connect(g);
      g.connect(ac.destination); bus = lp;
    }
    if(ac.state==='suspended') ac.resume();
    return ac;
  }
  const on = ()=>S && S.set.sound;
  /* the live-voice gate: nv counts sources started and not yet ended.
     Under CAP nothing changes. Past it the garnish (core=0 — sticker
     motifs) goes silent first; the physics (core=1) only thins, so a
     stack of autos dealing into a bank never turns to mush */
  function gate(core){
    if(nv<CAP)return 1;
    if(!core)return 0;
    return nv<CAP*1.6?.35:.15;
  }
  function osc(f,dt,dur,ty,vol,f2,cut){
    const a=ctx(),t=a.currentTime+dt,o=a.createOscillator(),g=a.createGain(),f3=a.createBiquadFilter();
    f3.type='lowpass'; f3.frequency.value=cut||2400;
    o.type=ty||'sine'; o.frequency.setValueAtTime(f,t);
    if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.003);
    g.gain.exponentialRampToValueAtTime(.0005,t+dur);
    o.connect(f3); f3.connect(g); g.connect(bus); o.start(t); o.stop(t+dur+.02);
    nv++; o.onended=()=>{nv=Math.max(0,nv-1);};
  }
  function nse(dt,dur,vol,f1,f2,q,ty){
    const a=ctx(),t=a.currentTime+dt,s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();
    s.buffer=nb; s.playbackRate.value=.8+Math.random()*.4;
    f.type=ty||'lowpass'; f.frequency.setValueAtTime(f1,t); f.Q.value=q||.7;
    if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0004,t+dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t+dur+.02);
    nv++; s.onended=()=>{nv=Math.max(0,nv-1);};
  }
  /* hyperanalog: no two presses sound alike — every voice detunes,
     levels and lands a hair differently, the way a real hand never
     peels the same sticker twice */
  const J=(p)=>1+(Math.random()*2-1)*p;
  /* the house scale: D blues (D F G Ab A C) stacked three octaves, one
     degree per card value. Every pitched voice in the engine reads it,
     so the table improvises in one key — a landing answers its draw,
     a sticker motif harmonizes with the card it rides */
  const SCALE=[0,3,5,6,7,10,12,15,17,18,19,22,24,27,29,30,31,34,36,39];
  const RT=73.416;   /* D2 */
  const NOTE=v=>RT*Math.pow(2,SCALE[Math.max(0,Math.min(19,(Math.round(v)||1)-1))]/12);
  /* ---- sticker signatures ----
     One recipe per sticker, hashed from its key (FNV, like the vinyl
     seeding): a signature interval from the scale's own pool and a
     fallback register for effects with no card in hand. The timbre is
     the sticker's family (STKTYPE): bells hold value, plucks pay, pads
     aura, guards insure, ticks trick, knocks work the piles. Same key,
     same voice, every time */
  const SIV=[3,5,6,7,10,12,15], SGN={};
  const shash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  function sgn(k){
    let r=SGN[k]; if(r)return r;
    const h=shash(k+'~sfx');
    r={fam:(typeof STKTYPE!=='undefined'&&STKTYPE[k])||'value',
       iv:SIV[h%7], deg:6+(h>>>7)%9, dn:!!(h>>>11&1)};
    return SGN[k]=r;
  }
  /* the motif renderer: family gives the instrument, ev the phrasing —
     draw a single struck note, act a two-step figure, arm a tick and a
     rise, bank the fullest chord the family has, bust the same figure
     dropped low and capped dark. Roots ride the card's own note when
     the caller knows it, so the identity harmonizes with the landing */
  function stk(k,ev,v){
    if(!on())return; const g=gate(0); if(!g)return;
    const s=sgn(k),F=s.fam,iv=Math.pow(2,s.iv/12),
          f=NOTE(v||s.deg)*(F==='insurance'||F==='out'?.5:1)*J(.006),
          V=.052*g;
    if(ev==='bust'){                            /* the dark read: low, flat, capped */
      osc(0,f*(s.dn?.5:.75),.42*J(.15),'sine',V*1.3,f*.5,520);
      osc(.03*J(.3),f*(s.dn?.5:.75)*iv,.34,'sine',V*.7,f*.72*iv,700);
      nse(0,.06,V*.3,700*J(.15),240,.7); return;}
    if(F==='trick'){
      nse(0,.012,V*.5,3400*J(.1),2400,3,'bandpass');
      osc(0,f,.05*J(.2),'square',V*.8,f*.96,1300);
      if(ev!=='draw')osc(.055*J(.2),f*(s.dn?1/iv:iv),.05,'square',V*.6,f*(s.dn?1/iv:iv)*.96,1300);
      if(ev==='bank')osc(.11,f*iv*iv,.08,'square',V*.4,f*iv*iv,1500);
      return;}
    if(F==='out'){
      osc(0,f,.09*J(.2),'sine',V*1.4,f*.72,720);
      nse(.002,.03*J(.3),V*.8,1200*J(.12),520,.8);
      if(ev!=='draw'){osc(.06*J(.25),f*(s.dn?1/iv:iv),.09,'sine',V*1.1,f*(s.dn?1/iv:iv)*.72,720);
        nse(.062,.028,V*.6,1400*J(.1),600,.8);}
      if(ev==='bank')osc(.12,f*2,.12*J(.2),'sine',V*.5,f*2,1200);
      return;}
    if(F==='insurance'){
      osc(0,f,.42*J(.15),'sine',V*1.2,f*.96,620);
      osc(.03*J(.3),f*1.5,.36,'sine',V*.55,f*1.5,820);
      if(ev==='bank'||ev==='act')osc(.09,f*2,.3,'sine',V*.35,f*2,1000);
      return;}
    if(F==='aura'){
      osc(0,f*J(.003),.55,'sine',V*.7,f,900);
      osc(0,f*1.0045,.55,'sine',V*.7,f*1.0045,900);
      osc(.06*J(.3),f*iv,.5,'sine',V*.4,f*iv,1100); return;}
    /* value = bell, payer/out-pay = pluck, table = chime */
    const w=F==='payer'||F==='out-pay'||F==='table'?'triangle':'sine',
          d=(F==='payer'||F==='out-pay'?.16:F==='table'?.24:.3)*J(.2);
    osc(0,f,d,w,V,w==='triangle'?f*.94:f*.98,1900);
    if(w==='sine')osc(0,f*2.76,.1,'sine',V*.35,f*2.76,3000);   /* the bell's own ring */
    else nse(.004,.05,V*.3,5200*J(.08),2600,2,'bandpass');     /* the coin's sparkle */
    if(ev!=='draw')osc(.07*J(.25),f*(s.dn?1/iv:iv),d*.9,w,V*.72,f*(s.dn?1/iv:iv)*(w==='triangle'?.94:.98),2100);
    if(ev==='bank'){osc(.14*J(.2),f*2,d*1.5,w,V*.5,f*2,2400);
      nse(.14,.06,V*.28,6000*J(.06),3200,2.4,'bandpass');}
  }
  return {
    /* card sliding off the stock — the flick whistles its value two
       octaves up, under the paper */
    draw(v){ if(!on())return; const g=gate(1);
      nse(0,.085*J(.25),.16*g,3400*J(.08),700*J(.15),.6);
      if(v)osc(.004*J(.5),NOTE(v)*4*J(.008),.028*J(.3),'triangle',.032*g,NOTE(v)*4*.9,2200); },
    /* card meeting the table: the thock sings the card's note, high
       cards tapering quieter so a 20 tinkles where a 1 thuds */
    land(v,n){ if(!on())return; const g=gate(1),
        f=(v?NOTE(v):110)*J(.008), vs=.13*Math.min(1,180/f+.45);
      osc(0,f,.078*J(.2),'sine',vs*g*(1+Math.min(n||1,8)*.02),f*.92,900);
      osc(0,f*2,.03,'sine',.028*g,f*2,1400);
      nse(0,.045*J(.3),.09*g,420*J(.15),180,.5); },
    /* a card lifting into a flight — the airy swell under the glide */
    slide(){ if(!on())return; const g=gate(1);
      nse(0,.16*J(.2),.05*g,900*J(.15),2400*J(.1),.8); },
    detent(){ if(!on())return; nse(0,.016*J(.2),.10,3000*J(.1),2200,3,'bandpass'); },
    stamp(){ if(!on())return;
      osc(132*J(.05),0,.09,'square',.10,88,620); nse(.004,.05,.13,900,300,.6); },
    /* vinyl peeling off its backing paper: sticky crackle ticks spread
       across the slow resistance, then a longer squeak as the adhesive
       finally lets go */
    peel(){ if(!on())return;
      nse(0,.05*J(.3),.09*J(.25),2600*J(.09),1400*J(.1),2.2,'bandpass');
      nse(.16*J(.25),.05*J(.3),.09*J(.25),2200*J(.09),1150*J(.1),2.2,'bandpass');
      nse(.34*J(.25),.08*J(.25),.11*J(.25),1850*J(.09),850*J(.1),2,'bandpass');
      osc(1150*J(.08),.46*J(.3),.2*J(.2),'triangle',.026*J(.3),640*J(.1),2200); },
    /* the slap: sub thump, a bright snap of vinyl meeting card, a
       smoothing squeak and a soft rub as it settles */
    slap(){ if(!on())return;
      osc(118*J(.07),0,.13*J(.2),'sine',.17*J(.25),42*J(.1),420*J(.1));
      nse(.002,.06*J(.3),.2*J(.25),1400*J(.12),260*J(.2),.55);
      osc(96*J(.07),.012*J(.3),.16*J(.2),'square',.05*J(.3),58*J(.1),520*J(.1));
      osc(760*J(.06),.05*J(.2),.1*J(.25),'triangle',.02*J(.3),290*J(.1),1800);
      nse(.1*J(.2),.15*J(.25),.05*J(.25),900*J(.12),300*J(.15),.7); },
    /* the one-in-a-hundred tear: the vinyl takes the card's surface
       with it — a bright ripping crackle over a soft paper flap */
    rip(){ if(!on())return;
      nse(0,.18*J(.2),.22*J(.2),5200*J(.1),500*J(.2),.8);
      nse(.02*J(.5),.06*J(.3),.12*J(.3),3600*J(.15),900*J(.2),2,'bandpass');
      nse(.09*J(.4),.05*J(.3),.10*J(.3),2800*J(.15),700*J(.2),2,'bandpass');
      osc(74*J(.1),.01*J(.3),.16*J(.2),'triangle',.10*J(.2),40*J(.1),600); },
    /* understated falling fifth, no fanfare; a fat premium adds one quiet
       fifth above — warmth for a bank you earned at the edge. The chain
       stacks rungs on top: one pluck a link, climbing the house scale from
       the chord's own top (NOTE(15) is the 392 voice), garnish so a burst
       of banks thins it first — the combo audibly piles up */
    bank(n,prem,ch){ if(!on())return;
      osc(58*J(.03),0,.24,'sine',.16,44,300);
      osc(392*J(.01),.01,.16,'triangle',.055,392,1500);
      osc(262*J(.01),.11,.30,'triangle',.05,262,1300);
      if((n||0)>=8)osc(196*J(.01),.22,.42,'sine',.05,196,900);
      if((prem||0)>=1.5){osc(330*J(.01),.05,.26,'sine',.032,330,1400);osc(495*J(.01),.07,.30,'sine',.026,495,1600);}
      nse(0,.14,.05,1600,500,.5);
      const cg=gate(0),links=Math.min(6,Math.ceil(ch||0));
      for(let i=0;cg&&i<links;i++)
        osc(NOTE(15+i)*J(.006),.02+i*.045,.09*J(.2),'triangle',.03*cg,NOTE(15+i)*.94,2100); },
    /* the felt's pulse: a soft lub-dub; k = certainty × adrenaline,
       0 means silent, i = pool intensity — a small deck is a small moment */
    heart(k,i){ if(!on())return; const v=i==null?1:i;
      osc(54*J(.04),0,.15,'sine',.115*k*v,40,240);
      osc(47*J(.04),.17,.12,'sine',.075*k*v,36,220); },
    bust(){ if(!on())return;
      osc(96*J(.05),0,.42,'sine',.20,32,400); osc(150*J(.06),.01,.20,'triangle',.06,60,700);
      nse(0,.22,.14,700*J(.12),140,.5); },
    shuffle(){ if(!on())return; for(let i=0;i<7;i++)
      nse(i*.031+Math.random()*.012,.035*J(.2),.055*J(.2),2400*J(.1),900*J(.15),.8); },
    burn(){ if(!on())return; nse(0,.26,.11,1800*J(.1),240*J(.15),.7); osc(180*J(.05),0,.18,'triangle',.05,90,800); },
    buy(){ if(!on())return; osc(523*J(.008),0,.07*J(.2),'triangle',.07,523,1900); osc(349*J(.008),.06,.16,'triangle',.06,349,1400); },
    goal(){ if(!on())return; osc(330*J(.006),0,.5,'sine',.09,330,1200); osc(495*J(.006),.02,.55,'sine',.055,495,1400);
      nse(0,.1,.04,2600,900,.6); },
    deny(){ if(!on())return; osc(88*J(.04),0,.10,'sine',.10,70,300); },
    /* the sticker voice: k the sticker key, ev draw/act/arm/bank/bust,
       v the card value when the moment has one */
    stk
  };
})();
/* background mode mutes the engine at the source: nobody hears a hidden
   tab, and every voice pulls the AudioContext the throttled timer
   budget in there can't spare */
for(const k in SFX){const f=SFX[k];SFX[k]=(...a)=>{if(BG)return;return f(...a);};}
const buzz = p => { if(BG||!S.set.haptic || !navigator.vibrate) return; try{navigator.vibrate(p);}catch(e){} };
