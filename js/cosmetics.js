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

    const planeScale = 0.96 / rf;  // Scale plane so opening (~4% overlap) hugs hole rim without gap
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeScale, planeScale),
      material
    );

    // Rotate to lie flat on ground
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;  // Will be positioned at constant height via syncHole

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
  g.userData.flat = true;  // Image skin: keep at constant world height
  return g;
}

const HOLE_DESIGNS = [
  // Image-based skins: measured circle params (cx, cy, rf) from PNG.
  // cx/cy/rf are also used by the Store live preview so kids see the real look.
  { id: 'blackcat', name: 'Black Cat', img: 'art/Black_Cat_Transparent.png', cost: 200,
    cx: 0.497608, cy: 0.692185, rf: 0.274322,
    build: () => buildSkin('art/Black_Cat_Transparent.png', 0.497608, 0.692185, 0.274322, false) },
  { id: 'tuxedocat', name: 'Tuxedo Cat', img: 'art/fixed/black_white_cat.png', cost: 200,
    cx: 0.498804, cy: 0.624801, rf: 0.257576,
    build: () => buildSkin('art/fixed/black_white_cat.png', 0.498804, 0.624801, 0.257576, false) },
  { id: 'fireskin', name: 'Ring of Fire', img: 'art/fixed/fire.png', cost: 150,
    cx: 0.500399, cy: 0.511962, rf: 0.202352,
    build: () => buildSkin('art/fixed/fire.png', 0.500399, 0.511962, 0.202352, false) },
  { id: 'iceskin', name: 'Frost Ring', img: 'art/fixed/ice.png', cost: 150,
    cx: 0.502392, cy: 0.506778, rf: 0.228270,
    build: () => buildSkin('art/fixed/ice.png', 0.502392, 0.506778, 0.228270, false) },
  { id: 'lavaskin', name: 'Molten Core', img: 'art/fixed/lava.png', cost: 150,
    cx: 0.501595, cy: 0.506380, rf: 0.228070,
    build: () => buildSkin('art/fixed/lava.png', 0.501595, 0.506380, 0.228070, false) },
  { id: 'boltskin', name: 'Thunderbolt', img: 'art/fixed/lightening.png', cost: 150,
    cx: 0.500000, cy: 0.499203, rf: 0.244418,
    build: () => buildSkin('art/fixed/lightening.png', 0.500000, 0.499203, 0.244418, false) },
  { id: 'twisterskin', name: 'Twister', img: 'art/fixed/tornado.png', cost: 150,
    cx: 0.500000, cy: 0.512759, rf: 0.200957,
    build: () => buildSkin('art/fixed/tornado.png', 0.500000, 0.512759, 0.200957, false) },
  { id: 'voidskin', name: 'Black Hole', img: 'art/fixed/black_hole.png', cost: 250,
    cx: 0.500000, cy: 0.512360, rf: 0.200758,
    build: () => buildSkin('art/fixed/black_hole.png', 0.500000, 0.512360, 0.200758, false) },
  { id: 'dinoskin', name: 'Dino', img: 'art/fixed/dinosaure_green.png', cost: 200,
    cx: 0.495614, cy: 0.574561, rf: 0.244019,
    build: () => buildSkin('art/fixed/dinosaure_green.png', 0.495614, 0.574561, 0.244019, false) },
  { id: 'pupskin', name: 'Puppy', img: 'art/fixed/dog_one.png', cost: 200,
    cx: 0.497608, cy: 0.598086, rf: 0.223684,
    build: () => buildSkin('art/fixed/dog_one.png', 0.497608, 0.598086, 0.223684, false) },
  { id: 'heelerskin', name: 'Blue Heeler', img: 'art/fixed/dog_blue_heeler_real.png', cost: 200,
    cx: 0.493222, cy: 0.625997, rf: 0.222289,
    build: () => buildSkin('art/fixed/dog_blue_heeler_real.png', 0.493222, 0.625997, 0.222289, false) },
  { id: 'whaleskin', name: 'Whale', img: 'art/fixed/whale_blue.png', cost: 200,
    cx: 0.495614, cy: 0.577352, rf: 0.239434,
    build: () => buildSkin('art/fixed/whale_blue.png', 0.495614, 0.577352, 0.239434, false) },
];

function equippedColor() {
  return HOLE_COLORS.find(c => c.id === SAVE.color) || HOLE_COLORS[0];
}
function equippedDesign() {
  return HOLE_DESIGNS.find(d => d.id === SAVE.design) || null;
}

// ---- Store live preview (2D canvas of equipped color + design) ----------------
// Cache decoded design images so re-equipping is instant for kids tapping around.
const _previewImgCache = Object.create(null);
function loadPreviewImage(url, onReady) {
  if (!url) return null;
  const hit = _previewImgCache[url];
  if (hit) {
    if (hit.complete && hit.naturalWidth) onReady(hit);
    else hit.addEventListener('load', () => onReady(hit), { once: true });
    return hit;
  }
  const img = new Image();
  img.decoding = 'async';
  _previewImgCache[url] = img;
  img.onload = () => onReady(img);
  img.src = url;
  return img;
}

/** Darken/lighten a #rrggbb hex (same idea as hole.js shadeHex). */
function previewShadeHex(hex, f) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return hex;
  const r = Math.min(255, ((n >> 16 & 255) * f) | 0);
  const g = Math.min(255, ((n >> 8 & 255) * f) | 0);
  const b = Math.min(255, ((n & 255) * f) | 0);
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw a top-down hole preview into the Store canvas.
 * Matches in-game: color ring + tinted pit; design image aligned via cx/cy/rf.
 * @param {HTMLCanvasElement} canvas
 * @param {{ hex: string, name?: string }|null} color
 * @param {{ img?: string, cx?: number, cy?: number, rf?: number, name?: string }|null} design
 * @param {() => void} [onAsyncRedraw] called when a design image finishes loading
 */
function drawHolePreview(canvas, color, design, onAsyncRedraw) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const cx = W * 0.5;
  const cy = H * 0.52; // slightly low so tall character skins (cats, dino) fit
  const holeR = Math.min(W, H) * 0.22;
  const hex = (color && color.hex) || '#58d68d';

  // Soft ground pad
  ctx.clearRect(0, 0, W, H);
  const ground = ctx.createRadialGradient(cx, cy, holeR * 0.4, cx, cy, Math.max(W, H) * 0.65);
  ground.addColorStop(0, '#3d4a3a');
  ground.addColorStop(0.55, '#2a332c');
  ground.addColorStop(1, '#1a2330');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  // Subtle grass flecks so empty preview doesn't look flat
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#6fbf45';
  for (let i = 0; i < 40; i++) {
    const a = (i * 2.4) % (Math.PI * 2);
    const d = holeR * 1.5 + (i % 7) * (holeR * 0.22);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Color glow under the rim
  ctx.save();
  ctx.shadowColor = hex;
  ctx.shadowBlur = holeR * 0.95;
  ctx.beginPath();
  ctx.arc(cx, cy, holeR * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  ctx.fill();
  ctx.restore();

  // Color ring first (base look; design layers on top like in-game)
  {
    const ringOuter = holeR * 1.12;
    const ringInner = holeR * 0.88;
    ctx.beginPath();
    ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, ringInner, 0, Math.PI * 2, true);
    ctx.fillStyle = hex;
    ctx.fill();
    // Soft outer highlight
    ctx.beginPath();
    ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, ringOuter - 2, 0, Math.PI * 2, true);
    ctx.fillStyle = previewShadeHex(hex, 1.2);
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Design skin: align PNG hole cutout to the preview pit (same cx/cy/rf as 3D)
  if (design && design.img) {
    const rf = design.rf || 0.25;
    const dcx = design.cx != null ? design.cx : 0.5;
    const dcy = design.cy != null ? design.cy : 0.5;
    // In-game planeScale = 0.96/rf for unit hole radius; circle world radius ≈ 0.96
    const drawSize = (0.96 / rf) * holeR;
    const drawX = cx - dcx * drawSize;
    const drawY = cy - dcy * drawSize;
    const img = loadPreviewImage(design.img, () => {
      if (onAsyncRedraw) onAsyncRedraw();
    });
    if (img && img.complete && img.naturalWidth) {
      try { ctx.drawImage(img, drawX, drawY, drawSize, drawSize); } catch (_) { /* ignore */ }
    }
  }

  // Pit interior (drawn on top of design cutout): colored walls → black abyss.
  // Mirrors customPitMaterial: rim soil is nearly full color, then darkens to black.
  // Wide color band so kids clearly see Lava vs Ocean vs Gold when picking.
  const mouthR = holeR * 0.98;
  const pit = ctx.createRadialGradient(cx, cy, 0, cx, cy, mouthR);
  pit.addColorStop(0.00, '#000000');
  pit.addColorStop(0.22, '#000000');
  pit.addColorStop(0.42, previewShadeHex(hex, 0.18));
  pit.addColorStop(0.62, previewShadeHex(hex, 0.45));
  pit.addColorStop(0.82, previewShadeHex(hex, 0.78));
  pit.addColorStop(0.94, previewShadeHex(hex, 0.98));
  pit.addColorStop(1.00, hex);
  ctx.beginPath();
  ctx.arc(cx, cy, mouthR, 0, Math.PI * 2);
  ctx.fillStyle = pit;
  ctx.fill();

  // Saturated color lip just inside the rim (reads like the 3D wall top)
  ctx.beginPath();
  ctx.arc(cx, cy, mouthR, 0, Math.PI * 2);
  ctx.arc(cx, cy, mouthR * 0.78, 0, Math.PI * 2, true);
  const lip = ctx.createRadialGradient(cx, cy, mouthR * 0.78, cx, cy, mouthR);
  lip.addColorStop(0, previewShadeHex(hex, 0.55));
  lip.addColorStop(0.55, previewShadeHex(hex, 0.9));
  lip.addColorStop(1, hex);
  ctx.fillStyle = lip;
  ctx.fill();

  // Soft inner shadow so the center still feels deep
  const depth = ctx.createRadialGradient(cx, cy, 0, cx, cy, mouthR * 0.72);
  depth.addColorStop(0, 'rgba(0,0,0,0.92)');
  depth.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  depth.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, mouthR * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = depth;
  ctx.fill();

  // Inner rim outline
  ctx.beginPath();
  ctx.arc(cx, cy, mouthR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(2, holeR * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, mouthR * 0.78, 0, Math.PI * 2);
  ctx.strokeStyle = hex;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1.5, holeR * 0.04);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, mouthR * 0.76, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
