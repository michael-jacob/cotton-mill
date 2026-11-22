import { netWorth } from './actions';
import { deserialize, serialize, type GameState } from './state';

/** Named save slots in the browser's local storage. "auto" is written at each year end. */
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_NAMES: Record<Slot, string> = { auto: 'Autosave', slot1: 'Book I', slot2: 'Book II', slot3: 'Book III' };

const key = (slot: Slot) => `cottonmill.v4.${slot}`;

export interface SaveInfo {
  slot: Slot;
  week: number;
  worth: number;
  hands: number;
  savedAt: number;
}

interface Stored {
  info: Omit<SaveInfo, 'slot'>;
  state: string;
}

function read(slot: Slot): Stored | null {
  try {
    const raw = localStorage.getItem(key(slot));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function saveSlot(slot: Slot, s: GameState): boolean {
  try {
    const stored: Stored = {
      info: { week: s.week, worth: netWorth(s), hands: Math.round(s.labour.needed * s.labour.staffing), savedAt: Date.now() },
      state: serialize(s),
    };
    localStorage.setItem(key(slot), JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function loadSlot(slot: Slot): GameState | null {
  const stored = read(slot);
  return stored ? deserialize(stored.state) : null;
}

export function deleteSlot(slot: Slot): void {
  try {
    localStorage.removeItem(key(slot));
  } catch {
    /* storage unavailable */
  }
}

export function listSaves(): SaveInfo[] {
  const out: SaveInfo[] = [];
  for (const slot of SLOTS) {
    const stored = read(slot);
    if (stored && deserialize(stored.state)) out.push({ slot, ...stored.info });
  }
  return out;
}

/** The most recently written save, if any. */
export function latestSave(): SaveInfo | null {
  return listSaves().sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}
