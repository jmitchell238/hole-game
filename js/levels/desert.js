// The Wild West Desert level: a frontier town on an open desert with a railroad,
// ranches, cacti, and tumbleweeds. Every match rolls a new layout.
(function () {

let WORLD;
let townX, townZ;           // town center
let townAngle;              // main street direction (0=X, π/2=Z)
let railroadAngle;          // railroad direction (independent random)
let railroadX, railroadZ;   // railroad offset
let ranches = [];           // { x, z, ranchAngle }

// Exclusion zone helpers
function onStreet(x, z) {
  const streetWidth = 80;
  const margin = 15;
  const halfW = streetWidth / 2 + margin;
  if (townAngle === 0 || townAngle === Math.PI) {
    return Math.abs(x - townX) <= halfW && Math.abs(z - townZ) <= 250;
  } else {
    return Math.abs(z - townZ) <= halfW && Math.abs(x - townX) <= 250;
  }
}

function onRail(x, z) {
  const railDist = 18;
  const dx = Math.cos(railroadAngle);
  const dz = Math.sin(railroadAngle);
  const px = x - railroadX;
  const pz = z - railroadZ;
  const dot = px * dx + pz * dz;
  const perpx = px - dot * dx;
  const perpz = pz - dot * dz;
  const dist = Math.hypot(perpx, perpz);
  return dist <= railDist;
}

// ---- Desert-specific props -------------------------------------------------------
const WOOD = new THREE.MeshLambertMaterial({ color: 0x8a6642 });
const CACTUS_GREEN = new THREE.MeshLambertMaterial({ color: 0x4a9e3f });
const SAND_TAN = new THREE.MeshLambertMaterial({ color: 0xd9b078 });
const RUST = new THREE.MeshLambertMaterial({ color: 0x8a4a2a });
const LEATHER = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
const METAL = new THREE.MeshLambertMaterial({ color: 0x7a8a9a });
const SIENNA = new THREE.MeshLambertMaterial({ color: 0x8a5433 });
const RED_BROWN = new THREE.MeshLambertMaterial({ color: 0xa1543c });
const GRAY_BROWN = new THREE.MeshLambertMaterial({ color: 0x7d6a55 });
const DARK_WOOD = new THREE.MeshLambertMaterial({ color: 0x5f3c22 });
const SIGN_RED = new THREE.MeshLambertMaterial({ color: 0x7e2f26 });
const SIGN_GREEN = new THREE.MeshLambertMaterial({ color: 0x2f5e3c });
const SIGN_NAVY = new THREE.MeshLambertMaterial({ color: 0x2c4a6b });
const PALE_PANE = new THREE.MeshLambertMaterial({ color: 0xe8d9a0 });
const LANTERN = new THREE.MeshLambertMaterial({ color: 0xffb84d });

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
  const colors = [SIENNA, RED_BROWN, GRAY_BROWN];
  const buildMat = pick(colors);
  const darkFrameMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });
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

  // 2-3 thin darker horizontal plank strips for texture
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  const plankSpacing = mainH / 4;
  for (let p = 1; p <= 3; p++) {
    g.add(part(new THREE.BoxGeometry(mainW + 0.5, 0.3, 10.2), plankMat, 0, plankSpacing * p, 0));
  }

  // Dark contrasting door plate (bottom center front)
  const doorW = mainW * 0.3, doorH = mainH * 0.35;
  g.add(part(new THREE.BoxGeometry(doorW, doorH, 0.4), darkFrameMat, 0, doorH/2 + 1, 5.1));
  // Door knob hint
  g.add(part(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshLambertMaterial({ color: 0xd4af37 }),
    doorW/3, doorH/2 + 1, 5.3));

  // Window plates (2-4 windows, dark frames with pale warm panes)
  const windowCount = 2 + ((Math.random()*2)|0);
  const spacing = mainW / (windowCount + 1);
  for (let i = 0; i < windowCount; i++) {
    const wx = -mainW/2 + spacing * (i + 1);
    // Upper floor windows
    g.add(part(new THREE.BoxGeometry(3.5, 3.5, 0.3), darkFrameMat, wx, mainH * 0.65, 5.15));
    g.add(part(new THREE.BoxGeometry(2.8, 2.8, 0.1), PALE_PANE, wx, mainH * 0.65, 5.2));
    // Lower floor windows
    g.add(part(new THREE.BoxGeometry(3.5, 3.5, 0.3), darkFrameMat, wx, mainH * 0.25, 5.15));
    g.add(part(new THREE.BoxGeometry(2.8, 2.8, 0.1), PALE_PANE, wx, mainH * 0.25, 5.2));
  }

  // Striped awning canopy with darker materials
  const awningW = mainW * 0.5;
  g.add(part(new THREE.BoxGeometry(awningW, 1.2, 2), DARK_WOOD, 0, mainH * 0.45, 5.8));
  // Stripes on awning
  const stripColors = [pick([SIGN_RED, SIGN_GREEN, SIGN_NAVY])];
  for (let s = 0; s < 4; s++) {
    const stripX = -awningW/2 + (s + 0.5) * (awningW / 4);
    g.add(part(new THREE.BoxGeometry(awningW/5, 1.3, 0.1), pick(stripColors), stripX, mainH * 0.45, 5.85));
  }

  // Sign board plate with deep red base
  g.add(part(new THREE.BoxGeometry(mainW * 0.4, 1.5, 0.5), SIGN_RED, 0, mainH * 0.55, 5.4));
  // Light lettering strip on sign
  g.add(part(new THREE.BoxGeometry(mainW * 0.35, 0.5, 0.1), new THREE.MeshLambertMaterial({ color: 0xe8d9a0 }),
    0, mainH * 0.55, 5.5));

  // 40% chance: covered porch with 2 posts and roof slab
  if (Math.random() < 0.4) {
    const postR = 0.8, postH = mainH * 0.45;
    const porch_roof_y = postH + mainH * 0.1;
    // Left post (darker wood)
    g.add(part(new THREE.CylinderGeometry(postR, postR, postH, 8), DARK_WOOD,
      -mainW/3, postH/2, 5.5));
    // Right post (darker wood)
    g.add(part(new THREE.CylinderGeometry(postR, postR, postH, 8), DARK_WOOD,
      mainW/3, postH/2, 5.5));
    // Porch roof slab (darker wood)
    g.add(part(new THREE.BoxGeometry(mainW * 0.65, 1, 2.5), DARK_WOOD,
      0, porch_roof_y, 5.5));
  }

  return g;
}, true);

// Dead tree: bare twisted tree with dark trunk + 3-4 branch cylinders at odd angles
registerProp('deadtree', { r: 4, h: 16 }, function() {
  const g = new THREE.Group();
  const trunkColor = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  // Main trunk
  g.add(part(new THREE.CylinderGeometry(0.8, 1.2, 14, 6), trunkColor, 0, 7, 0));
  // Branches at odd angles
  const branchColor = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const branch1 = part(new THREE.CylinderGeometry(0.4, 0.2, 6, 5), branchColor, 2, 12, -1);
  branch1.rotation.z = 0.6;
  g.add(branch1);
  const branch2 = part(new THREE.CylinderGeometry(0.4, 0.2, 5.5, 5), branchColor, -2.5, 11, 1);
  branch2.rotation.z = -0.7;
  g.add(branch2);
  const branch3 = part(new THREE.CylinderGeometry(0.3, 0.15, 4.5, 5), branchColor, 1.5, 9, 2);
  branch3.rotation.z = 0.4;
  g.add(branch3);
  const branch4 = part(new THREE.CylinderGeometry(0.35, 0.18, 5, 5), branchColor, -1, 10, -2.5);
  branch4.rotation.z = -0.5;
  g.add(branch4);
  return g;
}, false);

// Scrub: low dark-olive cluster of 3 small squashed spheres
registerProp('scrub', { r: 3, h: 4 }, function() {
  const g = new THREE.Group();
  const scrubColor = new THREE.MeshLambertMaterial({ color: 0x6a6b3a });
  const s1 = part(new THREE.SphereGeometry(1.8, 6, 5), scrubColor, 0, 1.5, 0);
  s1.scale.y = 0.6;
  g.add(s1);
  const s2 = part(new THREE.SphereGeometry(1.4, 6, 5), scrubColor, 1.8, 1.2, 0.8);
  s2.scale.y = 0.6;
  g.add(s2);
  const s3 = part(new THREE.SphereGeometry(1.5, 6, 5), scrubColor, -1.5, 1.3, -1);
  s3.scale.y = 0.6;
  g.add(s3);
  return g;
}, false);

// Hitch rail: 2 short wood posts + horizontal crossbar
registerProp('hitchrail', { r: 5, h: 6 }, function() {
  const g = new THREE.Group();
  const postColor = new THREE.MeshLambertMaterial({ color: 0x7a5838 });
  // Left post
  g.add(part(new THREE.CylinderGeometry(0.6, 0.6, 5, 6), postColor, -3, 2.5, 0));
  // Right post
  g.add(part(new THREE.CylinderGeometry(0.6, 0.6, 5, 6), postColor, 3, 2.5, 0));
  // Horizontal crossbar
  g.add(part(new THREE.BoxGeometry(6.5, 0.5, 0.8), postColor, 0, 3.5, 0));
  return g;
}, false);

// Lantern post: wood pole + small warm lantern box + tiny roof cap
registerProp('lanternpost', { r: 2, h: 12 }, function() {
  const g = new THREE.Group();
  const poleColor = new THREE.MeshLambertMaterial({ color: 0x7a5838 });
  // Main pole
  g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 11, 6), poleColor, 0, 5.5, 0));
  // Lantern box
  g.add(part(new THREE.BoxGeometry(1.5, 2, 1.5), LANTERN, 0, 11, 0));
  // Tiny roof cap (cone)
  g.add(part(new THREE.ConeGeometry(1.2, 0.8, 8), poleColor, 0, 12, 0));
  return g;
}, false);

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

  // Railroad: random angle and offset, must be >= 150 units from town center
  railroadAngle = rand(0, Math.PI*2);
  let tries = 50;
  let perpDist;
  do {
    railroadX = rand(-WORLD/2, WORLD/2);
    railroadZ = rand(-WORLD/2, WORLD/2);
    // Calculate perpendicular distance from town center to railroad line
    const dx = Math.cos(railroadAngle);
    const dz = Math.sin(railroadAngle);
    const px = townX - railroadX;
    const pz = townZ - railroadZ;
    perpDist = Math.abs(px * dz - pz * dx);
  } while (tries-- > 0 && perpDist < 150);

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

  // Store debug data for smoke test
  const streetWidth = 80;
  const streetMargin = 15;
  const halfW = streetWidth / 2 + streetMargin;
  const dx = Math.cos(railroadAngle);
  const dz = Math.sin(railroadAngle);
  const perpDistToTown = Math.abs((townX - railroadX) * dz - (townZ - railroadZ) * dx);
  if (townAngle === 0 || townAngle === Math.PI) {
    this.debugTown = {
      streetRect: { minX: townX - halfW, maxX: townX + halfW, minZ: townZ - 250, maxZ: townZ + 250 },
      railLine: { baseX: railroadX, baseZ: railroadZ, angle: railroadAngle },
      railDist: 18,
      railTownDist: perpDistToTown
    };
  } else {
    this.debugTown = {
      streetRect: { minX: townX - 250, maxX: townX + 250, minZ: townZ - halfW, maxZ: townZ + halfW },
      railLine: { baseX: railroadX, baseZ: railroadZ, angle: railroadAngle },
      railDist: 18,
      railTownDist: perpDistToTown
    };
  }

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

    // Dry riverbed: wavy dark band, distinct and darker
    let riverY = townZ + rand(-200, 200);
    // Keep riverbed from crossing town rectangle
    let riverTries = 50;
    while (riverTries-- > 0 && Math.abs(riverY - townZ) <= 300) {
      riverY = townZ + rand(-500, 500);
    }
    g.strokeStyle = '#8a6b46';
    g.lineWidth = 50;
    g.beginPath();
    for (let xx = -WORLD; xx <= WORLD; xx += 50) {
      const yy = riverY + Math.sin(xx / 400) * 100;
      if (xx === -WORLD) g.moveTo(X(xx), X(yy));
      else g.lineTo(X(xx), X(yy));
    }
    g.stroke();
    // Cracked-line strokes in riverbed for texture
    for (let c = 0; c < 150; c++) {
      const cx = rand(-WORLD, WORLD);
      const cy = riverY + rand(-50, 50);
      g.strokeStyle = 'rgba(0,0,0,0.15)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(X(cx), X(cy));
      g.lineTo(X(cx + rand(-60, 60)), X(cy + rand(-60, 60)));
      g.stroke();
    }

    // Main street: darker packed red-dirt with wagon-rut lines
    const streetWidth = 80;
    if (townAngle === 0 || townAngle === Math.PI) {
      // Vertical street (Z-aligned)
      g.fillStyle = '#a97a4a';
      g.fillRect(X(townX - streetWidth/2), 0, streetWidth*sc, S);
      // Twin wagon-rut lines down the street
      g.strokeStyle = '#6a5a3a';
      g.lineWidth = Math.max(2, 2*sc);
      const rutOffset = streetWidth * 0.25;
      // Left rut
      g.beginPath();
      for (let zz = -WORLD; zz <= WORLD; zz += 40) {
        const xx = townX - rutOffset;
        if (zz === -WORLD) g.moveTo(X(xx), X(zz));
        else g.lineTo(X(xx), X(zz));
      }
      g.stroke();
      // Right rut
      g.beginPath();
      for (let zz = -WORLD; zz <= WORLD; zz += 40) {
        const xx = townX + rutOffset;
        if (zz === -WORLD) g.moveTo(X(xx), X(zz));
        else g.lineTo(X(xx), X(zz));
      }
      g.stroke();
    } else {
      // Horizontal street (X-aligned)
      g.fillStyle = '#a97a4a';
      g.fillRect(0, X(townZ - streetWidth/2), S, streetWidth*sc);
      // Twin wagon-rut lines down the street
      g.strokeStyle = '#6a5a3a';
      g.lineWidth = Math.max(2, 2*sc);
      const rutOffset = streetWidth * 0.25;
      // Front rut
      g.beginPath();
      for (let xx = -WORLD; xx <= WORLD; xx += 40) {
        const zz = townZ - rutOffset;
        if (xx === -WORLD) g.moveTo(X(xx), X(zz));
        else g.lineTo(X(xx), X(zz));
      }
      g.stroke();
      // Back rut
      g.beginPath();
      for (let xx = -WORLD; xx <= WORLD; xx += 40) {
        const zz = townZ + rutOffset;
        if (xx === -WORLD) g.moveTo(X(xx), X(zz));
        else g.lineTo(X(xx), X(zz));
      }
      g.stroke();
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

    // Denser speckle noise in 2 tones
    for (let s = 0; s < 3000; s++) {
      g.fillStyle = `rgba(0,0,0,${rand(0.01, 0.1)})`;
      g.fillRect(Math.random()*S, Math.random()*S, rand(1, 5), rand(1, 5));
    }
    for (let s = 0; s < 2000; s++) {
      g.fillStyle = `rgba(100,100,80,${rand(0.05, 0.15)})`;
      g.fillRect(Math.random()*S, Math.random()*S, rand(2, 4), rand(2, 4));
    }

    // 200-300 tiny dry-grass tuft dots
    const grassCount = 200 + ((Math.random()*100)|0);
    for (let g_i = 0; g_i < grassCount; g_i++) {
      g.fillStyle = '#b89a5c';
      const gx = Math.random() * S;
      const gz = Math.random() * S;
      g.fillRect(gx, gz, rand(1.5, 3), rand(1.5, 3));
    }
  });
}

function populate(addProp) {
  // Town: TWO proper facing rows of buildings (city-street density for a frontier strip)
  const streetAlongZ = (townAngle === 0 || townAngle === Math.PI);
  const rowDepth = 110;               // distance from street centerline to facade
  const buildingsPerSide = 11 + ((Math.random()*3)|0);  // 11–13 per side
  const streetHalfLen = 260;

  function placeTownBuilding(along, side, faceAngle) {
    let x, z;
    if (streetAlongZ) {
      z = townZ + along;
      x = townX + side * rowDepth + rand(-6, 6);
    } else {
      x = townX + along;
      z = townZ + side * rowDepth + rand(-6, 6);
    }
    addProp('woodbuilding', x, z, faceAngle);
    // Hitch rail + porch clutter between facade and street
    const hitchOff = rowDepth - 40;
    if (streetAlongZ) {
      addProp('hitchrail', townX + side * hitchOff, z, Math.PI/2);
      if (Math.random() < 0.7) addProp('barrel', townX + side * (hitchOff - 12), z + rand(-8, 8));
      if (Math.random() < 0.45) addProp('barrel', townX + side * (hitchOff - 18), z + rand(-6, 6));
    } else {
      addProp('hitchrail', x, townZ + side * hitchOff, 0);
      if (Math.random() < 0.7) addProp('barrel', x + rand(-8, 8), townZ + side * (hitchOff - 12));
      if (Math.random() < 0.45) addProp('barrel', x + rand(-6, 6), townZ + side * (hitchOff - 18));
    }
  }

  for (const side of [-1, 1]) {
    // Face the street: buildings look inward toward centerline
    const faceAngle = streetAlongZ
      ? (side < 0 ? Math.PI/2 : -Math.PI/2)
      : (side < 0 ? 0 : Math.PI);
    for (let b = 0; b < buildingsPerSide; b++) {
      const along = -streetHalfLen + (b / (buildingsPerSide - 1)) * (streetHalfLen * 2);
      placeTownBuilding(along + rand(-4, 4), side, faceAngle);
    }
  }

  // Short cross-street of extra shops (makes town feel like a real block, not one strip)
  const crossCount = 4 + ((Math.random()*2)|0);
  for (let c = 0; c < crossCount; c++) {
    const along = -40 + c * 28;
    if (streetAlongZ) {
      addProp('woodbuilding', townX + along, townZ + 200, Math.PI);
      addProp('woodbuilding', townX + along, townZ - 200, 0);
    } else {
      addProp('woodbuilding', townX + 200, townZ + along, -Math.PI/2);
      addProp('woodbuilding', townX - 200, townZ + along, Math.PI/2);
    }
  }

  // Water towers at both ends of main street
  for (const end of [-1, 1]) {
    if (streetAlongZ) {
      addProp('watertower', townX + end * 150, townZ + end * 230);
    } else {
      addProp('watertower', townX + end * 230, townZ + end * 150);
    }
  }

  // Lantern posts both sides of the street
  const lanternCount = 14;
  for (let l = 0; l < lanternCount; l++) {
    const along = -streetHalfLen + (l / (lanternCount - 1)) * (streetHalfLen * 2);
    const side = (l % 2 === 0) ? -1 : 1;
    const off = 52;
    if (streetAlongZ) addProp('lanternpost', townX + side * off, townZ + along);
    else addProp('lanternpost', townX + along, townZ + side * off);
  }

  // Railroad depot near the tracks
  {
    const dx = Math.cos(railroadAngle), dz = Math.sin(railroadAngle);
    const px = -dz, pz = dx; // perpendicular
    const depotAlong = rand(-80, 80);
    const depotX = railroadX + dx * depotAlong + px * 35;
    const depotZ = railroadZ + dz * depotAlong + pz * 35;
    addProp('woodbuilding', depotX, depotZ, railroadAngle + Math.PI/2);
    for (let b = 0; b < 8; b++)
      addProp('barrel', depotX + rand(-20, 20), depotZ + rand(-20, 20));
    addProp('wagon', depotX + px * 25, depotZ + pz * 25, railroadAngle);
    addProp('hitchrail', depotX - px * 18, depotZ - pz * 18, railroadAngle);
    for (let p = 0; p < 6; p++)
      addProp('person', depotX + rand(-25, 25), depotZ + rand(-25, 25));
  }

  // Town square life
  for (let p = 0; p < 100; p++) {
    const px = townX + rand(-220, 220);
    const pz = townZ + rand(-220, 220);
    addProp('person', px, pz);
  }
  for (let d = 0; d < 14; d++)
    addProp('dog', townX + rand(-200, 200), townZ + rand(-200, 200));

  // Barrels, longhorns, wagons near town (off the street itself)
  for (let b = 0; b < 50; b++) {
    let bx, bz, tries = 10;
    do {
      bx = townX + rand(-280, 280);
      bz = townZ + rand(-280, 280);
    } while (tries-- > 0 && (onStreet(bx, bz) || onRail(bx, bz)));
    const roll = Math.random();
    if (roll < 0.4) addProp('barrel', bx, bz, 0);
    else if (roll < 0.7) addProp('longhorn', bx, bz, 0);
    else addProp('wagon', bx, bz, Math.random() * Math.PI*2);
  }

  // Dead trees scattered throughout (50-80)
  const deadtreeCount = 50 + ((Math.random()*30)|0);
  for (let dt = 0; dt < deadtreeCount; dt++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('deadtree', x, z, 0);
  }

  // Scrub patches (70-100)
  const scrubCount = 70 + ((Math.random()*30)|0);
  for (let s = 0; s < scrubCount; s++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('scrub', x, z, 0);
  }

  for (let d = 0; d < 60; d++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('dog', x, z);
  }

  // Cacti everywhere outside town (80-130)
  const cactiCount = 80 + ((Math.random()*50)|0);
  for (let c = 0; c < cactiCount; c++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (Math.hypot(x - townX, z - townZ) < 250 || onStreet(x, z) || onRail(x, z)));
    addProp('cactus', x, z, 0);
  }

  // Tumbleweeds (30-50) - allowed on street but NOT on rail
  const tumbleweedCount = 30 + ((Math.random()*20)|0);
  for (let t = 0; t < tumbleweedCount; t++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && onRail(x, z));
    addProp('tumbleweed', x, z, 0);
  }

  // Extra cacti within 250 units of town edge (25-40, for wild west densification)
  const edgeCactiCount = 25 + ((Math.random()*15)|0);
  for (let ec = 0; ec < edgeCactiCount; ec++) {
    // Random angle from town center, distance 200-250 from town center
    let x, z, tries = 10;
    do {
      const angle = Math.random() * Math.PI*2;
      const dist = 200 + Math.random() * 50;
      x = townX + Math.cos(angle) * dist;
      z = townZ + Math.sin(angle) * dist;
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
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

  // Ranches: full rectangular corral + barn + house + windmill + cattle
  for (const ranch of ranches) {
    const half = 100;
    // Rectangular fence (city fence segments)
    for (let t = -half; t <= half; t += 22) {
      addProp('fence', ranch.x + t, ranch.z - half, 0);
      addProp('fence', ranch.x + t, ranch.z + half, 0);
      addProp('fence', ranch.x - half, ranch.z + t, Math.PI/2);
      addProp('fence', ranch.x + half, ranch.z + t, Math.PI/2);
    }
    addProp('woodbuilding', ranch.x - 45, ranch.z - 30, ranch.ranchAngle);
    addProp('woodbuilding', ranch.x + 35, ranch.z - 40, ranch.ranchAngle + 0.2);
    addProp('windmill', ranch.x + 55, ranch.z + 40, 0);
    addProp('watertower', ranch.x - 60, ranch.z + 50, 0);
    addProp('hitchrail', ranch.x, ranch.z - 55, ranch.ranchAngle);
    for (let b = 0; b < 6; b++)
      addProp('barrel', ranch.x + rand(-50, 50), ranch.z + rand(-50, 50));
    addProp('wagon', ranch.x + 20, ranch.z + 55, ranch.ranchAngle);
    const hornCount = 10 + ((Math.random()*5)|0);
    for (let h = 0; h < hornCount; h++)
      addProp('longhorn', ranch.x + rand(-75, 75), ranch.z + rand(-75, 75), 0);
    for (let p = 0; p < 5; p++)
      addProp('person', ranch.x + rand(-60, 60), ranch.z + rand(-60, 60));
    for (let d = 0; d < 2; d++)
      addProp('dog', ranch.x + rand(-50, 50), ranch.z + rand(-50, 50));
  }

  // Landmark mesa clusters (readable rock formations, not just spray)
  const mesaClusters = 3 + ((Math.random()*2)|0);
  for (let m = 0; m < mesaClusters; m++) {
    let mx, mz, tries = 20;
    do {
      mx = rand(-WORLD + 200, WORLD - 200);
      mz = rand(-WORLD + 200, WORLD - 200);
    } while (tries-- > 0 && (Math.hypot(mx - townX, mz - townZ) < 350 || onRail(mx, mz)));
    const rocks = 10 + ((Math.random()*6)|0);
    for (let r = 0; r < rocks; r++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = rand(5, 55);
      addProp('mesa_rock', mx + Math.cos(ang)*rr, mz + Math.sin(ang)*rr, 0);
    }
    if (Math.random() < 0.6) addProp('deadtree', mx + rand(-20, 20), mz + rand(-20, 20));
    if (Math.random() < 0.5) addProp('cactus', mx + rand(-40, 40), mz + rand(-40, 40));
  }

  // Scattered mesa rocks for landscape fill
  const rockCount = 70 + ((Math.random()*40)|0);
  for (let r = 0; r < rockCount; r++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('mesa_rock', x, z, 0);
  }

  // Scattered barrels outside town (period-appropriate)
  for (let b = 0; b < 60; b++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('barrel', x, z, 0);
  }

  // Additional scrub for landscape fill (keep theme consistent, no modern props)
  const extraScrub = 50 + ((Math.random()*40)|0);
  for (let s = 0; s < extraScrub; s++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('scrub', x, z, 0);
  }

  // Extra dead trees for landscape
  const extraDeadtree = 50 + ((Math.random()*30)|0);
  for (let dt = 0; dt < extraDeadtree; dt++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && (onStreet(x, z) || onRail(x, z)));
    addProp('deadtree', x, z, 0);
  }

  // Extra tumbleweeds for atmosphere
  const extraTumbleweed = 30 + ((Math.random()*20)|0);
  for (let et = 0; et < extraTumbleweed; et++) {
    let x, z, tries = 10;
    do {
      x = rand(-WORLD + 150, WORLD - 150);
      z = rand(-WORLD + 150, WORLD - 150);
    } while (tries-- > 0 && onRail(x, z));
    addProp('tumbleweed', x, z, 0);
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
