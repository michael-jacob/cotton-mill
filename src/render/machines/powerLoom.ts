import * as THREE from 'three';
import { DynLines, LINE, M, V, box, cyl, lines, meshPhase, pitchR, pw, rod, setRod, smooth, spokedWheel, spurGear, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const WARP_Y = 0.95;
const FELL_Z = 0.29;
const BACK_Z = -0.6;
const HEDDLE_Z = [-0.1, 0.0];
const LIFT = 0.065;
const THREADS = 26;
const W = 0.6;

// crank shaft, and the sley it drives
const CRANK = { y: 0.72, z: -0.38, r: 0.07 };
const PIVOT = { y: 0.1, z: 0.2 };
const ARM_H = 0.68; // height on the sword where the crank arm attaches
const ROD = Math.hypot(PIVOT.z + ARM_H * 0.122 - (CRANK.z + CRANK.r), PIVOT.y + ARM_H * Math.cos(0.122) - CRANK.y);
// tappet shaft, geared to turn once for two picks
const GP = 0.044;
const NC = 24;
const NT = 48;
const GD = pitchR(NC, GP) + pitchR(NT, GP);
const TDIR = { y: -0.42 / 0.5048, z: 0.28 / 0.5048 };
const TAPPET = { y: CRANK.y + TDIR.y * GD, z: CRANK.z + TDIR.z * GD };

function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry().setFromPoints([a, b, c, d]);
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/**
 * Iron-framed power loom. x runs across the cloth; the weaver stands at +z.
 *
 * With `lancashire` set it is the semi-automatic loom of the 1840s: picking
 * from above by an arm on an upright shaft, a weft fork, a brake and roller temples.
 */
export function buildPowerLoom(lancashire = false): MachineModel {
  const g = new THREE.Group();
  const RPS = lancashire ? 1.9 : 1.3; // crank shaft turns (picks) per second, slowed a little for the eye

  // cast-iron side frames and cross rails
  for (const sx of [-0.72, 0.72]) {
    for (const z of [-0.62, 0.6]) g.add(box(0.05, 0.98, 0.07, M.iron, sx, 0.49, z));
    g.add(box(0.05, 0.07, 1.3, M.iron, sx, 0.95, -0.01));
    g.add(box(0.05, 0.06, 1.3, M.iron, sx, 0.3, -0.01));
    g.add(rod(V(sx, 0.33, -0.6), V(sx, 0.92, -0.1), 0.02, M.iron), rod(V(sx, 0.33, 0.58), V(sx, 0.92, 0.1), 0.02, M.iron));
    // heddle arch
    g.add(box(0.04, 0.62, 0.05, M.iron, sx, 1.27, -0.05));
  }
  g.add(box(1.5, 0.05, 0.05, M.iron, 0, 1.57, -0.05));
  g.add(box(1.5, 0.06, 0.08, M.oak, 0, WARP_Y - 0.04, 0.6)); // breast beam
  g.add(cyl(0.03, 1.5, M.iron, 'x', 0, WARP_Y - 0.03, BACK_Z, 10)); // back rest
  g.add(box(1.5, 0.05, 0.05, M.iron, 0, 0.3, 0.6), box(1.5, 0.05, 0.05, M.iron, 0, 0.3, -0.62));

  // warp beam with flanges; cloth roller with its take-up wheel
  const warpBeam = cyl(0.12, 1.3, M.yarn, 'x', 0, 0.5, -0.74, 16);
  g.add(warpBeam, cyl(0.03, 1.56, M.iron, 'x', 0, 0.5, -0.74, 8));
  for (const sx of [-0.66, 0.66]) g.add(cyl(0.17, 0.02, M.iron, 'x', sx, 0.5, -0.74, 20));
  const clothBeam = new THREE.Group();
  clothBeam.position.set(0, 0.47, 0.48);
  const clothRoll = cyl(0.06, 1.24, M.cloth, 'x', 0, 0, 0, 14);
  clothBeam.add(clothRoll, cyl(0.025, 1.7, M.iron, 'x', 0, 0, 0, 8));
  const takeUp = spurGear(40, 0.0157, 0.02, M.iron, 'x');
  takeUp.position.x = 0.82;
  clothBeam.add(takeUp);
  g.add(clothBeam);

  g.add(quad(V(-W, 0.6, -0.68), V(W, 0.6, -0.68), V(W, WARP_Y, BACK_Z), V(-W, WARP_Y, BACK_Z), M.warpSheet));
  g.add(quad(V(-W, WARP_Y, FELL_Z), V(W, WARP_Y, FELL_Z), V(W, WARP_Y, 0.64), V(-W, WARP_Y, 0.64), M.cloth));
  g.add(quad(V(-W, WARP_Y, 0.64), V(W, WARP_Y, 0.64), V(W, 0.52, 0.52), V(-W, 0.52, 0.52), M.cloth));

  // heddle shafts
  g.add(cyl(0.025, 1.46, M.oak, 'x', 0, 1.5, -0.05, 8));
  const shafts: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Group();
    s.add(box(1.32, 0.03, 0.02, M.pine, 0, 0.18, 0), box(1.32, 0.03, 0.02, M.pine, 0, -0.18, 0));
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < THREADS / 2; k++) {
      const x = -W + ((k * 2 + i + 0.5) / THREADS) * 2 * W;
      pts.push(V(x, 0.18, 0), V(x, -0.18, 0));
    }
    for (const sx of [-0.5, 0.5]) pts.push(V(sx, 0.18, 0), V(sx, 0.52, 0), V(sx * 0.25, -0.18, 0), V(sx * 0.25, -0.66, 0));
    s.add(lines(pts, LINE.cord));
    s.position.set(0, WARP_Y, HEDDLE_Z[i]);
    g.add(s);
    shafts.push(s);
  }

  // crank shaft with two cranks, the driving pulleys (fast and loose) and its gear
  const crank = new THREE.Group();
  crank.position.set(0, CRANK.y, CRANK.z);
  crank.add(cyl(0.02, 2.0, M.steel, 'x', 0.1, 0, 0, 8));
  for (const sx of [-0.5, 0.5]) {
    crank.add(box(0.03, CRANK.r + 0.04, 0.04, M.iron, sx - 0.04, CRANK.r / 2, 0), box(0.03, CRANK.r + 0.04, 0.04, M.iron, sx + 0.04, CRANK.r / 2, 0));
    crank.add(cyl(0.014, 0.1, M.steel, 'x', sx, CRANK.r, 0, 6));
  }
  const PX = 0.98;
  crank.add(spokedWheel({ r: 0.16, rimT: 0.022, rimW: 0.07, spokes: 4, hubR: 0.035, hubLen: 0.07, spokeT: 0.022, m: M.iron, axis: 'x' }).translateX(PX));
  const gearC = spurGear(NC, GP, 0.04, M.iron, 'x');
  gearC.position.x = -0.82;
  gearC.rotation.x = meshPhase('x', V(0, TDIR.y, TDIR.z), NC, false);
  crank.add(gearC);
  g.add(crank);
  // the loose pulley beside the fast one (idle)
  g.add(spokedWheel({ r: 0.16, rimT: 0.022, rimW: 0.07, spokes: 4, hubR: 0.035, hubLen: 0.07, spokeT: 0.022, m: M.dark, axis: 'x' }).translateX(PX + 0.085).translateY(CRANK.y).translateZ(CRANK.z));

  // tappet shaft: half speed, with the two shedding tappets
  const tappet = new THREE.Group();
  tappet.position.set(0, TAPPET.y, TAPPET.z);
  tappet.add(cyl(0.02, 1.8, M.steel, 'x', 0, 0, 0, 8));
  const gearT = spurGear(NT, GP, 0.04, M.iron, 'x');
  gearT.position.x = -0.82;
  gearT.rotation.x = meshPhase('x', V(0, -TDIR.y, -TDIR.z), NT, true);
  tappet.add(gearT);
  tappet.add(cyl(0.08, 0.04, M.iron, 'x', -0.13, 0.04, 0, 14), cyl(0.08, 0.04, M.iron, 'x', 0.13, -0.04, 0, 14));
  g.add(tappet);
  const treadles: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const tr = new THREE.Group();
    tr.position.set(i === 0 ? -0.13 : 0.13, 0.14, -0.6);
    tr.add(box(0.05, 0.025, 0.95, M.iron, 0, 0, 0.475), cyl(0.025, 0.04, M.brass, 'x', 0, 0.03, TAPPET.z + 0.6, 8));
    g.add(tr);
    treadles.push(tr);
  }

  // sley, rocking on a shaft near the floor
  g.add(cyl(0.02, 1.5, M.steel, 'x', 0, PIVOT.y, PIVOT.z, 8));
  const sley = new THREE.Group();
  sley.position.set(0, PIVOT.y, PIVOT.z);
  for (const sx of [-0.64, 0.64]) sley.add(box(0.04, 0.86, 0.045, M.oak, sx, 0.43, 0));
  sley.add(box(2.36, 0.04, 0.11, M.pine, 0, 0.8, 0.04)); // race board
  sley.add(box(1.3, 0.15, 0.012, M.dark, 0, 0.895, -0.02)); // reed
  sley.add(box(1.42, 0.04, 0.045, M.oak, 0, 0.99, -0.02)); // reed cap
  const pickers: THREE.Mesh[] = [];
  const sticks: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    sley.add(box(0.48, 0.06, 0.012, M.pine, sx * 0.94, 0.85, -0.015), box(0.48, 0.06, 0.012, M.pine, sx * 0.94, 0.85, 0.095));
    const p = box(0.04, 0.06, 0.06, M.leather, sx * 1.14, 0.85, 0.04);
    sley.add(p);
    pickers.push(p);
    const st = new THREE.Group();
    st.position.set(sx * 1.22, 0.06, 0.04);
    st.add(box(0.03, 0.82, 0.035, M.oak, 0, 0.41, 0));
    if (!lancashire) sley.add(st);
    sticks.push(st);
  }
  const shuttle = new THREE.Group();
  shuttle.add(box(0.16, 0.03, 0.04, M.dark), cyl(0.002, 0.06, M.dark, 'x', -0.1, 0, 0, 4, 0.02), cyl(0.02, 0.06, M.dark, 'x', 0.1, 0, 0, 4, 0.002), cyl(0.012, 0.1, M.yarn, 'x', 0, 0.012, 0, 6));
  shuttle.position.set(0, 0.835, 0.04);
  sley.add(shuttle);
  g.add(sley);
  const arms = [rod(V(), V(0, 1, 0), 0.012, M.iron), rod(V(), V(0, 1, 0), 0.012, M.iron)];
  g.add(...arms);

  // Lancashire loom: over-pick. A cone on the tappet shaft strikes a bowl on each upright picking shaft,
  // swinging the arm at its head, which jerks the picker by a strap.
  const pickArms: THREE.Group[] = [];
  const straps = new DynLines(2, LINE.cord);
  if (lancashire) {
    for (const sx of [-1, 1]) {
      const pa = new THREE.Group();
      pa.position.set(sx * 0.8, 0, -0.26);
      pa.add(cyl(0.018, 1.1, M.steel, 'y', 0, 0.72, 0, 8));
      pa.add(cyl(0.035, 0.1, M.iron, 'y', 0, TAPPET.y + 0.02, 0, 10, 0.07)); // bowl struck by the picking cone
      pa.add(box(0.035, 0.03, 0.6, M.oak, 0, 1.26, 0.3)); // picking arm
      pa.add(cyl(0.03, 0.05, M.iron, 'y', 0, 1.26, 0, 8));
      g.add(pa, box(0.1, 0.05, 0.1, M.iron, sx * 0.8, 0.18, -0.26));
      pickArms.push(pa);
      tappet.add(cyl(0.02, 0.12, M.iron, 'x', sx * 0.72, sx * 0.05, 0.04, 8, 0.06)); // picking cone
      // roller temple holding the cloth out to width at the fell
      g.add(cyl(0.022, 0.12, M.brass, 'x', sx * (W + 0.02), WARP_Y + 0.02, FELL_Z + 0.06, 10));
    }
    g.add(straps.obj);
    // brake wheel on the crank shaft, and the weft fork by the reed
    crank.add(cyl(0.15, 0.03, M.iron, 'x', -0.92, 0, 0, 20));
    g.add(box(0.03, 0.2, 0.05, M.dark, -0.92, CRANK.y - 0.2, CRANK.z + 0.1));
    sley.add(box(0.05, 0.012, 0.09, M.brass, -0.7, 0.86, 0.03));
    g.add(box(0.04, 0.3, 0.04, M.iron, -0.86, 0.9, 0.5), cyl(0.02, 0.1, M.oak, 'x', -0.86, 1.08, 0.5, 8)); // starting handle
  }

  const warp = new DynLines(THREADS * 2, LINE.yarn);
  g.add(warp.obj);

  const weaver = worker('adult');
  weaver.position.set(0.35, 0, 0.92);
  g.add(weaver);

  const a0 = V();
  const a1 = V();
  return {
    group: g,
    height: 1.65,
    workers: [weaver],
    pulley: { x: PX, y: CRANK.y, z: CRANK.z, r: 0.16 },
    labels: [
      { name: 'Fast and loose pulleys', desc: 'The strap is slid from the loose pulley to the fast one to start the loom, and back to stop it.', p: V(PX + 0.04, CRANK.y + 0.18, CRANK.z) },
      { name: 'Crank shaft', desc: 'One turn for every pick. Two cranks swing the sley through connecting arms.', p: V(0.5, CRANK.y + 0.08, CRANK.z) },
      { name: 'Sley and reed', desc: 'Rocks on a shaft near the floor. The reed drives each pick of weft home against the cloth.', p: V(-0.4, 1.02, PIVOT.z) },
      { name: 'Tappet shaft', desc: `Geared ${NC} to ${NT}, so it turns once for two picks. Its tappets press the treadles in turn to change the shed.`, p: V(-0.82, TAPPET.y, TAPPET.z) },
      { name: 'Heddles', desc: 'Raised and lowered alternately by the treadles below.', p: V(0.3, 1.18, -0.05) },
      lancashire
        ? { name: 'Over-pick', desc: 'A cone on the tappet shaft strikes the upright picking shaft; the arm at its head swings and a strap jerks the picker along the box.', p: V(0.8, 1.3, 0.1) }
        : { name: 'Picking stick', desc: 'Jerks the picker along the shuttle box and throws the shuttle across while the sley is back.', p: V(1.22, 0.6, PIVOT.z) },
      ...(lancashire
        ? [
            { name: 'Weft fork and brake', desc: 'The fork feels for the weft at every pick. If the thread has broken or run out it knocks off the strap and the brake stops the loom at once.', p: V(-0.86, 0.9, 0.3) },
            { name: 'Roller temple', desc: 'Grips the edges of the cloth and holds it out to width, a task that once needed the weaver every few inches.', p: V(W, WARP_Y + 0.05, FELL_Z + 0.06) },
          ]
        : []),
      { name: 'Take-up wheel', desc: 'Turns the cloth roller a tooth at each pick, so the cloth is wound on at an even rate.', p: V(0.82, 0.5, 0.48) },
      { name: 'Warp beam', desc: 'Sized twist from the water frame or throstle. Soft jenny yarn will not stand the strain.', p: V(0, 0.64, -0.74) },
    ],
    animate(t, fill) {
      const th = t * RPS * TAU;
      crank.rotation.x = th;
      const tau = th / 2 + Math.PI / 4;
      tappet.rotation.x = -(th / 2);
      // sley angle from the crank (rotation about x takes +y towards +z)
      const py = CRANK.y + CRANK.r * Math.cos(th);
      const pz = CRANK.z + CRANK.r * Math.sin(th);
      let al = 0;
      for (let i = 0; i < 3; i++) {
        const sy = PIVOT.y + ARM_H * Math.cos(al);
        const sz = pz + Math.sqrt(Math.max(0, ROD * ROD - (sy - py) * (sy - py)));
        al = Math.asin(Math.max(-1, Math.min(1, (sz - PIVOT.z) / ARM_H)));
      }
      sley.rotation.x = al;
      const sy = PIVOT.y + ARM_H * Math.cos(al);
      const sz = PIVOT.z + ARM_H * Math.sin(al);
      for (let i = 0; i < 2; i++) {
        const x = i === 0 ? -0.5 : 0.5;
        setRod(arms[i], a0.set(x, py, pz), a1.set(x, sy, sz));
      }

      const lift = LIFT * Math.max(-1, Math.min(1, 1.6 * Math.cos(tau)));
      shafts[0].position.y = WARP_Y + lift;
      shafts[1].position.y = WARP_Y - lift;
      treadles[0].rotation.x = -0.03 - (lift / LIFT) * 0.05;
      treadles[1].rotation.x = -0.03 + (lift / LIFT) * 0.05;

      // picks are counted from beat-up (crank at its forward centre)
      const c = (th - Math.PI / 2) / TAU;
      const k = Math.floor(c);
      const u = c - k;
      const from = ((k % 2) + 2) % 2 === 0 ? -1 : 1;
      const fly = smooth((u - 0.32) / 0.34);
      shuttle.position.x = from * (1 - 2 * fly) * 0.98;
      const snap = pw(u, [[0.28, 0], [0.35, 1], [0.55, 0], [1, 0]]);
      pickers[0].position.x = -1.14 + (from < 0 ? snap * 0.34 : 0);
      pickers[1].position.x = 1.14 - (from > 0 ? snap * 0.34 : 0);
      sticks[0].rotation.z = from < 0 ? -snap * 0.4 : 0;
      sticks[1].rotation.z = from > 0 ? snap * 0.4 : 0;
      if (lancashire) {
        pickArms[0].rotation.y = from < 0 ? snap * 0.55 : 0;
        pickArms[1].rotation.y = from > 0 ? -snap * 0.55 : 0;
        straps.begin();
        for (let i = 0; i < 2; i++) {
          // arm tip and picker, in the loom's own coordinates
          const ry = pickArms[i].rotation.y;
          a0.set(0.6 * Math.sin(ry), 1.24, 0.6 * Math.cos(ry)).add(pickArms[i].position);
          a1.copy(pickers[i].position).applyEuler(sley.rotation).add(sley.position);
          straps.seg(a0.x, a0.y, a0.z, a1.x, a1.y + 0.03, a1.z);
        }
        straps.end();
      }

      warp.begin();
      for (let i = 0; i < THREADS; i++) {
        const x = -W + ((i + 0.5) / THREADS) * 2 * W;
        const s = i % 2;
        const y = WARP_Y + (s === 0 ? lift : -lift);
        warp.seg(x, WARP_Y, BACK_Z, x, y, HEDDLE_Z[s]);
        warp.seg(x, y, HEDDLE_Z[s], x, WARP_Y, FELL_Z);
      }
      warp.end();

      clothBeam.rotation.x = c * 0.03;
      const r = 1 + 1.5 * fill;
      clothRoll.scale.set(1, r, r);
      const wr = 1.2 - 0.5 * fill;
      warpBeam.scale.set(1, wr, wr);
    },
  };
}
