// Camera frustum visibility for props — no box proxies, no ugly LOD.
//
// Rules:
//  • Off screen            → not parented (not rendered)
//  • Almost on screen      → parented early (enter pad) so edges don't pop
//  • On screen             → full original mesh
//  • Eaten / destroyed     → destroyProp() removes + frees geometry

const SPATIAL = {
  period: 2,
  // World-unit pad outside the frustum ("almost on screen")
  enterPad: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 100 : 80,
  exitPad: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 45 : 35,
};

const _frustum = new THREE.Frustum();
const _mat = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

let _streamTick = 0;
let _lastStreamInScene = 0;
let _spatialReady = false;

function cellKey(x, z) {
  const C = 120;
  return Math.floor(x / C) + ':' + Math.floor(z / C);
}

function rebuildSpatialIndex() {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead || !o.mesh) continue;
    o._cell = cellKey(o.x, o.z);
    o._streamed = !!o.mesh.parent;
  }
  _spatialReady = true;
}

function viewRadius() {
  if (!camera) return 400;
  return Math.min(1600, camera.position.y * 1.5 + 200);
}

function frustumPlanes(pad) {
  camera.updateMatrixWorld(true);
  _mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_mat);
  const planes = new Array(6);
  for (let i = 0; i < 6; i++) {
    const p = _frustum.planes[i];
    planes[i] = { nx: p.normal.x, ny: p.normal.y, nz: p.normal.z, c: p.constant + pad };
  }
  return planes;
}

function sphereHitsPlanes(planes) {
  const c = _sphere.center, r = _sphere.radius;
  for (let i = 0; i < 6; i++) {
    const p = planes[i];
    if (p.nx * c.x + p.ny * c.y + p.nz * c.z + p.c < -r) return false;
  }
  return true;
}

/** Permanent removal when a prop is eaten / finished falling. */
function destroyProp(o) {
  if (!o) return;
  o.dead = true;
  const root = o.mesh;
  if (!root) return;
  if (root.parent) root.parent.remove(root);
  root.traverse(m => {
    if (!m.isMesh) return;
    if (m.geometry) m.geometry.dispose();
    // Shared materials (MAT.*) — do not dispose
  });
  o.mesh = null;
  o._streamed = false;
}

/**
 * Parent props that are on-screen or almost on-screen; unparent the rest.
 * Always full detail — no box silhouettes.
 */
function streamProps(force) {
  if (!player || !camera || !objects.length) return 0;
  if (!_spatialReady) rebuildSpatialIndex();

  _streamTick++;
  if (!force && (_streamTick % SPATIAL.period) !== 0) return _lastStreamInScene;

  const enterPlanes = frustumPlanes(SPATIAL.enterPad);
  const exitPlanes = frustumPlanes(SPATIAL.exitPad);

  let inScene = 0;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead || !o.mesh) continue;

    // Falling into a hole: always draw
    if (o.falling) {
      if (!o.mesh.parent) scene.add(o.mesh);
      o.mesh.visible = true;
      o._streamed = true;
      inScene++;
      continue;
    }

    const rad = Math.max(o.r * 1.5, (o.h || 4) * 0.6, 6);
    _sphere.center.set(o.x, (o.h || 8) * 0.4, o.z);
    _sphere.radius = rad;

    const onScreen = o._streamed
      ? sphereHitsPlanes(exitPlanes)
      : sphereHitsPlanes(enterPlanes);

    if (!onScreen) {
      if (o.mesh.parent) scene.remove(o.mesh);
      o._streamed = false;
      continue;
    }

    if (!o.mesh.parent) scene.add(o.mesh);
    o.mesh.visible = true;
    o._streamed = true;
    inScene++;
  }

  _lastStreamInScene = inScene;
  return inScene;
}

function countStreamedProps() {
  let n = 0;
  for (let i = 0; i < objects.length; i++) {
    if (!objects[i].dead && objects[i].mesh && objects[i].mesh.parent) n++;
  }
  return n;
}

function countFullLodProps() {
  // No LOD tiers anymore — everything on-screen is full detail
  return _lastStreamInScene;
}

function countSceneMeshes() {
  let n = 0;
  if (scene.traverseVisible) {
    scene.traverseVisible(o => { if (o.isMesh) n++; });
  } else {
    scene.traverse(o => { if (o.isMesh && o.visible) n++; });
  }
  return n;
}
