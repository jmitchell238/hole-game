// Renderer, scene, camera, lights, and the ground mesh (with holes punched out).
// Sky / fog / light colors come from the active level via applyEnvironment().

const renderer = new THREE.WebGLRenderer({
  antialias: GFX.antialias,
  powerPreference: 'high-performance',
  // Prefer no alpha compositing cost over the page background
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

// Handle WebGL context loss by reloading
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); location.reload(); });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 16/9, 1, 6000);

// The frame is pinned to the viewport by CSS (inset:0) and layoutFrame just measures it.
const FRAME = { w: 0, h: 0, x: 0, y: 0 };
function layoutFrame() {
  const r = frameEl.getBoundingClientRect();
  FRAME.w = Math.round(r.width);
  FRAME.h = Math.round(r.height);
  FRAME.x = Math.round(r.left);
  FRAME.y = Math.round(r.top);
  renderer.setSize(FRAME.w, FRAME.h);
  camera.aspect = FRAME.w / FRAME.h;
  const landscape = FRAME.w >= FRAME.h;
  camera.fov = landscape ? 55 : 70;      // wider lens when held upright
  camera.updateProjectionMatrix();
}
layoutFrame();

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9a6a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(GFX.shadowMapSize, GFX.shadowMapSize);
// Tighter shadow frustum = sharper + cheaper on tablets
const shadowSpan = GFX.mobile ? 280 : 400;
Object.assign(sun.shadow.camera,
  { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan,
    near: 50, far: GFX.mobile ? 1200 : 1600 });
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

// ---- Procedural textures (no downloads — everything is generated) -------------
// On tablets, downscale huge 4k canvases so the GPU isn't fed 16MB+ textures.
function canvasTex(w, h, draw) {
  const max = GFX.maxTexSize;
  const tw = Math.min(w, max), th = Math.min(h, max);
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  if (tw !== w || th !== h) {
    ctx.scale(tw / w, th / h);
  }
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = GFX.anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ---- Ground -------------------------------------------------------------------
let ground = null;
let skirt = null;
// Cache of last hole pose used to build geometry — skip rebuilds when idle.
let _groundSig = '';
let _groundForce = true;

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
    if (ground.material.map) ground.material.map.dispose();
    ground.material.dispose();
    if (ground.geometry) ground.geometry.dispose();
  }
  const gtex = level.createGroundTexture();
  gtex.repeat.set(1/(2*level.world), 1/(2*level.world));
  gtex.offset.set(0.5, 0.5);
  ground = new THREE.Mesh(new THREE.BufferGeometry(),
    new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = !!SAVE.shadows;
  // Ground is huge; never cast shadows from it
  ground.castShadow = false;
  scene.add(ground);
  _groundForce = true;
  _groundSig = '';
  refreshGround();
}

// Quantized signature of every hole's pose. Rebuild only when it changes.
function groundSignature() {
  // Coarser quantization on mobile → fewer rebuilds while moving
  const mq = GFX.groundMoveEps;
  const rq = GFX.groundRadiusEps;
  let s = holes.length + '|';
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    s += (h.x / mq | 0) + ',' + (h.z / mq | 0) + ',' + (h.r / rq | 0) + ';';
  }
  return s;
}

// Rebuild the ground with a real hole punched out for every mouth,
// so you can look down inside the pits.
// Call with force=true after match start / hole removed; otherwise only
// rebuilds when a hole has moved/grown past the quantization threshold.
function refreshGround(force) {
  if (!ground || !currentLevel) return;
  if (!force && !_groundForce) {
    const sig = groundSignature();
    if (sig === _groundSig) return;
    _groundSig = sig;
  } else {
    _groundForce = false;
    _groundSig = groundSignature();
  }

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
      if (o === h) continue;
      if (!(o.r > h.r || (o.r === h.r && holes.indexOf(o) < holes.indexOf(h)))) continue;
      const d = dist(h.x, h.z, o.x, o.z);
      if (d < o.r + r) r = Math.min(r, Math.max(0, d - o.r));
    }
    if (r < 0.5) continue;
    const p = new THREE.Path();
    p.absarc(h.x, -h.z, r, 0, Math.PI*2, true);
    shape.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(shape, GFX.groundCurve);
  if (ground.geometry) ground.geometry.dispose();
  ground.geometry = geo;
}
