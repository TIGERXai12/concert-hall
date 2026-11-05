import * as THREE from 'three';

/**
 * First-person walk controls: WASD/arrows + pointer lock mouse look,
 * plus on-screen joystick + touch look for phones.
 */
export function createControls(camera, domElement, options = {}) {
  const speed = options.speed ?? 4.5;
  const bounds = options.bounds ?? { minX: -12, maxX: 12, minZ: -5.5, maxZ: 16, minY: 1.6 };

  const state = {
    enabled: true,
    seated: false,
    yaw: 0,
    pitch: -0.12,
    keys: Object.create(null),
    joy: { x: 0, y: 0 },
    looking: false,
    lastTouch: null,
  };

  camera.rotation.order = 'YXZ';

  function onKey(e, down) {
    state.keys[e.code] = down;
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  // Pointer lock look (desktop)
  domElement.addEventListener('click', () => {
    if (!state.enabled || state.seated) return;
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) return; // no pointer lock on touch
    if (document.pointerLockElement !== domElement) {
      domElement.requestPointerLock?.();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (state.seated || !state.enabled) return;
    if (document.pointerLockElement === domElement) {
      state.yaw -= e.movementX * 0.0022;
      state.pitch -= e.movementY * 0.0022;
      state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
    }
  });

  // Touch look: right half of screen
  let lookId = null;
  let lookLast = null;
  domElement.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.45 && lookId === null) {
        lookId = t.identifier;
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: true });
  domElement.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId && lookLast) {
        const dx = t.clientX - lookLast.x;
        const dy = t.clientY - lookLast.y;
        state.yaw -= dx * 0.005;
        state.pitch -= dy * 0.005;
        state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: true });
  const endLook = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) {
        lookId = null;
        lookLast = null;
      }
    }
  };
  domElement.addEventListener('touchend', endLook);
  domElement.addEventListener('touchcancel', endLook);

  // Virtual joystick
  const joyBase = document.getElementById('joyBase');
  const joyKnob = document.getElementById('joyKnob');
  const joystick = document.getElementById('joystick');
  if (joyBase && joyKnob) {
    let joyTouch = null;
    const maxR = 40;
    const setKnob = (x, y) => {
      joyKnob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const resetJoy = () => {
      state.joy.x = 0;
      state.joy.y = 0;
      setKnob(0, 0);
      joyTouch = null;
    };
    joyBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyTouch = t.identifier;
      moveJoy(t);
    }, { passive: false });
    joyBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouch) moveJoy(t);
      }
    }, { passive: false });
    joyBase.addEventListener('touchend', resetJoy);
    joyBase.addEventListener('touchcancel', resetJoy);

    function moveJoy(t) {
      const rect = joyBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      setKnob(dx, dy);
      state.joy.x = dx / maxR;
      state.joy.y = dy / maxR;
    }

    // Show joystick on coarse pointers
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches) {
      joystick?.classList.remove('hidden');
    }
  }

  function setSeated(seated) {
    state.seated = seated;
    if (seated && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  function lookAt(eye, target) {
    camera.position.copy(eye);
    const dir = new THREE.Vector3().subVectors(target, eye).normalize();
    state.yaw = Math.atan2(-dir.x, -dir.z);
    state.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();

  function update(dt) {
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;

    if (!state.enabled || state.seated) return;

    let mx = 0;
    let mz = 0;
    if (state.keys['KeyW'] || state.keys['ArrowUp']) mz -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) mz += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) mx -= 1;
    if (state.keys['KeyD'] || state.keys['ArrowRight']) mx += 1;
    mx += state.joy.x;
    mz += state.joy.y;

    if (mx === 0 && mz === 0) return;

    forward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    wish.set(0, 0, 0);
    wish.addScaledVector(forward, -mz);
    wish.addScaledVector(right, mx);
    if (wish.lengthSq() > 1) wish.normalize();

    camera.position.addScaledVector(wish, speed * dt);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.minX, bounds.maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.minZ, bounds.maxZ);
    // Stay on current deck: never fall below main floor eye height
    if (camera.position.y < bounds.minY) camera.position.y = bounds.minY;
  }

  return {
    state,
    update,
    setSeated,
    lookAt,
    setEnabled: (v) => { state.enabled = v; },
  };
}
