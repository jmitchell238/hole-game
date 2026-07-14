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

// Flood-fill helper: erase checkerboard background starting from corners
function floodFillCheckboard(ctx, width, height, tolerance) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Sample colors from the four corners (assume checkerboard)
  const cornerColors = [
    [data[0], data[1], data[2]],
    [data[4*(width-1)], data[4*(width-1)+1], data[4*(width-1)+2]],
    [data[4*(width*(height-1))], data[4*(width*(height-1))+1], data[4*(width*(height-1))+2]],
  ];

  const visited = new Uint8Array(width * height);

  function colorDistance(c1, c2) {
    return Math.max(Math.abs(c1[0]-c2[0]), Math.abs(c1[1]-c2[1]), Math.abs(c1[2]-c2[2]));
  }

  function floodFill(startX, startY, targetColor) {
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const idx = y * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const pixelIdx = idx * 4;
      const pixelColor = [data[pixelIdx], data[pixelIdx+1], data[pixelIdx+2]];

      if (colorDistance(pixelColor, targetColor) <= tolerance) {
        data[pixelIdx+3] = 0;  // Set alpha to 0
        stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
      }
    }
  }

  for (const cornerColor of cornerColors) {
    floodFill(0, 0, cornerColor);
    floodFill(width-1, 0, cornerColor);
    floodFill(0, height-1, cornerColor);
    floodFill(width-1, height-1, cornerColor);
  }

  ctx.putImageData(imageData, 0, 0);
}

// Build an image-based skin: load PNG, optionally remove checkerboard background and erase circle,
// create a textured plane scaled to fit the hole. Circle parameters (cx, cy, rf) are measured from PNG.
// processImage: if true, apply flood-fill (checkerboard) + circle erase; if false, use as-is.
function buildSkin(url, cx, cy, rf, processImage) {
  const g = new THREE.Group();
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // Downscale image to 512x512 canvas for texture
    const texSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Draw scaled image
    ctx.drawImage(img, 0, 0, texSize, texSize);

    if (processImage) {
      // Remove checkerboard background via flood-fill from corners (tolerance ~12)
      floodFillCheckboard(ctx, texSize, texSize, 12);

      // Erase the black circle to transparency
      const circleCenterX = cx * texSize;
      const circleCenterY = cy * texSize;
      const circleRadius = rf * texSize;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // If !processImage, use image as-is (already transparent with ring cutout)

    // Create texture from processed canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;

    // Create material and plane
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const planeScale = 1 / rf;  // Scale plane so inner/outer ring maps to unit radius
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeScale, planeScale),
      material
    );

    // Rotate to lie flat on ground
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01;  // Tiny lift to avoid z-fighting

    // Offset plane so circle center lands at hole center (0,0)
    // Image point (cx, cy) should map to plane point (0, 0)
    // PlaneGeometry spans from -planeScale/2 to planeScale/2
    const offsetX = (0.5 - cx) * planeScale;
    const offsetZ = (0.5 - cy) * planeScale;
    plane.position.x = offsetX;
    plane.position.z = offsetZ;

    g.add(plane);
  };
  img.src = url;

  // The group returns immediately; plane attaches when image loads
  g.userData.spin = 0;  // Stay upright, don't rotate
  return g;
}

const HOLE_DESIGNS = [
  { id: 'tornado', name: 'Tornado', emoji: '🌪️', cost: 100, build: buildTornado },
  { id: 'dog',     name: 'Dog',     emoji: '🐶', cost: 150, build: buildDog },
  { id: 'cat',     name: 'Cat',     emoji: '🐱', cost: 200, build: buildCat },
  { id: 'dragon',  name: 'Dragon',  emoji: '🐲', cost: 250, build: buildDragon },
  // Image-based skins: measured circle params (cx, cy, rf) from PNG
  { id: 'blackcat', name: 'Black Cat', img: 'art/Black_Cat_Transparent.png', cost: 200,
    build: () => buildSkin('art/Black_Cat_Transparent.png', 0.497608, 0.692185, 0.274322, false) },
  { id: 'tuxedocat', name: 'Tuxedo Cat', img: 'art/fixed/black_white_cat.png', cost: 200,
    build: () => buildSkin('art/fixed/black_white_cat.png', 0.498804, 0.624801, 0.257576, false) },
  // New image-based skins from art/fixed/
  { id: 'fireskin', name: 'Ring of Fire', img: 'art/fixed/fire.png', cost: 150,
    build: () => buildSkin('art/fixed/fire.png', 0.500399, 0.511962, 0.202352, false) },
  { id: 'iceskin', name: 'Frost Ring', img: 'art/fixed/ice.png', cost: 150,
    build: () => buildSkin('art/fixed/ice.png', 0.502392, 0.506778, 0.228270, false) },
  { id: 'lavaskin', name: 'Molten Core', img: 'art/fixed/lava.png', cost: 150,
    build: () => buildSkin('art/fixed/lava.png', 0.501595, 0.506380, 0.228070, false) },
  { id: 'boltskin', name: 'Thunderbolt', img: 'art/fixed/lightening.png', cost: 150,
    build: () => buildSkin('art/fixed/lightening.png', 0.500000, 0.499203, 0.244418, false) },
  { id: 'twisterskin', name: 'Twister', img: 'art/fixed/tornado.png', cost: 150,
    build: () => buildSkin('art/fixed/tornado.png', 0.500000, 0.512759, 0.200957, false) },
  { id: 'voidskin', name: 'Black Hole', img: 'art/fixed/black_hole.png', cost: 250,
    build: () => buildSkin('art/fixed/black_hole.png', 0.500000, 0.512360, 0.200758, false) },
  { id: 'dinoskin', name: 'Dino', img: 'art/fixed/dinosaure_green.png', cost: 200,
    build: () => buildSkin('art/fixed/dinosaure_green.png', 0.495614, 0.574561, 0.244019, false) },
  { id: 'pupskin', name: 'Puppy', img: 'art/fixed/dog_one.png', cost: 200,
    build: () => buildSkin('art/fixed/dog_one.png', 0.497608, 0.598086, 0.223684, false) },
  { id: 'heelerskin', name: 'Blue Heeler', img: 'art/fixed/dog_blue_heeler_real.png', cost: 200,
    build: () => buildSkin('art/fixed/dog_blue_heeler_real.png', 0.493222, 0.625997, 0.222289, false) },
  { id: 'whaleskin', name: 'Whale', img: 'art/fixed/whale_blue.png', cost: 200,
    build: () => buildSkin('art/fixed/whale_blue.png', 0.495614, 0.577352, 0.239434, false) },
];

function equippedColor() {
  return HOLE_COLORS.find(c => c.id === SAVE.color) || HOLE_COLORS[0];
}
function equippedDesign() {
  return HOLE_DESIGNS.find(d => d.id === SAVE.design) || null;
}
