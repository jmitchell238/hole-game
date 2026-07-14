// Renderer, scene, camera, lights, and the ground mesh (with holes punched out).
// Sky / fog / light colors come from the active level via applyEnvironment().

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const frameEl = document.getElementById('frame');
frameEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 16/9, 1, 6000);

// The game lives in a fixed 16:9 frame (9:16 when the device is held
// upright), centered and letterboxed — it re-fits itself on rotation.
const FRAME = { w: 0, h: 0, x: 0, y: 0 };
function layoutFrame() {
  const W = innerWidth, H = innerHeight;
  const landscape = W >= H;
  const ratio = landscape ? 16/9 : 9/16;
  const fw = Math.min(W, H * ratio);
  FRAME.w = Math.round(fw);
  FRAME.h = Math.round(fw / ratio);
  FRAME.x = Math.round((W - FRAME.w) / 2);
  FRAME.y = Math.round((H - FRAME.h) / 2);
  frameEl.style.width = FRAME.w + 'px';
  frameEl.style.height = FRAME.h + 'px';
  frameEl.style.left = FRAME.x + 'px';
  frameEl.style.top = FRAME.y + 'px';
  renderer.setSize(FRAME.w, FRAME.h);
  camera.aspect = FRAME.w / FRAME.h;
  camera.fov = landscape ? 55 : 70;      // wider lens when held upright
  camera.updateProjectionMatrix();
}
layoutFrame();

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9a6a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera,
  { left: -450, right: 450, top: 450, bottom: -450, near: 50, far: 1600 });
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

// ---- Procedural textures (no downloads — everything is generated) -------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

// ---- Ground -------------------------------------------------------------------
let ground = null;
let skirt = null;

// Side walls under the map edge, as deep as the pits go, so the world reads
// as a solid slab — without them the pit tube shows as a floating black blob
// when a hole sits near the edge.
function buildSkirt(level) {
  if (skirt) {
    scene.remove(skirt);
    skirt.children.forEach(m => m.geometry.dispose());
    skirt.children[0].material.dispose();
  }
  const W = level.world, D = HOLE_DEPTH + 12;
  const mat = new THREE.MeshLambertMaterial(
    { color: level.skirtColor || 0x5a4a3a, side: THREE.DoubleSide });
  skirt = new THREE.Group();
  for (const [x, z, ry] of [[0, -W, 0], [0, W, 0],
                            [-W, 0, Math.PI/2], [W, 0, Math.PI/2]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2*W, D), mat);
    wall.position.set(x, -D/2, z);
    wall.rotation.y = ry;
    skirt.add(wall);
  }
  scene.add(skirt);
}

function buildGround(level) {
  buildSkirt(level);
  if (ground) {
    scene.remove(ground);
    if (ground.geometry) ground.geometry.dispose();
  }
  const gtex = level.createGroundTexture();
  gtex.repeat.set(1/(2*level.world), 1/(2*level.world));
  gtex.offset.set(0.5, 0.5);
  ground = new THREE.Mesh(new THREE.BufferGeometry(),
    new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);
  refreshGround();
}

// Rebuild the ground with a real hole punched out for every mouth,
// so you can look down inside the pits.
function refreshGround() {
  const W = currentLevel.world;
  const shape = new THREE.Shape();
  shape.moveTo(-W, -W);
  shape.lineTo(W, -W);
  shape.lineTo(W, W);
  shape.lineTo(-W, W);
  for (const h of holes) {
    // While a bigger hole rolls over this one, shrink this one's cutout so
    // the two circles stay tangent — intersecting cutouts break the ground
    // triangulation and flicker.
    let r = h.r;
    for (const o of holes) {
      if (o === h || o.r <= h.r) continue;
      const d = dist(h.x, h.z, o.x, o.z);
      if (d < o.r + r) r = Math.min(r, Math.max(0, d - o.r));
    }
    if (r < 0.5) continue;
    const p = new THREE.Path();
    p.absarc(h.x, -h.z, r, 0, Math.PI*2, true);
    shape.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(shape, 32);
  if (ground.geometry) ground.geometry.dispose();
  ground.geometry = geo;
}
