// Renderer, scene, camera, lights, and the ground mesh (with holes punched out).
// Sky / fog / light colors come from the active level via applyEnvironment().

const renderer = new THREE.WebGLRenderer({
  antialias: GFX.antialias,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(GFX.pixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = GFX.softShadows
  ? THREE.PCFSoftShadowMap
  : THREE.BasicShadowMap;
const frameEl = document.getElementById('frame');
frameEl.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';

renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault(); location.reload();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 1, 6000);

const FRAME = { w: 0, h: 0, x: 0, y: 0 };
function layoutFrame() {
  const r = frameEl.getBoundingClientRect();
  FRAME.w = Math.round(r.width);
  FRAME.h = Math.round(r.height);
  FRAME.x = Math.round(r.left);
  FRAME.y = Math.round(r.top);
  // Internal res can be lower on tablets (fill-rate), CSS still full-screen
  const s = GFX.renderScale || 1;
  const bw = Math.max(1, Math.round(FRAME.w * s));
  const bh = Math.max(1, Math.round(FRAME.h * s));
  renderer.setSize(bw, bh, false);
  camera.aspect = FRAME.w / Math.max(1, FRAME.h);
  camera.fov = FRAME.w >= FRAME.h ? 55 : 70;
  camera.updateProjectionMatrix();
}
layoutFrame();

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9a6a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(GFX.shadowMapSize, GFX.shadowMapSize);
const shadowSpan = GFX.mobile ? 280 : 400;
Object.assign(sun.shadow.camera, {
  left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan,
  near: 50, far: GFX.mobile ? 1200 : 1600,
});
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

function applyEnvironment(level) {
  scene.background = new THREE.Color(level.sky);
  scene.fog = new THREE.Fog(level.sky, level.fog[0], level.fog[1]);
  hemi.color.set(level.hemi[0]);
  hemi.groundColor.set(level.hemi[1]);
  hemi.intensity = level.hemi[2];
  sun.color.set(level.sunColor);
}

// ---- Procedural textures ------------------------------------------------------
function canvasTex(w, h, draw) {
  const max = GFX.maxTexSize || 4096;
  const tw = Math.min(w, max), th = Math.min(h, max);
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  if (tw !== w || th !== h) ctx.scale(tw / w, th / h);
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = GFX.anisotropy || 1;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ---- Ground -------------------------------------------------------------------
// ShapeGeometry with hole cutouts — proven look (roads, lawns, etc.).
// Rebuild is THROTTLED (not every frame) so iPad stays smooth.
let ground = null;
let skirt = null;
let _groundSig = '';
let _groundLastBuild = 0;
const GROUND_MIN_MS = (typeof GFX !== 'undefined' && GFX.lowEnd) ? 50 : 33; // ~20fps / 30fps rebuild max
const GROUND_MOVE_Q = (typeof GFX !== 'undefined' && GFX.lowEnd) ? 2.5 : 1.2;

function buildSkirt(level) {
  if (skirt) {
    scene.remove(skirt);
    skirt.children.forEach(m => m.geometry.dispose());
    if (skirt.children[0]) skirt.children[0].material.dispose();
  }
  const W = level.world, D = HOLE_DEPTH + 12;
  const mat = new THREE.MeshLambertMaterial({
    color: level.skirtColor || 0x5a4a3a, side: THREE.DoubleSide,
  });
  skirt = new THREE.Group();
  for (const [x, z, ry] of [[0, -W, 0], [0, W, 0], [-W, 0, Math.PI / 2], [W, 0, Math.PI / 2]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, D), mat);
    wall.position.set(x, -D / 2, z);
    wall.rotation.y = ry;
    skirt.add(wall);
  }
  scene.add(skirt);
}

function buildGround(level) {
  buildSkirt(level);
  if (ground) {
    scene.remove(ground);
    if (ground.material.map) ground.material.map.dispose();
    ground.material.dispose();
    if (ground.geometry) ground.geometry.dispose();
  }
  const gtex = level.createGroundTexture();
  // ShapeGeometry vertices are in world XZ units; texture was painted for [-W,W].
  // Map world units → UV with this repeat/offset (same as original city ground).
  gtex.repeat.set(1 / (2 * level.world), 1 / (2 * level.world));
  gtex.offset.set(0.5, 0.5);
  gtex.wrapS = THREE.ClampToEdgeWrapping;
  gtex.wrapT = THREE.ClampToEdgeWrapping;

  ground = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = !!(typeof SAVE !== 'undefined' && SAVE.shadows);
  ground.castShadow = false;
  scene.add(ground);
  _groundSig = '';
  _groundLastBuild = 0;
  refreshGround(true);
}

function groundSignature() {
  const q = GROUND_MOVE_Q;
  let s = holes.length + '|';
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    s += ((h.x / q) | 0) + ',' + ((h.z / q) | 0) + ',' + ((h.r * 2) | 0) + ';';
  }
  return s;
}

// Rebuild ground cutouts. force=true on match start / hole removed.
// Otherwise only when a hole moved/grew enough AND throttle interval elapsed.
function refreshGround(force) {
  if (!ground || !currentLevel) return;
  const now = performance.now();
  const sig = groundSignature();
  if (!force) {
    if (sig === _groundSig) return;
    if (now - _groundLastBuild < GROUND_MIN_MS) return;
  }
  _groundSig = sig;
  _groundLastBuild = now;

  const W = currentLevel.world;
  const shape = new THREE.Shape();
  shape.moveTo(-W, -W);
  shape.lineTo(W, -W);
  shape.lineTo(W, W);
  shape.lineTo(-W, W);
  // Never cut out the entire ground — leave a ring so ShapeGeometry stays valid
  // and the map doesn't vanish when the hole is huge.
  const maxCut = W * 0.88;
  for (const h of holes) {
    let r = h.r;
    for (const o of holes) {
      if (o === h) continue;
      if (!(o.r > h.r || (o.r === h.r && holes.indexOf(o) < holes.indexOf(h)))) continue;
      const d = dist(h.x, h.z, o.x, o.z);
      if (d < o.r + r) r = Math.min(r, Math.max(0, d - o.r));
    }
    r = Math.min(r, maxCut);
    if (r < 0.5) continue;
    const p = new THREE.Path();
    // Shape is in XY; mesh is rotated -90° around X → shape(x,y) → world(x, -y) as z
    p.absarc(h.x, -h.z, r, 0, Math.PI * 2, true);
    shape.holes.push(p);
  }
  const curve = (typeof GFX !== 'undefined' && GFX.groundCurve) || 16;
  const geo = new THREE.ShapeGeometry(shape, curve);
  if (ground.geometry) ground.geometry.dispose();
  ground.geometry = geo;
}
