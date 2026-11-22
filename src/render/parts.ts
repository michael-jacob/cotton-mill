import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Axis = 'x' | 'y' | 'z';
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

function std(color: number, roughness = 0.85, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Leather strap with a stitched joint, so belt motion is visible. */
export const beltTexture = canvasTex(128, 16, (c) => {
  c.fillStyle = '#6e4b2c';
  c.fillRect(0, 0, 128, 16);
  c.fillStyle = '#4a3019';
  c.fillRect(0, 0, 128, 2);
  c.fillRect(0, 14, 128, 2);
  c.fillRect(20, 0, 5, 16);
  c.fillStyle = '#8a6540';
  c.fillRect(84, 3, 3, 10);
});

/** Card clothing: leather set with rows of wire teeth. */
const cardTexture = canvasTex(64, 64, (c) => {
  c.fillStyle = '#7a5a3a';
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#c9c2b0';
  for (let y = 2; y < 64; y += 6) for (let x = (y % 12 === 2 ? 1 : 4); x < 64; x += 6) c.fillRect(x, y, 2, 2);
  c.fillStyle = '#3d2a18';
  c.fillRect(0, 0, 3, 64);
});
cardTexture.repeat.set(10, 4);

const flagTexture = canvasTex(64, 64, (c) => {
  c.fillStyle = '#8b867b';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#6f6a60';
  c.lineWidth = 2;
  c.strokeRect(1, 1, 62, 62);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.fillRect(6, 8, 30, 20);
});

const boardTexture = canvasTex(64, 64, (c) => {
  c.fillStyle = '#9a7a52';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#6d5435';
  c.lineWidth = 2;
  c.strokeRect(1, 1, 62, 62);
  c.strokeStyle = 'rgba(80,55,30,0.35)';
  c.lineWidth = 1;
  for (let x = 16; x < 64; x += 16) {
    c.beginPath();
    c.moveTo(x, 2);
    c.lineTo(x, 62);
    c.stroke();
  }
});

export const waterTexture = canvasTex(64, 64, (c) => {
  c.fillStyle = '#3d7ea3';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const x = (i * 23) % 64;
    const y = (i * 37) % 64;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + 6, y + 5, x + 2, y + 12);
    c.stroke();
  }
});

/** Calico printed with a small sprig pattern. */
const printTexture = canvasTex(64, 64, (c) => {
  c.fillStyle = '#f1ead8';
  c.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const px = x * 16 + (y % 2 ? 8 : 0) + 4;
      const py = y * 16 + 6;
      c.fillStyle = '#9c2f2a';
      c.fillRect(px, py, 5, 5);
      c.fillStyle = '#2f4f86';
      c.fillRect(px + 5, py + 5, 3, 3);
      c.fillStyle = '#4c7a3a';
      c.fillRect(px - 2, py + 6, 3, 2);
    }
});
printTexture.repeat.set(3, 3);

/** Shared materials: timber, iron, brass, leather and cotton. */
export const M = {
  oak: std(0x8a6238),
  pine: std(0xb89460),
  dark: std(0x4e3622),
  iron: std(0x33363a, 0.55, 0.55),
  steel: std(0x9a9fa6, 0.4, 0.75),
  brass: std(0xb08d3c, 0.4, 0.75),
  tin: std(0xc2c5c8, 0.35, 0.7),
  leather: std(0x6b4a2e),
  cotton: std(0xf4f1e8, 1),
  yarn: std(0xe9e0c6, 1),
  cloth: std(0xddd5bf, 1, 0, { side: THREE.DoubleSide }),
  printed: std(0xffffff, 1, 0, { map: printTexture, side: THREE.DoubleSide }),
  lye: std(0x7a5c33, 0.4),
  chemic: std(0xb9d6a8, 0.3),
  sour: std(0xd9cf7a, 0.3),
  rinse: std(0x6fa3c2, 0.25),
  madder: std(0x9c2f2a, 0.5),
  indigo: std(0x2f4f86, 0.5),
  weld: std(0xd0b040, 0.5),
  horse: std(0x5a3d28, 0.9),
  warpSheet: std(0xe9e0c6, 1, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
  web: std(0xffffff, 1, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
  brick: std(0x94553f, 1),
  copper: std(0xa9643a, 0.45, 0.7),
  coal: std(0x1c1c1e, 0.9),
  fire: std(0xff8a2a, 1, 0, { emissive: 0xff5a00, emissiveIntensity: 1.6 }),
  smoke: std(0x55504a, 1, 0, { transparent: true, opacity: 0.5, depthWrite: false }),
  stone: std(0x9c9484, 1),
  stoneDark: std(0x7d766a, 1),
  slate: std(0x4f545c, 0.9),
  glass: std(0x2c3e50, 0.3, 0.2),
  grass: std(0x73804f, 1),
  earth: std(0x6b5d45, 1),
  flag: std(0xffffff, 1, 0, { map: flagTexture }),
  boards: std(0xffffff, 1, 0, { map: boardTexture }),
  card: std(0xffffff, 0.9, 0.1, { map: cardTexture }),
  belt: std(0xffffff, 0.9, 0, { map: beltTexture, side: THREE.DoubleSide }),
  water: std(0xffffff, 0.25, 0.1, { map: waterTexture, transparent: true, opacity: 0.85 }),
  adult: std(0x34506b, 0.9),
  child: std(0xb5723a, 0.9),
  skin: std(0xe0b58f, 0.9),
};
export const floorTextures = { flag: flagTexture, boards: boardTexture };

export const LINE = {
  yarn: new THREE.LineBasicMaterial({ color: 0xf7f1dc }),
  cord: new THREE.LineBasicMaterial({ color: 0x3b2a1a }),
  band: new THREE.LineBasicMaterial({ color: 0x7a5a36 }),
};

/** Rotate a geometry built around +Y so its axis lies along the given world axis. */
export function bake<T extends THREE.BufferGeometry>(geo: T, axis: Axis): T {
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  return geo;
}

export function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

export function cyl(
  r: number,
  len: number,
  m: THREE.Material,
  axis: Axis = 'y',
  x = 0,
  y = 0,
  z = 0,
  seg = 20,
  rTop = r,
): THREE.Mesh {
  const mesh = new THREE.Mesh(bake(new THREE.CylinderGeometry(rTop, r, len, seg), axis), m);
  mesh.position.set(x, y, z);
  return mesh;
}

const Y = V(0, 1, 0);
/** Stretch a unit rod (made by `rod`) between two points. */
export function setRod(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a);
  const len = d.length() || 1e-6;
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.y = len;
  mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
}

export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 8): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), m);
  setRod(mesh, a, b);
  return mesh;
}

/** A square-section timber between two points. */
export function beam(a: THREE.Vector3, b: THREE.Vector3, t: number, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, 1, t), m);
  setRod(mesh, a, b);
  return mesh;
}

function ringGeo(rOut: number, rIn: number, w: number, seg = 48): THREE.BufferGeometry {
  const h = w / 2;
  const pts = [
    new THREE.Vector2(rIn, -h),
    new THREE.Vector2(rOut, -h),
    new THREE.Vector2(rOut, h),
    new THREE.Vector2(rIn, h),
    new THREE.Vector2(rIn, -h),
  ];
  return new THREE.LatheGeometry(pts, seg);
}

export function ring(rOut: number, rIn: number, w: number, m: THREE.Material, axis: Axis, seg = 48): THREE.Mesh {
  return new THREE.Mesh(bake(ringGeo(rOut, rIn, w, seg), axis), m);
}

export interface WheelOpts {
  r: number;
  rimT: number;
  rimW: number;
  spokes: number;
  hubR: number;
  hubLen: number;
  spokeT: number;
  m: THREE.Material;
  axis: Axis;
}

function wheelGeo(o: Omit<WheelOpts, 'm' | 'axis'>): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [ringGeo(o.r, o.r - o.rimT, o.rimW), new THREE.CylinderGeometry(o.hubR, o.hubR, o.hubLen, 12)];
  const L = o.r - o.rimT - o.hubR + 0.01;
  for (let i = 0; i < o.spokes; i++) {
    const g = new THREE.BoxGeometry(L, o.spokeT, o.spokeT);
    g.translate(o.hubR + L / 2 - 0.005, 0, 0);
    g.rotateY((i / o.spokes) * TAU);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

/** A spoked wheel or pulley as a single mesh. Spin it with rotation[axis]. */
export function spokedWheel(o: WheelOpts): THREE.Mesh {
  return new THREE.Mesh(bake(wheelGeo(o), o.axis), o.m);
}

/** Pitch radius of a gear with N teeth at the given circular pitch. */
export const pitchR = (teeth: number, pitch: number) => (teeth * pitch) / TAU;

/** Spur gear. A tooth sits at local +X before baking; see meshPhase. */
export function spurGear(teeth: number, pitch: number, width: number, m: THREE.Material, axis: Axis): THREE.Mesh {
  const r = pitchR(teeth, pitch);
  const th = pitch * 0.62;
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(r - th / 2, r - th / 2, width, Math.max(16, teeth))];
  for (let i = 0; i < teeth; i++) {
    const g = new THREE.BoxGeometry(th, width, pitch * 0.48);
    g.translate(r, 0, 0);
    g.rotateY((i / teeth) * TAU);
    parts.push(g);
  }
  return new THREE.Mesh(bake(mergeGeometries(parts)!, axis), m);
}

/**
 * Bevel gear. The pitch circle lies in the plane through the mesh origin, and
 * the pitch-cone apex is apexDist along the axis (towards +axis if apexSign is 1).
 * Two bevels mesh when they share an apex and a circular pitch.
 */
export function bevelGear(
  teeth: number,
  pitch: number,
  face: number,
  apexDist: number,
  m: THREE.Material,
  axis: Axis,
  apexSign: 1 | -1,
  rInner?: number,
): THREE.Mesh {
  const r = pitchR(teeth, pitch);
  const delta = Math.atan2(r, apexDist);
  const sd = Math.sin(delta);
  const cd = Math.cos(delta);
  const th = pitch * 0.62;
  const parts: THREE.BufferGeometry[] = [];
  const basis = new THREE.Matrix4().makeBasis(V(0, 0, 1), V(cd, sd, 0), V(-sd, cd, 0));
  basis.setPosition(r - (sd * face) / 2, (cd * face) / 2, 0);
  for (let i = 0; i < teeth; i++) {
    const g = new THREE.BoxGeometry(pitch * 0.48, th, face);
    g.applyMatrix4(basis);
    g.rotateY((i / teeth) * TAU);
    parts.push(g);
  }
  // Root cone and backing.
  const ox = r - (cd * th) / 2;
  const oy = -(sd * th) / 2;
  const ix = r - sd * face - (cd * th) / 2;
  const iy = cd * face - (sd * th) / 2;
  const bottom = Math.min(oy, iy) - Math.max(0.03, pitch * 0.6);
  const rin = Math.max(0.001, Math.min(rInner ?? ix - 0.02, ix - 0.005));
  const pts = [
    new THREE.Vector2(rin, bottom),
    new THREE.Vector2(ox, bottom),
    new THREE.Vector2(ox, oy),
    new THREE.Vector2(ix, iy),
    new THREE.Vector2(rin, iy),
    new THREE.Vector2(rin, bottom),
  ];
  parts.push(new THREE.LatheGeometry(pts, Math.max(24, teeth)));
  const geo = mergeGeometries(parts)!;
  if (apexSign < 0) geo.rotateX(Math.PI);
  return new THREE.Mesh(bake(geo, axis), m);
}

/**
 * Rotation (about `axis`) that puts a tooth, or a gap, of a gear built by
 * spurGear/bevelGear in the world direction `dir` from the gear's centre.
 */
export function meshPhase(axis: Axis, dir: THREE.Vector3, teeth: number, gap: boolean): number {
  let e0: THREE.Vector3;
  let e1: THREE.Vector3;
  if (axis === 'x') {
    e0 = V(0, -1, 0);
    e1 = V(0, 0, -1);
  } else if (axis === 'y') {
    e0 = V(1, 0, 0);
    e1 = V(0, 0, -1);
  } else {
    e0 = V(1, 0, 0);
    e1 = V(0, 1, 0);
  }
  return Math.atan2(dir.dot(e1), dir.dot(e0)) + (gap ? Math.PI / teeth : 0);
}

export interface Circle {
  /** position along the horizontal axis of the belt plane */
  h: number;
  y: number;
  r: number;
}

/** Closed path of a belt round two pulleys, in (h, y) coordinates. */
export function beltPath(c1: Circle, c2: Circle, crossed = false, seg = 12): [number, number][] {
  const dh = c2.h - c1.h;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dh, dy);
  const phi = Math.atan2(dy, dh);
  const pts: [number, number][] = [];
  if (!crossed) {
    const beta = Math.acos(Math.max(-1, Math.min(1, (c1.r - c2.r) / d)));
    for (let i = 0; i <= seg; i++) {
      const a = phi + beta + ((TAU - 2 * beta) * i) / seg;
      pts.push([c1.h + c1.r * Math.cos(a), c1.y + c1.r * Math.sin(a)]);
    }
    for (let i = 0; i <= seg; i++) {
      const a = phi - beta + (2 * beta * i) / seg;
      pts.push([c2.h + c2.r * Math.cos(a), c2.y + c2.r * Math.sin(a)]);
    }
  } else {
    const beta = Math.acos(Math.max(-1, Math.min(1, (c1.r + c2.r) / d)));
    for (let i = 0; i <= seg; i++) {
      const a = phi + beta + ((TAU - 2 * beta) * i) / seg;
      pts.push([c1.h + c1.r * Math.cos(a), c1.y + c1.r * Math.sin(a)]);
    }
    for (let i = 0; i <= seg; i++) {
      const a = phi + Math.PI - beta - ((TAU - 2 * beta) * i) / seg;
      pts.push([c2.h + c2.r * Math.cos(a), c2.y + c2.r * Math.sin(a)]);
    }
  }
  pts.push(pts[0]);
  return pts;
}

/**
 * A flat belt as a ribbon. `plane` says which world axis the pulleys' shafts
 * lie along: 'x' puts the belt in the z-y plane at x = offset, 'z' in the x-y plane.
 */
export function belt(c1: Circle, c2: Circle, plane: 'x' | 'z', offset: number, width: number, crossed = false): THREE.Mesh {
  const pts = beltPath(c1, c2, crossed);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (const s of [-1, 1]) {
      const o = offset + (s * width) / 2;
      if (plane === 'x') pos.push(o, pts[i][1], pts[i][0]);
      else pos.push(pts[i][0], pts[i][1], o);
      uv.push(len / 0.6, s < 0 ? 0 : 1);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, M.belt);
}

/** A thin cord or band round two pulleys, drawn as a line loop. */
export function band(c1: Circle, c2: Circle, plane: 'x' | 'z', offset: number, crossed = false, mat = LINE.band): THREE.Line {
  const pts = beltPath(c1, c2, crossed, 8).map(([h, y]) => (plane === 'x' ? V(offset, y, h) : V(h, y, offset)));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

export function lines(points: THREE.Vector3[], mat: THREE.LineBasicMaterial): THREE.LineSegments {
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), mat);
}

/** Line segments rewritten every frame (yarn, cords). */
export class DynLines {
  readonly obj: THREE.LineSegments;
  private pos: Float32Array;
  private attr: THREE.BufferAttribute;
  private n = 0;
  constructor(maxSegments: number, mat: THREE.LineBasicMaterial) {
    this.pos = new Float32Array(maxSegments * 6);
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    this.obj = new THREE.LineSegments(g, mat);
    this.obj.frustumCulled = false;
  }
  begin(): void {
    this.n = 0;
  }
  seg(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    if (this.n + 6 > this.pos.length) return;
    const p = this.pos;
    p[this.n++] = ax;
    p[this.n++] = ay;
    p[this.n++] = az;
    p[this.n++] = bx;
    p[this.n++] = by;
    p[this.n++] = bz;
  }
  end(): void {
    this.attr.needsUpdate = true;
    this.obj.geometry.setDrawRange(0, this.n / 3);
  }
}

/** Workers are shown as plain markers: a peg with a head. */
export function worker(kind: 'adult' | 'child' = 'adult'): THREE.Group {
  const g = new THREE.Group();
  const s = kind === 'adult' ? 1 : 0.75;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 1.0 * s, 10), kind === 'adult' ? M.adult : M.child);
  body.position.y = 0.5 * s;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 12, 8), M.skin);
  head.position.y = 1.15 * s;
  g.add(body, head);
  return g;
}

/** Piecewise-linear interpolation through [u, value] knots. */
export function pw(u: number, knots: [number, number][]): number {
  if (u <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (u <= knots[i][0]) {
      const [u0, v0] = knots[i - 1];
      const [u1, v1] = knots[i];
      return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
    }
  }
  return knots[knots.length - 1][1];
}

export const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

export interface PartLabel {
  name: string;
  desc: string;
  p: THREE.Vector3;
}

export interface MachineModel {
  group: THREE.Group;
  /** t is seconds of running time; fill is a 0..1 cosmetic progress value */
  animate(t: number, fill: number): void;
  labels: PartLabel[];
  workers: THREE.Object3D[];
  /** driven pulley for the belt from the line shaft (local coordinates) */
  pulley?: { x: number; y: number; z: number; r: number };
  height: number;
}

export function shadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mat = (o as THREE.Mesh).material as THREE.Material;
      o.castShadow = !mat.transparent;
      o.receiveShadow = true;
    }
  });
}

// ---------------------------------------------------------------------------
// Draw-call reduction
//
// A machine is built from hundreds of small meshes, most of which never move
// relative to their neighbours. optimizeModel finds out which objects a
// model's animate() actually moves, then merges everything that moves as one
// rigid body into a single mesh per material.
// ---------------------------------------------------------------------------

/** For each kind of model, the traversal indices of the objects its animation moves. */
const movingCache = new Map<string, number[]>();

function listObjects(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root) out.push(o);
  });
  return out;
}

function findMoving(model: MachineModel, objs: THREE.Object3D[]): number[] {
  const snap = () =>
    objs.map((o) => {
      o.updateMatrix();
      return { m: o.matrix.clone(), v: o.visible };
    });
  model.animate(0, 0);
  const base = snap();
  const moving = new Set<number>();
  // sample densely over forty seconds so every phase of the slowest cycle is seen
  for (let i = 1; i <= 300; i++) {
    model.animate(i * 0.137, (i % 10) / 10);
    for (let k = 0; k < objs.length; k++) {
      if (moving.has(k)) continue;
      const o = objs[k];
      o.updateMatrix();
      const a = o.matrix.elements;
      const b = base[k].m.elements;
      let same = o.visible === base[k].v;
      for (let e = 0; same && e < 16; e++) if (Math.abs(a[e] - b[e]) > 1e-9) same = false;
      if (!same) moving.add(k);
    }
  }
  return [...moving];
}

function mergeable(geo: THREE.BufferGeometry): boolean {
  const names = Object.keys(geo.attributes);
  return names.length === 3 && !!geo.attributes.position && !!geo.attributes.normal && !!geo.attributes.uv;
}

/**
 * Merge every mesh under `root` that is rigidly attached to it into one mesh
 * per material. Objects in `moving` (and whatever hangs from them) are left
 * as separate bodies, each merged within itself in the same way.
 */
export function mergeRigid(root: THREE.Object3D, moving: Set<THREE.Object3D> = new Set()): void {
  const mergeBody = (body: THREE.Object3D) => {
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const gone: THREE.Mesh[] = [];
    const walk = (node: THREE.Object3D, toBody: THREE.Matrix4) => {
      for (const c of [...node.children]) {
        if (moving.has(c)) {
          mergeBody(c);
          continue;
        }
        c.updateMatrix();
        const m = toBody.clone().multiply(c.matrix);
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.children.length === 0 && mergeable(mesh.geometry)) {
          const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
          g.applyMatrix4(m);
          const list = byMat.get(mesh.material) ?? [];
          list.push(g);
          byMat.set(mesh.material, list);
          gone.push(mesh);
        } else {
          walk(c, m);
        }
      }
    };
    walk(body, new THREE.Matrix4());
    for (const mesh of gone) mesh.removeFromParent();
    for (const [mat, geos] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      if (merged) body.add(new THREE.Mesh(merged, mat));
    }
  };
  mergeBody(root);
}

/**
 * Merge the rigid parts of a machine model. `kind` identifies models built by
 * the same code with the same options, so the motion analysis is done once.
 */
export function optimizeModel(model: MachineModel, kind: string): void {
  const objs = listObjects(model.group);
  let idx = movingCache.get(kind);
  if (!idx) {
    idx = findMoving(model, objs);
    movingCache.set(kind, idx);
  }
  const moving = new Set<THREE.Object3D>(idx.map((i) => objs[i]));
  for (const w of model.workers) moving.add(w); // the scene shows and hides these
  mergeRigid(model.group, moving);
}

// ---------------------------------------------------------------------------
// Releasing GPU resources
//
// Geometry belongs to the model that built it. Materials and textures in M and
// LINE (and the textures those materials use) are shared by everything and
// live for the whole session; any other material was cloned for one model and
// goes with it.
// ---------------------------------------------------------------------------

const sharedMaterials = new Set<THREE.Material>([...Object.values(M), ...Object.values(LINE)]);
const sharedTextures = new Set<THREE.Texture>();
for (const m of Object.values(M)) if (m.map) sharedTextures.add(m.map);

/** Free the geometry (and any materials of its own) of everything under an object that is being discarded. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const mat of mats) {
      if (sharedMaterials.has(mat)) continue;
      const map = (mat as THREE.MeshStandardMaterial).map;
      if (map && !sharedTextures.has(map)) map.dispose();
      mat.dispose();
    }
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  });
}
