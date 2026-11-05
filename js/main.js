import * as THREE from 'three';
import { buildHall, addCurtains } from './hall.js?v=13';
import { buildOrchestra } from './orchestra.js?v=13';
import { buildSeats, setSeatHover, setSeatOccupied, getSeatCameraPose, STAGE_FOCUS } from './seats.js?v=13';
import { createPresence } from './presence.js?v=13';
import { makeChibi } from './audience.js?v=13';
import { createPlayer } from './player.js?v=13';
import { createProgramme } from './programme.js?v=13';
import { createControls } from './controls.js?v=13';

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

const controls = createControls(camera, canvas, {
  speed: 4.8,
  bounds: { minX: -14, maxX: 14, minZ: -9.5, maxZ: 19.5, minY: 1.7 },
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
  const v = document.pointerLockElement ? new THREE.Vector2(0, 0)
    : new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(v, camera);
  const hit = raycaster.intersectObjects(programme.tapTargets, false);
  if (hit.length && hit[0].distance < 3) { e.stopImmediatePropagation(); e.preventDefault(); programme.open(); }
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
    // Stand right where the seat is (main floor), one step toward the aisle side
    eye = new THREE.Vector3(pos.x, Math.max(pos.y + 1.6, 1.7), pos.z);
  } else {
    // Balconies / choir: return to a main-floor aisle spot facing the stage
    eye = new THREE.Vector3(STAGE_FOCUS.x, 1.7, 11);
  }
  eye.x = THREE.MathUtils.clamp(eye.x, -13.5, 13.5);
  eye.z = THREE.MathUtils.clamp(eye.z, -9, 19);
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
  if (window.matchMedia('(pointer: coarse)').matches) {
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
let walkPhase = 0, tpDist = 2.4;
function thirdPerson(dt) {
  if (!started) return;
  me.visible = true;
  const zoom = THREE.MathUtils.clamp(camera.fov / 65, 0.55, 1.3);
  if (currentSeat) {
    me.userData.setPose('sit'); setMeOpacity(0.35); // ghosted so it never hides the stage or booklet
    currentSeat.getWorldPosition(me.position);
    currentSeat.getWorldQuaternion(me.quaternion);
    me.userData.legs[0].rotation.x = me.userData.legs[1].rotation.x = 0;
    _head.copy(me.position); _head.y += 1.25;
  } else {
    me.userData.setPose('stand'); setMeOpacity(1);
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
  const back = (currentSeat ? 0.55 : tpDist) * zoom, up = currentSeat ? 0.4 : 1.1;
  _want.copy(_head).addScaledVector(_f, -back); _want.y += up;
  if (currentSeat) { // over the right shoulder so the head doesn't block the stage
    _want.x += -_f.z * 0.12; _want.z += _f.x * 0.12;
  }
  // pull in on collision
  const dir = _want.clone().sub(_head); const L = dir.length(); dir.normalize();
  tpRay.set(_head, dir); tpRay.far = L;
  const hit = tpRay.intersectObjects(colliders, true)[0];
  if (hit) _want.copy(_head).addScaledVector(dir, Math.max(0.2, hit.distance - 0.2));
  if (Number.isNaN(lastTP.x)) camera.position.copy(_want); else camera.position.lerp(_want, Math.min(1, dt * 12));
  camera.rotation.x -= currentSeat ? 0.25 : 0.2; // look slightly down onto the avatar
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
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
;

// Expose for debugging / screenshot automation
window.__hall = { me, getEye: () => eye, programme, scene, camera, renderer, seats, presence, sitIn, standUp, audio, controls };

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
