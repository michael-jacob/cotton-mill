import { EVENTS } from './events';
import { GOOD_IDS, GOODS, type Good } from './goods';
import { assetBase } from './actions';
import { updateGoals } from './goals';
import { factoryActFactor, riot, updateLabour, wageLevel } from './labour';
import { insurancePremium, weeklyHazards } from './hazards';
import { CALICO_LEGAL_YEAR, GRADES, MACHINES, siteMill, type Recipe } from './machines';
import { updatePolitics } from './politics';
import { checkScenario } from './scenarios';
import { agentsCost, diff, rivalFailures, updateRivals } from './trade';
import { buyPrice, depthFor, sellPrice, updateMarket } from './market';
import { updateRegion } from './region';
import { updatePower } from './power';
import {
  END_YEAR,
  WEEKS_PER_YEAR,
  emptyLedger,
  ledgerProfit,
  pushLog,
  yearFloat,
  yearOf,
  type GameState,
} from './state';

export const LOAN_RATE = 0.05;
export const OVERDRAFT_RATE = 0.15;
/** Merchants will supply materials on account up to this sum. */
export const TRADE_CREDIT = 20;
/** Hands will work unpaid until the overdraft passes this sum. */
export const WAGE_CREDIT = 30;

const EPS = 1e-9;

function fireEvents(s: GameState): void {
  const y = yearFloat(s);
  for (const e of EVENTS) {
    if (y >= e.at && !s.fired.includes(e.id)) {
      s.fired.push(e.id);
      pushLog(s, e.text);
      if (e.riot) riot(s, e.riot);
    }
  }
}

/** How fully a recipe could run this tick on the stock in hand (0..1). */
function feasible(s: GameState, r: Recipe, dt: number): number {
  let f = 1;
  for (const g in r.in) f = Math.min(f, s.stock[g as Good] / (r.in[g as Good]! * dt));
  return Math.max(0, f);
}

/**
 * The recipe the player ordered if there is one; otherwise whichever can run
 * most fully on the stock in hand, earlier recipes winning ties.
 */
function pickRecipe(s: GameState, recipes: Recipe[], calicoLegal: boolean, dt: number, pref?: string | null): Recipe | null {
  const allowed = recipes.filter((r) => !r.needsCalicoLegal || calicoLegal);
  const ordered = pref ? allowed.find((r) => r.label === pref) : undefined;
  if (ordered) return feasible(s, ordered, dt) > EPS ? ordered : null;
  let best: Recipe | null = null;
  let bestF = EPS;
  for (const r of allowed) {
    const f = Math.min(1, feasible(s, r, dt));
    if (f > bestF + 1e-6) {
      best = r;
      bestF = f;
    }
  }
  return best;
}

/**
 * Hands are paid largely by the piece: a quarter of the wage is a retainer
 * paid whenever the machine is manned, the rest follows the work done.
 */
export const RETAINER = 0.25;
function payWages(s: GameState, fullWage: number, run: number, dt: number): void {
  const wages = fullWage * (RETAINER + (1 - RETAINER) * run) * dt;
  s.cash -= wages;
  s.ledger.wages += wages;
}

function produce(s: GameState, dt: number): void {
  const calicoLegal = yearFloat(s) >= CALICO_LEGAL_YEAR;
  const broke = s.cash < -WAGE_CREDIT;
  if (broke && !s.broke) pushLog(s, 'There is no money for wages and the hands have stopped work. Borrow against the business or sell stock.');
  s.broke = broke;
  const level = wageLevel(s);
  const act = factoryActFactor(yearFloat(s), s);
  const staffing = s.labour.staffing;
  const order = [...s.machines].sort((a, b) => MACHINES[a.type].stage - MACHINES[b.type].stage);
  for (const m of order) {
    const def = MACHINES[m.type];
    if (!m.on) {
      m.run = 0;
      m.status = 'off';
      m.missing = null;
      continue;
    }
    if (broke || s.labour.strike > 0) {
      m.run = 0;
      m.status = broke ? 'unpaid' : 'strike';
      m.missing = null;
      continue;
    }
    const wage = def.workers * def.wage * level * (def.power > 0 ? act : 1);
    if (m.down && m.down > 0) {
      // broken down: the mechanics are at it, and the hands stand about on their retainer
      m.down = Math.max(0, m.down - dt);
      m.run = 0;
      m.status = 'repair';
      m.missing = null;
      payWages(s, wage, 0, dt);
      continue;
    }
    const millId = siteMill(m.site);
    const pf = def.power > 0 ? (millId ? s.power[millId].factor : 0) : 1;
    const recipe = pickRecipe(s, def.recipes, calicoLegal, dt, m.pref);
    if (!recipe) {
      // Report the missing input of the ordered recipe, or else the last (fallback) one.
      const fallback = def.recipes.find((r) => r.label === m.pref) ?? def.recipes[def.recipes.length - 1];
      m.missing = (Object.keys(fallback.in) as Good[]).find((g) => s.stock[g] <= EPS) ?? null;
      m.run = 0;
      m.status = 'starved';
      m.doing = fallback.label;
      payWages(s, wage, 0, dt);
      continue;
    }
    // a machine can go no faster than its shaft turns or its hands can tend it
    const cap = pf * staffing;
    let scale = cap;
    let missing: Good | null = null;
    // spinning coarse counts turns out more pounds of poorer yarn, fine counts fewer of better
    const grade = def.grades ? GRADES[def.grades.includes(m.grade ?? 1) ? (m.grade ?? 1) : def.grades[0]] : null;
    const rate = grade ? grade.rate : 1;
    let inQ = 0;
    let inN = 0;
    for (const g in recipe.in) {
      inQ += s.quality[g as Good] ?? 1;
      inN++;
      const need = recipe.in[g as Good]! * dt * rate;
      const can = s.stock[g as Good] / need;
      if (can < scale) {
        scale = can;
        missing = g as Good;
      }
    }
    for (const g in recipe.in) s.stock[g as Good] -= recipe.in[g as Good]! * dt * scale * rate;
    // what comes out is as good as what went in, times what the spinner makes of it
    const outQ = Math.max(0.7, Math.min(1.5, (grade ? grade.quality : 1) * (def.stage >= 4 ? inQ / Math.max(1, inN) : 1)));
    let first = true;
    for (const g in recipe.out) {
      const q = recipe.out[g as Good]! * dt * scale * rate;
      const had = Math.max(0, s.stock[g as Good]);
      if (had + q > 0) s.quality[g as Good] = (had * (s.quality[g as Good] ?? 1) + q * outQ) / (had + q);
      s.stock[g as Good] += q;
      if (first) m.total += q;
      first = false;
      if (g === 'fustian' || g === 'calico' || g === 'muslin') {
        s.stats.cloth += q;
        if (g === 'calico') s.stats.calico += q;
        if (g === 'muslin') s.stats.muslin += q;
      } else if (g === 'weft' || g === 'warp' || g === 'fineYarn') {
        s.stats.yarn += q;
        if (g === 'warp') s.stats.twist += q;
      } else if (g === 'print') s.stats.prints += q;
    }
    payWages(s, wage, scale, dt);
    m.run = scale;
    m.doing = recipe.label;
    m.missing = missing;
    m.status = missing ? 'short' : pf < 0.98 ? 'underpowered' : staffing < 0.98 ? 'understaffed' : 'running';
  }
}

/** Sell q units at the market, depressing the price. Returns the proceeds. */
export function sellGoods(s: GameState, g: Good, q: number): number {
  q = Math.min(q, s.stock[g]);
  if (q <= 0 || !GOODS[g].sell) return 0;
  const proceeds = q * sellPrice(s, g);
  s.stock[g] -= q;
  s.cash += proceeds;
  s.ledger.sales += proceeds;
  s.glut[g] += q / depthFor(s, g);
  return proceeds;
}

/** Buy up to q units, limited by cash in hand. Returns the quantity bought. */
export function buyGoods(s: GameState, g: Good, q: number): number {
  const funds = s.cash + TRADE_CREDIT;
  if (q <= 0 || !GOODS[g].buy || funds <= 0) return 0;
  const price = buyPrice(s, g);
  q = Math.min(q, funds / price);
  const cost = q * price;
  // bought goods are of middling quality
  const had = Math.max(0, s.stock[g]);
  if (had + q > 0) s.quality[g] = (had * (s.quality[g] ?? 1) + q) / (had + q);
  s.stock[g] += q;
  s.cash -= cost;
  s.ledger.materials += cost;
  return q;
}

function autoTrade(s: GameState): void {
  for (const g of GOOD_IDS) {
    const p = s.policy[g];
    if (p.mode === 'buy' && s.stock[g] < p.level) buyGoods(s, g, p.level - s.stock[g]);
    else if (p.mode === 'sell' && s.stock[g] > p.level + 0.01) sellGoods(s, g, s.stock[g] - p.level);
  }
}

/** Yearly cost of repairs as a fraction of what the plant cost. */
export const UPKEEP_MACHINES = 0.05;
export const UPKEEP_BUILDINGS = 0.03;

/** Straps, card clothing, bearings, roofs: plant wears whether trade is good or bad. */
function upkeep(s: GameState, dt: number): void {
  let machines = 0;
  for (const m of s.machines) machines += MACHINES[m.type].cost;
  // repairs, the insurance premium, and the salaries of agents abroad
  const due = (((machines * UPKEEP_MACHINES + assetBase(s) * UPKEEP_BUILDINGS) * diff(s).upkeep + insurancePremium(s) + agentsCost(s)) * dt) / WEEKS_PER_YEAR;
  s.cash -= due;
  s.ledger.upkeep += due;
}

function interest(s: GameState, dt: number): void {
  let due = (s.loan * LOAN_RATE * dt) / WEEKS_PER_YEAR;
  // Creditors charge on an overdraft, but stop adding to it once the concern has stopped work.
  if (s.cash < 0 && !s.broke) due += (-s.cash * OVERDRAFT_RATE * dt) / WEEKS_PER_YEAR;
  if (due > 0) {
    s.cash -= due;
    s.ledger.interest += due;
  }
}

function closeYear(s: GameState, year: number): void {
  const profit = ledgerProfit(s.ledger);
  s.history.push(s.ledger);
  s.ledger = emptyLedger(year + 1);
  pushLog(
    s,
    `Accounts for ${year}: trading ${profit >= 0 ? 'profit' : 'loss'} of £${Math.abs(profit).toFixed(0)}.`,
  );
  if (year + 1 >= END_YEAR && !s.ended) {
    s.ended = true;
    pushLog(s, 'It is 1850. Half the cotton cloth in the world is made within thirty miles of Manchester.');
  }
}

/** Advance the simulation by dt weeks. Keep dt small (a fraction of a week). */
export function step(s: GameState, dt: number): void {
  const y0 = yearOf(s.week);
  s.week += dt;
  fireEvents(s);
  updateMarket(s, dt);
  updatePower(s, dt);
  updateLabour(s, dt);
  produce(s, dt);
  upkeep(s, dt);
  updateRegion(s, dt);
  autoTrade(s);
  interest(s, dt);
  updateRivals(s, dt);
  if (Math.floor(s.week) !== Math.floor(s.week - dt)) {
    // once a week
    updateGoals(s);
    weeklyHazards(s);
    rivalFailures(s);
    updatePolitics(s);
    checkScenario(s);
  }
  const y1 = yearOf(s.week);
  if (y1 !== y0) closeYear(s, y0);
}

/** Prime prices and power so the first frame has sensible numbers. */
export function prime(s: GameState): void {
  updateMarket(s, 0);
  updatePower(s);
  updateLabour(s, 0);
  fireEvents(s);
}
