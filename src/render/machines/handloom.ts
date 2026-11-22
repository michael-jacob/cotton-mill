import * as THREE from 'three';
import { DynLines, LINE, M, V, box, cyl, lines, pw, rod, smooth, worker, type MachineModel } from '../parts';

const PICK = 1.5; // seconds per pick (about 40 picks a minute)
const WARP_Y = 0.98;
const FELL_Z = 0.36; // where cloth is formed
const BACK_Z = -0.66;
const HEDDLE_Z = [-0.06, 0.06];
const LIFT = 0.075;
const THREADS = 26;
const BATTEN_L = 0.97;
const BATTEN_BACK = 0.1;
// at beat-up the reed (set 0.03 behind the swords) meets the fell
const BATTEN_BEAT = -Math.asin((FELL_Z - 0.22 + 0.03) / BATTEN_L);

function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry().setFromPoints([a, b, c, d]);
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** Handloom with Kay's flying shuttle. x runs across the cloth; the weaver sits at +z. */
export function buildHandloom(): MachineModel {
  const g = new THREE.Group();
  const W = 0.62; // half-width of the warp

  // frame
  for (const sx of [-0.78, 0.78]) {
    for (const sz of [-0.85, 0.8]) g.add(box(0.09, 1.9, 0.09, M.oak, sx, 0.95, sz));
    g.add(box(0.08, 0.09, 1.74, M.oak, sx, 1.86, -0.025));
    g.add(box(0.07, 0.09, 1.74, M.oak, sx, 0.72, -0.025));
  }
  for (const sz of [-0.85, 0.8]) g.add(box(1.56, 0.09, 0.08, M.oak, 0, 1.86, sz));
  g.add(box(1.56, 0.08, 0.07, M.oak, 0, 0.3, -0.85));

  // warp beam, back rest, breast beam, cloth beam
  const warpBeam = cyl(0.1, 1.4, M.yarn, 'x', 0, 0.62, -0.78, 14);
  g.add(warpBeam, cyl(0.03, 1.6, M.dark, 'x', 0, 0.62, -0.78, 8));
  g.add(cyl(0.03, 1.5, M.oak, 'x', 0, WARP_Y - 0.03, BACK_Z, 10));
  g.add(box(1.5, 0.07, 0.07, M.oak, 0, WARP_Y - 0.04, 0.74));
  const clothBeam = new THREE.Group();
  clothBeam.position.set(0, 0.52, 0.62);
  clothBeam.add(cyl(0.04, 1.6, M.dark, 'x', 0, 0, 0, 8));
  const clothRoll = cyl(0.06, 1.26, M.cloth, 'x', 0, 0, 0, 14);
  clothBeam.add(clothRoll);
  for (const sx of [-0.72, 0.72]) clothBeam.add(box(0.02, 0.2, 0.03, M.iron, sx, 0, 0), box(0.02, 0.03, 0.2, M.iron, sx, 0, 0));
  g.add(clothBeam);

  // static sheets: warp from beam to back rest, cloth from fell over the breast beam to the roll
  g.add(quad(V(-W, 0.7, -0.74), V(W, 0.7, -0.74), V(W, WARP_Y, BACK_Z), V(-W, WARP_Y, BACK_Z), M.warpSheet));
  g.add(quad(V(-W, WARP_Y, FELL_Z), V(W, WARP_Y, FELL_Z), V(W, WARP_Y, 0.775), V(-W, WARP_Y, 0.775), M.cloth));
  g.add(quad(V(-W, WARP_Y, 0.775), V(W, WARP_Y, 0.775), V(W, 0.56, 0.66), V(-W, 0.56, 0.66), M.cloth));

  // heddle shafts hung over a top roller, tied below to the treadles
  g.add(cyl(0.035, 1.5, M.oak, 'x', 0, 1.72, 0, 10));
  const shafts: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Group();
    s.add(box(1.36, 0.03, 0.02, M.pine, 0, 0.2, 0), box(1.36, 0.03, 0.02, M.pine, 0, -0.2, 0));
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < THREADS / 2; k++) {
      const x = -W + ((k * 2 + i + 0.5) / THREADS) * 2 * W;
      pts.push(V(x, 0.2, 0), V(x, -0.2, 0));
    }
    for (const sx of [-0.5, 0.5]) pts.push(V(sx, 0.2, 0), V(sx, 0.72, 0), V(sx * 0.3, -0.2, 0), V(sx * 0.3, -0.8, 0));
    s.add(lines(pts, LINE.cord));
    s.position.set(0, WARP_Y, HEDDLE_Z[i]);
    g.add(s);
    shafts.push(s);
  }
  const treadles: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const tr = new THREE.Group();
    tr.position.set(i === 0 ? -0.15 : 0.15, 0.07, -0.7);
    tr.add(box(0.09, 0.03, 1.5, M.pine, 0, 0, 0.75));
    g.add(tr);
    treadles.push(tr);
  }

  // batten (sley): swords hung from the top rails, race board, reed, shuttle boxes
  const batten = new THREE.Group();
  batten.position.set(0, 1.9, 0.22);
  for (const sx of [-0.7, 0.7]) batten.add(box(0.04, 1.02, 0.05, M.oak, sx, -0.5, 0));
  batten.add(cyl(0.025, 1.6, M.oak, 'x', 0, 0, 0, 8));
  const raceY = -BATTEN_L - 0.03;
  batten.add(box(2.5, 0.05, 0.11, M.pine, 0, raceY, 0.02)); // race board, in front of the reed
  batten.add(box(1.3, 0.16, 0.012, M.dark, 0, raceY + 0.11, -0.03)); // reed, behind the shuttle
  batten.add(box(1.42, 0.04, 0.05, M.oak, 0, raceY + 0.2, -0.03)); // hand rail / reed cap
  const pickers: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    batten.add(box(0.5, 0.07, 0.012, M.pine, sx * 1.0, raceY + 0.06, 0.075));
    batten.add(box(0.5, 0.07, 0.012, M.pine, sx * 1.0, raceY + 0.06, -0.03));
    batten.add(rod(V(sx * 0.78, raceY + 0.1, 0.02), V(sx * 1.24, raceY + 0.1, 0.02), 0.006, M.iron)); // picker spindle
    const p = box(0.04, 0.07, 0.06, M.leather, sx * 1.2, raceY + 0.07, 0.02);
    batten.add(p);
    pickers.push(p);
  }
  const shuttle = new THREE.Group();
  shuttle.add(box(0.16, 0.03, 0.04, M.dark));
  shuttle.add(cyl(0.002, 0.06, M.dark, 'x', -0.1, 0, 0, 4, 0.02), cyl(0.02, 0.06, M.dark, 'x', 0.1, 0, 0, 4, 0.002));
  shuttle.add(cyl(0.012, 0.1, M.yarn, 'x', 0, 0.012, 0, 6));
  shuttle.position.y = raceY + 0.045;
  shuttle.position.z = 0.02;
  batten.add(shuttle);
  const peg = box(0.03, 0.12, 0.03, M.oak, 0, -0.45, 0.12);
  batten.add(peg);
  const cords = new DynLines(4, LINE.cord);
  batten.add(cords.obj);
  g.add(batten);

  const warp = new DynLines(THREADS * 2, LINE.yarn);
  g.add(warp.obj);

  // weaver's bench and the weaver
  g.add(box(1.0, 0.05, 0.25, M.pine, 0, 0.5, 1.0), box(0.05, 0.5, 0.2, M.pine, -0.45, 0.25, 1.0), box(0.05, 0.5, 0.2, M.pine, 0.45, 0.25, 1.0));
  const weaver = worker('adult');
  weaver.position.set(0, 0, 1.22);
  g.add(weaver);

  return {
    group: g,
    height: 2.0,
    workers: [weaver],
    labels: [
      { name: 'Flying shuttle', desc: 'Runs on the race board from box to box, trailing the weft through the open shed.', p: V(0.3, 0.98, 0.2) },
      { name: 'Shuttle box and picker', desc: 'The leather picker slides on a spindle and knocks the shuttle out of the box.', p: V(1.15, 0.98, 0.2) },
      { name: 'Picking peg', desc: 'One jerk of the peg pulls a cord to either picker. The weaver keeps the other hand on the batten.', p: V(0, 1.45, 0.34) },
      { name: 'Batten and reed', desc: 'The reed stands behind the shuttle. After every pick the batten swings forward and the reed beats the weft against the cloth.', p: V(-0.5, 1.12, 0.25) },
      { name: 'Heddles', desc: 'Two shafts, each carrying alternate warp threads. Raising one and lowering the other opens the shed.', p: V(0.4, 1.2, 0) },
      { name: 'Treadles', desc: 'Worked by the feet to change the shed.', p: V(0.15, 0.1, 0.4) },
      { name: 'Warp beam', desc: 'Holds the warp and lets it off as the cloth is taken up.', p: V(0, 0.72, -0.78) },
      { name: 'Cloth beam', desc: 'The finished piece is wound here.', p: V(0.4, 0.58, 0.66) },
    ],
    animate(t, fill) {
      const c = t / PICK;
      const k = Math.floor(c);
      const u = c - k;
      const cur = k % 2 === 0 ? 1 : -1;
      const lift = (-cur + 2 * cur * smooth(u / 0.18)) * LIFT; // shed changes at the start of each pick
      shafts[0].position.y = WARP_Y + lift;
      shafts[1].position.y = WARP_Y - lift;
      treadles[0].rotation.x = -0.05 + (lift / LIFT) * 0.05;
      treadles[1].rotation.x = -0.05 - (lift / LIFT) * 0.05;

      const from = k % 2 === 0 ? -1 : 1;
      const fly = smooth((u - 0.2) / 0.25);
      shuttle.position.x = from * (1 - 2 * fly) * 1.02;
      // the picker on the throwing side snaps inward, then both rest
      const snap = pw(u, [[0.18, 0], [0.24, 1], [0.4, 0], [1, 0]]);
      pickers[0].position.x = -1.2 + (from < 0 ? snap * 0.36 : 0);
      pickers[1].position.x = 1.2 - (from > 0 ? snap * 0.36 : 0);
      peg.position.x = -from * snap * 0.12;

      const beat = pw(u, [[0.5, 0], [0.68, 1], [0.73, 1], [1, 0]]);
      batten.rotation.x = BATTEN_BACK + (BATTEN_BEAT - BATTEN_BACK) * smooth(beat);

      cords.begin();
      for (let i = 0; i < 2; i++) cords.seg(peg.position.x, -0.5, 0.12, pickers[i].position.x, raceY + 0.1, 0.02);
      cords.end();

      warp.begin();
      for (let i = 0; i < THREADS; i++) {
        const x = -W + ((i + 0.5) / THREADS) * 2 * W;
        const s = i % 2;
        const y = WARP_Y + (s === 0 ? lift : -lift);
        warp.seg(x, WARP_Y, BACK_Z, x, y, HEDDLE_Z[s]);
        warp.seg(x, y, HEDDLE_Z[s], x, WARP_Y, FELL_Z);
      }
      warp.end();

      clothBeam.rotation.x = c * 0.02;
      const r = 1 + 1.6 * fill;
      clothRoll.scale.set(1, r, r);
      const wr = 1.25 - 0.6 * fill;
      warpBeam.scale.set(1, wr, wr);
    },
  };
}
