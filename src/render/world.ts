import * as THREE from 'three';
import { COTTAGE, FLOOR_H } from '../sim/machines';
import { M, V, box, cyl, floorTextures, mergeRigid, waterTexture } from './parts';

export interface Wall {
  obj: THREE.Object3D;
  /** outward normal */
  n: THREE.Vector3;
}

export interface Building {
  group: THREE.Group;
  walls: Wall[];
}

function floorMaterial(kind: 'flag' | 'boards', w: number, d: number): THREE.Material {
  const tex = floorTextures[kind].clone();
  tex.needsUpdate = true;
  tex.repeat.set(w, d);
  const mat = (kind === 'flag' ? M.flag : M.boards).clone() as THREE.MeshStandardMaterial;
  mat.map = tex;
  return mat;
}

function wall(len: number, h: number, t: number, alongX: boolean, mat: THREE.Material, windows: { every: number; w: number; h: number; y: number }): THREE.Group {
  const g = new THREE.Group();
  g.add(alongX ? box(len, h, t, mat, 0, h / 2, 0) : box(t, h, len, mat, 0, h / 2, 0));
  const n = Math.max(1, Math.floor(len / windows.every));
  for (let i = 0; i < n; i++) {
    const p = -len / 2 + ((i + 0.5) * len) / n;
    g.add(
      alongX
        ? box(windows.w, windows.h, t + 0.04, M.glass, p, windows.y, 0)
        : box(t + 0.04, windows.h, windows.w, M.glass, 0, windows.y, p),
    );
    // stone sill
    g.add(
      alongX
        ? box(windows.w + 0.2, 0.08, t + 0.1, M.stoneDark, p, windows.y - windows.h / 2 - 0.04, 0)
        : box(t + 0.1, 0.08, windows.w + 0.2, M.stoneDark, 0, windows.y - windows.h / 2 - 0.04, p),
    );
  }
  return g;
}

function shell(w: number, d: number, h: number, t: number, win: { every: number; w: number; h: number; y: number }, floorMat: THREE.Material, slab: number): Building {
  const group = new THREE.Group();
  // the floor stands a little proud of whatever is beneath it, so the two surfaces do not flicker
  group.add(box(w + 2 * t, slab, d + 2 * t, floorMat, w / 2, -slab / 2 + 0.02, d / 2));
  const walls: Wall[] = [];
  const add = (obj: THREE.Object3D, x: number, z: number, n: THREE.Vector3) => {
    mergeRigid(obj); // a wall with its windows and sills is three meshes, not thirty
    obj.position.set(x, 0, z);
    group.add(obj);
    walls.push({ obj, n });
  };
  add(wall(d + 2 * t, h, t, false, M.stone, win), -t / 2, d / 2, V(-1, 0, 0));
  add(wall(d + 2 * t, h, t, false, M.stone, win), w + t / 2, d / 2, V(1, 0, 0));
  add(wall(w, h, t, true, M.stone, win), w / 2, -t / 2, V(0, 0, -1));
  add(wall(w, h, t, true, M.stone, win), w / 2, d + t / 2, V(0, 0, 1));
  return { group, walls };
}

/** The workshop: a floor with four walls and no roof. Walls nearest the camera are hidden by the scene. */
export function buildCottage(): Building {
  const b = shell(COTTAGE.w, COTTAGE.d, 2.5, 0.28, { every: 2.7, w: 0.8, h: 0.9, y: 1.45 }, floorMaterial('boards', COTTAGE.w + 0.56, COTTAGE.d + 0.56), 0.1);
  b.group.add(box(COTTAGE.w + 0.76, 0.12, COTTAGE.d + 0.76, M.stoneDark, COTTAGE.w / 2, -0.07, COTTAGE.d / 2));
  b.group.position.set(COTTAGE.ox, 0, COTTAGE.oz);
  return b;
}

/** One storey of a mill, in the mill's own coordinates: flagstones on the ground, boards above. */
export function buildMillFloor(w: number, d: number, floor: number): Building {
  const t = 0.35;
  const b = shell(w, d, FLOOR_H - 0.2, t, { every: 2.5, w: 1.0, h: 1.5, y: 2.4 }, floorMaterial(floor === 0 ? 'flag' : 'boards', w + 2 * t, d + 2 * t), floor === 0 ? 0.1 : 0.16);
  if (floor === 0) b.group.add(box(w + 2 * t + 0.2, 0.12, d + 2 * t + 0.2, M.stoneDark, w / 2, -0.07, d / 2));
  b.group.position.y = floor * FLOOR_H;
  return b;
}

function tree(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.12 * s, 1.0 * s, M.dark, 'y', 0, 0.5 * s, 0, 6));
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 1 });
  const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), leaf);
  a.position.y = 1.7 * s;
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65 * s, 0), leaf);
  b.position.set(0.4 * s, 2.3 * s, 0.2 * s);
  g.add(a, b);
  g.position.set(x, 0, z);
  return g;
}

export interface Ground {
  group: THREE.Group;
  animate(dt: number): void;
}

/** Land, the river, and the excavated wheel pit and tail race. */
export function buildGround(): Ground {
  const group = new THREE.Group();
  const top = (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material) =>
    group.add(box(x1 - x0, 2, z1 - z0, mat, (x0 + x1) / 2, y - 1, (z0 + z1) / 2));
  const Z0 = -40;
  const Z1 = 40;
  top(-0.4, 60, Z0, Z1, 0, M.grass); // mill bank
  top(-5, -2.6, Z0, Z1, 0, M.grass); // strip between race and river
  top(-2.6, -0.4, Z0, 0.8, 0, M.grass); // upstream of the wheel pit
  top(-2.6, -0.4, 0.8, Z1, -1.1, M.stoneDark); // pit and tail race floor
  top(-13, -5, Z0, Z1, -0.9, M.earth); // river bed
  top(-60, -13, Z0, Z1, 0, M.grass); // far bank
  // masonry lining of the pit
  group.add(box(0.12, 1.1, Z1 - 0.8, M.stoneDark, -0.46, -0.55, (Z1 + 0.8) / 2));
  group.add(box(0.12, 1.1, Z1 - 0.8, M.stoneDark, -2.54, -0.55, (Z1 + 0.8) / 2));
  group.add(box(2.2, 1.1, 0.12, M.stoneDark, -1.5, -0.55, 0.86));

  const tex = waterTexture.clone();
  tex.needsUpdate = true;
  tex.repeat.set(5, 50);
  const mat = M.water.clone() as THREE.MeshStandardMaterial;
  mat.map = tex;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(8, Z1 - Z0), mat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(-9, -0.35, 0);
  group.add(river);

  // A cart track between workshop and mill.
  group.add(box(2.2, 0.02, 3.4, M.earth, 10, 0.011, 11.6));

  const spots: [number, number, number][] = [
    [-16, -8, 1.3], [-18, 2, 1.6], [-15, 9, 1.1], [-20, 15, 1.5], [-16, 24, 1.3], [-22, -18, 1.7],
    [-3.8, -9, 0.9], [-3.9, 16, 1.0], [50, 2, 1.4], [58, -28, 1.3], [3, 24, 1.3],
    [-17, -26, 1.4], [56, -14, 1.3], [52, 20, 1.2],
  ];
  for (const [x, z, s] of spots) group.add(tree(x, z, s));

  return {
    group,
    animate(dt: number) {
      tex.offset.y += dt * 0.12;
    },
  };
}

/** Stock in the yard beside the workshop: cotton bags, yarn hampers, cloth pieces. */
export interface Yard {
  group: THREE.Group;
  update(cotton: number, yarn: number, cloth: number): void;
}

export function buildYard(): Yard {
  const s = COTTAGE;
  const group = new THREE.Group();
  group.position.set(s.ox + s.w + 1.0, 0, s.oz);
  group.add(box(3.4, 0.06, s.d, M.earth, 1.6, 0.0, s.d / 2));
  const bags: THREE.Object3D[] = [];
  const hampers: THREE.Object3D[] = [];
  const pieces: THREE.Object3D[] = [];
  for (let i = 0; i < 12; i++) {
    const layer = Math.floor(i / 6);
    const b = box(0.75, 0.5, 0.5, M.cotton, 0.5 + (i % 2) * 0.85 + layer * 0.2, 0.28 + layer * 0.5, 0.5 + (Math.floor(i / 2) % 3) * 0.6);
    group.add(b);
    bags.push(b);
  }
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    g.add(cyl(0.26, 0.4, M.dark, 'y', 0, 0.2, 0, 10, 0.3));
    g.add(cyl(0.27, 0.12, M.yarn, 'y', 0, 0.44, 0, 10));
    g.position.set(0.5 + (i % 2) * 0.75, 0.03, 2.7 + Math.floor(i / 2) * 0.7);
    group.add(g);
    hampers.push(g);
  }
  for (let i = 0; i < 10; i++) {
    const layer = Math.floor(i / 5);
    const p = cyl(0.13, 0.9, M.cloth, 'x', 2.5, 0.16 + layer * 0.24, 0.5 + (i % 5) * 0.3 + layer * 0.15, 10);
    group.add(p);
    pieces.push(p);
  }
  const show = (list: THREE.Object3D[], n: number) => list.forEach((o, i) => (o.visible = i < n));
  return {
    group,
    update(cotton, yarn, cloth) {
      show(bags, Math.ceil(cotton / 25));
      show(hampers, Math.ceil(yarn / 20));
      show(pieces, Math.ceil(cloth));
    },
  };
}

/** A gabled slate roof with stone gable ends, its eaves at y = 0. The ridge runs along x. */
export function buildRoof(w: number, d: number, t: number, rise: number): THREE.Group {
  const g = new THREE.Group();
  const half = d / 2 + t + 0.25;
  const len = w + 2 * t + 0.5;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  for (const sz of [-1, 1]) {
    const pane = box(len, 0.08, slope + 0.1, M.slate, w / 2, rise / 2, d / 2 + (sz * half) / 2);
    pane.rotation.x = sz * ang;
    g.add(pane);
  }
  g.add(box(len, 0.1, 0.16, M.stoneDark, w / 2, rise + 0.02, d / 2));
  // gable ends
  for (const x of [-t, w]) {
    const shape = new THREE.Shape();
    shape.moveTo(-half + 0.25, 0);
    shape.lineTo(half - 0.25, 0);
    shape.lineTo(0, rise - 0.12);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2); // shape x -> z, extrusion along -x
    const gable = new THREE.Mesh(geo, M.stone);
    gable.position.set(x + t, 0, d / 2);
    g.add(gable);
  }
  mergeRigid(g);
  return g;
}

/** Rows of back-to-back cottages for the hands, on the rising ground beyond the workshop. */
export function buildHousing(rows: number): THREE.Group {
  const g = new THREE.Group();
  const shown = Math.min(rows, 18);
  for (let i = 0; i < shown; i++) {
    const row = new THREE.Group();
    row.position.set(20.5 + 13 * (i % 3), 0, 12 + 4.6 * Math.floor(i / 3));
    const N = 5;
    const cw = 2.3;
    row.add(box(N * cw, 2.3, 3.0, M.brick, (N * cw) / 2, 1.15, 1.5));
    const roof = buildRoof(N * cw - 0.1, 3.0, 0.05, 1.1);
    roof.position.y = 2.3;
    row.add(roof);
    for (let k = 0; k < N; k++) {
      const x = k * cw;
      row.add(box(0.5, 1.2, 0.06, M.dark, x + 0.6, 0.6, 3.02)); // door
      row.add(box(0.55, 0.6, 0.06, M.glass, x + 1.6, 1.2, 3.02), box(0.55, 0.5, 0.06, M.glass, x + 1.15, 1.25, -0.02));
      row.add(box(0.36, 0.9, 0.36, M.brick, x + cw - 0.2, 3.3, 1.5), box(0.2, 0.14, 0.2, M.dark, x + cw - 0.2, 3.8, 1.5)); // chimney
    }
    row.add(box(N * cw + 0.6, 0.04, 1.2, M.earth, (N * cw) / 2, 0.02, 3.7)); // the street
    mergeRigid(row);
    g.add(row);
  }
  return g;
}

/** Road, canal and railway serving the works, with a cart, a barge and a train going to and fro. */
export interface TransportView {
  group: THREE.Group;
  /** level: 0 road only, 1 with the canal, 2 with the railway. t in seconds of running time. */
  update(level: number, t: number): void;
}

export function buildTransport(): TransportView {
  const group = new THREE.Group();
  const X0 = 1;
  const X1 = 59;

  // --- the cart road, between the mill yard and the cottages ---
  const ROAD_Z = 10.7;
  group.add(box(X1 - X0, 0.03, 1.5, M.earth, (X0 + X1) / 2, 0.012, ROAD_Z));
  const cart = new THREE.Group();
  cart.add(box(1.5, 0.08, 0.8, M.pine, 0, 0.55, 0), box(1.5, 0.3, 0.05, M.pine, 0, 0.72, 0.4), box(1.5, 0.3, 0.05, M.pine, 0, 0.72, -0.4));
  for (const dx of [-0.35, 0.1, 0.5]) cart.add(box(0.42, 0.34, 0.6, M.cotton, dx, 0.78, 0));
  const cartWheels: THREE.Object3D[] = [];
  for (const sz of [-0.46, 0.46]) {
    const w = spoked(0.42, M.oak);
    w.position.set(-0.1, 0.42, sz);
    cart.add(w);
    cartWheels.push(w);
  }
  cart.add(horse(1.75, 0));
  group.add(cart);

  // --- the canal ---
  const CANAL_Z = -26.5;
  const canal = new THREE.Group();
  canal.add(box(X1 + 6, 0.04, 2.6, M.rinse, (X1 - 6) / 2, 0.015, CANAL_Z));
  for (const sz of [-1.45, 1.45]) canal.add(box(X1 + 6, 0.1, 0.3, M.stoneDark, (X1 - 6) / 2, 0.05, CANAL_Z + sz));
  canal.add(box(X1 + 6, 0.03, 0.9, M.earth, (X1 - 6) / 2, 0.012, CANAL_Z + 2.1)); // towpath
  const barge = new THREE.Group();
  barge.add(box(5.2, 0.4, 1.3, M.dark, 0, 0.2, 0), box(4.2, 0.08, 1.1, M.pine, -0.2, 0.42, 0), box(0.7, 0.5, 0.9, M.oak, 2.1, 0.62, 0));
  for (let i = 0; i < 5; i++) barge.add(box(0.7, 0.36, 0.9, i % 2 ? M.cotton : M.coal, -2.0 + i * 0.8, 0.62, 0));
  const tow = horse(0, 0);
  canal.add(barge, tow);
  group.add(canal);

  // --- the railway ---
  const RAIL_Z = -32;
  const rail = new THREE.Group();
  rail.add(box(X1 + 6, 0.06, 2.0, M.stoneDark, (X1 - 6) / 2, 0.02, RAIL_Z));
  const sleepers = new THREE.Group();
  for (let x = -6; x < X1; x += 0.9) sleepers.add(box(0.2, 0.06, 1.7, M.dark, x, 0.07, RAIL_Z));
  mergeRigid(sleepers);
  rail.add(sleepers);
  for (const sz of [-0.6, 0.6]) rail.add(box(X1 + 6, 0.07, 0.06, M.iron, (X1 - 6) / 2, 0.13, RAIL_Z + sz));
  const train = new THREE.Group();
  const trainWheels: THREE.Object3D[] = [];
  const addWheels = (x: number, r: number) => {
    for (const sz of [-0.6, 0.6]) {
      const w = spoked(r, M.iron);
      w.position.set(x, r + 0.16, sz);
      train.add(w);
      trainWheels.push(w);
    }
  };
  // locomotive in the manner of the 1830s: boiler, tall chimney, a single pair of driving wheels
  train.add(cyl(0.42, 2.0, M.iron, 'x', 0, 1.15, 0, 20), cyl(0.44, 0.06, M.brass, 'x', -0.6, 1.15, 0, 20), cyl(0.44, 0.06, M.brass, 'x', 0.5, 1.15, 0, 20));
  train.add(cyl(0.13, 1.1, M.iron, 'y', 0.8, 2.0, 0, 12, 0.16), cyl(0.16, 0.3, M.brass, 'y', -0.3, 1.7, 0, 12), box(0.8, 0.9, 1.3, M.iron, -1.3, 1.05, 0), box(3.0, 0.1, 1.2, M.oak, -0.2, 0.62, 0));
  addWheels(0.7, 0.3);
  addWheels(-0.2, 0.52);
  addWheels(-1.2, 0.3);
  for (let k = 0; k < 3; k++) {
    const wx = -3.4 - k * 2.3;
    train.add(box(2.0, 0.12, 1.3, M.oak, wx, 0.62, 0), box(2.0, 0.5, 0.06, M.pine, wx, 0.92, 0.62), box(2.0, 0.5, 0.06, M.pine, wx, 0.92, -0.62));
    for (let i = 0; i < 3; i++) train.add(box(0.56, 0.5, 1.1, k === 1 ? M.coal : M.cotton, wx - 0.62 + i * 0.62, 0.95, 0));
    addWheels(wx - 0.6, 0.26);
    addWheels(wx + 0.6, 0.26);
  }
  train.position.z = RAIL_Z;
  rail.add(train);
  group.add(rail);

  /** there-and-back motion: returns position 0..1 and the direction of travel */
  const shuttle = (t: number, period: number): [number, 1 | -1] => {
    const u = (t / period) % 2;
    return u < 1 ? [u, 1] : [2 - u, -1];
  };

  return {
    group,
    update(level, t) {
      const [cu, cd] = shuttle(t, 40);
      const cx = X0 + 3 + cu * (X1 - X0 - 6);
      cart.position.set(cx, 0, ROAD_Z);
      cart.rotation.y = cd > 0 ? 0 : Math.PI;
      for (const w of cartWheels) w.rotation.z = -(cx / 0.42) * cd;

      canal.visible = level >= 1;
      if (level >= 1) {
        const [bu, bd] = shuttle(t + 20, 90);
        const bx = -2 + bu * (X1 - 6);
        barge.position.set(bx, 0, CANAL_Z);
        barge.rotation.y = bd > 0 ? 0 : Math.PI;
        tow.position.set(bx + bd * 6, 0, CANAL_Z + 2.1);
        tow.rotation.y = bd > 0 ? 0 : Math.PI;
      }
      rail.visible = level >= 2;
      if (level >= 2) {
        const [tu, td] = shuttle(t + 7, 34);
        const tx = 4 + tu * (X1 - 10);
        train.position.x = tx;
        train.rotation.y = td > 0 ? 0 : Math.PI;
        train.position.z = RAIL_Z;
        for (const w of trainWheels) w.rotation.z = -(tx / 0.4) * td;
      }
    },
  };
}

function spoked(r: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r, 0.07, mat, 'z', 0, 0, 0, 16), box(r * 1.9, 0.05, 0.09, M.dark), box(0.05, r * 1.9, 0.09, M.dark));
  return g;
}

/** A draught horse as a plain block figure, facing +x. */
function horse(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 0.45, 0.4, M.horse, 0, 0.95, 0), box(0.3, 0.5, 0.26, M.horse, 0.6, 1.3, 0), box(0.4, 0.2, 0.22, M.horse, 0.82, 1.42, 0));
  for (const [dx, dz] of [[-0.4, -0.13], [-0.4, 0.13], [0.4, -0.13], [0.4, 0.13]]) g.add(box(0.1, 0.75, 0.1, M.horse, dx, 0.37, dz));
  g.position.set(x, 0, z);
  return g;
}
