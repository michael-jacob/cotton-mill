import { MACHINES } from './machines';
import { pushLog, rand, yearFloat, type GameState } from './state';
import { diff, poaching } from './trade';

/** Hands lodged by one row of cottages. */
export const HOUSE_HANDS = 25;
export const HOUSING_COST = 300;
export const OFFER_MIN = 0.7;
export const OFFER_MAX = 1.5;

/** Hands to be had in the district at the going rate, growing with the town (approx. 2.6% a year). */
export function basePool(y: number): number {
  return 30 * Math.exp(0.026 * (y - 1760));
}

/** Hands who will come to work for you: more if you pay over the going rate, plus those you house. */
export function handsAvailable(s: GameState): number {
  const draw = Math.max(0.4, Math.min(1.7, s.labour.offer * s.labour.offer));
  // a good name draws hands; rivals who outbid you take some; hard times thin the district
  const name = 1 + (s.standing - 20) / 400;
  return Math.floor(basePool(yearFloat(s)) * draw * poaching(s) * diff(s).pool * name + s.labour.housing * HOUSE_HANDS);
}

/**
 * The Factory Acts shorten children's hours, so mills must take on more and
 * older hands for the same work: a rise in the wage bill of powered machines.
 */
export function factoryActFactor(y: number, s?: GameState): number {
  // a master who evades an Act does not bear its cost
  const a33 = y >= 1833.6 && !s?.evade.includes('act33') ? 0.08 : 0;
  const a47 = y >= 1847.4 && !s?.evade.includes('tenhours') ? 0.06 : 0;
  return 1 + a33 + a47;
}

/** What a hand costs relative to the 1760 wage in the machine tables. */
export function wageLevel(s: GameState): number {
  return s.labour.going * s.labour.offer;
}

export function updateLabour(s: GameState, dt: number): void {
  const l = s.labour;
  let needed = 0;
  for (const m of s.machines) if (m.on) needed += MACHINES[m.type].workers;
  l.needed = needed;
  l.available = handsAvailable(s);
  l.staffing = needed > l.available ? l.available / needed : 1;
  const tight = needed / Math.max(1, l.available);

  // The going rate creeps up while hands are scarce and eases when they are plentiful.
  const drift = Math.max(-0.008, Math.min(0.02, 0.05 * (tight - 0.75)));
  l.going = Math.max(0.85, Math.min(1.6, l.going + (drift * dt) / 52));

  // Morale follows pay above all; decent housing helps; being driven short-handed hurts.
  const housed = Math.min(1, (l.housing * HOUSE_HANDS) / Math.max(1, needed));
  const target = Math.max(0, Math.min(100, 55 + 100 * (l.offer - 1) + 15 * housed - (tight > 1 ? 10 : 0)));
  l.morale += (target - l.morale) * (1 - Math.exp(-dt / 8));

  if (l.strike > 0) {
    l.strike = Math.max(0, l.strike - dt);
    if (l.strike === 0) {
      l.morale = Math.max(l.morale, 42);
      pushLog(s, 'The hands come back to work, sullen and hungry.');
    }
  } else if (l.morale < 30 && needed >= 8) {
    // The lower the morale, the sooner a turn-out.
    if (rand(s) < (30 - l.morale) * 0.008 * dt) {
      l.strike = 3 + Math.floor(rand(s) * 4);
      s.stats.strikes++;
      s.standing = Math.max(0, s.standing - 4);
      pushLog(s, `Your hands have turned out for better wages. The works stand idle; they may hold out ${Math.round(l.strike)} weeks unless you give way.`);
    }
  }
  s.stats.peakHands = Math.max(s.stats.peakHands, Math.round(needed * l.staffing));
}

/** Machine breakers: when a riot comes and your hands are bitter, some of the newest machinery is wrecked. */
export function riot(s: GameState, targets: string[]): void {
  if (s.labour.morale >= 50) return;
  const n = Math.ceil((50 - s.labour.morale) / 12);
  const victims = s.machines.filter((m) => targets.includes(m.type)).slice(-n);
  if (!victims.length) return;
  for (const v of victims) s.machines.splice(s.machines.indexOf(v), 1);
  s.stats.broken += victims.length;
  pushLog(s, `A crowd breaks into your works and smashes ${victims.length === 1 ? 'a machine' : victims.length + ' machines'}. Better-paid hands might have stood by you.`);
}
