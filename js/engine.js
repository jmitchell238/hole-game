// Renderer / scene / static ground.
// Tablet goal: match “Minecraft can run here” expectation as closely as Safari allows.
// Native Metal (Minecraft) ≠ WebGL in a browser tab — we still have zero excuse to
// thrash the GPU with rebuilds, fog, shadows, or 2× resolution.

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
  depth: true,
  // lowp is enough for our unlit materials on A9X
  precision: GFX.lowEnd ? 'mediump' : 'highp',
});
renderer.setPixelRatio(1);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = false;
renderer.sortObjects = false; // skip transparent sort — big win with many meshes
if (renderer.debug) renderer.debug.checkShaderErrors = false;

const frameEl = document.getElementById('frame');
frameEl.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';

renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault(); location.reload();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 1, 5000);

const FRAME = { w: 0, h: 0, x: 0, y: 0 };
function layoutFrame() {
  const r = frameEl.getBoundingClientRect();
  FRAME.w = Math.round(r.width);
  FRAME.h = Math.round(r.height);
  FRAME.x = Math.round(r.left);
  FRAME.y = Math.round(r.top);
  const s = GFX.renderScale || 1;
  renderer.setSize(
    Math.max(1, Math.round(FRAME.w * s)),
    Math.max(1, Math.round(FRAME.h * s)),
    false);
  camera.aspect = FRAME.w / Math.max(1, FRAME.h);
  camera.fov = FRAME.w >= FRAME.h ? 55 : 70;
  camera.updateProjectionMatrix();
}
layoutFrame();

// One cheap light. MeshBasic materials ignore lights; Lambert still uses this.
// Dual lights (hemi+sun) roughly double Lambert cost — keep a single hemi on tablet.
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9a6a, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, GFX.lowEnd ? 0 : 1.0);
sun.castShadow = false;
if (!GFX.lowEnd) {
  scene.add(sun);
  scene.add(sun.target);
}

function applyEnvironment(level) {
  scene.background = new THREE.Color(level.sky);
  // No fog on tablet — per-pixel fog is free lag
  scene.fog = GFX.lowEnd ? null : new THREE.Fog(level.sky, level.fog[0], level.fog[1]);
  hemi.color.set(level.hemi[0]);
  hemi.groundColor.set(level.hemi[1]);
  hemi.intensity = level.hemi[2] * (GFX.lowEnd ? 1.15 : 1);
  if (!GFX.lowEnd) sun.color.set(level.sunColor);
}

function canvasTex(w, h, draw) {
  const max = GFX.maxTexSize || 2048;
  const tw = Math.min(w, max), th = Math.min(h, max);
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  if (tw !== w || th !== h) ctx.scale(tw / w, th / h);
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 1;
  // Mipmaps = extra GPU mem + gen cost; linear is fine for our look
  if (GFX.lowEnd) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  } else {
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ---- Static ground (never rebuilt) ------------------------------------------
let ground = null;
let skirt = null;

function buildSkirt(level) {
  if (skirt) {
    scene.remove(skirt);
    skirt.children.forEach(m => m.geometry.dispose());
    if (skirt.children[0]) skirt.children[0].material.dispose();
  }
  // Skip skirt on tablet — 4 extra full-width planes for little gain
  if (GFX.lowEnd) { skirt = null; return; }
  const W = level.world, D = HOLE_DEPTH + 12;
  const mat = new THREE.MeshBasicMaterial({
    color: level.skirtColor || 0x5a4a3a, side: THREE.DoubleSide, fog: false,
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
  gtex.repeat.set(1, 1);
  gtex.offset.set(0, 0);
  gtex.wrapS = THREE.ClampToEdgeWrapping;
  gtex.wrapT = THREE.ClampToEdgeWrapping;

  const W = level.world;
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * W, 2 * W, 1, 1),
    new THREE.MeshBasicMaterial({ map: gtex, fog: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.matrixAutoUpdate = false;
  ground.updateMatrix();
  ground.frustumCulled = false;
  scene.add(ground);
  refreshGround(true);
}

// API no-op — hole mouth discs handle the opening (hole.js)
function refreshGround() {}
