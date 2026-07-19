// Size Lab — debug level showing every prop with labels and a height ruler
// so the owner can visually audit sizes and tell us what to adjust.
(function () {

let WORLD, galleryData = [];

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
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, side: THREE.DoubleSide });
    const labelGeo = new THREE.PlaneGeometry(100, 50);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2; // lie flat on ground
    labelMesh.position.x = x;
    labelMesh.position.y = 0.2; // just above ground
    labelMesh.position.z = z + (Math.max(stats.r * 2, measuredH * 0.3) + 40) * 0.4;
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
    ringMesh.position.y = 0.1;
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
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, side: THREE.DoubleSide });
    const labelGeo = new THREE.PlaneGeometry(20, 20);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.x = rulerX + 30;
    labelMesh.position.y = h + 0.5;
    labelMesh.position.z = rulerZ;
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
  generate,
  createGroundTexture: createSizelabGroundTexture,
  populate,
});

})();
