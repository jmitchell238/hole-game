// The Island level: open water dotted with randomly generated islands — a big
// home island for the player, villages, palm groves, rocky islets, and boats
// moored offshore. Every match rolls a new archipelago.
(function () {

let WORLD;
let islands = [];   // { x, z, R, a3, p3, a7, p7 }

// Distance from island center to its shoreline in direction theta — a wobbly
// circle, so every island is a different blob.
function shoreR(isl, theta) {
  return isl.R * (0.8 + isl.a3*Math.sin(3*theta + isl.p3)
                      + isl.a7*Math.sin(7*theta + isl.p7));
}

// Random point within `frac` of the way from center to shore.
function randPointOn(isl, frac) {
  const th = rand(0, Math.PI*2);
  const rr = Math.sqrt(Math.random()) * frac * shoreR(isl, th);
  return [isl.x + Math.cos(th)*rr, isl.z + Math.sin(th)*rr];
}

function generate() {
  WORLD = Math.round(rand(1400, 1700));
  islands = [];
  const want = 25 + ((Math.random()*10)|0);     // 25–35 islands
  let guard = 2500;
  while (islands.length < want && guard-- > 0) {
    let R;
    if (islands.length === 0) R = rand(200, 260);      // home village
    else {
      const roll = Math.random();
      if (roll < 0.25) R = rand(30, 55);              // rocky islets (20%)
      else if (roll < 0.45) R = rand(90, 150);        // atolls (20%)
      else if (roll < 0.70) R = rand(70, 125);        // palm groves (25%)
      else R = rand(130, 190);                         // villages (35%)
    }
    const x = rand(-WORLD + R + 40, WORLD - R - 40);
    const z = rand(-WORLD + R + 40, WORLD - R - 40);
    if (islands.some(o => dist(x, z, o.x, o.z) < (R + o.R) * 0.8)) continue;
    const isl = { x, z, R,
      a3: rand(0.08, 0.16), p3: rand(0, 7),
      a7: rand(0.04, 0.09), p7: rand(0, 7) };
    if (Math.random() < 0.2 && R >= 90 && R <= 150) isl.atoll = true;
    islands.push(isl);
  }
  this.world = WORLD;
  const home = islands[0];
  this.playerSpawn = [home.x, home.z];
  const spots = [];                              // bots: >=4 within 900 of home
  for (let i = 0; i < 7; i++) {
    let isl;
    if (i < 4) {                                 // first 4 bots near home
      const candidates = islands.filter(o => dist(o.x, o.z, home.x, home.z) < 900);
      isl = candidates.length ? pick(candidates) : islands[1 + (i % (islands.length - 1))];
    } else {
      isl = islands[1 + (i % (islands.length - 1))];
    }
    spots.push(randPointOn(isl, 0.5));
  }
  this.botSpawns = spots;
}

// Water with gradient + glints, islands with multi-band beaches, atolls, open garnish.
function islandGroundTexture() {
  const S = 4096;
  return canvasTex(S, S, g => {
    const sc = S / (2*WORLD);
    const X = w => (w + WORLD) * sc;

    // Water: radial gradient (deep → mid → hint teal center)
    const gx = S/2, gy = S/2, gr = Math.min(S, (WORLD*3)*sc);
    const grad = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, '#2e6d8e');     // teal center
    grad.addColorStop(0.5, '#2e6d8e');   // mid
    grad.addColorStop(1, '#1d4e6e');     // deep navy edges
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);

    // Wave glints (600 arcs, alpha .04–.09)
    for (let i = 0; i < 600; i++) {
      const alpha = rand(0.04, 0.09);
      g.strokeStyle = `rgba(255,255,255,${alpha})`;
      g.lineWidth = rand(2, 3.5);
      const wx = Math.random()*S, wy = Math.random()*S;
      g.beginPath(); g.arc(wx, wy, rand(8, 26), Math.PI*0.15, Math.PI*0.85);
      g.stroke();
    }

    const blob = (isl, frac, fill) => {
      g.fillStyle = fill; g.beginPath();
      for (let a = 0; a <= 72; a++) {
        const th = a/72*Math.PI*2, rr = frac*shoreR(isl, th);
        const px = X(isl.x + Math.cos(th)*rr), py = X(isl.z + Math.sin(th)*rr);
        a ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
    };

    const pathLine = (isl, th, frac) => {
      const r = shoreR(isl, th)*frac;
      return [isl.x + Math.cos(th)*r, isl.z + Math.sin(th)*r];
    };

    for (const isl of islands) {
      if (isl.atoll) {
        // Atoll: shallows + foam + beach ring
        blob(isl, 1.30, '#4b93ae');                     // outer shallow
        blob(isl, 1.16, '#5fb4c4');                     // inner shallow/turq

        // White foam at beach edge
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3;
        g.beginPath();
        for (let a = 0; a <= 72; a++) {
          const th = a/72*Math.PI*2, rr = shoreR(isl, th);
          const px = X(isl.x + Math.cos(th)*rr), py = X(isl.z + Math.sin(th)*rr);
          a ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.stroke();

        blob(isl, 1.0,  '#e2cf9a');                     // beach

        // Lagoon fill (0.55× and 0.45×)
        blob(isl, 0.55, '#3f96b0');
        blob(isl, 0.45, '#2e7d9a');
      } else {
        // Regular island: 4 bands
        blob(isl, 1.30, '#4b93ae');                     // outer shallow
        blob(isl, 1.16, '#5fb4c4');                     // inner shallow/turq

        // White foam at beach edge
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3;
        g.beginPath();
        for (let a = 0; a <= 72; a++) {
          const th = a/72*Math.PI*2, rr = shoreR(isl, th);
          const px = X(isl.x + Math.cos(th)*rr), py = X(isl.z + Math.sin(th)*rr);
          a ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.stroke();

        blob(isl, 1.0,  '#e2cf9a');                     // beach

        // Grass: base #7cbf6b + darker patch for R>60
        if (isl.R > 60) {
          blob(isl, 0.68, '#7cbf6b');                   // base grass
          blob(isl, 0.42, '#63a857');                   // darker inner
        } else {
          blob(isl, 0.68, '#7cbf6b');                   // grass
        }

        // Village islands: 2–3 sandy paths
        if (isl.R >= 130) {
          const pathCount = 2 + ((Math.random()*2)|0);
          for (let p = 0; p < pathCount; p++) {
            const th = Math.random()*Math.PI*2;
            const [px, pz] = pathLine(isl, th, 0.85);
            g.strokeStyle = '#d9c28e'; g.lineWidth = 6;
            g.beginPath();
            g.moveTo(X(isl.x), X(isl.z));
            g.lineTo(X(px), X(pz));
            g.stroke();
          }
        }
      }
    }

    // Open water garnish: coral/reef patches
    for (let c = 0; c < 10; c++) {
      let x, z, tries = 20;
      do {
        x = rand(-WORLD + 120, WORLD - 120);
        z = rand(-WORLD + 120, WORLD - 120);
      } while (tries-- > 0 && islands.some(i => dist(x, z, i.x, i.z) < i.R*2));

      const colors = ['#d98f8f', '#7fd0c9', '#e8d9a0'];
      for (let d = 0; d < 12; d++) {
        const dx = x + rand(-40, 40), dz = z + rand(-40, 40);
        g.fillStyle = pick(colors);
        g.fillRect(X(dx) - rand(1.5, 3), X(dz) - rand(1.5, 3), rand(3, 6), rand(3, 6));
      }
    }

    // Sandbars: pale ellipses
    for (let s = 0; s < 6; s++) {
      let x, z, tries = 20;
      do {
        x = rand(-WORLD + 100, WORLD - 100);
        z = rand(-WORLD + 100, WORLD - 100);
      } while (tries-- > 0 && islands.some(i => dist(x, z, i.x, i.z) < i.R*1.8));

      g.fillStyle = 'rgba(216, 201, 155, .55)';
      g.beginPath();
      g.ellipse(X(x), X(z), 40*sc, 14*sc, rand(0, Math.PI*2), 0, Math.PI*2);
      g.fill();
    }
  });
}

// ---- Island-only props ---------------------------------------------------------
const PALM_LEAF = new THREE.MeshLambertMaterial({ color: 0x3da157 });
const HUT_WALL  = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
const THATCH    = new THREE.MeshLambertMaterial({ color: 0xb08d4f });
const HULL      = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
const SAIL      = new THREE.MeshLambertMaterial({ color: 0xf2ede0 });
const DRIFT     = new THREE.MeshLambertMaterial({ color: 0xb0a189 });
const FLAME     = new THREE.MeshBasicMaterial({ color: 0xff8c3a });

registerProp('palm', { r: 7, h: 30 }, function () {
  const g = new THREE.Group();
  const lean = rand(0, Math.PI*2);
  const lx = Math.cos(lean), lz = Math.sin(lean);
  for (let s = 0; s < 5; s++)
    g.add(part(new THREE.CylinderGeometry(1.1 - s*0.12, 1.3 - s*0.12, 5.4, 7),
      MAT.trunk, lx * s*s*0.32, 2.5 + s*4.9, lz * s*s*0.32));
  const tx = lx*5.1, tz = lz*5.1;
  for (let k = 0; k < 6; k++) {
    const th = k/6*Math.PI*2;
    const leaf = part(new THREE.BoxGeometry(11, 0.5, 3), PALM_LEAF,
      tx + Math.cos(th)*5, 25, tz + Math.sin(th)*5);
    leaf.rotation.z = -0.35; leaf.rotation.y = -th;
    g.add(leaf);
  }
  g.add(part(new THREE.SphereGeometry(1, 7, 6), MAT.trunk, tx+1, 23.5, tz));
  g.add(part(new THREE.SphereGeometry(1, 7, 6), MAT.trunk, tx-0.5, 23.5, tz+1));
  return g;
}, true);

registerProp('rock', { r: 6, h: 8 }, function () {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const s = rand(2.2, 4.4);
    const m = part(new THREE.DodecahedronGeometry(s, 0), MAT.stone,
      rand(-3, 3), s*0.7, rand(-3, 3));
    m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(m);
  }
  return g;
}, false);

registerProp('hut', { r: 11, h: 20 }, function () {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(7.5, 8, 9, 10), HUT_WALL, 0, 4.5, 0));
  g.add(part(new THREE.ConeGeometry(11, 9, 10), THATCH, 0, 13, 0));
  g.add(part(new THREE.BoxGeometry(3.4, 5.5, 0.8), MAT.dark, 0, 2.75, 7.7));
  return g;
}, true);

registerProp('boat', { r: 9, h: 16 }, function () {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(16, 3, 6), HULL, 0, 2, 0));
  g.add(part(new THREE.BoxGeometry(13, 1.5, 4), MAT.wood, 0, 3.4, 0));
  g.add(part(new THREE.CylinderGeometry(0.4, 0.4, 12, 6), MAT.trunk, 1.5, 9, 0));
  g.add(part(new THREE.BoxGeometry(0.4, 7.5, 5.5), SAIL, 1.5, 9.8, 3));
  return g;
}, true);

registerProp('umbrella', { r: 4, h: 14 }, function () {
  const g = new THREE.Group();
  const colors = [0xf04040, 0x40a0f0, 0xf0d040];
  const color1 = pick(colors);
  const color2 = pick(colors.filter(c => c !== color1));
  g.add(part(new THREE.CylinderGeometry(0.3, 0.3, 11, 6), MAT.dark, 0, 6, 0));
  const canopy = part(new THREE.ConeGeometry(3.5, 3.5, 8), new THREE.MeshLambertMaterial({ color: color1 }), 0, 10.5, 0);
  g.add(canopy);
  for (let s = 0; s < 8; s++) {
    const th = s/8*Math.PI*2;
    const strip = part(new THREE.BoxGeometry(0.3, 2, 0.2), new THREE.MeshLambertMaterial({ color: color2 }),
      Math.cos(th)*2.8, 10.5, Math.sin(th)*2.8);
    g.add(strip);
  }
  return g;
}, true);

registerProp('driftwood', { r: 5, h: 4 }, function () {
  const g = new THREE.Group();
  const log1 = part(new THREE.CylinderGeometry(0.6, 0.6, 9, 5), DRIFT, 0, 2, 0);
  log1.rotation.z = Math.PI/4; g.add(log1);
  const log2 = part(new THREE.CylinderGeometry(0.6, 0.6, 9, 5), DRIFT, 0, 2, 0);
  log2.rotation.z = -Math.PI/4; g.add(log2);
  return g;
}, false);

registerProp('campfire', { r: 4, h: 7 }, function () {
  const g = new THREE.Group();
  for (let s = 0; s < 5; s++) {
    const th = s/5*Math.PI*2;
    const r = 2.5;
    const stone = part(new THREE.SphereGeometry(0.8, 6, 4), MAT.stone,
      Math.cos(th)*r, 0.8, Math.sin(th)*r);
    g.add(stone);
  }
  for (let l = 0; l < 3; l++) {
    const th = Math.random()*Math.PI*2;
    const log = part(new THREE.CylinderGeometry(0.4, 0.4, 4, 4), MAT.dark,
      Math.cos(th)*1.5, 2, Math.sin(th)*1.5);
    log.rotation.z = rand(0.2, 1.0);
    g.add(log);
  }
  const flame = part(new THREE.ConeGeometry(1.8, 3.5, 8), FLAME, 0, 3.5, 0);
  g.add(flame);
  return g;
}, false);

registerProp('chest', { r: 3.5, h: 5 }, function () {
  const g = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: 0xd9a730 });
  g.add(part(new THREE.BoxGeometry(6, 3, 4), new THREE.MeshLambertMaterial({ color: 0x8b6f47 }), 0, 1.5, 0));
  g.add(part(new THREE.BoxGeometry(6.2, 0.4, 4.2), gold, 0, 3.2, 0));
  g.add(part(new THREE.BoxGeometry(6, 1.8, 4), new THREE.MeshLambertMaterial({ color: 0x704a2a }), 0, 3.8, 0));
  g.add(part(new THREE.BoxGeometry(0.4, 1, 4.2), gold, -3.2, 3.2, 0));
  g.add(part(new THREE.BoxGeometry(0.4, 1, 4.2), gold, 3.2, 3.2, 0));
  return g;
}, false);

registerProp('pier', { r: 13, h: 6 }, function () {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(34, 2, 10), MAT.wood, 0, 1, 0));
  for (const [lx, lz] of [[-16,-4],[16,-4],[-16,4],[16,4]])
    g.add(part(new THREE.CylinderGeometry(1.2, 1.2, 2, 6), MAT.dark, lx, 1, lz));
  for (const [mx, mz] of [[-14, 5],[14, 5]])
    g.add(part(new THREE.CylinderGeometry(0.8, 0.8, 3, 6), MAT.dark, mx, 1.5, mz));
  return g;
}, true);

// ---- Populate --------------------------------------------------------------------
function populate(addProp) {
  let chestCount = 0;
  const chestQuota = 2 + ((Math.random()*2)|0);        // 2–3 chests per map
  const islets = islands.filter(i => i.R < 60);

  for (let idx = 0; idx < islands.length; idx++) {
    const isl = islands[idx];
    if (isl.atoll) continue;                            // atolls skip normal prop logic
    const f = clamp(isl.R / 100, 0.5, 2.2);            // size factor
    const n = base => Math.max(1, Math.round(base * f));

    if (isl.R >= 130) {                                 // village island
      const isHome = idx === 0;
      if (!isHome) addProp('fountain', isl.x, isl.z, 0);
      const huts = 4 + ((Math.random()*3)|0);
      for (let k = 0; k < huts; k++) {
        const th = k/huts*Math.PI*2 + rand(-0.25, 0.25);
        const rr = isl.R * rand(0.3, 0.44);
        addProp('hut', isl.x + Math.cos(th)*rr, isl.z + Math.sin(th)*rr);
      }
      for (let k = 0; k < n(16); k++) {
        const [px, pz] = randPointOn(isl, 0.85);
        if (isHome && dist(px, pz, isl.x, isl.z) < 45) continue;
        addProp('person', px, pz);
      }
      for (let k = 0; k < n(13); k++) addProp('palm', ...randPointOn(isl, 0.9));
      for (let k = 0; k < n(3); k++)  addProp('tree', ...randPointOn(isl, 0.6));
      for (let k = 0; k < n(10); k++) addProp('bush', ...randPointOn(isl, 0.8));
      for (let k = 0; k < n(5); k++)  addProp('rock', ...randPointOn(isl, 0.95));
      for (let k = 0; k < n(3); k++)  addProp('bench', ...randPointOn(isl, 0.6));
      for (let k = 0; k < n(2); k++)  addProp('dog', ...randPointOn(isl, 0.8));

      // New props for villages
      for (let k = 0; k < n(3); k++) addProp('umbrella', ...randPointOn(isl, 0.9));
      for (let k = 0; k < n(2); k++) addProp('driftwood', ...randPointOn(isl, 0.95));
      addProp('campfire', ...randPointOn(isl, 0.5));

      // Pier at random shore angle, pointing out to sea
      const th = rand(0, Math.PI*2);
      const rr = shoreR(isl, th) * 1.05;
      addProp('pier', isl.x + Math.cos(th)*rr, isl.z + Math.sin(th)*rr, -th);
      // Boat moored at pier far end (inside lagoon if atoll, offshore otherwise)
      const boatRr = rr + 15;
      addProp('boat', isl.x + Math.cos(th)*boatRr, isl.z + Math.sin(th)*boatRr, -th);

    } else if (isl.R >= 60) {                           // palm-grove island
      for (let k = 0; k < n(10); k++) addProp('palm', ...randPointOn(isl, 0.9));
      for (let k = 0; k < n(8); k++)  addProp('bush', ...randPointOn(isl, 0.8));
      for (let k = 0; k < n(3); k++)  addProp('rock', ...randPointOn(isl, 0.95));
      for (let k = 0; k < n(5); k++)  addProp('person', ...randPointOn(isl, 0.8));
      for (let k = 0; k < n(2); k++)  addProp('tree', ...randPointOn(isl, 0.6));
      addProp('dog', ...randPointOn(isl, 0.7));
      if (isl.R > 90) addProp('hut', ...randPointOn(isl, 0.4));

      // Groves: 1–2 umbrellas, 40% get a campfire
      addProp('umbrella', ...randPointOn(isl, 0.85));
      if (Math.random() < 0.4) addProp('campfire', ...randPointOn(isl, 0.5));

    } else {                                            // rocky islet
      addProp('palm', isl.x + rand(-6, 6), isl.z + rand(-6, 6));
      addProp('rock', ...randPointOn(isl, 0.6));
      if (Math.random() < 0.6) addProp('rock', ...randPointOn(isl, 0.7));
      if (Math.random() < 0.5) addProp('person', ...randPointOn(isl, 0.5));

      // Islets may hold treasure chests
      if (chestCount < chestQuota && Math.random() < 0.4) {
        addProp('chest', ...randPointOn(isl, 0.5));
        chestCount++;
      }
    }

    // Boats moored just offshore (not atolls).
    if (!isl.atoll && isl.R >= 60) {
      const nb = 2 + ((Math.random()*2)|0);
      for (let k = 0; k < nb; k++) {
        const th = rand(0, Math.PI*2);
        const rr = shoreR(isl, th) * rand(1.15, 1.35);
        addProp('boat', isl.x + Math.cos(th)*rr, isl.z + Math.sin(th)*rr, -th);
      }
    }
  }

  // Atoll props: ring band only (0.6–0.95 frac), lagoon boats
  for (const isl of islands.filter(i => i.atoll)) {
    for (let k = 0; k < 3; k++) {
      const [px, pz] = randPointOn(isl, 0.75);
      addProp('palm', px, pz);
    }
    for (let k = 0; k < 2; k++) {
      const [rx, rz] = randPointOn(isl, 0.7);
      addProp('rock', rx, rz);
    }
    // 1–2 boats inside lagoon (at ~0.3×shore)
    const boatCount = Math.random() < 0.5 ? 1 : 2;
    for (let b = 0; b < boatCount; b++) {
      const [bx, bz] = randPointOn(isl, 0.3);
      addProp('boat', bx, bz);
    }
  }

  // Open water boats: 10 → 28 (same clearance logic)
  for (let k = 0; k < 28; k++) {
    let x, z, tries = 40;
    do {
      x = rand(-WORLD + 60, WORLD - 60);
      z = rand(-WORLD + 60, WORLD - 60);
    } while (tries-- > 0 && islands.some(i => dist(x, z, i.x, i.z) < i.R*1.5));
    addProp('boat', x, z);
  }
}

registerLevel({
  id: 'island',
  name: 'Island',
  sky: 0x8fd3f2,
  fog: [900, 3200],
  hemi: [0xe4f6ff, 0x3f8a8f, 1.0],
  sunColor: 0xfff6dd,
  soil: ['#c9b076', '#5f5233'],
  skirtColor: 0x1e4f66,
  progressLabel: 'Islands devoured',
  matchTime: 240,
  // world, playerSpawn, and botSpawns are rolled by generate() every match.
  generate,
  createGroundTexture: islandGroundTexture,
  populate,
});

})();
