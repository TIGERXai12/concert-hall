import * as THREE from 'three';
import { buildHall, addCurtains } from './hall.js?v=16';
import { buildOrchestra } from './orchestra.js?v=16';
import { buildSeats, setSeatHover, setSeatOccupied, getSeatCameraPose, STAGE_FOCUS } from './seats.js?v=16';
import { createPresence } from './presence.js?v=16';
import { makeChibi } from './audience.js?v=16';
import { createPlayer } from './player.js?v=16';
import { createProgramme } from './programme.js?v=16';
import { createControls } from './controls.js?v=16';

const canvas = document.getElementById('c');
const entry = document.getElementById('entry');
const enterBtn = document.getElementById('enterBtn');
const hud = document.getElementById('hud');
const hint = document.getElementById('hint');
const seatLabel = document.getElementById('seatLabel');
const standBtn = document.getElementById('standBtn');
const seatPrompt = document.getElementById('seatPrompt');
const seatPromptText = document.getElementById('seatPromptText');
const sitBtn = document.getElementById('sitBtn');
const joystick = document.getElementById('joystick');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1510);
scene.fog = new THREE.FogExp2(0x1a1410, 0.012);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 1.7, 12);
const eye = camera.position.clone(); // logical first-person eye; render camera follows in third person

const hallRoot = buildHall(scene);
addCurtains(scene);
const { animators } = buildOrchestra(scene);
const { seats } = buildSeats(scene);
const seatsGroup = scene.getObjectByName('seats');

const FLOOR_BOUNDS = { minX: -14, maxX: 14, minZ: -9.5, maxZ: 19.5, minY: 1.7 };
const WALK = { ...FLOOR_BOUNDS };
// Walkable area of a balcony section = bounding box of its seats (+ small margin)
function sectionBounds(seat) {
  const b = { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 }, p = new THREE.Vector3();
  seatsGroup.traverse((o) => { if (o.userData.floor === seat.userData.floor && o.userData.section === seat.userData.section && o.userData.label) {
    o.getWorldPosition(p); b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x); b.minZ = Math.min(b.minZ, p.z); b.maxZ = Math.max(b.maxZ, p.z); } });
  const m = 0.4; b.minX -= m; b.maxX += m; b.minZ -= m; b.maxZ += m; return b;
}
const controls = createControls(camera, canvas, {
  speed: 4.8,
  bounds: WALK,
});

// ===== 曲目单（由主人决定，观众只听）：按顺序播放，播完循环。改这里即可 =====
const TRACKS = [
  { title: '拉赫玛尼诺夫《第二钢琴协奏曲》第一乐章', url: 'assets/audio/rachmaninoff-pc2-i.mp3', duration: 300.024 },
  { title: '圣桑《骷髅之舞》Op.40', url: 'assets/audio/saint-saens-danse-macabre.mp3', duration: 300.042 },
  { title: '肖邦《降E大调夜曲》Op.9 No.2', url: 'assets/audio/chopin-nocturne-op9-2.mp3', duration: 271.517 },
  { title: '柴可夫斯基《第一钢琴协奏曲》第一乐章', url: 'assets/audio/tchaikovsky-pc1-i.mp3', duration: 300.042 },
  { title: '贝多芬《悲怆奏鸣曲》第一乐章', url: 'assets/audio/beethoven-pathetique-i.mp3', duration: 300.042 },
  { title: '德彪西《月光》', url: 'assets/audio/debussy-clair-de-lune.mp3', duration: 304.118 },
  { title: '贝多芬《第五交响曲·命运》第一乐章', url: 'assets/audio/beethoven-sym5-i.mp3', duration: 300.024 },
  { title: '肖邦《练习曲》Op.10 No.4', url: 'assets/audio/chopin-etude-op10-4.mp3', duration: 132.598 },
  { title: '肖邦《革命练习曲》Op.10 No.12', url: 'assets/audio/chopin-etude-revolutionary.mp3', duration: 164.833 },
  { title: '李斯特《安慰曲》第3首', url: 'assets/audio/liszt-consolation-3.mp3', duration: 226.429 },
  { title: '德沃夏克《第九交响曲·自新大陆》第四乐章', url: 'assets/audio/dvorak-sym9-iv.mp3', duration: 300.024 },
  { title: '巴赫《耶稣，世人仰望的喜悦》BWV 147', url: 'assets/audio/bach-jesu-joy.mp3', duration: 202.292 },
  { title: '李斯特《钟》La Campanella', url: 'assets/audio/liszt-la-campanella.mp3', duration: 372.219 },
];
const audio = createPlayer(TRACKS, {
  onStatus(s) {
    if (s === 'blocked') {
      // Fallback: start on the next touch/click anywhere (no visible button)
      const retry = () => { audio.play(); };
      window.addEventListener('pointerdown', retry, { once: true, capture: true });
      window.addEventListener('touchend', retry, { once: true, capture: true });
    }
  },
});
audio.updateForSeat = (eye) => {
  const d = Math.hypot(eye.x, eye.y - 2.2, eye.z + 1);
  audio.setVolume(Math.min(1, Math.max(0.5, 1.25 - d / 30)));
};

const raycaster = new THREE.Raycaster();
const programme = createProgramme(scene, TRACKS, () => audio.livePos());
programme.setSeats(seats);
// Tap the booklet → open programme (captures before seat logic)
window.addEventListener('click', (e) => {
  if (!programme.booklet.visible || programme.isOpen()) return;
  if (e.target !== canvas) return; // UI buttons always win
  const v = (document.pointerLockElement && !currentSeat) ? new THREE.Vector2(0, 0)
    : new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(v, camera);
  const hit = raycaster.intersectObjects(programme.tapTargets, false);
  // Screen-space fallback: tap within ~80px of the booklet's projected centre
  const bc = new THREE.Vector3(); programme.tapTargets[1].getWorldPosition(bc);
  const dist = bc.distanceTo(camera.position); bc.project(camera);
  const sx = (bc.x + 1) / 2 * innerWidth, sy = (1 - bc.y) / 2 * innerHeight;
  const near = bc.z < 1 && dist < 4 && Math.hypot(sx - e.clientX, sy - e.clientY) < 80;
  if ((hit.length && hit[0].distance < 4) || near) { e.stopImmediatePropagation(); e.preventDefault(); programme.open(); }
}, true);
const pointer = new THREE.Vector2();
let hoveredSeat = null;
let currentSeat = null;
let pendingSeat = null;

// ===== 在线观众（只显示真实在线用户）=====
const onlineEl = document.getElementById('online');
const _dir = new THREE.Vector3();
const presence = createPresence(scene, seats, {
  getSelf() {
    camera.getWorldDirection(_dir);
    const p = eye;
    const floorY = p.y > 9 ? 10.6 : p.y > 5 ? 5.9 : 0;
    return { seat: currentSeat ? seats.indexOf(currentSeat) : null, x: p.x, y: floorY, z: p.z, yaw: Math.atan2(-_dir.x, -_dir.z) };
  },
  onCount(n) { if (onlineEl) onlineEl.textContent = '在线 ' + n; },
  onSeatsChanged() {
    const taken = presence ? presence.takenSeats() : new Set();
    seats.forEach((st, i) => { if (st !== currentSeat) setSeatOccupied(st, taken.has(i)); });
  },
});
let started = false;

function findSeatRoot(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.isSeat && o.userData.label) return o;
    if (o.userData?.seatRoot) return o.userData.seatRoot;
    o = o.parent;
  }
  return null;
}

function pickSeat(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(seats, true);
  if (!hits.length) return null;
  return findSeatRoot(hits[0].object);
}

function showPrompt(seat) {
  pendingSeat = seat;
  seatPromptText.textContent = seat.userData.label;
  seatPrompt.classList.remove('hidden');
}

function hidePrompt() {
  pendingSeat = null;
  seatPrompt.classList.add('hidden');
}

function sitIn(seat) {
  if (!seat || seat.userData.occupied) return;
  if (presence.takenSeats().has(seats.indexOf(seat))) return;
  if (currentSeat) setSeatOccupied(currentSeat, false);
  currentSeat = seat;
  setSeatOccupied(seat, true);
  setSeatHover(hoveredSeat, false);
  hoveredSeat = null;
  hidePrompt();

  const { eye, target } = getSeatCameraPose(seat);
  controls.setSeated(true);
  controls.lookAt(eye, target);

  seatLabel.textContent = seat.userData.label;
  seatLabel.classList.remove('hidden');
  standBtn.classList.remove('hidden');
  joystick?.classList.add('seated');
  hint.textContent = '正在聆听 · 点击「起身换座」可换位置';
  audio.updateForSeat(eye);
  programme.placeAtSeat(seat);
}

function standUp() {
  if (!currentSeat) return;
  const seat = currentSeat;
  const pos = new THREE.Vector3();
  seat.getWorldPosition(pos);
  setSeatOccupied(seat, false);
  programme.placeAtSeat(null);
  programme.close();
  currentSeat = null;
  controls.setSeated(false);
  let eye;
  if ((seat.userData.floor || '').startsWith('一楼') && pos.y < 2.5) {
    Object.assign(WALK, FLOOR_BOUNDS); curLevel = 0;
    eye = new THREE.Vector3(pos.x, 1.7, pos.z);
  } else {
    // Balconies / choir / 3F: stay on this level, walk within its section
    Object.assign(WALK, sectionBounds(seat), { minY: pos.y + 1.5 }); curLevel = -1;
    LEVELS.forEach((L, i) => { if (i && L.name === seat.userData.floor && seat.userData.section === 'L区') curLevel = i; });
    eye = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z);
  }
  eye.x = THREE.MathUtils.clamp(eye.x, WALK.minX, WALK.maxX);
  eye.z = THREE.MathUtils.clamp(eye.z, WALK.minZ, WALK.maxZ);
  controls.lookAt(eye, new THREE.Vector3(STAGE_FOCUS.x, 1.7, STAGE_FOCUS.z));
  camera.position.copy(eye);
  seatLabel.classList.add('hidden');
  standBtn.classList.add('hidden');
  joystick?.classList.remove('seated');
  hint.textContent = '走近空座位并点击，即可入座';
  audio.updateForSeat(eye);
}

function onPointerMove(e) {
  if (!started || controls.state.seated) return;
  // Skip when pointer locked (desktop walking) — use center ray optionally
  if (document.pointerLockElement === canvas) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(seats, true);
    const seat = hits.length ? findSeatRoot(hits[0].object) : null;
    updateHover(seat);
    return;
  }
  const seat = pickSeat(e.clientX, e.clientY);
  updateHover(seat);
}

function updateHover(seat) {
  if (seat === hoveredSeat) return;
  setSeatHover(hoveredSeat, false);
  hoveredSeat = seat && !seat.userData.occupied ? seat : null;
  setSeatHover(hoveredSeat, true);
  canvas.style.cursor = hoveredSeat ? 'pointer' : '';
}

function onClick(e) {
  if (!started || controls.state.seated) return;
  // Ignore clicks that are meant for UI
  if (e.target.closest('#controls, #seatPrompt, #joystick, #entry')) return;

  let seat = null;
  if (document.pointerLockElement === canvas) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(seats, true);
    seat = hits.length ? findSeatRoot(hits[0].object) : null;
  } else {
    seat = pickSeat(e.clientX, e.clientY);
  }
  if (seat && !seat.userData.occupied) {
    // If close enough, sit directly; else show prompt
    const sp = new THREE.Vector3();
    seat.getWorldPosition(sp);
    const dist = camera.position.distanceTo(sp);
    if (dist < 6.5) {
      sitIn(seat);
    } else {
      showPrompt(seat);
      hint.textContent = '再靠近一点，或点「坐下」直接入座';
    }
  } else {
    hidePrompt();
  }
}

window.addEventListener('pointermove', onPointerMove);
window.addEventListener('click', onClick);

sitBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (pendingSeat) sitIn(pendingSeat);
});

standBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  standUp();
});


enterBtn.addEventListener('click', () => {
  audio.play(); // synchronous in gesture
  entry.classList.add('hidden');
  hud.classList.remove('hidden');
  if (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches) {
    joystick?.classList.remove('hidden');
  }
  started = true;
  setTimeout(() => hint.classList.add('fade'), 4000);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Third-person: own chibi avatar + follow camera =====
const me = makeChibi(presence.look); scene.add(me); me.visible = false;
me.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; } });
const setMeOpacity = (a) => me.traverse((o) => { if (o.material) { o.material.opacity = a; o.material.depthWrite = a > 0.9; } });
const lastTP = new THREE.Vector3(NaN, 0, 0);
const prevEye = eye.clone();
const colliders = [hallRoot];
seatsGroup.children.forEach((c) => { if (!c.userData?.isSeat && c.name !== 'seat') colliders.push(c); });
const tpRay = new THREE.Raycaster();
const _f = new THREE.Vector3(), _head = new THREE.Vector3(), _want = new THREE.Vector3(), _q = new THREE.Quaternion();
let walkPhase = 0, tpDist = 2.4; const tpPos = new THREE.Vector3();
function thirdPerson(dt) {
  if (!started) return;
  me.visible = true;
  const zoom = THREE.MathUtils.clamp(camera.fov / 65, 0.55, 1.3);
  if (currentSeat) {
    me.userData.setPose('sit'); setMeOpacity(0.6); me.scale.setScalar(0.8); // ghosted so it never hides the stage or booklet
    currentSeat.getWorldPosition(me.position);
    currentSeat.getWorldQuaternion(me.quaternion);
    me.userData.legs[0].rotation.x = me.userData.legs[1].rotation.x = 0;
    _head.copy(me.position); _head.y += 1.25;
  } else {
    me.userData.setPose('stand'); setMeOpacity(1); me.scale.setScalar(1);
    const dx = eye.x - prevEye.x, dz = eye.z - prevEye.z, sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    me.position.set(eye.x, eye.y - 1.7, eye.z);
    if (sp > 0.3) {
      let dy = Math.atan2(-dx, -dz) - me.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      me.rotation.set(0, me.rotation.y + dy * Math.min(1, dt * 10), 0);
      walkPhase += dt * 11;
    } else walkPhase = 0;
    const sw = Math.sin(walkPhase) * 0.55 * (sp > 0.3 ? 1 : 0);
    me.userData.legs[0].rotation.x = sw; me.userData.legs[1].rotation.x = -sw;
    me.position.y += Math.abs(Math.sin(walkPhase)) * 0.04;
    _head.set(eye.x, eye.y - 0.35, eye.z);
  }
  prevEye.copy(eye);
  // desired camera: behind & above along view direction
  camera.getWorldDirection(_f);
  const back = (currentSeat ? 1.7 : tpDist) * zoom, up = currentSeat ? 1.05 : 1.1;
  _want.copy(_head).addScaledVector(_f, -back); _want.y += up;
  if (currentSeat) { // over the right shoulder so the head doesn't block the stage
    _want.x += -_f.z * 0.0; _want.z += _f.x * 0.0;
  }
  // pull in on collision
  const dir = _want.clone().sub(_head); const L = dir.length(); dir.normalize();
  tpRay.set(_head, dir); tpRay.far = L;
  const hit = currentSeat ? null : tpRay.intersectObjects(colliders, true)[0];
  if (hit) _want.copy(_head).addScaledVector(dir, Math.max(0.2, hit.distance - 0.2));
  // smooth in a persistent vector (camera.position was reset to eye this frame, so lerping it caused dt-dependent shake)
  if (Number.isNaN(lastTP.x) || tpPos.distanceTo(_want) > 6) tpPos.copy(_want); else tpPos.lerp(_want, 1 - Math.exp(-dt * 10));
  camera.position.copy(tpPos);
  camera.rotation.x -= currentSeat ? 0.3 : 0.2; // look slightly down onto the avatar
  camera.updateMatrixWorld();
  lastTP.copy(camera.position);
}

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // restore logical eye (unless someone else moved the camera, e.g. sitIn/standUp)
  if (!Number.isNaN(lastTP.x) && camera.position.distanceTo(lastTP) < 1e-6) camera.position.copy(eye);
  else lastTP.set(NaN, 0, 0);
  controls.update(dt);
  eye.copy(camera.position);
  const playing = audio.isPlaying();
  for (const fn of animators) fn(t, playing);
  presence.update(t);
  thirdPerson(dt);
  if (typeof checkPortals === 'function' && portals.length) checkPortals(t);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ===== Stairs: glowing portals linking 1F <-> 2F(L区) <-> 3F(L区) =====
const fadeEl = Object.assign(document.createElement('div'), { id: 'fade' });
fadeEl.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:40';
document.body.appendChild(fadeEl);
function levelOf(floor, section) {
  const ref = seats.find((x) => x.userData.floor === floor && x.userData.section === section);
  const b = sectionBounds(ref); let y = 0; const p = new THREE.Vector3(); let n = 0;
  for (const x of seats) if (x.userData.floor === floor && x.userData.section === section) { x.getWorldPosition(p); y += p.y; n++; }
  return { name: floor, bounds: { ...b, minY: y / n + 1.5 }, y: y / n + 1.5 };
}
const LEVELS = [
  { name: '一楼', bounds: FLOOR_BOUNDS, y: 1.7 },
  levelOf('二楼', 'L区'),
  levelOf('三楼', 'L区'),
];
function labelSprite(txt) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(40,24,8,.75)'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#ffd98a'; g.font = 'bold 44px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 50);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(1.1, 0.42, 1); return sp;
}
const portals = [];
function addPortal(from, to, x, z, txt) {
  const L = LEVELS[from], g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  col.position.y = 1.1; const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffd98a, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  const lab = labelSprite(txt); lab.position.y = 2.5; g.add(col, ring, lab);
  g.position.set(x, L.y - 1.7, z); scene.add(g);
  const P = { from, to, pos: new THREE.Vector3(x, 0, z), mesh: g, col }; portals.push(P); return P;
}
// 1F: back-left corner; balcony levels: their two ends
{
  const b1 = LEVELS[1].bounds, b2 = LEVELS[2].bounds, cx1 = (b1.minX + b1.maxX) / 2, cx2 = (b2.minX + b2.maxX) / 2;
  addPortal(0, 1, -12.5, 17.5, '上二楼 ↑');
  addPortal(1, 0, cx1, b1.maxZ - 0.3, '下一楼 ↓');
  addPortal(1, 2, cx1, b1.minZ + 0.3, '上三楼 ↑');
  addPortal(2, 1, cx2, b2.maxZ - 0.3, '下二楼 ↓');
}
let curLevel = 0, portalArmed = true, transiting = false;
function setLevel(i) { curLevel = i; Object.assign(WALK, LEVELS[i].bounds); }
function goPortal(P) {
  transiting = true; fadeEl.style.opacity = '1';
  setTimeout(() => {
    const back = portals.find((q) => q.from === P.to && q.to === P.from);
    setLevel(P.to);
    const B = LEVELS[P.to].bounds, c = new THREE.Vector3((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
    const d = c.clone().sub(back.pos); d.y = 0; d.normalize();
    const e = back.pos.clone().addScaledVector(d, 2.0); e.y = LEVELS[P.to].y;
    e.x = THREE.MathUtils.clamp(e.x, B.minX, B.maxX); e.z = THREE.MathUtils.clamp(e.z, B.minZ, B.maxZ);
    camera.position.copy(e); controls.lookAt(e, new THREE.Vector3(STAGE_FOCUS.x, e.y - 0.6, STAGE_FOCUS.z)); camera.position.copy(e);
    audio.updateForSeat(e); portalArmed = false;
    fadeEl.style.opacity = '0'; setTimeout(() => { transiting = false; }, 1500);
  }, 380);
}
function checkPortals(t) {
  for (const P of portals) P.col.material.opacity = 0.28 + 0.12 * Math.sin(t * 3);
  if (currentSeat || transiting) return;
  let inside = false;
  for (const P of portals) {
    if (P.from !== curLevel) continue;
    if (Math.hypot(eye.x - P.pos.x, eye.z - P.pos.z) < 0.7) { inside = true; if (portalArmed) { goPortal(P); return; } }
  }
  if (!inside) portalArmed = true;
}
tick();

// Expose for debugging / screenshot automation
window.__hall = { portals, getLevel: () => curLevel, me, getEye: () => eye, programme, scene, camera, renderer, seats, presence, sitIn, standUp, audio, controls };

// ===== Pinch / wheel zoom: adjusts field of view only (35°–85°, smoothed) =====
let fovTarget = camera.fov;
const setFov = (f) => { fovTarget = THREE.MathUtils.clamp(f, 35, 85); };
let pinch0 = 0, fov0 = 0;
const tdist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { pinch0 = tdist(e.touches); fov0 = fovTarget; } }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (e.touches.length === 2 && pinch0) setFov(fov0 * pinch0 / tdist(e.touches)); }, { passive: true });
canvas.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch0 = 0; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); setFov(fovTarget + e.deltaY * 0.04); }, { passive: false });
(function zoomLoop() {
  if (Math.abs(camera.fov - fovTarget) > 0.05) { camera.fov += (fovTarget - camera.fov) * 0.18; camera.updateProjectionMatrix(); }
  requestAnimationFrame(zoomLoop);
})();
window.__hall.setFov = setFov;
