import { GOOD_IDS, type Good } from './goods';
import type { GameState } from './state';
import { rand, yearFloat } from './state';
import { diff, exportBonus, transportOf, undercut } from './trade';

/** Base prices in pounds per unit, linearly interpolated by year (approx.). */
const BASE: Record<Good, [number, number][]> = {
  cotton: [[1760, 0.065], [1790, 0.06], [1800, 0.07], [1815, 0.06], [1830, 0.035], [1850, 0.027]],
  linenWarp: [[1760, 0.1], [1830, 0.09]],
  lap: [[1760, 0.07], [1830, 0.04], [1850, 0.03]],
  sliver: [[1760, 0.08], [1790, 0.07], [1830, 0.04], [1850, 0.035]],
  roving: [[1760, 0.095], [1790, 0.08], [1830, 0.045], [1850, 0.038]],
  weft: [[1760, 0.15], [1775, 0.135], [1790, 0.1], [1810, 0.08], [1830, 0.06], [1850, 0.048]],
  warp: [[1760, 0.26], [1769, 0.25], [1780, 0.2], [1790, 0.13], [1810, 0.095], [1830, 0.07], [1850, 0.055]],
  fineYarn: [[1760, 0.7], [1779, 0.6], [1790, 0.4], [1810, 0.22], [1830, 0.14], [1850, 0.1]],
  fustian: [[1760, 1.95], [1790, 1.6], [1830, 1.1], [1850, 0.9]],
  calico: [[1760, 2.5], [1774, 2.4], [1790, 1.75], [1810, 1.2], [1830, 0.85], [1850, 0.7]],
  // dressed warp, bleached and printed calico are priced from twist and grey calico below
  dressed: [[1760, 1]],
  white: [[1760, 1]],
  print: [[1760, 1]],
  muslin: [[1760, 4.5], [1779, 4.2], [1790, 3.4], [1810, 2.0], [1830, 1.3], [1850, 0.95]],
  coal: [[1760, 0.02], [1830, 0.018]],
};

/** How much the market absorbs before the price sags, in units, as of 1760. */
const DEPTH: Record<Good, number> = {
  cotton: 4000,
  linenWarp: 1500,
  lap: 300,
  sliver: 300,
  roving: 300,
  weft: 350,
  warp: 500,
  fineYarn: 250,
  fustian: 60,
  calico: 80,
  muslin: 40,
  dressed: 300,
  white: 60,
  print: 55,
  coal: 100000,
};

const MAX_SAG = 0.25;
const GLUT_DECAY_WEEKS = 5;

function interp(table: [number, number][], y: number): number {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (y <= table[i][0]) {
      const [y0, v0] = table[i - 1];
      const [y1, v1] = table[i];
      return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

export function basePrice(good: Good, y: number): number {
  if (good === 'dressed') return basePrice('warp', y) * 1.12;
  if (good === 'white') return basePrice('calico', y) * 1.22;
  if (good === 'print') return basePrice('calico', y) * 1.8;
  let p = interp(BASE[good], y);
  const cloth = good === 'calico' || good === 'fustian' || good === 'muslin';
  // The American war (1775 to 1783) makes raw cotton dear.
  if (good === 'cotton' && y >= 1775.3 && y < 1783.7) p *= 1.3;
  // Export demand picks up after the peace.
  if (cloth && y >= 1783.7) p *= 1.05;
  // War with France closes continental markets for a time.
  if (cloth && y >= 1793.1 && y < 1795) p *= 0.9;
  // The American war of 1812 cuts off upland cotton.
  if (good === 'cotton' && y >= 1812.5 && y < 1815) p *= 1.4;
  // The crash of 1825 and the slump that followed.
  if (cloth && y >= 1826 && y < 1827.5) p *= 0.85;
  // The long depression of 1837 to 1842.
  if (cloth && y >= 1837.3 && y < 1838.5) p *= 0.88;
  if (cloth && y >= 1841 && y < 1842.8) p *= 0.86;
  return p;
}

export function marketDepth(good: Good, y: number): number {
  // The trade grew something like a hundredfold over these ninety years.
  return DEPTH[good] * Math.exp(0.052 * Math.max(0, y - 1760));
}

export function updateMarket(s: GameState, dt: number): void {
  const y = yearFloat(s);
  const decay = Math.exp(-dt / GLUT_DECAY_WEEKS);
  for (const g of GOOD_IDS) {
    s.glut[g] *= decay;
    // A slow mean-reverting wobble of a few per cent.
    s.noise[g] += (rand(s) - 0.5) * 0.03 * Math.sqrt(dt) - s.noise[g] * 0.04 * dt;
    s.noise[g] = Math.max(-0.12, Math.min(0.12, s.noise[g]));
    s.prices[g] = basePrice(g, y) * (1 + s.noise[g]) * (1 - MAX_SAG * Math.tanh(s.glut[g]));
  }
}

/** Price paid when buying. Intermediate goods carry a merchant's premium. */
const CLOTH: Good[] = ['fustian', 'calico', 'muslin', 'white', 'print'];

export function buyPrice(s: GameState, g: Good): number {
  const premium = g === 'cotton' || g === 'linenWarp' ? 1 : 1.1;
  // your own warehouse on the Liverpool quay, your own pit
  const own = g === 'cotton' && s.region.ventures.includes('warehouse') ? 0.93 : g === 'coal' && s.region.ventures.includes('colliery') ? 0.6 : 1;
  const t = transportOf(s);
  const carriage = g === 'cotton' || g === 'linenWarp' ? t.cotton : g === 'coal' ? t.coal : 1;
  return s.prices[g] * premium * own * carriage;
}

export function sellPrice(s: GameState, g: Good): number {
  // bleached and printed goods fetch more than grey cloth
  // good goods fetch more; rivals with better machinery undersell you; carriage comes off the price
  const quality = Math.max(0.8, Math.min(1.4, s.quality[g] ?? 1));
  return s.prices[g] * (CLOTH.includes(g) && s.region.ventures.includes('bleach') ? 1.06 : 1) * quality * undercut(s, g) * diff(s).price * transportOf(s).sell;
}

/** Market depth as you find it: a merchant house of your own reaches further afield. */
export function depthFor(s: GameState, g: Good): number {
  if (g === 'cotton' || g === 'coal') return marketDepth(g, yearFloat(s));
  return marketDepth(g, yearFloat(s)) * (s.region.ventures.includes('merchant') ? 1.5 : 1) * (1 + exportBonus(s));
}
