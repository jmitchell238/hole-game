// Match rules: the per-frame simulation — steering, bot AI, swallowing physics,
// hole-vs-hole elimination, and the win/lose checks.

function botThink(bot) {
  // Flee from larger holes
  for (const o of holes) {
    if (o!==bot && o.r > bot.r*1.15 && dist(bot.x,bot.z,o.x,o.z) < o.r+140) {
      bot.tx = bot.x+(bot.x-o.x); bot.tz = bot.z+(bot.z-o.z); return;
    }
  }
  // Prefer props over hunting holes — use grid query for nearby props
  let best = null, bd = 1e9;
  const huntR = 220 + bot.r * 2;
  const huntR2 = huntR * huntR;

  // Query grid for props near bot, then filter and find closest
  const candidates = PROP_GRID && typeof PROP_GRID.queryCircle === 'function'
    ? PROP_GRID.queryCircle(bot.x, bot.z, huntR, [])
    : objects;  // fallback to all objects if grid not ready

  for (const ob of candidates) {
    if (ob.falling || ob.dead || ob.baseY > 0.5 || !canEat(bot, ob.r)) continue;
    const dx = ob.x - bot.x, dz = ob.z - bot.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > huntR2 || d2 >= bd * bd) continue;
    const dd = Math.sqrt(d2);
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
  // In noEat levels (debug labs), timer doesn't count down or auto-end
  if (!currentLevel.noEat) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; endMatch(); return; }
  }

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
      // Bots re-plan less often on tablets (AI is O(objects))
      if (h.retarget <= 0) {
        botThink(h);
        h.retarget = GFX.mobile ? rand(0.55, 1.1) : rand(0.3, 0.8);
      }
    }
    moveHole(h, dt);
  }

  // Ground update API seam (implementation in engine.js).
  refreshGround(false);

  // Swallowing. An object only starts falling once its whole footprint is
  // inside the hole's mouth, then drops under gravity. The rim is a hard
  // wall — nothing clips through the edge — and it only counts (and grows
  // the hole) once it is fully below the surface.
  //
  // Broad-phase: use spatial grid per hole to skip distant props
  // (huge win on dense maps with 2k+ props).
  let maxReach = 0;
  let needsCompact = false;  // only rebuild objects array if something died
  for (const h of holes) {
    if (h.r > maxReach) maxReach = h.r;
  }
  maxReach += 40; // small prop radius pad

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
      // Tilt/topple toward the hole as it falls
      const dirToHoleX = h.x - ob.mesh.position.x;
      const dirToHoleZ = h.z - ob.mesh.position.z;
      const dirDist = Math.hypot(dirToHoleX, dirToHoleZ);
      // Lean factor increases as object falls deeper (from y=0 to y<-(ob.h+3))
      const fallProgress = Math.max(0, -ob.mesh.position.y / (ob.h + 3));
      const leanStrength = Math.min(1, fallProgress); // Clamp to [0, 1]
      if (dirDist > 0.001) {
        const dirXNorm = dirToHoleX / dirDist;
        const dirZNorm = dirToHoleZ / dirDist;
        const tiltAmount = leanStrength * 2.2;
        ob.mesh.rotation.z += dirXNorm * tiltAmount * dt;
        ob.mesh.rotation.x += dirZNorm * tiltAmount * dt;
      }
      // Residual tumble for physics feel
      ob.mesh.rotation.x += dt * 0.3;
      ob.mesh.rotation.z += dt * 0.2;
      // Growth counts once it's fully below the surface…
      if (!ob.swallowed && ob.mesh.position.y < -(ob.h + 3)) {
        grow(h, areaOf(ob.r)); ob.swallowed = true;
        devouredArea += areaOf(ob.r);
        // Spawn popup for player only
        if (h.isPlayer) {
          const pts = Math.max(1, Math.round(ob.r));
          spawnPopup(h, pts);
        }
      }
      // …but the object keeps tumbling down the pit, and is only removed
      // once it has sunk completely out of sight below the pit floor.
      if (ob.mesh.position.y + ob.h < -HOLE_DEPTH) {
        // Destroyed for good — strip from scene + free GPU resources
        if (typeof destroyProp === 'function') destroyProp(ob);
        else { scene.remove(ob.mesh); ob.dead = true; }
        needsCompact = true;
      }
      continue;
    }
    // Settling slices: drop smoothly to their target position when a slice above is eaten
    if (ob.settling && ob.targetY !== undefined) {
      ob.mesh.position.y = Math.max(ob.targetY, ob.mesh.position.y - 90*dt);
      if (ob.mesh.position.y <= ob.targetY) {
        ob.baseY = ob.targetY;
        ob.settling = false;
        ob.mesh.matrixAutoUpdate = false;
        ob.mesh.updateMatrix();
        // Insert into grid if slice reaches ground level
        if (ob.baseY <= 0.5 && typeof gridInsert === 'function') {
          gridInsert(ob);
        }
      } else {
        ob.mesh.updateMatrix();
      }
      continue;
    }

    // Skip airborne slices
    if (ob.baseY > 0.5) continue;

    // Query grid for each hole's reach and test eat conditions
    for (const h of holes) {
      // Use grid query if available, otherwise fallback to checking all objects
      let isNear = false;
      if (PROP_GRID && typeof PROP_GRID.queryCircle === 'function') {
        // Grid query returns props within the circle
        const queryResults = PROP_GRID.queryCircle(h.x, h.z, h.r + 40, []);
        isNear = queryResults.indexOf(ob) !== -1;
      } else {
        // Fallback: use cheap axis-aligned reject
        isNear = Math.abs(ob.x - h.x) <= maxReach && Math.abs(ob.z - h.z) <= maxReach;
      }

      if (!currentLevel.noEat && isNear && canEat(h, ob.r) &&
          dist(h.x, h.z, ob.x, ob.z) + ob.r <= h.r) {  // fully inside the mouth
        ob.falling = true; ob.hole = h; ob.vy = 0;
        gridRemove(ob);  // remove from grid when falling starts
        if (typeof thawProp === 'function') thawProp(ob.mesh);
        // When a slice starts falling, drop other slices in the same stack
        if (ob.stackId && STACK_MAP.has(ob.stackId)) {
          const stackSlices = STACK_MAP.get(ob.stackId);
          for (const o of stackSlices) {
            if (!o.dead && !o.falling) {  // skip dead objects lazily
              o.targetY = (o.targetY !== undefined ? o.targetY : o.baseY) - ob.h;
              o.settling = true;
              if (typeof thawProp === 'function') thawProp(o.mesh);
            }
          }
        }
        break;
      }
    }
  }
  if (needsCompact) objects = objects.filter(o => !o.dead);

  // Solo mode: skip hole-vs-hole eating, check for devour target
  if (!battleMode) {
    const devourPct = levelTotalArea > 0 ? (devouredArea / levelTotalArea) * 100 : 0;
    if (!soloWon && devourPct >= targetPct) {
      soloWon = true; winDelay = 2.5;
      const flash = document.getElementById('levelUp');
      if (flash) {
        flash.textContent = 'LEVEL CLEARED! 🎉';
        flash.classList.remove('hidden');
        flash.style.animation = 'none';
        void flash.offsetWidth;
        flash.style.animation = 'levelUpPop 2.5s ease-out forwards';
      }
    }
    if (soloWon) {
      winDelay -= dt;
      if (winDelay <= 0) { endMatch(); return; }
    }
  } else {
    // Battle mode: Holes eat smaller holes — eliminated for good.
    // Grace period: no hole-vs-hole eating during first 15 seconds of match
    const elapsedTime = (matchTime || MATCH_TIME) - timeLeft;
    const inGrace = elapsedTime < PVP_GRACE;
    for (const a of holes) {
      if (a.eaten) continue;  // eaten hole doesn't eat in its death frame
      for (const b of holes) {
        if (a === b || b.eaten) continue;
        if (!inGrace && a.r >= 1.75 * b.r && dist(a.x, a.z, b.x, b.z) < a.r) {
          grow(a, areaOf(b.r));
          b.eaten = true;
        }
      }
    }
    const eaten = holes.filter(h => h.eaten);
    if (eaten.length) {
      for (const h of eaten) removeHole(h);
      holes = holes.filter(h => !h.eaten);
      refreshGround(true);   // hole removed → force new cutouts
      if (player.eaten) { endMatch(); return; }
    }

    if (objects.length === 0 || holes.length === 1) endMatch();
  }
}
