import * as THREE from 'three';
import { M, V, band, box, cyl, rod, spokedWheel, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const BEATER = { y: 0.82, z: -0.15, r: 0.26 };
const CAGE = { y: 0.8, z: 0.38, r: 0.2 };
const FAN = { x: -1.12, y: 0.5, z: 0.38, r: 0.3 };
const LAP = { y: 0.52, z: 0.8 };

/** Scutcher (blowing machine). Cotton is fed at the back (-z) and leaves at the front as a rolled lap. */
export function buildScutcher(): MachineModel {
  const g = new THREE.Group();
  const HALF = 0.82; // half the working width

  // side frames
  for (const sx of [-0.88, 0.88]) {
    g.add(box(0.06, 0.06, 1.9, M.iron, sx, 0.03, 0));
    for (const z of [-0.9, -0.3, 0.2, 0.9]) g.add(box(0.06, 0.75, 0.07, M.iron, sx, 0.4, z));
    g.add(box(0.05, 0.07, 1.9, M.iron, sx, 0.74, 0));
    g.add(box(0.05, 0.6, 1.0, M.pine, sx * 0.98, 0.42, 0.0)); // casing sides
  }

  // feed lattice with the weighed cotton spread on it, and the feed rollers
  g.add(box(2 * HALF, 0.03, 0.5, M.pine, 0, 0.86, -0.72));
  for (let i = 0; i < 6; i++) g.add(box(2 * HALF, 0.012, 0.03, M.dark, 0, 0.88, -0.94 + i * 0.09));
  const fleece = box(2 * HALF - 0.1, 0.08, 0.46, M.cotton, 0, 0.92, -0.72);
  g.add(fleece);
  const feed = [cyl(0.035, 2 * HALF, M.steel, 'x', 0, 0.93, -0.46, 10), cyl(0.035, 2 * HALF, M.steel, 'x', 0, 0.86, -0.46, 10)];
  g.add(...feed);

  // beater: two blades on arms, whirling inside a casing that is open below to the grid
  const beater = new THREE.Group();
  beater.position.set(0, BEATER.y, BEATER.z);
  beater.add(cyl(0.025, 2.3, M.steel, 'x', 0.05, 0, 0, 8));
  for (const x of [-0.7, 0, 0.7]) beater.add(box(0.03, 2 * BEATER.r, 0.04, M.iron, x, 0, 0));
  for (const sy of [-1, 1]) beater.add(box(2 * HALF - 0.08, 0.02, 0.06, M.steel, 0, sy * BEATER.r, 0));
  g.add(beater);
  const coverMat = M.pine.clone();
  coverMat.side = THREE.DoubleSide;
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(BEATER.r + 0.05, BEATER.r + 0.05, 2 * HALF, 20, 1, true, -Math.PI * 0.62, Math.PI * 1.24), coverMat);
  cover.rotation.z = Math.PI / 2; // axis along x; the opening faces down
  cover.rotation.order = 'ZYX';
  cover.position.set(0, BEATER.y, BEATER.z);
  g.add(cover);
  // grid bars under the beater, through which seed and dirt fall
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.62 + (i / 6) * 0.76);
    g.add(rod(V(-HALF, BEATER.y + Math.cos(a) * (BEATER.r + 0.04), BEATER.z + Math.sin(a) * (BEATER.r + 0.04) * -1), V(HALF, BEATER.y + Math.cos(a) * (BEATER.r + 0.04), BEATER.z - Math.sin(a) * (BEATER.r + 0.04)), 0.008, M.steel));
  }
  g.add(box(2 * HALF, 0.02, 0.5, M.dark, 0, 0.12, BEATER.z)); // dust floor

  // cage: a perforated drum the opened cotton is drawn onto by the fan
  const cage = new THREE.Group();
  cage.position.set(0, CAGE.y, CAGE.z);
  cage.add(cyl(CAGE.r, 2 * HALF, M.card, 'x', 0, 0, 0, 20), cyl(0.015, 2 * HALF + 0.3, M.steel, 'x', 0, 0, 0, 6));
  g.add(cage);
  g.add(box(2 * HALF, 0.03, 0.34, M.pine, 0, CAGE.y + CAGE.r + 0.1, 0.22)); // top of the air trunk
  // fan at the side, drawing air through the cage
  g.add(cyl(FAN.r, 0.16, M.iron, 'x', FAN.x, FAN.y, FAN.z, 24), box(0.18, 0.5, 0.2, M.iron, FAN.x, FAN.y + 0.45, FAN.z + 0.2));
  const fan = spokedWheel({ r: 0.09, rimT: 0.02, rimW: 0.05, spokes: 3, hubR: 0.025, hubLen: 0.05, spokeT: 0.02, m: M.dark, axis: 'x' });
  fan.position.set(FAN.x - 0.12, FAN.y, FAN.z);
  g.add(fan, cyl(0.012, 0.3, M.steel, 'x', FAN.x - 0.02, FAN.y, FAN.z, 6));

  // calender rollers and the lap roll
  const cal = [cyl(0.05, 2 * HALF, M.steel, 'x', 0, 0.74, 0.64, 12), cyl(0.05, 2 * HALF, M.steel, 'x', 0, 0.64, 0.64, 12)];
  g.add(...cal);
  const sheet = new THREE.BufferGeometry().setFromPoints([V(-HALF + 0.05, CAGE.y - CAGE.r, CAGE.z + 0.05), V(HALF - 0.05, CAGE.y - CAGE.r, CAGE.z + 0.05), V(HALF - 0.05, 0.69, 0.62), V(-HALF + 0.05, 0.69, 0.62)]);
  sheet.setIndex([0, 1, 2, 0, 2, 3]);
  sheet.computeVertexNormals();
  g.add(new THREE.Mesh(sheet, M.web));
  const lap = cyl(0.1, 2 * HALF - 0.1, M.cotton, 'x', 0, LAP.y, LAP.z, 20);
  g.add(lap, cyl(0.02, 2 * HALF + 0.2, M.pine, 'x', 0, LAP.y, LAP.z, 8));
  for (const sx of [-0.88, 0.88]) g.add(box(0.05, 0.5, 0.05, M.iron, sx, 0.5, LAP.z));

  // drive: fast pulley on the beater shaft, bands to the fan and the calender rollers
  const PX = 1.08;
  beater.add(spokedWheel({ r: 0.13, rimT: 0.02, rimW: 0.09, spokes: 4, hubR: 0.035, hubLen: 0.09, spokeT: 0.02, m: M.iron, axis: 'x' }).translateX(PX));
  beater.add(cyl(0.1, 0.03, M.dark, 'x', -0.98, 0, 0, 12), cyl(0.04, 0.03, M.dark, 'x', 0.96, 0, 0, 10));
  g.add(band({ h: BEATER.z, y: BEATER.y, r: 0.1 }, { h: FAN.z, y: FAN.y, r: 0.09 }, 'x', -0.98 - 0.12));
  g.add(band({ h: BEATER.z, y: BEATER.y, r: 0.04 }, { h: 0.64, y: 0.74, r: 0.12 }, 'x', 0.96));
  const calPulley = cyl(0.12, 0.03, M.dark, 'x', 0.96, 0.74, 0.64, 14);
  g.add(calPulley);

  const feeder = worker('adult');
  feeder.position.set(-0.4, 0, -1.25 + 0.3);
  feeder.position.x = -1.25;
  const tenter = worker('child');
  tenter.position.set(1.25, 0, 0.7);
  g.add(feeder, tenter);

  return {
    group: g,
    height: 1.4,
    workers: [feeder, tenter],
    pulley: { x: PX, y: BEATER.y, z: BEATER.z, r: 0.13 },
    labels: [
      { name: 'Feed lattice', desc: 'A weighed quantity of cotton is spread evenly here, so that the lap comes out a known weight to the yard.', p: V(0, 0.98, -0.75) },
      { name: 'Beater', desc: 'Two steel blades turning a thousand times a minute and more strike the cotton as it leaves the feed rollers.', p: V(0.3, BEATER.y + 0.34, BEATER.z) },
      { name: 'Grid bars', desc: 'Seed, leaf and sand are knocked through the gaps and fall; the light cotton is carried on by the draught.', p: V(-0.3, BEATER.y - 0.3, BEATER.z + 0.05) },
      { name: 'Cage and fan', desc: 'The fan draws air through a perforated drum. Dust goes with the air; the cotton settles on the drum as an even fleece.', p: V(FAN.x, FAN.y + 0.3, FAN.z) },
      { name: 'Lap', desc: 'The fleece is pressed between calender rollers and rolled up, ready to be set behind a carding engine.', p: V(0, LAP.y + 0.14, LAP.z) },
      { name: 'Driving pulley', desc: 'Strap from the line shaft. The scutcher is the hungriest machine in the mill.', p: V(PX, BEATER.y + 0.15, BEATER.z) },
    ],
    animate(t) {
      beater.rotation.x = t * 6.5 * TAU;
      fan.rotation.x = t * 9 * TAU;
      cage.rotation.x = -t * 0.35 * TAU;
      feed[0].rotation.x = t * 0.5 * TAU;
      feed[1].rotation.x = -t * 0.5 * TAU;
      cal[0].rotation.x = t * 0.7 * TAU;
      cal[1].rotation.x = -t * 0.7 * TAU;
      calPulley.rotation.x = t * 0.7 * TAU;
      // the lap builds up, is doffed, and starts again
      const u = (t / 30) % 1;
      const r = 0.6 + 1.9 * u;
      lap.scale.set(1, r, r);
      lap.rotation.x = t * 0.6 * TAU;
      fleece.scale.z = 0.6 + 0.4 * (1 - ((t / 12) % 1));
    },
  };
}
