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
     <span>Lv${sizeLevel(h.r)} · ${Math.round(h.r)}</span></div>`).join('');
}

function updateHud() {
  document.getElementById('timer').textContent = fmt(timeLeft);
  const lv = sizeLevel(player.r);
  document.getElementById('sizeInfo').textContent = 'Level ' + lv + ' · Size ' + Math.round(player.r);

  // Level-up flash
  if (lv > lastLevel) {
    const levelUpEl = document.getElementById('levelUp');
    levelUpEl.textContent = lv === 10 ? 'MAX SIZE!' : 'SIZE ' + lv + '!';
    levelUpEl.classList.remove('hidden');
    // Restart animation by removing and re-adding the element or toggling the class
    void levelUpEl.offsetWidth; // trigger reflow
    levelUpEl.style.animation = 'none';
    void levelUpEl.offsetWidth; // trigger reflow again
    levelUpEl.style.animation = 'levelUpPop 1s ease-out forwards';
    lastLevel = lv;
  }

  document.getElementById('progressInfo').textContent =
    currentLevel.progressLabel + ': ' +
    Math.round((1 - objects.length/levelTotal)*100) + '%';
  document.getElementById('rows').innerHTML = boardHtml(holes);
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
  persistSave();
};
const controlsSel = document.getElementById('controlsSel');
controlsSel.value = SAVE.controls;
controlsSel.onchange = () => {
  SAVE.controls = controlsSel.value;
  persistSave();
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
