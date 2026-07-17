// City Test — ULTRA-SIMPLE geometry perf probe (live City unchanged).
//
// Only solid MeshBasicMaterial primitives. No canvas textures, no lighting,
// no multi-mesh props. Feet baked into geometry (addProp zeros position.y).
//
// Settings → Debug → "City Test"
(function () {

let GRID_N, BLOCK, ROAD, P, WORLD;
let blockPlan = [];
let spawnI, spawnJ;

const blockOrigin = (i, j) => [-WORLD + ROAD + i * P, -WORLD + ROAD + j * P];

// ---- Shared solid-color materials (no maps, no lights) ----------------------
const C = {
  house:  new THREE.MeshBasicMaterial({ color: 0xe8dcc8 }),
  shop:   new THREE.MeshBasicMaterial({ color: 0x7aa8c8 }),
  tower:  new THREE.MeshBasicMaterial({ color: 0x4a90c8 }),
  apt:    new THREE.MeshBasicMaterial({ color: 0xd0c4b0 }),
  tree:   new THREE.MeshBasicMaterial({ color: 0x3d8f3a }),
  car:    new THREE.MeshBasicMaterial({ color: 0xe85555 }),
  person: new THREE.MeshBasicMaterial({ color: 0xe8b48e }),
  light:  new THREE.MeshBasicMaterial({ color: 0x666666 }),
  roof:   new THREE.MeshBasicMaterial({ color: 0xc23a24 }),
};

// Feet at y=0 (geometry baked — required because addProp sets position y=0)
function boxFeet(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}
function coneFeet(r, h, seg) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  return g;
}
function cylFeet(rt, rb, h, seg) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(0, h / 2, 0);
  return g;
}

// Minimal segment counts
const GEO = {
  house:  boxFeet(28, 24, 28),
  shop:   boxFeet(22, 16, 22),
  tower:  boxFeet(36, 80, 36),
  apt:    boxFeet(30, 44, 30),
  tree:   coneFeet(10, 26, 5),     // pine cone = 1 mesh
  car:    boxFeet(14, 5, 7),
  person: boxFeet(2.5, 7, 2),
  light:  cylFeet(0.4, 0.5, 18, 4),
};

// Mark shared geos so destroyProp does not dispose them
Object.keys(GEO).forEach(k => { GEO[k].userData = { shared: true }; });

function one(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = true;
  return m;
}

registerProp('stest_house',  { r: 15, h: 26 }, () => one(GEO.house, C.house), false);
registerProp('stest_shop',   { r: 12, h: 18 }, () => one(GEO.shop, C.shop), false);
registerProp('stest_tower',  { r: 20, h: 82 }, () => one(GEO.tower, C.tower), false);
registerProp('stest_apt',    { r: 16, h: 46 }, () => one(GEO.apt, C.apt), false);
registerProp('stest_tree',   { r: 8,  h: 26 }, () => one(GEO.tree, C.tree), false);
registerProp('stest_car',    { r: 8,  h: 6  }, () => one(GEO.car, C.car), false);
registerProp('stest_person', { r: 2.5,h: 8  }, () => one(GEO.person, C.person), false);
registerProp('stest_light',  { r: 1.5,h: 20 }, () => one(GEO.light, C.light), false);

// ---- Small fixed map --------------------------------------------------------
function planCity() {
  const mid = (GRID_N / 2) | 0;
  spawnI = mid; spawnJ = mid;
  blockPlan = [];
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === spawnI && j === spawnJ) { blockPlan[i][j] = 'park'; continue; }
      const d = Math.max(Math.abs(i - mid), Math.abs(j - mid));
      if (d <= 1) blockPlan[i][j] = 'downtown';
      else blockPlan[i][j] = Math.random() < 0.2 ? 'park' : 'residential';
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
  GRID_N = 4;
  BLOCK = 220;
  ROAD = 44;
  P = BLOCK + ROAD;
  WORLD = (GRID_N * P + ROAD) / 2;
  planCity();
  this.world = WORLD;
  const [x0, z0] = blockOrigin(spawnI, spawnJ);
  this.playerSpawn = [x0 + BLOCK / 2, z0 + BLOCK / 2];
  this.botSpawns = pickBotSpawns(this.playerSpawn[0], this.playerSpawn[1]);
}

// Cheap solid ground (no fancy details)
function cityTestGroundTexture() {
  const S = 512;
  return canvasTex(S, S, g => {
    const sc = S / (2 * WORLD);
    const X = w => (w + WORLD) * sc;
    g.fillStyle = '#555a60'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const [x0, z0] = blockOrigin(i, j);
      const type = blockPlan[i][j];
      g.fillStyle = type === 'park' ? '#5a9e4e'
        : type === 'downtown' ? '#8a9098' : '#6aaa58';
      const SW = 12;
      g.fillRect(X(x0 + SW), X(z0 + SW), (BLOCK - 2 * SW) * sc, (BLOCK - 2 * SW) * sc);
    }
  });
}

function populate(addProp) {
  let n = 0;
  const add = (name, x, z, rot) => { addProp(name, x, z, rot); n++; };

  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const [x0, z0] = blockOrigin(i, j);
    const cx = x0 + BLOCK / 2, cz = z0 + BLOCK / 2;
    const type = blockPlan[i][j];
    const ib = (dx, dz) => [cx + dx, cz + dz];
    const isSpawn = i === spawnI && j === spawnJ;

    if (type === 'downtown') {
      add('stest_tower', cx, cz, 0);
      add('stest_shop', ...ib(-55, -55));
      add('stest_apt', ...ib(55, 55));
    } else if (type === 'residential') {
      add('stest_house', ...ib(-50, -48), Math.PI);
      add('stest_house', ...ib(50, -48), Math.PI);
      add('stest_house', ...ib(-50, 48), 0);
      add('stest_house', ...ib(50, 48), 0);
      add('stest_tree', ...ib(0, -70));
      add('stest_tree', ...ib(0, 70));
    } else {
      // park — few cones
      const count = isSpawn ? 3 : 5;
      for (let k = 0; k < count; k++) {
        const dx = rand(-65, 65), dz = rand(-65, 65);
        if (isSpawn && Math.hypot(dx, dz) < 40) continue;
        add('stest_tree', ...ib(dx, dz));
      }
    }

    // 1 car per block
    add('stest_car', cx + rand(-40, 40), cz - (BLOCK / 2 + 8), 0);
  }

  // A few cars on roads
  for (let k = 0; k <= GRID_N; k++) {
    const rc = -WORLD + k * P + ROAD / 2;
    add('stest_car', rand(-WORLD + 40, WORLD - 40), rc + 10, 0);
    add('stest_car', rc - 10, rand(-WORLD + 40, WORLD - 40), Math.PI / 2);
  }

  window.__cityTestPropCount = n;
}

registerLevel({
  id: 'city-test',
  name: 'City Test',
  sky: 0xa8d8f0,
  fog: [700, 2000],
  hemi: [0xcfe8ff, 0x7a9a6a, 0.9],
  sunColor: 0xfff2d8,
  soil: ['#4a4038', '#241f1a'],
  skirtColor: 0x5a4a3a,
  progressLabel: 'Test city devoured',
  generate,
  createGroundTexture: cityTestGroundTexture,
  populate,
});

})();
