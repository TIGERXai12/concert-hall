import * as THREE from 'three';
// Chibi (Q版) audience, instanced for performance. Figures face seat local -Z.
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const SHIRTS = [0xe85d75, 0x4f8fe8, 0xf2b84b, 0x5cc08a, 0x9b6fe0, 0xf08a4b, 0x3cc6c6, 0xffffff, 0x2d2d3a, 0xd94f4f];
const HAIRS = [0x2b1d14, 0x1a1a1a, 0x5a3a22, 0x8a5a2b, 0xd9b26a, 0x7a2e2e, 0x3a3a55];
const SKINS = [0xffe0c7, 0xf7d0b0, 0xeec29c, 0xffd9bd];

export function buildAudience(scene, seats, fill = 0.68) {
  scene.updateMatrixWorld(true);
  const r = rng(20261105);
  const people = [];
  for (const s of seats) {
    if (r() < fill) people.push({ seat: s, phase: r() * 6.28, shirt: SHIRTS[(r() * SHIRTS.length) | 0], hair: HAIRS[(r() * HAIRS.length) | 0], skin: SKINS[(r() * SKINS.length) | 0], bun: r() < 0.3 });
  }
  const n = people.length;
  const M = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...o });
  // parts: geometry, material, local matrix, color key
  const parts = [
    { g: new THREE.CylinderGeometry(0.15, 0.2, 0.38, 10), m: std(), l: M(0, 0.64, 0.04), c: 'shirt' },          // body
    { g: new THREE.BoxGeometry(0.3, 0.12, 0.3), m: std({ color: 0x33334a }), l: M(0, 0.5, -0.12) },             // lap/legs
    { g: new THREE.SphereGeometry(0.24, 14, 10), m: std({ roughness: 0.6 }), l: M(0, 1.04, 0.02), c: 'skin' },    // head
    { g: new THREE.SphereGeometry(0.255, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m: std(), l: M(0, 1.06, 0.06), c: 'hair' }, // hair cap
    { g: new THREE.SphereGeometry(0.035, 6, 5), m: std({ color: 0x151515, roughness: 0.3 }), l: M(-0.08, 1.04, -0.205, 1, 1.3, 1) }, // eye L
    { g: new THREE.SphereGeometry(0.035, 6, 5), m: std({ color: 0x151515, roughness: 0.3 }), l: M(0.08, 1.04, -0.205, 1, 1.3, 1) },  // eye R
    { g: new THREE.SphereGeometry(0.03, 6, 4), m: std({ color: 0xff9aa8 }), l: M(-0.14, 0.98, -0.17, 1.3, 0.7, 0.7) }, // blush
    { g: new THREE.SphereGeometry(0.03, 6, 4), m: std({ color: 0xff9aa8 }), l: M(0.14, 0.98, -0.17, 1.3, 0.7, 0.7) },
    { g: new THREE.SphereGeometry(0.09, 8, 6), m: std(), l: M(0, 1.3, 0.1), c: 'hair', only: 'bun' },        // hair bun
  ];
  const meshes = parts.map((p) => {
    const im = new THREE.InstancedMesh(p.g, p.m, n);
    im.frustumCulled = false;
    if (p.c) for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color(people[i][p.c]));
    scene.add(im);
    return im;
  });
  const hidden = new Set();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const base = new THREE.Matrix4(), sway = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  function update(t, playing) {
    const amp = playing ? 0.06 : 0.025;
    for (let i = 0; i < n; i++) {
      const p = people[i];
      const off = hidden.has(p.seat);
      sway.makeRotationZ(Math.sin(t * (playing ? 2.2 : 0.8) + p.phase) * amp);
      base.multiplyMatrices(p.seat.matrixWorld, sway);
      parts.forEach((part, k) => {
        if (off || (part.only === 'bun' && !p.bun)) meshes[k].setMatrixAt(i, zero);
        else meshes[k].setMatrixAt(i, tmp.multiplyMatrices(base, part.l));
      });
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }
  update(0, false);
  return {
    count: n,
    update,
    setSeatFree(seat, free) { free ? hidden.add(seat) : hidden.delete(seat); },
  };
}
