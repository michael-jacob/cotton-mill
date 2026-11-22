import { assetBase, millWidth } from './actions';
import { MACHINES, MILLS, MILL_IDS, siteFloor, siteMill, type MillId } from './machines';
import { pushLog, rand, type GameState } from './state';

/** Breakdowns, fire and insurance. */

export const INSURANCE_RATE = 0.012;
export const INSURANCE_COVER = 0.8;
export const FIRE_ENGINE_COST = 120;
export const FIREPROOF_COST = 700;

/** What a fire could destroy: machinery standing in the mills, and the buildings. */
export function insuredValue(s: GameState): number {
  let v = assetBase(s);
  for (const m of s.machines) if (siteMill(m.site)) v += MACHINES[m.type].cost;
  return v;
}

export function insurancePremium(s: GameState): number {
  return s.insured ? insuredValue(s) * INSURANCE_RATE : 0;
}

export function fireproofCost(s: GameState, id: MillId): number {
  return Math.round((FIREPROOF_COST * millWidth(s, id) * s.mills[id].floors) / 20 / 50) * 50;
}

export function canFireproof(s: GameState, id: MillId): string | null {
  if (!s.mills[id].built) return 'Needs the mill';
  if (s.mills[id].fireproof) return 'Already done';
  if (!s.tech.includes('ironFrame')) return 'Needs: Iron-framed building';
  if (s.cash < fireproofCost(s, id)) return 'Not enough cash';
  return null;
}

/** Rebuild a mill's floors on iron columns and beams with brick arches. */
export function fireproof(s: GameState, id: MillId): boolean {
  if (canFireproof(s, id)) return false;
  const cost = fireproofCost(s, id);
  s.cash -= cost;
  s.ledger.capital += cost;
  s.mills[id].fireproof = true;
  pushLog(s, `The ${MILLS[id].name} is rebuilt on iron columns and beams, with brick arches in place of timber floors.`);
  return true;
}

export function canBuyFireEngine(s: GameState): string | null {
  if (s.fireEngine) return 'Already yours';
  if (!s.mills.mill.built) return 'Needs the mill';
  if (s.cash < FIRE_ENGINE_COST) return 'Not enough cash';
  return null;
}

export function buyFireEngine(s: GameState): boolean {
  if (canBuyFireEngine(s)) return false;
  s.cash -= FIRE_ENGINE_COST;
  s.ledger.capital += FIRE_ENGINE_COST;
  s.fireEngine = true;
  return true;
}

/** Weekly chance of fire in a mill: cotton fly, oil-soaked timber and naked lights. */
export function fireRisk(s: GameState, id: MillId): number {
  if (!s.mills[id].built) return 0;
  const n = s.machines.filter((m) => siteMill(m.site) === id).length;
  return 0.0007 * (1 + n / 40) * (s.mills[id].fireproof ? 0.2 : 1);
}

export function fire(s: GameState, id: MillId): void {
  const floor = Math.floor(rand(s) * s.mills[id].floors);
  const there = s.machines.filter((m) => siteMill(m.site) === id && siteFloor(m.site) === floor);
  // a fireproof mill confines the fire; a fire engine saves much of what is left
  const share = (s.mills[id].fireproof ? 0.35 : 0.75) * (s.fireEngine ? 0.5 : 1);
  const lost = there.slice(0, Math.ceil(there.length * share));
  let loss = MILLS[id].cost * 0.05;
  for (const m of lost) {
    loss += MACHINES[m.type].cost;
    s.machines.splice(s.machines.indexOf(m), 1);
  }
  s.cash -= MILLS[id].cost * 0.05; // making good the building
  s.ledger.upkeep += MILLS[id].cost * 0.05;
  s.stats.fires++;
  s.lastFire = { week: s.week, mill: id, floor };
  const where = ['ground floor', 'first floor', 'second floor'][floor];
  let text = `Fire at the ${MILLS[id].name}! It takes hold on the ${where}: ${lost.length} machine${lost.length === 1 ? '' : 's'} destroyed, a loss of about £${Math.round(loss)}.`;
  if (s.insured) {
    const paid = loss * INSURANCE_COVER;
    s.cash += paid;
    s.ledger.capital -= paid;
    text += ` The insurance office pays £${Math.round(paid)}.`;
  } else text += ' Nothing was insured.';
  pushLog(s, text);
}

/** Once a week: something may break down, and a mill may take fire. */
export function weeklyHazards(s: GameState): void {
  if (!s.hazards) return;
  const working = s.machines.filter((m) => m.on && !(m.down && m.down > 0));
  if (working.length && rand(s) < Math.min(0.4, 0.01 * Math.sqrt(working.length))) {
    const m = working[Math.floor(rand(s) * working.length)];
    m.down = 1 + Math.floor(rand(s) * 3);
    const cost = MACHINES[m.type].cost * 0.1;
    s.cash -= cost;
    s.ledger.upkeep += cost;
  }
  for (const id of MILL_IDS) {
    const p = fireRisk(s, id);
    if (p > 0 && rand(s) < p) fire(s, id);
  }
}
