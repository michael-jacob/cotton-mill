import type { Good } from './goods';
import { tradeIndex } from './region';
import { pushLog, rand, yearFloat, type GameState } from './state';
import { TECHS, TECH_IDS, type TechId } from './tech';

/** Difficulty, transport, export markets and rival manufacturers. */

// ------------------------------------------------------------- difficulty

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY: Record<Difficulty, { name: string; blurb: string; cash: number; price: number; pool: number; upkeep: number }> = {
  easy: { name: 'Good times', blurb: 'More money to begin, better prices, hands in plenty.', cash: 60, price: 1.07, pool: 1.25, upkeep: 0.7 },
  normal: { name: 'As it was', blurb: 'The trade as the record gives it.', cash: 25, price: 1, pool: 1, upkeep: 1 },
  hard: { name: 'Hard times', blurb: 'Little money, thin prices, scarce hands and costly repairs.', cash: 15, price: 0.94, pool: 0.85, upkeep: 1.3 },
};
export const diff = (s: GameState) => DIFFICULTY[s.difficulty];

// -------------------------------------------------------------- transport

export interface TransportDef {
  name: string;
  year: number;
  cost: number;
  /** carriage on cotton and coal bought, and the share of the price kept on goods sold */
  cotton: number;
  coal: number;
  sell: number;
  note: string;
}

export const TRANSPORT: TransportDef[] = [
  { name: 'Cart road', year: 1760, cost: 0, cotton: 1.06, coal: 1.5, sell: 0.975, note: 'Packhorses and carts over the turnpike. Carriage from Liverpool adds a good deal to every bag.' },
  { name: 'Canal branch', year: 1776, cost: 1800, cotton: 1.02, coal: 1.0, sell: 0.99, note: 'A cut to the works from the main line. One horse draws thirty tons.' },
  { name: 'Railway siding', year: 1831, cost: 4500, cotton: 1.0, coal: 0.85, sell: 1.0, note: 'Wagons to your own yard from the Liverpool and Manchester line.' },
];
export const transportOf = (s: GameState) => TRANSPORT[s.transport];

export function canBuildTransport(s: GameState): string | null {
  const next = TRANSPORT[s.transport + 1];
  if (!next) return 'Nothing better is to be had';
  if (yearFloat(s) < next.year) return `Not before ${next.year}`;
  if (!s.mills.mill.built) return 'Needs the mill';
  if (s.cash < next.cost) return 'Not enough cash';
  return null;
}

export function buildTransport(s: GameState): boolean {
  if (canBuildTransport(s)) return false;
  const next = TRANSPORT[s.transport + 1];
  s.cash -= next.cost;
  s.ledger.capital += next.cost;
  s.transport++;
  pushLog(s, `The ${next.name.toLowerCase()} is open to the works. Carriage costs fall.`);
  return true;
}

// ---------------------------------------------------------------- exports

export interface ExportDef {
  id: string;
  name: string;
  from: number;
  /** how much it adds to the depth of the home market when open and served by an agent */
  share: number;
  /** yearly cost of keeping an agent there */
  agent: number;
  closed: [number, number][];
  note: string;
}

export const EXPORTS: ExportDef[] = [
  { id: 'europe', name: 'The Continent', from: 1760, share: 0.5, agent: 60, closed: [[1793.1, 1795], [1806.9, 1813.5]], note: 'Hamburg, the fairs of Leipzig and Frankfurt, Italy. Shut by the French wars and the Continental System.' },
  { id: 'america', name: 'America', from: 1760, share: 0.45, agent: 80, closed: [[1775.3, 1783.7], [1808, 1809.3], [1812.5, 1815]], note: 'The largest single customer, in peace.' },
  { id: 'levant', name: 'The Levant', from: 1790, share: 0.25, agent: 90, closed: [[1798.5, 1801.5]], note: 'Smyrna and Constantinople take printed goods and twist.' },
  { id: 'india', name: 'India and the East', from: 1813.5, share: 0.9, agent: 150, closed: [], note: "Open to private traders once the East India Company's monopoly ends in 1813. Lancashire calico undersells the Indian weaver in his own bazaar." },
];

export function exportOpen(def: ExportDef, y: number): boolean {
  return y >= def.from && !def.closed.some(([a, b]) => y >= a && y < b);
}

export function setAgent(s: GameState, id: string, on: boolean): void {
  const has = s.agents.includes(id);
  if (on && !has) s.agents.push(id);
  if (!on && has) s.agents.splice(s.agents.indexOf(id), 1);
}

/** Extra depth of market from agents in export markets that are open (0 = home trade only). */
export function exportBonus(s: GameState): number {
  const y = yearFloat(s);
  let b = 0;
  for (const def of EXPORTS) if (s.agents.includes(def.id) && exportOpen(def, y)) b += def.share;
  return b;
}

/** Yearly cost of agents abroad. They draw their salaries whether or not the market is open. */
export function agentsCost(s: GameState): number {
  return EXPORTS.reduce((t, def) => t + (s.agents.includes(def.id) ? def.agent : 0), 0);
}

// ----------------------------------------------------------------- rivals

export interface RivalDef {
  id: string;
  name: string;
  style: string;
  from: number;
  /** years after an invention appears before they take it up */
  lag: number;
  /** yearly growth of the concern in ordinary trade */
  growth: number;
  /** wages they pay, as a multiple of the going rate */
  offer: number;
  /** chance of failing in each week of a slump */
  frailty: number;
}

export const RIVALS: RivalDef[] = [
  { id: 'ashworth', name: 'Ashworth & Sons', style: 'Cautious: slow to take up new machinery, and seldom in debt', from: 1760, lag: 9, growth: 0.068, offer: 0.95, frailty: 0.0002 },
  { id: 'entwistle', name: 'Entwistle Brothers', style: 'Pushing: first with every invention, and borrowed to the hilt', from: 1768, lag: 2, growth: 0.1, offer: 1.08, frailty: 0.0025 },
  { id: 'kershaw', name: 'J. & N. Kershaw', style: 'Steady: good machinery, good wages, good cloth', from: 1785, lag: 5, growth: 0.085, offer: 1.02, frailty: 0.0007 },
];

export interface RivalState {
  id: string;
  worth: number;
  alive: boolean;
}

export function rivalTechs(def: RivalDef, y: number): TechId[] {
  return TECH_IDS.filter((t) => TECHS[t].year + def.lag <= y);
}

export function activeRivals(s: GameState): { def: RivalDef; st: RivalState }[] {
  const y = yearFloat(s);
  return RIVALS.filter((d) => y >= d.from)
    .map((def) => ({ def, st: s.rivals.find((r) => r.id === def.id)! }))
    .filter((r) => r.st?.alive);
}

export function updateRivals(s: GameState, dt: number): void {
  const y = yearFloat(s);
  const trade = tradeIndex(y);
  for (const def of RIVALS) {
    if (y < def.from) continue;
    let st = s.rivals.find((r) => r.id === def.id);
    if (!st) {
      st = { id: def.id, worth: 250 * Math.exp(0.05 * (def.from - 1760)), alive: true };
      s.rivals.push(st);
    }
    if (!st.alive) continue;
    // they grow in good trade and shrink twice as fast in bad
    st.worth *= Math.exp(((trade >= 0 ? def.growth * trade : 2 * def.growth * trade) * dt) / 52);
  }
}

/** Once a week: in a slump, an over-extended rival may stop payment. */
export function rivalFailures(s: GameState): void {
  if (tradeIndex(yearFloat(s)) >= 0) return;
  for (const { def, st } of activeRivals(s)) {
    if (rand(s) < def.frailty) {
      st.alive = false;
      pushLog(s, `${def.name} have stopped payment. Their mills are to be sold and their hands are looking for work.`);
    }
  }
}

/** Goods in which a rival with newer machinery can undersell you. */
const EDGE: Partial<Record<Good, TechId[]>> = {
  weft: ['jenny', 'selfActor'],
  warp: ['waterFrame', 'throstle'],
  fineYarn: ['mule', 'selfActor'],
  calico: ['powerLoom', 'lancashireLoom'],
  muslin: ['mule'],
  white: ['bleaching'],
  print: ['printing'],
};

/** Price factor from rivals who have machinery you lack: 4% off for each such rival. */
export function undercut(s: GameState, g: Good): number {
  const techs = EDGE[g];
  if (!techs) return 1;
  const y = yearFloat(s);
  let n = 0;
  for (const { def } of activeRivals(s)) {
    const theirs = rivalTechs(def, y);
    if (techs.some((t) => theirs.includes(t) && !s.tech.includes(t))) n++;
  }
  return 1 - 0.04 * n;
}

/** Share of the district's hands left to you by rivals who outbid you. */
export function poaching(s: GameState): number {
  let f = 1;
  for (const { def } of activeRivals(s)) if (def.offer > s.labour.offer + 1e-9) f -= 0.07;
  return f;
}
