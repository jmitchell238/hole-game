// Renderer, scene, camera, lights, STATIC ground (no per-frame geometry work).
//
// iPad lesson: ShapeGeometry rebuilds AND full-screen hole-discard shaders both
// destroy A9X frame time. Ground is a plain textured plane. The hole opening is
// a black disc on the hole object (see hole.js) — zero ground rebuilds forever.

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(GFX.pixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = false; // never on gen-1 profile path by default

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

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9a6a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
sun.castShadow = false;
sun.shadow.mapSize.set(GFX.shadowMapSize, GFX.shadowMapSize);
Object.assign(sun.shadow.camera, {
  left: -300, right: 300, top: 300, bottom: -300, near: 50, far: 1200,
});
scene.add(sun);
scene.add(sun.target);

function applyEnvironment(level) {
  scene.background = new THREE.Color(level.sky);
  // Fog is per-fragment on EVERY pixel — kill it on low-end iPads
  if (GFX.lowEnd) {
    scene.fog = null;
  } else {
    scene.fog = new THREE.Fog(level.sky, level.fog[0], level.fog[1]);
  }
  hemi.color.set(level.hemi[0]);
  hemi.groundColor.set(level.hemi[1]);
  hemi.intensity = level.hemi[2];
  sun.color.set(level.sunColor);
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
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ---- Ground: one static plane, never rebuilt ---------------------------------
let ground = null;
let skirt = null;

function buildSkirt(level) {
  if (skirt) {
    scene.remove(skirt);
    skirt.children.forEach(m => m.geometry.dispose());
    if (skirt.children[0]) skirt.children[0].material.dispose();
  }
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
  // Plane UVs are 0–1 → full texture once across the world
  gtex.repeat.set(1, 1);
  gtex.offset.set(0, 0);
  gtex.wrapS = THREE.ClampToEdgeWrapping;
  gtex.wrapT = THREE.ClampToEdgeWrapping;

  const W = level.world;
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * W, 2 * W, 1, 1),
    new THREE.MeshBasicMaterial({ map: gtex, fog: !GFX.lowEnd }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  ground.castShadow = false;
  ground.frustumCulled = false;
  scene.add(ground);
  // No hole cutouts in the ground mesh — mouth disc on each hole covers it.
  refreshGround(true);
}

// Kept for API compatibility with rules/main — cheap no-op now.
function refreshGround(/* force */) {
  /* intentionally empty: ground is static; hole mouth discs move with holes */
}
