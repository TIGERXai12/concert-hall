import * as THREE from 'three';
// Chibi (Q版) avatars for real online visitors only.
export const SHIRTS = [0xe85d75, 0x4f8fe8, 0xf2b84b, 0x5cc08a, 0x9b6fe0, 0xf08a4b, 0x3cc6c6, 0xffffff, 0x2d2d3a, 0xd94f4f];
export const HAIRS = [0x2b1d14, 0x1a1a1a, 0x5a3a22, 0x8a5a2b, 0xd9b26a, 0x7a2e2e, 0x3a3a55];
export const SKINS = [0xffe0c7, 0xf7d0b0, 0xeec29c, 0xffd9bd];
export function randomLook() {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  return { shirt: pick(SHIRTS), hair: pick(HAIRS), skin: pick(SKINS), bun: Math.random() < 0.3 };
}
const G = {
  body: new THREE.CylinderGeometry(0.15, 0.2, 0.38, 10),
  lap: new THREE.BoxGeometry(0.3, 0.12, 0.3),
  leg: new THREE.BoxGeometry(0.11, 0.42, 0.13),
  head: new THREE.SphereGeometry(0.24, 14, 10),
  hair: new THREE.SphereGeometry(0.255, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  eye: new THREE.SphereGeometry(0.035, 6, 5),
  blush: new THREE.SphereGeometry(0.03, 6, 4),
  bun: new THREE.SphereGeometry(0.09, 8, 6),
};
const std = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const M = { pants: std(0x33334a), eye: std(0x151515, 0.3), blush: std(0xff9aa8) };

/** Returns Group; local -Z is facing. setPose('sit'|'stand'). Seat origin = cushion base. */
export function makeChibi(look) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
  };
  const upper = new THREE.Group(); g.add(upper);
  const addU = (...a) => { const m = add(...a); upper.add(m); return m; };
  addU(G.body, std(look.shirt), 0, 0.64, 0.04);
  addU(G.head, std(look.skin, 0.6), 0, 1.04, 0.02);
  addU(G.hair, std(look.hair), 0, 1.06, 0.06);
  addU(G.eye, M.eye, -0.08, 1.04, -0.205, 1, 1.3, 1);
  addU(G.eye, M.eye, 0.08, 1.04, -0.205, 1, 1.3, 1);
  addU(G.blush, M.blush, -0.14, 0.98, -0.17, 1.3, 0.7, 0.7);
  addU(G.blush, M.blush, 0.14, 0.98, -0.17, 1.3, 0.7, 0.7);
  if (look.bun) addU(G.bun, std(look.hair), 0, 1.3, 0.1);
  const lap = add(G.lap, M.pants, 0, 0.5, -0.12);
  const legL = add(G.leg, M.pants, -0.08, 0.21, 0.04);
  const legR = add(G.leg, M.pants, 0.08, 0.21, 0.04);
  g.userData.setPose = (pose) => {
    const sit = pose === 'sit';
    lap.visible = sit; legL.visible = legR.visible = !sit;
    upper.position.y = sit ? 0 : -0.03;
  };
  g.userData.upper = upper;
  g.userData.legs = [legL, legR];
  g.userData.setPose('stand');
  return g;
}
