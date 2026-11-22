import * as THREE from 'three';
import { M, V, box, cyl, rod, spokedWheel, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;

/** Bleaching croft: kier, a row of becks with winces over them, and a dash wheel. */
export function buildBleachWorks(): MachineModel {
  const g = new THREE.Group();

  // kier: a closed iron boiler in which the cloth is boiled in lye
  const KX = -0.95;
  const KZ = -0.9;
  g.add(box(1.0, 0.3, 1.0, M.brick, KX, 0.15, KZ));
  g.add(cyl(0.46, 1.2, M.iron, 'y', KX, 0.9, KZ, 24));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.iron);
  dome.scale.y = 0.5;
  dome.position.set(KX, 1.5, KZ);
  g.add(dome, cyl(0.47, 0.05, M.iron, 'y', KX, 0.6, KZ, 24), cyl(0.47, 0.05, M.iron, 'y', KX, 1.2, KZ, 24));
  g.add(rod(V(KX, 1.72, KZ), V(KX, 2.0, KZ), 0.04, M.copper), rod(V(KX, 2.0, KZ), V(KX, 2.0, KZ + 0.7), 0.04, M.copper), cyl(0.07, 0.1, M.brass, 'y', KX + 0.3, 1.66, KZ, 10));

  // three becks: chemic (chloride of lime), sour (weak vitriol) and clean water
  const liquors = [M.chemic, M.sour, M.rinse];
  const winces: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const z = -0.2 + i * 0.6;
    const x = -0.6;
    g.add(box(1.5, 0.5, 0.5, M.oak, x, 0.25, z), box(1.4, 0.02, 0.42, liquors[i], x, 0.46, z));
    for (const sx of [-0.78, 0.78]) g.add(box(0.06, 1.1, 0.06, M.oak, x + sx, 0.55, z));
    // wince: a slatted reel that draws the rope of cloth through the liquor
    const w = new THREE.Group();
    w.position.set(x, 1.05, z);
    w.add(cyl(0.02, 1.62, M.steel, 'x', 0, 0, 0, 6));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      w.add(box(1.3, 0.025, 0.05, M.pine, 0, Math.cos(a) * 0.17, Math.sin(a) * 0.17));
    }
    for (const sx of [-0.66, 0.66]) w.add(cyl(0.18, 0.02, M.pine, 'x', sx, 0, 0, 12));
    g.add(w);
    winces.push(w);
    // the cloth, in rope form, up over the wince and back into the beck
    for (const dx of [-0.35, 0.1, 0.5]) {
      g.add(rod(V(x + dx, 0.47, z - 0.14), V(x + dx, 1.22, z - 0.05), 0.022, M.cotton), rod(V(x + dx, 1.22, z + 0.05), V(x + dx, 0.47, z + 0.14), 0.022, M.cotton));
    }
  }

  // dash wheel: a hollow drum in which the cloth is tumbled under running water
  const DW = { x: 0.85, y: 0.85, z: 0.5, r: 0.62 };
  for (const sz of [-0.3, 0.3]) g.add(box(0.1, 0.9, 0.1, M.oak, DW.x - 0.35, 0.45, DW.z + sz * 2.6), box(0.1, 0.9, 0.1, M.oak, DW.x + 0.33, 0.45, DW.z + sz * 2.6));
  const dash = new THREE.Group();
  dash.position.set(DW.x, DW.y, DW.z);
  dash.add(cyl(DW.r, 0.5, M.pine, 'x', 0, 0, 0, 24), cyl(0.03, 1.2, M.steel, 'x', 0.1, 0, 0, 8));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.4;
    dash.add(box(0.52, 0.03, DW.r * 2, M.oak, 0, 0, 0).rotateX(a));
    dash.add(cyl(0.11, 0.02, M.dark, 'x', -0.26, Math.cos(a) * 0.36, Math.sin(a) * 0.36, 12)); // hand holes
  }
  const PX = 1.3;
  dash.add(spokedWheel({ r: 0.2, rimT: 0.025, rimW: 0.09, spokes: 4, hubR: 0.04, hubLen: 0.09, spokeT: 0.025, m: M.iron, axis: 'x' }).translateX(PX - DW.x));
  g.add(dash);
  g.add(rod(V(DW.x - 0.3, 1.7, DW.z), V(DW.x - 0.3, 1.2, DW.z), 0.03, M.copper), box(0.9, 0.12, 1.5, M.stoneDark, DW.x, 0.06, DW.z));
  // bleached pieces stacked ready
  for (let i = 0; i < 4; i++) g.add(box(0.5, 0.09, 0.32, M.cotton, 0.9, 0.06 + i * 0.1, -1.05));

  const a = worker('adult');
  a.position.set(-0.2, 0, 1.3);
  const b = worker('adult');
  b.position.set(0.25, 0, -0.9);
  const c = worker('child');
  c.position.set(1.25, 0, -0.4);
  g.add(a, b, c);

  return {
    group: g,
    height: 2.1,
    workers: [a, b, c],
    pulley: { x: PX, y: DW.y, z: DW.z, r: 0.2 },
    labels: [
      { name: 'Kier', desc: 'The grey cloth is boiled under pressure in lye for some hours to loosen grease, size and dirt.', p: V(KX, 1.3, KZ + 0.46) },
      { name: 'Chemic beck', desc: "Chloride of lime, Tennant's bleaching powder of 1799, dissolved in water. This is what whitens the cloth.", p: V(-0.6, 0.55, -0.2) },
      { name: 'Sour', desc: 'Weak oil of vitriol, which sets the chlorine free and clears the lime from the cloth.', p: V(-0.6, 0.55, 0.4) },
      { name: 'Wince', desc: 'A revolving reel that hauls the cloth, gathered into a rope, through each liquor.', p: V(-0.6, 1.28, 1.0) },
      { name: 'Dash wheel', desc: 'Between every stage the cloth is thrown about in this drum under a stream of clean water.', p: V(DW.x, DW.y + 0.5, DW.z + 0.4) },
    ],
    animate(t) {
      for (let i = 0; i < winces.length; i++) winces[i].rotation.x = t * 0.5 * TAU + i;
      dash.rotation.x = t * 0.35 * TAU;
    },
  };
}
