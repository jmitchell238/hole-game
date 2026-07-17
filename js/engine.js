// Renderer, scene, camera, lights, and the ground mesh (with holes punched out).
// Sky / fog / light colors come from the active level via applyEnvironment().
//
// Ground cutouts are done in the fragment shader (discard) so we NEVER rebuild
// ShapeGeometry every frame — that was the main iPad hitch/glitch source.

const renderer = new THREE.WebGLRenderer({
  antialias: GFX.antialias,
  powerPreference: 'high-performance',
  alpha: false,
  // Prefer lower precision on old iPad GPUs when available
  precision: GFX.lowEnd ? 'mediump' : 'highp',
});
renderer.setPixelRatio(GFX.pixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = GFX.softShadows
  ? THREE.PCFSoftShadowMap
  : THREE.BasicShadowMap;
const frameEl = document.getElementById('frame');
frameEl.appendChild(renderer.domElement);
// Let CSS size the canvas; we control only the drawing-buffer resolution.
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';

// Handle WebGL context loss by reloading
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); location.reload(); });

const scene = new THREE.Scene();
// Shorter far plane on low-end — less overdraw in the distance
// Far plane must clear the ground when the camera is high late-game
const camera = new THREE.PerspectiveCamera(55, 16/9, 1, GFX.lowEnd ? 4500 : 6000);

// The frame is pinned to the viewport by CSS (inset:0) and layoutFrame just measures it.
const FRAME = { w: 0, h: 0, x: 0, y: 0 };
function layoutFrame() {
  const r = frameEl.getBoundingClientRect();
  FRAME.w = Math.round(r.width);
  FRAME.h = Math.round(r.height);
  FRAME.x = Math.round(r.left);
  FRAME.y = Math.round(r.top);
  // Internal resolution = CSS size × renderScale (A9X fill-rate lifesaver on 12.9")
  const s = GFX.renderScale || 1;
  const bw = Math.max(1, Math.round(FRAME.w * s));
  const bh = Math.max(1, Math.round(FRAME.h * s));
  renderer.setSize(bw, bh, false); // false = don't override CSS size
  camera.aspect = FRAME.w / Math.max(1, FRAME.h);
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

// ---- Procedural textures ------------------------------------------------------
function canvasTex(w, h, draw) {
  const max = GFX.maxTexSize;
  const tw = Math.min(w, max), th = Math.min(h, max);
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  if (tw !== w || th !== h) ctx.scale(tw / w, th / h);
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = GFX.anisotropy;
  // Mipmaps help distant ground; cheap enough after we cap texture size
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ---- Ground -------------------------------------------------------------------
// Max simultaneous holes the shader can cut (player + bots)
const GROUND_MAX_HOLES = 8;
let ground = null;
let skirt = null;
// Flat array: [x0,z0,r0, pad, x1,z1,r1, pad, ...]
const _holeUniformData = [];
for (let i = 0; i < GROUND_MAX_HOLES; i++)
  _holeUniformData.push(new THREE.Vector4(0, 0, 0, 0));

function makeGroundMaterial(map) {
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.userData.holeCount = 0;
  mat.userData.holes = _holeUniformData;
  mat.onBeforeCompile = (shader) => {
    // Seed from whatever refreshGround last wrote (shader may compile mid-match)
    shader.uniforms.holeCount = { value: mat.userData.holeCount || 0 };
    shader.uniforms.holes = { value: _holeUniformData };
    mat.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGroundWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGroundWorld = (modelMatrix * vec4( position, 1.0 )).xyz;');

    // Fallback if begin_vertex hook missed
    if (shader.vertexShader.indexOf('vGroundWorld =') < 0) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        'vGroundWorld = (modelMatrix * vec4( transformed, 1.0 )).xyz;\n#include <project_vertex>');
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform int holeCount;\nuniform vec4 holes[' +
          GROUND_MAX_HOLES + '];\nvarying vec3 vGroundWorld;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        for (int i = 0; i < ${GROUND_MAX_HOLES}; i++) {
          if (i >= holeCount) break;
          vec2 d = vGroundWorld.xz - holes[i].xy;
          if (dot(d, d) < holes[i].z * holes[i].z) discard;
        }`);
  };
  // Force a unique program so our hooks aren't shared with other Lamberts
  mat.customProgramCacheKey = function () { return 'voidrush-ground-holes-v2'; };
  // Ensure the material recompiles with our hooks
  mat.needsUpdate = true;
  return mat;
}

// Side walls under the map edge
function buildSkirt(level) {
  if (skirt) {
    scene.remove(skirt);
    skirt.children.forEach(m => m.geometry.dispose());
    if (skirt.children[0]) skirt.children[0].material.dispose();
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

  // Static plane — geometry never rebuilt during play
  // Slightly more segments on desktop for nicer fog shading; mobile stays cheap
  const segs = GFX.mobile ? 1 : 1;
  const geo = new THREE.PlaneGeometry(2 * level.world, 2 * level.world, segs, segs);
  ground = new THREE.Mesh(geo, makeGroundMaterial(gtex));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = !!(typeof SAVE !== 'undefined' && SAVE.shadows);
  ground.castShadow = false;
  // Ensure ground draws before transparent tags etc.
  ground.renderOrder = -1;
  scene.add(ground);
  refreshGround(true);
}

// Push live hole positions into the ground shader. O(holes) — not O(world).
// `force` kept for call-site compatibility; always cheap so ignored.
function refreshGround(/* force */) {
  if (!ground || !ground.material) return;
  const mat = ground.material;
  const n = Math.min(holes.length, GROUND_MAX_HOLES);
  for (let i = 0; i < GROUND_MAX_HOLES; i++) {
    if (i < n) {
      const h = holes[i];
      // Slightly oversized cutout so the pit rim never shows a ground seam
      _holeUniformData[i].set(h.x, h.z, h.r * 1.02, 0);
    } else {
      _holeUniformData[i].set(0, 0, 0, 0);
    }
  }
  mat.userData.holeCount = n;
  const shader = mat.userData.shader;
  if (shader) {
    shader.uniforms.holeCount.value = n;
    // holes array is the same Vector4 refs — GPU already sees updates
  }
}
