// Mouse / keyboard input and window resize handling.

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2(0,0);

function setNdc(e) {
  ndc.x = (e.clientX/innerWidth)*2 - 1;
  ndc.y = -(e.clientY/innerHeight)*2 + 1;
}
renderer.domElement.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  dragging = true; setNdc(e);
  renderer.domElement.classList.add('dragging');
});
addEventListener('mousemove', e => { if (dragging) setNdc(e); });
addEventListener('mouseup', () => {
  dragging = false;
  renderer.domElement.classList.remove('dragging');
  if (player) { player.tx = player.x; player.tz = player.z; }
});
addEventListener('blur', () => { dragging = false; });

const keys = {};
addEventListener('keydown', e => {
  if (e.key === 'Escape' && running) togglePause();
  keys[e.key.toLowerCase()] = true;
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
