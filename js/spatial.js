// Visibility + LOD for props (classic engine approach):
//
//  1. OFF camera frustum  → not in the scene (not rendered)
//  2. ALMOST on screen    → parented early (margin / hysteresis) so nothing
//                           pops in at the edge of the view
//  3. ON screen + large   → full detail mesh
//  4. ON screen + small   → cheap box proxy (still visible for navigation)
//  5. EATEN / destroyed   → destroyProp(): remove + dispose (gone for good)

// Shared unit geometries — one alloc for the whole game
const _PROXY_BOX = new THREE.BoxGeometry(1, 1, 1);
const _proxyMatCache = Object.create(null);
function _proxyMat(hex) {
  const k = hex | 0;
  if (!_proxyMatCache[k])
    _proxyMatCache[k] = new THREE.MeshLambertMaterial({ color: k });
  return _proxyMatCache[k];
}

function proxyColorFor(name) {
  const n = name || '';
  if (/tree|palm|bush|pine|snowpine|scrub/.test(n)) return 0x3d8f4a;
  if (/person|sheep/.test(n)) return 0xd07050;
  if (/dog|longhorn/.test(n)) return 0x8a6642;
  if (/car|bus|wagon|train|engine/.test(n)) return 0x4f8ae8;
  if (/house|shop|apartment|tower|skyrise|cottage|keep|castle|woodbuilding|hut|longhouse|lighthouse|church|mill|gate|igloo/.test(n))
    return 0xc4b49a;
  if (/rock|mesa|stone/.test(n)) return 0x8a8070;
  if (/boat|pier/.test(n)) return 0x8a5a33;
  if (/cactus/.test(n)) return 0x4a9e3f;
  if (/snowman|gift|sled|xmastree/.test(n)) return 0xe8f0f6;
  return 0x9aa0a6;
}

/**
 * Wrap a detailed prop mesh with a cheap far LOD proxy under one root Group.
 */
function attachPropLod(fullMesh, name, stats) {
  const root = new THREE.Group();
  fullMesh.position.set(0, 0, 0);
  fullMesh.rotation.set(0, 0, 0);
  fullMesh.scale.set(1, 1, 1);
  fullMesh.matrixAutoUpdate = false;
  fullMesh.updateMatrix();
  root.add(fullMesh);

  const w = Math.max(2.2, stats.r * 1.75);
  const h = Math.max(2.2, (stats.h || stats.r * 2) * 0.9);
  const proxy = new THREE.Mesh(_PROXY_BOX, _proxyMat(proxyColorFor(name)));
  proxy.scale.set(w, h, w);
  proxy.position.y = h * 0.5;
  proxy.matrixAutoUpdate = false;
  proxy.updateMatrix();
  proxy.visible = false;
  proxy.frustumCulled = true;
  proxy.castShadow = false;
  root.add(proxy);

  root.userData.full = fullMesh;
  root.userData.proxy = proxy;
  root.userData.lod = 0; // 0 = full, 1 = proxy
  root.userData.propName = name;
  return root;
}

function setPropLod(o, lod) {
  const root = o.mesh;
  if (!root || !root.userData || !root.userData.full) return;
  if (root.userData.lod === lod) return;
  root.userData.lod = lod;
  const full = root.userData.full;
  const proxy = root.userData.proxy;
  if (lod === 0) {
    if (full && !full.parent) root.add(full);
    if (full) full.visible = true;
    if (proxy) proxy.visible = false;
  } else {
    // Detach detailed mesh so the renderer doesn't walk it
    if (full && full.parent) root.remove(full);
    if (proxy) proxy.visible = true;
  }
}

// ---- Destroy eaten props (GPU + scene graph) --------------------------------
function _disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(m => {
    if (!m.isMesh) return;
    // Never dispose shared proxy geometry / shared materials
    if (m.geometry && m.geometry !== _PROXY_BOX) {
      m.geometry.dispose();
    }
    // Materials are shared (MAT.*, proxy cache) — do not dispose
  });
}

/** Remove an eaten/destroyed prop from the world permanently. */
function destroyProp(o) {
  if (!o) return;
  o.dead = true;
  const root = o.mesh;
  if (!root) return;

  // Full detail may already be detached for far LOD — still dispose it
  const full = root.userData && root.userData.full;
  if (full) {
    if (full.parent) full.parent.remove(full);
    _disposeObject3D(full);
  }
  if (root.parent) root.parent.remove(root);
  // Proxy uses shared box + shared materials — just drop the root group
  o.mesh = null;
  o._streamed = false;
}

// ---- Frustum visibility -------------------------------------------------------
const SPATIAL = {
  period: 2,
  // World-unit padding outside the camera frustum ("almost on screen")
  // Enter uses larger pad so objects load before they scroll into view.
  enterPad: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 90 : 70,
  exitPad: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 40 : 30,
  // LOD projected-size thresholds (CSS px) with hysteresis
  fullEnterPx: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 28 : 22,
  fullExitPx: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 18 : 14,
};

const _frustum = new THREE.Frustum();
const _mat = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

let _streamTick = 0;
let _lastStreamInScene = 0;
let _lastFullLod = 0;
let _spatialReady = false;

function cellKey(x, z) {
  const C = 120;
  return Math.floor(x / C) + ':' + Math.floor(z / C);
}

function rebuildSpatialIndex() {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead) continue;
    o._cell = cellKey(o.x, o.z);
    o._streamed = !!(o.mesh && o.mesh.parent);
  }
  _spatialReady = true;
}

function approxPixels(radius, ox, oz) {
  if (!camera || !player) return 99;
  const dx = ox - camera.position.x;
  const dy = 0 - camera.position.y;
  const dz = oz - camera.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) return 999;
  const fov = camera.fov * Math.PI / 180;
  const halfH = (FRAME && FRAME.h) ? FRAME.h * 0.5 : 400;
  return (radius * 2 / dist) * (halfH / Math.tan(fov * 0.5));
}

// Kept for perf suite / debug
function viewRadius() {
  if (!player || !camera) return 400;
  const height = camera.position.y;
  return Math.min(1400, height * 1.4 + 150);
}

/** Plane set for an expanded camera frustum (pad in world units). */
function frustumPlanes(pad) {
  camera.updateMatrixWorld(true);
  _mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_mat);
  const planes = new Array(6);
  for (let i = 0; i < 6; i++) {
    const p = _frustum.planes[i];
    // Planes face inward; +pad expands volume so "almost on screen" counts
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

/**
 * Parent only props in / near the camera view; set LOD by on-screen size.
 * Off-screen → not rendered. Almost-on-screen → loaded early (enterPad).
 */
function streamProps(force) {
  if (!player || !camera || !objects.length) return 0;
  if (!_spatialReady) rebuildSpatialIndex();

  _streamTick++;
  if (!force && (_streamTick % SPATIAL.period) !== 0) return _lastStreamInScene;

  // Wide enter / tight exit → load before visible, drop only once clearly off-screen
  const enterPlanes = frustumPlanes(SPATIAL.enterPad);
  const exitPlanes = frustumPlanes(SPATIAL.exitPad);

  const fullEnter = SPATIAL.fullEnterPx;
  const fullExit = SPATIAL.fullExitPx;
  let inScene = 0;
  let fullN = 0;

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead || !o.mesh) continue;

    // Falling into a hole: always draw full detail
    if (o.falling) {
      if (!o.mesh.parent) scene.add(o.mesh);
      setPropLod(o, 0);
      o.mesh.visible = true;
      o._streamed = true;
      inScene++;
      fullN++;
      continue;
    }

    const rad = Math.max(o.r * 1.4, (o.h || 4) * 0.55, 4);
    _sphere.center.set(o.x, (o.h || 8) * 0.4, o.z);
    _sphere.radius = rad;

    const onScreen = o._streamed
      ? sphereHitsPlanes(exitPlanes)
      : sphereHitsPlanes(enterPlanes);

    if (!onScreen) {
      // OFF SCREEN — not rendered
      if (o.mesh.parent) scene.remove(o.mesh);
      o._streamed = false;
      continue;
    }

    // ON or ALMOST on screen
    if (!o.mesh.parent) scene.add(o.mesh);
    o.mesh.visible = true;
    o._streamed = true;
    inScene++;

    const px = approxPixels(Math.max(o.r, 2), o.x, o.z);
    const cur = (o.mesh.userData && o.mesh.userData.lod) || 0;
    let next = cur;
    if (cur === 0) {
      if (px < fullExit) next = 1;
    } else {
      if (px > fullEnter) next = 0;
    }
    setPropLod(o, next);
    if (next === 0) fullN++;
  }

  _lastStreamInScene = inScene;
  _lastFullLod = fullN;
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
  return _lastFullLod;
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
