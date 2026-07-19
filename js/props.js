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
  aptSlice:    { r: 14,  h: 13 },
  aptSliceRoof:{ r: 14,  h: 13 },
  towerSlice:  { r: 15,  h: 16 },
  towerSliceRoof:{ r: 15, h: 16 },
};
// Only the big stuff casts shadows (keeps the framerate healthy).
const SHADOW_CASTERS = new Set(['tree','car','bus','shop','house','apartment','tower','fountain','aptSlice','aptSliceRoof','towerSlice','towerSliceRoof']);
const CAR_COLORS = [0x4f8ae8,0xe85555,0xf0c548,0x9b5ad6,0x48c9a9,0xf2f4f6,0x3d4854];
const SHIRT_COLORS = [0xe85555,0x4f8ae8,0x4fc46a,0xf0a848,0x9b5ad6,0xf2f4f6];
const DOG_COLORS = [0x8a6642,0xf2f4f6,0x3a3a3a,0xc9a578];
const HOUSE_COLORS = ['#f2ead6','#ece4d0','#f0e8d8','#e8dcc8','#f2e8d0','#e8dcc0'];
const ROOF_COLORS = [0xc23a24, 0xd6721f, 0x3568b8, 0x3f9433, 0x7a2f9e];

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
      g.fillStyle = '#fff'; g.fillRect(x-6, y-6, 60, 70);    // white 6px frame
      g.fillStyle = '#4f8ae8'; g.fillRect(x, y, 48, 58);     // brighter blue glass
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
    g.fillStyle = '#3f8fd0'; g.fillRect(0, 0, 256, 512);  // blue glass base
    // Cream mullions and window panes
    for (let y = 8; y < 500; y += 26) for (let x = 8; x < 248; x += 30) {
      const r = Math.random();
      g.fillStyle = r < 0.12 ? '#ffe9a8' : r < 0.5 ? '#6fb4e8' : '#4f96d0';
      g.fillRect(x, y, 24, 20);
    }
    // Cream mullions (~6px) separating panes
    g.strokeStyle = '#ece4d0'; g.lineWidth = 6;
    for (let y = 8; y < 500; y += 26) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    for (let x = 8; x < 248; x += 30) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
    }
    // Solid cream horizontal bands every ~5 rows
    g.fillStyle = '#ece4d0';
    for (let y = 130; y < 512; y += 130) {
      g.fillRect(0, y, 256, 8);
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
      g.fillStyle = '#fff'; g.fillRect(x-3, y-3, 34, 40);      // white frame
      g.fillStyle = Math.random() < 0.2 ? '#ffe9a8' : '#4f8ae8';  // brighter blue
      g.fillRect(x, y, 28, 34);
      g.fillStyle = '#fff'; g.fillRect(x+12, y, 3, 34);
    }
    g.fillStyle = '#fff'; g.fillRect(100, 330, 60, 54);
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
  cream: new THREE.MeshLambertMaterial({ color: 0xece4d0 }),
  white: new THREE.MeshLambertMaterial({ color: 0xf2f4f6 }),
  plinth: new THREE.MeshLambertMaterial({ color: 0x8a8a8a }),
  roofRim: new THREE.MeshLambertMaterial({ color: 0x5a5a5a }),
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
const APT_WALLS = ['#f0e8d8','#ece4d0','#e8dcc8'].map(c =>
  new THREE.MeshLambertMaterial({ map: aptWall(c) }));
const APT_TOP = new THREE.MeshLambertMaterial({ color: 0x8f7864 });

// ---- Palette-aware material caching (built ONCE per level, not per building) -----
// Cache palette materials: built when level is active, reused across all buildings
let paletteHouseWalls = HOUSE_WALLS;
let paletteTowerWalls = TOWER_WALLS;
let paletteShopWalls = SHOP_WALLS;
let paletteAptWalls = APT_WALLS;
let paletteRoof = null;

// Build palette materials ONCE when level's applyEnvironment() is called.
// This replaces the module-level HOUSE_WALLS/SHOP_WALLS/etc. with palette-aware versions.
function rebuildPaletteCache() {
  // Use cached version if no palette
  if (!currentLevel || !currentLevel.palette) {
    paletteHouseWalls = HOUSE_WALLS;
    paletteTowerWalls = TOWER_WALLS;
    paletteShopWalls = SHOP_WALLS;
    paletteAptWalls = APT_WALLS;
    paletteRoof = null;
    return;
  }

  const p = currentLevel.palette;

  // Build house walls ONCE: reuse across all houses
  const houseColor = new THREE.Color(p.primary).getHexString();
  paletteHouseWalls = [{
    side: new THREE.MeshLambertMaterial({ map: houseWall('#' + houseColor, false) }),
    front: new THREE.MeshLambertMaterial({ map: houseWall('#' + houseColor, true) }),
    plain: new THREE.MeshLambertMaterial({ color: p.primary }),
  }];

  // Tower walls: reuse standard set (procedural variation handles theming)
  paletteTowerWalls = TOWER_WALLS;

  // Build shop walls ONCE: reuse across all shops
  const shopColor = new THREE.Color(p.accent1).getHexString();
  paletteShopWalls = [{
    wall: new THREE.MeshLambertMaterial({ map: shopWall('#' + shopColor) }),
    plain: new THREE.MeshLambertMaterial({ color: p.accent1 }),
  }];

  // Build apt walls ONCE: reuse across all apartments
  const aptColor = new THREE.Color(p.primary).getHexString();
  paletteAptWalls = [new THREE.MeshLambertMaterial({ map: aptWall('#' + aptColor) })];

  // Build roof material ONCE: reuse across all roofs
  paletteRoof = new THREE.MeshLambertMaterial({ color: p.accent1 });
}

// Get cached palette materials (called from builders; materials are already built)
function getPaletteHouseWalls() { return paletteHouseWalls; }
function getPaletteTowerWalls() { return paletteTowerWalls; }
function getPaletteShopWalls() { return paletteShopWalls; }
function getPaletteAptWalls() { return paletteAptWalls; }
function getPaletteRoof() {
  // Default roof if no palette: pick from standard colors
  if (!paletteRoof) return new THREE.MeshLambertMaterial({ color: pick(ROOF_COLORS) });
  return paletteRoof;
}

// ---- Prop mesh builders (origin at ground level) -------------------------------
const PROP_SEG = () => (typeof GFX !== 'undefined' ? GFX.propSeg : 8);

function part(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
}

// ---- Geometry merge / draw-call reduction ------------------------------------
// Each prop used to be a Group of many Mesh children (person=5, tree=4, car=8…).
// 2000 props × ~6 meshes ≈ 12k draw calls — death on iPad. Merge same-material
// parts into one BufferGeometry so most props become 1–3 draw calls.
function _mergeGeometries(geos) {
  if (!geos.length) return null;
  if (geos.length === 1) return geos[0];

  const prepared = [];
  let total = 0;
  let hasNormal = true, hasUV = true;
  for (let i = 0; i < geos.length; i++) {
    let g = geos[i];
    if (!g || !g.attributes || !g.attributes.position) continue;
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) hasNormal = false;
    if (!g.attributes.uv) hasUV = false;
    prepared.push(g);
    total += g.attributes.position.count;
  }
  if (!prepared.length) return null;
  if (prepared.length === 1) return prepared[0];

  const pos = new Float32Array(total * 3);
  const nrm = hasNormal ? new Float32Array(total * 3) : null;
  const uv = hasUV ? new Float32Array(total * 2) : null;
  let vo = 0;
  for (let i = 0; i < prepared.length; i++) {
    const g = prepared[i];
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (nrm) nrm.set(g.attributes.normal.array, vo * 3);
    if (uv) uv.set(g.attributes.uv.array, vo * 2);
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nrm) out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  else out.computeVertexNormals();
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

function optimizeProp(root) {
  if (!root) return root;
  // Bake world matrices under a temp parent so local offsets are correct
  root.updateMatrixWorld(true);

  const meshes = [];
  root.traverse(o => { if (o.isMesh && o.geometry) meshes.push(o); });
  if (meshes.length === 0) return root;

  // Single mesh already — just freeze
  if (meshes.length === 1 || !(typeof GFX === 'undefined' || GFX.mergeProps)) {
    root.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = true;
        o.matrixAutoUpdate = false;
        o.updateMatrix();
      }
    });
    root.matrixAutoUpdate = false;
    root.updateMatrix();
    return root;
  }

  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map();   // mat.uuid -> { mat, geos:[] }
  const multi = [];          // multi-material meshes kept separate

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const baked = new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);
    let geo = mesh.geometry.clone();
    geo.applyMatrix4(baked);

    if (Array.isArray(mesh.material)) {
      multi.push({ geo, mat: mesh.material, cast: mesh.castShadow });
      continue;
    }
    const id = mesh.material.uuid;
    if (!byMat.has(id)) byMat.set(id, { mat: mesh.material, geos: [], cast: false });
    const entry = byMat.get(id);
    entry.geos.push(geo);
    entry.cast = entry.cast || mesh.castShadow;
  }

  const out = new THREE.Group();
  byMat.forEach(entry => {
    const merged = _mergeGeometries(entry.geos);
    // Dispose intermediate clones (merged may reuse a single clone)
    for (let i = 0; i < entry.geos.length; i++) {
      if (entry.geos[i] !== merged) entry.geos[i].dispose();
    }
    if (!merged) return;
    const m = new THREE.Mesh(merged, entry.mat);
    m.castShadow = entry.cast;
    m.frustumCulled = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    out.add(m);
  });
  for (let i = 0; i < multi.length; i++) {
    const { geo, mat, cast } = multi[i];
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.frustumCulled = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    out.add(m);
  }

  out.matrixAutoUpdate = false;
  out.updateMatrix();
  return out;
}

// Re-enable matrix updates when a prop starts falling into a hole
function thawProp(mesh) {
  if (!mesh) return;
  mesh.matrixAutoUpdate = true;
  mesh.traverse(o => { if (o.isMesh) o.matrixAutoUpdate = true; });
}

const BUILDERS = {
  person() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(SHIRT_COLORS) });
    const seg = PROP_SEG();
    if (GFX.mobile) {
      // 2 pieces instead of 4 — hundreds of people on every city block
      g.add(part(new THREE.CylinderGeometry(1.5, 1.7, 5.5, seg), shirt, 0, 3.2, 0));
      g.add(part(new THREE.SphereGeometry(1.6, seg, seg - 1), MAT.skin, 0, 7.0, 0));
      return g;
    }
    g.add(part(new THREE.CylinderGeometry(1.3, 1.5, 3.4, seg), MAT.jeans, 0, 1.7, 0));
    g.add(part(new THREE.CylinderGeometry(1.7, 1.9, 3.8, seg), shirt, 0, 5.2, 0));
    g.add(part(new THREE.SphereGeometry(1.6, seg + 2, seg), MAT.skin, 0, 8.3, 0));
    const hairM = part(new THREE.SphereGeometry(1.65, seg + 2, seg - 1), MAT.hair, 0, 8.6, -0.15);
    hairM.scale.y = 0.62; g.add(hairM);
    return g;
  },
  dog() {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: pick(DOG_COLORS) });
    if (GFX.mobile) {
      g.add(part(new THREE.BoxGeometry(5, 2.4, 2.2), fur, 0, 2.2, 0));
      g.add(part(new THREE.BoxGeometry(2, 2, 1.9), fur, 3.1, 3.4, 0));
      return g;
    }
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
    // Try to use the firehydrant model (scale height to ≈ 6)
    const modelCloned = modelClone('firehydrant', 6, 'y');
    if (modelCloned) {
      // Ensure it's grounded
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural hydrant
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
    // Try to use a random trash model (trash_A/trash_B/dumpster, scale height to ≈ 6)
    const trashModels = ['trash_A', 'trash_B', 'dumpster'];
    const modelKey = pick(trashModels);
    const modelCloned = modelClone(modelKey, 6, 'y');
    if (modelCloned) {
      // Ensure it's grounded
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural trashcan
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(2.2, 1.9, 5.5, 10), MAT.dark, 0, 2.75, 0));
    g.add(part(new THREE.CylinderGeometry(2.4, 2.4, 0.8, 10), MAT.metal, 0, 5.9, 0));
    return g;
  },
  cone() {
    const g = new THREE.Group();
    const seg = PROP_SEG();
    g.add(part(new THREE.ConeGeometry(2.8, 8.5, seg + 2), MAT.cone, 0, 4.6, 0));
    if (!GFX.mobile)
      g.add(part(new THREE.CylinderGeometry(2.1, 2.3, 1.4, seg + 2), MAT.coneW, 0, 4.2, 0));
    g.add(part(new THREE.BoxGeometry(6.4, 0.8, 6.4), MAT.cone, 0, 0.4, 0));
    return g;
  },
  streetlight() {
    // Try to use the streetlight model (scale height to ≈ 24)
    const modelCloned = modelClone('streetlight', 24, 'y');
    if (modelCloned) {
      // Ensure it's grounded
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural streetlight
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(1.2, 1.4, 1, 8), MAT.dark, 0, 0.5, 0));
    g.add(part(new THREE.CylinderGeometry(0.6, 0.8, 24, 8), MAT.dark, 0, 12, 0));
    const arm = part(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), MAT.dark, 4, 24.4, 0);
    arm.rotation.z = Math.PI/2; g.add(arm);
    g.add(part(new THREE.BoxGeometry(3.4, 1.2, 2), MAT.lamp, 7, 23.8, 0));
    return g;
  },
  bench() {
    // Try to use the bench model (scale length to ≈ 11)
    const modelCloned = modelClone('bench', 11, 'max_xz');
    if (modelCloned) {
      // Ensure it's grounded
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural bench
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
    // Try to use the bush model (scale width to ≈ 10)
    const modelCloned = modelClone('bush', 10, 'max_xz');
    if (modelCloned) {
      // Ensure it's grounded
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural bush
    const g = new THREE.Group();
    const seg = PROP_SEG();
    g.add(part(new THREE.SphereGeometry(5.2, seg, seg - 1), MAT.bush, 0, 3.8, 0));
    if (!GFX.mobile) {
      g.add(part(new THREE.SphereGeometry(3.4, seg, seg - 1), MAT.bush, 4, 2.6, 1.5));
      g.add(part(new THREE.SphereGeometry(2.8, seg, seg - 1), MAT.bush, -3.5, 2.4, -1.5));
    }
    return g;
  },
  fountain() {
    const g = new THREE.Group();
    const seg = PROP_SEG();
    g.add(part(new THREE.CylinderGeometry(9, 9.5, 3, seg + 2), MAT.stone, 0, 1.5, 0));
    g.add(part(new THREE.CylinderGeometry(1.4, 1.8, 8, seg), MAT.stone, 0, 6, 0));
    if (!GFX.mobile) {
      g.add(part(new THREE.CylinderGeometry(8, 8, 0.8, seg + 2), MAT.glass, 0, 3.2, 0));
      g.add(part(new THREE.CylinderGeometry(3.4, 3.8, 1.2, seg + 1), MAT.stone, 0, 10, 0));
      g.add(part(new THREE.SphereGeometry(1.8, seg, seg - 1), MAT.glass, 0, 11, 0));
    } else {
      g.add(part(new THREE.SphereGeometry(2.2, seg, seg - 1), MAT.glass, 0, 10, 0));
    }
    return g;
  },
  tree() {
    const g = new THREE.Group();
    const seg = PROP_SEG();
    if (GFX.mobile) {
      // trunk + one canopy (was 4 meshes)
      g.add(part(new THREE.CylinderGeometry(1.6, 2.4, 13, seg), MAT.trunk, 0, 6.5, 0));
      if (Math.random() < 0.5)
        g.add(part(new THREE.SphereGeometry(9, seg, seg - 1), MAT.leafA, 0, 18, 0));
      else
        g.add(part(new THREE.ConeGeometry(9, 22, seg), MAT.leafB, 0, 20, 0));
      return g;
    }
    if (Math.random() < 0.5) {                        // round leafy tree
      g.add(part(new THREE.CylinderGeometry(1.6, 2.4, 13, seg), MAT.trunk, 0, 6.5, 0));
      g.add(part(new THREE.SphereGeometry(8.5, seg + 1, seg), MAT.leafA, 0, 18, 0));
      g.add(part(new THREE.SphereGeometry(6, seg + 1, seg), MAT.leafA, 3, 24, 2));
      g.add(part(new THREE.SphereGeometry(5, seg + 1, seg), MAT.leafA, -4, 22, -2));
    } else {                                          // pine
      g.add(part(new THREE.CylinderGeometry(1.5, 2.2, 12, seg), MAT.trunk, 0, 6, 0));
      g.add(part(new THREE.ConeGeometry(9, 15, seg + 1), MAT.leafB, 0, 17, 0));
      g.add(part(new THREE.ConeGeometry(7, 13, seg + 1), MAT.leafB, 0, 25, 0));
      g.add(part(new THREE.ConeGeometry(4.5, 10, seg + 1), MAT.leafB, 0, 32, 0));
    }
    return g;
  },
  car() {
    // Try to use a random car model (scale to horizontal len ≈ 20)
    const carModels = ['car_sedan', 'car_taxi', 'car_police', 'car_hatchback', 'car_stationwagon'];
    const modelKey = pick(carModels);
    // For cars, use max of x and z as the footprint length
    const modelCloned = modelClone(modelKey, 20, 'max_xz');
    if (modelCloned) {
      // Ensure it's grounded (bbox.min.y === 0)
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural car (mobile: body+cabin only, no wheels)
    const g = new THREE.Group();
    const body = new THREE.MeshLambertMaterial({ color: pick(CAR_COLORS) });
    g.add(part(new THREE.BoxGeometry(20, 5, 10), body, 0, 4.2, 0));
    g.add(part(new THREE.BoxGeometry(10, 4.2, 8.8), MAT.glass, -1, 8.2, 0));
    if (!GFX.mobile) {
      g.add(part(new THREE.BoxGeometry(20.4, 1.2, 10.4), MAT.dark, 0, 2, 0));
      g.add(part(new THREE.BoxGeometry(10.4, 0.8, 9.2), body, -1, 10.2, 0));
      const wheel = new THREE.CylinderGeometry(2, 2, 1.6, PROP_SEG());
      for (const [wx, wz] of [[-6,5],[6,5],[-6,-5],[6,-5]]) {
        const w = part(wheel, MAT.tire, wx, 2, wz);
        w.rotation.x = Math.PI/2; g.add(w);
      }
    }
    return g;
  },
  bus() {
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: 0xf0a830 });
    g.add(part(new THREE.BoxGeometry(34, 10, 11), paint, 0, 7.2, 0));
    g.add(part(new THREE.BoxGeometry(34.4, 3.2, 11.4), MAT.glass, 0, 9.6, 0));
    if (!GFX.mobile) {
      g.add(part(new THREE.BoxGeometry(34.4, 1, 11.4), MAT.dark, 0, 2.6, 0));
      const wheel = new THREE.CylinderGeometry(2.2, 2.2, 1.8, PROP_SEG());
      for (const [wx, wz] of [[-11,5.5],[11,5.5],[-11,-5.5],[11,-5.5]]) {
        const w = part(wheel, MAT.tire, wx, 2.2, wz);
        w.rotation.x = Math.PI/2; g.add(w);
      }
    }
    return g;
  },
  shop() {
    // Try to use a random shop model (A/B/C, scale footprint width to ≈ 26)
    const shopModels = ['building_A', 'building_B', 'building_C'];
    const modelKey = pick(shopModels);
    const modelCloned = modelClone(modelKey, 26, 'max_xz');
    if (modelCloned) {
      // Ensure it's grounded
      const box = new THREE.Box3().setFromObject(modelCloned);
      if (box.min.y !== 0) modelCloned.position.y -= box.min.y;
      return modelCloned;
    }
    // Fallback: original procedural shop
    const g = new THREE.Group();
    const v = pick(getPaletteShopWalls());
    const box = new THREE.Mesh(new THREE.BoxGeometry(26, 20, 26),
      [v.wall, v.wall, v.plain, v.plain, v.wall, v.wall]);
    box.position.y = 10; g.add(box);
    g.add(part(new THREE.BoxGeometry(28, 2.5, 6), MAT.red, 0, 16.5, 14));
    g.add(part(new THREE.BoxGeometry(28, 1.5, 28), MAT.dark, 0, 20.7, 0));
    return g;
  },
  house() {
    const g = new THREE.Group();
    const v = pick(getPaletteHouseWalls());
    // Mobile: single material body (1 draw call) instead of 6 face materials
    if (GFX.mobile) {
      g.add(part(new THREE.BoxGeometry(34, 28, 34), v.front, 0, 14, 0));
      g.add(part(new THREE.BoxGeometry(38, 10, 38), getPaletteRoof(), 0, 32, 0));
      return g;
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(34, 28, 34),
      [v.side, v.side, v.plain, v.plain, v.front, v.side]);
    box.position.y = 14; g.add(box);

    // Gray plinth base
    g.add(part(new THREE.BoxGeometry(38, 2, 38), MAT.plinth, 0, 1, 0));

    // Gable roof: triangular prism using CylinderGeometry with 3 sides
    // Radius 23 gives triangle base ~40 (roof overhang), scaled for height ~14
    const roofMat = getPaletteRoof();
    const creamMat = new THREE.MeshLambertMaterial({ color: 0xece4d0 });
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(23, 23, 40, 3),
      [roofMat, creamMat, creamMat]  // [side, topCap, bottomCap]
    );
    roof.rotation.x = Math.PI / 2;
    roof.scale.y = 0.35;
    roof.position.set(0, 34, 0);
    g.add(roof);

    // White/cream chimney with darker top rim
    g.add(part(new THREE.BoxGeometry(4, 12, 4), MAT.white, 9, 36, -8));
    g.add(part(new THREE.BoxGeometry(5, 1, 5), MAT.roofRim, 9, 42.5, -8));  // top rim

    return g;
  },
  apartment() {
    // Try to use a random apartment model (D..H, scale height to ≈ 60, cap horz to ~40)
    const aptModels = ['building_D', 'building_E', 'building_F', 'building_G', 'building_H'];
    const modelKey = pick(aptModels);
    // First scale to height 60
    const modelCloned = modelClone(modelKey, 60, 'y');
    if (modelCloned) {
      // Check if horizontal exceeds cap and scale down if needed
      const box = new THREE.Box3().setFromObject(modelCloned);
      const horzSize = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      if (horzSize > 40) {
        const horzScale = 40 / horzSize;
        modelCloned.scale.x *= horzScale;
        modelCloned.scale.z *= horzScale;
      }
      // Ensure it's grounded
      const finalBox = new THREE.Box3().setFromObject(modelCloned);
      if (finalBox.min.y !== 0) modelCloned.position.y -= finalBox.min.y;
      return modelCloned;
    }
    // Fallback: original procedural apartment
    const g = new THREE.Group();
    const wall = pick(getPaletteAptWalls());
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 60, 40),
      [wall, wall, APT_TOP, APT_TOP, wall, wall]);
    box.position.y = 30; g.add(box);
    g.add(part(new THREE.BoxGeometry(42, 2.5, 42), MAT.dark, 0, 61, 0));
    g.add(part(new THREE.BoxGeometry(8, 4, 6), MAT.metal, -8, 64, 4));
    return g;
  },
  tower() {
    const g = new THREE.Group();
    const wall = pick(getPaletteTowerWalls());

    // Bottom tier: 52 width, ~58 height
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(52, 58, 52),
      [wall, wall, TOWER_TOP, TOWER_TOP, wall, wall]);
    box1.position.y = 29; g.add(box1);

    // Cream cornice slab at bottom tier top
    g.add(part(new THREE.BoxGeometry(55, 2, 55), MAT.cream, 0, 60, 0));

    // Middle tier: ~42 width, ~30 height
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(42, 30, 42),
      [wall, wall, TOWER_TOP, TOWER_TOP, wall, wall]);
    box2.position.y = 75; g.add(box2);

    // Cream cornice slab at middle tier top
    g.add(part(new THREE.BoxGeometry(45, 2, 45), MAT.cream, 0, 90, 0));

    // Top tier: ~30 width, ~15 height
    const box3 = new THREE.Mesh(new THREE.BoxGeometry(30, 15, 30),
      [wall, wall, TOWER_TOP, TOWER_TOP, wall, wall]);
    box3.position.y = 97.5; g.add(box3);

    // Cream cornice slab at top tier top
    g.add(part(new THREE.BoxGeometry(33, 2, 33), MAT.cream, 0, 105, 0));

    // Small cap box + thin spire
    g.add(part(new THREE.BoxGeometry(8, 2, 8), MAT.cream, 0, 108, 0));
    g.add(part(new THREE.CylinderGeometry(0.8, 0.8, 18, 8), MAT.cream, 0, 117, 0));

    return g;
  },
  aptSlice() {
    const g = new THREE.Group();
    const wall = pick(getPaletteAptWalls());
    const box = new THREE.Mesh(new THREE.BoxGeometry(28, 13, 28),
      [wall, wall, APT_TOP, APT_TOP, wall, wall]);
    box.position.y = 6.5; g.add(box);
    return g;
  },
  aptSliceRoof() {
    const g = new THREE.Group();
    const wall = pick(getPaletteAptWalls());
    const box = new THREE.Mesh(new THREE.BoxGeometry(28, 13, 28),
      [wall, wall, APT_TOP, APT_TOP, wall, wall]);
    box.position.y = 6.5; g.add(box);
    // Thin dark parapet slab at top
    g.add(part(new THREE.BoxGeometry(30, 1.5, 30), MAT.dark, 0, 13.75, 0));
    // Small metal AC box
    g.add(part(new THREE.BoxGeometry(4, 3, 4), MAT.metal, -8, 16, 4));
    return g;
  },
  towerSlice() {
    const g = new THREE.Group();
    const wall = pick(getPaletteTowerWalls());
    const box = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30),
      [wall, wall, TOWER_TOP, TOWER_TOP, wall, wall]);
    box.position.y = 8; g.add(box);
    return g;
  },
  towerSliceRoof() {
    const g = new THREE.Group();
    const wall = pick(getPaletteTowerWalls());
    const box = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30),
      [wall, wall, TOWER_TOP, TOWER_TOP, wall, wall]);
    box.position.y = 8; g.add(box);
    // Cream cap slab at top
    g.add(part(new THREE.BoxGeometry(32, 1.5, 32), MAT.cream, 0, 16.75, 0));
    // Thin antenna
    g.add(part(new THREE.CylinderGeometry(0.7, 0.7, 10, 8), MAT.cream, 0, 22, 0));
    return g;
  },
};

// Spawn one prop into the world (levels call this from populate()).
function addProp(name, x, z, rotY, opts) {
  const s = STATS[name];
  if (!s || !BUILDERS[name]) {
    console.warn('[props] unknown prop', name);
    return;
  }
  // Thin clutter on tablet — keeps skyline, drops most people/trash/etc.
  if (GFX.lowEnd && CLUTTER_PROPS[name] && Math.random() > GFX.clutterKeep) return;

  let mesh = BUILDERS[name]();
  const rot = rotY !== undefined ? rotY : rand(0, Math.PI * 2);
  // Never set up shadows on low-end
  if (!GFX.lowEnd && SAVE.shadows && SHADOW_CASTERS.has(name))
    mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });

  if (GFX.mergeProps) mesh = optimizeProp(mesh);
  else {
    mesh.traverse(m => {
      if (m.isMesh) {
        m.frustumCulled = true;
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        // Unlit path for tablet: convert Lambert→Basic where easy (no maps with complex lights)
        if (GFX.lowEnd && m.material && m.material.isMeshLambertMaterial && !m.material.map) {
          m.material = new THREE.MeshBasicMaterial({
            color: m.material.color ? m.material.color.getHex() : 0xcccccc,
            fog: false,
          });
        } else if (m.material) {
          m.material.fog = false;
        }
      }
    });
    mesh.matrixAutoUpdate = false;
  }

  const baseY = (opts && opts.y) || 0;
  mesh.position.set(x, baseY, z);
  mesh.rotation.y = rot;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  objects.push({ mesh, x, z, r: s.r, h: s.h, vy: 0,
    falling: false, hole: null, dead: false, name: name, baseY: baseY, stackId: (opts && opts.stackId) || null });
}
