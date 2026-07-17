// Frustum visibility helper.
//
// When there are few props (City Test ~100), parenting thrash costs MORE than
// drawing them — Three.js already frustum-culls. Only stream when N is large.

const SPATIAL = {
  period: 3,
  enterPad: 100,
  exitPad: 45,
  // Below this count, leave everything parented (City Test ~25 — no thrash)
  streamMinProps: 80,
};

const _frustum = new THREE.Frustum();
const _mat = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

let _streamTick = 0;
let _lastStreamInScene = 0;
let _spatialReady = false;

function cellKey(x, z) {
  return Math.floor(x / 120) + ':' + Math.floor(z / 120);
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

function destroyProp(o) {
  if (!o) return;
  o.dead = true;
  const root = o.mesh;
  if (!root) return;
  if (root.parent) root.parent.remove(root);
  root.traverse(m => {
    if (!m.isMesh || !m.geometry) return;
    // Only dispose if geometry has no other users — shared geos (city-test) skip
    if (!m.geometry.userData) m.geometry.userData = {};
    if (m.geometry.userData.shared) return;
    m.geometry.dispose();
  });
  o.mesh = null;
  o._streamed = false;
}

function streamProps(force) {
  if (!player || !camera || !objects.length) return 0;
  if (!_spatialReady) rebuildSpatialIndex();

  // Small maps: do nothing. Native frustum culling is enough.
  if (objects.length < SPATIAL.streamMinProps) {
    _lastStreamInScene = objects.length;
    return _lastStreamInScene;
  }

  _streamTick++;
  if (!force && (_streamTick % SPATIAL.period) !== 0) return _lastStreamInScene;

  const enterPlanes = frustumPlanes(SPATIAL.enterPad);
  const exitPlanes = frustumPlanes(SPATIAL.exitPad);
  let inScene = 0;

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead || !o.mesh) continue;

    if (o.falling) {
      if (!o.mesh.parent) scene.add(o.mesh);
      o._streamed = true;
      inScene++;
      continue;
    }

    // Sub-pixel at this camera height — skip entirely (late-game de-clutter)
    const apparent = Math.max(o.r, (o.h || 4) * 0.45);
    if (apparent < camera.position.y * 0.011 && !o.falling) {
      if (o.mesh.parent) scene.remove(o.mesh);
      o._streamed = false;
      continue;
    }

    const rad = Math.max(o.r * 1.5, (o.h || 4) * 0.6, 6);
    _sphere.center.set(o.x, (o.h || 8) * 0.4, o.z);
    _sphere.radius = rad;

    const on = o._streamed
      ? sphereHitsPlanes(exitPlanes)
      : sphereHitsPlanes(enterPlanes);

    if (!on) {
      if (o.mesh.parent) scene.remove(o.mesh);
      o._streamed = false;
      continue;
    }
    if (!o.mesh.parent) scene.add(o.mesh);
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

function countFullLodProps() { return countStreamedProps(); }

function countSceneMeshes() {
  let n = 0;
  if (scene.traverseVisible) scene.traverseVisible(o => { if (o.isMesh) n++; });
  else scene.traverse(o => { if (o.isMesh && o.visible) n++; });
  return n;
}
