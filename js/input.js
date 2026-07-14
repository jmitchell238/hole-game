// Input: pointer events cover mouse, touch, and pen with one API, so the same
// drag-to-steer works on desktop, touchscreens, and iPad.

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2(0,0);

let activePointer = null;          // steer with the first finger only
function setNdc(e) {
  ndc.x = ((e.clientX - FRAME.x)/FRAME.w)*2 - 1;
  ndc.y = -((e.clientY - FRAME.y)/FRAME.h)*2 + 1;
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  dragging = true; setNdc(e);
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
  renderer.domElement.classList.add('dragging');
});
addEventListener('pointermove', e => {
  if (dragging && e.pointerId === activePointer) setNdc(e);
});
function endDrag(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  dragging = false;
  renderer.domElement.classList.remove('dragging');
  if (player) { player.tx = player.x; player.tz = player.z; }
}
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);
addEventListener('blur', () => { dragging = false; activePointer = null; });

const keys = {};
addEventListener('keydown', e => {
  if (e.key === 'Escape' && running) togglePause();
  keys[e.key.toLowerCase()] = true;
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('resize', layoutFrame);
