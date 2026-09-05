/* ==================================================================
   config.js — all game data: stickers, upgrades, shard upgrades,
   goals, economy constants. Numbers tuned by sim.js (see repo):
   first shop sticker ≈ 10.5 min, first ascension ≈ 3.5h of engaged play
   (v6 archetypes, era windows t2 20-90 / t3 30-150 / t4 90-300 /
   t5 150-1000; start-cost pass + goal re-points, 2026-09-01).
   ================================================================== */
const MAXV = 20;

/* OFFLINE_ON=false parks away-pay: offline() in economy.js returns null
   and the copy that advertises it (Auto-Draw desc, its buy toast,
   Dreamer desc) goes quiet. Flip to true to bring the feature back */
const OFFLINE_ON = false;

/* stickers: shape key rides stickers.js (SHP), vinyl color rides the
   tier (TIERC) — the same palette the docs page codes T1..T5 with, so
   a sticker's color always reads its tier on the felt and in the shop.
   stickers.js then nudges each key's hue and lightness a seeded step
   of its own and presses a soft fade on every vinyl: same tier, same
   world, not the same color.
   v5: the gauge is honest — threat() counts risky cards, insurance never
   bends the pay. Trick stickers are armed by tapping; window on visible
   state only (no hidden information in this game). */
const TIERC = {1:'#4CAF50', 2:'#42A5F5', 3:'#FFB300', 4:'#EF5350', 5:'#BA68C8'};
/* cur(c,h) — the live bonus a sticker is giving right now, quoted under
   its desc on hover (card tag + touch sheet) and restated on every
   layout, so a draw ticks the number. It reads the same formulas the
   economy pays on, at the sticker's own layer; h is the card's hand
   (absent off-table, where no now-line shows) */
const STK = {
  gild:   {n:'Gilded',   t:3, pm:1.25, st:'sapphire',   d:'The table pays ×2.75 for this card.',
           cur:(c,h)=>`now +${fmt((ECO.GILD_X-1)*stkBase(c,h))}`},
  haste:  {n:'Haste',    t:1, pm:2.4688, st:'bolt',   d:'On table: draws come 25% faster.',
           cur:(c,h)=>`now ${curCD().toFixed(2)}s draws`},
  tribute:{n:'Tribute',  t:2, pm:.8333, st:'whale',  d:'On draw: pays ×7 its value straight to score, kept on bust.',
           cur:(c,h)=>`now +${fmt(c.v*ECO.TRIBUTE_X*payMul(h))} a draw`},
  odds:   {n:'Odds',     t:1, pm:.733, st:'shamrock',    d:'On draw: a free extra card comes, 50/50 it pays triple or nothing.'},
  snip:   {n:'Snip',     t:1, pm:.511, st:'peapod',  d:'On draw: a twin of its value waits in the discard till you score.'},
  mint:   {n:'Mint',     t:1, pm:1.022, st:'note',   d:'On bank: ×4 its value to score, on top of the payout.',
           cur:(c,h)=>`now +${fmt(cval(c)*ECO.MINT_X*payMul(h))} a bank`},
  brass:  {n:'Brass',    t:1, pm:.688, st:'sunflower',  d:'On a table: each Brass pays +5 score per Brass card on table.',
           cur:(c,h)=>`now +${fmt(ECO.BRASS_SCORE*h.ids.length*h.ids.filter(id=>byId(id).stk==='brass').length)} a bank`},
  surge:  {n:'Surge',    t:2, pm:.5499, st:'wave', d:'On a table: +0.20 to the hand multiplier.',
           cur:(c,h)=>`now +${ECO.SURGE_STEP.toFixed(2)}×`},
  twin:   {n:'Twin',     t:4, pm:3.2, st:'twin',   d:'Arm: pull a card. A twin lands without busting, a blank waits in the discard.'},
  mirror: {n:'Mirror',   t:2, pm:.6666, st:'iceberg',  d:'Worth the highest value on the table.',
           cur:(c,h)=>`now pays ${fmt(stkBase(c,h))}`},
  ward:   {n:'Ward',     t:1, pm:.911, st:'cactus', d:'On draw: a free extra card that cannot bust you.'},
  anchor: {n:'Anchor',   t:2, pm:1.2777, st:'anchor', d:'On draw: for the next 3 draws, a twin of this card slips back into the deck.',
           cur:(c,h)=>{const w=h&&h.run&&(h.run.anchWin||[]).find(x=>x.id===c.id);
             return w&&w.left>0?'guards '+w.left+' draw'+(w.left===1?'':'s'):''}},
  prime:  {n:'Prime',    t:3, st:'coral',   d:'+2 to every other card on the table.',
           cur:(c,h)=>h.ids.length>1?`now +${ECO.PRIME_ADD} to ${h.ids.length-1}`:''},
  beacon: {n:'Beacon',   t:2, pm:2.25, st:'lighthouse',  d:'Risk premium ×1.5. Unique: only one, ever.',
           cur:(c,h)=>`now ×${riskPrem(h).toFixed(2)}`},
  burn:   {n:'Burn',     t:2, pm:.75, st:'flame',  d:'On draw: 2 cards of a random deck pair go to the discard.'},
  tell:   {n:'Tell',     t:2, pm:.8888, st:'periscope',    d:'Arm: the deck\'s top card flips face-up.'},
  cull:   {n:'Cull',     t:2, pm:1.3333, st:'funnel', d:'Arm: gain 1 ward, this card goes OUT.'},
  dividend:{n:'Dividend',t:2, pm:1.0555, st:'salmon',    d:'On bank: 25% chance the table scores again, a beat later.',
           cur:(c,h)=>`now 25% of ${fmt(handParts(h).total)}`},
  tab:    {n:'Tab',      t:3, pm:1.25, st:'buoy', d:'On a table: +8% payout per card OUT.',
           cur:(c,h)=>`now +${Math.round(ECO.TAB_PER*outCount()*100)}%`},
  purify: {n:'Purify',   t:5, pm:4.2, st:'crystal',   d:'Cards matching its value can never bust you.'},
  echo:   {n:'Echo',     t:4, pm:2.6, st:'megaphone',   d:'Arm: look at the deck\'s top 3; twins of this card go to the discard.'},
  bloom:  {n:'Bloom',    t:3, st:'tulip', d:'On bank: each Bloom flips a 50%. Hits pay +0.10× per card, per Bloom.',
           cur:(c,h)=>`now +${(ECO.BLOOM_PER*h.ids.filter(id=>byId(id).stk==='bloom').length*h.ids.length).toFixed(2)}× a hit`},
  kindle: {n:'Kindle',   t:3, st:'sun',  d:'On bank: each Kindle flips a 40%. Hits pay +0.40× per other card.',
           cur:(c,h)=>`now +${(ECO.KINDLE_PER*(h.ids.length-1)).toFixed(2)}× a hit`},
  jynx:   {n:'Jynx',     t:3, pm:1.25, st:'hexnut', d:'The table pays +2% per risky card in the deck.',
           cur:(c,h)=>`now +${Math.round(ECO.JINX_PER*riskyIn(h)*100)}%`},
  reverb: {n:'Reverb',   t:2, pm:.6388, st:'ripples',   d:'On draw: the deck\'s top card goes to the discard; if it matches this card\'s value, gain 1 ward.'},
  siphon: {n:'Siphon',   t:2, pm:.4722, st:'whirl',   d:'On a bust: ×10 its value to score.',
           cur:(c,h)=>`now +${fmt(cval(c)*ECO.SIPHON_X*payMul(h))} on bust`},
  vanish: {n:'Vanish',   t:3, st:'dusk',   d:'On bank: this card sits OUT till the next bust.'},
  ledger: {n:'Ledger',   t:3, st:'journal', d:'Each card on the table with a twin OUT pays double.',
           cur:(c,h)=>`now ${h.ids.filter(id=>S.out.some(x=>cval(byId(x))===cval(byId(id)))).length} twins ×2`},
  rake:   {n:'Rake',     t:1, pm:.555, st:'fern',   d:'On draw: +2 score per card OUT.',
           cur:(c,h)=>`now +${fmt(ECO.RAKE_PER*outCount()*payMul(h))} a draw`},
  stakes: {n:'Stakes',   t:3, st:'horseshoe',   d:'Arm: next 3 draws pay double premium.'},
  scrap:  {n:'Scrap',    t:3, st:'pick',  d:'Arm: the deck\'s top card goes OUT.'},
  relic:  {n:'Relic',    t:5, pm:6.2, st:'trophy',    d:'On bank: this card gains +5% value.',
           cur:(c,h)=>`now +${Math.round((c.r||0)*ECO.RELIC_PER*100)}%`},
  purge:  {n:'Purge',    t:4, pm:2.8, st:'bin',    d:'On bank: the whole hand waits in the discard.'},
  encore: {n:'Encore',   t:5, pm:5.8, st:'curtain',   d:'On draw: your deck and discard pile swap.',
           cur:(c,h)=>S.disc&&S.disc.length?`now ${S.disc.length} in the discard`:''},
  float:  {n:'Float',    t:4, pm:2.2, st:'buoyring', d:'Arm: at 70% risk the table pays out flat and zeroes. No premium.'},
  defuse: {n:'Defuse',   t:4, pm:2.4, st:'plunger',  d:'Arm: one deck card goes OUT, another to the discard. If neither would have busted, the table banks on the spot.'},
  swap:   {n:'Swap',     t:1, pm:.577, st:'leaves',   d:'Arm: becomes a random deck card\'s value, till it leaves the table.'},
  clip:   {n:'Clip',     t:2, pm:1.45, st:'hook', d:'Arm: pick a table card, it loses 1 value till it leaves the table.'},
  ghost:  {n:'Ghost',    t:3, pm:1.25, st:'pyrite', d:'Arm: pick a table card, it copies the table\'s lowest value till it leaves the table.'},
  patch:  {n:'Patch',    t:4, pm:2.4,  st:'chevron', d:'Arm: pick a table card, its value +1, for good.'},
  variety:{n:'Variety',  t:3, pm:1.25, st:'crown', d:'On a table: +10% mult per stickered card, itself included.',
           cur:(c,h)=>`now +${Math.round(ECO.VAR_PER*h.ids.filter(id=>byId(id).stk).length*100)}% mult`},
  dredge: {n:'Dredge',   t:4, pm:3.6, st:'bucket', d:'Arm: pick 1 of 2 OUT cards, become its copy till it leaves the table.'},
  fetch:  {n:'Fetch',    t:4, pm:2.6, st:'arrow',  d:'Arm: pick 1 of 3 OUT cards, it returns to the deck.'},
  riffle: {n:'Riffle',   t:5, pm:5.4, st:'orb', d:'Arm: peeks at 3 deck cards, becomes the sum of the lowest 2.'},
  bail:   {n:'Bail',     t:5, pm:6.4, st:'tophat',   d:'Arm: the table pays out in full, premium included, then zeroes. The run continues.'},
  draft:  {n:'Draft',    t:4, pm:2.8, st:'cherries',   d:'Arm: two cards come off the deck face up, keep one, the other waits in the discard.'},
  engrave:{n:'Engrave',  t:4, pm:3.4, st:'plate', d:'Arm: pick a table card, its shown value becomes permanent.'},
  fallout:{n:'Fallout',  t:5, pm:4.8, st:'comet',   d:'On bank: the whole hand is gone for good.'},
  /* the discard/OUT batch: payers and engines that live off the away piles */
  remnant:{n:'Remnant',  t:2, pm:.9, st:'remnant', d:'On bank: if this card sits in the discard, its value pays too.',
           cur:(c,h)=>`now +${fmt(cval(c)*payMul(h))} a bank`},
  layaway:{n:'Layaway', t:3, pm:.8, st:'layaway', d:'On a table: +5% payout per card in the discard.',
           cur:(c,h)=>`now +${Math.round(ECO.LAY_PER*(S.disc?S.disc.length:0)*100)}%`},
  guardian:{n:'Guardian',t:4, pm:1.5625, st:'guardian', d:'While this card sits OUT, a bust has a 1/3 chance to pay the table out flat. Unique: only one, ever.'},
  flinch: {n:'Flinch',   t:3, pm:1.1, st:'flinch', d:'On draw: if you draw a card that matches this card\'s value, it goes OUT. One catch a run.'},
  offering:{n:'Offering',t:2, pm:1.15, st:'offering', d:'Arm: this card leaves for OUT and the chain gains 1.'},
  recycle:{n:'Recycle',  t:3, pm:.9, st:'recycle', d:'On bank: the lowest-value card OUT returns to the deck.'},
  sub:    {n:'Sub',      t:2, pm:1.35, st:'sub', d:'Arm: this card waits in the discard and a random card OUT takes its seat.'},
  exit:   {n:'Exit',     t:2, pm:1.0277, st:'exit', d:'On bank: 2% of the discard\'s total value pays to score.',
           cur:(c,h)=>{const d=S.disc?S.disc.reduce((a,id)=>a+cval(byId(id)),0):0;
             return d?`now +${fmt(d*ECO.EXIT_PER*payMul(h))} a bank`:''}},
  /* the squeeze batch (2026-09-04): the deck is the victim — Whip
     strips its blanks away, Squeeze reads its pressure into a value,
     Strip trades the table's floor for a ward */
  whip:   {n:'Whip',    t:3, pm:1.35, st:'whip',  d:'On draw and on arm: the deck\'s first safe card goes to the discard.'},
  strip:  {n:'Strip',   t:4, pm:2.2,  st:'strip', d:'Arm: the table\'s lowest card leaves to the discard; gain 1 ward.'},
  squeeze:{n:'Squeeze', t:5, pm:5.6,  st:'squeeze', d:'Arm: peeks at 5 deck cards, becomes the sum of the risky ones.'}
};
for(const k in STK) STK[k].c = TIERC[STK[k].t];
const STKKEYS = Object.keys(STK);
/* benched (2026-09-03): benched stickers are out of the player's reach —
   the shop never stocks them, their gates never show or ready, the docs
   page grays them — but the mechanics stay live for placed copies, and
   one flag brings each back. Gild and the float pair (Float, Bail — the
   zero-the-table exits) and Fallout wait on a rework */
const STK_OFF = {gild:1, float:1, bail:1, fallout:1};
/* retired in the roster trim: bridge, trim, tithe, foil, reprint, heavy,
   wreck, cue. load() blanks any placed copy on an old save, the same
   road charm/peek took in v6 */
/* tricks: tap-to-arm, one arm per card per run, fires or expires — committed.
   The value modifiers ride the same rails: Swap/Riffle/Defuse fire on
   the tap like Scrap/Tell, Clip/Ghost/Patch ask for a target before they
   spend, Dredge and Fetch deal their picks out of the piles */
const TRICK = {cull:1, stakes:1, float:1, defuse:1, scrap:1, tell:1,
               swap:1, clip:1, ghost:1, dredge:1, riffle:1, patch:1,
               fetch:1, bail:1, draft:1, engrave:1, echo:1, twin:1,
               offering:1, sub:1, squeeze:1, whip:1, strip:1};
/* auras that apply once no matter how many copies sit on the tables */
const NONSTACK = {beacon:1, haste:1, guardian:1};
/* the in-game sticker compendium (compendium.js) opens once this many
   DIFFERENT stickers have been applied — you earn the reference by
   trying the roster */
const CMP_AT = 10;

/* presentation-side classification, shared by the in-game compendium
   (compendium.js) and the docs build (make-constants.js): type label
   and trigger caption per sticker. Unlisted stickers read as
   value / on the table. */
const STKTYPE = {
  gild:'value', twin:'value', prime:'value', mirror:'value', odds:'value',
  surge:'table', bloom:'table', kindle:'table', brass:'table', variety:'table',
  jynx:'table',
  tribute:'payer', mint:'payer', dividend:'payer',
  siphon:'payer',   /* pays on bust, never decides survival — insurance's law */
  rake:'out-pay',   /* +2 a card per OUT — Tab and Ledger's little sibling */
  ledger:'out-pay', tab:'out-pay',
  ward:'insurance', anchor:'insurance', purify:'insurance',
  strip:'insurance',   /* the point is the ward it stands; the bench is the price */
  haste:'aura', beacon:'aura',
  cull:'trick', stakes:'trick', float:'trick',
  /* type = engine, not trigger: the rewriter tricks (Swap/Clip/Ghost/
     Patch/Dredge/Riffle/Engrave/Squeeze) only rewrite what a table card is
     worth, while Scrap/Fetch/Defuse work the deck and its piles — cuts
     to OUT, a discard rider, and the tap-time bank when both cuts came
     back safe. Dredge reads OUT but moves nothing, so it stays a
     trick, not an OUT engine */
  defuse:'out', scrap:'out', tell:'trick', fetch:'out', bail:'trick',
  draft:'trick', engrave:'trick',
  swap:'trick', clip:'trick', ghost:'trick', patch:'trick',
  dredge:'trick', riffle:'trick', squeeze:'trick',
  /* pile engines split by pile: OUT exile vs the discard bench.
     Straddlers file by payload — Defuse's point is the OUT exile (the
     mate's bench ride is the side effect), Sub's payload is the OUT
     card taking the seat. Fallout deletes outright; OUT is the
     nearest pile. The payoffs split the same way: out-pay reads OUT,
     disc-pay reads the bench */
  snip:'discard', burn:'discard', echo:'discard', reverb:'discard',
  whip:'discard', purge:'discard', encore:'discard',
  scrap:'out', vanish:'out', defuse:'out', fetch:'out',
  offering:'out', sub:'out', recycle:'out', flinch:'out', fallout:'out',
  remnant:'disc-pay', exit:'disc-pay', layaway:'disc-pay',
  guardian:'insurance',
};
const STKTRIG = {
  cull:'arm → instant',
  stakes:'arm → 3 draws',
  float:'arm → 70% risk', defuse:'arm → instant', scrap:'arm → instant',
  tell:'arm → instant',
  swap:'arm → instant', dredge:'arm → pick from OUT', riffle:'arm → instant',
  clip:'arm → pick a target', ghost:'arm → pick a target', patch:'arm → pick a target',
  fetch:'arm → pick from OUT',
  bail:'arm → instant', draft:'arm → keep one of two', engrave:'arm → pick a value',
  echo:'arm → scan the top 3', twin:'arm → instant',
  anchor:'on draw', reverb:'on draw', ward:'on draw', fallout:'on bank',
  odds:'on draw',
  tribute:'on draw', rake:'on draw', snip:'on draw', burn:'on draw',
  mint:'on bank', dividend:'25% on bank', vanish:'on bank', purge:'on bank',
  encore:'on draw',
  bloom:'50% on bank', kindle:'40% on bank',
  relic:'on bank', siphon:'on bust',
  haste:'on table', beacon:'on a table',
  remnant:'on bank', guardian:'1/3 on bust', flinch:'on draw, value match',
  offering:'arm → instant', recycle:'on bank', sub:'arm → swap from OUT',
  exit:'on bank',
  squeeze:'arm → scan 5', whip:'on draw + arm', strip:'arm → instant',
};

/* the lil compendium: the game's own words, one line each. It renders
   inside the in-game compendium (compendium.js) and, hand-written, on
   stickers.html */
/* card conditions (docs/card-modifiers.md): rolled onto cards bought
   from the DECK tab once the press is live (ECO.COND_LIVE). Effects:
   cval layer (soggy, nearmint's bends), cardValue (graded, dogeared),
   the resolve bust branch (bent, nearmint), the resolve landing
   (ripped: a ward, then 2 more cards), the cooldown (promo), the
   discard sweep (used), Collector's Eye (dogeared, glass), the felt
   paint (table.js). c.cond is an array; c.nb counts nearmint bends. */
const COND = {
  soggy:   {n:'Soggy',     d:'Worth 1 less, for good.'},
  nearmint:{n:'Near Mint', d:'Its own draw cannot bust a twin: the value bends 1 first.'},
  used:    {n:'Used',      d:'Waits out one extra score in the discard.'},
  graded:  {n:'Graded',    d:'MINO 10: pays x1.25.'},
  bent:    {n:'Bent',      d:'Its own draw cannot bust: it goes OUT instead.'},
  promo:   {n:'Promo',     d:'Draws free: landing it never starts the cooldown.'},
  dogeared:{n:'Dog-Eared', d:'Collector\'s Eye ignores it.'},
  glass:   {n:'Glass',     d:'See-through. Collector\'s Eye ignores it.'},
  ripped:  {n:'Ripped',    d:'On draw: pays 1 ward, then deals 2 more cards.'}
};
const LINGO=[
  ['Risky card','A card in the deck whose value matches a value on your table. Draw it and the hand busts.'],
  ['Blank','A deck card that cannot bust you: its value matches nothing on the table, or Purify ate it.'],
  ['The gauge','Risky cards ÷ deck size. It shows the danger and pays the premium.'],
  ['Premium','Extra pay for danger: the hotter the gauge at a bank, the more the table pays. Under 40% risk the table pays 60% to 100%. At 100% risk it pays double.'],
  ['Effect pays','Tribute, Rake, Siphon, Mint, Remnant and Exit pay their amount through every multiplier the table pays: value, hand mult, chain, premium, the works.'],
  ['Floated','Paid out once, now worth 0. Float and Bail zero the table; floated cards keep their multiplier seat till a bust clears them.'],
  ['Discard',"A Ward save, Snip's cut, Whip's cut, Defuse's second, Burn's pair, Reverb's take, Echo's scan, Draft's spare, a Twin's blank, Sub's carrier, Strip's lowest or a Purged hand joins the set-aside pile, home when you score. A bust leaves it be. A Remnant in the pile pays its value at the score; Encore trades the pile for the deck."],
  ['OUT','The exile pile. Scrap, Defuse, Cull\'s own card, Vanish, Exit, a Flinch match, an Offering and the card that landed the bust sit here. Every bust brings the pile home and deals the buster out in its place, so one card always sits out. They feed Tab and Rake; Ledger doubles a table card whose twin sits here; Guardian watches from the pile, a 1/3 shot any bust pays flat; Recycle runs the lowest card home each bank.'],
  ['Set aside',"Cull's trade: the card itself goes OUT, a ward stands in its place till it saves a draw."],
  ['Chain','Consecutive banks on one table without its bust. A bust breaks it; a bank too small for the combo trims 1.'],
  ['Run',"One hand's life: from its first card till a bank or a bust clears it."],
  ['Rewrite',"A temp value a table card wears: Swap, Clip, Ghost, Dredge, or Riffle. It lasts while the card stays in play; the printed value comes back when it leaves. Engrave makes one permanent."],
  ['Arm','Tap a trick on the felt to charge it. One arm per card per run; it fires or expires, spent either way.'],
  ['On bank roll','Bloom, Kindle and Dividend gamble on the bank: every copy flips its own chance, hits pay, misses sit. A Dividend hit scores the table again.'],
];

/* upgrades — bought with score, reset on ascension. A row shows once its
   u-goal is claimed in the GOALS tab (speed and value are open from the
   start); bought rows stay visible. */
/* desc may be a function of the current level — renderUp calls it.
   Stacking descs append their running total once owned: "(+30% total)" */
const tot =(per,l,u='%')=>l?` (+${+(per*l).toFixed(2)}${u} total)`:'';
const totm=(per,l,u='%')=>l?` (−${+(per*l).toFixed(2)}${u} total)`:'';
/* rows that shrink what's LEFT, not the whole: per level ×f, so the
   total is 1−f^l and needs its own non-linear helper */
const totmR=(f,l,u='%')=>l?` (−${+(100*(1-Math.pow(f,l))).toFixed(2)}${u} total)`:'';
const UPG = {
  speed:  {n:'Swift Hands',    d:l=>'−5% of remaining draw cooldown'+totmR(.95,l), max:20, base:20,   g:1.55},
  value:  {n:'Sharp Ink',      d:l=>'+5% value on every card'+tot(5,l),            max:30, base:30,   g:1.45},
  mult:   {n:'Momentum',       d:l=>'+0.05 to the per-card multiplier step'+tot(.05,l,''), max:25, base:55,  g:1.85},
  nerve:  {n:'Nerve',          d:l=>'make risk multiplier 10% more effective'+tot(10,l),          max:12, base:130,  g:1.9},
  salv:   {n:'Salvage',        d:l=>'Keep 5% of the table when you bust'+tot(5,l), max:10, base:220,  g:1.8},
  chain:  {n:'Chain Reaction', d:l=>'+1% per bank in current chain'+tot(1,l),  max:20, base:100,  g:2.05},
  eye:    {n:"Collector's Eye",d:l=>`+0.1% value per card you own —your ${eyeCount()} cards pay +${(ECO.EYE_PER*l*eyeCount()*100).toFixed(1)}% now`, max:15, base:320, g:1.71},
  auto:   {n:'Auto-Draw',      d:l=>(l?`Draws for you — deals up to ${l} card${l===1?'':'s'} a table, then waits`:'Draws for you — one card a table, then it waits')+(OFFLINE_ON?'. Offline earnings on.':'.') , max:6, base:1000, g:2.1},
  guard:  {n:'Draw Stop',       d:l=>l?`The draw-stop dial reaches ${Math.round(ECO.GUARD_AT[l-1]*100)}% risk.`:'Set where Auto-draw quits.', max:4, base:1000, g:1.6},
  marked: {n:'Marked Deck',    d:l=>'1% chance a twin slips past you'+tot(1,l),    max:30, base:500,  g:1.2},
  /* the swipe-up pre-flick: costs pin their own ladder (upCost), the
     level is how many flicked cards may wait on the felt at once */
  flick:  {n:'Pre-Flick',      d:l=>'Swipe up mid-cooldown and the next card waits on the felt'+(l>1?`, up to ${l} at once`:''), max:3, c:l=>[500,1500,5000][l]},
  sleight:{n:'Sleight of Hand',d:l=>'+3% value per card outside the deck'+tot(3,l), max:8,  base:680,  g:2.0},
  house:  {n:'House Money',    d:'First bank of a chain pays +25%',            max:1,  base:4800, g:1},
  abank:  {n:'Auto-Bank',      d:'Banks alone at a risk line you set',         max:1,  base:6800, g:1},
  grace:  {n:'Grace',          d:l=>'+1 ward each run'+tot(1,l,''),                max:2,  base:77700, g:2.2},
  over:   {n:'Overload',       d:l=>'+8% per level while you hold 10+ cards'+tot(8,l), max:5,  base:4000, g:2.01},
  iron:   {n:'Iron Nerve',     d:'A bust keeps the chain, once per chain',    max:3,base:44000,g:1},
  high:   {n:'High Roller',    d:l=>'+15% value on cards of 8+'+tot(15,l),         max:10, base:8192, g:1.8},
  split:  {n:'Split',          d:l=>'Deal one more hand, same deck'+tot(1,l,''),   max:3,  base:32000, g:3},
  deep:   {n:'Deep Cuts',      d:l=>'+20% value on cards of 14+'+tot(20,l),        max:10, base:64000,g:2.01}
};

/* shard upgrades — permanent. Every row opens via its goal (the SU rows
   in ACH), the same shape as the UPGRADES rows: the row stays hidden
   until the goal is claimed, bought rows stay visible.
   Costs grow exponentially: level N costs ceil(c0 x g^N), c0 matched to
   the old linear level-1 price, g 1.3-1.6 by row (rally 2.0). Early
   levels price like the old ladder; the tail is the chase.
   [max, costFn(level), desc — desc may be fn(level)] */
const META = {
  prodigy:{n:'Prodigy',      d:l=>'+25% card value, forever'+tot(25,l),             max:25, c:l=>Math.ceil(1*Math.pow(1.30,l))},
  quick:  {n:'Quickdraw',    d:l=>'−3% of remaining cooldown, forever'+totmR(.97,l), max:10, c:l=>Math.ceil(2*Math.pow(1.45,l))},
  rich:   {n:'Seed Money',   d:'Start each ascension with score',                   max:12, c:l=>Math.ceil(2*Math.pow(1.40,l))},
  head:   {n:'Head Start',   d:'Own every set up to value 3 + level',         max:9,  c:l=>Math.ceil(4*Math.pow(1.50,l))},
  keeper: {n:'Keeper',       d:'Keep best stickered cards through ascension',  max:8,  c:l=>Math.ceil(6*Math.pow(1.50,l))},
  daring: {n:'Daring',       d:l=>'+8% to the risk premium, forever'+tot(8,l),      max:10, c:l=>Math.ceil(5*Math.pow(1.45,l))},
  dreamer:{n:'Dreamer',      d:l=>OFFLINE_ON?'+15% offline rate, +2h cap'+(l?` (+${15*l}%, +${2*l}h total)`:''):'Offline earnings are paused'+(l?` (+${15*l}%, +${2*l}h waiting)`:''), max:8,  c:l=>Math.ceil(3*Math.pow(1.50,l))},
  trader: {n:'Trader',       d:l=>'−12% sticker prices, faster restock'+totm(12,l), max:6,  c:l=>Math.ceil(4*Math.pow(1.60,l))},
  fortune:{n:'Fortune',      d:l=>'+12% shards when you ascend'+tot(12,l),          max:12, c:l=>Math.ceil(5*Math.pow(1.50,l))},
  rebound:{n:'Rebound',      d:l=>'After a bust: next bank +12% per level'+tot(12,l), max:4,  c:l=>Math.ceil(8*Math.pow(1.80,l))},
  storage:{n:'Cold Storage', d:l=>'+6% value per level per card outside'+tot(6,l),  max:6,  c:l=>Math.ceil(6*Math.pow(1.50,l))},
  press:  {n:'The Press',    d:l=>'Cards cost 6% less per level'+totm(6,l),         max:8,  c:l=>Math.ceil(5*Math.pow(1.50,l))},
  vantage:{n:'Vantage',      d:'The next card peeks face-up on the table',      max:1,  c:()=>24},
  stall:  {n:'Corner Stall', d:'The Fixer stocks a fourth slot',                max:1,  c:()=>16},
  union:  {n:'Union Card',   d:'The Fixer stocks a fifth slot',                 max:1,  c:()=>36},
  preprint:{n:'Preprint',   d:l=>l?`Start each ascension with ${l} random stickers on the deck`:'Start each ascension with a random sticker on the deck', max:6, c:l=>Math.ceil(6*Math.pow(1.60,l))},
  rally:  {n:'Rally',        d:'A bust keeps the chain, once more per chain',   max:2,  c:l=>Math.ceil(20*Math.pow(2.0,l))},
  silver: {n:'Silver Lining',d:'A bust under 10% risk pays the table out flat', max:1,  c:()=>45},
  pendant:{n:'Marked Pendant',d:'Marked Deck slips up to 50%, not 30%',          max:1,  c:()=>18},
  luster: {n:'Luster',       d:l=>'+5% to the shiny roll, forever'+tot(5,l),     max:5,  c:l=>Math.ceil(25*Math.pow(5,l))}
};

/* goals: A = unlocks a sticker, U = unlocks an upgrade, B = permanent bonus
   (v = value mult, s = shard mult). Every sticker has exactly one gate and
   every gate's difficulty rides the sticker's tier: the first goals a
   player meets open t1 stock and upgrade rows, the t5s ask for
   ascension-era numbers. Benched stickers (STK_OFF) never show their
   gates. Ladders per pillar (t1 → t5) —
   wide hands (swap 4 → odds 5 → surge 6; b10 Deep Diver 12; Twin
   lands past the ceiling once it pulls),
   banks (mint: 10 runs of 3+ cards),
   bank quality (ward: 3+ cards, every card worth 3+),
   pile pairs (defuse: 3 OUT and 3 in the discard at once),
   chains (brass 6 → bloom's wide rows; b11 12),
   wide rows (haste: 3+ cards, 6 banks in a row; u16 Teflon 15 at
   3+ cards; bloom: 5+ cards, 3 banks),
   hot streaks (beacon 7 → stakes 7; float's row is benched with
   its sticker),
   costly busts (tribute 600 → siphon 1,500),
   the out pile at once (scrap 6 → ledger 8 → draft 10; fallout's 16 is
   benched with its sticker), cumulative, voluntary only
   (burn 150; the bust cycle's buster seat is the game's own doing,
   counts for nothing),
   discards (rake 8 → snip 15 → purge 500; ward saves and cuts feed
   them), discard depth (remnant 4 → layaway 8 in the discard at
   once; exit's fed benches ride the same cutters), safe cuts (whip
   50: Burn's pairs, Draft's spares, Defuse's second, Reverb's take
   and Snip's blind cut all feed it — a cut counts only while the
   card was a blank), wards lost (strip 100: every ward a bust
   spends — Ward's rider, Grace and Rip scars feed it), bust width
   (squeeze 12: a 12-card hand dies), cold busts
   (flinch: a landing at the 5% gauge or less), ones out (offering:
   a worth-1 card sits OUT), full-ink banks (guardian: 5+ cards,
   banked lifetime), early stickered busts (recycle: a 2-card
   hand, both papered), fed-pile banks (sub: a card in each away
   pile, 10 banks),
   arming (cull 15 → tell 20), out-running banks (vanish 5 at
   3 out → fetch 5 at 5 out → tab 6 at 6 out),
   lifetime draws (reverb 500), sticker draws (echo: 150 via effects;
   draft and ward feed it),
   gambles (kindle: 10 hits, Bloom and Dividend teach).
   A hand can hold each value only once — a second copy of any held value
   busts — so hand size and per-run draws top out near the values you have
   unlocked; the wide and long-hand ladders are scaled to that ceiling
   (Twin's pull is the one exception, by design). The pair build lives
   inside that exception: Twin Twin asks for 2 pairs on one bank, Quadro
   for the same value 4 times — Twin pulls and Purify seats are the only
   ways a duplicate lands.
   Milestones sit at the top: purify asks for the first ascension, relic
   for a 250K chain, encore for five straight 100K banks.
   Composition bonuses bank beside them: Twin Town (two of a sticker),
   The Works (all
   three gambles, one bank), Balanced Books (every twin OUT),
   Boomerang (Fetch's card finally cashed).
   U-goals open UPGRADES rows one rung below the matching sticker ladder —
   the upgrade teaches the mechanic, the sticker rewards mastering it.
   SU-goals open SHARD UPGRADES rows the same way. No gate lands before
   the first ascend: the shard layer never shows up before shards do.
   The first rungs are counters pinned at ascend-era totals, the rest
   are feats and builds, and the deepest ask for the second and third
   ascension.
   A goal may never ask for its own sticker's effect: the shop stocks a
   sticker only after its gate is claimed. Where the mechanic would gate
   itself (fetch's
   returns, draft's picks, engrave's carves) the goal reads the skill's
   precursor instead — draws, arms, busts, out-running banks, rewrites —
   or another sticker that shares the effect. One or two ways into a
   gate is good puzzle texture; zero is a lock. test.js section 20 walks
   the whole graph: reachability, mapped stats, tier-climbing rungs. */
const A = (id,n,d,stk,g,t)=>({id,n,d,stk,g,t});
const B = (id,n,d,v,g,t,s)=>({id,n,d,v,s,g,t});
/* a U-goal may set lv: it gates that LEVEL of the upgrade, not just the
   row — the row-opening goal holds level 1 by default */
const U = (id,n,d,up,g,t,lv)=>({id,n,d,up,g,t,lv});
/* an SU-goal gates a SHARD UPGRADES row the same way (meta names the
   META key; lv holds that level, row-open is level 1) */
const SU = (id,n,d,meta,g,t,lv)=>({id,n,d,meta,g,t,lv});
const ACH = [
  A('g1','Big Score','Bank 15,000 in one run','gild',()=>S.st.bestBank,15000),
  A('g2','Full Hands','Bank 3 cards or more on 6 banks in a row','haste',()=>S.st.bestRow3||0,6),
  A('g3','Bad Beat','Bust a hand worth 600','tribute',()=>Math.round(S.st.bestBust),600),
  A('g4','Five Wide','Hold 5 cards at once','odds',()=>S.st.bigHand,5),
  A('g5','No Small Change','Bank 3 or more cards, every one worth 3 or more','ward',()=>S.st.richBanks||0,1),
  A('g6','Six Wide','Hold 6 cards at once','surge',()=>S.st.bigHand,6),
  A('g7','Hot Hands','Bank 10 gamble hits','kindle',()=>S.st.hits||0,10),
  A('g8','Eight Shooter','Own the 8s','mirror',()=>ownedOf(8),8),
  B('g9','Thick Skin','Bust 8 times',.10,()=>S.st.busts,8),
  A('g10','Steady Hands','Deflect 15 risky cards','anchor',()=>S.st.deflects,15),
  A('g11','Stacked Deck','Own 30 cards','prime',()=>S.cards.length,30),
  A('g12','Nerve Test','Bank 60% risk or higher on 7 banks in a row','beacon',()=>S.st.hot60||0,7),
  A('g13','Deep Pantry','Have 10 cards out of the deck at once','draft',()=>S.st.maxOut,10),
  A('g14','Second Verse','Draw 1000 cards','reverb',()=>S.st.draws,500),
  A('g15','On a Roll','Bank 5 cards or more on 3 banks in a row','bloom',()=>S.st.bestWide||0,3),
  A('g16','Reborn','Ascend once','purify',()=>S.asc,1),
  A('g17','Reckless','Bust a hand worth 1,500','siphon',()=>Math.round(S.st.bestBust),1500),
  A('g18','Escape Artist','Bank 5 runs with 3 cards out','vanish',()=>S.st.outBanks,5),
  A('g19','Off the Books','Have 8 cards out of the deck at once','ledger',()=>S.st.maxOut,8),
  A('g20','Heirloom','Bank 250,000 across one chain','relic',()=>S.st.bestChain,250000),
  A('g21','Arms Race','Arm 15 tricks','cull',()=>S.st.arms||0,15),
  A('g22','Full Bin','Send 500 cards to the discard','purge',()=>S.st.discarded||0,500),
  A('g23','Haircut','Send 15 cards to the discard','snip',()=>S.st.discarded||0,15),
  A('g24','Card Sense','Charge 20 tricks','tell',()=>S.st.arms||0,20),
  A('g25','Scorched Earth','Put 150 cards out of the deck','burn',()=>S.st.outed||0,150),
  A('g26','Six Out','Have 6 cards out of the deck at once','scrap',()=>S.st.maxOut,6),
  A('g27','Running Hot','Bank 70% risk or higher on 7 banks in a row','stakes',()=>S.st.hot70||0,7),
  A('g28','High Wire','Bank 80% risk or higher on 6 banks in a row','float',()=>S.st.hot80||0,6),
  A('g29','Evidence Locker','Have 3 cards OUT and 3 in the discard at once','defuse',()=>S.st.bothPiles||0,3),
  A('g30','Payday','Bank 10 runs holding 3 or more cards','mint',()=>S.st.bigBanks||0,10),
  A('g32','Six Straight','Bank 6 runs in a row, no bust','brass',()=>S.st.bestChainN,6),
  A('g37','Double or Nothing','Bank 6 gamble hits','dividend',()=>S.st.hits||0,6),
  A('g38','Running Tabs','Bank 6 runs with 6 cards out','tab',()=>S.st.fleetBanks||0,6),
  A('g40','Off Cuts','Send 8 cards to the discard','rake',()=>S.st.discarded||0,8),
  A('g41','Four Wide','Hold 4 cards at once','swap',()=>S.st.bigHand,4),
  A('g42','Whittled','Change 50 card values','clip',()=>S.st.rewrites||0,50),
  A('g43','Understudy','Change 150 card values','ghost',()=>S.st.rewrites||0,150),
  A('g44','Secondhand','Wear 5 rewrites worth 20 or more','dredge',()=>S.st.bigRewrites||0,5),
  A('g45','Vaulted','Bank 60,000 in one run','twin',()=>S.st.bestBank,60000),
  A('g46','Collector','Have 6 stickered cards on the tables','variety',()=>S.st.bigStk||0,6),
  A('g47','Hot Streak','Bank 100,000 on 5 banks in a row','encore',()=>S.st.bestStreak||0,5),
  A('g50','Hexed','Bank a table with 12 risky cards in the deck','jynx',()=>S.st.bestRisky||0,12),
  A('g51','Rescue','Bank 5 runs with 5 cards out','fetch',()=>S.st.deepBanks||0,5),
  A('g52','Overboard','Float a table worth 250,000','bail',()=>S.st.bestFloat||0,250000),
  A('g53','Pulling Strings','Draw 150 cards via sticker effects','echo',()=>S.st.stkDraws||0,150),
  A('g55','Sum Game','Land 11 rewrites worth 20 or more','riffle',()=>S.st.bigRewrites||0,11),
  A('g56','Chiseled','Change 500 card values','engrave',()=>S.st.rewrites||0,500),
  A('g57','Exodus','Have 16 cards out of the deck at once','fallout',()=>S.st.maxOut,16),
  /* the shine: holo vinyl, cosmetic until the table math says otherwise.
     The unlock itself is not a goal — it lives in the GOALS tab next to
     de-bolt, gated on 5 cold busts (shinyUn, economy.js) */
  B('g58','First Shine','Place a shiny sticker',.05,()=>S.st.shinyPlaced||0,1),
  B('g59','Holo Hand','Hold 3 shinies on one table',.10,()=>S.st.bestShine||0,3),
  B('g60','Press Run','Place 7 shiny stickers',.10,()=>S.st.shinyPlaced||0,7,.10),
  B('b1','Collector','Own 25 cards',.05,()=>S.cards.length,25),
  B('b2','Hoarder','Own 60 cards',.10,()=>S.cards.length,60),
  B('b3','Four Figures','Bank 1,000 in one run',.05,()=>S.st.bestBank,1000),
  B('b4','Whale','Bank 100,000 in one run',.15,()=>S.st.bestBank,1e5),
  B('b5','Full House','Own the 10s',.10,()=>ownedOf(10),10),
  B('b6','Apex','Own a card worth 20',.25,()=>ownedOf(20),1),
  B('b7','Marathon','Bank 50,000 across one chain',.10,()=>S.st.bestChain,5e4),
  B('b8','Fixed Up','Place 10 stickers on cards',.10,()=>Math.max(S.st.placed||0,S.cards.filter(c=>c.stk).length),10),
  B('b9','Snake Eyes','Bust on a double 2, 2 busts in a row',.10,()=>S.st.db2Best||0,2),
  B('b10','Deep Diver','Hold 12 cards at once',.20,()=>S.st.bigHand,12),
  B('b11','Untouchable','Bank 12 runs in a row, no bust',.15,()=>S.st.bestChainN,12),
  B('b12','Cycle','Ascend 5 times',0,()=>S.asc,5,.25),
  B('b13','Committed','Arm 10 tricks',.10,()=>S.st.arms||0,10),
  B('b14','Juggler','Hold cards on 3 tables at once',.10,()=>S.st.maxTables||0,3),
  /* the first-hour score rows: deliberate plays, not milestones the buy
     ladder walks you past — the upgrade pair is build commitment,
     Collage is the first loadout */
  B('b15','Specialist','Buy 3 levels of one upgrade',.05,()=>Math.max(0,...Object.values(S.up)),3),
  B('b16','Outfitted','Buy 10 upgrades in total',.05,()=>Object.values(S.up).reduce((a,b)=>a+b,0),10),
  B('b17','Collage','Bank 3 runs holding 2 different stickers',.10,()=>S.st.stkKinds||0,3),
  /* the arms ladder's far rung: the autos' own switches (AUTOMATION
     sheet, AUTO-ARM block) make 100 a season, not a grind */
  B('b18','Second Nature','Arm 100 tricks',.15,()=>S.st.arms||0,100),
  /* composition bonuses: the loadout is the puzzle — read the gate, then
     spec the stickers that satisfy it */
  B('g61','Twin Town','Bank 3 runs holding two copies of the same sticker',.10,()=>S.st.twinTowns||0,3),
  B('g62','The Works','Fire Bloom, Kindle and Dividend in one bank',.15,()=>S.st.works||0,1),
  B('g63','Balanced Books','Bank 3 or more cards with every twin OUT',0,()=>S.st.books||0,1,.15),
  B('g64','Boomerang','Bank 3 cards Fetch brought back',0,()=>S.st.boomerangs||0,3,.10),
  /* the pair build: the one-value-per-hand law bows to Twin's pull and
     to a Purify seat, so duplicated values are a spec, not luck. The
     stat is a record — the deepest one-value stack ever banked — so the
     ladder rides it: Quadro claims /4, deeper rungs can claim /8 later */
  B('g78','Twin Twin','Bank a hand with 2 pairs',.05,()=>S.st.bestPairs||0,2),
  B('g79','Quadro','Bank a hand with the same value 4 times',.20,()=>S.st.bestStack||0,4),
  A('g66','Patched','Change 300 card values','patch',()=>S.st.rewrites||0,300),
  /* the discard/OUT batch: every gate reads a pile-side stat the batch's
     own sticker never feeds (Remnant pays the pile, it does not fill it) */
  A('g67','On the Shelf','Have 4 cards in the discard at once','remnant',()=>S.st.maxDisc||0,4),
  A('g68','Inked Up','Bank 5 cards or more, every one stickered','guardian',()=>S.st.inkBanks||0,1),
  A('g69','Long Odds','Bust a hand at 5% risk or less','flinch',()=>S.st.coldBusts||0,1),
  A('g70','One Out','Put a card worth 1 out of the deck','offering',()=>S.st.oneOut||0,1),
  A('g71','Paper Cut','Bust a 2-card hand, both cards stickered','recycle',()=>S.st.twoStkBusts||0,1),
   A('g72','Two Pockets','Bank 10 runs with a card in the discard and a card OUT','sub',()=>S.st.pileBanks||0,10),
  /* Exit: the bench's payoff rung — feeds the discard-pay family's
     early era, the mirror of Vanish's OUT banks. Its gate reads fed
     benches, which any cutter or save feeds */
  A('g73','Rain Check','Bank 5 runs with 3 cards in the discard','exit',()=>S.st.benchBanks||0,5),
  /* Layaway: the bench-depth rung, one ladder above Remnant's shelf */
  A('g74','Will Call','Have 8 cards in the discard at once','layaway',()=>S.st.maxDisc||0,8),
  /* the squeeze batch: the gates read what the deck and the shields
     already do — Cold Cuts counts blanks any cutter benches (never
     Whip alone), Broken Guards counts every ward a bust spends
     (Ward's rider and Grace feed it without Strip), Pileup reads the
     hand as it died */
  A('g75','Cold Cuts','Send 50 safe cards to the discard','whip',()=>S.st.safeDisc||0,50),
  A('g76','Broken Guards','Lose 100 wards','strip',()=>S.st.wardLost||0,100),
  A('g77','Pileup','Bust a hand of 12 cards or more','squeeze',()=>S.st.bigBustN||0,12),
  /* upgrade gates, in UPG order — each a rung below its sticker ladder;
     Split can't ask for tables (it deals the second one), so it asks for banks */
  U('u1','No Touching','Bank 3 cards or more, every pair 2+ apart','mult',()=>S.st.spread||0,3),
  U('u2','Warm Up','Draw 400 cards','nerve',()=>S.st.draws,400),
  U('u3','Fender Bender','Bust a hand worth 50','salv',()=>Math.round(S.st.bestBust),50),
  U('u4','Five Straight','Bank 5 runs in a row, no bust','chain',()=>S.st.bestChainN,5),
  U('u5','Muscle Memory','Bank 100 runs holding 3 or more cards','auto',()=>S.st.bigBanks||0,100),
  U('u6','Side Deck','Own 20 cards','eye',()=>S.cards.length,20),
  U('u7','Crash Test','Bust 50 times with the autos drawing','guard',()=>S.st.aBusts||0,50),
  U('u8','Graze','Deflect 10 risky cards','marked',()=>S.st.deflects,10),
  U('u20','Centapent','Bank 100 Fives','flick',()=>S.st.fiveBanks||0,100),
  U('u9','Light Fingers','Put 30 cards out of the deck','sleight',()=>S.st.outed||0,30),
  U('u10','Ten Grand','Bank 10,000 in one run','house',()=>S.st.bestBank,1e4),
  U('u12','Clockwork','Bank 10 hands holding a 1, a 2 and a 3','abank',()=>S.st.oneTwoThree||0,10),
  U('u13','Rainbow','Bank 7 runs of 7 different cards','grace',()=>S.st.rainbows||0,7),
  U('u19','Cold Blood','Ward off 15 risky cards under 10% risk','grace',()=>S.st.coldWards||0,15,2),
  U('u14','Big Slick','Bank 25,000 in one run','high',()=>S.st.bestBank,25e3),
  U('u15','Greedy','Hold 8 cards at once','over',()=>S.st.bigHand,8),
  U('u16','Teflon','Bank 15 runs with 3 or more cards in a row','iron',()=>S.st.bestRow3||0,15),
  U('u17','Daredevil','Bank 500 runs at over 50% risk','split',()=>S.st.hotBanks||0,500),
  U('u18','High Gear','Own the 12s','deep',()=>ownedOf(12),12),
  /* shard-upgrade gates: every SHARD UPGRADES row opens via its goal, and
     no gate lands before the first ascend. The first two rungs are
     counters whose totals only the ascension-era game reaches; the rest
     are feats, records and pile/twin builds whose producers are deep-tier
     engines, so the row opens when the build it belongs to already
     exists. A shard gate may never ask for its own upgrade's effect:
     Silver Lining reads cold WARDS (the discipline it insures), Rally
     reads the chain record. One or two ways into a gate is the point:
     the gate names a build, the player specs it. sim.js goals times
     every gate against the ascend minute. Shine Collector reads buys,
     not placements: the roll rate is Luster's own effect, so its gate
     counts what the shelf sold */
  SU('m1','Jackpot','Bank exactly 7 cards on 3 consecutive turns','prodigy',()=>S.st.bestSeven||0,3),
  SU('m2','Tempo','Draw 8,500 cards','quick',()=>S.st.draws,8500),
  SU('m3','Hard Times','Bust a hand worth 4,000','rich',()=>Math.round(S.st.bestBust),4000),
  SU('m4','Night Shift','Bank 750,000 across one chain','dreamer',()=>S.st.bestChain,75e4),
  SU('m5','Well Rounded','Hold every value, 1s through 10s, on the tables at once','head',
    ()=>S.st.boardVals||0,10),
  SU('m6','Papered','Place 40 stickers','trader',()=>S.st.placed,40),
  SU('m7','Edge Walker','Bank 80% risk or higher on 10 banks in a row','daring',()=>S.st.hot80||0,10),
  SU('m8','Deep Bench','Own 95 cards','press',()=>S.cards.length,95),
  SU('m9','Long Memory','Bank 3 or more cards with every twin OUT, four times','storage',()=>S.st.books||0,4),
  SU('m10','Finest Work','Have 12 stickered cards on the tables','keeper',()=>S.st.bigStk||0,12),
  SU('m11','Third Life','Ascend 3 times','fortune',()=>S.asc,3),
  SU('m12','Two Timer','Bust on the pair of 2s 20 times','rebound',()=>S.st.db2N||0,20),
  SU('m13','Print Run','Bank 550 stickered cards','preprint',()=>S.st.stkBanked||0,550),
  SU('m14','Double Prints','Bank 10 runs holding two copies of the same sticker','stall',()=>S.st.twinTowns||0,10),
  SU('m15','Cold Case','Have 8 cards OUT and 8 in the discard at once','vantage',()=>S.st.bothPiles||0,8),
  SU('m16','Four Corners','Hold cards on 4 tables at once','union',()=>S.st.maxTables||0,4),
  SU('m17','Long Haul','Bank 10 in a row with 5 or more cards','rally',()=>S.st.bestWide||0,10),
  SU('m18','Nerves of Ice','Ward off 40 risky cards under 10% risk','silver',()=>S.st.coldWards||0,40),
  SU('m19','Marked Man','Deflect 120 risky cards','pendant',()=>S.st.deflects,120),
  SU('m20','Shine Collector','Buy 3 shiny stickers','luster',()=>S.st.shinyBought||0,3)
];

/* ---------------- economy constants (from sim.js) ---------------- */
const ECO = {
  CARD_LADDER:[[5],[6,8],[10,13,16],[20,25,30,40],[50,65,80,95,120]], CARD_ANCHOR:50, CARD_ANCHOR_V:5, CARD_STEP:2.113762, CARD_GROW:2.25, // cardCost: tiers 1-5 are hand-set ladders, one price per copy (the 4s pay 20/25/30/40, the 5s open the climb at 50); tiers 6+ run anchor*step^(v-anchorV)*(v/anchorV) with copies spanning one grow factor (step stays past the span so openers never dip under the last copy) — lifetime spend through tier 10 lands on exactly 100,000, millions by the 14s
  STK_BASE:450, STK_TPOW:2.0, STK_GROW:1.10, STK_INF:.02, // t1 stickers spread 230-460 via pm, sorted by utility (2026-09-02 pass: each opener 60-100 cheaper); t2 the same way (2026-09-05 pass: the flat 1800 broke into 850 at siphon, 2400 at cull; clip still tops the shelf at 2610; surge .5499 not .55 — float 1800×.55 = 990.0000000000001 ceils to 991); deep tiers carry their era in pm: t4 ~16-26K, t5 ~47-72K (income at shelf-open runs ~1.4K/2.8K a min, so payback lands ~14m/~20m); uniques (NONSTACK) carry their own marker, no longer one tier up: haste 1111, beacon 4050; duplicates of a sticker: ×grow per copy owned; every applied sticker adds +3% to the others' price (spread tax)
  ASC_REQ:230000, ASC_REQ_GROW:2.5,                  /* the Nth ascend banks against REQ x 2.5^N (live-service stretch) */
  SHALL_PER:.01,                                     /* shard snowball: +1% value per shard earned, lifetime */
  RISK_COEF:1, RISK_FLOOR:.6, RISK_EVEN:.4, RISK_TOP:2, NERVE_PER:.10, DARING_PER:.08,   /* premium: ×0.6 at 0% risk, breaks even at 40%, ×2 at 100%, steeper past break-even */
  MULT_STEP:.12, MOMENTUM_PER:.05,
  CHAIN_PER:.01, CHAIN_WARM:.002, CHAIN_HOT:.001, CHAIN_WARM_AT:10,   /* chain rate rides the combo: 1% a bank at the base, +0.2% a bank to chain 10 (3% there), +0.1% past it (4% at 20) */
  CHAIN_STEP_AT:10,                                   /* combo difficulty: a chain tick wants 2 cards banked, +1 per 10 chain (3 at 10, 4 at 20, ...) */
  INK_PER:.05, EYE_PER:.001,
  CD:3.5, SPEED_PER:.95, QUICK_PER:.97, HASTE_MUL:.75,   /* cooldown: each level multiplies what's left, 0.95^n regular × 0.97^n2 prestige */
  MARKED_PER:.01, DODGE_CAP:.85, ANCHOR_DRAWS:3,
  ODDS_X:3, FLOAT_AT:.70, WINDOW_DRAWS:3, HOT_AT:[.60,.70,.80],   /* hot-streak goal lines */
  COLD_AT:.10,                                        /* the cold-ward line: Grace's level-2 gate */
  LONG_AT:.05,                                        /* the Long Odds line: busts at or under this gauge feed flinch's gate */
  GUARD_CH:1/3,                                       /* Guardian: the OUT watcher's save roll */
  OVER_AT:10, OVER_PER:.08, HOUSE_X:1.25,
  STREAK_AT:1e5, // Hot Streak row: banks at or above this, five in a row, feed Encore's gate
  /* the auto plays its own tricks: arm at this much threat —
     Odds is the mirror image, armed only when the draw is near-safe.
     Cull is not here: its arm spends the card itself, so the autos
     hold it for a read (autoHolds) and the tap stays the player's */
  AUTO_SKILL:{defuse:.28, float:.45, stakes:.30, scrap:.50},
  /* Draw Stop: how deep the stop-drawing dial may be set, per level */
  GUARD_AT:[.25,.45,.70,.95],
  /* the reliable/gamble pairs: each pair shares a job, one pays small
     every bank, the other rolls a chance to pay much bigger */
  MINT_X:4, TRIBUTE_X:7, SIPHON_X:10,
  BRASS_SCORE:5,                                     /* brass: +2 score per card per Brass, per Brass — copies count each other */
  BLOOM_PER:.10, BLOOM_CHANCE:.5,                    /* bloom: +10% mult per card, 50% per copy */
  SURGE_STEP:.20,                                    /* surge: the reliable mult */
  KINDLE_PER:.40, KINDLE_CHANCE:.40,                 /* kindle: +0.40 mult per other card, 40% */
  DIVIDEND_CHANCE:.25,                               /* dividend: 25% to score the table again */
  VAR_PER:.10, JINX_PER:.02,
  CVAL_MIN:1,                                        /* the rewrite floor: no shown value ever leaves the deck's range, so a cheap rewriter can never do Purify's job */
  /* de-bolt rides shop rolls only after DEBOLT_AT has gone to stickers,
     lifetime: buys and strips both count */
  DEBOLT_MIN:1000, DEBOLT_FRAC:.5, DEBOLT_CHANCE:.10, DEBOLT_AT:25000,
  /* shiny stock: unlocks on 5 busts in a row under SHINY_COLD risk, then
     SHINY_CHANCE of rolls come off the press holo at double price. Each
     shiny on a table pays ×SHINY_X per shiny there. Luster (shards)
     adds SHINY_PER a level on top of the base */
  SHINY_CHANCE:.05, SHINY_PER:.05, SHINY_X:1.1, SHINY_COLD:.30,
  /* the rip: RIP_CHANCE of applies tear the stock into the RIPPED
     condition (one apply in a hundred, sticker and all) — but only
     once a card has been set to 0 (rippedUn, economy.js). The buy-roll
     chance rides COND_CH with the rest of the press */
  RIP_CHANCE:.01,
  /* card conditions: the press's chance per condition, per buy. Live
     once COND_LIVE flips (the unlock rows of docs/card-modifiers.md);
     the demo seeds conditions freely either way. mboost doubles a
     row's chance for the cycle its level 1 was bought */
  COND_LIVE:false,
  COND_CH:{soggy:.04,nearmint:.03,used:.05,graded:.02,bent:.02,promo:.03,dogeared:.05,glass:.04,ripped:.01},
  GRADED_X:1.25, DOGEAR_X:.6,
  /* shop slots roll a tier first, then a sticker from it. The t1/t2/t3
     boost (+3/+2/+1, 2026-09-01) keeps the deep tiers rare for the
     long-progression frame: t5 lands ~36% as often as t1 per slot.
     Unlocked tiers renormalize */
  TIER_W:[11,9,7,5,4],
  SHARDS_BASE:3,
  RESTOCK_S:420, RESTOCK_MIN:150,
  /* restock-now: starts at 500, decays 1%/min toward the 300 floor;
     each purchase resets it ×1.2 from what you paid */
  RESTOCK_NOW:500, RESTOCK_FLOOR:300, RESTOCK_DECAY:.99, RESTOCK_G:1.2,
  /* deeper shop tiers open by stickers placed: t2 at 5, t3 at 12, t4 at 20, t5 at 30 */
  TIER_AT:[5,12,20,30],
  /* the pay-mult ladder rode the tiers (Gild ×2.75); Gild is benched
     with its sticker, and Twin's ×3.5 went with the pull rework */
  GILD_X:2.75, PRIME_ADD:2,
  RELIC_PER:.05,                                       /* Relic: +5% value per bank it rides */
  /* the away-pile wages: Tab +8% a card OUT, Rake +2 a draw per OUT,
     Exit 2% of the bench's total value, Layaway +5% payout per bench card */
  TAB_PER:.08, RAKE_PER:2, EXIT_PER:.02, LAY_PER:.05,
  TAB_REQ:{cards:25, ach:25, up:60, shop:300, pres:100000}
};
