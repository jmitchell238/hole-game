// The cosmetics catalog: hole colors and rim designs bought with gold in the
// Store. Colors tint the player's ring, name tag, and the inside of the pit.
// Designs are little 3D decorations that ride the player's rim and scale as
// the hole grows.

const HOLE_COLORS = [
  { id: 'emerald',   name: 'Emerald',   cost: 0,  hex: '#58d68d' },
  { id: 'lava',      name: 'Lava',      cost: 20, hex: '#ff5a2a' },
  { id: 'ocean',     name: 'Ocean',     cost: 20, hex: '#3aa6ff' },
  { id: 'toxic',     name: 'Toxic',     cost: 20, hex: '#86e83a' },
  { id: 'gold',      name: 'Gold',      cost: 20, hex: '#ffcf40' },
  { id: 'ice',       name: 'Ice',       cost: 20, hex: '#bfeaff' },
  { id: 'violet',    name: 'Violet',    cost: 20, hex: '#a06bff' },
  { id: 'bubblegum', name: 'Bubblegum', cost: 20, hex: '#ff7ad9' },
];

// Design builders return a group sized for a radius-1 hole; syncHole() scales
// it with the hole every frame, and render() spins it via its userData.spin.
function decoPart(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

function buildCat() {
  const g = new THREE.Group();
  for (const s of [-0.32, 0.32]) {                    // ears
    const ear = decoPart(new THREE.ConeGeometry(0.17, 0.42, 6), 0xf0a04a,
      Math.sin(s), 0.18, -Math.cos(s));
    g.add(ear);
    g.add(decoPart(new THREE.ConeGeometry(0.09, 0.22, 6), 0xff9ec4,
      Math.sin(s)*0.99, 0.16, -Math.cos(s)*0.99));
  }
  const tail = decoPart(new THREE.CylinderGeometry(0.05, 0.08, 0.75, 6),
    0xf0a04a, 0, 0.24, 1);                            // tail at the back
  tail.rotation.x = 0.5;
  g.add(tail);
  g.userData.spin = 0.5;
  return g;
}

function buildDog() {
  const g = new THREE.Group();
  for (const s of [-0.38, 0.38]) {                    // floppy ears
    const ear = decoPart(new THREE.BoxGeometry(0.22, 0.5, 0.1), 0x8a6642,
      Math.sin(s), 0.1, -Math.cos(s));
    ear.rotation.z = s > 0 ? -0.45 : 0.45;
    g.add(ear);
  }
  g.add(decoPart(new THREE.SphereGeometry(0.13, 8, 6), 0x3a3a3a, 0, 0.12, -1));
  const tongue = decoPart(new THREE.BoxGeometry(0.14, 0.04, 0.3), 0xff7a8a,
    0, 0.05, -1.05);
  tongue.rotation.x = -0.4;
  g.add(tongue);
  g.userData.spin = 0.5;
  return g;
}

function buildDragon() {
  const g = new THREE.Group();
  for (let k = 0; k < 9; k++) {                       // rim spikes
    const th = k/9 * Math.PI*2;
    const spike = decoPart(new THREE.ConeGeometry(0.13, 0.5, 5), 0xa02818,
      Math.cos(th), 0.2, Math.sin(th));
    spike.rotation.z = 0.5 * Math.cos(th);
    spike.rotation.x = -0.5 * Math.sin(th);
    g.add(spike);
  }
  for (const s of [-1, 1]) {                          // wings
    const wing = decoPart(new THREE.ConeGeometry(0.45, 1.1, 4), 0x7a1e10,
      s * 1.05, 0.42, 0.25);
    wing.rotation.z = s * 2.3;
    wing.scale.z = 0.25;
    g.add(wing);
  }
  g.userData.spin = 0.9;
  return g;
}

function buildTornado() {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {                       // rising storm rings
    const ring = decoPart(
      new THREE.TorusGeometry(0.34 + k*0.16, 0.045, 6, 20), 0x9aa2a8,
      Math.cos(k*2.1)*0.08, 0.25 + k*0.3, Math.sin(k*2.1)*0.08);
    ring.rotation.x = Math.PI/2;
    g.add(ring);
  }
  g.userData.spin = 4;
  return g;
}

const HOLE_DESIGNS = [
  { id: 'tornado', name: 'Tornado', emoji: '🌪️', cost: 100, build: buildTornado },
  { id: 'dog',     name: 'Dog',     emoji: '🐶', cost: 150, build: buildDog },
  { id: 'cat',     name: 'Cat',     emoji: '🐱', cost: 200, build: buildCat },
  { id: 'dragon',  name: 'Dragon',  emoji: '🐲', cost: 250, build: buildDragon },
];

function equippedColor() {
  return HOLE_COLORS.find(c => c.id === SAVE.color) || HOLE_COLORS[0];
}
function equippedDesign() {
  return HOLE_DESIGNS.find(d => d.id === SAVE.design) || null;
}
