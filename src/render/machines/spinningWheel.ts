import * as THREE from 'three';
import { DynLines, LINE, M, V, band, box, cyl, pw, rod, spokedWheel, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const CYCLE = 5; // seconds for one draw and wind-on
/** wheel turns through the cycle: draw, back off, wind on */
const TURNS: [number, number][] = [[0, 0], [0.6, 2.0], [0.7, 1.85], [1, 2.65]];
const DRAW: [number, number][] = [[0, 0.15], [0.6, 1.2], [0.7, 1.2], [1, 0.15]];

/** The great wheel, with a pair of hand cards on a stool beside it. */
export function buildSpinningWheel(): MachineModel {
  const g = new THREE.Group();
  const bz = -0.45;

  // bench on three legs
  g.add(box(1.5, 0.06, 0.24, M.oak, 0, 0.45, bz));
  g.add(rod(V(-0.65, 0.45, bz - 0.08), V(-0.78, 0, bz - 0.22), 0.025, M.oak));
  g.add(rod(V(-0.65, 0.45, bz + 0.08), V(-0.78, 0, bz + 0.22), 0.025, M.oak));
  g.add(rod(V(0.65, 0.45, bz), V(0.82, 0, bz), 0.025, M.oak));

  // wheel post and wheel
  const wz = bz + 0.13;
  g.add(box(0.07, 0.72, 0.07, M.oak, 0.45, 0.82, bz));
  g.add(cyl(0.015, 0.2, M.iron, 'z', 0.45, 1.07, bz + 0.07, 8));
  const wheel = spokedWheel({ r: 0.55, rimT: 0.022, rimW: 0.06, spokes: 10, hubR: 0.05, hubLen: 0.12, spokeT: 0.018, m: M.pine, axis: 'z' });
  wheel.position.set(0.45, 1.07, wz);
  g.add(wheel);

  // spindle head
  g.add(box(0.06, 0.54, 0.06, M.oak, -0.6, 0.72, bz));
  const spindle = new THREE.Group();
  spindle.position.set(-0.6, 0.95, bz);
  spindle.add(cyl(0.006, 0.36, M.steel, 'z', 0, 0, 0.11, 6));
  spindle.add(cyl(0.025, 0.04, M.dark, 'z', 0, 0, 0.13, 10));
  const cop = cyl(0.03, 0.11, M.yarn, 'z', 0, 0, 0.21, 10, 0.006);
  spindle.add(cop);
  g.add(spindle);

  // driving band from the rim to the whorl
  g.add(band({ h: 0.45, y: 1.07, r: 0.55 }, { h: -0.6, y: 0.95, r: 0.025 }, 'z', wz));

  // stool, hand cards and a basket of cotton
  g.add(cyl(0.16, 0.04, M.pine, 'y', 0.6, 0.38, 0.6, 10));
  for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [0, 0.12]]) g.add(rod(V(0.6 + dx, 0.38, 0.6 + dz), V(0.6 + dx * 1.5, 0, 0.6 + dz * 1.5), 0.015, M.pine));
  const cardA = new THREE.Group();
  cardA.add(box(0.2, 0.015, 0.11, M.pine), box(0.19, 0.012, 0.1, M.card, 0, 0.012, 0), box(0.03, 0.02, 0.12, M.pine, 0, 0, 0.11));
  cardA.position.set(0.58, 0.41, 0.58);
  const cardB = cardA.clone();
  cardB.position.set(0.62, 0.44, 0.62);
  cardB.rotation.y = 0.5;
  g.add(cardA, cardB);
  g.add(cyl(0.2, 0.2, M.dark, 'y', 0.2, 0.1, 0.72, 12, 0.24));
  const fluff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), M.cotton);
  fluff.position.set(0.2, 0.2, 0.72);
  fluff.scale.y = 0.5;
  g.add(fluff);

  const yarn = new DynLines(2, LINE.yarn);
  g.add(yarn.obj);
  const spinner = worker('adult');
  g.add(spinner);

  const tip = V(-0.6, 0.95, bz + 0.29);
  const dir = V(0.5, 0.12, 0.85).normalize();

  return {
    group: g,
    height: 1.7,
    workers: [spinner],
    labels: [
      { name: 'Great wheel', desc: 'Turned by hand. Its rim drives the spindle through a band, many turns for one.', p: V(0.45, 1.5, wz) },
      { name: 'Driving band', desc: 'A cord from the wheel rim round the small whorl on the spindle.', p: V(-0.1, 1.28, wz) },
      { name: 'Spindle', desc: 'The thread twists as it slips off the spindle tip, then is wound on as a cop.', p: tip.clone() },
      { name: 'Hand cards', desc: 'Wire-toothed bats used in pairs to open and straighten the cotton before spinning.', p: V(0.6, 0.46, 0.6) },
    ],
    animate(t) {
      const c = t / CYCLE;
      const k = Math.floor(c);
      const u = c - k;
      const turns = k * 2.65 + pw(u, TURNS);
      wheel.rotation.z = -turns * TAU;
      spindle.rotation.z = -turns * TAU * 9;
      const L = pw(u, DRAW);
      const hx = tip.x + dir.x * L;
      const hy = tip.y + dir.y * L + 0.08;
      const hz = tip.z + dir.z * L;
      yarn.begin();
      yarn.seg(tip.x, tip.y, tip.z, hx, hy, hz);
      yarn.end();
      spinner.position.set(hx + 0.22, 0, hz + 0.1);
      cop.scale.set(0.5 + 0.5 * ((c / 12) % 1), 0.5 + 0.5 * ((c / 12) % 1), 1);
    },
  };
}
