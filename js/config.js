// Game-wide constants, math helpers, the level registry, and shared game state.

const MATCH_TIME = 150;
const GROW = 0.8;
const EAT_RATIO = 1.5;            // must be 1.5x an object's footprint to eat it
const GRAVITY = 110;              // fall acceleration into the hole
const HOLE_DEPTH = 150;           // how deep the visible pit goes
const BOT_NAMES = ['xX_Reaper','mossy','GulpLord','Tina','pixelpete','NovaCat',
  'bigmike','quinn','404notfound','senpai','DustBunny','Vortex'];

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
let running = false, paused = false, last = 0;
let dragging = false;
