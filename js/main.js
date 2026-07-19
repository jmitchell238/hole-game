// Match setup, camera, the render/game loop, and menu wiring.

function init(level) {
  currentLevel = level;
  applyGfxSettings();
  document.getElementById('tags').innerHTML = '';
  for (const h of holes) removeHole(h);
  // Tear down previous match props cleanly (shared proxy geo/mats stay alive)
  for (const o of objects) {
    if (typeof destroyProp === 'function') destroyProp(o);
    else if (o.mesh) scene.remove(o.mesh);
  }
  objects = [];
  holes = [];
  applyEnvironment(level);
  setPitStyle(level);
  level.generate();          // roll this match's random layout
  buildGround(level);
  level.populate(addProp);
  levelTotal = objects.length;
  levelTotalArea = 0;
  for (const o of objects) levelTotalArea += areaOf(o.r);
  devouredArea = 0; winDelay = 0;
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
  // Index props and only keep nearby / large-enough ones parented to the scene
  if (typeof rebuildSpatialIndex === 'function') rebuildSpatialIndex();
  // Snap camera pose so streaming uses a sensible view radius
  camera.position.copy(camPos);
  camera.lookAt(player.x, 0, player.z);
  if (typeof streamProps === 'function' && GFX.streamProps) streamProps(true);

  // Initialize free camera if this is a freeCam level
  if (currentLevel && currentLevel.freeCam && typeof initFreeCam === 'function') {
    initFreeCam();
    // Hide gameplay UI for freeCam levels
    if (player && player.mesh) player.mesh.visible = false;
    if (player && player.tag) player.tag.style.display = 'none';
    if (document.getElementById('joystick')) document.getElementById('joystick').style.display = 'none';
    if (document.getElementById('hud')) document.getElementById('hud').style.display = 'none';
  } else {
    // Restore UI for normal levels
    if (player && player.mesh) player.mesh.visible = true;
    if (player && player.tag) player.tag.style.display = 'block';
    if (document.getElementById('joystick')) document.getElementById('joystick').style.display = 'block';
    if (document.getElementById('hud')) document.getElementById('hud').style.display = 'block';
  }

  // Timer: solo 300s, battle always 150s (fixed pacing, no level override)
  const isSolo = !battleMode;
  timeLeft = isSolo ? 300 : MATCH_TIME;
  matchTime = isSolo ? 300 : MATCH_TIME;   // set global for grace period calculation

  // Solo objective: target percentage increases with campaign level
  targetPct = (currentLevel && currentLevel.targetPct != null) ? currentLevel.targetPct : soloTargetPct(SAVE.campaignLevel);
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
let livePopups = [];  // array of live popup elements
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
  livePopups.push(popup);
  return popup;
}

// ---- Camera + render -----------------------------------------------------------
let camPos = new THREE.Vector3(0, 200, 160);

function applyGfxSettings() {
  // Low-end: never enable shadow maps (huge cost). Desktop can toggle.
  const want = !GFX.lowEnd && !!SAVE.shadows;
  renderer.shadowMap.enabled = want;
  sun.castShadow = want;
  if (ground) ground.receiveShadow = want;
}

let _hudTick = 0;
let _fpsFrames = 0, _fpsLast = 0, _fps = 0;
let _tunerLowCount = 0, _tunerDemoted = false, _matchStartMs = 0;

/** Show/hide the FPS chip. Called from Settings and the render loop. */
function setFpsOverlay(on, fpsValue) {
  let el = document.getElementById('fpsChip');
  if (!on) {
    if (el) el.style.display = 'none';
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'fpsChip';
    el.style.cssText = 'position:absolute;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));z-index:50;padding:6px 10px;background:rgba(0,0,0,.65);color:#8f8;font:bold 14px ui-monospace,monospace;pointer-events:none;border-radius:8px;letter-spacing:.3px';
    document.getElementById('frame').appendChild(el);
  }
  el.style.display = 'block';
  const fps = fpsValue != null ? fpsValue : _fps;
  el.textContent = (fps ? fps.toFixed(0) : '—') + ' fps · n=' +
    (typeof objects !== 'undefined' ? objects.length : 0) +
    ' · ' + (GFX.qualityLabel || '?');
}

/** Auto-demote slow devices to performance tier, persisted for session. */
function autoDemoteToPerf() {
  if (_tunerDemoted) return;
  _tunerDemoted = true;
  SAVE.measuredTier = 'perf';
  persistSave();
  // Live-apply the cheap wins now; boot-time settings (precision, HOLE_SEG,
  // renderer antialias) pick up the persisted tier on next reload.
  GFX.lowEnd = true;
  GFX.tier = 'perf';
  GFX.renderScale = 0.45;
  GFX.pixelRatio = 1;
  GFX.clutterKeep = 0.12;
  GFX.hudHz = 8;
  GFX.camHeightMul = 4.6;
  GFX.camDepthMul = 3.9;
  GFX.qualityLabel = 'perf-auto';
  renderer.setPixelRatio(1);
  layoutFrame();
  sun.intensity = 0;
  applyGfxSettings();
  const flash = document.getElementById('levelUp');
  if (flash) {
    flash.textContent = 'PERFORMANCE MODE ON';
    flash.classList.remove('hidden');
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = 'levelUpPop 2s ease-out forwards';
  }
}

function render() {
  // FreeCam mode: skip normal player-follow camera
  if (currentLevel && currentLevel.freeCam && typeof updateFreeCam === 'function') {
    updateFreeCam();
    // Still update sun for lighting, but relative to gallery center
    let sunX = 0, sunZ = 0;
    if (typeof window !== 'undefined' && window.freeCamController) {
      sunX = window.freeCamController.target.x - 260;
      sunZ = window.freeCamController.target.z + 180;
    }
    sun.position.set(sunX, 520, sunZ);
    sun.target.position.set(sunX + 260, 0, sunZ - 180);
  } else {
    // Normal mode: camera follows hole
    // Camera: distance ∝ r so hole stays ~constant on-screen fraction (~30%).
    // Look slightly past the hole so more ground fills the frame (less empty sky).
    let height = 12 + player.r * 3.9 + player.r * player.r * 0.008;
    let depth = 10 + player.r * 3.3 + player.r * player.r * 0.0065;
    const want = new THREE.Vector3(player.x, height, player.z + depth);
    camPos.lerp(want, GFX.lowEnd ? 0.12 : 0.08);
    camera.position.copy(camPos);
    // Aim a bit in front of the hole so the upper half of the frame is ground, not void
    const lookAhead = player.r * 0.35;
    camera.lookAt(player.x, 0, player.z - lookAhead * 0.15);

    sun.position.set(player.x - 260, 520, player.z + 180);
    sun.target.position.set(player.x, 0, player.z);
  }

  for (const h of holes) {
    if (h.deco)
      h.deco.rotation.y = performance.now() / 1000 * h.deco.userData.spin;
  }

  // Only thrash the scene graph when there are many props
  if (GFX.streamProps && typeof streamProps === 'function') streamProps(false);

  renderer.render(scene, camera);

  // FPS sampling (unconditional for tuner; display behind SAVE.showFps)
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast > 400) {
    _fps = (_fpsFrames * 1000) / (now - _fpsLast);
    _fpsFrames = 0; _fpsLast = now;

    // Tuner: auto-demote slow devices to perf tier (once per session, persisted)
    const tunerActive = !_tunerDemoted && running &&
      (SAVE.gfxQuality === 'auto' || !SAVE.gfxQuality) &&
      GFX.tier === 'high' && GFX.mobile &&
      (performance.now() - _matchStartMs) > 4000;
    if (tunerActive) {
      if (_fps < 38) { _tunerLowCount++; if (_tunerLowCount >= 12) autoDemoteToPerf(); }
      else _tunerLowCount = 0;
    }

    if (SAVE.showFps) setFpsOverlay(true, _fps);
  }

  // HUD tags every other frame (DOM writes are costly on old iOS)
  if (((_hudTick++) & 1) === 0) {
    const v = new THREE.Vector3();
    for (const h of holes) {
      v.set(h.x, Math.max(4, h.r * 0.05), h.z).project(camera);
      if (v.z > 1 && !h.isPlayer) { h.tag.style.display = 'none'; continue; }
      h.tag.style.display = 'block';
      h.tag.style.left = clamp((v.x * 0.5 + 0.5) * FRAME.w, 8, FRAME.w - 8) + 'px';
      h.tag.style.top = clamp((-v.y * 0.5 + 0.5) * FRAME.h, 8, FRAME.h - 8) + 'px';
    }
  }

  // Popups
  const popupsToRemove = [];
  for (let i = livePopups.length - 1; i >= 0; i--) {
    const popup = livePopups[i];
    if (!popup.userData) {
      livePopups.splice(i, 1);
      continue;
    }
    const age = (performance.now() - popup.userData.startTime) / 1000;
    if (age > 0.8) {
      popup.style.display = 'none';
      popupsToRemove.push(popup);
      livePopups.splice(i, 1);
    } else {
      const h = popup.userData.hole;
      const pv = new THREE.Vector3(h.x, 6, h.z).project(camera);
      if (pv.z <= 1) {
        popup.style.left = (pv.x * 0.5 + 0.5) * FRAME.w + 'px';
        popup.style.top = (-pv.y * 0.5 + 0.5) * FRAME.h + 'px';
      }
    }
  }
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
  _matchStartMs = performance.now();
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
      reward = soloReward(true, player.r);
      resultText = `Level ${levelJustBeaten} cleared! 🎉`;
      btnText = 'Next level';
    } else {
      // Solo loss (time ran out)
      const devourPct = Math.round(levelTotalArea > 0 ? (devouredArea / levelTotalArea) * 100 : 0);
      reward = soloReward(false, player.r);
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
    const reward = battleReward(player.eaten, player.r, rank);

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
  if (!running || paused) {
    // Single idle frame when paused — don't spin the GPU
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  updateHud(false);
  requestAnimationFrame(loop);
}

buildLevelSelect();
updatePlayTab();
updateGold();
updateLevelInfo();
document.getElementById('versionTag').textContent = 'VoidRush ' + GAME_VERSION_LABEL;
document.getElementById('versionSetting').textContent = 'VoidRush ' + GAME_VERSION_LABEL;

// Restore FPS overlay preference on boot
if (SAVE.showFps && typeof setFpsOverlay === 'function') setFpsOverlay(true, 0);

// Keep FPS updating on the menu too (not only mid-match)
(function menuFpsLoop() {
  if (SAVE.showFps && !running) {
    _fpsFrames++;
    const now = performance.now();
    if (now - _fpsLast > 400) {
      _fps = (_fpsFrames * 1000) / Math.max(1, now - _fpsLast);
      _fpsFrames = 0; _fpsLast = now;
      setFpsOverlay(true, _fps);
    }
  }
  requestAnimationFrame(menuFpsLoop);
})();

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
