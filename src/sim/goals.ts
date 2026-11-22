import { netWorth } from './actions';
import { MAX_FLOORS, MILL_IDS, type MachineType } from './machines';
import { ledgerProfit, pushLog, type GameState } from './state';

export interface Goal {
  id: string;
  title: string;
  /** how to go about it */
  hint: string;
  done(s: GameState): boolean;
}

const n = (s: GameState, t: MachineType) => s.machines.filter((m) => m.type === t).length;
const hands = (s: GameState) => Math.round(s.labour.needed * s.labour.staffing);

/** Milestones in rough order. The first few double as a tutorial. */
export const GOALS: Goal[] = [
  {
    id: 'wheel',
    title: 'Set up another spinning wheel',
    hint: 'Choose "Great wheel & hand cards" under Build, then click a free part of the workshop floor.',
    done: (s) => n(s, 'spinningWheel') >= 5 || n(s, 'jenny') > 0,
  },
  {
    id: 'loom2',
    title: 'Set up a second handloom',
    hint: 'A loom uses the weft of about four wheels. Build spinners first, then the loom.',
    done: (s) => n(s, 'handloom') >= 2,
  },
  {
    id: 'profit',
    title: 'Close a year in profit',
    hint: 'Let time run (4× helps). The Ledger shows each year\'s accounts.',
    done: (s) => s.history.some((l) => ledgerProfit(l) > 0),
  },
  {
    id: 'jenny',
    title: 'Acquire the spinning jenny',
    hint: 'It appears under Inventions in 1764 and costs £20.',
    done: (s) => s.tech.includes('jenny'),
  },
  {
    id: 'jenny3',
    title: 'Have three jennies at work',
    hint: 'Each does the work of eight wheels. Sell the wheels to make room.',
    done: (s) => n(s, 'jenny') >= 3,
  },
  {
    id: 'mill',
    title: 'Build the water mill',
    hint: 'Acquire "Water-powered mill" (1769), save £600, then look under Works below the Build list.',
    done: (s) => s.mills.mill.built,
  },
  {
    id: 'twist',
    title: 'Spin a thousand pounds of cotton twist',
    hint: 'In the mill: a carding engine, a drawing frame, then water frames. All take their drive from the line shaft.',
    done: (s) => s.stats.twist >= 1000,
  },
  {
    id: 'calico',
    title: 'Weave a hundred pieces of calico',
    hint: 'After 1774, looms weave calico whenever they have both weft and cotton twist.',
    done: (s) => s.stats.calico >= 100,
  },
  {
    id: 'hands50',
    title: 'Employ fifty hands',
    hint: 'See the Hands panel. If hands run short, raise wages or build cottages.',
    done: (s) => hands(s) >= 50,
  },
  {
    id: 'housing',
    title: 'Build cottages for your hands',
    hint: 'Under Works. Housed hands stay with you and are better content.',
    done: (s) => s.labour.housing >= 1,
  },
  {
    id: 'muslin',
    title: 'Weave fifty pieces of muslin',
    hint: "Crompton's mule (1779) spins fine yarn; looms weave it into muslin.",
    done: (s) => s.stats.muslin >= 50,
  },
  {
    id: 'engine',
    title: 'Set a steam engine to work',
    hint: 'Acquire the rotative steam engine (1786), then build the engine house under Works. Keep it in coal.',
    done: (s) => MILL_IDS.some((id) => s.mills[id].engine),
  },
  {
    id: 'worth10k',
    title: 'Be worth £10,000',
    hint: 'Net worth is shown at the top: cash, plant and stock, less loans.',
    done: (s) => netWorth(s) >= 10000,
  },
  {
    id: 'storeys',
    title: 'Raise a mill to three storeys',
    hint: 'Under Works. Every storey has its own line shaft.',
    done: (s) => MILL_IDS.some((id) => s.mills[id].floors >= MAX_FLOORS),
  },
  {
    id: 'powerlooms',
    title: 'Have ten power looms weaving',
    hint: 'The power loom arrives in 1803. Each needs twist from the frames and a good deal of weft.',
    done: (s) => n(s, 'powerLoom') + n(s, 'lancashireLoom') >= 10,
  },
  {
    id: 'mill2',
    title: 'Build the New Mill',
    hint: 'A steam mill away from the river, under Works.',
    done: (s) => s.mills.mill2.built,
  },
  {
    id: 'region',
    title: 'Take a mill in another town',
    hint: 'Open Region. Mills elsewhere are run by managers and pay you their profits.',
    done: (s) => s.region.mills.length >= 1,
  },
  {
    id: 'prints',
    title: 'Print five hundred pieces of calico',
    hint: 'Bleach grey calico in a bleaching croft (1788), then print it on a cylinder machine (1790).',
    done: (s) => s.stats.prints >= 500,
  },
  {
    id: 'hands250',
    title: 'Employ 250 hands',
    hint: 'A concern of the first rank.',
    done: (s) => hands(s) >= 250,
  },
  {
    id: 'selfactor',
    title: 'Install a self-acting mule',
    hint: "Roberts's self-actor arrives in 1830.",
    done: (s) => n(s, 'selfActor') >= 1,
  },
  {
    id: 'lancs',
    title: 'Have fifty Lancashire looms weaving',
    hint: 'The Lancashire loom arrives in 1841.',
    done: (s) => n(s, 'lancashireLoom') >= 50,
  },
  {
    id: 'region5',
    title: 'Own mills in five towns',
    hint: 'Keep their machinery up to date or their profits fall away.',
    done: (s) => s.region.mills.length >= 5,
  },
  {
    id: 'worth100k',
    title: 'Be worth £100,000',
    hint: 'A cotton lord.',
    done: (s) => netWorth(s) >= 100000,
  },
];

export function updateGoals(s: GameState): void {
  for (const g of GOALS) {
    if (s.goals.includes(g.id) || !g.done(s)) continue;
    s.goals.push(g.id);
    s.standing = Math.min(100, s.standing + 1.5);
    pushLog(s, `Milestone: ${g.title.charAt(0).toLowerCase()}${g.title.slice(1)}.`);
  }
}

/** The next milestones not yet reached, in order. */
export function nextGoals(s: GameState, count = 2): Goal[] {
  return GOALS.filter((g) => !s.goals.includes(g.id)).slice(0, count);
}

export interface Score {
  standing: number;
  worth: number;
  goals: number;
  goalsTotal: number;
  rating: string;
  verdict: string;
}

const RATINGS: [number, string, string][] = [
  [400000, 'A prince of the cotton trade', 'Mills in half the towns of Lancashire, and a seat in Parliament for the asking.'],
  [100000, 'Cotton lord', 'Your name is spoken on the Manchester Exchange with something like awe.'],
  [40000, 'A manufacturer of the first rank', 'Your chimneys are a landmark and your yarn a byword.'],
  [10000, 'A substantial mill owner', 'A solid concern, well thought of in the trade.'],
  [2000, 'A small master', 'You have kept your head above water through hard times and good.'],
  [-Infinity, 'In the hands of your creditors', 'The works are to be sold by auction, with all the machinery therein.'],
];

export function finalScore(s: GameState): Score {
  const worth = netWorth(s);
  const [, rating, verdict] = RATINGS.find(([min]) => worth >= min)!;
  return { standing: s.standing, worth, goals: s.goals.length, goalsTotal: GOALS.length, rating, verdict };
}

