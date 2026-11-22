import * as THREE from 'three';
import { M, V, box, cyl, spokedWheel, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;

function sheet(pts: THREE.Vector3[], mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const idx: number[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/**
 * Radcliffe's dressing frame. Warp is drawn from beams at both ends, through
 * size troughs, past revolving brushes and over a fan, and wound dry onto the
 * loom beam at the centre.
 */
export function buildDressingFrame(): MachineModel {
  const g = new THREE.Group();
  const HW = 0.6; // half width of the warp (along z)

  // frame: long rails and a taller headstock at the centre
  for (const sz of [-0.72, 0.72]) {
    g.add(box(3.7, 0.07, 0.07, M.oak, 0, 0.9, sz), box(3.7, 0.07, 0.07, M.oak, 0, 0.08, sz));
    for (const x of [-1.8, -1.0, 1.0, 1.8]) g.add(box(0.08, 0.9, 0.08, M.oak, x, 0.45, sz));
    g.add(box(0.1, 1.6, 0.1, M.oak, -0.28, 0.8, sz), box(0.1, 1.6, 0.1, M.oak, 0.28, 0.8, sz), box(0.66, 0.08, 0.1, M.oak, 0, 1.58, sz));
  }

  const turning: { o: THREE.Object3D; k: number }[] = [];
  for (const s of [-1, 1]) {
    // warper's beams at the end
    for (const [dx, y] of [[1.72, 0.5], [1.5, 0.82]] as [number, number][]) {
      const b = cyl(0.15, 2 * HW, M.yarn, 'z', s * dx, y, 0, 16);
      g.add(b, cyl(0.03, 1.5, M.dark, 'z', s * dx, y, 0, 8));
      turning.push({ o: b, k: s * 0.25 });
    }
    // size trough with its roller, and the squeezing roller above
    g.add(box(0.36, 0.22, 1.36, M.copper, s * 1.15, 0.72, 0), box(0.3, 0.02, 1.3, M.sour, s * 1.15, 0.83, 0));
    const dip = cyl(0.07, 2 * HW + 0.06, M.steel, 'z', s * 1.15, 0.8, 0, 12);
    const squeeze = cyl(0.06, 2 * HW + 0.06, M.leather, 'z', s * 1.15, 0.94, 0, 12);
    g.add(dip, squeeze);
    turning.push({ o: dip, k: s * 0.6 }, { o: squeeze, k: -s * 0.7 });
    // brushes working the size into the yarn, above and below
    for (const y of [0.96, 1.14]) {
      const brush = cyl(0.08, 2 * HW + 0.06, M.dark, 'z', s * 0.72, y, 0, 10);
      brush.add(box(0.17, 0.02, 2 * HW, M.pine), box(0.02, 0.17, 2 * HW, M.pine));
      g.add(brush);
      turning.push({ o: brush, k: -s * 2.5 });
    }
    // the warp: off the beams, through the trough, between the brushes, up to the beam
    g.add(sheet([V(s * 1.6, 0.96, -HW), V(s * 1.6, 0.96, HW), V(s * 1.2, 0.87, -HW), V(s * 1.2, 0.87, HW), V(s * 1.1, 0.87, -HW), V(s * 1.1, 0.87, HW), V(s * 0.72, 1.05, -HW), V(s * 0.72, 1.05, HW), V(s * 0.12, 1.3, -HW), V(s * 0.12, 1.3, HW)], M.warpSheet));
  }
  // fan beneath, drying the sized yarn
  const fan = new THREE.Group();
  fan.position.set(0, 0.6, 0);
  fan.add(cyl(0.025, 1.6, M.steel, 'z', 0, 0, 0, 8));
  for (let i = 0; i < 4; i++) {
    const blade = box(0.34, 0.02, 1.1, M.tin, 0.19, 0, 0);
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * TAU;
    arm.add(blade);
    fan.add(arm);
  }
  g.add(fan);
  // the loom beam, filling at the centre
  const beam = cyl(0.11, 2 * HW, M.yarn, 'z', 0, 1.32, 0, 18);
  g.add(beam, cyl(0.03, 1.56, M.dark, 'z', 0, 1.32, 0, 8));
  for (const sz of [-HW - 0.02, HW + 0.02]) g.add(cyl(0.2, 0.02, M.iron, 'z', 0, 1.32, sz, 20));

  // side shaft from the driving pulley, with bevels to each motion
  const shaft = new THREE.Group();
  shaft.position.set(0, 0.45, -0.86);
  shaft.add(cyl(0.02, 3.9, M.steel, 'x', 0.05, 0, 0, 8));
  const PX = 1.98;
  shaft.add(spokedWheel({ r: 0.16, rimT: 0.022, rimW: 0.08, spokes: 4, hubR: 0.035, hubLen: 0.08, spokeT: 0.022, m: M.iron, axis: 'x' }).translateX(PX));
  for (const x of [-1.15, -0.72, 0, 0.72, 1.15]) shaft.add(cyl(0.05, 0.04, M.iron, 'x', x, 0, 0, 10));
  g.add(shaft);

  const a = worker('adult');
  a.position.set(0.1, 0, 0.98);
  const b = worker('child');
  b.position.set(-1.6, 0, 0.98);
  g.add(a, b);

  return {
    group: g,
    height: 1.7,
    workers: [a, b],
    pulley: { x: PX, y: 0.45, z: -0.86, r: 0.16 },
    labels: [
      { name: "Warper's beams", desc: 'Twist from the throstles, wound on beams by the warping mill. Half the warp comes from each end.', p: V(-1.6, 1.0, 0.3) },
      { name: 'Size trough', desc: 'Boiling flour paste, kept hot by steam. A roller dips the yarn and another squeezes it.', p: V(-1.15, 0.97, -0.3) },
      { name: 'Brushes', desc: 'Lay the loose fibres and work the size into the thread, as the weaver did by hand.', p: V(-0.72, 1.2, 0.2) },
      { name: 'Fan', desc: 'Dries the sized warp before it reaches the beam.', p: V(0, 0.75, 0.3) },
      { name: 'Loom beam', desc: 'The two half-warps meet and are wound on together, ready for the loom.', p: V(0, 1.45, 0) },
      { name: 'Driving pulley', desc: 'Strap from the line shaft.', p: V(PX, 0.62, -0.86) },
    ],
    animate(t) {
      const w = t * TAU;
      for (const r of turning) r.o.rotation.z = w * r.k;
      fan.rotation.z = w * 3.2;
      shaft.rotation.x = w * 1.2;
      const fill = 1 + 0.8 * ((t / 40) % 1);
      beam.scale.set(fill, fill, 1);
      beam.rotation.z = w * 0.3;
    },
  };
}
