// Game-wide constants, math helpers, the level registry, and shared game state.

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Shown in the UI as "VoidRush vMAJOR.MINOR.PPP" (patch zero-padded to 3 digits).
//   major — breaking / generation changes
//   minor — features (levels, systems, big content)
//   patch — bugfixes, perf, polish
// Keep CACHE in sw.js in sync: 'voidrush-' + GAME_VERSION
// Old monochrome labels (v27…v32) map here as 2.MINOR.PATCH (this gen is major 2).
const GAME_VERSION = '2.43.011';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GRAVITY = 110;              // fall acceleration into the hole
const HOLE_DEPTH = 150;           // how deep the visible pit goes
const BOT_NAMES = ['xX_Reaper','mossy','GulpLord','Tina','pixelpete','NovaCat',
  'bigmike','quinn','404notfound','senpai','DustBunny','Vortex'];

// ---- Device / graphics quality ----------------------------------------------
// IMPORTANT: do NOT treat every phone as a 2015 iPad Pro.
//   • iPhone 14 Pro Max  → high quality (sharp retina, full detail)
//   • gen-1 iPad Pro     → performance mode (A9X + huge panel)
// iPadOS desktop UA: Macintosh + maxTouchPoints > 1
const _UA = navigator.userAgent || '';
const IS_TOUCH = ('ontouchstart' in window) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) ||
  /iPad|iPhone|iPod|Android/i.test(_UA);
const IS_IPHONE = /iPhone/i.test(_UA);
const IS_IPAD = IS_TOUCH && !IS_IPHONE && (
  /iPad/i.test(_UA) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  (Math.max(screen.width || 0, screen.height || 0) >= 1024 &&
    navigator.maxTouchPoints > 1)
);
const IS_LARGE_TABLET = IS_IPAD &&
  Math.max(screen.width || 0, screen.height || 0) >= 1000;

// Quality tier: 'high' (default for everyone) or 'perf'.
// Resolved from the save (config loads before save.js, so read localStorage directly).
// 'auto' (default) uses the persisted measured tier from the FPS auto-tuner.
let _storedSave = null;
try { _storedSave = JSON.parse(localStorage.getItem('holeRoyale.save.v1')); } catch (_) {}
const _gfxPref = (_storedSave && _storedSave.gfxQuality) || 'auto';
const QUALITY_TIER =
  _gfxPref === 'perf' ? 'perf' :
  _gfxPref === 'high' ? 'high' :
  (_storedSave && _storedSave.measuredTier === 'perf') ? 'perf' : 'high';
const IS_LOW_END = QUALITY_TIER === 'perf';

// Props safe to thin on iPad (buildings/landmarks kept). Winter was drowning
// the GPU with snowpines/gifts/people as the camera zoomed out.
const CLUTTER_PROPS = {
  person: 1, dog: 1, bush: 1, mailbox: 1, trashcan: 1, cone: 1, hydrant: 1,
  bench: 1, fence: 1, streetlight: 1, car: 1, bus: 1, tree: 1,
  snowpine: 1, snowman: 1, giftbox: 1, sled: 1,
  stest_person: 1, stest_light: 1, stest_car: 1, stest_tree: 1,
};

const _DPR = window.devicePixelRatio || 1;

// Three visual profiles: desktop / modern phone / old iPad
const GFX = {
  tier: QUALITY_TIER,
  mobile: IS_TOUCH,
  lowEnd: IS_LOW_END,
  isIPhone: IS_IPHONE,
  isIPad: IS_IPAD,
  largeTablet: IS_LARGE_TABLET,
  // iPhone 14 Pro Max is ~3× DPR — use up to 2× so it stays crisp, not trashy.
  // Old iPad: 1× only (2× on 12.9" destroys fill-rate).
  pixelRatio: IS_LOW_END ? 1 : Math.min(2, _DPR),
  // Never downscale the framebuffer on phones/desktop — that was the pixelation.
  renderScale: IS_LOW_END ? 0.45 : 1,
  antialias: !IS_TOUCH,
  shadowMapSize: IS_LOW_END ? 256 : 1024,
  softShadows: !IS_TOUCH,
  groundCurve: IS_LOW_END ? 8 : 16,
  maxTexSize: IS_LOW_END ? 512 : (IS_IPHONE ? 2048 : 4096),
  anisotropy: IS_LOW_END ? 1 : 4,
  propSeg: IS_LOW_END ? 4 : 8,
  useGltf: !IS_TOUCH && !IS_IPHONE, // desktop can use GLTF; phones/tablets procedural
  mergeProps: true,
  // Stream when map is dense so zoomed-out late game isn't "draw everything"
  streamProps: IS_TOUCH,
  // denser maps still thin clutter; parks/sidewalks also hard-cut in levels
  clutterKeep: IS_LOW_END ? 0.12 : 1,
  hudHz: IS_LOW_END ? 8 : 30,
  // Hole ~28-32% of screen height at all sizes (distance ∝ r).
  // 7.3/6.2 made late-game a postage-stamp map floating in empty sky —
  // buildings became sub-pixel dots and the city looked barren.
  camHeightMul: IS_LOW_END ? 4.6 : 4.9,
  camDepthMul: IS_LOW_END ? 3.9 : 4.15,
  camHeightCap: 99999,
  camDepthCap: 99999,
  // label for FPS chip
  qualityLabel: QUALITY_TIER === 'perf' ? 'perf' : (IS_IPHONE ? 'iphone' : (IS_IPAD ? 'ipad' : (IS_TOUCH ? 'mobile' : 'desktop'))),
};


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
let levelTotalArea = 0, devouredArea = 0, winDelay = 0;
