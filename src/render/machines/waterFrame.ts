import * as THREE from 'three';
import { LINE, M, V, band, box, cyl, lines, pitchR, rod, spokedWheel, spurGear, worker, type MachineModel } from '../parts';

const TAU = Math.PI * 2;
const SZ = 0.36; // spindle line, each side
const DRUM = { y: 0.36, r: 0.11 };
const RY = 1.3; // roller height
const RZ = [0.24, 0.29, 0.34]; // back, middle, front roller lines
const FLYER_Y = 0.97;
const BOBBIN_Y = 0.74;
const DRUM_RPS = 0.8;
const FRONT_RPS = 0.7;
const CAM_RPS = (DRUM_RPS * 0.03) / 0.16; // band reduction from the drum shaft
const CAM_R0 = 0.05;
const CAM_LIFT = 0.07;
const GP = 0.0079; // pitch of the roller gears
// front pinion 12; carriers; middle wheel 29 and back wheel 36 give drafts of about 1.25 and 3
const NFG = 12;
const NMG = 29;
const NBG = 36;
const NC1 = 16;
const NC2 = 24;

function camRadius(alpha: number): number {
  // heart cam: radius rises evenly for half a turn and falls evenly for the other half
  let a = alpha % TAU;
  if (a < 0) a += TAU;
  const f = a < Math.PI ? a / Math.PI : 2 - a / Math.PI;
  return CAM_R0 + CAM_LIFT * f;
}

function heartCam(): THREE.Mesh {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * TAU;
    const r = camRadius(a);
    if (i === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a));
    else shape.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  geo.translate(0, 0, -0.015);
  geo.rotateY(Math.PI / 2); // shape X -> -Z, extrusion along x
  return new THREE.Mesh(geo, M.brass);
}

/** carrier position touching gears at F and B (in z-y, both at the same height), hung below them */
function carrier(fz: number, bz: number, rf: number, rb: number, rc: number): { z: number; dy: number } {
  const d = Math.abs(fz - bz);
  const a = ((rf + rc) ** 2 - (rb + rc) ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, (rf + rc) ** 2 - a * a));
  return { z: fz + Math.sign(bz - fz) * a, dy: -h };
}

/**
 * Arkwright's water frame in the mill pattern: two sides of twenty-four spindles,
 * driven from a tin drum running the length of the frame.
 *
 * With `throstle` set it is built as its successor: an iron frame, longer,
 * with forty spindles a side, and running faster.
 */
export function buildWaterFrame(throstle = false): MachineModel {
  const g = new THREE.Group();
  const N = throstle ? 40 : 24; // spindles a side
  const H = throstle ? 3.5 : 2.5; // half the length of the row of spindles
  const X0 = -H;
  const DX = (2 * H) / (N - 1);
  const HEADS = N / 4;
  const FM = throstle ? M.iron : M.oak; // framing
  const SPEED = throstle ? 1.5 : 1;

  // end and middle standards, sills, creel board
  // end standards, and others between at even spacing
  const standards = [-H - 0.22, H + 0.22];
  const inner = throstle ? 3 : 1;
  for (let i = 0; i < inner; i++) standards.push(-H + ((i + 1) * 2 * H) / (inner + 1) + DX / 2);
  for (const x of standards) {
    g.add(box(0.09, 1.84, 0.16, FM, x, 0.92, 0));
    g.add(box(0.09, 0.09, 0.92, FM, x, 0.045, 0));
    g.add(box(0.07, 0.07, 0.8, FM, x, RY - 0.1, 0));
    g.add(box(0.07, 0.07, 0.84, FM, x, 0.56, 0));
  }
  g.add(box(2 * H + 0.6, 0.03, 0.46, M.pine, 0, 1.72, 0));

  // tin drum
  const drum = new THREE.Group();
  drum.position.set(0, DRUM.y, 0);
  drum.add(cyl(DRUM.r, 2 * H + 0.3, M.tin, 'x', 0, 0, 0, 16));
  drum.add(cyl(0.018, 2 * H + 1.1, M.steel, 'x', 0.02, 0, 0, 8));
  const PX = H + 0.42;
  drum.add(spokedWheel({ r: 0.2, rimT: 0.025, rimW: 0.09, spokes: 4, hubR: 0.04, hubLen: 0.09, spokeT: 0.025, m: M.iron, axis: 'x' }).translateX(PX));
  const RPX = -H - 0.34; // plane of the roller-drive bands
  drum.add(cyl(0.05, 0.05, M.dark, 'x', RPX, 0, 0, 12), cyl(0.05, 0.05, M.dark, 'x', RPX - 0.07, 0, 0, 12));
  drum.add(cyl(0.03, 0.04, M.dark, 'x', H + 0.3, 0, 0, 10));
  g.add(drum);

  const flyers: THREE.Group[] = [];
  const lifter = new THREE.Group(); // bobbin rails and bobbins, raised and lowered by the heart cam
  g.add(lifter);
  const rollers: { obj: THREE.Object3D; speed: number }[] = [];
  const bandPts: THREE.Vector3[] = [];
  const yarnPts: THREE.Vector3[] = [];

  for (const s of [1, -1]) {
    const z = s * SZ;
    // spindle rail, bolster rail, roller beam
    g.add(box(2 * H + 0.5, 0.05, 0.07, FM, 0, 0.3, z));
    g.add(box(2 * H + 0.5, 0.04, 0.05, FM, 0, 0.6, z + s * 0.045));
    g.add(box(2 * H + 0.5, 0.06, 0.16, FM, 0, RY - 0.05, s * 0.29));
    lifter.add(box(2 * H + 0.5, 0.025, 0.09, M.pine, 0, BOBBIN_Y - 0.085, z));

    for (let i = 0; i < N; i++) {
      const x = X0 + i * DX;
      g.add(cyl(0.007, 0.74, M.steel, 'y', x, 0.62, z, 6));
      // flyer with its whorl low on the spindle
      const fl = new THREE.Group();
      fl.position.set(x, 0, z);
      fl.add(cyl(0.024, 0.035, M.steel, 'y', 0, 0.37, 0, 8));
      fl.add(box(0.15, 0.014, 0.014, M.steel, 0, FLYER_Y, 0));
      fl.add(box(0.012, 0.3, 0.012, M.steel, 0.07, FLYER_Y - 0.15, 0), box(0.012, 0.3, 0.012, M.steel, -0.07, FLYER_Y - 0.15, 0));
      fl.add(cyl(0.012, 0.03, M.steel, 'y', 0, FLYER_Y + 0.02, 0, 6));
      fl.rotation.y = i * 0.9;
      g.add(fl);
      flyers.push(fl);
      // bobbin on the lifter rail
      lifter.add(cyl(0.022, 0.15, M.pine, 'y', x, BOBBIN_Y, z, 8));
      lifter.add(cyl(0.05, 0.012, M.pine, 'y', x, BOBBIN_Y - 0.07, z, 10), cyl(0.05, 0.012, M.pine, 'y', x, BOBBIN_Y + 0.07, z, 10));
      lifter.add(cyl(0.04, 0.12, M.yarn, 'y', x, BOBBIN_Y, z, 10));
      // spindle band from the drum
      bandPts.push(V(x - 0.012, DRUM.y + s * 0.02, s * DRUM.r), V(x - 0.012, 0.37, z - s * 0.024));
      bandPts.push(V(x + 0.012, DRUM.y - 0.06, s * DRUM.r * 0.85), V(x + 0.012, 0.37, z + s * 0.024));
      // roving bobbin on the creel, roving to the back roller, yarn from the front roller to the flyer
      g.add(cyl(0.045, 0.16, M.cotton, 'y', x, 1.83, s * 0.13, 8), cyl(0.006, 0.22, M.iron, 'y', x, 1.84, s * 0.13, 4));
      yarnPts.push(V(x, 1.76, s * 0.17), V(x, RY + 0.022, s * RZ[0]));
      yarnPts.push(V(x, RY + 0.02, s * RZ[2]), V(x, FLYER_Y + 0.035, z));
    }

    // three lines of rollers: fluted bottom rollers the full length, top rollers in heads of four
    const speeds = [NFG / NBG, NFG / NMG, 1];
    for (let r = 0; r < 3; r++) {
      const bottom = new THREE.Group();
      bottom.position.set(0, RY, s * RZ[r]);
      bottom.add(cyl(0.018, 2 * H + 0.66, M.steel, 'x', -0.05, 0, 0, 8));
      g.add(bottom);
      rollers.push({ obj: bottom, speed: s * speeds[r] });
      for (let h = 0; h < HEADS; h++) {
        const top = cyl(0.022, 4 * DX - 0.06, r === 0 ? M.steel : M.leather, 'x', X0 + (h * 4 + 1.5) * DX, RY + 0.04, s * RZ[r], 8);
        g.add(top);
        rollers.push({ obj: top, speed: -s * speeds[r] * 0.8 });
      }
      if (r === 2) {
        // band pulley on the front roller: open band on one side, crossed on the other, so both sides deliver outwards
        bottom.add(cyl(0.05, 0.03, M.dark, 'x', s > 0 ? RPX : RPX - 0.07, 0, 0, 12));
        g.add(band({ h: 0, y: DRUM.y, r: 0.05 }, { h: s * RZ[2], y: RY, r: 0.05 }, 'x', s > 0 ? RPX : RPX - 0.07, s < 0));
      }
    }
    // weights hung from saddles over each head of top rollers
    for (let h = 0; h < HEADS; h++) {
      const x = X0 + (h * 4 + 1.5) * DX;
      g.add(box(0.03, 0.016, 0.14, M.iron, x, RY + 0.07, s * 0.3));
      g.add(rod(V(x, RY + 0.07, s * 0.3), V(x, 1.06, s * 0.3), 0.004, M.iron));
      g.add(cyl(0.035, 0.11, M.iron, 'y', x, 1.0, s * 0.3, 8));
    }

    // roller gearing at the left end: front pinion drives the back and middle rollers through carriers
    const rf = pitchR(NFG, GP);
    const GX1 = -H - 0.29;
    const GX2 = -H - 0.26;
    const fr = rollers[rollers.length - (HEADS + 1)].obj; // front bottom roller (last of the three bottoms)
    const mid = rollers[rollers.length - 2 * (HEADS + 1)].obj;
    const bk = rollers[rollers.length - 3 * (HEADS + 1)].obj;
    fr.add(spurGear(NFG, GP, 0.05, M.brass, 'x').translateX((GX1 + GX2) / 2));
    bk.add(spurGear(NBG, GP, 0.02, M.brass, 'x').translateX(GX1));
    mid.add(spurGear(NMG, GP, 0.02, M.brass, 'x').translateX(GX2));
    const c1 = carrier(s * RZ[2], s * RZ[0], rf, pitchR(NBG, GP), pitchR(NC1, GP));
    const c2 = carrier(s * RZ[2], s * RZ[1], rf, pitchR(NMG, GP), pitchR(NC2, GP));
    const i1 = spurGear(NC1, GP, 0.02, M.iron, 'x');
    i1.position.set(GX1, RY + c1.dy, c1.z);
    const i2 = spurGear(NC2, GP, 0.02, M.iron, 'x');
    i2.position.set(GX2, RY + c2.dy, c2.z);
    g.add(i1, i2);
    rollers.push({ obj: i1, speed: (-s * NFG) / NC1 }, { obj: i2, speed: (-s * NFG) / NC2 });
    g.add(box(0.02, 0.14, 0.2, M.iron, -H - 0.24, RY - 0.03, s * 0.29)); // gear plate
  }
  g.add(lines(bandPts, LINE.band), lines(yarnPts, LINE.yarn));

  // heart cam and lifting motion at the right-hand end
  const CAM = { x: H + 0.255, y: 0.62, z: 0 };
  const cam = heartCam();
  cam.position.set(CAM.x, CAM.y, CAM.z);
  g.add(cam, cyl(0.012, 0.16, M.steel, 'x', CAM.x - 0.04, CAM.y, CAM.z, 6));
  // slow drive to the cam: a band from the drum shaft to a large pulley beside the cam
  const camPulley = cyl(0.16, 0.025, M.dark, 'x', CAM.x + 0.0, CAM.y, CAM.z, 20);
  camPulley.position.x = CAM.x + 0.045;
  g.add(camPulley);
  g.add(band({ h: 0, y: DRUM.y, r: 0.03 }, { h: 0, y: CAM.y, r: 0.16 }, 'x', CAM.x + 0.045));
  // follower, lifting rod and cross beam joining the two bobbin rails
  const follower = new THREE.Group();
  follower.add(cyl(0.02, 0.03, M.steel, 'x', CAM.x, 0, 0, 10));
  follower.add(box(0.025, 0.1, 0.025, M.iron, CAM.x, 0.06, 0));
  follower.add(box(0.05, 0.03, 0.82, M.iron, CAM.x - 0.03, BOBBIN_Y - 0.085 - CAM.y - CAM_R0 - CAM_LIFT / 2 - 0.02 + 0.1, 0));
  for (const sz of [-SZ, SZ]) follower.add(box(0.03, 0.1, 0.03, M.iron, CAM.x - 0.03, -0.02, sz));
  lifter.add(follower);

  const a = worker('child');
  a.position.set(-H * 0.5, 0, 0.82);
  const b = worker('child');
  b.position.set(H * 0.5, 0, -0.82);
  const c = worker('child');
  c.position.set(H * 0.1, 0, 0.82);
  const d = worker('child');
  d.position.set(-H * 0.2, 0, -0.82);
  g.add(a, b, c, d);

  const meanR = CAM_R0 + CAM_LIFT / 2;
  return {
    group: g,
    height: 1.95,
    workers: [a, b, c, d],
    pulley: { x: PX, y: DRUM.y, z: 0, r: 0.2 },
    labels: [
      { name: 'Roving creel', desc: 'A bobbin of roving for every spindle.', p: V(-0.4, 1.9, 0.13) },
      { name: 'Drafting rollers', desc: 'Three pairs. Each pair turns faster than the one behind, drawing the roving out about fourfold.', p: V(0.4, RY + 0.06, 0.3) },
      { name: 'Weights', desc: 'Hung from saddles to press the top rollers on the fluted bottom rollers.', p: V(X0 + 5.5 * DX, 1.0, 0.3) },
      { name: 'Flyer and bobbin', desc: 'The flyer whirls round the bobbin, twisting the thread and winding it on in one motion.', p: V(X0 + 2 * DX, FLYER_Y - 0.1, SZ + 0.07) },
      { name: throstle ? 'Tin roller and bands' : 'Tin drum and bands', desc: throstle ? 'One tin roller the length of the frame drives all eighty spindles, each by its own band.' : 'One drum drives every spindle on both sides by a separate band.', p: V(-0.8, DRUM.y + 0.11, 0) },
      { name: 'Heart cam', desc: 'Raises and lowers the bobbin rails at an even rate so the yarn is laid in level layers.', p: V(CAM.x, CAM.y + 0.1, 0.1) },
      { name: 'Roller gearing', desc: 'Small wheels and carriers set the speed of each roller line, and so the draft.', p: V(-H - 0.29, RY, 0.29) },
      { name: 'Driving pulley', desc: 'Strap from the line shaft overhead.', p: V(PX, DRUM.y + 0.2, 0) },
    ],
    animate(t) {
      drum.rotation.x = t * DRUM_RPS * SPEED * TAU;
      const fa = t * FRONT_RPS * SPEED * TAU;
      for (const r of rollers) r.obj.rotation.x = fa * r.speed;
      const spin = t * 4.2 * SPEED * TAU;
      for (let i = 0; i < flyers.length; i++) flyers[i].rotation.y = spin + i * 0.9;
      const ca = t * CAM_RPS * TAU;
      cam.rotation.x = ca;
      camPulley.rotation.x = ca;
      const lift = camRadius(Math.PI / 2 - ca) - meanR;
      lifter.position.y = lift;
      follower.position.y = CAM.y + meanR + 0.02;
    },
  };
}
