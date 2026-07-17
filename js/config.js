// Game-wide constants, math helpers, the level registry, and shared game state.

const GAME_VERSION = 'v28';   // keep in sync with CACHE in sw.js
const MATCH_TIME = 150;
const PVP_GRACE = 15;             // grace period: no hole-vs-hole eating for first 15 seconds
const GROW = 0.8;
const EAT_RATIO = 1.5;            // must be 1.5x an object's footprint to eat it
const GRAVITY = 110;              // fall acceleration into the hole
const HOLE_DEPTH = 150;           // how deep the visible pit goes
const BOT_NAMES = ['xX_Reaper','mossy','GulpLord','Tina','pixelpete','NovaCat',
  'bigmike','quinn','404notfound','senpai','DustBunny','Vortex'];

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
