import { GOOD_IDS } from './goods';
import {
  COTTAGE,
  ENGINE2_COST,
  ENGINE_COST,
  EXTENSION_COST,
  FLOOR_H,
  FRAME_ROYALTY,
  MACHINES,
  MAX_FLOORS,
  MILLS,
  MILL_IDS,
  MILL_MIN_X,
  PATENT_LAPSE_YEAR,
  alleyRects,
  type Rect,
  STOREY_COST,
  siteFloor,
  siteId,
  siteMill,
  type MachineType,
  type MillId,
  type SiteId,
} from './machines';
import { HOUSING_COST, OFFER_MAX, OFFER_MIN } from './labour';
import { regionValue } from './region';
import { TECHS, type TechId } from './tech';
import { pushLog, yearFloat, type GameState, type MachineInst } from './state';

export const SCRAP_FRACTION = 0.4;
export const LOAN_STEP = 50;

export function machineCost(s: GameState, type: MachineType): number {
  const base = MACHINES[type].cost;
  return type === 'waterFrame' && yearFloat(s) < PATENT_LAPSE_YEAR + 0.5 ? base + FRAME_ROYALTY : base;
}

export function hasTech(s: GameState, t: TechId | null): boolean {
  return t === null || s.tech.includes(t);
}

export type TechStatus = 'owned' | 'available' | 'tooEarly' | 'needsPrereq';
export function techStatus(s: GameState, t: TechId): TechStatus {
  if (s.tech.includes(t)) return 'owned';
  const def = TECHS[t];
  if (yearFloat(s) < def.year) return 'tooEarly';
  if (!def.requires.every((r) => s.tech.includes(r))) return 'needsPrereq';
  return 'available';
}

export function research(s: GameState, t: TechId): boolean {
  if (techStatus(s, t) !== 'available') return false;
  const cost = TECHS[t].cost;
  if (s.cash < cost) return false;
  s.cash -= cost;
  s.ledger.research += cost;
  s.tech.push(t);
  pushLog(s, `Acquired: ${TECHS[t].name}. ${TECHS[t].unlocks} now available.`);
  return true;
}

export interface SitePlan {
  ox: number;
  /** height of the floor above the ground */
  oy: number;
  oz: number;
  w: number;
  d: number;
  minX: number;
  maxX: number;
  mill: MillId | null;
  floor: number;
}

export function millWidth(s: GameState, id: MillId): number {
  return s.mills[id].extended ? MILLS[id].extW : MILLS[id].baseW;
}

/** Floor plan of a site as it stands now: mills grow when extended. */
export function sitePlan(s: GameState, site: SiteId): SitePlan {
  const mill = siteMill(site);
  if (!mill) return { ox: COTTAGE.ox, oy: 0, oz: COTTAGE.oz, w: COTTAGE.w, d: COTTAGE.d, minX: 0, maxX: COTTAGE.w, mill: null, floor: 0 };
  const def = MILLS[mill];
  const w = millWidth(s, mill);
  const floor = siteFloor(site);
  return { ox: def.ox, oy: floor * FLOOR_H, oz: def.oz, w, d: def.d, minX: MILL_MIN_X, maxX: w - 1, mill, floor };
}

/** Every floor that exists at present. */
export function siteList(s: GameState): SiteId[] {
  const out: SiteId[] = ['cottage'];
  for (const id of MILL_IDS) {
    if (!s.mills[id].built) continue;
    for (let f = 0; f < s.mills[id].floors; f++) out.push(siteId(id, f));
  }
  return out;
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
const bodyOf = (m: MachineInst): Rect => ({ x: m.x, z: m.z, w: MACHINES[m.type].w, d: MACHINES[m.type].d });

/**
 * Returns null if the machine can be placed, otherwise the reason it cannot.
 * A machine needs its floor space, and an alley one tile deep along each side
 * its hands work from. Alleys may be shared between machines, but nothing may
 * stand in one, and an alley cannot lie outside the walls.
 */
export function placeProblem(s: GameState, type: MachineType, site: SiteId, x: number, z: number, flip = false): string | null {
  const def = MACHINES[type];
  const plan = sitePlan(s, site);
  if (!hasTech(s, def.tech)) return 'Not yet known';
  if (plan.mill && !s.mills[plan.mill].built) return 'No mill built';
  if (plan.mill && plan.floor >= s.mills[plan.mill].floors) return 'No such floor';
  if (def.site === 'mill' && !plan.mill) return 'Needs the line shaft in the mill';
  if (x < plan.minX || z < 0 || x + def.w > plan.maxX || z + def.d > plan.d) return 'Outside the floor';
  const body: Rect = { x, z, w: def.w, d: def.d };
  const alleys = alleyRects(type, x, z, flip);
  if (alleys.some((a) => a.z < 0 || a.z + a.d > plan.d)) return 'No room for an alley: turn it about (T) or move it from the wall';
  for (const m of s.machines) {
    if (m.site !== site) continue;
    const other = bodyOf(m);
    if (hit(other, body)) return 'Space occupied';
    if (alleys.some((a) => hit(a, other))) return 'Its alley is blocked';
    if (alleyRects(m.type, m.x, m.z, !!m.flip).some((a) => hit(a, body))) return "Stands in another machine's alley";
  }
  if (s.cash < machineCost(s, type)) return 'Not enough cash';
  return null;
}

export function placeMachine(s: GameState, type: MachineType, site: SiteId, x: number, z: number, flip = false): MachineInst | null {
  if (placeProblem(s, type, site, x, z, flip)) return null;
  const cost = machineCost(s, type);
  s.cash -= cost;
  s.ledger.capital += cost;
  const m: MachineInst = {
    id: s.nextId++,
    type,
    site,
    x,
    z,
    flip,
    on: true,
    run: 0,
    status: 'running',
    missing: null,
    doing: '',
    total: 0,
  };
  s.machines.push(m);
  return m;
}

/** Weeks a machine is out of work while the millwrights take it down and set it up again. */
export const MOVE_WEEKS = 1;

/** Returns null if an existing machine can be moved to the given place, otherwise the reason it cannot. */
export function moveProblem(s: GameState, id: number, site: SiteId, x: number, z: number, flip = false): string | null {
  const at = s.machines.findIndex((m) => m.id === id);
  if (at < 0) return 'No such machine';
  const m = s.machines[at];
  if (m.site === site && m.x === x && m.z === z && !!m.flip === flip) return 'It stands there already';
  // judge the new place as though the machine were not standing where it is
  s.machines.splice(at, 1);
  const problem = placeProblem(s, m.type, site, x, z, flip);
  s.machines.splice(at, 0, m);
  return problem === 'Not enough cash' ? null : problem;
}

/**
 * Take a machine down and set it up somewhere else, on any floor it may stand on.
 * It costs nothing but time: the machine is out of work while it is moved.
 */
export function moveMachine(s: GameState, id: number, site: SiteId, x: number, z: number, flip = false): boolean {
  if (moveProblem(s, id, site, x, z, flip)) return false;
  const m = s.machines.find((mm) => mm.id === id)!;
  m.site = site;
  m.x = x;
  m.z = z;
  m.flip = flip;
  m.down = Math.max(m.down ?? 0, MOVE_WEEKS);
  return true;
}

/** Place a machine in the first spot on a floor where it will go, either way round. For tests and tools. */
export function placeAnywhere(s: GameState, type: MachineType, site: SiteId): MachineInst | null {
  const def = MACHINES[type];
  const plan = sitePlan(s, site);
  for (let z = 0; z + def.d <= plan.d; z++)
    for (let x = plan.minX; x + def.w <= plan.maxX; x++)
      for (const flip of [false, true]) if (!placeProblem(s, type, site, x, z, flip)) return placeMachine(s, type, site, x, z, flip);
  return null;
}

export function scrapValue(s: GameState, m: MachineInst): number {
  return MACHINES[m.type].cost * SCRAP_FRACTION;
}

export function removeMachine(s: GameState, id: number): boolean {
  const i = s.machines.findIndex((m) => m.id === id);
  if (i < 0) return false;
  const v = scrapValue(s, s.machines[i]);
  s.cash += v;
  s.ledger.capital -= v;
  s.machines.splice(i, 1);
  return true;
}

export function toggleMachine(s: GameState, id: number): void {
  const m = s.machines.find((mm) => mm.id === id);
  if (m) m.on = !m.on;
}

export function canBuildMill(s: GameState, id: MillId = 'mill'): string | null {
  if (s.mills[id].built) return 'Already built';
  if (!s.tech.includes('waterMill')) return 'Needs: Water-powered mill';
  if (id === 'mill2') {
    if (!s.tech.includes('steam')) return 'Needs: Rotative steam engine';
    if (!s.mills.mill.built) return 'Build the Old Mill first';
  }
  if (s.cash < MILLS[id].cost) return 'Not enough cash';
  return null;
}

function ensureCoalOrder(s: GameState): void {
  if (s.policy.coal.mode === 'hold') s.policy.coal = { mode: 'buy', level: 300 };
}

export function buildMill(s: GameState, id: MillId = 'mill'): boolean {
  if (canBuildMill(s, id)) return false;
  s.cash -= MILLS[id].cost;
  s.ledger.capital += MILLS[id].cost;
  s.mills[id].built = true;
  if (MILLS[id].engineIncluded) {
    s.mills[id].engine = true;
    ensureCoalOrder(s);
    pushLog(s, `The ${MILLS[id].name} is finished: a steam mill of thirty-four bays with an engine of ${MILLS[id].engineHp} horsepower, tied to no river.`);
  } else {
    pushLog(s, 'The mill is finished: a breast wheel on the river, gearing, and a line shaft the length of the floor.');
  }
  return true;
}

export function canBuildEngine(s: GameState, id: MillId = 'mill'): string | null {
  if (s.mills[id].engine) return 'Already built';
  if (!s.tech.includes('steam')) return 'Needs: Rotative steam engine';
  if (!s.mills[id].built) return 'Needs the mill';
  if (s.cash < ENGINE_COST) return 'Not enough cash';
  return null;
}

export function buildEngine(s: GameState, id: MillId = 'mill'): boolean {
  if (canBuildEngine(s, id)) return false;
  s.cash -= ENGINE_COST;
  s.ledger.capital += ENGINE_COST;
  s.mills[id].engine = true;
  ensureCoalOrder(s);
  pushLog(s, 'The engine from Soho is set to work. Keep the boiler in coal and the shaft will turn winter and summer alike.');
  return true;
}

export function canAddEngine2(s: GameState, id: MillId): string | null {
  if (s.mills[id].engine2) return 'Already built';
  if (!s.tech.includes('bigEngine')) return 'Needs: Engines of the larger class';
  if (!s.mills[id].engine) return 'Needs the first engine';
  if (s.cash < ENGINE2_COST) return 'Not enough cash';
  return null;
}

export function addEngine2(s: GameState, id: MillId): boolean {
  if (canAddEngine2(s, id)) return false;
  s.cash -= ENGINE2_COST;
  s.ledger.capital += ENGINE2_COST;
  s.mills[id].engine2 = true;
  pushLog(s, `A second engine is set up at the ${MILLS[id].name}, with a new boiler beside the old.`);
  return true;
}

export function canExtendMill(s: GameState, id: MillId = 'mill'): string | null {
  if (s.mills[id].extended || MILLS[id].extW === MILLS[id].baseW) return 'Already built';
  if (!s.tech.includes('steam')) return 'Needs: Rotative steam engine';
  if (!s.mills[id].built) return 'Needs the mill';
  if (s.cash < EXTENSION_COST) return 'Not enough cash';
  return null;
}

export function extendMill(s: GameState, id: MillId = 'mill'): boolean {
  if (canExtendMill(s, id)) return false;
  s.cash -= EXTENSION_COST;
  s.ledger.capital += EXTENSION_COST;
  s.mills[id].extended = true;
  pushLog(s, 'The mill is lengthened by fourteen bays and the line shaft carried through.');
  return true;
}

/** Cost of the next storey: a longer mill costs more to raise. */
export function storeyCost(s: GameState, id: MillId): number {
  return Math.round((STOREY_COST * millWidth(s, id)) / MILLS.mill.baseW);
}

export function canAddStorey(s: GameState, id: MillId): string | null {
  if (!s.mills[id].built) return 'Needs the mill';
  if (s.mills[id].floors >= MAX_FLOORS) return 'Already at full height';
  if (s.cash < storeyCost(s, id)) return 'Not enough cash';
  return null;
}

export function addStorey(s: GameState, id: MillId): boolean {
  if (canAddStorey(s, id)) return false;
  const cost = storeyCost(s, id);
  s.cash -= cost;
  s.ledger.capital += cost;
  s.mills[id].floors++;
  pushLog(s, `A new storey is raised on the ${MILLS[id].name}. The upright shaft is carried up to drive a line shaft on the new floor.`);
  return true;
}

/** Order a spinning machine to spin coarse (0), middling (1) or fine (2) counts. */
export function setGrade(s: GameState, id: number, grade: number): void {
  const m = s.machines.find((mm) => mm.id === id);
  if (m && MACHINES[m.type].grades?.includes(grade)) m.grade = grade;
}

export function setPreference(s: GameState, id: number, label: string | null): void {
  const m = s.machines.find((mm) => mm.id === id);
  if (m) m.pref = label;
}

/** What the buildings, engines and cottages cost to put up. */
export function assetBase(s: GameState): number {
  let v = s.labour.housing * HOUSING_COST;
  for (const id of MILL_IDS) {
    const m = s.mills[id];
    if (!m.built) continue;
    v += MILLS[id].cost;
    if (m.engine && !MILLS[id].engineIncluded) v += ENGINE_COST;
    if (m.extended) v += EXTENSION_COST;
    if (m.engine2) v += ENGINE2_COST;
    v += (m.floors - 1) * STOREY_COST;
  }
  // the cut or the siding to the works
  for (let i = 1; i <= s.transport; i++) v += [0, 1800, 4500][i];
  return v;
}

export function assetValue(s: GameState): number {
  let v = assetBase(s) * 0.6;
  for (const m of s.machines) v += MACHINES[m.type].cost * 0.5;
  for (const g of GOOD_IDS) v += s.stock[g] * s.prices[g];
  return v;
}

export function canBuildHousing(s: GameState): string | null {
  if (s.cash < HOUSING_COST) return 'Not enough cash';
  return null;
}

/** A row of cottages near the works: hands who will stay, whatever the going rate elsewhere. */
export function buildHousing(s: GameState): boolean {
  if (canBuildHousing(s)) return false;
  s.cash -= HOUSING_COST;
  s.ledger.capital += HOUSING_COST;
  s.labour.housing++;
  return true;
}

export function setWageOffer(s: GameState, offer: number): void {
  s.labour.offer = Math.round(Math.max(OFFER_MIN, Math.min(OFFER_MAX, offer)) * 100) / 100;
}

/** End a strike at once by giving way: a tenth on the wages. */
export function concedeStrike(s: GameState): boolean {
  if (s.labour.strike <= 0) return false;
  setWageOffer(s, s.labour.offer + 0.1);
  s.labour.strike = 0;
  s.labour.morale = Math.max(s.labour.morale, 50);
  pushLog(s, 'You give way on wages and the hands return to work.');
  return true;
}

export function netWorth(s: GameState): number {
  return s.cash - s.loan + assetValue(s) + regionValue(s);
}

/** Lenders advance a base sum plus half the value of plant and stock. */
export function creditLimit(s: GameState): number {
  // bankers lend more freely to a man of standing
  return Math.floor(((100 + assetValue(s) * 0.5) * (1 + s.standing / 150)) / LOAN_STEP) * LOAN_STEP;
}

export function borrow(s: GameState, amount = LOAN_STEP): boolean {
  if (s.loan + amount > creditLimit(s)) return false;
  s.loan += amount;
  s.cash += amount;
  return true;
}

export function repay(s: GameState, amount = LOAN_STEP): boolean {
  amount = Math.min(amount, s.loan);
  if (amount <= 0 || s.cash < amount) return false;
  s.loan -= amount;
  s.cash -= amount;
  return true;
}
