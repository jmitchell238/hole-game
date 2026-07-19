// The Medieval level: a castle on a hill with walled keep, villages, farms, and forest.
// Every match rolls a new kingdom with different village placements and farm layouts.
(function () {

let WORLD;
let castleX, castleZ;          // castle center
let villages = [];             // { x, z, wells: number }
let farms = [];                // { x, z, angle }
let forestPatches = [];        // { x, z, R }

// Medieval palette: stone and timber, castle feel
const MEDIEVAL_PALETTE = {
  primary:   0xb8a882,    // stone buildings
  accent1:   0x8b6f47,    // timber brown
  accent2:   0x5a4a3a,    // dark brown wood
  dark:      0x3a3a3a,    // dark gray shadows
  ground:    0x7a8a8a,    // cool gray ground
  sky:       0x8a9aaa,    // overcast gray-blue
};

// ---- Medieval-specific props -------------------------------------------------------
const WHITEWASH = new THREE.MeshLambertMaterial({ color: 0xf2f0e8 });
const TIMBER = new THREE.MeshLambertMaterial({ color: 0x8a6642 });
const THATCH = new THREE.MeshLambertMaterial({ color: 0x9a7a3f });
const STONE = new THREE.MeshLambertMaterial({ color: 0x9aa2a8 });
const YELLOW = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
const WATER = new THREE.MeshLambertMaterial({ color: 0x3f7a96 });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xff8c3a });

// Cottage: whitewash box + brown timber X strips + steep thatch roof
registerProp('cottage', { r: 10, h: 16 }, function() {
  const g = new THREE.Group();
  // Main whitewash walls
  g.add(part(new THREE.BoxGeometry(14, 10, 12), WHITEWASH, 0, 5, 0));

  // Timber X-braces on front
  const brace1 = part(new THREE.BoxGeometry(0.6, 11, 0.6), TIMBER, -4, 5.5, 6.1);
  brace1.rotation.z = 0.35; g.add(brace1);
  const brace2 = part(new THREE.BoxGeometry(0.6, 11, 0.6), TIMBER, 4, 5.5, 6.1);
  brace2.rotation.z = -0.35; g.add(brace2);

  // Steep thatch roof (2 cone pieces for pitched roof)
  const roof = part(new THREE.ConeGeometry(8.5, 6.5, 10), THATCH, 0, 14, 0);
  roof.rotation.z = 0.35; g.add(roof);
  const roof2 = part(new THREE.ConeGeometry(8.5, 6.5, 10), THATCH, 0, 14, 0);
  roof2.rotation.z = -0.35; g.add(roof2);

  return g;
}, true);

// Well: stone ring + 2 posts + tiny roof
registerProp('well', { r: 3.5, h: 8 }, function() {
  const g = new THREE.Group();
  // Stone ring (cylinder sides)
  g.add(part(new THREE.CylinderGeometry(3.2, 3.0, 2.5, 8), STONE, 0, 1.25, 0));
  // Two posts
  g.add(part(new THREE.CylinderGeometry(0.4, 0.4, 5, 6), TIMBER, -3, 2.5, 0));
  g.add(part(new THREE.CylinderGeometry(0.4, 0.4, 5, 6), TIMBER, 3, 2.5, 0));
  // Tiny roof piece
  g.add(part(new THREE.ConeGeometry(3.5, 1.2, 8), THATCH, 0, 6.8, 0));
  return g;
}, false);

// Haybale: lying yellow cylinder
registerProp('haybale', { r: 3, h: 5 }, function() {
  const g = new THREE.Group();
  const bale = part(new THREE.CylinderGeometry(3, 3, 6, 8), YELLOW, 0, 2.5, 0);
  bale.rotation.z = Math.PI/2;
  g.add(bale);
  return g;
}, false);

// Cart: wood box + 2 big wheels + handles
registerProp('cart', { r: 7, h: 8 }, function() {
  const g = new THREE.Group();
  // Wooden box bed
  g.add(part(new THREE.BoxGeometry(10, 4, 6), TIMBER, 0, 2, 0));
  // 2 big wheels (front and back)
  const wheelR = 2, wheelH = 0.5;
  g.add(part(new THREE.CylinderGeometry(wheelR, wheelR, wheelH, 10), STONE, -5.5, wheelR, 0));
  g.add(part(new THREE.CylinderGeometry(wheelR, wheelR, wheelH, 10), STONE, 5.5, wheelR, 0));
  // Handles (posts leaning forward)
  const handleL = part(new THREE.CylinderGeometry(0.3, 0.3, 3.5, 6), TIMBER, -3, 4, 3);
  handleL.rotation.z = 0.3; g.add(handleL);
  const handleR = part(new THREE.CylinderGeometry(0.3, 0.3, 3.5, 6), TIMBER, 3, 4, 3);
  handleR.rotation.z = -0.3; g.add(handleR);
  return g;
}, false);

// Stall: market stand posts + striped canopy (2 colors)
registerProp('stall', { r: 6, h: 10 }, function() {
  const g = new THREE.Group();
  // 4 corner posts
  for (const [px, pz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]])
    g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 7, 6), TIMBER, px, 3.5, pz));

  // Striped canopy (base)
  const stripe1 = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const stripe2 = new THREE.MeshLambertMaterial({ color: 0xd2691e });
  g.add(part(new THREE.BoxGeometry(10, 1, 8), stripe1, 0, 7.5, 0));
  // Stripes on canopy
  for (let s = 0; s < 4; s++) {
    const sx = -4.5 + s*2.25;
    g.add(part(new THREE.BoxGeometry(2, 0.8, 8.2), stripe2, sx, 7.6, 0));
  }

  return g;
}, false);

// Sheep: white blob + dark head + 4 stub legs
registerProp('sheep', { r: 3, h: 5 }, function() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });

  // Body (sphere/box for wool)
  g.add(part(new THREE.BoxGeometry(4, 3, 5), white, 0, 2.5, 0));
  // Head (smaller sphere)
  g.add(part(new THREE.SphereGeometry(1.5, 8, 6), dark, 2, 4, 0));
  // 4 stub legs
  for (const [lx, lz] of [[-1.2, -1.5], [1.2, -1.5], [-1.2, 1.5], [1.2, 1.5]])
    g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 6), dark, lx, 0.9, lz));

  return g;
}, false);

// Castle tower: stone cylinder + crenellation ring + cone roof + flag
registerProp('castletower', { r: 12, h: 52 }, function() {
  const g = new THREE.Group();
  // Main stone cylinder
  g.add(part(new THREE.CylinderGeometry(10, 10, 44, 12), STONE, 0, 22, 0));

  // Crenellation: ring of small boxes at top
  const crenH = 4, crenW = 2.5;
  for (let c = 0; c < 8; c++) {
    const angle = c / 8 * Math.PI * 2;
    const cx = Math.cos(angle) * 11;
    const cz = Math.sin(angle) * 11;
    g.add(part(new THREE.BoxGeometry(crenW, crenH, crenW), STONE, cx, 44, cz));
  }

  // Cone roof
  g.add(part(new THREE.ConeGeometry(12, 8, 12), STONE, 0, 50, 0));

  // Flag (gold stripe at top)
  g.add(part(new THREE.BoxGeometry(0.3, 6, 2), YELLOW, 0, 50, 0));

  return g;
}, true);

// Castle wall: long stone box with crenellation teeth
registerProp('castlewall', { r: 16, h: 24 }, function() {
  const g = new THREE.Group();
  // Main wall slab
  g.add(part(new THREE.BoxGeometry(28, 20, 2), STONE, 0, 10, 0));

  // Crenellation teeth along top
  for (let t = 0; t < 10; t++) {
    const tx = -12 + t * 2.8;
    g.add(part(new THREE.BoxGeometry(2, 5, 2), STONE, tx, 21, 0));
  }

  return g;
}, true);

// Keep: big stone box + smaller box on top + 4 mini turrets + banner (LANDMARK)
registerProp('keep', { r: 20, h: 64 }, function() {
  const g = new THREE.Group();
  // Main keep body
  g.add(part(new THREE.BoxGeometry(32, 36, 28), STONE, 0, 18, 0));

  // Upper section (smaller)
  g.add(part(new THREE.BoxGeometry(24, 16, 20), STONE, 0, 44, 0));

  // 4 mini corner turrets
  const turretH = 12;
  for (const [tx, tz] of [[-13, -11], [13, -11], [-13, 11], [13, 11]]) {
    g.add(part(new THREE.CylinderGeometry(4, 4, turretH, 8), STONE, tx, 50, tz));
    // Turret cones
    g.add(part(new THREE.ConeGeometry(5, 4, 8), STONE, tx, 56, tz));
  }

  // Banner (large gold flag at top center)
  g.add(part(new THREE.BoxGeometry(0.4, 12, 8), YELLOW, 0, 58, 0));

  return g;
}, true);

// Church: nave box + steeple cone + cross
registerProp('church', { r: 12, h: 34 }, function() {
  const g = new THREE.Group();
  const CROSS = new THREE.MeshLambertMaterial({ color: 0xe8b08f });

  // Nave (main body)
  g.add(part(new THREE.BoxGeometry(16, 18, 20), WHITEWASH, 0, 9, 0));

  // Steeple cone
  g.add(part(new THREE.ConeGeometry(8, 14, 8), STONE, 0, 27, 0));

  // Cross at steeple top (two perpendicular bars)
  g.add(part(new THREE.BoxGeometry(0.5, 6, 0.5), CROSS, 0, 32, 0));
  g.add(part(new THREE.BoxGeometry(5, 0.5, 0.5), CROSS, 0, 30, 0));

  return g;
}, true);

// Torch: post + emissive orange flame sphere
registerProp('torch', { r: 1.2, h: 6 }, function() {
  const g = new THREE.Group();
  // Post
  g.add(part(new THREE.CylinderGeometry(0.3, 0.3, 4.5, 6), TIMBER, 0, 2.25, 0));
  // Flame (emissive)
  g.add(part(new THREE.SphereGeometry(1.0, 6, 6), FLAME, 0, 5.0, 0));
  return g;
}, false);

// Gatehouse: arched stone entry with twin turrets
registerProp('gatehouse', { r: 18, h: 40 }, function() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(28, 28, 14), STONE, 0, 14, 0));
  // Arch opening
  g.add(part(new THREE.BoxGeometry(10, 14, 15), new THREE.MeshLambertMaterial({ color: 0x2a211a }), 0, 7, 0));
  // Twin turrets
  for (const tx of [-12, 12]) {
    g.add(part(new THREE.CylinderGeometry(5, 5, 18, 10), STONE, tx, 30, 0));
    g.add(part(new THREE.ConeGeometry(6, 6, 8), STONE, tx, 42, 0));
  }
  // Banner
  g.add(part(new THREE.BoxGeometry(0.4, 8, 5), YELLOW, 0, 32, 8));
  return g;
}, true);

// Grain mill: round stone base + thatch cone + cross sails
registerProp('mill', { r: 12, h: 36 }, function() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(9, 10, 22, 12), STONE, 0, 11, 0));
  g.add(part(new THREE.ConeGeometry(11, 10, 10), THATCH, 0, 26, 0));
  // Wind sails (cross)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI/2 + 0.4;
    const sail = part(new THREE.BoxGeometry(2, 0.5, 16), TIMBER,
      Math.cos(a)*6, 22, Math.sin(a)*6);
    sail.rotation.y = a;
    g.add(sail);
  }
  return g;
}, true);

// Local rock if island hasn't registered yet (defensive)
if (!STATS.rock) {
  registerProp('rock', { r: 6, h: 8 }, function () {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = rand(2.2, 4.4);
      const m = part(new THREE.DodecahedronGeometry(s, 0), STONE,
        rand(-3, 3), s*0.7, rand(-3, 3));
      m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(m);
    }
    return g;
  }, false);
}

// ---- Medieval layout generation ----
function generate() {
  WORLD = Math.round(rand(900, 1200));

  // Castle at center
  castleX = 0;
  castleZ = 0;

  // 2–4 villages at distance
  villages = [];
  const villageCount = 2 + ((Math.random()*2)|0);
  for (let v = 0; v < villageCount; v++) {
    const angle = (v / villageCount) * Math.PI * 2 + rand(-0.3, 0.3);
    const distance = rand(300, 450);
    const vx = castleX + Math.cos(angle) * distance;
    const vz = castleZ + Math.sin(angle) * distance;
    villages.push({ x: vx, z: vz, wellCount: 1 + ((Math.random()*1)|0) });
  }

  // 4–8 farm fields near villages
  farms = [];
  const farmCount = 4 + ((Math.random()*4)|0);
  for (let f = 0; f < farmCount; f++) {
    const village = villages[f % villages.length];
    const angle = Math.random() * Math.PI * 2;
    const distance = rand(80, 140);
    const fx = village.x + Math.cos(angle) * distance;
    const fz = village.z + Math.sin(angle) * distance;
    farms.push({ x: fx, z: fz, angle: Math.random() * Math.PI });
  }

  // Forest patches: 30–50% of remaining space
  forestPatches = [];
  const forestCount = 8 + ((Math.random()*7)|0);
  for (let f = 0; f < forestCount; f++) {
    let x, z, tries = 30;
    do {
      x = rand(-WORLD + 100, WORLD - 100);
      z = rand(-WORLD + 100, WORLD - 100);
    } while (tries-- > 0 && (
      dist(x, z, castleX, castleZ) < 250 ||
      villages.some(v => dist(x, z, v.x, v.z) < 150) ||
      farms.some(f => dist(x, z, f.x, f.z) < 120) ||
      forestPatches.some(p => dist(x, z, p.x, p.z) < 150)
    ));
    forestPatches.push({ x, z, R: rand(60, 120) });
  }

  this.world = WORLD;

  // Player spawn in a village
  const playerVillage = villages[0];
  this.playerSpawn = [playerVillage.x + rand(-80, 80), playerVillage.z + rand(-80, 80)];

  // Bots: 3 near player's village, 4 scattered
  const spots = [];
  for (let i = 0; i < 7; i++) {
    if (i < 3) {
      // Near player village
      spots.push([
        playerVillage.x + rand(-100, 100),
        playerVillage.z + rand(-100, 100)
      ]);
    } else {
      // Scattered
      let x, z, tries = 20;
      do {
        x = rand(-WORLD + 50, WORLD - 50);
        z = rand(-WORLD + 50, WORLD - 50);
      } while (tries-- > 0 && (
        dist(x, z, castleX, castleZ) < 200 ||
        villages.some(v => dist(x, z, v.x, v.z) < 100)
      ));
      spots.push([x, z]);
    }
  }
  this.botSpawns = spots;
}

// Medieval ground: meadow green + tone noise + roads + farms + moat + forest floor
function medievalGroundTexture() {
  const S = 4096;
  return canvasTex(S, S, g => {
    const sc = S / (2*WORLD);
    const X = w => (w + WORLD) * sc;

    // Base meadow green
    g.fillStyle = '#7fae5c';
    g.fillRect(0, 0, S, S);

    // Tone noise for meadow variation
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(0,0,0,${rand(0.02, 0.08)})`;
      g.fillRect(Math.random()*S, Math.random()*S, rand(2, 5), rand(2, 5));
    }

    // Dirt roads connecting castle to villages
    g.strokeStyle = '#a98a5e';
    g.lineWidth = Math.max(6, 6*sc);
    for (const v of villages) {
      g.beginPath();
      g.moveTo(X(castleX), X(castleZ));
      g.lineTo(X(v.x), X(v.z));
      g.stroke();
    }

    // Farm plots (rectangles of crop color with row lines)
    for (const f of farms) {
      const w = 80, h = 50;
      const rotX = Math.cos(f.angle), rotZ = Math.sin(f.angle);
      // Farm base color
      g.fillStyle = '#c9a860';
      g.save();
      g.translate(X(f.x), X(f.z));
      g.rotate(f.angle);
      g.fillRect(-w*sc/2, -h*sc/2, w*sc, h*sc);
      // Darker row lines
      g.strokeStyle = '#9a8a40';
      g.lineWidth = 1;
      for (let y = -h/2; y <= h/2; y += 12) {
        g.beginPath();
        g.moveTo(-w*sc/2, (y)*sc);
        g.lineTo(w*sc/2, (y)*sc);
        g.stroke();
      }
      g.restore();
    }

    // Moat ring around castle (water)
    const moatR = 100;
    g.strokeStyle = '#3f7a96';
    g.lineWidth = Math.max(10, 10*sc);
    g.beginPath();
    g.arc(X(castleX), X(castleZ), moatR*sc, 0, Math.PI*2);
    g.stroke();

    // Forest floor darker green patches
    for (const p of forestPatches) {
      const darkGreen = new THREE.Color(0x5a8a3f);
      g.fillStyle = '#5a8a3f';
      g.beginPath();
      g.arc(X(p.x), X(p.z), p.R*sc*0.9, 0, Math.PI*2);
      g.fill();
    }

    // Wildflower dots
    for (let w = 0; w < 300; w++) {
      g.fillStyle = `rgba(255,200,100,${rand(0.3, 0.6)})`;
      const dotR = rand(0.5, 1.5);
      g.beginPath();
      g.arc(Math.random()*S, Math.random()*S, dotR, 0, Math.PI*2);
      g.fill();
    }
  });
}

// Populate the medieval kingdom
function populate(addProp) {
  // Castle complex: keep + inner towers + outer wall ring + gatehouse
  addProp('keep', castleX, castleZ);

  const keepR = 32;
  // 4 inner corner towers
  for (const [tx, tz] of [[-keepR, -keepR], [keepR, -keepR], [-keepR, keepR], [keepR, keepR]]) {
    addProp('castletower', castleX + tx, castleZ + tz);
  }

  // Inner walls
  const wallOffsets = [
    { x: 0, z: -keepR - 12, angle: 0 },
    { x: 0, z: keepR + 12, angle: 0 },
    { x: -keepR - 12, z: 0, angle: Math.PI/2 },
    { x: keepR + 12, z: 0, angle: Math.PI/2 }
  ];
  for (const w of wallOffsets) {
    addProp('castlewall', castleX + w.x, castleZ + w.z, w.angle);
  }

  // Outer bailey: 6 towers on a ring + walls between them
  const outerR = 95;
  const outerTowers = 6;
  for (let t = 0; t < outerTowers; t++) {
    const a0 = t / outerTowers * Math.PI * 2;
    const a1 = (t + 1) / outerTowers * Math.PI * 2;
    addProp('castletower', castleX + Math.cos(a0)*outerR, castleZ + Math.sin(a0)*outerR);
    const mid = (a0 + a1) / 2;
    const wr = outerR - 6;
    addProp('castlewall',
      castleX + Math.cos(mid)*wr,
      castleZ + Math.sin(mid)*wr,
      mid + Math.PI/2);
  }

  // Gatehouse facing first village
  {
    const v0 = villages[0];
    const ga = Math.atan2(v0.z - castleZ, v0.x - castleX);
    addProp('gatehouse',
      castleX + Math.cos(ga)*(outerR + 8),
      castleZ + Math.sin(ga)*(outerR + 8),
      ga + Math.PI/2);
  }

  // Torches around outer wall
  for (let t = 0; t < 18; t++) {
    const angle = t / 18 * Math.PI * 2;
    const tr = outerR + 18;
    addProp('torch', castleX + Math.cos(angle)*tr, castleZ + Math.sin(angle)*tr);
  }

  // Knights in bailey + keep yard
  for (let k = 0; k < 16; k++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rand(15, outerR - 15);
    addProp('person', castleX + Math.cos(angle)*r, castleZ + Math.sin(angle)*r);
  }
  for (let k = 0; k < 4; k++)
    addProp('cart', castleX + rand(-40, 40), castleZ + rand(-40, 40));

  // Villages: ring layout around well + market square (readable settlements)
  for (let vi = 0; vi < villages.length; vi++) {
    const v = villages[vi];

    // Center well + market stalls
    addProp('well', v.x, v.z);
    const stallCount = 4 + ((Math.random()*2)|0);
    for (let s = 0; s < stallCount; s++) {
      const angle = s / stallCount * Math.PI * 2;
      addProp('stall', v.x + Math.cos(angle)*28, v.z + Math.sin(angle)*28, angle + Math.PI);
    }
    addProp('cart', v.x + 18, v.z - 10, 0.4);
    addProp('cart', v.x - 15, v.z + 12, -0.5);

    // Cottages in two rings facing the square
    const cottageCount = 14 + ((Math.random()*5)|0);  // 14–18
    for (let c = 0; c < cottageCount; c++) {
      const ring = (c < cottageCount * 0.55) ? 0 : 1;
      const idx = ring === 0 ? c : c - Math.floor(cottageCount * 0.55);
      const nRing = ring === 0 ? Math.ceil(cottageCount * 0.55) : cottageCount - Math.ceil(cottageCount * 0.55);
      const angle = idx / nRing * Math.PI * 2 + rand(-0.08, 0.08);
      const r = (ring === 0 ? 55 : 95) + rand(-6, 6);
      addProp('cottage',
        v.x + Math.cos(angle)*r,
        v.z + Math.sin(angle)*r,
        angle + Math.PI);
    }

    // Extra wells
    for (let w = 1; w < v.wellCount; w++) {
      const angle = Math.random() * Math.PI * 2;
      addProp('well', v.x + Math.cos(angle)*70, v.z + Math.sin(angle)*70);
    }

    // Village clutter
    for (let h = 0; h < 12; h++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(40, 120);
      addProp('haybale', v.x + Math.cos(angle)*r, v.z + Math.sin(angle)*r, Math.random()*Math.PI*2);
    }
    for (let p = 0; p < 22; p++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(20, 130);
      addProp('person', v.x + Math.cos(angle)*r, v.z + Math.sin(angle)*r);
    }
    for (let d = 0; d < 5; d++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(30, 110);
      addProp('dog', v.x + Math.cos(angle)*r, v.z + Math.sin(angle)*r);
    }
    for (let s = 0; s < 4; s++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(50, 115);
      addProp('sheep', v.x + Math.cos(angle)*r, v.z + Math.sin(angle)*r);
    }
    // Orchard fringe
    for (let t = 0; t < 8; t++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(110, 150);
      addProp('tree', v.x + Math.cos(angle)*r, v.z + Math.sin(angle)*r);
    }

    // Church near first village
    if (vi === 0) {
      const angle = Math.random() * Math.PI * 2;
      addProp('church', v.x + Math.cos(angle)*140, v.z + Math.sin(angle)*140, angle);
    }
  }

  // Farms: fenced plots + denser livestock + one mill
  for (let fi = 0; fi < farms.length; fi++) {
    const f = farms[fi];
    const halfW = 45, halfH = 30;
    // Fence outline
    for (let t = -halfW; t <= halfW; t += 18) {
      addProp('fence', f.x + t, f.z - halfH, f.angle);
      addProp('fence', f.x + t, f.z + halfH, f.angle);
    }
    for (let t = -halfH; t <= halfH; t += 18) {
      addProp('fence', f.x - halfW, f.z + t, f.angle + Math.PI/2);
      addProp('fence', f.x + halfW, f.z + t, f.angle + Math.PI/2);
    }

    for (let h = 0; h < 8; h++) {
      addProp('haybale', f.x + rand(-40, 40), f.z + rand(-25, 25), Math.random()*Math.PI*2);
    }
    for (let s = 0; s < 12; s++) {
      addProp('sheep', f.x + rand(-42, 42), f.z + rand(-28, 28));
    }
    for (let p = 0; p < 3; p++) {
      addProp('person', f.x + rand(-35, 35), f.z + rand(-20, 20));
    }
    if (fi === 0) addProp('mill', f.x + 55, f.z + 40, f.angle);
    else if (Math.random() < 0.35) addProp('cart', f.x + 30, f.z, f.angle);
  }

  // Road traffic: carts, people, stalls between castle and villages
  for (const v of villages) {
    for (let s = 1; s <= 4; s++) {
      const t = s / 5;
      const x = castleX + (v.x - castleX) * t + rand(-20, 20);
      const z = castleZ + (v.z - castleZ) * t + rand(-20, 20);
      if (Math.random() < 0.55) addProp('person', x, z);
      if (Math.random() < 0.35) addProp('cart', x + rand(-12, 12), z + rand(-12, 12));
      if (Math.random() < 0.25) addProp('stall', x + rand(-18, 18), z + rand(-18, 18));
      if (Math.random() < 0.4) addProp('torch', x + rand(-15, 15), z + rand(-15, 15));
    }
  }

  // Forest: the main filler — 25-35 clusters of 20-35 trees each + rocks + wanderers
  const forestClusterCount = 25 + ((Math.random()*10)|0);
  for (let c = 0; c < forestClusterCount; c++) {
    let x, z, tries = 30;
    do {
      x = rand(-WORLD + 80, WORLD - 80);
      z = rand(-WORLD + 80, WORLD - 80);
    } while (tries-- > 0 && (
      dist(x, z, castleX, castleZ) < 220 ||
      villages.some(v => dist(x, z, v.x, v.z) < 120) ||
      farms.some(f => dist(x, z, f.x, f.z) < 100) ||
      forestPatches.some(p => dist(x, z, p.x, p.z) < 80)
    ));

    const clusterR = rand(100, 160);
    // 20–35 trees per cluster (increased from 12-25)
    const treeCount = 20 + ((Math.random()*15)|0);
    for (let t = 0; t < treeCount; t++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(5, clusterR * 0.85);
      addProp('tree', x + Math.cos(angle)*r, z + Math.sin(angle)*r);
    }

    // Rocks (5–8 per cluster, increased)
    const rockCount = 5 + ((Math.random()*3)|0);
    for (let r = 0; r < rockCount; r++) {
      const angle = Math.random() * Math.PI * 2;
      const rr = rand(10, clusterR * 0.9);
      addProp('rock', x + Math.cos(angle)*rr, z + Math.sin(angle)*rr);
    }

    // Wanderers (people/dogs) in forest (2–4 per cluster, increased)
    const wandererCount = 2 + ((Math.random()*2)|0);
    for (let w = 0; w < wandererCount; w++) {
      const angle = Math.random() * Math.PI * 2;
      const rr = rand(15, clusterR * 0.7);
      if (Math.random() < 0.7) {
        addProp('person', x + Math.cos(angle)*rr, z + Math.sin(angle)*rr);
      } else {
        addProp('dog', x + Math.cos(angle)*rr, z + Math.sin(angle)*rr);
      }
    }

    // Haybales scattered in forest (1–3 per cluster)
    if (Math.random() < 0.5) {
      const hayCount = 1 + ((Math.random()*2)|0);
      for (let h = 0; h < hayCount; h++) {
        const angle = Math.random() * Math.PI * 2;
        const rr = rand(20, clusterR * 0.8);
        addProp('haybale', x + Math.cos(angle)*rr, z + Math.sin(angle)*rr);
      }
    }
  }

  // Additional forest from forestPatches array
  for (const p of forestPatches) {
    // 20–35 trees per patch (increased)
    const treeCount = 20 + ((Math.random()*15)|0);
    for (let t = 0; t < treeCount; t++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(5, p.R * 0.8);
      addProp('tree', p.x + Math.cos(angle)*r, p.z + Math.sin(angle)*r);
    }

    // Rocks (5–8 per patch, increased)
    const rockCount = 5 + ((Math.random()*3)|0);
    for (let r = 0; r < rockCount; r++) {
      const angle = Math.random() * Math.PI * 2;
      const rr = rand(10, p.R * 0.9);
      addProp('rock', p.x + Math.cos(angle)*rr, p.z + Math.sin(angle)*rr);
    }

    // Wanderers (2–3 per patch, increased)
    const wandCount = 2 + ((Math.random()*1)|0);
    for (let w = 0; w < wandCount; w++) {
      const angle = Math.random() * Math.PI * 2;
      const rr = rand(20, p.R * 0.7);
      if (Math.random() < 0.7) {
        addProp('person', p.x + Math.cos(angle)*rr, p.z + Math.sin(angle)*rr);
      } else {
        addProp('dog', p.x + Math.cos(angle)*rr, p.z + Math.sin(angle)*rr);
      }
    }

    // Haybales in forest patches (1–2)
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const rr = rand(20, p.R * 0.7);
      addProp('haybale', p.x + Math.cos(angle)*rr, p.z + Math.sin(angle)*rr);
    }
  }

  // Sprinkle 60–100 lone trees/bushes along roads and meadows (increased from 30-60)
  const loneTreeCount = 60 + ((Math.random()*40)|0);
  for (let l = 0; l < loneTreeCount; l++) {
    let x, z, tries = 20;
    do {
      x = rand(-WORLD + 40, WORLD - 40);
      z = rand(-WORLD + 40, WORLD - 40);
    } while (tries-- > 0 && (
      dist(x, z, castleX, castleZ) < 180 ||
      villages.some(v => dist(x, z, v.x, v.z) < 80) ||
      farms.some(f => dist(x, z, f.x, f.z) < 60) ||
      forestPatches.some(p => dist(x, z, p.x, p.z) < p.R * 0.9)
    ));

    if (Math.random() < 0.75) {
      addProp('tree', x, z);
    } else {
      addProp('bush', x, z);
    }
  }

}

registerLevel({
  id: 'medieval',
  name: 'Medieval',
  palette: MEDIEVAL_PALETTE,
  sky: 0xbfd8e8,
  fog: [750, 2400],
  hemi: [0xdcecf5, 0x5f7a4a, 0.95],
  sunColor: 0xfff0cc,
  soil: ['#5f4a33', '#2a211a'],
  skirtColor: 0x4a3a2a,
  progressLabel: 'Kingdom devoured',
  matchTime: 210,
  generate,
  createGroundTexture: medievalGroundTexture,
  populate,
});

})();
