import { GOOD_IDS, type Good } from './goods';
import type { MachineType, MillId, SiteId } from './machines';
import type { TechId } from './tech';

export type Status = 'repair' | 'running' | 'short' | 'starved' | 'underpowered' | 'understaffed' | 'unpaid' | 'strike' | 'off';

export interface MachineInst {
  id: number;
  type: MachineType;
  site: SiteId;
  /** min-corner tile within the site */
  x: number;
  z: number;
  /** turned about, so that it faces -z */
  flip?: boolean;
  on: boolean;
  /** 0..1, fraction of rated speed achieved in the last tick */
  run: number;
  status: Status;
  /** the input it is waiting for, if any */
  missing: Good | null;
  /** label of the recipe in use */
  doing: string;
  /** lifetime output of its main product */
  total: number;
  /** label of the recipe the player has ordered, if any; otherwise the machine chooses */
  pref?: string | null;
  /** yarn count being spun: 0 coarse, 1 middling (the default), 2 fine */
  grade?: number;
  /** weeks until a breakdown is repaired */
  down?: number;
}

export type PolicyMode = 'hold' | 'buy' | 'sell';
export interface Policy {
  mode: PolicyMode;
  /** buy: keep at least this much. sell: sell anything above this. */
  level: number;
}

export interface Ledger {
  year: number;
  sales: number;
  materials: number;
  wages: number;
  capital: number;
  research: number;
  interest: number;
  /** repairs to machinery and buildings */
  upkeep: number;
  /** net income from mills elsewhere, ventures and shares */
  outside: number;
}

export interface LogEntry {
  week: number;
  text: string;
}

export interface PowerState {
  /** river flow as a fraction of the rated flow */
  flow: number;
  available: number;
  demand: number;
  /** 0..1 speed of the line shaft relative to rated speed */
  factor: number;
  /** horsepower being delivered by the steam engine */
  engineLoad: number;
}

export interface MillState {
  built: boolean;
  extended: boolean;
  engine: boolean;
  /** a second, larger engine */
  engine2: boolean;
  /** storeys, 1 to MAX_FLOORS */
  floors: number;
  /** iron columns and brick arches in place of timber floors */
  fireproof?: boolean;
}

export interface LabourState {
  /** wages offered, as a multiple of the going rate (1 = the going rate) */
  offer: number;
  /** the district's going rate, as a multiple of 1760 wages */
  going: number;
  /** 0..100 */
  morale: number;
  /** rows of cottages built for the hands */
  housing: number;
  /** weeks of a strike still to run (0 = at work) */
  strike: number;
  /** hands the machines call for, and hands to be had */
  needed: number;
  available: number;
  /** 0..1, how fully the machines are manned */
  staffing: number;
}

/** A mill you own in another town, run for you by a manager. */
export interface OutsideMill {
  id: string;
  /** 1..4: how modern its machinery is */
  level: number;
  /** what you have laid out on it in all */
  paid: number;
  /** times it has been enlarged */
  enlarged: number;
}

export interface RegionState {
  mills: OutsideMill[];
  /** ids of ventures bought */
  ventures: string[];
  /** lots of canal and railway shares held */
  canal: number;
  rail: number;
}

export interface Stats {
  /** pieces of cloth and pounds of yarn made since 1760 */
  cloth: number;
  calico: number;
  muslin: number;
  yarn: number;
  /** pounds of cotton twist spun and pieces printed since 1760, whatever became of the machines */
  twist: number;
  prints: number;
  peakHands: number;
  strikes: number;
  /** machines lost to machine breakers */
  broken: number;
  fires: number;
}

export interface GameState {
  v: 4;
  /** weeks since 1 January 1760 */
  week: number;
  cash: number;
  loan: number;
  stock: Record<Good, number>;
  policy: Record<Good, Policy>;
  prices: Record<Good, number>;
  glut: Record<Good, number>;
  noise: Record<Good, number>;
  machines: MachineInst[];
  nextId: number;
  tech: TechId[];
  mills: Record<MillId, MillState>;
  log: LogEntry[];
  fired: string[];
  ledger: Ledger;
  history: Ledger[];
  seed: number;
  power: Record<MillId, PowerState>;
  labour: LabourState;
  region: RegionState;
  stats: Stats;
  /** ids of milestones reached */
  goals: string[];
  difficulty: 'easy' | 'normal' | 'hard';
  /** id of the scenario being played, and how it came out */
  scenario: string;
  scenarioEnd: 'won' | 'lost' | null;
  /** running totals as they stood when the scenario began, so only what you do counts */
  scenarioBase: { twist: number };
  /** average quality of each good in stock (1 = middling) */
  quality: Record<Good, number>;
  /** whether breakdowns and fires can happen (always on in play; switched off in some tests) */
  hazards: boolean;
  insured: boolean;
  fireEngine: boolean;
  lastFire: { week: number; mill: MillId; floor: number } | null;
  /** export markets in which you keep an agent */
  agents: string[];
  /** 0 cart road, 1 canal branch, 2 railway siding */
  transport: number;
  rivals: { id: string; worth: number; alive: boolean }[];
  /** 0..100: your name in the county */
  standing: number;
  member: boolean;
  /** id of a question awaiting your decision */
  pending: string | null;
  pendingWeek: number;
  decided: Record<string, number>;
  /** laws evaded and causes joined */
  evade: string[];
  ended: boolean;
  /** true while there is no money for wages and the hands have stopped work */
  broke: boolean;
}

export const START_YEAR = 1760;
export const END_YEAR = 1850;
export const WEEKS_PER_YEAR = 52;

export function yearOf(week: number): number {
  return START_YEAR + Math.floor(week / WEEKS_PER_YEAR + 1e-9);
}
export function yearFloat(s: GameState): number {
  return START_YEAR + s.week / WEEKS_PER_YEAR;
}

/** Deterministic PRNG (mulberry32) whose state lives in the save. */
export function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function perGood<T>(f: (g: Good) => T): Record<Good, T> {
  const o = {} as Record<Good, T>;
  for (const g of GOOD_IDS) o[g] = f(g);
  return o;
}

export function emptyLedger(year: number): Ledger {
  return { year, sales: 0, materials: 0, wages: 0, capital: 0, research: 0, interest: 0, upkeep: 0, outside: 0 };
}

export function ledgerProfit(l: Ledger): number {
  return l.sales - l.materials - l.wages - l.interest - l.upkeep + l.outside;
}

export function emptyPower(): PowerState {
  return { flow: 1, available: 0, demand: 0, factor: 0, engineLoad: 0 };
}

function inst(id: number, type: MachineType, site: SiteId, x: number, z: number): MachineInst {
  return { id, type, site, x, z, on: true, run: 0, status: 'running', missing: null, doing: '', total: 0 };
}

export function newGame(seed = 1760): GameState {
  const stock = perGood(() => 0);
  stock.cotton = 30;
  stock.linenWarp = 20;
  const policy = perGood<Policy>(() => ({ mode: 'hold', level: 0 }));
  policy.cotton = { mode: 'buy', level: 40 };
  policy.linenWarp = { mode: 'buy', level: 15 };
  policy.fustian = { mode: 'sell', level: 0 };
  policy.calico = { mode: 'sell', level: 0 };
  policy.warp = { mode: 'sell', level: 40 };
  policy.weft = { mode: 'sell', level: 30 };
  policy.roving = { mode: 'sell', level: 150 };
  policy.fineYarn = { mode: 'sell', level: 30 };
  policy.muslin = { mode: 'sell', level: 0 };
  policy.white = { mode: 'sell', level: 0 };
  policy.print = { mode: 'sell', level: 0 };
  return {
    v: 4,
    week: 0,
    cash: 25,
    loan: 0,
    stock,
    policy,
    prices: perGood(() => 0),
    glut: perGood(() => 0),
    noise: perGood(() => 0),
    machines: [
      inst(1, 'spinningWheel', 'cottage', 0, 0),
      inst(2, 'spinningWheel', 'cottage', 2, 0),
      inst(3, 'spinningWheel', 'cottage', 4, 0),
      inst(4, 'spinningWheel', 'cottage', 6, 0),
      inst(5, 'handloom', 'cottage', 0, 3),
    ],
    nextId: 6,
    tech: ['flyShuttle'],
    mills: {
      mill: { built: false, extended: false, engine: false, engine2: false, floors: 1 },
      mill2: { built: false, extended: false, engine: false, engine2: false, floors: 1 },
    },
    log: [],
    fired: [],
    ledger: emptyLedger(START_YEAR),
    history: [],
    seed,
    power: { mill: emptyPower(), mill2: emptyPower() },
    labour: { offer: 1, going: 1, morale: 60, housing: 0, strike: 0, needed: 5, available: 30, staffing: 1 },
    region: { mills: [], ventures: [], canal: 0, rail: 0 },
    stats: { cloth: 0, calico: 0, muslin: 0, yarn: 0, twist: 0, prints: 0, peakHands: 5, strikes: 0, broken: 0, fires: 0 },
    goals: [],
    difficulty: 'normal',
    scenario: 'full',
    scenarioEnd: null,
    scenarioBase: { twist: 0 },
    quality: perGood(() => 1),
    hazards: true,
    insured: false,
    fireEngine: false,
    lastFire: null,
    agents: [],
    transport: 0,
    rivals: [],
    standing: 20,
    member: false,
    pending: null,
    pendingWeek: 0,
    decided: {},
    evade: [],
    ended: false,
    broke: false,
  };
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameState | null {
  try {
    const s = JSON.parse(json) as GameState;
    if (!s || s.v !== 4 || !Array.isArray(s.machines)) return null;
    // saves from before the regional expansion
    s.region ??= { mills: [], ventures: [], canal: 0, rail: 0 };
    for (const l of [s.ledger, ...s.history]) l.outside ??= 0;
    for (const m of s.region.mills) m.enlarged ??= 0;
    // saves from before rivals, exports, hazards and politics
    const fresh = newGame();
    const loose = s as unknown as Record<string, unknown>;
    for (const k of Object.keys(fresh) as (keyof GameState)[]) if (loose[k] === undefined) loose[k] = fresh[k];
    for (const g of GOOD_IDS) {
      s.stock[g] ??= 0;
      s.prices[g] ??= 0;
      s.glut[g] ??= 0;
      s.noise[g] ??= 0;
      s.quality[g] ??= 1;
      s.policy[g] ??= fresh.policy[g];
    }
    s.stats.fires ??= 0;
    // older saves kept no running total: start from what the present machines have made
    s.stats.twist ??= s.machines.filter((m) => m.type === 'waterFrame' || m.type === 'throstle').reduce((t, m) => t + m.total, 0);
    s.stats.prints ??= s.machines.filter((m) => m.type === 'printingMachine').reduce((t, m) => t + m.total, 0);
    s.scenarioBase ??= { twist: 0 };
    return s;
  } catch {
    return null;
  }
}

export function pushLog(s: GameState, text: string): void {
  s.log.push({ week: s.week, text });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}
