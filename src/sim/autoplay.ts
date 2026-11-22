import {
  buildHousing,
  concedeStrike,
  setWageOffer,
  addEngine2,
  addStorey,
  canAddEngine2,
  buildEngine,
  buildMill,
  canAddStorey,
  canBuildEngine,
  canBuildMill,
  canExtendMill,
  extendMill,
  machineCost,
  placeMachine,
  placeProblem,
  removeMachine,
  research,
  siteList,
  sitePlan,
  storeyCost,
  techStatus,
} from './actions';
import { ENGINE2_COST, ENGINE_COST, EXTENSION_COST, MACHINES, MILLS, MILL_IDS, WHEEL_HP, siteFloor, siteMill, type MachineType, type MillId, type SiteId } from './machines';
import { enginePower } from './power';
import { HOUSING_COST } from './labour';
import { buyFireEngine, canBuyFireEngine, canFireproof, fireproof, fireproofCost } from './hazards';
import { DECISIONS, decide } from './politics';
import { EXPORTS, TRANSPORT, buildTransport, canBuildTransport, exportOpen, setAgent } from './trade';
import { CANAL, RAIL, TOWNS, VENTURES, buyShares, buyTown, buyVenture, canBuyShares, canBuyTown, canBuyVenture, canRefit, enlarge, enlargeCost, regionOutlay, refit, refitCost, townCost, tradeStandard } from './region';
import { yearFloat, type GameState, type MachineInst } from './state';
import { TECHS, TECH_IDS, type TechId } from './tech';
import { step } from './tick';

/**
 * A plain, sensible manager used for balance tests and demonstration runs.
 * It buys each invention as it appears, keeps the stages roughly in balance,
 * and builds upward and outward when it runs out of room or power.
 */

const count = (s: GameState, t: MachineType) => s.machines.filter((m) => m.type === t).length;

/** Power a mill can be counted on for: the wheel in a dry summer, plus the engine. */
function millCap(s: GameState, id: MillId): number {
  const m = s.mills[id];
  if (!m.built) return 0;
  return (MILLS[id].wheel ? WHEEL_HP * 0.65 : 0) + enginePower(s, id);
}

function millLoad(s: GameState, id: MillId): number {
  let hp = 0;
  for (const m of s.machines) if (siteMill(m.site) === id) hp += MACHINES[m.type].power;
  return hp;
}

const anyEngine = (s: GameState) => MILL_IDS.some((id) => s.mills[id].engine);

type Dept = 'prep' | 'spin' | 'weave' | 'hand';
function dept(type: MachineType): Dept {
  const def = MACHINES[type];
  if (def.power === 0) return 'hand';
  if (def.stage < 3 || def.stage >= 5) return 'prep'; // opening, carding, roving; and finishing, which wants the ground floor
  return def.stage < 3.5 ? 'spin' : 'weave';
}

/** Rows a machine may stand in on a floor of the given depth, with the way it faces, so that alleys are shared. */
function rows(type: MachineType, depth: number): { z: number; flip: boolean }[] {
  const def = MACHINES[type];
  const both = (def.access ?? ['front']).length > 1;
  const out: { z: number; flip: boolean }[] = [];
  if (both) {
    // frames worked from both sides: an alley, a frame, an alley, a frame, an alley
    for (let z = 1; z + def.d < depth; z += def.d + 1) out.push({ z, flip: false });
  } else {
    // machines worked from the front stand in pairs facing a shared alley, back to back with the next pair
    for (let z = 0; z + def.d <= depth; ) {
      if (z + def.d + 1 <= depth) out.push({ z, flip: false });
      const z2 = z + def.d + 1;
      if (z2 + def.d <= depth) out.push({ z: z2, flip: true });
      z = z2 + def.d;
    }
  }
  return out;
}

interface Spot {
  site: SiteId;
  x: number;
  z: number;
  flip: boolean;
}

/**
 * Find a place for a machine, keeping departments together as a real mill did:
 * preparation on the ground floor, spinning above it, weaving at the top
 * (or, on a single floor, in that order along its length).
 */
function findSpot(s: GameState, type: MachineType): Spot | null {
  const def = MACHINES[type];
  const d = dept(type);
  const sites = siteList(s).filter((site) => {
    const mill = siteMill(site);
    if (def.site === 'mill' && !mill) return false;
    // Once there is an engine the mill floors are kept for powered machinery (and mules, which need the length).
    if (def.power === 0 && mill && anyEngine(s) && type !== 'mule') return false;
    if (def.power > 0 && mill && millLoad(s, mill) + def.power > millCap(s, mill) + 1e-6) return false;
    return true;
  });
  // each department has the floor it likes best
  const want = d === 'prep' ? 0 : d === 'spin' ? 1 : d === 'weave' ? 2 : 0;
  sites.sort((a, b) => Math.abs(siteFloor(a) - want) - Math.abs(siteFloor(b) - want));
  for (const site of sites) {
    const plan = sitePlan(s, site);
    const span = plan.maxX - def.w - plan.minX;
    // along the floor: preparation from the wheel end, weaving from the far end, spinning from a third of the way
    const xs: number[] = [];
    for (let k = 0; k <= span; k++) {
      if (d === 'weave') xs.push(plan.maxX - def.w - k);
      else if (d === 'spin') xs.push(plan.minX + ((k + Math.floor(span / 3)) % (span + 1)));
      else xs.push(plan.minX + k);
    }
    for (const x of xs)
      for (const r of rows(type, plan.d)) {
        const problem = placeProblem(s, type, site, x, r.z, r.flip);
        if (!problem || problem === 'Not enough cash') return { site, x, z: r.z, flip: r.flip };
      }
  }
  return null;
}

/** Build if there is room (and power) and the cost can be met with a reserve left over. */
function tryBuild(s: GameState, type: MachineType, reserve: number): MachineInst | 'poor' | 'full' {
  const spot = findSpot(s, type);
  if (!spot) return 'full';
  if (s.cash < machineCost(s, type) + reserve) return 'poor';
  return placeMachine(s, type, spot.site, spot.x, spot.z, spot.flip) ?? 'poor';
}

/** No room or power for a powered machine: clear out hand machines, raise a storey, or build the second mill. */
function expand(s: GameState): void {
  const order: MachineType[] = s.tech.includes('powerLoom') ? ['spinningWheel', 'handloom', 'jenny'] : ['spinningWheel', 'jenny', 'handloom'];
  for (const t of order) {
    const victim = s.machines.find((m) => siteMill(m.site) !== null && m.type === t);
    if (victim) {
      removeMachine(s, victim.id);
      return;
    }
  }
  for (const id of MILL_IDS) {
    if (millCap(s, id) - millLoad(s, id) < 2 && !canAddEngine2(s, id) && s.cash > ENGINE2_COST + 500) {
      addEngine2(s, id);
      return;
    }
  }
  for (const id of MILL_IDS) {
    if (millCap(s, id) - millLoad(s, id) >= 2 && !canAddStorey(s, id) && s.cash > storeyCost(s, id) + 300) {
      addStorey(s, id);
      return;
    }
  }
  if (!canBuildMill(s, 'mill2') && s.cash > MILLS.mill2.cost + 500) buildMill(s, 'mill2');
}

function tryBuildPowered(s: GameState, type: MachineType, reserve: number): MachineInst | null {
  const r = tryBuild(s, type, reserve);
  if (r === 'full') {
    if (s.cash > machineCost(s, type) + reserve) expand(s);
    return null;
  }
  return r === 'poor' ? null : r;
}

/** Replace one old machine with its successor, wherever the new one will fit. */
function upgradeOne(s: GameState, from: MachineType, to: MachineType): boolean {
  const old = s.machines.find((m) => m.type === from);
  if (!old || !s.tech.includes(MACHINES[to].tech!) || s.cash < machineCost(s, to) + 200) return false;
  // see whether the new machine would have room and power with the old one gone, before parting with it
  const at = s.machines.indexOf(old);
  s.machines.splice(at, 1);
  const spot = findSpot(s, to);
  s.machines.splice(at, 0, old);
  if (!spot) return false;
  removeMachine(s, old.id);
  return !!placeMachine(s, to, spot.site, spot.x, spot.z, spot.flip);
}

/** Lay out spare cash beyond the home works: ventures first, then mills, their refits, and shares. */
function manageRegion(s: GameState): void {
  // outside mills lose money in a slump: keep enough by to ride one out
  const spare = s.cash - 4000 - 0.06 * regionOutlay(s);
  if (spare <= 0) return;
  for (const v of VENTURES) {
    if (!canBuyVenture(s, v.id) && spare > v.cost) return void buyVenture(s, v.id);
  }
  for (const m of s.region.mills) {
    if (m.level < tradeStandard(yearFloat(s)) && !canRefit(s, m.id) && spare > refitCost(s, m)) return void refit(s, m.id);
  }
  for (const t of TOWNS) {
    if (!canBuyTown(s, t.id) && spare > townCost(s, t.id)) return void buyTown(s, t.id);
  }
  if (!canBuyShares(s, 'rail') && spare > RAIL.lot) return void buyShares(s, 'rail');
  if (!canBuyShares(s, 'canal') && spare > CANAL.lot && yearFloat(s) < 1825) return void buyShares(s, 'canal');
  // nothing else to buy: enlarge whichever outside mill is cheapest to enlarge
  const cheapest = [...s.region.mills].sort((a, b) => enlargeCost(s, a) - enlargeCost(s, b))[0];
  if (cheapest && spare > enlargeCost(s, cheapest)) enlarge(s, cheapest.id);
}

/** Insurance, fire precautions, carriage, agents abroad, and the questions of the day. */
function manageAffairs(s: GameState): void {
  if (s.pending) decide(s, s.pending, DECISIONS.find((d) => d.id === s.pending)!.fallback);
  if (!s.mills.mill.built) return;
  s.insured = true;
  if (!canBuyFireEngine(s) && s.cash > 400) buyFireEngine(s);
  for (const id of MILL_IDS) if (!canFireproof(s, id) && s.cash > fireproofCost(s, id) + 1500) fireproof(s, id);
  if (!canBuildTransport(s) && s.cash > TRANSPORT[s.transport + 1].cost + 800) buildTransport(s);
  // keep an agent wherever the market is open, once the concern is of a size to use one
  const y = yearFloat(s);
  for (const def of EXPORTS) setAgent(s, def.id, exportOpen(def, y) && s.cash > 1500);
}

/** Keep the works manned and the hands content. */
function manageLabour(s: GameState): void {
  const l = s.labour;
  if (l.strike > 0) concedeStrike(s);
  const tight = l.needed / Math.max(1, l.available);
  if (tight > 0.9) {
    if (s.cash > HOUSING_COST + 100) buildHousing(s);
    else if (l.offer < 1.3) setWageOffer(s, l.offer + 0.05);
  }
  if (l.morale < 45 && l.offer < 1.2) setWageOffer(s, l.offer + 0.05);
}

/** One week's decisions. */
export function manage(s: GameState): void {
  manageLabour(s);
  manageAffairs(s);
  manageRegion(s);
  for (const t of TECH_IDS) {
    if (techStatus(s, t) === 'available' && s.cash > TECHS[t].cost + 15) research(s, t);
  }
  const old = s.mills.mill;
  // Wait for cylinder carding before sinking money in a mill: frames need roving.
  if (!old.built && !canBuildMill(s) && yearFloat(s) >= TECHS.carding.year && s.cash > MILLS.mill.cost + 150) buildMill(s);
  if (old.built && !canBuildEngine(s) && s.cash > ENGINE_COST + 300) buildEngine(s);
  if (old.built && !canExtendMill(s) && s.cash > EXTENSION_COST + 300) extendMill(s);

  const has = (t: TechId) => s.tech.includes(t);
  const powerLooms = count(s, 'powerLoom');
  const lancs = count(s, 'lancashireLoom');
  const weavingByPower = has('powerLoom');

  if (old.built && has('carding') && has('waterFrame')) {
    const cards = count(s, 'cardingEngine');
    const rovers = count(s, 'rovingFrame');
    const scutchers = count(s, 'scutcher');
    const selfActors = count(s, 'selfActor');
    const use = (t: MachineType, g: 'roving' | 'warp' | 'weft') => {
      const r = MACHINES[t].recipes[MACHINES[t].recipes.length - 1];
      return (r.in[g] ?? 0) * count(s, t);
    };
    const make = (t: MachineType, g: 'warp' | 'weft') => {
      const r = MACHINES[t].recipes[MACHINES[t].recipes.length - 1];
      return (r.out[g] ?? 0) * count(s, t);
    };
    const perCard = scutchers > 0 ? 182 : 120;
    const roving = Math.min(cards * perCard, rovers * 120);
    const rovingUse = use('waterFrame', 'roving') + use('throstle', 'roving') + use('selfActor', 'roving') + use('mule', 'roving') + count(s, 'jenny') * 21;
    const warp = make('waterFrame', 'warp') + make('throstle', 'warp');
    const warpUse = use('powerLoom', 'warp') + use('lancashireLoom', 'warp');
    const weftUse = use('powerLoom', 'weft') + use('lancashireLoom', 'weft') + count(s, 'handloom') * 6;
    const weftMade = make('selfActor', 'weft') + count(s, 'jenny') * 20;

    const spinner: MachineType = has('throstle') ? 'throstle' : 'waterFrame';
    const loom: MachineType | null = has('lancashireLoom') ? 'lancashireLoom' : has('powerLoom') ? 'powerLoom' : null;
    // Before weaving by power there is only so much twist the market will take.
    const maxCards = weavingByPower ? 99 : old.engine ? 3 : 1;

    if (cards === 0) tryBuildPowered(s, 'cardingEngine', 40);
    else if (rovers * 120 < cards * perCard - 1) tryBuildPowered(s, 'rovingFrame', 40);
    else if (has('selfActor') && weftUse > weftMade + 250 && roving - rovingUse >= 300) {
      const m = tryBuildPowered(s, 'selfActor', 60);
      if (m) m.pref = 'Spinning weft';
    } else if (roving - rovingUse >= MACHINES[spinner].recipes[0].in.roving! && warp - warpUse < 200) tryBuildPowered(s, spinner, 40);
    else if (loom && warp - warpUse >= MACHINES[loom].recipes[MACHINES[loom].recipes.length - 1].in.warp!) tryBuildPowered(s, loom, 40);
    else if (has('scutching') && scutchers * 2 < cards - 1) tryBuildPowered(s, 'scutcher', 40);
    else if (has('dressing') && count(s, 'dressingFrame') * 200 < warpUse - 60) tryBuildPowered(s, 'dressingFrame', 40);
    else if (has('bleaching') && count(s, 'bleachWorks') < Math.min(3, Math.floor((powerLooms + lancs) / 8))) tryBuildPowered(s, 'bleachWorks', 40);
    else if (has('printing') && count(s, 'printingMachine') < count(s, 'bleachWorks')) tryBuildPowered(s, 'printingMachine', 40);
    else if (cards < maxCards && roving - rovingUse < MACHINES[spinner].recipes[0].in.roving!) tryBuildPowered(s, 'cardingEngine', 40);

    // Power looms out-run the jennies: buy in weft to keep them going.
    if (weftUse > weftMade && powerLooms + lancs > 0) {
      if (s.policy.weft.mode !== 'buy') s.policy.weft = { mode: 'buy', level: 120 };
    } else if (s.policy.weft.mode === 'buy') s.policy.weft = { mode: 'sell', level: 120 };
  }

  // bring old plant up to date, a machine a week
  if (!upgradeOne(s, 'powerLoom', 'lancashireLoom')) upgradeOne(s, 'waterFrame', 'throstle');

  if (has('mule') && count(s, 'mule') < 2 && (s.stock.roving > 60 || count(s, 'cardingEngine') > 0)) tryBuild(s, 'mule', 40);

  // the workshop: jennies and handlooms in step, until power takes over the weaving
  const jennyRate = s.stock.roving > 10 ? 20 : 12;
  const weft = count(s, 'spinningWheel') * 1.5 + count(s, 'jenny') * jennyRate;
  const need = count(s, 'handloom') * 6;
  const want: MachineType | null =
    weft >= need + 6 ? 'handloom' : has('jenny') ? (weft < need + 6 ? 'jenny' : null) : weft < need ? 'spinningWheel' : null;
  if (want && powerLooms + lancs === 0 && tryBuild(s, want, 15) === 'full' && want !== 'spinningWheel') {
    // No room: part with a one-thread wheel to make space for better machinery.
    const wheel = s.machines.find((m) => m.type === 'spinningWheel');
    if (wheel && s.cash > machineCost(s, want) + 15) removeMachine(s, wheel.id);
  }
}

/** Play forward to the given year, deciding once a week. */
export function autoplay(s: GameState, untilYear: number, onWeek?: (s: GameState) => void): void {
  while (yearFloat(s) < untilYear) {
    for (let i = 0; i < 20; i++) step(s, 0.05);
    manage(s);
    onWeek?.(s);
  }
}
