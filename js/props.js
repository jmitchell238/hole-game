// The prop library: stats, materials, textures, and mesh builders for everything
// a hole can swallow. Levels place these with addProp(), and can add their own
// themed props (cactus, igloo, castle wall, …) with registerProp().

// Prop stats: r = footprint radius, h = height.
const STATS = {
  person:      { r: 3.5, h: 10 },
  dog:         { r: 3,   h: 6 },
  mailbox:     { r: 2.5, h: 7 },
  hydrant:     { r: 2.5, h: 6 },
  trashcan:    { r: 2.5, h: 7 },
  cone:        { r: 3,   h: 9 },
  streetlight: { r: 2,   h: 26 },
  bench:       { r: 6,   h: 5 },
  fence:       { r: 7,   h: 7 },
  bush:        { r: 6,   h: 8 },
  fountain:    { r: 9,   h: 12 },
  tree:        { r: 9,   h: 36 },
  car:         { r: 10,  h: 10 },
  bus:         { r: 16,  h: 13 },
  shop:        { r: 14,  h: 24 },
  house:       { r: 18,  h: 45 },
  apartment:   { r: 20,  h: 64 },
  tower:       { r: 28,  h: 112 },
};
// Only the big stuff casts shadows (keeps the framerate healthy).
const SHADOW_CASTERS = new Set(['tree','car','bus','shop','house','apartment','tower','fountain']);
const CAR_COLORS = [0x4f8ae8,0xe85555,0xf0c548,0x9b5ad6,0x48c9a9,0xf2f4f6,0x3d4854];
const SHIRT_COLORS = [0xe85555,0x4f8ae8,0x4fc46a,0xf0a848,0x9b5ad6,0xf2f4f6];
const DOG_COLORS = [0x8a6642,0xf2f4f6,0x3a3a3a,0xc9a578];
const HOUSE_COLORS = ['#e8dcc0','#cfe0ee','#efd8d8','#dfe8cf','#e8e0cf','#d8cfe8'];

// Levels call this to add their own themed props before/inside populate().
function registerProp(name, stats, builder, castsShadow) {
  STATS[name] = stats;
  BUILDERS[name] = builder;
  if (castsShadow) SHADOW_CASTERS.add(name);
}

// ---- Building wall textures -----------------------------------------------------
// House walls: siding with framed windows (and optionally a front door).
function houseWall(base, withDoor) {
  return canvasTex(256, 256, g => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,.08)';                 // siding lines
    for (let y = 12; y < 256; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    const win = (x, y) => {
      g.fillStyle = '#fff'; g.fillRect(x-4, y-4, 56, 66);
      g.fillStyle = '#5a7d9e'; g.fillRect(x, y, 48, 58);
      g.fillStyle = '#fff'; g.fillRect(x+22, y, 4, 58); g.fillRect(x, y+26, 48, 5);
    };
    win(38, 34); win(170, 34);                          // upper floor
    win(38, 152);
    if (withDoor) {
      g.fillStyle = '#fff'; g.fillRect(158, 140, 66, 116);
      g.fillStyle = '#7a4a2b'; g.fillRect(164, 146, 54, 110);
      g.fillStyle = '#e8c86a';
      g.beginPath(); g.arc(210, 205, 4, 0, 7); g.fill();
    } else win(170, 152);
  });
}

// Skyscraper glass: mullioned window grid with a few lit offices.
function towerWall() {
  return canvasTex(256, 512, g => {
    g.fillStyle = '#5d6a75'; g.fillRect(0, 0, 256, 512);
    for (let y = 8; y < 500; y += 26) for (let x = 8; x < 248; x += 30) {
      const r = Math.random();
      g.fillStyle = r < 0.12 ? '#ffe9a8' : r < 0.5 ? '#a7c8de' : '#8fb4cc';
      g.fillRect(x, y, 24, 20);
    }
  });
}

// Shop front: painted wall, big display window, door.
function shopWall(paint) {
  return canvasTex(256, 256, g => {
    g.fillStyle = paint; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff'; g.fillRect(20, 96, 148, 128);
    g.fillStyle = '#bcd8e8'; g.fillRect(28, 104, 132, 112);
    g.fillStyle = '#fff'; g.fillRect(186, 96, 54, 160);
    g.fillStyle = '#4a5560'; g.fillRect(192, 102, 42, 154);
  });
}

// Apartment block: brick mid-rise with a grid of framed windows.
function aptWall(base) {
  return canvasTex(256, 384, g => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 384);
    g.strokeStyle = 'rgba(0,0,0,.1)';
    for (let y = 10; y < 384; y += 12) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    for (let y = 18; y < 340; y += 52) for (let x = 20; x < 236; x += 44) {
      g.fillStyle = '#f2f2f2'; g.fillRect(x-3, y-3, 34, 40);
      g.fillStyle = Math.random() < 0.2 ? '#ffe9a8' : '#7a9cb8';
      g.fillRect(x, y, 28, 34);
      g.fillStyle = '#f2f2f2'; g.fillRect(x+12, y, 3, 34);
    }
    g.fillStyle = '#f2f2f2'; g.fillRect(100, 330, 60, 54);
    g.fillStyle = '#4a3a2a'; g.fillRect(106, 336, 48, 48);
  });
}

// ---- Shared materials -----------------------------------------------------------
const MAT = {
  trunk: new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
  leafA: new THREE.MeshLambertMaterial({ color: 0x4a9e3f }),
  leafB: new THREE.MeshLambertMaterial({ color: 0x2e8b57 }),
  bush:  new THREE.MeshLambertMaterial({ color: 0x53b04a }),
  skin:  new THREE.MeshLambertMaterial({ color: 0xe8b48e }),
  hair:  new THREE.MeshLambertMaterial({ color: 0x4a3320 }),
  jeans: new THREE.MeshLambertMaterial({ color: 0x4a5d7a }),
  cone:  new THREE.MeshLambertMaterial({ color: 0xf08030 }),
  coneW: new THREE.MeshLambertMaterial({ color: 0xf2f4f6 }),
  roof:  new THREE.MeshLambertMaterial({ color: 0x9e4632 }),
  glass: new THREE.MeshLambertMaterial({ color: 0xbcd8e8 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x5a6570 }),
  dark:  new THREE.MeshLambertMaterial({ color: 0x3a4048 }),
  red:   new THREE.MeshLambertMaterial({ color: 0xd84040 }),
  wood:  new THREE.MeshLambertMaterial({ color: 0xc8b088 }),
  lamp:  new THREE.MeshLambertMaterial({ color: 0xffe9a8 }),
  tire:  new THREE.MeshLambertMaterial({ color: 0x2a2e33 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x9aa2a8 }),
  mail:  new THREE.MeshLambertMaterial({ color: 0x3a6fd8 }),
};
// Pre-built wall texture variants (shared across buildings).
const HOUSE_WALLS = HOUSE_COLORS.map(c => ({
  side: new THREE.MeshLambertMaterial({ map: houseWall(c, false) }),
  front: new THREE.MeshLambertMaterial({ map: houseWall(c, true) }),
  plain: new THREE.MeshLambertMaterial({ color: c }),
}));
const TOWER_WALLS = [0,1,2].map(() => new THREE.MeshLambertMaterial({ map: towerWall() }));
const TOWER_TOP = new THREE.MeshLambertMaterial({ color: 0x6b7680 });
const SHOP_WALLS = ['#d8896a','#7aa8c8','#8fbf8a','#c8a05a'].map(c => ({
  wall: new THREE.MeshLambertMaterial({ map: shopWall(c) }),
  plain: new THREE.MeshLambertMaterial({ color: c }),
}));
const APT_WALLS = ['#c08868','#a8927a','#b87a6a'].map(c =>
  new THREE.MeshLambertMaterial({ map: aptWall(c) }));
const APT_TOP = new THREE.MeshLambertMaterial({ color: 0x8f7864 });

// ---- Prop mesh builders (origin at ground level) -------------------------------
function part(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
}
const BUILDERS = {
  person() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(SHIRT_COLORS) });
    g.add(part(new THREE.CylinderGeometry(1.3, 1.5, 3.4, 8), MAT.jeans, 0, 1.7, 0));
    g.add(part(new THREE.CylinderGeometry(1.7, 1.9, 3.8, 8), shirt, 0, 5.2, 0));
    g.add(part(new THREE.SphereGeometry(1.6, 10, 8), MAT.skin, 0, 8.3, 0));
    const hairM = part(new THREE.SphereGeometry(1.65, 10, 6), MAT.hair, 0, 8.6, -0.15);
    hairM.scale.y = 0.62; g.add(hairM);
    return g;
  },
  dog() {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: pick(DOG_COLORS) });
    g.add(part(new THREE.BoxGeometry(5, 2.4, 2.2), fur, 0, 2.6, 0));
    g.add(part(new THREE.BoxGeometry(2, 2, 1.9), fur, 3.1, 4, 0));
    g.add(part(new THREE.BoxGeometry(1, 0.9, 1.2), MAT.dark, 4.4, 3.6, 0));
    for (const [lx, lz] of [[-1.8,0.7],[1.8,0.7],[-1.8,-0.7],[1.8,-0.7]])
      g.add(part(new THREE.BoxGeometry(0.7, 1.6, 0.7), fur, lx, 0.8, lz));
    const tail = part(new THREE.BoxGeometry(1.8, 0.6, 0.6), fur, -3, 3.6, 0);
    tail.rotation.z = 0.6; g.add(tail);
    return g;
  },
  mailbox() {
    const g = new THREE.Group();
    g.add(part(new THREE.BoxGeometry(1.2, 4, 1.2), MAT.dark, 0, 2, 0));
    g.add(part(new THREE.BoxGeometry(4.4, 3, 3), MAT.mail, 0, 5.3, 0));
    return g;
  },
  hydrant() {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(2.2, 2.5, 1, 10), MAT.metal, 0, 0.5, 0));
    g.add(part(new THREE.CylinderGeometry(1.6, 1.9, 4, 10), MAT.red, 0, 3, 0));
    g.add(part(new THREE.SphereGeometry(1.5, 10, 8), MAT.red, 0, 5.2, 0));
    g.add(part(new THREE.CylinderGeometry(0.7, 0.7, 4.6, 8), MAT.red, 0, 3.4, 0));
    const arm = part(new THREE.CylinderGeometry(0.7, 0.7, 4.6, 8), MAT.red, 0, 3.4, 0);
    arm.rotation.z = Math.PI/2; g.add(arm);
    return g;
  },
  trashcan() {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(2.2, 1.9, 5.5, 10), MAT.dark, 0, 2.75, 0));
    g.add(part(new THREE.CylinderGeometry(2.4, 2.4, 0.8, 10), MAT.metal, 0, 5.9, 0));
    return g;
  },
  cone() {
    const g = new THREE.Group();
    g.add(part(new THREE.ConeGeometry(2.8, 8.5, 12), MAT.cone, 0, 4.6, 0));
    g.add(part(new THREE.CylinderGeometry(2.1, 2.3, 1.4, 12), MAT.coneW, 0, 4.2, 0));
    g.add(part(new THREE.BoxGeometry(6.4, 0.8, 6.4), MAT.cone, 0, 0.4, 0));
    return g;
  },
  streetlight() {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(1.2, 1.4, 1, 8), MAT.dark, 0, 0.5, 0));
    g.add(part(new THREE.CylinderGeometry(0.6, 0.8, 24, 8), MAT.dark, 0, 12, 0));
    const arm = part(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), MAT.dark, 4, 24.4, 0);
    arm.rotation.z = Math.PI/2; g.add(arm);
    g.add(part(new THREE.BoxGeometry(3.4, 1.2, 2), MAT.lamp, 7, 23.8, 0));
    return g;
  },
  bench() {
    const g = new THREE.Group();
    g.add(part(new THREE.BoxGeometry(11, 1, 3.5), MAT.wood, 0, 2.5, 0));
    g.add(part(new THREE.BoxGeometry(11, 3.5, 1), MAT.wood, 0, 4.2, -1.6));
    g.add(part(new THREE.BoxGeometry(1, 2.5, 3.5), MAT.dark, -4.5, 1.2, 0));
    g.add(part(new THREE.BoxGeometry(1, 2.5, 3.5), MAT.dark, 4.5, 1.2, 0));
    return g;
  },
  fence() {
    const g = new THREE.Group();
    g.add(part(new THREE.BoxGeometry(24, 1, 0.8), MAT.wood, 0, 4.5, 0));
    g.add(part(new THREE.BoxGeometry(24, 1, 0.8), MAT.wood, 0, 2.5, 0));
    for (const px of [-11, 0, 11])
      g.add(part(new THREE.BoxGeometry(1.4, 6.5, 1.4), MAT.wood, px, 3.2, 0));
    return g;
  },
  bush() {
    const g = new THREE.Group();
    g.add(part(new THREE.SphereGeometry(5.2, 9, 7), MAT.bush, 0, 3.8, 0));
    g.add(part(new THREE.SphereGeometry(3.4, 9, 7), MAT.bush, 4, 2.6, 1.5));
    g.add(part(new THREE.SphereGeometry(2.8, 9, 7), MAT.bush, -3.5, 2.4, -1.5));
    return g;
  },
  fountain() {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(9, 9.5, 3, 16), MAT.stone, 0, 1.5, 0));
    g.add(part(new THREE.CylinderGeometry(8, 8, 0.8, 16), MAT.glass, 0, 3.2, 0));
    g.add(part(new THREE.CylinderGeometry(1.4, 1.8, 8, 8), MAT.stone, 0, 6, 0));
    g.add(part(new THREE.CylinderGeometry(3.4, 3.8, 1.2, 12), MAT.stone, 0, 10, 0));
    g.add(part(new THREE.SphereGeometry(1.8, 8, 6), MAT.glass, 0, 11, 0));
    return g;
  },
  tree() {
    const g = new THREE.Group();
    if (Math.random() < 0.5) {                        // round leafy tree
      g.add(part(new THREE.CylinderGeometry(1.6, 2.4, 13, 7), MAT.trunk, 0, 6.5, 0));
      g.add(part(new THREE.SphereGeometry(8.5, 9, 7), MAT.leafA, 0, 18, 0));
      g.add(part(new THREE.SphereGeometry(6, 9, 7), MAT.leafA, 3, 24, 2));
      g.add(part(new THREE.SphereGeometry(5, 9, 7), MAT.leafA, -4, 22, -2));
    } else {                                          // pine
      g.add(part(new THREE.CylinderGeometry(1.5, 2.2, 12, 7), MAT.trunk, 0, 6, 0));
      g.add(part(new THREE.ConeGeometry(9, 15, 9), MAT.leafB, 0, 17, 0));
      g.add(part(new THREE.ConeGeometry(7, 13, 9), MAT.leafB, 0, 25, 0));
      g.add(part(new THREE.ConeGeometry(4.5, 10, 9), MAT.leafB, 0, 32, 0));
    }
    return g;
  },
  car() {
    const g = new THREE.Group();
    const body = new THREE.MeshLambertMaterial({ color: pick(CAR_COLORS) });
    g.add(part(new THREE.BoxGeometry(20, 5, 10), body, 0, 4.2, 0));
    g.add(part(new THREE.BoxGeometry(20.4, 1.2, 10.4), MAT.dark, 0, 2, 0));
    const cabin = part(new THREE.BoxGeometry(10, 4.2, 8.8), MAT.glass, -1, 8.2, 0);
    g.add(cabin);
    g.add(part(new THREE.BoxGeometry(10.4, 0.8, 9.2), body, -1, 10.2, 0));
    const wheel = new THREE.CylinderGeometry(2, 2, 1.6, 12);
    for (const [wx, wz] of [[-6,5],[6,5],[-6,-5],[6,-5]]) {
      const w = part(wheel, MAT.tire, wx, 2, wz);
      w.rotation.x = Math.PI/2; g.add(w);
    }
    return g;
  },
  bus() {
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: 0xf0a830 });
    g.add(part(new THREE.BoxGeometry(34, 10, 11), paint, 0, 7.2, 0));
    g.add(part(new THREE.BoxGeometry(34.4, 3.2, 11.4), MAT.glass, 0, 9.6, 0));
    g.add(part(new THREE.BoxGeometry(34.4, 1, 11.4), MAT.dark, 0, 2.6, 0));
    const wheel = new THREE.CylinderGeometry(2.2, 2.2, 1.8, 12);
    for (const [wx, wz] of [[-11,5.5],[11,5.5],[-11,-5.5],[11,-5.5]]) {
      const w = part(wheel, MAT.tire, wx, 2.2, wz);
      w.rotation.x = Math.PI/2; g.add(w);
    }
    return g;
  },
  shop() {
    const g = new THREE.Group();
    const v = pick(SHOP_WALLS);
    const box = new THREE.Mesh(new THREE.BoxGeometry(26, 20, 26),
      [v.wall, v.wall, v.plain, v.plain, v.wall, v.wall]);
    box.position.y = 10; g.add(box);
    g.add(part(new THREE.BoxGeometry(28, 2.5, 6), MAT.red, 0, 16.5, 14));
    g.add(part(new THREE.BoxGeometry(28, 1.5, 28), MAT.dark, 0, 20.7, 0));
    return g;
  },
  house() {
    const g = new THREE.Group();
    const v = pick(HOUSE_WALLS);
    const box = new THREE.Mesh(new THREE.BoxGeometry(34, 28, 34),
      [v.side, v.side, v.plain, v.plain, v.front, v.side]);
    box.position.y = 14; g.add(box);
    const roof = part(new THREE.ConeGeometry(27, 17, 4), MAT.roof, 0, 36.5, 0);
    roof.rotation.y = Math.PI/4; g.add(roof);
    g.add(part(new THREE.BoxGeometry(4, 12, 4), MAT.stone, 9, 38, -8));
    return g;
  },
  apartment() {
    const g = new THREE.Group();
    const wall = pick(APT_WALLS);
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 60, 40),
      [wall, wall, APT_TOP, APT_TOP, wall, wall]);
    box.position.y = 30; g.add(box);
    g.add(part(new THREE.BoxGeometry(42, 2.5, 42), MAT.dark, 0, 61, 0));
    g.add(part(new THREE.BoxGeometry(8, 4, 6), MAT.metal, -8, 64, 4));
    return g;
  },
  tower() {
    const g = new THREE.Group();
    const wall = pick(TOWER_WALLS);
    const box = new THREE.Mesh(new THREE.BoxGeometry(52, 106, 52),
      [wall, wall, TOWER_TOP, TOWER_TOP, wall, wall]);
    box.position.y = 53; g.add(box);
    g.add(part(new THREE.BoxGeometry(55, 3, 55), MAT.dark, 0, 107.5, 0));
    g.add(part(new THREE.BoxGeometry(10, 5, 8), MAT.metal, 8, 111, 6));
    return g;
  },
};

// Spawn one prop into the world (levels call this from populate()).
function addProp(name, x, z, rotY) {
  const s = STATS[name];
  const mesh = BUILDERS[name]();
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotY !== undefined ? rotY : rand(0, Math.PI*2);
  if (SHADOW_CASTERS.has(name))
    mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });
  scene.add(mesh);
  objects.push({ mesh, x, z, r: s.r, h: s.h, vy: 0,
    falling: false, hole: null, dead: false });
}
