/* ==================================================================
   tabs.js — one grouped element: rubber bar, sliding cardstock thumb,
   direction-aware view transitions. Swipe support lives in gestures.
   ================================================================== */
const TAB_ORDER=['play','cards','up','shop','ach','pres'];
const Tabs={
  render(v){({cards:renderCards,up:renderUp,shop:renderShop,ach:renderAch,pres:renderPres}[v]||(()=>{}))();},
  fixTab(v){
    /* wide remembers the panel's last view — the next wide entry (or a
       stray 'play' key) lands back on it */
    if(v!=='play')S.lastSide=v;
    $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
    $$('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));
    this.thumb();
    const b=$(`#tabs button[data-v="${v}"]`),n=b&&b.querySelector('.nub');if(n)n.remove();
    /* landing on GOALS counts as reading the dot: every goal waiting
       here is seen, so only a later fresh goal brings the nub back */
    if(v==='ach')S.ready.forEach(id=>S.rseen[id]=1);
  },
  thumb(){
    const b=$('#tabs button.on');if(!b)return;
    const th=$('#thumb');
    th.style.left=(b.offsetLeft)+'px';th.style.width=(b.offsetWidth)+'px';
  },
  go(v,dir,fast){
    /* wide: the table never yields the stage — a 'play' that slips
       through (key, deep link) lands on the panel's last view instead */
    if(v==='play'&&document.body.classList.contains('wide')){
      const s=S.lastSide||firstSide();if(s)v=s;
    }
    const gb=$(`#tabs button[data-v="${v}"]`);
    if(gb&&gb.classList.contains('lock')&&!S.seen[v]){
      SFX.deny();buzz(10);toast(tabHint(v)||'','lock');return;}
    /* leaving the play view yields the stage: the title hides, letters
       included, at once (no entrance wait) */
    if(v!=='play'&&ttlAlive())ttlOff(true);
    const cur=document.querySelector('.view.on'),next=$('#v-'+v);
    if(!next||cur===next){this.fixTab(v);return;}
    let d=dir;
    if(!d){const i=TAB_ORDER.indexOf(cur.id.slice(2)),j=TAB_ORDER.indexOf(v);
      d=j>i?'r':'l';}
    this.fixTab(v);this.render(v);
    if(v==='shop')biFirst('shop');
    /* the drift belongs to the table: leaving play sinks it, even
       mid-intro — it never tours the other tabs */
    if(ttlFly&&v!=='play')ttlDriftFade();
    /* a tap (or a rail fling) snaps: no slide, no vin. tsnap must not
       lift on a timer — dropping it while a view is .on turns vin back
       on, which restarts it and flashes the whole view. It lifts only
       on an animated switch, where the slide class replaces the
       animation before anything paints */
    if(fast){
      document.body.classList.add('tsnap');
    }else{
      document.body.classList.remove('tsnap');
      next.classList.remove('slide-in-l','slide-in-r');void next.offsetWidth;
      next.classList.add(d==='r'?'slide-in-r':'slide-in-l');
    }
    if(v==='play')requestAnimationFrame(layout);
    /* the coach's ring follows the player in: re-point it now that the
       view is switched (tutPaint re-rings only when targets change) */
    tutPaint();
    save();
  }
};
$$('#tabs button').forEach(b=>b.onclick=()=>Tabs.go(b.dataset.v,null,true));
addEventListener('resize',()=>Tabs.thumb());

/* ---- wide desktop (>=1024px): the table keeps the stage and one side
   panel takes the right lane. body.wide is the single switch the css
   reads, kept honest here — progressive disclosure: with no side tab
   in sight the phone column stands. WIDE_Q comes from table.js ---- */
const firstSide=()=>{
  const b=$$('#tabs button').find(b=>b.dataset.v!=='play'
    &&!b.classList.contains('hid')&&!b.classList.contains('lock'));
  return b?b.dataset.v:null;
};
/* the wide lanes are real containers, not css ghosts: the side views and
   the rail move into a #side column (its own scroll host + the rail
   tucked UNDER the panel, sidebar owning its full height). Everything
   returns home in born order on the way back out */
function wideLanes(on){
  if(on&&!$('#side')){
    const side=document.createElement('div');side.id='side';
    const sv=document.createElement('div');sv.id='sideV';
    side.appendChild(sv);
    TAB_ORDER.filter(v=>v!=='play').forEach(v=>sv.appendChild($('#v-'+v)));
    side.appendChild($('#tabs'));
    $('#app').appendChild(side);
    /* one header row: the readout joins the wallet plaques — wallet,
       live hand + terms, then the gear — and the felt starts higher */
    const gap=$('#hud .gap');
    gap.parentNode.insertBefore($('#ro'),gap);
  }else if(!on&&$('#side')){
    TAB_ORDER.filter(v=>v!=='play').forEach(v=>$('#views').appendChild($('#v-'+v)));
    $('#app').appendChild($('#tabs'));
    $('#side').remove();
    $('#v-play').prepend($('#ro'));   /* back on born top of the view */
  }
}
function syncWide(){
  if(!WIDE_Q)return;   /* the node harness has no viewport */
  const any=$$('#tabs button').some(b=>b.dataset.v!=='play'&&!b.classList.contains('hid')),
        wide=document.body.classList.contains('wide'),
        want=WIDE_Q.matches&&any;
  if(want!==wide){
    document.body.classList.toggle('wide',want);
    wideLanes(want);
    /* a swipe caught mid-cross leaves dragging transforms pinned on the
       views — inside the sidebar they would sit off-lane */
    $$('.view').forEach(v=>{if(v.style.transform)v.style.cssText='';});
    /* the felt re-measures into its new lane; the thumb re-seats on the
       reshaped rail */
    requestAnimationFrame(()=>{layout();Tabs.thumb();});
  }
  /* TABLE rides .hid while wide: the rail's digits, flings and thumb
     address the panel alone. Onboarding keeps it off the rail too —
     while it rides alone there is nothing to switch to. The desktop
     lets the pill go outright (the wide lane rearranges the moment a
     side tab births anyway); mobile keeps its box as a phantom so the
     rows above never shift when the rail fills. .solo sinks the thumb:
     nothing to highlight while the phantom rides alone */
  const pb=$('#tabs button[data-v="play"]');
  if(pb){
    const solo=!any;
    pb.classList.toggle('hid',want||(solo&&WIDE_Q.matches));
    pb.classList.toggle('ph',solo&&!WIDE_Q.matches);
    $('#tabs').classList.toggle('solo',solo);
  }
  /* invariant, re-checked every pass: while wide, .on never rests on
     the table — the panel needs a view to show. fixTab, not go — the
     title keeps its gate, a locked pill keeps its deny. The pick can
     land a beat after the wide turn: a tab crossing its gate in
     unlocks() wears .lock until the next pass, so firstSide() had
     nothing to offer at the transition itself */
  if(want&&document.querySelector('#v-play.on')){
    const dst=S.lastSide||firstSide();
    if(dst){Tabs.fixTab(dst);Tabs.render(dst);}
  }
}
if(WIDE_Q)WIDE_Q.addEventListener('change',syncWide);
