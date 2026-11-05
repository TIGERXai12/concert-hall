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

function makeMusician(kind, yaw = 0) {
  const g = new THREE.Group();
  g.rotation.y = yaw;

  // Chair
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.08, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85 })
  );
  seat.position.y = 0.45;
  g.add(seat);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const [lx, lz] of [[-0.16, -0.14], [0.16, -0.14], [-0.16, 0.14], [0.16, 0.14]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), legMat);
    leg.position.set(lx, 0.225, lz);
    g.add(leg);
  }

  // Body
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.55, 0.22),
    new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.7 })
  );
  torso.position.y = 0.95;
  torso.name = 'torso';
  g.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 })
  );
  head.position.y = 1.38;
  g.add(head);

  // Arms
  const armMat = new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.7 });
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), armMat);
  lArm.position.set(-0.28, 1.0, 0.05);
  lArm.name = 'lArm';
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), armMat);
  rArm.position.set(0.28, 1.0, 0.05);
  rArm.name = 'rArm';
  g.add(lArm, rArm);

  // Instrument
  const instrument = makeInstrument(kind);
  instrument.name = 'instrument';
  g.add(instrument);

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function makeInstrument(kind) {
  const g = new THREE.Group();
  if (kind === 'string' || kind === 'cello' || kind === 'bass') {
    const scale = kind === 'bass' ? 1.35 : kind === 'cello' ? 1.15 : 1;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * scale, 0.38 * scale, 0.06 * scale),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.55, metalness: 0.1 })
    );
    body.position.set(0.18, kind === 'bass' ? 0.95 : 1.05, 0.22);
    body.rotation.z = -0.35;
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.42 * scale, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
    );
    neck.position.set(0.28, kind === 'bass' ? 1.35 : 1.4, 0.28);
    neck.rotation.z = -0.35;
    g.add(body, neck);
  } else if (kind === 'woodwind') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.4 })
    );
    tube.rotation.x = Math.PI / 2.4;
    tube.position.set(0.15, 1.15, 0.25);
    g.add(tube);
  } else if (kind === 'brass') {
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.03, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.3 })
    );
    bell.rotation.x = Math.PI / 2.2;
    bell.position.set(0.12, 1.15, 0.28);
    g.add(bell);
  } else if (kind === 'percussion') {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: SILVER, metalness: 0.5, roughness: 0.4 })
    );
    drum.position.set(0, 0.85, 0.35);
    g.add(drum);
  }
  return g;
}

function makeConductor() {
  const g = new THREE.Group();
  g.name = 'conductor';
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.6, 0.24),
    new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.65 })
  );
  torso.position.y = 1.05;
  torso.name = 'torso';
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshStandardMaterial({ color: SKIN })
  );
  head.position.y = 1.5;
  const lArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.4, 0.1),
    new THREE.MeshStandardMaterial({ color: BLACK })
  );
  lArm.position.set(-0.3, 1.15, 0.05);
  lArm.name = 'lArm';
  const rArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.42, 0.09),
    new THREE.MeshStandardMaterial({ color: BLACK })
  );
  rArm.position.set(0.32, 1.2, 0.1);
  rArm.name = 'rArm';
  // Baton
  const baton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.012, 0.45, 6),
    new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.5 })
  );
  baton.position.set(0, 0.28, 0);
  baton.name = 'baton';
  rArm.add(baton);
  g.add(torso, head, lArm, rArm);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
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
  const torso = musician.getObjectByName('torso');
  const lArm = musician.getObjectByName('lArm');
  const rArm = musician.getObjectByName('rArm');
  const phase = seed * 0.73;
  const speed = kind === 'percussion' ? 3.2 : kind === 'brass' ? 1.6 : 2.2;
  return (t, playing) => {
    if (!playing) {
      if (torso) torso.rotation.x = 0;
      if (lArm) lArm.rotation.x = 0;
      if (rArm) rArm.rotation.x = 0;
      return;
    }
    const sway = Math.sin(t * speed + phase) * 0.08;
    if (torso) torso.rotation.z = sway * 0.5;
    if (kind === 'string' || kind === 'cello' || kind === 'bass') {
      if (rArm) rArm.rotation.x = Math.sin(t * speed * 1.4 + phase) * 0.45;
      if (lArm) lArm.rotation.z = 0.2 + Math.sin(t * speed + phase) * 0.08;
    } else if (kind === 'percussion') {
      if (rArm) rArm.rotation.x = -0.4 + Math.abs(Math.sin(t * speed + phase)) * 0.7;
      if (lArm) lArm.rotation.x = -0.3 + Math.abs(Math.sin(t * speed + phase + 1)) * 0.5;
    } else {
      if (rArm) rArm.rotation.x = -0.25 + Math.sin(t * speed + phase) * 0.12;
      if (lArm) lArm.rotation.x = -0.2 + Math.sin(t * speed + phase + 0.5) * 0.1;
    }
  };
}

function makeConductorAnimator(conductor) {
  const rArm = conductor.getObjectByName('rArm');
  const lArm = conductor.getObjectByName('lArm');
  return (t, playing) => {
    if (!playing) {
      if (rArm) { rArm.rotation.x = -0.3; rArm.rotation.z = 0; }
      if (lArm) lArm.rotation.x = 0;
      return;
    }
    if (rArm) {
      rArm.rotation.x = -0.6 + Math.sin(t * 2.4) * 0.55;
      rArm.rotation.z = Math.sin(t * 1.7) * 0.35;
    }
    if (lArm) {
      lArm.rotation.x = -0.2 + Math.sin(t * 1.5 + 1) * 0.2;
    }
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

  const soloist = new THREE.Group();
  soloist.name = 'soloist';
  soloist.position.set(0, 0, 1.55);
  soloist.rotation.y = Math.PI; // face local -Z (into keyboard)

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.55 })
  );
  torso.position.y = 0.95;
  torso.name = 'torso';
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 })
  );
  head.position.y = 1.35;
  const lArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.36, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x101010 })
  );
  lArm.position.set(-0.28, 0.95, 0.12);
  lArm.name = 'lArm';
  const rArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.36, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x101010 })
  );
  rArm.position.set(0.28, 0.95, 0.12);
  rArm.name = 'rArm';
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.35, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x101010 })
  );
  legL.position.set(-0.12, 0.55, 0.05);
  const legR = legL.clone();
  legR.position.x = 0.12;
  soloist.add(torso, head, lArm, rArm, legL, legR);
  soloist.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(soloist);

  const soloistAnimator = (t, playing) => {
    const la = soloist.getObjectByName('lArm');
    const ra = soloist.getObjectByName('rArm');
    if (!playing) {
      if (la) { la.rotation.x = -0.55; la.rotation.z = 0; }
      if (ra) { ra.rotation.x = -0.5; ra.rotation.z = 0; }
      return;
    }
    if (la) {
      la.rotation.x = -0.7 + Math.sin(t * 8.5) * 0.35;
      la.rotation.z = Math.sin(t * 5.2) * 0.15;
    }
    if (ra) {
      ra.rotation.x = -0.65 + Math.sin(t * 9.1 + 1.2) * 0.4;
      ra.rotation.z = Math.sin(t * 4.8 + 0.7) * 0.12;
    }
  };

  const pianoWorldHint = { x: 0.1, y: 1.5, z: 3.25 };
  return { pianoGroup: root, soloistAnimator, pianoWorldHint };
}
