import { pushLog, yearFloat, WEEKS_PER_YEAR, type GameState, type OutsideMill } from './state';
import type { TechId } from './tech';

/**
 * Regional expansion: places to put money beyond the home works.
 *
 *  - Mills in other towns, bought outright and run by a manager. They are not
 *    shown on the map; they return a yearly profit that follows the state of
 *    trade and falls away if their machinery is left to grow old.
 *  - Ventures that help the home works: cheaper cotton, dearer cloth, a wider market.
 *  - Canal and railway shares, paying a dividend.
 */

export interface TownDef {
  id: string;
  town: string;
  kind: string;
  /** first year it can be bought */
  year: number;
  /** relative size: scales cost, hands and profit */
  size: number;
  hands: number;
  /** position on the sketch map, 0..100 */
  mx: number;
  my: number;
  note: string;
}

export const TOWNS: TownDef[] = [
  { id: 'stockport', town: 'Stockport', kind: 'Spinning mill on the Mersey', year: 1778, size: 1, hands: 90, mx: 66, my: 80, note: 'Old silk mills turned over to cotton, with a good fall of water.' },
  { id: 'bury', town: 'Bury', kind: 'Spinning and printing', year: 1784, size: 1.1, hands: 110, mx: 55, my: 46, note: 'The country of the Peels, calico printers turned spinners.' },
  { id: 'preston', town: 'Preston', kind: 'Spinning mill', year: 1791, size: 1.3, hands: 140, mx: 22, my: 22, note: "John Horrocks's town: fine yarns and good cloth." },
  { id: 'oldham', town: 'Oldham', kind: 'Coarse spinning mill', year: 1798, size: 1.5, hands: 170, mx: 74, my: 52, note: 'Coal under the streets and mills rising on every hillside.' },
  { id: 'ashton', town: 'Ashton-under-Lyne', kind: 'Spinning and weaving', year: 1805, size: 1.7, hands: 200, mx: 78, my: 66, note: 'A combined mill: yarn spun and cloth woven under one roof.' },
  { id: 'blackburn', town: 'Blackburn', kind: 'Weaving shed', year: 1812, size: 1.9, hands: 240, mx: 40, my: 20, note: "Hargreaves's country, and soon the capital of the power loom." },
  { id: 'burnley', town: 'Burnley', kind: 'Weaving shed', year: 1822, size: 2.2, hands: 280, mx: 66, my: 14, note: 'Plain calicoes for the East, woven by the mile.' },
  { id: 'manchester', town: 'Manchester', kind: 'Fine spinning mill in Ancoats', year: 1826, size: 3, hands: 420, mx: 60, my: 68, note: 'Eight storeys on the canal, the finest counts in the world.' },
];

export const MILL_BASE_COST = 1800;
/** Each further mill costs this much more than the last: good managers and good sites grow scarce. */
export const MILL_COST_GROWTH = 1.25;
/** Best yearly return on money laid out in a well-kept outside mill. */
export const MILL_RETURN = 0.07;
/** Every enlargement costs more than the last and earns a little less on the money. */
export const ENLARGE_COST_GROWTH = 1.3;
export const ENLARGE_RETURN_FALL = 0.93;
export const MAX_LEVEL = 4;

export const LEVELS: { name: string; needs: TechId[]; standardFrom: number }[] = [
  { name: 'Water frames and handlooms', needs: [], standardFrom: 1760 },
  { name: 'Throstles, mules and power looms', needs: ['throstle', 'powerLoom'], standardFrom: 1808 },
  { name: 'Self-acting mules', needs: ['selfActor'], standardFrom: 1835 },
  { name: 'Lancashire looms', needs: ['lancashireLoom'], standardFrom: 1845 },
];

/** How modern a mill must be to hold its own in the trade this year (1..4). */
export function tradeStandard(y: number): number {
  let level = 1;
  LEVELS.forEach((l, i) => {
    if (y >= l.standardFrom) level = i + 1;
  });
  return level;
}

/** The state of trade: 1 in ordinary years, low or negative in the slumps. */
export function tradeIndex(y: number): number {
  if (y >= 1793.1 && y < 1795) return 0.4;
  if (y >= 1812.3 && y < 1815) return 0.3;
  if (y >= 1826 && y < 1827.5) return -0.3;
  if (y >= 1837.3 && y < 1838.5) return 0.1;
  if (y >= 1841 && y < 1842.8) return -0.3;
  // otherwise a gentle swing between good years and middling ones
  return 1 + 0.2 * Math.sin(y * 0.9);
}

export function townCost(s: GameState, id: string): number {
  const def = TOWNS.find((t) => t.id === id)!;
  return Math.round((MILL_BASE_COST * def.size * Math.pow(MILL_COST_GROWTH, s.region.mills.length)) / 50) * 50;
}

export function canBuyTown(s: GameState, id: string): string | null {
  const def = TOWNS.find((t) => t.id === id);
  if (!def) return 'No such mill';
  if (s.region.mills.some((m) => m.id === id)) return 'Already yours';
  if (yearFloat(s) < def.year) return `Not to be had before ${def.year}`;
  if (!s.mills.mill.built) return 'Build a mill of your own first';
  if (s.cash < townCost(s, id)) return 'Not enough cash';
  return null;
}

export function buyTown(s: GameState, id: string): boolean {
  if (canBuyTown(s, id)) return false;
  const cost = townCost(s, id);
  const def = TOWNS.find((t) => t.id === id)!;
  s.cash -= cost;
  s.ledger.capital += cost;
  // a mill is bought as it stands: up to date if you hold the patents, otherwise a step behind
  let level = 1;
  for (let i = 1; i < tradeStandard(yearFloat(s)); i++) if (LEVELS[i].needs.every((t) => s.tech.includes(t))) level = i + 1;
  s.region.mills.push({ id, level, paid: cost, enlarged: 0 });
  pushLog(s, `You take a mill at ${def.town}, with a manager to run it.`);
  return true;
}

export function refitCost(s: GameState, m: OutsideMill): number {
  const def = TOWNS.find((t) => t.id === m.id)!;
  return Math.round((MILL_BASE_COST * def.size * 0.6 * (1 + 0.5 * m.level)) / 50) * 50;
}

export function canRefit(s: GameState, id: string): string | null {
  const m = s.region.mills.find((x) => x.id === id);
  if (!m) return 'Not yours';
  if (m.level >= MAX_LEVEL) return 'Has the newest machinery';
  const next = LEVELS[m.level];
  if (!next.needs.every((t) => s.tech.includes(t))) return 'Needs inventions you have not acquired';
  if (s.cash < refitCost(s, m)) return 'Not enough cash';
  return null;
}

/** Re-equip an outside mill with the next generation of machinery. */
export function refit(s: GameState, id: string): boolean {
  if (canRefit(s, id)) return false;
  const m = s.region.mills.find((x) => x.id === id)!;
  const cost = refitCost(s, m);
  s.cash -= cost;
  s.ledger.capital += cost;
  m.paid += cost;
  m.level++;
  return true;
}

export function enlargeCost(s: GameState, m: OutsideMill): number {
  const def = TOWNS.find((t) => t.id === m.id)!;
  return Math.round((MILL_BASE_COST * def.size * Math.pow(ENLARGE_COST_GROWTH, m.enlarged + 1)) / 50) * 50;
}

export function canEnlarge(s: GameState, id: string): string | null {
  const m = s.region.mills.find((x) => x.id === id);
  if (!m) return 'Not yours';
  if (s.cash < enlargeCost(s, m)) return 'Not enough cash';
  return null;
}

/** Add a wing, a shed or another storey to an outside mill. There is no limit but the cost. */
export function enlarge(s: GameState, id: string): boolean {
  if (canEnlarge(s, id)) return false;
  const m = s.region.mills.find((x) => x.id === id)!;
  const cost = enlargeCost(s, m);
  s.cash -= cost;
  s.ledger.capital += cost;
  m.paid += cost;
  m.enlarged++;
  return true;
}

/** Yearly return on the money laid out in an outside mill, as a fraction. */
export function millReturn(s: GameState, m: OutsideMill): number {
  const y = yearFloat(s);
  const behind = Math.max(0, tradeStandard(y) - m.level);
  const trade = tradeIndex(y);
  // old machinery earns less in good times and loses more in bad
  const scale = Math.pow(ENLARGE_RETURN_FALL, m.enlarged); // a sprawling concern is harder to manage well
  return trade >= 0 ? MILL_RETURN * trade * Math.pow(0.55, behind) * scale : MILL_RETURN * trade * (1 + 0.5 * behind);
}

// ---------------------------------------------------------------- ventures

export interface VentureDef {
  id: string;
  name: string;
  year: number;
  cost: number;
  effect: string;
  note: string;
}

export const VENTURES: VentureDef[] = [
  { id: 'warehouse', name: 'Cotton warehouse at Liverpool', year: 1770, cost: 700, effect: 'Raw cotton 7% cheaper', note: 'Buy on the quay and cut out the Manchester dealer.' },
  { id: 'bleach', name: 'Bleach and print works', year: 1785, cost: 2500, effect: 'Cloth sells 6% dearer', note: 'Chlorine bleaching and roller printing: finished goods fetch more than grey cloth.' },
  { id: 'colliery', name: 'Share in a colliery', year: 1790, cost: 1500, effect: 'Coal 40% cheaper', note: 'A pit at Worsley or Wigan, with the canal to the yard gate.' },
  { id: 'merchant', name: 'Merchant house in Manchester', year: 1795, cost: 4500, effect: 'The market takes half as much cloth and yarn again before prices sag', note: 'Your own travellers and correspondents, from Hamburg to Calcutta.' },
];

export const hasVenture = (s: GameState, id: string) => s.region.ventures.includes(id);

export function canBuyVenture(s: GameState, id: string): string | null {
  const def = VENTURES.find((v) => v.id === id);
  if (!def) return 'No such venture';
  if (hasVenture(s, id)) return 'Already yours';
  if (yearFloat(s) < def.year) return `Not before ${def.year}`;
  if (s.cash < def.cost) return 'Not enough cash';
  return null;
}

export function buyVenture(s: GameState, id: string): boolean {
  if (canBuyVenture(s, id)) return false;
  const def = VENTURES.find((v) => v.id === id)!;
  s.cash -= def.cost;
  s.ledger.capital += def.cost;
  s.region.ventures.push(id);
  pushLog(s, `New venture: ${def.name.charAt(0).toLowerCase()}${def.name.slice(1)}.`);
  return true;
}

// ------------------------------------------------------------------ shares

export const CANAL = { name: 'Canal shares', year: 1790, lot: 1000, max: 10 };
export const RAIL = { name: 'Railway shares', year: 1830, lot: 2500, max: 20 };

/** Yearly dividend on canal shares: handsome until the railways come. */
export function canalDividend(y: number): number {
  return y < 1830.7 ? 0.05 : y < 1840 ? 0.03 : 0.02;
}

/** Yearly dividend on railway shares: the mania of 1845 and its collapse. */
export function railDividend(y: number): number {
  if (y < 1845) return 0.055;
  if (y < 1847.3) return 0.09;
  if (y < 1849.5) return 0.01;
  return 0.035;
}

export function canBuyShares(s: GameState, kind: 'canal' | 'rail'): string | null {
  const def = kind === 'canal' ? CANAL : RAIL;
  if (yearFloat(s) < def.year) return `Not before ${def.year}`;
  if (s.region[kind] >= def.max) return 'You hold all that are to be had';
  if (s.cash < def.lot) return 'Not enough cash';
  return null;
}

export function buyShares(s: GameState, kind: 'canal' | 'rail'): boolean {
  if (canBuyShares(s, kind)) return false;
  const def = kind === 'canal' ? CANAL : RAIL;
  s.cash -= def.lot;
  s.ledger.capital += def.lot;
  s.region[kind]++;
  return true;
}

// ------------------------------------------------------------------ totals

/** Money laid out beyond the home works. */
export function regionOutlay(s: GameState): number {
  let v = s.region.canal * CANAL.lot + s.region.rail * RAIL.lot;
  for (const m of s.region.mills) v += m.paid;
  for (const id of s.region.ventures) v += VENTURES.find((x) => x.id === id)!.cost;
  return v;
}

/** What it is all worth today: mills and ventures at seven tenths of cost, shares at par. */
export function regionValue(s: GameState): number {
  let v = s.region.canal * CANAL.lot + s.region.rail * RAIL.lot;
  for (const m of s.region.mills) v += m.paid * 0.7;
  for (const id of s.region.ventures) v += VENTURES.find((x) => x.id === id)!.cost * 0.7;
  return v;
}

/** Hands employed in your mills elsewhere. */
export function regionHands(s: GameState): number {
  return s.region.mills.reduce((n, m) => n + Math.round(TOWNS.find((t) => t.id === m.id)!.hands * (1 + 0.6 * m.enlarged)), 0);
}

/** Yearly income from everything outside the home works, at present rates. */
export function regionIncome(s: GameState): number {
  const y = yearFloat(s);
  let v = s.region.canal * CANAL.lot * canalDividend(y) + s.region.rail * RAIL.lot * railDividend(y);
  for (const m of s.region.mills) v += m.paid * millReturn(s, m);
  return v;
}

export function updateRegion(s: GameState, dt: number): void {
  const income = (regionIncome(s) * dt) / WEEKS_PER_YEAR;
  if (income === 0) return;
  s.cash += income;
  s.ledger.outside += income;
}
