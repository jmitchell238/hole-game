// Everything about the holes themselves: the visible pit, creating/removing a
// hole, movement, and the grow/eat math.

// The pit inside every hole: soil at the rim fading to black, with a
// black floor far below so falling objects sink out of sight naturally.
const PIT_GEO = new THREE.CylinderGeometry(1, 1, HOLE_DEPTH, 48, 1, true);
const CAP_GEO = new THREE.CircleGeometry(1, 48);
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
  }
  // A real pit: cylindrical wall fading to black, with a floor far below.
  const wall = new THREE.Mesh(PIT_GEO, pitMat);
  wall.position.set(x, -HOLE_DEPTH/2, z);
  const cap = new THREE.Mesh(CAP_GEO, CAP_MAT);
  cap.rotation.x = -Math.PI/2; cap.position.set(x, -HOLE_DEPTH + 1, z);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.06, 48),
    new THREE.MeshBasicMaterial({ color: ringColor }));
  // Each ring gets its own height so overlapping rings never z-fight/flicker.
  ring.rotation.x = -Math.PI/2;
  ring.position.set(x, 0.22 + Math.random()*0.08, z);
  scene.add(wall); scene.add(cap); scene.add(ring);
  const tag = document.createElement('div');
  tag.className = 'tag'; tag.textContent = name;
  tag.style.color = tagColor;
  document.getElementById('tags').appendChild(tag);
  return { wall, cap, ring, tag, deco, x, z, r: 12, name, isPlayer,
    tx: x, tz: z, retarget: 0,
    customPit: pitMat === PIT_MAT ? null : pitMat };
}

function removeHole(h) {
  scene.remove(h.wall); scene.remove(h.cap); scene.remove(h.ring);
  if (h.deco) scene.remove(h.deco);
  if (h.customPit) {
    if (h.customPit.map) h.customPit.map.dispose();
    h.customPit.dispose();
  }
  h.tag.remove();
}

function canEat(hole, r) { return hole.r >= r * EAT_RATIO; }
function grow(h, addArea) { h.r = Math.sqrt((areaOf(h.r)+addArea)/Math.PI); }

// Push the pit/cap/ring meshes to the hole's current position and size.
function syncHole(h) {
  const s = h.r;
  h.wall.scale.set(s, 1, s);
  h.cap.scale.set(s, s, s);
  h.ring.scale.set(s, s, s);
  h.wall.position.x = h.x; h.wall.position.z = h.z;
  h.cap.position.x = h.x;  h.cap.position.z = h.z;
  h.ring.position.x = h.x; h.ring.position.z = h.z;
  if (h.deco) {
    h.deco.scale.set(s, s, s);
    h.deco.position.set(h.x, 0, h.z);
  }
}

function moveHole(h, dt) {
  const W = currentLevel.world;
  const speed = Math.max(38, 62 - h.r*0.2);
  const d = dist(h.x, h.z, h.tx, h.tz);
  if (d > 1) {
    const step = Math.min(speed*dt, d);
    h.x += (h.tx-h.x)/d*step; h.z += (h.tz-h.z)/d*step;
  }
  h.x = clamp(h.x, -W+h.r, W-h.r);
  h.z = clamp(h.z, -W+h.r, W-h.r);
  syncHole(h);
}
