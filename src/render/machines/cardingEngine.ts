import * as THREE from 'three';
import { M, V, band, box, cyl, rod, setRod, spokedWheel, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const CYL_RPS = 1.1; // main cylinder, slowed for the eye (really about 2 turns a second)

// centres of the three carding rollers in the z-y plane
const MAIN = { z: -0.1, y: 0.95, r: 0.5 };
const LICKER = { z: -0.75, y: 0.8, r: 0.12 };
const DOFFER = { z: 0.67, y: 0.85, r: 0.25 };
const LICKER_RATIO = 0.2 / 0.07;
const DOFFER_RATIO = 0.04 / 0.22;
const COMB_RATIO = 3;

/** Cylinder carding engine with flats and Arkwright's crank and comb. Cotton travels towards +z. */
export function buildCardingEngine(): MachineModel {
  const g = new THREE.Group();

  // timber framing either side
  for (const sx of [-0.58, 0.58]) {
    g.add(box(0.1, 0.1, 2.5, M.oak, sx, 0.05, 0));
    g.add(box(0.1, 0.1, 2.3, M.oak, sx, 0.72, 0));
    for (const z of [-1.1, -0.42, 0.3, 1.1]) g.add(box(0.1, 0.62, 0.1, M.oak, sx, 0.4, z));
    // bearing pedestals
    g.add(box(0.1, 0.18, 0.16, M.iron, sx, MAIN.y - 0.1, MAIN.z));
    g.add(box(0.1, 0.1, 0.1, M.iron, sx, DOFFER.y - 0.06, DOFFER.z));
    g.add(box(0.1, 0.08, 0.08, M.iron, sx, LICKER.y - 0.03, LICKER.z));
  }
  for (const z of [-1.1, 1.1]) g.add(box(1.06, 0.08, 0.08, M.oak, 0, 0.3, z));

  // main cylinder
  const main = new THREE.Group();
  main.position.set(0, MAIN.y, MAIN.z);
  main.add(cyl(MAIN.r, 0.96, M.card, 'x', 0, 0, 0, 40));
  main.add(cyl(0.025, 1.62, M.steel, 'x', 0, 0, 0, 8));
  for (const sx of [-0.485, 0.485]) main.add(spokedWheel({ r: MAIN.r - 0.01, rimT: 0.05, rimW: 0.012, spokes: 6, hubR: 0.07, hubLen: 0.02, spokeT: 0.05, m: M.dark, axis: 'x' }).translateX(sx));
  // driving pulley (belt from the line shaft) and take-off pulleys
  const PX = 0.74;
  main.add(spokedWheel({ r: 0.22, rimT: 0.03, rimW: 0.1, spokes: 4, hubR: 0.05, hubLen: 0.1, spokeT: 0.03, m: M.iron, axis: 'x' }).translateX(PX));
  main.add(cyl(0.2, 0.03, M.dark, 'x', -0.68, 0, 0, 16), cyl(0.04, 0.03, M.dark, 'x', -0.73, 0, 0, 10), cyl(0.09, 0.03, M.dark, 'x', 0.66, 0, 0, 12));
  g.add(main);

  // licker-in and feed
  const licker = new THREE.Group();
  licker.position.set(0, LICKER.y, LICKER.z);
  licker.add(cyl(LICKER.r, 0.94, M.card, 'x', 0, 0, 0, 20), cyl(0.015, 1.5, M.steel, 'x', 0, 0, 0, 6), cyl(0.07, 0.03, M.dark, 'x', -0.68, 0, 0, 12));
  g.add(licker);
  const feedRollers = [cyl(0.03, 0.94, M.steel, 'x', 0, LICKER.y + 0.035, -0.93, 8), cyl(0.03, 0.94, M.steel, 'x', 0, LICKER.y - 0.03, -0.93, 8)];
  g.add(...feedRollers);
  g.add(box(0.96, 0.03, 0.5, M.pine, 0, LICKER.y - 0.02, -1.2));
  g.add(box(0.03, 0.08, 0.5, M.pine, -0.47, LICKER.y + 0.03, -1.2), box(0.03, 0.08, 0.5, M.pine, 0.47, LICKER.y + 0.03, -1.2));
  g.add(box(0.88, 0.05, 0.46, M.cotton, 0, LICKER.y + 0.02, -1.2));

  // flats: stationary card-covered bars over the top of the cylinder
  for (let i = 0; i < 9; i++) {
    const a = (-56 + i * 14) * (Math.PI / 180); // from vertical, towards +z
    const flat = new THREE.Group();
    flat.add(box(1.02, 0.04, 0.1, M.pine, 0, 0.012, 0), box(0.94, 0.014, 0.09, M.card, 0, -0.012, 0));
    flat.position.set(0, MAIN.y + Math.cos(a) * (MAIN.r + 0.035), MAIN.z + Math.sin(a) * (MAIN.r + 0.035));
    flat.rotation.x = a;
    g.add(flat);
  }
  // arched bends carrying the flats
  for (const sx of [-0.53, 0.53]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(MAIN.r + 0.04, 0.018, 6, 20, 2.1), M.iron);
    arc.rotation.y = Math.PI / 2;
    arc.rotation.order = 'YXZ';
    arc.rotation.z = Math.PI / 2 - 1.05;
    arc.position.set(sx, MAIN.y, MAIN.z);
    g.add(arc);
  }

  // doffer
  const doffer = new THREE.Group();
  doffer.position.set(0, DOFFER.y, DOFFER.z);
  doffer.add(cyl(DOFFER.r, 0.94, M.card, 'x', 0, 0, 0, 28), cyl(0.018, 1.56, M.steel, 'x', 0, 0, 0, 6), cyl(0.22, 0.03, M.dark, 'x', -0.73, 0, 0, 16));
  g.add(doffer);

  // side drives (bands): cylinder to licker-in (crossed), cylinder to doffer (crossed, much reduced)
  g.add(band({ h: MAIN.z, y: MAIN.y, r: 0.2 }, { h: LICKER.z, y: LICKER.y, r: 0.07 }, 'x', -0.68, true));
  g.add(band({ h: MAIN.z, y: MAIN.y, r: 0.04 }, { h: DOFFER.z, y: DOFFER.y, r: 0.22 }, 'x', -0.73, true));

  // crank and comb: a crank disc below the doffer works the comb bar up and down across its face
  const CR = { x: 0.66, y: 0.42, z: 1.0, r: 0.045 };
  const crank = new THREE.Group();
  crank.position.set(CR.x, CR.y, CR.z);
  crank.add(cyl(0.07, 0.025, M.iron, 'x', 0, 0, 0, 14), cyl(0.012, 0.05, M.steel, 'x', 0.03, CR.r, 0, 6));
  g.add(crank, cyl(0.012, 0.14, M.steel, 'x', CR.x - 0.06, CR.y, CR.z, 6), box(0.08, 0.36, 0.08, M.oak, 0.58, 0.28, CR.z));
  g.add(band({ h: MAIN.z, y: MAIN.y, r: 0.09 }, { h: CR.z, y: CR.y, r: 0.03 }, 'x', 0.66));
  const comb = new THREE.Group();
  comb.add(box(1.3, 0.05, 0.012, M.steel), box(0.94, 0.02, 0.02, M.iron, 0, -0.03, -0.008));
  const combZ = DOFFER.z + DOFFER.r + 0.012;
  comb.position.set(0, DOFFER.y - 0.1, combZ);
  g.add(comb);
  for (const sx of [-0.66, 0.66]) g.add(box(0.03, 0.4, 0.03, M.iron, sx, DOFFER.y - 0.12, combZ + 0.03)); // comb guides
  const conRod = rod(V(), V(0, 1, 0), 0.008, M.steel);
  g.add(conRod);

  // the web converging to a funnel, calender rollers, sliver and can
  const webGeo = new THREE.BufferGeometry().setFromPoints([V(-0.44, DOFFER.y - 0.14, combZ), V(0.44, DOFFER.y - 0.14, combZ), V(0, 0.62, 1.22)]);
  webGeo.setIndex([0, 1, 2]);
  webGeo.computeVertexNormals();
  g.add(new THREE.Mesh(webGeo, M.web));
  g.add(cyl(0.05, 0.07, M.brass, 'z', 0, 0.61, 1.24, 10, 0.02));
  const cal = [cyl(0.035, 0.16, M.steel, 'x', 0, 0.645, 1.3, 10), cyl(0.035, 0.16, M.steel, 'x', 0, 0.575, 1.3, 10)];
  g.add(...cal, box(0.03, 0.5, 0.05, M.oak, -0.1, 0.4, 1.3), box(0.03, 0.5, 0.05, M.oak, 0.1, 0.4, 1.3));
  g.add(rod(V(0, 0.6, 1.32), V(0, 0.42, 1.36), 0.014, M.cotton));
  const canMat = M.tin.clone();
  canMat.side = THREE.DoubleSide;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.44, 16, 1, true), canMat);
  can.position.set(0, 0.22, 1.37);
  const coil = cyl(0.14, 0.4, M.cotton, 'y', 0, 0.2, 1.37, 14);
  g.add(can, coil);

  const feeder = worker('adult');
  feeder.position.set(-0.85, 0, -1.25);
  const tenter = worker('child');
  tenter.position.set(0.5, 0, 1.38);
  g.add(feeder, tenter);

  const a0 = V();
  const a1 = V();
  return {
    group: g,
    height: 1.6,
    workers: [feeder, tenter],
    pulley: { x: PX, y: MAIN.y, z: MAIN.z, r: 0.22 },
    labels: [
      { name: 'Main cylinder', desc: 'Covered in card clothing: leather set with thousands of bent wire teeth.', p: V(0.3, MAIN.y + 0.2, MAIN.z + 0.47) },
      { name: 'Licker-in', desc: 'Plucks cotton from the feed rollers and carries it to the cylinder.', p: V(0, LICKER.y + 0.12, LICKER.z) },
      { name: 'Feed apron', desc: 'A weighed fleece of cleaned cotton is spread here.', p: V(0, LICKER.y + 0.06, -1.25) },
      { name: 'Flats', desc: 'Fixed cards. Fibres are teased straight between their teeth and the cylinder passing beneath.', p: V(0, MAIN.y + MAIN.r + 0.07, MAIN.z) },
      { name: 'Doffer', desc: 'Turns slowly and gathers the carded fleece off the cylinder.', p: V(-0.2, DOFFER.y + 0.25, DOFFER.z) },
      { name: 'Crank and comb', desc: "Arkwright's 1775 device. The comb chops rapidly down the face of the doffer, stripping the fleece as one unbroken web.", p: V(0.6, DOFFER.y - 0.1, combZ) },
      { name: 'Funnel and can', desc: 'The web is drawn together into a sliver and coiled in a can.', p: V(0, 0.5, 1.37) },
      { name: 'Driving pulley', desc: 'Strap from the line shaft overhead.', p: V(PX, MAIN.y + 0.22, MAIN.z) },
    ],
    animate(t, fill) {
      const a = t * CYL_RPS * TAU;
      main.rotation.x = a;
      licker.rotation.x = -a * LICKER_RATIO;
      doffer.rotation.x = -a * DOFFER_RATIO;
      feedRollers[0].rotation.x = a * 0.1;
      feedRollers[1].rotation.x = -a * 0.1;
      cal[0].rotation.x = a * 0.6;
      cal[1].rotation.x = -a * 0.6;
      const ca = a * COMB_RATIO;
      crank.rotation.x = ca;
      // crank pin position (rotation about x takes +y towards +z)
      const py = CR.y + CR.r * Math.cos(ca);
      const pz = CR.z + CR.r * Math.sin(ca);
      const rodLen = DOFFER.y - 0.1 - CR.y;
      const dz = combZ + 0.03 - pz;
      const cy = py + Math.sqrt(Math.max(0, rodLen * rodLen - dz * dz));
      comb.position.y = cy;
      setRod(conRod, a0.set(CR.x + 0.04, py, pz), a1.set(CR.x + 0.04, cy, combZ + 0.03));
      const h = 0.25 + 0.75 * ((t / 40 + fill) % 1);
      coil.scale.y = h;
      coil.position.y = 0.2 * h + 0.01;
    },
  };
}
