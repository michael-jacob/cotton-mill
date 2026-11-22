import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLOOR_H } from '../sim/machines';
import { M, V, bake, beam, bevelGear, box, cyl, mergeRigid, meshPhase, pitchR, ring, rod, waterTexture, type PartLabel } from './parts';

/**
 * Geometry of the mill's power train (world coordinates, metres).
 *
 * A breast-shot wheel turns at about 6 rpm. On the same axle, inside the
 * mill, the pit wheel (80 cogs) drives the wallower (20) on the upright
 * shaft, which therefore turns at 24 rpm. At the top a crown wheel (40)
 * drives a pinion (20) on the line shaft, which runs at 48 rpm.
 */
export const PT = {
  xw: -1.5, // wheel centre x
  ya: 1.5, // axle height
  zc: 4, // centre line of wheel, upright shaft and line shaft
  R: 2.2, // wheel radius
  xs: 1.2, // upright shaft x
  yl: 3.5, // line shaft height
  pitch: 0.09,
  N1: 80,
  N2: 20,
  N3: 40,
  N4: 20,
  drumR: 0.2,
  /** wheel revolutions per second at rated speed (6 rpm) */
  wheelRps: 0.1,
};
/** line shaft turns per wheel turn */
export const LINE_RATIO = (PT.N1 / PT.N2) * (PT.N3 / PT.N4);

const TAU = Math.PI * 2;

function flowMaterial(repX: number, repY: number) {
  const tex = waterTexture.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repX, repY);
  const mat = M.water.clone();
  mat.map = tex;
  return { mat, tex };
}

export interface PowerTrain {
  group: THREE.Group;
  /** the rotating line shaft on each floor; machine drums are added to these */
  lineShafts: THREE.Group[];
  /** everything belonging to one storey (its shafting and beams), so storeys can be hidden */
  floorGroups: THREE.Group[];
  /** angle: wheel rotation in radians (magnitude). flow: 0..1 river flow. dt in seconds. */
  animate(angle: number, flow: number, dt: number): void;
  labels: PartLabel[];
  bounds: THREE.Box3;
}

/**
 * millW is the length of the mill floor; the line shafts run almost to its end.
 * The upright shaft rises through every storey and drives a line shaft on each.
 * A mill without a wheel is driven from the far end of its ground-floor shaft by the engine.
 */
export function buildPowerTrain(millW: number, floors = 1, withWheel = true): PowerTrain {
  const shaftEnd = millW - 0.3;
  const { xw, ya, zc, R, xs, yl, pitch } = PT;
  const r1 = pitchR(PT.N1, pitch);
  const r2 = pitchR(PT.N2, pitch);
  const r3 = pitchR(PT.N3, pitch);
  const r4 = pitchR(PT.N4, pitch);
  const group = new THREE.Group();

  // ---- water wheel (rotates about x) ----
  const wg = new THREE.Group(); // wheel, launder and races
  if (withWheel) group.add(wg);
  const wheel = new THREE.Group();
  wheel.position.set(xw, ya, zc);
  wg.add(wheel);

  const axleEnd = xs - r2 + 0.14 - xw;
  wheel.add(cyl(0.2, axleEnd + 0.95, M.oak, 'x', (axleEnd - 0.95) / 2, 0, 0, 8));
  for (const sx of [-0.62, 0.62]) {
    const shroud = ring(R, R - 0.48, 0.07, M.oak, 'x', 64);
    shroud.position.x = sx;
    wheel.add(shroud);
    wheel.add(cyl(0.3, 0.12, M.iron, 'x', sx * 0.8, 0, 0, 16));
  }
  const sole = ring(R - 0.44, R - 0.48, 1.24, M.pine, 'x', 64);
  wheel.add(sole);

  const NB = 32;
  const floats: THREE.BufferGeometry[] = [];
  for (let i = 0; i < NB; i++) {
    const g = new THREE.BoxGeometry(1.2, 0.46, 0.035);
    g.rotateX(-0.45);
    g.translate(0, R - 0.24, 0);
    g.rotateX((i / NB) * TAU);
    floats.push(g);
  }
  wheel.add(new THREE.Mesh(mergeGeometries(floats)!, M.pine));

  const arms: THREE.BufferGeometry[] = [];
  for (const sx of [-0.5, 0.5]) {
    for (let i = 0; i < 8; i++) {
      const g = new THREE.BoxGeometry(0.1, R - 0.6, 0.12);
      g.translate(sx, (R - 0.6) / 2 + 0.15, 0);
      g.rotateX((i / 8) * TAU);
      arms.push(g);
    }
  }
  wheel.add(new THREE.Mesh(mergeGeometries(arms)!, M.oak));

  // Water carried in the buckets on the falling side.
  const bucketWater: THREE.Mesh[] = [];
  const bw = flowMaterial(1, 1).mat;
  for (let i = 0; i < NB; i++) {
    const a = ((i + 0.5) / NB) * TAU;
    const m = box(1.16, 0.2, 0.3, bw);
    m.position.set(0, Math.cos(a) * (R - 0.2), Math.sin(a) * (R - 0.2));
    m.rotation.x = a;
    m.userData.a = a;
    wheel.add(m);
    bucketWater.push(m);
  }

  // Pit wheel: iron bevel ring on timber arms, on the wheel's own axle.
  const pit = new THREE.Group();
  pit.position.x = xs - r2 - xw;
  pit.rotation.x = meshPhase('x', V(0, 1, 0), PT.N1, false);
  pit.add(bevelGear(PT.N1, pitch, 0.13, r2, M.iron, 'x', 1, r1 - 0.24));
  const pitArms: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.BoxGeometry(0.09, r1 - 0.2, 0.11);
    g.translate(-0.07, (r1 - 0.2) / 2 + 0.12, 0);
    g.rotateX((i / 6) * TAU);
    pitArms.push(g);
  }
  pit.add(new THREE.Mesh(mergeGeometries(pitArms)!, M.oak));
  pit.add(cyl(0.28, 0.2, M.iron, 'x', -0.07, 0, 0, 16));
  wheel.add(pit);

  // ---- upright shaft (rotates about y), with a line shaft (rotates about x) on every floor ----
  const topY = yl - r4;
  const x0 = xs + r3 - 0.06;
  const floorGroups: THREE.Group[] = [];
  const uprights: THREE.Group[] = [];
  const lineShafts: THREE.Group[] = [];
  const beams = [2.05];
  for (let x = 6; x < millW - 1.5; x += 4) beams.push(x);
  beams.push(millW - 0.45);
  for (let f = 0; f < floors; f++) {
    const fg = new THREE.Group();
    fg.position.y = f * FLOOR_H;
    group.add(fg);
    floorGroups.push(fg);

    const upright = new THREE.Group();
    upright.position.set(xs, 0, zc);
    fg.add(upright);
    uprights.push(upright);
    // this storey's length of shaft: it ends at the crown wheel on the top floor
    const y0 = f === 0 ? 0.3 : -0.2;
    const y1 = f === floors - 1 ? topY + 0.05 : FLOOR_H - 0.2;
    upright.add(cyl(0.07, y1 - y0, M.iron, 'y', 0, (y0 + y1) / 2, 0, 6));
    if (f === 0 && withWheel) {
      const wallower = bevelGear(PT.N2, pitch, 0.13, r1, M.iron, 'y', -1, 0.06);
      wallower.position.y = ya + r1;
      wallower.rotation.y = meshPhase('y', V(-1, 0, 0), PT.N2, true);
      upright.add(wallower);
    }
    const crown = bevelGear(PT.N3, pitch, 0.11, r4, M.iron, 'y', 1, 0.06);
    crown.position.y = topY;
    crown.rotation.y = meshPhase('y', V(1, 0, 0), PT.N3, false);
    upright.add(crown);
    // Collars with a key so the shaft's turning shows.
    for (const y of [0.6, 1.6, 2.2]) {
      upright.add(cyl(0.1, 0.08, M.iron, 'y', 0, y, 0, 12), box(0.05, 0.08, 0.26, M.steel, 0, y, 0));
    }

    const lineShaft = new THREE.Group();
    lineShaft.position.set(0, yl, zc);
    fg.add(lineShaft);
    lineShafts.push(lineShaft);
    lineShaft.add(cyl(0.05, shaftEnd - x0, M.steel, 'x', (shaftEnd + x0) / 2, 0, 0, 10));
    const pinion = bevelGear(PT.N4, pitch, 0.11, r3, M.iron, 'x', -1, 0.05);
    pinion.position.x = xs + r3;
    pinion.rotation.x = meshPhase('x', V(0, -1, 0), PT.N4, true);
    lineShaft.add(pinion);
    for (let x = 3; x < shaftEnd - 1.2; x += 2) {
      lineShaft.add(cyl(0.085, 0.14, M.iron, 'x', x, 0, 0, 12), box(0.05, 0.2, 0.05, M.steel, x, 0, 0));
    }

    // Tie beams and hangers carrying the shaft.
    for (const x of beams) {
      fg.add(box(0.2, 0.24, 2 * zc + 0.5, M.oak, x, 4.12, zc));
      fg.add(box(0.16, 0.18, 0.22, M.iron, x, yl, zc));
      fg.add(rod(V(x, 4.0, zc - 0.08), V(x, yl + 0.08, zc - 0.08), 0.018, M.iron));
      fg.add(rod(V(x, 4.0, zc + 0.08), V(x, yl + 0.08, zc + 0.08), 0.018, M.iron));
    }
    // Bearing of the upright shaft, bracketed off the first beam.
    fg.add(beam(V(2.05, 4.0, zc), V(xs, topY - 0.35, zc + 0.01), 0.07, M.iron));
    fg.add(box(0.2, 0.1, 0.2, M.brass, xs, topY - 0.38, zc));
  }
  // Footstep bearing.
  group.add(box(0.5, 0.3, 0.5, M.stoneDark, xs, 0.15, zc), box(0.24, 0.1, 0.24, M.brass, xs, 0.33, zc));

  // ---- wheel pit masonry, launder and sluice ----
  wg.add(box(0.5, ya + 0.9, 0.7, M.stoneDark, xw - 1.0, (ya - 1.3) / 2, zc));
  wg.add(box(0.3, 0.16, 0.4, M.brass, xw - 1.0, ya - 0.12, zc));

  const zEnd = zc - R - 0.03; // the launder stops just short of the wheel
  const zStart = -16;
  const L = zEnd - zStart;
  const zMid = (zEnd + zStart) / 2;
  wg.add(box(1.34, 0.08, L, M.oak, xw, 1.72, zMid));
  for (const sx of [-0.64, 0.64]) wg.add(box(0.06, 0.42, L, M.oak, xw + sx, 1.93, zMid));
  const launderWater = flowMaterial(1, 12);
  wg.add(box(1.2, 0.2, L, launderWater.mat, xw, 1.86, zMid));
  for (let z = -15; z < 0.5; z += 2.5) {
    for (const sx of [-0.58, 0.58]) wg.add(box(0.12, 1.68, 0.12, M.oak, xw + sx, 0.84, z));
    wg.add(box(1.5, 0.12, 0.14, M.oak, xw, 1.62, z));
    wg.add(beam(V(xw - 0.58, 0.3, z), V(xw + 0.58, 1.5, z), 0.06, M.oak));
  }
  // Sluice gate.
  for (const sx of [-0.72, 0.72]) wg.add(box(0.1, 1.4, 0.1, M.oak, xw + sx, 2.4, zEnd - 0.1));
  wg.add(box(1.6, 0.1, 0.12, M.oak, xw, 3.1, zEnd - 0.1));
  const gate = box(1.22, 0.5, 0.05, M.dark, xw, 2.45, zEnd - 0.1);
  wg.add(gate);
  wg.add(rod(V(xw, 2.6, zEnd - 0.1), V(xw, 3.35, zEnd - 0.1), 0.025, M.iron));
  // Water spilling onto the wheel.
  const spill = flowMaterial(1, 1);
  const spillMesh = box(1.16, 0.1, 0.5, spill.mat, xw, 1.72, zEnd + 0.1);
  spillMesh.rotation.x = 0.7;
  wg.add(spillMesh);

  // Tail race.
  const tail = flowMaterial(2, 28);
  const tailMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 39.2), tail.mat);
  tailMesh.rotation.x = -Math.PI / 2;
  tailMesh.position.set(xw, -0.6, 20.4);
  wg.add(tailMesh);

  const labels: PartLabel[] = [
    { name: 'Breast wheel', desc: 'Water enters at axle height and its weight carries the buckets down. About 6 turns a minute.', p: V(xw - 0.7, ya + 1.2, zc + 1.2) },
    { name: 'Launder and sluice', desc: 'A timber trough brings water from upstream; the gate sets how much reaches the wheel.', p: V(xw, 2.5, zEnd - 0.1) },
    { name: 'Pit wheel', desc: `${PT.N1} cogs, on the wheel's own axle.`, p: V(xs - r2, ya - r1 * 0.7, zc + r1 * 0.7) },
    { name: 'Wallower', desc: `${PT.N2} cogs. Turns the drive through a right angle and quadruples its speed.`, p: V(xs, ya + r1 + 0.1, zc + r2) },
    { name: 'Upright shaft', desc: 'Carries power up to the working floors at 24 turns a minute.', p: V(xs, 2.0, zc) },
    { name: 'Crown wheel and pinion', desc: `${PT.N3} cogs driving ${PT.N4}: the line shaft runs at 48 turns a minute.`, p: V(xs + r3, topY + 0.1, zc + 0.2) },
    { name: 'Line shaft', desc: 'Runs the length of the mill. Each machine takes its drive from a drum by a leather strap.', p: V(8, yl, zc) },
    { name: 'Tail race', desc: 'Spent water returns to the river.', p: V(xw, -0.55, zc + 4) },
  ];

  const bounds = new THREE.Box3(V(xw - 1.2, -1, zc - R - 0.3), V(xs + 1.0, 4.0, zc + R + 0.3));

  function animate(angle: number, flow: number, dt: number) {
    const a = -angle; // the wheel turns so its upstream side falls
    wheel.rotation.x = a;
    for (const u of uprights) u.rotation.y = a * (PT.N1 / PT.N2);
    for (const l of lineShafts) l.rotation.x = a * LINE_RATIO;
    for (const b of bucketWater) {
      const phi = b.userData.a + a;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      b.visible = flow > 0.05 && s < -0.1 && c < 0.3 && c > -0.93;
    }
    launderWater.tex.offset.y += dt * 0.5 * flow;
    tail.tex.offset.y += dt * 0.35 * flow;
    spill.tex.offset.y += dt * 1.5 * flow;
    gate.position.y = 2.25 + 0.3 * flow;
  }

  // everything but the turning parts becomes a handful of meshes
  mergeRigid(group, new Set<THREE.Object3D>([wg, wheel, gate, ...bucketWater, ...floorGroups, ...uprights, ...lineShafts]));

  return { group, lineShafts, floorGroups, animate, labels, bounds };
}

// Re-export for callers that only need to orient geometry.
export { bake };
