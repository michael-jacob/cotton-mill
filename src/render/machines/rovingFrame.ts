import * as THREE from 'three';
import { LINE, M, V, band, box, cyl, lines, rod, spokedWheel, spurGear, pitchR, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const FRONT_RPS = 0.9;
const RY = 1.07; // roller height
const FZ = 0.05; // front roller line
const BZ = -0.07; // back roller line
const HEADS = [-0.36, 0.36];
const GEAR_PITCH = 0.0157;
const NF = 12; // front roller pinion
const NI = 16; // carrier (idler)
const NB = 24; // back roller wheel: half the speed of the front, a draft of two

/** Drawing head with revolving "lantern" cans. Sliver comes from behind (-z), roving leaves at the front. */
export function buildRovingFrame(): MachineModel {
  const g = new THREE.Group();

  // end frames and roller beam
  for (const sx of [-0.72, 0.72]) {
    g.add(box(0.08, 1.02, 0.5, M.oak, sx, 0.51, 0));
    g.add(box(0.12, 0.08, 0.8, M.oak, sx, 0.04, 0));
  }
  g.add(box(1.5, 0.08, 0.2, M.oak, 0, RY - 0.08, -0.01));
  g.add(box(1.5, 0.06, 0.06, M.oak, 0, 0.3, -0.2));

  // bottom rollers (fluted steel, full length) and leather-covered top rollers with weights
  const front = new THREE.Group();
  front.position.set(0, RY, FZ);
  front.add(cyl(0.025, 1.66, M.steel, 'x', 0, 0, 0, 10));
  const back = new THREE.Group();
  back.position.set(0, RY, BZ);
  back.add(cyl(0.025, 1.6, M.steel, 'x', -0.03, 0, 0, 10));
  g.add(front, back);
  const tops: THREE.Mesh[] = [];
  for (const hx of HEADS) {
    for (const z of [FZ, BZ]) {
      const top = cyl(0.03, 0.22, M.leather, 'x', hx, RY + 0.055, z, 10);
      g.add(top);
      tops.push(top);
    }
    // saddle, hook and weight
    g.add(box(0.03, 0.02, 0.16, M.iron, hx, RY + 0.09, -0.01));
    g.add(rod(V(hx, RY + 0.09, -0.01), V(hx, 0.72, -0.01), 0.004, M.iron));
    g.add(cyl(0.045, 0.12, M.iron, 'y', hx, 0.66, -0.01, 10));
  }

  // change gears at the left end: front pinion, carrier, back wheel
  const GX = -0.82;
  const rf = pitchR(NF, GEAR_PITCH);
  const ri = pitchR(NI, GEAR_PITCH);
  const rb = pitchR(NB, GEAR_PITCH);
  const d = FZ - BZ;
  const aa = ((rf + ri) ** 2 - (rb + ri) ** 2 + d * d) / (2 * d);
  const hh = Math.sqrt((rf + ri) ** 2 - aa * aa);
  const gf = spurGear(NF, GEAR_PITCH, 0.03, M.brass, 'x');
  gf.position.x = GX;
  front.add(gf);
  const gb = spurGear(NB, GEAR_PITCH, 0.03, M.brass, 'x');
  gb.position.x = GX;
  back.add(gb);
  const idler = spurGear(NI, GEAR_PITCH, 0.03, M.iron, 'x');
  idler.position.set(GX, RY - hh, FZ - aa);
  g.add(idler, cyl(0.008, 0.12, M.steel, 'x', GX + 0.05, RY - hh, FZ - aa, 6));

  // main shaft low in the frame, with the driving pulley and a band up to the front roller
  const main = new THREE.Group();
  const MY = 0.42;
  const MZ = -0.2;
  main.position.set(0, MY, MZ);
  main.add(cyl(0.02, 1.86, M.steel, 'x', 0.05, 0, 0, 8));
  const PX = 0.9;
  main.add(spokedWheel({ r: 0.18, rimT: 0.025, rimW: 0.09, spokes: 4, hubR: 0.04, hubLen: 0.09, spokeT: 0.025, m: M.iron, axis: 'x' }).translateX(PX));
  main.add(cyl(0.07, 0.03, M.dark, 'x', 0.8, 0, 0, 12));
  g.add(main);
  front.add(cyl(0.07, 0.03, M.dark, 'x', 0.8, 0, 0, 12));
  g.add(band({ h: MZ, y: MY, r: 0.07 }, { h: FZ, y: RY, r: 0.07 }, 'x', 0.8));

  // sliver cans behind, sliver rising over a guide rail to the rollers
  g.add(rod(V(-0.72, RY + 0.12, -0.3), V(0.72, RY + 0.12, -0.3), 0.012, M.steel));
  const canMat = M.tin.clone();
  canMat.side = THREE.DoubleSide;
  for (const hx of HEADS) {
    for (const off of [-0.1, 0.1]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 14, 1, true), canMat);
      can.position.set(hx + off * 1.6, 0.25, -0.72);
      g.add(can, cyl(0.12, 0.4, M.cotton, 'y', hx + off * 1.6, 0.2, -0.72, 12));
      g.add(rod(V(hx + off * 1.6, 0.42, -0.72), V(hx + off * 0.3, RY + 0.135, -0.3), 0.012, M.cotton));
      g.add(rod(V(hx + off * 0.3, RY + 0.135, -0.3), V(hx + off * 0.2, RY + 0.03, BZ), 0.012, M.cotton));
    }
  }

  // lantern cans: revolving on a spindle, turned by bands from a drum on the main shaft
  const lanterns: THREE.Group[] = [];
  const LZ = 0.5;
  const bandPts: THREE.Vector3[] = [];
  for (const hx of HEADS) {
    const l = new THREE.Group();
    l.position.set(hx, 0, LZ);
    l.add(cyl(0.012, 0.2, M.steel, 'y', 0, 0.1, 0, 6), cyl(0.04, 0.04, M.dark, 'y', 0, 0.1, 0, 10));
    l.add(cyl(0.15, 0.03, M.pine, 'y', 0, 0.2, 0, 16));
    l.add(cyl(0.13, 0.52, M.tin, 'y', 0, 0.47, 0, 16));
    l.add(cyl(0.06, 0.1, M.tin, 'y', 0, 0.78, 0, 12, 0.13)); // funnel top
    l.add(box(0.012, 0.44, 0.1, M.dark, 0.13, 0.47, 0), box(0.02, 0.03, 0.03, M.brass, 0.14, 0.47, 0.03)); // door and latch
    l.add(box(0.27, 0.02, 0.02, M.iron, 0, 0.3, 0), box(0.27, 0.02, 0.02, M.iron, 0, 0.64, 0));
    g.add(l);
    lanterns.push(l);
    main.add(cyl(0.06, 0.05, M.dark, 'x', hx, 0, 0, 12));
    bandPts.push(V(hx - 0.02, MY + 0.06, MZ), V(hx - 0.04, 0.1, LZ), V(hx + 0.02, MY - 0.06, MZ), V(hx + 0.04, 0.1, LZ));
    // roving falling from the front rollers into the funnel
    g.add(rod(V(hx, RY, FZ + 0.02), V(hx, 0.84, LZ), 0.007, M.cotton));
  }
  g.add(lines(bandPts, LINE.band));
  g.add(box(1.3, 0.04, 0.3, M.oak, 0, 0.02, LZ));

  const a = worker('child');
  a.position.set(0, 0, 0.9);
  const b = worker('child');
  b.position.set(-0.85, 0, -0.85);
  g.add(a, b);

  return {
    group: g,
    height: 1.4,
    workers: [a, b],
    pulley: { x: PX, y: MY, z: MZ, r: 0.18 },
    labels: [
      { name: 'Sliver cans', desc: 'Two slivers are fed together to each head, evening out thick and thin places.', p: V(-0.52, 0.52, -0.72) },
      { name: 'Drafting rollers', desc: 'The front pair turns twice as fast as the back, drawing the sliver to half its weight.', p: V(0, RY + 0.06, 0) },
      { name: 'Weighted top rollers', desc: 'Leather-covered rollers pressed down by hanging weights grip the fibres.', p: V(HEADS[1], 0.68, -0.01) },
      { name: 'Change gears', desc: `Pinion of ${NF}, carrier of ${NI}, wheel of ${NB}. Changing the wheel alters the draft.`, p: V(GX, RY - 0.03, 0) },
      { name: 'Lantern can', desc: 'Revolves as the roving falls in, giving a slight twist. It is emptied through the door.', p: V(HEADS[0], 0.6, LZ + 0.13) },
      { name: 'Driving pulley', desc: 'Strap from the line shaft overhead.', p: V(PX, MY + 0.18, MZ) },
    ],
    animate(t) {
      const fa = t * FRONT_RPS * TAU;
      front.rotation.x = fa;
      back.rotation.x = (fa * NF) / NB;
      idler.rotation.x = (-fa * NF) / NI;
      main.rotation.x = fa;
      for (let i = 0; i < tops.length; i++) tops[i].rotation.x = -fa * (i % 2 === 0 ? 0.83 : 0.42);
      for (const l of lanterns) l.rotation.y = t * 1.4 * TAU * 0.5;
    },
  };
}
