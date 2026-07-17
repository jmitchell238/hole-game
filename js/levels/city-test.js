// City Test — absolute minimum cost map for A9X calibration.
// Solid MeshBasicMaterial primitives only. Live City unchanged.
// Settings → Debug → City Test  |  watch FPS chip top-left
(function () {

let GRID_N, BLOCK, ROAD, P, WORLD;
let blockPlan = [];
let spawnI, spawnJ;

const blockOrigin = (i, j) => [-WORLD + ROAD + i * P, -WORLD + ROAD + j * P];

const C = {
  house:  new THREE.MeshBasicMaterial({ color: 0xe8dcc8, fog: false }),
  shop:   new THREE.MeshBasicMaterial({ color: 0x7aa8c8, fog: false }),
  tower:  new THREE.MeshBasicMaterial({ color: 0x4a90c8, fog: false }),
  tree:   new THREE.MeshBasicMaterial({ color: 0x3d8f3a, fog: false }),
  car:    new THREE.MeshBasicMaterial({ color: 0xe85555, fog: false }),
};

function boxFeet(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  g.userData = { shared: true };
  return g;
}
function coneFeet(r, h) {
  const g = new THREE.ConeGeometry(r, h, 4); // square pyramid — minimal tris
  g.translate(0, h / 2, 0);
  g.userData = { shared: true };
  return g;
}

const GEO = {
  house: boxFeet(26, 22, 26),
  shop:  boxFeet(20, 14, 20),
  tower: boxFeet(32, 70, 32),
  tree:  coneFeet(9, 22),
  car:   boxFeet(12, 4, 6),
};

function one(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = true;
  return m;
}

registerProp('stest_house', { r: 14, h: 24 }, () => one(GEO.house, C.house), false);
registerProp('stest_shop',  { r: 11, h: 16 }, () => one(GEO.shop, C.shop), false);
registerProp('stest_tower', { r: 18, h: 72 }, () => one(GEO.tower, C.tower), false);
registerProp('stest_tree',  { r: 7,  h: 22 }, () => one(GEO.tree, C.tree), false);
registerProp('stest_car',   { r: 7,  h: 5  }, () => one(GEO.car, C.car), false);

function generate() {
  GRID_N = 3; // tiny map
  BLOCK = 200;
  ROAD = 40;
  P = BLOCK + ROAD;
  WORLD = (GRID_N * P + ROAD) / 2;
  const mid = 1;
  spawnI = mid; spawnJ = mid;
  blockPlan = [];
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === mid && j === mid) blockPlan[i][j] = 'park';
      else if (Math.max(Math.abs(i - mid), Math.abs(j - mid)) <= 1)
        blockPlan[i][j] = 'downtown';
      else blockPlan[i][j] = 'residential';
    }
  }
  this.world = WORLD;
  const [x0, z0] = blockOrigin(spawnI, spawnJ);
  this.playerSpawn = [x0 + BLOCK / 2, z0 + BLOCK / 2];
  this.botSpawns = [
    [this.playerSpawn[0] + 200, this.playerSpawn[1]],
    [this.playerSpawn[0] - 200, this.playerSpawn[1]],
    [this.playerSpawn[0], this.playerSpawn[1] + 200],
    [this.playerSpawn[0], this.playerSpawn[1] - 200],
    [this.playerSpawn[0] + 150, this.playerSpawn[1] + 150],
    [this.playerSpawn[0] - 150, this.playerSpawn[1] - 150],
    [this.playerSpawn[0] + 150, this.playerSpawn[1] - 150],
  ];
}

function cityTestGroundTexture() {
  const S = 256;
  return canvasTex(S, S, g => {
    const sc = S / (2 * WORLD);
    const X = w => (w + WORLD) * sc;
    g.fillStyle = '#555a60'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const [x0, z0] = blockOrigin(i, j);
      const t = blockPlan[i][j];
      g.fillStyle = t === 'park' ? '#5a9e4e' : t === 'downtown' ? '#888e96' : '#6aaa58';
      g.fillRect(X(x0 + 10), X(z0 + 10), (BLOCK - 20) * sc, (BLOCK - 20) * sc);
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
    const isSpawn = i === spawnI && j === spawnJ;

    if (type === 'downtown') {
      add('stest_tower', cx, cz, 0);
      add('stest_shop', cx - 50, cz - 50);
    } else if (type === 'residential') {
      add('stest_house', cx - 45, cz - 40, Math.PI);
      add('stest_house', cx + 45, cz + 40, 0);
      add('stest_tree', cx, cz - 60);
    } else if (!isSpawn) {
      add('stest_tree', cx - 30, cz);
      add('stest_tree', cx + 30, cz);
    } else {
      add('stest_tree', cx + 55, cz + 55);
    }
    add('stest_car', cx, cz - BLOCK / 2 - 8, 0);
  }
  window.__cityTestPropCount = n;
}

registerLevel({
  id: 'city-test',
  name: 'City Test',
  sky: 0xa8d8f0,
  fog: [800, 2200],
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
