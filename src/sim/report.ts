import { hasTech } from './actions';
import { GOODS, GOOD_IDS, type Good } from './goods';
import { GRADES, MACHINES, MACHINE_IDS, type MachineType, type Recipe } from './machines';
import type { GameState, MachineInst } from './state';

/**
 * A view of the whole works at once: what is made and used of each good,
 * how long the stock will last, which machines are waiting, and what is
 * holding production back.
 */

export type Limit = 'materials' | 'hands' | 'power' | 'repair' | 'strike' | 'wages' | 'stopped';

/** In a few words, why a machine is held up. */
export function limitReason(m: MachineInst): string {
  const lim = limitOf(m);
  if (!lim) return '';
  const pct = `${Math.round(m.run * 100)}%`;
  if (lim === 'materials') return m.run > 0 ? `Running at ${pct}: short of ${m.missing ? GOODS[m.missing].name.toLowerCase() : 'material'}` : `Standing: no ${m.missing ? GOODS[m.missing].name.toLowerCase() : 'material'}`;
  if (lim === 'hands') return `Running at ${pct}: short of hands`;
  if (lim === 'power') return `Running at ${pct}: short of power`;
  return LIMIT_NAMES[lim];
}

export const LIMIT_NAMES: Record<Limit, string> = {
  materials: 'Short of material',
  hands: 'Short of hands',
  power: 'Short of power',
  repair: 'Under repair or being moved',
  strike: 'On strike',
  wages: 'No money for wages',
  stopped: 'Stopped by you',
};

/** A machine within a tenth of full speed is not worth a warning. */
export const NEAR_FULL = 0.9;

/** What is holding a machine back, or null if it is running freely (or near enough). */
export function limitOf(m: MachineInst): Limit | null {
  if ((m.status === 'short' || m.status === 'understaffed' || m.status === 'underpowered') && m.run >= NEAR_FULL) return null;
  switch (m.status) {
    case 'starved':
    case 'short':
      return 'materials';
    case 'understaffed':
      return 'hands';
    case 'underpowered':
      return 'power';
    case 'repair':
      return 'repair';
    case 'strike':
      return 'strike';
    case 'unpaid':
      return 'wages';
    case 'off':
      return 'stopped';
    default:
      return null;
  }
}

/** The recipe a machine is working (or would work), and its rate allowing for the yarn count set. */
function working(m: MachineInst): { recipe: Recipe; rate: number } {
  const def = MACHINES[m.type];
  const recipe = def.recipes.find((r) => r.label === m.doing) ?? def.recipes.find((r) => r.label === m.pref) ?? def.recipes[def.recipes.length - 1];
  const grade = def.grades ? GRADES[def.grades.includes(m.grade ?? 1) ? (m.grade ?? 1) : def.grades[0]] : null;
  return { recipe, rate: grade ? grade.rate : 1 };
}

export interface GoodReport {
  good: Good;
  /** units a week at present, and what the machines could do at full work */
  made: number;
  madeFull: number;
  used: number;
  usedFull: number;
  stock: number;
  /** weeks the stock will last at the present rate of use, if it is running down; null if it is not */
  weeksLeft: number | null;
  /** machines standing or slowed for want of it */
  waiting: number;
  /** kinds of machine that use it and make it, among those you have */
  users: MachineType[];
  makers: MachineType[];
  /** whether a standing order is buying it in or selling it off */
  order: 'buy' | 'sell' | 'hold';
  /** what to do about it, if anything needs doing */
  advice: string | null;
}

export interface Report {
  goods: GoodReport[];
  /** machines held back, by cause */
  limits: Record<Limit, number>;
  machines: number;
  running: number;
  /** the one thing most worth attending to, in a sentence; null if all is well */
  headline: string | null;
  /** per mill: power wanted and to be had */
  power: { name: string; demand: number; available: number }[];
}

/** "a, b and c" */
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Machines by the names a manager would use in speech. */
const PLURAL: Record<MachineType, string> = {
  spinningWheel: 'spinning wheels',
  handloom: 'handlooms',
  jenny: 'jennies',
  cardingEngine: 'carding engines',
  rovingFrame: 'drawing frames',
  waterFrame: 'water frames',
  mule: 'mules',
  powerLoom: 'power looms',
  scutcher: 'scutchers',
  throstle: 'throstles',
  selfActor: 'self-acting mules',
  lancashireLoom: 'Lancashire looms',
  dressingFrame: 'dressing frames',
  bleachWorks: 'bleaching crofts',
  printingMachine: 'printing machines',
};
const plural = (t: MachineType, _n: number) => PLURAL[t];

export function productionReport(s: GameState): Report {
  const per = new Map<Good, GoodReport>();
  for (const g of GOOD_IDS) {
    per.set(g, { good: g, made: 0, madeFull: 0, used: 0, usedFull: 0, stock: s.stock[g], weeksLeft: null, waiting: 0, users: [], makers: [], order: s.policy[g].mode, advice: null });
  }
  const limits: Record<Limit, number> = { materials: 0, hands: 0, power: 0, repair: 0, strike: 0, wages: 0, stopped: 0 };
  /** the machines making each good, to trace a shortage back to its cause */
  const makersOf = new Map<Good, MachineInst[]>();
  let running = 0;
  for (const m of s.machines) {
    const { recipe, rate } = working(m);
    const lim = limitOf(m);
    if (lim) limits[lim]++;
    else running++;
    for (const g of Object.keys(recipe.in) as Good[]) {
      const r = per.get(g)!;
      const q = recipe.in[g]! * rate;
      r.usedFull += m.on ? q : 0;
      r.used += q * m.run;
      if (!r.users.includes(m.type)) r.users.push(m.type);
      if (m.missing === g && lim === 'materials') r.waiting++;
    }
    for (const g of Object.keys(recipe.out) as Good[]) {
      const r = per.get(g)!;
      const q = recipe.out[g]! * rate;
      r.madeFull += m.on ? q : 0;
      r.made += q * m.run;
      if (!r.makers.includes(m.type)) r.makers.push(m.type);
      makersOf.set(g, [...(makersOf.get(g) ?? []), m]);
    }
  }

  for (const r of per.values()) {
    const g = r.good;
    // stock runs down only if nothing is buying it in
    const drain = r.used - r.made;
    if (drain > 1e-6 && r.order !== 'buy') r.weeksLeft = r.stock / drain;
    const short = r.waiting > 0 || (r.usedFull > r.madeFull + 1e-6 && r.order !== 'buy' && (r.weeksLeft ?? 99) < 4);
    if (!short || r.usedFull <= 0) continue;
    const users = list(r.users.map((t) => plural(t, 2)));
    const name = GOODS[g].name.toLowerCase();
    // machines you know how to build that make it
    const could = MACHINE_IDS.filter((t) => hasTech(s, MACHINES[t].tech) && MACHINES[t].recipes.some((x) => g in x.out));
    const ways: string[] = [];
    if (could.length) ways.push(`add ${could.map((t) => plural(t, 2)).join(' or ')}`);
    if (GOODS[g].buy) {
      if (r.order === 'buy') ways.push(s.cash <= 0 ? 'find the money: your standing order cannot be met' : 'raise the level of your standing order');
      else ways.push(`buy ${name} at the market`);
    }
    const lack = r.usedFull - r.madeFull;
    // Is the shortage really a fault further up? If most of the machines that make this good are
    // themselves held up, say by what, so the player mends the cause and not the symptom.
    const mk = makersOf.get(g) ?? [];
    const heldBy = new Map<string, number>();
    for (const m of mk) {
      const lim = limitOf(m);
      if (!lim || lim === 'stopped') continue;
      const key = lim === 'materials' && m.missing ? `materials:${m.missing}` : lim;
      heldBy.set(key, (heldBy.get(key) ?? 0) + 1);
    }
    const cause = [...heldBy.entries()].sort((a, b) => b[1] - a[1])[0];
    if (cause && cause[1] * 2 >= mk.length) {
      const makers = list(r.makers.map((t) => plural(t, 2)));
      const [kind, up] = cause[0].split(':');
      const why =
        kind === 'materials'
          ? `are themselves waiting for ${GOODS[up as Good].name.toLowerCase()}: see to that first`
          : kind === 'power'
            ? 'are short of power: see that the engine has coal, add an engine, or stop some machinery'
            : kind === 'hands'
              ? 'are short of hands: raise wages or build cottages'
              : kind === 'repair'
                ? 'are out of work for repairs or moving, and will be back shortly'
                : kind === 'strike'
                  ? 'are stopped by the strike'
                  : 'are stopped for want of wages';
      r.advice = `Your ${users} need more ${name}, but the ${makers} that make it ${why}.`;
      continue;
    }
    r.advice = `Your ${users} need more ${name}${lack > 0 && r.order !== 'buy' ? ` (about ${Math.round(lack)} ${GOODS[g].unit} a week more than is made)` : ''}. ${ways.length ? ways.join(', or ').replace(/^./, (c) => c.toUpperCase()) + '.' : ''}`.trim();
  }

  const goods = [...per.values()].filter((r) => r.made > 0 || r.used > 0 || r.stock > 0.05 || r.usedFull > 0 || r.madeFull > 0);

  // the headline: whatever stops the most machines
  let headline: string | null = null;
  const advised = [...goods].filter((r) => r.advice);
  // of the goods that are short, the one furthest up the chain is the place to start
  // a shortage caused by want of power or hands comes before any other; then one not itself waiting on another good
  const byWaiting = (a: GoodReport, b: GoodReport) => b.waiting - a.waiting;
  const deep = advised.filter((r) => /short of power|short of hands|strike|want of wages/.test(r.advice!)).sort(byWaiting);
  const roots = advised.filter((r) => !/waiting for/.test(r.advice!)).sort(byWaiting);
  const worst = deep[0] ?? roots[0] ?? advised.sort(byWaiting)[0];
  const top = (Object.keys(limits) as Limit[]).filter((k) => k !== 'stopped').sort((a, b) => limits[b] - limits[a])[0];
  if (limits[top] > 0) {
    if (top === 'materials' && worst) headline = worst.advice;
    else if (top === 'hands') headline = `${limits.hands} machines are short of hands: the works calls for ${s.labour.needed} and only ${s.labour.available} are to be had. Raise wages or build cottages (see Hands).`;
    else if (top === 'power') headline = `${limits.power} machines are slowed for want of power. Add an engine, or stop some machinery until the river rises.`;
    else if (top === 'strike') headline = 'The hands are on strike and nothing is working. See Hands.';
    else if (top === 'wages') headline = 'There is no money for wages. Borrow at the Ledger, or sell stock at the Market.';
    else if (top === 'repair') headline = `${limits.repair} machine${limits.repair === 1 ? ' is' : 's are'} out of work for repairs or moving. They will be back within a week or two.`;
  }
  if (!headline && worst) headline = worst.advice;

  const power: Report['power'] = [];
  for (const id of ['mill', 'mill2'] as const) {
    if (s.mills[id].built) power.push({ name: id === 'mill' ? 'Old Mill' : 'New Mill', demand: s.power[id].demand, available: s.power[id].available });
  }
  return { goods, limits, machines: s.machines.length, running, headline, power };
}
