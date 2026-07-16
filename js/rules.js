// Match rules: the per-frame simulation — steering, bot AI, swallowing physics,
// hole-vs-hole elimination, and the win/lose checks.

function botThink(bot) {
  // Flee from larger holes
  for (const o of holes) {
    if (o!==bot && o.r > bot.r*1.15 && dist(bot.x,bot.z,o.x,o.z) < o.r+140) {
      bot.tx = bot.x+(bot.x-o.x); bot.tz = bot.z+(bot.z-o.z); return;
    }
  }
  // Prefer props over hunting holes
  let best = null, bd = 1e9;
  for (const ob of objects) {
    if (ob.falling || !canEat(bot, ob.r)) continue;
    const dd = dist(bot.x, bot.z, ob.x, ob.z);
    if (dd < bd) { bd = dd; best = ob; }
  }
  if (best) { bot.tx = best.x; bot.tz = best.z; return; }
  // Hunt smaller holes only if 1.9x bigger AND within 250 units
  let prey = null, pd = 250;
  for (const o of holes) {
    if (o!==bot && bot.r >= 1.9 * o.r) {
      const dd = dist(bot.x,bot.z,o.x,o.z);
      if (dd < pd) { pd = dd; prey = o; }
    }
  }
  if (prey) { bot.tx = prey.x; bot.tz = prey.z; return; }
  // Random movement
  const W = currentLevel.world;
  bot.tx = rand(-W, W); bot.tz = rand(-W, W);
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { timeLeft = 0; endMatch(); return; }

  const kx = (keys['d']?1:0)-(keys['a']?1:0), kz = (keys['s']?1:0)-(keys['w']?1:0);
  if (kx || kz) { player.tx = player.x + kx*300; player.tz = player.z + kz*300; }
  else if (joyActive && (joyX*joyX + joyY*joyY) > 0.02) {
    player.tx = player.x + joyX*300;
    player.tz = player.z + joyY*300;
  }
  else if (dragging) {
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(GROUND_PLANE, hit)) {
      player.tx = hit.x; player.tz = hit.z;
    }
  }

  for (const h of holes) {
    if (!h.isPlayer) {
      h.retarget -= dt;
      if (h.retarget <= 0) { botThink(h); h.retarget = rand(0.3, 0.8); }
    }
    moveHole(h, dt);
  }

  refreshGround();   // re-punch the mouths into the ground as holes move/grow

  // Swallowing. An object only starts falling once its whole footprint is
  // inside the hole's mouth, then drops under gravity. The rim is a hard
  // wall — nothing clips through the edge — and it only counts (and grows
  // the hole) once it is fully below the surface.
  for (const ob of objects) {
    if (ob.falling) {
      const h = ob.hole;
      ob.vy -= GRAVITY * dt;
      ob.mesh.position.y += ob.vy * dt;
      ob.mesh.position.x += (h.x - ob.mesh.position.x) * Math.min(1, dt*1.5);
      ob.mesh.position.z += (h.z - ob.mesh.position.z) * Math.min(1, dt*1.5);
      const dx = ob.mesh.position.x - h.x, dz = ob.mesh.position.z - h.z;
      const dd = Math.hypot(dx, dz), maxD = Math.max(0, h.r - ob.r);
      if (dd > maxD && dd > 0) {                       // hard stop at the rim
        ob.mesh.position.x = h.x + dx/dd*maxD;
        ob.mesh.position.z = h.z + dz/dd*maxD;
      }
      ob.mesh.rotation.x += dt*1.1; ob.mesh.rotation.z += dt*0.7;
      // Growth counts once it's fully below the surface…
      if (!ob.swallowed && ob.mesh.position.y < -(ob.h + 3)) {
        grow(h, areaOf(ob.r)*GROW); ob.swallowed = true;
        // Spawn popup for player only
        if (h.isPlayer) {
          const pts = Math.max(1, Math.round(ob.r));
          spawnPopup(h, pts);
        }
      }
      // …but the object keeps tumbling down the pit, and is only removed
      // once it has sunk completely out of sight below the pit floor.
      if (ob.mesh.position.y + ob.h < -HOLE_DEPTH) {
        scene.remove(ob.mesh); ob.dead = true;
      }
      continue;
    }
    for (const h of holes) {
      if (canEat(h, ob.r) &&
          dist(h.x, h.z, ob.x, ob.z) + ob.r <= h.r) {  // fully inside the mouth
        ob.falling = true; ob.hole = h; ob.vy = 0; break;
      }
    }
  }
  objects = objects.filter(o => !o.dead);

  // Solo mode: skip hole-vs-hole eating, check for devour target
  if (!battleMode) {
    // Check if player reached the devour target
    const devourPct = (1 - objects.length/levelTotal)*100;
    if (devourPct >= targetPct) {
      soloWon = true;
      endMatch();
      return;
    }
  } else {
    // Battle mode: Holes eat smaller holes — eliminated for good.
    // Grace period: no hole-vs-hole eating during first 15 seconds of match
    const elapsedTime = (matchTime || MATCH_TIME) - timeLeft;
    const inGrace = elapsedTime < PVP_GRACE;
    for (const a of holes) {
      for (const b of holes) {
        if (a === b || b.eaten) continue;
        if (!inGrace && a.r >= 1.75 * b.r && dist(a.x, a.z, b.x, b.z) < a.r) {
          grow(a, areaOf(b.r)*GROW);
          b.eaten = true;
        }
      }
    }
    const eaten = holes.filter(h => h.eaten);
    if (eaten.length) {
      for (const h of eaten) removeHole(h);
      holes = holes.filter(h => !h.eaten);
      if (player.eaten) { endMatch(); return; }
    }

    if (objects.length === 0 || holes.length === 1) endMatch();
  }
}
