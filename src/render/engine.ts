import * as THREE from 'three';
import { DynLines, LINE, M, V, beam, box, cyl, mergeRigid, meshPhase, pitchR, rod, setRod, spokedWheel, spurGear, worker, type PartLabel } from './parts';
import { PT } from './powertrain';

/**
 * Boulton & Watt rotative beam engine of the later 1780s, with its boiler.
 *
 * The piston works one end of the beam; the other end carries a connecting
 * rod with a "planet" wheel fixed to its foot. The planet is held in gear
 * with a "sun" wheel of the same size on the flywheel shaft, and as it
 * circles the sun without itself turning, the shaft makes two turns for
 * every double stroke of the piston. A spur wheel on the shaft drives a
 * pinion on the mill's line shaft.
 */

const TAU = Math.PI * 2;
const YF = 1.6; // flywheel shaft height
const YP = 4.6; // beam centre height
const LB = 1.9; // half length of the beam
const NG = 20; // sun and planet teeth
const GPITCH = 0.07;
const RG = pitchR(NG, GPITCH);
const ORBIT = 2 * RG;
const LR = YP - YF; // connecting rod
const LINK = 0.55; // links of the parallel motion
// first-motion gearing to the line shaft: the two wheels always total 150 teeth
const SPUR_PITCH = (TAU * (PT.yl - YF)) / 150;

export interface Engine {
  group: THREE.Group;
  /** parts that turn with the line shaft; add to the power train's lineShaft group */
  pinion: THREE.Object3D;
  /** lineAngle: rotation of the line shaft about x. speed 0..1. fired: whether the boiler has coal. */
  animate(lineAngle: number, speed: number, dt: number, fired: boolean, coal: number): void;
  labels: PartLabel[];
  bounds: THREE.Box3;
  workers: THREE.Object3D[];
}

/**
 * twin: a second boiler stands beside the first, for a mill with a second engine.
 * later: an engine of the early 1800s, after Watt's patents: a cast-iron beam,
 * a plain crank in place of the sun and planet, an egg-ended boiler and a round chimney.
 */
export function buildEngine(millW: number, twin = false, later = false): Engine {
  // a crank turns the shaft once a stroke, the sun and planet twice, so the gearing differs
  const N_SPUR = later ? 100 : 90;
  const N_PINION = later ? 50 : 60;
  const g = new THREE.Group();
  const zc = PT.zc;
  const xe = millW + 2.0; // plane of the beam
  const zp = zc - LB; // beam centre
  const zcyl = zp - LB; // cylinder centre line
  const xb = millW + 5.3; // boiler

  // floor of the engine and boiler houses
  const extra = twin ? 2.4 : 0;
  g.add(box(7.0 + extra, 0.1, 8.4, M.flag, millW + 3.9 + extra / 2, -0.03, zc - 2));

  // ---- flywheel shaft: spur wheel (inside the mill), sun wheel, flywheel ----
  const fly = new THREE.Group();
  fly.position.set(0, YF, zc);
  const gearX = millW - 0.5;
  fly.add(cyl(0.07, xe + 1.3 - (gearX - 0.2), M.steel, 'x', (xe + 1.3 + gearX - 0.2) / 2, 0, 0, 10));
  const spur = spurGear(N_SPUR, SPUR_PITCH, 0.12, M.iron, 'x');
  spur.position.x = gearX;
  spur.rotation.x = meshPhase('x', V(0, 1, 0), N_SPUR, false);
  fly.add(spur);
  const sun = spurGear(NG, GPITCH, 0.1, M.iron, 'x');
  sun.position.x = xe;
  sun.rotation.x = meshPhase('x', V(0, 1, 0), NG, false);
  if (!later) fly.add(sun);
  const flywheel = spokedWheel({ r: 1.5, rimT: 0.17, rimW: 0.2, spokes: 6, hubR: 0.2, hubLen: 0.3, spokeT: 0.09, m: M.iron, axis: 'x' });
  flywheel.position.x = xe + 0.75;
  fly.add(flywheel);
  g.add(fly);
  for (const x of [xe - 0.4, xe + 1.2]) g.add(box(0.3, YF - 0.1, 0.5, M.stoneDark, x, (YF - 0.1) / 2, zc), box(0.24, 0.16, 0.3, M.brass, x, YF - 0.04, zc));
  g.add(box(0.3, YF - 0.1, 0.5, M.stoneDark, gearX + 0.28, (YF - 0.1) / 2, zc), box(0.2, 0.16, 0.3, M.brass, gearX + 0.28, YF - 0.04, zc));

  // pinion on the line shaft (turns with it)
  const pinion = spurGear(N_PINION, SPUR_PITCH, 0.12, M.iron, 'x');
  pinion.position.x = gearX;
  pinion.rotation.x = meshPhase('x', V(0, -1, 0), N_PINION, true);

  // ---- lever wall and beam ----
  g.add(box(1.5, YP - 0.3, 0.55, M.stone, xe, (YP - 0.3) / 2, zp));
  g.add(box(0.5, 0.16, 0.3, M.brass, xe, YP - 0.2, zp));
  const beamG = new THREE.Group();
  beamG.position.set(xe, YP, zp);
  if (later) {
    // cast-iron beam, deepest at the centre
    beamG.add(box(0.1, 0.3, 2 * LB + 0.3, M.iron, 0, 0, 0), box(0.1, 0.62, LB, M.iron, 0, 0, 0), box(0.16, 0.06, 2 * LB + 0.3, M.iron, 0, 0.17, 0), box(0.16, 0.06, 2 * LB + 0.3, M.iron, 0, -0.17, 0));
  } else beamG.add(box(0.2, 0.4, 2 * LB + 0.3, M.oak, 0, 0, 0));
  beamG.add(box(0.24, 0.5, 0.5, M.iron, 0, 0, 0), cyl(0.06, 0.7, M.steel, 'x', 0, 0, 0, 10));
  for (const sz of [-1, 1]) beamG.add(box(0.24, 0.44, 0.16, M.iron, 0, 0, sz * LB), cyl(0.035, 0.44, M.steel, 'x', 0, 0, sz * LB, 8));
  beamG.add(box(0.22, 0.42, 0.06, M.iron, 0, 0, -LB / 2), box(0.22, 0.42, 0.06, M.iron, 0, 0, LB / 2));
  // king post and tie rods stiffening the timber beam
  if (!later) beamG.add(box(0.08, 0.5, 0.08, M.iron, 0, 0.42, 0), rod(V(0, 0.66, 0), V(0, 0.2, LB - 0.1), 0.015, M.iron), rod(V(0, 0.66, 0), V(0, 0.2, -LB + 0.1), 0.015, M.iron));
  g.add(beamG);

  // ---- connecting rod, planet wheel and the link that keeps it in gear ----
  const conRod = beam(V(), V(0, 1, 0), 0.09, M.iron);
  const planet = new THREE.Group();
  const planetGear = spurGear(NG, GPITCH, 0.1, M.iron, 'x');
  planetGear.rotation.x = meshPhase('x', V(0, -1, 0), NG, true);
  if (later) planet.add(cyl(0.06, 0.3, M.steel, 'x', 0, 0, 0, 10)); // crank pin
  else planet.add(planetGear);
  const link = beam(V(), V(0, 1, 0), later ? 0.14 : 0.05, later ? M.iron : M.steel); // crank arm, or the link holding the planet in gear
  g.add(conRod, planet, link);

  // ---- cylinder, piston rod and parallel motion ----
  g.add(box(1.1, 1.1, 1.1, M.stone, xe, 0.55, zcyl));
  const CYL_TOP = 3.0;
  g.add(cyl(0.34, CYL_TOP - 1.1, M.iron, 'y', xe, (CYL_TOP + 1.1) / 2, zcyl, 24));
  for (const y of [1.14, 2.05, CYL_TOP - 0.03]) g.add(cyl(0.38, 0.07, M.iron, 'y', xe, y, zcyl, 24));
  g.add(cyl(0.08, 0.12, M.brass, 'y', xe, CYL_TOP + 0.06, zcyl, 12)); // stuffing box
  // valve chest and steam pipe from the boiler
  g.add(box(0.2, 1.7, 0.26, M.iron, xe + 0.45, 2.05, zcyl));
  g.add(rod(V(xe + 0.5, 2.8, zcyl), V(xb, 2.8, zcyl), 0.07, M.copper, 10), rod(V(xb, 2.8, zcyl), V(xb, 2.1, zcyl), 0.07, M.copper, 10));
  const pistonRod = rod(V(), V(0, 1, 0), 0.03, M.steel);
  const pm = [0, 1, 2, 3].map(() => rod(V(), V(0, 1, 0), 0.02, M.steel));
  g.add(pistonRod, ...pm);

  // ---- air pump and condenser in the cold-water cistern ----
  const zap = zp - LB * 0.45;
  g.add(box(1.0, 0.8, 1.0, M.oak, xe, 0.4, zap), box(0.92, 0.04, 0.92, M.water, xe, 0.8, zap));
  g.add(cyl(0.16, 1.5, M.iron, 'y', xe, 0.75, zap - 0.12, 16), cyl(0.2, 0.9, M.iron, 'y', xe, 0.5, zap + 0.26, 16));
  const pumpRod = rod(V(), V(0, 1, 0), 0.02, M.steel);
  g.add(pumpRod);

  // ---- governor ----
  const gx = xe - 0.75;
  const gz = zc + 1.2;
  g.add(box(0.3, 0.3, 0.3, M.stoneDark, gx, 0.15, gz));
  const gov = new THREE.Group();
  gov.position.set(gx, 0.3, gz);
  gov.add(cyl(0.02, 1.7, M.steel, 'y', 0, 0.85, 0, 8), cyl(0.09, 0.05, M.dark, 'y', 0, 0.25, 0, 12), cyl(0.04, 0.06, M.brass, 'y', 0, 1.68, 0, 10));
  const balls: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0, 1.66, 0);
    arm.add(rod(V(0, 0, 0), V(0, -0.45, 0), 0.01, M.steel));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), M.brass);
    ball.position.y = -0.45;
    arm.add(ball);
    arm.userData.s = s;
    gov.add(arm);
    balls.push(arm);
  }
  const sleeve = cyl(0.035, 0.06, M.brass, 'y', 0, 1.3, 0, 10);
  gov.add(sleeve);
  g.add(gov);
  const govBand = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([V(xe - 0.6, YF + 0.07, zc), V(gx, 0.55, gz - 0.09), V(xe - 0.6, YF - 0.07, zc), V(gx, 0.55, gz + 0.09)]),
    LINE.band,
  );
  g.add(govBand);

  // ---- wagon boiler in its brick setting, with the chimney ----
  const bz = zc - 2.5;
  const fires: THREE.Mesh[] = [];
  const addBoiler = (bx: number) => {
    g.add(box(2.0, 1.5, 3.7, M.brick, bx, 0.75, bz));
    g.add(cyl(0.78, 3.4, M.iron, 'z', bx, 1.5, bz, 24));
    if (later) {
      for (const sz of [-1.7, 1.7]) {
        const end = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 12), M.iron);
        end.position.set(bx, 1.5, bz + sz);
        end.scale.z = 0.6;
        g.add(end);
      }
    }
    for (const z of [-0.4, 0.5, 1.4, 2.3]) g.add(cyl(0.795, 0.05, M.iron, 'z', bx, 1.5, z, 24));
    g.add(cyl(0.1, 0.3, M.brass, 'y', bx + 0.3, 2.38, bz + 0.9, 10)); // safety valve
    g.add(box(0.6, 0.45, 0.06, M.iron, bx, 0.75, bz + 1.87));
    const fire = box(0.44, 0.3, 0.07, M.fire, bx, 0.75, bz + 1.88);
    g.add(fire);
    fires.push(fire);
    g.add(box(0.6, 0.2, 0.06, M.dark, bx, 0.2, bz + 1.87));
    g.add(box(0.9, 0.9, 1.0, M.brick, bx, 0.45, bz - 1.9)); // flue
  };
  addBoiler(xb);
  if (twin) {
    addBoiler(xb + 2.3);
    g.add(rod(V(xb, 2.8, zcyl), V(xb + 2.3, 2.8, zcyl), 0.07, M.copper, 10), rod(V(xb + 2.3, 2.8, zcyl), V(xb + 2.3, 2.1, zcyl), 0.07, M.copper, 10));
    g.add(box(2.3, 0.9, 0.8, M.brick, xb + 1.15, 0.45, bz - 2.3));
  }
  const CH = { x: xb, z: bz - 2.7 };
  g.add(box(1.3, 2.2, 1.3, M.brick, CH.x, 1.1, CH.z));
  const TOP = later ? 14.2 : 11.2;
  const stack = new THREE.Mesh(later ? new THREE.CylinderGeometry(0.4, 0.66, TOP - 2.2, 16) : new THREE.CylinderGeometry(0.42, 0.62, 9, 4), M.brick);
  if (!later) stack.rotation.y = Math.PI / 4;
  stack.position.set(CH.x, 2.2 + (TOP - 2.2) / 2, CH.z);
  g.add(stack, later ? cyl(0.46, 0.18, M.stoneDark, 'y', CH.x, TOP + 0.05, CH.z, 16) : box(0.72, 0.16, 0.72, M.stoneDark, CH.x, 11.25, CH.z));
  const smoke: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), M.smoke.clone());
    g.add(m);
    smoke.push(m);
  }
  // coal heap and stoker
  const heap = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 9), M.coal);
  heap.position.set(xb + 0.2 + extra / 2, 0.45, bz + 3.6);
  g.add(heap);
  const stoker = worker('adult');
  stoker.position.set(xb - 0.5, 0, bz + 2.6);
  const tenter = worker('adult');
  tenter.position.set(xe - 0.9, 0, zc - 0.6);
  g.add(stoker, tenter);

  const dyn = new DynLines(2, LINE.cord);
  g.add(dyn.obj);

  const labels: PartLabel[] = [
    { name: later ? 'Cast-iron beam' : 'Beam', desc: 'Rocks on the lever wall, carrying the piston\'s stroke over to the connecting rod.', p: V(xe, YP + 0.3, zp + 0.6) },
    { name: 'Cylinder', desc: 'Double-acting: steam drives the piston both up and down, and is exhausted to a separate condenser.', p: V(xe - 0.2, 2.2, zcyl + 0.34) },
    { name: 'Parallel motion', desc: "Watt's linkage. It keeps the piston rod moving in a straight line while the beam end swings in an arc.", p: V(xe, YP - 0.5, zcyl + 0.5) },
    later
      ? { name: 'Crank', desc: "With the crank patent long expired, the connecting rod turns the shaft directly, once for each double stroke.", p: V(xe, YF + 0.5, zc + 0.2) }
      : { name: 'Sun and planet', desc: 'Used in place of a crank, which another man had patented. The planet wheel circles the sun and turns the shaft twice for each stroke.', p: V(xe, YF + 0.5, zc + 0.2) },
    { name: 'Flywheel', desc: 'Carries the engine evenly over the ends of each stroke.', p: V(xe + 0.75, YF + 1.2, zc + 0.9) },
    { name: 'Governor', desc: 'Added in 1788. As the engine runs faster the balls fly outward and close the steam valve.', p: V(gx, 1.9, gz) },
    { name: 'Air pump and condenser', desc: 'Spent steam is condensed in a cold vessel and the water pumped out, saving three quarters of the coal of the older engines.', p: V(xe, 1.2, zap + 0.3) },
    later
      ? { name: 'Egg-ended boiler', desc: 'A plain cylinder with rounded ends, stronger than the wagon boiler and able to carry steam at a higher pressure.', p: V(xb, 2.3, bz) }
      : { name: 'Wagon boiler', desc: 'Low-pressure steam, a few pounds to the inch, raised over a coal fire.', p: V(xb, 2.3, bz) },
    { name: 'Spur wheel and pinion', desc: `${N_SPUR} teeth driving ${N_PINION}, bringing the shaft's ${later ? 24 : 32} turns a minute up to the line shaft's 48.`, p: V(gearX, YF + 1.2, zc) },
  ];
  const bounds = new THREE.Box3(V(millW + 0.6, 0, zc - 5.9), V(millW + 7.2 + extra, 5.4, zc + 2.1));

  const a = V();
  const b = V();
  let psi = 0;
  let smokeT = 0;
  function animate(lineAngle: number, speed: number, dt: number, fired: boolean, coal: number) {
    const F = (-lineAngle * N_PINION) / N_SPUR;
    fly.rotation.x = F;
    // planet's place on its orbit: the sun turns twice per orbit, less the small swing of the rod
    const phi = later ? F : (F + psi) / 2;
    const py = YF + ORBIT * Math.cos(phi);
    const pz = zc + ORBIT * Math.sin(phi);
    // beam angle from the connecting rod (rotation about x takes +z towards -y)
    let th = 0;
    for (let i = 0; i < 3; i++) {
      const ez = zp + LB * Math.cos(th);
      const ey = py + Math.sqrt(Math.max(0, LR * LR - (ez - pz) * (ez - pz)));
      th = -Math.asin(Math.max(-1, Math.min(1, (ey - YP) / LB)));
    }
    beamG.rotation.x = th;
    const ey = YP - LB * Math.sin(th);
    const ez = zp + LB * Math.cos(th);
    psi = Math.atan2(ez - pz, ey - py);
    setRod(conRod, a.set(xe, py, pz), b.set(xe, ey, ez));
    planet.position.set(xe, py, pz);
    planet.rotation.x = psi;
    setRod(link, a.set(xe - 0.09, YF, zc), b.set(xe - 0.09, py, pz));

    // piston end
    const cy = YP + LB * Math.sin(th);
    const cz = zp - LB * Math.cos(th);
    const ry = cy - Math.sqrt(Math.max(0, LINK * LINK - (cz - zcyl) * (cz - zcyl)));
    setRod(pistonRod, a.set(xe, ry, zcyl), b.set(xe, ry - 1.65, zcyl));
    // parallel motion: main link, back link, parallel bar, radius rod
    const my = YP + (LB / 2) * Math.sin(th);
    const mz = zp - (LB / 2) * Math.cos(th);
    const qy = ry + (my - cy);
    const qz = zcyl + (mz - cz);
    setRod(pm[0], a.set(xe + 0.13, cy, cz), b.set(xe + 0.13, ry, zcyl));
    setRod(pm[1], a.set(xe + 0.13, my, mz), b.set(xe + 0.13, qy, qz));
    setRod(pm[2], a.set(xe + 0.13, ry, zcyl), b.set(xe + 0.13, qy, qz));
    setRod(pm[3], a.set(xe + 0.13, qy, qz), b.set(xe + 0.13, YP - LINK, zp - 0.1));
    // air pump rod
    const ay = YP + LB * 0.45 * Math.sin(th);
    setRod(pumpRod, a.set(xe, ay, zap - 0.12), b.set(xe, ay - 3.35, zap - 0.12));

    // governor
    gov.rotation.y = -F * 2.2;
    const spread = 0.3 + 0.75 * Math.min(1, speed);
    for (const arm of balls) arm.rotation.z = arm.userData.s * spread;
    sleeve.position.y = 1.2 + 0.25 * Math.min(1, speed);

    // fire and smoke
    for (const f of fires) f.visible = fired;
    smokeT += dt * (fired ? (twin ? 0.4 : 0.25) : 0);
    for (let i = 0; i < smoke.length; i++) {
      const u = (smokeT + i / smoke.length) % 1;
      const m = smoke[i];
      m.visible = fired;
      m.position.set(CH.x + u * u * 3.5, TOP + 0.4 + u * 4.5, CH.z - u * 1.2);
      m.scale.setScalar(0.6 + u * 1.8);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - u);
    }
    const hs = Math.max(0.15, Math.min(1.3, Math.sqrt(coal / 300)));
    heap.scale.set(hs, hs, hs);
    heap.position.y = 0.45 * hs;
  }
  animate(0, 0, 0, false, 0);
  mergeRigid(g, new Set<THREE.Object3D>([fly, beamG, conRod, planet, link, pistonRod, ...pm, pumpRod, gov, ...balls, sleeve, ...fires, ...smoke, heap, stoker, tenter]));

  return { group: g, pinion, animate, labels, bounds, workers: [stoker, tenter] };
}
