// HUD, leaderboard, menus, and the level-select buttons.

const overlay = document.getElementById('overlay');
const pauseMenu = document.getElementById('pauseMenu');
const finalBoard = document.getElementById('finalBoard');

const fmt = t => Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

function boardHtml(list) {
  return [...list].sort((a,b)=>b.r-a.r).map((h,i) =>
    `<div class="row ${h.isPlayer?'me':''}"><span>
       <span class="rank">${i+1}</span>${h.name}</span>
     <span>${Math.round(h.r)}</span></div>`).join('');
}

function updateHud() {
  document.getElementById('timer').textContent = fmt(timeLeft);
  document.getElementById('sizeInfo').textContent = 'Size ' + Math.round(player.r);
  document.getElementById('progressInfo').textContent =
    currentLevel.progressLabel + ': ' +
    Math.round((1 - objects.length/levelTotal)*100) + '%';
  document.getElementById('rows').innerHTML = boardHtml(holes);
}

// One button per registered level; new level files show up automatically.
let selectedLevelId = null;
function buildLevelSelect() {
  const wrap = document.getElementById('levelSelect');
  wrap.innerHTML = '';
  for (const id in LEVELS) {
    const b = document.createElement('button');
    b.className = id === selectedLevelId ? 'active' : '';
    b.textContent = LEVELS[id].name;
    b.onclick = () => { selectedLevelId = id; buildLevelSelect(); };
    wrap.appendChild(b);
  }
}
