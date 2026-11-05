import * as THREE from 'three';

/**
 * Hall inspired by Bucheon Arts Center Concert Hall (부천아트센터 콘서트홀):
 * shoebox + vineyard hybrid, warm wood, pipe organ behind stage,
 * choir terrace (P), side/rear balconies, overhead acoustic reflectors.
 * Original geometry only — no photo textures.
 */

const WOOD_LIGHT = 0xd4b896;   // birch-like wall panels
const WOOD_MID = 0xb8956a;
const WOOD_DARK = 0x8a6844;
const WOOD_FLOOR = 0xc4a882;
const STAGE_WOOD = 0xa67c52;
const SEAT_VELVET = 0x5c2a2a;
const ORGAN_PIPE = 0xe8dcc8;
const ORGAN_PIPE_DARK = 0xc9b896;
const ORGAN_CASE = 0x6b4e32;
const RAIL = 0xd9c4a0;
const CEILING = 0xf0ebe3;
const BANNER = 0x7a2e2e;

export function buildHall(scene) {
  const root = new THREE.Group();
  root.name = 'hall';

  // --- Audience floor (1F vineyard rake toward stage at z≈0) ---
  // Stage at z=0, audience mainly +z, choir/organ at -z
  const floorMat = new THREE.MeshStandardMaterial({ color: WOOD_FLOOR, roughness: 0.82, metalness: 0.04 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 42), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 2);
  floor.receiveShadow = true;
  root.add(floor);

  // Raised stage platform (~1m, curved-ish front approximated)
  const stageMat = new THREE.MeshStandardMaterial({ color: STAGE_WOOD, roughness: 0.7 });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(16, 1.0, 12), stageMat);
  stage.position.set(0, 0.5, -1);
  stage.receiveShadow = true;
  stage.castShadow = true;
  root.add(stage);

  // Soft stage front curve suggestion (lip)
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(16.5, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: WOOD_MID, roughness: 0.55 })
  );
  lip.position.set(0, 1.02, 5.1);
  root.add(lip);

  // Side / rear walls — warm wood paneling (shoebox volume)
  const wallMat = new THREE.MeshStandardMaterial({ color: WOOD_LIGHT, roughness: 0.78 });
  const wallDark = new THREE.MeshStandardMaterial({ color: WOOD_MID, roughness: 0.8 });

  // Left / right long walls
  for (const x of [-17, 17]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 16, 44), wallMat);
    w.position.set(x, 8, 1);
    root.add(w);
  }
  // Audience rear wall (+z)
  const rear = new THREE.Mesh(new THREE.BoxGeometry(34.5, 16, 0.5), wallMat);
  rear.position.set(0, 8, 22);
  root.add(rear);
  // Organ end wall (-z)
  const organWall = new THREE.Mesh(new THREE.BoxGeometry(34.5, 16, 0.6), wallDark);
  organWall.position.set(0, 8, -14);
  root.add(organWall);

  // Vertical wood battens on side walls (rhythm like birch panels)
  const battenMat = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.7 });
  for (let i = -8; i <= 10; i++) {
    for (const x of [-16.7, 16.7]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 12, 0.08), battenMat);
      b.position.set(x, 7, i * 2.2);
      root.add(b);
    }
  }

  // Ceiling slab
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(35, 44),
    new THREE.MeshStandardMaterial({ color: CEILING, roughness: 0.95, side: THREE.DoubleSide })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 15.5, 1);
  root.add(ceil);

  // --- Acoustic reflector panels above stage (height-adjustable canopies) ---
  addReflectors(root);

  // --- Pipe organ facade behind choir terrace ---
  addPipeOrgan(root);

  // --- Balcony shells (2F / 3F) ---
  addBalconyShells(root);

  // Decorative wall banners (acoustic curtains) — side strips
  const bannerMat = new THREE.MeshStandardMaterial({ color: BANNER, roughness: 0.9 });
  for (const x of [-15.5, 15.5]) {
    for (let i = 0; i < 4; i++) {
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 2.2), bannerMat);
      banner.position.set(x, 9, -6 + i * 5.5);
      root.add(banner);
    }
  }

  scene.add(root);
  addLighting(scene);
  return root;
}

function addReflectors(root) {
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xe6d5b8,
    roughness: 0.45,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: 0.5, metalness: 0.2 });
  // Grid of floating panels over stage — staggered heights like adjustable canopies
  const cols = 5;
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const g = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.8), panelMat);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 1.9), frameMat);
      frame.position.y = -0.05;
      g.add(panel, frame);
      const x = (c - (cols - 1) / 2) * 2.7;
      const z = -1 + (r - 1.2) * 2.1;
      // Slightly lower toward audience / varied heights
      const y = 9.2 + Math.sin(c * 0.7 + r) * 0.35 - r * 0.15;
      g.position.set(x, y, z);
      g.rotation.x = 0.18; // tilt to reflect toward audience
      root.add(g);
      // Suspension cables (thin)
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 15.5 - y, 4),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 })
      );
      cable.position.set(x, (15.5 + y) / 2, z);
      root.add(cable);
    }
  }
}

function addPipeOrgan(root) {
  const organ = new THREE.Group();
  organ.name = 'organ';
  organ.position.set(0, 1.0, -12.2);

  // Case / loft
  const caseMat = new THREE.MeshStandardMaterial({ color: ORGAN_CASE, roughness: 0.65 });
  const loft = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 2.2), caseMat);
  loft.position.y = 0.6;
  organ.add(loft);

  // Pipe facade — tall center, stepped sides (Casavant-style silhouette, abstract)
  const pipeMat = new THREE.MeshStandardMaterial({ color: ORGAN_PIPE, metalness: 0.55, roughness: 0.35 });
  const pipeDark = new THREE.MeshStandardMaterial({ color: ORGAN_PIPE_DARK, metalness: 0.5, roughness: 0.4 });

  const makePipe = (x, h, r = 0.08, dark = false) => {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.05, h, 8),
      dark ? pipeDark : pipeMat
    );
    p.position.set(x, 1.2 + h / 2, 0.2);
    p.castShadow = true;
    organ.add(p);
    // Mouth / toe detail
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(r * 1.6, r * 0.8, r * 0.4),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    mouth.position.set(x, 1.35, 0.35);
    organ.add(mouth);
  };

  // Central towers
  for (let i = -2; i <= 2; i++) {
    makePipe(i * 0.55, 8.5 - Math.abs(i) * 0.4, 0.14 - Math.abs(i) * 0.015);
  }
  // Flanking ranks
  for (let i = 0; i < 18; i++) {
    const side = i < 9 ? -1 : 1;
    const idx = i % 9;
    const x = side * (1.8 + idx * 0.48);
    const h = 3.2 + (8 - idx) * 0.45 + (idx % 3) * 0.15;
    makePipe(x, h, 0.06 + (idx % 4) * 0.012, idx % 2 === 0);
  }
  // Upper smaller pipes row
  for (let i = -12; i <= 12; i++) {
    if (Math.abs(i) < 3) continue;
    makePipe(i * 0.42, 2.0 + (Math.abs(i) % 5) * 0.25, 0.045, true);
  }

  // Pediment / crown wood
  const crown = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.5, 2.4), caseMat);
  crown.position.y = 10.2;
  organ.add(crown);

  root.add(organ);
}

function addBalconyShells(root) {
  const deckMat = new THREE.MeshStandardMaterial({ color: WOOD_MID, roughness: 0.75 });
  const railMat = new THREE.MeshStandardMaterial({ color: RAIL, roughness: 0.5, metalness: 0.15 });
  const faceMat = new THREE.MeshStandardMaterial({ color: WOOD_LIGHT, roughness: 0.7 });

  // 2F rear balcony deck
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.35, 8), deckMat);
  b2.position.set(0, 6.5, 15);
  b2.receiveShadow = true;
  root.add(b2);
  const b2face = new THREE.Mesh(new THREE.BoxGeometry(30, 1.1, 0.25), faceMat);
  b2face.position.set(0, 7.15, 11.1);
  root.add(b2face);
  const b2rail = new THREE.Mesh(new THREE.BoxGeometry(30, 0.08, 0.08), railMat);
  b2rail.position.set(0, 7.75, 11.0);
  root.add(b2rail);

  // 3F rear balcony
  const b3 = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 6), deckMat);
  b3.position.set(0, 11.2, 16.5);
  b3.receiveShadow = true;
  root.add(b3);
  const b3face = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 0.22), faceMat);
  b3face.position.set(0, 11.8, 13.6);
  root.add(b3face);
  const b3rail = new THREE.Mesh(new THREE.BoxGeometry(28, 0.08, 0.08), railMat);
  b3rail.position.set(0, 12.35, 13.5);
  root.add(b3rail);

  // Side balconies 2F (vineyard terraces left/right of stage)
  for (const side of [-1, 1]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 14), deckMat);
    deck.position.set(side * 12.5, 5.8, 0);
    deck.receiveShadow = true;
    root.add(deck);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 14), faceMat);
    face.position.set(side * 10.3, 6.4, 0);
    root.add(face);

    // Upper side terrace 3F
    const deck3 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.28, 12), deckMat);
    deck3.position.set(side * 13.2, 10.4, 1);
    root.add(deck3);
    const face3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 12), faceMat);
    face3.position.set(side * 11.4, 10.95, 1);
    root.add(face3);
  }

  // Choir terrace (P) behind stage, in front of organ — stepped
  const choirMat = new THREE.MeshStandardMaterial({ color: WOOD_MID, roughness: 0.72 });
  for (let step = 0; step < 4; step++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(12 - step * 0.4, 0.35, 1.4), choirMat);
    t.position.set(0, 2.6 + step * 0.55, -7.2 - step * 1.15);
    t.receiveShadow = true;
    root.add(t);
  }
  // Choir parapet facing stage
  const choirFace = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.9, 0.18),
    new THREE.MeshStandardMaterial({ color: WOOD_LIGHT, roughness: 0.7 })
  );
  choirFace.position.set(0, 3.2, -6.5);
  root.add(choirFace);
}

function addLighting(scene) {
  scene.add(new THREE.AmbientLight(0xfff2e0, 0.42));
  scene.add(new THREE.HemisphereLight(0xfff5e8, 0x4a3520, 0.4));

  // Warm house wash
  const house = new THREE.PointLight(0xffe0b8, 60, 55, 1.5);
  house.position.set(0, 12, 8);
  scene.add(house);

  // Stage key — soft concert look
  const key = new THREE.SpotLight(0xfff5e6, 90, 45, Math.PI / 3.2, 0.5, 1.1);
  key.position.set(0, 12, 4);
  key.target.position.set(0, 1.5, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);

  // Organ highlight
  const organLight = new THREE.SpotLight(0xffe8cc, 50, 30, Math.PI / 5, 0.4, 1);
  organLight.position.set(0, 13, -4);
  organLight.target.position.set(0, 6, -12);
  scene.add(organLight, organLight.target);

  // Side washes
  for (const x of [-8, 8]) {
    const s = new THREE.SpotLight(0xffe6c8, 35, 28, Math.PI / 4.5, 0.55, 1);
    s.position.set(x, 10, 2);
    s.target.position.set(x * 0.2, 1.5, -1);
    scene.add(s, s.target);
  }

  // Subtle fill from rear
  const rim = new THREE.DirectionalLight(0xffe8d0, 0.22);
  rim.position.set(0, 10, 18);
  scene.add(rim);
}

/** Kept for API compat — banners already in buildHall */
export function addCurtains(_scene) {}
