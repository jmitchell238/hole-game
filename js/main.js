// Match setup, camera, the render/game loop, and menu wiring.

function init(level) {
  currentLevel = level;
  applyGfxSettings();
  document.getElementById('tags').innerHTML = '';
  for (const h of holes) removeHole(h);
  for (const o of objects) scene.remove(o.mesh);
  // Dispose GPU resources before clearing objects
  for (const o of objects) {
    o.mesh.traverse(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (mesh.material.map) mesh.material.map.dispose();
          mesh.material.dispose();
        }
      }
    });
  }
  objects = [];
  holes = [];
  applyEnvironment(level);
  setPitStyle(level);
  level.generate();          // roll this match's random layout
  buildGround(level);
  level.populate(addProp);
  levelTotal = objects.length;
  player = makeHole(level.playerSpawn[0], level.playerSpawn[1], 'You', true);
  holes.push(player);

  // Determine if this is a battle level
  battleMode = isBattleLevel(SAVE.campaignLevel);
  if (battleMode) {
    // Battle level: spawn exactly 5 bots
    const names = BOT_NAMES.slice().sort(() => Math.random()-0.5);
    const spawns = level.botSpawns;
    for (let i = 0; i < 5 && i < spawns.length && i < names.length; i++)
      holes.push(makeHole(spawns[i][0], spawns[i][1], names[i], false));
  }
  // Solo level: no bots (holes = [player] only)

  refreshGround(true);
  camPos.set(player.x, 200, player.z + 160);   // snap camera to the new spawn

  // Timer: solo 240s, battle always 150s (fixed pacing, no level override)
  const isSolo = !battleMode;
  timeLeft = isSolo ? 240 : MATCH_TIME;
  matchTime = isSolo ? 240 : MATCH_TIME;   // set global for grace period calculation

  // Solo objective: target percentage increases with campaign level
  targetPct = Math.min(50 + 3*(SAVE.campaignLevel-1), 90);
  soloWon = false;

  // Hide leaderboard during solo, show during battles
  const board = document.getElementById('board');
  if (isSolo) {
    board.classList.add('hidden');
  } else {
    board.classList.remove('hidden');
  }

  lastLevel = 1;
}

// ---- Popup system for eat feedback -------------------------------------------
let popupPool = [];
let nextPopupId = 0;
function spawnPopup(h, pts) {
  let popup;
  if (popupPool.length > 0) {
    popup = popupPool.pop();
  } else {
    popup = document.createElement('div');
    popup.className = 'popup';
    document.getElementById('tags').appendChild(popup);
  }
  popup.textContent = '+' + pts;
  popup.style.display = 'block';
  popup.userData = { hole: h, startTime: performance.now(), id: nextPopupId++ };
  popupPool.live = (popupPool.live || 0) + 1;
  return popup;
}

// ---- Camera + render -----------------------------------------------------------
let camPos = new THREE.Vector3(0, 200, 160);
let _cullFrame = 0;

function applyGfxSettings() {
  renderer.shadowMap.enabled = !!SAVE.shadows;
  sun.castShadow = !!SAVE.shadows;
  if (ground) ground.receiveShadow = !!SAVE.shadows;
  // Propagate castShadow cheaply: only big props ever cast (see SHADOW_CASTERS)
  if (!SAVE.shadows) {
    for (const o of objects) {
      o.mesh.traverse(m => { if (m.isMesh) m.castShadow = false; });
    }
  }
}

// Hide props outside the fog envelope so the GPU doesn't draw 2k groups.
function cullDistantProps() {
  if (!player || !scene.fog) return;
  const lim = scene.fog.far * GFX.cullFogMul;
  const lim2 = lim * lim;
  const px = player.x, pz = player.z;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.falling || o.dead) { o.mesh.visible = true; continue; }
    const dx = o.x - px, dz = o.z - pz;
    o.mesh.visible = (dx*dx + dz*dz) < lim2;
  }
}

function render() {
  const height = 22.5 + player.r * 7.3, depth = 18.5 + player.r * 6.2;
  const want = new THREE.Vector3(player.x, height, player.z + depth);
  camPos.lerp(want, 0.06);
  camera.position.copy(camPos);
  camera.lookAt(player.x, 0, player.z);

  // Dynamic fog: adjust far plane based on camera height
  // Slightly tighter fog on mobile → fewer distant draws + earlier cull
  const fogScale = GFX.mobile ? 0.85 : 1;
  scene.fog.far = Math.max(currentLevel.fog[1] * fogScale, height * 2.4 * fogScale);
  scene.fog.near = scene.fog.far * 0.38;

  // Sun (and its shadow window) follows the player.
  sun.position.set(player.x - 260, 520, player.z + 180);
  sun.target.position.set(player.x, 0, player.z);
  // Shadow camera must track the target or the map is stale
  if (SAVE.shadows) sun.shadow.camera.updateProjectionMatrix();

  // Spin all hole decos.
  for (const h of holes) {
    if (h.deco)
      h.deco.rotation.y = performance.now()/1000 * h.deco.userData.spin;
  }

  // Distance cull every other frame (cheap CPU, big GPU win on dense maps)
  if (((_cullFrame++) & 1) === 0) cullDistantProps();

  renderer.render(scene, camera);

  const v = new THREE.Vector3();
  for (const h of holes) {
    v.set(h.x, 6, h.z).project(camera);
    if (v.z > 1) { h.tag.style.display = 'none'; continue; }
    h.tag.style.display = 'block';
    h.tag.style.left = (v.x*0.5+0.5)*FRAME.w + 'px';
    h.tag.style.top  = (-v.y*0.5+0.5)*FRAME.h + 'px';
  }

  // Update popups: project and age them
  const popupsToRemove = [];
  document.querySelectorAll('.popup').forEach(popup => {
    if (!popup.userData) return;
    const age = (performance.now() - popup.userData.startTime) / 1000;
    if (age > 0.8) {
      popup.style.display = 'none';
      popupsToRemove.push(popup);
      popupPool.live = Math.max(0, (popupPool.live || 0) - 1);
    } else {
      const h = popup.userData.hole;
      const pv = new THREE.Vector3(h.x, 6, h.z).project(camera);
      if (pv.z <= 1) {
        popup.style.left = (pv.x*0.5+0.5)*FRAME.w + 'px';
        popup.style.top  = (-pv.y*0.5+0.5)*FRAME.h + 'px';
      }
    }
  });
  popupsToRemove.forEach(p => { popupPool.push(p); });
}

// ---- Flow -----------------------------------------------------------------------
const pauseBtn = document.getElementById('pauseBtn');
document.getElementById('startBtn').onclick = start;
document.getElementById('resumeBtn').onclick = togglePause;
document.getElementById('restartBtn').onclick = () => {
  paused = false; pauseMenu.classList.add('hidden'); start();
};
document.getElementById('exitBtn').onclick = () => {
  if (!confirm('Are you sure? Progress will be lost!')) return;
  running = false; paused = false; pauseMenu.classList.add('hidden'); joyShow(false);
  showTab('play'); overlay.classList.remove('hidden');
};
pauseBtn.onclick = togglePause;

// Fullscreen (with the webkit fallback older iPads need).
document.getElementById('fsBtn').onclick = () => {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el);
  }
};

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseMenu.classList.toggle('hidden', !paused);
  if (!paused) { dragging = false; last = performance.now(); requestAnimationFrame(loop); }
}

function start() {
  const forced = SAVE.debug && selectedLevelId;
  init(LEVELS[forced ? selectedLevelId : pick(Object.keys(LEVELS))]);
  dragging = false;
  overlay.classList.add('hidden'); finalBoard.classList.add('hidden');
  document.getElementById('matchResult').classList.add('hidden');
  pauseBtn.classList.remove('hidden');
  joyShow(SAVE.controls === 'touch');
  running = true; paused = false;
  last = performance.now();
  requestAnimationFrame(loop);
  updateLevelInfo();  // Show level info when starting
}

function endMatch() {
  if (!running) return;
  running = false;
  joyShow(false);
  const alive = holes.slice();

  // Solo level handling
  if (!battleMode) {
    let reward, resultText, btnText;
    if (soloWon) {
      // Solo win
      const levelJustBeaten = SAVE.campaignLevel;
      SAVE.campaignLevel++;
      reward = Math.max(5, Math.round(player.r/2)) + 20;
      resultText = `Level ${levelJustBeaten} cleared! 🎉`;
      btnText = 'Next level';
      persistSave();
    } else {
      // Solo loss (time ran out)
      const devourPct = Math.round((1 - objects.length/levelTotal)*100);
      reward = Math.max(3, Math.round(player.r/4));
      resultText = `Time's up — devoured ${devourPct}% (goal ${Math.round(targetPct)}%)`;
      btnText = 'Retry level';
    }
    SAVE.gold += reward;
    persistSave();
    updateGold();

    // If an update arrived during the match, reload now that the reward is saved
    if (window.__pendingReload) {
      window.__reloaded = true;
      location.reload();
      return;
    }

    // Write result to #matchResult, NOT to #logo h1
    const matchResultEl = document.getElementById('matchResult');
    matchResultEl.textContent = resultText;
    matchResultEl.classList.remove('hidden');

    document.getElementById('playText').textContent = `You earned ${reward} 🪙.`;
    finalBoard.classList.add('hidden');  // No leaderboard for solo
    document.getElementById('startBtn').textContent = btnText;
    pauseBtn.classList.add('hidden');
    showTab('play');
    overlay.classList.remove('hidden');
  } else {
    // Battle mode handling
    const ranked = [...alive].sort((a,b)=>b.r-a.r);
    const rank = player.eaten ? 0 : ranked.indexOf(player)+1;

    // Match reward: gold for size, bonus for the podium.
    const reward = player.eaten
      ? Math.max(3, Math.round(player.r/4))
      : Math.max(5, Math.round(player.r/2)) +
        (rank === 1 ? 25 : rank === 2 ? 15 : rank === 3 ? 10 : 0);

    // Battle level always advances, even if swallowed
    SAVE.campaignLevel++;
    SAVE.gold += reward;
    persistSave();
    updateGold();

    // If an update arrived during the match, reload now that the reward is saved
    if (window.__pendingReload) {
      window.__reloaded = true;
      location.reload();
      return;
    }

    // Write result to #matchResult, NOT to #logo h1
    const matchResultEl = document.getElementById('matchResult');
    matchResultEl.textContent =
      player.eaten ? 'Swallowed! 💀'
      : rank === 1 && alive.length === 1 ? 'You ate everyone! 🏆'
      : rank === 1 ? 'You win! 🏆'
      : `You placed #${rank}`;
    matchResultEl.classList.remove('hidden');

    document.getElementById('playText').textContent = (player.eaten
      ? 'A bigger hole got you. Watch the leaderboard and keep your distance.'
      : `Final size ${Math.round(player.r)} · ${currentLevel.progressLabel} ` +
        Math.round((1 - objects.length/levelTotal)*100) + '%.')
      + ` You earned ${reward} 🪙.`;
    finalBoard.innerHTML = boardHtml(alive);
    finalBoard.classList.remove('hidden');
    document.getElementById('startBtn').textContent = 'Next level';
    pauseBtn.classList.add('hidden');
    showTab('play');
    overlay.classList.remove('hidden');
  }
  // Update level info now that campaignLevel may have advanced
  updateLevelInfo();
}

function loop(now) {
  if (!running || paused) { render(); return; }
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  update(dt);
  render();
  if (running) updateHud();
  if (!paused) requestAnimationFrame(loop);
}

buildLevelSelect();
updatePlayTab();
updateGold();
updateLevelInfo();
document.getElementById('versionTag').textContent = 'VoidRush ' + GAME_VERSION;
document.getElementById('versionSetting').textContent = 'VoidRush ' + GAME_VERSION;

// Debug unlock via URL parameter
if (location.search.includes('debug=1')) {
  SAVE.debug = true;
  persistSave();
  unlockAllCosmetics();
  syncDebugUi();
  buildLevelSelect();
  updatePlayTab();
}

// Installable PWA: cache the game for offline play (needs HTTPS, so this is
// a no-op when opening the file directly). Auto-updates without reinstall:
// new SW installs even if some assets fail, claims clients, and reloads the
// menu; network-first shell/code so the next open is never stuck on stale JS.
function safeReloadForUpdate() {
  if (window.__reloaded) return;
  if (running && !paused) {
    window.__pendingReload = true;
    return;
  }
  window.__reloaded = true;
  location.reload();
}

function activateWaitingWorker(reg) {
  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

function watchInstallingWorker(reg) {
  const worker = reg.installing;
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    // A new worker finished installing while we already have a controller —
    // force it to activate so controllerchange can reload us.
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}

if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    // If a previous open left a waiting worker, activate it now.
    activateWaitingWorker(reg);
    if (reg.installing) watchInstallingWorker(reg);

    reg.addEventListener('updatefound', () => watchInstallingWorker(reg));

    // Check for updates immediately, whenever the app is shown, and often
    // while sitting on the menu (iOS home-screen PWAs are lazy otherwise).
    const checkForUpdate = () => { reg.update().catch(() => {}); };
    checkForUpdate();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
    window.addEventListener('focus', checkForUpdate);
    setInterval(checkForUpdate, 60 * 1000);

    // Auto-reload when a new worker takes over (not mid-active match).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      safeReloadForUpdate();
    });
  }).catch(err => console.warn('[sw] register failed', err));

  // Hard fallback: if the shell is somehow still on an old build while the
  // network has a newer GAME_VERSION, reload once from the menu.
  function checkRemoteVersion() {
    if (running && !paused) return;
    fetch('js/config.js', { cache: 'no-store' })
      .then(r => r.ok ? r.text() : '')
      .then(text => {
        const m = text.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (m && m[1] && m[1] !== GAME_VERSION) safeReloadForUpdate();
      })
      .catch(() => {});
  }
  checkRemoteVersion();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkRemoteVersion();
  });
  setInterval(checkRemoteVersion, 2 * 60 * 1000);
}
