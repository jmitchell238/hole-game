// Renderer, scene, camera, lights, static ground.
//
// CRITICAL PERF: ground is a STATIC plane. Hole openings are cut in the
// fragment shader (discard). We never rebuild ShapeGeometry while moving —
// that alloc/upload/GC pattern was the real iPad killer even with 90 props.

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
sun.castShadow = true;
sun.shadow.mapSize.set(GFX.shadowMapSize, GFX.shadowMapSize);
const shadowSpan = GFX.mobile ? 280 : 400;
Object.assign(sun.shadow.camera, {
  left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan,
  near: 50, far: 1400,
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

// ---- Procedural textures ----------------------------------------------------
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

// ---- Ground: static plane + shader hole cutouts -----------------------------
const GROUND_MAX_HOLES = 8;
let ground = null;
let skirt = null;
const _holeData = [];
for (let i = 0; i < GROUND_MAX_HOLES; i++) _holeData.push(new THREE.Vector4());

function makeGroundMaterial(map) {
  // Basic = no lighting on the biggest screen-filling mesh
  const mat = new THREE.MeshBasicMaterial({ map: map });
  mat.userData.holeCount = 0;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.holeCount = { value: mat.userData.holeCount || 0 };
    shader.uniforms.holes = { value: _holeData };
    mat.userData.shader = shader;

    // highp world position for reliable discards on mobile GPUs
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying highp vec3 vGrdWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGrdWorld = (modelMatrix * vec4(position, 1.0)).xyz;');

    if (shader.vertexShader.indexOf('vGrdWorld') < 0) {
      shader.vertexShader = 'varying highp vec3 vGrdWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        'vGrdWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform int holeCount;
        uniform vec4 holes[${GROUND_MAX_HOLES}];
        varying highp vec3 vGrdWorld;`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        for (int i = 0; i < ${GROUND_MAX_HOLES}; i++) {
          if (i >= holeCount) break;
          highp vec2 d = vGrdWorld.xz - holes[i].xy;
          if (dot(d, d) < holes[i].z * holes[i].z) discard;
        }`);
  };
  mat.customProgramCacheKey = () => 'voidrush-static-ground-v3';
  mat.needsUpdate = true;
  return mat;
}

function buildSkirt(level) {
  if (skirt) {
    scene.remove(skirt);
    skirt.children.forEach(m => m.geometry.dispose());
    if (skirt.children[0]) skirt.children[0].material.dispose();
  }
  const W = level.world, D = HOLE_DEPTH + 12;
  const mat = new THREE.MeshBasicMaterial({
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
  // PlaneGeometry UVs are 0–1 over the whole plane = whole world texture once
  gtex.repeat.set(1, 1);
  gtex.offset.set(0, 0);
  gtex.wrapS = THREE.ClampToEdgeWrapping;
  gtex.wrapT = THREE.ClampToEdgeWrapping;

  const W = level.world;
  // Static plane — NEVER replaced during play
  const geo = new THREE.PlaneGeometry(2 * W, 2 * W, 1, 1);
  ground = new THREE.Mesh(geo, makeGroundMaterial(gtex));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  ground.castShadow = false;
  ground.frustumCulled = false; // always fills view when looking down
  scene.add(ground);
  refreshGround(true);
}

// Write hole cutout uniforms only — no geometry alloc.
function refreshGround(/* force */) {
  if (!ground || !ground.material) return;
  const mat = ground.material;
  const n = Math.min(holes.length, GROUND_MAX_HOLES);
  const maxCut = currentLevel ? currentLevel.world * 0.9 : 1e9;
  for (let i = 0; i < GROUND_MAX_HOLES; i++) {
    if (i < n) {
      const h = holes[i];
      _holeData[i].set(h.x, h.z, Math.min(h.r * 1.02, maxCut), 0);
    } else {
      _holeData[i].set(0, 0, 0, 0);
    }
  }
  mat.userData.holeCount = n;
  if (mat.userData.shader) {
    mat.userData.shader.uniforms.holeCount.value = n;
  }
}
