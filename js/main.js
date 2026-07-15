// Match setup, camera, the render/game loop, and menu wiring.

function init(level) {
  currentLevel = level;
  renderer.shadowMap.enabled = SAVE.shadows;
  document.getElementById('tags').innerHTML = '';
  for (const h of holes) removeHole(h);
  for (const o of objects) scene.remove(o.mesh);
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
  const names = BOT_NAMES.slice().sort(() => Math.random()-0.5);
  const spawns = level.botSpawns;
  for (let i = 0; i < spawns.length && i < names.length; i++)
    holes.push(makeHole(spawns[i][0], spawns[i][1], names[i], false));
  refreshGround();
  camPos.set(player.x, 200, player.z + 160);   // snap camera to the new spawn
  timeLeft = level.matchTime || MATCH_TIME;
  lastLevel = 1;
}

// ---- Camera + render -----------------------------------------------------------
let camPos = new THREE.Vector3(0, 200, 160);
function render() {
  const rz = player.r <= 120 ? player.r : 120 + (player.r - 120) * 0.45;
  const height = 115 + rz*4.2, depth = 95 + rz*3.6;
  const want = new THREE.Vector3(player.x, height, player.z + depth);
  camPos.lerp(want, 0.06);
  camera.position.copy(camPos);
  camera.lookAt(player.x, 0, player.z);

  // Dynamic fog: adjust far plane based on camera height
  scene.fog.far = Math.max(currentLevel.fog[1], height * 2.4);
  scene.fog.near = scene.fog.far * 0.38;

  // Sun (and its shadow window) follows the player.
  sun.position.set(player.x - 260, 520, player.z + 180);
  sun.target.position.set(player.x, 0, player.z);

  // Spin the equipped hole design.
  if (player.deco)
    player.deco.rotation.y = performance.now()/1000 * player.deco.userData.spin;

  renderer.render(scene, camera);

  const v = new THREE.Vector3();
  for (const h of holes) {
    v.set(h.x, 6, h.z).project(camera);
    if (v.z > 1) { h.tag.style.display = 'none'; continue; }
    h.tag.style.display = 'block';
    h.tag.style.left = (v.x*0.5+0.5)*FRAME.w + 'px';
    h.tag.style.top  = (-v.y*0.5+0.5)*FRAME.h + 'px';
  }
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
  pauseBtn.classList.remove('hidden');
  joyShow(SAVE.controls === 'touch');
  running = true; paused = false;
  last = performance.now();
  requestAnimationFrame(loop);
}

function endMatch() {
  if (!running) return;
  running = false;
  joyShow(false);
  const alive = holes.slice();
  const ranked = [...alive].sort((a,b)=>b.r-a.r);
  const rank = player.eaten ? 0 : ranked.indexOf(player)+1;

  // Match reward: gold for size, bonus for the podium.
  const reward = player.eaten
    ? Math.max(3, Math.round(player.r/4))
    : Math.max(5, Math.round(player.r/2)) +
      (rank === 1 ? 25 : rank === 2 ? 15 : rank === 3 ? 10 : 0);
  SAVE.gold += reward;
  persistSave();
  updateGold();

  // If an update arrived during the match, reload now that the reward is saved
  if (window.__pendingReload) {
    window.__reloaded = true;
    location.reload();
    return;
  }

  document.getElementById('playPage').querySelector('h1').textContent =
    player.eaten ? 'Swallowed! 💀'
    : rank === 1 && alive.length === 1 ? 'You ate everyone! 🏆'
    : rank === 1 ? 'You win! 🏆'
    : `You placed #${rank}`;
  document.getElementById('playText').textContent = (player.eaten
    ? 'A bigger hole got you. Watch the leaderboard and keep your distance.'
    : `Final size ${Math.round(player.r)} · ${currentLevel.progressLabel} ` +
      Math.round((1 - objects.length/levelTotal)*100) + '%.')
    + ` You earned ${reward} 🪙.`;
  finalBoard.innerHTML = boardHtml(alive);
  finalBoard.classList.remove('hidden');
  document.getElementById('startBtn').textContent = 'Play again';
  pauseBtn.classList.add('hidden');
  showTab('play');
  overlay.classList.remove('hidden');
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

// Debug unlock via URL parameter
if (location.search.includes('debug=1')) {
  SAVE.debug = true;
  persistSave();
  unlockAllCosmetics();
  debugChk.checked = SAVE.debug;
  debugSection.classList.toggle('hidden', !SAVE.debug);
  buildLevelSelect();
  updatePlayTab();
}

// Installable PWA: cache the game for offline play (needs HTTPS, so this is
// a no-op when opening the file directly).
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Check for updates immediately, on visibility change, and every 30 minutes
    reg.update();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update();
    });
    setInterval(() => reg.update(), 30 * 60 * 1000);

    // Auto-reload when a new worker takes over, but guard against mid-match reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (running && !paused) {
        window.__pendingReload = true;
        return;
      }
      if (!window.__reloaded) {
        window.__reloaded = true;
        location.reload();
      }
    });
  });
}
