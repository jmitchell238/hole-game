// Everything about the holes themselves: the visible pit, creating/removing a
// hole, movement, and the grow/eat math.

// The pit inside every hole: soil at the rim fading to black, with a
// black floor far below so falling objects sink out of sight naturally.
// Fewer segments on tablets — same look at game camera distances.
const HOLE_SEG = (typeof GFX !== 'undefined' && GFX.lowEnd) ? 12 : 32;
const PIT_GEO = new THREE.CylinderGeometry(1, 1, HOLE_DEPTH, HOLE_SEG, 1, true);
const CAP_GEO = new THREE.CircleGeometry(1, HOLE_SEG);
const CAP_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
let PIT_MAT = null;

// Rebuild the pit-wall material with the active level's soil colors
// (dirt for the city, sand for a desert, snow for winter, …).
function setPitStyle(level) {
  const soil = level.soil || ['#4a4038', '#241f1a'];
  const pitTex = canvasTex(4, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, soil[0]);
    gr.addColorStop(0.18, soil[1]);
    gr.addColorStop(0.55, '#000000');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  });
  if (PIT_MAT) {
    if (PIT_MAT.map) PIT_MAT.map.dispose();
    PIT_MAT.dispose();
  }
  PIT_MAT = new THREE.MeshBasicMaterial(
    { map: pitTex, side: THREE.BackSide, fog: false });
}

// A tinted pit wall for the player's equipped Store color.
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n>>16 & 255) * f)|0, g = ((n>>8 & 255) * f)|0, b = ((n & 255) * f)|0;
  return `rgb(${r},${g},${b})`;
}
function customPitMaterial(hex) {
  const tex = canvasTex(4, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, shadeHex(hex, 0.9));
    gr.addColorStop(0.2, shadeHex(hex, 0.35));
    gr.addColorStop(0.6, '#000000');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  });
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
}

function makeHole(x, z, name, isPlayer) {
  // The player's hole wears the equipped Store cosmetics.
  let ringColor = 0xc0392b, tagColor = '#fff', pitMat = PIT_MAT, deco = null;
  if (isPlayer) {
    const col = equippedColor();
    ringColor = parseInt(col.hex.slice(1), 16);
    tagColor = col.hex;
    if (col.id !== 'emerald') pitMat = customPitMaterial(col.hex);
    const design = equippedDesign();
    if (design) { deco = design.build(); scene.add(deco); }
  } else {
    // Bot holes: pick random color and 55% chance for a design
    const col = HOLE_COLORS[Math.floor(Math.random() * HOLE_COLORS.length)];
    ringColor = parseInt(col.hex.slice(1), 16);
    tagColor = col.hex;
    if (col.id !== 'emerald') pitMat = customPitMaterial(col.hex);
    // Skip fancy bot cosmetics on tablet — extra meshes for free
    if (!GFX.lowEnd && Math.random() < 0.55) {
      const designEntry = HOLE_DESIGNS[Math.floor(Math.random() * HOLE_DESIGNS.length)];
      deco = designEntry.build();
      scene.add(deco);
    }
  }
  // Pit walls + floor (shared unit geos, scaled by r in syncHole)
  const wall = new THREE.Mesh(PIT_GEO, pitMat);
  wall.position.set(x, -HOLE_DEPTH / 2, z);
  const cap = new THREE.Mesh(CAP_GEO, CAP_MAT);
  cap.rotation.x = -Math.PI / 2; cap.position.set(x, -HOLE_DEPTH + 1, z);

  // Black mouth disc covers the solid ground plane where the hole is.
  // (Cheaper than cutting ShapeGeometry or a full-screen discard shader.)
  const mouth = new THREE.Mesh(
    CAP_GEO,
    new THREE.MeshBasicMaterial({ color: 0x050505, fog: false }));
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.set(x, 0.04, z);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.06, HOLE_SEG),
    new THREE.MeshBasicMaterial({ color: ringColor, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.22, z);
  scene.add(wall); scene.add(cap); scene.add(mouth); scene.add(ring);

  // Ghost ring (desktop only — depthTest:false is costly on A9X)
  let ghost = null;
  if (isPlayer && !GFX.lowEnd) {
    ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.06, HOLE_SEG),
      new THREE.MeshBasicMaterial({
        color: ringColor, transparent: true, opacity: 0.3,
        depthTest: false, depthWrite: false, fog: false,
      }));
    ghost.rotation.x = -Math.PI / 2;
    ghost.position.set(x, 0.28, z);
    ghost.renderOrder = 999;
    scene.add(ghost);
  }

  const tag = document.createElement('div');
  tag.className = 'tag'; tag.textContent = name;
  tag.style.color = tagColor;
  document.getElementById('tags').appendChild(tag);
  return { wall, cap, mouth, ring, ghost, tag, deco, x, z, r: 12, name, isPlayer,
    tx: x, tz: z, retarget: 0, _ringLv: 1, _ringJitter: Math.random() * 0.06,
    customPit: pitMat === PIT_MAT ? null : pitMat };
}

function removeHole(h) {
  scene.remove(h.wall); scene.remove(h.cap); scene.remove(h.ring);
  if (h.mouth) scene.remove(h.mouth);
  if (h.ghost) {
    scene.remove(h.ghost);
    if (h.ghost.geometry) h.ghost.geometry.dispose();
    if (h.ghost.material) h.ghost.material.dispose();
  }
  if (h.deco) {
    scene.remove(h.deco);
    h.deco.traverse(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material && mesh.material.map) {
        mesh.material.map.dispose();
        mesh.material.dispose();
      }
    });
  }
  if (h.customPit) {
    if (h.customPit.map) h.customPit.map.dispose();
    h.customPit.dispose();
  }
  h.tag.remove();
}

function canEat(hole, r) { return hole.r >= r * EAT_RATIO; }

/** Max hole radius for the current map — prevents crashes when r > world. */
function maxHoleRadius() {
  if (!currentLevel || !currentLevel.world) return 180;
  // Cap earlier so late-game camera never sees the whole map as dots.
  // Leave margin so clamp(min,max) stays valid and Shape/scale stay sane.
  return Math.min(currentLevel.world * 0.34, GFX.lowEnd ? 140 : 180);
}

function grow(h, addArea) {
  if (battleMode) addArea *= Math.max(0.25, 1 - h.r / 240);
  h.r = Math.sqrt((areaOf(h.r) + addArea) / Math.PI);
  const cap = maxHoleRadius();
  if (h.r > cap) h.r = cap;
}

// Push the pit/cap/ring/mouth meshes to the hole's current position and size.
function syncHole(h) {
  const cap = maxHoleRadius();
  if (h.r > cap) h.r = cap;
  const s = h.r;
  h.wall.scale.set(s, 1, s);
  h.cap.scale.set(s, s, s);
  h.ring.scale.set(s, s, s);
  h.wall.position.x = h.x; h.wall.position.z = h.z;
  h.cap.position.x = h.x;  h.cap.position.z = h.z;
  h.ring.position.x = h.x; h.ring.position.z = h.z;
  if (h.mouth) {
    h.mouth.scale.set(s, s, s);
    h.mouth.position.x = h.x; h.mouth.position.z = h.z;
  }

  if (h.ghost) {
    h.ghost.scale.set(s, s, s);
    h.ghost.position.x = h.x; h.ghost.position.z = h.z;
  }

  // Scale y-offsets with radius to prevent z-fighting at large sizes
  if (h.mouth) h.mouth.position.y = 0.04 + s * 0.010;
  h.ring.position.y = 0.22 + (h._ringJitter || 0) + s * 0.014;
  if (h.ghost) h.ghost.position.y = 0.30 + s * 0.018;

  // Rebuild ring geometry when sizeLevel changes (not every frame)
  const currentLv = sizeLevel(h.r);
  if (currentLv !== h._ringLv) {
    h._ringLv = currentLv;
    if (h.ring.geometry) h.ring.geometry.dispose();
    if (h.ghost && h.ghost.geometry) h.ghost.geometry.dispose();
    const band = 0.12 * clamp(30 / Math.max(h.r, 1), 0.3, 1);
    h.ring.geometry = new THREE.RingGeometry(1 - band, 1 + band * 0.35, HOLE_SEG);
    if (h.ghost) h.ghost.geometry = new THREE.RingGeometry(1 - band, 1 + band * 0.35, HOLE_SEG);
  }

  if (h.deco) {
    // Cap cosmetic scale — huge deco meshes at late game can OOM mobile GPUs
    const decoS = Math.min(s, GFX.lowEnd ? 48 : 90);
    h.deco.scale.set(decoS, decoS, decoS);
    const decoY = h.deco.userData.flat ? 0.35 : 0;
    h.deco.position.set(h.x, decoY, h.z);
  }
}

function moveHole(h, dt) {
  const W = currentLevel.world;
  const cap = maxHoleRadius();
  if (h.r > cap) h.r = cap;
  const speed = 58 + sizeLevel(h.r) * 3.5;
  const d = dist(h.x, h.z, h.tx, h.tz);
  if (d > 1) {
    const step = Math.min(speed * dt, d);
    h.x += (h.tx - h.x) / d * step;
    h.z += (h.tz - h.z) / d * step;
  }
  // When r is large, W-r can be small — never invert min/max (that crashed late game)
  const lim = Math.max(4, W - h.r);
  h.x = clamp(h.x, -lim, lim);
  h.z = clamp(h.z, -lim, lim);
  syncHole(h);
}
