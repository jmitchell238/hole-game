// Input: pointer events cover mouse, touch, and pen with one API, so the same
// drag-to-steer works on desktop, touchscreens, and iPad.

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2(0,0);

let activePointer = null;          // steer with the first finger only

// Floating joystick for touch input
let joyActive = false, joyX = 0, joyY = 0;
const JOY_R = 44;                  // max knob travel in px
let joyCenterX = 0, joyCenterY = 0;

function joyShow(on) {
  const joyEl = document.getElementById('joy');
  const knobEl = document.getElementById('joyKnob');
  if (on) {
    // Park at bottom-center hint spot
    const bottomY = FRAME.y + FRAME.h - 90;
    joyEl.style.left = (FRAME.x + FRAME.w/2 - 55) + 'px';
    joyEl.style.top = bottomY + 'px';
    joyEl.classList.remove('hidden');
    joyEl.classList.add('rest');
    knobEl.style.transform = 'translate(-50%, -50%)';
  } else {
    joyEl.classList.add('hidden');
  }
}

function setNdc(e) {
  ndc.x = ((e.clientX - FRAME.x)/FRAME.w)*2 - 1;
  ndc.y = -((e.clientY - FRAME.y)/FRAME.h)*2 + 1;
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  if (e.pointerType === 'mouse') {
    dragging = true; setNdc(e);
  } else {
    // Touch/pen: start joystick mode
    joyActive = true;
    joyCenterX = e.clientX - FRAME.x;
    joyCenterY = e.clientY - FRAME.y;
    joyX = joyY = 0;
    const joyEl = document.getElementById('joy');
    joyEl.style.left = (FRAME.x + joyCenterX - 55) + 'px';
    joyEl.style.top = (FRAME.y + joyCenterY - 55) + 'px';
    joyEl.classList.remove('hidden', 'rest');
  }
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
  renderer.domElement.classList.add('dragging');
});
addEventListener('pointermove', e => {
  if (e.pointerId !== activePointer) return;
  if (dragging) {
    setNdc(e);
  } else if (joyActive) {
    const dx = (e.clientX - FRAME.x) - joyCenterX;
    const dy = (e.clientY - FRAME.y) - joyCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_R) {
      const scale = JOY_R / dist;
      joyX = dx * scale / JOY_R;
      joyY = dy * scale / JOY_R;
    } else {
      joyX = dx / JOY_R;
      joyY = dy / JOY_R;
    }
    const knobEl = document.getElementById('joyKnob');
    const tx = (joyX * JOY_R);
    const ty = (joyY * JOY_R);
    knobEl.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
  }
});
function endDrag(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  dragging = false;
  joyActive = false;
  joyX = joyY = 0;
  renderer.domElement.classList.remove('dragging');
  if (player) { player.tx = player.x; player.tz = player.z; }
  // Reset joystick knob to center
  const knobEl = document.getElementById('joyKnob');
  knobEl.style.transform = 'translate(-50%, -50%)';
  // Return to rest hint if match running
  if (running) joyShow(true);
  else document.getElementById('joy').classList.add('hidden');
}
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);
addEventListener('blur', () => { dragging = false; activePointer = null; joyActive = false; joyX = joyY = 0; });

const keys = {};
addEventListener('keydown', e => {
  if (e.key === 'Escape' && running) togglePause();
  keys[e.key.toLowerCase()] = true;
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('resize', layoutFrame);
