// Persistent player progress: gold, owned cosmetics, equipped picks, the daily
// check-in, and settings. Stored in localStorage so it survives between visits
// (and works offline in the installed PWA).

const SAVE_KEY = 'holeRoyale.save.v1';
// Detect touch early (config.js GFX may not be loaded yet when this runs —
// save.js loads before config in index? Check order: config then save.)
// index.html order: config.js → … → save.js, so GFX exists.
const _defaultShadows = (typeof GFX !== 'undefined' && GFX.mobile) ? false : true;
let SAVE = {
  gold: 0,
  owned: ['emerald'],        // cosmetic ids the player has bought
  color: 'emerald',          // equipped hole color
  design: null,              // equipped hole design (null = plain hole)
  lastCheckin: '',           // YYYY-M-D of the last daily check-in claim
  shadows: _defaultShadows,  // off by default on iPad/phone (huge FPS win)
  controls: 'touch',         // 'touch' or 'keyboard'
  debug: false,
  campaignLevel: 1,          // current campaign level (1+)
  // One-shot: migrate old saves that had shadows forced on for tablets
  _shadowsMigratedV30: false,
};
try {
  const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (stored && typeof stored === 'object') Object.assign(SAVE, stored);
} catch (_) { /* corrupted or unavailable storage — start fresh */ }

// v30: if this is a tablet/phone and the user never re-toggled shadows after
// the performance fix, default them off once (keeps desktop preference).
if (typeof GFX !== 'undefined' && GFX.mobile && !SAVE._shadowsMigratedV30) {
  SAVE.shadows = false;
  SAVE._shadowsMigratedV30 = true;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (_) {}
}

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (_) {}
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function ownsCosmetic(id) { return SAVE.owned.includes(id); }
