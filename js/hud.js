// HUD, leaderboard, the tabbed main menu (Store / Play / Settings), and the
// level-select buttons.

const overlay = document.getElementById('overlay');
const pauseMenu = document.getElementById('pauseMenu');
const finalBoard = document.getElementById('finalBoard');

const fmt = t => Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

let lastLevel = 1;

function boardHtml(list) {
  return [...list].sort((a,b)=>b.r-a.r).map((h,i) =>
    `<div class="row ${h.isPlayer?'me':''}"><span>
       <span class="rank">${i+1}</span>${h.name}</span>
     <span>Lv${sizeLevel(h.trueR)} · ${Math.round(h.r)}</span></div>`).join('');
}

// Cache DOM nodes — getElementById every frame is silly on a 2015 iPad
const _hud = {
  timer: document.getElementById('timer'),
  sizeInfo: document.getElementById('sizeInfo'),
  progressWrap: document.getElementById('progressWrap'),
  progressFill: document.getElementById('progressFill'),
  progressGoal: document.getElementById('progressGoal'),
  progressPct: document.getElementById('progressPct'),
  rows: document.getElementById('rows'),
  levelUp: document.getElementById('levelUp'),
};
let _hudLastMs = 0;
let _hudLastBoard = '';
let _hudLastPct = -1;

function updateHud(force) {
  const now = performance.now();
  const minDt = 1000 / (GFX.hudHz || 15);
  if (!force && now - _hudLastMs < minDt) return;
  _hudLastMs = now;

  if (_hud.timer) _hud.timer.textContent = fmt(timeLeft);
  if (!player) return;
  const lv = sizeLevel(player.trueR);
  if (_hud.sizeInfo)
    _hud.sizeInfo.textContent = 'Size ' + lv + '/20';

  if (lv > lastLevel && _hud.levelUp) {
    _hud.levelUp.textContent = 'SIZE ' + lv + '!';
    _hud.levelUp.classList.remove('hidden');
    _hud.levelUp.style.animation = 'none';
    void _hud.levelUp.offsetWidth;
    _hud.levelUp.style.animation = 'levelUpPop 1s ease-out forwards';
    lastLevel = lv;
  }

  if (!levelTotal) return;
  if (!battleMode) {
    const soloPct = Math.round(levelTotalArea > 0 ? (devouredArea / levelTotalArea) * 100 : 0);
    // Only update DOM when rounded percentage changed
    if (soloPct !== _hudLastPct) {
      const wasFirst = _hudLastPct === -1;
      _hudLastPct = soloPct;
      if (_hud.progressFill) {
        _hud.progressFill.style.width = soloPct + '%';
        _hud.progressFill.classList.toggle('done', soloPct >= targetPct);
        // Add animation class after width is set (not on first update to avoid virtual-time issues)
        if (!wasFirst) _hud.progressFill.classList.add('animate');
        else setTimeout(() => _hud.progressFill.classList.add('animate'), 0);
      }
      if (_hud.progressGoal) _hud.progressGoal.style.left = Math.round(targetPct) + '%';
      if (_hud.progressPct) _hud.progressPct.textContent = soloPct + '%';
    }
  } else {
    const pct = Math.round((1 - objects.length / levelTotal) * 100);
    // Only update DOM when rounded percentage changed
    if (pct !== _hudLastPct) {
      _hudLastPct = pct;
      if (_hud.progressFill) {
        _hud.progressFill.style.width = pct + '%';
        _hud.progressFill.classList.remove('done');
        _hud.progressFill.classList.add('animate');
      }
      if (_hud.progressGoal) _hud.progressGoal.style.display = 'none';
      if (_hud.progressPct) _hud.progressPct.textContent = pct + '%';
    }
    // Leaderboard HTML only when the ranking text actually changes
    const html = boardHtml(holes);
    if (html !== _hudLastBoard) {
      _hudLastBoard = html;
      if (_hud.rows) _hud.rows.innerHTML = html;
    }
  }
}

// ---- Tabs ------------------------------------------------------------------------
const TAB_PAGES = {
  store: document.getElementById('storePage'),
  play: document.getElementById('playPage'),
  settings: document.getElementById('settingsPage'),
};
const TAB_BTNS = {
  store: document.getElementById('tabStore'),
  play: document.getElementById('tabPlay'),
  settings: document.getElementById('tabSettings'),
};
function showTab(id) {
  for (const key in TAB_PAGES) {
    TAB_PAGES[key].classList.toggle('hidden', key !== id);
    TAB_BTNS[key].classList.toggle('active', key === id);
  }
  if (id === 'store') renderStore();
}
TAB_BTNS.store.onclick = () => showTab('store');
TAB_BTNS.play.onclick = () => showTab('play');
TAB_BTNS.settings.onclick = () => showTab('settings');

// The middle tab always names the level you're about to play.
function updatePlayTab() {
  const img = TAB_BTNS.play.querySelector('img');
  TAB_BTNS.play.textContent = '';
  if (img) TAB_BTNS.play.appendChild(img);
  TAB_BTNS.play.append(SAVE.debug && selectedLevelId ? LEVELS[selectedLevelId].name : 'Play');
}

// Show current campaign level and whether it's a battle
function updateLevelInfo() {
  const levelInfoEl = document.getElementById('levelInfo');
  if (!levelInfoEl) return;
  if (isBattleLevel(SAVE.campaignLevel)) {
    levelInfoEl.textContent = `Level ${SAVE.campaignLevel} · ⚔️ Bot Battle!`;
    levelInfoEl.style.color = '#58d68d';
  } else {
    levelInfoEl.textContent = `Level ${SAVE.campaignLevel}`;
    levelInfoEl.style.color = '';
  }
}

function updateGold() {
  const label = '🪙 ' + SAVE.gold;
  document.getElementById('goldStore').textContent = label;
  document.getElementById('goldPlay').textContent = label;
}

// ---- Store ------------------------------------------------------------------------
function cosmeticCard(item, kind) {
  const owned = item.cost === 0 || ownsCosmetic(item.id);
  const equipped = kind === 'color' ? SAVE.color === item.id : SAVE.design === item.id;
  const card = document.createElement('button');
  card.className = 'card' + (equipped ? ' equipped' : '');
  let face;
  if (kind === 'color') {
    face = `<span class="swatch" style="background:${item.hex}"></span>`;
  } else if (item.img) {
    face = `<img src="${item.img}" class="card-img" alt="${item.name}" />`;
  } else {
    face = `<span class="big">${item.emoji}</span>`;
  }
  const state = equipped ? 'Equipped' : owned ? 'Tap to equip'
    : `<span class="price">${item.cost} 🪙</span>`;
  card.innerHTML = `${face}<div>${item.name}</div><div class="state">${state}</div>`;
  if (!owned && SAVE.gold < item.cost) card.classList.add('locked');
  card.onclick = () => {
    if (!owned) {
      if (SAVE.gold < item.cost) return;
      SAVE.gold -= item.cost;
      SAVE.owned.push(item.id);
    }
    if (kind === 'color') SAVE.color = item.id;
    else SAVE.design = SAVE.design === item.id ? null : item.id;  // tap again to unequip
    persistSave(); updateGold(); renderStore();
  };
  return card;
}

function renderStore() {
  updateGold();
  const checkin = document.getElementById('checkinBtn');
  const claimed = SAVE.lastCheckin === todayStr();
  checkin.textContent = claimed ? 'Checked in today ✓' : 'Daily check-in · +10 🪙';
  checkin.disabled = claimed;
  const colors = document.getElementById('colorGrid');
  colors.innerHTML = '';
  for (const c of HOLE_COLORS) colors.appendChild(cosmeticCard(c, 'color'));
  const designs = document.getElementById('designGrid');
  designs.innerHTML = '';
  for (const d of HOLE_DESIGNS) designs.appendChild(cosmeticCard(d, 'design'));
}

document.getElementById('checkinBtn').onclick = () => {
  if (SAVE.lastCheckin === todayStr()) return;
  SAVE.lastCheckin = todayStr();
  SAVE.gold += 10;
  persistSave(); renderStore();
};

// ---- Settings ----------------------------------------------------------------------
const shadowsChk = document.getElementById('shadowsChk');
shadowsChk.checked = SAVE.shadows;
shadowsChk.onchange = () => {
  SAVE.shadows = shadowsChk.checked;
  SAVE._shadowsMigratedV30 = true; // user made an explicit choice
  persistSave();
  if (typeof applyGfxSettings === 'function') applyGfxSettings();
};

const fpsChk = document.getElementById('fpsChk');
if (fpsChk) {
  fpsChk.checked = !!SAVE.showFps;
  fpsChk.onchange = () => {
    SAVE.showFps = fpsChk.checked;
    persistSave();
    if (typeof setFpsOverlay === 'function') setFpsOverlay(SAVE.showFps);
  };
}

const controlsSel = document.getElementById('controlsSel');
controlsSel.value = SAVE.controls;
controlsSel.onchange = () => {
  SAVE.controls = controlsSel.value;
  persistSave();
};
const gfxSel = document.getElementById('gfxSel');
gfxSel.value = SAVE.gfxQuality || 'auto';
gfxSel.onchange = () => {
  SAVE.gfxQuality = gfxSel.value;
  if (gfxSel.value === 'auto') SAVE.measuredTier = null;  // re-measure
  persistSave();
  location.reload();   // renderer settings are boot-time - rebuild
};
const debugChk = document.getElementById('debugChk');
const debugSection = document.getElementById('debugSection');
function syncDebugUi() {
  debugChk.checked = SAVE.debug;
  debugSection.classList.toggle('hidden', !SAVE.debug);
}
syncDebugUi();
debugChk.onchange = () => {
  SAVE.debug = debugChk.checked;
  persistSave();
  syncDebugUi();
};
// Debug helper: grant every color and design so they can be previewed in-game.
// "Reset all progress" below undoes it.
function unlockAllCosmetics() {
  for (const item of [...HOLE_COLORS, ...HOLE_DESIGNS])
    if (!SAVE.owned.includes(item.id)) SAVE.owned.push(item.id);
  persistSave();
  updateGold();
}

document.getElementById('unlockAllBtn').onclick = () => {
  unlockAllCosmetics();
  showTab('store');   // straight to the Store to try them on
};
document.getElementById('resetBtn').onclick = () => {
  if (!confirm('Reset gold, purchases, and settings?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  location.reload();
};

// ---- Level select -------------------------------------------------------------------
// One button per registered level; new level files show up automatically.
let selectedLevelId = null;
function buildLevelSelect() {
  const wrap = document.getElementById('levelSelect');
  wrap.innerHTML = '';
  // Random button
  const randomBtn = document.createElement('button');
  randomBtn.className = selectedLevelId === null ? 'active' : '';
  randomBtn.textContent = 'Random';
  randomBtn.onclick = () => { selectedLevelId = null; buildLevelSelect(); updatePlayTab(); };
  wrap.appendChild(randomBtn);
  // Level buttons
  for (const id in LEVELS) {
    const b = document.createElement('button');
    b.className = id === selectedLevelId ? 'active' : '';
    b.textContent = LEVELS[id].name;
    b.onclick = () => { selectedLevelId = id; buildLevelSelect(); updatePlayTab(); };
    wrap.appendChild(b);
  }
}
