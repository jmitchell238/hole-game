// City Test — PERFORMANCE EXPERIMENT (does NOT change the live City level).
//
// Hypothesis: multi-mesh buildings (chimneys, roof pieces, separate windows as
// geometry…) burn draw calls. Hole.io-style games often use ONE box/prism per
// building with a painted facade texture ("sprite blanket") instead.
//
// This map reuses the city grid idea but every prop is ideally 1 Mesh:
//   • Buildings  = BoxGeometry + canvas facade texture (all faces same map)
//   • Trees      = 1 cone or 1 sphere stack as a single mesh where possible
//   • Cars       = 1 box + car-color material
//   • People     = 1 capsule-ish box
//
// Pick it in Settings → Debug → "City Test" and compare FPS vs "City".
(function () {

let GRID_N, BLOCK, ROAD, P, WORLD;
let blockPlan = [];
let spawnI, spawnJ;

const blockOrigin = (i, j) => [-WORLD + ROAD + i * P, -WORLD + ROAD + j * P];

// ---- Sprite-style textures (detail is in the image, not extra meshes) --------
function facadeHouse(base) {
  return canvasTex(128, 128, g => {
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,.1)';
    for (let y = 8; y < 128; y += 10) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    }
    const win = (x, y) => {
      g.fillStyle = '#eef6ff'; g.fillRect(x, y, 28, 32);
      g.fillStyle = '#5aa0e0'; g.fillRect(x + 3, y + 3, 22, 26);
      g.fillStyle = '#fff'; g.fillRect(x + 12, y + 3, 2, 26);
    };
    win(18, 18); win(82, 18); win(18, 70); win(82, 70);
    // door
    g.fillStyle = '#6b3f24'; g.fillRect(52, 78, 24, 50);
  });
}

function facadeShop(paint) {
  return canvasTex(128, 128, g => {
    g.fillStyle = paint; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff'; g.fillRect(10, 48, 70, 60);
    g.fillStyle = '#c5e0f0'; g.fillRect(14, 52, 62, 52);
    g.fillStyle = '#444'; g.fillRect(90, 48, 28, 80);
  });
}

function facadeTower() {
  return canvasTex(128, 256, g => {
    g.fillStyle = '#4a90c8'; g.fillRect(0, 0, 128, 256);
    for (let y = 6; y < 250; y += 18) for (let x = 6; x < 122; x += 16) {
      g.fillStyle = Math.random() < 0.15 ? '#ffe9a0' : '#6eb0e0';
      g.fillRect(x, y, 12, 12);
    }
    g.fillStyle = '#e8e0d0';
    for (let y = 60; y < 256; y += 60) g.fillRect(0, y, 128, 4);
  });
}

function facadeTree() {
  return canvasTex(64, 64, g => {
    g.fillStyle = '#3d8f3a'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2e7030';
    g.beginPath(); g.arc(20, 24, 14, 0, 7); g.fill();
    g.beginPath(); g.arc(42, 28, 12, 0, 7); g.fill();
    g.beginPath(); g.arc(32, 40, 16, 0, 7); g.fill();
  });
}

// Cache a few materials so we don't rebuild textures every instance
const _houseMats = ['#f2ead6', '#ece4d0', '#e8dcc8', '#f0e8d8'].map(c =>
  new THREE.MeshLambertMaterial({ map: facadeHouse(c) }));
const _shopMats = ['#d8896a', '#7aa8c8', '#8fbf8a', '#c8a05a'].map(c =>
  new THREE.MeshLambertMaterial({ map: facadeShop(c) }));
const _towerMat = new THREE.MeshLambertMaterial({ map: facadeTower() });
const _treeMat = new THREE.MeshLambertMaterial({ map: facadeTree() });
const _carMats = [0x4f8ae8, 0xe85555, 0xf0c548, 0x9b5ad6, 0x48c9a9].map(c =>
  new THREE.MeshLambertMaterial({ color: c }));
const _personMat = new THREE.MeshLambertMaterial({ color: 0xe8b48e });
const _trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });

// ---- 1-mesh prop builders ---------------------------------------------------
// Single Mesh (not Group) = 1 draw call after frustum culling.

registerProp('stest_house', { r: 16, h: 30 }, function () {
  const m = new THREE.Mesh(new THREE.BoxGeometry(30, 26, 30), pick(_houseMats));
  m.position.y = 13;
  // Tiny roof slab still 1 extra mesh — skip it: paint roof in texture only
  return m;
}, true);

registerProp('stest_shop', { r: 13, h: 22 }, function () {
  const m = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 24), pick(_shopMats));
  m.position.y = 9;
  return m;
}, true);

registerProp('stest_tower', { r: 22, h: 90 }, function () {
  const m = new THREE.Mesh(new THREE.BoxGeometry(40, 88, 40), _towerMat);
  m.position.y = 44;
  return m;
}, true);

registerProp('stest_apt', { r: 18, h: 50 }, function () {
  const m = new THREE.Mesh(new THREE.BoxGeometry(34, 48, 34), pick(_houseMats));
  m.position.y = 24;
  return m;
}, true);

// Tree: trunk + canopy would be 2 meshes; use ONE stretched sphere as a bushy tree
registerProp('stest_tree', { r: 8, h: 28 }, function () {
  const m = new THREE.Mesh(new THREE.SphereGeometry(9, 6, 5), _treeMat);
  m.position.y = 14;
  m.scale.set(1, 1.4, 1);
  return m;
}, false);

// Car: single box
registerProp('stest_car', { r: 9, h: 8 }, function () {
  const m = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 8), pick(_carMats));
  m.position.y = 3;
  return m;
}, false);

// Person: single thin box (billboard-ish silhouette)
registerProp('stest_person', { r: 3, h: 9 }, function () {
  const m = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 2.2), _personMat);
  m.position.y = 4;
  return m;
}, false);

// Street light: single thin cylinder
registerProp('stest_light', { r: 2, h: 22 }, function () {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 20, 5), _trunkMat);
  m.position.y = 10;
  return m;
}, false);

// ---- Layout (same idea as City, slightly sparser for a clean A/B) ------------
function planCity() {
  const midIdx = n => (n % 2) ? (n - 1) / 2 : n / 2 - (Math.random() < 0.5 ? 1 : 0);
  spawnI = midIdx(GRID_N);
  spawnJ = midIdx(GRID_N);
  const seeds = [];
  const seedCount = GRID_N >= 6 ? 2 : 1;
  while (seeds.length < seedCount) {
    const si = (Math.random() * GRID_N) | 0, sj = (Math.random() * GRID_N) | 0;
    if (si === spawnI && sj === spawnJ) continue;
    seeds.push([si, sj]);
  }
  blockPlan = [];
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === spawnI && j === spawnJ) { blockPlan[i][j] = 'park'; continue; }
      const near = seeds.some(([si, sj]) => Math.max(Math.abs(i - si), Math.abs(j - sj)) <= 1);
      blockPlan[i][j] = near
        ? (Math.random() < 0.85 ? 'downtown' : 'park')
        : (Math.random() < 0.18 ? 'park' : 'residential');
    }
  }
}

function pickBotSpawns(px, pz) {
  const pts = [];
  for (let k = 0; k <= GRID_N; k++) for (let l = 0; l <= GRID_N; l++) {
    const x = -WORLD + k * P + ROAD / 2, z = -WORLD + l * P + ROAD / 2;
    if (dist(x, z, px, pz) < P * 1.2) continue;
    pts.push([x, z]);
  }
  pts.sort(() => Math.random() - 0.5);
  return pts.slice(0, 7);
}

function generate() {
  GRID_N = 5 + ((Math.random() * 2) | 0);
  BLOCK = Math.round(rand(215, 265));
  ROAD = Math.round(rand(42, 62));
  P = BLOCK + ROAD;
  WORLD = (GRID_N * P + ROAD) / 2;
  planCity();
  this.world = WORLD;
  const [x0, z0] = blockOrigin(spawnI, spawnJ);
  this.playerSpawn = [x0 + BLOCK / 2, z0 + BLOCK / 2];
  this.botSpawns = pickBotSpawns(this.playerSpawn[0], this.playerSpawn[1]);
}

function cityTestGroundTexture() {
  const S = 2048; // slightly smaller atlas — fine for a test map
  return canvasTex(S, S, g => {
    const sc = S / (2 * WORLD);
    const X = w => (w + WORLD) * sc;
    g.fillStyle = '#4b5058'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const [x0, z0] = blockOrigin(i, j), type = blockPlan[i][j];
      g.fillStyle = '#b5bac0';
      g.fillRect(X(x0), X(z0), BLOCK * sc, BLOCK * sc);
      const SW = 16;
      if (type === 'downtown') g.fillStyle = '#9aa3ab';
      else if (type === 'park') g.fillStyle = '#6faf5e';
      else g.fillStyle = '#7cbc66';
      g.fillRect(X(x0 + SW), X(z0 + SW), (BLOCK - 2 * SW) * sc, (BLOCK - 2 * SW) * sc);
    }
    // Lane marks
    g.strokeStyle = '#dfe3e6'; g.lineWidth = Math.max(2, 2.2 * sc);
    g.setLineDash([18 * sc, 16 * sc]);
    g.beginPath();
    for (let k = 0; k <= GRID_N; k++) {
      const rc = X(-WORLD + k * P + ROAD / 2);
      g.moveTo(0, rc); g.lineTo(S, rc);
      g.moveTo(rc, 0); g.lineTo(rc, S);
    }
    g.stroke(); g.setLineDash([]);
  });
}

function populate(addProp) {
  let meshBudget = 0;
  const add = (name, x, z, rot) => {
    addProp(name, x, z, rot);
    meshBudget++;
  };

  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const [x0, z0] = blockOrigin(i, j);
    const cx = x0 + BLOCK / 2, cz = z0 + BLOCK / 2;
    const type = blockPlan[i][j];
    const inBlock = (dx, dz) => [cx + dx, cz + dz];

    // Corner lights only (4) — not mid-edge spam
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      add('stest_light', cx + sx * (BLOCK / 2 - 10), cz + sz * (BLOCK / 2 - 10));

    if (type === 'downtown') {
      add('stest_tower', cx, cz, 0);
      add('stest_shop', ...inBlock(-70, -70));
      add('stest_shop', ...inBlock(70, -70), Math.PI / 2);
      add('stest_apt', ...inBlock(-70, 70));
      // People: sparse
      for (let k = 0; k < 6; k++)
        add('stest_person', ...inBlock(rand(-90, 90), (Math.random() < 0.5 ? -1 : 1) * rand(70, 95)));
    } else if (type === 'residential') {
      for (const [hx, hz] of [[-60, -55], [60, -55], [-60, 55], [60, 55]])
        add('stest_house', cx + hx, cz + hz, hz < 0 ? Math.PI : 0);
      add('stest_house', cx, cz - 55, Math.PI);
      add('stest_house', cx, cz + 55, 0);
      for (const t of [-70, 70]) {
        add('stest_tree', cx + t, cz);
        add('stest_tree', cx, cz + t);
      }
      for (let k = 0; k < 5; k++)
        add('stest_person', ...inBlock(rand(-90, 90), rand(-90, 90)));
    } else {
      // park — keep spawn block relatively clear
      const isSpawn = (i === spawnI && j === spawnJ);
      for (let k = 0; k < 10; k++) {
        const dx = rand(-75, 75), dz = rand(-75, 75);
        if (isSpawn && Math.hypot(dx, dz) < 50) continue;
        add('stest_tree', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 8; k++) {
        const dx = rand(-85, 85), dz = rand(-85, 85);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        add('stest_person', ...inBlock(dx, dz));
      }
    }

    // Parked cars along curbs (4 per block, not 5+)
    for (let k = 0; k < 4; k++) {
      const side = (Math.random() * 4) | 0, off = BLOCK / 2 + 9, along = rand(-90, 90);
      if (side === 0) add('stest_car', cx + along, cz - off, 0);
      else if (side === 1) add('stest_car', cx + along, cz + off, 0);
      else if (side === 2) add('stest_car', cx - off, cz + along, Math.PI / 2);
      else add('stest_car', cx + off, cz + along, Math.PI / 2);
    }
  }

  // Light traffic
  for (let k = 0; k <= GRID_N; k++) {
    const rc = -WORLD + k * P + ROAD / 2;
    for (let n = 0; n < 6; n++) {
      const along = rand(-WORLD + 60, WORLD - 60);
      const lane = (Math.random() < 0.5 ? -1 : 1) * 12;
      if (Math.random() < 0.5) add('stest_car', along, rc + lane, 0);
      else add('stest_car', rc + lane, along, Math.PI / 2);
    }
  }

  // Expose for smoke / perf
  window.__cityTestPropCount = meshBudget;
}

registerLevel({
  id: 'city-test',
  name: 'City Test',
  sky: 0xa8d8f0,
  fog: [650, 1900],
  hemi: [0xcfe8ff, 0x7a9a6a, 0.85],
  sunColor: 0xfff2d8,
  soil: ['#4a4038', '#241f1a'],
  skirtColor: 0x5a4a3a,
  progressLabel: 'Test city devoured',
  generate,
  createGroundTexture: cityTestGroundTexture,
  populate,
});

})();
