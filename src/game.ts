import { create } from 'zustand';
import { sound } from './audio';
import { autoplay } from './sim/autoplay';
import { MAX_FLOORS, type MachineType, type MillId } from './sim/machines';
import { latestSave, loadSlot, saveSlot, type Slot } from './sim/saves';
import { createGame } from './sim/scenarios';
import { newGame, type GameState } from './sim/state';
import type { Difficulty } from './sim/trade';
import { prime, step } from './sim/tick';

export type Panel = 'title' | 'market' | 'ledger' | 'tech' | 'hands' | 'production' | 'region' | 'exchange' | 'machines' | 'decision' | 'scenario' | 'books' | 'help' | 'end' | null;
export type Selection = number | 'power' | `engine:${MillId}` | null;

interface UIState {
  /** bumped a few times a second so panels re-read the sim state */
  tick: number;
  selected: Selection;
  placing: MachineType | null;
  /** id of an existing machine being moved (placing then holds its type), or null when placing a new one */
  moving: number | null;
  /** whether the machine being placed is turned about to face the other way */
  flip: boolean;
  placeHint: string | null;
  panel: Panel;
  speed: number;
  showLabels: boolean;
  /** show only the selected machine, for close study */
  isolate: boolean;
  /** highest storey of the mills that is drawn (0 = ground floor only) */
  viewLevel: number;
  /** show the buildings whole, with walls and roofs on */
  roofs: boolean;
  /** mark on the floor every machine that is held up, coloured by the cause */
  overlay: boolean;
  /** a machine set up on its own for the encyclopedia */
  exhibit: MachineType | null;
  sound: boolean;
}

export const useUI = create<UIState>(() => ({
  tick: 0,
  selected: null,
  placing: null,
  moving: null,
  flip: false,
  placeHint: null,
  panel: 'title',
  speed: 0,
  showLabels: true,
  isolate: false,
  viewLevel: MAX_FLOORS - 1,
  roofs: false,
  overlay: false,
  exhibit: null,
  sound: false,
}));

/** Turn the sound of the works on or off. Must be called from a click or key press. */
export function toggleSound(): void {
  const on = !useUI.getState().sound;
  sound.setOn(on);
  useUI.setState({ sound: on });
}

export const bump = () => useUI.setState((s) => ({ tick: s.tick + 1 }));

export const game: { state: GameState } = { state: newGame() };
prime(game.state);

/** Seconds of real time per game week at 1x speed. */
export const SECONDS_PER_WEEK = 3;
const STEP = 0.05;
let acc = 0;
let sinceBump = 0;
let lastYearSaved = -1;

export function advance(realDt: number): void {
  const { speed } = useUI.getState();
  const s = game.state;
  if (speed > 0) {
    acc += (realDt * speed) / SECONDS_PER_WEEK;
    let n = 0;
    while (acc >= STEP && n < 60) {
      step(s, STEP);
      acc -= STEP;
      n++;
    }
    if (n === 60) acc = 0;
    const year = Math.floor(s.week / 52);
    if (year !== lastYearSaved) {
      if (lastYearSaved >= 0) saveSlot('auto', s);
      lastYearSaved = year;
    }
    if (s.scenarioEnd && !s.fired.includes('scenarioShown')) {
      s.fired.push('scenarioShown');
      useUI.setState({ panel: 'scenario', speed: 0 });
    }
    if (s.ended && !s.fired.includes('endShown')) {
      s.fired.push('endShown');
      useUI.setState({ panel: 'end', speed: 0 });
    }
  }
  // A question of the day stops the clock the moment it arises, whatever the player is looking at,
  // and is put before them as soon as no other panel is in the way. Having seen it they may set the
  // clock going again and let it lie; only then does it settle itself after half a year.
  if (s.pending && !s.fired.includes('asked:' + s.pending)) {
    const ui = useUI.getState();
    if (ui.speed > 0) useUI.setState({ speed: 0 });
    if (ui.panel === null) {
      s.fired.push('asked:' + s.pending);
      useUI.setState({ panel: 'decision', speed: 0 });
    }
  }
  sinceBump += realDt;
  if (sinceBump > 0.25) {
    sinceBump = 0;
    bump();
  }
}

/** Run an action against the sim state and refresh the UI. */
export function act<T>(fn: (s: GameState) => T): T {
  const r = fn(game.state);
  bump();
  return r;
}

function adopt(state: GameState, panel: Panel, speed: number): void {
  game.state = state;
  prime(state);
  acc = 0;
  lastYearSaved = -1;
  useUI.setState({ selected: null, placing: null, moving: null, placeHint: null, isolate: false, roofs: false, exhibit: null, viewLevel: MAX_FLOORS - 1, panel, speed });
  bump();
}

/** Start a new game: the full story from 1760, or a scenario that begins later. */
export function startNew(scenario = 'full', difficulty: Difficulty = 'normal'): void {
  adopt(createGame(scenario, difficulty, (Date.now() & 0xffff) + 1), 'help', 0);
}

export function loadGame(slot: Slot): boolean {
  const s = loadSlot(slot);
  if (!s) return false;
  adopt(s, null, 0);
  return true;
}

export function saveGame(slot: Slot): boolean {
  const ok = saveSlot(slot, game.state);
  bump();
  return ok;
}

/** Take up the most recent save. */
export function continueGame(): boolean {
  const last = latestSave();
  return last ? loadGame(last.slot) : false;
}

// Development console access: __mill.game.state, __mill.useUI
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__mill = {
    game,
    useUI,
    act,
    /** __mill.demo(1850): start afresh and let the built-in manager play to that year */
    demo(untilYear = 1850) {
      const s = newGame();
      prime(s);
      autoplay(s, untilYear);
      adopt(s, null, 1);
    },
  };
}
