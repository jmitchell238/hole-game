// Size Lab — debug level showing every prop with labels and a height ruler
// so the owner can visually audit sizes and tell us what to adjust.
(function () {

let WORLD, galleryData = [];

// ---- Free Camera Controller (exposed as globals for main.js to call) ----
let _freeCamInitialized = false;

window.initFreeCam = function() {
  if (_freeCamInitialized) return;
  _freeCamInitialized = true;

  // Compute gallery bounds
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let maxY = 0;

  for (const o of objects) {
    if (o.mesh) {
      const box = new THREE.Box3().setFromObject(o.mesh);
      minX = Math.min(minX, box.min.x);
      maxX = Math.max(maxX, box.max.x);
      minZ = Math.min(minZ, box.min.z);
      maxZ = Math.max(maxZ, box.max.z);
      maxY = Math.max(maxY, box.max.y);
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Start with reasonable framing
  window.freeCamController = {
    target: new THREE.Vector3(centerX, Math.max(5, maxY * 0.5), centerZ),
    yaw: 0,
    pitch: 0.6,
    distance: Math.max(300, Math.hypot(maxX - minX, maxZ - minZ) * 0.8)
  };
};

window.updateFreeCam = function() {
  if (!freeCamController) return;
  const { target, yaw, pitch, distance } = freeCamController;
  const x = target.x + Math.cos(yaw) * Math.cos(pitch) * distance;
  const y = target.y + Math.sin(pitch) * distance;
  const z = target.z + Math.sin(yaw) * Math.cos(pitch) * distance;
  camera.position.set(x, y, z);
  camera.lookAt(target);
};

// ---- Input handlers for freeCam (guard with currentLevel.freeCam) ----
let _freeCamInputsAttached = false;

function attachFreeCamInputs() {
  if (_freeCamInputsAttached) return;
  _freeCamInputsAttached = true;

  const canvas = renderer.domElement;
  const state = {
    lastTouchX: 0, lastTouchY: 0,
    touchCount: 0,
    lastDistance: 0
  };

  // Touch events
  canvas.addEventListener('touchstart', (e) => {
    if (!(currentLevel && currentLevel.freeCam)) return;
    state.touchCount = e.touches.length;
    if (state.touchCount === 1) {
      state.lastTouchX = e.touches[0].clientX;
      state.lastTouchY = e.touches[0].clientY;
    } else if (state.touchCount === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      state.lastDistance = Math.hypot(dx, dy);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!(currentLevel && currentLevel.freeCam) || !window.freeCamController) return;
    e.preventDefault();

    if (state.touchCount === 1) {
      const dx = e.touches[0].clientX - state.lastTouchX;
      const dy = e.touches[0].clientY - state.lastTouchY;
      window.freeCamController.yaw -= dx * 0.01;
      window.freeCamController.pitch += dy * 0.01;
      window.freeCamController.pitch = Math.max(0.1, Math.min(1.4, window.freeCamController.pitch));
      state.lastTouchX = e.touches[0].clientX;
      state.lastTouchY = e.touches[0].clientY;
    } else if (state.touchCount === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = state.lastDistance / dist;
      window.freeCamController.distance *= ratio;
      window.freeCamController.distance = Math.max(60, Math.min(4000, window.freeCamController.distance));
      state.lastDistance = dist;
    }
  });

  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    if (!(currentLevel && currentLevel.freeCam)) return;
    state.lastTouchX = e.clientX;
    state.lastTouchY = e.clientY;
  }, false);

  canvas.addEventListener('mousemove', (e) => {
    if (!(currentLevel && currentLevel.freeCam) || !window.freeCamController) return;
    if (!(e.buttons & (1 | 2))) return; // left or right mouse button
    if ((e.buttons & 1) && !(e.shiftKey)) { // left drag without shift = orbit
      const dx = e.clientX - state.lastTouchX;
      const dy = e.clientY - state.lastTouchY;
      window.freeCamController.yaw -= dx * 0.01;
      window.freeCamController.pitch += dy * 0.01;
      window.freeCamController.pitch = Math.max(0.1, Math.min(1.4, window.freeCamController.pitch));
    } else if ((e.buttons & 2) || ((e.buttons & 1) && e.shiftKey)) { // right drag or shift+left = pan
      const dx = e.clientX - state.lastTouchX;
      const dy = e.clientY - state.lastTouchY;
      const cam = camera.position.clone().sub(window.freeCamController.target);
      const right = new THREE.Vector3()
        .crossVectors(camera.up, cam).normalize()
        .multiplyScalar(-dx * 0.5);
      const up = camera.up.clone().multiplyScalar(dy * 0.5);
      window.freeCamController.target.add(right).add(up);
    }
    state.lastTouchX = e.clientX;
    state.lastTouchY = e.clientY;
  }, false);

  canvas.addEventListener('wheel', (e) => {
    if (!(currentLevel && currentLevel.freeCam) || !window.freeCamController) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    window.freeCamController.distance *= delta;
    window.freeCamController.distance = Math.max(60, Math.min(4000, window.freeCamController.distance));
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => {
    if (!(currentLevel && currentLevel.freeCam)) return;
    e.preventDefault();
  }, false);
}

// Call attachFreeCamInputs() on first game load
if (typeof renderer !== 'undefined' && !_freeCamInputsAttached) {
  attachFreeCamInputs();
}

function generate() {
  WORLD = 800; // generous size for the gallery
  this.world = WORLD;
  this.playerSpawn = [-300, 0];
  this.botSpawns = []; // no bots in this lab
}

function createSizelabGroundTexture() {
  const S = 512;
  return canvasTex(S, S, g => {
    // Light neutral ground
    g.fillStyle = '#e8e8e8';
    g.fillRect(0, 0, S, S);
    // Grid lines for reference (light)
    g.strokeStyle = 'rgba(200,200,200,0.4)';
    g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const pos = (i / 10) * S;
      g.beginPath(); g.moveTo(pos, 0); g.lineTo(pos, S); g.stroke();
      g.beginPath(); g.moveTo(0, pos); g.lineTo(S, pos); g.stroke();
    }
  });
}

function createLabelTexture(name, r, h, measuredH) {
  return canvasTex(512, 256, g => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#000000';
    g.font = 'bold 28px Arial';
    g.textAlign = 'center';
    g.fillText(name, 256, 50);

    g.font = '20px Arial';
    g.fillText(`STATS r=${r} h=${h}`, 256, 100);
    g.fillText(`mesh h=${Math.round(measuredH * 10) / 10}`, 256, 140);
  });
}

function populate(addProp) {
  // Collect all real props (skip stest_ and Slice)
  const propList = [];
  for (const name of Object.keys(BUILDERS)) {
    if (!name.startsWith('stest_') && !name.includes('Slice')) {
      propList.push(name);
    }
  }

  // Sort by STATS height ascending
  propList.sort((a, b) => (STATS[a]?.h || 0) - (STATS[b]?.h || 0));

  // Layout: place in rows if many, spaced to avoid overlap
  let currentX = -WORLD + 100;
  let currentZ = -100;
  const maxZ = 100;
  const rowSpacing = 180;

  galleryData = [];

  for (const name of propList) {
    const stats = STATS[name];
    if (!stats) continue;

    // Try to build and measure the prop to get its actual height
    let testMesh;
    let measuredH = stats.h; // default to STATS height
    try {
      testMesh = BUILDERS[name]();
      if (testMesh) {
        const box = new THREE.Box3().setFromObject(testMesh);
        measuredH = box.max.y - box.min.y;
        scene.remove(testMesh);
      }
    } catch (e) {
      console.warn(`Skipping ${name}: build error`, e);
      continue;
    }

    // Spacing: use radii to avoid footprint overlap
    const spacing = Math.max(stats.r * 2, measuredH * 0.3) + 40;

    // Wrap to next row if needed
    if (currentX + spacing > WORLD - 100) {
      currentX = -WORLD + 100;
      currentZ += rowSpacing;
    }

    // Add the prop using the level's addProp callback
    addProp(name, currentX, currentZ, 0);

    // Store gallery entry for label and ring creation
    galleryData.push({ name, stats, measuredH, x: currentX, z: currentZ });

    currentX += spacing;
  }

  // After all props are added, create labels and footprint rings
  for (const entry of galleryData) {
    const { name, stats, measuredH, x, z } = entry;

    // Ground label: canvas texture plane lying flat in front of prop
    const labelTex = createLabelTexture(name, stats.r, stats.h, measuredH);
    const spacing = Math.max(stats.r * 2, measuredH * 0.3) + 40;
    const labelWidth = Math.min(90, spacing * 0.9);
    const labelMat = new THREE.MeshBasicMaterial({
      map: labelTex,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const labelGeo = new THREE.PlaneGeometry(labelWidth, 50);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2; // lie flat on ground
    labelMesh.position.x = x;
    labelMesh.position.y = 1.5; // raised above ground to avoid z-fighting
    labelMesh.position.z = z + spacing * 0.4;
    labelMesh.renderOrder = 10;
    scene.add(labelMesh);

    // Footprint ring
    const ringGeo = new THREE.RingGeometry(stats.r - 1, stats.r + 1, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.x = x;
    ringMesh.position.y = 0.6; // raised above ground
    ringMesh.position.z = z;
    scene.add(ringMesh);
  }

  // Height ruler: stand it at the side with tick marks
  const rulerX = -WORLD + 50;
  const rulerZ = currentZ + 150;
  const rulerHeight = 130;

  // Tall thin pole
  const poleGeo = new THREE.BoxGeometry(4, rulerHeight, 4);
  const poleMat = new THREE.MeshBasicMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.x = rulerX;
  pole.position.y = rulerHeight / 2;
  pole.position.z = rulerZ;
  scene.add(pole);

  // Tick marks and labels every 10 units
  for (let h = 10; h <= rulerHeight; h += 10) {
    // Horizontal tick bar
    const tickGeo = new THREE.BoxGeometry(20, 2, 4);
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.x = rulerX;
    tick.position.y = h;
    tick.position.z = rulerZ;
    scene.add(tick);

    // Label: number on a small canvas texture
    const labelTex = canvasTex(64, 64, g => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#000000';
      g.font = 'bold 32px Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(h), 32, 32);
    });
    const labelMat = new THREE.MeshBasicMaterial({
      map: labelTex,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const labelGeo = new THREE.PlaneGeometry(20, 20);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.x = rulerX + 30;
    labelMesh.position.y = h + 1.5;
    labelMesh.position.z = rulerZ;
    labelMesh.renderOrder = 10;
    scene.add(labelMesh);
  }
}

registerLevel({
  id: 'sizelab',
  name: 'Size Lab',
  sky: 0xcccccc,
  fog: false,
  hemi: [0xeeeeee, 0xaaaaaa, 0.8],
  sunColor: 0xffffff,
  soil: ['#888888', '#444444'],
  skirtColor: 0x666666,
  progressLabel: 'Lab complete',
  noEat: true, // guard in rules.js: don't eat props
  freeCam: true, // enable free camera for inspection
  generate,
  createGroundTexture: createSizelabGroundTexture,
  populate,
});

})();
