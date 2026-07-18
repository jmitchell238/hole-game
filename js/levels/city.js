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
let blockFlavors = [];          // texture flavor per block (parking, plaza, lawn-shade)
let coreBlocks = new Set();     // blocks flagged as city-center core
let spawnI, spawnJ;             // which block the player spawns in (a park)
let skyrisesPlaced = 0;         // track skyrise count for smoke test
let tallestProp = 0;            // track tallest prop for smoke test

const blockOrigin = (i, j) => [ -WORLD + ROAD + i*P, -WORLD + ROAD + j*P ];

// Register skyrise props (tall buildings for city-center core district)
function registerSkyrisesProps() {
  registerProp('skyrise', { r: 16, h: 110 }, function() {
    const g = new THREE.Group();
    const colors = [0x5d6a75, 0x6b7a85, 0x4d5a65];
    const wall = new THREE.MeshLambertMaterial({ map: towerWall() });
    // Main tower body with setbacks
    const baseH = 50;
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(32, baseH, 32),
      [wall, wall, new THREE.MeshLambertMaterial({color: 0x6b7680}),
       new THREE.MeshLambertMaterial({color: 0x6b7680}), wall, wall]);
    box1.position.y = baseH/2; g.add(box1);

    const midH = 40;
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(26, midH, 26),
      [wall, wall, new THREE.MeshLambertMaterial({color: 0x6b7680}),
       new THREE.MeshLambertMaterial({color: 0x6b7680}), wall, wall]);
    box2.position.y = baseH + midH/2; g.add(box2);

    const topH = 18;
    const box3 = new THREE.Mesh(new THREE.BoxGeometry(18, topH, 18),
      [wall, wall, new THREE.MeshLambertMaterial({color: 0x6b7680}),
       new THREE.MeshLambertMaterial({color: 0x6b7680}), wall, wall]);
    box3.position.y = baseH + midH + topH/2; g.add(box3);

    // Rooftop antenna
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 8),
      new THREE.MeshLambertMaterial({color: 0x3a4048})).translateY(baseH + midH + topH + 1.5));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 8, 6),
      new THREE.MeshLambertMaterial({color: 0xc0c0c0})).translateY(baseH + midH + topH + 5));

    return g;
  }, true);

  registerProp('skyrise2', { r: 14, h: 88 }, function() {
    const g = new THREE.Group();
    const wall = new THREE.MeshLambertMaterial({ map: towerWall() });
    // Alternative silhouette: more tapered
    const baseH = 45;
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(28, baseH, 28),
      [wall, wall, new THREE.MeshLambertMaterial({color: 0x5a6a75}),
       new THREE.MeshLambertMaterial({color: 0x5a6a75}), wall, wall]);
    box1.position.y = baseH/2; g.add(box1);

    const midH = 28;
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(20, midH, 20),
      [wall, wall, new THREE.MeshLambertMaterial({color: 0x5a6a75}),
       new THREE.MeshLambertMaterial({color: 0x5a6a75}), wall, wall]);
    box2.position.y = baseH + midH/2; g.add(box2);

    const topH = 12;
    const box3 = new THREE.Mesh(new THREE.BoxGeometry(12, topH, 12),
      [wall, wall, new THREE.MeshLambertMaterial({color: 0x5a6a75}),
       new THREE.MeshLambertMaterial({color: 0x5a6a75}), wall, wall]);
    box3.position.y = baseH + midH + topH/2; g.add(box3);

    // Rooftop detail
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.5, 8),
      new THREE.MeshLambertMaterial({color: 0x3a4048})).translateY(baseH + midH + topH + 1.25));

    return g;
  }, true);
}
registerSkyrisesProps();

// Helper to build a stack of slices at the same x,z with increasing y
function stackSlices(wrappedAddProp, name, x, z, rotY, sliceCount, isRoof) {
  const stackId = 'stk' + Math.random().toString(36).substr(2, 9);
  const sliceHeight = name.includes('tower') ? 16 : 13;
  for (let i = 0; i < sliceCount; i++) {
    const sliceName = (i === sliceCount - 1 && isRoof) ?
      (name.includes('tower') ? 'towerSliceRoof' : 'aptSliceRoof') :
      (name.includes('tower') ? 'towerSlice' : 'aptSlice');
    wrappedAddProp(sliceName, x, z, rotY, { y: i * sliceHeight, stackId });
  }
}

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

  // Promote the first seed (or only seed) to core district
  const coreSeed = seeds[0];

  blockPlan = [];
  blockFlavors = [];
  coreBlocks.clear();
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    blockFlavors[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === spawnI && j === spawnJ) { blockPlan[i][j] = 'park'; continue; }
      const nearSeed = seeds.some(([si, sj]) =>
        Math.max(Math.abs(i-si), Math.abs(j-sj)) <= 1);

      if (nearSeed) {
        blockPlan[i][j] = (Math.random() < 0.85 ? 'downtown' : 'park');
        // Mark core district blocks (2-4 blocks around first seed)
        const distToCore = Math.max(Math.abs(i-coreSeed[0]), Math.abs(j-coreSeed[1]));
        if (distToCore <= 1 && Math.random() < 0.8) {
          coreBlocks.add(`${i},${j}`);
          blockFlavors[i][j] = 'plaza';  // plaza paving in core
        } else {
          blockFlavors[i][j] = Math.random() < 0.5 ? 'parking' : 'lawn-a';
        }
      } else {
        blockPlan[i][j] = (Math.random() < 0.2 ? 'park' : 'residential');
        // Residential and park blocks get varied lawn tints
        const lawnShades = ['lawn-a', 'lawn-b', 'lawn-c'];
        blockFlavors[i][j] = pick(lawnShades);
      }
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
  GRID_N = 5 + ((Math.random()*2)|0);            // 5–6 blocks per side
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
      const flavor = blockFlavors[i] && blockFlavors[i][j];
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

      // Per-block texture flavor
      if (flavor === 'plaza') {
        // Light plaza paving with subtle grid
        g.fillStyle = '#d4d8dc';
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
        g.strokeStyle = '#a8b0ba'; g.lineWidth = 1;
        for (let t = SW; t <= BLOCK-SW; t += 32) {
          g.beginPath();
          g.moveTo(X(x0+t), X(z0+SW)); g.lineTo(X(x0+t), X(z0+BLOCK-SW));
          g.moveTo(X(x0+SW), X(z0+t)); g.lineTo(X(x0+BLOCK-SW), X(z0+t));
          g.stroke();
        }
      } else if (flavor === 'parking') {
        // Gray parking lot with white stall lines
        g.fillStyle = '#8a8e94';
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
        g.strokeStyle = '#f2f4f6'; g.lineWidth = 1;
        for (let t = SW; t <= BLOCK-SW; t += 40) {
          g.beginPath();
          g.moveTo(X(x0+SW), X(z0+t)); g.lineTo(X(x0+BLOCK-SW), X(z0+t));
          g.stroke();
        }
      } else if (flavor === 'lawn-a') {
        g.fillStyle = '#6abf5e';  // bright green
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
      } else if (flavor === 'lawn-b') {
        g.fillStyle = '#5db055';  // medium green
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
      } else if (flavor === 'lawn-c') {
        g.fillStyle = '#79c46b';  // light green
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
      } else {
        // Default downtown/fallback
        g.fillStyle = type === 'downtown' ? '#a4aab1'
                    : type === 'park'     ? '#6abf5e' : '#79c46b';
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
      }
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
  // Reset metrics for this match
  skyrisesPlaced = 0;
  tallestProp = 0;

  // Wrapper to track skyrise placements and props
  const origAddProp = addProp;
  const wrappedAddProp = (name, x, z, rotY, opts) => {
    if (name === 'skyrise' || name === 'skyrise2') {
      skyrisesPlaced++;
    }
    if (STATS[name]) {
      tallestProp = Math.max(tallestProp, STATS[name].h || 0);
    }
    origAddProp(name, x, z, rotY, opts);
    // Expose metrics globally for smoke testing (update after each prop)
    window.skyrisesPlaced = skyrisesPlaced;
    window.tallestProp = tallestProp;
    window.coreBlocks = coreBlocks;
  };

  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const [x0, z0] = blockOrigin(i, j);
    const cx = x0 + BLOCK/2, cz = z0 + BLOCK/2;
    const type = blockPlan[i][j];
    const isCore = coreBlocks.has(`${i},${j}`);
    const inBlock = (dx, dz) => [cx + dx, cz + dz];

    // Every block: streetlights on corners + mid-edges, sidewalk life.
    for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
      wrappedAddProp('streetlight', cx + sx*(BLOCK/2 - 8), cz + sz*(BLOCK/2 - 8),
        Math.atan2(-sz, -sx));
    wrappedAddProp('streetlight', cx, cz - (BLOCK/2 - 8), Math.PI/2);
    wrappedAddProp('streetlight', cx, cz + (BLOCK/2 - 8), -Math.PI/2);
    wrappedAddProp('trashcan', cx + rand(-90, 90), cz - (BLOCK/2 - 8));
    wrappedAddProp('trashcan', cx + (BLOCK/2 - 8), cz + rand(-90, 90));
    wrappedAddProp('trashcan', cx - (BLOCK/2 - 8), cz + rand(-90, 90));
    wrappedAddProp('mailbox', cx + rand(-90, 90), cz + (BLOCK/2 - 8));
    for (const t of [-1, 1]) {                       // sidewalk trees
      wrappedAddProp('tree', cx + t*BLOCK/4, cz - (BLOCK/2 - 8));
      wrappedAddProp('tree', cx + t*BLOCK/4, cz + (BLOCK/2 - 8));
    }
    for (let k = 0; k < 8; k++) {
      const edge = Math.random() < 0.5 ? -1 : 1;
      if (Math.random() < 0.5)
        wrappedAddProp('person', cx + rand(-100, 100), cz + edge*(BLOCK/2 - 8));
      else
        wrappedAddProp('person', cx + edge*(BLOCK/2 - 8), cz + rand(-100, 100));
    }
    for (let k = 0; k < 2; k++) {
      const edge = Math.random() < 0.5 ? -1 : 1;
      wrappedAddProp('dog', cx + rand(-95, 95), cz + edge*(BLOCK/2 - 8));
    }

    if (type === 'downtown') {
      if (isCore) {
        // Core district: 2-3 tower stacks with spaced positioning
        const skyCount = Math.random() < 0.6 ? 3 : 2;
        const positions = [
          [-60, -60], [60, -60], [-60, 60], [60, 60]
        ];
        const chosen = [];
        for (let k = 0; k < skyCount && k < positions.length; k++) {
          chosen.push(positions[k]);
        }
        for (const [dx, dz] of chosen) {
          const stackHeight = 4 + Math.floor(Math.random() * 3);  // 4-6 slices
          stackSlices(wrappedAddProp, 'tower', cx + dx, cz + dz, 0, stackHeight, true);
        }
        // Add 2 apartment stacks and 2 shops away from tower stacks for density
        const aptH1 = 2 + Math.floor(Math.random() * 3);  // 2-4 slices
        stackSlices(wrappedAddProp, 'apartment', cx - 30, cz, 0, aptH1, true);
        const aptH2 = 2 + Math.floor(Math.random() * 3);
        stackSlices(wrappedAddProp, 'apartment', cx + 30, cz, 0, aptH2, true);
        wrappedAddProp('shop', ...inBlock(0, -75), Math.PI/2);
        wrappedAddProp('shop', ...inBlock(0, 75), -Math.PI/2);
        for (let k = 0; k < 8; k++)
          wrappedAddProp('person', ...inBlock(rand(-60, 60),
            (Math.random() < 0.5 ? -1 : 1) * rand(70, 100)));
        wrappedAddProp('hydrant', ...inBlock(-100, 0));
        wrappedAddProp('bench', ...inBlock(-30, 40), Math.PI);
        wrappedAddProp('bench', ...inBlock(30, -40), 0);
      } else {
        // Non-core downtown: denser layout with tower stack at center, 2 apartment stacks, 5-6 shops
        const towerH = 3 + Math.floor(Math.random() * 3);  // 3-5 slices
        stackSlices(wrappedAddProp, 'tower', cx, cz, 0, towerH, true);

        // 2 apartment stacks on perpendicular axes (avoiding corner shops) with small jitter
        const apOff = BLOCK/2 - 40;
        const aptH1 = 2 + Math.floor(Math.random() * 3);
        stackSlices(wrappedAddProp, 'apartment', cx - apOff + rand(-5, 5), cz + rand(-5, 5), 0, aptH1, true);
        const aptH2 = 2 + Math.floor(Math.random() * 3);
        stackSlices(wrappedAddProp, 'apartment', cx + apOff + rand(-5, 5), cz + rand(-5, 5), 0, aptH2, true);

        // 5-6 shops: 3 original corners + 3 new shops avoiding apartment positions
        wrappedAddProp('shop', ...inBlock(-80 + rand(-5, 5), -80 + rand(-5, 5)));
        wrappedAddProp('shop', ...inBlock(80 + rand(-5, 5), -80 + rand(-5, 5)), Math.PI/2);
        wrappedAddProp('shop', ...inBlock(80 + rand(-5, 5), 80 + rand(-5, 5)), Math.PI);
        wrappedAddProp('shop', ...inBlock(0 + rand(-5, 5), 70 + rand(-5, 5)), 0);
        wrappedAddProp('shop', ...inBlock(-60 + rand(-5, 5), 50 + rand(-5, 5)), Math.PI);
        wrappedAddProp('shop', ...inBlock(60 + rand(-5, 5), -50 + rand(-5, 5)), 0);

        for (let k = 0; k < 12; k++)
          wrappedAddProp('person', ...inBlock(rand(-40, 100),
            (Math.random() < 0.5 ? -1 : 1) * rand(70, 100)));
        wrappedAddProp('hydrant', ...inBlock(-100, 0));
        wrappedAddProp('hydrant', ...inBlock(100, 30));
        wrappedAddProp('bench', ...inBlock(-30, 40), Math.PI);
        wrappedAddProp('bench', ...inBlock(30, 40), Math.PI);
        wrappedAddProp('bench', ...inBlock(-30, -40), 0);
        wrappedAddProp('bench', ...inBlock(30, -40), 0);
        wrappedAddProp('mailbox', ...inBlock(rand(-90, 90), rand(-90, 90)));
        wrappedAddProp('mailbox', ...inBlock(rand(-90, 90), rand(-90, 90)));
        wrappedAddProp('dog', ...inBlock(rand(-90, 90), rand(-90, 90)));
        for (let k = 0; k < 3; k++)
          wrappedAddProp('cone', ...inBlock(rand(-90, 90), rand(-90, 90)));
        wrappedAddProp('trashcan', ...inBlock(rand(-90, 90), rand(-90, 90)));
        wrappedAddProp('trashcan', ...inBlock(rand(-90, 90), rand(-90, 90)));
      }
    } else if (type === 'residential') {
      // Six buildings in two street-facing rows with fenced front yards;
      // some blocks swap the middle lots for an apartment and a corner shop.
      for (const [hx, hz] of [[-66,-58],[66,-58],[-66,58],[66,58]])
        wrappedAddProp('house', cx + hx + rand(-4, 4), cz + hz + rand(-4, 4),
          hz < 0 ? Math.PI : 0);
      if (Math.random() < 0.4) {
        const aptH = 2 + Math.floor(Math.random() * 2);  // 2-3 slices
        stackSlices(wrappedAddProp, 'apartment', cx, cz - 58, Math.PI, aptH, true);
        wrappedAddProp('shop', cx, cz + 58, 0);
      } else {
        wrappedAddProp('house', cx + rand(-4, 4), cz - 58, Math.PI);
        wrappedAddProp('house', cx + rand(-4, 4), cz + 58, 0);
      }
      // Add 2 extra houses at mid-edge gaps if BLOCK is large enough (on center line to avoid existing houses)
      if (BLOCK > 240) {
        wrappedAddProp('house', cx - (BLOCK/2 - 40) + rand(-4, 4), cz + rand(-4, 4), Math.PI/2);
        wrappedAddProp('house', cx + (BLOCK/2 - 40) + rand(-4, 4), cz + rand(-4, 4), -Math.PI/2);
      }
      for (const fx of [-84, -58, -30, 30, 58, 84]) wrappedAddProp('fence', cx + fx, cz, 0);
      wrappedAddProp('tree', ...inBlock(-96, 0));
      wrappedAddProp('tree', ...inBlock(96, 0));
      wrappedAddProp('tree', ...inBlock(-33, 0));
      wrappedAddProp('tree', ...inBlock(33, 0));
      for (let k = 0; k < 10; k++)
        wrappedAddProp('bush', ...inBlock(rand(-95, 95), pick([-1,1])*rand(0, 30)));
      wrappedAddProp('hydrant', ...inBlock(rand(-90, 90), 100));
      wrappedAddProp('mailbox', ...inBlock(rand(-90, 90), -100));
      wrappedAddProp('mailbox', ...inBlock(rand(-90, 90), 100));
      for (let k = 0; k < 9; k++)
        wrappedAddProp('person', ...inBlock(rand(-95, 95), rand(-95, 95)));
      wrappedAddProp('dog', ...inBlock(rand(-95, 95), rand(-95, 95)));
      wrappedAddProp('dog', ...inBlock(rand(-95, 95), rand(-95, 95)));
    } else {  // park — the spawn block stays clear for the player
      const isSpawn = (i === spawnI && j === spawnJ);
      if (!isSpawn) wrappedAddProp('fountain', cx, cz, 0);
      for (const f of [-55, 55]) {
        wrappedAddProp('fence', cx + f, cz - 88, 0);
        wrappedAddProp('fence', cx + f, cz + 88, 0);
        wrappedAddProp('fence', cx - 88, cz + f, Math.PI/2);
        wrappedAddProp('fence', cx + 88, cz + f, Math.PI/2);
      }
      for (let k = 0; k < 15; k++) {
        const dx = rand(-78, 78), dz = rand(-78, 78);
        if (isSpawn && Math.hypot(dx, dz) < 55) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 26) continue;
        wrappedAddProp('tree', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 12; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('bush', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 3; k++) {
        const dx = rand(-85, 85), dz = rand(-85, 85);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        wrappedAddProp('dog', ...inBlock(dx, dz));
      }
      // Benches: 4 edge-facing
      wrappedAddProp('bench', ...inBlock(rand(-60, 60), -75), 0);
      wrappedAddProp('bench', ...inBlock(rand(-60, 60), 75), Math.PI);
      wrappedAddProp('bench', ...inBlock(-75, rand(-50, 50)), Math.PI/2);
      wrappedAddProp('bench', ...inBlock(75, rand(-50, 50)), -Math.PI/2);
      // Additional benches (total 8)
      wrappedAddProp('bench', ...inBlock(rand(-60, 60), -75), 0);
      wrappedAddProp('bench', ...inBlock(rand(-60, 60), 75), Math.PI);
      wrappedAddProp('bench', ...inBlock(-75, rand(-50, 50)), Math.PI/2);
      wrappedAddProp('bench', ...inBlock(75, rand(-50, 50)), -Math.PI/2);
      // Tiny food items: people
      for (let k = 0; k < 22; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('person', ...inBlock(dx, dz));
      }
      // Tiny food items: cones
      for (let k = 0; k < 3; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('cone', ...inBlock(dx, dz));
      }
      // Tiny food items: hydrants
      for (let k = 0; k < 2; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('hydrant', ...inBlock(dx, dz));
      }
      // Tiny food items: trashcans
      for (let k = 0; k < 2; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('trashcan', ...inBlock(dx, dz));
      }
      // Tiny food items: mailboxes
      for (let k = 0; k < 2; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('mailbox', ...inBlock(dx, dz));
      }
      // Additional bushes (total ~20)
      for (let k = 0; k < 8; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        wrappedAddProp('bush', ...inBlock(dx, dz));
      }
    }

    // Cars parallel-parked along this block's curbs.
    for (let k = 0; k < 5; k++) {
      const side = (Math.random()*4)|0, off = BLOCK/2 + 9, along = rand(-95, 95);
      if (side === 0)      wrappedAddProp('car', cx + along, cz - off, 0);
      else if (side === 1) wrappedAddProp('car', cx + along, cz + off, 0);
      else if (side === 2) wrappedAddProp('car', cx - off, cz + along, Math.PI/2);
      else                 wrappedAddProp('car', cx + off, cz + along, Math.PI/2);
    }
  }

  // Traffic on the streets themselves.
  for (let k = 0; k <= GRID_N; k++) {
    const rc = -WORLD + k*P + ROAD/2;
    for (let n = 0; n < 12; n++) {
      const along = rand(-WORLD + 60, WORLD - 60);
      const lane = (Math.random() < 0.5 ? -1 : 1) * 12;
      const bus = Math.random() < 0.15;
      if (Math.random() < 0.5) wrappedAddProp(bus ? 'bus' : 'car', along, rc + lane, 0);
      else                     wrappedAddProp(bus ? 'bus' : 'car', rc + lane, along, Math.PI/2);
    }
    if (k < GRID_N) {
      wrappedAddProp('cone', rand(-WORLD+60, WORLD-60), rc, 0);
      wrappedAddProp('cone', rc, rand(-WORLD+60, WORLD-60), 0);
    }
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
  skirtColor: 0x5a4a3a,
  progressLabel: 'City devoured',
  startR: 8,
  // world, playerSpawn, and botSpawns are rolled by generate() every match.
  generate,
  createGroundTexture: cityGroundTexture,
  populate,
  // Expose metrics for smoke testing
  get debugCore() { return coreBlocks.size > 0; },
  get debugSkyrises() { return skyrisesPlaced; },
  get debugTallest() { return tallestProp; },
});

})();
