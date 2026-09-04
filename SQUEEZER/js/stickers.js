/* ==================================================================
   stickers.js — die-cut stickers slapped onto the cards.
   Every sticker owns one glyph: an abstract mark — discs, rings,
   crescents, chevrons, wedges, bars — one continuous outline, few
   nodes, no overlapping pieces (renders without paint-order support,
   so unions would show their seams; detached islands ride the same
   path as extra subpaths). Holes are reverse-wound subpaths of the
   same outline, so the ink ring rides the cut edge too: a cutout
   shows the card inside its own border. The vinyl, not the
   silhouette, carries the theme; color worlds stay green garden,
   blue sea, gold fortune, red danger, violet arcane.
   Seeded anchor + tilt keep the numeral readable. Vinyl = the tier
   color nudged per sticker: each key shifts the tier hue and lightness
   a step of its own, and every vinyl carries at least a whisper of
   emboss — soft neumorphic presses, sheens and banding, no hard flat —
   and the sheen itself is alive: each fade moves with a character of
   its own (linear fades sway, pinwheel or shiver; radial fades orbit,
   trace a figure-8 or pulse), drifting its hue and lightness as it
   goes.
   The rim is not flat ink either: a duotone gradient pressed toward
   the ink, lit from the same side as the sheen, so the sticker reads
   as extruded vinyl. Same tier, same world, not the same color.
   ================================================================== */
const INK = '#15140E';
const SHP = {
  /* --- t1 · green, the garden --- */
  bolt: '<path d="M13.6 2.8 6.2 13.1h4.3l-.9 8.1 7.8-10.6h-4.4z"/>',
  shamrock: '<path d="M7.5 9.6A5 5 0 0 1 12 2.4A5 5 0 0 1 16.5 9.6A5 5 0 0 1 21.2 14.6A5 5 0 0 1 16.2 19.6A5 5 0 0 1 12 17.4A5 5 0 0 1 7.8 19.6A5 5 0 0 1 2.8 14.6A5 5 0 0 1 7.5 9.6Z"/>',
  peapod: '<path d="M7.2 4.6H16.8A2.8 2.8 0 0 1 19.6 7.4A2.8 2.8 0 0 1 16.8 10.2H7.2A2.8 2.8 0 0 1 4.4 7.4A2.8 2.8 0 0 1 7.2 4.6ZM7.2 13.8H16.8A2.8 2.8 0 0 1 19.6 16.6A2.8 2.8 0 0 1 16.8 19.4H7.2A2.8 2.8 0 0 1 4.4 16.6A2.8 2.8 0 0 1 7.2 13.8Z"/>',
  note: '<path d="M3 12A9 9 0 1 1 21 12A9 9 0 1 1 3 12ZM14.9 10.4H9.1A1.6 1.6 0 0 0 7.5 12A1.6 1.6 0 0 0 9.1 13.6H14.9A1.6 1.6 0 0 0 16.5 12A1.6 1.6 0 0 0 14.9 10.4Z"/>',
  sunflower: '<path d="M21.6 12L15.3 13.9 16.8 20.3 12 15.8 7.2 20.3 8.7 13.9 2.4 12 8.7 10.1 7.2 3.7 12 8.2 16.8 3.7 15.3 10.1Z"/>',
  cactus: '<path d="M9.4 2.4H14.6V9.4H21.6V14.6H14.6V21.6H9.4V14.6H2.4V9.4H9.4Z"/>',
  fern: '<path d="M2.6 7.6L7.3 12.8 12 7.6 16.7 12.8 21.4 7.6V13.4L16.7 18.6 12 13.4 7.3 18.6 2.6 13.4Z"/>',
  leaves: '<path d="M4.1 4.1A5.6 5.6 0 0 1 11.2 11.2A5.6 5.6 0 0 1 4.1 4.1ZM12.8 12.8A5.6 5.6 0 0 1 19.9 19.9A5.6 5.6 0 0 1 12.8 12.8Z"/>',
  /* --- t2 · blue, the sea --- */
  sapphire: '<path d="M12 2.6L21.4 12 12 21.4 2.6 12Z"/>',
  whale: '<path d="M4.4 8.8A8.4 8.4 0 0 0 3.6 12.4A8.4 8.4 0 0 0 12 20.8A8.4 8.4 0 0 0 20.4 12.4A8.4 8.4 0 0 0 19.6 8.8A7.6 7.6 0 0 1 12 15.8A7.6 7.6 0 0 1 4.4 8.8Z"/>',
  wave: '<path d="M3.4 16.4A2.9 2.9 0 0 1 9.2 16.4A2.9 2.9 0 0 1 15 16.4A2.9 2.9 0 0 1 20.8 16.4V19.8H3.4z"/>',
  iceberg: '<path d="M3.6 5.2H20.4L16.6 19.2H7.4Z"/>',
  anchor: '<path d="M2.6 12A9.4 9.4 0 1 1 21.4 12A9.4 9.4 0 1 1 2.6 12ZM7.4 12A4.6 4.6 0 1 0 16.6 12A4.6 4.6 0 1 0 7.4 12Z"/>',
  coral: '<path d="M20.8 12A8.8 8.8 0 0 1 11.2 20.8L11.6 16.4A4.4 4.4 0 0 0 16.4 12ZM7.6 19.6A8.8 8.8 0 0 1 4.8 7L8.4 9.5A4.4 4.4 0 0 0 9.8 15.8ZM7.6 4.4A8.8 8.8 0 0 1 20 8.3L16 10.1A4.4 4.4 0 0 0 9.8 8.2Z"/>',
  lighthouse: '<path d="M6.5 3.6H17.5V7H6.5ZM4.5 10.3H19.5V13.7H4.5ZM2.8 17H21.2V20.4H2.8Z"/>',
  flame: '<path d="M12 2.8C14 6.2 17.6 8.6 17.6 13.6A5.6 5.6 0 0 1 6.4 13.6C6.4 11 8.6 9.4 10.2 7.6 11.2 6.5 11.4 4.6 12 2.8z"/>',
  periscope: '<path d="M2.6 12A10.5 10.5 0 0 1 21.4 12A10.5 10.5 0 0 1 2.6 12ZM9.7 12A2.3 2.3 0 1 0 14.3 12A2.3 2.3 0 1 0 9.7 12Z"/>',
  funnel: '<path d="M3.4 4.6H20.6L12 20.6ZM9.4 9.4A2.6 2.6 0 1 0 14.6 9.4A2.6 2.6 0 1 0 9.4 9.4Z"/>',
  salmon: '<path d="M3.2 15.8L12 5.8L20.8 15.8V20.8L12 10.8L3.2 20.8Z"/>',
  buoy: '<path d="M15.4 12L20.6 8.2A9.4 9.4 0 1 0 20.6 15.8Z"/>',
  ripples: '<path d="M10.5 9A4.8 4.8 0 0 1 10.5 15L7.6 13.1A1.8 1.8 0 0 0 7.6 10.9ZM14.2 5.7A10.2 10.2 0 0 1 14.2 18.3L11.9 16.4A7 7 0 0 0 11.9 7.7ZM18.5 2.4A15.6 15.6 0 0 1 18.5 21.6L16.1 19.8A12.2 12.2 0 0 0 16.1 4.5Z"/>',
  whirl: '<path d="M12.0 8.2L13.6 8.3L15.1 9.0L16.2 10.4L16.7 12.1L16.5 14.1L15.5 15.8L13.8 17.1L11.7 17.6L9.4 17.3L7.4 16.0L6.0 14.0L5.4 11.4L6.0 8.8L7.5 6.5L9.9 5.0L12.9 4.5L15.8 5.3L18.3 7.1L19.9 9.9L20.4 13.2L19.4 16.5L17.2 19.2L15.7 17.1L17.2 15.1L17.8 12.8L17.4 10.6L16.3 8.7L14.5 7.5L12.6 7.1L10.7 7.5L9.2 8.6L8.3 10.0L8.0 11.7L8.4 13.2L9.3 14.3L10.5 14.9L11.8 15.0L12.9 14.7L13.8 13.9L14.1 13.0L14.1 12.1L13.8 11.3L13.2 10.8L12.6 10.7L12.0 10.8z"/>',
  hook: '<path d="M14.6 2.8H18.8V12A6.4 6.4 0 0 1 6 12V9.6H10.2V12A2.2 2.2 0 0 0 14.6 12Z"/>',
  /* --- t3 · gold, the fortune --- */
  twin: '<path d="M7.5 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9zM16.5 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9z"/>',
  tulip: '<path d="M12 2.6L15.6 6.8 12 11 8.4 6.8ZM12 13.6L15.6 17.6 12 21.6 8.4 17.6Z"/>',
  sun: '<path d="M12.00 2.10L13.60 6.01L16.95 3.43L16.38 7.62L20.57 7.05L17.99 10.40L21.90 12.00L17.99 13.60L20.57 16.95L16.38 16.38L16.95 20.57L13.60 17.99L12.00 21.90L10.40 17.99L7.05 20.57L7.62 16.38L3.43 16.95L6.01 13.60L2.10 12.00L6.01 10.40L3.43 7.05L7.62 7.62L7.05 3.43L10.40 6.01z"/>',
  hexnut: '<path d="M12 3L19.8 7.5V16.5L12 21 4.2 16.5V7.5ZM12 9.4L9.4 10.9V14.1L12 15.6 14.6 14.1V10.9Z"/>',
  dusk: '<path d="M3.4 10.4A8.6 8.6 0 0 0 20.6 10.4ZM9.6 5.2A2.4 2.4 0 1 0 14.4 5.2A2.4 2.4 0 1 0 9.6 5.2Z"/>',
  journal: '<path d="M4.4 4.4H19.6V19.6H4.4Z"/>',
  horseshoe: '<path d="M2.6 12A9.4 9.4 0 1 1 21.4 12A9.4 9.4 0 1 1 2.6 12ZM7.8 13.7A4.2 4.2 0 1 0 16.2 13.7A4.2 4.2 0 1 0 7.8 13.7Z"/>',
  pick: '<path d="M4.2 19.8V15H9.4V10.2H14.6V5.4H19.8V19.8Z"/>',
  chevron: '<path d="M12 6.2L21.6 17.2H16.7L12 11.5L7.3 17.2H2.4Z"/>',
  pyrite: '<path d="M7.2 3.4L12 8.2 16.8 3.4 20.6 7.2 15.8 12 20.6 16.8 16.8 20.6 12 15.8 7.2 20.6 3.4 16.8 8.2 12 3.4 7.2Z"/>',
  crown: '<path d="M12 2.8L20.4 6V12.4C20.4 17 16.8 20.3 12 21.6C7.2 20.3 3.6 17 3.6 12.4V6Z"/>',
  /* --- t4 · red, the danger --- */
  megaphone: '<path d="M6.2 17.8V5.8A12 12 0 0 1 18.2 17.8Z"/>',
  bin: '<path d="M7 3.8H17A2.4 2.4 0 0 1 19.4 6.2V17.8A2.4 2.4 0 0 1 17 20.2H7A2.4 2.4 0 0 1 4.6 17.8V6.2A2.4 2.4 0 0 1 7 3.8ZM14.4 10.6H9.6A1.4 1.4 0 0 0 8.2 12A1.4 1.4 0 0 0 9.6 13.4H14.4A1.4 1.4 0 0 0 15.8 12A1.4 1.4 0 0 0 14.4 10.6Z"/>',
  buoyring: '<path d="M2.6 12A9.4 9.4 0 1 1 21.4 12A9.4 9.4 0 1 1 2.6 12ZM6.8 12A5.2 5.2 0 1 0 17.2 12A5.2 5.2 0 1 0 6.8 12ZM10 12A2 2 0 1 1 14 12A2 2 0 1 1 10 12Z"/>',
  plunger: '<path d="M9.6 3.2H14.4V13.4H20.6V19.8H3.4V13.4H9.6Z"/>',
  bucket: '<path d="M7.4 6.8A4.6 4.6 0 0 1 16.6 6.8H13.6A1.6 1.6 0 0 0 10.4 6.8ZM4.6 10.4H19.4L16.2 20.2H7.8Z"/>',
  arrow: '<path d="M3.8 12 9.4 6.4V10H20.2V14H9.4V17.6z"/>',
  cherries: '<path d="M3.2 5.2V18.8L10.4 12ZM20.8 5.2V18.8L13.6 12Z"/>',
  /* --- t5 · violet, the arcane --- */
  crystal: '<path d="M12 2.6L17.2 8.2V15.8L12 21.4 6.8 15.8V8.2Z"/>',
  trophy: '<path d="M12 2.6L21.4 12 12 21.4 2.6 12ZM12 8.2L8.2 12 12 15.8 15.8 12Z"/>',
  curtain: '<path d="M3.3 3.4H7.5V20.6H3.3ZM9.9 3.4H14.1V20.6H9.9ZM16.5 3.4H20.7V20.6H16.5Z"/>',
  tophat: '<path d="M7.2 4.6H16.8V15.2H7.2ZM4 18.4H20V20.8H4Z"/>',
  orb: '<path d="M12 9.6V2.6A9.4 9.4 0 0 1 21.2 10L14.3 11.5A2.4 2.4 0 0 0 12 9.6ZM14.1 13.2L20.1 16.7A9.4 9.4 0 0 1 9.1 20.9L11.3 14.3A2.4 2.4 0 0 0 14.1 13.2ZM9.9 13.2L3.9 16.7A9.4 9.4 0 0 1 5.7 5L10.4 10.2A2.4 2.4 0 0 0 9.9 13.2Z"/>',
  plate: '<path d="M12 2.8L20.5 7.4V16.6L12 21.2 3.5 16.6V7.4Z"/>',
  comet: '<path d="M3.6 18.8Q5.6 10.8 10 6.4A5.4 5.4 0 1 1 16.7 13.9Q11.2 17.6 3.6 18.8Z"/>',
  /* the discard/OUT batch: pie, bell, escape dart, anvil, return
     arrow, hourglass — sampler-clean, no seams, in the RINK envelope */
  remnant: '<path d="M12 2.6A9.4 9.4 0 1 1 2.6 12L12 12Z"/>',
  guardian: '<path d="M5.9 14.6A6.1 6.1 0 0 1 18.1 14.6L19.8 19.2L4.2 19.2Z"/>',
  flinch: '<path d="M19.7 9.2A8.2 8.2 0 1 1 14.8 4.3L13.78 7.11A5.2 5.2 0 1 0 16.89 10.22ZM14.05 9.28L19.5 4.5L14.72 9.95Z"/>',
  offering: '<path d="M8.4 4.4H15.6V10.4H20.4L16.4 15.6H14.2V19.6H9.8V15.6H7.6L3.6 10.4H8.4Z"/>',
  recycle: '<path d="M6 4.4H10.2V13.2A2 2 0 0 0 14.2 13.2V8.8H12L16.6 3.6L21.2 8.8H18.4V13.2A6.2 6.2 0 0 1 6 13.2Z"/>',
  sub: '<path d="M5.2 4.6H18.8L12 11.4L18.8 18.2V19.8H5.2V18.2L12 11.4Z"/>',
  /* Exit: the open door — frame ajar, the leaf swung out toward us */
  exit: '<path d="M3 2.5H13.5V6H7V18H13.5V21.5H3ZM16 5.5L21.5 3V21L16 18.5Z"/>',
  /* Layaway: the deposit locker — the parcel waits behind the counter,
     the coin hole punched clean (reverse-wound, sweep 0) */
  layaway: '<path d="M4.6 5.8H19.4V19.4H4.6ZM12 15.2A3.2 3.2 0 1 0 12 8.8A3.2 3.2 0 1 0 12 15.2Z"/>'
};

/* vinyl varies inside the tier: each key nudges the tier hue and
   lightness a seeded step of its own — a sticker always wears the same
   vinyl — and every vinyl carries a fade: a whisper-flat emboss, a
   plain sheen, a center ripple, a radial ring, sine/sawtooth/triangle
   banding or a soft neumorphic press, each with its own angle, phase
   and amplitude, sweeping a wide contrast range (.24-.48; the emboss
   family owns over a third of the wheel). The rim is the same geometry pressed
   toward the ink — a lit duotone bevel, not a flat black line. All
   colors are pre-blended and opaque: no stop-opacity for old webviews
   to drop. The pass is block-scoped and self-contained:
   make-constants.js evals only this file plus config.js */
const VINYL={on:false};
{
  /* vhash = the state.js hash plus a murmur-style finisher: the raw
     value's low bits are too biased to cut fields off of */
  const vhash=s=>{let h=9;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),387420489);
    h^=h>>>16;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);return (h^h>>>16)>>>0;};
  const unhex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const rehex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  const fromHSL=(h,s,l)=>{h=((h%360)+360)%360/360;s/=100;l/=100;
    const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,
          f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
    return [f(h+1/3),f(h),f(h-1/3)].map(v=>v*255);};
  const mix=(c,t,amt)=>c.map((v,j)=>v+(t[j]-v)*amt);
  const W=[255,255,255],KB=[20,18,10],
        cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const toHSL=c=>{const mx=Math.max(...c),mn=Math.min(...c),l=(mx+mn)/510,d=mx-mn,
    s=d?d/255/(1-Math.abs(2*l-1)):0,
    h=d?(mx===c[0]?60*(((c[1]-c[2])/d)%6):mx===c[1]?60*((c[2]-c[0])/d+2):60*((c[0]-c[1])/d+4)):0;
    return [h,s*100,l*100];};
  for(const k in STK){
    const s=STK[k],[hue,sat,l]=toHSL(unhex(s.c)),
          hv=vhash(k),hf=vhash(k+'~'),hd=vhash(k+'%'),hz=vhash(k+'@'),h2=vhash(k+'!');
    /* wide hue span (+-11), slight sat shift, +-4 lightness */
    s.c=rehex(fromHSL(hue+(hv%23)-11,cl(sat+((hv>>>10)%9)-4,12,100),cl(l+((hv>>>7)%9)-4,30,72)));
    const A=[.24,.32,.4,.48][(hf>>>12)%4],       /* fade amplitude */
          ang=()=>((hf>>>20)%24)*15,
          fx=()=>[7.2,16.8,7.2,16.8,12][(hf>>>20)%5],
          fy=()=>[7.2,7.2,16.8,16.8,8.4][(hf>>>20)%5],
          tv=(hf>>>5)%100;
    /* the fade wheel: a whisper emboss, plain sheens, ripples, waves,
       embosses — neumorphic presses own the biggest single share */
    s.g=tv<20?{t:'lin',a:[150,165,180,195,210][(hf>>>8)%5],A:.08+(hf>>>13)%3*.02}
      :tv<34?{t:'lin',a:ang(),A}
      :tv<46?{t:'rad',fx:fx(),fy:fy(),A}
      :tv<57?{t:'rip',m:[.38,.5,.62][(hf>>>20)%3],w:[.15,.21,.27][(hf>>>23)%3],a:ang(),A}
      :tv<64?{t:'ring',A}
      :tv<72?{t:'sine',n:1+((hf>>>20)&1),ph:(hf>>>22&3)*Math.PI/2,a:ang(),A}
      :tv<78?{t:'saw',a:ang(),A}
      :tv<83?{t:'tri',v:(hf>>>20)&1,a:ang(),A}
      :tv<95?{t:'neu',a:[150,165,180,195,210][(hf>>>23)%5],A}
      :{t:'pil',A};
    /* each faded vinyl's hue drifts on its own two sines — one slow, one
       double-speed, seeded amplitudes and phases — plus a full-cycle
       lightness breath (the vinyl swells and settles, a slow lull), and
       the gradient geometry moves with a character of its own: linear
       fades sway, pinwheel (a full slow revolution) or shiver; radial
       fades orbit, wander a figure-8 or pulse double-time. Every term
       is periodic over the loop (pinwheel turns are whole), so the
       sample ring closes with no end-of-cycle snap; playback is SMIL
       linear between the samples, and the frame loop never touches it */
    s.h={dur:[14,20,28,38,52][(hd>>>3)%5],
      a1:8+(hd>>>6)%9,a2:4+(hd>>>10)%6,
      p1:((hd>>>14)&3)*Math.PI/2,p2:((hd>>>18)&3)*Math.PI/2,
      lb:2.4+(hd>>>20)%4*.8,lp:((hd>>>23)&3)*Math.PI/2,
      /* linear movement (mvL): 0 sway, 1 pinwheel, 2 shiver */
      ga:12+(hz>>>0)%18,ga2:4+(hz>>>5)%7,
      gp1:((hz>>>8)&3)*Math.PI/2,gp2:((hz>>>10)&3)*Math.PI/2,
      mvL:(hz>>>12)%3,pt:1+((hz>>>14)&1),
      sh:8+(hz>>>15)%9,shp:((hz>>>18)&3)*Math.PI/2,
      /* radial movement (mvR): 0 orbit, 1 figure-8, 2 pulse */
      ax:1.4+(h2>>>0)%6*.5,ay:1.4+(h2>>>4)%6*.5,ar:1.4+(h2>>>8)%5*.5,
      R:2+(h2>>>12)%5*.6,
      qp1:((h2>>>16)&3)*Math.PI/2,qp2:((h2>>>18)&3)*Math.PI/2,
      qp3:((h2>>>20)&3)*Math.PI/2,mvR:(h2>>>22)%3};
  }
  /* stop list for a fade: [offset, color] pairs, opaque. One source of
     truth — the document defs and the docs-page inline defs both read
     it, so a sticker fades identically everywhere. The banding types
     dip their base stops a touch dark, so the bands read in both
     directions instead of washing toward white only */
  VINYL.stops=(g,c)=>{c=unhex(c);
    const T=a=>rehex(mix(c,W,a)),S=a=>rehex(mix(c,KB,a)),C=rehex(c),
          D=g?S(g.A*.5):C;
    switch(g.t){
      case 'lin':return [[0,T(g.A)],[1,S(g.A*.55)]];
      case 'rad':return [[0,T(g.A)],[1,S(g.A*.5)]];
      case 'rip':return [[0,D],[Math.max(0,g.m-g.w).toFixed(2),D],
        [g.m.toFixed(2),T(g.A)],[Math.min(1,g.m+g.w).toFixed(2),D],[1,D]];
      case 'ring':return [[0,D],[.42,D],[.6,T(g.A)],[.78,D],[1,D]];
      case 'sine':return Array.from({length:9},(_,i)=>{const o=i/8,
        a=g.A*(.5+.5*Math.sin(2*Math.PI*g.n*o+g.ph)),off=a-g.A*.5;
        return [o.toFixed(2),off<0?S(-off):T(off)];});
      case 'saw':return [[0,D],[.42,T(g.A)],[.5,D],[.92,T(g.A*.65)],[1,D]];
      case 'tri':return g.v?[[0,S(g.A*.6)],[.3,D],[.65,T(g.A)],[1,D]]
        :[[0,D],[.35,T(g.A)],[.7,D],[1,T(g.A*.6)]];
      case 'neu':return [[0,T(g.A+.05)],[.5,C],[1,S(g.A*.8)]];
      case 'pil':return [[0,T(g.A)],[.62,C],[1,S(g.A*.6)]];
    }};
  /* gradient geometry, shared by the DOM build and the string build */
  VINYL.geo=g=>{const rad=g.t==='rad'||g.t==='ring'||g.t==='pil';
    if(rad)return {tag:'radialGradient',at:{cx:12,cy:12,r:13,fx:g.fx||12,fy:g.fy||12}};
    const r=g.a*Math.PI/180,c=Math.cos(r),s=Math.sin(r),q=n=>Math.round(n*100)/100;
    return {tag:'linearGradient',at:{x1:q(12-c*12),y1:q(12-s*12),x2:q(12+c*12),y2:q(12+s*12)}};};
  /* the rim: the vinyl's own geometry pressed toward the ink — a lit
     duotone bevel (hue-tinted soft edge into near-ink) instead of a
     flat black stroke. Static: the drift lives in the vinyl, the rim
     is too dark for hue motion to read */
  VINYL.bstops=(g,c)=>{c=unhex(c);
    return [[0,rehex(mix(mix(c,KB,.62),W,.14))],[1,rehex(mix(c,KB,.88))]];};
  /* inline defs markup for a standalone svg (the docs page) */
  VINYL.mark=k=>{const s=STK[k];if(!s.g)return '';
    const st=VINYL.stops(s.g,s.c).map(([o,col])=>`<stop offset="${o}" stop-color="${col}"/>`).join(''),
          bs=VINYL.bstops(s.g,s.c).map(([o,col])=>`<stop offset="${o}" stop-color="${col}"/>`).join(''),
          gm=VINYL.geo(s.g),at=Object.entries(gm.at).map(([a,v])=>`${a}="${v}"`).join(' ');
    return `<defs><${gm.tag} id="sg-${k}" gradientUnits="userSpaceOnUse" ${at}>${st}</${gm.tag}>`
      +`<${gm.tag} id="sb-${k}" gradientUnits="userSpaceOnUse" ${at}>${bs}</${gm.tag}></defs>`;};
  /* the drift: sample each stop's color at 25 ticks of the two hue
     sines plus the lightness breath, and the gradient geometry at the
     same ticks. Every term completes whole cycles over the tick range,
     and the first sample is appended once more, so each value ring
     closes: SMIL interpolates linearly between the samples and loops
     with no seam. The vinyl swells and settles like a slow pulse
     without a repaint per frame */
  const HSAMP=25;
  VINYL.anim=k=>{const s=STK[k],h=s.h,g=s.g,cols=VINYL.stops(g,s.c).map(x=>x[1]),
    vals=cols.map(()=>[]),geom=[];
    for(let i=0;i<HSAMP;i++){
      const t=i/HSAMP,w=h.a1*Math.sin(2*Math.PI*t+h.p1)+h.a2*Math.sin(4*Math.PI*t+h.p2),
            lb=h.lb*Math.sin(2*Math.PI*t+h.lp);
      cols.forEach((c,j)=>{
        const [hh,ss,ll]=toHSL(unhex(c));
        vals[j].push(rehex(fromHSL(hh+w,ss,ll+lb)));});}
    vals.forEach(v=>v.push(v[0]));                 /* close the loop */
    /* geometry ticks, one movement character per fade family. Linear:
       sway = two-sine angle wobble, pinwheel = whole slow revolutions
       (so the ring still closes) under a small wobble, shiver = a
       double-time oscillation. Radial: orbit = the highlight circles
       home, figure-8 = a lissajous wander, pulse = the radius breathes
       double-time. The highlight (fx/fy) rides the center throughout */
    const q2=n=>n.toFixed(2);
    if(g.t==='rad'||g.t==='ring'||g.t==='pil'){
      const at={cx:[],cy:[],r:[],fx:[],fy:[]};
      for(let i=0;i<=HSAMP;i++){const t=i/HSAMP;let cx,cy,r;
        if(h.mvR===0){cx=12+h.R*Math.cos(2*Math.PI*t+h.qp1);
          cy=12+h.R*Math.sin(2*Math.PI*t+h.qp1);
          r=13+h.ar*Math.sin(2*Math.PI*t+h.qp3);}
        else if(h.mvR===1){cx=12+h.ax*Math.sin(2*Math.PI*t+h.qp1);
          cy=12+h.ay*Math.sin(4*Math.PI*t+h.qp2);
          r=13+h.ar*Math.sin(2*Math.PI*t+h.qp3);}
        else{cx=12+h.ax*.5*Math.sin(2*Math.PI*t+h.qp1);
          cy=12+h.ay*.5*Math.sin(2*Math.PI*t+h.qp2);
          r=13+h.ar*1.6*Math.sin(4*Math.PI*t+h.qp3);}
        at.cx.push(q2(cx));at.cy.push(q2(cy));at.r.push(q2(r));
        at.fx.push(q2(cx));at.fy.push(q2(cy));}
      for(const a in at)geom.push({attr:a,values:at[a].join(';')});
    }else{
      const at={x1:[],y1:[],x2:[],y2:[]};
      for(let i=0;i<=HSAMP;i++){const t=i/HSAMP;let a;
        if(h.mvL===0)a=g.a+h.ga*Math.sin(2*Math.PI*t+h.gp1)
          +h.ga2*Math.sin(4*Math.PI*t+h.gp2);
        else if(h.mvL===1)a=g.a+360*h.pt*t+9*Math.sin(2*Math.PI*t+h.gp1);
        else a=g.a+h.sh*Math.sin(4*Math.PI*t+h.shp);
        a=a*Math.PI/180;
        const c=Math.cos(a),sn=Math.sin(a);
        at.x1.push(q2(12-c*12));at.y1.push(q2(12-sn*12));
        at.x2.push(q2(12+c*12));at.y2.push(q2(12+sn*12));}
      for(const a in at)geom.push({attr:a,values:at[a].join(';')});
    }
    return {dur:h.dur+'s',vals:vals.map(v=>v.join(';')),geom};};
  /* full gradient element incl. the drift, for the static docs build */
  VINYL.defMarkup=k=>{const s=STK[k],gm=VINYL.geo(s.g),
    at=Object.entries(gm.at).map(([a,v])=>`${a}="${v}"`).join(' '),
    an=VINYL.anim(k),
    st=VINYL.stops(s.g,s.c).map(([o,col],j)=>`<stop offset="${o}" stop-color="${col}">`
      +`<animate attributeName="stop-color" values="${an.vals[j]}" dur="${an.dur}"`
      +` calcMode="linear" repeatCount="indefinite"/></stop>`).join(''),
    geo=an.geom.map(({attr,values})=>`<animate attributeName="${attr}" values="${values}"`
      +` dur="${an.dur}" calcMode="linear" repeatCount="indefinite"/>`).join(''),
    bs=VINYL.bstops(s.g,s.c).map(([o,col])=>`<stop offset="${o}" stop-color="${col}"/>`).join('');
    return `<${gm.tag} id="sg-${k}" gradientUnits="userSpaceOnUse" ${at}>${st}${geo}</${gm.tag}>`
      +`<${gm.tag} id="sb-${k}" gradientUnits="userSpaceOnUse" ${at}>${bs}</${gm.tag}>`;};
  /* the game's gradients live ONCE per document, in a hidden svg at the
     top of the body — the same shape as the static #holo. Some webviews
     never resolve url() paints into defs that arrived via innerHTML, so
     per-card defs die stroke-only there. Namespace-aware DOM calls,
     idempotent, runs before any sticker string is attached */
  VINYL.inject=()=>{if(VINYL.on||typeof document=='undefined'||!document.body)return;
    VINYL.on=1;
    try{const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),
          defs=document.createElementNS(ns,'defs');
      svg.setAttribute('id','sgdefs');svg.setAttribute('width','0');svg.setAttribute('height','0');
      svg.setAttribute('aria-hidden','true');svg.style.position='absolute';
      for(const k of STKKEYS){const s=STK[k];if(!s.g)continue;
        const gm=VINYL.geo(s.g),
              mk=(id,stops,anim,geom)=>{const el=document.createElementNS(ns,gm.tag);
                el.setAttribute('id',id);el.setAttribute('gradientUnits','userSpaceOnUse');
                for(const a in gm.at)el.setAttribute(a,gm.at[a]);
                stops.forEach(([o,col],j)=>{
                  const st=document.createElementNS(ns,'stop');
                  st.setAttribute('offset',o);st.setAttribute('stop-color',col);
                  if(anim){const am=document.createElementNS(ns,'animate');
                    am.setAttribute('attributeName','stop-color');
                    am.setAttribute('values',anim.vals[j]);am.setAttribute('dur',anim.dur);
                    am.setAttribute('calcMode','linear');am.setAttribute('repeatCount','indefinite');
                    st.appendChild(am);}
                  el.appendChild(st);});
                /* geometry drift rides the gradient element itself */
                if(geom)geom.forEach(({attr,values})=>{
                  const am=document.createElementNS(ns,'animate');
                  am.setAttribute('attributeName',attr);
                  am.setAttribute('values',values);am.setAttribute('dur',anim.dur);
                  am.setAttribute('calcMode','linear');am.setAttribute('repeatCount','indefinite');
                  el.appendChild(am);});
                return el;};
        const an=VINYL.anim(k);
        defs.appendChild(mk('sg-'+k,VINYL.stops(s.g,s.c),an,an.geom));
        defs.appendChild(mk('sb-'+k,VINYL.bstops(s.g,s.c),null));}
      svg.appendChild(defs);document.body.insertBefore(svg,document.body.firstChild);
    }catch(e){}};
}

function stickerSVG(k,inline){
  /* every path takes the vinyl fill and the duotone rim stroke (inline
     style, so it outranks the css ink fallback; the url carries a
     plain-ink fallback paint for webviews that never resolve defs):
     holes are reverse-wound subpaths of the same outline, so their cut
     edges wear the rim too. A fade is one userSpaceOnUse gradient, so
     it runs over the whole glyph instead of restarting inside each
     piece. inline embeds the defs for standalone pages; the game reads
     the document-level #sgdefs instead (see VINYL.inject) */
  const s=STK[k],fill=s.g?`url(#sg-${k})`:s.c;
  return (inline?VINYL.mark(k):'')
    +SHP[s.st].replace(/<(path|circle|rect)(?=[\s>])/g,
      `<$1 fill="${fill}" style="stroke:url(#sb-${k}) ${INK}"`);
}
/* the seeded anchor + tilt; a card that carries a placed position
   (sx/sy, srot from the shop drag) keeps its own pose. The numeral is
   sacred: posed ink clears it by DIGP. A two-digit print plus the ink
   reach spans nearly the whole card width, so the only room is the
   strips above and below the digit band — the anchors live there, a
   couple px inside the edges. RINK is the farthest any glyph's ink +
   stroke reaches from the box center */
const RINK=.215, DIGW=.315, DIGH=.175, DIGP=.045;
const ANCH=[[27,18.5],[50,18],[73,18.5],[27,81.5],[50,82],[73,81.5]];
function stkPose(stkKey,seed){
  const h=hashStr(seed+'|'+stkKey),a=ANCH[h%ANCH.length];
  return{px:a[0],py:a[1],rot:((h>>4)%35)-17};
}
function stickerHTML(stkKey,seed,cls,card){
  VINYL.inject();
  const pose=stkPose(stkKey,seed);
  const px=card&&card.sx!=null?card.sx:pose.px,
        py=card&&card.sy!=null?card.sy:pose.py,
        rot=card&&card.srot!=null?card.srot:pose.rot;
  return `<svg class="stk ${cls||''}${card&&card.shy?' shy':''}" viewBox="0 0 24 24" style="left:${px}%;top:${py}%;
    --r:${rot}deg;transform:translate(-50%,-50%) rotate(${rot}deg)">${stickerSVG(stkKey)}</svg>`;
}
const stkIcon=(k,shy)=>{VINYL.inject();
  return `<svg class="stkicon${shy?' shy':''}" viewBox="0 0 24 24">${stickerSVG(k)}</svg>`;};
/* the rip scar: one jagged gash — thick pale fibers under a fine dark
   seam, so the tear reads as torn stock, not ink. The path STARTS at
   the box's left-center (0,12): placed with transform-origin 0 50% ON
   a card edge, it swings inward and never pokes out. The neumorphic
   lift (dual shadows, the sticker vinyl's own light) lives in css */
const tearSVG=()=>`<path d="M0 12 3.8 9.2l1.7 3.1 3.2-4.7 2.5 3.5 3.1-2.3 4.1.9" fill="none"
  stroke="#F7F1DC" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"
  opacity=".95"/><path d="M0 12 3.8 9.2l1.7 3.1 3.2-4.7 2.5 3.5 3.1-2.3 4.1.9" fill="none"
  stroke="rgba(30,25,10,.45)" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"/>`;

/* ---- fan visibility ----
   In a fanned stack the card on top hides this one's right edge (hand
   rows, pile fans) or its top edge (the leaning piles). A sticker
   parked in the hidden strip slides the shortest way to >70% of its
   box back in view; open air hands the placed pose back. The cuts are
   the hidden strips in px: right, bottom, top. */
const STKB=.4725, SQ71=Math.sqrt(.71);   /* the box, share of card width — tracks .stk in table.css */
function stkReveal(e,cw,ch,cutR,cutB,cutT){
  const s=e.querySelector('.stk');if(!s)return;
  if(s._bx==null){s._bx=parseFloat(s.style.left)*cw/100;s._by=parseFloat(s.style.top)*ch/100;}
  const h=cw*STKB/2,x1=cw-cutR,y0=cutT,y1=ch-cutB;
  /* one axis: the centers leaving f of the box visible form a window
     inside the band; the shortest slide onto it is the clamp */
  const ax=(c,lo,hi,f)=>{const a=lo-h+f*2*h,b=hi+h-f*2*h;
    return a>b?(lo+hi)/2:Math.min(Math.max(c,a),b);};
  const vis=(x,y)=>Math.max(0,Math.min(x+h,x1)-Math.max(x-h,0))
                  *Math.max(0,Math.min(y+h,y1)-Math.max(y-h,y0));
  /* pass one slides each covered axis to its own 71% mark — the exact
     shortest slide when a single edge hides the sticker. A hidden
     corner needs the pair: both to the balanced √.71 mark, where the
     product crosses 70% */
  let fx=ax(s._bx,0,x1,.71),fy=ax(s._by,y0,y1,.71);
  if(vis(fx,fy)<.7*4*h*h){fx=ax(s._bx,0,x1,SQ71);fy=ax(s._by,y0,y1,SQ71);}
  /* the numeral is sacred here too: a slide may not park the ink on it.
     Legal x never escapes the numeral's span (two digits + ink reach
     cover the card's full width), so the exit is vertical — the nearer
     side, unless that side hides the sticker outright. A pose the slide
     never touched (the player's own drag) stands as placed */
  if(fx!==s._bx||fy!==s._by){
    const lx=cw*(.5-DIGW-RINK),rx=cw*(.5+DIGW+RINK),
          t=ch/2-cw*(DIGH+RINK),b=ch/2+cw*(DIGH+RINK);
    if(fx>lx&&fx<rx&&fy>t&&fy<b){
      const nr=fy-t<=b-fy?t:b,ot=nr===t?b:t;
      fy=vis(fx,nr)<=0&&vis(fx,ot)>0?ot:nr;
    }
  }
  if(s._ax===fx&&s._ay===fy)return;   /* nothing moved: no style write */
  s._ax=fx;s._ay=fy;
  s.style.left=(fx*100/cw).toFixed(2)+'%';s.style.top=(fy*100/ch).toFixed(2)+'%';
}
