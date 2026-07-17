// Game-wide constants, math helpers, the level registry, and shared game state.

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Shown in the UI as "VoidRush vMAJOR.MINOR.PPP" (patch zero-padded to 3 digits).
//   major — breaking / generation changes
//   minor — features (levels, systems, big content)
//   patch — bugfixes, perf, polish
// Keep CACHE in sw.js in sync: 'voidrush-' + GAME_VERSION
// Old monochrome labels (v27…v32) map here as 2.MINOR.PATCH (this gen is major 2).
const GAME_VERSION = '2.39.001';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const MATCH_TIME = 150;
const PVP_GRACE = 15;             // grace period: no hole-vs-hole eating for first 15 seconds
const GROW = 0.8;
const EAT_RATIO = 1.5;            // must be 1.5x an object's footprint to eat it
const GRAVITY = 110;              // fall acceleration into the hole
const HOLE_DEPTH = 150;           // how deep the visible pit goes
const BOT_NAMES = ['xX_Reaper','mossy','GulpLord','Tina','pixelpete','NovaCat',
  'bigmike','quinn','404notfound','senpai','DustBunny','Vortex'];

// ---- Device / graphics quality ----------------------------------------------
// Target tablet: 1st-gen iPad Pro 12.9" (2015, A9X) — large Retina panel + weak GPU.
// iPadOS PWAs often report as desktop Safari; touch points catch those.
const IS_TOUCH = ('ontouchstart' in window) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) ||
  /iPad|iPhone|iPod|Android/i.test(navigator.userAgent || '');
// Large tablet class (12.9" is 1024×1366 CSS points). Always treat touch tablets
// as the A9X-class profile so the game stays playable on gen-1 Pro hardware.
const IS_LARGE_TABLET = IS_TOUCH &&
  Math.max(screen.width || 0, screen.height || 0) >= 1000;
const IS_LOW_END = IS_TOUCH; // gen-1 iPad Pro is the floor we optimize for

// Clutter types we can thin on tablet without breaking “feels like a city”
const CLUTTER_PROPS = {
  person: 1, dog: 1, bush: 1, mailbox: 1, trashcan: 1, cone: 1, hydrant: 1,
  bench: 1, fence: 1, stest_person: 1, stest_light: 1,
};

const GFX = {
  mobile: IS_TOUCH,
  lowEnd: IS_LOW_END,
  largeTablet: IS_LARGE_TABLET,
  // Never 2× retina — 12.9" @2x is ~5.6M pixels; Minecraft native ≠ Safari WebGL
  pixelRatio: 1,
  // Internal draw buffer scale (CSS still full-screen). A9X fill-rate budget.
  renderScale: IS_LOW_END ? 0.40 : 1,
  antialias: false,
  shadowMapSize: 256,
  softShadows: false,
  groundCurve: 8,
  maxTexSize: IS_LOW_END ? 512 : 2048,
  anisotropy: 1,
  propSeg: IS_LOW_END ? 4 : 8,
  useGltf: false,
  mergeProps: !IS_LOW_END, // skip merge pass on tablet (CPU cost at load)
  streamProps: false,      // Three.js frustum cull is enough; add/remove was thrash
  // Keep this fraction of clutter props on tablet (0.25 = drop 75% of people/etc.)
  clutterKeep: IS_LOW_END ? 0.28 : 1,
  // HUD DOM writes at this Hz
  hudHz: IS_LOW_END ? 8 : 20,
};

const BATTLE_EVERY = 5;           // battle occurs every 5th level
function isBattleLevel(n) { return n % BATTLE_EVERY === 0; }

const SIZE_TIERS = [12, 16, 21, 27, 35, 45, 58, 75, 95, 120];
function sizeLevel(r) {
  let lv = 1;
  for (let i = 1; i < SIZE_TIERS.length; i++)
    if (r >= SIZE_TIERS[i]) lv = i + 1;
  return lv;
}

const rand = (a,b) => a + Math.random()*(b-a);
const pick = arr => arr[(Math.random()*arr.length)|0];
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const dist = (ax,az,bx,bz) => Math.hypot(ax-bx, az-bz);
const areaOf = r => Math.PI*r*r;

// ---- Level registry ---------------------------------------------------------
// Each file in js/levels/ describes one themed map and calls registerLevel().
// See js/levels/city.js for the full shape a level must provide.
const LEVELS = {};
function registerLevel(level) { LEVELS[level.id] = level; }

// ---- Shared game state ------------------------------------------------------
let objects = [], holes = [], player = null;
let currentLevel = null;
let timeLeft = 0, levelTotal = 0;
let matchTime = 0;                // total match duration (set for smoke tests; calculated as MATCH_TIME in normal play)
let running = false, paused = false, last = 0;
let dragging = false;
let battleMode = false;           // true if this is a bot battle level
let targetPct = 50;               // solo win condition: % of props to devour
let soloWon = false;              // tracks if solo level was won (devoured target %)
