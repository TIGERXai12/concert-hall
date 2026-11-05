import * as THREE from 'three';
import { STAGE_FOCUS } from './seats.js?v=17';
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
  booklet.name = 'programme';
  // Seat-back pocket (covers lower half; title stays readable above it)
  const pocketMat = new THREE.MeshStandardMaterial({ color: 0x4a1c20, roughness: 0.95 });
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), pocketMat);
  pocket.position.set(0, -0.05, 0.012);
  // Invisible, larger tap target for phones
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  hit.name = 'programmeHit';
  const stand = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8913c, metalness: 0.7, roughness: 0.35 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), brass); rod.position.set(0, -0.13, -0.03);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 0.08), brass); foot.position.set(0, -0.16, -0.02); stand.add(foot);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.03), brass); lip.position.set(0, -0.108, 0.01);
  stand.add(rod, lip);
  const holder = new THREE.Group(); holder.add(booklet, pocket, hit, stand); holder.visible = false;
  scene.add(holder);
  let allSeats = [];

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

  function frontSeatOf(seat, wp, fwd) {
    const want = wp.clone().addScaledVector(fwd, 1.0); let best = null, bd = 0.45;
    const p = new THREE.Vector3();
    for (const o of allSeats) { if (o === seat) continue; o.getWorldPosition(p);
      if (Math.abs(p.y - want.y) > 0.6 || Math.abs(Math.sin(o.rotation.y - seat.rotation.y)) > 0.1 || Math.cos(o.rotation.y - seat.rotation.y) < 0) continue;
      const d = Math.hypot(p.x - want.x, p.z - want.z); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  function placeAtSeat(seat) {
    if (!seat) { holder.visible = false; return; }
    seat.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3(); seat.getWorldPosition(wp);
    const q = new THREE.Quaternion(); seat.getWorldQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const front = frontSeatOf(seat, wp, fwd);
    holder.matrixAutoUpdate = true;
    if (front) { // pocket on the back of the seat in front, cover facing us
      front.updateWorldMatrix(true, false);
      // slide along the seat-back row so it lies on the line of sight to the stage
      const inv = new THREE.Matrix4().copy(front.matrixWorld).invert();
      const a = wp.clone().applyMatrix4(inv), f = STAGE_FOCUS.clone().applyMatrix4(inv);
      let lx = 0; if (Math.abs(f.z - a.z) > 1e-3) lx = a.x + (f.x - a.x) * (0.272 - a.z) / (f.z - a.z);
      lx = THREE.MathUtils.clamp(lx, -0.9, 0.9);
      holder.position.set(lx, 0.82, 0.272).applyMatrix4(front.matrixWorld);
      front.getWorldQuaternion(holder.quaternion);
      holder.rotateX(-0.06);
      pocket.visible = true; stand.visible = false;
    } else { // front row: small brass stand just ahead
      // Short brass easel resting on the parapet rail cap (top ≈ +0.90 above row-1 floor)
      const onRail = seat.userData.parapet;
      holder.position.set(0.1, onRail ? 1.07 : 0.95, onRail ? -0.66 : -0.85).applyMatrix4(seat.matrixWorld);
      holder.quaternion.copy(q); holder.rotateX(-0.25); stand.visible = true;
      pocket.visible = false;
    }
    holder.visible = true;
  }
  const isOpen = () => !ov.classList.contains('hidden');
  return { booklet: holder, tapTargets: [hit, booklet], open, close, placeAtSeat, isOpen, setSeats: (a) => { allSeats = a; } };
}
