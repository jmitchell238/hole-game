// Persistent player progress: gold, owned cosmetics, equipped picks, the daily
// check-in, and settings. Stored in localStorage so it survives between visits
// (and works offline in the installed PWA).

const SAVE_KEY = 'holeRoyale.save.v1';
let SAVE = {
  gold: 0,
  owned: ['emerald'],        // cosmetic ids the player has bought
  color: 'emerald',          // equipped hole color
  design: null,              // equipped hole design (null = plain hole)
  lastCheckin: '',           // YYYY-M-D of the last daily check-in claim
  shadows: true,
  controls: 'touch',         // 'touch' or 'keyboard'
};
try {
  const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (stored && typeof stored === 'object') Object.assign(SAVE, stored);
} catch (_) { /* corrupted or unavailable storage — start fresh */ }

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (_) {}
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function ownsCosmetic(id) { return SAVE.owned.includes(id); }
