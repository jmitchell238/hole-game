// Pure game-math core: constants, pure functions, and seeded RNG.
// Works as a classic script tag (globals) AND under Node.js via require().
// NO THREE, NO DOM, NO global state reads — all inputs are parameterized.

// ---- Constants ---------------------------------------------------------------
const SIZE_TIERS = [8, 9, 11, 12, 14, 16, 18, 21, 24, 28, 32, 37, 42, 48, 55, 63, 73, 84, 96, 110];
const GROW = 0.40;
const GROW_FALLOFF = 30;
const EAT_RATIO = 1.5;            // must be 1.5x an object's footprint to eat it
const BATTLE_EVERY = 5;           // battle occurs every 5th level
const MATCH_TIME = 150;
const PVP_GRACE = 15;             // grace period: no hole-vs-hole eating for first 15 seconds

// ---- Pure math helpers -------------------------------------------------------
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const dist = (ax,az,bx,bz) => Math.hypot(ax-bx, az-bz);
const areaOf = r => Math.PI*r*r;

// ---- Level tiers and battle detection ----------------------------------------
function isBattleLevel(n) { return n % BATTLE_EVERY === 0; }

function sizeLevel(r) {
  let lv = 1;
  for (let i = 1; i < SIZE_TIERS.length; i++)
    if (r >= SIZE_TIERS[i]) lv = i + 1;
  return lv;
}

// ---- Pure game formulas ------------------------------------------------------
/** Grow radius by absorbing addArea. Applied before cap in the caller. */
function growRadius(r, addArea, battleMode) {
  addArea *= GROW * GROW_FALLOFF / (GROW_FALLOFF + r);
  if (battleMode) addArea *= Math.max(0.25, 1 - r / 240);
  return Math.sqrt((areaOf(r) + addArea) / Math.PI);
}

/** Max hole radius for a given world size. */
function maxHoleRadiusFor(world) {
  if (!world) return 110;
  return Math.min(world * 0.25, SIZE_TIERS[SIZE_TIERS.length - 1]);
}

/** Check if one hole can eat another. */
function canEatR(holeR, propR) { return holeR >= propR * EAT_RATIO; }

/** Solo level target devour percentage, scaled by campaign level. */
function soloTargetPct(campaignLevel) { return Math.min(50 + 3*(campaignLevel-1), 90); }

/** Reward gold for a solo level win. */
function soloReward(won, playerR) {
  if (won) return Math.max(5, Math.round(playerR/2)) + 20;
  else return Math.max(3, Math.round(playerR/4));
}

/** Reward gold for a battle level. */
function battleReward(eaten, playerR, rank) {
  if (eaten) return Math.max(3, Math.round(playerR/4));
  else return Math.max(5, Math.round(playerR/2)) +
    (rank === 1 ? 25 : rank === 2 ? 15 : rank === 3 ? 10 : 0);
}

/** Check-in date string: YYYY-M-D (not zero-padded). */
function checkinToday(dateObj) {
  return dateObj.getFullYear() + '-' + (dateObj.getMonth()+1) + '-' + dateObj.getDate();
}

// ---- Seeded RNG and rand/pick wiring -----------------------------------------
/** Mulberry32 seeded RNG: returns a () => [0,1) function. */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Current RNG source (default Math.random for unchanged behavior)
let currentRandSource = Math.random;

/** Set the RNG source (e.g., mulberry32(seed)). */
function setRandSource(fn) { currentRandSource = fn; }

/** Random float in [a, b). */
function rand(a,b) { return a + currentRandSource()*(b-a); }

/** Pick random element from array. */
function pick(arr) { return arr[(currentRandSource()*arr.length)|0]; }

// ---- Node.js export guard ---------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SIZE_TIERS, GROW, GROW_FALLOFF, EAT_RATIO, BATTLE_EVERY, MATCH_TIME, PVP_GRACE,
    clamp, dist, areaOf, isBattleLevel, sizeLevel,
    growRadius, maxHoleRadiusFor, canEatR, soloTargetPct, soloReward, battleReward, checkinToday,
    mulberry32, setRandSource, currentRandSource, rand, pick
  };
}
