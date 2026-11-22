import { COAL_IDLE, COAL_PER_HP_WEEK, ENGINE2_HP, MACHINES, MILLS, MILL_IDS, WHEEL_HP, siteMill, type MillId } from './machines';
import type { GameState } from './state';
import { WEEKS_PER_YEAR } from './state';

/** River flow through the year: full in winter, slack in late summer. */
export function riverFlow(week: number): number {
  const phase = ((week % WEEKS_PER_YEAR) / WEEKS_PER_YEAR) * Math.PI * 2;
  return 0.85 + 0.2 * Math.cos(phase);
}

/** Rated horsepower of a mill's engines. */
export function enginePower(s: GameState, id: MillId): number {
  const m = s.mills[id];
  return (m.engine ? MILLS[id].engineHp : 0) + (m.engine2 ? ENGINE2_HP : 0);
}

/**
 * Each mill has its own shafting. A wheel delivers a fixed power for a given
 * flow, and an engine a fixed power while it has coal. If the machines on a
 * mill's shafts ask for more, all its shafts slow in proportion. The wheel's
 * power is free, so the engine only carries what the wheel cannot, and burns
 * coal accordingly.
 */
export function updatePower(s: GameState, dt = 0): void {
  const flow = riverFlow(s.week);
  const fired = s.stock.coal > 0 && !s.broke;
  // first pass: what each mill wants, and the coal its engine would burn at that load
  const plan: { id: MillId; water: number; steam: number; demand: number; burn: number }[] = [];
  for (const id of MILL_IDS) {
    const mill = s.mills[id];
    const p = s.power[id];
    p.flow = flow;
    p.engineLoad = 0;
    if (!mill.built) {
      p.available = 0;
      p.demand = 0;
      p.factor = 0;
      continue;
    }
    const water = MILLS[id].wheel ? WHEEL_HP * flow : 0;
    const steam = fired ? enginePower(s, id) : 0;
    let demand = 0;
    for (const m of s.machines) {
      if (m.on && siteMill(m.site) === id) demand += MACHINES[m.type].power;
    }
    const load = Math.min(steam, Math.max(0, demand - water));
    const burn = steam > 0 ? COAL_PER_HP_WEEK * (COAL_IDLE * steam + (1 - COAL_IDLE) * load) * dt : 0;
    plan.push({ id, water, steam, demand, burn });
  }
  // If the coal in the yard will not cover this tick's burning, every engine is short in proportion:
  // a shovelful cannot raise steam for a whole mill.
  const wanted = plan.reduce((t, x) => t + x.burn, 0);
  const share = wanted > 0 ? Math.min(1, s.stock.coal / wanted) : 1;
  for (const x of plan) {
    const p = s.power[x.id];
    const steam = x.steam * share;
    p.available = x.water + steam;
    p.demand = x.demand;
    p.factor = p.available <= 0 ? 0 : x.demand > p.available ? p.available / x.demand : 1;
    p.engineLoad = Math.min(steam, Math.max(0, x.demand - x.water));
  }
  s.stock.coal = Math.max(0, s.stock.coal - wanted * share);
}
