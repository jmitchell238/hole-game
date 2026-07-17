// LOD + light streaming for props (Doom/Quake-style: cheaper at distance, still visible).
//
// Earlier we unparented far props → they "popped in" and the player couldn't plan
// routes. Classic games keep silhouettes on screen and only drop *detail*.
//
// LOD 0 = full mesh (close / large on screen)
// LOD 1 = single colored box proxy (far / small on screen) — still shows where
//         stuff is so you can steer toward it
//
// Unparent only for truly off-map junk (well past fog). Falling props force LOD 0.

// Shared unit geometries — one alloc for the whole game
const _PROXY_BOX = new THREE.BoxGeometry(1, 1, 1);
const _proxyMatCache = Object.create(null);
function _proxyMat(hex) {
  const k = hex | 0;
  if (!_proxyMatCache[k])
    _proxyMatCache[k] = new THREE.MeshLambertMaterial({ color: k });
  return _proxyMatCache[k];
}

// Silhouette colors by theme so distant blobs still read as "tree / person / car"
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
 * Root is what goes in objects[].mesh / the scene.
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
    // Full detail: re-attach detailed mesh, hide box
    if (full && !full.parent) root.add(full);
    if (full) full.visible = true;
    if (proxy) proxy.visible = false;
  } else {
    // Far LOD: DETACH detailed mesh from the scene graph (not just visible=false)
    // so Three.js doesn't walk hundreds of child nodes — this is the Quake trick.
    if (full && full.parent) root.remove(full);
    if (proxy) proxy.visible = true;
  }
}

// Tuned for 1st-gen iPad Pro 12.9" (A9X) via GFX.* — see js/config.js
const SPATIAL = {
  cell: 120,
  period: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 2 : 2,
  // Projected size (CSS px) thresholds with hysteresis — no flicker at the edge
  fullEnterPx: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 28 : 22,
  fullExitPx: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 18 : 14,
  // Only unparent beyond this (well past fog) — NOT for "far but on map"
  unloadRange: (typeof GFX !== 'undefined' && GFX.lowEnd) ? 1600 : 2400,
  // Always use at least proxy within this (navigation visibility)
  alwaysShowRange: (typeof GFX !== 'undefined' && GFX.viewMaxRange) || 900,
};

let _streamTick = 0;
let _lastStreamInScene = 0;
let _lastFullLod = 0;
let _spatialReady = false;

function cellKey(x, z) {
  const C = SPATIAL.cell;
  return Math.floor(x / C) + ':' + Math.floor(z / C);
}

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
  const fov = camera.fov * Math.PI / 180;
  const halfH = (FRAME && FRAME.h) ? FRAME.h * 0.5 : 400;
  return (radius * 2 / dist) * (halfH / Math.tan(fov * 0.5));
}

// How far the camera can usefully see landmarks (for unload only).
function viewRadius() {
  if (!player) return 400;
  const height = 22.5 + player.r * 7.3;
  const byCam = height * 1.25 + 120;
  const byHole = player.r * 6 + 220;
  return Math.min(SPATIAL.alwaysShowRange, Math.max(byCam, byHole));
}

/**
 * Update LOD and (rarely) unparent props that are absurdly far.
 * Props stay visible as cheap boxes when far — no more pop-in.
 * @param {boolean} force
 * @returns {number} props currently parented to the scene
 */
function streamProps(force) {
  if (!player || !objects.length) return 0;
  if (!_spatialReady) rebuildSpatialIndex();

  _streamTick++;
  if (!force && (_streamTick % SPATIAL.period) !== 0) return _lastStreamInScene;

  const cx = player.x, cz = player.z;
  const unloadR = SPATIAL.unloadRange;
  const unloadR2 = unloadR * unloadR;
  const fullEnter = SPATIAL.fullEnterPx;
  const fullExit = SPATIAL.fullExitPx;

  let inScene = 0;
  let fullN = 0;

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.dead) continue;

    // Falling: full detail, always attached
    if (o.falling) {
      if (!o.mesh.parent) scene.add(o.mesh);
      setPropLod(o, 0);
      o.mesh.visible = true;
      o._streamed = true;
      inScene++;
      fullN++;
      continue;
    }

    const dx = o.x - cx, dz = o.z - cz;
    const d2 = dx * dx + dz * dz;

    // Truly off the useful map — only then unparent (saves scene-graph cost)
    if (d2 > unloadR2) {
      if (o.mesh.parent) scene.remove(o.mesh);
      o._streamed = false;
      continue;
    }

    if (!o.mesh.parent) scene.add(o.mesh);
    o.mesh.visible = true;
    o._streamed = true;
    inScene++;

    // LOD from projected size + hysteresis (Quake-style: detail by distance)
    const px = approxPixels(Math.max(o.r, 2), o.x, o.z);
    const cur = (o.mesh.userData && o.mesh.userData.lod) || 0;
    let next = cur;
    if (cur === 0) {
      // Currently full — drop to proxy when small on screen
      if (px < fullExit) next = 1;
    } else {
      // Currently proxy — promote to full when large enough
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
  // traverseVisible skips subtrees under visible=false parents
  if (scene.traverseVisible) {
    scene.traverseVisible(o => { if (o.isMesh) n++; });
  } else {
    scene.traverse(o => { if (o.isMesh && o.visible) n++; });
  }
  return n;
}
