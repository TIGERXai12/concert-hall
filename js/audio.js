import * as THREE from 'three';

/**
 * Positional audio system.
 * Placeholder track: assets/audio/placeholder.mp3 (swap later).
 * Multiple PositionalAudio sources at orchestra sections for L/R feel.
 */
export function createAudioSystem(camera, listenerParent) {
  const listener = new THREE.AudioListener();
  listenerParent.add(listener);

  const audioLoader = new THREE.AudioLoader();
  const sources = [];
  let buffer = null;
  let playing = false;
  let unlocked = false;

  // Section positions in world space (approx, matching orchestra layout on stage)
  const sectionPositions = [
    { name: 'stringsL', pos: [-5, 2.4, 1.2], vol: 0.5 },
    { name: 'stringsR', pos: [3.8, 2.4, 1.2], vol: 0.5 },
    { name: 'winds', pos: [0, 2.6, -1.5], vol: 0.4 },
    { name: 'brass', pos: [0, 2.7, -3.0], vol: 0.35 },
    { name: 'perc', pos: [-6.5, 2.7, -2.8], vol: 0.3 },
    // Solo piano — front apron, audience-right of conductor (world ≈ orchestra offset + local)
    { name: 'piano', pos: [0.1, 2.3, 2.25], vol: 0.7 },
  ];

  function ensureSources() {
    if (sources.length) return;
    for (const s of sectionPositions) {
      const mesh = new THREE.Object3D();
      mesh.position.set(...s.pos);
      listenerParent.parent
        ? listenerParent.parent.add(mesh)
        : listenerParent.add(mesh);
      // Attach to scene via camera's parent (scene). We'll add to scene in init.
      const pa = new THREE.PositionalAudio(listener);
      pa.setRefDistance(6);
      pa.setRolloffFactor(1.1);
      pa.setDistanceModel('inverse');
      pa.setVolume(s.vol);
      pa.setLoop(true);
      mesh.add(pa);
      sources.push({ mesh, pa, vol: s.vol, name: s.name });
    }
  }

  async function load(url = 'assets/audio/placeholder.mp3') {
    ensureSources();
    buffer = await new Promise((resolve, reject) => {
      audioLoader.load(url, resolve, undefined, reject);
    });
    const wasPlaying = playing;
    for (const s of sources) {
      if (s.pa.isPlaying) s.pa.stop();
      s.pa.setBuffer(buffer);
    }
    if (wasPlaying) { for (const s of sources) s.pa.play(); }
    return buffer;
  }

  function attachToScene(scene) {
    ensureSources();
    for (const s of sources) {
      if (!s.mesh.parent) scene.add(s.mesh);
    }
  }

  async function unlock() {
    // Resume AudioContext on user gesture
    const ctx = listener.context;
    if (ctx.state === 'suspended') await ctx.resume();
    unlocked = true;
  }

  async function play() {
    if (!buffer) await load();
    await unlock();
    for (const s of sources) {
      if (!s.pa.isPlaying) s.pa.play();
      s.pa.setVolume(s.vol);
    }
    playing = true;
    return true;
  }

  function pause() {
    for (const s of sources) {
      if (s.pa.isPlaying) s.pa.pause();
    }
    playing = false;
  }

  function toggle() {
    return playing ? (pause(), false) : play();
  }

  function isPlaying() {
    return playing;
  }

  /** Call when user sits – slight volume nudge based on distance to stage. */
  function updateForSeat(worldPos) {
    if (!worldPos) return;
    const stage = new THREE.Vector3(0, 2.2, -1);
    const dist = worldPos.distanceTo(stage);
    const proximity = THREE.MathUtils.clamp(1.3 - dist / 28, 0.45, 1.15);
    for (const s of sources) {
      s.pa.setVolume(s.vol * proximity);
    }
  }

  return {
    load,
    attachToScene,
    unlock,
    play,
    pause,
    toggle,
    isPlaying,
    updateForSeat,
    listener,
    sources,
  };
}
