// Pure game-math core: constants, pure functions, and seeded RNG.
// Works as a classic script tag (globals) AND under Node.js via require().
// NO THREE, NO DOM, NO global state reads — all inputs are parameterized.

// ---- Constants ---------------------------------------------------------------
const SIZE_TIERS = [8, 9, 11, 12, 14, 16, 18, 21, 24, 28, 32, 37, 42, 48, 55, 63, 73, 84, 96, 110];
const GROW = 0.40;
const GROW_FALLOFF = 30;
const EAT_RATIO = 1.0;            // must be 1.0x an object's footprint to eat it
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

/** Physical radius target for stepped growth: tier value clamped by cap. */
function tierRadiusFor(trueR, cap) {
  const lv = sizeLevel(trueR);
  const tierTarget = SIZE_TIERS[lv - 1];
  return cap ? Math.min(tierTarget, cap) : tierTarget;
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

// ---- Spatial hash grid -------------------------------------------------------
/** Uniform spatial hash grid for broad-phase collision queries. */
function makeGrid(cellSize) {
  const grid = new Map();  // Map<string, array of objects>
  const _cellSize = cellSize;

  function getCellKey(x, z) {
    const cx = Math.floor(x / _cellSize);
    const cz = Math.floor(z / _cellSize);
    return `${cx}:${cz}`;
  }

  function insert(obj, x, z) {
    const key = getCellKey(x, z);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(obj);
    obj._gridKey = key;
  }

  function remove(obj) {
    const key = obj._gridKey;
    if (!key) return;
    const cell = grid.get(key);
    if (cell) {
      const idx = cell.indexOf(obj);
      if (idx !== -1) cell.splice(idx, 1);
      if (cell.length === 0) grid.delete(key);
    }
    obj._gridKey = undefined;
  }

  function queryCircle(cx, cz, r, out) {
    if (!out) out = [];
    const cellMin = Math.floor((cx - r) / _cellSize);
    const cellMax = Math.floor((cx + r) / _cellSize);
    const cellMinZ = Math.floor((cz - r) / _cellSize);
    const cellMaxZ = Math.floor((cz + r) / _cellSize);
    const r2 = r * r;

    for (let gx = cellMin; gx <= cellMax; gx++) {
      for (let gz = cellMinZ; gz <= cellMaxZ; gz++) {
        const key = `${gx}:${gz}`;
        const cell = grid.get(key);
        if (!cell) continue;
        for (const obj of cell) {
          const dx = obj.x - cx, dz = obj.z - cz;
          if (dx * dx + dz * dz <= r2) out.push(obj);
        }
      }
    }
    return out;
  }

  function queryRect(minX, maxX, minZ, maxZ, out) {
    if (!out) out = [];
    const cellMinX = Math.floor(minX / _cellSize);
    const cellMaxX = Math.floor(maxX / _cellSize);
    const cellMinZ = Math.floor(minZ / _cellSize);
    const cellMaxZ = Math.floor(maxZ / _cellSize);

    for (let gx = cellMinX; gx <= cellMaxX; gx++) {
      for (let gz = cellMinZ; gz <= cellMaxZ; gz++) {
        const key = `${gx}:${gz}`;
        const cell = grid.get(key);
        if (!cell) continue;
        for (const obj of cell) {
          if (obj.x >= minX && obj.x <= maxX && obj.z >= minZ && obj.z <= maxZ) {
            out.push(obj);
          }
        }
      }
    }
    return out;
  }

  function clear() {
    grid.clear();
  }

  function cellCount() {
    return grid.size;
  }

  function totalObjects() {
    let count = 0;
    for (const cell of grid.values()) count += cell.length;
    return count;
  }

  return {
    insert, remove, queryCircle, queryRect, clear,
    cellCount, totalObjects, _grid: grid  // expose grid for testing
  };
}

// ---- Node.js export guard ---------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SIZE_TIERS, GROW, GROW_FALLOFF, EAT_RATIO, BATTLE_EVERY, MATCH_TIME, PVP_GRACE,
    clamp, dist, areaOf, isBattleLevel, sizeLevel,
    growRadius, maxHoleRadiusFor, tierRadiusFor, canEatR, soloTargetPct, soloReward, battleReward, checkinToday,
    mulberry32, setRandSource, currentRandSource, rand, pick,
    makeGrid
  };
}
