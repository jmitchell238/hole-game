// City Test — PERFORMANCE EXPERIMENT (does NOT change the live City level).
//
// Goal: prove a Hole.io-style city can run on gen-1 iPad Pro:
//   • ONE mesh per prop (box/sphere), feet at y=0 via geometry.translate
//   • MeshBasicMaterial (no per-pixel lighting — big mobile win)
//   • Facade detail only in textures
//   • Smaller grid + fewer props than live City
//
// Settings → Debug → "City Test"
(function () {

let GRID_N, BLOCK, ROAD, P, WORLD;
let blockPlan = [];
let spawnI, spawnJ;

const blockOrigin = (i, j) => [-WORLD + ROAD + i * P, -WORLD + ROAD + j * P];

// ---- Shared geometries (origin at ground / feet) ----------------------------
// addProp() sets root position to (x,0,z) and wipes mesh.position — so height
// offsets MUST be baked into the geometry, not mesh.position.y.
function boxAtFeet(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}
function sphereAtFeet(r, wSeg, hSeg, yScale) {
  const g = new THREE.SphereGeometry(r, wSeg, hSeg);
  g.scale(1, yScale || 1, 1);
  g.translate(0, r * (yScale || 1), 0);
  return g;
}
function cylAtFeet(rt, rb, h, seg) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(0, h / 2, 0);
  return g;
}

// One shared geo per prop type (instanced materials only)
const GEO = {
  house: boxAtFeet(30, 26, 30),
  shop: boxAtFeet(24, 18, 24),
  tower: boxAtFeet(40, 88, 40),
  apt: boxAtFeet(34, 48, 34),
  tree: sphereAtFeet(9, 5, 4, 1.35),
  car: boxAtFeet(16, 6, 8),
  person: boxAtFeet(3, 8, 2.2),
  light: cylAtFeet(0.5, 0.7, 20, 5),
};

// ---- Facade textures (detail in pixels, not meshes) -------------------------
function facadeHouse(base) {
  return canvasTex(128, 128, g => {
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,.12)';
    for (let y = 8; y < 128; y += 10) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    }
    const win = (x, y) => {
      g.fillStyle = '#eef6ff'; g.fillRect(x, y, 28, 32);
      g.fillStyle = '#5aa0e0'; g.fillRect(x + 3, y + 3, 22, 26);
    };
    win(18, 18); win(82, 18); win(18, 70); win(82, 70);
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
      g.fillStyle = Math.random() < 0.12 ? '#ffe9a0' : '#6eb0e0';
      g.fillRect(x, y, 12, 12);
    }
  });
}
function facadeTree() {
  return canvasTex(64, 64, g => {
    g.fillStyle = '#3d8f3a'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2e7030';
    g.beginPath(); g.arc(32, 32, 22, 0, 7); g.fill();
  });
}

// MeshBasicMaterial = no lighting math (big A9X win vs Lambert)
const _houseMats = ['#f2ead6', '#ece4d0', '#e8dcc8', '#f0e8d8'].map(c =>
  new THREE.MeshBasicMaterial({ map: facadeHouse(c) }));
const _shopMats = ['#d8896a', '#7aa8c8', '#8fbf8a', '#c8a05a'].map(c =>
  new THREE.MeshBasicMaterial({ map: facadeShop(c) }));
const _towerMat = new THREE.MeshBasicMaterial({ map: facadeTower() });
const _treeMat = new THREE.MeshBasicMaterial({ map: facadeTree() });
const _carMats = [0x4f8ae8, 0xe85555, 0xf0c548, 0x9b5ad6, 0x48c9a9].map(c =>
  new THREE.MeshBasicMaterial({ color: c }));
const _personMat = new THREE.MeshBasicMaterial({ color: 0xe8b48e });
const _lightMat = new THREE.MeshBasicMaterial({ color: 0x555555 });

function oneMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = true;
  return m;
}

registerProp('stest_house', { r: 16, h: 30 }, () => oneMesh(GEO.house, pick(_houseMats)), false);
registerProp('stest_shop', { r: 13, h: 22 }, () => oneMesh(GEO.shop, pick(_shopMats)), false);
registerProp('stest_tower', { r: 22, h: 90 }, () => oneMesh(GEO.tower, _towerMat), false);
registerProp('stest_apt', { r: 18, h: 50 }, () => oneMesh(GEO.apt, pick(_houseMats)), false);
registerProp('stest_tree', { r: 8, h: 28 }, () => oneMesh(GEO.tree, _treeMat), false);
registerProp('stest_car', { r: 9, h: 8 }, () => oneMesh(GEO.car, pick(_carMats)), false);
registerProp('stest_person', { r: 3, h: 9 }, () => oneMesh(GEO.person, _personMat), false);
registerProp('stest_light', { r: 2, h: 22 }, () => oneMesh(GEO.light, _lightMat), false);

// ---- Compact layout ---------------------------------------------------------
function planCity() {
  const mid = (GRID_N / 2) | 0;
  spawnI = mid; spawnJ = mid;
  blockPlan = [];
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === spawnI && j === spawnJ) { blockPlan[i][j] = 'park'; continue; }
      const d = Math.max(Math.abs(i - mid), Math.abs(j - mid));
      if (d <= 1) blockPlan[i][j] = Math.random() < 0.75 ? 'downtown' : 'park';
      else blockPlan[i][j] = Math.random() < 0.15 ? 'park' : 'residential';
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
  // Fixed 4×4 — much less stuff than live City (5–6)
  GRID_N = 4;
  BLOCK = 230;
  ROAD = 48;
  P = BLOCK + ROAD;
  WORLD = (GRID_N * P + ROAD) / 2;
  planCity();
  this.world = WORLD;
  const [x0, z0] = blockOrigin(spawnI, spawnJ);
  this.playerSpawn = [x0 + BLOCK / 2, z0 + BLOCK / 2];
  this.botSpawns = pickBotSpawns(this.playerSpawn[0], this.playerSpawn[1]);
}

function cityTestGroundTexture() {
  const S = 1024;
  return canvasTex(S, S, g => {
    const sc = S / (2 * WORLD);
    const X = w => (w + WORLD) * sc;
    g.fillStyle = '#4b5058'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const [x0, z0] = blockOrigin(i, j), type = blockPlan[i][j];
      g.fillStyle = '#b5bac0';
      g.fillRect(X(x0), X(z0), BLOCK * sc, BLOCK * sc);
      const SW = 14;
      g.fillStyle = type === 'downtown' ? '#9aa3ab'
        : type === 'park' ? '#6faf5e' : '#7cbc66';
      g.fillRect(X(x0 + SW), X(z0 + SW), (BLOCK - 2 * SW) * sc, (BLOCK - 2 * SW) * sc);
    }
    g.strokeStyle = '#dfe3e6'; g.lineWidth = Math.max(2, 2 * sc);
    g.setLineDash([14 * sc, 12 * sc]);
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
  let n = 0;
  const add = (name, x, z, rot) => { addProp(name, x, z, rot); n++; };

  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const [x0, z0] = blockOrigin(i, j);
    const cx = x0 + BLOCK / 2, cz = z0 + BLOCK / 2;
    const type = blockPlan[i][j];
    const inBlock = (dx, dz) => [cx + dx, cz + dz];
    const isSpawn = (i === spawnI && j === spawnJ);

    // 2 lights per block max
    add('stest_light', cx - (BLOCK / 2 - 12), cz - (BLOCK / 2 - 12));
    add('stest_light', cx + (BLOCK / 2 - 12), cz + (BLOCK / 2 - 12));

    if (type === 'downtown') {
      add('stest_tower', cx, cz, 0);
      add('stest_shop', ...inBlock(-65, -65));
      add('stest_shop', ...inBlock(65, 65), Math.PI);
      add('stest_apt', ...inBlock(65, -65), Math.PI / 2);
      for (let k = 0; k < 3; k++)
        add('stest_person', ...inBlock(rand(-80, 80), rand(-80, 80)));
    } else if (type === 'residential') {
      add('stest_house', ...inBlock(-55, -50), Math.PI);
      add('stest_house', ...inBlock(55, -50), Math.PI);
      add('stest_house', ...inBlock(-55, 50), 0);
      add('stest_house', ...inBlock(55, 50), 0);
      add('stest_tree', ...inBlock(-80, 0));
      add('stest_tree', ...inBlock(80, 0));
      for (let k = 0; k < 2; k++)
        add('stest_person', ...inBlock(rand(-80, 80), rand(-80, 80)));
    } else {
      for (let k = 0; k < (isSpawn ? 4 : 7); k++) {
        const dx = rand(-70, 70), dz = rand(-70, 70);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        add('stest_tree', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 3; k++) {
        const dx = rand(-80, 80), dz = rand(-80, 80);
        if (isSpawn && Math.hypot(dx, dz) < 40) continue;
        add('stest_person', ...inBlock(dx, dz));
      }
    }

    // 2 parked cars per block
    for (let k = 0; k < 2; k++) {
      const side = (Math.random() * 4) | 0, off = BLOCK / 2 + 9, along = rand(-80, 80);
      if (side === 0) add('stest_car', cx + along, cz - off, 0);
      else if (side === 1) add('stest_car', cx + along, cz + off, 0);
      else if (side === 2) add('stest_car', cx - off, cz + along, Math.PI / 2);
      else add('stest_car', cx + off, cz + along, Math.PI / 2);
    }
  }

  // Sparse traffic
  for (let k = 0; k <= GRID_N; k++) {
    const rc = -WORLD + k * P + ROAD / 2;
    for (let n = 0; n < 3; n++) {
      const along = rand(-WORLD + 50, WORLD - 50);
      const lane = (Math.random() < 0.5 ? -1 : 1) * 12;
      if (Math.random() < 0.5) add('stest_car', along, rc + lane, 0);
      else add('stest_car', rc + lane, along, Math.PI / 2);
    }
  }

  window.__cityTestPropCount = n;
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
