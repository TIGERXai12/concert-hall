import * as THREE from 'three';
import { buildHall, addCurtains } from './hall.js?v=7';
import { buildOrchestra } from './orchestra.js?v=7';
import { buildSeats, setSeatHover, setSeatOccupied, getSeatCameraPose } from './seats.js?v=7';
import { createPresence } from './presence.js?v=7';
import { createPlayer } from './player.js?v=7';
import { createControls } from './controls.js?v=7';

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

buildHall(scene);
addCurtains(scene);
const { animators } = buildOrchestra(scene);
const { seats } = buildSeats(scene);

const controls = createControls(camera, canvas, {
  speed: 4.8,
  bounds: { minX: -14, maxX: 14, minZ: -9.5, maxZ: 19.5, minY: 1.7 },
});

// ===== 曲目单（由主人决定，观众只听）：按顺序播放，播完循环。改这里即可 =====
const TRACKS = [
  { title: '拉赫玛尼诺夫《第二钢琴协奏曲》第一乐章', url: 'assets/audio/rachmaninoff-pc2-i.mp3', duration: 300.024 },
  { title: '肖邦《降E大调夜曲》Op.9 No.2', url: 'assets/audio/chopin-nocturne-op9-2.mp3', duration: 271.517 },
  { title: '柴可夫斯基《第一钢琴协奏曲》第一乐章', url: 'assets/audio/tchaikovsky-pc1-i.mp3', duration: 300.042 },
  { title: '德彪西《月光》', url: 'assets/audio/debussy-clair-de-lune.mp3', duration: 304.118 },
  { title: '贝多芬《第五交响曲·命运》第一乐章', url: 'assets/audio/beethoven-sym5-i.mp3', duration: 300.024 },
  { title: '肖邦《革命练习曲》Op.10 No.12', url: 'assets/audio/chopin-etude-revolutionary.mp3', duration: 164.833 },
  { title: '德沃夏克《第九交响曲·自新大陆》第四乐章', url: 'assets/audio/dvorak-sym9-iv.mp3', duration: 300.024 },
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
    const p = camera.position;
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
  hint.textContent = '正在聆听 · 点击「起身换座」可换位置';
  audio.updateForSeat(eye);
}

function standUp() {
  if (!currentSeat) return;
  const pos = new THREE.Vector3();
  currentSeat.getWorldPosition(pos);
  const floorName = currentSeat.userData.floor || '';
  const seatYaw = currentSeat.rotation.y;
  let eyeY = 1.7;
  if (floorName.startsWith('二楼')) eyeY = Math.max(pos.y + 1.2, 6.5);
  else if (floorName.startsWith('三楼')) eyeY = Math.max(pos.y + 1.2, 11.2);
  else eyeY = Math.max(pos.y + 1.25, 1.7);
  setSeatOccupied(currentSeat, false);
  currentSeat = null;
  controls.setSeated(false);
  const forward = new THREE.Vector3(Math.sin(seatYaw), 0, Math.cos(seatYaw));
  camera.position.copy(pos).addScaledVector(forward, 0.9);
  camera.position.y = eyeY;
  seatLabel.classList.add('hidden');
  standBtn.classList.add('hidden');
  hint.textContent = '走近空座位并点击，即可入座';
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
    if (dist < 4.0) {
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

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  controls.update(dt);
  const playing = audio.isPlaying();
  for (const fn of animators) fn(t, playing);
  presence.update(t);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Expose for debugging / screenshot automation
window.__hall = { scene, camera, renderer, seats, presence, sitIn, standUp, audio, controls };
