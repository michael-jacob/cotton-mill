import { netWorth } from './actions';
import { autoplay } from './autoplay';
import { newGame, pushLog, yearFloat, type GameState } from './state';
import { prime } from './tick';
import { DIFFICULTY, type Difficulty } from './trade';

/** Shorter games that begin partway through the story, each with a task to do by a set year. */

export interface Scenario {
  id: string;
  name: string;
  year: number;
  blurb: string;
  /** what must be done, and by when; absent for the full game */
  goal?: { title: string; by: number; done(s: GameState): boolean };
  /** adjust the state after the built-in manager has played up to the starting year */
  setup?(s: GameState): void;
}

/** Twist spun since the scenario began: a running total, so selling or losing a frame takes nothing away. */
const twist = (s: GameState) => s.stats.twist - s.scenarioBase.twist;

export const SCENARIOS: Scenario[] = [
  { id: 'full', name: 'From the beginning', year: 1760, blurb: 'Four wheels and a loom. Ninety years to make what you can of them.' },
  {
    id: 'arkwright',
    name: "Arkwright's hour",
    year: 1771,
    blurb: 'A going workshop and £900 in hand as the first water mills rise on the Derwent. Build your own and get into twist before the patent lapses.',
    goal: { title: 'Spin 30,000 lb of cotton twist by 1785', by: 1785, done: (s) => twist(s) >= 30000 },
    setup: (s) => {
      s.cash = 900;
    },
  },
  {
    id: 'steam',
    name: 'The age of steam',
    year: 1790,
    blurb: 'A water mill at the limit of its wheel, and the first engines at work in Manchester. Twenty-five years of war and blockade lie ahead.',
    goal: { title: 'Be worth £80,000 by 1815', by: 1815, done: (s) => netWorth(s) >= 80000 },
  },
  {
    id: 'crash',
    name: 'The crash of 1825',
    year: 1825.9,
    blurb: 'A great concern, heavily borrowed, on the eve of the worst panic in memory. The banks are failing. Come through it.',
    goal: { title: 'Reach 1830 worth at least £60,000 and owing nothing', by: 1830, done: (s) => yearFloat(s) >= 1829.95 && netWorth(s) >= 60000 && s.loan <= 0 },
    setup: (s) => {
      s.loan = 30000;
      s.cash = Math.min(s.cash, 800);
    },
  },
];

export function createGame(scenarioId: string, difficulty: Difficulty, seed = 1760): GameState {
  const sc = SCENARIOS.find((x) => x.id === scenarioId) ?? SCENARIOS[0];
  const s = newGame(seed);
  s.difficulty = difficulty;
  s.cash = DIFFICULTY[difficulty].cash;
  s.scenario = sc.id;
  prime(s);
  if (sc.year > 1760) {
    autoplay(s, sc.year);
    sc.setup?.(s);
    s.scenarioBase = { twist: s.stats.twist };
    s.log = [];
    pushLog(s, `${sc.name}. ${sc.goal ? 'Your task: ' + sc.goal.title + '.' : ''}`);
  }
  return s;
}

/** Once a week: has the scenario's task been done, or the time run out? */
export function checkScenario(s: GameState): void {
  const goal = SCENARIOS.find((x) => x.id === s.scenario)?.goal;
  if (!goal || s.scenarioEnd) return;
  if (goal.done(s)) {
    s.scenarioEnd = 'won';
    pushLog(s, `Done: ${goal.title.charAt(0).toLowerCase()}${goal.title.slice(1)}.`);
  } else if (yearFloat(s) >= goal.by) {
    s.scenarioEnd = 'lost';
    pushLog(s, `The time has run out: you did not ${goal.title.charAt(0).toLowerCase()}${goal.title.slice(1)}.`);
  }
}
