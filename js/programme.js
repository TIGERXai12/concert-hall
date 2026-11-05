import * as THREE from 'three';
// In-world printed programme (节目单) resting in front of the seated listener.
function coverTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 360;
  const x = c.getContext('2d');
  x.fillStyle = '#f4ecdc'; x.fillRect(0, 0, 256, 360);
  x.strokeStyle = '#a8864a'; x.lineWidth = 3; x.strokeRect(14, 14, 228, 332);
  x.lineWidth = 1; x.strokeRect(22, 22, 212, 316);
  x.fillStyle = '#3a2a1a'; x.textAlign = 'center';
  x.font = '600 44px "Songti SC","Noto Serif SC",serif'; x.fillText('节目单', 128, 160);
  x.font = '18px serif'; x.fillStyle = '#8a6a3a'; x.fillText('PROGRAMME', 128, 200);
  x.fillText('音 乐 厅', 128, 300);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createProgramme(scene, tracks, livePos) {
  const paper = new THREE.MeshStandardMaterial({ color: 0xf4ecdc, roughness: 0.9 });
  const cover = new THREE.MeshStandardMaterial({ map: coverTexture(), roughness: 0.85 });
  const booklet = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.008), [paper, paper, paper, paper, cover, paper]);
  booklet.visible = false; booklet.name = 'programme';
  scene.add(booklet);

  const ov = document.createElement('div'); ov.id = 'programme'; ov.className = 'hidden';
  ov.innerHTML = '<div class="pg-card"><div class="pg-h">节 目 单</div><div class="pg-sub">PROGRAMME</div><ol></ol><div class="pg-foot">轻触空白处关闭</div></div>';
  document.body.appendChild(ov);
  const ol = ov.querySelector('ol');
  const split = (t) => { const m = t.match(/^(.*?)(《.*)$/); return m ? [m[1], m[2]] : ['', t]; };
  ol.innerHTML = tracks.map((t, i) => { const [comp, work] = split(t.title);
    return `<li data-i="${i}"><span class="pg-c">${comp}</span><span class="pg-w">${work}</span></li>`; }).join('');
  let timer = 0;
  const mark = () => { const { i } = livePos(); ol.querySelectorAll('li').forEach((li) => li.classList.toggle('now', +li.dataset.i === i)); };
  function open() { mark(); ov.classList.remove('hidden'); clearInterval(timer); timer = setInterval(mark, 2000);
    if (document.pointerLockElement) document.exitPointerLock(); }
  function close() { ov.classList.add('hidden'); clearInterval(timer); }
  ov.addEventListener('click', (e) => { if (!e.target.closest('.pg-card')) close(); e.stopPropagation(); });

  function placeAtSeat(seat) {
    if (!seat) { booklet.visible = false; return; }
    const wp = new THREE.Vector3(); seat.getWorldPosition(wp);
    const q = new THREE.Quaternion(); seat.getWorldQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    booklet.position.copy(wp).addScaledVector(fwd, 0.6).addScaledVector(right, 0.2).add(new THREE.Vector3(0, 0.98, 0));
    booklet.quaternion.copy(q);
    booklet.rotateX(-1.1); booklet.rotateZ(0.25); // leaning back on the rail in front, facing the listener
    booklet.visible = true;
  }
  const isOpen = () => !ov.classList.contains('hidden');
  return { booklet, open, close, placeAtSeat, isOpen };
}
