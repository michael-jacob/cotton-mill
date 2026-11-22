import * as THREE from 'three';
import { DynLines, LINE, M, V, box, cyl, lines, pw, rod, smooth, spokedWheel, worker, type MachineModel, type PartLabel } from '../parts';

const TAU = Math.PI * 2;
const TILT = 0.24; // spindles lean towards the rollers
const Z_IN = -0.62;
const Z_OUT = 0.62;
const ROLLER_Y = 1.1;
const NIP_Z = -1.0;

/** carriage travel: out with the rollers running, a further stretch, a pause, then run in */
const CARR: [number, number][] = [[0, 0], [0.5, 0.92], [0.6, 1], [0.68, 1], [0.97, 0], [1, 0]];
const ROLL: [number, number][] = [[0, 0], [0.5, 3], [1, 3]];
const WHEEL: [number, number][] = [[0, 0], [0.5, 2], [0.62, 3.8], [0.68, 3.62], [0.97, 4.5], [1, 4.5]];
const FALLER: [number, number][] = [[0, 0], [0.62, 0], [0.68, 1], [0.95, 1], [1, 0]];

/**
 * Crompton's mule, hand-worked: rollers on a fixed beam, spindles on a carriage that runs out and in on rails.
 *
 * With `selfActing` set it is Roberts's self-actor: longer, driven by a strap
 * to a headstock in the middle, with the quadrant that governs winding.
 */
export function buildMule(selfActing = false): MachineModel {
  const root = new THREE.Group();
  const g = new THREE.Group(); // the mule proper; stretched sideways for the longer self-actor
  root.add(g);
  // the frame is modelled short and stretched sideways; spindles and bobbins are un-stretched again below
  const SX = selfActing ? 3.05 : 1.62;
  g.scale.x = SX;
  const CYCLE = selfActing ? 7 : 10; // seconds for one draw
  const FM = selfActing ? M.iron : M.oak; // Roberts built in iron
  const N = selfActing ? 60 : 28; // spindles shown
  const xs: number[] = [];
  for (let i = 0; i < N; i++) xs.push(-0.98 + (i * 1.96) / (N - 1));

  // fixed frame: roller beam and creel
  for (const sx of [-1.16, 1.16]) {
    g.add(box(0.08, 1.62, 0.1, FM, sx, 0.81, -1.3));
    g.add(box(0.08, 1.08, 0.1, FM, sx, 0.54, -0.98));
    g.add(box(0.08, 0.08, 0.5, FM, sx, 0.04, -1.14));
    g.add(box(0.07, 0.07, 0.42, FM, sx, 1.02, -1.14));
  }
  g.add(box(2.4, 0.07, 0.16, FM, 0, ROLLER_Y - 0.07, -1.05));
  g.add(box(2.4, 0.03, 0.2, M.pine, 0, 1.6, -1.3));
  const creel: THREE.Mesh[] = [];
  for (const x of xs) {
    const b = cyl(0.045, 0.16, M.cotton, 'y', x, 1.7, -1.3, 8);
    b.scale.x = 1 / SX;
    g.add(b, cyl(0.005, 0.24, M.iron, 'y', x, 1.72, -1.3, 4));
    creel.push(b);
  }
  // two lines of rollers, the front running faster; weighted leather top rollers
  const rollers: { o: THREE.Object3D; k: number }[] = [];
  for (const [z, k] of [[-1.08, 0.45], [-1.02, 1]] as [number, number][]) {
    const bottom = cyl(0.02, 2.36, M.steel, 'x', 0, ROLLER_Y, z, 8);
    g.add(bottom);
    rollers.push({ o: bottom, k });
    for (let h = 0; h < 4; h++) {
      const top = cyl(0.024, 0.46, M.leather, 'x', -0.74 + h * 0.493, ROLLER_Y + 0.044, z, 8);
      g.add(top);
      rollers.push({ o: top, k: -k * 0.83 });
    }
  }
  for (let h = 0; h < 4; h++) {
    const x = -0.74 + h * 0.493;
    g.add(box(0.03, 0.016, 0.12, M.iron, x, ROLLER_Y + 0.075, -1.05), rod(V(x, ROLLER_Y + 0.07, -1.05), V(x, 0.82, -1.05), 0.004, M.iron), cyl(0.035, 0.1, M.iron, 'y', x, 0.77, -1.05, 8));
  }
  const fixedYarn: THREE.Vector3[] = [];
  for (const x of xs) fixedYarn.push(V(x, 1.63, -1.27), V(x, ROLLER_Y + 0.022, -1.08));
  g.add(lines(fixedYarn, LINE.yarn));

  // floor rails
  for (const sx of [-1.1, 1.1]) g.add(box(0.04, 0.025, 2.3, M.iron, sx, 0.012, 0.15));

  // carriage
  const carriage = new THREE.Group();
  g.add(carriage);
  const wheels: THREE.Mesh[] = [];
  for (const sx of [-1.1, 1.1]) {
    carriage.add(box(0.06, 0.42, 0.5, FM, sx * 0.98, 0.32, 0.05));
    for (const dz of [-0.14, 0.24]) {
      const w = spokedWheel({ r: 0.075, rimT: 0.02, rimW: 0.03, spokes: 4, hubR: 0.02, hubLen: 0.04, spokeT: 0.012, m: M.iron, axis: 'x' });
      w.position.set(sx, 0.1, dz);
      carriage.add(w);
      wheels.push(w);
    }
  }
  carriage.add(box(2.2, 0.3, 0.03, M.pine, 0, 0.36, 0.28)); // front board
  carriage.add(box(2.2, 0.05, 0.07, FM, 0, 0.3, -0.05)); // spindle step rail
  carriage.add(box(2.2, 0.04, 0.05, FM, 0, 0.5, -0.1)); // bolster rail
  const drum = new THREE.Group();
  drum.position.set(0, 0.24, 0.14);
  drum.add(cyl(0.075, 2.1, M.tin, 'x', 0, 0, 0, 14), cyl(0.012, 2.5, M.steel, 'x', 0.08, 0, 0, 6), cyl(0.06, 0.04, M.dark, 'x', 1.3, 0, 0, 10));
  carriage.add(drum);
  const spindles: THREE.Group[] = [];
  const cops: THREE.Mesh[] = [];
  const bandPts: THREE.Vector3[] = [];
  for (const x of xs) {
    const tilt = new THREE.Group();
    tilt.position.set(x, 0.3, -0.05);
    tilt.rotation.x = -TILT;
    tilt.scale.x = 1 / SX;
    const sp = new THREE.Group();
    sp.add(cyl(0.006, 0.52, M.steel, 'y', 0, 0.26, 0, 6), cyl(0.02, 0.03, M.steel, 'y', 0, 0.07, 0, 8));
    const cop = cyl(0.026, 0.17, M.yarn, 'y', 0, 0.38, 0, 8, 0.007);
    sp.add(cop);
    cops.push(cop);
    tilt.add(sp);
    carriage.add(tilt);
    spindles.push(sp);
    bandPts.push(V(x - 0.01, 0.31, 0.12), V(x - 0.01, 0.37, -0.05), V(x + 0.01, 0.17, 0.12), V(x + 0.01, 0.36, -0.08));
  }
  carriage.add(lines(bandPts, LINE.band));
  const tipY = 0.3 + Math.cos(TILT) * 0.52;
  const tipDZ = -0.05 - Math.sin(TILT) * 0.52;
  const copY = 0.3 + Math.cos(TILT) * 0.38;
  const copDZ = -0.05 - Math.sin(TILT) * 0.38;
  // faller wire on the carriage
  const faller = new THREE.Group();
  faller.position.set(0, 0.52, -0.1);
  for (const sx of [-1.06, 1.06]) faller.add(rod(V(sx, 0, 0), V(sx, 0.3, -0.1), 0.006, M.iron));
  faller.add(rod(V(-1.06, 0.3, -0.1), V(1.06, 0.3, -0.1), 0.004, M.steel));
  carriage.add(faller);

  // hand mule: headstock at the side with the spinner's fly wheel
  const HX = 1.42;
  const wheel = new THREE.Group();
  wheel.position.set(HX, 0.98, -0.72);
  if (!selfActing) {
    g.add(box(0.1, 1.2, 0.1, M.oak, HX - 0.1, 0.6, -0.72), box(0.1, 0.08, 0.6, M.oak, HX - 0.1, 0.04, -0.72));
    wheel.add(spokedWheel({ r: 0.5, rimT: 0.03, rimW: 0.06, spokes: 8, hubR: 0.05, hubLen: 0.1, spokeT: 0.022, m: M.pine, axis: 'x' }));
    wheel.add(cyl(0.015, 0.14, M.iron, 'x', 0.08, 0.3, 0, 6));
    wheel.scale.x = 1 / SX;
    g.add(wheel);
    // band from the fly wheel up to the roller pulley
    g.add(cyl(0.05, 0.03, M.dark, 'x', 1.22, ROLLER_Y, -1.02, 10));
  }

  // self-actor: iron headstock amidships, driven by a strap, with the winding quadrant
  const PULLEY = { x: 0.34, y: 0.8, z: -1.2, r: 0.2 };
  const rim = new THREE.Group();
  const quadrant = new THREE.Group();
  const QP = { x: -0.28, y: 0.06, z: -0.5 };
  if (selfActing) {
    root.add(box(0.5, 1.0, 0.6, M.iron, 0, 0.5, -1.2), box(0.62, 0.06, 0.72, M.iron, 0, 1.03, -1.2));
    rim.position.set(0, PULLEY.y, PULLEY.z);
    rim.add(cyl(0.025, 0.9, M.steel, 'x', 0, 0, 0, 8));
    rim.add(spokedWheel({ r: PULLEY.r, rimT: 0.025, rimW: 0.09, spokes: 4, hubR: 0.04, hubLen: 0.09, spokeT: 0.025, m: M.iron, axis: 'x' }).translateX(PULLEY.x));
    rim.add(spokedWheel({ r: 0.26, rimT: 0.03, rimW: 0.05, spokes: 6, hubR: 0.04, hubLen: 0.06, spokeT: 0.02, m: M.iron, axis: 'x' }).translateX(-0.34)); // rim pulley for the spindle band
    root.add(rim);
    // scroll drums for the drawing-out and taking-in ropes
    root.add(cyl(0.09, 0.3, M.dark, 'x', 0, 0.2, -1.0, 12));
    // quadrant: a quarter-circle arm that rocks forward as the carriage runs in
    quadrant.position.set(QP.x, QP.y, QP.z);
    quadrant.add(box(0.04, 0.72, 0.05, M.iron, 0, 0.36, 0));
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.022, 6, 16, Math.PI / 2), M.iron);
    arc.rotation.y = -Math.PI / 2; // into the y-z plane, sweeping from upright towards +z
    quadrant.add(arc, box(0.04, 0.05, 0.72, M.iron, 0, 0, 0.36));
    quadrant.add(box(0.07, 0.07, 0.07, M.brass, 0, 0.5, 0)); // the nut that travels up the arm
    root.add(quadrant, box(0.16, 0.08, 0.2, M.iron, QP.x, 0.04, QP.z));
  }

  const yarn = new DynLines(N * 2, LINE.yarn);
  const bandLine = new DynLines(4, LINE.band);
  g.add(yarn.obj);
  root.add(bandLine.obj);

  const spinner = worker('adult');
  const piecer = worker('child');
  const piecer2 = worker('child');
  const piecer3 = worker('child');
  const piecer4 = worker('child');
  root.add(spinner, piecer, piecer2);
  if (selfActing) root.add(piecer3, piecer4);

  return {
    group: root,
    height: 1.9,
    workers: selfActing ? [spinner, piecer, piecer2, piecer3, piecer4] : [spinner, piecer, piecer2],
    pulley: selfActing ? PULLEY : undefined,
    labels: (
      [
      { name: 'Rollers', desc: "Arkwright's principle: the front pair runs faster than the back and draws the roving out as it is delivered.", p: V(-0.4, ROLLER_Y + 0.07, -1.03) },
      { name: 'Carriage', desc: 'Carries the spindles away from the rollers on wheels, about four feet at each draw.', p: V(0.6, 0.45, 0.3 + Z_IN) },
      { name: 'Spindles', desc: "Hargreaves' principle: bare spindles that twist the thread as it slips over the tip, then wind it on.", p: V(-0.2, 0.75, Z_IN - 0.15) },
      { name: 'The stretch', desc: 'After the rollers stop, the carriage runs on a few inches, drawing the half-twisted thread finer and more even.', p: V(0.2, 0.95, -0.45) },
      { name: 'Faller wire', desc: 'Lowered after backing off to guide the thread onto the cop as the carriage runs in.', p: V(-1.06, 0.84, Z_IN - 0.2) },
      selfActing
        ? { name: 'Headstock', desc: 'Takes the drive from the line shaft and performs each motion in turn: drawing out, backing off, and taking in.', p: V(0, 1.1, -1.2) }
        : { name: 'Fly wheel', desc: "Turned by the spinner's right hand; bands carry its motion to the rollers and to the drum in the carriage.", p: V(HX, 1.4, -0.72) },
      ...(selfActing
        ? [{ name: 'Quadrant', desc: "Roberts's invention of 1830. As the carriage runs in, the arm rocks forward and its nut pays out the winding chain, fast at first and then slower, to build the cop to shape.", p: V(QP.x, 0.75, QP.z + 0.3) }]
        : []),
      { name: 'Roving creel', desc: 'A bobbin of roving for each spindle.', p: V(0.5, 1.75, -1.3) },
      ] as PartLabel[]
    ).map((l) => (l.name === 'Headstock' || l.name === 'Quadrant' ? l : { ...l, p: V(l.p.x * SX, l.p.y, l.p.z) })),
    animate(t) {
      const c = t / CYCLE;
      const k = Math.floor(c);
      const u = c - k;
      const travel = pw(u, CARR);
      const z = Z_IN + (Z_OUT - Z_IN) * travel;
      carriage.position.z = z;
      const roll = (k * 3 + pw(u, ROLL)) * TAU;
      for (const r of rollers) r.o.rotation.x = roll * r.k;
      for (let i = 0; i < creel.length; i++) creel[i].rotation.y = roll * 0.15 + i;
      const turns = (k * 4.5 + pw(u, WHEEL)) * TAU;
      wheel.rotation.x = turns;
      drum.rotation.x = turns * 1.5;
      for (const s of spindles) s.rotation.y = turns * 5;
      for (const w of wheels) w.rotation.x = (z - Z_IN) / 0.075;

      const f = smooth(pw(u, FALLER));
      faller.rotation.x = f * 0.9;
      const cs = Math.cos(f * 0.9);
      const sn = Math.sin(f * 0.9);
      // faller wire position in g coordinates (rotation about x takes +y towards +z)
      const fy = 0.52 + 0.3 * cs + 0.1 * sn;
      const fz = z - 0.1 + 0.3 * sn - 0.1 * cs;
      const grow = 0.45 + 0.55 * ((c / 10) % 1);
      yarn.begin();
      for (let i = 0; i < N; i++) {
        const x = xs[i];
        if (f > 0.02) {
          yarn.seg(x, ROLLER_Y + 0.02, NIP_Z, x, fy, fz);
          yarn.seg(x, fy, fz, x, copY, z + copDZ);
        } else {
          yarn.seg(x, ROLLER_Y + 0.02, NIP_Z, x, tipY, z + tipDZ);
        }
        cops[i].scale.set(grow, 1, grow);
      }
      yarn.end();
      bandLine.begin();
      if (selfActing) {
        // spindle band from the rim pulley to the carriage drum; winding chain from the quadrant nut; drawing-out rope
        bandLine.seg(-0.34, PULLEY.y + 0.26, PULLEY.z, -0.34, 0.3, z + 0.14);
        bandLine.seg(-0.34, PULLEY.y - 0.26, PULLEY.z, -0.34, 0.18, z + 0.14);
        const qa = 0.1 + 1.1 * (1 - travel);
        quadrant.rotation.x = qa;
        bandLine.seg(QP.x, QP.y + 0.5 * Math.cos(qa), QP.z + 0.5 * Math.sin(qa), QP.x, 0.3, z + 0.05);
        bandLine.seg(0, 0.2, -0.92, 0, 0.14, z - 0.1);
        rim.rotation.x = turns;
        spinner.position.set(1.0, 0, z + 0.75);
        piecer.position.set(-0.45 * SX, 0, z + 0.68);
        piecer2.position.set(-0.95 * SX, 0, z + 0.7);
        piecer3.position.set(0.5 * SX, 0, z + 0.68);
        piecer4.position.set(0.95 * SX, 0, z + 0.7);
      } else {
        bandLine.seg(HX * SX, 0.98 + 0.5, -0.72, 1.3 * SX, 0.24 + 0.06, z + 0.14);
        bandLine.seg(HX * SX, 0.98 - 0.5, -0.72, 1.3 * SX, 0.24 - 0.06, z + 0.14);
        bandLine.seg(1.22 * SX, 0.98 + 0.4, -0.86, 1.22 * SX, ROLLER_Y + 0.05, -1.02);
        bandLine.seg(1.22 * SX, 0.98 + 0.2, -1.1, 1.22 * SX, ROLLER_Y - 0.05, -1.02);
        spinner.position.set(0.55 * SX, 0, z + 0.72);
        piecer.position.set(-0.7 * SX, 0, z + 0.68);
        piecer2.position.set(0.1, 0, z + 0.7);
      }
      bandLine.end();
    },
  };
}
