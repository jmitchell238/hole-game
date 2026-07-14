// Renderer, scene, camera, lights, and the ground mesh (with holes punched out).
// Sky / fog / light colors come from the active level via applyEnvironment().

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 1, 6000);

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

function buildGround(level) {
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
    const p = new THREE.Path();
    p.absarc(h.x, -h.z, h.r, 0, Math.PI*2, true);
    shape.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(shape, 32);
  if (ground.geometry) ground.geometry.dispose();
  ground.geometry = geo;
}
