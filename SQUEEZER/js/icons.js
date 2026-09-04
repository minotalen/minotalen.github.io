/* ==================================================================
   icons.js — the one glyph set for the whole UI. Every icon is an
   inline SVG on the house 24-grid (stroke:currentColor, fill:none,
   width 2, round caps — same as the tab rail), so it inherits ink
   from where it sits and renders identically on every OS: no font
   fallback, no emoji presentation.
   ================================================================== */
const ICONS={
  /* card with a pip — deck talk */
  card:`<rect x="5.5" y="3" width="13" height="18" rx="2.6"/><path d="M5.5 7.7h13"/><path class="fl" d="M12 10.6l2 2.6-2 2.6-2-2.6z"/>`,
  /* speed — haste, the deal quickens */
  zap:`<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>`,
  /* chain link — Iron Nerve */
  link:`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  /* struck circle — purge, the hand leaves the deck */
  ban:`<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>`,
  /* eye — Tell, the top card shows its face */
  eye:`<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
  /* crosshair — a trick armed, fires on its own */
  target:`<circle cx="12" cy="12" r="7"/><path d="M12 2.2v3.6M12 18.2v3.6M2.2 12h3.6M18.2 12h3.6"/><circle class="fl" cx="12" cy="12" r="1.5"/>`,
  plus:`<path d="M12 5v14M5 12h14"/>`,
  clock:`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  /* two stacked planes — another hand, another table */
  stack:`<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13.5 9 5 9-5"/>`,
  /* four-point star — the shop's mark, same spark as the STICKER tab */
  spark:`<path d="M12 3l1.9 7.1L21 12l-7.1 1.9L12 21l-1.9-7.1L3 12l7.1-1.9z"/>`,
  /* triangle warning */
  alert:`<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4.5"/><circle class="fl" cx="12" cy="16.8" r="1.3"/>`,
  /* goal met / goal unmet */
  star:`<path fill="currentColor" d="m12 3.8 2.45 4.95 5.45.8-3.95 3.85.95 5.45L12 16.3l-4.9 2.55.95-5.45-3.95-3.85 5.45-.8z"/>`,
  'star-o':`<path d="m12 3.8 2.45 4.95 5.45.8-3.95 3.85.95 5.45L12 16.3l-4.9 2.55.95-5.45-3.95-3.85 5.45-.8z"/>`,
  /* open padlock — a tab just unlocked */
  unlock:`<rect x="4" y="10.8" width="16" height="9.7" rx="2.4"/><path d="M8 10.8V7a4 4 0 0 1 7.9-.9"/>`,
  /* closed padlock — a tab tapped while still locked */
  lock:`<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>`,
  trash:`<path d="M4 6.5h16"/><path d="M9.5 6.5V4.9a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.6"/><path d="M6.2 6.5 7 19.2a1.8 1.8 0 0 0 1.8 1.6h6.4a1.8 1.8 0 0 0 1.8-1.6l.8-12.7"/><path d="M10 10.5v6M14 10.5v6"/>`,
  x:`<path d="M6 6l12 12M18 6 6 18"/>`,
  check:`<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  /* faceted diamond — shards */
  gem:`<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>`,
  /* filled pointer — draws left on an armed window */
  chev:`<path class="fl" d="M8 5.5v13l11-6.5z"/>`,
  /* open book — the sticker compendium, the roster's reference */
  book:`<path d="M4 19.5V5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M20 18.5H6.5A2.5 2.5 0 0 0 4 21"/>`,
};
/* ic(name) → inline svg sized to the surrounding text (1em) */
const ic=(n,cls)=>`<svg class="gi${cls?' '+cls:''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]||''}</svg>`;
