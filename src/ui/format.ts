import type { GameState } from '../sim/state';

/** Pounds, shillings and pence for small sums; whole pounds for large ones. */
export function money(v: number): string {
  const neg = v < 0;
  const a = Math.abs(v);
  let out: string;
  if (a >= 20) {
    out = '£' + Math.round(a).toLocaleString('en-GB');
  } else {
    let pence = Math.round(a * 240);
    const pounds = Math.floor(pence / 240);
    pence -= pounds * 240;
    const sh = Math.floor(pence / 12);
    const d = pence - sh * 12;
    const parts: string[] = [];
    if (pounds) parts.push(`£${pounds}`);
    if (sh) parts.push(`${sh}s`);
    if (d && !pounds) parts.push(`${d}d`);
    out = parts.length ? parts.join(' ') : '0';
  }
  return neg ? '-' + out : out;
}

export function qty(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString('en-GB');
  if (v >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function dateOf(week: number): string {
  const year = 1760 + Math.floor(week / 52);
  const month = Math.min(11, Math.floor(((week % 52) / 52) * 12));
  return `${MONTHS[month]} ${year}`;
}

export function dateLabel(s: GameState): string {
  return dateOf(s.week);
}
