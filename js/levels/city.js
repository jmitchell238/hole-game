// The City level. Every match rolls a brand-new map: grid size, block size,
// road width, district layout, and spawn points are all generated fresh.
//
// ---- HOW TO ADD A NEW LEVEL (desert, medieval, winter, dinosaur, island…) ----
// 1. Copy this file to js/levels/<name>.js and add a <script> tag for it in
//    hole3d.html (order doesn't matter as long as it's after props.js).
// 2. Keep everything inside the IIFE so your layout constants don't clash
//    with other levels'.
// 3. Register any theme-only props with registerProp('cactus', {r,h}, builderFn,
//    castsShadow) — the shared library in js/props.js (person, tree, car, …)
//    is available to every level.
// 4. Call registerLevel({...}) with:
//      id / name        – key + label shown on the level-select buttons
//      sky, fog, hemi, sunColor – atmosphere (fog: [near, far],
//                         hemi: [skyColor, groundColor, intensity])
//      soil             – [rimColor, deepColor] for the pit walls
//      progressLabel    – HUD text, e.g. 'Desert devoured'
//      generate()       – called at the start of every match: roll the random
//                         layout, then set this.world (half-width of the map),
//                         this.playerSpawn ([x,z]), and this.botSpawns
//                         (array of [x,z] for the 7 bots)
//      createGroundTexture() – draw the generated map's ground THREE texture
//      populate(addProp)     – place every prop on the generated map
// The level select menu picks up the new level automatically.
// -------------------------------------------------------------------------------
(function () {

// Rolled fresh by generate() at the start of every match.
let GRID_N, BLOCK, ROAD, P, WORLD;
let blockPlan = [];
let spawnI, spawnJ;             // which block the player spawns in (a park)

const blockOrigin = (i, j) => [ -WORLD + ROAD + i*P, -WORLD + ROAD + j*P ];

// District plan: one downtown cluster (two on big maps) seeded at random,
// parks scattered through the rest, suburbs everywhere else. The player's
// spawn block is always a park, somewhere near the middle.
function planCity() {
  const midIdx = n => (n % 2) ? (n-1)/2 : n/2 - (Math.random() < 0.5 ? 1 : 0);
  spawnI = midIdx(GRID_N);
  spawnJ = midIdx(GRID_N);

  const seedCount = (GRID_N >= 6 || Math.random() < 0.4) ? 2 : 1;
  const seeds = [];
  while (seeds.length < seedCount) {
    const si = (Math.random()*GRID_N)|0, sj = (Math.random()*GRID_N)|0;
    if (si === spawnI && sj === spawnJ) continue;
    seeds.push([si, sj]);
  }

  blockPlan = [];
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === spawnI && j === spawnJ) { blockPlan[i][j] = 'park'; continue; }
      const nearSeed = seeds.some(([si, sj]) =>
        Math.max(Math.abs(i-si), Math.abs(j-sj)) <= 1);
      blockPlan[i][j] = nearSeed
        ? (Math.random() < 0.85 ? 'downtown' : 'park')
        : (Math.random() < 0.2 ? 'park' : 'residential');
    }
  }
}

// Bots start on random intersections, none right on top of the player.
function pickBotSpawns(px, pz) {
  const pts = [];
  for (let k = 0; k <= GRID_N; k++) for (let l = 0; l <= GRID_N; l++) {
    const x = -WORLD + k*P + ROAD/2, z = -WORLD + l*P + ROAD/2;
    if (dist(x, z, px, pz) < P*1.2) continue;
    pts.push([x, z]);
  }
  pts.sort(() => Math.random() - 0.5);
  return pts.slice(0, 7);
}

function generate() {
  GRID_N = 4 + ((Math.random()*3)|0);            // 4–6 blocks per side
  BLOCK  = Math.round(rand(215, 265));
  ROAD   = Math.round(rand(42, 62));
  P      = BLOCK + ROAD;
  WORLD  = (GRID_N * P + ROAD) / 2;
  planCity();
  this.world = WORLD;
  const [x0, z0] = blockOrigin(spawnI, spawnJ);
  this.playerSpawn = [x0 + BLOCK/2, z0 + BLOCK/2];
  this.botSpawns = pickBotSpawns(this.playerSpawn[0], this.playerSpawn[1]);
}

// The city ground: streets, lane dashes, crosswalks, sidewalks, lawns, plazas.
function cityGroundTexture() {
  const S = 4096;
  return canvasTex(S, S, g => {
    const sc = S / (2*WORLD);
    const X = w => (w + WORLD) * sc;
    g.fillStyle = '#4b5058'; g.fillRect(0, 0, S, S);            // asphalt
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const [x0, z0] = blockOrigin(i, j), type = blockPlan[i][j];
      g.fillStyle = '#b5bac0';                                   // sidewalk
      g.fillRect(X(x0), X(z0), BLOCK*sc, BLOCK*sc);
      g.strokeStyle = '#a3a8ae'; g.lineWidth = 1.5;              // tile joints
      g.beginPath();
      for (let t = 0; t <= BLOCK; t += 16) {
        g.moveTo(X(x0+t), X(z0)); g.lineTo(X(x0+t), X(z0+BLOCK));
        g.moveTo(X(x0), X(z0+t)); g.lineTo(X(x0+BLOCK), X(z0+t));
      }
      g.stroke();
      const SW = 16;
      g.fillStyle = type === 'downtown' ? '#a4aab1'
                  : type === 'park'     ? '#6abf5e' : '#79c46b';
      g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
    }
    // Lane dashes.
    g.strokeStyle = '#e8d44d'; g.lineWidth = Math.max(2, 2.2*sc);
    g.setLineDash([16*sc, 13*sc]);
    g.beginPath();
    for (let k = 0; k <= GRID_N; k++) {
      const rc = X(-WORLD + k*P + ROAD/2);
      g.moveTo(0, rc); g.lineTo(S, rc);
      g.moveTo(rc, 0); g.lineTo(rc, S);
    }
    g.stroke();
    g.setLineDash([]);
    // Crosswalk stripes at every intersection.
    g.fillStyle = '#dfe3e6';
    for (let k = 0; k <= GRID_N; k++) for (let l = 0; l <= GRID_N; l++) {
      const ix = -WORLD + k*P + ROAD/2, iz = -WORLD + l*P + ROAD/2;
      for (const s of [-1, 1]) {
        for (let m = -2; m <= 2; m++) {
          g.fillRect(X(ix + s*(ROAD/2+4)), X(iz + m*9 - 3), 9*sc, 6*sc);
          g.fillRect(X(ix + m*9 - 3), X(iz + s*(ROAD/2+4)), 6*sc, 9*sc);
        }
      }
    }
  });
}

function populate(addProp) {
  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const [x0, z0] = blockOrigin(i, j);
    const cx = x0 + BLOCK/2, cz = z0 + BLOCK/2;
    const type = blockPlan[i][j];
    const inBlock = (dx, dz) => [cx + dx, cz + dz];

    // Every block: streetlights on corners + mid-edges, sidewalk life.
    for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
      addProp('streetlight', cx + sx*(BLOCK/2 - 8), cz + sz*(BLOCK/2 - 8),
        Math.atan2(-sz, -sx));
    addProp('streetlight', cx, cz - (BLOCK/2 - 8), Math.PI/2);
    addProp('streetlight', cx, cz + (BLOCK/2 - 8), -Math.PI/2);
    addProp('trashcan', cx + rand(-90, 90), cz - (BLOCK/2 - 8));
    addProp('trashcan', cx + (BLOCK/2 - 8), cz + rand(-90, 90));
    for (let k = 0; k < 4; k++) {
      const edge = Math.random() < 0.5 ? -1 : 1;
      if (Math.random() < 0.5)
        addProp('person', cx + rand(-100, 100), cz + edge*(BLOCK/2 - 8));
      else
        addProp('person', cx + edge*(BLOCK/2 - 8), cz + rand(-100, 100));
    }

    if (type === 'downtown') {
      addProp('tower', cx, cz, 0);
      addProp('apartment', ...inBlock(-80, 80));
      addProp('shop', ...inBlock(-80, -80));
      addProp('shop', ...inBlock(80, -80), Math.PI/2);
      addProp('shop', ...inBlock(80, 80), Math.PI);
      for (let k = 0; k < 9; k++)
        addProp('person', ...inBlock(rand(-40, 100),
          (Math.random() < 0.5 ? -1 : 1) * rand(70, 100)));
      addProp('hydrant', ...inBlock(-100, 0));
      addProp('hydrant', ...inBlock(100, 30));
      addProp('bench', ...inBlock(-30, 40), Math.PI);
      addProp('bench', ...inBlock(30, 40), Math.PI);
      addProp('cone', ...inBlock(rand(-90, 90), rand(-90, 90)));
      addProp('cone', ...inBlock(rand(-90, 90), rand(-90, 90)));
      addProp('trashcan', ...inBlock(rand(-90, 90), rand(-90, 90)));
    } else if (type === 'residential') {
      // Six buildings in two street-facing rows with fenced front yards;
      // some blocks swap the middle lots for an apartment and a corner shop.
      for (const [hx, hz] of [[-66,-58],[66,-58],[-66,58],[66,58]])
        addProp('house', cx + hx + rand(-4, 4), cz + hz + rand(-4, 4),
          hz < 0 ? Math.PI : 0);
      if (Math.random() < 0.4) {
        addProp('apartment', cx, cz - 58, Math.PI);
        addProp('shop', cx, cz + 58, 0);
      } else {
        addProp('house', cx + rand(-4, 4), cz - 58, Math.PI);
        addProp('house', cx + rand(-4, 4), cz + 58, 0);
      }
      for (const fx of [-84, -58, -30, 30, 58, 84]) addProp('fence', cx + fx, cz, 0);
      addProp('tree', ...inBlock(-96, 0));
      addProp('tree', ...inBlock(96, 0));
      addProp('tree', ...inBlock(-33, 0));
      addProp('tree', ...inBlock(33, 0));
      for (let k = 0; k < 7; k++)
        addProp('bush', ...inBlock(rand(-95, 95), pick([-1,1])*rand(0, 30)));
      addProp('hydrant', ...inBlock(rand(-90, 90), 100));
      for (let k = 0; k < 6; k++)
        addProp('person', ...inBlock(rand(-95, 95), rand(-95, 95)));
    } else {  // park — the spawn block stays clear for the player
      const isSpawn = (i === spawnI && j === spawnJ);
      if (!isSpawn) addProp('fountain', cx, cz, 0);
      for (const f of [-55, 55]) {
        addProp('fence', cx + f, cz - 88, 0);
        addProp('fence', cx + f, cz + 88, 0);
        addProp('fence', cx - 88, cz + f, Math.PI/2);
        addProp('fence', cx + 88, cz + f, Math.PI/2);
      }
      for (let k = 0; k < 11; k++) {
        const dx = rand(-78, 78), dz = rand(-78, 78);
        if (isSpawn && Math.hypot(dx, dz) < 55) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 26) continue;
        addProp('tree', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 8; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        addProp('bush', ...inBlock(dx, dz));
      }
      addProp('bench', ...inBlock(rand(-60, 60), -75), 0);
      addProp('bench', ...inBlock(rand(-60, 60), 75), Math.PI);
      addProp('bench', ...inBlock(-75, rand(-50, 50)), Math.PI/2);
      addProp('bench', ...inBlock(75, rand(-50, 50)), -Math.PI/2);
      for (let k = 0; k < 10; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        addProp('person', ...inBlock(dx, dz));
      }
    }

    // Cars parallel-parked along this block's curbs.
    for (let k = 0; k < 3; k++) {
      const side = (Math.random()*4)|0, off = BLOCK/2 + 9, along = rand(-95, 95);
      if (side === 0)      addProp('car', cx + along, cz - off, 0);
      else if (side === 1) addProp('car', cx + along, cz + off, 0);
      else if (side === 2) addProp('car', cx - off, cz + along, Math.PI/2);
      else                 addProp('car', cx + off, cz + along, Math.PI/2);
    }
  }

  // Traffic on the streets themselves.
  for (let k = 0; k <= GRID_N; k++) {
    const rc = -WORLD + k*P + ROAD/2;
    for (let n = 0; n < 8; n++) {
      const along = rand(-WORLD + 60, WORLD - 60);
      const lane = (Math.random() < 0.5 ? -1 : 1) * 12;
      const bus = Math.random() < 0.15;
      if (Math.random() < 0.5) addProp(bus ? 'bus' : 'car', along, rc + lane, 0);
      else                     addProp(bus ? 'bus' : 'car', rc + lane, along, Math.PI/2);
    }
    if (k < GRID_N) addProp('cone', rand(-WORLD+60, WORLD-60), rc, 0);
  }
}

registerLevel({
  id: 'city',
  name: 'City',
  sky: 0xa8d8f0,
  fog: [650, 1900],
  hemi: [0xcfe8ff, 0x7a9a6a, 0.85],
  sunColor: 0xfff2d8,
  soil: ['#4a4038', '#241f1a'],
  progressLabel: 'City devoured',
  // world, playerSpawn, and botSpawns are rolled by generate() every match.
  generate,
  createGroundTexture: cityGroundTexture,
  populate,
});

})();
