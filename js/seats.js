import * as THREE from 'three';

/**
 * Simplified seating inspired by Bucheon Arts Center Concert Hall layout:
 * 1F A/B/C facing stage, D/F side, 2F rear + sides + P choir behind stage,
 * 3F upper rear + sides. Counts scaled down for web performance; labels follow
 * official section letters (A–F, P, L/R).
 * Each seat faces local -Z; backrest on local +Z (away from stage). Choir uses yaw=π.
 */

const SEAT_IDLE = 0x5c2a2a;   // Kotobuki-like warm burgundy
const SEAT_HOVER = 0xd4af6e;
const SEAT_TAKEN = 0x2a1212;

export function buildSeats(scene) {
  const group = new THREE.Group();
  group.name = 'seats';
  const seats = [];

  const add = (seat) => { group.add(seat); seats.push(seat); };
  add.group = group;

  // ========== 1F main blocks facing stage (+z) ==========
  // B = center, A = house-left, C = house-right (audience facing stage)
  placeBlock(add, {
    floor: '一楼', section: 'B区',
    rows: 8, cols: 10, seatPitch: 0.78, rowPitch: 1.05,
    originX: 0, originZ: 6.2, originY: 0.05, rake: 0.09,
    centerAisle: 1.0,
  groundY: 0,
  });
  placeBlock(add, {
    floor: '一楼', section: 'A区',
    rows: 7, cols: 7, seatPitch: 0.78, rowPitch: 1.05,
    originX: -7.8, originZ: 6.5, originY: 0.08, rake: 0.09,
    yaw: 0.12,
  groundY: 0,
  });
  placeBlock(add, {
    floor: '一楼', section: 'C区',
    rows: 7, cols: 7, seatPitch: 0.78, rowPitch: 1.05,
    originX: 7.8, originZ: 6.5, originY: 0.08, rake: 0.09,
    yaw: -0.12,
  groundY: 0,
  });

  // 1F side vineyard terraces (D left / F right) — angled toward stage
  placeBlock(add, {
    floor: '一楼', section: 'D区',
    rows: 5, cols: 5, seatPitch: 0.8, rowPitch: 1.0,
    originX: -11.5, originZ: 0.5, originY: 1.4, rake: 0.12,
    yaw: Math.PI / 2.4,
  groundY: 0, parapet: true, backExtra: 1.2,
  });
  placeBlock(add, {
    floor: '一楼', section: 'F区',
    rows: 5, cols: 5, seatPitch: 0.8, rowPitch: 1.0,
    originX: 11.5, originZ: 0.5, originY: 1.4, rake: 0.12,
    yaw: -Math.PI / 2.4,
  groundY: 0, parapet: true, backExtra: 1.2,
  });

  // ========== 2F rear balcony ==========
  placeBlock(add, {
    floor: '二楼', section: 'B区',
    rows: 4, cols: 14, seatPitch: 0.75, rowPitch: 0.95,
    originX: 0, originZ: 12.2, originY: 6.7, rake: 0.12,
    centerAisle: 0.9,
  groundY: 5.9, parapet: true, backExtra: 2.5, soffit: true,
  });
  placeBlock(add, {
    floor: '二楼', section: 'A区',
    rows: 3, cols: 6, seatPitch: 0.75, rowPitch: 0.95,
    originX: -9.5, originZ: 12.5, originY: 6.75, rake: 0.12,
  groundY: 5.9, parapet: true, backExtra: 2.2, soffit: true,
  });
  placeBlock(add, {
    floor: '二楼', section: 'C区',
    rows: 3, cols: 6, seatPitch: 0.75, rowPitch: 0.95,
    originX: 9.5, originZ: 12.5, originY: 6.75, rake: 0.12,
  groundY: 5.9, parapet: true, backExtra: 2.2, soffit: true,
  });

  // 2F side balconies L / R
  placeBlock(add, {
    floor: '二楼', section: 'L区',
    rows: 3, cols: 6, seatPitch: 0.78, rowPitch: 0.95,
    originX: -12.2, originZ: 0, originY: 6.0, rake: 0.08,
    yaw: Math.PI / 2.2,
  groundY: 5.2, parapet: true, backExtra: 1.5, soffit: true,
  });
  placeBlock(add, {
    floor: '二楼', section: 'R区',
    rows: 3, cols: 6, seatPitch: 0.78, rowPitch: 0.95,
    originX: 12.2, originZ: 0, originY: 6.0, rake: 0.08,
    yaw: -Math.PI / 2.2,
  groundY: 5.2, parapet: true, backExtra: 1.5, soffit: true,
  });

  // ========== 2F P choir seats (behind stage, facing conductor/orchestra) ==========
  placeBlock(add, {
    floor: '二楼', section: 'P区·合唱',
    rows: 4, cols: 10, seatPitch: 0.72, rowPitch: 1.05,
    originX: 0, originZ: -7.5, originY: 2.85, rake: 0.45,
    yaw: Math.PI, // face toward stage / audience
    centerAisle: 0.7,
  groundY: 0, parapet: true, backExtra: 0.8,
  });

  // ========== 3F upper ==========
  placeBlock(add, {
    floor: '三楼', section: 'B区',
    rows: 3, cols: 12, seatPitch: 0.72, rowPitch: 0.9,
    originX: 0, originZ: 14.5, originY: 11.4, rake: 0.14,
    centerAisle: 0.85,
  groundY: 10.6, parapet: true, backExtra: 2.5, soffit: true,
  });
  placeBlock(add, {
    floor: '三楼', section: 'L区',
    rows: 2, cols: 5, seatPitch: 0.75, rowPitch: 0.9,
    originX: -12.8, originZ: 1, originY: 10.55, rake: 0.1,
    yaw: Math.PI / 2.15,
  groundY: 9.75, parapet: true, backExtra: 1.5, soffit: true,
  });
  placeBlock(add, {
    floor: '三楼', section: 'R区',
    rows: 2, cols: 5, seatPitch: 0.75, rowPitch: 0.9,
    originX: 12.8, originZ: 1, originY: 10.55, rake: 0.1,
    yaw: -Math.PI / 2.15,
  groundY: 9.75, parapet: true, backExtra: 1.5, soffit: true,
  });

  scene.add(group);
  return { group, seats };
}

function placeBlock(add, opts) {
  buildRisers(add.group, opts);
  const {
    floor, section, rows, cols, seatPitch, rowPitch,
    originX, originZ, originY, rake = 0, yaw = 0, centerAisle = 0,
  } = opts;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let localX;
      if (centerAisle > 0) {
        const half = cols / 2;
        const side = c < half ? -1 : 1;
        const colInSide = c < half ? c : c - half;
        localX = side * (centerAisle / 2 + 0.35 + colInSide * seatPitch);
      } else {
        localX = (c - (cols - 1) / 2) * seatPitch;
      }
      const localZ = r * rowPitch;
      const localY = r * rake;

      const seat = makeSeat(`${floor} ${section} ${r + 1}排 ${c + 1}座`, {
        floor, section, row: r + 1, num: c + 1,
      });

      // Apply yaw around block origin
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const wx = originX + localX * cos + localZ * sin;
      const wz = originZ - localX * sin + localZ * cos;
      seat.position.set(wx, originY + localY, wz);
      seat.rotation.y = yaw;
      add(seat);
    }
  }
}

function makeSeat(label, meta) {
  const g = new THREE.Group();
  g.name = 'seat';
  const mat = new THREE.MeshStandardMaterial({
    color: SEAT_IDLE,
    roughness: 0.88,
    metalness: 0.04,
  });
  // Convention: sitter faces local -Z (toward stage for yaw=0).
  // Backrest sits on local +Z — away from the stage/focus.
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.48), mat);
  cushion.position.y = 0.4;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.07), mat);
  back.position.set(0, 0.68, 0.22);
  back.castShadow = true;
  // Wood armrests hint
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6844, roughness: 0.7 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.4), wood);
  armL.position.set(-0.28, 0.52, 0);
  const armR = armL.clone();
  armR.position.x = 0.28;

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.05, 0.65),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.52;
  hit.userData.isSeatHit = true;

  g.add(cushion, back, armL, armR, hit);
  g.userData = {
    ...meta,
    label,
    occupied: false,
    materials: [mat],
    isSeat: true,
  };
  for (const o of [cushion, back, hit]) {
    o.userData.isSeat = true;
    o.userData.seatRoot = g;
  }
  return g;
}

export function setSeatHover(seat, hovered) {
  if (!seat || seat.userData.occupied) return;
  const color = hovered ? SEAT_HOVER : SEAT_IDLE;
  for (const m of seat.userData.materials) m.color.setHex(color);
}

export function setSeatOccupied(seat, occupied) {
  if (!seat) return;
  seat.userData.occupied = occupied;
  for (const m of seat.userData.materials) m.color.setHex(occupied ? SEAT_TAKEN : SEAT_IDLE);
}

export function getSeatCameraPose(seat) {
  const wp = new THREE.Vector3();
  seat.getWorldPosition(wp);
  // Eye above cushion, slightly toward stage (local -Z), in front of backrest (+Z)
  const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(seat.quaternion);
  const eye = wp.clone()
    .add(new THREE.Vector3(0, 1.12, 0))
    .addScaledVector(facing, 0.12);
  const target = new THREE.Vector3(0, 2.4, -1);
  return { eye, target };
}

export { SEAT_IDLE, SEAT_HOVER };

const CARPET = new THREE.MeshStandardMaterial({ color: 0x7a2a2e, roughness: 0.95 });
const WOODM = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.7 });
const WOODD = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.75 });
/** Solid stepped terrace under each row (tread + riser filled down to groundY), parapet & soffit. */
function buildRisers(group, o) {
  const { rows, cols, seatPitch, rowPitch, originX, originZ, originY, rake = 0, yaw = 0,
    centerAisle = 0, groundY = 0, parapet = false, backExtra = 0, soffit = false } = o;
  const halfW = centerAisle > 0
    ? centerAisle / 2 + 0.35 + (cols / 2 - 1) * seatPitch + 0.55
    : ((cols - 1) / 2) * seatPitch + 0.55;
  const W = halfW * 2;
  const blk = new THREE.Group();
  blk.position.set(originX, 0, originZ);
  blk.rotation.y = yaw;
  const box = (w, h, d, x, y, z, m) => {
    if (h <= 0.001) return;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.receiveShadow = true; blk.add(b);
  };
  const front = -rowPitch / 2 - 0.15;
  for (let r = 0; r < rows; r++) {
    const top = originY + r * rake;
    const z0 = r === 0 ? front : r * rowPitch - rowPitch / 2;
    const z1 = r === rows - 1 ? r * rowPitch + rowPitch / 2 + backExtra : r * rowPitch + rowPitch / 2;
    const h = top - groundY;
    box(W, Math.max(h - 0.04, 0.02), z1 - z0, 0, groundY + (h - 0.04) / 2, (z0 + z1) / 2, WOODD);
    box(W, 0.04, z1 - z0, 0, top - 0.02, (z0 + z1) / 2, CARPET);           // carpet tread
    box(W + 0.02, Math.min(rake, h) + 0.01, 0.03, 0, top - Math.min(rake, h) / 2, z0 - 0.005, WOODM); // riser face
  }
  const lastTop = originY + (rows - 1) * rake;
  const backZ = (rows - 1) * rowPitch + rowPitch / 2 + backExtra;
  if (parapet) {
    box(W + 0.1, 0.85, 0.12, 0, originY + 0.42, front - 0.06, WOODM);       // front parapet
    box(W + 0.16, 0.06, 0.2, 0, originY + 0.87, front - 0.06, WOODD);       // rail cap
    // side end walls (stringers) following the steps
    for (const sx of [-1, 1]) box(0.12, lastTop - groundY + 0.85, backZ - front, sx * (W / 2 + 0.06), groundY + (lastTop - groundY + 0.85) / 2, (front + backZ) / 2, WOODM);
  }
  if (soffit) {
    box(W + 0.24, 0.5, 0.14, 0, groundY - 0.25, front - 0.06, WOODM);       // fascia below parapet
    box(W + 0.24, 0.1, backZ - front, 0, groundY - 0.5, (front + backZ) / 2, WOODD); // soffit
  }
  group.add(blk);
}
