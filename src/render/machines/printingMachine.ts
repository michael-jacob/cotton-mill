import * as THREE from 'three';
import { M, V, box, cyl, meshPhase, pitchR, rod, spokedWheel, spurGear, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const BOWL = { y: 1.05, z: 0, r: 0.38 };
const RR = 0.09; // engraved rollers
const GP = 0.0393;
const NB = 48;
const NP = 16;
const HW = 0.5;

function ribbon(pts: [number, number][], mat: THREE.Material, half = HW - 0.04): THREE.Mesh {
  const v: THREE.Vector3[] = [];
  for (const [y, z] of pts) v.push(V(-half, y, z), V(half, y, z));
  const g = new THREE.BufferGeometry().setFromPoints(v);
  const idx: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    uv.push(0, i / 2, 1, i / 2);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** Bell's cylinder printing machine, set for three colours. Cloth enters at the back (-z) and leaves upward at the front. */
export function buildPrintingMachine(): MachineModel {
  const g = new THREE.Group();

  // iron side frames
  for (const sx of [-0.62, 0.62]) {
    g.add(box(0.07, 0.08, 1.5, M.iron, sx, 0.04, 0));
    g.add(rod(V(sx, 0.05, -0.7), V(sx, 1.5, -0.12), 0.035, M.iron), rod(V(sx, 0.05, 0.7), V(sx, 1.5, 0.12), 0.035, M.iron));
    g.add(box(0.07, 0.07, 1.0, M.iron, sx, 0.62, 0), box(0.07, 0.34, 0.3, M.iron, sx, BOWL.y, 0), box(0.06, 1.0, 0.06, M.iron, sx, 1.9, 0.3));
  }
  g.add(box(1.3, 0.06, 0.06, M.iron, 0, 2.4, 0.3));

  // pressure bowl, lapped with cloth, and its gear
  const bowl = new THREE.Group();
  bowl.position.set(0, BOWL.y, BOWL.z);
  bowl.add(cyl(BOWL.r, 2 * HW, M.cloth, 'x', 0, 0, 0, 32), cyl(0.04, 1.5, M.steel, 'x', 0, 0, 0, 8));
  const GX = -0.72;
  const gb = spurGear(NB, GP, 0.05, M.iron, 'x');
  gb.position.x = GX;
  const pdir = V(0, -0.72, -0.69).normalize();
  gb.rotation.x = meshPhase('x', pdir, NB, false);
  bowl.add(gb);
  g.add(bowl);
  const cd = pitchR(NB, GP) + pitchR(NP, GP);
  const drive = new THREE.Group();
  drive.position.set(0, BOWL.y + pdir.y * cd, BOWL.z + pdir.z * cd);
  drive.add(cyl(0.025, 1.7, M.steel, 'x', 0.02, 0, 0, 8));
  const gp = spurGear(NP, GP, 0.05, M.iron, 'x');
  gp.position.x = GX;
  gp.rotation.x = meshPhase('x', pdir.clone().negate(), NP, true);
  drive.add(gp);
  const PX = 0.8;
  drive.add(spokedWheel({ r: 0.18, rimT: 0.025, rimW: 0.09, spokes: 4, hubR: 0.04, hubLen: 0.09, spokeT: 0.025, m: M.iron, axis: 'x' }).translateX(PX));
  g.add(drive);

  // three engraved copper rollers about the lower half of the bowl, each with its colour box
  const colours = [M.madder, M.indigo, M.weld];
  const names = ['madder red', 'indigo blue', 'weld yellow'];
  const rollers: THREE.Mesh[] = [];
  const furnishers: THREE.Mesh[] = [];
  [0.95, 0, -0.95].forEach((a, i) => {
    // angle measured from straight down, positive towards the front
    const cy = BOWL.y - Math.cos(a) * (BOWL.r + RR);
    const cz = BOWL.z + Math.sin(a) * (BOWL.r + RR);
    const r = cyl(RR, 2 * HW, M.copper, 'x', 0, cy, cz, 20);
    r.add(box(2 * HW, 0.01, 2 * RR + 0.004, M.brass)); // a seam, so the turning shows
    g.add(r);
    rollers.push(r);
    const oy = cy - Math.cos(a) * 0.2;
    const oz = cz + Math.sin(a) * 0.2;
    g.add(box(2 * HW + 0.06, 0.1, 0.2, M.oak, 0, oy - 0.04, oz), box(2 * HW, 0.02, 0.16, colours[i], 0, oy + 0.015, oz));
    const f = cyl(0.05, 2 * HW, colours[i], 'x', 0, (cy + oy) / 2 + 0.02, (cz + oz) / 2, 12);
    g.add(f);
    furnishers.push(f);
    // doctor: a steel blade that scrapes the roller clean but for the engraving
    const doc = box(2 * HW, 0.012, 0.12, M.steel, 0, cy + 0.04, cz + (a >= 0 ? 0.13 : -0.13));
    doc.rotation.x = a >= 0 ? 0.5 : -0.5;
    g.add(doc);
  });

  // cloth: white from a roll at the back, under the bowl past the rollers, then printed, up and over to dry
  const roll = cyl(0.2, 2 * HW - 0.08, M.cotton, 'x', 0, 0.42, -0.95, 20);
  g.add(roll, cyl(0.025, 1.3, M.dark, 'x', 0, 0.42, -0.95, 8));
  for (const sx of [-0.6, 0.6]) g.add(box(0.05, 0.5, 0.05, M.oak, sx, 0.25, -0.95));
  const rr = BOWL.r + 0.006;
  const under: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -1.5 + (3.0 * i) / 12;
    under.push([BOWL.y - Math.cos(a) * rr, BOWL.z + Math.sin(a) * rr]);
  }
  g.add(ribbon([[0.6, -0.9], [BOWL.y - Math.cos(-1.5) * rr, BOWL.z + Math.sin(-1.5) * rr]], M.cloth));
  g.add(ribbon(under.slice(0, 5), M.cloth), ribbon(under.slice(4), M.printed));
  g.add(ribbon([under[12], [2.32, 0.34], [2.38, 0.3], [2.32, 0.2], [1.2, -0.25]], M.printed));
  const top = cyl(0.05, 1.2, M.pine, 'x', 0, 2.33, 0.3, 10);
  g.add(top);

  const printer = worker('adult');
  printer.position.set(0.2, 0, 1.0);
  const back = worker('child');
  back.position.set(-0.3, 0, -1.3 + 0.35);
  const tenter = worker('adult');
  tenter.position.set(1.2, 0, 0.3);
  g.add(printer, back, tenter);

  return {
    group: g,
    height: 2.5,
    workers: [printer, back, tenter],
    pulley: { x: PX, y: drive.position.y, z: drive.position.z, r: 0.18 },
    labels: [
      { name: 'Pressure bowl', desc: 'A heavy iron cylinder lapped with cloth. The calico passes round it and is pressed against each roller in turn.', p: V(0.3, BOWL.y + 0.3, 0.25) },
      { name: 'Engraved roller', desc: 'Copper, with the pattern cut into its surface. One roller for each colour: here ' + names.join(', ') + '.', p: V(0.2, BOWL.y - BOWL.r - RR, 0) },
      { name: 'Colour box and furnisher', desc: 'A wooden roller turning in the colour box carries thickened dye up to the engraved roller.', p: V(-0.2, 0.42, 0.52) },
      { name: 'Doctor', desc: 'A steel blade pressed against the roller scrapes off all the colour except what lies in the engraving.', p: V(0.4, BOWL.y - 0.2, 0.52) },
      { name: 'Printed cloth', desc: 'Leaves the bowl with every colour laid on at one pass, and is led away overhead to the drying room.', p: V(0, 1.9, 0.33) },
      { name: 'Bowl wheel and pinion', desc: `${NP} teeth driving ${NB}: the bowl must turn slowly and with great force.`, p: V(GX, BOWL.y, 0.2) },
    ],
    animate(t) {
      const a = t * 0.22 * TAU;
      bowl.rotation.x = -a;
      drive.rotation.x = (a * NB) / NP;
      const k = BOWL.r / RR;
      for (const r of rollers) r.rotation.x = a * k;
      for (const f of furnishers) f.rotation.x = -a * k * 1.6;
      roll.rotation.x = -a * 1.8;
      top.rotation.x = -a * 6;
      const s = 1 - 0.5 * ((t / 50) % 1);
      roll.scale.set(1, s, s);
    },
  };
}
