// Spatial streaming + pixel-size culling for props.
//
// Problem: as the hole grows the camera pulls back, thousands of props stay in
// the scene graph, and Three.js pays for every one every frame (even 1-pixel
// people on the horizon).
//
// Fix:
//  1. Grid the map. Only cells near the player/camera stay parented to `scene`.
//  2. Drop props whose projected size is below a few pixels (still count for
//     devour % — only the mesh is detached).
//  3. Never detach falling props.
//
// objects[] remains the source of truth for gameplay; this only parents meshes.

// Tuned for 1st-gen iPad Pro 12.9" (A9X) via GFX.* — see js/config.js
const SPATIAL = {
  cell: 120,
  // Re-evaluate parenting every N frames (not every frame — avoids thrash)
  period: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 3 : 2,
  // Minimum on-screen size in CSS px before we bother drawing a prop
  minPixels: (typeof GFX !== 'undefined' && GFX.viewMinPixels) || 2.5,
  // Absolute hard cap on how far we keep props parented (world units)
  maxRange: (typeof GFX !== 'undefined' && GFX.viewMaxRange) || 1100,
  // Small-prop LOD: people/dogs/bushes only when closer than maxRange * mul
  smallR: 8,
  smallRangeMul: (typeof GFX !== 'undefined' && GFX.viewSmallRangeMul) || 0.65,
};

let _streamTick = 0;
let _lastStreamInScene = 0;
let _spatialReady = false;

function cellKey(x, z) {
  const C = SPATIAL.cell;
  // Math.floor so negative coords bucket correctly ( |0 truncates toward 0 )
  return Math.floor(x / C) + ':' + Math.floor(z / C);
}

// Tag each static prop with its cell. Call after populate / when objects change.
function rebuildSpatialIndex() {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead) continue;
    o._cell = cellKey(o.x, o.z);
    o._streamed = !!o.mesh.parent;
  }
  _spatialReady = true;
}

// Approx projected height in CSS pixels for a footprint radius at world pos.
function approxPixels(radius, ox, oz) {
  if (!camera || !player) return 99;
  const dx = ox - camera.position.x;
  const dy = 0 - camera.position.y;
  const dz = oz - camera.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) return 999;
  // perspective: worldSize / dist * (screen / 2) / tan(fov/2)
  const fov = camera.fov * Math.PI / 180;
  const halfH = (FRAME && FRAME.h) ? FRAME.h * 0.5 : 400;
  return (radius * 2 / dist) * (halfH / Math.tan(fov * 0.5));
}

// View radius that grows with the hole but hard-caps so late game stays bounded.
function viewRadius() {
  if (!player) return 400;
  const height = 22.5 + player.r * 7.3;
  // Rough ground coverage of the camera frustum
  const byCam = height * 1.15 + 80;
  const byHole = player.r * 5 + 180;
  const raw = Math.max(byCam, byHole);
  return Math.min(SPATIAL.maxRange, raw);
}

/**
 * Parent/unparent prop meshes based on distance + projected size.
 * @param {boolean} force - run even if not on the streaming period
 * @returns {number} meshes currently parented to the scene
 */
function streamProps(force) {
  if (!player || !objects.length) return 0;
  if (!_spatialReady) rebuildSpatialIndex();

  _streamTick++;
  if (!force && (_streamTick % SPATIAL.period) !== 0) return _lastStreamInScene;

  const cx = player.x, cz = player.z;
  const viewR = viewRadius();
  const viewR2 = viewR * viewR;
  const smallR2 = (viewR * SPATIAL.smallRangeMul) * (viewR * SPATIAL.smallRangeMul);
  const minPx = SPATIAL.minPixels;

  let inScene = 0;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead) continue;

    // Falling props must stay attached and animating
    if (o.falling) {
      if (!o.mesh.parent) scene.add(o.mesh);
      o.mesh.visible = true;
      o._streamed = true;
      inScene++;
      continue;
    }

    const dx = o.x - cx, dz = o.z - cz;
    const d2 = dx * dx + dz * dz;

    let show = d2 <= viewR2;
    // Small clutter (people, dogs, bushes, mailboxes…) drops out earlier
    if (show && o.r < SPATIAL.smallR && d2 > smallR2) show = false;
    // Pixel-size cull: if it'd be a speck, skip the draw
    if (show && approxPixels(o.r, o.x, o.z) < minPx) show = false;

    if (show) {
      if (!o.mesh.parent) scene.add(o.mesh);
      o.mesh.visible = true;
      o._streamed = true;
      inScene++;
    } else if (o.mesh.parent) {
      scene.remove(o.mesh);
      o._streamed = false;
    } else {
      o._streamed = false;
    }
  }

  _lastStreamInScene = inScene;
  return inScene;
}

// How many prop meshes are currently parented (for perf tests / HUD debug)
function countStreamedProps() {
  let n = 0;
  for (let i = 0; i < objects.length; i++) {
    if (!objects[i].dead && objects[i].mesh && objects[i].mesh.parent) n++;
  }
  return n;
}

function countSceneMeshes() {
  let n = 0;
  scene.traverse(o => { if (o.isMesh) n++; });
  return n;
}
