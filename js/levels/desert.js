// The Wild West Desert level: a frontier town on an open desert with a railroad,
// ranches, cacti, and tumbleweeds. Every match rolls a new layout.
(function () {

let WORLD;
let townX, townZ;           // town center
let townAngle;              // main street direction (0=X, π/2=Z)
let railroadAngle;          // railroad direction (independent random)
let railroadX, railroadZ;   // railroad offset
let ranches = [];           // { x, z, ranchAngle }

// ---- Desert-specific props -------------------------------------------------------
const WOOD = new THREE.MeshLambertMaterial({ color: 0x8a6642 });
const CACTUS_GREEN = new THREE.MeshLambertMaterial({ color: 0x4a9e3f });
const SAND_TAN = new THREE.MeshLambertMaterial({ color: 0xd9b078 });
const RUST = new THREE.MeshLambertMaterial({ color: 0x8a4a2a });
const LEATHER = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
const METAL = new THREE.MeshLambertMaterial({ color: 0x7a8a9a });

// Cactus: saguaro with arms (2 size variants)
registerProp('cactus', { r: 4, h: 18 }, function() {
  const g = new THREE.Group();
  const isBig = Math.random() < 0.5;
  const bodyH = isBig ? 18 : 14;
  const bodyR = isBig ? 1.8 : 1.4;
  const armR = isBig ? 0.8 : 0.6;
  g.add(part(new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 8), CACTUS_GREEN, 0, bodyH/2, 0));
  // Two elbow arms using bent cylinders positioned as segments
  const armY = isBig ? 10 : 8;
  const armLen = isBig ? 8 : 6;
  const armOff = isBig ? 6 : 5;
  // Left arm
  const armL = part(new THREE.CylinderGeometry(armR, armR, armLen, 6), CACTUS_GREEN,
    -armOff, armY, 0);
  armL.rotation.z = Math.PI/2.5; g.add(armL);
  // Right arm
  const armR_mesh = part(new THREE.CylinderGeometry(armR, armR, armLen, 6), CACTUS_GREEN,
    armOff, armY, 0);
  armR_mesh.rotation.z = -Math.PI/2.5; g.add(armR_mesh);
  return g;
}, false);

// Tumbleweed: wireframe-like sphere made from crossed rings
registerProp('tumbleweed', { r: 3, h: 5 }, function() {
  const g = new THREE.Group();
  const wiremat = new THREE.MeshLambertMaterial({ color: 0xc9a578, wireframe: false });
  // Three crossed tori/rings for wireframe effect
  for (let i = 0; i < 3; i++) {
    const ring = part(new THREE.TorusGeometry(2.5, 0.15, 6, 16), wiremat, 0, 2.5, 0);
    ring.rotation.x = i * Math.PI/3;
    g.add(ring);
  }
  return g;
}, false);

// Barrel: simple cylinder
registerProp('barrel', { r: 2.5, h: 5 }, function() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(2.3, 2.3, 5, 10), RUST, 0, 2.5, 0));
  // Metal bands
  g.add(part(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 10), METAL, 0, 1.2, 0));
  g.add(part(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 10), METAL, 0, 3.8, 0));
  return g;
}, false);

// Wagon: wood box + 4 cylinder wheels + canvas hoop top
registerProp('wagon', { r: 9, h: 12 }, function() {
  const g = new THREE.Group();
  // Box bed
  g.add(part(new THREE.BoxGeometry(16, 5, 8), WOOD, 0, 2.5, 0));
  // Wheels
  const wheelR = 2.2, wheelH = 0.6;
  for (const [lx, lz] of [[-7, -4], [7, -4], [-7, 4], [7, 4]])
    g.add(part(new THREE.CylinderGeometry(wheelR, wheelR, wheelH, 10), METAL, lx, wheelR, lz));
  // Canvas hoop top
  const hoop = part(new THREE.TorusGeometry(8, 0.5, 6, 16), LEATHER, 0, 5.5, 0);
  g.add(hoop);
  return g;
}, true);

// Water tower: cylinder tank on 4 legs + cone roof
registerProp('watertower', { r: 10, h: 38 }, function() {
  const g = new THREE.Group();
  // Tank
  g.add(part(new THREE.CylinderGeometry(8, 8, 16, 12), METAL, 0, 18, 0));
  // Legs: four corner cylinders
  for (const [lx, lz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]])
    g.add(part(new THREE.CylinderGeometry(0.8, 0.8, 18, 6), RUST, lx, 9, lz));
  // Cone roof
  g.add(part(new THREE.ConeGeometry(9.5, 8, 12), RUST, 0, 32, 0));
  return g;
}, true);

// Windmill: tower + 8-blade fan disc
registerProp('windmill', { r: 6, h: 30 }, function() {
  const g = new THREE.Group();
  // Tower
  g.add(part(new THREE.CylinderGeometry(1.5, 1.8, 28, 8), RUST, 0, 14, 0));
  // 8-blade fan (rotation in 45-degree increments)
  for (let b = 0; b < 8; b++) {
    const angle = (b / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 4.5, z = Math.sin(angle) * 4.5;
    const blade = part(new THREE.BoxGeometry(0.6, 0.4, 8), WOOD, x, 28, z);
    blade.rotation.y = angle;
    g.add(blade);
  }
  return g;
}, true);

// Train car: boxcar on rail-colored base
registerProp('traincar', { r: 11, h: 16 }, function() {
  const g = new THREE.Group();
  // Rail base (dark under the car)
  g.add(part(new THREE.BoxGeometry(20, 0.8, 3), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }), 0, 0.4, 0));
  // Boxcar body
  g.add(part(new THREE.BoxGeometry(18, 12, 8), RUST, 0, 8, 0));
  // Roof
  g.add(part(new THREE.BoxGeometry(18, 1, 8.5), RUST, 0, 14.5, 0));
  // 4 wheels
  for (const [wx, wz] of [[-8, -4.5], [8, -4.5], [-8, 4.5], [8, 4.5]])
    g.add(part(new THREE.CylinderGeometry(2, 2, 1.2, 10), METAL, wx, 2, wz));
  return g;
}, true);

// Engine variant (traincar with chimney)
registerProp('engine', { r: 11, h: 16 }, function() {
  const g = new THREE.Group();
  // Rail base
  g.add(part(new THREE.BoxGeometry(20, 0.8, 3), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }), 0, 0.4, 0));
  // Engine body
  g.add(part(new THREE.BoxGeometry(14, 12, 8), RUST, 0, 8, 0));
  // Chimney
  g.add(part(new THREE.CylinderGeometry(1.2, 1.2, 10, 8), METAL, -4, 13, 0));
  // Chimney cap
  g.add(part(new THREE.CylinderGeometry(1.5, 1.2, 0.6, 8), METAL, -4, 18, 0));
  // 4 wheels
  for (const [wx, wz] of [[-6, -4.5], [6, -4.5], [-6, 4.5], [6, 4.5]])
    g.add(part(new THREE.CylinderGeometry(2, 2, 1.2, 10), METAL, wx, 2, wz));
  return g;
}, true);

// Longhorn: brown quadruped like dog but bigger with horn cylinders
registerProp('longhorn', { r: 4.5, h: 8 }, function() {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  // Body
  g.add(part(new THREE.BoxGeometry(8, 3.5, 3), fur, 0, 3.5, 0));
  // Head
  g.add(part(new THREE.BoxGeometry(3, 2.5, 2.5), fur, 4.5, 5.5, 0));
  // Snout
  g.add(part(new THREE.BoxGeometry(1.5, 1.5, 1.5), fur, 6, 5, 0));
  // Legs
  for (const [lx, lz] of [[-2.5, 1.2], [2.5, 1.2], [-2.5, -1.2], [2.5, -1.2]])
    g.add(part(new THREE.BoxGeometry(1, 2.5, 1), fur, lx, 1.25, lz));
  // Horns: white cylinders angling forward/up from head
  const hornMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const hornL = part(new THREE.CylinderGeometry(0.3, 0.2, 6, 6), hornMat, 3.5, 7, -0.8);
  hornL.rotation.z = 0.4; hornL.rotation.x = 0.3; g.add(hornL);
  const hornR = part(new THREE.CylinderGeometry(0.3, 0.2, 6, 6), hornMat, 3.5, 7, 0.8);
  hornR.rotation.z = 0.4; hornR.rotation.x = -0.3; g.add(hornR);
  // Tail
  const tail = part(new THREE.BoxGeometry(1.2, 0.6, 0.6), fur, -4.5, 4, 0);
  tail.rotation.z = 0.5; g.add(tail);
  return g;
}, true);

// Wood building: 2-story wood box with detailed facade, awning, parapet, porch, 3 color tints
registerProp('woodbuilding', { r: 14, h: 22 }, function() {
  const colors = [0x8a6642, 0x9a7050, 0x7a5838];
  const buildMat = new THREE.MeshLambertMaterial({ color: pick(colors) });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });
  const g = new THREE.Group();

  // Vary height and width per instance (±20%)
  const heightVar = 1 + rand(-0.2, 0.2);
  const widthVar = 1 + rand(-0.2, 0.2);
  const mainH = 20 * heightVar;
  const mainW = 24 * widthVar;

  // Main body
  g.add(part(new THREE.BoxGeometry(mainW, mainH, 10), buildMat, 0, mainH/2, 0));

  // Flat parapet front (taller than roofline)
  g.add(part(new THREE.BoxGeometry(mainW + 2, 3.5, 0.8), buildMat, 0, mainH + 2, 4.8));

  // Dark contrasting door plate (bottom center front)
  const doorW = mainW * 0.3, doorH = mainH * 0.35;
  g.add(part(new THREE.BoxGeometry(doorW, doorH, 0.4), darkMat, 0, doorH/2 + 1, 5.1));
  // Door knob hint
  g.add(part(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshLambertMaterial({ color: 0xd4af37 }),
    doorW/3, doorH/2 + 1, 5.3));

  // Window plates (2-4 windows, dark boxes slightly proud)
  const windowCount = 2 + ((Math.random()*2)|0);
  const spacing = mainW / (windowCount + 1);
  for (let i = 0; i < windowCount; i++) {
    const wx = -mainW/2 + spacing * (i + 1);
    // Upper floor windows
    g.add(part(new THREE.BoxGeometry(3.5, 3.5, 0.3), darkMat, wx, mainH * 0.65, 5.15));
    g.add(part(new THREE.BoxGeometry(2.8, 2.8, 0.1), new THREE.MeshLambertMaterial({ color: 0x4a7aa8 }),
      wx, mainH * 0.65, 5.2));
    // Lower floor windows
    g.add(part(new THREE.BoxGeometry(3.5, 3.5, 0.3), darkMat, wx, mainH * 0.25, 5.15));
    g.add(part(new THREE.BoxGeometry(2.8, 2.8, 0.1), new THREE.MeshLambertMaterial({ color: 0x4a7aa8 }),
      wx, mainH * 0.25, 5.2));
  }

  // Striped awning canopy (thin box with 2-color effect)
  const awningMat1 = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const awningMat2 = new THREE.MeshLambertMaterial({ color: 0xd2691e });
  const awningW = mainW * 0.5;
  g.add(part(new THREE.BoxGeometry(awningW, 1.2, 2), awningMat1, 0, mainH * 0.45, 5.8));
  // Stripes on awning
  for (let s = 0; s < 4; s++) {
    const stripX = -awningW/2 + (s + 0.5) * (awningW / 4);
    g.add(part(new THREE.BoxGeometry(awningW/5, 1.3, 0.1), awningMat2, stripX, mainH * 0.45, 5.85));
  }

  // Small sign board plate above awning
  const signMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  g.add(part(new THREE.BoxGeometry(mainW * 0.4, 1.5, 0.5), signMat, 0, mainH * 0.55, 5.4));
  // Sign accent (gold band)
  g.add(part(new THREE.BoxGeometry(mainW * 0.35, 0.6, 0.1), new THREE.MeshLambertMaterial({ color: 0xffd700 }),
    0, mainH * 0.55, 5.5));

  // 40% chance: covered porch with 2 posts and roof slab
  if (Math.random() < 0.4) {
    const postR = 0.8, postH = mainH * 0.45;
    const porch_roof_y = postH + mainH * 0.1;
    // Left post
    g.add(part(new THREE.CylinderGeometry(postR, postR, postH, 8), buildMat,
      -mainW/3, postH/2, 5.5));
    // Right post
    g.add(part(new THREE.CylinderGeometry(postR, postR, postH, 8), buildMat,
      mainW/3, postH/2, 5.5));
    // Porch roof slab
    g.add(part(new THREE.BoxGeometry(mainW * 0.65, 1, 2.5), buildMat,
      0, porch_roof_y, 5.5));
  }

  return g;
}, true);

// Mesa rock: reuse island rock pattern but registered locally
registerProp('mesa_rock', { r: 6, h: 8 }, function() {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const s = rand(2.2, 4.4);
    const m = part(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshLambertMaterial({ color: 0xa4744a }),
      rand(-3, 3), s*0.7, rand(-3, 3));
    m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(m);
  }
  return g;
}, false);

function generate() {
  WORLD = Math.round(rand(950, 1250));

  // Town center
  townX = rand(-WORLD/3, WORLD/3);
  townZ = rand(-WORLD/3, WORLD/3);

  // Main street random cardinal direction
  townAngle = pick([0, Math.PI/2, Math.PI, 3*Math.PI/2]);

  // Railroad: random angle and offset (independent)
  railroadAngle = rand(0, Math.PI*2);
  railroadX = rand(-WORLD/2, WORLD/2);
  railroadZ = rand(-WORLD/2, WORLD/2);

  // 3-5 ranches scattered outside town (> 300 from town)
  ranches = [];
  const ranchCount = 3 + ((Math.random()*2)|0);
  for (let r = 0; r < ranchCount; r++) {
    let x, z, tries = 30;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && Math.hypot(x - townX, z - townZ) < 300);
    ranches.push({ x, z, ranchAngle: Math.random() * Math.PI*2 });
  }

  this.world = WORLD;

  // Player spawn on main street, town center
  if (townAngle === 0 || townAngle === Math.PI) {
    this.playerSpawn = [townX + rand(-150, 150), townZ];
  } else {
    this.playerSpawn = [townX, townZ + rand(-150, 150)];
  }

  // Bot spawns: 3 near town, 4 scattered
  const spots = [];
  for (let i = 0; i < 7; i++) {
    let x, z;
    if (i < 3) {
      // Near town
      x = townX + rand(-200, 200);
      z = townZ + rand(-200, 200);
    } else if (i < 5) {
      // Near ranches
      const ranch = ranches[(i-3) % ranches.length];
      x = ranch.x + rand(-150, 150);
      z = ranch.z + rand(-150, 150);
    } else {
      // Scattered
      x = rand(-WORLD + 100, WORLD - 100);
      z = rand(-WORLD + 100, WORLD - 100);
    }
    spots.push([x, z]);
  }
  this.botSpawns = spots;
}

// Desert ground: sand base with darker speckle, riverbed, main street, railroad, mesas
function desertGroundTexture() {
  const S = 4096;
  return canvasTex(S, S, g => {
    const sc = S / (2*WORLD);
    const X = w => (w + WORLD) * sc;

    // Base sand
    g.fillStyle = '#d9b078';
    g.fillRect(0, 0, S, S);

    // Darker speckle noise
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = `rgba(0,0,0,${rand(0.01, 0.08)})`;
      g.fillRect(Math.random()*S, Math.random()*S, rand(3, 8), rand(3, 8));
    }

    // Dry riverbed: wavy dark band
    const riverY = townZ + rand(-200, 200);
    g.strokeStyle = '#b08c5a';
    g.lineWidth = 40;
    g.beginPath();
    for (let xx = -WORLD; xx <= WORLD; xx += 50) {
      const yy = riverY + Math.sin(xx / 400) * 80;
      if (xx === -WORLD) g.moveTo(X(xx), X(yy));
      else g.lineTo(X(xx), X(yy));
    }
    g.stroke();
    // Cracked-line strokes in riverbed
    for (let c = 0; c < 100; c++) {
      const cx = rand(-WORLD, WORLD);
      const cy = riverY + rand(-40, 40);
      g.strokeStyle = 'rgba(0,0,0,0.1)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(X(cx), X(cy));
      g.lineTo(X(cx + rand(-50, 50)), X(cy + rand(-50, 50)));
      g.stroke();
    }

    // Main street: packed dirt
    const streetWidth = 80;
    if (townAngle === 0 || townAngle === Math.PI) {
      // Vertical street (Z-aligned)
      g.fillStyle = '#c09a62';
      g.fillRect(X(townX - streetWidth/2), 0, streetWidth*sc, S);
    } else {
      // Horizontal street (X-aligned)
      g.fillStyle = '#c09a62';
      g.fillRect(0, X(townZ - streetWidth/2), S, streetWidth*sc);
    }

    // Railroad: two rails + perpendicular sleepers
    const rrScaler = 2.5; // scale for visual clarity on texture
    const rrX1 = railroadX - 8*rrScaler, rrZ1 = railroadZ;
    const rrX2 = railroadX + 8*rrScaler, rrZ2 = railroadZ;
    g.strokeStyle = '#3a3a3a';
    g.lineWidth = Math.max(3, 3*sc);
    // Rail 1 & 2
    for (const [startX, startZ] of [[rrX1, rrZ1], [rrX2, rrZ2]]) {
      g.beginPath();
      const angle = railroadAngle;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const far = WORLD * 2.5;
      const px1 = startX - dx*far, pz1 = startZ - dz*far;
      const px2 = startX + dx*far, pz2 = startZ + dz*far;
      g.moveTo(X(px1), X(pz1));
      g.lineTo(X(px2), X(pz2));
      g.stroke();
    }
    // Sleepers perpendicular to rails
    g.strokeStyle = '#5a4a3a';
    g.lineWidth = Math.max(2, 2*sc);
    for (let t = -WORLD; t <= WORLD; t += 40) {
      const cx = railroadX + Math.cos(railroadAngle)*t;
      const cz = railroadZ + Math.sin(railroadAngle)*t;
      const px = Math.cos(railroadAngle + Math.PI/2)*12;
      const pz = Math.sin(railroadAngle + Math.PI/2)*12;
      g.beginPath();
      g.moveTo(X(cx - px), X(cz - pz));
      g.lineTo(X(cx + px), X(cz + pz));
      g.stroke();
    }

    // 6-10 dark rocky mesa blobs
    g.fillStyle = '#a4744a';
    const mesaCount = 6 + ((Math.random()*4)|0);
    for (let m = 0; m < mesaCount; m++) {
      const mx = rand(-WORLD + 200, WORLD - 200);
      const mz = rand(-WORLD + 200, WORLD - 200);
      const mR = rand(60, 140);
      // Blob with shadow edge
      const gm = g.createRadialGradient(X(mx), X(mz), 0, X(mx), X(mz), mR*sc);
      gm.addColorStop(0, '#a4744a');
      gm.addColorStop(0.9, '#8a5a32');
      gm.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = gm;
      g.beginPath();
      g.arc(X(mx), X(mz), mR*sc, 0, Math.PI*2);
      g.fill();
    }

    // Scrub patches: small dots
    for (let s = 0; s < 400; s++) {
      g.fillStyle = `rgba(100,80,60,${rand(0.15, 0.35)})`;
      g.fillRect(Math.random()*S, Math.random()*S, rand(2, 6), rand(2, 6));
    }
  });
}

function populate(addProp) {
  // Town: two rows of 8-12 wood buildings flanking main street
  const townBuildingCount = 8 + ((Math.random()*4)|0);
  const buildingSpacing = 60;
  for (let b = 0; b < townBuildingCount; b++) {
    let x, z;
    if (townAngle === 0 || townAngle === Math.PI) {
      // Street runs Z direction
      z = townZ - 200 + (b / townBuildingCount) * 400;
      x = townX + (Math.random() < 0.5 ? -120 : 120) + rand(-20, 20);
    } else {
      // Street runs X direction
      x = townX - 200 + (b / townBuildingCount) * 400;
      z = townZ + (Math.random() < 0.5 ? -120 : 120) + rand(-20, 20);
    }
    addProp('woodbuilding', x, z, Math.random() * Math.PI*2);
  }

  // Water tower on main street (1-2)
  const wtCount = Math.random() < 0.5 ? 1 : 2;
  for (let w = 0; w < wtCount; w++) {
    let x, z;
    if (townAngle === 0 || townAngle === Math.PI) {
      z = townZ + (w === 0 ? -180 : 180);
      x = townX + rand(-80, 80);
    } else {
      x = townX + (w === 0 ? -180 : 180);
      z = townZ + rand(-80, 80);
    }
    addProp('watertower', x, z, 0);
  }

  // Many people in town and scattered around
  for (let p = 0; p < 120; p++) {
    const px = townX + rand(-250, 250);
    const pz = townZ + rand(-250, 250);
    addProp('person', px, pz);
  }

  // Barrels, horses (longhorns), wagons near town
  for (let b = 0; b < 40; b++) {
    const bx = townX + rand(-250, 250);
    const bz = townZ + rand(-250, 250);
    const roll = Math.random();
    if (roll < 0.4) addProp('barrel', bx, bz, 0);
    else if (roll < 0.7) addProp('longhorn', bx, bz, 0);
    else addProp('wagon', bx, bz, Math.random() * Math.PI*2);
  }

  // Trees, bushes, dogs scattered throughout
  for (let t = 0; t < 150; t++) {
    addProp('tree', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150));
  }

  for (let b = 0; b < 200; b++) {
    addProp('bush', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150));
  }

  for (let d = 0; d < 60; d++) {
    addProp('dog', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150));
  }

  // Cacti everywhere outside town (60-100)
  const cactiCount = 60 + ((Math.random()*40)|0);
  for (let c = 0; c < cactiCount; c++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && Math.hypot(x - townX, z - townZ) < 250);
    addProp('cactus', x, z, 0);
  }

  // Tumbleweeds (20-30)
  const tumbleweedCount = 20 + ((Math.random()*10)|0);
  for (let t = 0; t < tumbleweedCount; t++) {
    addProp('tumbleweed', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150), 0);
  }

  // Extra cacti within 250 units of town edge (15-20, for wild west densification)
  const edgeCactiCount = 15 + ((Math.random()*5)|0);
  for (let ec = 0; ec < edgeCactiCount; ec++) {
    // Random angle from town center, distance 200-250 from town center
    const angle = Math.random() * Math.PI*2;
    const dist = 200 + Math.random() * 50;
    const x = townX + Math.cos(angle) * dist;
    const z = townZ + Math.sin(angle) * dist;
    addProp('cactus', x, z, 0);
  }

  // Train: 5-7 cars in a chain on the railroad line, one engine variant with chimney
  const trainCount = 5 + ((Math.random()*2)|0);
  const trainStartX = railroadX - (trainCount*12)*Math.cos(railroadAngle);
  const trainStartZ = railroadZ - (trainCount*12)*Math.sin(railroadAngle);
  // Engine first
  addProp('engine', trainStartX, trainStartZ, railroadAngle);
  // Cars follow
  for (let tc = 1; tc < trainCount; tc++) {
    const tcx = trainStartX + tc*12*Math.cos(railroadAngle);
    const tcz = trainStartZ + tc*12*Math.sin(railroadAngle);
    addProp('traincar', tcx, tcz, railroadAngle);
  }

  // Ranches: fence perimeter + barn + windmill + 3-5 longhorns inside
  for (const ranch of ranches) {
    const ranchR = 120;
    // Fence perimeter (reuse city fence)
    for (let f = 0; f < 8; f++) {
      const angle = (f / 8) * Math.PI*2;
      const fx = ranch.x + Math.cos(angle) * ranchR;
      const fz = ranch.z + Math.sin(angle) * ranchR;
      addProp('fence', fx, fz, angle);
    }
    // Barn (woodbuilding)
    addProp('woodbuilding', ranch.x - 60, ranch.z, 0);
    // Windmill
    addProp('windmill', ranch.x + 60, ranch.z, 0);
    // Longhorns inside ranch
    const hornCount = 3 + ((Math.random()*2)|0);
    for (let h = 0; h < hornCount; h++) {
      const hx = ranch.x + rand(-80, 80);
      const hz = ranch.z + rand(-80, 80);
      addProp('longhorn', hx, hz, 0);
    }
  }

  // Mesa rocks scattered across desert
  const rockCount = 80 + ((Math.random()*60)|0);
  for (let r = 0; r < rockCount; r++) {
    addProp('mesa_rock', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150), 0);
  }

  // Scattered barrels and benches outside town
  for (let b = 0; b < 30; b++) {
    addProp('barrel', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150), 0);
  }

  for (let b = 0; b < 25; b++) {
    addProp('bench', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150), 0);
  }

  // Street lamps and mailboxes along town
  for (let s = 0; s < 40; s++) {
    addProp('streetlight', townX + rand(-300, 300), townZ + rand(-300, 300), Math.random() * Math.PI*2);
  }

  for (let m = 0; m < 20; m++) {
    addProp('mailbox', townX + rand(-300, 300), townZ + rand(-300, 300));
  }

  // Hydrants and trash cans scattered
  for (let h = 0; h < 15; h++) {
    addProp('hydrant', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150));
  }

  for (let t = 0; t < 20; t++) {
    addProp('trashcan', rand(-WORLD + 150, WORLD - 150), rand(-WORLD + 150, WORLD - 150));
  }
}

registerLevel({
  id: 'desert',
  name: 'Wild West',
  sky: 0xf7d9a8,
  fog: [800, 2600],
  hemi: [0xffe9c9, 0xa8845d, 0.95],
  sunColor: 0xffdfae,
  soil: ['#b98a54', '#5a3f24'],
  skirtColor: 0x7a5a38,
  progressLabel: 'Frontier devoured',
  matchTime: 210,
  generate,
  createGroundTexture: desertGroundTexture,
  populate,
});

})();
