import * as THREE from 'three';
import { DynLines, LINE, M, V, band, box, cyl, lines, pw, rod, smooth, spokedWheel, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const CYCLE = 9; // seconds for one stretch
const N = 12; // spindles
const SPX = -0.72; // spindle row
const TILT = 0.2; // spindles lean towards the clove
const CLOVE_IN = -0.42;
const CLOVE_OUT = 0.74;

/** wheel turns: pay out, draw, extra twist, back off, wind on */
const TURNS: [number, number][] = [[0, 0], [0.08, 0.2], [0.55, 2.4], [0.68, 4.0], [0.74, 3.85], [1, 4.75]];
const CLOVE: [number, number][] = [[0, 0], [0.08, 0.13], [0.55, 1], [0.74, 1], [0.98, 0], [1, 0]];
const FALLER: [number, number][] = [[0, 0], [0.68, 0], [0.74, 1], [0.97, 1], [1, 0]];

/** Hargreaves' spinning jenny in its improved form, with a vertical wheel at the side. */
export function buildJenny(): MachineModel {
  const g = new THREE.Group();

  // frame: four legs, long side rails the clove runs on
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.56, 0.56]) g.add(box(0.07, 0.86, 0.07, M.oak, sx, 0.43, sz));
  for (const sz of [-0.56, 0.56]) {
    g.add(box(1.77, 0.06, 0.06, M.oak, 0, 0.83, sz));
    g.add(box(1.77, 0.06, 0.05, M.oak, 0, 0.2, sz));
  }
  for (const sx of [-0.85, 0.85]) g.add(box(0.06, 0.06, 1.12, M.oak, sx, 0.2, 0));
  g.add(box(0.06, 0.06, 1.12, M.oak, 0.85, 0.83, 0));

  // spindle rails and spindles
  g.add(box(0.07, 0.05, 1.12, M.oak, SPX - 0.05, 0.42, 0), box(0.05, 0.04, 1.12, M.oak, SPX + 0.02, 0.66, 0));
  const spindles: THREE.Group[] = [];
  const cops: THREE.Mesh[] = [];
  const zs: number[] = [];
  for (let i = 0; i < N; i++) {
    const z = -0.44 + (i * 0.88) / (N - 1);
    zs.push(z);
    const tilt = new THREE.Group();
    tilt.position.set(SPX - 0.05, 0.42, z);
    tilt.rotation.z = -TILT;
    const sp = new THREE.Group();
    sp.add(cyl(0.006, 0.5, M.steel, 'y', 0, 0.25, 0, 6));
    sp.add(cyl(0.022, 0.035, M.dark, 'y', 0, 0.06, 0, 8));
    const cop = cyl(0.028, 0.16, M.yarn, 'y', 0, 0.36, 0, 8, 0.008);
    sp.add(cop);
    cops.push(cop);
    tilt.add(sp);
    g.add(tilt);
    spindles.push(sp);
  }
  const tipX = SPX - 0.05 + Math.sin(TILT) * 0.5;
  const tipY = 0.42 + Math.cos(TILT) * 0.5;
  const copX = SPX - 0.05 + Math.sin(TILT) * 0.36;
  const copY = 0.42 + Math.cos(TILT) * 0.36;

  // tin drum and the bands to each whorl
  const drum = new THREE.Group();
  drum.position.set(-0.4, 0.34, 0);
  drum.add(cyl(0.09, 1.0, M.tin, 'z', 0, 0, 0, 16), cyl(0.012, 1.5, M.iron, 'z', 0, 0, 0.1, 6));
  drum.add(cyl(0.07, 0.05, M.dark, 'z', 0, 0, 0.74, 12), box(0.02, 0.16, 0.02, M.iron, 0, 0, 0.52));
  g.add(drum);
  const whorlX = SPX - 0.05 + Math.sin(TILT) * 0.06;
  const whorlY = 0.42 + Math.cos(TILT) * 0.06;
  const bandPts: THREE.Vector3[] = [];
  for (const z of zs) bandPts.push(V(-0.4, 0.43, z), V(whorlX, whorlY + 0.02, z), V(-0.4, 0.25, z), V(whorlX, whorlY - 0.02, z));
  g.add(lines(bandPts, LINE.band));

  // great wheel at the side, turned by a handle
  const WZ = 0.74;
  g.add(box(0.08, 1.0, 0.06, M.oak, 0.15, 0.5, WZ - 0.1));
  const wheel = new THREE.Group();
  wheel.position.set(0.15, 0.95, WZ);
  wheel.add(spokedWheel({ r: 0.5, rimT: 0.025, rimW: 0.05, spokes: 8, hubR: 0.05, hubLen: 0.1, spokeT: 0.02, m: M.pine, axis: 'z' }));
  wheel.add(cyl(0.015, 0.14, M.iron, 'z', 0.3, 0, 0.09, 6));
  g.add(wheel);
  g.add(band({ h: 0.15, y: 0.95, r: 0.5 }, { h: -0.4, y: 0.34, r: 0.07 }, 'z', WZ));

  // creel of roving bobbins low in the frame
  g.add(box(0.5, 0.03, 1.06, M.pine, 0.32, 0.3, 0));
  const creelX = 0.32;
  for (let i = 0; i < N; i++) {
    g.add(cyl(0.004, 0.2, M.iron, 'y', creelX + (i % 2 ? 0.1 : -0.1), 0.4, zs[i], 4));
    g.add(cyl(0.035, 0.13, M.cotton, 'y', creelX + (i % 2 ? 0.1 : -0.1), 0.4, zs[i], 8));
  }

  // clove: a pair of clasping bars on a carriage that slides on the side rails
  const clove = new THREE.Group();
  clove.position.y = 0.86;
  clove.add(box(0.05, 0.035, 1.24, M.oak, 0, 0.03, 0));
  const clasp = box(0.05, 0.03, 1.24, M.pine, 0, 0.075, 0);
  clove.add(clasp);
  for (const sz of [-0.56, 0.56]) clove.add(box(0.16, 0.03, 0.09, M.oak, 0, 0.005, sz), cyl(0.02, 0.03, M.iron, 'z', 0.05, 0, sz, 8), cyl(0.02, 0.03, M.iron, 'z', -0.05, 0, sz, 8));
  clove.add(box(0.03, 0.03, 0.14, M.dark, 0, 0.1, 0.3));
  g.add(clove);

  // faller wire on two arms pivoted on the spindle rail
  const faller = new THREE.Group();
  faller.position.set(SPX + 0.02, 0.68, 0);
  for (const sz of [-0.5, 0.5]) faller.add(rod(V(0, 0, sz), V(0.13, 0.26, sz), 0.006, M.iron));
  faller.add(rod(V(0.13, 0.26, -0.5), V(0.13, 0.26, 0.5), 0.004, M.steel));
  g.add(faller);

  const yarn = new DynLines(N * 3, LINE.yarn);
  g.add(yarn.obj);

  const spinner = worker('adult');
  const child = worker('child');
  child.position.set(0.75, 0, -0.85);
  g.add(spinner, child);

  return {
    group: g,
    height: 1.5,
    workers: [spinner, child],
    labels: [
      { name: 'Spindles', desc: 'A row of spindles all turned at once. Twist runs up the thread as it slips over each tip.', p: V(tipX, tipY, 0.2) },
      { name: 'Clove', desc: 'A wooden clasp that grips the rovings. Drawn back along the frame it stretches them to fineness.', p: V(0.3, 0.96, -0.2) },
      { name: 'Great wheel', desc: 'Turned with the right hand while the left works the clove.', p: V(0.15, 1.4, WZ) },
      { name: 'Tin drum and bands', desc: 'The wheel turns the drum; a separate band runs from the drum to each spindle.', p: V(-0.4, 0.44, -0.3) },
      { name: 'Faller wire', desc: 'Pressed down to guide the spun thread onto the spindle as the clove returns.', p: V(SPX + 0.15, 0.94, -0.4) },
      { name: 'Roving creel', desc: 'Bobbins of roving, prepared by hand carding or bought from a carding mill.', p: V(creelX, 0.47, 0.3) },
    ],
    animate(t) {
      const c = t / CYCLE;
      const k = Math.floor(c);
      const u = c - k;
      const turns = k * 4.75 + pw(u, TURNS);
      wheel.rotation.z = -turns * TAU;
      drum.rotation.z = -turns * TAU * (0.5 / 0.07) * 0.25; // slowed for the eye
      for (const s of spindles) s.rotation.y = turns * TAU * 6;

      const cx = CLOVE_IN + (CLOVE_OUT - CLOVE_IN) * pw(u, CLOVE);
      clove.position.x = cx;
      clasp.position.y = u < 0.08 || u > 0.98 ? 0.1 : 0.065; // open while roving is paid out
      const f = smooth(pw(u, FALLER));
      faller.rotation.z = -f * 0.75;
      const cs = Math.cos(-f * 0.75);
      const sn = Math.sin(-f * 0.75);
      const fx = SPX + 0.02 + 0.13 * cs - 0.26 * sn;
      const fy = 0.68 + 0.13 * sn + 0.26 * cs;

      const grow = 0.45 + 0.55 * ((c / 10) % 1);
      yarn.begin();
      for (let i = 0; i < N; i++) {
        const z = zs[i];
        yarn.seg(creelX + (i % 2 ? 0.1 : -0.1), 0.47, z, cx, 0.92, z);
        if (f > 0.02) {
          yarn.seg(cx, 0.92, z, fx, fy, z);
          yarn.seg(fx, fy, z, copX, copY, z);
        } else {
          yarn.seg(cx, 0.92, z, tipX, tipY, z);
        }
        cops[i].scale.set(grow, 1, grow);
      }
      yarn.end();
      spinner.position.set(1.02, 0, 0.05 + 0.2 * pw(u, CLOVE));
    },
  };
}
