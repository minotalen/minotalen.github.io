/* SQUEEZER economy simulator — player v6.
   Models a population of ARCHETYPE players: each has its own risk line,
   buy priorities and sticker tastes, HUNTS the goal gates it cares about
   (a hunt reshapes the bank line, hand width and buys toward one stat),
   and uses its stickers TACTICALLY — tricks arm when their gauge line is
   crossed (float rescues at 70%, stakes ride hot draws, defuse/scrap cut
   the deck), wards/anchors deflect busts, payers pay their real rates.
   Stickers are bought as INDIVIDUALS off the live config roster, at the
   game's exact shelf rules: a sticker only stocks after its goal is
   claimed, tiers open by placed count, uniques roll a coin, prices are
   tier^2 x pm x 1.1^copies x spread tax. Upgrade rows hide until their
   u-goal is claimed, the same upOpen rule the game runs. The sim runs
   PAST the first ascend: shards land (with the +3%/shard snowball and
   claimed goal bonuses), get spent on META rows, and the horizon is the
   third ascend — so shard gates and Third Life get real minutes instead
   of "expected never".
   Still approximate: one table at a time (Split's second hand and aura
   presence read low), no manual micro-timing, no offline/idle income, no
   shiny vinyl, no de-bolt. Anything the model cannot see prints as a
   caveat, never as a silent number.
   Usage: node sim.js            -> archetype medians for current params
          node sim.js detail     -> one full hunter run trace
          node sim.js log        -> detail + every buy/arm/ascend event
          node sim.js tune       -> grid over STK_BASE / ASC_REQ
          node sim.js goals      -> goal pacing, plain language
          node sim.js report     -> writes game-docs/balance.html (human report) */

const fs = require('fs');

/* ---- the live roster: stickers, goals and shard rows come straight
   from js/config.js so identity never drifts from the game ---- */
const SS = { st: {}, asc: 0, cards: { length: 0 }, _owned: {} };
const { ACH, STK, STKTYPE, ECO, META, NONSTACK, STK_OFF } = new Function('S', 'ownedOf',
  fs.readFileSync(__dirname + (fs.existsSync(__dirname + '/js/config.js') ? '/js/config.js' : '/config.js'), 'utf8') +
  '\n;return {ACH,STK,STKTYPE,ECO,META,NONSTACK,STK_OFF};')(SS, v => SS._owned[v] || 0);
/* benched stickers never stock, never gate — but their mechanics stay
   modeled for placed copies */
const OFF = STK_OFF || {};

const P = {
  UPG: {
    speed:  [17, 30,   1.75, 0],
    value:  [30, 40, 1.45, 0],
    mult:   [25, 75,   1.95, 110],
    nerve:  [12, 145,  2.0, 250],
    salv:    [10, 300, 1.9, 400],
    chain:   [20, 280, 2.05, 900],
    eye:    [15, 320,  1.71, 1400],
    auto:    [6, 1000, 2.10, 900],
    guard:   [4, 1000, 1.60, 2400],
    marked:  [30, 500,  1.20, 2600],   /* Marked Pendant lifts the ceiling 20 levels more */
    flick:   [3, 500,  3.00, 0, [500, 1500, 5000]],   /* config pins the ladder; swipe-up pre-flick, one waiting seat per level */
    sleight: [8, 680,  2.01, 4000],
    abank:   [1, 6800, 1.00, 9000],
    grace:   [2, 90000,1.70, 14000],   /* synced to config: grace is op, cut to 2 levels at 90K */
    iron:    [1, 44000,1.00, 40000],
    high:   [10, 3040, 1.91, 25000],
    deep:   [10, 64000,2.01, 200000],
    /* synced to config UPG (house/over/split were once missing).
       4th col = show floor, only used by the ungated bench */
    house:   [1, 4800, 1.00, 15000],
    over:    [5, 4000, 2.01, 6000],
    split:   [4, 32000,2.3, 60000],
  },
  ORDER: ['value','speed','mult','nerve','chain','eye','marked','flick','salv','sleight','over','high','house','grace','split','deep','iron','abank','auto','guard'],
  CARD_LADDER: [[5], [6, 8], [10, 13, 16], [20, 25, 30, 40], [50, 65, 80, 95, 120]], CARD_ANCHOR: 50, CARD_ANCHOR_V: 5, CARD_STEP: 2.113762, CARD_GROW: 2.25,
  STK_BASE: 450, STK_GROW: 1.1, STK_INF: 0.03,
  ASC_REQ: 230000,
  RISK_COEF: 1.0, RISK_FLOOR: 0.6, RISK_EVEN: 0.4, RISK_TOP: 2.0, HAND_CAP: 8,
  CD: 3.5, SPEED_PER: 0.95,
  /* ---- v6 player layer ----
     BOOST = how hard an archetype favors its rows at buy time; the
     save-up ledger (markup / patience) is the v5 rule, kept.
     AURA_X = the presence share an on-table aura earns in a one-table
     model (its card sits a cyc share of hands; the real felt runs up to
     three tables, so this splits the difference and still reads low) */
  BOOST: 1.35, SAVE_MARKUP: 2.2, SAVE_PATIENCE: 180, AURA_X: 2.5,
};

const WEEK = !!process.env.WEEK || process.argv[2] === 'week';   /* a 7-day week: 8h play + 2x8h breaks per day, offline gains on */
const SIM_HOURS = +(process.env.SIM_HOURS || (WEEK ? 168 : 16)), DT = 0.2;
const ASC_GROW = +(process.env.ASC_GROW || ECO.ASC_REQ_GROW);   /* ASC_REQ x GROW^era (game constant; env overrides) */
const ASC_GAIN = +(process.env.ASC_GAIN || 3);   /* meter mode: ascend only when the grant reaches this (5 = the optimal overbank) */
const ASC_MODE = process.env.ASC_MODE || 'goal'; /* goal (default): ascend funds the next wanted shard row; meter: flat ASC_GAIN */
const ASC_CAP = +(process.env.ASC_CAP || 10);    /* goal mode: wants past this accumulate over several ascends */
const SHALL_PER = +(process.env.SHALL_PER || ECO.SHALL_PER); /* the +X%/shard value snowball */
const LOG = process.argv[2] === 'log';
let log = [];

function makeRng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* ================= the sticker identity layer =================
   One descriptor per roster sticker, in the game's own units. Every
   table occurrence of a sticker's card rides `cyc` (expected times its
   card sits on a table per bank = avgN / effective deck). Fields:
     add    score per occurrence, x avgCardValue x the table's full mult
            stack (stackMul, mirroring the game's payMul), BANKED lane
     side   same, but pays score only (the game's on-draw/on-bank payers
            that never touch the banked meter: tribute, mint, rake...)
     mul    per-card table multiplier (gild/twin) — applied per SEAT
     addC   flat per-card value add on its own seat (patch, riffle...)
     frac   fraction of the bank's pay per occurrence (dividend, tab...)
     out/outN/gone  cards per occurrence to that pile (bank-time)
     disc   cards per draw-occurrence to the discard (draw-time)
     dodge  share of would-be busts deflected (caps at DODGE_CAP)
     trick {at, kind} arms when the gauge crosses `at` (0 = arms when
            its card lands); see tacticTick for what each kind does */
const STKD = {
  gild:    {role:'pay',    mul:2.75},
  haste:   {role:'aura',   aura:'haste'},
  tribute: {role:'pay',    add:7, side:1, draw:1},
  odds:    {role:'pay',    add:1.5, side:1, draw:1, stkDraws:.5},
  snip:    {role:'disc',   disc:1},
  mint:    {role:'pay',    add:4, side:1},
  brass:   {role:'table',  add:s=>2*s.N, syn:.5},
  surge:   {role:'mult',   aura:'surge'},
  twin:    {role:'pay',    twinPull:1},   /* the pull: twins land (values repeat), blanks bench */
  mirror:  {role:'pay',    addC:2.5},
  ward:    {role:'ins',    dodge:.15},
  anchor:  {role:'ins',    dodge:.10},
  prime:   {role:'pay',    prime:2},
  beacon:  {role:'aura',   aura:'beacon'},
  burn:    {role:'disc',   disc:2},
  tell:    {role:'trick',  trick:{at:0,kind:'tell'}},
  cull:    {role:'trick',  trick:{at:.5,kind:'cull'}},   /* late arm: the ward dies at bank, so it waits for the hot end */
  dividend:{role:'gamble', frac:()=> .25, hits:.25},
  tab:     {role:'outpay', frac:s=> .08*s.out},
  purify:  {role:'ins',    purify:.22},
  echo:    {role:'out',    disc:2.5, stkDraws:1, trick:{at:0,kind:'echo'}},
  bloom:   {role:'gamble', frac:s=> .05*s.N, hits:.5},
  kindle:  {role:'gamble', frac:()=> .16, hits:.4},
  jynx:    {role:'table',  frac:s=> .02*s.bad},
  reverb:  {role:'disc',   disc:1, dodge:.03},
  siphon:  {role:'ins',    bustAdd:10},
  vanish:  {role:'out',    out:1},
  ledger:  {role:'outpay', add:s=> Math.min(1, s.out/8)},
  rake:    {role:'outpay', add:s=> 2*s.out/6, side:1, draw:1},
  stakes:  {role:'trick',  trick:{at:.30,kind:'stakes'}},
  scrap:   {role:'out',    trick:{at:.50,kind:'scrap'}},
  relic:   {role:'jackpot',relic:1},
  purge:   {role:'disc',   purgeN:1},    /* the banked hand benches to the discard */
  encore:  {role:'disc',   swap:1},      /* the piles trade: the discard deals again */
  float:   {role:'trick',  trick:{at:.70,kind:'float'}},
  defuse:  {role:'out',    trick:{at:.28,kind:'defuse'}},
  swap:    {role:'rewrite',trick:{at:0,kind:'swap'}, addC:.2, rewrites:1, bigRw:.06},
  clip:    {role:'rewrite',trick:{at:0,kind:'clip'}, dodge:.05, rewrites:1},
  ghost:   {role:'rewrite',trick:{at:0,kind:'ghost'}, rewrites:1},
  patch:   {role:'rewrite',trick:{at:0,kind:'patch'}, addC:1, rewrites:1, bigRw:.12},
  variety: {role:'table',  frac:s=> .1*Math.min(s.N, 1+s.seats)},
  dredge:  {role:'rewrite',trick:{at:0,kind:'dredge'}, rewrites:1, bigRw:.25},
  fetch:   {role:'out',    trick:{at:0,kind:'fetch'}, ret:1},
  riffle:  {role:'rewrite',trick:{at:0,kind:'riffle'}, addC:3, rewrites:1, bigRw:.5},
  bail:    {role:'trick',  trick:{at:.80,kind:'bail'}},
  draft:   {role:'disc',   trick:{at:0,kind:'draft'}, stkDraws:.5},
  engrave: {role:'rewrite',trick:{at:0,kind:'engrave'}, addC:.5, rewrites:1, bigRw:.1},
  fallout: {role:'out',    outN:1, gone:1},
  remnant: {role:'pay',    add:1, side:1, rate:.5},
  guardian:{role:'ins',    bustFrac:.17, unique:1},
  flinch:  {role:'ins'},
  offering:{role:'out',    trick:{at:0,kind:'offering'}, out:1, chainKeep:1},
  recycle: {role:'out',    ret:1},
  sub:     {role:'out',    trick:{at:0,kind:'sub'}},
  exit:    {role:'out',    out:1},
  /* the squeeze batch: Whip is a disc engine with a safe-only cut (its
     blanks feed safeDisc one for one), Strip stands wards (the dodge
     term) and benches the floor, Squeeze reads the deck like a rewriter */
  whip:    {role:'disc',   disc:1, safe:1, trick:{at:0,kind:'whip'}},
  strip:   {role:'ins',    dodge:.04, trick:{at:0,kind:'strip'}},
  squeeze: {role:'rewrite',trick:{at:0,kind:'squeeze'}, addC:3, rewrites:1, bigRw:.5},
  /* the fuse batch (2026-09-05): Windfall doubles inside the draw step
     (a rewrite with a gamble's cadence), Redline pays the flat standing
     score past the line, Tempo stamps the chain onto its own worth,
     Barter and Recast re-seat cards from the piles, riding the Sub and
     Draft tactics */
  windfall:{role:'rewrite',addC:1, rewrites:.17, bigRw:.15},
  redline: {role:'pay',    frac:()=>.35},
  tempo:   {role:'pay',    addC:2},
  barter:  {role:'out',    trick:{at:0,kind:'sub'}},
  recast:  {role:'disc',   trick:{at:0,kind:'draft'}},
};

/* rough per-bank pay fraction of one copy, for RANKING shop offers —
   never an absolute, just enough to order wants. Structural roles earn
   FLOORS: an out card is a permanent wage (thinning, sleight, tab/rake),
   a dodge is a saved bank, an aura compounds — the direct-pay fields
   alone would rank them under every t1 payer and the buyer would drown
   in mint duplicates */
function estPay(k) {
  const d = STKD[k]; if (!d) return 0;
  let e = (d.mul ? d.mul - 1 : 0) + (d.add ? (typeof d.add === 'function' ? .5 : d.add) * .4 : 0)
    + (d.addC || 0) * .4 + (d.frac ? .12 : 0)
    + (d.bustAdd ? .05 : 0) + (d.hits ? .3 : 0) + (d.prime ? .1 : 0);
  if (d.out || d.outN || d.trick) e = Math.max(e, .5);
  if (d.aura) e = Math.max(e, .4);
  if (d.dodge) e = Math.max(e, d.dodge * 2);
  if (d.purify) e = Math.max(e, .5);
  if (d.relic) e = Math.max(e, .4);
  if (d.twinPull) e = Math.max(e, .8);          /* card advantage past the value ceiling */
  if (d.purgeN || d.swap) e = Math.max(e, .4);  /* pile engines: structural, not direct pay */
  return e * .12;                       /* cyc-ish scale */
}

/* ================= archetypes ================= */
const ARCH = {
  climber: {n:'climber', line:.45, boost:['value','eye','mult','high','deep','over','speed'],
            like:{pay:3, mult:2.5, aura:2.5, jackpot:1.5, table:1.5}, fams:null},
  devil:   {n:'daredevil', line:.58, boost:['nerve','marked','grace','guard','salv','speed'],
            like:{ins:3, trick:2.5, gamble:2, pay:1.5}, fams:['hot','deflect']},
  engineer:{n:'engineer', line:.45, boost:['sleight','marked','speed','value','eye'],
            like:{out:3, outpay:3, disc:2, trick:1.5, pay:1}, fams:['out','disc']},
  keeper:  {n:'chainkeeper', line:.34, boost:['chain','house','mult','value','iron','speed'],
            like:{mult:3, table:2.5, pay:1.5}, fams:['chain','row']},
  hunter:  {n:'hunter', line:.45, boost:['value','speed','eye'],
            like:{}, huntAll:true},
};
const ARCH_KEYS = Object.keys(ARCH);

/* which stats belong to which family (a family arch hunts its own) */
const FAM = {
  hot: ['hot60','hot70','hot80','hotBanks','bestRisk','bestBustRun','bigBustN'],
  deflect: ['deflects','coldWards','wardLost'],
  out: ['maxOut','outBanks','deepBanks','fleetBanks','outed','oneOut','pileBanks','bothPiles'],
  disc: ['discarded','maxDisc','benchBanks','safeDisc'],
  chain: ['bestChainN','bestChain','bestStreak'],
  row: ['bestRow3','bestWide','bigHand','bestHandDraws','rainbows','oneTwoThree','spread','richBanks'],
};

/* hunt roles that cut ACROSS sticker roles (the draw-engine role has no
   sticker role of its own; 'many' likes every sticker equally) */
const ROLE_X = {
  draw: new Set(['ward','odds','draft','echo']),
  many: null,
};
/* stat -> the sticker role that produces it: any player holding an
   unmet gate buys that role's stock harder, formal hunt or not */
const NEED = {
  hits:'gamble', outed:'out', maxOut:'out', outBanks:'out', deepBanks:'out',
  fleetBanks:'out',
  rewrites:'rewrite', bigRewrites:'rewrite', stkDraws:'draw', deflects:'ins',
  coldWards:'ins', discarded:'disc', maxDisc:'disc', oneOut:'out',
  pileBanks:'out', bothPiles:'out', benchBanks:'disc',
  safeDisc:'disc', wardLost:'ins',
};

/* ================= hunt policies =================
   A hunt reshapes play toward one stat. line overrides the bank line,
   wide holds hands to N, safe banks early to protect chains and piles,
   comp waits for a hand composition, role re-weights sticker buys,
   cardFirst/stickerFirst/speedFirst re-weigh the lanes */
const POLICY = {
  bigHand: t => ({wide: t, cardFirst: 1}),
  bestHandDraws: t => ({wide: t, cardFirst: 1}),
  hot60: () => ({line: .63}),
  hot70: () => ({line: .73}),
  hot80: () => ({line: .83}),
  hotBanks: () => ({line: .58}),
  bestRisk: () => ({line: .93, wide: 6}),
  bestBustRun: () => ({line: .7}),
  bestChainN: () => ({safe: 1, minHand: 2}),
  bestChain: () => ({safe: 1, minHand: 3, line: .5}),
  bestStreak: () => ({safe: 1, wide: 5, line: .55}),
  bestRow3: () => ({wide: 3, safe: 1}),
  bestSeven: () => ({comp: 'seven'}),
  bestWide: t => ({wide: Math.max(5, t), safe: 1}),
  rainbows: () => ({wide: 7, cardFirst: 1}),
  oneTwoThree: () => ({comp: '123'}),
  spread: () => ({comp: 'spread'}),
  richBanks: () => ({comp: 'rich3', wide: 3}),
  maxOut: () => ({safe: 1, role: 'out'}),
  outBanks: () => ({safe: 1, role: 'out'}),
  deepBanks: () => ({safe: 1, role: 'out'}),
  fleetBanks: () => ({safe: 1, role: 'out'}),
  pileBanks: () => ({safe: 1, role: 'out', role2: 'disc'}),
  benchBanks: () => ({role: 'disc', safe: 1}),
  bothPiles: () => ({safe: 1, role: 'out', role2: 'disc'}),
  oneOut: () => ({role: 'out'}),
  outed: () => ({role: 'out', line: .5}),
  discarded: () => ({role: 'disc'}),
  maxDisc: () => ({role: 'disc', wide: 8, safe: 1}),
  arms: () => ({role: 'trick', armBoost: 1}),
  rewrites: () => ({role: 'rewrite', armBoost: 1}),
  bigRewrites: () => ({role: 'rewrite', armBoost: 1}),
  hits: () => ({role: 'gamble', wide: 6}),
  stkDraws: () => ({role: 'draw'}),
  deflects: () => ({line: .6, role: 'ins'}),
  coldWards: () => ({line: .12, role: 'ins'}),
  twoStkBusts: () => ({bustPush: 1}),
  inkBanks: () => ({wide: 5, stickerFirst: 1, role: 'many'}),
  stkBanked: () => ({wide: 4, stickerFirst: 1, role: 'many'}),
  bigStk: () => ({stickerFirst: 1, wide: 6, role: 'many'}),
  placed: () => ({stickerFirst: 1, role: 'many'}),
  bestBank: () => ({wide: 9, line: .6}),
  bestBust: () => ({wide: 9, line: .8}),
  bigBustN: () => ({wide: 12, cardFirst: 1, line: 1.1, bustLine: 1.1}),   /* bustLine: ride PAST the 85% wall — the hunt wants the bust */
  safeDisc: () => ({role: 'disc'}),
  wardLost: () => ({line: .6, role: 'ins'}),
  bestFloat: () => ({wide: 9, line: .75}),
  bestRisky: () => ({wide: 12, line: .5, cardFirst: 1}),
  draws: () => ({speedFirst: 1}),
  banks: () => ({}),
  bigBanks: () => ({wide: 3}),
  busts: () => ({}),
  aBusts: () => ({}),
  coldBusts: () => ({}),
  owned: () => ({cardFirst: 1}),
  sets: () => ({cardFirst: 1}),
};

/* goal bundle: stat key per goal, read off the gate source */
const statOfSrc = a => { const s = a.g.toString();
  if (/ownedOf/.test(s)) return 'sets';
  if (/S\.cards\.length/.test(s)) return 'owned';
  if (/S\.asc/.test(s)) return 'asc';
  if (/Math\.max[\s\S]*S\.up/.test(s)) return 'upMax';   /* deepest single upgrade */
  if (/S\.up/.test(s)) return 'upSum';                   /* levels bought, all rows */
  const m = s.match(/S\.st\.(\w+)/); return m ? m[1] : null; };
const GOALS = ACH.map(a => ({ id: a.id, n: a.n, d: typeof a.d === 'function' ? '' : a.d,
  stk: a.stk || null, up: a.up || null, meta: a.meta || null, lv: a.lv || 1,
  v: a.v || 0, s: a.s || 0, t: a.t, k: statOfSrc(a) }));
const UGOAL = {}; GOALS.forEach(g => { if (g.up && !UGOAL[g.up]) UGOAL[g.up] = g; });
const SUGOAL = {}; GOALS.forEach(g => { if (g.meta && !SUGOAL[g.meta]) SUGOAL[g.meta] = g; });

/* stats this model actually ticks (hunts and claims never target a stat
   the sim cannot see) */
const MODELED = new Set(['draws','banks','runs','busts','aBusts','bigHand','bestBank',
  'bestBust','bestChain','bestChainN','bestHandDraws','bestRisk','bestStreak','bigBanks',
  'spread','bestRow3','richBanks','rainbows','oneTwoThree','bestBustRun','hotBanks',
  'coldBusts','hot60','hot70','hot80','bestWide','arms','deflects','coldWards','rewrites',
  'bigRewrites','hits','stkDraws','maxOut','outBanks','deepBanks','fleetBanks','outed','discarded',
  'maxDisc','bothPiles','bestRisky','bigStk','inkBanks','pileBanks','benchBanks','oneOut','twoStkBusts',
  'stkBanked','bestFloat','placed','owned','sets','asc','bestSeven',
  'bigBustN','safeDisc','wardLost','fiveBanks','stkKinds','upMax','upSum',
  'bestPairs','bestStack']);
/* records the model structurally under-reads (random sticker seats, one
   table, no jackpot milking): gates on them fall back to the show floor */
const ENGINE_STAT = new Set(['bestChain','bestStreak','bestBank','bestFloat']);

/* ================= the run ================= */
function runSim(seed, watch, gateIgnored, archKey) {
  const rnd = makeRng(seed);
  const A = ARCH[archKey || ARCH_KEYS[seed % ARCH_KEYS.length]];
  const up = {}; for (const k in P.UPG) up[k] = 0;
  const meta = {}; for (const k in META) meta[k] = 0;
  const L = id => up[id], M = id => meta[id] || 0;
  const owned = { 1: 1, 2: 2, 3: 3 };
  let deckSize = 6;                      /* cards owned (OUT/gone included) */

  /* mirrors economy.js cardCost, with The Press folded in */
  const cardCost = v => v <= 5 ? Math.ceil(P.CARD_LADDER[v - 1][owned[v] || 0] * (1 - .06 * M('press')))
    : Math.ceil(P.CARD_ANCHOR * Math.pow(P.CARD_STEP, v - P.CARD_ANCHOR_V) * (v / P.CARD_ANCHOR_V)
    * Math.pow(P.CARD_GROW, (owned[v] || 0) / v) * (1 - .06 * M('press')));
  const unlockReq = v => (v - 1) * v / 2;
  const unlockedV = () => { let u = 3; for (let v = 4; v <= 20; v++) { if (deckSize >= unlockReq(v)) u = v; else break; } return u; };

  /* ---- sticker state: live copies, stickered seats per value, piles ---- */
  const copiesNow = {};                  /* live stickered cards by key */
  const seats = {};                      /* value -> {n, keys:{k:n}} */
  let placed = 0, placedNow = 0;         /* lifetime / live placements */
  let outHeld = 0, goneHeld = 0, discSize = 0, relicBanks = 0;
  const outCount = () => outHeld + goneHeld;
  const effDeck = () => Math.max(1, deckSize - outHeld - goneHeld);

  const tierOf = () => { let t = 1; ECO.TIER_AT.forEach((req, i) => { if (placedNow >= req) t = i + 2; }); return t; };
  const stkPrice = k => Math.ceil(P.STK_BASE * STK[k].t * STK[k].t * (STK[k].pm || 1)
    * Math.pow(P.STK_GROW, copiesNow[k] || 0) * (1 - .12 * M('trader'))
    * (1 + P.STK_INF * Math.max(0, placedNow - (copiesNow[k] || 0))));

  /* the shop: restocks every gap, 3 slots (4/5 with stall/union), stock
     = goal-unlocked stickers under the open tier; uniques coin-fip in */
  let offers = [], shopT = 0;
  const shopGap = () => Math.max(150, 420 * (1 - .09 * M('trader')));
  function restock() {
    offers = [];
    const pool = Object.keys(STK).filter(k =>
      !OFF[k] && !!met[STKGOAL[k]] && STK[k].t <= tierOf() &&
      !(NONSTACK[k] && copiesNow[k]));
    if (!pool.length) return;
    const slots = 3 + (M('stall') ? 1 : 0) + (M('union') ? 1 : 0);
    const seen = new Set(), coin = {};
    while (offers.length < slots && seen.size < pool.length) {
      const byT = {};
      for (const k of pool) {
        if (seen.has(k)) continue;
        if (NONSTACK[k]) { if (!(k in coin)) coin[k] = rnd() < .5; if (!coin[k]) continue; }
        (byT[STK[k].t] = byT[STK[k].t] || []).push(k);
      }
      const tiers = Object.keys(byT).map(Number);
      if (!tiers.length) break;
      let r = rnd() * tiers.reduce((a, t) => a + ECO.TIER_W[t - 1], 0), t = tiers[0];
      for (const ti of tiers) { r -= ECO.TIER_W[ti - 1]; if (r <= 0) { t = ti; break; } }
      const k = byT[t][Math.floor(rnd() * byT[t].length)];
      seen.add(k); offers.push(k);
    }
    recomputeNeed();
  }
  const STKGOAL = {}; GOALS.forEach(g => { if (g.stk) STKGOAL[g.stk] = g.id; });

  /* ---- stats (lifetime: they survive the ascend) ---- */
  const st = { draws:0, banks:0, runs:0, busts:0, aBusts:0, bigHand:0, bestBank:0,
    bestChain:0, bestChainN:0, bestBust:0, bestHandDraws:0, bestRisk:0,
    bestStreak:0, bigBanks:0, spread:0, row3:0, bestRow3:0, richBanks:0, rainbows:0, oneTwoThree:0,
    bustRun:0, bestBustRun:0, hotBanks:0, coldBusts:0,
    hot60:0, hot70:0, hot80:0, bestWide:0, arms:0, deflects:0, coldWards:0,
    rewrites:0, bigRewrites:0, hits:0, stkDraws:0, maxOut:0, outBanks:0, deepBanks:0,
    fleetBanks:0, outed:0, discarded:0, maxDisc:0, bothPiles:0, bestRisky:0, bigStk:0,
    inkBanks:0, pileBanks:0, benchBanks:0, oneOut:0, twoStkBusts:0, stkBanked:0, bestFloat:0, sevenRun:0, bestSeven:0,
    bigBustN:0, safeDisc:0, wardLost:0, fiveBanks:0, stkKinds:0, bestPairs:0, bestStack:0 };
  let hotRun = [0, 0, 0], wideRun = 0, streak = 0, chain = 0, chainScore = 0;
  let hand = [], handStk = [];            /* parallel: sticker key per drawn card */
  let score = 0, banked = 0, life = 0;
  let t = 0, cdEnd = 0, era = 0, tSticker = null, tAsc1 = null, tAsc2 = null, tAsc3 = null;
  let shards = 0, shAll = 0;
  const marks = {};
  const upFirst = {}, upAfford = {};

  /* live-shape averages the payback model reads */
  let avgN = 3, avgRisk = .35, avgChain = 2;
  const bandShare = lo => { let tot = 0, hi = 0;
    for (let v = 1; v <= 20; v++) { tot += v * (owned[v] || 0); if (v >= lo) hi += v * (owned[v] || 0); }
    return tot ? hi / tot : 0; };
  let vbar = 2, vmax = 3;
  const recalcVals = () => { let tot = 0, n = 0;
    for (let v = 1; v <= 20; v++) { tot += v * (owned[v] || 0); n += owned[v] || 0; }
    vbar = n ? tot / n : 2; vmax = 3; for (let v = 20; v >= 1; v--) if ((owned[v] || 0) > 0) { vmax = v; break; } };
  recalcVals();
  const bustRate = () => st.runs ? st.busts / st.runs : .25;
  const hotShare = () => st.banks ? st.hotBanks / st.banks : .2;
  const cyc = () => avgN / effDeck();
  const presence = () => Math.min(1, P.AURA_X * cyc());   /* aura share, one-table model */

  /* ---- the income model ---- */
  const valueMult = () => (1 + .05 * L('value')) * (1 + .001 * L('eye') * deckSize)
    * (1 + .03 * L('sleight') * outCount()) * (1 + .06 * M('storage') * outCount())
    * (1 + .25 * M('prodigy')) * (1 + SHALL_PER * shAll) * achV;
  const stepBase = () => .12 + .05 * L('mult');
  const multStep = () => stepBase() + .2 * (copiesNow.surge || 0) * presence();
  const premMul = () => 1 + (copiesNow.beacon ? .5 * presence() : 0) + (stakesD > 0 ? 1 : 0);
  const riskMul = r => {
    const m = (P.RISK_COEF + .10 * L('nerve') + .08 * M('daring')) * premMul();
    return r <= P.RISK_EVEN
      ? P.RISK_FLOOR + r * (1 - P.RISK_FLOOR) / P.RISK_EVEN * m
      : 1 + (r - P.RISK_EVEN) * (P.RISK_TOP - 1) / (1 - P.RISK_EVEN) * m;
  };
  const rMulAt = (r, l) => {
    const m = P.RISK_COEF + .10 * l;
    return r <= P.RISK_EVEN
      ? P.RISK_FLOOR + r * (1 - P.RISK_FLOOR) / P.RISK_EVEN * m
      : 1 + (r - P.RISK_EVEN) * (P.RISK_TOP - 1) / (1 - P.RISK_EVEN) * m;
  };
  function factorOf(oid) {
    const l = up[oid], b = bustRate();
    switch (oid) {
      case 'speed': { /* haste presence rides the cooldown */
        return (1 / P.SPEED_PER) * (copiesNow.haste ? 1 / (1 - .25 * presence() * .1) : 1); }
      case 'value': return (1 + .05 * (l + 1)) / (1 + .05 * l);
      case 'eye': return (1 + .001 * (l + 1) * deckSize) / (1 + .001 * l * deckSize);
      case 'mult': { const ms = multStep();
        return (1 + (ms + .05) * (avgN - 1)) / (1 + ms * (avgN - 1)); }
      case 'chain': { const c = Math.min(avgChain, 2 + l);
        return (1 + (l + 1) * c * chainRate(c)) / (1 + l * c * chainRate(c)); }
      case 'nerve': return rMulAt(avgRisk, l + 1) / rMulAt(avgRisk, l);
      case 'marked': { const d = Math.min(.85, .01 * l), d2 = Math.min(.85, .01 * (l + 1));
        return (1 - b * (1 - d2) / (1 - d)) / (1 - b) + 1e-6; }
      case 'grace': return (1 - b * Math.pow(.9, l + 1)) / (1 - b * Math.pow(.9, l));
      case 'guard': { const c = Math.min(.5, .25 * hotShare());
        return (1 - b * (1 - c)) / (1 - b); }
      case 'salv': return ((1 - b) + b * .05 * (l + 1)) / ((1 - b) + b * .05 * l);
      case 'high': return 1 + .15 * bandShare(8);
      case 'deep': return 1 + .20 * bandShare(14);
      case 'over': return avgN >= 10 ? 1 + .08 : 1 + .01;
      case 'house': return 1 + .25 / (avgChain + 1);
      case 'iron': return 1 + .03 * avgChain * b;
      case 'split': return (2 + l) / (1 + l) * .95;
      case 'sleight': { const o = outCount();
        return (1 + .03 * (l + 1) * o) / (1 + .03 * l * o) + (o ? 0 : .004); }
      case 'abank': return 1.0005;
      case 'auto': return 1.0005;
      case 'flick': return 1.0005;   /* gesture pace: the model cannot play it, priced to buy late */
    }
    return 1;
  }

  /* the per-sticker EV walker: one occurrence = one copy of k sitting on
     a table (rate cyc). Per-SEAT effects (gild/twin/patch/riffle/mirror)
     live in handScore instead */
  function stickerEV(state) {
    let bankAdd = 0, sideAdd = 0, frac = 0, drawLane = 0;
    const c = cyc();
    for (const k in copiesNow) {
      const n = copiesNow[k]; if (!n) continue;
      const d = STKD[k]; if (!d) continue;
      const occ = n * c * (d.rate || 1);
      if (d.relic) bankAdd += n * ECO.RELIC_PER * relicBanks * c * vbar * stackMul() * .5;
      if (d.add) { const add = typeof d.add === 'function' ? d.add(state) : d.add;
        const pay = add * vbar * stackMul() * occ;
        if (d.side) { sideAdd += pay; if (d.draw) drawLane += pay; }
        else bankAdd += pay; }
      if (d.frac) { const f = typeof d.frac === 'function' ? d.frac(state) : d.frac;
        frac += f * occ; }
      if (d.hits) st.hits += d.hits * occ;   /* expectation booked at bank */
    }
    return { bankAdd, sideAdd, frac, drawLane };
  }

  /* the risk gauge: risky twins over the remaining deck, Purify-softened */
  /* the risk gauge: risky twins over the remaining deck, Purify-softened */
  function riskPct() {
    const remaining = deckSize - hand.length - outHeld - goneHeld;
    if (!hand.length || remaining <= 0) return 0;
    const cnt = {};
    for (const v of hand) cnt[v] = (cnt[v] || 0) + 1;
    let bad = 0;
    for (const v in cnt) bad += Math.max(0, (owned[v] || 0) - cnt[v]);
    const pur = Math.min(.6, .22 * (copiesNow.purify || 0));
    return (bad / remaining) * (1 - pur) * (1 - Math.min(.85, .01 * L('marked')));
  }
  function rawRisky() {
    const cnt = {};
    for (const v of hand) cnt[v] = (cnt[v] || 0) + 1;
    let bad = 0;
    for (const v in cnt) bad += Math.max(0, (owned[v] || 0) - cnt[v]);
    return bad;
  }

  function handBase() {
    let base = 0, nPrime = 0;
    for (let i = 0; i < hand.length; i++) {
      let cv = hand[i]; const k = handStk[i], d = k && STKD[k];
      if (cv >= 8) cv *= 1 + .15 * L('high');
      if (cv >= 14) cv *= 1 + .20 * L('deep');
      if (d) {
        if (d.mul) cv *= d.mul;
        if (d.addC) cv += d.addC;
        if (d.prime) nPrime++;
      }
      base += cv;
    }
    base += 2 * nPrime * Math.max(0, hand.length - 1);   /* Prime: +2 to every other card */
    return base;
  }
  /* the full mult stack the table pays through — the game's payMul in
     its modeled form. Effect payers (tribute, mint, rake, remnant,
     siphon) ride the very same stack: a pay is a pay */
  function stackMul() {
    if (!hand.length) return 1;
    return valueMult() * (1 + multStep() * (hand.length - 1)) * chainMul() *
      riskMul(riskPct()) *
      (hand.length >= 10 ? 1 + .08 * L('over') : 1);
  }
  function handScore() {
    return hand.length ? handBase() * stackMul() : 0;
  }
  /* chain rate rides the combo (mirrors economy.js): 1% a bank at the
     base, +0.2% a bank to chain 10, +0.1% past it */
  const chainRate = c => .01 + .002 * Math.min(c, 10) + .001 * Math.max(0, c - 10);
  const chainMul = () => { const c = Math.min(chain, 2 + L('chain'));
    return 1 + L('chain') * c * chainRate(c); };

  /* ---- goals the sim itself can see: met marks, claim bonuses ---- */
  const met = {};
  let achV = 1, achS = 1;
  let era2 = 0;
  const statVal = k => {
    if (k === 'sets') { let n = 0; for (const v in owned) if (owned[v] >= +v) n++; return n; }
    if (k === 'owned') return deckSize;
    if (k === 'placed') return placed;
    if (k === 'asc') return era2;
    if (k === 'upSum') { let s = 0; for (const id in up) s += up[id]; return s; }
    if (k === 'upMax') { let m = 0; for (const id in up) m = Math.max(m, up[id]); return m; }
    return st[k] || 0;
  };
  function checkGoals() {
    for (const g of GOALS) {
      if (met[g.id] || !MODELED.has(g.k)) continue;
      if (g.stk && OFF[g.stk]) continue;      /* a benched sticker's gate never met */
      let c; try { c = statVal(g.k); } catch (e) { continue; }
      if (typeof c === 'number' && c >= g.t) {
        met[g.id] = t;
        if (g.v) achV *= 1 + g.v;
        if (g.s) achS *= 1 + g.s;
        if (g.stk && LOG) log.push([t, 'goal ' + g.id + ' -> ' + STK[g.stk].n + ' stocks']);
      }
    }
  }

  /* ---- the hunt ---- */
  let hunt = null; const huntLog = [];
  const black = new Map();               /* goal id -> {until, n} escalating cooldown */
  function pickHunt() {
    const cands = GOALS.filter(g => g.stk && !OFF[g.stk] && !met[g.id] && MODELED.has(g.k)
      && !((black.get(g.id) || {}).until > t));
    if (!cands.length) return null;
    let pool = cands;
    if (!A.huntAll) {
      pool = cands.filter(g => statVal(g.k) / g.t >= .2 &&
        A.fams && A.fams.some(f => FAM[f].includes(g.k)));
      if (!pool.length) pool = cands.filter(g => statVal(g.k) / g.t >= .5);
      if (!pool.length) return null;
    }
    pool = [...pool].sort((a, b) =>
      STK[a.stk].t - STK[b.stk].t || statVal(b.k) / b.t - statVal(a.k) / a.t);
    const g = pool[0];
    const pol = (POLICY[g.k] || (() => ({})))(g.t);
    hunt = { g, pol, since: t, start: t, prog: statVal(g.k) };
    if (LOG) log.push([t, 'hunt ' + g.id + ' ' + g.n +
      (pol.line != null ? ' line ' + pol.line : '') + (pol.wide ? ' wide ' + pol.wide : '')]);
    huntLog.push([g.id, t]);
  }
  function huntTick() {
    if (hunt) {
      const v = statVal(hunt.g.k);
      if (met[hunt.g.id] || v >= hunt.g.t) { black.delete(hunt.g.id); hunt = null; pickHunt(); return; }
      if (v > hunt.prog) { hunt.prog = v; hunt.since = t; }
      const stall = t - hunt.since > 720;        /* 12m with no movement */
      const longRun = t - hunt.start > 1500;     /* 25m max: real players rotate goals */
      if (stall || longRun) {
        const b = black.get(hunt.g.id) || { until: 0, n: 0 };
        if (stall) b.n++;                        /* only a true stall escalates */
        b.until = t + Math.min(3600, 600 * Math.pow(2, b.n));
        black.set(hunt.g.id, b);
        hunt = null;
      }
    }
    if (!hunt) pickHunt();
  }

  /* ---- tactics: tricks arm on gauge lines or on arrival; one shot per
     copy per deck cycle (arrival odds 1/effDeck per draw moment) ---- */
  let stakesD = 0, floatArmed = 0, bailArmed = 0, cullWards = 0;   /* cull wards die with the run, like grace */
  function tacticTick(r, onDraw) {
    const p = 1 / effDeck();
    for (const k in copiesNow) {
      const n = copiesNow[k]; if (!n) continue;
      const d = STKD[k]; if (!d || !d.trick) continue;
      let boost = (hunt && hunt.pol.armBoost) ? 1.6 : 1;
      /* One Out wants intent the random draw can't show: arm Offering
         hard the moment the hand holds a 1 */
      if (k === 'offering' && hunt && hunt.g.k === 'oneOut' && hand.includes(1)) boost = 8;
      if (d.trick.at > 0) {
        if (r < d.trick.at) continue;
        if (rnd() >= Math.min(.9, n * p * boost * 2)) continue;   /* gauge tricks fire hot */
      } else {
        if (!onDraw || rnd() >= Math.min(.9, n * p * boost)) continue;
      }
      /* Cull arms only from the felt: the card itself pays the trick */
      if (d.trick.kind === 'cull' && !handStk.includes('cull')) continue;
      st.arms++;
      switch (d.trick.kind) {
        case 'cull': {                 /* the card goes OUT, a ward stands */
          const ci = handStk.indexOf('cull');
          handStk.splice(ci, 1); hand.splice(ci, 1);
          outHeld++; st.outed++;
          cullWards++;
          break; }
        case 'stakes': stakesD = 3; break;
        case 'float': floatArmed = 1; break;
        case 'bail': bailArmed = 1; break;
        case 'scrap': outHeld++; st.outed++; break;
        case 'defuse': outHeld++; st.outed++; discSize++; st.discarded++; break;
        case 'echo': discSize += 2; st.discarded += 2; st.stkDraws++; break;
        case 'draft': discSize++; st.discarded++; st.stkDraws += .5; break;
        case 'fetch': outHeld = Math.max(0, outHeld - 1); break;
        case 'offering': outHeld++; st.outed++;
          if (hand.includes(1)) st.oneOut++; break;
        case 'sub': if (discSize || outHeld) { discSize = Math.max(0, discSize - 1); outHeld++; st.outed++; } break;
        case 'whip': discSize++; st.discarded++; st.safeDisc++; break;
        case 'strip': discSize++; st.discarded++; break;   /* the ward rides the dodge term */
        case 'tell': break;
        default: break;                  /* the rewriters: value work, pays in addC */
      }
      if (d.rewrites) {
        st.rewrites += d.rewrites;
        if (d.bigRw && rnd() < d.bigRw * Math.min(1.5, Math.max(.3, vmax / 12))) st.bigRewrites++;
      }
    }
  }

  /* ---- bank / bust ---- */
  function doBank() {
    /* Twin's arm rides the stop: charged seats pull at the bank, the
       hand's last moment — a twin lands (values repeat, the one break
       in the hand ceiling), a blank benches. The seat keeps its key:
       it banked with the hand */
    const twinArms = handStk.reduce((n, k) => n + (k === 'twin'), 0);
    for (let i = 0; i < twinArms; i++) {
      const cnt = {}; for (const v of hand) cnt[v] = (cnt[v] || 0) + 1;
      let badW = 0; for (const v in cnt) badW += Math.max(0, (owned[v] || 0) - cnt[v]);
      const rem = deckSize - hand.length - outHeld - goneHeld;
      st.stkDraws++; st.draws++;
      if (rem > 0 && rnd() < badW / rem) {
        hand.push(hand[Math.floor(rnd() * hand.length)]);
        handStk.push(null);
      } else { discSize++; st.discarded++; }
    }
    if (twinArms && discSize > st.maxDisc) st.maxDisc = discSize;
    const r = riskPct(), N = hand.length;
    let s = handScore();
    if (L('house') && N > 1 && chain === 0) s *= 1.25;
    /* sticker lanes */
    const ev = stickerEV({ out: outCount(), bad: rawRisky(), N, seats: placedNow * cyc() });
    s = s * (1 + ev.frac) + ev.bankAdd;
    score += s + ev.sideAdd; banked += s; life += s + ev.sideAdd;
    st.banks++; st.runs++;
    avgN = avgN * .9 + N * .1;
    if (s > st.bestBank) st.bestBank = s;
    if (N > st.bigHand) st.bigHand = N;
    if (N > st.bestHandDraws) st.bestHandDraws = N;
    avgRisk = avgRisk * .9 + r * .1;
    if (r > st.bestRisk) st.bestRisk = r;
    if (rawRisky() > st.bestRisky) st.bestRisky = rawRisky();
    if (N >= 3) { st.bigBanks++; st.row3++; } else st.row3 = 0;
    if (N === 7) { st.sevenRun++; if (st.sevenRun > st.bestSeven) st.bestSeven = st.sevenRun; } else st.sevenRun = 0;
    if (r > .5) st.hotBanks++;
    st.bustRun = 0;
    if (st.row3 > st.bestRow3) st.bestRow3 = st.row3;
    hotRun = ECO.HOT_AT.map((at, i) => r >= at ? hotRun[i] + 1 : 0);
    hotRun.forEach((v, i) => { if (v > st['hot' + (60 + i * 10)]) st['hot' + (60 + i * 10)] = v; });
    wideRun = N >= 5 ? wideRun + 1 : 0;
    if (wideRun > st.bestWide) st.bestWide = wideRun;
    const sv = [...hand].sort((a, b) => a - b);
    if (sv.length > st.spread && sv.every((v, i) => i === 0 || v - sv[i - 1] >= 2)) st.spread = sv.length;
    if (N >= 3 && sv.every(v => v >= 3)) st.richBanks++;
    if (N >= 7) st.rainbows++;
    if ([1, 2, 3].every(v => hand.includes(v))) st.oneTwoThree++;
    for (const v of hand) if (v === 5) st.fiveBanks++;   /* Centapent: shown fives cashed */
    /* the pair build: landed twins repeat values — pairs counts values
       held twice or more, the stack the deepest one-value run (Quadro) */
    { const vc = {}; for (const v of hand) vc[v] = (vc[v] || 0) + 1;
      const ns = Object.values(vc), pairs = ns.filter(n => n >= 2).length;
      if (pairs > st.bestPairs) st.bestPairs = pairs;
      const stack = Math.max(0, ...ns);
      if (stack > st.bestStack) st.bestStack = stack; }
    streak = s >= 1e5 ? streak + 1 : 0;
    if (streak > st.bestStreak) st.bestStreak = streak;
    /* stickered seats on this hand */
    const keys = handStk.filter(Boolean);
    st.stkBanked += keys.length;
    if (keys.length > st.bigStk) st.bigStk = keys.length;
    const kk = new Set(keys).size;   /* Collage: distinct sticker kinds one bank held */
    if (kk > st.stkKinds) st.stkKinds = kk;
    if (N >= 5 && keys.length === N) st.inkBanks++;
    /* the OUT engines dump on bank; a bust sweeps the pile home. A
       player AIMS them at their 1-cards for One Out — the intent share
       is owned 1s over the deck */
    const oneShare = (owned[1] || 0) / deckSize;
    for (let i = 0; i < N; i++) {
      const d = handStk[i] && STKD[handStk[i]]; if (!d) continue;
      if (d.out) { outHeld += d.out; st.outed += d.out; st.oneOut += d.out * oneShare; }
      if (d.outN) { outHeld += N; st.outed += N; st.oneOut += N * oneShare; if (d.gone) { goneHeld += N; deckSize -= N; recalcVals(); } }
      if (d.chainKeep) chain++;          /* encore/offering: the run plays on */
    }
    if (copiesNow.recycle) outHeld = Math.max(0, outHeld - 1);
    if (outHeld > st.maxOut) st.maxOut = outHeld;
    if (outHeld >= 3) st.outBanks++;
    if (outHeld >= 5) st.deepBanks++;
    if (outHeld >= 6) st.fleetBanks++;
    if (outHeld && discSize) st.pileBanks++;
    if (discSize >= 3) st.benchBanks++;
    discSize = 0;                        /* the score homes the discard */
    /* Purge benches the banked hand here — after the sweep, so its cards
       wait out one FULL score, not this one */
    if (handStk.some(k => k && STKD[k] && STKD[k].purgeN)) {
      discSize += N; st.discarded += N;
      if (discSize > st.maxDisc) st.maxDisc = discSize;
    }
    relicBanks += (copiesNow.relic || 0) * cyc();
    /* a chain tick wants a bank big enough for the combo: 2 cards, +1
       per 10 chain (mirrors economy.js chainReq). A short bank lets
       the combo slip: chain -1 */
    if (N >= 2 + Math.floor(chain / ECO.CHAIN_STEP_AT)) { chain++; chainScore += s; }
    else if (chain > 0) chain--;
    avgChain = avgChain * .9 + chain * .1;
    if (chainScore > st.bestChain) st.bestChain = chainScore;
    if (chain > st.bestChainN) st.bestChainN = chain;
    hand = []; handStk = []; cullWards = 0;
  }
  function doBust() {
    const bs = handScore(), N = hand.length, r = riskPct();
    if (bs > st.bestBust) st.bestBust = bs;
    if (N > st.bigBustN) st.bigBustN = N;
    /* rescues first: float pays flat at the line, bail pays in full */
    if (floatArmed && r >= .70) {
      floatArmed = 0;
      const flat = bs / riskMul(r);
      score += flat; banked += flat; life += flat;
      if (flat > st.bestFloat) st.bestFloat = flat;
      st.banks++; st.runs++;
      hand = []; handStk = []; cullWards = 0;
      return;
    }
    if (bailArmed) {
      bailArmed = 0;
      score += bs; banked += bs; life += bs;
      if (bs > st.bestFloat) st.bestFloat = bs;
      st.banks++; st.runs++;
      hand = []; handStk = []; cullWards = 0;
      return;
    }
    const keys = handStk.filter(Boolean);
    if (N === 2 && keys.length === 2) st.twoStkBusts++;
    const keep = bs * .05 * L('salv');
    score += keep; life += keep;
    /* siphon rides the buster, through the standing table's full mult
       stack; guardian pays flat from the pile; silver covers the cold
       landing */
    let bp = (copiesNow.siphon || 0) * cyc() * 10 * vbar * stackMul();
    if (copiesNow.guardian && rnd() < .33) bp += bs * .5;
    if (M('silver') && r <= .10) bp += bs / riskMul(r);
    if (bp > 0) { score += bp; banked += bp; life += bp; }
    const ev = stickerEV({ out: outCount(), bad: rawRisky(), N, seats: 0 });
    score += ev.drawLane * .5; life += ev.drawLane * .5;   /* draw-lane payers fired mid-hand */
    st.busts++; st.runs++;
    st.aBusts++;
    st.bustRun = r < .5 ? st.bustRun + 1 : 0;
    if (st.bustRun > st.bestBustRun) st.bestBustRun = st.bustRun;
    if (r <= .05) st.coldBusts++;
    chain = 0; chainScore = 0; st.row3 = 0; st.sevenRun = 0; wideRun = 0; hotRun = [0, 0, 0]; streak = 0;
    outHeld = 1;                          /* the buster takes the seat; pile homes */
    if (outHeld > st.maxOut) st.maxOut = outHeld;
    hand = []; handStk = []; cullWards = 0;
  }

  /* ---- the ascend ---- */
  const METAPRIO = ['prodigy','quick','head','rich','keeper','press','daring','trader','storage','fortune','preprint','rebound','dreamer','silver','vantage','stall','union','rally'];
  function spendShards() {
    let bought = true;
    while (bought && shards > 0) {
      bought = false;
      for (const k of METAPRIO) {
        if ((meta[k] || 0) >= META[k].max) continue;
        const g = SUGOAL[k];
        /* row level 1 waits on its SU goal when the sim can read it;
           unmodeled gates open in the shard era (a stand-in, printed) */
        if ((meta[k] || 0) === 0 && g && MODELED.has(g.k) && !met[g.id]) continue;
        const c = Math.ceil(META[k].c(meta[k] || 0));
        if (shards >= c) { shards -= c; meta[k] = (meta[k] || 0) + 1; bought = true;
          if (LOG) log.push([t, 'meta ' + k + ' ' + meta[k]]); }
      }
    }
  }
  function ascend() {
    const req = P.ASC_REQ * Math.pow(ASC_GROW, era2);
    const g = Math.floor(3 * Math.sqrt(banked / req) * (1 + .12 * M('fortune')) * achS);
    shards += g; shAll += g; era2++;
    if (era2 === 1) tAsc1 = t;
    else if (era2 === 2) tAsc2 = t;
    else if (era2 === 3 && tAsc3 == null) tAsc3 = t;
    if (!WEEK && era2 >= 3) return;   /* the third ascend is the horizon outside the week */
    if (LOG) log.push([t, 'ASCEND +' + g + ' shards']);
    /* the reset: upgrades gone, deck reseeded, keeper keeps its vinyl */
    const keep = M('keeper');
    const keptKeys = Object.keys(copiesNow).filter(k => copiesNow[k])
      .sort((a, b) => STK[b].t * 100 + estPay(b) * 10 - STK[a].t * 100 - estPay(a) * 10)
      .slice(0, keep);
    for (const k in copiesNow) if (!keptKeys.includes(k)) copiesNow[k] = 0;
    let keptN = 0; for (const k of keptKeys) keptN += copiesNow[k];
    for (const k in up) up[k] = 0;
    const top = 3 + M('head');
    for (const k of Object.keys(owned)) delete owned[k];
    for (let v = 1; v <= top; v++) owned[v] = v;
    deckSize = top * (top + 1) / 2 + keptN;
    banked = 0; chain = 0; chainScore = 0; hand = []; handStk = []; cullWards = 0;
    outHeld = 0; goneHeld = 0; discSize = 0;
    placedNow = keptN;
    for (const v in seats) delete seats[v];
    for (const k of keptKeys) seatSticker(k, copiesNow[k]);
    /* Preprint: N random unlocked stickers land on the fresh deck, same
       tier odds as the shop roll; they count as live placements */
    for (let i = 0; i < M('preprint'); i++) {
      const p = Object.keys(STK).filter(k => !OFF[k] && met[STKGOAL[k]] && STK[k].t <= tierOf()
        && !(NONSTACK[k] && copiesNow[k]));
      if (!p.length) break;
      const byT = {};
      for (const k of p) (byT[STK[k].t] = byT[STK[k].t] || []).push(k);
      const tiers = Object.keys(byT).map(Number);
      let rr = rnd() * tiers.reduce((a, t) => a + ECO.TIER_W[t - 1], 0), ti = tiers[0];
      for (const tt of tiers) { rr -= ECO.TIER_W[tt - 1]; if (rr <= 0) { ti = tt; break; } }
      const k = byT[ti][Math.floor(rnd() * byT[ti].length)];
      copiesNow[k] = (copiesNow[k] || 0) + 1;
      seatSticker(k, 1);
      placedNow++;
    }
    score = Math.floor(400 * Math.pow(2.15, M('rich')) - 400);
    svLedger.active = false;             /* a fresh era saves fresh */
    offers = []; shopT = 0;              /* the shelves re-lock to kept placements */
    avgN = 3; avgRisk = .35; avgChain = 2; relicBanks = 0;
    recalcVals();
    spendShards();
    cdEnd = t + 1;
  }

  /* placing a bought sticker on a card of a random value (weighted by
     copies owned — the way a real collection spreads). One Out wants
     intent: hunting it seats out engines on a 1 outright */
  function seatSticker(k, n, atOne) {
    for (let i = 0; i < n; i++) {
      let val;
      if (atOne && (owned[1] || 0) > seats[1]?.n) val = 1;
      else {
        let tot = 0; for (let v = 1; v <= 20; v++) tot += owned[v] || 0;
        let r = rnd() * tot, val2 = 3;
        for (let v = 1; v <= 20; v++) { r -= owned[v] || 0; if (r < 0) { val2 = v; break; } }
        val = val2;
      }
      const s = seats[val] = seats[val] || { n: 0, keys: {} };
      s.n++; s.keys[k] = (s.keys[k] || 0) + 1;
    }
  }
  const buySticker = k => {
    const d = STKD[k];
    const aim1 = hunt && hunt.g && hunt.g.k === 'oneOut' && d && (d.out || d.outN);
    score -= stkPrice(k); placed++; placedNow++;
    copiesNow[k] = (copiesNow[k] || 0) + 1;
    seatSticker(k, 1, aim1);
    if (aim1) st.oneOut++;
    if (tSticker == null) tSticker = t;
    if (LOG) log.push([t, 'sticker ' + STK[k].n + ' (' + stkPrice(k) + ')' + (aim1 ? ' on a 1' : '')]);
  };

  /* ---- the play loop's bank decision, hunt-aware ---- */
  function wantBank(r) {
    const pol = hunt ? hunt.pol : null;
    /* Paper Cut rides a 2-stickered hand to the bust; anything else
       banks normally and retries */
    if (pol && pol.bustPush && hand.length === 2 && handStk[0] && handStk[1]) return false;
    if (hand.length >= P.HAND_CAP) return true;
    if (pol) {
      if (pol.comp) {
        const sv = [...hand].sort((a, b) => a - b);
        let ok = false;
        if (pol.comp === 'seven') ok = hand.length === 7;
        else if (pol.comp === '123') ok = [1, 2, 3].every(v => hand.includes(v));
        else if (pol.comp === 'spread') ok = sv.length >= 3 && sv.every((v, i) => i === 0 || v - sv[i - 1] >= 2);
        else if (pol.comp === 'rich3') ok = hand.length >= 3 && sv.every(v => v >= 3);
        if (ok) return true;
        return r >= .85;                                 /* bust-guard, retry next hand */
      }
      if (pol.wide && hand.length < pol.wide) return pol.bustLine != null ? r >= pol.bustLine : r >= .85;
      if (pol.safe && hand.length >= 2 && r >= .22) return true;
    }
    const line = pol && pol.line != null ? pol.line : A.line;
    return r >= line || hand.length >= P.HAND_CAP;
  }

  /* ---- the draw ---- */
  function tryDraw() {
    const remaining = deckSize - hand.length - outHeld - goneHeld;
    if (remaining <= 0) { doBank(); return; }
    const cnt = {};
    for (const v of hand) cnt[v] = (cnt[v] || 0) + 1;
    let badW = 0;
    for (const v in cnt) badW += Math.max(0, (owned[v] || 0) - cnt[v]);
    const r0 = (badW / remaining) * (1 - Math.min(.6, .22 * (copiesNow.purify || 0)));
    tacticTick(r0, true);
    /* discard engines ride the draw: their cards sit on tables */
    const p = 1 / effDeck();
    for (const k in copiesNow) {
      const d = STKD[k]; if (!d || !d.disc) continue;
      const n = copiesNow[k] * d.disc * p;
      discSize += n; st.discarded += n;
      /* safe cuts: Whip only ever cuts blanks, the other cutters bench
         the safe share of the deck */
      st.safeDisc += d.safe ? n : n * (1 - r0);
    }
    if (discSize > st.maxDisc) st.maxDisc = discSize;
    const both = Math.min(outHeld, discSize);
    if (both > st.bothPiles) st.bothPiles = both;
    const r = rnd() * remaining;
    if (r < badW) {
      /* a twin lands: flinch exiles its own value's twin straight OUT —
         one catch a run, the trigger spends the standing flinch — then
         Cull's pocketed ward saves the draw to the discard and dodge
         chains (marked, wards, anchors, grace): what gets past
         everything busts */
      const flN = handStk.reduce((n, k) => n + (k === 'flinch'), 0);
      if (flN && rnd() < flN / hand.length) {
        handStk[handStk.indexOf('flinch')] = null;
        outHeld++; st.outed++; return; }
      const dodge = Math.min(.85, .01 * L('marked') + .15 * (copiesNow.ward || 0)
        + .10 * (copiesNow.anchor || 0) + .03 * (copiesNow.reverb || 0) + .05 * L('grace')
        + .04 * (copiesNow.strip || 0));
      if (cullWards > 0) {
        cullWards--;
        st.deflects++; st.wardLost++;
        if (riskPct() < .10) st.coldWards++;
        discSize++; st.discarded++;
        return; }
      if (rnd() < dodge) {
        st.deflects++;
        /* wards lost: the shield-flavored share of the save (marked and
           anchor are slips, not wards) */
        st.wardLost += (.15 * (copiesNow.ward || 0) + .03 * (copiesNow.reverb || 0)
          + .05 * L('grace') + .04 * (copiesNow.strip || 0)) / dodge;
        if (riskPct() < .10) st.coldWards++;
        discSize++; st.discarded++;
        if (copiesNow.ward) st.stkDraws += .5;
        return;
      }
      doBust();
      return;
    }
    const safeVals = [];
    for (let v = 1; v <= 20; v++) if ((owned[v] || 0) > 0 && !cnt[v]) safeVals.push(v);
    let safeCount = 0;
    for (const v of safeVals) safeCount += owned[v];
    let rr = rnd() * safeCount, pick = null;
    for (const v of safeVals) { rr -= owned[v]; if (rr < 0) { pick = v; break; } }
    if (pick == null) { doBank(); return; }
    st.draws++;
    hand.push(pick);
    /* is the drawn card one of the stickered seats? */
    const s = seats[pick];
    let key = null;
    if (s && s.n > 0 && rnd() < s.n / owned[pick]) {
      let tot = 0; for (const k in s.keys) tot += s.keys[k];
      let r2 = rnd() * tot;
      for (const k in s.keys) { r2 -= s.keys[k]; if (r2 < 0) { key = k; break; } }
    }
    handStk.push(key);
    /* Encore: the piles trade — the discard deals again, the deck waits
       out one score. No deck-order model, so the swap reads as the
       discard standing at the old deck's depth */
    if (key === 'encore' && discSize > 0) {
      discSize = Math.max(0, deckSize - hand.length - outHeld - goneHeld - discSize);
      if (discSize > st.maxDisc) st.maxDisc = discSize;
      const both = Math.min(outHeld, discSize);
      if (both > st.bothPiles) st.bothPiles = both;
    }
  }

  /* ---- the buyer ---- */
  let buyClock = 0, cardClock = 0, rate = 0, lastLife = 0;
  const svLedger = { active: false, since: 0, for: null };
  const likeOf = k => {
    const d = STKD[k]; if (!d) return 1;
    const role = d.role;
    let w = A.like[role] || 1;
    if (hunt && hunt.pol.role) {
      if (hunt.pol.role === 'many') w *= 1.6;
      else if (role === hunt.pol.role) w *= 4;
      else if (ROLE_X[hunt.pol.role] && ROLE_X[hunt.pol.role].has(k)) w *= 4;
    }
    if (hunt && hunt.pol.role2) {
      if (role === hunt.pol.role2) w *= 2;
      else if (ROLE_X[hunt.pol.role2] && ROLE_X[hunt.pol.role2].has(k)) w *= 2;
    }
    /* taste: the first copy of something new beats a duplicate, piles of
       one sticker decay hard, and deeper tiers carry their strength.
       An unmet gate's producer role earns the family-need boost */
    if (needRoles.has(role) || (needRoles.has('draw') && ROLE_X.draw.has(k))) w *= 3;
    if (!(copiesNow[k] > 0)) w *= 1.6;
    else w /= 1 + .5 * (copiesNow[k] - 1);
    w *= 1 + .08 * (STK[k].t - 1);
    return w;
  };
  function bestStickerOffer() {
    let best = null;
    for (const k of offers) {
      const cost = stkPrice(k);
      const ep = estPay(k) * likeOf(k);
      const s = ep / cost * (hunt && hunt.pol.stickerFirst ? 2 : 1);
      const c = { cost, s, kind: 'stk', stk: k };
      if (score >= cost && (!best || s > best.s)) best = c;
    }
    return best;
  }
  const roleOwned = role => {
    if (role === 'many') return placedNow;
    let n = 0;
    for (const k in copiesNow) {
      if (!copiesNow[k]) continue;
      if ((STKD[k] && STKD[k].role === role) || (ROLE_X[role] && ROLE_X[role].has(k))) n += copiesNow[k];
    }
    return n;
  };
  /* roles the unmet gates want, recomputed at each restock: a smart
     player buys the producer the moment it stocks, formal hunt or not */
  let needRoles = new Set();
  const recomputeNeed = () => {
    needRoles = new Set();
    for (const g of GOALS) {
      if (met[g.id] || !g.stk || !NEED[g.k] || OFF[g.stk]) continue;
      if (STK[g.stk].t <= tierOf() + 1) needRoles.add(NEED[g.k]);
    }
  };

  let tick = 0, goalClock = 0, markClock = 0, nextDay = 86400;
  const weekLog = [];
  /* goal-driven prestige: the ascend funds the next wanted shard row.
     The want is the first open row's next level in priority order; wants
     past ASC_CAP accumulate over several ascends; nothing wanted, no
     reason to reset */
  function wantTarget() {
    for (const k of METAPRIO) {
      if ((meta[k] || 0) >= META[k].max) continue;
      const g = SUGOAL[k];
      if ((meta[k] || 0) === 0 && g && MODELED.has(g.k) && !met[g.id]) continue;
      const w = Math.ceil(META[k].c(meta[k] || 0));
      return Math.min(Math.max(ASC_GAIN, w), ASC_CAP);
    }
    return Infinity;
  }
  /* the game's own offline formula: auto-draw's rate x (40% + 15%/dreamer),
     capped at 4h + 2h/dreamer, paid into banked */
  function offlineLump(dur) {
    if (!OFFLINE_ON || !L('auto') || rate <= 0) { lastLife = life; return; }
    const tOff = Math.min(dur, (4 + 2 * M('dreamer')) * 3600);
    const gain = tOff * rate * (.40 + .15 * M('dreamer'));
    if (gain < 1) { lastLife = life; return; }
    score += gain; banked += gain; life += gain; lastLife = life;
    if (LOG) log.push([t, 'offline +' + Math.round(gain)]);
  }
  while (t < SIM_HOURS * 3600 && (WEEK || tAsc3 == null)) {
    t += DT;
    /* the week: 8h of play between two 8h breaks. A break is one lump —
       the game's own offline formula (auto-draw rate x eff, capped) — and
       the clocks freeze through it */
    if (WEEK) {
      const ph = t % 86400;
      if (ph < 28800 || ph >= 57600) {
        const segEnd = ph < 28800 ? t - ph + 28800 : t - ph + 86400;
        offlineLump(segEnd - t);
        t = segEnd;
      }
    }
    while (t >= nextDay) {
      weekLog.push({ day: Math.round(nextDay / 86400), era: era2, sh: shAll,
        spent: shAll - shards, goals: Object.keys(met).length });
      nextDay += 86400;
    }
    if (watch && (++tick % 5) === 0) watch(t, st, owned, deckSize, era2 >= 1);
    shopT += DT;
    if (shopT >= shopGap()) { shopT = 0; restock(); }
    goalClock += DT;
    if (goalClock >= 5) { goalClock = 0; checkGoals(); huntTick(); }
    markClock += DT;
    if (markClock >= 60) { markClock = 0; marks[Math.round(t)] = { banked, score, life, rate, era: era2 }; }
    if (t >= cdEnd) {
      if (stakesD > 0) stakesD--;
      const r = hand.length ? riskPct() : 0;
      if (hand.length && wantBank(r)) doBank();
      else { tryDraw(); cdEnd = t + baseCD(); }
      { const req = P.ASC_REQ * Math.pow(ASC_GROW, era2);
        const target = ASC_MODE === 'meter' ? ASC_GAIN : wantTarget();
        if (target !== Infinity && banked >= req * (target / 3) * (target / 3)) { ascend(); if (tAsc3 != null && !WEEK) break; } }
    }
    rate = rate * 0.98 + (life - lastLife) * 0.02 / DT; lastLife = life;
    buyClock += DT;
    if (buyClock >= 0.6) {
      buyClock = 0;
      /* the first sticker is a milestone buy: latch the save until bought */
      if (tSticker == null && offers.length) {
        const cheapest = Math.min(...offers.map(stkPrice));
        if (cheapest - score < rate * 200) svLedger.active = true;
      }
      const firstSave = tSticker == null && svLedger.active;
      /* needs-must pooling check: a hunt whose family the player owns
         none of, with a producer on the shelf, owns the wallet */
      let pooling = false, poolPick = null;
      if (!firstSave && hunt && hunt.pol.role && hunt.pol.role !== 'many' && roleOwned(hunt.pol.role) === 0) {
        poolPick = offers.find(k => {
          const d = STKD[k]; if (!d) return false;
          return d.role === hunt.pol.role || (ROLE_X[hunt.pol.role] && ROLE_X[hunt.pol.role].has(k));
        }) || null;
        if (poolPick && score < stkPrice(poolPick)) pooling = true;
      }
      /* the card lane (a hunt that needs values buys cards harder) */
      const cardLane = (svLedger.active || pooling) ? 0 : (hunt && hunt.pol.cardFirst ? .9 : .6);
      cardClock += cardLane;
      const cardEvery = hunt && hunt.pol.cardFirst ? 0.6 : 1.2;
      if (!firstSave && !pooling && cardClock >= cardEvery) {
        cardClock = 0;
        let bestV = 0;
        for (let v = 1; v <= unlockedV(); v++) if ((owned[v] || 0) < v) { bestV = v; break; }
        if (bestV && score >= cardCost(bestV)) {
          score -= cardCost(bestV); owned[bestV] = (owned[bestV] || 0) + 1; deckSize += 1;
          recalcVals();
          if (LOG) log.push([t, 'single ' + bestV]);
        }
      }
      if (firstSave) {
        let cheapest = null, ck = null;
        for (const k of offers) { const c = stkPrice(k); if (cheapest == null || c < cheapest) { cheapest = c; ck = k; } }
        if (ck && score >= cheapest) { buySticker(ck); svLedger.active = false; }
      } else {
        /* needs-must: the pooled producer buys the moment it is
           affordable; while pooling, nothing else spends */
        if (poolPick && !pooling) { buySticker(poolPick); offers = offers.filter(x => x !== poolPick); }
        if (!poolPick || !pooling) {
        let best = null, bestAff = null;
        for (const oid of P.ORDER) {
          const [rowMax, base, g] = P.UPG[oid];
          /* the Marked Pendant lifts the deck ceiling, 30 levels to 50 */
          const max = oid === 'marked' && meta.pendant ? rowMax + 20 : rowMax;
          if (up[oid] >= max) continue;
          /* a row may pin its ladder (flick's 500/1500/5000): slot 5 wins over base×g */
          const ladder = P.UPG[oid][4];
          const cost = ladder ? ladder[up[oid]] : Math.ceil(base * Math.pow(g, up[oid]));
          if (score >= cost && upAfford[oid] == null) upAfford[oid] = t;
          /* upOpen: the row hides until its u-goal is claimed; gates the
             sim under-reads (records) open at their show floor instead */
          const ug = UGOAL[oid];
          if (ug && !met[ug.id] && MODELED.has(ug.k)) {
            if (ENGINE_STAT.has(ug.k)) { if (life < P.UPG[oid][3]) continue; }
            else continue;
          }
          let s = (factorOf(oid) - 1) / cost;
          if (A.boost.indexOf(oid) >= 0) s *= P.BOOST;
          if (hunt && hunt.pol.speedFirst && oid === 'speed') s *= 2;
          const c = { cost, s, kind: 'up', oid };
          if (score >= cost && (!bestAff || s > bestAff.s)) bestAff = c;
          if (!best || s > best.s) best = c;
        }
        {
          const c = bestStickerOffer();
          if (c && score >= c.cost && (!bestAff || c.s > bestAff.s)) bestAff = c;
          if (c && (!best || c.s > best.s)) best = c;
        }
        const buy = c => {
          if (!c) return;
          if (c.kind === 'up') {
            score -= c.cost; up[c.oid]++;
            if (upFirst[c.oid] == null) upFirst[c.oid] = t;
            if (LOG) log.push([t, 'up ' + c.oid + ' ' + up[c.oid]]);
          } else { buySticker(c.stk); offers = offers.filter(x => x !== c.stk); }
        };
        const key = best ? (best.kind === 'up' ? best.oid : 'stk:' + best.stk) : null;
        if (best && score < best.cost && bestAff && best.s > bestAff.s * P.SAVE_MARKUP) {
          if (!svLedger.active || svLedger.for !== key) { svLedger.active = true; svLedger.since = t; svLedger.for = key; }
          if (t - svLedger.since >= P.SAVE_PATIENCE) { svLedger.active = false; buy(bestAff); }
        } else {
          svLedger.active = false;
          buy(bestAff);
        }
        }
      }
    }
  }
  return { arch: A.n, tSticker, tAsc1, tAsc2, tAsc3, weekLog, score, banked, life, deckSize, placed,
    placedNow, shards, shAll, era: era2, marks, st, upFirst, upAfford, met, huntLog, meta };

  /* the cooldown: haste's aura presence softens it */
  function baseCD() {
    return Math.max(0.22, P.CD * Math.pow(P.SPEED_PER, L('speed'))
      * Math.pow(.97, M('quick')) * (1 - .25 * presence()));
  }
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mins = s => s == null ? 'never' : (s / 60).toFixed(1) + 'm';

function bench(N = 11) {
  const out = [];
  for (const ak of ARCH_KEYS) {
    const stks = [], a1 = [], a2 = [], decks = [], placed = [], sh = [];
    for (let i = 1; i <= N; i++) {
      const r = runSim(i * 7919 + 13, null, null, ak);
      if (r.tSticker != null) stks.push(r.tSticker);
      if (r.tAsc1 != null) a1.push(r.tAsc1);
      if (r.tAsc2 != null) a2.push(r.tAsc2);
      decks.push(r.deckSize); placed.push(r.placed); sh.push(r.shAll);
    }
    out.push(`${ak.padEnd(12)} sticker ${mins(median(stks))}  ascend ${mins(median(a1))}  2nd ${mins(median(a2))}  deck ~${Math.round(median(decks))}  stickers ${Math.round(median(placed))}  shards ${Math.round(median(sh))}`);
  }
  console.log(`player v6 — ${ARCH_KEYS.length} archetypes x n=${N}, horizon = third ascend or ${SIM_HOURS}h`);
  for (const r of out) console.log('  ' + r);
}

if (process.argv[2] === 'week') {
  /* a week of play: 8h engaged between two 8h breaks each day, offline
     gains through the breaks, goal-driven prestige. Day-by-day medians
     per archetype */
  const rows = [];
  for (const ak of ARCH_KEYS) {
    const days = {};
    for (let i = 1; i <= 5; i++) {
      const R = runSim(i * 7919 + 13, null, null, ak);
      for (const d of R.weekLog) (days[d.day] = days[d.day] || []).push(d);
    }
    rows.push({ ak, days });
  }
  console.log('a week of SQUEEZER — ' + ARCH_KEYS.length + ' archetypes x 5 runs, 8h play between 2x8h breaks, offline gains, goal-driven prestige');
  for (const { ak, days } of rows) {
    const parts = [];
    for (const day of Object.keys(days).map(Number).sort((a, b) => a - b)) {
      const ds = days[day];
      const med = f => { const s = ds.map(f).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
      parts.push(`d${day} asc${med(d => d.era)} ${med(d => d.sh)}sh ${med(d => d.spent)}sp ${med(d => d.goals)}g`);
    }
    console.log('  ' + ak.padEnd(10) + parts.join('  '));
  }
} else if (process.argv[2] === 'detail' || LOG) {
  log = [];
  const r = runSim(12345, null, null, 'hunter');
  console.log('arch', r.arch, '| tSticker', mins(r.tSticker), 'tAsc1', mins(r.tAsc1), 'tAsc2', mins(r.tAsc2),
    'deck', r.deckSize, 'placed', r.placed, 'shards', r.shAll);
  console.log('hunts:', r.huntLog.map(([id, t]) => id + '@' + (t / 60).toFixed(0) + 'm').join(' '));
  for (const [t, e] of log) console.log(`  ${(t / 60).toFixed(1).padStart(6)}m  ${e}`);
  const mk = Object.keys(r.marks).map(Number).sort((a, b) => a - b);
  for (const m of mk) console.log(`  t=${(m / 60) | 0}m era${r.marks[m].era} banked=${Math.round(r.marks[m].banked)} rate=${(r.marks[m].rate || 0).toFixed(1)}/s`);
} else if (process.argv[2] === 'tune') {
  for (const AB of [800, 1000, 1400, 2000, 2800]) {
    for (const ASC of [60000, 120000, 200000, 300000, 420000]) {
      P.STK_BASE = AB; P.ASC_REQ = ASC;
      const a1 = [];
      for (let i = 1; i <= 7; i++) {
        const r = runSim(i * 6151 + 7, null, null, 'climber');
        if (r.tAsc1 != null) a1.push(r.tAsc1);
      }
      console.log(`STK_BASE=${AB} ASC_REQ=${ASC}  ->  climber ascend ${mins(median(a1))}`);
    }
  }
} else if (process.argv[2] === 'metrics') {
  /* one JSON line of population medians for the BI dashboard's
     live-vs-sim grounding card. Save it: node sim.js metrics >
     docs/sim-metrics.json — rerun whenever the economy constants move;
     the dashboard stamps the file's age */
  const N = +(process.argv[3] || 3);
  const ANCH = [15, 30, 60, 120, 240, 480, 1440, 2880];
  const runs = [];
  for (const ak of ARCH_KEYS) for (let i = 1; i <= N; i++) runs.push(runSim(i * 7919 + 13, null, null, ak));
  const md = a => (a.length ? median(a) : null);
  const lifeAt = {};
  for (const A of ANCH) {
    const vals = [];
    for (const r of runs) {
      let v = null;
      for (const t of Object.keys(r.marks).map(Number).sort((a, b) => a - b))
        if (t <= A * 60) v = r.marks[t].life;
      if (v != null) vals.push(v);
    }
    lifeAt[A] = vals.length ? Math.round(md(vals)) : null;
  }
  const pick = f => runs.map(f).filter(v => v != null);
  console.log(JSON.stringify({
    gen: new Date().toISOString(), n: N, archN: ARCH_KEYS.length,
    tSticker: md(pick(r => r.tSticker)), tAsc1: md(pick(r => r.tAsc1)),
    tAsc2: md(pick(r => r.tAsc2)), tAsc3: md(pick(r => r.tAsc3)),
    lifeAt, deck: Math.round(md(runs.map(r => r.deckSize))),
    placed: Math.round(md(runs.map(r => r.placed))), shards: Math.round(md(runs.map(r => r.shAll)))
  }));
} else if (process.argv[2] === 'goals' || process.argv[2] === 'report') {
  /* goal pacing over the archetype population: every goal gets the
     hunter's median (a player who wants the sticker, playing toward it)
     beside the population median, and the shard gates finally get real
     minutes out of era 2 */
  const WIN = { 1:[3,30], 2:[20,90], 3:[30,150], 4:[90,300], 5:[150,1000] };
  /* stats the model still cannot tick: shiny vinyl, composition shots,
     multi-table play, per-arm identity */
  const GATED = new Set(['works','books','twinTowns','boomerangs','db2Best','db2N',
    'boardVals','maxTables','shinyPlaced','shinyBought','bestShine','drafted','fetches','recharges','inspects','effectBusts']);
  const ENGINE = new Set(['bestChain','bestStreak','bestBank','bestFloat']);   /* jackpot records still read low: random sticker seats, no aimed Gild, one table */
  /* who else can produce each gated stat, for the texture count */
  const METHODS = {
    maxOut:['scrap','vanish','defuse','offering','flinch'],
    outBanks:['scrap','vanish','defuse','offering','flinch'],
    deepBanks:['vanish','defuse','scrap','offering'],
    fleetBanks:['vanish','defuse','scrap','offering'],
    stkDraws:['draft','ward'],
    stkBanked:['haste','odds','snip','mint','brass','ward','rake','swap'],
    benchBanks:['ward','snip','burn','reverb','echo','draft','purge','twin','sub','encore'],
    rewrites:['swap','clip','ghost','dredge','riffle','engrave','patch','windfall','tempo'],
    bigRewrites:['swap','ghost','dredge','riffle','engrave','patch','windfall'],
    bestFloat:['float','bail'],
    hits:['bloom','dividend','kindle'],
    deflects:['ward','anchor'],
    bothPiles:['defuse','ward','snip','burn','reverb','echo','twin'],
    discarded:['ward','snip','defuse','burn','reverb','echo','draft','purge','twin','encore','barter'],
    maxDisc:['ward','snip','defuse','burn','reverb','echo','draft','purge','encore','barter'],
    safeDisc:['whip','burn','draft','defuse','reverb','snip'],
    wardLost:['strip','ward','reverb'],
    effectBusts:['sub','draft','barter','recast'],
    oneOut:['scrap','vanish','defuse','offering','flinch'],
    pileBanks:['defuse','ward','snip','burn','reverb','echo','scrap','vanish','purge','draft','twin'],
  };
  /* stat -> [primary pillars (tie 3), related pillars (tie 1)] by STKTYPE */
  const AFF = {
    bestBank:[['value','payer'],['table','aura']],
    bigHand:[['value','table'],['aura']],
    spread:[['value'],['table']],
    owned:[['value'],['payer']],
    sets:[['value'],[]],
    bestHandDraws:[['aura','table'],['value']],
    draws:[['value'],['aura','out']],
    bestRisk:[['aura','insurance'],['trick']],
    bestRisky:[['table'],[]],
    busts:[['insurance'],[]],
    bestBustRun:[['insurance'],[]],
    hotBanks:[['aura','insurance'],['trick']],
    bestBust:[['payer','insurance'],[]],
    bestChainN:[['table'],['payer','trick','out']],
    bestChain:[['value'],['payer','table']],
    bestStreak:[['out'],['table','payer']],
    bigBanks:[['payer'],['table']],
    bestWide:[['payer','table'],['value','aura']],
    bestRow3:[['payer','table'],['value','aura']],
    richBanks:[['value'],['payer','table']],
    oneTwoThree:[['value'],['payer','table']],
    hits:[['table','payer'],[]],
    placed:[['table','value'],[]],
    bigStk:[['table'],['value']],
    arms:[['trick'],[]],
    rewrites:[['value','trick'],[]],
    bigRewrites:[['value'],['trick']],
    hot60:[['aura','trick'],[]],
    hot70:[['aura','trick'],[]],
    hot80:[['aura','trick'],[]],
    stkDraws:[['value'],['out']],
    outed:[['out','out-pay'],['trick']],
    discarded:[['out','out-pay'],['insurance','trick','discard','disc-pay']],
    maxOut:[['out','out-pay'],['trick']],
    outBanks:[['out','out-pay'],['insurance']],
    deepBanks:[['out'],['trick']],
    fleetBanks:[['out','out-pay'],['insurance','trick']],
    benchBanks:[['discard','disc-pay'],['out']],
    bestFloat:[['trick'],['insurance']],
    deflects:[['insurance'],['aura','trick']],
    bothPiles:[['out','out-pay'],['trick','insurance']],
    maxDisc:[['discard','disc-pay'],['out','insurance','trick']],
    inkBanks:[['table','value'],['insurance']],
    coldBusts:[['insurance'],['out','trick']],
    oneOut:[['out','out-pay'],[]],
    twoStkBusts:[['insurance'],['table','value','out']],
    pileBanks:[['out','out-pay'],['insurance','trick']],
    stkBanked:[['table','value'],['out']],
    safeDisc:[['discard','disc-pay'],['out']],
    wardLost:[['insurance'],[]],
    effectBusts:[['trick'],['out','discard','insurance']],   /* the swap-in's own bust: Barter files as a trick, Recast works the bench */
    bigBustN:[['trick','insurance'],[]],   /* Squeeze files as a trick: the width feat rides its own type */
    recharges:[['trick'],[]],
    wreckSaves:[['insurance'],[]],
    fetches:[['trick'],[]],
    drafted:[['trick'],[]],
    inspects:[[],['value']],
    asc:[['insurance'],[]],
  };
  const statOf = a => statOfSrc(a);
  const simmable = a => MODELED.has(statOf(a));
  P.HAND_CAP = 14;   // wide-hand goals need headroom past the bank-at-8 habit
  const N = 9, metBy = { }, ascT = {}, asc2T = {}, benchMax = [], hunterMax = [];
  ACH.forEach(a => { metBy[a.id] = { all: [] }; });
  for (const ak of ARCH_KEYS) metBy[ak] = {};
  const asc3T = {};
  for (const ak of ARCH_KEYS) {
    const a1s = [], a2s = [], a3s = [];
    for (let i = 1; i <= N; i++) {
      const r = runSim(i * 7919 + 13, null, null, ak);
      for (const id in r.met) { metBy[id].all.push(r.met[id]); (metBy[ak][id] = metBy[ak][id] || []).push(r.met[id]); }
      if (r.tAsc1 != null) { a1s.push(r.tAsc1);
        for (const a of ACH) if (statOf(a) === 'asc' && !r.met[a.id] && r.era >= a.t) { const at = [r.tAsc1, r.tAsc2, r.tAsc3][a.t - 1]; if (at != null) { metBy[a.id].all.push(at); (metBy[ak][a.id] = metBy[ak][a.id] || []).push(at); } } }
      if (r.tAsc2 != null) a2s.push(r.tAsc2);
      if (r.tAsc3 != null) a3s.push(r.tAsc3);
      benchMax.push(r.st.bestBank);
      if (ak === 'hunter') hunterMax.push(r.st.bestBank);
    }
    ascT[ak] = a1s.length ? median(a1s) : null;
    asc2T[ak] = a2s.length ? median(a2s) : null;
    asc3T[ak] = a3s.length ? median(a3s) : null;
  }
  const minsOf = a => { const s = a.filter(x => x != null).sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] / 60 : null; };
  const ascMed = minsOf(Object.values(ascT));
  const asc2Med = minsOf(Object.values(asc2T));
  const asc3Med = minsOf(Object.values(asc3T));
  const rows = ACH.filter(a => a.stk && !OFF[a.stk]).map(a => {
    const k = statOf(a), tier = STK[a.stk].t;
    const gated = GATED.has(k), eng = ENGINE.has(k);
    const timed = simmable(a) && !gated && !eng;
    const hMed = metBy['hunter'][a.id] ? minsOf(metBy['hunter'][a.id]) : null;
    const aMed = metBy[a.id].all.length ? minsOf(metBy[a.id].all) : null;
    /* the pacing number is the HUNTER's: when a player who wants this
       sticker can take its gate */
    const mm = hMed != null ? hMed : aMed;
    let pace;
    if (gated || eng || !timed) pace = 2;
    else if (mm == null) pace = 0;
    else { const [lo, hi] = WIN[tier];
      const ratio = mm < lo ? lo / mm : mm > hi ? mm / hi : 1;
      pace = ratio <= 1 ? 4 : ratio <= 1.5 ? 3 : ratio <= 2.5 ? 2 : 1; }
    const m = (METHODS[k] || []).filter(x => x !== a.stk).length;
    const tex = m >= 3 ? 1 : m >= 1 ? 3 : ['bestBank','bestHandDraws','bestBust','bigHand','bestRisk',
      'bigBanks','bestChainN','spread','bestChain','bestStreak','bestRow3','bestBustRun'].includes(k) ? 2 : 1;
    const aff = AFF[k] || [[], []];
    const ty = STKTYPE[a.stk] || 'value';
    const tie = aff[0].includes(ty) ? 3 : aff[1].includes(ty) ? 1 : 0;
    return { id: a.id, stk: a.stk, stkN: STK[a.stk].n, tier, k, mm, hMed, aMed, timed, m,
      name: a.n, desc: typeof a.d === 'function' ? a.d() : a.d,
      pace, tex, tie, total: pace + tex + tie };
  });
  /* producer chains for the still-gated rows */
  const statByStk = {}, tierByStk = {}, stkTime = {}, stkEng = {};
  ACH.forEach(a => { if (a.stk) { statByStk[a.stk] = statOf(a); tierByStk[a.stk] = STK[a.stk].t; } });
  rows.forEach(r => { if (r.mm != null) { stkTime[r.stk] = r.mm; stkEng[r.stk] = false; } });
  const walking = new Set();
  const gateTime = stk => {
    if (stkTime[stk] != null) return stkTime[stk];
    if (walking.has(stk)) return null;
    walking.add(stk);
    const k = statByStk[stk];
    let best = null, bestEng = false;
    if (k != null) {
      if (ENGINE.has(k)) { best = WIN[tierByStk[stk]][1]; bestEng = true; }
      else for (const p of (METHODS[k] || [])) {
        if (p === stk) continue;
        const t = gateTime(p);
        if (t != null && (best == null || t < best)) { best = t; bestEng = !!stkEng[p]; }
      }
    }
    walking.delete(stk);
    if (best != null) { stkTime[stk] = best; stkEng[stk] = bestEng; }
    return best;
  };
  for (const r of rows) {
    if (!GATED.has(r.k)) continue;
    let seed = null, seedEng = false;
    for (const p of (METHODS[r.k] || [])) {
      const t = gateTime(p);
      if (t != null && (seed == null || t < seed)) { seed = t; seedEng = !!stkEng[p]; }
    }
    r.seed = seed; r.seedEng = seedEng;
    if (seed != null && seed > WIN[r.tier][1]) {
      r.late = true; r.pace = 1; r.total = r.pace + r.tex + r.tie; }
  }
  /* upgrade-gate review */
  const urows0 = ACH.filter(a => a.up).map(a => {
    const k = statOf(a);
    const times = metBy[a.id].all;
    const mm = times.length ? minsOf(times) : null;
    return { id: a.id, up: a.up, k, mm, am: null, hold: 0, wait: 0, nb: 0, gated: GATED.has(k),
      name: a.n, desc: typeof a.d === 'function' ? a.d() : a.d };
  }).sort((x, y) => (x.mm == null ? 1e9 : x.mm) - (y.mm == null ? 1e9 : y.mm));
  const BORING = new Set(['banks','busts','draws','owned','outed']);
  urows0.forEach(u => { u.boring = BORING.has(u.k); });

  /* one extra pass per archetype for afford/first-buy medians + summary */
  const afford = {}, firstBuy = {}, stks = [], decks = [], pls = [], shardCt = [];
  for (const ak of ARCH_KEYS) {
    for (let i = 1; i <= N; i++) {
      const r = runSim(i * 7919 + 13, null, null, ak);
      if (r.tSticker != null) stks.push(r.tSticker);
      decks.push(r.deckSize); pls.push(r.placed); shardCt.push(r.shAll);
      for (const oid in r.upFirst) (firstBuy[oid] = firstBuy[oid] || []).push(r.upFirst[oid]);
      for (const oid in r.upAfford) (afford[oid] = afford[oid] || []).push(r.upAfford[oid]);
    }
  }
  const urows = urows0.map(u => {
    const am = afford[u.up] ? minsOf(afford[u.up]) : null;
    const hold = u.mm != null && am != null && am < u.mm ? u.mm - am : 0;
    const wait = u.mm != null && am != null && u.mm < am ? am - u.mm : 0;
    const nb = firstBuy[u.up] ? firstBuy[u.up].length : 0;
    return { ...u, am, hold, wait, nb };
  });
  const summary = {
    n: N, archN: ARCH_KEYS.length, ascMed, asc2Med, asc3Med, win: WIN,
    bestBankMed: median(benchMax), hunterBankMed: hunterMax.length ? median(hunterMax) : 0,
    ascByArch: ARCH_KEYS.map(k => `${k} ${ascT[k] == null ? 'never' : (ascT[k] / 60).toFixed(0) + 'm'}`).join(' · '),
    asc2ByArch: ARCH_KEYS.map(k => `${k} ${asc2T[k] == null ? '-' : (asc2T[k] / 60).toFixed(0) + 'm'}`).join(' · '),
    asc3ByArch: ARCH_KEYS.map(k => `${k} ${asc3T[k] == null ? '-' : (asc3T[k] / 60).toFixed(0) + 'm'}`).join(' · '),
    sticker: minsOf(stks), deck: median(decks), placed: median(pls), shards: median(shardCt),
  };
  const det = runSim(12345, null, null, 'hunter');

  const fits = rows.filter(r => r.tie < 2).sort((x, y) => x.tie - y.tie || x.total - y.total);
  const late = rows.filter(r => r.late);

  if (process.argv[2] === 'goals') { printGoals({ rows, late, fits, urows, ascMed, asc2Med, asc3Med, summary }); }
  else {
    const html = htmlReport({ rows, late, fits, urows, ascMed, asc2Med, asc3Med, summary, det, WIN });
    fs.writeFileSync(__dirname + '/game-docs/balance.html', html);
    console.log('game-docs/balance.html written — ' + html.length + ' bytes');
  }

  /* ---------------- plain-language console ---------------- */
  function printGoals({ rows, late, fits, urows, ascMed, asc2Med, asc3Med, summary }) {
    const s = summary;
    console.log('SQUEEZER economy sim — player v6: archetypes, sticker tactics, goal hunts, two eras');
    console.log(`${s.archN} archetypes x n=${s.n} · first ascend ${ascMed == null ? 'never' : ascMed.toFixed(1) + 'm'} · second ${asc2Med == null ? 'never' : asc2Med.toFixed(1) + 'm'} · third ${s.asc3Med == null ? 'never' : s.asc3Med.toFixed(0) + 'm'} · first sticker ${s.sticker == null ? 'never' : '~' + s.sticker.toFixed(1) + 'm'} · deck ~${s.deck} · ${s.placed} stickers · ${s.shards} shards by era 2`);
    console.log(`ascend by archetype: ${s.ascByArch}`);
    console.log(`second ascend:       ${s.asc2ByArch}`);
    console.log(`third ascend:        ${s.asc3ByArch}`);
    console.log(`era a goal should land in, by sticker price tier: t1 3-30m · t2 20-90m · t3 30-150m · t4 90-300m · t5 150-1000m`);
    console.log('');
    console.log('FINDINGS');
    for (const f of findings({ rows, late, fits, urows, ascMed, asc2Med, summary }))
      console.log('  ' + f);
    console.log('');
    console.log('GOALS — hunter median (a player playing toward the gate), population in parens');
    const sorted = [...rows].sort((a, b) => (a.mm == null ? 1e9 : a.mm) - (b.mm == null ? 1e9 : b.mm));
    for (const r of sorted)
      console.log('  ' + goalLine(r));
    console.log('');
    console.log('UPGRADES — when each row unlocks vs when the money for level 1 is there');
    for (const u of urows)
      console.log('  ' + upLine(u));
    console.log('');
    console.log('SHARD UPGRADES — era 2 finally times these. The rule stands: level 1 must not open before the first ascend'
      + (ascMed == null ? '' : ' (~' + ascMed.toFixed(0) + 'm)') + '.');
    ACH.filter(a => a.meta && (a.lv || 1) === 1).forEach(a => {
      const k = statOf(a), times = metBy[a.id].all, eng = ENGINE.has(k);
      const mm = times.length ? minsOf(times) : null;
      const early = mm != null && !eng && ascMed != null && mm < ascMed;
      let txt;
      if (mm == null) txt = eng ? 'never met here — records read low, worst-case'
        : !MODELED.has(k) ? 'not modeled (composition/multi-table/shiny) — the sim spends there via the shard-era stand-in'
        : 'not reached before the second ascend';
      else txt = `opens ${mm.toFixed(1)}m` + (early ? ` — ${Math.round(ascMed - mm)}m BEFORE the ascend: raise the gate` : '');
      console.log(`  ${a.id} ${a.n}: ${a.d} → ${txt}`);
    });
  }
  function fmtK(n) { return n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : Math.round(n) + ''; }

  function goalLine(r) {
    const [lo, hi] = WIN[r.tier];
    let v;
    if (r.late) v = `producers only exist ~${Math.round(r.seed)}m in, past this sticker's ${lo}-${hi}m era`;
    else if (ENGINE.has(r.k)) v = 'chain/streak record: sim reads it low, treat as era-correct';
    else if (GATED.has(r.k)) v = r.seed != null
      ? `ready once producers exist (~${Math.round(r.seed)}m), era ${lo}-${hi}m`
      : 'not modeled — unlock order governs';
    else if (r.mm == null) v = 'never completed, even hunted — look at the goal';
    else {
      const pop = r.aMed != null && r.aMed > r.mm * 1.8 ? `, population ${r.aMed.toFixed(0)}m (hidden unless hunted)` : '';
      if (r.mm < lo) v = `hunter lands ${r.mm.toFixed(1)}m, ahead of the ${lo}-${hi}m era (free)${pop}`;
      else if (r.mm > hi) v = `hunter lands ${r.mm.toFixed(1)}m, past the ${lo}-${hi}m era${pop}`;
      else v = `hunter lands ${r.mm.toFixed(1)}m, inside the ${lo}-${hi}m era${pop}`;
    }
    return `${r.id} ${r.name} (${r.stkN}, t${r.tier}): ${r.desc} → ${v}`;
  }
  function upLine(u) {
    const open = u.mm == null
      ? (u.gated || !MODELED.has(u.k) ? 'opens at its show floor' : 'goal never completed here')
      : `goal lands ${u.mm.toFixed(1)}m`;
    let v = '';
    if (u.mm == null && ENGINE.has(u.k)) v = 'money record — sim reads it low';
    else if (u.hold > 5) v = `the money was already there ${u.hold.toFixed(0)}m earlier: the row hid past its moment`;
    else if (u.wait > 30) v = `the money only shows up ${u.wait.toFixed(0)}m later: the row opens long before it is reachable`;
    else if (u.nb < 5 * ARCH_KEYS.length && u.am == null && u.mm != null) v = 'never affordable in any run';
    else if (u.am != null && u.mm != null) v = `money at ${u.am.toFixed(1)}m — well paced`;
    else if (u.am != null) v = `money at ${u.am.toFixed(1)}m`;
    if (u.boring) v += ' · plain counter, re-point candidate';
    return `${u.id} ${u.name}: ${u.desc} → ${open}${v ? ', ' + v : ''}`;
  }

  function findings({ rows, late, fits, urows, ascMed, asc2Med, summary }) {
    const F = [];
    if (late.length) {
      F.push(`!! ${late.length} goals are UNREACHABLE in time — their producers only exist ` +
        `past the goal's own era: ` + late.map(r => `${r.id} ${r.name}`).join(', '));
    } else {
      F.push(`ok — no goal waits on a sticker the player cannot own yet.`);
    }
    const neverHunted = rows.filter(r => r.mm == null && !GATED.has(r.k) && !ENGINE.has(r.k) && r.timed);
    if (neverHunted.length)
      F.push(`!! ${neverHunted.length} goals even the HUNTER never completes: ` +
        neverHunted.map(r => `${r.id} ${r.name} (${r.k})`).join(', ') +
        '. The stat never crosses in two eras of goal-shaped play — re-point or re-price these.');
    const hidden = rows.filter(r => r.hMed != null && r.aMed != null && r.aMed > r.hMed * 1.8);
    if (hidden.length)
      F.push(`gates invisible without hunting (population lags the hunter 1.8x+): ` +
        hidden.map(r => `${r.id} ${r.name} hunter ${r.hMed.toFixed(0)}m / pop ${r.aMed.toFixed(0)}m`).join(', ') +
        '. Fine for feats; rough if the sticker is a build piece.');
    const bad = fits.filter(r => r.tie === 0);
    for (const r of bad)
      F.push(`!! ${r.id} ${r.name} (${r.stkN}): the goal does not match the sticker — ` +
        `${r.stkN} is an ${STKTYPE[r.stk]}-type sticker, the goal counts ${r.k}.`);
    const loose = fits.filter(r => r.tie === 1);
    if (loose.length)
      F.push(`loose fits (the goal only grazes what the sticker does): ` +
        loose.map(r => `${r.id} ${r.name}/${r.stkN}`).join(', ') + '.');
    const unbought = urows.filter(u => u.mm != null && u.am == null);
    if (unbought.length)
      F.push(`${unbought.length} upgrades never get bought (${unbought.map(u => `${u.name} at ${fmtCost(u)}`).join(', ')}): ` +
        `nothing in the income math pays for them. Fine if they are idle/QoL buys; re-price if they are builds.`);
    const waits = urows.filter(u => u.wait > 30);
    if (waits.length)
      F.push(`rows that unlock long before the money arrives: ` +
        waits.map(u => `${u.name} +${u.wait.toFixed(0)}m`).join(', ') +
        `. The sim saves for the best marginal buy, so treat these as upper bounds — but 2h+ is a real dead row.`);
    const held = urows.filter(u => u.hold > 5);
    if (held.length)
      F.push(`rows that hid while the money was already there: ` +
        held.map(u => `${u.name} ${u.hold.toFixed(0)}m`).join(', ') + ' (want: goal lands just before the cash).');
    const boring = urows.filter(u => u.boring);
    if (boring.length)
      F.push(`plain-counter gates (a number that only goes up, no build ask): ` +
        boring.map(u => `${u.id} ${u.name}`).join(', ') + '.');
    const earlySh = [];
    ACH.filter(a => a.meta && (a.lv || 1) === 1).forEach(a => {
      const k = statOf(a), times = metBy[a.id].all, mm = times.length ? minsOf(times) : null;
      if (mm != null && !ENGINE.has(k) && !GATED.has(k) && ascMed != null && mm < ascMed)
        earlySh.push(`${a.n} ${Math.round(ascMed - mm)}m early`);
    });
    if (earlySh.length)
      F.push(`!! shard rows opening BEFORE the first ascend: ${earlySh.join(', ')} — raise those gates.`);
    if (asc2Med != null && ascMed != null)
      F.push(`era 2 runs ${(ascMed / (asc2Med - ascMed)).toFixed(1)}x faster than era 1 (${ascMed.toFixed(0)}m first, ${asc2Med.toFixed(0)}m second): the shard snowball (+${(SHALL_PER * 100).toFixed(0)}%/shard value, META rows, keeper vinyl) at work${ascMed / (asc2Med - ascMed) > 3 ? ' — maybe too well' : ''}.`);
    return F;
  }
  function fmtCost(u) { const oid = u.up; return P.UPG[oid] ? P.UPG[oid][1].toLocaleString() : '?'; }

  /* ---------------- balance.html ---------------- */
  function htmlReport({ rows, late, fits, urows, ascMed, asc2Med, asc3Med, summary, det, WIN }) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const chip = (cls, txt) => `<span class="chip ${cls}">${esc(txt)}</span>`;
    const goalVerdict = r => {
      const [lo, hi] = WIN[r.tier];
      if (r.late) return { c: 'bad', t: `producers only ~${Math.round(r.seed)}m, era ${lo}-${hi}m` };
      if (ENGINE.has(r.k)) return { c: 'warn', t: 'record, sim reads low' };
      if (GATED.has(r.k)) return { c: r.seed != null && r.seed <= hi ? 'ok' : 'warn',
        t: r.seed != null ? `ready ~${Math.round(r.seed)}m (producers)` : 'not modeled, order governs' };
      if (r.mm == null) return { c: 'bad', t: 'never completed, even hunted' };
      if (r.mm < lo) return { c: 'warn', t: `${r.mm.toFixed(1)}m, ahead of ${lo}-${hi}m` };
      if (r.mm > hi) return { c: 'bad', t: `${r.mm.toFixed(1)}m, past ${lo}-${hi}m` };
      return { c: 'ok', t: `${r.mm.toFixed(1)}m, inside ${lo}-${hi}m` };
    };
    const upVerdict = u => {
      if (u.mm == null && u.gated) return { c: 'warn', t: 'show floor' };
      if (u.mm == null && ENGINE.has(u.k)) return { c: 'warn', t: 'record, reads low' };
      if (u.mm == null) return { c: 'bad', t: 'goal never met' };
      if (u.am == null) return { c: 'bad', t: 'never affordable' };
      if (u.hold > 5) return { c: 'bad', t: `HELD ${u.hold.toFixed(0)}m past the cash` };
      if (u.wait > 30) return { c: 'warn', t: `waits ${u.wait.toFixed(0)}m for cash` };
      return { c: 'ok', t: `opens ${u.mm.toFixed(1)}m, cash ${u.am.toFixed(1)}m` };
    };
    const spark = (() => {
      const pts = Object.keys(det.marks).map(Number).sort((a, b) => a - b)
        .map(m => [m / 60, det.marks[m].banked, det.marks[m].era]);
      if (pts.length < 2) return '';
      const mx = pts[pts.length - 1][0], my = Math.max(...pts.map(p => p[1]));
      const asc = pts.some(p => p[2] === 1);
      const pl = pts.map(p => `${(p[0] / mx * 100).toFixed(1)},${(100 - p[1] / my * 96 - 2).toFixed(1)}`).join(' ');
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="spark">
        <polyline points="${pl}" fill="none" stroke="#6FBF8E" stroke-width="1.6"/>
      </svg>
      <div class="sparkcap">banked score per era, first ${Math.round(mx)} min (one hunter run${asc ? ', the drop is the ascend reset' : ''}) — ends at ${fmtK(my)}</div>`;
    })();
    const findingsList = findings({ rows, late, fits, urows, ascMed, asc2Med, summary })
      .map(f => `<li${f.startsWith('!!') ? ' class="alarm"' : ''}>${esc(f.startsWith('!!') ? f.slice(3) : f.replace(/^ok — /, ''))}</li>`).join('');
    const goalRows = [...rows].sort((a, b) => (a.mm == null ? 1e9 : a.mm) - (b.mm == null ? 1e9 : b.mm))
      .map(r => { const v = goalVerdict(r);
        return `<tr><td>${r.id}</td><td><b>${esc(r.name)}</b><span class="sub">${esc(r.desc)}</span></td>
        <td>${esc(r.stkN)} <span class="t t${r.tier}">t${r.tier}</span></td><td>${chip(v.c, v.t)}</td>
        <td class="num">${r.hMed != null ? r.hMed.toFixed(0) + 'm' : '—'}</td>
        <td class="num">${r.aMed != null ? r.aMed.toFixed(0) + 'm' : '—'}</td>
        <td class="num">${r.total}/10</td><td class="num dim">pace${r.pace} tex${r.tex} tie${r.tie}</td></tr>`; }).join('');
    const upRows = urows.map(u => { const v = upVerdict(u);
      return `<tr><td>${u.id}</td><td><b>${esc(u.name)}</b><span class="sub">${esc(u.desc)}</span></td>
      <td>${chip(v.c, v.t)}</td><td>${u.boring ? chip('warn', 'plain counter') : ''}</td></tr>`; }).join('');
    const shardRows = ACH.filter(a => a.meta && (a.lv || 1) === 1).map(a => {
      const k = statOf(a), times = metBy[a.id].all, eng = ENGINE.has(k);
      const mm = times.length ? minsOf(times) : null;
      const early = mm != null && !eng && ascMed != null && mm < ascMed;
      const t = mm == null ? (eng ? 'never here (record reads low)' : !MODELED.has(k) ? 'not modeled (shard-era stand-in)' : 'not reached by the second ascend')
        : (early ? `opens ${mm.toFixed(1)}m — ${Math.round(ascMed - mm)}m TOO EARLY` : `opens ${mm.toFixed(1)}m`);
      return `<tr><td>${a.id}</td><td><b>${esc(a.n)}</b></td><td>${chip(early ? 'bad' : mm == null ? 'warn' : 'ok', t)}</td></tr>`;
    }).join('');
    const fitRows = fits.map(r => `<tr><td>${r.tie === 0 ? chip('bad', 'mismatch') : chip('warn', 'loose')}</td>
      <td><b>${esc(r.name)}</b> (${esc(r.stkN)}, t${r.tier} ${esc(STKTYPE[r.stk] || 'value')})</td>
      <td class="dim">${esc(r.desc)}</td></tr>`).join('');
    const archRows = ARCH_KEYS.map(k => `<tr><td><b>${k}</b></td>
      <td class="num">${ascT[k] == null ? 'never' : (ascT[k] / 60).toFixed(0) + 'm'}</td>
      <td class="num">${asc2T[k] == null ? '—' : (asc2T[k] / 60).toFixed(0) + 'm'}</td></tr>`).join('');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SQUEEZER — balance report</title>
<style>
@font-face{font-family:"Orbit";font-style:normal;font-weight:400;font-display:swap;
  src:url("fonts/orbit-latin.woff2") format("woff2")}
:root{--felt:#12211A;--card:#1A2C23;--ink:#EDE6D4;--dim:#8FA396;--ok:#6FBF8E;--warn:#D9A441;--bad:#D96C5B;--line:#2A4034}
*{box-sizing:border-box}
body{margin:0;background:var(--felt);color:var(--ink);font-family:"Orbit",system-ui,sans-serif;font-size:14px;line-height:1.5}
main{max-width:1060px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:22px;letter-spacing:.06em;margin:0 0 2px}
h2{font-size:15px;letter-spacing:.08em;color:var(--dim);margin:34px 0 10px;text-transform:uppercase}
.note{color:var(--dim);margin:0 0 18px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 16px;min-width:120px}
.stat b{display:block;font-size:20px}
.stat span{color:var(--dim);font-size:12px}
ul.findings{padding-left:18px}
ul.findings li{margin:7px 0}
ul.findings li.alarm{color:var(--bad)}
.spark{width:100%;height:110px;background:var(--card);border:1px solid var(--line);border-radius:10px}
.sparkcap{color:var(--dim);font-size:12px;margin:4px 0 0}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th{ text-align:left;font-size:11px;letter-spacing:.08em;color:var(--dim);padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
.sub{display:block;color:var(--dim);font-size:12px}
.num{text-align:right;white-space:nowrap}
.dim{color:var(--dim);font-size:12px}
.chip{display:inline-block;border-radius:20px;padding:1px 9px;font-size:12px;white-space:normal}
.chip.ok{background:#1E3A2C;color:var(--ok)}
.chip.warn{background:#3A3218;color:var(--warn)}
.chip.bad{background:#3A211D;color:var(--bad)}
.t{border-radius:6px;padding:0 6px;font-size:12px}
.t1{background:#20402A;color:#8FD6A4}.t2{background:#1E3444;color:#82B7E8}.t3{background:#443A1C;color:#E8C469}
.t4{background:#44231F;color:#E88C82}.t5{background:#382644;color:#C99AE8}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 18px}
.box ul{margin:6px 0;padding-left:18px}
footer{color:var(--dim);font-size:12px;margin-top:40px}
</style></head><body><main>
<h1>SQUEEZER · balance report</h1>
<p class="note">player v6 — five archetypes (climber / daredevil / engineer / chainkeeper / hunter),
each with its own risk line, buys and sticker tastes; goal hunts reshape play toward the next gate;
tricks arm on gauge lines (float at 70%, stakes hot, defuse/scrap cut the deck); stickers are bought
as individuals at the game's shelf rules; upgrade rows hide until their u-goals land; the run continues
past the first ascend — shards, META rows, keeper vinyl — through the second and third. ${summary.archN} archetypes × ${summary.n} runs each, medians, seeds (i*7919+13).</p>
<div class="cards">
  <div class="stat"><b>${ascMed == null ? 'never' : ascMed.toFixed(1) + 'm'}</b><span>first ascend</span></div>
  <div class="stat"><b>${asc2Med == null ? 'never' : asc2Med.toFixed(1) + 'm'}</b><span>second ascend</span></div>
  <div class="stat"><b>${asc3Med == null ? 'never' : asc3Med.toFixed(0) + 'm'}</b><span>third ascend</span></div>
  <div class="stat"><b>${summary.sticker == null ? "never" : summary.sticker.toFixed(1) + "m"}</b><span>first sticker</span></div>
  <div class="stat"><b>~${summary.deck}</b><span>cards owned at the horizon</span></div>
  <div class="stat"><b>${summary.placed}</b><span>stickers placed</span></div>
  <div class="stat"><b>~${fmtK(summary.bestBankMed)}</b><span>biggest single bank (all)</span></div>
  <div class="stat"><b>~${fmtK(summary.hunterBankMed)}</b><span>biggest bank (hunter)</span></div>
  <div class="stat"><b>${summary.shards}</b><span>shards earned by era 2</span></div>
</div>
${spark}
<h2>Findings</h2>
<ul class="findings">${findingsList}</ul>
<h2>Archetypes — ascend medians</h2>
<table><tr><th>archetype</th><th class="num">first ascend</th><th class="num">second</th></tr>${archRows}</table>
<h2>Goals — pacing vs era</h2>
<p class="note">Era windows by sticker tier: t1 3-30m · t2 20-90m · t3 30-150m · t4 90-300m · t5 150-1000m.
Pacing reads the HUNTER (a player playing toward the gate); the population column shows the median
of all archetypes. Score /10 = era fit (0-4) + texture (1-3) + tie (0-3).</p>
<table><tr><th>id</th><th>goal</th><th>sticker</th><th>verdict</th><th class="num">hunter</th><th class="num">population</th><th class="num">score</th><th class="num">parts</th></tr>${goalRows}</table>
<h2>Goal-sticker fits</h2>
<table><tr><th>fit</th><th>sticker + goal</th><th>what it asks</th></tr>${fitRows}</table>
<h2>Upgrades — row unlock vs money</h2>
<table><tr><th>id</th><th>upgrade</th><th>verdict</th><th></th></tr>${upRows}</table>
<h2>Shard upgrades — level 1 must open at or after the first ascend${ascMed == null ? '' : ' (~' + ascMed.toFixed(0) + 'm)'}</h2>
<table><tr><th>id</th><th>row</th><th>verdict</th></tr>${shardRows}</table>
<h2>What the sim still cannot see</h2>
<div class="box"><ul>
<li>Chain/streak records (bestChain, bestStreak) still read low: no jackpot stacking, no Iron Nerve timing.</li>
<li>${GATED.size} goal stats stay unmodeled (composition shots like The Works and Balanced Books, twin towns, boomerangs, multi-table play, shiny vinyl): their SU rows open via a shard-era stand-in, printed as such.</li>
<li>One table at a time: aura presence (haste/beacon/surge) is discounted, Split's second hand is payback-modeled only, and sticker seats land on random values — a real player aims Gild at their best card.</li>
<li>No manual micro: tricks arm on gauge lines, not on perfect reads; no exact Float-at-70 timing, no de-bolt, no offline earnings.</li>
<li>Row gates are a cliff here: hot-streak counts step from free to impossible between N and N+1 consecutive banks (the hunter banks wide; real skilled play banks minimal hands with Stakes armed). Readings bracket the truth rather than land in it.</li>
<li>Discards accrue only from Ward saves until Snip stocks (~0.1/min), so any discard-count gate reads one era late; real players also cut with Snip/Echo/Burn they already own.</li>
<li>Medians only: no p10-p90 spread, no session-length variety, 16h horizon stops at the third ascend.</li>
</ul></div>
<footer>generated by <code>node sim.js report</code> · ${new Date().toISOString().slice(0, 10)} · seeds are deterministic, numbers move only when the model or config moves</footer>
</main></body></html>`;
  }
} else {
  bench();
}
