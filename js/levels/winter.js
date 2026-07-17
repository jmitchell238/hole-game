// The Winter City level: a snow-covered procedural city with festive landmarks.
// Reuses city.js structure (grid roll / planCity / pickBotSpawns) with winter theming.
(function () {

// Rolled fresh by generate() at the start of every match.
let GRID_N, BLOCK, ROAD, P, WORLD;
let blockPlan = [];
let spawnI, spawnJ;             // which block the player spawns in (a park)

const blockOrigin = (i, j) => [ -WORLD + ROAD + i*P, -WORLD + ROAD + j*P ];

// District plan: one downtown cluster (two on big maps) seeded at random,
// parks scattered through the rest, suburbs everywhere else. The player's
// spawn block is always a park, somewhere near the middle.
function planCity() {
  const midIdx = n => (n % 2) ? (n-1)/2 : n/2 - (Math.random() < 0.5 ? 1 : 0);
  spawnI = midIdx(GRID_N);
  spawnJ = midIdx(GRID_N);

  const seedCount = (GRID_N >= 6 || Math.random() < 0.4) ? 2 : 1;
  const seeds = [];
  while (seeds.length < seedCount) {
    const si = (Math.random()*GRID_N)|0, sj = (Math.random()*GRID_N)|0;
    if (si === spawnI && sj === spawnJ) continue;
    seeds.push([si, sj]);
  }

  blockPlan = [];
  for (let i = 0; i < GRID_N; i++) {
    blockPlan[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      if (i === spawnI && j === spawnJ) { blockPlan[i][j] = 'park'; continue; }
      const nearSeed = seeds.some(([si, sj]) =>
        Math.max(Math.abs(i-si), Math.abs(j-sj)) <= 1);
      blockPlan[i][j] = nearSeed
        ? (Math.random() < 0.85 ? 'downtown' : 'park')
        : (Math.random() < 0.2 ? 'park' : 'residential');
    }
  }
}

// Bots start on random intersections, none right on top of the player.
function pickBotSpawns(px, pz) {
  const pts = [];
  for (let k = 0; k <= GRID_N; k++) for (let l = 0; l <= GRID_N; l++) {
    const x = -WORLD + k*P + ROAD/2, z = -WORLD + l*P + ROAD/2;
    if (dist(x, z, px, pz) < P*1.2) continue;
    pts.push([x, z]);
  }
  pts.sort(() => Math.random() - 0.5);
  return pts.slice(0, 7);
}

function generate() {
  // Smaller grid on tablet — Winter was ~2500+ props and melted A9X late-game
  GRID_N = (typeof GFX !== 'undefined' && GFX.lowEnd)
    ? 4
    : 5 + ((Math.random() * 2) | 0);
  BLOCK  = Math.round(rand(215, 265));
  ROAD   = Math.round(rand(42, 62));
  P      = BLOCK + ROAD;
  WORLD  = (GRID_N * P + ROAD) / 2;
  planCity();
  this.world = WORLD;
  const [x0, z0] = blockOrigin(spawnI, spawnJ);
  this.playerSpawn = [x0 + BLOCK/2, z0 + BLOCK/2];
  this.botSpawns = pickBotSpawns(this.playerSpawn[0], this.playerSpawn[1]);
}

// The winter ground: snow lawns, asphalt with snow edges, frozen ponds in parks.
function winterGroundTexture() {
  const S = 4096;
  return canvasTex(S, S, g => {
    const sc = S / (2*WORLD);
    const X = w => (w + WORLD) * sc;
    g.fillStyle = '#3c4149'; g.fillRect(0, 0, S, S);            // asphalt base

    // Snow edges on streets (white curb lines)
    g.strokeStyle = '#f2f4f6'; g.lineWidth = Math.max(4, 4.4*sc);
    g.setLineDash([]);
    g.beginPath();
    for (let k = 0; k <= GRID_N; k++) {
      const rc = X(-WORLD + k*P + ROAD/2);
      g.moveTo(0, rc); g.lineTo(S, rc);
      g.moveTo(rc, 0); g.lineTo(rc, S);
    }
    g.stroke();

    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const [x0, z0] = blockOrigin(i, j), type = blockPlan[i][j];
      g.fillStyle = '#cfd6dd';                                   // sidewalk
      g.fillRect(X(x0), X(z0), BLOCK*sc, BLOCK*sc);
      g.strokeStyle = '#bac4ce'; g.lineWidth = 1.5;              // tile joints
      g.beginPath();
      for (let t = 0; t <= BLOCK; t += 16) {
        g.moveTo(X(x0+t), X(z0)); g.lineTo(X(x0+t), X(z0+BLOCK));
        g.moveTo(X(x0), X(z0+t)); g.lineTo(X(x0+BLOCK), X(z0+t));
      }
      g.stroke();

      const SW = 16;
      if (type === 'downtown') {
        g.fillStyle = '#b0bac4';                                 // downtown plaza (lighter)
      } else if (type === 'park') {
        g.fillStyle = '#eef3f7';                                 // snow lawns
        g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
        // Frozen pond (irregular ice-blue blob)
        const pondX = x0 + BLOCK/2, pondZ = z0 + BLOCK/2;
        const pondR = BLOCK/2.2;
        g.fillStyle = '#b8dcec';
        g.beginPath();
        const pts = 8;
        for (let p = 0; p < pts; p++) {
          const angle = (p / pts) * Math.PI * 2;
          const r = pondR * (0.7 + Math.random() * 0.3);
          const px = pondX + Math.cos(angle) * r;
          const pz = pondZ + Math.sin(angle) * r;
          if (p === 0) g.moveTo(X(px), X(pz));
          else g.lineTo(X(px), X(pz));
        }
        g.closePath();
        g.fill();
        // Pond rim
        g.strokeStyle = '#ffffff'; g.lineWidth = 2;
        g.stroke();
        continue;
      } else {
        g.fillStyle = '#e8f0f6';                                 // residential snow
      }
      g.fillRect(X(x0+SW), X(z0+SW), (BLOCK-2*SW)*sc, (BLOCK-2*SW)*sc);
    }

    // Tire-track double-lines down lanes
    g.strokeStyle = '#5a6369'; g.lineWidth = Math.max(1.5, 1.8*sc);
    g.setLineDash([]);
    g.beginPath();
    for (let k = 0; k <= GRID_N; k++) {
      const rc = X(-WORLD + k*P + ROAD/2);
      const off = 5*sc;
      g.moveTo(0, rc - off); g.lineTo(S, rc - off);
      g.moveTo(0, rc + off); g.lineTo(S, rc + off);
      g.moveTo(rc - off, 0); g.lineTo(rc - off, S);
      g.moveTo(rc + off, 0); g.lineTo(rc + off, S);
    }
    g.stroke();

    // Crosswalk stripes at every intersection.
    g.fillStyle = '#e8eff5';
    for (let k = 0; k <= GRID_N; k++) for (let l = 0; l <= GRID_N; l++) {
      const ix = -WORLD + k*P + ROAD/2, iz = -WORLD + l*P + ROAD/2;
      for (const s of [-1, 1]) {
        for (let m = -2; m <= 2; m++) {
          g.fillRect(X(ix + s*(ROAD/2+4)), X(iz + m*9 - 3), 9*sc, 6*sc);
          g.fillRect(X(ix + m*9 - 3), X(iz + s*(ROAD/2+4)), 6*sc, 9*sc);
        }
      }
    }
  });
}

// Register winter-specific props
registerProp('snowman', {r:3.5,h:9}, function() {
  const g = new THREE.Group();
  const snow = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const coal = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const stick = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  // Three stacked white spheres
  g.add(part(new THREE.SphereGeometry(3, 10, 8), snow, 0, 3, 0));
  g.add(part(new THREE.SphereGeometry(2.4, 10, 8), snow, 0, 7.5, 0));
  g.add(part(new THREE.SphereGeometry(1.8, 10, 8), snow, 0, 10.5, 0));
  // Carrot nose
  const noseCone = part(new THREE.ConeGeometry(0.4, 1.2, 8),
    new THREE.MeshLambertMaterial({ color: 0xff9933 }), 1.8, 9.5, 0);
  noseCone.rotation.z = Math.PI/2;
  g.add(noseCone);
  // Coal eyes
  g.add(part(new THREE.SphereGeometry(0.3, 6, 5), coal, 0.6, 11, 0.6));
  g.add(part(new THREE.SphereGeometry(0.3, 6, 5), coal, -0.6, 11, 0.6));
  // Stick arms
  g.add(part(new THREE.BoxGeometry(3, 0.3, 0.3), stick, -2.5, 7.5, 0));
  g.add(part(new THREE.BoxGeometry(3, 0.3, 0.3), stick, 2.5, 7.5, 0));
  // Top hat
  g.add(part(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 10), coal, 0, 12.2, 0));
  g.add(part(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 10), coal, 0, 13.1, 0));
  return g;
}, false);

registerProp('snowpine', {r:5,h:22}, function() {
  const g = new THREE.Group();
  const greenMat = new THREE.MeshLambertMaterial({ color: 0x1a5c3a });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  // Three stacked green cones with snow caps
  for (let i = 0; i < 3; i++) {
    const y = 4 + i*7;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5-i*1.2, 6, 12), greenMat);
    cone.position.y = y;
    g.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5-i*1.2+0.5, 1.5, 12), whiteMat);
    cap.position.y = y + 3.5;
    g.add(cap);
  }
  return g;
}, false);

registerProp('igloo', {r:8,h:10}, function() {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshLambertMaterial({ color: 0xcfe6f4 });
  // White dome (hemisphere)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), iceMat);
  dome.position.y = 5;
  dome.scale.y = 0.7;
  g.add(dome);
  // Tunnel entrance (box)
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), iceMat);
  tunnel.position.set(0, 2, 7);
  g.add(tunnel);
  return g;
}, false);

registerProp('giftbox', {r:2.5,h:4}, function() {
  const colors = [0xff4444, 0x4444ff, 0x44ff44];
  const color = pick(colors);
  const g = new THREE.Group();
  const boxMat = new THREE.MeshLambertMaterial({ color });
  const lidMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  // Main box
  const box = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 5), boxMat);
  box.position.set(0, 1.6, 0);
  g.add(box);
  // Lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 5.2), lidMat);
  lid.position.set(0, 3.2, 0);
  g.add(lid);
  // Ribbon strips
  const ribV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 5.4), lidMat);
  ribV.position.set(0, 2, 0);
  g.add(ribV);
  const ribH = new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.2, 0.4), lidMat);
  ribH.position.set(0, 2, 0);
  g.add(ribH);
  return g;
}, false);

registerProp('sled', {r:4,h:3}, function() {
  const g = new THREE.Group();
  const redMat = new THREE.MeshLambertMaterial({ color: 0xd84040 });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x7a8a9a });
  g.add(part(new THREE.BoxGeometry(8, 0.8, 3), redMat, 0, 0.8, 0));
  g.add(part(new THREE.BoxGeometry(8, 0.6, 1), metalMat, 0, 0.3, -1.5));
  g.add(part(new THREE.BoxGeometry(8, 0.6, 1), metalMat, 0, 0.3, 1.5));
  return g;
}, false);

registerProp('xmastree', {r:10,h:46}, function() {
  const g = new THREE.Group();
  const darkGreenMat = new THREE.MeshLambertMaterial({ color: 0x0a3a1a });
  const ornamentColors = [0xff4444, 0x4444ff, 0x44ff44, 0xffdd00, 0xff8844];

  // Tall dark-green cone stack
  for (let i = 0; i < 4; i++) {
    const h = 14 - i*2;
    const r = 10 - i*2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), darkGreenMat);
    cone.position.y = 7 + i*6;
    g.add(cone);
  }

  // Colored ornament spheres scattered on tree
  for (let k = 0; k < 16; k++) {
    const angle = Math.random() * Math.PI * 2;
    const height = 10 + Math.random() * 30;
    const rad = 8 * (1 - height/40);
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    const ornColor = pick(ornamentColors);
    const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshLambertMaterial({ color: ornColor }));
    ornament.position.set(x, height, z);
    g.add(ornament);
  }

  // Gold star on top
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0),
    new THREE.MeshLambertMaterial({ color: 0xffd700 }));
  star.position.y = 44;
  g.add(star);

  return g;
}, true);  // casts shadow

function populate(addProp) {
  let hasPlacedTree = false;
  let fallbackParkBlock = null;

  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const [x0, z0] = blockOrigin(i, j);
    const cx = x0 + BLOCK/2, cz = z0 + BLOCK/2;
    const type = blockPlan[i][j];
    const inBlock = (dx, dz) => [cx + dx, cz + dz];

    // Sidewalk life — lighter on tablet (clutterKeep also thins these)
    const lite = typeof GFX !== 'undefined' && GFX.lowEnd;
    for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
      addProp('streetlight', cx + sx*(BLOCK/2 - 8), cz + sz*(BLOCK/2 - 8),
        Math.atan2(-sz, -sx));
    if (!lite) {
      addProp('streetlight', cx, cz - (BLOCK/2 - 8), Math.PI/2);
      addProp('streetlight', cx, cz + (BLOCK/2 - 8), -Math.PI/2);
    }
    addProp('trashcan', cx + rand(-90, 90), cz - (BLOCK/2 - 8));
    if (!lite) {
      addProp('trashcan', cx + (BLOCK/2 - 8), cz + rand(-90, 90));
      addProp('trashcan', cx - (BLOCK/2 - 8), cz + rand(-90, 90));
    }
    addProp('mailbox', cx + rand(-90, 90), cz + (BLOCK/2 - 8));
    for (const t of [-1, 1]) {
      addProp('snowpine', cx + t*BLOCK/4, cz - (BLOCK/2 - 8));
      if (!lite) addProp('snowpine', cx + t*BLOCK/4, cz + (BLOCK/2 - 8));
    }
    const peopleN = lite ? 3 : 8;
    for (let k = 0; k < peopleN; k++) {
      const edge = Math.random() < 0.5 ? -1 : 1;
      if (Math.random() < 0.5)
        addProp('person', cx + rand(-100, 100), cz + edge*(BLOCK/2 - 8));
      else
        addProp('person', cx + edge*(BLOCK/2 - 8), cz + rand(-100, 100));
    }
    if (!lite) {
      for (let k = 0; k < 2; k++) {
        const edge = Math.random() < 0.5 ? -1 : 1;
        addProp('dog', cx + rand(-95, 95), cz + edge*(BLOCK/2 - 8));
      }
    }

    if (type === 'downtown') {
      addProp('tower', cx, cz, 0);
      addProp('apartment', ...inBlock(-80, 80));
      addProp('shop', ...inBlock(-80, -80));
      addProp('shop', ...inBlock(80, -80), Math.PI/2);
      addProp('shop', ...inBlock(80, 80), Math.PI);
      for (let k = 0; k < 15; k++)
        addProp('person', ...inBlock(rand(-40, 100),
          (Math.random() < 0.5 ? -1 : 1) * rand(70, 100)));
      addProp('bench', ...inBlock(-30, 40), Math.PI);
      addProp('bench', ...inBlock(30, 40), Math.PI);
      addProp('bench', ...inBlock(-30, -40), 0);
      addProp('bench', ...inBlock(30, -40), 0);
      addProp('mailbox', ...inBlock(rand(-90, 90), rand(-90, 90)));
      addProp('mailbox', ...inBlock(rand(-90, 90), rand(-90, 90)));
      addProp('dog', ...inBlock(rand(-90, 90), rand(-90, 90)));
      for (let k = 0; k < 3; k++)
        addProp('cone', ...inBlock(rand(-90, 90), rand(-90, 90)));
      addProp('trashcan', ...inBlock(rand(-90, 90), rand(-90, 90)));
      addProp('trashcan', ...inBlock(rand(-90, 90), rand(-90, 90)));

      // CHRISTMAS TREE CENTERPIECE with giftboxes (on first downtown block)
      if (!hasPlacedTree) {
        hasPlacedTree = true;
        addProp('xmastree', cx, cz, 0);
        for (let gb = 0; gb < 10; gb++) {
          const angle = (gb / 10) * Math.PI * 2;
          const distance = 35;
          const gbx = cx + Math.cos(angle) * distance;
          const gbz = cz + Math.sin(angle) * distance;
          addProp('giftbox', gbx, gbz);
        }
      }
    } else if (type === 'residential') {
      // Six buildings in two street-facing rows with fenced front yards
      for (const [hx, hz] of [[-66,-58],[66,-58],[-66,58],[66,58]])
        addProp('house', cx + hx + rand(-4, 4), cz + hz + rand(-4, 4),
          hz < 0 ? Math.PI : 0);
      if (Math.random() < 0.4) {
        addProp('apartment', cx, cz - 58, Math.PI);
        addProp('shop', cx, cz + 58, 0);
      } else {
        addProp('house', cx + rand(-4, 4), cz - 58, Math.PI);
        addProp('house', cx + rand(-4, 4), cz + 58, 0);
      }
      for (const fx of [-84, -58, -30, 30, 58, 84]) addProp('fence', cx + fx, cz, 0);
      addProp('snowpine', ...inBlock(-96, 0));
      addProp('snowpine', ...inBlock(96, 0));
      addProp('snowpine', ...inBlock(-33, 0));
      addProp('snowpine', ...inBlock(33, 0));
      const lite = typeof GFX !== 'undefined' && GFX.lowEnd;
      for (let k = 0; k < (lite ? 1 : 4); k++)
        addProp('snowman', ...inBlock(rand(-95, 95), pick([-1,1])*rand(0, 60)));
      for (let k = 0; k < (lite ? 1 : 5); k++)
        addProp('giftbox', ...inBlock(rand(-90, 90), pick([-1,1])*rand(10, 70)));
      for (let k = 0; k < (lite ? 1 : 3); k++)
        addProp('sled', ...inBlock(rand(-95, 95), pick([-1,1])*rand(30, 80)));
      for (let k = 0; k < (lite ? 3 : 10); k++)
        addProp('bush', ...inBlock(rand(-95, 95), pick([-1,1])*rand(0, 30)));
      addProp('mailbox', ...inBlock(rand(-90, 90), -100));
      if (!lite) addProp('mailbox', ...inBlock(rand(-90, 90), 100));
      for (let k = 0; k < (lite ? 3 : 9); k++)
        addProp('person', ...inBlock(rand(-95, 95), rand(-95, 95)));
      if (!lite) {
        addProp('dog', ...inBlock(rand(-95, 95), rand(-95, 95)));
        addProp('dog', ...inBlock(rand(-95, 95), rand(-95, 95)));
      }
    } else {  // park — the spawn block stays clear for the player
      const isSpawn = (i === spawnI && j === spawnJ);
      if (!isSpawn) {
        // Fallback: place tree on first park block if no downtown exists
        if (!hasPlacedTree) {
          hasPlacedTree = true;
          addProp('xmastree', cx, cz, 0);
          for (let gb = 0; gb < 10; gb++) {
            const angle = (gb / 10) * Math.PI * 2;
            const distance = 35;
            const gbx = cx + Math.cos(angle) * distance;
            const gbz = cz + Math.sin(angle) * distance;
            addProp('giftbox', gbx, gbz);
          }
        }
        // Add igloo to parks (except spawn)
        addProp('igloo', cx, cz, 0);
      }
      for (const f of [-55, 55]) {
        addProp('fence', cx + f, cz - 88, 0);
        addProp('fence', cx + f, cz + 88, 0);
        addProp('fence', cx - 88, cz + f, Math.PI/2);
        addProp('fence', cx + 88, cz + f, Math.PI/2);
      }
      // Snowpines instead of ~half the trees
      for (let k = 0; k < 8; k++) {
        const dx = rand(-78, 78), dz = rand(-78, 78);
        if (isSpawn && Math.hypot(dx, dz) < 55) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 26) continue;
        addProp('snowpine', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 7; k++) {
        const dx = rand(-78, 78), dz = rand(-78, 78);
        if (isSpawn && Math.hypot(dx, dz) < 55) continue;
        if (!isSpawn && Math.hypot(dx, dz) < 26) continue;
        addProp('tree', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 12; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (!isSpawn && Math.hypot(dx, dz) < 22) continue;
        addProp('bush', ...inBlock(dx, dz));
      }
      // Snowmen in parks (2-3 per park)
      for (let k = 0; k < 3; k++) {
        const dx = rand(-85, 85), dz = rand(-85, 85);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        addProp('snowman', ...inBlock(dx, dz));
      }
      for (let k = 0; k < 3; k++) {
        const dx = rand(-85, 85), dz = rand(-85, 85);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        addProp('dog', ...inBlock(dx, dz));
      }
      addProp('bench', ...inBlock(rand(-60, 60), -75), 0);
      addProp('bench', ...inBlock(rand(-60, 60), 75), Math.PI);
      addProp('bench', ...inBlock(-75, rand(-50, 50)), Math.PI/2);
      addProp('bench', ...inBlock(75, rand(-50, 50)), -Math.PI/2);
      for (let k = 0; k < 14; k++) {
        const dx = rand(-90, 90), dz = rand(-90, 90);
        if (isSpawn && Math.hypot(dx, dz) < 45) continue;
        addProp('person', ...inBlock(dx, dz));
      }
    }

    const lite = typeof GFX !== 'undefined' && GFX.lowEnd;
    const parkN = lite ? 2 : 5;
    for (let k = 0; k < parkN; k++) {
      const side = (Math.random()*4)|0, off = BLOCK/2 + 9, along = rand(-95, 95);
      if (side === 0)      addProp('car', cx + along, cz - off, 0);
      else if (side === 1) addProp('car', cx + along, cz + off, 0);
      else if (side === 2) addProp('car', cx - off, cz + along, Math.PI/2);
      else                 addProp('car', cx + off, cz + along, Math.PI/2);
    }
  }

  // Traffic on the streets themselves.
  const lite = typeof GFX !== 'undefined' && GFX.lowEnd;
  for (let k = 0; k <= GRID_N; k++) {
    const rc = -WORLD + k*P + ROAD/2;
    const trafficN = lite ? 4 : 12;
    for (let n = 0; n < trafficN; n++) {
      const along = rand(-WORLD + 60, WORLD - 60);
      const lane = (Math.random() < 0.5 ? -1 : 1) * 12;
      const bus = !lite && Math.random() < 0.15;
      if (Math.random() < 0.5) addProp(bus ? 'bus' : 'car', along, rc + lane, 0);
      else                     addProp(bus ? 'bus' : 'car', rc + lane, along, Math.PI/2);
    }
    if (!lite && k < GRID_N) {
      addProp('cone', rand(-WORLD+60, WORLD-60), rc, 0);
      addProp('cone', rc, rand(-WORLD+60, WORLD-60), 0);
    }
  }
}

registerLevel({
  id: 'winter',
  name: 'Winter City',
  sky: 0xcfe6f4,
  fog: [650, 1900],
  hemi: [0xeaf4ff, 0x9fb4c4, 0.95],
  sunColor: 0xffe9c4,
  soil: ['#6a5f52', '#2c2a26'],
  skirtColor: 0x3a4450,
  progressLabel: 'City devoured',
  // world, playerSpawn, and botSpawns are rolled by generate() every match.
  generate,
  createGroundTexture: winterGroundTexture,
  populate,
});

})();
