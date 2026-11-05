import * as THREE from 'three';

const SKIN = 0xe8c4a8;
const BLACK = 0x1a1a1a;
const WOOD = 0x8b5a2b;
const BRASS = 0xc9a227;
const SILVER = 0xc0c8d0;

/**
 * Build a low-poly full orchestra on the stage.
 * Returns { group, animators } where animators are per-frame update fns.
 */
export function buildOrchestra(scene) {
  const group = new THREE.Group();
  group.name = 'orchestra';
  group.position.set(0, 1.05, -1); // sit on Bucheon-style stage

  const animators = [];

  // Section layouts (local stage coords: +z toward audience, -z toward back wall)
  // Classic: strings front, winds mid, brass back, percussion rear-left
  // Piano concerto: clear apron for grand; strings parted; keep clear of piano AABB
  const sections = [
    // Violins I — house-left (stage right)
    { name: 'violins1', kind: 'string', count: 10, origin: [-6.4, 0, 2.2], cols: 5, spacing: [1.0, 1.05], facing: 0.2 },
    // Violins II — house-right (stage left), clear of piano tail
    { name: 'violins2', kind: 'string', count: 8, origin: [3.2, 0, 2.0], cols: 4, spacing: [1.0, 1.05], facing: -0.2 },
    // Violas
    { name: 'violas', kind: 'string', count: 6, origin: [-5.2, 0, 0.5], cols: 3, spacing: [1.05, 1.05], facing: 0.12 },
    // Cellos
    { name: 'cellos', kind: 'cello', count: 6, origin: [3.0, 0, 0.4], cols: 3, spacing: [1.1, 1.1], facing: -0.12 },
    // Basses
    { name: 'basses', kind: 'bass', count: 4, origin: [5.6, 0, -0.5], cols: 2, spacing: [1.15, 1.25], facing: -0.35 },
    // Woodwinds — further upstage, clear of conductor
    { name: 'woodwinds', kind: 'woodwind', count: 8, origin: [-2.8, 0, -1.4], cols: 4, spacing: [1.0, 1.0], facing: 0 },
    // Brass
    { name: 'brass', kind: 'brass', count: 8, origin: [-2.5, 0, -2.8], cols: 4, spacing: [1.05, 1.05], facing: 0 },
    // Percussion
    { name: 'percussion', kind: 'percussion', count: 3, origin: [-7.2, 0, -2.4], cols: 3, spacing: [1.3, 1.2], facing: 0.4 },
  ];

  for (const sec of sections) {
    let placed = 0;
    for (let r = 0; placed < sec.count; r++) {
      for (let c = 0; c < sec.cols && placed < sec.count; c++, placed++) {
        const x = sec.origin[0] + c * sec.spacing[0];
        const z = sec.origin[2] - r * sec.spacing[1];
        const m = makeMusician(sec.kind, sec.facing + (Math.random() - 0.5) * 0.15);
        m.position.set(x, 0, z);
        m.userData.section = sec.name;
        group.add(m);
        animators.push(makeAnimator(m, sec.kind, placed));
      }
    }
  }

  // Concert grand first — podium sits UPSTAGE of its curve
  const { pianoGroup, soloistAnimator, pianoWorldHint } = makeConcertGrandAndSoloist();
  group.add(pianoGroup);
  animators.push(soloistAnimator);
  group.userData.pianoWorldHint = pianoWorldHint;

  // Single podium + conductor UPSTAGE behind piano tail/curve (not between piano & audience)
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.35, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.7 })
  );
  podium.name = 'conductorPodium';
  podium.position.set(0.85, 0.175, 1.55); // UPSTAGE just behind piano tail/curve
  group.add(podium);

  const conductor = makeConductor();
  conductor.name = 'conductor';
  conductor.position.set(0.85, 0.35, 1.55); // ON the podium
  conductor.rotation.y = Math.PI; // face orchestra / soloist direction (toward -Z / upstage into band)
  // Nudge yaw slightly toward soloist (keyboard at house-left)
  conductor.rotation.y = Math.PI + 0.15; // face orchestra, glance toward soloist
  group.add(conductor);
  animators.push(makeConductorAnimator(conductor));

  // Music stands — keep clear of piano apron
  for (const x of [-4.6, -3.0, 3.4, 5.0]) {
    const stand = makeMusicStand();
    stand.position.set(x, 0, 1.4);
    group.add(stand);
  }

  scene.add(group);
  return { group, animators, sections };
}

// ---------- Chibi (Q版) performers: shared geometry/materials, cheap per-figure ----------
const PG = {
  head: new THREE.SphereGeometry(0.25, 14, 10),
  hair: new THREE.SphereGeometry(0.265, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  bun: new THREE.SphereGeometry(0.09, 8, 6),
  eye: new THREE.SphereGeometry(0.034, 6, 5),
  blush: new THREE.SphereGeometry(0.03, 6, 4),
  coat: new THREE.CylinderGeometry(0.15, 0.21, 0.4, 12),
  dress: new THREE.CylinderGeometry(0.14, 0.3, 0.55, 12),
  shirt: new THREE.BoxGeometry(0.11, 0.2, 0.03),
  bow: new THREE.BoxGeometry(0.1, 0.035, 0.03),
  tail: new THREE.BoxGeometry(0.2, 0.22, 0.03),
  arm: new THREE.CylinderGeometry(0.045, 0.05, 0.26, 8),
  hand: new THREE.SphereGeometry(0.05, 8, 6),
  lap: new THREE.BoxGeometry(0.11, 0.1, 0.26),
  shin: new THREE.BoxGeometry(0.1, 0.3, 0.11),
  shoe: new THREE.BoxGeometry(0.1, 0.06, 0.16),
  ell: new THREE.SphereGeometry(1, 14, 10),
  stick: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.CylinderGeometry(1, 0.25, 1, 14, 1, true),
  bowl: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  chairSeat: new THREE.BoxGeometry(0.45, 0.06, 0.4),
  chairLeg: new THREE.BoxGeometry(0.035, 0.42, 0.035),
};
const pm = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const PM = {
  black: pm(0x16161c, 0.6), white: pm(0xf6f6f2, 0.6), eye: pm(0x151515, 0.3), blush: pm(0xff9aa8),
  wood: pm(0xa8622c, 0.45, 0.05), dark: pm(0x3a2010, 0.6), brass: pm(0xe0b63e, 0.3, 0.8),
  silver: pm(0xd6dce2, 0.3, 0.7), copper: pm(0xc07040, 0.35, 0.6), skinHead: pm(0xf3e6cf, 0.6),
  bowHair: pm(0xf3ead8, 0.6), chair: pm(0x222222, 0.85),
  skins: [0xffe0c7, 0xf7d0b0, 0xeec29c, 0xffd9bd].map((c) => pm(c, 0.6)),
  hairs: [0x2b1d14, 0x1a1a1a, 0x5a3a22, 0x8a5a2b, 0x9a9a9a, 0x3a2a20].map((c) => pm(c, 0.7)),
};
const pick = (a) => a[(Math.random() * a.length) | 0];
function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (parent) parent.add(m); return m;
}

/** Chibi in concert black. Faces +Z. Returns {g, torso, head, lArm, rArm, lHand, rHand}. seatY = seat top. */
function makeChibiPerformer({ sitting = true, seatY = 0.48, female = Math.random() < 0.45 } = {}) {
  const g = new THREE.Group();
  const skin = pick(PM.skins), hairM = pick(PM.hairs);
  const hip = sitting ? seatY : 0.62;
  // legs
  for (const sx of [-0.07, 0.07]) {
    if (sitting) {
      mesh(PG.lap, PM.black, sx, hip + 0.05, 0.1, 1, 1, 1, g);
      mesh(PG.shin, PM.black, sx, hip - 0.15, 0.2, 1, 1, 1, g).scale.y = (hip) / 0.33;
      g.children[g.children.length - 1].position.y = hip / 2;
      mesh(PG.shoe, PM.black, sx, 0.03, 0.24, 1, 1, 1, g);
    } else {
      mesh(PG.shin, PM.black, sx, hip / 2, 0, 1, hip / 0.3, 1, g);
      mesh(PG.shoe, PM.black, sx, 0.03, 0.03, 1, 1, 1, g);
    }
  }
  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.y = hip; g.add(torso);
  if (female) {
    mesh(PG.dress, PM.black, 0, 0.22, 0, 1, 1, 1, torso).castShadow = true;
  } else {
    mesh(PG.coat, PM.black, 0, 0.22, 0, 1, 1, 1, torso).castShadow = true;
    mesh(PG.shirt, PM.white, 0, 0.3, 0.16, 1, 1, 1, torso).rotation.x = -0.12;
    mesh(PG.bow, PM.black, 0, 0.39, 0.165, 1, 1, 1, torso);
    mesh(PG.tail, PM.black, 0, 0.0, -0.19, 1, 1, 1, torso).rotation.x = 0.25; // tailcoat tails
  }
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 0.66; torso.add(head);
  mesh(PG.head, skin, 0, 0, 0, 1, 1, 1, head).castShadow = true;
  mesh(PG.hair, hairM, 0, 0.02, -0.04, 1, 1, 1, head);
  if (female) mesh(PG.bun, hairM, 0, 0.12, -0.24, 1, 1, 1, head);
  for (const sx of [-1, 1]) {
    mesh(PG.eye, PM.eye, 0.085 * sx, 0, 0.215, 1, 1.3, 1, head);
    mesh(PG.blush, PM.blush, 0.145 * sx, -0.06, 0.18, 1.3, 0.7, 0.7, head);
  }
  const arm = (side) => {
    const piv = new THREE.Group(); piv.position.set(0.19 * side, 0.36, 0.02); torso.add(piv);
    mesh(PG.arm, female ? skin : PM.black, 0, -0.13, 0, 1, 1, 1, piv);
    if (!female) mesh(PG.hand, PM.white, 0, -0.25, 0, 1.05, 0.5, 1.05, piv); // cuff
    const hand = mesh(PG.hand, skin, 0, -0.29, 0, 1, 1, 1, piv);
    return [piv, hand];
  };
  const [lArm, lHand] = arm(-1); const [rArm, rHand] = arm(1);
  lArm.name = 'lArm'; rArm.name = 'rArm';
  return { g, torso, head, lArm, rArm, lHand, rHand };
}

function makeChair(g) {
  mesh(PG.chairSeat, PM.chair, 0, 0.45, -0.02, 1, 1, 1, g);
  for (const [x, z] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.13], [0.18, 0.13]]) mesh(PG.chairLeg, PM.chair, x, 0.21, z, 1, 1, 1, g);
}

const stick = (mat, len, r, parent) => mesh(PG.stick, mat, 0, 0, 0, r, len, r, parent);

function makeMusician(kind, yaw = 0) {
  const outer = new THREE.Group(); outer.rotation.y = yaw;
  const sit = kind !== 'bass';
  if (sit) makeChair(outer);
  const P = makeChibiPerformer({ sitting: sit });
  outer.add(P.g);
  const T = P.torso; const rig = { ...P, kind };
  if (kind === 'string') { // violin / viola under the chin, bow in right hand
    const v = new THREE.Group(); v.position.set(-0.13, 0.5, 0.22); v.rotation.set(0.15, 0.9, 0.25); T.add(v);
    mesh(PG.ell, PM.wood, 0, 0, 0, 0.09, 0.03, 0.13, v); mesh(PG.ell, PM.wood, 0, 0, 0.1, 0.075, 0.03, 0.08, v);
    stick(PM.dark, 0.25, 0.012, v).rotation.x = Math.PI / 2; v.children[2].position.set(0, 0.02, -0.2);
    P.lArm.rotation.set(-1.3, 0, -0.5);
    const bow = stick(PM.dark, 0.55, 0.006, P.rHand); bow.rotation.z = Math.PI / 2; bow.position.x = -0.18;
    rig.base = { r: [-1.1, 0, 0.5] };
  } else if (kind === 'cello') {
    const c = new THREE.Group(); c.position.set(0, 0.48, 0.32); c.rotation.x = -0.15; outer.add(c);
    mesh(PG.ell, PM.wood, 0, 0, 0, 0.17, 0.25, 0.08, c); mesh(PG.ell, PM.wood, 0, 0.2, 0, 0.13, 0.13, 0.07, c);
    const nk = stick(PM.dark, 0.45, 0.018, c); nk.position.y = 0.48;
    const pin = stick(PM.silver, 0.25, 0.008, c); pin.position.y = -0.33;
    P.lArm.rotation.set(-0.9, 0, -0.2);
    const bow = stick(PM.dark, 0.6, 0.006, P.rHand); bow.rotation.z = Math.PI / 2 - 0.1; bow.position.x = -0.22;
    rig.base = { r: [-0.6, 0, 0.35] };
  } else if (kind === 'bass') {
    const c = new THREE.Group(); c.position.set(-0.05, 0.55, 0.32); c.rotation.set(-0.1, 0, 0.12); outer.add(c);
    mesh(PG.ell, PM.wood, 0, 0, 0, 0.24, 0.36, 0.11, c); mesh(PG.ell, PM.wood, 0, 0.3, 0, 0.18, 0.2, 0.1, c);
    const nk = stick(PM.dark, 0.6, 0.022, c); nk.position.y = 0.72;
    P.lArm.rotation.set(-1.3, 0, -0.1);
    const bow = stick(PM.dark, 0.55, 0.007, P.rHand); bow.rotation.z = Math.PI / 2 - 0.2; bow.position.x = -0.2;
    rig.base = { r: [-0.5, 0, 0.3] };
  } else if (kind === 'woodwind') {
    const w = new THREE.Group(); w.position.set(0, 0.56, 0.24); w.rotation.x = 0.55; T.add(w);
    const tb = stick(PM.black, 0.5, 0.032, w); tb.position.y = -0.25;
    const bl = mesh(PG.cone, PM.black, 0, -0.52, 0, 0.05, 0.06, 0.05, w); bl.rotation.x = Math.PI;
    for (let i = 0; i < 4; i++) mesh(PG.hand, PM.silver, 0, -0.1 - i * 0.09, 0.026, 0.2, 0.2, 0.2, w);
    P.lArm.rotation.set(-1.25, 0, -0.45); P.rArm.rotation.set(-1.0, 0, 0.45);
    rig.base = { r: [-1.0, 0, 0.45], l: [-1.25, 0, -0.45] };
  } else if (kind === 'brass') {
    const b = new THREE.Group(); b.position.set(0, 0.6, 0.22); b.rotation.x = Math.PI / 2 - 0.25; T.add(b);
    const tb = stick(PM.brass, 0.3, 0.025, b); tb.position.y = 0.15;
    mesh(PG.ell, PM.brass, 0.06, 0.15, 0, 0.07, 0.11, 0.04, b);
    mesh(PG.cone, PM.brass, 0, 0.36, 0, 0.12, 0.16, 0.12, b).rotation.x = Math.PI;
    P.lArm.rotation.set(-1.2, 0, -0.3); P.rArm.rotation.set(-1.2, 0, 0.3);
    rig.base = { r: [-1.2, 0, 0.3], l: [-1.2, 0, -0.3] };
  } else if (kind === 'percussion') { // timpani
    const d = new THREE.Group(); d.position.set(0, 0.62, 0.48); outer.add(d);
    mesh(PG.bowl, PM.copper, 0, 0, 0, 0.32, 0.38, 0.32, d);
    mesh(PG.stick, PM.white, 0, 0.005, 0, 0.33, 0.01, 0.33, d);
    for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [0, 0.22]]) mesh(PG.stick, PM.silver, x, -0.4, z, 0.012, 0.45, 0.012, d);
    for (const h of [P.lHand, P.rHand]) { const m = stick(PM.dark, 0.32, 0.01, h); m.rotation.x = Math.PI / 2; m.position.z = 0.15; mesh(PG.hand, PM.white, 0, 0, 0.31, 0.6, 0.6, 0.6, h); }
    rig.base = { r: [-0.9, 0, 0.15], l: [-0.9, 0, -0.15] };
  }
  outer.userData.rig = rig;
  return outer;
}

function makeConductor() {
  const P = makeChibiPerformer({ sitting: false, female: false });
  P.g.name = 'conductor';
  const baton = stick(PM.white, 0.4, 0.008, P.rHand); baton.name = 'baton';
  baton.rotation.x = Math.PI / 2; baton.position.z = 0.2;
  P.g.userData.rig = P;
  return P.g;
}

function makeMusicStand() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  pole.position.y = 0.55;
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.02, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  desk.position.set(0, 1.12, 0.05);
  desk.rotation.x = -0.4;
  g.add(pole, desk);
  return g;
}

function makeAnimator(musician, kind, seed) {
  const R = musician.userData.rig;
  const ph = seed * 0.73 + Math.random();
  const sp = kind === 'percussion' ? 4.2 : kind === 'brass' ? 1.6 : 2.0 + Math.random() * 0.4;
  const b = R.base || {};
  const setA = (a, v) => v && a.rotation.set(v[0], v[1], v[2]);
  return (t, playing) => {
    setA(R.rArm, b.r); setA(R.lArm, b.l);
    R.torso.rotation.set(0, 0, 0); R.head.rotation.set(0, 0, 0);
    if (!playing) return;
    const s = Math.sin(t * sp + ph);
    R.torso.rotation.z = s * 0.05; R.head.rotation.z = Math.sin(t * sp * 0.5 + ph) * 0.1;
    if (kind === 'string' || kind === 'cello' || kind === 'bass') {
      R.rArm.rotation.z += s * (kind === 'string' ? 0.45 : 0.35); // bowing
      R.rArm.rotation.x += Math.cos(t * sp + ph) * 0.12;
      R.lArm.rotation.y = Math.sin(t * 6 + ph) * 0.06; // vibrato
      R.torso.rotation.x = s * 0.04;
    } else if (kind === 'percussion') {
      R.rArm.rotation.x += -Math.abs(Math.sin(t * sp + ph)) * 0.5;
      R.lArm.rotation.x += -Math.abs(Math.sin(t * sp + ph + 1.5)) * 0.5;
    } else {
      R.torso.rotation.x = -0.05 + s * 0.05; // breathing / phrasing
      R.rArm.rotation.x += Math.sin(t * 5 + ph) * 0.04;
    }
  };
}

function makeConductorAnimator(conductor) {
  const R = conductor.userData.rig;
  return (t, playing) => {
    R.torso.rotation.set(0, 0, 0); R.head.rotation.set(0, 0, 0);
    if (!playing) { R.rArm.rotation.set(-0.4, 0, 0.15); R.lArm.rotation.set(0, 0, -0.1); return; }
    const beat = t * 2.4; // 4-pattern baton
    R.rArm.rotation.set(-1.4 + Math.abs(Math.sin(beat)) * 0.6, 0, 0.4 + Math.sin(beat * 0.5) * 0.5);
    R.lArm.rotation.set(-1.1 + Math.sin(t * 1.2) * 0.35, 0, -0.4 + Math.sin(t * 0.9) * 0.2);
    R.torso.rotation.x = -0.06 + Math.sin(beat * 2) * 0.03;
    R.torso.rotation.y = Math.sin(t * 0.4) * 0.25;
    R.head.rotation.x = Math.sin(beat * 2) * 0.08;
  };
}

/**
 * Concert grand for piano concerto:
 * - Curved tail toward upstage (orchestra)
 * - Keyboard on audience's left (stage right / house-left, -X)
 * - Soloist faces stage-left (+X), profile to audience
 * - Lid hinged on upstage spine, open side toward audience
 */
function makeConcertGrandAndSoloist() {
  const root = new THREE.Group();
  root.name = 'concertGrand';
  // Front-center apron
  root.position.set(0.1, 0, 3.25);
  // Local: keyboard @ +Z, tail @ -Z. Yaw -90°+ε → keyboard house-left (-X), tail angled upstage.
  root.rotation.y = -Math.PI / 2 + 0.85; // ~-37° from LR: tail more upstage, keyboard still house-left

  const gloss = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.18,
    metalness: 0.55,
  });
  const glossSoft = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.28,
    metalness: 0.4,
  });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.55 });
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.6 });

  // Case along local Z
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.28, 2.2), gloss);
  body.position.set(0, 0.72, -0.1);
  body.castShadow = true;
  root.add(body);
  // Narrow tail at local -Z (→ upstage after yaw)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 0.75), gloss);
  tail.position.set(-0.05, 0.72, -1.3);
  tail.castShadow = true;
  root.add(tail);

  // Keyboard at local +Z
  const keys = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.28), ivory);
  keys.position.set(0, 0.78, 1.05);
  root.add(keys);
  for (let i = 0; i < 12; i++) {
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.16), glossSoft);
    bk.position.set(-0.55 + i * 0.1, 0.84, 1.0);
    root.add(bk);
  }

  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.32, 0.04), glossSoft);
  desk.position.set(0, 1.05, 0.55);
  desk.rotation.x = -0.25;
  root.add(desk);

  // Lid hinge on local -X (= upstage after -90° yaw). Lid extends +X; +rot.z opens toward audience.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.68, 0.88, -0.1);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.04, 2.0), gloss);
  lid.position.set(0.68, 0, 0);
  lid.castShadow = true;
  lidPivot.add(lid);
  lidPivot.rotation.z = 1.15;
  root.add(lidPivot);

  const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.95, 6), stickMat);
  prop.position.set(0.05, 1.35, -0.2);
  prop.rotation.z = -0.55;
  prop.rotation.x = -0.1;
  root.add(prop);

  for (const [lx, lz] of [[-0.5, 0.9], [0.5, 0.9], [-0.35, -1.15], [0.35, -1.15]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.58, 8), gloss);
    leg.position.set(lx, 0.29, lz);
    leg.castShadow = true;
    root.add(leg);
  }

  // Bench beyond keyboard (+Z); soloist faces -Z into keys → after yaw ≈ stage-left (+X), profile
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.35), glossSoft);
  bench.position.set(0, 0.48, 1.55);
  root.add(bench);
  for (const [lx, lz] of [[-0.28, 1.45], [0.28, 1.45], [-0.28, 1.65], [0.28, 1.65]]) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.04), gloss);
    bl.position.set(lx, 0.24, lz);
    root.add(bl);
  }

  const SP = makeChibiPerformer({ sitting: true, seatY: 0.52, female: false });
  const soloist = SP.g; soloist.name = 'soloist';
  soloist.position.set(0, 0, 1.6);
  soloist.rotation.y = Math.PI; // face local -Z (into keyboard)
  root.add(soloist);
  const soloistAnimator = (t, playing) => {
    SP.lArm.rotation.set(-1.15, 0, -0.1); SP.rArm.rotation.set(-1.15, 0, 0.1);
    SP.torso.rotation.set(0.12, 0, 0); SP.head.rotation.set(0, 0, 0);
    if (!playing) return;
    SP.lArm.rotation.x += Math.sin(t * 8.5) * 0.12; SP.lArm.rotation.z += Math.sin(t * 2.1) * 0.25;
    SP.rArm.rotation.x += Math.sin(t * 9.1 + 1.2) * 0.12; SP.rArm.rotation.z += Math.sin(t * 1.7 + 0.7) * 0.25;
    SP.torso.rotation.x += Math.sin(t * 1.3) * 0.08; SP.torso.rotation.z = Math.sin(t * 0.9) * 0.06;
    SP.head.rotation.x = Math.sin(t * 2.6) * 0.12; SP.head.rotation.z = Math.sin(t * 1.1) * 0.1;
  };

  const pianoWorldHint = { x: 0.1, y: 1.5, z: 3.25 };
  return { pianoGroup: root, soloistAnimator, pianoWorldHint };
}
